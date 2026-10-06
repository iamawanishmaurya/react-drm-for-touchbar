/**
 * The page's single connection to the sandbox bar (via the server's /ws):
 *   - binary messages are frames: 16-byte LE header (width, height, stride,
 *     format; format 1 = RGBA8888) + pixels, painted into one shared canvas
 *   - text messages are sandbox status, and scene (widget boxes) updates; a
 *     scene arrives just before the frame it describes, and is only adopted
 *     when that frame is painted, so `scene` and `frame` always match
 *   - touches go back as {type, x, y} in bar pixels
 *
 * Components subscribe instead of each opening a socket: the live bar and
 * every edit tile draw from the same latest frame.
 */
import type { SandboxState, Scene, ServerMessage, TouchMessage } from '../../../shared/types.ts';

type Listener = () => void;

export interface BarStatus {
  socket: 'connecting' | 'open' | 'closed';
  sandbox: SandboxState;
  detail: string;
  fps: number;
}

class Bar {
  /** Latest frame at native bar resolution. */
  readonly frame: HTMLCanvasElement = document.createElement('canvas');
  scene: Scene | null = null;
  status: BarStatus = { socket: 'connecting', sandbox: 'stopped', detail: '', fps: 0 };
  hasFrame = false;

  private ws: WebSocket | null = null;
  private frameListeners = new Set<Listener>();
  private stateListeners = new Set<Listener>();
  private pending: { img: ImageData; scene: Scene | null } | null = null;
  /** Newest scene received — belongs to the next frame to arrive. */
  private incomingScene: Scene | null = null;
  private rafQueued = false;
  private frameTimes: number[] = [];

  constructor() {
    this.frame.width = 2008;
    this.frame.height = 60;
    this.connect();
    // FPS readout decays to 0 when frames stop (the app only sends on change).
    setInterval(() => this.updateFps(), 1000);
  }

  private connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.setStatus({ socket: 'connecting' });
    ws.onopen = () => this.setStatus({ socket: 'open' });
    ws.onclose = () => {
      this.setStatus({ socket: 'closed' });
      setTimeout(() => this.connect(), 1000);
    };
    ws.onmessage = ev => {
      if (typeof ev.data === 'string') this.onText(ev.data);
      else this.onFrame(ev.data as ArrayBuffer);
    };
  }

  private onText(text: string) {
    let msg: ServerMessage;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.type === 'status') this.setStatus({ sandbox: msg.sandbox, detail: msg.detail ?? '' });
    else if (msg.type === 'scene') this.incomingScene = msg.scene;
  }

  private onFrame(buf: ArrayBuffer) {
    if (buf.byteLength < 16) return;
    const head = new DataView(buf, 0, 16);
    const w = head.getUint32(0, true), h = head.getUint32(4, true);
    const stride = head.getUint32(8, true), format = head.getUint32(12, true);
    if (format !== 1 || stride !== w * 4 || buf.byteLength < 16 + stride * h) return;
    this.pending = { img: new ImageData(new Uint8ClampedArray(buf, 16, stride * h), w, h), scene: this.incomingScene };
    this.frameTimes.push(performance.now());
    // Paint at most once per display frame, always the newest.
    if (!this.rafQueued) {
      this.rafQueued = true;
      requestAnimationFrame(() => {
        this.rafQueued = false;
        const next = this.pending;
        this.pending = null;
        if (!next) return;
        const img = next.img;
        if (this.frame.width !== img.width || this.frame.height !== img.height) {
          this.frame.width = img.width;
          this.frame.height = img.height;
        }
        this.frame.getContext('2d')!.putImageData(img, 0, 0);
        const sceneChanged = next.scene !== this.scene;
        this.scene = next.scene;
        if (!this.hasFrame || sceneChanged) { this.hasFrame = true; this.emitState(); }
        for (const l of this.frameListeners) l();
      });
    }
  }

  private updateFps() {
    const now = performance.now();
    this.frameTimes = this.frameTimes.filter(t => now - t < 1000);
    if (this.frameTimes.length !== this.status.fps) this.setStatus({ fps: this.frameTimes.length });
  }

  private setStatus(patch: Partial<BarStatus>) {
    this.status = { ...this.status, ...patch };
    this.emitState();
  }
  private emitState() { for (const l of this.stateListeners) l(); }

  onFrameDrawn(l: Listener): () => void { this.frameListeners.add(l); return () => { this.frameListeners.delete(l); }; }
  onChange(l: Listener): () => void { this.stateListeners.add(l); return () => { this.stateListeners.delete(l); }; }

  touch(msg: TouchMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  box(id: string) {
    return this.scene?.boxes.find(b => b.id === id) ?? null;
  }
}

export const bar = new Bar();
