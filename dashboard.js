// ==========================================
// 📊 dashboard.js - সম্পূর্ণ ইরর-ফ্রি ভার্সন
//    LTP, EPS, P/E, ক্যাটাগরি, রেকর্ড ডেট → Supabase
//    DSEX → Firebase
//    হিস্টোরিক্যাল ডেটা (চার্ট, প্রিভিয়াস ক্লোজ) → Firebase
// ==========================================

// ==========================================
// 📌 গ্লোবাল ভেরিয়েবল
// ==========================================
let historyData = null;
let currentPortfolioSortOrder = 'asc';
let currentPortfolioData = [];
let currentHistoryMode = 'firebase';
let currentHistoryData = [];

let currentSignalMarket = 'all';
let currentSignalScanner = 'psar';
let signalDataCache = null;
let signalCacheTime = 0;
const SIGNAL_CACHE_TTL = 300000;

let lastBuySignals = [];
let lastSellSignals = [];

// ==========================================
// ১. Dashboard Data Loader
// ==========================================
async function loadDashboardData() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const startInput = document.getElementById('dash-chart-start');
    const endInput = document.getElementById('dash-chart-end');
    if (startInput) startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    if (endInput) endInput.value = today.toISOString().split('T')[0];

    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    showDataLoading(true);
    try {
        const unifiedData = await unifiedEngine.calculate(user.uid, false);
        if (unifiedData && unifiedData.stockDetails.length > 0) {
            let totalCurrentValue = 0;
            const tickers = unifiedData.stockDetails.map(s => s.ticker);
            const pricePromises = tickers.map(t => getUnifiedPrice(t));
            const currentPrices = await Promise.all(pricePromises);

            for (let i = 0; i < unifiedData.stockDetails.length; i++) {
                const stock = unifiedData.stockDetails[i];
                let currentPrice = currentPrices[i];
                if (currentPrice === 0) currentPrice = stock.avgBuyPriceWithCommission;
                totalCurrentValue += stock.totalQty * currentPrice;
            }

            const totalInvestment = unifiedData.totalInvestment;
            const totalProfitLoss = totalCurrentValue - totalInvestment;

            const dashTotalValue = document.getElementById('dash-total-value');
            const dashTotalCost = document.getElementById('dash-total-cost');
            const dashTotalGL = document.getElementById('dash-total-gl');
            if (dashTotalValue) dashTotalValue.innerHTML = `৳${totalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
            if (dashTotalCost) dashTotalCost.innerHTML = `৳${totalInvestment.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
            if (dashTotalGL) {
                dashTotalGL.innerHTML = `${totalProfitLoss >= 0 ? '+' : ''}৳${totalProfitLoss.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
                dashTotalGL.style.color = totalProfitLoss >= 0 ? '#90ffb0' : '#ffaaaa';
            }
            currentPortfolioTotalValue = totalCurrentValue;
            updateTimestamp();
        } else {
            const dashTotalValue = document.getElementById('dash-total-value');
            const dashTotalCost = document.getElementById('dash-total-cost');
            const dashTotalGL = document.getElementById('dash-total-gl');
            if (dashTotalValue) dashTotalValue.innerHTML = '৳0.00';
            if (dashTotalCost) dashTotalCost.innerHTML = '৳0.00';
            if (dashTotalGL) dashTotalGL.innerHTML = '৳0.00';
        }

        await updatePerformanceSummary();
        await updateDSEXIndicator();
        await renderDashboardHistoryChart();
        await updateTotalIncomeCard();
        await renderDashboardDailyPLChart();
        await loadSignalData();
        
        // ✅ এখানে ড্যাশবোর্ড সার্চ ইনিশিয়ালাইজ করুন
        if (typeof initDashboardSearch === 'function') {
            initDashboardSearch();
        } else {
            console.warn('initDashboardSearch not available yet');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        if (typeof showToast === 'function') showToast('Error loading dashboard data', 'error');
    } finally {
        showDataLoading(false);
    }
}

// ==========================================
// 🔄 রিফ্রেশ পোর্টফোলিও অ্যানালাইসিস (ম্যানুয়াল)
// ==========================================
window.refreshPortfolioAnalysis = function() {
    const user = auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    if (isManualReloading) {
        if (typeof showToast === 'function') showToast('Already refreshing...', 'info');
        return;
    }
    // ক্যাশ ক্লিয়ার
    const cacheKey = `analysis_${user.uid}`;
    try { sessionStorage.removeItem(cacheKey); } catch(e) {}
    // ফোর্স রিলোড
    if (typeof loadPortfolioAnalysisTable === 'function') {
        loadPortfolioAnalysisTable(user.uid, true);
        if (typeof showToast === 'function') showToast('🔄 Refreshing portfolio analysis...', 'info');
    }
};
// ==========================================
// ২. পোর্টফোলিও অ্যানালাইসিস টেবিল
// ==========================================
function storePortfolioDataForSorting(dataArray) {
    currentPortfolioData = dataArray;
}

window.sortPortfolioAnalysis = function() {
    if (currentPortfolioData.length === 0) return;
    currentPortfolioSortOrder = currentPortfolioSortOrder === 'asc' ? 'desc' : 'asc';
    const sortedData = [...currentPortfolioData].sort((a, b) => {
        const nameA = a.ticker.toUpperCase(),
            nameB = b.ticker.toUpperCase();
        return currentPortfolioSortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    renderPortfolioAnalysis(sortedData);
};

function renderPortfolioAnalysis(portfolioData) {
    const listContainer = document.getElementById('bull-analysis-list');
    if (!listContainer) return;
    if (portfolioData.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:20px;">No active stocks found.</div>`;
        return;
    }

    let finalHtml = "",
        grandTotalCost = 0,
        grandTotalCurrentValue = 0,
        grandTotalDailyGL = 0,
        grandTotalGL = 0;

    for (const item of portfolioData) {
        const { ticker, avgBuyPrice, totalRemainingQty, totalCost, currentPrice, dailyChange, totalGL, totalGLPcnt,
            totalStockDailyGL, totalStockDailyPcnt, activeLotsForDisplay, livePriceClass, dailyGlClass, totalGlClass,
            blockId, commissionPercent } = item;
        const currentValue = totalRemainingQty * currentPrice;
        const commissionInfo = commissionPercent > 0 ? `<span style="font-size:9px; opacity:0.7;"> (inc. ${commissionPercent}% comm.)</span>` : '';

        finalHtml += `<div class="stock-block" id="parent-${blockId}">
            <div class="stock-main-row" onclick="toggleBullLot('${blockId}'); openStockDetailModal('${ticker}');">
                <div class="bull-col-code">
                    <div class="ticker-title" style="color:#2563eb; text-decoration:underline; cursor:pointer;">${ticker}</div>
                    <div class="${livePriceClass}" style="font-weight:600;">৳${currentPrice.toFixed(2)} <span style="font-size:11px;">(${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)})</span></div>
                    <div style="color:#64748b; font-size:12px;">৳${avgBuyPrice.toFixed(2)}${commissionInfo} x ${totalRemainingQty} shares</div>
                    <span class="toggle-text" id="btn-${blockId}">+ Show All</span>
                </div>
                <div class="bull-col-value">
                    <div>${currentValue.toLocaleString()}</div>
                    <div style="color:#64748b;">${totalCost.toLocaleString()}</div>
                </div>
                <div class="bull-col-daily ${dailyGlClass}">
                    <div>${totalStockDailyGL >= 0 ? '+' : ''}${totalStockDailyGL.toFixed(2)}</div>
                    <div>${totalStockDailyPcnt >= 0 ? '+' : ''}${totalStockDailyPcnt.toFixed(2)}%</div>
                </div>
                <div class="bull-col-total ${totalGlClass}">
                    <div>${totalGL >= 0 ? '+' : ''}${totalGL.toLocaleString()}</div>
                    <div>${totalGLPcnt >= 0 ? '+' : ''}${totalGLPcnt.toFixed(2)}%</div>
                </div>
            </div>
            <div class="lot-rows-container" id="container-${blockId}" style="display:none;">`;

        for (const lot of activeLotsForDisplay) {
            const lotDailyClass = lot.dailyGL >= 0 ? "bull-profit" : "bull-loss";
            const lotTotalClass = lot.totalGL >= 0 ? "bull-profit" : "bull-loss";
            finalHtml += `<div class="stock-lot-row">
                <div class="bull-col-code"><b>৳${lot.buyPrice.toFixed(2)}</b> x ${lot.qty} shares${lot.commission > 0 ? ` <span style="font-size:8px;">(comm: ৳${lot.commission.toFixed(2)})</span>` : ''}</div>
                <div class="bull-col-value"><div>${lot.currentValue.toFixed(2)}</div><div>${lot.cost.toFixed(2)}</div></div>
                <div class="bull-col-daily ${lotDailyClass}"><div>${lot.dailyGL >= 0 ? '+' : ''}${lot.dailyGL.toFixed(2)}</div><div>${lot.dailyGLPcnt.toFixed(2)}%</div></div>
                <div class="bull-col-total ${lotTotalClass}"><div>${lot.totalGL >= 0 ? '+' : ''}${lot.totalGL.toFixed(2)}</div><div>${lot.totalGLPcnt.toFixed(2)}%</div></div>
            </div>`;
        }
        finalHtml += `</div></div>`;

        grandTotalCost += totalCost;
        grandTotalCurrentValue += currentValue;
        grandTotalDailyGL += totalStockDailyGL;
        grandTotalGL += totalGL;
    }

    listContainer.innerHTML = finalHtml;

    const summaryValue = document.getElementById('summary-total-value');
    const summaryCost = document.getElementById('summary-total-cost');
    const summaryDaily = document.getElementById('summary-total-daily');
    const summaryDailyPct = document.getElementById('summary-total-daily-pct');
    const summaryGL = document.getElementById('summary-total-gl');
    const summaryGLPct = document.getElementById('summary-total-gl-pct');

    if (summaryValue) summaryValue.innerHTML = `৳${grandTotalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    if (summaryCost) summaryCost.innerHTML = `৳${grandTotalCost.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    if (summaryDaily) {
        summaryDaily.innerHTML = `${grandTotalDailyGL >= 0 ? '+' : ''}৳${grandTotalDailyGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        summaryDaily.style.color = grandTotalDailyGL >= 0 ? '#10b981' : '#ef4444';
    }
    if (summaryDailyPct && grandTotalCost > 0) {
        const dailyPct = (grandTotalDailyGL / grandTotalCost) * 100;
        summaryDailyPct.innerHTML = `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%`;
        summaryDailyPct.style.color = dailyPct >= 0 ? '#10b981' : '#ef4444';
    }
    if (summaryGL) {
        summaryGL.innerHTML = `${grandTotalGL >= 0 ? '+' : ''}৳${grandTotalGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        summaryGL.style.color = grandTotalGL >= 0 ? '#10b981' : '#ef4444';
    }
    if (summaryGLPct && grandTotalCost > 0) {
        const glPct = (grandTotalGL / grandTotalCost) * 100;
        summaryGLPct.innerHTML = `${glPct >= 0 ? '+' : ''}${glPct.toFixed(2)}%`;
        summaryGLPct.style.color = glPct >= 0 ? '#10b981' : '#ef4444';
    }

    updateDashboardCardsFromAnalysis(grandTotalCost, grandTotalCurrentValue, grandTotalDailyGL, grandTotalGL);
    currentPortfolioTotalValue = grandTotalCurrentValue;
}

function updateDashboardCardsFromAnalysis(totalCost, totalValue, dailyGL, totalGL) {
    const dashValue = document.getElementById('dash-total-value');
    const dashCost = document.getElementById('dash-total-cost');
    const dashDaily = document.getElementById('dash-total-daily');
    const dashDailyPct = document.getElementById('dash-total-daily-pct');
    const dashGL = document.getElementById('dash-total-gl');
    const dashGLPct = document.getElementById('dash-total-gl-pct');

    if (dashValue) dashValue.innerHTML = `৳${totalValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    if (dashCost) dashCost.innerHTML = `৳${totalCost.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    if (dashDaily) {
        dashDaily.innerHTML = `${dailyGL >= 0 ? '+' : ''}৳${dailyGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        dashDaily.style.color = dailyGL >= 0 ? '#90ffb0' : '#ffaaaa';
    }
    if (dashDailyPct && totalCost > 0) {
        const dailyPct = (dailyGL / totalCost) * 100;
        dashDailyPct.innerHTML = `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%`;
        dashDailyPct.style.color = dailyPct >= 0 ? '#90ffb0' : '#ffaaaa';
    }
    if (dashGL) {
        dashGL.innerHTML = `${totalGL >= 0 ? '+' : ''}৳${totalGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        dashGL.style.color = totalGL >= 0 ? '#90ffb0' : '#ffaaaa';
    }
    if (dashGLPct && totalCost > 0) {
        const totalPct = (totalGL / totalCost) * 100;
        dashGLPct.innerHTML = `${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%`;
        dashGLPct.style.color = totalPct >= 0 ? '#90ffb0' : '#ffaaaa';
    }
}

window.toggleBullLot = function(blockId) {
    const container = document.getElementById(`container-${blockId}`);
    const btnText = document.getElementById(`btn-${blockId}`);
    if (!container || !btnText) return;
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        btnText.innerText = "- Hide All";
    } else {
        container.style.display = 'none';
        btnText.innerText = "+ Show All";
    }
};

// ==========================================
// 📊 পোর্টফোলিও অ্যানালাইসিস টেবিল (ডেইলি চেঞ্জ সহ)
// ==========================================
async function loadPortfolioAnalysisTable(userId, forceRefresh = false) {
    if (!userId) return;

    // ক্যাশ চেক (৩০ সেকেন্ড)
    const cacheKey = `analysis_${userId}`;
    let cached = null;
    try {
        const cachedStr = sessionStorage.getItem(cacheKey);
        if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            if (Date.now() - parsed.timestamp < 30000) {
                cached = parsed.data;
            }
        }
    } catch (e) { /* ignore */ }

    if (cached && !forceRefresh) {
        renderPortfolioAnalysis(cached);
        console.log('✅ Portfolio analysis loaded from cache');
        return;
    }

    // আগের ইন্টারভাল ক্লিয়ার
    if (portfolioAnalysisInterval) {
        clearInterval(portfolioAnalysisInterval);
        portfolioAnalysisInterval = null;
    }

async function fetchAndRenderAnalysis(force = false) {
    // লোডিং শুরুতে স্কেলেটন দেখান
    const listContainer = document.getElementById('bull-analysis-list');
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="skeleton" style="width:95%;"></div>
            <div class="skeleton" style="width:85%;"></div>
            <div class="skeleton" style="width:90%;"></div>
            <div class="skeleton" style="width:75%;"></div>
            <div class="skeleton" style="width:88%;"></div>
        `;
    }

    const now = Date.now();
    if (!force && cachedAnalysisData && (now - lastAnalysisTime) < ANALYSIS_CACHE_TTL) {
        renderPortfolioAnalysis(cachedAnalysisData);
        // টাইমস্ট্যাম্প আপডেট
        const timeText = document.getElementById('pa-updated-time-text');
        if (timeText) {
            timeText.innerText = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
        }
        return;
    }
    if (isAnalysisLoading) return;
    isAnalysisLoading = true;

    try {
        console.log('📊 Fetching portfolio analysis...');
        const unifiedData = await unifiedEngine.calculate(userId, force);
        if (!unifiedData || unifiedData.stockDetails.length === 0) {
            if (listContainer) {
                listContainer.innerHTML = `<div style="text-align:center; padding:20px; color: var(--text-muted);">No active stocks found.</div>`;
            }
            return;
        }

        const tickers = unifiedData.stockDetails.map(s => s.ticker);
        const priceDataMap = await getLatestAndPreviousPrices(tickers);

        const portfolioDataForSorting = [];
        let grandTotalCost = 0,
            grandTotalCurrentValue = 0,
            grandTotalDailyGL = 0,
            grandTotalGL = 0,
            grandTotalRemainingQty = 0;
        let globalPreviousDate = null;

        for (const stock of unifiedData.stockDetails) {
            const ticker = stock.ticker;
            const priceData = priceDataMap.get(ticker);
            let currentPrice = priceData?.currentPrice || 0;
            if (currentPrice === 0) {
                currentPrice = await getUnifiedPrice(ticker);
            }
            const currentDate = priceData?.currentDate || null;
            const previousPrice = priceData?.previousPrice || 0;
            const previousDate = priceData?.previousDate || null;

            let dailyChange = 0;
            if (currentPrice > 0 && previousPrice > 0) {
                dailyChange = currentPrice - previousPrice;
            }
            if (previousDate && (!globalPreviousDate || previousDate > globalPreviousDate)) {
                globalPreviousDate = previousDate;
            }

            const totalRemainingQty = stock.totalQty;
            const totalCost = stock.totalCost;
            const avgBuyPrice = stock.avgBuyPriceWithCommission;
            const currentValue = totalRemainingQty * currentPrice;
            const totalGL = currentValue - totalCost;
            const totalGLPcnt = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
            const totalStockDailyGL = totalRemainingQty * dailyChange;
            const totalStockDailyPcnt = (currentPrice - dailyChange) > 0 ? (dailyChange / (currentPrice - dailyChange)) * 100 : 0;

            const activeLotsForDisplay = [];
            for (const lot of stock.lots) {
                const lotCurrentValue = lot.qty * currentPrice;
                const lotTotalGL = lotCurrentValue - lot.totalCost;
                const lotDailyGL = lot.qty * dailyChange;
                const lotGLPcnt = lot.totalCost > 0 ? (lotTotalGL / lot.totalCost) * 100 : 0;
                const lotDailyPcnt = (currentPrice - dailyChange) > 0 ? (dailyChange / (currentPrice - dailyChange)) * 100 : 0;
                activeLotsForDisplay.push({
                    qty: lot.qty,
                    buyPrice: lot.buyPrice,
                    cost: lot.totalCost,
                    currentValue: lotCurrentValue,
                    dailyGL: lotDailyGL,
                    dailyGLPcnt: lotDailyPcnt,
                    totalGL: lotTotalGL,
                    totalGLPcnt: lotGLPcnt,
                    commission: lot.commission || 0
                });
            }

            const livePriceClass = dailyChange >= 0 ? "bull-profit" : "bull-loss";
            const dailyGlClass = totalStockDailyGL >= 0 ? "bull-profit" : "bull-loss";
            const totalGlClass = totalGL >= 0 ? "bull-profit" : "bull-loss";
            const blockId = `block-${ticker.replace(/[^a-zA-Z0-9]/g, '')}`;

            portfolioDataForSorting.push({
                ticker,
                avgBuyPrice,
                totalRemainingQty,
                totalCost,
                currentPrice,
                currentValue,
                dailyChange,
                totalGL,
                totalGLPcnt,
                totalStockDailyGL,
                totalStockDailyPcnt,
                activeLotsForDisplay,
                livePriceClass,
                dailyGlClass,
                totalGlClass,
                blockId,
                commissionPercent: stock.lots[0]?.commissionPercent || 0,
                prevDate: previousDate
            });

            grandTotalCost += totalCost;
            grandTotalCurrentValue += currentValue;
            grandTotalDailyGL += totalStockDailyGL;
            grandTotalGL += totalGL;
            grandTotalRemainingQty += totalRemainingQty;
        }

        cachedAnalysisData = portfolioDataForSorting;
        lastAnalysisTime = now;
        storePortfolioDataForSorting(portfolioDataForSorting);

        const sortedData = [...portfolioDataForSorting].sort((a, b) =>
            a.ticker.toUpperCase().localeCompare(b.ticker.toUpperCase())
        );
        renderPortfolioAnalysis(sortedData);

        // 📌 টাইমস্ট্যাম্প আপডেট
        const timeText = document.getElementById('pa-updated-time-text');
        if (timeText) {
            timeText.innerText = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
        }

        const lastDataElement = document.getElementById('last-data-count');
        if (lastDataElement) {
            lastDataElement.innerText =
                `৳${grandTotalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })} (${grandTotalRemainingQty} shares)`;
        }

        const lastUpdateElement = document.getElementById('last-updated-time');
        if (lastUpdateElement) {
            const lastUpdate = await firebaseDataManager.getLastUpdateTime();
            lastUpdateElement.innerText = lastUpdate ? formatDisplayTime(lastUpdate) : new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
        }

        const prevDateElement = document.getElementById('previous-data-date');
        if (prevDateElement) {
            if (globalPreviousDate) {
                const dateObj = new Date(globalPreviousDate);
                prevDateElement.innerText = dateObj.toLocaleDateString('bn-BD', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } else {
                prevDateElement.innerText = 'No previous data';
            }
        }

        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: portfolioDataForSorting
            }));
        } catch (e) { /* ignore */ }

    } catch (error) {
        console.error('Analysis error:', error);
        if (listContainer) {
            listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:red;">Error loading data</div>`;
        }
    } finally {
        isAnalysisLoading = false;
    }
}

    // প্রথমবার লোড (স্কেলেটন ভেতর থেকে দেখাবে)
    await fetchAndRenderAnalysis(true);

    // প্রতি ১০ মিনিটে রিফ্রেশ
    portfolioAnalysisInterval = setInterval(() => fetchAndRenderAnalysis(false), 600000);
    console.log('✅ Portfolio analysis auto-refresh set to 10 minutes');
}
// ==========================================
// ৩. পোর্টফোলিও হিস্টোরি (Value History) - Firebase
// ==========================================
async function loadPortfolioHistory() {
    const user = auth.currentUser;
    if (!user) { console.log('No user'); return; }
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;

    try {
        console.log('📊 Loading portfolio history...');
        let portfolioSnapshot, salesSnapshot;
        if (typeof db !== 'undefined') {
            portfolioSnapshot = await db.collection('portfolios').where('userId', '==', user.uid).get();
            salesSnapshot = await db.collection('sales_history').where('userId', '==', user.uid).get();
        } else {
            tableBody.innerHTML = `<tr><td colspan="6">Firebase not available</td></tr>`;
            return;
        }

        if (portfolioSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="6">No transactions found. Start buying shares!</td></tr>`;
            return;
        }

        const buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            const totalCostWithCommission = (data.quantity * data.buyPrice) + (data.commission || 0);
            let perUnitCost = totalCostWithCommission / data.quantity;
            if (isNaN(perUnitCost) || !isFinite(perUnitCost)) perUnitCost = data.buyPrice;
            let buyDate = null;
            if (data.date) {
                if (typeof data.date.toDate === 'function') buyDate = data.date.toDate();
                else if (data.date instanceof Date) buyDate = data.date;
                else if (typeof data.date === 'string') buyDate = new Date(data.date);
                else if (data.date.seconds) buyDate = new Date(data.date.seconds * 1000);
            }
            if (!buyDate || isNaN(buyDate.getTime())) buyDate = new Date();
            buyLots.push({
                ticker: data.shareName,
                qty: data.quantity,
                buyPrice: data.buyPrice,
                totalCostWithCommission,
                perUnitCost,
                date: buyDate,
                buyDateStr: buyDate.toISOString().split('T')[0]
            });
        });

        let firstBuyDate = new Date(buyLots[0].date);
        for (const lot of buyLots) if (lot.date < firstBuyDate) firstBuyDate = lot.date;

        const totalSoldMap = new Map();
        salesSnapshot.forEach(doc => {
            const data = doc.data();
            totalSoldMap.set(data.shareName, (totalSoldMap.get(data.shareName) || 0) + data.quantitySold);
        });

        buyLots.sort((a, b) => a.date - b.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let daysDiff = Math.ceil((today - firstBuyDate) / (1000 * 60 * 60 * 24));
        if (daysDiff < 1) daysDiff = 1;
        const maxDays = 365;
        const finalDays = Math.min(daysDiff, maxDays);

        const allDates = [];
        for (let i = 0; i <= finalDays; i++) {
            const date = new Date(firstBuyDate);
            date.setDate(firstBuyDate.getDate() + i);
            allDates.push(date);
        }

        const dailyPortfolio = [];
        let cumulativeLots = [];

        for (let idx = 0; idx < allDates.length; idx++) {
            const currentDate = allDates[idx];
            const dateStr = currentDate.toISOString().split('T')[0];

            for (const lot of buyLots) {
                const lotDate = new Date(lot.date);
                lotDate.setHours(0, 0, 0, 0);
                if (lotDate <= currentDate && !lot.added) {
                    cumulativeLots.push({ ...lot, remainingQty: lot.qty, added: true });
                    lot.added = true;
                }
            }
            const tempSoldMap = new Map(totalSoldMap);
            let tempLots = cumulativeLots.map(lot => ({ ...lot, remainingQty: lot.remainingQty }));
            for (const lot of tempLots) {
                let toSell = tempSoldMap.get(lot.ticker) || 0;
                if (toSell > 0 && lot.remainingQty > 0) {
                    const taken = Math.min(lot.remainingQty, toSell);
                    lot.remainingQty -= taken;
                    toSell -= taken;
                    tempSoldMap.set(lot.ticker, toSell);
                }
            }

            let totalInvestment = 0;
            const remainingStocks = [];
            for (const lot of tempLots) {
                if (lot.remainingQty > 0 && lot.perUnitCost > 0 && isFinite(lot.perUnitCost)) {
                    totalInvestment += lot.remainingQty * lot.perUnitCost;
                    remainingStocks.push({
                        ticker: lot.ticker,
                        qty: lot.remainingQty,
                        avgCost: lot.perUnitCost
                    });
                }
            }

            let totalCurrentValue = 0;
            for (const stock of remainingStocks) {
                let currentPrice = 0;
                if (currentHistoryMode === 'live') {
                    try {
                        const res = await fetch(`${SCRAPER_BASE_URL}?symbol=${stock.ticker}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.ltp) currentPrice = data.ltp;
                        }
                    } catch (e) { /* ignore */ }
                }
                if (currentPrice === 0) {
                    const historicalPrice = await firebaseDataManager.getPriceByDate(stock.ticker, dateStr);
                    currentPrice = historicalPrice || stock.avgCost;
                }
                if (isNaN(currentPrice) || !isFinite(currentPrice)) currentPrice = stock.avgCost;
                totalCurrentValue += stock.qty * currentPrice;
            }

            if (totalInvestment > 0 && isFinite(totalInvestment)) {
                dailyPortfolio.push({
                    date: dateStr,
                    totalInvestment,
                    totalCurrentValue,
                    dailyPL: totalCurrentValue - totalInvestment,
                    dailyPLPercent: ((totalCurrentValue - totalInvestment) / totalInvestment) * 100
                });
            }
        }

        const startDateInput = document.getElementById('history-start-date');
        const endDateInput = document.getElementById('history-end-date');
        let filteredData = [...dailyPortfolio];
        if (startDateInput && startDateInput.value) filteredData = filteredData.filter(item => item.date >= startDateInput.value);
        if (endDateInput && endDateInput.value) filteredData = filteredData.filter(item => item.date <= endDateInput.value);

        currentHistoryData = filteredData;
        renderHistoryTable(filteredData);
        renderHistoryChart(filteredData);

    } catch (error) {
        console.error(error);
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
    if (historyChartInstance) historyChartInstance.destroy();
    if (data.length === 0) return;

    const labels = data.map(item => formatDateShort(item.date));
    const investData = data.map(item => item.totalInvestment);
    const valueData = data.map(item => item.totalCurrentValue);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    historyChartInstance = new Chart(canvas, {
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

// ==========================================
// 📈 পোর্টফোলিও টাইমলাইন ডেটা
// ==========================================
async function fetchPortfolioTimelineData(startDate = null, endDate = null) {
    const user = auth.currentUser;
    if (!user) return [];

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const defaultStart = thirtyDaysAgo.toISOString().split('T')[0];
    const defaultEnd = today.toISOString().split('T')[0];

    const start = startDate || defaultStart;
    const end = endDate || defaultEnd;

    const cacheKey = `timeline_${user.uid}_${start}_${end}`;
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 1800000) {
                return parsed.data;
            }
        }
    } catch (e) { /* ignore */ }

    if (typeof db === 'undefined') return [];

    const portfolioSnapshot = await db.collection('portfolios').where('userId', '==', user.uid).get();
    const salesSnapshot = await db.collection('sales_history').where('userId', '==', user.uid).get();
    if (portfolioSnapshot.empty) return [];

    const buyLots = [];
    portfolioSnapshot.forEach(doc => {
        const data = doc.data();
        const totalCostWithCommission = (data.quantity * data.buyPrice) + (data.commission || 0);
        let perUnitCost = totalCostWithCommission / data.quantity;
        if (isNaN(perUnitCost) || !isFinite(perUnitCost)) perUnitCost = data.buyPrice;
        let buyDate = null;
        if (data.date) {
            if (typeof data.date.toDate === 'function') buyDate = data.date.toDate();
            else if (data.date instanceof Date) buyDate = data.date;
            else if (typeof data.date === 'string') buyDate = new Date(data.date);
            else if (data.date.seconds) buyDate = new Date(data.date.seconds * 1000);
        }
        if (!buyDate || isNaN(buyDate.getTime())) buyDate = new Date();
        buyLots.push({
            ticker: data.shareName,
            qty: data.quantity,
            buyPrice: data.buyPrice,
            perUnitCost: perUnitCost,
            date: buyDate,
            buyDateStr: buyDate.toISOString().split('T')[0]
        });
    });

    const totalSoldMap = new Map();
    salesSnapshot.forEach(doc => {
        const data = doc.data();
        totalSoldMap.set(data.shareName, (totalSoldMap.get(data.shareName) || 0) + data.quantitySold);
    });

    buyLots.sort((a, b) => a.date - b.date);
    const firstBuyDate = buyLots[0].date;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    let daysDiff = Math.ceil((currentDate - firstBuyDate) / (1000 * 60 * 60 * 24));
    if (daysDiff < 1) daysDiff = 1;
    const finalDays = Math.min(daysDiff, 365);

    const allDates = [];
    for (let i = 0; i <= finalDays; i++) {
        const date = new Date(firstBuyDate);
        date.setDate(firstBuyDate.getDate() + i);
        allDates.push(date);
    }

    const startObj = new Date(start);
    const endObj = new Date(end);
    startObj.setHours(0, 0, 0, 0);
    endObj.setHours(23, 59, 59, 999);

    const dailyPortfolio = [];
    let cumulativeLots = [];

    for (let idx = 0; idx < allDates.length; idx++) {
        const currentDateObj = allDates[idx];
        const dateStr = currentDateObj.toISOString().split('T')[0];

        for (const lot of buyLots) {
            const lotDate = new Date(lot.date);
            lotDate.setHours(0, 0, 0, 0);
            if (lotDate <= currentDateObj && !lot.added) {
                cumulativeLots.push({ ...lot, remainingQty: lot.qty, added: true });
                lot.added = true;
            }
        }

        const tempSoldMap = new Map(totalSoldMap);
        let tempLots = cumulativeLots.map(lot => ({ ...lot, remainingQty: lot.remainingQty }));
        for (const lot of tempLots) {
            let toSell = tempSoldMap.get(lot.ticker) || 0;
            if (toSell > 0 && lot.remainingQty > 0) {
                const taken = Math.min(lot.remainingQty, toSell);
                lot.remainingQty -= taken;
                toSell -= taken;
                tempSoldMap.set(lot.ticker, toSell);
            }
        }

        let totalInvestment = 0;
        const remainingStocks = [];
        for (const lot of tempLots) {
            if (lot.remainingQty > 0 && lot.perUnitCost > 0 && isFinite(lot.perUnitCost)) {
                totalInvestment += lot.remainingQty * lot.perUnitCost;
                remainingStocks.push({
                    ticker: lot.ticker,
                    qty: lot.remainingQty,
                    avgCost: lot.perUnitCost
                });
            }
        }

        let totalCurrentValue = 0;
        for (const stock of remainingStocks) {
            let currentPrice = 0;
            if (currentHistoryMode === 'live') {
                try {
                    const res = await fetch(`${SCRAPER_BASE_URL}?symbol=${stock.ticker}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.ltp) currentPrice = data.ltp;
                    }
                } catch (e) { /* ignore */ }
            }
            if (currentPrice === 0) {
                const historicalPrice = await firebaseDataManager.getPriceByDate(stock.ticker, dateStr);
                currentPrice = historicalPrice || stock.avgCost;
            }
            if (isNaN(currentPrice) || !isFinite(currentPrice)) currentPrice = stock.avgCost;
            totalCurrentValue += stock.qty * currentPrice;
        }

        if (totalInvestment > 0 && isFinite(totalInvestment)) {
            dailyPortfolio.push({
                date: dateStr,
                totalInvestment,
                totalCurrentValue,
                dailyPL: totalCurrentValue - totalInvestment,
                dailyPLPercent: ((totalCurrentValue - totalInvestment) / totalInvestment) * 100
            });
        }
    }

    const filteredResult = dailyPortfolio.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= startObj && itemDate <= endObj;
    });

    try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: filteredResult
        }));
    } catch (e) { /* ignore */ }

    return filteredResult;
}

// ==========================================
// 🖥️ ড্যাশবোর্ড চার্ট রেন্ডার
// ==========================================
async function renderDashboardHistoryChart(startDate = null, endDate = null) {
    const canvas = document.getElementById('dashboardHistoryChart');
    if (!canvas) return;

    const parent = canvas.parentElement;
    let loadingDiv = document.getElementById('chart-loading-placeholder');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'chart-loading-placeholder';
        loadingDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; justify-content: center; align-items: center;
            color: var(--text-muted); font-size: 14px; z-index: 10;
            background: var(--bg-secondary); border-radius: 12px;
        `;
        loadingDiv.innerHTML = '⏳ Loading portfolio history...';
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(loadingDiv);
        }
    } else {
        loadingDiv.style.display = 'flex';
        loadingDiv.innerHTML = '⏳ Loading portfolio history...';
    }

    try {
        const historyData = await fetchPortfolioTimelineData(startDate, endDate);
        if (!historyData || historyData.length === 0) {
            if (loadingDiv) loadingDiv.innerHTML = '📭 No history data available';
            return;
        }

        let displayData = historyData;
        if (historyData.length > 100) {
            const step = Math.ceil(historyData.length / 100);
            displayData = historyData.filter((_, index) => index % step === 0);
        }

        const labels = displayData.map(item => item.date);
        const investData = displayData.map(item => item.totalInvestment);
        const valueData = displayData.map(item => item.totalCurrentValue);

        if (loadingDiv) loadingDiv.remove();

        if (dashboardChartInstance) dashboardChartInstance.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        dashboardChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Total Investment', data: investData, borderColor: '#3b82f6', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.2, fill: false, pointRadius: 2 },
                    { label: 'Current Value', data: valueData, borderColor: '#10b981', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.2, fill: false, pointRadius: 2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: textColor } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ৳${ctx.raw.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: textColor, maxRotation: 45 }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: (v) => '৳' + v.toLocaleString() }, grid: { color: gridColor } }
                }
            }
        });

    } catch (error) {
        console.error('Chart render error:', error);
        if (loadingDiv) loadingDiv.innerHTML = '❌ Failed to load chart';
    }
}

