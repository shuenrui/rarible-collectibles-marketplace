import type { AdapterCheckpoint, AdapterOutput, ListingImage, NormalizedListingUpsert } from "@/lib/adapters/types";

const RENAISS_SITE_BASE = "https://www.renaiss.xyz";
const RENAISS_TRPC_BASE = "https://www.renaiss.xyz/api/trpc";
const EVM_CHAIN_ID = 1; // Renaiss is EVM-based

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RenaissPaginationResult = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type RenaissAttribute = {
  trait: string;
  value: string;
};

type RenaissCollectible = {
  id: string;
  tokenId: string;
  name: string;
  setName?: string;
  cardNumber?: string;
  pokemonName?: string;
  itemId?: string;
  ownerAddress?: string;
  askPriceInUSDT: string; // wei (18 decimals) or "NO-ASK-PRICE"
  fmvPriceInUSD?: string;
  frontImageUrl?: string;
  animationUrl?: string | null;
  attributes?: RenaissAttribute[];
  owner?: { id?: string; publicId?: string; username?: string };
  vaultLocation?: string;
  gradingCompany?: string;
  grade?: string;
  year?: number;
  tier?: string | null;
};

type RenaissListResponse = {
  collection: RenaissCollectible[];
  pagination: RenaissPaginationResult;
};

type RenaissIngestOptions = {
  maxPages?: number;
  pageSize?: number;
  delayMs?: number;
  listedOnly?: boolean;
};

function normalizeCategory(item: RenaissCollectible): NormalizedListingUpsert["categoryL1"] {
  const name = (item.name || "").toLowerCase();
  const set = (item.setName || "").toLowerCase();
  if (name.includes("pokemon") || set.includes("pokemon")) return "pokemon";
  if (name.includes("one piece") || set.includes("one piece")) return "one_piece";
  if (name.includes("yu-gi-oh") || name.includes("yugioh")) return "yugioh";
  return "other";
}

function normalizeGrader(raw?: string): NormalizedListingUpsert["grader"] {
  const v = (raw || "").toLowerCase();
  if (v === "psa") return "psa";
  if (v === "bgs" || v.includes("beckett")) return "bgs";
  if (v === "cgc") return "cgc";
  if (v === "sgc") return "sgc";
  if (!v) return "none";
  return "other";
}

function normalizeGrade(
  grader: NormalizedListingUpsert["grader"],
  grade?: string,
): NormalizedListingUpsert["gradeNormalized"] {
  const g = (grade || "").toLowerCase();
  if (g.includes("gem mint") || g.startsWith("10")) {
    if (grader === "psa") return "psa10";
    if (grader === "bgs") return "bgs10";
    if (grader === "cgc") return "cgc10";
  }
  if (grader === "psa" && g.startsWith("9")) return "psa9";
  if (grader === "psa" && g.startsWith("8")) return "psa8";
  if (grader === "bgs" && g.includes("9.5")) return "bgs95";
  return grade ? "other" : undefined;
}

function parsePrice(askPriceInUSDT: string): { priceAmount: string; priceUsd: string } | null {
  if (askPriceInUSDT === "NO-ASK-PRICE") return null;
  try {
    const wei = BigInt(askPriceInUSDT);
    const usd = Number(wei) / 1e18;
    const formatted = usd.toFixed(2);
    return { priceAmount: formatted, priceUsd: formatted };
  } catch {
    return null;
  }
}

async function fetchPage(
  offset: number,
  limit: number,
  listedOnly: boolean,
): Promise<RenaissListResponse> {
  const input = encodeURIComponent(
    JSON.stringify({
      "0": { json: { limit, offset, listedOnly } },
    }),
  );

  const res = await fetch(`${RENAISS_TRPC_BASE}/collectible.list?batch=1&input=${input}`, {
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Renaiss API failed (${res.status}) offset=${offset}`);
  }

  const json = await res.json();
  return json[0].result.data.json as RenaissListResponse;
}

export async function ingestRenaissActiveListings(
  options: RenaissIngestOptions = {},
): Promise<AdapterOutput> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 20;
  const delayMs = options.delayMs ?? 200;
  const listedOnly = options.listedOnly ?? true;

  const upserts: NormalizedListingUpsert[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const seen = new Set<string>();

  let pagesFetched = 0;
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    let payload: RenaissListResponse;

    try {
      payload = await fetchPage(offset, pageSize, listedOnly);
    } catch (error) {
      errors.push({
        sourceId: `offset=${offset}`,
        message: error instanceof Error ? error.message : "Renaiss page fetch failed",
      });
      break;
    }

    const items = payload.collection;
    if (!items.length) break;

    for (const item of items) {
      if (!item.id || !item.tokenId) continue;

      const parsed = parsePrice(item.askPriceInUSDT);
      if (!parsed) continue; // skip unlisted

      if (seen.has(item.id)) continue;
      seen.add(item.id);

      const grader = normalizeGrader(item.gradingCompany);
      const gradeNormalized = normalizeGrade(grader, item.grade);
      const categoryL1 = normalizeCategory(item);
      const imageUrl = item.frontImageUrl || "https://placehold.co/600x800/png?text=No+Image";
      const images: ListingImage[] = item.frontImageUrl
        ? [{ url: item.frontImageUrl, type: "front" }]
        : [];
      const now = new Date().toISOString();

      upserts.push({
        sourcePlatform: "renaiss",
        sourceListingId: item.id,
        sourceItemId: item.itemId || item.id,
        sourceUrl: `${RENAISS_SITE_BASE}/card/${item.tokenId}`,
        title: item.name || `Renaiss Item ${item.id}`,
        description: undefined,
        imageUrl,
        images,
        categoryL1,
        categoryL2: item.pokemonName || undefined,
        franchise: categoryL1 === "pokemon" ? "pokemon" : categoryL1 === "one_piece" ? "one_piece" : undefined,
        setName: item.setName || undefined,
        cardNumber: item.cardNumber || undefined,
        year: item.year || undefined,
        conditionType: grader !== "none" ? "graded" : "unknown",
        grader,
        gradeValue: item.grade || undefined,
        gradeNormalized,
        gradeLabelRaw: item.grade || undefined,
        listingType: "fixed_price",
        priceAmount: parsed.priceAmount,
        priceCurrency: "USDT",
        priceUsd: parsed.priceUsd,
        lastPriceUpdateAt: now,
        chainId: EVM_CHAIN_ID,
        contractAddress: item.ownerAddress || "unknown",
        tokenId: item.tokenId,
        tokenStandard: "erc721",
        vaulted: item.vaultLocation === "platform",
        redeemable: true,
        authProvider: item.gradingCompany || undefined,
        listingStatus: "active",
        listedAt: undefined,
        soldAt: undefined,
        sellerAddress: item.ownerAddress || undefined,
        sellerHandle: item.owner?.username || undefined,
        sellerVerified: Boolean(item.gradingCompany),
        syncConfidence: 85,
        dataQualityFlags: {
          source: "renaiss.xyz/api/trpc/collectible.list",
          gradingCompany: item.gradingCompany,
          vaultLocation: item.vaultLocation,
        },
        rawSourcePayload: item as unknown as Record<string, unknown>,
        syncedAt: now,
      });
    }

    pagesFetched++;
    offset += pageSize;

    if (!payload.pagination.hasMore) break;
    if (delayMs > 0) await sleep(delayMs);
  }

  const checkpoint: AdapterCheckpoint = {
    chainId: EVM_CHAIN_ID,
    lastProcessedBlock: BigInt(pagesFetched),
    updatedAt: new Date().toISOString(),
  };

  return { upserts, tombstones: [], errors, checkpoint };
}
