---
last_mapped_commit: f7097b344f7c49ea5bdd7e268a5083b8bef708a5
last_mapped_at: 2026-09-28
---
# Project Structure

**Analysis Date:** 2026-09-28

## Directory Layout

```
config-gui/
├── package.json              # scripts: build (2× tsc + asset copy), dev/start (electron .), test (tsx --test)
├── tsconfig.json             # main-process compile (CommonJS → dist/main)
├── tsconfig.renderer.json    # renderer compile (ES2022 → dist/renderer)
├── main/
│   ├── main.ts               # Electron entry: window, all ipcMain handlers (~119 lines)
│   ├── preload.ts            # contextBridge: configApi + windowApi (~19 lines)
│   ├── configEngine.ts       # config.ts read/write via ts-morph, restartService (~409 lines)
│   ├── configEngine.test.ts  # node:test unit tests (~188 lines)
│   ├── desktopApps.ts        # .desktop parser for the app picker (~120 lines)
│   ├── iconList.ts           # ICON_CHOICES static list (~13 lines)
│   ├── iconThemes.ts         # installed icon-theme listing (~44 lines)
│   └── keyNames.ts           # DOM code → key name table (~48 lines)
├── renderer/
│   ├── index.html            # static shell: sidebar nav, topbar, content (~51 lines)
│   ├── renderer.ts           # ALL UI logic, one file (~964 lines)
│   ├── renderer.css          # all styling, one file (~483 lines)
│   └── types.ts              # JsonValue/SectionName/ConfigApi/WindowApi (~44 lines)
└── dist/                     # build output (gitignored? — rebuilt by npm run build)
    ├── main/*.js
    └── renderer/{index.html,renderer.css,renderer.js,types.js?}
```

## Key Locations (by task)

| Task | File |
|------|------|
| Add an IPC channel | `main/main.ts` (handler) + `main/preload.ts` (bridge) + `renderer/types.ts` (typing) |
| Add an editable config section | `main/configEngine.ts:10` (`SECTION_NAMES`) + `renderer/renderer.ts:17-59` (nav group, label, description) + `renderSection` switch (line 330) |
| Add a widget kind to the form | `renderer/renderer.ts` `renderGenericObject` (line 341) type dispatch |
| Change how config.ts is patched | `main/configEngine.ts` (`mergeObjectProperties` line 206, `mergeDockApps` line 246) |
| Add a preview | `renderer/renderer.ts` — follow `renderDockPreview` (line 129) pattern |
| Window chrome | `renderer/index.html:23-37` + `wireWindowControls` (`renderer.ts:200`) + main.ts:50-56 |

## Naming Conventions

- Files: camelCase for TS modules (`configEngine.ts`, `desktopApps.ts`), kebab none; one exported concept per file.
- Types: PascalCase (`ConfigData`, `SectionName`, `DesktopAppEntry`); IPC payload shapes are inline object types.
- Constants: SCREAMING_SNAKE (`NAV_GROUPS`, `SECTION_LABELS`, `UNION_FIELDS`, `SECTION_NAMES`).
- IPC channel names: `domain:action` strings (`config:read`, `icon:resolve`, `window:minimize`).
- CSS: single global namespace, hyphenated classes (`.field-row`, `.app-card`, `.picker-overlay`, `.tb-preview-*`).

## Conventions of the Route/Section Names

- Section names must match the `const` object names in `config.ts` exactly (they're AST lookups): `DISPLAY`, `ESC_KEY`, … `FN_KEYS`.
- The renderer's form paths are dot-joined strings (`'DOCK.shortcut.mode'`) used as keys into `UNION_FIELDS`.

## Build Output Coupling

`npm run build` copies `renderer/index.html` + `renderer/renderer.css` verbatim into `dist/renderer/`; the compiled `renderer.js` is loaded by `index.html` as `<script type="module" src="renderer.js">`. Any new renderer asset must be added to the build's `cp` line.

---

*2026-09-28 analysis: initial codebase map*
