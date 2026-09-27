import type { JsonValue } from '../types.js';
import { caches, isPlainObject, markDirty, meta, onDirtyChange, section, setPath, store, uniqueAppId } from '../state.js';
import { smallTextInput, renderGenericObject } from '../widgets/fieldRow.js';
import { openAppPicker } from '../widgets/appPicker.js';
import { buildPagePanel } from './page.js';
import { UNION_FIELDS } from '../schema.js';
import type { PageDef } from '../schema.js';

// Dock page: live preview strip + icon theme + appearance fields + app cards.
// Ported verbatim from renderer.ts (behavior unchanged); the preview
// re-render that used to hang off markDirty() now subscribes explicitly.

function isSectionValue(v: JsonValue | undefined): v is Record<string, JsonValue> {
  return isPlainObject(v as JsonValue);
}

async function renderDockPreview(container: HTMLElement, dock: Record<string, JsonValue>): Promise<void> {
  const apps = (dock.apps as Record<string, JsonValue>[] | undefined) ?? [];
  const panel = isSectionValue(dock.panel) ? dock.panel : {};
  const indicator = isSectionValue(dock.indicator) ? dock.indicator : {};
  const iconSize = typeof dock.iconSize === 'number' ? dock.iconSize : 50;
  const gap = typeof dock.gap === 'number' ? dock.gap : 14;
  const indicatorSize = typeof indicator.size === 'number' ? indicator.size : 5;

  container.style.background = typeof panel.color === 'string' ? panel.color : '#1c1f26';
  const radiusPx = typeof panel.radius === 'number' ? panel.radius : 20;
  container.style.borderRadius = `${Math.min(16, radiusPx / 3)}px`;
  container.style.gap = `${(gap / 2008) * 100}%`;

  // Apply whatever theme is currently picked (saved or not) before resolving
  // any icon — resolveIcon's main-process side otherwise has no idea a theme
  // was ever chosen, see icon:setTheme's comment in main/main.ts.
  const icons = isSectionValue(dock.icons) ? dock.icons : {};
  const theme = typeof icons.theme === 'string' ? icons.theme : null;
  await window.configApi.setIconTheme(theme);

  const resolved = await Promise.all(apps.map(async (a, i) => {
    const iconName = typeof a.iconName === 'string' ? a.iconName : undefined;
    const url = iconName ? await window.configApi.resolveIcon(iconName) : null;
    return { app: a, url, showIndicator: i === 0 };
  }));

  container.innerHTML = '';
  if (resolved.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'tb-preview-empty';
    empty.textContent = 'No pinned apps yet';
    container.appendChild(empty);
    return;
  }

  for (const { app, url, showIndicator } of resolved) {
    const wrap = document.createElement('div');
    wrap.className = 'tb-icon-wrap';

    const shape = document.createElement('div');
    shape.className = 'tb-icon-shape';
    shape.style.height = `${(iconSize / 60) * 100}%`;
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = typeof app.label === 'string' ? app.label : '';
      shape.appendChild(img);
    } else {
      const mono = document.createElement('div');
      mono.className = 'tb-icon-mono';
      mono.style.background = typeof app.color === 'string' ? app.color : '#7dd3fc';
      const label = typeof app.label === 'string' ? app.label : '?';
      mono.textContent = label.charAt(0).toUpperCase();
      shape.appendChild(mono);
    }
    wrap.appendChild(shape);

    // Every icon reserves the same dot space, visible or not, so icons stay
    // vertically aligned regardless of which app happens to show one.
    const dot = document.createElement('span');
    dot.className = 'tb-indicator';
    dot.style.width = `${(indicatorSize / 60) * 100}%`;
    dot.style.height = dot.style.width;
    dot.style.background = showIndicator && typeof indicator.color === 'string' ? indicator.color : 'transparent';
    dot.style.boxShadow = showIndicator ? '' : 'none';
    wrap.appendChild(dot);

    container.appendChild(wrap);
  }
}

function renderIconThemeField(container: HTMLElement, dock: Record<string, JsonValue>): void {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Icons';
  fieldset.appendChild(legend);
  container.appendChild(fieldset);

  const row = document.createElement('div');
  row.className = 'field-row';
  const label = document.createElement('label');
  label.textContent = 'Theme';
  row.appendChild(label);
  const select = document.createElement('select');
  row.appendChild(select);
  fieldset.appendChild(row);

  const icons = isSectionValue(dock.icons) ? dock.icons : {};
  const current = (icons.theme as string | null | undefined) ?? null;
  const AUTO_THEME = ''; // <select> value standing in for DOCK.icons.theme === null

  function populate(themes: string[]): void {
    select.innerHTML = '';
    // Keep a currently-set theme selectable even if it's no longer installed
    // — never silently swap the user's choice out from under them.
    const options = current !== null && !themes.includes(current)
      ? [AUTO_THEME, current, ...themes]
      : [AUTO_THEME, ...themes];
    for (const value of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value === AUTO_THEME ? 'Auto-detect' : value;
      opt.selected = value === AUTO_THEME ? current === null : value === current;
      select.appendChild(opt);
    }
  }

  populate(caches.iconThemes ?? []);
  if (!caches.iconThemes) {
    void window.configApi.listIconThemes().then(themes => {
      caches.iconThemes = themes;
      populate(themes);
    });
  }

  select.addEventListener('change', () => {
    setPath(['DOCK', 'icons', 'theme'], select.value === AUTO_THEME ? null : select.value);
    markDirty();
  });
}

