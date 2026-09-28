import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFrame } from './frame.js';

// REL-04: frame parsing regression tests (header skip, BGRA→RGBA, stride).

function makeFrame(w: number, h: number): Uint8Array {
  const buf = new Uint8Array(16 + w * h * 4);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, w, true);
  dv.setUint32(4, h, true);
  // pixel (0,0) = B=1 G=2 R=3 A=4; pixel (1,0) = B=5 G=6 R=7 A=8
  buf[16] = 1; buf[17] = 2; buf[18] = 3; buf[19] = 4;
  buf[20] = 5; buf[21] = 6; buf[22] = 7; buf[23] = 8;
  return buf;
}

test('decodeFrame skips the 16-byte header and swaps BGRA→RGBA', () => {
  const f = decodeFrame(makeFrame(4, 2))!;
  assert.equal(f.width, 4);
  assert.equal(f.height, 2);
  assert.deepEqual([f.rgba[0], f.rgba[1], f.rgba[2], f.rgba[3]], [3, 2, 1, 255]);
});

test('decodeFrame preserves pixel stride', () => {
  const f = decodeFrame(makeFrame(4, 2))!;
  assert.deepEqual([f.rgba[4], f.rgba[5], f.rgba[6]], [7, 6, 5]);
});

test('decodeFrame falls back to given dimensions when the header does not match', () => {
  // payload sized for 2008×60 but header carries a bogus width
  const w = 2008, h = 60;
  const buf = new Uint8Array(16 + w * h * 4);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 9999, true);
  dv.setUint32(4, h, true);
  const f = decodeFrame(buf, w, h);
  assert.ok(f);
  assert.equal(f.width, w);
  assert.equal(f.height, h);
});

test('decodeFrame rejects payloads that fit no dimension pair', () => {
  const junk = new Uint8Array(16 + 7);
  assert.equal(decodeFrame(junk, 2008, 60), null);
  assert.equal(decodeFrame(new Uint8Array(4)), null);
});
