'use client';

// Wallet list — tampilkan semua wallet, sorted by portfolioUsd desc.
// Fitur: switch active, rename, delete, refresh saldo semua wallet.

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import {
  X, Wallet, Check, Trash2, RefreshCw, Sparkles, Import, Search, Edit3, CheckSquare, Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet } from './receive';
import { useWalletStore } from '@/lib/store';
import { CHAINS } from '@/lib/chains';
import { fmtUsd, shortAddr } from './shared';

// Batch fetch native balance on Ethereum via public RPC (cheap check).
async function fetchEthBalance(address) {
  try {
    const res = await fetch('https://eth.llamarpc.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 }),
    });
    const j = await res.json();
    if (!j.result) return 0;
    return Number(ethers.formatEther(BigInt(j.result)));
  } catch { return 0; }
}

export const WalletListSheet = ({ onClose, prices }) => {
  const wallets = useWalletStore((s) => s.wallets);
  const activeWalletId = useWalletStore((s) => s.activeWalletId);
  const setActive = useWalletStore((s) => s.setActiveWallet);
  const removeWallet = useWalletStore((s) => s.removeWallet);
  const renameWallet = useWalletStore((s) => s.renameWallet);
  const updateWalletPortfolio = useWalletStore((s) => s.updateWalletPortfolio);

  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const removeAllWallets = useWalletStore((s) => s.removeAllWallets);

  const toggleSel = (id) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };
  const selectAllVisible = (list) => setSelectedIds(new Set(list.map((w) => w.id)));
  const clearSel = () => setSelectedIds(new Set());
  const deleteSelected = () => {
    const n = selectedIds.size;
    if (n === 0) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${n} selected wallet${n === 1 ? '' : 's'}? This cannot be undone.`)) return;
    selectedIds.forEach((id) => removeWallet(id));
    toast.success(`${n} wallet${n === 1 ? '' : 's'} deleted.`);
    setSelectedIds(new Set());
    setSelectMode(false);
  };
  const deleteAll = () => {
    const n = wallets.length;
    if (n === 0) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ALL ${n} wallets? You will NOT be able to access them again without their recovery phrases.`)) return;
    removeAllWallets();
    toast.success(`All ${n} wallets deleted.`);
    setSelectedIds(new Set());
    setSelectMode(false);
    onClose();
  };

  const ethPrice = prices?.ethereum?.usd || 0;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = wallets;
    if (query) {
      list = list.filter(
        (w) => w.name.toLowerCase().includes(query) || w.address.toLowerCase().includes(query)
      );
    }
    return [...list].sort((a, b) => (b.portfolioUsd || 0) - (a.portfolioUsd || 0));
  }, [wallets, q]);

  const totalUsd = useMemo(() => wallets.reduce((s, w) => s + (w.portfolioUsd || 0), 0), [wallets]);

  const refreshAll = async () => {
    if (!ethPrice) { toast.error('ETH price has not loaded. Refresh Portfolio first.'); return; }
    setRefreshing(true);
    setProgress({ done: 0, total: wallets.length });
    const BATCH_SIZE = 8;
    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      const batch = wallets.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((w) => fetchEthBalance(w.address)));
      results.forEach((eth, idx) => {
        const wallet = batch[idx];
        const usd = eth * ethPrice;
        updateWalletPortfolio(wallet.id, usd);
      });
      setProgress({ done: Math.min(i + BATCH_SIZE, wallets.length), total: wallets.length });
      await new Promise((r) => setTimeout(r, 150)); // gentle rate limit
    }
    setRefreshing(false);
    setProgress(null);
    toast.success(`Finished refreshing ${wallets.length} wallet${wallets.length === 1 ? '' : 's'}.`);
  };

  const handleRename = (id) => {
    if (editName.trim()) renameWallet(id, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (w) => {
    if (typeof window !== 'undefined' && window.confirm(`Delete wallet "${w.name}"? You will not be able to access it again without its recovery phrase.`)) {
      removeWallet(w.id);
      toast.success('Wallet deleted.');
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white">My Wallets</div>
          <div className="text-xs text-slate-400">{wallets.length} wallet{wallets.length === 1 ? '' : 's'} • Total {fmtUsd(totalUsd)}</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
      </div>

      {/* Toolbar: select mode + delete all */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => { setSelectMode(!selectMode); clearSel(); }}
           className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${selectMode ? 'border-lime-300/40 bg-lime-400/10 text-lime-200' : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-900'}`}
        >
          <CheckSquare className="h-3.5 w-3.5" /> {selectMode ? 'Cancel Selection' : 'Select Multiple'}
        </button>
        <button
          onClick={deleteAll}
          disabled={wallets.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete All
        </button>
      </div>

      {/* Select mode action bar */}
      {selectMode && (
         <div className="mb-3 flex items-center justify-between rounded-xl border border-lime-300/30 bg-lime-400/5 px-3 py-2">
           <div className="text-xs text-lime-100">{selectedIds.size} selected</div>
          <div className="flex gap-2">
             <button onClick={() => selectAllVisible(filtered)} className="text-[11px] text-lime-300 hover:text-lime-200">Select all</button>
            {selectedIds.size > 0 && <button onClick={clearSel} className="text-[11px] text-slate-400 hover:text-white">Reset</button>}
            <button
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> Delete ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Search + refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama/alamat..." className="h-11 rounded-xl border-slate-700 bg-slate-900/70 pl-9 text-xs text-white placeholder:text-slate-600" />
        </div>
         <Button size="icon" onClick={refreshAll} disabled={refreshing || wallets.length === 0} className="h-11 w-11 flex-shrink-0 rounded-xl bg-lime-400/15 text-lime-300 hover:bg-lime-400/25">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {progress && (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Refreshing saldo...</span>
            <span className="font-mono text-slate-300">{progress.done} / {progress.total}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-emerald-500" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-500">No matching wallets.</div>
        )}
        {filtered.map((w, i) => {
          const active = w.id === activeWalletId;
          const isPS = w.source === 'padasankara';
          const hasBal = (w.portfolioUsd || 0) > 0;
          return (
            <motion.div key={w.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}>
             <Card className={`border p-3 ${active ? 'border-lime-300/40 bg-lime-400/5' : selectedIds.has(w.id) ? 'border-lime-300/60 bg-lime-400/10' : 'border-slate-800 bg-slate-900/60'}`}>
                <div className="flex items-center gap-3">
                  {selectMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSel(w.id); }}
                       className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition ${selectedIds.has(w.id) ? 'border-lime-300 bg-lime-400' : 'border-slate-600 bg-slate-800'}`}
                    >
                      {selectedIds.has(w.id) && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  )}
                  <button onClick={() => { if (selectMode) { toggleSel(w.id); return; } setActive(w.id); toast.success(`Switched to ${w.name}`); onClose(); }} className="flex flex-1 items-center gap-3 text-left">
                     <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${active ? 'bg-lime-400/15 text-lime-300' : isPS ? 'bg-lime-400/10 text-lime-200' : 'bg-slate-800 text-slate-400'}`}>
                      {active ? <Check className="h-4 w-4" /> : isPS ? <Sparkles className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {editingId === w.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(w.id); }}
                            autoFocus
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          />
                          <button onClick={() => handleRename(w.id)} className="text-xs text-emerald-400">OK</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-white">{w.name}</span>
                          {isPS && <Badge className="h-4 bg-fuchsia-500/20 px-1.5 py-0 text-[8px] text-fuchsia-300 hover:bg-fuchsia-500/20">PS</Badge>}
                        </div>
                      )}
                      <div className="font-mono text-[10px] text-slate-500">{shortAddr(w.address, 6, 6)}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${hasBal ? 'text-emerald-300' : 'text-slate-500'}`}>{fmtUsd(w.portfolioUsd || 0)}</div>
                      <div className="text-[9px] text-slate-600">{w.portfolioUpdatedAt ? 'ETH est.' : 'unchecked'}</div>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => { setEditingId(w.id); setEditName(w.name); }} className="rounded bg-slate-800 p-1 text-slate-400 hover:text-white">
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDelete(w)} className="rounded bg-slate-800 p-1 text-slate-400 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </Sheet>
  );
};
