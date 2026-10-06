import { hide, locate, moveTo, type EditState } from './editModel.ts';

/** Where a dragged button was released. */
export type DropTarget =
  | { kind: 'group'; group: string; beforeId?: string } // on a tile (insert there) or a group's empty space (end)
  | { kind: 'tray' };                                   // the Hidden tray

/** Drag sources: bar/tray tiles use the scene id; palette rows prefix it. */
export const PALETTE_PREFIX = 'palette:';
export const dragIdToTile = (dragId: string) =>
  dragId.startsWith(PALETTE_PREFIX) ? dragId.slice(PALETTE_PREFIX.length) : dragId;

/**
 * The result of dropping `id` on `target`:
 *   - the new state (reordered, hidden, or shown again at the drop position)
 *   - the same state object when nothing changes
 *   - 'refused' when it would move a button into another group
 */
export function applyDrop(state: EditState, id: string, target: DropTarget): EditState | 'refused' {
  const at = locate(state, id);
  if (!at) return state;
  if (target.kind === 'tray') return at.hidden ? state : hide(state, id);
  if (at.key !== target.group) return 'refused';
  const ids = state.order[target.group] ?? [];
  let index = target.beforeId ? ids.indexOf(target.beforeId) : ids.length;
  if (index === -1) index = ids.length;
  if (!at.hidden && target.beforeId === id) return state;
  return moveTo(state, id, target.group, index);
}
