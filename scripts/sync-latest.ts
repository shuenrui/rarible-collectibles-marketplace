/**
 * sync-latest.ts — ultra-light sync for cron, designed to run every 1 minute.
 *
 * Fetches only the 2 newest Algolia pages (96 items = freshest Courtyard listings).
 * At 1-min cadence this captures every new listing within ~1 minute of it going live.
 *
 * Usage (called by cron-latest.sh):
 *   DATABASE_URL=... npx tsx scripts/sync-latest.ts
 */
import { ingestCourtyardActiveListings } from "../src/lib/adapters/courtyard";
import { upsertNormalizedListings } from "../src/lib/adapters/persist";

async function main() {
  const start = Date.now();

  const output = await ingestCourtyardActiveListings({
    maxPages: 2,
    delayMs: 50,
    hydrationConcurrency: 8,  // higher concurrency = faster on small batches
  });

  const upserted = await upsertNormalizedListings(output.upserts);
  const ms = Date.now() - start;

  console.log(
    `[${new Date().toISOString()}] courtyard latest: fetched=${output.upserts.length} upserted=${upserted} errors=${output.errors.length} ms=${ms}`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
