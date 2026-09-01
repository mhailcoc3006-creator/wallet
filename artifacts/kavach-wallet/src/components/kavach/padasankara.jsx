'use client';

// PadaSankara — private BIP-39 wallet generator.
// All entropy, mnemonic generation, and key derivation happen in this browser.
// No mnemonic, address, balance check, or activity request is sent to the API.

import { useMemo, useState } from 'react';
import { ethers } from 'ethers';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWalletStore } from '@/lib/store';
import { shortAddr } from './shared';

function createPrivateWallet(wordCount) {
  const entropyBytes = wordCount === 24 ? 32 : 16;
  const mnemonic = ethers.Mnemonic.fromEntropy(ethers.randomBytes(entropyBytes)).phrase;
  const wallet = ethers.Wallet.fromPhrase(mnemonic);
  return {
    mnemonic,
    address: wallet.address,
    name: 'BIP-39 Wallet',
    source: 'padasankara',
  };
}

export const PadaSankaraTab = () => {
  const addWallet = useWalletStore((s) => s.addWallet);
  const [wordCount, setWordCount] = useState(12);
  const [generated, setGenerated] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const words = useMemo(() => (generated?.mnemonic || '').split(' '), [generated?.mnemonic]);

  const generate = async () => {
    setGenerating(true);
    setRevealed(false);
    setCopied(false);
    await new Promise((resolve) => setTimeout(resolve, 80));
    try {
      const candidate = createPrivateWallet(wordCount);
      const wallet = addWallet(candidate);
      if (!wallet) throw new Error('Wallet duplikat, silakan generate ulang.');
      useWalletStore.getState().setActiveWallet(wallet.id);
      setGenerated(wallet);
      toast.success('Wallet BIP-39 baru ditambahkan ke vault Anda.');
    } catch (error) {
      toast.error(error?.message || 'Gagal membuat wallet baru.');
    } finally {
      setGenerating(false);
    }
  };

  const copyPhrase = async () => {
    if (!generated?.mnemonic || !revealed) return;
    await navigator.clipboard.writeText(generated.mnemonic);
    setCopied(true);
    toast.success('Recovery phrase disalin. Simpan di tempat aman.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-fuchsia-950 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-fuchsia-500/20 p-2">
            <Sparkles className="h-5 w-5 text-fuchsia-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-white">Buat Wallet BIP-39</div>
              <Badge className="h-4 bg-fuchsia-500/20 px-1.5 py-0 text-[9px] text-fuchsia-300 hover:bg-fuchsia-500/20">Private</Badge>
            </div>
            <div className="mt-1 text-xs leading-relaxed text-slate-400">
              Generator wallet baru menggunakan seluruh wordlist BIP-39 dan entropy aman dari browser Anda.
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
          <div className="text-xs leading-relaxed text-slate-300">
            <div className="font-semibold text-white">Hanya untuk akun Anda</div>
            <div className="mt-1 text-slate-500">
              Phrase dibuat dan disimpan di vault terenkripsi pada device ini. Tidak ada pemindaian alamat publik, pengecekan saldo, atau pengiriman data ke server.
            </div>
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Panjang recovery phrase</div>
        <div className="grid grid-cols-2 gap-2">
          {[12, 24].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setWordCount(count)}
              disabled={generating}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                wordCount === count
                  ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
              } disabled:opacity-40`}
            >
              <div className="text-sm font-semibold">{count} kata</div>
              <div className="mt-1 text-[10px] opacity-70">{count === 12 ? '128-bit entropy' : '256-bit entropy'}</div>
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={generate}
        disabled={generating}
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:from-fuchsia-400 hover:to-purple-500 disabled:opacity-40"
      >
        {generating ? (
          <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Membuat wallet...</>
        ) : (
          <><WalletCards className="mr-2 h-5 w-5" /> Buat Wallet Acak BIP-39</>
        )}
      </Button>

      {generated && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="text-sm font-semibold text-white">Wallet berhasil dibuat</div>
              <div className="text-[10px] text-slate-500">Sudah disimpan ke vault terenkripsi Anda</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
              <span>Alamat EVM</span>
              <span className="font-mono normal-case text-slate-400">{shortAddr(generated.address, 10, 8)}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-200">
              <LockKeyhole className="h-3.5 w-3.5 text-amber-300" />
              <span>Simpan recovery phrase sebelum memakai wallet ini.</span>
            </div>
          </div>

          <div className="relative mt-3">
            {!revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/95 backdrop-blur-sm"
              >
                <Eye className="h-6 w-6 text-emerald-400" />
                <span className="text-xs font-medium text-slate-200">Ketuk untuk mengungkap phrase</span>
              </button>
            )}
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              {words.map((word, index) => (
                <div key={`${word}-${index}`} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-2">
                  <span className="text-[9px] font-mono text-slate-600">{String(index + 1).padStart(2, '0')}</span>
                  <span className="truncate text-[11px] font-medium text-white">{word}</span>
                </div>
              ))}
            </div>
          </div>

          {revealed && (
            <div className="mt-3 flex gap-2">
              <Button onClick={copyPhrase} variant="outline" className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
                {copied ? <><Check className="mr-2 h-4 w-4 text-emerald-400" /> Tersalin</> : <><Copy className="mr-2 h-4 w-4" /> Salin Phrase</>}
              </Button>
              <Button onClick={() => setRevealed(false)} variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="mt-3 text-[10px] leading-relaxed text-slate-500">
            Recovery phrase memberi akses penuh ke wallet. Jangan kirim ke siapa pun dan jangan simpan di chat atau screenshot cloud.
          </div>
        </Card>
      )}

      <div className="pt-2 text-center text-[10px] uppercase tracking-widest text-slate-600">
        BIP-39 • local entropy • encrypted vault • no public scanning
      </div>
    </div>
  );
};