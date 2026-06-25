export type DisplayListingType =
  | "fixed_price"
  | "auction"
  | "offer"
  | "fractional"
  | "preorder"
  | "pending"
  | "stale";

const LISTING_TYPE_LABELS: Record<DisplayListingType, string> = {
  fixed_price: "buy now",
  auction: "auction bid",
  offer: "offer",
  fractional: "fractional",
  preorder: "pre-order",
  pending: "source price pending",
  stale: "stale / unavailable",
};

export function getListingTypeLabel(listingType?: DisplayListingType | null): string {
  if (!listingType) return "listing";
  return LISTING_TYPE_LABELS[listingType] ?? "listing";
}

export function formatUsd(value: number, decimals = 2): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatUsdString(value: string | null | undefined, decimals = 2): string | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return formatUsd(parsed, decimals);
}

export function formatListingPrice(
  priceUsd: string | null | undefined,
  priceAmount: string | number,
  priceCurrency: string,
  listingType?: DisplayListingType | null,
): string {
  const usd = priceUsd ? Number(priceUsd) : Number.NaN;

  if (Number.isFinite(usd)) {
    if (usd >= 1) {
      return formatUsd(usd, 2);
    }

    const normalizedType = listingType ?? "fixed_price";
    return `${formatUsd(usd, 3)} (${getListingTypeLabel(normalizedType)})`;
  }

  return `${String(priceAmount)} ${priceCurrency}`;
}
