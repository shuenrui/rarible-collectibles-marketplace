"use client";

import { useMemo, useState } from "react";

type SellFlowModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function SellFlowModal({ open, onClose }: SellFlowModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [itemTitle, setItemTitle] = useState("");
  const [franchise, setFranchise] = useState("");
  const [grade, setGrade] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [auctionDuration, setAuctionDuration] = useState("");
  const [custodyMode, setCustodyMode] = useState("");
  const [feesAccepted, setFeesAccepted] = useState(false);

  const stepOneValid = itemTitle.trim().length > 0 && franchise.trim().length > 0 && grade.trim().length > 0;
  const priceValue = Number(listPrice);
  const buyNowValue = Number(buyNowPrice);
  const stepTwoValid = useMemo(() => {
    if (!Number.isFinite(priceValue) || priceValue <= 0) return false;
    if (!Number.isFinite(buyNowValue) || buyNowValue <= 0) return false;
    if (buyNowValue < priceValue) return false;
    if (!custodyMode) return false;
    if (!feesAccepted) return false;
    return true;
  }, [buyNowValue, custodyMode, feesAccepted, priceValue]);

  const reviewIssues = [
    !stepOneValid ? "Complete item metadata before review." : null,
    !Number.isFinite(priceValue) || priceValue <= 0 ? "Enter a valid listing price." : null,
    !Number.isFinite(buyNowValue) || buyNowValue <= 0 ? "Enter a valid buy-now price." : null,
    Number.isFinite(priceValue) && Number.isFinite(buyNowValue) && buyNowValue < priceValue
      ? "Buy-now price cannot be below the listing price."
      : null,
    !custodyMode ? "Select a custody path." : null,
    !feesAccepted ? "Acknowledge marketplace fees before publishing." : null,
  ].filter(Boolean) as string[];

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
            <input
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              className="border border-white/20 bg-black/30 px-3 py-2 text-sm"
              placeholder="Item title"
            />
            <input
              value={franchise}
              onChange={(e) => setFranchise(e.target.value)}
              className="border border-white/20 bg-black/30 px-3 py-2 text-sm"
              placeholder="Franchise / Set"
            />
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="border border-white/20 bg-black/30 px-3 py-2 text-sm"
              placeholder="Grade (e.g. PSA 10)"
            />
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="border border-white/20 bg-black/30 px-3 py-2 text-sm"
              placeholder="Card number"
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="border border-white/20 bg-black/30 px-3 py-2 text-sm"
                placeholder="List price (USD)"
              />
              <input
                value={buyNowPrice}
                onChange={(e) => setBuyNowPrice(e.target.value)}
                className="border border-white/20 bg-black/30 px-3 py-2 text-sm"
                placeholder="Buy now price (USD)"
              />
              <input
                value={auctionDuration}
                onChange={(e) => setAuctionDuration(e.target.value)}
                className="border border-white/20 bg-black/30 px-3 py-2 text-sm"
                placeholder="Auction duration (optional)"
              />
              <select
                value={custodyMode}
                onChange={(e) => setCustodyMode(e.target.value)}
                className="border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="">Select custody path</option>
                <option value="in_vault">Already vaulted with partner</option>
                <option value="ship_to_vault">Ship to vault after approval</option>
              </select>
            </div>
            <label className="flex items-start gap-2 border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={feesAccepted}
                onChange={(e) => setFeesAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>I understand marketplace fees and custody checks must be confirmed before this listing can go live.</span>
            </label>
            {!stepTwoValid ? (
              <p className="text-sm text-[#FEDB02]">
                Continue is locked until price, custody, and fees are valid.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 border border-white/20 bg-black/30 p-4">
            <p className="font-mono text-[10px] text-white/55">CONFIRM LISTING</p>
            <div className="mt-3 space-y-2 text-sm text-white/80">
              <p><span className="text-white/45">Item</span> · {itemTitle || "—"} {cardNumber ? `#${cardNumber}` : ""}</p>
              <p><span className="text-white/45">Collection</span> · {franchise || "—"} · {grade || "—"}</p>
              <p><span className="text-white/45">Pricing</span> · List ${listPrice || "—"} · Buy now ${buyNowPrice || "—"}</p>
              <p><span className="text-white/45">Custody</span> · {custodyMode === "in_vault" ? "Already vaulted with partner" : custodyMode === "ship_to_vault" ? "Ship to vault after approval" : "—"}</p>
            </div>
            {reviewIssues.length ? (
              <div className="mt-4 border border-red-400/40 bg-red-500/10 p-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Publish blocked</p>
                <ul className="mt-2 space-y-1 text-sm text-red-100">
                  {reviewIssues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-300">All required price, custody, and fee checks are valid.</p>
            )}
          </div>
        ) : null}

        <div className="mt-6 flex gap-2">
          {step > 1 ? (
            <button onClick={() => setStep((step - 1) as 1 | 2 | 3)} className="border-2 border-white/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em]">
              Back
            </button>
          ) : null}

          {step < 3 ? (
            <button
              onClick={() => setStep((step + 1) as 1 | 2 | 3)}
              disabled={(step === 1 && !stepOneValid) || (step === 2 && !stepTwoValid)}
              className="border-2 border-[#FEDB02] bg-[#FEDB02] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={onClose}
              disabled={reviewIssues.length > 0}
              className="border-2 border-[#FEDB02] bg-[#FEDB02] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Publish Listing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
