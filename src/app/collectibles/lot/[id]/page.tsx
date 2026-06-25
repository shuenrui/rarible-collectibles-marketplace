import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ConnectButton from "@/components/ConnectButton";
import BuyOnRaribleButton from "@/components/BuyOnRaribleButton";
import LotWishlistButton from "@/components/LotWishlistButton";

const PLATFORM_LABELS: Record<string, string> = {
  courtyard: "Courtyard",
  beezie: "Beezie",
  collector_crypt: "Collector Crypt",
  phygitals: "Phygitals",
};

const LISTING_TYPE_LABELS = {
  fixed_price: "Buy now",
  auction: "Auction",
  offer: "Offer",
} as const;

type ListingItem = {
  id: string;
  title: string;
  franchise: string | null;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string;
  gradeValue: string | null;
  gradeNormalized: string | null;
  priceAmount: string;
  priceCurrency: string;
  priceUsd: string | null;
  sourcePlatform: string;
  listingType: "fixed_price" | "auction" | "offer";
  sourceUrl: string;
  sourceItemId: string | null;
  categoryL1: string;
  syncConfidence: number;
};

type RecentSaleItem = {
  id: string;
  title: string;
  soldAt: string | null;
  priceDisplay: string;
  sourcePlatform: string;
};

type RecentSalesResult = {
  items: RecentSaleItem[];
  matchType: "exact" | "similar" | "none";
};

type CourtyardEstimate = {
  estimatedValueUsd: string | null;
  dealScore: string | null;
};

type LotPageProps = {
  params: { id: string };
};

function formatMoney(value: string | null): string {
  if (!value) return "N/A";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `$${num.toLocaleString()}`;
}

function formatDisplayPrice(
  priceUsd: string | null,
  priceAmount: string,
  priceCurrency: string,
): string {
  if (priceUsd) return formatMoney(priceUsd);
  return `${priceAmount} ${priceCurrency}`;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "recent";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recent";
  const deltaMs = Date.now() - d.getTime();
  const deltaDays = Math.floor(deltaMs / (1000 * 60 * 60 * 24));
  if (deltaDays <= 0) return "today";
  if (deltaDays === 1) return "1d ago";
  if (deltaDays < 30) return `${deltaDays}d ago`;
  return d.toLocaleDateString();
}

function getConfidenceMeta(raw: number | null | undefined) {
  const clamped = Math.max(0, Math.min(100, Math.round(raw ?? 0)));
  if (clamped >= 85) return { percent: clamped, label: "High", tone: "text-emerald-300" };
  if (clamped >= 60) return { percent: clamped, label: "Medium", tone: "text-[#FEDB02]" };
  return { percent: clamped, label: "Low", tone: "text-red-300" };
}

async function getListing(id: string): Promise<ListingItem | null> {
  const exact = await prisma.collectibleListing.findUnique({
    where: { id },
  });

  // Only fetch the fallback when the exact ID wasn't found; use PK-desc
  // with no WHERE so Postgres reads exactly 1 row from the index.
  const row =
    exact ??
    (await prisma.collectibleListing.findFirst({
      orderBy: { id: "desc" },
    }));

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    franchise: row.franchise,
    setName: row.setName,
    cardNumber: row.cardNumber,
    imageUrl: row.imageUrl,
    gradeValue: row.gradeValue,
    gradeNormalized: row.gradeNormalized,
    priceAmount: String(row.priceAmount),
    priceCurrency: row.priceCurrency,
    priceUsd: row.priceUsd ? String(row.priceUsd) : null,
    sourcePlatform: row.sourcePlatform,
    listingType: row.listingType,
    sourceUrl: row.sourceUrl,
    sourceItemId: row.sourceItemId,
    categoryL1: row.categoryL1,
    syncConfidence: row.syncConfidence,
  };
}

