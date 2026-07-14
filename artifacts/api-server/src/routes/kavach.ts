import { Router, type IRouter } from "express";
import { generateSignal, type Candle } from "../lib/signal-engine";

// Kavach Wallet Backend — ported from the original Next.js catch-all API route.
// All endpoints are READ-ONLY and only proxy public market data.
// They NEVER receive a private key or mnemonic.

const router: IRouter = Router();

const COINGECKO = "https://api.coingecko.com/api/v3";
const LIFI = "https://li.quest/v1";
const OKX_API = "https://www.okx.com";

// Map user-facing interval to OKX bar format
const OKX_BAR: Record<string, string> = { "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1D" };
const OKX_PERIOD: Record<string, string> = { "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1D" };

// Cache utilities
const cache = new Map<string, { data: unknown; ts: number; ttl: number }>();
function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) return null;
  return entry.data as T;
}
function setCached(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, ts: Date.now(), ttl: ttlMs });
}

async function fetchPrices(ids: string[]) {
  const key = `prices:${[...ids].sort().join(",")}`;
  const cached = getCached(key);
  if (cached) return cached;

  const url = `${COINGECKO}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  setCached(key, data, 45 * 1000);
  return data;
}

async function searchCoins(q: string) {
  const key = `search:${q}`;
  const cached = getCached<unknown[]>(key);
  if (cached) return cached;

  const res = await fetch(`${COINGECKO}/search?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Search ${res.status}`);
  const data = (await res.json()) as any;
  const coins = (data.coins || []).slice(0, 20).map((c: any) => ({
    id: c.id,
    symbol: (c.symbol || "").toUpperCase(),
    name: c.name,
    image: c.thumb,
    marketCapRank: c.market_cap_rank,
  }));
  setCached(key, coins, 5 * 60 * 1000);
  return coins;
}

async function fetchGasEvm() {
  // Call chains server-side to bypass browser CORS/RPC quirks.
  const chains = [
    { id: "ethereum", rpc: "https://eth.llamarpc.com" },
    { id: "bsc", rpc: "https://bsc-dataseed.binance.org" },
    { id: "polygon", rpc: "https://polygon-rpc.com" },
    { id: "arbitrum", rpc: "https://arb1.arbitrum.io/rpc" },
    { id: "optimism", rpc: "https://mainnet.optimism.io" },
    { id: "base", rpc: "https://mainnet.base.org" },
    { id: "avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc" },
  ];

  const key = "gas:evm";
  const cached = getCached<unknown[]>(key);
  if (cached) return cached;

  const results = await Promise.all(
    chains.map(async (c) => {
      try {
        const res = await fetch(c.rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
        });
        const j = (await res.json()) as any;
        const wei = BigInt(j.result || "0x0");
        const gwei = Number(wei) / 1e9;
        const costWei = wei * 21000n;
        const costNative = Number(costWei) / 1e18;
        return { id: c.id, gwei, costNative };
      } catch {
        return { id: c.id, gwei: null, costNative: null };
      }
    })
  );
  setCached(key, results, 15 * 1000);
  return results;
}

async function fetchPairs() {
  const cacheKey = "signal:pairs";
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${OKX_API}/api/v5/market/tickers?instType=SWAP`);
  if (!res.ok) throw new Error(`OKX tickers HTTP ${res.status}`);
  const j = (await res.json()) as any;
  if (j.code !== "0") throw new Error(`OKX tickers ${j.msg || "error"}`);

  const pairs = (j.data || [])
    .filter((row: any) => row.instId && row.instId.endsWith("-USDT-SWAP"))
    .map((row: any) => {
      const base = row.instId.replace("-USDT-SWAP", "");
      const last = parseFloat(row.last) || 0;
      const open24 = parseFloat(row.open24h) || 0;
      const changePct = open24 > 0 ? ((last - open24) / open24) * 100 : 0;
      const volCoin = parseFloat(row.volCcy24h) || 0;
      return {
        symbol: `${base}USDT`,
        base,
        instId: row.instId,
        price: last,
        change24h: changePct,
        vol24h_usd: volCoin * last,
        high24h: parseFloat(row.high24h) || 0,
        low24h: parseFloat(row.low24h) || 0,
      };
    })
    .sort((a: any, b: any) => b.vol24h_usd - a.vol24h_usd);

  setCached(cacheKey, pairs, 60 * 1000);
  return pairs;
}

