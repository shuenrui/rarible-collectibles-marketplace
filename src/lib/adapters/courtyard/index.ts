import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createPublicClient, decodeEventLog, erc721Abi, formatUnits, getAddress, http, parseAbiItem, toEventSelector } from "viem";
import type { AdapterCheckpoint, AdapterOutput, ListingImage, NormalizedListingUpsert } from "@/lib/adapters/types";

const CHAIN_ID = 137;
const REORG_WINDOW = 64n;
const DEFAULT_RPC = "https://polygon.drpc.org";
const COURTYARD_ORDERBOOK = getAddress("0x5E4943373c2198625BD441Ae0629E9E7b4FB4797");
const COURTYARD_REGISTRY = getAddress("0x251BE3A17Af4892035C37ebf5890F4a4D889dcAD");
const POLYGON_USDC = getAddress("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");

const COURTYARD_ALGOLIA_APP_ID = process.env.COURTYARD_ALGOLIA_APP_ID || "Y8TL3M06QA";
const COURTYARD_ALGOLIA_API_KEY = process.env.COURTYARD_ALGOLIA_API_KEY || "3b3ed18284ca0baee9a496aea5f093d6";
const COURTYARD_CLIENT_ID = process.env.COURTYARD_CLIENT_ID || "8f087d2e-14ef-4da2-a764-fb10d46a6a0d";
const COURTYARD_INDEX = process.env.COURTYARD_ALGOLIA_INDEX || "marketplace_prod_recently_listed";
const COURTYARD_PAGE_SIZE = Number(process.env.COURTYARD_PAGE_SIZE || "48");
const COURTYARD_USER_AGENT =
  process.env.COURTYARD_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const tradeExecutedEvent = parseAbiItem(
  "event TradeExecuted(address indexed bidder, address indexed asker, uint256 indexed nftTokenId, address erc20Token, uint256 amount, bytes tradeSignature, uint256 feeAccrued)",
);

const tradeExecutedTopic = toEventSelector(tradeExecutedEvent);

const checkpointFile = path.join(process.cwd(), ".checkpoints", "courtyard.json");
const activeCheckpointFile = path.join(process.cwd(), ".checkpoints", "courtyard-active.json");
const unknownTokensLogFile = path.join(process.cwd(), ".checkpoints", "courtyard-unknownTokens.log");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CourtyardIngestOptions = {
  rpcUrl?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
};

type CourtyardDiscoveryOptions = {
  rpcUrl?: string;
  fromBlock: bigint;
  toBlock: bigint;
};

type CourtyardActiveIngestOptions = {
  categoryFilters?: string[];
  /** Filter by grading company, e.g. ["PSA"], ["BGS"]. Maps to Algolia facetFilter on metadata.Grader. */
  graderFilters?: string[];
  /** [minUsd, maxUsd] — null means unbounded. Translates to Algolia numericFilters on latestListing.price.amount.usd. */
  priceRange?: [number | null, number | null];
  maxPages?: number;
  delayMs?: number;
  hydrationConcurrency?: number;
  maxAssetRetries?: number;
};

type MetadataAttribute = { trait_type?: string; value?: string | number | null };

type MetadataPayload = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: MetadataAttribute[];
};

type CourtyardListingPrice = {
  amount?: {
    raw?: string;
    decimal?: number;
    usd?: number;
    native?: number;
  };
  currency?: {
    contract?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
  };
};

type CourtyardOrder = {
  orderId?: string;
  side?: "buy" | "sell" | string;
  kind?: string;
  maker?: string;
  createdAt?: string;
  expiration?: string;
  validUntil?: string;
  price?: CourtyardListingPrice;
};

type CourtyardAssetPayload = {
  collectible_id?: string;
  image?: string;
  asset_pictures?: string[];
  attributes?: Array<{ name?: string; value?: string | number | null }>;
  burned?: boolean;
  chain?: string;
  contract?: string;
  listing_data?: CourtyardOrder[];
  offer_data?: CourtyardOrder[];
  created_at?: string;
  metadata_url?: string;
};

