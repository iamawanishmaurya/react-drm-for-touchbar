import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronRightIcon, SearchIcon } from 'lucide-react';
import TileCanvas from '@/components/bar/TileCanvas.tsx';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { PALETTE_PREFIX } from '@/lib/drop.ts';
import { configKey, type EditGroup } from '@/lib/editModel.ts';
import type { Editor } from '@/lib/useEditor.ts';

function PaletteRow({ id, label, hidden, editor }: { id: string; label: string; hidden: boolean; editor: Editor }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${PALETTE_PREFIX}${id}`, data: { tile: id } });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-palette={id}
      onClick={() => editor.setSelected(id)}
      className={cn(
        'flex w-full cursor-grab items-center gap-3 rounded-lg border px-2.5 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        editor.selected === id && 'bg-accent',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
    >
      <span className="overflow-hidden rounded-md ring-1 ring-border">
        <TileCanvas id={id} scale={0.45} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hidden && <Badge variant="outline">hidden</Badge>}
    </button>
  );
}

/** Everything that can be placed, grouped as on the bar; searchable; drag a
 *  row onto the bar to place it (showing it again if hidden). */
export default function Palette({ editor }: { editor: Editor }) {
  const [query, setQuery] = useState('');
  const state = editor.state;
  const q = query.trim().toLowerCase();

  const sections = editor.shownGroups.map((g: EditGroup) => {
    const ids = [...(state?.order[g.key] ?? []), ...(state?.hidden[g.key] ?? [])];
    const rows = ids
      .map(id => ({ id, label: configKey(g.page, id), hidden: !!state?.hidden[g.key]?.includes(id) }))
      .filter(r => !q || r.id.toLowerCase().includes(q) || g.label.toLowerCase().includes(q));
    return { group: g, rows };
  }).filter(s => s.rows.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Palette</h2>
        <span className="text-sm text-muted-foreground">Everything you can place — drag onto the bar</span>
      </div>
      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search buttons…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search buttons" />
      </InputGroup>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 pr-2">
          {sections.map(({ group, rows }) => (
            <Collapsible key={group.key} defaultOpen className="group/section">
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground">
                <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]/section:rotate-90" />
                {group.label}
                <Badge variant="secondary" className="ml-auto">{rows.length}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2 pt-2">
                {rows.map(r => <PaletteRow key={r.id} {...r} editor={editor} />)}
              </CollapsibleContent>
            </Collapsible>
          ))}
          {sections.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No buttons match</EmptyTitle>
                <EmptyDescription>Try another search.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
