import type { BarLayout, LayoutSchema } from '../../../shared/types.ts';

export interface Preset {
  id: string;           // 'builtin:<key>' or 'mine:<name>'
  name: string;
  description: string;
  layout: BarLayout;
  builtIn: boolean;
}

/** Keep only ids the schema knows (so a preset never names a missing button). */
function known(schema: LayoutSchema, ids: string[]): string[] {
  const set = new Set(schema.right);
  return ids.filter(id => set.has(id));
}

function builtInLeft(schema: LayoutSchema): BarLayout['left'] {
  return Object.fromEntries(
    Object.entries(schema.left).map(([page, groups]) => [page, Object.fromEntries(
      Object.entries(groups).map(([g, ids]) => [g, [...ids]]),
    )]),
  );
}

/** Starting points that ship with the editor, derived from the schema. */
export function builtInPresets(schema: LayoutSchema): Preset[] {
  const left = builtInLeft(schema);
  const make = (key: string, name: string, description: string, rightButtons: string[], hidden: string[] = []): Preset => ({
    id: `builtin:${key}`, name, description, builtIn: true,
    layout: { rightButtons: known(schema, rightButtons), hidden: known(schema, hidden), left, pinnedLeft: null },
  });
  return [
    make('default', 'Default', 'Every button, in the built-in order', [...schema.right]),
    make('minimal', 'Minimal', 'Just volume, brightness, dock and screenshot',
      ['volume', 'brightness', 'playpause', 'screenshot'], ['back', 'linux', 'snake']),
    make('media-games', 'Media & games first', 'Dock and games up front, system tools after',
      ['snake', 'playpause', 'volume', 'brightness', 'back', 'linux', 'screenshot']),
  ];
}
