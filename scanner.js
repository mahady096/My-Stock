// ==========================================
// 🔍 scanner.js - সম্পূর্ণ ইরর-ফ্রি ভার্সন
//    All Scanner (PSAR + RSI) - Supabase for live, Firebase for historical
//    RSI Indicator Section সহ
// ==========================================

// ==========================================
// 📦 ক্যাশ ম্যানেজমেন্ট
// ==========================================
const ALL_SCANNER_CACHE_KEY = 'all_scanner_data';
const ALL_SCANNER_CACHE_TTL = 3600000; // ১ ঘন্টা

function getAllScannerCache() {
    try {
        const cached = sessionStorage.getItem(ALL_SCANNER_CACHE_KEY);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < ALL_SCANNER_CACHE_TTL) {
            return parsed.data;
        }
        return null;
    } catch (e) { return null; }
}

function setAllScannerCache(data) {
    try {
        sessionStorage.setItem(ALL_SCANNER_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) { console.warn('Cache save failed:', e); }
}

function clearAllScannerCache() {
    try {
        sessionStorage.removeItem(ALL_SCANNER_CACHE_KEY);
    } catch (e) { /* ignore */ }
}

// ==========================================
// 📊 RSI ক্যালকুলেটর (14-day)
// ==========================================
function calcRSI(priceData, period = 14) {
    if (!priceData || !Array.isArray(priceData) || priceData.length < period + 1) return [];

    const sorted = [...priceData].sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
    });

    let rsiData = [];
    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        const prevPrice = sorted[i-1]?.ltp || sorted[i-1]?.close || 0;
        const currPrice = sorted[i]?.ltp || sorted[i]?.close || 0;
        const change = currPrice - prevPrice;
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    let firstRSI = 100 - (100 / (1 + (avgGain / (avgLoss || 1))));

    for (let i = 0; i < period; i++) {
        const date = sorted[i]?.date || null;
        rsiData.push({ date: date, rsi: null });
    }
    rsiData.push({ date: sorted[period]?.date || null, rsi: firstRSI });

    for (let i = period + 1; i < sorted.length; i++) {
        const prevPrice = sorted[i-1]?.ltp || sorted[i-1]?.close || 0;
        const currPrice = sorted[i]?.ltp || sorted[i]?.close || 0;
        const change = currPrice - prevPrice;
        const gain = change >= 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        const rs = avgGain / (avgLoss || 1);
        const rsi = 100 - (100 / (1 + rs));
        rsiData.push({ date: sorted[i]?.date || null, rsi: rsi });
    }

    return rsiData;
}

// ==========================================
// 📈 Parabolic SAR ক্যালকুলেটর
// ==========================================
function calcPSAR(priceData, step = 0.02, maxStep = 0.20) {
    if (!priceData || !Array.isArray(priceData) || priceData.length < 2) return [];

    const sorted = [...priceData].sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
    });

    let sar = [];
    let trend = 'up';
    let af = step;
    let ep = sorted[0]?.high || sorted[0]?.ltp || sorted[0]?.close || 0;
    let currentSAR = sorted[0]?.low || sorted[0]?.ltp || sorted[0]?.close || 0;
    sar.push({ date: sorted[0]?.date || null, sar: currentSAR, trend: trend, af: af, ep: ep });

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const price = current?.ltp || current?.close || 0;
        const high = current?.high || price;
        const low = current?.low || price;

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

        sar.push({ date: current?.date || null, sar: newSAR, trend: trend, af: af, ep: ep });
        currentSAR = newSAR;
    }

    return sar;
}

