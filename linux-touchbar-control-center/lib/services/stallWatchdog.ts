import { Worker } from 'worker_threads';

// The polling loop lives in the worker as plain JS text rather than a second
// module: the bar runs from source under `tsx` and from compiled `dist/` once
// Phase 3 switches the unit over, and an eval'd string resolves in both without
// a build step or a path that only exists in one of the two layouts.
const WORKER_SOURCE = `
const fs = require('node:fs');
const { workerData } = require('node:worker_threads');
const beat = new BigInt64Array(workerData.sab);
const stallMs = workerData.stallMs;
// -1 is the pause sentinel written by pause(); a healthy heartbeat is a
// CLOCK_MONOTONIC millisecond stamp and can never be negative.
const PAUSED = -1n;
setInterval(() => {
  const now = process.hrtime.bigint() / 1000000n;
  const last = Atomics.load(beat, 0);
  if (last === PAUSED) return;
  const stalled = now - last;
  if (stalled <= stallMs) return;
  fs.writeSync(2, '[stall-watchdog] main thread blocked for ' + stalled + ' ms (limit ' + stallMs + ') \u2014 exiting so systemd restarts the bar\\n');
  process.kill(process.pid, 'SIGKILL');
}, 1000);
`;

export interface StallWatchdog {
  pause(): void;
  resume(): void;
  stop(): void;
}

// CLOCK_MONOTONIC, not Date.now(): it does not advance while the machine is
// suspended, so waking from suspend can never read as a multi-hour stall. A
// SIGTERM handler could not do this job either \u2014 a blocked main thread runs no
// handlers, which is why this has to be a second thread, and why the kill is
// SIGKILL rather than something polite: systemd's Restart=always is what turns
// the death back into a working bar, and a blocked thread cannot cooperate
// with a graceful shutdown either.
export function startStallWatchdog(opts: { stallMs: number; beatMs?: number }): StallWatchdog {
  const { stallMs } = opts;
  const beatMs = opts.beatMs ?? 1000;

  const sab = new SharedArrayBuffer(8);
  const beat = new BigInt64Array(sab);
  const PAUSED = -1n;

  const nowMs = (): bigint => process.hrtime.bigint() / 1_000_000n;

  // Seed before arming the interval: the buffer starts as all zeroes, and a
  // zero beat reads as "last seen at time 0", which is instantly past the
  // limit. Without this the worker kills a healthy bar one second into startup.
  Atomics.store(beat, 0, nowMs());

  const timer = setInterval(() => Atomics.store(beat, 0, nowMs()), beatMs);
  timer.unref();

  const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { sab, stallMs } });
  worker.unref();

  return {
    pause: () => { Atomics.store(beat, 0, PAUSED); },
    // Fresh beat on the way back: the first tick after a resume would otherwise
    // compare against the pre-suspend stamp and kill the bar.
    resume: () => { Atomics.store(beat, 0, nowMs()); },
    stop: () => {
      clearInterval(timer);
      void worker.terminate();
    },
  };
}