// ==========================================
// 🖥️ ড্যাশবোর্ড চার্ট রেন্ডার (Daily P&L)
// ==========================================
async function renderDashboardDailyPLChart(startDate = null, endDate = null) {
    const canvas = document.getElementById('dashboardDailyPLChart');
    if (!canvas) return;

    const parent = canvas.parentElement;
    let loadingDiv = document.getElementById('daily-pl-chart-loading');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'daily-pl-chart-loading';
        loadingDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; justify-content: center; align-items: center;
            color: var(--text-muted); font-size: 14px; z-index: 10;
            background: var(--bg-secondary); border-radius: 12px;
        `;
        loadingDiv.innerHTML = '⏳ Loading daily P&L...';
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(loadingDiv);
        }
    } else {
        loadingDiv.style.display = 'flex';
        loadingDiv.innerHTML = '⏳ Loading daily P&L...';
    }

    try {
        const historyData = await fetchPortfolioTimelineData(startDate, endDate);
        if (!historyData || historyData.length === 0) {
            if (loadingDiv) loadingDiv.innerHTML = '📭 No history data available';
            return;
        }

        const labels = historyData.map(item => item.date);
        const dailyPLData = historyData.map(item => item.dailyPL);

        let displayLabels = labels;
        let displayPL = dailyPLData;
        if (labels.length > 100) {
            const step = Math.ceil(labels.length / 100);
            displayLabels = labels.filter((_, index) => index % step === 0);
            displayPL = dailyPLData.filter((_, index) => index % step === 0);
        }

        if (loadingDiv) loadingDiv.remove();

        if (window.dailyPLChartInstance) {
            window.dailyPLChartInstance.destroy();
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const ctx = canvas.getContext('2d');
        window.dailyPLChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets: [{
                    label: 'Daily P&L (৳)',
                    data: displayPL,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.2,
                    fill: true,
                    pointRadius: 2,
                    pointBackgroundColor: '#8b5cf6',
                    segment: {
                        borderColor: (ctx) => {
                            const value = ctx.p0.parsed.y;
                            return value >= 0 ? '#10b981' : '#ef4444';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: textColor } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                return `Daily P&L: ${val >= 0 ? '+' : ''}৳${val.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: textColor, maxRotation: 45 }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: (v) => '৳' + v.toFixed(0) }, grid: { color: gridColor } }
                }
            }
        });

    } catch (error) {
        console.error('Daily PL chart error:', error);
        if (loadingDiv) loadingDiv.innerHTML = '❌ Failed to load chart';
    }
}

