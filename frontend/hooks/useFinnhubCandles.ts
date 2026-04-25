"use client"

import { useState, useEffect, useRef } from "react"

export type FinnhubOHLC = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const FALLBACK_PRICES: Record<string, number> = {
  AAPL: 192.1,
  TSLA: 251.2,
  NVDA: 875.4,
  SPY: 542.3,
  AMZN: 186.5,
  MSFT: 425.3,
  META: 512.8,
  NFLX: 640.2,
  AMD: 168.4,
}

function getFallbackPriceForTicker(ticker: string): number {
  return FALLBACK_PRICES[ticker.toUpperCase()] ?? 100
}

// Generate initial intraday candles from daily data
function generateInitialCandles(
  currentPrice: number,
  dailyOpen: number,
  dailyHigh: number,
  dailyLow: number,
  timeframe: string,
  count: number
): FinnhubOHLC[] {
  const now = Math.floor(Date.now() / 1000)
  const candles: FinnhubOHLC[] = []

  const intervalMap: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    D: 86400,
    W: 604800,
    M: 2592000,
  }
  const intervalSeconds = intervalMap[timeframe] || 300

  const priceRange = dailyHigh - dailyLow
  const volatility = priceRange / currentPrice

  let prevClose = currentPrice
  for (let i = 0; i < count; i++) {
    const candleTime = now - (i * intervalSeconds)
    const randomWalk = (Math.random() - 0.5) * volatility * currentPrice * 0.3
    const trend = ((count - i) / count - 0.5) * (currentPrice - dailyOpen)

    const open = prevClose
    const close = currentPrice + randomWalk + trend * 0.1

    const candleVolatility = Math.abs(close - open) * (1 + Math.random() * 0.5)
    const high = Math.max(open, close) + candleVolatility * 0.3
    const low = Math.min(open, close) - candleVolatility * 0.3

    const boundedHigh = Math.min(high, dailyHigh)
    const boundedLow = Math.max(low, dailyLow)

    candles.unshift({
      time: candleTime,
      open: Number(open.toFixed(2)),
      high: Number(boundedHigh.toFixed(2)),
      low: Number(boundedLow.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000) + 500000,
    })

    prevClose = close
  }

  return candles
}

function getIntervalSeconds(timeframe: string): number {
  const intervalMap: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "D": 86400,
    "W": 604800,
    "M": 2592000,
  }
  return intervalMap[timeframe] || 300
}

