"use client";

import Link from "next/link";
import { useState } from "react";

const tickerItems = [
  "CHRZRD-1ED PSA10 $8,420 ▲2.1%",
  "MANTLE-52 PSA9 $12,200 ▲0.8%",
  "PIKA-ILL PSA8 $45,200 ▲4.6%",
  "JRDN-86 PSA10 $22,000 ▲3.4%",
  "SPDR-1 CGC96 $2,150 ▼1.2%",
  "BATMAN-1 RAW $220 —",
  "XMEN-1 CGC75 $3,900 ▼0.5%",
  "BRADY-RC PSA9 $1,810 ▲0.6%",
];

const movers = [
  { item: "Pikachu Illustrator '98", grade: "PSA 8", last: "$45,200", d24: "+4.6%", bids: 22 },
  { item: "Jordan Fleer Rookie #57", grade: "PSA 10", last: "$22,000", d24: "+3.4%", bids: 18 },
  { item: "Charizard 1st Ed Holo", grade: "PSA 10", last: "$8,420", d24: "+2.1%", bids: 14 },
  { item: "Spider-Man #1 (1963)", grade: "CGC 9.6", last: "$2,150", d24: "-1.2%", bids: 11 },
];

const endingSoon = [
  { title: "Blastoise Holo '99", bids: 9, ends: "00:18:22", price: "$2,840" },
  { title: "LeBron Rookie Auto", bids: 7, ends: "01:44:02", price: "$5,750" },
  { title: "Venusaur Holo 1st Ed.", bids: 6, ends: "02:05:10", price: "$1,920" },
];

const indices = [
  { cat: "Pokemon", idx: "142.4", d: "+2.4%" },
  { cat: "Sports Cards", idx: "118.8", d: "+1.1%" },
  { cat: "Comics", idx: "102.2", d: "-0.6%" },
  { cat: "One Piece", idx: "126.9", d: "+3.1%" },
];

const salesTape = [
  { time: "16:42", item: "Mew Promo '99", grade: "PSA 10", price: "$3,200", side: "BUY" },
  { time: "16:39", item: "Batman #1 (1940)", grade: "RAW", price: "$220", side: "SELL" },
  { time: "16:36", item: "Mantle '52 Topps", grade: "PSA 9", price: "$12,200", side: "BUY" },
  { time: "16:31", item: "Spider-Man #1", grade: "CGC 9.6", price: "$2,150", side: "SELL" },
];

const openBids = [
  { item: "Blastoise Holo '99", grade: "PSA 9", your: "$2,840", top: "$2,920", rank: "#2", ends: "00:18:22", status: "OUTBID" },
  { item: "LeBron Rookie Auto", grade: "PSA 10", your: "$5,750", top: "$5,750", rank: "#1", ends: "01:44:02", status: "WINNING" },
  { item: "Spider-Man #1", grade: "CGC 9.6", your: "$2,150", top: "$2,200", rank: "#2", ends: "03:05:10", status: "OUTBID" },
];

