import { resolveOrder, leftButtonId, type BarLayout } from '@/lib/utils/layoutModel';

/**
 * Order of a left panel's button group, from the live layout (LEFT_LAYOUT,
 * seeded from config; see layoutStore.ts).
 *
 * Same contract as the right cluster (resolveRightButtons in layout.tsx):
 *   - ids are matched against the group's built-in buttons; unknown ids drop
 *   - ids missing from the config are appended in their built-in position, so a
 *     partial config never loses a button
 *   - an empty/missing entry falls back to the built-in order
 *   - a button is hidden by listing its scene id (`vscode.run`) in
 *     BAR_LAYOUT.hidden
 */
export function resolveLeftGroup(
  layout: BarLayout,
  page: string,
  group: string,
  builtIn: readonly string[],
): string[] {
  return resolveOrder(
    layout.left[page]?.[group],
    builtIn,
    new Set(layout.hidden),
    id => leftButtonId(page, id),
  );
}

export { leftButtonId };
