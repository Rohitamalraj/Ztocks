"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import Link from "next/link";
import { AppNav } from "@/components/app/app-nav";
import { VerifyIdentityModal } from "@/components/dashboard/verify-identity-modal";
import { TokenLogo } from "@/components/ui/token-logo";
import { useVault } from "@/hooks/use-vault";
import { useMockPrices } from "@/hooks/use-mock-prices";
import { useZkIdentity } from "@/hooks/use-zk-identity";
import { SYNTH_VAULT_ABI } from "@/lib/abis";
import { CONTRACTS } from "@/lib/contracts";
import { Loader2 } from "lucide-react";
import type { AssetSymbol } from "@/hooks/use-mock-prices";

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

const CLOSED_PNL_LOOKBACK_BLOCKS = 500_000n;

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [closedPnlById, setClosedPnlById] = useState<Record<string, number>>({});

  const vault    = useVault();
  const prices   = useMockPrices();
  const identity = useZkIdentity();
  const closedPositionIds = vault.allPositions.filter((p) => !p.isOpen).map((p) => p.id);
  const closedPositionKey = closedPositionIds.join(",");

  useEffect(() => {
    let cancelled = false;

    if (!address || !publicClient) {
      setClosedPnlById({});
      return;
    }

    const ids = closedPositionKey ? closedPositionKey.split(",") : [];

    if (ids.length === 0) {
      setClosedPnlById({});
      return;
    }

    const loadClosedPnls = async () => {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromRecentBlock = latestBlock > CLOSED_PNL_LOOKBACK_BLOCKS
          ? latestBlock - CLOSED_PNL_LOOKBACK_BLOCKS
          : 0n;

        let logs = await publicClient.getContractEvents({
          address: CONTRACTS.SynthVault as `0x${string}`,
          abi: SYNTH_VAULT_ABI,
          eventName: "PositionClosed",
          args: {
            user: address,
          },
          fromBlock: fromRecentBlock,
          toBlock: "latest",
          strict: false,
        });

        if (logs.length === 0 && fromRecentBlock > 0n) {
          logs = await publicClient.getContractEvents({
            address: CONTRACTS.SynthVault as `0x${string}`,
            abi: SYNTH_VAULT_ABI,
            eventName: "PositionClosed",
            args: {
              user: address,
            },
            fromBlock: 0n,
            toBlock: "latest",
            strict: false,
          });
        }

        const pnlByPositionId: Record<string, number> = {};
        logs.forEach((log) => {
          const positionId = log.args?.positionId;
          const pnl = log.args?.pnl;
          if (typeof positionId !== "bigint" || typeof pnl !== "bigint") return;
          pnlByPositionId[String(positionId)] = Number(pnl) / 1e6;
        });

        const next: Record<string, number> = {};
        ids.forEach((positionIdText) => {
          const pnl = pnlByPositionId[positionIdText];
          if (typeof pnl === "number" && Number.isFinite(pnl)) {
            next[positionIdText] = pnl;
          }
        });

        if (cancelled) return;

        setClosedPnlById(next);
      } catch (err) {
        console.warn("[zkSynth:portfolio] Failed to load closed position PnL logs", err);
        if (!cancelled) {
          setClosedPnlById({});
        }
      }
    };

    void loadClosedPnls();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient, closedPositionKey]);

  // Enrich positions with live mark price + P&L
  const enrichedPositions = vault.positions.map((pos) => {
    const markPrice  = prices[pos.asset as AssetSymbol]?.price ?? pos.entryPrice;
    const posSizeUSD = pos.collateralUSDC * pos.leverage;
    const pnl = pos.isLong
      ? posSizeUSD * ((markPrice - pos.entryPrice) / pos.entryPrice)
      : posSizeUSD * ((pos.entryPrice - markPrice) / pos.entryPrice);
    const pnlPercent = pos.collateralUSDC > 0 ? (pnl / pos.collateralUSDC) * 100 : 0;
    const liqDelta   = (posSizeUSD * 0.9) / pos.leverage;
    const liqPrice   = pos.isLong
      ? pos.entryPrice - liqDelta
      : pos.entryPrice + liqDelta;
    const displayTicker = pos.asset.startsWith("s") ? pos.asset.slice(1) : pos.asset;
    return { ...pos, markPrice, pnl, pnlPercent, liqPrice: Math.max(0, liqPrice), displayTicker };
  });

  const enrichedById = new Map(enrichedPositions.map((p) => [p.id, p]));

  const historyRows = [...vault.allPositions]
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .map((pos) => {
      const displayTicker = pos.asset.startsWith("s") ? pos.asset.slice(1) : pos.asset;
      const live = enrichedById.get(pos.id);
      const realizedPnl = !pos.isOpen ? closedPnlById[pos.id] : undefined;
      const effectivePnl = live?.pnl ?? realizedPnl;
      const hasPnl = typeof effectivePnl === "number" && Number.isFinite(effectivePnl);
      const pnlText = hasPnl ? `${effectivePnl >= 0 ? "+" : ""}$${formatPnL(effectivePnl)}` : "N/A";
      const pnlClass = hasPnl
        ? (effectivePnl >= 0 ? "text-green-700" : "text-red-600")
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

  // Portfolio stats
  const openPnl = enrichedPositions.reduce((s, p) => s + p.pnl, 0);
  const realizedPnl = vault.allPositions.reduce((sum, pos) => {
    if (pos.isOpen) return sum;
    const pnl = closedPnlById[pos.id];
    return typeof pnl === "number" && Number.isFinite(pnl) ? sum + pnl : sum;
  }, 0);
  const totalPnl = openPnl + realizedPnl;
  const openEquity = enrichedPositions.reduce((s, p) => s + p.collateralUSDC + p.pnl, 0);
  const totalValue = vault.usdcBalance + openEquity;
  const openCount      = enrichedPositions.length;

  if (!isConnected) {
    return (
      <>
        <AppNav onVerifyClick={() => setVerifyModalOpen(true)} isVerified={identity.isVerified} tier={identity.tier} />
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
        <VerifyIdentityModal
          open={verifyModalOpen}
          onOpenChange={setVerifyModalOpen}
          identityState={identity}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <AppNav
        onVerifyClick={() => setVerifyModalOpen(true)}
        isVerified={identity.isVerified}
        tier={identity.tier}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-foreground/10 p-4">
            <div className="text-xs font-mono text-muted-foreground mb-1">Total Value</div>
            <div className="text-2xl font-mono">${totalValue.toFixed(2)}</div>
          </div>
          <div className="border border-foreground/10 p-4">
            <div className="text-xs font-mono text-muted-foreground mb-1">Total P&L</div>
            <div className={`text-2xl font-mono ${totalPnl >= 0 ? "text-green-700" : "text-red-600"}`}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
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
                    <span className={`font-mono text-xs px-2 py-0.5 ${pos.direction === "LONG" ? "bg-green-700/10 text-green-700" : "bg-red-600/10 text-red-600"}`}>
                      {pos.direction} {pos.leverage}x
                    </span>
                  </div>
                  {/* Collateral */}
                  <div className="font-mono text-xs">${pos.collateralUSDC.toFixed(2)}</div>
                  {/* Entry */}
                  <div className="font-mono text-xs">${formatPrice(pos.entryPrice)}</div>
                  {/* Mark */}
                  <div className="font-mono text-xs">${formatPrice(pos.markPrice)}</div>
                  {/* Liq Price */}
                  <div className="font-mono text-xs text-red-600">${formatPrice(pos.liqPrice)}</div>
                  {/* P&L */}
                  <div className={`font-mono text-xs ${pos.pnl >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {pos.pnl >= 0 ? "+" : ""}${formatPnL(pos.pnl)}
                    <span className="text-[10px] ml-1 opacity-70">({formatPct(pos.pnlPercent)}%)</span>
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
                  <div className="font-mono text-xs">${row.collateralUSDC.toFixed(2)}</div>
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

      <VerifyIdentityModal
        open={verifyModalOpen}
        onOpenChange={setVerifyModalOpen}
        identityState={identity}
      />
    </div>
  );
}
