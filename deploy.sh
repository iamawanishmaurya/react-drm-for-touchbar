#!/bin/bash
# Development helper: deploy changes from THIS working copy to a SEPARATE,
# running react-drm install and restart the bar. Run from the repo root.
# Not needed for a normal install — install.sh builds and runs the repo in
# place. Set REACT_DRM_DEPLOY_DIR to the running install (default below is the
# original author's layout).
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DST="${REACT_DRM_DEPLOY_DIR:-$HOME/opencode/react-drm}"
[ -d "$DST/linux-touchbar-control-center" ] || { echo "no react-drm install at $DST — set REACT_DRM_DEPLOY_DIR" >&2; exit 1; }
for d in app layers src others lib components widgets; do
  [ -d "$SRC/linux-touchbar-control-center/$d" ] && \
  cp -r "$SRC/linux-touchbar-control-center/$d/." "$DST/linux-touchbar-control-center/$d/"
done
# The react-drm library itself (node_modules/react-drm is a symlink to the
# install root, so the app resolves `react-drm` to DST/src and DST/dist).
# Deploy the library sources too, then rebuild dist — the app imports the
# compiled output, so src alone has no effect until tsc runs.
if [ "${SKIP_LIB:-0}" != "1" ]; then
  for f in src/scene/svg-serialize.ts src/scene/scene-boxes.ts src/scene/serialize.ts src/scene/types.ts \
           src/components/Box.tsx src/components/Button.tsx \
           src/renderer/reconciler.ts src/renderer/child-order.ts src/renderer/renderer.ts \
           src/index.ts src/dev/preview-server.ts src/custom-layer/socket.ts src/appIcon.ts; do
    [ -f "$SRC/$f" ] && cp "$SRC/$f" "$DST/$f"
  done
  (cd "$DST" && npx tsc) || echo "WARNING: library tsc build failed — running bar may be stale"
fi
# The app entry isn't under any of the directories above.
cp "$SRC/linux-touchbar-control-center/index.tsx" "$DST/linux-touchbar-control-center/index.tsx"
cp "$SRC"/linux-touchbar-control-center/tests/*.test.ts "$DST/linux-touchbar-control-center/tests/"
[ -f "$SRC/linux-touchbar-control-center/config.blueprint.ts" ] && \
  cp "$SRC/linux-touchbar-control-center/config.blueprint.ts" "$DST/linux-touchbar-control-center/config.blueprint.ts"
# WARNING: the running app loads the user `config.ts` (seeded at install) when
# it exists — config.blueprint.ts is only the fallback/default. Machine-local
# config.ts lives only in $DST and is NOT tracked in this fork; if you edit
# defaults, patch BOTH files (see TROUBLESHOOTING issue 12).
# NO_RESTART=1 stages the files (and rebuilt library) without touching the
# running bar — the service runs with NODE_ENV=production, so it doesn't
# hot-reload; nothing changes on the panel until the next restart.
if [ "${NO_RESTART:-0}" = "1" ]; then echo "staged (no restart)"; exit 0; fi
systemctl restart react-drm   # passwordless sudo configured; ExecStartPre recovers the panel
sleep 5
systemctl is-active react-drm.service
