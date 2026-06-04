#!/bin/bash
# All-sources light sync — runs every 30 min via cron.
# Checks Beezie, Collector Crypt, and Phygitals for new/updated listings.
#
# Install: crontab -e
#   */30 * * * * /home/orangepi/projects/collectibles-marketplace/scripts/cron-all-sources.sh >> /tmp/cron-all-sources.log 2>&1

SITE="https://collectibles-marketplace.host.impossi.build"

LOCK=/tmp/cron-all-sources.lock
if [[ -f "$LOCK" ]]; then
  echo "[$(date -u +%H:%M:%S)] Skipping — previous run still active"
  exit 0
fi
echo "$$" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

echo -n "[$(date -u +%H:%M:%S)] all-sources sync... "
RESULT=$(curl -s -X POST "$SITE/api/sync/schedule?mode=all" \
  -H "Content-Type: application/json" \
  --max-time 120 2>&1)
echo "$RESULT"
