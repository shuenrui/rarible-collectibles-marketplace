#!/bin/bash
# Runs every 30 seconds via paired cron entries.
# Freshness-only micro-sync for Beezie / Collector Crypt / Phygitals.
#
# Install:
#   * * * * * /home/orangepi/projects/collectibles-marketplace/scripts/cron-micro.sh >> /tmp/cron-micro.log 2>&1
#   * * * * * sleep 30 && /home/orangepi/projects/collectibles-marketplace/scripts/cron-micro.sh >> /tmp/cron-micro.log 2>&1

set -euo pipefail

REPO=/home/orangepi/projects/collectibles-marketplace
ENV_FILE="$REPO/.env.sync"
LOCK=/tmp/cron-micro.lock

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[$(date -u +%H:%M:%S)] ERROR: $ENV_FILE not found" >&2
  exit 1
fi

if [[ -f "$LOCK" ]]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK") ))
  if (( LOCK_AGE < 90 )); then
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
"$REPO/node_modules/.bin/tsx" scripts/sync-micro.ts
