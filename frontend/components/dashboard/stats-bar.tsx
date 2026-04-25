"use client"

import React from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import { TokenLogo } from '@/components/ui/token-logo'

interface Market {
  ticker: string
  name: string
  price: number
  change24h: number
  leverage: number
  isFavorite: boolean
}

interface StatsBarProps {
  selectedMarket: Market
  onMarketChange: (market: Market) => void
  markets: Market[]
  marketOpen: boolean
}

export function StatsBar({
  selectedMarket,
  onMarketChange,
  markets,
  marketOpen,
}: StatsBarProps) {
  const ticker = selectedMarket.ticker
  const currentPrice = selectedMarket.price
  const change24h = selectedMarket.change24h
  
  // Mock data for now - will be replaced with real data from backend/contracts
  const volume24h = currentPrice * 1000000 // Mock volume
  const high24h = currentPrice * 1.05 // Mock high
  const low24h = currentPrice * 0.95 // Mock low
  const openInterest = currentPrice * 500000 // Mock open interest
  const fundingRate = 0.0001 // Mock funding rate
  const indexPrice = currentPrice // Mock index price (same as current)
  const availableLiquidity = currentPrice * 2000000 // Mock liquidity
  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`
    return `$${num.toFixed(decimals)}`
  }

  return (
    <div className="w-full bg-background border-b border-foreground/10">
      <div className="max-w-[1920px] mx-auto px-6 py-3">
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
          {/* Market Selector */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <TokenLogo ticker={ticker} size="md" />
            <span className="font-mono text-lg font-semibold">{ticker}/USD</span>
          </div>

          {/* Current Price */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-lg font-semibold">${currentPrice.toLocaleString()}</span>
            <span className={`font-mono text-sm ${change24h >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
            </span>
            <span className={`px-2 py-0.5 font-mono text-[10px] ${marketOpen ? 'bg-green-700/10 text-green-700' : 'bg-red-600/10 text-red-600'}`}>
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>

          <div className="h-6 w-px bg-foreground/10 flex-shrink-0" />

          {/* 24h Volume */}
          <div className="flex flex-col flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">24h Volume</span>
            <span className="font-mono text-xs">{formatNumber(volume24h)}</span>
          </div>

          {/* 24h High */}
          <div className="flex flex-col flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">24h High</span>
            <span className="font-mono text-xs">${high24h.toLocaleString()}</span>
          </div>

          {/* 24h Low */}
          <div className="flex flex-col flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">24h Low</span>
            <span className="font-mono text-xs">${low24h.toLocaleString()}</span>
          </div>

          {/* Open Interest */}
          <div className="flex flex-col flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">Open Interest</span>
            <span className="font-mono text-xs">{formatNumber(openInterest)}</span>
          </div>

          {/* Funding Rate */}
          <div className="flex flex-col flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">Funding Rate</span>
            <span className={`font-mono text-xs ${fundingRate >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fundingRate >= 0 ? '+' : ''}{(fundingRate * 100).toFixed(4)}%
            </span>
          </div>

          {/* Index Price */}
          <div className="flex flex-col flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">Index Price</span>
            <span className="font-mono text-xs">${indexPrice.toLocaleString()}</span>
          </div>

          {/* Available Liquidity */}
          <div className="flex flex-col flex-shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">Available Liquidity</span>
            <span className="font-mono text-xs">{formatNumber(availableLiquidity)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
