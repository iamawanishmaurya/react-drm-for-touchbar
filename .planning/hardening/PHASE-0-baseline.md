# Phase 0 — Commit the baseline

**Goal:** all current uncommitted work (touchbar-control, live layout, packaging, config-gui
renderer restore, docs) is committed on a new branch, so later phases produce small,
reviewable diffs. Nothing is pushed.

Read first: `.planning/hardening/README.md` (rules + verification method).

## Steps

1. `cd /home/Astra/opencode/touchbar/react-drm-fork && git status --short | wc -l` — note the count.
2. Check nothing that must not be committed is about to be:
   ```bash
   git status --short --untracked-files=all | grep -E 'node_modules|/dist/|\.env$|\.log$|config\.ts$|custom-layer\.json' || echo CLEAN
   ```
   Expected: `CLEAN`. (`config.blueprint.ts` and `.env.example.*` are fine; the user's
   `linux-touchbar-control-center/config.ts` must **not** appear.)
   Also scan for secrets:
   ```bash
   git diff HEAD | grep -niE 'password|passwd|secret|token|api[_-]?key' | head
   ```
   Every hit must be code/doc text, not a real value. If a real value appears: STOP, report.
3. Create the branch and commit:
   ```bash
   git switch -c touchbar-control-hardening
   git add -A
   git commit -m "feat: touchbar-control editor, live layout socket, install bundling, react-drm-recover

   Baseline before the hardening phases (.planning/hardening)."
   ```
4. Run the full test set once to record the baseline (failures here are recorded, not fixed):
   ```bash
   npm test 2>&1 | tail -5
   (cd linux-touchbar-control-center && npm test 2>&1 | tail -5 && npx tsc --noEmit -p tsconfig.json; echo tsc=$?)
   (cd touchbar-control && npm test 2>&1 | tail -5)
   (cd config-gui && npm test 2>&1 | tail -5)
   ```

## Done when

- [ ] `git branch --show-current` → `touchbar-control-hardening`
- [ ] `git status --short` → empty
- [ ] `git log --oneline -1` shows the baseline commit; `git log origin/master..HEAD --oneline` lists it
- [ ] Step 2 checks pasted, showing CLEAN and no real secrets
- [ ] Baseline test results pasted (pass/fail counts per suite) — this is the reference for later phases
- [ ] `REPORT-PHASE-0.md` written
