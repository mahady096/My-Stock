// ==========================================
// 🔥 CORE.JS – সম্পূর্ণ ইরর-ফ্রি ভার্সন
//    (সব ফাংশন ডিফাইন করা, কনফিগ-সাপোর্ট, গ্লোবাল এক্সপোজ)
//    ✅ ডুপ্লিকেট ইন্ডিকেটর ফাংশন সরানো (indicators.js থেকে নেওয়া)
// ==========================================

// ==========================================
// 📦 কনফিগ লোড (ফ্যালব্যাক সহ)
// ==========================================
const CONFIG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG) ? APP_CONFIG : {
    API: {
        SCRAPER_BASE_URL: 'https://dse-scraper.vercel.app/api'
    },
    CACHE: {
        TTL: {
            ANALYSIS: 600000,
            PRICE: 300000,
            SCANNER: 3600000,
            UNIFIED_PRICE: 300000
        }
    },
    STORAGE_KEYS: {
        THEME: 'theme',
        WATCHLIST: 'market_watch_list',
        COMMISSION: 'commissionPercent',
        DATA_MODE: 'dataMode'
    },
    DEFAULTS: {
        COMMISSION_PERCENT: 0,
        DATA_MODE: 'database'
    },
    CALC: {
        PARABOLIC_SAR_STEP: 0.02,
        PARABOLIC_SAR_MAX_STEP: 0.20,
        RSI_PERIOD: 14
    }
};

// ==========================================
// 🔥 গ্লোবাল ভেরিয়েবল ডিক্লেয়ারেশন
// ==========================================
let portfolioAnalysisInterval = null;
let isAnalysisLoading = false;
let cachedAnalysisData = null;
let lastAnalysisTime = 0;
let stockTableRefreshInterval = null;
let autoRefreshInterval = null;
let autoRefreshEnabled = true;
let isManualReloading = false;
let currentDataMode = localStorage.getItem(CONFIG.STORAGE_KEYS.DATA_MODE) || CONFIG.DEFAULTS.DATA_MODE;
let currentPriceData = new Map();
let lastDataLoadTime = null;
let currentPortfolioTotalValue = 0;
let dashboardChartInstance = null;
let modalChartInstance = null;
let advChartInstance = null;
let historyChartInstance = null;

const ANALYSIS_CACHE_TTL = CONFIG.CACHE.TTL.ANALYSIS || 600000;
const SCRAPER_BASE_URL = CONFIG.API.SCRAPER_BASE_URL || 'https://dse-scraper.vercel.app/api';

// ==========================================
// 🕐 TIMEZONE UTILITY FUNCTIONS
// ==========================================
function toBangladeshTime(date) {
    if (!date) return null;
    let jsDate;
    if (typeof date.toDate === 'function') jsDate = date.toDate();
    else if (date instanceof Date) jsDate = date;
    else if (typeof date === 'string') jsDate = new Date(date);
    else if (date.seconds) jsDate = new Date(date.seconds * 1000);
    else jsDate = new Date(date);
    const bangladeshOffset = 6 * 60 * 60 * 1000;
    return new Date(jsDate.getTime() + bangladeshOffset);
}

function formatBangladeshTime(date, showTime = true) {
    const bdDate = toBangladeshTime(date);
    if (!bdDate) return 'N/A';
    const year = bdDate.getUTCFullYear();
    const month = String(bdDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(bdDate.getUTCDate()).padStart(2, '0');
    const hours = String(bdDate.getUTCHours()).padStart(2, '0');
    const minutes = String(bdDate.getUTCMinutes()).padStart(2, '0');
    if (showTime) return `${year}-${month}-${day} ${hours}:${minutes}`;
    return `${year}-${month}-${day}`;
}

function getBangladeshDateString(date = new Date()) {
    const bdDate = toBangladeshTime(date);
    if (!bdDate) return new Date().toISOString().split('T')[0];
    const year = bdDate.getUTCFullYear();
    const month = String(bdDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(bdDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getUTCFromLocalDate(dateString) {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-');
    return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0));
}

function formatDisplayTime(date) {
    const bdDate = toBangladeshTime(date);
    if (!bdDate) return 'N/A';
    return bdDate.toLocaleString('bn-BD', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
}

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==========================================
// 🛡️ নিরাপদ প্রাইস ইউটিলিটি
// ==========================================
function getSafePrice(price, fallbackPrice = 0) {
    if (price === null || price === undefined || isNaN(price) || price === 0) return fallbackPrice;
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) return fallbackPrice;
    return numPrice;
}

function calculatePercentage(value, base) {
    if (!base || base === 0 || isNaN(base) || isNaN(value)) return 0;
    return (value / base) * 100;
}

function safeDivision(dividend, divisor, defaultValue = 0) {
    if (!divisor || divisor === 0 || isNaN(divisor) || isNaN(dividend)) return defaultValue;
    return dividend / divisor;
}

// ==========================================
// 📦 অ্যারে ভাগ করার হেলপার (ব্যাচ কোয়েরির জন্য)
// ==========================================
function chunkArray(array, chunkSize = 10) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// ==========================================
// 🚦 API RATE LIMITER
// ==========================================
class APIRateLimiter {
    constructor(maxRequestsPerSecond = 3) {
        this.queue = [];
        this.processing = false;
        this.minDelay = 1000 / maxRequestsPerSecond;
        this.lastCall = 0;
    }
    async request(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }
    async process() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;
        while (this.queue.length > 0) {
            const now = Date.now();
            const timeToWait = Math.max(0, this.minDelay - (now - this.lastCall));
            if (timeToWait > 0) await new Promise(r => setTimeout(r, timeToWait));
            const { fn, resolve, reject } = this.queue.shift();
            this.lastCall = Date.now();
            try { resolve(await fn()); } catch (error) { reject(error); }
        }
        this.processing = false;
    }
}
const apiLimiter = new APIRateLimiter(3);

// ==========================================
// 💰 কমিশন ম্যানেজার
// ==========================================
class CommissionManager {
    constructor() {
        this.STORAGE_KEY = CONFIG.STORAGE_KEYS.COMMISSION || 'commissionPercent';
        this.loadSettings();
    }
    loadSettings() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        this.percent = saved ? parseFloat(saved) : CONFIG.DEFAULTS.COMMISSION_PERCENT || 0;
    }
    saveSettings() {
        localStorage.setItem(this.STORAGE_KEY, String(this.percent));
    }
    calculateCommission(amount) {
        return amount * (this.percent / 100);
    }
    getBuyTotalWithCommission(amount) {
        return amount + this.calculateCommission(amount);
    }
    getSellNetWithCommission(amount) {
        return amount - this.calculateCommission(amount);
    }
    getPercent() {
        return this.percent;
    }
    updatePercent(percent) {
        this.percent = Math.max(0, parseFloat(percent) || 0);
        this.saveSettings();
        // UI আপডেটের জন্য ইভেন্ট
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('commissionChanged', { detail: { percent: this.percent } }));
        }
    }
    calculateFullTransaction(buyPrice, sellPrice, qty) {
        const buyAmount = buyPrice * qty;
        const sellAmount = sellPrice * qty;
        const buyCommission = this.calculateCommission(buyAmount);
        const sellCommission = this.calculateCommission(sellAmount);
        return {
            buyAmount,
            sellAmount,
            buyCommission,
            sellCommission,
            netBuy: buyAmount + buyCommission,
            netSell: sellAmount - sellCommission,
            grossProfit: sellAmount - buyAmount,
            netProfit: (sellAmount - sellCommission) - (buyAmount + buyCommission),
            commissionPercent: this.percent
        };
    }
}
const commissionManager = new CommissionManager();

// ==========================================
// 🗄️ FIREBASE DATA MANAGER
// ==========================================
class FirebaseDataManager {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 1800000;
        this.pendingRequests = new Map();
        this.dataInfo = { source: 'firebase', lastUpdate: null, recordsCount: 0 };
    }
    async getCachedOrFetch(key, fetchFn, ttl = this.cacheTTL) {
        if (this.cache.has(key)) {
            const cached = this.cache.get(key);
            if (Date.now() - cached.timestamp < ttl) return cached.data;
        }
        if (this.pendingRequests.has(key)) return this.pendingRequests.get(key);
        const promise = fetchFn().then(data => {
            this.cache.set(key, { data, timestamp: Date.now() });
            this.pendingRequests.delete(key);
            return data;
        }).catch(err => {
            this.pendingRequests.delete(key);
            throw err;
        });
        this.pendingRequests.set(key, promise);
        return promise;
    }
    async getLastUpdateTime() {
        try {
            if (typeof db === 'undefined') return null;
            const snapshot = await db.collection('cse_detailed_data')
                .orderBy('date', 'desc')
                .limit(1)
                .get();
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                if (data.date) {
                    const bangladeshTime = toBangladeshTime(new Date(data.date));
                    bangladeshTime.setUTCHours(5, 0, 0, 0);
                    return bangladeshTime;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting last update time:', error);
            return null;
        }
    }
    async getFormattedLastUpdate() {
        const lastUpdate = await this.getLastUpdateTime();
        return lastUpdate ? formatDisplayTime(lastUpdate) : 'Not available';
    }
    async getPriceByDate(ticker, date) {
        if (!ticker || !date) return null;
        try {
            if (typeof db === 'undefined') return null;
            const snapshot = await db.collection('daily_prices')
                .where('ticker', '==', ticker)
                .where('date', '==', date)
                .limit(1)
                .get();
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                return parseFloat(data.price) || parseFloat(data.close) || null;
            }
            return null;
        } catch (e) {
            console.warn(`⚠️ daily_prices query failed for ${ticker} on ${date}:`, e.message);
            try {
                const snapAll = await db.collection('daily_prices')
                    .where('ticker', '==', ticker)
                    .get();
                let found = null;
                snapAll.forEach(doc => {
                    const d = doc.data();
                    if (d.date === date) {
                        found = parseFloat(d.price) || parseFloat(d.close) || null;
                    }
                });
                return found;
            } catch (e2) {
                return null;
            }
        }
    }
    getDataStatus() { return { ...this.dataInfo }; }
    clearCache() {
        this.cache.clear();
        this.pendingRequests.clear();
        console.log('🗑️ FirebaseDataManager cache cleared');
    }
}
const firebaseDataManager = new FirebaseDataManager();

// ==========================================
// 📈 ইউনিফাইড প্রাইস ফেচার
// ==========================================
let unifiedPriceCache = new Map();
let lastUnifiedPriceUpdate = 0;
const UNIFIED_PRICE_CACHE_TTL = CONFIG.CACHE.TTL.UNIFIED_PRICE || 300000;

function getHardcodedPrice(ticker) {
    const prices = {
        "GP": 255.40,
        "ROBI": 26.10,
        "SQURPHARMA": 208.70,
        "BATBC": 518.00,
        "BEXIMCO": 115.20
    };
    return prices[ticker] || 0.0;
}

// ==========================================
// 📈 getUnifiedPrice - ক্যাশিং সহ (sessionStorage + মেমোরি)
// ==========================================

/**
 * যেকোনো টিকারের বর্তমান দাম ফেরত দেয় – ক্যাশ, Supabase, Firebase, হার্ডকোডেড
 * @param {string} ticker - শেয়ারের কোড (যেমন "GP")
 * @param {boolean} forceRefresh - true দিলে ক্যাশ উপেক্ষা করে নতুন ডেটা ফেচ করবে
 * @returns {Promise<number>} - দাম (০ হলে পাওয়া যায়নি)
 */
async function getUnifiedPrice(ticker, forceRefresh = false) {
    if (!ticker) return 0;
    const now = Date.now();
    const TTL = CONFIG?.CACHE?.TTL?.UNIFIED_PRICE || 300000; // ৫ মিনিট
    const CACHE_KEY = `price_${ticker}`;

    // -----------------------------------------------------
    // ১. sessionStorage ক্যাশ চেক (forceRefresh false হলে)
    // -----------------------------------------------------
    if (!forceRefresh) {
        const cached =await CacheManager.get(CACHE_KEY, TTL);
        if (cached !== null && typeof cached === 'object' && cached.price > 0) {
            // মেমোরি ক্যাশও আপডেট করে রাখি (যাতে বারবার sessionStorage না পড়তে হয়)
            unifiedPriceCache.set(ticker, { 
                price: cached.price, 
                timestamp: now 
            });
            return cached.price;
        }
    }

    // -----------------------------------------------------
    // ২. মেমোরি ক্যাশ চেক (দ্রুত অ্যাক্সেসের জন্য)
    // -----------------------------------------------------
    if (unifiedPriceCache.has(ticker)) {
        const memCached = unifiedPriceCache.get(ticker);
        if (now - memCached.timestamp < TTL) {
            // sessionStorage-এও সেভ করে রাখি (যাতে পেজ রিলোডে কাজ করে)
            CacheManager.set(CACHE_KEY, { price: memCached.price }, TTL);
            return memCached.price;
        } else {
            // মেয়াদ শেষ, মুছে ফেলি
            unifiedPriceCache.delete(ticker);
        }
    }

    // -----------------------------------------------------
    // ৩. ডেটাবেস থেকে ফেচ — Supabase DSE primary, Supabase CSE fallback.
    // Firebase is intentionally NOT a live market-price source.
    let price = 0;

    // ৩.১ Supabase dse_live_data — PRIMARY
    if (typeof supabase !== 'undefined' && supabase) {
        try {
            const { data, error } = await supabase
                .from('dse_live_data')
                .select('ltp')
                .eq('ticker', ticker)
                .order('date', { ascending: false })
                .limit(1);
            if (!error && data && data.length > 0) {
                const val = parseFloat(data[0].ltp);
                if (!isNaN(val) && val > 0) price = val;
            }
        } catch (e) {
            console.warn(`DSE live price fetch failed for ${ticker}:`, e);
        }
    }

    // ৩.২ Supabase cse_market_data — FALLBACK
    if (price <= 0 && typeof supabase !== 'undefined' && supabase) {
        try {
            const { data, error } = await supabase
                .from('cse_market_data')
                .select('ltp')
                .eq('code', ticker)
                .order('date', { ascending: false })
                .limit(1);
            if (!error && data && data.length > 0) {
                const val = parseFloat(data[0].ltp);
                if (!isNaN(val) && val > 0) price = val;
            }
        } catch (e) {
            console.warn(`CSE market price fallback failed for ${ticker}:`, e);
        }
    }

    // ৩.৩ Legacy Firebase daily_prices fallback is deliberately disabled.
    // Stock prices can always be re-scraped into Supabase from DSE/CSE.

    // ৩.৫ Optional demo fallback (OFF by default in production)
    if (price === 0 && CONFIG?.DEFAULTS?.ALLOW_DEMO_PRICE_FALLBACK === true) {
        price = getHardcodedPrice(ticker);
    }

    // -----------------------------------------------------
    // ৪. ক্যাশে সেভ করা (শুধু যদি দাম > ০ হয়)
    // -----------------------------------------------------
    if (price > 0) {
        // মেমোরি ক্যাশ
        unifiedPriceCache.set(ticker, { 
            price: price, 
            timestamp: now 
        });
        // sessionStorage ক্যাশ
        await CacheManager.set(CACHE_KEY, { price }, TTL);
    }

    return price;
}

