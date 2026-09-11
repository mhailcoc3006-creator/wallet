import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Wallet, ArrowDownUp, Star, Fuel, RefreshCw, Settings2, Shuffle, Activity, Bell, X, TrendingUp, TrendingDown, Minus, Eye,
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

const KavachApp = () => {
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
  const [showAlerts, setShowAlerts] = useState(false);

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
      toast.error('Could not derive address: ' + e.message);
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
      if (!silent) toast.error('Could not load data.');
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

  // Signal Alerts poller — fetch top 15 pairs every 60s and detect new Grade A/A+
  useEffect(() => {
    if (!store.unlocked || !store.signalAlertsEnabled) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/signal/scan?interval=1h&limit=15');
        const j = await res.json();
        if (!alive || !j.results) return;
        for (const r of j.results) {
          if (!['A+', 'A'].includes(r.grade)) continue;
          if (r.side === 'none') continue;
          const added = useWalletStore.getState().addSignalAlert({
            symbol: r.symbol, interval: '1h', signal: r.signal, grade: r.grade,
            confidence: r.confidence, entry: r.entry, tp1: r.tp1, tp2: r.tp2,
            stop_loss: r.stop_loss, probability: r.probability,
          });
          if (added) {
            toast.success(`🚀 ${r.symbol} · ${r.signal} · Grade ${r.grade}`, {
              description: `Entry $${r.entry} • Conf ${r.confidence} • TP1 $${r.tp1}`,
              duration: 10000,
            });
            if (typeof window !== 'undefined' && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                try { new Notification(`Cavendish Signal · Grade ${r.grade}`, { body: `${r.symbol} ${r.signal} at $${r.entry}` }); } catch {}
              } else if (Notification.permission === 'default') {
                Notification.requestPermission().catch(() => {});
              }
            }
          }
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 60_000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.unlocked, store.signalAlertsEnabled]);

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
    <div className="min-h-screen bg-[#050806]">
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
                <Button size="icon" variant="ghost" onClick={() => loadData()} className="h-9 w-9 rounded-full text-slate-300 hover:bg-lime-400/10 hover:text-lime-300">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setShowAlerts(true)} className="relative h-9 w-9 rounded-full text-slate-300 hover:bg-lime-400/10 hover:text-lime-300">
                  <Bell className="h-4 w-4" />
                  {store.signalAlerts.filter((a) => !a.seen).length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-white">
                      {store.signalAlerts.filter((a) => !a.seen).length}
                    </span>
                  )}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setShowSettings(true)} className="h-9 w-9 rounded-full text-slate-300 hover:bg-lime-400/10 hover:text-lime-300">
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
            {showAlerts && (
              <SignalAlertsSheet
                onClose={() => { setShowAlerts(false); store.markAllSignalAlertsSeen(); }}
                onOpenSignal={() => { setTab('signal'); setShowAlerts(false); }}
              />
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
      <div className="mx-auto max-w-md border-t border-lime-400/15 bg-[#050806]/95 px-1 shadow-[0_-12px_30px_rgba(0,0,0,0.25)] backdrop-blur-md">
        <div className="grid grid-cols-6">
          {items.map((it) => {
            const active = tab === it.id;
            const Icon = it.icon;
            const isPS = it.id === 'padasankara';
            const isSig = it.id === 'signal';
            const activeColor = isPS ? 'text-fuchsia-400' : isSig ? 'text-cyan-400' : 'text-lime-300';
            const shadow = isPS ? 'drop-shadow-[0_0_8px_rgb(232,121,249)]' : isSig ? 'drop-shadow-[0_0_8px_rgb(34,211,238)]' : 'drop-shadow-[0_0_8px_rgb(215,255,0)]';
            return (
              <button
                key={it.id}
                onClick={() => setTab(it.id)}
                 className={`flex flex-col items-center gap-1 py-3 text-[9px] font-medium transition ${active ? activeColor : 'text-slate-500 hover:text-lime-200'}`}
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
  const copy = async () => { await navigator.clipboard.writeText(mnemonic); toast.success('Recovery phrase copied.'); };
  return (
    <Sheet onClose={onClose}>
      <div className="mb-1 text-lg font-bold text-white">Recovery Phrase</div>
      <p className="mb-4 text-xs text-slate-400">Never share this. Anyone who knows these words controls your wallet.</p>
      <div className="relative">
        {!revealed && (
          <button onClick={() => setRevealed(true)} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/95 backdrop-blur-sm">
            <Eye className="h-6 w-6 text-emerald-400" />
            <span className="text-sm text-slate-200">Tap to reveal</span>
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
        <Button variant="outline" onClick={copy} disabled={!revealed} className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">Copy</Button>
        <Button onClick={onClose} className="flex-1 bg-lime-400 text-slate-950 hover:bg-lime-300">Done</Button>
      </div>
    </Sheet>
  );
};

const SignalAlertsSheet = ({ onClose, onOpenSignal }) => {
  const alerts = useWalletStore((s) => s.signalAlerts);
  const clearSignalAlerts = useWalletStore((s) => s.clearSignalAlerts);
  const toggleEnabled = useWalletStore((s) => s.toggleSignalAlertsEnabled);
  const enabled = useWalletStore((s) => s.signalAlertsEnabled);
   const fmtTime = (ts) => new Date(ts).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const gradeColor = { 'A+': 'bg-emerald-500/20 text-emerald-300', 'A': 'bg-cyan-500/20 text-cyan-300' };
  return (
    <Sheet onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white">Signal Alerts</div>
          <div className="text-xs text-slate-400">{alerts.length} Grade A/A+ recorded</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Bell className="h-3.5 w-3.5 text-cyan-400" />
           <span>Auto-scan every 60 seconds</span>
        </div>
        <button onClick={toggleEnabled} className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{enabled ? 'ON' : 'OFF'}</button>
      </div>
      {alerts.length > 0 && (
        <div className="mb-2 flex justify-end">
           <button onClick={() => { if (window.confirm('Delete all alert history?')) clearSignalAlerts(); }} className="text-[11px] text-slate-500 hover:text-red-400">Delete history</button>
        </div>
      )}
      <div className="max-h-[55vh] space-y-2 overflow-y-auto">
        {alerts.length === 0 && (
           <div className="py-10 text-center text-xs text-slate-500">No Grade A/A+ alerts yet.<br />The poller monitors the top 15 pairs every 60s.</div>
        )}
        {alerts.map((a) => {
          const isBuy = a.signal && a.signal.includes('Buy');
          const Icon = isBuy ? TrendingUp : a.signal.includes('Sell') ? TrendingDown : Minus;
          return (
            <button key={a.id} onClick={onOpenSignal} className="block w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left hover:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{a.symbol}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${gradeColor[a.grade] || 'bg-slate-700 text-slate-300'}`}>{a.grade}</span>
                    {!a.seen && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">{a.signal} · Conf {a.confidence} · Prob {a.probability}% · {a.interval}</div>
                  <div className="text-[10px] text-slate-500">{fmtTime(a.timestamp)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-semibold text-white">${a.entry}</div>
                  <div className="text-[9px] text-emerald-400">TP1 ${a.tp1}</div>
                  <div className="text-[9px] text-red-400">SL ${a.stop_loss}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
};

export default KavachApp;
