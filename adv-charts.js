// ==========================================
// 📈 adv-charts.js - অ্যাডভান্সড চার্ট (ইন্ডিকেটর আলাদা)
//    সব ইন্ডিকেটর ফাংশন indicators.js থেকে নেওয়া
//    Database (Supabase history_dse) + Live API
//    ⚡ ডিফল্ট ইন্ডিকেটর কম (SMA5 + RSI) + অ্যানিমেশন বন্ধ
// ==========================================

// গ্লোবাল ভেরিয়েবল
let advMainChart = null;
let advRSIChart = null;
let advStochChart = null;
let advChartData = null;
let advActiveIndicators = {
    sma5: true,
    sma10: false,
    sma20: false,
    sma50: false,
    ema5: false,
    ema10: false,
    ema20: false,
    ema50: false,
    rsi: true,
    bollinger: false,
    stochastic: false,
    atr: false,
    forecast: false,
    psar: false
};
let advCurrentTicker = 'GP';
let advCurrentPeriod = 30;
let advDataSource = 'database'; // 'database' or 'live'
let advStockList = (typeof dseStocks !== 'undefined') ? dseStocks : (window.dseStocks || []);
let currentChartType = 'line'; // 'line' or 'candle'

// Zoom প্লাগইন রেজিস্টার
if (typeof Chart !== 'undefined' && typeof ChartZoom !== 'undefined') {
    Chart.register(ChartZoom);
} else if (typeof window.ChartZoom !== 'undefined') {
    Chart.register(window.ChartZoom);
} else {
    console.warn('Chart.js Zoom plugin not found. Zoom feature disabled.');
}

// ==========================================
// 🔙 গো ব্যাক ফাংশন
// ==========================================
window.goBackToStockModal = function() {
    const params = new URLSearchParams(window.location.search);
    const ticker = params.get('ticker');
    if (ticker) {
        window.location.href = `/?ticker=${ticker}`;
    } else {
        window.history.back();
    }
};

// ==========================================
// 🚀 ইনিশিয়ালাইজেশন
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // স্টক লিস্ট সেট করা
    if (typeof dseStocks !== 'undefined') advStockList = dseStocks;
    else if (window.dseStocks) advStockList = window.dseStocks;

    // লোড বাটন
    const loadBtn = document.getElementById('adv-chart-load');
    if (loadBtn) loadBtn.addEventListener('click', loadAdvancedChart);

    // সার্চ ইনপুট
    const searchInput = document.getElementById('adv-chart-search');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const ticker = this.value.trim().toUpperCase();
                if (ticker && advStockList.includes(ticker)) {
                    advCurrentTicker = ticker;
                    const suggestions = document.getElementById('adv-chart-suggestions');
                    if (suggestions) suggestions.style.display = 'none';
                    loadAdvancedChart();
                }
            }
        });
    }

    // ডেটা সোর্স সিলেক্ট
    const dataSource = document.getElementById('adv-data-source');
    if (dataSource) {
        dataSource.addEventListener('change', function() {
            advDataSource = this.value;
            if (advChartData) loadAdvancedChart();
        });
    }

    // পিরিয়ড সিলেক্ট
    const periodSelect = document.getElementById('adv-chart-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', function() {
            advCurrentPeriod = this.value === 'all' ? 'all' : parseInt(this.value);
            if (advChartData) loadAdvancedChart();
        });
    }

    // ইন্ডিকেটর টগল
    document.querySelectorAll('.indicator-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const indicator = this.dataset.indicator;
            const isActive = this.classList.contains('active');
            if (isActive) {
                this.classList.remove('active');
                advActiveIndicators[indicator] = false;
            } else {
                this.classList.add('active');
                advActiveIndicators[indicator] = true;
            }
            if (advChartData) {
                if (currentChartType === 'line') {
                    renderAdvancedChart(advChartData);
                } else {
                    renderCandlestickChart(advChartData);
                }
                generateSuggestion(advChartData);
            }
        });
    });

    // চার্ট টগল (Line/Candle)
    const lineBtn = document.getElementById('toggle-chart-type');
    const candleBtn = document.getElementById('toggle-chart-type-candle');
    if (lineBtn && candleBtn) {
        lineBtn.addEventListener('click', function() {
            currentChartType = 'line';
            this.classList.add('active');
            candleBtn.classList.remove('active');
            const lineContainer = document.getElementById('line-chart-wrapper');
            const candleContainer = document.getElementById('candlestick-wrapper');
            if (lineContainer) lineContainer.style.display = 'block';
            if (candleContainer) candleContainer.style.display = 'none';
            if (advChartData) renderAdvancedChart(advChartData);
        });
        candleBtn.addEventListener('click', function() {
            currentChartType = 'candle';
            this.classList.add('active');
            lineBtn.classList.remove('active');
            const lineContainer = document.getElementById('line-chart-wrapper');
            const candleContainer = document.getElementById('candlestick-wrapper');
            if (lineContainer) lineContainer.style.display = 'none';
            if (candleContainer) candleContainer.style.display = 'block';
            if (advChartData) renderCandlestickChart(advChartData);
        });
        // ডিফল্ট: লাইন চার্ট
        const lineContainer = document.getElementById('line-chart-wrapper');
        const candleContainer = document.getElementById('candlestick-wrapper');
        if (lineContainer) lineContainer.style.display = 'block';
        if (candleContainer) candleContainer.style.display = 'none';
        lineBtn.classList.add('active');
        candleBtn.classList.remove('active');
    }

    // URL প্যারামিটার থেকে টিকার নাম নিয়ে চার্ট লোড
    const params = new URLSearchParams(window.location.search);
    const tickerFromURL = params.get('ticker');
    if (tickerFromURL) {
        const searchInput = document.getElementById('adv-chart-search');
        if (searchInput) searchInput.value = tickerFromURL;
        advCurrentTicker = tickerFromURL;
        loadAdvancedChart(tickerFromURL);
    } else {
        loadAdvancedChart();
    }

    if (typeof loadSavedTheme === 'function') loadSavedTheme();
});

