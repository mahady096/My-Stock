// ==========================================
// 📊 indicators.js - সব ইন্ডিকেটর ক্যালকুলেশন
//    ডুপ্লিকেট কোড সরানোর জন্য সেন্ট্রাল ফাইল
//    ⚡ পারফরম্যান্স বুস্ট: ক্যাশিং (Memoization) যোগ করা হয়েছে
// ==========================================

// ==========================================
// 📦 ক্যাশ ম্যানেজমেন্ট (Memoization)
//    একই ডেটা ও প্যারামিটার দিয়ে বারবার কল করলে ক্যাশ থেকে রিটার্ন
// ==========================================

const indicatorCache = new Map();
const CACHE_TTL = 60000; // ৬০ সেকেন্ড (প্রয়োজনে বাড়াতে পারেন)

/**
 * ক্যাশ কী তৈরি করে (প্যারামিটার অনুযায়ী)
 * @param {string} fnName - ফাংশনের নাম
 * @param {Array} args - প্যারামিটার লিস্ট
 * @returns {string} - ইউনিক কী
 */
function buildCacheKey(fnName, args) {
    // ডেটা অ্যারের সংক্ষিপ্ত হ্যাশ (সম্পূর্ণ অ্যারে স্ট্রিং না করে)
    const parts = args.map(arg => {
        if (Array.isArray(arg)) {
            if (arg.length === 0) return 'empty_array';
            // অ্যারের আকার + প্রথম ২টি + শেষ ২টি এলিমেন্ট (পারফরম্যান্সের জন্য)
            const firstTwo = arg.slice(0, 2).map(v => typeof v === 'number' ? v.toFixed(4) : String(v)).join(',');
            const lastTwo = arg.slice(-2).map(v => typeof v === 'number' ? v.toFixed(4) : String(v)).join(',');
            return `arr_${arg.length}_${firstTwo}_${lastTwo}`;
        } else if (typeof arg === 'object' && arg !== null) {
            // অবজেক্ট (যেমন priceData) – সংক্ষিপ্ত হ্যাশ
            try {
                const keys = Object.keys(arg).slice(0, 5);
                const vals = keys.map(k => {
                    const v = arg[k];
                    if (Array.isArray(v)) return `${k}:arr_${v.length}`;
                    return `${k}:${String(v).substring(0, 20)}`;
                }).join('|');
                return `obj_${keys.length}_${vals}`;
            } catch (e) {
                return 'obj_complex';
            }
        }
        return String(arg);
    }).join('_');
    return `${fnName}_${parts}`;
}

/**
 * ক্যাশ থেকে ডেটা পড়ে, না থাকলে কম্পিউট করে ক্যাশে সেভ করে
 * @param {string} fnName - ফাংশনের নাম
 * @param {Function} computeFn - যে ফাংশন কল করতে হবে
 * @param {...any} args - ফাংশনের প্যারামিটার
 * @returns {any} - ক্যালকুলেটেড ফলাফল
 */
function getCachedIndicator(fnName, computeFn, ...args) {
    const cacheKey = buildCacheKey(fnName, args);
    const cached = indicatorCache.get(cacheKey);
    
    // ক্যাশে আছে এবং TTL-র মধ্যে?
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    
    // ক্যাশ নেই বা মেয়াদ শেষ – কম্পিউট করুন
    const result = computeFn(...args);
    if (result !== null && result !== undefined) {
        // শুধু নন-নাল রেজাল্ট ক্যাশ করি (যেমন [] বা null ক্যাশ না করলেও চলে)
        if (!Array.isArray(result) || result.length > 0) {
            indicatorCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
        }
    }
    return result;
}

/**
 * (ঐচ্ছিক) পুরো ক্যাশ ক্লিয়ার করার ফাংশন
 */
function clearIndicatorCache() {
    indicatorCache.clear();
    console.log('🗑️ Indicator cache cleared');
}

// ==========================================
// 📊 ইন্ডিকেটর ফাংশন (ক্যাশিং সহ)
// ==========================================

/**
 * Simple Moving Average (SMA)
 */
function calculateSMA(data, period) {
    if (data.length < period) return [];
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j];
        result.push(sum / period);
    }
    return result;
}

/**
 * Exponential Moving Average (EMA)
 */
