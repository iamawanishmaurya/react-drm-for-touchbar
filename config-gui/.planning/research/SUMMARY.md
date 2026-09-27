# Project Research Summary

**Analysis Date:** 2026-09-28

## Key Findings

**Stack:** Keep Electron 43 + strict TS + vanilla DOM (no framework, no bundler — tsc emits per-module ES2022, imports need `.js` extensions). Keep the tested ts-morph engine untouched except an additive BAR_LAYOUT section. Preview = Electron main spawns the react-drm preview instance; renderer pumps its websocket BGRA frames onto a `<canvas>`. Drag-and-drop = native HTML5 DnD, no new dependencies.

**Table Stakes:** live real-render preview embedded in the GUI; drag-reorder of dock apps; drag-reorder of main-bar buttons via a new BAR_LAYOUT config section (blueprint + engine + app-side reader with fallback); reorganized pages (Layout / Dock / Shortcuts / Behavior / hidden Advanced); working Restart on this root-unit deployment.

**Watch Out For:** format-destroying config writes (must stay patch-based); preview process/env lifecycle (leaks, D-Bus env, port collisions, boot-splash states); unbundled-module build footguns (`.js` imports, asset copy list); fork-vs-deployed tree sync (config-gui is not in deploy.sh); HTML5 DnD correctness (preventDefault on dragover, keyboard fallback).

## Implications for Roadmap

- **Phase 1 — Modularize without behavior change:** split renderer.ts into modules + schema-driven pages, keep all current features working; extract testable pure modules and add node:test coverage. De-risks everything else.
- **Phase 2 — Live preview:** main-process preview manager + ws→canvas client + status/reconnect UI; fix restartService unit mismatch here (touches the same lifecycle code).
- **Phase 3 — Drag-and-drop layout:** BAR_LAYOUT end-to-end (blueprint → engine → app reader → GUI dnd page) + dock app drag-reorder; deploy via deploy.sh + config-gui build in deployed tree; verify on the real bar.

Each phase ends with a working app (`npm run dev` in the deployed tree) and passing tests.

## Sources

- Codebase map: `config-gui/.planning/codebase/*.md` (STACK/INTEGRATIONS/ARCHITECTURE/STRUCTURE/CONVENTIONS/TESTING/CONCERNS)
- Repo code: `config-gui/main/configEngine.ts`, `config-gui/renderer/renderer.ts`, `src/dev/preview-server.ts`, `linux-touchbar-control-center/app/splitted/layout.tsx`, `linux-touchbar-control-center/config.blueprint.ts`
- Proven tooling: `packaging/preview-capture.mjs` (ws frame parsing + synthetic taps), `react-drm.service` (preview env vars)

---

*2026-09-28 analysis: initial research*
