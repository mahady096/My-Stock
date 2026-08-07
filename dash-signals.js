// ==========================================
// 📊 dash-signals.js - সিগন্যাল বক্স
//    dashboard.js থেকে ভাগ করা (ফাইল ৪)
//    Buy/Sell সিগন্যাল ফিল্টার ও লিস্ট
// ==========================================

// ==========================================
// 📌 গ্লোবাল ভেরিয়েবল
// ==========================================

let currentSignalMarket = 'all';
let currentSignalScanner = 'psar';
let signalDataCache = null;
let signalCacheTime = 0;
const SIGNAL_CACHE_TTL = 300000;
let lastBuySignals = [];
let lastSellSignals = [];

// ==========================================
// ১. সিগন্যাল ফিল্টার অ্যাপ্লাই
// ==========================================

window.applySignalFilters = async function() {
    const marketFilter = document.getElementById('signal-market-filter');
    const scannerFilter = document.getElementById('signal-scanner-filter');

    if (marketFilter) currentSignalMarket = marketFilter.value;
    if (scannerFilter) currentSignalScanner = scannerFilter.value;

    await loadSignalData();
};

// ==========================================
// ২. সিগন্যাল ডেটা লোড
// ==========================================

async function loadSignalData() {
    const buyContainer = document.getElementById('buy-signal-list');
    const sellContainer = document.getElementById('sell-signal-list');
    const buyCount = document.getElementById('buy-signal-count');
    const sellCount = document.getElementById('sell-signal-count');
    const updateTime = document.getElementById('signal-update-time');

    if (!buyContainer || !sellContainer) return;

    buyContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">⏳ Loading...</div>`;
    sellContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">⏳ Loading...</div>`;

    try {
        const user = auth && auth.currentUser ? auth.currentUser : null;
        if (!user) {
            buyContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">Please login first.</div>`;
            sellContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">Please login first.</div>`;
            return;
        }

        let targetTickers = [];
        if (currentSignalMarket === 'portfolio') {
            const unifiedData = await unifiedEngine.calculate(user.uid, null, true);
            targetTickers = unifiedData.stockDetails.map(s => s.ticker);
        } else if (currentSignalMarket === 'watchlist') {
            try {
                const wl = localStorage.getItem('market_watch_list');
                targetTickers = wl ? JSON.parse(wl) : [];
            } catch (e) { targetTickers = []; }
        } else {
            targetTickers = typeof dseStocks !== 'undefined' ? dseStocks : [];
        }

        if (targetTickers.length === 0) {
            buyContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No stocks found in selected market.</div>`;
            sellContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">No stocks found in selected market.</div>`;
            if (buyCount) buyCount.innerText = '0 stocks';
            if (sellCount) sellCount.innerText = '0 stocks';
            return;
        }

        const batchSize = 10;
        const allResults = [];
        const totalTickers = targetTickers.length;

        for (let i = 0; i < totalTickers; i += batchSize) {
            const batch = targetTickers.slice(i, i + batchSize);
            const promises = batch.map(async (ticker) => {
                try {
                    const price = await getUnifiedPrice(ticker);
                    if (price <= 0) return null;

                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 30);
                    const startDateStr = startDate.toISOString().split('T')[0];

                    let priceData = [];
                    
                    // ১. Supabase history_dse (প্রথম)
                    if (typeof supabase !== 'undefined' && supabase) {
                        try {
                            const { data, error } = await supabase
                                .from('history_dse')
                                .select('date, ltp, high, low')
                                .eq('code', ticker)
                                .gte('date', startDateStr)
                                .order('date', { ascending: true })
                                .limit(30);
                            if (!error && data && data.length > 0) {
                                priceData = data.map(d => ({
                                    date: d.date,
                                    ltp: parseFloat(d.ltp),
                                    high: parseFloat(d.high) || parseFloat(d.ltp),
                                    low: parseFloat(d.low) || parseFloat(d.ltp)
                                }));
                            }
                        } catch (e) {
                            console.warn(`Supabase history fetch failed for ${ticker}:`, e);
                        }
                    }

                    // ২. Firebase cse_detailed_data (ফ্যালব্যাক)
                    if (priceData.length === 0 && typeof db !== 'undefined') {
                        try {
                            const snap = await db.collection('cse_detailed_data')
                                .where('code', '==', ticker)
                                .where('date', '>=', startDateStr)
                                .orderBy('date', 'asc')
                                .limit(30)
                                .get();

                            if (!snap.empty) {
                                snap.forEach(doc => {
                                    const d = doc.data();
                                    const ltp = parseFloat(d.ltp);
                                    if (ltp > 0) {
                                        priceData.push({
                                            date: d.date,
                                            ltp: ltp,
                                            high: parseFloat(d.high) || ltp,
                                            low: parseFloat(d.low) || ltp
                                        });
                                    }
                                });
                            }
                        } catch (e) { /* ignore */ }
                    }

                    if (priceData.length < 15) return null;

                    // RSI (indicators.js থেকে)
                    const rsiData = calculateRSI(priceData.map(p => p.ltp), 14);
                    const lastRsi = rsiData.filter(r => r.rsi !== null).pop();
                    const rsi = lastRsi ? lastRsi.rsi : 50;

                    // PSAR (indicators.js থেকে)
                    const psarData = calculateParabolicSAR(priceData);
                    const psar = psarData.length > 0 ? psarData[psarData.length - 1].sar : price;

                    let ath = 0, atl = Infinity;
                    for (const item of priceData) {
                        const ltp = item.ltp;
                        if (ltp > ath) ath = ltp;
                        if (ltp > 0 && ltp < atl) atl = ltp;
                        if (item.high > ath) ath = item.high;
                        if (item.low > 0 && item.low < atl) atl = item.low;
                    }
                    if (atl === Infinity) atl = price;

                    return {
                        ticker: ticker,
                        price: price,
                        rsi: rsi,
                        psar: psar,
                        ath: ath,
                        atl: atl
                    };
                } catch (err) {
                    return null;
                }
            });

            const results = await Promise.all(promises);
            const valid = results.filter(r => r !== null);
            allResults.push(...valid);
        }

        let buySignals = [];
        let sellSignals = [];

        if (currentSignalScanner === 'psar') {
            buySignals = allResults.filter(item => item.price > item.psar);
            sellSignals = allResults.filter(item => item.price < item.psar);
        } else if (currentSignalScanner === 'rsi') {
            buySignals = allResults.filter(item => item.rsi < 30);
            sellSignals = allResults.filter(item => item.rsi > 70);
        } else if (currentSignalScanner === 'all-scanner') {
            buySignals = allResults.filter(item => item.rsi < 30 && item.price > item.psar);
            sellSignals = allResults.filter(item => item.rsi > 70 && item.price < item.psar);
        } else if (currentSignalScanner === 'smart-signal') {
            buySignals = allResults.filter(item => item.rsi < 40 && item.price > item.psar);
            sellSignals = allResults.filter(item => item.rsi > 60 && item.price < item.psar);
        } else if (currentSignalScanner === 'price-position') {
            const THRESHOLD = 0.10;
            buySignals = allResults.filter(item => {
                if (item.atl <= 0) return false;
                const diffPercent = (item.price - item.atl) / item.atl;
                return diffPercent <= THRESHOLD && diffPercent >= 0;
            });
            sellSignals = allResults.filter(item => {
                if (item.ath <= 0) return false;
                const diffPercent = (item.ath - item.price) / item.ath;
                return diffPercent <= THRESHOLD && diffPercent >= 0;
            });
        } else if (currentSignalScanner === 'buy-sell-price') {
            const data = await window.getBuySellPriceSignalData();
            buySignals = data.buy || [];
            sellSignals = data.sell || [];
            buySignals.sort((a, b) => a.price - b.price);
            sellSignals.sort((a, b) => b.price - a.price);
        }

        buySignals.sort((a, b) => {
            const scoreA = (a.rsi < 30 ? 2 : 0) + (a.price > a.psar ? 1 : 0) + (a.price <= a.atl * 1.1 ? 1 : 0);
            const scoreB = (b.rsi < 30 ? 2 : 0) + (b.price > b.psar ? 1 : 0) + (b.price <= b.atl * 1.1 ? 1 : 0);
            return scoreB - scoreA;
        });

        sellSignals.sort((a, b) => {
            const scoreA = (a.rsi > 70 ? 2 : 0) + (a.price < a.psar ? 1 : 0) + (a.price >= a.ath * 0.9 ? 1 : 0);
            const scoreB = (b.rsi > 70 ? 2 : 0) + (b.price < b.psar ? 1 : 0) + (b.price >= b.ath * 0.9 ? 1 : 0);
            return scoreB - scoreA;
        });

        lastBuySignals = buySignals;
        lastSellSignals = sellSignals;

        renderSignalList(buyContainer, buySignals, 'buy', buyCount);
        renderSignalList(sellContainer, sellSignals, 'sell', sellCount);

        if (updateTime) updateTime.innerText = new Date().toLocaleString();

    } catch (error) {
        console.error('Signal load error:', error);
        buyContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">Error: ${error.message}</div>`;
        sellContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">Error: ${error.message}</div>`;
    }
}

