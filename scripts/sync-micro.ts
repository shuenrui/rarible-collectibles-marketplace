/**
 * sync-micro.ts — lightweight 30-second freshness pass for non-Courtyard sources.
 *
 * Scope:
 * - Collector Crypt: page 1 only (100 newest items)
 * - Beezie: page 1 of each active category
 * - Phygitals: first 2 pages of active listings
 *
 * This is intentionally freshness-only. No stale reconciliation runs here.
 */
import { ingestBeezieActiveListings } from "../src/lib/adapters/beezie";
import { ingestCollectorCryptActiveListings } from "../src/lib/adapters/collectorcrypt";
import { ingestPhygitalsActiveListings } from "../src/lib/adapters/phygitals";
import { upsertNormalizedListings } from "../src/lib/adapters/persist";
import { prisma } from "../src/lib/prisma";

type SourceResult = {
  fetched: number;
  upserted: number;
  errors: number;
  ms: number;
};

async function runCollectorCrypt(): Promise<SourceResult> {
  const start = Date.now();
  const output = await ingestCollectorCryptActiveListings({
    maxPages: 1,
    pageSize: 100,
    delayMs: 0,
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  return {
    fetched: output.upserts.length,
    upserted,
    errors: output.errors.length,
    ms: Date.now() - start,
  };
}

async function runBeezie(): Promise<SourceResult> {
  const start = Date.now();
  const output = await ingestBeezieActiveListings({
    maxPagesPerCategory: 1,
    pageSize: 40,
    delayMs: 0,
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  return {
    fetched: output.upserts.length,
    upserted,
    errors: output.errors.length,
    ms: Date.now() - start,
  };
}

async function runPhygitals(): Promise<SourceResult> {
  const start = Date.now();
  const output = await ingestPhygitalsActiveListings({
    maxPages: 2,
    pageSize: 100,
    delayMs: 0,
    listedStatus: "listed",
  });
  const upserted = await upsertNormalizedListings(output.upserts);
  return {
    fetched: output.upserts.length,
    upserted,
    errors: output.errors.length,
    ms: Date.now() - start,
  };
}

async function main() {
  const startedAt = Date.now();
  const [collectorcrypt, beezie, phygitals] = await Promise.all([
    runCollectorCrypt(),
    runBeezie(),
    runPhygitals(),
  ]);

  const totalMs = Date.now() - startedAt;

  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: "micro",
        totalMs,
        collectorcrypt,
        beezie,
        phygitals,
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
