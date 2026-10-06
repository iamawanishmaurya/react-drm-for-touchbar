# REPORT — Phase 2: Restart the bar when its main thread is stuck

**Status: PASS (pending user check)**

Date: 2026-10-07
Branch: `touchbar-control-hardening`
Commit: `8124578` — `feat(bar): restart the bar when its main thread is blocked for 15 s`
Plan: `.planning/phases/02-stall-watchdog/02-01-PLAN.md`
Spec: `.planning/hardening/PHASE-2-stall-watchdog.md`

The staged deploy reached the running install. **The bar is still running the old code**
until the user restarts the service, so the hardware check at the end is PENDING.

---

## What changed

| File | Change |
|---|---|
| `lib/services/stallWatchdog.ts` (new) | `StallWatchdog` interface + `startStallWatchdog({ stallMs, beatMs? })`. Main thread stores a `hrtime.bigint()` millisecond beat into a `BigInt64Array` over a `SharedArrayBuffer(8)` every `beatMs` (default 1000) with `Atomics.store`; an `eval: true` worker polls it every 1000 ms and `SIGKILL`s the process after `fs.writeSync(2, '[stall-watchdog] …')` when the beat goes stale. Interval and worker both `unref()`'d. `pause()` writes the `-1n` sentinel, `resume()` stores a fresh beat, `stop()` clears the interval and terminates the worker |
| `index.tsx` | Starts the watchdog immediately after `renderHot(...)` returns, gated on `watchdogOn = !isPreview && Number.isFinite(stallMs) && stallMs > 0`, logging `stall watchdog: <n> ms` once. `watchdog.pause()` is the first statement of `onSleep`, `watchdog.resume()` the last of `onResume`. A `NO_WATCHDOG` no-op keeps both calls unconditional |
| `tests/fixtures/stall-child.ts` (new) | The spawned child: 4 modes (`block`, `short`, `idle`, `paused`) driven by `argv[2]`/`argv[3]`, relative imports only, and no `process.exit` anywhere |
| `tests/stallWatchdog.test.ts` (new) | 4 cases: a blocked child dies by `SIGKILL` in under 6 s with the `[stall-watchdog]` line on stderr; `short`, `idle` and `paused` all exit 0 with no such line |

Requirement coverage: WATCH-01, WATCH-02, WATCH-03, WATCH-04, XC-01, XC-02, XC-03.

---

## Evidence

All commands below were run from `/home/Astra/opencode/touchbar/react-drm-fork`. The
"fresh sweep" is a single re-run of the entire Done-when list after the last source edit
(the restore of the red-before-green edit), per README rule 2.

### Done-when 1 — app tests + typecheck

```
$ npx tsc
root_tsc=0

$ npx tsx --test tests/*.test.ts > /tmp/f-lib.txt 2>&1; echo "lib_exit=$?"
lib_exit=0
ℹ tests 3
ℹ pass 3
ℹ fail 0

$ cd linux-touchbar-control-center && npm test > /tmp/f-app.txt 2>&1; echo "app_exit=$?"
app_exit=0
ℹ tests 58
ℹ pass 58
ℹ fail 0

$ npx tsc --noEmit -p tsconfig.json; echo "app_tsc=$?"
app_tsc=0
```

**58 = 54 (Phase 1) + 4 new. Library unchanged at 3. Neither suite regressed.** The four
new cases:

```
✔ stall watchdog SIGKILLs a bar whose main thread blocks (2155.348019ms)
✔ a hitch shorter than the limit does not kill the bar (2613.174357ms)
✔ an idle bar exits on its own — the watchdog holds nothing open (2615.870585ms)
✔ a paused bar survives a stall longer than the limit (2621.565342ms)
```

The blocked child is noticed in **~2.1 s** against the 1000 ms limit the test uses
(1 s of worker polling + the stale beat), well inside the 6 s bound the spec requires.

