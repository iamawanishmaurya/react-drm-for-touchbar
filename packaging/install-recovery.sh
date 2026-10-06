#!/bin/bash
# Install the automatic Touch Bar recovery hooks (run with sudo, or via
# ./install.sh --with-recovery):
#   1. react-drm-recover          — rebinds the Touch Bar display + restarts react-drm
#   2. touchbar-recover.service   — runs it after every suspend/resume
#   3. touchbar-watchdog.service  — tails the kernel log for the stale-panel
#      signature (appletbdrm "Failed to send message") and runs it
# Uninstall: sudo packaging/install-recovery.sh --remove
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/.." && pwd)"
[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

if [[ ${1:-} == --remove ]]; then
  systemctl disable --now touchbar-recover.service touchbar-watchdog.service 2>/dev/null || true
  rm -f /etc/systemd/system/touchbar-recover.service /etc/systemd/system/touchbar-watchdog.service \
        /usr/local/sbin/touchbar-watchdog.sh /usr/local/sbin/react-drm-recover
  systemctl daemon-reload
  echo "recovery hooks removed"
  exit 0
fi

install -Dm755 "$REPO/system/react-drm-recover" /usr/local/sbin/react-drm-recover
install -Dm755 "$DIR/touchbar-watchdog.sh" /usr/local/sbin/touchbar-watchdog.sh
install -Dm644 "$DIR/touchbar-recover.service" /etc/systemd/system/touchbar-recover.service
sed 's#^ExecStart=.*#ExecStart=/usr/local/sbin/touchbar-watchdog.sh#' "$DIR/touchbar-watchdog.service" \
  > /etc/systemd/system/touchbar-watchdog.service
chmod 644 /etc/systemd/system/touchbar-watchdog.service
systemctl daemon-reload
systemctl enable --now touchbar-recover.service touchbar-watchdog.service
echo "installed:"
echo "  - panel re-initializes after every suspend/resume (touchbar-recover)"
echo "  - frozen panel is auto-detected from the kernel log and recovered (touchbar-watchdog)"
echo "Manual fix if ever needed: sudo react-drm-recover"
