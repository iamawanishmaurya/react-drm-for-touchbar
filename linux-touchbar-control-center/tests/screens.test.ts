import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BAR_SCREENS, isBarScreen } from '../lib/utils/screens';

test('every listed screen is a real app route', () => {
  for (const s of BAR_SCREENS) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'app', s.id, 'page.tsx')) || fs.existsSync(path.join(__dirname, '..', 'app', s.id, 'layout.tsx')), s.id);
  }
});

test('isBarScreen accepts listed ids only (the lock screen is excluded)', () => {
  assert.ok(isBarScreen('dock'));
  assert.ok(!isBarScreen('lock'));
  assert.ok(!isBarScreen('../etc'));
  assert.ok(!isBarScreen(3));
});
