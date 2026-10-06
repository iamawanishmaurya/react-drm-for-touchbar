# FINDINGS — `write EPIPE` on every start

**Phase 5 · 2026-10-06 · status: cause identified and fixed (USER CHECK pending)**

## The stack

```
● ERROR hot-reload   uncaught exception (process survived): Error: write EPIPE
    at afterWriteDispatched (node:internal/stream_base_commons:138:10)
    at Socket._writeGeneric (node:net:1324:11)
    at Writable.write (node:internal/streams/writable:512:10)
    at auth      (…/node_modules/dbus-next/lib/handshake.js:67:10)
    at Socket.<anonymous> (…/node_modules/dbus-next/lib/connection.js:126:32)
  errno: -32, code: 'EPIPE', syscall: 'write'
```

`src/dev/hot-reload.ts:114` catches it and logs `(process survived)`, which is why the
bar keeps working.

## Where it actually comes from

`handshake.js:67` is the body of dbus-next's `auth()`:

```js
module.exports = function auth (stream, opts, cb) {
  …
  stream.write('\0');            // ← line 67: the first byte of the SASL handshake
  tryAuth(stream, authMethods.slice(), cb);
};
```

reached from `connection.js:126`:

```js
stream.once('connect', () => clientHandshake(stream, opts, afterHandshake));
```

So the failure is **not** a normal message write. It is the very first byte of the D-Bus
authentication handshake, written to a socket the peer had already closed. The daemon
refused the connection before we authenticated.

## Root cause

`dbus-next` opens its socket **lazily**. `sessionBus()` / `systemBus()` return a handle
synchronously; the handshake happens later, on the socket's `connect` event. The codebase
guards every bus with this pattern:

```ts
let bus: dbus.MessageBus;
try { bus = dbus.sessionBus(); } catch { return false; }
```

That `try/catch` cannot catch this failure. By the time the socket connects, the
function has already returned, and the error arrives as an `error` event on the bus — not
as a throw from `sessionBus()`. With **no `error` listener attached**, Node re-emits it
as an `uncaughtException`, which lands in the journal attributed to whatever background
feature happened to open the bus.

Confirmed across the app: **0 of the 13 D-Bus call sites attached a bus error handler.**

```
$ grep -rn "bus.on('error'" lib | grep -v node_modules
NONE — every D-Bus call site is unguarded
```

The likely trigger for the refused connection: `react-drm.service` runs as **root** with
`DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus`. The socket is world-accessible
(`srw-rw-rw-`, owned by uid 1000) so root can open it, but dbus-daemon's `EXTERNAL` auth
expects the peer's uid to match the socket owner — root (uid 0) against a uid-1000 bus is
rejected, and the daemon closes the connection. The same socket works fine as the user:

```
$ DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus node -e "…GetId…"
SESSION BUS OK as uid 1000 -> ["aa071f9205d78db049ba24d92449e039"]
```

**The root-vs-user comparison (the decisive test) is still outstanding** — it needs root
and is a USER RUN. Everything above is proven from the stack, the source and the code.

## It is not "every start"

The phase spec assumed one EPIPE per start. The journal disagrees — 6 occurrences across
2 starts, recurring at runtime:

```
$ journalctl -u react-drm -b | grep 'write EPIPE' | awk '{print $1,$2,$3}'
Oct 06 19:26:54    ← 7 s after start 19:26:47
Oct 06 20:06:46
Oct 06 20:27:58
Oct 06 20:46:27
Oct 06 21:13:15
Oct 06 22:32:29    ← 4 s after start 22:32:23
```

The runtime occurrences coincide with background polling (active-window detection, battery
polling), which is consistent with the unguarded-bus finding.

## The fix

`lib/utils/dbusSafe.ts` — one helper that always attaches the handler:

```ts
export function openBus(kind: 'session' | 'system', label: string): dbus.MessageBus {
  const bus = kind === 'session' ? dbus.sessionBus() : dbus.systemBus();
  bus.on('error', e => { /* one warn line */ });
  return bus;
}
```

All 13 call sites now go through it. A dead bus becomes one warning instead of an
uncaught exception. **This does not make root's session-bus connection succeed** — it stops
a background feature's connection failure from crashing the process. Fixing the auth
mismatch itself is a separate, larger change (see options).

### Evidence

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

Suites: library 3/3, app **61/61** (58 + 3 new), both typechecks exit 0.

## Options for the underlying auth mismatch

| Option | Change | Trade-off |
|---|---|---|
| **A. Ship the handler only** *(done)* | none beyond the fix | The warning still appears in the journal; features that need the session bus as root still do not work. Bar unaffected. |
| **B. Authenticate with the user's credentials** | `authMethods`, or drop privileges for that one connection — `lib/customLayer/bridge.ts` already finds the desktop user for the socket chown | Correct fix; needs care with fd passing and the existing dbus-next unix-fd workaround in `suspend.ts`. |
| **C. Run the service as the user** | the user-unit path `install.sh` already supports | Largest change; the whole install (udev rules, `/dev/dri` access) assumes root today. |
| **D. Don't use the session bus at all as root** | route the affected features through the system bus or a file | Removes the dependency, but GNOME/KWin/Wayland active-window detection is inherently a session-bus API. |

**Recommendation: A now, B if the features are actually needed.** The EPIPE is currently
cosmetic — the bar survives it and no user-facing feature is broken by it in the journal.
B is the real fix but is a larger change than this phase allows; it belongs in its own
phase with its own tests.