// ==========================================
// 🔍 All Scanner ডেটা লোডার
// ==========================================
async function loadAllScannerData(forceRefresh = false, onProgress = null) {
    if (!forceRefresh) {
        const cached = getAllScannerCache();
        if (cached) {
            console.log('✅ All Scanner data loaded from cache');
            if (typeof onProgress === 'function') onProgress(cached.length, cached.length);
            return cached;
        }
    }

    const user = auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return null;
    }

    try {
        let tickers = [];
        if (typeof dseStocks !== 'undefined' && Array.isArray(dseStocks)) {
            tickers = dseStocks;
        } else if (window.dseStocks && Array.isArray(window.dseStocks)) {
            tickers = window.dseStocks;
        } else {
            if (typeof showToast === 'function') showToast('No stock list available. Please reload.', 'error');
            return [];
        }

        if (tickers.length === 0) {
            if (typeof showToast === 'function') showToast('No stock list available. Please reload.', 'error');
            return [];
        }

        console.log(`📊 Scanning ${tickers.length} stocks...`);
        const totalTickers = tickers.length;
        if (typeof onProgress === 'function') onProgress(0, totalTickers);

        const allResults = [];

        // ১. Supabase থেকে লাইভ ডেটা
        let supabasePriceMap = new Map();
        if (currentDataMode !== 'firebase' && typeof supabase !== 'undefined' && supabase) {
            try {
                const { data, error } = await supabase
                    .from('cse_market_data')
                    .select('code, ltp, high, low, category')
                    .in('code', tickers)
                    .order('date', { ascending: false });
                if (!error && data) {
                    const seen = new Set();
                    data.forEach(row => {
                        if (!seen.has(row.code)) {
                            seen.add(row.code);
                            supabasePriceMap.set(row.code, {
                                ltp: parseFloat(row.ltp) || 0,
                                high: parseFloat(row.high) || 0,
                                low: parseFloat(row.low) || 0,
                                category: row.category || 'N/A'
                            });
                        }
                    });
                }
            } catch (e) {
                console.warn('Supabase fetch failed for scanner:', e);
            }
        }

        // ২. Firebase থেকে হিস্টোরিক্যাল ডেটা
        const batchSize = 10;
        let processed = 0;

        for (let i = 0; i < tickers.length; i += batchSize) {
            const batch = tickers.slice(i, i + batchSize);
            const promises = batch.map(async (ticker) => {
                try {
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 30);
                    const startDateStr = startDate.toISOString().split('T')[0];

                    let priceData = [];

                    if (typeof db !== 'undefined') {
                        try {
                            const snap = await db.collection('cse_detailed_data')
                                .where('code', '==', ticker)
                                .where('date', '>=', startDateStr)
                                .orderBy('date', 'asc')
                                .limit(30)
                                .get();

                            if (!snap.empty) {
                                snap.forEach(doc => {
                                    const data = doc.data();
                                    const ltp = parseFloat(data.ltp);
                                    const high = parseFloat(data.high) || ltp;
                                    const low = parseFloat(data.low) || ltp;
                                    if (ltp > 0) {
                                        priceData.push({
                                            date: data.date,
                                            ltp: ltp,
                                            high: high,
                                            low: low
                                        });
                                    }
                                });
                            }
                        } catch (e) {
                            console.warn(`Firebase fetch failed for ${ticker}:`, e);
                        }
                    }

                    if (priceData.length < 15) return null;

                    const sarData = calcPSAR(priceData);
                    const lastSAR = sarData.length > 0 ? sarData[sarData.length - 1] : null;

                    const rsiData = calcRSI(priceData, 14);
                    const lastRSI = rsiData.filter(r => r.rsi !== null).pop();

                    let currentPrice = priceData[priceData.length - 1]?.ltp || 0;
                    let category = 'N/A';
                    if (supabasePriceMap.has(ticker)) {
                        const live = supabasePriceMap.get(ticker);
                        if (live.ltp > 0) currentPrice = live.ltp;
                        category = live.category || 'N/A';
                    }

                    // ATH/ATL
                    let ath = 0, atl = Infinity;
                    if (typeof db !== 'undefined') {
                        try {
                            const histSnap = await db.collection('cse_detailed_data')
                                .where('code', '==', ticker)
                                .get();
                            histSnap.forEach(doc => {
                                const data = doc.data();
                                const ltp = parseFloat(data.ltp);
                                if (ltp > ath) ath = ltp;
                                if (ltp > 0 && ltp < atl) atl = ltp;
                                const h = parseFloat(data.high) || ltp;
                                if (h > ath) ath = h;
                                const l = parseFloat(data.low) || ltp;
                                if (l > 0 && l < atl) atl = l;
                            });
                        } catch (e) { /* ignore */ }
                    }
                    if (atl === Infinity) atl = 0;

                    return {
                        ticker: ticker,
                        currentPrice: currentPrice,
                        sar: lastSAR ? lastSAR.sar : currentPrice,
                        trend: lastSAR ? lastSAR.trend : 'up',
                        rsi: lastRSI ? lastRSI.rsi : null,
                        date: priceData[priceData.length - 1]?.date || null,
                        category: category,
                        ath: ath,
                        atl: atl
                    };
                } catch (err) {
                    console.warn(`Error processing ${ticker}:`, err);
                    return null;
                }
            });

            const batchResults = await Promise.all(promises);
            const validResults = batchResults.filter(r => r !== null && r.currentPrice > 0 && r.sar > 0);
            allResults.push(...validResults);

            processed = Math.min(i + batchSize, totalTickers);
            if (typeof onProgress === 'function') onProgress(processed, totalTickers);
        }

        setAllScannerCache(allResults);
        console.log(`✅ All Scanner loaded: ${allResults.length} stocks`);

        if (typeof onProgress === 'function') onProgress(allResults.length, allResults.length);
        return allResults;

    } catch (error) {
        console.error('All Scanner load error:', error);
        if (typeof showToast === 'function') showToast('Error loading scanner data', 'error');
        return null;
    }
}