export function useFinnhubCandles(
  ticker: string,
  timeframe: string,
  enabled: boolean
): {
  data: FinnhubOHLC[]
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<FinnhubOHLC[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const wsDisabled = useRef(false)
  const wsReconnectAttempts = useRef(0)
  const lastTradePrice = useRef<number | null>(null)
  const lastTradeTime = useRef<number>(Date.now())
  const fallbackInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled || !ticker) {
      setData([])
      return
    }

    let cancelled = false

    const initialize = async () => {
      console.log(`Initializing candles for ${ticker} (${timeframe})`)
      setLoading(true)
      setError(null)
      try {
        let quote:
          | { c?: number; o?: number; h?: number; l?: number; pc?: number }
          | null
          | undefined = null

        try {
          // Get current quote for real-time price (fetch only the specific ticker)
          const quoteRes = await fetch(`/api/stocks/quotes?symbols=${ticker}`, { cache: "no-store" })
          if (quoteRes.ok) {
            const quotes = (await quoteRes.json()) as Record<
              string,
              { c?: number; o?: number; h?: number; l?: number; pc?: number } | null
            >
            quote = quotes[ticker]
          } else {
            console.warn(`Quote endpoint returned ${quoteRes.status} for ${ticker}; using fallback price`)
          }
        } catch (quoteError) {
          console.warn(`Quote fetch failed for ${ticker}; using fallback price`, quoteError)
        }

        const fallbackPrice = getFallbackPriceForTicker(ticker)
        const currentPrice = quote?.c && quote.c > 0 ? quote.c : fallbackPrice
        const dailyOpen = quote?.o && quote.o > 0 ? quote.o : quote?.pc && quote.pc > 0 ? quote.pc : currentPrice * 0.995
        const dailyHigh = quote?.h && quote.h > 0 ? quote.h : currentPrice * 1.01
        const dailyLow = quote?.l && quote.l > 0 ? quote.l : currentPrice * 0.99

        if (!quote?.c || quote.c <= 0) {
          console.warn(`No live quote for ${ticker}; chart seeded from fallback price ${currentPrice}`)
        }

        console.log(`Got quote for ${ticker}: price=${currentPrice}`)
        lastTradePrice.current = currentPrice

        // For intraday timeframes, generate initial candles
        const isIntraday = ["1m", "5m", "15m", "1h", "4h"].includes(timeframe)

        if (isIntraday) {
          const count = timeframe === "1m" ? 120 : timeframe === "5m" ? 120 : 100
          const candles = generateInitialCandles(
            currentPrice,
            dailyOpen,
            dailyHigh,
            dailyLow,
            timeframe,
            count
          )
          if (!cancelled) {
            console.log(`Generated ${candles.length} initial candles`)
            setData(candles)
            setLoading(false)

            // Start WebSocket connection
            connectWebSocket()
            // Also start fallback polling in case WebSocket doesn't get trades (market closed, etc)
            startFallbackPolling()
          }
        } else {
          // For daily/weekly/monthly, try to fetch from Finnhub
          const resolution = timeframe === "D" ? "D" : timeframe === "W" ? "W" : "M"
          const count = 100
          const params = new URLSearchParams({
            symbol: ticker,
            resolution,
            count: String(count),
          })
          let candles: FinnhubOHLC[] | null = null

          try {
            const res = await fetch(`/api/stocks/candles?${params.toString()}`, {
              cache: "no-store",
            })

            if (res.ok) {
              const json = await res.json()
              if (json && json.s === "ok" && Array.isArray(json.t) && json.t.length > 0) {
                candles = json.t.map((t: number, i: number) => ({
                  time: t,
                  open: json.o[i],
                  high: json.h[i],
                  low: json.l[i],
                  close: json.c[i],
                  volume: json.v[i],
                }))
              }
            }
          } catch (candleError) {
            console.warn(`Candle fetch failed for ${ticker}; using synthetic candles`, candleError)
          }

          const nextCandles = candles && candles.length > 0
            ? candles
            : generateInitialCandles(currentPrice, dailyOpen, dailyHigh, dailyLow, timeframe, count)

          if (!cancelled) {
            setData(nextCandles)
            setLoading(false)
            connectWebSocket()
            startFallbackPolling()
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Candle initialization error:", e)
          setError(e instanceof Error ? e.message : "Failed to load candle data")
          setData([])
          setLoading(false)
        }
      }
    }

    const connectWebSocket = () => {
      if (cancelled || wsDisabled.current) return

      const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY
      if (!apiKey) {
        wsDisabled.current = true
        console.info("Finnhub WebSocket disabled: NEXT_PUBLIC_FINNHUB_API_KEY is not set; using polling updates")
        return
      }

      const wsUrl = `wss://ws.finnhub.io?token=${apiKey}`
      console.log(`Connecting to WebSocket: ${wsUrl}`)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        wsReconnectAttempts.current = 0
        console.log(`✅ WebSocket connected for ${ticker}`)
        const subscribeMsg = { type: "subscribe", symbol: ticker }
        console.log(`Sending subscription:`, subscribeMsg)
        ws.send(JSON.stringify(subscribeMsg))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log(`📩 WebSocket message:`, message)

          // Finnhub sends trade data: { type: 'trade', data: [{ p: price, s: symbol, t: timestamp, v: volume }] }
          if (message.type === "trade" && Array.isArray(message.data)) {
            console.log(`📊 Received ${message.data.length} trades`)
            for (const trade of message.data) {
              console.log(`Trade data:`, trade)
              if (trade.s === ticker && trade.p) {
                const tradePrice = trade.p
                lastTradePrice.current = tradePrice
                lastTradeTime.current = Date.now()

                console.log(`💰 [${new Date().toLocaleTimeString()}] Trade: ${ticker} @ $${tradePrice}`)

                // Update the last candle
                updateCandleWithPrice(tradePrice)
              }
            }
          } else if (message.type === "ping") {
            console.log(`🏓 Received ping`)
            ws.send(JSON.stringify({ type: "pong" }))
          }
        } catch (err) {
          console.error("WebSocket message error:", err)
        }
      }

      ws.onerror = (error) => {
        wsDisabled.current = true
        console.warn("WebSocket unavailable; switched to polling-only updates", error)
        ws.close()
      }

      ws.onclose = (event) => {
        wsRef.current = null
        console.log(`🔌 WebSocket closed for ${ticker}`, event.code, event.reason)
        // Reconnect a few times only for transient closures, then stay on polling.
        const canRetry = !cancelled && !wsDisabled.current && wsReconnectAttempts.current < 3
        if (canRetry) {
          wsReconnectAttempts.current += 1
          console.log(`🔄 Reconnecting in 3 seconds...`)
          setTimeout(connectWebSocket, 3000)
        }
      }
    }

    const updateCandleWithPrice = (currentPrice: number) => {
      const now = Math.floor(Date.now() / 1000)
      const intervalSeconds = getIntervalSeconds(timeframe)

      console.log(`📊 Updating candle with price: $${currentPrice}`)

      setData((prevData) => {
        if (prevData.length === 0) {
          console.warn(`⚠️ No candles to update`)
          return prevData
        }

        const newData = [...prevData]
        const lastCandle = newData[newData.length - 1]
        const timeSinceLastCandle = now - lastCandle.time

        console.log(`Last candle: O=${lastCandle.open} H=${lastCandle.high} L=${lastCandle.low} C=${lastCandle.close}`)
        console.log(`Time since last candle: ${timeSinceLastCandle}s (interval: ${intervalSeconds}s)`)

        // Check if we need to create a new candle
        if (timeSinceLastCandle >= intervalSeconds) {
          console.log(`🆕 Creating new candle at ${new Date(now * 1000).toLocaleTimeString()}`)
          const newCandle: FinnhubOHLC = {
            time: lastCandle.time + intervalSeconds,
            open: lastCandle.close,
            high: Math.max(lastCandle.close, currentPrice),
            low: Math.min(lastCandle.close, currentPrice),
            close: currentPrice,
            volume: Math.floor(Math.random() * 1000000) + 500000,
          }
          newData.push(newCandle)
          console.log(`✅ New candle created: O=${newCandle.open} H=${newCandle.high} L=${newCandle.low} C=${newCandle.close}`)

          // Keep only last 120 candles
          if (newData.length > 120) {
            return newData.slice(-120)
          }
          return newData
        } else {
          // Update the last candle
          const updatedCandle: FinnhubOHLC = {
            ...lastCandle,
            high: Math.max(lastCandle.high, currentPrice),
            low: Math.min(lastCandle.low, currentPrice),
            close: currentPrice,
            volume: lastCandle.volume + Math.floor(Math.random() * 1000),
          }
          newData[newData.length - 1] = updatedCandle
          console.log(`✏️ Updated last candle: O=${updatedCandle.open} H=${updatedCandle.high} L=${updatedCandle.low} C=${updatedCandle.close}`)
          return newData
        }
      })
    }

    const startFallbackPolling = () => {
      console.log(`📡 Starting fallback polling every 10 seconds`)

      const pollQuote = async () => {
        console.log(`🔄 Polling quote for ${ticker}...`)
        try {
          const quoteRes = await fetch(`/api/stocks/quotes?symbols=${ticker}`, { cache: "no-store" })
          if (!quoteRes.ok) {
            console.warn(`❌ Quote fetch failed: ${quoteRes.status} - using fallback quote`)
            updateCandleWithPrice(getFallbackPriceForTicker(ticker))
            return
          }
          const quotes = await quoteRes.json()
          const quote = quotes[ticker]

          if (quote && quote.c > 0) {
            console.log(`✅ Fallback poll got price for ${ticker}: $${quote.c}`)
            updateCandleWithPrice(quote.c)
            lastTradeTime.current = Date.now()
          } else {
            console.warn(`⚠️ No valid quote for ${ticker} - using fallback quote`, quote)
            updateCandleWithPrice(getFallbackPriceForTicker(ticker))
          }
        } catch (err) {
          console.error("Fallback poll error:", err)
          updateCandleWithPrice(getFallbackPriceForTicker(ticker))
        }
      }

      // Poll immediately, then every 10 seconds
      pollQuote()
      fallbackInterval.current = setInterval(pollQuote, 10_000)
    }

    // Initialize
    initialize()

    return () => {
      console.log(`Cleaning up candles for ${ticker}`)
      cancelled = true
      if (wsRef.current) {
        wsDisabled.current = true
        wsRef.current.close()
        wsRef.current = null
      }
      if (fallbackInterval.current) {
        clearInterval(fallbackInterval.current)
        fallbackInterval.current = null
      }
    }
  }, [ticker, timeframe, enabled])

  return { data, loading, error }
}
