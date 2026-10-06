import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builtInPresets } from './presets.ts';
import type { LayoutSchema } from '../../../shared/types.ts';

const schema: LayoutSchema = {
  right: ['back', 'volume', 'brightness', 'linux', 'playpause', 'screenshot', 'snake'],
  left: { vscode: { run: ['run', 'stop'] } },
  panels: [],
};

test('built-in presets only reference buttons the schema knows', () => {
  const known = new Set(schema.right);
  for (const p of builtInPresets(schema)) {
    for (const id of [...p.layout.rightButtons, ...p.layout.hidden]) assert.ok(known.has(id) || id.includes('.'), `${p.name}: ${id}`);
    assert.equal(p.layout.pinnedLeft, null);
  }
});

test('the Default preset is the built-in order with nothing hidden', () => {
  const d = builtInPresets(schema).find(p => p.id === 'builtin:default')!;
  assert.deepEqual(d.layout.rightButtons, schema.right);
  assert.deepEqual(d.layout.hidden, []);
  assert.deepEqual(d.layout.left, { vscode: { run: ['run', 'stop'] } });
});

test('presets degrade gracefully when a button is missing from the schema', () => {
  const small: LayoutSchema = { right: ['volume', 'playpause'], left: {}, panels: [] };
  for (const p of builtInPresets(small)) {
    for (const id of [...p.layout.rightButtons, ...p.layout.hidden]) assert.ok(small.right.includes(id), `${p.name}: ${id}`);
  }
});