// ==========================================
// 🎯 Strong Buy/Sell ফিল্টার
// ==========================================
function filterStrongBuySignals(data) {
    if (!data || !Array.isArray(data)) return [];
    return data.filter(item =>
        item.rsi !== null &&
        item.rsi < 30 &&
        item.sar < item.currentPrice
    ).sort((a, b) => (a.rsi || 0) - (b.rsi || 0));
}

function filterStrongSellSignals(data) {
    if (!data || !Array.isArray(data)) return [];
    return data.filter(item =>
        item.rsi !== null &&
        item.rsi > 70 &&
        item.sar > item.currentPrice
    ).sort((a, b) => (b.rsi || 0) - (a.rsi || 0));
}

// ==========================================
// 🖥️ UI রেন্ডারিং (All Scanner)
// ==========================================
function renderAllScannerTable(data, type, containerId) {
    const tbody = document.getElementById(containerId);
    if (!tbody) return;

    if (!data || !Array.isArray(data) || data.length === 0) {
        const msg = type === 'buy' ? 'No Strong Buy signals found.' :
                    type === 'sell' ? 'No Strong Sell signals found.' :
                    'No data found.';
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">${msg}</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(item => {
        const isBuy = type === 'buy';
        const signalText = isBuy ? '🟢🔥 STRONG BUY' : '🔴🔥 STRONG SELL';
        const signalColor = isBuy ? '#059669' : '#dc2626';
        const rsiColor = isBuy ? '#10b981' : '#ef4444';

        html += `<tr onclick="openStockDetailModal('${item.ticker}')" style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">`;
        html += `<td style="padding: 10px; font-weight: bold; color: var(--primary-color); text-decoration: underline;">${item.ticker}</td>`;
        html += `<td style="padding: 10px; text-align: right;">৳${(item.currentPrice || 0).toFixed(2)}</td>`;
        html += `<td style="padding: 10px; text-align: right;">৳${(item.sar || 0).toFixed(2)}</td>`;
        html += `<td style="padding: 10px; text-align: right; color: ${rsiColor}; font-weight: 600;">${item.rsi !== null ? item.rsi.toFixed(2) : '-'}</td>`;
        html += `<td style="padding: 10px; text-align: center; color: ${signalColor}; font-weight: bold;">${signalText}</td>`;
        html += `</tr>`;
    });
    tbody.innerHTML = html;
}

