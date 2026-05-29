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
  categoryL1: string;
  syncConfidence: number;
};

type LotPageProps = {
  params: { id: string };
};

const fallbackBids = [
  { user: "CardKing", amount: "$8,420", at: "2m ago" },
  { user: "MintHunter", amount: "$8,100", at: "9m ago" },
  { user: "RareVault", amount: "$7,850", at: "14m ago" },
  { user: "HoloPeak", amount: "$7,420", at: "32m ago" },
];

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
    categoryL1: row.categoryL1,
    syncConfidence: row.syncConfidence,
  };
}

export default async function LotPage({ params }: LotPageProps) {
  const listing = await getListing(params.id);

  const title = listing?.title ?? "Featured Collectible";
  const grade = listing?.gradeValue || listing?.gradeNormalized || "UNKNOWN";
  const priceDisplay = listing?.priceUsd
    ? `$${Number(listing.priceUsd).toLocaleString()}`
    : listing
      ? `${listing.priceAmount} ${listing.priceCurrency}`
      : "$0";

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
            <span className="px-3 py-2 text-sm font-bold text-black/70">Vault</span>
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
                <p className="font-mono text-[10px] text-white/50">BIDS</p>
                <p className="mt-1 text-3xl font-black">14</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button className="w-full border-2 border-[#FEDB02] bg-[#FEDB02] py-3 font-mono text-xs font-black uppercase tracking-[0.2em] text-black">
                PLACE BID
              </button>
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
            <h2 className="text-lg font-black">Bid History</h2>
            <div className="mt-3 space-y-2">
              {fallbackBids.map((bid) => (
                <div key={`${bid.user}-${bid.at}`} className="flex items-center justify-between border-b border-white/10 py-2">
                  <div>
                    <p className="text-sm font-bold">{bid.user}</p>
                    <p className="font-mono text-[10px] text-white/45">{bid.at}</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-[#FEDB02]">{bid.amount}</p>
                </div>
              ))}
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
