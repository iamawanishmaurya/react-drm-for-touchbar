/**
 * Which left panel (app/splitted/<name>) the focused window's class selects.
 * Import-free so the sandbox's app-preview list and tests can use it.
 */
import type { LeftPanelName } from './layoutSchema';

const BROWSER_CLASSES = [
  'firefox', 'firefox-esr',
  'google-chrome', 'google-chrome-stable', 'google-chrome-beta',
  'chromium', 'chromium-browser',
  'brave-browser', 'brave',
  'microsoft-edge', 'microsoft-edge-stable',
  'opera', 'opera-stable',
  'vivaldi-stable', 'vivaldi',
  'thorium-browser',
  'waterfox', 'librewolf', 'floorp',
];

// Matches VS Code's own DOCK.apps entry (config.ts) — 'code' covers both the
// stable and Insiders Linux packages, 'code-oss' the distro-packaged open
// source build.
const CODE_CLASSES = ['code', 'code-oss', 'codium', 'vscodium'];

export function leftPanelForClass(activeClass: string): Exclude<LeftPanelName, 'mediaMprisList'> {
  const cls = activeClass.toLowerCase();
  if (cls && BROWSER_CLASSES.some(b => cls.includes(b))) return 'browser';
  if (cls.includes('konsole')) return 'konsole';
  if (cls.includes('vlc')) return 'vlc';
  if (cls.includes('dolphin')) return 'dolphin';
  if (cls.includes('gwenview')) return 'gwenview';
  if (cls && CODE_CLASSES.some(c => cls.includes(c))) return 'vscode';
  return 'index';
}

export interface AppPreview {
  id: string;
  label: string;
  /** What the window reports as its class/title while "focused". */
  class: string;
  title: string;
}

/** Apps a sandbox can pretend are focused, to preview the bar for each. */
export const APP_PREVIEWS: AppPreview[] = [
  { id: 'desktop',  label: 'Desktop (no app)', class: '',                     title: '' },
  { id: 'firefox',  label: 'Firefox',          class: 'firefox',              title: 'Mozilla Firefox' },
  { id: 'chrome',   label: 'Chrome',           class: 'google-chrome',        title: 'Google Chrome' },
  { id: 'vscode',   label: 'VS Code',          class: 'code',                 title: 'Visual Studio Code' },
  { id: 'konsole',  label: 'Konsole',          class: 'org.kde.konsole',      title: 'Konsole' },
  { id: 'vlc',      label: 'VLC',              class: 'vlc',                  title: 'VLC media player' },
  { id: 'dolphin',  label: 'Dolphin',          class: 'org.kde.dolphin',      title: 'Dolphin' },
  { id: 'gwenview', label: 'Gwenview',         class: 'org.kde.gwenview',     title: 'Gwenview' },
  { id: 'terminal', label: 'Terminal (Ghostty)', class: 'com.mitchellh.ghostty', title: 'Ghostty' },
  { id: 'files',    label: 'Files (Nautilus)', class: 'org.gnome.Nautilus',   title: 'Files' },
];
