// ==========================================
// 📁 ui-helpers.js - UI হেলপার ও কোর ফাংশন
//    ui.js থেকে ভাগ করা (থিম, টোস্ট, সাইডবার, কমিশন, ব্যাকআপ, ডেটা মোড)
//    🔥 Database vs Live Data – দুই মোড সাপোর্ট
//    ✅ লগইন/সাইনআপ ফাংশনালিটি DOMContentLoaded-এর ভেতরে নেওয়া হয়েছে
// ==========================================

// ==========================================
// 📌 গ্লোবাল ভেরিয়েবল (core.js থেকে নেওয়া)
// ==========================================
// currentDataMode, isManualReloading, autoRefreshEnabled ইত্যাদি core.js-এ ডিফাইন

// ==========================================
// ০. থিম ফাংশন (সবার আগে)
// ==========================================

function updateChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    if (window.dashboardChartInstance) {
        try {
            window.dashboardChartInstance.options.plugins.legend.labels.color = textColor;
            window.dashboardChartInstance.options.scales.x.ticks.color = textColor;
            window.dashboardChartInstance.options.scales.y.ticks.color = textColor;
            window.dashboardChartInstance.options.scales.x.grid.color = gridColor;
            window.dashboardChartInstance.options.scales.y.grid.color = gridColor;
            window.dashboardChartInstance.update();
        } catch (e) { /* ignore */ }
    }
    if (window.advChartInstance) {
        try {
            window.advChartInstance.options.plugins.legend.labels.color = textColor;
            window.advChartInstance.options.scales.x.ticks.color = textColor;
            window.advChartInstance.options.scales.y.ticks.color = textColor;
            window.advChartInstance.options.scales.x.grid.color = gridColor;
            window.advChartInstance.options.scales.y.grid.color = gridColor;
            window.advChartInstance.update();
        } catch (e) { /* ignore */ }
    }
    if (window.rsiChartInstance) {
        try {
            window.rsiChartInstance.options.plugins.legend.labels.color = textColor;
            window.rsiChartInstance.options.scales.x.ticks.color = textColor;
            window.rsiChartInstance.options.scales.y.ticks.color = textColor;
            window.rsiChartInstance.options.scales.x.grid.color = gridColor;
            window.rsiChartInstance.options.scales.y.grid.color = gridColor;
            window.rsiChartInstance.update();
        } catch (e) { /* ignore */ }
    }
    if (window.gainChartInstance) {
        try {
            window.gainChartInstance.options.plugins.legend.labels.color = textColor;
            window.gainChartInstance.options.scales.x.ticks.color = textColor;
            window.gainChartInstance.options.scales.y.ticks.color = textColor;
            window.gainChartInstance.options.scales.x.grid.color = gridColor;
            window.gainChartInstance.options.scales.y.grid.color = gridColor;
            window.gainChartInstance.update();
        } catch (e) { /* ignore */ }
    }
}

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
    
    if (typeof updateChartColors === 'function') updateChartColors();
};

window.loadSavedTheme = function() {
    let theme = 'light';
    try {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = saved || (prefersDark ? 'dark' : 'light');
    } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) text.textContent = theme === 'dark' ? 'Light' : 'Dark';
};

function watchSystemTheme() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            const button = document.getElementById('theme-toggle');
            if (button) button.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
    });
}

// ==========================================
// ১. টোস্ট
// ==========================================

window.showToast = function(message, type = 'info') {
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const bgColors = { 
        success: '#10b981', 
        error: '#ef4444', 
        warning: '#f59e0b', 
        info: '#3b82f6' 
    };
    const bgColor = bgColors[type] || '#3b82f6';
    const icon = icons[type] || 'ℹ️';
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 14px 24px;
        background: ${bgColor};
        color: white;
        border-radius: 12px;
        z-index: 100000;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        animation: slideDown 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 90%;
        border: 1px solid rgba(255,255,255,0.1);
    `;
    toast.innerHTML = `<span style="font-size:18px;">${icon}</span> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }
    }, 3000);
};

// ==========================================
// ২. সাইডবার ও ট্যাব
// ==========================================

