'use client';

// Settings sheet: view phrase, tambah wallet, ganti password, hapus semua data.
import { useState } from 'react';
import {
  Settings2, KeyRound, Download, Trash2, X, Eye, EyeOff, Copy,
  AlertTriangle, ArrowLeft, RefreshCw, Lock, User, Wallet as WalletIcon, Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Sheet } from './receive';
import { useWalletStore, selectActiveWallet } from '@/lib/store';
import { importFromMnemonic } from '@/lib/wallet';
import { clearVault } from '@/lib/vault';
import { shortAddr } from './shared';
import { TokenCreatorSheet } from './token-creator';

export const SettingsSheet = ({ onClose, onWalletChanged, onFullReset, onLock }) => {
  const store = useWalletStore();
  const active = selectActiveWallet(store);

  const [screen, setScreen] = useState('menu');

  if (screen === 'phrase') return <RevealPhraseInline mnemonic={active?.mnemonic} onBack={() => setScreen('menu')} onClose={onClose} />;
  if (screen === 'import') return <ImportInline onBack={() => setScreen('menu')} onDone={() => { onClose(); onWalletChanged?.(); }} />;
  if (screen === 'delete-all') return <DeleteAllInline onBack={() => setScreen('menu')} onConfirm={() => { clearVault(); useWalletStore.getState().lock(); useWalletStore.getState().removeAllWallets(); onClose(); onFullReset?.(); }} />;
  if (screen === 'token') return <TokenCreatorSheet onClose={onClose} />;

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-lime-300" />
          <div className="text-lg font-bold text-white">Settings</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
          <User className="h-3 w-3" />
          Account
        </div>
        <div className="mt-1 text-sm font-semibold text-white">{store.userName || 'User'}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <WalletIcon className="h-3 w-3" />
          <span>{store.wallets.length} active wallet{store.wallets.length === 1 ? '' : 's'}</span>
        </div>
        {active && (
          <div className="mt-2 font-mono text-[10px] text-slate-500">{shortAddr(active.address, 10, 8)}</div>
        )}
      </div>

      <div className="space-y-2">
        <MenuItem icon={KeyRound} title="View Recovery Phrase" desc="Back up your active wallet" onClick={() => setScreen('phrase')} disabled={!active} />
        <MenuItem icon={Download} title="Import Another Wallet" desc="Add a new wallet without replacing existing ones" onClick={() => setScreen('import')} />
        <MenuItem icon={Coins} title="Create ERC-20 Token" desc="Deploy affordably on Base Mainnet or for free on Sepolia" onClick={() => setScreen('token')} disabled={!active} />
        <MenuItem icon={Lock} title="Lock Vault" desc="Sign out — your password will be required to unlock again" onClick={() => { useWalletStore.getState().lock(); onClose(); onLock?.(); }} />
        <MenuItem icon={Trash2} title="Delete All Data" desc="Delete the vault and all wallets from this device" danger onClick={() => setScreen('delete-all')} />
      </div>
    </Sheet>
  );
};

const MenuItem = ({ icon: Icon, title, desc, danger, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-40 ${danger ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}
  >
    <div className={`rounded-xl p-2 ${danger ? 'bg-red-500/20 text-red-400' : 'bg-lime-400/15 text-lime-300'}`}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="flex-1">
      <div className={`text-sm font-semibold ${danger ? 'text-red-200' : 'text-white'}`}>{title}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </div>
  </button>
);

const InlineHeader = ({ title, subtitle, onBack, onClose }) => (
  <div className="mb-4">
    <div className="mb-3 flex items-center justify-between">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
    </div>
    <div className="text-lg font-bold text-white">{title}</div>
    {subtitle && <div className="mt-1 text-xs text-slate-400">{subtitle}</div>}
  </div>
);

const RevealPhraseInline = ({ mnemonic, onBack, onClose }) => {
  const [revealed, setRevealed] = useState(false);
  const words = (mnemonic || '').split(' ');
  const copy = async () => { await navigator.clipboard.writeText(mnemonic); toast.success('Recovery phrase copied.'); };
  return (
    <Sheet onClose={onClose}>
      <InlineHeader title="Recovery Phrase" subtitle="Never share this with anyone." onBack={onBack} onClose={onClose} />
      <div className="relative">
        {!revealed && (
          <button onClick={() => setRevealed(true)} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/95 backdrop-blur-sm">
            <Eye className="h-6 w-6 text-lime-300" />
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
        <Button variant="outline" onClick={copy} disabled={!revealed} className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"><Copy className="mr-2 h-4 w-4" /> Copy</Button>
        <Button variant="outline" onClick={() => setRevealed(false)} className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"><EyeOff className="h-4 w-4" /></Button>
      </div>
    </Sheet>
  );
};

const ImportInline = ({ onBack, onDone }) => {
  const [phrase, setPhrase] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError(''); setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const w = importFromMnemonic(phrase);
      const added = useWalletStore.getState().addWallet({ mnemonic: w.mnemonic, address: w.address, name: name.trim() || undefined, source: 'imported' });
      if (!added) { setError('This wallet already exists.'); setLoading(false); return; }
      useWalletStore.getState().setActiveWallet(added.id);
      toast.success('Wallet added and activated.');
      onDone();
    } catch (e) { setError(e.message || 'Invalid recovery phrase.'); }
    setLoading(false);
  };

  return (
    <Sheet onClose={onBack}>
      <InlineHeader title="Import Another Wallet" subtitle="Add a new wallet. Existing wallets will NOT be replaced." onBack={onBack} onClose={onBack} />
      <div className="mb-3">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Name (optional)</div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="for example: Trading Wallet" className="h-11 rounded-xl border-slate-700 bg-slate-900/70 text-sm text-white" />
      </div>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Recovery phrase</div>
      <Textarea value={phrase} onChange={(e) => { setPhrase(e.target.value); setError(''); }} placeholder="Type 12 or 24 words..." className="min-h-[120px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-lime-400" />
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}
      <Button onClick={handle} disabled={loading || !phrase.trim()} className="mt-5 h-13 w-full rounded-2xl bg-lime-400 py-3 text-base font-semibold text-slate-950 hover:bg-lime-300 disabled:opacity-40">
        {loading ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Adding...</> : <>Add Wallet</>}
      </Button>
    </Sheet>
  );
};

const DeleteAllInline = ({ onBack, onConfirm }) => {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText.trim().toUpperCase() === 'DELETE ALL';
  return (
    <Sheet onClose={onBack}>
      <InlineHeader title="Delete All Data" subtitle="The vault and all wallets will be deleted from this device." onBack={onBack} onClose={onBack} />
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs leading-relaxed text-red-200">
        All encrypted data (vault, wallets, watchlist, and PadaSankara) will be deleted from this device. You will need your recovery phrase to restore a wallet.
        <br /><br />
        &#9888;&#65039; Make sure you have the recovery phrase for every wallet with funds.
      </div>
      <div className="mt-4 text-xs uppercase tracking-widest text-slate-500">Type <span className="font-bold text-red-400">DELETE ALL</span> to confirm</div>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE ALL"
        className="mt-2 h-12 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 font-mono text-sm uppercase text-white placeholder:text-slate-600 focus:border-red-500 focus:outline-none"
      />
      <Button onClick={onConfirm} disabled={!canDelete} className="mt-5 h-13 w-full rounded-2xl bg-red-500 py-3 text-base font-semibold text-white hover:bg-red-600 disabled:opacity-40">
        <Trash2 className="mr-2 h-4 w-4" /> Delete Everything Now
      </Button>
    </Sheet>
  );
};
