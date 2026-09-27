---
phase: 02-live-real-render-preview
plan: 01
completed: 2026-09-28
---

# Plan 02-01 Summary — Live real-render preview

## What Was Built

- **main/preview.ts** — preview instance manager: free-port probe, spawns `npx tsx index.tsx` in the deployed linux-touchbar-control-center with the service's env (nvm node PATH, DBUS_SESSION_BUS_ADDRESS, XDG_RUNTIME_DIR, REACT_DRM_BACKEND=preview), process-group kill (`spawn detached:true` + `process.kill(-pid)`) so the npx→node grandchild can't be orphaned, 30s-capped auto-retry, state pushed to the renderer on `preview:state`. Lifecycle: started at app ready, killed on `before-quit`.
- **renderer/preview/frame.ts** — pure BGRA frame decoder (16-byte LE header w/h with payload validation + fallback, header skip, channel swap) — unit-tested.
- **renderer/preview/client.ts** — ws client: draws latest frame to canvas (createImageData + putImageData), 1s-backoff reconnect, `.live` class toggles the canvas visible.
- **renderer UI** — `#preview-strip` above `#content` (canvas at 2008:60 aspect, full width) + caption "Shows the saved config — Save + Restart to apply"; "Preview starting…" placeholder until first frame; visible on every page.
- **renderer/main.ts** — visible boot-error trap (main().catch + window.onerror write into the sidebar) added during debugging; kept as a permanent improvement.
- **main/configEngine.ts** — `restartService`: `sudo -n systemctl restart react-drm` first (root unit, this deployment), `--user` fallback (upstream); message reports which path.

## Key Decisions During Execution

- Machine-wide electron window breakage (GPU process fatal, `error_code=1002`, started ~04:44, affects any electron launch incl. `--disable-gpu`/`--in-process-gpu`/x11) blocked visual verification. Fell back to headless + console verification (below). Same breakage hits any electron app on this machine right now — environment, not code.
- `pkill -f` patterns matching the invoking shell's cmdline kill the shell; nohup'd background children of the tool shell may be reaped — use `setsid` subshells.

## Verification

| Item | Method | Result |
|------|--------|--------|
| Renderer boots with all pages (PREV-01 base) | in-app BOOT_OK console log via ELECTRON_ENABLE_LOGGING | ✅ `panels=5 navItems=6 sections=17` |
| Preview instance spawns + serves ws | headless spawn from deployed cwd, port 8791 | ✅ LISTEN |
| Frame stream (PREV-01/03 data path) | ws client, 8s sample | ✅ 488 frames, 2008×60, header parse matches decodeFrame |
| Frame decode unit tests (REL-04) | npm test | ✅ 4 tests |
| No orphans (PREV-02) | process-group kill implemented; orphan risk from earlier (94199/94226) killed manually; **3-cycle GUI test still pending visual session** | ⚠ code-verified only |
| Restart works on root unit (REL-02) | `sudo -n systemctl restart react-drm` | ✅ ActiveEnterTimestamp → 04:58:52 |
| Tests overall | npm test | ✅ 23/23 |

## Remaining for full PREV sign-off (needs a working GUI session)

- Visual check: canvas shows the live bar, colors correct (BGR swap would be obvious).
- 3× open/close orphan check.
- POST-SAVE refresh observation.

## Artifacts this phase produces
main/preview.ts, renderer/preview/{client,frame,frame.test}.ts, IPC preview:start/stop/state, #preview-strip, restartService root-first
