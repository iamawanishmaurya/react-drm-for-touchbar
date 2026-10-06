import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLayoutPatch } from '../lib/utils/layoutModel';

// The live socket reuses the sandbox's validation; pin the behaviour it
// relies on (the socket itself needs the full app and is covered end to end).
test('a live patch is validated like a sandbox patch', () => {
  assert.deepEqual(parseLayoutPatch({ rightButtons: ['snake'], hidden: ['vscode.run'] }), { rightButtons: ['snake'], hidden: ['vscode.run'] });
  assert.throws(() => parseLayoutPatch({ hidden: ['rm -rf /'] }), /invalid id/);
  assert.ok('pinnedLeft' in parseLayoutPatch({ pinnedLeft: 'vscode' }), 'pinnedLeft is detected so the live socket can refuse it');
});
