---
plan: 01
phase: 1
status: gaps_found
---

# Plan Verification — Phase 1

## Summary

The plan is sound, executable and unusually well grounded: every load-bearing factual claim I
re-tested against the real tree held, all seven phase-file steps and all nine Done-when items are
covered, and it correctly fixes the two command errors the phase file itself contains (root
`npm test` does not exist; root `npx tsc` must precede the app suite). The red-before-green task
is genuine — I reproduced the red by hand and it fails with `ETIMEDOUT` because the *old* code
hangs, not because of a module-resolution error. No hard rule is broken. The six gaps below are
all wording/verification defects, none of which stop execution; one of them (GAP-1) sits on the
single most important evidence item in the phase and should be fixed before the executor runs it.

## Checks

| Check | Result | Evidence |
|---|---|---|
| A. Spec fidelity | **pass** | All 7 steps mapped: step 1 → Task 1 (code verbatim), step 2 → Task 2 (incl. all 6 `execFile` sites), step 3 → Task 3 mic.ts, step 4 → Task 3 brightness.ts (incl. the `!commandExists('brightnessctl')` split), step 5 → Task 4 (incl. the "justified exception" escape hatch), step 6 → Tasks 5 + 6, step 7 → Task 7. All 9 Done-when items mapped to a task/verify. Nothing silently dropped. The plan deliberately replaces the phase file's `git stash` red-step with `cp` + `git show HEAD:…` + `diff -q` — a correct, safer deviation, and Task 7 asks for deviations to be recorded. |
| B. Rule compliance | **pass** | `grep -nE '\bsudo\b\|git push\|--force\|pkill\|git stash'` over the plan hits only prose ("never `git push`", "the agent must not run them") and the USER CHECK block Task 7 explicitly marks as print-only. No `sudo` is ever executed. All writes stay inside the fork, `/tmp` scratch files, or `NO_RESTART=1 ./deploy.sh`. No existing test is edited. No Apply / Live on Touch Bar. Scope stays inside the 4 service files + 1 new test. |
| C. Command correctness | **pass** | No root `npm test` anywhere; library tests use `npx tsx --test tests/*.test.ts` at the repo root. Root `npx tsc` precedes every app run (Task 4 step 1, Task 5 `<automated>`, Task 7 step 3). I re-ran all four baselines myself: root `npx tsc` → `root_tsc=0`; root `npx tsx --test tests/*.test.ts` → `ℹ tests 3 / pass 3 / fail 0`; `cd linux-touchbar-control-center && npm test` → `ℹ tests 45 / pass 45 / fail 0`; app `npx tsc --noEmit -p tsconfig.json` → `app_tsc=0`. Task 5's arithmetic (45 + 9 new = 54) is consistent with its own test enumeration. |
| D. Acceptance criteria quality | **gaps** | All 7 tasks have an `<automated>` + a concrete `<fails_when>`; there is no `TBD`, `N/A`, `none`, or pure restatement anywhere. GAP-1 (Task 6) misdescribes what its shell variable holds, inverting the reading of the red-evidence check. GAP-2 (Task 6) leaves a load-bearing string un-pinned. |
| E. Feasibility | **pass** | Every assumption I tested is true: `volume.ts:11-16` really has `hasWpctl()` doing a module-load `execFileSync('wpctl', ['--help'])`; execFile counts are exactly **6 / 2 / 1** as the plan asserts (volume.ts:46,48,53,57,61,63; mic.ts:30,35; brightness.ts:46); `PW_ENV` is exported; app `tsconfig.json` does exclude `tests`; the step-5 grep currently hits only the 3 service files, so `execQuick.ts`-only is achievable; `deploy.sh` copies the whole `lib` tree and `tests/*.test.ts`, and the running install has a `tests/` dir, so `NO_RESTART=1 ./deploy.sh` will not abort before printing `staged (no restart)`; `sh`, `sleep`, `wpctl`, `pactl`, `brightnessctl` are all on PATH; the `await readVolume|readMicMuted|readBrightness` grep returns nothing (exit 1). **The `@/`-alias claim also holds**: `node --import tsx -e "import('<abs>/lib/services/volume.ts')…"` with `cwd` = `linux-touchbar-control-center` prints `ALIAS_OK`, so the phase file's "change the import to relative" fallback is genuinely unnecessary. GAP-6 is the one under-specified behaviour. |
| F. Red-before-green | **pass** | I reproduced the red end-to-end against the *current, unmodified* `volume.ts`: fake executable `wpctl` on a temp `PATH`, `spawnSync(..., timeout: 20000)` → `wall_ms=20024, status=null, signal=SIGTERM, err=ETIMEDOUT, stdout=""`. The failure is caused by the missing per-call timeout, exactly as the plan predicts — not a module error. The alias resolved cleanly beforehand, so the failure reason is isolated. |

