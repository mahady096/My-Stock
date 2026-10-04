// ==========================================
// 📊 dash-utils.js - ইউটিলিটি ফাংশন
//    dashboard.js থেকে ভাগ করা (ফাইল ৫)
//    টাইমলাইন, ডিপোজিট, অটো-রিফ্রেশ, টাইমস্ট্যাম্প
// ==========================================

// ==========================================
// ১. পোর্টফোলিও টাইমলাইন ডেটা ফেচ
// ==========================================

async function fetchPortfolioTimelineData(startDate = null, endDate = null, portfolioId = null) {
    console.log('📥 fetchPortfolioTimelineData [v8] called', { portfolioId });
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user || typeof supabase === 'undefined' || !supabase) return [];

    // Performance Summary needs up to 1Y. Charts can filter the returned range.
    const today = new Date();
    const asLocalDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const defaultStart = asLocalDate(oneYearAgo);
    const defaultEnd = asLocalDate(today);
    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;
    const cacheKey = `timeline_v8_${user.uid}_${start}_${end}_${portfolioId || 'all'}`;

    try {
        const cached = await CacheManager.get(cacheKey, 900000);
        if (cached && Array.isArray(cached)) return cached;
    } catch (e) {}

    try {
        const toDateKey = raw => {
            if (!raw) return asLocalDate(new Date());
            const value = String(raw);
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
            const parsed = new Date(raw);
            return Number.isNaN(parsed.getTime()) ? asLocalDate(new Date()) : asLocalDate(parsed);
        };
        const normalizePid = v => String(v ?? '').trim().toLowerCase();
        const wantedPid = normalizePid(portfolioId);
        const includePortfolio = row => {
            const pid = normalizePid(row.portfolio_id);
            if (!wantedPid || wantedPid === 'all' || wantedPid === 'grand') return true;
            return wantedPid === 'main' ? (!pid || pid === 'main') : pid === wantedPid;
        };

        // Supabase is the single source for portfolio/sales history.
        const [{ data: pRows, error: pErr }, { data: sRows, error: sErr }] = await Promise.all([
            supabase.from('portfolios').select('*').eq('user_id', user.uid),
            supabase.from('sales_history').select('*').eq('user_id', user.uid)
        ]);
        if (pErr) throw pErr;
        if (sErr) throw sErr;

        const portfolioRows = (pRows || []).filter(includePortfolio);
        const salesRows = (sRows || []).filter(includePortfolio);
        if (!portfolioRows.length) return [];

        const buyLots = portfolioRows.map(row => {
            const qty = Number(row.quantity) || 0;
            const buyPrice = Number(row.buy_price) || 0;
            const commission = Number(row.commission) || 0;
            const rawDate = row.date || row.created_at;
            return {
                ticker: String(row.share_name ?? '').trim().toUpperCase(),
                qty,
                buyPrice,
                perUnitCost: qty > 0 ? ((qty * buyPrice) + commission) / qty : 0,
                date: toDateKey(rawDate)
            };
        }).filter(x => x.ticker && x.qty > 0 && x.buyPrice >= 0);

        if (!buyLots.length) return [];
        buyLots.sort((a,b) => a.date.localeCompare(b.date));

        const sales = salesRows.map(row => {
            const rawDate = row.date || row.created_at;
            return {
                ticker: String(row.share_name ?? '').trim().toUpperCase(),
                qty: Number(row.quantity_sold) || 0,
                date: toDateKey(rawDate)
            };
        }).filter(x => x.ticker && x.qty > 0);
        sales.sort((a,b) => a.date.localeCompare(b.date));

        const startObj = new Date(start + 'T00:00:00'); startObj.setHours(0,0,0,0);
        const endObj = new Date(end + 'T23:59:59'); endObj.setHours(23,59,59,999);
        // Fetch a short price lookback before the requested range for the first daily change.
        // Holdings are reconstructed from all trades, so older price history is not required.
        const historyStart = new Date(startObj);
        historyStart.setDate(historyStart.getDate() - 14);
        const historyStartStr = asLocalDate(historyStart);
        const historyEndStr = asLocalDate(endObj);
        const tickers = [...new Set(buyLots.map(x => x.ticker))];

        // Fetch each ticker's history. A single query per ticker avoids the 1,000-row
        // PostgREST response cap that previously truncated multi-ticker timelines.
        const priceByTicker = new Map();
        for (const ticker of tickers) {
            const { data, error } = await supabase
                .from('history_dse')
                .select('ticker,date,ltp')
                .eq('ticker', ticker)
                .gte('date', historyStartStr)
                .lte('date', historyEndStr)
                .order('date', { ascending: true })
                .limit(1000);
            if (error) {
                console.warn('history_dse timeline error:', ticker, error.message);
                continue;
            }
            const series = [];
            (data || []).forEach(row => {
                const d = String(row.date || '').split('T')[0];
                const price = Number(row.ltp);
                if (/^\d{4}-\d{2}-\d{2}$/.test(d) && price > 0) series.push({date:d, price});
            });
            priceByTicker.set(ticker, series);
        }

        // Resolve current price from the same source used by dashboard cards.
        const latestMap = await getLatestAndPreviousPrices(tickers);
        const currentPriceMap = new Map();
        latestMap.forEach((v,k) => { if (Number(v.currentPrice) > 0) currentPriceMap.set(k, Number(v.currentPrice)); });

        // Build trading-date set from history and add today as a live/current valuation
        // point so the final chart point is exactly comparable to the dashboard card.
        const dateSet = new Set();
        priceByTicker.forEach(series => series.forEach(x => dateSet.add(x.date)));
        const dates = [...dateSet].sort();
        const todayStr = asLocalDate(today);
        if (currentPriceMap.size) dateSet.add(todayStr);
        const sortedDates = [...dateSet].filter(d => d >= historyStartStr && d <= historyEndStr).sort();

        const dailyPortfolio = [];
        let lastPrice = new Map();
        let previousRemainingByTicker = new Map();
        let previousValue = null;

        for (const dateStr of sortedDates) {
            const soldByTicker = new Map();
            for (const sale of sales) {
                if (sale.date <= dateStr) soldByTicker.set(sale.ticker, (soldByTicker.get(sale.ticker)||0) + sale.qty);
            }

            const remainingByTicker = new Map();
            // FIFO: apply sales dated on/before this day to buy lots dated on/before this day.
            const lots = buyLots.filter(lot => lot.date <= dateStr).map(lot => ({...lot, remaining: lot.qty}));
            for (const sale of sales.filter(x => x.date <= dateStr)) {
                let left = sale.qty;
                for (const lot of lots) {
                    if (left <= 0) break;
                    if (lot.ticker !== sale.ticker || lot.remaining <= 0) continue;
                    const taken = Math.min(lot.remaining, left);
                    lot.remaining -= taken; left -= taken;
                }
            }

            let totalInvestment = 0;
            for (const lot of lots) {
                if (lot.remaining > 0) {
                    totalInvestment += lot.remaining * lot.perUnitCost;
                    remainingByTicker.set(lot.ticker, (remainingByTicker.get(lot.ticker)||0) + lot.remaining);
                }
            }
            if (!(totalInvestment > 0)) continue;

            // Keep prior-close prices before advancing the market prices for this date.
            const priorPriceByTicker = new Map(lastPrice);
            // Advance each ticker's last historical close up to this date.
            for (const ticker of tickers) {
                const series = priceByTicker.get(ticker) || [];
                let candidate = null;
                for (const item of series) {
                    if (item.date > dateStr) break;
                    candidate = item.price;
                }
                if (candidate > 0) lastPrice.set(ticker, candidate);
            }
            if (dateStr === todayStr) currentPriceMap.forEach((price,ticker) => lastPrice.set(ticker,price));

            let totalCurrentValue = 0;
            remainingByTicker.forEach((qty,ticker) => {
                const price = lastPrice.get(ticker) || 0;
                if (price > 0) totalCurrentValue += qty * price;
            });
            if (!(totalCurrentValue > 0)) continue;

            // Daily P&L is price movement on quantities held at the previous close.
            // This excludes same-day purchases from being mistaken for profit and avoids
            // treating a sale/purchase cash-flow change as a market gain/loss.
            let dailyPL = 0;
            if (previousValue != null) {
                previousRemainingByTicker.forEach((qty, ticker) => {
                    const priorPrice = Number(priorPriceByTicker.get(ticker)) || 0;
                    const currentPrice = Number(lastPrice.get(ticker)) || 0;
                    if (qty > 0 && priorPrice > 0 && currentPrice > 0) dailyPL += qty * (currentPrice - priorPrice);
                });
            }
            const dailyPLPercent = previousValue > 0 ? (dailyPL / previousValue) * 100 : 0;
            dailyPortfolio.push({date:dateStr,totalInvestment,totalCurrentValue,dailyPL,dailyPLPercent});
            previousValue = totalCurrentValue;
            previousRemainingByTicker = new Map(remainingByTicker);
        }

        const result = dailyPortfolio.filter(x => {
            const d = new Date(x.date + 'T00:00:00');
            return d >= startObj && d <= endObj;
        });
        try { await CacheManager.set(cacheKey, result, 900000); } catch(e) {}
        console.log(`✅ [v8] Timeline complete: ${result.length} entries`);
        return result;
    } catch (error) {
        console.error('❌ [v8] Error in fetchPortfolioTimelineData:', error);
        return [];
    }
}