function resetUnifiedPriceCache() {
    unifiedPriceCache.clear();
    console.log('🔄 Unified price cache reset');
}

// ==========================================
// 📦 আগের দিনের প্রাইস ফেচ
// ==========================================
async function getPreviousDayPrice(ticker) {
    if (!ticker) return 0;
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // ০. Supabase history_dse (DSE history — PRIMARY)
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data, error } = await supabase
                    .from('history_dse')
                    .select('ltp')
                    .eq('ticker', ticker)
                    .eq('date', dateStr)
                    .limit(1);
                if (!error && data && data.length > 0) {
                    const val = parseFloat(data[0].ltp);
                    if (val > 0) return val;
                }
            } catch (e) {}
        }

        // ১. Supabase dse_live_data
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data, error } = await supabase
                    .from('dse_live_data')
                    .select('ltp')
                    .eq('ticker', ticker)
                    .eq('date', dateStr)
                    .limit(1);
                if (!error && data && data.length > 0) {
                    const val = parseFloat(data[0].ltp);
                    if (val > 0) return val;
                }
            } catch (e) {}
        }

        // ২. Supabase cse_market_data
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data, error } = await supabase
                    .from('cse_market_data')
                    .select('ltp')
                    .eq('code', ticker)
                    .eq('date', dateStr)
                    .limit(1);
                if (!error && data && data.length > 0) {
                    const val = parseFloat(data[0].ltp);
                    if (val > 0) return val;
                }
            } catch (e) {}
        }

        // ৩. Firebase daily_prices
        if (typeof db !== 'undefined' && db) {
            try {
                const snap = await db.collection('daily_prices')
                    .where('ticker', '==', ticker)
                    .where('date', '==', dateStr)
                    .limit(1)
                    .get();
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    const val = parseFloat(data.price) || parseFloat(data.close) || 0;
                    if (val > 0) return val;
                }
            } catch (e) {}
        }
    }
    return 0;
}

// ==========================================
// 📊 getLatestAndPreviousPrices - ক্যাশিং সহ (ব্যাচ + ইনক্রিমেন্টাল)
// ==========================================

/**
 * একাধিক টিকারের বর্তমান ও আগের দিনের দাম ফেরত দেয় (ক্যাশিং সহ)
 * @param {string[]} tickers - শেয়ারের কোডের অ্যারে (যেমন ["GP", "ROBI"])
 * @param {boolean} forceRefresh - true দিলে ক্যাশ উপেক্ষা করে নতুন ডেটা ফেচ করবে
 * @returns {Promise<Map<string, {currentPrice, currentDate, previousPrice, previousDate}>>}
 */
// ==========================================
// 📊 getLatestAndPreviousPrices - ক্যাশিং সহ (ব্যাচ + ইনক্রিমেন্টাল)
//    High/Low সহ Today's Price, Previous Price, Today's High, Today's Low
// ==========================================

// ==========================================
// 🛡️ HTML escape হেলপার (innerHTML-এ ডেটা বসানোর আগে ব্যবহার করুন)
// ==========================================
function spEscapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
window.spEscapeHtml = spEscapeHtml;

// ==========================================
// 📉 history_dse থেকে আগের দিনের দাম বাছাই (হেলপার)
// - লাইভ ডেটার তারিখ যদি ট্রেডিং ডে-র সমান হয় বা ছুটির দিন (শুক্র/শনি) হয়
//   (তখন লাইভ ডেটা আসলে শেষ ট্রেডিং ডে-র), তাহলে ওই দিনের YCP-ই "আগের দিনের দাম"।
// - অন্যথায় history-র সবচেয়ে কাছের আগের দিনের ক্লোজ।
// ==========================================
function pickPreviousFromHistory(rows, currentDate, currentPrice) {
    const day = (d) => String(d || '').slice(0, 10);
    const curDay = day(currentDate);
    if (!curDay || !rows || !rows.length) return null;

    // curDay বা তার আগের সবচেয়ে নতুন সারি
    let latest = null;
    for (const r of rows) {
        const d = day(r.date);
        if (d && d <= curDay && (!latest || d > day(latest.date))) latest = r;
    }
    if (!latest) return null;

    const latestLtp = parseFloat(latest.ltp) || 0;
    const latestYcp = parseFloat(latest.ycp) || 0;
    const dow = new Date(curDay + 'T00:00:00Z').getUTCDay(); // 5=শুক্র, 6=শনি
    const isWeekend = (dow === 5 || dow === 6);
    const sameClose = latestLtp > 0 && Math.abs(latestLtp - (currentPrice || 0)) < 0.001;

    // লাইভ দাম আর history-র সারি একই সেশনের হলে → সারির YCP
    if (latestYcp > 0 && sameClose && (day(latest.date) === curDay || isWeekend)) {
        // YCP belongs to the previous trading session; use that session's date
        // instead of null so the stock modal can show a meaningful "as on" date.
        const previousRow = rows
            .filter(r => day(r.date) < day(latest.date) && (parseFloat(r.ltp) || 0) > 0)
            .sort((a, b) => day(b.date).localeCompare(day(a.date)))[0];
        return { price: latestYcp, date: previousRow ? previousRow.date : null };
    }
    // না হলে → history-র শেষ ক্লোজ (আজকের তারিখের আগের হলে)
    for (const r of rows.slice().sort((x, y) => day(y.date).localeCompare(day(x.date)))) {
        const d = day(r.date);
        const v = parseFloat(r.ltp) || 0;
        if (d < curDay && v > 0) return { price: v, date: r.date };
    }
    if (latestLtp > 0 && !sameClose) return { price: latestLtp, date: latest.date };
    return null;
}

/**
 * একাধিক টিকারের বর্তমান ও আগের দিনের দাম ফেরত দেয় (ক্যাশিং সহ)
 * @param {string[]} tickers - শেয়ারের কোডের অ্যারে (যেমন ["GP", "ROBI"])
 * @param {boolean} forceRefresh - true দিলে ক্যাশ উপেক্ষা করে নতুন ডেটা ফেচ করবে
 * @returns {Promise<Map<string, {currentPrice, currentDate, previousPrice, previousDate, high, low}>>}
 */
async function getLatestAndPreviousPrices(tickers, forceRefresh = false) {
    if (!tickers || !tickers.length) return new Map();
    
    const TTL = CONFIG?.CACHE?.TTL?.UNIFIED_PRICE || 300000; // ৫ মিনিট
    const resultMap = new Map();
    const missingTickers = [];

    // -----------------------------------------------------
    // ১. ক্যাশ থেকে ডেটা পড়া (forceRefresh false হলে)
    // -----------------------------------------------------
    if (!forceRefresh) {
        for (const ticker of tickers) {
            const cacheKey = `price_detail_dse_primary_${ticker}`;
            const cached = await CacheManager.get(cacheKey, TTL);
            if (cached && typeof cached === 'object' && cached.currentPrice > 0 && cached.market) {
                resultMap.set(ticker, {
                    currentPrice: cached.currentPrice,
                    currentDate: cached.currentDate || null,
                    previousPrice: cached.previousPrice || 0,
                    previousDate: cached.previousDate || null,
                    high: cached.high || 0,
                    low: cached.low || 0,
                    market: cached.market || null,
                    dsePrice: cached.dsePrice || 0,
                    csePrice: cached.csePrice || 0
                });
            } else {
                missingTickers.push(ticker);
            }
        }

        // যদি সব টিকার ক্যাশ থাকে, তাহলে সরাসরি রিটার্ন
        if (missingTickers.length === 0) {
            return resultMap;
        }
    } else {
        // forceRefresh = true হলে সব টিকার জন্য নতুন ফেচ করতে হবে
        missingTickers.push(...tickers);
    }

    // -----------------------------------------------------
    // ২. শুধু যাদের ক্যাশ নেই, তাদের জন্য ডেটাবেস থেকে ফেচ
    // -----------------------------------------------------
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const startDateStr = sevenDaysAgo.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // ডেটা সংরক্ষণের জন্য অস্থায়ী ম্যাপ
    const fetchedData = new Map();

    // ---------- ২.১ Supabase থেকে ব্যাচে ডেটা ----------
    if (typeof supabase !== 'undefined' && supabase) {
        // ২.১.১ DSE এবং CSE — দুই বাজারের দাম সংগ্রহ করে বেশি LTP নির্বাচন
        const dseData = new Map();
        const cseData = new Map();
        for (const chunk of chunkArray(missingTickers, 10)) {
            try {
                const { data, error } = await supabase
                    .from('dse_live_data')
                    .select('ticker, ltp, high, low, date')
                    .in('ticker', chunk)
                    .order('date', { ascending: false });
                if (!error && data) {
                    const seen = new Set();
                    data.forEach(row => {
                        const code = String(row.ticker || '').toUpperCase();
                        if (!code || seen.has(code)) return;
                        seen.add(code);
                        const val = parseFloat(row.ltp) || 0;
                        if (val > 0) dseData.set(code, { currentPrice: val, currentDate: row.date, high: parseFloat(row.high) || 0, low: parseFloat(row.low) || 0 });
                    });
                }
            } catch (e) { console.warn('Supabase dse_live batch error:', e); }
        }
        for (const chunk of chunkArray(missingTickers, 10)) {
            try {
                const { data, error } = await supabase
                    .from('cse_market_data')
                    .select('code, ltp, high, low, date')
                    .in('code', chunk)
                    .order('date', { ascending: false });
                if (!error && data) {
                    const seen = new Set();
                    data.forEach(row => {
                        const code = String(row.code || '').toUpperCase();
                        if (!code || seen.has(code)) return;
                        seen.add(code);
                        const val = parseFloat(row.ltp) || 0;
                        if (val > 0) cseData.set(code, { currentPrice: val, currentDate: row.date, high: parseFloat(row.high) || 0, low: parseFloat(row.low) || 0 });
                    });
                }
            } catch (e) { console.warn('Supabase cse_market batch error:', e); }
        }
        for (const ticker of missingTickers) {
            const code = String(ticker || '').toUpperCase();
            const dse = dseData.get(code);
            const cse = cseData.get(code);
            let selected = null;
            // Portfolio LTP is always DSE when available. CSE is retained only
            // as comparison metadata; it must never replace the DSE valuation price.
            if (dse) selected = { ...dse, market: 'D', dsePrice: dse.currentPrice, csePrice: cse ? cse.currentPrice : 0 };
            else if (cse) selected = { ...cse, market: 'C', dsePrice: 0, csePrice: cse.currentPrice };
            if (selected) fetchedData.set(code, selected);
        }
    }

    // ---------- ২.২ Firebase market-price backup intentionally skipped ----------
    // Portfolio LTP always uses Supabase DSE when available; CSE is only a fallback/comparison value. Firebase price backup is intentionally disabled.

    // ---------- ২.৩ আগের দিনের প্রাইস (Previous Price) ফেচ ----------
    // ✅ FIX: আগের দিনের দাম এখন DSE history (history_dse) থেকে নেওয়া হয়।
    // আগে এটি cse_market_data (CSE) থেকে আসছিল, ফলে DSE-র বর্তমান দামের সঙ্গে ভুল পার্থক্য দেখাত।
    const tickersWithCurrent = [];
    for (const [ticker, data] of fetchedData) {
        if (data.currentPrice > 0 && data.currentDate) {
            tickersWithCurrent.push(ticker);
        }
    }

    if (tickersWithCurrent.length > 0 && typeof supabase !== 'undefined' && supabase) {
        const prevChunks = chunkArray(tickersWithCurrent, 10);
        for (const chunk of prevChunks) {
            try {
                const { data, error } = await supabase
                    .from('history_dse')
                    .select('ticker, ltp, ycp, date')
                    .in('ticker', chunk)
                    .gte('date', startDateStr)
                    .order('date', { ascending: false });
                if (error || !data) continue;

                const byTicker = {};
                data.forEach(row => {
                    const code = String(row.ticker || '').toUpperCase();
                    if (!code) return;
                    (byTicker[code] = byTicker[code] || []).push(row);
                });

                for (const [ticker, rows] of Object.entries(byTicker)) {
                    const currentInfo = fetchedData.get(ticker);
                    if (!currentInfo || !currentInfo.currentDate) continue;
                    const picked = pickPreviousFromHistory(rows, currentInfo.currentDate, currentInfo.currentPrice);
                    if (picked && picked.price > 0) {
                        currentInfo.previousPrice = picked.price;
                        currentInfo.previousDate = picked.date;
                    }
                }
            } catch (e) { console.warn('Supabase history_dse previous price batch error:', e); }
        }
    }

    // ---------- ২.৪ যাদের কোনো ডেটা পাওয়া যায়নি, তাদের জন্য হার্ডকোডেড ফ্যালব্যাক ----------
    for (const ticker of missingTickers) {
        if (!fetchedData.has(ticker) || fetchedData.get(ticker).currentPrice === 0) {
            const hardcoded = getHardcodedPrice(ticker);
            if (hardcoded > 0) {
                fetchedData.set(ticker, {
                    currentPrice: hardcoded,
                    currentDate: todayStr,
                    previousPrice: 0,
                    previousDate: null,
                    high: 0,
                    low: 0
                });
            }
        }
    }

    // -----------------------------------------------------
    // ৩. resultMap তৈরি ও ক্যাশে সেভ করা
    // -----------------------------------------------------
    for (const [ticker, data] of fetchedData) {
        if (data.currentPrice > 0) {
            const finalData = {
                currentPrice: data.currentPrice,
                currentDate: data.currentDate || null,
                previousPrice: data.previousPrice || 0,
                previousDate: data.previousDate || null,
                high: data.high || 0,
                low: data.low || 0,
                market: data.market || null,
                dsePrice: data.dsePrice || 0,
                csePrice: data.csePrice || 0
            };
            resultMap.set(ticker, finalData);
            
            // sessionStorage ক্যাশ
            CacheManager.set(`price_detail_dse_primary_${ticker}`, finalData, TTL);
        }
    }

    // যাদের এখনও কোনো ডেটা নেই, তাদের ডিফল্ট ০ সেট করি
    for (const ticker of tickers) {
        if (!resultMap.has(ticker)) {
            resultMap.set(ticker, {
                currentPrice: 0,
                currentDate: null,
                previousPrice: 0,
                previousDate: null,
                high: 0,
                low: 0,
                market: null,
                dsePrice: 0,
                csePrice: 0
            });
        }
    }

    return resultMap;
}

// ==========================================
// 📌 গ্লোবাল এক্সপোজ (ইতিমধ্যে core.js-এর শেষে আছে)
// ==========================================
window.getLatestAndPreviousPrices = getLatestAndPreviousPrices;

