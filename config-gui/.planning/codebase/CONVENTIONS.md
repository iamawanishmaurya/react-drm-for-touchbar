---
last_mapped_commit: f7097b344f7c49ea5bdd7e268a5083b8bef708a5
last_mapped_at: 2026-09-28
---
# Code Conventions

**Analysis Date:** 2026-09-28

## Style

- TypeScript strict mode, no `any` in the codebase (one targeted eslint-disable for a progressive-narrowing walk in `renderer/renderer.ts:88-91`).
- Comments explain *why* (deployment quirks, spec details, race/ratchet rationale), often multi-line and frequently referencing cross-file mechanics — e.g. `main/configEngine.ts:145-147` explains why `iconGlyph` is surfaced separately; `renderer/renderer.ts:122-128` explains the theme-override dance before `resolveIcon`.
- Section headers as ASCII banner comments: `// ── DOCK ────────` (`renderer.ts:482`, `:700`, `:813`, `:927`).

## Patterns

- **Plain-JSON state, immutable-ish edits:** the renderer keeps one `state` object; every mutation goes through `setPath([...], value)` + `markDirty()`. Lists re-render wholesale (`list.innerHTML = ''` then rebuild) after structural changes — a deliberate, simple "re-render on structural change, mutate inputs in place otherwise" split.
- **Format-preserving writes:** the engine never re-serializes whole sections; it patches initializers in place and skips values that `deepEqual` their current AST (`configEngine.ts:219`), preserving user comments/quotes/formatting. Casts (`as` expressions) are detected and re-emitted (`:224-226`).
- **Lossy-read safety:** unsupported AST (JSX, templates, spreads) → `undefined` → omitted from UI *and* write path. One unsupported element taints the whole array (`configEngine.ts:75-77`).
- **Renderer-main trust split:** main process owns all fs/process/shell access; renderer only sees plain JSON over `contextBridge` (`main/preload.ts`). `contextIsolation: true`, `nodeIntegration: false`.
- **Escaping discipline:** the one place errors are interpolated into HTML uses a textContent-based `escapeHtml` (`renderer.ts:243-247`); everywhere else uses `textContent`/`createElement` rather than `innerHTML` with data.

## Error Handling

- IPC handlers return `{ ok, error? }` / `{ data?, error? }` result objects instead of throwing across the bridge (`main/main.ts:58-76`).
- Best-effort side work never fails the primary op: `syncCompiledConfig` failure is logged, not surfaced as a save failure (`configEngine.ts:368-373`); `restartService` resolves `{ ok:false, message }`.
- Parser-level: malformed `.desktop` files return `null` and are skipped (`desktopApps.ts:49-91`).

## UI Construction

- No framework: `document.createElement` + class names + `addEventListener`; overlays are hand-rolled divs (app picker, `renderer.ts:415-480`).
- Async data (installed apps, icon themes) is cached in module-level variables (`desktopAppsCache`, `iconThemesCache`) and populated lazily.

## Testing Conventions

- `node:test` via `tsx --test main/*.test.ts`; unit tests target the pure engine (`configEngine.test.ts` — 12 tests, all passing in the deployed tree).
- Main-process side effects (`exec`, fs) are not abstracted behind interfaces; tests exercise real files in temp dirs where needed.

---

*2026-09-28 analysis: initial codebase map*
