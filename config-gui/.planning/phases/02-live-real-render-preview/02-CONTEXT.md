# Phase 2: Live real-render preview - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Embed the actual Touch Bar render (a react-drm preview instance → websocket → canvas) in the config-gui window, auto-started with the app and cleaned up on exit, refreshing after Save + Restart. Also fix the Restart button to work on this deployment (root system unit).

</domain>

<decisions>
## Implementation Decisions

### Preview pane (user-accepted recommendations)

- **D-01:** Preview lives as a **top strip on every page** (split view), not a separate page.
- **D-02:** The preview shows the **last-saved config's real render** — no unsaved-edit previewing; a caption states "Shows the saved config — Save + Restart to apply".
- **D-03:** Fixed strip scaled to window width at the true 2008:60 aspect ratio (like the existing dock preview, full width).
- **D-04:** Lifecycle: preview instance auto-starts when the GUI opens, is killed when it closes (no orphans), and the canvas reconnects after the bar restarts.

### Restart fix

- **D-05:** `restartService` tries `sudo systemctl restart react-drm` (root unit; passwordless sudo on this machine) first, falls back to `systemctl --user restart react-drm.service` for upstream deployments.
- **D-06:** Feedback stays in the status text, as today.

### Claude's Discretion

- ws frame pump implementation, port selection, spawn env details (per research/STACK + proven `packaging/preview-capture.mjs`), reconnect/backoff tuning, canvas placement in index.html/CSS.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/REQUIREMENTS.md` — PREV-01..03, REL-02
- `.planning/research/STACK.md` — frame format (16-byte header + BGRA rows), spawn env, port selection
- `.planning/research/PITFALLS.md` — pitfalls 5–8 (preview lifecycle, env, frame parsing, restart flicker)
- `.planning/research/ARCHITECTURE.md` — main/preview.ts + renderer/preview/client.ts design
- `packaging/preview-capture.mjs` (repo root `packaging/`) — proven ws frame parsing code to port
- `src/dev/preview-server.ts` — ws protocol (binary frames + JSON touch messages)
- `renderer/state.ts`, `renderer/main.ts` — where the preview hooks into the new module structure
- `main/configEngine.ts:402-409` — restartService to fix

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packaging/preview-capture.mjs` — working ws connect + frame parsing (16-byte header, BGRA→RGB).
- `renderer/pages/dockPage.ts` renderDockPreview — pattern for a scaled strip + caption.
- Phase 1 module structure: preview pane slots in as a component above `#content`.

### Established Patterns
- Main process owns all side effects (IPC handlers in main.ts, result-object returns).
- Preview instance env: nvm node path, DBUS_SESSION_BUS_ADDRESS, XDG_RUNTIME_DIR, cwd = deployed linux-touchbar-control-center.

### Integration Points
- `renderer/main.ts` boot: init preview after config loads.
- `renderer/index.html`: add a preview container above `#content`.
- `main/main.ts`: new IPC (`preview:status` events via webContents.send or polling) + spawn manager.

</code_context>

<specifics>
## Specific Ideas

User cares that the preview is the REAL bar render, not a mockup ("Real bar render" chosen at project init).

</specifics>

<deferred>
## Deferred Ideas

- Preview status chip with manual restart (v2 in REQUIREMENTS.md)
- Click-to-test in the preview (synthetic taps) — v2

</deferred>

---

*Phase: 2-Live real-render preview*
*Context gathered: 2026-09-28*
