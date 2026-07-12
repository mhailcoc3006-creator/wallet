// Technical indicators \u2014 pure JS. Standar rumus TA-Lib / Wilder's smoothing.

export function EMA(values, period) {
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function SMA(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    out[i] = s / period;
  }
  return out;
}

export function RSI(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gainSum += d; else lossSum -= d;
  }
  let avgG = gainSum / period, avgL = lossSum / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

export function MACD(values, fast = 12, slow = 26, signal = 9) {
  const emaFast = EMA(values, fast);
  const emaSlow = EMA(values, slow);
  const macdLine = values.map((_, i) => (emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null));
  // Signal = EMA of MACD line; feed only valid part.
  const validIdx = macdLine.findIndex((v) => v != null);
  const validPart = validIdx >= 0 ? macdLine.slice(validIdx) : [];
  const sigEma = EMA(validPart, signal);
  const signalLine = new Array(validIdx >= 0 ? validIdx : values.length).fill(null).concat(sigEma);
  const histogram = macdLine.map((v, i) => (v != null && signalLine[i] != null ? v - signalLine[i] : null));
  return { macd: macdLine, signal: signalLine, histogram };
}

export function StochRSI(values, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3) {
  const rsi = RSI(values, rsiPeriod);
  const stoch = new Array(values.length).fill(null);
  for (let i = 0; i < rsi.length; i++) {
    if (rsi[i] == null) continue;
    const start = Math.max(0, i - stochPeriod + 1);
    const window = rsi.slice(start, i + 1).filter((x) => x != null);
    if (window.length < stochPeriod) continue;
    const mn = Math.min(...window);
    const mx = Math.max(...window);
    stoch[i] = mx === mn ? 0 : ((rsi[i] - mn) / (mx - mn)) * 100;
  }
  const smooth = (arr, n) => {
    const out = new Array(arr.length).fill(null);
    for (let i = n - 1; i < arr.length; i++) {
      const win = arr.slice(i - n + 1, i + 1);
      if (win.some((x) => x == null)) continue;
      out[i] = win.reduce((a, b) => a + b, 0) / n;
    }
    return out;
  };
  const k = smooth(stoch, kSmooth);
  const d = smooth(k, dSmooth);
  return { k, d };
}

export function ATR(highs, lows, closes, period = 14) {
  const n = highs.length;
  const trs = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    trs[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }
  const out = new Array(n).fill(null);
  if (n <= period) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trs[i];
  out[period] = sum / period;
  for (let i = period + 1; i < n; i++) {
    out[i] = (out[i - 1] * (period - 1) + trs[i]) / period;
  }
  return out;
}

export function ADX(highs, lows, closes, period = 14) {
  const n = highs.length;
  const plusDM = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);
  const trs = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = highs[i] - highs[i - 1];
    const dn = lows[i - 1] - lows[i];
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
    trs[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  // Wilder smoothed accumulators
  const smooth = (arr) => {
    const out = new Array(n).fill(null);
    if (n <= period) return out;
    let s = 0;
    for (let i = 1; i <= period; i++) s += arr[i];
    out[period] = s;
    for (let i = period + 1; i < n; i++) out[i] = out[i - 1] - out[i - 1] / period + arr[i];
    return out;
  };
  const tr14 = smooth(trs);
  const pdm14 = smooth(plusDM);
  const mdm14 = smooth(minusDM);
  const plusDI = new Array(n).fill(null);
  const minusDI = new Array(n).fill(null);
  const dx = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (tr14[i] == null || tr14[i] === 0) continue;
    const p = (pdm14[i] / tr14[i]) * 100;
    const m = (mdm14[i] / tr14[i]) * 100;
    plusDI[i] = p;
    minusDI[i] = m;
    dx[i] = p + m === 0 ? 0 : (Math.abs(p - m) / (p + m)) * 100;
  }
  const adx = new Array(n).fill(null);
  const startIdx = dx.findIndex((v) => v != null);
  if (startIdx < 0 || n < startIdx + period) return { adx, plusDI, minusDI };
  let sum = 0;
  for (let i = startIdx; i < startIdx + period; i++) sum += dx[i];
  adx[startIdx + period - 1] = sum / period;
  for (let i = startIdx + period; i < n; i++) {
    adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
  }
  return { adx, plusDI, minusDI };
}

export function BollingerBands(closes, period = 20, mult = 2) {
  const n = closes.length;
  const middle = new Array(n).fill(null);
  const upper = new Array(n).fill(null);
  const lower = new Array(n).fill(null);
  const width = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    const w = closes.slice(i - period + 1, i + 1);
    const mean = w.reduce((a, b) => a + b, 0) / period;
    const variance = w.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    middle[i] = mean;
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
    width[i] = ((mult * sd * 2) / mean) * 100; // % width
  }
  return { middle, upper, lower, width };
}

// Pivot-based swing detection (5-bar fractal by default)
export function findSwings(highs, lows, window = 3) {
  const swingHighs = [];
  const swingLows = [];
  for (let i = window; i < highs.length - window; i++) {
    let isH = true, isL = true;
    for (let j = 1; j <= window; j++) {
      if (highs[i - j] >= highs[i] || highs[i + j] >= highs[i]) isH = false;
      if (lows[i - j] <= lows[i] || lows[i + j] <= lows[i]) isL = false;
    }
    if (isH) swingHighs.push({ index: i, price: highs[i] });
    if (isL) swingLows.push({ index: i, price: lows[i] });
  }
  return { swingHighs, swingLows };
}
