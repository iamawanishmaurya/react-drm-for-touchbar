import { spawn } from 'child_process';
import { readdirSync, statSync } from 'fs';
import path from 'path';
import type { DockApp } from '@/lib/utils/configLoader';
import { createLogger } from 'react-drm';

const log = createLogger('dock');

/**
 * Launch a desktop app from the Touch Bar process.
 *
 * The control center usually runs as root (react-drm.service / sudo), but GUI
 * apps must start inside the real user's graphical session. When SUDO_USER is
 * set we drop to that user with `runuser` and reconstruct the session env
 * (XDG_RUNTIME_DIR, the user D-Bus bus, and the Wayland/X display) so the app
 * can reach the compositor. Run directly otherwise.
 */
export function launch(command: string, args: string[] = []): void {
  const uid      = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const sudoUser = process.env.SUDO_USER;
  const sudoUid  = process.env.SUDO_UID;

  let child;
  if (uid === 0) {
    // The systemd unit does NOT set SUDO_USER/SUDO_UID (only a `sudo` dev run
    // does), so derive the desktop session's uid from /run/user/<uid> — the
    // session bus and Wayland socket live there. Without this we'd spawn the
    // app as root, where it can't reach the user's compositor and dies
    // silently (TROUBLESHOOTING.md issue 14).
    const runtimeDir = sudoUid ? `/run/user/${sudoUid}` : findUserRuntimeDir();
    const targetUid  = sudoUid ?? (runtimeDir && path.basename(runtimeDir));
    if (!runtimeDir || !targetUid) {
      log.error('launch failed: no user session found for', command);
      return;
    }
    const env = [
      `XDG_RUNTIME_DIR=${runtimeDir}`,
      `DBUS_SESSION_BUS_ADDRESS=unix:path=${runtimeDir}/bus`,
      `DISPLAY=${process.env.DISPLAY ?? ':0'}`,
    ];
    const wayland = detectWayland(runtimeDir);
    if (wayland) {
      env.push(`WAYLAND_DISPLAY=${wayland}`);
      // GTK4 refuses to open a display with XDG_SESSION_TYPE unset ("session
      // type 'unspecified'") even when WAYLAND_DISPLAY is set — the root
      // service env doesn't carry it, so dock-launched apps died silently.
      env.push('XDG_SESSION_TYPE=wayland');
    }

    child = spawn(
      'runuser',
      // runuser accepts a `#<uid>` target, so no username lookup is needed
      ['-u', sudoUser ?? `#${targetUid}`, '--', 'env', ...env, command, ...args],
      { detached: true, stdio: 'ignore' },
    );
  } else {
    child = spawn(command, args, { detached: true, stdio: 'ignore' });
  }

  child.on('error', err => log.error('launch failed:', command, err.message));
  child.unref();
}

/** The desktop session's runtime dir: the first /run/user/<n> owned by a real
 *  user (not root). Returns null when no graphical session exists. */
function findUserRuntimeDir(): string | null {
  try {
    for (const f of readdirSync('/run/user')) {
      if (!/^\d+$/.test(f) || f === '0') continue;
      const full = `/run/user/${f}`;
      if (statSync(full).uid > 0) return full;
    }
  } catch { /* fall through */ }
  return null;
}

/** Same as {@link launch}, shaped for the dock's config-driven app entries. */
export function launchApp(app: DockApp): void {
  launch(app.command, app.args ?? []);
}

/** Find the user's Wayland socket name (e.g. `wayland-1`) under their runtime dir. */
function detectWayland(runtimeDir: string): string | null {
  if (process.env.WAYLAND_DISPLAY) return process.env.WAYLAND_DISPLAY;
  try {
    return readdirSync(runtimeDir).find(f => /^wayland-\d+$/.test(f)) ?? null;
  } catch {
    return null;
  }
}