// ==========================================
// ৩. সিগন্যাল লিস্ট রেন্ডার
// ==========================================

function renderSignalList(container, data, type, countElement) {
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">No ${type} signals found.</div>`;
        if (countElement) countElement.innerText = '0 stocks';
        return;
    }

    const displayData = data.slice(0, 10);
    const signalText = type === 'buy' ? '🟢 BUY' : '🔴 SELL';
    const signalColor = type === 'buy' ? '#10b981' : '#ef4444';

    let html = '';
    for (const item of displayData) {
        let filterValue = '';
        if (currentSignalScanner === 'psar') filterValue = `PSAR: ₹${item.psar.toFixed(2)}`;
        else if (currentSignalScanner === 'rsi') filterValue = `RSI: ${item.rsi.toFixed(1)}`;
        else if (currentSignalScanner === 'price-position') {
            if (type === 'buy') filterValue = `ATL: ₹${item.atl.toFixed(2)}`;
            else filterValue = `ATH: ₹${item.ath.toFixed(2)}`;
        } else if (currentSignalScanner === 'buy-sell-price') {
            if (type === 'buy') {
                filterValue = `Min Buy: ৳${item.minBuyPrice?.toFixed(2) || 0}`;
            } else {
                filterValue = `Max Sell: ৳${item.maxSellPrice?.toFixed(2) || 0}`;
            }
        } else {
            filterValue = `RSI: ${item.rsi.toFixed(1)} PSAR: ₹${item.psar.toFixed(2)}`;
        }

        html += `
            <div class="signal-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; margin-bottom: 3px; border-radius: 6px; background: var(--bg-tertiary); font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <span style="font-weight: 600; color: var(--primary-color); text-decoration: underline; font-size: 13px; white-space: nowrap; cursor: pointer;" onclick="event.stopPropagation(); openStockDetailModal('${item.ticker}')">${item.ticker}</span>
                    <span style="color: var(--text-muted); font-size: 11px; white-space: nowrap;">₹${item.price.toFixed(2)}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; font-size: 11px; flex-shrink: 0;">
                    <span style="color: var(--text-secondary);">${filterValue}</span>
                    <span style="color: ${signalColor}; font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 10px; background: ${signalColor}22;">${signalText}</span>
                </div>
            </div>
        `;
    }

    let seeAllHtml = '';
    if (data.length > 10) {
        seeAllHtml = `<div style="text-align: center; padding: 8px; color: var(--primary-color); font-size: 12px; cursor: pointer; text-decoration: underline;" onclick="openSignalDetailModal('${type}')">See All ${data.length} stocks →</div>`;
    }

    container.innerHTML = html + seeAllHtml;
    if (countElement) countElement.innerText = `${data.length} stocks`;

    container.parentElement?.addEventListener('click', function(e) {
        if (!e.target.closest('.signal-item') && !e.target.closest('[onclick]')) {
            openSignalDetailModal(type);
        }
    });
}

