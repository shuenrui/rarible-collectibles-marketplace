import type { AdapterCheckpoint, AdapterOutput, ListingImage, NormalizedListingUpsert } from "@/lib/adapters/types";

const COLLECTORCRYPT_API_BASE = "https://api.collectorcrypt.com";
const COLLECTORCRYPT_SITE_BASE = "https://collectorcrypt.com";
const SOLANA_CHAIN_ID = 101;


type CollectorCryptOptions = {
  maxPages?: number;
  pageSize?: number;
  delayMs?: number;
  categories?: string[];
};

type CollectorCryptListing = {
  price?: number | string;
  currency?: string;
  sellerId?: string;
  createdAt?: string;
  updatedAt?: string;
  marketplace?: string;
};

type CollectorCryptItem = {
  id: string;
  itemName?: string;
  frontImage?: string;
  backImage?: string | null;
  images?: {
    front?: string;
    frontM?: string;
    frontS?: string;
    back?: string;
  };
  listing?: CollectorCryptListing;
  category?: string;
  grade?: string;
  gradeNum?: number | string;
  gradingCompany?: string;
  gradingID?: string;
  nftAddress?: string;
  nftStandard?: string;
  blockchain?: string;
  authenticated?: boolean;
  vault?: string;
  set?: string;
  year?: number | string;
  owner?:
    | string
    | {
        id?: string;
        name?: string;
        wallet?: string;
      };
  createdAt?: string;
  updatedAt?: string;
};

type CollectorCryptResponse = {
  findTotal?: number;
  total?: number;
  totalPages?: number;
  filterNFtCard?: CollectorCryptItem[];
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeCategory(raw?: string): NormalizedListingUpsert["categoryL1"] {
  const value = stripDiacritics((raw || "").toLowerCase());
  if (value.includes("pokemon")) return "pokemon";
  if (value.includes("one piece")) return "one_piece";
  if (value.includes("yu-gi-oh") || value.includes("yugioh")) return "yugioh";
  if (
    value.includes("baseball") ||
    value.includes("basketball") ||
    value.includes("football") ||
    value.includes("hockey") ||
    value.includes("soccer") ||
    value.includes("sports") ||
    value.includes("boxing")
  ) {
    return "sports_cards";
  }
  if (value.includes("comic") || value.includes("marvel")) return "comics";
  return "other";
}

function normalizeGrader(raw?: string): NormalizedListingUpsert["grader"] {
  const value = stripDiacritics((raw || "").toLowerCase());
  if (value.includes("psa")) return "psa";
  if (value.includes("bgs") || value.includes("beckett")) return "bgs";
  if (value.includes("cgc")) return "cgc";
  if (value.includes("sgc")) return "sgc";
  if (value.includes("fanatics")) return "fanatics";
  if (!value) return "none";
  return "other";
}

function normalizeGrade(
  gradeNum: number | string | undefined,
  gradeRaw: string | undefined,
  grader: NormalizedListingUpsert["grader"],
): NormalizedListingUpsert["gradeNormalized"] {
  const num = Number(gradeNum);
  const raw = stripDiacritics((gradeRaw || "").toLowerCase());
  if (raw.includes("raw") || raw.includes("ungraded")) return "raw";
  if (raw.includes("sealed")) return "sealed";
  if (grader === "psa") {
    if (num === 10) return "psa10";
    if (num === 9) return "psa9";
    if (num === 8) return "psa8";
  }
  if (grader === "bgs") {
    if (num === 10) return "bgs10";
    if (num === 9.5) return "bgs95";
  }
  if (grader === "cgc" && num === 10) return "cgc10";
  return raw ? "other" : undefined;
}

function mapTokenStandard(raw?: string): NormalizedListingUpsert["tokenStandard"] {
  const value = (raw || "").toLowerCase();
  if (value.includes("1155")) return "erc1155";
  if (value.includes("721")) return "erc721";
  if (value.includes("spl") || value.includes("solana")) return "spl";
  return "other";
}

function buildImages(item: CollectorCryptItem): { imageUrl: string; images: ListingImage[] } {
  const images: ListingImage[] = [];
  const seen = new Set<string>();

  const push = (url: string | undefined | null, type: ListingImage["type"]) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({ url, type });
  };

  push(item.images?.frontM || item.images?.front || item.frontImage, "front");
  push(item.images?.back || item.backImage, "back");

  return {
    imageUrl: images[0]?.url || "https://placehold.co/600x800/png?text=No+Image",
    images,
  };
}

function buildSourceUrl(item: CollectorCryptItem): string {
  // CC's NFT_CARD_ROUTE is /assets/:blockchain/:cardAddress — blockchain is always "solana"
  // for CC items; cardAddress is the Solana mint (nftAddress).
  const cardAddress = item.nftAddress || item.id;
  return `${COLLECTORCRYPT_SITE_BASE}/assets/solana/${cardAddress}`;
}

function getSellerAddress(item: CollectorCryptItem, listing?: CollectorCryptListing): string | undefined {
  if (typeof item.owner === "string") return item.owner;
  if (item.owner?.wallet) return item.owner.wallet;
  return listing?.sellerId;
}

function getSellerHandle(item: CollectorCryptItem): string | undefined {
  if (typeof item.owner === "object" && item.owner?.name) return item.owner.name;
  return undefined;
}

