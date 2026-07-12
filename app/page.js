'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wallet, ArrowDownUp, Star, Fuel, LogOut, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Brand } from '@/components/kavach/shared';
import { Splash, Welcome, CreateWallet, BackupPhrase, ImportWallet } from '@/components/kavach/onboarding';
import { PortfolioTab } from '@/components/kavach/portfolio';
import { SwapTab } from '@/components/kavach/swap';
import { WatchlistTab } from '@/components/kavach/watchlist';
import { GasTab } from '@/components/kavach/gas';
import { ReceiveSheet, Sheet } from '@/components/kavach/receive';
import { SendSheet } from '@/components/kavach/send';

import { useWalletStore } from '@/lib/store';
import { deriveAllAddresses, fetchAllBalances } from '@/lib/wallet';
import { CHAINS } from '@/lib/chains';
import { Button } from '@/components/ui/button';

const App = () => {
  const wallet = useWalletStore((s) => s.wallet);
  const backupConfirmed = useWalletStore((s) => s.backupConfirmed);
  const resetWallet = useWalletStore((s) => s.resetWallet);
  const watchlist = useWalletStore((s) => s.watchlist);

  const [view, setView] = useState('splash'); // splash | welcome | create | backup | import | app
  const [pendingWallet, setPendingWallet] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // App state
  const [tab, setTab] = useState('portfolio');
  const [addresses, setAddresses] = useState({});
  const [balances, setBalances] = useState({});
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Modals
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const t = setTimeout(() => {
      if (wallet && backupConfirmed) setView('app');
      else setView('welcome');
    }, 1300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive addresses when wallet available
  useEffect(() => {
    if (!wallet?.mnemonic) return;
    try {
      const map = deriveAllAddresses(wallet.mnemonic);
      setAddresses(map);
    } catch (e) {
      toast.error('Gagal derive alamat: ' + e.message);
    }
  }, [wallet?.mnemonic]);

  const loadData = async (silent = false) => {
    if (!Object.keys(addresses).length) return;
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      // Merge chain ids + watchlist ids for prices
      const chainIds = CHAINS.map((c) => c.coinGeckoId);
      const watchIds = watchlist.map((w) => w.id);
      const allIds = Array.from(new Set([...chainIds, ...watchIds]));

      const [bal, priceRes] = await Promise.all([
        fetchAllBalances(addresses),
        fetch(`/api/prices?ids=${allIds.join(',')}`).then((r) => r.json()).catch(() => ({ prices: {} })),
      ]);
      setBalances(bal);
      setPrices(priceRes.prices || {});
    } catch (e) {
      if (!silent) toast.error('Gagal memuat data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (view === 'app' && Object.keys(addresses).length) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, addresses]);

  const totalUsd = useMemo(() => {
    return CHAINS.reduce((sum, chain) => {
      const bal = parseFloat(balances[chain.id] || '0');
      const price = prices[chain.coinGeckoId]?.usd || 0;
      return sum + bal * price;
    }, 0);
  }, [balances, prices]);

  const handleLogout = () => {
    if (typeof window !== 'undefined' && window.confirm('Yakin ingin keluar? Pastikan recovery phrase Anda sudah tersimpan!')) {
      resetWallet();
      setView('welcome');
      setAddresses({}); setBalances({}); setPrices({});
    }
  };

  if (!hydrated || view === 'splash') return <Splash />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AnimatePresence mode="wait">
        {view === 'welcome' && <Welcome key="welcome" onCreate={() => setView('create')} onImport={() => setView('import')} />}
        {view === 'create' && (
          <CreateWallet key="create" onBack={() => setView('welcome')} onGenerated={(w) => { setPendingWallet(w); setView('backup'); }} />
        )}
        {view === 'backup' && pendingWallet && (
          <BackupPhrase key="backup" wallet={pendingWallet} onDone={() => { setPendingWallet(null); setView('app'); }} onBack={() => setView('welcome')} />
        )}
        {view === 'import' && <ImportWallet key="import" onBack={() => setView('welcome')} onImported={() => setView('app')} />}

        {view === 'app' && (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-md px-5 pb-24 pt-6">
            {/* Top bar */}
            <div className="mb-5 flex items-center justify-between">
              <Brand size={36} />
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => loadData()} className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleLogout} className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                {tab === 'portfolio' && (
                  <PortfolioTab
                    addresses={addresses}
                    balances={balances}
                    prices={prices}
                    loading={loading}
                    totalUsd={totalUsd}
                    hidden={hidden}
                    setHidden={setHidden}
                    onSend={() => setShowSend(true)}
                    onReceive={() => setShowReceive(true)}
                    onOpenPhrase={() => setShowPhrase(true)}
                  />
                )}
                {tab === 'swap' && <SwapTab mnemonic={wallet?.mnemonic} addresses={addresses} balances={balances} prices={prices} />}
                {tab === 'watchlist' && <WatchlistTab />}
                {tab === 'gas' && <GasTab prices={prices} />}
              </motion.div>
            </AnimatePresence>

            {/* Bottom nav */}
            <BottomNav tab={tab} setTab={setTab} />

            {/* Modals */}
            {showSend && (
              <SendSheet
                addresses={addresses}
                balances={balances}
                prices={prices}
                mnemonic={wallet?.mnemonic}
                onClose={() => { setShowSend(false); loadData(true); }}
              />
            )}
            {showReceive && (
              <ReceiveSheet addresses={addresses} onClose={() => setShowReceive(false)} />
            )}
            {showPhrase && (
              <RevealPhraseModal mnemonic={wallet?.mnemonic} onClose={() => setShowPhrase(false)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BottomNav = ({ tab, setTab }) => {
  const items = [
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'swap', label: 'Swap', icon: ArrowDownUp },
    { id: 'watchlist', label: 'Watchlist', icon: Star },
    { id: 'gas', label: 'Gas', icon: Fuel },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-md border-t border-slate-800/70 bg-slate-950/95 px-2 backdrop-blur-md">
        <div className="grid grid-cols-4">
          {items.map((it) => {
            const active = tab === it.id;
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                onClick={() => setTab(it.id)}
                className={`flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition ${active ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icon className={`h-5 w-5 ${active ? 'drop-shadow-[0_0_8px_rgb(52,211,153)]' : ''}`} />
                <span className="uppercase tracking-wider">{it.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RevealPhraseModal = ({ mnemonic, onClose }) => {
  const [revealed, setRevealed] = useState(false);
  const words = mnemonic?.split(' ') || [];
  const copy = async () => { await navigator.clipboard.writeText(mnemonic); toast.success('Recovery phrase disalin.'); };
  return (
    <Sheet onClose={onClose}>
      <div className="mb-1 text-lg font-bold text-white">Recovery Phrase</div>
      <p className="mb-4 text-xs text-slate-400">Jangan pernah bagikan. Siapa pun yang tahu 12 kata ini menguasai wallet Anda.</p>
      <div className="relative">
        {!revealed && (
          <button onClick={() => setRevealed(true)} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/95 backdrop-blur-sm">
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
        <Button variant="outline" onClick={copy} disabled={!revealed} className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">Salin</Button>
        <Button onClick={onClose} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400">Selesai</Button>
      </div>
    </Sheet>
  );
};

export default App;
