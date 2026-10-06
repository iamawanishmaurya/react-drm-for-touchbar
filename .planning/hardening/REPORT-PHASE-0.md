# REPORT — Phase 0: Commit the baseline

**Status: PASS**

Date: 2026-10-06
Branch: `touchbar-control-hardening` (created from `master`)
Commit: `e6cdc2d`
Phase file: [PHASE-0-baseline.md](PHASE-0-baseline.md)

No user action was required by this phase, so there is nothing pending.

---

## What changed

No code was authored or edited in this phase. One commit was created containing the
104 previously-uncommitted entries (195 files, 19 996 insertions, 362 deletions):

| Area | Files | One line each |
|---|---|---|
| `touchbar-control/` (new app) | 79 | React+Vite editor: web UI, server (apply, backups, presets, sandbox, liveBar), shared layout model, e2e runner |
| `linux-touchbar-control-center/` | 17 modified, 13 new | Left-panel ordering (`leftOrder.ts`), live layout socket, layout model/store/schema, left-panel routing, 5 new tests |
| `config-gui/renderer/` | 22 renames | `renderer-vanilla/` → `renderer/` (rename only, no content change); `configEngine.ts` updated |
| `src/` (library) | 8 modified, 3 new | `svg-serialize.ts`, `scene-boxes.ts`, `child-order.ts`; `id` passthrough in the reconciler |
| `packaging/` | 5 new, 4 modified | mtmr-designer bridge, preview captures, recovery/watchdog scripts |
| `system/` | 3 new | `touchbar-control.service`, `touchbar-control.desktop`, `react-drm-recover` |
| Docs | 4 new, 2 modified | `DESIGNER.md`, `.planning/hardening/*`, README/TROUBLESHOOTING updates |
| Misc | 2 new | `.zcodeignore`, `packaging/previews/*.png` (9 evidence captures) |

Nothing was pushed. `master` is untouched.

---

## Evidence

### Step 1 — change count

```
$ git status --short | wc -l
104
```

### Step 2 — nothing that must not be committed

The plan's grep matched two files. Both are false positives from an over-broad
regex, and I verified each:

```
$ git status --short --untracked-files=all | grep -E 'node_modules|/dist/|\.env$|\.log$|config\.ts$|custom-layer\.json'
?? touchbar-control/server/config.ts
?? touchbar-control/vite.config.ts
```

- `touchbar-control/server/config.ts` — source code (path/port constants, reads
  `REACT_DRM_DIR` from env). Not the user's live config.
- `touchbar-control/vite.config.ts` — matched only because the regex `config\.ts$`
  matches any path *ending* in `config.ts`.

The file the rule actually protects is absent and correctly ignored:

```
$ git status --short --untracked-files=all | grep -E 'linux-touchbar-control-center/config\.ts|linux-touchbar-control-center/custom-layer\.json'
NOT PRESENT - good

$ git check-ignore -v linux-touchbar-control-center/config.ts linux-touchbar-control-center/custom-layer.json
.gitignore:23:linux-touchbar-control-center/config.ts	linux-touchbar-control-center/config.ts
.gitignore:31:linux-touchbar-control-center/custom-layer.json	linux-touchbar-control-center/custom-layer.json
```

Confirmed again after staging — nothing forbidden was staged:

```
$ git diff --cached --name-only | grep -E 'node_modules|/dist/|\.env$|\.log$|linux-touchbar-control-center/config\.ts|custom-layer\.json'
NONE - good
```

### Step 2 — secret scan

```
$ git diff HEAD | grep -niE 'password|passwd|secret|token|api[_-]?key' | head
607: systemctl restart react-drm   # passwordless sudo configured; ExecStartPre recovers the panel
1987:   // (padded so the next poll offers completions for the following token).
```

Both are prose. **The plan's scan only covers tracked changes**, so I extended it to
the 128 untracked files that `git add -A` would stage:

