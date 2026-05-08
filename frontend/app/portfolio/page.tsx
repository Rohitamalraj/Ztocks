"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AppNav } from "@/components/app/app-nav";
import { TokenLogo } from "@/components/ui/token-logo";
import { useVault } from "@/hooks/use-vault";
import { useAssetQuotes } from "@/hooks/use-asset-quotes";
import { useKycTier } from "@/hooks/use-kyc-tier";
import { Loader2 } from "lucide-react";
import type { AssetSymbol } from "@/hooks/use-asset-quotes";

const VerifyIdentityModal = dynamic(
  () => import("@/components/dashboard/verify-identity-modal").then((m) => m.VerifyIdentityModal),
  { ssr: false }
);

function formatPnL(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return "0.00";
  if (abs < 0.01) return value.toFixed(4);
  if (abs < 0.1) return value.toFixed(3);
  return value.toFixed(2);
}

function formatPct(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return "0.00";
  if (abs < 0.01) return value.toFixed(4);
  return value.toFixed(2);
}

function formatPrice(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [unwrapAmt, setUnwrapAmt] = useState("");

  const vault    = useVault();
  const prices   = useAssetQuotes();
  const kyc = useKycTier();
  const [realizedPnlById, setRealizedPnlById] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!address) {
      setRealizedPnlById({});
      return;
    }
    try {
      const key = `ztocks:realized-pnl:${address.toLowerCase()}`;
      const raw = localStorage.getItem(key);
      if (!raw) {
        setRealizedPnlById({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, number>;
      setRealizedPnlById(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setRealizedPnlById({});
    }
  }, [address]);

  // Enrich positions with live mark price + P&L — null-safe for encrypted fields
  const enrichedAllPositions = vault.allPositions.map((pos) => {
    const livePrice  = prices[pos.asset as AssetSymbol]?.price ?? 0;
    const markPrice  = livePrice > 0 ? livePrice : (pos.entryPrice ?? 0);
    const displayTicker = pos.asset.startsWith("s") ? pos.asset.slice(1) : pos.asset;

    // Only compute derived numbers when every input field is decrypted
    const canCompute =
      pos.collateralUSDC !== null &&
      pos.leverage !== null &&
      pos.entryPrice !== null &&
      pos.isLong !== null &&
      markPrice > 0;

    const posSizeUSD = canCompute ? pos.collateralUSDC! * pos.leverage! : null;
    const pnl = canCompute
      ? (pos.isLong
          ? posSizeUSD! * ((markPrice - pos.entryPrice!) / pos.entryPrice!)
          : posSizeUSD! * ((pos.entryPrice! - markPrice) / pos.entryPrice!))
      : null;
    const pnlPercent = canCompute && pos.collateralUSDC! > 0
      ? (pnl! / pos.collateralUSDC!) * 100
      : null;
    const liqDelta = canCompute ? (posSizeUSD! * 0.9) / pos.leverage! : null;
    const liqPrice = canCompute
      ? Math.max(0, pos.isLong! ? pos.entryPrice! - liqDelta! : pos.entryPrice! + liqDelta!)
      : null;

    return { ...pos, markPrice, pnl, pnlPercent, liqPrice, displayTicker, posSizeUSD };
  });

  const enrichedPositions = enrichedAllPositions.filter((p) => p.isOpen);
  const enrichedById = new Map(enrichedAllPositions.map((p) => [p.id, p]));

  useEffect(() => {
    if (!address) return;
    setRealizedPnlById((prev) => {
      let changed = false;
      const next: Record<string, number> = { ...prev };
      for (const pos of enrichedAllPositions) {
        if (pos.isOpen) continue;
        if (next[pos.id] !== undefined) continue;
        if (pos.pnl === null || !Number.isFinite(pos.pnl)) continue;
        next[pos.id] = pos.pnl;
        changed = true;
      }
      if (changed) {
        const key = `ztocks:realized-pnl:${address.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      }
      return prev;
    });
  }, [address, enrichedAllPositions]);

  const historyRows = [...vault.allPositions]
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .map((pos) => {
      const displayTicker = pos.asset.startsWith("s") ? pos.asset.slice(1) : pos.asset;
      const live = enrichedById.get(pos.id);
      const effectivePnl = pos.isOpen
        ? (live?.pnl ?? null)
        : (realizedPnlById[pos.id] ?? live?.pnl ?? null);
      const hasPnl = effectivePnl !== null && Number.isFinite(effectivePnl);
      const pnlText = hasPnl ? `${effectivePnl! >= 0 ? "+" : ""}$${formatPnL(effectivePnl!)}` : "Encrypted";
      const pnlClass = hasPnl
        ? (effectivePnl! >= 0 ? "text-green-700" : "text-red-600")
        : "text-muted-foreground";
      return {
        id: pos.id,
        date: pos.openedAt,
        asset: displayTicker,
        direction: pos.direction,
        collateralUSDC: pos.collateralUSDC,
        pnlText,
        pnlClass,
        status: pos.isOpen ? "OPEN" : "CLOSED",
      };
    });

  // Portfolio stats — only sum positions where PnL is decrypted
  const openPnl = enrichedPositions.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const realizedPnl = Object.values(realizedPnlById).reduce((s, p) => s + p, 0);
  const totalPnl = openPnl + realizedPnl;
  const openEquity = enrichedPositions.reduce(
    (s, p) => s + (p.collateralUSDC ?? 0) + (p.pnl ?? 0),
    0
  );
  const totalValue = vault.usdcBalance + openEquity;
  const openCount = enrichedPositions.length;
  const hasEncryptedPositions = enrichedAllPositions.some(
    (p) => p.decryptionStatus !== "ready"
  );

  const unwrapBusy =
    vault.txStatus === "unwrap-requesting" ||
    vault.txStatus === "unwrap-wait-relayer" ||
    vault.txStatus === "unwrap-finalizing";

  if (!isConnected) {
    return (
      <>
        <AppNav onVerifyClick={() => setVerifyModalOpen(true)} isVerified={kyc.isVerified} tier={kyc.tier} />
        <div className="min-h-screen bg-background flex items-center justify-center pt-16">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-mono">Connect Wallet</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Connect your wallet to view your portfolio
            </p>
            <Link href="/trade" className="inline-block px-4 py-2 bg-foreground text-background font-mono text-xs border border-foreground hover:bg-foreground/90 transition-colors">
              Go to Trade
            </Link>
          </div>
        </div>
        {verifyModalOpen && (
          <VerifyIdentityModal
            open={verifyModalOpen}
            onOpenChange={setVerifyModalOpen}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <AppNav
        onVerifyClick={() => setVerifyModalOpen(true)}
        isVerified={kyc.isVerified}
        tier={kyc.tier}
        usdcBalance={vault.usdcBalance}
      />

      {/* Header */}
      <div className="border-b border-foreground/10 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-mono mb-1">Portfolio</h1>
              <p className="text-xs font-mono text-muted-foreground">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
            <Link
              href="/trade"
              className="px-4 py-2 bg-foreground text-background font-mono text-xs border border-foreground hover:bg-foreground/90 transition-colors"
            >
              Trade
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="border border-foreground/10 p-4">
            <div className="text-xs font-mono text-muted-foreground mb-1">Total Value</div>
            <div className="text-2xl font-mono">${totalValue.toFixed(2)}</div>
          </div>
          <div className="border border-foreground/10 p-4">
            <div className="text-xs font-mono text-muted-foreground mb-1">Open P&L</div>
            <div className={`text-2xl font-mono ${openPnl >= 0 ? "text-green-700" : "text-red-600"}`}>
              {openPnl >= 0 ? "+" : ""}${openPnl.toFixed(2)}
            </div>
          </div>
          <div className="border border-foreground/10 p-4">
            <div className="text-xs font-mono text-muted-foreground mb-1">Realized P&L</div>
            <div className={`text-2xl font-mono ${realizedPnl >= 0 ? "text-green-700" : "text-red-600"}`}>
              {realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(2)}
            </div>
          </div>
          <div className="border border-foreground/10 p-4">
            <div className="text-xs font-mono text-muted-foreground mb-1">Open Positions</div>
            <div className="text-2xl font-mono">{openCount}</div>
          </div>
          <div className="border border-foreground/10 p-4">
            <div className="text-xs font-mono text-muted-foreground mb-1">USDC Balance</div>
            <div className="text-2xl font-mono">${vault.usdcBalance.toFixed(2)}</div>
          </div>
        </div>
        {hasEncryptedPositions && (
          <p className="text-[10px] font-mono text-muted-foreground mb-6">
            ⚠ Some position fields are still encrypted on-chain. Totals above only include decrypted values.
          </p>
        )}

        <div className="border border-foreground/10 p-4 mb-8 bg-foreground/[0.02]">
          <h2 className="text-sm font-mono mb-1">Unwrap cUSDC → USDC</h2>
          <p className="text-xs font-mono text-muted-foreground mb-3">
            After closing positions, collateral returns as confidential cUSDC. Unwrap burns cUSDC and credits plain USDC
            via Zama’s two-step unwrap (relayer public decryption).
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end max-w-xl">
            <div className="flex-1">
              <label className="block text-[10px] font-mono text-muted-foreground mb-1">Amount (cUSDC to burn)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unwrapAmt}
                onChange={(e) => setUnwrapAmt(e.target.value)}
                placeholder="e.g. 50"
                className="w-full border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <button
              type="button"
              disabled={unwrapBusy || !unwrapAmt || Number(unwrapAmt) <= 0}
              onClick={() => {
                const n = Number(unwrapAmt);
                if (!Number.isFinite(n) || n <= 0) return;
                void vault.unwrapCUSDC(n).then((ok) => {
                  if (ok) setUnwrapAmt("");
                });
              }}
              className="px-4 py-2 bg-foreground text-background font-mono text-xs border border-foreground hover:bg-foreground/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {unwrapBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {unwrapBusy ? vault.txStatus.replace(/-/g, " ") : "Unwrap to USDC"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-foreground/10 mb-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("positions")}
              className={`pb-3 font-mono text-sm transition-colors ${
                activeTab === "positions"
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Open Positions {openCount > 0 && `(${openCount})`}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3 font-mono text-sm transition-colors ${
                activeTab === "history"
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Trade History
            </button>
          </div>
        </div>

        {/* Positions Table */}
        {activeTab === "positions" ? (
          <div className="border border-foreground/10">
            {/* Table Header */}
            <div className="grid grid-cols-8 gap-4 p-4 border-b border-foreground/10 bg-foreground/[0.02]">
              {["Asset", "Direction", "Collateral", "Entry", "Mark", "Liq. Price", "P&L", "Action"].map((h) => (
                <div key={h} className="text-[10px] font-mono text-muted-foreground uppercase">{h}</div>
              ))}
            </div>

            {enrichedPositions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-muted-foreground font-mono text-sm mb-4">No open positions</div>
                <Link
                  href="/trade"
                  className="inline-block px-4 py-2 bg-foreground text-background font-mono text-xs border border-foreground hover:bg-foreground/90 transition-colors"
                >
                  Start Trading
                </Link>
              </div>
            ) : (
              enrichedPositions.map((pos) => (
                <div key={pos.id} className="grid grid-cols-8 gap-4 p-4 border-b border-foreground/10 hover:bg-foreground/[0.02] items-center">
                  {/* Asset */}
                  <div className="flex items-center gap-2">
                    <TokenLogo ticker={pos.asset} size="sm" />
                    <span className="font-mono text-xs">{pos.displayTicker}</span>
                  </div>
                  {/* Direction */}
                  <div>
                    {pos.direction === "ENCRYPTED" ? (
                      <span className="font-mono text-xs px-2 py-0.5 bg-foreground/10 text-muted-foreground">Encrypted</span>
                    ) : (
                      <span className={`font-mono text-xs px-2 py-0.5 ${pos.direction === "LONG" ? "bg-green-700/10 text-green-700" : "bg-red-600/10 text-red-600"}`}>
                        {pos.direction}{pos.leverage !== null ? ` ${pos.leverage}x` : ""}
                      </span>
                    )}
                  </div>
                  {/* Collateral */}
                  <div className="font-mono text-xs">
                    {pos.collateralUSDC !== null ? `$${pos.collateralUSDC.toFixed(2)}` : <span className="text-muted-foreground">Encrypted</span>}
                  </div>
                  {/* Entry */}
                  <div className="font-mono text-xs">
                    {pos.entryPrice !== null ? `$${formatPrice(pos.entryPrice)}` : <span className="text-muted-foreground">Encrypted</span>}
                  </div>
                  {/* Mark */}
                  <div className="font-mono text-xs">
                    {pos.markPrice > 0 ? `$${formatPrice(pos.markPrice)}` : <span className="text-muted-foreground">—</span>}
                  </div>
                  {/* Liq Price */}
                  <div className="font-mono text-xs text-red-600">
                    {pos.liqPrice !== null ? `$${formatPrice(pos.liqPrice)}` : <span className="text-muted-foreground">Encrypted</span>}
                  </div>
                  {/* P&L */}
                  <div className={`font-mono text-xs ${pos.pnl === null ? "text-muted-foreground" : pos.pnl >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {pos.pnl === null
                      ? "Encrypted"
                      : (<>{pos.pnl >= 0 ? "+" : ""}${formatPnL(pos.pnl)}<span className="text-[10px] ml-1 opacity-70">({formatPct(pos.pnlPercent!)}%)</span></>)
                    }
                  </div>
                  {/* Action */}
                  <div>
                    <button
                      onClick={() => vault.closePosition(pos.index, pos.markPrice)}
                      disabled={vault.txStatus === "closing"}
                      className="px-3 py-1 font-mono text-[10px] bg-red-600/10 text-red-600 hover:bg-red-600/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {vault.txStatus === "closing" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Close
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="border border-foreground/10">
            <div className="grid grid-cols-6 gap-4 p-4 border-b border-foreground/10 bg-foreground/[0.02]">
              {["Date", "Asset", "Direction", "Collateral", "P&L", "Status"].map((h) => (
                <div key={h} className="text-[10px] font-mono text-muted-foreground uppercase">{h}</div>
              ))}
            </div>

            {historyRows.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-muted-foreground font-mono text-sm">No trade history yet</div>
              </div>
            ) : (
              historyRows.map((row) => (
                <div key={row.id} className="grid grid-cols-6 gap-4 p-4 border-b border-foreground/10 hover:bg-foreground/[0.02] items-center">
                  <div className="font-mono text-xs">{row.date.toLocaleString()}</div>
                  <div className="font-mono text-xs">{row.asset}/USD</div>
                  <div>
                    <span className={`font-mono text-xs px-2 py-0.5 ${row.direction === "LONG" ? "bg-green-700/10 text-green-700" : "bg-red-600/10 text-red-600"}`}>
                      {row.direction}
                    </span>
                  </div>
                  <div className="font-mono text-xs">
                    {row.collateralUSDC !== null ? `$${row.collateralUSDC.toFixed(2)}` : <span className="text-muted-foreground">Encrypted</span>}
                  </div>
                  <div className={`font-mono text-xs ${row.pnlClass}`}>{row.pnlText}</div>
                  <div>
                    <span className={`font-mono text-[10px] px-2 py-0.5 ${row.status === "OPEN" ? "bg-green-700/10 text-green-700" : "bg-foreground/10 text-foreground/80"}`}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {verifyModalOpen && (
        <VerifyIdentityModal
          open={verifyModalOpen}
          onOpenChange={setVerifyModalOpen}
        />
      )}
    </div>
  );
}
