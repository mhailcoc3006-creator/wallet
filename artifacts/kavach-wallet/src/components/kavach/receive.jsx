'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CHAINS } from '@/lib/chains';
import { ChainIcon } from './shared';

export const ReceiveSheet = ({ addresses, defaultChainId, onClose }) => {
  const [chainId, setChainId] = useState(defaultChainId || 'ethereum');
  const [copied, setCopied] = useState(false);
  const chain = CHAINS.find((c) => c.id === chainId);
  const address = addresses?.[chainId];

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
     toast.success('Address copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <div>
           <div className="text-lg font-bold text-white">Receive Assets</div>
           <div className="text-xs text-slate-400">Share the address below to receive {chain?.symbol}</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>

      <ChainSelector value={chainId} onChange={setChainId} />

      {address && (
        <>
          <div className="mx-auto mt-6 w-fit rounded-2xl bg-white p-4">
            <QRCodeSVG value={address} size={200} level="M" />
          </div>

          <div className="mt-6 space-y-2">
             <div className="text-xs uppercase tracking-widest text-slate-500">{chain.name} address</div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="break-all font-mono text-xs text-white">{address}</div>
            </div>
             <Button onClick={copy} className="h-12 w-full rounded-xl bg-lime-400 text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300">
               {copied ? <><Check className="mr-2 h-4 w-4" /> Copied</> : <><Copy className="mr-2 h-4 w-4" /> Copy Address</>}
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
             ⚠️ Only send {chain.symbol} or {chain.family === 'evm' ? 'EVM-compatible tokens' : chain.name} to this address.
          </div>
        </>
      )}
    </Sheet>
  );
};

export const ChainSelector = ({ value, onChange, filter }) => {
  const list = filter ? CHAINS.filter(filter) : CHAINS;
  return (
    <div className="grid grid-cols-3 gap-2">
      {list.map((chain) => (
        <button
          key={chain.id}
          onClick={() => onChange(chain.id)}
          className={`flex flex-col items-center gap-2 rounded-xl border p-2.5 text-xs transition ${
            value === chain.id
               ? 'border-lime-300/70 bg-lime-400/10 text-white'
              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
          }`}
        >
          <ChainIcon chain={chain} size={30} />
          <span className="font-medium">{chain.symbol}</span>
        </button>
      ))}
    </div>
  );
};

export const Sheet = ({ children, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
       <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-lime-400/15 bg-[#0a0f0a] p-6 shadow-2xl shadow-black/50 sm:rounded-3xl">
        {children}
      </div>
    </div>
  );
};
