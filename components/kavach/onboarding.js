'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Sparkles, Download, KeyRound, Shield, AlertTriangle, Lock,
  Eye, EyeOff, Copy, Check, RefreshCw, Layers,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Brand, BrandMark } from './shared';
import { createWallet, importFromMnemonic } from '@/lib/wallet';
import { useWalletStore } from '@/lib/store';

export const Splash = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col items-center gap-6"
    >
      <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
        <BrandMark size={88} />
      </motion.div>
      <div className="text-center">
        <div className="text-3xl font-bold tracking-tight text-white">Kavach</div>
        <div className="mt-1 text-xs uppercase tracking-[0.35em] text-emerald-400">Your crypto shield</div>
      </div>
    </motion.div>
  </div>
);

const ScreenHeader = ({ onBack, title, subtitle }) => (
  <div className="mb-8">
    {onBack && (
      <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>
    )}
    <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
    {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>}
  </div>
);

const FeaturePill = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
    <Icon className="h-5 w-5 text-emerald-400" />
    <span className="text-xs text-slate-300">{label}</span>
  </div>
);

export const Welcome = ({ onCreate, onImport }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
    <div className="flex items-center justify-between">
      <Brand />
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">Non-custodial</Badge>
    </div>
    <div className="flex flex-1 flex-col justify-center py-12">
      <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
        Wallet crypto <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">yang benar-benar milik Anda.</span>
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-400">
        Kelola aset di 10 chain — Bitcoin, Ethereum, Solana, BNB, Polygon, Arbitrum, Optimism, Base, Avalanche, dan Tron — dari satu recovery phrase.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-3">
        <FeaturePill icon={Layers} label="10 Chain" />
        <FeaturePill icon={Lock} label="Local-only" />
        <FeaturePill icon={Sparkles} label="BIP-39" />
      </div>
    </div>
    <div className="space-y-3">
      <Button onClick={onCreate} className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400">
        <Sparkles className="mr-2 h-5 w-5" /> Buat Wallet Baru
      </Button>
      <Button onClick={onImport} variant="outline" className="h-14 w-full rounded-2xl border-slate-700 bg-slate-900/60 text-base font-semibold text-white hover:bg-slate-800">
        <Download className="mr-2 h-5 w-5" /> Import dengan Recovery Phrase
      </Button>
      <p className="pt-2 text-center text-xs text-slate-500">Dengan melanjutkan, Anda bertanggung jawab atas keamanan recovery phrase Anda.</p>
    </div>
  </motion.div>
);

const InfoRow = ({ icon: Icon, text }) => (
  <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left">
    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
    <span className="text-xs leading-relaxed text-slate-300">{text}</span>
  </div>
);

export const CreateWallet = ({ onBack, onGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const handle = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 300));
    try { onGenerated(createWallet()); } catch (e) { toast.error('Gagal: ' + e.message); }
    setGenerating(false);
  };
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ScreenHeader onBack={onBack} title="Buat Wallet Baru" subtitle="Kami akan membuat 12 kata rahasia. Ini SATU-SATUNYA cara memulihkan wallet Anda. Jangan bagikan." />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/20 blur-2xl" />
          <div className="relative rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-xl shadow-emerald-500/30">
            <KeyRound className="h-14 w-14 text-white" />
          </div>
        </div>
        <div className="w-full space-y-2">
          <InfoRow icon={Lock} text="Kunci dibuat lokal di device — tidak pernah dikirim ke server." />
          <InfoRow icon={Shield} text="Standar terbuka BIP-39 (12 kata) + BIP-44 multi-chain." />
          <InfoRow icon={AlertTriangle} text="Simpan recovery phrase di tempat yang aman." />
        </div>
      </div>
      <Button onClick={handle} disabled={generating} className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400">
        {generating ? <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Membuat...</> : <>Generate Recovery Phrase <ArrowRight className="ml-2 h-5 w-5" /></>}
      </Button>
    </motion.div>
  );
};

const ConfirmPhrase = ({ expected, onBack, onConfirmed }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const handleConfirm = () => {
    const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleaned !== expected.trim().toLowerCase()) return setError('Recovery phrase tidak cocok. Cek urutan dan ejaan.');
    onConfirmed();
  };
  return (
    <>
      <Textarea value={value} onChange={(e) => { setValue(e.target.value); setError(''); }} placeholder="Ketik 12 kata, dipisahkan spasi..." className="min-h-[140px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-emerald-500" />
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <div className="flex-1" />
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-14 flex-1 rounded-2xl border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">Lihat lagi</Button>
        <Button onClick={handleConfirm} disabled={!value.trim()} className="h-14 flex-[2] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40">Konfirmasi & Masuk</Button>
      </div>
    </>
  );
};

