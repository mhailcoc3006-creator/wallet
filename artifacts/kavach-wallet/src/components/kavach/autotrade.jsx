'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Zap, Square, Play, TrendingUp, TrendingDown, Activity, Settings2,
  X, ChevronDown, Trophy, AlertTriangle, Flame, Gauge, Target, DollarSign,
  KeyRound, Link2, Unlink, Loader2, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoTradeStore } from '@/lib/autotrade-store';

const GRADE_COLOR = { 'A+': 'text-emerald-300 bg-emerald-500/20', 'A': 'text-emerald-300 bg-emerald-500/15', 'B+': 'text-cyan-300 bg-cyan-500/15', 'B': 'text-amber-300 bg-amber-500/15', 'C': 'text-slate-400 bg-slate-700/40' };
const fmtPrice = (p) => (p == null ? '—' : p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(4) : p.toFixed(6));
const fmtUsd = (v) => (v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export const AutoTradeTab = ({ interval = '1h' }) => {
  const store = useAutoTradeStore();
  const { running, config, positions, history, creds, connected, connecting, connectError } = store;
  const [showConfig, setShowConfig] = useState(false);
  const [showCreds, setShowCreds] = useState(!creds);
  const [scanning, setScanning] = useState(false);
  const stats = useMemo(() => store.getStats(), [store.history, store.positions, store.equity, store.availableBalance]);

  // Scan loop — fetch signals and process
  useEffect(() => {
    if (!running || !connected) return;
    let alive = true;

    const scan = async () => {
      setScanning(true);
      try {
        const res = await fetch(`/api/signal/scan?interval=${interval}&limit=25`);
        const j = await res.json();
        if (!alive || !j.results) return;
        // Check exits first (close positions that hit SL/TP)
        await store.checkExits(j.results);
        // Process new signals (open new positions)
        await store.processSignals(j.results, interval);
        // Refresh real account data
        await store.refreshAccount();
      } catch (e) {
        console.error('autotrade scan error', e);
      }
      setScanning(false);
    };

    scan();
    const sec = config.scanIntervalSec || 30;
    const t = setInterval(scan, sec * 1000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, connected, interval, config.scanIntervalSec, config.mode]);

  const handleToggle = () => {
    if (!connected) { setShowCreds(true); return; }
    if (running) {
      store.stop();
      toast.info('Auto-trade bot stopped.');
    } else {
      store.start();
      toast.success(`🤖 Auto-trade bot started — ${config.mode === 'mayhem' ? 'MAYHEM' : 'Normal'} mode! Real orders will be placed.`);
    }
  };

  const handleModeSwitch = (mode) => {
    store.setMode(mode);
    toast.info(`Switched to ${mode === 'mayhem' ? 'MAYHEM 🔥' : 'Normal'} mode.`);
  };

  return (
    <div className="space-y-4">
      {/* Connection warning */}
      {!connected && !showCreds && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-3">
          <button onClick={() => setShowCreds(true)} className="flex w-full items-center gap-2 text-left">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 text-amber-400" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-amber-300">Not connected to OKX</div>
              <div className="text-[10px] text-amber-400/70">Tap to enter your API credentials</div>
            </div>
            <ChevronDown className="h-4 w-4 text-amber-400" />
          </button>
        </Card>
      )}

      {/* Credential form */}
      {showCreds && (
        <CredentialForm
          store={store}
          existingCreds={creds}
          connectError={connectError}
          connecting={connecting}
          onConnected={() => setShowCreds(false)}
          onClose={() => setShowCreds(false)}
        />
      )}

      {/* Header */}
      <Card className={`border-0 bg-gradient-to-br p-4 ${running ? (config.mode === 'mayhem' ? 'from-red-950 via-orange-950 to-slate-950 ring-1 ring-red-500/40' : 'from-slate-900 via-slate-900 to-cyan-950 ring-1 ring-cyan-500/30') : 'from-slate-900 via-slate-900 to-slate-950'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${running ? (config.mode === 'mayhem' ? 'bg-red-500/20' : 'bg-cyan-500/20') : 'bg-slate-800'}`}>
              <Bot className={`h-5 w-5 ${running ? (config.mode === 'mayhem' ? 'text-red-400' : 'text-cyan-400') : 'text-slate-500'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-white">Auto-Trade Bot</div>
                {connected && <Badge className="h-4 px-1.5 py-0 text-[8px] bg-emerald-500/20 text-emerald-300">LIVE</Badge>}
                {creds?.demo && <Badge className="h-4 px-1.5 py-0 text-[8px] bg-amber-500/20 text-amber-300">DEMO</Badge>}
              </div>
              <div className="text-xs text-slate-400">
                {running ? (scanning ? 'Scanning & placing orders...' : `Monitoring • ${positions.length} open`) : connected ? 'Stopped' : 'Not connected'}
              </div>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={!connected}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
              running
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {running ? <><Square className="h-3 w-3" /> Stop</> : <><Play className="h-3 w-3" /> Start</>}
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mt-3 flex rounded-xl border border-slate-700 bg-slate-950/60 p-1">
          <button
            onClick={() => handleModeSwitch('normal')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${config.mode === 'normal' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Gauge className="h-3.5 w-3.5" /> Normal
          </button>
          <button
            onClick={() => handleModeSwitch('mayhem')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${config.mode === 'mayhem' ? 'bg-red-900/60 text-red-300' : 'text-slate-400 hover:text-white'}`}
          >
            <Flame className="h-3.5 w-3.5" /> Mayhem
          </button>
        </div>

        {config.mode === 'mayhem' && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300">
            <Flame className="h-3 w-3" />
            <span>Mayhem: Grade {config.minGrade}+, max {config.maxPositions} pos, {config.riskPerTradePct}% risk, {config.leverage}x lev, {config.scanIntervalSec}s scan</span>
          </div>
        )}
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Equity" value={fmtUsd(stats.totalEquity)} sub={`ROI ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`} positive={stats.roi >= 0} icon={DollarSign} />
        <StatCard label="Open P&L" value={fmtUsd(stats.openPnl)} sub={`${stats.openCount} positions`} positive={stats.openPnl >= 0} icon={Activity} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.wins}W / ${stats.losses}L`} positive={stats.winRate >= 50} icon={Target} />
        <StatCard label="Total Trades" value={stats.totalTrades} sub={`Best: ${stats.bestTrade ? fmtUsd(stats.bestTrade.pnl) : '—'}`} icon={Trophy} />
      </div>

      {/* Config & connection buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowConfig(true)}
          className="flex flex-1 items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-left"
        >
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Settings2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Bot Configuration</span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </button>
        {connected && (
          <button
            onClick={() => setShowCreds(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-slate-300"
          >
            <KeyRound className="h-3.5 w-3.5 text-slate-500" />
            <span>API Keys</span>
          </button>
        )}
      </div>

      {/* Open Positions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Open Positions</div>
          <div className="text-[10px] text-slate-500">{positions.length} / {config.maxPositions}</div>
        </div>
        {positions.length === 0 ? (
          <Card className="border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-500">
            {running ? 'Waiting for signals...' : connected ? 'Start the bot to begin trading.' : 'Connect your OKX API to begin.'}
          </Card>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {positions.map((p) => (
                <PositionCard key={p.id || p.instId + p.side} pos={p} onClose={() => store.closePosition(p.instId, p.side)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Trade History */}
      {history.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Trade History</div>
            <button onClick={() => { if (window.confirm('Reset trade history?')) store.reset(); }} className="text-[10px] text-slate-500 hover:text-red-400">Reset</button>
          </div>
          <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
            {history.slice(0, 30).map((t) => (
              <HistoryRow key={t.id} trade={t} />
            ))}
          </div>
        </div>
      )}

      {/* Config Sheet */}
      {showConfig && (
        <ConfigSheet
          config={config}
          onUpdate={(patch) => store.updateConfig(patch)}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
};

// ── Credential Form ──

const CredentialForm = ({ store, existingCreds, connectError, connecting, onConnected, onClose }) => {
  const [apiKey, setApiKey] = useState(existingCreds?.apiKey || '');
  const [secretKey, setSecretKey] = useState(existingCreds?.secretKey || '');
  const [passphrase, setPassphrase] = useState(existingCreds?.passphrase || '');
  const [demo, setDemo] = useState(existingCreds?.demo ?? true);

  const handleConnect = async () => {
    if (!apiKey || !secretKey || !passphrase) {
      toast.error('All fields are required.');
      return;
    }
    store.setCredentials({ apiKey, secretKey, passphrase, demo });
    const ok = await store.connect();
    if (ok) {
      toast.success('Connected to OKX! Real trading enabled.');
      onConnected();
    } else {
      toast.error('Connection failed. Check your credentials.');
    }
  };

  const handleDisconnect = () => {
    store.clearCredentials();
    setApiKey(''); setSecretKey(''); setPassphrase('');
    toast.info('Disconnected from OKX.');
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-cyan-400" />
          <div className="text-sm font-bold text-white">OKX API Credentials</div>
        </div>
        {existingCreds && <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>}
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">API Key</div>
          <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Your OKX API Key" className="h-10 rounded-lg border-slate-700 bg-slate-950/60 text-sm text-white" />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Secret Key</div>
          <Input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="Your OKX Secret Key" className="h-10 rounded-lg border-slate-700 bg-slate-950/60 text-sm text-white" />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Passphrase</div>
          <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Your OKX Passphrase" className="h-10 rounded-lg border-slate-700 bg-slate-950/60 text-sm text-white" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
          <div>
            <div className="text-xs text-slate-300">Demo Trading Mode</div>
            <div className="text-[10px] text-slate-500">Practice with simulated funds</div>
          </div>
          <button onClick={() => setDemo(!demo)} className={`rounded-full px-3 py-1 text-[10px] font-bold ${demo ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
            {demo ? 'DEMO' : 'LIVE'}
          </button>
        </div>
      </div>

      {connectError && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          {connectError}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button onClick={handleConnect} disabled={connecting} className="flex-1 bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50">
          {connecting ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Connecting...</> : <><Link2 className="mr-1.5 h-3.5 w-3.5" /> Connect</>}
        </Button>
        {existingCreds && (
          <Button onClick={handleDisconnect} variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-slate-800/40 px-3 py-2 text-[10px] text-slate-400">
        <ShieldAlert className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
        <div>
          Create API keys at OKX → Profile → API Management. Enable <strong>Trade</strong> permission, disable <strong>Withdrawal</strong>. Credentials stored locally in your browser only.
        </div>
      </div>
    </Card>
  );
};

const StatCard = ({ label, value, sub, positive, icon: Icon }) => (
  <Card className="border-slate-800 bg-slate-900/60 p-3">
    <div className="flex items-center justify-between">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <span className="text-[9px] uppercase tracking-widest text-slate-500">{label}</span>
    </div>
    <div className={`mt-1 text-lg font-bold ${positive == null ? 'text-white' : positive ? 'text-emerald-400' : 'text-red-400'}`}>{value}</div>
    <div className="text-[10px] text-slate-500">{sub}</div>
  </Card>
);

const PositionCard = ({ pos, onClose }) => {
  const isLong = pos.side === 'long';
  const pnlColor = pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pnlBg = pos.pnl >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5';
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
      <Card className={`overflow-hidden border-slate-800 bg-slate-900/60 p-3 ${pnlBg}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isLong ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
            {isLong ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{pos.symbol}</span>
              <span className={`text-[9px] font-bold uppercase ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>{pos.side}</span>
              {pos.leverage && <span className="text-[9px] text-slate-500">{pos.leverage}x</span>}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
              <span>Entry ${fmtPrice(pos.entry)}</span>
              <span>·</span>
              <span>Mark ${fmtPrice(pos.currentPrice)}</span>
              {pos.liqPrice && <><span>·</span><span className="text-red-400/70">Liq ${fmtPrice(pos.liqPrice)}</span></>}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-sm font-bold ${pnlColor}`}>{pos.pnl >= 0 ? '+' : ''}{fmtUsd(pos.pnl)}</div>
            <div className={`text-[10px] ${pnlColor}`}>{pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 grid grid-cols-3 gap-1 text-center">
            <div className="rounded bg-slate-800/40 px-1 py-0.5">
              <div className="text-[8px] text-slate-500">Size</div>
              <div className="font-mono text-[9px] text-slate-300">{pos.size}</div>
            </div>
            <div className="rounded bg-slate-800/40 px-1 py-0.5">
              <div className="text-[8px] text-slate-500">Margin</div>
              <div className="font-mono text-[9px] text-slate-300">{fmtUsd(pos.margin)}</div>
            </div>
            <div className="rounded bg-slate-800/40 px-1 py-0.5">
              <div className="text-[8px] text-slate-500">Notional</div>
              <div className="font-mono text-[9px] text-slate-300">{fmtUsd(pos.notionalUsd)}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-red-500/20 hover:text-red-300">
            Close
          </button>
        </div>
      </Card>
    </motion.div>
  );
};

const HistoryRow = ({ trade }) => {
  const isWin = trade.pnl > 0;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isWin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
        {isWin ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white">{trade.symbol}</span>
          <span className={`text-[9px] uppercase ${trade.side === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>{trade.side}</span>
        </div>
        <div className="text-[10px] text-slate-500">{trade.reason}</div>
      </div>
      <div className="text-right">
        <div className={`font-mono text-xs font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>{isWin ? '+' : ''}{fmtUsd(trade.pnl)}</div>
        <div className={`text-[9px] ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%</div>
      </div>
    </div>
  );
};

const ConfigSheet = ({ config, onUpdate, onClose }) => {
  const grades = ['A+', 'A', 'B+', 'B'];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-slate-700 bg-slate-950 p-5 pb-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-bold text-white">Bot Configuration</div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-300">Minimum Signal Grade</div>
            <div className="flex gap-1.5">
              {grades.map((g) => (
                <button key={g} onClick={() => onUpdate({ minGrade: g })}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${config.minGrade === g ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40' : 'bg-slate-900 text-slate-400'}`}
                >{g}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Max Positions</span>
              <span className="font-mono text-white">{config.maxPositions}</span>
            </div>
            <input type="range" min="1" max="20" value={config.maxPositions} onChange={(e) => onUpdate({ maxPositions: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Risk per Trade (%)</span>
              <span className="font-mono text-white">{config.riskPerTradePct}%</span>
            </div>
            <input type="range" min="1" max="25" value={config.riskPerTradePct} onChange={(e) => onUpdate({ riskPerTradePct: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Leverage</span>
              <span className="font-mono text-white">{config.leverage}x</span>
            </div>
            <input type="range" min="1" max="125" value={config.leverage} onChange={(e) => onUpdate({ leverage: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Scan Interval (seconds)</span>
              <span className="font-mono text-white">{config.scanIntervalSec}s</span>
            </div>
            <input type="range" min="10" max="120" step="5" value={config.scanIntervalSec} onChange={(e) => onUpdate({ scanIntervalSec: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <span className="text-xs text-slate-300">Trailing Stop</span>
            <button onClick={() => onUpdate({ trailingStop: !config.trailingStop })}
              className={`rounded-full px-3 py-1 text-[10px] font-bold ${config.trailingStop ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}
            >{config.trailingStop ? 'ON' : 'OFF'}</button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <span className="text-xs text-slate-300">Auto Compound</span>
            <button onClick={() => onUpdate({ autoCompound: !config.autoCompound })}
              className={`rounded-full px-3 py-1 text-[10px] font-bold ${config.autoCompound ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}
            >{config.autoCompound ? 'ON' : 'OFF'}</button>
          </div>
        </div>

        <Button onClick={onClose} className="mt-5 w-full bg-cyan-500 text-white hover:bg-cyan-400">Done</Button>
      </motion.div>
    </div>
  );
};
