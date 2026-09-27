---
last_mapped_commit: f7097b344f7c49ea5bdd7e268a5083b8bef708a5
last_mapped_at: 2026-09-28
---
# Testing Overview

**Analysis Date:** 2026-09-28

## Framework & Runner

- **Runner:** `tsx --test main/*.test.ts` (package.json `test` script) — Node's built-in `node:test` runner executed through tsx, no separate test framework, no coverage tooling.
- Run from `config-gui/`: `npm test`.
- **Environment quirk:** tests (and builds) only run where dependencies are installed — the deployed tree (`/home/Astra/opencode/react-drm/config-gui`, deps hoisted at the repo root), not the fork checkout, which has no `node_modules`. Verified 2026-09-28: **12/12 pass, 0 fail** in the deployed tree.

## What Is Covered

`main/configEngine.test.ts` (~188 lines) unit-tests the config engine against fixture config files:

- **Reading:** section extraction from `config.blueprint.ts`-style source; `nodeToValue` round-trips (literals, `KEY.X` identifiers, `Infinity`, nested objects/arrays); unsupported elements tainting arrays; blueprint-default merging via `withDefaults`.
- **Writing / idempotency:** `mergeObjectProperties` preserving untouched properties, quote style, comments, and `as` type casts; `deepEqual` skipping no-op writes; `valueToLiteralText` output shape (including `KEY.NAME` re-emission for key codes).
- **DOCK handling:** `mergeDockApps` id-matched patching, reordering, appending new entries, dropping removed ones, `icon:` glyph preservation, `react-icons/fa6` import synthesis.

## What Is Not Covered (gaps)

- **Renderer: zero tests.** All UI logic (`renderer/renderer.ts`, ~964 lines) — section rendering, key-capture widget, app-picker overlay, dock preview math — is untested. This is the largest risk area, and precisely where the planned redesign lands.
- **`main/main.ts` untested:** IPC handler wiring, path resolution (`findRepoDir`), window creation.
- **`main/desktopApps.ts` untested:** the freedesktop `Exec=` tokenizer (`splitExec`) is pure and highly testable but has no tests.
- **No integration test for the full read→write→transpile cycle** (`syncCompiledConfig`) on a real config.ts.
- No CI configuration anywhere in the repo.

## Testing Strategy Notes for the Redesign

- The engine (`configEngine.ts`) is the safe, tested core — a new UI should keep it as the unchanged backend and add tests for any new engine capabilities (e.g. section reordering, if the drag-and-drop UI starts writing order into config).
- Renderer logic worth extracting for testability: preview layout math (dimension percentages), state-path get/set (`setPath`), and any new drag-and-drop ordering model — pure functions that can run under `node:test` without Electron.

---

*2026-09-28 analysis: initial codebase map*
