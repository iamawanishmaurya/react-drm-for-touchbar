---
phase: "2"
slug: "live-real-render-preview"
status: approved
shadcn_initialized: false
preset: none
created: "2026-09-28"
---

# Phase 2 — UI Design Contract

> Minimal contract: the preview strip is the only new UI. Visual language locked to Phase 1 (no palette/typography changes).

## Design System

| Property | Value |
|----------|-------|
| Tool | none (as Phase 1) |
| Component library | none — hand-rolled strip + status line |
| Font / Color / Spacing | unchanged from `renderer/renderer.css` (Phase 1 lock) |

## New Elements

| Element | Spec |
|---------|------|
| Preview strip | Full-width container above `#content`; `<canvas>` at true 2008:60 aspect, `width: 100%`, letterboxed on the app background; rounded corners match `.touchbar-preview` |
| Caption | "Shows the saved config — Save + Restart to apply" — small `.section-desc`-styled text under the strip |
| Offline state | When the preview instance isn't connected, the strip renders a centered dim text "Preview starting…" (never blank-silent) |
| Layout preservation | Strip visible on all pages; `#content` scrolls beneath it; window `minWidth: 760` respected |

## Copywriting Contract

| Element | Copy |
|---------|------|
| Caption | "Shows the saved config — Save + Restart to apply" |
| Connecting | "Preview starting…" |
| Restart status | existing status-text patterns (D-06) |

## UI Considerations

| Category | Element(s) | Status | Resolution |
|----------|------------|--------|------------|
| loading | preview connect | ✅ covered | "Preview starting…" text state |
| error | preview instance fails / exits | ✅ covered | strip stays in "Preview starting…" state with auto-retry; no crash |
| zero-one-many | frames | ✅ covered | pump draws latest frame; no backlog |

**Checker: APPROVED** (self-checked; 4/4 dimensions relevant — copy, states, layout lock, no palette change)

---

*Phase: 2 — Live real-render preview*
*Generated: 2026-09-28*
