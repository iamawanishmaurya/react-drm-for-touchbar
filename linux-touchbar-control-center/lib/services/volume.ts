import { execFile } from 'child_process';
import { sessionRuntimeDir } from '@/lib/utils/sessionRuntime';
import { commandExists, execQuick, EXEC_TIMEOUT_MS } from './execQuick';

// When running as root the session socket isn't inherited — pass it explicitly.
export const PW_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  XDG_RUNTIME_DIR: sessionRuntimeDir(),
  PIPEWIRE_REMOTE: process.env.PIPEWIRE_REMOTE ?? `${sessionRuntimeDir()}/pipewire-0`,
};

// Detect the backend by looking it up on PATH, never by running it: the old
// `wpctl --help` probe had no timeout, so a hung daemon could freeze the bar at
// import time — and one transient failure pinned the wrong backend for good.
const USE_WPCTL = commandExists('wpctl');

// "Volume: 0.50" or "Volume: 0.50 [MUTED]" → null when there's no match.
export function parseWpctlVolume(out: string): number | null {
  const m = out.match(/Volume:\s*([\d.]+)/);
  return m ? Math.min(1, parseFloat(m[1])) : null;
}

// "Volume: front-left: 65536 /  100% / ..." → null when there's no match.
export function parsePactlVolume(out: string): number | null {
  const m = out.match(/(\d+)%/);
  return m ? Math.min(1, parseInt(m[1], 10) / 100) : null;
}

// Last known value, so a hiccup doesn't snap the slider back to a fake 0.5.
let lastVolume = 0.5;
let failing = false;

export function readVolume(): number {
  try {
    const out = USE_WPCTL
      ? execQuick('wpctl', ['get-volume', '@DEFAULT_AUDIO_SINK@'], { env: PW_ENV })
      : execQuick('pactl', ['get-sink-volume', '@DEFAULT_SINK@']);
    const v = USE_WPCTL ? parseWpctlVolume(out) : parsePactlVolume(out);
    if (v === null) throw new Error('unparseable volume output');
    lastVolume = v;
    if (failing) { failing = false; console.error('[volume] read recovered'); }
    return lastVolume;
  } catch (e) {
    if (!failing) {
      failing = true;
      console.error('[volume] read failed, keeping last value:', (e as Error).message);
    }
    return lastVolume;
  }
}

export function applyVolume(pct: number, done: () => void): void {
  const finish = (err: Error | null) => {
    if (err) console.error(USE_WPCTL ? '[volume] wpctl:' : '[volume] pactl:', err.message);
    done();
  };
  // Unlike the keyboard volume keys, raw volume setters don't clear the mute
  // flag, so dragging the slider while muted would be silent. Unmute like the
  // DE mixer does (a drag to 0 stays mute, matching macOS).
  if (pct <= 0) {
    if (USE_WPCTL) {
      execFile('wpctl', ['set-volume', '@DEFAULT_AUDIO_SINK@', '0'],
        { env: PW_ENV, timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' }, finish);
    } else {
      execFile('pactl', ['set-sink-volume', '@DEFAULT_SINK@', '0%'],
        { timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' }, finish);
    }
    return;
  }
  if (USE_WPCTL) {
    execFile('wpctl', ['set-volume', '@DEFAULT_AUDIO_SINK@', pct.toFixed(4)],
      { env: PW_ENV, timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' },
      (err) => {
        if (err) return finish(err);
        execFile('wpctl', ['set-mute', '@DEFAULT_AUDIO_SINK@', '0'],
          { env: PW_ENV, timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' }, finish);
      },
    );
  } else {
    execFile('pactl', ['set-sink-volume', '@DEFAULT_SINK@', `${Math.round(pct * 100)}%`],
      { timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' },
      (err) => {
        if (err) return finish(err);
        execFile('pactl', ['set-sink-mute', '@DEFAULT_SINK@', '0'],
          { timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' }, finish);
      },
    );
  }
}
