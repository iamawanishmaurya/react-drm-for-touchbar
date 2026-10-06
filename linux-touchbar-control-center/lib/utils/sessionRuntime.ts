/**
 * The desktop user's runtime dir ($XDG_RUNTIME_DIR, /run/user/<uid>) — where
 * the compositor, PipeWire and D-Bus sockets live.
 *
 * Normally inherited (the installer's systemd *user* service). When the bar
 * runs as root (a system unit, or sudo) it isn't, so derive it: SUDO_UID, then
 * the first /run/user/<n> owned by a real user. Never assumes uid 1000.
 */
import { readdirSync, statSync } from 'node:fs';

export function findUserRuntimeDir(): string | null {
  try {
    for (const f of readdirSync('/run/user')) {
      if (!/^\d+$/.test(f) || f === '0') continue;
      const full = `/run/user/${f}`;
      if (statSync(full).uid > 0) return full;
    }
  } catch { /* no /run/user */ }
  return null;
}

export function sessionRuntimeDir(): string {
  if (process.env.XDG_RUNTIME_DIR) return process.env.XDG_RUNTIME_DIR;
  if (process.env.SUDO_UID) return `/run/user/${process.env.SUDO_UID}`;
  const uid = process.getuid?.();
  if (uid !== undefined && uid !== 0) return `/run/user/${uid}`;
  return findUserRuntimeDir() ?? '/run/user/0';
}
