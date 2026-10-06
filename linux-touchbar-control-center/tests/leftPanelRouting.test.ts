import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leftPanelForClass, APP_PREVIEWS } from '../lib/utils/leftPanelRouting';

test('window classes route to their panels', () => {
  assert.equal(leftPanelForClass('firefox'), 'browser');
  assert.equal(leftPanelForClass('Google-chrome'), 'browser');
  assert.equal(leftPanelForClass('code'), 'vscode');
  assert.equal(leftPanelForClass('org.kde.konsole'), 'konsole');
  assert.equal(leftPanelForClass('vlc'), 'vlc');
  assert.equal(leftPanelForClass('org.kde.dolphin'), 'dolphin');
  assert.equal(leftPanelForClass('org.kde.gwenview'), 'gwenview');
  assert.equal(leftPanelForClass('com.mitchellh.ghostty'), 'index');
  assert.equal(leftPanelForClass(''), 'index');
});

test('every app preview has a unique id and routes somewhere', () => {
  assert.equal(new Set(APP_PREVIEWS.map(a => a.id)).size, APP_PREVIEWS.length);
  const expected: Record<string, string> = { firefox: 'browser', chrome: 'browser', vscode: 'vscode', konsole: 'konsole', vlc: 'vlc', dolphin: 'dolphin', gwenview: 'gwenview', desktop: 'index', terminal: 'index', files: 'index' };
  for (const a of APP_PREVIEWS) assert.equal(leftPanelForClass(a.class), expected[a.id], a.id);
});
