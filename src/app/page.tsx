import Link from "next/link";

const fandoms = [
  { name: "Pokemon", count: "3,201", tone: "bg-[#FEDB02] text-black" },
  { name: "Marvel", count: "612", tone: "bg-black text-[#FEDB02]" },
  { name: "Baseball", count: "2,104", tone: "bg-[#0066FF] text-white" },
  { name: "Yu-Gi-Oh", count: "612", tone: "bg-[#FF3B70] text-white" },
  { name: "NBA", count: "847", tone: "bg-[#0A0A0A] text-white" },
  { name: "One Piece", count: "389", tone: "bg-[#00B574] text-white" },
];

const hotLots = [
  { title: "Charizard 1st Ed Holo", grade: "PSA 10", price: "$8,420" },
  { title: "Pikachu Illustrator '98", grade: "PSA 8", price: "$45,200" },
  { title: "Mantle '52 Topps #311", grade: "PSA 9", price: "$12,200" },
  { title: "Jordan Fleer Rookie #57", grade: "PSA 10", price: "$22,000" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
          <div className="font-black tracking-tight text-black md:text-lg">RARIBLE COLLECTIBLES</div>
          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/collectibles" className="px-3 py-2 text-sm font-bold text-black">
              Marketplace
            </Link>
            <span className="px-3 py-2 text-sm font-bold text-black/70">Drops</span>
            <span className="px-3 py-2 text-sm font-bold text-black/70">Packs</span>
            <span className="px-3 py-2 text-sm font-bold text-black/70">Sell</span>
          </nav>
        </div>
      </header>

      <section className="border-b-[3px] border-[#FEDB02] px-4 py-16 md:px-8 md:py-20">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-5 inline-block bg-[#FEDB02] px-4 py-2 font-mono text-xs font-bold tracking-[0.2em] text-black">
              PSA 10 GEM MINT
            </div>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              BID ON
              <br />
              SOMETHING
              <br />
              <span className="text-[#FEDB02]">LEGENDARY.</span>
            </h1>
            <div className="mt-8 flex flex-wrap items-end gap-5">
              <p className="text-5xl font-black md:text-7xl">$8,420</p>
              <p className="font-mono text-xs tracking-widest text-white/60">TOP BID · 14 BIDS</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/collectibles"
                className="border-2 border-[#FEDB02] bg-[#FEDB02] px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-black"
              >
                Place Bid
              </Link>
              <Link
                href="/collectibles"
                className="border-2 border-white/40 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>

          <div className="border-2 border-[#FEDB02] bg-[#1A1A1A] p-4">
            <div className="aspect-[3/4] w-full border-2 border-black bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500" />
            <p className="mt-3 text-sm font-bold">1999 Pokemon Charizard 1st Edition</p>
            <p className="mt-1 font-mono text-xs text-[#FEDB02]">LIVE AUCTION · 00:42:18</p>
          </div>
        </div>
      </section>

      <section className="border-b-[3px] border-black bg-white px-4 py-14 text-black md:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black leading-none md:text-6xl">
              WHAT&apos;S YOUR <span className="bg-[#FEDB02] px-2">GAME?</span>
            </h2>
            <Link
              href="/collectibles"
              className="bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#FEDB02]"
            >
              All Universes
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fandoms.map((fandom) => (
              <Link key={fandom.name} href="/collectibles" className={`border-2 border-black p-5 ${fandom.tone}`}>
                <p className="text-2xl font-black">{fandom.name}</p>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] opacity-80">{fandom.count} listings</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F3F0E8] px-4 py-14 text-black md:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black leading-none md:text-6xl">HOT RIGHT NOW</h2>
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-red-600">982 AUCTIONS LIVE</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hotLots.map((lot) => (
              <Link key={lot.title} href="/collectibles" className="border-2 border-black bg-white p-3">
                <div className="aspect-[3/4] border-2 border-black bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-500" />
                <p className="mt-3 text-sm font-black leading-tight">{lot.title}</p>
                <p className="mt-1 font-mono text-xs">{lot.grade}</p>
                <p className="mt-2 text-xl font-black">{lot.price}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
