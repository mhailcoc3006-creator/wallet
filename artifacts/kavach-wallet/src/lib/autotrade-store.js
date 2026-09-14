'use client';

// Auto-Trade Store — paper trading bot that uses real signal data.
// Monitors the scanner for high-grade signals and simulates trades.

import { create } from 'zustand';

const MAYHEM_CONFIG = {
  minGrade: 'B+',
  maxPositions: 10,
  riskPerTradePct: 5,      // % of simulated equity per trade
  takeProfitPcts: [1.5, 3, 4.5],  // ATR multiples match signal TP
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
  takeProfitPcts: [1.5, 3, 4.5],
  stopLossMultiplier: 1.5,
  trailingStop: true,
  trailingATR: 1.2,
  autoCompound: false,
  scanIntervalSec: 30,
  mode: 'normal',
};

const GRADE_ORDER = { 'A+': 4, 'A': 3, 'B+': 2, 'B': 1, 'C': 0 };

export const useAutoTradeStore = create((set, get) => ({
  running: false,
  config: { ...NORMAL_CONFIG },
  equity: 10000,        // simulated starting equity in USD
  startingEquity: 10000,
  positions: [],       // { id, symbol, side, entry, currentPrice, size, stopLoss, takeProfits, tpHit, trailingStop, atr, pnl, pnlPct, signal, grade, confidence, interval, timestamp }
  history: [],          // { id, symbol, side, entry, exit, size, pnl, pnlPct, reason, grade, timestamp, duration }
  lastScanAt: null,
  lastScanCount: 0,

  start: () => set({ running: true }),
  stop: () => set({ running: false }),
  setMode: (mode) => set({
    config: mode === 'mayhem' ? { ...MAYHEM_CONFIG } : { ...NORMAL_CONFIG },
  }),
  updateConfig: (patch) => set({ config: { ...get().config, ...patch } }),
  reset: () => set({
    positions: [],
    history: [],
    equity: 10000,
    startingEquity: 10000,
    lastScanAt: null,
    lastScanCount: 0,
  }),

  // Called when scanner results arrive — checks for new entries
  processSignals: (results, interval) => {
    const state = get();
    if (!state.running) return;

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

    const newPositions = candidates.map((r) => {
      const tradeValue = (state.equity * cfg.riskPerTradePct) / 100;
      const size = tradeValue / r.entry;
      const atr = r.entry * 0.01; // estimate ATR if not provided
      const stopLoss = r.side === 'long'
        ? r.entry - atr * cfg.stopLossMultiplier
        : r.entry + atr * cfg.stopLossMultiplier;
      const takeProfits = cfg.takeProfitPcts.map((mult) =>
        r.side === 'long' ? r.entry + atr * mult : r.entry - atr * mult
      );
      return {
        id: crypto.randomUUID(),
        symbol: r.symbol,
        side: r.side,
        entry: r.entry,
        currentPrice: r.entry,
        size,
        stopLoss,
        takeProfits,
        tpHit: 0,
        trailingStop: cfg.trailingStop ? stopLoss : null,
        trailingATR: cfg.trailingATR,
        atr,
        pnl: 0,
        pnlPct: 0,
        signal: r.signal,
        grade: r.grade,
        confidence: r.confidence,
        interval,
        timestamp: Date.now(),
      };
    });

    set({
      positions: [...state.positions, ...newPositions],
      lastScanAt: Date.now(),
      lastScanCount: results.length,
    });
  },

  // Update position prices and check exits — called on each price update
  updatePrices: (priceMap) => {
    const state = get();
    if (state.positions.length === 0) return;

    const cfg = state.config;
    let equityDelta = 0;
    const remaining = [];
    const closed = [];

    for (const pos of state.positions) {
      const px = priceMap[pos.symbol];
      if (px == null) { remaining.push(pos); continue; }

      pos.currentPrice = px;
      const pnlMult = pos.side === 'long' ? (px - pos.entry) / pos.entry : (pos.entry - px) / pos.entry;
      pos.pnl = pos.size * pos.entry * pnlMult;
      pos.pnlPct = pnlMult * 100;

      // Update trailing stop
      if (cfg.trailingStop && pos.trailingStop != null) {
        const trailDist = pos.atr * cfg.trailingATR;
        if (pos.side === 'long') {
          pos.trailingStop = Math.max(pos.trailingStop, px - trailDist);
        } else {
          pos.trailingStop = Math.min(pos.trailingStop, px + trailDist);
        }
      }

      let shouldClose = false;
      let reason = '';

      // Check stop loss (or trailing stop)
      const effectiveSL = cfg.trailingStop && pos.trailingStop != null ? pos.trailingStop : pos.stopLoss;
      if (pos.side === 'long' && px <= effectiveSL) {
        shouldClose = true;
        reason = effectiveSL === pos.trailingStop ? 'Trailing Stop' : 'Stop Loss';
      } else if (pos.side === 'short' && px >= effectiveSL) {
        shouldClose = true;
        reason = effectiveSL === pos.trailingStop ? 'Trailing Stop' : 'Stop Loss';
      }

      // Check take profits (sequential)
      if (!shouldClose && pos.takeProfits && pos.takeProfits.length > 0) {
        for (let i = pos.tpHit; i < pos.takeProfits.length; i++) {
          const tp = pos.takeProfits[i];
          if ((pos.side === 'long' && px >= tp) || (pos.side === 'short' && px <= tp)) {
            pos.tpHit = i + 1;
            if (i === pos.takeProfits.length - 1) {
              shouldClose = true;
              reason = `TP${i + 1} Hit`;
            }
            // Partial close: realize 1/3 of position at each TP
            const partialSize = pos.size / pos.takeProfits.length;
            const partialPnl = partialSize * pos.entry * pnlMult;
            equityDelta += partialPnl;
            pos.size -= partialSize;
          }
        }
      }

      if (shouldClose) {
        equityDelta += pos.size * pos.entry * pnlMult;
        closed.push({
          ...pos,
          exit: px,
          pnl: pos.size * pos.entry * pnlMult + (pos.takeProfits ? (pos.size * pos.entry * pnlMult) : 0),
          pnlPct: pnlMult * 100,
          reason,
          duration: Date.now() - pos.timestamp,
        });
      } else {
        remaining.push(pos);
      }
    }

    if (closed.length > 0 || equityDelta !== 0) {
      set({
        positions: remaining,
        history: [...closed, ...state.history].slice(0, 200),
        equity: state.equity + equityDelta,
      });
    }
  },

  // Manually close a position
  closePosition: (id, reason = 'Manual') => {
    const state = get();
    const pos = state.positions.find((p) => p.id === id);
    if (!pos) return;
    const pnlMult = pos.side === 'long'
      ? (pos.currentPrice - pos.entry) / pos.entry
      : (pos.entry - pos.currentPrice) / pos.entry;
    const pnl = pos.size * pos.entry * pnlMult;
    set({
      positions: state.positions.filter((p) => p.id !== id),
      history: [{ ...pos, exit: pos.currentPrice, pnl, pnlPct: pnlMult * 100, reason, duration: Date.now() - pos.timestamp }, ...state.history].slice(0, 200),
      equity: state.equity + pnl,
    });
  },

  // Get stats
  getStats: () => {
    const state = get();
    const trades = state.history;
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
      totalEquity: state.equity + openPnl,
      roi: (totalPnl / state.startingEquity) * 100,
      bestTrade: trades.reduce((best, t) => t.pnl > (best?.pnl || -Infinity) ? t : best, null),
      worstTrade: trades.reduce((worst, t) => t.pnl < (worst?.pnl || Infinity) ? t : worst, null),
    };
  },
}));