window.toggleLeftSidebar = function() {
    const sidebar = document.getElementById('left-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.contains('active');
    if (isOpen) {
        sidebar.classList.remove('active');
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    } else {
        sidebar.classList.add('active');
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
};

window.toggleRightSidebar = function() {
    const rightSidebar = document.getElementById('right-sidebar');
    if (rightSidebar) rightSidebar.classList.toggle('active');
};

window.switchTab = function(tabName) {
    // 🧹 ১. সব ইন্টারভাল ক্লিয়ার করুন
    if (window.portfolioAnalysisInterval) {
        clearInterval(window.portfolioAnalysisInterval);
        window.portfolioAnalysisInterval = null;
    }
    if (window.stockTableRefreshInterval) {
        clearInterval(window.stockTableRefreshInterval);
        window.stockTableRefreshInterval = null;
    }
    if (window.autoRefreshInterval) {
        clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = null;
    }
    if (window.dataRefreshInterval) {
        clearInterval(window.dataRefreshInterval);
        window.dataRefreshInterval = null;
    }

    // 📑 ট্যাব কন্টেন্ট লুকান
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.add('hidden'));

    // 🎯 মেনু আইটেম থেকে অ্যাক্টিভ ক্লাস রিমুভ
    const menuItems = document.querySelectorAll('.left-sidebar ul li');
    menuItems.forEach(item => item.classList.remove('active'));

    // 🟢 নির্দিষ্ট ট্যাব দেখান
    const activeSection = document.getElementById(`sec-${tabName}`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    } else {
        console.warn(`⚠️ Tab section #sec-${tabName} not found`);
    }

    // 📌 মেনু আইটেম অ্যাক্টিভ করুন (যদি event থেকে আসে)
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }

    // 👤 ইউজার চেক
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) {
        console.log('👤 No user logged in, skipping data load');
        return;
    }

    // ⏳ ডেটা লোড (সব ট্যাবের জন্য)
    setTimeout(() => {
        try {
            switch (tabName) {
                case 'dashboard':
                    if (typeof loadDashboardData === 'function') {
                        const portfolioId = window.currentDashboardPortfolioId || null;
                        loadDashboardData(portfolioId, true);
                    } else {
                        console.warn('⚠️ loadDashboardData not found');
                    }
                    break;
                case 'portfolio-analysis':
                    if (typeof loadPortfolioAnalysisTable === 'function') {
                        loadPortfolioAnalysisTable(user.uid, null, true);
                    } else {
                        console.warn('⚠️ loadPortfolioAnalysisTable not found');
                    }
                    break;
                case 'buy':
                    // Buy ট্যাবে কোনো অটো লোড নেই
                    break;
                case 'sell':
                    // Sell ট্যাবে কোনো অটো লোড নেই
                    break;
                case 'table':
                    if (typeof loadUnifiedStockTable === 'function') {
                        const pid = document.getElementById('stock-table-portfolio-select')?.value || null;
                        loadUnifiedStockTable(user.uid, pid === 'grand' ? null : pid);
                    } else {
                        console.warn('⚠️ loadUnifiedStockTable not found');
                    }
                    break;
                case 'trade-history':
                    if (typeof loadTradeHistory === 'function') {
                        loadTradeHistory();
                    } else {
                        console.warn('⚠️ loadTradeHistory not found');
                    }
                    break;
                case 'analysis':
                    // ইউজার সার্চ করবে
                    break;
                case 'statement':
                    if (typeof loadStatementData === 'function') {
                        loadStatementData();
                    } else {
                        console.warn('⚠️ loadStatementData not found');
                    }
                    break;
                case 'suggestion':
                    const threshold = document.getElementById('suggestion-threshold')?.value || 50;
                    const sugPid = document.getElementById('suggestion-portfolio-select')?.value || null;
                    if (typeof loadSuggestionData === 'function') {
                        loadSuggestionData(parseFloat(threshold), sugPid === 'grand' ? null : sugPid);
                    } else {
                        console.warn('⚠️ loadSuggestionData not found');
                    }
                    break;
                case 'dividend':
                    const divPid = document.getElementById('dividend-portfolio-select')?.value || null;
                    if (typeof loadDividendData === 'function') {
                        loadDividendData(divPid === 'grand' ? null : divPid);
                    } else {
                        console.warn('⚠️ loadDividendData not found');
                    }
                    break;
                case 'history':
                    if (typeof loadPortfolioHistory === 'function') {
                        loadPortfolioHistory();
                    } else {
                        console.warn('⚠️ loadPortfolioHistory not found');
                    }
                    break;
                case 'screener':
                    if (typeof loadScreenerData === 'function') {
                        const scrPid = document.getElementById('screener-portfolio-select')?.value || null;
                        loadScreenerData('buy', scrPid === 'grand' ? null : scrPid);
                    } else {
                        console.warn('⚠️ loadScreenerData not found');
                        const tbody = document.getElementById('screener-table-body');
                        if (tbody) {
                            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:red;">Screener module not loaded. Please refresh.</td></tr>`;
                        }
                    }
                    break;
                case 'all-scanner':
                    if (typeof loadAllScannerPage === 'function') {
                        loadAllScannerPage();
                    } else {
                        console.warn('⚠️ loadAllScannerPage not found');
                        const buyBody = document.getElementById('all-scanner-buy-body');
                        if (buyBody) {
                            buyBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:red;">Scanner module not loaded.</td></tr>`;
                        }
                    }
                    break;
                case 'rsi-indicator':
                    if (typeof loadRSIIndicatorPage === 'function') {
                        loadRSIIndicatorPage();
                    } else {
                        console.warn('⚠️ loadRSIIndicatorPage not found');
                        const buyBody = document.getElementById('rsi-buy-body');
                        if (buyBody) {
                            buyBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:red;">RSI module not loaded.</td></tr>`;
                        }
                    }
                    break;
                case 'smart-signals':
                    if (typeof loadSmartSignalsPage === 'function') {
                        loadSmartSignalsPage();
                    } else {
                        console.warn('⚠️ loadSmartSignalsPage not found');
                        const tbody = document.getElementById('smart-signals-tbody');
                        if (tbody) {
                            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:red;">Smart Signals module not loaded.</td></tr>`;
                        }
                    }
                    break;
                case 'market-watch':
                    if (typeof loadMarketWatchPage === 'function') {
                        loadMarketWatchPage();
                    } else {
                        console.warn('⚠️ loadMarketWatchPage not found');
                        const container = document.getElementById('market-watchlist-container');
                        if (container) {
                            container.innerHTML = `<div style="text-align:center; padding:40px; color:red;">Market Watch module not loaded.</div>`;
                        }
                    }
                    break;
                case 'deep-analysis':
                    if (typeof loadDeepAnalysisPage === 'function') {
                        const daPid = document.getElementById('deep-analysis-portfolio-select')?.value || null;
                        window._deepAnalysisPortfolio = daPid === 'grand' ? null : daPid;
                        loadDeepAnalysisPage();
                    } else {
                        console.warn('⚠️ loadDeepAnalysisPage not found');
                        const tbody = document.getElementById('deep-analysis-tbody');
                        if (tbody) {
                            tbody.innerHTML = `<tr><td colspan="21" style="text-align:center; padding:40px; color:red;">Deep Analysis module not loaded.</td></tr>`;
                        }
                    }
                    break;
                case 'record-date':
                    if (typeof loadRecordDateSection === 'function') {
                        loadRecordDateSection();
                    } else {
                        console.warn('⚠️ loadRecordDateSection not found');
                        const tbody = document.getElementById('sec-record-date-tbody');
                        if (tbody) {
                            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; color:red;">Record Date module not loaded.</td></tr>`;
                        }
                    }
                    break;
                default:
                    console.log(`ℹ️ Tab "${tabName}" loaded (no specific data load)`);
                    break;
            }
        } catch (error) {
            console.error(`❌ Error loading tab "${tabName}":`, error);
            if (typeof showToast === 'function') {
                showToast(`Error loading ${tabName}: ${error.message}`, 'error');
            }
        }
    }, 300);
};

// ==========================================
// ৩. কমিশন সেটিংস
// ==========================================

window.toggleCommissionSettings = function() {
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
};

