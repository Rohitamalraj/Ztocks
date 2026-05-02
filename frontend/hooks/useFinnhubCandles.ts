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

// ─── Fallback prices (used if quote API is down) ─────────────────────────────
const FALLBACK_PRICES: Record<string, number> = {
  AAPL: 192.1,
  TSLA: 251.2,
  NVDA: 875.4,
  SPY:  542.3,
  AMZN: 186.5,
  MSFT: 425.3,
  META: 512.8,
  NFLX: 640.2,
  AMD:  168.4,
}

function getFallbackPriceForTicker(ticker: string): number {
  return FALLBACK_PRICES[ticker.toUpperCase()] ?? 100
}

// ─── Synthetic candle generator (used for intraday + daily fallback) ─────────
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
    "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400,
    D: 86400, W: 604800, M: 2592000,
  }
  const intervalSeconds = intervalMap[timeframe] || 300

  const priceRange = dailyHigh - dailyLow
  const volatility = priceRange / currentPrice

  let prevClose = currentPrice
  for (let i = 0; i < count; i++) {
    const candleTime = now - i * intervalSeconds
    const randomWalk = (Math.random() - 0.5) * volatility * currentPrice * 0.3
    const trend = ((count - i) / count - 0.5) * (currentPrice - dailyOpen)

    const open  = prevClose
    const close = currentPrice + randomWalk + trend * 0.1

    const candleVolatility = Math.abs(close - open) * (1 + Math.random() * 0.5)
    const high = Math.max(open, close) + candleVolatility * 0.3
    const low  = Math.min(open, close) - candleVolatility * 0.3

    candles.unshift({
      time:   candleTime,
      open:   +open.toFixed(2),
      high:   +Math.min(high, dailyHigh).toFixed(2),
      low:    +Math.max(low,  dailyLow).toFixed(2),
      close:  +close.toFixed(2),
      volume: Math.floor(Math.random() * 1_000_000) + 500_000,
    })

    prevClose = close
  }

  return candles
}

