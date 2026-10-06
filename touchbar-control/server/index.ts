/**
 * touchbar-control server.
 *
 *   /ws   frames sandbox → page (binary) each preceded by its scene when that
 *         changed (text), touches page → sandbox, and sandbox status (text). The page never talks to the sandbox directly:
 *         mtmr-designer found page→app socket messages getting lost, while the
 *         same messages relayed from a server always land.
 *   /api  layout, schema, apply/revert and sandbox control.
 *   /*    the built web app (in dev, Vite serves it and proxies here).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { HOST, PORT } from './config.ts';
import { Sandbox } from './sandbox.ts';
import { readAppliedLayout, applyLayout, listConfigBackups, restoreConfigBackup } from './apply.ts';
import { listPresets, savePreset, deletePreset } from './presets.ts';
import { LiveBar } from './liveBar.ts';
import type { ActionsState, ActiveWindow, BarLayout, LayoutSchema, Scene, ScreenState, ServerMessage, TouchMessage } from '../shared/types.ts';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const MAX_BUFFERED = 1 << 20; // drop frames for a page that can't keep up
const MAX_BODY = 64 * 1024;

const sandbox = new Sandbox();
const liveBar = new LiveBar();

// ── HTTP API ────────────────────────────────────────────────────────────────

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

type Handler = (req: http.IncomingMessage) => Promise<unknown>;
const api: Record<string, Handler> = {
  'GET /api/status': async () => ({ sandbox: sandbox.state, detail: sandbox.detail }),
  'GET /api/schema': () => sandbox.call<LayoutSchema>('/layout-schema'),
  'GET /api/layout': () => sandbox.call<BarLayout>('/layout'),
  // The sandbox validates the patch (parseLayoutPatch) and re-renders live;
  // with "Live on Touch Bar" on, the physical bar gets the same edit.
  'POST /api/layout': async req => {
    const body = await readBody(req);
    const layout = await sandbox.call<BarLayout>('/layout', body);
    if (liveBar.state.enabled) {
      await liveBar.push(body as Partial<BarLayout>).catch(e => console.warn('live push failed:', (e as Error).message));
    }
    return layout;
  },
  // "Live on Touch Bar": mirror edits onto the physical bar (no restart).
  'GET /api/live': async () => liveBar.refresh(),
  'POST /api/live': async req => {
    const enabled = (await readBody(req) as { enabled?: unknown } | null)?.enabled;
    if (typeof enabled !== 'boolean') throw new Error('enabled must be true or false');
    return enabled ? liveBar.enable(await sandbox.call<BarLayout>('/layout')) : liveBar.disable();
  },
  'GET /api/scene': () => sandbox.call<Scene>('/scene'),
  'GET /api/applied': () => readAppliedLayout(),
  'POST /api/apply': async () => {
    // The sandbox holds the edited layout; persist exactly what it shows.
    const layout = await sandbox.call<BarLayout>('/layout');
    return applyLayout(layout);
  },
  // "Preview as app": which window the sandbox pretends is focused.
  'GET /api/active-window': () => sandbox.call<{ override: ActiveWindow | null; real: ActiveWindow }>('/active-window'),
  'POST /api/active-window': async req => sandbox.call('/active-window', await readBody(req)),
  // Simulated vs real bar actions, and the recent simulated ones.
  'GET /api/actions': () => sandbox.call<ActionsState>('/actions'),
  'POST /api/actions': async req => sandbox.call<ActionsState>('/actions', await readBody(req)),
  // Screen navigator: which top-level bar screen is showing; jump to one.
  'GET /api/screen': () => sandbox.call<ScreenState>('/screen'),
  'POST /api/screen': async req => sandbox.call<ScreenState>('/screen', await readBody(req)),
  // Undo after Apply: config.ts snapshots taken before each Apply / restore.
  'GET /api/backups': async () => listConfigBackups(),
  'POST /api/backups/restore': async req => {
    const id = (await readBody(req) as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') throw new Error('id is required');
    return restoreConfigBackup(id);
  },
  'POST /api/sandbox/restart': async () => { await sandbox.restart(); return { ok: true }; },
  // My Presets (built-in presets are derived in the page from the schema).
  'GET /api/presets': async () => listPresets(),
  'PUT /api/presets': async req => savePreset(await readBody(req)),
  'DELETE /api/presets': async req => {
    const name = new URL(req.url ?? '', 'http://x').searchParams.get('name');
    if (!name) throw new Error('name is required');
    return deletePreset(name);
  },
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.normalize(path.join(DIST, url));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('web app not built — run `npm run build`, or use `npm run dev`');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const key = `${req.method} ${(req.url ?? '').split('?')[0]}`;
  // The physical bar's current frame, as a PNG (binary, so not in the JSON table).
  if (key === 'GET /api/live/snapshot') {
    try {
      const png = await liveBar.snapshot();
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      res.end(png);
    } catch (e) { sendJson(res, 503, { error: (e as Error).message }); }
    return;
  }
  const handler = api[key];
  if (handler) {
    try { sendJson(res, 200, await handler(req)); }
    catch (e) { sendJson(res, 400, { error: (e as Error).message }); }
    return;
  }
  if (req.url?.startsWith('/api/')) { sendJson(res, 404, { error: 'unknown endpoint' }); return; }
  serveStatic(req, res);
});

// ── WebSocket relay ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });

function sendText(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(msg: ServerMessage) {
  for (const ws of wss.clients) sendText(ws, msg);
}

sandbox.on('state', (state, detail) => broadcast({ type: 'status', sandbox: state, detail }));

function isTouch(v: unknown): v is TouchMessage {
  const m = v as TouchMessage;
  return !!m && (m.type === 'touchstart' || m.type === 'touchmove' || m.type === 'touchend')
    && Number.isFinite(m.x) && Number.isFinite(m.y);
}

wss.on('connection', page => {
  sandbox.acquire();
  sendText(page, { type: 'status', sandbox: sandbox.state, detail: sandbox.detail });

  let upstream: WebSocket | null = null;
  let closed = false;
  // Last touch position while a finger is down, so a page that disconnects
  // mid-press can't leave the app with a touch that never ends (which locks
  // its touch registry and silently drops every later tap).
  let down: { x: number; y: number } | null = null;

  const connectUpstream = async () => {
    if (closed) return;
    try { await sandbox.ensure(); } catch { setTimeout(connectUpstream, 2000); return; }
    if (closed) return;
    const up = new WebSocket(`ws://127.0.0.1:${sandbox.port}/ws`);
    upstream = up;
    up.on('message', (data: RawData, isBinary) => {
      if (page.readyState !== WebSocket.OPEN) return;
      // Scene messages (text) describe the frame that follows them: always
      // forward those, drop only frames for a page that can't keep up.
      if (!isBinary) { page.send(data.toString()); return; }
      if (page.bufferedAmount > MAX_BUFFERED) return;
      page.send(data, { binary: true });
    });
    up.on('close', () => {
      if (upstream === up) upstream = null;
      down = null;
      // Sandbox restarting (or crashed): keep trying while the page is here.
      if (!closed) setTimeout(connectUpstream, 1000);
    });
    up.on('error', () => { /* 'close' follows */ });
  };
  void connectUpstream();

  page.on('message', (data: RawData, isBinary) => {
    if (isBinary) return;
    let msg: unknown;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (!isTouch(msg)) return;
    down = msg.type === 'touchend' ? null : { x: msg.x, y: msg.y };
    if (upstream?.readyState === WebSocket.OPEN) upstream.send(JSON.stringify(msg));
  });

  page.on('close', () => {
    closed = true;
    if (down && upstream?.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({ type: 'touchend', ...down }));
    }
    upstream?.close();
    sandbox.release();
  });
});

// ── Lifecycle ───────────────────────────────────────────────────────────────

function shutdown() {
  sandbox.stop();
  // The bar would restore its saved layout on its own once this connection
  // drops, but say so explicitly first.
  void liveBar.disable().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => sandbox.stop());

server.listen(PORT, HOST, () => {
  console.log(`touchbar-control: http://${HOST}:${PORT}`);
});