window.saveCommissionSettings = function() {
    const percentInput = document.getElementById('commission-percent');
    const percent = parseFloat(percentInput?.value) || 0;
    if (typeof commissionManager !== 'undefined' && commissionManager) {
        commissionManager.updatePercent(percent);
    }
    if (typeof showToast === 'function') showToast(`Commission set to ${percent}% for both Buy & Sell`, 'success');
    if (auth && auth.currentUser) {
        if (typeof loadDashboardData === 'function') loadDashboardData();
        if (typeof loadUnifiedStockTable === 'function') loadUnifiedStockTable(auth.currentUser.uid);
        if (typeof loadPortfolioAnalysisTable === 'function') loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = 'none';
};

window.resetCommissionSettings = function() {
    if (typeof commissionManager !== 'undefined' && commissionManager) {
        commissionManager.updatePercent(0);
    }
    const percentInput = document.getElementById('commission-percent');
    if (percentInput) percentInput.value = 0;
    if (typeof showToast === 'function') showToast('Commission reset to 0%', 'info');
    if (auth && auth.currentUser) {
        if (typeof loadDashboardData === 'function') loadDashboardData();
        if (typeof loadUnifiedStockTable === 'function') loadUnifiedStockTable(auth.currentUser.uid);
        if (typeof loadPortfolioAnalysisTable === 'function') loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = 'none';
};

function updateCommissionDisplay() {
    const percent = (typeof commissionManager !== 'undefined' && commissionManager) ? commissionManager.getPercent() : 0;
    let infoDiv = document.getElementById('commission-info-display');
    if (!infoDiv) {
        const dashboardSection = document.getElementById('sec-dashboard');
        if (dashboardSection) {
            const cardsDiv = dashboardSection.querySelector('.portfolio-summary-cards');
            if (cardsDiv) {
                infoDiv = document.createElement('div');
                infoDiv.id = 'commission-info-display';
                infoDiv.className = 'commission-info-bar';
                cardsDiv.insertAdjacentElement('afterend', infoDiv);
            }
        }
    }
    if (infoDiv) {
        infoDiv.innerHTML = percent > 0 ?
            `<span>💸 Commission Active</span><span class="commission-badge">${percent}% on Buy & Sell</span>` :
            `<span>💸 No Commission</span><span class="commission-badge">0%</span>`;
        infoDiv.style.display = 'flex';
    }
}
setTimeout(updateCommissionDisplay, 500);

// ==========================================
// ৪. ড্যাশবোর্ড সার্চ
// ==========================================

window.initDashboardSearch = function() {
    const searchInput = document.getElementById('dashboard-search-input');
    const suggestionsBox = document.getElementById('dashboard-search-suggestions');
    
    if (!searchInput) { console.error('❌ Input missing'); return; }
    if (!suggestionsBox) { console.error('❌ Suggestions box missing'); return; }

    let stockList = [];
    if (typeof dseStocks !== 'undefined') stockList = dseStocks;
    else if (window.dseStocks) stockList = window.dseStocks;
    else { console.error('❌ No stock list'); return; }

    const debouncedSearch = debounce(function(query) {
        suggestionsBox.innerHTML = '';
        if (!query) { suggestionsBox.classList.add('hidden'); return; }
        const filtered = stockList.filter(s => s.startsWith(query));
        if (filtered.length > 0) {
            suggestionsBox.classList.remove('hidden');
            filtered.slice(0, 15).forEach(stock => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.innerText = stock;
                div.addEventListener('click', function() {
                    searchInput.value = stock;
                    suggestionsBox.classList.add('hidden');
                    if (typeof openStockDetailModal === 'function') openStockDetailModal(stock);
                });
                suggestionsBox.appendChild(div);
            });
        } else {
            suggestionsBox.classList.add('hidden');
        }
    }, 300);

    searchInput.addEventListener('input', function() {
        debouncedSearch(this.value.trim().toUpperCase());
    });

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
        }
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const first = suggestionsBox.querySelector('.suggestion-item');
            if (first) first.click();
        }
    });
};

// ==========================================
// ৫. ব্যাকআপ/রিস্টোর
// ==========================================

window.downloadPortfolioData = async function() {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) { alert("লগইন করুন!"); return; }
    if (!confirm("আপনার পোর্টফোলিও ডাটা ব্যাকআপ ডাউনলোড করতে চান?")) return;
    const loadingBtn = document.getElementById('btn-download-data');
    const originalText = loadingBtn ? loadingBtn.innerText : "ডাউনলোড";
    if (loadingBtn) { loadingBtn.innerText = "⏳ লোড হচ্ছে..."; loadingBtn.disabled = true; }
    try {
        if (typeof db === 'undefined') { alert("Firebase not available"); return; }
        const buySnapshot = await db.collection('portfolios').where('userId', '==', user.uid).get();
        const sellSnapshot = await db.collection('sales_history').where('userId', '==', user.uid).get();
        const buyData = [];
        buySnapshot.forEach(doc => {
            const d = doc.data();
            buyData.push({
                shareName: d.shareName,
                quantity: d.quantity,
                buyPrice: d.buyPrice,
                date: d.date?.toDate?.().toISOString() || new Date().toISOString(),
                type: "BUY"
            });
        });
        const sellData = [];
        sellSnapshot.forEach(doc => {
            const d = doc.data();
            sellData.push({
                shareName: d.shareName,
                quantitySold: d.quantitySold,
                sellPrice: d.sellPrice,
                buyPrice: d.buyPrice,
                profitOrLoss: d.profitOrLoss,
                date: d.date?.toDate?.().toISOString() || new Date().toISOString()
            });
        });
        const backupData = {
            version: "1.1",
            downloadedAt: new Date().toISOString(),
            buyTransactions: buyData,
            sellTransactions: sellData
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        alert(`✅ সফল! ${buyData.length + sellData.length} টি রেকর্ড ডাউনলোড হয়েছে।`);
    } catch (e) {
        console.error(e);
        alert("ব্যাকআপ নিতে ব্যর্থ");
    } finally {
        if (loadingBtn) {
            loadingBtn.innerText = originalText;
            loadingBtn.disabled = false;
        }
    }
};

