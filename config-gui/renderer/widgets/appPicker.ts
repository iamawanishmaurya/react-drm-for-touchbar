import { caches } from '../state.js';

// App-picker overlay: search installed .desktop apps, or fall back to a
// custom entry. Moved verbatim from renderer.ts (behavior unchanged).

export async function openAppPicker(
  onPick: (name: string, command: string, args: string[], icon: string | null) => void,
): Promise<void> {
  if (!caches.desktopApps) caches.desktopApps = await window.configApi.listApps();
  const apps = caches.desktopApps;

  const overlay = document.createElement('div');
  overlay.className = 'picker-overlay';
  const panel = document.createElement('div');
  panel.className = 'picker-panel';
  overlay.appendChild(panel);

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search installed apps…';
  search.className = 'picker-search';
  panel.appendChild(search);

  const list = document.createElement('div');
  list.className = 'picker-list';
  panel.appendChild(list);

  function close(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  function renderItems(query: string): void {
    list.innerHTML = '';
    const q = query.trim().toLowerCase();
    const filtered = q ? apps.filter(a => a.name.toLowerCase().includes(q)) : apps;
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'picker-empty';
      empty.textContent = 'No matching apps';
      list.appendChild(empty);
      return;
    }
    for (const a of filtered.slice(0, 300)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'picker-item';
      item.textContent = a.name;
      item.addEventListener('click', () => { onPick(a.name, a.command, a.args, a.icon); close(); });
      list.appendChild(item);
    }
  }
  renderItems('');
  search.addEventListener('input', () => renderItems(search.value));

  const customBtn = document.createElement('button');
  customBtn.type = 'button';
  customBtn.className = 'secondary picker-custom';
  customBtn.textContent = 'Add a custom app instead';
  customBtn.addEventListener('click', () => { onPick('New App', '', [], null); close(); });
  panel.appendChild(customBtn);

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  search.focus();
}
