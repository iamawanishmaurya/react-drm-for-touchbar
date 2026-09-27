# Touch Bar Config GUI — UI Redesign

## What This Is

A ground-up redesign of the config-gui Electron app (`config-gui/` in the react-drm-for-touchbar fork) — the desktop editor for the Touch Bar's `config.ts`. The current UI is form-driven, monolithic (one ~964-line renderer.ts), shows no preview of the bar, and has no drag-and-drop. The redesign makes it **simple and visual**: a live preview of the *real* Touch Bar UI, drag-and-drop layout editing, and reorganized pages with advanced fields hidden.

## Context

- Part of the react-drm-for-touchbar fork (`react-drm-fork/`), the primary working folder for all Touch Bar work on this MacBookPro16,2 (T2, Arch + niri).
- The running Touch Bar UI is the react-drm app (React + Cairo + DRM); its config lives at `linux-touchbar-control-center/config.ts`, seeded from `config.blueprint.ts`. config-gui reads/writes it via ts-morph (`main/configEngine.ts`), preserving comments/formatting — **that engine is well-tested (12/12 node:test) and stays as the backend**.
- The Touch Bar app also runs in a headless **preview mode** (`REACT_DRM_BACKEND=preview`), which serves the real rendered frame over a websocket and accepts synthetic touch events — proven tooling exists (`packaging/preview-capture.mjs`).
- Dependencies are installed only in the deployed tree (`/home/Astra/opencode/react-drm/`); builds/tests run there. Deploy of the app itself is via `./deploy.sh` (fork → deployed → service restart).
- Known deployment mismatch: the GUI's Restart button uses `systemctl --user restart react-drm.service`, but this machine runs a root system unit — to be fixed as part of this project.

## Core Value

**A user can look at the GUI's live preview and drag bar items around — and the Touch Bar actually looks like that.** Simplicity: everything common is one click away; everything rare is hidden.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Simplified, reorganized UI (few pages instead of 17 sections; advanced fields hidden behind an "Advanced" disclosure)
- [ ] Live real-render preview: embed the actual Touch Bar render (preview instance) in the GUI
- [ ] Drag-and-drop reordering of dock apps (preview + list), persisted to `config.ts`
- [ ] Main-bar button layout made configurable end-to-end (new config section + app reads it) with drag-and-drop editing in the GUI
- [ ] Renderer modularized: state / sections / preview / drag-and-drop separated (still vanilla TS, no framework)
- [ ] Restart button works on this deployment (system unit, root)

### Out of Scope

- Rewriting the Touch Bar app itself beyond reading the new layout section — no visual redesign of the bar UI
- Adding new config capabilities beyond bar layout (no new widgets/panels)
- A framework migration (React/Preact) — deliberately rejected in favor of modularized vanilla
- Touch Bar on-screen preview inside the GUI via synthetic taps (edit-by-tap) — preview is view + drag only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Real bar render for preview (not CSS mock) | Pixel-accurate, shows exactly what the hardware shows; preview tooling already proven | — Pending |
| Vanilla TS, modularized (no framework) | Smallest risk; keeps tested engine; avoids build tooling sprawl | — Pending |
| Bar layout becomes a config section | Button order is currently hardcoded in `app/splitted/layout.tsx`; GUI drag must persist somewhere | — Pending |
| Engine stays untouched except new section support | 12 passing tests, format-preserving writes are the app's crown jewels | — Pending |
| Reorganize pages + hide advanced fields | User asked "make it simple"; 17 flat sections → a few task-oriented pages | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-28 after initialization*
