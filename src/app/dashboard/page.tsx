"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { formatListingPrice } from "@/lib/pricing";

// ─── types ───────────────────────────────────────────────────────────────────

type LinkedWallet = {
  address: string;
  chainType?: string;
  walletClientType?: string;
  connectorType?: string;
  type?: string;
};

type StoredWallet = LinkedWallet & {
  id: string;
  isEmbedded: boolean;
  isLinked: boolean;
  nativeBalance: string | null;
  usdcBalance: string | null;
  lastSyncedAt: string | null;
};

type CollectionItem = {
  id: string;
  title: string;
  imageUrl: string;
  gradeValue: string | null;
  gradeNormalized: string | null;
  priceAmount: string;
  priceCurrency: string;
  priceUsd: string | null;
  listingType?: "fixed_price" | "auction" | "offer";
  sourcePlatform: string;
  sourceUrl: string;
  listingStatus: string;
};

type WishlistEntry = {
  id: string;
  listingId: string;
  listing: CollectionItem & { sourceUrl: string };
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const SOL_PRICE = 168.0;
const ETH_PRICE = 3120.0;

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function chainLabel(chainType?: string): "EVM" | "SOL" {
  return chainType === "solana" ? "SOL" : "EVM";
}

function parseUSDC(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/([\d,]+\.?\d*)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}

function parseNative(s: string | null): { amount: number; sym: string } {
  if (!s) return { amount: 0, sym: "" };
  const m = s.match(/([\d.]+)\s+([A-Z]+)/);
  return m ? { amount: parseFloat(m[1]), sym: m[2] } : { amount: 0, sym: "" };
}

function fmtUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function actCat(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("offer")) return "offer";
  if (t.includes("wallet") || t.includes("deposit")) return "wallet";
  if (t.includes("wish")) return "wish";
  return "auth";
}

// ─── design tokens (inline styles) ───────────────────────────────────────────

const Y = "#FFE600";
const BG = "#0A0A0A";
const PANEL = "#0E0E0E";
const PANEL2 = "#131313";
const LINE = "rgba(255,255,255,.11)";
const LINE2 = "rgba(255,255,255,.055)";
const MUT = "#8C8C8C";
const MUT2 = "#5C5C5C";
const MONO = "var(--font-jetbrains-mono),'JetBrains Mono',ui-monospace,Menlo,monospace";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const labStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: Y, fontWeight: 500, whiteSpace: "nowrap" };
const labMutStyle: React.CSSProperties = { ...labStyle, color: MUT2 };
const numStyle: React.CSSProperties = { fontFamily: SANS, fontWeight: 800, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums" };
const panelStyle: React.CSSProperties = { background: PANEL, border: `1px solid ${LINE}`, display: "flex", flexDirection: "column", minHeight: 0 };
const phStyle: React.CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "13px 15px 11px", borderBottom: `1px solid ${LINE2}`, flex: "0 0 auto" };
const pbStyle: React.CSSProperties = { padding: "13px 15px", display: "flex", flexDirection: "column", minHeight: 0 };

// ─── sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ full, label = "Copy" }: { full: string; label?: string }) {
  const [ok, setOk] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const click = () => {
    try { navigator.clipboard?.writeText(full); } catch { /* noop */ }
    setOk(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setOk(false), 1100);
  };
  return (
    <button
      onClick={click}
      style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase",
        color: ok ? BG : MUT, border: `1px solid ${ok ? Y : LINE}`, background: ok ? Y : "transparent",
        padding: "6px 9px", cursor: "pointer", transition: ".12s", whiteSpace: "nowrap",
      }}
    >
      {ok ? "Copied ✓" : label}
    </button>
  );
}

function Eye({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: MUT, border: `1px solid ${LINE}`, padding: "6px 9px", cursor: "pointer", background: "transparent" }}>
      {hidden ? "◇ Show" : "◆ Hide"}
    </button>
  );
}

