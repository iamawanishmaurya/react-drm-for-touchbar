# REPORT — Phase 1: No external command can freeze the bar

**Status: PASS (pending user check)**

Date: 2026-10-06
Branch: `touchbar-control-hardening`
Commit: `876a171` — `fix(bar): time out wpctl/pactl/brightnessctl calls so a hung audio daemon can't freeze the bar`
Plan: `.planning/phases/01-no-external-command-can-freeze-the-bar/01-01-PLAN.md`
Spec: `.planning/hardening/PHASE-1-exec-timeouts.md`

The staged deploy reached the running install. **The bar is still running the old code**
until the user restarts the service, so the hardware check at the end is PENDING.

---

## What changed

| File | Change |
|---|---|
| `lib/services/execQuick.ts` (new) | `EXEC_TIMEOUT_MS` (default 1500, `REACT_DRM_EXEC_TIMEOUT_MS` override), `execQuick()` (hard timeout + `SIGKILL`, stderr discarded), `commandExists()` — PATH lookup without executing the binary |
| `lib/services/volume.ts` | `commandExists('wpctl')` replaces the module-load `wpctl --help` probe; exported pure `parseWpctlVolume` / `parsePactlVolume`; `lastVolume` fallback; once-per-streak logging; 6 async `execFile` calls get `timeout` + `killSignal` |
| `lib/services/mic.ts` | same pattern; exported `parseWpctlMuted` / `parsePactlMuted`; `lastMuted` fallback; `null` parse treated as failure; 2 async `execFile` calls get `timeout` + `killSignal` |
| `lib/services/brightness.ts` | `execQuick` for both reads; per-device `Map` last value; "binary missing" vs "hung" log split; async `execFile` gets `timeout` + `killSignal` |
| `tests/execQuick.test.ts` (new) | 9 cases, incl. the hung-`wpctl` end-to-end proof |

Requirement coverage: FREEZE-01…06, XC-01…03.

---

## Evidence

### Done-when 1 — step 5 grep: only `execQuick.ts`

```
$ cd linux-touchbar-control-center && grep -rn "execFileSync\|execSync\|spawnSync" lib app index.tsx | grep -v '\.test\.'
lib/services/execQuick.ts:1:import { execFileSync, type ExecFileSyncOptions } from 'child_process';
lib/services/execQuick.ts:10:// execFileSync with a hard timeout (SIGKILL) and stderr discarded. Throws on
lib/services/execQuick.ts:13:  return execFileSync(cmd, args, {
```
All three hits are inside the helper itself. No exceptions needed.

```
$ grep -rnE "await +(readVolume|readMicMuted|readBrightness)" lib app index.tsx
NONE - good
```
No caller was converted to async.

### Done-when 2 & 3 — app tests + typecheck

```
$ cd /home/Astra/opencode/touchbar/react-drm-fork && npx tsc
root_tsc=0

$ cd linux-touchbar-control-center && npm test
app_exit=0
ℹ tests 54
ℹ pass 54
ℹ fail 0

$ npx tsc --noEmit -p tsconfig.json
app_tsc=0
```

**54 = 45 (Phase 0 baseline) + 9 new.** The new cases:

```
✔ execQuick returns stdout from a command that finishes in time (6.919749ms)
✔ execQuick kills a hung command instead of blocking the bar thread (1504.939095ms)
✔ execQuick keeps the last volume when wpctl hangs (1658.336059ms)
```

### Done-when 4 — library tests at baseline

