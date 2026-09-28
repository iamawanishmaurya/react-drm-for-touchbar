import assert from 'node:assert/strict';
import { test } from 'node:test';
import { move, removeAt, insertAt, orderChanged } from './orderModel.js';

test('move reorders within bounds', () => {
  assert.deepEqual(move(['a', 'b', 'c', 'd'], 0, 3), ['b', 'c', 'd', 'a']);
  assert.deepEqual(move(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
});

test('move same index is a no-op; out-of-range from returns a copy', () => {
  const l = ['a', 'b'];
  assert.deepEqual(move(l, 1, 1), ['a', 'b']);
  assert.deepEqual(move(l, 9, 0), ['a', 'b']);
  assert.notEqual(move(l, 1, 1), l);
});

test('move clamps destination', () => {
  assert.deepEqual(move(['a', 'b', 'c'], 0, 99), ['b', 'c', 'a']);
  assert.deepEqual(move(['a', 'b', 'c'], 2, -5), ['c', 'a', 'b']);
});

test('removeAt and insertAt', () => {
  assert.deepEqual(removeAt(['a', 'b', 'c'], 1), ['a', 'c']);
  assert.deepEqual(removeAt(['a'], 5), ['a']);
  assert.deepEqual(insertAt(['a', 'c'], 1, 'b'), ['a', 'b', 'c']);
  assert.deepEqual(insertAt(['b'], 99, 'a'), ['b', 'a']);
});

test('orderChanged detects length and position differences', () => {
  assert.equal(orderChanged(['a', 'b'], ['a', 'b']), false);
  assert.equal(orderChanged(['a', 'b'], ['b', 'a']), true);
  assert.equal(orderChanged(['a'], ['a', 'b']), true);
});
