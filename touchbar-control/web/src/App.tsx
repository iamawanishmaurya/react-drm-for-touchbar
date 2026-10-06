import { useEffect, useRef, useState } from 'react';
import { MonitorIcon, PencilRulerIcon, PointerIcon, RotateCcwIcon, SendIcon } from 'lucide-react';
import UseView from '@/components/app/UseView.tsx';
import AppMenubar, { type UiActions } from '@/components/app/AppMenubar.tsx';
import CommandMenu from '@/components/app/CommandMenu.tsx';
import EditWorkspace from '@/components/app/EditWorkspace.tsx';
import { ApplyDialog, ConfigSheet, SavePresetDialog, ShortcutsDialog } from '@/components/app/Dialogs.tsx';
import RestoreDialog from '@/components/app/RestoreDialog.tsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useBarState } from '@/lib/useBar.ts';
import { useEditor, type Mode } from '@/lib/useEditor.ts';

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export default function App() {
  const editor = useEditor();
  const { status } = useBarState();
  const [applyOpen, setApplyOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ui: UiActions = {
    openApply: () => setApplyOpen(true),
    openSavePreset: () => setSaveOpen(true),
    openConfig: () => setConfigOpen(true),
    openShortcuts: () => setShortcutsOpen(true),
    openCommand: () => setCommandOpen(true),
    openImport: () => fileRef.current?.click(),
    openRestore: () => setRestoreOpen(true),
  };

  // Global shortcuts. Dialogs own their own keys (radix), so only act when
  // none is open and no text field has focus.
  const anyDialog = applyOpen || saveOpen || configOpen || shortcutsOpen || commandOpen || restoreOpen;
  const latest = useRef({ editor, ui, anyDialog });
  latest.current = { editor, ui, anyDialog };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { editor: ed, ui: u, anyDialog: dialog } = latest.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen(o => !o); return; }
      if (dialog || typing(e.target)) return;
      const sel = ed.selected;
      const selHidden = !!(sel && ed.state && Object.values(ed.state.hidden).some(ids => ids.includes(sel)));
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) ed.redo(); else ed.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); ed.redo(); return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); if (ed.dirty) u.openApply(); return; }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); ed.exportFile(); return; }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); u.openImport(); return; }
      if (mod || (e.altKey && !['ArrowLeft', 'ArrowRight'].includes(e.key))) return;
      if (e.key === 'e' || e.key === 'E') { ed.setMode(ed.mode === 'edit' ? 'use' : 'edit'); return; }
      if (ed.mode !== 'edit') return;
      if (e.key === 'Escape') { ed.setSelected(null); return; }
      if (!sel) return;
      if (e.key === 'h' || e.key === 'H' || e.key === 'Delete') { if (selHidden) ed.showTile(sel); else ed.hideTile(sel); return; }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); ed.nudge(sel, -1); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); ed.nudge(sel, 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const live = status.socket === 'open' && status.sandbox === 'ready';

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
        <div className="flex items-center gap-2 pr-2 text-lg font-semibold">
          <MonitorIcon className="size-5 text-primary" />
          touchbar-control
        </div>
        <AppMenubar editor={editor} ui={ui} />
        <ToggleGroup
          type="single"
          variant="outline"
          value={editor.mode}
          onValueChange={v => v && editor.setMode(v as Mode)}
          aria-label="Mode"
          className="ml-2"
        >
          <ToggleGroupItem value="use" aria-label="Use the bar"><PointerIcon />Use</ToggleGroupItem>
          <ToggleGroupItem value="edit" aria-label="Edit the layout"><PencilRulerIcon />Edit</ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto flex items-center gap-2">
          {editor.mode === 'edit' && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5" data-live-toggle>
                    <Switch
                      id="live-on-bar"
                      checked={editor.live.enabled}
                      disabled={!editor.live.available && !editor.live.enabled}
                      onCheckedChange={v => void editor.setLive(v)}
                    />
                    <Label htmlFor="live-on-bar">Live on Touch Bar</Label>
                    {editor.live.enabled && <Badge variant="destructive">live</Badge>}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {editor.live.available || editor.live.enabled
                    ? 'Show every edit on your physical Touch Bar right away. Apply keeps it; turning Live off (or closing this site) puts the saved layout back.'
                    : 'The running Touch Bar service doesn\'t offer live control — deploy the latest app and restart it.'}
                </TooltipContent>
              </Tooltip>
              <Button variant="ghost" disabled={!editor.dirty} onClick={editor.revert}>
                <RotateCcwIcon data-icon="inline-start" />
                Revert
              </Button>
              <Button disabled={!editor.dirty || editor.applying} onClick={ui.openApply} data-apply>
                {editor.applying ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
                Apply to Touch Bar
              </Button>
              <Separator orientation="vertical" className="h-5" />
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={live ? 'secondary' : status.sandbox === 'error' || status.socket === 'closed' ? 'destructive' : 'outline'} data-status>
                {live ? `live · ${status.fps} fps` : status.socket !== 'open' ? 'offline' : status.sandbox}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{status.detail || 'Sandbox Touch Bar — frames and touches stream over /ws'}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {editor.mode === 'use' ? (
          <UseView editor={editor} />
        ) : (
          <EditWorkspace editor={editor} />
        )}
      </main>

      <footer className="flex h-9 shrink-0 items-center gap-3 border-t px-4 text-sm text-muted-foreground" data-statusbar>
        {editor.state ? (
          <>
            <span>{editor.counts.visible} on bar</span>
            <span>{editor.counts.hidden} hidden</span>
            <Separator orientation="vertical" className="h-3.5" />
            <span>Previewing: {editor.app ? `${editor.app.label} (${editor.panel === 'index' ? 'default' : editor.panel} panel)` : 'real focus'}</span>
            <Separator orientation="vertical" className="h-3.5" />
            <span>Actions: {editor.actions.real ? 'real' : 'simulated'}</span>
            <Separator orientation="vertical" className="h-3.5" />
            <span data-live-status>Physical bar: {editor.live.enabled ? 'live preview of your edits' : 'saved layout'}</span>
            <Separator orientation="vertical" className="h-3.5" />
            <span>{editor.undoDepth} {editor.undoDepth === 1 ? 'edit' : 'edits'} to undo</span>
            <Badge variant={editor.dirty ? 'outline' : 'secondary'} className="ml-auto" data-dirty={editor.dirty}>
              {editor.dirty ? 'Not applied yet' : 'Matches your Touch Bar'}
            </Badge>
          </>
        ) : (
          <span>Connecting to the Touch Bar…</span>
        )}
      </footer>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-import
        onChange={e => { const f = e.target.files?.[0]; if (f) void editor.importFile(f); e.target.value = ''; }}
      />
      <ApplyDialog open={applyOpen} onOpenChange={setApplyOpen} editor={editor} />
      <SavePresetDialog open={saveOpen} onOpenChange={setSaveOpen} editor={editor} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ConfigSheet open={configOpen} onOpenChange={setConfigOpen} editor={editor} />
      <RestoreDialog open={restoreOpen} onOpenChange={setRestoreOpen} editor={editor} />
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} editor={editor} ui={ui} />
    </div>
  );
}
