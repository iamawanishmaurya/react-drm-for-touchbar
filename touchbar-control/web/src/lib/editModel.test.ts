import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromLayout, toLayout, moveTo, hide, show, locate, sameLayout, groupsFor, RIGHT } from './editModel.ts';
import type { BarLayout, LayoutSchema } from '../../../shared/types.ts';

const schema: LayoutSchema = {
  right: ['back', 'volume', 'brightness', 'snake'],
  left: { vscode: { run: ['run', 'stop'], edit: ['undo', 'redo'] } },
  panels: ['index', 'vscode'],
};
const empty: BarLayout = { rightButtons: [], hidden: [], left: {}, pinnedLeft: null };

test('an empty layout yields the built-in order with page-qualified left ids', () => {
  const s = fromLayout(empty, schema);
  assert.deepEqual(s.order[RIGHT], ['back', 'volume', 'brightness', 'snake']);
  assert.deepEqual(s.order['vscode:run'], ['vscode.run', 'vscode.stop']);
  assert.deepEqual(s.hidden[RIGHT], []);
});

test('config order and hidden ids are honoured', () => {
  const s = fromLayout({ ...empty, rightButtons: ['snake', 'back'], hidden: ['volume', 'vscode.stop'] }, schema);
  assert.deepEqual(s.order[RIGHT], ['snake', 'back', 'brightness']);
  assert.deepEqual(s.hidden[RIGHT], ['volume']);
  assert.deepEqual(s.hidden['vscode:run'], ['vscode.stop']);
});

test('toLayout round-trips and keeps hidden ids listed after the visible ones', () => {
  const layout: BarLayout = { rightButtons: ['snake', 'back', 'volume', 'brightness'], hidden: ['volume'], left: { vscode: { run: ['stop', 'run'], edit: ['undo', 'redo'] } }, pinnedLeft: null };
  const out = toLayout(fromLayout(layout, schema), schema);
  assert.deepEqual(out.rightButtons, ['snake', 'back', 'brightness', 'volume']);
  assert.deepEqual(out.hidden, ['volume']);
  assert.deepEqual(out.left.vscode.run, ['stop', 'run']);
});

test('moveTo reorders within a group', () => {
  const s = moveTo(fromLayout(empty, schema), 'snake', RIGHT, 0);
  assert.deepEqual(s.order[RIGHT], ['snake', 'back', 'volume', 'brightness']);
});

test('moveTo refuses to move a tile into another group', () => {
  const s0 = fromLayout(empty, schema);
  assert.equal(moveTo(s0, 'vscode.run', RIGHT, 0), s0);
  assert.equal(moveTo(s0, 'vscode.run', 'vscode:edit', 0), s0);
});

test('hide then show returns the tile to its own group', () => {
  let s = hide(fromLayout(empty, schema), 'volume');
  assert.deepEqual(s.order[RIGHT], ['back', 'brightness', 'snake']);
  assert.deepEqual(locate(s, 'volume'), { key: RIGHT, hidden: true, index: 0 });
  s = show(s, 'volume');
  assert.deepEqual(s.order[RIGHT], ['back', 'brightness', 'snake', 'volume']);
  // Dropping a hidden tile at a position shows it there.
  s = moveTo(hide(s, 'back'), 'back', RIGHT, 1);
  assert.deepEqual(s.order[RIGHT], ['brightness', 'back', 'snake', 'volume']);
});

test('sameLayout ignores pinnedLeft and spelling differences that resolve identically', () => {
  assert.ok(sameLayout(empty, { ...empty, rightButtons: ['back', 'volume', 'brightness', 'snake'], pinnedLeft: 'vscode' }, schema));
  assert.ok(!sameLayout(empty, { ...empty, hidden: ['snake'] }, schema));
});

test('groupsFor lists the right cluster first, then every left group', () => {
  assert.deepEqual(groupsFor(schema).map(g => g.key), [RIGHT, 'vscode:run', 'vscode:edit']);
});