`app_exit`, `lib_exit` and `app_tsc` are captured into variables **before** any grep
consumes the output, so a runner that dies before printing a summary cannot verify green
vacuously.

### Done-when 2 — red-before-green for the `block` case

**RED** — identical code with one line inside `WORKER_SOURCE` commented out:

```
$ cp linux-touchbar-control-center/lib/services/stallWatchdog.ts /tmp/stallWatchdog-phase2.ts
$ grep -c '// process.kill' linux-touchbar-control-center/lib/services/stallWatchdog.ts
1

$ npx tsx --test --test-name-pattern='^stall watchdog SIGKILLs a bar whose main thread blocks$' tests/stallWatchdog.test.ts > /tmp/red-phase2.txt 2>&1
red_exit=1
✖ stall watchdog SIGKILLs a bar whose main thread blocks (6012.248297ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
✖ failing tests:

test at tests/stallWatchdog.test.ts:22:1
✖ stall watchdog SIGKILLs a bar whose main thread blocks (6012.248297ms)
  AssertionError [ERR_ASSERTION]: child was NOT killed by the watchdog — signal=SIGTERM status=null spawnError=ETIMEDOUT after 6008ms
  + actual - expected

  + 'SIGTERM'
  - 'SIGKILL'
        ^
```

This is the failure the phase needs: **the child was NOT killed.** With the kill removed
the child busy-loops forever, `spawnSync` hits its own 6 s timeout and SIGTERMs it, so
`r.signal` is `SIGTERM`. The failure is an assertion failure on a value the test read from
a real child process — **not** a module-resolution or "does not provide an export" error,
which would have proved nothing.

**GREEN** — the file restored:

```
$ cp /tmp/stallWatchdog-phase2.ts linux-touchbar-control-center/lib/services/stallWatchdog.ts
$ diff -q /tmp/stallWatchdog-phase2.ts linux-touchbar-control-center/lib/services/stallWatchdog.ts; echo "restore_diff=$?"
restore_diff=0
$ grep -c '// process.kill' linux-touchbar-control-center/lib/services/stallWatchdog.ts
leftover_kill_comments=0

$ npx tsx --test --test-name-pattern='^stall watchdog SIGKILLs a bar whose main thread blocks$' tests/stallWatchdog.test.ts > /tmp/green-phase2.txt 2>&1
green_exit=0
✔ stall watchdog SIGKILLs a bar whose main thread blocks (2157.097841ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
```

The plan's gate for this task:

```
red_named=2 red_fileline=0 red_msg=1 red_sig=1 green_named=1 green_fileline=0
green_pass_one=1 green_fail0=1 restore_diff=0 leftover_kill_comments=0
```

`red_fileline=0` and `green_fileline=0` matter more than they look: a mis-typed
`--test-name-pattern` still prints `ℹ tests 1`, `ℹ pass 1` and exits **0**, with the FILE
path in place of the test title (see Deviations 3). Asserting on the ✔/✖ line text is what
proves the pattern actually matched.

### Done-when 3 — wiring grep

```
$ grep -n "startStallWatchdog\|watchdog\.\(pause\|resume\)" linux-touchbar-control-center/index.tsx
6:import { startStallWatchdog, type StallWatchdog } from '@/lib/services/stallWatchdog';
121:  const watchdog = watchdogOn ? startStallWatchdog({ stallMs }) : NO_WATCHDOG;
127:        watchdog.pause();
139:        watchdog.resume();
```

`wd_hits=4`, `start_calls=1`, `guard_hits=1`, `log_hits=1`. Line 127 is the first
statement of `onSleep`; line 139 is the last statement of `onResume`, after the
`attachTouchBar()` / `result.resume()` re-attach. The `!isPreview` gate is on the same
statement as the call (line 121 reads `watchdogOn ? … : NO_WATCHDOG`, defined on 118 as
`!isPreview && Number.isFinite(stallMs) && stallMs > 0`).

### Done-when 4 — preview is unaffected

