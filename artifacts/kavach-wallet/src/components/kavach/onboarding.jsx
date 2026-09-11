'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Sparkles, Download, KeyRound, Shield, AlertTriangle, Lock,
  Eye, EyeOff, Copy, Check, RefreshCw, Layers, User, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Brand, BrandMark } from './shared';
import { createWallet, importFromMnemonic } from '@/lib/wallet';

export const Splash = () => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050806]">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(215,255,0,0.08),transparent_27%)]" />
    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="flex flex-col items-center gap-6">
      <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
        <BrandMark size={88} />
      </motion.div>
      <div className="text-center">
        <div className="text-3xl font-bold tracking-tight text-white">Cavendish</div>
        <div className="mt-1 text-xs uppercase tracking-[0.35em] text-lime-300">Your private wallet</div>
      </div>
    </motion.div>
  </div>
);

const ScreenHeader = ({ onBack, title, subtitle }) => (
  <div className="mb-8">
    {onBack && (
      <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
    )}
    <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
    {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>}
  </div>
);

const FeaturePill = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
    <Icon className="h-5 w-5 text-lime-300" />
    <span className="text-xs text-slate-300">{label}</span>
  </div>
);

export const Welcome = ({ onCreate, onImport, onLogin, hasVault }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
    <div className="flex items-center justify-between">
      <Brand />
      <Badge variant="outline" className="border-lime-400/50 text-lime-300">Non-custodial</Badge>
    </div>
    <div className="flex flex-1 flex-col justify-center py-12">
      <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
        A crypto wallet <span className="bg-gradient-to-r from-lime-300 to-lime-500 bg-clip-text text-transparent">that truly belongs to you.</span>
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-400">
        Manage assets across 10 chains — Bitcoin, Ethereum, Solana, BNB, Polygon, Arbitrum, Optimism, Base, Avalanche, and Tron — from one recovery phrase.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-3">
        <FeaturePill icon={Layers} label="10 Chain" />
        <FeaturePill icon={Lock} label="AES-GCM" />
        <FeaturePill icon={Sparkles} label="Multi wallet" />
      </div>
    </div>
    <div className="space-y-3">
      <Button onClick={onCreate} className="h-14 w-full rounded-2xl bg-lime-400 text-base font-semibold text-slate-950 shadow-lg shadow-lime-400/25 hover:bg-lime-300">
        <Sparkles className="mr-2 h-5 w-5" /> Create Account & Wallet
      </Button>
      <Button onClick={onImport} variant="outline" className="h-14 w-full rounded-2xl border-slate-700 bg-slate-900/60 text-base font-semibold text-white hover:bg-slate-800">
        <Download className="mr-2 h-5 w-5" /> Import Wallet
      </Button>
      {hasVault && (
        <Button onClick={onLogin} variant="outline" className="h-12 w-full rounded-2xl border-slate-700 bg-slate-950/50 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
          <KeyRound className="mr-2 h-4 w-4" /> Already have an account? Sign in
        </Button>
      )}
      <p className="pt-2 text-center text-xs text-slate-500">Your account and wallet are encrypted locally on this device. No server stores your password or recovery phrase.</p>
    </div>
  </motion.div>
);

const InfoRow = ({ icon: Icon, text }) => (
  <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left">
    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-lime-300" />
    <span className="text-xs leading-relaxed text-slate-300">{text}</span>
  </div>
);

export const CreateWallet = ({ onBack, onGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const handle = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 300));
    try { onGenerated(createWallet()); } catch (e) { toast.error('Gagal: ' + e.message); }
    setGenerating(false);
  };
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ScreenHeader onBack={onBack} title="Create New Wallet" subtitle="Your 12-word recovery phrase is the ONLY way to restore this wallet." />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse rounded-full bg-lime-400/15 blur-2xl" />
          <div className="relative rounded-full bg-lime-400 p-6 text-slate-950 shadow-xl shadow-lime-400/20">
            <KeyRound className="h-14 w-14 text-white" />
          </div>
        </div>
        <div className="w-full space-y-2">
          <InfoRow icon={Lock} text="Keys are created locally on this device and never sent to a server." />
          <InfoRow icon={Shield} text="BIP-39 + BIP-44 multi-chain support, encrypted with AES-GCM on this device." />
          <InfoRow icon={AlertTriangle} text="Store your recovery phrase somewhere safe." />
        </div>
      </div>
      <Button onClick={handle} disabled={generating} className="h-14 w-full rounded-2xl bg-lime-400 text-base font-semibold text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300">
        {generating ? <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Creating...</> : <>Generate Recovery Phrase <ArrowRight className="ml-2 h-5 w-5" /></>}
      </Button>
    </motion.div>
  );
};

const ConfirmPhrase = ({ expected, onBack, onConfirmed }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const handleConfirm = () => {
    const cleaned = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (cleaned !== expected.trim().toLowerCase()) return setError('Recovery phrase does not match.');
    onConfirmed();
  };
  return (
    <>
      <Textarea value={value} onChange={(e) => { setValue(e.target.value); setError(''); }} placeholder="Type the 12 words separated by spaces..." className="min-h-[140px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-lime-400" />
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <div className="flex-1" />
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-14 flex-1 rounded-2xl border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">Review</Button>
        <Button onClick={handleConfirm} disabled={!value.trim()} className="h-14 flex-[2] rounded-2xl bg-lime-400 text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300 disabled:opacity-40">Confirm</Button>
      </div>
    </>
  );
};

