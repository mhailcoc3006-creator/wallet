'use client';

// Zustand store untuk state global wallet — Kavach Phase 1
// State di-persist ke localStorage. TIDAK PERNAH ke server.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useWalletStore = create(
  persist(
    (set, get) => ({
      // null = belum ada wallet, artinya harus onboarding
      wallet: null, // { mnemonic, address, createdAt, name }
      backupConfirmed: false,

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
    }),
    {
      name: 'kavach-wallet-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
