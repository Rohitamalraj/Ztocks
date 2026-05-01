"use client";

import { useState, useEffect, useRef } from "react";

export type AssetSymbol =
  | "sAAPL"
  | "sTSLA"
  | "sNVDA"
  | "sSPY"
  | "sAMZN"
  | "sMSFT"
  | "sMETA"
  | "sNFLX"
  | "sAMD";

export interface PriceData {
  price: number;
  change24h: number;
  changePercent: number;
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

const TICKERS: Record<AssetSymbol, string> = {
  sAAPL: "AAPL",
  sTSLA: "TSLA",
  sNVDA: "NVDA",
  sSPY: "SPY",
  sAMZN: "AMZN",
  sMSFT: "MSFT",
  sMETA: "META",
  sNFLX: "NFLX",
  sAMD: "AMD",
};

type QuotePayload =
  | {
      c?: number;
      d?: number;
      dp?: number;
      pc?: number;
    }
  | null;

const initPrices = (): Record<AssetSymbol, PriceData> =>
  ASSETS.reduce((acc, sym) => {
    acc[sym] = { price: 0, change24h: 0, changePercent: 0 };
    return acc;
  }, {} as Record<AssetSymbol, PriceData>);

export function useAssetQuotes() {
  const [prices, setPrices] = useState<Record<AssetSymbol, PriceData>>(initPrices);
  const quoteWarningShownRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const symbolsParam = ASSETS.map((sym) => TICKERS[sym]).join(",");

    async function pollQuotes() {
      try {
        const response = await fetch(`/api/stocks/quotes?symbols=${symbolsParam}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as Record<string, QuotePayload>;
        if (cancelled) return;

        setPrices((prev) => {
          const next = { ...prev };
          let changed = false;

          ASSETS.forEach((sym) => {
            const quote = payload?.[TICKERS[sym]];
            const hasLiveQuote = !!quote && typeof quote.c === "number" && quote.c > 0;

            if (!hasLiveQuote) {
              return;
            }

            const price = quote.c as number;
            const prevClose = typeof quote.pc === "number" && quote.pc > 0 ? quote.pc : undefined;
            const change24h =
              typeof quote.d === "number" ? quote.d : prevClose ? price - prevClose : 0;
            const changePercent =
              typeof quote.dp === "number" ? quote.dp : prevClose ? (change24h / prevClose) * 100 : 0;

            const nextData: PriceData = { price, change24h, changePercent };
            if (
              !prev[sym] ||
              prev[sym].price !== nextData.price ||
              prev[sym].change24h !== nextData.change24h ||
              prev[sym].changePercent !== nextData.changePercent
            ) {
              next[sym] = nextData;
              changed = true;
            }
          });

          return changed ? next : prev;
        });

        quoteWarningShownRef.current = false;
      } catch (error) {
        if (!quoteWarningShownRef.current) {
          console.warn("[Ztocks:prices] Failed to fetch live API quotes", error);
          quoteWarningShownRef.current = true;
        }
      }
    }

    void pollQuotes();
    const intervalId = window.setInterval(() => {
      void pollQuotes();
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return prices;
}
