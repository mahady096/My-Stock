// ==========================================
// 📁 ui.js - সম্পূর্ণ ইরর-ফ্রি ভার্সন (v3.1)
//    UI কম্পোনেন্ট, মডাল, থিম, ব্যাকআপ, কমিশন প্যানেল,
//    অ্যাডভান্সড স্টক মডাল (ATH/ATL তারিখ সহ),
//    সিগন্যাল, ড্যাশবোর্ড সার্চ, ট্রেড হিস্ট্রি, DSEX চার্ট, ইউজার মেনু
//    পোর্টফোলিও ফিল্টার সমর্থন সহ
//    🔥 ফ্যালব্যাক লগইন চেক যোগ করা হয়েছে
// ==========================================

// ==========================================
// 📌 গ্লোবাল ভেরিয়েবল
// ==========================================
let modalChartStartDate = null;
let modalChartEndDate = null;
let currentModalTicker = null;
let modalOpenCount = 0;

// গ্লোবাল ওভারলে তৈরি
const globalModalOverlay = document.createElement('div');
globalModalOverlay.id = 'global-modal-overlay';
globalModalOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    z-index: 9998; display: none;
`;

function appendGlobalOverlay() {
    if (document.body) {
        document.body.appendChild(globalModalOverlay);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            document.body.appendChild(globalModalOverlay);
        });
    }
}
appendGlobalOverlay();

// ==========================================
// ১. লগইন/সাইনআপ UI
// ==========================================
(function() {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const btnLogout = document.getElementById('btn-logout');
    const authError = document.getElementById('auth-error');
    const authTitle = document.getElementById('auth-title');
    const toggleAuthText = document.getElementById('toggle-auth-text');
    let isLoginMode = true;

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

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            const email = document.getElementById('login-email')?.value.trim() || '';
            const password = document.getElementById('login-password')?.value || '';
            if (authError) authError.innerText = "";
            if (!email || !password) {
                if (authError) authError.innerText = "দয়া করে ইমেইল এবং পাসওয়ার্ড দুটিই দিন।";
                return;
            }
            if (typeof auth !== 'undefined' && auth) {
                auth.signInWithEmailAndPassword(email, password).catch(() => {
                    if (authError) authError.innerText = "ভুল ইমেইল বা পাসওয়ার্ড! আবার চেষ্টা করুন।";
                });
            } else {
                if (authError) authError.innerText = "Firebase Auth not initialized.";
            }
        });
    }

    if (btnSignup) {
        btnSignup.addEventListener('click', () => {
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
                    .then(() => { alert("অ্যাকাউন্ট তৈরি সফল হয়েছে!"); })
                    .catch(() => { if (authError) authError.innerText = "অ্যাকাউন্ট তৈরি করা যায়নি।"; });
            } else {
                if (authError) authError.innerText = "Firebase Auth not initialized.";
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (typeof auth !== 'undefined' && auth) auth.signOut();
        });
    }

    // ==========================================
    // 🔐 অথেনটিকেশন স্টেট লিসেনার
    // ==========================================
    if (typeof auth !== 'undefined' && auth) {
        auth.onAuthStateChanged(async (user) => {
            const loginContainer = document.getElementById('login-container');
            const appContainer = document.getElementById('app-container');
            const authError = document.getElementById('auth-error');
            
            if (user) {
                console.log(`✅ User logged in: ${user.email || user.uid}`);
                
                if (loginContainer) loginContainer.classList.add('hidden');
                if (appContainer) appContainer.classList.remove('hidden');
                if (authError) authError.innerText = '';
                
                if (typeof initDashboardSearch === 'function') {
                    try { initDashboardSearch(); } catch(e) { console.warn('initDashboardSearch error:', e); }
                }
                if (typeof loadDashboardData === 'function') {
                    try { await loadDashboardData(null, true); } catch(e) { console.warn('loadDashboardData error:', e); }
                }
                if (typeof loadUnifiedStockTable === 'function') {
                    try { await loadUnifiedStockTable(user.uid, null); } catch(e) { console.warn('loadUnifiedStockTable error:', e); }
                }
                if (typeof loadPortfolioAnalysisTable === 'function') {
                    try { await loadPortfolioAnalysisTable(user.uid, null, true); } catch(e) { console.warn('loadPortfolioAnalysisTable error:', e); }
                }
                if (typeof startAutoRefresh === 'function') {
                    try { startAutoRefresh(); } catch(e) { console.warn('startAutoRefresh error:', e); }
                }
                if (typeof updateAllPortfolioSelectors === 'function') {
                    try { await updateAllPortfolioSelectors(); } catch(e) { console.warn('updateAllPortfolioSelectors error:', e); }
                }
                if (typeof loadPortfolioManagerData === 'function') {
                    try { await loadPortfolioManagerData(); } catch(e) { console.warn('loadPortfolioManagerData error:', e); }
                }
                console.log('✅ Dashboard loaded successfully for user:', user.email);
                
            } else {
                console.log('👤 User logged out');
                if (loginContainer) loginContainer.classList.remove('hidden');
                if (appContainer) appContainer.classList.add('hidden');
                if (authError) authError.innerText = '';
                if (typeof stopAutoRefresh === 'function') {
                    try { stopAutoRefresh(); } catch(e) { console.warn('stopAutoRefresh error:', e); }
                }
                if (typeof CacheManager !== 'undefined' && CacheManager.clearAll) {
                    try { CacheManager.clearAll(); } catch(e) { console.warn('Cache clear error:', e); }
                }
            }
        });
    } else {
        console.warn('⚠️ Auth not available, state listener skipped.');
    }
})();

// ==========================================
// ২. মডাল ডেট ফিল্টার
// ==========================================
window.applyModalDateFilter = function() {
    const start = document.getElementById('modal-chart-start')?.value;
    const end = document.getElementById('modal-chart-end')?.value;
    if (start && end) {
        modalChartStartDate = start;
        modalChartEndDate = end;
        refreshModalCharts();
    } else {
        if (typeof showToast === 'function') showToast('Please select both dates.', 'warning');
    }
};

window.resetModalDateFilter = function() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const start = thirtyDaysAgo.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];
    const startInput = document.getElementById('modal-chart-start');
    const endInput = document.getElementById('modal-chart-end');
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    modalChartStartDate = start;
    modalChartEndDate = end;
    refreshModalCharts();
};

function refreshModalCharts() {
    if (!currentModalTicker) return;
    const startInput = document.getElementById('modal-chart-start');
    const endInput = document.getElementById('modal-chart-end');
    const startDate = startInput ? startInput.value : null;
    const endDate = endInput ? endInput.value : null;
    
    if (typeof loadPriceHistoryChart === 'function') {
        loadPriceHistoryChart(currentModalTicker, startDate, endDate);
    }
    if (typeof loadRSIChart === 'function') {
        loadRSIChart(currentModalTicker, startDate, endDate);
    }
    if (typeof loadGainAnalysisChart === 'function') {
        loadGainAnalysisChart(currentModalTicker, startDate, endDate);
    }
}

// ==========================================
// ৩. ইউজার মেনু
// ==========================================
window.openUserMenu = async function() {
    const modal = document.getElementById('user-menu-modal');
    if (!modal) return;
    const user = typeof auth !== 'undefined' && auth ? auth.currentUser : null;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    const emailSpan = document.getElementById('user-email');
    const uidSpan = document.getElementById('user-uid');
    const createdSpan = document.getElementById('user-created');
    if (emailSpan) emailSpan.innerText = user.email || 'N/A';
    if (uidSpan) uidSpan.innerText = user.uid || 'N/A';
    if (createdSpan) {
        if (user.metadata && user.metadata.creationTime) {
            createdSpan.innerText = new Date(user.metadata.creationTime).toLocaleDateString();
        } else {
            createdSpan.innerText = 'Unknown';
        }
    }
    modal.style.display = 'flex';
};

window.closeUserMenu = function() {
    const modal = document.getElementById('user-menu-modal');
    if (modal) modal.style.display = 'none';
    const currPwd = document.getElementById('current-password');
    const newPwd = document.getElementById('new-password');
    const confPwd = document.getElementById('confirm-password');
    const statusSpan = document.getElementById('password-status');
    if (currPwd) currPwd.value = '';
    if (newPwd) newPwd.value = '';
    if (confPwd) confPwd.value = '';
    if (statusSpan) statusSpan.innerText = '';
};

// পাসওয়ার্ড চেঞ্জ
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'btn-change-password') {
        changeUserPassword();
    }
});

async function changeUserPassword() {
    const user = typeof auth !== 'undefined' && auth ? auth.currentUser : null;
    if (!user) {
        if (typeof showToast === 'function') showToast('No user logged in', 'error');
        return;
    }
    const currentPwd = document.getElementById('current-password')?.value || '';
    const newPwd = document.getElementById('new-password')?.value || '';
    const confirmPwd = document.getElementById('confirm-password')?.value || '';
    const statusSpan = document.getElementById('password-status');
    if (!currentPwd || !newPwd || !confirmPwd) {
        if (statusSpan) { statusSpan.innerText = 'Please fill all fields'; statusSpan.style.color = 'red'; }
        return;
    }
    if (newPwd !== confirmPwd) {
        if (statusSpan) { statusSpan.innerText = 'New passwords do not match'; statusSpan.style.color = 'red'; }
        return;
    }
    if (newPwd.length < 6) {
        if (statusSpan) { statusSpan.innerText = 'Password must be at least 6 characters'; statusSpan.style.color = 'red'; }
        return;
    }
    if (statusSpan) { statusSpan.innerText = 'Verifying...'; statusSpan.style.color = 'orange'; }
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPwd);
        await user.reauthenticateWithCredential(credential);
        if (statusSpan) { statusSpan.innerText = 'Updating...'; }
        await user.updatePassword(newPwd);
        if (statusSpan) { statusSpan.innerText = '✅ Password updated successfully!'; statusSpan.style.color = 'green'; }
        setTimeout(() => { closeUserMenu(); }, 1500);
    } catch (error) {
        console.error(error);
        if (statusSpan) {
            if (error.code === 'auth/wrong-password') {
                statusSpan.innerText = 'Current password is incorrect';
            } else if (error.code === 'auth/too-many-requests') {
                statusSpan.innerText = 'Too many attempts. Try again later.';
            } else {
                statusSpan.innerText = 'Error: ' + error.message;
            }
            statusSpan.style.color = 'red';
        }
    }
}

// ==========================================
// ৪. সাইডবার ও ট্যাব (সম্পূর্ণ আপডেটেড)
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

// ==========================================
// 📌 সাইডবার ও ট্যাব সুইচিং (সম্পূর্ণ আপডেটেড)
// ==========================================

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
    const user = auth.currentUser;
    if (!user) {
        console.log('👤 No user logged in, skipping data load');
        return;
    }

    // ⏳ ডেটা লোড (সব ট্যাবের জন্য)
    setTimeout(() => {
        try {
            switch (tabName) {

                // ========================
                // 📊 ড্যাশবোর্ড
                // ========================
                case 'dashboard':
                    if (typeof loadDashboardData === 'function') {
                        loadDashboardData(null, true);
                    } else {
                        console.warn('⚠️ loadDashboardData not found');
                    }
                    break;

                // ========================
                // 📈 পোর্টফোলিও অ্যানালাইসিস
                // ========================
                case 'portfolio-analysis':
                    if (typeof loadPortfolioAnalysisTable === 'function') {
                        loadPortfolioAnalysisTable(user.uid, null, true);
                    } else {
                        console.warn('⚠️ loadPortfolioAnalysisTable not found');
                    }
                    break;

                // ========================
                // 📥 Buy
                // ========================
                case 'buy':
                    // Buy ট্যাবে কোনো অটো লোড নেই
                    break;

                // ========================
                // 📤 Sell
                // ========================
                case 'sell':
                    // Sell ট্যাবে কোনো অটো লোড নেই
                    break;

                // ========================
                // 📊 স্টক টেবিল
                // ========================
                case 'table':
                    if (typeof loadUnifiedStockTable === 'function') {
                        const pid = document.getElementById('stock-table-portfolio-select')?.value || null;
                        loadUnifiedStockTable(user.uid, pid === 'grand' ? null : pid);
                    } else {
                        console.warn('⚠️ loadUnifiedStockTable not found');
                    }
                    break;

                // ========================
                // 📜 ট্রেড হিস্ট্রি
                // ========================
                case 'trade-history':
                    if (typeof loadTradeHistory === 'function') {
                        loadTradeHistory();
                    } else {
                        console.warn('⚠️ loadTradeHistory not found');
                    }
                    break;

                // ========================
                // 🔍 অ্যানালাইসিস স্ট্যাট
                // ========================
                case 'analysis':
                    // ইউজার সার্চ করবে
                    break;

                // ========================
                // 📋 স্টেটমেন্ট
                // ========================
                case 'statement':
                    if (typeof loadStatementData === 'function') {
                        loadStatementData();
                    } else {
                        console.warn('⚠️ loadStatementData not found');
                    }
                    break;

                // ========================
                // 💡 Buy/Sell সাজেশন
                // ========================
                case 'suggestion':
                    const threshold = document.getElementById('suggestion-threshold')?.value || 50;
                    const sugPid = document.getElementById('suggestion-portfolio-select')?.value || null;
                    if (typeof loadSuggestionData === 'function') {
                        loadSuggestionData(parseFloat(threshold), sugPid === 'grand' ? null : sugPid);
                    } else {
                        console.warn('⚠️ loadSuggestionData not found');
                    }
                    break;

                // ========================
                // 💰 ডিভিডেন্ড অ্যানালাইসিস
                // ========================
                case 'dividend':
                    const divPid = document.getElementById('dividend-portfolio-select')?.value || null;
                    if (typeof loadDividendData === 'function') {
                        loadDividendData(divPid === 'grand' ? null : divPid);
                    } else {
                        console.warn('⚠️ loadDividendData not found');
                    }
                    break;

                // ========================
                // 📈 ভ্যালু হিস্ট্রি
                // ========================
                case 'history':
                    if (typeof loadPortfolioHistory === 'function') {
                        loadPortfolioHistory();
                    } else {
                        console.warn('⚠️ loadPortfolioHistory not found');
                    }
                    break;

                // ========================
                // 📊 স্ক্রিনার (Parabolic SAR)
                // ========================
                case 'screener':
                    if (typeof loadScreenerData === 'function') {
                        const scrPid = document.getElementById('screener-portfolio-select')?.value || null;
                        loadScreenerData('buy', scrPid === 'grand' ? null : scrPid);
                    } else {
                        console.warn('⚠️ loadScreenerData not found');
                        // ফ্যালব্যাক: টেবিলে মেসেজ দেখান
                        const tbody = document.getElementById('screener-table-body');
                        if (tbody) {
                            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:red;">Screener module not loaded. Please refresh.</td></tr>`;
                        }
                    }
                    break;

                // ========================
                // 📊 All Scanner
                // ========================
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

                // ========================
                // 📊 RSI Indicator
                // ========================
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

                // ========================
                // 🧠 Smart Signals
                // ========================
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

                // ========================
                // 📊 Market Watch
                // ========================
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

                // ========================
                // 🔬 Deep Analysis
                // ========================
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

                // ========================
                // 📅 Record Date
                // ========================
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

                // ========================
                // ❓ অজানা ট্যাব
                // ========================
                default:
                    console.log(`ℹ️ Tab "${tabName}" loaded (no specific data load)`);
                    break;
            }
        } catch (error) {
            console.error(`❌ Error loading tab "${tabName}":`, error);
            // টোস্ট দেখান
            if (typeof showToast === 'function') {
                showToast(`Error loading ${tabName}: ${error.message}`, 'error');
            }
        }
    }, 300);
};

