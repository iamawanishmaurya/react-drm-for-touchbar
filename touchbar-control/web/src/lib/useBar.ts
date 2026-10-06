import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { bar } from './bar.ts';

let version = 0;
bar.onChange(() => { version++; });

/** Re-renders on status/scene changes (not on every frame). */
export function useBarState() {
  useSyncExternalStore(l => bar.onChange(l), () => version);
  return { status: bar.status, scene: bar.scene, hasFrame: bar.hasFrame };
}

/** Width of an element, kept current with a ResizeObserver. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