// ==========================================
// ২. ডিপোজিট ম্যানেজমেন্ট
// ==========================================

async function getUserDeposit(userId) {
    if (!userId) return 0;
    try {
        if (typeof db === 'undefined') return 0;
        const doc = await db.collection('user_meta').doc(userId).get();
        if (doc.exists) {
            return doc.data().deposit || 0;
        }
        return 0;
    } catch (e) {
        console.warn('Error getting deposit:', e);
        return 0;
    }
}

async function updateUserDeposit(userId, amount) {
    if (!userId) return;
    try {
        if (typeof db === 'undefined') return;
        await db.collection('user_meta').doc(userId).set({
            deposit: amount,
            updatedAt: new Date()
        }, { merge: true });
    } catch (e) {
        console.error('Error updating deposit:', e);
        throw e;
    }
}

// ==========================================
// ৩. অটো-রিফ্রেশ
// ==========================================

function startAutoRefresh() {
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = null;
    }
    if (!autoRefreshEnabled) return;
    
    const REFRESH_INTERVAL = 1800000; // ৩০ মিনিট
    let timeLeft = REFRESH_INTERVAL / 1000;

    function updateTimer() {
        const timerEl = document.getElementById('next-refresh-timer');
        if (timerEl) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = Math.floor(timeLeft % 60);
            timerEl.innerText = `⏳ ${minutes}m ${seconds}s`;
            if (timeLeft <= 0) {
                timerEl.innerText = '🔄 Refreshing...';
            }
        }
    }

    const timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            timeLeft = REFRESH_INTERVAL / 1000;
        }
        updateTimer();
    }, 1000);

    window.autoRefreshInterval = setInterval(() => {
        if (!document.hidden && currentDataMode === 'firebase' && auth && auth.currentUser) {
            console.log('🔄 Auto-refreshing dashboard...');
            loadDashboardData();
            timeLeft = REFRESH_INTERVAL / 1000;
            updateTimer();
        }
    }, REFRESH_INTERVAL);
    
    updateTimer();
}

