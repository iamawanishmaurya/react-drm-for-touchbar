import type { ConfigData, DesktopAppEntry, JsonValue, SectionName } from './types.js';

// Central renderer state: the config snapshot being edited, the dirty flag,
// and the meta caches (icons/keys/desktop apps) fetched once via IPC.
// Pages mutate through setPath + markDirty; markDirty notifies subscribers
// (e.g. the Dock page re-renders its preview).

export const store: ConfigData = {};

export const meta = {
  iconChoices: [] as string[],
  domCodeToKeyName: {} as Record<string, string>,
  keyNames: {} as Record<string, number>,
  codeToKeyName: {} as Record<number, string>,
};

export const caches: { desktopApps: DesktopAppEntry[] | null; iconThemes: string[] | null } = {
  desktopApps: null,
  iconThemes: null,
};

let dirty = false;
const subscribers = new Set<() => void>();

export function isDirty(): boolean {
  return dirty;
}

export function onDirtyChange(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function markDirty(): void {
  dirty = true;
  const status = document.getElementById('status')!;
  status.textContent = 'Unsaved changes';
  status.className = '';
  subscribers.forEach(fn => fn());
}

export function markSaved(): void {
  dirty = false;
}

export function setPath(path: string[], value: JsonValue): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = store;
  for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
  obj[path[path.length - 1]] = value;
}

export type SectionValue = Record<string, JsonValue>;

export function section(name: SectionName): SectionValue | undefined {
  const v = store[name];
  return v !== undefined && typeof v === 'object' && !Array.isArray(v) ? (v as SectionValue) : undefined;
}

export function isPlainObject(v: JsonValue): v is Record<string, JsonValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
}

/** Picking the same app twice, or adding two unrenamed "custom" apps, would
 *  otherwise both land on the same slug — two dock entries sharing an id
 *  both write out as literal duplicates (and break React's key uniqueness
 *  on the real Touch Bar). Append -2, -3, ... until it's actually unique. */
export function uniqueAppId(base: string, existing: Record<string, JsonValue>[]): string {
  const taken = new Set(existing.map(a => a.id as string));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
