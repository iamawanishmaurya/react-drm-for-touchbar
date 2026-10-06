import { parseLayout } from '../../../shared/layoutValidate.ts';
import type { BarLayout } from '../../../shared/types.ts';

const FORMAT = 'touchbar-control/layout';
const VERSION = 1;

/** A layout as a file a person can keep, share or import later. */
export function exportLayoutFile(layout: BarLayout): string {
  const { rightButtons, hidden, left } = layout;
  return JSON.stringify({ format: FORMAT, version: VERSION, layout: { rightButtons, hidden, left } }, null, 2) + '\n';
}

export function parseLayoutFile(text: string): BarLayout {
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  const d = doc as { format?: unknown; version?: unknown; layout?: unknown };
  if (!d || typeof d !== 'object' || d.format !== FORMAT) throw new Error('This is not a touchbar-control layout file.');
  if (d.version !== VERSION) throw new Error(`Layout file version ${String(d.version)} isn't supported (expected ${VERSION}).`);
  return parseLayout(d.layout);
}