function Money({ n, hidden, size = 34, color = "#fff" }: { n: number; hidden: boolean; size?: number; color?: string }) {
  return <span style={{ ...numStyle, fontSize: size, color }}>{hidden ? "••••••" : fmtUSD(n)}</span>;
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = (name?.[0] ?? "?").toUpperCase();
  return (
    <div style={{ width: size, height: size, flex: "none", background: Y, color: BG, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: Math.round(size * 0.46) }}>
      {initial}
    </div>
  );
}

function ProfileIdentity({ name, email, size = 40 }: { name: string; email: string; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}>
      <Avatar name={name} size={size} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".01em", color: MUT2, marginTop: 3 }}>{email}</div>
      </div>
    </div>
  );
}

function WalletSlot({ w, hidden }: { w: StoredWallet; hidden: boolean }) {
  const chain = chainLabel(w.chainType);
  const chainColor = chain === "SOL" ? "#C99BFF" : "#8FA2FF";
  const chainBorder = chain === "SOL" ? "rgba(201,155,255,.4)" : "rgba(143,162,255,.4)";
  const usdc = parseUSDC(w.usdcBalance);
  const { amount: nat, sym } = parseNative(w.nativeBalance);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${LINE2}` }}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", padding: "5px 7px", border: `1px solid ${chainBorder}`, color: chainColor, minWidth: 42, textAlign: "center" }}>
        {chain}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: "#EDEDED", whiteSpace: "nowrap" }}>{truncateAddr(w.address)}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: MUT2, marginTop: 3 }}>
          {w.walletClientType || w.connectorType || "Privy · embedded"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ ...numStyle, fontSize: 13 }}>{hidden ? "••••" : (usdc > 0 ? fmtUSD(usdc) : "—")}</div>
        {sym && <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: MUT2, marginTop: 3 }}>{hidden ? `·· ${sym}` : `${nat.toFixed(sym === "SOL" ? 2 : 3)} ${sym}`}</div>}
      </div>
      <CopyBtn full={w.address} />
    </div>
  );
}

function BalanceMini({ wallets, hidden }: { wallets: StoredWallet[]; hidden: boolean }) {
  const usdc = wallets.reduce((a, w) => a + parseUSDC(w.usdcBalance), 0);
  const sol = wallets.filter(w => w.chainType === "solana").reduce((a, w) => a + parseNative(w.nativeBalance).amount * SOL_PRICE, 0);
  const eth = wallets.filter(w => w.chainType !== "solana").reduce((a, w) => a + parseNative(w.nativeBalance).amount * ETH_PRICE, 0);
  const rows: [string, number][] = [["USDC", usdc], ["SOL", sol], ["ETH", eth]];
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "baseline" }}>
      {rows.map(([k, v]) => (
        <span key={k} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".04em", color: MUT2 }}>
          {k}{" "}<span style={{ color: MUT, fontWeight: 500 }}>{hidden ? "••••" : fmtUSD(v)}</span>
        </span>
      ))}
    </div>
  );
}

const ACT_FILTERS: [string, string][] = [["all", "All"], ["offer", "Offers"], ["wallet", "Wallets"], ["wish", "Wishlist"], ["auth", "Logins"]];

function ActivityList({ items }: { items: ActivityItem[] }) {
  const [f, setF] = useState("all");
  const list = items.filter(a => f === "all" || actCat(a.type) === f);
  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4, flex: "0 0 auto" }}>
        {ACT_FILTERS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setF(k)}
            style={{
              fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase",
              color: f === k ? BG : MUT, border: `1px solid ${f === k ? Y : LINE}`,
              background: f === k ? Y : "transparent", padding: "5px 8px", cursor: "pointer",
              fontWeight: f === k ? 600 : 400, transition: ".12s",
            }}
          >{l}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {list.length === 0
          ? <div style={{ ...labMutStyle, padding: "18px 0" }}>No events</div>
          : list.map((a, i) => (
            <div key={a.id || i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${LINE2}` }}>
              <span style={{ width: 7, height: 7, flex: "0 0 auto", background: MUT2, borderRadius: "50%" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, fontWeight: 600, color: "#D6D6D6", lineHeight: 1.2 }}>{a.title}</span>
              <span style={{ ...labStyle, color: MUT2 }}>{a.type.replace(/_/g, " ")}</span>
              <span style={labMutStyle}>{timeAgo(a.createdAt)}</span>
            </div>
          ))
        }
      </div>
    </>
  );
}

