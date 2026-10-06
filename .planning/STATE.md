---
gsd_state_version: "1.0"
status: in_progress
stopped_at: Milestone created; Phase 1 not yet started
last_updated: "2026-10-06T18:50:00.000Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# STATE — Touch Bar Hardening

**Project:** Touch Bar Bar (react-drm-fork)
**Milestone:** M1 — Hardening (5 phases)
**Initialized:** 2026-10-06
**Branch:** `touchbar-control-hardening` (baseline commit `e6cdc2d`)
**Mode:** hardening | **Granularity:** coarse | **Gated on the user** — Phases 3 and 4 need explicit user steps

## Current Position

- **Next phase: Phase 1 — No external command can freeze the bar**
- Spec: `.planning/hardening/PHASE-1-exec-timeouts.md`
- Phase 0 complete (baseline committed, 114 tests green)

## Phase Completion Log

| Phase | Completed | Notes |
|-------|-----------|-------|
| 0 (baseline) | 2026-10-06 | Not a roadmap phase. 104 entries committed as `e6cdc2d` on `touchbar-control-hardening`. Baseline **114 tests green** (library 3 · app 45 · touchbar-control 38 · config-gui 28). Report: `.planning/hardening/REPORT-PHASE-0.md` |

## Blockers

None. Phases 1–2 need the user only for a hardware check; Phase 3 needs sudo steps printed
for the user; Phase 4 asks before push; Phase 5 needs one root D-Bus reproduction.

## Environment Notes

- **Library tests: `npx tsx --test tests/*.test.ts` at the repo root. `npm test` does NOT
  exist there** (no `test` script in `package.json`) — the README ground-fact table is wrong
  on this point.
- **Run `npx tsc` at the repo root before any app test run.** `node_modules/react-drm` is a
  symlink to the repo root, so `react-drm/dist/src/index.js` only exists after a build.
  Without it the app suite reports 2 bogus module-resolution failures
  (`tests/lockNavigation.test.ts`, `tests/systemLock.test.ts`).
- `NO_RESTART=1 ./deploy.sh` stages without restarting. `sudo systemctl restart react-drm`
  is the user's job — sudo is not passwordless.
- Node: `/home/Astra/.nvm/versions/node/v26.10.0/bin`.
- The install at `/home/Astra/opencode/react-drm` is reached via the symlink
  `/home/Astra/opencode/react-drm`; never edit it by hand.

## Hard Rules (from `.planning/hardening/README.md` — read before each phase)

Never `sudo` · never push · never commit to `master` · never press Apply in
touchbar-control · edit only in `react-drm-fork/` (Phase 4: `my-t2-fix/`) · never edit or
delete an existing test to make it pass · never widen scope.

## Artifacts

| Artifact | Location |
|----------|----------|
| Project context | `.planning/PROJECT.md` |
| Requirements | `.planning/REQUIREMENTS.md` (22 v1 requirements) |
| Roadmap | `.planning/ROADMAP.md` (5 phases) |
| Authoritative plan | `.planning/hardening/README.md` + `PHASE-<n>-*.md` |
| Phase reports | `.planning/hardening/REPORT-PHASE-<n>.md` |

## Session

**Last session:** 2026-10-06
**Stopped at:** Milestone created from the hardening plan
**Resume file:** `.planning/hardening/PHASE-1-exec-timeouts.md`