```
$ npx tsx --test tests/*.test.ts
lib_exit=0
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

Unchanged from Phase 0. (`npm test` does not exist at the repo root — see Deviations.)

### Done-when 5 — red before green

**RED** — the pre-fix `volume.ts` restored from `876a171^`, which contains bare
`execFileSync('wpctl', …)` with no timeout:

```
$ git show 876a171^:…/volume.ts > …/volume.ts
$ grep -c 'execQuick' …/volume.ts
0                              ← confirms the pre-fix file
$ grep -n 'execFileSync' …/volume.ts
1:import { execFile, execFileSync } from 'child_process';
12:  try { execFileSync('wpctl', ['--help'], { encoding: 'utf8', env: PW_ENV }); return true; }
21:      const out = execFileSync('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@'],
27:      const out = execFileSync('pactl', ['get-sink-volume', '@DEFAULT_SINK@'],

$ npx tsx --test --test-name-pattern='^execQuick keeps the last volume when wpctl hangs$' tests/execQuick.test.ts
red_exit=1
✖ execQuick keeps the last volume when wpctl hangs (20029.838652ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1
  AssertionError [ERR_ASSERTION]: spawnSync error: Error: spawnSync /usr/bin/node ETIMEDOUT
```

The old code blocked for **20 029 ms** — the child's own `spawnSync` timeout — and died
with `ETIMEDOUT`. That is a genuine hang, and the failure mode is a timeout, **not** a
module-resolution error.

**GREEN** — the fixed `volume.ts` restored:

```
$ cp /tmp/volume-phase1.ts …/volume.ts
restore_diff=0

$ npx tsx --test --test-name-pattern='^execQuick keeps the last volume when wpctl hangs$' tests/execQuick.test.ts
green_exit=0
✔ execQuick keeps the last volume when wpctl hangs (1627.109176ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

**20 029 ms → 1 627 ms** (~12× faster, and bounded by the 1500 ms timeout plus spawn
overhead).

The plan's verify gate for this task:

```
red_failures=3 green_failures=0 red_tests=1 green_pass_one=1 restore_diff=0
```

`red_tests=1` and `green_pass_one=1` confirm the anchored pattern matched exactly the one
intended test in both runs — a loose pattern would have made node print `ℹ pass 1` and
exit 0, producing a green-looking red run.

### Done-when 6 — staged deploy + install diff

```
$ cd /home/Astra/opencode/touchbar/react-drm-fork && NO_RESTART=1 ./deploy.sh
staged (no restart)

$ for f in execQuick.ts volume.ts mic.ts brightness.ts; do diff -q <fork> <install>; done
svc_diffs=0
```

### Done-when 7 — commit on the branch

```
$ git branch --show-current
touchbar-control-hardening

$ git log --oneline -1
876a171 fix(bar): time out wpctl/pactl/brightnessctl calls so a hung audio daemon can't freeze the bar
```

Nothing was pushed.

### Diff review (XC-03)

```
$ git diff --stat e6cdc2d..HEAD
 .planning/PROJECT.md                               | 130 +++++
 .planning/REQUIREMENTS.md                          | 102 ++++
 .planning/ROADMAP.md                               | 157 +++++
 .planning/STATE.md                                 |  74 ++++
 .planning/config.json                              |  92 +++++
 .planning/hardening/PHASE-1-exec-timeouts.md       |   2 +-
 .planning/hardening/README.md                      |   3 +-
 .planning/hardening/REPORT-PHASE-0.md              | 277 +++++++++
 .../01-01-PLAN.md                                  | 649 +++++++++++++++++++
 .../01-01-VERIFICATION.md                          | 151 +++++
 .../01-CONTEXT.md                                  |  71 +++
 .../lib/services/brightness.ts                     |  59 +-
 .../lib/services/execQuick.ts                      |  30 +
 linux-touchbar-control-center/lib/services/mic.ts |  49 +-
 linux-touchbar-control-center/lib/services/volume.ts |  67 ++-
 .../tests/execQuick.test.ts                        | 126 ++++
 16 files changed, 1978 insertions(+), 61 deletions(-)
```

`console.log` audit over every phase-touched source file: **zero** in the four service
files. The two hits in `tests/execQuick.test.ts` (lines 43, 75) are inside the inline
child-program strings the test spawns — `console.log(JSON.stringify({first, second, ms}))`
is the output the parent parses. Not debris.

---

## Done-when 8 — USER CHECK (PENDING until you confirm)

**These need sudo and hardware. I have not run them and never will.**

```bash
# 1. Restart the service so the staged code takes effect, then wait 10 s
sudo systemctl restart react-drm

# 2. Hang the audio daemon for 20 s
systemctl --user kill -s STOP pipewire; sleep 20; systemctl --user kill -s CONT pipewire

# 3. DURING those 20 s, tap a few buttons and watch the clock.
#    The bar must keep responding. A short hitch every 2 s is OK.
#    Before this fix it froze completely.

# 4. Then check the logs — at most one failure line and one recovery line each
journalctl -u react-drm --since '-2 min' | grep -E '\[mic\]|\[volume\]'
```

What proves it worked: during step 3 the bar stays responsive (the polled `wpctl` now
costs at most ~1.5 s per call instead of blocking forever), and step 4 shows at most one
`read failed` plus one `read recovered` per service — not one line per 2-second poll.

---

## Deviations from the plan

1. **`git stash` → `cp` + `git show` for the red run.** As the plan requires: the new
   helper and test file are untracked, so a `stash pop` could have destroyed them.

2. **I completed Task 6 myself.** The executor subagent implemented tasks 1–5 and 7 and
   committed `876a171`, then was cut off by a provider rate limit before producing the
   red-before-green evidence or this report. I re-ran the red and green runs myself using
   `git show 876a171^` (the pre-fix `volume.ts`) and verified the restore with
   `diff -q` + `git status`. No source file differs from the committed state.

3. **The planner subagent edited two files it was not authorised to edit**:
   `.planning/hardening/README.md` and `PHASE-1-exec-timeouts.md`. Both edits correct
   facts I had already documented as wrong in Phase 0 (no root `npm test`; build before
   app tests). I kept them rather than reverting a fix back to a known-wrong instruction,
   but flagging it because it was outside its brief.

4. **Plan-checker gaps (6) fixed before execution**, including a genuinely inverted gate:
   the red-evidence check had `grep -c …; echo "red_failures=$?"`, which captures grep's
   *exit status*, not the count — `red_failures=1` would have meant "nothing failed". The
   corrected gate was validated against three fixtures before being trusted.

---

## Noticed, not touched

1. **`brightnessctlMissing` is shared between reads and writes.** `applyBrightness` sets it
   on a write error, which would then suppress the "not found" message on subsequent reads.
   Pre-existing; left alone under "behaviour otherwise unchanged".

2. **`execQuick` spreads `...opts` after `timeout`**, so a caller could silently override
   the timeout. No caller does today. A future caller passing `{ timeout: 0 }` would
   reintroduce the freeze.

3. **The app `tsconfig` excludes `tests/`**, so `tests/execQuick.test.ts` is never
   typechecked — it only runs. A type error there would surface at runtime, not at build.

4. **`.planning/STATE.md` was left modified** in the working tree at the time of this
   report (the executor's Phase-1 state update, correct and unstaged). It is committed
   separately as a `docs(01):` commit so the phase commit keeps its required subject line.

5. **`TROUBLESHOOTING.md` does not yet mention this fix.** Worth a line in Phase 4, when
   the troubleshooting index is rebuilt.

---

## Next phase

[PHASE-2-stall-watchdog.md](PHASE-2-stall-watchdog.md) — a blocked main thread `SIGKILL`s
itself and systemd restarts the bar. It touches different files, so it can start now;
Phase 1 should not be called fully passed until the USER CHECK above is confirmed.