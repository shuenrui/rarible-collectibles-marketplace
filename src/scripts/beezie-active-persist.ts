import { ingestBeezieActiveListings } from "@/lib/adapters/beezie";
import { expireUnseenActiveListings, upsertNormalizedListings } from "@/lib/adapters/persist";
import { prisma } from "@/lib/prisma";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function asBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

async function main() {
  const pageSize = asNumber(parseArg("pageSize"), 40);
  const maxPagesPerCategory = asNumber(parseArg("maxPagesPerCategory"), 2);
  const delayMs = asNumber(parseArg("delayMs"), 50);
  const categoryIds = asCsv(parseArg("categoryIds"));
  const reconcile = asBool(parseArg("reconcile"), false);

  const output = await ingestBeezieActiveListings({
    pageSize,
    maxPagesPerCategory,
    delayMs,
    categoryIds,
  });

  const persisted = await upsertNormalizedListings(output.upserts);
  const expired = reconcile
    ? await expireUnseenActiveListings(
        "beezie",
        output.upserts.map((u) => u.sourceListingId),
      )
    : 0;

  console.log(
    JSON.stringify(
      {
        pageSize,
        maxPagesPerCategory,
        delayMs,
        categoryIds,
        fetched: output.upserts.length,
        persisted,
        expired,
        reconcile,
        parseErrors: output.errors.length,
        checkpoint: {
          chainId: output.checkpoint.chainId,
          lastProcessedBlock: output.checkpoint.lastProcessedBlock.toString(),
        },
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
