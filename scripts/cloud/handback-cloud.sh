#!/usr/bin/env bash
# Ends cloud hosting (scripts/cloud/README.md): stops the watchdog, the tunnel connector and the web (no more writes),
# then pushes the final encrypted database + uploads to the private hand-off repo (branch `handback`).
# Afterwards run scripts/cloud/restore-laptop.ps1 on the laptop. The site is down between the two.
set -euo pipefail
: "${MU_HANDOFF_REPO:?}" "${MU_HANDOFF_TOKEN:?}" "${MU_BUNDLE_KEY:?}"
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
STATE=${MU_STATE_DIR:-$HOME/mu}
touch "$STATE/stop"
pkill -f 'watchdog.sh' || true
pkill -f 'cloudflared .*tunnel run' || true
pkill -f 'dist/.next/server.js' || true
sleep 3
MU_STATE_DIR="$STATE" MU_APP="$ROOT/apps/web-ecommerce" bash "$ROOT/scripts/cloud/watchdog.sh" --push handback
tail -1 "$STATE/watchdog.log"
echo 'Cloud stopped. Now run scripts/cloud/restore-laptop.ps1 on the laptop.'
