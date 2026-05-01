"use client";

import type { Position } from "@/hooks/use-positions";
import { calcPnl } from "@/hooks/use-positions";
import type { AssetSymbol, PriceData } from "@/hooks/use-asset-quotes";
import type { TierKey } from "./dashboard-nav";
import { TIERS } from "./dashboard-nav";

interface PortfolioSummaryProps {
  positions: Position[];
  prices: Record<AssetSymbol, PriceData>;
  tier: TierKey;
}

export function PortfolioSummary({ positions, prices, tier }: PortfolioSummaryProps) {
  const totalCollateral = positions.reduce((sum, p) => sum + p.collateralUSDC, 0);
  const totalPnl = positions.reduce((sum, p) => sum + calcPnl(p, prices[p.asset].price), 0);
  const totalValue = totalCollateral + totalPnl;
  const totalPnlPercent = totalCollateral > 0 ? (totalPnl / totalCollateral) * 100 : 0;

  const tierInfo = TIERS[tier];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10">
      <div className="bg-background p-5 lg:p-6">
        <div className="font-mono text-xs text-muted-foreground mb-2">Portfolio Value</div>
        <div className="text-2xl font-display tabular-nums">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div className="bg-background p-5 lg:p-6">
        <div className="font-mono text-xs text-muted-foreground mb-2">Total P&amp;L</div>
        <div className={`text-2xl font-display tabular-nums ${totalPnl >= 0 ? "text-green-700" : "text-red-600"}`}>
          {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          <span className="text-sm ml-1 opacity-70">({totalPnl >= 0 ? "+" : ""}{totalPnlPercent.toFixed(1)}%)</span>
        </div>
      </div>

      <div className="bg-background p-5 lg:p-6">
        <div className="font-mono text-xs text-muted-foreground mb-2">Open Positions</div>
        <div className="text-2xl font-display">{positions.length}</div>
      </div>

      <div className="bg-background p-5 lg:p-6">
        <div className="font-mono text-xs text-muted-foreground mb-2">ZK Tier</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <div>
            <div className="text-sm font-medium">{tierInfo.label}</div>
            <div className="font-mono text-xs text-muted-foreground">Max {tierInfo.cap}x leverage</div>
          </div>
        </div>
      </div>
    </div>
  );
}
