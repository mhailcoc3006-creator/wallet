'use client';

// Auto-Trade Store — REAL trading via OKX API.
// Places real orders on OKX perpetual futures using user-provided API credentials.
// Credentials are stored in localStorage and sent to the backend per-request.

import { create } from 'zustand';

const STORAGE_KEY = 'kavach_okx_creds';

const MAYHEM_CONFIG = {
  minGrade: 'B+',
  maxPositions: 10,
  riskPerTradePct: 5,
  leverage: 20,
  takeProfitPcts: [1.5, 3, 4.5],
  stopLossMultiplier: 1.5,
  trailingStop: true,
  trailingATR: 1.2,
  autoCompound: true,
  scanIntervalSec: 15,
  mode: 'mayhem',
};

const NORMAL_CONFIG = {
  minGrade: 'A',
  maxPositions: 3,
  riskPerTradePct: 2,
  leverage: 10,
  takeProfitPcts: [1.5, 3, 4.5],
  stopLossMultiplier: 1.5,
  trailingStop: true,
  trailingATR: 1.2,
  autoCompound: false,
  scanIntervalSec: 30,
  mode: 'normal',
};

const GRADE_ORDER = { 'A+': 4, 'A': 3, 'B+': 2, 'B': 1, 'C': 0 };

function loadCreds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveCreds(creds) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(creds)); } catch {}
}

function clearCreds() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// Build headers for trading API requests
function tradeHeaders(creds) {
  return {
    'x-okx-key': creds.apiKey,
    'x-okx-secret': creds.secretKey,
    'x-okx-pass': creds.passphrase,
    'x-okx-demo': creds.demo ? '1' : '0',
    'Content-Type': 'application/json',
  };
}

