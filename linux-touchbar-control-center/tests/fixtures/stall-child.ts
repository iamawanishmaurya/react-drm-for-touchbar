// Child process for tests/stallWatchdog.test.ts. Spawned by that suite, never
// imported by it. Relative imports only: this runs under `--import tsx` with no
// tsconfig of its own, so the `@/*` alias would not resolve.
import { startStallWatchdog } from '../../lib/services/stallWatchdog';

const stallMs = Number(process.argv[2]);
const mode = process.argv[3];

// 200 ms heartbeat, not the 1000 ms default: the suite drives the limit down to
// 1000 ms, where a 1000 ms heartbeat leaves a zero margin and the jitter between
// two independent 1000 ms timers decides the `short` case. Worst stale beat is
// then 600 + 200 = 800 ms, a 200 ms margin under the limit. The bar itself keeps
// the default.
const watchdog = startStallWatchdog({ stallMs, beatMs: 200 });

// A busy loop, not a blocking syscall: this is what a stuck render loop or a
// deadlocked native binding looks like from the outside — the thread never
// yields and never reaches another timer callback.
function block(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) { /* pretend this is the bar's render loop */ }
}

switch (mode) {
  case 'block':
    // No way back out: only the watchdog can end this child. The block starts
    // 200 ms in so the heartbeat is definitely fresh when it begins.
    setTimeout(() => { for (;;) { /* blocked forever */ } }, 200);
    break;
  case 'short':
    // A hitch under the limit must NOT kill the bar — this is the
    // false-positive guard for the 15 s production number.
    setTimeout(() => block(600), 200);
    // Holds the event loop open so the heartbeat keeps ticking. Empty on
    // purpose, and no process.exit anywhere: when this fires and nothing else
    // is ref'd, node exits by itself with 0 — which is the point of `idle`.
    setTimeout(() => {}, 2500);
    break;
  case 'idle':
    setTimeout(() => {}, 2500);
    break;
  case 'paused':
    // Must survive a stall LONGER than the limit, or every suspend/resume would
    // read as a freeze and kill the bar.
    watchdog.pause();
    block(2500);
    watchdog.stop();
    break;
  default:
    throw new Error(`unknown mode: ${mode}`);
}