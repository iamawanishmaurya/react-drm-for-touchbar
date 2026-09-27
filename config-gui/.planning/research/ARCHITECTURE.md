# Architecture Research — config-gui Redesign

**Analysis Date:** 2026-09-28

## Target Architecture (renderer modularization)

```
renderer/
├── index.html            # shell: topbar + sidebar + main (preview pane + editor pane)
├── main.ts               # boot: load state, build nav, wire topbar
├── state.ts              # ConfigData store: get/setPath, dirty tracking, save/restart IPC calls
├── schema.ts             # NEW: field descriptions, union options, section→page mapping, advanced flags
├── pages/
│   ├── layoutPage.ts     # bar-layout drag editor (BAR_LAYOUT) + dock strip
│   ├── dockPage.ts       # dock apps list + appearance (extracted from today's renderDock)
│   ├── shortcutsPage.ts  # keymaps + overrides (extracted)
│   ├── behaviorPage.ts   # generic-object pages, grouped
│   └── advancedPage.ts   # hidden-by-default sections
├── widgets/
│   ├── fieldRow.ts       # labeled field (text/number/bool/select/list)
│   ├── keyCapture.ts     # existing key-capture widget, extracted
│   ├── appPicker.ts      # existing overlay picker, extracted
│   └── dnd.ts            # small HTML5 drag-and-drop helper (list reorder + drop zones)
└── preview/
    ├── client.ts         # ws connect, BGRA→canvas frame pump, status events
    └── overlay.ts        # drag targets positioned over the canvas strip
```

tsc emits one `.js` per module; `index.html` keeps a single module entry; imports use `.js` extensions.

## Data Flow (unchanged spine, new preview lane)

- **Edit lane:** page widgets → `state.setPath()` → dirty → Save → `config:write` (engine patches config.ts) → optional Restart.
- **Preview lane:** main process spawns preview instance → renderer `ws://127.0.0.1:PORT/ws` → canvas. Preview restarts when the touch bar service restarts (frames stop → status chip shows offline → auto-reconnect).

## Process Changes (main)

- New `main/preview.ts`: spawn/kill `npx tsx index.tsx` with `REACT_DRM_BACKEND=preview`, pick a free port, surface port + lifecycle over IPC (`preview:status`, `preview:start`, `preview:stop`). Renderer gets `ws://127.0.0.1:PORT/ws` and connects directly (no proxying — Electron renderer has full Chromium WS support).
- Fix `restartService` to target the root unit on this deployment (`sudo systemctl restart react-drm` — passwordless sudo is configured on this machine) while keeping `--user` for upstream deployments: try system unit first, fall back.

## BAR_LAYOUT End-to-End

1. `config.blueprint.ts`: `export const BAR_LAYOUT = { rightButtons: ['back','volume','brightness','linux','playpause','screenshot','snake'], }` (order = today's hardcoded BASE_BTNS).
2. `main/configEngine.ts`: add `'BAR_LAYOUT'` to `SECTION_NAMES`; string arrays already round-trip (`nodeToValue`/`valueToLiteralText` handle arrays of strings).
3. App side `lib/utils/configLoader.ts` + `app/splitted/layout.tsx`: read `BAR_LAYOUT.rightButtons`, resolve each id to its existing action/icon entry; unknown/missing ids filtered out; missing section → today's order (backward compatible).
4. GUI layout page: drag chips to reorder → `state.BAR_LAYOUT.rightButtons` → Save → Restart.

## What Does NOT Change

- `configEngine.ts` merge/patch logic (tests keep passing), IPC result shapes, blueprint seeding, desktop-app picker backend, icon resolution.

---

*2026-09-28 analysis: initial research*
