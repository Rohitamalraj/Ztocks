"use client"

import React, { useState, useMemo } from 'react'
import { Search, Star } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { TokenLogo } from '@/components/ui/token-logo'

interface Market {
  ticker: string
  name: string
  price: number
  change24h: number
  leverage: number
  maxLeverage?: number
  isFavorite?: boolean
}

interface MarketsPanelProps {
  markets: Market[]
  selectedMarket: string
  onSelectMarket: (ticker: string) => void
  onToggleFavorite?: (ticker: string) => void
}

export function MarketsPanel({ markets, selectedMarket, onSelectMarket, onToggleFavorite }: MarketsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all')
  
  const debouncedSearch = useDebounce(searchQuery, 300)

  const filteredMarkets = useMemo(() => {
    let filtered = markets

    // Filter by tab
    if (activeTab === 'favorites') {
      filtered = filtered.filter(m => m.isFavorite)
    }

    // Filter by search
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase()
      filtered = filtered.filter(m => 
        m.ticker.toLowerCase().includes(query) || 
        m.name.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [markets, activeTab, debouncedSearch])

  const getLeverageColor = (leverage: number) => {
    if (leverage <= 2) return 'text-green-700 bg-green-700/5 border-green-700/20'
    if (leverage <= 5) return 'text-foreground bg-foreground/5 border-foreground/20'
    if (leverage <= 8) return 'text-foreground bg-foreground/5 border-foreground/20'
    return 'text-yellow-600 bg-yellow-600/5 border-yellow-600/20'
  }

  return (
    <div className="h-full flex flex-col border border-foreground/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-foreground/10">
        <h2 className="font-mono text-xs text-muted-foreground mb-3">Markets</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Market"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-foreground/10 focus:border-foreground/40 font-mono text-xs outline-none transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-px bg-foreground/10 mt-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 font-mono text-xs transition-colors ${
              activeTab === 'all' 
                ? 'bg-foreground text-background' 
                : 'bg-background text-muted-foreground hover:bg-foreground/[0.02]'
            }`}
          >
            All Markets
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 font-mono text-xs transition-colors ${
              activeTab === 'favorites' 
                ? 'bg-foreground text-background' 
                : 'bg-background text-muted-foreground hover:bg-foreground/[0.02]'
            }`}
          >
            Favorites
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 px-4 py-2 font-mono text-[10px] text-muted-foreground border-b border-foreground/10">
        <div></div>{/* star */}
        <div></div>{/* logo */}
        <div>MARKET</div>
        <div className="text-right">LAST PRICE</div>
        <div className="text-right">24H%</div>
      </div>

      {/* Markets List */}
      <div className="flex-1 overflow-y-auto">
        {filteredMarkets.length === 0 ? (
          <div className="flex items-center justify-center h-32 font-mono text-xs text-muted-foreground">
            {activeTab === 'favorites' ? 'No favorites yet' : 'No markets found'}
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <div
              key={market.ticker}
              onClick={() => onSelectMarket(market.ticker)}
              className={`w-full grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 px-4 py-3 cursor-pointer border-b border-foreground/10 hover:bg-foreground/[0.02] transition-colors ${
                selectedMarket === market.ticker ? 'bg-foreground/[0.04]' : ''
              }`}
            >
              {/* Favorite Star */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite?.(market.ticker)
                }}
                className="flex items-center justify-center w-5 h-5 hover:scale-110 transition-transform"
              >
                <Star 
                  className={`w-4 h-4 ${market.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                />
              </button>

              {/* Market Info */}
              <div className="flex items-center gap-2">
                <TokenLogo ticker={market.ticker} size="sm" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{market.ticker}/USD</span>
                    <span className={`px-1.5 py-0.5 font-mono text-[10px] border ${getLeverageColor(market.leverage ?? market.maxLeverage ?? 2)}`}>
                      {market.leverage ?? market.maxLeverage ?? 2}x
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{market.name}</span>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-center justify-end">
                <span className="font-mono text-xs">${market.price.toLocaleString()}</span>
              </div>

              {/* 24h Change */}
              <div className="flex items-center justify-end">
                <span className={`font-mono text-xs ${market.change24h >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
