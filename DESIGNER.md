# Touch Bar Designer Integration

> **Superseded by [touchbar-control](touchbar-control/README.md)** — the
> real bar streamed live, split into draggable tiles of its own pixels, edited
> in place. This document remains for the mtmr-designer bridge.

How the [mtmr-designer](https://github.com/josmanvis/mtmr-designer) web app was
turned into a live editor for this Touch Bar, and everything needed to run,
extend and debug it.

Status: working. One known open issue (intermittent swallowed taps) is
documented in [Known issues](#known-issues).

---

## 1. What this is

mtmr-designer is a drag-and-drop visual editor for **macOS** MTMR presets. It
edits an `items.json` and drives a macOS-only app. This integration makes it
edit **this** Touch Bar instead:

```
config.ts (BAR_LAYOUT / LEFT_LAYOUT)
        │  deploy.sh
        ▼
/home/Astra/opencode/react-drm/  ← the running app (systemd: react-drm)
        │
        ▼
packaging/mtmr-designer-bridge.mjs  ← converts BAR_LAYOUT ⇄ MTMR items.json
        │  MTMR_CONFIG_PATH
        ▼
mtmr-designer (localhost:3001)     ← the editor
        │
        ├─ writes back via the bridge
        └─ drives the live bar through /api/bar-tap, /api/bar-gesture
```

Two halves, deliberately separated:

| Surface | What it is | Purpose |
|---|---|---|
| **Canvas** (top, full width) | The running app's own scene, serialized to SVG | Live truth: click to drive the bar, drag to reorder, Alt+click to edit |
| **Layout strip** (below, in the editor column) | The designer's item list | Structural editing — drag to reorder, shows pending edits |

The canvas shows **what is running**; the strip shows **your pending edits**,
which only reach the bar on the next import. Keeping both avoids the confusion
of an unlabelled strip sitting under the live bar.

---

## 2. Running it

```bash
# 1. The editor (bridge mode; MTMR_CONFIG_PATH points it at the bridge file)
NODE_ENV=production packaging/start-mtmr-designer.sh      # → http://localhost:3001

# 2. Push the current bar into the editor (regenerates icons)
node packaging/mtmr-designer-bridge.mjs export

# 3. After editing in the designer: apply to the real bar
node packaging/mtmr-designer-bridge.mjs import
sudo systemctl restart react-drm

# Preview instance cleanup (the editor manages this itself; this is a manual reset)
curl -X POST http://localhost:3001/api/bar-reset
```

The editor auto-starts a **preview instance** of the app (`REACT_DRM_BACKEND=preview`
on port 8796) for captures and taps. It is restarted automatically when
`config.ts` changes, and killed after 3 minutes of no use.

> The editor lives at `../mtmr-designer` (a sibling of this fork), **not** inside it.

---

## 3. Configuration surfaces

### Right cluster — `BAR_LAYOUT.rightButtons`

Pre-existing. The seven buttons the bar renders on the right:

```ts
export const BAR_LAYOUT = {
  rightButtons: ['back', 'volume', 'brightness', 'linux', 'playpause', 'screenshot', 'snake'],
};
```

### Left panel — `LEFT_LAYOUT` (added by this work)

The left side of the bar is **context-routed**: `layout.tsx` renders
`children(leftW, height)`, a child layer picked by the focused window
(`resolveLeftSideLayerByClass`) — `vscode`, `browser`, `konsole`, `vlc`,
`dolphin`, `gwenview`, `mediaMprisList`. Those pages previously had no `id`
and no ordering input, which is why their icons could not be addressed.

`LEFT_LAYOUT` gives each page a key, and an array per group:

```ts
export const LEFT_LAYOUT = {
  vscode: {
    run:      ['run', 'stop', 'stepOver', 'stepInto', 'stepOut'],
    edit:     ['undo', 'redo', 'find'],
    commands: ['commandPalette', 'settings'],
  },
};
```

Semantics match `resolveRightButtons()` exactly (see `app/splitted/leftOrder.ts`):

- unknown ids are dropped
- ids missing from the list are appended in their built-in position, so a
  partial config never loses a button
- an empty/missing entry falls back to the built-in order
- to hide a button, list its scene id in `BAR_LAYOUT.hidden` (`volume`,
  `vscode.run`) — omitting it from its list does *not* hide it, it is appended
- buttons keep their group — the config orders them *within* a group, never
  across groups (the groups are semantic: a debug toolbar shouldn't lose its
  stop button to the command group)

Every routed app page is wired (vscode, browser, konsole, vlc, dolphin, gwenview). New pages follow
the same pattern when needed — see "Adding another left panel" in
[touchbar-control/README.md](touchbar-control/README.md#adding-another-left-panel).

### Which file wins

`config.ts` (machine-local, seeded at install) shadows `config.blueprint.ts`.
`cfg()` in `configLoader.ts` falls back to the blueprint per key, so adding a
key to only the blueprint is safe. The bridge writes **both**.

---

## 4. react-drm library changes

All in `src/`, mirrored into the live install by `deploy.sh`.

### `id` passthrough (nativeID-style)

`BoxNode.id` ← `Box`/`Button` `id` prop, via `nodeFromProps()` in
`reconciler.ts`. Nothing renders it — it exists so external tools can address
a widget. The bar's `ClusterBtn` passes `id={btn.key}`, and the left pages
pass `leftButtonId(page, action)` (e.g. `vscode.run`) so scene ids can't
collide with cluster ids like `back`.

### `sceneToSvg()` — the scene as markup

`src/scene/svg-serialize.ts` walks the **same post-Yoga layout** that
`serializeScene()` feeds to Cairo, and emits SVG instead of draw commands:

| Draw command | SVG |
|---|---|
| `fill_rect` (per-corner radii) | `<path>` with a rounded-rect path |
| `stroke_rect` | `<path fill=none stroke>` inset by half the border |
| `shadow` | `<filter><feDropShadow>` |
| `clip_push/pop` | `<clipPath>` + `<g clip-path>` |
| `transform_push/pop` | `<g transform="rotate()">` |
| `text` | `<text dominant-baseline="central">` |
| `draw_svg` | the `src` markup nested back in (icons stay vector) |
| `draw_image` | `<image>` with a PNG re-encoded from the raw buffer |
| `overlay` | black rect with opacity |

Every node with an `id` becomes `<g data-id="…" data-x=… data-w=…>`, so the
editor gets real geometry instead of inferring it from pixels.

Exposed two ways:
- `RenderResult.toSvg()` on the render handle
- `GET /svg` on the preview server (4th arg to `startPreviewServer`)

**Caveat:** layout, geometry, colors and icon paths are exact; rasterization
is the browser's rather than Cairo's, so text shaping and antialiasing differ.

### Preview-server input tracing (opt-in)

`PREVIEW_TRACE_INPUT=1` logs raw incoming touches;
`REACT_DRM_LOG_LEVEL=debug` turns on the touch registry's hit-test log;
`ROUTER_TRACE=1` logs every layer navigation including blocked ones. Set
`PREVIEW_DEBUG=1` when starting the designer to enable all three.

---

## 5. The editor side (mtmr-designer)

### Server endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/bar-svg` | proxies the running app's `GET /svg` |
| `GET /api/bar-target` | returns the preview input's ws url + bar size |
| `GET /api/bar-geometry?order=` | captures a frame, locates the `#373737` cluster tile by pixel-scanning an icon-free row, and returns per-button rects laid out per `layout.tsx` |
| `POST /api/bar-tap` · `GET /api/bar-tap` | replay a tap on the running app |
| `POST /api/bar-gesture` | replay a full touch sequence (start/move/end) |
| `POST /api/bar-reset` | restart the preview instance, back to the main bar |

Gestures are **buffered whole** in the page and sent as one request. An earlier
debounce flushed press and release as two requests on two connections; the app
then held an unpaired finger, its touch registry locked, and every later click
was silently dropped.

The page cannot open a WebSocket to the app itself: it **receives** the app's
frames but its own client→server messages never arrive. Gestures therefore go
through this server, which is the path verified to work.

### Bridge items

The editor's item shape is a `staticButton` with the react-drm id as `title`
and the real icon as an embedded SVG (`image.base64`), `align: 'right'` for the
cluster and `align: 'left'` for the routed left buttons, plus a `group` for the
left ones so the editor renders the same three tiles the bar does.

### Icon extraction

Icons come from the fork's `react-icons` packages — the same components
`layout.tsx` renders — parsed out of the `GenIcon({...})` JSON literals.
Colors match `layout.tsx`: gray `#cccccc` (theme `textPrimary`), camera
`#fbbf24`, gamepad `#4ade80`. (They were first sampled from a frame and came
out byte-reversed — `#24bffb`/`#80de4a` — because the frame was read as RGB
while it was BGRA.) Three SVG gotchas, all handled:
`xmlns` must be added (react-icons omits it or the `<img>` won't load),
explicit `width`/`height` are needed (viewBox-only collapses to 0×0), and
`fill="none"` on the background rect must be preserved (md/bs icons).

---

## 6. Gestures

| Gesture | Result |
|---|---|
| Click a button | presses it on the running app |
| Drag | reorders the layout (writes the config on import) |
| Alt+click | selects the item and opens the properties panel |
| Touch anywhere on the bar | forwarded as a real touch — the games layer, dock and routed left panels have no `data-id`, and accepting only tagged elements made those layers swallow clicks |

**Simulate** (on by default, shared preference across surfaces) governs the
click behaviour. Turning it off makes the canvas a pure editing surface.

---

## 7. Deployment

`./deploy.sh` syncs the app **and** the library, then runs `npx tsc`:

```bash
cd /home/Astra/opencode/touchbar/react-drm-fork
./deploy.sh                 # deploy + build library + restart bar
SKIP_LIB=1 ./deploy.sh      # app files only
```

The library build is not optional: `node_modules/react-drm` is a symlink to the
install root and the app imports `dist`, so editing `src/` alone has no effect
until `tsc` runs.

---

## 8. Verified behaviour

Tested one button at a time from the canvas, with a reset in between:

| button | result |
|---|---|
| brightness | opens the brightness slider (`app/brightness-slider`, auto-hides after 5s) |
| volume | opens the audio slider |
| playpause | opens the dock |
| snake | opens the games menu; clicking a game tile from there launches it |
| linux | opens the system bar |
| back | expands the media panel — cluster fades to `opacity=0` and widens, like the hardware |
| screenshot | no bar change by design — it runs niri's screenshot |
| left buttons | no bar change by design — they inject keys into the focused app |

---

## 9. Known issues

### Intermittently swallowed taps

A click from the editor sometimes has no effect on the running app.

What is **ruled out**: transport (fetch, XHR, GET, WebSocket), coordinates,
payload, server process (verified by pid), response caching (fresh nonces),
page polling, timing, gesture splitting, rect mapping.

What is **observed**: the request reaches the server, the server replays the
gesture, and the app's own log shows the tap arriving, hit-testing the right
button, `in-bounds=true` and the click firing — yet the bar does not navigate.
The identical request from `curl`, one second later, always works.

Masked rather than solved: the canvas polls tightly right after a tap
(updating in ~1s) and re-sends a tap that produces no reaction (twice).

**Next diagnostic:** log every touch the app's registry receives, with a
sequence id per gesture, to distinguish "the tap never arrived" from "it
arrived and was rejected".

### Sliders auto-hide

`AUTO_HIDE_MS = 5000` in the slider pages. A slider can appear and be gone
within seconds — that is the app's behaviour, not an editor limit.

---

## 10. Gotchas worth remembering

- The app reads `config.ts` **once at startup**; the preview server restarts the
  instance when the file changes, otherwise captures show the old layout.
- Captures right after an instance start catch a transitional frame — hence the
  6s settle delay before the first capture.
- Stale preview instances from earlier designer runs keep port 8796 and answer
  "is it ready?" with a stale layer — `fuser -k` the port before spawning.
- The `realistic` editor canvas must use **real** geometry: left buttons 38px
  (`BTN_W 100` − 2×2 border), in-tile gap 0.8, between tiles 9.2 (calibrated
  against a measured frame), cluster back 16 / others 48, icons 12.8
  (`ICON_SIZE 32`) — all at 0.4 scale.
- A bare `svg` CSS selector in the editor stretches the nested react-icons
  elements; scope to the direct child.
- Pixel-shift means the app subtracts a small offset from incoming touches; the
  scene's `data-x` is unshifted, which is harmless inside a 120px button.
