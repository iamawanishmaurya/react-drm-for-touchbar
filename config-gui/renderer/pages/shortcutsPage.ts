import type { JsonValue } from '../types.js';
import { isPlainObject, markDirty, section, setPath, humanize } from '../state.js';
import { renderKeyCapture } from '../widgets/keyCapture.js';
import { renderGenericObject } from '../widgets/fieldRow.js';
import { buildPagePanel } from './page.js';
import { BROWSER_ACTIONS, SECTION_LABELS, SECTION_DESCRIPTIONS, VSCODE_ACTIONS } from '../schema.js';
import type { PageDef } from '../schema.js';
import type { SectionName } from '../types.js';

// Shortcuts page: browser/VSCode keymaps, per-window-class overrides, and
// the screenshot combo. Ported verbatim from renderer.ts.

function renderKeymap(
  container: HTMLElement,
  name: SectionName,
  keymap: Record<string, JsonValue>,
  actions: string[],
): void {
  for (const action of actions) {
    if (keymap[action] === undefined) continue;
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = humanize(action);
    row.appendChild(label);
    const codes = (keymap[action] as number[]).slice();
    row.appendChild(renderKeyCapture(codes, newCodes => {
      keymap[action] = newCodes;
      setPath([name, action], newCodes);
      markDirty();
    }));
    container.appendChild(row);
  }
}

function renderOverrides(
  container: HTMLElement,
  name: SectionName,
  overrides: Record<string, JsonValue>,
  actions: string[],
): void {
  const list = document.createElement('div');
  container.appendChild(list);

  function renderList(): void {
    list.innerHTML = '';
    for (const [windowClass, partial] of Object.entries(overrides)) {
      if (!isPlainObject(partial)) continue;
      list.appendChild(renderOverrideBlock(name, windowClass, partial, overrides, actions, renderList));
    }
  }
  renderList();

  const addRow = document.createElement('div');
  addRow.className = 'field-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'window class, e.g. firefox';
  addRow.appendChild(input);
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add override';
  addBtn.className = 'secondary';
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    const windowClass = input.value.trim().toLowerCase();
    if (!windowClass || overrides[windowClass] !== undefined) return;
    overrides[windowClass] = {};
    setPath([name], overrides);
    markDirty();
    input.value = '';
    renderList();
  });
  addRow.appendChild(addBtn);
  container.appendChild(addRow);
}

function renderOverrideBlock(
  name: SectionName,
  windowClass: string,
  partial: Record<string, JsonValue>,
  overrides: Record<string, JsonValue>,
  actions: string[],
  onStructuralChange: () => void,
): HTMLElement {
  const block = document.createElement('div');
  block.className = 'override-block';

  const header = document.createElement('div');
  header.className = 'override-block-header';
  const title = document.createElement('strong');
  title.textContent = windowClass;
  header.appendChild(title);
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.className = 'danger';
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => {
    delete overrides[windowClass];
    setPath([name], overrides);
    markDirty();
    onStructuralChange();
  });
  header.appendChild(removeBtn);
  block.appendChild(header);

  for (const action of actions) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = humanize(action);
    row.appendChild(label);
    const codes = ((partial[action] as number[] | undefined) ?? []).slice();
    row.appendChild(renderKeyCapture(codes, newCodes => {
      if (newCodes.length) partial[action] = newCodes; else delete partial[action];
      setPath([name], overrides);
      markDirty();
    }));
    block.appendChild(row);
  }

  return block;
}

/** Per-section renderer used by generic pages: returns false when the section
 *  has no bespoke renderer (caller falls back to the generic object form). */
export function renderSectionCustom(name: SectionName, container: HTMLElement, value: Record<string, JsonValue>): boolean {
  switch (name) {
    case 'DEFAULT_BROWSER_KEYS': renderKeymap(container, name, value, BROWSER_ACTIONS); return true;
    case 'DEFAULT_VSCODE_KEYS': renderKeymap(container, name, value, VSCODE_ACTIONS); return true;
    case 'BROWSER_KEY_OVERRIDES': renderOverrides(container, name, value, BROWSER_ACTIONS); return true;
    case 'VSCODE_KEY_OVERRIDES': renderOverrides(container, name, value, VSCODE_ACTIONS); return true;
    default: return false;
  }
}

export function renderShortcutsPage(def: PageDef): HTMLElement {
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
      // SCREENSHOT etc. — generic object form
      renderGenericObject(fieldset, value, [name], {} as Record<string, string[]>);
    }
  }
  return panel;
}
