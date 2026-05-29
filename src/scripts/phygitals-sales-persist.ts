import { ingestPhygitalsSales } from "@/lib/adapters/phygitals";
import { upsertNormalizedListings } from "@/lib/adapters/persist";
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

async function main() {
  const pageSize = asNumber(parseArg("pageSize"), 50);
  const maxPages = asNumber(parseArg("maxPages"), 2);
  const delayMs = asNumber(parseArg("delayMs"), 50);

  const output = await ingestPhygitalsSales({
    pageSize,
    maxPages,
    delayMs,
  });

  const persisted = await upsertNormalizedListings(output.upserts);

  console.log(
    JSON.stringify(
      {
        pageSize,
        maxPages,
        delayMs,
        fetched: output.upserts.length,
        persisted,
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