export const useAutoTradeStore = create((set, get) => ({
  // Credentials
  creds: loadCreds(),
  connected: false,
  connecting: false,
  connectError: '',

  // Bot state
  running: false,
  config: { ...NORMAL_CONFIG },
  equity: 0,
  startingEquity: 0,
  availableBalance: 0,
  positions: [],     // real positions from OKX
  history: [],        // trade history (from closed positions)
  lastScanAt: null,
  lastScanCount: 0,
  scanError: '',

  // ── Credential management ──

  setCredentials: (creds) => {
    saveCreds(creds);
    set({ creds });
  },

  clearCredentials: () => {
    clearCreds();
    set({ creds: null, connected: false, running: false, positions: [], equity: 0 });
  },

  connect: async () => {
    const { creds } = get();
    if (!creds) { set({ connectError: 'No credentials set' }); return false; }
    set({ connecting: true, connectError: '' });
    try {
      const res = await fetch('/api/trade/connect', {
        method: 'POST',
        headers: tradeHeaders(creds),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Connection failed');
      set({
        connected: true,
        connecting: false,
        equity: j.balance.totalEq,
        startingEquity: j.balance.totalEq,
        availableBalance: j.balance.available,
      });
      return true;
    } catch (e) {
      set({ connecting: false, connectError: e.message, connected: false });
      return false;
    }
  },

  // ── Bot controls ──

  start: () => set({ running: true }),
  stop: () => set({ running: false }),

  setMode: (mode) => set({
    config: mode === 'mayhem' ? { ...MAYHEM_CONFIG } : { ...NORMAL_CONFIG },
  }),

  updateConfig: (patch) => set({ config: { ...get().config, ...patch } }),

  reset: () => set({
    positions: [],
    history: [],
    lastScanAt: null,
    lastScanCount: 0,
    scanError: '',
  }),

  // ── Fetch real balance & positions from OKX ──

  refreshAccount: async () => {
    const { creds } = get();
    if (!creds) return;
    try {
      const [balRes, posRes] = await Promise.all([
        fetch('/api/trade/balance', { headers: tradeHeaders(creds) }),
        fetch('/api/trade/positions', { headers: tradeHeaders(creds) }),
      ]);
      const bal = await balRes.json();
      const pos = await posRes.json();
      if (bal.error) throw new Error(bal.error);
      if (pos.error) throw new Error(pos.error);

      const positions = (pos.positions || []).map((p) => ({
        id: p.posId,
        instId: p.instId,
        symbol: p.instId.replace('-USDT-SWAP', '') + 'USDT',
        side: p.posSide,
        entry: p.avgPx,
        currentPrice: p.markPx,
        size: p.pos,
        leverage: p.lever,
        margin: p.margin,
        pnl: p.upl,
        pnlPct: p.uplRatio * 100,
        liqPrice: p.liqPx,
        notionalUsd: p.notionalUsd,
      }));

      set({
        equity: bal.totalEq,
        availableBalance: bal.available,
        positions,
      });
    } catch (e) {
      set({ scanError: e.message });
    }
  },

  // ── Process signals → place real orders ──

  processSignals: async (results, interval) => {
    const state = get();
    if (!state.running || !state.creds) return;

    const cfg = state.config;
    const openSymbols = new Set(state.positions.map((p) => p.symbol));
    const availableSlots = cfg.maxPositions - state.positions.length;
    if (availableSlots <= 0) return;

    // Filter for tradeable signals meeting grade threshold
    const candidates = results
      .filter((r) => r.side && r.side !== 'none')
      .filter((r) => (GRADE_ORDER[r.grade] || 0) >= (GRADE_ORDER[cfg.minGrade] || 0))
      .filter((r) => !openSymbols.has(r.symbol))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, availableSlots);

    if (candidates.length === 0) return;

    set({ lastScanAt: Date.now(), lastScanCount: results.length });

    // Place real orders for each candidate
    for (const r of candidates) {
      try {
        const tradeUsdt = (state.availableBalance || state.equity) * (cfg.riskPerTradePct / 100);
        if (tradeUsdt < 5) continue; // skip if too small

        const res = await fetch('/api/trade/open', {
          method: 'POST',
          headers: tradeHeaders(state.creds),
          body: JSON.stringify({
            symbol: r.symbol,
            side: r.side, // 'long' or 'short'
            usdtAmount: tradeUsdt,
            leverage: r.leverage || cfg.leverage,
            slPrice: r.stop_loss,
            tpPrice: r.tp1,
          }),
        });
        const j = await res.json();
        if (!res.ok || j.error) {
          console.error(`Order failed for ${r.symbol}:`, j.error);
          continue;
        }
        // Add to history
        set((s) => ({
          history: [{
            id: crypto.randomUUID(),
            symbol: r.symbol,
            side: r.side,
            entry: j.entryPrice,
            size: j.contracts,
            grade: r.grade,
            reason: 'Opened',
            pnl: 0,
            pnlPct: 0,
            timestamp: Date.now(),
            orderId: j.order?.ordId,
          }, ...s.history].slice(0, 200),
        }));
      } catch (e) {
        console.error(`Order error for ${r.symbol}:`, e.message);
      }
    }

    // Refresh positions after opening
    await get().refreshAccount();
  },

  // ── Close a real position ──

  closePosition: async (instId, posSide) => {
    const state = get();
    if (!state.creds) return;
    try {
      const res = await fetch('/api/trade/close', {
        method: 'POST',
        headers: tradeHeaders(state.creds),
        body: JSON.stringify({ instId, posSide }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error);

      // Record in history
      const pos = state.positions.find((p) => p.instId === instId && p.side === posSide);
      if (pos) {
        set((s) => ({
          history: [{
            ...pos,
            reason: 'Manual Close',
            pnl: pos.pnl,
            pnlPct: pos.pnlPct,
            timestamp: Date.now(),
          }, ...s.history].slice(0, 200),
        }));
      }
      await get().refreshAccount();
    } catch (e) {
      console.error('Close position error:', e.message);
    }
  },

  // ── Check exits (stop loss / take profit) on real positions ──

  checkExits: async (results) => {
    const state = get();
    if (!state.running || !state.creds || state.positions.length === 0) return;

    const priceMap = {};
    for (const r of results) priceMap[r.symbol] = r.entry;

    for (const pos of state.positions) {
      const px = priceMap[pos.symbol];
      if (!px) continue;

      const cfg = state.config;
      let shouldClose = false;
      const atr = pos.entry * 0.01;

      // Check stop loss
      const slPrice = pos.side === 'long'
        ? pos.entry - atr * cfg.stopLossMultiplier
        : pos.entry + atr * cfg.stopLossMultiplier;

      if (pos.side === 'long' && px <= slPrice) shouldClose = true;
      if (pos.side === 'short' && px >= slPrice) shouldClose = true;

      // Check take profit (final TP at 3x ATR)
      const tpPrice = pos.side === 'long'
        ? pos.entry + atr * cfg.takeProfitPcts[cfg.takeProfitPcts.length - 1]
        : pos.entry - atr * cfg.takeProfitPcts[cfg.takeProfitPcts.length - 1];

      if (pos.side === 'long' && px >= tpPrice) shouldClose = true;
      if (pos.side === 'short' && px <= tpPrice) shouldClose = true;

      if (shouldClose) {
        await get().closePosition(pos.instId, pos.side);
      }
    }
  },

  // ── Get stats ──
  getStats: () => {
    const state = get();
    const trades = state.history.filter((t) => t.reason !== 'Opened');
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl <= 0);
    const totalPnl = state.equity - state.startingEquity;
    const openPnl = state.positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    return {
      totalTrades: trades.length,
      openCount: state.positions.length,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      totalPnl,
      openPnl,
      totalEquity: state.equity,
      availableBalance: state.availableBalance,
      roi: state.startingEquity > 0 ? (totalPnl / state.startingEquity) * 100 : 0,
      bestTrade: trades.reduce((best, t) => t.pnl > (best?.pnl || -Infinity) ? t : best, null),
      worstTrade: trades.reduce((worst, t) => t.pnl < (worst?.pnl || Infinity) ? t : worst, null),
    };
  },
}));
