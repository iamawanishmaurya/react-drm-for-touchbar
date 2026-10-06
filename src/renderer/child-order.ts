/**
 * Child-list mutations for the reconciler's host config.
 *
 * React moves an already-mounted child by calling appendChild/insertBefore
 * again *without* removing it first (DOM semantics: inserting a node that is
 * already in the tree moves it). Plain array pushes would leave a second copy
 * behind — a reordered list rendered every moved item twice and flex-shrank
 * the row. These helpers detach first, then insert.
 */
export function appendMoving<T>(arr: T[], child: T): void {
  const at = arr.indexOf(child);
  if (at !== -1) arr.splice(at, 1);
  arr.push(child);
}
export function insertMovingBefore<T>(arr: T[], child: T, before: T): void {
  const at = arr.indexOf(child);
  if (at !== -1) arr.splice(at, 1);
  const idx = arr.indexOf(before);
  arr.splice(idx === -1 ? 0 : idx, 0, child);
}