window.uploadPortfolioData = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) { alert("লগইন করুন!"); return; }
    if (!confirm("ফাইল আপলোড করবেন?")) { event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.buyTransactions || !data.sellTransactions) throw new Error("ভুল ফাইল ফরম্যাট!");
            if (typeof db === 'undefined') { alert("Firebase not available"); return; }
            const batch = db.batch();
            data.buyTransactions.forEach(item => {
                if (item.shareName) batch.set(db.collection('portfolios').doc(), {
                    userId: user.uid,
                    shareName: item.shareName,
                    quantity: Number(item.quantity),
                    buyPrice: Number(item.buyPrice),
                    type: "BUY",
                    date: new Date(item.date),
                    createdAt: new Date()
                });
            });
            data.sellTransactions.forEach(item => {
                if (item.shareName) batch.set(db.collection('sales_history').doc(), {
                    userId: user.uid,
                    shareName: item.shareName,
                    quantitySold: Number(item.quantitySold),
                    sellPrice: Number(item.sellPrice),
                    buyPrice: Number(item.buyPrice),
                    profitOrLoss: Number(item.profitOrLoss),
                    date: new Date(item.date),
                    createdAt: new Date()
                });
            });
            await batch.commit();
            alert("✅ ডাটা রিস্টোর করা হয়েছে!");
            location.reload();
        } catch (err) {
            console.error(err);
            alert("❌ ফাইল আপলোড ব্যর্থ");
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
};

// ==========================================
// ৬. ফ্লোটিং লোডার
// ==========================================

window.showFloatingLoader = function(text = 'Loading...', subText = 'Please wait') {
    const loader = document.getElementById('floating-loader');
    const overlay = document.getElementById('loader-overlay');
    const statusText = document.getElementById('loader-status-text');
    const subTextEl = document.getElementById('loader-sub-text');
    if (loader) {
        loader.style.display = 'flex';
        if (statusText) statusText.innerText = text;
        if (subTextEl) subTextEl.innerText = subText;
    }
    if (overlay) overlay.style.display = 'block';
};

window.hideFloatingLoader = function() {
    const loader = document.getElementById('floating-loader');
    const overlay = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
};

// ==========================================
// ৭. স্ক্রিনার ড্রপডাউন টগল
// ==========================================

window.toggleScreenerDropdown = function() {
    const dropdown = document.getElementById('screener-dropdown');
    const arrow = document.getElementById('screener-arrow');
    if (!dropdown) return;
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
        if (arrow) arrow.textContent = '▼';
    } else {
        dropdown.style.display = 'none';
        if (arrow) arrow.textContent = '▶';
    }
};

// ==========================================
// ৮. পোর্টফোলিও ডিলিট কনফার্ম
// ==========================================

window.confirmAndDeletePortfolio = async function() {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) return alert("দয়া করে আগে লগইন করুন!");
    const firstCheck = confirm("সতর্কতা! আপনি কি আপনার পোর্টফোলিওর সমস্ত বাই (BUY) এবং সেল (SELL) হিস্ট্রি চিরতরে মুছে ফেলতে চান?");
    if (!firstCheck) return;
    const secondCheck = confirm("আপনি কিন্তু এই ডাটা আর কখনো ফিরে পাবেন না! আপনি কি আসলেই সম্পূর্ণ পোর্টফোলিও ডিলিট করতে নিশ্চিত?");
    if (!secondCheck) return;
    try {
        if (typeof db === 'undefined') { alert("Firebase not available"); return; }
        alert("পোর্টফোলিও মোছার কাজ শুরু হয়েছে, দয়া করে কিছুক্ষণ অপেক্ষা করুন...");
        const buySnapshot = await db.collection("portfolios").where("userId", "==", user.uid).get();
        const sellSnapshot = await db.collection("sales_history").where("userId", "==", user.uid).get();
        const batch = db.batch();
        buySnapshot.forEach(doc => batch.delete(db.collection("portfolios").doc(doc.id)));
        sellSnapshot.forEach(doc => batch.delete(db.collection("sales_history").doc(doc.id)));
        await batch.commit();
        alert("আপনার পোর্টফোলিওর সমস্ত ডাটা সফলভাবে মুছে ফেলা হয়েছে!");
        window.location.reload();
    } catch (error) {
        console.error(error);
        alert("দুঃখিত, পোর্টফোলিওটি মুছে ফেলা সম্ভব হয়নি।");
    }
};

// ==========================================
// ৯. ডেটা মোড সুইচ (Database vs Live API)
// ==========================================

// currentDataMode core.js থেকে গ্লোবালি ডিফাইন
async function setDatabaseMode() {
    try {
        if (currentDataMode === 'database') return;
        currentDataMode = 'database';
        localStorage.setItem('dataMode', 'database');
        showToast('💾 Switching to Database Mode...', 'info');
        // UI আপডেট
        const dbBtn = document.getElementById('btn-database-mode');
        const liveBtn = document.getElementById('btn-live-mode');
        if (dbBtn) {
            dbBtn.classList.add('active');
            dbBtn.style.background = 'var(--primary-color)';
            dbBtn.style.color = 'white';
        }
        if (liveBtn) {
            liveBtn.classList.remove('active');
            liveBtn.style.background = 'transparent';
            liveBtn.style.color = 'var(--text-primary)';
        }
        const user = auth?.currentUser;
        if (user) {
            if (typeof loadDashboardData === 'function') await loadDashboardData(null, true);
            if (typeof loadUnifiedStockTable === 'function') await loadUnifiedStockTable(user.uid);
            if (typeof loadPortfolioAnalysisTable === 'function') await loadPortfolioAnalysisTable(user.uid, null, true);
        }
    } catch (error) {
        console.error('Database mode error:', error);
        showToast('❌ Failed to switch: ' + error.message, 'error');
    } finally {
        // 🔥 সবসময় বাটন সক্রিয় রাখুন
        const liveBtn = document.getElementById('btn-live-mode');
        if (liveBtn) liveBtn.disabled = false;
    }
}

