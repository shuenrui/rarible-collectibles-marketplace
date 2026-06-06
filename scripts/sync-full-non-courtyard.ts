/**
 * sync-full-non-courtyard.ts — full crawl + stale cleanup for non-Courtyard sources.
 *
 * Runs every 5 minutes via cron. For each source:
 *   1. Fetch ALL pages of active listings and upsert them (updates syncedAt).
 *   2. Mark any listing of that source whose syncedAt < syncStartedAt as cancelled.
 *      This is how sold / delisted items are removed from the marketplace.
 *
 * Courtyard is intentionally excluded — its catalog is 40K+ items and has its
 * own stale-cleanup in the daily full-sync script.
 */
import { ingestBeezieActiveListings } from "../src/lib/adapters/beezie";
import { ingestCollectorCryptActiveListings } from "../src/lib/adapters/collectorcrypt";
import { ingestPhygitalsActiveListings } from "../src/lib/adapters/phygitals";
import { ingestRenaissActiveListings } from "../src/lib/adapters/renaiss";
import { upsertNormalizedListings } from "../src/lib/adapters/persist";
import { prisma } from "../src/lib/prisma";
import type { SourcePlatform } from "@prisma/client";


type SourceResult = {
  fetched: number;
  upserted: number;
  cancelled: number;
  errors: number;
  ms: number;
};

async function markStaleListings(
  sourcePlatform: SourcePlatform,
  syncStartedAt: Date,
): Promise<number> {
  const result = await prisma.collectibleListing.updateMany({
    where: {
      sourcePlatform,
      listingStatus: "active",
      syncedAt: { lt: syncStartedAt },
    },
    data: { listingStatus: "cancelled" },
  });
  return result.count;
}

async function runCollectorCrypt(syncStartedAt: Date): Promise<SourceResult> {
  const start = Date.now();
  const output = await ingestCollectorCryptActiveListings({
    maxPages: 100,
    pageSize: 100,
    delayMs: 50,
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  const cancelled = await markStaleListings("collector_crypt", syncStartedAt);
  return {
    fetched: output.upserts.length,
    upserted,
    cancelled,
    errors: output.errors.length,
    ms: Date.now() - start,
  };
}

async function runBeezie(syncStartedAt: Date): Promise<SourceResult> {
  const start = Date.now();
  const output = await ingestBeezieActiveListings({
    categoryIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "11", "12"],
    maxPagesPerCategory: 10,
    pageSize: 40,
    delayMs: 50,
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  const cancelled = await markStaleListings("beezie", syncStartedAt);
  return {
    fetched: output.upserts.length,
    upserted,
    cancelled,
    errors: output.errors.length,
    ms: Date.now() - start,
  };
}

async function runPhygitals(syncStartedAt: Date): Promise<SourceResult> {
  const start = Date.now();
  const output = await ingestPhygitalsActiveListings({
    maxPages: 100,
    pageSize: 100,
    delayMs: 50,
    listedStatus: "listed",
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  const cancelled = await markStaleListings("phygitals", syncStartedAt);
  return {
    fetched: output.upserts.length,
    upserted,
    cancelled,
    errors: output.errors.length,
    ms: Date.now() - start,
  };
}

async function runRenaiss(syncStartedAt: Date): Promise<SourceResult> {
  const start = Date.now();
  const output = await ingestRenaissActiveListings({
    maxPages: 30,
    pageSize: 100,
    delayMs: 150,
    listedOnly: true,
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  const cancelled = await markStaleListings("renaiss", syncStartedAt);
  return {
    fetched: output.upserts.length,
    upserted,
    cancelled,
    errors: output.errors.length,
    ms: Date.now() - start,
  };
}

async function main() {
  const syncStartedAt = new Date();
  const wallStart = Date.now();

  const [collectorcrypt, beezie, phygitals, renaiss] = await Promise.all([
    runCollectorCrypt(syncStartedAt),
    runBeezie(syncStartedAt),
    runPhygitals(syncStartedAt),
    runRenaiss(syncStartedAt),
  ]);

  const totalMs = Date.now() - wallStart;

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: "full-non-courtyard",
        syncStartedAt: syncStartedAt.toISOString(),
        totalMs,
        collectorcrypt,
        beezie,
        phygitals,
        renaiss,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
