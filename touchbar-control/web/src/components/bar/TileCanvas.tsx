import { useEffect, useRef, useState } from 'react';
import { bar } from '@/lib/bar.ts';

// Last clean crop of every widget, so a tile that is off the bar right now
// (hidden, or on a layer that isn't showing) still shows its real pixels.
const lastCrop = new Map<string, HTMLCanvasElement>();

export function tileSize(id: string): { w: number; h: number } {
  const b = bar.box(id);
  if (b && b.visible) return { w: b.vw, h: b.vh };
  const c = lastCrop.get(id);
  return c ? { w: c.width, h: c.height } : { w: 120, h: 52 };
}

/**
 * One widget, cut out of the live frame at its own scene box. Because it crops
 * by id rather than by position, it shows the right pixels whatever order the
 * edit surface is in, and keeps updating (clock, CPU…) like the bar does.
 */
export default function TileCanvas({ id, scale }: { id: string; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = tileSize(id);
  // A widget that has never been on screen (its app isn't running, say) has
  // no pixels to show — label it instead of drawing an empty tile.
  const [seen, setSeen] = useState(() => lastCrop.has(id));

  useEffect(() => {
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      const b = bar.box(id);
      // Only trust a crop while the widget is fully on screen and opaque —
      // mid-fade or clipped pixels would poison the cache.
      if (b && b.visible && b.opacity > 0.99 && b.vw === b.w && bar.hasFrame) {
        const cw = Math.round(b.vw), ch = Math.round(b.vh);
        let cache = lastCrop.get(id);
        if (!cache) { cache = document.createElement('canvas'); lastCrop.set(id, cache); }
        if (cache.width !== cw || cache.height !== ch) { cache.width = cw; cache.height = ch; }
        const cc = cache.getContext('2d')!;
        cc.clearRect(0, 0, cw, ch);
        cc.drawImage(bar.frame, Math.round(b.vx), Math.round(b.vy), cw, ch, 0, 0, cw, ch);
      }
      const src = lastCrop.get(id);
      if (!src) return;
      setSeen(true);
      if (c.width !== src.width || c.height !== src.height) { c.width = src.width; c.height = src.height; }
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(src, 0, 0);
    };
    draw();
    // Frames and their scene are adopted together (see bar.ts), so drawing on
    // frames alone never crops one layout's pixels at another's positions.
    return bar.onFrameDrawn(draw);
  }, [id]);

  const label = id.includes('.') ? id.slice(id.indexOf('.') + 1) : id;
  return (
    <>
      <canvas ref={ref} className={seen ? 'block' : 'hidden'} style={{ width: w * scale, height: h * scale }} />
      {!seen && (
        <span
          data-placeholder
          className="flex items-center justify-center truncate bg-muted px-1 text-xs leading-none text-muted-foreground"
          style={{ width: w * scale, height: h * scale }}
        >
          {label}
        </span>
      )}
    </>
  );
}
