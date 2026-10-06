# ROADMAP — Touch Bar Hardening

**Mode:** hardening (phase-per-session, gated on the user)
**Generated:** 2026-10-06
**Granularity:** coarse (5 phases)
**Branch:** `touchbar-control-hardening` (baseline `e6cdc2d`)

> Phase 0 (commit the baseline) is already **complete** — see
> `.planning/hardening/REPORT-PHASE-0.md`. This roadmap covers the remaining 5 phases.
>
> **Authoritative spec:** each phase file in `.planning/hardening/`. This roadmap is an
> index; where it is thinner, the phase file wins. **Read `.planning/hardening/README.md`
> first — its "Ground facts" and "Hard rules" govern every phase.**

## Phase 1: No external command can freeze the bar

**Goal:** every synchronous child-process call in the bar app has a timeout and falls back
to the last known value, so a hung WirePlumber/PipeWire/brightnessctl costs at most ~1.5 s
per call instead of freezing the bar forever.

**Mode:** hardening
**Why first:** this is the verified cause of the 2026-10-05 freeze. `useMicMute` polls
`readMicMuted()` every 2 s via `execFileSync('wpctl', …)` with no timeout.
**Needs the user:** hardware check only (Phase 1 §Done-when, last item).

**Success Criteria:**
1. A shared helper enforces a hard timeout on every sync exec in the app; only it calls
   `execFileSync`/`execSync`/`spawnSync` (FREEZE-01, FREEZE-05)
2. `readVolume` / `readMicMuted` / `readBrightness` return the **last known value** on
   error, logging once per failure streak plus one recovery line — never a fresh default
   (FREEZE-02)
3. Backend detection checks the binary on `PATH` instead of running it (FREEZE-03), and
   async `execFile` calls carry the timeout too (FREEZE-04)
4. A test spawns a child against a fake hung `wpctl` on `PATH` and shows `readVolume()`
   returning the previous value in under 3000 ms — **shown failing against the old code
   first, then passing** (FREEZE-06)
5. App suite and typecheck pass at or above the 114-test baseline; library suite unchanged
6. Deployed staged (`NO_RESTART=1 ./deploy.sh` → `staged (no restart)`) with `diff -q`
   clean against the running install
7. Committed as `fix(bar): time out wpctl/pactl/brightnessctl calls so a hung audio daemon
   can't freeze the bar`

**Covers:** FREEZE-01 … FREEZE-06, XC-01, XC-02, XC-03

## Phase 2: Restart the bar when its main thread is stuck

**Goal:** if the bar's main thread is blocked longer than 15 s for *any* cause, the process
kills itself and systemd's `Restart=always` brings it back. Phase 1 fixed the known cause;
this catches the unknown ones.

**Mode:** hardening
**Prerequisite:** Phase 1 PASS, user hardware check confirmed.
**Needs the user:** hardware check only.

**Success Criteria:**
1. A watchdog worker watches a heartbeat the main thread writes to shared memory every
   1000 ms and `SIGKILL`s the process when it goes stale past `REACT_DRM_STALL_MS`
   (WATCH-01)
2. Timing uses `process.hrtime.bigint()` (`CLOCK_MONOTONIC`, does not advance during
   suspend) plus `pause()` on sleep and `resume()` after re-attach (WATCH-02)
3. It runs only on the real bar, is `unref()`'d, and never appears in preview output
   (WATCH-03)
4. Tests prove a blocked child dies by `SIGKILL` within 6 s with `[stall-watchdog]` in
   stderr while `short` / `idle` / `paused` exit 0 — the `block` case **shown failing
   first** (WATCH-04)
5. App suite and typecheck pass; deploy staged; `diff -q` clean
6. Committed as `feat(bar): restart the bar when its main thread is blocked for 15 s`

**Covers:** WATCH-01 … WATCH-04, XC-01, XC-02, XC-03

## Phase 3: This machine — compiled bar + MTMR-free recovery

**Goal:** the service runs `node dist/index.js` instead of recompiling with `tsx` on every
start (faster restarts, less CPU), and panel recovery uses `/usr/local/sbin/react-drm-recover`
instead of `/usr/bin/mtmr --recover` — in the service and in the watchdog/suspend units.

