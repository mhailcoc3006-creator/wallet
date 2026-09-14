'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, TrendingUp, TrendingDown, Minus, Bot, Zap, Flame,
  Send, QrCode, Eye, EyeOff, ChevronRight, RefreshCw, Wallet,
  Circle, ArrowLeft, Trophy, DollarSign,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoTradeStore } from '@/lib/autotrade-store';
import { PortfolioTab } from './portfolio';
import { fmtUsd, shortAddr } from './shared';

const SIGNAL_STYLES = {
  'Strong Buy': { bg: 'from-emerald-500 to-teal-600', icon: TrendingUp, color: 'text-emerald-400' },
  'Buy':        { bg: 'from-emerald-600 to-teal-700', icon: TrendingUp, color: 'text-emerald-400' },
  'Hold':       { bg: 'from-slate-600 to-slate-700', icon: Minus, color: 'text-slate-400' },
  'Sell':       { bg: 'from-orange-600 to-red-700', icon: TrendingDown, color: 'text-red-400' },
  'Strong Sell':{ bg: 'from-red-500 to-rose-700', icon: TrendingDown, color: 'text-red-400' },
};
const GRADE_COLOR = { 'A+': 'bg-emerald-500/20 text-emerald-300', 'A': 'bg-emerald-500/15 text-emerald-300', 'B+': 'bg-cyan-500/15 text-cyan-300', 'B': 'bg-amber-500/15 text-amber-300', 'C': 'bg-slate-700/40 text-slate-400' };
const fmtPrice = (p) => (p == null ? '—' : p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(4) : p.toFixed(6));