// ==========================================
// 📊 loadAdvancedChart - Database + Live API
// ==========================================
async function loadAdvancedChart(ticker) {
    const searchInput = document.getElementById('adv-chart-search');
    const finalTicker = ticker || (searchInput ? searchInput.value.trim().toUpperCase() || advCurrentTicker : advCurrentTicker);
    
    if (!finalTicker) {
        showToast('Please enter a share name', 'warning');
        return;
    }
    if (!advStockList.includes(finalTicker)) {
        showToast('Share not found. Please select from suggestions.', 'warning');
        return;
    }

    advCurrentTicker = finalTicker;
    const titleEl = document.getElementById('adv-chart-title');
    if (titleEl) titleEl.innerText = `${finalTicker} - Price History`;

    const footerSource = document.getElementById('footer-source');
    if (footerSource) {
        const sourceSelect = document.getElementById('adv-data-source');
        footerSource.innerText = sourceSelect ? sourceSelect.selectedOptions[0].text : 'Database';
    }

    const source = document.getElementById('adv-data-source')?.value || 'database';
    const period = advCurrentPeriod === 'all' ? 'all' : advCurrentPeriod;
    const cacheKey = `chart_${finalTicker}_${source}_${period}`;
    const CACHE_TTL = source === 'live' ? 120000 : 600000; // লাইভের জন্য ২ মিনিট

    const cachedData = CacheManager.get(cacheKey, CACHE_TTL);
    if (cachedData && cachedData.actualPrices && cachedData.actualPrices.length > 0) {
        console.log(`📊 Chart data loaded from cache for ${finalTicker} (${source})`);
        advChartData = cachedData;
        updateStockInfo(advChartData);
        if (currentChartType === 'line') renderAdvancedChart(advChartData);
        else renderCandlestickChart(advChartData);
        generateSuggestion(advChartData);
        showToast(`📊 Loaded ${finalTicker} from cache`, 'info');
        const updateTime = document.getElementById('adv-chart-update-time');
        if (updateTime) updateTime.innerText = new Date().toLocaleString();
        const suggestionTime = document.getElementById('suggestion-time');
        if (suggestionTime) suggestionTime.innerText = new Date().toLocaleString();
        return;
    }

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (period === 'all' ? 365 : period));
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = new Date().toISOString().split('T')[0];

        let priceData = [], labels = [], highData = [], lowData = [];

        if (source === 'database') {
            // ==========================================
            // ১. Database (Supabase history_dse)
            // ==========================================
            if (typeof supabase !== 'undefined' && supabase) {
                try {
                    let query = supabase
                        .from('history_dse')
                        .select('date, ltp, high, low')
                        .eq('ticker', finalTicker)
                        .gte('date', startDateStr)
                        .order('date', { ascending: true });
                    
                    const { data, error } = await query;
                    if (!error && data && data.length > 0) {
                        data.forEach(row => {
                            const price = parseFloat(row.ltp);
                            const high = parseFloat(row.high) || price;
                            const low = parseFloat(row.low) || price;
                            if (price > 0) {
                                labels.push(row.date);
                                priceData.push(price);
                                highData.push(high);
                                lowData.push(low);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Supabase history_dse fetch failed:', e);
                }
            }

            // Firebase ফ্যালব্যাক (যদি Supabase না পাওয়া যায়)
            if (priceData.length === 0 && typeof db !== 'undefined') {
                try {
                    let query = db.collection('daily_prices')
                        .where('ticker', '==', finalTicker)
                        .where('date', '>=', startDateStr)
                        .orderBy('date', 'asc');
                    
                    const snap = await query.get();
                    if (!snap.empty) {
                        snap.forEach(doc => {
                            const data = doc.data();
                            const price = parseFloat(data.price) || parseFloat(data.close) || 0;
                            const high = parseFloat(data.high) || price;
                            const low = parseFloat(data.low) || price;
                            if (price > 0) {
                                labels.push(data.date);
                                priceData.push(price);
                                highData.push(high);
                                lowData.push(low);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Firebase daily_prices fallback failed:', e);
                }
            }
        } else {
            // ==========================================
            // ২. Live API (bd-stock-api)
            // ==========================================
            const apiUrl = `https://bd-stock-api-an3n.vercel.app/v1/dse/historical?start=${startDateStr}&end=${endDateStr}&code=${finalTicker}`;
            
            try {
                const response = await fetch(apiUrl);
                const result = await response.json();
                
                if (result.success && result.data && result.data.length > 0) {
                    result.data.forEach(item => {
                        const price = parseFloat(item['LTP*']);
                        const high = parseFloat(item['HIGH']) || price;
                        const low = parseFloat(item['LOW']) || price;
                        if (price > 0) {
                            labels.push(item['DATE']);
                            priceData.push(price);
                            highData.push(high);
                            lowData.push(low);
                        }
                    });
                    console.log(`✅ Live API loaded ${priceData.length} records for ${finalTicker}`);
                } else {
                    showToast('No live data available for this period', 'warning');
                }
            } catch (error) {
                console.error('Live API fetch error:', error);
                showToast('Failed to load live data: ' + error.message, 'error');
            }
        }

        if (priceData.length === 0) {
            showToast('No data available for this share from selected source', 'error');
            return;
        }

        // অ্যাভারেজ বাই প্রাইস (গ্র্যান্ড পোর্টফোলিও থেকে)
        let avgBuyPrice = 0;
        const user = auth?.currentUser;
        if (user) {
            try {
                const unifiedData = await unifiedEngine.calculate(user.uid, null, true);
                const stockData = unifiedData.stockDetails.find(s => s.ticker === finalTicker);
                if (stockData && stockData.totalQty > 0) {
                    avgBuyPrice = stockData.totalCost / stockData.totalQty;
                }
            } catch (e) { /* ignore */ }
        }

        // ফরকাস্ট
        const forecast = arimaForecast(priceData, 5);
        let forecastLabels = [], forecastValues = [];
        if (forecast) {
            const lastDate = new Date(labels[labels.length - 1]);
            forecast.forEach((f, idx) => {
                const d = new Date(lastDate);
                d.setDate(d.getDate() + idx + 1);
                forecastLabels.push(d.toISOString().split('T')[0]);
                forecastValues.push(f);
            });
        }

        const allLabels = [...labels, ...forecastLabels];
        const allPrices = [...priceData, ...forecastValues.map(() => null)];

        const chartData = {
            ticker: finalTicker,
            labels: allLabels,
            prices: allPrices,
            actualPrices: priceData,
            actualLabels: labels,
            forecastLabels,
            forecastValues,
            avgBuyPrice,
            high: Math.max(...priceData),
            low: Math.min(...priceData),
            currentPrice: priceData[priceData.length - 1] || 0,
            highData,
            lowData,
            dataSource: source
        };

        CacheManager.set(cacheKey, chartData, CACHE_TTL);
        console.log(`📊 Chart data cached for ${finalTicker} (${source})`);

        advChartData = chartData;
        updateStockInfo(advChartData);
        if (currentChartType === 'line') renderAdvancedChart(advChartData);
        else renderCandlestickChart(advChartData);
        generateSuggestion(advChartData);

        const updateTime = document.getElementById('adv-chart-update-time');
        if (updateTime) updateTime.innerText = new Date().toLocaleString();
        const suggestionTime = document.getElementById('suggestion-time');
        if (suggestionTime) suggestionTime.innerText = new Date().toLocaleString();

    } catch (error) {
        console.error('Chart load error:', error);
        showToast('Error loading chart data: ' + error.message, 'error');
    }
}

// ==========================================
// 🔍 সার্চ সাজেশন
// ==========================================
function handleSearchInput() {
    const query = this.value.trim().toUpperCase();
    const suggestions = document.getElementById('adv-chart-suggestions');
    if (!suggestions) return;
    if (!query || !advStockList || advStockList.length === 0) {
        suggestions.style.display = 'none';
        return;
    }
    const filtered = advStockList.filter(s => s.startsWith(query)).slice(0, 10);
    if (filtered.length > 0) {
        suggestions.style.display = 'block';
        suggestions.innerHTML = filtered.map(s =>
            `<div class="suggestion-item" onclick="selectAdvChartStock('${s}')">${s}</div>`
        ).join('');
    } else {
        suggestions.style.display = 'none';
    }
}

function selectAdvChartStock(ticker) {
    const searchInput = document.getElementById('adv-chart-search');
    if (searchInput) searchInput.value = ticker;
    const suggestions = document.getElementById('adv-chart-suggestions');
    if (suggestions) suggestions.style.display = 'none';
    advCurrentTicker = ticker;
    loadAdvancedChart();
}

// ==========================================
// 📈 লাইন চার্ট রেন্ডার (অ্যানিমেশন বন্ধ + শুধু অ্যাক্টিভ ইন্ডিকেটর)
// ==========================================
function renderAdvancedChart(data) {
    if (!data) return;

    const mainCanvas = document.getElementById('adv-main-chart');
    if (!mainCanvas) {
        console.error('Main chart canvas not found');
        return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const actualPrices = data.actualPrices;
    const labels = data.labels;
    const prices = data.prices;
    const highData = data.highData || [];
    const lowData = data.lowData || [];

    // ✅ শুধু অ্যাক্টিভ ইন্ডিকেটরগুলোর জন্য ক্যালকুলেশন
    const sma5 = advActiveIndicators.sma5 ? calculateSMA(actualPrices, 5) : [];
    const sma10 = advActiveIndicators.sma10 ? calculateSMA(actualPrices, 10) : [];
    const sma20 = advActiveIndicators.sma20 ? calculateSMA(actualPrices, 20) : [];
    const sma50 = advActiveIndicators.sma50 ? calculateSMA(actualPrices, 50) : [];
    
    const ema5 = advActiveIndicators.ema5 ? calculateEMA(actualPrices, 5) : [];
    const ema10 = advActiveIndicators.ema10 ? calculateEMA(actualPrices, 10) : [];
    const ema20 = advActiveIndicators.ema20 ? calculateEMA(actualPrices, 20) : [];
    const ema50 = advActiveIndicators.ema50 ? calculateEMA(actualPrices, 50) : [];
    
    const bollinger = advActiveIndicators.bollinger ? calculateBollingerBands(actualPrices, 20, 2) : null;
    const rsiData = advActiveIndicators.rsi ? calculateRSI(actualPrices, 14) : [];
    const stochastic = advActiveIndicators.stochastic ? calculateStochastic(highData, lowData, actualPrices, 14, 3) : { k: [], d: [] };
    const atr = advActiveIndicators.atr ? calculateATR(highData, lowData, actualPrices, 14) : [];
    const forecast = advActiveIndicators.forecast ? data.forecastValues : [];

    // PSAR (শুধু অ্যাক্টিভ থাকলে)
    let psarData = [];
    if (advActiveIndicators.psar && actualPrices.length > 0) {
        const priceDataForPSAR = data.actualLabels.map((date, i) => ({
            date: date,
            ltp: actualPrices[i],
            high: highData[i] || actualPrices[i],
            low: lowData[i] || actualPrices[i]
        }));
        const psar = calculateParabolicSAR(priceDataForPSAR);
        psarData = psar.map(p => p.sar);
        while (psarData.length < actualPrices.length) {
            psarData.unshift(null);
        }
        const forecastLen = forecast.length;
        psarData = [...psarData, ...Array(forecastLen).fill(null)];
    }

    const datasets = [];

    // প্রাইস লাইন
    datasets.push({
        label: `${data.ticker} Price`,
        data: prices,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.2,
        pointRadius: 2,
        pointBackgroundColor: '#3b82f6',
        spanGaps: false,
        segment: {
            borderColor: (ctx) => {
                const value = ctx.p0.parsed.y;
                if (value === null) return '#3b82f6';
                return value >= (data.avgBuyPrice || 0) ? '#10b981' : '#ef4444';
            }
        }
    });

    // অ্যাভারেজ বাই
    if (data.avgBuyPrice > 0) {
        datasets.push({
            label: `Avg Buy (${data.avgBuyPrice.toFixed(2)})`,
            data: new Array(prices.length).fill(data.avgBuyPrice),
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [8, 6],
            fill: false,
            pointRadius: 0
        });
    }

    // SMA
    const smaMap = { sma5, sma10, sma20, sma50 };
    const smaColors = { sma5: '#8b5cf6', sma10: '#ec4899', sma20: '#f97316', sma50: '#14b8a6' };
    const smaLabels = { sma5: 'SMA 5', sma10: 'SMA 10', sma20: 'SMA 20', sma50: 'SMA 50' };
    Object.keys(smaMap).forEach(key => {
        if (advActiveIndicators[key] && smaMap[key].length > 0) {
            const smaData = [...smaMap[key], ...forecast.map(() => null)];
            datasets.push({
                label: smaLabels[key],
                data: smaData,
                borderColor: smaColors[key],
                borderWidth: 1.5,
                fill: false,
                pointRadius: 0
            });
        }
    });

    // EMA
    const emaMap = { ema5, ema10, ema20, ema50 };
    const emaColors = { ema5: '#a78bfa', ema10: '#f472b6', ema20: '#fb923c', ema50: '#2dd4bf' };
    const emaLabels = { ema5: 'EMA 5', ema10: 'EMA 10', ema20: 'EMA 20', ema50: 'EMA 50' };
    Object.keys(emaMap).forEach(key => {
        if (advActiveIndicators[key] && emaMap[key].length > 0) {
            const emaData = [...emaMap[key], ...forecast.map(() => null)];
            datasets.push({
                label: emaLabels[key],
                data: emaData,
                borderColor: emaColors[key],
                borderWidth: 1.5,
                fill: false,
                pointRadius: 0
            });
        }
    });

    // Bollinger Bands
    if (advActiveIndicators.bollinger && bollinger) {
        const upper = [...bollinger.upper, ...forecast.map(() => null)];
        const middle = [...bollinger.middle, ...forecast.map(() => null)];
        const lower = [...bollinger.lower, ...forecast.map(() => null)];

        datasets.push({
            label: 'BB Upper',
            data: upper,
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            borderDash: [4, 4]
        });
        datasets.push({
            label: 'BB Middle',
            data: middle,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            borderDash: [4, 4]
        });
        datasets.push({
            label: 'BB Lower',
            data: lower,
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            borderDash: [4, 4]
        });
        datasets.push({
            label: 'Bollinger Band',
            data: upper.map((u, i) => ({ x: i, y: u, y1: lower[i] })),
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderColor: 'transparent',
            fill: true,
            pointRadius: 0,
            order: 10
        });
    }

    // ARIMA Forecast
    if (advActiveIndicators.forecast && forecast.length > 0) {
        const forecastData = [...new Array(actualPrices.length).fill(null), ...forecast];
        datasets.push({
            label: 'ARIMA Forecast (5d)',
            data: forecastData,
            borderColor: '#f59e0b',
            borderDash: [6, 4],
            borderWidth: 2,
            fill: false,
            pointRadius: 4,
            pointBackgroundColor: '#f59e0b',
            pointStyle: 'rectRot'
        });
    }

    // PSAR
    if (advActiveIndicators.psar && psarData.length > 0) {
        datasets.push({
            label: 'PSAR',
            data: psarData,
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255,107,107,0.2)',
            borderWidth: 1.5,
            fill: false,
            pointRadius: 4,
            pointBackgroundColor: '#ff6b6b',
            pointStyle: 'rectRot',
            showLine: true,
            spanGaps: false,
            order: 2
        });
    }

    // মেইন চার্ট
    const mainCtx = mainCanvas.getContext('2d');
    if (advMainChart) advMainChart.destroy();

    advMainChart = new Chart(mainCtx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: textColor, boxWidth: 12, font: { size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            if (val === null || val === undefined) return null;
                            if (context.dataset.label.includes('BB')) return null;
                            if (context.dataset.label.includes('Forecast')) {
                                return `📈 ARIMA Forecast: ৳${val.toFixed(2)}`;
                            }
                            if (context.dataset.label.includes('Avg Buy')) {
                                return `📊 Avg Buy: ৳${val.toFixed(2)}`;
                            }
                            if (context.dataset.label.includes('PSAR')) {
                                return `PSAR: ৳${val.toFixed(2)}`;
                            }
                            return `${context.dataset.label}: ৳${val.toFixed(2)}`;
                        }
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
                    zoom: { wheel: { enabled: true, speed: 0.05 }, pinch: { enabled: true }, mode: 'x' },
                    limits: { x: { minRange: 5 } }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, maxRotation: 45, font: { size: 10 } },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor, callback: (v) => '৳' + v.toFixed(0) },
                    grid: { color: gridColor },
                    position: 'right'
                }
            }
        }
    });

    // RSI চার্ট (শুধু অ্যাক্টিভ থাকলে)
    const rsiCanvas = document.getElementById('adv-rsi-chart');
    if (rsiCanvas && advActiveIndicators.rsi) {
        renderRSIChart(rsiData, isDark, rsiCanvas);
    } else if (rsiCanvas) {
        const ctx = rsiCanvas.getContext('2d');
        ctx.clearRect(0, 0, rsiCanvas.width, rsiCanvas.height);
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RSI not active', rsiCanvas.width/2, 40);
    }

    // Stochastic চার্ট (শুধু অ্যাক্টিভ থাকলে)
    const stochCanvas = document.getElementById('adv-stochastic-chart');
    if (stochCanvas && advActiveIndicators.stochastic) {
        renderStochasticChart(stochastic, isDark, stochCanvas);
    } else if (stochCanvas) {
        const ctx = stochCanvas.getContext('2d');
        ctx.clearRect(0, 0, stochCanvas.width, stochCanvas.height);
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Stochastic not active', stochCanvas.width/2, 40);
    }

    // কমেন্ট আপডেট
    updatePriceComment(data);
    if (advActiveIndicators.rsi) {
        updateRSIComment(rsiData);
    } else {
        const commentDiv = document.getElementById('adv-rsi-comment');
        if (commentDiv) commentDiv.textContent = '💡 RSI indicator is off. Click button to activate.';
    }
    if (advActiveIndicators.stochastic) {
        updateStochComment(stochastic);
    } else {
        const commentDiv = document.getElementById('adv-stoch-comment');
        if (commentDiv) commentDiv.textContent = '💡 Stochastic indicator is off. Click button to activate.';
    }

    const updateTime = document.getElementById('adv-chart-update-time');
    if (updateTime) updateTime.innerText = new Date().toLocaleString();
    const suggestionTime = document.getElementById('suggestion-time');
    if (suggestionTime) suggestionTime.innerText = new Date().toLocaleString();
}

