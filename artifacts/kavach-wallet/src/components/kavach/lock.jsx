'use client';

// Lock screen — login pengingat akun user.
// Menampilkan salam "Welcome back, [Nama]" dan minta password.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, AlertTriangle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandMark } from './shared';
import { unlockVault, clearVault, readVaultMeta } from '@/lib/vault';
import { useWalletStore } from '@/lib/store';

export const LockScreen = ({ onUnlocked, onReset }) => {
  const meta = readVaultMeta();
  const userName = meta?.userName || 'User';

  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async (e) => {
    e?.preventDefault?.();
    if (!password) return;
    setError(''); setLoading(true);
    try {
      const { state, key, meta } = await unlockVault(password);
      useWalletStore.getState().hydrate({ state, key, meta });
      toast.success(`Selamat datang kembali, ${meta.userName}.`);
      onUnlocked();
    } catch (err) {
      setError(err.message || 'Password salah.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (typeof window !== 'undefined' && window.confirm('Reset akan menghapus SEMUA data wallet Anda dari device ini. Pastikan Anda punya recovery phrase untuk semua wallet. Lanjutkan?')) {
      clearVault();
      onReset();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10"
    >
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-4 text-center">
        <BrandMark size={72} />
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-emerald-400/80">Welcome back</div>
          <div className="mt-1 text-3xl font-bold text-white">Halo, {userName}</div>
          <div className="mt-2 text-sm text-slate-400">Masukkan password untuk membuka vault Anda</div>
        </div>
      </motion.div>

      <form onSubmit={handleUnlock} className="mt-10 w-full space-y-3">
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password akun"
            autoFocus
            className="h-14 rounded-2xl border-slate-700 bg-slate-900/70 pl-12 pr-12 text-sm text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !password}
          className="h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40"
        >
          {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Membuka...</> : <>Login</>}
        </Button>
      </form>

      <button onClick={handleReset} className="mt-8 flex items-center gap-1 text-xs text-slate-500 hover:text-red-400">
        <LogOut className="h-3 w-3" /> Lupa password? Reset vault
      </button>

      <div className="mt-auto pt-8 text-center text-[10px] uppercase tracking-widest text-slate-600">
        Kavach • Vault ter-enkripsi AES-GCM 256
      </div>
    </motion.div>
  );
};
