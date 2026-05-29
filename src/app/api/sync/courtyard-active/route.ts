import { ingestCourtyardActiveListings } from "@/lib/adapters/courtyard";
import { upsertNormalizedListings } from "@/lib/adapters/persist";
import { NextRequest, NextResponse } from "next/server";

function asNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pages = asNumber(sp.get("pages"), 1);
  const delayMs = asNumber(sp.get("delay_ms"), 100);
  const categories = asCsv(sp.get("categories"));

  const output = await ingestCourtyardActiveListings({
    maxPages: pages,
    delayMs,
    categoryFilters: categories,
  });

  const upserted = await upsertNormalizedListings(output.upserts);

  return NextResponse.json({
    upserted,
    errors: output.errors,
    pages: Number(output.checkpoint.lastProcessedBlock.toString()) + 1,
    fetched: output.upserts.length,
    categories,
    delay_ms: delayMs,
  });
}
