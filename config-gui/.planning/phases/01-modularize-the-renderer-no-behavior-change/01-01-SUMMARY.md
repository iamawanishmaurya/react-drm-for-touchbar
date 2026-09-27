---
phase: 01-modularize-the-renderer-no-behavior-change
plan: 01
completed: 2026-09-28
---

# Plan 01-01 Summary — Modularize the renderer

## What Was Built

- **renderer/state.ts** — central store (`store`, `setPath`, `markDirty` + subscriber model replacing the `dockPreviewEl` singleton, meta caches, `uniqueAppId`, `humanize`).
- **renderer/schema.ts** — single source of truth: `SECTION_NAMES`, `PAGES` (Layout/Dock/Shortcuts/Behavior/Advanced per CONTEXT D-01: SCREENSHOT→Shortcuts; DOLPHIN/KONSOLE/CAVA→Advanced), labels, descriptions, union fields, action lists.
- **renderer/nav.ts** — five-page sidebar, Advanced collapsed by default (localStorage-persisted), search across all pages that reveals Advanced on match (D-03).
- **renderer/pages/** — `page.ts` (shared header), `layoutPage.ts` (placeholder per D-02), `dockPage.ts` (preview strip + icon theme + app cards), `shortcutsPage.ts` (keymaps + overrides), `behaviorPage.ts`, `advancedPage.ts`.
- **renderer/widgets/** — `fieldRow.ts` (generic object form + smallTextInput), `keyCapture.ts`, `appPicker.ts`.
- **renderer/main.ts** — new entry (`index.html` now loads `main.js`); old `renderer/renderer.ts` **deleted**.
- **Tests** — `renderer/state.test.ts` + `renderer/schema.test.ts` (setPath, uniqueAppId, humanize, schema completeness incl. D-01 assertions); npm test now runs both suites.

## Key Decisions During Execution

- Import specifiers need explicit `.js` extensions (unbundled ES modules — tsc does not rewrite them; the first build rendered an empty window because of this).
- `setPath` intentionally does NOT create intermediate objects (preserved original behavior); test asserts existing-path writes.
- Tests run in Node because state.ts/schema.ts are DOM-free at import time.

## Verification

- `npm run build` — 0 TS errors (deployed tree).
- `npm test` — 19/19 pass (12 engine + 7 renderer).
- Electron smoke run: window "Touch Bar Config" renders with the new page nav; Layout placeholder shows.
- Engine untouched → format-preserving writes unchanged (configEngine.test.ts 12/12).

## must_haves Status

| Truth | Status |
|-------|--------|
| All 17 sections editable | ✅ (pages built at boot; schema test asserts complete mapping) |
| Five pages per D-01 | ✅ (verified in running app) |
| Advanced hidden by default, search reveals | ✅ implemented (localStorage + search reveal) |
| Save/Restart + dirty indicator unchanged | ✅ (same flow, main.ts wiring) |
| Engine tests pass | ✅ 12/12 |
| App builds + launches | ✅ (electron smoke run) |
| Layout placeholder | ✅ (verified in screenshot) |