export const DashboardTab = ({
  activeWallet, walletCount, addresses, balances, prices, loading, totalUsd, hidden, setHidden,
  onSend, onReceive, onOpenPhrase, onOpenWalletList, onOpenSignal,
}) => {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'portfolio'
  const [signals, setSignals] = useState([]);
  const [sigLoading, setSigLoading] = useState(true);
  const [sigError, setSigError] = useState('');

  const autoTrade = useAutoTradeStore();
  const atStats = useMemo(() => autoTrade.getStats(), [autoTrade.history, autoTrade.positions, autoTrade.equity]);

  // Fetch latest signals every 15s
  const fetchSignals = useCallback(async (silent = false) => {
    if (!silent) setSigLoading(true);
    setSigError('');
    try {
      const res = await fetch('/api/signal/scan?interval=1h&limit=8');
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Scan error');
      // Sort by confidence desc, take top 5 tradeable + a few holds
      const sorted = (j.results || []).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      setSignals(sorted.slice(0, 5));
    } catch (e) {
      setSigError(e.message);
    }
    setSigLoading(false);
  }, []);

  useEffect(() => {
    fetchSignals();
    const t = setInterval(() => fetchSignals(true), 15_000);
    return () => clearInterval(t);
  }, [fetchSignals]);

  // Full portfolio view
  if (view === 'portfolio') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
        <PortfolioTab
          activeWallet={activeWallet} walletCount={walletCount} addresses={addresses}
          balances={balances} prices={prices} loading={loading} totalUsd={totalUsd}
          hidden={hidden} setHidden={setHidden} onSend={onSend} onReceive={onReceive}
          onOpenPhrase={onOpenPhrase} onOpenWalletList={onOpenWalletList}
        />
      </div>
    );
  }

  const primaryAddress = addresses?.ethereum || activeWallet?.address;
  const isMayhem = autoTrade.config.mode === 'mayhem';

  return (
    <div className="space-y-4">
      {/* ─── Portfolio Summary ─── */}
      <Card className="relative overflow-hidden border-lime-400/15 bg-gradient-to-br from-[#101610] via-[#0b100c] to-[#172100] p-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-400">Total Balance</span>
            <button onClick={() => setHidden(!hidden)} className="text-slate-400 hover:text-white">
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1 text-3xl font-bold text-white">
            {loading ? <Skeleton className="h-9 w-36 bg-slate-800" /> : hidden ? '••••••' : (
              <span><span className="text-slate-500">$</span>{totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={onSend} disabled={!activeWallet} size="sm" className="h-9 rounded-lg bg-lime-400 text-slate-950 hover:bg-lime-300 disabled:opacity-40">
              <Send className="mr-1.5 h-3.5 w-3.5" /> Send
            </Button>
            <Button onClick={onReceive} disabled={!activeWallet} size="sm" variant="outline" className="h-9 rounded-lg border-slate-700 bg-slate-800/60 text-slate-100 hover:bg-slate-700 disabled:opacity-40">
              <QrCode className="mr-1.5 h-3.5 w-3.5" /> Receive
            </Button>
            <button onClick={() => setView('portfolio')} className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 hover:text-lime-300">
              All Assets <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </Card>

      {/* ─── Auto-Trade Bot Summary ─── */}
      <Card className={`overflow-hidden border-0 bg-gradient-to-br p-4 ${
        autoTrade.running
          ? isMayhem ? 'from-red-950 via-orange-950/50 to-slate-950 ring-1 ring-red-500/30'
                    : 'from-slate-900 via-slate-900 to-cyan-950 ring-1 ring-cyan-500/20'
          : 'from-slate-900 to-slate-950 border border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`rounded-xl p-2 ${autoTrade.running ? (isMayhem ? 'bg-red-500/20' : 'bg-cyan-500/20') : 'bg-slate-800'}`}>
              <Bot className={`h-5 w-5 ${autoTrade.running ? (isMayhem ? 'text-red-400' : 'text-cyan-400') : 'text-slate-500'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Auto-Trade Bot</span>
                {autoTrade.running && (
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    isMayhem ? 'bg-red-500/20 text-red-300' : 'bg-cyan-500/20 text-cyan-300'
                  }`}>
                    {isMayhem ? <span className="flex items-center gap-1"><Flame className="h-2.5 w-2.5" /> MAYHEM</span> : 'NORMAL'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                {autoTrade.running
                  ? `${atStats.openCount} open · Equity ${fmtUsd(atStats.totalEquity)}`
                  : 'Inactive — start from Signal → Auto-Trade'}
              </div>
            </div>
          </div>
          <button onClick={onOpenSignal} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] text-slate-300 hover:bg-slate-700">
            Manage
          </button>
        </div>

        {/* Bot stats row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <BotStat label="P&L" value={fmtUsd(atStats.totalPnl)} positive={atStats.totalPnl >= 0} />
          <BotStat label="Open P&L" value={fmtUsd(atStats.openPnl)} positive={atStats.openPnl >= 0} />
          <BotStat label="Win Rate" value={`${atStats.winRate.toFixed(0)}%`} positive={atStats.winRate >= 50} />
          <BotStat label="Trades" value={atStats.totalTrades} />
        </div>

        {/* Open positions preview */}
        {autoTrade.positions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Open Positions</div>
            {autoTrade.positions.slice(0, 3).map((p) => {
              const isLong = p.side === 'long';
              const pnlCol = p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5">
                  <span className={`text-[9px] font-bold uppercase ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>{isLong ? 'L' : 'S'}</span>
                  <span className="flex-1 text-xs font-semibold text-white">{p.symbol}</span>
                  <Badge className={`h-3.5 px-1 py-0 text-[8px] ${GRADE_COLOR[p.grade] || ''}`}>{p.grade}</Badge>
                  <span className={`font-mono text-xs font-bold ${pnlCol}`}>{p.pnl >= 0 ? '+' : ''}{fmtUsd(p.pnl)}</span>
                </div>
              );
            })}
            {autoTrade.positions.length > 3 && (
              <div className="text-center text-[10px] text-slate-500">+ {autoTrade.positions.length - 3} more</div>
            )}
          </div>
        )}

        {/* Recent trades */}
        {autoTrade.history.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Recent Trades</div>
            {autoTrade.history.slice(0, 2).map((t) => {
              const isWin = t.pnl > 0;
              return (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5">
                  <span className={`text-[9px] font-bold uppercase ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isWin ? 'WIN' : 'LOSS'}
                  </span>
                  <span className="flex-1 text-xs font-semibold text-white">{t.symbol}</span>
                  <span className="text-[9px] text-slate-500">{t.reason}</span>
                  <span className={`font-mono text-xs font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isWin ? '+' : ''}{fmtUsd(t.pnl)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ─── Latest Signals ─── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Live Signals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 animate-pulse fill-cyan-400 text-cyan-400" />
            <span className="text-[10px] text-slate-500">15s refresh</span>
          </div>
        </div>

        {sigLoading && signals.length === 0 ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 bg-slate-800" />)}
          </div>
        ) : sigError ? (
          <Card className="border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{sigError}</Card>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {signals.map((r, i) => {
                const sty = SIGNAL_STYLES[r.signal] || SIGNAL_STYLES['Hold'];
                const Icon = sty.icon;
                const isTradeable = r.side && r.side !== 'none';
                return (
                  <motion.button
                    key={r.symbol}
                    onClick={onOpenSignal}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.2) }}
                    className="block w-full text-left"
                  >
                    <Card className={`flex items-center gap-3 border-slate-800 bg-slate-900/60 p-3 hover:bg-slate-900 ${!isTradeable ? 'opacity-60' : ''}`}>
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${sty.bg}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white">{r.symbol}</span>
                          {r.grade && <Badge className={`h-4 px-1.5 py-0 text-[9px] ${GRADE_COLOR[r.grade] || ''}`}>{r.grade}</Badge>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                          <span className={sty.color}>{r.signal}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-500">Conf {r.confidence}</span>
                          {r.scores?.confluence != null && (
                            <span className="flex items-center gap-2"><span className="text-slate-600">·</span><span className="text-cyan-400/70">C {r.scores.confluence}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-white">${fmtPrice(r.entry)}</div>
                        {isTradeable && (
                          <div className="text-[9px] text-slate-500">{r.leverage}x · {r.change24h >= 0 ? '+' : ''}{(r.change24h || 0).toFixed(1)}%</div>
                        )}
                      </div>
                    </Card>
                  </motion.button>
                );
              })}
            </AnimatePresence>
            {signals.length === 0 && !sigLoading && (
              <Card className="border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-500">
                No signals available.
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Quick wallet switcher */}
      <button onClick={onOpenWalletList} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-left hover:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
            <Wallet className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="truncate text-sm font-semibold text-white">{activeWallet?.name || 'No wallet'}</div>
            <div className="text-[10px] text-slate-500">{walletCount} wallet{walletCount === 1 ? '' : 's'} · {primaryAddress ? shortAddr(primaryAddress, 6, 4) : ''}</div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-500" />
      </button>
    </div>
  );
};

const BotStat = ({ label, value, positive }) => (
  <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
    <div className={`text-xs font-bold ${positive == null ? 'text-white' : positive ? 'text-emerald-400' : 'text-red-400'}`}>{value}</div>
    <div className="text-[8px] uppercase tracking-widest text-slate-500">{label}</div>
  </div>
);