async function scanPairs(interval: string, limit: number) {
  const cacheKey = `signal:scan:${interval}:${limit}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const pairs = (await fetchPairs()) as any[];
  const topN = pairs.slice(0, limit);

  // Batch in chunks of 5 concurrent to avoid OKX rate limit.
  const BATCH = 5;
  const results: any[] = [];
  for (let i = 0; i < topN.length; i += BATCH) {
    const chunk = topN.slice(i, i + BATCH);
    const chunkResults = await Promise.all(
      chunk.map(async (p) => {
        try {
          const sig = await fetchSignal(p.symbol, interval);
          return {
            symbol: p.symbol,
            price: p.price,
            change24h: p.change24h,
            vol24h_usd: p.vol24h_usd,
            signal: sig.signal,
            side: sig.side,
            grade: sig.grade,
            confidence: sig.confidence,
            probability: sig.probability,
            risk: sig.risk,
            leverage: sig.leverage,
            entry: sig.entry,
            tp1: sig.tp1,
            tp2: sig.tp2,
            tp3: sig.tp3,
            stop_loss: sig.stop_loss,
            risk_reward: sig.risk_reward,
            scores: sig.scores,
          };
        } catch (e: any) {
          return { symbol: p.symbol, error: e.message };
        }
      })
    );
    results.push(...chunkResults);
  }

  // Sort by confidence desc (put A+/A grade tradeable signals first).
  results.sort((a, b) => {
    const aSide = a.side && a.side !== "none" ? 1 : 0;
    const bSide = b.side && b.side !== "none" ? 1 : 0;
    if (aSide !== bSide) return bSide - aSide;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  const out = { interval, count: results.length, results, generated_at: Date.now() };
  setCached(cacheKey, out, 30 * 1000);
  return out;
}

async function proxyLifiQuote(searchParams: URLSearchParams) {
  const url = `${LIFI}/quote?${searchParams.toString()}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const data = (await res.json()) as any;
  return { ok: res.ok, status: res.status, data };
}

const DEFAULT_SYMBOLS = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "BNBUSDT", name: "BNB" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
  { symbol: "AVAXUSDT", name: "Avalanche" },
  { symbol: "MATICUSDT", name: "Polygon" },
  { symbol: "ARBUSDT", name: "Arbitrum" },
  { symbol: "OPUSDT", name: "Optimism" },
  { symbol: "LINKUSDT", name: "Chainlink" },
  { symbol: "TRXUSDT", name: "Tron" },
];

