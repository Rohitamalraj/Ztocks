"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { AppNav } from "@/components/app/app-nav";
import { TradingLayout } from "@/components/dashboard/trading-layout";
import { MarketsPanel } from "@/components/dashboard/markets-panel";
import { CandlestickChart } from "@/components/dashboard/candlestick-chart";
import { TradeForm } from "@/components/dashboard/trade-form";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { PositionsPanel } from "@/components/dashboard/positions-panel";
import { VerifyIdentityModal } from "@/components/dashboard/verify-identity-modal";
import { useMockPrices } from "@/hooks/use-mock-prices";
import { useVault } from "@/hooks/use-vault";
import { useZkIdentity } from "@/hooks/use-zk-identity";
import { ASSET_TOKENS } from "@/lib/contracts";
import { isUsEquityMarketOpen } from "@/lib/market-hours";
import type { AssetSymbol } from "@/hooks/use-mock-prices";

// Static market metadata for listed synth assets
const MARKET_META: Record<AssetSymbol, { name: string }> = {
  sAAPL: { name: "Apple Inc." },
  sTSLA: { name: "Tesla Inc." },
  sNVDA: { name: "NVIDIA Corp." },
  sSPY:  { name: "S&P 500 ETF" },
  sAMZN: { name: "Amazon.com Inc." },
  sMSFT: { name: "Microsoft Corp." },
  sMETA: { name: "Meta Platforms" },
  sNFLX: { name: "Netflix Inc." },
  sAMD:  { name: "Advanced Micro Devices" },
};

const ASSETS: AssetSymbol[] = [
  "sAAPL",
  "sTSLA",
  "sNVDA",
  "sSPY",
  "sAMZN",
  "sMSFT",
  "sMETA",
  "sNFLX",
  "sAMD",
];

export default function TradePage() {
  const { isConnected } = useAccount();
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>("sAAPL");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1h");
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<AssetSymbol>>(new Set());

  // ─── Data hooks ────────────────────────────────────────────────────────────
  const prices    = useMockPrices();
  const vault     = useVault();
  const identity  = useZkIdentity();

  const { isVerified, leverageCap, tier } = identity;
  const selectedPrice = prices[selectedAsset]?.price ?? 0;
  const marketOpen = isUsEquityMarketOpen();
  const isTradeEnabled = !!ASSET_TOKENS[selectedAsset];

  // ─── Build market list for MarketsPanel ────────────────────────────────────
  const markets = ASSETS.map((sym) => ({
    ticker:     sym,
    name:       MARKET_META[sym].name,
    price:      prices[sym]?.price         ?? 0,
    change24h:  prices[sym]?.changePercent ?? 0,
    leverage:   isVerified ? leverageCap : 2,
    isFavorite: favorites.has(sym),
  }));


  // ─── Build positions for PositionsPanel ────────────────────────────────────
  const enrichedPositions = vault.positions.map((pos) => {
    const markPrice  = prices[pos.asset]?.price ?? pos.entryPrice;
    const posSizeUSD = pos.collateralUSDC * pos.leverage;
    const pnl = pos.isLong
      ? posSizeUSD * ((markPrice - pos.entryPrice) / pos.entryPrice)
      : posSizeUSD * ((pos.entryPrice - markPrice) / pos.entryPrice);
    const pnlPercentage = pos.collateralUSDC > 0 ? (pnl / pos.collateralUSDC) * 100 : 0;
    // Liquidation: position liquidates when equity < 10% of position size
    const liqDelta     = (posSizeUSD * 0.9) / pos.leverage;
    const liquidationPrice = pos.isLong
      ? pos.entryPrice - liqDelta
      : pos.entryPrice + liqDelta;

    // Strip "s" prefix for display ticker
    const displayTicker = pos.asset.startsWith("s") ? pos.asset.slice(1) : pos.asset;

    return {
      id:               pos.id,
      index:            pos.index,
      ticker:           displayTicker,
      direction:        pos.direction,
      size:             posSizeUSD,
      leverage:         pos.leverage,
      entryPrice:       pos.entryPrice,
      markPrice,
      liquidationPrice: Math.max(0, liquidationPrice),
      pnl,
      pnlPercentage,
    };
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectMarket = (ticker: string) => {
    if (ASSETS.includes(ticker as AssetSymbol)) {
      setSelectedAsset(ticker as AssetSymbol);
    }
  };

  const handleToggleFavorite = (ticker: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const sym = ticker as AssetSymbol;
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  };

  const handleTrade = useCallback(
    async (params: { direction: "LONG" | "SHORT"; collateral: number; leverage: number }) => {
      if (!isTradeEnabled) {
        return;
      }
      if (!isVerified) {
        setVerifyModalOpen(true);
        return;
      }
      await vault.openPosition(
        selectedAsset,
        params.direction,
        params.collateral,
        params.leverage,
        selectedPrice
      );
    },
    [isTradeEnabled, isVerified, vault, selectedAsset, selectedPrice]
  );

  const handleClosePosition = useCallback(
    async (id: string) => {
      const pos = vault.positions.find((p) => p.id === id);
      if (pos) {
        const executionPrice = prices[pos.asset]?.price ?? pos.entryPrice;
        await vault.closePosition(pos.index, executionPrice);
      }
    },
    [vault, prices]
  );

  // Determine if a specific position is being closed
  const closingId = vault.txStatus === "closing"
    ? enrichedPositions.find((p) =>
        vault.positions.some((vp) => vp.id === p.id)
      )?.id ?? null
    : null;

  return (
    <div className="min-h-screen bg-background pt-16">
      <AppNav
        onVerifyClick={() => setVerifyModalOpen(true)}
        isVerified={isVerified}
        tier={tier}
        usdcBalance={vault.usdcBalance}
      />

      <StatsBar
        selectedMarket={{
          ticker:     selectedAsset,
          name:       MARKET_META[selectedAsset].name,
          price:      selectedPrice,
          change24h:  prices[selectedAsset]?.changePercent ?? 0,
          leverage:   isVerified ? leverageCap : 2,
          isFavorite: favorites.has(selectedAsset),
        }}
        onMarketChange={(m) => setSelectedAsset(m.ticker as AssetSymbol)}
        markets={markets}
        marketOpen={marketOpen}
      />

      <TradingLayout
        leftPanel={
          <MarketsPanel
            markets={markets}
            selectedMarket={selectedAsset}
            onSelectMarket={handleSelectMarket}
            onToggleFavorite={handleToggleFavorite}
          />
        }
        centerPanel={
          <CandlestickChart
            ticker={selectedAsset}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            marketOpen={marketOpen}
          />
        }
        rightPanel={
          <TradeForm
            ticker={selectedAsset}
            currentPrice={selectedPrice}
            maxLeverage={isVerified ? leverageCap : 2}
            isTradeEnabled={isTradeEnabled}
            isConnected={isConnected}
            isVerified={isVerified}
            usdcBalance={vault.usdcBalance}
            txStatus={vault.txStatus}
            onTrade={handleTrade}
            isTrading={["approving-usdc", "approving-hsp", "opening"].includes(vault.txStatus)}
            onVerifyClick={() => setVerifyModalOpen(true)}
          />
        }
        bottomPanel={
          <PositionsPanel
            positions={enrichedPositions}
            onClosePosition={handleClosePosition}
            isClosing={closingId}
          />
        }
      />

      <VerifyIdentityModal
        open={verifyModalOpen}
        onOpenChange={setVerifyModalOpen}
        identityState={identity}
      />
    </div>
  );
}