// ─── Interval helper ──────────────────────────────────────────────────────────
function getIntervalSeconds(timeframe: string): number {
  const intervalMap: Record<string, number> = {
    "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400,
    D: 86400, W: 604800, M: 2592000,
  }
  return intervalMap[timeframe] || 300
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useFinnhubCandles(
  ticker: string,
  timeframe: string,
  enabled: boolean
): { data: FinnhubOHLC[]; loading: boolean; error: string | null } {
  const [data, setData]       = useState<FinnhubOHLC[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const wsRef                = useRef<WebSocket | null>(null)
  const wsDisabled           = useRef(false)
  const wsReconnectAttempts  = useRef(0)
  const lastTradePrice       = useRef<number | null>(null)
  const lastTradeTime        = useRef<number>(Date.now())
  const fallbackInterval     = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled || !ticker) { setData([]); return }

    let cancelled = false

    // ── Initialize ────────────────────────────────────────────────────────────
    const initialize = async () => {
      setLoading(true)
      setError(null)

      try {
        // 1. Fetch live quote
        let quote: { c?: number; o?: number; h?: number; l?: number; pc?: number } | null = null
        try {
          const quoteRes = await fetch(`/api/stocks/quotes?symbols=${ticker}`, { cache: "no-store" })
          if (quoteRes.ok) {
            const quotes = await quoteRes.json()
            quote = quotes[ticker] ?? null
          }
        } catch {
          console.warn(`[chart] Quote fetch failed for ${ticker}; using fallback price`)
        }

        const fallbackPrice  = getFallbackPriceForTicker(ticker)
        const currentPrice   = quote?.c && quote.c > 0 ? quote.c : fallbackPrice
        const dailyOpen      = quote?.o  && quote.o  > 0 ? quote.o  : quote?.pc && quote.pc > 0 ? quote.pc : currentPrice * 0.995
        const dailyHigh      = quote?.h  && quote.h  > 0 ? quote.h  : currentPrice * 1.01
        const dailyLow       = quote?.l  && quote.l  > 0 ? quote.l  : currentPrice * 0.99

        lastTradePrice.current = currentPrice

        // 2. For intraday: always use synthetic candles (Finnhub free tier blocks sub-daily)
        const isIntraday = ["1m", "5m", "15m", "1h", "4h"].includes(timeframe)

        if (isIntraday) {
          const count = timeframe === "1m" ? 120 : timeframe === "5m" ? 120 : 100
          const candles = generateInitialCandles(currentPrice, dailyOpen, dailyHigh, dailyLow, timeframe, count)
          if (!cancelled) {
            setData(candles)
            setLoading(false)
            connectWebSocket()
            startFallbackPolling()
          }
        } else {
          // 3. For D/W/M: try Finnhub, fall back to synthetic if unavailable
          const resolution = timeframe === "D" ? "D" : timeframe === "W" ? "W" : "M"
          const count = 100
          const params = new URLSearchParams({ symbol: ticker, resolution, count: String(count) })

          let candles: FinnhubOHLC[] | null = null
          try {
            const res = await fetch(`/api/stocks/candles?${params.toString()}`, { cache: "no-store" })
            if (res.ok) {
              const json = await res.json()
              if (json && json.s === "ok" && Array.isArray(json.t) && json.t.length > 0) {
                candles = json.t.map((t: number, i: number) => ({
                  time:   t,
                  open:   json.o[i],
                  high:   json.h[i],
                  low:    json.l[i],
                  close:  json.c[i],
                  volume: json.v[i] ?? 0,
                }))
              }
            }
          } catch {
            console.warn(`[chart] Candle fetch failed for ${ticker}; using synthetic candles`)
          }

          const finalCandles = candles && candles.length > 0
            ? candles
            : generateInitialCandles(currentPrice, dailyOpen, dailyHigh, dailyLow, timeframe, count)

          if (!cancelled) {
            setData(finalCandles)
            setLoading(false)
            connectWebSocket()
            startFallbackPolling()
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load chart data")
          setData([])
          setLoading(false)
        }
      }
    }

    // ── WebSocket (live trades) ────────────────────────────────────────────────
    const connectWebSocket = () => {
      if (cancelled || wsDisabled.current) return
      const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY
      if (!apiKey) { wsDisabled.current = true; return }

      const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`)
      wsRef.current = ws

      ws.onopen = () => {
        wsReconnectAttempts.current = 0
        ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === "trade" && Array.isArray(message.data)) {
            for (const trade of message.data) {
              if (trade.s === ticker && trade.p) {
                lastTradePrice.current = trade.p
                lastTradeTime.current  = Date.now()
                updateCandleWithPrice(trade.p)
              }
            }
          } else if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }))
          }
        } catch { /* ignore malformed */ }
      }

      ws.onerror = () => {
        wsDisabled.current = true
        ws.close()
      }

      ws.onclose = () => {
        wsRef.current = null
        const canRetry = !cancelled && !wsDisabled.current && wsReconnectAttempts.current < 3
        if (canRetry) {
          wsReconnectAttempts.current += 1
          setTimeout(connectWebSocket, 3000)
        }
      }
    }

    // ── Candle updater ────────────────────────────────────────────────────────
    const updateCandleWithPrice = (currentPrice: number) => {
      const now = Math.floor(Date.now() / 1000)
      const intervalSeconds = getIntervalSeconds(timeframe)

      setData((prev) => {
        if (prev.length === 0) return prev
        const next = [...prev]
        const last = next[next.length - 1]

        if (now - last.time >= intervalSeconds) {
          // New candle
          next.push({
            time:   last.time + intervalSeconds,
            open:   last.close,
            high:   Math.max(last.close, currentPrice),
            low:    Math.min(last.close, currentPrice),
            close:  currentPrice,
            volume: Math.floor(Math.random() * 1_000_000) + 500_000,
          })
          return next.length > 120 ? next.slice(-120) : next
        } else {
          // Update last candle
          next[next.length - 1] = {
            ...last,
            high:   Math.max(last.high, currentPrice),
            low:    Math.min(last.low,  currentPrice),
            close:  currentPrice,
            volume: last.volume + Math.floor(Math.random() * 1000),
          }
          return next
        }
      })
    }

    // ── Fallback polling (every 10s — keeps chart live when WS has no trades) ─
    const startFallbackPolling = () => {
      const pollQuote = async () => {
        try {
          const quoteRes = await fetch(`/api/stocks/quotes?symbols=${ticker}`, { cache: "no-store" })
          if (!quoteRes.ok) {
            updateCandleWithPrice(getFallbackPriceForTicker(ticker))
            return
          }
          const quotes = await quoteRes.json()
          const quote  = quotes[ticker]
          if (quote && quote.c > 0) {
            updateCandleWithPrice(quote.c)
            lastTradeTime.current = Date.now()
          } else {
            updateCandleWithPrice(getFallbackPriceForTicker(ticker))
          }
        } catch {
          updateCandleWithPrice(getFallbackPriceForTicker(ticker))
        }
      }

      pollQuote() // immediate first poll
      fallbackInterval.current = setInterval(pollQuote, 10_000)
    }

    initialize()

    return () => {
      cancelled = true
      wsDisabled.current = true
      wsRef.current?.close()
      wsRef.current = null
      if (fallbackInterval.current) {
        clearInterval(fallbackInterval.current)
        fallbackInterval.current = null
      }
    }
  }, [ticker, timeframe, enabled])

  return { data, loading, error }
}
