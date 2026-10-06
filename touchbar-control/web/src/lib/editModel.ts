/**
 * The edit surface's model: which tiles sit in which group, in what order,
 * and which are hidden — plus conversion to and from the app's BarLayout.
 *
 * Tiles are identified by their scene id (the same `id` the app renders), so a
 * tile can always crop its own pixels out of the live frame: right-cluster keys
 * as-is (`volume`), left-panel buttons page-qualified (`vscode.run`).
 *
 * Rules mirror the app's resolveOrder(): unknown ids drop, missing built-ins
 * are appended, and a button never leaves its group — it can only be
 * reordered within it, or hidden and later shown again in the same group.
 */
import type { BarLayout, LayoutSchema } from '../../../shared/types.ts';

export const RIGHT = 'right';

export interface EditGroup {
  key: string;         // 'right' or '<page>:<group>'
  page: string | null; // null for the right cluster
  group: string;
  label: string;
}

export interface EditState {
  /** Visible tiles per group, in bar order. */
  order: Record<string, string[]>;
  /** Hidden tiles per group (kept in their last order). */
  hidden: Record<string, string[]>;
}

export function groupKey(page: string | null, group: string): string {
  return page ? `${page}:${group}` : RIGHT;
}

export function sceneId(page: string | null, key: string): string {
  return page ? `${page}.${key}` : key;
}

/** Strips the page prefix a left tile's scene id carries. */
export function configKey(page: string | null, id: string): string {
  return page && id.startsWith(`${page}.`) ? id.slice(page.length + 1) : id;
}

export function groupsFor(schema: LayoutSchema): EditGroup[] {
  const out: EditGroup[] = [{ key: RIGHT, page: null, group: RIGHT, label: 'Right cluster' }];
  for (const [page, groups] of Object.entries(schema.left)) {
    for (const group of Object.keys(groups)) out.push({ key: groupKey(page, group), page, group, label: `${page} · ${group}` });
  }
  return out;
}

export function resolveOrder(configured: readonly string[] | undefined, builtIn: readonly string[]): string[] {
  if (!configured || configured.length === 0) return [...builtIn];
  const known = new Set(builtIn);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of configured) if (known.has(id) && !seen.has(id)) { out.push(id); seen.add(id); }
  for (const id of builtIn) if (!seen.has(id)) out.push(id);
  return out;
}

export function fromLayout(layout: BarLayout, schema: LayoutSchema): EditState {
  const hiddenSet = new Set(layout.hidden);
  const state: EditState = { order: {}, hidden: {} };
  const place = (key: string, page: string | null, configured: string[] | undefined, builtIn: string[]) => {
    const ids = resolveOrder(configured, builtIn).map(k => sceneId(page, k));
    state.order[key] = ids.filter(id => !hiddenSet.has(id));
    state.hidden[key] = ids.filter(id => hiddenSet.has(id));
  };
  place(RIGHT, null, layout.rightButtons, schema.right);
  for (const [page, groups] of Object.entries(schema.left)) {
    for (const [group, builtIn] of Object.entries(groups)) place(groupKey(page, group), page, layout.left[page]?.[group], builtIn);
  }
  return state;
}

/** Back to the app's layout. Hidden tiles stay listed (after the visible
 *  ones) so showing one again doesn't lose where the group ends. */
export function toLayout(state: EditState, schema: LayoutSchema, pinnedLeft: string | null = null): BarLayout {
  const all = (key: string) => [...(state.order[key] ?? []), ...(state.hidden[key] ?? [])];
  const left: BarLayout['left'] = {};
  for (const [page, groups] of Object.entries(schema.left)) {
    left[page] = {};
    for (const group of Object.keys(groups)) left[page][group] = all(groupKey(page, group)).map(id => configKey(page, id));
  }
  return {
    rightButtons: all(RIGHT),
    hidden: Object.values(state.hidden).flat(),
    left,
    pinnedLeft,
  };
}

/** Which group a tile belongs to, and whether it's currently hidden. */
export function locate(state: EditState, id: string): { key: string; hidden: boolean; index: number } | null {
  for (const [key, ids] of Object.entries(state.order)) {
    const i = ids.indexOf(id);
    if (i !== -1) return { key, hidden: false, index: i };
  }
  for (const [key, ids] of Object.entries(state.hidden)) {
    const i = ids.indexOf(id);
    if (i !== -1) return { key, hidden: true, index: i };
  }
  return null;
}

function clone(state: EditState): EditState {
  return {
    order: Object.fromEntries(Object.entries(state.order).map(([k, v]) => [k, [...v]])),
    hidden: Object.fromEntries(Object.entries(state.hidden).map(([k, v]) => [k, [...v]])),
  };
}

/**
 * Puts a tile at `index` among its group's visible tiles — reordering it, or
 * showing it again if it was hidden. A move into any other group is refused
 * (returns the state unchanged): buttons keep their group.
 */
export function moveTo(state: EditState, id: string, key: string, index: number): EditState {
  const from = locate(state, id);
  if (!from || from.key !== key) return state;
  const next = clone(state);
  const src = from.hidden ? next.hidden[key] : next.order[key];
  src.splice(from.index, 1);
  const dst = next.order[key];
  dst.splice(Math.max(0, Math.min(index, dst.length)), 0, id);
  return next;
}

export function hide(state: EditState, id: string): EditState {
  const from = locate(state, id);
  if (!from || from.hidden) return state;
  const next = clone(state);
  next.order[from.key].splice(from.index, 1);
  next.hidden[from.key].push(id);
  return next;
}

/** Shows a hidden tile again at the end of its group. */
export function show(state: EditState, id: string): EditState {
  const from = locate(state, id);
  if (!from || !from.hidden) return state;
  return moveTo(state, id, from.key, Number.MAX_SAFE_INTEGER);
}

/** Same arrangement? (pinnedLeft is a viewing aid, not part of the layout.) */
export function sameLayout(a: BarLayout, b: BarLayout, schema: LayoutSchema): boolean {
  const norm = (l: BarLayout) => JSON.stringify(toLayout(fromLayout(l, schema), schema));
  return norm(a) === norm(b);
}
