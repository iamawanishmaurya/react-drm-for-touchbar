import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, SlidersHorizontalIcon } from 'lucide-react';
import TileCanvas from './TileCanvas.tsx';
import { cn } from '@/lib/utils';
import {
  ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel,
  ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Editor } from '@/lib/useEditor.ts';

/**
 * One button on the edit surface: its live pixels, draggable (dnd-kit), with
 * the same actions on right-click as in the Edit menu.
 */
export default function Tile({ id, group, scale, editor, hidden = false, first = false, last = false }: {
  id: string; group: string; scale: number; editor: Editor; hidden?: boolean; first?: boolean; last?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, data: { group, tile: id } });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const selected = editor.selected === id;

  return (
    <ContextMenu onOpenChange={open => open && editor.setSelected(id)}>
      <ContextMenuTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          type="button"
          title={id}
          data-tile={id}
          data-selected={selected || undefined}
          className={cn(
            'relative shrink-0 cursor-grab overflow-hidden rounded-lg bg-background leading-none ring-1 ring-border transition-shadow',
            'hover:ring-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected && 'ring-2 ring-primary',
            isDragging && 'opacity-30',
          )}
          onClick={() => editor.setSelected(id)}
          {...attributes}
          {...listeners}
        >
          <TileCanvas id={id} scale={scale} />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuLabel className="truncate font-mono text-xs">{id}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem onSelect={() => editor.setSelected(id)}>
            <SlidersHorizontalIcon />
            Properties
          </ContextMenuItem>
          <ContextMenuItem disabled={hidden || first} onSelect={() => editor.nudge(id, -1)}>
            <ArrowLeftIcon />
            Move left
            <ContextMenuShortcut>Alt+←</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={hidden || last} onSelect={() => editor.nudge(id, 1)}>
            <ArrowRightIcon />
            Move right
            <ContextMenuShortcut>Alt+→</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          {hidden ? (
            <ContextMenuItem onSelect={() => editor.showTile(id)}>
              <EyeIcon />
              Show on bar
              <ContextMenuShortcut>H</ContextMenuShortcut>
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onSelect={() => editor.hideTile(id)}>
              <EyeOffIcon />
              Hide
              <ContextMenuShortcut>H</ContextMenuShortcut>
            </ContextMenuItem>
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
