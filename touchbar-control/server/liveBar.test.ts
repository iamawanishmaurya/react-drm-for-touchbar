import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LiveBar } from './liveBar.ts';

/** A stand-in for the bar's live socket that records what it's asked. */
function fakeBar() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tbc-live-')), 'live.sock');
  const got: { conn: number; msg: { type: string; patch?: Record<string, unknown> } }[] = [];
  const socks: net.Socket[] = [];
  let conns = 0;
  const server = net.createServer(sock => {
    const id = ++conns;
    socks.push(sock);
    let buf = '';
    sock.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
        got.push({ conn: id, msg });
        const reply = msg.type === 'snapshot' ? { type: 'snapshot', png: Buffer.from('PNGDATA').toString('base64') }
          : { type: 'layout', layout: {}, live: msg.type === 'set' };
        sock.write(JSON.stringify(reply) + '\n');
      }
    });
  });
  return { file, got, server, socks, listen: () => new Promise<void>(r => server.listen(file, () => r())) };
}

const layout = { rightButtons: ['snake'], hidden: ['linux'], left: { vscode: { run: ['stop'] } }, pinnedLeft: 'vscode' };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test('unavailable when the bar has no live socket', async () => {
  const live = new LiveBar(path.join(os.tmpdir(), 'no-such-live.sock'));
  assert.equal(live.state.available, false);
  await assert.rejects(live.enable(layout), /not offering live control/);
});

test('enable sends the layout (never pinnedLeft); edits are mirrored; disable resets', async () => {
  const bar = fakeBar(); await bar.listen();
  const live = new LiveBar(bar.file);
  await live.enable(layout);
  assert.equal(live.state.enabled, true);
  assert.deepEqual(bar.got[0].msg, { type: 'set', patch: { rightButtons: ['snake'], hidden: ['linux'], left: { vscode: { run: ['stop'] } } } });
  await live.push({ hidden: [], pinnedLeft: 'browser' });
  assert.deepEqual(bar.got[1].msg, { type: 'set', patch: { hidden: [] } });
  await live.push({ pinnedLeft: 'browser' });
  assert.equal(bar.got.length, 2, 'a pin-only change is not sent to the real bar');
  await live.disable();
  assert.equal(bar.got[2].msg.type, 'reset');
  assert.equal(live.state.enabled, false);
  bar.server.close();
});

test('the bar dropping the connection (restart after Apply) turns Live off', async () => {
  const bar = fakeBar(); await bar.listen();
  const live = new LiveBar(bar.file);
  await live.enable(layout);
  for (const s of bar.socks) s.destroy();
  await sleep(100);
  assert.equal(live.state.enabled, false);
  assert.match(live.state.detail, /saved layout/);
  bar.server.close();
});

test('snapshots use their own connection and never touch the live one', async () => {
  const bar = fakeBar(); await bar.listen();
  const live = new LiveBar(bar.file);
  await live.enable(layout);
  const png = await live.snapshot();
  assert.equal(png.toString(), 'PNGDATA');
  const snapMsg = bar.got.find(g => g.msg.type === 'snapshot')!;
  assert.notEqual(snapMsg.conn, bar.got[0].conn);
  await sleep(50);
  assert.equal(live.state.enabled, true, 'still live after a snapshot');
  await live.disable();
  bar.server.close();
});