// ==========================================
// ৫. থিম টগল
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
    
    if (typeof updateChartColors === 'function') updateChartColors();
};

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

function loadSavedTheme() {
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
}

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
document.addEventListener('DOMContentLoaded', () => { loadSavedTheme(); watchSystemTheme(); });

// ==========================================
// ৬. টোস্ট ও ডাটা মোড
// ==========================================
function showToast(message, type = 'info') {
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
}
window.showToast = showToast;

async function setLiveMode() {
    if (currentDataMode === 'live') return;
    currentDataMode = 'live';
    try { localStorage.setItem('dataMode', 'live'); } catch (e) { /* ignore */ }
    if (typeof showToast === 'function') showToast('🔄 Switching to Live Data (Supabase)...', 'warning');
    if (typeof resetUnifiedPriceCache === 'function') resetUnifiedPriceCache();
    if (typeof clearAllScannerCache === 'function') clearAllScannerCache();

    const liveBtn = document.getElementById('btn-live-mode');
    const fbBtn = document.getElementById('btn-firebase-mode');
    if (liveBtn) liveBtn.classList.add('active');
    if (fbBtn) fbBtn.classList.remove('active');

    if (auth.currentUser) {
        if (typeof loadDashboardData === 'function') await loadDashboardData();
        if (typeof loadUnifiedStockTable === 'function') await loadUnifiedStockTable(auth.currentUser.uid);
        if (typeof loadPortfolioAnalysisTable === 'function') await loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
}

async function setFirebaseMode() {
    if (currentDataMode === 'firebase') return;
    currentDataMode = 'firebase';
    try { localStorage.setItem('dataMode', 'firebase'); } catch (e) { /* ignore */ }
    if (typeof showToast === 'function') showToast('💾 Switching to Firebase (Cached) mode...', 'info');
    if (typeof resetUnifiedPriceCache === 'function') resetUnifiedPriceCache();
    if (typeof clearAllScannerCache === 'function') clearAllScannerCache();

    const fbBtn = document.getElementById('btn-firebase-mode');
    const liveBtn = document.getElementById('btn-live-mode');
    if (fbBtn) fbBtn.classList.add('active');
    if (liveBtn) liveBtn.classList.remove('active');

    if (auth.currentUser) {
        if (typeof loadDashboardData === 'function') await loadDashboardData();
        if (typeof loadUnifiedStockTable === 'function') await loadUnifiedStockTable(auth.currentUser.uid);
        if (typeof loadPortfolioAnalysisTable === 'function') await loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
}

// ডেটা মোড বাটন ইভেন্ট
document.addEventListener('DOMContentLoaded', function() {
    const fbBtn = document.getElementById('btn-firebase-mode');
    const liveBtn = document.getElementById('btn-live-mode');
    if (fbBtn) fbBtn.addEventListener('click', setFirebaseMode);
    if (liveBtn) liveBtn.addEventListener('click', setLiveMode);
});

// ==========================================
// ৭. কমিশন সেটিংস
// ==========================================
function toggleCommissionSettings() {
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function saveCommissionSettings() {
    const percentInput = document.getElementById('commission-percent');
    const percent = parseFloat(percentInput?.value) || 0;
    if (typeof commissionManager !== 'undefined' && commissionManager) {
        commissionManager.updatePercent(percent);
    }
    if (typeof showToast === 'function') showToast(`Commission set to ${percent}% for both Buy & Sell`, 'success');
    if (auth.currentUser) {
        if (typeof loadDashboardData === 'function') loadDashboardData();
        if (typeof loadUnifiedStockTable === 'function') loadUnifiedStockTable(auth.currentUser.uid);
        if (typeof loadPortfolioAnalysisTable === 'function') loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = 'none';
}

function resetCommissionSettings() {
    if (typeof commissionManager !== 'undefined' && commissionManager) {
        commissionManager.updatePercent(0);
    }
    const percentInput = document.getElementById('commission-percent');
    if (percentInput) percentInput.value = 0;
    if (typeof showToast === 'function') showToast('Commission reset to 0%', 'info');
    if (auth.currentUser) {
        if (typeof loadDashboardData === 'function') loadDashboardData();
        if (typeof loadUnifiedStockTable === 'function') loadUnifiedStockTable(auth.currentUser.uid);
        if (typeof loadPortfolioAnalysisTable === 'function') loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = 'none';
}

function updateCommissionDisplay() {
    const percent = (typeof commissionManager !== 'undefined' && commissionManager) ? commissionManager.getPercent() : 0;
    let infoDiv = document.getElementById('commission-info-display');
    if (!infoDiv) {
        const dashboardSection = document.getElementById('sec-dashboard');
        if (dashboardSection) {
            const cardsDiv = dashboardSection.querySelector('.cards');
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

window.toggleCommissionSettings = toggleCommissionSettings;
window.saveCommissionSettings = saveCommissionSettings;
window.resetCommissionSettings = resetCommissionSettings;

// ==========================================
// ৮. অ্যাডভান্সড স্টক মডাল (পোর্টফোলিও ফিল্টার সহ)
// ==========================================
window.openStockDetailModal = async function(ticker) {
    const modal = document.getElementById('advanced-stock-modal');
    if (!modal) return;
    const user = auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    modal.style.display = 'flex';
    const tickerElem = document.getElementById('adv-modal-ticker');
    if (tickerElem) tickerElem.innerText = ticker;

    // লোডিং ইন্ডিকেটর
    const loadingIds = ['adv-ltp', 'adv-holdings-qty', 'adv-eps', 'adv-pe',
        'adv-dividend-percent', 'adv-record-date',
        'adv-highlow', 'adv-prev-close', 'adv-gain-amount',
        'adv-ath', 'adv-atl', 'adv-ath-date', 'adv-atl-date',
        'adv-dse-price', 'adv-cse-price'
    ];
    loadingIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<span class="loading"></span>';
    });

    currentModalTicker = ticker;
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const start = thirtyDaysAgo.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];
    const startInput = document.getElementById('modal-chart-start');
    const endInput = document.getElementById('modal-chart-end');
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    modalChartStartDate = start;
    modalChartEndDate = end;

    try {
        // ---------- ১. পোর্টফোলিও ডেটা (গ্র্যান্ড পোর্টফোলিও) ----------
        let remainingQty = 0, avgBuyPrice = 0, totalCost = 0;
        try {
            // 🔥 portfolioId = null দিলে গ্র্যান্ড পোর্টফোলিও দেখাবে
            const unifiedData = await unifiedEngine.calculate(user.uid, null, true);
            if (unifiedData && unifiedData.stockDetails) {
                const stockData = unifiedData.stockDetails.find(s => s.ticker === ticker);
                if (stockData) {
                    remainingQty = stockData.totalQty || 0;
                    totalCost = stockData.totalCost || 0;
                    avgBuyPrice = stockData.totalQty > 0 ? stockData.totalCost / stockData.totalQty : 0;
                }
            }
        } catch (e) {
            console.warn('Portfolio data not available:', e);
        }

        // ---------- ২. প্রাইস ডেটা ----------
        const priceDataMap = await getLatestAndPreviousPrices([ticker]);
        const priceData = priceDataMap.get(ticker);
        const currentPrice = priceData?.currentPrice || 0;
        const currentDate = priceData?.currentDate || null;
        const previousPrice = priceData?.previousPrice || 0;
        const previousDate = priceData?.previousDate || null;

        const dailyChange = currentPrice - previousPrice;
        const dailyChangePercent = previousPrice > 0 ? (dailyChange / previousPrice) * 100 : 0;

        // ---------- ৩. LTP আপডেট ----------
        const ltpElem = document.getElementById('adv-ltp');
        if (ltpElem) {
            ltpElem.innerHTML = `৳${currentPrice.toFixed(2)}`;
            const changeElem = document.getElementById('adv-change');
            if (changeElem) {
                const changeStr = `${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)} (${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%)`;
                changeElem.innerHTML = `Change: <span style="color: ${dailyChange >= 0 ? '#90ffb0' : '#ffaaaa'};">${changeStr}</span>`;
            }
            const dateElem = document.getElementById('adv-ltp-date');
            if (dateElem && currentDate) {
                const d = new Date(currentDate);
                dateElem.innerText = d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
            } else if (dateElem) {
                dateElem.innerText = 'N/A';
            }
        }

        // ---------- ৪. DSE ও CSE প্রাইস ----------
        const dsePrice = await getDSEPrice(ticker);
        const csePrice = await getCSEPrice(ticker);
        const dseSpan = document.getElementById('adv-dse-price');
        const cseSpan = document.getElementById('adv-cse-price');
        if (dseSpan) dseSpan.innerText = dsePrice > 0 ? dsePrice.toFixed(2) : '-';
        if (cseSpan) cseSpan.innerText = csePrice > 0 ? csePrice.toFixed(2) : '-';

        // ---------- ৫. Previous Close ----------
        const prevCloseElem = document.getElementById('adv-prev-close');
        if (prevCloseElem) {
            prevCloseElem.innerHTML = `৳${previousPrice > 0 ? previousPrice.toFixed(2) : '-'}`;
            const prevDateElem = document.getElementById('adv-prev-date');
            if (prevDateElem && previousDate) {
                const d = new Date(previousDate);
                prevDateElem.innerText = `as on: ${d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}`;
            } else if (prevDateElem) {
                prevDateElem.innerText = 'as on: N/A';
            }
        }

        // ---------- ৬. Holdings ----------
        const holdingsQty = document.getElementById('adv-holdings-qty');
        const avgBuySpan = document.getElementById('adv-avg-buy');
        if (holdingsQty) holdingsQty.innerText = remainingQty > 0 ? remainingQty : '0';
        if (avgBuySpan) avgBuySpan.innerText = avgBuyPrice > 0 ? avgBuyPrice.toFixed(2) : '0';

        // ---------- ৭. Total Gain/Loss ----------
        const gainAmount = document.getElementById('adv-gain-amount');
        const gainPercent = document.getElementById('adv-gain-percent');
        if (remainingQty > 0 && avgBuyPrice > 0 && currentPrice > 0) {
            const pl = (currentPrice - avgBuyPrice) * remainingQty;
            const plPct = (pl / (avgBuyPrice * remainingQty)) * 100;
            if (gainAmount) {
                gainAmount.innerText = `${pl >= 0 ? '+' : ''}৳${pl.toFixed(2)}`;
                gainAmount.style.color = pl >= 0 ? '#90ffb0' : '#ffaaaa';
            }
            if (gainPercent) {
                gainPercent.innerText = `${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%`;
                gainPercent.style.color = plPct >= 0 ? '#90ffb0' : '#ffaaaa';
            }
        } else {
            if (gainAmount) { 
                gainAmount.innerText = remainingQty === 0 ? 'No holdings' : 'N/A'; 
                gainAmount.style.color = '#94a3b8'; 
            }
            if (gainPercent) { 
                gainPercent.innerText = '-'; 
                gainPercent.style.color = '#94a3b8'; 
            }
        }

        // ---------- ৮. মেটাডেটা (ATH, ATL, EPS, Dividend, Record Date) ----------
        try {
            if (typeof db !== 'undefined') {
                const snap = await db.collection('cse_detailed_data')
                    .where('code', '==', ticker)
                    .orderBy('date', 'desc')
                    .limit(1)
                    .get();
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    const high = parseFloat(data.high) || 0;
                    const low = parseFloat(data.low) || 0;
                    const highlowSpan = document.getElementById('adv-highlow');
                    if (highlowSpan) highlowSpan.innerText = high > 0 && low > 0 ? `৳${high.toFixed(2)} / ৳${low.toFixed(2)}` : '- / -';

                    const eps = parseFloat(data.eps) || 0;
                    const epsSpan = document.getElementById('adv-eps');
                    if (epsSpan) epsSpan.innerText = eps > 0 ? `৳${eps.toFixed(2)}` : '-';

                    const dividend = data.dividend || '-';
                    const recordDate = data.record_date || '-';
                    const divSpan = document.getElementById('adv-dividend-percent');
                    const recSpan = document.getElementById('adv-record-date');
                    if (divSpan) {
                        divSpan.innerText = dividend;
                        divSpan.style.cursor = 'pointer';
                        divSpan.style.textDecoration = 'underline';
                        divSpan.style.color = 'var(--primary-color)';
                        divSpan.title = 'Click to view full dividend history';
                        divSpan.onclick = function(e) {
                            e.stopPropagation();
                            if (typeof showDividendHistory === 'function') {
                                showDividendHistory(ticker);
                            }
                        };
                    }
                    if (recSpan) {
                        recSpan.innerText = recordDate;
                        recSpan.style.cursor = 'pointer';
                        recSpan.style.textDecoration = 'underline';
                        recSpan.title = 'Click to view dividend history';
                        recSpan.onclick = function(e) {
                            e.stopPropagation();
                            if (typeof showDividendHistory === 'function') {
                                showDividendHistory(ticker);
                            }
                        };
                    }

                    // ATH/ATL
                    let ath = 0, atl = Infinity;
                    let athDate = null, atlDate = null;
                    const histSnap = await db.collection('cse_detailed_data')
                        .where('code', '==', ticker)
                        .get();
                    histSnap.forEach(doc => {
                        const d = doc.data();
                        const ltp = parseFloat(d.ltp);
                        const dateStr = d.date || doc.id.split('_')[0];
                        if (ltp > ath) {
                            ath = ltp;
                            athDate = dateStr;
                        }
                        if (ltp > 0 && ltp < atl) {
                            atl = ltp;
                            atlDate = dateStr;
                        }
                        if (d.high) {
                            const h = parseFloat(d.high);
                            if (h > ath) { ath = h; athDate = dateStr; }
                        }
                        if (d.low) {
                            const l = parseFloat(d.low);
                            if (l > 0 && l < atl) { atl = l; atlDate = dateStr; }
                        }
                    });
                    if (atl === Infinity) atl = 0;

                    const athSpan = document.getElementById('adv-ath');
                    const atlSpan = document.getElementById('adv-atl');
                    const athDateSpan = document.getElementById('adv-ath-date');
                    const atlDateSpan = document.getElementById('adv-atl-date');

                    if (athSpan) athSpan.innerText = ath > 0 ? `৳${ath.toFixed(2)}` : '-';
                    if (atlSpan) atlSpan.innerText = atl > 0 ? `৳${atl.toFixed(2)}` : '-';
                    if (athDateSpan) {
                        if (athDate) {
                            const d = new Date(athDate);
                            athDateSpan.innerText = d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
                        } else {
                            athDateSpan.innerText = '-';
                        }
                    }
                    if (atlDateSpan) {
                        if (atlDate) {
                            const d = new Date(atlDate);
                            atlDateSpan.innerText = d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
                        } else {
                            atlDateSpan.innerText = '-';
                        }
                    }
                }
            }
        } catch (e) { 
            console.warn('Metadata fetch failed:', e); 
        }

        // ---------- ৯. P/E Ratio ----------
        const peRatio = await getPERatio(ticker);
        const peSpan = document.getElementById('adv-pe');
        if (peSpan) {
            if (peRatio !== null && peRatio > 0) {
                peSpan.innerText = peRatio.toFixed(2);
            } else {
                peSpan.innerText = '-';
            }
        }

        // ---------- ১০. চার্ট লোড ----------
        if (typeof loadPriceHistoryChart === 'function') loadPriceHistoryChart(ticker);
        if (typeof loadRSIChart === 'function') loadRSIChart(ticker);
        if (typeof loadGainAnalysisChart === 'function') loadGainAnalysisChart(ticker);
        if (typeof loadModalPerformanceTable === 'function') loadModalPerformanceTable(ticker);

        // ---------- ১১. ডেটা সোর্স ও সময় ----------
        const sourceSpan = document.getElementById('adv-data-source');
        const timeSpan = document.getElementById('adv-updated-time');
        if (sourceSpan) sourceSpan.innerText = currentDataMode === 'firebase' ? 'Firebase Cache' : 'Live API';
        if (timeSpan) timeSpan.innerText = new Date().toLocaleString();

    } catch (error) {
        console.error('Error in openStockDetailModal:', error);
        const ltpElem = document.getElementById('adv-ltp');
        if (ltpElem) ltpElem.innerText = 'Error';
        const holdingsQty = document.getElementById('adv-holdings-qty');
        if (holdingsQty) holdingsQty.innerText = 'Error';
        if (typeof showToast === 'function') showToast('Error loading stock details: ' + error.message, 'error');
    }
};

window.closeAdvancedModal = function() {
    const modal = document.getElementById('advanced-stock-modal');
    if (modal) modal.style.display = 'none';
    if (advChartInstance) {
        advChartInstance.destroy();
        advChartInstance = null;
    }
};

// মডালের বাইরে ক্লিক করলে বন্ধ
document.addEventListener('click', function(e) {
    const modal = document.getElementById('advanced-stock-modal');
    if (modal && e.target === modal) {
        closeAdvancedModal();
    }
});

// ==========================================
// ৯. প্রাইস হিস্ট্রি চার্ট (cse_detailed_data + daily_prices)
// ==========================================
async function loadPriceHistoryChart(ticker, startDate = null, endDate = null) {
    if (!ticker) return;
    const canvas = document.getElementById('adv-stock-chart');
    if (!canvas) return;
    if (advChartInstance) advChartInstance.destroy();

    const user = auth.currentUser;
    if (!user) return;

    let start = startDate ? new Date(startDate) : new Date();
    if (!startDate) start.setDate(start.getDate() - 30);
    let end = endDate ? new Date(endDate) : new Date();
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    const prices = [], labels = [], highData = [], lowData = [];

    try {
        // ১. cse_detailed_data থেকে আনার চেষ্টা
        if (typeof db !== 'undefined') {
            let query = db.collection('cse_detailed_data')
                .where('code', '==', ticker)
                .where('date', '>=', startDateStr)
                .orderBy('date', 'asc');
            if (endDateStr) query = query.where('date', '<=', endDateStr);
            const snap = await query.get();
            if (!snap.empty) {
                snap.forEach(doc => {
                    const data = doc.data();
                    const ltp = parseFloat(data.ltp);
                    const high = parseFloat(data.high) || ltp;
                    const low = parseFloat(data.low) || ltp;
                    if (ltp > 0) {
                        prices.push(ltp);
                        highData.push(high);
                        lowData.push(low);
                        labels.push(data.date);
                    }
                });
            }
        }

        // ২. daily_prices থেকে ফ্যালব্যাক
        if (prices.length === 0 && typeof db !== 'undefined') {
            let query = db.collection('daily_prices')
                .where('ticker', '==', ticker)
                .where('date', '>=', startDateStr)
                .orderBy('date', 'asc');
            if (endDateStr) query = query.where('date', '<=', endDateStr);
            const snap = await query.get();
            if (!snap.empty) {
                snap.forEach(doc => {
                    const data = doc.data();
                    const price = parseFloat(data.price) || parseFloat(data.close) || 0;
                    const high = parseFloat(data.high) || price;
                    const low = parseFloat(data.low) || price;
                    if (price > 0) {
                        prices.push(price);
                        highData.push(high);
                        lowData.push(low);
                        labels.push(data.date);
                    }
                });
            }
        }
    } catch (e) {
        console.warn('⚠️ Price history query failed:', e);
    }

    if (prices.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.fillText('No price data available for selected range', 10, 50);
        return;
    }

    // PSAR ক্যালকুলেট
    const priceDataForSAR = labels.map((date, idx) => ({
        date: date,
        ltp: prices[idx],
        high: highData[idx] || prices[idx],
        low: lowData[idx] || prices[idx]
    }));
    const sarData = calculateParabolicSAR(priceDataForSAR);

    // অ্যাভারেজ বাই প্রাইস (গ্র্যান্ড পোর্টফোলিও থেকে)
    let avgBuyPrice = 0;
    try {
        const unifiedData = await unifiedEngine.calculate(user.uid, null, true);
        if (unifiedData && unifiedData.stockDetails) {
            const stockData = unifiedData.stockDetails.find(s => s.ticker === ticker);
            if (stockData && stockData.totalQty > 0) {
                avgBuyPrice = stockData.totalCost / stockData.totalQty;
            }
        }
    } catch (e) { /* ignore */ }
    const avgBuyLine = new Array(prices.length).fill(avgBuyPrice);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const sarPoints = sarData.map((item, index) => ({
        x: labels[index],
        y: item.sar,
        trend: item.trend
    }));
    const sarColors = sarPoints.map(p => p.trend === 'up' ? '#10b981' : '#ef4444');

    advChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${ticker} Price`,
                    data: prices,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#3b82f6'
                },
                {
                    label: `Your Avg Buy (${avgBuyPrice > 0 ? '৳' + avgBuyPrice.toFixed(2) : 'N/A'})`,
                    data: avgBuyLine,
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderDash: [8, 6],
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Parabolic SAR',
                    data: sarPoints.map(p => p.y),
                    type: 'scatter',
                    backgroundColor: sarColors,
                    borderColor: sarColors,
                    pointRadius: 5,
                    pointStyle: 'rectRot',
                    showInLegend: true,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: textColor }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.dataset.label.includes('Parabolic SAR')) {
                                return `PSAR: ৳${ctx.raw.toFixed(2)} (${ctx.raw.trend === 'up' ? '🟢 Up' : '🔴 Down'})`;
                            }
                            return ctx.dataset.label.includes('Price') ?
                                `${ctx.dataset.label}: ৳${ctx.raw.toFixed(2)}` :
                                ctx.dataset.label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, maxRotation: 45 },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor, callback: (v) => '৳' + v.toFixed(0) },
                    grid: { color: gridColor }
                }
            }
        }
    });
}
window.loadPriceHistoryChart = loadPriceHistoryChart;

// ==========================================
// ১০. RSI চার্ট
// ==========================================
async function loadRSIChart(ticker, startDate = null, endDate = null) {
    if (!ticker) return;
    const canvas = document.getElementById('adv-rsi-chart');
    if (!canvas) return;
    if (window.rsiChartInstance) {
        window.rsiChartInstance.destroy();
        window.rsiChartInstance = null;
    }

    let start = startDate ? new Date(startDate) : new Date();
    if (!startDate) start.setDate(start.getDate() - 30);
    let end = endDate ? new Date(endDate) : new Date();
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    try {
        let priceData = [];
        if (typeof db !== 'undefined') {
            let query = db.collection('daily_prices')
                .where('ticker', '==', ticker)
                .where('date', '>=', startDateStr)
                .orderBy('date', 'asc');
            if (endDateStr) {
                query = query.where('date', '<=', endDateStr);
            }
            const snap = await query.get();
            if (!snap.empty) {
                snap.forEach(doc => {
                    const data = doc.data();
                    const price = parseFloat(data.price) || parseFloat(data.close) || 0;
                    if (price > 0) {
                        priceData.push({ date: data.date, ltp: price });
                    }
                });
            }
        }

        if (priceData.length < 15) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.fillText('Insufficient data for RSI (need 15+ days)', 10, 50);
            return;
        }

        const rsiData = calcRSI(priceData, 14);
        const labels = rsiData.map(d => d.date);
        const rsiValues = rsiData.map(d => d.rsi);

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const ctx = canvas.getContext('2d');
        window.rsiChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'RSI (14)',
                    data: rsiValues,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 2,
                    pointBackgroundColor: '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                if (val === null) return 'RSI: -';
                                return `RSI: ${val.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, maxRotation: 45 },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: { color: textColor, callback: (v) => v.toFixed(0) },
                        grid: { color: gridColor },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    } catch (error) {
        console.error('RSI chart error:', error);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ef4444';
        ctx.font = '14px sans-serif';
        ctx.fillText('Error loading RSI chart', 10, 50);
    }
}
window.loadRSIChart = loadRSIChart;

// ==========================================
// ১১. Day-wise Gain/Loss Chart (cse_detailed_data + daily_prices)
// ==========================================
async function loadGainAnalysisChart(ticker, startDate = null, endDate = null) {
    if (!ticker) return;
    const canvas = document.getElementById('adv-gain-chart');
    if (!canvas) return;
    if (window.gainChartInstance) {
        window.gainChartInstance.destroy();
        window.gainChartInstance = null;
    }

    const user = auth.currentUser;
    if (!user) return;

    let start = startDate ? new Date(startDate) : new Date();
    if (!startDate) start.setDate(start.getDate() - 90);
    let end = endDate ? new Date(endDate) : new Date();
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    try {
        if (typeof db === 'undefined') return;

        const buySnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        let allBuyLots = [];
        buySnapshot.forEach(doc => {
            const data = doc.data();
            const totalCost = (data.quantity * data.buyPrice) + (data.commission || 0);
            const perUnit = data.quantity > 0 ? totalCost / data.quantity : data.buyPrice;
            const date = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            allBuyLots.push({
                qty: data.quantity,
                buyPrice: data.buyPrice,
                perUnitCost: perUnit,
                date: date
            });
        });
        allBuyLots.sort((a, b) => a.date - b.date);

        const sellSnapshot = await db.collection('sales_history')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        let sellTransactions = [];
        sellSnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            sellTransactions.push({
                date: date,
                qty: data.quantitySold || 0
            });
        });
        sellTransactions.sort((a, b) => a.date - b.date);

        // প্রাইস ডেটা (cse_detailed_data → daily_prices)
        let priceMap = new Map();

        try {
            let query = db.collection('cse_detailed_data')
                .where('code', '==', ticker)
                .where('date', '>=', startDateStr)
                .orderBy('date', 'asc');
            if (endDateStr) {
                query = query.where('date', '<=', endDateStr);
            }
            const snap = await query.get();
            if (!snap.empty) {
                snap.forEach(doc => {
                    const data = doc.data();
                    const price = parseFloat(data.ltp) || 0;
                    if (price > 0) priceMap.set(data.date, price);
                });
            }
        } catch (e) {
            console.warn('cse_detailed_data fetch failed:', e);
        }

        if (priceMap.size === 0) {
            try {
                let query = db.collection('daily_prices')
                    .where('ticker', '==', ticker)
                    .where('date', '>=', startDateStr)
                    .orderBy('date', 'asc');
                if (endDateStr) {
                    query = query.where('date', '<=', endDateStr);
                }
                const snap = await query.get();
                if (!snap.empty) {
                    snap.forEach(doc => {
                        const data = doc.data();
                        const price = parseFloat(data.price) || parseFloat(data.close) || 0;
                        if (price > 0) priceMap.set(data.date, price);
                    });
                }
            } catch (e) {
                console.warn('daily_prices fetch failed:', e);
            }
        }

        if (priceMap.size === 0) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.fillText('No price data for selected range', 10, 50);
            return;
        }

        const allDates = Array.from(priceMap.keys()).sort();
        let fifoLots = [];
        let sellIndex = 0;
        const chartLabels = [];
        const plData = [];
        const buyMarkers = [];
        const sellMarkers = [];

        const buyEventMap = new Map();
        const sellEventMap = new Map();

        buySnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            const dateStr = date.toISOString().split('T')[0];
            if (!buyEventMap.has(dateStr)) buyEventMap.set(dateStr, []);
            buyEventMap.get(dateStr).push({ qty: data.quantity, price: data.buyPrice });
        });

        sellSnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            const dateStr = date.toISOString().split('T')[0];
            if (!sellEventMap.has(dateStr)) sellEventMap.set(dateStr, []);
            sellEventMap.get(dateStr).push({ qty: data.quantitySold || 0, price: data.sellPrice || 0 });
        });

        let buyLotIndex = 0;
        let tempAllBuyLots = [...allBuyLots];

        for (const date of allDates) {
            const ltp = priceMap.get(date) || 0;
            if (ltp === 0) continue;

            while (buyLotIndex < tempAllBuyLots.length && tempAllBuyLots[buyLotIndex].date <= new Date(date)) {
                fifoLots.push({ ...tempAllBuyLots[buyLotIndex] });
                buyLotIndex++;
            }

            while (sellIndex < sellTransactions.length && sellTransactions[sellIndex].date <= new Date(date)) {
                let sellQty = sellTransactions[sellIndex].qty;
                while (sellQty > 0 && fifoLots.length > 0) {
                    const lot = fifoLots[0];
                    const taken = Math.min(lot.qty, sellQty);
                    lot.qty -= taken;
                    sellQty -= taken;
                    if (lot.qty === 0) fifoLots.shift();
                }
                sellIndex++;
            }

            let totalQty = 0, totalCost = 0;
            for (const lot of fifoLots) {
                totalQty += lot.qty;
                totalCost += lot.qty * lot.perUnitCost;
            }
            const currentValue = totalQty * ltp;
            const dailyPL = currentValue - totalCost;

            chartLabels.push(date);
            plData.push(dailyPL);

            if (buyEventMap.has(date)) {
                buyEventMap.get(date).forEach(evt => {
                    buyMarkers.push({
                        x: date,
                        y: dailyPL,
                        label: `🟢 Buy ${evt.qty} shares @ ৳${evt.price.toFixed(2)}`
                    });
                });
            }
            if (sellEventMap.has(date)) {
                sellEventMap.get(date).forEach(evt => {
                    sellMarkers.push({
                        x: date,
                        y: dailyPL,
                        label: `🔴 Sell ${evt.qty} shares @ ৳${evt.price.toFixed(2)}`
                    });
                });
            }
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const datasets = [];
        datasets.push({
            label: 'Unrealized P&L (৳)',
            data: plData,
            type: 'line',
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            borderWidth: 3,
            tension: 0.2,
            fill: true,
            pointRadius: 2,
            pointBackgroundColor: '#3b82f6',
            order: 1,
            segment: {
                borderColor: (ctx) => {
                    const value = ctx.p0.parsed.y;
                    return value >= 0 ? '#10b981' : '#ef4444';
                }
            }
        });
        if (buyMarkers.length > 0) {
            datasets.push({
                label: '🟢 Buy',
                data: buyMarkers,
                type: 'scatter',
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#10b981',
                pointRadius: 8,
                pointStyle: 'triangle',
                order: 0,
                showInLegend: true
            });
        }
        if (sellMarkers.length > 0) {
            datasets.push({
                label: '🔴 Sell',
                data: sellMarkers,
                type: 'scatter',
                pointBackgroundColor: '#ef4444',
                pointBorderColor: '#ef4444',
                pointRadius: 8,
                pointStyle: 'triangle',
                rotation: 180,
                order: 0,
                showInLegend: true
            });
        }

        const ctx = canvas.getContext('2d');
        window.gainChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { color: textColor, boxWidth: 12, font: { size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const raw = context.raw;
                                if (typeof raw === 'object' && raw.label) return raw.label;
                                if (context.dataset.label === 'Unrealized P&L (৳)') {
                                    const val = context.parsed.y;
                                    return `${val >= 0 ? '+' : ''}৳${val.toFixed(2)}`;
                                }
                                return context.dataset.label + ': ' + context.parsed.y;
                            },
                            title: function(items) {
                                if (items.length > 0) return '📅 ' + items[0].label;
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, maxRotation: 45, font: { size: 10 } },
                        grid: { color: gridColor, display: false }
                    },
                    y: {
                        ticks: { color: textColor, callback: (v) => '৳' + v.toFixed(0) },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Gain chart error:', error);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ef4444';
        ctx.font = '14px sans-serif';
        ctx.fillText('Error loading gain chart', 10, 50);
    }
}
window.loadGainAnalysisChart = loadGainAnalysisChart;

