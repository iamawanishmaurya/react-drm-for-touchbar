import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDrop, dragIdToTile } from './drop.ts';
import { fromLayout, hide, RIGHT } from './editModel.ts';
import type { LayoutSchema } from '../../../shared/types.ts';

const schema: LayoutSchema = { right: ['back', 'volume', 'snake'], left: { vscode: { run: ['run', 'stop'] } }, panels: [] };
const base = () => fromLayout({ rightButtons: [], hidden: [], left: {}, pinnedLeft: null }, schema);

test('dropping on a tile inserts before it (same semantics as arrayMove)', () => {
  const s = applyDrop(base(), 'snake', { kind: 'group', group: RIGHT, beforeId: 'back' });
  assert.notEqual(s, 'refused');
  assert.deepEqual((s as ReturnType<typeof base>).order[RIGHT], ['snake', 'back', 'volume']);
});

test('dropping on a group’s empty space appends', () => {
  const s = applyDrop(base(), 'back', { kind: 'group', group: RIGHT }) as ReturnType<typeof base>;
  assert.deepEqual(s.order[RIGHT], ['volume', 'snake', 'back']);
});

test('the tray hides; a hidden tile dropped on its group is shown at that spot', () => {
  let s = applyDrop(base(), 'volume', { kind: 'tray' }) as ReturnType<typeof base>;
  assert.deepEqual(s.hidden[RIGHT], ['volume']);
  s = applyDrop(s, 'volume', { kind: 'group', group: RIGHT, beforeId: 'back' }) as ReturnType<typeof base>;
  assert.deepEqual(s.order[RIGHT], ['volume', 'back', 'snake']);
  assert.deepEqual(s.hidden[RIGHT], []);
});

test('cross-group drops are refused; no-op drops return the same state', () => {
  const s0 = base();
  assert.equal(applyDrop(s0, 'vscode.run', { kind: 'group', group: RIGHT }), 'refused');
  assert.equal(applyDrop(s0, 'snake', { kind: 'group', group: RIGHT, beforeId: 'snake' }), s0);
  const h = hide(s0, 'snake');
  assert.equal(applyDrop(h, 'snake', { kind: 'tray' }), h);
});

test('palette drag ids map back to tile ids', () => {
  assert.equal(dragIdToTile('palette:vscode.run'), 'vscode.run');
  assert.equal(dragIdToTile('volume'), 'volume');
});
