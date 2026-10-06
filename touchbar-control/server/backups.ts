/**
 * Snapshots of config.ts taken before every Apply (and before every restore),
 * so a change to the physical bar can always be undone.
 *
 * Each backup is `<id>.ts` (the file, byte for byte) plus `<id>.json` (when,
 * why, and the layout it held — so the list can describe a backup without
 * parsing TypeScript).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseLayout } from '../shared/layoutValidate.ts';
import type { BarLayout, ConfigBackup } from '../shared/types.ts';

export const MAX_BACKUPS = 30;
const ID_RE = /^config-[0-9TZ-]+-\d{3}$/;

let counter = 0;

export function createBackup(configPath: string, dir: string, reason: ConfigBackup['reason'], layout: BarLayout): ConfigBackup {
  fs.mkdirSync(dir, { recursive: true });
  const at = new Date();
  // Sortable, filesystem-safe, unique within a millisecond burst.
  const id = `config-${at.toISOString().replace(/[:.]/g, '-')}-${String(counter++ % 1000).padStart(3, '0')}`;
  fs.copyFileSync(configPath, path.join(dir, `${id}.ts`));
  const meta: ConfigBackup = { id, at: at.toISOString(), reason, layout: { ...layout, pinnedLeft: null } };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(meta, null, 2) + '\n');
  prune(dir);
  return meta;
}

export function listBackups(dir: string): ConfigBackup[] {
  let names: string[];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out: ConfigBackup[] = [];
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    const id = n.slice(0, -5);
    if (!ID_RE.test(id) || !fs.existsSync(path.join(dir, `${id}.ts`))) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      out.push({ id, at: String(m.at), reason: m.reason === 'before-restore' ? 'before-restore' : 'before-apply', layout: parseLayout(m.layout) });
    } catch { /* skip a damaged entry */ }
  }
  return out.sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** Copies a backup over config.ts (the caller snapshots first and restarts). */
export function restoreBackupFile(id: string, dir: string, configPath: string): void {
  const file = path.join(dir, `${id}.ts`);
  if (!ID_RE.test(id) || !fs.existsSync(file)) throw new Error('unknown backup');
  const tmp = `${configPath}.${process.pid}.tmp`;
  fs.copyFileSync(file, tmp);
  fs.renameSync(tmp, configPath); // atomic: the bar never reads half a file
}

function prune(dir: string) {
  for (const b of listBackups(dir).slice(MAX_BACKUPS)) {
    for (const ext of ['.ts', '.json']) fs.rmSync(path.join(dir, b.id + ext), { force: true });
  }
}
