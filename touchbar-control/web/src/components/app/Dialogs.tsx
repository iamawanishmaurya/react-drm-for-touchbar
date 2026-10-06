import { useEffect, useState, type FormEvent } from 'react';
import { CheckIcon, CopyIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Editor } from '@/lib/useEditor.ts';

interface OpenProps { open: boolean; onOpenChange: (open: boolean) => void }

/** Apply restarts the physical bar — confirm first. */
export function ApplyDialog({ open, onOpenChange, editor }: OpenProps & { editor: Editor }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><TriangleAlertIcon /></AlertDialogMedia>
          <AlertDialogTitle>Apply this layout to your Touch Bar?</AlertDialogTitle>
          <AlertDialogDescription>
            It is saved to <code>config.ts</code> and the <code>react-drm</code> service restarts — the physical bar
            goes blank for a few seconds while it comes back with the new layout.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void editor.apply()}>Apply and restart</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SavePresetDialog({ open, onOpenChange, editor }: OpenProps & { editor: Editor }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(''); setError(''); } }, [open]);
  const exists = editor.presets.some(p => !p.builtIn && p.name === name.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the preset a name.'); return; }
    try { await editor.savePreset(name); onOpenChange(false); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Save layout as preset</DialogTitle>
            <DialogDescription>Keeps the current arrangement under a name, to load again from the Presets menu.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="preset-name">Name</FieldLabel>
              <Input
                id="preset-name"
                autoFocus
                maxLength={60}
                value={name}
                aria-invalid={!!error || undefined}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="e.g. Coding"
              />
              {error ? <FieldError>{error}</FieldError>
                : exists ? <FieldDescription>A preset with this name exists — saving replaces it.</FieldDescription>
                : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
            <Button type="submit">{exists ? 'Replace preset' : 'Save preset'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SHORTCUTS: [string[], string][] = [
  [['Ctrl', 'K'], 'Command palette'],
  [['Ctrl', 'Z'], 'Undo'],
  [['Ctrl', 'Shift', 'Z'], 'Redo'],
  [['H'], 'Hide / show the selected button'],
  [['Alt', '←'], 'Move the selected button left'],
  [['Alt', '→'], 'Move the selected button right'],
  [['Esc'], 'Clear the selection'],
  [['E'], 'Switch between Use and Edit'],
  [['Ctrl', 'Enter'], 'Apply to Touch Bar'],
  [['Ctrl', 'E'], 'Export layout'],
  [['Ctrl', 'O'], 'Import layout'],
];

export function ShortcutsDialog({ open, onOpenChange }: OpenProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Editing shortcuts work in Edit mode, when no text field has focus.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <KbdGroup>{keys.map(k => <Kbd key={k}>{k}</Kbd>)}</KbdGroup>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The exact config sections Apply would write, copyable. */
export function ConfigSheet({ open, onOpenChange, editor }: OpenProps & { editor: Editor }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editor.configText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('Copy failed — select the text instead.'); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Config</SheetTitle>
          <SheetDescription>
            What <b>Apply</b> writes to <code>config.ts</code> for this layout ({editor.dirty ? 'not applied yet' : 'matches your Touch Bar'}).
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4">
          <pre data-config className="w-max min-w-full rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">{editor.configText}</pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <SheetFooter>
          <Button variant="outline" onClick={copy}>
            {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
