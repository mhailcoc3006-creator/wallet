'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, RefreshCw, TrendingUp, TrendingDown, Minus, Zap, AlertTriangle,
  Target, Shield as ShieldIcon, ChevronDown, X, Circle, Info, Search, LayoutList, LayoutGrid, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from './receive';
import { AutoTradeTab } from './autotrade';

const INTERVALS = ['15m', '1h', '4h', '1d'];

const SIGNAL_STYLES = {
  'Strong Buy': { bg: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-400/50', text: 'text-white', icon: TrendingUp },
  'Buy':        { bg: 'from-emerald-600 to-teal-700', ring: 'ring-emerald-400/40', text: 'text-white', icon: TrendingUp },
  'Hold':       { bg: 'from-slate-600 to-slate-700', ring: 'ring-slate-500/40', text: 'text-white', icon: Minus },
  'Sell':       { bg: 'from-orange-600 to-red-700', ring: 'ring-red-400/40', text: 'text-white', icon: TrendingDown },
  'Strong Sell':{ bg: 'from-red-500 to-rose-700', ring: 'ring-red-400/50', text: 'text-white', icon: TrendingDown },
};
const GRADE_COLOR = { 'A+': 'text-emerald-300 bg-emerald-500/20', 'A': 'text-emerald-300 bg-emerald-500/15', 'B+': 'text-cyan-300 bg-cyan-500/15', 'B': 'text-amber-300 bg-amber-500/15', 'C': 'text-slate-400 bg-slate-700/40' };
const RISK_COLOR = { 'Low': 'text-emerald-300', 'Medium': 'text-amber-300', 'High': 'text-orange-300', 'Very High': 'text-red-300', 'N/A': 'text-slate-500' };

const fmtPrice = (p) => (p == null ? '\u2014' : p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(4) : p.toFixed(6));

export const SignalTab = () => {
  const [mode, setMode] = useState('single'); // 'single' | 'scanner' | 'autotrade'
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalTF] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickSym, setPickSym] = useState(false);
  const [pairs, setPairs] = useState([]);

  // Scanner state
  const [scanData, setScanData] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanLimit, setScanLimit] = useState(15);
  const [scanFilter, setScanFilter] = useState('all'); // all | buy | sell

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/signal?symbol=${symbol}&interval=${interval}`);
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Signal error');
      setData(j);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const loadScan = async () => {
    setScanLoading(true);
    try {
      const res = await fetch(`/api/signal/scan?interval=${interval}&limit=${scanLimit}`);
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Scan error');
      setScanData(j);
    } catch (e) { toast.error(e.message); }
    setScanLoading(false);
  };

  // Fetch all pairs list on mount (for searchable picker)
  useEffect(() => {
    fetch('/api/signal/pairs').then((r) => r.json()).then((j) => setPairs(j.pairs || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'single') load();
    else loadScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, mode, scanLimit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      if (mode === 'single') load(true); else loadScan();
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, symbol, interval, mode, scanLimit]);

  const sty = data ? SIGNAL_STYLES[data.signal] : SIGNAL_STYLES['Hold'];
  const SignalIcon = sty.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/20 p-2">
              <Activity className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">AI Futures Signal</div>
              <div className="text-xs text-slate-400">{pairs.length > 0 ? `${pairs.length} USDT perpetuals` : 'OKX perpetual futures'}</div>
            </div>
          </div>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition ${autoRefresh ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-500'}`}>
            <Circle className={`h-2 w-2 fill-current ${autoRefresh ? 'text-emerald-400 animate-pulse' : ''}`} />
            AUTO
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mt-4 flex rounded-xl border border-slate-700 bg-slate-950/60 p-1">
          <button onClick={() => setMode('single')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${mode === 'single' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <LayoutGrid className="h-3.5 w-3.5" /> Single Pair
          </button>
          <button onClick={() => setMode('scanner')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${mode === 'scanner' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            <LayoutList className="h-3.5 w-3.5" /> Scanner
          </button>
          <button onClick={() => setMode('autotrade')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${mode === 'autotrade' ? 'bg-red-900/60 text-red-300' : 'text-slate-400 hover:text-white'}`}>
            <Zap className="h-3.5 w-3.5" /> Auto-Trade
          </button>
        </div>

        {/* Symbol & Interval (only in single mode) or interval only in scanner/autotrade */}
        <div className="mt-3 flex gap-2">
          {mode === 'single' && (
            <button onClick={() => setPickSym(true)} className="flex flex-1 items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-slate-500">Symbol</div>
                <div className="text-sm font-semibold text-white">{symbol}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
          )}
          {mode === 'scanner' && (
            <div className="flex flex-1 rounded-xl border border-slate-700 bg-slate-950/60 p-1">
              {[10, 15, 25].map((n) => (
                <button key={n} onClick={() => setScanLimit(n)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${scanLimit === n ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Top {n}
                </button>
              ))}
            </div>
          )}
          {mode === 'autotrade' && <div className="flex-1" />}
          <div className="flex rounded-xl border border-slate-700 bg-slate-950/60 p-1">
            {INTERVALS.map((tf) => (
              <button key={tf} onClick={() => setIntervalTF(tf)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${interval === tf ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                {tf}
              </button>
            ))}
          </div>
          <Button size="icon" variant="ghost" onClick={mode === 'single' ? () => load() : loadScan} className="h-11 w-11 rounded-xl border border-slate-700 bg-slate-950/60 text-slate-300 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${(loading || scanLoading) ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <div className="text-xs text-red-200">
              <div className="font-semibold">Could not load signals</div>
              <div>{error}</div>
            </div>
          </div>
        </Card>
      )}

      {mode === 'autotrade' ? (
        <AutoTradeTab interval={interval} />
      ) : mode === 'scanner' ? (
        <ScannerView
          data={scanData}
          loading={scanLoading}
          filter={scanFilter}
          setFilter={setScanFilter}
          onSelectSymbol={(sym) => { setSymbol(sym); setMode('single'); }}
        />
      ) : (
        <>
          {loading && !data && <SkeletonCard />}
          {data && <SingleView data={data} symbol={symbol} interval={interval} sty={sty} SignalIcon={SignalIcon} />}
        </>
      )}

      {pickSym && (
        <PairsPicker
          pairs={pairs}
          current={symbol}
          onPick={(s) => { setSymbol(s); setPickSym(false); }}
          onClose={() => setPickSym(false)}
        />
      )}
    </div>
  );
};

// Extracted single-pair view
const SingleView = ({ data, symbol, interval, sty, SignalIcon }) => (
  <>
    <Card className={`overflow-hidden border-0 bg-gradient-to-br ${sty.bg} p-5 ring-1 ${sty.ring}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/70">{symbol} \u2022 {interval}</div>
          <div className="mt-1 flex items-center gap-2">
            <SignalIcon className="h-6 w-6 text-white" />
            <div className="text-2xl font-bold text-white">{data.signal}</div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Badge className={`h-5 px-2 py-0 text-[10px] font-bold ${GRADE_COLOR[data.grade]}`}>Grade {data.grade}</Badge>
            <span className="text-xs text-white/80">Prob. {data.probability}%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-white/70">Confidence</div>
          <div className="mt-1 text-3xl font-bold text-white">{data.confidence}<span className="text-lg text-white/70">/100</span></div>
          <div className="mt-1 text-[10px] text-white/70">Risk: <span className="font-semibold">{data.risk}</span></div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-black/25 p-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-white/70">Entry</div>
          <div className="text-[10px] text-white/70">Leverage: {data.leverage}x</div>
        </div>
        <div className="mt-0.5 font-mono text-xl font-bold text-white">${fmtPrice(data.entry)}</div>
      </div>
    </Card>

    {data.side !== 'none' && (
      <div className="grid grid-cols-2 gap-2">
        <LevelCard label="TP1" value={data.tp1} entry={data.entry} side={data.side} type="tp" />
        <LevelCard label="TP2" value={data.tp2} entry={data.entry} side={data.side} type="tp" />
        <LevelCard label="TP3" value={data.tp3} entry={data.entry} side={data.side} type="tp" />
        <LevelCard label="Stop Loss" value={data.stop_loss} entry={data.entry} side={data.side} type="sl" />
        <LevelCard label="Break-even" value={data.break_even} entry={data.entry} side={data.side} type="be" small />
        <LevelCard label="Trailing" value={data.trailing_stop != null ? data.entry + (data.side === 'long' ? -data.trailing_stop : data.trailing_stop) : null} entry={data.entry} side={data.side} type="tr" small />
      </div>
    )}

    <div className="grid grid-cols-3 gap-2">
      <MetaCard label="R:R" value={data.risk_reward ? `1:${data.risk_reward}` : '\u2014'} icon={Target} />
      <MetaCard label="Prob." value={`${data.probability}%`} icon={Zap} />
      <MetaCard label="Size" value={data.position_size_pct ? `${data.position_size_pct}%` : '\u2014'} icon={ShieldIcon} />
    </div>

    <Card className="border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Score Breakdown</div>
        <div className="text-[10px] text-slate-500">Weighted Overall {data.scores.overall}/100</div>
      </div>
      <ScoreBar label="Trend" score={data.scores.trend} weight={20} />
      <ScoreBar label="Momentum" score={data.scores.momentum} weight={18} />
      <ScoreBar label="Volume" score={data.scores.volume} weight={12} />
      <ScoreBar label="Structure" score={data.scores.structure} weight={13} />
      <ScoreBar label="Futures" score={data.scores.futures} weight={12} />
      {data.scores.confluence != null && <ScoreBar label="Confluence" score={data.scores.confluence} weight={25} />}
    </Card>

    <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Data Points</div>
      <AnalysisRow k="Trend" v={`${data.analysis.trend.direction} (${data.analysis.trend.strength})`} extra={`ADX ${data.analysis.trend.adx ?? '\u2014'}`} />
      <AnalysisRow k="EMA 20 / 50 / 200" v={`${fmtPrice(data.analysis.trend.ema20)} / ${fmtPrice(data.analysis.trend.ema50)} / ${data.analysis.trend.ema200 != null ? fmtPrice(data.analysis.trend.ema200) : '\u2014'}`} />
      <AnalysisRow k="RSI (14)" v={data.analysis.momentum.rsi} />
      <AnalysisRow k="MACD Hist" v={data.analysis.momentum.macd_hist} />
      <AnalysisRow k="Stoch RSI (K/D)" v={`${data.analysis.momentum.stoch_k ?? '\u2014'} / ${data.analysis.momentum.stoch_d ?? '\u2014'}`} />
      <AnalysisRow k="Volume Spike" v={`${data.analysis.volume.spike_pct > 0 ? '+' : ''}${data.analysis.volume.spike_pct}%`} />
      <AnalysisRow k="Structure" v={buildStructureText(data.analysis.structure)} />
      <AnalysisRow k="Funding Rate" v={`${data.analysis.futures.funding_rate_pct}%`} />
      <AnalysisRow k="OI Change" v={`${data.analysis.futures.oi_change_pct > 0 ? '+' : ''}${data.analysis.futures.oi_change_pct}%`} />
      <AnalysisRow k="L/S Ratio" v={data.analysis.futures.long_short_ratio} />
      <AnalysisRow k="ATR" v={`${fmtPrice(data.analysis.volatility.atr)} (${data.analysis.volatility.atr_pct}%)`} />
      <AnalysisRow k="BB Width" v={`${data.analysis.volatility.bb_width ?? '\u2014'}%`} />
      {data.analysis.confluence && (
        <>
          <div className="mt-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Confluence Indicators</div>
          <AnalysisRow k="VWAP" v={data.analysis.confluence.vwap != null ? `$${fmtPrice(data.analysis.confluence.vwap)}` : '\u2014'} extra={data.analysis.confluence.vwap_signal} />
          <AnalysisRow k="OBV Trend" v={data.analysis.confluence.obv_trend} />
          <AnalysisRow k="CCI (20)" v={data.analysis.confluence.cci} />
          <AnalysisRow k="Williams %R" v={data.analysis.confluence.williams_r} />
          <AnalysisRow k="Ichimoku" v={data.analysis.confluence.ichimoku?.position} extra={data.analysis.confluence.ichimoku?.tk_cross} />
          <AnalysisRow k="Confluence" v={`${data.analysis.confluence.score}/100`} extra={`${data.analysis.confluence.bull_votes}B / ${data.analysis.confluence.bear_votes}S`} />
        </>
      )}
    </Card>

    <Card className="border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Info className="h-4 w-4 text-cyan-400" />
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">AI Explanation</div>
      </div>
      <ul className="space-y-1.5 text-xs leading-relaxed text-slate-300">
        {data.explanation.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-cyan-400" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </Card>

    <div className="pb-2 text-center text-[10px] uppercase tracking-widest text-slate-600">
      Not financial advice \u2022 Updated {new Date(data.last_updated).toLocaleTimeString('en-US')}
    </div>
  </>
);

const ScannerView = ({ data, loading, filter, setFilter, onSelectSymbol }) => {
  const rows = useMemo(() => {
    if (!data?.results) return [];
    if (filter === 'buy') return data.results.filter((r) => r.side === 'long');
    if (filter === 'sell') return data.results.filter((r) => r.side === 'short');
    return data.results;
  }, [data, filter]);

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        {[
          { k: 'all', label: 'Semua' },
          { k: 'buy', label: 'Long only' },
          { k: 'sell', label: 'Short only' },
        ].map((it) => (
          <button key={it.k} onClick={() => setFilter(it.k)} className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${filter === it.k ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
            {it.label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800" />)}
        </div>
      )}

      {rows.map((r, i) => (
        <motion.button
          key={r.symbol}
          onClick={() => onSelectSymbol(r.symbol)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.3) }}
          className="block w-full text-left"
        >
          <ScannerRow r={r} />
        </motion.button>
      ))}

      {rows.length === 0 && !loading && (
        <Card className="border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-500">
          No signals match this filter.
        </Card>
      )}

      {data && (
        <div className="pt-1 text-center text-[10px] uppercase tracking-widest text-slate-600">
           Scanned {data.count} pairs \u2022 updated {new Date(data.generated_at).toLocaleTimeString('en-US')}
        </div>
      )}
    </div>
  );
};

const ScannerRow = ({ r }) => {
  const sty = SIGNAL_STYLES[r.signal] || SIGNAL_STYLES['Hold'];
  const Icon = sty.icon;
  const changeCol = r.change24h >= 0 ? 'text-emerald-400' : 'text-red-400';
  const tradeable = r.side && r.side !== 'none';
  return (
    <Card className={`overflow-hidden border-slate-800 bg-slate-900/60 p-3 ${tradeable ? '' : 'opacity-70'} hover:bg-slate-900`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${sty.bg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white">{r.symbol}</span>
            <Badge className={`h-4 px-1.5 py-0 text-[9px] ${GRADE_COLOR[r.grade]}`}>{r.grade}</Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px]">
            <span className="text-slate-300">{r.signal}</span>
            <span className="text-slate-600">\u00b7</span>
            <span className="text-slate-500">Conf {r.confidence}</span>
            <span className="text-slate-600">\u00b7</span>
            <span className={changeCol}>{r.change24h >= 0 ? '+' : ''}{(r.change24h || 0).toFixed(2)}%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-white">${fmtPrice(r.entry)}</div>
          <div className="text-[9px] text-slate-500">Entry \u2022 {r.leverage}x</div>
        </div>
      </div>

      {tradeable && r.tp1 != null && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="rounded bg-emerald-500/10 px-2 py-1 text-center">
            <div className="text-[8px] uppercase tracking-widest text-emerald-400/70">TP1</div>
            <div className="font-mono text-[10px] font-semibold text-emerald-300">${fmtPrice(r.tp1)}</div>
          </div>
          <div className="rounded bg-emerald-500/10 px-2 py-1 text-center">
            <div className="text-[8px] uppercase tracking-widest text-emerald-400/70">TP2</div>
            <div className="font-mono text-[10px] font-semibold text-emerald-300">${fmtPrice(r.tp2)}</div>
          </div>
          <div className="rounded bg-red-500/10 px-2 py-1 text-center">
            <div className="text-[8px] uppercase tracking-widest text-red-400/70">Stop Loss</div>
            <div className="font-mono text-[10px] font-semibold text-red-300">${fmtPrice(r.stop_loss)}</div>
          </div>
        </div>
      )}
    </Card>
  );
};

const PairsPicker = ({ pairs, current, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return pairs.slice(0, 100); // limit for perf
    const query = q.toUpperCase();
    return pairs.filter((p) => p.symbol.includes(query) || p.base.includes(query)).slice(0, 200);
  }, [pairs, q]);
  return (
    <Sheet onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white">Select Symbol</div>
          <div className="text-xs text-slate-500">{pairs.length} USDT perpetuals available</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search BTC, ETH, PEPE..." autoFocus className="h-11 rounded-xl border-slate-700 bg-slate-900/70 pl-9 text-sm text-white placeholder:text-slate-500" />
      </div>
      <div className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto">
        {filtered.map((p) => (
          <button
            key={p.symbol}
            onClick={() => onPick(p.symbol)}
            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${current === p.symbol ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}
          >
            <div>
              <div className="text-sm font-semibold text-white">{p.symbol}</div>
              <div className="text-[10px] text-slate-500">Vol24h ${((p.vol24h_usd || 0) / 1e6).toFixed(1)}M</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs text-white">${fmtPrice(p.price)}</div>
              <div className={`text-[10px] ${p.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.change24h >= 0 ? '+' : ''}{(p.change24h || 0).toFixed(2)}%</div>
            </div>
          </button>
        ))}
        {q && filtered.length === 0 && <div className="py-6 text-center text-xs text-slate-500">No pair found for "{q}"</div>}
      </div>
    </Sheet>
  );
};


const LevelCard = ({ label, value, entry, side, type, small }) => {
  if (value == null) return null;
  const isTP = type === 'tp';
  const isSL = type === 'sl';
  const color = isTP ? 'text-emerald-300' : isSL ? 'text-red-300' : 'text-slate-300';
  const border = isTP ? 'border-emerald-500/20' : isSL ? 'border-red-500/20' : 'border-slate-700';
  const pct = entry ? ((value - entry) / entry) * 100 : 0;
  return (
    <div className={`rounded-xl border ${border} bg-slate-900/60 ${small ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
        <span>{label}</span>
        <span className={color}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</span>
      </div>
      <div className={`mt-0.5 font-mono ${small ? 'text-sm' : 'text-base'} font-bold ${color}`}>${fmtPrice(value)}</div>
    </div>
  );
};

const MetaCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
    <Icon className="mx-auto h-4 w-4 text-slate-500" />
    <div className="mt-1 text-sm font-bold text-white">{value}</div>
    <div className="text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
  </div>
);

const ScoreBar = ({ label, score, weight }) => {
  const color = score >= 70 ? 'from-emerald-500 to-teal-500' : score >= 45 ? 'from-cyan-500 to-blue-500' : score >= 30 ? 'from-amber-500 to-orange-500' : 'from-red-500 to-rose-600';
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{label} <span className="text-[10px] text-slate-500">({weight}%)</span></span>
        <span className="font-mono font-semibold text-white">{score}/100</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

const AnalysisRow = ({ k, v, extra }) => (
  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 text-xs last:border-0 last:pb-0">
    <span className="text-slate-400">{k}</span>
    <div className="text-right">
      <span className="font-mono text-white">{v ?? '\u2014'}</span>
      {extra && <span className="ml-2 text-[10px] text-slate-500">{extra}</span>}
    </div>
  </div>
);

const buildStructureText = (s) => {
  const parts = [];
  if (s.higher_high) parts.push('HH');
  if (s.higher_low) parts.push('HL');
  if (s.lower_high) parts.push('LH');
  if (s.lower_low) parts.push('LL');
  if (s.breakout) parts.push('Breakout');
  if (s.breakdown) parts.push('Breakdown');
  if (s.bos) parts.push(`BOS ${s.bos}`);
  if (s.choch) parts.push(`CHoCH ${s.choch}`);
  return parts.length ? parts.join(' \u00b7 ') : 'neutral';
};

const SkeletonCard = () => (
  <>
    <Card className="border-slate-800 bg-slate-900/60 p-5">
      <Skeleton className="h-6 w-40 bg-slate-800" />
      <Skeleton className="mt-2 h-8 w-32 bg-slate-800" />
      <Skeleton className="mt-4 h-14 w-full bg-slate-800" />
    </Card>
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 bg-slate-800" />)}
    </div>
  </>
);
