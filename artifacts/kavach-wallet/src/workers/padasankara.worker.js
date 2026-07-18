// PadaSankara Background Worker — runs the brute-force loop off the main thread.
// Uses module imports (Vite worker module). Derives addresses locally and checks
// activity through the backend proxy (addresses only — never mnemonics).

import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { ethers } from 'ethers';
import { HDKey } from '@scure/bip32';
import { bech32 } from '@scure/base';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const EVM_PATH = "m/44'/60'/0'/0/0";
const BTC_PATH = "m/84'/0'/0'/0/0";
const SOL_PATH = "m/44'/501'/0'/0'";
const TRX_PATH = "m/44'/195'/0'/0/0";

const CHAIN_IDS = ['ethereum','bsc','polygon','arbitrum','optimism','base','avalanche','bitcoin','solana','tron'];

function btcAddressFromPubkey(pubkey33) {
  const sha = ethers.getBytes(ethers.sha256(pubkey33));
  const rip = ethers.getBytes(ethers.ripemd160(sha));
  const words = [0].concat(bech32.toWords(rip));
  return bech32.encode('bc', words);
}

function tronAddressFromEthAddress(ethAddress) {
  const hex20 = ethAddress.toLowerCase().replace('0x', '');
  const withPrefix = '41' + hex20;
  const bytes = Buffer.from(withPrefix, 'hex');
  const hash1 = ethers.getBytes(ethers.sha256('0x' + withPrefix));
  const hash2 = ethers.getBytes(ethers.sha256(hash1));
  const checksum = Buffer.from(hash2).subarray(0, 4);
  return bs58.encode(Buffer.concat([bytes, checksum]));
}

function deriveAllAddresses(mnemonic) {
  const seed = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed();
  const seedBuf = Buffer.from(seed.slice(2), 'hex');
  const evmHd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_PATH);
  const evmAddress = evmHd.address;
  const btcRoot = HDKey.fromMasterSeed(seedBuf);
  const btcChild = btcRoot.derive(BTC_PATH);
  const btcAddress = btcAddressFromPubkey(btcChild.publicKey);
  const solDerived = derivePath(SOL_PATH, seedBuf.toString('hex'));
  const solKeypair = Keypair.fromSeed(solDerived.key);
  const solAddress = solKeypair.publicKey.toBase58();
  const trxHd = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, TRX_PATH);
  const trxAddress = tronAddressFromEthAddress(trxHd.address);
  return {
    ethereum: evmAddress, bsc: evmAddress, polygon: evmAddress, arbitrum: evmAddress,
    optimism: evmAddress, base: evmAddress, avalanche: evmAddress,
    bitcoin: btcAddress, solana: solAddress, tron: trxAddress,
  };
}

function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function checkActivity(addresses, apiUrl, signal) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ addresses }),
    signal,
  });
  if (!res.ok) throw new Error(`activity ${res.status}`);
  return await res.json();
}

let state = {
  running: false,
  abort: null,
  config: null,
  attempts: 0,
  found: 0,
};

self.onmessage = ({ data }) => {
  if (data.type === 'start') return startRun(data.payload);
  if (data.type === 'pause') return stopRun();
  if (data.type === 'reset') return resetState();
};

function resetState() {
  state.attempts = 0;
  state.found = 0;
  postMessage({ type: 'reset' });
}

function stopRun() {
  state.running = false;
  if (state.abort) {
    try { state.abort.abort(); } catch {}
  }
  postMessage({ type: 'paused', attempts: state.attempts, found: state.found });
}

async function startRun(payload) {
  if (state.running) return;
  const { inputWords, wordCount, targetAddress, requireActivity, apiUrl, resumeAttempts = 0, resumeFound = 0 } = payload;
  state.running = true;
  state.config = payload;
  state.attempts = resumeAttempts;
  state.found = resumeFound;
  const abort = new AbortController();
  state.abort = abort;

  const inputArr = inputWords.slice(0, wordCount).map((w) => (w || '').trim().toLowerCase());
  const targetLc = (targetAddress || '').trim().toLowerCase();
  const seen = new Set();
  const BATCH = 400;
  const FLUSH_MS = 300;
  const CHECK_CONCURRENCY = 32;
  let lastFlushAt = 0;
  const foundBuffer = [];
  const pending = new Set();
  let lastProgressAt = 0;

  const sendProgress = () => {
    const now = Date.now();
    if (now - lastProgressAt < 200) return;
    lastProgressAt = now;
    postMessage({ type: 'progress', attempts: state.attempts, found: state.found });
  };

  const flushFound = () => {
    if (foundBuffer.length) {
      const batch = foundBuffer.splice(0, foundBuffer.length);
      postMessage({ type: 'found', wallets: batch });
    }
    postMessage({ type: 'progress', attempts: state.attempts, found: state.found });
  };

  const runWorker = async (candidate) => {
    const promise = (async () => {
      try {
        const { hasActivity } = await checkActivity(candidate.addresses, apiUrl, abort.signal);
        if (hasActivity && state.running) {
          foundBuffer.push(candidate);
          state.found++;
        }
      } catch (e) {
        if (e?.name === 'AbortError') return;
        // network error: skip
      }
    })();
    pending.add(promise);
    try { await promise; } finally { pending.delete(promise); }
  };

  try {
    while (state.running) {
      for (let i = 0; i < BATCH && state.running; i++) {
        state.attempts++;
        const perm = fisherYatesShuffle(inputArr).join(' ');
        if (seen.has(perm)) continue;
        seen.add(perm);
        try {
          if (!ethers.Mnemonic.isValidMnemonic(perm)) continue;
          const hd = ethers.HDNodeWallet.fromPhrase(perm);
          const addr = hd.address;
          if (targetLc && addr.toLowerCase() !== targetLc) continue;

          const candidate = {
            mnemonic: perm,
            address: addr,
            name: `PadaSankara #${state.found + foundBuffer.length + 1}`,
            source: 'padasankara',
            addresses: deriveAllAddresses(perm),
          };

          if (requireActivity && !targetLc) {
            while (pending.size >= CHECK_CONCURRENCY && state.running) {
              await Promise.race(pending);
            }
            if (!state.running) break;
            runWorker(candidate);
          } else {
            foundBuffer.push(candidate);
            state.found++;
            if (targetLc) { state.running = false; break; }
          }
        } catch {}
      }
      const now = Date.now();
      if (now - lastFlushAt > FLUSH_MS || foundBuffer.length >= 20) {
        flushFound();
        lastFlushAt = now;
      }
      sendProgress();
      await new Promise((r) => setTimeout(r, 0));
    }
  } catch (e) {
    postMessage({ type: 'error', error: e.message });
  } finally {
    try { abort.abort(); } catch {}
    await Promise.all(pending).catch(() => {});
    flushFound();
    state.running = false;
    postMessage({ type: 'done', attempts: state.attempts, found: state.found });
  }
}
