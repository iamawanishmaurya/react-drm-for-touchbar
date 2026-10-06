/**
 * Live layout control for the *physical* bar — touchbar-control's
 * "Live on Touch Bar": edits show on the hardware immediately, without Apply
 * or a restart.
 *
 * A local Unix socket (owner-only) that accepts newline-delimited JSON:
 *   {"type":"get"}             → current layout
 *   {"type":"set","patch":{…}} → replace rightButtons / hidden / left
 *   {"type":"reset"}           → back to the layout from config.ts
 *   {"type":"snapshot"}        → the frame the hardware is showing, as a PNG
 *                                ({"type":"snapshot","png":<base64>})
 * Other replies are {"type":"layout","layout":…,"live":bool} or {"type":"error",…}.
 *
 * Only the button layout can be changed — no focus override, no actions, no
 * navigation (those stay sandbox-only). And changes are leased to the
 * connection that made them: when it closes (editor turned Live off, the
 * site stopped or crashed), the bar goes back to its saved layout, so an
 * unapplied edit can never get stuck on the hardware.
 */
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLogger, createMessageReader, encodeMessage } from 'react-drm';
import { BAR_LAYOUT, LEFT_LAYOUT } from '@/lib/utils/configLoader';
import { getLayout, setLayout } from '@/lib/utils/layoutStore';
import { layoutFromConfig, parseLayoutPatch, type BarLayout } from '@/lib/utils/layoutModel';

const log = createLogger('live-layout');

export function liveLayoutSocketPath(): string {
  return path.join(process.env.XDG_RUNTIME_DIR || os.tmpdir(), 'react-drm-live.sock');
}

const saved = (): BarLayout => layoutFromConfig(BAR_LAYOUT, LEFT_LAYOUT);
const isLive = () => JSON.stringify({ ...getLayout(), pinnedLeft: null }) !== JSON.stringify(saved());

type Request = { type?: unknown; patch?: unknown };

/**
 * `snapshot` writes the current frame as a PNG to the given path; `wake`
 * brings a dimmed/sleeping bar back up — a live edit you can't see because the
 * panel went dark after its idle timeout would defeat the point.
 */
export function startLiveLayout(opts: { snapshot?: (file: string) => void; wake?: () => void } = {}): { stop(): void } {
  const socketPath = liveLayoutSocketPath();
  try { fs.unlinkSync(socketPath); } catch { /* none left over */ }

  const clients = new Set<net.Socket>();
  let owner: net.Socket | null = null; // the connection whose edits are showing

  const reply = (sock: net.Socket, msg: unknown) => { if (!sock.destroyed) sock.write(encodeMessage(msg)); };
  const state = () => ({ type: 'layout', layout: getLayout(), live: isLive() });
  const reset = () => { setLayout(saved()); owner = null; opts.wake?.(); };

  const server = net.createServer(sock => {
    clients.add(sock);
    const feed = createMessageReader<Request>(msg => {
      try {
        if (msg.type === 'get') { reply(sock, state()); return; }
        if (msg.type === 'reset') { reset(); reply(sock, state()); return; }
        if (msg.type === 'snapshot') {
          if (!opts.snapshot) throw new Error('snapshots unavailable');
          const file = path.join(path.dirname(socketPath), `react-drm-live-${process.pid}.png`);
          opts.snapshot(file);
          const png = fs.readFileSync(file).toString('base64');
          fs.rmSync(file, { force: true });
          reply(sock, { type: 'snapshot', png });
          return;
        }
        if (msg.type === 'set') {
          const patch = parseLayoutPatch(msg.patch);
          if ('pinnedLeft' in patch) throw new Error('pinnedLeft is sandbox-only');
          setLayout(patch);
          owner = sock;
          opts.wake?.();
          reply(sock, state());
          return;
        }
        throw new Error('unknown request');
      } catch (e) {
        reply(sock, { type: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    });
    sock.on('data', feed);
    sock.on('error', () => { /* client went away */ });
    sock.on('close', () => {
      clients.delete(sock);
      if (owner === sock) {
        log.info('live editor disconnected — restoring the saved layout');
        reset();
      }
    });
  });

  server.on('error', e => log.error('live layout socket error:', e instanceof Error ? e.message : e));
  // Created owner-only from the start (umask), not just chmod'ed after.
  const oldMask = process.umask(0o177);
  server.listen(socketPath, () => {
    // Owner-only. If the bar runs as root, hand the socket to the desktop
    // user who owns the runtime dir, so their editor can connect.
    try {
      fs.chmodSync(socketPath, 0o600);
      if (process.getuid?.() === 0) {
        const { uid, gid } = fs.statSync(path.dirname(socketPath));
        if (uid !== 0) fs.chownSync(socketPath, uid, gid);
      }
    } catch (e) {
      log.warn('could not restrict the live layout socket:', e instanceof Error ? e.message : e);
    }
    log.info(`live layout control at ${socketPath}`);
  });
  process.umask(oldMask);

  return {
    stop() {
      for (const c of clients) c.destroy();
      server.close();
      try { fs.unlinkSync(socketPath); } catch { /* already gone */ }
    },
  };
}
