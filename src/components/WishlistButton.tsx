"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Props = {
  listingId: string;
  isWishlisted: boolean;
  onToggle?: (listingId: string, nowWishlisted: boolean) => void;
  className?: string;
};

export default function WishlistButton({ listingId, isWishlisted, onToggle, className }: Props) {
  const { authenticated, user } = usePrivy();
  const [localWishlisted, setLocalWishlisted] = useState(isWishlisted);
  const [pending, setPending] = useState(false);

  if (!authenticated) return null;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id || pending) return;

    const next = !localWishlisted;
    setLocalWishlisted(next); // optimistic
    setPending(true);

    try {
      const res = await fetch("/api/user/wishlist", {
        method: localWishlisted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyUserId: user.id, listingId }),
      });
      if (!res.ok) {
        setLocalWishlisted(localWishlisted); // revert on failure
      } else {
        onToggle?.(listingId, next);
      }
    } catch {
      setLocalWishlisted(localWishlisted);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={localWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className={
        className ??
        "flex h-7 w-7 items-center justify-center text-base leading-none transition-opacity disabled:opacity-50"
      }
      aria-label={localWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      {localWishlisted ? (
        <span className="text-[#FEDB02]">♥</span>
      ) : (
        <span className="text-white/40 hover:text-white/80">♡</span>
      )}
    </button>
  );
}
