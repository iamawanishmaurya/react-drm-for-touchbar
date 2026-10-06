import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutToConfigChanges, layoutFromConfigSnapshot } from './layoutConfig.ts';

test('layoutToConfigChanges drops pinnedLeft and empty groups', () => {
  const out = layoutToConfigChanges({
    rightButtons: ['snake', 'back'], hidden: ['volume'],
    left: { vscode: { run: ['stop', 'run'], edit: [] }, browser: {} }, pinnedLeft: 'vscode',
  });
  assert.deepEqual(out, {
    BAR_LAYOUT: { rightButtons: ['snake', 'back'], hidden: ['volume'] },
    LEFT_LAYOUT: { vscode: { run: ['stop', 'run'] } },
  });
});

test('layoutFromConfigSnapshot tolerates a config without the sections', () => {
  assert.deepEqual(layoutFromConfigSnapshot({}), { rightButtons: [], hidden: [], left: {}, pinnedLeft: null });
  assert.deepEqual(
    layoutFromConfigSnapshot({ BAR_LAYOUT: { rightButtons: ['back'] }, LEFT_LAYOUT: { vscode: { run: ['stop'] } } }),
    { rightButtons: ['back'], hidden: [], left: { vscode: { run: ['stop'] } }, pinnedLeft: null },
  );
});

import { configText } from './layoutConfig.ts';

test('configText renders exactly the sections Apply writes, as TypeScript', () => {
  const text = configText({
    rightButtons: ['snake', 'back'], hidden: ['volume'],
    left: { vscode: { run: ['stop', 'run'], edit: [] } }, pinnedLeft: 'vscode',
  });
  assert.equal(text, [
    'export const BAR_LAYOUT = {',
    "  rightButtons: ['snake', 'back'],",
    "  hidden: ['volume'] as string[],",
    '};',
    '',
    'export const LEFT_LAYOUT = {',
    '  vscode: {',
    "    run: ['stop', 'run'],",
    '  },',
    '};',
    '',
  ].join('\n'));
});

test('configText with nothing arranged on the left', () => {
  assert.match(configText({ rightButtons: [], hidden: [], left: {}, pinnedLeft: null }), /export const LEFT_LAYOUT = \{\};/);
});
