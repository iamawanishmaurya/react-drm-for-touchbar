import { buildPagePanel } from './page.js';
import type { PageDef } from '../schema.js';

// Layout page — placeholder until Phase 3 delivers drag-and-drop editing (D-02).

export function renderLayoutPage(def: PageDef): HTMLElement {
  const panel = buildPagePanel(def);
  const placeholder = document.createElement('div');
  placeholder.className = 'empty-state';
  placeholder.textContent = 'Drag-and-drop layout editing is coming in the next update.';
  panel.appendChild(placeholder);
  return panel;
}
