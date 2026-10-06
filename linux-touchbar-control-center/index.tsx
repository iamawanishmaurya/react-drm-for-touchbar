import fs from 'fs';
import path from 'path';
import { KeyboardReader, PreviewDisplay, createDisplay, renderHot, resolveKeyCode, startPreviewServer, TB_BACKLIGHT_NAMES, DISPLAY_BACKLIGHT_NAMES, TOUCHBAR_DRM_DRIVERS, TOUCHBAR_USB_VENDOR_ID, TOUCHBAR_USB_PRODUCT_ID, TOUCHBAR_USB_BRIDGE } from 'react-drm';
import { DISPLAY, SCREENSHOT, SLEEP, ESC_KEY } from './lib/utils/configLoader';
import { attachTouchBar, ensureTouchBarAttached, watchSleep } from '@/lib/services/suspend';
import { createLogger } from 'react-drm';
import { startCustomLayer } from '@/lib/customLayer';
import { getLayout, setLayout } from '@/lib/utils/layoutStore';
import { parseLayoutPatch } from '@/lib/utils/layoutModel';
import { RIGHT_BUILT_IN, LEFT_BUILT_IN, LEFT_PANELS } from '@/lib/utils/layoutSchema';
import { APP_PREVIEWS, leftPanelForClass } from '@/lib/utils/leftPanelRouting';
import { setActiveWindowOverride, getActiveWindowState } from '@/lib/activeWindow/store';
import { getActionsState, setRealActions } from '@/lib/services/sandboxActions';
import { BAR_SCREENS, isBarScreen } from '@/lib/utils/screens';
import { startLiveLayout } from '@/lib/services/liveLayout';
import { go, routerAt } from '@/lib/routes/router-registry';

const log = createLogger('react-drm');

// Show what the resolved .env hardware profile produced. Import-block order
// matters: react-drm loads the repo .env first (src/native/env.ts), so these
// values are the seeded ones, not just the compiled defaults.
log.info('hardware profile:',
  JSON.stringify({
    TB_BACKLIGHT_NAMES,
    DISPLAY_BACKLIGHT_NAMES,
    TOUCHBAR_DRM_DRIVERS,
    USB: `${TOUCHBAR_USB_VENDOR_ID}:${TOUCHBAR_USB_PRODUCT_ID}`,
    TOUCHBAR_USB_BRIDGE,
    BOOT_LOGO: process.env.REACT_DRM_BOOT_LOGO || '(unset)',
  }, null, 2));

// The app owns the Touch Bar lifecycle in every run mode — manual `npm run
// dev` and react-drm.service alike: attach at startup, quiesce before system
// sleep, re-attach + resume after. SLEEP.enabled in config.ts turns it off.
// None of this applies to the browser preview backend — there's no physical
// Touch Bar to attach/detach, and waiting on one would just stall startup.
const isPreview = process.env.REACT_DRM_BACKEND === 'preview';
// A sandbox is a preview instance an editor (touchbar-control) drives: its
// layout can be replaced live over POST /layout, and nothing may move or fade
// the picture — the editor crops widgets out of the streamed frame at their
// scene coordinates, so pixel shift and dim/off would misalign or blank them.
const isSandbox = isPreview && process.env.REACT_DRM_SANDBOX === '1';

