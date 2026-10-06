import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, push, undo, redo, canUndo, canRedo } from './history.ts';

test('push records the previous state and clears redo', () => {
  let h = createHistory(1);
  h = push(h, 2);
  h = push(h, 3);
  assert.equal(h.present, 3);
  assert.deepEqual(h.past, [1, 2]);
  h = undo(h);
  assert.equal(h.present, 2);
  assert.ok(canRedo(h));
  h = push(h, 9);
  assert.deepEqual(h.future, [], 'a new edit drops the redo branch');
});

test('undo and redo walk back and forth; no-ops at the ends', () => {
  let h = push(push(createHistory('a'), 'b'), 'c');
  h = undo(undo(h));
  assert.equal(h.present, 'a');
  assert.ok(!canUndo(h));
  assert.equal(undo(h), h, 'undo at the start returns the same history');
  h = redo(redo(h));
  assert.equal(h.present, 'c');
  assert.equal(redo(h), h, 'redo at the end returns the same history');
});

test('pushing the identical state is not an edit', () => {
  const h = createHistory({ n: 1 });
  assert.equal(push(h, h.present), h);
});

test('history is capped, dropping the oldest states', () => {
  let h = createHistory(0);
  for (let i = 1; i <= 10; i++) h = push(h, i, 3);
  assert.deepEqual(h.past, [7, 8, 9]);
  assert.equal(h.present, 10);
});