function calculateEMA(data, period) {
    if (data.length < period) return [];
    const multiplier = 2 / (period + 1);
    const result = [];
    let sma = 0;
    for (let i = 0; i < period; i++) sma += data[i];
    sma /= period;
    result.push(sma);
    for (let i = period; i < data.length; i++) {
        const ema = (data[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
        result.push(ema);
    }
    return result;
}

/**
 * Relative Strength Index (RSI)
 */
function calculateRSI(data, period = 14) {
    if (data.length < period + 1) return [];
    const result = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i-1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rsi = 100 - (100 / (1 + (avgGain / (avgLoss || 1))));
    result.push({ rsi });
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i-1];
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        rsi = 100 - (100 / (1 + (avgGain / (avgLoss || 1))));
        result.push({ rsi });
    }
    return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
function calculateMACD(data, fast = 12, slow = 26, signal = 9) {
    if (data.length < slow + signal) return null;
    const emaFast = calculateEMA(data, fast);
    const emaSlow = calculateEMA(data, slow);
    const macdLine = [];
    const startIdx = data.length - emaSlow.length;
    for (let i = 0; i < emaSlow.length; i++) {
        macdLine.push(emaFast[i + startIdx] - emaSlow[i]);
    }
    const signalLine = calculateEMA(macdLine, signal);
    const histogram = [];
    const sigStart = macdLine.length - signalLine.length;
    for (let i = 0; i < signalLine.length; i++) {
        histogram.push(macdLine[i + sigStart] - signalLine[i]);
    }
    return {
        macd: macdLine.slice(-signalLine.length),
        signal: signalLine,
        histogram
    };
}

/**
 * Bollinger Bands
 */
function calculateBollingerBands(data, period = 20, stdDev = 2) {
    if (data.length < period) return null;
    const sma = calculateSMA(data, period);
    const upper = [], lower = [], middle = [];
    for (let i = period - 1; i < data.length; i++) {
        const start = i - period + 1;
        let sum = 0;
        for (let j = start; j <= i; j++) sum += Math.pow(data[j] - sma[i - period + 1], 2);
        const std = Math.sqrt(sum / period);
        upper.push(sma[i - period + 1] + stdDev * std);
        middle.push(sma[i - period + 1]);
        lower.push(sma[i - period + 1] - stdDev * std);
    }
    return { upper, middle, lower };
}

/**
 * Stochastic Oscillator
 */
function calculateStochastic(high, low, close, period = 14, smoothK = 3, smoothD = 3) {
    if (high.length < period || low.length < period || close.length < period) return { k: [], d: [] };
    const kValues = [];
    for (let i = period - 1; i < close.length; i++) {
        const start = i - period + 1;
        let maxHigh = -Infinity, minLow = Infinity;
        for (let j = start; j <= i; j++) {
            if (high[j] > maxHigh) maxHigh = high[j];
            if (low[j] < minLow) minLow = low[j];
        }
        const k = ((close[i] - minLow) / (maxHigh - minLow)) * 100;
        kValues.push(k);
    }
    const smoothKValues = [];
    for (let i = smoothK - 1; i < kValues.length; i++) {
        let sum = 0;
        for (let j = i - smoothK + 1; j <= i; j++) sum += kValues[j];
        smoothKValues.push(sum / smoothK);
    }
    const dValues = [];
    for (let i = smoothD - 1; i < smoothKValues.length; i++) {
        let sum = 0;
        for (let j = i - smoothD + 1; j <= i; j++) sum += smoothKValues[j];
        dValues.push(sum / smoothD);
    }
    return { k: smoothKValues, d: dValues };
}

/**
 * Average True Range (ATR)
 */
function calculateATR(high, low, close, period = 14) {
    if (high.length < period || low.length < period || close.length < period + 1) return [];
    const tr = [];
    for (let i = 1; i < close.length; i++) {
        const h = high[i] || close[i];
        const l = low[i] || close[i];
        const prevClose = close[i-1];
        const tr1 = h - l;
        const tr2 = Math.abs(h - prevClose);
        const tr3 = Math.abs(l - prevClose);
        tr.push(Math.max(tr1, tr2, tr3));
    }
    let atr = [];
    let sum = 0;
    for (let i = 0; i < period && i < tr.length; i++) sum += tr[i];
    atr.push(sum / period);
    for (let i = period; i < tr.length; i++) {
        const prevAtr = atr[atr.length - 1];
        const newAtr = (prevAtr * (period - 1) + tr[i]) / period;
        atr.push(newAtr);
    }
    return atr;
}

/**
 * Parabolic SAR (PSAR)
 */
function calculateParabolicSAR(priceData, step = 0.02, maxStep = 0.20) {
    if (!priceData || priceData.length < 2) return [];
    let sar = [];
    let trend = 'up';
    let af = step;
    let ep = priceData[0].high || priceData[0].ltp || priceData[0].close || 0;
    let currentSAR = priceData[0].low || priceData[0].ltp || priceData[0].close || 0;
    sar.push({ date: priceData[0].date, sar: currentSAR, trend: trend, af: af, ep: ep });

    for (let i = 1; i < priceData.length; i++) {
        const current = priceData[i];
        const price = current.ltp || current.close || 0;
        const high = current.high || price;
        const low = current.low || price;

        let newSAR;
        if (trend === 'up') {
            newSAR = currentSAR + af * (ep - currentSAR);
        } else {
            newSAR = currentSAR - af * (currentSAR - ep);
        }

        if (trend === 'up' && price < newSAR) {
            trend = 'down';
            newSAR = ep;
            af = step;
            ep = low;
        } else if (trend === 'down' && price > newSAR) {
            trend = 'up';
            newSAR = ep;
            af = step;
            ep = high;
        } else {
            if (trend === 'up') {
                if (high > ep) {
                    ep = high;
                    af = Math.min(af + step, maxStep);
                }
            } else {
                if (low < ep) {
                    ep = low;
                    af = Math.min(af + step, maxStep);
                }
            }
        }

        sar.push({ date: current.date, sar: newSAR, trend: trend, af: af, ep: ep });
        currentSAR = newSAR;
    }
    return sar;
}

/**
 * ARIMA Forecast (সরল সংস্করণ)
 */
function arimaForecast(data, steps = 5) {
    if (data.length < 3) return null;
    const n = data.length;
    let sumY = 0, sumY1 = 0, sumY1Y = 0, sumY1Sq = 0;
    for (let i = 1; i < n; i++) {
        sumY += data[i];
        sumY1 += data[i-1];
        sumY1Y += data[i-1] * data[i];
        sumY1Sq += data[i-1] * data[i-1];
    }
    const phi = (sumY1Y - (sumY1 * sumY) / n) / (sumY1Sq - (sumY1 * sumY1) / n);
    const c = (sumY - phi * sumY1) / n;
    const forecast = [];
    let last = data[data.length - 1];
    for (let i = 0; i < steps; i++) {
        const next = c + phi * last;
        forecast.push(next);
        last = next;
    }
    return forecast;
}

// ==========================================
// 🔥 ক্যাশিং র‍্যাপার ফাংশন (সহজ ব্যবহারের জন্য)
//    এগুলো গ্লোবালি এক্সপোজ করা হবে যাতে অন্যান্য ফাইল ব্যবহার করতে পারে
// ==========================================

// SMA
function cachedSMA(data, period) {
    return getCachedIndicator('SMA', calculateSMA, data, period);
}

// EMA
function cachedEMA(data, period) {
    return getCachedIndicator('EMA', calculateEMA, data, period);
}

// RSI
function cachedRSI(data, period = 14) {
    return getCachedIndicator('RSI', calculateRSI, data, period);
}

// MACD
function cachedMACD(data, fast = 12, slow = 26, signal = 9) {
    return getCachedIndicator('MACD', calculateMACD, data, fast, slow, signal);
}

// Bollinger Bands
function cachedBollingerBands(data, period = 20, stdDev = 2) {
    return getCachedIndicator('BB', calculateBollingerBands, data, period, stdDev);
}

// Stochastic
function cachedStochastic(high, low, close, period = 14, smoothK = 3, smoothD = 3) {
    return getCachedIndicator('STOCH', calculateStochastic, high, low, close, period, smoothK, smoothD);
}

// ATR
function cachedATR(high, low, close, period = 14) {
    return getCachedIndicator('ATR', calculateATR, high, low, close, period);
}

// Parabolic SAR
function cachedParabolicSAR(priceData, step = 0.02, maxStep = 0.20) {
    return getCachedIndicator('PSAR', calculateParabolicSAR, priceData, step, maxStep);
}

// ARIMA Forecast
function cachedArimaForecast(data, steps = 5) {
    return getCachedIndicator('ARIMA', arimaForecast, data, steps);
}

// ==========================================
// 🌐 গ্লোবালি এক্সপোজ (যাতে সব ফাইল ব্যবহার করতে পারে)
//    ক্যাশিং ফাংশনগুলো গ্লোবালি দেওয়া হলো
// ==========================================
if (typeof window !== 'undefined') {
    // মূল ফাংশন
    window.calculateSMA = calculateSMA;
    window.calculateEMA = calculateEMA;
    window.calculateRSI = calculateRSI;
    window.calculateMACD = calculateMACD;
    window.calculateBollingerBands = calculateBollingerBands;
    window.calculateStochastic = calculateStochastic;
    window.calculateATR = calculateATR;
    window.calculateParabolicSAR = calculateParabolicSAR;
    window.arimaForecast = arimaForecast;
    
    // ক্যাশিং ফাংশন
    window.cachedSMA = cachedSMA;
    window.cachedEMA = cachedEMA;
    window.cachedRSI = cachedRSI;
    window.cachedMACD = cachedMACD;
    window.cachedBollingerBands = cachedBollingerBands;
    window.cachedStochastic = cachedStochastic;
    window.cachedATR = cachedATR;
    window.cachedParabolicSAR = cachedParabolicSAR;
    window.cachedArimaForecast = cachedArimaForecast;
    
    // ক্যাশ ক্লিয়ার
    window.clearIndicatorCache = clearIndicatorCache;
}

// ==========================================
// 📤 এক্সপোর্ট (যদি ES Modules ব্যবহার করা হয়)
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateSMA,
        calculateEMA,
        calculateRSI,
        calculateMACD,
        calculateBollingerBands,
        calculateStochastic,
        calculateATR,
        calculateParabolicSAR,
        arimaForecast,
        cachedSMA,
        cachedEMA,
        cachedRSI,
        cachedMACD,
        cachedBollingerBands,
        cachedStochastic,
        cachedATR,
        cachedParabolicSAR,
        cachedArimaForecast,
        clearIndicatorCache
    };
}

console.log('✅ indicators.js loaded successfully (with caching)');