function renderAllScannerAnalysisTable(data, ticker) {
    const tbody = document.getElementById('all-scanner-analysis-body');
    if (!tbody) return;

    if (!data || !Array.isArray(data) || data.length === 0 || !ticker) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">Search a share to see details.</td></tr>`;
        return;
    }

    const item = data.find(d => d.ticker === ticker);
    if (!item) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">No data found for ${ticker}</td></tr>`;
        return;
    }

    const isBuySignal = item.rsi < 30 && item.sar < item.currentPrice;
    const isSellSignal = item.rsi > 70 && item.sar > item.currentPrice;
    let signalText = '⚪ NEUTRAL';
    let signalColor = '#64748b';
    if (isBuySignal) { signalText = '🟢🔥 STRONG BUY'; signalColor = '#059669'; }
    else if (isSellSignal) { signalText = '🔴🔥 STRONG SELL'; signalColor = '#dc2626'; }

    const rsiColor = item.rsi !== null ? (item.rsi < 30 ? '#10b981' : (item.rsi > 70 ? '#ef4444' : '#f59e0b')) : '#64748b';

    tbody.innerHTML = `
        <tr>
            <td style="padding: 10px; font-weight: bold; color: var(--primary-color);">${item.ticker}</td>
            <td style="padding: 10px; text-align: right;">৳${(item.currentPrice || 0).toFixed(2)}</td>
            <td style="padding: 10px; text-align: right;">৳${(item.sar || 0).toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; color: ${rsiColor}; font-weight: 600;">${item.rsi !== null ? item.rsi.toFixed(2) : '-'}</td>
            <td style="padding: 10px; text-align: center; color: ${signalColor}; font-weight: bold;">${signalText}</td>
        </tr>
    `;
}

// ==========================================
// 🚀 All Scanner পেজ লোড (প্রগ্রেস বার সহ)
// ==========================================
async function loadAllScannerPage() {
    const buyBody = document.getElementById('all-scanner-buy-body');
    const sellBody = document.getElementById('all-scanner-sell-body');
    const analysisBody = document.getElementById('all-scanner-analysis-body');
    const updateTime = document.getElementById('all-scanner-update-time');

    const progressContainer = document.getElementById('all-scanner-progress-container');
    const progressBar = document.getElementById('all-scanner-progress-bar');
    const progressText = document.getElementById('all-scanner-progress-text');
    const progressDetail = document.getElementById('all-scanner-progress-detail');
    const statusText = document.getElementById('all-scanner-status-text');

    if (buyBody) buyBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">⏳ Scanning market...</td></tr>';
    if (sellBody) sellBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">⏳ Scanning market...</td></tr>';
    if (analysisBody) analysisBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">🔍 Search a share above</td></tr>';

    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = '⏳ Initializing...';
    if (progressDetail) progressDetail.textContent = '0 / 0 stocks';
    if (statusText) statusText.textContent = 'Loading stock list...';

    try {
        const onProgress = (processed, total) => {
            const pct = Math.min(Math.round((processed / total) * 100), 100);
            if (progressBar) progressBar.style.width = pct + '%';
            if (progressText) progressText.textContent = `⏳ Scanning ${pct}%`;
            if (progressDetail) progressDetail.textContent = `${Math.min(processed, total)} / ${total} stocks`;

            if (statusText) {
                if (pct < 30) statusText.textContent = '📡 Fetching price data from databases...';
                else if (pct < 60) statusText.textContent = '📊 Calculating Parabolic SAR...';
                else if (pct < 90) statusText.textContent = '📈 Calculating RSI & filtering signals...';
                else statusText.textContent = '✅ Almost done!';
            }
        };

        const allData = await loadAllScannerData(false, onProgress);

        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '✅ Done!';
        if (statusText) statusText.textContent = 'Data loaded successfully!';

        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 1500);

        if (!allData || allData.length === 0) {
            if (buyBody) buyBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">No data available</td></tr>';
            if (sellBody) sellBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">No data available</td></tr>';
            return;
        }

        const strongBuy = filterStrongBuySignals(allData);
        const strongSell = filterStrongSellSignals(allData);

        renderAllScannerTable(strongBuy, 'buy', 'all-scanner-buy-body');
        renderAllScannerTable(strongSell, 'sell', 'all-scanner-sell-body');

        window._allScannerData = allData;
        initAllScannerSearch(allData);

        if (updateTime) updateTime.innerText = new Date().toLocaleString();

        switchAllScannerTab('buy');

    } catch (error) {
        console.error('All Scanner error:', error);
        if (buyBody) buyBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:red;">❌ Error loading data</td></tr>';
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

// ==========================================
// 🔍 Analysis সার্চ ইভেন্ট (All Scanner-এর জন্য)
// ==========================================
function initAllScannerSearch(allData) {
    const searchInput = document.getElementById('all-scanner-analysis-search');
    const searchBtn = document.getElementById('all-scanner-analysis-search-btn');
    const suggestionBox = document.getElementById('all-scanner-analysis-suggestions');

    if (!searchInput) return;

    const searchHandler = function() {
        const query = searchInput.value.trim().toUpperCase();
        if (query) {
            renderAllScannerAnalysisTable(allData, query);
        } else {
            const tbody = document.getElementById('all-scanner-analysis-body');
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">Type a share name and click Search</td></tr>';
        }
    };

    searchInput.onkeypress = function(e) {
        if (e.key === 'Enter') searchHandler();
    };
    if (searchBtn) searchBtn.onclick = searchHandler;

    if (!suggestionBox) return;

    let stockList = [];
    if (typeof dseStocks !== 'undefined' && Array.isArray(dseStocks)) {
        stockList = dseStocks;
    } else if (window.dseStocks && Array.isArray(window.dseStocks)) {
        stockList = window.dseStocks;
    }

    searchInput.oninput = function() {
        const query = this.value.trim().toUpperCase();
        suggestionBox.innerHTML = '';
        if (!query) {
            suggestionBox.classList.add('hidden');
            return;
        }
        const filtered = stockList.filter(stock => stock.startsWith(query)).slice(0, 10);
        if (filtered.length > 0) {
            suggestionBox.classList.remove('hidden');
            filtered.forEach(stock => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.innerText = stock;
                div.onclick = function() {
                    searchInput.value = stock;
                    suggestionBox.classList.add('hidden');
                    renderAllScannerAnalysisTable(allData, stock);
                };
                suggestionBox.appendChild(div);
            });
        } else {
            suggestionBox.classList.add('hidden');
        }
    };

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestionBox.contains(e.target)) {
            suggestionBox.classList.add('hidden');
        }
    });
}