// ==========================================
// 📊 RSI চার্ট (অ্যানিমেশন বন্ধ)
// ==========================================
function renderRSIChart(rsiData, isDark, canvas) {
    const ctx = canvas.getContext('2d');
    if (advRSIChart) advRSIChart.destroy();

    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const labels = rsiData.map((_, i) => i);
    const rsiValues = rsiData.map(d => d.rsi);

    advRSIChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'RSI (14)',
                    data: rsiValues,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 1
                },
                {
                    label: 'Overbought (70)',
                    data: new Array(rsiValues.length).fill(70),
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    borderDash: [4, 4],
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Oversold (30)',
                    data: new Array(rsiValues.length).fill(30),
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    borderDash: [4, 4],
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { min: 0, max: 100, ticks: { color: textColor, stepSize: 20 }, grid: { color: gridColor } }
            }
        }
    });
}

// ==========================================
// 📊 Stochastic চার্ট (অ্যানিমেশন বন্ধ) - FIXED
// ==========================================
function renderStochasticChart(stochData, isDark, canvas) {
    const ctx = canvas.getContext('2d');
    if (advStochChart) advStochChart.destroy();
    
    // ✅ ডেটা ভ্যালিডিটি চেক
    if (!stochData || !stochData.k || stochData.k.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No Stochastic data available', canvas.width/2, 40);
        return;
    }

    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const labels = stochData.k.map((_, i) => i);
    const kValues = stochData.k;
    const dValues = stochData.d || [];

    advStochChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '%K (14)',
                    data: kValues,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 1,
                    tension: 0.2
                },
                {
                    label: '%D (3)',
                    data: dValues,
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 1,
                    tension: 0.2
                },
                {
                    label: 'Overbought (80)',
                    data: new Array(kValues.length).fill(80),
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    borderDash: [4, 4],
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Oversold (20)',
                    data: new Array(kValues.length).fill(20),
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    borderDash: [4, 4],
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: true,
                    labels: { color: textColor, boxWidth: 12, font: { size: 10 } }
                }
            },
            scales: {
                x: { 
                    display: false,
                    grid: { color: gridColor }
                },
                y: { 
                    min: 0, 
                    max: 100, 
                    ticks: { color: textColor, stepSize: 20 }, 
                    grid: { color: gridColor } 
                }
            }
        }
    });
}

