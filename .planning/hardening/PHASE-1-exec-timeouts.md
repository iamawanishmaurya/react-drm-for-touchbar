# Phase 1 — No external command can freeze the bar

**Goal:** every synchronous child-process call in the bar app has a timeout and falls back
to the last known value, so a hung WirePlumber/PipeWire/brightnessctl costs at most
~1.5 s per call instead of freezing the bar forever.

Read first: `.planning/hardening/README.md`.

## Background (verified)

All in `linux-touchbar-control-center/`:

| Call site | Called from | Problem |
|---|---|---|
| `lib/services/mic.ts` `readMicMuted()` → `execFileSync('wpctl', …)` | `lib/hooks/useMicMute.ts`, **every 2 s** (`POLL_MS`) | no timeout — this froze the bar on 2026-10-05 |
| `lib/services/volume.ts` `readVolume()` → `execFileSync('wpctl'/'pactl')` | `app/splitted/layout.tsx:274` (volume drag start), `app/audio-slider/page.tsx:67` (on every `pactl subscribe` sink change) | no timeout |
| `volume.ts` + `mic.ts` `hasWpctl()` → `execFileSync('wpctl', ['--help'])` at **module load** | import time | no timeout; also if it fails once, wpctl is never used again |
| `lib/services/brightness.ts` `readBrightness()` → 2× `execFileSync('brightnessctl', …)` | brightness hooks / `app/brightness-slider/page.tsx:81` | no timeout |

The callers rely on these functions being **synchronous**; keep the signatures. Do not
convert callers to async in this phase.

## Steps

### 1. Add `lib/services/execQuick.ts`

```ts
import { execFileSync, type ExecFileSyncOptions } from 'child_process';
import fs from 'fs';
import path from 'path';

/** Upper bound for a synchronous helper command. The bar's render loop runs on
 *  the same thread, so a hung helper (e.g. wpctl while WirePlumber is stuck)
 *  would freeze the whole bar. */
export const EXEC_TIMEOUT_MS = Number(process.env.REACT_DRM_EXEC_TIMEOUT_MS) || 1500;

/** execFileSync with a hard timeout (SIGKILL) and stderr discarded. Throws on
 *  timeout, non-zero exit or a missing binary — callers fall back. */
export function execQuick(cmd: string, args: string[], opts: ExecFileSyncOptions = {}): string {
  return execFileSync(cmd, args, {
    timeout: EXEC_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'ignore'],
    ...opts,
    encoding: 'utf8',
  }) as string;
}

/** True when `cmd` is an executable on PATH — checked without running it, so a
 *  hung daemon at startup can't make us pick the wrong backend for good. */
export function commandExists(cmd: string, envPath = process.env.PATH ?? ''): boolean {
  return envPath.split(path.delimiter).some(dir => {
    if (!dir) return false;
    try { fs.accessSync(path.join(dir, cmd), fs.constants.X_OK); return true; }
    catch { return false; }
  });
}
```

(Adjust comment style to match the neighbouring files; keep the behaviour.)

### 2. `volume.ts`
- `hasWpctl()` → `commandExists('wpctl')`. Delete the old `execFileSync('wpctl', ['--help'])`.
- Extract the two parsers as exported pure functions: `parseWpctlVolume(out: string): number | null`
  and `parsePactlVolume(out: string): number | null` (same regexes as today, `null` when no match).
- `readVolume()` uses `execQuick`. Keep a module-level `let lastVolume = 0.5;`. On success
  update and return it; on any error return `lastVolume` (not a fresh `0.5`).
- Log once per failure streak: first failure → `console.error('[volume] read failed, keeping last value:', msg)`;
  next success after failures → `console.error('[volume] read recovered')`. No log per poll.
- `applyVolume` (async `execFile`): add `{ timeout: EXEC_TIMEOUT_MS, killSignal: 'SIGKILL' }`
  to each `execFile` options object (merge with the existing `env`). Behaviour otherwise unchanged.

### 3. `mic.ts`
Same pattern: `commandExists('wpctl')`, `execQuick`, `let lastMuted = false` fallback,
once-per-streak logging with prefix `[mic]`, timeouts on the async `execFile` in `toggleMicMute`.
Export pure parsers `parseWpctlMuted(out)` / `parsePactlMuted(out)`.

