'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, RefreshCw, TrendingUp, TrendingDown, Minus, Zap, AlertTriangle,
  Target, Shield as ShieldIcon, ChevronDown, X, Circle, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from './receive';

const SYMBOLS = [
  { s: 'BTCUSDT', n: 'Bitcoin' },
  { s: 'ETHUSDT', n: 'Ethereum' },
  { s: 'SOLUSDT', n: 'Solana' },
  { s: 'BNBUSDT', n: 'BNB' },
  { s: 'XRPUSDT', n: 'XRP' },
  { s: 'DOGEUSDT', n: 'Dogecoin' },
  { s: 'AVAXUSDT', n: 'Avalanche' },
  { s: 'LINKUSDT', n: 'Chainlink' },
  { s: 'ARBUSDT', n: 'Arbitrum' },
  { s: 'OPUSDT', n: 'Optimism' },
  { s: 'MATICUSDT', n: 'Polygon' },
  { s: 'TRXUSDT', n: 'Tron' },
];
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
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalTF] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickSym, setPickSym] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/signal?symbol=${symbol}&interval=${interval}`);
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Signal error');
      setData(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, symbol, interval]);

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
              <div className="text-xs text-slate-400">OKX perpetual \u2022 Weighted multi-factor</div>
            </div>
          </div>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition ${autoRefresh ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-500'}`}>
            <Circle className={`h-2 w-2 fill-current ${autoRefresh ? 'text-emerald-400 animate-pulse' : ''}`} />
            AUTO
          </button>
        </div>

        {/* Symbol & Interval */}
        <div className="mt-4 flex gap-2">
          <button onClick={() => setPickSym(true)} className="flex flex-1 items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500">Symbol</div>
              <div className="text-sm font-semibold text-white">{symbol}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
          <div className="flex rounded-xl border border-slate-700 bg-slate-950/60 p-1">
            {INTERVALS.map((tf) => (
              <button key={tf} onClick={() => setIntervalTF(tf)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${interval === tf ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                {tf}
              </button>
            ))}
          </div>
          <Button size="icon" variant="ghost" onClick={() => load()} className="h-11 w-11 rounded-xl border border-slate-700 bg-slate-950/60 text-slate-300 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <div className="text-xs text-red-200">
              <div className="font-semibold">Gagal memuat sinyal</div>
              <div>{error}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Signal Card */}
      {loading && !data && <SkeletonCard />}

      {data && (
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
            {/* Entry */}
            <div className="mt-4 rounded-2xl bg-black/25 p-3 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-white/70">Entry</div>
                <div className="text-[10px] text-white/70">Leverage: {data.leverage}x</div>
              </div>
              <div className="mt-0.5 font-mono text-xl font-bold text-white">${fmtPrice(data.entry)}</div>
            </div>
          </Card>

          {/* TP / SL grid */}
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

          {/* Meta metrics */}
          <div className="grid grid-cols-3 gap-2">
            <MetaCard label="R:R" value={data.risk_reward ? `1:${data.risk_reward}` : '\u2014'} icon={Target} />
            <MetaCard label="Prob." value={`${data.probability}%`} icon={Zap} />
            <MetaCard label="Size" value={data.position_size_pct ? `${data.position_size_pct}%` : '\u2014'} icon={ShieldIcon} />
          </div>

          {/* Score breakdown */}
          <Card className="border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Score Breakdown</div>
              <div className="text-[10px] text-slate-500">Weighted Overall {data.scores.overall}/100</div>
            </div>
            <ScoreBar label="Trend" score={data.scores.trend} weight={30} />
            <ScoreBar label="Momentum" score={data.scores.momentum} weight={25} />
            <ScoreBar label="Volume" score={data.scores.volume} weight={15} />
            <ScoreBar label="Structure" score={data.scores.structure} weight={15} />
            <ScoreBar label="Futures" score={data.scores.futures} weight={15} />
          </Card>

          {/* Analysis details */}
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
          </Card>

          {/* AI Explanation */}
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
            Bukan saran keuangan \u2022 Update {new Date(data.last_updated).toLocaleTimeString('id-ID')}
          </div>
        </>
      )}

      {pickSym && (
        <Sheet onClose={() => setPickSym(false)}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-bold text-white">Pilih Symbol</div>
            <button onClick={() => setPickSym(false)} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
            {SYMBOLS.map((it) => (
              <button
                key={it.s}
                onClick={() => { setSymbol(it.s); setPickSym(false); }}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${symbol === it.s ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}
              >
                <div className="text-sm font-semibold text-white">{it.s}</div>
                <div className="text-[10px] text-slate-500">{it.n}</div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
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
