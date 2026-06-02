import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CreateSellIntentBody = {
  privyUserId?: string;
  walletId?: string;
  listingId?: string;
  title?: string;
  imageUrl?: string;
  priceAmount?: string;
  priceCurrency?: string;
  notes?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateSellIntentBody;
  const privyUserId = body.privyUserId?.trim();

  if (!privyUserId) {
    return NextResponse.json({ error: "privyUserId is required" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!body.priceAmount?.trim() || Number.isNaN(Number(body.priceAmount))) {
    return NextResponse.json({ error: "valid priceAmount is required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { privyUserId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const intent = await prisma.sellIntent.create({
    data: {
      userId: profile.id,
      walletId: body.walletId ?? null,
      listingId: body.listingId ?? null,
      title: body.title.trim(),
      imageUrl: body.imageUrl ?? null,
      priceAmount: body.priceAmount.trim(),
      priceCurrency: body.priceCurrency?.trim() || "USDC",
      notes: body.notes?.trim() ?? null,
    },
  });

  await prisma.userActivity.create({
    data: {
      userId: profile.id,
      walletId: body.walletId ?? null,
      type: "sell_intent_created",
      title: `Listed "${body.title.trim()}" for ${body.priceAmount} ${body.priceCurrency || "USDC"}`,
      details: { intentId: intent.id, listingId: body.listingId ?? null },
    },
  });

  return NextResponse.json({ ok: true, intentId: intent.id });
}

export async function GET(req: NextRequest) {
  const privyUserId = req.nextUrl.searchParams.get("privy_user_id")?.trim();

  if (!privyUserId) {
    return NextResponse.json({ error: "privy_user_id is required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { privyUserId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ intents: [] });
  }

  const intents = await prisma.sellIntent.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ intents });
}
