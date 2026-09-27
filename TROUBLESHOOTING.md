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

**Prevent (automated, installed 2026-09-28):** `sudo
packaging/install-recovery.sh` installs two units:

- `touchbar-recover.service` — rebinds appletbdrm after every
  suspend/resume (fixes the common trigger).
- `touchbar-watchdog.service` — tails the kernel log for the stale-panel
  signature (`appletbdrm … *ERROR* Failed to send message (-110)`) and
  runs `mtmr --recover` + restarts react-drm, debounced to one recovery
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
