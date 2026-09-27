import type { PageDef } from '../schema.js';

// Page shell helpers shared by all pages.

export function pageHeader(title: string, description: string): HTMLElement {
  const header = document.createElement('div');
  header.className = 'section-header';
  const h = document.createElement('h2');
  h.className = 'section-title';
  h.textContent = title;
  const p = document.createElement('p');
  p.className = 'section-desc';
  p.textContent = description;
  header.append(h, p);
  return header;
}

export function buildPagePanel(def: PageDef): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'section-panel';
  panel.id = `panel-page-${def.id}`;
  panel.appendChild(pageHeader(def.label, def.description));
  return panel;
}
