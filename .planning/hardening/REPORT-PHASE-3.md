# REPORT — Phase 3: Compiled bar + MTMR-free recovery

**Status: BLOCKED (repo work complete; needs the user to run the sudo block)**

Date: 2026-10-06 · Branch: `touchbar-control-hardening` · Commit: `412b2a0`

Steps A and B — everything in this phase that does not require root — are done and
verified. Step C is `sudo` and is yours alone. Steps D and E follow it.

---

## What changed

`deploy.sh` now rebuilds the app's `dist/` in the destination after the library build, so
a compiled service picks up a deploy.

## Evidence

### Step A — committed

```
$ git show --stat 412b2a0
 deploy.sh | 15 +++++++++++++++
```

Two deliberate choices, both commented in the file:

- **Placed after the copies, not straight after the library build** as the spec suggested.
  Building earlier would compile the destination's *previous* `index.tsx` — the entry file
  is copied further down the script.
- **Not `npm run build`.** That script is `… && rm -rf dist && tsc …`; if the compile
  then failed, the bar would be left with no `dist/config.js` — built from the user's live
  `config.ts`, which lives only in `$DST` and is never restored by a deploy. The
  replacement overwrites in place.

Verified against the spec's own instruction: `tsc -p` output dir is `dist`
(`outDir: "./dist"`), and `config.ts` **is** in the compile (`include: ["./**/*"]`,
`exclude: ["node_modules","dist","tests"]`).

### Step B — compiled bar smoke-tested as a preview (no root, no hardware)

```
$ cd /home/Astra/opencode/touchbar/react-drm-fork && NO_RESTART=1 ./deploy.sh
staged (no restart)

$ cd /home/Astra/opencode/react-drm/linux-touchbar-control-center
$ ls -la dist/index.js dist/config.js
-rw-r--r-- 1 Astra Astra 15099 Oct  7 00:55 dist/config.js
-rw-r--r-- 1 Astra Astra 12858 Oct  7 00:55 dist/index.js
$ ls dist/assets/
kbd_illum_down.svg
kbd_illum_up.svg

$ grep -c 'require("@/' dist/index.js
0                       ← tsc-alias rewrote every @/ alias

$ REACT_DRM_BACKEND=preview NODE_ENV=production timeout 15 node dist/index.js
exit=124
…
[00:55:25] ● INFO  display  preview display ready: 2008×60 (no hardware)
[react-drm] lid is open
[00:55:25] ● INFO  custom-layer-bridge custom-layer bridge listening at …-preview-8787.sock
[00:55:25] ● INFO  preview-server running at http://127.0.0.1:8787
```

**Exit 124** (killed by `timeout`), no stack trace — exactly what the spec requires.

### Step C — USER RUNS (not done; needs sudo)

```bash
sudo install -d /etc/systemd/system/react-drm.service.d
sudo tee /etc/systemd/system/react-drm.service.d/20-compiled.conf >/dev/null <<'EOF'
# Run the prebuilt bar (deploy.sh rebuilds dist/) and recover the panel with
# react-drm-recover --no-restart (it must not restart the unit it runs in).
[Service]
ExecStartPre=
ExecStartPre=/usr/local/sbin/react-drm-recover --no-restart
ExecStart=
ExecStart=/bin/sh -c 'cd /home/Astra/opencode/react-drm/linux-touchbar-control-center && PATH="/home/Astra/.nvm/versions/node/v26.10.0/bin:/usr/bin:/bin" DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus XDG_RUNTIME_DIR=/run/user/1000 REACT_DRM_BACKEND=drm NODE_ENV=production exec node dist/index.js'
EOF
sudo /home/Astra/opencode/touchbar/react-drm-fork/packaging/install-recovery.sh
sudo systemctl daemon-reload
sudo systemctl restart react-drm
sleep 8; systemctl is-active react-drm
```

`--no-restart` is mandatory: `react-drm-recover` restarts the unit by default, so as a bare
`ExecStartPre` it would restart itself in a loop.

This restart also retires the pending USER CHECKs for **Phases 1, 2 and 5** — all three
fixes are staged in the install and none is live until the bar restarts.

### Step D — verify (no sudo; run after C)

```bash
systemctl cat react-drm | grep -E '^Exec'
systemctl show react-drm -p ExecMainStartTimestamp -p NRestarts
journalctl -u react-drm -b --since '-2 min' --no-pager | tail -30
systemctl cat touchbar-watchdog touchbar-recover | grep -E '^Exec'
grep -n mtmr /usr/local/sbin/touchbar-watchdog.sh || echo "no mtmr in watchdog"
ls -la /usr/sbin/touchbar-watchdog.sh 2>/dev/null && echo "OLD script still present (unused?)"
```

Expect `ExecStart` to show `node dist/index.js` and `ExecStartPre` to show
`react-drm-recover --no-restart`. If an old `/usr/sbin/touchbar-watchdog.sh` exists and no
unit references it, it is listed above for **you** to delete — I will not delete it.

### Step E — rollback (do not run unless the bar fails)

```bash
sudo rm /etc/systemd/system/react-drm.service.d/20-compiled.conf
sudo systemctl daemon-reload && sudo systemctl restart react-drm
```

---

## Done-when status

| Item | Status |
|---|---|
| Step A committed | **done** (`412b2a0`) |
| Step B output pasted (exit 124, no stack trace) | **done** |
| User ran C | **PENDING — needs you** |
| D: ExecStart / ExecStartPre / no mtmr | blocked on C |
| NRestarts stable over 2 min | blocked on C |
| Restart time before vs after | blocked on C |
| USER CHECK: bar responds; suspend/resume; `sudo react-drm-recover` | blocked on C |
| USER CHECK: one touchbar-control Apply still refreshes `dist/config.js` | blocked on C — **you** must do this, I never press Apply |
| `REPORT-PHASE-3.md` | done (this file) |

---

## Noticed, not touched

1. **The mtmr HANDOFF contradicts the hardening README on sudo.** `mtmr/docs/HANDOFF.md:69`
   says "Passwordless sudo is configured"; `.planning/hardening/README.md:34` says sudo is
   **not** passwordless and only the user runs it. `deploy.sh:41` also carries the comment
   "passwordless sudo configured". One of these is wrong. It matters — the whole reason
   every phase says USER RUNS is that sudo is not available to me. Worth resolving.

2. **Phase 4's index already carries a transition-state callout** saying the installed
   units still call `/usr/bin/mtmr --recover`. That is accurate today and becomes wrong the
   moment you run step C; I will update it when you confirm.

3. **`tsc-alias` is resolved from the install's `node_modules`**, not from the app's. If the
   install is ever reinstalled without it, the deploy's app build fails and falls back to
   the `WARNING:` line — the bar keeps running the previous `dist/`.