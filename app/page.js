'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Wallet, ArrowDownUp, Star, Fuel, RefreshCw, Settings2, Shuffle, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

import { Brand } from '@/components/kavach/shared';
import {
  Splash, Welcome, CreateWallet, BackupPhrase, ImportWallet, SetupPassword,
} from '@/components/kavach/onboarding';
import { LockScreen } from '@/components/kavach/lock';
import { PortfolioTab } from '@/components/kavach/portfolio';
import { SwapTab } from '@/components/kavach/swap';
import { WatchlistTab } from '@/components/kavach/watchlist';
import { GasTab } from '@/components/kavach/gas';
import { PadaSankaraTab } from '@/components/kavach/padasankara';
import { SignalTab } from '@/components/kavach/signal';
import { SettingsSheet } from '@/components/kavach/settings';
import { WalletListSheet } from '@/components/kavach/wallet-list';
import { ReceiveSheet, Sheet } from '@/components/kavach/receive';
import { SendSheet } from '@/components/kavach/send';

import { useWalletStore, selectActiveWallet } from '@/lib/store';
import { hasVault, initVault, saveVaultData, defaultState } from '@/lib/vault';
import { deriveAllAddresses, fetchAllBalances } from '@/lib/wallet';
import { CHAINS } from '@/lib/chains';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

