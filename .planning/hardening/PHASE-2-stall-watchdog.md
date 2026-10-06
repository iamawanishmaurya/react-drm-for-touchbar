# Phase 2 — Restart the bar when its main thread is stuck

**Goal:** if the bar's JavaScript main thread is blocked for longer than 15 s (any cause —
a hung call we haven't found, a busy loop, a deadlock in a native binding), the process
kills itself and systemd's `Restart=always` brings the bar back. Phase 1 fixed the known
cause; this catches unknown ones.

Prerequisite: Phase 1 PASS. Read `.planning/hardening/README.md`.

## Design (follow it; deviations go in the report)

A blocked main thread can't check itself, and a `SIGTERM` handler would never run. So a
**worker thread** watches a heartbeat the main thread writes into shared memory:

- Main thread: every 1000 ms, `Atomics.store(beat, 0, now())` where `beat` is a
  `BigInt64Array` over a `SharedArrayBuffer(8)` and `now()` = `process.hrtime.bigint() / 1_000_000n`
  (milliseconds). The interval is `.unref()`'d.
- Worker (created with `new Worker(SOURCE, { eval: true, workerData: { sab, stallMs } })`,
  `.unref()`'d — plain JS source string, so it works under both tsx and compiled `dist/`):
  every 1000 ms reads the beat; if the beat is `-1n` it is paused; otherwise if
  `now - beat > stallMs`, write one line to stderr with `fs.writeSync(2, …)`:
  `[stall-watchdog] main thread blocked for <n> ms (limit <stallMs>) — exiting so systemd restarts the bar\n`
  then `process.kill(process.pid, 'SIGKILL')`.
- Why `hrtime`: it is `CLOCK_MONOTONIC`, which does **not** advance during system
  suspend, so resume doesn't look like a stall. Still add `pause()` / `resume()` (belt and braces).
- `resume()` stores a fresh beat immediately (no false trigger right after resume).

## Steps

1. Create `linux-touchbar-control-center/lib/services/stallWatchdog.ts`:
   ```ts
   export interface StallWatchdog { pause(): void; resume(): void; stop(): void }
   export function startStallWatchdog(opts: { stallMs: number; beatMs?: number }): StallWatchdog
   ```
   `stop()` clears the interval and terminates the worker. Comment the *why* (blocked thread
   can't run handlers; SIGKILL so systemd restarts; hrtime ignores suspend), in the file's local style.
2. Wire it in `linux-touchbar-control-center/index.tsx`, **after** `renderHot(...)` returns:
   - Read `REACT_DRM_STALL_MS` (default `15000`; `0` disables).
   - Start only when `!isPreview` (the real bar). Log once: `stall watchdog: <n> ms`.
   - In the existing `watchSleep({ onSleep, onResume })` block: call `watchdog.pause()` first
     thing in `onSleep`, and `watchdog.resume()` at the end of `onResume` (after re-attach).
3. Test fixture `linux-touchbar-control-center/tests/fixtures/stall-child.ts` (relative imports
   only): starts the watchdog with `stallMs` from `argv[2]`, then by `argv[3]`:
   - `block` → busy-loop forever (`for (;;) {}`) after 200 ms;
   - `short` → busy-loop for 600 ms once, then exit 0 after 2500 ms;
   - `idle` → just wait 2500 ms then exit 0 (proves the unref'd worker/interval don't keep the process alive — exit must happen by itself without `process.exit`. Use a `setTimeout` that does nothing; the process should exit when it fires).
   - `paused` → `pause()`, busy-loop 2500 ms, `stop()`, exit 0.
4. Test `linux-touchbar-control-center/tests/stallWatchdog.test.ts` spawning
   `process.execPath, ['--import', 'tsx', fixture, stallMs, mode]`:
   - `1000 block` → child ends by signal `SIGKILL` within 6 s; stderr contains `[stall-watchdog]`.
   - `1000 short` → exit code 0, no `[stall-watchdog]` in stderr.
   - `1000 idle` → exit code 0 within 5 s.
   - `1000 paused` → exit code 0, no `[stall-watchdog]`.
   Red-before-green: show `block` failing with the kill line commented out, then passing.
5. `NO_RESTART=1 ./deploy.sh` (copies `lib/` and `index.tsx`; `tests/fixtures/` is **not**
   copied by deploy.sh — that's fine, tests run from the fork).

## Done when

- [ ] App `npm test` all pass (paste counts); `npx tsc --noEmit -p tsconfig.json` exit 0
- [ ] Red-before-green evidence for the `block` case
- [ ] `grep -n "startStallWatchdog\|watchdog\.\(pause\|resume\)" linux-touchbar-control-center/index.tsx` shows start, pause (in onSleep), resume (in onResume)
- [ ] Preview still starts and is not affected: `cd linux-touchbar-control-center && timeout 20 npm run dev:preview 2>&1 | grep -c "stall watchdog"` → `0`
- [ ] Deploy staged; `diff -q` of `stallWatchdog.ts` and `index.tsx` against the running install → no differences
- [ ] Commit: `feat(bar): restart the bar when its main thread is blocked for 15 s`
- [ ] USER CHECK (PENDING): `sudo systemctl restart react-drm`; then
  `journalctl -u react-drm --since '-1 min' | grep 'stall watchdog'` → one start line; the bar works;
  suspend + resume the laptop once → bar comes back, and
  `journalctl -u react-drm --since '-10 min' | grep -c '\[stall-watchdog\] main thread blocked'` → `0`
- [ ] `REPORT-PHASE-2.md` written
