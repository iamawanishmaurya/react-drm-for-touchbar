import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// The only top-level import of app code in this file: the four parsers are
// pulled in with a dynamic await import() inside each test, because the
// red-before-green run swaps volume.ts back to its pre-fix version where those
// exports don't exist yet — a top-level import would fail at module load and
// take the hung-wpctl test down with it, proving nothing.
import { execQuick, commandExists, EXEC_TIMEOUT_MS } from '../lib/services/execQuick';

const APP_DIR = path.resolve(__dirname, '..');
const svc = (name: string) => path.join(APP_DIR, 'lib', 'services', name);

// Anchored at both ends on purpose. Filtering the suite down to the hung test
// with a loose pattern such as `hung` can match nothing, and node then reports
// "pass 1" and exits 0 — a green-looking red run that proves nothing.
export const HUNG_TEST_NAME = 'execQuick keeps the last volume when wpctl hangs';
export const HUNG_TEST_RE = `^${HUNG_TEST_NAME}$`;

test('execQuick returns stdout from a command that finishes in time', () => {
  assert.equal(execQuick('echo', ['hi']), 'hi\n');
});

test('execQuick kills a hung command instead of blocking the bar thread', () => {
  const t0 = performance.now();
  assert.throws(() => execQuick('sleep', ['10']));
  const ms = performance.now() - t0;
  assert.ok(ms < 3000, `hung command blocked for ${ms.toFixed(0)}ms`);
});

test('commandExists finds a binary on PATH without running it', () => {
  assert.equal(commandExists('sh'), true);
  assert.equal(commandExists('definitely-not-a-command-xyz'), false);
  assert.equal(commandExists('sh', ''), false);
});

test('REACT_DRM_EXEC_TIMEOUT_MS overrides the default timeout', () => {
  // The constant is read once at module load, so it has to be a spawned child.
  const code = `import(${JSON.stringify(svc('execQuick.ts'))})`
    + `.then(m => console.log(m.EXEC_TIMEOUT_MS))`;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], {
    env: { ...process.env, REACT_DRM_EXEC_TIMEOUT_MS: '200' },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '200');
});

test(HUNG_TEST_NAME, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'execquick-'));
  const wpctl = path.join(dir, 'wpctl');
  try {
    fs.writeFileSync(wpctl, [
      '#!/bin/sh',
      'if [ -e "$FAKE_DIR/hang" ]; then sleep 30; fi',
      'echo "Volume: 0.40"',
      '',
    ].join('\n'));
    fs.chmodSync(wpctl, 0o755);

    // cwd = APP_DIR is what lets tsx pick up the app tsconfig, so the
    // `@/lib/utils/sessionRuntime` import inside volume.ts resolves.
    const code = [
      '(async () => {',
      `  const { readVolume } = await import(${JSON.stringify(svc('volume.ts'))});`,
      `  const { writeFileSync } = await import('node:fs');`,
      '  const first = readVolume();',
      `  writeFileSync(${JSON.stringify(path.join(dir, 'hang'))}, '');`,
      '  const t0 = performance.now();',
      '  const second = readVolume();',
      '  const ms = performance.now() - t0;',
      '  console.log(JSON.stringify({ first, second, ms }));',
      '})().catch(e => { console.error(e && e.stack || String(e)); process.exit(3); });',
    ].join('\n');

    const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], {
      cwd: APP_DIR,
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_DIR: dir },
    });

    assert.equal(r.error, undefined, `spawnSync error: ${r.error}`);
    assert.equal(r.signal, null, `child was killed by signal ${r.signal} — the hung wpctl never came back`);
    assert.equal(r.status, 0, `child exited ${r.status}: ${r.stderr}`);

    const out = JSON.parse(r.stdout.trim());
    assert.equal(out.first, 0.4, 'fake wpctl volume was not read');
    assert.equal(out.second, 0.4, 'timed-out read must return the last known volume, not a fresh 0.5');
    assert.ok(out.ms < 3000, `hung wpctl blocked the child for ${out.ms.toFixed(0)}ms`);
  } finally {
    // SIGKILL goes to the `sh` process, which can leave an orphaned `sleep 30`
    // running for up to 30s. Harmless, and deliberately not asserted on.
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parseWpctlVolume reads the number, tolerates [MUTED], nulls on garbage', async () => {
  const { parseWpctlVolume } = await import('../lib/services/volume');
  assert.equal(parseWpctlVolume('Volume: 0.40'), 0.4);
  assert.equal(parseWpctlVolume('Volume: 0.80 [MUTED]'), 0.8);
  assert.equal(parseWpctlVolume('garbage'), null);
});

test('parsePactlVolume reads the percentage, nulls on garbage', async () => {
  const { parsePactlVolume } = await import('../lib/services/volume');
  assert.equal(parsePactlVolume('Volume: front-left: 65536 /  80% / -1.00 dB'), 0.8);
  assert.equal(parsePactlVolume('no match here'), null);
});

test('parseWpctlMuted is tri-state: [MUTED] true, plain volume false, garbage null', async () => {
  const { parseWpctlMuted } = await import('../lib/services/mic');
  assert.equal(parseWpctlMuted('Volume: 0.40 [MUTED]'), true);
  assert.equal(parseWpctlMuted('Volume: 0.40'), false);
  assert.equal(parseWpctlMuted('garbage'), null);
});

test('parsePactlMuted is tri-state: yes true, no false, garbage null', async () => {
  const { parsePactlMuted } = await import('../lib/services/mic');
  assert.equal(parsePactlMuted('Mute: yes'), true);
  assert.equal(parsePactlMuted('Mute: no'), false);
  assert.equal(parsePactlMuted('garbage'), null);
});