function renderAppCard(
  appItem: Record<string, JsonValue>,
  idx: number,
  apps: Record<string, JsonValue>[],
  onStructuralChange: () => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'app-card';

  const header = document.createElement('div');
  header.className = 'app-card-header';

  const iconSelect = document.createElement('select');
  for (const choice of meta.iconChoices) {
    const opt = document.createElement('option');
    opt.value = choice;
    opt.textContent = choice;
    if (choice === appItem.iconGlyph) opt.selected = true;
    iconSelect.appendChild(opt);
  }
  iconSelect.addEventListener('change', () => {
    appItem.iconGlyph = iconSelect.value;
    setPath(['DOCK', 'apps'], apps);
    markDirty();
  });
  header.appendChild(iconSelect);

  const idInput = smallTextInput((appItem.id as string) ?? '', v => {
    appItem.id = v;
    setPath(['DOCK', 'apps'], apps);
    markDirty();
  });
  idInput.placeholder = 'id';
  header.appendChild(idInput);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.className = 'danger';
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => {
    apps.splice(idx, 1);
    setPath(['DOCK', 'apps'], apps);
    markDirty();
    onStructuralChange();
  });
  header.appendChild(removeBtn);
  card.appendChild(header);

  const textFields: [string, string][] = [
    ['label', 'Label'], ['iconName', 'Icon name (theme)'], ['color', 'Color'], ['command', 'Command'],
  ];
  for (const [key, labelText] of textFields) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = labelText;
    row.appendChild(label);
    const input = smallTextInput((appItem[key] as string) ?? '', v => {
      appItem[key] = v;
      setPath(['DOCK', 'apps'], apps);
      markDirty();
    });
    row.appendChild(input);
    card.appendChild(row);
  }

  const listFields: [string, string][] = [
    ['args', 'Args (comma-separated)'], ['matchClass', 'Match classes (comma-separated)'],
  ];
  for (const [key, labelText] of listFields) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = labelText;
    row.appendChild(label);
    const arr = (appItem[key] as string[] | undefined) ?? [];
    const input = smallTextInput(arr.join(', '), v => {
      const parsed = v.split(',').map(s => s.trim()).filter(Boolean);
      if (parsed.length) appItem[key] = parsed; else delete appItem[key];
      setPath(['DOCK', 'apps'], apps);
      markDirty();
    });
    row.appendChild(input);
    card.appendChild(row);
  }

  return card;
}

export function renderDockPage(def: PageDef): HTMLElement {
  const panel = buildPagePanel(def);
  const dock = section('DOCK');
  if (!dock) return panel;

  const previewWrap = document.createElement('div');
  previewWrap.className = 'tb-preview-wrap';
  const preview = document.createElement('div');
  preview.className = 'touchbar-preview';
  previewWrap.appendChild(preview);
  const caption = document.createElement('p');
  caption.className = 'tb-preview-caption';
  caption.textContent = 'Live preview — reflects the settings below as you change them';
  previewWrap.appendChild(caption);
  panel.appendChild(previewWrap);
  void renderDockPreview(preview, dock);
  onDirtyChange(() => {
    const current = section('DOCK');
    if (current) void renderDockPreview(preview, current);
  });

  renderIconThemeField(panel, dock);

  const scalarKeys = ['iconSize', 'slot', 'gap', 'lift', 'panel', 'indicator', 'shortcut'];
  const scalarPart: Record<string, JsonValue> = {};
  for (const k of scalarKeys) if (dock[k] !== undefined) scalarPart[k] = dock[k];
  renderGenericObject(panel, scalarPart, ['DOCK'], UNION_FIELDS);

  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Apps';
  fieldset.appendChild(legend);
  panel.appendChild(fieldset);

  const list = document.createElement('div');
  fieldset.appendChild(list);

  const apps = (store.DOCK && isPlainObject(store.DOCK) ? (store.DOCK as Record<string, JsonValue>).apps : undefined) as Record<string, JsonValue>[] | undefined ?? [];

  function renderList(): void {
    list.innerHTML = '';
    apps.forEach((appItem, idx) => list.appendChild(renderAppCard(appItem, idx, apps, renderList)));
  }
  renderList();

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add app';
  addBtn.className = 'secondary';
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    void openAppPicker((name, command, argsList, icon) => {
      const id = uniqueAppId(
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app',
        apps,
      );
      const newApp: Record<string, JsonValue> = {
        id, label: name, iconGlyph: meta.iconChoices[0] ?? 'FaFolder', color: '#7dd3fc', command,
      };
      if (icon) newApp.iconName = icon;
      if (argsList.length > 0) newApp.args = argsList;
      apps.push(newApp);
      setPath(['DOCK', 'apps'], apps);
      markDirty();
      renderList();
    });
  });
  fieldset.appendChild(addBtn);

  return panel;
}
