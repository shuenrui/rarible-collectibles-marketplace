import type { AdapterCheckpoint, AdapterOutput, NormalizedListingUpsert } from "@/lib/adapters/types";

const PHYGITALS_API_BASE = process.env.PHYGITALS_API_BASE || "https://api.phygitals.com/api";
const PHYGITALS_SITE_BASE = process.env.PHYGITALS_SITE_BASE || "https://www.phygitals.com";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_MAINNET_CHAIN_ID = 101;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PhygitalsSalesOptions = {
  pageSize?: number;
  maxPages?: number;
  delayMs?: number;
};

type PhygitalsActiveOptions = {
  pageSize?: number;
  maxPages?: number;
  delayMs?: number;
  listedStatus?: "listed" | "active" | "all";
};

type PhygitalsMetadata = {
  key?: string;
  value?: string | number | null;
};

type PhygitalsNft = {
  address?: string;
  slug?: string | null;
  name?: string;
  image?: string;
  collection_address?: string;
  token_standard?: string;
  vault?: string;
  metadata?: PhygitalsMetadata[];
};

type PhygitalsSale = {
  txid?: string;
  time?: string;
  amount?: string | number;
  currency?: string;
  type?: string;
  from?: string;
  to?: string;
  universalNFTDataAddress?: string;
  clawId?: string;
  nft?: PhygitalsNft | null;
};

type PhygitalsSalesResponse = {
  sales?: PhygitalsSale[];
  totalActiveListingsCount?: number;
  totalVolume?: string;
  pagination?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
};

type PhygitalsListing = {
  address?: string;
  slot?: number;
  slug?: string;
  owner?: string;
  name?: string;
  image?: string;
  price?: string | number;
  time?: string;
  lastSale?: string | number;
  listed?: boolean;
  burned?: boolean;
  collection_address?: string;
  marketplace?: string;
  currency?: string;
  vault?: string;
  token_standard?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: PhygitalsMetadata[];
  offers?: unknown[];
};

type PhygitalsActiveResponse = {
  listings?: PhygitalsListing[];
  amount?: number;
};

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapTokenStandard(raw?: string): NormalizedListingUpsert["tokenStandard"] {
  const v = (raw || "").toLowerCase();
  if (v.includes("1155")) return "erc1155";
  if (v.includes("721")) return "erc721";
  if (v.includes("spl") || v.includes("core_nft") || v.includes("core")) return "spl";
  return "other";
}

function mapCategory(title?: string, clawId?: string): NormalizedListingUpsert["categoryL1"] {
  const s = `${title || ""} ${clawId || ""}`.toLowerCase();
  if (s.includes("pokemon")) return "pokemon";
  if (s.includes("one piece")) return "one_piece";
  if (s.includes("yu-gi-oh") || s.includes("yugioh")) return "yugioh";
  if (s.includes("comic")) return "comics";
  if (s.includes("sealed") || s.includes("pack") || s.includes("booster")) return "sealed_products";
  if (s.includes("basketball") || s.includes("football") || s.includes("baseball") || s.includes("sports")) {
    return "sports_cards";
  }
  return "other";
}

function mapGrader(raw?: string): NormalizedListingUpsert["grader"] {
  const v = (raw || "").toLowerCase();
  if (v.includes("psa")) return "psa";
  if (v.includes("bgs") || v.includes("beckett")) return "bgs";
  if (v.includes("cgc")) return "cgc";
  if (v.includes("sgc")) return "sgc";
  if (v.includes("fanatics")) return "fanatics";
  if (v.includes("alt")) return "alt";
  return v ? "other" : "none";
}

function mapGradeNormalized(gradeRaw?: string, grader?: NormalizedListingUpsert["grader"]): NormalizedListingUpsert["gradeNormalized"] {
  const g = (gradeRaw || "").toLowerCase();
  if (!g) return undefined;
  if (g.includes("raw") || g.includes("ungraded")) return "raw";
  if (g.includes("sealed")) return "sealed";
  if (grader === "psa") {
    if (g.includes("10")) return "psa10";
    if (g.includes("9")) return "psa9";
    if (g.includes("8")) return "psa8";
  }
  if (grader === "bgs") {
    if (g.includes("10")) return "bgs10";
    if (g.includes("9.5") || g.includes("95")) return "bgs95";
  }
  if (grader === "cgc" && g.includes("10")) return "cgc10";
  return "other";
}