## Gaps

### GAP-1: Task 6's red-evidence check reads the wrong variable

- **Severity:** major
- **Location:** Task 6, `<verify>` / `<fails_when>`
- **What's wrong:** The command is
  `grep -cE 'not ok|✖ ' /tmp/red-phase1.txt; echo "red_failures=$?"`.
  `grep -c` prints the *count* on stdout but sets `$?` to its **exit status**, so `red_failures=`
  holds `1` when the count is 0 and `0` when the count is ≥ 1 — the exact inverse of what the
  fails_when describes. The fails_when reads "`red_failures=$?` reports a count of 0 (nothing ever
  failed)", which sends a literal executor to the wrong conclusion in both directions. This is the
  only automated gate on FREEZE-06 / XC-02, the phase's central proof, so a misread here either
  discards a valid red or accepts a fake one.
- **Fix:** Name the count, not the exit status, and assert the red file's content directly:
  `red=$(grep -cE 'not ok|✖ ' /tmp/red-phase1.txt); green=$(grep -cE 'not ok|✖ ' /tmp/green-phase1.txt); echo "red_failure_lines=$red green_failure_lines=$green"`
  and change the fails_when to "fails when `red_failure_lines` is 0, or `green_failure_lines` is
  greater than 0".

### GAP-2: `--test-name-pattern='hung'` is never tied to a pinned test title

- **Severity:** minor
- **Location:** Task 6 (pattern) vs Task 5 case 5 (title)
- **What's wrong:** Task 5 gives case 5 the heading "Hung wpctl end-to-end" but never fixes the
  literal string passed to `test()`, while Task 6 filters on the literal substring `hung`. I
  verified what happens on a non-match: `tsx --test --test-name-pattern='nomatch' file.test.ts`
  prints `✔ file.test.ts`, `ℹ tests 1`, `ℹ pass 1`, `ℹ fail 0` and **exits 0** — a completely
  green-looking red run. An executor who titles it `…that hangs…` (no `hung` substring) hits this.
  The `grep -c` count does catch it, but only incidentally.
- **Fix:** Pin the title in Task 5, e.g.
  `test('a hung wpctl keeps the last volume and returns under 3s', …)`, and add
  `| grep -E "^ℹ tests"` to Task 6's red and green commands with fails_when "…or either run shows
  `ℹ tests` other than `1`".

### GAP-3: Task 4 / Task 5 verify never captures the test-runner exit code

- **Severity:** minor
- **Location:** Task 4 `<automated>`, Task 5 `<automated>`
- **What's wrong:** Both pipe the suites through `grep` (`npm test 2>&1 | grep -E …`), so the
  shell status is grep's. If the app suite dies before printing a summary line — or if the `ℹ`
  glyph/spacing ever differs — no `ℹ pass` / `ℹ fail` line appears, none of the "ℹ fail other than
  0 / ℹ pass other than 45" clauses can fire, and the task verifies green on an unrun suite.
- **Fix:** Add `; echo "app_test_exit=${PIPESTATUS[0]}"` (and the same for the library run) and add
  "`app_test_exit=` or `lib_test_exit=` is not `0`" to the fails_when. `set -o pipefail` is an
  equivalent one-word fix.

### GAP-4: The plan file itself is corrupted at the end

- **Severity:** minor
- **Location:** `01-01-PLAN.md`, final line
- **What's wrong:** `od -c` on the file tail shows the plan terminates with
  `… Do not start Phase 2.\n</content>\n</invoke>\n</tool_call>\n` — a stray tool-call
  wrapper (the last tag carries a zero-width space). It is outside `<tasks>`/`<must_haves>` so a
  structural parser will ignore it, but it is literal junk text sitting at the end of a document an
  executor agent reads top to bottom.
- **Fix:** Delete the trailing `</content></invoke></tool_call>` lines so the file ends at
  `Do not start Phase 2.`.

### GAP-5: Task 7's `.planning/` staging contradicts its own clean-tree criterion

- **Severity:** minor
- **Location:** Task 7 step 5, and the `<output>` section
- **What's wrong:** The tree is **not** clean right now — Phase 0's report says it was, but since
  then `git status --short` shows `M .planning/hardening/PHASE-1-exec-timeouts.md`,
  `M .planning/hardening/README.md`, and untracked `.planning/PROJECT.md`, `REQUIREMENTS.md`,
  `ROADMAP.md`, `STATE.md`, `config.json`, `hardening/REPORT-PHASE-0.md` and `01-01-PLAN.md`.
  Task 7 says "Stage only the phase's files (the 5 code/test files plus `.planning/`)", so the
  phase commit will sweep in all 8 pre-existing planning files. Worse, the `<output>` section
  writes `.planning/STATE.md` *after* Task 7's verify has already asserted
  "`git status --short` lists any modified file outside the phase's files" — so the plan's own
  last step re-dirties the tree the check just certified (and leaves this
  `01-01-VERIFICATION.md` untracked). `files_modified` also omits `.planning/STATE.md`.
