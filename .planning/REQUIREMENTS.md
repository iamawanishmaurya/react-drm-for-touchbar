# Requirements: Touch Bar Bar (react-drm-fork) — Hardening

**Defined:** 2026-10-06
**Core Value:** The bar never freezes.
**Baseline:** Phase 0 PASS — commit `e6cdc2d`, 114 tests green (library 3 · app 45 · touchbar-control 38 · config-gui 28).

## v1 Requirements

### Exec safety (Phase 1)

- [ ] **FREEZE-01**: Every synchronous child-process call in `linux-touchbar-control-center`
  runs through a helper that enforces a hard timeout (default 1500 ms, `SIGKILL` on
  expiry, overridable via `REACT_DRM_EXEC_TIMEOUT_MS`)
- [ ] **FREEZE-02**: `readVolume()`, `readMicMuted()` and `readBrightness()` return their
  **last known value** on timeout or error — never a fresh default — and log at most once
  per failure streak plus one recovery line
- [ ] **FREEZE-03**: Backend detection (`hasWpctl()`, brightnessctl presence) checks the
  binary on `PATH` without executing it, so one hung call at startup cannot permanently
  select the wrong backend
- [ ] **FREEZE-04**: All async `execFile` calls in these services also carry the timeout
  and `killSignal`
- [ ] **FREEZE-05**: `grep -rn "execFileSync\|execSync\|spawnSync"` over the app finds only
  the helper, or a documented exception
- [ ] **FREEZE-06**: A test proves a hung `wpctl` on `PATH` makes `readVolume()` return the
  previous value in **under 3000 ms** — shown failing against the old code first

### Stall recovery (Phase 2)

- [ ] **WATCH-01**: A watchdog worker observes a heartbeat the main thread writes to shared
  memory every 1000 ms; if it is stale beyond `REACT_DRM_STALL_MS` (default 15000) the
  process `SIGKILL`s itself and systemd's `Restart=always` restores the bar
- [ ] **WATCH-02**: Timing uses `process.hrtime.bigint()` (`CLOCK_MONOTONIC`) so suspend
  does not read as a stall, plus explicit `pause()` on sleep and `resume()` after re-attach
- [ ] **WATCH-03**: The watchdog runs only on the real bar (`!isPreview`), is `unref()`'d so
  it never keeps the process alive, and does not appear in preview output
- [ ] **WATCH-04**: Tests prove a blocked child dies by `SIGKILL` within 6 s and prints
  `[stall-watchdog]`, while `short` / `idle` / `paused` all exit 0 without that line —
  the `block` case shown failing first

### Machine switch (Phase 3)

- [ ] **MACH-01**: `deploy.sh` rebuilds the app's `dist/` after the library build, without
  `rm -rf dist` (which would destroy the user's `dist/config.js` on a failed compile)
- [ ] **MACH-02**: The compiled bar is smoke-tested as a **preview** — starts, no stack
  trace, exit 124 from `timeout` — before any root change
- [ ] **MACH-03**: `react-drm.service` runs `node dist/index.js` and recovers the panel with
  `react-drm-recover --no-restart` (`--no-restart` is mandatory: the helper otherwise
  restarts the unit it is an `ExecStartPre` of, looping forever)
- [ ] **MACH-04**: The watchdog and suspend units reference `/usr/local/sbin`, with no
  `mtmr` left in them; an unused old script is reported for the user to delete, not deleted
- [ ] **MACH-05**: `NRestarts` does not increase over 2 minutes, and restart time is
  measured before vs after and pasted

### Docs & snapshot (Phase 4)

- [ ] **DOCS-01**: `my-t2-fix/touchbar/` holds an index, git submodules to the real repos,
  and small files — no 48 MB drifting copy
- [ ] **DOCS-02**: A single `TROUBLESHOOTING-INDEX.md` maps **every** issue from both
  source troubleshooting files to a row, with duplicates merged and sources linked, and
  `mtmr --recover` replaced by `sudo react-drm-recover`
- [ ] **DOCS-03**: README updated for the new layout, including `git clone --recurse-submodules`
- [ ] **DOCS-04**: Nothing is pushed — the blocker check asks the user and waits

### EPIPE (Phase 5)

- [ ] **EPIPE-01**: The first full `write EPIPE` stack trace is captured and pasted
- [ ] **EPIPE-02**: Root cause is stated with `file:line`, proven by a root-vs-user
  reproduction (`USER RUNS` for the root half)
- [ ] **EPIPE-03**: `FINDINGS-EPIPE.md` gives the fix options with trade-offs and a recommendation
- [ ] **EPIPE-04**: If fixed, the fix is ≤ ~20 lines in our own code with tests and
  typecheck pasted; otherwise the phase stops at findings
- [ ] **EPIPE-05**: `TROUBLESHOOTING.md`'s "Known: write EPIPE" entry records the cause

### Cross-cutting

- [ ] **XC-01**: Every phase writes `.planning/hardening/REPORT-PHASE-<n>.md` with an honest
  `Status:` and pasted evidence for each Done-when item
- [ ] **XC-02**: No test suite regresses against the Phase 0 baseline (114 green), and each
  new test is shown failing against the old code before passing
- [ ] **XC-03**: The full diff is reviewed for stray files, debug prints and unrelated changes

## Out of Scope

| Item | Reason |
|------|--------|
| Running the service as a user unit | Phase 5 lists it as an option only; the root unit is deliberate and the install depends on it |
| Removing the two `config-gui` debug prints (`BOOT_OK`, `PREVIEW_LIVE`) | Noticed in Phase 0; out of this milestone's scope, recorded for later |
| Refactoring `DESIGNER.md` / `.zcodeignore` | Baseline hygiene, deliberately committed as-is |
| New bar features | This milestone is hardening, not feature work |

## Traceability

| Requirement | Phase |
|-------------|-------|
| FREEZE-01 … FREEZE-06 | 1 |
| WATCH-01 … WATCH-04 | 2 |
| MACH-01 … MACH-05 | 3 |
| DOCS-01 … DOCS-04 | 4 |
| EPIPE-01 … EPIPE-05 | 5 |
| XC-01 … XC-03 | all |

Coverage: 22/22 v1 requirements mapped ✓ (baseline commit `e6cdc2d` covers the pre-milestone state)