function parseMetadata(metadata: PhygitalsMetadata[] = []): {
  grader: NormalizedListingUpsert["grader"];
  gradeValue?: string;
  gradeNormalized?: NormalizedListingUpsert["gradeNormalized"];
  rawMap: Record<string, string>;
} {
  const map: Record<string, string> = {};
  for (const m of metadata) {
    if (!m?.key || m.value == null) continue;
    map[m.key.toLowerCase()] = String(m.value);
  }

  let graderRaw = map["grader"];
  let gradeValue = map["grade"];

  if (!graderRaw || !gradeValue) {
    const src = map["title"] || "";
    const graderMatch = src.match(/\b(PSA|BGS|CGC|SGC|Fanatics|ALT)\b/i);
    const gradeMatch = src.match(/\b(10(?:\.0)?|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|RAW|Ungraded)\b/i);
    if (!graderRaw && graderMatch) graderRaw = graderMatch[1].toUpperCase();
    if (!gradeValue && gradeMatch) gradeValue = gradeMatch[1].toUpperCase();
  }

  const grader = mapGrader(graderRaw);
  const gradeNormalized = mapGradeNormalized(gradeValue, grader);

  return { grader, gradeValue, gradeNormalized, rawMap: map };
}

function parseAmountAndCurrency(
  amountRaw: string | number | undefined,
  currencyRaw: string | undefined,
): { amount: string; currency: string; usd?: string } {
  const amountNum = Number(amountRaw ?? 0);
  const currency = currencyRaw || "UNKNOWN";

  const isUsdcMint = currency === SOLANA_USDC_MINT;
  const isUsdWord = currency.toLowerCase() === "usd";

  if (Number.isFinite(amountNum) && (isUsdcMint || isUsdWord)) {
    const normalized = String(amountNum / 1_000_000);
    return {
      amount: normalized,
      currency: isUsdcMint ? "USDC" : "USD",
      usd: normalized,
    };
  }

  return {
    amount: String(amountRaw ?? "0"),
    currency,
  };
}

function buildSourceUrl(sale: PhygitalsSale): string {
  const slug = sale.nft?.slug;
  if (slug) return `${PHYGITALS_SITE_BASE}/card/${slug}`;

  const title = sale.nft?.name;
  if (title) return `${PHYGITALS_SITE_BASE}/card/${slugify(title)}`;

  if (sale.universalNFTDataAddress) return `${PHYGITALS_SITE_BASE}/card/${sale.universalNFTDataAddress}`;
  return `${PHYGITALS_SITE_BASE}/marketplace`;
}

async function fetchSalesPage(page: number, pageSize: number): Promise<PhygitalsSalesResponse> {
  const sp = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });

  const response = await fetch(`${PHYGITALS_API_BASE}/marketplace/sales?${sp.toString()}`);
  if (!response.ok) {
    throw new Error(`Phygitals sales failed (${response.status}) page=${page}`);
  }

  return (await response.json()) as PhygitalsSalesResponse;
}