// ==========================================
// 🕯️ ক্যান্ডেল চার্ট রেন্ডার (ইন্ডিকেটর + ফরকাস্ট + কমেন্ট)
// ==========================================
function prepareCandlestickData(data) {
    const prices = data.actualPrices;
    const labels = data.actualLabels;
    const highData = data.highData || [];
    const lowData = data.lowData || [];
    const result = [];
    for (let i = 0; i < prices.length; i++) {
        const close = prices[i];
        const high = highData[i] || close;
        const low = lowData[i] || close;
        const open = i > 0 ? prices[i-1] : close;
        result.push({
            time: labels[i],
            open: open,
            high: high,
            low: low,
            close: close
        });
    }
    return result;
}

function renderCandlestickChart(data) {
    const container = document.getElementById('candlestick-chart');
    if (!container) return;
    
    if (!data || !data.actualPrices || data.actualPrices.length < 2) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 20px; text-align: center;">⚠️ Insufficient data.</p>';
        return;
    }

    if (typeof LightweightCharts === 'undefined') {
        container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">
            <p>⚠️ Library not loaded.</p>
            <button onclick="loadCandlestickLibrary()" style="padding:6px 16px; background:var(--primary-color); color:white; border:none; border-radius:4px; cursor:pointer;">🔄 Retry</button>
        </div>`;
        return;
    }

    container.innerHTML = '';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgColor = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#f1f5f9' : '#333';
    const gridColor = isDark ? '#334155' : '#f0f0f0';

    const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 400,
        layout: { backgroundColor: bgColor, textColor: textColor },
        grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: gridColor },
        timeScale: { borderColor: gridColor, timeVisible: true, tickMarkFormatter: (time) => time },
    });

    // ১. ক্যান্ডেল সিরিজ
    const candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
        wickUpColor: '#26a69a', wickDownColor: '#ef5350'
    });
    const candleData = prepareCandlestickData(data);
    candleSeries.setData(candleData);

    // ২. ইন্ডিকেটর ওভারলে (শুধু অ্যাক্টিভ ইন্ডিকেটর)
    const actualPrices = data.actualPrices;
    const actualLabels = data.actualLabels;
    const highData = data.highData || [];
    const lowData = data.lowData || [];

    // SMA
    if (advActiveIndicators.sma5 || advActiveIndicators.sma10 || advActiveIndicators.sma20 || advActiveIndicators.sma50) {
        const smaPeriods = [5, 10, 20, 50];
        const smaColors = ['#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];
        smaPeriods.forEach((period, idx) => {
            const key = `sma${period}`;
            if (advActiveIndicators[key]) {
                const smaValues = calculateSMA(actualPrices, period);
                if (smaValues.length > 0) {
                    const lineData = smaValues.map((val, i) => ({
                        time: actualLabels[i + period - 1],
                        value: val
                    }));
                    chart.addLineSeries({
                        color: smaColors[idx],
                        lineWidth: 1,
                        title: `SMA ${period}`,
                        priceLineVisible: false,
                    }).setData(lineData);
                }
            }
        });
    }

    // EMA
    if (advActiveIndicators.ema5 || advActiveIndicators.ema10 || advActiveIndicators.ema20 || advActiveIndicators.ema50) {
        const emaPeriods = [5, 10, 20, 50];
        const emaColors = ['#a78bfa', '#f472b6', '#fb923c', '#2dd4bf'];
        emaPeriods.forEach((period, idx) => {
            const key = `ema${period}`;
            if (advActiveIndicators[key]) {
                const emaValues = calculateEMA(actualPrices, period);
                if (emaValues.length > 0) {
                    const lineData = emaValues.map((val, i) => ({
                        time: actualLabels[i + period - 1],
                        value: val
                    }));
                    chart.addLineSeries({
                        color: emaColors[idx],
                        lineWidth: 1,
                        title: `EMA ${period}`,
                        priceLineVisible: false,
                    }).setData(lineData);
                }
            }
        });
    }

    // Bollinger Bands
    if (advActiveIndicators.bollinger) {
        const bb = calculateBollingerBands(actualPrices, 20, 2);
        if (bb && bb.middle.length > 0) {
            const middleData = bb.middle.map((val, i) => ({ time: actualLabels[i + 19], value: val }));
            const upperData = bb.upper.map((val, i) => ({ time: actualLabels[i + 19], value: val }));
            const lowerData = bb.lower.map((val, i) => ({ time: actualLabels[i + 19], value: val }));
            chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'BB Middle', priceLineVisible: false }).setData(middleData);
            chart.addLineSeries({ color: 'rgba(239,68,68,0.5)', lineWidth: 1, title: 'BB Upper', priceLineVisible: false }).setData(upperData);
            chart.addLineSeries({ color: 'rgba(239,68,68,0.5)', lineWidth: 1, title: 'BB Lower', priceLineVisible: false }).setData(lowerData);
        }
    }

    // PSAR (as scatter points)
    if (advActiveIndicators.psar) {
        const psarData = calculateParabolicSAR(actualPrices.map((p, i) => ({
            date: actualLabels[i], ltp: p, high: highData[i] || p, low: lowData[i] || p
        })));
        if (psarData.length > 0) {
            const psarPoints = psarData.map((item, i) => ({
                time: actualLabels[i] || actualLabels[actualLabels.length - 1],
                value: item.sar,
                trend: item.trend
            }));
            const psarLine = chart.addLineSeries({
                color: '#ff6b6b',
                lineWidth: 0,
                pointMarkers: psarPoints.map(p => ({
                    time: p.time,
                    position: 'aboveBar',
                    color: p.trend === 'up' ? '#10b981' : '#ef4444',
                    shape: 'circle',
                    size: 2,
                })),
                title: 'PSAR',
                priceLineVisible: false,
            });
            const dummyData = psarPoints.map(p => ({ time: p.time, value: p.value }));
            psarLine.setData(dummyData);
        }
    }

    // ARIMA Forecast (future line)
    if (advActiveIndicators.forecast && data.forecastValues && data.forecastValues.length > 0) {
        const forecastVals = data.forecastValues;
        const lastDate = new Date(actualLabels[actualLabels.length - 1]);
        const forecastData = forecastVals.map((val, i) => {
            const d = new Date(lastDate);
            d.setDate(d.getDate() + i + 1);
            return {
                time: d.toISOString().split('T')[0],
                value: val
            };
        });
        chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 2,
            lineStyle: 2,
            title: 'ARIMA Forecast',
            priceLineVisible: false,
        }).setData(forecastData);
    }

    chart.timeScale().fitContent();

    const resize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener('resize', resize);
    container._chart = chart;

    // কমেন্ট আপডেট
    updateCandlestickComment(data);
}

function loadCandlestickLibrary() {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js';
    script.onload = () => {
        if (advChartData) renderCandlestickChart(advChartData);
        showToast('✅ Candlestick library loaded!', 'success');
    };
    script.onerror = () => {
        showToast('❌ Failed to load candlestick library. Please try again later.', 'error');
    };
    document.head.appendChild(script);
}

// ==========================================
// 💬 ক্যান্ডেল কমেন্ট (UI ক্লাস সহ)
// ==========================================
function updateCandlestickComment(data) {
    const commentDiv = document.getElementById('candlestick-comment');
    if (!commentDiv) return;
    if (!data || !data.actualPrices || data.actualPrices.length < 3) {
        commentDiv.textContent = '💡 Insufficient data for analysis.';
        return;
    }

    const prices = data.actualPrices;
    const high = data.highData || [];
    const low = data.lowData || [];
    const lastIdx = prices.length - 1;
    const currentPrice = prices[lastIdx];
    const prevPrice = prices[lastIdx - 1];
    const prevPrevPrice = prices[lastIdx - 2];

    let comment = '📊 ';

    // ক্যান্ডেল প্যাটার্ন
    const todayOpen = lastIdx > 0 ? prices[lastIdx - 1] : currentPrice;
    const todayHigh = high[lastIdx] || currentPrice;
    const todayLow = low[lastIdx] || currentPrice;
    const bodySize = Math.abs(currentPrice - todayOpen);
    const range = todayHigh - todayLow;

    if (lastIdx > 1) {
        const prevOpen = lastIdx > 1 ? prices[lastIdx - 2] : prevPrice;
        const prevClose = prevPrice;
        if (prevClose > prevOpen && currentPrice < todayOpen && todayOpen > prevClose && currentPrice < prevOpen) {
            comment += '🔴 Bearish Engulfing (possible reversal down) ';
        } else if (prevClose < prevOpen && currentPrice > todayOpen && todayOpen < prevClose && currentPrice > prevOpen) {
            comment += '🟢 Bullish Engulfing (possible reversal up) ';
        }
    }

    if (range > 0 && bodySize / range < 0.1) {
        comment += '⚪ Doji (indecision, possible reversal) ';
    }

    // RSI
    if (advActiveIndicators.rsi) {
        const rsiData = calculateRSI(prices, 14);
        const lastRSI = rsiData.length ? rsiData[rsiData.length - 1].rsi : null;
        if (lastRSI !== null) {
            if (lastRSI < 30) comment += '| RSI oversold (<30) – potential bounce ';
            else if (lastRSI > 70) comment += '| RSI overbought (>70) – potential pullback ';
            else if (lastRSI < 40) comment += '| RSI weak (could go lower) ';
            else if (lastRSI > 60) comment += '| RSI strong (could go higher) ';
        }
    }

    // Bollinger
    if (advActiveIndicators.bollinger) {
        const bb = calculateBollingerBands(prices, 20, 2);
        if (bb && bb.upper.length > 0) {
            const lastUpper = bb.upper[bb.upper.length - 1];
            const lastLower = bb.lower[bb.lower.length - 1];
            if (currentPrice <= lastLower) comment += '| Price near lower BB (oversold) ';
            else if (currentPrice >= lastUpper) comment += '| Price near upper BB (overbought) ';
        }
    }

    // PSAR
    if (advActiveIndicators.psar) {
        const psar = calculateParabolicSAR(prices.map((p, i) => ({ date: data.actualLabels[i], ltp: p, high: high[i] || p, low: low[i] || p })));
        if (psar.length > 0) {
            const lastPSAR = psar[psar.length - 1].sar;
            if (lastPSAR < currentPrice) comment += '| PSAR bullish ';
            else if (lastPSAR > currentPrice) comment += '| PSAR bearish ';
        }
    }

    // ফরকাস্ট
    if (advActiveIndicators.forecast && data.forecastValues && data.forecastValues.length > 0) {
        const avgForecast = data.forecastValues.reduce((a,b) => a+b, 0) / data.forecastValues.length;
        const change = ((avgForecast - currentPrice) / currentPrice) * 100;
        if (change > 2) comment += `| ARIMA predicts +${change.toFixed(2)}% in 5 days (bullish) `;
        else if (change < -2) comment += `| ARIMA predicts ${change.toFixed(2)}% in 5 days (bearish) `;
        else comment += '| ARIMA sees sideways movement ';
    }

    commentDiv.textContent = comment || '💡 No strong signals.';
    commentDiv.classList.remove('bullish', 'bearish');
    if (comment.includes('bullish') || comment.includes('🟢') || comment.includes('potential bounce')) {
        commentDiv.classList.add('bullish');
    } else if (comment.includes('bearish') || comment.includes('🔴') || comment.includes('potential pullback')) {
        commentDiv.classList.add('bearish');
    }
}

// ==========================================
// 📊 অন্যান্য ফাংশন (স্টক ইনফো, কমেন্ট, সাজেশন)
// ==========================================
function updateStockInfo(data) {
    const price = data.currentPrice || 0;
    const prevPrice = data.actualPrices[data.actualPrices.length - 2] || price;
    const change = price - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

    const priceEl = document.getElementById('adv-info-price');
    if (priceEl) priceEl.innerText = `৳${price.toFixed(2)}`;

    const changeEl = document.getElementById('adv-info-change');
    if (changeEl) {
        changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`;
        changeEl.className = `value ${change >= 0 ? 'positive' : 'negative'}`;
    }

    const highEl = document.getElementById('adv-info-high');
    if (highEl) highEl.innerText = `৳${data.high.toFixed(2)}`;
    const lowEl = document.getElementById('adv-info-low');
    if (lowEl) lowEl.innerText = `৳${data.low.toFixed(2)}`;
    const avgBuyEl = document.getElementById('adv-info-avgbuy');
    if (avgBuyEl) avgBuyEl.innerText = data.avgBuyPrice > 0 ? `৳${data.avgBuyPrice.toFixed(2)}` : '-';
}

