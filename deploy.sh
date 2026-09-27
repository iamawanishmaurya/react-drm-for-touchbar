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
[ -f "$SRC/linux-touchbar-control-center/config.blueprint.ts" ] && \
  cp "$SRC/linux-touchbar-control-center/config.blueprint.ts" "$DST/linux-touchbar-control-center/config.blueprint.ts"
# WARNING: the running app loads the user `config.ts` (seeded at install) when
# it exists — config.blueprint.ts is only the fallback/default. Machine-local
# config.ts lives only in $DST and is NOT tracked in this fork; if you edit
# defaults, patch BOTH files (see TROUBLESHOOTING issue 12).
systemctl restart react-drm   # passwordless sudo configured; ExecStartPre recovers the panel
sleep 5
systemctl is-active react-drm.service
