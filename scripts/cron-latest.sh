#!/bin/bash
# Runs every 30 seconds via paired cron entries. Captures newest ~96 Courtyard listings.
# Lock file prevents overlap if a run takes longer than the cadence window.
#
# Install: crontab -e
#   * * * * * /home/orangepi/projects/collectibles-marketplace/scripts/cron-latest.sh >> /tmp/cron-latest.log 2>&1
#   * * * * * sleep 30 && /home/orangepi/projects/collectibles-marketplace/scripts/cron-latest.sh >> /tmp/cron-latest.log 2>&1

set -euo pipefail

REPO=/home/orangepi/projects/collectibles-marketplace
ENV_FILE="$REPO/.env.sync"
LOCK=/tmp/cron-latest.lock

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[$(date -u +%H:%M:%S)] ERROR: $ENV_FILE not found" >&2
  exit 1
fi

# Skip if previous run still active
if [[ -f "$LOCK" ]]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK") ))
  if (( LOCK_AGE < 120 )); then
    echo "[$(date -u +%H:%M:%S)] SKIP — previous run active (${LOCK_AGE}s ago)"
    exit 0
  fi
  # Stale lock (>2 min) — remove and continue
  rm -f "$LOCK"
fi

echo "$$" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

source "$ENV_FILE"
export DATABASE_URL
export DIRECT_URL

cd "$REPO"
"$REPO/node_modules/.bin/tsx" scripts/sync-latest.ts
