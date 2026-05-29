import { ingestBeezieActiveListings } from "@/lib/adapters/beezie";
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
  const pageSize = asNumber(sp.get("page_size"), 40);
  const maxPagesPerCategory = asNumber(sp.get("max_pages_per_category"), 2);
  const delayMs = asNumber(sp.get("delay_ms"), 50);
  const categoryIds = asCsv(sp.get("category_ids"));

  const output = await ingestBeezieActiveListings({
    pageSize,
    maxPagesPerCategory,
    delayMs,
    categoryIds,
  });

  const upserted = await upsertNormalizedListings(output.upserts);

  return NextResponse.json({
    upserted,
    errors: output.errors,
    pages: Number(output.checkpoint.lastProcessedBlock.toString()),
    fetched: output.upserts.length,
    page_size: pageSize,
    max_pages_per_category: maxPagesPerCategory,
    category_ids: categoryIds,
    delay_ms: delayMs,
  });
}
