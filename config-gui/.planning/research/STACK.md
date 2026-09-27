# Stack Research — config-gui Redesign

**Analysis Date:** 2026-09-28

## Current Stack (kept)

- Electron 43, TypeScript strict, vanilla DOM renderer, no bundler (see `codebase/STACK.md`).
- Backend engine `main/configEngine.ts` (ts-morph, format-preserving) — **unchanged**, plus one new section type.

## Decisions for the Redesign

### Renderer structure — ES modules, no bundler
The renderer compiles via `tsc -p tsconfig.renderer.json` with `module: ES2022` / `moduleResolution: Bundler`. tsc does **not** bundle — one output file per input module. `index.html` loads a single `<script type="module" src="renderer.js">`; the browser resolves relative imports (`./state.js`, `./preview/preview.js`) at runtime because every module is copied to `dist/renderer/`. Consequence: the build script's `cp` line must copy **all** renderer assets, and import paths in TS must use explicit `.js` extensions (`import { state } from './state.js'`) — standard for unbundled tsc ES2022 output. Verified pattern: tsc emits `renderer/state.ts → dist/renderer/state.js`; `renderer.js` importing `./state.js` resolves correctly in Chromium.

### Drag-and-drop — native HTML5 DnD, no library
- HTML5 `dragstart/dragover/drop` with `dataTransfer.setData('text/plain', id)` is sufficient for reorder lists and preview-position drops; no SortableJS dependency needed (keeps the zero-bundler, no-new-deps posture).
- Touch Bar mock targets are small — provide a drop indicator (CSS `::before`/outline) so placement is unambiguous.
- Keyboard-accessible fallback (up/down buttons on each item) because HTML5 DnD is pointer-only.

### Real-render preview — websocket + `<canvas>`, not iframe
The react-drm preview instance (`REACT_DRM_BACKEND=preview`, `src/dev/preview-server.ts`) serves:
- `GET /` — a standalone preview page (fine for a browser, wrong for embedding: it's a full page with its own state).
- `WS /ws` — binary BGRA frames (16-byte header + raw rows) and JSON control messages (`{type:'touchstart',x,y}`).
Best embed: config-gui's main process **spawns** the preview instance (`spawn('npx', ['tsx','index.tsx'], {cwd: deployed dir, env: {REACT_DRM_BACKEND:'preview', ...}})`), and the renderer connects directly to `ws://127.0.0.1:<port>/ws`, draws frames onto a `<canvas>` (BGRA→RGBA flip in JS — ~2008×60×4 bytes per frame is trivial), scaled with CSS. This is exactly what `packaging/preview-capture.mjs` does in Node; port it to the renderer.
- Frame format caveat: header is 16 bytes; row stride = width×4; bytes are B,G,R,A. Width from `DISPLAY` config / preview instance log (2008 on this machine).

### Bar layout config — new section, mirrored in three places
`BAR_LAYOUT` (name TBD in requirements) must be added to:
1. `linux-touchbar-control-center/config.blueprint.ts` (default value)
2. `configEngine.ts` `SECTION_NAMES` (+ renderer labels)
3. The app side: `app/splitted/layout.tsx` builds `BASE_BTNS` — replace with a config-driven list from `configLoader.ts` with a fallback to today's order when the section is absent.

### Testing — node:test only
No new test framework. New pure logic (dnd order model, BGRA→canvas conversion, layout-order serialization) goes into small modules runnable under `tsx --test`. Renderer DOM code stays manual-test.

## Pitfalls

- tsc without bundler silently breaks on bare-specifier imports in renderer code — always `.js` relative imports.
- Spawning the preview instance needs the deployed tree's env (node path from nvm, `DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR` as in `react-drm.service`).
- Two preview instances can't bind the same port — pick a free port, kill on app exit (`child.on('exit')` + `app.on('before-quit')`).

---

*2026-09-28 analysis: initial research*
