// Capture frames from a react-drm preview instance (REACT_DRM_BACKEND=preview)
// and optionally send synthetic touches first. Writes PNG files.
//
//   node preview-capture.mjs out1.png [x,y out2.png ...]
//   For each "x,y out2.png" pair the script taps (touchstart+touchend) at
//   x,y on the bar, waits for the layer transition, then saves a frame.
import WebSocket from '/home/Astra/opencode/react-drm/node_modules/ws/index.js';
import fs from 'fs';
import zlib from 'zlib';

const W = 2008, H = 60;
const args = process.argv.slice(2);
if (!args.length) { console.error('usage: node preview-capture.mjs out.png [x,y out2.png ...]'); process.exit(1); }

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// frame = 16-byte header + BGRA rows (from the preview websocket binary msg)
function frameToPng(frame) {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const row = frame.subarray(y * W * 4, (y + 1) * W * 4);
    raw[y * (1 + W * 3)] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const o = y * (1 + W * 3) + 1 + x * 3;
      raw[o] = row[x * 4 + 2]; raw[o + 1] = row[x * 4 + 1]; raw[o + 2] = row[x * 4];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

let frame = null, lastAt = 0;
const ws = new WebSocket('ws://127.0.0.1:8787/ws');
ws.on('message', (d, isBinary) => {
  if (isBinary) { frame = d.subarray(16); lastAt = Date.now(); }
});
const waitStable = (ms = 600) =>
  new Promise(r => { lastAt = 0; setTimeout(() => { const f = frame; frame = null; r(f); }, ms); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tap = (x, y) => {
  const m = t => ws.send(JSON.stringify({ type: t, x, y }));
  m('touchstart'); setTimeout(() => m('touchend'), 80);
};

ws.on('open', async () => {
  try {
    await sleep(500);
    // wait until at least one frame arrived, then settle
    for (let i = 0; i < 20 && !frame; i++) await sleep(100);
    if (!frame) { console.error('no frame received'); process.exit(1); }

    let [file, ...rest] = args;
    fs.writeFileSync(file, frameToPng(frame));
    console.log('saved', file);

    while (rest.length) {
      const [xy, out] = rest.splice(0, 2);
      const [x, y] = xy.split(',').map(Number);
      tap(x, y);
      await sleep(1400); // layer transition
      const f = await waitStable();
      if (!f) { console.error('no frame for', out); process.exit(1); }
      fs.writeFileSync(out, frameToPng(f));
      console.log('saved', out, 'after tap at', xy);
    }
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
});
setTimeout(() => { console.error('timeout'); process.exit(1); }, 30000);
