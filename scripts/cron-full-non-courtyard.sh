#!/bin/bash
# Runs every 5 minutes via cron.
# Full crawl + stale cleanup for Collector Crypt / Beezie / Phygitals / Renaiss.
# Items absent from the crawl are marked cancelled (sold/delisted).
#
# Install (add both lines to crontab):
#   */5 * * * * /home/orangepi/projects/collectibles-marketplace/scripts/cron-full-non-courtyard.sh >> /tmp/cron-full-non-courtyard.log 2>&1

set -euo pipefail

REPO=/home/orangepi/projects/collectibles-marketplace
ENV_FILE="$REPO/.env.sync"
LOCK=/tmp/cron-full-non-courtyard.lock

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[$(date -u +%H:%M:%S)] ERROR: $ENV_FILE not found" >&2
  exit 1
fi

if [[ -f "$LOCK" ]]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK") ))
  if (( LOCK_AGE < 270 )); then
    echo "[$(date -u +%H:%M:%S)] SKIP — previous run active (${LOCK_AGE}s ago)"
    exit 0
  fi
  rm -f "$LOCK"
fi

echo "$$" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

source "$ENV_FILE"
export DATABASE_URL
export DIRECT_URL

cd "$REPO"
"$REPO/node_modules/.bin/tsx" scripts/sync-full-non-courtyard.ts
