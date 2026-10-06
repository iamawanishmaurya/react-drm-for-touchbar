---
gsd_state_version: "1.0"
status: in_progress
stopped_at: Phases 1-5 repo work done; 3 user gates outstanding
last_updated: "2026-10-07T01:15:00.000Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 2
  completed_plans: 2
  percent: 60
---

# STATE — Touch Bar Hardening

**Project:** Touch Bar Bar (react-drm-fork)
**Milestone:** M1 — Hardening (5 phases)
**Initialized:** 2026-10-06
**Branch:** `touchbar-control-hardening` (baseline commit `e6cdc2d`)
**Mode:** hardening | **Granularity:** coarse | **Gated on the user** — Phases 3 and 4 need explicit user steps

## Current Position

- **Next phase: Phase 3 — machine switch** (Phases 1 and 2 done, both pending the user's
  hardware check)
- Spec: `.planning/hardening/PHASE-3-machine-switch.md`
- Phase 0 complete (baseline committed, 114 tests green)
- Phase 1 complete as of commit `876a171`: every `wpctl` / `pactl` / `brightnessctl`
  call now goes through `lib/services/execQuick.ts` (1500 ms + SIGKILL) and falls back
  to the last known value. Library **3 passing**, app **54 passing**. The staged deploy
  reached `/home/Astra/opencode/react-drm`; **nothing restarts until the user restarts
  the service**, so the USER CHECK in the report is still PENDING.
- Phase 2 complete as of commit `8124578`: `lib/services/stallWatchdog.ts` watches a
  `hrtime` heartbeat from a worker thread and `SIGKILL`s the bar when it goes stale past
  `REACT_DRM_STALL_MS` (default 15000), which systemd's `Restart=always` turns into a
  restart. Wired into `index.tsx` after `renderHot`, with `pause()` in `onSleep` and
  `resume()` in `onResume`. Library **3 passing**, app **58 passing**. Staged into the
  running install, **not restarted**. Report: `.planning/hardening/REPORT-PHASE-2.md`

## Phase Completion Log

| Phase | Completed | Notes |
|-------|-----------|-------|
| 0 (baseline) | 2026-10-06 | Not a roadmap phase. 104 entries committed as `e6cdc2d` on `touchbar-control-hardening`. Baseline **114 tests green** (library 3 · app 45 · touchbar-control 38 · config-gui 28). Report: `.planning/hardening/REPORT-PHASE-0.md` |
| 1 (exec timeouts) | 2026-10-06 | `execQuick.ts` added (1500 ms SIGKILL timeout, `commandExists` PATH check); `volume.ts` / `mic.ts` / `brightness.ts` converted; 9 new tests. Library **3 passing**, app **54 passing**, both typechecks exit 0. Commit `876a171`. Staged into the running install, **not restarted**. Report: `.planning/hardening/REPORT-PHASE-1.md` |
| 2 (stall watchdog) | 2026-10-07 | `stallWatchdog.ts` added (worker thread + `SharedArrayBuffer` `hrtime` heartbeat, SIGKILL on stale, both handles `unref`'d); wired into `index.tsx` with pause/resume around sleep; 4 new tests incl. a child that blocks its own main thread. Library **3 passing**, app **58 passing**, both typechecks exit 0. Commit `8124578`. Staged into the running install, **not restarted**. Report: `.planning/hardening/REPORT-PHASE-2.md` |

## Phase Completion Log (continued)

| Phase | Status | Notes |
|-------|--------|-------|
| 2 (stall watchdog) | 2026-10-06 | `stallWatchdog.ts` + wiring in `index.tsx`; app **58 passing**. Commit `8124578`. Report: `REPORT-PHASE-2.md` |
| 3 (compiled bar) | **BLOCKED** | Steps A+B done (`412b2a0`): `deploy.sh` rebuilds the app dist; compiled bar preview exits 124 cleanly. Step C is sudo — user runs it. Report: `REPORT-PHASE-3.md` |
| 4 (my-t2-fix) | **BLOCKED** | Blocker check: the fork branch is **not pushed**, so submodules cannot resolve. Index (F1–F24, M1–M19 verified) + banner committed in `my-t2-fix` as `77fa00e`; nothing pushed. Report: `REPORT-PHASE-4.md` |
| 5 (EPIPE) | 2026-10-06 | Cause found: unguarded lazy D-Bus sockets surface handshake failure as `uncaughtException`. `openBus()` helper across all 13 sites; app **61 passing**. Commit `18d05b6`. Report: `REPORT-PHASE-5.md`, `FINDINGS-EPIPE.md` |

## Blockers

**PENDING — user check for Phase 2** (retires Phase 1's too, since neither has run yet).
Both fixes are staged in the running install, but the bar is still running the old code
until the user runs `sudo systemctl restart react-drm` and completes the hardware check in
`.planning/hardening/REPORT-PHASE-2.md` (one `stall watchdog: 15000 ms` start line, a
suspend/resume cycle, and zero `[stall-watchdog] main thread blocked` lines). The agent
must not run sudo or restart the bar.

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

**Last session:** 2026-10-07
**Stopped at:** Phase 2 complete (commit `8124578`), waiting on the user's hardware check
**Resume file:** `.planning/hardening/PHASE-3-machine-switch.md`