// ==========================================
// 🎯 ট্যাব সুইচিং (All Scanner সেকশনের ভেতরে)
// ==========================================
function switchAllScannerTab(tab) {
    const containers = {
        buy: document.getElementById('all-scanner-buy-container'),
        sell: document.getElementById('all-scanner-sell-container'),
        analysis: document.getElementById('all-scanner-analysis-container')
    };
    const tabs = {
        buy: document.getElementById('all-scanner-tab-buy'),
        sell: document.getElementById('all-scanner-tab-sell'),
        analysis: document.getElementById('all-scanner-tab-analysis')
    };

    Object.values(containers).forEach(c => { if (c) c.style.display = 'none'; });
    Object.values(tabs).forEach(t => {
        if (t) {
            t.style.background = 'transparent';
            t.style.color = 'var(--text-primary)';
            t.style.border = '1px solid var(--border-color)';
        }
    });

    if (tab === 'buy' && containers.buy) {
        containers.buy.style.display = 'block';
        if (tabs.buy) {
            tabs.buy.style.background = 'var(--primary-color)';
            tabs.buy.style.color = 'white';
            tabs.buy.style.border = 'none';
        }
    } else if (tab === 'sell' && containers.sell) {
        containers.sell.style.display = 'block';
        if (tabs.sell) {
            tabs.sell.style.background = 'var(--primary-color)';
            tabs.sell.style.color = 'white';
            tabs.sell.style.border = 'none';
        }
    } else if (tab === 'analysis' && containers.analysis) {
        containers.analysis.style.display = 'block';
        if (tabs.analysis) {
            tabs.analysis.style.background = 'var(--primary-color)';
            tabs.analysis.style.color = 'white';
            tabs.analysis.style.border = 'none';
        }
    }
}

