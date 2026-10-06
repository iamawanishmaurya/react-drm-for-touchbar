import type { BarLayout } from './types.ts';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/**
 * The config.ts sections a layout is persisted as. `pinnedLeft` is a sandbox
 * viewing aid, never config. Empty groups are dropped so config.ts doesn't
 * collect noise for panels nobody arranged.
 */
export function layoutToConfigChanges(layout: BarLayout): { BAR_LAYOUT: Json; LEFT_LAYOUT: Json } {
  const left: Record<string, Record<string, string[]>> = {};
  for (const [page, groups] of Object.entries(layout.left)) {
    for (const [group, ids] of Object.entries(groups)) {
      if (ids.length === 0) continue;
      (left[page] ??= {})[group] = [...ids];
    }
  }
  return {
    BAR_LAYOUT: { rightButtons: [...layout.rightButtons], hidden: [...layout.hidden] },
    LEFT_LAYOUT: left,
  };
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Reads a layout back out of the engine's config snapshot (Revert's target). */
export function layoutFromConfigSnapshot(snapshot: Record<string, unknown>): BarLayout {
  const bar = (snapshot.BAR_LAYOUT ?? {}) as Record<string, unknown>;
  const leftIn = (snapshot.LEFT_LAYOUT ?? {}) as Record<string, unknown>;
  const left: Record<string, Record<string, string[]>> = {};
  for (const [page, groups] of Object.entries(leftIn)) {
    if (!groups || typeof groups !== 'object' || Array.isArray(groups)) continue;
    left[page] = {};
    for (const [group, ids] of Object.entries(groups as Record<string, unknown>)) left[page][group] = strings(ids);
  }
  return { rightButtons: strings(bar.rightButtons), hidden: strings(bar.hidden), left, pinnedLeft: null };
}

const list = (ids: string[]) => `[${ids.map(id => `'${id}'`).join(', ')}]`;

/**
 * The config.ts text Apply produces for these sections — shown in the editor's
 * Config view. Built from layoutToConfigChanges so the two can't disagree.
 * (Apply itself patches the existing declarations in place; this is the
 * equivalent standalone declaration.)
 */
export function configText(layout: BarLayout): string {
  const { BAR_LAYOUT, LEFT_LAYOUT } = layoutToConfigChanges(layout) as {
    BAR_LAYOUT: { rightButtons: string[]; hidden: string[] };
    LEFT_LAYOUT: Record<string, Record<string, string[]>>;
  };
  const out = [
    'export const BAR_LAYOUT = {',
    `  rightButtons: ${list(BAR_LAYOUT.rightButtons)},`,
    `  hidden: ${list(BAR_LAYOUT.hidden)} as string[],`,
    '};',
    '',
  ];
  const pages = Object.entries(LEFT_LAYOUT);
  if (pages.length === 0) {
    out.push('export const LEFT_LAYOUT = {};');
  } else {
    out.push('export const LEFT_LAYOUT = {');
    for (const [page, groups] of pages) {
      out.push(`  ${page}: {`);
      for (const [group, ids] of Object.entries(groups)) out.push(`    ${group}: ${list(ids)},`);
      out.push('  },');
    }
    out.push('};');
  }
  out.push('');
  return out.join('\n');
}