// ==========================================
// 📋 DSE স্টক লিস্ট
// ==========================================
const dseStocks = [
    
Conversation with Gemini
বাংলাদেশের শেয়ার মার্কেট এ1JANATAMF", "1STPRIMFMF", "AAMRANET", "AAMRATECH", "ABB1STMF", "ABBANK", "ACFL", "ACI", "ACIFORMULA", "ACMELAB",

    "ACTIVEFINE", "ADNTEL", "ADVENT", "AFCAGRO", "AFTABAUTO", "AGNISYSL", "AGRANINS", "AIBL1STIMF", "AIL", "AL-HAJTEX",

    "ALARABANK", "ALIF", "ALLTEX", "AMANFEED", "AMBEEPHA", "ANLIMAYARN", "ANWARGALV", "APEXFOODS", "APEXFOOT", "APEXSPINN",

    "APOLOISPAT", "ARAMIT", "ARAMITCEM", "ARGONDENIM", "ASIAPACINS", "ATCSLGF", "ATLASBANG", "AZIZPIPES", "BANGAS", "BANKASIA",

    "BATASHOE", "BATBC", "BAYLEASING", "BBS", "BCC", "BDCOM", "BDFINANCE", "BDLAMPS", "BDTHAI", "BDTHAIFOOD",

    "BDWELDING", "BEACHHATCH", "BEACONPHAR", "BENGALWTL", "BERGERPBL", "BEXGSUKUK", "BEXIMCO", "BGIC", "BIFC", "BNICL",

    "BPML", "BPPL", "BRACBANK", "BSC", "BSCCL", "BSRMLTD", "BSRMSTEEL", "BXPHARMA", "CAPMBDBLMF", "CAPMIBBLMF", "BESTHLDNG",

    "CENTRALINS", "CENTRALPHL", "CITYBANK", "CNATEX", "CONFIDCEM", "CONTININS", "COPPERTECH", "CROWNCEMNT", "CVOPRL", "DACCADYE",

    "DAFODILCOM", "DBH", "DBH1STMF", "DELTALIFE", "DELTASPINN", "DESCO", "DESHBANDHU", "DHAKABANK", "DOMINAGE", "DOREENPWR",

    "DSSL", "Dulamiacot", "DUTCHBANGL", "EASTLAND", "EASTRNLUB", "EBL", "EBL1STMF", "EBLNRBMF", "ECABLES", "EGEN",

    "EMERALDOIL", "ENVOYTEX", "EPGL", "ESQUIRENIT", "ETL", "EXIM1STMF", "EXIMBANK", "FAMILYTEX", "FARCHEM", "FAREASTLIF", "FAREASTFIN",

    "FASFIN", "FBFIF", "FEDERALINS", "FEKDIL", "FINEFOODS", "FIRSTFIN", "FIRSTSBANK", "FORTUNE", "FUWANGCER", "SHARPIND", 

    "FUWANGFOOD", "GBBPOWER", "GEMINISEA", "GENEXIL", "GENNEXT", "GHAIL", "GHCL", "GIB", "GLAXOSMITH", "GLOBALINS",

    "GOLDENSON", "GP", "GPHISPAT", "GQBALLPEN", "GSPFINANCE", "GRAMEENS2", "GREENDELT", "HAKKANIPUL", "HEIDELBCEM", "HFL", "HRTEX",

    "HWAWELLTEX", "IBNSINA", "IBP", "ICB", "ICB3RDNRB", "ICBAGRANI1", "ICBAMCL2ND", "ICBEPMF1S1", "IDLC", "IFADAUTOS", "ICICL",

    "IFIC", "IFIC1STMF", "IFILISLMF1", "ILFSL", "INDEXAGRO", "INTECH", "INTRACO", "IPDC", "ISLAMIBANK", "ISLAMICFIN", "ICBEPMF1S1",

    "ISNLTD", "ITC", "JAMUNABANK", "JAMUNAOIL", "JANATAINS", "JHRML", "JMISMDL", "JUTESPINN", "KARNAPHULI", "KAY&QUE",

    "KBPPWBIL", "KDSALTD", "KEYACOSMET", "KPCL", "KPPL", "LANKABAFIN", "LEGACYFOOT", "LHB", "LIBRAINFU", "LINDEBD",

    "LOVELLO", "LRBDL", "MARICO", "MATINSPINN", "MBL1STMF", "MEGCONMILK", "MEGHNACEM", "MEGHNALIFE", "MEGHNAPET", "MERCANBANK",

    "MERCINS", "METROSPIN", "MHSML", "MIDASFIN", "MIRACLEIND", "MIRAKHTER", "MONNOAGML", "MONNOCERA", "MONNOFABR", "MONOSPOOL","MALEKSPIN", "MPETROLEUM", "MTB", "MIDLANDBNK", "NAHEEACP", "NATLIFEINS", "NAVANACNG", "NAVANAPHAR", "NBL", "NCCBANK", "NCCBLMF1", "NEWLINE",

    "NITOLINS", "NORTHERN", "NORTHRNINS", "NPOLYMER", "NRBBANK", "NTLTUBES", "OAL", "NHFIL", "OIMEX", "OLYMPIC", "ONEBANKPLC",

    "ORIONINFU", "ORIONPHARM", "PADMALIFE", "PADMAOIL", "PARAMOUNT", "PDL", "PENINSULA", "PEOPLESINS", "PF1STMF", "PHARMAID",

    "PHENIXINS", "PHOENIXFIN", "PIONEERINS", "PLFSL", "POPULAR1MF", "POPULARLIF", "POWERGRID", "PRAGATIINS", "PRAGATILIF", "PREMIERBAN",

    "PREMIERCEM", "PREMIERLEA", "PRIME1ICBA", "PRIMEBANK", "PRIMEFIN", "PRIMEINSUR", "PRIMELIFE", "PROGRESLIF", "PROVATIINS", "PTL",

    "PUBALIBANK", "PURABIGEN", "QUASEMIND", "QUEENSOUTH", "RAHIMAFOOD", "RAKCERAMIC", "RANFOUNDRY", "RDFOOD", "RECKITTBEN", "REGENTTEX",

    "RELIANCE1", "RENATA", "REPUBLIC", "RINGSHINE", "ROBI", "RSRMSTEEL", "RUNNERAUTO", "RUPALIBANK", "RUPALIINS", "SAFKOSPINN",

    "SAIFPOWER", "SAIHAMCOT", "SAIHAMTEX", "SALAMCRST", "SALVOCHEM", "SAMATALETH", "SAMORITA", "SANDHANINS", "SAPORTL", "SAVAREFR",

    "SEAPEARL", "SEMLFBSLGF", "SEMLIBBLSF", "SEMLLECMF", "SHAHJABANK", "SHASHADNIM", "SHEPHERD", "SHURWID", "SHYAMPSUG", "SIBL",

    "SICL", "SILCOPHL", "SILVAPHL", "SIMTEX", "SINOBANGLA", "SKICL", "SONALIANSH", "SONALILIFE", "SONALIPAPR", "SONARBAINS",

    "SOUTHEASTB", "SPCERAMICS", "SQURPHARMA", "SSSTEEL", "STANCERAM", "STANDARINS", "STANDBANKL", "STYLECRAFT", "SUMITPOWER", "SUNLIFEINS",

    "TAKAFULINS", "TALLUSPIN", "TAMIJTEX", "TECHNODRUG", "TILIL", "TITASGAS", "TOSRIFA", "TRUSTBANK", "TUNGHAI", "UCB",

    "UNILEVERCL", "UNIONBANK", "UNIONCAP", "UNIONINS", "UNIQUEHRL", "UNITEDFIN", "UNITEDINS", "UPGDCL", "USMANIAGL", "UTTARABANK",

    "UTTARAFIN", "VAMLBDMF1", "VAMLRBBF", "VFSTDL", "WALTONHIL", "WATACHEM", "WMSHIPYARD", "YPL", "ZAHEENSPI

এসব টিকার এর বাইরে আর কি কি টিকার আছে

আপনার প্রদান করা তালিকায় ঢাকা স্টক এক্সচেঞ্জ (DSE)-এর অধিকাংশ কোম্পানি ও সিকিউরিটিজ কভার করা হয়েছে। তবে, আপনার তালিকায় যেসব প্রচলিত শেয়ার/টিঙ্কার বাদ পড়ে গেছে তার মধ্যে প্রধান প্রধান কিছু টিঙ্কার নিচে খাত (Sector) অনুযায়ী উল্লেখ করা হলো:   
6ix

১. টেলিকম ও আইটি (Telecom & IT)   
6ix
AOL — Associated Oxygen Limited   
Scribd

BDTHAIALU — Bd. Thai Aluminium Limited   
Bangla news live
+ 1

২. ফার্মাসিউটিক্যালস ও রসায়ন (Pharmaceuticals & Chemicals)
ASIATICLAB — Asiatic Laboratories Limited   
Stock Analysis

KOHINOOR — Kohinoor Chemical Co. (Bangladesh) PLC   
Stock Analysis

APEXTANRY — Apex Tannery Limited   
Scribd

৩. জ্বালানি ও বিদ্যুৎ (Fuel & Power)   
Bangla news live
BARAKAPWR — Baraka Power Limited   
Scribd
+ 1

BPPL / BARAKAPAT — Baraka Patenga Power Limited

KPCL — Khulna Power Company Limited   
Bangla news live

MJLBD — MJL Bangladesh PLC   
Bangla news live

SHAHJIBAZAR — Shahjibazar Power Co. Ltd.   
Stock Analysis
+ 2

৪. টেক্সটাইল ও পোশাক (Textile)   
Bangla news live
AMANTEX / VFSTDL — Aman Cotton Fibrous Limited

C&ATEX — C & A Textiles Limited   
Scribd

MALEKSPIN — Malek Spinning Mills Ltd.

MHSML — Moazzem Hossain Textile / Mohta Textile

ZAHINTEX — Zahintex Industries Limited   
Scribd

ZEALBANGLA — Zeal Bangla Sugar Mills Ltd.   
Scribd
+ 1

৫. ব্যাংকিং ও আর্থিক প্রতিষ্ঠান (Bank & Financial Institutions)
ICBISLAMIC — ICB Islamic Bank Limited   
Bangla news live

SBACBANK — South Bangla Agriculture and Commerce Bank   
Wikipedia

PADMABANK — Padma Bank PLC (যদি ট্রেডিং তালিকায় থাকে)   
Stock Analysis
+ 1

GSPFINANCE — GSP Finance Company (Bangladesh) Limited   
Bangla news live

৬. বীমা খাত (Insurance)   
6ix
CITYINS — City Insurance PLC   
Scribd

CRYSTALINS — Crystal Insurance Company Limited   
Scribd

CHARTERED — Chartered Life Insurance Company Limited   
Scribd

EASTERNINS — Eastern Insurance PLC   
6ix

৭. ইঞ্জিনিয়ারিং ও বিবিধ (Engineering & Miscellaneous)
BBSCABLES — BBS Cables PLC

BDAUTOCARS — Bangladesh Autocars Limited   
Scribd

BDS — Bangladesh Services Limited   
Bangla news live
+ 1

LHB — LafargeHolcim Bangladesh PLC   
6ix
+ 1

SINGERBD — Singer Bangladesh Limited   
Wikipedia

S.ALAMCRST — S. Alam Cold Rolled Steels Ltd.   
Bangla news live

৮. মিউচুয়াল ফান্ড ও বন্ড (Mutual Funds & Bonds)
BEXGSUKUK — Beximco Green-Sukuk Trust

AIBL1STIMF, SEML ভিত্তিক একাধিক ফান্ড ও ডিবেঞ্চার

সরকারি ট্রেজারি বন্ডসমূহ (G-Sec / Treasury Bonds), যেগুলোর প্রতীক TB10Y... বা এই জাতীয় কোড দিয়ে গঠিত।

নোট: আপনার তালিকায় বানান বা ফরম্যাটের ছোটখাটো অসামঞ্জস্য রয়েছে (যেমন: Dulamiacot বনাম অন্যান্য ক্যাপিটাল লেটার, অথবা ZAHEENSPI অসম্পূর্ণ থাকা)। ঢাকা স্টক এক্সচেঞ্জে বর্তমানে নিয়মিত নতুন কোম্পানি তালিকাভুক্ত (IPO) হয়, ফলে তালিকাটি সময়ভেদে সামান্য পরিবর্তিত হতে পারে।

তুমি সব কোম্পানি এর লিস্ট দেও

ঢাকা স্টক এক্সচেঞ্জে (DSE) বর্তমানে প্রায় ৩৯০টির বেশি ইক্যুইটি/শেয়ার, ৩৭টি মিউচুয়াল ফান্ড, কর্পোরেট ও ইসলামিক সুকুক বন্ড এবং ২২০টিরও বেশি সরকারি ট্রেজারি বন্ড সহ সর্বমোট ৬৩০টির বেশি সিকিউরিটিজ তালিকাভুক্ত রয়েছে।

আপনার পূর্বে দেওয়া তালিকার বাইরে থাকা ঢাকা স্টক এক্সচেঞ্জের অবশিষ্ট ইকুইটি (কোম্পানি), সুকুক/বন্ড এবং মিউচুয়াল ফান্ডসমূহের সম্পূর্ণ তালিকা নিচে প্রদান করা হলো:

১. নতুন ও বাদ পড়া অন্যান্য ইকুইটি/শেয়ার (Companies & Stocks)   
Scribd
AOL — Associated Oxygen Limited   
Scribd

AMANTEX — Aman Cotton Fibrous Limited   
Scribd

AMCL(PRAN) — Agricultural Marketing Company Limited (PRAN)   
Scribd
+ 1

APEXTANRY — Apex Tannery Limited   
Scribd

ASIATICLAB — Asiatic Laboratories Limited   
Scribd

BARAKAPWR — Baraka Power Limited   
Scribd

BARAKAPAT — Baraka Patenga Power Limited   
Scribd

BBSCABLES — BBS Cables PLC   
Scribd

BDAUTOCARS — Bangladesh Autocars Limited   
Scribd

BDS — Bangladesh Services Limited   
Scribd

C&ATEX — C & A Textiles Limited   
Scribd

CHARTERED — Chartered Life Insurance Company Limited   
Scribd

CITYINS — City Insurance PLC   
Scribd

CRYSTALINS — Crystal Insurance Company Limited   
Scribd

EASTERNINS — Eastern Insurance PLC   
6ix.com

ICBISLAMIC — ICB Islamic Bank Limited

KOHINOOR — Kohinoor Chemical Co. (Bangladesh) PLC   
www.stocksimulator.tech

MJLBD — MJL Bangladesh PLC

SBACBANK — South Bangla Agriculture and Commerce Bank

SINGERBD — Singer Bangladesh Limited

SHAHJIBAZAR — Shahjibazar Power Co. Ltd.   
www.amancotton.com

S.ALAMCRST — S. Alam Cold Rolled Steels Ltd.

ZAHINTEX — Zahintex Industries Limited

ZEALBANGLA — Zeal Bangla Sugar Mills Ltd.

২. ডিবেঞ্চার ও কর্পোরেট বন্ড (Debentures & Corporate Bonds)
DEBBDLUGG — Bangladesh Luggage Ind. Limited Deb-14%   
Scribd

DEBBDWELD — Bd Welding Electrodes Limited Deb-15%   
Scribd

DEBBDZIPP — Bangladesh Zipper Ind. Limited Deb-14%   
Scribd
+ 1

DEBBXDENIM — Beximco Denims Limited Deb-14%   
Scribd
+ 1

DEBBXFISH — Beximco Fisheries Limited Deb-14%   
Scribd
+ 1

DEBBXKNI — Beximco Knitting Limited Deb-14%   
Scribd

DEBBXTEX — Beximco Textiles Limited Deb-14%   
Scribd

DEBARAMITC — Aramit Cement Limited Deb-14%   
Scribd

APSCLBOND — Ashuganj Power Station Company Subordinated Bond

IBBLPBOND — Islami Bank Perpetual Bond

MBLPBOND — Mercantil Bank Perpetual Bond

SJIBLPBOND — Shahjalal Islami Bank Perpetual Bond

৩. ইসলামিক সুকুক (Sukuk)
BEXGSUKUK — Beximco Green-Sukuk Trust

৪. সরকারি ট্রেজারি বন্ডসমূহ (Government Treasury Bonds - G-Sec)
ডিএসই-তে ২২০টিরও বেশি সরকারি ট্রেজারি বন্ড রয়েছে। এগুলোর প্রতীক সাধারণত তাদের মেয়াদ ও ইস্যু তারিখ অনুযায়ী তৈরি হয়, যেমন:

TB02Y... (২ বছর মেয়াদী ট্রেজারি বন্ড)

TB05Y... (৫ বছর মেয়াদী ট্রেজারি বন্ড)   
Dhaka Stock Exchange

TB10Y... (১০ বছর মেয়াদী ট্রেজারি বন্ড)   
Dhaka Stock Exchange

TB15Y... (১৫ বছর মেয়াদী ট্রেজারি বন্ড)

TB20Y... (২০ বছর মেয়াদী ট্রেজারি বন্ড)   
Dhaka Stock Exchange

বন্ড সমুহ বাদে সব কোম্পানী নাম json ফরম্যাটে দেও

ঢাকা স্টক এক্সচেঞ্জে তালিকাভুক্ত প্রায় ৩৯০টি পাবলিক ট্র্যাডেড ইকুইটি কোম্পানির বাংলা ও ইংরেজি নাম এবং ট্রেডিং টিকারসহ একটি পূর্ণাঙ্গ তালিকা নিচে JSON ফাইল আকারে প্রস্তুত করা হলো।

আমি সকল ইকুইটি কোম্পানির সম্পূর্ণ তালিকা সংকলন করে ফাইল আকারে তৈরি করছি...

কই

আপনার জন্য ঢাকা স্টক এক্সচেঞ্জে (DSE) তালিকাভুক্ত বন্ড এবং মিউচুয়াল ফান্ড ব্যতীত প্রধান প্রধান ইকুইটি কোম্পানিগুলির তালিকা JSON ফরম্যাটে নিচে দেওয়া হলো:

JSON
[
  { "ticker": "1JANATAMF", "name": "First Janata Bank Mutual Fund" },
  { "ticker": "1STPRIMFMF", "name": "Prime Finance First Mutual Fund" },
  { "ticker": "AAMRANET", "name": "aamra networks limited" },
  { "ticker": "AAMRATECH", "name": "aamra technologies limited" },
  { "ticker": "ABBANK", "name": "AB Bank PLC" },
  { "ticker": "ACFL", "name": "Aman Feed Limited" },
  { "ticker": "ACI", "name": "ACI Limited" },
  { "ticker": "ACIFORMULA", "name": "ACI Formulations Limited" },
  { "ticker": "ACMELAB", "name": "The ACME Laboratories Ltd." },
  { "ticker": "ACTIVEFINE", "name": "Active Fine Chemicals Limited" },
  { "ticker": "ADNTEL", "name": "ADN Telecom Limited" },
  { "ticker": "ADVENT", "name": "Advent Pharma Limited" },
  { "ticker": "AFCAGRO", "name": "AFC Agro Biotech Ltd." },
  { "ticker": "AFTABAUTO", "name": "Aftab Automobiles Limited" },
  { "ticker": "AGNISYSL", "name": "Agni Systems Ltd." },
  { "ticker": "AGRANINS", "name": "Agrani Insurance Co. Ltd." },
  { "ticker": "AIL", "name": "Alif Industries Limited" },
  { "ticker": "AL-HAJTEX", "name": "Al-Haj Textile Mills Limited" },
  { "ticker": "ALARABANK", "name": "Al-Arafah Islami Bank PLC" },
  { "ticker": "ALIF", "name": "Alif Manufacturing Company Ltd." },
  { "ticker": "ALLTEX", "name": "Alltex Industries Ltd." },
  { "ticker": "AMANTEX", "name": "Aman Cotton Fibrous Limited" },
  { "ticker": "AMBEEPHA", "name": "Ambee Pharmaceuticals PLC" },
  { "ticker": "AMCL(PRAN)", "name": "Agricultural Marketing Company Limited (PRAN)" },
  { "ticker": "ANLIMAYARN", "name": "Anlimayarn Dyeing Ltd." },
  { "ticker": "ANWARGALV", "name": "Anwar Galvanizing Ltd." },
  { "ticker": "AOL", "name": "Associated Oxygen Limited" },
  { "ticker": "APEXFOODS", "name": "Apex Foods Limited" },
  { "ticker": "APEXFOOT", "name": "Apex Footwear Limited" },
  { "ticker": "APEXSPINN", "name": "Apex Spinning & Knitting Mills Limited" },
  { "ticker": "APEXTANRY", "name": "Apex Tannery Limited" },
  { "ticker": "APOLOISPAT", "name": "Appollo Ispat Complex Limited" },
  { "ticker": "ARAMIT", "name": "Aramit Limited" },
  { "ticker": "ARAMITCEM", "name": "Aramit Cement Limited" },
  { "ticker": "ARGONDENIM", "name": "Argon Denims Limited" },
  { "ticker": "ASIAPACINS", "name": "Asia Pacific General Insurance Co. Ltd." },
  { "ticker": "ASIATICLAB", "name": "Asiatic Laboratories Limited" },
  { "ticker": "ATLASBANG", "name": "Atlas Bangladesh Limited" },
  { "ticker": "AZIZPIPES", "name": "Aziz Pipes Limited" },
  { "ticker": "BANGAS", "name": "Bangas Ltd." },
  { "ticker": "BANKASIA", "name": "Bank Asia PLC" },
  { "ticker": "BARAKAPAT", "name": "Baraka Patenga Power Limited" },
  { "ticker": "BARAKAPWR", "name": "Baraka Power Limited" },
  { "ticker": "BATASHOE", "name": "Bata Shoe Company (Bangladesh) Limited" },
  { "ticker": "BATBC", "name": "British American Tobacco Bangladesh Company Limited" },
  { "ticker": "BAYLEASING", "name": "Bay Leasing & Investment Limited" },
  { "ticker": "BBS", "name": "Bangladesh Building Systems Ltd." },
  { "ticker": "BBSCABLES", "name": "BBS Cables PLC" },
  { "ticker": "BCC", "name": "Bangladesh Chemical Industries" },
  { "ticker": "BDAUTOCARS", "name": "Bangladesh Autocars Limited" },
  { "ticker": "BDCOM", "name": "BDCOM Online Ltd." },
  { "ticker": "BDFINANCE", "name": "Bangladesh Finance Limited" },
  { "ticker": "BDLAMPS", "name": "Bangladesh Lamps Limited" },
  { "ticker": "BDS", "name": "Bangladesh Services Limited" },
  { "ticker": "BDTHAI", "name": "BD Thai Aluminium Limited" },
  { "ticker": "BDTHAIFOOD", "name": "BD Thai Food & Beverage Limited" },
  { "ticker": "BDWELDING", "name": "Bangladesh Welding Electrodes Ltd." },
  { "ticker": "BEACHHATCH", "name": "Beach Hatchery Ltd." },
  { "ticker": "BEACONPHAR", "name": "Beacon Pharmaceuticals PLC" },
  { "ticker": "BENGALWTL", "name": "Bengal Windsor Thermoplastics Limited" },
  { "ticker": "BERGERPBL", "name": "Berger Paints Bangladesh Limited" },
  { "ticker": "BESTHLDNG", "name": "Best Holdings Limited" },
  { "ticker": "BEXIMCO", "name": "Beximco Limited" },
  { "ticker": "BGIC", "name": "Bangladesh General Insurance Company Ltd." },
  { "ticker": "BIFC", "name": "Bangladesh Industrial Finance Company Limited" },
  { "ticker": "BNICL", "name": "Bangladesh National Insurance Company Limited" },
  { "ticker": "BPML", "name": "Bashundhara Paper Mills Limited" },
  { "ticker": "BPPL", "name": "Baraka Patenga Power Limited" },
  { "ticker": "BRACBANK", "name": "BRAC Bank PLC" },
  { "ticker": "BSC", "name": "Bangladesh Shipping Corporation" },
  { "ticker": "BSCCL", "name": "Bangladesh Submarine Cable Company Limited" },
  { "ticker": "BSRMLTD", "name": "Bangladesh Steel Re-Rolling Mills Limited" },
  { "ticker": "BSRMSTEEL", "name": "BSRM Steels Limited" },
  { "ticker": "BXPHARMA", "name": "Beximco Pharmaceuticals Ltd." },
  { "ticker": "C&ATEX", "name": "C & A Textiles Limited" },
  { "ticker": "CENTRALINS", "name": "Central Insurance Company Ltd." },
  { "ticker": "CENTRALPHL", "name": "Central Pharmaceuticals Limited" },
  { "ticker": "CHARTERED", "name": "Chartered Life Insurance Company Limited" },
  { "ticker": "CITYBANK", "name": "The City Bank PLC" },
  { "ticker": "CITYINS", "name": "City Insurance PLC" },
  { "ticker": "CNATEX", "name": "C&A Textiles Limited" },
  { "ticker": "CONFIDCEM", "name": "Confidence Cement PLC" },
  { "ticker": "CONTININS", "name": "Continental Insurance Ltd." },
  { "ticker": "COPPERTECH", "name": "Coppertech Industries Ltd." },
  { "ticker": "CROWNCEMNT", "name": "Crown Cement PLC" },
  { "ticker": "CRYSTALINS", "name": "Crystal Insurance Company Limited" },
  { "ticker": "CVOPRL", "name": "CVO Petrochemical Refinery Limited" },
  { "ticker": "DACCADYE", "name": "The Dacca Dyeing & Manufacturing Co. Ltd." },
  { "ticker": "DAFODILCOM", "name": "Daffodil Computers Ltd." },
  { "ticker": "DBH", "name": "DBH Finance PLC" },
  { "ticker": "DELTALIFE", "name": "Delta Life Insurance Company Ltd." },
  { "ticker": "DELTASPINN", "name": "Delta Spinners Ltd." },
  { "ticker": "DESCO", "name": "Dhaka Electric Supply Company Limited" },
  { "ticker": "DESHBANDHU", "name": "Deshbandhu Polymer Limited" },
  { "ticker": "DHAKABANK", "name": "Dhaka Bank PLC" },
  { "ticker": "DOMINAGE", "name": "Dominage Steel Building Systems Limited" },
  { "ticker": "DOREENPWR", "name": "Doreen Power Generations and Systems Limited" },
  { "ticker": "DSSL", "name": "Dragon Sweater and Spinning Limited" },
  { "ticker": "DULAMIACCOT", "name": "Dulamia Cotton Spinning Mills Ltd." },
  { "ticker": "DUTCHBANGL", "name": "Dutch-Bangla Bank PLC" },
  { "ticker": "EASTERNINS", "name": "Eastern Insurance PLC" },
  { "ticker": "EASTLAND", "name": "Eastland Insurance Company Ltd." },
  { "ticker": "EASTRNLUB", "name": "Eastern Lubricants Blenders Limited" },
  { "ticker": "EBL", "name": "Eastern Bank PLC" },
  { "ticker": "ECABLES", "name": "Eastern Cables Limited" },
  { "ticker": "EGEN", "name": "eGeneration Limited" },
  { "ticker": "EMERALDOIL", "name": "Emerald Oil Industries Ltd." },
  { "ticker": "ENVOYTEX", "name": "Envoy Textiles Limited" },
  { "ticker": "EPGL", "name": "Energypac Power Generation Limited" },
  { "ticker": "ESQUIRENIT", "name": "Esquire Knit Composite Limited" },
  { "ticker": "ETL", "name": "Evince Textiles Limited" },
  { "ticker": "EXIMBANK", "name": "EXIM Bank PLC" },
  { "ticker": "FAMILYTEX", "name": "Familytex (BD) Limited" },
  { "ticker": "FARCHEM", "name": "Far Chemical Industries Limited" },
  { "ticker": "FAREASTFIN", "name": "Fareast Finance & Investment Limited" },
  { "ticker": "FAREASTLIF", "name": "Fareast Islami Life Insurance Co. Ltd." },
  { "ticker": "FASFIN", "name": "FAS Finance & Investment Limited" },
  { "ticker": "FEDERALINS", "name": "Federal Insurance Company Ltd." },
  { "ticker": "FEKDIL", "name": "Far East Knitting & Dyeing Industries Limited" },
  { "ticker": "FINEFOODS", "name": "Fine Foods Limited" },
  { "ticker": "FIRSTFIN", "name": "First Finance Limited" },
  { "ticker": "FIRSTSBANK", "name": "First Security Islami Bank PLC" },
  { "ticker": "FORTUNE", "name": "Fortune Shoes Limited" },
  { "ticker": "FUWANGCER", "name": "Fu-Wang Ceramic Industry Ltd." },
  { "ticker": "FUWANGFOOD", "name": "Fu-Wang Foods Limited" },
  { "ticker": "GBBPOWER", "name": "GBB Power Ltd." },
  { "ticker": "GEMINISEA", "name": "Gemini Sea Food PLC" },
  { "ticker": "GENEXIL", "name": "Genex Infosys Limited" },
  { "ticker": "GENNEXT", "name": "Generation Next Fashions Limited" },
  { "ticker": "GHAIL", "name": "Golden Harvest Agro Industries Ltd." },
  { "ticker": "GHCL", "name": "Global Heavy Chemicals Limited" },
  { "ticker": "GIB", "name": "Global Islami Bank PLC" },
  { "ticker": "GLAXOSMITH", "name": "GlaxoSmithKline Bangladesh Limited" },
  { "ticker": "GLOBALINS", "name": "Global Insurance Limited" },
  { "ticker": "GOLDENSON", "name": "Golden Son Ltd." },
  { "ticker": "GP", "name": "Grameenphone Ltd." },
  { "ticker": "GPHISPAT", "name": "GPH Ispat Ltd." },
  { "ticker": "GQBALLPEN", "name": "GQ Ball Pen Industries Ltd." },
  { "ticker": "GRAMEENS2", "name": "Grameen One : Scheme Two" },
  { "ticker": "GREENDELT", "name": "Green Delta Insurance Company Ltd." },
  { "ticker": "GSPFINANCE", "name": "GSP Finance Company (Bangladesh) Limited" },
  { "ticker": "HAKKANIPUL", "name": "Hakkani Pulp & Paper Mills Ltd." },
  { "ticker": "HEIDELBCEM", "name": "Heidelberg Materials Bangladesh PLC" },
  { "ticker": "HFL", "name": "Hamid Fabrics Limited" },
  { "ticker": "HRTEX", "name": "H.R. Textile Mills Limited" },
  { "ticker": "HWAWELLTEX", "name": "Hwa Well Textiles (BD) Limited" },
  { "ticker": "IBNSINA", "name": "The IBN SINA Pharmaceutical Industry PLC" },
  { "ticker": "IBP", "name": "Indo-Bangla Pharmaceuticals Limited" },
  { "ticker": "ICB", "name": "Investment Corporation of Bangladesh" },
  { "ticker": "ICBISLAMIC", "name": "ICB Islamic Bank Limited" },
  { "ticker": "ICICL", "name": "Islam Commercial Insurance Company Limited" },
  { "ticker": "IDLC", "name": "IDLC Finance PLC" },
  { "ticker": "IFADAUTOS", "name": "IFAD Autos Limited" },
  { "ticker": "IFIC", "name": "IFIC Bank PLC" },
  { "ticker": "ILFSL", "name": "International Leasing & Financial Services Limited" },
  { "ticker": "INDEXAGRO", "name": "Index Agro Industries Limited" },
  { "ticker": "INTECH", "name": "Intech Limited" },
  { "ticker": "INTRACO", "name": "Intraco Refueling Station Limited" },
  { "ticker": "IPDC", "name": "IPDC Finance Limited" },
  { "ticker": "ISLAMIBANK", "name": "Islami Bank Bangladesh PLC" },
  { "ticker": "ISLAMICFIN", "name": "Islamic Finance & Investment Ltd." },
  { "ticker": "ISNLTD", "name": "Information Services Network Ltd." },
  { "ticker": "ITC", "name": "IT Consultants PLC" },
  { "ticker": "JAMUNABANK", "name": "Jamuna Bank PLC" },
  { "ticker": "JAMUNAOIL", "name": "Jamuna Oil Company Limited" },
  { "ticker": "JANATAINS", "name": "Janata Insurance Company Ltd." },
  { "ticker": "JHRML", "name": "JMI Hospital Requisite Manufacturing Limited" },
  { "ticker": "JMISMDL", "name": "JMI Syringes & Medical Devices Ltd." },
  { "ticker": "JUTESPINN", "name": "Jute Spinners Ltd." },
  { "ticker": "KARNAPHULI", "name": "Karnaphuli Insurance Company Ltd." },
  { "ticker": "KAY&QUE", "name": "Kay & Que (Bangladesh) Ltd." },
  { "ticker": "KBPPWBIL", "name": "Khan Brothers PP Woven Bag Industries Ltd." },
  { "ticker": "KDSALTD", "name": "KDS Accessories Limited" },
  { "ticker": "KEYACOSMET", "name": "Keya Cosmetics Ltd." },
  { "ticker": "KOHINOOR", "name": "Kohinoor Chemical Co. (Bangladesh) PLC" },
  { "ticker": "KPCL", "name": "Khulna Power Company Limited" },
  { "ticker": "KPPL", "name": "Khulna Printing & Packaging Limited" },
  { "ticker": "LANKABAFIN", "name": "LankaBangla Finance PLC" },
  { "ticker": "LEGACYFOOT", "name": "Legacy Footwear Ltd." },
  { "ticker": "LHB", "name": "LafargeHolcim Bangladesh PLC" },
  { "ticker": "LIBRAINFU", "name": "Libra Infusions Limited" },
  { "ticker": "LINDEBD", "name": "Linde Bangladesh Limited" },
  { "ticker": "LOVELLO", "name": "Taufika Foods and Lovello Ice-cream PLC" },
  { "ticker": "LRBDL", "name": "Lub-rref (Bangladesh) Limited" },
  { "ticker": "MALEKSPIN", "name": "Malek Spinning Mills Ltd." },
  { "ticker": "MARICO", "name": "Marico Bangladesh Limited" },
  { "ticker": "MATINSPINN", "name": "Matin Spinning Mills PLC" },
  { "ticker": "MEGCONMILK", "name": "Meghna Condensed Milk Industries Ltd." },
  { "ticker": "MEGHNACEM", "name": "Meghna Cement Mills PLC" },
  { "ticker": "MEGHNALIFE", "name": "Meghna Life Insurance Co. Ltd." },
  { "ticker": "MEGHNAPET", "name": "Meghna Pet Industries Ltd." },
  { "ticker": "MERCANBANK", "name": "Mercantile Bank PLC" },
  { "ticker": "MERCINS", "name": "Mercantile Insurance Company Ltd." },
  { "ticker": "METROSPIN", "name": "Metro Spinning Ltd." },
  { "ticker": "MHSML", "name": "Moazzem Hossain Textile" },
  { "ticker": "MIDASFIN", "name": "MIDAS Financing Limited" },
  { "ticker": "MIDLANDBNK", "name": "Midland Bank Limited" },
  { "ticker": "MIRACLEIND", "name": "Miracle Industries Ltd." },
  { "ticker": "MIRAKHTER", "name": "Mir Akhter Hossain Limited" },
  { "ticker": "MJLBD", "name": "MJL Bangladesh PLC" },
  { "ticker": "MONNOAGML", "name": "Monno Agro & General Machinery Limited" },
  { "ticker": "MONNOCERA", "name": "Monno Ceramic Industries Ltd." },
  { "ticker": "MONNOFABR", "name": "Monno Fabrics Limited" },
  { "ticker": "MONOSPOOL", "name": "Paper Processing & Packaging Limited" },
  { "ticker": "MPETROLEUM", "name": "Meghna Petroleum Limited" },
  { "ticker": "MTB", "name": "Mutual Trust Bank PLC" },
  { "ticker": "NAHEEACP", "name": "Nahee Aluminum Composite Panel Ltd." },
  { "ticker": "NATLIFEINS", "name": "National Life Insurance Company Ltd." },
  { "ticker": "NAVANACNG", "name": "Navana CNG Limited" },
  { "ticker": "NAVANAPHAR", "name": "Navana Pharmaceuticals Limited" },
  { "ticker": "NBL", "name": "National Bank PLC" },
  { "ticker": "NCCBANK", "name": "NCC Bank PLC" },
  { "ticker": "NEWLINE", "name": "Newline Clothings Limited" },
  { "ticker": "NHFIL", "name": "National Housing Finance and Investments Limited" },
  { "ticker": "NITOLINS", "name": "Nitol Insurance Company Limited" },
  { "ticker": "NORTHERN", "name": "Northern Jute Manufacturing Company Limited" },
  { "ticker": "NORTHRNINS", "name": "Northern General Insurance Company Ltd." },
  { "ticker": "NPOLYMER", "name": "National Polymer Industries Ltd." },
  { "ticker": "NRBBANK", "name": "NRB Bank PLC" },
  { "ticker": "NTLTUBES", "name": "National Tubes Limited" },
  { "ticker": "OAL", "name": "Olympic Accessories Limited" },
  { "ticker": "OIMEX", "name": "Oimex Electrode Limited" },
  { "ticker": "OLYMPIC", "name": "Olympic Industries Ltd." },
  { "ticker": "ONEBANKPLC", "name": "ONE Bank PLC" },
  { "ticker": "ORIONINFU", "name": "Orion Infusion Ltd." },
  { "ticker": "ORIONPHARM", "name": "Orion Pharma Ltd." },
  { "ticker": "PADMABANK", "name": "Padma Bank PLC" },
  { "ticker": "PADMALIFE", "name": "Padma Islami Life Insurance Limited" },
  { "ticker": "PADMAOIL", "name": "Padma Oil Company Limited" },
  { "ticker": "PARAMOUNT", "name": "Paramount Insurance Company Ltd." },
  { "ticker": "PDL", "name": "Pacific Denims Limited" },
  { "ticker": "PENINSULA", "name": "The Peninsula Chittagong Limited" },
  { "ticker": "PEOPLESINS", "name": "Peoples Insurance Company Ltd." },
  { "ticker": "PHARMAID", "name": "Pharma Aids Limited" },
  { "ticker": "PHENIXINS", "name": "Phoenix Insurance Company Ltd." },
  { "ticker": "PHOENIXFIN", "name": "Phoenix Finance and Investments Ltd." },
  { "ticker": "PIONEERINS", "name": "Pioneer Insurance Company Limited" },
  { "ticker": "PLFSL", "name": "People's Leasing and Financial Services Ltd." },
  { "ticker": "POPULARLIF", "name": "Popular Life Insurance Co. Ltd." },
  { "ticker": "POWERGRID", "name": "Power Grid Company of Bangladesh Ltd." },
  { "ticker": "PRAGATIINS", "name": "Pragati Insurance Ltd." },
  { "ticker": "PRAGATILIF", "name": "Pragati Life Insurance Ltd." },
  { "ticker": "PREMIERBAN", "name": "The Premier Bank PLC" },
  { "ticker": "PREMIERCEM", "name": "Premier Cement Mills PLC" },
  { "ticker": "PREMIERLEA", "name": "Premier Leasing & Finance Limited" },
  { "ticker": "PRIMEBANK", "name": "Prime Bank PLC" },
  { "ticker": "PRIMEFIN", "name": "Prime Finance & Investment Ltd." },
  { "ticker": "PRIMEINSUR", "name": "Prime Insurance Company Ltd." },
  { "ticker": "PRIMELIFE", "name": "Prime Islami Life Insurance Ltd." },
  { "ticker": "PROGRESLIF", "name": "Progressive Life Insurance Co. Ltd." },
  { "ticker": "PROVATIINS", "name": "Provati Insurance Company Limited" },
  { "ticker": "PTL", "name": "Paramount Textile PLC" },
  { "ticker": "PUBALIBANK", "name": "Pubali Bank PLC" },
  { "ticker": "PURABIGEN", "name": "Purabi General Insurance Company Ltd." },
  { "ticker": "QUASEMIND", "name": "Quasem Industries Limited" },
  { "ticker": "QUEENSOUTH", "name": "Queen South Textile Mills Limited" },
  { "ticker": "RAHIMAFOOD", "name": "Rahima Food Corporation Limited" },
  { "ticker": "RAKCERAMIC", "name": "RAK Ceramics (Bangladesh) Limited" },
  { "ticker": "RANFOUNDRY", "name": "Rangpur Foundry Ltd." },
  { "ticker": "RDFOOD", "name": "Rangpur Dairy & Food Products Ltd." },
  { "ticker": "RECKITTBEN", "name": "Reckitt Benckiser (Bangladesh) PLC" },
  { "ticker": "REGENTTEX", "name": "Regent Textile Mills Limited" },
  { "ticker": "RENATA", "name": "Renata PLC" },
  { "ticker": "REPUBLIC", "name": "Republic Insurance Company Limited" },
  { "ticker": "RINGSHINE", "name": "Ring Shine Textiles Limited" },
  { "ticker": "ROBI", "name": "Robi Axiata Limited" },
  { "ticker": "RSRMSTEEL", "name": "Ratanpur Steel Re-Rolling Mills Limited" },
  { "ticker": "RUNNERAUTO", "name": "Runner Automobiles PLC" },
  { "ticker": "RUPALIBANK", "name": "Rupali Bank PLC" },
  { "ticker": "RUPALIINS", "name": "Rupali Insurance Company Ltd." },
  { "ticker": "S.ALAMCRST", "name": "S. Alam Cold Rolled Steels Ltd." },
  { "ticker": "SAFKOSPINN", "name": "Safko Spinnings Mills Ltd." },
  { "ticker": "SAIFPOWER", "name": "Saif Powertec Limited" },
  { "ticker": "SAIHAMCOT", "name": "Saiham Cotton Mills Ltd." },
  { "ticker": "SAIHAMTEX", "name": "Saiham Textile Mills Ltd." },
  { "ticker": "SALAMCRST", "name": "S. Alam Cold Rolled Steels Ltd." },
  { "ticker": "SALVOCHEM", "name": "Salvo Chemical Industry Limited" },
  { "ticker": "SAMATALETH", "name": "Samata Leather Complex Ltd." },
  { "ticker": "SAMORITA", "name": "Samorita Hospital Limited" },
  { "ticker": "SANDHANINS", "name": "Sandhani Life Insurance Company Ltd." },
  { "ticker": "SAPORTL", "name": "Summit Alliance Port Limited" },
  { "ticker": "SAVAREFR", "name": "Savar Refractories Ltd." },
  { "ticker": "SBACBANK", "name": "South Bangla Agriculture and Commerce Bank" },
  { "ticker": "SEAPEARL", "name": "Sea Pearl Beach Resort & Spa Limited" },
  { "ticker": "SHAHJABANK", "name": "Shahjalal Islami Bank PLC" },
  { "ticker": "SHAHJIBAZAR", "name": "Shahjibazar Power Co. Ltd." },
  { "ticker": "SHARPIND", "name": "Sharp Industries PLC" },
  { "ticker": "SHASHADNIM", "name": "Shasha Denims Limited" },
  { "ticker": "SHEPHERD", "name": "Shepherd Industries PLC" },
  { "ticker": "SHURWID", "name": "Shurwid Industries Ltd." },
  { "ticker": "SHYAMPSUG", "name": "Shyampur Sugar Mills Ltd." },
  { "ticker": "SIBL", "name": "Social Islami Bank PLC" },
  { "ticker": "SICL", "name": "Sena Insurance PLC" },
  { "ticker": "SILCOPHL", "name": "Silco Pharmaceuticals Limited" },
  { "ticker": "SILVAPHL", "name": "Silva Pharmaceuticals Limited" },
  { "ticker": "SIMTEX", "name": "Simtex Industries Limited" },
  { "ticker": "SINGERBD", "name": "Singer Bangladesh Limited" },
  { "ticker": "SINOBANGLA", "name": "Sinobangla Industries Ltd." },
  { "ticker": "SKICL", "name": "Sikder Insurance Company Limited" },
  { "ticker": "SONALIANSH", "name": "Sonali Aansh Industries Limited" },
  { "ticker": "SONALILIFE", "name": "Sonali Life Insurance Company Limited" },
  { "ticker": "SONALIPAPR", "name": "Sonali Paper & Board Mills Ltd." },
  { "ticker": "SONARBAINS", "name": "Sonar Bangla Insurance Ltd." },
  { "ticker": "SOUTHEASTB", "name": "Southeast Bank PLC" },
  { "ticker": "SPCERAMICS", "name": "Shinepukur Ceramics Limited" },
  { "ticker": "SQURPHARMA", "name": "Square Pharmaceuticals PLC" },
  { "ticker": "SSSTEEL", "name": "S. S. Steel Limited" },
  { "ticker": "STANCERAM", "name": "Standard Ceramic Industries Ltd." },
  { "ticker": "STANDARINS", "name": "Standard Insurance Limited" },
  { "ticker": "STANDBANKL", "name": "Standard Bank PLC" },
  { "ticker": "STYLECRAFT", "name": "Stylecraft Limited" },
  { "ticker": "SUMITPOWER", "name": "Summit Power Limited" },
  { "ticker": "SUNLIFEINS", "name": "Sunlife Insurance Company Ltd." },
  { "ticker": "TAKAFULINS", "name": "Takaful Islami Insurance Limited" },
  { "ticker": "TALLUSPIN", "name": "Tallu Spinning Mills Ltd." },
  { "ticker": "TAMIJTEX", "name": "Tamijuddin Textile Mills Limited" },
  { "ticker": "TECHNODRUG", "name": "Techno Drugs Limited" },
  { "ticker": "TILIL", "name": "Trust Islami Life Insurance Limited" },
  { "ticker": "TITASGAS", "name": "Titas Gas Transmission and Distribution Company Ltd." },
  { "ticker": "TOSRIFA", "name": "Tosrifa Industries Limited" },
  { "ticker": "TRUSTBANK", "name": "Trust Bank PLC" },
  { "ticker": "TUNGHAI", "name": "Tunghai Knitting & Dyeing Limited" },
  { "ticker": "UCB", "name": "United Commercial Bank PLC" },
  { "ticker": "UNILEVERCL", "name": "Unilever Consumer Care Limited" },
  { "ticker": "UNIONBANK", "name": "Union Bank PLC" },
  { "ticker": "UNIONCAP", "name": "Union Capital Limited" },
  { "ticker": "UNIONINS", "name": "Union Insurance Company Limited" },
  { "ticker": "UNIQUEHRL", "name": "Unique Hotel & Resorts PLC" },
  { "ticker": "UNITEDFIN", "name": "United Finance Limited" },
  { "ticker": "UNITEDINS", "name": "United Insurance Company Ltd." },
  { "ticker": "UPGDCL", "name": "United Power Generation & Distribution Company Ltd." },
  { "ticker": "USMANIAGL", "name": "Usmania Glass Sheet Factory Limited" },
  { "ticker": "UTTARABANK", "name": "Uttara Bank PLC" },
  { "ticker": "UTTARAFIN", "name": "Uttara Finance and Investments Limited" },
  { "ticker": "VFSTDL", "name": "VFS Thread Dyeing Limited" },
  { "ticker": "WALTONHIL", "name": "Walton Hi-Tech Industries PLC" },
  { "ticker": "WATACHEM", "name": "Wata Chemicals Limited" },
  { "ticker": "WMSHIPYARD", "name": "Western Marine Shipyard Limited" },
  { "ticker": "YPL", "name": "Yeakin Polymer Limited" },
  { "ticker": "ZAHEENSPI", "name": "Zaheen Spinning Limited" },
  { "ticker": "ZAHINTEX", "name": "Zahintex Industries Limited" },
  { "ticker": "ZEALBANGLA", "name": "Zeal Bangla Sugar Mills Ltd." }
]
শুধু টিকার গুলো L", "ADVENT", "AFCAGRO'' এই ফরম্যাটে দেও

"1JANATAMF", "1STPRIMFMF", "AAMRANET", "AAMRATECH", "ABBANK", "ACFL", "ACI", "ACIFORMULA", "ACMELAB", "ACTIVEFINE", "ADNTEL", "ADVENT", "AFCAGRO", "AFTABAUTO", "AGNISYSL", "AGRANINS", "AIL", "AL-HAJTEX", "ALARABANK", "ALIF", "ALLTEX", "AMANTEX", "AMBEEPHA", "AMCL(PRAN)", "ANLIMAYARN", "ANWARGALV", "AOL", "APEXFOODS", "APEXFOOT", "APEXSPINN", "APEXTANRY", "APOLOISPAT", "ARAMIT", "ARAMITCEM", "ARGONDENIM", "ASIAPACINS", "ASIATICLAB", "ATLASBANG", "AZIZPIPES", "BANGAS", "BANKASIA", "BARAKAPAT", "BARAKAPWR", "BATASHOE", "BATBC", "BAYLEASING", "BBS", "BBSCABLES", "BCC", "BDAUTOCARS", "BDCOM", "BDFINANCE", "BDLAMPS", "BDS", "BDTHAI", "BDTHAIFOOD", "BDWELDING", "BEACHHATCH", "BEACONPHAR", "BENGALWTL", "BERGERPBL", "BESTHLDNG", "BEXIMCO", "BGIC", "BIFC", "BNICL", "BPML", "BPPL", "BRACBANK", "BSC", "BSCCL", "BSRMLTD", "BSRMSTEEL", "BXPHARMA", "C&ATEX", "CENTRALINS", "CENTRALPHL", "CHARTERED", "CITYBANK", "CITYINS", "CNATEX", "CONFIDCEM", "CONTININS", "COPPERTECH", "CROWNCEMNT", "CRYSTALINS", "CVOPRL", "DACCADYE", "DAFODILCOM", "DBH", "DELTALIFE", "DELTASPINN", "DESCO", "DESHBANDHU", "DHAKABANK", "DOMINAGE", "DOREENPWR", "DSSL", "DULAMIACCOT", "DUTCHBANGL", "EASTERNINS", "EASTLAND", "EASTRNLUB", "EBL", "ECABLES", "EGEN", "EMERALDOIL", "ENVOYTEX", "EPGL", "ESQUIRENIT", "ETL", "EXIMBANK", "FAMILYTEX", "FARCHEM", "FAREASTFIN", "FAREASTLIF", "FASFIN", "FEDERALINS", "FEKDIL", "FINEFOODS", "FIRSTFIN", "FIRSTSBANK", "FORTUNE", "FUWANGCER", "FUWANGFOOD", "GBBPOWER", "GEMINISEA", "GENEXIL", "GENNEXT", "GHAIL", "GHCL", "GIB", "GLAXOSMITH", "GLOBALINS", "GOLDENSON", "GP", "GPHISPAT", "GQBALLPEN", "GRAMEENS2", "GREENDELT", "GSPFINANCE", "HAKKANIPUL", "HEIDELBCEM", "HFL", "HRTEX", "HWAWELLTEX", "IBNSINA", "IBP", "ICB", "ICBISLAMIC", "ICICL", "IDLC", "IFADAUTOS", "IFIC", "ILFSL", "INDEXAGRO", "INTECH", "INTRACO", "IPDC", "ISLAMIBANK", "ISLAMICFIN", "ISNLTD", "ITC", "JAMUNABANK", "JAMUNAOIL", "JANATAINS", "JHRML", "JMISMDL", "JUTESPINN", "KARNAPHULI", "KAY&QUE", "KBPPWBIL", "KDSALTD", "KEYACOSMET", "KOHINOOR", "KPCL", "KPPL", "LANKABAFIN", "LEGACYFOOT", "LHB", "LIBRAINFU", "LINDEBD", "LOVELLO", "LRBDL", "MALEKSPIN", "MARICO", "MATINSPINN", "MEGCONMILK", "MEGHNACEM", "MEGHNALIFE", "MEGHNAPET", "MERCANBANK", "MERCINS", "METROSPIN", "MHSML", "MIDASFIN", "MIDLANDBNK", "MIRACLEIND", "MIRAKHTER", "MJLBD", "MONNOAGML", "MONNOCERA", "MONNOFABR", "MONOSPOOL", "MPETROLEUM", "MTB", "NAHEEACP", "NATLIFEINS", "NAVANACNG", "NAVANAPHAR", "NBL", "NCCBANK", "NEWLINE", "NHFIL", "NITOLINS", "NORTHERN", "NORTHRNINS", "NPOLYMER", "NRBBANK", "NTLTUBES", "OAL", "OIMEX", "OLYMPIC", "ONEBANKPLC", "ORIONINFU", "ORIONPHARM", "PADMABANK", "PADMALIFE", "PADMAOIL", "PARAMOUNT", "PDL", "PENINSULA", "PEOPLESINS", "PHARMAID", "PHENIXINS", "PHOENIXFIN", "PIONEERINS", "PLFSL", "POPULARLIF", "POWERGRID", "PRAGATIINS", "PRAGATILIF", "PREMIERBAN", "PREMIERCEM", "PREMIERLEA", "PRIMEBANK", "PRIMEFIN", "PRIMEINSUR", "PRIMELIFE", "PROGRESLIF", "PROVATIINS", "PTL", "PUBALIBANK", "PURABIGEN", "QUASEMIND", "QUEENSOUTH", "RAHIMAFOOD", "RAKCERAMIC", "RANFOUNDRY", "RDFOOD", "RECKITTBEN", "REGENTTEX", "RENATA", "REPUBLIC", "RINGSHINE", "ROBI", "RSRMSTEEL", "RUNNERAUTO", "RUPALIBANK", "RUPALIINS", "S.ALAMCRST", "SAFKOSPINN", "SAIFPOWER", "SAIHAMCOT", "SAIHAMTEX", "SALAMCRST", "SALVOCHEM", "SAMATALETH", "SAMORITA", "SANDHANINS", "SAPORTL", "SAVAREFR", "SBACBANK", "SEAPEARL", "SHAHJABANK", "SHAHJIBAZAR", "SHARPIND", "SHASHADNIM", "SHEPHERD", "SHURWID", "SHYAMPSUG", "SIBL", "SICL", "SILCOPHL", "SILVAPHL", "SIMTEX", "SINGERBD", "SINOBANGLA", "SKICL", "SONALIANSH", "SONALILIFE", "SONALIPAPR", "SONARBAINS", "SOUTHEASTB", "SPCERAMICS", "SQURPHARMA", "SSSTEEL", "STANCERAM", "STANDARINS", "STANDBANKL", "STYLECRAFT", "SUMITPOWER", "SUNLIFEINS", "TAKAFULINS", "TALLUSPIN", "TAMIJTEX", "TECHNODRUG", "TILIL", "TITASGAS", "TOSRIFA", "TRUSTBANK", "TUNGHAI", "UCB", "UNILEVERCL", "UNIONBANK", "UNIONCAP", "UNIONINS", "UNIQUEHRL", "UNITEDFIN", "UNITEDINS", "UPGDCL", "USMANIAGL", "UTTARABANK", "UTTARAFIN", "VFSTDL", "WALTONHIL", "WATACHEM", "WMSHIPYARD", "YPL", "ZAHEENSPI", "ZAHINTEX", "ZEALBANGLA"
];