```
$ git status --short -uall | grep '^??' | sed 's/^?? //' | while read -r f; do ... grep -HniE 'password|passwd|secret|token|api[_-]?key' "$f"; done
.planning/hardening/PHASE-0-baseline.md:18:   Also scan for secrets:
.planning/hardening/PHASE-0-baseline.md:44:- [ ] Step 2 checks pasted, showing CLEAN and no real secrets
.planning/hardening/README.md:34:| Restart | `sudo systemctl restart react-drm` — **sudo is not passwordless; only the user runs it** |
.planning/hardening/README.md:44:2. Never write a password, token or key into any file, commit or log.
touchbar-control/README.md:399:| Apply says the restart failed | The service restart needs passwordless `sudo -n systemctl restart react-drm` ... |
touchbar-control/package-lock.json:51:        "js-tokens": "^4.0.0",
touchbar-control/package-lock.json:2010:    "node_modules/@radix-ui/react-one-time-password-field": {
touchbar-control/package-lock.json:2012:      "resolved": "https://registry.npmjs.org/@radix-ui/react-one-time-password-field/...
touchbar-control/package-lock.json:2044:    "node_modules/@radix-ui/react-password-toggle-field": {
touchbar-control/package-lock.json:2046:      "resolved": "https://registry.npmjs.org/@radix-ui/react-password-toggle-field/...
touchbar-control/server/backups.test.ts:42:  assert.throws(() => restoreBackupFile('../../etc/passwd', dir, config), /unknown backup/);
```

Every hit is a plan/doc sentence, an npm package *name*, or a path-traversal
assertion. **No real secret.** No `.env` file exists in the tree.

### Step 3 — branch and commit

```
$ git switch -c touchbar-control-hardening
Switched to a new branch 'touchbar-control-hardening'

$ git commit -m "feat: touchbar-control editor, live layout socket, install bundling, react-drm-recover"
e6cdc2d feat: touchbar-control editor, live layout socket, install bundling, react-drm-recover
```

### Step 4 — baseline tests

All four suites re-run fresh after the final change:

```
########## 1. LIBRARY (npx tsx --test tests/*.test.ts) ##########
✔ appendMoving moves an existing child to the end instead of duplicating it (1.416149ms)
✔ insertMovingBefore moves an existing child in front of `before` (0.177908ms)
✔ insertMovingBefore inserts a new child, falling back to the front when `before` is unknown (0.138954ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0

########## 2. APP (linux-touchbar-control-center) ##########
ℹ tests 45
ℹ pass 45
ℹ fail 0
npm-test-exit=0
app-tsc=0

########## 3. TOUCHBAR-CONTROL ##########
ℹ tests 38
ℹ pass 38
ℹ fail 0
tc-npm-test-exit=0

########## 4. CONFIG-GUI ##########
ℹ tests 28
ℹ pass 28
ℹ fail 0
cg-npm-test-exit=0
```

**Baseline: 114 tests, 114 pass, 0 fail. App typecheck exit 0.**

The library build was a prerequisite — see Deviation 3. Before `npx tsc`, the app
suite reported `tests 25 / pass 23 / fail 2` with
`Cannot find module '.../node_modules/react-drm/dist/src/index.js'` from
`tests/lockNavigation.test.ts` and `tests/systemLock.test.ts`. That was a missing
build, not broken code; both pass after the build.

### Done-when checklist

```
$ git branch --show-current
touchbar-control-hardening

$ git status --short
[end of status]                      ← empty

$ git log --oneline -1
e6cdc2d feat: touchbar-control editor, live layout socket, install bundling, react-drm-recover

$ git log origin/master..HEAD --oneline
e6cdc2d feat: touchbar-control editor, live layout socket, install bundling, react-drm-recover
```

| Done-when item | Result |
|---|---|
| branch is `touchbar-control-hardening` | PASS |
| `git status --short` empty | PASS |
| baseline commit shown, ahead of `origin/master` | PASS |
| Step 2 checks pasted, CLEAN-equivalent, no secrets | PASS (see note above) |
| Baseline test results per suite | PASS — 3 / 45+tsc / 38 / 28 |
| `REPORT-PHASE-0.md` written | PASS |

### Diff review

```
$ git show --stat --format='' HEAD | tail -3
 touchbar-control/web/src/main.tsx                  |   18 +
 uninstall.sh                                       |   25 +-
 195 files changed, 19996 insertions(+), 362 deletions(-)
```