// ==========================================
// 🔄 All Scanner রিফ্রেশ
// ==========================================
async function refreshAllScannerPage() {
    clearAllScannerCache();
    await loadAllScannerPage();
    if (typeof showToast === 'function') showToast('✅ All Scanner refreshed!', 'success');
}

async function refreshAllScannerData() {
    await refreshAllScannerPage();
}

// ==========================================
// 📊 RSI Indicator Section Functions
// ==========================================

let currentRSITab = 'buy';
let cachedRSIData = null;

// RSI Indicator পেজ লোড
async function loadRSIIndicatorPage() {
    const buyBody = document.getElementById('rsi-buy-body');
    const sellBody = document.getElementById('rsi-sell-body');
    const updateTime = document.getElementById('rsi-update-time');

    if (buyBody) buyBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">⏳ Loading RSI data...</td></tr>';
    if (sellBody) sellBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">⏳ Loading RSI data...</td></tr>';

    try {
        let allData = getAllScannerCache();
        if (!allData) {
            if (typeof showToast === 'function') showToast('📊 Loading market data for RSI...', 'info');
            allData = await loadAllScannerData(true);
        }

        if (!allData || allData.length === 0) {
            if (buyBody) buyBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">No data available</td></tr>';
            if (sellBody) sellBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">No data available</td></tr>';
            return;
        }

        cachedRSIData = allData;
        applyRSIFilter('buy');
        applyRSIFilter('sell');

        if (updateTime) updateTime.innerText = new Date().toLocaleString();

    } catch (error) {
        console.error('RSI Indicator error:', error);
        if (buyBody) buyBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:red;">❌ Error loading data</td></tr>';
        if (sellBody) sellBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:red;">❌ Error loading data</td></tr>';
    }
}

// RSI ফিল্টার অ্যাপ্লাই
function applyRSIFilter(tab) {
    if (!cachedRSIData) {
        loadRSIIndicatorPage();
        return;
    }

    const tbodyId = tab === 'buy' ? 'rsi-buy-body' : 'rsi-sell-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const thresholdInput = tab === 'buy' ? document.getElementById('rsi-buy-threshold') : document.getElementById('rsi-sell-threshold');
    const threshold = parseFloat(thresholdInput?.value) || (tab === 'buy' ? 30 : 70);

    let filtered = [];
    if (tab === 'buy') {
        filtered = cachedRSIData.filter(item => item.rsi !== null && item.rsi < threshold);
        filtered.sort((a, b) => (a.rsi || 0) - (b.rsi || 0));
    } else {
        filtered = cachedRSIData.filter(item => item.rsi !== null && item.rsi > threshold);
        filtered.sort((a, b) => (b.rsi || 0) - (a.rsi || 0));
    }

    renderRSITable(filtered, tab, tbody);
}

// RSI টেবিল রেন্ডার (Category, ATH, ATL সহ)
function renderRSITable(data, tab, tbody) {
    if (!tbody) return;

    if (!data || !Array.isArray(data) || data.length === 0) {
        const msg = tab === 'buy' ? 'No stocks with RSI below threshold.' : 'No stocks with RSI above threshold.';
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">${msg}</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(item => {
        const isBuy = tab === 'buy';
        const signalText = isBuy ? '🟢 BUY' : '🔴 SELL';
        const signalColor = isBuy ? '#10b981' : '#ef4444';
        const rsiColor = isBuy ? '#10b981' : '#ef4444';

        html += `<tr onclick="openStockDetailModal('${item.ticker}')" style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">`;
        html += `<td style="padding: 10px; font-weight: bold; color: var(--primary-color); text-decoration: underline;">${item.ticker}</td>`;
        html += `<td style="padding: 10px;">${item.category || 'N/A'}</td>`;
        html += `<td style="padding: 10px; text-align: right;">৳${(item.currentPrice || 0).toFixed(2)}</td>`;
        html += `<td style="padding: 10px; text-align: right; color: ${rsiColor}; font-weight: 600;">${item.rsi !== null ? item.rsi.toFixed(2) : '-'}</td>`;
        html += `<td style="padding: 10px; text-align: right;">${item.ath > 0 ? '৳'+item.ath.toFixed(2) : '-'}</td>`;
        html += `<td style="padding: 10px; text-align: right;">${item.atl > 0 ? '৳'+item.atl.toFixed(2) : '-'}</td>`;
        html += `<td style="padding: 10px; text-align: center; color: ${signalColor}; font-weight: bold;">${signalText}</td>`;
        html += `</tr>`;
    });
    tbody.innerHTML = html;
}