async function getCourtyardEstimate(listing: ListingItem): Promise<CourtyardEstimate | null> {
  if (listing.sourcePlatform !== "courtyard" || !listing.sourceItemId) return null;

  try {
    const res = await fetch(
      `https://Y8TL3M06QA-dsn.algolia.net/1/indexes/marketplace_prod_recently_listed/${encodeURIComponent(listing.sourceItemId)}`,
      {
        headers: {
          "X-Algolia-Application-Id": "Y8TL3M06QA",
          "X-Algolia-API-Key": "3b3ed18284ca0baee9a496aea5f093d6",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;

    const estimatedValueUsd =
      json.estimatedValueUsd != null ? String(json.estimatedValueUsd) : null;
    const dealScore = json.dealScore != null ? String(json.dealScore) : null;

    return { estimatedValueUsd, dealScore };
  } catch {
    return null;
  }
}

// Exclude NFT/crypto contamination from physical card comp results
const CONTAMINATION_EXCLUDE = ["moonbird", "nft", "pfp", "pixel", "ape", "bayc", "azuki", "pudgy"];

function buildCompWhere(listing: ListingItem, status: "sold" | "active") {
  return {
    listingStatus: status,
    categoryL1: listing.categoryL1 as never,
    ...(status === "sold" && listing.gradeNormalized
      ? { gradeNormalized: listing.gradeNormalized as never }
      : {}),
    id: { not: listing.id },
    NOT: CONTAMINATION_EXCLUDE.map((kw) => ({
      title: { contains: kw, mode: "insensitive" as const },
    })),
  };
}

function buildExactCompWhere(listing: ListingItem) {
  const exactWhere = {
    listingStatus: "sold" as const,
    categoryL1: listing.categoryL1 as never,
    id: { not: listing.id },
    ...(listing.gradeNormalized
      ? { gradeNormalized: listing.gradeNormalized as never }
      : {}),
    ...(listing.cardNumber ? { cardNumber: listing.cardNumber } : {}),
    ...(listing.setName ? { setName: listing.setName } : {}),
    ...(listing.franchise ? { franchise: listing.franchise } : {}),
    title: listing.title,
    NOT: CONTAMINATION_EXCLUDE.map((kw) => ({
      title: { contains: kw, mode: "insensitive" as const },
    })),
  };

  return exactWhere;
}

function mapRecentSales(rows: Array<{
  id: string;
  title: string;
  soldAt: Date | null;
  lastPriceUpdateAt: Date;
  priceUsd: { toString(): string } | null;
  priceAmount: { toString(): string };
  priceCurrency: string;
  sourcePlatform: string;
}>): RecentSaleItem[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    soldAt: row.soldAt ? row.soldAt.toISOString() : row.lastPriceUpdateAt.toISOString(),
    priceDisplay: formatDisplayPrice(
      row.priceUsd ? String(row.priceUsd) : null,
      String(row.priceAmount),
      row.priceCurrency,
    ),
    sourcePlatform: row.sourcePlatform,
  }));
}

async function getRecentSales(listing: ListingItem): Promise<RecentSalesResult> {
  try {
    const exactRows = await prisma.collectibleListing.findMany({
      where: buildExactCompWhere(listing),
      orderBy: [{ soldAt: "desc" }, { lastPriceUpdateAt: "desc" }],
      take: 3,
    });

    if (exactRows.length) {
      return { items: mapRecentSales(exactRows), matchType: "exact" };
    }

    const soldRows = await prisma.collectibleListing.findMany({
      where: buildCompWhere(listing, "sold"),
      orderBy: [{ soldAt: "desc" }, { lastPriceUpdateAt: "desc" }],
      take: 3,
    });

    if (soldRows.length) {
      return { items: mapRecentSales(soldRows), matchType: "similar" };
    }

    const activeRows = await prisma.collectibleListing.findMany({
          where: buildCompWhere(listing, "active"),
          orderBy: [{ priceUsd: "asc" }, { lastPriceUpdateAt: "desc" }],
          take: 3,
        });

    return {
      items: mapRecentSales(activeRows),
      matchType: activeRows.length ? "similar" : "none",
    };
  } catch {
    return { items: [], matchType: "none" };
  }
}

