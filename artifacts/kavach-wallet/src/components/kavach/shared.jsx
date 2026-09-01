'use client';

const BRAND_LOGO_SRC = '/cavendish-angular-feather-logo-4k.jpg';

export const BrandMark = ({ size = 40 }) => (
  <div
    className="relative overflow-hidden rounded-2xl bg-[#d7ff00] shadow-lg shadow-[#d7ff00]/25"
    style={{ width: size, height: size }}
  >
    <img
      src={BRAND_LOGO_SRC}
      alt="Cavendish logo"
      draggable="false"
      className="h-full w-full select-none object-cover"
    >
    </img>
    <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/15" />
  </div>
);

export const Brand = ({ size = 40 }) => (
  <div className="flex items-center gap-3">
    <BrandMark size={size} />
    <div>
      <div className="text-lg font-bold tracking-tight text-white">Cavendish</div>
      <div className="-mt-0.5 text-[10px] uppercase tracking-[0.2em] text-lime-300/90">Wallet</div>
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
