---
last_mapped_commit: f7097b344f7c49ea5bdd7e268a5083b8bef708a5
last_mapped_at: 2026-09-28
---
# Technology Stack

**Analysis Date:** 2026-09-28

## Runtime & Languages

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) throughout — no JavaScript sources |
| Desktop shell | Electron `^43.4.0` (Chromium renderer + Node main process) |
| Main process | Node.js via Electron (`main/main.ts`) |
| Renderer | Vanilla DOM APIs — **no framework** (no React/Vue/svelte), no bundler |
| Module system | CommonJS for main (`dist/main`), ES2022 + Bundler resolution for renderer (`dist/renderer`) |

## Build

- `config-gui/package.json` scripts:
  - `build` — `rm -rf dist && tsc -p tsconfig.json && tsc -p tsconfig.renderer.json && mkdir -p dist/renderer && cp renderer/index.html renderer/renderer.css dist/renderer/` (two separate tsc projects, then copies static assets; **no bundler** — renderer.js is compiled straight from `renderer/renderer.ts` and loaded as an ES module).
  - `dev` / `start` — build then `electron .` (entry `dist/main/main.js`).
  - `test` — `tsx --test main/*.test.ts` (node:test runner via tsx).
- `tsconfig.json` (main): CommonJS, outDir `dist/main`, rootDir `main`, strict.
- `tsconfig.renderer.json`: ES2022, `Bundler` moduleResolution, outDir `dist/renderer`, rootDir `renderer`, DOM libs, strict.

## Dependencies

**Production** (`config-gui/package.json`):
- `react-drm` — `file:..` (the parent Touch Bar repo). Used by the main process only: `appIconSource`, `setIconTheme`, `KEY` constants (`main/main.ts:9`). Renderer never imports it.
- `ts-morph` `^28.0.0` — AST reading/writing of `config.ts` (`main/configEngine.ts:4`).
- `typescript` `^5.8.3` — single-file `ts.transpileModule` to refresh `dist/config.js` after saves (`main/configEngine.ts:383-400`).

**Dev:** `@types/node`, `electron`.

**Important deployment quirk:** the fork checkout (`react-drm-fork/config-gui`) has **no `node_modules`** — dependencies are installed only in the deployed tree (`/home/Astra/opencode/react-drm/`, root-hoisted). `npm test` / `npm run build` therefore only work in the deployed copy.

## Configuration Files

- `config-gui/tsconfig.json`, `tsconfig.renderer.json` — per-process compile configs (see above).
- No lint/format config, no CI config inside config-gui.

## Window & Security Setup

- Frameless window (`frame: false`), custom window controls in the renderer (`renderer/index.html:23-37`), half-the-workArea sizing for tiling WMs (`main/main.ts:24-44`).
- `contextIsolation: true`, `nodeIntegration: false`, preload bridge via `contextBridge` (`main/main.ts:39-43`, `main/preload.ts`). Renderer talks to main exclusively over IPC channels listed in `main/preload.ts`.

## IPC Contract (renderer ↔ main)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `config:read` / `config:write` | invoke | Load full config snapshot / persist changes |
| `config:restart` | invoke | `systemctl --user restart react-drm.service` |
| `config:locate` | invoke | Directory picker to find `linux-touchbar-control-center/` |
| `config:meta` | invoke | Icon choices, DOM-code→key-name map, `KEY` codes |
| `icon:resolve` / `icon:setTheme` / `icon:themes` | invoke | Icon file URLs + icon-theme handling |
| `apps:list` | invoke | Installed .desktop apps for the picker |
| `window:minimize` / `window:toggleMaximize` / `window:close` | send | Frameless window controls |

---

*2026-09-28 analysis: initial codebase map*