async function main() {
  if (SLEEP.enabled && !isPreview) {
    await ensureTouchBarAttached().catch(e => {
      log.warn('Touch Bar attach failed:', e instanceof Error ? e.message : e);
    });
  }

  const keyboard = new KeyboardReader();
  const display  = createDisplay(process.argv[2]);

  // Custom Layer prototype: owns its own widget list + config-gui bridge,
  // entirely separate from config.ts/config.blueprint.ts. Started
  // unconditionally (not preview-only) since config-gui needs a live target
  // to drag onto in normal operation, not just during dev preview.
  // Layer width accounts for the EscKey on wide Touch Bars (same logic as
  // app/layout.tsx's root layout).
  const showEsc = display.width >= ESC_KEY.minWidth && ESC_KEY.onLayers === 'all';
  const layerWidth = showEsc ? display.width - ESC_KEY.width - ESC_KEY.gap : display.width;
  const customLayer = startCustomLayer(layerWidth, display.height);
  // The physical bar accepts live layout edits from touchbar-control ("Live on
  // Touch Bar"); previews don't — the sandbox has its own /layout route.
  // `result` is created below; wake only runs on a later live edit.
  const liveLayout = isPreview ? null : startLiveLayout({
    snapshot: file => display.screenshot(file),
    wake: () => result.wake(),
  });

  // Save what the touchbar currently shows as a PNG when all combo keys are
  // held. Fires once per press — re-arms only after a combo key is released.
  const screenshotCodes = SCREENSHOT.keys.map(resolveKeyCode);
  const heldCodes = new Set<number>();
  let screenshotArmed = true;
  keyboard.onKey((code, value) => {
    if (!screenshotCodes.includes(code)) return;
    if (value === 0) { heldCodes.delete(code); screenshotArmed = true; return; }
    heldCodes.add(code);
    if (!screenshotArmed || !screenshotCodes.every(c => heldCodes.has(c))) return;
    screenshotArmed = false;
    try {
      fs.mkdirSync(SCREENSHOT.dir, { recursive: true });
      const file = path.join(SCREENSHOT.dir, `touchbar-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
      display.screenshot(file);
      log.info(`screenshot saved: ${file}`);
    } catch (e) {
      log.error('screenshot failed:', e instanceof Error ? e.message : e);
    }
  });

  const result = renderHot(path.resolve(__dirname, 'App'), display, {
    dimSecs:          isSandbox ? 0 : DISPLAY.dimSecs,
    offSecs:          isSandbox ? 0 : DISPLAY.offSecs,
    pixelShiftSecs:   isSandbox ? 0 : DISPLAY.pixelShiftSecs,
    keyboardReader:   keyboard,
    appProps:         { keyboard },
    activeBrightness: DISPLAY.activeBrightness,
    flushFps:         DISPLAY.flushFps,
    partialFlush:     DISPLAY.partialFlush,
    touchEnabled:     !isPreview,
    //  adaptiveBrightness: true
  });

  if (SLEEP.enabled && !isPreview) {
    watchSleep({
      onSleep: () => result.suspend(),
      onResume: async () => {
        await attachTouchBar();
        // KeyboardReader already auto-reconnects on device loss. Forcing a
        // fresh udev enumeration here races the BCE/T2 resume path and can
        // abort inside libudev before the input tree is stable again.
        result.resume();
      },
    }).catch(e => {
      log.warn('sleep watcher unavailable:', e instanceof Error ? e.message : e);
    });
  }

  if (isPreview) {
    // toSvg exposes the live scene as markup at GET /svg — same post-Yoga
    // layout the Cairo frames come from, with each `id`-tagged widget emitted
    // as <g data-id="…">. That's what the designer edits against.
    // Read-only scene endpoints are on for every preview; layout writes only in
    // a sandbox, so a plain preview can't be rearranged from outside.
    startPreviewServer(display as PreviewDisplay, result, {
      routes: {
        '/scene': { get: () => ({ width: display.width, height: display.height, boxes: result.sceneBoxes() }) },
        '/layout-schema': { get: () => ({
          right: RIGHT_BUILT_IN, left: LEFT_BUILT_IN, panels: LEFT_PANELS,
          apps: APP_PREVIEWS.map(a => ({ ...a, panel: leftPanelForClass(a.class) })),
        }) },
        '/layout': isSandbox
          ? { get: getLayout, post: body => setLayout(parseLayoutPatch(body)) }
          : { get: getLayout },
        // Sandbox only: pretend a window is focused ("Preview as app"), and
        // choose whether bar actions really run (keys, focus, launches).
        ...(isSandbox ? {
          '/active-window': {
            get: getActiveWindowState,
            post: (body: unknown) => {
              const b = body as { class?: unknown; title?: unknown } | null;
              if (b === null) { setActiveWindowOverride(null); return getActiveWindowState(); }
              if (typeof b?.class !== 'string' || b.class.length > 128) throw new Error('class must be a string');
              const title = typeof b.title === 'string' ? b.title.slice(0, 256) : '';
              setActiveWindowOverride({ class: b.class, title, pid: 0 });
              return getActiveWindowState();
            },
          },
          // Screen navigator: which top-level screen is showing; jump to one.
          '/screen': {
            get: () => ({ current: routerAt('')?.current ?? null, screens: BAR_SCREENS }),
            post: (body: unknown) => {
              const to = (body as { to?: unknown } | null)?.to;
              if (!isBarScreen(to)) throw new Error('unknown screen');
              go(to, 'fade');
              return { current: to, screens: BAR_SCREENS };
            },
          },
          '/actions': {
            get: getActionsState,
            post: (body: unknown) => {
              const real = (body as { real?: unknown } | null)?.real;
              if (typeof real !== 'boolean') throw new Error('real must be true or false');
              setRealActions(real);
              return getActionsState();
            },
          },
        } : {}),
      },
      // Sandbox pages crop widgets out of frames; send each frame's own boxes
      // with it so the crops never read one layout's pixels at another's
      // positions (the cluster animates its width after every reorder).
      frameScene: isSandbox
        ? () => ({ width: display.width, height: display.height, boxes: result.sceneBoxes() })
        : undefined,
    }, () => result.toSvg());
  }

  function shutdown() {
    try { customLayer.stop(); } catch {}
    try { liveLayout?.stop(); } catch {}
    try { result.unmount(); } catch {}
    process.kill(process.pid, 'SIGKILL');
  }

  process.on('SIGINT', shutdown);

  // When a game component sets stdin to raw mode, Ctrl+C is delivered as 0x03
  // instead of SIGINT. This handler catches it from any layer.
  if (process.stdin.isTTY) {
    process.stdin.on('data', (chunk: Buffer) => { if (chunk[0] === 3) shutdown(); });
  }
}

main().catch(e => {
  log.error('startup failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
