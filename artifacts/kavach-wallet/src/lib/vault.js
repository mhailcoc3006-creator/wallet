'use client';

// Vault — penyimpanan terenkripsi untuk semua state sensitif.
// Struktur di localStorage:
// {
//   version: 3,
//   userName: 'plaintext',
//   createdAt: number,
//   salt: base64,
//   verify: { iv, ct } — dekripsi harus menghasilkan sentinel 'kavach-ok'
//   data: { iv, ct }   — encrypted JSON of wallets, watchlist, alerts, padasankara
// }

import { deriveKey, encryptWithKey, decryptWithKey, generateSalt } from './crypto';

const KEY = 'kavach-vault-v3';
const SENTINEL = 'kavach-ok';

export function hasVault() {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(KEY);
}

export function readVaultMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return { userName: j.userName || 'User', createdAt: j.createdAt };
  } catch { return null; }
}

export function clearVault() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

export async function initVault({ userName, password, initialState }) {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const verify = await encryptWithKey(SENTINEL, key);
  const state = initialState || defaultState();
  const data = await encryptWithKey(JSON.stringify(state), key);
  const vault = {
    version: 3,
    userName,
    createdAt: Date.now(),
    salt,
    verify,
    data,
  };
  localStorage.setItem(KEY, JSON.stringify(vault));
  return { key, state, meta: { userName: vault.userName, createdAt: vault.createdAt } };
}

export async function unlockVault(password) {
  const raw = localStorage.getItem(KEY);
  if (!raw) throw new Error('Vault tidak ditemukan.');
  const vault = JSON.parse(raw);
  const key = await deriveKey(password, vault.salt);
  try {
    const check = await decryptWithKey(vault.verify, key);
    if (check !== SENTINEL) throw new Error('bad sentinel');
  } catch {
    throw new Error('Password salah.');
  }
  const dataStr = await decryptWithKey(vault.data, key);
  const state = JSON.parse(dataStr);
  return { key, state, meta: { userName: vault.userName, createdAt: vault.createdAt } };
}

export async function saveVaultData(state, key) {
  const raw = localStorage.getItem(KEY);
  if (!raw) throw new Error('Vault tidak ditemukan.');
  const vault = JSON.parse(raw);
  vault.data = await encryptWithKey(JSON.stringify(state), key);
  localStorage.setItem(KEY, JSON.stringify(vault));
}

export function defaultState() {
  return {
    wallets: [],
    activeWalletId: null,
    watchlist: [
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
      { id: 'solana', symbol: 'SOL', name: 'Solana', image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
    ],
    alerts: [],
    padasankara: {
      inputWords: Array(24).fill(''),
      wordCount: 12,
      targetAddress: '',
      requireActivity: false,
      attempts: 0,
      foundCount: 0,
      status: 'idle', // idle | paused (running only in memory)
    },
  };
}