function updatePriceComment(data) {
    const commentDiv = document.getElementById('adv-price-comment');
    if (!commentDiv) return;
    const lastPrice = data.currentPrice;
    const prevPrice = data.actualPrices[data.actualPrices.length - 2] || lastPrice;
    const change = lastPrice - prevPrice;
    const pct = prevPrice ? (change / prevPrice) * 100 : 0;
    let comment = `📊 Last: ৳${lastPrice.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}, ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;

    if (advActiveIndicators.rsi) {
        const rsiData = calculateRSI(data.actualPrices, 14);
        const lastRSI = rsiData.length ? rsiData[rsiData.length - 1].rsi : null;
        if (lastRSI !== null) {
            if (lastRSI < 30) comment += ' | ⚡ RSI Oversold (<30)';
            else if (lastRSI > 70) comment += ' | ⚡ RSI Overbought (>70)';
            else comment += ` | RSI ${lastRSI.toFixed(1)} (Neutral)`;
        }
    }

    if (advActiveIndicators.bollinger) {
        const bb = calculateBollingerBands(data.actualPrices, 20, 2);
        if (bb && bb.upper.length) {
            const lastUpper = bb.upper[bb.upper.length - 1];
            const lastLower = bb.lower[bb.lower.length - 1];
            if (lastPrice <= lastLower) comment += ' | 📉 Price near Lower BB (Oversold)';
            else if (lastPrice >= lastUpper) comment += ' | 📈 Price near Upper BB (Overbought)';
        }
    }

    if (advActiveIndicators.psar) {
        const priceDataForPSAR = data.actualLabels.map((date, i) => ({
            date: date,
            ltp: data.actualPrices[i],
            high: data.highData[i] || data.actualPrices[i],
            low: data.lowData[i] || data.actualPrices[i]
        }));
        const psar = calculateParabolicSAR(priceDataForPSAR);
        if (psar.length) {
            const lastPSAR = psar[psar.length - 1].sar;
            if (lastPSAR < lastPrice) comment += ' | 🟢 PSAR below price (Bullish)';
            else if (lastPSAR > lastPrice) comment += ' | 🔴 PSAR above price (Bearish)';
        }
    }

    commentDiv.textContent = comment;
    commentDiv.classList.remove('bullish', 'bearish');
    if (comment.includes('Bullish') || comment.includes('🟢')) {
        commentDiv.classList.add('bullish');
    } else if (comment.includes('Bearish') || comment.includes('🔴')) {
        commentDiv.classList.add('bearish');
    }
}

function updateRSIComment(rsiData) {
    const commentDiv = document.getElementById('adv-rsi-comment');
    if (!commentDiv) return;
    if (!rsiData || rsiData.length === 0) {
        commentDiv.textContent = '💡 No RSI data available.';
        return;
    }
    const last = rsiData[rsiData.length - 1];
    if (last.rsi === null) {
        commentDiv.textContent = '💡 RSI value not available.';
        return;
    }
    const rsi = last.rsi;
    let comment = `📊 RSI: ${rsi.toFixed(2)} – `;
    if (rsi < 30) comment += 'Oversold (🟢 possible reversal up)';
    else if (rsi > 70) comment += 'Overbought (🔴 possible reversal down)';
    else if (rsi < 40) comment += 'Weak (could go lower)';
    else if (rsi > 60) comment += 'Strong (could go higher)';
    else comment += 'Neutral (no clear signal)';
    commentDiv.textContent = comment;
    commentDiv.classList.remove('bullish', 'bearish');
    if (rsi < 30) commentDiv.classList.add('bullish');
    else if (rsi > 70) commentDiv.classList.add('bearish');
}

function updateStochComment(stochData) {
    const commentDiv = document.getElementById('adv-stoch-comment');
    if (!commentDiv) return;
    if (!stochData || !stochData.k || stochData.k.length === 0) {
        commentDiv.textContent = '💡 No Stochastic data available.';
        return;
    }
    const lastK = stochData.k[stochData.k.length - 1];
    const lastD = stochData.d.length ? stochData.d[stochData.d.length - 1] : lastK;
    const comment = `📊 %K: ${lastK.toFixed(2)}, %D: ${lastD.toFixed(2)} – ` +
        (lastK < 20 ? 'Oversold (🟢)' :
         lastK > 80 ? 'Overbought (🔴)' :
         lastK < 40 ? 'Weak' :
         lastK > 60 ? 'Strong' : 'Neutral');
    commentDiv.textContent = comment;
    commentDiv.classList.remove('bullish', 'bearish');
    if (lastK < 20) commentDiv.classList.add('bullish');
    else if (lastK > 80) commentDiv.classList.add('bearish');
}

// ==========================================
// 🧠 স্মার্ট সাজেশন
// ==========================================
function generateSuggestion(data) {
    const container = document.getElementById('suggestion-content');
    if (!container) return;
    if (!data || !data.actualPrices || data.actualPrices.length < 20) {
        container.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.7;">Insufficient data for suggestion</div>`;
        return;
    }

    const prices = data.actualPrices;
    const currentPrice = prices[prices.length - 1];
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const rsiData = calculateRSI(prices, 14);
    const lastRSI = rsiData.length > 0 ? rsiData[rsiData.length - 1].rsi : 50;
    const macdData = calculateMACD(prices, 12, 26, 9);
    const bollinger = calculateBollingerBands(prices, 20, 2);
    const stoch = calculateStochastic(data.highData || [], data.lowData || [], prices, 14, 3);
    const atr = calculateATR(data.highData || [], data.lowData || [], prices, 14);
    const atrValue = atr.length > 0 ? atr[atr.length - 1] : (currentPrice * 0.02);
    const forecast = advActiveIndicators.forecast ? data.forecastValues : [];

    let psarTrend = null;
    if (advActiveIndicators.psar) {
        const priceDataForPSAR = data.actualLabels.map((date, i) => ({
            date: date,
            ltp: prices[i],
            high: data.highData[i] || prices[i],
            low: data.lowData[i] || prices[i]
        }));
        const psar = calculateParabolicSAR(priceDataForPSAR);
        if (psar.length) {
            const lastPSAR = psar[psar.length - 1];
            psarTrend = lastPSAR.sar < currentPrice ? 'Bullish' : (lastPSAR.sar > currentPrice ? 'Bearish' : 'Neutral');
        }
    }

    let buyScore = 0, sellScore = 0;
    let signals = [];

    if (lastRSI < 30) { buyScore += 2; signals.push('RSI oversold (<30)'); }
    else if (lastRSI > 70) { sellScore += 2; signals.push('RSI overbought (>70)'); }

    if (macdData && macdData.macd.length > 0) {
        const lastMacd = macdData.macd[macdData.macd.length - 1];
        const lastSig = macdData.signal[macdData.signal.length - 1];
        const prevMacd = macdData.macd[macdData.macd.length - 2];
        const prevSig = macdData.signal[macdData.signal.length - 2];
        if (prevMacd < prevSig && lastMacd > lastSig) {
            buyScore += 2; signals.push('MACD bullish crossover');
        } else if (prevMacd > prevSig && lastMacd < lastSig) {
            sellScore += 2; signals.push('MACD bearish crossover');
        }
    }

    if (sma20.length > 0 && sma50.length > 0) {
        const lastSMA20 = sma20[sma20.length - 1];
        const lastSMA50 = sma50[sma50.length - 1];
        const prevSMA20 = sma20[sma20.length - 2];
        const prevSMA50 = sma50[sma50.length - 2];
        if (prevSMA20 < prevSMA50 && lastSMA20 > lastSMA50) {
            buyScore += 3; signals.push('Golden Cross (SMA 20 > SMA 50)');
        } else if (prevSMA20 > prevSMA50 && lastSMA20 < lastSMA50) {
            sellScore += 3; signals.push('Death Cross (SMA 20 < SMA 50)');
        }
    }

    if (bollinger && bollinger.upper.length > 0) {
        const lastUpper = bollinger.upper[bollinger.upper.length - 1];
        const lastLower = bollinger.lower[bollinger.lower.length - 1];
        if (currentPrice <= lastLower) {
            buyScore += 2; signals.push('Price near lower BB (oversold)');
        } else if (currentPrice >= lastUpper) {
            sellScore += 2; signals.push('Price near upper BB (overbought)');
        }
    }

    if (stoch && stoch.k.length > 0) {
        const lastK = stoch.k[stoch.k.length - 1];
        const lastD = stoch.d[stoch.d.length - 1];
        if (lastK < 20 && lastK > lastD) {
            buyScore += 2; signals.push('Stochastic oversold crossover');
        } else if (lastK > 80 && lastK < lastD) {
            sellScore += 2; signals.push('Stochastic overbought crossover');
        }
    }

    if (forecast && forecast.length > 0) {
        const avgForecast = forecast.reduce((a,b) => a+b, 0) / forecast.length;
        if (avgForecast > currentPrice * 1.03) {
            buyScore += 1; signals.push('ARIMA predicts upward trend');
        } else if (avgForecast < currentPrice * 0.97) {
            sellScore += 1; signals.push('ARIMA predicts downward trend');
        }
    }

    if (psarTrend === 'Bullish') {
        buyScore += 1; signals.push('PSAR bullish');
    } else if (psarTrend === 'Bearish') {
        sellScore += 1; signals.push('PSAR bearish');
    }

    let decision = 'NEUTRAL', decisionClass = 'signal-neutral';
    let confidence = 'Medium', details = '';

    if (buyScore >= 3 && buyScore > sellScore) {
        decision = 'BUY';
        decisionClass = 'signal-buy';
        confidence = buyScore >= 5 ? 'High' : 'Medium';
    } else if (sellScore >= 3 && sellScore > buyScore) {
        decision = 'SELL';
        decisionClass = 'signal-sell';
        confidence = sellScore >= 5 ? 'High' : 'Medium';
    }
    details = `Buy Score: ${buyScore} | Sell Score: ${sellScore}`;

    const targetPrice = currentPrice + (atrValue * 2);
    const stopLoss = currentPrice - (atrValue * 1.5);

    let html = `
        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <span class="signal-badge ${decisionClass}">${decision}</span>
            <span style="font-size:14px; opacity:0.8;">Confidence: <strong>${confidence}</strong></span>
            <span style="font-size:13px; opacity:0.7;">${details}</span>
        </div>
        <div class="adv-suggestion-grid">
            <div class="adv-suggestion-item">
                <div class="label">📈 Target Price</div>
                <div class="value">৳${targetPrice.toFixed(2)}</div>
                <div class="sub">+${((targetPrice/currentPrice-1)*100).toFixed(2)}% from current</div>
            </div>
            <div class="adv-suggestion-item">
                <div class="label">🛑 Stop Loss</div>
                <div class="value">৳${stopLoss.toFixed(2)}</div>
                <div class="sub">${((stopLoss/currentPrice-1)*100).toFixed(2)}% from current</div>
            </div>
            <div class="adv-suggestion-item">
                <div class="label">📊 ATR (Volatility)</div>
                <div class="value">৳${atrValue.toFixed(2)}</div>
                <div class="sub">14-day Average True Range</div>
            </div>
            <div class="adv-suggestion-item">
                <div class="label">📊 RSI</div>
                <div class="value">${lastRSI.toFixed(2)}</div>
                <div class="sub">${lastRSI < 30 ? 'Oversold' : lastRSI > 70 ? 'Overbought' : 'Neutral'}</div>
            </div>
        </div>
        <div style="margin-top: 12px; font-size: 13px; opacity: 0.7; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
            <strong>Signals:</strong> ${signals.length > 0 ? signals.join(' | ') : 'No strong signals'}
        </div>
    `;
    container.innerHTML = html;
}