function stopAutoRefresh() {
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = null;
    }
}

// ==========================================
// ৪. ম্যানুয়াল রিলোড
// ==========================================

async function manualReloadDashboard() {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    if (isManualReloading) {
        if (typeof showToast === 'function') showToast('Already reloading...', 'info');
        return;
    }
    isManualReloading = true;
    const reloadBtn = document.getElementById('btn-manual-reload');
    const originalText = reloadBtn ? reloadBtn.innerHTML : '';
    try {
        if (reloadBtn) {
            reloadBtn.innerHTML = '⏳ Loading...';
            reloadBtn.disabled = true;
            reloadBtn.style.opacity = '0.7';
        }
        if (typeof showToast === 'function') showToast('🔄 Manual refresh started...', 'info');
        firebaseDataManager.clearCache();
        CacheManager.clearAll();
        try { localStorage.removeItem('cachedPrices'); } catch (e) { /* ignore */ }
        await loadDashboardData();
        if (typeof loadUnifiedStockTable === 'function') await loadUnifiedStockTable(user.uid);
        if (typeof loadPortfolioAnalysisTable === 'function') await loadPortfolioAnalysisTable(user.uid);
        await updateTimestamp();
        if (typeof showToast === 'function') showToast('✅ Dashboard refreshed successfully!', 'success');
    } catch (error) {
        console.error(error);
        if (typeof showToast === 'function') showToast('❌ Refresh failed.', 'error');
    } finally {
        if (reloadBtn) {
            reloadBtn.innerHTML = originalText;
            reloadBtn.disabled = false;
            reloadBtn.style.opacity = '1';
        }
        isManualReloading = false;
    }
}