// ==========================================
// 📡 লাইভ মোডে সুইচ (সম্পূর্ণ আপডেটেড)
// ==========================================
async function setLiveDataMode() {
    try {
        // ১. ইতিমধ্যে লাইভ মোডে থাকলে রিটার্ন
        if (currentDataMode === 'live') {
            console.log('ℹ️ Already in Live mode.');
            return;
        }

        console.log('🔵 Switching to Live mode...');
        currentDataMode = 'live';
        window.currentDataMode = 'live'; // গ্লোবাল স্কোপেও সেট করুন
        localStorage.setItem('dataMode', 'live');

        // ২. UI আপডেট (বাটনের স্টাইল)
        const dbBtn = document.getElementById('btn-database-mode');
        const liveBtn = document.getElementById('btn-live-mode');

        if (liveBtn) {
            liveBtn.classList.add('active');
            liveBtn.style.background = 'var(--primary-color)';
            liveBtn.style.color = 'white';
            // 🔥 লাইভ বাটন সবসময় সক্রিয় রাখুন (Disabled রিমুভ)
            liveBtn.disabled = false;
        }
        if (dbBtn) {
            dbBtn.classList.remove('active');
            dbBtn.style.background = 'transparent';
            dbBtn.style.color = 'var(--text-primary)';
            // 🔥 ডাটাবেজ বাটনও সক্রিয় রাখুন (যাতে ক্লিক করে ফিরে যেতে পারে)
            dbBtn.disabled = false;
        }

        if (typeof showToast === 'function') {
            showToast('📡 Switching to Live Data (API)...', 'info');
        }

        // ৩. ইউজার চেক করে ডেটা লোড
        const user = auth?.currentUser;
        if (user) {
            // লাইভ ডেটা লোডার ফাংশনগুলো কল করুন
            await loadLiveDashboardData();
            await loadLiveStockTable();
            await loadLivePortfolioAnalysis();
            
            if (typeof showToast === 'function') {
                showToast('✅ Live mode activated successfully!', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('⚠️ No user logged in.', 'warning');
            }
        }
    } catch (error) {
        console.error('❌ Live mode error:', error);
        if (typeof showToast === 'function') {
            showToast('❌ Failed to switch: ' + error.message, 'error');
        }
    } finally {
        // 🔥🔥 সবচেয়ে গুরুত্বপূর্ণ: যেকোনো অবস্থায় বাটন দুটোকে সক্রিয় রাখুন
        // কারণ HTML-এ disabled অ্যাট্রিবিউট থাকলে বা showDataLoading(true) কল করলে
        // এখানে এসে আবার সক্রিয় করে দেওয়া হবে।
        const liveBtn = document.getElementById('btn-live-mode');
        const dbBtn = document.getElementById('btn-database-mode');
        if (liveBtn) liveBtn.disabled = false;
        if (dbBtn) dbBtn.disabled = false;
        
        // কনসোলে নিশ্চিত করুন
        console.log('✅ Buttons re-enabled in finally block.');
    }
}

// ==========================================
// 📡 লাইভ ডেটা লোডার ফাংশন (API থেকে)
// ==========================================

async function loadLiveDashboardData() {
    const user = auth && auth.currentUser;
    if (!user) return;
    
    try {
        const allStocks = await fetchAllLatestStocks();
        if (!allStocks || allStocks.length === 0) {
            if (typeof showToast === 'function') showToast('No live data available', 'error');
            return;
        }
        
        const unifiedData = await unifiedEngine.calculate(user.uid, null, true);
        if (!unifiedData || unifiedData.stockDetails.length === 0) {
            if (typeof showToast === 'function') showToast('No holdings found', 'warning');
            return;
        }
        
        const priceMap = new Map();
        allStocks.forEach(item => {
            const ticker = item['TRADING CODE'];
            const ltp = parseFloat(item['LTP*']) || 0;
            const ycp = parseFloat(item['YCP*']) || ltp;
            priceMap.set(ticker, { currentPrice: ltp, prevClose: ycp });
        });
        
        let totalCurrentValue = 0, totalInvestment = 0, dailyGL = 0;
        for (const stock of unifiedData.stockDetails) {
            const priceData = priceMap.get(stock.ticker);
            const currentPrice = priceData?.currentPrice || stock.avgBuyPriceWithCommission;
            const prevPrice = priceData?.prevClose || currentPrice;
            const qty = stock.totalQty || 0;
            totalCurrentValue += qty * currentPrice;
            totalInvestment += stock.totalCost || 0;
            dailyGL += qty * (currentPrice - prevPrice);
        }
        const totalProfitLoss = totalCurrentValue - totalInvestment;
        
        if (typeof updateDashboardCards === 'function') {
            updateDashboardCards({
                totalCurrentValue,
                totalInvestment,
                totalProfitLoss,
                dailyGL,
                dailyPct: totalInvestment > 0 ? (dailyGL / totalInvestment) * 100 : 0
            });
        }
        
        if (typeof updateDSEXIndicator === 'function') {
            // DSEX API থেকে আসছে না, তাই ডামি
            const dsexSpan = document.getElementById('dsex-value');
            if (dsexSpan) dsexSpan.innerText = '--';
        }
        
        if (typeof showToast === 'function') showToast('✅ Live dashboard updated!', 'success');
        
    } catch (error) {
        console.error('Live dashboard error:', error);
        if (typeof showToast === 'function') showToast('Error loading live data', 'error');
    }
}

async function loadLiveStockTable() {
    const user = auth && auth.currentUser;
    if (!user) return;
    
    try {
        const allStocks = await fetchAllLatestStocks();
        if (!allStocks) return;
        
        const priceMap = new Map();
        allStocks.forEach(item => {
            const ticker = item['TRADING CODE'];
            const ltp = parseFloat(item['LTP*']) || 0;
            const ycp = parseFloat(item['YCP*']) || ltp;
            priceMap.set(ticker, { currentPrice: ltp, prevClose: ycp });
        });
        
        const unifiedData = await unifiedEngine.calculate(user.uid, null, true);
        if (!unifiedData || unifiedData.stockDetails.length === 0) {
            const tbody = document.getElementById('portfolio-table-body');
            if (tbody) tbody.innerHTML = `<tr><td colspan="12">No holdings found.</td></tr>`;
            return;
        }
        
        renderLiveStockTable(unifiedData, priceMap);
        
    } catch (error) {
        console.error('Live stock table error:', error);
    }
}

async function loadLivePortfolioAnalysis() {
    const user = auth && auth.currentUser;
    if (!user) return;
    try {
        if (typeof loadPortfolioAnalysisTable === 'function') {
            await loadPortfolioAnalysisTable(user.uid, null, true);
        }
    } catch (error) {
        console.error('Live portfolio analysis error:', error);
    }
}

// ==========================================
// 🎨 রেন্ডার লাইভ স্টক টেবিল (হেলপার)
// ==========================================
function renderLiveStockTable(unifiedData, priceMap) {
    const tbody = document.getElementById('portfolio-table-body');
    if (!tbody) return;
    
    let html = '';
    let grandTotalBuyQty = 0, grandTotalRemainingQty = 0, grandTotalInvestment = 0;
    let grandTotalCurrentValue = 0, grandTotalUnrealized = 0, grandTotalDailyGL = 0;
    
    for (const stock of unifiedData.stockDetails) {
        const ticker = stock.ticker;
        const priceData = priceMap.get(ticker);
        const currentPrice = priceData?.currentPrice || 0;
        const prevClose = priceData?.prevClose || currentPrice;
        const qty = stock.totalQty || 0;
        const avgBuy = stock.avgBuyPriceWithCommission || 0;
        const totalCost = stock.totalCost || 0;
        const currentValue = qty * currentPrice;
        const unrealized = currentValue - totalCost;
        const dailyGL = qty * (currentPrice - prevClose);
        const dailyChangePercent = prevClose > 0 ? (dailyGL / (qty * prevClose)) * 100 : 0;
        
        grandTotalBuyQty += stock.totalBuyQty || 0;
        grandTotalRemainingQty += qty;
        grandTotalInvestment += totalCost;
        grandTotalCurrentValue += currentValue;
        grandTotalUnrealized += unrealized;
        grandTotalDailyGL += dailyGL;
        
        html += `<tr onclick="navigateToAnalysis('${ticker}')">`;
        html += `<td><b>${ticker}</b></td>`;
        html += `<td>${stock.totalBuyQty || 0}</td>`;
        html += `<td>৳${avgBuy.toFixed(2)}</td>`;
        html += `<td>${qty}</td>`;
        html += `<td>${qty > 0 ? `৳${currentPrice.toFixed(2)}` : '-'}</td>`;
        html += `<td>${qty > 0 ? `৳${unrealized.toFixed(2)}` : '-'}</td>`;
        html += `<td>${qty > 0 ? `${((unrealized/totalCost)*100).toFixed(2)}%` : '-'}</td>`;
        html += `<td>-</td>`;
        html += `<td>-</td>`;
        html += `<td>-</td>`;
        html += `<td style="color: ${dailyChangePercent >= 0 ? '#10b981' : '#ef4444'};">${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%</td>`;
        html += `<td style="color: ${dailyGL >= 0 ? '#10b981' : '#ef4444'};">${dailyGL >= 0 ? '+' : ''}৳${dailyGL.toFixed(2)}</td>`;
        html += `</tr>`;
    }
    
    // ফুটার
    html += `<tr style="font-weight:bold; border-top:2px solid;">`;
    html += `<td><b>📊 TOTAL</b></td>`;
    html += `<td><b>${grandTotalBuyQty}</b></td>`;
    html += `<td>-</td>`;
    html += `<td><b>${grandTotalRemainingQty}</b></td>`;
    html += `<td><b>৳${grandTotalCurrentValue.toLocaleString()}</b></td>`;
    html += `<td><b>${grandTotalUnrealized >= 0 ? '+' : ''}৳${grandTotalUnrealized.toLocaleString()}</b></td>`;
    html += `<td><b>${grandTotalInvestment > 0 ? ((grandTotalUnrealized / grandTotalInvestment) * 100).toFixed(2) : '0'}%</b></td>`;
    html += `<td>-</td>`;
    html += `<td>-</td>`;
    html += `<td>-</td>`;
    html += `<td><b>${grandTotalInvestment > 0 ? ((grandTotalDailyGL / grandTotalInvestment) * 100).toFixed(2) : '0'}%</b></td>`;
    html += `<td><b>${grandTotalDailyGL >= 0 ? '+' : ''}৳${grandTotalDailyGL.toLocaleString()}</b></td>`;
    html += `</tr>`;
    
    tbody.innerHTML = html;
    
    // ফুটার কার্ড আপডেট
    if (typeof updateFooterCards === 'function') {
        updateFooterCards(grandTotalInvestment, grandTotalCurrentValue, grandTotalUnrealized, 0, grandTotalRemainingQty);
    }
}

// গ্লোবালি এক্সপোজ (ডেটা মোড ফাংশন)
window.setDatabaseMode = setDatabaseMode;
window.setLiveDataMode = setLiveDataMode;
window.loadLiveDashboardData = loadLiveDashboardData;

// ==========================================
// ১০. 🔥 লগইন/সাইনআপ UI (DOMContentLoaded-এর ভেতরে)
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    // ---- থিম লোড ----
    if (typeof loadSavedTheme === 'function') loadSavedTheme();
    watchSystemTheme();

    // ---- ডেটা মোড বাটন ----
    const dbBtn = document.getElementById('btn-database-mode');
    const liveBtn = document.getElementById('btn-live-mode');
    if (dbBtn) dbBtn.addEventListener('click', setDatabaseMode);
    if (liveBtn) liveBtn.addEventListener('click', setLiveDataMode);

    // লোকাল স্টোরেজ থেকে মোড রিস্টোর
    const savedMode = localStorage.getItem('dataMode') || 'database';
    if (savedMode === 'live') {
        setTimeout(() => setLiveDataMode(), 100);
    } else {
        setTimeout(() => setDatabaseMode(), 100);
    }

    // ---- কমিশন ডিসপ্লে ----
    setTimeout(updateCommissionDisplay, 500);

    // ==========================================
    // 🔐 লগইন/সাইনআপ ইভেন্ট লিসেনার (এখানে যুক্ত করা হয়েছে)
    // ==========================================
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const btnLogout = document.getElementById('btn-logout');
    const authError = document.getElementById('auth-error');
    const authTitle = document.getElementById('auth-title');
    const toggleAuthText = document.getElementById('toggle-auth-text');
    let isLoginMode = true;

    // টগল টেক্সট
    if (toggleAuthText) {
        toggleAuthText.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            if (authError) authError.innerText = "";
            if (isLoginMode) {
                if (authTitle) authTitle.innerText = "Portfolio Login";
                if (btnLogin) btnLogin.classList.remove('hidden');
                if (btnSignup) btnSignup.classList.add('hidden');
                toggleAuthText.innerText = "Don't have an account? Register here";
            } else {
                if (authTitle) authTitle.innerText = "Portfolio Register";
                if (btnLogin) btnLogin.classList.add('hidden');
                if (btnSignup) btnSignup.classList.remove('hidden');
                toggleAuthText.innerText = "Already have an account? Login here";
            }
        });
    }

    // লগইন
    if (btnLogin) {
        btnLogin.addEventListener('click', function() {
            const email = document.getElementById('login-email')?.value.trim() || '';
            const password = document.getElementById('login-password')?.value || '';
            if (authError) authError.innerText = "";
            if (!email || !password) {
                if (authError) authError.innerText = "দয়া করে ইমেইল এবং পাসওয়ার্ড দুটিই দিন।";
                return;
            }
            if (typeof auth !== 'undefined' && auth) {
                auth.signInWithEmailAndPassword(email, password)
                    .then(() => {
                        // সফল হলে কিছু করার দরকার নেই, onAuthStateChanged সামলাবে
                    })
                    .catch((error) => {
                        if (authError) {
                            if (error.code === 'auth/user-not-found') {
                                authError.innerText = "এই ইমেইলে কোনো অ্যাকাউন্ট নেই।";
                            } else if (error.code === 'auth/wrong-password') {
                                authError.innerText = "ভুল পাসওয়ার্ড!";
                            } else {
                                authError.innerText = "লগইন ব্যর্থ: " + error.message;
                            }
                        }
                    });
            } else {
                if (authError) authError.innerText = "Firebase Auth not initialized.";
            }
        });
    }

    // সাইনআপ
    if (btnSignup) {
        btnSignup.addEventListener('click', function() {
            const email = document.getElementById('login-email')?.value.trim() || '';
            const password = document.getElementById('login-password')?.value || '';
            if (authError) authError.innerText = "";
            if (!email || !password) {
                if (authError) authError.innerText = "দয়া করে ইমেইল এবং পাসওয়ার্ড দুটিই দিন।";
                return;
            }
            if (password.length < 6) {
                if (authError) authError.innerText = "পাসওয়ার্ড অন্তত ৬ ডিজিটের হতে হবে।";
                return;
            }
            if (typeof auth !== 'undefined' && auth) {
                auth.createUserWithEmailAndPassword(email, password)
                    .then(() => {
                        alert("অ্যাকাউন্ট তৈরি সফল হয়েছে! এখন লগইন করুন।");
                        if (toggleAuthText) toggleAuthText.click(); // লগইন মোডে স্যুইচ
                    })
                    .catch((error) => {
                        if (authError) {
                            if (error.code === 'auth/email-already-in-use') {
                                authError.innerText = "এই ইমেইল ইতিমধ্যে ব্যবহার করা হয়েছে।";
                            } else {
                                authError.innerText = "অ্যাকাউন্ট তৈরি ব্যর্থ: " + error.message;
                            }
                        }
                    });
            } else {
                if (authError) authError.innerText = "Firebase Auth not initialized.";
            }
        });
    }

    // লগআউট
    if (btnLogout) {
        btnLogout.addEventListener('click', function() {
            if (typeof auth !== 'undefined' && auth) auth.signOut();
        });
    }

    // ==========================================
    // 🔐 অথেনটিকেশন স্টেট লিসেনার
    // ==========================================
    if (typeof auth !== 'undefined' && auth) {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log(`✅ User logged in: ${user.email || user.uid}`);
                if (loginContainer) loginContainer.classList.add('hidden');
                if (appContainer) appContainer.classList.remove('hidden');
                if (authError) authError.innerText = '';

                // ড্যাশবোর্ড লোড
                if (typeof initDashboardSearch === 'function') initDashboardSearch();
                const mode = currentDataMode || 'database';
                if (mode === 'database') {
                    if (typeof loadDashboardData === 'function') await loadDashboardData(null, true);
                    if (typeof loadUnifiedStockTable === 'function') await loadUnifiedStockTable(user.uid);
                    if (typeof loadPortfolioAnalysisTable === 'function') await loadPortfolioAnalysisTable(user.uid, null, true);
                } else {
                    if (typeof loadLiveDashboardData === 'function') await loadLiveDashboardData();
                    if (typeof loadLiveStockTable === 'function') await loadLiveStockTable();
                    if (typeof loadLivePortfolioAnalysis === 'function') await loadLivePortfolioAnalysis();
                }
                if (typeof startAutoRefresh === 'function') startAutoRefresh();
                if (typeof updateAllPortfolioSelectors === 'function') await updateAllPortfolioSelectors();
                if (typeof loadPortfolioManagerData === 'function') await loadPortfolioManagerData();
                console.log('✅ Dashboard loaded successfully');
            } else {
                console.log('👤 User logged out');
                if (loginContainer) loginContainer.classList.remove('hidden');
                if (appContainer) appContainer.classList.add('hidden');
                if (authError) authError.innerText = '';
                if (typeof stopAutoRefresh === 'function') stopAutoRefresh();
                if (typeof CacheManager !== 'undefined' && CacheManager.clearAll) CacheManager.clearAll();
            }
        });
    } else {
        console.warn('⚠️ Auth not available, state listener skipped.');
    }
});

