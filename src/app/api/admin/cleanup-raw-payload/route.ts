import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECRET = "Flm0V0Vs8VuUkJSX1O2Gh2iowGqStk8q2VEIGFmyYeM";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await prisma.$executeRaw`UPDATE "CollectibleListing" SET "rawSourcePayload" = NULL WHERE "rawSourcePayload" IS NOT NULL`;

  return NextResponse.json({ ok: true, rowsUpdated: result });
}
