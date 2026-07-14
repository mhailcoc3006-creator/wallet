// Wallet operations — multi-family (EVM, BTC, SOL, TRX)
// Semua library open-source (MIT/Apache): ethers.js, @solana/web3.js, @scure/*, ed25519-hd-key, bs58.
// Standar mengikuti BIP-39/32/44 dan konvensi tiap chain.

import { ethers } from 'ethers';
import { CHAINS, getChain } from './chains';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { HDKey } from '@scure/bip32';
import { bech32 } from '@scure/base';
import bs58 from 'bs58';

const EVM_PATH = "m/44'/60'/0'/0/0";
const BTC_PATH = "m/84'/0'/0'/0/0"; // Native SegWit BIP-84
const SOL_PATH = "m/44'/501'/0'/0'";
const TRX_PATH = "m/44'/195'/0'/0/0";

// ──── CREATE / IMPORT (BIP-39) ────

export function createWallet() {
  const w = ethers.Wallet.createRandom();
  return { mnemonic: w.mnemonic.phrase, address: w.address };
}

export function importFromMnemonic(phrase) {
  const cleaned = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const words = cleaned.split(' ');
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new Error(`Recovery phrase harus 12/15/18/21/24 kata (diberi ${words.length}).`);
  }
  const w = ethers.Wallet.fromPhrase(cleaned);
  return { mnemonic: cleaned, address: w.address };
}

// ──── DERIVATION per family ────

// Cache seed and derived addresses per mnemonic in memory
const addrCache = new Map();

export function deriveAllAddresses(mnemonic) {
  if (addrCache.has(mnemonic)) return addrCache.get(mnemonic);

  const seed = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed(); // hex string 0x...
  const seedBuf = Buffer.from(seed.slice(2), 'hex');

  // EVM (all EVM chains share same address)
  const evmHd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_PATH);
  const evmAddress = evmHd.address;

  // BTC native SegWit (bc1q...)
  const btcRoot = HDKey.fromMasterSeed(seedBuf);
  const btcChild = btcRoot.derive(BTC_PATH);
  const btcAddress = btcAddressFromPubkey(btcChild.publicKey);

  // Solana
  const solDerived = derivePath(SOL_PATH, seedBuf.toString('hex'));
  const solKeypair = Keypair.fromSeed(solDerived.key);
  const solAddress = solKeypair.publicKey.toBase58();

  // Tron (uses secp256k1 same as ETH but different encoding)
  const trxHd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, TRX_PATH);
  const trxAddress = tronAddressFromEthAddress(trxHd.address);

  const result = {};
  for (const chain of CHAINS) {
    if (chain.family === 'evm') result[chain.id] = evmAddress;
    else if (chain.family === 'btc') result[chain.id] = btcAddress;
    else if (chain.family === 'sol') result[chain.id] = solAddress;
    else if (chain.family === 'trx') result[chain.id] = trxAddress;
  }
  addrCache.set(mnemonic, result);
  return result;
}

// BTC helpers
function btcAddressFromPubkey(pubkey33) {
  // hash160 = ripemd160(sha256(pubkey))
  const sha = ethers.getBytes(ethers.sha256(pubkey33));
  const rip = ethers.getBytes(ethers.ripemd160(sha));
  // Encode as bech32 P2WPKH: hrp=bc, witver=0, program=rip (20 bytes)
  const words = [0].concat(bech32.toWords(rip));
  return bech32.encode('bc', words);
}

// Tron helpers
function tronAddressFromEthAddress(ethAddress) {
  // Tron address = 0x41 + last 20 bytes of eth address, then base58check
  const hex20 = ethAddress.toLowerCase().replace('0x', '');
  const withPrefix = '41' + hex20; // 21 bytes
  const bytes = Buffer.from(withPrefix, 'hex');
  const hash1 = ethers.getBytes(ethers.sha256('0x' + withPrefix));
  const hash2 = ethers.getBytes(ethers.sha256(hash1));
  const checksum = Buffer.from(hash2).subarray(0, 4);
  return bs58.encode(Buffer.concat([bytes, checksum]));
}

function tronAddressToHex(base58Address) {
  const decoded = bs58.decode(base58Address);
  // strip 4-byte checksum
  const payload = decoded.slice(0, decoded.length - 4);
  return Buffer.from(payload).toString('hex');
}

// ──── BALANCE per family ────

async function evmBalance(chain, address) {
  const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
  const wei = await provider.getBalance(address);
  return ethers.formatEther(wei);
}

async function btcBalance(address) {
  const res = await fetch(`https://blockstream.info/api/address/${address}`);
  if (!res.ok) return '0';
  const j = await res.json();
  const sats =
    (j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum) +
    (j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum);
  return (sats / 1e8).toString();
}

async function solBalance(chain, address) {
  const conn = new Connection(chain.rpc, 'confirmed');
  const lamports = await conn.getBalance(new PublicKey(address));
  return (lamports / LAMPORTS_PER_SOL).toString();
}

async function trxBalance(address) {
  const hex = tronAddressToHex(address);
  const res = await fetch('https://api.trongrid.io/wallet/getaccount', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: hex }),
  });
  if (!res.ok) return '0';
  const j = await res.json();
  const sun = j.balance || 0;
  return (sun / 1e6).toString();
}

