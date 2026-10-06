# react-drm-for-touchbar — Troubleshooting

Real-world problems hit while deploying and running this project on a
**MacBookPro16,2 (T2, Arch Linux, niri)** — each with the symptom, root cause,
and the fix that worked. Several of these are patched in code here; the rest
are environment requirements.

## 1. Startup fails: "Cannot open keyboard device: /dev/input/eventNN"

**Symptom:** the process exits immediately with `Cannot open keyboard device`
even though the Touch Bar touchpad clearly exists.

**Cause:** two Touch Bar HID nodes can coexist. After a USB re-authorization
the T2's iBridge re-enumerates `Apple Inc. Touch Bar Display` — a *keyboard*
HID node — alongside `Apple Inc. Touch Bar Display Touchpad`. The old
`/Touch Bar/i` matcher picked whichever appeared first in
`/proc/bus/input/devices`, which was the keyboard. Also: the event number
**changes across reboots** — never hardcode it.

**Fix (code, patched here):** prefer a block matching
`Touch Bar.*Touchpad`; fall back to any `Touch Bar` node only if no touchpad
exists.

**Also check permissions:** the device is `root:input 0660`. Run the daemon as
a user in the `input` group, or add a udev rule
(`KERNEL=="event*", ATTRS{name}=="…", TAG+="uaccess"`).

## 2. App stuck on the React splash forever (root + D-Bus)

**Symptom:** DRM display initializes fine, but the UI never mounts past the
React logo — and the log fills with

```
Error: ENOENT ... open '/root/.dbus/session-bus/<machine-id>-0'
at ... dbus-next/lib/address-x11.js
```

**Cause:** the media-player widget connects to the *session* bus at mount.
When the daemon runs as root, dbus-next looks for root's session-bus file,
which doesn't exist; the unhandled exception takes down the layout before it
renders.

**Fix:** give the process the real user's session bus:

```ini
# in the systemd unit (or shell env)
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
Environment=XDG_RUNTIME_DIR=/run/user/1000
```

The same env is required by `launch()` so dock app spawns reach the
compositor. If the service runs as root and spawns session GUI apps, also set
`SUDO_USER=<user>` and `SUDO_UID=1000` — `launch.ts` uses them to `runuser`
into the graphical session.

## 3. Brightness sliders render but do nothing

**Symptom:** both sliders (display ☀ and keyboard ⌨) draw at a stuck 50% and
dragging changes nothing — no errors in the log.

**Cause:** `brightnessctl` was not installed. Reads fell back to a fake 0.5
and writes were silently swallowed (`execFile` callback ignored the error).

**Fix:** `pacman -S brightnessctl` (Debian/Fedora: same package name).
**Patched here:** a missing/broken brightnessctl now logs a loud one-time
error instead of failing silently.

## 4. Keyboard backlight device has a leading colon

