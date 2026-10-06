/**
 * sceneToSvg() — renders the committed scene as an SVG document.
 *
 * The Touch Bar path ends in Cairo (`serializeScene` → `renderBinary`), which
 * is why the UI can't be inspected as markup. This walks the same scene, with
 * the same post-Yoga layout boxes, and emits SVG instead of draw commands:
 * every node an app author gave an `id` becomes a `<g data-id="…">` holding its
 * real geometry, colors and children.
 *
 * What it inherits from the Cairo path exactly: layout, positions, sizes,
 * fills, strokes, corner radii, borders, rotation, opacity, clips, and text
 * strings/sizes/colors. Icons stay vector — `draw_svg`'s `src` is already SVG
 * markup (that is how react-icons reach the bar) and is nested back in.
 *
 * What cannot match: rasterization. Text shaping and antialiasing are the
 * browser's here rather than Cairo + the configured font, and GIF frames are
 * re-encoded to PNG (see the format note on draw_image below).
 */
import type { RootContainer, SceneNode, SvgContainerNode } from './types';
import type { LayoutBox } from './layout';
import { parseColor } from './serialize';
import { resolveCornerRadii, resolvePadding, zIndexOf } from './serialize';
import zlib from 'node:zlib';

export interface SceneSvgOptions {
  width: number;
  height: number;
  /** CSS background behind the SVG root; the bar clears to black. */
  background?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// parseColor() yields 0–1 channels (Cairo's convention); CSS rgb() wants 0–255.
// Passing the floats through made every fill render as near-black.
const rgb = (r: number, g: number, b: number) =>
  `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;

/** Rounded rect path honouring per-corner radii (SVG's <rect> has one rx/ry). */
function roundRectPath(x: number, y: number, w: number, h: number,
                        tl: number, tr: number, br: number, bl: number): string {
  const maxR = Math.min(w, h) / 2;
  const t = Math.min(tl, maxR), r = Math.min(tr, maxR);
  const b = Math.min(br, maxR), l = Math.min(bl, maxR);
  if (t === 0 && r === 0 && b === 0 && l === 0) {
    return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  }
  return [
    `M${x + l} ${y}`,
    `H${x + w - r}`, r ? `A${r} ${r} 0 0 1 ${x + w} ${y + r}` : '',
    `V${y + h - b}`, b ? `A${b} ${b} 0 0 1 ${x + w - b} ${y + h}` : '',
    `H${x + l}`, l ? `A${l} ${l} 0 0 1 ${x} ${y + h - l}` : '',
    `V${y + t}`, t ? `A${t} ${t} 0 0 1 ${x + t} ${y}` : '',
    'Z',
  ].join('');
}

// ── PNG encoding for GIF/image frames ───────────────────────────────────────
// draw_image carries a raw pixel buffer plus its source dimensions. Re-encoded
// here so the SVG can reference it as a data URL. The buffer is treated as
// RGBA — the one path in the app that feeds this node is the GIF decoder, which
// hands over RGBA; if a caller ever supplies BGRA the image renders with
// swapped channels rather than failing.

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function rgbaToPngDataUrl(rgba: Buffer, w: number, h: number): string | null {
  try {
    const raw = Buffer.alloc(h * (1 + w * 4));
    for (let y = 0; y < h; y++) {
      rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', zlib.deflateSync(raw)),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Re-anchor an existing `<svg …>` string at a position/size. */
function placeSvg(src: string, x: number, y: number, w: number, h: number): string {
  const open = src.match(/^<svg\b([^>]*?)(\/?)>/);
  if (!open) return '';
  const attrs = open[1]
    .replace(/\s(x|y|width|height)="[^"]*"/g, '')
    .trimEnd();
  return `<svg${attrs} x="${x}" y="${y}" width="${w}" height="${h}"${open[2]}>` + src.slice(open[0].length);
}

interface Ctx { out: string[]; clipId: number; filterId: number; defs: string[]; }

function emitNode(node: SceneNode, ctx: Ctx, layout: ReadonlyMap<SceneNode, LayoutBox>,
                  parentLb?: LayoutBox, offsetX = 0, alpha = 1): void {
  if (node.type === 'box') {
    const rawLb = layout.get(node) ?? { x: node.x ?? 0, y: node.y ?? 0, w: node.width ?? 0, h: node.height ?? 0 };
    const lb = offsetX ? { ...rawLb, x: rawLb.x - offsetX } : rawLb;
    const a = (node.style?.opacity ?? 1) * alpha;
    const [tl, tr, br, bl] = resolveCornerRadii(node.style);
    const rotateDeg = node.style?.rotate ?? 0;

    // Group so rotation/opacity/id wrap background, border and children together.
    const attrs: string[] = [];
    if (node.id) attrs.push(`data-id="${esc(node.id)}"`);
    attrs.push(`data-x="${lb.x}"`, `data-y="${lb.y}"`,
               `data-w="${lb.w}"`, `data-h="${lb.h}"`);
    if (a !== 1) attrs.push(`opacity="${a}"`);
    if (rotateDeg !== 0) {
      const cx = lb.x + lb.w / 2, cy = lb.y + lb.h / 2;
      attrs.push(`transform="rotate(${rotateDeg} ${cx} ${cy})"`);
    }
    const shadowOpacity = node.style?.shadowOpacity ?? 1;
    if (node.style?.shadowColor && shadowOpacity > 0 && !node.style.shadowInset) {
      const [sr, sg, sb, sa] = parseColor(node.style.shadowColor);
      const id = `sh${ctx.filterId++}`;
      const blur = (node.style.shadowRadius ?? 0) / 2; // Cairo blur ≈ 2× sigma
      ctx.defs.push(
        `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
        `<feDropShadow dx="${node.style.shadowOffsetX ?? 0}" dy="${node.style.shadowOffsetY ?? 0}" ` +
        `stdDeviation="${blur}" flood-color="${rgb(sr, sg, sb)}" flood-opacity="${sa * shadowOpacity * a}"/>` +
        `</filter>`);
      attrs.push(`filter="url(#${id})"`);
    }
    ctx.out.push(`<g ${attrs.join(' ')}>`);

    const bgColor = node.style?.backgroundColor ?? node.color;
    if (bgColor !== 'transparent') {
      const [r, g, b, ca] = parseColor(bgColor);
      const alpha = ca * a;
      if (alpha > 0.001) {
        ctx.out.push(`<path d="${roundRectPath(lb.x, lb.y, lb.w, lb.h, tl, tr, br, bl)}" ` +
                     `fill="${rgb(r, g, b)}" fill-opacity="${alpha}"/>`);
      }
    }
    const borderColor = node.style?.borderColor ?? node.borderColor;
    const borderWidth = node.style?.borderWidth ?? node.borderWidth;
    if (borderColor && borderWidth && borderWidth > 0) {
      const [r, g, b, ca] = parseColor(borderColor);
      const alpha = ca * a;
      if (alpha > 0.001) {
        const inset = borderWidth / 2;
        ctx.out.push(`<path d="${roundRectPath(lb.x + inset, lb.y + inset, Math.max(0, lb.w - borderWidth), Math.max(0, lb.h - borderWidth), tl, tr, br, bl)}" ` +
                     `fill="none" stroke="${rgb(r, g, b)}" stroke-opacity="${alpha}" stroke-width="${borderWidth}"/>`);
      }
    }

    const clip = node.style?.overflow === 'hidden' || node.style?.overflow === 'scroll';
    if (clip) {
      const [pt, pr, pb, pl] = resolvePadding(node.style);
      const id = `cp${ctx.clipId++}`;
      ctx.defs.push(`<clipPath id="${id}"><path d="${roundRectPath(
        lb.x + pl, lb.y + pt, Math.max(0, lb.w - pl - pr), Math.max(0, lb.h - pt - pb), tl, tr, br, bl)}"/></clipPath>`);
      ctx.out.push(`<g clip-path="url(#${id})">`);
    }

    const isAbsolute = (n: SceneNode) =>
      n.style?.position === 'absolute' || n.x !== undefined || n.y !== undefined;
    const absNeg = node.children.filter(c => isAbsolute(c) && zIndexOf(c) < 0).sort((a, b) => zIndexOf(a) - zIndexOf(b));
    const flow   = node.children.filter(c => !isAbsolute(c));
    const absPos = node.children.filter(c => isAbsolute(c) && zIndexOf(c) >= 0).sort((a, b) => zIndexOf(a) - zIndexOf(b));
    const childOffsetX = offsetX + (node.scrollX ?? 0);
    const ordered = node.children.some(isAbsolute) ? [...absNeg, ...flow, ...absPos] : node.children;
    for (const child of ordered) emitNode(child, ctx, layout, lb, childOffsetX, a);

    if (clip) ctx.out.push('</g>');
    ctx.out.push('</g>');
    return;
  }

  if (node.type === 'text') {
    const rawLb = layout.get(node) ?? { x: node.x ?? 0, y: node.y ?? 0, w: 0, h: 0 };
    const lb = offsetX ? { ...rawLb, x: rawLb.x - offsetX } : rawLb;
    const [r, g, b, ca] = parseColor(node._inherited?.color ?? node.style?.color ?? node.color);
    const a = ca * (node.style?.opacity ?? 1) * alpha;
    if (a <= 0.001) return;
    const size   = node._inherited?.fontSize   ?? node.style?.fontSize   ?? node.fontSize;
    const family = node._inherited?.fontFamily ?? node.style?.fontFamily ?? node.fontFamily;
    const fw = node.style?.fontWeight;
    const bold = fw === 'bold' || (fw !== undefined && parseInt(fw, 10) >= 700);
    const italic = node.style?.fontStyle === 'italic';
    const align = node.style?.textAlign ?? 'left';
    const containerX = parentLb?.x ?? lb.x;
    const containerW = parentLb?.w ?? 0;
    const lineHeight = node.style?.lineHeight ?? lb.h;
    // Cairo centers glyph ink inside the line box; SVG's central baseline does
    // the same job with one attribute.
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const x = align === 'center' ? containerX + containerW / 2
            : align === 'right'  ? containerX + containerW
            : lb.x;
    const y = lb.y + lineHeight / 2;
    ctx.out.push(`<text x="${x}" y="${y}" fill="${rgb(r, g, b)}" fill-opacity="${a}" ` +
                 `font-family="${esc(family)}" font-size="${size}" ` +
                 `${bold ? 'font-weight="bold" ' : ''}${italic ? 'font-style="italic" ' : ''}` +
                 `text-anchor="${anchor}" dominant-baseline="central" xml:space="preserve">${esc(node.text)}</text>`);
    return;
  }

  if (node.type === 'svg_image' || node.type === 'svg') {
    const svgNode = node as SvgContainerNode & { src: string };
    const lb = layout.get(node) ?? { x: node.x ?? 0, y: node.y ?? 0, w: node.width ?? 0, h: node.height ?? 0 };
    const shifted = offsetX ? { ...lb, x: lb.x - offsetX } : lb;
    const a = (node.style?.opacity ?? 1) * alpha;
    if (a <= 0.001) return;
    const src = node.type === 'svg' && (svgNode as SvgContainerNode)._cachedSrc
      ? (svgNode as SvgContainerNode)._cachedSrc!
      : (node as { src: string }).src;
    if (!src) return;
    const placed = placeSvg(src, shifted.x, shifted.y, shifted.w, shifted.h);
    if (!placed) return;
    ctx.out.push(a === 1 ? placed : placed.replace(/^<svg/, `<svg opacity="${a}"`));
    return;
  }

  if (node.type === 'gif_image') {
    const g = node as unknown as { frame?: Buffer; frameW?: number; frameH?: number; width?: number; height?: number };
    if (!g.frame || !g.frameW || !g.frameH) return;
    const rawLb = layout.get(node) ?? { x: node.x ?? 0, y: node.y ?? 0, w: node.width ?? 0, h: node.height ?? 0 };
    const lb = offsetX ? { ...rawLb, x: rawLb.x - offsetX } : rawLb;
    const [tl, tr, br, bl] = resolveCornerRadii(node.style);
    const href = rgbaToPngDataUrl(g.frame, g.frameW, g.frameH);
    if (!href) return;
    ctx.out.push(`<image x="${lb.x}" y="${lb.y}" width="${lb.w}" height="${lb.h}" ` +
                 `preserveAspectRatio="none" clip-path="inset(0 round ${[tl, tr, br, bl].join(' ')})" href="${href}"/>`);
  }
}

/** Serialize a committed scene to a standalone SVG document string. */
export function sceneToSvg(
  root: RootContainer,
  layout: ReadonlyMap<SceneNode, LayoutBox>,
  opts: SceneSvgOptions,
): string {
  const ctx: Ctx = { out: [], clipId: 0, filterId: 0, defs: [] };
  for (const child of root.children) emitNode(child, ctx, layout);
  const bg = opts.background ?? 'rgb(0,0,0)';
  const defsBlock = ctx.defs.length ? `<defs>${ctx.defs.join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" ` +
         `viewBox="0 0 ${opts.width} ${opts.height}">` +
         `<rect width="${opts.width}" height="${opts.height}" fill="${bg}"/>` +
         defsBlock + ctx.out.join('') + `</svg>`;
}