type AlgoliaHit = {
  objectID: string;
  proofOfIntegrity?: string;
};

type AlgoliaResult = {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
};

type AlgoliaResponse = {
  results: AlgoliaResult[];
};

function normalizeIpfs(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  }
  return uri;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function readCheckpoint(): Promise<AdapterCheckpoint | null> {
  try {
    const raw = await readFile(checkpointFile, "utf8");
    const parsed = JSON.parse(raw) as { chainId: number; lastProcessedBlock: string; updatedAt: string };
    return {
      chainId: parsed.chainId,
      lastProcessedBlock: BigInt(parsed.lastProcessedBlock),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

async function writeCheckpoint(checkpoint: AdapterCheckpoint): Promise<void> {
  await mkdir(path.dirname(checkpointFile), { recursive: true });
  await writeFile(
    checkpointFile,
    JSON.stringify(
      {
        chainId: checkpoint.chainId,
        lastProcessedBlock: checkpoint.lastProcessedBlock.toString(),
        updatedAt: checkpoint.updatedAt,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function writeActiveCheckpoint(page: number): Promise<void> {
  await mkdir(path.dirname(activeCheckpointFile), { recursive: true });
  await writeFile(
    activeCheckpointFile,
    JSON.stringify(
      {
        chainId: CHAIN_ID,
        lastProcessedBlock: String(page),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function appendUnknownTokenLog(entry: {
  nftTokenId: string;
  txHash?: string;
  blockNumber?: string;
  error: string;
}): Promise<void> {
  await mkdir(path.dirname(unknownTokensLogFile), { recursive: true });
  const line = JSON.stringify({ ...entry, recordedAt: new Date().toISOString() });
  await appendFile(unknownTokensLogFile, `${line}\n`, "utf8");
}

function attrMap(attributes: MetadataAttribute[] = []): Map<string, string> {
  const m = new Map<string, string>();
  for (const attr of attributes) {
    if (!attr?.trait_type || attr.value == null) continue;
    m.set(attr.trait_type.toLowerCase(), String(attr.value));
  }
  return m;
}

function normalizeCategory(categoryRaw?: string): NormalizedListingUpsert["categoryL1"] {
  const c = stripDiacritics((categoryRaw || "").toLowerCase());
  if (c.includes("pokemon")) return "pokemon";
  if (c.includes("one piece")) return "one_piece";
  if (c.includes("yu-gi-oh") || c.includes("yugioh")) return "yugioh";
  if (c.includes("comic")) return "comics";
  if (c.includes("sealed")) return "sealed_products";
  if (c.includes("sports") || c.includes("basketball") || c.includes("football") || c.includes("baseball")) {
    return "sports_cards";
  }
  return "other";
}

function normalizeGrader(raw?: string): NormalizedListingUpsert["grader"] {
  const v = stripDiacritics((raw || "").toLowerCase());
  if (v.includes("psa")) return "psa";
  if (v.includes("bgs") || v.includes("beckett")) return "bgs";
  if (v.includes("cgc")) return "cgc";
  if (v.includes("sgc")) return "sgc";
  if (v.includes("fanatics")) return "fanatics";
  if (v.includes("alt")) return "alt";
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

function parseImages(meta: MetadataPayload, attrs: Map<string, string>): ListingImage[] {
  const out: ListingImage[] = [];
  if (meta.image) out.push({ url: normalizeIpfs(meta.image), type: "front" });
  const back = attrs.get("back_image") || attrs.get("image_back") || attrs.get("back");
  const slab = attrs.get("slab_image") || attrs.get("image_slab");
  if (back) out.push({ url: normalizeIpfs(back), type: "back" });
  if (slab) out.push({ url: normalizeIpfs(slab), type: "slab" });
  return out;
}

function normalizeAssetImages(payload: CourtyardAssetPayload): ListingImage[] {
  const images: ListingImage[] = [];
  if (payload.image) {
    images.push({ url: payload.image, type: "front" });
  }
  for (const [index, url] of (payload.asset_pictures || []).entries()) {
    if (!url) continue;
    images.push({ url, type: index === 0 ? "front" : index === 1 ? "back" : "slab" });
  }
  return images;
}

function buildAssetAttributeMap(payload: CourtyardAssetPayload): Map<string, string> {
  const map = new Map<string, string>();
  for (const attr of payload.attributes || []) {
    const key = (attr.name || "").trim().toLowerCase();
    if (!key || attr.value == null) continue;
    map.set(key, String(attr.value));
  }
  return map;
}

function mapChainId(chain?: string): number {
  if (!chain) return CHAIN_ID;
  const normalized = chain.toLowerCase();
  if (normalized === "polygon") return 137;
  if (normalized === "base") return 8453;
  if (normalized.includes("flow")) return 747;
  return CHAIN_ID;
}

function pickActiveListing(listings: CourtyardOrder[] = []): CourtyardOrder | null {
  const now = Date.now();
  const sellListings = listings.filter((listing) => {
    if ((listing.side || "sell") !== "sell") return false;
    const expiresAt = listing.expiration ? Date.parse(listing.expiration) : Number.NaN;
    if (Number.isNaN(expiresAt)) return true;
    return expiresAt > now;
  });

  if (!sellListings.length) return null;

  return sellListings
    .slice()
    .sort((a, b) => {
      const aCreated = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bCreated = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bCreated - aCreated;
    })[0];
}

async function fetchTokenMetadata(tokenUri: string): Promise<MetadataPayload | null> {
  try {
    const url = normalizeIpfs(tokenUri);
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as MetadataPayload;
  } catch {
    return null;
  }
}

async function fetchCourtyardSearchPage(
  page: number,
  categoryFilters: string[],
  priceRange?: [number | null, number | null],
  graderFilters?: string[],
): Promise<AlgoliaResult> {
  const numericFilters: string[] = [];
  if (priceRange) {
    const [min, max] = priceRange;
    if (min !== null) numericFilters.push(`latestListing.price.amount.usd>=${min}`);
    if (max !== null) numericFilters.push(`latestListing.price.amount.usd<${max}`);
  }

  // Build Algolia AND-of-OR facetFilters:
  // [[cat1, cat2], [grader1, grader2]] = (cat1 OR cat2) AND (grader1 OR grader2)
  const facetFilters: string[][] = [];
  if (categoryFilters.length) facetFilters.push(categoryFilters.map((category) => `metadata.Category:${category}`));
  if (graderFilters?.length) facetFilters.push(graderFilters.map((grader) => `metadata.Grader:${grader}`));

  const searchRequest = {
    indexName: COURTYARD_INDEX,
    attributesToRetrieve: ["proofOfIntegrity", "dealScore"],
    ...(numericFilters.length ? { numericFilters } : {}),
    facets: [
      "estimatedValueUsd",
      "latestListing.price.amount.usd",
      "metadata.Brand",
      "metadata.Category",
      "metadata.Condition",
      "metadata.Event",
      "metadata.Grade",
      "metadata.Grader",
      "metadata.Language",
      "metadata.Reference",
      "metadata.Set",
      "metadata.Title/PKMN",
      "metadata.Title/Subject",
      "metadata.Year",
      "tags",
      "variant",
    ],
    highlightPostTag: "__/ais-highlight__",
    highlightPreTag: "__ais-highlight__",
    hitsPerPage: COURTYARD_PAGE_SIZE,
    maxValuesPerFacet: 60,
    page,
    query: "",
    userToken: "anonymous-codex-courtyard",
    ...(facetFilters.length ? { facetFilters } : {}),
  };

  const facetRequest = {
    indexName: COURTYARD_INDEX,
    analytics: false,
    attributesToRetrieve: ["proofOfIntegrity", "dealScore"],
    clickAnalytics: false,
    facets: "metadata.Category",
    highlightPostTag: "__/ais-highlight__",
    highlightPreTag: "__ais-highlight__",
    hitsPerPage: 0,
    maxValuesPerFacet: 60,
    page: 0,
    query: "",
    userToken: "anonymous-codex-courtyard",
  };

  const query = new URLSearchParams({
    "x-algolia-agent": "Codex-Courtyard-Adapter",
    "x-algolia-api-key": COURTYARD_ALGOLIA_API_KEY,
    "x-algolia-application-id": COURTYARD_ALGOLIA_APP_ID,
  });

  const response = await fetch(`https://${COURTYARD_ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries?${query}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "text/plain",
      origin: "https://marketplace.courtyard.io",
      referer: "https://marketplace.courtyard.io/",
    },
    body: JSON.stringify({ requests: [searchRequest, facetRequest] }),
  });

  if (!response.ok) {
    throw new Error(`Algolia search failed (${response.status})`);
  }

  const payload = (await response.json()) as AlgoliaResponse;
  const result = payload.results?.[0];
  if (!result) {
    throw new Error("Algolia search returned no results[0]");
  }

  return result;
}

async function fetchCourtyardAsset(proofOfIntegrity: string): Promise<CourtyardAssetPayload> {
  const response = await fetch(`https://api.courtyard.io/index/asset/${proofOfIntegrity}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "cy-client-id": COURTYARD_CLIENT_ID,
      origin: "https://marketplace.courtyard.io",
      priority: "u=1, i",
      referer: "https://marketplace.courtyard.io/",
      "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent": COURTYARD_USER_AGENT,
    },
  });

  if (!response.ok) {
    const err = new Error(`Courtyard asset hydration failed (${response.status})`);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }

  return (await response.json()) as CourtyardAssetPayload;
}

async function fetchCourtyardAssetWithRetry(
  proofOfIntegrity: string,
  maxRetries: number,
): Promise<CourtyardAssetPayload> {
  let attempt = 0;
  let delayMs = 400;

  while (true) {
    try {
      return await fetchCourtyardAsset(proofOfIntegrity);
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      const shouldRetry = status === 429 || status === 503;
      if (!shouldRetry || attempt >= maxRetries) throw error;

      const jitter = Math.floor(Math.random() * 120);
      await sleep(delayMs + jitter);
      delayMs = Math.min(delayMs * 2, 5000);
      attempt += 1;
    }
  }
}

export async function ingestCourtyardActiveListings(options: CourtyardActiveIngestOptions = {}): Promise<AdapterOutput> {
  const categoryFilters = options.categoryFilters || [];
  const graderFilters = options.graderFilters || [];
  const priceRange = options.priceRange;
  const delayMs = options.delayMs ?? 0;
  const maxPages = options.maxPages && options.maxPages > 0 ? options.maxPages : Number.POSITIVE_INFINITY;
  const hydrationConcurrency = Math.max(1, Math.min(20, options.hydrationConcurrency ?? 5));
  const maxAssetRetries = Math.max(0, options.maxAssetRetries ?? 5);

  const upserts: NormalizedListingUpsert[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const seenListingIds = new Set<string>();
  let page = 0;
  let nbPages = 1;

  while (page < nbPages && page < maxPages) {
    let searchResult: AlgoliaResult;
    try {
      searchResult = await fetchCourtyardSearchPage(page, categoryFilters, priceRange, graderFilters);
    } catch (error) {
      errors.push({
        sourceId: `page-${page}`,
        message: error instanceof Error ? error.message : "Courtyard search page failed",
      });
      break;
    }

    nbPages = searchResult.nbPages;

    const hits = searchResult.hits || [];
    for (let offset = 0; offset < hits.length; offset += hydrationConcurrency) {
      const batch = hits.slice(offset, offset + hydrationConcurrency);
      const results = await Promise.all(
        batch.map(async (hit) => {
          const proofOfIntegrity = hit.proofOfIntegrity || hit.objectID;
          if (!proofOfIntegrity) return;

          try {
            const asset = await fetchCourtyardAssetWithRetry(proofOfIntegrity, maxAssetRetries);
            if (asset.burned) return;

            const activeListing = pickActiveListing(asset.listing_data || []);
            if (!activeListing) return;

            const listingId = activeListing.orderId || `${proofOfIntegrity}-${activeListing.maker || "unknown"}`;
            if (seenListingIds.has(listingId)) return;
            seenListingIds.add(listingId);

            const attrs = buildAssetAttributeMap(asset);
            const title = attrs.get("title/subject") || attrs.get("title/pkmn") || asset.collectible_id || `Courtyard Asset ${proofOfIntegrity.slice(0, 8)}`;
            const categoryRaw = attrs.get("category");
            const graderRaw = attrs.get("grader");
            const gradeValue = attrs.get("grade");

            const grader = normalizeGrader(graderRaw);
            const gradeNormalized = normalizeGrade(gradeValue, grader);
            const categoryL1 = normalizeCategory(categoryRaw);

            const images = normalizeAssetImages(asset);
            const imageUrl = images[0]?.url || "https://placehold.co/600x800/png?text=No+Image";

            const amountDecimal = activeListing.price?.amount?.decimal ?? 0;
            const amountUsd = activeListing.price?.amount?.usd;
            const priceAmount = String(amountDecimal);
            const priceCurrency = activeListing.price?.currency?.symbol || "USDC";
            const priceUsd = typeof amountUsd === "number" ? String(amountUsd) : priceCurrency.toUpperCase().includes("USD") ? priceAmount : undefined;
            const expiration = activeListing.expiration || activeListing.validUntil;

            upserts.push({
              sourcePlatform: "courtyard",
              sourceListingId: listingId,
              sourceItemId: asset.collectible_id || proofOfIntegrity,
              sourceUrl: `https://marketplace.courtyard.io/asset/${asset.collectible_id || proofOfIntegrity}`,
              title,
              description: undefined,
              imageUrl,
              images,
              categoryL1,
              categoryL2: attrs.get("event"),
              franchise: attrs.get("brand") || attrs.get("game"),
              setName: attrs.get("set"),
              cardNumber: attrs.get("card number") || attrs.get("number"),
              year: attrs.get("year") ? Number(attrs.get("year")) : undefined,
              conditionType: gradeValue ? "graded" : "unknown",
              grader,
              gradeValue,
              gradeNormalized,
              gradeLabelRaw: gradeValue,
              listingType: activeListing.kind === "auction" ? "auction" : "fixed_price",
              priceAmount,
              priceCurrency,
              priceUsd,
              lastPriceUpdateAt: activeListing.createdAt || new Date().toISOString(),
              chainId: mapChainId(asset.chain),
              contractAddress: asset.contract || COURTYARD_REGISTRY,
              // proofOfIntegrity is Courtyard's internal SHA256 asset ID, used here as a stable tokenId surrogate
              tokenId: proofOfIntegrity,
              tokenStandard: "erc721",
              vaulted: true,
              redeemable: !asset.burned,
              authProvider: grader !== "none" ? grader.toUpperCase() : undefined,
              listingStatus: "active",
              listedAt: activeListing.createdAt,
              soldAt: undefined,
              sellerAddress: activeListing.maker,
              sellerHandle: undefined,
              sellerVerified: false,
              syncConfidence: 90,
              dataQualityFlags: {
                source: "api.courtyard.io/index/asset",
                proofOfIntegrity,
                expiration,
              },
              rawSourcePayload: {
                hit,
                asset,
                listing: activeListing,
              },
              syncedAt: new Date().toISOString(),
            });
          } catch (error) {
            errors.push({
              sourceId: proofOfIntegrity,
              message: error instanceof Error ? error.message : "Courtyard asset hydration failed",
            });
          }
        }),
      );
      void results;
      if (delayMs > 0) await sleep(delayMs);
    }

    await writeActiveCheckpoint(page);
    page += 1;
  }

  const checkpoint: AdapterCheckpoint = {
    chainId: CHAIN_ID,
    lastProcessedBlock: BigInt(page > 0 ? page - 1 : 0),
    updatedAt: new Date().toISOString(),
  };

  return {
    upserts,
    tombstones: [],
    errors,
    checkpoint,
  };
}

export async function ingestCourtyardTrades(options: CourtyardIngestOptions = {}): Promise<AdapterOutput> {
  const client = createPublicClient({ transport: http(options.rpcUrl || DEFAULT_RPC) });

  const latestBlock = options.toBlock ?? (await client.getBlockNumber());
  const cp = await readCheckpoint();
  const fromBlock =
    options.fromBlock ??
    (cp ? cp.lastProcessedBlock + 1n : latestBlock > REORG_WINDOW ? latestBlock - REORG_WINDOW : 0n);

  const safeFromBlock = fromBlock > REORG_WINDOW ? fromBlock - REORG_WINDOW : 0n;
  const safeToBlock = latestBlock;

  const logs = await client.getLogs({
    address: COURTYARD_ORDERBOOK,
    event: tradeExecutedEvent,
    fromBlock: safeFromBlock,
    toBlock: safeToBlock,
  });

  const upserts: NormalizedListingUpsert[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const blockTimestampCache = new Map<bigint, bigint>();

  for (const log of logs) {
    if (log.topics[0] !== tradeExecutedTopic) continue;
    try {
      if (!log.args) {
        errors.push({
          sourceId: `${log.transactionHash}-${log.logIndex}`,
          message: "Trade log matched topic but args were undefined",
        });
        continue;
      }
      const { asker, nftTokenId, erc20Token, amount, feeAccrued } = log.args;
      if (!nftTokenId || !erc20Token || amount == null) continue;

      let metadata: MetadataPayload | null = null;
      let metadataError: string | null = null;
      try {
        const tokenUri = await client.readContract({
          address: COURTYARD_REGISTRY,
          abi: erc721Abi,
          functionName: "tokenURI",
          args: [nftTokenId],
        });
        metadata = await fetchTokenMetadata(tokenUri);
      } catch (err) {
        metadataError = err instanceof Error ? err.message : "tokenURI/read metadata failed";
        await appendUnknownTokenLog({
          nftTokenId: nftTokenId.toString(),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber?.toString(),
          error: metadataError,
        });
      }
      const attrs = attrMap(metadata?.attributes);

      const grader = normalizeGrader(attrs.get("grader") || attrs.get("grading_company"));
      const gradeValue = attrs.get("grade") || attrs.get("grade_value");
      const gradeNormalized = normalizeGrade(gradeValue, grader);

      const categoryRaw = attrs.get("category") || attrs.get("game") || attrs.get("collectible_type");
      const categoryL1 = normalizeCategory(categoryRaw);
      const categoryL2 = attrs.get("sport") || attrs.get("sub_category");

      const isUsdc = getAddress(erc20Token) === POLYGON_USDC;
      const amountFormatted = formatUnits(amount, isUsdc ? 6 : 18);

      const images = parseImages(metadata || {}, attrs);
      const imageUrl = images[0]?.url || "https://placehold.co/600x800/png?text=No+Image";

      const sourceListingId = `${log.transactionHash}-${log.logIndex}`;

      let soldAt: bigint | undefined;
      if (log.blockNumber) {
        soldAt = blockTimestampCache.get(log.blockNumber);
        if (!soldAt) {
          soldAt = (await client.getBlock({ blockNumber: log.blockNumber })).timestamp;
          blockTimestampCache.set(log.blockNumber, soldAt);
        }
      }

      upserts.push({
        sourcePlatform: "courtyard",
        sourceListingId,
        sourceItemId: nftTokenId.toString(),
        sourceUrl: `https://marketplace.courtyard.io/asset/${nftTokenId.toString()}`,
        title: metadata?.name || `Courtyard Collectible #${nftTokenId.toString()}`,
        description: metadata?.description,
        imageUrl,
        images,
        categoryL1,
        categoryL2,
        franchise: attrs.get("franchise") || attrs.get("game"),
        setName: attrs.get("set") || attrs.get("set_name"),
        cardNumber: attrs.get("card_number") || attrs.get("number"),
        year: attrs.get("year") ? Number(attrs.get("year")) : undefined,
        conditionType: gradeValue ? "graded" : "unknown",
        grader,
        gradeValue,
        gradeNormalized,
        gradeLabelRaw: attrs.get("grade_label"),
        listingType: "fixed_price",
        priceAmount: amountFormatted,
        priceCurrency: isUsdc ? "USDC" : "TOKEN",
        priceUsd: isUsdc ? amountFormatted : undefined,
        lastPriceUpdateAt: new Date().toISOString(),
        chainId: CHAIN_ID,
        contractAddress: COURTYARD_REGISTRY,
        tokenId: nftTokenId.toString(),
        tokenStandard: "erc721",
        vaulted: true,
        redeemable: attrs.get("redeemable")?.toLowerCase() === "true",
        authProvider: grader !== "none" ? grader.toUpperCase() : undefined,
        listingStatus: "sold",
        soldAt: soldAt ? new Date(Number(soldAt) * 1000).toISOString() : undefined,
        sellerAddress: asker,
        sellerHandle: undefined,
        sellerVerified: false,
        syncConfidence: metadata ? 80 : 30,
        dataQualityFlags: {
          missingMetadata: !metadata,
          metadataError,
          paymentToken: erc20Token,
          feeAccrued: feeAccrued?.toString(),
        },
        rawSourcePayload: { log, metadata },
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : "Unknown Courtyard log parse error" });
    }
  }

  const checkpoint: AdapterCheckpoint = {
    chainId: CHAIN_ID,
    lastProcessedBlock: safeToBlock,
    updatedAt: new Date().toISOString(),
  };

  await writeCheckpoint(checkpoint);

  return {
    upserts,
    tombstones: [],
    errors,
    checkpoint,
  };
}

export async function discoverCourtyardEventSignatures(options: CourtyardDiscoveryOptions): Promise<Record<string, number>> {
  const client = createPublicClient({ transport: http(options.rpcUrl || DEFAULT_RPC) });
  const logs = await client.getLogs({
    address: COURTYARD_ORDERBOOK,
    fromBlock: options.fromBlock,
    toBlock: options.toBlock,
  });

  const signatures: Record<string, number> = {};
  for (const log of logs) {
    const sig = log.topics[0] || "unknown";
    signatures[sig] = (signatures[sig] || 0) + 1;
  }

  return signatures;
}

export async function decodeKnownCourtyardTradeCount(options: CourtyardDiscoveryOptions): Promise<number> {
  const client = createPublicClient({ transport: http(options.rpcUrl || DEFAULT_RPC) });
  const logs = await client.getLogs({
    address: COURTYARD_ORDERBOOK,
    fromBlock: options.fromBlock,
    toBlock: options.toBlock,
  });

  let decoded = 0;
  for (const log of logs) {
    try {
      decodeEventLog({ abi: [tradeExecutedEvent], data: log.data, topics: log.topics });
      decoded += 1;
    } catch {
      // ignore non TradeExecuted events
    }
  }

  return decoded;
}
