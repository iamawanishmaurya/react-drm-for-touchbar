/**
 * Persisting a layout to the real bar. Reuses config-gui's engine — it patches
 * config.ts in place (comments, casts and formatting survive) and restarts the
 * react-drm service — rather than growing a second config writer.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { CONFIG_ENGINE, CONFIG_PATH, BLUEPRINT_PATH, userConfigDir } from './config.ts';
import { createBackup, listBackups, restoreBackupFile } from './backups.ts';
import { layoutToConfigChanges, layoutFromConfigSnapshot } from '../shared/layoutConfig.ts';
import type { BarLayout, ConfigBackup } from '../shared/types.ts';

const backupsDir = () => path.join(userConfigDir(), 'backups');

interface ConfigEngine {
  readConfig(configPath: string, blueprintPath: string): Record<string, unknown>;
  writeConfig(configPath: string, changes: Record<string, unknown>): void;
  restartService(): Promise<{ ok: boolean; message: string }>;
}

let engine: Promise<ConfigEngine> | null = null;
function loadEngine(): Promise<ConfigEngine> {
  // Loaded lazily from the deployed tree: it resolves ts-morph and react-drm
  // from there. The engine is CommonJS, so its exports may sit on `default`.
  engine ??= import(pathToFileURL(CONFIG_ENGINE).href).then(
    (m: Partial<ConfigEngine> & { default?: ConfigEngine }) =>
      (typeof m.readConfig === 'function' ? m as ConfigEngine : m.default!),
  );
  return engine;
}

/** The layout config.ts currently holds — what the physical bar shows. */
export async function readAppliedLayout(): Promise<BarLayout> {
  const { readConfig } = await loadEngine();
  return layoutFromConfigSnapshot(readConfig(CONFIG_PATH, BLUEPRINT_PATH));
}

export interface ApplyResult { ok: boolean; message: string; backup: ConfigBackup }

/** Snapshot config.ts (with the layout it holds), so this can be undone. */
async function snapshot(reason: ConfigBackup['reason']): Promise<ConfigBackup> {
  return createBackup(CONFIG_PATH, backupsDir(), reason, await readAppliedLayout());
}

async function restart(saved: string): Promise<{ ok: boolean; message: string }> {
  const { restartService } = await loadEngine();
  const r = await restartService();
  return { ok: r.ok, message: r.ok ? `${saved} — ${r.message}` : `${saved}, but restart failed: ${r.message}` };
}

export async function applyLayout(layout: BarLayout): Promise<ApplyResult> {
  const backup = await snapshot('before-apply');
  const { writeConfig } = await loadEngine();
  writeConfig(CONFIG_PATH, layoutToConfigChanges(layout));
  return { ...(await restart('Saved to config.ts')), backup };
}

export function listConfigBackups(): ConfigBackup[] {
  return listBackups(backupsDir());
}

/** Puts a backup back as config.ts (snapshotting the current one first, so a
 *  restore is itself undoable) and restarts the bar. */
export async function restoreConfigBackup(id: string): Promise<ApplyResult> {
  const backup = await snapshot('before-restore');
  restoreBackupFile(id, backupsDir(), CONFIG_PATH);
  // A no-op write refreshes dist/config.js from the restored file (the
  // engine's format-preserving write leaves config.ts itself byte-identical).
  const { writeConfig } = await loadEngine();
  writeConfig(CONFIG_PATH, {});
  return { ...(await restart('Restored the earlier config.ts')), backup };
}
