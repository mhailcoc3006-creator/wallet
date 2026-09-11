'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Coins, ExternalLink, FlaskConical, Loader2, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from './receive';
import { useWalletStore, selectActiveWallet } from '@/lib/store';
import { deployKavachToken, estimateKavachToken, getTokenNetwork, TOKEN_NETWORKS } from '@/lib/token';

const MAX_SUPPLY = 1_000_000_000_000_000n;

export const TokenCreatorSheet = ({ onClose }) => {
  const store = useWalletStore();
  const active = selectActiveWallet(store);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [networkId, setNetworkId] = useState('base');
  const [baseConfirm, setBaseConfirm] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [step, setStep] = useState('form');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const network = getTokenNetwork(networkId);
  const supplyValue = useMemo(() => {
    try {
      if (!/^[1-9]\d*$/.test(supply)) return null;
      const value = BigInt(supply);
      return value > 0n && value <= MAX_SUPPLY ? value : null;
    } catch {
      return null;
    }
  }, [supply]);
  const valid = Boolean(
    active?.mnemonic &&
    name.trim().length >= 1 &&
    name.trim().length <= 32 &&
    /^[A-Z][A-Z0-9]{1,9}$/.test(normalizedSymbol) &&
    supplyValue,
  );

  const checkGas = async () => {
    if (!valid || !active?.mnemonic) return;
    setError('');
    setEstimate(null);
    setEstimating(true);
    try {
      const result = await estimateKavachToken({
        mnemonic: active.mnemonic,
        name: name.trim(),
        symbol: normalizedSymbol,
        supply: supplyValue.toString(),
        networkId,
      });
      setEstimate(result);
      if (!result.canPayGas) setError(`Insufficient ETH balance. Estimated gas: ${result.estimatedCost || 'unavailable'} ETH; balance: ${result.balance} ETH.`);
    } catch (e) {
      setError(e?.shortMessage || e?.message || 'Could not estimate gas.');
    } finally {
      setEstimating(false);
    }
  };

  const deploy = async () => {
    if (!valid || !active?.mnemonic) return;
    if (networkId === 'base' && baseConfirm !== 'DEPLOY BASE') return;
    setError('');
    setStep('deploying');
    try {
      const deployment = await deployKavachToken({
        mnemonic: active.mnemonic,
        name: name.trim(),
        symbol: normalizedSymbol,
        supply: supplyValue.toString(),
        networkId,
      });
      setResult(deployment);
      setStep('success');
      toast.success(`Token created on ${network.name}.`);
    } catch (e) {
      setError(e?.info?.error?.message || e?.shortMessage || e?.message || 'Deployment failed.');
      setStep('error');
    }
  };

  if (step === 'deploying') {
    return (
      <Sheet onClose={onClose}>
        <div className="py-10 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-400" />
          <div className="mt-4 text-lg font-bold text-white">Creating token...</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The transaction is being signed locally and sent to {network.name}.
          </p>
        </div>
      </Sheet>
    );
  }

  if (step === 'success') {
    return (
      <Sheet onClose={onClose}>
        <div className="py-3 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
          <div className="mt-4 text-xl font-bold text-white">Token created successfully</div>
          <div className="mt-2 text-sm text-slate-400">{name.trim()} ({normalizedSymbol}) on {result?.network?.name || network.name}</div>
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Contract address</div>
            <div className="mt-1 break-all font-mono text-xs text-white">{result?.address}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={result?.explorer}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-3 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Contract <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={result?.txExplorer}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-3 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Transaction <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <Button onClick={onClose} className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
            Done
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/20 p-2.5">
            <Coins className="h-5 w-5 text-amber-300" />
          </div>
          <div>
          <div className="text-lg font-bold text-white">Create ERC-20 Token</div>
            <div className="text-xs text-slate-400">{network.name}</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>

      <div className={`mb-4 flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed ${networkId === 'base' ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
        {networkId === 'base' ? <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" /> : <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />}
        <span>{networkId === 'base' ? 'BASE MAINNET: deployment uses real ETH on Base and cannot be undone. Make sure the name, symbol, supply, and deployer wallet are correct.' : 'Free testnet. This token has no real value. You need Sepolia ETH from a faucet for gas.'}</span>
      </div>

      {!active && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          Create or import a wallet first.
        </div>
      )}

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-500">Network deployment</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(TOKEN_NETWORKS).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setNetworkId(item.id); setEstimate(null); setError(''); setBaseConfirm(''); }}
                className={`rounded-xl border px-3 py-3 text-left text-xs transition ${networkId === item.id ? (item.id === 'base' ? 'border-red-500/60 bg-red-500/10 text-red-100' : 'border-amber-500/60 bg-amber-500/10 text-amber-100') : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'}`}
              >
                <div className="font-semibold">{item.name}</div>
                <div className="mt-1 text-[10px] opacity-70">Chain ID {item.chainId}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-500">Token name</div>
          <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 32))} placeholder="For example: Cavendish Token" className="h-12 rounded-xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-600" />
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-500">Symbol</div>
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="KVC" className="h-12 rounded-xl border-slate-700 bg-slate-900/70 text-sm uppercase text-white placeholder:text-slate-600" />
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-500">Initial supply</div>
          <Input inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ''))} placeholder="1000000" className="h-12 rounded-xl border-slate-700 bg-slate-900/70 font-mono text-sm text-white placeholder:text-slate-600" />
          <div className="mt-1 text-[10px] text-slate-500">Decimals are fixed at 18. The full supply is sent to the active wallet.</div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <p className="break-words text-xs text-red-200">{error}</p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400">
        <div className="flex justify-between"><span>Network</span><span className="text-white">{network.name}</span></div>
        <div className="mt-1 flex justify-between"><span>Deployer</span><span className="font-mono text-white">{active?.address ? `${active.address.slice(0, 8)}…${active.address.slice(-6)}` : '—'}</span></div>
        {estimate && (
          <>
            <div className="mt-1 flex justify-between"><span>Estimated gas</span><span className="font-mono text-white">{estimate.estimatedCost || 'n/a'} ETH</span></div>
            <div className="mt-1 flex justify-between"><span>ETH balance</span><span className={estimate.canPayGas ? 'font-mono text-emerald-300' : 'font-mono text-red-300'}>{estimate.balance} ETH</span></div>
          </>
        )}
      </div>

      {networkId === 'base' && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <div className="text-[10px] uppercase tracking-widest text-red-300">Confirm real transaction</div>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-400">Type exactly <span className="font-mono font-bold text-red-200">DEPLOY BASE</span> to enable deployment.</div>
          <Input value={baseConfirm} onChange={(e) => setBaseConfirm(e.target.value)} placeholder="DEPLOY BASE" className="mt-2 h-11 rounded-xl border-red-500/30 bg-slate-950/70 font-mono text-xs text-white placeholder:text-slate-600" />
        </div>
      )}

      <Button onClick={checkGas} disabled={!valid || estimating} variant="outline" className="mt-5 h-12 w-full rounded-xl border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 disabled:opacity-40">
        {estimating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estimating gas...</> : <>Check balance & estimate gas</>}
      </Button>
      <Button onClick={deploy} disabled={!valid || step === 'deploying' || (networkId === 'base' && baseConfirm !== 'DEPLOY BASE')} className={`h-13 w-full rounded-2xl py-3 font-semibold text-white shadow-lg disabled:opacity-40 ${networkId === 'base' ? 'bg-gradient-to-r from-red-600 to-orange-600 shadow-red-500/20 hover:from-red-500 hover:to-orange-500' : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400'}`}>
        {networkId === 'base' ? 'Deploy Token to Base Mainnet' : 'Deploy Token to Sepolia'}
      </Button>
      {networkId === 'sepolia' && (
        <a href="https://sepoliafaucet.com/" target="_blank" rel="noreferrer" className="mt-3 block text-center text-[11px] text-cyan-400 hover:text-cyan-300">
          Get free Sepolia ETH from a faucet ↗
        </a>
      )}
    </Sheet>
  );
};
