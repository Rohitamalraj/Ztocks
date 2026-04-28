"use client"

import React, { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData as LWCandlestickData } from 'lightweight-charts'
import { getChartConfig, getCandlestickConfig, CandlestickData } from '@/lib/chart-utils'
import { Maximize2, Camera, Settings, ChevronDown } from 'lucide-react'

import { useFinnhubCandles } from '@/hooks/useFinnhubCandles'

interface CandlestickChartProps {
  ticker: string
  selectedTimeframe: string
  onTimeframeChange: (timeframe: string) => void
  marketOpen: boolean
}

const timeframes = ['1m', '5m', '15m', '1h', '4h', 'D', 'W', 'M']
const chartTypes = ['Candles', 'Hollow Candles', 'Bars', 'Line', 'Area']
const indicators = ['SMA', 'EMA', 'BB', 'RSI', 'MACD', 'Volume']

export function CandlestickChart({ 
  ticker,
  selectedTimeframe,
  onTimeframeChange,
  marketOpen,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<any>(null)
  
  const [activeTab, setActiveTab] = useState<'price' | 'depth'>('price')
  
  // The ticker in zkSynth has an 's' prefix (e.g. sAAPL). Finnhub needs 'AAPL'.
  const realTicker = ticker.startsWith('s') ? ticker.slice(1) : ticker;
  const { data, loading, error } = useFinnhubCandles(realTicker, selectedTimeframe, true);
  const currentPrice = data && data.length > 0 ? data[data.length - 1].close : 0;
  
  // Calculate 24h change from available candle data
  const change24h = data && data.length > 0 ? ((data[data.length - 1].close - data[0].open) / data[0].open) * 100 : 0;

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      ...getChartConfig(),
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    })

    const candlestickSeries = chart.addCandlestickSeries(getCandlestickConfig())
    
    chartRef.current = chart
    seriesRef.current = candlestickSeries

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Update data
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData: LWCandlestickData[] = data.map(d => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      seriesRef.current.setData(formattedData)
    }
  }, [data])

  const handleTimeframeClick = (tf: string) => {
    onTimeframeChange(tf)
  }

  // Calculate OHLC from data
  const ohlc = data && data.length > 0 ? {
    open: data[0].open,
    high: Math.max(...data.map(d => d.high)),
    low: Math.min(...data.map(d => d.low)),
    close: data[data.length - 1].close,
  } : { open: 0, high: 0, low: 0, close: 0 }

  return (
    <div className="h-full flex flex-col bg-background border border-foreground/10">
      {/* Header */}
      <div className="p-4 border-b border-foreground/10">
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => setActiveTab('price')}
            className={`px-4 py-1.5 font-mono text-xs transition-colors ${
              activeTab === 'price' 
                ? 'bg-foreground text-background' 
                : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            Price
          </button>
          <button
            onClick={() => setActiveTab('depth')}
            className={`px-4 py-1.5 font-mono text-xs transition-colors ${
              activeTab === 'depth' 
                ? 'bg-foreground text-background' 
                : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            Depth
          </button>
        </div>

        {/* Asset Info */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold">{ticker}/USD</span>
            <span className={`px-2 py-0.5 font-mono text-[10px] ${marketOpen ? 'bg-green-700/10 text-green-700' : 'bg-red-600/10 text-red-600'}`}>
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>
          
          <div className="flex items-center gap-4 font-mono text-xs">
            <div>
              <span className="text-muted-foreground">O</span>
              <span className="ml-1">${ohlc.open.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">H</span>
              <span className="ml-1">${ohlc.high.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">L</span>
              <span className="ml-1">${ohlc.low.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">C</span>
              <span className="ml-1">${ohlc.close.toFixed(2)}</span>
            </div>
            <div className={change24h >= 0 ? 'text-green-700' : 'text-red-600'}>
              {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-b border-foreground/10 flex items-center justify-between gap-2 flex-wrap">
        {/* Timeframes */}
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeClick(tf)}
              className={`px-3 py-1 font-mono text-xs transition-colors ${
                selectedTimeframe === tf
                  ? 'bg-foreground text-background'
                  : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart Controls */}
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-foreground/5 transition-colors" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-foreground/5 transition-colors" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="flex-1 relative">
        {(!data || data.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-mono text-xs">
            Loading chart data...
          </div>
        )}
      </div>

      {/* TradingView Attribution */}
      <div className="px-4 py-2 font-mono text-[10px] text-muted-foreground border-t border-foreground/10">
        Powered by TradingView-style charts
      </div>
    </div>
  )
}
