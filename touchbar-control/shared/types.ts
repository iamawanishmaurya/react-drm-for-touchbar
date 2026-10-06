// Types shared by the server and the web app. They mirror the sandbox
// endpoints the Touch Bar app serves (see linux-touchbar-control-center/
// index.tsx and lib/utils/layoutModel.ts).

/** The bar's editable layout (the app's BarLayout). */
export interface BarLayout {
  rightButtons: string[];
  hidden: string[];
  left: Record<string, Record<string, string[]>>;
  pinnedLeft: string | null;
}

/** An app the sandbox can pretend is focused, and the left panel it gets. */
export interface AppPreview {
  id: string;
  label: string;
  class: string;
  title: string;
  panel: string;
}

/** Built-in buttons, grouped — what can be arranged. */
export interface LayoutSchema {
  right: string[];
  left: Record<string, Record<string, string[]>>;
  panels: string[];
  apps?: AppPreview[];
}

export interface ActiveWindow { class: string; title: string; pid: number }

/** Whether the sandbox's bar actions really run, and what it simulated. */
export interface ActionsState {
  real: boolean;
  recent: { seq: number; at: number; what: string }[];
}

/** One id-tagged widget's geometry on the bar (the app's SceneBox). */
export interface SceneBox {
  id: string;
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; vw: number; vh: number;
  opacity: number;
  visible: boolean;
  parent?: string;
}

export interface Scene {
  width: number;
  height: number;
  boxes: SceneBox[];
}

export type SandboxState = 'stopped' | 'starting' | 'ready' | 'error';

/** Text messages the server pushes over /ws (frames are binary). */
export type ServerMessage =
  | { type: 'status'; sandbox: SandboxState; detail?: string }
  | { type: 'scene'; scene: Scene };

/** Touches the page sends over /ws, in bar pixels. */
export interface TouchMessage {
  type: 'touchstart' | 'touchmove' | 'touchend';
  x: number;
  y: number;
}

/** A layout the user saved under a name (server: ~/.config/touchbar-control). */
export interface SavedPreset {
  name: string;
  layout: BarLayout;
  savedAt: string;
}

/** A copy of config.ts taken before an Apply or a restore. */
export interface ConfigBackup {
  id: string;
  at: string;
  reason: 'before-apply' | 'before-restore';
  layout: BarLayout;
}

/** A top-level bar screen the sandbox can jump to (app/<id>). */
export interface BarScreen { id: string; label: string; group: string }
export interface ScreenState { current: string | null; screens: BarScreen[] }

/** "Live on Touch Bar": whether edits are mirrored onto the physical bar. */
export interface LiveState {
  enabled: boolean;
  /** The running bar offers live control (its socket exists). */
  available: boolean;
  /** Why it last changed, when that's worth telling (e.g. the bar restarted). */
  detail: string;
}
