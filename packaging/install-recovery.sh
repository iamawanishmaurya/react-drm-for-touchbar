#!/bin/bash
# Install the automatic Touch Bar recovery hook (run once with sudo)
set -e
cp "$(dirname "$0")/touchbar-recover.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable touchbar-recover.service
echo "installed: the panel now re-initializes after every suspend/resume."
echo "If the bar EVER freezes while running, manual fix: sudo mtmr --recover && sudo systemctl restart react-drm"