`git status` is empty, so there is no uncommitted diff on top of the commit; the
baseline commit itself is the diff under review.

Stray-file sweep:

```
$ git show --name-only --format='' HEAD | grep -iE '\.(tmp|bak|orig|rej|swp)$|~$|\.DS_Store|^\.env$|debug'
NONE - good
```

Size sweep: only `touchbar-control/package-lock.json` exceeds 200 KB (308 KB, expected).
The 9 added PNGs are preview-capture evidence referenced by `README.md` and by tracked
`.planning` docs; 10 sibling PNGs in the same folder were already tracked, so the
folder's convention is to commit captures.

---

## Deviations from the plan

1. **Step 2's exclusion grep is over-broad.** `config\.ts$` matches any path ending in
   `config.ts`, so it flagged `vite.config.ts` and `touchbar-control/server/config.ts`.
   I verified the one file the rule exists to protect
   (`linux-touchbar-control-center/config.ts`) is gitignored and untracked, and that
   nothing forbidden was staged. Expected result was `CLEAN`; I treat the intent as met.

2. **The secret scan was widened.** `git diff HEAD` misses untracked files, and this
   commit is mostly untracked files. I scanned all 128. Same conclusion, stronger evidence.

3. **`npm test` does not exist at the repo root** — the README's ground facts say
   "Library tests / build | repo root: `npm test`, `npx tsc`", but `package.json` has
   only `build:native`, `build:ts`, `build`, `preview:window`. I ran the library tests
   the equivalent way: `npx tsx --test tests/*.test.ts`. **Later phases should use this
   command, not `npm test`.**

4. **The library had to be built before the app suite could run.** `dist/` contained
   only a stale `tsconfig.tsbuildinfo` and no JavaScript, while
   `node_modules/react-drm` is a symlink to the repo root — so the app's imports of
   `react-drm/dist/src/index.js` did not resolve. I ran `npx tsc` at the root (exit 0).
   This emits gitignored output only; no tracked file changed and the working tree is
   still clean. **Anyone re-running the app suite from a fresh clone must run `npx tsc`
   first or the same 2 files will fail to load.**

None of these change the phase's outcome: a clean, reviewed baseline commit on a new
branch, with a green test baseline.

---

## Noticed, not touched

1. **Two leftover debug prints in `config-gui`**, both on hot paths, both with
   "verification print" markers rather than log messages:
   - `config-gui/renderer/main.ts:85` —
     `console.log('BOOT_OK panels=', …, 'navItems=', …, 'sections=', …)`
   - `config-gui/renderer/preview/client.ts:39` —
     `if (!announced) { announced = true; console.log('PREVIEW_LIVE w=', f.width, 'h=', f.height); }`
     The `announced` flag exists only to dedupe this line, so removing the print
     should remove the flag too.

2. **`src/renderer/renderer.ts:380`** logs lid state with a bare
   `console.log('[react-drm] lid is …')` although the library has its own
   `logger.ts`. Worth routing through it, but the `[react-drm]` prefix suggests it was
   deliberate.

3. **`DESIGNER.md` is committed but links outside the repo.** It is marked
   "Superseded by touchbar-control" and says the editor lives at `../mtmr-designer`,
   "a sibling of this fork, **not** inside it". Anyone cloning the repo gets broken
   links and no editor.

4. **`.zcodeignore` is committed.** It is agent-tool config that mirrors `.gitignore`.
   It is a legitimate repo file and not gitignored, so `git add -A` picked it up —
   flagging it in case it was meant to stay local.

5. **Root `npm test` does not exist** (Deviation 3). The README ground-fact table is
   wrong on this line and should be corrected before Phase 1 relies on it.

6. **`node_modules/react-drm` symlinks to the fork root, not to a build output.**
   That makes the fork's own `dist/` part of its test surface: any `tsc` error at the
   root can surface as an app-suite module-resolution failure, which is misleading.
   Phase 3 (compiled JS) touches this area.

---

## Next phase

[PHASE-1-exec-timeouts.md](PHASE-1-exec-timeouts.md) — no `wpctl` / `pactl` /
`brightnessctl` call can freeze the bar. Needs the user only for the hardware check.
Carry forward the command corrections in Deviations 3 and 4.