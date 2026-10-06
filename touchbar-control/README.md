# touchbar-control

A local website that shows your **real** Touch Bar — the same React app, the
same Cairo renderer, real data, every animation — lets you preview it as any
app would see it, and rearrange it by dragging its buttons.

```
                    ┌──────────────── touchbar-control server (:3100) ────────────────┐
browser ── /ws ───► │ relay: frames (+ the scene each frame shows) → page             │
                    │        touches → sandbox                                        │
        ── /api ──► │ layout · schema · presets · apply/revert · preview-as-app ·     │
                    │ simulated actions · sandbox control                             │
                    └──────┬─────────────────────────────────────────┬─────────────────┘
                           │ spawns + drives                          │ Apply
                           ▼                                          ▼
       sandbox = the react-drm app with REACT_DRM_BACKEND=preview    config.ts, patched in place
       and REACT_DRM_SANDBOX=1 on :8797 — live layout store,          by config-gui's engine
       focus override, simulated actions, no dim / pixel shift        → restart react-drm
```

The sandbox is a separate instance of the app. Nothing you do on the page
changes your physical Touch Bar until you **Apply** — or until you turn on
**Live on Touch Bar**, which shows your edits on the hardware instantly.

## Contents

- [Run it](#run-it)
- [Using it](#using-it) — Use mode, screens, Preview as app, Safe preview, Edit mode, Live on Touch Bar, undo after Apply, menus, shortcuts
- [How it works](#how-it-works)
- [API](#api)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)

## Run it

**Installed by `./install.sh`** (from the repository root): it builds this
folder and runs it as the `touchbar-control.service` user service, with a
*Touch Bar Control* launcher — just open http://127.0.0.1:3100.

```sh
systemctl --user status touchbar-control      # running?
journalctl --user -u touchbar-control -b      # its log
```

It previews, edits and applies to the react-drm install it lives in (this
folder's parent). Set `REACT_DRM_DIR` to use a different one — e.g. a
development fork deployed into a separate copy with `./deploy.sh`
(`REACT_DRM_DEPLOY_DIR`; `NO_RESTART=1` stages without restarting the bar).

To run it by hand instead (Node 20+; the server starts the sandbox with the
same `node`):

```sh
cd touchbar-control
npm install        # once
npm start          # builds the page, serves http://127.0.0.1:3100
```

Development, with hot reload for the page and the server:

```sh
npm run dev        # server on :3100 + Vite on http://127.0.0.1:5173 (proxies /api and /ws)
```

| Setting | Default | |
|---|---|---|
| `PORT` | `3100` | website |
| `HOST` | `127.0.0.1` | bind address |
| `TBC_SANDBOX_PORT` | `8797` | sandbox preview instance |
| `TBC_SANDBOX_LOG` | `/tmp/touchbar-control-sandbox.log` | sandbox output |
| `TBC_CONFIG_DIR` | `$XDG_CONFIG_HOME/touchbar-control` | where *My presets* are kept |
| `REACT_DRM_DIR` | this folder's parent | the react-drm install (sandbox, `config.ts`, config engine) |

The sandbox starts with the first page, stops 3 minutes after the last page
closes, and is killed with the server.

## Using it

### Use mode

The live bar, large. Click, hold and drag on it exactly like a finger — taps,
long-press, slider drags and swipes all go through the app's real touch
handling.

### Screens

The **Screen** picker (next to Preview as app; also **View → Go to screen** and
Ctrl+K) jumps the sandbox bar straight to any of its screens instead of tapping
your way there: main bar, dock, system bar, F-keys, volume and brightness
sliders, media tools, the games menu and each game, the launcher and the custom
layer. It shows which screen is up. (Sliders return to the main bar by
themselves after a few seconds, as on the hardware; the lock screen isn't
listed — the system lock drives it.)

### Preview as app

The picker in the header (also **View → Preview as app** and Ctrl+K) makes the
sandbox *pretend* an app is focused: Firefox, Chrome, VS Code, Konsole, VLC,
Dolphin, Gwenview, a terminal (Ghostty), Files (Nautilus) or the desktop. The
bar then shows exactly what that app would get — its left panel, its keys, its
accents. **Real focus** (Use mode only) follows your actual windows instead.
Your real window focus is never changed.

| App | Left panel |
|---|---|
| Firefox, Chrome | browser |
| VS Code | vscode |
| Konsole · VLC · Dolphin · Gwenview | their own panels |
| Terminal, Files, desktop | default |

### Safe preview

Tapping a button in the sandbox would otherwise act on your real desktop:
browser and VS Code buttons press keys in whatever window has focus (previewing
Firefox and tapping ✕ would close a real tab — probably this page), dock
buttons launch apps, and the Konsole, Dolphin, Gwenview and VLC buttons drive
those apps over D-Bus. So by default the sandbox **simulates** these:

- injected keys, focusing a window, launching apps, and the D-Bus commands to
  Konsole / Dolphin / Gwenview / VLC are recorded instead of performed, and
  listed under **Simulated actions** (e.g. `Press Ctrl+R`, `Konsole: new tab`)
- turn on **Real actions** (Use mode, or **View → Allow real bar actions**) to
  let the sandbox really do them
- volume and brightness still change for real — they're harmless and
  reversible

The physical bar is never affected by this switch.

### Edit mode

The bar, the **Hidden** tray and the **Live result** span the full width; the
**Palette** and **Properties** sit side by side below (resizable).

- **Tiles** — the bar split into one tile per button, each a live crop of the
  real frame (a clock keeps ticking inside its tile). Drag to reorder within a
  group; drag to **Hidden** to take a button off the bar; right-click for
  Properties / Move left / Move right / Hide.
- **Palette** — every arrangeable button with a live thumbnail, searchable and
  grouped. Drag a row onto the bar to place it; a hidden button is shown again
  at the drop spot.
- **Properties** — the selected button: id, group, position, where it renders,
  and move / hide / show.
- The left panel you arrange is the **previewed app's** (VS Code by default).
  Every app panel is arrangeable: VS Code, Firefox/Chrome, Konsole, VLC,
  Dolphin and Gwenview (terminal, Files and the desktop use the default panel,
  which has no buttons). Konsole and Dolphin only draw their buttons while the
  app is running — until then their tiles show the button names, with a
  notice, and can still be arranged and hidden.
- Every change re-renders the sandbox bar immediately — the Live result shows
  it. The status bar says whether the layout **matches your Touch Bar** or is
  **not applied yet**.
- **Apply to Touch Bar** asks for confirmation, then writes `BAR_LAYOUT` /
  `LEFT_LAYOUT` into `config.ts` and restarts `react-drm` (the physical bar is
  blank for a few seconds). **Revert** goes back to what `config.ts` holds.

### Live on Touch Bar

The **Live on Touch Bar** switch (Edit mode header; also **View** and Ctrl+K)
shows every edit on your **physical** bar the moment you make it — no Apply,
no restart:

- drags, hides, presets, imports, undo/redo and Revert all go to the hardware
  as well as the sandbox; a sleeping or dimmed bar wakes up to show them
- **Your physical Touch Bar** (under Live result) shows the hardware's own
  current frame, refreshed after each edit
- **Apply** keeps the layout (writes `config.ts`); the bar restarts and Live
  switches itself off
- turning Live **off** — or closing the site, or the site crashing — puts the
  saved layout back on the bar automatically: an unapplied edit can never get
  stuck on the hardware
- only the button layout goes live; *Preview as app*, simulated actions and the
  screen navigator stay sandbox-only (the physical bar keeps following your
  real windows)

It needs the running service to have the live socket
(`$XDG_RUNTIME_DIR/react-drm-live.sock`, owner-only) — deploy the app and
restart it once; the switch is greyed out otherwise.

### Undo after Apply

Every Apply first keeps a copy of `config.ts` (with the layout it held), so a
change to the physical bar can always be taken back:

- the "Saved" notice after an Apply has an **Undo** button (for 15 s)
- **File → Restore an earlier config…** lists every kept copy — when, whether
  it was taken before an Apply or a restore, and its right-cluster order — and
  restores any of them (with a confirmation; the bar restarts)
- restoring keeps a copy of the current `config.ts` too, so a restore can be
  undone the same way
- the last 30 copies are kept in `~/.config/touchbar-control/backups/`
  (`<id>.ts` byte-for-byte, `<id>.json` for when/why/layout)

Buttons keep their group: the vscode *run* buttons can be reordered among
themselves but not moved into the right cluster (a drop there is refused with
a notice).

### Menus

| Menu | Items |
|---|---|
| **File** | Import layout… · Export layout · Apply to Touch Bar… · Revert to applied · Restore an earlier config… · Reset sandbox bar |
| **Edit** | Undo · Redo (100 steps) · Hide/Show selected · Move left · Move right · Reset to built-in order |
| **View** | Use/Edit · Config… (the exact config Apply writes, copyable) · Live on Touch Bar · Go to screen ▸ · Preview as app · Allow real / Simulate bar actions · Command palette |
| **Presets** | Built-in: Default, Minimal, Media & games first · *My presets* (load) · Save current as preset… · Delete preset ▸ |
| **Help** | Keyboard shortcuts · Command palette |

**Ctrl+K** opens the command palette: every action, every button (selects it),
every screen, every app preview, every preset.

Layouts export as `touchbar-layout-<date>.json`:

```json
{ "format": "touchbar-control/layout", "version": 1,
  "layout": { "rightButtons": ["snake", "back"], "hidden": ["volume"], "left": { "vscode": { "run": ["stop", "run"] } } } }
```

### Keyboard shortcuts

| Shortcut | |
|---|---|
| Ctrl+K | Command palette |
| Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) | Undo / Redo |
| H or Delete | Hide / show the selected button |
| Alt+← / Alt+→ | Move the selected button |
| Esc | Clear the selection |
| E | Switch Use ↔ Edit |
| Ctrl+Enter | Apply to Touch Bar… |
| Ctrl+E / Ctrl+O | Export / Import layout |

Editing shortcuts work in Edit mode when no text field has focus.

## How it works

### Pieces

| Piece | Where |
|---|---|
| Server: API, frame/touch relay, sandbox lifecycle | `server/index.ts`, `server/sandbox.ts` |
| Apply / applied layout (reuses config-gui's `configEngine.ts`) | `server/apply.ts` |
| My presets store (atomic JSON file) | `server/presets.ts` |
| config.ts backups (undo after Apply) | `server/backups.ts` |
| Live on Touch Bar client (lease, mirroring, hardware snapshots) | `server/liveBar.ts` |
| Layout → config sections / config text; untrusted-layout validation | `shared/layoutConfig.ts`, `shared/layoutValidate.ts` |
| Types shared by server and page | `shared/types.ts` |
| Editor state + every action (menus, Ctrl+K, shortcuts, context menus all call these) | `web/src/lib/useEditor.ts` |
| Pure, tested logic: edit model, drops, undo, presets, layout files | `web/src/lib/{editModel,drop,history,presets,layoutFile}.ts` |
| Frame/scene connection | `web/src/lib/bar.ts` |
| Components (shadcn/ui in `components/ui`) | `web/src/components/{app,bar,ui}` |

The UI is built with [shadcn/ui](https://ui.shadcn.com) — Radix base,
`radix-nova` style, lucide icons, Tailwind v4, dark. Add components with
`npx shadcn@latest add <name>` from this folder; the project's shadcn agent
skill is in `../.claude/skills/shadcn`.

App side (`linux-touchbar-control-center/`, deployed with `./deploy.sh`):

| Piece | Where |
|---|---|
| Live layout store — seeded from config, replaceable at runtime in a sandbox | `lib/utils/layoutStore.ts`, `lib/utils/layoutModel.ts` |
| Which buttons exist, per group | `lib/utils/layoutSchema.ts` |
| Which panel a window class gets; the app-preview list | `lib/utils/leftPanelRouting.ts` |
| The screens a sandbox can jump to | `lib/utils/screens.ts` |
| Live layout socket on the physical bar (layout only, leased, wakes the bar) | `lib/services/liveLayout.ts` |
| Focus override ("Preview as app") | `lib/activeWindow/store.ts` |
| Simulated actions (keys, window focus, launches, app D-Bus calls) | `lib/services/sandboxActions.ts`, guarded in `keyInjector.ts`, `launch.ts`, `useBrowserKeys.ts`, `useVsCodeKeys.ts`, `useKonsole.ts`, `useDolphin.ts`, `useGwenview.ts`, `useVlc.ts` |
| Sandbox mode and its routes | `index.tsx` |

Library side (`src/`):

| Piece | Where |
|---|---|
| Widget geometry: layout box, visible part after clips, opacity | `src/scene/scene-boxes.ts` → `RenderResult.sceneBoxes()` |
| Preview server: app JSON routes + a scene message before each frame | `src/dev/preview-server.ts` (`routes`, `frameScene`) |
| Moving children without duplicating them (React reorders) | `src/renderer/child-order.ts` |

### Frames, scenes and tiles

Each frame the sandbox renders is streamed to the page (16-byte header + RGBA).
When the widget geometry changed, the sandbox first sends that frame's **scene**
(`{type:"scene", scene:{width,height,boxes}}`). The page adopts a scene only
when it paints the frame it belongs to, so a tile always crops the pixels it
describes — polling the scene separately made tiles show their neighbours'
pixels while the cluster animated its width after a reorder.

A tile crops by **id**, not by position, so it shows the right widget whatever
order the edit surface is in, and keeps the last clean crop for buttons that
are hidden or off-screen.

### Layout data

```ts
BarLayout = {
  rightButtons: string[];                              // right cluster order (BAR_LAYOUT.rightButtons)
  hidden: string[];                                    // scene ids off the bar (BAR_LAYOUT.hidden)
  left: Record<page, Record<group, string[]>>;         // left panel order (LEFT_LAYOUT)
  pinnedLeft: string | null;                           // sandbox only, never written to config
}
```

Order rules (same in the app and the editor): unknown ids and duplicates are
dropped, built-ins missing from a list are appended in built-in order, an
empty list means the built-in order, and anything in `hidden` is left out.
Left-panel scene ids are page-qualified (`vscode.run`, `browser.home`).

### Adding another left panel

Only `id`-tagged buttons can be arranged: the right cluster and the vscode,
browser, konsole, vlc, dolphin and gwenview panels. To add another panel (see
`app/splitted/gwenview/page.tsx`):

1. give each button `id={leftButtonId('<page>', '<key>')}`
2. list its groups in `LEFT_BUILT_IN` (`lib/utils/layoutSchema.ts`)
3. order each group with `resolveLeftGroup(useLayout(), '<page>', group, builtIn)`

The editor picks it up from `/layout-schema` — no site changes needed.

## API

### Server (`:3100`)

| Method | Path | |
|---|---|---|
| GET | `/api/status` | sandbox state: `stopped · starting · ready · error` |
| GET | `/api/schema` | buttons per group, panels, app previews |
| GET / POST | `/api/layout` | the sandbox's current layout / replace fields (re-renders live) |
| GET | `/api/scene` | widget boxes of the current frame |
| GET | `/api/applied` | the layout in `config.ts` |
| POST | `/api/apply` | keep a copy of `config.ts`, write the sandbox's layout to it, restart `react-drm`; returns the copy (`backup`) for undo |
| GET / POST | `/api/active-window` | focus override: `{class, title}` or `null` for real focus |
| GET / POST | `/api/actions` | `{real, recent}` / `{real: boolean}` |
| GET / POST | `/api/screen` | `{current, screens}` / jump: `{to: "dock"}` |
| GET / POST | `/api/live` | `{enabled, available, detail}` / `{enabled: boolean}` — Live on Touch Bar |
| GET | `/api/live/snapshot` | PNG of what the physical bar is showing |
| GET | `/api/backups` | kept copies of `config.ts`, newest first |
| POST | `/api/backups/restore` | `{id}` — restore one (keeps the current one too), restart `react-drm` |
| GET / PUT / DELETE | `/api/presets` | list · save `{name, layout}` (replaces by name) · `?name=` |
| POST | `/api/sandbox/restart` | restart the sandbox (back to the main bar) |
| WS | `/ws` | frames + scenes + status to the page; `{type:"touchstart"|"touchmove"|"touchend", x, y}` from it |

Bodies are JSON, capped at 64 KB; errors come back as `{error}` with 400.
Layouts and presets are validated (ids must match `[A-Za-z0-9_.-]{1,64}`).

### Sandbox (`:8797`, preview instance)

`/scene`, `/layout-schema` and `GET /layout` exist on any preview instance.
`POST /layout`, `/active-window`, `/actions` and `/screen` exist only with
`REACT_DRM_SANDBOX=1` — a plain preview can't be rearranged or steered from
outside.

### Physical bar (live socket)

`$XDG_RUNTIME_DIR/react-drm-live.sock` — created only by the real bar (not by
previews), owner-only (`0600`, handed to the desktop user when the service runs
as root). Newline-delimited JSON:

| Request | Reply |
|---|---|
| `{"type":"get"}` | `{"type":"layout","layout":…,"live":bool}` |
| `{"type":"set","patch":{rightButtons?,hidden?,left?}}` | same; `pinnedLeft` is refused |
| `{"type":"reset"}` | back to `config.ts`'s layout |
| `{"type":"snapshot"}` | `{"type":"snapshot","png":<base64>}` |

Changes are leased to the connection that made them: when it closes, the bar
restores its saved layout.

## Tests

```sh
npm test                          # 38 unit tests: edit model, drops, undo, presets, layout files, config text, preset store, config backups, live client
npm run e2e -- /tmp/tbc-shots     # 22 end-to-end checks in headless Firefox; screenshots → dir
TBC_E2E_LIVE=1 npm run e2e -- …   # + 1 check that flips your physical bar via Live for a few seconds
```

The e2e run needs the server running (`npm start`) and uses your installed
Firefox through puppeteer-core (no browser download). It starts by resetting
the sandbox to the applied layout, then taps the live bar, jumps to the dock
and back with the screen picker, previews Firefox (and checks a browser tap is
only *simulated*), enters Edit mode, drags, hides via the context menu,
undoes/redoes, places from the palette, opens the config through Ctrl+K, saves
and loads presets, arranges Chrome, Gwenview and a not-running Konsole
(name tiles), imports a file, opens and cancels Apply, opens the restore
dialog and cancels a restore, and reverts —
checking every step against what the sandbox actually rendered and that each
tile still shows its own pixels. It never confirms Apply and deletes the preset
it saves.

The app-side pieces have their own tests in
`linux-touchbar-control-center/tests/` (`layoutModel`, `leftPanelRouting`, `screens`), and
the library's child-ordering fix in `tests/child-order.test.ts`.

## Troubleshooting

| Symptom | What to do |
|---|---|
| The live bar ignores every tap | The sandbox's touch handling got stuck (seen once, cause not found). **File → Reset sandbox bar**. |
| A tap right after switching the previewed app does nothing | The panel is drawn a moment before its buttons accept touches (layer transition). Tap again after ~1 s. |
| "Starting the Touch Bar…" forever / status `error` | See `/tmp/touchbar-control-sandbox.log`; usually the deployed app lacks the latest changes — run `./deploy.sh` (or `NO_RESTART=1 ./deploy.sh`). |
| `EADDRINUSE` on 3100 or 8797 | An old server or sandbox is still running: `fuser -k 3100/tcp` / `fuser -k 8797/tcp` (don't `pkill -f`, it can match your own shell). |
| Apply says the restart failed | The service restart needs passwordless `sudo -n systemctl restart react-drm` (or a `--user` unit). `config.ts` is already saved. |
| An Apply broke the bar | **File → Restore an earlier config…**, pick the copy from just before it. Without the site: copy `~/.config/touchbar-control/backups/<id>.ts` over `config.ts` and restart `react-drm`. |
| Konsole / Dolphin tiles show only names | The app isn't running, so the sandbox can't draw its buttons. Start it (or just arrange by name). |
| "Live on Touch Bar" is greyed out | The running service has no live socket — `./deploy.sh` (or `NO_RESTART=1 ./deploy.sh` + `sudo systemctl restart react-drm`). |
| Live turned itself off | The bar restarted (after an Apply, a deploy, a resume) — it shows the saved layout; switch Live on again to continue. |
| Everything looks tiny | Check the browser zoom (Ctrl+0 resets it). |
