'use client';

export const BrandMark = ({ size = 40 }) => (
  <div
    className="relative flex items-center justify-center rounded-2xl bg-[#d7ff00] shadow-lg shadow-[#d7ff00]/25"
    style={{ width: size, height: size }}
  >
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="text-[#050806]"
      style={{ width: size * 0.66, height: size * 0.66 }}
      fill="none"
    >
      <path d="M35.5 10.5C31.8 8.2 27.3 7 22.5 7 13.9 7 7 13.9 7 22.5S13.9 38 22.5 38c4.8 0 9.3-1.2 13-3.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M20 27.5c1.1-7.8 5.5-12.2 13.2-13.3-1.1 7.8-5.5 12.2-13.2 13.3Z" fill="currentColor" />
      <path d="M20 27.5 31.2 16.3" stroke="#d7ff00" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div className="absolute inset-0 rounded-2xl ring-1 ring-black/15" />
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