### 4. `brightness.ts`
`readBrightness` uses `execQuick` for both calls; keep a per-device last value
(`const lastBrightness = new Map<string, number>()`), return it on failure. Keep the existing
one-time "brightnessctl not found" message, but only print it when the binary is actually
missing (`!commandExists('brightnessctl')`); for a timeout/other error use the
once-per-streak `[brightness] read failed…` message instead. Add the timeout to its async
`execFile` calls too.

### 5. Prove nothing else is left
```bash
cd linux-touchbar-control-center
grep -rn "execFileSync\|execSync\|spawnSync" lib app index.tsx | grep -v '\.test\.'
```
Expected: only `lib/services/execQuick.ts`. Any other hit: convert it the same way, or, if it
is clearly one-shot startup code that must stay, add `timeout` + `killSignal` and list it in
the report.

### 6. Tests — `tests/execQuick.test.ts` (node:test, same style as `tests/sessionRuntime.test.ts`)

1. `execQuick('echo', ['hi'])` → `'hi\n'`.
2. `execQuick('sleep', ['10'])` throws, and the call takes **< 3000 ms** (measure with `performance.now()`).
3. `commandExists('sh')` → true; `commandExists('definitely-not-a-command-xyz')` → false;
   `commandExists('sh', '')` → false.
4. Hung-wpctl end-to-end: create a temp dir with an executable `wpctl` script:
   ```sh
   #!/bin/sh
   if [ -e "$FAKE_DIR/hang" ]; then sleep 30; fi
   echo "Volume: 0.40"
   ```
   Spawn a child (`spawnSync(process.execPath, ['--import', 'tsx', '-e', CODE], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_DIR: dir }, timeout: 20000 })`)
   where `CODE` imports `../lib/services/volume.ts` **by relative absolute path** (no `@/` alias),
   calls `readVolume()` (expect 0.4), creates `$FAKE_DIR/hang`, calls `readVolume()` again, and
   prints both values and the elapsed ms of the second call as JSON.
   Assert: first = 0.4, second = 0.4 (last value kept, not 0.5), second call < 3000 ms.
   If `--import tsx` can't resolve imports inside `volume.ts` (it imports `@/lib/utils/sessionRuntime`),
   change that import in `volume.ts` to a relative one (`../utils/sessionRuntime`) and say so in the report.
5. Parser unit tests for the four exported parse functions: normal output, `[MUTED]`, garbage → `null`.

Red-before-green: run test 4 against the **old** `volume.ts` (`git stash` the change, keep
the test file) and paste the failure (it should time out / exceed the limit), then restore.

### 7. Deploy (staged, no restart)
```bash
cd /home/Astra/opencode/touchbar/react-drm-fork && NO_RESTART=1 ./deploy.sh
```
Expected last line: `staged (no restart)`.

## Done when

- [ ] Step 5 grep output pasted: only `execQuick.ts` (or justified exceptions)
- [ ] `npm test` (app) — all pass, including the new file; count ≥ baseline + new tests
- [ ] `npx tsc --noEmit -p tsconfig.json` (app) → exit 0
- [ ] Library tests (`npx tsx --test tests/*.test.ts` at the repo root) still at the Phase 0 baseline
- [ ] Red-before-green evidence for test 4
- [ ] `NO_RESTART=1 ./deploy.sh` → `staged (no restart)`; `diff -q` of the 4 service files between fork and `/home/Astra/opencode/react-drm/linux-touchbar-control-center/lib/services/` → no differences
- [ ] Commit on the branch: `fix(bar): time out wpctl/pactl/brightnessctl calls so a hung audio daemon can't freeze the bar`
- [ ] USER CHECK (PENDING until confirmed), print these for the user:
  1. `sudo systemctl restart react-drm`, wait 10 s, bar shows normally.
  2. Simulate a hung audio daemon for 20 s: `systemctl --user kill -s STOP pipewire; sleep 20; systemctl --user kill -s CONT pipewire`
  3. During those 20 s, tap a few buttons and watch the clock: the bar must keep responding
     (a short hitch every 2 s is OK). Before this fix it would freeze.
  4. `journalctl -u react-drm --since '-2 min' | grep -E '\[mic\]|\[volume\]'` → one "read failed" and one "recovered" line each at most.
- [ ] `REPORT-PHASE-1.md` written
