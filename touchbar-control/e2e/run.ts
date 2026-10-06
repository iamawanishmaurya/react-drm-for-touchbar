/**
 * End-to-end check against a running server (npm start / npm run dev):
 * drives the real page in headless Firefox and verifies each action by asking
 * the sandbox what it actually rendered (its scene), not by trusting the DOM.
 *
 *   npx tsx e2e/run.ts [outDir]     screenshots land in outDir (default /tmp)
 *
 * Never confirms Apply — that rewrites config.ts and restarts the physical bar
 * (the Apply dialog is opened and cancelled). Saved test presets are deleted.
 */
import puppeteer, { type Page } from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import type { BarLayout, SavedPreset, Scene } from '../shared/types.ts';
import { CONFIG_PATH } from '../server/config.ts';

const BASE = process.env.TBC_URL ?? 'http://127.0.0.1:3100';
const OUT = process.argv[2] ?? '/tmp';
const FIREFOX = process.env.FIREFOX ?? '/usr/bin/firefox';
// The config.ts Apply would write — the same one the server uses.
const CONFIG_TS = process.env.TBC_CONFIG_TS ?? CONFIG_PATH;
const PRESET = 'e2e-test-preset';

const get = async <T>(p: string): Promise<T> => (await fetch(BASE + p)).json() as Promise<T>;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const visible = (s: Scene, id: string) => s.boxes.find(b => b.id === id && b.visible);
const tile = (id: string) => `.edit-frame [data-tile="${id}"]`;
const pickApp = async (page: Page, id: string) => {
  await page.click('[data-app-picker]');
  await page.waitForSelector(`[data-app="${id}"]`);
  await page.click(`[data-app="${id}"]`);
};
const layout = () => get<BarLayout>('/api/layout');

async function until<T>(what: string, fn: () => Promise<T | undefined | false>, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(150);
  }
  throw new Error(`timed out waiting for: ${what}`);
}

async function shot(page: Page, name: string) {
  const file = path.join(OUT, `tbc-${name}.png`);
  await page.screenshot({ path: file as `${string}.png` });
  console.log(`  screenshot ${file}`);
}

/** Click the first visible element matching `selector` whose text includes `text`. */
async function clickText(page: Page, selector: string, text: string) {
  const handle = await until(`"${text}" in ${selector}`, async () => {
    for (const el of await page.$$(selector)) {
      const t = await el.evaluate(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim());
      const box = await el.boundingBox();
      if (t.includes(text) && box && box.width > 0) return el;
    }
    return undefined;
  });
  await handle.click();
}

const menu = async (page: Page, trigger: string, item: string) => {
  await clickText(page, '[data-slot="menubar-trigger"]', trigger);
  await clickText(page, '[role="menuitem"], [role="menuitemradio"]', item);
};

/** Coarse signature of a tile's pixels (mean brightness over a 12×4 grid of
 *  its interior, skipping 3px of edge whose corners legitimately change with
 *  position) — proves a tile still shows its own widget. String-evaluated: tsx
 *  would inject helpers into a function the page can't see. */
const tileSig = (page: Page, selector: string): Promise<number[]> => page.evaluate(`(() => {
  const c = document.querySelector(${JSON.stringify(selector)});
  if (!c || !c.width) return [];
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const GX = 12, GY = 4, M = 3, iw = w - 2 * M, ih = h - 2 * M, out = [];
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    let sum = 0, n = 0;
    for (let y = M + Math.floor(gy * ih / GY); y < M + Math.floor((gy + 1) * ih / GY); y++)
      for (let x = M + Math.floor(gx * iw / GX); x < M + Math.floor((gx + 1) * iw / GX); x++) {
        const i = (y * w + x) * 4; sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++;
      }
    out.push(n ? sum / n : 0);
  }
  return out;
})()`);

function assertSameTile(a: number[], b: number[], what: string) {
  assert.equal(a.length, b.length, `${what}: tile drawn`);
  const worst = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  assert.ok(worst < 12, `${what}: pixels differ (worst cell Δ${worst.toFixed(1)})`);
}

async function drag(page: Page, from: string, to: string, toSide: 'left' | 'center' = 'left') {
  const a = await page.$(from), b = await page.$(to);
  assert.ok(a && b, `drag endpoints exist: ${from} → ${to}`);
  const ra = (await a!.boundingBox())!, rb = (await b!.boundingBox())!;
  const sx = ra.x + ra.width / 2, sy = ra.y + ra.height / 2;
  const tx = toSide === 'left' ? rb.x + 4 : rb.x + rb.width / 2, ty = rb.y + rb.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) { await page.mouse.move(sx + ((tx - sx) * i) / 15, sy + ((ty - sy) * i) / 15); await sleep(16); }
  await sleep(120);
  await page.mouse.up();
}