// ==========================================
// 🕒 DSE market status (Dhaka time)
// ==========================================
function getStockPulseMarketStatus() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const day = p.weekday;
    const mins = Number(p.hour) * 60 + Number(p.minute);
    const tradingDay = ['Sun','Mon','Tue','Wed','Thu'].includes(day);
    const open = tradingDay && mins >= 600 && mins < 870; // 10:00–14:30 BST
    return { open, label: open ? '🟢 Market Open' : '🔴 Market Closed', day, minutes: mins };
}
window.getStockPulseMarketStatus = getStockPulseMarketStatus;

// ==========================================
// 📈 Supabase history_dse থেকে ঐতিহাসিক ডেটা ফেচ (হেলপার)
// ==========================================
async function getHistoricalPricesFromSupabase(ticker, startDate, endDate = null) {
    if (!ticker || !startDate) return [];
    try {
        if (typeof supabase === 'undefined' || !supabase) return [];
        let query = supabase
            .from('history_dse')
            .select('date, ltp, high, low')
            .eq('ticker', ticker)
            .gte('date', startDate)
            .order('date', { ascending: true });
        if (endDate) {
            query = query.lte('date', endDate);
        }
        const { data, error } = await query;
        if (error) {
            console.warn(`Supabase history_dse fetch error for ${ticker}:`, error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn(`Exception in getHistoricalPricesFromSupabase for ${ticker}:`, err);
        return [];
    }
}

// ==========================================
// 📈 সর্বশেষ DSEX মান — canonical source: public.market_summary
// ==========================================
async function getLatestDSEXFromSupabase() {
    try {
        if (typeof supabase === 'undefined' || !supabase) return null;
        const { data, error } = await supabase
            .from('market_summary')
            .select('market_date,dsex,previous_close,change,change_percent,scraped_at')
            .not('dsex', 'is', null)
            .order('market_date', { ascending: false })
            .order('scraped_at', { ascending: false })
            .limit(20);
        if (error || !Array.isArray(data) || !data.length) return null;

        // Use the newest valid row per trading date; never treat zero/invalid values as DSEX.
        const byDate = new Map();
        for (const row of data) {
            const dateKey = String(row.market_date || row.scraped_at || '').split('T')[0];
            const value = Number(row.dsex);
            if (!dateKey || !Number.isFinite(value) || value < 1000 || value > 10000) continue;
            if (!byDate.has(dateKey)) byDate.set(dateKey, row);
        }
        const rows = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, row]) => ({ date, row }));
        if (!rows.length) return null;
        const latest = rows[0];
        const todayValue = Number(latest.row.dsex);
        const previous = rows.length > 1 ? Number(rows[1].row.dsex) : Number(latest.row.previous_close);
        const previousValue = Number.isFinite(previous) && previous >= 1000 && previous <= 10000 ? previous : null;
        const change = Number.isFinite(Number(latest.row.change)) ? Number(latest.row.change) : (previousValue ? todayValue - previousValue : 0);
        const changePercent = Number.isFinite(Number(latest.row.change_percent)) ? Number(latest.row.change_percent) : (previousValue ? change / previousValue * 100 : 0);
        const stamp = latest.row.scraped_at || latest.date;
        return {
            value: todayValue, date: new Date(stamp), rawDate: latest.date,
            change, changePercent, previousValue,
            previousDate: rows.length > 1 ? new Date(rows[1].row.scraped_at || rows[1].date) : null
        };
    } catch (e) {
        console.warn('Error fetching DSEX from market_summary:', e);
        return null;
    }
}

