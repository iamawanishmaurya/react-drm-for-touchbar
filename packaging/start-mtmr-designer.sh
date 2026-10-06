#!/bin/bash
# Launch mtmr-designer pointed at react-drm-fork's BAR_LAYOUT (bridge mode).
# The designer's server edits packaging/mtmr-bridge-items.json; after saving
# in the designer, run the import half of the bridge to write config.ts:
#   node packaging/mtmr-designer-bridge.mjs import && sudo systemctl restart react-drm
set -e
FORK="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FORK/../mtmr-designer"
export MTMR_CONFIG_PATH="$FORK/packaging/mtmr-bridge-items.json"
node server/server.cjs