// ==========================================
// 📅 ড্যাশবোর্ড ডেট ফিল্টার অ্যাপ্লাই
// ==========================================
window.applyDashboardDateFilter = function() {
    const start = document.getElementById('dash-chart-start')?.value;
    const end = document.getElementById('dash-chart-end')?.value;
    if (start && end) {
        renderDashboardChartsWithRange(start, end);
    } else {
        if (typeof showToast === 'function') showToast('Please select both dates.', 'warning');
    }
};

window.resetDashboardDateFilter = function() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const start = thirtyDaysAgo.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];
    const startInput = document.getElementById('dash-chart-start');
    const endInput = document.getElementById('dash-chart-end');
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    renderDashboardChartsWithRange(start, end);
};

async function renderDashboardChartsWithRange(start, end) {
    const historyData = await fetchPortfolioTimelineData(start, end);
    if (!historyData || historyData.length === 0) {
        if (typeof showToast === 'function') showToast('No data in selected range.', 'warning');
        return;
    }
    await renderDashboardHistoryChart(start, end);
    await renderDashboardDailyPLChart(start, end);
}

// ==========================================
// 💰 Total Income & Deposit Management
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
        console.error('Error getting deposit:', e);
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

async function getTotalRealizedProfit(userId) {
    if (!userId) return 0;
    try {
        if (typeof db === 'undefined') return 0;
        const snapshot = await db.collection('sales_history')
            .where('userId', '==', userId)
            .get();
        let total = 0;
        snapshot.forEach(doc => {
            total += (doc.data().profitOrLoss || 0);
        });
        return total;
    } catch (e) {
        console.error('Error getting realized profit:', e);
        return 0;
    }
}