// ==========================================
// ৫. টাইমস্ট্যাম্প ও লোডিং
// ==========================================

function updateTimestamp() {
    const timestampElem = document.getElementById('update-timestamp');
    if (!timestampElem) return;

    const mode = currentDataMode === 'firebase' ? 'Firebase Cache' : 'Live API (Supabase)';

    getLatestDSEXFromSupabase()
        .then(dsexData => {
            if (dsexData && dsexData.date) {
                timestampElem.innerHTML = `🔄 Data source: ${mode} | Last scraped: ${formatDisplayTime(dsexData.date)} (BD Time)`;
            } else {
                // Supabase না পেলে Firebase ফ্যালব্যাক
                if (currentDataMode === 'firebase' || currentDataMode === 'live') {
                    firebaseDataManager.getLastUpdateTime()
                        .then(fbLastUpdate => {
                            if (fbLastUpdate && timestampElem) {
                                timestampElem.innerHTML = `🔄 Data source: ${mode} | Last scraped: ${formatDisplayTime(fbLastUpdate)} (BD Time)`;
                            } else {
                                timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
                            }
                        })
                        .catch(() => {
                            timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
                        });
                } else {
                    timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
                }
            }
        })
        .catch(() => {
            // এরর হলে Firebase বা বর্তমান সময়
            if (currentDataMode === 'firebase' || currentDataMode === 'live') {
                firebaseDataManager.getLastUpdateTime()
                    .then(fbLastUpdate => {
                        if (fbLastUpdate && timestampElem) {
                            timestampElem.innerHTML = `🔄 Data source: ${mode} | Last scraped: ${formatDisplayTime(fbLastUpdate)} (BD Time)`;
                        } else {
                            timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
                        }
                    })
                    .catch(() => {
                        timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
                    });
            } else {
                timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
            }
        });
}

function showDataLoading(isLoading) {
    // ============================================
    // 🔥 লোডার ও বাটন ডিসেবল সম্পূর্ণ বন্ধ
    //    শুধু মোড সুইচ করতে চান—কোনো UI ব্লক না
    // ============================================
    // কিছুই করবেন না—ফাংশনটি খালি
    return;
}

// ==========================================
// ৬. রিফ্রেশ পোর্টফোলিও অ্যানালাইসিস
// ==========================================

window.refreshPortfolioAnalysis = function() {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    if (isManualReloading) {
        if (typeof showToast === 'function') showToast('Already refreshing...', 'info');
        return;
    }
    const cacheKey = `analysis_${user.uid}`;
    try { sessionStorage.removeItem(cacheKey); } catch(e) {}
    if (typeof loadPortfolioAnalysisTable === 'function') {
        loadPortfolioAnalysisTable(user.uid, true);
        if (typeof showToast === 'function') showToast('🔄 Refreshing portfolio analysis...', 'info');
    }
};

// ==========================================
// ৭. ড্যাশবোর্ড উইজেট রিফ্রেশ
// ==========================================

window.refreshDashboardWidgets = async function() {
    try {
        const btn = document.querySelector('[onclick="refreshDashboardWidgets()"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ ...';
            btn.style.opacity = '0.7';
        }

        if (typeof showToast === 'function') {
            showToast('🔄 Refreshing dashboard widgets...', 'info');
        }

        if (typeof updatePerformanceSummary === 'function') {
            await updatePerformanceSummary();
        }

        if (typeof renderDashboardHistoryChart === 'function') {
            await renderDashboardHistoryChart();
        }

        if (typeof renderDashboardDailyPLChart === 'function') {
            await renderDashboardDailyPLChart();
        }

        if (typeof loadSignalData === 'function') {
            await loadSignalData();
        }

        const timeElem = document.getElementById('dash-perf-update-time');
        if (timeElem) {
            timeElem.innerText = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
        }

        const signalTime = document.getElementById('signal-update-time');
        if (signalTime) {
            signalTime.innerText = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
        }

        if (typeof showToast === 'function') {
            showToast('✅ Dashboard widgets refreshed!', 'success');
        }

    } catch (error) {
        console.error('Widget refresh error:', error);
        if (typeof showToast === 'function') {
            showToast('❌ Refresh failed: ' + error.message, 'error');
        }
    } finally {
        const btn = document.querySelector('[onclick="refreshDashboardWidgets()"]');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄 Refresh Widgets';
            btn.style.opacity = '1';
        }
    }
};