// ==========================================
// ১২. মডাল পারফরম্যান্স টেবিল
// ==========================================
async function loadModalPerformanceTable(ticker) {
    const user = auth.currentUser;
    if (!user) return;

    let currentPrice = await getUnifiedPrice(ticker);
    if (currentPrice === 0) {
        const priceData = await getLatestAndPreviousPrices([ticker]);
        currentPrice = priceData.get(ticker)?.currentPrice || 0;
    }

    const periods = [
        { name: 'today', days: 0, label: 'Today' },
        { name: '5d', days: 5, label: '5 Days' },
        { name: '15d', days: 15, label: '15 Days' },
        { name: '30d', days: 30, label: '30 Days' },
        { name: '3m', days: 90, label: '3 Months' },
        { name: '6m', days: 180, label: '6 Months' },
        { name: '1y', days: 365, label: '1 Year' }
    ];

    const returns = {};
    for (const period of periods) {
        if (period.days === 0) {
            const priceData = await getLatestAndPreviousPrices([ticker]);
            const prevPrice = priceData.get(ticker)?.previousPrice || 0;
            if (prevPrice > 0) {
                returns.today = ((currentPrice - prevPrice) / prevPrice) * 100;
            } else {
                returns.today = 0;
            }
            continue;
        }

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - period.days);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        let pastPrice = 0;
        if (typeof db !== 'undefined') {
            try {
                const snap = await db.collection('daily_prices')
                    .where('ticker', '==', ticker)
                    .where('date', '==', targetDateStr)
                    .limit(1)
                    .get();
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    pastPrice = parseFloat(data.price) || parseFloat(data.close) || 0;
                }
            } catch (e) { /* ignore */ }
        }

        if (pastPrice && pastPrice > 0) {
            returns[period.name] = ((currentPrice - pastPrice) / pastPrice) * 100;
        } else {
            returns[period.name] = null;
        }
    }

    const updateCell = (id, value) => {
        const elem = document.getElementById(id);
        if (elem) {
            if (value === null || value === undefined) {
                elem.innerHTML = '-';
                elem.style.color = '#64748b';
            } else {
                elem.innerHTML = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
                elem.style.color = value >= 0 ? '#10b981' : '#ef4444';
            }
        }
    };
    updateCell('modal-perf-today', returns.today);
    updateCell('modal-perf-5d', returns['5d']);
    updateCell('modal-perf-15d', returns['15d']);
    updateCell('modal-perf-30d', returns['30d']);
    updateCell('modal-perf-3m', returns['3m']);
    updateCell('modal-perf-6m', returns['6m']);
    updateCell('modal-perf-1y', returns['1y']);
}
window.loadModalPerformanceTable = loadModalPerformanceTable;

