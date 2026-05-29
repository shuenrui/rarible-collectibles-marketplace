"use client";

import { useState } from "react";

type PackRipModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function PackRipModal({ open, onClose }: PackRipModalProps) {
  const [revealed, setRevealed] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-xl border-2 border-[#FEDB02] bg-[#111] p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">PACK RIP</h2>
          <button onClick={onClose} className="font-mono text-xs tracking-[0.2em] text-white/70">CLOSE</button>
        </div>

        <p className="font-mono text-[11px] text-[#FEDB02]">DAILY PACK · BOLD SPORT</p>

        <div className="mt-4 border-2 border-black bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 p-5">
          <div className="mx-auto aspect-[3/4] w-44 border-2 border-black bg-black/20" />
        </div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="mt-5 w-full border-2 border-[#FEDB02] bg-[#FEDB02] py-3 font-mono text-xs font-black uppercase tracking-[0.2em] text-black"
          >
            RIP PACK
          </button>
        ) : (
          <div className="mt-5 border border-white/20 bg-black/30 p-4">
            <p className="font-mono text-[10px] text-white/55">REVEALED CARD</p>
            <p className="mt-1 text-lg font-black text-[#FEDB02]">Mew Promo '99 · PSA 10</p>
            <p className="text-sm text-white/75">Estimated value: $3,200</p>
          </div>
        )}
      </div>
    </div>
  );
}