// ==========================================
// ১১. পেজ আনলোডে ক্লিনআপ
// ==========================================

window.addEventListener('beforeunload', () => {
    if (window.portfolioAnalysisInterval) clearInterval(window.portfolioAnalysisInterval);
    if (window.stockTableRefreshInterval) clearInterval(window.stockTableRefreshInterval);
    if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
    if (window.firebaseDataManager) window.firebaseDataManager.clearCache();
});

// ==========================================
// 📌 গ্লোবাল এক্সপোজ (সব ফাংশন উইন্ডোতে)
// ==========================================

window.updateChartColors = updateChartColors;
window.toggleDarkMode = window.toggleDarkMode;
window.loadSavedTheme = window.loadSavedTheme;
window.showToast = window.showToast;
window.toggleLeftSidebar = window.toggleLeftSidebar;
window.toggleRightSidebar = window.toggleRightSidebar;
window.switchTab = window.switchTab;
window.toggleCommissionSettings = window.toggleCommissionSettings;
window.saveCommissionSettings = window.saveCommissionSettings;
window.resetCommissionSettings = window.resetCommissionSettings;
window.initDashboardSearch = window.initDashboardSearch;
window.downloadPortfolioData = window.downloadPortfolioData;
window.uploadPortfolioData = window.uploadPortfolioData;
window.showFloatingLoader = window.showFloatingLoader;
window.hideFloatingLoader = window.hideFloatingLoader;
window.toggleScreenerDropdown = window.toggleScreenerDropdown;
window.confirmAndDeletePortfolio = window.confirmAndDeletePortfolio;
window.setDatabaseMode = setDatabaseMode;
window.setLiveDataMode = setLiveDataMode;
window.loadLiveDashboardData = loadLiveDashboardData;
// ==========================================
// 📜 ট্রেড হিস্ট্রি ফাংশন
// ==========================================

