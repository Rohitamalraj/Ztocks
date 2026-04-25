"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, AlertCircle, ShieldAlert } from "lucide-react";
import { useAccount } from "wagmi";
import type { AssetSymbol, PriceData } from "@/hooks/use-mock-prices";
import type { Direction } from "@/hooks/use-positions";
import type { TierKey } from "./dashboard-nav";
import { TIERS } from "./dashboard-nav";
import type { TxStatus } from "@/hooks/use-vault";
import { Loader2 } from "lucide-react";
import { useZkIdentity, tierLabel } from "@/hooks/use-zk-identity";

interface OpenPositionFormProps {
  selectedAsset: AssetSymbol;
  prices: Record<AssetSymbol, PriceData>;
  tier: TierKey;
  onOpen: (asset: AssetSymbol, direction: Direction, collateral: number, leverage: number, currentPrice: number) => void;
  txStatus?: TxStatus;
  isConnected?: boolean;
  onResetTx?: () => void;
}

export function OpenPositionForm({ selectedAsset, prices, tier, onOpen, txStatus = "idle", isConnected = false, onResetTx }: OpenPositionFormProps) {
  const { isConnected: walletConnected } = useAccount();
  const { isVerified: zkVerified, leverageCap: zkLeverageCap, tier: zkTier } = useZkIdentity();

  // When wallet connected: use ZK-proven tier cap. Otherwise: use demo tier cap.
  const maxLeverage = (walletConnected && zkVerified) ? zkLeverageCap : TIERS[tier].cap;
  const [direction, setDirection] = useState<Direction>("LONG");
  const [collateral, setCollateral] = useState<string>("500");
  const [leverage, setLeverage] = useState(1);

  const currentPrice = prices[selectedAsset].price;
  const collateralNum = Math.max(parseFloat(collateral) || 0, 0);
  const notional = collateralNum * leverage;
  const liquidationPrice =
    direction === "LONG"
      ? currentPrice * (1 - 0.9 / leverage)
      : currentPrice * (1 + 0.9 / leverage);

  const isBusy = txStatus !== "idle" && txStatus !== "success" && txStatus !== "error";
  const needsVerification = walletConnected && !zkVerified;
  const canSubmit = collateralNum > 0 && leverage >= 1 && !isBusy && !needsVerification && walletConnected;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onOpen(selectedAsset, direction, collateralNum, leverage, currentPrice);
    if (!isConnected) {
      setCollateral("500");
      setLeverage(1);
    }
  };

  const buttonLabel = () => {
    if (txStatus === "approving-usdc") return "Approving USDC...";
    if (txStatus === "approving-hsp")  return "Approving Fee Token...";
    if (txStatus === "opening")        return "Opening position...";
    if (txStatus === "success")        return "Position opened ✓";
    if (txStatus === "error")          return "Transaction failed";
    return direction === "LONG" ? `Open Long ${selectedAsset}` : `Open Short ${selectedAsset}`;
  };

  return (
    <div className="border border-foreground/10">
      {/* Header */}
      <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">Open Position</span>
        <span className="font-mono text-xs text-foreground/40">{selectedAsset}</span>
      </div>

      <div className="p-6 space-y-6">
        {/* Direction toggle */}
        <div>
          <label className="block font-mono text-xs text-muted-foreground mb-3">Direction</label>
          <div className="grid grid-cols-2 gap-px bg-foreground/10">
            <button
              type="button"
              onClick={() => setDirection("LONG")}
              className={`py-3 text-sm font-medium transition-colors ${
                direction === "LONG"
                  ? "bg-green-700/10 text-green-700 border border-green-700/20"
                  : "bg-background text-muted-foreground hover:bg-foreground/[0.02]"
              }`}
            >
              Long ↑
            </button>
            <button
              type="button"
              onClick={() => setDirection("SHORT")}
              className={`py-3 text-sm font-medium transition-colors ${
                direction === "SHORT"
                  ? "bg-red-600/10 text-red-600 border border-red-600/20"
                  : "bg-background text-muted-foreground hover:bg-foreground/[0.02]"
              }`}
            >
              Short ↓
            </button>
          </div>
        </div>

        {/* Collateral */}
        <div>
          <label className="block font-mono text-xs text-muted-foreground mb-3">Collateral (USDC)</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="100"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              className="w-full bg-background border border-foreground/10 focus:border-foreground/40 outline-none px-4 py-3 font-mono text-sm transition-colors"
              placeholder="500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">USDC</span>
          </div>
          <div className="flex gap-2 mt-2">
            {[100, 500, 1000, 5000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setCollateral(String(amt))}
                className="flex-1 py-1 text-xs font-mono text-muted-foreground border border-foreground/10 hover:border-foreground/30 hover:text-foreground transition-colors"
              >
                {amt >= 1000 ? `${amt / 1000}k` : amt}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="font-mono text-xs text-muted-foreground">Leverage</label>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl">{leverage}x</span>
              <span className="font-mono text-xs text-muted-foreground">/ {maxLeverage}x max</span>
            </div>
          </div>
          <Slider
            min={1}
            max={maxLeverage}
            step={1}
            value={[leverage]}
            onValueChange={([v]) => setLeverage(v)}
            className="my-2"
          />
          <div className="flex justify-between mt-1">
            {Array.from({ length: maxLeverage }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                className={`font-mono text-[10px] transition-colors ${leverage === n ? "text-foreground" : "text-foreground/20"}`}
              >
                {n}x
              </span>
            ))}
          </div>
          {/* Tier cap hint */}
          <div className="mt-3 flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${zkVerified && walletConnected ? "bg-emerald-500" : "bg-yellow-500"}`} />
            {walletConnected && zkVerified
              ? `ZK T${zkTier} · ${tierLabel(zkTier)} · ${maxLeverage}x cap enforced by ZKVerifier`
              : `${TIERS[tier].label} tier · ${maxLeverage}x cap (demo)`
            }
          </div>
        </div>

        {/* Position summary */}
        <div className="bg-foreground/[0.02] border border-foreground/10 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-mono text-xs">Entry price</span>
            <span className="font-mono text-xs">${currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-mono text-xs">Notional size</span>
            <span className="font-mono text-xs">${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-mono text-xs">Liquidation price</span>
            <span className={`font-mono text-xs ${direction === "LONG" ? "text-red-600" : "text-red-600"}`}>
              ${liquidationPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-mono text-xs">Fee (0.1%)</span>
            <span className="font-mono text-xs">${(notional * 0.001).toFixed(2)}</span>
          </div>
        </div>

        {collateralNum === 0 && !needsVerification && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5" />
            Enter collateral amount to open a position
          </div>
        )}

        {needsVerification && (
          <div className="flex items-start gap-3 p-4 border-2 border-yellow-500/30 bg-yellow-500/10 text-xs rounded-sm">
            <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-500 mb-2">⚠️ Setup Required Before Trading</p>
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center gap-2 text-foreground/80">
                  <span className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center text-green-500 text-[10px]">✓</span>
                  <span>Wallet connected</span>
                </div>
                <div className="flex items-center gap-2 text-foreground/80">
                  <span className="w-4 h-4 rounded-full border-2 border-muted-foreground flex items-center justify-center text-[10px]">2</span>
                  <span>Get test tokens (USDC + Fee Token) - Click &quot;Get Test Tokens&quot; button</span>
                </div>
                <div className="flex items-center gap-2 text-foreground/80">
                  <span className="w-4 h-4 rounded-full border-2 border-muted-foreground flex items-center justify-center text-[10px]">3</span>
                  <span>Verify identity - Click yellow &quot;Verify Identity&quot; button in header</span>
                </div>
              </div>
              <p className="text-muted-foreground text-[10px]">
                The smart contract requires ZK proof verification before allowing trades. This ensures regulatory compliance while preserving privacy.
              </p>
            </div>
          </div>
        )}

        {!walletConnected && (
          <p className="text-center font-mono text-[10px] text-muted-foreground -mb-2">
            Connect wallet to trade on-chain · or use demo mode below
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full h-12 font-medium text-sm rounded-none transition-all group ${
            txStatus === "success"
              ? "bg-green-700 text-white hover:bg-green-700"
              : txStatus === "error"
              ? "bg-red-700 text-white hover:bg-red-700"
              : "bg-foreground text-background hover:bg-foreground/90"
          }`}
        >
          {isBusy ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{buttonLabel()}</>
          ) : txStatus === "success" || txStatus === "error" ? (
            buttonLabel()
          ) : (
            <>
              {buttonLabel()}
              <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>

        {txStatus === "error" && onResetTx && (
          <Button
            onClick={onResetTx}
            variant="outline"
            className="w-full h-10 font-medium text-sm rounded-none mt-2"
          >
            Reset & Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