async function updateTotalIncomeCard() {
    const user = auth.currentUser;
    if (!user) {
        console.warn('⚠️ updateTotalIncomeCard: No user logged in');
        return;
    }

    try {
        const deposit = await getUserDeposit(user.uid);
        const unifiedData = await unifiedEngine.calculate(user.uid, true);
        let totalCurrentValue = 0;

        if (unifiedData && unifiedData.stockDetails.length > 0) {
            const tickers = unifiedData.stockDetails.map(s => s.ticker);
            const pricePromises = tickers.map(t => getUnifiedPrice(t));
            const currentPrices = await Promise.all(pricePromises);

            for (let i = 0; i < unifiedData.stockDetails.length; i++) {
                const stock = unifiedData.stockDetails[i];
                const price = currentPrices[i] || 0;
                totalCurrentValue += stock.totalQty * price;
            }
        }

        const totalIncome = totalCurrentValue - deposit;
        const profitPercent = deposit > 0 ? (totalIncome / deposit) * 100 : 0;

        const incomeElem = document.getElementById('dash-total-income');
        const pctElem = document.getElementById('dash-total-income-pct');

        if (incomeElem) {
            incomeElem.innerText = `৳${totalIncome.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
            incomeElem.style.color = totalIncome >= 0 ? '#90ffb0' : '#ffaaaa';
        }
        if (pctElem) {
            pctElem.innerText = `(${totalIncome >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`;
            pctElem.style.color = totalIncome >= 0 ? '#90ffb0' : '#ffaaaa';
        }

        console.log('✅ Total Income updated (Current Value - Deposit):', { totalCurrentValue, deposit, totalIncome });

    } catch (error) {
        console.error('❌ Error in updateTotalIncomeCard:', error);
    }
}

window.openDepositModal = async function() {
    const user = auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    const modal = document.getElementById('deposit-modal');
    if (!modal) return;

    try {
        const deposit = await getUserDeposit(user.uid);
        const unifiedData = await unifiedEngine.calculate(user.uid, true);
        let totalCurrentValue = 0;
        if (unifiedData && unifiedData.stockDetails.length > 0) {
            const tickers = unifiedData.stockDetails.map(s => s.ticker);
            const pricePromises = tickers.map(t => getUnifiedPrice(t));
            const currentPrices = await Promise.all(pricePromises);
            for (let i = 0; i < unifiedData.stockDetails.length; i++) {
                const stock = unifiedData.stockDetails[i];
                totalCurrentValue += stock.totalQty * (currentPrices[i] || 0);
            }
        }

        const totalIncome = totalCurrentValue - deposit;
        const profitPercent = deposit > 0 ? (totalIncome / deposit) * 100 : 0;

        const depositInput = document.getElementById('deposit-input');
        const realizedProfit = document.getElementById('deposit-realized-profit');
        const totalIncomeElem = document.getElementById('deposit-total-income');
        const incomePctElem = document.getElementById('deposit-income-pct');

        if (depositInput) depositInput.value = deposit;
        if (realizedProfit) realizedProfit.innerHTML = `৳${totalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        if (totalIncomeElem) totalIncomeElem.innerHTML = `৳${totalIncome.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        if (incomePctElem) incomePctElem.innerText = `${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%`;

        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const defaultStart = thirtyDaysAgo.toISOString().split('T')[0];
        const defaultEnd = today.toISOString().split('T')[0];
        const startInput = document.getElementById('income-chart-start');
        const endInput = document.getElementById('income-chart-end');
        if (startInput) startInput.value = defaultStart;
        if (endInput) endInput.value = defaultEnd;

        await loadIncomeChartAndTable(user.uid, defaultStart, defaultEnd);

        modal.style.display = 'flex';

    } catch (error) {
        console.error('❌ Error opening deposit modal:', error);
        if (typeof showToast === 'function') showToast('Error loading data', 'error');
    }
};

window.closeDepositModal = function() {
    const modal = document.getElementById('deposit-modal');
    if (modal) modal.style.display = 'none';
};

async function getDailyIncomeData(userId) {
    if (!userId) return [];
    try {
        let salesData = [];
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data } = await supabase
                    .from('sales_history')
                    .select('profit_or_loss, date')
                    .eq('user_id', userId);
                if (data) salesData = data;
            } catch (e) { /* ignore */ }
        }
        if (salesData.length === 0 && typeof db !== 'undefined') {
            const snapshot = await db.collection('sales_history')
                .where('userId', '==', userId)
                .get();
            snapshot.forEach(doc => {
                const data = doc.data();
                salesData.push({
                    profit_or_loss: data.profitOrLoss || 0,
                    date: data.date?.toDate?.()?.toISOString?.() || new Date().toISOString()
                });
            });
        }

        const dailyMap = new Map();
        salesData.forEach(item => {
            const date = new Date(item.date);
            const dateStr = date.toISOString().split('T')[0];
            const profit = item.profit_or_loss || 0;
            dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + profit);
        });

        const sortedDates = Array.from(dailyMap.keys()).sort();
        const result = [];
        let cumulative = 0;
        for (const date of sortedDates) {
            const daily = dailyMap.get(date);
            cumulative += daily;
            result.push({ date, daily, cumulative });
        }
        return result;
    } catch (e) {
        console.error('Error fetching daily income:', e);
        return [];
    }
}

async function loadIncomeChartAndTable(userId, startDate = null, endDate = null) {
    const tbody = document.getElementById('income-history-tbody');
    const canvas = document.getElementById('incomeHistoryChart');
    if (!tbody || !canvas) return;

    try {
        let dailyData = await getDailyIncomeData(userId);
        if (!dailyData || dailyData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--text-muted);">No sales history found. Start selling to see income growth!</td></tr>`;
            return;
        }

        if (startDate && endDate) {
            const startObj = new Date(startDate);
            const endObj = new Date(endDate);
            startObj.setHours(0, 0, 0, 0);
            endObj.setHours(23, 59, 59, 999);
            dailyData = dailyData.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= startObj && itemDate <= endObj;
            });
        }

        let html = '';
        for (const item of dailyData) {
            html += `<tr>
                <td style="padding:4px 8px;">${item.date}</td>
                <td style="padding:4px 8px; text-align:right;">${item.daily >= 0 ? '+' : ''}৳${item.daily.toFixed(2)}</td>
                <td style="padding:4px 8px; text-align:right; font-weight:600;">৳${item.cumulative.toFixed(2)}</td>
            </tr>`;
        }
        tbody.innerHTML = html;

        const labels = dailyData.map(d => d.date);
        const cumulativeData = dailyData.map(d => d.cumulative);

        if (window.incomeChartInstance) {
            window.incomeChartInstance.destroy();
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const ctx = canvas.getContext('2d');
        window.incomeChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cumulative Income (৳)',
                    data: cumulativeData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 3,
                    pointBackgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `Cumulative Income: ৳${ctx.raw.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: textColor, maxRotation: 45, font: { size: 9 } }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: (v) => '৳' + v.toFixed(0) }, grid: { color: gridColor } }
                }
            }
        });
    } catch (error) {
        console.error('Error loading income chart:', error);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:red;">Error loading data: ${error.message}</td></tr>`;
    }
}

window.saveDeposit = async function() {
    const user = auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    const input = document.getElementById('deposit-input');
    if (!input) return;
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount < 0) {
        if (typeof showToast === 'function') showToast('Please enter a valid deposit amount.', 'warning');
        return;
    }
    try {
        await updateUserDeposit(user.uid, amount);
        if (typeof showToast === 'function') showToast('Deposit updated successfully!', 'success');
        closeDepositModal();
        await updateTotalIncomeCard();
    } catch (e) {
        if (typeof showToast === 'function') showToast('Failed to update deposit.', 'error');
    }
};

// ==========================================
// 📈 DSEX Indicator - dse_market_data থেকে
// ==========================================
async function updateDSEXIndicator() {
    try {
        console.log('🔄 Fetching DSEX data from dse_market_data...');

        if (typeof db === 'undefined') {
            console.warn('Firebase not available');
            return;
        }

        let dsexValue = null;
        let dsexDate = null;

        const snapshot = await db.collection('dse_market_data')
            .orderBy('date', 'desc')
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const dsexStr = data.dsex_index || '0';
            dsexValue = parseFloat(dsexStr.replace(/,/g, ''));
            dsexDate = data.date;
        }

        const valueElem = document.getElementById('dsex-value');
        const changeElem = document.getElementById('dsex-change');

        if (dsexValue !== null && !isNaN(dsexValue) && dsexValue > 0 && valueElem) {
            valueElem.innerText = dsexValue.toFixed(2);

            let prevValue = null;
            try {
                const prevSnapshot = await db.collection('dse_market_data')
                    .orderBy('date', 'desc')
                    .limit(2)
                    .get();
                if (prevSnapshot.docs.length > 1) {
                    const prevData = prevSnapshot.docs[prevSnapshot.docs.length - 1].data();
                    const prevStr = prevData.dsex_index || '0';
                    prevValue = parseFloat(prevStr.replace(/,/g, ''));
                }
            } catch (e) { /* ignore */ }

            if (prevValue && prevValue > 0 && changeElem) {
                const pointChange = dsexValue - prevValue;
                const percentChange = (pointChange / prevValue) * 100;
                const sign = pointChange >= 0 ? '+' : '';
                const color = pointChange >= 0 ? '#90ffb0' : '#ffaaaa';
                changeElem.innerHTML = `
                    <span style="color: ${color}; font-weight: bold;">
                        ${sign}${pointChange.toFixed(2)}
                    </span>
                    <span style="color: ${color}; font-weight: bold; margin-left: 6px;">
                        (${sign}${percentChange.toFixed(2)}%)
                    </span>
                `;
                changeElem.style.color = color;
            } else if (changeElem) {
                changeElem.innerHTML = 'N/A (no previous)';
                changeElem.style.color = '#94a3b8';
            }
        } else {
            if (valueElem) valueElem.innerText = '--';
            if (changeElem) {
                changeElem.innerHTML = 'No data';
                changeElem.style.color = '#94a3b8';
            }
        }

        const statusElem = document.getElementById('market-status');
        if (statusElem) {
            statusElem.innerHTML = '🟢 Market Open';
            statusElem.style.color = '#90ffb0';
        }

        const lastUpdatedElem = document.getElementById('dsex-last-updated');
        if (lastUpdatedElem && dsexDate) {
            lastUpdatedElem.innerHTML = `Last updated: ${new Date(dsexDate).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })}`;
        }

    } catch (err) {
        console.error('❌ DSEX Indicator error:', err);
        const valueElem = document.getElementById('dsex-value');
        if (valueElem) valueElem.innerText = 'Error';
        const changeElem = document.getElementById('dsex-change');
        if (changeElem) changeElem.innerHTML = '--';
    }
}

// ==========================================
// 🔄 অটো-রিফ্রেশ ও ম্যানুয়াল রিলোড
// ==========================================
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
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

    // প্রতি সেকেন্ডে টাইমার কমানো
    const timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            timeLeft = REFRESH_INTERVAL / 1000;
        }
        updateTimer();
    }, 1000);

    // মূল রিফ্রেশ ইন্টারভাল
    autoRefreshInterval = setInterval(() => {
        if (!document.hidden && currentDataMode === 'firebase' && auth.currentUser) {
            console.log('🔄 Auto-refreshing dashboard...');
            loadDashboardData();
            timeLeft = REFRESH_INTERVAL / 1000;
            updateTimer();
        }
    }, REFRESH_INTERVAL);
    
    updateTimer();
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

