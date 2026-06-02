import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CreateOfferBody = {
  buyerPrivyUserId?: string;
  buyerAddress?: string;
  offerAmount?: string;
  offerCurrency?: string;
  expiryDays?: number;
  notes?: string;
};

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const listingId = params.id;
  const body = (await req.json()) as CreateOfferBody;

  if (!body.buyerAddress?.trim()) {
    return NextResponse.json({ error: "buyerAddress is required" }, { status: 400 });
  }
  if (!body.offerAmount?.trim() || Number.isNaN(Number(body.offerAmount))) {
    return NextResponse.json({ error: "valid offerAmount is required" }, { status: 400 });
  }

  const listing = await prisma.collectibleListing.findUnique({
    where: { id: listingId },
    select: { id: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "listing not found" }, { status: 404 });
  }

  let buyerUserId: string | null = null;
  if (body.buyerPrivyUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { privyUserId: body.buyerPrivyUserId },
      select: { id: true },
    });
    buyerUserId = profile?.id ?? null;
  }

  const expiresAt = body.expiryDays && body.expiryDays > 0
    ? new Date(Date.now() + body.expiryDays * 24 * 60 * 60 * 1000)
    : null;

  const offer = await prisma.offerIntent.create({
    data: {
      listingId,
      buyerUserId,
      buyerAddress: body.buyerAddress.trim(),
      offerAmount: body.offerAmount.trim(),
      offerCurrency: body.offerCurrency?.trim() || "USDC",
      expiresAt,
      notes: body.notes?.trim() ?? null,
    },
  });

  if (buyerUserId) {
    await prisma.userActivity.create({
      data: {
        userId: buyerUserId,
        type: "offer_intent_created",
        title: `Offer of ${body.offerAmount} ${body.offerCurrency || "USDC"} submitted`,
        details: { offerId: offer.id, listingId },
      },
    });
  }

  return NextResponse.json({ ok: true, offerId: offer.id });
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const listingId = params.id;

  const offers = await prisma.offerIntent.findMany({
    where: { listingId, status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      buyerAddress: true,
      offerAmount: true,
      offerCurrency: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ offers });
}
