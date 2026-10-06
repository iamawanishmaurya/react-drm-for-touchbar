import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendMoving, insertMovingBefore } from '../src/renderer/child-order';

test('appendMoving moves an existing child to the end instead of duplicating it', () => {
  const arr = ['a', 'b', 'c'];
  appendMoving(arr, 'a');
  assert.deepEqual(arr, ['b', 'c', 'a']);
  appendMoving(arr, 'd');
  assert.deepEqual(arr, ['b', 'c', 'a', 'd']);
});

test('insertMovingBefore moves an existing child in front of `before`', () => {
  const arr = ['back', 'volume', 'linux', 'snake'];
  insertMovingBefore(arr, 'snake', 'back');           // React's move for [snake, back, …]
  assert.deepEqual(arr, ['snake', 'back', 'volume', 'linux']);
  insertMovingBefore(arr, 'back', 'linux');           // move forward past its old slot
  assert.deepEqual(arr, ['snake', 'volume', 'back', 'linux']);
});

test('insertMovingBefore inserts a new child, falling back to the front when `before` is unknown', () => {
  const arr = ['a', 'b'];
  insertMovingBefore(arr, 'x', 'b');
  assert.deepEqual(arr, ['a', 'x', 'b']);
  insertMovingBefore(arr, 'y', 'missing');
  assert.deepEqual(arr, ['y', 'a', 'x', 'b']);
});
