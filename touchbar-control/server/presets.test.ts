import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listPresets, savePreset, deletePreset } from './presets.ts';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tbc-presets-')), 'presets.json');
const layout = { rightButtons: ['snake', 'back'], hidden: [], left: {} };

test('an absent file means no presets', () => {
  assert.deepEqual(listPresets(tmpFile()), []);
});

test('save, overwrite by name, and delete', () => {
  const f = tmpFile();
  savePreset({ name: 'Work', layout }, f);
  savePreset({ name: 'Play', layout }, f);
  let list = savePreset({ name: 'Work', layout: { ...layout, hidden: ['volume'] } }, f);
  assert.deepEqual(list.map(p => p.name), ['Play', 'Work']);
  assert.deepEqual(list.find(p => p.name === 'Work')!.layout.hidden, ['volume']);
  list = deletePreset('Play', f);
  assert.deepEqual(list.map(p => p.name), ['Work']);
  assert.deepEqual(listPresets(f).map(p => p.name), ['Work'], 'persisted');
});

test('bad input is rejected; a corrupted entry on disk is skipped', () => {
  const f = tmpFile();
  assert.throws(() => savePreset({ name: '  ', layout }, f), /empty/);
  assert.throws(() => savePreset({ name: 'x'.repeat(61), layout }, f), /longer/);
  assert.throws(() => savePreset({ name: 'ok', layout: { hidden: 'nope' } }, f), /hidden/);
  fs.writeFileSync(f, JSON.stringify([{ name: 'good', layout }, { name: 'bad', layout: { rightButtons: 5 } }]));
  assert.deepEqual(listPresets(f).map(p => p.name), ['good']);
});
