---
gsd_state_version: "1.0"
status: in_progress
stopped_at: Phase 1 done (pending user hardware check), Phase 2 ready
last_updated: "2026-10-06T20:30:00.000Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 20
---

# STATE — Touch Bar Hardening

**Project:** Touch Bar Bar (react-drm-fork)
**Milestone:** M1 — Hardening (5 phases)
**Initialized:** 2026-10-06
**Branch:** `touchbar-control-hardening` (baseline commit `e6cdc2d`)
**Mode:** hardening | **Granularity:** coarse | **Gated on the user** — Phases 3 and 4 need explicit user steps

## Current Position

- **Next phase: Phase 2 — stall watchdog** (Phase 1 done, pending the user's hardware check)
- Spec: `.planning/hardening/PHASE-2-stall-watchdog.md`
- Phase 0 complete (baseline committed, 114 tests green)
- Phase 1 complete as of commit `876a171`: every `wpctl` / `pactl` / `brightnessctl`
  call now goes through `lib/services/execQuick.ts` (1500 ms + SIGKILL) and falls back
  to the last known value. Library **3 passing**, app **54 passing**. The staged deploy
  reached `/home/Astra/opencode/react-drm`; **nothing restarts until the user restarts
  the service**, so the USER CHECK in the report is still PENDING.

## Phase Completion Log

| Phase | Completed | Notes |
|-------|-----------|-------|
| 0 (baseline) | 2026-10-06 | Not a roadmap phase. 104 entries committed as `e6cdc2d` on `touchbar-control-hardening`. Baseline **114 tests green** (library 3 · app 45 · touchbar-control 38 · config-gui 28). Report: `.planning/hardening/REPORT-PHASE-0.md` |
| 1 (exec timeouts) | 2026-10-06 | `execQuick.ts` added (1500 ms SIGKILL timeout, `commandExists` PATH check); `volume.ts` / `mic.ts` / `brightness.ts` converted; 9 new tests. Library **3 passing**, app **54 passing**, both typechecks exit 0. Commit `876a171`. Staged into the running install, **not restarted**. Report: `.planning/hardening/REPORT-PHASE-1.md` |

## Blockers

**PENDING — user check for Phase 1.** The fix is staged in the running install but the bar
is still running the old code until the user runs `sudo systemctl restart react-drm` and
completes the 4-step hardware check in `.planning/hardening/REPORT-PHASE-1.md`. The agent
must not run sudo or restart the bar. Phase 2 can start in parallel (different files), but
Phase 1 should not be called passed until the user confirms.

Phase 3 needs sudo steps printed for the user; Phase 4 asks before push; Phase 5 needs one
root D-Bus reproduction.

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