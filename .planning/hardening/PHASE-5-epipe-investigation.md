# Phase 5 — Where does `write EPIPE` on every start come from?

**Goal:** identify the exact code path behind the `write EPIPE` error logged on every
react-drm start since 2026-09-28 (documented as "Known: `write EPIPE` on every start" in
`TROUBLESHOOTING.md`). Deliver a findings document. Fix it **only** if the fix is ≤ ~20
lines in our own code; otherwise propose it.

Read `.planning/hardening/README.md`. Read-only on the running system: no restarts by you.

## What is known

- Logged on each start; the bar keeps working ("process survived").
- A `dbus-next` stack trace with EPIPE was seen 2026-10-05 → prime suspect: a D-Bus
  connection written to after its socket closed. The app uses `dbus-next`
  (`npm:@jellybrick/dbus-next`) — find every place that creates a bus:
  `grep -rn "dbus-next\|sessionBus\|systemBus" linux-touchbar-control-center --include='*.ts' --include='*.tsx' | grep -v node_modules`
- The service runs as **root** with `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus`.
  Root connecting to a user's session bus is commonly rejected (EXTERNAL auth uid mismatch)
  → the bus closes the socket → the next write gets EPIPE. Check this hypothesis first.

## Steps

1. Collect evidence:
   ```bash
   journalctl -u react-drm -b --no-pager | grep -n -B3 -A25 'EPIPE' | head -120
   grep -rn "survived" linux-touchbar-control-center lib src --include='*.ts' --include='*.tsx' | grep -v node_modules
   ```
   Paste the first full stack trace.
2. From the stack trace + grep, list each D-Bus connection: file, bus (session/system), what it's for.
3. Reproduce **outside the service**, as a preview, as your normal user (no root):
   `cd linux-touchbar-control-center && timeout 20 npm run dev:preview 2>&1 | grep -n -A20 EPIPE`
   Then reproduce the root case without touching the service — this needs root, so it is
   USER RUNS, print it:
   ```bash
   sudo env DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus node -e "
   const dbus=require('/home/Astra/opencode/react-drm/linux-touchbar-control-center/node_modules/dbus-next');
   const b=dbus.sessionBus(); b.on('error',e=>console.log('bus error:',e.code,e.message));
   setTimeout(()=>{console.log('done');process.exit(0)},3000)"
   ```
   EPIPE / auth error as root but not as the user → hypothesis confirmed.
4. Write `.planning/hardening/FINDINGS-EPIPE.md`: the stack, the exact file:line that opens
   the failing connection, root cause, evidence, and the fix options with trade-offs. Likely
   options (verify, don't copy blindly):
   - connect to the session bus with the user's credentials (dbus-next `authMethods`, or
     drop to the desktop user for that connection — `bridge.ts` already finds the desktop
     user for the socket chown);
   - attach a `bus.on('error')` handler so it fails quietly and the feature degrades with one log line;
   - run the service as the user (bigger change — the user-unit path `install.sh` already supports).
5. If the fix is small and in our code (e.g. a missing `error` handler + one clear log line):
   implement it, add a test if the code is testable without a bus, deploy with
   `NO_RESTART=1 ./deploy.sh`, and add a USER CHECK. Otherwise stop at the findings.

## Done when

- [ ] First full EPIPE stack trace pasted
- [ ] Root cause stated with file:line, and the evidence that proves it (step 3 outputs)
- [ ] `FINDINGS-EPIPE.md` written with options + a recommendation
- [ ] If fixed: tests/typecheck pass (pasted), commit `fix(bar): …`, USER CHECK `journalctl -u react-drm -b --since '-2 min' | grep -c EPIPE` → `0` after a restart (PENDING)
- [ ] `TROUBLESHOOTING.md` "Known: write EPIPE" entry updated with the cause (and the fix if done)
- [ ] `REPORT-PHASE-5.md` written