function Stripe({ label = "" }: { label?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a", backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.045) 0 1px,transparent 1px 9px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: MUT2 }}>{label}</span>
    </div>
  );
}

function WishCard({ item, onRemove }: { item: WishlistEntry; onRemove: () => void }) {
  const { listing } = item;
  const price = formatListingPrice(
    listing.priceUsd,
    listing.priceAmount,
    listing.priceCurrency,
    listing.listingType,
  );
  const grade = listing.gradeValue || listing.gradeNormalized || "unknown";
  return (
    <div style={{ border: `1px solid ${LINE}`, background: PANEL2, display: "flex", flexDirection: "column", position: "relative" }}>
      <button onClick={onRemove} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,10,.7)", border: `1px solid ${LINE}`, color: MUT, cursor: "pointer", fontSize: 13, zIndex: 2 }}>×</button>
      <Link href={`/collectibles/lot/${item.listingId}`}>
        <div style={{ aspectRatio: "1/1", position: "relative", overflow: "hidden" }}>
          {listing.imageUrl
            ? <img src={listing.imageUrl} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Stripe label="card · 80×112" />}
        </div>
        <div style={{ padding: "9px 10px 11px" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, margin: "0 0 7px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{listing.title}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...labStyle, color: Y }}>{grade.toUpperCase()}</span>
            <span style={{ ...numStyle, fontSize: 14 }}>{price}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: MUT2, marginTop: 6 }}>{listing.sourcePlatform.replace(/_/g, " ").toUpperCase()}</div>
        </div>
      </Link>
    </div>
  );
}