// ==========================================
// ৪. সিগন্যাল ডিটেইল মডাল
// ==========================================

window.openSignalDetailModal = function(type) {
    const modal = document.getElementById('signal-detail-modal');
    if (!modal) return;

    const title = document.getElementById('signal-detail-title');
    const countSpan = document.getElementById('signal-detail-count');
    const tbody = document.getElementById('signal-detail-tbody');
    const timeSpan = document.getElementById('signal-detail-time');

    let data = type === 'buy' ? lastBuySignals : lastSellSignals;
    if (!data || data.length === 0) {
        if (tbody) {
            const thead = tbody.closest('table').querySelector('thead');
            if (thead) thead.style.display = 'none';
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No signals available.</td></tr>`;
        }
        modal.style.display = 'flex';
        return;
    }

    if (title) title.innerText = type === 'buy' ? '📈 Buy Signals' : '📉 Sell Signals';
    if (countSpan) countSpan.innerText = `${data.length} stocks`;
    if (timeSpan) timeSpan.innerText = new Date().toLocaleString();

    const isBuySellPrice = currentSignalScanner === 'buy-sell-price';

    let theadHTML = '';
    if (isBuySellPrice) {
        if (type === 'buy') {
            theadHTML = `
                <tr>
                    <th style="padding:8px; text-align:left;">Share</th>
                    <th style="padding:8px; text-align:right;">Current Price (৳)</th>
                    <th style="padding:8px; text-align:right;">Avg Buy (৳)</th>
                    <th style="padding:8px; text-align:right;">Min Buy (৳)</th>
                    <th style="padding:8px; text-align:center;">Signal</th>
                    <th style="padding:8px; text-align:center;">Action</th>
                </tr>
            `;
        } else {
            theadHTML = `
                <tr>
                    <th style="padding:8px; text-align:left;">Share</th>
                    <th style="padding:8px; text-align:right;">Current Price (৳)</th>
                    <th style="padding:8px; text-align:right;">Avg Sell (৳)</th>
                    <th style="padding:8px; text-align:right;">Max Sell (৳)</th>
                    <th style="padding:8px; text-align:center;">Signal</th>
                    <th style="padding:8px; text-align:center;">Action</th>
                </tr>
            `;
        }
    } else {
        theadHTML = `
            <tr>
                <th style="padding:8px; text-align:left;">Share</th>
                <th style="padding:8px; text-align:right;">Price (৳)</th>
                <th style="padding:8px; text-align:right;">RSI</th>
                <th style="padding:8px; text-align:right;">PSAR (৳)</th>
                <th style="padding:8px; text-align:right;">ATH (৳)</th>
                <th style="padding:8px; text-align:right;">ATL (৳)</th>
                <th style="padding:8px; text-align:center;">Signal</th>
                <th style="padding:8px; text-align:center;">Action</th>
            </tr>
        `;
    }

    const thead = tbody.closest('table').querySelector('thead');
    if (thead) {
        thead.style.display = '';
        thead.innerHTML = theadHTML;
    }

    let rowsHTML = '';
    for (const item of data) {
        const price = item.price ?? 0;
        const signalText = type === 'buy' ? '🟢 BUY' : '🔴 SELL';
        const signalColor = type === 'buy' ? '#10b981' : '#ef4444';

        if (isBuySellPrice) {
            const avgValue = type === 'buy' ? (item.minBuyPrice || 0) : (item.maxSellPrice || 0);
            const minBuy = (item.minBuyPrice !== null && item.minBuyPrice !== undefined && item.minBuyPrice !== Infinity) ? item.minBuyPrice : 0;
            const maxSell = (item.maxSellPrice !== null && item.maxSellPrice !== undefined) ? item.maxSellPrice : 0;

            rowsHTML += `<tr onclick="openStockDetailModal('${item.ticker}')" style="cursor:pointer;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">`;
            rowsHTML += `<td style="padding:8px 10px; font-weight:600; color:var(--primary-color); text-decoration:underline;">${item.ticker}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:right;">৳${price.toFixed(2)}</td>`;
            if (type === 'buy') {
                rowsHTML += `<td style="padding:8px 10px; text-align:right;">৳${avgValue.toFixed(2)}</td>`;
                rowsHTML += `<td style="padding:8px 10px; text-align:right; color:#10b981;">৳${minBuy.toFixed(2)}</td>`;
            } else {
                rowsHTML += `<td style="padding:8px 10px; text-align:right;">৳${avgValue.toFixed(2)}</td>`;
                rowsHTML += `<td style="padding:8px 10px; text-align:right; color:#ef4444;">৳${maxSell.toFixed(2)}</td>`;
            }
            rowsHTML += `<td style="padding:8px 10px; text-align:center; color:${signalColor}; font-weight:bold;">${signalText}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:center;"><button onclick="event.stopPropagation(); openStockDetailModal('${item.ticker}')" style="background:var(--primary-color); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">📊 View</button></td>`;
            rowsHTML += `</tr>`;
        } else {
            const rsi = (item.rsi !== null && item.rsi !== undefined) ? item.rsi.toFixed(2) : '-';
            const psar = (item.psar !== null && item.psar !== undefined && item.psar > 0) ? item.psar.toFixed(2) : '-';
            const ath = (item.ath !== null && item.ath !== undefined && item.ath > 0) ? item.ath.toFixed(2) : '-';
            const atl = (item.atl !== null && item.atl !== undefined && item.atl !== Infinity && item.atl > 0) ? item.atl.toFixed(2) : '-';

            rowsHTML += `<tr onclick="openStockDetailModal('${item.ticker}')" style="cursor:pointer;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">`;
            rowsHTML += `<td style="padding:8px 10px; font-weight:600; color:var(--primary-color); text-decoration:underline;">${item.ticker}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:right;">৳${price.toFixed(2)}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:right; color: ${item.rsi !== null ? (item.rsi < 30 ? '#10b981' : (item.rsi > 70 ? '#ef4444' : '#f59e0b')) : '#64748b'};">${rsi}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:right;">${psar !== '-' ? '৳'+psar : '-'}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:right;">${ath !== '-' ? '৳'+ath : '-'}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:right;">${atl !== '-' ? '৳'+atl : '-'}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:center; color:${signalColor}; font-weight:bold;">${signalText}</td>`;
            rowsHTML += `<td style="padding:8px 10px; text-align:center;"><button onclick="event.stopPropagation(); openStockDetailModal('${item.ticker}')" style="background:var(--primary-color); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">📊 View</button></td>`;
            rowsHTML += `</tr>`;
        }
    }

    tbody.innerHTML = rowsHTML;
    modal.style.display = 'flex';
};

window.closeSignalDetailModal = function() {
    const modal = document.getElementById('signal-detail-modal');
    if (modal) modal.style.display = 'none';
};

// মডালের বাইরে ক্লিক করলে বন্ধ
document.addEventListener('click', function(e) {
    const modal = document.getElementById('signal-detail-modal');
    if (modal && e.target === modal) {
        closeSignalDetailModal();
    }
});

// ==========================================
// 📌 গ্লোবাল এক্সপোজ
// ==========================================

window.applySignalFilters = window.applySignalFilters;
window.loadSignalData = loadSignalData;
window.openSignalDetailModal = window.openSignalDetailModal;
window.closeSignalDetailModal = window.closeSignalDetailModal;

console.log('✅ dash-signals.js loaded successfully');