const App = () => {
  const store = useWalletStore();
  const activeWallet = selectActiveWallet(store);

  // View state: splash | welcome | create | backup | import | setup-password | lock | app
  const [view, setView] = useState('splash');
  const [pendingWallet, setPendingWallet] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const [tab, setTab] = useState('portfolio');
  const [addresses, setAddresses] = useState({});
  const [balances, setBalances] = useState({});
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState(false);

  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWalletList, setShowWalletList] = useState(false);

  // Splash → route to lock or welcome
  useEffect(() => {
    setHydrated(true);
    const t = setTimeout(() => {
      if (store.unlocked) setView('app');
      else if (hasVault()) setView('lock');
      else setView('welcome');
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save vault (debounced) on state changes while unlocked
  useEffect(() => {
    if (!store.unlocked || !store.vaultKey) return;
    let timer;
    const unsub = useWalletStore.subscribe((s, prev) => {
      // Save only if persistable state changed
      if (
        s.wallets === prev.wallets &&
        s.activeWalletId === prev.activeWalletId &&
        s.watchlist === prev.watchlist &&
        s.alerts === prev.alerts &&
        s.padasankara === prev.padasankara
      ) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const cur = useWalletStore.getState();
          await saveVaultData(
            {
              wallets: cur.wallets,
              activeWalletId: cur.activeWalletId,
              watchlist: cur.watchlist,
              alerts: cur.alerts,
              padasankara: cur.padasankara,
            },
            cur.vaultKey
          );
        } catch (e) {
          console.error('vault save failed', e);
        }
      }, 400);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [store.unlocked, store.vaultKey]);

  // Derive addresses for active wallet
  useEffect(() => {
    if (!activeWallet?.mnemonic) {
      setAddresses({});
      return;
    }
    try {
      setAddresses(deriveAllAddresses(activeWallet.mnemonic));
    } catch (e) {
      toast.error('Gagal derive alamat: ' + e.message);
    }
  }, [activeWallet?.mnemonic]);

  const loadData = async (silent = false) => {
    if (!Object.keys(addresses).length) return;
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const chainIds = CHAINS.map((c) => c.coinGeckoId);
      const watchIds = store.watchlist.map((w) => w.id);
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

  // Save portfolio USD to active wallet
  useEffect(() => {
    if (!activeWallet || loading || totalUsd === 0) return;
    if (Math.abs((activeWallet.portfolioUsd || 0) - totalUsd) < 0.01) return;
    store.updateWalletPortfolio(activeWallet.id, totalUsd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalUsd, loading]);

  // Onboarding flow completion
  const handleOnboardingComplete = async ({ userName, password }) => {
    if (!pendingWallet) throw new Error('No wallet');
    const initial = defaultState();
    const walletId = crypto.randomUUID();
    initial.wallets = [
      {
        id: walletId,
        name: 'Main Wallet',
        mnemonic: pendingWallet.mnemonic,
        address: pendingWallet.address,
        createdAt: Date.now(),
        source: pendingWallet.source || 'created',
        portfolioUsd: 0,
        portfolioUpdatedAt: 0,
      },
    ];
    initial.activeWalletId = walletId;
    const { key, state, meta } = await initVault({ userName, password, initialState: initial });
    useWalletStore.getState().hydrate({ state, key, meta });
    setPendingWallet(null);
    setView('app');
  };

  if (!hydrated || view === 'splash') return <Splash />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AnimatePresence mode="wait">
        {view === 'lock' && (
          <LockScreen
            key="lock"
            onUnlocked={() => setView('app')}
            onReset={() => setView('welcome')}
          />
        )}
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
            onGenerated={(w) => { setPendingWallet({ ...w, source: 'created' }); setView('backup'); }}
          />
        )}
        {view === 'backup' && pendingWallet && (
          <BackupPhrase
            key="backup"
            wallet={pendingWallet}
            onBack={() => setView('welcome')}
            onDone={() => setView('setup-password')}
          />
        )}
        {view === 'import' && (
          <ImportWallet
            key="import"
            onBack={() => setView('welcome')}
            onImported={(w) => { setPendingWallet({ ...w, source: 'imported' }); setView('setup-password'); }}
          />
        )}
        {view === 'setup-password' && (
          <SetupPassword
            key="setup"
            onBack={() => setView('welcome')}
            onDone={handleOnboardingComplete}
          />
        )}

        {view === 'app' && (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-md px-5 pb-24 pt-6">
            <div className="mb-5 flex items-center justify-between">
              <Brand size={36} />
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => loadData()} className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setShowSettings(true)} className="h-9 w-9 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                {tab === 'portfolio' && (
                  <PortfolioTab
                    activeWallet={activeWallet}
                    walletCount={store.wallets.length}
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
                    onOpenWalletList={() => setShowWalletList(true)}
                  />
                )}
                {tab === 'swap' && (
                  <SwapTab
                    mnemonic={activeWallet?.mnemonic}
                    addresses={addresses}
                    balances={balances}
                    prices={prices}
                  />
                )}
                {tab === 'signal' && <SignalTab />}
                {tab === 'padasankara' && <PadaSankaraTab />}
                {tab === 'watchlist' && <WatchlistTab />}
                {tab === 'gas' && <GasTab prices={prices} />}
              </motion.div>
            </AnimatePresence>

            <BottomNav tab={tab} setTab={setTab} />

            {showSend && (
              <SendSheet
                addresses={addresses}
                balances={balances}
                prices={prices}
                mnemonic={activeWallet?.mnemonic}
                onClose={() => { setShowSend(false); loadData(true); }}
              />
            )}
            {showReceive && (
              <ReceiveSheet addresses={addresses} onClose={() => setShowReceive(false)} />
            )}
            {showPhrase && (
              <RevealPhraseModal mnemonic={activeWallet?.mnemonic} onClose={() => setShowPhrase(false)} />
            )}
            {showWalletList && (
              <WalletListSheet prices={prices} onClose={() => setShowWalletList(false)} />
            )}
            {showSettings && (
              <SettingsSheet
                onClose={() => setShowSettings(false)}
                onWalletChanged={() => {
                  setAddresses({});
                  setBalances({});
                  setTab('portfolio');
                }}
                onLock={() => setView('lock')}
                onFullReset={() => {
                  setAddresses({}); setBalances({}); setPrices({});
                  setView('welcome');
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BottomNav = ({ tab, setTab }) => {
  const items = [
    { id: 'portfolio', label: 'Home', icon: Wallet },
    { id: 'signal', label: 'Signal', icon: Activity },
    { id: 'swap', label: 'Swap', icon: ArrowDownUp },
    { id: 'padasankara', label: 'Shuffle', icon: Shuffle },
    { id: 'watchlist', label: 'Watch', icon: Star },
    { id: 'gas', label: 'Gas', icon: Fuel },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-md border-t border-slate-800/70 bg-slate-950/95 px-1 backdrop-blur-md">
        <div className="grid grid-cols-6">
          {items.map((it) => {
            const active = tab === it.id;
            const Icon = it.icon;
            const isPS = it.id === 'padasankara';
            const isSig = it.id === 'signal';
            const activeColor = isPS ? 'text-fuchsia-400' : isSig ? 'text-cyan-400' : 'text-emerald-400';
            const shadow = isPS ? 'drop-shadow-[0_0_8px_rgb(232,121,249)]' : isSig ? 'drop-shadow-[0_0_8px_rgb(34,211,238)]' : 'drop-shadow-[0_0_8px_rgb(52,211,153)]';
            return (
              <button
                key={it.id}
                onClick={() => setTab(it.id)}
                className={`flex flex-col items-center gap-1 py-3 text-[9px] font-medium transition ${active ? activeColor : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icon className={`h-5 w-5 ${active ? shadow : ''}`} />
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
  const words = (mnemonic || '').split(' ');
  const copy = async () => { await navigator.clipboard.writeText(mnemonic); toast.success('Recovery phrase disalin.'); };
  return (
    <Sheet onClose={onClose}>
      <div className="mb-1 text-lg font-bold text-white">Recovery Phrase</div>
      <p className="mb-4 text-xs text-slate-400">Jangan bagikan. Siapa pun yang tahu kata-kata ini menguasai wallet Anda.</p>
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
