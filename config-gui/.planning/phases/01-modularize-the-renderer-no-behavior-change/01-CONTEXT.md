# Phase 1: Modularize the renderer (no behavior change) - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Split the 964-line `renderer/renderer.ts` into focused modules and reorganize the 17 flat config sections into 4 task-oriented pages plus a hidden Advanced page — with **zero behavior change**: every setting stays editable, the Save/Restart flow and dirty indicator work exactly as today, and `config.ts` writes remain format-preserving via the untouched `configEngine.ts`. The Layout page exists only as a placeholder in this phase (drag editing arrives in Phase 3; the preview arrives in Phase 2).

</domain>

<decisions>
## Implementation Decisions

### Page grouping (user-confirmed)

- **D-01:** The five pages are **Layout** (placeholder only), **Dock**, **Shortcuts**, **Behavior**, **Advanced**. Mapping of the 17 sections:
  - **Dock:** `DOCK`
  - **Shortcuts:** `DEFAULT_BROWSER_KEYS`, `BROWSER_KEY_OVERRIDES`, `DEFAULT_VSCODE_KEYS`, `VSCODE_KEY_OVERRIDES`, **`SCREENSHOT`** (it's a keyboard-combo setting — user confirmed it belongs with keys, not hardware)
  - **Behavior:** `DISPLAY`, `SLEEP`, `LAYER_TRANSITION`, `ACTIVE_WINDOW`, `SYSTEMBAR`, `ESC_KEY`, `FN_LAYER`, `FN_KEYS`
  - **Advanced (hidden by default):** `DOLPHIN`, `KONSOLE`, `CAVA` (user confirmed all three are niche) — plus the Advanced page must stay reachable (toggle/link in the sidebar)
- **D-02:** The **Layout page is created now as a placeholder** ("drag editing arrives in the next update") so the nav structure doesn't reshuffle in Phase 3.
- **D-03:** Cross-page **search stays in the sidebar** and must also surface fields hidden on the Advanced page (searching finds them and opens their page).

### Claude's Discretion

- **Visual layout:** keep the current dark aesthetic and sidebar pattern unless the modularization makes a top-tab/split layout clearly cleaner — no visual redesign is required in this phase.
- **Refactor depth:** Claude decides between a 1:1 code move and schema-driven page generation, guided by `research/ARCHITECTURE.md` (schema.ts idea) and PITFALLS #9/#11; either way the engine and IPC contract stay untouched.
- **Module structure:** file layout per `research/ARCHITECTURE.md` (state.ts, schema.ts, pages/, widgets/) with `.js`-extension imports per STACK research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning artifacts
- `.planning/PROJECT.md` — core value, out-of-scope (no framework, engine untouched)
- `.planning/REQUIREMENTS.md` — PAGE-01..04, REL-01, REL-04 are this phase's requirements
- `.planning/research/ARCHITECTURE.md` — target renderer module layout
- `.planning/research/STACK.md` — unbundled-tsc ES module rules (`.js` imports, asset copy list)
- `.planning/research/PITFALLS.md` — pitfalls 9–12 (module footguns, DnD, state lifecycle) apply directly
- `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/STRUCTURE.md` — current renderer structure and key locations

### Code (read before planning)
- `renderer/renderer.ts` — the code being split; every behavior must survive the move
- `main/configEngine.ts` — must NOT change in this phase
- `package.json` — build script's `cp` line needs updating for new renderer assets

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderDock` / `renderDockPreview` (`renderer/renderer.ts:129-198, 484-543`) — move as-is into the Dock page module; the preview canvas math gets reused by Phase 2's real-render preview.
- `renderKeyCapture` (`renderer/renderer.ts:878-925`), `openAppPicker` (`:415-480`), `smallTextInput` (`:692-698`) — self-extractable widgets for `widgets/`.
- `NAV_GROUPS`/`SECTION_LABELS`/`SECTION_DESCRIPTIONS`/`UNION_FIELDS` (`renderer/renderer.ts:17-73`) — the raw material for a single `schema.ts` (page, label, description, widget type per field).

### Established Patterns
- Whole-list re-render on structural change, in-place mutation otherwise — keep it; DnD in Phase 3 must not fight it.
- All state mutations via `setPath` + `markDirty`; save sends whole state and relies on engine-side deepEqual skip.
- IPC result objects (`{ok, error?}`) — no changes needed.

### Integration Points
- `main/preload.ts` / `renderer/types.ts` — IPC contract frozen in this phase.
- `configEngine.ts` — frozen; only its test suite proves nothing broke.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The one hard user signal: "make it simple" — pages must read as tasks (Layout / Dock / Shortcuts / Behavior), not as config section names.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Preview status chip and schema-shared-with-blueprint remain v2 items from REQUIREMENTS.md.)

</deferred>

---

*Phase: 1-Modularize the renderer (no behavior change)*
*Context gathered: 2026-09-28*
