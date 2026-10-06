/**
 * The bar's top-level screens (app/<name>/page.tsx) an editor can jump to.
 * Import-free; the lock screen is left out on purpose — it's driven by the
 * system lock state, not by navigation.
 */
export interface BarScreen {
  id: string;
  label: string;
  group: 'Main' | 'Controls' | 'Games' | 'More';
}

export const BAR_SCREENS: BarScreen[] = [
  { id: 'splitted',          label: 'Main bar',           group: 'Main' },
  { id: 'dock',              label: 'Dock',               group: 'Main' },
  { id: 'systembar',         label: 'System bar',         group: 'Main' },
  { id: 'fnkeys',            label: 'F-keys',             group: 'Controls' },
  { id: 'audio-slider',      label: 'Volume slider',      group: 'Controls' },
  { id: 'brightness-slider', label: 'Brightness slider',  group: 'Controls' },
  { id: 'media',             label: 'Media tools',        group: 'Controls' },
  { id: 'games',             label: 'Games menu',         group: 'Games' },
  { id: 'snake',             label: 'Snake',              group: 'Games' },
  { id: 'dino',              label: 'Dino',               group: 'Games' },
  { id: 'piano',             label: 'Piano',              group: 'Games' },
  { id: 'pong',              label: 'Pong',               group: 'Games' },
  { id: 'launcher',          label: 'Launcher',           group: 'More' },
  { id: 'custom-layer',      label: 'Custom layer',       group: 'More' },
];

export function isBarScreen(id: unknown): id is string {
  return typeof id === 'string' && BAR_SCREENS.some(s => s.id === id);
}
