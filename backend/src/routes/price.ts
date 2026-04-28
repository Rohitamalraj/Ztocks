import { Router, Request, Response } from 'express';

const router = Router();

// Price cache
interface PriceCache {
  price: number;
  timestamp: number;
}

const priceCache = new Map<string, PriceCache>();
const CACHE_DURATION = 5000; // 5 seconds

// Crypto assets supported by Bybit
const CRYPTO_ASSETS = ['BTC', 'ETH', 'SOL', 'LINK', 'SUI', 'DOGE', 'XRP', 'AVAX'];

// Stock assets supported by Finnhub
const STOCK_ASSETS = ['AAPL', 'TSLA', 'GOOGL', 'NVDA', 'MSFT', 'AMZN', 'META', 'NFLX'];

async function fetchBybitPrice(ticker: string): Promise<number | null> {
  try {
    const symbol = `${ticker}USDT`;
    const response = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`
    );
    
    if (!response.ok) {
      console.warn('[Price] Bybit API error:', response.status);
      return null;
    }

    const data: any = await response.json();
    if (data.result?.list?.[0]?.lastPrice) {
      return parseFloat(data.result.list[0].lastPrice);
    }
    
    return null;
  } catch (error) {
    console.error('[Price] Bybit fetch error:', error);
    return null;
  }
}

async function fetchFinnhubPrice(ticker: string): Promise<number | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn('[Price] Finnhub API key not configured');
      return null;
    }

    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`
    );
    
    if (!response.ok) {
      console.warn('[Price] Finnhub API error:', response.status);
      return null;
    }

    const data: any = await response.json();
    if (data.c) {
      return data.c; // current price
    }
    
    return null;
  } catch (error) {
    console.error('[Price] Finnhub fetch error:', error);
    return null;
  }
}

async function fetchPrice(ticker: string): Promise<number> {
  const upperTicker = ticker.toUpperCase();

  if (!CRYPTO_ASSETS.includes(upperTicker) && !STOCK_ASSETS.includes(upperTicker)) {
    throw new Error(`Unsupported ticker: ${upperTicker}`);
  }
  
  // Check cache first
  const cached = priceCache.get(upperTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  let price: number | null = null;

  // Try Bybit for crypto
  if (CRYPTO_ASSETS.includes(upperTicker)) {
    price = await fetchBybitPrice(upperTicker);
  }
  // Try Finnhub for stocks
  else if (STOCK_ASSETS.includes(upperTicker)) {
    price = await fetchFinnhubPrice(upperTicker);
  }

  if (price === null) {
    throw new Error(`Price unavailable for ${upperTicker}`);
  }

  // Cache the price
  priceCache.set(upperTicker, {
    price,
    timestamp: Date.now(),
  });

  return price;
}

// GET /api/price/:ticker - Get current price
router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;
    
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    const price = await fetchPrice(ticker);
    
    res.json({
      ticker: ticker.toUpperCase(),
      price,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Price] Failed to fetch price:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.startsWith('Unsupported ticker')
      ? 400
      : message.startsWith('Price unavailable')
        ? 502
        : 500;
    res.status(status).json({ error: message });
  }
});

// GET /api/price - Get multiple prices
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tickers } = req.query;
    
    if (!tickers || typeof tickers !== 'string') {
      return res.status(400).json({ error: 'tickers query parameter is required (comma-separated)' });
    }

    const tickerList = tickers.split(',').map(t => t.trim());
    const prices = await Promise.all(
      tickerList.map(async (ticker) => ({
        ticker: ticker.toUpperCase(),
        price: await fetchPrice(ticker),
        timestamp: Date.now()
      }))
    );
    
    res.json({ prices });
  } catch (error) {
    console.error('[Price] Failed to fetch prices:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
});

export { router as priceRouter };