async function manualReloadDashboard() {
    const user = auth.currentUser;
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

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (auth.currentUser) manualReloadDashboard();
    }
});

function initAutoRefreshToggle() {
    const toggle = document.getElementById('autoRefreshToggle');
    if (!toggle) return;
    toggle.addEventListener('change', (e) => {
        autoRefreshEnabled = e.target.checked;
        if (autoRefreshEnabled) startAutoRefresh();
        else stopAutoRefresh();
    });
}

let visibilityTimeout = null;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (visibilityTimeout) clearTimeout(visibilityTimeout);
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    } else {
        visibilityTimeout = setTimeout(() => {
            if (autoRefreshEnabled && currentDataMode === 'firebase') startAutoRefresh();
        }, 2000);
        updateTimestamp();
    }
});

window.syncPortfolioAnalysis = function() {
    if (!auth.currentUser) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    if (typeof showToast === 'function') showToast('Syncing portfolio data...', 'info');
    if (currentDataMode === 'firebase') {
        // firebaseDataManager.loadLatestPrices may not exist; fallback
        if (typeof firebaseDataManager.loadLatestPrices === 'function') {
            firebaseDataManager.loadLatestPrices().then(prices => {
                if (prices) {
                    currentPriceData = prices;
                    setTimeout(() => loadPortfolioAnalysisTable(auth.currentUser.uid), 100);
                }
            });
        } else {
            setTimeout(() => loadPortfolioAnalysisTable(auth.currentUser.uid), 100);
        }
    } else {
        // loadFromAPI may not be defined; fallback
        if (typeof loadFromAPI === 'function') {
            loadFromAPI(auth.currentUser).then(prices => {
                if (prices) {
                    currentPriceData = prices;
                    setTimeout(() => loadPortfolioAnalysisTable(auth.currentUser.uid), 100);
                }
            });
        } else {
            setTimeout(() => loadPortfolioAnalysisTable(auth.currentUser.uid), 100);
        }
    }
};