export default async function LotPage({ params }: LotPageProps) {
  const listing = await getListing(params.id);
  const recentSalesResult = listing ? await getRecentSales(listing) : { items: [], matchType: "none" as const };
  const recentSales = recentSalesResult.items;
  const courtyardEstimate = listing ? await getCourtyardEstimate(listing) : null;

  const title = listing?.title ?? "Featured Collectible";
  const grade = listing?.gradeValue || listing?.gradeNormalized || "Ungraded";
  const priceDisplay = listing
    ? formatDisplayPrice(listing.priceUsd, listing.priceAmount, listing.priceCurrency)
    : "$0";
  const askUsd = listing?.priceUsd ? Number(listing.priceUsd) : Number.NaN;

  // Courtyard listings get official market estimate from Algolia
  // Other sources derive estimate from median of recent comparable sales
  let estUsd = courtyardEstimate?.estimatedValueUsd
    ? Number(courtyardEstimate.estimatedValueUsd)
    : Number.NaN;

  if (!Number.isFinite(estUsd) && recentSales.length >= 2) {
    const salePrices = recentSales
      .map((s) => {
        const m = s.priceDisplay.match(/\$([\d,]+)/);
        return m ? Number(m[1].replace(/,/g, "")) : Number.NaN;
      })
      .filter((n) => Number.isFinite(n) && n > 0);

    if (salePrices.length >= 2) {
      salePrices.sort((a, b) => a - b);
      const mid = Math.floor(salePrices.length / 2);
      estUsd =
        salePrices.length % 2 === 0
          ? (salePrices[mid - 1] + salePrices[mid]) / 2
          : salePrices[mid];
    }
  }

  const hasDealChip = Number.isFinite(askUsd) && Number.isFinite(estUsd);
  const isGoodDeal = hasDealChip ? askUsd < estUsd : false;
  const dealScoreDisplay =
    courtyardEstimate?.dealScore ??
    (hasDealChip ? (isGoodDeal ? "Below median" : "Above median") : "N/A");
  const sourceLabel = listing ? (PLATFORM_LABELS[listing.sourcePlatform] ?? listing.sourcePlatform) : "Unknown";
  const listingTypeLabel = listing ? LISTING_TYPE_LABELS[listing.listingType] : "Listing";
  const confidence = getConfidenceMeta(listing?.syncConfidence);
  const recentSalesHeading =
    recentSalesResult.matchType === "exact" ? "Recent Sales" : "Similar Market Activity";

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/collectibles" className="hidden px-3 py-2 text-sm font-bold text-black md:block">
              Marketplace
            </Link>
            <ConnectButton />
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-8 md:px-8 lg:grid-cols-[1fr_420px]">
        <article className="bg-[#111]">
          <div className="relative aspect-[3/4] bg-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing?.imageUrl ?? "https://placehold.co/600x800/png?text=No+Image"}
              alt={title}
              className="h-full w-full object-cover"
            />
            <div className="absolute left-3 top-3 bg-black/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              {grade}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-[11px] text-white/40">Item · {(listing?.id ?? params.id).slice(0, 12)}…</p>
            <p className="text-[11px] text-white/40">Listed via {sourceLabel}</p>
          </div>
        </article>

        <aside className="space-y-5">
          <div className="border-2 border-white/20 bg-[#111] p-5">
              <p className="text-[10px] font-semibold text-white/40">
              {listing?.categoryL1 ?? "Collectible"} · {listingTypeLabel} · Listed on {sourceLabel}
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight">{title}</h1>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="border border-white/20 bg-black/30 p-3">
                <p className="font-mono text-[10px] text-white/50">ASKING PRICE</p>
                <p className="mt-1 text-3xl font-black">{priceDisplay}</p>
              </div>
              <div className="border border-white/20 bg-black/30 p-3">
                <p className="font-mono text-[10px] text-white/50">DEAL SCORE</p>
                <p className="mt-1 text-3xl font-black">{dealScoreDisplay}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="border border-white/20 bg-black/30 p-3">
                <p className="font-mono text-[10px] text-white/50">
                  MARKET ESTIMATE
                  {!courtyardEstimate && Number.isFinite(estUsd) ? (
                    <span className="ml-1 text-white/30">(from recent sales)</span>
                  ) : null}
                </p>
                <p className="mt-1 text-2xl font-black">
                  {Number.isFinite(estUsd) ? formatMoney(String(estUsd)) : "N/A"}
                </p>
                {hasDealChip ? (
                  <span
                    className={`mt-2 inline-flex px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] ${
                      isGoodDeal ? "bg-emerald-400 text-black" : "bg-red-500 text-white"
                    }`}
                  >
                    {isGoodDeal ? "Good deal" : "Above estimate"}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Source trust mark — shown before CTA so high-ticket buyers see who holds the item */}
            <div className="mt-6 flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-[10px] text-emerald-400">✓</span>
              <p className="text-[11px] text-white/60">
                Listed on{" "}
                <span className="font-bold text-white/80">{sourceLabel}</span>
                {" · "}
                Physical item in verified vault
                {" · "}
                Sync confidence{" "}
                <span className={`font-bold ${confidence.tone}`}>
                  {confidence.label} ({confidence.percent}%)
                </span>
              </p>
            </div>

            <div className="mt-3 space-y-3">
              <LotWishlistButton listingId={listing?.id ?? params.id} />
              {listing ? (
                <BuyOnRaribleButton
                  listingId={listing.id}
                  sourcePlatform={listing.sourcePlatform}
                />
              ) : null}
              <a
                href={listing?.sourceUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block w-full border-2 border-white/25 bg-transparent py-3 text-center text-xs font-bold text-white/60 hover:text-white"
              >
                View on {sourceLabel} ↗
              </a>
            </div>
          </div>

          <div className="border-2 border-white/20 bg-[#111] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">{recentSalesHeading}</h2>
              {recentSalesResult.matchType === "similar" ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                  same category / grade
                </span>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {recentSales.length ? (
                recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between border-b border-white/10 py-2">
                    <div>
                      <p className="line-clamp-1 text-sm font-bold">{sale.title.slice(0, 25)}</p>
                      <p className="font-mono text-[10px] text-white/45">
                        {PLATFORM_LABELS[sale.sourcePlatform] ?? sale.sourcePlatform} · {formatShortDate(sale.soldAt)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-bold text-[#FEDB02]">{sale.priceDisplay}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/70">No exact or comparable sales yet for this category/grade.</p>
              )}
            </div>
          </div>

          <div className="border-2 border-white/20 bg-[#111] p-5">
            <h2 className="text-lg font-black">Provenance</h2>
            <div className="mt-3 space-y-0">
              <div className="flex items-start gap-3 border-b border-white/10 py-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-[11px] font-bold text-white">Listed on {sourceLabel}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">Physical item held in verified vault or custody</p>
                </div>
              </div>
              <div className="flex items-start gap-3 border-b border-white/10 py-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#FEDB02]" />
                <div>
                  <p className="text-[11px] font-bold text-white">Aggregated by Rarible Collectibles</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    Synced via API · confidence {confidence.label.toLowerCase()} ({confidence.percent}%)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-white/20" />
                <div>
                  <p className="text-[11px] font-bold text-white/50">On-chain settlement (after purchase)</p>
                  <p className="mt-0.5 text-[11px] text-white/30">Transfer recorded on-chain when item changes hands</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-2 border-white/10 bg-[#0D0D0D] p-5">
            <h2 className="text-sm font-black text-white/70">How it works</h2>
            <div className="mt-3 space-y-3 text-[11px] text-white/50">
              <p><span className="font-bold text-white/70">Physical custody</span> — Your item stays in a vetted vault until you redeem it. Ownership is tracked on-chain.</p>
              <p><span className="font-bold text-white/70">Buy directly here</span> — Pay via card or crypto. We settle the transaction through smart contract on your behalf.</p>
              <p><span className="font-bold text-white/70">Redeem anytime</span> — Request physical delivery from your vault dashboard. Shipping fees apply.</p>
            </div>
          </div>

          <Link
            href="/collectibles"
            className="inline-block border-2 border-white/25 px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white"
          >
            Back to Browse
          </Link>
        </aside>
      </section>
    </main>
  );
}
