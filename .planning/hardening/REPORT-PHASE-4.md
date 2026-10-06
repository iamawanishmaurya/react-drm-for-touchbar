# REPORT — Phase 4: my-t2-fix snapshot cleanup

**Status: BLOCKED (index + notes delivered; the submodule conversion needs your push decision)**

Date: 2026-10-06 · Repo: `/home/Astra/opencode/zcode/my-t2-fix` · Branch: `touchbar-links`
Commit: `77fa00e` · **Nothing pushed**

---

## Blocker check (run first, as the spec requires)

```
$ git -C /home/Astra/opencode/touchbar/react-drm-fork ls-remote --heads origin touchbar-control-hardening
(no output — the branch is NOT on GitHub)

$ git -C /home/Astra/opencode/touchbar/mtmr status -sb | head -1
## main...origin/main
 M docs/HANDOFF.md
```

**A submodule only works if the commit is on GitHub.** `touchbar-control-hardening` is not
pushed, so `git submodule add` cannot resolve it. Per the spec I stopped and did **not**
push — that is yours to decide, and your standing instruction is never to push.

mtmr is level with `origin/main` but has an uncommitted `docs/HANDOFF.md`.

**Consequence:** steps 2 (submodules) and the folder deletions were **not** performed. The
48 MB snapshot is untouched on disk. Steps 3 and 5 — the parts with value independent of
the push — were done.

---

## What was delivered

### Step 3 — `touchbar/TROUBLESHOOTING-INDEX.md` (155 lines, new)

One table per group — **Symptom | Likely cause | Fix | Details** — under *Panel black /
frozen*, *Taps / keys*, *After suspend*, *Install / build*, *Audio-related*, *Editor
(touchbar-control / config-gui)*. 51 symptom rows.

**Coverage proof.** Every issue from both source files is present, verified mechanically
rather than asserted:

```
$ for i in $(seq 1 24); do grep -q "\[F$i\]" $IDX || echo "MISSING F$i"; done
$ for i in $(seq 1 19); do grep -q "\[M$i\]" $IDX || echo "MISSING M$i"; done
COVERAGE OK: all F1-F24 and M1-M19 present
```

`F` = `react-drm-fork/TROUBLESHOOTING.md`, `M` = `legacy/mtmr/docs/TROUBLESHOOTING.md`.
Genuine duplicates are merged into one row listing both sources (F10+M3 stale frame,
F3+M18 brightnessctl, F1+F8 input node, F11+Appendix capture). M19 had three distinct
causes and is split across three rows rather than flattened. The "Known EPIPE" entry and
the Appendix are both covered. `react-drm-recover` replaced `mtmr --recover` in 13 rows;
the old command survives in a cause column in exactly one place where the specific command
matters (the udev ACL / card0 rebind row).

Link targets all resolve:

```
OK   react-drm-fork/TROUBLESHOOTING.md
OK   legacy/mtmr/docs/TROUBLESHOOTING.md
OK   ../research/t2linux/04-touchbar.md
OK   ../research/t2linux/14-touchbar-userland.md
```

The index also records what Phases 1 and 2 fixed, so a reader hitting a freeze knows the
1.5 s exec timeout and the 15 s stall watchdog already exist.

### Step 5 — stale notes (additive only)

`touchbar/ORIGINAL-FOLDER-README.md` gained the one-line dated banner, 33 → 34 lines,
nothing else changed. `legacy/mtmr/docs/HANDOFF.md` was **not** edited — it lives in the
mtmr repo and a snapshot copy must not diverge. Its staleness is listed below for you.

---

## Done-when status

| Item | Status |
|---|---|
| Blocker check pasted | **done** — branch not pushed |
| Submodules / folder removals | **NOT DONE — blocked on your push decision** |
| Every issue from both files appears in the index | **done** — F1–F24, M1–M19 verified |
| Link check prints only `done` | **done** — all 4 targets resolve |
| `git status --short` clean after commit | partially — see below |
| Nothing pushed | **done** |
| `REPORT-PHASE-4.md` | done (this file) |

`git status` is not clean, and cannot be: the entire `touchbar/` folder was **untracked
before this phase started** (`?? touchbar/`, 48 MB). It only becomes trackable as
submodules — step 2, which is blocked. Pre-existing modifications to `.gitignore`,
`README.md` and two `research/t2linux/*.md` files were left untouched; they are not mine.

---

## For you to update in the mtmr repo

`/home/Astra/opencode/touchbar/mtmr/docs/HANDOFF.md` is stale in five places:

1. lines 17 and 32–35 tell you to run `sudo mtmr --recover` — now `sudo react-drm-recover`
2. line 73 ("After moving/killing daemons") — same swap
3. lines 36–37 say "11 documented issues" in `react-drm-fork/TROUBLESHOOTING.md` — there
   are 24 plus the Known entry and the Appendix
4. line 24 header "State of the world (as of 2026-09-28)" — nothing about touchbar-control,
   the exec timeouts or the stall watchdog
5. line 69 "Passwordless sudo is configured" — contradicts the hardening README (see
   `REPORT-PHASE-3.md`, "Noticed, not touched" #1)

---

## Noticed, not touched

1. **The watchdog's error pattern is probably wrong.** `TROUBLESHOOTING.md` issue 10 and
   `touchbar-watchdog.sh`'s `PATTERN` both key on `-110`, but 213/213 errors observed on
   this kernel were `-11` (EAGAIN). The watchdog appears to work by accident and may be
   over-triggering. Recorded in the index rows; not changed.

2. **`touchbar/README.md` "Known open issues" is now wrong** — it lists the WirePlumber
   freeze as unfixed with "planned fix: ~1.5 s timeout". Phase 1 built exactly that. I was
   told not to edit this file (it already had unrelated uncommitted changes).

3. **Issue counts are wrong in three places**: `ORIGINAL-FOLDER-README.md:31` says 9
   issues (there are 24), and `research/t2linux/14-touchbar-userland.md` §7 and its
   key-files list both say 22 (there are 24 plus Known plus Appendix).

4. **`t2-audio-rt.service` is a live bug.** Its script mangles the PID (`670682670682`),
   `chrt` fails silently every cycle, and it burns ~1.4 % of a core for nothing; the driver
   worker's priority 40 was applied by hand and is lost on the next module reload. The
   summary says both "do not fix the script" and "nothing has been changed" — that removal
   is still pending.

5. **Committing the index alone leaves its links broken on a fresh clone**, because the
   documents it points at are still untracked. Harmless while the folder stays on disk
   (which it does), but it resolves itself once the submodules land.