export async function fetchBalance(chain, address) {
  try {
    if (chain.family === 'evm') return await evmBalance(chain, address);
    if (chain.family === 'btc') return await btcBalance(address);
    if (chain.family === 'sol') return await solBalance(chain, address);
    if (chain.family === 'trx') return await trxBalance(address);
  } catch (e) {
    console.error(`Balance error [${chain.id}]:`, e.message);
  }
  return '0';
}

export async function fetchAllBalances(addressMap) {
  const entries = await Promise.all(
    CHAINS.map(async (chain) => {
      const addr = addressMap[chain.id];
      const bal = addr ? await fetchBalance(chain, addr) : '0';
      return [chain.id, bal];
    })
  );
  return Object.fromEntries(entries);
}

// ──── TRANSACTION COUNT per family ────

async function evmTxCount(chain, address) {
  const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
  return Number(await provider.getTransactionCount(address));
}

async function btcTxCount(address) {
  const res = await fetch(`https://blockstream.info/api/address/${address}`);
  if (!res.ok) return 0;
  const j = await res.json();
  return (j.chain_stats?.tx_count || 0) + (j.mempool_stats?.tx_count || 0);
}

async function solTxCount(chain, address) {
  const conn = new Connection(chain.rpc, 'confirmed');
  const sigs = await conn.getSignaturesForAddress(new PublicKey(address), { limit: 1 });
  return sigs.length > 0 ? 1 : 0; // we only need to know "has history or not"
}

async function trxTxCount(address) {
  // TronGrid tidak punya endpoint sederhana tx count publik tanpa API key.
  // Fallback: anggap punya history kalau saldo > 0 (diproses di layer hasActivity).
  return 0;
}

export async function fetchTxCount(chain, address) {
  try {
    if (chain.family === 'evm') return await evmTxCount(chain, address);
    if (chain.family === 'btc') return await btcTxCount(address);
    if (chain.family === 'sol') return await solTxCount(chain, address);
    if (chain.family === 'trx') return await trxTxCount(address);
  } catch (e) {
    console.error(`TxCount error [${chain.id}]:`, e.message);
  }
  return 0;
}

export async function fetchAllTxCounts(addressMap) {
  const entries = await Promise.all(
    CHAINS.map(async (chain) => {
      const addr = addressMap[chain.id];
      const count = addr ? await fetchTxCount(chain, addr) : 0;
      return [chain.id, count];
    })
  );
  return Object.fromEntries(entries);
}

export async function hasWalletActivity(mnemonic, { signal } = {}) {
  const addresses = deriveAllAddresses(mnemonic);
  if (signal?.aborted) throw new Error('aborted');

  // Check balances and history in parallel to maximize throughput.
  const [balances, txCounts] = await Promise.all([
    fetchAllBalances(addresses),
    fetchAllTxCounts(addresses),
  ]);
  if (signal?.aborted) throw new Error('aborted');

  const anyBalance = Object.values(balances).some((b) => parseFloat(b) > 0);
  const anyHistory = Object.values(txCounts).some((c) => c > 0);
  return { hasActivity: anyBalance || anyHistory, balances, txCounts };
}

// ──── SEND (native) ────

export async function sendNative(chain, mnemonic, toAddress, amountStr) {
  if (chain.family === 'evm') return await sendEvm(chain, mnemonic, toAddress, amountStr);
  if (chain.family === 'sol') return await sendSol(chain, mnemonic, toAddress, amountStr);
  throw new Error(`Pengiriman untuk ${chain.name} belum tersedia di versi ini.`);
}

async function sendEvm(chain, mnemonic, toAddress, amountStr) {
  const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
  const hd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_PATH);
  const wallet = new ethers.Wallet(hd.privateKey, provider);
  const value = ethers.parseEther(amountStr);
  const tx = await wallet.sendTransaction({ to: toAddress, value });
  return { hash: tx.hash, explorer: `${chain.explorer}${chain.txPath}${tx.hash}` };
}

async function sendSol(chain, mnemonic, toAddress, amountStr) {
  const seed = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed();
  const seedBuf = Buffer.from(seed.slice(2), 'hex');
  const derived = derivePath(SOL_PATH, seedBuf.toString('hex'));
  const from = Keypair.fromSeed(derived.key);
  const conn = new Connection(chain.rpc, 'confirmed');
  const lamports = Math.floor(parseFloat(amountStr) * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports,
    })
  );
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = from.publicKey;
  tx.sign(from);
  const signature = await conn.sendRawTransaction(tx.serialize());
  return { hash: signature, explorer: `${chain.explorer}${chain.txPath}${signature}` };
}

// ──── EVM Gas Estimate ────

export async function estimateEvmGas(chain) {
  try {
    const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
    const fee = await provider.getFeeData();
    const gasPrice = fee.maxFeePerGas || fee.gasPrice; // wei
    const gwei = Number(gasPrice) / 1e9;
    // Typical native transfer = 21000 gas
    const costWei = gasPrice * 21000n;
    const costEth = Number(ethers.formatEther(costWei));
    return { gwei, costNative: costEth };
  } catch (e) {
    return null;
  }
}

// ──── EVM Wallet accessor (for signing swap txs) ────

export function getEvmWallet(chain, mnemonic) {
  const provider = new ethers.JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
  const hd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_PATH);
  return new ethers.Wallet(hd.privateKey, provider);
}

export { EVM_PATH };
