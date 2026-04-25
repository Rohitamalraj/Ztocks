"use client"

import React, { useState } from 'react'
import { getStockLogoUrl } from '@/lib/utils'

interface TokenLogoProps {
  ticker: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-5 h-5 text-[9px]',
  md: 'w-6 h-6 text-[10px]',
  lg: 'w-8 h-8 text-xs'
}

// Gradient fallbacks per ticker
const FALLBACK_GRADIENTS: Record<string, string> = {
  AAPL: 'from-zinc-400 to-zinc-600',
  TSLA: 'from-red-400 to-red-600',
  NVDA: 'from-green-400 to-green-600',
  SPY:  'from-blue-400 to-blue-600',
  AMZN: 'from-amber-400 to-orange-500',
  MSFT: 'from-sky-400 to-blue-600',
  META: 'from-indigo-400 to-fuchsia-500',
  NFLX: 'from-red-500 to-rose-700',
  AMD:  'from-purple-400 to-indigo-600',
}

export function TokenLogo({ ticker, size = 'md', className = '' }: TokenLogoProps) {
  const [hasError, setHasError] = useState(false)

  // Strip "s" prefix for synth tickers
  const clean = ticker.startsWith('s') ? ticker.slice(1) : ticker
  const gradient = FALLBACK_GRADIENTS[clean] ?? 'from-primary/30 to-primary/10'

  if (hasError) {
    return (
      <div
        className={`${sizeMap[size]} ${className} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white shrink-0`}
      >
        {clean.slice(0, 2)}
      </div>
    )
  }

  return (
    <img
      src={getStockLogoUrl(ticker)}
      alt={`${clean} logo`}
      className={`${sizeMap[size]} ${className} rounded-full object-cover shrink-0`}
      onError={() => setHasError(true)}
    />
  )
}
