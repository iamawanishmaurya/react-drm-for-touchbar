import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import { DISPLAY_BACKLIGHT_NAMES } from 'react-drm';

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

export function readBrightness(device: string | null): number {
  if (!device) return 0.5;
  try {
    const cur = parseInt(execFileSync('brightnessctl', ['--device', device, 'get'], { encoding: 'utf8' }).trim());
    const max = parseInt(execFileSync('brightnessctl', ['--device', device, 'max'], { encoding: 'utf8' }).trim());
    return max > 0 ? Math.min(1, cur / max) : 0.5;
  } catch {
    if (!brightnessctlMissing) {
      brightnessctlMissing = true;
      console.error(
        'react-drm: brightnessctl not found or failed — brightness sliders will not work. ' +
        'Install it (e.g. `pacman -S brightnessctl`) and restart react-drm.'
      );
    }
    return 0.5;
  }
}

export function applyBrightness(device: string | null, pct: number, minimumPct: number): void {
  if (!device) return;
  if (brightnessctlMissing) return;
  const value = Math.max(minimumPct, Math.round(pct * 100));
  execFile('brightnessctl', ['--device', device, 'set', `${value}%`], err => {
    if (err && !brightnessctlMissing) {
      brightnessctlMissing = true;
      console.error(
        'react-drm: brightnessctl not found or failed — brightness sliders will not work. ' +
        'Install it (e.g. `pacman -S brightnessctl`) and restart react-drm.'
      );
    }
  });
}
