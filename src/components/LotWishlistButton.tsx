"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Props = { listingId: string };

export default function LotWishlistButton({ listingId }: Props) {
  const { authenticated, user } = usePrivy();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!authenticated || !user?.id) {
      setLoaded(true);
      return;
    }
    fetch(`/api/user/wishlist?privy_user_id=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data: { items?: { listingId: string }[] }) => {
        setIsWishlisted((data.items ?? []).some((item) => item.listingId === listingId));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [authenticated, user?.id, listingId]);

  const toggle = async () => {
    if (!authenticated || !user?.id || pending) return;
    setPending(true);
    const next = !isWishlisted;
    setIsWishlisted(next);
    try {
      const res = await fetch("/api/user/wishlist", {
        method: isWishlisted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyUserId: user.id, listingId }),
      });
      if (!res.ok) setIsWishlisted(!next);
    } catch {
      setIsWishlisted(!next);
    } finally {
      setPending(false);
    }
  };

  if (!authenticated || !loaded) return null;

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`w-full border-2 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] transition disabled:opacity-60 ${
        isWishlisted
          ? "border-[#FEDB02] bg-[#FEDB02] text-black"
          : "border-white/25 bg-transparent text-white"
      }`}
    >
      {isWishlisted ? "♥ Wishlisted" : "♡ Add to Wishlist"}
    </button>
  );
}
