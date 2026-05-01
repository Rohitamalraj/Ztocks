"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { AssetSymbol, PriceData } from "@/hooks/use-asset-quotes";

interface PriceTickerProps {
  prices: Record<AssetSymbol, PriceData>;
  selectedAsset: AssetSymbol;
  onSelectAsset: (asset: AssetSymbol) => void;
}

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

export function PriceTicker({ prices, selectedAsset, onSelectAsset }: PriceTickerProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-foreground/10">
      {ASSETS.map((sym) => {
        const data = prices[sym];
        const isPositive = data.changePercent >= 0;
        const isSelected = selectedAsset === sym;

        return (
          <button
            key={sym}
            type="button"
            onClick={() => onSelectAsset(sym)}
            className={`bg-background p-5 lg:p-6 text-left transition-all duration-200 group ${
              isSelected ? "bg-foreground/[0.03]" : "hover:bg-foreground/[0.02]"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="font-mono text-xs text-muted-foreground">{sym}</span>
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-foreground mt-1" />}
            </div>
            <div className="text-2xl lg:text-3xl font-display tabular-nums">
              ${data.price.toFixed(2)}
            </div>
            <div className={`flex items-center gap-1 mt-2 text-sm font-mono ${isPositive ? "text-green-700" : "text-red-600"}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{isPositive ? "+" : ""}{data.changePercent.toFixed(2)}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