// RSI ট্যাব সুইচ
function switchRSITab(tab) {
    currentRSITab = tab;
    const containers = {
        buy: document.getElementById('rsi-buy-container'),
        sell: document.getElementById('rsi-sell-container')
    };
    const tabs = {
        buy: document.getElementById('rsi-tab-buy'),
        sell: document.getElementById('rsi-tab-sell')
    };

    Object.values(containers).forEach(c => { if (c) c.style.display = 'none'; });
    Object.values(tabs).forEach(t => {
        if (t) {
            t.style.background = 'transparent';
            t.style.color = 'var(--text-primary)';
            t.style.border = '1px solid var(--border-color)';
        }
    });

    if (tab === 'buy' && containers.buy) {
        containers.buy.style.display = 'block';
        if (tabs.buy) {
            tabs.buy.style.background = 'var(--primary-color)';
            tabs.buy.style.color = 'white';
            tabs.buy.style.border = 'none';
        }
        applyRSIFilter('buy');
    } else if (tab === 'sell' && containers.sell) {
        containers.sell.style.display = 'block';
        if (tabs.sell) {
            tabs.sell.style.background = 'var(--primary-color)';
            tabs.sell.style.color = 'white';
            tabs.sell.style.border = 'none';
        }
        applyRSIFilter('sell');
    }
}

// RSI Indicator রিফ্রেশ
async function refreshRSIIndicator() {
    clearAllScannerCache();
    await loadRSIIndicatorPage();
    if (typeof showToast === 'function') showToast('✅ RSI Indicator refreshed!', 'success');
}

// ==========================================
// 📌 Screener - Parabolic SAR (সাধারণ টেবিল)
// ==========================================

let currentScreenerTab = 'buy';
let screenerDataCache = null;
let screenerCacheTime = 0;
const SCREENER_CACHE_TTL = 300000;

