# Touch Bar Bar (react-drm-fork)

## What This Is

`react-drm` renders a UI on the 2016 MacBook Pro's Touch Bar (a DRM/KMS device, no
framebuffer console). This fork adds a real app layer on top: a Touch Bar control bar
with volume/brightness sliders, media keys, a games menu (Snake/Dino/Piano/Pong), dock and
routed left panels, plus `touchbar-control` — a web editor that streams the live bar and
edits its layout in place. `config-gui` is a second, older settings GUI over the same
`config.ts`.

Runs as the **system** unit `react-drm.service` (root), editing sources only in this fork,
deployed to `/home/Astra/opencode/touchbar/react-drm`.

## Core Value

**The bar never freezes.** Everything else — the editor, the games, the layout — is worth
nothing if the bar can hang and take the whole interaction surface with it.

## Requirements

### Validated

- Phase 0 (hardening baseline): 104 uncommitted entries committed to branch
  `touchbar-control-hardening` as `e6cdc2d`; baseline 114 tests green. See
  `.planning/hardening/REPORT-PHASE-0.md`.

### Active

- [ ] No external command (`wpctl` / `pactl` / `brightnessctl`) can freeze the bar
- [ ] A blocked main thread self-kills and systemd restarts it within ~15 s
- [ ] The service runs compiled JS and recovers the panel without `mtmr`
- [ ] `my-t2-fix/touchbar/` links the real repos instead of drifting from them
- [ ] The `write EPIPE` on every start is explained, with a fix if it is small

### Out of Scope

- Rewriting the bar app beyond the five hardening phases — this milestone is hardening,
  not feature work
- Running the service as a user unit (listed in Phase 5 as a fix option only; the root
  unit is deliberate and the whole install depends on it)
- Refactoring the two leftover `config-gui` debug prints and the `src/renderer` lid log
  (noticed in Phase 0, deliberately deferred)

## Hard Rules (never violate — break one means stop and report)

These are **not** negotiable and apply to every agent working this milestone:

1. **Never run `sudo`.** Sudo is not passwordless on this machine. Any step needing root
   is written as "USER RUNS": print the exact commands for the user and stop.
2. **Never `git push`.** Never commit to `master`. Never `--force`. Phase 4 asks the user
   before pushing and must wait for a yes.
3. **Never press Apply** in touchbar-control, and never enable "Live on Touch Bar" in an
   automated test. The one deliberate Apply in Phase 3 is a **USER CHECK**.
4. **Edit only inside this repo** (`react-drm-fork/`) — Phase 4 works in `my-t2-fix/`.
   Reach the running install **only** through `NO_RESTART=1 ./deploy.sh`.
5. **Never edit or delete an existing test to make it pass.** If a test fails, fix the code
   or stop and report.
6. Never write a password, token or key into any file, commit or log.
7. Kill dev servers by port (`fuser -k 3100/tcp`), never `pkill -f` (it matches your own shell).
8. Do not widen scope. Anything outside the current phase goes in the report under
   "Noticed, not touched".

The authoritative version is `.planning/hardening/README.md` — **read it before starting
any phase.**

## Context

- On 2026-10-05 the bar froze solid. Root cause: `useMicMute` polls `readMicMuted()` every
  2 s, which runs `wpctl` via `execFileSync` **with no timeout**, and WirePlumber was hung
  after the `t2bce_audio` stall (`/home/Astra/opencode/zcode/my-t2-fix/research/t2-audio-fix/SUMMARY.md`).
  A hung child process with no timeout blocks the bar's only thread forever.
- Phase 1 removes that cause; Phase 2 catches unknown ones; Phase 3 makes restarts fast
  and drops the last `mtmr` dependency.
- `write EPIPE` is logged on **every** service start since 2026-09-28. The bar survives it.
  Leading hypothesis: root connecting to the user's session bus, which closes the socket.
- The systemd unit has `Restart=always` with `StartLimitIntervalSec=0`, so a self-kill is
  a legitimate recovery strategy — this is what Phase 2 leans on.
- A watchdog (`packaging/touchbar-watchdog.sh`) already auto-recovers from the
  `appletbdrm -110` signature.

## Constraints

- **Baseline test commands (corrected from `.planning/hardening/README.md`):**
  - Root library tests: `npx tsx --test tests/*.test.ts` — **`npm test` does not exist at
    the repo root**; `package.json` has no `test` script.
  - **Run `npx tsc` at the repo root before any app test run.** `node_modules/react-drm`
    is a symlink to the repo root, so `react-drm/dist/src/index.js` only exists after a
    build. Without it the app suite reports 2 bogus module-resolution failures
    (`tests/lockNavigation.test.ts`, `tests/systemLock.test.ts`).
  - App tests: `cd linux-touchbar-control-center && npm test`; typecheck
    `npx tsc --noEmit -p tsconfig.json`.
  - Editor tests: `cd touchbar-control && npm test`.
  - config-gui tests: `cd config-gui && npm test`.
- **Phase 0 baseline to compare against:** library 3 · app 45 · touchbar-control 38 ·
  config-gui 28 = **114 tests, all passing**.
- Branch for all hardening work: `touchbar-control-hardening` (created in Phase 0).
- Node: `/home/Astra/.nvm/versions/node/v26.10.0/bin`.
- Deploy: `NO_RESTART=1 ./deploy.sh` from the repo root. Restart is `sudo systemctl restart
  react-drm` — **the user runs that.**
- Never legacy `SetCrtc`; only atomic `FB_ID` flips; address the device by name.

## Verification Method

Every phase ends with a **Done when** list in its phase file. A phase is PASS only if
every item is proven by a command whose real output is pasted. Specifically:

1. **Run, don't assert.** "Tests pass" without pasted output counts as FAIL.
2. **Fresh run after the last edit.** Earlier green runs don't count.
3. **Red before green for new tests.** Show each new test failing against the old code
   once, then passing.
4. **Read your own diff.** Paste `git diff --stat`, walk the diff: no stray files, no debug
   prints, no unrelated reformatting.
5. **Hardware checks are the user's.** Where a step says USER CHECK, print exactly what to
   do and mark it PENDING. Never mark it passed yourself.
6. **Report honestly.** Write `.planning/hardening/REPORT-PHASE-<n>.md` with
   `Status: PASS | FAIL | BLOCKED | PASS (pending user check)`, what changed, evidence per
   Done-when item, deviations and why, and "Noticed, not touched".

If something fails twice, stop, write the report with `Status: FAIL`, and include the error
output.

## Artifacts

| Artifact | Location |
|----------|----------|
| Hardening plan (authoritative) | `.planning/hardening/README.md` + `PHASE-<n>-*.md` |
| Phase reports | `.planning/hardening/REPORT-PHASE-<n>.md` |
| Requirements | `.planning/REQUIREMENTS.md` |
| Roadmap | `.planning/ROADMAP.md` |