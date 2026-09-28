import { store } from './state.js';
import { PAGES, type PageDef, type PageId } from './schema.js';
import { renderLayoutPage } from './pages/layoutPage.js';
import { renderDockPage } from './pages/dockPage.js';
import { renderShortcutsPage } from './pages/shortcutsPage.js';
import { renderBehaviorPage } from './pages/behaviorPage.js';
import { renderAdvancedPage } from './pages/advancedPage.js';

// Sidebar nav: five page buttons, Advanced collapsed by default (persisted in
// localStorage), and a search that filters page labels across ALL pages — a
// match on the hidden Advanced page reveals it (D-03).

const ADVANCED_KEY = 'config-gui.advanced-visible';

function advancedVisible(): boolean {
  return localStorage.getItem(ADVANCED_KEY) === '1';
}

function setAdvancedVisible(v: boolean): void {
  localStorage.setItem(ADVANCED_KEY, v ? '1' : '0');
  applyNavVisibility();
}

function applyNavVisibility(): void {
  const vis = advancedVisible();
  const search = document.getElementById('search-input') as HTMLInputElement | null;
  const q = search?.value.trim().toLowerCase() ?? '';
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(btn => {
    const page = PAGES.find(p => p.id === btn.dataset.page);
    if (!page) return;
    if (q) {
      // Searching: show every page whose label matches; Advanced matches reveal it.
      btn.classList.toggle('hidden', !(page.label.toLowerCase().includes(q)));
    } else {
      btn.classList.toggle('hidden', !!(page.advanced && !vis));
    }
  });
  const toggle = document.getElementById('advanced-toggle')!;
  toggle.textContent = vis ? 'Hide Advanced' : 'Advanced';
}

const PAGE_RENDERERS: Record<PageId, (def: PageDef) => HTMLElement> = {
  layout: renderLayoutPage,
  dock: renderDockPage,
  shortcuts: renderShortcutsPage,
  behavior: renderBehaviorPage,
  advanced: renderAdvancedPage,
};

let currentPage: PageId = 'behavior';

export function buildPages(): void {
  const content = document.getElementById('content')!;
  content.innerHTML = '';
  for (const def of PAGES) {
    if (def.sections.length > 0 && def.sections.every(s => store[s] === undefined)) continue;
    content.appendChild(PAGE_RENDERERS[def.id](def));
  }
}

export function showPage(id: PageId): void {
  currentPage = id;
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === id);
  });
  document.querySelectorAll('.section-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-page-${id}`);
  });
}

export function buildNav(): void {
  const nav = document.getElementById('nav')!;
  nav.innerHTML = '';
  for (const def of PAGES) {
    if (def.sections.length > 0 && def.sections.every(s => store[s] === undefined)) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-item';
    btn.textContent = def.label;
    btn.dataset.page = def.id;
    btn.addEventListener('click', () => showPage(def.id));
    nav.appendChild(btn);
  }

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'nav-group';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'advanced-toggle';
  toggle.className = 'nav-item nav-advanced-toggle';
  toggle.addEventListener('click', () => setAdvancedVisible(!advancedVisible()));
  toggleWrap.appendChild(toggle);
  nav.appendChild(toggleWrap);

  applyNavVisibility();
  showPage(currentPage);
}

export function wireSearch(): void {
  const input = document.getElementById('search-input') as HTMLInputElement;
  input.addEventListener('input', () => applyNavVisibility());
}
