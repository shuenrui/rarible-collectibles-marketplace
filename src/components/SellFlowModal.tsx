"use client";

import { useState } from "react";

type SellFlowModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function SellFlowModal({ open, onClose }: SellFlowModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-2xl border-2 border-[#FEDB02] bg-[#111] p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">SELL FLOW</h2>
          <button onClick={onClose} className="font-mono text-xs tracking-[0.2em] text-white/70">CLOSE</button>
        </div>

        <p className="font-mono text-[11px] text-[#FEDB02]">STEP {step} / 3</p>

        {step === 1 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="Item title" />
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="Franchise / Set" />
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="Grade (e.g. PSA 10)" />
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="Card number" />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="List price (USD)" />
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="Buy now price" />
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="Auction duration" />
            <input className="border border-white/20 bg-black/30 px-3 py-2 text-sm" placeholder="Reserve price (optional)" />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 border border-white/20 bg-black/30 p-4">
            <p className="font-mono text-[10px] text-white/55">CONFIRM LISTING</p>
            <p className="mt-2 text-sm text-white/80">Review details and publish this listing to marketplace.</p>
          </div>
        ) : null}

        <div className="mt-6 flex gap-2">
          {step > 1 ? (
            <button onClick={() => setStep((step - 1) as 1 | 2 | 3)} className="border-2 border-white/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em]">
              Back
            </button>
          ) : null}

          {step < 3 ? (
            <button onClick={() => setStep((step + 1) as 1 | 2 | 3)} className="border-2 border-[#FEDB02] bg-[#FEDB02] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-black">
              Continue
            </button>
          ) : (
            <button onClick={onClose} className="border-2 border-[#FEDB02] bg-[#FEDB02] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-black">
              Publish Listing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