async function fetchActivePage(
  page: number,
  pageSize: number,
  listedStatus: "listed" | "active" | "all",
): Promise<PhygitalsActiveResponse> {
  const sp = new URLSearchParams({
    searchTerm: "",
    sortBy: "createdAt_desc",
    itemsPerPage: String(pageSize),
    page: String(page),
    metadataConditions: "{}",
    priceRange: "[]",
    fmvRange: "[]",
    listedStatus,
    collectionAddresses: "[]",
  });

  const response = await fetch(`${PHYGITALS_API_BASE}/marketplace/marketplace-listings?${sp.toString()}`, {
    headers: {
      accept: "application/json, text/plain, */*",
      origin: PHYGITALS_SITE_BASE,
      referer: `${PHYGITALS_SITE_BASE}/`,
      "user-agent":
        process.env.PHYGITALS_USER_AGENT ||
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Phygitals active listings failed (${response.status}) page=${page}`);
  }

  return (await response.json()) as PhygitalsActiveResponse;
}

export async function ingestPhygitalsSales(options: PhygitalsSalesOptions = {}): Promise<AdapterOutput> {
  const pageSize = options.pageSize ?? 50;
  const maxPages = options.maxPages ?? 2;
  const delayMs = options.delayMs ?? 50;

  const upserts: NormalizedListingUpsert[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const seen = new Set<string>();

  let pagesFetched = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    let payload: PhygitalsSalesResponse;

    try {
      payload = await fetchSalesPage(page, pageSize);
    } catch (error) {
      errors.push({
        sourceId: `page=${page}`,
        message: error instanceof Error ? error.message : "Phygitals sales fetch failed",
      });
      break;
    }

    const sales = payload.sales || [];
    if (!sales.length) break;

    for (const sale of sales) {
      const sourceListingId = String(sale.txid || "").trim();
      if (!sourceListingId) continue;
      if (seen.has(sourceListingId)) continue;
      seen.add(sourceListingId);

      const nft = sale.nft || undefined;
      const title = nft?.name || `Phygitals Sale ${sourceListingId}`;
      const metadata = parseMetadata(nft?.metadata || []);
      const amount = parseAmountAndCurrency(sale.amount, sale.currency);
      const categoryL1 = mapCategory(title, sale.clawId);

      const sourceItemId = nft?.slug || sale.universalNFTDataAddress || nft?.address || sourceListingId;
      const tokenId = nft?.address || sale.universalNFTDataAddress || sourceItemId;
      const contractAddress = nft?.collection_address || "unknown";

      upserts.push({
        sourcePlatform: "phygitals",
        sourceListingId,
        sourceItemId,
        sourceUrl: buildSourceUrl(sale),
        title,
        description: undefined,
        imageUrl: nft?.image || "https://placehold.co/600x800/png?text=No+Image",
        images: nft?.image ? [{ url: nft.image, type: "front" }] : undefined,
        categoryL1,
        categoryL2: undefined,
        franchise: undefined,
        setName: metadata.rawMap["set"] || metadata.rawMap["set name"] || undefined,
        cardNumber: metadata.rawMap["card number"] || undefined,
        year: metadata.rawMap["year"] ? Number(metadata.rawMap["year"]) : undefined,
        conditionType: metadata.gradeValue ? "graded" : "unknown",
        grader: metadata.grader,
        gradeValue: metadata.gradeValue,
        gradeNormalized: metadata.gradeNormalized,
        gradeLabelRaw: metadata.gradeValue,
        listingType: "fixed_price",
        priceAmount: amount.amount,
        priceCurrency: amount.currency,
        priceUsd: amount.usd,
        lastPriceUpdateAt: sale.time || new Date().toISOString(),
        chainId: SOLANA_MAINNET_CHAIN_ID,
        contractAddress,
        tokenId,
        tokenStandard: mapTokenStandard(nft?.token_standard),
        vaulted: true,
        redeemable: true,
        authProvider: nft?.vault || undefined,
        listingStatus: "sold",
        listedAt: undefined,
        soldAt: sale.time || undefined,
        sellerAddress: sale.from,
        sellerHandle: undefined,
        sellerVerified: false,
        syncConfidence: 70,
        dataQualityFlags: {
          saleType: sale.type,
          currencyRaw: sale.currency,
          source: "api.phygitals.com/marketplace/sales",
        },
        rawSourcePayload: sale as unknown as Record<string, unknown>,
        syncedAt: new Date().toISOString(),
      });
    }

    pagesFetched += 1;

    const totalPages = payload.pagination?.totalPages ?? page;
    if (page >= totalPages) break;

    if (delayMs > 0) await sleep(delayMs);
  }

  const checkpoint: AdapterCheckpoint = {
    chainId: SOLANA_MAINNET_CHAIN_ID,
    lastProcessedBlock: BigInt(pagesFetched),
    updatedAt: new Date().toISOString(),
  };

  return {
    upserts,
    tombstones: [],
    errors,
    checkpoint,
  };
}

export async function ingestPhygitalsActiveListings(options: PhygitalsActiveOptions = {}): Promise<AdapterOutput> {
  const pageSize = options.pageSize ?? 40;
  const maxPages = options.maxPages ?? 3;
  const delayMs = options.delayMs ?? 50;
  const listedStatus = options.listedStatus ?? "listed";

  const upserts: NormalizedListingUpsert[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const seen = new Set<string>();

  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page += 1) {
    let payload: PhygitalsActiveResponse;
    try {
      payload = await fetchActivePage(page, pageSize, listedStatus);
    } catch (error) {
      errors.push({
        sourceId: `page=${page}`,
        message: error instanceof Error ? error.message : "Phygitals active listings fetch failed",
      });
      break;
    }

    const listings = payload.listings || [];
    if (!listings.length) break;

    for (const listing of listings) {
      const sourceListingId = listing.slot != null ? String(listing.slot) : String(listing.address || "");
      if (!sourceListingId) continue;
      if (seen.has(sourceListingId)) continue;
      seen.add(sourceListingId);

      if (listing.burned) continue;
      if (listing.listed === false) continue;
      if (listing.price == null) continue;

      const title = listing.name || `Phygitals Listing ${sourceListingId}`;
      const metadata = parseMetadata(listing.metadata || []);
      const amount = parseAmountAndCurrency(listing.price, listing.currency);
      const categoryL1 = mapCategory(title, undefined);
      const sourceItemId = listing.slug || listing.address || sourceListingId;
      const tokenId = listing.address || sourceItemId;
      const contractAddress = listing.collection_address || "unknown";

      upserts.push({
        sourcePlatform: "phygitals",
        sourceListingId,
        sourceItemId,
        sourceUrl: listing.slug ? `${PHYGITALS_SITE_BASE}/card/${listing.slug}` : `${PHYGITALS_SITE_BASE}/marketplace`,
        title,
        description: undefined,
        imageUrl: listing.image || "https://placehold.co/600x800/png?text=No+Image",
        images: listing.image ? [{ url: listing.image, type: "front" }] : undefined,
        categoryL1,
        categoryL2: undefined,
        franchise: undefined,
        setName: metadata.rawMap["set"] || metadata.rawMap["set name"] || undefined,
        cardNumber: metadata.rawMap["card number"] || undefined,
        year: metadata.rawMap["year"] ? Number(metadata.rawMap["year"]) : undefined,
        conditionType: metadata.gradeValue ? "graded" : "unknown",
        grader: metadata.grader,
        gradeValue: metadata.gradeValue,
        gradeNormalized: metadata.gradeNormalized,
        gradeLabelRaw: metadata.gradeValue,
        listingType: "fixed_price",
        priceAmount: amount.amount,
        priceCurrency: amount.currency,
        priceUsd: amount.usd,
        lastPriceUpdateAt: listing.updatedAt || listing.createdAt || listing.time || new Date().toISOString(),
        chainId: SOLANA_MAINNET_CHAIN_ID,
        contractAddress,
        tokenId,
        tokenStandard: mapTokenStandard(listing.token_standard),
        vaulted: true,
        redeemable: true,
        authProvider: listing.vault || undefined,
        listingStatus: "active",
        listedAt: listing.createdAt || listing.time || undefined,
        soldAt: undefined,
        sellerAddress: listing.owner,
        sellerHandle: undefined,
        sellerVerified: false,
        syncConfidence: 90,
        dataQualityFlags: {
          source: "api.phygitals.com/marketplace/marketplace-listings",
          listed: listing.listed,
          marketplace: listing.marketplace,
          listedStatus,
        },
        rawSourcePayload: listing as unknown as Record<string, unknown>,
        syncedAt: new Date().toISOString(),
      });
    }

    pagesFetched += 1;

    if (listings.length < pageSize) break;
    if (delayMs > 0) await sleep(delayMs);
  }

  const checkpoint: AdapterCheckpoint = {
    chainId: SOLANA_MAINNET_CHAIN_ID,
    lastProcessedBlock: BigInt(pagesFetched),
    updatedAt: new Date().toISOString(),
  };

  return {
    upserts,
    tombstones: [],
    errors,
    checkpoint,
  };
}
