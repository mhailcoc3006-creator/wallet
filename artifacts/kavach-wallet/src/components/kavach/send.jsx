'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowLeft, ScanLine, Loader2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CHAINS } from '@/lib/chains';
import { ChainIcon, fmtNum, fmtUsd } from './shared';
import { Sheet, ChainSelector } from './receive';
import { QRScanner } from './scanner';
import { sendNative } from '@/lib/wallet';

export const SendSheet = ({ addresses, balances, prices, mnemonic, defaultChainId, onClose }) => {
  const [step, setStep] = useState('form'); // form | scan | sending | success | error
  const [chainId, setChainId] = useState(defaultChainId || 'ethereum');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const chain = CHAINS.find((c) => c.id === chainId);
  const balance = parseFloat(balances?.[chainId] || '0');
  const price = prices?.[chain.coinGeckoId]?.usd || 0;

  const canSend = chain.canSend;
  const amountNum = parseFloat(amount || '0');
  const usdValue = amountNum * price;
  const invalidAmount = !amountNum || amountNum <= 0 || amountNum > balance;

  const setMax = () => setAmount(String(Math.max(0, balance * 0.99))); // leave gas buffer

  const submit = async () => {
    if (!canSend) return;
    setErrMsg('');
    setStep('sending');
    try {
      const r = await sendNative(chain, mnemonic, toAddress.trim(), String(amountNum));
      setResult(r);
      setStep('success');
       toast.success('Transaction sent!');
    } catch (e) {
       setErrMsg(e?.info?.error?.message || e.shortMessage || e.message || 'Transaction failed.');
      setStep('error');
    }
  };

  if (step === 'scan') {
    return (
      <QRScanner
        onScanned={(txt) => {
          // strip "chain:" prefix if any (e.g. ethereum:0xabc...)
          const cleaned = txt.includes(':') ? txt.split(':').pop().split('?')[0] : txt;
          setToAddress(cleaned);
          setStep('form');
          toast.success('Alamat terdeteksi.');
        }}
        onClose={() => setStep('form')}
      />
    );
  }

  if (step === 'sending' || step === 'success' || step === 'error') {
    return (
      <Sheet onClose={onClose}>
        <div className="py-4 text-center">
          {step === 'sending' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-400" />
               <div className="mt-4 text-lg font-bold text-white">Sending transaction...</div>
               <div className="mt-2 text-sm text-slate-400">Signing and broadcasting to {chain.name}</div>
            </>
          )}
          {step === 'success' && (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
               <div className="mt-4 text-lg font-bold text-white">Transaction sent successfully</div>
              <div className="mt-2 text-sm text-slate-400">{fmtNum(amountNum)} {chain.symbol} → {toAddress.slice(0, 10)}...{toAddress.slice(-6)}</div>
              <a href={result?.explorer} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white hover:bg-slate-700">
                 View in Explorer <ExternalLink className="h-4 w-4" />
              </a>
              <div className="mt-6">
                 <Button onClick={onClose} className="h-12 w-full rounded-xl bg-lime-400 text-slate-950 hover:bg-lime-300">Done</Button>
              </div>
            </>
          )}
          {step === 'error' && (
            <>
              <AlertTriangle className="mx-auto h-14 w-14 text-red-400" />
               <div className="mt-4 text-lg font-bold text-white">Transaction failed</div>
              <div className="mt-2 break-words text-xs text-red-200">{errMsg}</div>
              <div className="mt-6">
                 <Button onClick={() => setStep('form')} className="h-12 w-full rounded-xl bg-slate-800 text-white hover:bg-slate-700">Try again</Button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div>
           <div className="text-lg font-bold text-white">Send Assets</div>
           <div className="text-xs text-slate-400">Signing happens locally on this device</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>

       <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Select Chain</div>
      <ChainSelector value={chainId} onChange={setChainId} />

      {!canSend ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
           Sending {chain.name} is not available in this version. You can still receive funds at your {chain.name} address.
        </div>
      ) : (
        <>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
               <span>Recipient Address</span>
              <button onClick={() => setStep('scan')} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
                <ScanLine className="h-3.5 w-3.5" /> Scan QR
              </button>
            </div>
            <Input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder={chain.family === 'evm' ? '0x...' : chain.family === 'sol' ? 'Alamat Solana' : 'Alamat'}
              className="h-12 rounded-xl border-slate-700 bg-slate-900/70 font-mono text-xs text-white placeholder:text-slate-600"
            />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
              <span>Jumlah</span>
               <span>Balance: {fmtNum(balance)} {chain.symbol}</span>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-14 rounded-xl border-slate-700 bg-slate-900/70 pr-24 text-lg font-semibold text-white placeholder:text-slate-600"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <button onClick={setMax} className="rounded-md bg-emerald-500/20 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/30">MAX</button>
                <span className="pr-2 text-sm font-semibold text-slate-400">{chain.symbol}</span>
              </div>
            </div>
            {amountNum > 0 && (
              <div className="mt-1 text-right text-xs text-slate-500">≈ {fmtUsd(usdValue)}</div>
            )}
            {amountNum > balance && (
               <div className="mt-2 text-xs text-red-400">Insufficient balance.</div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <ChainIcon chain={chain} size={20} />
               <span>This transaction will be signed with your private key on this device and broadcast directly to the {chain.name} network. Cavendish never receives your key.</span>
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={invalidAmount || !toAddress.trim()}
            className="mt-5 h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40"
          >
             Review & Send
          </Button>
        </>
      )}
    </Sheet>
  );
};
