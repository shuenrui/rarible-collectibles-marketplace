import { ingestCourtyardActiveListings } from "@/lib/adapters/courtyard";
import { expireUnseenActiveListings, upsertNormalizedListings } from "@/lib/adapters/persist";
import { prisma } from "@/lib/prisma";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function parseCategories(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function asBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

async function main() {
  const maxPages = Number(parseArg("pages") || "1");
  const delayMs = Number(parseArg("delayMs") || "100");
  const hydrationConcurrency = Number(parseArg("concurrency") || "5");
  const maxAssetRetries = Number(parseArg("maxRetries") || "5");
  const reconcile = asBool(parseArg("reconcile"), false);
  const categories = parseCategories(parseArg("categories"));

  const output = await ingestCourtyardActiveListings({
    maxPages,
    delayMs,
    categoryFilters: categories,
    hydrationConcurrency,
    maxAssetRetries,
  });

  const persisted = await upsertNormalizedListings(output.upserts);
  const expired = reconcile
    ? await expireUnseenActiveListings(
        "courtyard",
        output.upserts.map((u) => u.sourceListingId),
      )
    : 0;

  console.log(
    JSON.stringify(
      {
        pagesRequested: maxPages,
        delayMs,
        hydrationConcurrency,
        maxAssetRetries,
        categories,
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
