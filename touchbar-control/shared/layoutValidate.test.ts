import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLayout } from './layoutValidate.ts';

test('parseLayout accepts a full layout and fills missing parts', () => {
  assert.deepEqual(parseLayout({ rightButtons: ['snake'] }), { rightButtons: ['snake'], hidden: [], left: {}, pinnedLeft: null });
  assert.deepEqual(
    parseLayout({ rightButtons: [], hidden: ['vscode.run'], left: { vscode: { run: ['stop', 'run'] } }, pinnedLeft: 'vscode' }),
    { rightButtons: [], hidden: ['vscode.run'], left: { vscode: { run: ['stop', 'run'] } }, pinnedLeft: null },
    'pinnedLeft is a viewing aid and never survives a load',
  );
});

test('parseLayout rejects malformed input with a readable message', () => {
  assert.throws(() => parseLayout(null), /object/);
  assert.throws(() => parseLayout({ rightButtons: 'back' }), /rightButtons/);
  assert.throws(() => parseLayout({ hidden: ['<script>'] }), /invalid id/);
  assert.throws(() => parseLayout({ left: { vscode: ['run'] } }), /left\.vscode/);
  assert.throws(() => parseLayout({ rightButtons: Array(300).fill('a') }), /too many/);
});
