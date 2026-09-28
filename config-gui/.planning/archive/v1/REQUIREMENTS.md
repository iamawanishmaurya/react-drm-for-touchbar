# v1 Requirements — config-gui UI Redesign

## v1 Requirements

### Layout Editing
- [ ] **LAYOUT-01**: User can drag main-bar buttons within a bar mockup to reorder them; the order persists to the new `BAR_LAYOUT` config section and survives a service restart
- [ ] **LAYOUT-02**: User can drag dock apps to reorder them in both the dock preview strip and the dock app list
- [ ] **LAYOUT-03**: User can add and remove main-bar buttons from the GUI (from the set of known buttons with their icons/actions)
- [ ] **LAYOUT-04**: User can drag items between the bar mockup and the editor list, and can revert to the last-saved order with one click
- [ ] **LAYOUT-05**: Bar buttons remain usable on the real Touch Bar after reordering (each button keeps its icon, action, and tap region)

### Live Preview
- [ ] **PREV-01**: User sees the real Touch Bar render embedded in the GUI, at the correct 2008:60 aspect ratio, scaling with the window
- [ ] **PREV-02**: The preview instance starts automatically when the GUI opens and is terminated cleanly when it closes (no leaked processes)
- [ ] **PREV-03**: The preview refreshes to reflect the new UI after Save + Restart (including the boot-splash period)

### Simplified Pages
- [ ] **PAGE-01**: User can edit the bar from 4 task-oriented pages (Layout, Dock, Shortcuts, Behavior) instead of 17 config sections
- [ ] **PAGE-02**: Rarely-used sections/fields are hidden behind an "Advanced" page and not shown by default
- [ ] **PAGE-03**: User can search fields across all pages from the sidebar
- [ ] **PAGE-04**: Save + Restart flow (dirty indicator, save, restart) works as today

### Reliability
- [ ] **REL-01**: All existing configEngine unit tests keep passing; format-preserving writes are unchanged
- [ ] **REL-02**: The Restart button works on this deployment (root system unit) as well as upstream `--user` setups
- [ ] **REL-03**: An old `config.ts` without `BAR_LAYOUT` falls back to the current hardcoded button order (backward compatible)
- [ ] **REL-04**: New pure modules (dnd order model, frame conversion, layout serialization) have node:test coverage

## v2 Requirements (deferred)

- [ ] Preview status chip (starting/live/offline) with manual preview restart
- [ ] Schema-driven field descriptions shared with the blueprint (kills label/union drift)
- [ ] Click-to-test in the preview (synthetic taps forwarded to the bar)
- [ ] Undo history beyond revert-to-saved

## Out of Scope

- Touch Bar visual redesign beyond config-driven ordering — the bar's look stays as-is
- Framework migration (React/Preact) — renderer stays vanilla, modularized
- Editing anything outside config.ts (no widget creation, no new panels)
- Multiple simultaneous GUI instances driving one preview

## Traceability

(Filled by roadmap)

---
*2026-09-28 — defined from research with user scoping*
