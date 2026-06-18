// POST /api/execute/confirm
// Reconciles a submitted Solana transaction and returns execution result.
import { NextRequest, NextResponse } from "next/server";
import {
  SolanaListingSourceAdapter,
  MagicEdenV2RailAdapter,
} from "@/lib/execution";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { listingId, buyerWallet, txHash } = await req.json();
    if (!listingId || !buyerWallet || !txHash) {
      return NextResponse.json(
        { error: "listingId, buyerWallet, and txHash are all required" },
        { status: 400 },
      );
    }

    const sourceAdapter = new SolanaListingSourceAdapter();
    const railAdapter = new MagicEdenV2RailAdapter();

    const listing = await sourceAdapter.getExecutableListing(
      listingId,
      buyerWallet,
    );
    const result = await railAdapter.reconcile(txHash, listing);

    if (result.status === "confirmed" && result.sourceListingStatus === "sold") {
      await prisma.collectibleListing.update({
        where: { id: listingId },
        data: {
          listingStatus: "sold",
          soldAt: new Date(),
          syncedAt: new Date(),
        },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