export default function TradersPage() {
  const [moverTab, setMoverTab] = useState<"gainers" | "losers" | "volume">("gainers");
  const [bidTab, setBidTab] = useState<"bids" | "listings" | "history">("bids");

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
          <div className="flex items-center gap-2 border-2 border-black p-0.5">
            <Link href="/" className="px-3 py-1 text-[10px] font-bold text-black/60">
              Browse &amp; collect
            </Link>
            <Link href="/traders" className="bg-black px-3 py-1 text-[10px] font-black text-[#FEDB02]">
              Trade &amp; track
            </Link>
          </div>
        </div>
      </header>

      <div className="overflow-hidden border-b-[3px] border-[#FEDB02] bg-black py-2">
        <div className="flex w-max animate-[ticker_35s_linear_infinite] gap-8 pl-6">
          {[...tickerItems, ...tickerItems].map((item, idx) => (
            <span key={`${item}-${idx}`} className={`font-mono text-xs ${item.includes("▲") ? "text-[#FEDB02]" : item.includes("▼") ? "text-red-500" : "text-white/50"}`}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className="border-b-[3px] border-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto mb-4 max-w-[1480px] border border-[#FEDB02]/40 bg-[#201800] px-4 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Demo trading console</p>
          <p className="mt-1 text-sm text-white/70">
            This page is placeholder market UI. Account balances, bids, P&amp;L, and sales tape are not live user data yet.
          </p>
        </div>
        <div className="mx-auto grid w-full max-w-[1480px] gap-2 md:grid-cols-6">
          {[
            { l: "Portfolio", v: "$48,240", d: "+$1,240" },
            { l: "24h P&L", v: "+$1,240", d: "5 closes" },
            { l: "Open bids", v: "12", d: "3 < 1h" },
            { l: "Watching", v: "84", d: "12 moved" },
            { l: "Sales·24h", v: "1,092", d: "$2.4M" },
            { l: "Live auctions", v: "982", d: "47 ending" },
          ].map((s) => (
            <div key={s.l} className="border border-white/10 bg-black/30 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{s.l}</p>
              <p className="mt-1 text-2xl font-black text-[#FEDB02]">{s.v}</p>
              <p className="font-mono text-[10px] text-white/45">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1480px] gap-4 px-4 py-6 md:grid-cols-12 md:px-8">
        <div className="md:col-span-8 space-y-4">
          <div className="border-2 border-white/20 bg-[#111] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-black">MARKET MOVERS</h2>
              <div className="flex gap-1">
                {(["gainers", "losers", "volume"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMoverTab(t)}
                    className={`px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${moverTab === t ? "bg-[#FEDB02] text-black" : "bg-black/40 text-white/60"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2 border-b border-white/10 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
              <span>#</span><span className="col-span-2">Item</span><span>Grade</span><span>Last Sale</span><span>Δ24h</span>
            </div>
            {movers.map((m, i) => (
              <div key={m.item} className="grid grid-cols-6 gap-2 border-b border-white/10 py-2 text-sm">
                <span className="font-mono text-xs text-white/45">{i + 1}</span>
                <span className="col-span-2 font-bold">{m.item}</span>
                <span>{m.grade}</span>
                <span>{m.last}</span>
                <span className={m.d24.startsWith("+") ? "text-[#FEDB02]" : "text-red-400"}>{m.d24}</span>
              </div>
            ))}
          </div>

          <div className="border-2 border-white/20 bg-[#111] p-4">
            <h2 className="mb-3 text-2xl font-black">RECENT SALES</h2>
            <div className="grid grid-cols-5 gap-2 border-b border-white/10 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
              <span>Time</span><span>Item</span><span>Grade</span><span>Price</span><span>Side</span>
            </div>
            {salesTape.map((s) => (
              <div key={`${s.time}-${s.item}`} className="grid grid-cols-5 gap-2 border-b border-white/10 py-2 text-sm">
                <span className="font-mono text-xs text-white/55">{s.time}</span>
                <span className="font-bold">{s.item}</span>
                <span>{s.grade}</span>
                <span>{s.price}</span>
                <span className={s.side === "BUY" ? "text-[#FEDB02]" : "text-white/60"}>{s.side}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-4 space-y-4">
          <div className="border-2 border-white/20 bg-[#111] p-4">
            <h2 className="mb-3 text-xl font-black">ENDING SOON</h2>
            {endingSoon.map((e) => (
              <div key={e.title} className="border-b border-white/10 py-2">
                <p className="font-bold">{e.title}</p>
                <p className="font-mono text-[10px] text-white/55">{e.bids} bids</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-xs text-red-400">{e.ends}</span>
                  <span className="font-bold">{e.price}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-2 border-white/20 bg-[#111] p-4">
            <h2 className="mb-3 text-xl font-black">CATEGORY INDICES</h2>
            {indices.map((r) => (
              <div key={r.cat} className="grid grid-cols-3 gap-2 border-b border-white/10 py-2 text-sm">
                <span className="font-bold">{r.cat}</span>
                <span>{r.idx}</span>
                <span className={r.d.startsWith("+") ? "text-[#FEDB02]" : "text-red-400"}>{r.d}</span>
              </div>
            ))}
          </div>

          <div className="border-2 border-white/20 bg-[#111] p-4">
            <div className="mb-3 flex gap-1">
              {(["bids", "listings", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBidTab(t)}
                  className={`px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${bidTab === t ? "bg-[#FEDB02] text-black" : "bg-black/40 text-white/60"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {openBids.map((b) => (
              <div key={b.item} className="border-b border-white/10 py-2 text-sm">
                <p className="font-bold">{b.item}</p>
                <p className="font-mono text-[10px] text-white/50">{b.grade} · rank {b.rank} · ends {b.ends}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span>Your {b.your} / Top {b.top}</span>
                  <span className={`px-2 py-0.5 font-mono text-[10px] ${b.status === "WINNING" ? "bg-[#FEDB02] text-black" : "border border-red-500 text-red-400"}`}>
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
