/**
 * The live bar layout. Seeded from config (BAR_LAYOUT / LEFT_LAYOUT) at
 * startup; on the real bar it never changes after that, so behaviour is exactly
 * the config's. A sandbox preview instance (REACT_DRM_SANDBOX=1) lets an editor
 * replace it at runtime via POST /layout, and every panel re-renders in place —
 * no restart, which is what makes drag-to-reorder feel live.
 */
import { useSyncExternalStore } from 'react';
import { BAR_LAYOUT, LEFT_LAYOUT } from './configLoader';
import { layoutFromConfig, type BarLayout } from './layoutModel';

let current: BarLayout = layoutFromConfig(BAR_LAYOUT, LEFT_LAYOUT);
const listeners = new Set<() => void>();

export function getLayout(): BarLayout {
  return current;
}

/** Replaces the given fields (already validated — see parseLayoutPatch). */
export function setLayout(patch: Partial<BarLayout>): BarLayout {
  current = { ...current, ...patch };
  for (const l of listeners) l();
  return current;
}

export function subscribeLayout(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Re-renders the caller whenever the layout is replaced. */
export function useLayout(): BarLayout {
  return useSyncExternalStore(subscribeLayout, getLayout, getLayout);
}
