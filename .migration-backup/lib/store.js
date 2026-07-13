'use client';

// Zustand store — in-memory only. Persistensi via vault.js (encrypted).

import { create } from 'zustand';

export const useWalletStore = create((set, get) => ({
  // Auth
  unlocked: false,
  vaultKey: null,
  userName: '',
  createdAt: null,

  // Wallets
  wallets: [],
  activeWalletId: null,

  // Watchlist / alerts
  watchlist: [],
  alerts: [],

  // PadaSankara (persisted parts)
  padasankara: {
    inputWords: Array(24).fill(''),
    wordCount: 12,
    targetAddress: '',
    attempts: 0,
    foundCount: 0,
    status: 'idle',
  },

  // Signal alerts (Grade A/A+)
  signalAlerts: [],           // { id, symbol, interval, signal, grade, confidence, entry, tp1, tp2, stop_loss, timestamp, seen }
  signalAlertsEnabled: true,

  // Hydrate from vault after unlock
  hydrate: ({ state, key, meta }) =>
    set({
      unlocked: true,
      vaultKey: key,
      userName: meta.userName,
      createdAt: meta.createdAt,
      wallets: state.wallets || [],
      activeWalletId: state.activeWalletId || state.wallets?.[0]?.id || null,
      watchlist: state.watchlist || [],
      alerts: state.alerts || [],
      padasankara: state.padasankara || {
        inputWords: Array(24).fill(''),
        wordCount: 12,
        targetAddress: '',
        attempts: 0,
        foundCount: 0,
        status: 'idle',
      },
    }),

  lock: () => set({ unlocked: false, vaultKey: null }),

  // Multi-wallet actions
  activeWallet: () => {
    const s = get();
    return s.wallets.find((w) => w.id === s.activeWalletId) || s.wallets[0] || null;
  },

  addWallet: (w) => {
    const list = get().wallets;
    // dedupe by address (case-insensitive)
    if (list.find((x) => x.address.toLowerCase() === w.address.toLowerCase())) return null;
    const wallet = {
      id: crypto.randomUUID(),
      name: w.name || `Wallet ${list.length + 1}`,
      mnemonic: w.mnemonic,
      address: w.address,
      createdAt: Date.now(),
      source: w.source || 'imported',
      portfolioUsd: 0,
      portfolioUpdatedAt: 0,
    };
    set({
      wallets: [...list, wallet],
      activeWalletId: get().activeWalletId || wallet.id,
    });
    return wallet;
  },

  addWalletBatch: (arr) => {
    // arr: [{ mnemonic, address, name, source }]
    const list = get().wallets;
    const seen = new Set(list.map((w) => w.address.toLowerCase()));
    const added = [];
    for (const w of arr) {
      const a = w.address.toLowerCase();
      if (seen.has(a)) continue;
      seen.add(a);
      added.push({
        id: crypto.randomUUID(),
        name: w.name || `Wallet ${list.length + added.length + 1}`,
        mnemonic: w.mnemonic,
        address: w.address,
        createdAt: Date.now(),
        source: w.source || 'imported',
        portfolioUsd: 0,
        portfolioUpdatedAt: 0,
      });
    }
    if (added.length === 0) return 0;
    set({
      wallets: [...list, ...added],
      activeWalletId: get().activeWalletId || added[0].id,
    });
    return added.length;
  },

  removeWallet: (id) => {
    const list = get().wallets.filter((w) => w.id !== id);
    const active = get().activeWalletId === id ? list[0]?.id || null : get().activeWalletId;
    set({ wallets: list, activeWalletId: active });
  },

  removeAllWallets: () => set({ wallets: [], activeWalletId: null }),

  setActiveWallet: (id) => set({ activeWalletId: id }),

  renameWallet: (id, name) =>
    set({ wallets: get().wallets.map((w) => (w.id === id ? { ...w, name } : w)) }),

  updateWalletPortfolio: (id, portfolioUsd) =>
    set({
      wallets: get().wallets.map((w) =>
        w.id === id ? { ...w, portfolioUsd, portfolioUpdatedAt: Date.now() } : w
      ),
    }),

  // Watchlist
  addToWatchlist: (coin) => {
    const cur = get().watchlist;
    if (cur.find((c) => c.id === coin.id)) return;
    set({ watchlist: [...cur, coin] });
  },
  removeFromWatchlist: (id) => set({ watchlist: get().watchlist.filter((c) => c.id !== id) }),

  // Alerts
  addAlert: (a) =>
    set({
      alerts: [
        ...get().alerts,
        { ...a, id: crypto.randomUUID(), triggered: false, createdAt: Date.now() },
      ],
    }),
  removeAlert: (id) => set({ alerts: get().alerts.filter((a) => a.id !== id) }),
  markAlertTriggered: (id) =>
    set({ alerts: get().alerts.map((a) => (a.id === id ? { ...a, triggered: true } : a)) }),

  // PadaSankara persistent state
  setPadaSankara: (patch) => set({ padasankara: { ...get().padasankara, ...patch } }),
  resetPadaSankara: () =>
    set({
      padasankara: {
        inputWords: Array(24).fill(''),
        wordCount: 12,
        targetAddress: '',
        attempts: 0,
        foundCount: 0,
        status: 'idle',
      },
    }),

  // Signal alerts
  addSignalAlert: (alert) => {
    const cur = get().signalAlerts;
    const key = `${alert.symbol}:${alert.interval}:${alert.grade}:${alert.signal}`;
    const now = Date.now();
    // Dedup: skip if same key exists in last 6 hours
    const exists = cur.find(
      (a) => `${a.symbol}:${a.interval}:${a.grade}:${a.signal}` === key && now - a.timestamp < 6 * 60 * 60 * 1000
    );
    if (exists) return null;
    const item = { ...alert, id: crypto.randomUUID(), timestamp: now, seen: false };
    set({ signalAlerts: [item, ...cur].slice(0, 100) });
    return item;
  },
  markAllSignalAlertsSeen: () =>
    set({ signalAlerts: get().signalAlerts.map((a) => ({ ...a, seen: true })) }),
  clearSignalAlerts: () => set({ signalAlerts: [] }),
  toggleSignalAlertsEnabled: () => set({ signalAlertsEnabled: !get().signalAlertsEnabled }),
}));

// Selector helper
export const selectActiveWallet = (s) =>
  s.wallets.find((w) => w.id === s.activeWalletId) || s.wallets[0] || null;
