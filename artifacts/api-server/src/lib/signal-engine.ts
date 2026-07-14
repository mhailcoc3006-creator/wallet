// Signal Engine — combines technical + futures market analysis + validation + grading.
// All scores are deterministic from indicators, no randomness.
// Ported from the original Next.js app's lib/signal-engine.js.

import {
  EMA, RSI, MACD, StochRSI, ATR, ADX, BollingerBands, findSwings,
} from './indicators';

// Weights for overall confidence (total 100)
const WEIGHTS = {
  trend: 0.30,
  momentum: 0.25,
  volume: 0.15,
  structure: 0.15,
  futures: 0.15,
};

function clamp(v: number, mn: number, mx: number) { return Math.max(mn, Math.min(mx, v)); }
function last(arr: (number | null)[]): number | null { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i] as number; return null; }
function nthLast(arr: (number | null)[], n: number): number | null {
  const filtered = arr.filter((v) => v != null) as number[];
  return filtered[filtered.length - 1 - n] ?? null;
}

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  takerBuyVolume?: number;
}

export interface GenerateSignalInput {
  candles: Candle[];
  symbol: string;
  interval: string;
  fundingRate?: number;
  openInterest?: number;
  openInterestChangePct?: number;
  longShortRatio?: number;
}

export function generateSignal(data: GenerateSignalInput) {
  const { candles, symbol, interval } = data;
  if (!candles || candles.length < 60) throw new Error('Data candle terlalu sedikit (min 60).');

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const takerBuyVols = candles.map((c) => c.takerBuyVolume || 0);

  // Indicators
  const ema20Arr = EMA(closes, 20);
  const ema50Arr = EMA(closes, 50);
  const ema200Arr = EMA(closes, 200);
  const rsiArr = RSI(closes, 14);
  const macdRes = MACD(closes, 12, 26, 9);
  const stochRsi = StochRSI(closes, 14, 14, 3, 3);
  const atrArr = ATR(highs, lows, closes, 14);
  const adxRes = ADX(highs, lows, closes, 14);
  const bb = BollingerBands(closes, 20, 2);

  const price = closes[closes.length - 1];
  const ema20 = last(ema20Arr) as number;
  const ema50 = last(ema50Arr) as number;
  const ema200 = (last(ema200Arr) ?? last(ema50Arr)) as number; // fallback if candles < 200
  const rsi = last(rsiArr);
  const prevRsi = nthLast(rsiArr, 1);
  const macdHist = last(macdRes.histogram);
  const prevMacdHist = nthLast(macdRes.histogram, 1);
  const macdLine = last(macdRes.macd);
  const stochK = last(stochRsi.k);
  const stochD = last(stochRsi.d);
  const adx = last(adxRes.adx) as number;
  const plusDI = last(adxRes.plusDI);
  const minusDI = last(adxRes.minusDI);
  const atr = last(atrArr) as number;
  const bbWidth = last(bb.width);

  // ─── TREND SCORE (0-100) ───
  let trendScore = 50;
  let trendDirection = 'neutral';
  if (ema20 > ema50 && ema50 > ema200) { trendScore = 90; trendDirection = 'bullish'; }
  else if (ema20 > ema50) { trendScore = 68; trendDirection = 'bullish'; }
  else if (ema20 < ema50 && ema50 < ema200) { trendScore = 10; trendDirection = 'bearish'; }
  else if (ema20 < ema50) { trendScore = 32; trendDirection = 'bearish'; }
  // Adjust for ADX trend strength
  let trendStrength = 'weak';
  if (adx != null) {
    if (adx > 40) trendStrength = 'very strong';
    else if (adx > 25) trendStrength = 'strong';
    else if (adx > 20) trendStrength = 'moderate';
    // If trend is weak, pull score toward neutral 50
    if (adx < 20) trendScore = 50 + (trendScore - 50) * 0.4;
    // DI+ / DI- can amplify direction
    if (plusDI != null && minusDI != null) {
      const diDiff = plusDI - minusDI;
      trendScore = clamp(trendScore + diDiff * 0.3, 0, 100);
    }
  }
  // Price vs EMA20 distance (in ATR units) — avoid over-extension
  if (atr) {
    const distFromEma20 = (price - ema20) / atr;
    if (distFromEma20 > 3) trendScore = Math.min(trendScore, 80); // over-extended long
    if (distFromEma20 < -3) trendScore = Math.max(trendScore, 20);
  }

  // ─── MOMENTUM SCORE (0-100) ───
  let momentumScore = 50;
  // RSI contribution
  if (rsi != null) {
    if (rsi > 75) momentumScore -= 20; // overbought
    else if (rsi > 60) momentumScore += 15;
    else if (rsi > 50) momentumScore += 8;
    else if (rsi > 40) momentumScore -= 8;
    else if (rsi > 25) momentumScore -= 15;
    else momentumScore -= 5; // oversold could bounce
  }
  // RSI momentum direction
  if (rsi != null && prevRsi != null) {
    momentumScore += clamp((rsi - prevRsi) * 1.5, -10, 10);
  }
  // MACD histogram
  if (macdHist != null && prevMacdHist != null) {
    if (macdHist > 0 && macdHist > prevMacdHist) momentumScore += 15;
    else if (macdHist > 0) momentumScore += 6;
    else if (macdHist < 0 && macdHist < prevMacdHist) momentumScore -= 15;
    else if (macdHist < 0) momentumScore -= 6;
  }
  // Stoch RSI
  if (stochK != null && stochD != null) {
    if (stochK < 20 && stochK > stochD) momentumScore += 8; // oversold bull cross
    else if (stochK > 80 && stochK < stochD) momentumScore -= 8; // overbought bear cross
  }
  momentumScore = clamp(momentumScore, 0, 100);

  // ─── VOLUME SCORE ───
  const recentVol = volumes[volumes.length - 1];
  const avg20Vol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20; // exclude current
  const volSpikePct = avg20Vol > 0 ? ((recentVol - avg20Vol) / avg20Vol) * 100 : 0;
  const recentBuyVol = takerBuyVols[takerBuyVols.length - 1];
  const hasBuyVol = takerBuyVols.some((v) => v > 0);
  const buyRatio = hasBuyVol && recentVol > 0 ? recentBuyVol / recentVol : 0.5;

  let volumeScore = 50 + clamp(volSpikePct * 0.5, -30, 30);
  // Buy/Sell pressure bias
  const buyBias = (buyRatio - 0.5) * 100; // -50..+50
  volumeScore += clamp(buyBias * 0.4, -20, 20);
  volumeScore = clamp(volumeScore, 0, 100);

  // ─── MARKET STRUCTURE SCORE ───
  const { swingHighs, swingLows } = findSwings(highs, lows, 3);
  const lastSH = swingHighs[swingHighs.length - 1];
  const prevSH = swingHighs[swingHighs.length - 2];
  const lastSL = swingLows[swingLows.length - 1];
  const prevSL = swingLows[swingLows.length - 2];

  let structureScore = 50;
  let hh = false, ll = false, hl = false, lh = false;
  let bos: string | null = null; // 'bullish' | 'bearish' | null
  let choch: string | null = null;
  let resistance: number | null = null, support: number | null = null;
  let breakout = false, breakdown = false;

  if (lastSH && prevSH) {
    hh = lastSH.price > prevSH.price;
    lh = lastSH.price < prevSH.price;
    resistance = lastSH.price;
    if (price > lastSH.price * 1.001) { breakout = true; bos = 'bullish'; }
  }
  if (lastSL && prevSL) {
    ll = lastSL.price < prevSL.price;
    hl = lastSL.price > prevSL.price;
    support = lastSL.price;
    if (price < lastSL.price * 0.999) { breakdown = true; bos = 'bearish'; }
  }
  // Detect CHoCH: prior structure was bearish (LH+LL) but now BOS bullish (or vice versa)
  if (bos === 'bullish' && (lh || ll)) choch = 'bullish';
  if (bos === 'bearish' && (hh || hl)) choch = 'bearish';

  if (hh && hl) structureScore = 78;
  if (ll && lh) structureScore = 22;
  if (breakout) structureScore = Math.min(100, structureScore + 20);
  if (breakdown) structureScore = Math.max(0, structureScore - 20);
  if (choch === 'bullish') structureScore = Math.min(100, structureScore + 8);
  if (choch === 'bearish') structureScore = Math.max(0, structureScore - 8);

  // ─── FUTURES SCORE ───
  const fundingPct = (data.fundingRate || 0) * 100; // to %
  const oiChange = data.openInterestChangePct || 0;
  const lsr = data.longShortRatio || 1;

  let futuresScore = 50;
  // Funding rate: extreme positive = crowded longs (bearish), negative = crowded shorts (bullish)
  if (fundingPct > 0.15) futuresScore -= 22;
  else if (fundingPct > 0.08) futuresScore -= 12;
  else if (fundingPct > 0.04) futuresScore -= 5;
  else if (fundingPct < -0.15) futuresScore += 22;
  else if (fundingPct < -0.08) futuresScore += 12;
  else if (fundingPct < -0.04) futuresScore += 5;
  // OI trend
  if (oiChange > 8) futuresScore += 12;
  else if (oiChange > 3) futuresScore += 6;
  else if (oiChange < -8) futuresScore -= 12;
  else if (oiChange < -3) futuresScore -= 6;
  // Long/Short ratio (contrarian bias when extreme)
  if (lsr > 3) futuresScore -= 10;
  else if (lsr > 2) futuresScore -= 5;
  else if (lsr < 0.5) futuresScore += 10;
  else if (lsr < 0.75) futuresScore += 5;
  futuresScore = clamp(futuresScore, 0, 100);

  // ─── OVERALL CONFIDENCE ───
  const overall =
    trendScore * WEIGHTS.trend +
    momentumScore * WEIGHTS.momentum +
    volumeScore * WEIGHTS.volume +
    structureScore * WEIGHTS.structure +
    futuresScore * WEIGHTS.futures;

  // ─── SIGNAL CLASSIFICATION ───
  let signal: string, side: string;
  if (overall >= 78) { signal = 'Strong Buy'; side = 'long'; }
  else if (overall >= 62) { signal = 'Buy'; side = 'long'; }
  else if (overall >= 38) { signal = 'Hold'; side = 'none'; }
  else if (overall >= 22) { signal = 'Sell'; side = 'short'; }
  else { signal = 'Strong Sell'; side = 'short'; }

  // ─── VALIDATION GATES ───
  const validationReasons: string[] = [];
  const invalidateBuy = (reason: string) => { if (side === 'long') { signal = 'Hold'; side = 'none'; validationReasons.push(reason); } };
  const invalidateSell = (reason: string) => { if (side === 'short') { signal = 'Hold'; side = 'none'; validationReasons.push(reason); } };
  // No BUY if:
  if (trendScore < 25) invalidateBuy('Trend bearish kuat');
  if (rsi != null && rsi > 82) invalidateBuy('RSI overbought ekstrem');
  if (fundingPct > 0.18) invalidateBuy('Funding rate terlalu tinggi (longs kepadatan)');
  if (oiChange < -12) invalidateBuy('Open Interest turun tajam');
  if (volumeScore < 25) invalidateBuy('Volume terlalu rendah');
  if (structureScore < 25) invalidateBuy('Market structure bearish');
  // No SELL if:
  if (trendScore > 75) invalidateSell('Trend bullish kuat');
  if (rsi != null && rsi < 18) invalidateSell('RSI oversold ekstrem');
  if (fundingPct < -0.18) invalidateSell('Funding rate terlalu rendah (shorts kepadatan)');
  if (oiChange > 12 && futuresScore > 60) invalidateSell('OI naik dengan bias bullish');
  if (structureScore > 75) invalidateSell('Market structure bullish');

  // ─── POSITION MANAGEMENT ───
  const atrValue = atr || price * 0.01;
  const entry = price;
  let tp1: number | null = null, tp2: number | null = null, tp3: number | null = null, sl: number | null = null, trailing: number | null = null, breakEven: number | null = null;

  if (side === 'long') {
    sl = entry - atrValue * 1.5;
    tp1 = entry + atrValue * 1.5;
    tp2 = entry + atrValue * 3;
    tp3 = entry + atrValue * 4.5;
    trailing = atrValue * 1.2;
    breakEven = entry + atrValue * 0.8;
  } else if (side === 'short') {
    sl = entry + atrValue * 1.5;
    tp1 = entry - atrValue * 1.5;
    tp2 = entry - atrValue * 3;
    tp3 = entry - atrValue * 4.5;
    trailing = atrValue * 1.2;
    breakEven = entry - atrValue * 0.8;
  }

  const rr = sl != null && tp2 != null ? Math.abs((tp2 - entry) / (entry - sl)) : null;

  // ─── LEVERAGE + RISK ───
  const volPct = (atrValue / price) * 100; // ATR as % of price
  let leverage: number;
  if (volPct < 0.5) leverage = 25;
  else if (volPct < 1) leverage = 15;
  else if (volPct < 2) leverage = 10;
  else if (volPct < 3.5) leverage = 5;
  else if (volPct < 5) leverage = 3;
  else leverage = 2;
  // Lower confidence → lower leverage
  if (overall < 70) leverage = Math.min(leverage, 10);
  if (overall < 60) leverage = Math.min(leverage, 5);
  if (side === 'none') leverage = 0;

  let riskLevel: string;
  if (leverage === 0) riskLevel = 'N/A';
  else if (volPct < 1 && overall > 75) riskLevel = 'Low';
  else if (volPct < 2.5 && overall > 65) riskLevel = 'Medium';
  else if (volPct < 4) riskLevel = 'High';
  else riskLevel = 'Very High';

  // Position size recommendation (as % of equity)
  const riskPerTrade = 0.02; // 2% of equity
  const stopDistancePct = sl != null ? Math.abs((entry - sl) / entry) : 0.02;
  const positionSizePct = stopDistancePct > 0 ? clamp((riskPerTrade / stopDistancePct) * 100, 1, 100) : 0;

  // ─── GRADE ───
  let grade: string;
  if (side === 'none') grade = 'C';
  else if (overall >= 85 && (rr ?? 0) >= 2.5 && adx > 25 && volumeScore > 55) grade = 'A+';
  else if (overall >= 75 && (rr ?? 0) >= 2 && adx > 20) grade = 'A';
  else if (overall >= 65 && (rr ?? 0) >= 1.5) grade = 'B+';
  else if (overall >= 55) grade = 'B';
  else grade = 'C';

  // ─── PROBABILITY ───
  // Simple mapping: 50 confidence → 50% prob; scale factor 0.85
  const probability = Math.round(clamp(50 + (overall - 50) * 0.85, 5, 95));

  // ─── EXPLANATION ───
  const explanation: string[] = [];
  // Trend
  if (ema20 > ema50 && ema50 > ema200) explanation.push('EMA20 di atas EMA50 dan EMA200 — struktur bullish kuat.');
  else if (ema20 > ema50) explanation.push('EMA20 melewati EMA50 — momentum jangka pendek bullish.');
  else if (ema20 < ema50 && ema50 < ema200) explanation.push('EMA20 di bawah EMA50 dan EMA200 — struktur bearish kuat.');
  else if (ema20 < ema50) explanation.push('EMA20 di bawah EMA50 — momentum jangka pendek bearish.');
  if (adx != null) explanation.push(`ADX ${adx.toFixed(0)} — kekuatan tren ${trendStrength}.`);
  // Momentum
  if (rsi != null) {
    if (rsi > 70) explanation.push(`RSI ${rsi.toFixed(0)} — overbought, waspada koreksi.`);
    else if (rsi > 55) explanation.push(`RSI ${rsi.toFixed(0)} — sehat, masih ada ruang naik.`);
    else if (rsi > 45) explanation.push(`RSI ${rsi.toFixed(0)} — netral.`);
    else if (rsi > 30) explanation.push(`RSI ${rsi.toFixed(0)} — momentum melemah.`);
    else explanation.push(`RSI ${rsi.toFixed(0)} — oversold, potensi rebound.`);
  }
  if (macdHist != null && prevMacdHist != null) {
    if (macdHist > 0 && macdHist > prevMacdHist) explanation.push('MACD histogram positif dan menguat.');
    else if (macdHist < 0 && macdHist < prevMacdHist) explanation.push('MACD histogram negatif dan melemah.');
  }
  // Volume
  if (Math.abs(volSpikePct) > 5) {
    const arrow = volSpikePct > 0 ? 'meningkat' : 'menurun';
    explanation.push(`Volume ${arrow} ${Math.abs(volSpikePct).toFixed(0)}% dibanding rata-rata 20 candle.`);
  }
  if (Math.abs(buyBias) > 10) {
    explanation.push(`Buy vs Sell taker: ${(buyRatio * 100).toFixed(0)}% buy — ${buyBias > 0 ? 'tekanan beli' : 'tekanan jual'} dominan.`);
  }
  // Structure
  if (breakout && resistance != null) explanation.push(`Harga breakout resistance ${resistance.toFixed(2)} dengan konfirmasi Higher High.`);
  else if (breakdown && support != null) explanation.push(`Harga breakdown support ${support.toFixed(2)} — Lower Low terbentuk.`);
  else if (hh && hl) explanation.push('Struktur Higher High + Higher Low — uptrend intact.');
  else if (ll && lh) explanation.push('Struktur Lower Low + Lower High — downtrend intact.');
  if (choch) explanation.push(`CHoCH ${choch} — perubahan karakter tren terdeteksi.`);
  // Futures
  if (Math.abs(fundingPct) < 0.03) explanation.push(`Funding rate ${fundingPct.toFixed(3)}% — netral.`);
  else if (fundingPct > 0.08) explanation.push(`Funding rate ${fundingPct.toFixed(3)}% — longs bayar tinggi, hati-hati.`);
  else if (fundingPct < -0.08) explanation.push(`Funding rate ${fundingPct.toFixed(3)}% — shorts bayar tinggi, potensi squeeze bullish.`);
  else explanation.push(`Funding rate ${fundingPct.toFixed(3)}%.`);
  if (Math.abs(oiChange) > 2) {
    const dir = oiChange > 0 ? 'naik' : 'turun';
    explanation.push(`Open Interest ${dir} ${Math.abs(oiChange).toFixed(1)}% — ${oiChange > 0 ? 'likuiditas masuk' : 'posisi ditutup'}.`);
  }
  if (lsr > 2 || lsr < 0.5) explanation.push(`Long/Short ratio ${lsr.toFixed(2)} — crowd ${lsr > 1 ? 'long' : 'short'}, waspada squeeze.`);
  // Validation notes
  if (validationReasons.length) {
    explanation.push(`⚠️ Sinyal di-invalidasi: ${validationReasons.join(', ')}. Menunggu konfirmasi.`);
  }
  // Conclusion
  if (side === 'long') {
    explanation.push(`Kesimpulan: peluang bullish ${overall >= 75 ? 'cukup tinggi' : 'moderat'} dengan probability ${probability}%.`);
  } else if (side === 'short') {
    explanation.push(`Kesimpulan: peluang bearish ${overall >= 75 ? 'cukup tinggi' : 'moderat'} dengan probability ${probability}%.`);
  } else {
    explanation.push('Kesimpulan: kondisi belum jelas, tunggu konfirmasi tren.');
  }

  return {
    symbol,
    interval,
    signal,
    side,
    entry: round(entry, 6),
    tp1: tp1 != null ? round(tp1, 6) : null,
    tp2: tp2 != null ? round(tp2, 6) : null,
    tp3: tp3 != null ? round(tp3, 6) : null,
    stop_loss: sl != null ? round(sl, 6) : null,
    trailing_stop: trailing != null ? round(trailing, 6) : null,
    break_even: breakEven != null ? round(breakEven, 6) : null,
    confidence: Math.round(overall),
    risk: riskLevel,
    risk_reward: rr != null ? round(rr, 2) : null,
    leverage,
    position_size_pct: Math.round(positionSizePct),
    probability,
    grade,
    scores: {
      trend: Math.round(trendScore),
      momentum: Math.round(momentumScore),
      volume: Math.round(volumeScore),
      structure: Math.round(structureScore),
      futures: Math.round(futuresScore),
      overall: Math.round(overall),
    },
    analysis: {
      trend: {
        direction: trendDirection,
        strength: trendStrength,
        ema20: round(ema20, 4),
        ema50: round(ema50, 4),
        ema200: ema200 != null ? round(ema200, 4) : null,
        adx: adx != null ? round(adx, 2) : null,
      },
      momentum: {
        rsi: rsi != null ? round(rsi, 2) : null,
        macd_line: macdLine != null ? round(macdLine, 4) : null,
        macd_hist: macdHist != null ? round(macdHist, 4) : null,
        stoch_k: stochK != null ? round(stochK, 2) : null,
        stoch_d: stochD != null ? round(stochD, 2) : null,
      },
      volume: {
        spike_pct: round(volSpikePct, 1),
        avg_20: round(avg20Vol, 2),
        buy_ratio: round(buyRatio, 3),
      },
      structure: {
        support: support != null ? round(support, 4) : null,
        resistance: resistance != null ? round(resistance, 4) : null,
        breakout, breakdown,
        higher_high: hh, higher_low: hl,
        lower_high: lh, lower_low: ll,
        bos, choch,
      },
      futures: {
        funding_rate_pct: round(fundingPct, 4),
        open_interest: data.openInterest,
        oi_change_pct: round(oiChange, 2),
        long_short_ratio: round(lsr, 3),
      },
      volatility: {
        atr: round(atrValue, 4),
        atr_pct: round(volPct, 2),
        bb_width: bbWidth != null ? round(bbWidth, 2) : null,
      },
    },
    explanation,
    validation_reasons: validationReasons,
    last_updated: Date.now(),
    source: undefined as string | undefined,
  };
}

function round(v: number, d = 2) {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}
