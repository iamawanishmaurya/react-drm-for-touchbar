// Pure list-order operations for drag-and-drop and keyboard reordering
// (REL-04). DOM-free so it runs under tsx --test.

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const clamped = Math.max(0, Math.min(list.length - 1, to));
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(clamped, 0, item);
  return out;
}

export function removeAt<T>(list: T[], index: number): T[] {
  if (index < 0 || index >= list.length) return [...list];
  const out = [...list];
  out.splice(index, 1);
  return out;
}

export function insertAt<T>(list: T[], index: number, item: T): T[] {
  const out = [...list];
  out.splice(Math.max(0, Math.min(list.length, index)), 0, item);
  return out;
}

/** True when two order snapshots differ (drives "dirty" and Revert enablement). */
export function orderChanged<T>(a: T[], b: T[]): boolean {
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}