async function chord(page: Page, keys: string[]) {
  for (const k of keys.slice(0, -1)) await page.keyboard.down(k as never);
  await page.keyboard.press(keys[keys.length - 1] as never);
  for (const k of keys.slice(0, -1).reverse()) await page.keyboard.up(k as never);
}

const results: [string, boolean, string?][] = [];
const sigs: Record<string, number[]> = {};
async function step(name: string, fn: () => Promise<void>) {
  process.stdout.write(`• ${name}\n`);
  try { await fn(); results.push([name, true]); }
  catch (e) { results.push([name, false, (e as Error).message]); console.log(`  FAILED: ${(e as Error).message}`); }
}

const browser = await puppeteer.launch({
  browser: 'firefox', executablePath: FIREFOX, headless: true,
  defaultViewport: { width: 1700, height: 950 },
});
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', e => errors.push(String(e)));
const configMtime = () => fs.statSync(CONFIG_TS).mtimeMs;
const mtimeBefore = configMtime();

try {
  const applied = await get<BarLayout>('/api/applied');
  // Start from a known state whatever an earlier session left behind: the
  // sandbox shows the applied layout, real focus, the main bar.
  const post = (p: string, body: unknown) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await post('/api/layout', { ...applied, pinnedLeft: null });
  await post('/api/active-window', null);
  await post('/api/actions', { real: false });
  await post('/api/screen', { to: 'splitted' });

  await step('page loads and paints real frames', async () => {
    await page.goto(BASE, { waitUntil: 'load' });
    await until('a painted frame', () => page.evaluate(`(() => {
      const c = document.querySelector('.bar-canvas');
      if (!c || c.width < 100) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) return true;
      return false;
    })()`) as Promise<boolean>, 60000);
    await shot(page, '1-use');
  });

  await step('a click on the live bar is a real tap (volume → audio slider)', async () => {
    const scene = await get<Scene>('/api/scene');
    const vol = visible(scene, 'volume');
    assert.ok(vol, 'volume button visible before tapping');
    const r = (await (await page.$('.bar-canvas'))!.boundingBox())!;
    await page.mouse.click(r.x + ((vol!.x + vol!.w / 2) / scene.width) * r.width, r.y + ((vol!.y + vol!.h / 2) / scene.height) * r.height);
    await until('cluster to leave (slider layer shown)', async () => !visible(await get<Scene>('/api/scene'), 'volume'));
    await shot(page, '2-tap-slider');
    await until('main bar back', async () => !!visible(await get<Scene>('/api/scene'), 'volume'), 15000);
  });

  await step('Screen navigator jumps the sandbox bar to any screen', async () => {
    await page.click('[data-screen-picker]');
    await page.waitForSelector('[data-screen="dock"]');
    await page.click('[data-screen="dock"]');
    await until('dock showing', async () => (await get<{ current: string }>('/api/screen')).current === 'dock');
    await shot(page, '2a-dock');
    await page.click('[data-screen-picker]');
    await page.waitForSelector('[data-screen="splitted"]');
    await page.click('[data-screen="splitted"]');
    await until('main bar back', async () => (await get<{ current: string }>('/api/screen')).current === 'splitted');
    await until('cluster visible', async () => !!visible(await get<Scene>('/api/scene'), 'volume'));
  });

  await step('Preview as Firefox: the bar reacts as if Firefox were focused (real focus untouched)', async () => {
    await pickApp(page, 'firefox');
    await until('browser panel shown', async () => !!visible(await get<Scene>('/api/scene'), 'browser.home'));
    const aw = await get<{ override: { class: string } | null; real: { class: string } }>('/api/active-window');
    assert.equal(aw.override?.class, 'firefox');
    assert.notEqual(aw.real.class, 'firefox', 'the real focused window is not changed');
    await shot(page, '2b-preview-firefox');
  });

  await step('Safe preview: a browser button is simulated, not pressed', async () => {
    const before = (await get<{ recent: { seq: number }[] }>('/api/actions')).recent.length;
    // The panel is drawn a beat before its touch regions go live (the layer
    // transition finishes first) — let it settle, and retry once.
    await sleep(1500);
    type St = { real: boolean; recent: { what: string }[] };
    let st: St | undefined;
    for (let attempt = 0; attempt < 2 && !st; attempt++) {
      const scene = await get<Scene>('/api/scene');
      const b = visible(scene, 'browser.reload')!;
      const r = (await (await page.$('.bar-canvas'))!.boundingBox())!;
      await page.mouse.click(r.x + ((b.x + b.w / 2) / scene.width) * r.width, r.y + ((b.y + b.h / 2) / scene.height) * r.height);
      st = await until('action recorded', async () => {
        const s = await get<St>('/api/actions');
        return s.recent.length > before ? s : undefined;
      }, 2500).catch(() => undefined);
    }
    assert.ok(st, 'the tap was recorded as a simulated action');
    assert.equal(st!.real, false);
    assert.match(st!.recent[st!.recent.length - 1].what, /^Press Ctrl\+R$/);
    await page.waitForSelector('[data-activity] li');
    await shot(page, '2c-simulated');
  });

  await step('Edit mode: tiles of the previewed app, palette, properties', async () => {
    await pickApp(page, 'vscode');
    await page.click('[aria-label="Edit the layout"]');
    await page.waitForSelector(tile('snake'));
    await until('vscode panel pinned in the sandbox', async () => !!visible(await get<Scene>('/api/scene'), 'vscode.run'));
    await until('tile crops drawn', () => page.evaluate(`!!document.querySelector('[data-tile="vscode.run"] canvas')?.width`) as Promise<boolean>);
    assert.equal((await page.$$('.edit-frame [data-tile]')).length, 7 + 10, 'right cluster (7) + vscode (10) tiles');
    assert.equal((await page.$$('[data-palette]')).length, 17, 'palette lists every button');
    const overflow = await page.$eval('.edit-frame', el => el.scrollWidth - el.clientWidth);
    assert.ok(overflow <= 1, `tiles fit the frame (overflow ${overflow}px)`);
    await sleep(600);
    for (const id of ['snake', 'volume', 'back', 'vscode.run']) sigs[id] = await tileSig(page, `${tile(id)} canvas`);
    await page.click(tile('snake'));
    await page.waitForSelector('[data-properties="snake"]');
    await shot(page, '3-edit');
  });

  await step('dragging a tile reorders the real bar live; tiles keep their pixels', async () => {
    await drag(page, tile('snake'), tile('back'));
    await until('layout pushed', async () => (await layout()).rightButtons[0] === 'snake');
    await until('scene reflowed', async () => {
      const s = await get<Scene>('/api/scene');
      const sn = visible(s, 'snake'), bk = visible(s, 'back');
      return !!(sn && bk && sn.x < bk.x);
    });
    await sleep(1200);
    await shot(page, '4-reordered');
    for (const id of ['snake', 'volume', 'back', 'vscode.run']) {
      assertSameTile(await tileSig(page, `${tile(id)} canvas`), sigs[id], `${id} after reorder`);
    }
  });

  await step('right-click → Hide takes a button off the bar', async () => {
    await page.click(tile('volume'), { button: 'right' });
    await clickText(page, '[role="menuitem"]', 'Hide');
    await until('volume hidden in sandbox', async () => (await layout()).hidden.includes('volume'));
    await until('volume gone from scene', async () => !visible(await get<Scene>('/api/scene'), 'volume'));
    await page.waitForSelector('[data-tray] [data-tile="volume"]');
    await sleep(1000);
    assertSameTile(await tileSig(page, '[data-tray] [data-tile="volume"] canvas'), sigs.volume, 'hidden volume tile');
    await shot(page, '5-hidden');
  });

  await step('Undo / Redo (Ctrl+Z, Ctrl+Shift+Z) drive the real bar', async () => {
    await page.click('[data-statusbar]'); // focus the page, not a text field
    await chord(page, ['Control', 'z']);
    await until('undo shows volume again', async () => !(await layout()).hidden.includes('volume'));
    await chord(page, ['Control', 'Shift', 'Z']);
    await until('redo hides it again', async () => (await layout()).hidden.includes('volume'));
  });

  await step('dragging a hidden button from the palette shows it at the drop spot', async () => {
    await drag(page, '[data-palette="volume"]', tile('snake'));
    await until('volume back, placed first', async () => {
      const l = await layout();
      return !l.hidden.includes('volume') && l.rightButtons[0] === 'volume';
    });
    await until('scene shows it', async () => !!visible(await get<Scene>('/api/scene'), 'volume'));
  });

  await step('a button cannot be dragged into another group', async () => {
    const before = await layout();
    await drag(page, tile('vscode.run'), tile('linux'));
    await sleep(500);
    const after = await layout();
    assert.deepEqual(after.left.vscode, before.left.vscode);
    assert.deepEqual(after.rightButtons, before.rightButtons);
  });

  await step('Ctrl+K command palette → Show config shows what Apply writes', async () => {
    await page.click('[data-statusbar]');
    await chord(page, ['Control', 'k']);
    await page.waitForSelector('[cmdk-input]');
    await page.type('[cmdk-input]', 'show config');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-config]');
    const text = await page.$eval('[data-config]', el => el.textContent ?? '');
    assert.match(text, /export const BAR_LAYOUT = \{/);
    assert.match(text, /rightButtons: \['volume', 'snake', 'back'/);
    await shot(page, '6-config');
    await page.keyboard.press('Escape');
    await until('sheet closed', async () => !(await page.$('[data-config]')));
  });

  await step('Presets: save current, load a built-in, load mine back', async () => {
    const mine = (await layout()).rightButtons.join();
    await menu(page, 'Presets', 'Save current as preset');
    await page.waitForSelector('#preset-name');
    await page.type('#preset-name', PRESET);
    await page.keyboard.press('Enter');
    await until('preset stored', async () => (await get<SavedPreset[]>('/api/presets')).some(p => p.name === PRESET));
    // The Save dialog fades out; a menu click during that lands on its overlay.
    await until('save dialog closed', async () => !(await page.$('[role="dialog"]')));
    await sleep(300);
    await menu(page, 'Presets', 'Minimal');
    await until('Minimal applied', async () => {
      const l = await layout();
      return l.hidden.includes('snake') && l.hidden.includes('back');
    });
    await menu(page, 'Presets', PRESET);
    await until('my preset restored', async () => {
      const l = await layout();
      return l.rightButtons.join() === mine && !l.hidden.includes('snake');
    });
  });

  await step('Preview as Chrome in Edit mode: arrange the browser buttons', async () => {
    await pickApp(page, 'chrome');
    await page.waitForSelector(tile('browser.home'));
    await until('browser panel pinned', async () => !!visible(await get<Scene>('/api/scene'), 'browser.home'));
    await drag(page, tile('browser.home'), tile('browser.back'));
    await until('browser nav reordered', async () => (await layout()).left.browser?.nav?.[0] === 'home');
    await shot(page, '7-browser');
  });

  await step('File → Import loads a layout file', async () => {
    const file = path.join(os.tmpdir(), 'tbc-e2e-layout.json');
    fs.writeFileSync(file, JSON.stringify({
      format: 'touchbar-control/layout', version: 1,
      layout: { rightButtons: ['linux', 'back'], hidden: ['screenshot'], left: {} },
    }));
    const input = await page.$('[data-import]');
    await input!.uploadFile(file);
    await until('imported layout live', async () => {
      const l = await layout();
      return l.rightButtons[0] === 'linux' && l.hidden.includes('screenshot');
    });
  });

  await step('Apply asks for confirmation; Cancel leaves config.ts untouched', async () => {
    await page.click('[data-apply]');
    await page.waitForSelector('[role="alertdialog"]');
    await shot(page, '8-apply-dialog');
    await clickText(page, '[role="alertdialog"] button', 'Cancel');
    await until('dialog closed', async () => !(await page.$('[role="alertdialog"]')));
    await sleep(500);
    assert.equal(configMtime(), mtimeBefore, 'config.ts not written');
  });

  await step('Revert restores the applied layout', async () => {
    await clickText(page, 'header button', 'Revert');
    await until('sandbox back to applied', async () => {
      const l = await layout();
      return l.rightButtons.join() === applied.rightButtons.join() && l.hidden.join() === applied.hidden.join();
    });
    await until('Matches badge', async () => (await page.$eval('[data-dirty]', el => el.getAttribute('data-dirty'))) === 'false');
    await shot(page, '9-reverted');
  });

  await step('Preview as Gwenview: its buttons are arrangeable now', async () => {
    await pickApp(page, 'gwenview');
    await page.waitForSelector(tile('gwenview.zoomOut'));
    await until('gwenview panel live', async () => !!visible(await get<Scene>('/api/scene'), 'gwenview.zoomIn'));
    await sleep(800);
    await drag(page, tile('gwenview.zoomOut'), tile('gwenview.zoomIn'));
    await until('gwenview view reordered', async () => (await layout()).left.gwenview?.view?.[0] === 'zoomOut');
    await until('scene reflowed', async () => {
      const sc = await get<Scene>('/api/scene');
      const a = visible(sc, 'gwenview.zoomOut'), b = visible(sc, 'gwenview.zoomIn');
      return !!(a && b && a.x < b.x);
    });
    await shot(page, '9a-gwenview');
  });

  await step('Preview as Konsole (not running): name tiles and a notice, still arrangeable', async () => {
    await pickApp(page, 'konsole');
    await page.waitForSelector(tile('konsole.newTab'));
    assert.equal((await page.$$('.edit-frame [data-tile]')).length, 7 + 4, 'right cluster + konsole buttons');
    await until('placeholder tiles', async () => (await page.$$('.edit-frame [data-tile^="konsole."] [data-placeholder]')).length === 4);
    await clickText(page, '[role="alert"]', "isn't running");
    await drag(page, tile('konsole.closeTab'), tile('konsole.newTab'));
    await until('konsole actions reordered', async () => (await layout()).left.konsole?.actions?.[0] === 'closeTab');
  });

  await step('File → Restore an earlier config lists backups (cancelled, nothing restored)', async () => {
    const mtime = configMtime();
    await menu(page, 'File', 'Restore an earlier config');
    await page.waitForSelector('[role="dialog"]');
    const backups = await get<unknown[]>('/api/backups');
    if (backups.length > 0) {
      await page.waitForSelector('[data-backup]');
      assert.equal((await page.$$('[data-backup]')).length, backups.length);
      await clickText(page, '[data-backup] button', 'Restore');
      await page.waitForSelector('[role="alertdialog"]');
      await shot(page, '9b-restore');
      await clickText(page, '[role="alertdialog"] button', 'Cancel');
      // Let the confirmation finish closing — while it animates out it would
      // take the Escape meant for the dialog underneath.
      await until('confirmation closed', async () => !(await page.$('[role="alertdialog"]')));
      await sleep(300);
    }
    await page.keyboard.press('Escape');
    await until('dialogs closed', async () => !(await page.$('[role="dialog"]')) && !(await page.$('[role="alertdialog"]')));
    assert.equal(configMtime(), mtime, 'config.ts not written');
    // Leave the sandbox as the physical bar is.
    await clickText(page, 'header button', 'Revert');
    await until('reverted', async () => (await page.$eval('[data-dirty]', el => el.getAttribute('data-dirty'))) === 'false');
  });

  // Opt-in: flips your *physical* bar for a few seconds (it restores itself).
  if (process.env.TBC_E2E_LIVE === '1') {
    await step('Live on Touch Bar: an edit shows on the physical bar; off restores it', async () => {
      const liveState = () => get<{ enabled: boolean; available: boolean }>('/api/live');
      assert.ok((await liveState()).available, 'the running bar offers live control');
      await page.click('#live-on-bar');
      await until('live on', async () => (await liveState()).enabled);
      await pickApp(page, 'vscode');
      await page.waitForSelector(tile('snake'));
      await sleep(800);
      await drag(page, tile('snake'), tile('back'));
      await until('sandbox reordered', async () => (await layout()).rightButtons[0] === 'snake');
      await page.waitForSelector('[data-physical-bar] img');
      await sleep(1500);
      const sock = '/run/user/' + process.getuid!() + '/react-drm-live.sock';
      const ask = (msg: unknown) => new Promise<{ layout: BarLayout; live: boolean }>((resolve, reject) => {
        const net = require('node:net') as typeof import('node:net');
        const c = net.connect(sock);
        let b = '';
        c.on('data', d => { b += d; const i = b.indexOf('\n'); if (i >= 0) { resolve(JSON.parse(b.slice(0, i))); c.end(); } });
        c.on('error', reject);
        c.on('connect', () => c.write(JSON.stringify(msg) + '\n'));
      });
      const onBar = await ask({ type: 'get' });
      assert.equal(onBar.live, true);
      assert.equal(onBar.layout.rightButtons[0], 'snake', 'the physical bar shows the edit');
      await shot(page, '9c-live');
      await page.click('#live-on-bar');
      await until('live off', async () => !(await liveState()).enabled);
      const after = await ask({ type: 'get' });
      assert.equal(after.live, false, 'the physical bar is back to its saved layout');
      await clickText(page, 'header button', 'Revert');
    });
  }

  await step('back in Use mode, Real focus clears the preview', async () => {
    await page.click('[aria-label="Use the bar"]');
    await page.click('[data-app-picker]');
    await clickText(page, '[role="option"]', 'Real focus');
    await until('override cleared', async () => (await get<{ override: unknown }>('/api/active-window')).override === null);
    assert.equal((await layout()).pinnedLeft, null);
  });

  await step('no page errors', async () => { assert.deepEqual(errors, []); });
} finally {
  await fetch(`${BASE}/api/presets?name=${encodeURIComponent(PRESET)}`, { method: 'DELETE' }).catch(() => {});
  await browser.close();
}

const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
for (const [n, , m] of failed) console.log(`✖ ${n}: ${m}`);
process.exit(failed.length ? 1 : 0);