export const BackupPhrase = ({ wallet, onDone, onBack }) => {
  const words = useMemo(() => wallet.mnemonic.split(' '), [wallet.mnemonic]);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState('reveal');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wallet.mnemonic);
    setCopied(true); toast.success('Recovery phrase copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ScreenHeader onBack={onBack} title={step === 'reveal' ? 'Your Recovery Phrase' : 'Confirm Recovery Phrase'} subtitle={step === 'reveal' ? 'Write these 12 words down and store them offline.' : 'Type the words again in the same order.'} />
      {step === 'reveal' ? (
        <>
          <Card className="relative overflow-hidden border-slate-800 bg-slate-900/70 p-5">
            {!revealed && (
              <button onClick={() => setRevealed(true)} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/95 backdrop-blur-sm">
                <Eye className="h-8 w-8 text-lime-300" />
                <span className="text-sm font-medium text-slate-200">Tap to reveal</span>
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {words.map((w, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/50 px-3 py-2.5">
                  <span className="text-[10px] font-mono text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-medium text-white">{w}</span>
                </div>
              ))}
            </div>
          </Card>
          {revealed && (
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={handleCopy} className="flex-1 border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
                {copied ? <><Check className="mr-2 h-4 w-4 text-lime-300" /> Copied</> : <><Copy className="mr-2 h-4 w-4" /> Copy</>}
              </Button>
              <Button variant="outline" onClick={() => setRevealed(false)} className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800"><EyeOff className="h-4 w-4" /></Button>
            </div>
          )}
          <div className="flex-1" />
          <Button onClick={() => setStep('confirm')} disabled={!revealed} className="h-14 w-full rounded-2xl bg-lime-400 text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300 disabled:opacity-40">
            I have stored it <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </>
      ) : (
        <ConfirmPhrase expected={wallet.mnemonic} onBack={() => setStep('reveal')} onConfirmed={onDone} />
      )}
    </motion.div>
  );
};

export const ImportWallet = ({ onBack, onImported }) => {
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = async () => {
    setError(''); setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const w = importFromMnemonic(phrase);
      onImported(w);
    } catch (e) { setError(e.message || 'Invalid recovery phrase.'); }
    setLoading(false);
  };
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ScreenHeader onBack={onBack} title="Import Wallet" subtitle="Enter your 12 or 24-word recovery phrase. It is processed locally on this device." />
      <Textarea value={phrase} onChange={(e) => { setPhrase(e.target.value); setError(''); }} placeholder="example: silent laptop river ..." className="min-h-[160px] resize-none rounded-2xl border-slate-700 bg-slate-900/70 text-sm text-white placeholder:text-slate-500 focus-visible:ring-lime-400" />
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}
      <div className="flex-1" />
      <Button onClick={handle} disabled={loading || !phrase.trim()} className="h-14 w-full rounded-2xl bg-lime-400 text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300 disabled:opacity-40">
        {loading ? <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Validating...</> : <>Continue <ArrowRight className="ml-2 h-5 w-5" /></>}
      </Button>
    </motion.div>
  );
};

export const SetupPassword = ({ onBack, onDone }) => {
  const [name, setName] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = name.trim().length >= 2 && pwd.length >= 6 && pwd === confirm && !loading;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await onDone({ userName: name.trim(), password: pwd });
    } catch (err) {
      setError(err.message || 'Registration failed.');
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <ScreenHeader onBack={onBack} title="Create Your Cavendish Account" subtitle="Create an account name and vault password. Your wallets are encrypted with this password on this device." />

      <form onSubmit={submit} className="space-y-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Your name</div>
          <div className="relative">
            <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="for example: Alex" autoFocus className="h-12 rounded-xl border-slate-700 bg-slate-900/70 pl-9 text-sm text-white placeholder:text-slate-500" />
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Password (min. 6 characters)</div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <Input type={show ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="strong password" className="h-12 rounded-xl border-slate-700 bg-slate-900/70 pl-9 pr-10 text-sm text-white" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-slate-500 hover:text-white">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">Confirm password</div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <Input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="repeat password" className="h-12 rounded-xl border-slate-700 bg-slate-900/70 pl-9 text-sm text-white" />
          </div>
          {confirm && pwd !== confirm && <p className="mt-1 text-xs text-red-400">Passwords do not match.</p>}
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
          &#9888;&#65039; This password CANNOT be reset. Store it safely. Your recovery phrase remains the final backup.
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <Button type="submit" disabled={!canSubmit} className="h-14 w-full rounded-2xl bg-lime-400 text-base font-semibold text-slate-950 shadow-lg shadow-lime-400/20 hover:bg-lime-300 disabled:opacity-40">
          {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating account...</> : <>Create & Sign in <ArrowRight className="ml-2 h-5 w-5" /></>}
        </Button>
      </form>
    </motion.div>
  );
};
