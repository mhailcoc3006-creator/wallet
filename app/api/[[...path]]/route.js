import { NextResponse } from 'next/server';
import { generateSignal } from '@/lib/signal-engine';

// Kavach Wallet Backend — Phase 2
// Semua endpoint bersifat READ-ONLY dan hanya mem-proxy public data.
// TIDAK PERNAH menerima private key atau mnemonic.

const COINGECKO = 'https://api.coingecko.com/api/v3';
const LIFI = 'https://li.quest/v1';
const BINANCE_FAPI = 'https://fapi.binance.com';
const OKX_API = 'https://www.okx.com';

// Map user-facing interval to OKX bar format
const OKX_BAR = { '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1D' };
const OKX_PERIOD = { '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1D' };

// Cache utilities
const cache = new Map();
function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) return null;
  return entry.data;
}
function setCached(key, data, ttlMs) {
  cache.set(key, { data, ts: Date.now(), ttl: ttlMs });
}

async function fetchPrices(ids) {
  const key = `prices:${ids.sort().join(',')}`;
  const cached = getCached(key);
  if (cached) return cached;

  const url = `${COINGECKO}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  setCached(key, data, 45 * 1000);
  return data;
}

async function searchCoins(q) {
  const key = `search:${q}`;
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${COINGECKO}/search?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Search ${res.status}`);
  const data = await res.json();
  const coins = (data.coins || []).slice(0, 20).map((c) => ({
    id: c.id,
    symbol: (c.symbol || '').toUpperCase(),
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
    { id: 'ethereum', rpc: 'https://eth.llamarpc.com' },
    { id: 'bsc', rpc: 'https://bsc-dataseed.binance.org' },
    { id: 'polygon', rpc: 'https://polygon-rpc.com' },
    { id: 'arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
    { id: 'optimism', rpc: 'https://mainnet.optimism.io' },
    { id: 'base', rpc: 'https://mainnet.base.org' },
    { id: 'avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
  ];

  const key = 'gas:evm';
  const cached = getCached(key);
  if (cached) return cached;

  const results = await Promise.all(
    chains.map(async (c) => {
      try {
        const res = await fetch(c.rpc, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
        });
        const j = await res.json();
        const wei = BigInt(j.result || '0x0');
        const gwei = Number(wei) / 1e9;
        const costWei = wei * 21000n;
        const costNative = Number(costWei) / 1e18;
        return { id: c.id, gwei, costNative };
      } catch (e) {
        return { id: c.id, gwei: null, costNative: null };
      }
    })
  );
  setCached(key, results, 15 * 1000);
  return results;
}

async function proxyLifiQuote(searchParams) {
  const url = `${LIFI}/quote?${searchParams.toString()}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

const DEFAULT_SYMBOLS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', name: 'Ethereum' },
  { symbol: 'SOLUSDT', name: 'Solana' },
  { symbol: 'BNBUSDT', name: 'BNB' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin' },
  { symbol: 'AVAXUSDT', name: 'Avalanche' },
  { symbol: 'MATICUSDT', name: 'Polygon' },
  { symbol: 'ARBUSDT', name: 'Arbitrum' },
  { symbol: 'OPUSDT', name: 'Optimism' },
  { symbol: 'LINKUSDT', name: 'Chainlink' },
  { symbol: 'TRXUSDT', name: 'Tron' },
];

async function fetchSignal(symbol, interval) {
  const cacheKey = `signal:${symbol}:${interval}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Convert user symbol (e.g. BTCUSDT) to OKX instId (BTC-USDT-SWAP) and ccy (BTC)
  const base = symbol.replace(/USDT$/i, '');
  const instId = `${base}-USDT-SWAP`;
  const ccy = base;
  const bar = OKX_BAR[interval] || '1H';
  const period = OKX_PERIOD[interval] || '1H';

  const [klinesRes, fundingRes, oiHistRes, lsrRes, takerRes] = await Promise.all([
    fetch(`${OKX_API}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=300`),
    fetch(`${OKX_API}/api/v5/public/funding-rate?instId=${instId}`),
    fetch(`${OKX_API}/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=${period}`),
    fetch(`${OKX_API}/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=${period}`),
    fetch(`${OKX_API}/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SWAP&period=${period}`),
  ]);

  if (!klinesRes.ok) throw new Error(`OKX klines HTTP ${klinesRes.status}`);
  const klinesJson = await klinesRes.json();
  if (klinesJson.code !== '0') throw new Error(`OKX klines ${klinesJson.msg || 'error'}`);
  // OKX returns newest first \u2014 reverse to oldest first
  const rawList = (klinesJson.data || []).slice().reverse();
  // Drop the last unconfirmed candle (partial data biases volume/RSI)
  while (rawList.length > 0 && rawList[rawList.length - 1][8] === '0') rawList.pop();
  const candles = rawList.map((k) => ({
    openTime: parseInt(k[0]),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),           // contracts
    quoteVolume: parseFloat(k[7]),      // in USDT
    takerBuyVolume: 0,
  }));

  // Enrich candle takerBuyVolume from separate taker-volume endpoint if available.
  try {
    const j = await takerRes.json();
    if (j.code === '0' && Array.isArray(j.data)) {
      // items: [ts, sellVol, buyVol] newest first
      const map = new Map();
      for (const row of j.data) map.set(parseInt(row[0]), parseFloat(row[2] || 0));
      for (const c of candles) {
        const b = map.get(c.openTime);
        if (b != null && c.volume > 0) c.takerBuyVolume = b;
      }
    }
  } catch {}

  let fundingRate = 0;
  try {
    const j = await fundingRes.json();
    const fr = j.data?.[0]?.fundingRate;
    if (fr != null) fundingRate = parseFloat(fr);
  } catch {}

  let openInterest = 0;
  let openInterestChangePct = 0;
  try {
    const j = await oiHistRes.json();
    // items: [ts, oi, vol] newest first
    const arr = (j.data || []).slice().reverse().slice(-6);
    if (arr.length >= 1) openInterest = parseFloat(arr[arr.length - 1][1]);
    if (arr.length >= 2) {
      const now = parseFloat(arr[arr.length - 1][1]);
      const past = parseFloat(arr[0][1]);
      if (past > 0) openInterestChangePct = ((now - past) / past) * 100;
    }
  } catch {}

  let longShortRatio = 1;
  try {
    const j = await lsrRes.json();
    // items: [ts, longShortRatio] newest first
    const row = j.data?.[0];
    if (row && row[1]) longShortRatio = parseFloat(row[1]);
  } catch {}

  const result = generateSignal({
    candles,
    symbol,
    interval,
    fundingRate,
    openInterest,
    openInterestChangePct,
    longShortRatio,
  });
  result.source = 'okx-swap-futures';

  setCached(cacheKey, result, 15 * 1000);
  return result;
}

export async function GET(request, { params }) {
  const resolved = await params;
  const segs = resolved?.path || [];
  const path = segs.join('/');
  const url = new URL(request.url);

  try {
    if (path === '' || path === 'health') {
      return NextResponse.json({ ok: true, service: 'kavach-wallet', phase: 2 });
    }

    if (path === 'prices') {
      const idsParam = url.searchParams.get('ids');
      const defaults = [
        'ethereum',
        'binancecoin',
        'matic-network',
        'avalanche-2',
        'bitcoin',
        'solana',
        'tron',
      ];
      const ids = idsParam ? idsParam.split(',').filter(Boolean) : defaults;
      const data = await fetchPrices(ids);
      return NextResponse.json({ prices: data });
    }

    if (path === 'coins/search') {
      const q = url.searchParams.get('q') || '';
      if (q.length < 2) return NextResponse.json({ coins: [] });
      const coins = await searchCoins(q);
      return NextResponse.json({ coins });
    }

    if (path === 'gas') {
      const data = await fetchGasEvm();
      return NextResponse.json({ chains: data });
    }

    if (path === 'swap/quote') {
      const { ok, status, data } = await proxyLifiQuote(url.searchParams);
      if (!ok) return NextResponse.json({ error: data.message || 'Quote failed', details: data }, { status });
      return NextResponse.json(data);
    }

    if (path === 'signal') {
      const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
      const interval = url.searchParams.get('interval') || '1h';
      const data = await fetchSignal(symbol, interval);
      return NextResponse.json(data);
    }

    if (path === 'signal/symbols') {
      return NextResponse.json({ symbols: DEFAULT_SYMBOLS });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const resolved = await params;
  const path = (resolved?.path || []).join('/');
  return NextResponse.json({ error: `POST /${path} not implemented` }, { status: 404 });
}
