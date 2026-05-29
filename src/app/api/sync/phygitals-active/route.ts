import { ingestPhygitalsActiveListings } from "@/lib/adapters/phygitals";
import { upsertNormalizedListings } from "@/lib/adapters/persist";
import { NextRequest, NextResponse } from "next/server";

function asNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asListedStatus(value: string | null): "listed" | "active" | "all" {
  if (value === "active" || value === "all" || value === "listed") return value;
  return "listed";
}

export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pageSize = asNumber(sp.get("page_size"), 40);
  const maxPages = asNumber(sp.get("max_pages"), 3);
  const delayMs = asNumber(sp.get("delay_ms"), 50);
  const listedStatus = asListedStatus(sp.get("listed_status"));

  const output = await ingestPhygitalsActiveListings({
    pageSize,
    maxPages,
    delayMs,
    listedStatus,
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
    listed_status: listedStatus,
  });
}
