import type { AdapterCheckpoint, AdapterOutput, ListingImage, NormalizedListingUpsert } from "@/lib/adapters/types";

const BEEZIE_API_BASE = "https://api.beezie.com";
const BEEZIE_MARKETPLACE_URL = "https://beezie.com/marketplace";
const BEEZIE_CONTRACT = "0x80d7C04B738eF379971a6b73f25B1A71ea1c820D";
const CHAIN_ID = 8453;

const BEEZIE_CATEGORY_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "11", "12"] as const;

const BEEZIE_CATEGORY_MAP: Record<string, NormalizedListingUpsert["categoryL1"]> = {
  "1": "pokemon",
  "2": "one_piece",
  "3": "sports_cards",
  "4": "yugioh",
  "5": "comics",
  "6": "other",
  "7": "other",
  "8": "other",
  "9": "other",
  "11": "other",
  "12": "sports_cards",
};

const BEEZIE_HEADERS: Record<string, string> = {
  accept: "*/*",
  "content-type": "application/json",
  origin: "https://beezie.com",
  referer: "https://beezie.com/",
  "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent":
    process.env.BEEZIE_USER_AGENT ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BeezieIngestOptions = {
  categoryIds?: string[];
  pageSize?: number;
  maxPagesPerCategory?: number;
  delayMs?: number;
};

type BeezieAttribute = {
  trait_type?: string;
  trait_value?: string | number | null;
};

type BeezieDropItem = {
  id: number;
  tokenId: number;
  owner?: string;
  metadata?: {
    name?: string;
    image?: string;
    additional_images?: string[];
    attributes?: BeezieAttribute[];
  };
  SellOrder?: {
    id?: string | number;
    amountUSDC?: string;
    createdAt?: number | string;
  };
};

type BeezieListResponse = {
  dropItems: BeezieDropItem[];
  total: number;
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeGrader(raw?: string): NormalizedListingUpsert["grader"] {
  const v = stripDiacritics((raw || "").toLowerCase());
  if (v.includes("psa")) return "psa";
  if (v.includes("bgs") || v.includes("beckett")) return "bgs";
  if (v.includes("cgc")) return "cgc";
  if (v.includes("sgc")) return "sgc";
  if (v.includes("fanatics")) return "fanatics";
  if (!v) return "none";
  return "other";
}

function normalizeGrade(
  gradeRaw?: string,
  grader?: NormalizedListingUpsert["grader"],
): NormalizedListingUpsert["gradeNormalized"] {
  const g = stripDiacritics((gradeRaw || "").toLowerCase().trim());
  if (!g) return undefined;
  if (g === "raw") return "raw";
  if (g === "sealed") return "sealed";
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

function attrsMap(attrs: BeezieAttribute[] = []): Map<string, string> {
  const map = new Map<string, string>();
  for (const attr of attrs) {
    if (!attr?.trait_type || attr.trait_value == null) continue;
    map.set(attr.trait_type.toLowerCase(), String(attr.trait_value));
  }
  return map;
}

function buildImages(item: BeezieDropItem): { imageUrl: string; images: ListingImage[] } {
  const images: ListingImage[] = [];
  const seen = new Set<string>();

  const pushImage = (url: string, type: ListingImage["type"]) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({ url, type });
  };

  const main = item.metadata?.image;
  if (main) pushImage(main, "front");

  const additional = item.metadata?.additional_images || [];
  for (const [index, url] of additional.entries()) {
    if (!url) continue;
    pushImage(url, index === 0 ? "front" : index === 1 ? "back" : "other");
  }

  const imageUrl = images[0]?.url || "https://placehold.co/600x800/png?text=No+Image";
  return { imageUrl, images };
}

function slugify(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSourceUrl(item: BeezieDropItem): string {
  if (!item.tokenId && item.tokenId !== 0) return BEEZIE_MARKETPLACE_URL;
  return `${BEEZIE_MARKETPLACE_URL}/collectible/${item.tokenId}`;
}

function toIsoFromBeezieTimestamp(raw?: number | string): string {
  if (raw == null) return new Date().toISOString();
  const value = Number(raw);
  if (!Number.isFinite(value)) return new Date().toISOString();
  // Beezie currently returns epoch milliseconds; keep a seconds guard for safety.
  const ms = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(ms).toISOString();
}

async function fetchCategoryPage(categoryId: string, page: number, pageSize: number): Promise<BeezieListResponse> {
  const payload = {
    categoryId,
    page: String(page),
    pageSize: String(pageSize),
    filters: [],
    saleStatus: "all",
    sellOrderDateOrder: "DESC",
  };

  const response = await fetch(`${BEEZIE_API_BASE}/dropItems/byCategory`, {
    method: "POST",
    headers: BEEZIE_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Beezie byCategory failed (${response.status}) category=${categoryId} page=${page}`);
  }

  return (await response.json()) as BeezieListResponse;
}

export async function ingestBeezieActiveListings(options: BeezieIngestOptions = {}): Promise<AdapterOutput> {
  const categoryIds = options.categoryIds?.length ? options.categoryIds : [...BEEZIE_CATEGORY_IDS];
  const pageSize = options.pageSize ?? 40;
  const maxPagesPerCategory = options.maxPagesPerCategory && options.maxPagesPerCategory > 0 ? options.maxPagesPerCategory : Number.POSITIVE_INFINITY;
  const delayMs = options.delayMs ?? 50;

  const upserts: NormalizedListingUpsert[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const seenListingIds = new Set<string>();

  let pageCount = 0;

  for (const categoryId of categoryIds) {
    let page = 0;

    while (page < maxPagesPerCategory) {
      let data: BeezieListResponse;

      try {
        data = await fetchCategoryPage(categoryId, page, pageSize);
      } catch (error) {
        errors.push({
          sourceId: `category=${categoryId}:page=${page}`,
          message: error instanceof Error ? error.message : "Beezie page fetch failed",
        });
        break;
      }

      const items = data.dropItems || [];
      if (!items.length) {
        break;
      }

      for (const item of items) {
        const sellOrder = item.SellOrder;
        if (!sellOrder || sellOrder.amountUSDC == null) continue;

        const sourceListingId = sellOrder.id != null ? String(sellOrder.id) : `${item.id}-active`;
        if (seenListingIds.has(sourceListingId)) continue;
        seenListingIds.add(sourceListingId);

        const attributes = attrsMap(item.metadata?.attributes || []);
        const graderRaw = attributes.get("grader");
        const gradeRaw = attributes.get("grade");
        const grader = normalizeGrader(graderRaw);
        const gradeNormalized = normalizeGrade(gradeRaw, grader);

        const categoryL1 = BEEZIE_CATEGORY_MAP[categoryId] || "other";
        const { imageUrl, images } = buildImages(item);

        const createdAtIso = toIsoFromBeezieTimestamp(sellOrder.createdAt);

        upserts.push({
          sourcePlatform: "beezie",
          sourceListingId,
          sourceItemId: String(item.tokenId),
          sourceUrl: buildSourceUrl(item),
          title: item.metadata?.name || `Beezie Collectible #${item.tokenId}`,
          description: undefined,
          imageUrl,
          images,
          categoryL1,
          categoryL2: undefined,
          franchise: attributes.get("pokemon name") || undefined,
          setName: attributes.get("set name") || undefined,
          cardNumber: attributes.get("card number") || undefined,
          year: attributes.get("year") ? Number(attributes.get("year")) : undefined,
          conditionType: gradeRaw ? "graded" : "unknown",
          grader,
          gradeValue: gradeRaw,
          gradeNormalized,
          gradeLabelRaw: gradeRaw,
          listingType: "fixed_price",
          priceAmount: String(sellOrder.amountUSDC),
          priceCurrency: "USDC",
          priceUsd: String(sellOrder.amountUSDC),
          lastPriceUpdateAt: createdAtIso,
          chainId: CHAIN_ID,
          contractAddress: BEEZIE_CONTRACT,
          tokenId: String(item.tokenId),
          tokenStandard: "erc721",
          vaulted: true,
          redeemable: true,
          authProvider: grader !== "none" ? grader.toUpperCase() : undefined,
          listingStatus: "active",
          listedAt: createdAtIso,
          soldAt: undefined,
          sellerAddress: item.owner,
          sellerHandle: undefined,
          sellerVerified: false,
          syncConfidence: 90,
          dataQualityFlags: {
            categoryId,
            source: "api.beezie.com/dropItems/byCategory",
          },
          rawSourcePayload: item as unknown as Record<string, unknown>,
          syncedAt: new Date().toISOString(),
        });
      }

      pageCount += 1;
      page += 1;

      if (items.length < pageSize) {
        break;
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  const checkpoint: AdapterCheckpoint = {
    chainId: CHAIN_ID,
    lastProcessedBlock: BigInt(pageCount),
    updatedAt: new Date().toISOString(),
  };

  return {
    upserts,
    tombstones: [],
    errors,
    checkpoint,
  };
}