// ==========================================
// ১৩. গেইন হিস্ট্রি মডাল (পোর্টফোলিও ফিল্টার সহ)
// ==========================================
window.openGainHistoryModal = async function(ticker) {
    const modal = document.getElementById('gain-history-modal');
    const tickerSpan = document.getElementById('gl-modal-ticker');
    const tbody = document.getElementById('gl-history-body');
    const summary = document.getElementById('gl-history-summary');
    const timeSpan = document.getElementById('gl-history-time');
    if (!modal || !tbody) return;
    if (tickerSpan) tickerSpan.innerText = ticker;
    modal.style.display = 'flex';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">⏳ Loading gain/loss history...</td></tr>`;
    if (summary) summary.innerText = '📊 Fetching data...';
    if (timeSpan) timeSpan.innerText = new Date().toLocaleTimeString();

    try {
        const user = auth.currentUser;
        if (!user) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Please login first.</td></tr>`;
            return;
        }

        // 🔥 গ্র্যান্ড পোর্টফোলিও
        const unifiedData = await unifiedEngine.calculate(user.uid, null, true);
        const stockData = unifiedData.stockDetails.find(s => s.ticker === ticker);
        if (!stockData || stockData.lots.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No active holdings for ${ticker}</td></tr>`;
            if (summary) summary.innerText = '📊 No holdings found';
            return;
        }

        let currentLots = stockData.lots.map(lot => ({
            qty: lot.qty,
            buyPrice: lot.buyPrice,
            perUnitCost: lot.perUnitCostWithCommission || lot.buyPrice,
            date: lot.date ? new Date(lot.date) : new Date()
        }));
        currentLots.sort((a, b) => a.date - b.date);

        if (typeof db === 'undefined') {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Firebase not available</td></tr>`;
            return;
        }

        const buySnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        let allBuyLots = [];
        buySnapshot.forEach(doc => {
            const data = doc.data();
            const totalCost = (data.quantity * data.buyPrice) + (data.commission || 0);
            const perUnit = data.quantity > 0 ? totalCost / data.quantity : data.buyPrice;
            const date = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            allBuyLots.push({
                qty: data.quantity,
                buyPrice: data.buyPrice,
                perUnitCost: perUnit,
                date: date
            });
        });
        allBuyLots.sort((a, b) => a.date - b.date);

        const sellSnapshot = await db.collection('sales_history')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        let sellTransactions = [];
        sellSnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            sellTransactions.push({
                date: date,
                qty: data.quantitySold || 0
            });
        });
        sellTransactions.sort((a, b) => a.date - b.date);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const startDateStr = startDate.toISOString().split('T')[0];

        let priceMap = new Map();
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
                    if (price > 0) priceMap.set(data.date, price);
                });
            }
        } catch (e) { /* ignore */ }

        if (priceMap.size === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No price data for last 90 days</td></tr>`;
            if (summary) summary.innerText = '📊 No price data';
            return;
        }

        const allDates = Array.from(priceMap.keys()).sort();
        let fifoLots = [];
        let sellIndex = 0;
        let tableHtml = '';
        let totalPL = 0;
        let rowCount = 0;
        let previousLTP = 0;

        for (const date of allDates) {
            const ltp = priceMap.get(date) || previousLTP;
            if (ltp === 0) continue;
            previousLTP = ltp;

            while (allBuyLots.length > 0 && allBuyLots[0].date <= new Date(date)) {
                const lot = allBuyLots.shift();
                fifoLots.push({ ...lot });
            }

            while (sellIndex < sellTransactions.length && sellTransactions[sellIndex].date <= new Date(date)) {
                let sellQty = sellTransactions[sellIndex].qty;
                while (sellQty > 0 && fifoLots.length > 0) {
                    const lot = fifoLots[0];
                    const taken = Math.min(lot.qty, sellQty);
                    lot.qty -= taken;
                    sellQty -= taken;
                    if (lot.qty === 0) fifoLots.shift();
                }
                sellIndex++;
            }

            let totalQty = 0, totalCost = 0;
            for (const lot of fifoLots) {
                totalQty += lot.qty;
                totalCost += lot.qty * lot.perUnitCost;
            }
            const avgBuy = totalQty > 0 ? totalCost / totalQty : 0;
            const currentValue = totalQty * ltp;
            const dailyPL = currentValue - totalCost;

            if (totalQty > 0 || Math.abs(dailyPL) > 0.01) {
                const dateObj = new Date(date);
                const dateStr = dateObj.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
                const sign = dailyPL >= 0 ? '+' : '';
                tableHtml += `<tr>
                    <td style="padding: 8px 12px;">${dateStr}</td>
                    <td style="padding: 8px 12px; text-align: right; color: ${dailyPL >= 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">
                        ${sign}৳${dailyPL.toFixed(2)}
                    </td>
                    <td style="padding: 8px 12px; text-align: right;">${totalQty}</td>
                    <td style="padding: 8px 12px; text-align: right;">৳${avgBuy.toFixed(2)}</td>
                    <td style="padding: 8px 12px; text-align: right;">৳${ltp.toFixed(2)}</td>
                </tr>`;
                totalPL += dailyPL;
                rowCount++;
            }
        }

        if (rowCount === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No gain/loss data for this period</td></tr>`;
            if (summary) summary.innerText = '📊 No data in last 90 days';
        } else {
            tbody.innerHTML = tableHtml;
            const avgPL = totalPL / rowCount;
            if (summary) summary.innerText = `📊 ${rowCount} days shown | Avg P&L: ${avgPL >= 0 ? '+' : ''}৳${avgPL.toFixed(2)}`;
        }
        if (timeSpan) timeSpan.innerText = new Date().toLocaleString('bn-BD');
    } catch (error) {
        console.error('Gain history error:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error: ${error.message}</td></tr>`;
        if (summary) summary.innerText = '❌ Error loading data';
    }
};

