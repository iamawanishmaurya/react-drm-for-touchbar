import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrder, parseLayoutPatch, layoutFromConfig, leftButtonId } from '../lib/utils/layoutModel';

const BUILT_IN = ['a', 'b', 'c', 'd'] as const;

test('empty or missing config keeps the built-in order', () => {
  assert.deepEqual(resolveOrder(undefined, BUILT_IN), ['a', 'b', 'c', 'd']);
  assert.deepEqual(resolveOrder([], BUILT_IN), ['a', 'b', 'c', 'd']);
});

test('configured order wins; missing built-ins are appended; unknown ids and duplicates drop', () => {
  assert.deepEqual(resolveOrder(['c', 'zzz', 'a', 'c'], BUILT_IN), ['c', 'a', 'b', 'd']);
});

test('hidden ids are removed after ordering, compared through idOf', () => {
  assert.deepEqual(resolveOrder(['d', 'a'], BUILT_IN, new Set(['a'])), ['d', 'b', 'c']);
  assert.deepEqual(
    resolveOrder(undefined, BUILT_IN, new Set(['p.b', 'b']), k => leftButtonId('p', k)),
    ['a', 'c', 'd'],
  );
});

test('parseLayoutPatch returns only the fields present', () => {
  assert.deepEqual(parseLayoutPatch({ rightButtons: ['snake', 'back'] }), { rightButtons: ['snake', 'back'] });
  assert.deepEqual(parseLayoutPatch({ pinnedLeft: null, hidden: ['vscode.run'] }), { pinnedLeft: null, hidden: ['vscode.run'] });
  assert.deepEqual(
    parseLayoutPatch({ left: { vscode: { run: ['stop', 'run'] } } }),
    { left: { vscode: { run: ['stop', 'run'] } } },
  );
});

test('parseLayoutPatch rejects malformed input', () => {
  assert.throws(() => parseLayoutPatch(null), /object/);
  assert.throws(() => parseLayoutPatch({ rightButtons: 'back' }), /array/);
  assert.throws(() => parseLayoutPatch({ hidden: ['bad id!'] }), /invalid id/);
  assert.throws(() => parseLayoutPatch({ left: { vscode: ['run'] } }), /object/);
  assert.throws(() => parseLayoutPatch({ pinnedLeft: 5 }), /pinnedLeft/);
  assert.throws(() => parseLayoutPatch({ rightButtons: Array(200).fill('a') }), /too many/);
});

test('layoutFromConfig tolerates absent sections (old config.ts)', () => {
  assert.deepEqual(layoutFromConfig(undefined, undefined), { rightButtons: [], hidden: [], left: {}, pinnedLeft: null });
  assert.deepEqual(
    layoutFromConfig({ rightButtons: ['snake'] }, { vscode: { run: ['stop'] } }),
    { rightButtons: ['snake'], hidden: [], left: { vscode: { run: ['stop'] } }, pinnedLeft: null },
  );
});
