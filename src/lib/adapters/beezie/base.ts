import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  erc721Abi,
  formatUnits,
  getAddress,
  http,
  parseAbiItem,
} from "viem";
import type { AdapterCheckpoint, AdapterOutput, ListingImage, NormalizedListingUpsert } from "@/lib/adapters/types";

const CHAIN_ID = 8453;
const REORG_WINDOW = 64n;
const DEFAULT_RPC = "https://mainnet.base.org";
const BEEZIE_BASE_ROUTER = getAddress("0x80d7C04B738eF379971a6b73f25B1A71ea1c820D");

const WETH_BASE = getAddress("0x4200000000000000000000000000000000000006");
const USDC_BASE = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

const bidFulfilledEvent = parseAbiItem(
  "event BidFulfilled(address bidder, address fulfiller, uint256 salt, address paymentToken, uint256 bidAmount, address collection, uint256 tokenId)",
);
const saltUsedEvent = parseAbiItem("event SaltUsed(address bidder, uint256 salt)");
const saltInvalidatedEvent = parseAbiItem("event SaltInvalidated(address bidder, uint256 salt)");

const checkpointFile = path.join(process.cwd(), ".checkpoints", "beezie-base.json");
const unknownMetadataFile = path.join(process.cwd(), ".checkpoints", "beezie-base-unknownTokens.log");

type BeezieIngestOptions = {
  rpcUrl?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
};

type MetadataAttribute = { trait_type?: string; value?: string | number | null };
type MetadataPayload = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: MetadataAttribute[];
};

type SaltStatus = "used" | "invalidated";

function normalizeIpfs(uri: string): string {
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  return uri;
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
  const c = (categoryRaw || "").toLowerCase();
  if (c.includes("pokemon")) return "pokemon";
  if (c.includes("one piece")) return "one_piece";
  if (c.includes("yu-gi-oh") || c.includes("yugioh")) return "yugioh";
  if (c.includes("comic")) return "comics";
  if (c.includes("sealed")) return "sealed_products";
  if (c.includes("sports") || c.includes("basketball") || c.includes("football") || c.includes("baseball")) return "sports_cards";
  return "other";
}

function normalizeGrader(raw?: string): NormalizedListingUpsert["grader"] {
  const v = (raw || "").toLowerCase();
  if (v.includes("psa")) return "psa";
  if (v.includes("bgs") || v.includes("beckett")) return "bgs";
  if (v.includes("cgc")) return "cgc";
  if (v.includes("sgc")) return "sgc";
  if (v.includes("fanatics")) return "fanatics";
  if (!v) return "none";
  return "other";
}

function normalizeGrade(gradeRaw?: string, grader?: NormalizedListingUpsert["grader"]): NormalizedListingUpsert["gradeNormalized"] {
  const g = (gradeRaw || "").toLowerCase().trim();
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
  if (back) out.push({ url: normalizeIpfs(back), type: "back" });
  return out;
}

