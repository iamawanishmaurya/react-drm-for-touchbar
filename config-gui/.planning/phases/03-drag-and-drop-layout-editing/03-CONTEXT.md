# Phase 3: Drag-and-drop layout editing - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the main-bar button layout configurable end-to-end (new BAR_LAYOUT section: blueprint → engine → app-side reader with fallback → GUI) and add drag-and-drop reordering in the GUI for bar buttons and dock apps — verified on the real Touch Bar.

</domain>

<decisions>
## Implementation Decisions

### Prior decisions carried forward (user-confirmed at project init)

- **D-01 (project init):** Bar layout becomes a config section — the user explicitly chose "Make it configurable (Recommended)".
- **D-02 (project init):** Drag-and-drop covers dock apps AND bar layout ("Dock + bar layout" chosen); cross-drag + revert-to-saved selected in requirements scoping (LAYOUT-03/04).

### Claude's Discretion (grey areas below decided by Claude per autonomous mode)

- **BAR_LAYOUT shape:** `export const BAR_LAYOUT = { rightButtons: ['back','volume','brightness','linux','playpause','screenshot','snake'], }` — an ordered string-array of button ids (ids = the existing `BASE_BTNS` keys in `app/splitted/layout.tsx`). String arrays round-trip losslessly through configEngine (`nodeToValue`/`valueToLiteralText`); PITFALLS #3 warns against anything richer. App-side: `app/splitted/layout.tsx` resolves each id against the existing BASE_BTNS table (icons/actions unchanged), filters unknown ids, falls back to today's order when the section is missing or empty (REL-03).
- **Add/remove buttons (LAYOUT-03):** the GUI's Layout page shows the full palette of known buttons (from the same BASE_BTNS table mirrored in config-gui via a static list passed through `config:meta`-style IPC — simpler: duplicated static list in renderer with a schema test asserting it matches blueprint defaults); dragging from palette onto the bar adds, dragging off removes.
- **Drag-and-drop tech (LAYOUT-01/02):** native HTML5 DnD (no library, per research STACK); keyboard up/down buttons as accessible fallback on every item (PITFALLS #12).
- **Order model:** one pure module (`renderer/dnd/orderModel.ts`): move(list, from, to), insert, remove — unit-tested (REL-04); DnD and keyboard fallback both mutate through it; revert-to-saved keeps the last-loaded snapshot.
- **Cross-drag (LAYOUT-04):** the bar mockup chips and the editor list rows share the same order model; chips are draggable and list rows are drop targets and vice versa; "Revert" button restores the saved snapshot.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/REQUIREMENTS.md` — LAYOUT-01..05, REL-03, REL-04
- `.planning/research/ARCHITECTURE.md` — BAR_LAYOUT end-to-end section
- `.planning/research/PITFALLS.md` — pitfalls 1–4 (config writes, array taint, app fallback), 10–12 (DnD)
- `linux-touchbar-control-center/app/splitted/layout.tsx` — BASE_BTNS table + button actions being made config-driven
- `linux-touchbar-control-center/config.blueprint.ts` — where BAR_LAYOUT default goes
- `main/configEngine.ts` — SECTION_NAMES + string-array round-trip
- `renderer/schema.ts` + `renderer/pages/layoutPage.ts` — where the drag editor lands (placeholder replaced)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1's `renderer/pages/layoutPage.ts` placeholder — replaced by the drag editor.
- `renderer/state.ts` setPath/markDirty — order edits flow through it like any field.
- `schema.test.ts` pattern for new coverage.

### Established Patterns
- Whole-list re-render on structural change — DnD reorder calls the same renderList pattern.
- Engine skips unchanged fields on save (deepEqual) — reorder only writes when order truly changed.

### Integration Points
- `config.blueprint.ts` BAR_LAYOUT default; app `configLoader`/`layout.tsx` reader; `SECTION_NAMES` addition; Layout page editor; Save+Restart applies to the real bar.

</code_context>

<specifics>
## Specific Ideas

User's original ask: "drag and drop to change direction and other" — reorder is the core; the bar is horizontal so "direction" = left-right order.

</specifics>

<deferred>
## Deferred Ideas

- Resizing/splitting the bar's left content area vs button cluster (not just ordering)
- Drag-reorder of dock apps directly on the real bar (touch-driven) — GUI-only for now

</deferred>

---

*Phase: 3-Drag-and-drop layout editing*
*Context gathered: 2026-09-28*
