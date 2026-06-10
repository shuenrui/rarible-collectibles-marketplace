// ListingSourceAdapter for CC and Phygitals — both use ME V2 rail on Solana
import { prisma } from "@/lib/prisma";
import type {
  ExecutableListing,
  ListingSourceAdapter,
  ListingSource,
  MagicEdenV2Payload,
} from "../types";

const ME_V2_PROGRAM = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
// ME standard auction house — TODO: confirm this matches CC/Phygitals
// Confirmed from CC purchase tx 3g6r5EmAUM9... (2026-06-10)
const ME_AUCTION_HOUSE = "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_CHAIN_ID = 101;
const USDC_DECIMALS = 6;
const USDC_ATOMIC_PER_UNIT = 1_000_000;

function platformToSource(sourcePlatform: string): ListingSource {
  if (sourcePlatform === "collector_crypt") return "collector_crypt";
  if (sourcePlatform === "phygitals") return "phygitals";
  return "collector_crypt";
}

export class SolanaListingSourceAdapter implements ListingSourceAdapter {
  async getExecutableListing(
    listingId: string,
    buyerWallet?: string,
  ): Promise<ExecutableListing> {
    const listing = await prisma.collectibleListing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        sourcePlatform: true,
        listingStatus: true,
        priceAmount: true,
        priceCurrency: true,
        contractAddress: true,
        tokenId: true,
        sellerAddress: true,
        syncedAt: true,
      },
    });

    if (!listing) throw new Error(`Listing not found: ${listingId}`);
    if (listing.listingStatus !== "active") {
      throw new Error(`Listing ${listingId} is not active (${listing.listingStatus})`);
    }
    if (listing.sourcePlatform !== "collector_crypt" && listing.sourcePlatform !== "phygitals") {
      throw new Error(
        `SolanaListingSourceAdapter only handles CC/Phygitals, got: ${listing.sourcePlatform}`,
      );
    }

    const mintAddress = listing.contractAddress;
    const sellerAddress = listing.sellerAddress;
    if (!mintAddress || mintAddress === "unknown") {
      throw new Error(`Missing mint address for listing ${listingId}`);
    }
    if (!sellerAddress) {
      throw new Error(`Missing seller address for listing ${listingId}`);
    }

    const priceDisplay = listing.priceAmount?.toString() ?? "0";
    const priceUsdc = parseFloat(priceDisplay);
    const priceLamports = BigInt(Math.round(priceUsdc * USDC_ATOMIC_PER_UNIT));

    const payload: MagicEdenV2Payload = {
      rail: "magic_eden_v2",
      auctionHouse: ME_AUCTION_HOUSE,
      mintAddress,
      sellerAddress,
      buyerAddress: buyerWallet,
      priceLamportsOrAtomic: priceLamports.toString(),
      quoteSource: "sdk",
      programIds: [ME_V2_PROGRAM],
    };

    return {
      listingId,
      source: platformToSource(listing.sourcePlatform),
      rail: "magic_eden_v2",
      chain: "solana",
      chainId: SOLANA_CHAIN_ID,

      asset: {
        mintAddress,
        collectionAddress: listing.tokenId ?? undefined,
      },

      market: {
        sellerAddress,
        settlementTokenAddress: USDC_MINT,
        settlementSymbol: "USDC",
        priceAtomic: priceLamports.toString(),
        priceDisplay: priceDisplay,
        currencyDecimals: USDC_DECIMALS,
      },

      freshness: {
        quotedAt: listing.syncedAt?.toISOString() ?? new Date().toISOString(),
        quoteTtlSec: 30,
        stillActive: true,
      },

      execution: {
        model: "contract_derived",
        payload,
        approvals: [],
        signaturesRequired: [
          {
            actor: "buyer",
            type: "wallet_tx",
            required: true,
            note: "Buyer signs the full Solana transaction (deposit + buy + executeSale)",
          },
        ],
      },
    };
  }
}
