'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EVM_CHAINS } from '@/lib/chains';
import { ChainIcon, fmtUsd } from './shared';
import { Fuel, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const GasTab = ({ prices }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gas');
      const j = await res.json();
      setData(j.chains || []);
    } catch (e) {
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return EVM_CHAINS.map((chain) => {
      const gd = data.find((d) => d.id === chain.id);
      const price = prices?.[chain.coinGeckoId]?.usd || 0;
      const usdCost = gd?.costNative ? gd.costNative * price : 0;
      return { chain, gwei: gd?.gwei, usdCost };
    });
  }, [data, prices]);

  // determine cheapest
  const cheapest = useMemo(() => {
    const withCost = rows.filter((r) => r.usdCost > 0);
    if (!withCost.length) return null;
    return withCost.reduce((a, b) => (a.usdCost < b.usdCost ? a : b));
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card className="border-lime-400/15 bg-gradient-to-br from-[#101610] via-[#0b100c] to-[#172100] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lime-400/15 p-2">
              <Fuel className="h-5 w-5 text-lime-300" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Gas Fee Estimator</div>
              <div className="text-xs text-slate-400">Real-time gas untuk transaksi native (21k gas)</div>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={load} className="h-8 w-8 text-slate-400 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {cheapest && (
          <div className="mt-4 rounded-xl border border-lime-300/30 bg-lime-400/10 p-3 text-xs text-lime-100">
            ⚡ Chain termurah saat ini: <span className="font-bold">{cheapest.chain.name}</span> ({fmtUsd(cheapest.usdCost)})
          </div>
        )}
      </Card>

      <div className="space-y-2">
        {rows.map(({ chain, gwei, usdCost }) => (
          <Card key={chain.id} className="flex items-center gap-3 border-slate-800 bg-slate-900/60 p-3">
            <ChainIcon chain={chain} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{chain.name}</div>
              <div className="text-xs text-slate-400">{chain.symbol}</div>
            </div>
            <div className="text-right">
              {loading ? (
                <>
                  <Skeleton className="mb-1 h-4 w-16 bg-slate-800" />
                  <Skeleton className="h-3 w-12 bg-slate-800" />
                </>
              ) : gwei != null ? (
                <>
                  <div className="text-sm font-semibold text-cyan-300">{gwei.toFixed(gwei < 1 ? 3 : 2)} gwei</div>
                  <div className="text-xs text-slate-500">~{fmtUsd(usdCost)}</div>
                </>
              ) : (
                <div className="text-xs text-slate-500">n/a</div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
