import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, MousePointerClickIcon } from 'lucide-react';
import TileCanvas from '@/components/bar/TileCanvas.tsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { bar } from '@/lib/bar.ts';
import { useBarState } from '@/lib/useBar.ts';
import { locate } from '@/lib/editModel.ts';
import type { Editor } from '@/lib/useEditor.ts';

/** The selected button: live preview, where it sits, and every action on it. */
export default function PropertiesPanel({ editor }: { editor: Editor }) {
  useBarState(); // the "on the bar" readout follows the live scene
  const id = editor.selected;
  const state = editor.state;

  if (!id || !state) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon"><MousePointerClickIcon /></EmptyMedia>
          <EmptyTitle>Nothing selected</EmptyTitle>
          <EmptyDescription>Click a button on the bar or in the palette to see its properties.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const at = locate(state, id);
  const group = editor.groups.find(g => g.key === at?.key);
  const count = at ? (state.order[at.key]?.length ?? 0) : 0;
  const box = bar.box(id);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4" data-properties={id}>
      <div className="flex items-center justify-center overflow-hidden rounded-lg border bg-background p-3">
        <span className="overflow-hidden rounded-md"><TileCanvas id={id} scale={1} /></span>
      </div>
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>ID</FieldTitle>
            <FieldDescription className="font-mono">{id}</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Group</FieldTitle>
            <FieldDescription>{group?.label ?? '—'}</FieldDescription>
          </FieldContent>
          {at?.hidden ? <Badge variant="outline">hidden</Badge> : <Badge variant="secondary">on bar</Badge>}
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Position</FieldTitle>
            <FieldDescription data-position>{at && !at.hidden ? `${at.index + 1} of ${count}` : 'not on the bar'}</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Rendered at</FieldTitle>
            <FieldDescription>
              {box && box.visible ? `x ${Math.round(box.x)} · ${Math.round(box.w)}×${Math.round(box.h)} px` : 'not showing right now'}
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
      <Separator />
      <Field>
        <FieldLabel>Arrange</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={!at || at.hidden || at.index === 0} onClick={() => editor.nudge(id, -1)}>
            <ArrowLeftIcon data-icon="inline-start" />
            Left
          </Button>
          <Button variant="outline" disabled={!at || at.hidden || at.index >= count - 1} onClick={() => editor.nudge(id, 1)}>
            Right
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
        {at?.hidden ? (
          <Button onClick={() => editor.showTile(id)}>
            <EyeIcon data-icon="inline-start" />
            Show on bar
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => editor.hideTile(id)}>
            <EyeOffIcon data-icon="inline-start" />
            Hide from bar
          </Button>
        )}
      </Field>
    </div>
  );
}
