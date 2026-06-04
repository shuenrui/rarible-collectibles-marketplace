#!/bin/bash
# Light sync — runs every minute via cron.
# Hits the deployed /api/sync/schedule endpoint to capture newest Courtyard listings.
#
# Install: crontab -e
#   * * * * * /home/orangepi/projects/collectibles-marketplace/scripts/cron-light-sync.sh >> /tmp/cron-light-sync.log 2>&1

SITE="https://collectibles-marketplace.host.impossi.build"

# Skip if a previous run is still going (lock file)
LOCK=/tmp/cron-light-sync.lock
if [[ -f "$LOCK" ]]; then
  echo "[$(date -u +%H:%M:%S)] Skipping — previous run still active ($(cat "$LOCK"))"
  exit 0
fi
echo "$$" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

echo -n "[$(date -u +%H:%M:%S)] courtyard light sync... "
RESULT=$(curl -s -X POST "$SITE/api/sync/schedule?mode=courtyard" \
  -H "Content-Type: application/json" \
  --max-time 55 2>&1)
echo "$RESULT"
