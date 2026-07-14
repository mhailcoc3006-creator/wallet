'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Trash2, Bell, BellRing, X, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWalletStore } from '@/lib/store';
import { fmtUsd } from './shared';
import { Sheet } from './receive';

export const WatchlistTab = () => {
  const watchlist = useWalletStore((s) => s.watchlist);
  const removeFromWatchlist = useWalletStore((s) => s.removeFromWatchlist);
  const alerts = useWalletStore((s) => s.alerts);

  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertFor, setAlertFor] = useState(null);

  const ids = watchlist.map((c) => c.id);

  const load = async () => {
    if (!ids.length) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/prices?ids=${ids.join(',')}`);
      const j = await res.json();
      setPrices(j.prices || {});
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [ids.join(',')]);

  // Price alert checker
  useEffect(() => {
    const s = useWalletStore.getState();
    for (const a of alerts) {
      if (a.triggered) continue;
      const cur = prices[a.coinGeckoId]?.usd;
      if (cur == null) continue;
      const hit = (a.direction === 'above' && cur >= a.threshold) || (a.direction === 'below' && cur <= a.threshold);
      if (hit) {
        s.markAlertTriggered(a.id);
        toast.success(`🔔 ${a.symbol} ${a.direction === 'above' ? 'naik ke' : 'turun ke'} ${fmtUsd(cur)} (target ${fmtUsd(a.threshold)})`, { duration: 10000 });
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('Kavach — Price Alert', { body: `${a.symbol} ${a.direction === 'above' ? '>=' : '<='} ${fmtUsd(a.threshold)} • sekarang ${fmtUsd(cur)}` }); } catch {}
        }
      }
    }
  }, [prices, alerts]);

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Watchlist</div>
            <div className="text-xs text-slate-400">Pantau harga token favorit Anda</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAlerts(true)} className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
              <Bell className="mr-1.5 h-3.5 w-3.5" /> {alerts.length}
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)} className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Token
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {watchlist.length === 0 && (
          <Card className="border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            Watchlist kosong. Tambahkan token untuk mulai melacak harga.
          </Card>
        )}
        {watchlist.map((coin, i) => {
          const p = prices[coin.id];
          return (
            <motion.div key={coin.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="flex items-center gap-3 border-slate-800 bg-slate-900/60 p-3">
                {coin.image ? (
                  <img src={coin.image} alt={coin.symbol} width={36} height={36} className="h-9 w-9 rounded-full bg-slate-800" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-300">{coin.symbol.slice(0, 2)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{coin.name}</div>
                  <div className="text-xs text-slate-400">{coin.symbol}</div>
                </div>
                <div className="text-right">
                  {loading || !p ? (
                    <><Skeleton className="mb-1 h-4 w-16 bg-slate-800" /><Skeleton className="h-3 w-12 bg-slate-800" /></>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-white">{fmtUsd(p.usd)}</div>
                      <div className={`flex items-center justify-end gap-0.5 text-xs ${p.usd_24h_change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p.usd_24h_change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {(p.usd_24h_change ?? 0).toFixed(2)}%
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setAlertFor(coin)} className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-emerald-400" title="Set price alert">
                    <BellRing className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => removeFromWatchlist(coin.id)} className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {showAdd && <AddTokenSheet onClose={() => setShowAdd(false)} />}
      {showAlerts && <AlertsSheet onClose={() => setShowAlerts(false)} prices={prices} />}
      {alertFor && <NewAlertSheet coin={alertFor} currentPrice={prices[alertFor.id]?.usd} onClose={() => setAlertFor(null)} />}
    </div>
  );
};

