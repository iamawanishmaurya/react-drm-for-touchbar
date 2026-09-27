# STATE — config-gui UI Redesign

**Project:** config-gui UI redesign (Touch Bar Config GUI)
**Initialized:** 2026-09-28
**Mode:** mvp | **Granularity:** coarse | **Workflow:** yolo, parallel plans, research+plan_check+verifier on, models inherit

## Current Position

- **Milestone:** M1 (first)
- **Phase:** 1 — Modularize the renderer (no behavior change)
- **Phase status:** not started
- **Next action:** `/gsd-plan-phase 1`

## Artifacts

| Artifact | Location |
|----------|----------|
| Project context | `.planning/PROJECT.md` |
| Requirements | `.planning/REQUIREMENTS.md` (16 v1 reqs) |
| Roadmap | `.planning/ROADMAP.md` (3 phases) |
| Research | `.planning/research/` (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY) |
| Codebase map | `.planning/codebase/` (7 docs, stamped 0f24603) |
| Config | `.planning/config.json` |

## Phase Completion Log

| Phase | Completed | Notes |
|-------|-----------|-------|
| — | — | — |

## Environment Notes (from research)

- Build/test only in the deployed tree `/home/Astra/opencode/react-drm/config-gui` (deps hoisted); edit in the fork `react-drm-fork/config-gui` and copy over — config-gui is NOT covered by `deploy.sh`.
- The react-drm service is a root system unit; passwordless sudo works (sandbox bypass needed in ZCode sessions).
- Preview instance needs the service's env (nvm node, DBUS_SESSION_BUS_ADDRESS, XDG_RUNTIME_DIR) and the deployed tree's cwd.
