import { ingestBeezieActiveListings } from "@/lib/adapters/beezie";
import { ingestCourtyardActiveListings } from "@/lib/adapters/courtyard";
import { ingestPhygitalsActiveListings, ingestPhygitalsSales } from "@/lib/adapters/phygitals";
import { upsertNormalizedListings } from "@/lib/adapters/persist";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SyncJobResult = {
  fetched: number;
  upserted: number;
  errors: Array<{ sourceId?: string; message: string }>;
  checkpoint: string;
  config: Record<string, unknown>;
};

function asMode(value: string | null): "courtyard" | "beezie" | "phygitals" | "all" {
  if (value === "courtyard" || value === "beezie" || value === "phygitals" || value === "all") return value;
  return "all";
}

async function runCourtyardIncremental(): Promise<SyncJobResult> {
  const config = {
    pages: 5,
    delay_ms: 100,
    cadence: "every 10 minutes",
  };

  const output = await ingestCourtyardActiveListings({
    maxPages: Number(config.pages),
    delayMs: Number(config.delay_ms),
  });

  const upserted = await upsertNormalizedListings(output.upserts);

  return {
    fetched: output.upserts.length,
    upserted,
    errors: output.errors,
    checkpoint: output.checkpoint.lastProcessedBlock.toString(),
    config,
  };
}

async function runBeezieIncremental(): Promise<SyncJobResult> {
  const config = {
    category_ids: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "11", "12"],
    max_pages_per_category: 2,
    page_size: 40,
    delay_ms: 50,
    cadence: "every 15 minutes",
  };

  const output = await ingestBeezieActiveListings({
    categoryIds: config.category_ids,
    maxPagesPerCategory: Number(config.max_pages_per_category),
    pageSize: Number(config.page_size),
    delayMs: Number(config.delay_ms),
  });

  const upserted = await upsertNormalizedListings(output.upserts);

  return {
    fetched: output.upserts.length,
    upserted,
    errors: output.errors,
    checkpoint: output.checkpoint.lastProcessedBlock.toString(),
    config,
  };
}

async function runPhygitalsIncremental(): Promise<SyncJobResult> {
  const activeConfig = {
    max_pages: 3,
    page_size: 40,
    delay_ms: 50,
    listed_status: "listed",
    cadence: "every 15 minutes",
  };

  const config = {
    max_pages: 2,
    page_size: 50,
    delay_ms: 50,
    cadence: "every 15 minutes",
  };

  const activeOutput = await ingestPhygitalsActiveListings({
    maxPages: Number(activeConfig.max_pages),
    pageSize: Number(activeConfig.page_size),
    delayMs: Number(activeConfig.delay_ms),
    listedStatus: "listed",
  });

  const salesOutput = await ingestPhygitalsSales({
    maxPages: Number(config.max_pages),
    pageSize: Number(config.page_size),
    delayMs: Number(config.delay_ms),
  });

  const merged = [...activeOutput.upserts, ...salesOutput.upserts];
  const upserted = await upsertNormalizedListings(merged);
  const errors = [...activeOutput.errors, ...salesOutput.errors];
  const pages = Number(activeOutput.checkpoint.lastProcessedBlock + salesOutput.checkpoint.lastProcessedBlock);

  return {
    fetched: merged.length,
    upserted,
    errors,
    checkpoint: String(pages),
    config: {
      active: activeConfig,
      sales: config,
    },
  };
}

export async function POST(req: NextRequest) {
  const mode = asMode(req.nextUrl.searchParams.get("mode"));

  const response: {
    mode: "courtyard" | "beezie" | "phygitals" | "all";
    courtyard?: SyncJobResult;
    beezie?: SyncJobResult;
    phygitals?: SyncJobResult;
    notes: string[];
  } = {
    mode,
    notes: [
      "Daily full sync is manual for now: Courtyard full crawl (all pages), Beezie full per-category crawl, and deeper Phygitals backfill.",
      "This scheduled route is for incremental freshness only.",
    ],
  };

  if (mode === "courtyard" || mode === "all") {
    response.courtyard = await runCourtyardIncremental();
  }

  if (mode === "beezie" || mode === "all") {
    response.beezie = await runBeezieIncremental();
  }

  if (mode === "phygitals" || mode === "all") {
    response.phygitals = await runPhygitalsIncremental();
  }

  return NextResponse.json(response);
}
