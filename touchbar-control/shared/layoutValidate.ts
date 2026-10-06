import type { BarLayout } from './types.ts';

// Same id rules as the app's parseLayoutPatch (layoutModel.ts): anything that
// reaches config.ts or the sandbox must look like an id.
const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_IDS = 128;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function idList(v: unknown, what: string): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error(`${what} must be a list of button ids`);
  if (v.length > MAX_IDS) throw new Error(`${what} has too many entries`);
  for (const id of v) {
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error(`${what} contains an invalid id`);
  }
  return [...v] as string[];
}

/**
 * Validates an untrusted layout (an imported file, a stored preset). Missing
 * parts default to empty; `pinnedLeft` is always dropped — it's a view
 * setting, not part of a layout.
 */
export function parseLayout(value: unknown): BarLayout {
  if (!isRecord(value)) throw new Error('layout must be an object');
  const left: BarLayout['left'] = {};
  if (value.left !== undefined) {
    if (!isRecord(value.left)) throw new Error('left must be an object of panels');
    for (const [page, groups] of Object.entries(value.left)) {
      if (!ID_RE.test(page)) throw new Error('left has an invalid panel name');
      if (!isRecord(groups)) throw new Error(`left.${page} must be an object of groups`);
      left[page] = {};
      for (const [group, ids] of Object.entries(groups)) {
        if (!ID_RE.test(group)) throw new Error(`left.${page} has an invalid group name`);
        left[page][group] = idList(ids, `left.${page}.${group}`);
      }
    }
  }
  return {
    rightButtons: idList(value.rightButtons, 'rightButtons'),
    hidden: idList(value.hidden, 'hidden'),
    left,
    pinnedLeft: null,
  };
}
