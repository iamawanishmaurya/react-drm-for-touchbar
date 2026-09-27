# Phase 1 Research — Modularize the renderer

**Date:** 2026-09-28
**Question:** "What do I need to know to PLAN this phase well?"

## Answers

### 1. Exact current structure of renderer.ts (what moves where)

| Current code (renderer/renderer.ts) | Destination module |
|---|---|
| `state`, `markDirty`, `setPath`, dirty flag (3-11, 87-113) | `renderer/state.ts` |
| `NAV_GROUPS`, `SECTION_LABELS`, `SECTION_DESCRIPTIONS`, `UNION_FIELDS`, section order (17-73) | `renderer/schema.ts` (single source; page mapping per CONTEXT D-01) |
| `buildNav`, `wireSearch`, `showTab` (249-300) | `renderer/nav.js` → `renderer/nav.ts` (adds Advanced group toggle + search across it) |
| `renderGenericObject`, `smallTextInput`, `humanize`, escape helpers (79-81, 341-408, 692-698) | `renderer/widgets/fieldRow.ts` |
| `renderKeyCapture`, `keyNameFor` (83-85, 878-925) | `renderer/widgets/keyCapture.ts` |
| `openAppPicker` (410-480) | `renderer/widgets/appPicker.ts` |
| dock renderers (116-198, 482-601, 603-690) | `renderer/pages/dockPage.ts` |
| keymap + overrides renderers (700-811) | `renderer/pages/shortcutsPage.ts` |
| generic-object section renderer → Behavior page body | `renderer/pages/behaviorPage.ts` |
| DOLPHIN/KONSOLE/CAVA → Advanced page body | `renderer/pages/advancedPage.ts` |
| Layout placeholder page | `renderer/pages/layoutPage.ts` (static, per D-02) |
| `wireTopbar`, `wireWindowControls`, `main()` (200-204, 929-964) | `renderer/main.ts` (entry) |

### 2. Build constraints (from project research, verified in code)

- `tsconfig.renderer.json`: `module: ES2022`, no bundler — tsc emits one `.js` per `.ts`; `index.html` imports `renderer.js` which must use relative `.js`-suffixed imports.
- `package.json` build copies only `index.html` + `renderer.css` — unchanged (all emitted `.js` come from tsc; only static non-TS assets need the `cp`).
- `types.ts` re-exports/global declarations (`Window.configApi`) stay; modules import types from `./types.js`.

### 3. Behavior-preservation risks

- `dockPreviewEl` is a module-level singleton set inside `renderDock` and re-used by `markDirty` → must become state-module-mediated (or a Dock-page-local re-render subscription) or the dock preview breaks.
- `renderList` closures capture `apps` arrays by reference — wholesale re-render pattern must be preserved per page (no deep-clone refactors).
- Section→panel visibility uses `panel-${name}` id classes in `showTab` — page switching replaces this; every section must remain reachable exactly once.
- Search currently toggles `.nav-item.hidden` — with Advanced collapsed, search must expand Advanced (or show its matches with an indicator) per D-03.

### 4. Testability additions (REL-04)

- Pure functions worth unit tests: `setPath`/state get-path, schema page-mapping completeness (every SectionName mapped to exactly one page), `humanize`, uniqueAppId. Test with `tsx --test` next to `main/*.test.ts` (e.g. `renderer/state.test.ts` run by the same npm script — extend script to `tsx --test main/*.test.ts renderer/*.test.ts`).

### 5. Out of scope (confirmed)

- No IPC/main-process changes, no visual redesign, no preview, no drag-and-drop.

## RESEARCH COMPLETE
