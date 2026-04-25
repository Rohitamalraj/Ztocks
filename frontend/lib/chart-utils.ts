import { DeepPartial, ChartOptions, CandlestickSeriesOptions } from 'lightweight-charts'

export function getChartConfig(): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { color: 'transparent' },
      textColor: '#737373',
    },
    grid: {
      vertLines: { color: '#e5e5e5' },
      horzLines: { color: '#e5e5e5' },
    },
    crosshair: {
      mode: 1, // Normal crosshair
      vertLine: {
        color: '#737373',
        width: 1,
        style: 2, // Dashed
        labelBackgroundColor: '#1f1f1f',
      },
      horzLine: {
        color: '#737373',
        width: 1,
        style: 2,
        labelBackgroundColor: '#1f1f1f',
      },
    },
    timeScale: {
      borderColor: '#e5e5e5',
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: '#e5e5e5',
    },
  }
}

export function getCandlestickConfig(): DeepPartial<CandlestickSeriesOptions> {
  return {
    upColor: '#10b981', // Green
    downColor: '#ef4444', // Red
    borderUpColor: '#10b981',
    borderDownColor: '#ef4444',
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444',
  }
}

export interface CandlestickData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export function generateMockCandlestickData(
  basePrice: number,
  count: number = 100,
  timeframe: string = '1h'
): CandlestickData[] {
  const data: CandlestickData[] = []
  const now = Math.floor(Date.now() / 1000)
  
  // Timeframe in seconds
  const timeframeSeconds: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    'D': 86400,
    'W': 604800,
    'M': 2592000,
  }
  
  const interval = timeframeSeconds[timeframe] || 3600
  let currentPrice = basePrice

  for (let i = count; i > 0; i--) {
    const time = now - (i * interval)
    const volatility = basePrice * 0.02 // 2% volatility
    
    const open = currentPrice
    const change = (Math.random() - 0.5) * volatility
    const close = open + change
    const high = Math.max(open, close) + Math.random() * volatility * 0.5
    const low = Math.min(open, close) - Math.random() * volatility * 0.5
    
    data.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    })
    
    currentPrice = close
  }

  return data
}
