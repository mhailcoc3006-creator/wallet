// OKX V5 Trading API client — places real orders on OKX perpetual futures.
// Credentials are passed per-request from the frontend (non-custodial approach).

import crypto from "crypto";

export interface OKXCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  demo?: boolean; // demo trading mode
}

interface OKXResponse {
  code: string;
  msg: string;
  data: any[];
}

const OKX_BASE = "https://www.okx.com";

function sign(timestamp: string, method: string, requestPath: string, body: string, secret: string): string {
  const message = timestamp + method + requestPath + body;
  return crypto.createHmac("sha256", secret).update(message).digest("base64");
}

export async function okxRequest(
  creds: OKXCredentials,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<OKXResponse> {
  const timestamp = new Date().toISOString();
  const bodyStr = method === "POST" && body ? JSON.stringify(body) : "";
  // For GET, the request path includes query string; for POST, it's just the path
  const requestPath = method === "GET" ? path : path;
  const signature = sign(timestamp, method, requestPath, bodyStr, creds.secretKey);

  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": creds.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": creds.passphrase,
    "Content-Type": "application/json",
  };

  if (creds.demo) {
    headers["x-simulated-trading"] = "1";
  }

  const url = `${OKX_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const data = (await res.json()) as OKXResponse;
  return data;
}

// ── Account ──

export async function getBalance(creds: OKXCredentials) {
  const r = await okxRequest(creds, "GET", "/api/v5/account/balance");
  if (r.code !== "0") throw new Error(`Balance: ${r.msg}`);
  const acc = r.data?.[0];
  if (!acc) throw new Error("No account data");
  const usdt = acc.data?.find((d: any) => d.ccy === "USDT");
  return {
    totalEq: parseFloat(acc.totalEq || "0"),
    available: parseFloat(usdt?.availBal || acc.availBal || "0"),
    margin: parseFloat(acc.margin || "0"),
    mgnRatio: parseFloat(acc.mgnRatio || "0"),
    unrealizedPnl: parseFloat(acc.upl || "0"),
  };
}

export async function getPositions(creds: OKXCredentials) {
  const r = await okxRequest(creds, "GET", "/api/v5/account/positions?instType=SWAP");
  if (r.code !== "0") throw new Error(`Positions: ${r.msg}`);
  return (r.data || []).map((p: any) => ({
    posId: p.posId,
    instId: p.instId,
    posSide: p.posSide, // "long" | "short" | "net"
    pos: parseFloat(p.pos), // contracts
    posCcy: p.posCcy,
    avgPx: parseFloat(p.avgPx || "0"),
    markPx: parseFloat(p.markPx || "0"),
    lever: parseFloat(p.lever || "0"),
    margin: parseFloat(p.margin || "0"),
    upl: parseFloat(p.upl || "0"),
    uplRatio: parseFloat(p.uplRatio || "0"),
    liqPx: parseFloat(p.liqPx || "0"),
    notionalUsd: parseFloat(p.notionalUsd || "0"),
  }));
}

export async function setPositionMode(creds: OKXCredentials, mode: "long_short_mode" | "net_mode") {
  const r = await okxRequest(creds, "POST", "/api/v5/account/set-position-mode", {
    posMode: mode,
  });
  if (r.code !== "0") throw new Error(`Position mode: ${r.msg}`);
  return r.data;
}

// ── Instruments ──

const instCache = new Map<string, { ctVal: number; ctValCcy: string; ts: number }>();

export async function getInstrumentInfo(instId: string) {
  const cacheKey = instId;
  const cached = instCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 600_000) return cached;

  const res = await fetch(`${OKX_BASE}/api/v5/public/instruments?instType=SWAP&instId=${instId}`);
  const j = (await res.json()) as OKXResponse;
  if (j.code !== "0" || !j.data?.length) throw new Error(`Instrument ${instId}: ${j.msg}`);
  const inst = j.data[0];
  const info = {
    ctVal: parseFloat(inst.ctVal || "1"),
    ctValCcy: inst.ctValCcy || "",
    ts: Date.now(),
  };
  instCache.set(cacheKey, info);
  return info;
}

// ── Trading ──

export async function setLeverage(creds: OKXCredentials, instId: string, lever: number, mgnMode: "cross" | "isolated", posSide: "long" | "short") {
  const r = await okxRequest(creds, "POST", "/api/v5/account/set-leverage", {
    instId,
    lever: String(lever),
    mgnMode,
    posSide,
  });
  // code 110093 = leverage not modified (ignore)
  if (r.code !== "0" && r.code !== "110093") throw new Error(`Leverage: ${r.msg}`);
  return r.data;
}

export async function placeOrder(
  creds: OKXCredentials,
  params: {
    instId: string;
    tdMode: "cross" | "isolated";
    side: "buy" | "sell";
    posSide: "long" | "short";
    ordType: "market" | "limit";
    sz: string; // contracts
    px?: string; // limit price
    lever?: number;
  },
) {
  const body: Record<string, unknown> = {
    instId: params.instId,
    tdMode: params.tdMode,
    side: params.side,
    posSide: params.posSide,
    ordType: params.ordType,
    sz: params.sz,
  };
  if (params.px) body.px = params.px;
  if (params.lever) body.lever = String(params.lever);

  const r = await okxRequest(creds, "POST", "/api/v5/trade/order", body);
  if (r.code !== "0") throw new Error(`Order: ${r.msg}`);
  return r.data?.[0];
}

export async function closePosition(creds: OKXCredentials, instId: string, posSide: "long" | "short", mgnMode: "cross" | "isolated") {
  const r = await okxRequest(creds, "POST", "/api/v5/trade/close-position", {
    instId,
    mgnMode,
    posSide,
  });
  if (r.code !== "0") throw new Error(`Close: ${r.msg}`);
  return r.data?.[0];
}

// Calculate number of contracts from USDT amount
export function calcContracts(usdtAmount: number, entryPrice: number, ctVal: number): number {
  // For SWAP: contracts = usdtAmount / (entryPrice * ctVal)
  const contracts = usdtAmount / (entryPrice * ctVal);
  return Math.max(1, Math.floor(contracts));
}