async function fetchSignal(symbol: string, interval: string) {
  const cacheKey = `signal:${symbol}:${interval}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  // Convert user symbol (e.g. BTCUSDT) to OKX instId (BTC-USDT-SWAP) and ccy (BTC)
  const base = symbol.replace(/USDT$/i, "");
  const instId = `${base}-USDT-SWAP`;
  const ccy = base;
  const bar = OKX_BAR[interval] || "1H";
  const period = OKX_PERIOD[interval] || "1H";

  const [klinesRes, fundingRes, oiHistRes, lsrRes, takerRes] = await Promise.all([
    fetch(`${OKX_API}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=300`),
    fetch(`${OKX_API}/api/v5/public/funding-rate?instId=${instId}`),
    fetch(`${OKX_API}/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=${period}`),
    fetch(`${OKX_API}/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=${period}`),
    fetch(`${OKX_API}/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SWAP&period=${period}`),
  ]);

  if (!klinesRes.ok) throw new Error(`OKX klines HTTP ${klinesRes.status}`);
  const klinesJson = (await klinesRes.json()) as any;
  if (klinesJson.code !== "0") throw new Error(`OKX klines ${klinesJson.msg || "error"}`);
  // OKX returns newest first — reverse to oldest first
  const rawList = (klinesJson.data || []).slice().reverse();
  // Drop the last unconfirmed candle (partial data biases volume/RSI)
  while (rawList.length > 0 && rawList[rawList.length - 1][8] === "0") rawList.pop();
  const candles: Candle[] = rawList.map((k: string[]) => ({
    openTime: parseInt(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]), // contracts
    quoteVolume: parseFloat(k[7]), // in USDT
    takerBuyVolume: 0,
  }));

  // Enrich candle takerBuyVolume from separate taker-volume endpoint if available.
  try {
    const j = (await takerRes.json()) as any;
    if (j.code === "0" && Array.isArray(j.data)) {
      // items: [ts, sellVol, buyVol] newest first
      const map = new Map<number, number>();
      for (const row of j.data) map.set(parseInt(row[0]), parseFloat(row[2] || 0));
      for (const c of candles) {
        const b = map.get(c.openTime);
        if (b != null && c.volume > 0) c.takerBuyVolume = b;
      }
    }
  } catch {
    // ignore, taker volume is a best-effort enrichment
  }

  let fundingRate = 0;
  try {
    const j = (await fundingRes.json()) as any;
    const fr = j.data?.[0]?.fundingRate;
    if (fr != null) fundingRate = parseFloat(fr);
  } catch {
    // ignore
  }

  let openInterest = 0;
  let openInterestChangePct = 0;
  try {
    const j = (await oiHistRes.json()) as any;
    // items: [ts, oi, vol] newest first
    const arr = (j.data || []).slice().reverse().slice(-6);
    if (arr.length >= 1) openInterest = parseFloat(arr[arr.length - 1][1]);
    if (arr.length >= 2) {
      const now = parseFloat(arr[arr.length - 1][1]);
      const past = parseFloat(arr[0][1]);
      if (past > 0) openInterestChangePct = ((now - past) / past) * 100;
    }
  } catch {
    // ignore
  }

  let longShortRatio = 1;
  try {
    const j = (await lsrRes.json()) as any;
    // items: [ts, longShortRatio] newest first
    const row = j.data?.[0];
    if (row && row[1]) longShortRatio = parseFloat(row[1]);
  } catch {
    // ignore
  }

  const result: any = generateSignal({
    candles,
    symbol,
    interval,
    fundingRate,
    openInterest,
    openInterestChangePct,
    longShortRatio,
  });
  result.source = "okx-swap-futures";

  setCached(cacheKey, result, 15 * 1000);
  return result;
}

router.get("/kavach/health", (_req, res) => {
  res.json({ ok: true, service: "kavach-wallet", phase: 2 });
});

router.get("/prices", async (req, res) => {
  try {
    const idsParam = req.query.ids as string | undefined;
    const defaults = ["ethereum", "binancecoin", "matic-network", "avalanche-2", "bitcoin", "solana", "tron"];
    const ids = idsParam ? idsParam.split(",").filter(Boolean) : defaults;
    const data = await fetchPrices(ids);
    res.json({ prices: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/coins/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    if (q.length < 2) {
      res.json({ coins: [] });
      return;
    }
    const coins = await searchCoins(q);
    res.json({ coins });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/gas", async (_req, res) => {
  try {
    const data = await fetchGasEvm();
    res.json({ chains: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/swap/quote", async (req, res) => {
  try {
    const searchParams = new URLSearchParams(req.query as Record<string, string>);
    const { ok, status, data } = await proxyLifiQuote(searchParams);
    if (!ok) {
      res.status(status).json({ error: data.message || "Quote failed", details: data });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/signal", async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || "BTCUSDT").toUpperCase();
    const interval = (req.query.interval as string) || "1h";
    const data = await fetchSignal(symbol, interval);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/signal/pairs", async (_req, res) => {
  try {
    const data = (await fetchPairs()) as any[];
    res.json({ pairs: data, count: data.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/signal/scan", async (req, res) => {
  try {
    const interval = (req.query.interval as string) || "1h";
    const limit = Math.min(30, parseInt((req.query.limit as string) || "15"));
    const data = await scanPairs(interval, limit);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/signal/symbols", (_req, res) => {
  res.json({ symbols: DEFAULT_SYMBOLS });
});

export default router;