const AddTokenSheet = ({ onClose }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const addToWatchlist = useWalletStore((s) => s.addToWatchlist);
  const watchlist = useWalletStore((s) => s.watchlist);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/coins/search?q=${encodeURIComponent(q)}`);
        const j = await res.json();
        setResults(j.coins || []);
      } catch {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const inList = (id) => watchlist.some((c) => c.id === id);

  return (
    <Sheet onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-lg font-bold text-white">Tambah Token</div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau simbol..." autoFocus className="h-11 rounded-xl border-slate-700 bg-slate-900/70 pl-9 text-sm text-white placeholder:text-slate-500" />
      </div>
      <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
        {loading && <div className="py-4 text-center text-xs text-slate-500">Mencari...</div>}
        {!loading && q.length >= 2 && results.length === 0 && <div className="py-4 text-center text-xs text-slate-500">Tidak ada hasil.</div>}
        {results.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              addToWatchlist({ id: c.id, symbol: c.symbol, name: c.name, image: c.image });
              toast.success(`${c.symbol} ditambahkan ke watchlist.`);
              onClose();
            }}
            disabled={inList(c.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left transition hover:bg-slate-900 disabled:opacity-40"
          >
            {c.image && <img src={c.image} alt={c.symbol} className="h-8 w-8 rounded-full bg-slate-800" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{c.name}</div>
              <div className="text-xs text-slate-500">{c.symbol}{c.marketCapRank ? ` • #${c.marketCapRank}` : ''}</div>
            </div>
            {inList(c.id) ? <span className="text-xs text-emerald-400">Ada</span> : <Plus className="h-4 w-4 text-emerald-400" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
};

const NewAlertSheet = ({ coin, currentPrice, onClose }) => {
  const [threshold, setThreshold] = useState('');
  const [direction, setDirection] = useState('above');
  const addAlert = useWalletStore((s) => s.addAlert);

  const submit = async () => {
    const t = parseFloat(threshold);
    if (!t || t <= 0) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    addAlert({ coinGeckoId: coin.id, symbol: coin.symbol, threshold: t, direction });
    toast.success(`Alert aktif: ${coin.symbol} ${direction === 'above' ? '≥' : '≤'} ${fmtUsd(t)}`);
    onClose();
  };

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white">Price Alert</div>
          <div className="text-xs text-slate-400">Notifikasi saat harga {coin.symbol} tercapai</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>

      {currentPrice && <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">Harga saat ini: <span className="font-bold text-white">{fmtUsd(currentPrice)}</span></div>}

      <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Kondisi</div>
      <div className="grid grid-cols-2 gap-2">
        {['above', 'below'].map((d) => (
          <button key={d} onClick={() => setDirection(d)} className={`rounded-xl border p-3 text-sm font-medium transition ${direction === d ? 'border-emerald-500/60 bg-emerald-500/10 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'}`}>
            {d === 'above' ? 'Naik di atas' : 'Turun di bawah'}
          </button>
        ))}
      </div>

      <div className="mt-4 mb-2 text-xs uppercase tracking-widest text-slate-500">Target Harga (USD)</div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
        <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="0.00" className="h-14 rounded-xl border-slate-700 bg-slate-900/70 pl-8 text-lg font-semibold text-white placeholder:text-slate-600" />
      </div>

      <Button onClick={submit} disabled={!parseFloat(threshold)} className="mt-5 h-13 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-base font-semibold text-white hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40">Aktifkan Alert</Button>
    </Sheet>
  );
};

const AlertsSheet = ({ onClose, prices }) => {
  const alerts = useWalletStore((s) => s.alerts);
  const removeAlert = useWalletStore((s) => s.removeAlert);
  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white">Price Alerts</div>
          <div className="text-xs text-slate-400">{alerts.length} alert aktif</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-2">
        {alerts.length === 0 && <div className="py-6 text-center text-sm text-slate-500">Belum ada alert. Ketuk ikon lonceng pada token untuk membuat alert.</div>}
        {alerts.map((a) => {
          const cur = prices[a.coinGeckoId]?.usd;
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className={`rounded-full p-2 ${a.triggered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{a.symbol} {a.direction === 'above' ? '≥' : '≤'} {fmtUsd(a.threshold)}</div>
                <div className="text-xs text-slate-500">{a.triggered ? 'Tercapai' : 'Menunggu'} {cur != null && `• sekarang ${fmtUsd(cur)}`}</div>
              </div>
              <button onClick={() => removeAlert(a.id)} className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
};
