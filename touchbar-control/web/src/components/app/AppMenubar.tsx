import {
  Menubar, MenubarCheckboxItem, MenubarContent, MenubarGroup, MenubarItem, MenubarLabel, MenubarMenu, MenubarRadioGroup,
  MenubarRadioItem, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger,
  MenubarTrigger,
} from '@/components/ui/menubar';
import type { Editor } from '@/lib/useEditor.ts';

export interface UiActions {
  openApply: () => void;
  openSavePreset: () => void;
  openConfig: () => void;
  openShortcuts: () => void;
  openCommand: () => void;
  openImport: () => void;
  openRestore: () => void;
}

/** File / Edit / View / Presets / Help — mtmr-designer's menu layout, acting
 *  on this editor. */
export default function AppMenubar({ editor, ui }: { editor: Editor; ui: UiActions }) {
  const editing = editor.mode === 'edit' && !!editor.state;
  const sel = editor.selected;
  const selHidden = !!(sel && editor.state && Object.values(editor.state.hidden).some(ids => ids.includes(sel)));
  const builtIn = editor.presets.filter(p => p.builtIn);
  const mine = editor.presets.filter(p => !p.builtIn);

  return (
    <Menubar className="border-none bg-transparent shadow-none">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem disabled={!editor.state} onSelect={ui.openImport}>
              Import layout… <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!editor.layout} onSelect={editor.exportFile}>
              Export layout <MenubarShortcut>Ctrl+E</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem disabled={!editor.dirty || editor.applying} onSelect={ui.openApply}>
              Apply to Touch Bar… <MenubarShortcut>Ctrl+Enter</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!editor.dirty} onSelect={editor.revert}>Revert to applied</MenubarItem>
            <MenubarItem disabled={editor.applying} onSelect={ui.openRestore}>Restore an earlier config…</MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem onSelect={editor.restartSandbox}>Reset sandbox bar</MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem disabled={!editor.canUndo} onSelect={editor.undo}>
              Undo <MenubarShortcut>Ctrl+Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!editor.canRedo} onSelect={editor.redo}>
              Redo <MenubarShortcut>Ctrl+Shift+Z</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem disabled={!editing || !sel} onSelect={() => sel && (selHidden ? editor.showTile(sel) : editor.hideTile(sel))}>
              {selHidden ? 'Show selected' : 'Hide selected'} <MenubarShortcut>H</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!editing || !sel || selHidden} onSelect={() => sel && editor.nudge(sel, -1)}>
              Move left <MenubarShortcut>Alt+←</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!editing || !sel || selHidden} onSelect={() => sel && editor.nudge(sel, 1)}>
              Move right <MenubarShortcut>Alt+→</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem disabled={!editor.state} onSelect={editor.resetToDefault}>Reset to built-in order</MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem onSelect={() => editor.setMode(editor.mode === 'edit' ? 'use' : 'edit')}>
              {editor.mode === 'edit' ? 'Use the bar' : 'Edit the layout'} <MenubarShortcut>E</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!editor.layout} onSelect={ui.openConfig}>Config…</MenubarItem>
            <MenubarCheckboxItem
              checked={editor.live.enabled}
              disabled={!editor.live.available && !editor.live.enabled}
              onCheckedChange={v => void editor.setLive(!!v)}
            >
              Live on Touch Bar
            </MenubarCheckboxItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger disabled={!editor.screen.screens.length}>Go to screen</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarRadioGroup value={editor.screen.current ?? ''} onValueChange={v => void editor.goScreen(v)}>
                {editor.screen.screens.map(s => <MenubarRadioItem key={s.id} value={s.id}>{s.label}</MenubarRadioItem>)}
              </MenubarRadioGroup>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarLabel>Preview as app</MenubarLabel>
          <MenubarRadioGroup
            value={editor.mode === 'edit' ? (editor.app?.id ?? '') : (editor.previewApp ?? '__real__')}
            onValueChange={v => editor.setPreviewApp(v === '__real__' ? null : v)}
          >
            {editor.mode === 'use' && <MenubarRadioItem value="__real__">Real focus</MenubarRadioItem>}
            {editor.apps.map(a => <MenubarRadioItem key={a.id} value={a.id}>{a.label}</MenubarRadioItem>)}
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem onSelect={() => void editor.setRealActions(!editor.actions.real)}>
              {editor.actions.real ? 'Simulate bar actions' : 'Allow real bar actions'}
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem onSelect={ui.openCommand}>
              Command palette <MenubarShortcut>Ctrl+K</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Presets</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Built-in</MenubarLabel>
          <MenubarGroup>
            {builtIn.map(p => (
              <MenubarItem key={p.id} disabled={!editor.state} onSelect={() => editor.applyPreset(p)}>{p.name}</MenubarItem>
            ))}
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarLabel>My presets</MenubarLabel>
          <MenubarGroup>
            {mine.length === 0 && <MenubarItem disabled>None saved yet</MenubarItem>}
            {mine.map(p => (
              <MenubarItem key={p.id} disabled={!editor.state} onSelect={() => editor.applyPreset(p)}>{p.name}</MenubarItem>
            ))}
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem disabled={!editor.layout} onSelect={ui.openSavePreset}>Save current as preset…</MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger disabled={mine.length === 0}>Delete preset</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarGroup>
                  {mine.map(p => (
                    <MenubarItem key={p.id} variant="destructive" onSelect={() => void editor.deletePreset(p.name)}>{p.name}</MenubarItem>
                  ))}
                </MenubarGroup>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem onSelect={ui.openShortcuts}>Keyboard shortcuts</MenubarItem>
            <MenubarItem onSelect={ui.openCommand}>
              Command palette <MenubarShortcut>Ctrl+K</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
