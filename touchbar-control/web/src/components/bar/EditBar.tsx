import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { EyeOffIcon } from 'lucide-react';
import Tile from './Tile.tsx';
import { tileSize } from './TileCanvas.tsx';
import { useBarState, useWidth } from '@/lib/useBar.ts';
import { cn } from '@/lib/utils';
import { RIGHT, type EditGroup } from '@/lib/editModel.ts';
import type { Editor } from '@/lib/useEditor.ts';

export const TRAY = 'tray';
const TILE_GAP = 6;
const GROUP_GAP = 22;
// Fixed (unscaled) chrome around the tiles — must match the classes below:
const BAR_PAD_X = 24;    // edit bar px-3
const GROUP_CHROME = 10; // group p-1 (4+4) + border (1+1)
const SPACER_MIN = 12;

function GroupRow({ group, ids, scale, editor }: { group: EditGroup; ids: string[]; scale: number; editor: Editor }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${group.key}`, data: { group: group.key } });
  return (
    <div
      ref={setNodeRef}
      data-group={group.key}
      title={group.label}
      className={cn('flex shrink-0 gap-1.5 rounded-xl border border-dashed border-transparent p-1 transition-colors', isOver && 'border-primary bg-primary/5')}
    >
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        {ids.map((id, i) => (
          <Tile key={id} id={id} group={group.key} scale={scale} editor={editor} first={i === 0} last={i === ids.length - 1} />
        ))}
      </SortableContext>
      {ids.length === 0 && <span className="px-3 py-2 text-xs text-muted-foreground">empty</span>}
    </div>
  );
}

/** The bar split into tiles: the pinned panel's groups on the left, the right
 *  cluster on the right, scaled so the whole bar fits the column. */
export function EditBar({ editor }: { editor: Editor }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  useBarState(); // re-render on scene changes: tile sizes follow the real widgets
  const state = editor.state!;
  const left = editor.shownGroups.filter(g => g.key !== RIGHT);
  const right = editor.shownGroups.find(g => g.key === RIGHT)!;
  const shown = [...left, right];

  let tiles = 0, fixed = BAR_PAD_X + SPACER_MIN + GROUP_GAP * shown.length + 2;
  for (const g of shown) {
    const ids = state.order[g.key] ?? [];
    tiles += ids.reduce((s, id) => s + tileSize(id).w, 0);
    fixed += GROUP_CHROME + Math.max(0, ids.length - 1) * TILE_GAP;
  }
  const scale = width && tiles ? Math.max(0.45, Math.min(1.25, (width - fixed) / tiles)) : 0.9;

  return (
    <div ref={ref} className="edit-frame overflow-x-auto rounded-xl border bg-card p-2 shadow-sm">
      <div className="flex min-h-20 items-center rounded-lg bg-muted/40 px-3 py-3" style={{ gap: GROUP_GAP }}>
        {left.map(g => <GroupRow key={g.key} group={g} ids={state.order[g.key] ?? []} scale={scale} editor={editor} />)}
        <div className="min-w-3 flex-1" />
        <GroupRow group={right} ids={state.order[RIGHT] ?? []} scale={scale} editor={editor} />
      </div>
    </div>
  );
}

/** Drop target for taking buttons off the bar; lists what is hidden. */
export function HiddenTray({ editor }: { editor: Editor }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY, data: { group: TRAY } });
  const state = editor.state!;
  const ids = editor.shownGroups.flatMap(g => state.hidden[g.key] ?? []);
  return (
    <div
      ref={setNodeRef}
      data-tray
      className={cn('flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-dashed p-2.5 transition-colors', isOver && 'border-destructive bg-destructive/5')}
    >
      <span className="flex items-center gap-1.5 pr-2 text-xs font-medium text-muted-foreground">
        <EyeOffIcon className="size-3.5" />
        Hidden
      </span>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {ids.map(id => <Tile key={id} id={id} group={TRAY} scale={0.7} editor={editor} hidden />)}
      </SortableContext>
      {ids.length === 0 && <span className="text-xs text-muted-foreground">Drag a button here to take it off the bar.</span>}
    </div>
  );
}
