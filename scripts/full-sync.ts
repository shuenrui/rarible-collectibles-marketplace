/**
 * Full sync script — runs adapters with high page counts to populate the DB.
 *
 * Modes:
 *   courtyard        — global sync (up to 5,040 newest listings via Algolia)
 *   courtyard-all    — sync each major Courtyard category separately (~39k total)
 *   beezie           — Beezie sync (~750 listings)
 *   collectorcrypt   — Collector Crypt sync (up to 5,000)
 *   all              — courtyard + beezie + collectorcrypt (global only)
 *   all-deep         — courtyard-all + beezie + collectorcrypt (deepest coverage)
 *
 * Usage:
 *   DATABASE_URL=... DIRECT_URL=... tsx scripts/full-sync.ts [mode]
 */
import { ingestCourtyardActiveListings } from "../src/lib/adapters/courtyard";
import { ingestBeezieActiveListings } from "../src/lib/adapters/beezie";
import { ingestCollectorCryptActiveListings } from "../src/lib/adapters/collectorcrypt";
import { upsertNormalizedListings } from "../src/lib/adapters/persist";

const mode = process.argv[2] ?? "courtyard";

// Algolia caps at ~105 pages (5,040 hits) per query. These categories have >5,040
// listings each, so a global sync misses most. Category-filtered syncs give up to
// 5,040 per category — much better coverage at scale.
const COURTYARD_CATEGORIES = [
  "Pokémon",
  "Baseball",
  "Basketball",
  "Football",
  "One Piece",
  "Magic The Gathering",
  "Soccer",
  "Marvel Comic",
  "Hockey",
  "Marvel",
  "VeeFriends",
  "D.C. Comic",
  "Independent Comic",
  "Other",
  "Disney",
  "SLAM Magazine",
  "Yu-Gi-Oh!",
  "Star Wars",
  "Boxing",
  "Weiss Schwarz",
  "Wrestling",
  "Golf",
  "Racing",
  "Formula 1",
  "Tennis",
  "Watches",
  "MetaZoo",
  "Dragon Ball",
  "Nintendo",
];

async function syncCourtyard(categoryFilters?: string[]) {
  const label = categoryFilters?.length ? `Courtyard [${categoryFilters.join(", ")}]` : "Courtyard (global)";
  console.log(`▶ ${label} — up to 105 Algolia pages (~5,040 listings)…`);
  const output = await ingestCourtyardActiveListings({
    maxPages: 110,
    delayMs: 80,
    categoryFilters,
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  console.log(`✓ ${label} — fetched=${output.upserts.length} upserted=${upserted} errors=${output.errors.length}`);
  return { fetched: output.upserts.length, upserted };
}

async function syncCourtyardAll() {
  console.log(`▶ Courtyard by-category sync — ${COURTYARD_CATEGORIES.length} categories…`);
  let totalFetched = 0;
  let totalUpserted = 0;

  // Global sync first (catches listings not yet categorized)
  const global = await syncCourtyard();
  totalFetched += global.fetched;
  totalUpserted += global.upserted;

  // Per-category syncs
  for (const cat of COURTYARD_CATEGORIES) {
    const result = await syncCourtyard([cat]);
    totalFetched += result.fetched;
    totalUpserted += result.upserted;
  }

  console.log(`\n✓ Courtyard all-categories — totalFetched=${totalFetched} totalUpserted=${totalUpserted}`);
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

  switch (mode) {
    case "courtyard":
      await syncCourtyard();
      break;
    case "courtyard-all":
      await syncCourtyardAll();
      break;
    case "beezie":
      await syncBeezie();
      break;
    case "collectorcrypt":
      await syncCollectorCrypt();
      break;
    case "all":
      await syncCourtyard();
      await syncBeezie();
      await syncCollectorCrypt();
      break;
    case "all-deep":
      await syncCourtyardAll();
      await syncBeezie();
      await syncCollectorCrypt();
      break;
    default:
      console.error(`Unknown mode: ${mode}. Use: courtyard | courtyard-all | beezie | collectorcrypt | all | all-deep`);
      process.exit(1);
  }

  console.log(`\n=== Done in ${((Date.now() - start) / 1000).toFixed(1)}s ===\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
