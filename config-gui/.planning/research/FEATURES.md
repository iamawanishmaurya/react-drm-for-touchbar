# Features Research — config-gui Redesign

**Analysis Date:** 2026-09-28

## Category: Layout Editor (the differentiator)

**Table stakes:**
- Visual bar mockup: a 2008:60 canvas strip showing the real render
- Drag-to-reorder main-bar buttons; order persists to config and survives restarts
- Dock app drag-reorder in both the preview strip and the app list
- Add/remove bar buttons and dock apps

**Differentiators:**
- Drag *between* preview and list (move items visually)
- Ghost/insertion-indicator while dragging; undo (revert to saved order)
- Live touch-through: send synthetic taps to the preview to test buttons (preview ws already accepts `touchstart`/`touchend`)

**Research notes:** the preview websocket already accepts synthetic touch events (`src/dev/preview-server.ts:100-103`), so click-to-test in the preview is nearly free — but it's out of scope per PROJECT.md unless trivial.

## Category: Live Preview

**Table stakes:**
- Embedded real render (ws → canvas), correct aspect ratio, scales to window
- Auto-start preview instance when GUI opens; clean shutdown
- Refresh after save+restart so the preview reflects new config

**Differentiators:**
- Status chip (preview starting / live / offline) with manual restart
- Split view: preview always visible on top, editor below

**Research notes:** preview needs the same env as the service (nvm node path, `DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR`); spawning from Electron main gives us control over lifecycle and port.

## Category: Simplified Pages

**Table stakes:**
- Few task-oriented pages instead of 17 sections: **Layout** (bar + dock drag), **Dock** (apps, icons, appearance), **Shortcuts** (browser/VSCode keymaps + overrides), **Behavior** (display/sleep/transitions/systembar), **Advanced** (everything else, hidden by default)
- Search that actually finds fields across pages
- Unsaved-changes indicator + Save/Restart flow (exists today)

**Differentiators:**
- Field descriptions pulled from a shared schema (kills `SECTION_LABELS`/`UNION_FIELDS` drift)

## Category: Trust & Safety of Config Writes

**Table stakes (already built — must survive the redesign):**
- Format-preserving, comment-preserving writes (configEngine)
- Blueprint-default merging so new fields appear
- Whole-state save with deepEqual skip

**Research notes:** the drag-order for bar layout needs a *new* config section; engine change is additive (`SECTION_NAMES` + one merge helper). The app-side reader (`configLoader.ts`) needs the matching export with a hard fallback to the current hardcoded order so old configs keep working.

---

*2026-09-28 analysis: initial research*
