---
last_mapped_commit: f7097b344f7c49ea5bdd7e268a5083b8bef708a5
last_mapped_at: 2026-09-28
---
# External Integrations

**Analysis Date:** 2026-09-28

config-gui is a desktop editor — it integrates with the local system, not with network services. No network access, no databases, no auth.

## The Touch Bar config files (primary integration)

- Reads and writes `linux-touchbar-control-center/config.ts` — the live configuration of the running Touch Bar UI. Paths resolved in `main/configEngine.ts:29-37`:
  - `REACT_DRM_REPO_DIR` env override, else `<repo>/linux-touchbar-control-center` (config-gui always lives at `<repo>/config-gui`).
  - `configPath` = `<repo>/config.ts`, `blueprintPath` = `<repo>/config.blueprint.ts`.
- `ensureConfigExists` (`main/configEngine.ts:40-46`) seeds `config.ts` from `config.blueprint.ts` on first open — mirrors install.sh's `seed_user_config`.
- **Reading** (`main/configEngine.ts:95-143`): ts-morph parses both files, converts the 17 known section constants (`SECTION_NAMES`, line 10) to plain JSON via `nodeToValue`; user config is merged over blueprint defaults (`withDefaults`, line 115) so newly added blueprint fields appear in the form.
- **Writing** (`main/configEngine.ts:343-374`): patches only changed properties in place, preserving comments, quote style, `as` casts, and untouched formatting. `DOCK.apps` gets bespoke id-matched merge (`mergeDockApps`, line 246); icon glyph changes add `react-icons/fa6` imports (`ensureFa6Imports`, line 333).
- After saving, `syncCompiledConfig` (`main/configEngine.ts:383-400`) transpiles `config.ts` → `dist/config.js` (single-file `ts.transpileModule`) so the production service picks changes up without a full build.

## The running Touch Bar service

- `restartService` (`main/configEngine.ts:402-409`) shells out to `systemctl --user restart react-drm.service` via `child_process.exec`. Best-effort, errors surfaced to the renderer as a message.
  - Note: on this machine (Arch + niri, T2) the real service is the **root** `react-drm.service` at `/etc/systemd/system/react-drm.service` — the `--user` unit here is the upstream convention and the restart may target the wrong unit in this deployment.

## react-drm package (in-process)

- `appIconSource(name)` → file path of a themed icon; `setIconTheme(theme)` → module-level theme override (`main/main.ts:9,91-103`). `resolveIcon` converts the path to a `file://` URL for `<img>` tags in the Dock preview.
- `KEY` — key-code constants passed to the renderer via `config:meta` (`main/main.ts:109-113`).

## Freedesktop desktop entries (app picker)

- `main/desktopApps.ts` parses `.desktop` files from `~/.local/share/applications`, `/usr/share/applications`, `/usr/local/share/applications`, plus flatpak export dirs (`main/desktopApps.ts:13-19`).
- Spec-compliant `Exec=` tokenizer honoring quotes/escapes and stripping `%` field codes (`main/desktopApps.ts:31-47, 88`); caches the sorted list in-process.

## Icon themes

- `main/iconThemes.ts` — lists installed KDE/GTK icon themes for the Dock icon-theme dropdown.
- `main/iconList.ts` — static `ICON_CHOICES` list of react-icons glyph names for the fallback icon picker.

---

*2026-09-28 analysis: initial codebase map*
