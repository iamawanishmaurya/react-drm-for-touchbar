# Pitfalls Research — config-gui Redesign

**Analysis Date:** 2026-09-28

## Config-write pitfalls (highest blast radius)

1. **Never regenerate sections.** The engine's value is format preservation (comments, `as` casts, quote style). Any "simplification" that serializes whole sections from JSON destroys user files. All GUI changes must keep sending partial section JSON through the existing patch path.
2. **`deepEqual` skip is load-bearing.** Whole-state saves are safe *only* because unchanged fields are skipped. If a new page mutates a field on load (e.g. normalizing a string), every save rewrites it and churns the file.
3. **Array round-trip taint.** One unsupported element makes `nodeToValue` drop the whole array (`configEngine.ts:75-77`). If BAR_LAYOUT only holds strings it's safe; don't add function/JSX values to it.
4. **App-side backward compat.** Old config.ts files won't have BAR_LAYOUT; the reader must fall back to today's hardcoded order or the bar breaks on first deploy before GUI saves anything.

## Preview pitfalls

5. **Preview instance lifecycle.** Leaked preview processes on GUI close (guard with `before-quit` kill), port collisions (pick free port via net server probe), and two GUI instances fighting over one instance.
6. **Preview env.** Must run from the *deployed* tree with the service's env (nvm node, DBUS session address, XDG_RUNTIME_DIR) or the React app crashes on D-Bus (documented ENOENT failure mode) and renders splash forever.
7. **Frame parsing.** 16-byte header + BGRA rows; forgetting the header offset or BGR order gives garbage. Read dimensions from the frame header, not a hardcoded 2008.
8. **Restart flicker.** After service restart the preview shows boot splash for ~10-20s; the UI must show a "starting" state, not look broken.

## Renderer pitfalls

9. **Unbundled tsc ES modules.** Imports need `.js` extensions; new asset files must be added to the build `cp`; forgetting either = blank window with only console errors. Test with `npm run dev` in the deployed tree after every structural change.
10. **HTML5 DnD quirks.** `dragover` must `preventDefault()` or drop never fires; Electron sometimes needs `event.dataTransfer.effectAllowed` set; drops over child elements need hit-testing against the parent container.
11. **State/events lifecycle.** Today's code re-renders lists wholesale on structural change; naive drag state can desync from `state`. Keep one order model (array in state) and make DnD a pure mutation + re-render.
12. **Keyboard accessibility.** HTML5 DnD is pointer-only; keep up/down buttons as fallback or the editor is unusable by keyboard.

## Process / deployment pitfalls

13. **Fork vs deployed tree.** Build + tests only run in `/home/Astra/opencode/react-drm/` (deps hoisted). Edits happen in the fork; remember to rebuild there and keep fork↔deployed in sync (config-gui is NOT covered by deploy.sh).
14. **Restart unit mismatch.** Current `systemctl --user restart react-drm.service` fails here (root system unit). Fix must handle both without breaking upstream.
15. **Electron on niri.** Frameless window + tiling WM already handled; new panes must respect `minWidth: 760`.

---

*2026-09-28 analysis: initial research*
