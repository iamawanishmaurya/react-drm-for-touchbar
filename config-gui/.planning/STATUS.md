# STATUS — config-gui UI Redesign (autonomous run, paused 2026-09-28 04:12)

**Project root:** `/home/Astra/opencode/touchbar/react-drm-fork/config-gui`
**Repo:** react-drm-fork, pushed through `e66bae4` (Phase 1) — Phase 2 code is in the working tree, **uncommitted**.

## GSD pipeline state

| Stage | Status |
|-------|--------|
| Project init (codebase map, PROJECT.md, research, REQUIREMENTS 16 reqs, ROADMAP 3 phases) | ✅ committed |
| Phase 1 — Modularize renderer | ✅ **DONE, verified, pushed** (commit `e66bae4`) |
| Phase 2 — Live real-render preview | 🟡 code written + builds + 23/23 tests, **one open bug** (below), uncommitted |
| Phase 3 — Drag-and-drop layout (BAR_LAYOUT) | ⬜ not started (CONTEXT planned but not written) |
| Milestone lifecycle (audit/complete/cleanup) | ⬜ not started |

## What works (verified by screenshot + tests)

- **Phase 1 complete:** renderer split into `state.ts` / `schema.ts` / `nav.ts` / `pages/{layout,dock,shortcuts,behavior,advanced}Page.ts` / `widgets/{fieldRow,keyCapture,appPicker}.ts`; 964-line monolith deleted; five-page UI (Layout placeholder, Dock, Shortcuts incl. SCREENSHOT, Behavior, Advanced hidden by default); renderer unit tests added. Screenshot confirmed.
- **Phase 2 code in tree:** `main/preview.ts` (spawn manager, free-port probe, before-quit kill), `renderer/preview/client.ts` (ws→canvas, reconnect), `renderer/preview/frame.ts` (BGRA decode, unit-tested), preview strip in index.html/CSS, `restartService` now tries `sudo -n systemctl restart react-drm` then falls back to `--user` (REL-02). Build: 0 TS errors. Tests: **23/23** (12 engine + 7 renderer/state+schema + 4 frame).

## OPEN BUG (Phase 2 verification blocker)

Fresh GUI launch shows **caption but no nav, no pages, no canvas** — `renderer/main.ts` dies before `buildPages()`, and **no console error appears** even with `ELECTRON_ENABLE_LOGGING=1` (log `/tmp/cg9.log` has zero CONSOLE lines).

Debugging done:
- Not stale-dist: launched after final successful build (cg9 at 04:10).
- Not module resolution: all value imports have `.js` extensions (the Phase 1 empty-window bug — tsc doesn't rewrite specifiers — was found and fixed).
- Suspects to check next (in order):
  1. `main.ts`'s `await window.configApi.previewState()` — maybe the IPC handle isn't registered when the renderer calls it (startPreview is async at boot; handler IS registered synchronously — verify with a `try/catch` + `console.error` around the preview block in `renderer/main.ts`, and check whether nav renders if the preview block is commented out).
  2. `main/main.ts` boot change: `app.whenReady().then(() => { createWindow(); void startPreview(); })` — if `startPreview()` throws synchronously (e.g. `defaultConfigPaths`/fs in `startChild`) it could reject unhandled but shouldn't kill the renderer.
  3. Duplicate IPC channel error: `preview:state` is registered as BOTH `ipcMain.handle('preview:state')` AND `win.webContents.send('preview:state', ...)` — that's handle+send on the same channel which is legal, but a second `handle('preview:state')` on re-launch would throw "second handler". Only one launch is live, so low suspicion.
  4. `types.ts` ConfigApi gained `onPreviewState` but `main/preload.ts` compiled copy may be stale in `dist/main/preload.js` — force a clean `npm run build` in the deployed tree and relaunch with `ELECTRON_ENABLE_LOGGING=1 nohup ./node_modules/.bin/electron ./config-gui >/tmp/cg10.log 2>&1 &`.

First debugging move when resuming: comment out the whole "Live preview (Phase 2)" block at the end of `renderer/main.ts` main(), rebuild, relaunch — if nav/pages reappear, the bug is in the preview block; bisect from there.

## Environment facts (hard-won, this session)

- Build/test ONLY in the deployed tree `/home/Astra/opencode/react-drm/config-gui` (deps hoisted). Copy fork→deployed: `rm -rf deployed/config-gui/{renderer,main} && cp -r fork/config-gui/{renderer,main} deployed/config-gui/`, then `npm run build && npm test` with nvm node on PATH.
- tsc emits per-module ES2022 with NO rewrite: every relative value import needs the `.js` extension (done via sed one-liner; see git history).
- `npx tsx` spawns a node grandchild — killing the npx wrapper orphans it. Preview kill must use a process group (`spawn detached:true` + `process.kill(-pid)`) — **not yet implemented** in `main/preview.ts` (uses SIGTERM to the wrapper only; one orphan was observed and killed manually: 94199/94226).
- pkill -f patterns that match the invoking shell's own command line will kill the shell mid-command (bit repeatedly).
- The react-drm preview instance serves ws frames with a 16-byte header + BGRA rows; port via `REACT_DRM_PREVIEW_PORT`, defaults 8787.
- `niri msg action screenshot-window` + focus-window by ID is how UI verification screenshots were taken; screenshots land in `~/Pictures/Screenshots/`.

## ⚠ Parallel sessions warning

At least TWO other agent sessions were active on this machine during the run: one editing `deploy.sh` + `config.blueprint.ts` (dock apps, restart timing — saw "Changes +1227") and one fixing Bluetooth audio (wireplumber configs, seen in a Grok CLI terminal). My Phase 2 changes are confined to `config-gui/` so no direct collision, but **before continuing: `git status`/`git log` the repo and diff `linux-touchbar-control-center/config.blueprint.ts` and `deploy.sh` against expectations** — the other session pushed/restarted things concurrently (react-drm restarted at 03:30 by them).

## Next steps (resume order)

1. Debug the open bug (first move above). Phase 2 must_haves: PREV-01/02/03 + REL-02 verification per `02-01-PLAN.md`.
2. Fix the preview orphan kill (process-group) in `main/preview.ts`.
3. Verify: strip shows live bar on every page; 3 open/close cycles leave no orphan; Restart flips `systemctl is-active react-drm` (ActiveEnterTimestamp).
4. Commit Phase 2, write `02-01-SUMMARY.md` + `02-VERIFICATION.md`.
5. Phase 3: smart-discuss grey areas (BAR_LAYOUT section shape, drag UX) → CONTEXT → UI-SPEC → PLAN → execute (BAR_LAYOUT end-to-end: blueprint + engine + `app/splitted/layout.tsx` reader + GUI dnd; dock drag-reorder) → verify on hardware.
6. Lifecycle: `/gsd-audit-milestone` → `/gsd-complete-milestone` → `/gsd-cleanup`.

**Resume command:** `/gsd-autonomous --from 2`
