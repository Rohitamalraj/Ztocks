"use client"

import React, { useState, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { LeverageSlider } from '@/components/ui/leverage-slider'

interface TradeFormProps {
  ticker: string
  currentPrice: number
  maxLeverage: number
  isTradeEnabled?: boolean
  isConnected: boolean
  isVerified?: boolean
  usdcBalance?: number
  txStatus?: string
  onTrade: (params: TradeParams) => void
  isTrading?: boolean
  onVerifyClick?: () => void
}

export interface TradeParams {
  direction: 'LONG' | 'SHORT'
  collateral: number
  leverage: number
  orderType: 'MARKET' | 'LIMIT'
  takeProfit?: number
  stopLoss?: number
}

export function TradeForm({ 
  ticker, 
  currentPrice, 
  maxLeverage, 
  isTradeEnabled = true,
  isConnected,
  isVerified = false,
  usdcBalance = 0,
  txStatus,
  onTrade,
  isTrading = false,
  onVerifyClick,
}: TradeFormProps) {
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET')
  const [collateral, setCollateral] = useState('')
  const [leverage, setLeverage] = useState(2)
  const [tpslEnabled, setTpslEnabled] = useState(false)
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  // Calculations
  const collateralNum = parseFloat(collateral) || 0
  const positionValue = collateralNum * leverage
  
  const liquidationPrice = useMemo(() => {
    if (!collateralNum || !currentPrice) return 0
    
    // Simplified liquidation calculation
    const liquidationPercentage = 1 / leverage
    if (direction === 'LONG') {
      return currentPrice * (1 - liquidationPercentage)
    } else {
      return currentPrice * (1 + liquidationPercentage)
    }
  }, [collateralNum, currentPrice, leverage, direction])

  const tradingFee = positionValue * 0.0005 // 0.05%
  const hspFee = positionValue * 0.0001 // 0.01%
  const totalFees = tradingFee + hspFee
  const priceImpact = positionValue > 10000 ? 0.1 : 0.05 // Simplified

  const handleSubmit = () => {
    if (!collateralNum || !isTradeEnabled) return

    onTrade({
      direction: direction as 'LONG' | 'SHORT',
      collateral: collateralNum,
      leverage,
      orderType,
      takeProfit: tpslEnabled && takeProfit ? parseFloat(takeProfit) : undefined,
      stopLoss: tpslEnabled && stopLoss ? parseFloat(stopLoss) : undefined,
    })
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-background border border-foreground/10">
      {/* Direction Tabs */}
      <div className="flex border-b border-foreground/10">
        <button
          onClick={() => setDirection('LONG')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-mono text-xs transition-colors ${
            direction === 'LONG'
              ? 'bg-green-700 text-white'
              : 'text-foreground/70 hover:bg-foreground/5'
          }`}
        >
          Long
        </button>
        <button
          onClick={() => setDirection('SHORT')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-mono text-xs transition-colors border-l border-r border-foreground/10 ${
            direction === 'SHORT'
              ? 'bg-red-600 text-white'
              : 'text-foreground/70 hover:bg-foreground/5'
          }`}
        >
          Short
        </button>
      </div>

      {/* Order Type */}
      <div className="flex border-b border-foreground/10">
        <button
          onClick={() => setOrderType('MARKET')}
          className={`flex-1 px-4 py-2 font-mono text-xs transition-colors ${
            orderType === 'MARKET'
              ? 'bg-foreground text-background'
              : 'text-foreground/70 hover:bg-foreground/5'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('LIMIT')}
          className={`flex-1 px-4 py-2 font-mono text-xs border-l border-foreground/10 transition-colors ${
            orderType === 'LIMIT'
              ? 'bg-foreground text-background'
              : 'text-foreground/70 hover:bg-foreground/5'
          }`}
        >
          Limit
        </button>
      </div>

      {/* Form Content - No Scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Pay Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-muted-foreground">Pay</span>
            <span className="font-mono text-xs">USDC</span>
          </div>
          <input
            type="number"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            placeholder="0.00"
            className="w-full text-2xl font-mono bg-transparent border-none outline-none"
          />
          <div className="font-mono text-xs text-muted-foreground mt-1">
            ${collateralNum.toFixed(2)}
          </div>
        </div>

        {/* Position Size */}
        <div className="pt-3 border-t border-foreground/10">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              {direction === 'LONG' ? 'Long' : 'Short'}
            </span>
            <span className="font-mono text-xs">{ticker}</span>
          </div>
          <div className="text-xl font-mono">
            {positionValue.toFixed(2)}
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">
            ${positionValue.toFixed(2)}
          </div>
        </div>

        {/* Leverage */}
        <div className="pt-3 border-t border-foreground/10">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] text-muted-foreground">Leverage</span>
            <span className="font-mono text-xs">{leverage.toFixed(1)}x</span>
          </div>
          <LeverageSlider
            value={leverage}
            onChange={setLeverage}
            max={maxLeverage}
            tierCap={maxLeverage}
          />
        </div>

        {/* Stats */}
        <div className="pt-3 border-t border-foreground/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">Liquidation Price</span>
            <span className="font-mono text-xs text-red-600">${liquidationPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">Fees</span>
            <span className="font-mono text-xs">${totalFees.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="shrink-0 p-4 border-t border-foreground/10 bg-background">
        {!isConnected ? (
          <button className="w-full py-3 bg-foreground text-background font-mono text-xs hover:bg-foreground/90 transition-colors">
            Connect Wallet
          </button>
        ) : !isVerified ? (
          <button
            onClick={onVerifyClick}
            className="w-full py-3 border border-primary/50 text-primary font-mono text-xs hover:bg-primary/5 transition-colors animate-pulse"
          >
            ⚡ Verify Identity to Trade
          </button>
        ) : (
          <>
            {usdcBalance > 0 && (
              <div className="font-mono text-[10px] text-muted-foreground mb-2 text-right">
                Balance: {usdcBalance.toFixed(2)} USDC
              </div>
            )}
            {!isTradeEnabled && (
              <div className="font-mono text-[10px] text-muted-foreground mb-2">
                Live data is available. Trading for this market will be enabled soon.
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!collateralNum || isTrading || !isTradeEnabled}
              className={`w-full py-3 font-mono text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                !isTradeEnabled
                  ? 'bg-foreground/20 text-foreground/70'
                  : direction === 'LONG'
                  ? 'bg-green-700 hover:bg-green-800 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isTrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {txStatus === 'approving-usdc' ? 'Approving USDC...' 
                    : txStatus === 'approving-hsp' ? 'Approving Fee Token...'
                    : 'Opening Position...'}
                </>
              ) : (
                <>
                  {!isTradeEnabled && `Trading for ${ticker} coming soon`}
                  {isTradeEnabled && direction === 'LONG' && `Long ${ticker}`}
                  {isTradeEnabled && direction === 'SHORT' && `Short ${ticker}`}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
