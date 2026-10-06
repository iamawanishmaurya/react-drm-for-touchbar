import { store, meta, markSaved } from './state.js';
import { attachPreviewCanvas, startPreviewClient } from './preview/client.js';
import { buildNav, buildPages, wireSearch, showPage } from './nav.js';
import type { SectionName } from './types.js';

// Renderer entry point. Boots exactly like the old monolith: fetch meta +
// config, build the nav and all pages, open the first page with content,
// wire topbar and window controls.

function showEmptyState(): void {
  document.getElementById('nav')!.innerHTML = '';
  (document.getElementById('search-wrap') as HTMLElement).style.display = 'none';
  document.getElementById('content')!.innerHTML =
    '<div class="empty-state">Couldn\'t find linux-touchbar-control-center at the default install path.'
    + '<br/><button id="locate-btn" style="margin-top:14px;">Locate folder…</button></div>';
  document.getElementById('locate-btn')!.addEventListener('click', async () => {
    await window.configApi.locate();
    location.reload();
  });
}

function showError(msg: string): void {
  document.getElementById('content')!.innerHTML =
    `<div class="empty-state">Couldn't read config.ts:<br/><code>${msg.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</code></div>`;
}

function wireWindowControls(): void {
  document.getElementById('win-minimize')!.addEventListener('click', () => window.windowApi.minimize());
  document.getElementById('win-maximize')!.addEventListener('click', () => window.windowApi.toggleMaximize());
  document.getElementById('win-close')!.addEventListener('click', () => window.windowApi.close());
}

function wireTopbar(): void {
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
  const status = document.getElementById('status')!;

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const res = await window.configApi.write(store);
    saveBtn.disabled = false;
    if (res.ok) {
      markSaved();
      status.textContent = 'Saved';
      status.className = 'ok';
      restartBtn.style.display = '';
    } else {
      status.textContent = `Save failed: ${res.error}`;
      status.className = 'error';
    }
  });

  restartBtn.addEventListener('click', async () => {
    restartBtn.disabled = true;
    const res = await window.configApi.restart();
    restartBtn.disabled = false;
    status.textContent = res.ok ? res.message : `Restart failed: ${res.message}`;
    status.className = res.ok ? 'ok' : 'error';
    if (res.ok) restartBtn.style.display = 'none';
  });

  document.getElementById('win-minimize')!.addEventListener('click', () => window.windowApi.minimize());
  document.getElementById('win-maximize')!.addEventListener('click', () => window.windowApi.toggleMaximize());
  document.getElementById('win-close')!.addEventListener('click', () => window.windowApi.close());
}

async function main(): Promise<void> {
  const m = await window.configApi.meta();
  meta.iconChoices = m.iconChoices;
  meta.domCodeToKeyName = m.domCodeToKeyName;
  meta.keyNames = m.keyNames;
  for (const [name, code] of Object.entries(m.keyNames)) meta.codeToKeyName[code] = name;

  const res = await window.configApi.read();
  if (!res.repoFound) return showEmptyState();
  if (res.error) return showError(res.error);
  Object.assign(store, JSON.parse(JSON.stringify(res.data ?? {})));

  buildPages();
  buildNav();
  const firstWithContent = PAGES_ORDER().find(id => hasContent(id));
  showPage(firstWithContent ?? 'behavior');
  wireTopbar();
  wireSearch();
  console.log('BOOT_OK panels=', document.querySelectorAll('.section-panel').length, 'navItems=', document.querySelectorAll('.nav-item').length, 'sections=', Object.keys(store).length);

  attachPreviewCanvas(document.getElementById('preview-canvas') as HTMLCanvasElement);
  window.configApi.onPreviewState(ps => {
    if (ps.running && ps.port) startPreviewClient(ps.port);
  });
}

// Page visibility mirrors nav building: a page with sections shows only when
// at least one of them exists in the user config.
import { PAGES } from './schema.js';
function PAGES_ORDER(): import('./schema').PageId[] {
  return PAGES.map(p => p.id);
}
function hasContent(id: import('./schema').PageId): boolean {
  const def = PAGES.find(p => p.id === id)!;
  if (def.sections.length === 0) return true; // Layout placeholder
  return def.sections.some((s: SectionName) => store[s] !== undefined);
}

wireWindowControls();
main().catch((e: unknown) => {
  const el = document.getElementById('nav')!;
  el.textContent = 'BOOT ERROR: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e));
  el.style.color = '#f87171';
  el.style.whiteSpace = 'pre-wrap';
  el.style.fontSize = '10px';
});
window.addEventListener('error', e => {
  const el = document.getElementById('nav')!;
  el.textContent = 'UNCAUGHT: ' + e.message + '\n' + (e.error?.stack ?? '');
  el.style.color = '#f87171';
  el.style.whiteSpace = 'pre-wrap';
  el.style.fontSize = '10px';
});
