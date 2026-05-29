import { ingestPhygitalsActiveListings } from "@/lib/adapters/phygitals";
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

function asListedStatus(value: string | undefined): "listed" | "active" | "all" {
  if (value === "active" || value === "all" || value === "listed") return value;
  return "listed";
}

function asBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

async function main() {
  const pageSize = asNumber(parseArg("pageSize"), 40);
  const maxPages = asNumber(parseArg("maxPages"), 3);
  const delayMs = asNumber(parseArg("delayMs"), 50);
  const listedStatus = asListedStatus(parseArg("listedStatus"));
  const reconcile = asBool(parseArg("reconcile"), false);

  const output = await ingestPhygitalsActiveListings({
    pageSize,
    maxPages,
    delayMs,
    listedStatus,
  });

  const persisted = await upsertNormalizedListings(output.upserts);
  const expired = reconcile
    ? await expireUnseenActiveListings(
        "phygitals",
        output.upserts.map((u) => u.sourceListingId),
      )
    : 0;

  console.log(
    JSON.stringify(
      {
        pageSize,
        maxPages,
        delayMs,
        listedStatus,
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
