import { execFile } from 'child_process';
import fs from 'fs';
import { DISPLAY_BACKLIGHT_NAMES } from 'react-drm';
import { commandExists, execQuick, EXEC_TIMEOUT_MS } from './execQuick';

// Device names vary by hardware: the panel backlight is gmux_backlight on
// dual-GPU Macs but intel_backlight on single-GPU ones (e.g. 2020 13" Intel),
// and the keyboard LED is exposed as ':white:kbd_backlight'. Auto-detect instead
// of hardcoding so the sliders work across machines and don't spam "Device not
// found" from the poll loop. Display candidate list mirrors tiny-dfr's
// find_display_backlight().
function findDevice(base: string, match: (name: string) => boolean): string | null {
  try { return fs.readdirSync(base).find(match) ?? null; } catch { return null; }
}

export const DISPLAY_DEVICE  = findDevice('/sys/class/backlight', n => DISPLAY_BACKLIGHT_NAMES.some(c => n.includes(c)));
export const KEYBOARD_DEVICE = findDevice('/sys/class/leds', n => n.includes('kbd_backlight'));

// brightnessctl is a runtime dependency — when it is missing both sliders
// silently no-op (reads fell back to a fake 0.5, writes were swallowed), which
// looks like a broken touch bar. Complain once, loudly, and keep the last
// known value instead of pretending everything is fine.
let brightnessctlMissing = false;

// Per-device last known ratio, so a timeout doesn't snap a slider back to 0.5.
const lastBrightness = new Map<string, number>();
let failing = false;

export function readBrightness(device: string | null): number {
  if (!device) return 0.5;
  try {
    const cur = parseInt(execQuick('brightnessctl', ['--device', device, 'get']), 10);
    const max = parseInt(execQuick('brightnessctl', ['--device', device, 'max']), 10);
    const ratio = max > 0 ? Math.min(1, cur / max) : 0.5;
    if (max > 0) lastBrightness.set(device, ratio);
    if (failing) { failing = false; console.error('[brightness] read recovered'); }
    return ratio;
  } catch (e) {
    if (!commandExists('brightnessctl')) {
      if (!brightnessctlMissing) {
        brightnessctlMissing = true;
        console.error(
          'react-drm: brightnessctl not found or failed — brightness sliders will not work. ' +
          'Install it (e.g. `pacman -S brightnessctl`) and restart react-drm.'
        );
      }
    } else if (!failing) {
      // brightnessctl is installed but hung (or errored): keep the last value
      // and complain once per streak, not once per poll.
      failing = true;
      console.error('[brightness] read failed, keeping last value:', (e as Error).message);
    }
    return lastBrightness.get(device) ?? 0.5;
  }
}

export function applyBrightness(device: string | null, pct: number, minimumPct: number): void {
  if (!device) return;
  if (brightnessctlMissing) return;
  const value = Math.max(minimumPct, Math.round(pct * 100));
  execFile('brightnessctl', ['--device', device, 'set', `${value}%`],
    { timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' },
    err => {
      if (err && !brightnessctlMissing) {
        brightnessctlMissing = true;
        console.error(
          'react-drm: brightnessctl not found or failed — brightness sliders will not work. ' +
          'Install it (e.g. `pacman -S brightnessctl`) and restart react-drm.'
        );
      }
    });
}
