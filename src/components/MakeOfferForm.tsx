"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Props = { listingId: string };

type OfferState = "idle" | "submitting" | "success" | "error";

export default function MakeOfferForm({ listingId }: Props) {
  const { authenticated, user } = usePrivy();
  const [offerAmount, setOfferAmount] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<OfferState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const linkedWallet = authenticated
    ? (user?.linkedAccounts ?? []).find(
        (a: { type?: string; address?: string }) =>
          (a.type === "wallet" || a.type === "smart_wallet") && a.address,
      )
    : null;

  const effectiveAddress =
    buyerAddress.trim() ||
    (linkedWallet as { address?: string } | null)?.address ||
    "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveAddress || !offerAmount || Number.isNaN(Number(offerAmount))) {
      setErrorMsg("Wallet address and a valid offer amount are required.");
      return;
    }

    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/listings/${listingId}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerPrivyUserId: authenticated ? user?.id : undefined,
          buyerAddress: effectiveAddress,
          offerAmount,
          offerCurrency: "USDC",
          expiryDays: Number(expiryDays) || 7,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to submit offer");
      }

      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="border-2 border-[#FEDB02] bg-[#111] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FEDB02]">
          Offer submitted
        </p>
        <p className="mt-2 text-lg font-black">{offerAmount} USDC</p>
        <p className="mt-2 text-sm text-white/70">
          Your offer has been recorded. The seller will be notified.
        </p>
        <button
          onClick={() => {
            setState("idle");
            setOfferAmount("");
            setNotes("");
          }}
          className="mt-4 border border-white/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75"
        >
          Make another offer
        </button>
      </div>
    );
  }

  return (
    <div className="border-2 border-white/20 bg-[#111] p-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">
        Make an offer
      </p>
      <p className="mt-2 text-sm text-white/60">
        Submit a USDC offer. No on-chain signing yet — the seller reviews and contacts you.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
            Offer amount (USDC)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            placeholder="e.g. 250.00"
            required
            className="mt-1 w-full border border-white/20 bg-black/40 px-3 py-2 text-sm font-bold text-white placeholder-white/30 focus:border-[#FEDB02] focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
            Your wallet address
          </label>
          {linkedWallet ? (
            <div className="mt-1 flex items-center gap-2">
              <p className="flex-1 border border-[#FEDB02]/40 bg-black/40 px-3 py-2 text-sm font-mono text-white/80 break-all">
                {(linkedWallet as { address?: string }).address}
              </p>
              <span className="border border-[#FEDB02] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#FEDB02]">
                Linked
              </span>
            </div>
          ) : (
            <input
              type="text"
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              placeholder="0x... or Solana address"
              required
              className="mt-1 w-full border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#FEDB02] focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
            Offer valid for
          </label>
          <select
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            className="mt-1 w-full border border-white/20 bg-black px-3 py-2 text-sm text-white focus:border-[#FEDB02] focus:outline-none"
          >
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any message to the seller"
            className="mt-1 w-full border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#FEDB02] focus:outline-none"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={state === "submitting"}
          className="w-full border-2 border-[#FEDB02] bg-[#FEDB02] py-3 font-mono text-xs font-black uppercase tracking-[0.2em] text-black disabled:opacity-60"
        >
          {state === "submitting" ? "Submitting..." : "Submit offer"}
        </button>
      </form>
    </div>
  );
}
