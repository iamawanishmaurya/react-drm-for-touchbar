/**
 * Owns the sandbox: a preview instance of the real Touch Bar app
 * (REACT_DRM_BACKEND=preview, REACT_DRM_SANDBOX=1) that this site streams,
 * touches and rearranges without affecting the physical bar.
 */
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { APP_DIR, SANDBOX_PORT, SANDBOX_LOG, SANDBOX_IDLE_MS } from './config.ts';
import type { SandboxState } from '../shared/types.ts';

const BOOT_TIMEOUT_MS = 60_000;

function portOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const sock = net.connect({ host: '127.0.0.1', port }, () => { sock.end(); resolve(true); });
    sock.on('error', () => resolve(false));
    sock.setTimeout(500, () => { sock.destroy(); resolve(false); });
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class Sandbox extends EventEmitter {
  readonly port = SANDBOX_PORT;
  readonly base = `http://127.0.0.1:${SANDBOX_PORT}`;
  state: SandboxState = 'stopped';
  detail = '';
  private proc: ChildProcess | null = null;
  private starting: Promise<void> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private users = 0;

  private setState(state: SandboxState, detail = '') {
    this.state = state;
    this.detail = detail;
    this.emit('state', state, detail);
  }

  /** Starts the sandbox if needed and resolves once it answers /scene. */
  ensure(): Promise<void> {
    if (this.state === 'ready' && this.proc) return Promise.resolve();
    this.starting ??= this.start().finally(() => { this.starting = null; });
    return this.starting;
  }

  private async start() {
    this.setState('starting', 'booting the Touch Bar app');
    // A sandbox left behind by an earlier run holds the port and would answer
    // with a stale layout — clear it before spawning our own.
    if (!this.proc && await portOpen(this.port)) {
      await new Promise<void>(r => execFile('fuser', ['-k', `${this.port}/tcp`], () => r()));
      for (let i = 0; i < 20 && await portOpen(this.port); i++) await sleep(250);
    }

    const log = fs.openSync(SANDBOX_LOG, 'a');
    const proc = spawn('npx', ['tsx', 'index.tsx'], {
      cwd: APP_DIR,
      // Own process group: npx → node, so the whole tree can be killed at once
      // (killing only the npx wrapper orphans the app and keeps the port).
      detached: true,
      stdio: ['ignore', log, log],
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}:${process.env.PATH ?? ''}`,
        REACT_DRM_BACKEND: 'preview',
        REACT_DRM_PREVIEW_PORT: String(this.port),
        REACT_DRM_SANDBOX: '1',
        NODE_ENV: 'production',
        DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS ?? `unix:path=/run/user/${process.getuid?.()}/bus`,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.()}`,
      },
    });
    fs.closeSync(log);
    this.proc = proc;
    proc.on('exit', (code, signal) => {
      if (this.proc !== proc) return;
      this.proc = null;
      this.setState(signal === 'SIGTERM' ? 'stopped' : 'error', `sandbox exited (${signal ?? code}); see ${SANDBOX_LOG}`);
    });

    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.proc !== proc) throw new Error(this.detail || 'sandbox exited during boot');
      try {
        const res = await fetch(`${this.base}/scene`);
        // The scene exists from the first commit; boxes appear once the app's
        // main layout has mounted (after the boot splash).
        if (res.ok && ((await res.json()) as { boxes: unknown[] }).boxes.length > 0) {
          this.setState('ready');
          return;
        }
      } catch { /* not listening yet */ }
      await sleep(400);
    }
    this.stop();
    this.setState('error', `sandbox didn't come up within ${BOOT_TIMEOUT_MS / 1000}s; see ${SANDBOX_LOG}`);
    throw new Error(this.detail);
  }

  stop() {
    const proc = this.proc;
    this.proc = null;
    if (proc?.pid) {
      try { process.kill(-proc.pid, 'SIGTERM'); } catch { /* already gone */ }
    }
    this.setState('stopped');
  }

  async restart() {
    this.stop();
    for (let i = 0; i < 20 && await portOpen(this.port); i++) await sleep(250);
    return this.ensure();
  }

  /** Reference-count connected pages; stop after a quiet period with none. */
  acquire() {
    this.users++;
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
  }
  release() {
    this.users = Math.max(0, this.users - 1);
    if (this.users === 0 && !this.idleTimer) {
      this.idleTimer = setTimeout(() => { this.idleTimer = null; if (this.users === 0) this.stop(); }, SANDBOX_IDLE_MS);
    }
  }

  /** JSON call into the sandbox's own endpoints (/scene, /layout, …). */
  async call<T>(route: string, body?: unknown): Promise<T> {
    await this.ensure();
    const res = await fetch(`${this.base}${route}`, body === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as T & { error?: string };
    if (!res.ok) throw new Error(data.error ?? `sandbox ${route} → HTTP ${res.status}`);
    return data;
  }
}
