---
last_mapped_commit: f7097b344f7c49ea5bdd7e268a5083b8bef708a5
last_mapped_at: 2026-09-28
---
# Concerns & Tech Debt

**Analysis Date:** 2026-09-28

Severity: 🔴 high · 🟡 medium · 🟢 low

## UX (the user's stated complaint — "bad UI, no preview, no drag-and-drop")

- 🔴 **No bar-level preview.** The only preview is the Dock icon strip (`renderer/renderer.ts:129-198`). Nothing shows how the Touch Bar as a whole looks — sections, ordering, panels — and nothing previews live while editing non-Dock settings. The user explicitly wants a live "how will it look" preview.
- 🔴 **No drag-and-drop anywhere.** Reordering is only possible for DOCK.apps via add/remove in list order (`renderer/renderer.ts:516-543`); there's no way to drag to reorder dock apps, and the concept doesn't exist for other bar items. The user explicitly wants drag-to-reorder.
- 🟡 **Form-driven, not object-driven.** The UI exposes config *sections* (DISPLAY, SLEEP, CAVA…) as nested generic forms (`renderGenericObject`, `renderer.ts:341-408`). The user must understand config internals ("SYSTEMBAR.refreshMs") rather than manipulate things they see on the bar. This is the root cause of the "bad UI" feeling.
- 🟡 **Monolithic renderer.** ~964 lines in one file mixing state, section renderers, widgets, preview, and IPC glue; ~483 lines of one CSS file with a flat global namespace. Any redesign should introduce structure (components/modules) here.
- 🟢 **Manual save/restart loop.** Save → click "Restart touch bar service" → wait 5s. Live-apply or auto-restart would tighten feedback; the compiled-config sync (`syncCompiledConfig`) already makes restarts cheap.

## Correctness / Deployment

- 🟡 **`restartService` targets the wrong unit here.** `configEngine.ts:404` runs `systemctl --user restart react-drm.service`, but this machine runs a **root** system unit named `react-drm.service` (`/etc/systemd/system/react-drm.service`, which also needs sudo). The Restart button likely fails silently for this user. Verify and either support both or match deployment.
- 🟡 **Fork checkout can't build or test.** `config-gui` deps are hoisted in the deployed repo (`/home/Astra/opencode/react-drm/node_modules`); `npm test`/`npm run build` fail in `react-drm-fork/config-gui`. Edits made in the fork must be re-built in the deployed tree (deploy flow does not cover config-gui).
- 🟢 **`dialog.showOpenDialog(win ?? undefined as never, …)`** (`main/main.ts:82`) — `undefined as never` works but is fragile typing.

## Security

- 🟢 **Electron posture is good:** `contextIsolation: true`, `nodeIntegration: false`, narrow `contextBridge` surface (`main/main.ts:39-43`, `preload.ts`). All fs/exec stays in main.
- 🟢 **`restartService` uses `exec` with a constant string** — no injection surface today; keep it that way if the unit name ever becomes configurable.
- 🟢 **`resolveIcon` returns `file://` URLs** to the renderer (`main/main.ts:91-94`) — acceptable scope for a local config app.

## Fragile Areas (touch carefully in the redesign)

- 🔴 **`main/configEngine.ts` is format-preserving by design.** Any redesign that replaces "patch changed fields" with "regenerate sections from JSON" will destroy user comments, `as` casts, and custom formatting. New UI must keep sending the same JSON shape and let the engine patch.
- 🟡 **`UNION_FIELDS` / `SECTION_LABELS` duplication.** Allowed enum values, labels, and descriptions are hand-maintained in the renderer (`renderer.ts:32-73`); a new blueprint field with a union type shows as a free-text input until someone updates the map. A live blueprint-driven schema would fix this class of drift.
- 🟡 **Whole-state save.** The renderer sends the *entire* `state` on save (`renderer.ts:936`); the engine's `deepEqual` skip protects formatting, but any field the renderer mis-renders (e.g. a number parsed from text, line 379-387) is silently written back on every save.

## Performance

- 🟢 Non-issue at this scale: sections render once at boot; ts-morph parse per save is fine for a ~300-line config. The app-picker caps the list at 300 items.

---

*2026-09-28 analysis: initial codebase map*