let allTransactions = [];

async function loadTradeHistory() {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) return;
    const tbody = document.getElementById('trade-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading transactions...</td></tr>';

    try {
        if (typeof db === 'undefined') {
            tbody.innerHTML = '<tr><td colspan="6">Firebase not available</td></tr>';
            return;
        }
        const buySnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .get();
        const sellSnapshot = await db.collection('sales_history')
            .where('userId', '==', user.uid)
            .get();

        const transactions = [];
        buySnapshot.forEach(doc => {
            const data = doc.data();
            let dateObj = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            transactions.push({
                id: doc.id,
                date: dateObj,
                shareName: data.shareName,
                quantity: data.quantity,
                price: data.buyPrice,
                type: 'BUY',
                commission: data.commission || 0
            });
        });
        sellSnapshot.forEach(doc => {
            const data = doc.data();
            let dateObj = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            transactions.push({
                id: doc.id,
                date: dateObj,
                shareName: data.shareName,
                quantity: data.quantitySold,
                price: data.sellPrice,
                type: 'SELL',
                profitOrLoss: data.profitOrLoss
            });
        });
        transactions.sort((a, b) => b.date - a.date);
        allTransactions = transactions;

        const today = new Date();
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(today.getDate() - 3);
        const startInput = document.getElementById('trade-history-start');
        const endInput = document.getElementById('trade-history-end');
        if (startInput) startInput.value = threeDaysAgo.toISOString().split('T')[0];
        if (endInput) endInput.value = today.toISOString().split('T')[0];

        applyTradeFilter();
        const applyBtn = document.getElementById('apply-trade-filter');
        const resetBtn = document.getElementById('reset-trade-filter');
        if (applyBtn) applyBtn.onclick = applyTradeFilter;
        if (resetBtn) resetBtn.onclick = resetTradeFilter;
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="6">Error loading transactions.</td></tr>';
    }
}

