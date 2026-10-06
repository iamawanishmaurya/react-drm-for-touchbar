import { execFile } from 'child_process';
import { PW_ENV } from './volume';
import { commandExists, execQuick, EXEC_TIMEOUT_MS } from './execQuick';

// Same wpctl-preferred/pactl-fallback pattern as volume.ts, targeting the
// default input (source) instead of the default output (sink).

// PATH lookup, never a `wpctl --help` probe: detection must not be able to hang.
const USE_WPCTL = commandExists('wpctl');

// [MUTED] means muted; real wpctl output without it means unmuted; anything
// else is unparseable and the caller keeps its last value.
export function parseWpctlMuted(out: string): boolean | null {
  if (/\[MUTED\]/.test(out)) return true;
  return /Volume:\s*[\d.]+/.test(out) ? false : null;
}

export function parsePactlMuted(out: string): boolean | null {
  if (/Mute:\s*yes/.test(out)) return true;
  if (/Mute:\s*no/.test(out)) return false;
  return null;
}

// Last known state, so a hiccup doesn't silently unmute the mic in the UI.
let lastMuted = false;
let failing = false;

export function readMicMuted(): boolean {
  try {
    const parsed = USE_WPCTL
      ? parseWpctlMuted(execQuick('wpctl', ['get-volume', '@DEFAULT_AUDIO_SOURCE@'], { env: PW_ENV }))
      : parsePactlMuted(execQuick('pactl', ['get-source-mute', '@DEFAULT_SOURCE@']));
    if (parsed === null) throw new Error('could not parse mute state');
    if (failing) { failing = false; console.error('[mic] read recovered'); }
    lastMuted = parsed;
    return lastMuted;
  } catch (e) {
    if (!failing) {
      failing = true;
      console.error('[mic] read failed, keeping last value:', (e as Error).message);
    }
    return lastMuted;
  }
}

export function toggleMicMute(done: () => void): void {
  if (USE_WPCTL) {
    execFile('wpctl', ['set-mute', '@DEFAULT_AUDIO_SOURCE@', 'toggle'],
      { env: PW_ENV, timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' },
      (err) => { if (err) console.error('[mic] wpctl:', err.message); done(); },
    );
  } else {
    execFile('pactl', ['set-source-mute', '@DEFAULT_SOURCE@', 'toggle'],
      { timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' },
      (err) => { if (err) console.error('[mic] pactl:', err.message); done(); },
    );
  }
}
