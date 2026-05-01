"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import { TokenLogo } from "@/components/ui/token-logo";
import type { AssetSymbol, PriceData } from "@/hooks/use-asset-quotes";
import type { CreateSipPlanInput, SipFrequency, SipPlan } from "@/hooks/use-sip-plans";

interface AssetOption {
  symbol: AssetSymbol;
  name: string;
}

interface SipPlannerPanelProps {
  selectedAsset: AssetSymbol;
  assets: AssetOption[];
  prices: Record<AssetSymbol, PriceData>;
  isConnected: boolean;
  isVerified: boolean;
  usdcBalance: number;
  plans: SipPlan[];
  runningPlanId?: string | null;
  onVerifyClick?: () => void;
  onCreatePlan: (input: CreateSipPlanInput) => void;
  onDeletePlan: (id: string) => void;
  onTogglePlan: (id: string) => void;
  onRunPlanNow: (id: string) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid";
  return date.toLocaleString();
}

function cleanTicker(symbol: AssetSymbol): string {
  return symbol.startsWith("s") ? symbol.slice(1) : symbol;
}

function formatSpotPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "N/A";
  if (value >= 100) return `$${value.toFixed(2)}`;
  if (value >= 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

export function SipPlannerPanel({
  selectedAsset,
  assets,
  prices,
  isConnected,
  isVerified,
  usdcBalance,
  plans,
  runningPlanId,
  onVerifyClick,
  onCreatePlan,
  onDeletePlan,
  onTogglePlan,
  onRunPlanNow,
}: SipPlannerPanelProps) {
  const [asset, setAsset] = useState<AssetSymbol>(selectedAsset);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<SipFrequency>("WEEKLY");

  const assetNameMap = useMemo(
    () => Object.fromEntries(assets.map((option) => [option.symbol, option.name])) as Record<AssetSymbol, string>,
    [assets]
  );
  const selectedPrice = prices[asset]?.price ?? 0;
  const selectedMove = prices[asset]?.changePercent ?? 0;

  useEffect(() => {
    setAsset(selectedAsset);
  }, [selectedAsset]);

  const amountNum = useMemo(() => Number.parseFloat(amount) || 0, [amount]);
  const canSubmit =
    isConnected &&
    isVerified &&
    amountNum > 0 &&
    Number.isFinite(amountNum);

  const handleCreate = () => {
    if (!canSubmit) return;
    onCreatePlan({
      asset,
      collateralUSDC: amountNum,
      frequency,
    });
    setAmount("");
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-background border border-foreground/10">
      <div className="p-4 border-b border-foreground/10">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs text-muted-foreground">SIP Investment Plans</h3>
          <span className="font-mono text-[10px] text-muted-foreground">{plans.length} plans</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {!isConnected ? (
          <div className="font-mono text-xs text-muted-foreground">Connect wallet to configure SIP plans.</div>
        ) : !isVerified ? (
          <button
            onClick={onVerifyClick}
            className="w-full py-2 border border-primary/50 text-primary font-mono text-xs hover:bg-primary/5 transition-colors"
          >
            Verify Identity to Create SIP Plans
          </button>
        ) : (
          <>
            <div className="font-mono text-[10px] text-muted-foreground text-right">
              Balance: {usdcBalance.toFixed(2)} USDC
            </div>

            <div className="border border-foreground/10 p-3">
              <div className="font-mono text-[10px] text-muted-foreground mb-2">Selected Market</div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <TokenLogo ticker={asset} size="md" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate">{cleanTicker(asset)}/USD</div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">{assetNameMap[asset]}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs">{formatSpotPrice(selectedPrice)}</div>
                  <div className={`font-mono text-[10px] ${selectedMove >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {selectedMove >= 0 ? "+" : ""}{selectedMove.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 border border-foreground/10 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-mono text-[10px] text-muted-foreground mb-1">Asset</label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value as AssetSymbol)}
                    className="w-full bg-background border border-foreground/20 px-2 py-1.5 font-mono text-xs"
                  >
                    {assets.map((option) => (
                      <option key={option.symbol} value={option.symbol}>
                        {option.symbol}/USD - {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] text-muted-foreground mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as SipFrequency)}
                    className="w-full bg-background border border-foreground/20 px-2 py-1.5 font-mono text-xs"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="border border-foreground/10 bg-foreground/[0.02] px-3 py-2">
                <div className="font-mono text-[10px] text-muted-foreground">Mode</div>
                <div className="font-mono text-xs text-green-700">DCA (Long-only, fixed 1x)</div>
              </div>

              <div>
                <label className="block font-mono text-[10px] text-muted-foreground mb-1">USDC Per Run</label>
                <input
                  type="number"
                  value={amount}
                  min="0"
                  step="0.01"
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  className="w-full bg-background border border-foreground/20 px-2 py-1.5 font-mono text-xs"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={!canSubmit}
                className="w-full py-2 bg-foreground text-background font-mono text-xs hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="w-3 h-3" /> Create SIP Plan
              </button>
            </div>
          </>
        )}

        <div className="space-y-2">
          {plans.length === 0 ? (
            <div className="font-mono text-[10px] text-muted-foreground text-center border border-dashed border-foreground/20 py-4">
              No SIP plans yet.
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="border border-foreground/10 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TokenLogo ticker={plan.asset} size="sm" />
                    <div className="min-w-0">
                      <div className="font-mono text-xs truncate">{cleanTicker(plan.asset)}/USD DCA 1x</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">{assetNameMap[plan.asset]}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 font-mono text-[10px] ${
                      plan.isActive
                        ? "bg-green-700/10 text-green-700"
                        : "bg-foreground/10 text-foreground/70"
                    }`}
                  >
                    {plan.isActive ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[10px] text-muted-foreground">
                    ${plan.collateralUSDC.toFixed(2)} {plan.frequency.toLowerCase()} | Runs: {plan.runCount}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px]">{formatSpotPrice(prices[plan.asset]?.price ?? 0)}</div>
                    <div className={`font-mono text-[10px] ${(prices[plan.asset]?.changePercent ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {(prices[plan.asset]?.changePercent ?? 0) >= 0 ? "+" : ""}{(prices[plan.asset]?.changePercent ?? 0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="font-mono text-[10px] text-muted-foreground">
                  Next run: {formatTime(plan.nextRunAt)}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRunPlanNow(plan.id)}
                    disabled={!plan.isActive || runningPlanId === plan.id || !isConnected || !isVerified}
                    className="px-2 py-1 font-mono text-[10px] border border-foreground/20 hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {runningPlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run now
                  </button>

                  <button
                    onClick={() => onTogglePlan(plan.id)}
                    className="px-2 py-1 font-mono text-[10px] border border-foreground/20 hover:bg-foreground/5 flex items-center gap-1"
                  >
                    {plan.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {plan.isActive ? "Pause" : "Resume"}
                  </button>

                  <button
                    onClick={() => onDeletePlan(plan.id)}
                    className="px-2 py-1 font-mono text-[10px] border border-red-600/40 text-red-600 hover:bg-red-600/10 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
