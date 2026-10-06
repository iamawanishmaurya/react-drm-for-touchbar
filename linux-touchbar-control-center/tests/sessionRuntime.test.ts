import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionRuntimeDir } from '../lib/utils/sessionRuntime';

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved = { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, SUDO_UID: process.env.SUDO_UID };
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { fn(); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

test('XDG_RUNTIME_DIR wins', () => {
  withEnv({ XDG_RUNTIME_DIR: '/run/user/1234', SUDO_UID: '999' }, () => assert.equal(sessionRuntimeDir(), '/run/user/1234'));
});

test('then the sudo caller, then the process uid — never a hardcoded 1000', () => {
  withEnv({ XDG_RUNTIME_DIR: undefined, SUDO_UID: '1234' }, () => assert.equal(sessionRuntimeDir(), '/run/user/1234'));
  withEnv({ XDG_RUNTIME_DIR: undefined, SUDO_UID: undefined }, () => {
    const uid = process.getuid!();
    if (uid !== 0) assert.equal(sessionRuntimeDir(), `/run/user/${uid}`);
  });
});
