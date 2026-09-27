---
last_mapped_commit: f7097b344f7c49ea5bdd7e268a5083b8bef708a5
last_mapped_at: 2026-09-28
---
# Architecture

**Analysis Date:** 2026-09-28

## Pattern

Classic Electron two-process app with a strict IPC boundary and all side effects in the main process:

```
renderer (DOM UI)  --contextBridge-->  ipcMain handlers  -->  configEngine (ts-morph)  -->  config.ts on disk
     ^                                                                                                |
     └────────────────── systemctl restart → Touch Bar reloads with the new config ────────────────────┘
```

- **Renderer** (`renderer/renderer.ts`) holds the entire editable state as one plain JSON object (`state`, line 3), renders forms from it, and sends the *whole* state on save. No framework, no state library, no vdom — direct `document.createElement` everywhere.
- **Main** (`main/main.ts`) registers IPC handlers, owns the window, resolves paths, and delegates file work.
- **Engine** (`main/configEngine.ts`) is a pure-ish module over `config.ts`: `readConfig(configPath, blueprintPath)` → JSON snapshot; `writeConfig(configPath, changes)` → surgical AST patch; `restartService()`.

## Data Flow (read → edit → save)

1. **Boot** (`renderer/renderer.ts:206-224`): `configApi.meta()` (icons/keys) then `configApi.read()` → `state` deep-cloned from the returned snapshot. If the repo isn't found → "Locate folder…" empty state; parse errors → error panel.
2. **Editing**: every input writes back into `state` via `setPath(fieldPath, value)` (line 87) then `markDirty()` (line 106) — status text flips to "Unsaved changes" and the Dock preview re-renders.
3. **Save** (`wireTopbar`, line 929): `window.configApi.write(state)` sends the *entire* ConfigData. Main process patches each present section; unchanged fields are skipped by `deepEqual` to preserve formatting (`configEngine.ts:219`).
4. **Apply**: after a successful save a "Restart touch bar service" button appears → `config:restart` → systemctl → the Touch Bar hot-reloads with the new compiled config (`syncCompiledConfig` already refreshed `dist/config.js`).

## Section Model

The editable surface is fixed and known at compile time:

- 17 sections (`SECTION_NAMES`, `configEngine.ts:10-16`) mirror top-level `const` objects in `config.ts` (DISPLAY, SLEEP, DOCK, SYSTEMBAR, …).
- Renderer organizes them into 4 nav groups (`NAV_GROUPS`, `renderer.ts:17-28`) and picks a specialized renderer per section (`renderSection`, line 327): DOCK (preview + app cards + icon theme), browser/VSCode keymaps (key-capture inputs), overrides (per-window-class blocks), FN_KEYS (extra key list), everything else a generic recursive object form (`renderGenericObject`, line 341) with union selects from `UNION_FIELDS` (line 68).

## Key Abstractions

- `JsonValue` / `ConfigData` (`renderer/types.ts`, mirrored in `configEngine.ts:48-49`) — the whole IPC contract is plain JSON.
- `nodeToValue` (`configEngine.ts:58-93`) — AST → JSON with deliberate lossiness: anything it can't round-trip (JSX icon refs, template literals, spreads) comes back `undefined` and is **omitted** from both the form and the write path, so unsupported source is never clobbered.
- `withDefaults` (line 115) — blueprint-merge so new upstream fields appear without clobbering user values.
- `mergeDockApps` (line 246) — the one structural (array reorder/insert/delete) editor; id-matched, format-preserving, appends `react-icons/fa6` imports as needed.

## Entry Points

- Main: `main/main.ts` (`app.whenReady().then(createWindow)`, line 115) — frameless window loading `dist/renderer/index.html`.
- Renderer: `renderer/renderer.ts` bottom — `wireWindowControls(); main();` (line 963-964).
- Tests: `main/configEngine.test.ts` via `tsx --test`.

## Existing "preview"

The only preview today is the **Dock preview** (`renderDockPreview`, `renderer.ts:129-198`): a proportional 2008:60-aspect mock of the dock's icons/panel/indicator, re-rendered live on every edit. Nothing previews the rest of the bar (systembar, panels, layout, ordering).

---

*2026-09-28 analysis: initial codebase map*