export const BackupPhrase = ({ wallet, onDone, onBack }) => {
  const words = useMemo(() => wallet.mnemonic.split(' '), [wallet.mnemonic]);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState('reveal');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wallet.mnemonic);
    setCopied(true); toast.success('Recovery phrase disalin.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ScreenHeader onBack={onBack} title={step === 'reveal' ? 'Recovery Phrase Anda' : 'Konfirmasi Recovery Phrase'} subtitle={step === 'reveal' ? '12 kata ini adalah kunci utama wallet Anda. Tulis di kertas dan simpan offline.' : 'Ketik ulang recovery phrase persis seperti yang tampil.'} />
      {step === 'reveal' ? (
        <>
          <Card className="relative overflow-hidden border-slate-800 bg-slate-900/70 p-5">
            {!revealed && (
              <button onClick={() => setRevealed(true)} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/95 backdrop-blur-sm transition hover:bg-slate-900">
                <Eye className="h-8 w-8 text-emerald-400" />
                <span className="text-sm font-medium text-slate-200">Ketuk untuk mengungkap</span>
                <span className="px-6 text-center text-xs text-slate-400">Pastikan tidak ada orang lain melihat layar Anda.</span>
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {words.map((w, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/50 px-3 py-2.5">
                  <span className="text-[10px] font-mono text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-medium text-white">{w}</span>
                </div>
              ))}
            </div>
          </Card>
          {revealed && (
            <>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={handleCopy} className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
                  {copied ? <><Check className="mr-2 h-4 w-4 text-emerald-400" /> Tersalin</> : <><Copy className="mr-2 h-4 w-4" /> Salin</>}
                </Button>
                <Button variant="outline" onClick={() => setRevealed(false)} className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"><EyeOff className="h-4 w-4" /></Button>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                <p className="text-xs leading-relaxed text-amber-200">Kavach tidak dapat memulihkan phrase ini. Kehilangan berarti kehilangan akses permanen.</p>
              </div>
            </>
          )}
          <div className="flex-1" />
          <Button onClick={() => setStep('confirm')} disabled={!revealed} className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40">
            Saya sudah menyimpannya <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </>
      ) : (
        <ConfirmPhrase
          expected={wallet.mnemonic}
          onBack={() => setStep('reveal')}
          onConfirmed={() => {
            useWalletStore.getState().setWallet({ mnemonic: wallet.mnemonic, address: wallet.address });
            useWalletStore.getState().confirmBackup();
            toast.success('Wallet siap digunakan.');
            onDone();
          }}
        />
      )}
    </motion.div>
  );
};

export const ImportWallet = ({ onBack, onImported }) => {
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = async () => {
    setError(''); setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const w = importFromMnemonic(phrase);
      useWalletStore.getState().setWallet({ mnemonic: w.mnemonic, address: w.address });
      useWalletStore.getState().confirmBackup();
      toast.success('Wallet berhasil di-import.');
      onImported();
    } catch (e) { setError(e.message || 'Recovery phrase tidak valid.'); }
    setLoading(false);
  };
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ScreenHeader onBack={onBack} title="Import Wallet" subtitle="Masukkan recovery phrase 12/24 kata Anda. Diproses lokal di device, tidak dikirim ke mana pun." />
      <Textarea value={phrase} onChange={(e) => { setPhrase(e.target.value); setError(''); }} placeholder="contoh: silent laptop river ..." className="min-h-[160px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-emerald-500" />
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <p className="text-xs leading-relaxed text-red-200">{error}</p>
        </div>
      )}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
        <p className="text-xs leading-relaxed text-slate-300">Semua validasi berjalan di browser Anda dengan library open-source.</p>
      </div>
      <div className="flex-1" />
      <Button onClick={handle} disabled={loading || !phrase.trim()} className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40">
        {loading ? <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Memvalidasi...</> : <>Import Wallet <ArrowRight className="ml-2 h-5 w-5" /></>}
      </Button>
    </motion.div>
  );
};
