import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAGES, pageOfSection, SECTION_LABELS, SECTION_NAMES } from './schema.js';

// Unit tests for the renderer's pure modules (REL-04). state.ts and schema.ts
// are DOM-free at import time (document is only touched inside UI functions
// we don't call here), so they import cleanly under tsx --test.

test('schema maps every config section to exactly one page', () => {
  for (const name of SECTION_NAMES) {
    const page = pageOfSection(name);
    assert.ok(page, `${name} must be mapped to a page`);
    assert.equal(page.sections.filter(s => s === name).length, 1, `${name} must appear once`);
  }
  const all = PAGES.flatMap(p => p.sections);
  assert.equal(all.length, new Set(all).size, 'no section may appear on two pages');
});

test('D-01 grouping: SCREENSHOT on shortcuts; DOLPHIN/KONSOLE/CAVA on advanced', () => {
  assert.equal(pageOfSection('SCREENSHOT')?.id, 'shortcuts');
  assert.equal(pageOfSection('DOLPHIN')?.id, 'advanced');
  assert.equal(pageOfSection('KONSOLE')?.id, 'advanced');
  assert.equal(pageOfSection('CAVA')?.id, 'advanced');
  assert.equal(PAGES.find(p => p.id === 'advanced')?.advanced, true);
});

test('every section has a label', () => {
  for (const name of SECTION_NAMES) assert.ok(SECTION_LABELS[name]);
});
