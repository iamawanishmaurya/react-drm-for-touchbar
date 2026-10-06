# Phase 4 — my-t2-fix: one source of truth + one troubleshooting index

**Goal:** `/home/Astra/opencode/zcode/my-t2-fix/touchbar/` stops being a 48 MB copy that
drifts from the real repos. It becomes: an index, links (git submodules) to the real repos,
and one symptom → fix page covering every Touch Bar doc.

Read `.planning/hardening/README.md`. Work in `/home/Astra/opencode/zcode/my-t2-fix`
(its own git repo; commits there are fine on a new branch; **no push** without the user).

## Decision already made (by Claude, 2026-10-06) — the user may override before you start

| Folder in `touchbar/` | Becomes | Why |
|---|---|---|
| `react-drm-fork/` | git submodule → `https://github.com/iamawanishmaurya/react-drm-for-touchbar`, branch `touchbar-control-hardening` | the real project; history kept |
| `legacy/mtmr/` | git submodule → `https://github.com/iamawanishmaurya/one-mtmr-Linux.git` | user's own repo |
| `react-drm-deployed/` | **removed** | older copy of the fork; the live tree is on disk |
| `legacy/mtmr-designer/` | **removed**, linked in the README (`https://github.com/josmanvis/mtmr-designer`) | third-party, superseded |
| `reference/touchbar-reference/` | **removed**, linked (`https://github.com/loretoparisi/touchbar`) | third-party reference |
| `screenshots/`, `README.md`, `ORIGINAL-FOLDER-README.md` | kept | small, ours |

**Blocker check first:** a submodule only works if the commit is on GitHub.
```bash
git -C /home/Astra/opencode/touchbar/react-drm-fork log origin/touchbar-control-hardening -1 2>&1 | head -2
git -C /home/Astra/opencode/touchbar/mtmr status -sb | head -1
```
If the fork branch isn't pushed, or mtmr is ahead of its remote: **STOP and ask the user**
"push `touchbar-control-hardening` to origin (and mtmr's commits)?". Do not push yourself
without that yes. If the user says no, do only steps 3–5 (index + stale notes) and leave
the snapshot as is.

## Steps

1. Branch: `cd /home/Astra/opencode/zcode/my-t2-fix && git switch -c touchbar-links`.
2. Replace folders (only after the blocker check passes):
   ```bash
   git rm -r --cached touchbar 2>/dev/null; rm -rf touchbar/react-drm-fork touchbar/react-drm-deployed touchbar/legacy touchbar/reference
   git submodule add -b touchbar-control-hardening https://github.com/iamawanishmaurya/react-drm-for-touchbar touchbar/react-drm-fork
   git submodule add https://github.com/iamawanishmaurya/one-mtmr-Linux.git touchbar/mtmr
   ```
   (Check `rm -rf` targets with `ls` first; the snapshot is the only thing deleted — the
   real repos under `/home/Astra/opencode/touchbar/` are not touched.)
3. Write `touchbar/TROUBLESHOOTING-INDEX.md`: one table, columns **Symptom | Likely cause | Fix | Details**.
   Sources to merge — read all of them fully:
   - `touchbar/react-drm-fork/TROUBLESHOOTING.md` (issues 1–24 + Known EPIPE + appendix)
   - `touchbar/mtmr/docs/TROUBLESHOOTING.md` (19 issues)
   - `research/t2linux/04-touchbar.md`, `research/t2linux/14-touchbar-userland.md`
   - `research/t2-audio-fix/SUMMARY.md` (audio stall → WirePlumber hang → bar freeze)
   Group rows under: *Panel black / frozen*, *Taps / keys*, *After suspend*, *Install / build*,
   *Audio-related*, *Editor (touchbar-control / config-gui)*. One row per distinct symptom;
   merge duplicates (e.g. "frozen on old frame" appears in both troubleshooting files) and
   link every source. Replace any `mtmr --recover` fix with `sudo react-drm-recover`
   (note the old command in the cause column only if it still matters).
4. Update `touchbar/README.md`: new layout (submodules, removed folders with their upstream
   links), `git clone --recurse-submodules` / `git submodule update --init` instructions,
   link to `TROUBLESHOOTING-INDEX.md` in "Start here", drop the "refresh this snapshot"
   rsync section, update "Known open issues" with what Phases 1–3 fixed (read their REPORT files).
5. Stale notes — add a one-line dated banner at the top, don't rewrite history:
   - `touchbar/mtmr/docs/HANDOFF.md` lives in the mtmr repo → **don't edit it here**; list it in the report for the user.
   - `touchbar/ORIGINAL-FOLDER-README.md`: `> Historical (2026-09-28). Recovery is now `sudo react-drm-recover`; see README.md.`
6. Root `README.md` layout block: `touchbar/` line says "index + submodules".
7. Link check:
   ```bash
   cd /home/Astra/opencode/zcode/my-t2-fix
   for f in README.md touchbar/README.md touchbar/TROUBLESHOOTING-INDEX.md research/t2linux/04-touchbar.md research/t2linux/14-touchbar-userland.md; do
     d=$(dirname "$f"); grep -o '](\([^)#]*\)' "$f" | sed 's/](//' | grep -v '^http' | while read l; do [ -n "$l" ] && [ ! -e "$d/$l" ] && echo "BROKEN $f -> $l"; done
   done; echo done
   ```
8. Commit: `docs(touchbar): link the real repos as submodules; add troubleshooting index`.

## Done when

- [ ] Blocker check output pasted (and the user's answer if asked)
- [ ] `du -sh touchbar` and `git submodule status` pasted
- [ ] Every issue from both TROUBLESHOOTING files appears in the index — prove it: list the source issue numbers and the index row each maps to
- [ ] Link check prints only `done`
- [ ] `git status --short` clean after commit; nothing pushed
- [ ] `REPORT-PHASE-4.md` written in **react-drm-fork/.planning/hardening/**
