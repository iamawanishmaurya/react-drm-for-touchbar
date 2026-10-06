import { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { EditBar, HiddenTray, TRAY } from '@/components/bar/EditBar.tsx';
import TileCanvas from '@/components/bar/TileCanvas.tsx';
import LiveBar from '@/components/bar/LiveBar.tsx';
import Palette from './Palette.tsx';
import PropertiesPanel from './PropertiesPanel.tsx';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import AppPicker from './AppPicker.tsx';
import PhysicalBar from './PhysicalBar.tsx';
import { bar } from '@/lib/bar.ts';
import { useBarState } from '@/lib/useBar.ts';
import { applyDrop, dragIdToTile, type DropTarget } from '@/lib/drop.ts';
import type { Editor } from '@/lib/useEditor.ts';

/** The bar, big and full-width (tiles, hidden tray, live result), with the
 *  palette and properties side by side below — one drag-and-drop context
 *  across all of it (palette rows drop onto the bar). */
export default function EditWorkspace({ editor }: { editor: Editor }) {
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click still selects.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = dragIdToTile(String(e.active.id));
    setActive(id);
    editor.setSelected(id);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const state = editor.state;
    if (!state || !e.over) return;
    const id = dragIdToTile(String(e.active.id));
    const group = e.over.data.current?.group as string | undefined;
    if (!group) return;
    const overTile = e.over.data.current?.tile as string | undefined;
    const target: DropTarget = group === TRAY ? { kind: 'tray' } : { kind: 'group', group, beforeId: overTile };
    const next = applyDrop(state, id, target);
    if (next === 'refused') toast('Buttons stay in their own group — drop it back where it came from.');
    else if (next !== state) editor.commit(next);
  };

  useBarState(); // re-check the "app not running" notice as the scene changes
  const panelTiles = editor.state
    ? editor.shownGroups.filter(g => g.page === editor.panel).flatMap(g => editor.state!.order[g.key] ?? [])
    : [];
  const panelDark = editor.panelEditable && panelTiles.length > 0 && !panelTiles.some(id => bar.box(id)?.visible);

  if (!editor.state) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-14 w-full" />
        {editor.loadError && <p className="text-sm text-muted-foreground">Waiting for the Touch Bar… ({editor.loadError})</p>}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-4 border-b p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Layout</h2>
            <span className="text-sm text-muted-foreground">Drag to reorder · right-click for more · drag to Hidden to remove</span>
            <div className="ml-auto"><AppPicker editor={editor} /></div>
          </div>
          {!editor.panelEditable && editor.app && (
            <Alert>
              <InfoIcon />
              <AlertTitle>{editor.app.label} uses the {editor.panel === 'index' ? 'default' : editor.panel} panel, which can't be arranged yet</AlertTitle>
              <AlertDescription>Only the right cluster is editable here. Preview VS Code, Firefox or Chrome to arrange a left panel.</AlertDescription>
            </Alert>
          )}
          {panelDark && editor.app && (
            <Alert>
              <InfoIcon />
              <AlertTitle>{editor.app.label} isn't running, so its buttons can't be drawn live</AlertTitle>
              <AlertDescription>Its tiles show their names — you can still arrange and hide them. Start {editor.app.label} to see the real buttons.</AlertDescription>
            </Alert>
          )}
          <EditBar editor={editor} />
          <HiddenTray editor={editor} />
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Live result</h3>
            <LiveBar interactive={false} compact />
          </div>
          <PhysicalBar editor={editor} />
        </div>
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize="66%" minSize="35%" className="min-h-0">
            <Palette editor={editor} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="34%" minSize="22%" className="min-h-0">
            <PropertiesPanel editor={editor} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <DragOverlay>
        {active && (
          <div className="overflow-hidden rounded-lg shadow-2xl ring-2 ring-primary">
            <TileCanvas id={active} scale={0.9} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
