import { ingestPhygitalsSales } from "@/lib/adapters/phygitals";
import { upsertNormalizedListings } from "@/lib/adapters/persist";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function asNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pageSize = asNumber(sp.get("page_size"), 50);
  const maxPages = asNumber(sp.get("max_pages"), 2);
  const delayMs = asNumber(sp.get("delay_ms"), 50);

  const output = await ingestPhygitalsSales({
    pageSize,
    maxPages,
    delayMs,
  });

  const upserted = await upsertNormalizedListings(output.upserts);

  return NextResponse.json({
    upserted,
    errors: output.errors,
    pages: Number(output.checkpoint.lastProcessedBlock.toString()),
    fetched: output.upserts.length,
    page_size: pageSize,
    max_pages: maxPages,
    delay_ms: delayMs,
  });
}