The keyboard LED is `/sys/class/leds/:white:kbd_backlight` — **the name
starts with a colon** (empty LED color prefix). Auto-detection by substring
`kbd_backlight` handles it; don't match by exact name `white:kbd_backlight`
(it doesn't exist on this machine).

## 5. Startup fails: "drmModeSetCrtc failed — display may be in use by a compositor"

**Symptom:** after killing a previous Touch Bar daemon (or after it crashed),
react-drm can't claim the panel even though nothing else is running.

**Cause:** the dead daemon's framebuffer/plane state persists in the kernel,
and a stale display session on the iBridge can refuse new legacy modesets.

**Fix:** re-initialize the display session before starting — rebind the
driver, e.g.:

```sh
echo "5-6:2.1" | sudo tee /sys/bus/usb/drivers/appletbdrm/unbind
sleep 1
echo "5-6:2.1" | sudo tee /sys/bus/usb/drivers/appletbdrm/bind
```

then start react-drm. In a systemd unit, run this as `ExecStartPre=`.
Never leave two Touch Bar daemons enabled at once — set
`Conflicts=tiny-dfr.service mtmr.service` (and any other daemon) in the unit.

## 6. Preview server: `EADDRINUSE 127.0.0.1:8787`

**Symptom:** `REACT_DRM_BACKEND=preview` instance dies (or runs headless
without serving) with address-in-use.

**Cause:** a previous preview instance (or another react-drm instance) is
still bound to 8787.

**Fix:** kill lingering `tsx index.tsx` processes, or set
`REACT_DRM_PREVIEW_PORT=<other>` per instance.

## 7. Frame-rate/perf note

Rendering happens through Cairo into the DRM framebuffer; frames are pushed
on state change. Watch for error storms in the log (e.g. a crashing widget
hook) — they throttle the render loop and make the bar feel stuck even though
the process is alive.

## 8. Wrong "Touch Bar"-named input node causes tap-less bar

Related to #1: if the daemon binds the *keyboard* node instead of the
touchpad, the bar renders but taps do nothing. Diagnose with:

```sh
cat /proc/bus/input/devices   # find "Touch Bar Display Touchpad"
```

and confirm the node react-drm opened (check `/proc/<pid>/fd`) is the same one.''

## 9. Systembar: taps fire the wrong control ("tap to start" starts something else)

**Symptom:** opening the systembar (CPU stats page) and tapping the pomodoro
"tap to start" — or any control — triggers a *different* button's action,
typically one from the row that renders above/below it. The page has far more
content than 60px of bar height, stacked in a vertical column.

**Cause:** the overflowing rows are clipped visually (LayerHost has
`overflow: hidden`) but their **touch regions stay registered**. The
paint-order hit-test then resolves taps against invisible overlapping
buttons.

**Fix:** lay the systembar out as a single **horizontal strip** that fits
60px (back · pomodoro · audio visualizer · CPU · MEM · TEMP · NET · BAT ·
clock tiles side by side). Every visible pixel maps to exactly one touch
region. Rule of thumb for any layer: if content overflows the 60px bar,
its hidden touch regions are still tappable — never stack vertically
beyond the bar height.''

## 10. Panel frozen on an old frame while the daemon works fine ("shows old version")

**Symptom:** the renderer is healthy (touch regions register, taps are
processed, widgets update in memory) but the physical panel keeps displaying
a frame from hours/days ago. Taps "work" invisibly while the screen shows
stale content — the bar you SEE and the bar you TOUCH are two different things.

**Cause:** the appletbdrm driver stopped transmitting framebuffer updates —
the recurring stale-session problem on T2. Commonly triggered by
suspend/resume cycles or repeated daemon restarts.

**Diagnose (decisive):** the built-in screenshot combo captures the *internal
render buffer*, not the panel. Save one and look at it:

- Service runs as root → buffer captures land in `/root/touchbar/`:
  `sudo cp /root/touchbar/*.png ~/Pictures/touchbar/`
- If the capture shows the CURRENT UI (new buttons present) → renderer is
  fine, panel is stale → recovery below.
- If the capture shows an old layout → the renderer itself regressed; check
  recently edited files (the hot-reload watcher applies edits live).

**Fix:** reset the display session and restart:

```sh
sudo systemctl restart react-drm   # ExecStartPre rebinds appletbdrm
```

**Prevent (automated):** `./install.sh install --with-recovery` (or
`sudo packaging/install-recovery.sh`) installs `react-drm-recover` — rebinds
the Touch Bar display, found by USB id, and restarts react-drm — and two units:

- `touchbar-recover.service` — rebinds appletbdrm after every
  suspend/resume (fixes the common trigger).
- `touchbar-watchdog.service` — tails the kernel log for the stale-panel
  signature (`appletbdrm … *ERROR* Failed to send message (-110)`) and
  runs `react-drm-recover`, debounced to one recovery
  per 10 minutes (`/run/touchbar-watchdog/last-recover`). Log:
  `journalctl -t touchbar-watchdog`; recover output lands in
  `/var/log/touchbar-watchdog-recover.log`.

Limitation: the kernel only logs that signature when the USB transfer
actually times out; a silently frozen panel with no -110 errors isn't
detected (no userspace signal exists for that case). Manual fix remains:
`sudo mtmr --recover && sudo systemctl restart react-drm`.

## 11. Screenshot combo saves to /root when the service runs as root

The Ctrl+Alt+S combo calls `display.screenshot()` which writes to
`SCREENSHOT.dir` — resolved from the *daemon's* environment, so a root-run
service saves to `/root/touchbar/`. Either copy the files out
(`sudo cp /root/touchbar/*.png ~/Pictures/touchbar/`) or set
`SCREENSHOT.dir` in your `config.ts` to an absolute path like
`/home/<user>/Pictures/touchbar`.

## 12. Config edits deployed via deploy.sh don't take effect

**Symptom:** you fix something in `linux-touchbar-control-center/config.blueprint.ts`,
run `./deploy.sh`, the service restarts — and the old behavior is still there
(e.g. dock taps still spawning `dolphin`, which doesn't exist on this machine).

**Cause:** `configLoader.ts` prefers the *user* `config.ts` (seeded from the
blueprint by `install.sh`) and only falls back to `config.blueprint.ts`. The
live machine-local `config.ts` exists only in the deployed tree
(`/home/Astra/opencode/react-drm/linux-touchbar-control-center/`) and is not
tracked in this fork. `deploy.sh` (older version) also had a wrong source path
(`$SRC/config.blueprint.ts` at the fork root — no such file), so the blueprint
was never copied either.

**Fix:** patch BOTH files when changing defaults — `config.blueprint.ts` in
the fork (source of truth for future installs) and the deployed `config.ts`
(what actually runs). deploy.sh now documents this; it also uses the correct
blueprint path.

## 13. Dock icons render but taps "do nothing" (apps die before opening)

**Symptom:** after fixing the dock's commands (issue 12), tapping an icon
still opens no window — and `launch failed` never appears in the log because
the spawn itself succeeds; the app crashes microseconds later with stdio
ignored.

**Cause:** `launch()` dropped from root to the user with only
`XDG_RUNTIME_DIR`, `DBUS_SESSION_BUS_ADDRESS`, `DISPLAY` and
`WAYLAND_DISPLAY`. GTK4 needs **`XDG_SESSION_TYPE`** as well: with it unset
(the root service env doesn't have it) apps fail display init with
`Unsupported or missing session type 'unspecified'` and exit instantly.

**Fix (code, patched here):** when a Wayland socket is detected, launch()
now pushes `XDG_SESSION_TYPE=wayland` alongside `WAYLAND_DISPLAY`. Verified:
nautilus, ghostty and gnome-text-editor all launch under the exact service
env once it's set.

## 14. Dock taps register but no app launches, no error anywhere

**Symptom:** journal shows the dock icon tap landing (`tap in-bounds=true` on
the icon's bounds) yet no window appears and `launch failed` is never logged.

**Cause:** `launch()` only dropped to the user when `SUDO_USER`/`SUDO_UID`
were set. Those exist under a `sudo` dev run but **not** in the systemd unit
environment (they were documented as being there — they aren't). The else
branch then spawned the app **as root**, where it can't reach the user's
Wayland compositor and exits instantly — silently, since stdio is ignored.

**Fix (code, patched here):** when running as root, launch() now derives the
desktop session's uid from `/run/user/<uid>` (first dir owned by a real
user), resolves the username from /etc/passwd, and targets
`runuser -u <name>`. Note runuser REJECTS sudo-style `#<uid>` targets
(`user #1000 does not exist`) — the first patch attempt used that and still
failed silently; a test that succeeds under a sudo shell is not a valid test
because SUDO_USER leaks in. Reproduce the real environment with
`sudo env -i PATH=... HOME=/root ... <test>` and verify the process is
actually running. Verified end-to-end under the exact service env:
launch('nautilus') as root spawns Nautilus in the user session.

## 15. After lid close/open the bar shows the old UI (or nothing)

**Symptom:** wake from suspend and the panel holds the pre-suspend frame.

**Cause — three interacting problems (all fixed 2026-09-28 13:5x):**
1. A restart of react-drm that gets interrupted by the suspend (TERM during
   ExecStartPre) leaves the service in `failed`, and default start-rate
   limiting then keeps it dead — no bar at all after wake.
2. `touchbar-recover.service` used `try-restart`, which skips services that
   aren't running — so a failed react-drm stayed failed after wake.
3. The community `t2-suspend.service` runs `systemctl restart tiny-dfr` on
   resume; react-drm declares `Conflicts=tiny-dfr`, so that alone would stop
   react-drm and hand the panel to the legacy daemon.

**Fix:**
- drop-in `/etc/systemd/system/react-drm.service.d/override.conf`:
  `StartLimitIntervalSec=0` + `Restart=always`.
- recover unit: `ExecStartPost=/bin/systemctl restart react-drm.service`
  (unconditional).
- `systemctl mask tiny-dfr` — it's disabled and never wanted; the masked
  unit makes t2-suspend's restart a harmless no-op ('-' prefix ignores it).

## 16. Reordered buttons appear twice and squeezed

**Symptom:** after changing the button order *at runtime* (touchbar-control's
sandbox, or anything that re-renders a list in a new order without a restart),
every moved button is drawn twice and the row's buttons shrink to fit.

**Cause:** React moves an already-mounted child by calling `appendChild` /
`insertBefore` again **without removing it first** — DOM semantics, where
inserting a node that is already in the tree moves it. The reconciler's host
config only inserted, so the old copy stayed in the children array. It never
showed before because the order only ever changed at startup.

**Fix (library, patched here):** `src/renderer/child-order.ts`
(`appendMoving` / `insertMovingBefore`) detaches before inserting, for scene
nodes, SVG children and the root container. Regression test:
`tests/child-order.test.ts`.

## 17. SVG scene export is almost black / icon colours look wrong

**Symptom:** `GET /svg` (and mtmr-designer's canvas built on it) draws every
tile and background near-black; the bridge's camera and gamepad icons come out
blue-ish and pink instead of amber and green.

**Cause:** two unrelated slips. `parseColor()` returns 0–1 channels (Cairo's
convention) and `sceneToSvg()` wrote them straight into CSS `rgb()`, which
wants 0–255 — `#373737` became `rgb(0.2157,…)`. The bridge's colours had been
sampled from a BGRA frame read as RGB, so they were byte-reversed
(`#24bffb` for `#fbbf24`, `#80de4a` for `#4ade80`).

**Fix (patched here):** `svg-serialize.ts` scales to 0–255; the bridge and
DESIGNER.md use the colours from `layout.tsx`.

## 18. touchbar-control: tiles show a neighbour's pixels after a reorder

**Symptom:** right after dragging a button, some tiles show half of the button
next to them, and a button hidden at that moment keeps the wrong picture.

**Cause:** tiles crop the streamed frame at each widget's scene box. The scene
was polled every 250 ms while frames arrive at up to 30 fps, so during the
cluster's width animation a frame was cropped with a stale layout.

**Fix (patched here):** the sandbox sends each frame's scene immediately before
the frame (`frameScene` in `preview-server.ts`), and the page adopts a scene
only when it paints that frame (`web/src/lib/bar.ts`).

## 19. touchbar-control: the sandbox bar pressed real keys

**Symptom:** previewing the bar and tapping a browser or VS Code button acted
on the real focused window — e.g. close-tab closed a real tab.

**Cause:** the sandbox is the real app; its key injector, window focusing,
app launcher and the Konsole / Dolphin / Gwenview / VLC D-Bus commands act on
the desktop like the physical bar's do.

**Fix (patched here):** in a sandbox these are *simulated* by default
(`lib/services/sandboxActions.ts`) and reported in the page; **Real actions**
turns them back on. The physical bar is unaffected.

## 20. touchbar-control: taps don't register right after switching the previewed app

**Symptom:** the first tap within about a second of picking another app does
nothing.

**Cause:** the new left panel is drawn before its buttons register their touch
regions — the layer transition finishes first. Expected behaviour, same on the
hardware; tap again.

## 21. touchbar-control: the sandbox bar ignores every tap

**Symptom:** the live bar still animates and updates, but no tap has any
effect, on any layer.

**Seen once (2026-09-29), cause not found:** it could not be reproduced by any
sequence of app previews, drags or menu use afterwards. It looks like the
known "held touch locks the registry" failure (a touchstart that never got its
touchend).

**Fix:** **File → Reset sandbox bar** in touchbar-control (or
`curl -X POST http://127.0.0.1:3100/api/sandbox/restart`).

## 22. config-gui's Custom Layer editing stops reaching the physical bar

**Symptom:** config-gui's Custom Layer drag-and-drop does nothing on the
physical bar (no ghost widget), typically after a preview or touchbar-control
sandbox started.

**Cause — two problems:** every preview instance created its Custom Layer
socket at the *same* path as the real bar (`$XDG_RUNTIME_DIR/react-drm-custom-layer.sock`),
unlinking and taking it over; and when the service runs as root, its socket was
`root`-owned `0755`, which the desktop user (config-gui) can't connect to —
hidden until now because the sandbox kept re-creating it as the user.

**Fix (patched here):** preview instances use
`react-drm-custom-layer-preview-<port>.sock`, and a root service hands the
socket to the runtime dir's owner (`0600`), like the live layout socket.

## 23. Fresh install fails at "Building react-drm and the control center"

**Symptom:** `./install.sh` stops during the build with
`app/snake/page.tsx … error TS2322: Type 'number' is not assignable to type 'string'`.

**Cause:** the Snake scoreboard passed numbers as `<Text>` children. A
service that runs the TypeScript directly (`tsx index.tsx`) never type-checks,
so it went unnoticed; the installer's `npm run build` does.

**Fix (patched here):** the scoreboard renders template strings.

## 24. A preview/sandbox crashes with `EACCES … /tmp/.react-drm-icons/…`

**Symptom:** touchbar-control's sandbox never comes up; its log
(`/tmp/touchbar-control-sandbox.log`) shows
`EACCES: permission denied, open '/tmp/.react-drm-icons/<app>.svg'`.

**Cause:** the app-icon cache was one shared `/tmp` folder. A bar running as
root created it root-owned, so a user-run preview couldn't write converted
icons.

**Fix (patched here):** the cache is per user (`$TMPDIR/.react-drm-icons-<uid>`).

## Known: `write EPIPE` (cause found 2026-10-06 — fixed)

Logs `ERROR hot-reload uncaught exception (process survived): Error: write EPIPE`.
Predates touchbar-control (since 2026-09-28 16:22); the bar runs normally throughout.

**Cause:** dbus-next opens its socket lazily, so `try { dbus.sessionBus() } catch {…}`
cannot catch a handshake failure — the error arrives later as an `error` event on the bus,
and with no listener attached Node re-emits it as an `uncaughtException`. No D-Bus call
site attached one. The stack points at `handshake.js:67`, the first byte of the SASL
handshake, written to a socket the daemon had already closed — consistent with the service
running as root against the desktop user's session bus, where `EXTERNAL` auth is rejected
for the uid mismatch.

It is **not** once per start: 6 occurrences across 2 starts, recurring whenever a
background feature (active-window detection, battery polling) opens a bus.

**Fixed** by `lib/utils/dbusSafe.ts` — `openBus()` attaches an error handler to every bus,
so a dead bus is one warning line instead of an uncaught exception. The bar's behaviour is
unchanged; only the journal entry disappears. Making root's session-bus auth succeed is a
larger, separate change — see `.planning/hardening/FINDINGS-EPIPE.md`.

## Appendix: capturing what the bar shows (screenshots)

Two ways to screenshot the Touch Bar, both producing the real renderer output:

**A. Built-in combo (hardware path):** Ctrl+Alt+S on the keyboard — the app's
own listener saves its internal render buffer as PNG (config: `SCREENSHOT` in
config.blueprint.ts; lands in `~/Pictures/touchbar/`).

**B. Headless preview capture (scriptable, used for all docs screenshots):**

1. Start a preview instance — the same React app the bar runs, rendering to a
   websocket instead of the DRM framebuffer:

   ```sh
   cd <repo>/linux-touchbar-control-center      # run as your desktop user
   REACT_DRM_BACKEND=preview REACT_DRM_PREVIEW_PORT=8792 NODE_ENV=production \
   npx tsx index.tsx   # serves ws://127.0.0.1:8792/ws
   ```

2. Capture with `packaging/preview-capture.mjs`:

   ```sh
   cd <repo>/packaging
   PREVIEW_PORT=8792 node preview-capture.mjs previews/<name>.png
   ```

   Frame format: 16-byte little-endian header (width, height) then BGRA rows
   at 2008×60 — the script swaps BGR→RGB and writes a PNG.

3. Synthetic taps (e.g. open the games menu): append `x,y out2.png` pairs —
   the script sends `{type:"touchstart",x,y}` + `touchend` over the same ws
   (the button coordinates come from the bar geometry: the right cluster's
   gamepad button was at ~1797,30 in the 2008-wide layout).

Caveat: the preview instance is a separate process from the live bar — after
changing config via the GUI, restart BOTH the real bar and the preview
instance to see the change in captures.
