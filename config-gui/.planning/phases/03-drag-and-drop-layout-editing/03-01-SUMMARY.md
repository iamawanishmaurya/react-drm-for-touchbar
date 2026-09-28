---
phase: 03-drag-and-drop-layout-editing
plan: "01"
completed: 2026-09-28
---

# Plan 03-01 Summary — Drag-and-drop layout editing

## What Was Built

- **BAR_LAYOUT end-to-end**: blueprint section (`rightButtons` default = today's order), configLoader export, engine SECTION_NAMES + **append-missing-section support** (writeConfig previously silently skipped sections absent from the user's config.ts — BAR_LAYOUT could never persist; now it appends `export const NAME = <value>;`), app reader in `app/splitted/layout.tsx` (`resolveRightButtons()`: id→BASE_BTNS resolution, unknown ids dropped, missing ids appended, empty/missing → built-in order).
- **App cluster rendering made order-driven**: the JSX previously hardcoded `btnByKey('back')`… — replaced with a map over the resolved list (back keeps width 40 + leftRound; playpause collapses with mediaExpanded; customlayer stays rightmost; separators between; first/last get left/rightRound).
- **GUI Layout page**: real drag editor replacing the placeholder — bar mockup chips (HTML5 DnD), palette add/remove, cross-drag, Revert-to-saved, ▲▼/× keyboard+click fallback per chip; `renderer/dnd/orderModel.ts` (pure, tested); dock app cards drag-reorderable with ▲▼.
- **Tooling**: preview-capture.mjs now honors PREVIEW_PORT env.

## Key bug found during verification
- Engine silently skipped writing BAR_LAYOUT (section not declared in user config.ts) — fixed by the append support above; caught because the real-bar capture didn't change.

## Verification (real bar, via preview captures)

| Capture | Order shown |
|---------|------------|
| `previews/bar-before-reorder.png` | back, volume, brightness, linux, playpause, screenshot, snake (default) |
| `previews/bar-after-reorder2.png` | **snake first** — matches written BAR_LAYOUT |
| `previews/bar-order-restored.png` | default order restored after revert |

All icons/actions intact through reorder+revert (LAYOUT-05). REL-03 proven (old config ran unchanged pre-write). Tests: 26/26 (engine BAR_LAYOUT round-trip + sections-untouched, orderModel, schema palette coverage). Build: 0 TS errors.
