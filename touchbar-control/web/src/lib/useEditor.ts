/**
 * The editor's state and every action on it, in one place. The menubar, the
 * command palette, context menus, the properties panel and keyboard shortcuts
 * all call these same functions, so they can't drift apart.
 *
 * Each edit: history (undo/redo) → local state → pushed to the sandbox, which
 * re-renders the real bar in place.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from './api.ts';
import { createHistory, push, undo as undoH, redo as redoH, canUndo, canRedo, type History } from './history.ts';
import {
  fromLayout, toLayout, groupsFor, sameLayout, hide, show, moveTo, locate, RIGHT, type EditState,
} from './editModel.ts';
import { builtInPresets, type Preset } from './presets.ts';
import { exportLayoutFile, parseLayoutFile } from './layoutFile.ts';
import { configText } from '../../../shared/layoutConfig.ts';
import type { ActionsState, AppPreview, BarLayout, ConfigBackup, LayoutSchema, LiveState, SavedPreset, ScreenState } from '../../../shared/types.ts';

export type Mode = 'use' | 'edit';

/** Edit mode always previews an app (its left panel is what gets arranged). */
const DEFAULT_EDIT_APP = 'vscode';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useEditor() {
  const [mode, setModeState] = useState<Mode>('use');
  const [schema, setSchema] = useState<LayoutSchema | null>(null);
  const [history, setHistory] = useState<History<EditState> | null>(null);
  const [applied, setApplied] = useState<BarLayout | null>(null);
  // "Preview as app": the app the sandbox pretends is focused. null = follow
  // the real focus (Use mode only).
  const [previewApp, setPreviewAppState] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionsState>({ real: false, recent: [] });
  const [screen, setScreen] = useState<ScreenState>({ current: null, screens: [] });
  // "Live on Touch Bar": edits mirrored onto the physical bar.
  const [live, setLiveState] = useState<LiveState>({ enabled: false, available: false, detail: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const [myPresets, setMyPresets] = useState<SavedPreset[]>([]);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [s, current, base, mine] = await Promise.all([api.schema(), api.layout(), api.applied(), api.presets()]);
        if (cancelled) return;
        setSchema(s);
        setHistory(createHistory(fromLayout(current, s)));
        setApplied(base);
        setMyPresets(mine);
        // Panels follow the previewed app now; clear any pin left by an older page.
        if (current.pinnedLeft) void api.setLayout({ pinnedLeft: null });
        setLoadError('');
      } catch (e) {
        if (cancelled) return;
        setLoadError(errorText(e));
        setTimeout(load, 2000); // the sandbox may still be booting
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // The sandbox pretends the previewed app is focused, so the whole bar reacts
  // exactly as it would to that app (panel, per-app keys, accents).
  const apps: AppPreview[] = schema?.apps ?? [];
  const effectiveApp = mode === 'edit' ? (previewApp ?? DEFAULT_EDIT_APP) : previewApp;
  const app = apps.find(a => a.id === effectiveApp) ?? null;
  useEffect(() => {
    if (!schema) return;
    api.setActiveWindow(app ? { class: app.class, title: app.title } : null).catch(e => toast.error(errorText(e)));
  }, [schema, app]);

  // Bar actions (keys, launches) are simulated in the sandbox unless switched
  // to real. Poll what it simulated and report each once.
  const lastSeq = useRef(0);
  const primed = useRef(false); // the first poll only records where we are
  useEffect(() => {
    if (!schema) return;
    let stopped = false;
    const poll = async () => {
      try {
        const [st, sc, lv] = await Promise.all([api.actions(), api.screen(), api.live()]);
        if (stopped) return;
        setScreen(sc);
        setLiveState(prev => {
          // The bar ended the live session (restarted after an Apply…): say so once.
          if (prev.enabled && !lv.enabled && lv.detail) toast(`Live on Touch Bar is off — ${lv.detail}`);
          return lv;
        });
        const newest = Math.max(0, ...st.recent.map(r => r.seq));
        if (newest < lastSeq.current) lastSeq.current = 0; // sandbox restarted: counter reset
        if (primed.current) {
          for (const r of st.recent) {
            if (r.seq > lastSeq.current) toast(`Simulated: ${r.what}`, { description: 'Turn on Real actions to let the bar do it.' });
          }
        }
        lastSeq.current = Math.max(lastSeq.current, newest);
        primed.current = true;
        setActions(st);
      } catch { /* sandbox restarting */ }
    };
    void poll();
    const t = window.setInterval(poll, 1000);
    return () => { stopped = true; window.clearInterval(t); };
  }, [schema]);

  // ── Sandbox sync ──────────────────────────────────────────────────────────
  const syncTimer = useRef<number | undefined>(undefined);
  const sync = useCallback((state: EditState) => {
    if (!schema) return;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      const { rightButtons, hidden, left } = toLayout(state, schema);
      api.setLayout({ rightButtons, hidden, left }).catch(e => toast.error(errorText(e)));
    }, 60);
  }, [schema]);

  const state = history?.present ?? null;

  /** Every edit goes through here: recorded for undo, then shown live. */
  const commit = useCallback((next: EditState) => {
    setHistory(h => (h ? push(h, next) : h));
    sync(next);
  }, [sync]);

  const undo = useCallback(() => {
    if (!history || !canUndo(history)) return;
    const h = undoH(history);
    setHistory(h);
    sync(h.present);
  }, [history, sync]);

  const redo = useCallback(() => {
    if (!history || !canRedo(history)) return;
    const h = redoH(history);
    setHistory(h);
    sync(h.present);
  }, [history, sync]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const layout = useMemo(() => (schema && state ? toLayout(state, schema) : null), [schema, state]);
  const dirty = !!(schema && layout && applied && !sameLayout(layout, applied, schema));
  const groups = useMemo(() => (schema ? groupsFor(schema) : []), [schema]);
  const panel = app?.panel ?? 'index';
  const panelEditable = !!schema?.left[panel];
  const shownGroups = useMemo(() => groups.filter(g => g.key === RIGHT || g.page === panel), [groups, panel]);
  const presets: Preset[] = useMemo(() => [
    ...(schema ? builtInPresets(schema) : []),
    ...myPresets.map(p => ({ id: `mine:${p.name}`, name: p.name, description: `Saved ${new Date(p.savedAt).toLocaleString()}`, layout: p.layout, builtIn: false })),
  ], [schema, myPresets]);
  const counts = useMemo(() => {
    const visible = state ? shownGroups.reduce((n, g) => n + (state.order[g.key]?.length ?? 0), 0) : 0;
    const hidden = state ? shownGroups.reduce((n, g) => n + (state.hidden[g.key]?.length ?? 0), 0) : 0;
    return { visible, hidden };
  }, [state, shownGroups]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const loadLayout = useCallback((l: BarLayout, message?: string) => {
    if (!schema) return;
    commit(fromLayout(l, schema));
    if (message) toast(message);
  }, [schema, commit]);

  const revert = useCallback(() => {
    if (applied) loadLayout(applied, 'Reverted to the layout your Touch Bar is using.');
  }, [applied, loadLayout]);

  const resetToDefault = useCallback(() => {
    if (!schema) return;
    loadLayout(builtInPresets(schema)[0].layout, 'Reset to the built-in order.');
  }, [schema, loadLayout]);

  const applyPreset = useCallback((p: Preset) => loadLayout(p.layout, `Loaded preset “${p.name}”.`), [loadLayout]);

  /** Puts an earlier config.ts back (restarting the bar) and shows it here. */
  const restoreBackup = useCallback(async (backup: ConfigBackup) => {
    setApplying(true);
    const id = toast.loading('Restoring the earlier config and restarting your Touch Bar…');
    try {
      const res = await api.restoreBackup(backup.id);
      if (res.ok) toast.success(res.message, { id }); else toast.error(res.message, { id });
      const base = await api.applied();
      setApplied(base);
      if (schema) commit(fromLayout(base, schema));
    } catch (e) {
      toast.error(errorText(e), { id });
    } finally {
      setApplying(false);
    }
  }, [schema, commit]);

  const apply = useCallback(async () => {
    setApplying(true);
    const id = toast.loading('Saving to config.ts and restarting your Touch Bar…');
    try {
      const res = await api.apply();
      // Every Apply keeps the previous config.ts — offer to put it back.
      const undo = { label: 'Undo', onClick: () => void restoreBackup(res.backup) };
      if (res.ok) toast.success(res.message, { id, action: undo, duration: 15000 });
      else toast.error(res.message, { id, action: undo });
      setApplied(await api.applied());
    } catch (e) {
      toast.error(errorText(e), { id });
    } finally {
      setApplying(false);
    }
  }, [restoreBackup]);

  const setLive = useCallback(async (enabled: boolean) => {
    try {
      const st = await api.setLive(enabled);
      setLiveState(st);
      toast(enabled ? 'Live on Touch Bar — your edits now show on the physical bar.' : 'Live off — the Touch Bar is back to its saved layout.');
    } catch (e) { toast.error(errorText(e)); }
  }, []);

  const goScreen = useCallback(async (to: string) => {
    try { setScreen(await api.goScreen(to)); } catch (e) { toast.error(errorText(e)); }
  }, []);

  const withSelected = useCallback((fn: (s: EditState, id: string) => EditState) => {
    if (state && selected) commit(fn(state, selected));
  }, [state, selected, commit]);

  const hideTile = useCallback((id: string) => { if (state) commit(hide(state, id)); }, [state, commit]);
  const showTile = useCallback((id: string) => { if (state) commit(show(state, id)); }, [state, commit]);
  const nudge = useCallback((id: string, delta: -1 | 1) => {
    if (!state) return;
    const at = locate(state, id);
    if (!at || at.hidden) return;
    commit(moveTo(state, id, at.key, at.index + delta));
  }, [state, commit]);

  const savePreset = useCallback(async (name: string) => {
    if (!layout) return;
    try {
      setMyPresets(await api.savePreset(name, layout));
      toast.success(`Saved preset “${name.trim()}”.`);
    } catch (e) { toast.error(errorText(e)); throw e; }
  }, [layout]);

  const deletePreset = useCallback(async (name: string) => {
    try {
      setMyPresets(await api.deletePreset(name));
      toast(`Deleted preset “${name}”.`);
    } catch (e) { toast.error(errorText(e)); }
  }, []);

  const exportFile = useCallback(() => {
    if (!layout) return;
    const blob = new Blob([exportLayoutFile(layout)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `touchbar-layout-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [layout]);

  const importFile = useCallback(async (file: File) => {
    try {
      loadLayout(parseLayoutFile(await file.text()), `Imported ${file.name}.`);
    } catch (e) {
      toast.error(`Couldn't import ${file.name}: ${errorText(e)}`);
    }
  }, [loadLayout]);

  const setMode = useCallback((m: Mode) => { setModeState(m); if (m === 'use') setSelected(null); }, []);
  const setPreviewApp = useCallback((id: string | null) => { setPreviewAppState(id); setSelected(null); }, []);
  const setRealActions = useCallback(async (real: boolean) => {
    try { setActions(await api.setActions(real)); toast(real ? 'Real actions on — taps now press keys and launch apps.' : 'Actions simulated again.'); }
    catch (e) { toast.error(errorText(e)); }
  }, []);

  return {
    // state
    mode, schema, state, applied, panel, panelEditable, selected, loadError, applying, layout, dirty,
    groups, shownGroups, presets, counts, apps, previewApp, app, actions, screen, live,
    canUndo: !!history && canUndo(history),
    canRedo: !!history && canRedo(history),
    undoDepth: history?.past.length ?? 0,
    configText: layout ? configText(layout) : '',
    // actions
    setMode, setPreviewApp, setRealActions, setSelected, commit, undo, redo, revert, resetToDefault, apply, applyPreset,
    goScreen, restoreBackup, listBackups: api.backups, setLive,
    hideTile, showTile, nudge, withSelected, savePreset, deletePreset, exportFile, importFile,
    restartSandbox: () => api.restartSandbox().then(() => toast('Sandbox bar restarted.')).catch(e => toast.error(errorText(e))),
  };
}

export type Editor = ReturnType<typeof useEditor>;
