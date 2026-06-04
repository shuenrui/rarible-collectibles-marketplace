/**
 * Full sync script — runs adapters with high page counts to populate the DB.
 *
 * Modes:
 *   courtyard          — global sync (up to 5,040 newest listings via Algolia)
 *   courtyard-all      — sync each major Courtyard category separately (~39k total)
 *   courtyard-buckets  — multi-dim: category × price-tier sub-queries, then cleanup stale (best coverage)
 *   beezie             — Beezie sync (deep per-category crawl, ~4k+ reachable today)
 *   collectorcrypt     — Collector Crypt sync (up to 5,000)
 *   phygitals          — Phygitals active listings full sync (~9k)
 *   all                — courtyard + beezie + collectorcrypt + phygitals (global only)
 *   all-deep           — courtyard-all + beezie + collectorcrypt + phygitals (deepest coverage)
 *   all-buckets        — courtyard-buckets + beezie + collectorcrypt + phygitals (maximum coverage)
 *
 * Usage:
 *   DATABASE_URL=... DIRECT_URL=... tsx scripts/full-sync.ts [mode]
 */
import { ingestCourtyardActiveListings } from "../src/lib/adapters/courtyard";
import { ingestBeezieActiveListings } from "../src/lib/adapters/beezie";
import { ingestCollectorCryptActiveListings } from "../src/lib/adapters/collectorcrypt";
import { ingestPhygitalsActiveListings } from "../src/lib/adapters/phygitals";
import { upsertNormalizedListings } from "../src/lib/adapters/persist";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// Price tiers verified to keep each Algolia bucket under 5,040 hits for the
// largest categories (Pokémon). Tiers are exclusive on the right: [min, max).
// null means unbounded. Tested 2026-06-04 against live Courtyard Algolia index.
const COURTYARD_PRICE_TIERS: Array<[number | null, number | null]> = [
  [null, 10],      // <$10     ~1.2k Pokémon
  [10, 18],        // $10–18   ~3.1k Pokémon (split to stay under 5k)
  [18, 25],        // $18–25   ~2.1k Pokémon
  [25, 50],        // $25–50   ~4.3k Pokémon
  [50, 100],       // $50–100  ~2.8k Pokémon
  [100, 500],      // $100–500 ~2.8k Pokémon
  [500, 2000],     // $500–2k  ~0.9k Pokémon
  [2000, null],    // $2k+     ~0.4k Pokémon
];

async function syncCourtyardWithPriceRange(categoryFilters: string[], priceRange: [number | null, number | null]) {
  const [min, max] = priceRange;
  const priceLabel = `$${min ?? 0}–${max ?? "∞"}`;
  const catLabel = categoryFilters.length ? categoryFilters.join(", ") : "global";
  console.log(`  ▸ [${catLabel}] ${priceLabel}…`);
  const output = await ingestCourtyardActiveListings({
    maxPages: 110,
    delayMs: 80,
    categoryFilters,
    priceRange,
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  console.log(`    ✓ fetched=${output.upserts.length} upserted=${upserted} errors=${output.errors.length}`);
  return { fetched: output.upserts.length, upserted };
}

async function markStaleCourtyardListings(syncStartedAt: Date): Promise<number> {
  // Listings not touched by this sync run are no longer active on Courtyard.
  // Mark them cancelled so they stop showing in the marketplace.
  const result = await prisma.collectibleListing.updateMany({
    where: {
      sourcePlatform: "courtyard",
      listingStatus: "active",
      syncedAt: { lt: syncStartedAt },
    },
    data: { listingStatus: "cancelled" },
  });
  return result.count;
}

async function syncCourtyardBuckets() {
  const syncStartedAt = new Date();
  console.log(`▶ Courtyard multi-dim bucket sync — ${COURTYARD_CATEGORIES.length} categories × ${COURTYARD_PRICE_TIERS.length} price tiers…`);
  let totalFetched = 0;
  let totalUpserted = 0;

  // Global unfiltered first (catches listings not yet categorised / no price)
  const globalResult = await syncCourtyard();
  totalFetched += globalResult.fetched;
  totalUpserted += globalResult.upserted;

  // Per-category × price-tier sub-queries
  for (const cat of COURTYARD_CATEGORIES) {
    console.log(`\n▶ Category: ${cat}`);
    for (const tier of COURTYARD_PRICE_TIERS) {
      const result = await syncCourtyardWithPriceRange([cat], tier);
      totalFetched += result.fetched;
      totalUpserted += result.upserted;
    }
  }

  // Mark anything we didn't touch as cancelled (they were delisted between syncs)
  console.log("\n▶ Cleaning up stale Courtyard listings…");
  const cancelled = await markStaleCourtyardListings(syncStartedAt);
  console.log(`✓ Marked ${cancelled} stale Courtyard listings as cancelled`);

  console.log(`\n✓ Courtyard buckets sync — totalFetched=${totalFetched} totalUpserted=${totalUpserted} staleMarked=${cancelled}`);
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
  // Beezie API returns 40 items/page regardless of requested pageSize.
  // Use pageSize:40 (the natural size) and allow enough pages to cover the
  // largest category — Pokémon currently has ~4,095 items @ 40/page = ~103 pages.
  console.log("▶ Beezie sync — up to 120 pages × 40 items per category…");
  const output = await ingestBeezieActiveListings({
    maxPagesPerCategory: 120,
    pageSize: 40,
    delayMs: 50,
  });
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

async function syncPhygitals() {
  console.log("▶ Phygitals active listings — up to 100 pages × 100 items (~10k)…");
  const output = await ingestPhygitalsActiveListings({ maxPages: 100, pageSize: 100, delayMs: 100 });
  const upserted = await upsertNormalizedListings(output.upserts);
  console.log(`✓ Phygitals — fetched=${output.upserts.length} upserted=${upserted} errors=${output.errors.length}`);
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
    case "phygitals":
      await syncPhygitals();
      break;
    case "all":
      await syncCourtyard();
      await syncBeezie();
      await syncCollectorCrypt();
      await syncPhygitals();
      break;
    case "courtyard-buckets":
      await syncCourtyardBuckets();
      break;
    case "all-deep":
      await syncCourtyardAll();
      await syncBeezie();
      await syncCollectorCrypt();
      await syncPhygitals();
      break;
    case "all-buckets":
      await syncCourtyardBuckets();
      await syncBeezie();
      await syncCollectorCrypt();
      await syncPhygitals();
      break;
    default:
      console.error(`Unknown mode: ${mode}. Use: courtyard | courtyard-all | courtyard-buckets | beezie | collectorcrypt | phygitals | all | all-deep | all-buckets`);
      process.exit(1);
  }

  await prisma.$disconnect();
  console.log(`\n=== Done in ${((Date.now() - start) / 1000).toFixed(1)}s ===\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
