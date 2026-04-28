const FINNHUB_BASE = "https://finnhub.io/api/v1"

const QUOTE_CACHE_TTL_MS = 15_000
const RATE_LIMIT_BACKOFF_MS = 60_000
const WARN_COOLDOWN_MS = 30_000

type QuoteCacheEntry = {
  value: FinnhubQuote | null
  fetchedAt: number
  rateLimitedUntil: number
  pending?: Promise<FinnhubQuote | null>
}

const quoteCache = new Map<string, QuoteCacheEntry>()
const warnAtByKey = new Map<string, number>()

export type FinnhubQuote = {
  c: number // Current price
  d: number // Change
  dp: number // Percent change
  h: number // High price of the day
  l: number // Low price of the day
  o: number // Open price of the day
  pc: number // Previous close price
  t?: number // Timestamp
}

export type FinnhubCandles = {
  c: number[] // Close
  h: number[] // High
  l: number[] // Low
  o: number[] // Open
  s: string // Status
  t: number[] // Timestamp
  v: number[] // Volume
}

let warnedMissingApiKey = false

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function warnOnce(key: string, message: string, cooldownMs = WARN_COOLDOWN_MS): void {
  const now = Date.now()
  const last = warnAtByKey.get(key) ?? 0
  if (now - last < cooldownMs) return
  warnAtByKey.set(key, now)
  console.warn(message)
}

function getApiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    if (!warnedMissingApiKey) {
      console.warn("FINNHUB_API_KEY is not set; live market data is unavailable")
      warnedMissingApiKey = true
    }
    return null
  }
  return key
}

export async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  const token = getApiKey()
  if (!token) return null
  const normalizedSymbol = normalizeSymbol(symbol)
  const now = Date.now()
  const cached = quoteCache.get(normalizedSymbol)

  if (cached && now - cached.fetchedAt < QUOTE_CACHE_TTL_MS) {
    return cached.value
  }

  if (cached?.pending) {
    return cached.pending
  }

  if (cached && cached.rateLimitedUntil > now) {
    return cached.value
  }

  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(normalizedSymbol)}&token=${token}`

  const pending = (async (): Promise<FinnhubQuote | null> => {
    try {
      const res = await fetch(url, { cache: "no-store" })
      const fetchedAt = Date.now()

      if (res.status === 429) {
        warnOnce(`rate-limit:${normalizedSymbol}`, `Rate limited by Finnhub for ${normalizedSymbol}; serving cached quote when available`, RATE_LIMIT_BACKOFF_MS)
        const next: QuoteCacheEntry = {
          value: cached?.value ?? null,
          fetchedAt: cached?.fetchedAt ?? fetchedAt,
          rateLimitedUntil: fetchedAt + RATE_LIMIT_BACKOFF_MS,
        }
        quoteCache.set(normalizedSymbol, next)
        return next.value
      }

      if (!res.ok) {
        warnOnce(`http:${normalizedSymbol}:${res.status}`, `Failed to fetch quote for ${normalizedSymbol}: ${res.status}`)
        const next: QuoteCacheEntry = {
          value: cached?.value ?? null,
          fetchedAt,
          rateLimitedUntil: 0,
        }
        quoteCache.set(normalizedSymbol, next)
        return next.value
      }

      const data = (await res.json()) as Partial<FinnhubQuote>
      const hasLivePrice = typeof data.c === "number" && data.c > 0

      if (!hasLivePrice) {
        warnOnce(`no-data:${normalizedSymbol}`, `No live quote data for ${normalizedSymbol}; using cached quote when available`)
        const next: QuoteCacheEntry = {
          value: cached?.value ?? null,
          fetchedAt,
          rateLimitedUntil: 0,
        }
        quoteCache.set(normalizedSymbol, next)
        return next.value
      }

      const nextValue: FinnhubQuote = {
        c: data.c as number,
        d: typeof data.d === "number" ? data.d : 0,
        dp: typeof data.dp === "number" ? data.dp : 0,
        h: typeof data.h === "number" ? data.h : data.c as number,
        l: typeof data.l === "number" ? data.l : data.c as number,
        o: typeof data.o === "number" ? data.o : data.c as number,
        pc: typeof data.pc === "number" ? data.pc : data.c as number,
        t: typeof data.t === "number" ? data.t : undefined,
      }

      quoteCache.set(normalizedSymbol, {
        value: nextValue,
        fetchedAt,
        rateLimitedUntil: 0,
      })

      return nextValue
    } catch {
      warnOnce(`network:${normalizedSymbol}`, `Error fetching quote for ${normalizedSymbol}; using cached quote when available`)
      const next: QuoteCacheEntry = {
        value: cached?.value ?? null,
        fetchedAt: Date.now(),
        rateLimitedUntil: 0,
      }
      quoteCache.set(normalizedSymbol, next)
      return next.value
    }
  })()

  quoteCache.set(normalizedSymbol, {
    value: cached?.value ?? null,
    fetchedAt: cached?.fetchedAt ?? 0,
    rateLimitedUntil: cached?.rateLimitedUntil ?? 0,
    pending,
  })

  return pending
}

export async function fetchQuotes(
  symbols: string[]
): Promise<Record<string, FinnhubQuote | null>> {
  const results: Record<string, FinnhubQuote | null> = {}
  const normalizedSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))]

  await Promise.all(normalizedSymbols.map(async (symbol) => {
    results[symbol] = await fetchQuote(symbol)
  }))

  return results
}

const RESOLUTION_SECONDS: Record<string, number> = {
  "1": 60,
  "5": 300,
  "15": 900,
  "30": 1800,
  "60": 3600,
  D: 86400,
  W: 604800,
  M: 2592000,
}

export async function fetchCandles(
  symbol: string,
  resolution: "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M" = "D",
  count = 30
): Promise<FinnhubCandles | null> {
  const token = getApiKey()
  if (!token) return null
  const to = Math.floor(Date.now() / 1000)
  const interval = RESOLUTION_SECONDS[resolution] ?? 86400
  const from = to - count * interval
  const url = `${FINNHUB_BASE}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${token}`
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.c || data.c.length === 0) return null
    return data
  } catch (error) {
    console.error(`Error fetching candles for ${symbol}:`, error)
    return null
  }
}
