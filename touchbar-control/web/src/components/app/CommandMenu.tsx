import {
  AppWindowIcon, BookmarkIcon, HistoryIcon, LayersIcon, RadioIcon, DownloadIcon, FileCode2Icon, KeyboardIcon, PencilRulerIcon, PointerIcon, Redo2Icon,
  RotateCcwIcon, SendIcon, SquareMousePointerIcon, Undo2Icon, UploadIcon,
} from 'lucide-react';
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  CommandSeparator, CommandShortcut,
} from '@/components/ui/command';
import type { Editor } from '@/lib/useEditor.ts';
import type { UiActions } from './AppMenubar.tsx';

/** ⌘K: every menu action, every button (select it), every preset. */
export default function CommandMenu({ open, onOpenChange, editor, ui }: {
  open: boolean; onOpenChange: (open: boolean) => void; editor: Editor; ui: UiActions;
}) {
  const run = (fn: () => void) => () => { onOpenChange(false); fn(); };
  const tiles = editor.state
    ? editor.shownGroups.flatMap(g => [...(editor.state!.order[g.key] ?? []), ...(editor.state!.hidden[g.key] ?? [])]
      .map(id => ({ id, group: g.label })))
    : [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput placeholder="Type a command or a button name…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={run(() => editor.setMode(editor.mode === 'edit' ? 'use' : 'edit'))}>
              {editor.mode === 'edit' ? <PointerIcon /> : <PencilRulerIcon />}
              {editor.mode === 'edit' ? 'Use the bar' : 'Edit the layout'}
              <CommandShortcut>E</CommandShortcut>
            </CommandItem>
            <CommandItem disabled={!editor.canUndo} onSelect={run(editor.undo)}>
              <Undo2Icon />Undo<CommandShortcut>Ctrl+Z</CommandShortcut>
            </CommandItem>
            <CommandItem disabled={!editor.canRedo} onSelect={run(editor.redo)}>
              <Redo2Icon />Redo<CommandShortcut>Ctrl+Shift+Z</CommandShortcut>
            </CommandItem>
            <CommandItem disabled={!editor.dirty} onSelect={run(ui.openApply)}>
              <SendIcon />Apply to Touch Bar…<CommandShortcut>Ctrl+Enter</CommandShortcut>
            </CommandItem>
            <CommandItem disabled={!editor.dirty} onSelect={run(editor.revert)}>
              <RotateCcwIcon />Revert to applied
            </CommandItem>
            <CommandItem disabled={!editor.layout} onSelect={run(ui.openConfig)}>
              <FileCode2Icon />Show config
            </CommandItem>
            <CommandItem disabled={!editor.layout} onSelect={run(editor.exportFile)}>
              <DownloadIcon />Export layout
            </CommandItem>
            <CommandItem disabled={!editor.state} onSelect={run(ui.openImport)}>
              <UploadIcon />Import layout…
            </CommandItem>
            <CommandItem disabled={!editor.live.available && !editor.live.enabled} onSelect={run(() => void editor.setLive(!editor.live.enabled))}>
              <RadioIcon />{editor.live.enabled ? 'Turn off Live on Touch Bar' : 'Live on Touch Bar'}
            </CommandItem>
            <CommandItem onSelect={run(ui.openRestore)}>
              <HistoryIcon />Restore an earlier config…
            </CommandItem>
            <CommandItem onSelect={run(ui.openShortcuts)}>
              <KeyboardIcon />Keyboard shortcuts
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Buttons">
            {tiles.map(t => (
              <CommandItem key={t.id} value={`button ${t.id} ${t.group}`} onSelect={run(() => { editor.setMode('edit'); editor.setSelected(t.id); })}>
                <SquareMousePointerIcon />
                <span className="font-mono">{t.id}</span>
                <span className="ml-auto text-xs text-muted-foreground">{t.group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Go to screen">
            {editor.screen.screens.map(sc => (
              <CommandItem key={sc.id} value={`screen ${sc.label} ${sc.id}`} onSelect={run(() => void editor.goScreen(sc.id))}>
                <LayersIcon />
                {sc.label}
                {editor.screen.current === sc.id && <span className="ml-auto text-xs text-muted-foreground">showing</span>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Preview as app">
            {editor.apps.map(a => (
              <CommandItem key={a.id} value={`preview ${a.label} ${a.class}`} onSelect={run(() => editor.setPreviewApp(a.id))}>
                <AppWindowIcon />
                {a.label}
                <span className="ml-auto text-xs text-muted-foreground">{a.panel === 'index' ? 'default panel' : `${a.panel} panel`}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Presets">
            {editor.presets.map(p => (
              <CommandItem key={p.id} value={`preset ${p.name}`} disabled={!editor.state} onSelect={run(() => editor.applyPreset(p))}>
                <BookmarkIcon />
                {p.name}
                <span className="ml-auto truncate text-xs text-muted-foreground">{p.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