```
$ cd linux-touchbar-control-center && timeout 20 npm run dev:preview > /tmp/f-preview.txt 2>&1
preview_exit=$?          →  1
$ grep -c "stall watchdog" /tmp/f-preview.txt
watchdog_lines=0
```

**Read the exit status honestly: it is `1`, not `124`.** In this fork the preview dies
before `renderHot` is ever reached:

```
[00:30:50] ● ERROR react-drm    startup failed: react-drm: native addon not found.
Run `npm run build:native` first.
```

`react-drm` resolves its addon from `<pkgroot>/build/{Release,Debug}/drm_backend.node`
(`src/native/load-addon.ts`), and the fork has no `build/` directory — the compiled addon
exists only in the running install. So this run proves "the watchdog printed nothing" but
on its own it **cannot** prove "the watchdog did not start in preview": the process died
first. Building the addon in the fork, or launching a second bar out of the running
install, are both outside this phase (see Deviations 5).

The load-bearing evidence for the same claim is the structural one, which is exact:

```
$ grep -n 'watchdogOn\|stall watchdog\|startStallWatchdog' index.tsx
6:import { startStallWatchdog, type StallWatchdog } from '@/lib/services/stallWatchdog';
118:  const watchdogOn = !isPreview && Number.isFinite(stallMs) && stallMs > 0;
121:  const watchdog = watchdogOn ? startStallWatchdog({ stallMs }) : NO_WATCHDOG;
122:  if (watchdogOn) log.info(`stall watchdog: ${stallMs} ms`);
$ grep -c 'const watchdogOn = !isPreview && Number.isFinite(stallMs) && stallMs > 0' index.tsx
guard_hits=1
```

The preview cannot reach line 118, and the only call site of `startStallWatchdog` is on
line 121, guarded by it.

### Done-when 5 — staged deploy + install diff

```
$ cd /home/Astra/opencode/touchbar/react-drm-fork && NO_RESTART=1 ./deploy.sh
npm notice run react-drm@0.1.0 npx
npm notice run 'tsc'
staged (no restart)
deploy_exit=0

$ for f in lib/services/stallWatchdog.ts index.tsx; do
    diff -q "linux-touchbar-control-center/$f" "/home/Astra/opencode/react-drm/linux-touchbar-control-center/$f" || bad=$((bad+1)); done
install_diffs=0
```

`tests/fixtures/stall-child.ts` is **not** in the install — `deploy.sh` copies
`tests/*.test.ts` only. The phase file calls that out as acceptable because the suite runs
from the fork. See "Noticed, not touched" 2 for the sharp edge it leaves.

### Done-when 6 — commit on the branch

```
$ git branch --show-current
touchbar-control-hardening

$ git log --oneline -1
8124578 feat(bar): restart the bar when its main thread is blocked for 15 s

$ git show --stat --oneline HEAD
8124578 feat(bar): restart the bar when its main thread is blocked for 15 s
 linux-touchbar-control-center/index.tsx            | 27 ++++++++-
 .../lib/services/stallWatchdog.ts                  | 70 ++++++++++++++++++++++
 .../tests/fixtures/stall-child.ts                  | 51 ++++++++++++++++
 .../tests/stallWatchdog.test.ts                    | 56 +++++++++++++++++
 4 files changed, 203 insertions(+), 1 deletion(-)
```

Staged by explicit path list, not `git add -A`. Nothing was pushed, nothing was forced, no
commit landed on `master`.

### Diff review (XC-03)

```
$ git status --short          # before committing
 M linux-touchbar-control-center/index.tsx
?? .planning/phases/02-stall-watchdog/
?? linux-touchbar-control-center/lib/services/stallWatchdog.ts
?? linux-touchbar-control-center/tests/fixtures/
?? linux-touchbar-control-center/tests/stallWatchdog.test.ts
```

The full `git diff` of `index.tsx` is 26 insertions and 1 deletion: one import, the
`NO_WATCHDOG` constant, the seven-line watchdog block after `renderHot`, and the
`onSleep`/`onResume` bodies. Nothing else in the file moved, no comment was reworded, no
import reordered.

