#!/bin/bash
# Install the automatic Touch Bar recovery hooks (run once with sudo):
#   1. touchbar-recover.service  — rebinds appletbdrm after every suspend/resume
#   2. touchbar-watchdog.service — tails the kernel log for the stale-panel
#      signature (appletbdrm "Failed to send message") and auto-recovers
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$DIR/touchbar-recover.service" /etc/systemd/system/
cp "$DIR/touchbar-watchdog.service" /etc/systemd/system/
cp "$DIR/touchbar-watchdog.sh" /usr/sbin/touchbar-watchdog.sh
chmod 755 /usr/sbin/touchbar-watchdog.sh
systemctl daemon-reload
systemctl enable --now touchbar-recover.service touchbar-watchdog.service
echo "installed:"
echo "  - panel re-initializes after every suspend/resume (touchbar-recover)"
echo "  - frozen panel is auto-detected from the kernel log and recovered (touchbar-watchdog)"
echo "Manual fix if ever needed: sudo mtmr --recover && sudo systemctl restart react-drm"