function CollectionCard({ item }: { item: CollectionItem }) {
  const price = formatListingPrice(
    item.priceUsd,
    item.priceAmount,
    item.priceCurrency,
    item.listingType,
  );
  const grade = item.gradeValue || item.gradeNormalized || "—";
  return (
    <div style={{ border: `1px solid ${LINE}`, background: PANEL2, display: "flex", flexDirection: "column" }}>
      <Link href={`/collectibles/lot/${item.id}`}>
        <div style={{ aspectRatio: "3/4", overflow: "hidden" }}>
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Stripe label="card · 80×112" />}
        </div>
        <div style={{ padding: "9px 10px 11px" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, margin: "0 0 7px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...labStyle, color: Y }}>{grade.toUpperCase()}</span>
            <span style={{ ...numStyle, fontSize: 14 }}>{price}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: MUT2, marginTop: 6 }}>{item.sourcePlatform.replace(/_/g, " ").toUpperCase()}</div>
        </div>
      </Link>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, border: `1px dashed ${LINE}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 22, textAlign: "center" }}>
      <div style={{ width: 54, height: 76, flex: "none" }}><Stripe /></div>
      {children}
    </div>
  );
}

function CollWishTabs({ collection, wishlist, onRemoveWish, loading }: { collection: CollectionItem[]; wishlist: WishlistEntry[]; onRemoveWish: (id: string) => void; loading: boolean }) {
  const [tab, setTab] = useState<"collection" | "wishlist">("collection");
  const activeChip = (active: boolean) => ({
    fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase" as const,
    color: active ? BG : MUT, border: `1px solid ${active ? Y : LINE}`,
    background: active ? Y : "transparent", padding: "5px 8px", cursor: "pointer",
    fontWeight: active ? 600 : 400, transition: ".12s",
  });
  return (
    <div style={{ ...panelStyle, flex: 1 }}>
      <div style={phStyle}>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={activeChip(tab === "collection")} onClick={() => setTab("collection")}>Collection · {collection.length}</button>
          <button style={activeChip(tab === "wishlist")} onClick={() => setTab("wishlist")}>Wishlist · {wishlist.length}</button>
        </div>
        <span style={labMutStyle}>{tab === "collection" ? "owned · linked wallets" : "saved across marketplaces"}</span>
      </div>
      <div style={{ ...pbStyle, flex: 1, overflowY: "auto" }}>
        {tab === "collection"
          ? loading
            ? <div style={labMutStyle}>Loading…</div>
            : collection.length > 0
              ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 12 }}>
                  {collection.map(item => <CollectionCard key={item.id} item={item} />)}
                </div>
              : <EmptyState>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>No cards tied to your wallets yet</div>
                    <div style={labMutStyle}>Phase 2A reads the four integrated marketplaces as source of truth.</div>
                  </div>
                  <Link href="/collectibles" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", padding: "11px 14px", cursor: "pointer", border: `1px solid ${Y}`, background: Y, color: BG, fontWeight: 700, textDecoration: "none" }}>Browse marketplace →</Link>
                </EmptyState>
          : wishlist.length > 0
            ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 12 }}>
                {wishlist.map(item => <WishCard key={item.id} item={item} onRemove={() => onRemoveWish(item.id)} />)}
              </div>
            : <div style={{ ...labMutStyle, padding: "24px 0", textAlign: "center" }}>Wishlist is empty.</div>
        }
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { ready, authenticated, user, login } = usePrivy();

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [storedWallets, setStoredWallets] = useState<StoredWallet[]>([]);
  const [embeddedWallets, setEmbeddedWallets] = useState<StoredWallet[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistEntry[]>([]);
  const [hidden, setHidden] = useState(false);

  const wallets = useMemo(() => {
    const linked = (user?.linkedAccounts ?? []) as LinkedWallet[];
    return linked.filter(a => (a.type === "wallet" || a.type === "smart_wallet") && Boolean(a.address));
  }, [user?.linkedAccounts]);

  useEffect(() => {
    if (!authenticated || !user?.id) {
      setItems([]); setStoredWallets([]); setEmbeddedWallets([]); setActivities([]); setWishlistItems([]);
      return;
    }
    let active = true;
    const sync = async () => {
      setLoadingCollection(true);
      try {
        await fetch("/api/user/sync", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privyUserId: user.id, googleEmail: user.google?.email ?? null, email: user.email?.address ?? null, wallets }),
        });
        const params = new URLSearchParams({ privy_user_id: user.id });
        const res = await fetch(`/api/user/dashboard?${params}`, { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json() as { wallets: StoredWallet[]; embeddedWallets: StoredWallet[]; activities: ActivityItem[]; collection: CollectionItem[] };
        if (!active) return;
        setStoredWallets(data.wallets ?? []);
        setEmbeddedWallets(data.embeddedWallets ?? []);
        setActivities(data.activities ?? []);
        setItems(data.collection ?? []);
        fetch(`/api/user/wishlist?privy_user_id=${encodeURIComponent(user.id)}`)
          .then(r => r.json()).then((d: { items?: WishlistEntry[] }) => { if (active) setWishlistItems(d.items ?? []); }).catch(() => undefined);
        fetch("/api/user/sync-balances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ privyUserId: user.id }) })
          .then(() => fetch(`/api/user/dashboard?${params}`, { cache: "no-store" }))
          .then(r => r.json()).then((fresh: { wallets?: StoredWallet[]; embeddedWallets?: StoredWallet[] }) => {
            if (!active) return;
            if (fresh.wallets) setStoredWallets(fresh.wallets);
            if (fresh.embeddedWallets) setEmbeddedWallets(fresh.embeddedWallets);
          }).catch(() => undefined);
      } finally { if (active) setLoadingCollection(false); }
    };
    sync();
    return () => { active = false; };
  }, [authenticated, user?.id, user?.google?.email, user?.email?.address, wallets]);

  const displayWallets = embeddedWallets.length > 0 ? embeddedWallets : storedWallets.slice(0, 2);
  const totalUSDC = displayWallets.reduce((a, w) => a + parseUSDC(w.usdcBalance), 0);
  const totalNative = displayWallets.reduce((a, w) => {
    const { amount, sym } = parseNative(w.nativeBalance);
    return a + amount * (sym === "SOL" ? SOL_PRICE : sym === "ETH" ? ETH_PRICE : 0);
  }, 0);
  const totalUSD = totalUSDC + totalNative;

  const userName = user?.google?.name || user?.email?.address?.split("@")[0] || "Account";
  const userEmail = user?.google?.email || user?.email?.address || "";

  const removeWish = (id: string) => setWishlistItems(prev => prev.filter(w => w.id !== id));

  // ── nav ──────────────────────────────────────────────────────────────────────
  const chipStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase",
    border: "1.5px solid #0A0A0A", padding: "7px 11px", fontWeight: 600, cursor: "pointer",
    background: "transparent", color: "#0A0A0A",
  };
  const chipSolid: React.CSSProperties = { ...chipStyle, background: "#0A0A0A", color: Y };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: BG, color: "#fff", fontFamily: SANS, WebkitFontSmoothing: "antialiased" }}>
      {/* nav */}
      <nav style={{ height: 54, background: Y, color: BG, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flex: "0 0 auto" }}>
        <Link href="/" style={{ fontWeight: 800, letterSpacing: ".02em", fontSize: 15, textDecoration: "none", color: BG }}>RARIBLE COLLECTIBLES</Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/collectibles" style={{ ...chipStyle, textDecoration: "none" }}>Marketplace</Link>
          {authenticated && userEmail && <span style={chipSolid}>{userEmail}</span>}
          {authenticated
            ? <Link href="/" style={{ ...chipStyle, textDecoration: "none" }}>Sign out</Link>
            : <button style={chipStyle} onClick={() => login()}>Sign in</button>}
        </div>
      </nav>

      {/* body */}
      {!ready ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={labMutStyle}>Loading…</span>
        </div>
      ) : !authenticated ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ ...panelStyle, maxWidth: 440, width: "100%", padding: 32 }}>
            <div style={labStyle}>Sign in required</div>
            <h2 style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-.02em", margin: "12px 0 8px" }}>Connect with Google to unlock your dashboard.</h2>
            <p style={{ color: MUT, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>Identity via Google. Privy creates embedded EVM and Solana wallets. Link external wallets at any time.</p>
            <button onClick={() => login()} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", padding: "11px 14px", cursor: "pointer", border: `1px solid ${Y}`, background: Y, color: BG, fontWeight: 700 }}>
              Continue with Google
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14, padding: 18 }}>

          {/* ── profile bar ─────────────────────────────────────────────────── */}
          <div style={{ ...panelStyle, flex: "0 0 auto", flexDirection: "row", alignItems: "stretch" }}>
            {/* identity */}
            <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", minWidth: 230 }}>
              <ProfileIdentity name={userName} email={userEmail} size={44} />
            </div>
            {/* balance */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, padding: "14px 22px", borderLeft: `1px solid ${LINE2}`, minWidth: 250 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={labStyle}>Total balance</span>
                <Eye hidden={hidden} onClick={() => setHidden(!hidden)} />
              </div>
              <Money n={totalUSD} hidden={hidden} size={30} color={Y} />
              <BalanceMini wallets={displayWallets} hidden={hidden} />
            </div>
            {/* wallets */}
            <div style={{ flex: 1, display: "flex", alignItems: "stretch", borderLeft: `1px solid ${LINE2}` }}>
              {displayWallets.length > 0
                ? displayWallets.slice(0, 2).map((w, i) => (
                  <div key={w.id} style={{ flex: 1, display: "flex", alignItems: "center", padding: "8px 18px", borderLeft: i ? `1px solid ${LINE2}` : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <WalletSlot w={w} hidden={hidden} />
                    </div>
                  </div>
                ))
                : <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "8px 18px" }}>
                    <span style={labMutStyle}>No embedded wallets — sign out and sign in again to generate them.</span>
                  </div>
              }
            </div>
          </div>

          {/* ── collection / wishlist ─────────────────────────────────────────── */}
          <CollWishTabs
            collection={items}
            wishlist={wishlistItems}
            onRemoveWish={removeWish}
            loading={loadingCollection}
          />

          {/* ── activity ─────────────────────────────────────────────────────── */}
          <div style={{ ...panelStyle, flex: "0 0 208px" }}>
            <div style={phStyle}>
              <span style={labStyle}>Activity</span>
              <span style={labMutStyle}>{activities.length} events tracked</span>
            </div>
            <div style={{ ...pbStyle, flex: 1, gap: 8 }}>
              <ActivityList items={activities} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