// ==========================================
// ৮. অটো-রিফ্রেশ টগল ইনিশিয়ালাইজ
// ==========================================

function initAutoRefreshToggle() {
    const toggle = document.getElementById('autoRefreshToggle');
    if (!toggle) return;
    toggle.addEventListener('change', (e) => {
        autoRefreshEnabled = e.target.checked;
        if (autoRefreshEnabled) startAutoRefresh();
        else stopAutoRefresh();
    });
}

// ==========================================
// ৯. কীবোর্ড শর্টকাট (Ctrl+R)
// ==========================================

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (auth && auth.currentUser) manualReloadDashboard();
    }
});

// ==========================================
// ১০. Visibility Change (ট্যাব সুইচ)
// ==========================================

let visibilityTimeout = null;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (visibilityTimeout) clearTimeout(visibilityTimeout);
        if (window.autoRefreshInterval) {
            clearInterval(window.autoRefreshInterval);
            window.autoRefreshInterval = null;
        }
    } else {
        visibilityTimeout = setTimeout(() => {
            if (autoRefreshEnabled && currentDataMode === 'firebase') startAutoRefresh();
        }, 2000);
        updateTimestamp();
    }
});

// ==========================================
// 📌 গ্লোবাল এক্সপোজ
// ==========================================

window.fetchPortfolioTimelineData = fetchPortfolioTimelineData;
window.getUserDeposit = getUserDeposit;
window.updateUserDeposit = updateUserDeposit;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
window.manualReloadDashboard = manualReloadDashboard;
window.updateTimestamp = updateTimestamp;
window.showDataLoading = showDataLoading;
window.refreshPortfolioAnalysis = window.refreshPortfolioAnalysis;
window.refreshDashboardWidgets = window.refreshDashboardWidgets;
window.initAutoRefreshToggle = initAutoRefreshToggle;
// ==========================================
// 📊 পোর্টফোলিও হিস্টোরি (Value History)
// ==========================================

let currentHistoryMode = 'supabase';
let currentHistoryData = [];

async function loadPortfolioHistory() {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) return;
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;
    try {
        const startInput = document.getElementById('history-start-date');
        const endInput = document.getElementById('history-end-date');
        const data = await fetchPortfolioTimelineData(
            startInput?.value || null,
            endInput?.value || null,
            window.currentDashboardPortfolioId || null
        );
        currentHistoryData = data || [];
        renderHistoryTable(currentHistoryData);
        renderHistoryChart(currentHistoryData);
    } catch (error) {
        console.error('Portfolio history load error:', error);
        tableBody.innerHTML = `<tr><td colspan="6">Error loading data</td></tr>`;
    }
}