async function loadScreenerData(tab = 'buy') {
    currentScreenerTab = tab;
    const tbody = document.getElementById('screener-table-body');
    if (!tbody) return;

    const tabBuy = document.getElementById('screener-tab-buy');
    const tabSell = document.getElementById('screener-tab-sell');
    if (tabBuy && tabSell) {
        [tabBuy, tabSell].forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.border = '1px solid var(--border-color)';
            btn.style.color = 'var(--text-primary)';
        });
        const activeBtn = document.getElementById(`screener-tab-${tab}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.background = 'var(--primary-color)';
            activeBtn.style.color = 'white';
            activeBtn.style.border = 'none';
        }
    }

    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">⏳ Scanning market...</td></tr>`;

    try {
        const user = auth.currentUser;
        if (!user) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Please login first.</td></tr>`;
            return;
        }

        const now = Date.now();
        if (screenerDataCache && (now - screenerCacheTime) < SCREENER_CACHE_TTL) {
            renderScreenerTable(tab, screenerDataCache);
            return;
        }

        const unifiedData = await unifiedEngine.calculate(user.uid, true);
        const tickers = unifiedData.stockDetails.map(s => s.ticker);

        if (tickers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">No holdings found. Add some stocks to screen.</td></tr>`;
            return;
        }

        const start = new Date();
        start.setDate(start.getDate() - 30);
        const startDateStr = start.toISOString().split('T')[0];

        const screenerResults = [];
        const batchSize = 10;

        for (let i = 0; i < tickers.length; i += batchSize) {
            const batchTickers = tickers.slice(i, i + batchSize);
            const promises = batchTickers.map(async (ticker) => {
                try {
                    let currentPrice = await getUnifiedPrice(ticker);
                    let priceData = [];

                    if (typeof db !== 'undefined') {
                        try {
                            const snap = await db.collection('daily_prices')
                                .where('ticker', '==', ticker)
                                .where('date', '>=', startDateStr)
                                .orderBy('date', 'asc')
                                .get();
                            if (!snap.empty) {
                                snap.forEach(doc => {
                                    const data = doc.data();
                                    const price = parseFloat(data.price) || parseFloat(data.close) || 0;
                                    const high = parseFloat(data.high) || price;
                                    const low = parseFloat(data.low) || price;
                                    if (price > 0) {
                                        priceData.push({
                                            date: data.date,
                                            ltp: price,
                                            high: high,
                                            low: low
                                        });
                                    }
                                });
                            }
                        } catch (e) { /* ignore */ }
                    }

                    if (priceData.length < 2) return null;

                    const sarData = calculateParabolicSAR(priceData);
                    const lastSAR = sarData[sarData.length - 1];
                    if (currentPrice === 0) currentPrice = priceData[priceData.length - 1]?.ltp || 0;

                    return {
                        ticker: ticker,
                        currentPrice: currentPrice,
                        sar: lastSAR?.sar || currentPrice,
                        trend: lastSAR?.trend || 'up'
                    };
                } catch (err) {
                    console.warn(`Error processing ${ticker}:`, err);
                    return null;
                }
            });

            const results = await Promise.all(promises);
            results.forEach(r => { if (r) screenerResults.push(r); });
        }

        screenerDataCache = screenerResults;
        screenerCacheTime = Date.now();
        renderScreenerTable(tab, screenerResults);

        const updateTime = document.getElementById('screener-update-time');
        if (updateTime) updateTime.innerText = new Date().toLocaleString();
    } catch (error) {
        console.error('Screener error:', error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Error: ${error.message}</td></tr>`;
    }
}

function renderScreenerTable(tab, data) {
    const tbody = document.getElementById('screener-table-body');
    if (!tbody) return;

    if (!data || !Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">No ${tab} signals found.</td></tr>`;
        return;
    }

    const filtered = data.filter(item => {
        if (tab === 'buy') return item.currentPrice > item.sar;
        else return item.currentPrice < item.sar;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">No ${tab} signals found.</td></tr>`;
        return;
    }

    filtered.sort((a, b) => {
        const diffA = Math.abs(a.currentPrice - a.sar);
        const diffB = Math.abs(b.currentPrice - b.sar);
        return diffB - diffA;
    });

    let html = '';
    for (const item of filtered) {
        const diff = item.currentPrice - item.sar;
        const signalClass = diff > 0 ? 'up' : 'error';
        const signalText = diff > 0 ? '🟢 Buy' : '🔴 Sell';

        html += `<tr onclick="openStockDetailModal('${item.ticker}')" style="cursor: pointer;">`;
        html += `<td style="padding: 10px; font-weight: bold; color: var(--primary-color); text-decoration: underline;">${item.ticker}</td>`;
        html += `<td style="padding: 10px; text-align: right;">৳${(item.currentPrice || 0).toFixed(2)}</td>`;
        html += `<td style="padding: 10px; text-align: right;">৳${(item.sar || 0).toFixed(2)}</td>`;
        html += `<td style="padding: 10px; text-align: center; font-weight: bold;" class="${signalClass}">${signalText}</td>`;
        html += `</tr>`;
    }
    tbody.innerHTML = html;
}

// ==========================================
// 📌 গ্লোবালি এক্সপোজ
// ==========================================
window.loadAllScannerPage = loadAllScannerPage;
window.switchAllScannerTab = switchAllScannerTab;
window.refreshAllScannerPage = refreshAllScannerPage;
window.refreshAllScannerData = refreshAllScannerData;
window.loadRSIIndicatorPage = loadRSIIndicatorPage;
window.switchRSITab = switchRSITab;
window.applyRSIFilter = applyRSIFilter;
window.refreshRSIIndicator = refreshRSIIndicator;
window.calcRSI = calcRSI;
window.calcPSAR = calcPSAR;
window.loadScreenerData = loadScreenerData;
window.clearAllScannerCache = clearAllScannerCache;

console.log('✅ scanner.js (Supabase for live, Firebase for historical) loaded successfully');