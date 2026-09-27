#!/bin/bash
# Touch Bar stale-panel watchdog.
#
# The appletbdrm driver can stop transmitting framebuffer updates (the panel
# freezes on an old frame while the renderer is healthy — see
# TROUBLESHOOTING.md issue 10). When that happens the kernel logs
#   appletbdrm 5-6:2.1: [drm] *ERROR* Failed to send message (-110)
# repeatedly. This watchdog tails the kernel log for that signature and, on a
# hit, runs the sanctioned fix: `mtmr --recover` + restart react-drm.
#
# Debounced: at most one recovery per RECOVER_COOLDOWN seconds, so a wedged
# iBridge doesn't get hammered. Runs as a root systemd service.

set -u

LOG_TAG=touchbar-watchdog
RECOVER_COOLDOWN="${RECOVER_COOLDOWN:-600}"
# Look this far back in the kernel log each poll; overlapping windows are fine
# because of the cooldown.
WINDOW="${WINDOW:-120s}"
STATE_DIR=/run/touchbar-watchdog
STAMP="$STATE_DIR/last-recover"
PATTERN='appletbdrm.*Failed to send message'

mkdir -p "$STATE_DIR"

log() { logger -t "$LOG_TAG" "$*"; }

log "watching kernel log for stale-panel signature (cooldown ${RECOVER_COOLDOWN}s)"

while true; do
    if journalctl -k --since "-${WINDOW}" -g "$PATTERN" --quiet; then
        now=$(date +%s)
        last=0
        [ -f "$STAMP" ] && last=$(cat "$STAMP" 2>/dev/null || echo 0)
        if (( now - last >= RECOVER_COOLDOWN )); then
            echo "$now" > "$STAMP"
            log "stale-panel signature detected — running mtmr --recover + restarting react-drm"
            /usr/bin/mtmr --recover >>/var/log/touchbar-watchdog-recover.log 2>&1
            systemctl restart react-drm
            log "recovery done"
        fi
    fi
    sleep "${POLL_INTERVAL:-30}"
done