window.closeGainHistoryModal = function() {
    const modal = document.getElementById('gain-history-modal');
    if (modal) modal.style.display = 'none';
};
document.addEventListener('click', function(e) {
    const modal = document.getElementById('gain-history-modal');
    if (modal && e.target === modal) closeGainHistoryModal();
});

// ==========================================
// ১৪. Sync Metadata বাটনের ইভেন্ট
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
  const syncBtn = document.getElementById('btn-sync-metadata');
  const statusSpan = document.getElementById('sync-status');
  
  if (syncBtn && statusSpan) {
    syncBtn.addEventListener('click', async function() {
      if (typeof syncAllMetadata !== 'function') {
        statusSpan.innerText = '❌ syncAllMetadata function not loaded!';
        showToast('syncAllMetadata function not loaded. Please refresh.', 'error');
        return;
      }
      
      syncBtn.disabled = true;
      syncBtn.innerText = '⏳ Syncing...';
      statusSpan.innerText = '⏳ Fetching data...';
      
      try {
        await syncAllMetadata(
          (current, total) => {
            const pct = Math.round((current / total) * 100);
            statusSpan.innerText = `⏳ ${current}/${total} (${pct}%)`;
          },
          (success, fail) => {
            statusSpan.innerText = `✅ Done! Success: ${success}, Failed: ${fail}`;
            syncBtn.disabled = false;
            syncBtn.innerText = '🔄 Sync Stock Metadata';
            if (fail === 0) showToast('✅ All metadata synced successfully!', 'success');
            else showToast(`⚠️ ${fail} tickers failed. Check console.`, 'warning');
          }
        );
      } catch (err) {
        console.error(err);
        statusSpan.innerText = '❌ Error: ' + err.message;
        syncBtn.disabled = false;
        syncBtn.innerText = '🔄 Sync Stock Metadata';
        showToast('Sync failed: ' + err.message, 'error');
      }
    });
  }
});