function resolvePaymentToken(token: string): { symbol: string; decimals: number } {
  const normalized = getAddress(token);
  if (normalized === WETH_BASE) return { symbol: "WETH", decimals: 18 };
  if (normalized === USDC_BASE) return { symbol: "USDC", decimals: 6 };
  return { symbol: "TOKEN", decimals: 18 };
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

async function appendUnknownMetadata(entry: {
  collection: string;
  tokenId: string;
  txHash?: string;
  blockNumber?: string;
  error: string;
}): Promise<void> {
  await mkdir(path.dirname(unknownMetadataFile), { recursive: true });
  const line = JSON.stringify({ ...entry, recordedAt: new Date().toISOString() });
  await appendFile(unknownMetadataFile, `${line}\n`, "utf8");
}

export async function ingestBeezieBase(options: BeezieIngestOptions = {}): Promise<AdapterOutput> {
  const client = createPublicClient({ transport: http(options.rpcUrl || DEFAULT_RPC) });

  const latestBlock = options.toBlock ?? (await client.getBlockNumber());
  const cp = await readCheckpoint();
  const fromBlock =
    options.fromBlock ??
    (cp ? cp.lastProcessedBlock + 1n : latestBlock > REORG_WINDOW ? latestBlock - REORG_WINDOW : 0n);

  const safeFromBlock = fromBlock > REORG_WINDOW ? fromBlock - REORG_WINDOW : 0n;
  const safeToBlock = latestBlock;

  const [bidLogs, saltUsedLogs, saltInvalidatedLogs] = await Promise.all([
    client.getLogs({ address: BEEZIE_BASE_ROUTER, event: bidFulfilledEvent, fromBlock: safeFromBlock, toBlock: safeToBlock }),
    client.getLogs({ address: BEEZIE_BASE_ROUTER, event: saltUsedEvent, fromBlock: safeFromBlock, toBlock: safeToBlock }),
    client.getLogs({ address: BEEZIE_BASE_ROUTER, event: saltInvalidatedEvent, fromBlock: safeFromBlock, toBlock: safeToBlock }),
  ]);

  const upserts: NormalizedListingUpsert[] = [];
  const tombstones: string[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];

  const saltState = new Map<string, SaltStatus>();
  for (const l of saltUsedLogs) {
    const decoded = decodeEventLog({ abi: [saltUsedEvent], topics: l.topics, data: l.data });
    const args = decoded.args as { bidder: string; salt: bigint };
    saltState.set(`${args.bidder.toLowerCase()}:${args.salt.toString()}`, "used");
  }
  for (const l of saltInvalidatedLogs) {
    const decoded = decodeEventLog({ abi: [saltInvalidatedEvent], topics: l.topics, data: l.data });
    const args = decoded.args as { bidder: string; salt: bigint };
    saltState.set(`${args.bidder.toLowerCase()}:${args.salt.toString()}`, "invalidated");
  }

  const blockTimestampCache = new Map<bigint, bigint>();

  for (const log of bidLogs) {
    try {
      if (!log.args) {
        errors.push({ sourceId: `${log.transactionHash}-${log.logIndex}`, message: "BidFulfilled args undefined" });
        continue;
      }

      const { bidder, fulfiller, salt, paymentToken, bidAmount, collection, tokenId } = log.args;
      if (!bidder || !paymentToken || bidAmount == null || !collection || tokenId == null || salt == null) continue;

      const tokenContract = getAddress(collection);
      const tokenIdStr = tokenId.toString();

      let metadata: MetadataPayload | null = null;
      let metadataError: string | null = null;
      try {
        const tokenUri = await client.readContract({
          address: tokenContract,
          abi: erc721Abi,
          functionName: "tokenURI",
          args: [tokenId],
        });
        metadata = await fetchTokenMetadata(tokenUri);
      } catch (err) {
        metadataError = err instanceof Error ? err.message : "tokenURI/read metadata failed";
        await appendUnknownMetadata({
          collection: tokenContract,
          tokenId: tokenIdStr,
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

      const images = parseImages(metadata || {}, attrs);
      const imageUrl = images[0]?.url || "https://placehold.co/600x800/png?text=No+Image";

      const sourceListingId = `${log.transactionHash}-${log.logIndex}`;
      const payment = resolvePaymentToken(paymentToken);
      const amountFormatted = formatUnits(bidAmount, payment.decimals);

      let soldTs: bigint | undefined;
      if (log.blockNumber) {
        soldTs = blockTimestampCache.get(log.blockNumber);
        if (!soldTs) {
          soldTs = (await client.getBlock({ blockNumber: log.blockNumber })).timestamp;
          blockTimestampCache.set(log.blockNumber, soldTs);
        }
      }

      const saltKey = `${String(bidder).toLowerCase()}:${salt.toString()}`;

      upserts.push({
        sourcePlatform: "beezie",
        sourceListingId,
        sourceItemId: tokenIdStr,
        sourceUrl: `https://beezie.com/marketplace`,
        title: metadata?.name || `Beezie Collectible #${tokenIdStr}`,
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
        listingType: "offer",
        priceAmount: amountFormatted,
        priceCurrency: payment.symbol,
        priceUsd: payment.symbol === "USDC" ? amountFormatted : undefined,
        lastPriceUpdateAt: new Date().toISOString(),
        chainId: CHAIN_ID,
        contractAddress: tokenContract,
        tokenId: tokenIdStr,
        tokenStandard: "erc721",
        vaulted: true,
        redeemable: attrs.get("redeemable")?.toLowerCase() === "true",
        authProvider: grader !== "none" ? grader.toUpperCase() : undefined,
        listingStatus: "sold",
        soldAt: soldTs ? new Date(Number(soldTs) * 1000).toISOString() : undefined,
        sellerAddress: String(fulfiller),
        sellerVerified: false,
        syncConfidence: metadata ? 80 : 30,
        dataQualityFlags: {
          missingMetadata: !metadata,
          metadataError,
          paymentToken,
          saltState: saltState.get(saltKey) || null,
        },
        rawSourcePayload: {
          bidder,
          fulfiller,
          salt: salt.toString(),
          paymentToken,
          bidAmount: bidAmount.toString(),
          collection: tokenContract,
          tokenId: tokenIdStr,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
        },
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      errors.push({ sourceId: `${log.transactionHash}-${log.logIndex}`, message: err instanceof Error ? err.message : "Unknown Beezie log parse error" });
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
    tombstones,
    errors,
    checkpoint,
  };
}
