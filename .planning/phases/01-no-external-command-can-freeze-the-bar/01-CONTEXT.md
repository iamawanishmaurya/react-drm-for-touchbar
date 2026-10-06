# CONTEXT — Phase 1: No external command can freeze the bar

**Discuss:** skipped (`workflow.skip_discuss=true` — the phase spec is already written)
**Spec:** `.planning/hardening/PHASE-1-exec-timeouts.md` — **read this first; it is the
authoritative design, including the exact code for the new helper.**
**Rules:** `.planning/hardening/README.md` and the Hard Rules section of
`.planning/PROJECT.md`.

## Goal

Every synchronous child-process call in the bar app has a timeout and falls back to the
last known value, so a hung WirePlumber/PipeWire/brightnessctl costs at most ~1.5 s per
call instead of freezing the bar forever.

## Why this phase is first

This is the **verified** cause of the 2026-10-05 freeze. `useMicMute` polls
`readMicMuted()` every 2 s (`POLL_MS`), which runs `execFileSync('wpctl', …)` with **no
timeout**. WirePlumber was hung, so a synchronous child process blocked the bar's only
thread indefinitely. Phase 1 removes that cause; Phase 2 catches the unknown ones.

## Background (verified — do not re-investigate)

All in `linux-touchbar-control-center/`:

| Call site | Called from | Problem |
|---|---|---|
| `lib/services/mic.ts` `readMicMuted()` → `execFileSync('wpctl', …)` | `lib/hooks/useMicMute.ts`, **every 2 s** | no timeout |
| `lib/services/volume.ts` `readVolume()` → `execFileSync('wpctl'/'pactl')` | `app/splitted/layout.tsx:274`, `app/audio-slider/page.tsx:67` (on every sink change) | no timeout |
| `volume.ts` + `mic.ts` `hasWpctl()` → `execFileSync('wpctl', ['--help'])` at **module load** | import time | no timeout; one failure means wpctl is never used again |
| `lib/services/brightness.ts` `readBrightness()` → 2× `execFileSync('brightnessctl', …)` | brightness hooks, `app/brightness-slider/page.tsx:81` | no timeout |

## Key constraint

Callers rely on these functions being **synchronous**. Keep the signatures. Do **not**
convert callers to async in this phase.

## Specifics

- New helper `lib/services/execQuick.ts` with `EXEC_TIMEOUT_MS` (default 1500, override via
  `REACT_DRM_EXEC_TIMEOUT_MS`), `execQuick()` (hard timeout + `SIGKILL`, stderr discarded)
  and `commandExists()` (checks `PATH` **without executing** the binary). Exact code is in
  the phase file — follow it.
- `volume.ts` / `mic.ts` / `brightness.ts`: use the helper, export pure parsers
  (`parseWpctlVolume`, `parsePactlVolume`, `parseWpctlMuted`, `parsePactlMuted`),
  keep a module-level last value and return it on failure, log **once per failure streak**
  plus one recovery line. Add timeouts to the async `execFile` calls too.
- Prove nothing is left with the grep in phase-file step 5.
- Tests in `tests/execQuick.test.ts`, including a fake hung `wpctl` on `PATH` (phase-file
  test 4). **Red before green**: run test 4 against the old `volume.ts` and paste the
  failure.

## Out of Scope

- Converting callers to async (explicitly excluded by the phase file)
- The stall watchdog (Phase 2)
- Any `sudo`, restart, or hardware action — the only user step is the final USER CHECK,
  which must be printed and left PENDING

## Deferred Ideas

None.

## Verification Notes

- **Library tests: `npx tsx --test tests/*.test.ts` at the repo root. `npm test` does not
  exist there.** Baseline 3 passing.
- **Run `npx tsc` at the repo root before any app test run**, or the app suite reports 2
  bogus module-resolution failures.
- App suite baseline: **45 passing**; must be ≥ 45 + the new tests.
- Report to `.planning/hardening/REPORT-PHASE-1.md`.