async function fetchPage(
  page: number,
  pageSize: number,
  categories?: string[],
): Promise<CollectorCryptResponse> {
  const sp = new URLSearchParams({
    page: String(page),
    step: String(pageSize),
    marketplaceStatus: "Buy now",
    orderBy: "listedDateDesc",
  });

  if (categories?.length) {
    sp.set("categories", categories.join(","));
  }

  const response = await fetch(`${COLLECTORCRYPT_API_BASE}/marketplace?${sp.toString()}`, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Collector Crypt marketplace failed (${response.status}) page=${page}`);
  }

  return (await response.json()) as CollectorCryptResponse;
}

// Fetch pages in parallel batches to avoid the ~12s/page sequential bottleneck.
const PAGE_CONCURRENCY = 8;

function processPageItems(
  payload: CollectorCryptResponse,
  seen: Set<string>,
  upserts: NormalizedListingUpsert[],
): void {
  for (const item of payload.filterNFtCard || []) {
    const listing = item.listing;
    if (!listing?.price || !item.id) continue;

    const sourceListingId = String(item.id);
    if (seen.has(sourceListingId)) continue;
    seen.add(sourceListingId);

    const grader = normalizeGrader(item.gradingCompany);
    const gradeNormalized = normalizeGrade(item.gradeNum, item.grade, grader);
    const { imageUrl, images } = buildImages(item);
    const updatedAt =
      listing.updatedAt || listing.createdAt || item.updatedAt || item.createdAt || new Date().toISOString();
    const listedAt = listing.createdAt || item.createdAt || updatedAt;
    const price = String(listing.price);
    const categoryL1 = normalizeCategory(item.category);

    upserts.push({
      sourcePlatform: "collector_crypt",
      sourceListingId,
      sourceItemId: sourceListingId,
      sourceUrl: buildSourceUrl(item),
      title: item.itemName || `Collector Crypt Item ${sourceListingId}`,
      description: undefined,
      imageUrl,
      images,
      categoryL1,
      categoryL2: item.category,
      franchise: item.category,
      setName: item.set || undefined,
      cardNumber: item.gradingID || undefined,
      year: item.year != null ? Number(item.year) : undefined,
      conditionType: item.grade ? "graded" : "unknown",
      grader,
      gradeValue: item.grade || undefined,
      gradeNormalized,
      gradeLabelRaw: item.grade || undefined,
      listingType: "fixed_price",
      priceAmount: price,
      priceCurrency: listing.currency || "USDC",
      priceUsd: price,
      lastPriceUpdateAt: updatedAt,
      chainId: SOLANA_CHAIN_ID,
      contractAddress: item.nftAddress || "unknown",
      tokenId: sourceListingId,
      tokenStandard: mapTokenStandard(item.nftStandard || item.blockchain),
      vaulted: Boolean(item.vault),
      redeemable: true,
      authProvider: grader !== "none" ? item.gradingCompany || undefined : undefined,
      listingStatus: "active",
      listedAt,
      soldAt: undefined,
      sellerAddress: getSellerAddress(item, listing),
      sellerHandle: getSellerHandle(item),
      sellerVerified: Boolean(item.authenticated),
      syncConfidence: 90,
      dataQualityFlags: {
        source: "api.collectorcrypt.com/marketplace",
        category: item.category,
        marketplace: listing.marketplace,
      },
      rawSourcePayload: item as unknown as Record<string, unknown>,
      syncedAt: new Date().toISOString(),
    });
  }
}

export async function ingestCollectorCryptActiveListings(
  options: CollectorCryptOptions = {},
): Promise<AdapterOutput> {
  const pageSize = Math.min(options.pageSize ?? 100, 100);
  const maxPages = options.maxPages ?? 2;

  const upserts: NormalizedListingUpsert[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const seen = new Set<string>();

  // Fetch page 1 first to discover totalPages
  let firstPayload: CollectorCryptResponse;
  try {
    firstPayload = await fetchPage(1, pageSize, options.categories);
  } catch (error) {
    errors.push({
      sourceId: "page=1",
      message: error instanceof Error ? error.message : "Collector Crypt page fetch failed",
    });
    return {
      upserts,
      tombstones: [],
      errors,
      checkpoint: { chainId: SOLANA_CHAIN_ID, lastProcessedBlock: BigInt(0), updatedAt: new Date().toISOString() },
    };
  }

  processPageItems(firstPayload, seen, upserts);

  const totalPages = Math.min(firstPayload.totalPages ?? 1, maxPages);

  // Fetch remaining pages in parallel batches
  for (let batchStart = 2; batchStart <= totalPages; batchStart += PAGE_CONCURRENCY) {
    const pageNums: number[] = [];
    for (let p = batchStart; p < batchStart + PAGE_CONCURRENCY && p <= totalPages; p++) {
      pageNums.push(p);
    }

    const results = await Promise.allSettled(
      pageNums.map((p) => fetchPage(p, pageSize, options.categories)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        processPageItems(result.value, seen, upserts);
      } else {
        errors.push({
          sourceId: `page=${pageNums[i]}`,
          message: result.reason instanceof Error ? result.reason.message : "Collector Crypt page fetch failed",
        });
      }
    }
  }

  const checkpoint: AdapterCheckpoint = {
    chainId: SOLANA_CHAIN_ID,
    lastProcessedBlock: BigInt(totalPages),
    updatedAt: new Date().toISOString(),
  };

  return {
    upserts,
    tombstones: [],
    errors,
    checkpoint,
  };
}
