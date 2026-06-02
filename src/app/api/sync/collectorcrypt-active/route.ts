import { ingestCollectorCryptActiveListings } from "@/lib/adapters/collectorcrypt";
import { upsertNormalizedListings } from "@/lib/adapters/persist";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const maxPages = Number(sp.get("maxPages") || "2");
  const pageSize = Number(sp.get("pageSize") || "100");
  const delayMs = Number(sp.get("delayMs") || "50");

  const output = await ingestCollectorCryptActiveListings({
    maxPages,
    pageSize,
    delayMs,
  });

  const upserted = await upsertNormalizedListings(output.upserts);

  return NextResponse.json({
    fetched: output.upserts.length,
    upserted,
    errors: output.errors,
    checkpoint: output.checkpoint.lastProcessedBlock.toString(),
    config: {
      maxPages,
      pageSize,
      delayMs,
    },
  });
}
