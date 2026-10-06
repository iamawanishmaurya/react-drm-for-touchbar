# REPORT — Phase 5: Where does `write EPIPE` come from?

**Status: PASS (pending user check)**

Date: 2026-10-06 · Branch: `touchbar-control-hardening` · Commit: `18d05b6`
Findings: `.planning/hardening/FINDINGS-EPIPE.md`

Cause identified, fixed, and documented. The decisive root-vs-user reproduction needs root
and is a USER RUN.

---

## Step 1 — evidence

```
$ journalctl -u react-drm -b --no-pager | grep -n -B3 -A25 'EPIPE'
● ERROR hot-reload   uncaught exception (process survived): Error: write EPIPE
    at Socket._writeGeneric (node:net:1324:11)
    at Writable.write (node:internal/streams/writable:512:10)
    at auth (…/node_modules/dbus-next/lib/handshake.js:67:10)
    at Socket.<anonymous> (…/node_modules/dbus-next/lib/connection.js:126:32)
  errno: -32, code: 'EPIPE', syscall: 'write'
```

`src/dev/hot-reload.ts:114` logs `(process survived)`.

**It is not once per start.** The spec assumed it was. 6 occurrences across 2 starts:

```
Oct 06 19:26:54    ← 7 s after start 19:26:47
Oct 06 20:06:46
Oct 06 20:27:58
Oct 06 20:46:27
Oct 06 21:13:15
Oct 06 22:32:29    ← 4 s after start 22:32:23
```

## Step 2 — D-Bus connections

13 call sites. Bus, and whether an error handler was attached:

| File | Bus | Handler before fix |
|---|---|---|
| `activeWindow/gnome.ts`, `activeWindow/detect.ts` ×2, `activeWindow/plasma.ts` | session | no |
| `hooks/useKonsole.ts`, `useDolphin.ts`, `useMediaPlayers.ts`, `useVlc.ts`, `useGwenview.ts` | session | no |
| `hooks/useBattery.ts`, `useTouchIdStatus.ts`, `services/suspend.ts`, `lock/logind.ts` | system | no |

```
$ grep -rn "bus.on('error'" lib | grep -v node_modules
NONE — every D-Bus call site is unguarded
```

## Root cause

`handshake.js:67` is `stream.write('\0')` — the **first byte of the SASL handshake** —
reached from `connection.js:126`, the socket's `connect` handler. EPIPE there means the
daemon closed the connection before we authenticated.

dbus-next connects lazily, so the codebase's `try { dbus.sessionBus() } catch {…}` guards
**cannot** catch this: the function has already returned by the time the socket connects,
and the error arrives as an `error` event on the bus. With no listener attached, Node
re-emits it as an `uncaughtException` — which is how a background feature's connection
failure reaches the journal.

Probable trigger: the service runs as **root** with
`DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus`. The socket is world-accessible
(`srw-rw-rw-`) so root can open it, but `EXTERNAL` auth rejects the uid mismatch.

```
$ DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus node -e "…GetId…"
SESSION BUS OK as uid 1000 -> ["aa071f9205d78db049ba24d92449e039"]
```

Works as the user. The root half is USER RUN below.

## Steps 4–5 — fix implemented

`lib/utils/dbusSafe.ts`: `openBus(kind, label)` opens the bus and always attaches an
`error` handler that logs one warning. All 13 call sites now use it.

### Red before green

RED — the pre-fix pattern:

```
PRE-EMIT listeners=0
EMIT THREW SYNCHRONOUSLY: EPIPE write EPIPE
```

GREEN — through `openBus`:

```
[01:07:39] ● WARN  dbus   test: session bus failed — EPIPE write EPIPE
listeners=1 uncaught=null
```

### Tests and typecheck

```
$ npx tsx --test tests/dbusSafe.test.ts
✔ openBus attaches an error listener to every bus it opens (273ms)
✔ a dead bus reports through the handler, not as an uncaughtException (310ms)
✔ no call site creates a bus without the handler (3.8ms)
ℹ tests 3  ℹ pass 3  ℹ fail 0

$ npx tsc                                    # library
root_tsc=0
$ npx tsx --test tests/*.test.ts
ℹ tests 3  ℹ pass 3  ℹ fail 0

$ cd linux-touchbar-control-center && npm test
app_exit=0
ℹ tests 61  ℹ pass 61  ℹ fail 0        # 58 baseline + 3 new

$ npx tsc --noEmit -p tsconfig.json
app_tsc=0

$ NO_RESTART=1 ./deploy.sh
staged (no restart)
```

### Docs updated

`TROUBLESHOOTING.md`'s "Known: `write EPIPE`" entry now records the cause, the fact that
it is not once-per-start, and the fix.

---

## Done-when status

| Item | Status |
|---|---|
| First full EPIPE stack trace pasted | **done** |
| Root cause with file:line + proving evidence | **done** — the root-vs-user half is USER RUN |
| `FINDINGS-EPIPE.md` with options + recommendation | **done** |
| If fixed: tests/typecheck pass, committed, USER CHECK | **done** except the USER CHECK |
| `TROUBLESHOOTING.md` updated | **done** |
| `REPORT-PHASE-5.md` | **done** (this file) |

---

## USER RUNS (PENDING)

The decisive test, and the fix's confirmation. Needs root:

```bash
# A. Does root get what uid 1000 does not?
sudo env DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus node -e "
const dbus=require('/home/Astra/opencode/react-drm/linux-touchbar-control-center/node_modules/dbus-next');
const b=dbus.sessionBus(); b.on('error',e=>console.log('bus error:',e.code,e.message));
setTimeout(()=>{console.log('done');process.exit(0)},3000)"
#    → EPIPE / auth error here (and not as the user) confirms the hypothesis

# B. After the Phase 3 restart has loaded the fix:
journalctl -u react-drm -b --since '-2 min' | grep -c EPIPE
#    → 0 instead of "uncaught exception (process survived)"
```

---

## Noticed, not touched

1. **The fix silences the symptom, not the auth failure.** Root still cannot authenticate
   to the user's session bus; any feature that genuinely needs it still does not work as
   root. `FINDINGS-EPIPE.md` options B–D cover the real fixes, with trade-offs. B
   (authenticate as the user, reusing the desktop-user lookup `bridge.ts` already has) is
   the recommendation if those features turn out to matter.

2. **`getProxyObject` resolves before the handshake completes**, so a call site can look
   successful and then fail later. I could not reproduce the EPIPE against a fake socket —
   the timing never lined up — so the mechanism is established from the stack, the
   dbus-next source and the unguarded call sites rather than from a local repro. The root
   reproduction above closes that gap.

3. **`dbusSafe.ts` calls `createLogger('dbus')` at module load**, matching `suspend.ts`'s
   convention. Under the compiled service this is fine; nothing was tested against
   `node dist/`.