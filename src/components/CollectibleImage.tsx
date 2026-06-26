"use client";

import { useMemo, useState } from "react";

type CollectibleImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  title?: string;
};

function initialsFromTitle(title?: string) {
  const words = (title ?? "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return "RC";

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export default function CollectibleImage({
  src,
  alt,
  className = "h-full w-full object-cover",
  title,
}: CollectibleImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = failed || !src;
  const initials = useMemo(() => initialsFromTitle(title ?? alt), [alt, title]);

  if (showFallback) {
    return (
      <div className={`relative overflow-hidden bg-[#111] ${className}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(254,219,2,0.28),_transparent_48%),linear-gradient(160deg,_#1a1a1a,_#050505)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,transparent_46%,rgba(254,219,2,0.16)_46%,rgba(254,219,2,0.16)_54%,transparent_54%,transparent_100%)]" />
        <div className="absolute left-3 top-3 border border-[#FEDB02]/35 bg-black/45 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">
          Image unavailable
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/30 text-xl font-black text-white/75">
            {initials}
          </div>
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
            Rarible Collectibles
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-white/40">
            {title ?? alt}
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
