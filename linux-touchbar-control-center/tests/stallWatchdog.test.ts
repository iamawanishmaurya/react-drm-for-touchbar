import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, 'fixtures', 'stall-child.ts');

// Anchored at both ends. This alone is not enough: a pattern that matches
// nothing still makes node print "pass 1" and exit 0, counting the whole FILE
// as one passing test. The red-before-green run therefore also checks the check
// line text — a matched test prints its title, an unmatched one prints a path.
export const BLOCK_TEST_NAME = 'stall watchdog SIGKILLs a bar whose main thread blocks';
export const BLOCK_TEST_RE = `^${BLOCK_TEST_NAME}$`;

function run(stallMs: number, mode: string, timeout: number) {
  return spawnSync(process.execPath, ['--import', 'tsx', FIXTURE, String(stallMs), mode], {
    encoding: 'utf8',
    timeout,
  });
}

test(BLOCK_TEST_NAME, () => {
  const t0 = performance.now();
  const r = run(1000, 'block', 6000);
  const ms = performance.now() - t0;
  // Asserted FIRST and on its own: with the watchdog's kill line commented out
  // the child is never killed, spawnSync times out at 6 s and SIGTERMs it, so
  // this must be the assertion that reports "the watchdog did not fire" rather
  // than the spawn error underneath it.
  assert.equal(r.signal, 'SIGKILL',
    `child was NOT killed by the watchdog — signal=${r.signal} status=${r.status} spawnError=${r.error && r.error.code} after ${ms.toFixed(0)}ms`);
  assert.equal(r.error, undefined, `spawnSync error: ${r.error && r.error.code}`);
  assert.ok(ms < 6000, `the watchdog took ${ms.toFixed(0)}ms to notice a blocked main thread`);
  assert.match(r.stderr, /\[stall-watchdog\] main thread blocked for \d+ ms \(limit 1000\)/, r.stderr);
});

test('a hitch shorter than the limit does not kill the bar', () => {
  const r = run(1000, 'short', 15000);
  assert.equal(r.signal, null, `child was killed by ${r.signal}: ${r.stderr}`);
  assert.equal(r.status, 0, `child exited ${r.status}: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, /\[stall-watchdog\]/, r.stderr);
});

test('an idle bar exits on its own — the watchdog holds nothing open', () => {
  const r = run(1000, 'idle', 15000);
  assert.equal(r.signal, null, `child was killed by ${r.signal}: ${r.stderr}`);
  assert.equal(r.status, 0, `child exited ${r.status}: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, /\[stall-watchdog\]/, r.stderr);
});

test('a paused bar survives a stall longer than the limit', () => {
  const r = run(1000, 'paused', 15000);
  assert.equal(r.signal, null, `child was killed by ${r.signal} — pause() did not hold`);
  assert.equal(r.status, 0, `child exited ${r.status}: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, /\[stall-watchdog\]/, r.stderr);
});