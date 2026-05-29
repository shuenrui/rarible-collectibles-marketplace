import Link from "next/link";

const ownedCards = [
  { title: "Charizard 1st Ed Holo", grade: "PSA 10", est: "$8,420", platform: "courtyard" },
  { title: "Jordan Fleer Rookie #57", grade: "PSA 10", est: "$22,000", platform: "beezie" },
  { title: "Pikachu Illustrator '98", grade: "PSA 8", est: "$45,200", platform: "courtyard" },
  { title: "Mantle '52 Topps #311", grade: "PSA 9", est: "$12,200", platform: "phygitals" },
  { title: "Mew Promo '99", grade: "PSA 10", est: "$3,200", platform: "courtyard" },
  { title: "Venusaur Holo 1st Ed.", grade: "PSA 9", est: "$1,920", platform: "beezie" },
];

const openBids = [
  { item: "Blastoise Holo '99", yourBid: "$2,840", topBid: "$2,920", endsIn: "00:18:22", status: "OUTBID" },
  { item: "LeBron Rookie Auto", yourBid: "$5,750", topBid: "$5,750", endsIn: "01:44:02", status: "WINNING" },
  { item: "Spider-Man #1 (1963)", yourBid: "$2,150", topBid: "$2,200", endsIn: "03:05:10", status: "OUTBID" },
];

export default function VaultPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>
          <div className="hidden flex-1 md:block">
            <Link href="/search" className="mx-auto block max-w-md bg-black/15 px-4 py-2 text-sm font-semibold text-black/60">
              Search cards, sets, players...
            </Link>
          </div>
          <Link href="/collectibles" className="font-mono text-[10px] font-bold tracking-[0.2em] text-black">
            MARKETPLACE
          </Link>
        </div>
      </header>

      <section className="border-b-[3px] border-[#FEDB02] bg-[#0A0A0A] px-4 py-6 md:px-8">
        <div className="mx-auto grid w-full max-w-[1480px] gap-2 md:grid-cols-3">
          <div className="border border-white/15 bg-black/30 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Portfolio Value</p>
            <p className="mt-2 text-4xl font-black text-[#FEDB02]">$48,240</p>
          </div>
          <div className="border border-white/15 bg-black/30 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Owned Items</p>
            <p className="mt-2 text-4xl font-black text-[#FEDB02]">126</p>
          </div>
          <div className="border border-white/15 bg-black/30 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Total P&L</p>
            <p className="mt-2 text-4xl font-black text-[#FEDB02]">+$1,240</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1480px] px-4 pb-10 pt-6 md:px-8">
        <div className="mb-6 flex border-b-2 border-white/10">
          {[
            { id: "collection", label: "COLLECTION" },
            { id: "bids", label: "BIDS" },
            { id: "history", label: "HISTORY" },
          ].map((tab, i) => (
            <div
              key={tab.id}
              className={`-mb-[2px] border-b-[3px] px-5 py-3 text-sm font-bold ${
                i === 0 ? "border-[#FEDB02] text-white" : "border-transparent text-white/45"
              }`}
            >
              {tab.label}
            </div>
          ))}
        </div>

        <div className="mb-10">
          <h2 className="mb-4 text-2xl font-black">OWNED COLLECTIBLES</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {ownedCards.map((card) => (
              <article key={card.title} className="overflow-hidden border-2 border-[#0A0A0A] bg-white text-[#0A0A0A]">
                <div className="relative aspect-[3/4] border-b-2 border-[#0A0A0A] bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-500">
                  <div className="absolute left-1 top-1 bg-[#0A0A0A] px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#FEDB02]">{card.grade}</div>
                </div>
                <div className="p-2">
                  <h3 className="line-clamp-2 min-h-[30px] text-xs font-bold leading-tight">{card.title}</h3>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-base font-black">{card.est}</p>
                    <span className="font-mono text-[9px] text-[#6B6B6B]">{card.platform}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-black">OPEN BIDS</h2>
          <div className="overflow-hidden border-2 border-white/20 bg-[#111]">
            <div className="grid grid-cols-5 gap-2 border-b border-white/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
              <span>Item</span>
              <span>Your Bid</span>
              <span>Top Bid</span>
              <span>Ends In</span>
              <span>Status</span>
            </div>
            {openBids.map((row) => (
              <div key={row.item} className="grid grid-cols-5 gap-2 border-b border-white/10 px-4 py-3 text-sm">
                <span className="font-bold">{row.item}</span>
                <span>{row.yourBid}</span>
                <span>{row.topBid}</span>
                <span className="font-mono text-xs text-red-400">{row.endsIn}</span>
                <span
                  className={`w-fit px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest ${
                    row.status === "WINNING" ? "bg-[#FEDB02] text-black" : "border border-red-500 text-red-400"
                  }`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