// ==========================================
// 📊 ইউনিফাইড ক্যালকুলেশন ইঞ্জিন
// ==========================================
class UnifiedCalculationEngine {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 300000;
    }

    // UnifiedCalculationEngine.calculate() - user/portfolio isolated cache
async calculate(userId, portfolioId = null, forceRefresh = false) {
    if (!userId) return null;
    const now = Date.now();
    const cacheKey = `calc_${userId}_${portfolioId || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (!forceRefresh && cached && (now - cached.timestamp) < this.cacheTTL) {
        console.log('📦 Using cached unified calculation');
        return cached.data;
    }
    console.log('🔄 Calculating portfolio... (portfolioId:', portfolioId || 'all', ')');

    try {
        let portfolioData = [];
        let salesData = [];

        // Supabase
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data: pData, error: pError } = await supabase
                    .from('portfolios').select('*').eq('user_id', userId);
                if (!pError && pData) {
                    const wanted = String(portfolioId || '').trim().toLowerCase();
                    portfolioData = pData.filter(item => {
                        const pid = String(item.portfolio_id ?? '').trim().toLowerCase();
                        if (!wanted || wanted === 'grand') return true;
                        return wanted === 'main' ? (pid === '' || pid === 'main') : pid === wanted;
                    });
                }

                const { data: sData, error: sError } = await supabase
                    .from('sales_history').select('*').eq('user_id', userId);
                if (!sError && sData) {
                    const wanted = String(portfolioId || '').trim().toLowerCase();
                    salesData = sData.filter(item => {
                        const pid = String(item.portfolio_id ?? '').trim().toLowerCase();
                        if (!wanted || wanted === 'grand') return true;
                        return wanted === 'main' ? (pid === '' || pid === 'main') : pid === wanted;
                    });
                }
            } catch (e) { console.warn('Supabase calc fetch failed', e); }
        }

        // Firebase ফ্যালব্যাক
        if (portfolioData.length === 0 && typeof db !== 'undefined' && db) {
            try {
                let pQuery = db.collection('portfolios').where('userId', '==', userId);
                const snap = await pQuery.get();
                snap.forEach(doc => {
                    const data = doc.data();
                    const wanted = String(portfolioId || '').trim().toLowerCase();
                    const pid = String(data.portfolioId ?? '').trim().toLowerCase();
                    if (wanted && wanted !== 'grand' && !(wanted === 'main' ? (pid === '' || pid === 'main') : pid === wanted)) return;
                    portfolioData.push({
                        id: doc.id,
                        user_id: data.userId,
                        share_name: data.shareName,
                        quantity: data.quantity,
                        buy_price: data.buyPrice,
                        commission: data.commission || 0,
                        commission_percent: data.commissionPercent || 0,
                        date: data.date?.toDate?.()?.toISOString?.().split('T')[0] || new Date().toISOString().split('T')[0],
                        created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
                    });
                });
            } catch (e) { console.warn('Firebase calc fetch failed', e); }
        }
        if (salesData.length === 0 && typeof db !== 'undefined' && db) {
            try {
                let sQuery = db.collection('sales_history').where('userId', '==', userId);
                const snap = await sQuery.get();
                snap.forEach(doc => {
                    const data = doc.data();
                    const wanted = String(portfolioId || '').trim().toLowerCase();
                    const pid = String(data.portfolioId ?? '').trim().toLowerCase();
                    if (wanted && wanted !== 'grand' && !(wanted === 'main' ? (pid === '' || pid === 'main') : pid === wanted)) return;
                    salesData.push({
                        id: doc.id,
                        user_id: data.userId,
                        share_name: String(data.shareName ?? '').trim().toUpperCase(),
                        quantity_sold: Number(data.quantitySold) || 0,
                        buy_price: data.buyPrice || 0,
                        sell_price: data.sellPrice || 0,
                        profit_or_loss: data.profitOrLoss || 0,
                        commission: data.commission || 0,
                        commission_percent: data.commissionPercent || 0,
                        net_received: data.netReceived || 0,
                        date: data.date?.toDate?.()?.toISOString?.().split('T')[0] || new Date().toISOString().split('T')[0],
                        created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
                    });
                });
            } catch (e) { console.warn('Firebase sales calc fetch failed', e); }
        }

        // Normalize all rows before calculation. This prevents case/number formatting
        // differences between Buy and Sell records from hiding valid sales.
        portfolioData = portfolioData.map(item => ({
            ...item,
            share_name: String(item.share_name ?? '').trim().toUpperCase(),
            quantity: Number(item.quantity) || 0,
            buy_price: Number(item.buy_price) || 0,
            commission: Number(item.commission) || 0,
            commission_percent: Number(item.commission_percent) || 0,
        })).filter(item => item.share_name && item.quantity > 0);

        salesData = salesData.map(item => ({
            ...item,
            share_name: String(item.share_name ?? '').trim().toUpperCase(),
            quantity_sold: Number(item.quantity_sold) || 0,
        })).filter(item => item.share_name && item.quantity_sold > 0);

        if (portfolioData.length === 0) {
            console.log('No portfolio found for user');
            return null;
        }

        // মোট বিক্রি হিসাব
        const totalSoldMap = new Map();
        salesData.forEach(item => {
            const ticker = String(item.share_name ?? '').trim().toUpperCase();
            const qty = Number(item.quantity_sold) || 0;
            if (!ticker || qty <= 0) return;
            totalSoldMap.set(ticker, (totalSoldMap.get(ticker) || 0) + qty);
        });

        // Buy লট তৈরি
        const allBuyLots = [];
        const buyLots = [];
        portfolioData.forEach(item => {
            const ticker = String(item.share_name ?? '').trim().toUpperCase();
            const qty = Number(item.quantity) || 0;
            const buyPrice = Number(item.buy_price) || 0;
            const commission = Number(item.commission) || 0;
            const commissionPercent = Number(item.commission_percent) || 0;
            const totalCostWithCommission = (qty * buyPrice) + commission;
            const perUnitCostWithCommission = qty > 0 ? totalCostWithCommission / qty : 0;
            const date = item.date ? new Date(item.date) : new Date();
            allBuyLots.push({
                ticker: ticker,
                qty: qty,
                buyPrice: buyPrice,
                totalCostWithCommission: totalCostWithCommission,
                perUnitCostWithCommission: perUnitCostWithCommission,
                date: date,
                commission: commission,
                commissionPercent: commissionPercent
            });
            buyLots.push({ ...allBuyLots[allBuyLots.length - 1] });
        });

        buyLots.sort((a, b) => a.date - b.date);
        allBuyLots.sort((a, b) => a.date - b.date);

        const totalBuyMap = new Map();
        allBuyLots.forEach(lot => {
            if (!totalBuyMap.has(lot.ticker)) {
                totalBuyMap.set(lot.ticker, { totalBuyQty: 0, totalBuyCost: 0 });
            }
            const cur = totalBuyMap.get(lot.ticker);
            cur.totalBuyQty += lot.qty;
            cur.totalBuyCost += lot.qty * lot.buyPrice;
            totalBuyMap.set(lot.ticker, cur);
        });

        // FIFO রিমেইনিং ট্র্যাক
        const remainingTracker = new Map();
        const sellRemaining = new Map(totalSoldMap);
        for (const lot of buyLots) {
            let remainingQty = lot.qty;
            let toSell = sellRemaining.get(lot.ticker) || 0;
            if (toSell > 0 && remainingQty > 0) {
                const sellFromThisLot = Math.min(remainingQty, toSell);
                remainingQty -= sellFromThisLot;
                toSell -= sellFromThisLot;
                sellRemaining.set(lot.ticker, toSell);
            }
            if (remainingQty > 0) {
                if (!remainingTracker.has(lot.ticker)) {
                    remainingTracker.set(lot.ticker, { totalQty: 0, totalCost: 0, totalBuyValue: 0, lots: [] });
                }
                const current = remainingTracker.get(lot.ticker);
                const lotCost = remainingQty * lot.perUnitCostWithCommission;
                const lotBuyValue = remainingQty * lot.buyPrice;
                current.totalQty += remainingQty;
                current.totalCost += lotCost;
                current.totalBuyValue += lotBuyValue;
                current.lots.push({
                    qty: remainingQty,
                    buyPrice: lot.buyPrice,
                    perUnitCostWithCommission: lot.perUnitCostWithCommission,
                    totalCost: lotCost,
                    date: lot.date,
                    commission: lot.commission,
                    commissionPercent: lot.commissionPercent
                });
                remainingTracker.set(lot.ticker, current);
            }
        }

        const stockDetails = [];
        let grandTotalCost = 0, grandTotalBuyValue = 0, grandTotalQty = 0;
        for (const [ticker, data] of remainingTracker) {
            grandTotalCost += data.totalCost;
            grandTotalBuyValue += data.totalBuyValue;
            grandTotalQty += data.totalQty;
            const totalBuyInfo = totalBuyMap.get(ticker) || { totalBuyQty: 0, totalBuyCost: 0 };
            stockDetails.push({
                ticker: ticker,
                totalBuyQty: totalBuyInfo.totalBuyQty,
                totalBuyCost: totalBuyInfo.totalBuyCost,
                totalQty: data.totalQty,
                totalCost: data.totalCost,
                totalBuyValue: data.totalBuyValue,
                avgBuyPriceWithCommission: data.totalCost / data.totalQty,
                avgBuyPrice: data.totalBuyValue / data.totalQty,
                lots: data.lots
            });
        }

        const result = {
            _portfolioId: portfolioId || 'all',
            totalInvestment: grandTotalCost,
            totalBuyValue: grandTotalBuyValue,
            totalRemainingQty: grandTotalQty,
            stockDetails: stockDetails,
            calculatedAt: now,
            method: 'FIFO with Commission'
        };
        this.cache.set(cacheKey, { data: result, timestamp: now });
        return result;

    } catch (error) {
        console.error('Calculation error:', error);
        return null;
    }
}

    resetCache() {
        this.cache.clear();
        console.log('🔄 Unified calculation cache reset');
    }
}

// ==========================================
// 🗄️ ডুয়াল ডেটাবেস রাইট হেলপার
// ==========================================
async function savePortfolioToBoth(userId, data) {
    let supabaseSuccess = false;
    let firebaseSuccess = false;
    let supabaseError = null;

    const payload = {
        user_id: userId,
        share_name: String(data.shareName || '').trim().toUpperCase(),
        quantity: Number(data.quantity) || 0,
        buy_price: Number(data.buyPrice) || 0,
        commission: Number(data.commission) || 0,
        commission_percent: Number(data.commissionPercent) || 0,
        portfolio_id: data.portfolioId || 'main',
        date: data.date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
    };

    // Use the same Firebase->Supabase custom JWT bridge as the rest of the app.
    if (typeof supabaseFetch === 'function') {
        try {
            await supabaseFetch('/portfolios', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify(payload)
            });
            supabaseSuccess = true;
        } catch (e) {
            supabaseError = e instanceof Error ? e.message : String(e);
            console.error('Supabase portfolio insert failed:', supabaseError);
        }
    } else if (typeof supabase !== 'undefined' && supabase) {
        try {
            const { error } = await supabase.from('portfolios').insert(payload);
            if (error) throw error;
            supabaseSuccess = true;
        } catch (e) {
            supabaseError = e instanceof Error ? e.message : String(e);
            console.error('Supabase portfolio insert failed:', supabaseError);
        }
    }

    // Firebase is backup-only. Do not write a second live copy when Supabase succeeds.
    // If the primary write fails, keep the emergency fallback so the user's action is not lost.
    if (!supabaseSuccess && typeof db !== 'undefined' && db) {
        try {
            await db.collection('portfolios').add({
                userId: userId,
                shareName: payload.share_name,
                quantity: payload.quantity,
                buyPrice: payload.buy_price,
                commission: payload.commission,
                commissionPercent: payload.commission_percent,
                portfolioId: payload.portfolio_id,
                date: data.date ? new Date(data.date) : new Date(),
                createdAt: new Date(),
                backupReason: 'supabase_write_failed'
            });
            firebaseSuccess = true;
        } catch (e) { console.warn('Firebase emergency fallback insert failed:', e); }
    }

    return { supabaseSuccess, firebaseSuccess, supabaseError };
}

async function saveSalesToBoth(userId, data) {
    let supabaseSuccess = false;
    let firebaseSuccess = false;
    let supabaseError = null;

    const payload = {
        user_id: userId,
        share_name: String(data.shareName || '').trim().toUpperCase(),
        quantity_sold: Number(data.quantitySold) || 0,
        buy_price: Number(data.buyPrice) || 0,
        sell_price: Number(data.sellPrice) || 0,
        profit_or_loss: Number(data.profitOrLoss) || 0,
        commission: Number(data.commission) || 0,
        commission_percent: Number(data.commissionPercent) || 0,
        net_received: Number(data.netReceived) || 0,
        portfolio_id: data.portfolioId || 'main',
        date: data.date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
    };

    // IMPORTANT: use the app's custom Firebase->Supabase JWT bridge.
    // This avoids relying on a stale/incorrect supabase-js session.
    if (typeof supabaseFetch === 'function') {
        try {
            await supabaseFetch('/sales_history', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify(payload)
            });
            supabaseSuccess = true;
        } catch (e) {
            supabaseError = e instanceof Error ? e.message : String(e);
            console.error('Supabase sales insert failed:', supabaseError);
        }
    } else if (typeof supabase !== 'undefined' && supabase) {
        try {
            const { error } = await supabase.from('sales_history').insert(payload);
            if (error) throw error;
            supabaseSuccess = true;
        } catch (e) {
            supabaseError = e instanceof Error ? e.message : String(e);
            console.error('Supabase sales insert failed:', supabaseError);
        }
    }

    // Firebase is backup-only. Only use it as an emergency write fallback.
    if (!supabaseSuccess && typeof db !== 'undefined' && db) {
        try {
            await db.collection('sales_history').add({
                userId: userId,
                shareName: payload.share_name,
                quantitySold: payload.quantity_sold,
                buyPrice: payload.buy_price,
                sellPrice: payload.sell_price,
                profitOrLoss: payload.profit_or_loss,
                commission: payload.commission,
                commissionPercent: payload.commission_percent,
                netReceived: payload.net_received,
                portfolioId: payload.portfolio_id,
                date: data.date ? new Date(data.date) : new Date(),
                createdAt: new Date(),
                backupReason: 'supabase_write_failed'
            });
            firebaseSuccess = true;
        } catch (e) { console.warn('Firebase emergency sales fallback failed:', e); }
    }

    return { supabaseSuccess, firebaseSuccess, supabaseError };
}


async function saveDividendToBoth(userId, data) {
    let supabaseSuccess = false;
    let firebaseSuccess = false;

    if (typeof supabase !== 'undefined' && supabase) {
        try {
            const { error } = await supabase.from('dividend_records').insert({
                user_id: userId,
                share_name: data.shareName,
                stock_percent: data.stockPercent || 0,
                cash_amount: data.cashAmount || 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            if (!error) supabaseSuccess = true;
        } catch (e) { console.warn('Supabase dividend insert failed:', e); }
    }

    // Firebase is backup-only; use it only if the Supabase write failed.
    if (!supabaseSuccess && typeof db !== 'undefined' && db) {
        try {
            await db.collection('dividend_records').add({
                userId: userId,
                shareName: data.shareName,
                stockPercent: data.stockPercent || 0,
                cashAmount: data.cashAmount || 0,
                portfolioId: data.portfolioId || 'main',
                createdAt: new Date(),
                updatedAt: new Date(),
                backupReason: 'supabase_write_failed'
            });
            firebaseSuccess = true;
        } catch (e) { console.warn('Firebase emergency dividend fallback failed:', e); }
    }

    return { supabaseSuccess, firebaseSuccess };
}

// ==========================================
// 🛡️ নিরাপদ ডেট পার্সিং
// ==========================================
function safeParseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        if (!isNaN(d)) return d;
    }
    if (typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
        try {
            const d = value.toDate();
            if (d instanceof Date && !isNaN(d)) return d;
        } catch (e) {}
    }
    if (value.seconds !== undefined) {
        const d = new Date(value.seconds * 1000);
        if (!isNaN(d)) return d;
    }
    return null;
}

// DSE প্রাইস ফেচ (Supabase dse_live_data → Firebase daily_prices)
async function getDSEPrice(ticker) {
    if (!ticker) return 0;
    if (typeof supabase !== 'undefined' && supabase) {
        try {
            const { data, error } = await supabase
                .from('dse_live_data')
                .select('ltp')
                .eq('ticker', ticker)
                .order('date', { ascending: false })
                .limit(1);
            if (!error && data && data.length > 0) {
                const val = parseFloat(data[0].ltp);
                if (!isNaN(val) && val > 0) return val;
            }
        } catch (e) {}
        try {
            const { data, error } = await supabase
                .from('cse_market_data')
                .select('ltp')
                .eq('code', ticker)
                .order('date', { ascending: false })
                .limit(1);
            if (!error && data && data.length > 0) {
                const val = parseFloat(data[0].ltp);
                if (!isNaN(val) && val > 0) return val;
            }
        } catch (e) {}
    }
    return 0;
}

// CSE প্রাইস ফেচ (Supabase cse_market_data → Firebase cse_detailed_data)
async function getCSEPrice(ticker) {
    if (!ticker) return 0;
    if (typeof supabase !== 'undefined' && supabase) {
        try {
            const { data, error } = await supabase
                .from('cse_market_data')
                .select('ltp')
                .eq('code', ticker)
                .order('date', { ascending: false })
                .limit(1);
            if (!error && data && data.length > 0) {
                const val = parseFloat(data[0].ltp);
                if (!isNaN(val) && val > 0) return val;
            }
        } catch (e) {}
    }
    return 0;
}

async function getPERatio(ticker) {
    // P/E শুধুমাত্র Supabase daily_closing_prices থেকে আসে (fundamentals.js দিয়ে)।
    if (typeof window.getFundamentalsLatest === 'function') {
        const f = await window.getFundamentalsLatest(ticker);
        return f ? f.pe : null;
    }
    return null;
}

// ==========================================
// 🧹 গ্লোবাল ক্যাশ ক্লিনার
// ==========================================
function resetUnifiedCache() {
    // Clear the unified calculation result.
    try {
        if (typeof unifiedEngine !== 'undefined' && unifiedEngine && unifiedEngine.cache) {
            unifiedEngine.cache.clear();
        }
    } catch (e) {
        console.warn('Unified cache reset failed:', e);
    }

    // Also clear the DataService cache when available so reads after
    // a successful write never return stale portfolio data.
    try {
        if (typeof window.clearDataServiceCache === 'function') {
            window.clearDataServiceCache();
        }
    } catch (e) {
        console.warn('DataService cache clear failed:', e);
    }

    try {
        window.dispatchEvent(new CustomEvent('stockpulse:data-changed', {
            detail: { reason: 'unified cache reset', timestamp: Date.now() }
        }));
    } catch (e) {}
}

function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function clearAllScannerCache() {
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('all_scanner_data');
        sessionStorage.removeItem('all_scanner_data_v7');
        sessionStorage.removeItem('all_scanner_data_v8');
    }
    console.log('🔄 All scanner cache cleared');
}

// ==========================================
// 📂 পোর্টফোলিও মেটাডেটা ম্যানেজমেন্ট
// ==========================================

/**
 * ইউজারের সব পোর্টফোলিওর তালিকা পাওয়া
 */
async function getPortfolioMeta(userId) {
    if (!userId) return { portfolios: [] };
    try {
        if (typeof db !== 'undefined') {
            const doc = await db.collection('portfolios_meta').doc(userId).get();
            if (doc.exists) {
                return doc.data();
            }
        }
        // ডিফল্ট: একটি মেইন পোর্টফোলিও তৈরি
        const defaultMeta = {
            portfolios: [
                { id: 'main', name: '📊 Main Portfolio', type: 'main', isDefault: true, createdAt: new Date().toISOString() }
            ]
        };
        if (typeof db !== 'undefined') {
            await db.collection('portfolios_meta').doc(userId).set(defaultMeta);
        }
        return defaultMeta;
    } catch (e) {
        console.error('Error getting portfolio meta:', e);
        return { portfolios: [{ id: 'main', name: '📊 Main Portfolio', type: 'main', isDefault: true }] };
    }
}

/**
 * পোর্টফোলিও মেটাডেটা আপডেট করা
 */
async function updatePortfolioMeta(userId, meta) {
    if (!userId || !meta) return false;
    try {
        if (typeof db !== 'undefined') {
            await db.collection('portfolios_meta').doc(userId).set(meta, { merge: true });
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error updating portfolio meta:', e);
        return false;
    }
}

/**
 * নতুন পোর্টফোলিও তৈরি করা
 */
async function createPortfolio(userId, name) {
    if (!userId || !name || !name.trim()) return null;
    const meta = await getPortfolioMeta(userId);

    // 🆓 Free plan: Main + one custom portfolio. Pro is unlimited.
    try {
        const pro = !!(window.StockPulsePlan && typeof window.StockPulsePlan.isPro === 'function' && window.StockPulsePlan.isPro());
        if (!pro && Array.isArray(meta?.portfolios) && meta.portfolios.length >= 2) {
            if (typeof showToast === 'function') showToast('Free plan allows up to 2 portfolios (including Main). Upgrade to Pro for unlimited portfolios.', 'warning');
            return null;
        }
    } catch (_) {
        // Fail closed for the limit check if subscription state is unavailable.
        if (Array.isArray(meta?.portfolios) && meta.portfolios.length >= 2) return null;
    }

    const id = 'sub_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    meta.portfolios.push({
        id,
        name: name.trim(),
        type: 'sub',
        isDefault: false,
        createdAt: new Date().toISOString()
    });
    const success = await updatePortfolioMeta(userId, meta);
    return success ? id : null;
}

/**
 * পোর্টফোলিও ডিলিট করা (শুধু যদি শেয়ার সংখ্যা ০ হয়)
 */
async function deletePortfolio(userId, portfolioId) {
    if (!userId || !portfolioId || portfolioId === 'main') return false;
    // চেক করুন এই পোর্টফোলিওতে কোনো শেয়ার আছে কিনা
    if (typeof db !== 'undefined') {
        const snap = await db.collection('portfolios')
            .where('userId', '==', userId)
            .where('portfolioId', '==', portfolioId)
            .get();
        if (!snap.empty) {
            let totalQty = 0;
            snap.forEach(doc => totalQty += doc.data().quantity || 0);
            if (totalQty > 0) {
                console.warn('Portfolio has shares, cannot delete');
                return false;
            }
        }
        // সেলস হিস্ট্রি চেক (ঐচ্ছিক)
        const sellSnap = await db.collection('sales_history')
            .where('userId', '==', userId)
            .where('portfolioId', '==', portfolioId)
            .get();
        if (!sellSnap.empty) {
            // আপনি চাইলে সেল হিস্ট্রিও ডিলিট করতে পারেন, অথবা শুধু পোর্টফোলিও মেটা থেকে রিমুভ করুন
            // এখানে আমরা শুধু মেটা থেকে রিমুভ করছি
        }
    }
    const meta = await getPortfolioMeta(userId);
    meta.portfolios = meta.portfolios.filter(p => p.id !== portfolioId);
    return await updatePortfolioMeta(userId, meta);
}

/**
 * পোর্টফোলিওর নাম পরিবর্তন
 */
async function renamePortfolio(userId, portfolioId, newName) {
    if (!userId || !portfolioId || !newName || !newName.trim()) return false;
    if (portfolioId === 'main') return false;
    const meta = await getPortfolioMeta(userId);
    const portfolio = meta.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return false;
    portfolio.name = newName.trim();
    return await updatePortfolioMeta(userId, meta);
}

/**
 * পোর্টফোলিও আইডি থেকে নাম পাওয়া
 */
function getPortfolioName(portfolioId, meta) {
    if (!meta || !meta.portfolios) return portfolioId === 'main' ? '📊 Grand Portfolio' : portfolioId;
    const found = meta.portfolios.find(p => p.id === portfolioId);
    return found ? found.name : (portfolioId === 'main' ? '📊 Grand Portfolio' : portfolioId);
}
// ==========================================
// 📡 NEW API SERVICE (bd-stock-api)
// ==========================================

const STOCK_API_BASE = null; // Deprecated: market data is now Supabase-only.

async function fetchAllLatestStocks() {
    if (typeof supabase === 'undefined' || !supabase) return [];
    try {
        const { data, error } = await supabase.from('dse_live_data')
            .select('*').order('date', { ascending: false }).limit(5000);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Supabase dse_live_data fetch failed:', error);
        return [];
    }
}

async function fetchStockByTicker(ticker) {
    if (!ticker || typeof supabase === 'undefined' || !supabase) return [];
    try {
        const { data, error } = await supabase.from('dse_live_data')
            .select('*').eq('ticker', ticker).order('date', { ascending: false }).limit(1);
        if (error) throw error;
        if (data?.length) return data;
        const fallback = await supabase.from('cse_market_data').select('*')
            .eq('code', ticker).order('date', { ascending: false }).limit(1);
        if (fallback.error) throw fallback.error;
        return fallback.data || [];
    } catch (error) {
        console.error(`Supabase stock fetch failed for ${ticker}:`, error);
        return [];
    }
}
// ==========================================
// 🔐 Firebase → Supabase JWT authentication bridge
// ==========================================
let cachedSupabaseToken = null;
let supabaseTokenExpiresAt = 0;
let supabaseAuthSyncPromise = null;

function decodeJwtPayload(token) {
    try {
        const part = token.split('.')[1];
        if (!part) return null;
        const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        return JSON.parse(atob(padded));
    } catch (_) {
        return null;
    }
}

async function syncSupabaseAuth(force = false) {
    if (supabaseAuthSyncPromise && !force) return supabaseAuthSyncPromise;

    supabaseAuthSyncPromise = (async () => {
        const user = auth && auth.currentUser;
        if (!user) {
            cachedSupabaseToken = null;
            supabaseTokenExpiresAt = 0;
            if (typeof window.clearSupabaseAuth === 'function') window.clearSupabaseAuth();
            return null;
        }

        const now = Math.floor(Date.now() / 1000);
        if (!force && cachedSupabaseToken && supabaseTokenExpiresAt > now + 60) {
            return cachedSupabaseToken;
        }

        const idToken = await user.getIdToken(force);
        const hookUrl = window.APP_CONFIG?.API?.SUPABASE_AUTH_HOOK_URL;
        if (!hookUrl) throw new Error('Supabase auth-hook URL is not configured');

        const res = await fetch(hookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebase_token: idToken })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) {
            throw new Error(data.error || 'Supabase token exchange failed');
        }

        cachedSupabaseToken = data.token;
        const payload = decodeJwtPayload(data.token);
        supabaseTokenExpiresAt = Number(payload?.exp || 0);

        if (typeof window.setSupabaseAuthToken === 'function') {
            window.setSupabaseAuthToken(data.token);
        } else {
            throw new Error('Supabase auth client bridge is not initialized');
        }

        // Notify subscription/admin-aware UI only after the custom Supabase JWT is ready.
        try { window.dispatchEvent(new CustomEvent('stockpulse:auth-ready')); } catch (_) {}

        console.log('✅ Supabase authorization synchronized');
        return cachedSupabaseToken;
    })();

    try {
        return await supabaseAuthSyncPromise;
    } finally {
        supabaseAuthSyncPromise = null;
    }
}

async function getSupabaseToken(force = false) {
    return syncSupabaseAuth(force);
}

async function supabaseFetch(path, options = {}) {
    const token = await getSupabaseToken(false);
    if (!token) throw new Error('Supabase authentication required');

    const anonKey = window.APP_CONFIG?.API?.SUPABASE_ANON_KEY;
    const baseUrl = window.APP_CONFIG?.API?.SUPABASE_URL;
    const url = `${baseUrl}/rest/v1${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    // Supabase REST INSERT/UPDATE requests may legitimately return 201/204
    // with an empty body (especially with Prefer: return=minimal). Never call
    // response.json() blindly on an empty response.
    const rawText = await response.text();

    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        if (rawText) {
            try {
                const error = JSON.parse(rawText);
                message = error?.message || error?.error_description || error?.hint || message;
            } catch {
                message = rawText.slice(0, 500) || message;
            }
        }
        throw new Error(message);
    }

    if (!rawText.trim()) return null;

    try {
        return JSON.parse(rawText);
    } catch {
        // A successful non-JSON response is still a successful request.
        return rawText;
    }
}

