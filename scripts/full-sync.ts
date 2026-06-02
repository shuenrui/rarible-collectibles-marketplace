/**
 * Full sync script — runs adapters with high page counts to populate the DB.
 * Usage: DATABASE_URL=... DIRECT_URL=... tsx scripts/full-sync.ts [courtyard|beezie|collectorcrypt|all]
 */
import { ingestCourtyardActiveListings } from "../src/lib/adapters/courtyard";
import { ingestBeezieActiveListings } from "../src/lib/adapters/beezie";
import { ingestCollectorCryptActiveListings } from "../src/lib/adapters/collectorcrypt";
import { upsertNormalizedListings } from "../src/lib/adapters/persist";

const mode = process.argv[2] ?? "courtyard";

async function syncCourtyard() {
  console.log("▶ Courtyard sync — up to 300 pages (~60k listings)…");
  const output = await ingestCourtyardActiveListings({ maxPages: 300, delayMs: 80 });
  const upserted = await upsertNormalizedListings(output.upserts);
  console.log(`✓ Courtyard — fetched=${output.upserts.length} upserted=${upserted} errors=${output.errors.length}`);
  return { fetched: output.upserts.length, upserted };
}

async function syncBeezie() {
  console.log("▶ Beezie sync…");
  const output = await ingestBeezieActiveListings({ maxPagesPerCategory: 20, delayMs: 50 });
  const upserted = await upsertNormalizedListings(output.upserts);
  console.log(`✓ Beezie — fetched=${output.upserts.length} upserted=${upserted} errors=${output.errors.length}`);
  return { fetched: output.upserts.length, upserted };
}

async function syncCollectorCrypt() {
  console.log("▶ Collector Crypt sync — up to 50 pages…");
  const output = await ingestCollectorCryptActiveListings({ maxPages: 50, pageSize: 100, delayMs: 80 });
  const upserted = await upsertNormalizedListings(output.upserts);
  console.log(`✓ Collector Crypt — fetched=${output.upserts.length} upserted=${upserted} errors=${output.errors.length}`);
  return { fetched: output.upserts.length, upserted };
}

async function main() {
  console.log(`\n=== Full sync (mode=${mode}) ${new Date().toISOString()} ===\n`);
  const start = Date.now();

  if (mode === "courtyard" || mode === "all") await syncCourtyard();
  if (mode === "beezie" || mode === "all") await syncBeezie();
  if (mode === "collectorcrypt" || mode === "all") await syncCollectorCrypt();

  console.log(`\n=== Done in ${((Date.now() - start) / 1000).toFixed(1)}s ===\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
