/**
 * "Live on Touch Bar": mirrors layout edits onto the *physical* bar through
 * the running react-drm service's live layout socket
 * (linux-touchbar-control-center/lib/services/liveLayout.ts).
 *
 * While live, one connection stays open. The bar ties the edits to it: when it
 * closes — Live turned off, this server stopped or crashed, the bar restarted
 * after an Apply — the bar shows its saved layout again. Nothing unapplied can
 * get stuck on the hardware.
 */
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { BarLayout, LiveState } from '../shared/types.ts';

export function liveSocketPath(): string {
  const runtime = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
  return process.env.TBC_LIVE_SOCKET ?? path.join(runtime, 'react-drm-live.sock');
}

type Reply = { type: 'layout'; layout: BarLayout; live: boolean } | { type: 'snapshot'; png: string } | { type: 'error'; error: string };

/** One newline-JSON connection with request/reply in order. */
class Conn {
  private buf = '';
  private waiters: { resolve: (r: Reply) => void; reject: (e: Error) => void }[] = [];
  readonly sock: net.Socket;
  readonly ready: Promise<void>;

  constructor(file: string, onClose: () => void) {
    this.sock = net.connect(file);
    this.ready = new Promise((resolve, reject) => {
      this.sock.once('connect', () => resolve());
      this.sock.once('error', reject);
    });
    this.sock.on('data', d => {
      this.buf += d.toString('utf8');
      let i: number;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 1);
        try { this.waiters.shift()?.resolve(JSON.parse(line)); } catch { /* malformed */ }
      }
    });
    this.sock.on('error', () => { /* 'close' follows */ });
    this.sock.on('close', () => {
      for (const w of this.waiters.splice(0)) w.reject(new Error('the Touch Bar closed the connection'));
      onClose();
    });
  }

  ask(msg: unknown, timeoutMs = 5000): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('the Touch Bar did not answer')), timeoutMs);
      this.waiters.push({ resolve: r => { clearTimeout(t); resolve(r); }, reject: e => { clearTimeout(t); reject(e); } });
      this.sock.write(JSON.stringify(msg) + '\n');
    });
  }

  close() { this.sock.end(); }
}

const layoutFields = (l: Partial<BarLayout>) => {
  const out: Partial<BarLayout> = {};
  if (l.rightButtons) out.rightButtons = l.rightButtons;
  if (l.hidden) out.hidden = l.hidden;
  if (l.left) out.left = l.left;
  return out;
};

export class LiveBar extends EventEmitter {
  private conn: Conn | null = null;
  state: LiveState = { enabled: false, available: false, detail: '' };

  constructor(private readonly file = liveSocketPath()) {
    super();
    this.refresh();
  }

  private set(patch: Partial<LiveState>) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  /** Is the running bar offering live control (new enough, running)? */
  refresh(): LiveState {
    const available = fs.existsSync(this.file);
    if (available !== this.state.available) this.set({ available });
    return this.state;
  }

  /** Go live, showing `layout` on the physical bar right away. */
  async enable(layout: BarLayout): Promise<LiveState> {
    if (this.conn) { await this.push(layout); return this.state; }
    if (!this.refresh().available) throw new Error('The Touch Bar service is not offering live control — deploy the latest app (./deploy.sh) and restart it.');
    const conn = new Conn(this.file, () => {
      if (this.conn !== conn) return;
      this.conn = null;
      // The bar restores its saved layout when this connection goes.
      this.set({ enabled: false, detail: 'The Touch Bar went back to its saved layout.' });
    });
    await conn.ready;
    this.conn = conn;
    const r = await conn.ask({ type: 'set', patch: layoutFields(layout) });
    if (r.type === 'error') { conn.close(); this.conn = null; throw new Error(r.error); }
    this.set({ enabled: true, detail: '' });
    return this.state;
  }

  /** Mirror an edit while live (no-op otherwise). */
  async push(layout: Partial<BarLayout>): Promise<void> {
    if (!this.conn) return;
    const patch = layoutFields(layout);
    if (Object.keys(patch).length === 0) return;
    const r = await this.conn.ask({ type: 'set', patch });
    if (r.type === 'error') throw new Error(r.error);
  }

  /** Stop live: the bar shows its saved layout again. */
  async disable(): Promise<LiveState> {
    const conn = this.conn;
    this.conn = null;
    if (conn) {
      try { await conn.ask({ type: 'reset' }, 2000); } catch { /* closing restores it anyway */ }
      conn.close();
    }
    this.set({ enabled: false, detail: '' });
    return this.state;
  }

  /** The frame the physical bar is showing right now, as PNG bytes. */
  async snapshot(): Promise<Buffer> {
    if (!this.refresh().available) throw new Error('live control unavailable');
    // A short-lived connection: asking for a picture must never take over
    // (or end) the live lease.
    const conn = new Conn(this.file, () => {});
    try {
      await conn.ready;
      const r = await conn.ask({ type: 'snapshot' });
      if (r.type !== 'snapshot') throw new Error(r.type === 'error' ? r.error : 'unexpected reply');
      return Buffer.from(r.png, 'base64');
    } finally {
      conn.close();
    }
  }
}
