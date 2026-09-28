import { decodeFrame } from './frame';

// Live preview client: connects to the react-drm preview instance's
// websocket, decodes BGRA frames, draws the latest one onto a canvas.
// Reconnects with a 1s backoff when the instance restarts (D-04).

let ws: WebSocket | null = null;
let canvas: HTMLCanvasElement | null = null;
let stopped = true;
let latest: { width: number; height: number; rgba: Uint8ClampedArray } | null = null;
let raf = 0;
let backoff = 0;
let announced = false;

function draw(): void {
  raf = 0;
  if (!canvas || !latest) return;
  if (canvas.width !== latest.width || canvas.height !== latest.height) {
    canvas.width = latest.width;
    canvas.height = latest.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(latest.width, latest.height);
  img.data.set(latest.rgba);
  ctx.putImageData(img, 0, 0);
}

function connect(port: number): void {
  if (stopped) return;
  ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = ev => {
    if (!(ev.data instanceof ArrayBuffer)) return;
    const f = decodeFrame(new Uint8Array(ev.data));
    if (!f) return;
    latest = f;
    canvas?.classList.add('live');
    if (!announced) { announced = true; console.log('PREVIEW_LIVE w=', f.width, 'h=', f.height); }
    if (!raf) raf = requestAnimationFrame(draw);
  };
  ws.onclose = () => {
    ws = null;
    canvas?.classList.remove('live');
    if (!stopped) {
      backoff = Math.min(5000, backoff + 1000);
      setTimeout(() => { if (!stopped) connect(port); }, backoff);
    }
  };
  ws.onerror = () => ws?.close();
}

export function startPreviewClient(port: number): void {
  stopped = false;
  backoff = 0;
  connect(port);
}

export function attachPreviewCanvas(el: HTMLCanvasElement): void {
  canvas = el;
}

export function stopPreviewClient(): void {
  stopped = true;
  ws?.close();
  ws = null;
  if (raf) cancelAnimationFrame(raf);
}
