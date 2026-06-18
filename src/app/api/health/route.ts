import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  let approxCount: number | null = null;

  try {
    // SELECT 1 keeps Supabase free-tier from pausing; always sub-millisecond
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;

    // Approximate row count from pg_class stats — instant, no table scan
    const stats = await prisma.$queryRaw<[{ estimate: bigint }]>`
      SELECT reltuples::bigint AS estimate
      FROM pg_class
      WHERE relname = 'CollectibleListing'
    `;
    approxCount = Number(stats[0]?.estimate ?? 0);
  } catch {
    // DB unreachable or paused
  }

  return NextResponse.json(
    { ok: dbOk, approx_total_listings: approxCount, ts: new Date().toISOString() },
    { status: dbOk ? 200 : 503 },
  );
}
