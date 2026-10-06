/**
 * "My Presets": named layouts kept in one JSON file under the user's config
 * dir, so they survive browser resets and are shared by every tab.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseLayout } from '../shared/layoutValidate.ts';
import { userConfigDir } from './config.ts';
import type { SavedPreset } from '../shared/types.ts';

const MAX_PRESETS = 200;
const MAX_NAME = 60;

export function presetsPath(): string {
  return path.join(userConfigDir(), 'presets.json');
}

export function listPresets(file = presetsPath()): SavedPreset[] {
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: SavedPreset[] = [];
  for (const p of raw) {
    // Skip (don't fail on) an entry a hand edit broke.
    try { out.push({ name: cleanName(p?.name), layout: parseLayout(p?.layout), savedAt: String(p?.savedAt ?? '') }); } catch { /* skip */ }
  }
  return out;
}

function cleanName(v: unknown): string {
  if (typeof v !== 'string') throw new Error('preset name must be text');
  const name = v.trim();
  if (!name) throw new Error('preset name is empty');
  if (name.length > MAX_NAME) throw new Error(`preset name is longer than ${MAX_NAME} characters`);
  return name;
}

function write(file: string, presets: SavedPreset[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(presets, null, 2) + '\n');
  fs.renameSync(tmp, file); // atomic: a crash never leaves half a file
}

/** Saves (or overwrites, by name) a preset; returns the new list. */
export function savePreset(body: unknown, file = presetsPath()): SavedPreset[] {
  const b = (body ?? {}) as { name?: unknown; layout?: unknown };
  const preset: SavedPreset = { name: cleanName(b.name), layout: parseLayout(b.layout), savedAt: new Date().toISOString() };
  const list = listPresets(file).filter(p => p.name !== preset.name);
  if (list.length >= MAX_PRESETS) throw new Error(`at most ${MAX_PRESETS} presets`);
  list.push(preset);
  write(file, list);
  return list;
}

export function deletePreset(name: string, file = presetsPath()): SavedPreset[] {
  const list = listPresets(file).filter(p => p.name !== name);
  write(file, list);
  return list;
}
