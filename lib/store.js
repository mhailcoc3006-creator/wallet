'use client';

// Zustand store dengan persistensi ke localStorage.
// TIDAK PERNAH mengirim state ke server. Mnemonic hanya di device.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useWalletStore = create(
  persist(
    (set, get) => ({
      wallet: null, // { mnemonic, address, createdAt, name }
      backupConfirmed: false,

      // Watchlist: [{ id (coinGeckoId), symbol, name, image }]
      watchlist: [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
        { id: 'solana', symbol: 'SOL', name: 'Solana', image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
      ],

      // Price alerts: [{ id, coinGeckoId, symbol, threshold, direction, triggered, createdAt }]
      alerts: [],

      setWallet: (wallet) =>
        set({
          wallet: {
            ...wallet,
            createdAt: Date.now(),
            name: wallet.name || 'Main Wallet',
          },
        }),

      confirmBackup: () => set({ backupConfirmed: true }),

      resetWallet: () => set({ wallet: null, backupConfirmed: false }),

      addToWatchlist: (coin) => {
        const cur = get().watchlist;
        if (cur.find((c) => c.id === coin.id)) return;
        set({ watchlist: [...cur, coin] });
      },

      removeFromWatchlist: (id) => set({ watchlist: get().watchlist.filter((c) => c.id !== id) }),

      addAlert: (alert) =>
        set({
          alerts: [
            ...get().alerts,
            { ...alert, id: crypto.randomUUID(), triggered: false, createdAt: Date.now() },
          ],
        }),

      removeAlert: (id) => set({ alerts: get().alerts.filter((a) => a.id !== id) }),

      markAlertTriggered: (id) =>
        set({
          alerts: get().alerts.map((a) => (a.id === id ? { ...a, triggered: true } : a)),
        }),
    }),
    {
      name: 'kavach-wallet-v2',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
