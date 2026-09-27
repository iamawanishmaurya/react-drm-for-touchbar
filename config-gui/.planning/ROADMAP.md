# ROADMAP — config-gui UI Redesign

**Mode:** mvp (per-phase)
**Generated:** 2026-09-28
**Granularity:** coarse (3 phases)

## Phase 1: Modularize the renderer (no behavior change)

**Goal:** Split the 964-line renderer into focused modules and reorganize the UI into 4 task pages + hidden Advanced, keeping every existing feature working exactly as before.
**Mode:** mvp
**Success Criteria**:
1. `renderer/renderer.ts` is replaced by small modules (state, schema, pages/, widgets/) — no file over ~300 lines; app builds and runs via `npm run dev` in the deployed tree
2. All current settings are editable: dock apps, keymaps, overrides, FN keys, generic sections — verified against today's behavior
3. Save + Restart flow and dirty indicator work unchanged; `config.ts` writes stay format-preserving (existing 12 engine tests pass untouched)
4. New pure modules (state path get/set, schema) have node:test coverage (`REL-04` partial)
5. The GUI still looks like a normal app (no blank window from module-import footguns — verified by launching it)

**Covers:** PAGE-01, PAGE-02, PAGE-03, PAGE-04, REL-01, REL-04 (partial)

## Phase 2: Live real-render preview

**Goal:** Embed the actual Touch Bar render (preview instance → websocket → canvas) in the GUI, auto-started with the app, refreshing after restart — and fix the Restart button for this deployment.
**Mode:** mvp
**Success Criteria**:
1. The GUI shows the live bar render at the correct 2008:60 aspect ratio, scaling with the window (PREV-01)
2. Preview instance lifecycle is owned by the main process: starts with the GUI, killed on quit, no orphaned processes after 3 open/close cycles (PREV-02)
3. After Save + Restart, the preview shows the new UI within one boot cycle (~10–20s splash then live) (PREV-03)
4. Restart button successfully restarts the bar on this root-unit deployment (REL-02) — verified by watching `systemctl is-active react-drm` flip
5. Frame parsing (header + BGRA→RGBA) is a pure tested module (REL-04)

**Covers:** PREV-01, PREV-02, PREV-03, REL-02, REL-04 (partial)

## Phase 3: Drag-and-drop layout editing (BAR_LAYOUT end-to-end)

**Goal:** Make the main-bar button layout configurable end-to-end and editable by drag-and-drop, plus dock app drag-reorder — verified on the real Touch Bar.
**Mode:** mvp
**Success Criteria**:
1. `BAR_LAYOUT` exists in `config.blueprint.ts`, round-trips through the engine (new engine tests pass), and the app builds its button bar from it with fallback to today's order when absent (LAYOUT-01, REL-03)
2. User can drag-reorder bar buttons in the GUI mockup and dock apps in preview/list; changes save to `config.ts` and the real bar reflects the new order after restart (LAYOUT-01, LAYOUT-02, LAYOUT-05)
3. User can add/remove bar buttons from the GUI; removed buttons disappear from the real bar (LAYOUT-03)
4. Cross-drag between mockup and list works, and revert-to-saved restores the last saved order (LAYOUT-04)
5. End-to-end verified on the hardware: reorder → save → restart → bar shows new order and all taps work

**Covers:** LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05, REL-03, REL-04 (partial)

## Requirements Traceability

| Requirement | Phase |
|-------------|-------|
| LAYOUT-01 | 3 |
| LAYOUT-02 | 3 |
| LAYOUT-03 | 3 |
| LAYOUT-04 | 3 |
| LAYOUT-05 | 3 |
| PREV-01 | 2 |
| PREV-02 | 2 |
| PREV-03 | 2 |
| PAGE-01 | 1 |
| PAGE-02 | 1 |
| PAGE-03 | 1 |
| PAGE-04 | 1 |
| REL-01 | 1 |
| REL-02 | 2 |
| REL-03 | 3 |
| REL-04 | 1, 2, 3 |

Coverage: 16/16 v1 requirements mapped ✓
