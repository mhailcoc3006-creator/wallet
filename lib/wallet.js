// Wallet logic — Kavach Wallet Phase 1
// Menggunakan ethers.js (MIT license) — implementasi BIP-39/32/44 standar,
// setara dengan yang digunakan Wallet Core untuk chain EVM.
// Tidak ada implementasi kriptografi buatan sendiri.

import { ethers } from 'ethers';
import { CHAINS } from './chains';

// Semua EVM chain menggunakan derivation path yang sama (BIP-44 coin type 60).
const EVM_PATH = "m/44'/60'/0'/0/0";

/**
 * Membuat wallet baru dengan BIP-39 mnemonic 12 kata.
 * Mnemonic dihasilkan oleh ethers.js menggunakan entropi CSPRNG.
 */
export function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    mnemonic: wallet.mnemonic.phrase,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Import wallet dari BIP-39 recovery phrase.
 */
export function importFromMnemonic(phrase) {
  const cleaned = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const words = cleaned.split(' ');
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new Error(`Recovery phrase harus 12/15/18/21/24 kata (diberi ${words.length}).`);
  }
  // ethers.Wallet.fromPhrase memvalidasi checksum BIP-39 secara otomatis.
  const wallet = ethers.Wallet.fromPhrase(cleaned);
  return {
    mnemonic: cleaned,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Menurunkan alamat untuk setiap chain EVM dari mnemonic.
 * Semua chain EVM memiliki alamat yang sama karena share coin type 60.
 */
export function deriveEvmAddresses(mnemonic) {
  const hd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_PATH);
  const address = hd.address;
  return CHAINS.map((chain) => ({
    chainId: chain.id,
    address,
  }));
}

/**
 * Mengambil saldo native token dari sebuah chain.
 * Mengembalikan string desimal (mis. "0.0123").
 */
export async function fetchNativeBalance(chain, address) {
  try {
    const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chainId, {
      staticNetwork: true,
    });
    const balanceWei = await provider.getBalance(address);
    return ethers.formatEther(balanceWei);
  } catch (err) {
    console.error(`Balance error on ${chain.id}:`, err.message);
    return '0';
  }
}

/**
 * Fetch semua saldo secara paralel.
 */
export async function fetchAllBalances(address) {
  const results = await Promise.all(
    CHAINS.map(async (chain) => {
      const balance = await fetchNativeBalance(chain, address);
      return { chainId: chain.id, balance };
    })
  );
  return results.reduce((acc, r) => {
    acc[r.chainId] = r.balance;
    return acc;
  }, {});
}
