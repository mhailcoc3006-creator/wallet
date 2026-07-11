import { NextResponse } from 'next/server';

// Kavach Wallet backend — Phase 1
// Hanya menyediakan proxy harga publik. TIDAK PERNAH menerima private key / mnemonic.

const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price';
const COIN_IDS = ['ethereum', 'binancecoin', 'matic-network'];

// Simple in-memory cache untuk menghindari rate-limit CoinGecko.
let priceCache = { data: null, ts: 0 };
const CACHE_TTL = 60 * 1000; // 60 detik

async function getPrices() {
  const now = Date.now();
  if (priceCache.data && now - priceCache.ts < CACHE_TTL) {
    return priceCache.data;
  }
  const url = `${COINGECKO}?ids=${COIN_IDS.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  priceCache = { data, ts: now };
  return data;
}

export async function GET(request, { params }) {
  const resolved = await params;
  const path = (resolved?.path || []).join('/');

  try {
    if (path === 'health' || path === '') {
      return NextResponse.json({ ok: true, service: 'kavach-wallet', phase: 1 });
    }

    if (path === 'prices') {
      const data = await getPrices();
      return NextResponse.json({ prices: data });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const resolved = await params;
  const path = (resolved?.path || []).join('/');
  return NextResponse.json({ error: `POST /${path} not implemented in phase 1` }, { status: 404 });
}
