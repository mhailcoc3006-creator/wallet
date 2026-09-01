'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownUp, Loader2, X, Zap, CheckCircle2, AlertTriangle, ExternalLink, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { EVM_CHAINS } from '@/lib/chains';
import { SWAP_TOKENS, getQuote, executeSwap } from '@/lib/swap';
import { ChainIcon, fmtNum, fmtUsd } from './shared';
import { Sheet } from './receive';

export const SwapTab = ({ mnemonic, addresses, balances, prices }) => {
  const [chainId, setChainId] = useState('base'); // default to Base (cheap gas)
  const [showChain, setShowChain] = useState(false);
  const chain = EVM_CHAINS.find((c) => c.id === chainId);
  const tokens = SWAP_TOKENS[chainId] || [];
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [showTokenPicker, setShowTokenPicker] = useState(null); // 'from' | 'to' | null

  useEffect(() => { setFromIdx(0); setToIdx(Math.min(1, tokens.length - 1)); setQuote(null); setAmount(''); }, [chainId]);

  const fromToken = tokens[fromIdx];
  const toToken = tokens[toIdx];
  const address = addresses?.[chainId];

  const nativeBalance = balances?.[chainId];
  const isNative = fromToken?.address === '0x0000000000000000000000000000000000000000';

  const fetchQuote = async () => {
    setError('');
    setQuote(null);
    if (!amount || parseFloat(amount) <= 0 || !address) return;
    setQuoting(true);
    try {
      const fromAmount = BigInt(Math.floor(parseFloat(amount) * 10 ** fromToken.decimals)).toString();
      const q = await getQuote({
        fromChainId: chain.chainId,
        toChainId: chain.chainId,
        fromToken: fromToken.address,
        toToken: toToken.address,
        fromAmount,
        fromAddress: address,
      });
      setQuote(q);
    } catch (e) {
      setError(e.message || 'Quote gagal. Coba jumlah yang lebih besar atau pair berbeda.');
    } finally { setQuoting(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => { if (amount && fromToken && toToken && fromToken.address !== toToken.address) fetchQuote(); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromIdx, toIdx, chainId]);

  const swapSides = () => { const a = fromIdx; setFromIdx(toIdx); setToIdx(a); };

  const execute = async () => {
    if (!quote) return;
    setExecuting(true);
    setError('');
    try {
      const r = await executeSwap({ chain, mnemonic, quote });
      setResult(r);
      toast.success('Swap dikirim!');
    } catch (e) {
      setError(e?.info?.error?.message || e.shortMessage || e.message || 'Swap gagal.');
    } finally { setExecuting(false); }
  };

  const toAmount = quote?.estimate?.toAmount ? Number(quote.estimate.toAmount) / 10 ** toToken.decimals : null;
  const usdOut = quote?.estimate?.toAmountUSD ? Number(quote.estimate.toAmountUSD) : null;
  const gasUsd = quote?.estimate?.gasCosts?.reduce((s, g) => s + Number(g.amountUSD || 0), 0);
  const toolName = quote?.toolDetails?.name;

  return (
    <div className="space-y-4">
      <Card className="border-lime-400/15 bg-gradient-to-br from-[#101610] via-[#0b100c] to-[#172100] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lime-400/15 p-2"><ArrowDownUp className="h-5 w-5 text-lime-300" /></div>
            <div>
              <div className="text-sm font-semibold text-white">Swap</div>
              <div className="text-xs text-slate-400">Best rate via LI.FI • signing lokal</div>
            </div>
          </div>
          <button onClick={() => setShowChain(true)} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            <ChainIcon chain={chain} size={20} />
            <span className="font-medium">{chain.name}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </Card>

      {/* From */}
      <TokenPanel label="Dari" token={fromToken} amount={amount} onAmount={setAmount} balance={isNative ? nativeBalance : null} onPick={() => setShowTokenPicker('from')} />

      <div className="flex justify-center">
        <button onClick={swapSides} className="rounded-xl border border-lime-400/15 bg-[#050806] p-2 text-slate-400 hover:text-lime-300">
          <ArrowDownUp className="h-4 w-4" />
        </button>
      </div>

      {/* To */}
      <TokenPanel label="Ke" token={toToken} readonly amount={toAmount != null ? fmtNum(toAmount, 6) : ''} usd={usdOut ? fmtUsd(usdOut) : ''} onPick={() => setShowTokenPicker('to')} loading={quoting} />

      {quote && (
        <Card className="border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 space-y-1.5">
          <div className="flex justify-between"><span className="text-slate-500">Route</span><span>{toolName || 'aggregated'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Slippage</span><span>{quote.action?.slippage != null ? (quote.action.slippage * 100).toFixed(2) : '0.5'}%</span></div>
          {gasUsd != null && <div className="flex justify-between"><span className="text-slate-500">Est. gas</span><span>{fmtUsd(gasUsd)}</span></div>}
          <div className="flex justify-between"><span className="text-slate-500">Min. diterima</span><span>{quote.estimate?.toAmountMin ? fmtNum(Number(quote.estimate.toAmountMin) / 10 ** toToken.decimals) : '-'} {toToken.symbol}</span></div>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
      )}

      <Button
        onClick={execute}
        disabled={!quote || executing || quoting}
        className="h-14 w-full rounded-2xl bg-lime-400 text-base font-semibold text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300 disabled:opacity-40"
      >
        {executing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Mengirim...</> : quoting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cek harga...</> : <><Zap className="mr-2 h-5 w-5" /> Swap Sekarang</>}
      </Button>

      <div className="pt-2 text-center text-[10px] uppercase tracking-widest text-slate-600">Powered by LI.FI aggregator</div>

      {showChain && (
        <Sheet onClose={() => setShowChain(false)}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-bold text-white">Pilih Chain</div>
            <button onClick={() => setShowChain(false)} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
              {EVM_CHAINS.map((c) => (
              <button key={c.id} onClick={() => { setChainId(c.id); setShowChain(false); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${chainId === c.id ? 'border-lime-300/70 bg-lime-400/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}>
                <ChainIcon chain={c} size={30} />
                <span className="text-sm font-medium text-white">{c.name}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {showTokenPicker && (
        <Sheet onClose={() => setShowTokenPicker(null)}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-bold text-white">Pilih Token</div>
            <button onClick={() => setShowTokenPicker(null)} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-2">
            {tokens.map((t, i) => (
              <button
                key={t.address}
                onClick={() => {
                  if (showTokenPicker === 'from') setFromIdx(i); else setToIdx(i);
                  setShowTokenPicker(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left hover:bg-slate-900"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">{t.symbol.slice(0, 3)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{t.symbol}</div>
                  <div className="truncate text-xs text-slate-500">{t.name}</div>
                </div>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {result && (
        <Sheet onClose={() => { setResult(null); setAmount(''); setQuote(null); }}>
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-lime-300" />
            <div className="mt-4 text-lg font-bold text-white">Swap terkirim</div>
            <div className="mt-2 text-sm text-slate-400">{fmtNum(amount)} {fromToken.symbol} → {toAmount ? fmtNum(toAmount) : ''} {toToken.symbol}</div>
            <a href={result.explorer} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white hover:bg-slate-700">
              Lihat di Explorer <ExternalLink className="h-4 w-4" />
            </a>
            <Button onClick={() => { setResult(null); setAmount(''); setQuote(null); }} className="mt-4 h-12 w-full rounded-xl bg-lime-400 text-slate-950 hover:bg-lime-300">Selesai</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
};

const TokenPanel = ({ label, token, amount, onAmount, readonly, usd, onPick, balance, loading }) => (
  <Card className="border-slate-800 bg-slate-900/60 p-4">
    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
      <span>{label}</span>
      {balance != null && <span>Saldo: {fmtNum(parseFloat(balance || 0))} {token?.symbol}</span>}
    </div>
    <div className="flex items-center gap-3">
      <button onClick={onPick} className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white">{token?.symbol?.slice(0, 3)}</div>
        <span className="text-sm font-semibold text-white">{token?.symbol}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      <Input
        type={readonly ? 'text' : 'number'}
        value={amount || ''}
        onChange={readonly ? undefined : (e) => onAmount(e.target.value)}
        readOnly={readonly}
        placeholder={loading ? '...' : '0.00'}
        className="h-12 flex-1 border-0 bg-transparent px-0 text-right text-2xl font-bold text-white placeholder:text-slate-600 focus-visible:ring-0"
      />
    </div>
    {usd && <div className="mt-1 text-right text-xs text-slate-500">≈ {usd}</div>}
  </Card>
);
