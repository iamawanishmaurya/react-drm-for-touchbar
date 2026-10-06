# Touch Bar hardening — plan for zcode

Written 2026-10-06 by Claude for an executor agent (zcode). Each phase is a separate file:
do them **in order, one per session**, and do not start a phase until the previous
phase's report says PASS.

| Phase | File | What | Needs the user? |
|---|---|---|---|
| 0 | [PHASE-0-baseline.md](PHASE-0-baseline.md) | Commit the current uncommitted work to a branch so every later change has a clean diff | no |
| 1 | [PHASE-1-exec-timeouts.md](PHASE-1-exec-timeouts.md) | No `wpctl` / `pactl` / `brightnessctl` call can freeze the bar | for the hardware check only |
| 2 | [PHASE-2-stall-watchdog.md](PHASE-2-stall-watchdog.md) | If the bar's main thread is stuck for 15 s, it kills itself and systemd restarts it | for the hardware check only |
| 3 | [PHASE-3-machine-switch.md](PHASE-3-machine-switch.md) | This machine: run compiled JS, use `react-drm-recover` instead of `mtmr --recover` | **yes — sudo steps** |
| 4 | [PHASE-4-my-t2-fix-cleanup.md](PHASE-4-my-t2-fix-cleanup.md) | Turn the `my-t2-fix/touchbar/` snapshot into links + one troubleshooting index | no (asks before push) |
| 5 | [PHASE-5-epipe-investigation.md](PHASE-5-epipe-investigation.md) | Find where `write EPIPE` on every start comes from; fix only if small | no |

Why these, in this order: on 2026-10-05 the bar froze because `useMicMute` polls
`readMicMuted()` every 2 s, which runs `wpctl` with `execFileSync` and **no timeout**,
and WirePlumber was hung (likely after the `t2bce_audio` stall —
`/home/Astra/opencode/zcode/my-t2-fix/research/t2-audio-fix/SUMMARY.md`). Phase 1 removes
that cause; Phase 2 catches the next unknown one; Phase 3 makes restarts fast and
removes the last dependency on mtmr.

---

## Ground facts (verified 2026-10-06 — do not re-derive)

| Fact | Value |
|---|---|
| Working repo (edit here only) | `/home/Astra/opencode/touchbar/react-drm-fork` (git, remote `iamawanishmaurya/react-drm-for-touchbar`) |
| Running install (**do not edit by hand, do not move**) | `/home/Astra/opencode/touchbar/react-drm`, reached via symlink `/home/Astra/opencode/react-drm` |
| Bar app | `linux-touchbar-control-center/` (alias `@/` = this folder) |
| Service | **system** unit `react-drm.service` (root), `ExecStartPre=/usr/bin/mtmr --recover`, `ExecStart=… npx tsx index.tsx`, drop-in `override.conf` sets `Restart=always`, `StartLimitIntervalSec=0` |
| Deploy to the running install | `NO_RESTART=1 ./deploy.sh` (copies app dirs `app layers src others lib components widgets`, `index.tsx`, tests, listed library files; rebuilds library `dist`) |
| Restart | `sudo systemctl restart react-drm` — **sudo is not passwordless; only the user runs it** |
| App tests | `cd linux-touchbar-control-center && npm test` (`tsx --test tests/*.test.ts`) |
| App typecheck | `cd linux-touchbar-control-center && npx tsc --noEmit -p tsconfig.json` |
| Library tests / build | repo root: `npm test`, `npx tsc` |
| Editor tests | `cd touchbar-control && npm test`; e2e needs its server: see `touchbar-control/README.md` |
| Node | `/home/Astra/.nvm/versions/node/v26.10.0/bin` |

## Hard rules (break one → stop and report)

1. **Never run `sudo`.** Steps that need root are written as "USER RUNS" — print them and wait.
2. Never write a password, token or key into any file, commit or log.
3. Edit only inside `react-drm-fork/` (Phase 4: `my-t2-fix/`). Reach the running install only through `NO_RESTART=1 ./deploy.sh`.
4. Never press **Apply** in touchbar-control and never enable **Live on Touch Bar** in automated tests.
5. Kill dev servers by port (`fuser -k 3100/tcp`), never `pkill -f` (it matches your own shell).
6. Never commit to `master`, never `git push`, never `--force` anything, unless the phase says to and the user said yes.
7. Never edit or delete an existing test to make it pass. If a test fails, fix the code or stop and report.
8. Do not widen scope. Anything outside the phase that looks wrong goes in the report under "Noticed, not touched".

## Verification method (how every phase is judged)

Each phase ends with a **Done when** list. A phase is PASS only if *every* item is shown
true by evidence, in this format:

1. **Run, don't assert.** Every check is a command. Paste the exact command and its real
   output (trim long output to the relevant lines, keep the exit status). "Tests pass"
   without output counts as FAIL.
2. **Fresh run after the last edit.** Re-run the whole Done-when list after your final
   change — earlier green runs don't count.
3. **Red before green for new tests.** For each new test, show it failing on the old code
   (or with the fix temporarily reverted) once, then passing. A test that never failed
   proves nothing.
4. **Read your own diff.** Paste `git diff --stat` and walk the full `git diff`: no stray
   files, no debug prints, no unrelated reformatting, comments match the code style around them.
5. **Hardware checks are the user's.** Where a step says USER CHECK, write exactly what
   the user should do and see; mark it PENDING until they confirm. Never mark it passed yourself.
6. **Report, honestly.** Write `.planning/hardening/REPORT-PHASE-<n>.md` with:
   - `Status: PASS | FAIL | BLOCKED | PASS (pending user check)`
   - What changed (files + one line each)
   - Evidence: each Done-when item → command → output
   - Deviations from the plan, and why
   - Noticed, not touched
   If something fails twice, stop, write the report with FAIL, and include the error output.

After each phase, the user can ask Claude to review `REPORT-PHASE-<n>.md` + the diff.