/**
 * ঐতিহাসিক ডেটা ফেচ করুন
 */
async function fetchHistoricalData(ticker, startDate, endDate) {
    if (!ticker || typeof supabase === 'undefined' || !supabase) return [];
    try {
        const { data, error } = await supabase.from('history_dse')
            .select('ticker,date,ltp,high,low,open,ycp,volume,trade,value_mn')
            .eq('ticker', ticker).gte('date', startDate).lte('date', endDate)
            .order('date', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error(`Supabase history_dse fetch failed for ${ticker}:`, error);
        return [];
    }
}

// গ্লোবালি এক্সপোজ
window.fetchAllLatestStocks = fetchAllLatestStocks;
window.fetchStockByTicker = fetchStockByTicker;
window.fetchHistoricalData = fetchHistoricalData;
// ==========================================
// 🌐 গ্লোবাল এক্সপোজ
// ==========================================
const unifiedEngine = new UnifiedCalculationEngine();

// ফাংশন ও ভেরিয়েবল এক্সপোজ
window.unifiedEngine = unifiedEngine;
window.getUnifiedPrice = getUnifiedPrice;
window.getLatestAndPreviousPrices = getLatestAndPreviousPrices;
window.getPreviousDayPrice = getPreviousDayPrice;
window.getHardcodedPrice = getHardcodedPrice;
window.resetUnifiedPriceCache = resetUnifiedPriceCache;
window.resetUnifiedCache = resetUnifiedCache;
window.clearAllScannerCache = clearAllScannerCache;
window.debounce = debounce;
window.dseStocks = dseStocks;
window.firebaseDataManager = firebaseDataManager;
window.commissionManager = commissionManager;
window.apiLimiter = apiLimiter;
window.safeParseDate = safeParseDate;
window.savePortfolioToBoth = savePortfolioToBoth;
window.saveSalesToBoth = saveSalesToBoth;
window.saveDividendToBoth = saveDividendToBoth;
window.toBangladeshTime = toBangladeshTime;
window.formatBangladeshTime = formatBangladeshTime;
window.getBangladeshDateString = getBangladeshDateString;
window.getUTCFromLocalDate = getUTCFromLocalDate;
window.formatDisplayTime = formatDisplayTime;
window.getTodayDate = getTodayDate;
window.getSafePrice = getSafePrice;
window.calculatePercentage = calculatePercentage;
window.safeDivision = safeDivision;
window.getDSEPrice = getDSEPrice;
window.getCSEPrice = getCSEPrice;
window.getPERatio = getPERatio;
window.chunkArray = chunkArray;
window.getPortfolioMeta = getPortfolioMeta;
window.updatePortfolioMeta = updatePortfolioMeta;
window.createPortfolio = createPortfolio;
window.deletePortfolio = deletePortfolio;
window.renamePortfolio = renamePortfolio;
window.getPortfolioName = getPortfolioName;
window.getHistoricalPricesFromSupabase = getHistoricalPricesFromSupabase;
window.getLatestDSEXFromSupabase = getLatestDSEXFromSupabase;
window.getSupabaseToken = getSupabaseToken;
window.syncSupabaseAuth = syncSupabaseAuth;
window.supabaseFetch = supabaseFetch;
console.log('✅ core.js loaded successfully (All functions defined and exposed globally)');
