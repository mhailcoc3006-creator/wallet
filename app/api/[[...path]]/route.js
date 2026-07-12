import { NextResponse } from 'next/server';

// Kavach Wallet Backend — Phase 2
// Semua endpoint bersifat READ-ONLY dan hanya mem-proxy public data.
// TIDAK PERNAH menerima private key atau mnemonic.

const COINGECKO = 'https://api.coingecko.com/api/v3';
const LIFI = 'https://li.quest/v1';

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