function updateTimestamp() {
    const timestampElem = document.getElementById('update-timestamp');
    if (timestampElem) {
        const mode = currentDataMode === 'firebase' ? 'Firebase Cache' : 'Live API';
        if (currentDataMode === 'firebase') {
            firebaseDataManager.getLastUpdateTime().then(lastUpdate => {
                if (lastUpdate && timestampElem) {
                    timestampElem.innerHTML = `🔄 Data source: ${mode} | Last scraped: ${formatDisplayTime(lastUpdate)} (BD Time)`;
                } else if (timestampElem) {
                    timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
                }
            }).catch(() => {
                if (timestampElem) {
                    timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
                }
            });
        } else {
            timestampElem.innerHTML = `🔄 Last updated: ${formatDisplayTime(new Date())} (${mode})`;
        }
    }
}

function showDataLoading(isLoading) {
    const btnFirebase = document.getElementById('btn-firebase-mode');
    const btnLive = document.getElementById('btn-live-mode');
    if (btnFirebase) btnFirebase.disabled = isLoading;
    if (btnLive) btnLive.disabled = isLoading;
}

// ==========================================
// 📈 Performance Summary
// ==========================================
async function updatePerformanceSummary() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const timelineData = await fetchPortfolioTimelineData();
        if (!timelineData || timelineData.length === 0) {
            console.warn('No timeline data available');
            return;
        }

        const latest = timelineData[timelineData.length - 1];
        const latestValue = latest.totalCurrentValue;

        const portfolioReturns = { today: 0, '5d': null, '15d': null, '30d': null, '3m': null, '6m': null, '1y': null };
        const periods = [
            { name: 'today', days: 0 },
            { name: '5d', days: 5 },
            { name: '15d', days: 15 },
            { name: '30d', days: 30 },
            { name: '3m', days: 90 },
            { name: '6m', days: 180 },
            { name: '1y', days: 365 }
        ];

        for (const period of periods) {
            if (period.days === 0) {
                const yesterday = timelineData[timelineData.length - 2];
                if (yesterday && yesterday.totalCurrentValue > 0) {
                    portfolioReturns.today = ((latestValue - yesterday.totalCurrentValue) / yesterday.totalCurrentValue) * 100;
                }
                continue;
            }

            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - period.days);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            let pastData = null;
            for (let i = timelineData.length - 1; i >= 0; i--) {
                if (timelineData[i].date <= targetDateStr) {
                    pastData = timelineData[i];
                    break;
                }
            }
            if (pastData && pastData.totalCurrentValue > 0) {
                portfolioReturns[period.name] = ((latestValue - pastData.totalCurrentValue) / pastData.totalCurrentValue) * 100;
            }
        }

        // Benchmark (DSEX)
        let benchmarkReturns = { today: 0, '5d': null, '15d': null, '30d': null, '3m': null, '6m': null, '1y': null };
        try {
            if (typeof db !== 'undefined') {
                const snapshot = await db.collection('dse_market_data')
                    .orderBy('date', 'asc')
                    .get();

                if (!snapshot.empty) {
                    const dsexData = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const dateStr = data.date;
                        const dsexStr = data.dsex_index || '0';
                        const dsexValue = parseFloat(dsexStr.replace(/,/g, ''));
                        if (dsexValue && !isNaN(dsexValue) && dsexValue > 0) {
                            dsexData.push({
                                date: new Date(dateStr),
                                value: dsexValue
                            });
                        }
                    });

                    if (dsexData.length > 0) {
                        dsexData.sort((a, b) => a.date - b.date);
                        const latestDSEX = dsexData[dsexData.length - 1].value;

                        if (dsexData.length >= 2) {
                            const yesterdayDSEX = dsexData[dsexData.length - 2].value;
                            if (yesterdayDSEX > 0) {
                                benchmarkReturns.today = ((latestDSEX - yesterdayDSEX) / yesterdayDSEX) * 100;
                            }
                        }

                        for (const period of periods) {
                            if (period.days === 0) continue;
                            const targetDate = new Date();
                            targetDate.setDate(targetDate.getDate() - period.days);
                            let pastDSEX = null;
                            for (let i = dsexData.length - 1; i >= 0; i--) {
                                if (dsexData[i].date <= targetDate) {
                                    pastDSEX = dsexData[i].value;
                                    break;
                                }
                            }
                            if (pastDSEX && pastDSEX > 0) {
                                benchmarkReturns[period.name] = ((latestDSEX - pastDSEX) / pastDSEX) * 100;
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('DSEX benchmark error:', err);
        }

        // UI আপডেট
        const updateCell = (id, value) => {
            const elem = document.getElementById(id);
            if (elem && value !== null && !isNaN(value) && isFinite(value)) {
                elem.innerHTML = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
                elem.style.color = value >= 0 ? '#10b981' : '#ef4444';
            } else if (elem) {
                elem.innerHTML = '-';
                elem.style.color = '#64748b';
            }
        };

        const updateDiffCell = (id, port, bench) => {
            const elem = document.getElementById(id);
            if (elem && port !== null && bench !== null && !isNaN(port) && !isNaN(bench) && isFinite(port) && isFinite(bench)) {
                const diff = port - bench;
                elem.innerHTML = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`;
                elem.style.color = diff >= 0 ? '#10b981' : '#ef4444';
            } else if (elem) {
                elem.innerHTML = '-';
                elem.style.color = '#64748b';
            }
        };

        updateCell('dash-perf-today', portfolioReturns.today);
        updateCell('dash-perf-5d', portfolioReturns['5d']);
        updateCell('dash-perf-15d', portfolioReturns['15d']);
        updateCell('dash-perf-30d', portfolioReturns['30d']);
        updateCell('dash-perf-3m', portfolioReturns['3m']);
        updateCell('dash-perf-6m', portfolioReturns['6m']);
        updateCell('dash-perf-1y', portfolioReturns['1y']);

        updateCell('dash-bench-today', benchmarkReturns.today);
        updateCell('dash-bench-5d', benchmarkReturns['5d']);
        updateCell('dash-bench-15d', benchmarkReturns['15d']);
        updateCell('dash-bench-30d', benchmarkReturns['30d']);
        updateCell('dash-bench-3m', benchmarkReturns['3m']);
        updateCell('dash-bench-6m', benchmarkReturns['6m']);
        updateCell('dash-bench-1y', benchmarkReturns['1y']);

        updateDiffCell('dash-diff-today', portfolioReturns.today, benchmarkReturns.today);
        updateDiffCell('dash-diff-5d', portfolioReturns['5d'], benchmarkReturns['5d']);
        updateDiffCell('dash-diff-15d', portfolioReturns['15d'], benchmarkReturns['15d']);
        updateDiffCell('dash-diff-30d', portfolioReturns['30d'], benchmarkReturns['30d']);
        updateDiffCell('dash-diff-3m', portfolioReturns['3m'], benchmarkReturns['3m']);
        updateDiffCell('dash-diff-6m', portfolioReturns['6m'], benchmarkReturns['6m']);
        updateDiffCell('dash-diff-1y', portfolioReturns['1y'], benchmarkReturns['1y']);

        const timeElem = document.getElementById('perf-update-time');
        if (timeElem) {
            timeElem.innerText = `${new Date().toLocaleString()} (${currentDataMode === 'firebase' ? 'Firebase' : 'Live API'})`;
        }
        const dashTimeElem = document.getElementById('dash-perf-update-time');
        if (dashTimeElem) {
            dashTimeElem.innerText = `${new Date().toLocaleString()} (${currentDataMode === 'firebase' ? 'Firebase' : 'Live API'})`;
        }

    } catch (error) {
        console.error('Performance summary error:', error);
    }
}

// ==========================================
// 🔍 ড্যাশবোর্ডে স্টক সার্চ – ui.js-এ ইতিমধ্যে সংজ্ঞায়িত, তাই এখানে ফাঁকা রাখলাম
// ==========================================

// ==========================================
// 📊 সিগন্যাল ফিল্টার – Buy/Sell বক্স
// ==========================================
async function applySignalFilters() {
    const marketFilter = document.getElementById('signal-market-filter');
    const scannerFilter = document.getElementById('signal-scanner-filter');

    if (marketFilter) currentSignalMarket = marketFilter.value;
    if (scannerFilter) currentSignalScanner = scannerFilter.value;

    await loadSignalData();
}

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
        const user = auth.currentUser;
        if (!user) {
            buyContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">Please login first.</div>`;
            sellContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">Please login first.</div>`;
            return;
        }

        let targetTickers = [];
        if (currentSignalMarket === 'portfolio') {
            const unifiedData = await unifiedEngine.calculate(user.uid, true);
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

                    const rsiData = calcRSI(priceData, 14);
                    const lastRsi = rsiData.filter(r => r.rsi !== null).pop();
                    const rsi = lastRsi ? lastRsi.rsi : 50;

                    const psarData = calcPSAR(priceData);
                    const psar = psarData.length > 0 ? psarData[psarData.length - 1].sar : price;

                    let ath = 0, atl = Infinity;
                    try {
                        if (typeof db !== 'undefined') {
                            const histSnap = await db.collection('cse_detailed_data')
                                .where('code', '==', ticker)
                                .get();
                            histSnap.forEach(doc => {
                                const d = doc.data();
                                const ltp = parseFloat(d.ltp);
                                if (ltp > ath) ath = ltp;
                                if (ltp > 0 && ltp < atl) atl = ltp;
                                if (d.high) {
                                    const h = parseFloat(d.high);
                                    if (h > ath) ath = h;
                                }
                                if (d.low) {
                                    const l = parseFloat(d.low);
                                    if (l > 0 && l < atl) atl = l;
                                }
                            });
                        }
                    } catch (e) { /* ignore */ }
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
// 🖥️ সিগন্যাল লিস্ট রেন্ডার
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
// 📌 মডাল খোলা / বন্ধ
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No signals available.</td></tr>`;
        return;
    }

    if (title) title.innerText = type === 'buy' ? '📈 Buy Signals' : '📉 Sell Signals';
    if (countSpan) countSpan.innerText = `${data.length} stocks`;
    if (timeSpan) timeSpan.innerText = new Date().toLocaleString();

    let html = '';
    for (const item of data) {
        const signalText = type === 'buy' ? 'BUY' : 'SELL';
        const signalColor = type === 'buy' ? '#10b981' : '#ef4444';
        html += `<tr onclick="openStockDetailModal('${item.ticker}')" style="cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">`;
        html += `<td style="padding: 8px 10px; font-weight:600; color:var(--primary-color); text-decoration:underline;">${item.ticker}</td>`;
        html += `<td style="padding: 8px 10px; text-align:right;">₹${item.price.toFixed(2)}</td>`;
        html += `<td style="padding: 8px 10px; text-align:right; color: ${item.rsi < 30 ? '#10b981' : (item.rsi > 70 ? '#ef4444' : '#f59e0b')};">${item.rsi.toFixed(2)}</td>`;
        html += `<td style="padding: 8px 10px; text-align:right;">₹${item.psar.toFixed(2)}</td>`;
        html += `<td style="padding: 8px 10px; text-align:right;">${item.ath > 0 ? '₹'+item.ath.toFixed(2) : '-'}</td>`;
        html += `<td style="padding: 8px 10px; text-align:right;">${item.atl > 0 && item.atl !== Infinity ? '₹'+item.atl.toFixed(2) : '-'}</td>`;
        html += `<td style="padding: 8px 10px; text-align:center; color:${signalColor}; font-weight:bold;">${signalText}</td>`;
        html += `<td style="padding: 8px 10px; text-align:center;"><button onclick="event.stopPropagation(); openStockDetailModal('${item.ticker}')" style="background:var(--primary-color); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">📊 View</button></td>`;
        html += `</tr>`;
    }
    if (tbody) tbody.innerHTML = html;

    modal.style.display = 'flex';
};

window.closeSignalDetailModal = function() {
    const modal = document.getElementById('signal-detail-modal');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('click', function(e) {
    const modal = document.getElementById('signal-detail-modal');
    if (modal && e.target === modal) {
        closeSignalDetailModal();
    }
});

// ==========================================
// 📅 ইনকাম মডালের ডেট ফিল্টার
// ==========================================
let incomeFilterStart = null;
let incomeFilterEnd = null;

function applyIncomeFilter() {
    const start = document.getElementById('income-chart-start')?.value;
    const end = document.getElementById('income-chart-end')?.value;
    if (start && end) {
        incomeFilterStart = start;
        incomeFilterEnd = end;
        const user = auth.currentUser;
        if (user) loadIncomeChartAndTable(user.uid, start, end);
    } else {
        if (typeof showToast === 'function') showToast('Please select both dates.', 'warning');
    }
}

function resetIncomeFilter() {
    incomeFilterStart = null;
    incomeFilterEnd = null;
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const startInput = document.getElementById('income-chart-start');
    const endInput = document.getElementById('income-chart-end');
    if (startInput) startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    if (endInput) endInput.value = today.toISOString().split('T')[0];
    const user = auth.currentUser;
    if (user) loadIncomeChartAndTable(user.uid, startInput?.value, endInput?.value);
}

// ==========================================
// 🎨 চার্টের রঙ আপডেট (ডার্ক/লাইট মোড)
// ==========================================
function updateChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    if (dashboardChartInstance) {
        try {
            dashboardChartInstance.options.plugins.legend.labels.color = textColor;
            dashboardChartInstance.options.scales.x.ticks.color = textColor;
            dashboardChartInstance.options.scales.y.ticks.color = textColor;
            dashboardChartInstance.options.scales.x.grid.color = gridColor;
            dashboardChartInstance.options.scales.y.grid.color = gridColor;
            dashboardChartInstance.update();
        } catch (e) { /* ignore */ }
    }

    if (window.dailyPLChartInstance) {
        try {
            window.dailyPLChartInstance.options.plugins.legend.labels.color = textColor;
            window.dailyPLChartInstance.options.scales.x.ticks.color = textColor;
            window.dailyPLChartInstance.options.scales.y.ticks.color = textColor;
            window.dailyPLChartInstance.options.scales.x.grid.color = gridColor;
            window.dailyPLChartInstance.options.scales.y.grid.color = gridColor;
            window.dailyPLChartInstance.update();
        } catch (e) { /* ignore */ }
    }

    if (advChartInstance) {
        try {
            advChartInstance.options.plugins.legend.labels.color = textColor;
            advChartInstance.options.scales.x.ticks.color = textColor;
            advChartInstance.options.scales.y.ticks.color = textColor;
            advChartInstance.options.scales.x.grid.color = gridColor;
            advChartInstance.options.scales.y.grid.color = gridColor;
            advChartInstance.update();
        } catch (e) { /* ignore */ }
    }
}

// ==========================================
// 📌 গ্লোবালি এক্সপোজ (সব ফাংশন উইন্ডোতে)
// ==========================================
window.applySignalFilters = applySignalFilters;
window.loadSignalData = loadSignalData;
window.openSignalDetailModal = openSignalDetailModal;
window.closeSignalDetailModal = closeSignalDetailModal;
window.loadDashboardData = loadDashboardData;
window.loadPortfolioAnalysisTable = loadPortfolioAnalysisTable;
window.loadPortfolioHistory = loadPortfolioHistory;
window.manualReloadDashboard = manualReloadDashboard;
window.initAutoRefreshToggle = initAutoRefreshToggle;
window.updatePerformanceSummary = updatePerformanceSummary;
window.updateDSEXIndicator = updateDSEXIndicator;
window.updateTotalIncomeCard = updateTotalIncomeCard;
window.applyDashboardDateFilter = applyDashboardDateFilter;
window.resetDashboardDateFilter = resetDashboardDateFilter;
window.getUserDeposit = getUserDeposit;
window.updateUserDeposit = updateUserDeposit;
window.loadIncomeChartAndTable = loadIncomeChartAndTable;
window.setHistoryMode = setHistoryMode;
window.filterHistoryByDate = filterHistoryByDate;
window.resetHistoryFilter = resetHistoryFilter;
window.applyIncomeFilter = applyIncomeFilter;
window.resetIncomeFilter = resetIncomeFilter;
window.updateChartColors = updateChartColors;
window.refreshPortfolioAnalysis = refreshPortfolioAnalysis;

console.log('✅ dashboard.js (Supabase + Firebase) loaded successfully');