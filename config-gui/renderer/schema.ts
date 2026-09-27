import type { SectionName } from './types.js';

// Single source of truth for the page structure: which config sections live
// on which page, their labels/descriptions, and union-field option lists.
// Per Phase 1 CONTEXT D-01: SCREENSHOT is a Shortcuts item; DOLPHIN, KONSOLE
// and CAVA are Advanced (hidden by default). Every SectionName maps to
// exactly one page — schema.test.ts asserts that.

export type PageId = 'layout' | 'dock' | 'shortcuts' | 'behavior' | 'advanced';

/** All editable config sections — must match `SECTION_NAMES` in
 *  `main/configEngine.ts` (kept in sync by schema.test.ts). */
export const SECTION_NAMES: SectionName[] = [
  'DISPLAY', 'ESC_KEY', 'SLEEP', 'LAYER_TRANSITION', 'ACTIVE_WINDOW',
  'SCREENSHOT', 'DOLPHIN', 'KONSOLE', 'SYSTEMBAR', 'CAVA',
  'DEFAULT_BROWSER_KEYS', 'BROWSER_KEY_OVERRIDES',
  'DEFAULT_VSCODE_KEYS', 'VSCODE_KEY_OVERRIDES',
  'DOCK', 'FN_LAYER', 'FN_KEYS',
];

export interface PageDef {
  id: PageId;
  label: string;
  description: string;
  sections: SectionName[];
  advanced?: boolean;
}

export const PAGES: PageDef[] = [
  {
    id: 'layout',
    label: 'Layout',
    description: 'Arrange the buttons and items on your Touch Bar',
    sections: [],
  },
  {
    id: 'dock',
    label: 'Dock',
    description: "Pinned apps and the dock's appearance",
    sections: ['DOCK'],
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    description: 'Keyboard shortcuts sent to apps, and the screenshot combo',
    sections: [
      'DEFAULT_BROWSER_KEYS', 'BROWSER_KEY_OVERRIDES',
      'DEFAULT_VSCODE_KEYS', 'VSCODE_KEY_OVERRIDES',
      'SCREENSHOT',
    ],
  },
  {
    id: 'behavior',
    label: 'Behavior',
    description: 'Display, sleep, panels and Fn-key behavior',
    sections: [
      'DISPLAY', 'SLEEP', 'LAYER_TRANSITION', 'ACTIVE_WINDOW',
      'SYSTEMBAR', 'ESC_KEY', 'FN_LAYER', 'FN_KEYS',
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Less common panels and settings',
    sections: ['DOLPHIN', 'KONSOLE', 'CAVA'],
    advanced: true,
  },
];

/** Section → page lookup (built from PAGES; guaranteed one-to-one). */
export function pageOfSection(name: SectionName): PageDef | undefined {
  return PAGES.find(p => p.sections.includes(name));
}

export const SECTION_LABELS: Record<SectionName, string> = {
  DISPLAY: 'Display', SLEEP: 'Sleep', DOCK: 'Dock',
  DEFAULT_BROWSER_KEYS: 'Browser Keys', BROWSER_KEY_OVERRIDES: 'Browser Overrides',
  DEFAULT_VSCODE_KEYS: 'VS Code Keys', VSCODE_KEY_OVERRIDES: 'VS Code Overrides',
  ESC_KEY: 'Esc Key', ACTIVE_WINDOW: 'Active Window', SCREENSHOT: 'Screenshot',
  LAYER_TRANSITION: 'Transitions', DOLPHIN: 'Dolphin', KONSOLE: 'Konsole',
  SYSTEMBAR: 'System Bar', CAVA: 'Audio Visualizer', FN_LAYER: 'Fn Layer', FN_KEYS: 'Fn Keys',
};

export const SECTION_DESCRIPTIONS: Record<SectionName, string> = {
  DISPLAY: 'Screen timing and brightness',
  SLEEP: 'Touch Bar behavior around system sleep',
  LAYER_TRANSITION: 'Timing for switching between layers',
  DOCK: "Pinned apps and the dock's appearance",
  DEFAULT_BROWSER_KEYS: 'Shortcuts sent to any browser window',
  BROWSER_KEY_OVERRIDES: 'Per-browser shortcut overrides',
  DEFAULT_VSCODE_KEYS: 'Shortcuts sent to any VS Code window',
  VSCODE_KEY_OVERRIDES: 'Per-editor shortcut overrides',
  ESC_KEY: 'The on-screen Esc key for wide Touch Bars',
  ACTIVE_WINDOW: 'How the focused window is detected',
  SCREENSHOT: 'Touch Bar screenshot shortcut',
  DOLPHIN: 'Dolphin file manager panel',
  KONSOLE: 'Konsole terminal panel',
  SYSTEMBAR: 'CPU, memory, and network stats',
  CAVA: 'Audio visualizer bars',
  FN_LAYER: 'How the Fn key reaches the F-key layer',
  FN_KEYS: 'Extra keys shown after F1–F12 in the Fn-key layer',
};

export const UNION_FIELDS: Record<string, string[]> = {
  'ESC_KEY.onLayers': ['all', 'fn'],
  'ACTIVE_WINDOW.backend': ['auto', 'hyprland', 'niri', 'gnome', 'plasma', 'xorg'],
  'FN_LAYER.mode': ['hold', 'toggle', 'double-tap'],
  'DOCK.shortcut.mode': ['hold', 'toggle', 'double-tap'],
};

export const BROWSER_ACTIONS = ['back', 'forward', 'reload', 'home', 'newTab', 'closeTab', 'nextTab', 'prevTab'];
export const VSCODE_ACTIONS = [
  'back', 'forward', 'prevEditor', 'nextEditor', 'toggleSidebar', 'toggleTerminal',
  'run', 'stop', 'stepOver', 'stepInto', 'stepOut', 'undo', 'redo', 'find', 'replace',
  'commandPalette', 'settings',
];
