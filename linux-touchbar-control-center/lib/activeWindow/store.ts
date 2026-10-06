import type { ActiveWindow } from './types';
import type { ActiveWindowBackend } from './types';
import { EMPTY } from './types';
import { hyprland } from './hyprland';
import { niri } from './niri';
import { gnome } from './gnome';
import { plasma } from './plasma';
import { xorg } from './xorg';
import { detectSession } from './detect';
import { ACTIVE_WINDOW } from '@/lib/utils/configLoader';
import { createLogger } from 'react-drm';

const log = createLogger('activeWindow');

// One backend connection shared by every useActiveWindow() consumer —
// refcounted so the socket closes when the last subscriber unmounts
// (which also keeps hot reloads from leaking connections).

type Listener = (w: ActiveWindow) => void;

const BACKENDS = [hyprland, niri, gnome, plasma, xorg]; // fallback probe order when detection is inconclusive

// Map the detected session to backends worth starting. Any Xorg session —
// GNOME included — exposes EWMH window properties over the X protocol, so the
// xprop backend handles it. The gnome (Window Monitor Pro) backend is only for
// GNOME *Wayland*, where the X protocol is blocked and the extension is the
// only window-focus source.
async function backendsForSession(): Promise<ActiveWindowBackend[]> {
  const s = await detectSession();

  // Xorg, whatever the desktop: EWMH props over the X protocol → xprop.
  if (s.type === 'xorg') return [xorg];

  // Wayland: each compositor needs its own focus source.
  if (s.desktop === 'hyprland') return [hyprland];
  if (s.desktop === 'niri')     return [niri];
  if (s.desktop === 'gnome')    return [gnome];
  if (s.desktop === 'plasma')   return [plasma]; // KWin scripting
  return BACKENDS; // unknown — probe everything
}

let current = EMPTY;   // what consumers see (the override, when one is set)
let real = EMPTY;      // what the compositor reports
// A sandbox preview can pretend a window is focused (touchbar-control's
// "Preview as app"); never set on the real bar.
let override: ActiveWindow | null = null;
const listeners = new Set<Listener>();
let stop: (() => void) | null = null;
let starting = false;

function emit(w: ActiveWindow): void {
  if (w.class === current.class && w.title === current.title && w.pid === current.pid) return;
  current = w;
  listeners.forEach(l => l(w));
}

function push(w: ActiveWindow): void {
  real = w;
  if (!override) emit(w);
}

/** Pretend `w` is focused (null: follow the compositor again). */
export function setActiveWindowOverride(w: ActiveWindow | null): void {
  override = w;
  emit(override ?? real);
}

export function getActiveWindowState(): { override: ActiveWindow | null; real: ActiveWindow } {
  return { override, real };
}

async function ensureStarted(): Promise<void> {
  if (stop || starting) return;
  starting = true;
  const order = ACTIVE_WINDOW.backend === 'auto'
    ? await backendsForSession()
    : BACKENDS.filter(b => b.name.startsWith(ACTIVE_WINDOW.backend));
  for (const backend of order) {
    try {
      const s = await backend.start(push);
      if (s) {
        stop = s;
        break;
      }
    } catch { /* try next */ }
  }
  starting = false;
  if (!stop) log.warn('no active-window backend available');
  else if (listeners.size === 0) { stop(); stop = null; real = EMPTY; if (!override) current = EMPTY; } // everyone left mid-start
}

export function getActiveWindow(): ActiveWindow {
  return current;
}

export function subscribeActiveWindow(listener: Listener): () => void {
  listeners.add(listener);
  void ensureStarted();
  listener(current);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stop) {
      stop();
      stop = null;
      real = EMPTY;
      if (!override) current = EMPTY;
    }
  };
}
