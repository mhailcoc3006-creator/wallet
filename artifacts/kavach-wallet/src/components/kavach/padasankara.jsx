'use client';

// PadaSankara — v2 dengan auto-import, pause/resume, no cap.
// Runtime state (isRunning, seen Set) hidup di ref — tidak ikut di-persist.
// Persistent state (inputWords, wordCount, targetAddress, attempts, foundCount, status)
// ada di store dan otomatis disimpan ke vault.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Shuffle, Play, Pause, RotateCcw, Search, AlertTriangle,
  Trash2, KeyRound, CheckCircle2, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWalletStore } from '@/lib/store';
import { hasWalletActivity } from '@/lib/wallet';
import { shortAddr } from './shared';

const WORDLIST = ethers.wordlists.en;

function isWordInList(w) {
  try { return WORDLIST.getWordIndex(w.toLowerCase()) >= 0; } catch { return false; }
}

function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const PadaSankaraTab = () => {
  const padasankara = useWalletStore((s) => s.padasankara);
  const setPS = useWalletStore((s) => s.setPadaSankara);
  const resetPS = useWalletStore((s) => s.resetPadaSankara);
  const addWalletBatch = useWalletStore((s) => s.addWalletBatch);

  // Runtime-only state
  const [isRunning, setIsRunning] = useState(false);
  const stopRef = useRef(false);
  const seenRef = useRef(new Set()); // in-memory permutation dedupe (this session)
  const [lastFound, setLastFound] = useState([]); // last few found for UI feedback

  const { inputWords, wordCount, targetAddress, requireActivity, attempts, foundCount, status } = padasankara;
  const activeWords = inputWords.slice(0, wordCount);
  const filled = activeWords.filter((w) => (w || '').trim()).length;
  const invalidCount = activeWords.filter((w) => (w || '').trim() && !isWordInList(w)).length;

  const hasStarted = attempts > 0;
  const canStart = filled === wordCount && invalidCount === 0 && !isRunning;

  const setWord = (i, v) => {
    if (isRunning) return;
    const next = [...inputWords];
    while (next.length < 24) next.push('');
    next[i] = v.toLowerCase().replace(/[^a-z]/g, '');
    setPS({ inputWords: next });
  };

  const setWordCount = (n) => {
    if (isRunning) return;
    setPS({ wordCount: n });
  };

  const setTargetAddress = (v) => { if (!isRunning) setPS({ targetAddress: v }); };
  const setRequireActivity = (v) => { if (!isRunning) setPS({ requireActivity: !!v }); };

  const handlePaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const parts = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length >= 12) {
      e.preventDefault();
      const n = parts.length >= 24 ? 24 : 12;
      const next = Array(24).fill('');
      for (let i = 0; i < Math.min(n, parts.length); i++) next[i] = parts[i];
      setPS({ inputWords: next, wordCount: n });
      toast.success(`${n} kata di-paste.`);
    }
  };

  const handleReset = () => {
    if (isRunning) return;
    if (typeof window !== 'undefined' && !window.confirm('Reset akan menghapus input & progress PadaSankara (wallet yang sudah di-import tetap ada). Lanjutkan?')) return;
    resetPS();
    seenRef.current = new Set();
    setLastFound([]);
  };

  // Engine — producer/consumer with a concurrent worker pool.
  // Target: ≥100 valid-phrase activity checks per second when filter is on.
  const runEngine = async () => {
    setIsRunning(true);
    setPS({ status: 'running' });
    stopRef.current = false;

    const inputArr = activeWords.map((w) => w.trim().toLowerCase());
    const targetLc = (targetAddress || '').trim().toLowerCase();
    let localAttempts = attempts; // continue counter
    let localFound = foundCount;
    const seen = seenRef.current;
    const BATCH = 400;
    const FLUSH_MS = 250;
    const CHECK_CONCURRENCY = 12; // parallel activity checks
    const CHECK_DISPATCH_MS = 20; // throttle between dispatches
    let lastFlushAt = 0;
    let batchBuffer = []; // wallets to import in bulk (shared; only push, never read concurrently in loop)
    let checkingCount = 0;
    const abortController = new AbortController();

    const flushBatch = () => {
      if (batchBuffer.length) {
        const added = addWalletBatch(batchBuffer);
        localFound = useWalletStore.getState().wallets.filter((w) => w.source === 'padasankara').length;
        setLastFound((prev) => [...batchBuffer.slice(-5), ...prev].slice(0, 5));
        batchBuffer = [];
      }
      setPS({ attempts: localAttempts, foundCount: localFound });
    };

    // Consumer: one worker checks activity and imports if active
    const pending = new Set();
    const runWorker = async (candidate) => {
      if (abortController.signal.aborted) return;
      const promise = (async () => {
        checkingCount++;
        try {
          const { hasActivity } = await hasWalletActivity(candidate.mnemonic, { signal: abortController.signal });
          if (hasActivity && !stopRef.current) {
            batchBuffer.push(candidate);
          }
        } catch (e) {
          if (e.message === 'aborted') return;
          // network/rpc error: skip candidate
        } finally {
          checkingCount--;
        }
      })();
      pending.add(promise);
      try { await promise; } finally { pending.delete(promise); }
    };

    const dispatchCheck = (candidate) => {
      const p = runWorker(candidate);
      pending.add(p);
      p.finally(() => pending.delete(p));
    };

    try {
      while (!stopRef.current) {
        for (let i = 0; i < BATCH && !stopRef.current; i++) {
          localAttempts++;
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
              name: `PadaSankara #${localFound + batchBuffer.length + 1}`,
              source: 'padasankara',
            };

            if (requireActivity && !targetLc) {
              // Backpressure: keep pool full but bounded
              while (pending.size >= CHECK_CONCURRENCY && !stopRef.current) {
                await Promise.race(pending);
              }
              if (stopRef.current) break;
              dispatchCheck(candidate);
              // throttle dispatch rate to avoid RPC bursts
              await new Promise((r) => setTimeout(r, CHECK_DISPATCH_MS));
            } else {
              batchBuffer.push(candidate);
              if (targetLc) { stopRef.current = true; break; }
            }
          } catch {}
        }
        const now = Date.now();
        if (now - lastFlushAt > FLUSH_MS || batchBuffer.length >= 20) {
          flushBatch();
          lastFlushAt = now;
        }
        // yield to UI
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      abortController.abort();
      await Promise.all(pending).catch(() => {});
      flushBatch(); // final flush
      setIsRunning(false);
      setPS({
        attempts: localAttempts,
        foundCount: localFound,
        status: 'paused',
      });
      if (targetLc && batchBuffer.length === 0 && useWalletStore.getState().wallets.find((w) => w.address.toLowerCase() === targetLc)) {
        toast.success('🎉 Target address ditemukan!');
      }
    }
  };

  const start = () => { if (canStart) runEngine(); };
  const resume = () => { if (!isRunning) runEngine(); };
  const pause = () => {
    stopRef.current = true;
    setPS({ status: 'paused' });
  };

  const foundRatePct = attempts > 0 ? Math.min(100, (foundCount / attempts) * 100 * 16) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-fuchsia-950 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-fuchsia-500/20 p-2">
            <Shuffle className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-white">PadaSankara</div>
              <Badge className="h-4 bg-fuchsia-500/20 px-1.5 py-0 text-[9px] text-fuchsia-300 hover:bg-fuchsia-500/20">Recovery</Badge>
            </div>
            <div className="mt-1 text-xs text-slate-400">Auto-import semua permutasi BIP-39 yang valid. Start/Pause kapan saja.</div>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>Setiap phrase valid otomatis ditambahkan sebagai wallet baru. Ranking di tab Portfolio berdasarkan saldo tertinggi ke terendah.</span>
        </div>
      </Card>

      {/* Word count + reset */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          {[12, 24].map((n) => (
            <button
              key={n}
              onClick={() => setWordCount(n)}
              disabled={isRunning}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${wordCount === n ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'} disabled:opacity-40`}
            >
              {n} kata
            </button>
          ))}
        </div>
        <button onClick={handleReset} disabled={isRunning} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 disabled:opacity-40">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* Word grid */}
      <Card className="border-slate-800 bg-slate-900/60 p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: wordCount }).map((_, i) => {
            const val = inputWords[i] || '';
            const isValid = !val || isWordInList(val);
            return (
              <div key={i} className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${isValid ? 'border-slate-700/70 bg-slate-950/50' : 'border-red-500/40 bg-red-500/5'}`}>
                <span className="w-5 text-[9px] font-mono text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                <input
                  value={val}
                  onChange={(e) => setWord(i, e.target.value)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  disabled={isRunning}
                  placeholder="—"
                  className="w-full bg-transparent text-xs font-medium text-white outline-none placeholder:text-slate-700"
                />
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{filled}/{wordCount} kata diisi</span>
          {invalidCount > 0 && <span className="text-red-400">{invalidCount} kata tidak ada di BIP-39</span>}
        </div>
      </Card>

      {/* Target address */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
          <span>Target Address (opsional)</span>
          <span className="text-slate-600">EVM • 0x...</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input
            value={targetAddress || ''}
            onChange={(e) => setTargetAddress(e.target.value)}
            disabled={isRunning}
            placeholder="0x... (auto-stop saat match)"
            className="h-11 rounded-xl border-slate-700 bg-slate-900/70 pl-9 font-mono text-xs text-white placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Activity filter toggle */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <input
          id="ps-activity"
          type="checkbox"
          checked={requireActivity}
          onChange={(e) => setRequireActivity(e.target.checked)}
          disabled={isRunning}
          className="mt-0.5 h-4 w-4 accent-fuchsia-500"
        />
        <label htmlFor="ps-activity" className="flex-1 cursor-pointer select-none">
          <div className="text-xs font-medium text-slate-200">Hanya simpan wallet aktif</div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
            Valid phrase hanya di-import kalau address-nya punya saldo &gt; 0 atau riwayat transaksi di salah satu chain. Lebih lambat karena perlu cek network.
          </div>
        </label>
      </div>

      {/* Progress card (if started) */}
      {hasStarted && (
        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500">{isRunning ? 'Sedang berjalan' : status === 'paused' ? 'Dijeda' : 'Siap'}</div>
              <div className="mt-1 font-mono text-lg font-bold text-white">{attempts.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">total percobaan</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-slate-500">Wallet ditemukan</div>
              <div className="mt-1 font-mono text-lg font-bold text-fuchsia-300">{foundCount.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">auto-imported</div>
            </div>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 ${isRunning ? 'animate-pulse' : ''}`} style={{ width: `${foundRatePct}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Hit-rate checksum ± 1/16 (≈6.25%)</div>
        </Card>
      )}

      {/* Controls */}
      {!isRunning ? (
        hasStarted ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={resume} className="h-14 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:from-fuchsia-400 hover:to-purple-500">
              <Play className="mr-2 h-5 w-5" /> Lanjutkan
            </Button>
            <Button onClick={handleReset} variant="outline" className="h-14 rounded-2xl border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
              <RotateCcw className="mr-2 h-5 w-5" /> Reset
            </Button>
          </div>
        ) : (
          <Button
            onClick={start}
            disabled={!canStart}
            className="h-14 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:from-fuchsia-400 hover:to-purple-500 disabled:opacity-40"
          >
            <Play className="mr-2 h-5 w-5" /> Mulai PadaSankara
          </Button>
        )
      ) : (
        <Button onClick={pause} className="h-14 w-full rounded-2xl bg-amber-500/20 text-amber-100 hover:bg-amber-500/30">
          <Pause className="mr-2 h-5 w-5" /> Pause
        </Button>
      )}

      {/* Last found preview */}
      {lastFound.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
            <span>Baru saja di-import</span>
            <span className="text-slate-600">Cek tab Portfolio</span>
          </div>
          <div className="space-y-2">
            {lastFound.map((w, i) => (
              <motion.div key={w.address + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                <Card className="border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-fuchsia-500/20 p-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-fuchsia-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white">{w.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{shortAddr(w.address, 8, 8)}</div>
                    </div>
                    <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 text-center text-[10px] uppercase tracking-widest text-slate-600">
        Fisher-Yates • dedup Set • checksum BIP-39 • client-only
      </div>
    </div>
  );
};