- **Fix:** Either move the STATE.md update before the commit and add `.planning/STATE.md` to
  `files_modified`, or state explicitly in Task 7 that the pre-existing planning docs are
  committed alongside the phase and that `.planning/STATE.md` plus this verification file are
  expected to remain dirty afterwards.

### GAP-6: `readMicMuted`'s handling of a `null` parse result is never written out

- **Severity:** minor
- **Location:** Task 3, mic.ts bullet 4
- **What's wrong:** Task 3 gives `parseWpctlMuted` a 3-state `true | false | null` contract (a
  correct improvement over today's `out.includes('[MUTED]')`, which returns `false` on garbage),
  but only says `readMicMuted` uses "the same try/catch shape as `readVolume`". `readVolume`'s
  shape in Task 2 contains `if (v === null) throw new Error('unparseable volume output')`; the mic
  version is left to inference. If an executor instead writes
  `lastMuted = parseWpctlMuted(out) ?? lastMuted`, an unparseable response is counted as a
  *success*, which clears the `failing` flag and emits a bogus `[mic] read recovered` line — a
  direct violation of FREEZE-02's "log at most once per failure streak plus one recovery line".
- **Fix:** Add the literal guard to Task 3 bullet 4, e.g.
  `const m = USE_WPCTL ? parseWpctlMuted(out) : parsePactlMuted(out); if (m === null) throw new Error('unparseable mute output');`,
  and add an acceptance criterion "a null parse is treated as a failure, never as success".

## Verdict

gaps_found

No blockers. The plan can be executed as written — every fact it asserts is true of this repo,
every command resolves, and the proof task is real. Fix GAP-1 before dispatch (it gates the
phase's only real proof) and fold GAP-2/GAP-3 into the same edit of Task 6's and Tasks 4/5's
`<verify>` blocks; GAP-4/5/6 are tidy-ups the executor can absorb while writing the report's
"deviations" and "noticed, not touched" sections.
---

## Gap Resolution (revision 1 — applied by the executor)

All six gaps fixed in `01-01-PLAN.md`:

| Gap | Severity | Resolution |
|---|---|---|
| GAP-1 red-evidence check inverted | **major** | `grep -c` output is now captured into a variable (`red=$(grep -cE …)`) and gated on the **count**, not grep's exit status. `fails_when` now names concrete values (`red_failures=0`, `red_tests` not `1`, `green_pass_one=0`, `restore_diff=NONZERO`). Verified against three fixtures: good case → `red_failures=1 … restore_diff=0`; "red never failed" → `red_failures=0`; "not restored" → `restore_diff=NONZERO`. |
| GAP-2 `--test-name-pattern` unpinned | minor | Replaced the loose `hung` substring with `$HUNG_TEST_RE`, an anchored regex of the exact test title defined in Task 5 and reused verbatim. Added a paragraph explaining that a non-matching pattern makes node print `ℹ pass 1` and exit 0 — a green-looking red run. |
| GAP-3 test-runner exit codes lost through pipes | minor | Task 4's `<automated>` now redirects each suite to a file, captures `lib_exit=$?` / `app_exit=$?` **before** grepping, and `fails_when` rejects non-zero. |
| GAP-4 corrupted plan tail | minor | Stripped the trailing `</content></invoke></tool_call>` agent artifact (file truncated 595 → 593 lines). Confirmed no residual tags. |
| GAP-5 staging vs clean-tree check | minor | Task 7 now stages by **explicit path list** (the 5 code/test files + `.planning/`), shows the exact `git status --short` list for review before committing, commits `.planning/STATE.md` as a separate `docs(01):` commit so `git log --oneline -1` keeps the required phase subject, and `STATE.md` was added to `files_modified`. `fails_when` now allows only `linux-touchbar-control-center/` and `.planning/` entries. |
| GAP-6 `readMicMuted` null handling | minor | Added an explicit contract: a `null` parse takes the **same** path as a thrown error (return `lastMuted`, set `failing`, emit the once-per-streak line) — never `lastMuted = parsed ?? lastMuted`. Included the reference implementation showing the recovery line fires only after a parse succeeds, so garbage output cannot count as recovery. |

Post-fix validation: 649 lines · 7 tasks (tags balanced) · 7 `<automated>` / 7 `<fails_when>`
· no banned tokens (`TBD`/`TODO`/`N/A`/`none`) · no `git stash` used · no root `npm test`.

**Revised verdict: pass**
