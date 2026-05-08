"use client"

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { TokenLogo } from '@/components/ui/token-logo'

interface Position {
  id: string
  ticker: string
  direction: 'LONG' | 'SHORT' | 'ENCRYPTED'
  size: number | null
  leverage: number | null
  entryPrice: number | null
  markPrice: number | null
  liquidationPrice: number | null
  pnl: number | null
  pnlPercentage: number | null
  decryptionStatus?: 'ready' | 'partial' | 'unavailable'
}

interface PositionsPanelProps {
  positions: Position[]
  onClosePosition: (id: string) => void
  isClosing?: string | null
}

function formatPnL(value: number): string {
  const abs = Math.abs(value)
  if (abs === 0) return "0.00"
  if (abs < 0.01) return value.toFixed(4)
  if (abs < 0.1) return value.toFixed(3)
  return value.toFixed(2)
}

function formatPct(value: number): string {
  const abs = Math.abs(value)
  if (abs === 0) return "0.00"
  if (abs < 0.01) return value.toFixed(4)
  return value.toFixed(2)
}

function formatPrice(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(2)
  if (abs >= 1) return value.toFixed(3)
  return value.toFixed(4)
}

function showMaybeMoney(value: number | null): string {
  if (value === null) return "Encrypted";
  return `$${formatPrice(value)}`;
}

export function PositionsPanel({ positions, onClosePosition, isClosing }: PositionsPanelProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'trades' | 'claims'>('positions')
  const [chartPositions, setChartPositions] = useState(false)

  const tabs = [
    { key: 'positions' as const, label: 'Positions', count: positions.length },
    { key: 'orders' as const, label: 'Orders', count: 0 },
    { key: 'trades' as const, label: 'Trades', count: 0 },
    { key: 'claims' as const, label: 'Claims', count: 0 },
  ]

  return (
    <div className="h-full flex flex-col bg-background border border-foreground/10">
      {/* Header */}
      <div className="p-4 border-b border-foreground/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 font-mono text-xs transition-colors ${
                  activeTab === tab.key
                    ? 'bg-foreground text-background'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-foreground/10 font-mono text-[10px]">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={chartPositions}
              onChange={(e) => setChartPositions(e.target.checked)}
              className="w-3 h-3 border-foreground/20"
            />
            Chart positions
          </label>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'positions' && (
        <>
          {positions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-muted-foreground font-mono text-xs mb-2">No open positions</div>
              <div className="font-mono text-[10px] text-muted-foreground/70">
                Open your first position to start trading
              </div>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 px-4 py-2 font-mono text-[10px] text-muted-foreground border-b border-foreground/10">
                <div>POSITION</div>
                <div className="text-right">SIZE</div>
                <div className="text-right">LEV</div>
                <div className="text-right">ENTRY</div>
                <div className="text-right">MARK</div>
                <div className="text-right">LIQ. PRICE</div>
                <div className="text-right">PNL</div>
                <div className="text-right">ACTION</div>
              </div>

              {/* Positions List */}
              <div className="flex-1 overflow-y-auto">
                {positions.map((position) => (
                  <div
                    key={position.id}
                    className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 px-4 py-3 border-b border-foreground/10 hover:bg-foreground/[0.02] transition-colors"
                  >
                    {/* Position */}
                    <div className="flex items-center gap-2">
                      <TokenLogo ticker={position.ticker} size="sm" />
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{position.ticker}/USD</span>
                        <span
                          className={`font-mono text-[10px] ${
                            position.direction === 'LONG'
                              ? 'text-green-700'
                              : position.direction === 'SHORT'
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {position.direction}
                        </span>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="flex items-center justify-end">
                      <span className="font-mono text-xs">
                        {position.size === null ? "Encrypted" : `$${position.size.toLocaleString()}`}
                      </span>
                    </div>

                    {/* Leverage */}
                    <div className="flex items-center justify-end">
                      <span className="font-mono text-xs">
                        {position.leverage === null ? "Encrypted" : `${position.leverage}x`}
                      </span>
                    </div>

                    {/* Entry Price */}
                    <div className="flex items-center justify-end">
                      <span className="font-mono text-xs">{showMaybeMoney(position.entryPrice)}</span>
                    </div>

                    {/* Mark Price */}
                    <div className="flex items-center justify-end">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs">{showMaybeMoney(position.markPrice)}</span>
                        {position.markPrice !== null && position.entryPrice !== null ? (
                          <span className={`font-mono text-[10px] ${position.markPrice >= position.entryPrice ? 'text-green-700/70' : 'text-red-600/70'}`}>
                            {position.markPrice >= position.entryPrice ? '+' : ''}{(position.markPrice - position.entryPrice).toFixed(4)}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-muted-foreground">Encrypted</span>
                        )}
                      </div>
                    </div>

                    {/* Liquidation Price */}
                    <div className="flex items-center justify-end">
                      <span className="font-mono text-xs text-red-600">
                        {position.liquidationPrice === null ? "Encrypted" : `$${position.liquidationPrice.toFixed(2)}`}
                      </span>
                    </div>

                    {/* PNL */}
                    <div className="flex items-center justify-end">
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-mono text-xs ${
                            position.pnl === null
                              ? 'text-muted-foreground'
                              : position.pnl >= 0
                                ? 'text-green-700'
                                : 'text-red-600'
                          }`}
                        >
                          {position.pnl === null ? 'Encrypted' : `${position.pnl >= 0 ? '+' : ''}$${formatPnL(position.pnl)}`}
                        </span>
                        <span
                          className={`font-mono text-[10px] ${
                            position.pnl === null
                              ? 'text-muted-foreground'
                              : position.pnl >= 0
                                ? 'text-green-700/70'
                                : 'text-red-600/70'
                          }`}
                        >
                          {position.pnlPercentage === null ? 'Encrypted' : `${position.pnlPercentage >= 0 ? '+' : ''}${formatPct(position.pnlPercentage)}%`}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => onClosePosition(position.id)}
                        disabled={isClosing === position.id}
                        className="px-3 py-1 font-mono text-[10px] bg-red-600/10 text-red-600 hover:bg-red-600/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isClosing === position.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Close'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Other tabs - empty state */}
      {activeTab !== 'positions' && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono text-xs">
          No {activeTab} yet
        </div>
      )}
    </div>
  )
}