`console.` audit across every file this phase added or changed: **zero** in
`stallWatchdog.ts`, the fixture, and the `index.tsx` diff. The deliberate `console.log`
debris check also covers `leftover_kill_comments=0` — the red-run edit is gone from the
committed source.

The only untracked file outside the phase's own additions is the phase plan directory,
which is committed separately as `docs(02)`.

---

## Done-when 7 — USER CHECK (PENDING until you confirm)

**These need sudo and hardware. I have not run them and never will.**

```bash
# 1. Restart the service so the staged code takes effect, then wait 10 s.
sudo systemctl restart react-drm

# 2. Confirm the watchdog started — expect EXACTLY ONE line:
journalctl -u react-drm --since '-1 min' | grep 'stall watchdog'
#    → "stall watchdog: 15000 ms"

# 3. Use the bar normally for a minute (volume, brightness, mic mute).
#    It must behave exactly as before.

# 4. Suspend the laptop once and wake it.
#    The bar must come back on its own, without a restart.

# 5. The watchdog must NOT have fired across that suspend/resume cycle:
journalctl -u react-drm --since '-10 min' | grep -c '\[stall-watchdog\] main thread blocked'
#    → 0
```

What proves it worked: step 2 shows one start line, step 4 leaves a working bar, and step 5
prints `0`. A non-zero count in step 5 would mean the watchdog fired — that is the designed
recovery working, but it should not happen across an ordinary suspend/resume, and if it
does, the bar restarting itself is the mitigation.

Optional extra confidence, once steps 1–5 pass: `REACT_DRM_STALL_MS=20000` in the unit's
environment would raise the limit. That is a root change and belongs to Phase 3.

---

## Deviations from the plan

1. **The heartbeat is seeded synchronously before the interval is armed.** The plan's
   Task 1 code already included this (it was a planner finding, not a design change), but
   it is worth restating because the phase file does not spell it out: `SharedArrayBuffer`
   is zero-initialised, so a beat that has never been written reads as "last seen at time
   0" — older than any limit — and the worker would `SIGKILL` a healthy bar one second into
   every start. `startStallWatchdog` stores one beat before it arms the interval.

2. **The fixture passes `beatMs: 200`, not the 1000 ms default.** The design default is
   right for the bar (15000 ms limit against a 1000 ms heartbeat is a 14 s margin), but
   the suite drives the limit down to 1000 ms. At `beatMs = 1000` the margin is **zero**,
   and the sub-millisecond difference between two independent 1000 ms timers — one on the
   main thread, one in the worker — decides whether `short` passes. At 200 ms the worst
   stale beat is 600 + 200 = 800 ms, a 200 ms margin. The bar itself keeps the default.

3. **`ℹ tests 1` is not proof that a `--test-name-pattern` matched.** Measured here: a
   pattern matching nothing prints `✔ tests/sessionRuntime.test.ts (178ms)`, `ℹ tests 1`,
   `ℹ pass 1` and exits 0 — node counts the whole file as one passing test. The plan's
   original `red_tests=1` gate would have passed on a mis-typed pattern. The gate was
   strengthened during execution to check the ✔/✖ **line text**: `red_named`/`green_named`
   must show the test title, `red_fileline`/`green_fileline` must show no path line. The
   plan file and the test's own comment now record this.

4. **The plan's `fixture_exits` gate matched a comment.** `grep -c 'process\.exit'`
   returned `1` — the hit was the words "no process.exit anywhere" in a fixture comment,
   not a call. Tightened to `grep -c 'process\.exit('`, which returns `0`. The plan file was
   corrected to match. (I also mangled that plan line with a `perl -pi -e` substitution
   that ate a `$(`; it is repaired and every `<automated>` block in the plan was re-scanned
   afterwards for that class of corruption — all seven are clean.)

