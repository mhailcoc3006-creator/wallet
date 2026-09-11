'use client';

import { motion } from 'framer-motion';
import { Eye, EyeOff, Copy, Send, QrCode, KeyRound, ChevronDown, Sparkles, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CHAINS } from '@/lib/chains';
import { ChainIcon, fmtUsd, fmtNum, shortAddr } from './shared';

export const PortfolioTab = ({
  activeWallet, walletCount, addresses, balances, prices, loading, totalUsd, hidden, setHidden,
  onSend, onReceive, onOpenPhrase, onOpenWalletList,
}) => {
  const primaryAddress = addresses?.ethereum || activeWallet?.address;

  const copyAddress = async (addr) => {
    await navigator.clipboard.writeText(addr);
     toast.success('Address copied.');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Wallet header — switcher */}
      <button onClick={onOpenWalletList} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-left hover:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
            {activeWallet?.source === 'padasankara' ? <Sparkles className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{activeWallet?.name || 'No wallet'}</div>
             <div className="text-[10px] text-slate-500">{walletCount} wallet{walletCount === 1 ? '' : 's'} total • tap to switch</div>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {/* Portfolio card */}
      <Card className="relative overflow-hidden border-lime-400/15 bg-gradient-to-br from-[#101610] via-[#0b100c] to-[#172100] p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-lime-400/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
             <span className="text-xs uppercase tracking-widest text-slate-400">Active Portfolio</span>
            <button onClick={() => setHidden(!hidden)} className="text-slate-400 hover:text-white">
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 text-4xl font-bold text-white">
            {loading ? <Skeleton className="h-10 w-40 bg-slate-800" /> : hidden ? '••••••' : (
              <>
                <span className="text-slate-500">$</span>
                {totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            {primaryAddress && (
              <button onClick={() => copyAddress(primaryAddress)} className="group flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">
                <span className="font-mono">{shortAddr(primaryAddress)}</span>
                <Copy className="h-3 w-3 text-slate-500 group-hover:text-lime-300" />
              </button>
            )}
            <Badge className="bg-lime-400/15 text-lime-300 hover:bg-lime-400/20">Multi-chain</Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button onClick={onSend} disabled={!activeWallet} className="h-11 rounded-xl bg-lime-400 text-slate-950 shadow-md shadow-lime-400/15 hover:bg-lime-300 disabled:opacity-40">
               <Send className="mr-2 h-4 w-4" /> Send
            </Button>
            <Button onClick={onReceive} disabled={!activeWallet} className="h-11 rounded-xl bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-40">
               <QrCode className="mr-2 h-4 w-4" /> Receive
            </Button>
          </div>
        </div>
      </Card>

      {/* Assets */}
      <div>
        <div className="mb-3 flex items-center justify-between">
           <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assets across {CHAINS.length} chains</h3>
          <span className="text-xs text-slate-500">Native tokens</span>
        </div>
        <div className="space-y-2">
          {CHAINS.map((chain, idx) => (
            <ChainRow
              key={chain.id} chain={chain}
              address={addresses?.[chain.id]}
              balance={balances?.[chain.id]}
              price={prices?.[chain.coinGeckoId]?.usd}
              change24h={prices?.[chain.coinGeckoId]?.usd_24h_change}
              loading={loading} hidden={hidden} index={idx}
            />
          ))}
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 flex-shrink-0 text-lime-300" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Recovery Phrase</div>
             <div className="text-xs text-slate-400">Back up your active wallet. Store it offline.</div>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenPhrase} disabled={!activeWallet} className="border-slate-700 bg-slate-800/60 text-white hover:bg-slate-700">
            Lihat
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

const ChainRow = ({ chain, address, balance, price, change24h, loading, hidden, index }) => {
  const balNum = parseFloat(balance || '0');
  const usd = balNum * (price || 0);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Card className="flex items-center gap-3 border-slate-800 bg-slate-900/60 p-3 hover:bg-slate-900">
        <ChainIcon chain={chain} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{chain.name}</span>
            {!chain.canSend && <Badge className="h-4 px-1.5 py-0 text-[9px] bg-slate-800 text-slate-400 hover:bg-slate-800">RX only</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
            <span>{chain.symbol}</span>
            {price ? <span>· ${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span> : null}
            {typeof change24h === 'number' && (
              <span className={change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
              </span>
            )}
            {address && <span className="text-[10px] font-mono text-slate-600">· {shortAddr(address, 4, 4)}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {loading ? (
            <><Skeleton className="mb-1 h-4 w-16 bg-slate-800" /><Skeleton className="h-3 w-12 bg-slate-800" /></>
          ) : hidden ? (
            <><div className="text-sm font-semibold text-white">••••</div><div className="text-xs text-slate-500">••</div></>
          ) : (
            <><div className="text-sm font-semibold text-white">{fmtNum(balNum)}</div><div className="text-xs text-slate-500">{fmtUsd(usd)}</div></>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
