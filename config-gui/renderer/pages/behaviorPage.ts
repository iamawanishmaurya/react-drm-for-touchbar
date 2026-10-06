import { section } from '../state.js';
import { renderGenericObject } from '../widgets/fieldRow.js';
import { buildPagePanel } from './page.js';
import { renderSectionCustom } from './shortcutsPage.js';
import { SECTION_LABELS, SECTION_DESCRIPTIONS, UNION_FIELDS } from '../schema.js';
import type { PageDef } from '../schema.js';

// Behavior page: DISPLAY, SLEEP, LAYER_TRANSITION, ACTIVE_WINDOW, SYSTEMBAR,
// ESC_KEY, FN_LAYER, FN_KEYS. Keymap-style sections are not expected here,
// but the custom renderer is checked anyway so re-grouping can't silently
// lose a bespoke editor.

export function renderBehaviorPage(def: PageDef): HTMLElement {
  const panel = buildPagePanel(def);
  for (const name of def.sections) {
    const value = section(name);
    if (!value) continue;
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = SECTION_LABELS[name];
    fieldset.appendChild(legend);
    const desc = document.createElement('p');
    desc.className = 'section-desc';
    desc.textContent = SECTION_DESCRIPTIONS[name];
    fieldset.appendChild(desc);
    panel.appendChild(fieldset);
    if (!renderSectionCustom(name, fieldset, value)) {
      renderGenericObject(fieldset, value, [name], UNION_FIELDS);
    }
  }
  return panel;
}
