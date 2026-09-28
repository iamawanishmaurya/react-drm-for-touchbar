import type { JsonValue } from '../types.js';
import { humanize, markDirty, setPath, type SectionValue } from '../state.js';

// Labeled field rows: the generic object-form renderer and the small text
// input helper, moved verbatim from renderer.ts (behavior unchanged).

export function smallTextInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

/** Union fields (per schema.ts UNION_FIELDS) render as selects; everything
 *  else keeps the original type dispatch: boolean → checkbox, number → text
 *  (accepting Infinity), array → comma-separated text, else plain text. */
export function renderGenericObject(
  container: HTMLElement,
  obj: SectionValue,
  path: string[],
  unionFields: Record<string, string[]>,
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = [...path, key];
    const pathStr = fieldPath.join('.');

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = humanize(key);
      fieldset.appendChild(legend);
      container.appendChild(fieldset);
      renderGenericObject(fieldset, value as SectionValue, fieldPath, unionFields);
      continue;
    }

    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = humanize(key);
    row.appendChild(label);

    if (unionFields[pathStr]) {
      const select = document.createElement('select');
      for (const choice of unionFields[pathStr]) {
        const opt = document.createElement('option');
        opt.value = choice;
        opt.textContent = choice;
        if (choice === value) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => { setPath(fieldPath, select.value); markDirty(); });
      row.appendChild(select);
    } else if (typeof value === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      input.addEventListener('change', () => { setPath(fieldPath, input.checked); markDirty(); });
      row.appendChild(input);
    } else if (typeof value === 'number') {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value === Infinity ? 'Infinity' : String(value);
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        const n = raw.toLowerCase() === 'infinity' ? Infinity : Number(raw);
        if (!Number.isNaN(n)) { setPath(fieldPath, n); markDirty(); }
      });
      row.appendChild(input);
    } else if (Array.isArray(value)) {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value.join(', ');
      input.addEventListener('change', () => {
        const arr = input.value.split(',').map(s => s.trim()).filter(Boolean);
        setPath(fieldPath, arr);
        markDirty();
      });
      row.appendChild(input);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(value);
      input.addEventListener('change', () => { setPath(fieldPath, input.value); markDirty(); });
      row.appendChild(input);
    }
    container.appendChild(row);
  }
}