5. **The plan's report gate could never pass.** It ran `grep -n '^Status:'`, which does
   not match this milestone's own report format: `**Status: PASS (pending user check)**`,
   bold, exactly as `REPORT-PHASE-1.md` writes it. The gate returned 1 on a perfectly good
   report. Fixed twice: first to `grep -c 'Status: PASS (pending user check)'`, which
   still returned `3` because the same phrase also appears in the USER CHECK heading and
   in this deviation; finally to
   `grep -cE '^\*\*Status: PASS \(pending user check\)\*\*$'`, which pins the header line
   exactly and returns `1`. (Phase 1's plan carries the same dead gate — left alone, since
   editing an earlier phase's plan is out of scope here.)

6. **`dev:preview` exits 1 in the fork, not 124, so Done-when 4 is weaker than it looks.**
   Reported honestly above: the fork has no compiled native addon, so the preview dies at
   `createDisplay()` before `renderHot` and the run never reaches the watchdog. I did not
   build the addon (a stray `build/` artifact in the repo tree, outside this phase) and did
   not launch a second bar from the running install (it would compete with the live
   service for the panel — a hardware action the hard rules forbid). The structural gate
   carries the claim instead. This gate should be re-run from the running install, where
   the addon exists, before Phase 3 if anyone wants runtime proof.

7. **The em dash in the watchdog message is `\u2014` in the source.** The plan blessed both the
   escape and the literal character; the escape was used so the committed file is pure
   ASCII. The bytes the worker writes are identical (a real em dash).

---

## Noticed, not touched

1. **`beatMs` is only exercised at 200 ms.** The production default (1000 ms) is never run
   by a test — the suite deliberately uses 200 ms to keep a margin. That is the right call
   for a test, but it means the shipped heartbeat interval is unverified by CI. The
   production path is instead covered by the USER CHECK above.

2. **`tests/stallWatchdog.test.ts` is deployed but its fixture is not.** `deploy.sh` copies
   `tests/*.test.ts` and nothing else, so the running install now has a test file that
   spawns `tests/fixtures/stall-child.ts`, which does not exist there. Nothing runs the
   install's test suite today, so this is inert — but if anyone ever does, that one file
   will fail confusingly. Fixing it properly means teaching `deploy.sh` about `fixtures/`,
   which is a change to a shared script and outside this phase. Flagging it for Phase 3,
   which already touches `deploy.sh`.

3. **The app `tsconfig` excludes `tests/`**, so `tests/fixtures/stall-child.ts` is never
   typechecked — it is only executed. Same limitation Phase 1 recorded for `execQuick.test.ts`.
   A type error in the fixture would surface as a runtime failure.

4. **`watchdog` is closed over by the sleep callbacks, so a `stop()` is never called on the
   production path.** `stop()` exists for the fixture and for symmetry. In the real bar the
   process either runs forever or dies by SIGKILL, so there is nothing to release — but if
   Phase 3 adds a graceful shutdown path, `watchdog.stop()` should be added to the existing
   `shutdown()` function in `index.tsx`.

5. **`REACT_DRM_STALL_MS` is read from the environment with no validation of absurd
   values.** `REACT_DRM_STALL_MS=1` would make the watchdog kill the bar during any GC
   pause. `Number.isFinite` and `> 0` are the only guards. A floor (say 5000 ms) would be
   more robust, but the phase file specifies "default 15000; 0 disables" and nothing in
   the repo sets this variable, so I left the contract exactly as specified.

6. **Phase 1's USER CHECK is still unconfirmed.** `fa4d7f5` recorded it as PENDING and
   nothing since has resolved it. Phase 2 touches different files, so the two phases are
   independent — but Phase 2 should not be called fully passed until the user restarts the
   service, which retires both checks in one go.

---

## Next phase

[PHASE-3-machine-switch.md](PHASE-3-machine-switch.md) — run the compiled JS and use
`react-drm-recover` instead of `mtmr --recover`. It needs sudo steps printed for the user,
and it touches `deploy.sh` and the systemd unit.