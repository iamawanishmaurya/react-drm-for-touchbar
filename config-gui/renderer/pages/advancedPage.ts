import { section } from '../state.js';
import { renderGenericObject } from '../widgets/fieldRow.js';
import { buildPagePanel } from './page.js';
import { SECTION_LABELS, SECTION_DESCRIPTIONS, UNION_FIELDS } from '../schema.js';
import type { PageDef } from '../schema.js';

// Advanced page (hidden by default, per CONTEXT D-01): DOLPHIN, KONSOLE, CAVA.

export function renderAdvancedPage(def: PageDef): HTMLElement {
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
    renderGenericObject(fieldset, value, [name], UNION_FIELDS);
  }
  return panel;
}