// ==========================================
// ১৫. ডিভিডেন্ড হিস্ট্রি মডাল
// ==========================================
window.showDividendHistory = async function(ticker) {
    const modal = document.getElementById('dividend-history-modal');
    if (!modal) return;
    const nameSpan = document.getElementById('div-ticker-name');
    if (nameSpan) nameSpan.innerText = ticker;
    modal.style.display = 'flex';
    const tbody = document.getElementById('dividend-history-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading dividend data...</td></tr>';

    try {
        let dividendData = [];
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data, error } = await supabase
                    .from('dse_dividend_data')
                    .select('*')
                    .eq('code', ticker)
                    .order('date', { ascending: false });
                if (!error && data && data.length > 0) dividendData = data;
            } catch (e) { /* ignore */ }
        }

        if (dividendData.length === 0 && typeof db !== 'undefined') {
            const snapshot = await db.collection('dse_dividend_data')
                .where('code', '==', ticker)
                .get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                const dividendMap = new Map();
                for (const [key, value] of Object.entries(data)) {
                    let match;
                    if (match = key.match(/^stock_dividend_(\d{4})$/)) {
                        const year = match[1];
                        const stockPercent = parseFloat(value);
                        if (!isNaN(stockPercent)) {
                            if (!dividendMap.has(year)) dividendMap.set(year, {});
                            dividendMap.get(year).stockPercent = stockPercent;
                        }
                    } else if (match = key.match(/^cash_dividend_(\d{4})$/)) {
                        const year = match[1];
                        let cashAmount = parseFloat(value);
                        if (!isNaN(cashAmount)) {
                            if (!dividendMap.has(year)) dividendMap.set(year, {});
                            dividendMap.get(year).cashAmount = cashAmount;
                        }
                    }
                }
                const years = Array.from(dividendMap.keys()).sort();
                if (years.length > 0) {
                    let html = '';
                    const chartLabels = [], stockData = [], cashData = [];
                    for (const year of years) {
                        const rec = dividendMap.get(year);
                        const stockVal = rec.stockPercent || 0;
                        const cashVal = rec.cashAmount || 0;
                        html += `<tr>
                            <td style="padding: 8px;">${year}</td>
                            <td style="padding: 8px;">${stockVal > 0 ? stockVal + '%' : '-'}</td>
                            <td style="padding: 8px;">${cashVal > 0 ? '৳' + cashVal.toFixed(2) : '-'}</td>
                            <td style="padding: 8px;">${data.record_date || '-'}</td>
                        </tr>`;
                        chartLabels.push(year);
                        stockData.push(stockVal);
                        cashData.push(cashVal);
                    }
                    if (tbody) tbody.innerHTML = html;
                    const ctx = document.getElementById('dividend-chart');
                    if (ctx) {
                        if (window.dividendChartInstance) window.dividendChartInstance.destroy();
                        window.dividendChartInstance = new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: chartLabels,
                                datasets: [
                                    { label: 'Stock Dividend (%)', data: stockData, backgroundColor: 'rgba(54, 162, 235, 0.6)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
                                    { label: 'Cash Dividend (৳)', data: cashData, backgroundColor: 'rgba(255, 206, 86, 0.6)', borderColor: 'rgba(255, 206, 86, 1)', borderWidth: 1 }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: true,
                                scales: {
                                    y: { beginAtZero: true, title: { display: true, text: 'Amount / Percentage' } },
                                    x: { title: { display: true, text: 'Year' } }
                                },
                                plugins: {
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                let label = context.dataset.label || '';
                                                let val = context.raw;
                                                if (label.includes('Stock')) return `${label}: ${val}%`;
                                                return `${label}: ৳${val.toFixed(2)}`;
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                    return;
                }
            }
        }

        if (dividendData.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">No dividend records found.</td></tr>';
            return;
        }

        const dividendMap = new Map();
        for (const row of dividendData) {
            for (const [key, value] of Object.entries(row)) {
                let match;
                if (match = key.match(/^cash_dividend_(\d{4})$/)) {
                    const year = match[1];
                    const cashAmount = parseFloat(value);
                    if (!isNaN(cashAmount)) {
                        if (!dividendMap.has(year)) dividendMap.set(year, { cash: 0, stock: 0 });
                        dividendMap.get(year).cash = cashAmount;
                    }
                } else if (match = key.match(/^stock_dividend_(\d{4})$/)) {
                    const year = match[1];
                    const stockPercent = parseFloat(value);
                    if (!isNaN(stockPercent)) {
                        if (!dividendMap.has(year)) dividendMap.set(year, { cash: 0, stock: 0 });
                        dividendMap.get(year).stock = stockPercent;
                    }
                }
            }
        }

        const years = Array.from(dividendMap.keys()).sort();
        if (years.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">No structured dividend data.</td></tr>';
            return;
        }

        let html = '';
        const chartLabels = [], stockData = [], cashData = [];
        const recordDate = dividendData[0]?.record_date || '-';
        for (const year of years) {
            const rec = dividendMap.get(year);
            const stockVal = rec.stock || 0;
            const cashVal = rec.cash || 0;
            html += `<tr>
                <td style="padding: 8px;">${year}</td>
                <td style="padding: 8px;">${stockVal > 0 ? stockVal + '%' : '-'}</td>
                <td style="padding: 8px;">${cashVal > 0 ? '৳' + cashVal.toFixed(2) : '-'}</td>
                <td style="padding: 8px;">${recordDate}</td>
            </tr>`;
            chartLabels.push(year);
            stockData.push(stockVal);
            cashData.push(cashVal);
        }
        if (tbody) tbody.innerHTML = html;
        const ctx = document.getElementById('dividend-chart');
        if (ctx) {
            if (window.dividendChartInstance) window.dividendChartInstance.destroy();
            window.dividendChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [
                        { label: 'Stock Dividend (%)', data: stockData, backgroundColor: 'rgba(54, 162, 235, 0.6)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
                        { label: 'Cash Dividend (৳)', data: cashData, backgroundColor: 'rgba(255, 206, 86, 0.6)', borderColor: 'rgba(255, 206, 86, 1)', borderWidth: 1 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Amount / Percentage' } },
                        x: { title: { display: true, text: 'Year' } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    let val = context.raw;
                                    if (label.includes('Stock')) return `${label}: ${val}%`;
                                    return `${label}: ৳${val.toFixed(2)}`;
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error loading dividend history:', err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Error loading dividend data.</td></tr>';
    }
};

window.closeDividendModal = function() {
    const modal = document.getElementById('dividend-history-modal');
    if (modal) modal.style.display = 'none';
    if (window.dividendChartInstance) {
        window.dividendChartInstance.destroy();
        window.dividendChartInstance = null;
    }
};

// ==========================================
// ১৬. DSEX চার্ট মডাল
// ==========================================
window.openDSEXChartModal = async function() {
    const modal = document.getElementById('dsex-chart-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const canvas = document.getElementById('dsex-history-chart');
    if (!canvas) return;
    canvas.style.opacity = '0.5';

    try {
        if (typeof db === 'undefined') {
            throw new Error('Firebase not available');
        }
        const snapshot = await db.collection('dse_market_data')
            .orderBy('date', 'asc')
            .get();

        if (snapshot.empty) {
            throw new Error('No documents found in dse_market_data');
        }

        const labels = [];
        const dataPoints = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const dateStr = data.date;
            const dsexStr = data.dsex_index || '0';
            const dsexValue = parseFloat(dsexStr.replace(/,/g, ''));
            if (dsexValue && !isNaN(dsexValue) && dsexValue > 0) {
                labels.push(dateStr);
                dataPoints.push(dsexValue);
            }
        });

        if (dataPoints.length === 0) {
            throw new Error('No valid DSEX values');
        }

        if (window.dsexChartInstance) window.dsexChartInstance.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const ctx = canvas.getContext('2d');
        window.dsexChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'DSEX Index',
                    data: dataPoints,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: textColor }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `DSEX: ${ctx.raw.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, maxRotation: 45 },
                        grid: { color: gridColor },
                        title: { display: true, text: 'Date', color: textColor }
                    },
                    y: {
                        ticks: { color: textColor, callback: (val) => val.toFixed(0) },
                        grid: { color: gridColor },
                        title: { display: true, text: 'DSEX Value', color: textColor }
                    }
                }
            }
        });
        canvas.style.opacity = '1';
    } catch (err) {
        console.error('DSEX chart load failed:', err);
        canvas.style.opacity = '1';
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ef4444';
        ctx.font = '14px sans-serif';
        ctx.fillText('Error: ' + err.message, 50, 50);
    }
};

window.closeDSEXChartModal = function() {
    const modal = document.getElementById('dsex-chart-modal');
    if (modal) modal.style.display = 'none';
    if (window.dsexChartInstance) {
        window.dsexChartInstance.destroy();
        window.dsexChartInstance = null;
    }
};

// ==========================================
// ১৭. ট্রেড হিস্ট্রি
// ==========================================
let allTransactions = [];

async function loadTradeHistory() {
    const user = auth.currentUser;
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

window.loadTradeHistory = loadTradeHistory;
window.applyTradeFilter = applyTradeFilter;
window.resetTradeFilter = resetTradeFilter;

// ==========================================
// ১৮. ড্যাশবোর্ড সার্চ
// ==========================================
function initDashboardSearch() {
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
}
window.initDashboardSearch = initDashboardSearch;

// ==========================================
// ১৯. ব্যাকআপ/রিস্টোর
// ==========================================
window.downloadPortfolioData = async function() {
    const user = auth.currentUser;
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
    const user = auth.currentUser;
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
// ২০. ফ্লোটিং লোডার
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
// ২১. স্ক্রিনার ড্রপডাউন টগল
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
// ২২. পোর্টফোলিও ডিলিট কনফার্ম
// ==========================================
window.confirmAndDeletePortfolio = async function() {
    const user = auth.currentUser;
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
// ২৩. পেজ আনলোডে ক্লিনআপ
// ==========================================
window.addEventListener('beforeunload', () => {
    if (portfolioAnalysisInterval) clearInterval(portfolioAnalysisInterval);
    if (stockTableRefreshInterval) clearInterval(stockTableRefreshInterval);
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    if (firebaseDataManager) firebaseDataManager.clearCache();
});

// ==========================================
// 🔁 ফ্যালব্যাক: লগইন থাকলে UI দেখান (ইভেন্ট মিস হলে)
// ==========================================
(function() {
    if (typeof auth !== 'undefined' && auth) {
        // যদি ইতিমধ্যে লগইন করা থাকে, তাহলে UI টগল করুন
        if (auth.currentUser) {
            const loginContainer = document.getElementById('login-container');
            const appContainer = document.getElementById('app-container');
            if (loginContainer) loginContainer.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
            console.log('🔁 Fallback: UI toggled because user already logged in.');
            
            // ডেটা লোড করাও (যদি ইতিমধ্যে লোড না হয়ে থাকে)
            if (typeof loadDashboardData === 'function') {
                // ড্যাশবোর্ডের মান চেক করে দেখি লোড করা হয়েছে কিনা
                const valueElem = document.getElementById('dash-total-value');
                if (valueElem && valueElem.innerText.includes('৳0.00')) {
                    loadDashboardData(null, true);
                }
            }
            if (typeof loadUnifiedStockTable === 'function') {
                loadUnifiedStockTable(auth.currentUser.uid, null);
            }
            if (typeof loadPortfolioAnalysisTable === 'function') {
                loadPortfolioAnalysisTable(auth.currentUser.uid, null, true);
            }
            if (typeof updateAllPortfolioSelectors === 'function') {
                updateAllPortfolioSelectors();
            }
        }
    }
})();

// ==========================================
// 📌 গ্লোবাল এক্সপোজ
// ==========================================
window.applyModalDateFilter = applyModalDateFilter;
window.resetModalDateFilter = resetModalDateFilter;
window.openUserMenu = openUserMenu;
window.closeUserMenu = closeUserMenu;
window.toggleLeftSidebar = toggleLeftSidebar;
window.toggleRightSidebar = toggleRightSidebar;
window.switchTab = switchTab;
window.toggleDarkMode = toggleDarkMode;
window.showToast = showToast;
window.downloadPortfolioData = downloadPortfolioData;
window.uploadPortfolioData = uploadPortfolioData;
window.toggleCommissionSettings = toggleCommissionSettings;
window.saveCommissionSettings = saveCommissionSettings;
window.resetCommissionSettings = resetCommissionSettings;
window.openStockDetailModal = openStockDetailModal;
window.closeAdvancedModal = closeAdvancedModal;
window.showDividendHistory = showDividendHistory;
window.closeDividendModal = closeDividendModal;
window.confirmAndDeletePortfolio = confirmAndDeletePortfolio;
window.openDSEXChartModal = openDSEXChartModal;
window.closeDSEXChartModal = closeDSEXChartModal;
window.loadTradeHistory = loadTradeHistory;
window.editTrade = editTrade;
window.deleteTrade = deleteTrade;
window.openGainHistoryModal = openGainHistoryModal;
window.closeGainHistoryModal = closeGainHistoryModal;
window.loadGainAnalysisChart = loadGainAnalysisChart;
window.toggleScreenerDropdown = toggleScreenerDropdown;
window.initDashboardSearch = initDashboardSearch;
window.applyTradeFilter = applyTradeFilter;
window.resetTradeFilter = resetTradeFilter;
window.showFloatingLoader = showFloatingLoader;
window.hideFloatingLoader = hideFloatingLoader;
window.loadPriceHistoryChart = loadPriceHistoryChart;
window.loadRSIChart = loadRSIChart;
window.loadModalPerformanceTable = loadModalPerformanceTable;

console.log('✅ ui.js loaded successfully (v3.1 - Fallback login check added)');