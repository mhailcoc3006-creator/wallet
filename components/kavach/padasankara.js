'use client';

// PadaSankara \u2014 BIP-39 Word Shuffle Recovery Tool
// "Pada" (kata) + "Sankara" (mencampur) \u2014 alat bantu memulihkan wallet ketika
// user lupa urutan kata seed phrase mereka.
//
// Cara kerja:
// 1. User memasukkan 12 atau 24 kata BIP-39 (urutan tidak harus benar).
// 2. Opsional: user memberikan target address untuk mempersempit hasil.
// 3. Tool mengacak permutasi secara acak (Fisher-Yates) dan cek checksum BIP-39.
// 4. Setiap permutasi valid \u2192 derive EVM address \u2192 tampilkan di daftar kandidat.
// 5. User bisa langsung Import kandidat manapun sebagai wallet aktif.

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Shuffle, Play, Square, Search, AlertTriangle, Sparkles, CheckCircle2, X,
  Trash2, Import, Loader2, KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useWalletStore } from '@/lib/store';
import { importFromMnemonic } from '@/lib/wallet';
import { fmtNum, shortAddr } from './shared';

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
  const [wordCount, setWordCount] = useState(12);
  const [words, setWords] = useState(Array(24).fill(''));
  const [target, setTarget] = useState('');
  const [maxIter, setMaxIter] = useState(100_000);
  const [running, setRunning] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [candidates, setCandidates] = useState([]); // [{ phrase, address }]
  const [importedPhrase, setImportedPhrase] = useState(null);
  const stopRef = useRef(false);

  const activeWords = words.slice(0, wordCount);
  const filled = activeWords.filter((w) => w.trim()).length;
  const invalidWords = activeWords
    .map((w, i) => ({ w: w.trim().toLowerCase(), i }))
    .filter((x) => x.w && !isWordInList(x.w));

  const canStart = filled === wordCount && invalidWords.length === 0 && !running;

  const setWord = (i, v) => {
    const next = [...words];
    next[i] = v.toLowerCase().replace(/[^a-z]/g, '');
    setWords(next);
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const parts = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length >= 12) {
      e.preventDefault();
      const n = parts.length >= 24 ? 24 : 12;
      setWordCount(n);
      const next = Array(24).fill('');
      for (let i = 0; i < Math.min(n, parts.length); i++) next[i] = parts[i];
      setWords(next);
      toast.success(`${n} kata di-paste.`);
    }
  };

  const clearAll = () => {
    setWords(Array(24).fill(''));
    setCandidates([]);
    setAttempts(0);
  };

  const start = async () => {
    if (!canStart) return;
    stopRef.current = false;
    setRunning(true);
    setAttempts(0);
    setCandidates([]);
    const input = activeWords.map((w) => w.trim().toLowerCase());
    const targetAddr = target.trim().toLowerCase();
    const seen = new Set();
    let localAttempts = 0;
    let localCandidates = [];
    const BATCH = 300;

    try {
      while (localAttempts < maxIter && !stopRef.current) {
        for (let i = 0; i < BATCH && localAttempts < maxIter; i++) {
          localAttempts++;
          const perm = fisherYatesShuffle(input).join(' ');
          if (seen.has(perm)) continue;
          seen.add(perm);
          try {
            if (!ethers.Mnemonic.isValidMnemonic(perm)) continue;
            const hd = ethers.HDNodeWallet.fromPhrase(perm);
            const addr = hd.address;
            if (targetAddr && addr.toLowerCase() !== targetAddr) continue;
            localCandidates.push({ phrase: perm, address: addr });
            if (targetAddr) { stopRef.current = true; break; }
            // cap candidate list to avoid memory blow
            if (localCandidates.length >= 500) { stopRef.current = true; break; }
          } catch {}
        }
        // flush to UI
        setAttempts(localAttempts);
        setCandidates([...localCandidates]);
        // yield
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      setRunning(false);
      if (targetAddr && localCandidates.length > 0) {
        toast.success(`\ud83c\udf89 Match ditemukan setelah ${localAttempts.toLocaleString()} percobaan!`);
      } else if (localCandidates.length === 0) {
        toast.message('Tidak ada permutasi dengan checksum valid pada iterasi ini.');
      } else {
        toast.success(`Selesai. ${localCandidates.length} kandidat ditemukan.`);
      }
    }
  };

  const stop = () => { stopRef.current = true; };

  const doImport = (phrase) => {
    if (typeof window !== 'undefined' && !window.confirm('Import phrase ini akan MENGGANTIKAN wallet aktif Anda. Pastikan Anda sudah backup recovery phrase saat ini. Lanjutkan?')) return;
    try {
      const w = importFromMnemonic(phrase);
      useWalletStore.getState().setWallet({ mnemonic: w.mnemonic, address: w.address });
      useWalletStore.getState().confirmBackup();
      setImportedPhrase(phrase);
      toast.success('Wallet berhasil di-import via PadaSankara.');
    } catch (e) {
      toast.error('Import gagal: ' + e.message);
    }
  };

  const progressPct = Math.min(100, (attempts / maxIter) * 100);

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
            <div className="mt-1 text-xs text-slate-400">Mengacak urutan kata BIP-39 dan mencari permutasi dengan checksum valid.</div>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>Gunakan hanya untuk memulihkan wallet <b>milik Anda sendiri</b>. Semua proses berjalan di browser, tidak ada data yang dikirim ke server.</span>
        </div>
      </Card>

      {/* Word count selector */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          {[12, 24].map((n) => (
            <button
              key={n}
              onClick={() => setWordCount(n)}
              disabled={running}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${wordCount === n ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'} disabled:opacity-40`}
            >
              {n} kata
            </button>
          ))}
        </div>
        <button onClick={clearAll} disabled={running} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 disabled:opacity-40">
          <Trash2 className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* Word grid */}
      <Card className="border-slate-800 bg-slate-900/60 p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: wordCount }).map((_, i) => {
            const val = words[i] || '';
            const isValid = !val || isWordInList(val);
            return (
              <div key={i} className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${isValid ? 'border-slate-700/70 bg-slate-950/50' : 'border-red-500/40 bg-red-500/5'}`}>
                <span className="text-[9px] font-mono text-slate-500 w-5">{String(i + 1).padStart(2, '0')}</span>
                <input
                  value={val}
                  onChange={(e) => setWord(i, e.target.value)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  disabled={running}
                  placeholder="\u2014"
                  className="w-full bg-transparent text-xs font-medium text-white outline-none placeholder:text-slate-700"
                />
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{filled}/{wordCount} kata diisi</span>
          {invalidWords.length > 0 && (
            <span className="text-red-400">{invalidWords.length} kata tidak ada di wordlist BIP-39</span>
          )}
        </div>
      </Card>

      {/* Target address (optional) */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
          <span>Target Address (opsional)</span>
          <span className="text-slate-600">EVM \u2022 0x...</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={running}
            placeholder="0x... (akan berhenti otomatis saat match)"
            className="h-11 rounded-xl border-slate-700 bg-slate-900/70 pl-9 font-mono text-xs text-white placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Iterations */}
      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Maks. Iterasi</div>
        <div className="grid grid-cols-4 gap-2">
          {[10_000, 100_000, 500_000, 1_000_000].map((n) => (
            <button
              key={n}
              onClick={() => setMaxIter(n)}
              disabled={running}
              className={`rounded-xl border p-2 text-xs font-medium transition ${maxIter === n ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'} disabled:opacity-40`}
            >
              {n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}k`}
            </button>
          ))}
        </div>
      </div>

      {/* Run / Stop */}
      {!running ? (
        <Button
          onClick={start}
          disabled={!canStart}
          className="h-14 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:from-fuchsia-400 hover:to-purple-500 disabled:opacity-40"
        >
          <Play className="mr-2 h-5 w-5" /> Mulai PadaSankara
        </Button>
      ) : (
        <Button onClick={stop} className="h-14 w-full rounded-2xl bg-red-500/20 text-red-100 hover:bg-red-500/30">
          <Square className="mr-2 h-5 w-5" /> Hentikan
        </Button>
      )}

      {/* Progress */}
      {(running || attempts > 0) && (
        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">{running ? 'Mengacak permutasi...' : 'Selesai'}</span>
            <span className="font-mono text-slate-300">{attempts.toLocaleString()} / {maxIter.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 transition-all duration-100" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Kandidat valid ditemukan</span>
            <span className="font-bold text-fuchsia-300">{candidates.length}</span>
          </div>
        </Card>
      )}

      {/* Candidates */}
      {candidates.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
            <span>Kandidat Wallet</span>
            <span className="text-slate-600">Checksum valid \u2022 EVM address</span>
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {candidates.map((c, i) => (
              <motion.div key={c.phrase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}>
                <Card className="border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-fuchsia-500/20 p-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-fuchsia-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-white">{shortAddr(c.address, 8, 8)}</div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{c.phrase.split(' ').slice(0, 4).join(' ')} ...</div>
                    </div>
                    <Button size="sm" onClick={() => doImport(c.phrase)} className="h-8 bg-gradient-to-r from-emerald-500 to-teal-500 px-3 text-xs font-semibold text-white hover:from-emerald-400 hover:to-teal-400">
                      <Import className="mr-1 h-3 w-3" /> Import
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {importedPhrase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setImportedPhrase(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
            <div className="mt-3 text-lg font-bold text-white">Wallet Ditemukan!</div>
            <div className="mt-2 text-xs text-slate-400">Wallet baru sudah aktif. Buka tab Portfolio untuk melihat saldonya.</div>
            <Button onClick={() => setImportedPhrase(null)} className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400">
              Lanjutkan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
