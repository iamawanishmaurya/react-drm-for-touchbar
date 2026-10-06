# Phase 3 — This machine: compiled bar + MTMR-free recovery

**Goal:** on this laptop,
1. `react-drm.service` runs `node dist/index.js` instead of compiling with `tsx` on every
   start (faster restarts, less CPU — recommended in
   `my-t2-fix/docs/CPU-STRESS-ANALYSIS.md`);
2. panel recovery uses `/usr/local/sbin/react-drm-recover` (tested on this hardware
   2026-10-05) instead of `/usr/bin/mtmr --recover`, in the service **and** in the
   watchdog/suspend units.

Prerequisites: Phases 1–2 PASS (user checks confirmed). Read `.planning/hardening/README.md`.
**Every `sudo` line here is USER RUNS** — print it, wait for the user's output.

## Facts you need

- Current unit: `/etc/systemd/system/react-drm.service` + `react-drm.service.d/override.conf`
  (see `systemctl cat react-drm`). Keep both files untouched; add a new drop-in.
- `config.ts` → `dist/config.js`: touchbar-control's Apply and config-gui already refresh
  `dist/config.js` after writing `config.ts` (`config-gui/main/configEngine.ts`, "refreshing
  dist/config.js"), so a compiled bar still picks up Apply. Verify, don't assume (step 5).
- `react-drm-recover` **restarts react-drm** unless given `--no-restart`. As an
  `ExecStartPre` it **must** use `--no-restart`, or every start restarts itself in a loop.

## Steps

### A. Make `deploy.sh` rebuild the app (repo change, no sudo)
After the existing library build in `deploy.sh`, add an app build in the destination so a
deploy updates `dist/`:
```bash
(cd "$DST/linux-touchbar-control-center" && npx tsc -p tsconfig.json && npx tsc-alias -p tsconfig.json && cp -r assets dist/) \
  || echo "WARNING: app build failed — the compiled bar is stale"
```
Do **not** use the app's `npm run build` there: it does `rm -rf dist`, which would delete
`dist/config.js` (built from the user's `config.ts`) if the compile then fails. Check that
`tsc -p` output dir is `dist` (read `linux-touchbar-control-center/tsconfig.json` +
the root `tsconfig.json` it extends) and that `config.ts` is included in the compile.
Commit: `chore(deploy): rebuild the app's dist so a compiled service picks up deploys`.

### B. Build once and smoke-test the compiled bar as a **preview** (no sudo, no hardware)
```bash
cd /home/Astra/opencode/touchbar/react-drm-fork && NO_RESTART=1 ./deploy.sh
cd /home/Astra/opencode/react-drm/linux-touchbar-control-center
ls -la dist/index.js dist/config.js
REACT_DRM_BACKEND=preview NODE_ENV=production timeout 15 node dist/index.js 2>&1 | tail -20
```
Expected: starts, prints the preview URL / no stack trace, killed by `timeout` (exit 124).
If it crashes: STOP, report the output.

### C. USER RUNS — switch the service (print this block exactly)
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
`install-recovery.sh` installs `/usr/local/sbin/react-drm-recover`, `touchbar-watchdog.sh`,
and rewrites `touchbar-recover.service` / `touchbar-watchdog.service` to use them.

### D. Verify (no sudo needed)
```bash
systemctl cat react-drm | grep -E '^Exec'
systemctl show react-drm -p ExecMainStartTimestamp -p NRestarts
journalctl -u react-drm -b --since '-2 min' --no-pager | tail -30
systemctl cat touchbar-watchdog touchbar-recover | grep -E '^Exec'
grep -n mtmr /usr/local/sbin/touchbar-watchdog.sh || echo "no mtmr in watchdog"
ls -la /usr/sbin/touchbar-watchdog.sh 2>/dev/null && echo "OLD script still present (unused?)"
```
If an old `/usr/sbin/touchbar-watchdog.sh` exists and no unit references it, list it in
the report for the user to delete — do not delete it yourself.

### E. Rollback (put in the report, don't run unless the bar fails)
```bash
sudo rm /etc/systemd/system/react-drm.service.d/20-compiled.conf
sudo systemctl daemon-reload && sudo systemctl restart react-drm
```

## Done when

- [ ] Step A committed; step B output pasted (exit 124, no stack trace)
- [ ] User ran C; `systemctl is-active react-drm` → `active`
- [ ] D: `ExecStart` shows `node dist/index.js`, `ExecStartPre` shows `react-drm-recover --no-restart`; the watchdog/recover units reference `/usr/local/sbin`; `no mtmr in watchdog`
- [ ] Journal since restart: no stack traces; `NRestarts` doesn't increase over 2 minutes (run `systemctl show -p NRestarts react-drm` twice, 2 min apart)
- [ ] Restart time compared: before (from the journal of an earlier tsx start, "Started" → first frame/log line) vs after — paste both
- [ ] USER CHECK (PENDING): bar shows and responds; suspend + resume once → bar returns within ~15 s; `sudo react-drm-recover` by hand → bar returns
- [ ] USER CHECK (PENDING): in touchbar-control, the user (not the agent) does one harmless Apply (e.g. move one button and back) → the bar shows the change after restart, proving `dist/config.js` refresh works with the compiled service
- [ ] `REPORT-PHASE-3.md` written, with the rollback block
