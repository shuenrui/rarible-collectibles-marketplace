// POST /api/execute/quote
// Builds an ExecutableListing from a DB listing ID + buyer wallet.
// Returns the listing metadata + unsigned transaction (base64) for the buyer to sign.
import { NextRequest, NextResponse } from "next/server";
import {
  SolanaListingSourceAdapter,
  MagicEdenV2RailAdapter,
} from "@/lib/execution";

export async function POST(req: NextRequest) {
  try {
    const { listingId, buyerWallet } = await req.json();
    if (!listingId || typeof listingId !== "string") {
      return NextResponse.json({ error: "listingId required" }, { status: 400 });
    }
    if (!buyerWallet || typeof buyerWallet !== "string") {
      return NextResponse.json(
        { error: "buyerWallet required" },
        { status: 400 },
      );
    }

    const sourceAdapter = new SolanaListingSourceAdapter();
    const railAdapter = new MagicEdenV2RailAdapter();

    // 1. Build base ExecutableListing from DB
    let listing = await sourceAdapter.getExecutableListing(
      listingId,
      buyerWallet,
    );

    // 2. Refresh quote (verify seller still holds NFT)
    listing = await railAdapter.getFreshQuote(listing, buyerWallet);

    if (!listing.freshness.stillActive) {
      return NextResponse.json(
        { error: "Listing is no longer active" },
        { status: 409 },
      );
    }

    // 3. Validate buyer has enough SOL
    const validation = await railAdapter.validateExecutable(
      listing,
      buyerWallet,
    );
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Cannot execute purchase", reasons: validation.reasons },
        { status: 422 },
      );
    }

    // 4. Build unsigned transaction
    const unsigned = await railAdapter.buildUnsignedExecution(
      listing,
      buyerWallet,
    );

    return NextResponse.json({
      listing,
      unsigned,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
