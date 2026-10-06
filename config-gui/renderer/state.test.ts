import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setPath, uniqueAppId, humanize, store } from './state.js';

// Unit tests for the renderer's pure state helpers (REL-04).

test('setPath writes nested paths on the store', () => {
  Object.assign(store, { DOCK: { icons: { theme: null } } });
  setPath(['DOCK', 'icons', 'theme'], 'breeze');
  assert.equal((store.DOCK as Record<string, any>).icons.theme, 'breeze');
});

test('setPath requires existing intermediate objects (as in the original)', () => {
  Object.assign(store, { DOCK: {} });
  setPath(['DOCK', 'gap'], 14);
  assert.equal((store.DOCK as Record<string, unknown>).gap, 14);
});

test('uniqueAppId appends -2, -3 until unique', () => {
  assert.equal(uniqueAppId('firefox', []), 'firefox');
  assert.equal(uniqueAppId('firefox', [{ id: 'firefox' }]), 'firefox-2');
  assert.equal(uniqueAppId('firefox', [{ id: 'firefox' }, { id: 'firefox-2' }]), 'firefox-3');
});

test('humanize splits camelCase and capitalizes', () => {
  assert.equal(humanize('iconSize'), 'Icon Size');
  assert.equal(humanize('maxPlaces'), 'Max Places');
  assert.equal(humanize('on'), 'On');
});

