"use client";

import { useState, useCallback } from "react";
import type { AssetSymbol, PriceData } from "./use-mock-prices";

export type Direction = "LONG" | "SHORT";

export interface Position {
  id: string;
  asset: AssetSymbol;
  direction: Direction;
  collateralUSDC: number;
  leverage: number;
  entryPrice: number;
  openedAt: Date;
}

export function calcPnl(position: Position, currentPrice: number): number {
  const { direction, entryPrice, collateralUSDC, leverage } = position;
  const priceDelta = direction === "LONG"
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;
  return priceDelta * collateralUSDC * leverage;
}

export function calcHealthFactor(position: Position, currentPrice: number): number {
  const notional = position.collateralUSDC * position.leverage;
  const pnl = calcPnl(position, currentPrice);
  return (position.collateralUSDC + pnl) / notional;
}

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);

  const openPosition = useCallback((
    asset: AssetSymbol,
    direction: Direction,
    collateralUSDC: number,
    leverage: number,
    currentPrice: number
  ) => {
    const newPos: Position = {
      id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      asset,
      direction,
      collateralUSDC,
      leverage,
      entryPrice: currentPrice,
      openedAt: new Date(),
    };
    setPositions((prev) => [newPos, ...prev]);
    return newPos;
  }, []);

  const closePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { positions, openPosition, closePosition };
}
