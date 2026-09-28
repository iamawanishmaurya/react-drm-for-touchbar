// Frame conversion — pure, unit-testable (REL-04).
// Preview ws binary frames: 16-byte header then BGRA rows (bottom-up? no —
// top-down rows), 4 bytes per pixel, width*height*4 + 16 total. Matches
// packaging/preview-capture.mjs.

export interface DecodedFrame {
  width: number;
  height: number;
  rgba: Uint8ClampedArray; // width*height*4
}

export function decodeFrame(buf: Uint8Array, fallbackW = 2008, fallbackH = 60): DecodedFrame | null {
  if (buf.length <= 16) return null;
  const payload = buf.length - 16;
  // Prefer header ints (little-endian dwords commonly carry w/h); validate
  // against payload size, else fall back.
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let width = dv.getUint32(0, true);
  let height = dv.getUint32(4, true);
  if (width * height * 4 !== payload) {
    width = fallbackW; height = fallbackH;
    if (width * height * 4 !== payload) return null;
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const b = buf[16 + i * 4];
    const g = buf[16 + i * 4 + 1];
    const r = buf[16 + i * 4 + 2];
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}
