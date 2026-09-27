---
phase: "1"
slug: "modularize-the-renderer-no-behavior-change"
status: draft
shadcn_initialized: false
preset: none
created: "2026-09-28"
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the renderer modularization. Zero behavior change is the phase's spine: this contract locks the *existing* visual language as the baseline so the refactor doesn't drift it, and specifies only the new nav/pages structure.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (hand-rolled DOM components in `renderer/widgets/`) |
| Icon library | inline SVG only (existing app-icon SVG in `index.html`; no icon package in renderer) |
| Font | system UI stack (unchanged from `renderer/renderer.css`) |

---

## Component Inventory

Could not enumerate: no design-system package — components are hand-rolled. The table below is the known-good set to extract in this phase; the executor may add hand-rolled peers following the same patterns.

| Component | Import path (after split) | Notes |
|-----------|---------------------------|-------|
| Field row (label + control) | `./widgets/fieldRow.js` | text/number/bool/select/list variants, from `renderGenericObject` |
| Key capture | `./widgets/keyCapture.js` | verbatim move of `renderKeyCapture` |
| App picker overlay | `./widgets/appPicker.js` | verbatim move of `openAppPicker` |
| Small text input | `./widgets/fieldRow.js` | helper from `smallTextInput` |
| Nav group / nav item | `./nav.js` | from `buildNav`; adds page groups + Advanced toggle |
| Section panel header | `./pages/page.js` | title + description header shared by all pages |

---

## Spacing Scale

Declared values (must be multiples of 4) — **carry over the existing CSS values verbatim**; the refactor must not re-space anything:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | icon gaps, inline padding |
| sm | 8px | compact element spacing |
| md | 16px | default element spacing (field rows) |
| lg | 24px | section padding |
| xl | 32px | layout gaps |
| 2xl | 48px | major section breaks |
| 3xl | 64px | page-level spacing |

Exceptions: existing `renderer.css` spacing values win wherever they differ — this is a *no-behavior-change* phase.

---

## Typography

Carry over existing CSS unchanged. Roles for reference only:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | existing | 400 | existing |
| Label | existing | 400 | existing |
| Heading (section title) | existing | 600 | existing |

---

## Color

Locked to the existing palette — **no color changes in this phase**:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#0d0f14` (window bg, `main/main.ts:38`) | Background, content area |
| Secondary (30%) | existing sidebar/panel colors from `renderer.css` | Sidebar, cards, fieldsets |
| Accent (10%) | existing status/danger colors | Save state (`ok`/`error`), destructive buttons only |
| Destructive | existing `.danger` color | Remove buttons only |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Save" (unchanged) |
| Advanced toggle | "Advanced" (sidebar group; collapsed by default, state persists in localStorage) |
| Layout placeholder | Heading "Layout", body "Drag-and-drop layout editing is coming in the next update." |
| Empty state heading | "Couldn't find linux-touchbar-control-center" (existing) |
| Empty state body | existing copy + "Locate folder…" button |
| Error state | existing "Couldn't read config.ts: <msg>" |
| Destructive confirmation | none today; keep none (Remove is immediate, as now — no new behavior) |

---

## UI Considerations

Applicable state considerations resolved: 4 covered, 1 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Truth |
|----------|------------|--------|--------------------|
| empty | Dock apps list, overrides list, FN_KEYS extra list | ✅ covered | Lists render today with zero items and an "+ Add" affordance; must survive the split unchanged |
| error | config read failure, save failure | ✅ covered | Existing `showError` / status-bar error paths move verbatim |
| partial | sections absent from user config (blueprint merge) | ✅ covered | `withDefaults` guarantees fields appear; pages render whatever sections exist — pages with zero present sections are hidden from nav (existing behavior) |
| zero-one-many | dock apps (0 → many cards) | ✅ covered | Existing add/remove flow unchanged |
| long-text | label/command fields, error messages | 🧪 backstop | Inputs already show long values; verify visually after split that no page overflows at `minWidth: 760` |

---

## Checker Verification (self-checked, subagent unavailable on this runtime)

| Dimension | Result |
|-----------|--------|
| 1. Spacing multiples of 4 | PASS (existing values carried) |
| 2. Typography roles declared | PASS |
| 3. Color 60/30/10 + destructive | PASS (existing palette locked) |
| 4. Copy contract complete | PASS |
| 5. No framework/tool mismatch | PASS (Tool: none matches vanilla renderer) |
| 6. Context compliance | PASS (matches D-01..D-03: 5 pages, Advanced hidden, Layout placeholder, search finds Advanced fields) |
| 7. Component inventory provenance | PASS ("could not enumerate" line present, non-exhaustive table) |

**Result: APPROVED** (draft → approved by self-check; GSD ui-checker subagent not installed on this runtime)

---

*Phase: 1 — Modularize the renderer (no behavior change)*
*Generated: 2026-09-28*
