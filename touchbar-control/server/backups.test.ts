import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBackup, listBackups, restoreBackupFile, MAX_BACKUPS } from './backups.ts';

const layout = { rightButtons: ['back'], hidden: [], left: {}, pinnedLeft: null };
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tbc-backups-'));
  const config = path.join(root, 'config.ts');
  fs.writeFileSync(config, 'export const A = 1;\n');
  return { dir: path.join(root, 'backups'), config };
}

test('a backup copies config.ts byte for byte and records why and what', () => {
  const { dir, config } = setup();
  const b = createBackup(config, dir, 'before-apply', layout);
  assert.equal(fs.readFileSync(path.join(dir, `${b.id}.ts`), 'utf8'), 'export const A = 1;\n');
  const [listed] = listBackups(dir);
  assert.equal(listed.id, b.id);
  assert.equal(listed.reason, 'before-apply');
  assert.deepEqual(listed.layout.rightButtons, ['back']);
});

test('backups list newest first and are capped', () => {
  const { dir, config } = setup();
  const ids: string[] = [];
  for (let i = 0; i < MAX_BACKUPS + 3; i++) ids.push(createBackup(config, dir, 'before-apply', layout).id);
  const list = listBackups(dir);
  assert.equal(list.length, MAX_BACKUPS);
  assert.equal(list[0].id, ids[ids.length - 1]);
  assert.ok(!list.some(b => b.id === ids[0]), 'oldest pruned');
});

test('restoring copies the backup over config.ts; unknown or malicious ids are refused', () => {
  const { dir, config } = setup();
  const b = createBackup(config, dir, 'before-apply', layout);
  fs.writeFileSync(config, 'export const A = 2;\n');
  restoreBackupFile(b.id, dir, config);
  assert.equal(fs.readFileSync(config, 'utf8'), 'export const A = 1;\n');
  assert.throws(() => restoreBackupFile('../../etc/passwd', dir, config), /unknown backup/);
  assert.throws(() => restoreBackupFile('nope', dir, config), /unknown backup/);
});
