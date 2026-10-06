import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import type { PreviewDisplay } from '../native/preview-display';
import type { RenderResult } from '../renderer/renderer';
import { createLogger } from '../logger';

const log = createLogger('preview-server');

// Wire protocol: every WS message is binary — a 16-byte header (width,
// height, stride, format as uint32 LE) followed by raw pixel bytes. Format 1
// = RGBA8888, already converted from Cairo's native byte order by
// PreviewDisplay/getFrameBuffer (see native/src/binding.cpp). Self-describing
// so the browser never has to guess dimensions or assume ARGB == RGBA.
const FORMAT_RGBA8888 = 1;
const HEADER_BYTES = 16;

// A frame is dropped for a client rather than queued once its socket buffer
// backs up past this — bounded memory over exact frame delivery.
const MAX_BUFFERED_BYTES = 1 << 20;

/**
 * App-supplied JSON endpoints, keyed by path (e.g. '/scene'). `get` answers a
 * GET; `post` receives the parsed JSON body of a POST. Whatever they return is
 * sent back as JSON; a thrown error becomes a 400 with its message. This keeps
 * app-specific control surfaces (a layout editor's sandbox, say) out of the
 * library while reusing the server the preview already runs.
 */
export interface PreviewJsonRoute {
  get?: () => unknown;
  post?: (body: unknown) => unknown;
}

export interface PreviewServerOptions {
  port?: number;
  host?: string;
  routes?: Record<string, PreviewJsonRoute>;
  /**
   * Per-frame metadata (e.g. widget boxes). Evaluated as each frame is sent;
   * when its JSON differs from the previous frame's it goes out as a text
   * message `{"type":"scene","scene":…}` immediately *before* that frame. A
   * client can then pair geometry with exactly the pixels it describes —
   * polling for it separately races the frames during animations.
   */
  frameScene?: () => unknown;
}

// Control payloads are small (a layout is a few hundred bytes); cap what a
// client can make the server buffer.
const MAX_JSON_BODY = 64 * 1024;

export interface PreviewServerHandle {
  url: string;
  stop(): void;
}

const PAGE_PATH = path.join(__dirname, 'preview-page.html');

/**
 * Serves the browser dev-preview page and streams PreviewDisplay's Cairo
 * framebuffer to it over WebSocket, forwarding the browser's simulated
 * touch input back into the same touchStart/Move/End API real Touch Bar
 * hardware drives (RenderResult from render()/renderHot()).
 */
export function startPreviewServer(
  display: PreviewDisplay,
  input: Pick<RenderResult, 'touchStart' | 'touchMove' | 'touchEnd'>,
  options: PreviewServerOptions = {},
  /**
   * Optional scene serializer. The frames this server streams are Cairo's
   * output; `/svg` additionally exposes the same scene as markup, so a tool
   * (the designer) can address real nodes by `id` instead of inferring them
   * from pixels.
   */
  toSvg?: () => string,
): PreviewServerHandle {
  const port = options.port ?? (Number(process.env.REACT_DRM_PREVIEW_PORT) || 8787);
  const host = options.host ?? '127.0.0.1';

  const page = fs.readFileSync(PAGE_PATH);

  const httpServer = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page);
      return;
    }
    if (req.url === '/svg' || req.url === '/bar.svg') {
      const svg = toSvg?.() ?? '';
      if (!svg) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('scene not committed yet');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(svg);
      return;
    }
    const route = options.routes?.[(req.url ?? '').split('?')[0]];
    if (route) {
      handleJsonRoute(route, req, res);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  function sendJson(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body ?? null));
  }

  function handleJsonRoute(route: PreviewJsonRoute, req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === 'GET' && route.get) {
      try { sendJson(res, 200, route.get()); } catch (e) { sendJson(res, 500, { error: String((e as Error)?.message ?? e) }); }
      return;
    }
    if (req.method === 'POST' && route.post) {
      const post = route.post;
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_JSON_BODY) { sendJson(res, 413, { error: 'body too large' }); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'); }
        catch { sendJson(res, 400, { error: 'invalid JSON' }); return; }
        try { sendJson(res, 200, post(body)); } catch (e) { sendJson(res, 400, { error: String((e as Error)?.message ?? e) }); }
      });
      return;
    }
    sendJson(res, 405, { error: 'method not allowed' });
  }

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  let lastFrame: Buffer | null = null;
  let lastSceneMsg: string | null = null;

  function frameMessage(rgba: Buffer, width: number, height: number): Buffer {
    const header = Buffer.alloc(HEADER_BYTES);
    header.writeUInt32LE(width, 0);
    header.writeUInt32LE(height, 4);
    header.writeUInt32LE(width * 4, 8); // PreviewDisplay buffers are always tightly packed
    header.writeUInt32LE(FORMAT_RGBA8888, 12);
    return Buffer.concat([header, rgba]);
  }

  // Fires once per completed native render — renderer.ts already rate-caps
  // and dedups blits upstream (RenderOptions.flushFps), so there's no need
  // for a second throttle here; this only guards against a slow WS client.
  display.onFrame = (rgba, width, height) => {
    const msg = frameMessage(rgba, width, height);
    lastFrame = msg;
    let sceneMsg: string | null = null;
    if (options.frameScene) {
      try {
        const text = JSON.stringify({ type: 'scene', scene: options.frameScene() });
        if (text !== lastSceneMsg) { lastSceneMsg = text; sceneMsg = text; }
      } catch (e) {
        log.warn('frameScene failed:', e);
      }
    }
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      // A scene change is never dropped (the frame after it would be read
      // against stale geometry); only frames are, for a backed-up client.
      if (sceneMsg) client.send(sceneMsg);
      if (client.bufferedAmount > MAX_BUFFERED_BYTES) continue;
      client.send(msg, { binary: true });
    }
  };

  wss.on('connection', (ws) => {
    if (lastSceneMsg) ws.send(lastSceneMsg);
    if (lastFrame) ws.send(lastFrame, { binary: true });

    ws.on('message', (data) => {
      let msg: { type?: string; x?: number; y?: number };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (typeof msg.x !== 'number' || typeof msg.y !== 'number') return;
      const x = Math.max(0, Math.min(display.width - 1, Math.round(msg.x)));
      const y = Math.max(0, Math.min(display.height - 1, Math.round(msg.y)));
      switch (msg.type) {
        case 'touchstart': input.touchStart(x, y); break;
        case 'touchmove':  input.touchMove(x, y); break;
        case 'touchend':   input.touchEnd(x, y); break;
      }
    });
  });

  httpServer.listen(port, host, () => {
    log.info(`running at http://${host}:${port}`);
  });

  return {
    url: `http://${host}:${port}`,
    stop() {
      display.onFrame = undefined;
      for (const client of wss.clients) client.terminate();
      wss.close();
      httpServer.close();
    },
  };
}
