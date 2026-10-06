/**
 * Which buttons exist, in built-in order — the vocabulary the layout config
 * (and an editor) can arrange. The panels import their built-in lists from
 * here, so this table can't drift from what they actually render.
 */

/** Right cluster, keyed as in app/splitted/layout.tsx's BASE_BTNS. */
export const RIGHT_BUILT_IN = ['back', 'volume', 'brightness', 'linux', 'playpause', 'screenshot', 'snake'] as const;

/** Left panels whose buttons are id-tagged and orderable, group by group.
 *  Buttons keep their group: config orders them *within* it. */
export const LEFT_BUILT_IN = {
  vscode: {
    run:      ['run', 'stop', 'stepOver', 'stepInto', 'stepOut'],
    edit:     ['undo', 'redo', 'find'],
    commands: ['commandPalette', 'settings'],
  },
  browser: {
    nav:  ['back', 'forward', 'reload', 'home'],
    tabs: ['prevTab', 'nextTab', 'newTab', 'closeTab'],
  },
  // Konsole: tab switching around the tab counter, and tab actions after the
  // status/suggestion area (which isn't a button and stays put).
  konsole: {
    tabs:    ['prevTab', 'nextTab'],
    actions: ['newTab', 'closeTab'],
  },
  vlc: {
    controls: ['playPause'],
  },
  dolphin: {
    nav:   ['back', 'forward', 'up', 'home'],
    view:  ['showHidden'],
    files: ['newFolder', 'trash'],
  },
  gwenview: {
    nav:     ['prev', 'next'],
    view:    ['zoomIn', 'zoomOut', 'rotateLeft', 'rotateRight'],
    actions: ['slideshow', 'trash'],
  },
} as const satisfies Record<string, Record<string, readonly string[]>>;

/** Every routed left panel (app/splitted/<name>); a sandbox can pin any of
 *  them. 'index' is the default (no app-specific panel). */
export const LEFT_PANELS = ['index', 'browser', 'konsole', 'vlc', 'dolphin', 'vscode', 'gwenview', 'mediaMprisList'] as const;
export type LeftPanelName = typeof LEFT_PANELS[number];

export function isLeftPanel(name: unknown): name is LeftPanelName {
  return typeof name === 'string' && (LEFT_PANELS as readonly string[]).includes(name);
}
