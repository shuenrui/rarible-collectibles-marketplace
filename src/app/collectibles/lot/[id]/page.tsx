import Link from "next/link";
import { prisma } from "@/lib/prisma";

type ListingItem = {
  id: string;
  title: string;
  imageUrl: string;
  gradeValue: string | null;
  gradeNormalized: string | null;
  priceAmount: string;
  priceCurrency: string;
  priceUsd: string | null;
  sourcePlatform: string;
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

async function getListing(id: string): Promise<ListingItem | null> {
  const exact = await prisma.collectibleListing.findUnique({
    where: { id },
  });

  const row =
    exact ??
    (await prisma.collectibleListing.findFirst({
      where: { listingStatus: "active" },
      orderBy: { syncedAt: "desc" },
    }));

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    imageUrl: row.imageUrl,
    gradeValue: row.gradeValue,
    gradeNormalized: row.gradeNormalized,
    priceAmount: String(row.priceAmount),
    priceCurrency: row.priceCurrency,
    priceUsd: row.priceUsd ? String(row.priceUsd) : null,
    sourcePlatform: row.sourcePlatform,
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

async function getRecentSales(listing: ListingItem): Promise<RecentSaleItem[]> {
  const soldRows = await prisma.collectibleListing.findMany({
    where: {
      listingStatus: "sold",
      categoryL1: listing.categoryL1 as never,
      gradeNormalized: listing.gradeNormalized ? (listing.gradeNormalized as never) : undefined,
      id: { not: listing.id },
    },
    orderBy: [{ soldAt: "desc" }, { lastPriceUpdateAt: "desc" }],
    take: 3,
  });

  const rows = soldRows.length
    ? soldRows
    : await prisma.collectibleListing.findMany({
        where: {
          listingStatus: "active",
          categoryL1: listing.categoryL1 as never,
          id: { not: listing.id },
        },
        orderBy: [{ priceUsd: "asc" }, { lastPriceUpdateAt: "desc" }],
        take: 3,
      });

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

export default async function LotPage({ params }: LotPageProps) {
  const listing = await getListing(params.id);
  const recentSales = listing ? await getRecentSales(listing) : [];
  const courtyardEstimate = listing ? await getCourtyardEstimate(listing) : null;

  const title = listing?.title ?? "Featured Collectible";
  const grade = listing?.gradeValue || listing?.gradeNormalized || "UNKNOWN";
  const priceDisplay = listing
    ? formatDisplayPrice(listing.priceUsd, listing.priceAmount, listing.priceCurrency)
    : "$0";
  const askUsd = listing?.priceUsd ? Number(listing.priceUsd) : Number.NaN;
  const estUsd = courtyardEstimate?.estimatedValueUsd
    ? Number(courtyardEstimate.estimatedValueUsd)
    : Number.NaN;
  const hasDealChip = Number.isFinite(askUsd) && Number.isFinite(estUsd);
  const isGoodDeal = hasDealChip ? askUsd < estUsd : false;

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/collectibles" className="px-3 py-2 text-sm font-bold text-black">
              Marketplace
            </Link>
            <Link href="/vault" className="px-3 py-2 text-sm font-bold text-black/70">
              Vault
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-8 md:px-8 lg:grid-cols-[1fr_420px]">
        <article className="border-2 border-[#FEDB02] bg-[#1A1A1A] p-4">
          <div className="relative aspect-[3/4] border-2 border-black bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500">
            {listing?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.imageUrl}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="https://placehold.co/600x800/png?text=No+Image"
                alt="No image"
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute left-2 top-2 bg-black px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-[#FEDB02]">{grade}</div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="font-mono text-xs tracking-[0.2em] text-white/60">ITEM ID · {listing?.id ?? params.id}</p>
            <p className="font-mono text-xs tracking-[0.2em] text-red-400">LIVE · 00:42:18</p>
          </div>
        </article>

        <aside className="space-y-5">
          <div className="border-2 border-white/20 bg-[#111] p-5">
            <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#FEDB02]">FEATURED AUCTION</p>
            <h1 className="mt-2 text-3xl font-black leading-tight">{title}</h1>
            <p className="mt-2 text-sm text-white/70">
              {listing?.categoryL1 ?? "collectibles"} · source {listing?.sourcePlatform ?? "aggregator"}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="border border-white/20 bg-black/30 p-3">
                <p className="font-mono text-[10px] text-white/50">CURRENT BID</p>
                <p className="mt-1 text-3xl font-black">{priceDisplay}</p>
              </div>
              <div className="border border-white/20 bg-black/30 p-3">
                <p className="font-mono text-[10px] text-white/50">DEAL SCORE</p>
                <p className="mt-1 text-3xl font-black">{courtyardEstimate?.dealScore ?? "N/A"}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="border border-white/20 bg-black/30 p-3">
                <p className="font-mono text-[10px] text-white/50">MARKET ESTIMATE</p>
                <p className="mt-1 text-2xl font-black">{formatMoney(courtyardEstimate?.estimatedValueUsd ?? null)}</p>
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

            <div className="mt-6 space-y-3">
              <a
                href={listing?.sourceUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block w-full border-2 border-white/25 bg-transparent py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-white"
              >
                OPEN SOURCE LISTING
              </a>
            </div>
          </div>

          <div className="border-2 border-white/20 bg-[#111] p-5">
            <h2 className="text-lg font-black">Recent Sales</h2>
            <div className="mt-3 space-y-2">
              {recentSales.length ? (
                recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between border-b border-white/10 py-2">
                    <div>
                      <p className="line-clamp-1 text-sm font-bold">{sale.title.slice(0, 25)}</p>
                      <p className="font-mono text-[10px] text-white/45">
                        {sale.sourcePlatform} · {formatShortDate(sale.soldAt)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-bold text-[#FEDB02]">{sale.priceDisplay}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/70">No comparable sales yet for this category/grade.</p>
              )}
            </div>
          </div>

          <div className="border-2 border-white/20 bg-[#111] p-5">
            <h2 className="text-lg font-black">Provenance</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li>• Source platform: {listing?.sourcePlatform ?? "unknown"}</li>
              <li>• Category: {listing?.categoryL1 ?? "unknown"}</li>
              <li>• Last sync confidence: {listing?.syncConfidence ?? "n/a"}</li>
              <li>• On-chain / API settlement: recorded</li>
            </ul>
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
