'use client';

// Settings sheet: View phrase, Import different wallet, Delete wallet.
import { useState } from 'react';
import {
  Settings2, KeyRound, Download, Trash2, X, Eye, EyeOff, Copy, AlertTriangle, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from './receive';
import { useWalletStore } from '@/lib/store';
import { importFromMnemonic } from '@/lib/wallet';
import { shortAddr } from './shared';

export const SettingsSheet = ({ onClose, onWalletChanged }) => {
  const wallet = useWalletStore((s) => s.wallet);
  const resetWallet = useWalletStore((s) => s.resetWallet);

  const [screen, setScreen] = useState('menu'); // menu | phrase | import | delete

  if (screen === 'phrase') return <RevealPhraseInline mnemonic={wallet?.mnemonic} onBack={() => setScreen('menu')} onClose={onClose} />;
  if (screen === 'import') return <ImportInline onBack={() => setScreen('menu')} onDone={() => { onClose(); onWalletChanged?.(); }} />;
  if (screen === 'delete') return <DeleteInline onBack={() => setScreen('menu')} onConfirm={() => { resetWallet(); onClose(); onWalletChanged?.(); }} />;

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-emerald-400" />
          <div className="text-lg font-bold text-white">Pengaturan Wallet</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">Wallet Aktif</div>
        <div className="mt-1 text-sm font-semibold text-white">{wallet?.name || 'Main Wallet'}</div>
        <div className="mt-0.5 font-mono text-xs text-slate-400">{shortAddr(wallet?.address, 10, 8)}</div>
      </div>

      <div className="space-y-2">
        <MenuItem icon={KeyRound} title="Lihat Recovery Phrase" desc="Tampilkan 12 kata cadangan Anda" onClick={() => setScreen('phrase')} />
        <MenuItem icon={Download} title="Import Wallet Lain" desc="Ganti wallet aktif dengan phrase yang berbeda" onClick={() => setScreen('import')} />
        <MenuItem icon={Trash2} title="Hapus Wallet" desc="Hapus semua data lokal dari device" danger onClick={() => setScreen('delete')} />
      </div>
    </Sheet>
  );
};

const MenuItem = ({ icon: Icon, title, desc, danger, onClick }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${danger ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}
  >
    <div className={`rounded-xl p-2 ${danger ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
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
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali
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
  const copy = async () => { await navigator.clipboard.writeText(mnemonic); toast.success('Recovery phrase disalin.'); };
  return (
    <Sheet onClose={onClose}>
      <InlineHeader title="Recovery Phrase" subtitle="Jangan bagikan phrase ini kepada siapa pun." onBack={onBack} onClose={onClose} />
      <div className="relative">
        {!revealed && (
          <button onClick={() => setRevealed(true)} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/95 backdrop-blur-sm">
            <Eye className="h-6 w-6 text-emerald-400" />
            <span className="text-sm text-slate-200">Ketuk untuk mengungkap</span>
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
        <Button variant="outline" onClick={copy} disabled={!revealed} className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"><Copy className="mr-2 h-4 w-4" /> Salin</Button>
        <Button onClick={() => setRevealed(false)} variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"><EyeOff className="h-4 w-4" /></Button>
      </div>
    </Sheet>
  );
};

const ImportInline = ({ onBack, onDone }) => {
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Wallet aktif Anda saat ini akan DIGANTIKAN. Pastikan Anda sudah backup phrase saat ini. Lanjutkan?')) return;
    setError(''); setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const w = importFromMnemonic(phrase);
      useWalletStore.getState().setWallet({ mnemonic: w.mnemonic, address: w.address });
      useWalletStore.getState().confirmBackup();
      toast.success('Wallet berhasil di-import.');
      onDone();
    } catch (e) {
      setError(e.message || 'Recovery phrase tidak valid.');
    }
    setLoading(false);
  };

  return (
    <Sheet onClose={onBack}>
      <InlineHeader title="Import Wallet Lain" subtitle="Ganti wallet aktif dengan phrase berbeda. Data diproses lokal." onBack={onBack} onClose={onBack} />
      <Textarea value={phrase} onChange={(e) => { setPhrase(e.target.value); setError(''); }} placeholder="Ketik 12/24 kata recovery phrase..." className="min-h-[140px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-emerald-500" />
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
        &#9888;&#65039; Wallet aktif saat ini akan digantikan. Pastikan Anda sudah menyimpan recovery phrase yang sekarang.
      </div>
      <Button onClick={handle} disabled={loading || !phrase.trim()} className="mt-5 h-13 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-base font-semibold text-white hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40">
        {loading ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Memvalidasi...</> : <>Import & Ganti Wallet</>}
      </Button>
    </Sheet>
  );
};

const DeleteInline = ({ onBack, onConfirm }) => {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText.trim().toUpperCase() === 'HAPUS';
  return (
    <Sheet onClose={onBack}>
      <InlineHeader title="Hapus Wallet" subtitle="Tindakan ini tidak dapat dibatalkan." onBack={onBack} onClose={onBack} />
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs leading-relaxed text-red-200">
        Semua data wallet akan dihapus dari localStorage device ini. Anda TIDAK akan bisa masuk kembali tanpa recovery phrase.
        <br /><br />
        &#9888;&#65039; Pastikan Anda sudah menyimpan 12 kata recovery phrase Anda di tempat yang aman.
      </div>
      <div className="mt-4 text-xs uppercase tracking-widest text-slate-500">Ketik <span className="font-bold text-red-400">HAPUS</span> untuk konfirmasi</div>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="HAPUS"
        className="mt-2 h-12 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 font-mono text-sm uppercase text-white placeholder:text-slate-600 focus:border-red-500 focus:outline-none"
      />
      <Button onClick={onConfirm} disabled={!canDelete} className="mt-5 h-13 w-full rounded-2xl bg-red-500 py-3 text-base font-semibold text-white hover:bg-red-600 disabled:opacity-40">
        <Trash2 className="mr-2 h-4 w-4" /> Hapus Wallet Sekarang
      </Button>
    </Sheet>
  );
};