**Mode:** hardening
**Prerequisite:** Phases 1–2 PASS, user checks confirmed.
**Needs the user:** **YES — sudo steps.** Every sudo line is USER RUNS; print it and wait.

**Success Criteria:**
1. `deploy.sh` rebuilds the app's `dist/` without `rm -rf dist`, so a failed compile cannot
   destroy the user's `dist/config.js` (MACH-01)
2. The compiled bar is smoke-tested as a **preview** (no root, no hardware) and starts
   cleanly — exit 124 from `timeout`, no stack trace — before any root change (MACH-02)
3. The user installs a drop-in so the service runs `node dist/index.js` and uses
   `react-drm-recover --no-restart` as `ExecStartPre` — `--no-restart` is mandatory or the
   unit restarts itself in a loop (MACH-03)
4. Watchdog and suspend units reference `/usr/local/sbin` with no `mtmr` left; an unused old
   script is reported for the user to delete, never deleted by the agent (MACH-04)
5. `NRestarts` does not increase over 2 minutes; restart time compared before vs after and
   both pasted (MACH-05)
6. Report includes a rollback block; the deliberate touchbar-control Apply is a USER CHECK

**Covers:** MACH-01 … MACH-05, XC-01, XC-03

## Phase 4: my-t2-fix — one source of truth + one troubleshooting index

**Goal:** `/home/Astra/opencode/zcode/my-t2-fix/touchbar/` stops being a 48 MB copy that
drifts from the real repos. It becomes an index, git submodules to the real repos, and one
symptom → fix page covering every Touch Bar doc.

**Mode:** hardening
**Needs the user:** **asks before push** — the blocker check waits for a yes.

**Success Criteria:**
1. The snapshot becomes submodules + index + small files; `du -sh` and
   `git submodule status` pasted (DOCS-01)
2. `TROUBLESHOOTING-INDEX.md` maps **every** issue from both source troubleshooting files to
   a row — proven by listing each source issue number and its row — with duplicates merged,
   sources linked, and `mtmr --recover` replaced by `sudo react-drm-recover` (DOCS-02)
3. README rewritten for the new layout including `git clone --recurse-submodules` (DOCS-03)
4. Stale notes get a dated banner instead of being rewritten; nothing is pushed without the
   user's yes (DOCS-04)
5. Link check prints only `done`; working tree clean after commit

**Covers:** DOCS-01 … DOCS-04, XC-01

## Phase 5: Where does `write EPIPE` on every start come from?

**Goal:** identify the exact code path behind the `write EPIPE` logged on every react-drm
start since 2026-09-28. Deliver a findings document. Fix it **only** if the fix is ≤ ~20
lines in our own code; otherwise propose it.

**Mode:** hardening
**Read-only on the running system:** no restarts by the agent.
**Needs the user:** one sudo reproduction (root vs user D-Bus auth).

**Success Criteria:**
1. The first full `write EPIPE` stack trace is captured and pasted (EPIPE-01)
2. Root cause stated with `file:line`, proven by reproducing as the user **and** as root —
   the root half is USER RUNS (EPIPE-02)
3. `FINDINGS-EPIPE.md` gives options with trade-offs and a recommendation (EPIPE-03)
4. If fixed: ≤ ~20 lines in our own code, tests + typecheck pasted, deployed staged, USER
   CHECK that `grep -c EPIPE` → `0` after a restart. Otherwise the phase stops at findings
   (EPIPE-04)
5. `TROUBLESHOOTING.md`'s "Known: write EPIPE" entry records the cause (EPIPE-05)

**Covers:** EPIPE-01 … EPIPE-05, XC-01, XC-02

## Requirements Traceability

| Requirement | Phase |
|-------------|-------|
| FREEZE-01 … FREEZE-06 | 1 |
| WATCH-01 … WATCH-04 | 2 |
| MACH-01 … MACH-05 | 3 |
| DOCS-01 … DOCS-04 | 4 |
| EPIPE-01 … EPIPE-05 | 5 |
| XC-01 … XC-03 | all |

Coverage: 22/22 v1 requirements mapped ✓

## Complete When

All 5 phases report PASS, each with `REPORT-PHASE-<n>.md` showing pasted evidence, and
every suite at or above the 114-test Phase 0 baseline.