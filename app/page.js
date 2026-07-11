'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Sparkles,
  Wallet as WalletIcon,
  Download,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Lock,
  KeyRound,
  LogOut,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { useWalletStore } from '@/lib/store';
import { createWallet, importFromMnemonic, fetchAllBalances } from '@/lib/wallet';
import { CHAINS } from '@/lib/chains';

// ────────────────────────────────────────────────────────────────────────────
// Root App — routes between screens
// ────────────────────────────────────────────────────────────────────────────
const App = () => {
  const [view, setView] = useState('splash');
  const [pendingWallet, setPendingWallet] = useState(null); // sebelum di-confirm backup
  const [hydrated, setHydrated] = useState(false);

  const wallet = useWalletStore((s) => s.wallet);
  const backupConfirmed = useWalletStore((s) => s.backupConfirmed);

  // Splash → decide destination
  useEffect(() => {
    setHydrated(true);
    const timer = setTimeout(() => {
      if (wallet && backupConfirmed) setView('dashboard');
      else setView('welcome');
    }, 1400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated || view === 'splash') return <Splash />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AnimatePresence mode="wait">
        {view === 'welcome' && (
          <Welcome
            key="welcome"
            onCreate={() => setView('create')}
            onImport={() => setView('import')}
          />
        )}
        {view === 'create' && (
          <CreateWallet
            key="create"
            onBack={() => setView('welcome')}
            onGenerated={(w) => {
              setPendingWallet(w);
              setView('backup');
            }}
          />
        )}
        {view === 'backup' && pendingWallet && (
          <BackupPhrase
            key="backup"
            wallet={pendingWallet}
            onDone={() => {
              setPendingWallet(null);
              setView('dashboard');
            }}
            onBack={() => setView('welcome')}
          />
        )}
        {view === 'import' && (
          <ImportWallet
            key="import"
            onBack={() => setView('welcome')}
            onImported={() => setView('dashboard')}
          />
        )}
        {view === 'dashboard' && (
          <Dashboard key="dashboard" onReset={() => setView('welcome')} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Reusable brand mark
// ────────────────────────────────────────────────────────────────────────────
const BrandMark = ({ size = 40 }) => (
  <div
    className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-lg shadow-emerald-500/30"
    style={{ width: size, height: size }}
  >
    <Shield className="text-white" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.4} />
    <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20" />
  </div>
);

const Brand = ({ size = 40 }) => (
  <div className="flex items-center gap-3">
    <BrandMark size={size} />
    <div>
      <div className="text-lg font-bold tracking-tight text-white">Kavach</div>
      <div className="-mt-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-400/80">Wallet</div>
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Splash Screen
// ────────────────────────────────────────────────────────────────────────────
const Splash = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col items-center gap-6"
    >
      <motion.div
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandMark size={88} />
      </motion.div>
      <div className="text-center">
        <div className="text-3xl font-bold tracking-tight text-white">Kavach</div>
        <div className="mt-1 text-xs uppercase tracking-[0.35em] text-emerald-400">Your crypto shield</div>
      </div>
    </motion.div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Welcome / Onboarding
// ────────────────────────────────────────────────────────────────────────────
const Welcome = ({ onCreate, onImport }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10"
  >
    <div className="flex items-center justify-between">
      <Brand />
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
        Non-custodial
      </Badge>
    </div>

    <div className="flex flex-1 flex-col justify-center py-12">
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-4xl font-bold leading-tight tracking-tight text-white"
      >
        Wallet crypto <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">yang benar-benar milik Anda.</span>
      </motion.h1>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-4 text-base leading-relaxed text-slate-400"
      >
        Kelola aset di 6 chain sekaligus — Ethereum, BNB, Polygon, Arbitrum, Optimism, Base — dari satu recovery phrase. Kunci hanya tersimpan di device Anda.
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 grid grid-cols-3 gap-3"
      >
        <FeaturePill icon={Layers} label="6 Chain" />
        <FeaturePill icon={Lock} label="Local-only" />
        <FeaturePill icon={Sparkles} label="BIP-39" />
      </motion.div>
    </div>

    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="space-y-3"
    >
      <Button
        onClick={onCreate}
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400"
      >
        <Sparkles className="mr-2 h-5 w-5" /> Buat Wallet Baru
      </Button>
      <Button
        onClick={onImport}
        variant="outline"
        className="h-14 w-full rounded-2xl border-slate-700 bg-slate-900/60 text-base font-semibold text-white hover:bg-slate-800"
      >
        <Download className="mr-2 h-5 w-5" /> Import dengan Recovery Phrase
      </Button>
      <p className="pt-2 text-center text-xs text-slate-500">
        Dengan melanjutkan, Anda setuju bertanggung jawab atas keamanan recovery phrase Anda.
      </p>
    </motion.div>
  </motion.div>
);

const FeaturePill = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
    <Icon className="h-5 w-5 text-emerald-400" />
    <span className="text-xs text-slate-300">{label}</span>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Screen header helper
// ────────────────────────────────────────────────────────────────────────────
const ScreenHeader = ({ onBack, title, subtitle }) => (
  <div className="mb-8">
    <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm text-slate-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Kembali
    </button>
    <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
    {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Create Wallet (generate mnemonic)
// ────────────────────────────────────────────────────────────────────────────
const CreateWallet = ({ onBack, onGenerated }) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 350)); // small UX delay
    try {
      const w = createWallet();
      onGenerated(w);
    } catch (e) {
      toast.error('Gagal generate wallet: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10"
    >
      <ScreenHeader
        onBack={onBack}
        title="Buat Wallet Baru"
        subtitle="Kami akan membuat 12 kata rahasia (recovery phrase). Ini adalah SATU-SATUNYA cara untuk memulihkan wallet Anda. Jangan pernah membagikannya kepada siapa pun."
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/20 blur-2xl" />
          <div className="relative rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-xl shadow-emerald-500/30">
            <KeyRound className="h-14 w-14 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <InfoRow icon={Lock} text="Kunci dibuat lokal di device — tidak pernah dikirim ke server." />
          <InfoRow icon={Shield} text="Standar terbuka BIP-39 (12 kata) + BIP-44." />
          <InfoRow icon={AlertTriangle} text="Simpan recovery phrase di tempat yang aman." />
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={generating}
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400"
      >
        {generating ? (
          <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Membuat...</>
        ) : (
          <>Generate Recovery Phrase <ArrowRight className="ml-2 h-5 w-5" /></>
        )}
      </Button>
    </motion.div>
  );
};

const InfoRow = ({ icon: Icon, text }) => (
  <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left">
    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
    <span className="text-xs leading-relaxed text-slate-300">{text}</span>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Backup Phrase (reveal + confirmation)
// ────────────────────────────────────────────────────────────────────────────
const BackupPhrase = ({ wallet, onDone, onBack }) => {
  const words = useMemo(() => wallet.mnemonic.split(' '), [wallet.mnemonic]);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState('reveal'); // reveal | confirm

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wallet.mnemonic);
    setCopied(true);
    toast.success('Recovery phrase disalin.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10"
    >
      <ScreenHeader
        onBack={onBack}
        title={step === 'reveal' ? 'Recovery Phrase Anda' : 'Konfirmasi Recovery Phrase'}
        subtitle={
          step === 'reveal'
            ? '12 kata di bawah adalah kunci utama wallet Anda. Tulis di kertas dan simpan offline.'
            : 'Ketik ulang recovery phrase persis seperti yang tampil sebelumnya, dipisahkan spasi.'
        }
      />

      {step === 'reveal' ? (
        <>
          <Card className="relative overflow-hidden border-slate-800 bg-slate-900/70 p-5">
            {!revealed && (
              <button
                onClick={() => setRevealed(true)}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/95 backdrop-blur-sm transition hover:bg-slate-900"
              >
                <Eye className="h-8 w-8 text-emerald-400" />
                <span className="text-sm font-medium text-slate-200">Ketuk untuk mengungkap</span>
                <span className="px-6 text-center text-xs text-slate-400">
                  Pastikan tidak ada orang lain melihat layar Anda.
                </span>
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {words.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/50 px-3 py-2.5"
                >
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
                <Button variant="outline" onClick={() => setRevealed(false)} className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
                  <EyeOff className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                <p className="text-xs leading-relaxed text-amber-200">
                  Kavach tidak dapat memulihkan phrase ini untuk Anda. Kehilangan berarti kehilangan akses permanen.
                </p>
              </div>
            </>
          )}

          <div className="flex-1" />
          <Button
            onClick={() => setStep('confirm')}
            disabled={!revealed}
            className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40"
          >
            Saya sudah menyimpannya <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </>
      ) : (
        <ConfirmPhrase
          expected={wallet.mnemonic}
          onBack={() => setStep('reveal')}
          onConfirmed={() => {
            useWalletStore.getState().setWallet({
              mnemonic: wallet.mnemonic,
              address: wallet.address,
            });
            useWalletStore.getState().confirmBackup();
            toast.success('Wallet siap digunakan.');
            onDone();
          }}
        />
      )}
    </motion.div>
  );
};

const ConfirmPhrase = ({ expected, onBack, onConfirmed }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleaned !== expected.trim().toLowerCase()) {
      setError('Recovery phrase tidak cocok. Periksa urutan dan ejaan kata.');
      return;
    }
    onConfirmed();
  };

  return (
    <>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
        placeholder="Ketik 12 kata, dipisahkan spasi..."
        className="min-h-[140px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
      />
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <div className="flex-1" />
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-14 flex-1 rounded-2xl border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
          Lihat lagi
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!value.trim()}
          className="h-14 flex-[2] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40"
        >
          Konfirmasi & Masuk
        </Button>
      </div>
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Import Wallet
// ────────────────────────────────────────────────────────────────────────────
const ImportWallet = ({ onBack, onImported }) => {
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setError('');
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 250));
      const w = importFromMnemonic(phrase);
      useWalletStore.getState().setWallet({
        mnemonic: w.mnemonic,
        address: w.address,
      });
      useWalletStore.getState().confirmBackup(); // sudah punya phrase
      toast.success('Wallet berhasil di-import.');
      onImported();
    } catch (e) {
      setError(e.message || 'Recovery phrase tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10"
    >
      <ScreenHeader
        onBack={onBack}
        title="Import Wallet"
        subtitle="Masukkan recovery phrase 12 / 24 kata Anda. Data diproses lokal di device, tidak dikirim ke mana pun."
      />

      <Textarea
        value={phrase}
        onChange={(e) => {
          setPhrase(e.target.value);
          setError('');
        }}
        placeholder="contoh: silent laptop river ..."
        className="min-h-[160px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
      />
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <p className="text-xs leading-relaxed text-red-200">{error}</p>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
        <p className="text-xs leading-relaxed text-slate-300">
          Semua validasi dan derivasi kunci berjalan di browser Anda menggunakan library open-source ethers.js.
        </p>
      </div>

      <div className="flex-1" />
      <Button
        onClick={handleImport}
        disabled={loading || !phrase.trim()}
        className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40"
      >
        {loading ? (
          <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Memvalidasi...</>
        ) : (
          <>Import Wallet <ArrowRight className="ml-2 h-5 w-5" /></>
        )}
      </Button>
    </motion.div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Dashboard — the AHA moment
// ────────────────────────────────────────────────────────────────────────────
const Dashboard = ({ onReset }) => {
  const wallet = useWalletStore((s) => s.wallet);
  const resetWallet = useWalletStore((s) => s.resetWallet);

  const [balances, setBalances] = useState({});
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);

  const address = wallet?.address;

  const load = async () => {
    if (!address) return;
    try {
      const [bal, priceRes] = await Promise.all([
        fetchAllBalances(address),
        fetch('/api/prices').then((r) => r.json()).catch(() => ({ prices: {} })),
      ]);
      setBalances(bal);
      setPrices(priceRes.prices || {});
    } catch (e) {
      toast.error('Gagal memuat data: ' + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const totalUsd = useMemo(() => {
    return CHAINS.reduce((sum, chain) => {
      const bal = parseFloat(balances[chain.id] || '0');
      const price = prices[chain.coinGeckoId]?.usd || 0;
      return sum + bal * price;
    }, 0);
  }, [balances, prices]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(address);
    toast.success('Alamat disalin.');
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined' && window.confirm('Yakin ingin keluar? Pastikan recovery phrase Anda sudah tersimpan!')) {
      resetWallet();
      onReset();
    }
  };

  if (!wallet) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-md px-5 py-6"
    >
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <Brand size={36} />
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={handleRefresh} className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleLogout} className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Portfolio card */}
      <Card className="relative overflow-hidden border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-400">Total Portfolio</span>
            <button onClick={() => setHideBalance(!hideBalance)} className="text-slate-400 hover:text-white">
              {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 text-4xl font-bold text-white">
            {loading ? (
              <Skeleton className="h-10 w-40 bg-slate-800" />
            ) : hideBalance ? (
              '••••••'
            ) : (
              <>
                <span className="text-slate-500">$</span>
                {totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleCopyAddress}
              className="group flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <WalletIcon className="h-3.5 w-3.5" />
              <span className="font-mono">{shortAddr(address)}</span>
              <Copy className="h-3 w-3 text-slate-500 group-hover:text-emerald-400" />
            </button>
            <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">EVM</Badge>
          </div>
        </div>
      </Card>

      {/* Assets header */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Aset di {CHAINS.length} Chain</h3>
        <span className="text-xs text-slate-500">Native tokens</span>
      </div>

      {/* Asset list */}
      <div className="space-y-2">
        {CHAINS.map((chain, idx) => (
          <ChainRow
            key={chain.id}
            chain={chain}
            balance={balances[chain.id]}
            price={prices[chain.coinGeckoId]?.usd}
            change24h={prices[chain.coinGeckoId]?.usd_24h_change}
            loading={loading}
            hidden={hideBalance}
            index={idx}
          />
        ))}
      </div>

      {/* Backup access */}
      <Card className="mt-6 border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Recovery Phrase</div>
            <div className="mt-0.5 text-xs text-slate-400">Cadangan wallet Anda. Simpan offline.</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPhrase(true)}
            className="border-slate-700 bg-slate-800/60 text-white hover:bg-slate-700"
          >
            Lihat
          </Button>
        </div>
      </Card>

      <div className="mt-6 pb-8 text-center text-[10px] uppercase tracking-widest text-slate-600">
        Kavach • Phase 1 MVP • Non-custodial
      </div>

      {showPhrase && (
        <RevealPhraseModal mnemonic={wallet.mnemonic} onClose={() => setShowPhrase(false)} />
      )}
    </motion.div>
  );
};

const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '');

const ChainRow = ({ chain, balance, price, change24h, loading, hidden, index }) => {
  const balNum = parseFloat(balance || '0');
  const usd = balNum * (price || 0);
  const balStr = balNum.toLocaleString('en-US', { maximumFractionDigits: 6 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="flex items-center gap-3 border-slate-800 bg-slate-900/60 p-3 hover:bg-slate-900">
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${chain.gradient} text-[10px] font-bold text-white shadow-md`}
        >
          {chain.logoText}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{chain.name}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span>{chain.symbol}</span>
            {price ? <span>· ${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span> : null}
            {typeof change24h === 'number' && (
              <span className={change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {loading ? (
            <>
              <Skeleton className="mb-1 h-4 w-16 bg-slate-800" />
              <Skeleton className="h-3 w-12 bg-slate-800" />
            </>
          ) : hidden ? (
            <>
              <div className="text-sm font-semibold text-white">••••</div>
              <div className="text-xs text-slate-500">••</div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-white">{balStr}</div>
              <div className="text-xs text-slate-500">${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

const RevealPhraseModal = ({ mnemonic, onClose }) => {
  const [revealed, setRevealed] = useState(false);
  const words = mnemonic.split(' ');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mnemonic);
    toast.success('Recovery phrase disalin.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-slate-800 bg-slate-950 p-6 sm:rounded-3xl"
      >
        <div className="mb-1 text-lg font-bold text-white">Recovery Phrase</div>
        <p className="mb-4 text-xs text-slate-400">
          Jangan pernah bagikan phrase ini. Siapa pun yang tahu 12 kata ini menguasai wallet Anda.
        </p>

        <div className="relative">
          {!revealed && (
            <button
              onClick={() => setRevealed(true)}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/95 backdrop-blur-sm"
            >
              <Eye className="h-6 w-6 text-emerald-400" />
              <span className="text-sm text-slate-200">Ketuk untuk mengungkap</span>
            </button>
          )}
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            {words.map((w, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/50 px-2.5 py-2">
                <span className="text-[10px] font-mono text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-sm font-medium text-white">{w}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={handleCopy} disabled={!revealed} className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
            <Copy className="mr-2 h-4 w-4" /> Salin
          </Button>
          <Button onClick={onClose} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400">
            Selesai
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default App;