// ==========================================
// 🎨 থিম টগল
// ==========================================
window.toggleDarkMode = function() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    try { localStorage.setItem('theme', newTheme); } catch(e) {}
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (icon) icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = newTheme === 'dark' ? 'Light' : 'Dark';
    if (advChartData) {
        if (currentChartType === 'line') renderAdvancedChart(advChartData);
        else renderCandlestickChart(advChartData);
        generateSuggestion(advChartData);
    }
};

window.loadSavedTheme = function() {
    let theme = 'light';
    try {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = saved || (prefersDark ? 'dark' : 'light');
    } catch(e) {}
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = theme === 'dark' ? 'Light' : 'Dark';
};

// ==========================================
// 📌 টোস্ট
// ==========================================
function showToast(msg, type) {
    if (typeof window.showToast === 'function') {
        window.showToast(msg, type);
    } else {
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            padding: 12px 24px; background: ${bgColor}; color: white;
            border-radius: 8px; z-index: 99999; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: fadeIn 0.3s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 3000);
    }
}

// ==========================================
// 📌 গ্লোবাল এক্সপোজ
// ==========================================
window.loadAdvancedChart = loadAdvancedChart;
window.selectAdvChartStock = selectAdvChartStock;
window.toggleDarkMode = toggleDarkMode;
window.loadCandlestickLibrary = loadCandlestickLibrary;
window.renderCandlestickChart = renderCandlestickChart;
window.getHistoricalPricesFromSupabase = getHistoricalPricesFromSupabase;

console.log('✅ adv-charts.js (Database + Live API) loaded successfully');