function renderHistoryTable(data) {
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;
    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6">No data for selected range.</td></tr>`;
        const footerInvest = document.getElementById('history-footer-invest');
        const footerValue = document.getElementById('history-footer-value');
        const footerPL = document.getElementById('history-footer-pl');
        const footerPLPct = document.getElementById('history-footer-plpct');
        if (footerInvest) footerInvest.innerHTML = '-';
        if (footerValue) footerValue.innerHTML = '-';
        if (footerPL) footerPL.innerHTML = '-';
        if (footerPLPct) footerPLPct.innerHTML = '-';
        return;
    }

    let html = '',
        totalInvestment = 0,
        totalCurrentValue = 0;
    for (const item of data) {
        totalInvestment += item.totalInvestment;
        totalCurrentValue += item.totalCurrentValue;
        html += `<tr>
            <td>${formatDate(item.date)}</td>
            <td style="text-align:right;">৳${item.totalInvestment.toLocaleString('bn-BD', {minimumFractionDigits:2})}</td>
            <td style="text-align:right;">৳${item.totalCurrentValue.toLocaleString('bn-BD', {minimumFractionDigits:2})}</td>
            <td style="text-align:right; ${item.dailyPL>=0?'color:#10b981':'color:#ef4444'}">${item.dailyPL>=0?'+':''}৳${item.dailyPL.toLocaleString('bn-BD', {minimumFractionDigits:2})}</td>
            <td style="text-align:right; ${item.dailyPLPercent>=0?'color:#10b981':'color:#ef4444'}">${item.dailyPLPercent>=0?'+':''}${item.dailyPLPercent.toFixed(2)}%</td>
            <td style="text-align:center;">${item.dailyPL>=0?'✅':'📉'}</td>
        </tr>`;
    }
    tableBody.innerHTML = html;

    const finalPL = totalCurrentValue - totalInvestment;
    const finalPLPct = totalInvestment > 0 ? (finalPL / totalInvestment) * 100 : 0;
    const footerInvest = document.getElementById('history-footer-invest');
    const footerValue = document.getElementById('history-footer-value');
    const footerPL = document.getElementById('history-footer-pl');
    const footerPLPct = document.getElementById('history-footer-plpct');
    if (footerInvest) footerInvest.innerHTML = `৳${totalInvestment.toLocaleString('bn-BD', {minimumFractionDigits:2})}`;
    if (footerValue) footerValue.innerHTML = `৳${totalCurrentValue.toLocaleString('bn-BD', {minimumFractionDigits:2})}`;
    if (footerPL) {
        footerPL.innerHTML = `${finalPL>=0?'+':''}৳${finalPL.toLocaleString('bn-BD', {minimumFractionDigits:2})}`;
        footerPL.style.color = finalPL >= 0 ? '#10b981' : '#ef4444';
    }
    if (footerPLPct) {
        footerPLPct.innerHTML = `${finalPLPct>=0?'+':''}${finalPLPct.toFixed(2)}%`;
        footerPLPct.style.color = finalPLPct >= 0 ? '#10b981' : '#ef4444';
    }
}

function renderHistoryChart(data) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;
    if (window.historyChartInstance) window.historyChartInstance.destroy();
    if (data.length === 0) return;

    const labels = data.map(item => formatDateShort(item.date));
    const investData = data.map(item => item.totalInvestment);
    const valueData = data.map(item => item.totalCurrentValue);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    window.historyChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Total Investment', data: investData, borderColor: '#3b82f6', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.2, pointRadius: 3 },
                { label: 'Current Value', data: valueData, borderColor: '#10b981', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.2, pointRadius: 3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: textColor } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ৳${ctx.raw.toLocaleString('bn-BD', {minimumFractionDigits:2})}`
                    }
                }
            },
            scales: {
                x: { ticks: { color: textColor, maxRotation: 45 }, grid: { color: gridColor } },
                y: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    });
}

function filterHistoryByDate() { loadPortfolioHistory(); }

function resetHistoryFilter() {
    const startInput = document.getElementById('history-start-date');
    const endInput = document.getElementById('history-end-date');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    loadPortfolioHistory();
}

function setHistoryMode(mode) {
    currentHistoryMode = mode;
    const fbBtn = document.getElementById('history-firebase-mode');
    const liveBtn = document.getElementById('history-live-mode');
    if (fbBtn && liveBtn) {
        if (mode === 'firebase') {
            fbBtn.classList.add('active');
            fbBtn.style.background = '#10b981';
            liveBtn.classList.remove('active');
            liveBtn.style.background = '#64748b';
        } else {
            liveBtn.classList.add('active');
            liveBtn.style.background = '#10b981';
            fbBtn.classList.remove('active');
            fbBtn.style.background = '#64748b';
        }
    }
    loadPortfolioHistory();
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

// গ্লোবাল এক্সপোজ
window.loadPortfolioHistory = loadPortfolioHistory;
window.filterHistoryByDate = filterHistoryByDate;
window.resetHistoryFilter = resetHistoryFilter;
window.setHistoryMode = setHistoryMode;

console.log('✅ dash-utils.js loaded successfully');