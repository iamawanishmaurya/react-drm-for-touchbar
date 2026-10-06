import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportLayoutFile, parseLayoutFile } from './layoutFile.ts';

const layout = { rightButtons: ['snake', 'back'], hidden: ['volume'], left: { vscode: { run: ['stop'] } }, pinnedLeft: 'vscode' };

test('export → parse round-trips and drops pinnedLeft', () => {
  const text = exportLayoutFile(layout);
  assert.match(text, /"format": "touchbar-control\/layout"/);
  assert.deepEqual(parseLayoutFile(text), { ...layout, pinnedLeft: null });
});

test('parseLayoutFile explains what is wrong with a bad file', () => {
  assert.throws(() => parseLayoutFile('not json'), /not valid JSON/);
  assert.throws(() => parseLayoutFile('{"hello":1}'), /not a touchbar-control layout/);
  assert.throws(() => parseLayoutFile(JSON.stringify({ format: 'touchbar-control/layout', version: 99, layout })), /version 99/);
  assert.throws(() => parseLayoutFile(JSON.stringify({ format: 'touchbar-control/layout', version: 1, layout: { hidden: 3 } })), /hidden/);
});
