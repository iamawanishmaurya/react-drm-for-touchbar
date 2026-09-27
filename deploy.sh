#!/bin/bash
# Deploy changes from THIS fork folder to the RUNNING react-drm install and
# restart the bar. Run from the fork root: ./deploy.sh [files...] (default: all)
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DST="/home/Astra/opencode/react-drm"
for d in app layers src others lib components widgets; do
  [ -d "$SRC/linux-touchbar-control-center/$d" ] && \
  cp -r "$SRC/linux-touchbar-control-center/$d/." "$DST/linux-touchbar-control-center/$d/"
done
[ -f "$SRC/config.blueprint.ts" ] && cp "$SRC/config.blueprint.ts" "$DST/linux-touchbar-control-center/config.blueprint.ts"
systemctl restart react-drm   # passwordless sudo configured; ExecStartPre recovers the panel
sleep 5
systemctl is-active react-drm.service
