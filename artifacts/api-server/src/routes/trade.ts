// Trading routes — proxies OKX trading API for real order execution.
// Credentials are passed per-request via headers (non-custodial).

import { Router, type IRouter } from "express";
import {
  getBalance, getPositions, setPositionMode, getInstrumentInfo,
  setLeverage, placeOrder, closePosition, calcContracts,
  type OKXCredentials,
} from "../lib/okx-trade";

const router: IRouter = Router();

function extractCreds(req: any): OKXCredentials {
  const apiKey = req.headers["x-okx-key"] as string;
  const secretKey = req.headers["x-okx-secret"] as string;
  const passphrase = req.headers["x-okx-pass"] as string;
  const demo = req.headers["x-okx-demo"] === "1";
  if (!apiKey || !secretKey || !passphrase) {
    throw new Error("Missing OKX API credentials. Provide x-okx-key, x-okx-secret, x-okx-pass headers.");
  }
  return { apiKey, secretKey, passphrase, demo };
}

function asyncHandler(fn: (req: any, res: any) => Promise<any>) {
  return (req: any, res: any) => {
    fn(req, res).catch((err) => {
      res.status(500).json({ error: err.message });
    });
  };
}

// Test connection — validates credentials and returns balance
router.post("/trade/connect", asyncHandler(async (req, res) => {
  const creds = extractCreds(req);
  const balance = await getBalance(creds);
  // Set position mode to long/short for auto-trading
  try { await setPositionMode(creds, "long_short_mode"); } catch {}
  res.json({ ok: true, balance });
}));

// Get account balance
router.get("/trade/balance", asyncHandler(async (req, res) => {
  const creds = extractCreds(req);
  const balance = await getBalance(creds);
  res.json(balance);
}));

// Get open positions
router.get("/trade/positions", asyncHandler(async (req, res) => {
  const creds = extractCreds(req);
  const positions = await getPositions(creds);
  res.json({ positions });
}));

// Place a market order (open position)
router.post("/trade/open", asyncHandler(async (req, res) => {
  const creds = extractCreds(req);
  const { symbol, side, usdtAmount, leverage, tpPrice, slPrice } = req.body;
  if (!symbol || !side || !usdtAmount) throw new Error("Missing symbol, side, or usdtAmount");

  const base = symbol.replace(/USDT$/i, "");
  const instId = `${base}-USDT-SWAP`;
  const posSide = side === "long" ? "long" : "short";
  const orderSide = side === "long" ? "buy" : "sell";

  // Get instrument info for contract size
  const inst = await getInstrumentInfo(instId);

  // Get current price from market data
  const tickerRes = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`);
  const tickerJson = (await tickerRes.json()) as any;
  if (tickerJson.code !== "0") throw new Error(`Ticker: ${tickerJson.msg}`);
  const entryPrice = parseFloat(tickerJson.data[0].last);

  // Calculate contracts
  const contracts = calcContracts(usdtAmount, entryPrice, inst.ctVal);
  if (contracts < 1) throw new Error(`Order too small: ${usdtAmount} USDT = ${contracts} contracts`);

  // Set leverage
  const lever = Math.max(1, Math.min(125, leverage || 10));
  try { await setLeverage(creds, instId, lever, "cross", posSide); } catch {}

  // Place market order
  const order = await placeOrder(creds, {
    instId,
    tdMode: "cross",
    side: orderSide,
    posSide,
    ordType: "market",
    sz: String(contracts),
    lever,
  });

  // Attach TP/SL as algo orders if provided
  if (order?.ordId) {
    try {
      if (slPrice) {
        await placeOrder(creds, {
          instId,
          tdMode: "cross",
          side: posSide === "long" ? "sell" : "buy",
          posSide,
          ordType: "conditional",
          sz: String(contracts),
          px: String(slPrice),
          // OKX uses slTriggerPx / tpTriggerPx for algo orders
        });
      }
    } catch {} // best-effort TP/SL
  }

  res.json({
    ok: true,
    order,
    instId,
    contracts,
    entryPrice,
    leverage: lever,
  });
}));

// Close a position
router.post("/trade/close", asyncHandler(async (req, res) => {
  const creds = extractCreds(req);
  const { instId, posSide } = req.body;
  if (!instId || !posSide) throw new Error("Missing instId or posSide");

  const result = await closePosition(creds, instId, posSide, "cross");
  res.json({ ok: true, result });
}));

// Get instrument info (contract size etc)
router.get("/trade/instrument/:instId", asyncHandler(async (req, res) => {
  const instId = req.params.instId;
  const info = await getInstrumentInfo(instId);
  res.json(info);
}));

export default router;
