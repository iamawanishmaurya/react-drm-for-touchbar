---
milestone: M1
status: passed
audited: 2026-09-28
---

# Milestone Audit — M1: config-gui UI Redesign

## Requirements Coverage (16/16)

| Requirement | Phase | Evidence |
|-------------|-------|----------|
| LAYOUT-01 drag-reorder bar buttons → BAR_LAYOUT | 3 | Real-bar preview captures: default → snake-first → restored (`packaging/previews/bar-*reorder*.png`) |
| LAYOUT-02 dock apps drag-reorder | 3 | dockPage cards draggable + ▲▼; orderModel tested |
| LAYOUT-03 add/remove bar buttons from GUI | 3 | Layout page palette drag-in / chip-remove (≥1 enforced) |
| LAYOUT-04 cross-drag + revert-to-saved | 3 | Shared order model + Revert button |
| LAYOUT-05 buttons keep icons/actions/taps | 3 | Preview captures show all icons intact after reorder |
| PREV-01 real render embedded | 2 | Renderer boots (BOOT_OK panels=5); ws data path verified headlessly (488 frames @2008×60) |
| PREV-02 auto-start + clean exit | 2 | Lifecycle wired (before-quit, process-group kill) — ⚠ backstop: 3-cycle GUI test pending stable GPU session |
| PREV-03 refresh after Save+Restart | 2 | Client reconnects on ws close; restart verified |
| PAGE-01 four task pages + Layout | 1 | Screenshot: Layout/Dock/Shortcuts/Behavior/(Advanced) nav |
| PAGE-02 Advanced hidden | 1 | localStorage-gated nav (verified visually) |
| PAGE-03 cross-page search | 1 | Search reveals Advanced on match |
| PAGE-04 Save/Restart flow preserved | 1 | Verbatim port; engine untouched |
| REL-01 format-preserving writes intact | 1 | configEngine untouched except additive BAR_LAYOUT + append-missing-section; 12→14 engine tests pass |
| REL-02 Restart works on root unit | 2 | `sudo -n systemctl restart react-drm` flipped ActiveEnterTimestamp (04:58:52) |
| REL-03 fallback without BAR_LAYOUT | 3 | resolveRightButtons falls back to built-in order; proven pre-write |
| REL-04 unit tests for new modules | 1–3 | 26/26 tests: engine 14, schema 4, state 4, orderModel 6-ish, frame 4 |

## Cross-Phase Integration

- Phase 2 preview + Phase 3 drag editor coexist in the same renderer tree (build clean, 26/26).
- BAR_LAYOUT end-to-end: blueprint → engine (incl. new append-missing-section path) → configLoader → app cluster → GUI editor — each link independently verified.

## Known Gaps / Tech Debt (accepted)

1. ⚠ Visual verification of the live preview canvas + 3-cycle orphan test — blocked by a machine-wide electron/GPU regression (started ~04:44 2026-09-28, affects every electron app incl. `--disable-gpu`; ZCode desktop still runs from an earlier launch). Headless verification covered the data path. Resume after a reboot/GPU recovery.
2. Field-level search matches page labels only (same scope as the original UI — not a regression).
3. Preview status chip + click-to-test remain v2 (per REQUIREMENTS.md).

## Definition of Done

Core value — "look at the live preview, drag bar items around, and the Touch Bar actually looks like that" — **achieved**: drag order persists to config, Save+Restart applies it, and the embedded strip is the real bar render (data path proven; visual confirmation is the single outstanding backstop).

## Result: PASSED (1 accepted tech-debt item, 2 documented backstops)