function applyTradeFilter() {
    const startInput = document.getElementById('trade-history-start');
    const endInput = document.getElementById('trade-history-end');
    const startDate = startInput?.value ? new Date(startInput.value) : null;
    const endDate = endInput?.value ? new Date(endInput.value) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);
    const filtered = allTransactions.filter(tx => {
        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;
        return true;
    });
    renderTradeTable(filtered);
}

function resetTradeFilter() {
    const startInput = document.getElementById('trade-history-start');
    const endInput = document.getElementById('trade-history-end');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    applyTradeFilter();
}

function renderTradeTable(transactions) {
    const tbody = document.getElementById('trade-history-tbody');
    if (!tbody) return;
    if (!transactions.length) {
        tbody.innerHTML = '<tr><td colspan="6">No transactions in this period.</td></tr>';
        return;
    }
    let html = '';
    for (const tx of transactions) {
        const dateStr = tx.date.toLocaleDateString('bn-BD');
        const typeClass = tx.type === 'BUY' ? 'up' : 'error';
        html += `<tr>
            <td style="padding: 8px;">${dateStr}</td>
            <td style="padding: 8px;">${tx.shareName}</td>
            <td style="padding: 8px;">${tx.quantity}</td>
            <td style="padding: 8px;">৳${tx.price.toFixed(2)}</td>
            <td style="padding: 8px;" class="${typeClass}">${tx.type}</td>
            <td style="padding: 8px;">
                <button onclick="editTrade('${tx.id}', '${tx.type}')" style="background:#0284c7; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:4px;">✏️</button>
                <button onclick="deleteTrade('${tx.id}', '${tx.type}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

window.editTrade = function(id, type) {
    if (type === 'BUY') {
        const newQty = prompt("Enter new quantity:");
        const newPrice = prompt("Enter new price:");
        if (newQty && newPrice) {
            if (typeof db !== 'undefined') {
                db.collection('portfolios').doc(id).update({
                    quantity: parseInt(newQty),
                    buyPrice: parseFloat(newPrice)
                }).then(() => {
                    alert("Updated. Refresh to see changes.");
                    loadTradeHistory();
                }).catch(err => alert(err.message));
            }
        }
    } else {
        const newQty = prompt("Enter new quantity sold:");
        const newPrice = prompt("Enter new sell price:");
        if (newQty && newPrice) {
            if (typeof db !== 'undefined') {
                const docRef = db.collection('sales_history').doc(id);
                docRef.get().then(doc => {
                    const buyPrice = doc.data().buyPrice;
                    docRef.update({
                        quantitySold: parseInt(newQty),
                        sellPrice: parseFloat(newPrice),
                        profitOrLoss: (parseFloat(newPrice) - buyPrice) * parseInt(newQty)
                    }).then(() => {
                        alert("Updated");
                        loadTradeHistory();
                    });
                });
            }
        }
    }
};

window.deleteTrade = function(id, type) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    const collection = type === 'BUY' ? 'portfolios' : 'sales_history';
    if (typeof db !== 'undefined') {
        db.collection(collection).doc(id).delete().then(() => {
            alert("Deleted");
            loadTradeHistory();
        }).catch(err => alert(err.message));
    }
};

// গ্লোবালি এক্সপোজ
window.loadTradeHistory = loadTradeHistory;
window.applyTradeFilter = applyTradeFilter;
window.resetTradeFilter = resetTradeFilter;
window.editTrade = window.editTrade;
window.deleteTrade = window.deleteTrade;

console.log('✅ ui-helpers.js loaded successfully (Login fixed)');