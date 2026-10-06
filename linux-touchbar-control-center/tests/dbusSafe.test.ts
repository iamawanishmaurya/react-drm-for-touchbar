import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';

// Run in a child with an explicit DBUS address: dbus-next resolves the bus lazily
// and at import time, so the environment has to be right before the module loads.
function runChild(code: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], {
    encoding: 'utf8',
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus',
      DBUS_SYSTEM_BUS_ADDRESS: 'unix:path=/run/dbus/system_bus_socket',
    },
    timeout: 20000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const IMPORT = `const { openBus } = await import(${JSON.stringify(
  path.resolve(import.meta.dirname, '../lib/utils/dbusSafe.ts'),
)});`;

test('openBus attaches an error listener to every bus it opens', () => {
  const r = runChild(`${IMPORT}
    const s = openBus('session', 'test-session');
    const y = openBus('system',  'test-system');
    console.log(JSON.stringify({
      sessionListeners: s.listenerCount('error'),
      systemListeners:  y.listenerCount('error'),
    }));
    process.exit(0);   // the open sockets would otherwise hold the loop open`);
  assert.equal(r.status, 0, `child failed: ${r.stderr}`);
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!);
  assert.equal(out.sessionListeners, 1);
  assert.equal(out.systemListeners, 1);
});

test('a dead bus reports through the handler, not as an uncaughtException', () => {
  const r = runChild(`${IMPORT}
    let uncaught = null;
    process.on('uncaughtException', e => { uncaught = e.code || e.message; });
    const bus = openBus('session', 'test');
    // What dbus-next does when the peer closes the socket mid-handshake.
    bus.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    await new Promise(res => setTimeout(res, 50));
    console.log(JSON.stringify({ uncaught }));
    process.exit(0);   // the open socket would otherwise hold the loop open`);
  assert.equal(r.status, 0, `child failed: ${r.stderr}`);
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!);
  assert.equal(out.uncaught, null, 'a bus error must not become an uncaughtException');
});

test('no call site creates a bus without the handler', () => {
  const out = execFileSync(
    'grep',
    ['-rn', 'dbus.sessionBus()\\|dbus.systemBus()', 'lib'],
    { encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '..') },
  );
  const offenders = out.split('\n').filter(l => l.trim() && !l.includes('dbusSafe.ts'));
  assert.deepEqual(offenders, [], `unguarded bus creation:\n${offenders.join('\n')}`);
});