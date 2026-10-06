/**
 * sceneBoxes() — where every `id`-tagged widget currently is on the bar.
 *
 * A lighter sibling of sceneToSvg(): the same walk over the committed scene and
 * its post-Yoga layout, but it only reports geometry. Editors use it to lay
 * hit regions (and pixel crops of the streamed frame) over exactly the widgets
 * the renderer painted.
 *
 * Besides the layout box it reports what is actually *visible*: the box
 * intersected with every ancestor clip (overflow hidden/scroll), and the
 * effective opacity (product of all ancestors). A widget collapsed inside a
 * width-animated container, or faded out, therefore reports `visible: false`
 * instead of a box nobody can see.
 */
import type { RootContainer, SceneNode } from './types';
import type { LayoutBox } from './layout';
import { resolvePadding } from './serialize';

export interface SceneBox {
  id: string;
  /** Layout box, in display pixels. */
  x: number; y: number; w: number; h: number;
  /** The part of the box left after ancestor clips; w/h 0 when fully clipped. */
  vx: number; vy: number; vw: number; vh: number;
  /** Effective opacity including every ancestor. */
  opacity: number;
  /** Paintable: some area survives clipping and opacity is above ~0. */
  visible: boolean;
  /** Nearest id-tagged ancestor, when the tagged widget sits inside another. */
  parent?: string;
}

interface Rect { x: number; y: number; w: number; h: number; }

function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, btm - y) };
}

export function sceneBoxes(
  root: RootContainer,
  layout: ReadonlyMap<SceneNode, LayoutBox>,
  display: { width: number; height: number },
): SceneBox[] {
  const out: SceneBox[] = [];
  const screen: Rect = { x: 0, y: 0, w: display.width, h: display.height };

  const walk = (node: SceneNode, clip: Rect, offsetX: number, alpha: number, parent?: string) => {
    if (node.type !== 'box') return; // only boxes carry ids and children
    const raw = layout.get(node) ?? { x: node.x ?? 0, y: node.y ?? 0, w: node.width ?? 0, h: node.height ?? 0 };
    const lb = offsetX ? { ...raw, x: raw.x - offsetX } : raw;
    const a = (node.style?.opacity ?? 1) * alpha;
    let nextParent = parent;

    if (node.id) {
      const v = intersect(lb, clip);
      out.push({
        id: node.id,
        x: lb.x, y: lb.y, w: lb.w, h: lb.h,
        vx: v.x, vy: v.y, vw: v.w, vh: v.h,
        opacity: a,
        visible: a > 0.01 && v.w >= 1 && v.h >= 1,
        ...(parent ? { parent } : {}),
      });
      nextParent = node.id;
    }

    let childClip = clip;
    if (node.style?.overflow === 'hidden' || node.style?.overflow === 'scroll') {
      const [pt, pr, pb, pl] = resolvePadding(node.style);
      childClip = intersect(clip, {
        x: lb.x + pl, y: lb.y + pt,
        w: Math.max(0, lb.w - pl - pr), h: Math.max(0, lb.h - pt - pb),
      });
    }
    const childOffsetX = offsetX + (node.scrollX ?? 0);
    for (const child of node.children) walk(child, childClip, childOffsetX, a, nextParent);
  };

  for (const child of root.children) walk(child, screen, 0, 1);
  return out;
}
