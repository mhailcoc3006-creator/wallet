'use client';

import { Shield } from 'lucide-react';

export const BrandMark = ({ size = 40 }) => (
  <div
    className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-lg shadow-emerald-500/30"
    style={{ width: size, height: size }}
  >
    <Shield className="text-white" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.4} />
    <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20" />
  </div>
);

export const Brand = ({ size = 40 }) => (
  <div className="flex items-center gap-3">
    <BrandMark size={size} />
    <div>
      <div className="text-lg font-bold tracking-tight text-white">Kavach</div>
      <div className="-mt-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-400/80">Wallet</div>
    </div>
  </div>
);

export const shortAddr = (a, l = 6, r = 4) => (a ? `${a.slice(0, l)}...${a.slice(-r)}` : '');

export const fmtUsd = (n) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n, digits = 6) =>
  (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

export const ChainIcon = ({ chain, size = 44 }) => (
  <div
    className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${chain.gradient} text-[10px] font-bold text-white shadow-md`}
    style={{ width: size, height: size }}
  >
    {chain.logoText}
  </div>
);
