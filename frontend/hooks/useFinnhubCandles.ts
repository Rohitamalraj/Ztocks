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

const RESOLUTION_MAP: Record<string, "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M"> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "60",
  D: "D",
  W: "W",
  M: "M",
}

const COUNT_MAP: Record<string, number> = {
  "1m": 120,
  "5m": 120,
  "15m": 120,
  "1h": 120,
  "4h": 120,
  D: 120,
  W: 120,
  M: 60,
}

function getIntervalSeconds(timeframe: string): number {
  const intervalMap: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 3600,
    D: 86400,
    W: 604800,
    M: 2592000,
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
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled || !ticker) {
      setData([])
      return
    }

    let cancelled = false

    const initialize = async () => {
      setLoading(true)
      setError(null)

      try {
        const resolution = RESOLUTION_MAP[timeframe] ?? "D"
        const count = COUNT_MAP[timeframe] ?? 120
        const params = new URLSearchParams({
          symbol: ticker,
          resolution,
          count: String(count),
        })

        const res = await fetch(`/api/stocks/candles?${params.toString()}`, {
          cache: "no-store",
        })

        if (!res.ok) {
          throw new Error(`Failed to fetch candles for ${ticker} (${res.status})`)
        }

        const json = await res.json()
        if (!json || json.s !== "ok" || !Array.isArray(json.t) || json.t.length === 0) {
          throw new Error(`No live candle data for ${ticker}`)
        }

        const candles: FinnhubOHLC[] = json.t.map((t: number, i: number) => ({
          time: t,
          open: json.o[i],
          high: json.h[i],
          low: json.l[i],
          close: json.c[i],
          volume: json.v[i] ?? 0,
        }))

        if (!cancelled) {
          setData(candles)
          setLoading(false)
        }

        connectWebSocket()
        startQuotePolling()
      } catch (e) {
        if (!cancelled) {
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
        return
      }

      const wsUrl = `wss://ws.finnhub.io?token=${apiKey}`
      const ws = new WebSocket(wsUrl)
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
                updateCandleWithPrice(Number(trade.p), Number(trade.v ?? 0))
              }
            }
          } else if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }))
          }
        } catch {
          // ignore malformed WS payloads
        }
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

    const updateCandleWithPrice = (currentPrice: number, volumeDelta: number) => {
      const now = Math.floor(Date.now() / 1000)
      const intervalSeconds = getIntervalSeconds(timeframe)

      setData((prevData) => {
        if (prevData.length === 0) return prevData

        const next = [...prevData]
        const lastCandle = next[next.length - 1]
        const timeSinceLast = now - lastCandle.time

        if (timeSinceLast >= intervalSeconds) {
          const newCandle: FinnhubOHLC = {
            time: lastCandle.time + intervalSeconds,
            open: lastCandle.close,
            high: Math.max(lastCandle.close, currentPrice),
            low: Math.min(lastCandle.close, currentPrice),
            close: currentPrice,
            volume: volumeDelta,
          }
          next.push(newCandle)
          return next.slice(-120)
        }

        next[next.length - 1] = {
          ...lastCandle,
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: currentPrice,
          volume: lastCandle.volume + volumeDelta,
        }

        return next
      })
    }

    const startQuotePolling = () => {
      const pollQuote = async () => {
        try {
          const quoteRes = await fetch(`/api/stocks/quotes?symbols=${ticker}`, { cache: "no-store" })
          if (!quoteRes.ok) return
          const quotes = await quoteRes.json()
          const quote = quotes[ticker]
          if (quote && quote.c > 0) {
            updateCandleWithPrice(Number(quote.c), 0)
          }
        } catch {
          // ignore transient quote errors
        }
      }

      pollQuote()
      pollingInterval.current = setInterval(pollQuote, 15_000)
    }

    initialize()

    return () => {
      cancelled = true
      if (wsRef.current) {
        wsDisabled.current = true
        wsRef.current.close()
        wsRef.current = null
      }
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
        pollingInterval.current = null
      }
    }
  }, [ticker, timeframe, enabled])

  return { data, loading, error }
}
