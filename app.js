// ==========================================
// ==========================================
// 🗄️ FIREBASE DATA MANAGER - ডাটা লোড করার কোর সিস্টেম
// ==========================================

class FirebaseDataManager {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 300000; // 5 মিনিট
        this.dataInfo = {
            source: 'firebase',
            lastUpdate: null,
            recordsCount: 0
        };
    }
    // 📆 সর্বশেষ ডাটা আপডেটের সময় পাওয়া (stock_history থেকে)
async getLastUpdateTime() {
    try {
        const snapshot = await db.collection('stock_history')
            .orderBy('date', 'desc')
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const latestDoc = snapshot.docs[0];
            const data = latestDoc.data();
            
            // date ফিল্ড থেকে সময় বের করা (ধরে নিচ্ছি তারিখ ফরম্যাট "2025-05-25")
            if (data.date) {
                const updateDate = new Date(data.date);
                // স্ক্র্যাপের সময়: সকাল ১১টা এবং বিকাল ৩টা
                // ধরে নিচ্ছি সকাল ১১টার স্ক্র্যাপ ডাটা
                updateDate.setHours(11, 0, 0, 0);
                return updateDate;
            }
        }
        
        // Fallback: current_prices কালেকশন চেক
        const priceSnapshot = await db.collection('current_prices')
            .orderBy('updatedAt', 'desc')
            .limit(1)
            .get();
        
        if (!priceSnapshot.empty) {
            const data = priceSnapshot.docs[0].data();
            if (data.updatedAt) {
                return data.updatedAt.toDate();
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error getting last update time:', error);
        return null;
    }
}

// 📆 ফরম্যাটেড আপডেট সময় পাওয়া
async getFormattedLastUpdate() {
    const lastUpdate = await this.getLastUpdateTime();
    if (lastUpdate) {
        return lastUpdate.toLocaleString('bn-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    return 'Not available';
}
    // 📥 সর্বশেষ প্রাইস লোড করুন (Dashboard এর জন্য)
    async loadLatestPrices(tickers = null) {
        console.log('🔄 Loading latest prices from Firebase...');
        
        try {
            let query = db.collection('stock_history').orderBy('date', 'desc');
            
            if (tickers && tickers.length > 0) {
                const batchSize = 10;
                const results = new Map();
                
                for (let i = 0; i < tickers.length; i += batchSize) {
                    const batch = tickers.slice(i, i + batchSize);
                    const snapshot = await db.collection('stock_history')
                        .where('ticker', 'in', batch)
                        .orderBy('date', 'desc')
                        .get();
                    
                    batch.forEach(ticker => {
                        const docs = snapshot.docs.filter(doc => doc.data().ticker === ticker);
                        if (docs.length > 0) {
                            const latest = docs[0].data();
                            results.set(ticker, {
                                price: latest.price,
                                date: latest.date
                            });
                        }
                    });
                }
                
                this.dataInfo = {
                    source: 'firebase',
                    lastUpdate: new Date().toISOString(),
                    recordsCount: results.size,
                    mode: 'cached'
                };
                
                return results;
            }
            
            const snapshot = await query.get();
            const latestPrices = new Map();
            const latestMap = new Map();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const ticker = data.ticker;
                if (!latestMap.has(ticker)) {
                    latestMap.set(ticker, data);
                }
            });
            
            latestMap.forEach((data, ticker) => {
                latestPrices.set(ticker, data.price);
            });
            
            this.dataInfo = {
                source: 'firebase',
                lastUpdate: new Date().toISOString(),
                recordsCount: latestPrices.size,
                mode: 'all'
            };
            
            console.log(`✅ Loaded ${latestPrices.size} stocks from Firebase`);
            return latestPrices;
            
        } catch (error) {
            console.error('Firebase load error:', error);
            return null;
        }
    }
    
    // 📅 নির্দিষ্ট তারিখের প্রাইস
    async getPriceByDate(ticker, date) {
        try {
            const docId = `${ticker}_${date}`;
            const doc = await db.collection('stock_history').doc(docId).get();
            
            if (doc.exists) {
                return doc.data().price;
            }
            return null;
        } catch (error) {
            console.error(`Error getting price for ${ticker} on ${date}:`, error);
            return null;
        }
    }
    
    // 📊 ডেইলি চেঞ্জ ক্যালকুলেশনের জন্য গতকালের প্রাইস
    async getPreviousClose(ticker) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        let price = await this.getPriceByDate(ticker, yesterdayStr);
        
        let daysBack = 2;
        while (!price && daysBack <= 7) {
            const prevDate = new Date();
            prevDate.setDate(prevDate.getDate() - daysBack);
            const dateStr = prevDate.toISOString().split('T')[0];
            price = await this.getPriceByDate(ticker, dateStr);
            daysBack++;
        }
        
        return price;
    }
    
    // 📥 নির্দিষ্ট টিকারের সর্বশেষ প্রাইস পাওয়া
    async getLatestPrice(ticker) {
        try {
            const snapshot = await db.collection('stock_history')
                .where('ticker', '==', ticker)
                .orderBy('date', 'desc')
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                return snapshot.docs[0].data().price;
            }
            return null;
        } catch (error) {
            console.error(`Error getting latest price for ${ticker}:`, error);
            return null;
        }
    }
    
    // 🔍 ডাটা স্ট্যাটাস চেক
    getDataStatus() {
        return { ...this.dataInfo };
    }
    
    // 🗑️ ক্যাশ ক্লিয়ার
    clearCache() {
        this.cache.clear();
        console.log('Cache cleared');
    }
}

// গ্লোবাল ইন্সট্যান্স
const firebaseDataManager = new FirebaseDataManager();

// ==========================================
// 🎯 DASHBOARD DATA LOADER (Firebase + API Hybrid)
// ==========================================
let currentDataMode = 'firebase';  // ← এভাবে পরিবর্তন করুন
let currentPriceData = new Map();
let lastDataLoadTime = null;
let currentPortfolioTotalValue = 0;  // 👈 এই লাইন যোগ করুন
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// API থেকে ডাটা লোড
async function loadFromAPI(user) {
    try {
        // ইউজারের পোর্টফোলিও থেকে টিকার লিস্ট নিন
        const portfolioSnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .get();
        
        const tickers = new Set();
        portfolioSnapshot.forEach(doc => {
            tickers.add(doc.data().shareName);
        });
        
        const priceMap = new Map();
        
        for (const ticker of tickers) {
            try {
                const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.ltp) {
                        priceMap.set(ticker, data.ltp);
                    }
                }
                // API রেট লিমিট এড়াতে সামান্য দেরি
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`Failed to fetch ${ticker}:`, error);
            }
        }
        
        return priceMap;
        
    } catch (error) {
        console.error('API load error:', error);
        return null;
    }
}

// পোর্টফোলিও ভ্যালু ক্যালকুলেট এবং UI আপডেট
// ==========================================
// 📊 ড্যাশবোর্ড ক্যালকুলেশন (সঠিক ভার্সন)
// ==========================================

// ==========================================
// 📊 ড্যাশবোর্ড ক্যালকুলেশন - সিম্পল ভার্সন
// ==========================================

async function calculateAndUpdatePortfolioValues(priceMap) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const portfolioSnapshot = await db.collection('portfolios').where('userId', '==', user.uid).get();
        const salesSnapshot = await db.collection('sales_history').where('userId', '==', user.uid).get();
        
        const totalSoldMap = new Map();
        salesSnapshot.forEach(doc => {
            const data = doc.data();
            const ticker = data.shareName;
            totalSoldMap.set(ticker, (totalSoldMap.get(ticker) || 0) + data.quantitySold);
        });
        
        const buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            buyLots.push({
                ticker: data.shareName,
                qty: data.quantity,
                buyPrice: data.buyPrice,
                date: data.date ? new Date(data.date) : new Date()
            });
        });
        
        buyLots.sort((a, b) => a.date - b.date);
        
        const remainingTracker = new Map();
        const sellRemaining = new Map();
        for (const [ticker, sold] of totalSoldMap) {
            sellRemaining.set(ticker, sold);
        }
        
        for (const lot of buyLots) {
            const ticker = lot.ticker;
            let remainingQty = lot.qty;
            const avgPrice = lot.buyPrice;
            let toSell = sellRemaining.get(ticker) || 0;
            
            if (toSell > 0 && remainingQty > 0) {
                const sellFromThisLot = Math.min(remainingQty, toSell);
                remainingQty -= sellFromThisLot;
                toSell -= sellFromThisLot;
                sellRemaining.set(ticker, toSell);
            }
            
            if (remainingQty > 0) {
                if (!remainingTracker.has(ticker)) {
                    remainingTracker.set(ticker, { totalQty: 0, totalCost: 0 });
                }
                const current = remainingTracker.get(ticker);
                current.totalQty += remainingQty;
                current.totalCost += remainingQty * avgPrice;
                remainingTracker.set(ticker, current);
            }
        }
        
        let totalInvestment = 0;
        let totalCurrentValue = 0;
        
        for (const [ticker, data] of remainingTracker) {
            const avgPrice = data.totalCost / data.totalQty;
            let currentPrice = priceMap.get(ticker);
            if (!currentPrice || currentPrice === 0) {
                currentPrice = avgPrice;
            }
            totalInvestment += data.totalCost;
            totalCurrentValue += data.totalQty * currentPrice;
        }
        
        const totalProfitLoss = totalCurrentValue - totalInvestment;
        
        const investElem = document.getElementById('total-invest');
        const valueElem = document.getElementById('current-value');
        const plElem = document.getElementById('profit-loss');
        
        if (investElem) {
            investElem.innerText = `৳${totalInvestment.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        }
        if (valueElem) {
            valueElem.innerText = `৳${totalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        }
        if (plElem) {
            plElem.innerText = `৳${totalProfitLoss.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
            plElem.style.color = totalProfitLoss >= 0 ? '#10b981' : '#ef4444';
        }
        
        currentPortfolioTotalValue = totalCurrentValue;
        updateTimestamp();
        console.log(`✅ FINAL: Investment=${totalInvestment.toFixed(2)}, Current=${totalCurrentValue.toFixed(2)}, P/L=${totalProfitLoss.toFixed(2)}`);
        
    } catch (error) {
        console.error('Dashboard calculation error:', error);
    }
}

// ডাটা সোর্স ইন্ডিকেটর আপডেট (লাস্ট আপডেট টাইম সহ)
async function updateDataStatusIndicator(mode, info) {
    const sourceIcon = document.getElementById('source-icon');
    const sourceText = document.getElementById('source-text');
    const dataDateValue = document.getElementById('data-date-value');
    const btnFirebase = document.getElementById('btn-firebase-mode');
    const btnLive = document.getElementById('btn-live-mode');
    
    if (!sourceIcon) return;
    
    if (mode === 'firebase') {
        sourceIcon.textContent = '💾';
        sourceText.textContent = 'Firebase Mode (Cached Data)';
        
        // 🆕 সর্বশেষ আপডেট সময় বের করা
        const lastUpdate = await firebaseDataManager.getLastUpdateTime();
        if (lastUpdate) {
            const formattedTime = lastUpdate.toLocaleString('bn-BD', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            dataDateValue.textContent = `📅 Data from: ${formattedTime} (${info.recordsCount} records)`;
        } else {
            dataDateValue.textContent = `📅 ${new Date(info.lastUpdate).toLocaleString()} (${info.recordsCount} records)`;
        }
        
        if (btnFirebase) btnFirebase.classList.add('active');
        if (btnLive) btnLive.classList.remove('active');
    } else {
        sourceIcon.textContent = '📡';
        sourceText.textContent = 'Live API Mode (Real-time)';
        dataDateValue.textContent = `🟢 Live - ${new Date().toLocaleString()}`;
        if (btnLive) btnLive.classList.add('active');
        if (btnFirebase) btnFirebase.classList.remove('active');
    }
}

// টাইমস্ট্যাম্প আপডেট (Dashboard এর নিচে)
async function updateTimestamp() {
    const timestampElem = document.getElementById('update-timestamp');
    if (timestampElem) {
        const mode = currentDataMode === 'firebase' ? 'Firebase Cache' : 'Live API';
        
        if (currentDataMode === 'firebase') {
            const lastUpdate = await firebaseDataManager.getLastUpdateTime();
            if (lastUpdate) {
                const formattedTime = lastUpdate.toLocaleString('bn-BD', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                timestampElem.innerHTML = `🔄 Data source: ${mode} | Last scraped: ${formattedTime}`;
            } else {
                timestampElem.innerHTML = `🔄 Last updated: ${new Date().toLocaleString()} (${mode})`;
            }
        } else {
            timestampElem.innerHTML = `🔄 Last updated: ${new Date().toLocaleString()} (${mode})`;
        }
    }
}

// লোডিং ইন্ডিকেটর
function showDataLoading(isLoading) {
    const btnFirebase = document.getElementById('btn-firebase-mode');
    const btnLive = document.getElementById('btn-live-mode');
    
    if (btnFirebase) btnFirebase.disabled = isLoading;
    if (btnLive) btnLive.disabled = isLoading;
    
    if (isLoading) {
        const investElem = document.getElementById('total-invest');
        if (investElem) investElem.innerHTML = '<span class="loading">Loading...</span>';
    }
}

// মোড সুইচ ফাংশন
async function setFirebaseMode() {
    if (currentDataMode === 'firebase') return;
    currentDataMode = 'firebase';
    await loadDashboardData();
    showToast('Switched to Firebase mode. Loading from cached data...', 'info');
}

async function setLiveMode() {
    if (currentDataMode === 'live') return;
    currentDataMode = 'live';
    await loadDashboardData();
    showToast('Switched to Live API mode. Getting real-time prices...', 'warning');
}

// টোস্ট নোটিফিকেশন
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        padding: 10px 16px;
        background: ${type === 'info' ? '#10b981' : '#f59e0b'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        font-size: 13px;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// অটো রিফ্রেশ (শুধু Firebase মোডে)
let autoRefreshInterval = null;

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    
    autoRefreshInterval = setInterval(() => {
        // পেজ ভিজিবল থাকলেই শুধু রিফ্রেশ করবে
        if (!document.hidden && currentDataMode === 'firebase' && auth.currentUser) {
            const dashboardSection = document.getElementById('sec-dashboard');
            if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
                console.log('🔄 Auto-refreshing dashboard...');
                loadDashboardData();
            }
        }
    }, 1800000); // 30 মিনিট
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}
// ==========================================
// 📦 গিটহাব অ্যাকশনস ক্যাশ প্রাইস ফাংশন
// ==========================================

// ক্যাশ থেকে প্রাইস আনার ফাংশন
async function getCachedPrice(ticker) {
  try {
    const doc = await db.collection('current_prices').doc(ticker).get();
    if (doc.exists) {
      const data = doc.data();
      console.log(`📦 ${ticker} ক্যাশ প্রাইস: ৳${data.price}`);
      return data.price;
    }
    return null;
  } catch(e) {
    return null;
  }
}

// Buy ফর্মের জন্য পরিবর্তিত ফাংশন
async function fetchLivePriceForBuy(ticker) {
  // প্রথমে ক্যাশ চেক
  const cached = await getCachedPrice(ticker);
  if (cached) {
    priceInput.value = cached;
    console.log(`✅ ক্যাশ থেকে প্রাইস সেট: ${cached}`);
    return;
  }
  
  // ক্যাশ না থাকলে লাইভ কল
  try {
    const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.ltp) {
        priceInput.value = data.ltp;
        return;
      }
    }
  } catch (e) { }
  
  priceInput.value = getHardcodedPrice(ticker);
}

// ==========================================
// ১. DOM উপাদানসমূহ (HTML Elements)
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

// Buy ফর্মের উপাদানসমূহ
const tickerInput = document.getElementById('trade-ticker');
const priceInput = document.getElementById('trade-price');
const suggestionBox = document.getElementById('suggestion-box');

// 🚀 সচল ভেরসেল স্ক্র্যাপার এপিআই ইউআরএল
const SCRAPER_BASE_URL = 'https://dse-scraper.vercel.app/api';

// Sell ফর্মের উপাদানসমূহ
const sellTickerInput = document.getElementById('sell-ticker');
const sellSuggestionBox = document.getElementById('sell-suggestion-box');
const sellHoldingsContainer = document.getElementById('sell-holdings-container');
const selectedSellTickerText = document.getElementById('selected-sell-ticker');
const sellPortfolioTableBody = document.getElementById('sell-portfolio-table-body');
const btnExecuteSell = document.getElementById('btn-execute-sell');

// Analysis Stat ফর্মের উপাদানসমূহ
const analysisTickerInput = document.getElementById('analysis-ticker');
const analysisSuggestionBox = document.getElementById('analysis-suggestion-box');
const analysisResultContainer = document.getElementById('analysis-result-container');
const selectedAnalysisTickerText = document.getElementById('selected-analysis-ticker');
const analysisTableBody = document.getElementById('analysis-table-body');

// Analysis Stat ফুটার এলিমেন্টসমূহ
const footAnalysisRemQty = document.getElementById('foot-analysis-rem-qty');
const footAnalysisTotalCost = document.getElementById('foot-analysis-total-cost');
const footAnalysisAvgPrice = document.getElementById('foot-analysis-avg-price');

let currentActiveLots = []; // সার্চ করা শেয়ারের লটগুলো ট্র্যাক করার জন্য
let dashboardChartInstance = null; // গ্রাফ ট্র্যাকার ভেরিয়েবল
let modalChartInstance = null; // 📈 পপ-আপ মডালের চার্ট ট্র্যাকার ভেরিয়েবল (নতুন যুক্ত)

// ==========================================
// ২. ফায়ারবেস অথেনটিকেশন লিসেনার (User State)
// ==========================================
// ==========================================
// ২. ফায়ারবেস অথেনটিকেশন লিসেনার (User State)
// ==========================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // ড্যাশবোর্ড ডাটা লোড করুন
        await loadDashboardData();
        
        // অন্যান্য টেবিল লোড করুন
        loadUnifiedStockTable(user.uid); 
        loadPortfolioAnalysisTable(user.uid);
        
        // অটো রিফ্রেশ শুরু করুন
        startAutoRefresh();
        
    } else {
        loginContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        stopAutoRefresh();
    }
});
// ==========================================
// লগআউট বাটনের ইভেন্ট লিসেনার
// ==========================================
btnLogout.addEventListener('click', () => {
    auth.signOut();
});
// ==========================================
// ৩. লগইন, সাইনআপ এবং টগল ফাংশনালিটি
// ==========================================
toggleAuthText.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authError.innerText = "";
    
    if (isLoginMode) {
        authTitle.innerText = "Portfolio Login";
        btnLogin.classList.remove('hidden');
        btnSignup.classList.add('hidden');
        toggleAuthText.innerText = "Don't have an account? Register here";
    } else {
        authTitle.innerText = "Portfolio Register";
        btnLogin.classList.add('hidden');
        btnSignup.classList.remove('hidden');
        toggleAuthText.innerText = "Already have an account? Login here";
    }
});

btnLogin.addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    authError.innerText = ""; 

    if (!email || !password) {
        authError.innerText = "দয়া করে ইমেইল এবং পাসওয়ার্ড দুটিই দিন।";
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            authError.innerText = "ভুল ইমেইল বা পাসওয়ার্ড! আবার চেষ্টা করুন।";
        });
});

btnSignup.addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    authError.innerText = "";

    if (!email || !password) {
        authError.innerText = "দয়া করে ইমেইল এবং পাসওয়ার্ড দুটিই দিন।";
        return;
    }
    if (password.length < 6) {
        authError.innerText = "পাসওয়ার্ড অন্তত ৬ ডিজিটের হতে হবে।";
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            alert("অ্যাকাউন্ট তৈরি সফল হয়েছে!");
        })
        .catch((error) => {
            authError.innerText = "অ্যাকাউন্ট তৈরি করা যায়নি।";
        });
});


// ==========================================
// ৪. সাইডবার ট্যাব পরিবর্তন লজিক
// ==========================================
window.switchTab = function(tabName) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.add('hidden'));

    const menuItems = document.querySelectorAll('.left-sidebar ul li');
    menuItems.forEach(item => item.classList.remove('active'));

    const activeSection = document.getElementById(`sec-${tabName}`);
    if (activeSection) activeSection.classList.remove('hidden');
    
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    // 👇 এই অংশটি যোগ করুন - history ট্যাবের জন্য
    if (tabName === 'history') {
        setTimeout(() => loadPortfolioHistory(), 100);
    }
    
    if(window.innerWidth <= 768) {
        toggleLeftSidebar();
    }
    if(window.innerWidth <= 768) {
        toggleLeftSidebar();
    }
};

// ==========================================
// ৫. ফায়ারবেস ফায়ারস্টোরে ডাটা সেভ করা (Buy Share)
// ==========================================
const btnBuy = document.querySelector('.btn-buy');
if (btnBuy) {
    btnBuy.addEventListener('click', async () => {
        const shareName = tickerInput.value.trim().toUpperCase();
        const quantity = document.getElementById('trade-qty').value;
        const price = priceInput.value;
        const user = auth.currentUser; 

        if (!user) return alert("দয়া করে আগে লগইন করুন!");
        if (!shareName || !quantity || !price) return alert("সবগুলো ঘর সঠিকভাবে পূরণ করুন!");
let selectedDate = tradeDateInput ? tradeDateInput.value : getTodayDate();
        if (!selectedDate) selectedDate = getTodayDate();
        const transactionDate = new Date(selectedDate);
        
        if (isNaN(transactionDate.getTime())) {
            alert("Invalid date! Please select a valid date.");
            return;
        }
        try {
            await db.collection("portfolios").add({
                userId: user.uid,        
                shareName: shareName,    
                quantity: Number(quantity),
                buyPrice: Number(price),
                type: "BUY",
                date: transactionDate,  // ✅ ইউজারের দেওয়া তারিখ
    createdAt: new Date()
            });

            alert(`${shareName} শেয়ারটি সফলভাবে পোর্টফোলিওতে যোগ হয়েছে! তারিখ: ${selectedDate}`);
tickerInput.value = "";
document.getElementById('trade-qty').value = "";
priceInput.value = "";
if (tradeDateInput) tradeDateInput.value = getTodayDate();

// 🔥 চার্ট রিফ্রেশ করার জন্য পেজ রিলোড
setTimeout(() => {
    location.reload();
}, 500);

        } catch (error) {
            console.error("ডাটা সেভ করতে সমস্যা হয়েছে: ", error);
        }
    });
}

// ==========================================
// ৬. কম্বাইন্ড রিয়েল-টাইম ডাটা লোডার ও গ্রাফ আপডেট লজিক (Parallel Fetch Optimized)
// ==========================================
function updateDashboardChart(labels, investData, valueData) {
    const ctx = document.getElementById('dashboardChart');
    if (!ctx) return;
    if (dashboardChartInstance) dashboardChartInstance.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    dashboardChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Total Investment', 
                    data: investData, 
                    borderColor: '#007bff', 
                    backgroundColor: 'transparent', 
                    borderWidth: 2.5, 
                    tension: 0.2, 
                    fill: false 
                },
                { 
                    label: 'Current Value', 
                    data: valueData, 
                    borderColor: '#10b981', 
                    backgroundColor: 'transparent', 
                    borderWidth: 2.5, 
                    tension: 0.2, 
                    fill: false 
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: { 
                x: { 
                    ticks: { color: textColor, font: { size: 9 } },
                    grid: { color: gridColor }
                }, 
                y: { 
                    ticks: { color: textColor, font: { size: 9 } },
                    grid: { color: gridColor }
                } 
            } 
        }
    });
}

// ==========================================
// 📋 ইউনিফাইড স্টক টেবিল - অপটিমাইজড ভার্সন (কম রিড)
// ==========================================

// ==========================================
// 📋 ইউনিফাইড স্টক টেবিল - সম্পূর্ণ ভার্সন (চার্ট সহ)
// ==========================================

// ==========================================
// 📋 ইউনিফাইড স্টক টেবিল - সম্পূর্ণ ভার্সন (চার্ট সহ)
// ==========================================

let stockTableRefreshInterval = null;

function loadUnifiedStockTable(userId) {
    if (!userId) {
        console.error("User ID is required");
        return;
    }
    
    const tableBody = document.getElementById('portfolio-table-body');
    if (!tableBody) {
        console.error("Portfolio table body not found");
        return;
    }
    
    async function loadStockData() {
        try {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Loading...</td></tr>';
            
            const [portfolioSnapshot, salesSnapshot] = await Promise.all([
                db.collection("portfolios").where("userId", "==", userId).get(),
                db.collection("sales_history").where("userId", "==", userId).get()
            ]);
            
            let mergedPortfolio = {};
            let chartLots = [];
            
            // পোর্টফোলিও ডাটা প্রসেস
            portfolioSnapshot.forEach(doc => {
                const data = doc.data();
                const ticker = data.shareName;
                const totalCost = data.quantity * data.buyPrice;
                
                if (!mergedPortfolio[ticker]) {
                    mergedPortfolio[ticker] = {
                        shareName: ticker, buyQty: 0, totalBuyCost: 0, sellQty: 0, totalSellValue: 0, realizedProfit: 0   
                    };
                }
                mergedPortfolio[ticker].buyQty += data.quantity;
                mergedPortfolio[ticker].totalBuyCost += totalCost;
                
                const lotDate = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
                chartLots.push({ ticker: ticker, date: lotDate, totalCost: totalCost, currentValue: 0 });
            });
            
            // সেলস ডাটা প্রসেস
            salesSnapshot.forEach(doc => {
                const data = doc.data();
                const ticker = data.shareName;
                if (!mergedPortfolio[ticker]) {
                    mergedPortfolio[ticker] = { shareName: ticker, buyQty: 0, totalBuyCost: 0, sellQty: 0, totalSellValue: 0, realizedProfit: 0 };
                }
                mergedPortfolio[ticker].sellQty += data.quantitySold;
                mergedPortfolio[ticker].totalSellValue += (data.quantitySold * data.sellPrice);
                mergedPortfolio[ticker].realizedProfit += data.profitOrLoss;
            });
            const tickers = Object.keys(mergedPortfolio);
// 5 টা করে প্যারালালে ফেচ করুন
const batchSize = 5;
const pricePromises = [];
for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchPromises = batch.map(async (ticker) => {
        let price = 0;
        try {
            const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
            if (response.ok) {
                const stockData = await response.json();
                if (stockData && stockData.ltp) price = stockData.ltp;
            }
        } catch (err) { console.error(err); }
        if (price === 0) price = Number(getHardcodedPrice(ticker));
        return { ticker, price };
    });
    pricePromises.push(...batchPromises);
}
            
            const priceResults = await Promise.all(pricePromises);
            const priceMap = {};
            priceResults.forEach(res => { priceMap[res.ticker] = res.price; });
            
            let totalInvestment = 0, totalCurrentValue = 0, totalUnrealized = 0, totalRealized = 0;
            let rowsHtml = "";
            
            for (let ticker in mergedPortfolio) {
                const item = mergedPortfolio[ticker];
                const currentPrice = priceMap[ticker];
                
                let remainingQty = item.buyQty - item.sellQty; 
                if (remainingQty < 0) remainingQty = 0; 
                
                let avgBuyPrice = item.buyQty > 0 ? (item.totalBuyCost / item.buyQty) : 0;
                let currentLiveValue = remainingQty * currentPrice;
                let unrealizedReturn = remainingQty > 0 ? (currentLiveValue - (remainingQty * avgBuyPrice)) : 0;
                let avgSellPrice = item.sellQty > 0 ? (item.totalSellValue / item.sellQty) : 0;
                
                totalInvestment += (remainingQty * avgBuyPrice);
                totalCurrentValue += currentLiveValue;
                totalUnrealized += unrealizedReturn;
                totalRealized += item.realizedProfit;
                
                const unresClass = unrealizedReturn >= 0 ? "up" : "error";
                const resClass = item.realizedProfit >= 0 ? "up" : "error";
                
                let nameClass = "name-default"; 
                let nameSuffix = "";
                if (item.sellQty > 0) {
                    if (item.realizedProfit > 0) nameClass = "name-positive";
                    else if (item.realizedProfit < 0) nameClass = "name-negative";
                    if (remainingQty === 0) nameSuffix = ` <span style="color:#ef4444; font-size:10px;">(Sold Out)</span>`;
                }
                
                rowsHtml += `
                    <tr style="cursor: pointer;" onclick="navigateToAnalysis('${item.shareName}')" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
                        <td class="${nameClass}"><b>${item.shareName}</b>${nameSuffix}</td>
                        <td>${item.buyQty > 0 ? item.buyQty : '-'}</td>
                        <td>৳${avgBuyPrice.toFixed(2)}</td>
                        <td style="color:#007bff; font-weight:bold;">${remainingQty > 0 ? remainingQty : '-'}</td>
                        <td>${remainingQty > 0 ? `৳${currentPrice.toFixed(2)}` : '-'}</td>
                        <td class="${remainingQty > 0 ? unresClass : ''}">${remainingQty > 0 ? `৳${unrealizedReturn.toFixed(2)}` : '-'}</td>
                        <td>${item.sellQty > 0 ? item.sellQty : '-'}</td>
                        <td>${item.sellQty > 0 ? `৳${avgSellPrice.toFixed(2)}` : '-'}</td>
                        <td class="${item.sellQty > 0 ? resClass : ''}">${item.sellQty > 0 ? `৳${item.realizedProfit.toFixed(2)}` : '-'}</td>
                    </tr>
                `;
                
                chartLots.forEach(lot => {
                    if(ticker === lot.ticker) {
                        let lotOriginalQty = lot.totalCost / avgBuyPrice;
                        lot.currentValue = lotOriginalQty * currentPrice;
                    }
                });
            }
            
            tableBody.innerHTML = rowsHtml || "<tr><td colspan='9' style='text-align:center;'>No trade history found. </b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></td></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b>"
            updateTableHeadersWithSort();
            updateCompanyCount();
            
            const totalProfitLoss = totalCurrentValue - totalInvestment;
            const profitLossElement = document.getElementById('profit-loss');
            if(document.getElementById('total-invest')) document.getElementById('total-invest').innerText = `৳${totalInvestment.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
            if(document.getElementById('current-value')) document.getElementById('current-value').innerText = `৳${totalCurrentValue.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`; 
            if (profitLossElement) {
                profitLossElement.innerText = `৳${totalProfitLoss.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
                profitLossElement.style.color = totalProfitLoss >= 0 ? '#10b981' : '#ef4444';
            }
            
            const footUnrealized = document.getElementById('foot-total-unrealized');
            const footRealized = document.getElementById('foot-total-realized');
            if(footUnrealized) footUnrealized.innerText = `৳${totalUnrealized.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
            if(footRealized) footRealized.innerText = `৳${totalRealized.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
            
            // ✅ চার্ট আপডেট করার জন্য এই অংশটি যোগ করুন
            if(chartLots.length > 0) {
                chartLots.sort((a, b) => a.date - b.date);
                let runningInvest = 0;
                let runningValue = 0;
                let labels = [], investData = [], valueData = [];
                
                chartLots.forEach(lot => {
                    runningInvest += lot.totalCost;
                    runningValue += (lot.currentValue > 0 ? lot.currentValue : lot.totalCost);
                    labels.push(lot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                    investData.push(Number(runningInvest.toFixed(2)));
                    valueData.push(Number(runningValue.toFixed(2)));
                });
                updateDashboardChart(labels, investData, valueData);
            }
            
        } catch (error) {
            console.error("Error loading stock data:", error);
            tableBody.innerHTML = "<tr><td colspan='9' style='text-align:center; color:#ef4444;'>Error loading data. Please refresh.</b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></td></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b>"
        }
    }
    
    // প্রথমবার লোড
    loadStockData();
    
    // আগের interval থাকলে ক্লিয়ার
    if (stockTableRefreshInterval) {
        clearInterval(stockTableRefreshInterval);
    }
    
    // শুধু ট্যাব ওপেন থাকলে প্রতি ২ মিনিটে রিফ্রেশ
    stockTableRefreshInterval = setInterval(() => {
        const tableSection = document.getElementById('sec-table');
        if (tableSection && !tableSection.classList.contains('hidden')) {
            console.log('🔄 Auto-refreshing stock table...');
            loadStockData();
        }
    }, 120000);
}
// ==========================================
// ৭. বাই ফর্ম সাজেশন লজিক
// ==========================================
tickerInput.addEventListener('input', () => {
    const query = tickerInput.value.trim().toUpperCase();
    suggestionBox.innerHTML = "";
    if (!query) { suggestionBox.classList.add('hidden'); return; }
    const filtered = dseStocks.filter(stock => stock.startsWith(query));
    if (filtered.length > 0) {
        suggestionBox.classList.remove('hidden');
        filtered.forEach(stock => {
            const div = document.createElement('div');
            div.classList.add('suggestion-item');
            div.innerText = stock;
            div.addEventListener('click', () => {
                tickerInput.value = stock;
                suggestionBox.classList.add('hidden');
                fetchLivePriceForBuy(stock);
            });
            suggestionBox.appendChild(div);
        });
    } else { suggestionBox.classList.add('hidden'); }
});



// ==========================================
// ৮. সেল উইন্ডোর সাজেশন ও সেল এক্সিকিউশন লজিক
// ==========================================

// ১. সেল টিকেট ইনপুটের রিয়েল-টাইম সাজেশন লজিক
sellTickerInput.addEventListener('input', () => {
    const query = sellTickerInput.value.trim().toUpperCase();
    sellSuggestionBox.innerHTML = "";
    if (!query) { 
        sellSuggestionBox.classList.add('hidden'); 
        return; 
    }
    
    const filtered = dseStocks.filter(stock => stock.startsWith(query));
    if (filtered.length > 0) {
        sellSuggestionBox.classList.remove('hidden');
        filtered.forEach(stock => {
            const div = document.createElement('div');
            div.classList.add('suggestion-item');
            div.innerText = stock;
            div.addEventListener('click', () => {
                sellTickerInput.value = stock;
                sellSuggestionBox.classList.add('hidden');
                
                // শেয়ার সিলেক্ট হওয়ার পর ওই শেয়ারের লট বা হোল্ডিংস লোড করা
                fetchHoldingsForSell(stock);
            });
            sellSuggestionBox.appendChild(div);
        });
    } else { 
        sellSuggestionBox.classList.add('hidden'); 
    }
});

// ২. নির্বাচিত শেয়ারের লটসমূহ ফায়ারস্টোর থেকে লোড করার ফাংশন
async function fetchHoldingsForSell(ticker) {
    const user = auth.currentUser;
    if (!user) return;

    selectedSellTickerText.innerText = ticker;
    sellPortfolioTableBody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>লট ডাটা লোড হচ্ছে...</td></tr>";
    sellHoldingsContainer.classList.remove('hidden');

    try {
        // ফায়ারস্টোর থেকে ওই ইউজারের কেনা সমস্ত লট এবং পূর্বে করা বিক্রির হিস্ট্রি আনা
        const [buySnapshot, sellSnapshot] = await Promise.all([
            db.collection("portfolios").where("userId", "==", user.uid).where("shareName", "==", ticker).get(),
            db.collection("sales_history").where("userId", "==", user.uid).where("shareName", "==", ticker).get()
        ]);

        let buyLots = [];
        buySnapshot.forEach(doc => {
            buyLots.push({ docId: doc.id, ...doc.data() });
        });

// FIFO এর জন্য লটগুলোকে ডেট অনুযায়ী সাজানো (সহজ ও নিরাপদ উপায়)
buyLots.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeA - timeB;
});

        // পূর্বে এই শেয়ার কতগুলো বিক্রি করা হয়েছে তার মোট হিসাব বের করা
        let totalSoldBefore = 0;
        sellSnapshot.forEach(doc => {
            totalSoldBefore += (doc.data().quantitySold || 0);
        });

        currentActiveLots = [];
        sellPortfolioTableBody.innerHTML = "";

        // প্রতিটি লটের অবশিষ্ট শেয়ার সংখ্যা হিসাব করে টেবিলে দেখানো
        buyLots.forEach(lot => {
            let availableQty = lot.quantity || 0;
            
            if (totalSoldBefore > 0) {
                if (totalSoldBefore >= availableQty) {
                    totalSoldBefore -= availableQty;
                    availableQty = 0;
                } else {
                    availableQty -= totalSoldBefore;
                    totalSoldBefore = 0;
                }
            }

            // যদি লটে শেয়ার অবশিষ্ট থাকে তবেই সেটি বিক্রির জন্য এভেলেবল হবে
            if (availableQty > 0) {
                currentActiveLots.push({
                    docId: lot.docId,
                    buyPrice: lot.buyPrice,
                    availableQty: availableQty
                });

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="small-col">৳${lot.buyPrice.toFixed(2)}</td>
                    <td class="small-col" style="color: #10b981; font-weight: bold;">${availableQty}</td>
                    <td class="small-col" style="color: #64748b;">${lot.date ? new Date(lot.date.toDate ? lot.date.toDate() : lot.date).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <div class="sell-input-group">
                            <div class="input-field-wrapper">
                                <label>Qty</label>
                                <input type="number" id="input-sell-qty-${lot.docId}" placeholder="0" min="1" max="${availableQty}">
                            </div>
                            <div class="input-field-wrapper">
                                <label>Price ৳</label>
                                <input type="number" id="input-sell-price-${lot.docId}" placeholder="0.00" step="0.01">
                            </div>
                        </div>
                    </td>
                `;
                sellPortfolioTableBody.appendChild(tr);
            }
        });

        if (currentActiveLots.length === 0) {
            sellPortfolioTableBody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#ef4444; padding: 15px;'>আপনার পোর্টফোলিওতে বিক্রয়যোগ্য কোনো শেয়ার নেই।</td></tr>";
        }

    } catch (error) {
        console.error("লট ডাটা লোড করতে ব্যর্থ:", error);
        sellPortfolioTableBody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#ef4444;'>ডাটা লোড করতে সমস্যা হয়েছে!</td></tr>";
    }
}

// ৩. সেল এক্সিকিউশন বাটন ক্লিক লজিক
if (btnExecuteSell) {
    btnExecuteSell.addEventListener('click', async () => {
        const user = auth.currentUser;
        const ticker = sellTickerInput.value.trim().toUpperCase();

        if (!user) return alert("দয়া করে প্রথমে লগইন করুন!");
        if (!ticker || currentActiveLots.length === 0) return alert("দয়া করে একটি বৈধ শেয়ার সিলেক্ট করুন।");
        const sellDateInput = document.getElementById('sell-trade-date');
        let selectedDate = sellDateInput ? sellDateInput.value : getTodayDate();
        if (!selectedDate) selectedDate = getTodayDate();
        const transactionDate = new Date(selectedDate);
        
        if (isNaN(transactionDate.getTime())) {
            alert("Invalid date! Please select a valid date.");
            return;
        }

        let totalSoldSuccessfully = 0;
        const batch = db.batch(); // ফাস্ট এবং সিকিউর ট্রানজেকশনের জন্য ব্যাচ ব্যবহার করা হয়েছে

        // প্রথম ধাপ: ইনপুট ভ্যালিডেশন চেক
        for (let lot of currentActiveLots) {
            const qtyField = document.getElementById(`input-sell-qty-${lot.docId}`);
            const priceField = document.getElementById(`input-sell-price-${lot.docId}`);
            
            if (qtyField && priceField) {
                const sellQty = Number(qtyField.value) || 0;
                const sellPrice = Number(priceField.value) || 0;

                if (sellQty > 0) {
                    if (sellQty > lot.availableQty) {
                        alert(`দুঃখিত! এই লটে সর্বোচ্চ ${lot.availableQty} টি শেয়ার অবশিষ্ট আছে। আপনার ইনপুট বেশি হয়েছে।`);
                        return;
                    }
                    if (sellPrice <= 0) {
                        alert("দয়া করে সঠিক বিক্রয় মূল্য (Price) দিন।");
                        return;
                    }
                }
            }
        }

        // দ্বিতীয় ধাপ: বিক্রয় রেকর্ড প্রস্তুতকরণ এবং ব্যাচে যুক্ত করা
        for (let lot of currentActiveLots) {
            const qtyField = document.getElementById(`input-sell-qty-${lot.docId}`);
            const priceField = document.getElementById(`input-sell-price-${lot.docId}`);
            
            if (qtyField && priceField) {
                const sellQty = Number(qtyField.value) || 0;
                const sellPrice = Number(priceField.value) || 0;

                if (sellQty > 0) {
                    const saleRecordRef = db.collection("sales_history").doc();
                    
                    // বিক্রয় ডাটা প্রস্তুত করা
                    batch.set(saleRecordRef, {
                        userId: user.uid,
                        shareName: ticker,
                        quantitySold: sellQty,
                        buyPrice: lot.buyPrice,
                        sellPrice: sellPrice,
                        profitOrLoss: (sellPrice - lot.buyPrice) * sellQty,
                        date: transactionDate,  // 👈 পরিবর্তন: new Date() এর জায়গায় transactionDate
    createdAt: new Date()
                    });

                    totalSoldSuccessfully += sellQty;
                }
            }
        }

        if (totalSoldSuccessfully === 0) {
            return alert("দয়া করে অন্তত যেকোনো একটি লটে বিক্রয়ের পরিমাণ (Qty) লিখুন।");
        }

        // তৃতীয় ধাপ: ডেটাবেজে সাবমিট করা
        try {
            await batch.commit();
alert(`অভিনন্দন! সফলভাবে ${totalSoldSuccessfully} টি ${ticker} শেয়ার বিক্রয় রেকর্ড করা হয়েছে। তারিখ: ${selectedDate}`);

// রিসেট এবং রিফ্রেশ লজিক
sellTickerInput.value = "";
sellHoldingsContainer.classList.add('hidden');
if (sellDateInput) sellDateInput.value = getTodayDate();

// 🔥 চার্ট রিফ্রেশ করার জন্য পেজ রিলোড
setTimeout(() => {
    location.reload();
}, 500);
            
            // মূল পোর্টফোলিও টেবিল রিয়েল-টাইমে আপডেট করা
            if (auth.currentUser) {
                loadUnifiedStockTable(auth.currentUser.uid);
            }
        } catch (error) {
            console.error("সেল এক্সিকিউট করতে সমস্যা:", error);
            alert("দুঃখিত, কারিগরি ত্রুটির কারণে বিক্রি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।");
        }
    });
}
// ==========================================
// 📊 ৯. নতুন লট-ভিত্তিক অ্যানালাইসিস স্ট্যাট (Analysis Stat) লজিক
// ==========================================
analysisTickerInput.addEventListener('input', () => {
    const query = analysisTickerInput.value.trim().toUpperCase();
    analysisSuggestionBox.innerHTML = ""; 

    if (!query) {
        analysisSuggestionBox.classList.add('hidden');
        analysisResultContainer.classList.add('hidden');
        return;
    }

    const filteredStocks = dseStocks.filter(stock => stock.startsWith(query));

    if (filteredStocks.length > 0) {
        analysisSuggestionBox.classList.remove('hidden');
        filteredStocks.forEach(stock => {
            const div = document.createElement('div');
            div.classList.add('suggestion-item');
            div.innerText = stock;
            div.addEventListener('click', () => {
                analysisTickerInput.value = stock;
                analysisSuggestionBox.classList.add('hidden');
                generateAnalysisStatement(stock); 
            });
            analysisSuggestionBox.appendChild(div);
        });
    } else {
        analysisSuggestionBox.classList.add('hidden');
    }
});

async function generateAnalysisStatement(ticker) {
    const user = auth.currentUser;
    if (!user) return;

    selectedAnalysisTickerText.innerText = ticker;
    analysisTableBody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>Compiling analysis ledger...</td></tr>";
    analysisResultContainer.classList.remove('hidden');

    try {
        let currentPrice = 0;
        try {
            const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
            if (response.ok) {
                const stockData = await response.json();
                if (stockData && stockData.ltp) currentPrice = stockData.ltp;
            }
        } catch (err) { console.error(err); }

        if (currentPrice === 0) {
            currentPrice = Number(getHardcodedPrice(ticker));
        }

        const buySnapshot = await db.collection("portfolios")
            .where("userId", "==", user.uid)
            .where("shareName", "==", ticker)
            .get();

        const sellSnapshot = await db.collection("sales_history")
            .where("userId", "==", user.uid)
            .where("shareName", "==", ticker)
            .get();

        let buyLots = [];
        buySnapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            buyLots.push({
                date: dateObj,
                originalQty: data.quantity,
                buyPrice: data.buyPrice,
                soldQtyFromLot: 0,
                totalSellValueFromLot: 0
            });
        });

        buyLots.sort((a, b) => a.date - b.date);

        let sales = [];
        sellSnapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            sales.push({
                date: dateObj,
                qtySold: data.quantitySold,
                sellPrice: data.sellPrice,
                buyPrice: data.buyPrice 
            });
        });
        sales.sort((a, b) => a.date - b.date);

        sales.forEach(sale => {
            let qtyToBeAssigned = sale.qtySold;

            for (let i = 0; i < buyLots.length; i++) {
                let lot = buyLots[i];
                let availableInLot = lot.originalQty - lot.soldQtyFromLot;

                if (availableInLot > 0 && qtyToBeAssigned > 0) {
                    let taken = Math.min(availableInLot, qtyToBeAssigned);
                    lot.soldQtyFromLot += taken;
                    lot.totalSellValueFromLot += (taken * sale.sellPrice);
                    qtyToBeAssigned -= taken;
                }
                if (qtyToBeAssigned <= 0) break;
            }
        });

        analysisTableBody.innerHTML = "";
        let rowsHtml = "";

        let grandRemainingQty = 0;
        let grandTotalBuyCost = 0;

        buyLots.forEach(lot => {
            const formattedDate = lot.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            
            const remainingQty = lot.originalQty - lot.soldQtyFromLot;
            const avgSellPrice = lot.soldQtyFromLot > 0 ? (lot.totalSellValueFromLot / lot.soldQtyFromLot) : 0;
            
            const realizedGain = lot.soldQtyFromLot > 0 ? (lot.totalSellValueFromLot - (lot.soldQtyFromLot * lot.buyPrice)) : 0;
            const unrealizedGain = remainingQty > 0 ? ((currentPrice - lot.buyPrice) * remainingQty) : 0;

            grandRemainingQty += remainingQty;
            grandTotalBuyCost += (remainingQty * lot.buyPrice);

            const realizedClass = realizedGain >= 0 ? "up" : "error";
            const unrealizedClass = unrealizedGain >= 0 ? "up" : "error";

            rowsHtml += `
                <tr style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.backgroundColor='#f1f5f9'" onmouseout="this.style.backgroundColor='transparent'" onclick="openLedgerModal('${ticker}')" title="Click to Edit or Delete">
                    <td>${formattedDate}</td>
                    <td>${lot.originalQty}</td>
                    <td>৳${lot.buyPrice.toFixed(2)}</td>
                    <td>${lot.soldQtyFromLot > 0 ? lot.soldQtyFromLot : '-'}</td>
                    <td>${lot.soldQtyFromLot > 0 ? `৳${avgSellPrice.toFixed(2)}` : '-'}</td>
                    <td class="${lot.soldQtyFromLot > 0 ? realizedClass : ''}">${lot.soldQtyFromLot > 0 ? `৳${realizedGain.toFixed(2)}` : '-'}</td>
                    <td style="font-weight:bold;">${remainingQty}</td>
                    <td>৳${currentPrice.toFixed(2)}</td>
                    <td class="${remainingQty > 0 ? unrealizedClass : ''}">${remainingQty > 0 ? `৳${unrealizedGain.toFixed(2)}` : '-'}</td>
                </tr>
            `;
        });

        analysisTableBody.innerHTML = rowsHtml;

        let grandAvgBuyPrice = grandRemainingQty > 0 ? (grandTotalBuyCost / grandRemainingQty) : 0;

        if(footAnalysisRemQty) footAnalysisRemQty.innerText = grandRemainingQty > 0 ? grandRemainingQty : "0 (Sold Out)";
        if(footAnalysisTotalCost) footAnalysisTotalCost.innerText = `৳${grandTotalBuyCost.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
        if(footAnalysisAvgPrice) footAnalysisAvgPrice.innerText = `৳${grandAvgBuyPrice.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;

    } catch (error) { console.error("অ্যানালাইসিস তৈরি করতে সমস্যা হয়েছে: ", error); }
}

// ==========================================
// ১০. সাইডবার গ্লোবাল ট্র্যাকিং ফাংশনসমূহ
// ==========================================
window.toggleLeftSidebar = function() {
    const leftSidebar = document.getElementById('left-sidebar');
    if (leftSidebar) leftSidebar.classList.toggle('active');
};

window.toggleRightSidebar = function() {
    const rightSidebar = document.getElementById('right-sidebar');
    if (rightSidebar) rightSidebar.classList.toggle('active');
};
// ==========================================
// 📅 DATE PICKER DEFAULT VALUE SET
// ==========================================



// Buy Date Picker ডিফল্ট সেট করা
const tradeDateInput = document.getElementById('trade-date');
if (tradeDateInput) {
    tradeDateInput.value = getTodayDate();
}

// Sell Date Picker ডিফল্ট সেট করা
const sellDateInput = document.getElementById('sell-trade-date');
if (sellDateInput) {
    sellDateInput.value = getTodayDate();
}

// ==========================================
// ১১. DSE Stock List
// ==========================================
const dseStocks = [
"1JANATAMF", "1STPRIMFMF", "AAMRANET", "AAMRATECH", "ABB1STMF", "ABBANK", "ACFL", "ACI", "ACIFORMULA", "ACMELAB",
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
"FASFIN", "FBFIF", "FEDERALINS", "FEKDIL", "FINEFOODS", "FIRSTFIN", "FIRSTSBANK", "FORTUNE", "FUWANGCER",
"FUWANGFOOD", "GBBPOWER", "GEMINISEA", "GENEXIL", "GENNEXT", "GHAIL", "GHCL", "GIB", "GLAXOSMITH", "GLOBALINS",
"GOLDENSON", "GP", "GPHISPAT", "GQBALLPEN", "GSPFINANCE", "GRAMEENS2", "GREENDELT", "HAKKANIPUL", "HEIDELBCEM", "HFL", "HRTEX",
"HWAWELLTEX", "IBNSINA", "IBP", "ICB", "ICB3RDNRB", "ICBAGRANI1", "ICBAMCL2ND", "ICBEPMF1S1", "IDLC", "IFADAUTOS", "ICICL",
"IFIC", "IFIC1STMF", "IFILISLMF1", "ILFSL", "INDEXAGRO", "INTECH", "INTRACO", "IPDC", "ISLAMIBANK", "ISLAMICFIN", "ICBEPMF1S1", 
"ISNLTD", "ITC", "JAMUNABANK", "JAMUNAOIL", "JANATAINS", "JHRML", "JMISMDL", "JUTESPINN", "KARNAPHULI", "KAY&QUE",
"KBPPWBIL", "KDSALTD", "KEYACOSMET", "KPCL", "KPPL", "LANKABAFIN", "LEGACYFOOT", "LHBL", "LIBRAINFU", "LINDEBD",
"LOVELLO", "LRBDL", "MARICO", "MATINSPINN", "MBL1STMF", "MEGCONMILK", "MEGHNACEM", "MEGHNALIFE", "MEGHNAPET", "MERCANBANK",
"MERCINS", "METROSPIN", "MHSML", "MIDASFIN", "MIRACLEIND", "MIRAKHTER", "MONNOAGML", "MONNOCERA", "MONNOFABR", "MONOSPOOL","MALEKSPIN", "MPETROLEUM", "MTB", "MIDLANDBNK", "NAHEEACP", "NATLIFEINS", "NAVANACNG", "NAVANAPHAR", "NBL", "NCCBANK", "NCCBLMF1", "NEWLINE",
"NITOLINS", "NORTHERN", "NORTHRNINS", "NPOLYMER", "NRBBANK", "NTLTUBES", "OAL", "NHFIL", "OIMEX", "OLYMPIC", "ONEBANK",
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
"UTTARAFIN", "VAMLBDMF1", "VAMLRBBF", "VFSTDL", "WALTONHIL", "WATACHEM", "WMSHIPYARD", "YPL", "ZAHEENSPIN", "ZAHINTEX"
];

// ==========================================
// ১২. স্টেটমেন্ট (Statement Window) ব্যাকআপ লজিক
// ==========================================
const stmtTickerInput = document.getElementById('statement-ticker');
const stmtSuggestionBox = document.getElementById('statement-suggestion-box');
const stmtResultContainer = document.getElementById('statement-result-container');
const selectedStmtTickerText = document.getElementById('selected-statement-ticker');
const stmtTableBody = document.getElementById('statement-table-body');

if(stmtTickerInput) {
    stmtTickerInput.addEventListener('input', () => {
        const query = stmtTickerInput.value.trim().toUpperCase();
        stmtSuggestionBox.innerHTML = ""; 

        if (!query) {
            stmtSuggestionBox.classList.add('hidden');
            stmtResultContainer.classList.add('hidden');
            return;
        }

        const filteredStocks = dseStocks.filter(stock => stock.startsWith(query));

        if (filteredStocks.length > 0) {
            stmtSuggestionBox.classList.remove('hidden');
            filteredStocks.forEach(stock => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.innerText = stock;
                div.addEventListener('click', () => {
                    stmtTickerInput.value = stock;
                    stmtSuggestionBox.classList.add('hidden');
                    generateShareStatement(stock); 
                });
                stmtSuggestionBox.appendChild(div);
            });
        } else {
            stmtSuggestionBox.classList.add('hidden');
        }
    });
}

async function generateShareStatement(ticker) {
    const user = auth.currentUser;
    if (!user) return;

    selectedStmtTickerText.innerText = ticker;
    stmtTableBody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Compiling statement ledger...</td></tr>";
    stmtResultContainer.classList.remove('hidden');

    const footStmtRemQty = document.getElementById('foot-stmt-rem-qty');
    const footStmtTotalBuy = document.getElementById('foot-stmt-total-buy');
    const footStmtAvgBuy = document.getElementById('foot-stmt-avg-buy');
    const footStmtLtp = document.getElementById('foot-stmt-ltp');
    const footStmtUnrealized = document.getElementById('foot-stmt-unrealized');

    try {
        let currentPrice = 0;
        try {
            const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
            if (response.ok) {
                const stockData = await response.json();
                if (stockData && stockData.ltp) currentPrice = stockData.ltp;
            }
        } catch (err) { console.error(err); }

        if (currentPrice === 0) {
            currentPrice = Number(getHardcodedPrice(ticker));
        }

        const buySnapshot = await db.collection("portfolios").where("userId", "==", user.uid).where("shareName", "==", ticker).get();
        const sellSnapshot = await db.collection("sales_history").where("userId", "==", user.uid).where("shareName", "==", ticker).get();

        let timelineEntries = [];
        let totalBuyQty = 0;
        let totalBuyCost = 0;
        let totalSellQty = 0;

        buySnapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            totalBuyQty += data.quantity;
            totalBuyCost += (data.quantity * data.buyPrice);

            timelineEntries.push({
                date: dateObj, type: "BUY", qty: data.quantity, price: data.buyPrice, total: data.quantity * data.buyPrice, profit: "-"
            });
        });

        sellSnapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
            totalSellQty += data.quantitySold;

            timelineEntries.push({
                date: dateObj, type: "SELL", qty: data.quantitySold, price: data.sellPrice, total: data.quantitySold * data.sellPrice, profit: data.profitOrLoss
            });
        });

        if (timelineEntries.length === 0) {
            stmtTableBody.innerHTML = `<tr><td colspan='7' style='text-align:center;'>No transactional ledger found.</td></tr>`;
            return;
        }

        timelineEntries.sort((a, b) => a.date - b.date);

        let runningQty = 0;
        timelineEntries.forEach(entry => {
            if (entry.type === "BUY") {
                runningQty += entry.qty; 
            } else if (entry.type === "SELL") {
                runningQty -= entry.qty; 
            }
            entry.currentRunningQty = runningQty; 
        });

        let totalRemainingQty = totalBuyQty - totalSellQty;
        if (totalRemainingQty < 0) totalRemainingQty = 0;

        let avgBuyPriceForRem = totalBuyQty > 0 ? (totalBuyCost / totalBuyQty) : 0;
        let actualRemainingInvestment = totalRemainingQty * avgBuyPriceForRem;
        let totalUnrealizedGain = totalRemainingQty > 0 ? ((currentPrice - avgBuyPriceForRem) * totalRemainingQty) : 0;

        stmtTableBody.innerHTML = "";

        timelineEntries.forEach(entry => {
            const formattedDate = entry.date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
            const typeClass = entry.type === "BUY" ? "up" : "error";
            
            let profitDisplay = entry.profit;
            let profitClass = "";
            if (entry.profit !== "-") {
                profitDisplay = `৳${entry.profit.toFixed(2)}`;
                profitClass = entry.profit >= 0 ? "up" : "error";
            }

            stmtTableBody.innerHTML += `
                <tr>
                    <td>${formattedDate}</td>
                    <td class="${typeClass}"><b>${entry.type}</b></td>
                    <td>${entry.qty}</td>
                    <td>৳${entry.price.toFixed(2)}</td>
                    <td>৳${entry.total.toFixed(2)}</td>
                    <td class="${profitClass}">${profitDisplay}</td>
                    <td style="font-weight: bold; color: #475569;">${entry.currentRunningQty}</td>
                </tr>
            `;
        });

        if (footStmtRemQty) footStmtRemQty.innerText = totalRemainingQty > 0 ? totalRemainingQty : "0 (Sold Out)";
        if (footStmtTotalBuy) footStmtTotalBuy.innerText = `৳${actualRemainingInvestment.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
        if (footStmtAvgBuy) footStmtAvgBuy.innerText = `৳${avgBuyPriceForRem.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
        if (footStmtLtp) footStmtLtp.innerText = `৳${currentPrice.toFixed(2)}`;
        
        if (footStmtUnrealized) {
            footStmtUnrealized.innerText = `৳${totalUnrealizedGain.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
            footStmtUnrealized.style.color = totalUnrealizedGain >= 0 ? '#10b981' : '#ef4444';
        }

    } catch (error) { console.error("স্টেটমেন্ট তৈরি করতে সমস্যা হয়েছে: ", error); }
}

function getHardcodedPrice(ticker) {
    const prices = {
        "GP": 255.40,
        "ROBI": 26.10,
        "SQURPHARMA": 208.70,
        "BATBC": 518.00,
        "BEXIMCO": 115.20
    };
    return prices[ticker] || 0.1; 
}
// ==========================================
// 🔤 টেবিল সর্টিং এবং কাউন্ট ফাংশন
// ==========================================

let currentSortedColumn = null;
let currentSortDirection = 'asc';

// টেবিল সর্টিং ফাংশন
function sortTable(columnIndex) {
    const tableBody = document.getElementById('portfolio-table-body');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    const dataRows = rows.filter(row => {
        const firstCell = row.querySelector('td');
        return firstCell && !row.innerText.includes('No trade history');
    });
    
    if (dataRows.length === 0) return;
    
    if (currentSortedColumn === columnIndex) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortedColumn = columnIndex;
        currentSortDirection = 'asc';
    }
    
    dataRows.sort((a, b) => {
        let aValue = a.cells[columnIndex]?.innerText || '';
        let bValue = b.cells[columnIndex]?.innerText || '';
        
        if (columnIndex >= 1 && columnIndex <= 8) {
            aValue = parseFloat(aValue.replace(/[৳,]/g, '')) || 0;
            bValue = parseFloat(bValue.replace(/[৳,]/g, '')) || 0;
            return currentSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
        if (currentSortDirection === 'asc') {
            return aValue.localeCompare(bValue);
        } else {
            return bValue.localeCompare(aValue);
        }
    });
    
    dataRows.forEach(row => tableBody.appendChild(row));
    updateSortIndicators(columnIndex);
}

function updateSortIndicators(columnIndex) {
    const headers = document.querySelectorAll('#sec-table th');
    headers.forEach((header, index) => {
        const existingIndicator = header.querySelector('.sort-indicator');
        if (existingIndicator) existingIndicator.remove();
        
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.style.marginLeft = '5px';
        indicator.style.fontSize = '10px';
        
        if (index === columnIndex) {
            indicator.innerText = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
            header.appendChild(indicator);
        }
    });
}

function updateCompanyCount() {
    const tableBody = document.getElementById('portfolio-table-body');
    const rows = tableBody.querySelectorAll('tr');
    
    let companyCount = 0;
    let activeCompanies = [];
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const shareName = cells[0]?.innerText || '';
            const remainingQty = cells[3]?.innerText || '0';
            
            if (remainingQty !== '-' && remainingQty !== '0' && !shareName.includes('Sold Out')) {
                if (!activeCompanies.includes(shareName)) {
                    activeCompanies.push(shareName);
                    companyCount++;
                }
            }
        }
    });
    
    const footer = document.querySelector('#sec-table tfoot');
    if (footer && !document.getElementById('company-count-row')) {
        const newRow = document.createElement('tr');
        newRow.id = 'company-count-row';
        newRow.innerHTML = `
            <td colspan="9" style="text-align: left; background: #f8fafc; font-weight: bold;">
                📊 মোট কোম্পানি: ${companyCount} টি
            </td>
        `;
        footer.appendChild(newRow);
    } else {
        const countRow = document.getElementById('company-count-row');
        if (countRow) {
            countRow.innerHTML = `
                <td colspan="9" style="text-align: left; background: #f8fafc; font-weight: bold;">
                    📊 মোট কোম্পানি: ${companyCount} টি
                </td>
            `;
        }
    }
}

function updateTableHeadersWithSort() {
    const headers = document.querySelectorAll('#sec-table th');
    headers.forEach((header, index) => {
        if (!header.hasAttribute('data-sortable')) {
            header.setAttribute('data-sortable', 'true');
            header.style.cursor = 'pointer';
            header.title = 'ক্লিক করে সর্ট করুন';
            header.addEventListener('click', () => sortTable(index));
        }
    });
}
// আগের দিনের ক্লোজ প্রাইস বের করার ফাংশন (stock_history ব্যবহার করে)
async function getPreviousCloseFromScraper(ticker) {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // stock_history কালেকশন থেকে গতকালের ডাটা খোঁজা
        const docRef = db.collection('stock_history').doc(`${ticker}_${dateStr}`);
        const doc = await docRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            const previousPrice = data.price;
            console.log(`📊 ${ticker} গতকালের দর: ${previousPrice} (${dateStr})`);
            return previousPrice;
        }
        
        console.log(`⚠️ ${ticker}: গতকালের ডাটা নেই (${dateStr})`);
        return null;
        
    } catch (error) {
        console.error(`গতকালের প্রাইস পেতে ব্যর্থ (${ticker}):`, error);
        return null;
    }
}

// লাইভ প্রাইস + ডেইলি চেঞ্জ একসাথে আনার ফাংশন
async function fetchStockWithDailyChange(ticker) {
    let currentPrice = 0;
    
    // ১. লাইভ প্রাইস API থেকে আনা
    try {
        const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.ltp) {
                currentPrice = Number(data.ltp);
                console.log(`🟢 ${ticker} লাইভ প্রাইস: ${currentPrice}`);
            }
        }
    } catch (err) {
        console.error(`${ticker} লাইভ প্রাইস পেতে ব্যর্থ:`, err);
    }
    
    // লাইভ না পেলে হার্ডকোডেড
    if (currentPrice === 0) {
        currentPrice = Number(getHardcodedPrice(ticker));
        console.log(`📦 ${ticker} হার্ডকোডেড প্রাইস ব্যবহার: ${currentPrice}`);
    }
    
    // ২. current_prices থেকে গতকালের প্রাইস বের করা
    const previousClose = await getPreviousCloseFromScraper(ticker);
    
    // ৩. ডেইলি চেঞ্জ ক্যালকুলেশন
    let dailyChange = 0;
    let dailyChangePcnt = 0;
    
    if (previousClose && previousClose > 0) {
        dailyChange = currentPrice - previousClose;
        dailyChangePcnt = (dailyChange / previousClose) * 100;
        console.log(`📈 ${ticker}: আজ=${currentPrice}, গতকাল=${previousClose}, চেঞ্জ=${dailyChange.toFixed(2)} (${dailyChangePcnt.toFixed(2)}%)`);
    } else {
        console.log(`⚠️ ${ticker}: গতকালের ডাটা নেই, Daily Change 0 দেখাবে`);
    }
    
    return {
        currentPrice: currentPrice,
        dailyChange: dailyChange,
        dailyChangePcnt: dailyChangePcnt
    };
}
        

// ==========================================
// 🛠️ ১৩. Analysis Stat রো ক্লিক, ইডিট এবং ডিলিট লজিক
// ==========================================
window.openLedgerModal = async function(ticker) {
    const user = auth.currentUser;
    if (!user) return;

    const modal = document.getElementById('ledger-modal');
    const modalTitle = document.getElementById('modal-ticker-title');
    const listContainer = document.getElementById('modal-transaction-list');
    const editForm = document.getElementById('modal-edit-form');

    modalTitle.innerText = ticker;
    if(editForm) editForm.style.display = 'none'; 
    listContainer.innerHTML = "<p style='text-align:center; font-size:13px; color:#64748b;'>Loading history...</p>";
    if(modal) modal.style.display = 'flex';

    try {
        const buySnapshot = await db.collection("portfolios").where("userId", "==", user.uid).where("shareName", "==", ticker).get();
        const sellSnapshot = await db.collection("sales_history").where("userId", "==", user.uid).where("shareName", "==", ticker).get();

        let html = `
            <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
                <thead>
                    <tr style="background:#f1f5f9; color:#475569;">
                        <th style="padding:8px; border:1px solid #e2e8f0;">Type</th>
                        <th style="padding:8px; border:1px solid #e2e8f0;">Qty</th>
                        <th style="padding:8px; border:1px solid #e2e8f0;">Price</th>
                        <th style="padding:8px; border:1px solid #e2e8f0; text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let hasData = false;

        buySnapshot.forEach(doc => {
            const data = doc.data();
            hasData = true;
            html += `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px; color:#007bff; font-weight:bold;">BUY</td>
                    <td style="padding:8px;">${data.quantity}</td>
                    <td style="padding:8px;">৳${data.buyPrice.toFixed(2)}</td>
                    <td style="padding:8px; text-align:center;">
                        <button onclick="showEditForm('${doc.id}', 'BUY', ${data.quantity}, ${data.buyPrice})" style="padding:3px 8px; background:#0284c7; color:white; border:none; border-radius:4px; cursor:pointer; margin-right:4px;">Edit ✏️</button>
                        <button onclick="deleteRecord('${doc.id}', 'BUY', '${ticker}')" style="padding:3px 8px; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer;">Delete 🗑️</button>
                    </td>
                </tr>
            `;
        });

        sellSnapshot.forEach(doc => {
            const data = doc.data();
            hasData = true;
            html += `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px; color:#ef4444; font-weight:bold;">SELL</td>
                    <td style="padding:8px;">${data.quantitySold}</td>
                    <td style="padding:8px;">৳${data.sellPrice.toFixed(2)}</td>
                    <td style="padding:8px; text-align:center;">
                        <button onclick="showEditForm('${doc.id}', 'SELL', ${data.quantitySold}, ${data.sellPrice})" style="padding:3px 8px; background:#0284c7; color:white; border:none; border-radius:4px; cursor:pointer; margin-right:4px;">Edit ✏️</button>
                        <button onclick="deleteRecord('${doc.id}', 'SELL', '${ticker}')" style="padding:3px 8px; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer;">Delete 🗑️</button>
                    </td>
                </tr>
            `;
        });

        html += "</tbody></table>";

        if (!hasData) {
            listContainer.innerHTML = "<p style='text-align:center; color:#ef4444;'>No records found for this stock.</p>";
        } else {
            listContainer.innerHTML = html;
        }

    } catch (error) {
        console.error("Error fetching popup list: ", error);
    }
};

window.closeLedgerModal = function() {
    const modal = document.getElementById('ledger-modal');
    if(modal) modal.style.display = 'none';
};

window.showEditForm = function(id, type, qty, price) {
    const editForm = document.getElementById('modal-edit-form');
    if(editForm) editForm.style.display = 'block';
    document.getElementById('edit-form-title').innerText = `Editing ${type} Entry`;
    document.getElementById('edit-doc-id').value = id;
    document.getElementById('edit-doc-type').value = type;
    document.getElementById('edit-input-qty').value = qty;
    document.getElementById('edit-input-price').value = price;
};

window.saveEditedRecord = async function() {
    const id = document.getElementById('edit-doc-id').value;
    const type = document.getElementById('edit-doc-type').value;
    const qty = Number(document.getElementById('edit-input-qty').value);
    const price = Number(document.getElementById('edit-input-price').value);
    const ticker = document.getElementById('modal-ticker-title').innerText;

    if (!qty || qty <= 0 || !price || price <= 0) {
        return alert("দয়া করে সঠিক সংখ্যা এবং দর দিন।");
    }

    try {
        if (type === 'BUY') {
            await db.collection("portfolios").doc(id).update({
                quantity: qty,
                buyPrice: price
            });
        } else {
            const docSnap = await db.collection("sales_history").doc(id).get();
            const originalBuyPrice = docSnap.data().buyPrice || 0;
            await db.collection("sales_history").doc(id).update({
                quantitySold: qty,
                sellPrice: price,
                profitOrLoss: (price - originalBuyPrice) * qty
            });
        }

        alert("রেকর্ডটি সফলভাবে ইডিট করা হয়েছে!");
        closeLedgerModal();
        
        if (auth.currentUser) {
            loadUnifiedStockTable(auth.currentUser.uid);
            generateAnalysisStatement(ticker);
        }
    } catch (error) {
        console.error("Error updating record: ", error);
        alert("ইডিট আপডেট করা যায়নি।");
    }
};

window.deleteRecord = async function(id, type, ticker) {
    if (!confirm(`আপনি কি নিশ্চিতভাবে এই ${type} রেকর্ডটি ডিলিট করতে চান?`)) return;

    try {
        if (type === 'BUY') {
            await db.collection("portfolios").doc(id).delete();
        } else {
            await db.collection("sales_history").doc(id).delete();
        }

        alert("রেকর্ডটি সফলভাবে ডিলিট করা হয়েছে!");
        closeLedgerModal();

        if (auth.currentUser) {
            loadUnifiedStockTable(auth.currentUser.uid);
            generateAnalysisStatement(ticker);
        }
    } catch (error) {
        console.error("Error deleting record: ", error);
        alert("ডিলিট করা সম্ভব হয়নি।");
    }
};

// ==========================================
// 🗑️ ১৪. সম্পূর্ণ পোর্টফোলিও মুছে ফেলার লজিক (Delete Portfolio)
// ==========================================
window.confirmAndDeletePortfolio = async function() {
    const user = auth.currentUser;
    if (!user) return alert("দয়া করে আগে লগইন করুন!");

    const firstCheck = confirm("সতর্কতা! আপনি কি আপনার পোর্টফোলিওর সমস্ত বাই (BUY) এবং সেল (SELL) হিস্ট্রি চিরতরে মুছে ফেলতে চান?");
    if (!firstCheck) return;

    const secondCheck = confirm("আপনি কিন্তু এই ডাটা আর কখনো ফিরে পাবেন না! আপনি কি আসলেই সম্পূর্ণ পোর্টফোলিও ডিলিট করতে নিশ্চিত?");
    if (!secondCheck) return;

    try {
        alert("পোর্টফোলিও মোছার কাজ শুরু হয়েছে, দয়া করে কিছুক্ষণ অপেক্ষা করুন...");

        const buySnapshot = await db.collection("portfolios").where("userId", "==", user.uid).get();
        const sellSnapshot = await db.collection("sales_history").where("userId", "==", user.uid).get();

        const batch = db.batch();

        buySnapshot.forEach(doc => {
            batch.delete(db.collection("portfolios").doc(doc.id));
        });

        sellSnapshot.forEach(doc => {
            batch.delete(db.collection("sales_history").doc(doc.id));
        });

        await batch.commit();
        alert("আপনার পোর্টফোলিওর সমস্ত ডাটা সফলভাবে মুছে ফেলা হয়েছে!");
        window.location.reload();

    } catch (error) {
        console.error("পোর্টফোলিও ডিলিট করতে সমস্যা হয়েছে: ", error);
        alert("দুঃখিত, পোর্টফোলিওটি মুছে ফেলা সম্ভব হয়নি। আবার চেষ্টা করুন।");
    }
};

// ==========================================
// 🚀 ১৫. Stock Table থেকে Analysis Stat ট্যাবে অটো নেভিগেশন
// ==========================================
window.navigateToAnalysis = function(ticker) {
    switchTab('analysis'); 

    const analysisInput = document.getElementById('analysis-ticker');
    if (analysisInput) {
        analysisInput.value = ticker;
    }

    if (typeof generateAnalysisStatement === "function") {
        generateAnalysisStatement(ticker);
    }
};

// ==========================================
// ==========================================
// 🚀 পোর্টফোলিও অ্যানালাইসিস টেবিল (আপডেটেড - ডেইলি চেঞ্জ সহ)
// ==========================================
// ==========================================
// 📊 পোর্টফোলিও অ্যানালাইসিস সর্টিং ফাংশন
// ==========================================

let currentPortfolioSortOrder = 'asc'; // 'asc' বা 'desc'
let currentPortfolioData = []; // সর্টিংয়ের জন্য ডাটা স্টোর করব

// এই ফাংশনটি ডাটা লোড হওয়ার সময় কল হবে
function storePortfolioDataForSorting(dataArray) {
    currentPortfolioData = dataArray;
}

// সর্টিং বাটন ক্লিক করলে এই ফাংশন কল হবে
window.sortPortfolioAnalysis = function() {
    if (currentPortfolioData.length === 0) {
        console.log('No data to sort');
        return;
    }
    
    // সর্টিং অর্ডর টগল
    currentPortfolioSortOrder = currentPortfolioSortOrder === 'asc' ? 'desc' : 'asc';
    
    // বাটনের টেক্সট আপডেট
    const sortBtn = document.getElementById('sort-portfolio-btn');
    if (sortBtn) {
        sortBtn.innerHTML = currentPortfolioSortOrder === 'asc' ? '🔤 Sort A to Z' : '🔤 Sort Z to A';
    }
    
    // ডাটা সর্ট করা
    const sortedData = [...currentPortfolioData].sort((a, b) => {
        const nameA = a.ticker.toUpperCase();
        const nameB = b.ticker.toUpperCase();
        
        if (currentPortfolioSortOrder === 'asc') {
            return nameA.localeCompare(nameB);
        } else {
            return nameB.localeCompare(nameA);
        }
    });
    
    // সর্টেড ডাটা রেন্ডার করা
    renderPortfolioAnalysis(sortedData);
};

// আলাদা রেন্ডার ফাংশন ( থেকে আলাদা করে বের করা)
function renderPortfolioAnalysis(portfolioData) {
    const listContainer = document.getElementById('bull-analysis-list');
    if (!listContainer) return;
    
    if (portfolioData.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #94a3b8;">No active stocks found.</div>`;
        // Summary Cards reset
        document.getElementById('summary-total-value').innerHTML = '৳0.00';
        document.getElementById('summary-total-cost').innerHTML = '৳0.00';
        document.getElementById('summary-total-daily').innerHTML = '৳0.00';
        document.getElementById('summary-total-gl').innerHTML = '৳0.00';
        return;
    }
    
    let finalHtml = "";
    let grandTotalCost = 0;
    let grandTotalCurrentValue = 0;
    let grandTotalDailyGL = 0;
    let grandTotalGL = 0;
    // গ্লোবাল ভেরিয়েবলে সেভ করুন
// লুপ শেষ হওয়ার পর এই লাইনটি নিশ্চিত করুন
currentPortfolioTotalValue = grandTotalCurrentValue;
updateDashboardCurrentValue();
    
    for (const item of portfolioData) {
        const { ticker, avgBuyPrice, totalRemainingQty, totalCost, currentPrice, dailyChange, totalGL, totalGLPcnt, totalStockDailyGL, totalStockDailyPcnt, activeLotsForDisplay, livePriceClass, dailyGlClass, totalGlClass, blockId } = item;
        
        const currentValue = totalRemainingQty * currentPrice;
        
        finalHtml += `
            <div class="stock-block" id="parent-${blockId}">
                <div class="stock-main-row" onclick="toggleBullLot('${blockId}'); openStockDetailModal('${ticker}');">
                    <div class="bull-col-code">
                        <div class="ticker-title" style="color: #2563eb; text-decoration: underline; cursor: pointer;">${ticker}</div>
                        <div class="${livePriceClass}" style="font-weight:600; margin-top:2px;">
                            ${currentPrice.toFixed(2)} 
                            <span style="font-size:11px;">(${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)})</span>
                        </div>
                        <div style="color: #64748b; font-size:12px; margin-top:3px;">
                            ${avgBuyPrice.toFixed(2)} x ${totalRemainingQty} shares
                        </div>
                        <span class="toggle-text" id="btn-${blockId}">+ Show All</span>
                    </div>
                    <div class="bull-col-value" style="font-size:12px; font-weight:600; line-height: 1.4;">
                        <div style="color:#000;">${currentValue.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                        <div style="color:#64748b; font-weight:normal; margin-top:14px;">${totalCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                    </div>
                    <div class="bull-col-daily ${dailyGlClass}" style="font-size:12px; font-weight:500; line-height: 1.4;">
                        <div>${totalStockDailyGL >= 0 ? '+' : ''}${totalStockDailyGL.toFixed(2)}</div>
                        <div style="font-size:11px; margin-top:14px;">${totalStockDailyPcnt >= 0 ? '+' : ''}${totalStockDailyPcnt.toFixed(2)}%</div>
                    </div>
                    <div class="bull-col-total ${totalGlClass}" style="font-size:12px; font-weight:600; line-height: 1.4;">
                        <div>${totalGL >= 0 ? '+' : ''}${totalGL.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                        <div style="font-size:11px; margin-top:14px;">${totalGLPcnt >= 0 ? '+' : ''}${totalGLPcnt.toFixed(2)}%</div>
                    </div>
                </div>
                <div class="lot-rows-container" id="container-${blockId}" style="display:none;">
        `;
        
        for (const lot of activeLotsForDisplay) {
            const lotDailyClass = lot.dailyGL >= 0 ? "bull-profit" : "bull-loss";
            const lotTotalClass = lot.totalGL >= 0 ? "bull-profit" : "bull-loss";
            
            finalHtml += `
                <div class="stock-lot-row">
                    <div class="bull-col-code" style="color: #64748b; padding-left: 5px;">
                        <b>${lot.buyPrice.toFixed(2)}</b> x ${lot.qty} shares
                    </div>
                    <div class="bull-col-value">
                        <div style="color:#000;">${lot.currentValue.toFixed(2)}</div>
                        <div style="color:#64748b; font-size:11px;">${lot.cost.toFixed(2)}</div>
                    </div>
                    <div class="bull-col-daily ${lotDailyClass}">
                        <div>${lot.dailyGL >= 0 ? '+' : ''}${lot.dailyGL.toFixed(2)}</div>
                        <div style="font-size:11px;">${lot.dailyGLPcnt >= 0 ? '+' : ''}${lot.dailyGLPcnt.toFixed(2)}%</div>
                    </div>
                    <div class="bull-col-total ${lotTotalClass}">
                        <div>${lot.totalGL >= 0 ? '+' : ''}${lot.totalGL.toFixed(2)}</div>
                        <div style="font-size:11px;">${lot.totalGLPcnt >= 0 ? '+' : ''}${lot.totalGLPcnt.toFixed(2)}%</div>
                    </div>
                </div>
            `;
        }
        
        finalHtml += `</div></div>`;
        
        // Update Grand Totals
        grandTotalCost += totalCost;
        grandTotalCurrentValue += currentValue;
        grandTotalDailyGL += totalStockDailyGL;
        grandTotalGL += totalGL;
    }
    
    listContainer.innerHTML = finalHtml;
    
// Update Summary Cards with Percentages
const totalValueCard = document.getElementById('summary-total-value');
const totalCostCard = document.getElementById('summary-total-cost');
const totalDailyCard = document.getElementById('summary-total-daily');
const totalDailyPctCard = document.getElementById('summary-total-daily-pct');  // 👈 নতুন
const totalGLCard = document.getElementById('summary-total-gl');
const totalGLPctCard = document.getElementById('summary-total-gl-pct');  // 👈 নতুন

if (totalValueCard) {
    totalValueCard.innerHTML = `৳${grandTotalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
}
if (totalCostCard) {
    totalCostCard.innerHTML = `৳${grandTotalCost.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
}

// 📊 Daily P/L - টাকা দেখানো
if (totalDailyCard) {
    const formatted = grandTotalDailyGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 });
    totalDailyCard.innerHTML = `${grandTotalDailyGL >= 0 ? '+' : ''}৳${formatted}`;
    totalDailyCard.style.color = grandTotalDailyGL >= 0 ? '#90ffb0' : '#ffaaaa';
}

// 📊 Daily P/L - শতকরা (%) দেখানো (নতুন)
if (totalDailyPctCard && grandTotalCost > 0) {
    const dailyPercent = (grandTotalDailyGL / grandTotalCost) * 100;
    totalDailyPctCard.innerHTML = `${dailyPercent >= 0 ? '+' : ''}${dailyPercent.toFixed(2)}%`;
    totalDailyPctCard.style.color = dailyPercent >= 0 ? '#90ffb0' : '#ffaaaa';
} else if (totalDailyPctCard) {
    totalDailyPctCard.innerHTML = '(0.00%)';
}

// 🎯 Total P/L - টাকা দেখানো
if (totalGLCard) {
    const formatted = grandTotalGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 });
    totalGLCard.innerHTML = `${grandTotalGL >= 0 ? '+' : ''}৳${formatted}`;
    totalGLCard.style.color = grandTotalGL >= 0 ? '#90ffb0' : '#ffaaaa';
}

// 🎯 Total P/L - শতকরা (%) দেখানো (নতুন)
if (totalGLPctCard && grandTotalCost > 0) {
    const totalPercent = (grandTotalGL / grandTotalCost) * 100;
    totalGLPctCard.innerHTML = `${totalPercent >= 0 ? '+' : ''}${totalPercent.toFixed(2)}%`;
    totalGLPctCard.style.color = totalPercent >= 0 ? '#90ffb0' : '#ffaaaa';
} else if (totalGLPctCard) {
    totalGLPctCard.innerHTML = '(0.00%)';
}
    updateDashboardCardsFromAnalysis(grandTotalCost, grandTotalCurrentValue, grandTotalDailyGL, grandTotalGL);
    // Update existing footer (যদি থাকে)
    const existingFooter = document.querySelector('.bull-footer');
    if (existingFooter) {
        existingFooter.style.display = 'none';
    }
}
// ==========================================
// 🚀 পোর্টফোলিও অ্যানালাইসিস টেবিল - Firebase → Live API → 0
// ==========================================

async function loadPortfolioAnalysisTable(userId) {
    if (!userId) {
        console.log('No userId provided');
        return;
    }
    
    // 🔥 স্টেপ 1: Firebase থেকে প্রাইস লোড করার চেষ্টা
    if (!currentPriceData || currentPriceData.size === 0) {
        console.log('📦 Step 1: Loading from Firebase...');
        currentPriceData = await firebaseDataManager.loadLatestPrices();
        
        if (!currentPriceData || currentPriceData.size === 0) {
            console.log('⚠️ No Firebase data found');
        } else {
            console.log(`✅ Loaded ${currentPriceData.size} stocks from Firebase`);
        }
    }
    
    if (!db) return;

    db.collection("portfolios").where("userId", "==", userId)
    .onSnapshot((portfolioSnapshot) => {
        db.collection("sales_history").where("userId", "==", userId)
        .onSnapshot(async (salesSnapshot) => {
            
            let rawPortfolio = {};
            let totalSoldQtyMap = {};
            
            salesSnapshot.forEach(doc => {
                const data = doc.data();
                totalSoldQtyMap[data.shareName] = (totalSoldQtyMap[data.shareName] || 0) + data.quantitySold;
            });

            portfolioSnapshot.forEach(doc => {
                const data = doc.data();
                const ticker = data.shareName;
                if (!ticker) return;
                
                if (!rawPortfolio[ticker]) {
                    rawPortfolio[ticker] = [];
                }
                
                rawPortfolio[ticker].push({
                    date: data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date(),
                    originalQty: Number(data.quantity || 0),
                    buyPrice: Number(data.buyPrice || 0)
                });
            });

            const portfolioDataForSorting = [];
            
            // ইউনিক টিকার লিস্ট বের করা
            const uniqueTickers = Object.keys(rawPortfolio);
            
            // 🔥 স্টেপ 2: যেসব টিকারের Firebase এ প্রাইস নেই, তাদের জন্য Live API কল
            const missingTickers = uniqueTickers.filter(ticker => !currentPriceData.has(ticker));
            
            if (missingTickers.length > 0) {
                console.log(`📡 Step 2: Fetching ${missingTickers.length} missing tickers from Live API...`);
                
                // ব্যাচ আকারে API কল (রেট লিমিট এড়াতে)
                const batchSize = 3;
                for (let i = 0; i < missingTickers.length; i += batchSize) {
                    const batch = missingTickers.slice(i, i + batchSize);
                    await Promise.all(batch.map(async (ticker) => {
                        try {
                            const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
                            if (response.ok) {
                                const data = await response.json();
                                if (data && data.ltp) {
                                    currentPriceData.set(ticker, data.ltp);
                                    console.log(`✅ Live API: ${ticker} = ${data.ltp}`);
                                } else {
                                    // 🔥 স্টেপ 3: Live API তাও না পেলে 0 সেট করুন
                                    currentPriceData.set(ticker, 0);
                                    console.log(`⚠️ Live API: No price for ${ticker}, setting to 0`);
                                }
                            } else {
                                currentPriceData.set(ticker, 0);
                                console.log(`⚠️ Live API failed for ${ticker}, setting to 0`);
                            }
                        } catch (err) {
                            currentPriceData.set(ticker, 0);
                            console.log(`❌ Live API error for ${ticker}, setting to 0`);
                        }
                    }));
                    
                    // রেট লিমিট এড়াতে সামান্য দেরি
                    if (i + batchSize < missingTickers.length) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
            }

            for (let ticker in rawPortfolio) {
                let lots = rawPortfolio[ticker].sort((a, b) => a.date - b.date);
                let totalSold = totalSoldQtyMap[ticker] || 0;

                // 🔥 প্রাইস নেওয়া: Firebase → Live API → 0 (ইতিমধ্যে সেট করা আছে)
                let currentPrice = currentPriceData.get(ticker) || 0;
                let dailyChange = 0;
                let dailyChangePcnt = 0;
                let priceSource = 'Unknown';
                
                if (currentPrice > 0) {
                    // প্রাইস পেয়েছে, গতকালের প্রাইস বের করুন
                    const previousClose = await firebaseDataManager.getPreviousClose(ticker);
                    if (previousClose && previousClose > 0) {
                        dailyChange = currentPrice - previousClose;
                        dailyChangePcnt = (dailyChange / previousClose) * 100;
                    }
                    priceSource = currentPriceData.has(ticker) && currentPriceData.get(ticker) > 0 ? 
                        (currentPriceData.get(ticker) === currentPrice ? 'Firebase/Live' : 'Unknown') : 'Live API';
                } else {
                    // 🔥 স্টেপ 3 শেষ: 0 পেয়েছে
                    priceSource = 'No Data (0)';
                    console.log(`⚠️ ${ticker}: No price found anywhere, using 0`);
                }

                let activeLotsForDisplay = [];
                let totalRemainingQty = 0;
                let totalCost = 0;
                let remainingSold = totalSold;

                lots.forEach(lot => {
                    let remQtyInLot = lot.originalQty;
                    if (remainingSold > 0) {
                        let taken = Math.min(remQtyInLot, remainingSold);
                        remQtyInLot -= taken;
                        remainingSold -= taken;
                    }

                    if (remQtyInLot > 0) {
                        totalRemainingQty += remQtyInLot;
                        const costWithCommission = (remQtyInLot * lot.buyPrice) + (lot.commission || 0);
                        totalCost += costWithCommission;
                        
                        let lotCurrentValue = remQtyInLot * currentPrice;
                        let lotTotalGL = lotCurrentValue - (remQtyInLot * lot.buyPrice);
                        let lotDailyGL = remQtyInLot * dailyChange;
                        let lotGLPcnt = lot.buyPrice > 0 ? ((currentPrice - lot.buyPrice) / lot.buyPrice) * 100 : 0;
                        let lotDailyPcnt = (currentPrice - dailyChange) > 0 ? (dailyChange / (currentPrice - dailyChange)) * 100 : 0;

                        activeLotsForDisplay.push({
                            qty: remQtyInLot,
                            buyPrice: lot.buyPrice,
                            cost: remQtyInLot * lot.buyPrice,
                            currentValue: lotCurrentValue,
                            dailyGL: lotDailyGL,
                            dailyGLPcnt: lotDailyPcnt,
                            totalGL: lotTotalGL,
                            totalGLPcnt: lotGLPcnt
                        });
                    }
                });

                if (totalRemainingQty === 0) continue;

                let avgBuyPrice = totalCost / totalRemainingQty;
                let totalGL = (totalRemainingQty * currentPrice) - totalCost;
                let totalGLPcnt = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
                let totalStockDailyGL = totalRemainingQty * dailyChange;
                let totalStockDailyPcnt = (currentPrice - dailyChange) > 0 ? (dailyChange / (currentPrice - dailyChange)) * 100 : 0;

                const livePriceClass = dailyChange >= 0 ? "bull-profit" : "bull-loss";
                const dailyGlClass = totalStockDailyGL >= 0 ? "bull-profit" : "bull-loss";
                const totalGlClass = totalGL >= 0 ? "bull-profit" : "bull-loss";
                const blockId = `block-${ticker.replace(/[^a-zA-Z0-9]/g, '')}`;

                portfolioDataForSorting.push({
                    ticker: ticker,
                    avgBuyPrice: avgBuyPrice,
                    totalRemainingQty: totalRemainingQty,
                    totalCost: totalCost,
                    currentPrice: currentPrice,
                    dailyChange: dailyChange,
                    dailyChangePcnt: dailyChangePcnt,
                    totalGL: totalGL,
                    totalGLPcnt: totalGLPcnt,
                    totalStockDailyGL: totalStockDailyGL,
                    totalStockDailyPcnt: totalStockDailyPcnt,
                    activeLotsForDisplay: activeLotsForDisplay,
                    livePriceClass: livePriceClass,
                    dailyGlClass: dailyGlClass,
                    totalGlClass: totalGlClass,
                    blockId: blockId,
                    priceSource: priceSource
                });
            }
            
            storePortfolioDataForSorting(portfolioDataForSorting);
            
            const sortedData = [...portfolioDataForSorting].sort((a, b) => 
                a.ticker.toUpperCase().localeCompare(b.ticker.toUpperCase())
            );
            
            renderPortfolioAnalysis(sortedData);
            
            currentPortfolioSortOrder = 'asc';
            const sortBtn = document.getElementById('sort-portfolio-btn');
            if (sortBtn) sortBtn.innerHTML = '🔤 Sort A to Z';
        });
    });
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
// portfolio-analysis ট্যাব থেকে মডাল ওপেন করার ফাংশন
// ==========================================
// ==========================================
// 🚀 অ্যাডভান্সড স্টক ডিটেইল মডাল
// ==========================================

let advChartInstance = null;

window.openStockDetailModal = async function(ticker) {
    const modal = document.getElementById('advanced-stock-modal');
    if (!modal) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    modal.style.display = 'flex';
    document.getElementById('adv-modal-ticker').innerText = ticker;
    
    // লোডিং স্টেট
    document.getElementById('adv-ltp').innerHTML = '<span class="loading" style="width:16px;height:16px;"></span>';
    document.getElementById('adv-holdings-qty').innerHTML = '<span class="loading" style="width:16px;height:16px;"></span>';
    
    try {
        // 1️⃣ পোর্টফোলিও থেকে হোল্ডিংস তথ্য আনা
        const portfolioSnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        
        const salesSnapshot = await db.collection('sales_history')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        
        // মোট সেল কোয়ান্টিটি বের করা
        let totalSold = 0;
        salesSnapshot.forEach(doc => {
            totalSold += doc.data().quantitySold;
        });
        
        // FIFO পদ্ধতিতে বাকি শেয়ার ও এভারেজ প্রাইস ক্যালকুলেশন
        let buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            buyLots.push({
    qty: data.quantity,
    buyPrice: data.buyPrice,
    commission: data.commission || 0,  // ← এই লাইন যোগ করুন
    date: data.date ? new Date(data.date) : new Date()
});
        });
        
        buyLots.sort((a, b) => a.date - b.date);
        
        let remainingQty = 0;
        let totalCost = 0;
        let soldRemaining = totalSold;
        
        for (const lot of buyLots) {
            let lotRemaining = lot.qty;
            if (soldRemaining > 0 && lotRemaining > 0) {
                const taken = Math.min(lotRemaining, soldRemaining);
                lotRemaining -= taken;
                soldRemaining -= taken;
            }
            if (lotRemaining > 0) {
                remainingQty += lotRemaining;
                totalCost += lotRemaining * lot.buyPrice;
            }
        }
        
        const avgBuyPrice = remainingQty > 0 ? totalCost / remainingQty : 0;
        
        // 2️⃣ বর্তমান প্রাইস ও গতকালের প্রাইস আনা
        let currentPrice = 0;
        let previousClose = 0;
        let priceSource = 'Firebase';
        
        // প্রাইস ম্যাপ থেকে নেওয়ার চেষ্টা
        if (currentPriceData && currentPriceData.has(ticker)) {
            currentPrice = currentPriceData.get(ticker);
        }
        
        // না থাকলে API বা Firebase থেকে আনা
        if (currentPrice === 0) {
            const stockData = await fetchStockWithDailyChange(ticker);
            currentPrice = stockData.currentPrice;
            previousClose = stockData.previousClose || 0;
            priceSource = 'Live API';
        } else {
            // গতকালের প্রাইস বের করা
            previousClose = await firebaseDataManager.getPreviousClose(ticker);
        }
        
        const dailyChange = currentPrice - previousClose;
        const dailyChangePercent = previousClose > 0 ? (dailyChange / previousClose) * 100 : 0;
        
        // 3️⃣ গেইন/লস ক্যালকুলেশন
        const totalGain = remainingQty > 0 ? (currentPrice - avgBuyPrice) * remainingQty : 0;
        const totalGainPercent = avgBuyPrice > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;
        
        // 4️⃣ UI আপডেট
        // LTP Card
        document.getElementById('adv-ltp').innerText = `৳${currentPrice.toFixed(2)}`;
        const changeSpan = document.getElementById('adv-change');
        changeSpan.innerHTML = `Change: ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)} (${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%)`;
        changeSpan.style.color = dailyChange >= 0 ? '#10b981' : '#ef4444';
        
        // Previous Close Card
        document.getElementById('adv-prev-close').innerText = `৳${previousClose.toFixed(2)}`;
        if (previousClose) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            document.getElementById('adv-prev-date').innerHTML = `as on ${yesterday.toLocaleDateString()}`;
        } else {
            document.getElementById('adv-prev-date').innerHTML = 'No historical data';
        }
        
        // Holdings Card
        document.getElementById('adv-holdings-qty').innerText = remainingQty;
        document.getElementById('adv-avg-buy').innerText = avgBuyPrice.toFixed(2);
        
        // Gain/Loss Card
        const gainElem = document.getElementById('adv-gain-amount');
        const gainPercentElem = document.getElementById('adv-gain-percent');
        const gainCard = document.getElementById('adv-gain-card');
        
        gainElem.innerText = `${totalGain >= 0 ? '+' : ''}৳${totalGain.toFixed(2)}`;
        gainPercentElem.innerText = `${totalGainPercent >= 0 ? '+' : ''}${totalGainPercent.toFixed(2)}%`;
        
        if (totalGain >= 0) {
            gainCard.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else {
            gainCard.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }
        
        // Data Source
        document.getElementById('adv-data-source').innerText = priceSource;
        document.getElementById('adv-updated-time').innerText = new Date().toLocaleString();
        // 6️⃣ মডালের জন্য পারফরম্যান্স টেবিল লোড করা (কার্ডের পরে, চার্টের আগে)
await loadModalPerformanceTable(ticker);
        // 5️⃣ প্রাইস হিস্ট্রি চার্ট লোড করা
        await loadPriceHistoryChart(ticker);
        
    } catch (error) {
        console.error('Error loading stock details:', error);
        document.getElementById('adv-ltp').innerText = 'Error';
        document.getElementById('adv-holdings-qty').innerText = 'Error';
    }
};

// ==========================================
// 📊 মডাল পারফরম্যান্স টেবিল লোড ফাংশন
// ==========================================

async function loadModalPerformanceTable(ticker) {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // 1️⃣ বর্তমান প্রাইস
        let currentPrice = 0;
        if (currentPriceData && currentPriceData.has(ticker)) {
            currentPrice = currentPriceData.get(ticker);
        } else {
            const latestPrice = await firebaseDataManager.getLatestPrice(ticker);
            currentPrice = latestPrice || 0;
        }
        
        if (currentPrice === 0) {
            console.log('No current price found for', ticker);
            return;
        }
        
        // 2️⃣ ইউজারের Avg Buy Price বের করা (FIFO পদ্ধতিতে)
        let avgBuyPrice = 0;
        let totalRemainingQty = 0;
        let totalCost = 0;
        
        // পোর্টফোলিও থেকে লট আনা
        const portfolioSnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        
        const salesSnapshot = await db.collection('sales_history')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        
        // মোট বিক্রি পরিমাণ বের করা
        let totalSold = 0;
        salesSnapshot.forEach(doc => {
            totalSold += doc.data().quantitySold;
        });
        
        // FIFO পদ্ধতিতে buyLots তৈরি
        let buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            const totalCostWithCommission = (data.quantity * data.buyPrice) + (data.commission || 0);
            buyLots.push({
                qty: data.quantity,
                buyPrice: data.buyPrice,
                totalCostWithCommission: totalCostWithCommission,
                date: data.date ? new Date(data.date) : new Date()
            });
        });
        
        buyLots.sort((a, b) => a.date - b.date);
        
        let remainingSold = totalSold;
        for (const lot of buyLots) {
            let lotRemaining = lot.qty;
            if (remainingSold > 0 && lotRemaining > 0) {
                const taken = Math.min(lotRemaining, remainingSold);
                lotRemaining -= taken;
                remainingSold -= taken;
            }
            if (lotRemaining > 0) {
                totalRemainingQty += lotRemaining;
                totalCost += (lotRemaining * (lot.totalCostWithCommission / lot.qty));
            }
        }
        
        avgBuyPrice = totalRemainingQty > 0 ? totalCost / totalRemainingQty : 0;
        
        if (avgBuyPrice === 0) {
            console.log('No holdings found for', ticker);
            return;
        }
        
        // 3️⃣ বিভিন্ন সময়ের প্রাইস ক্যালকুলেশন (stock_history থেকে)
        const periods = [
            { name: 'today', days: 0, label: 'Today vs Avg Buy' },
            { name: '5d', days: 5, label: '5 Days vs Avg Buy' },
            { name: '15d', days: 15, label: '15 Days vs Avg Buy' },
            { name: '30d', days: 30, label: '30 Days vs Avg Buy' },
            { name: '3m', days: 90, label: '3 Months vs Avg Buy' },
            { name: '6m', days: 180, label: '6 Months vs Avg Buy' },
            { name: '1y', days: 365, label: '1 Year vs Avg Buy' }
        ];
        
        const returns = {};
        
        for (const period of periods) {
            if (period.days === 0) {
                // Today: বর্তমান প্রাইস vs Avg Buy Price
                const periodReturn = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
                returns[period.name] = periodReturn;
                continue;
            }
            
            // নির্দিষ্ট দিন আগের তারিখ
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - period.days);
            const targetDateStr = targetDate.toISOString().split('T')[0];
            
            // ঐ তারিখের প্রাইস (stock_history থেকে)
            const pastPrice = await firebaseDataManager.getPriceByDate(ticker, targetDateStr);
            
            if (pastPrice && pastPrice > 0) {
                // ঐ তারিখের প্রাইস vs Avg Buy Price
                const periodReturn = ((pastPrice - avgBuyPrice) / avgBuyPrice) * 100;
                returns[period.name] = periodReturn;
            } else {
                returns[period.name] = null;
            }
        }
        
        // 🔥 বর্তমান প্রাইস vs Avg Buy (এক্সট্রা কার্ডের জন্য)
        const currentReturnVsAvg = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
        
        // 4️⃣ UI আপডেট ফাংশন
        const updateCell = (id, value) => {
            const elem = document.getElementById(id);
            if (elem) {
                if (value === null || value === undefined) {
                    elem.innerHTML = '-';
                    elem.style.color = '#64748b';
                } else {
                    const isPositive = value >= 0;
                    elem.innerHTML = `${isPositive ? '+' : ''}${value.toFixed(2)}%`;
                    elem.style.color = isPositive ? '#10b981' : '#ef4444';
                    elem.style.fontWeight = 'bold';
                }
            }
        };
        
        // 5️⃣ টেবিল আপডেট
        updateCell('modal-perf-today', returns.today);
        updateCell('modal-perf-5d', returns['5d']);
        updateCell('modal-perf-15d', returns['15d']);
        updateCell('modal-perf-30d', returns['30d']);
        updateCell('modal-perf-3m', returns['3m']);
        updateCell('modal-perf-6m', returns['6m']);
        updateCell('modal-perf-1y', returns['1y']);
        
        // 6️⃣ Avg Buy Info আপডেট (ঐচ্ছিক - যদি কোনো এলিমেন্ট থাকে)
        const avgBuyInfoElem = document.getElementById('modal-avg-buy-info');
        if (avgBuyInfoElem) {
            avgBuyInfoElem.innerHTML = `Avg Buy: ৳${avgBuyPrice.toFixed(2)} | Current: ৳${currentPrice.toFixed(2)} | Return: ${currentReturnVsAvg >= 0 ? '+' : ''}${currentReturnVsAvg.toFixed(2)}%`;
            avgBuyInfoElem.style.color = currentReturnVsAvg >= 0 ? '#10b981' : '#ef4444';
        }
        
        console.log(`✅ Modal performance table loaded for ${ticker} | Avg Buy: ৳${avgBuyPrice.toFixed(2)} | Current: ৳${currentPrice.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error loading modal performance:', error);
    }
}
// ==========================================

async function loadPriceHistoryChart(ticker) {
    const canvas = document.getElementById('adv-stock-chart');
    if (!canvas) return;
    
    if (advChartInstance) {
        advChartInstance.destroy();
    }
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // 1️⃣ গত ৩০ দিনের প্রাইস ডাটা আনার চেষ্টা
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const prices = [];
        const labels = [];
        
        // 🔥 stock_history থেকে ডাটা আনা
        let hasData = false;
        for (let i = 0; i <= 30; i++) {
            const checkDate = new Date(startDate);
            checkDate.setDate(startDate.getDate() + i);
            const dateStr = checkDate.toISOString().split('T')[0];
            
            const price = await firebaseDataManager.getPriceByDate(ticker, dateStr);
            if (price !== null) {
                prices.push(price);
                labels.push(dateStr.substring(5));
                hasData = true;
            } else if (prices.length > 0) {
                // আগের প্রাইস রাখুন
                prices.push(prices[prices.length - 1]);
                labels.push(dateStr.substring(5));
            }
        }
        
        // 🔥 যদি stock_history এ কোন ডাটা না থাকে, তাহলে শুধু Avg Buy Line দেখান
        if (!hasData) {
            console.log(`⚠️ No historical price data for ${ticker}, showing only avg buy line`);
        }
        
        // 2️⃣ ইউজারের এভারেজ বাই প্রাইস বের করা
        let avgBuyPrice = 0;
        let totalRemainingQty = 0;
        let totalCost = 0;
        
        const portfolioSnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        
        const salesSnapshot = await db.collection('sales_history')
            .where('userId', '==', user.uid)
            .where('shareName', '==', ticker)
            .get();
        
        let totalSold = 0;
        salesSnapshot.forEach(doc => {
            totalSold += doc.data().quantitySold;
        });
        
        let buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            const totalCostWithCommission = (data.quantity * data.buyPrice) + (data.commission || 0);
            buyLots.push({
                qty: data.quantity,
                buyPrice: data.buyPrice,
                totalCostWithCommission: totalCostWithCommission,
                date: data.date ? new Date(data.date) : new Date()
            });
        });
        
        buyLots.sort((a, b) => a.date - b.date);
        
        let remainingSold = totalSold;
        for (const lot of buyLots) {
            let lotRemaining = lot.qty;
            if (remainingSold > 0 && lotRemaining > 0) {
                const taken = Math.min(lotRemaining, remainingSold);
                lotRemaining -= taken;
                remainingSold -= taken;
            }
            if (lotRemaining > 0) {
                totalRemainingQty += lotRemaining;
                totalCost += (lotRemaining * (lot.totalCostWithCommission / lot.qty));
            }
        }
        
        avgBuyPrice = totalRemainingQty > 0 ? totalCost / totalRemainingQty : 0;
        
        // এভারেজ বাই প্রাইস লাইন তৈরি
        const avgBuyLine = new Array(prices.length).fill(avgBuyPrice);
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';
        
        // 🔥 চার্ট তৈরি
        advChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `${ticker} Price (Historical)`,
                        data: prices,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: isDark ? '#1e293b' : '#ffffff'
                    },
                    {
                        label: `Your Avg Buy (${avgBuyPrice > 0 ? '৳' + avgBuyPrice.toFixed(2) : 'N/A'})`,
                        data: avgBuyLine,
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [8, 6],
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            usePointStyle: true,
                            boxWidth: 10,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                let value = context.raw;
                                if (label.includes('Price')) {
                                    return `${label}: ৳${value.toFixed(2)}`;
                                } else if (label.includes('Avg Buy')) {
                                    return `${label}`;
                                }
                                return `${label}: ৳${value.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: textColor, 
                            maxRotation: 45,
                            font: { size: 9 }
                        },
                        grid: { color: gridColor },
                        title: {
                            display: true,
                            text: 'Date',
                            color: textColor,
                            font: { size: 10 }
                        }
                    },
                    y: {
                        ticks: { 
                            color: textColor,
                            font: { size: 9 },
                            callback: function(value) {
                                return '৳' + value.toFixed(0);
                            }
                        },
                        grid: { color: gridColor },
                        title: {
                            display: true,
                            text: 'Price (৳)',
                            color: textColor,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
        
        updateChartAvgBuyInfo(ticker, avgBuyPrice, totalRemainingQty);
        
    } catch (error) {
        console.error('Chart loading error:', error);
    }
}

// এভারেজ বাই ইনফো দেখানোর ফাংশন
function updateChartAvgBuyInfo(ticker, avgBuyPrice, remainingQty) {
    // চার্টের নিচে ইনফো দেখানোর জন্য ডিভি তৈরি করুন
    let infoDiv = document.getElementById('chart-avgbuy-info');
    const chartContainer = document.getElementById('adv-stock-chart')?.parentElement;
    
    if (!chartContainer) return;
    
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.id = 'chart-avgbuy-info';
        infoDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 12px;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border-radius: 8px;
            font-size: 12px;
        `;
        chartContainer.parentNode.insertBefore(infoDiv, chartContainer.nextSibling);
    }
    
    if (avgBuyPrice > 0) {
        infoDiv.innerHTML = `
            <span>📊 <strong>${ticker}</strong></span>
            <span>💰 Avg Buy Price: <strong style="color: #f59e0b;">৳${avgBuyPrice.toFixed(2)}</strong></span>
            <span>📦 Remaining: ${remainingQty} shares</span>
            <span style="font-size: 10px; color: var(--text-muted);">⚡ Dotted line = Your average buy price</span>
        `;
        infoDiv.style.display = 'flex';
    } else {
        infoDiv.style.display = 'none';
    }
}

// ==========================================
// ❌ মডাল বন্ধ ফাংশন
// ==========================================

window.closeAdvancedModal = function() {
    const modal = document.getElementById('advanced-stock-modal');
    if (modal) modal.style.display = 'none';
    if (advChartInstance) {
        advChartInstance.destroy();
        advChartInstance = null;
    }
};

// মডালের বাইরে ক্লিক করলেও বন্ধ হবে
window.onclick = function(event) {
    const modal = document.getElementById('advanced-stock-modal');
    if (event.target === modal) {
        closeAdvancedModal();
    }
};
// ==========================================
// ১৭. মডাল ওপেন এবং ডিটেইল ডাটা রেন্ডারিং লজিক
// ==========================================
// ==========================================
// ১৭. মডাল ওপেন এবং ডিটেইল ডাটা রেন্ডারিং লজিক
// ==========================================
// ==========================================
// ১৭. মডাল ওপেন এবং ডিটেইল ডাটা রেন্ডারিং লজিক
// ==========================================
window.viewStockDetail = async function(ticker) {
    const modal = document.getElementById('stock-detail-modal');
    if (!modal) return;

    modal.style.display = 'block';
    document.getElementById('modal-stock-title').innerText = ticker;
    
    const editForm = document.getElementById('stock-modal-edit-form');
    if (editForm) editForm.style.display = 'none';

    const txListContainer = document.getElementById('stock-modal-transaction-list');
    if (txListContainer) {
        txListContainer.innerHTML = "<p style='text-align:center; color:#64748b;'>লোডিং ট্রানজেকশন হিস্ট্রি...</p>";
    }

    const user = auth.currentUser;
    if (!user) {
        if (txListContainer) txListContainer.innerHTML = "<p style='color:red;'>দয়া করে লগইন করুন।</p>";
        return;
    }

    try {
        const [buySnapshot, sellSnapshot] = await Promise.all([
            db.collection("portfolios").where("userId", "==", user.uid).where("shareName", "==", ticker).get(),
            db.collection("sales_history").where("userId", "==", user.uid).where("shareName", "==", ticker).get()
        ]);

        if (txListContainer) {
            txListContainer.innerHTML = "";

            buySnapshot.forEach(doc => {
                const data = doc.data();
                const dateStr = data.date ? new Date(data.date).toLocaleDateString() : 'N/A';
                const div = document.createElement('div');
                div.className = "modal-tr-item buy-item";
                div.innerHTML = `
                    <span>[BUY] ${dateStr} - Qty: ${data.quantity}, Price: ৳${data.buyPrice.toFixed(2)}</span>
                    <div class="modal-action-btns">
                        <button class="btn-modal-edit" onclick="openEditForm('${doc.id}', 'buy', ${data.quantity}, ${data.buyPrice})">✏️</button>
                        <button class="btn-modal-delete" onclick="deleteTransactionRecord('${doc.id}', 'portfolios', '${ticker}')" style="background:none; border:none; cursor:pointer; margin-left:8px; font-size:14px;" title="ডিলিট করুন">🗑️</button>
                    </div>
                `;
                txListContainer.appendChild(div);
            });

            sellSnapshot.forEach(doc => {
                const data = doc.data();
                const rawDate = data.date ? (data.date.toDate ? data.date.toDate() : data.date) : null;
                const dateStr = rawDate ? new Date(rawDate).toLocaleDateString() : 'N/A';
                
                const div = document.createElement('div');
                div.className = "modal-tr-item sell-item";
                div.innerHTML = `
                    <span>[SELL] ${dateStr} - Qty: ${data.quantitySold}, Price: ৳${data.sellPrice.toFixed(2)}</span>
                    <div class="modal-action-btns">
                        <button class="btn-modal-edit" onclick="openEditForm('${doc.id}', 'sell', ${data.quantitySold}, ${data.sellPrice})">✏️</button>
                        <button class="btn-modal-delete" onclick="deleteTransactionRecord('${doc.id}', 'sales_history', '${ticker}')" style="background:none; border:none; cursor:pointer; margin-left:8px; font-size:14px;" title="ডিলিট করুন">🗑️</button>
                    </div>
                `;
                txListContainer.appendChild(div);
            });

            if (buySnapshot.empty && sellSnapshot.empty) {
                txListContainer.innerHTML = "<p style='text-align:center; color:#94a3b8;'>কোনো ট্রানজেকশন রেকর্ড পাওয়া যায়নি।</p>";
            }
        }
    } catch (error) {
        console.error("মডাল ডাটা লোড করতে সমস্যা:", error);
        if (txListContainer) txListContainer.innerHTML = "<p style='color:red; text-align:center;'>ডাটা লোড করা যায়নি।</p>";
    }
};
// ==========================================
// মডালে এডিট ফর্ম দেখানোর ফাংশন
// ==========================================
window.openEditForm = function(id, type, qty, price) {
    const editForm = document.getElementById('modal-edit-form');
    if (editForm) editForm.style.display = 'block';
    
    document.getElementById('edit-form-title').innerText = `Editing ${type.toUpperCase()} Entry`;
    document.getElementById('edit-doc-id').value = id;
    document.getElementById('edit-doc-type').value = type;
    document.getElementById('edit-input-qty').value = qty;
    document.getElementById('edit-input-price').value = price;
};
// ==========================================
// মডালে এডিট সেভ করার ফাংশন
// ==========================================
window.saveModalEditedRecord = async function() {
    const id = document.getElementById('edit-doc-id').value;
    const type = document.getElementById('edit-doc-type').value;
    const qty = Number(document.getElementById('edit-input-qty').value);
    const price = Number(document.getElementById('edit-input-price').value);
    const ticker = document.getElementById('modal-stock-title').innerText;

    if (!qty || qty <= 0 || !price || price <= 0) {
        return alert("দয়া করে সঠিক সংখ্যা এবং দর দিন।");
    }

    try {
        if (type === 'buy') {
            await db.collection("portfolios").doc(id).update({
                quantity: qty,
                buyPrice: price
            });
        } else if (type === 'sell') {
            const docSnap = await db.collection("sales_history").doc(id).get();
            const originalBuyPrice = docSnap.data().buyPrice || 0;
            await db.collection("sales_history").doc(id).update({
                quantitySold: qty,
                sellPrice: price,
                profitOrLoss: (price - originalBuyPrice) * qty
            });
        }

        alert("রেকর্ডটি সফলভাবে ইডিট করা হয়েছে!");
        document.getElementById('stock-detail-modal').style.display = 'none';
        
        if (auth.currentUser) {
            loadUnifiedStockTable(auth.currentUser.uid);
            if (typeof generateAnalysisStatement === 'function') {
                generateAnalysisStatement(ticker);
            }
        }
    } catch (error) {
        console.error("Error updating record: ", error);
        alert("ইডিট আপডেট করা যায়নি।");
    }
};
// নতুন গ্লোবাল ফাংশন: ট্রানজেকশন রেকর্ড ডিলিট করার লজিক
window.deleteTransactionRecord = async function(docId, collectionName, ticker) {
    const confirmDelete = confirm("আপনি কি নিশ্চিত যে এই রেকর্ডটি স্থায়ীভাবে ডিলিট করতে চান?");
    if (!confirmDelete) return;

    try {
        await db.collection(collectionName).doc(docId).delete();
        alert("রেকর্ডটি সফলভাবে ডিলিট করা হয়েছে။");
        viewStockDetail(ticker);
        if (auth.currentUser) {
            loadUnifiedStockTable(auth.currentUser.uid);
        }
    } catch (error) {
        console.error("রেকর্ড মুছে ফেলতে ত্রুটি:", error);
        alert("দুঃখিত, রেকর্ডটি ডিলিট করা সম্ভব হয়নি। আবার চেষ্টা করুন।");
    }
};

// ==========================================
// ১৮. মডাল বন্ধের গ্লোবাল লিসেনার
// ==========================================
setTimeout(() => {
    const modal = document.getElementById('stock-detail-modal');
    const closeBtn = document.getElementById('close-stock-modal');
    if (modal) modal.style.display = 'none'; 
    if (closeBtn && modal) {
        closeBtn.onclick = function() {
            modal.style.display = 'none';
        };
        window.addEventListener('click', function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });
    }
}, 1000);

// ==========================================
// ১৯. ডাটা ডাউনলোড এবং আপলোড (Backup & Restore) - ক্রাশ-ফ্রি ফাইনাল ফিক্স
// ==========================================

// ১. বাটনে ক্লিক করলে মেমোরি ফ্রি রেখে কনফার্মেশন দেখানোর মেইন ফাংশন
window.downloadPortfolioData = async function() {
    // 🔥 ফিক্স: প্রথমে ইউজার চেক করুন
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
        alert("অনুগ্রহ করে প্রথমে লগইন করুন।");
        return;
    }
    
    // শুরুতেই কনফার্মেশন
    const confirmDownload = confirm("আপনি কি আপনার পোর্টফোলিও ডাটা ব্যাকআপ ডাউনলোড করতে চান?");
    if (!confirmDownload) return;
    
    // লোডিং ইন্ডিকেটর দেখান (ঐচ্ছিক)
    const loadingMsg = alert("ডাটা সংগ্রহ করা হচ্ছে, দয়া করে অপেক্ষা করুন...");
    
    try {
        await executeSecureDownload(currentUser.uid);
    } catch (error) {
        console.error("ডাউনলোড এরর:", error);
        alert("ডাটা ডাউনলোড করতে সমস্যা হয়েছে: " + error.message);
    }
};

// ব্যাকগ্রাউন্ডে ডাটা প্রসেস এবং ডাউনলোডের আসল লজিক (ক্রাশ-প্রুফ)
async function executeSecureDownload(currentUid) {
    // 🔥 ফিক্স: currentUid চেক
    if (!currentUid) {
        throw new Error("User ID not found");
    }
    
    try {
        // ফায়ারস্টোর থেকে ডাটা আনা হচ্ছে
        const portfoliosRef = db.collection('portfolios');
        const salesRef = db.collection('sales_history');
        
        const [buySnapshot, sellSnapshot] = await Promise.all([
            portfoliosRef.where('userId', '==', currentUid).get(),
            salesRef.where('userId', '==', currentUid).get()
        ]);

        const buyData = [];
        buySnapshot.forEach(doc => {
            const data = doc.data();
            
            // 🔥 সুরক্ষিত কনভার্শন - সব ধরনের Timestamp হ্যান্ডল করবে
            let formattedDate = null;
            if (data.date) {
                try {
                    if (typeof data.date.toDate === 'function') {
                        formattedDate = data.date.toDate().toISOString();
                    } else if (data.date instanceof Date) {
                        formattedDate = data.date.toISOString();
                    } else if (typeof data.date === 'object' && data.date.seconds) {
                        formattedDate = new Date(data.date.seconds * 1000).toISOString();
                    } else if (typeof data.date === 'string') {
                        formattedDate = data.date;
                    } else {
                        formattedDate = new Date().toISOString();
                    }
                } catch (e) {
                    formattedDate = new Date().toISOString();
                }
            } else {
                formattedDate = new Date().toISOString();
            }
            
            // ✅ null বা undefined চেক
            if (!data.shareName) {
                console.warn("Invalid buy record skipped (no shareName):", data);
                return;
            }
            
            buyData.push({ 
                id: doc.id, 
                shareName: data.shareName,
                quantity: Number(data.quantity) || 0,
                buyPrice: Number(data.buyPrice) || 0,
                date: formattedDate,
                type: data.type || "BUY"
            });
        });

        const sellData = [];
        sellSnapshot.forEach(doc => {
            const data = doc.data();
            
            // 🔥 সুরক্ষিত কনভার্শন
            let formattedDate = null;
            if (data.date) {
                try {
                    if (typeof data.date.toDate === 'function') {
                        formattedDate = data.date.toDate().toISOString();
                    } else if (data.date instanceof Date) {
                        formattedDate = data.date.toISOString();
                    } else if (typeof data.date === 'object' && data.date.seconds) {
                        formattedDate = new Date(data.date.seconds * 1000).toISOString();
                    } else if (typeof data.date === 'string') {
                        formattedDate = data.date;
                    } else {
                        formattedDate = new Date().toISOString();
                    }
                } catch (e) {
                    formattedDate = new Date().toISOString();
                }
            } else {
                formattedDate = new Date().toISOString();
            }
            
            if (!data.shareName) {
                console.warn("Invalid sell record skipped (no shareName):", data);
                return;
            }
            
            sellData.push({ 
                id: doc.id,
                shareName: data.shareName,
                quantitySold: Number(data.quantitySold) || 0,
                sellPrice: Number(data.sellPrice) || 0,
                buyPrice: Number(data.buyPrice) || 0,
                profitOrLoss: Number(data.profitOrLoss) || 0,
                date: formattedDate
            });
        });

        const backupData = {
            version: "1.1",
            downloadedAt: new Date().toISOString(),
            buyTransactions: buyData,
            sellTransactions: sellData
        };

        // 🚀 নিরাপদ JSON স্ট্রিং তৈরি
        const jsonString = JSON.stringify(backupData, null, 2);
        
        // 📥 ডাউনলোড
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = downloadUrl;
        downloadAnchor.download = `portfolio_backup_${new Date().toISOString().slice(0,10)}.json`;
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        
        // 🧹 মেমোরি ক্লিনআপ
        setTimeout(() => {
            if (document.body.contains(downloadAnchor)) {
                document.body.removeChild(downloadAnchor);
            }
            URL.revokeObjectURL(downloadUrl);
        }, 100);
        
        alert(`✅ সফলভাবে ${buyData.length + sellData.length} টি রেকর্ড ব্যাকআপ করা হয়েছে!`);

    } catch (error) {
        console.error("ডাটা ডাউনলোড করতে সমস্যা হয়েছে:", error);
        throw error; // উপরের ফাংশনে এরর হ্যান্ডেল করার জন্য
    }
}

// আপলোড ফাংশন - ইতিমধ্যে ভালো আছে, তবুও একটি স্মল ফিক্স
window.uploadPortfolioData = function(event) {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
        alert("অনুগ্রহ করে প্রথমে লগইন করুন।");
        event.target.value = '';
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;

    const confirmUpload = confirm("আপনি কি নিশ্চিত যে এই ফাইলটি আপলোড করতে চান?");
    if (!confirmUpload) {
        event.target.value = ''; 
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // 🛡️ ভ্যালিডেশন
            if (!importedData.buyTransactions || !importedData.sellTransactions) {
                throw new Error("ভুল ফাইল ফরম্যাট!");
            }

            const batch = db.batch();
            const MAX_BATCH_SIZE = 500;
            
            const totalRecords = importedData.buyTransactions.length + importedData.sellTransactions.length;
            if (totalRecords > MAX_BATCH_SIZE) {
                if (!confirm(`সতর্কতা: ${totalRecords} টি রেকর্ড আপলোড হতে সময় লাগবে। আপনি কি চালিয়ে যেতে চান?`)) {
                    event.target.value = '';
                    return;
                }
            }

            // Buy ট্রানজেকশন
            importedData.buyTransactions.forEach(item => {
                if (!item.shareName) return;
                const newDocRef = db.collection('portfolios').doc();
                const cleanedItem = { 
                    userId: currentUser.uid,
                    shareName: item.shareName,
                    quantity: Number(item.quantity) || 0,
                    buyPrice: Number(item.buyPrice) || 0,
                    type: "BUY",
                    date: item.date ? new Date(item.date) : new Date()
                };
                batch.set(newDocRef, cleanedItem);
            });

            // Sell ট্রানজেকশন  
            importedData.sellTransactions.forEach(item => {
                if (!item.shareName) return;
                const newDocRef = db.collection('sales_history').doc();
                const cleanedItem = {
                    userId: currentUser.uid,
                    shareName: item.shareName,
                    quantitySold: Number(item.quantitySold) || 0,
                    sellPrice: Number(item.sellPrice) || 0,
                    buyPrice: Number(item.buyPrice) || 0,
                    profitOrLoss: Number(item.profitOrLoss) || 0,
                    date: item.date ? new Date(item.date) : new Date()
                };
                batch.set(newDocRef, cleanedItem);
            });

            await batch.commit();
            alert("✅ ডাটা সফলভাবে রিস্টোর করা হয়েছে!");
            location.reload(); 

        } catch (error) {
            console.error("আপলোড ত্রুটি:", error);
            alert("❌ ফাইল আপলোড করতে সমস্যা হয়েছে: " + error.message);
        } finally {
            event.target.value = '';
        }
    };
    
    reader.onerror = function() {
        alert("ফাইল পড়া সম্ভব হয়নি!");
        event.target.value = '';
    };
    
    reader.readAsText(file);
};
// ==========================================
// 🚨 ইমার্জেন্সি ফিক্স: ডাউনলোড ফাংশন রিডিফাইন (ক্রাশ সমাধান)
// ==========================================

// পুরনো ফাংশন ওভাররাইড করে নিরাপদ ভার্সন
window.downloadPortfolioData = async function() {
    console.log("ডাউনলোড ফাংশন কল হয়েছে");
    
    // Firebase রেডি চেক
    if (!firebase || !auth || !db) {
        alert("অ্যাপ লোড হচ্ছে, একটু পরে আবার চেষ্টা করুন।");
        return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        alert("দয়া করে আগে লগইন করুন!");
        return;
    }
    
    if (!confirm("আপনার পোর্টফোলিও ডাটা ব্যাকআপ ডাউনলোড করতে চান?")) {
        return;
    }
    
    // লোডিং ইন্ডিকেটর
    const loadingBtn = document.getElementById('btn-download-data');
    const originalText = loadingBtn ? loadingBtn.innerText : "ডাউনলোড";
    if (loadingBtn) {
        loadingBtn.innerText = "⏳ লোড হচ্ছে...";
        loadingBtn.disabled = true;
    }
    
    try {
        // সরাসরি কোড এখানে লিখছি, আলাদা ফাংশন কল না করে
        const portfoliosRef = db.collection('portfolios');
        const salesRef = db.collection('sales_history');
        
        console.log("ডাটা সংগ্রহ শুরু...");
        
        const buySnapshot = await portfoliosRef.where('userId', '==', currentUser.uid).get();
        const sellSnapshot = await salesRef.where('userId', '==', currentUser.uid).get();
        
        console.log(`পাওয়া গেছে: ${buySnapshot.size} buy, ${sellSnapshot.size} sell`);

        const buyData = [];
        buySnapshot.forEach(doc => {
            const data = doc.data();
            let formattedDate = new Date().toISOString();
            
            if (data.date) {
                try {
                    if (data.date.toDate) formattedDate = data.date.toDate().toISOString();
                    else if (data.date.seconds) formattedDate = new Date(data.date.seconds * 1000).toISOString();
                    else if (typeof data.date === 'string') formattedDate = data.date;
                } catch(e) {}
            }
            
            buyData.push({ 
                shareName: data.shareName || '',
                quantity: Number(data.quantity) || 0,
                buyPrice: Number(data.buyPrice) || 0,
                date: formattedDate,
                type: "BUY"
            });
        });

        const sellData = [];
        sellSnapshot.forEach(doc => {
            const data = doc.data();
            let formattedDate = new Date().toISOString();
            
            if (data.date) {
                try {
                    if (data.date.toDate) formattedDate = data.date.toDate().toISOString();
                    else if (data.date.seconds) formattedDate = new Date(data.date.seconds * 1000).toISOString();
                    else if (typeof data.date === 'string') formattedDate = data.date;
                } catch(e) {}
            }
            
            sellData.push({ 
                shareName: data.shareName || '',
                quantitySold: Number(data.quantitySold) || 0,
                sellPrice: Number(data.sellPrice) || 0,
                buyPrice: Number(data.buyPrice) || 0,
                profitOrLoss: Number(data.profitOrLoss) || 0,
                date: formattedDate
            });
        });

        const backupData = {
            version: "1.1",
            downloadedAt: new Date().toISOString(),
            buyTransactions: buyData,
            sellTransactions: sellData
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        alert(`✅ সফল! ${buyData.length + sellData.length} টি রেকর্ড ডাউনলোড হয়েছে।`);
        
    } catch (error) {
        console.error("ডাউনলোড এরর:", error);
        alert("❌ ব্যাকআপ নিতে ব্যর্থ: " + (error.message || "অজানা ত্রুটি"));
    } finally {
        if (loadingBtn) {
            loadingBtn.innerText = originalText;
            loadingBtn.disabled = false;
        }
    }
};

// HTML এ বাটন সঠিকভাবে সেট করা হয়েছে কিনা চেক করুন
document.addEventListener('DOMContentLoaded', function() {
    const downloadBtn = document.getElementById('btn-download-data');
    if (downloadBtn) {
        console.log("ডাউনলোড বাটন পাওয়া গেছে, ইভেন্ট সংযুক্ত হচ্ছে");
        // আগের onclick রিমুভ করে নতুন যোগ করছি
        downloadBtn.removeAttribute('onclick');
        downloadBtn.addEventListener('click', window.downloadPortfolioData);
    } else {
        console.warn("ডাউনলোড বাটন খুঁজে পাওয়া যায়নি!");
    }
});
// ==========================================
// 📥 Stock Table CSV ডাউনলোড ফাংশন
// ==========================================

function downloadTableAsCSV() {
    // ১ম ধাপ: টেবিলের বডি খুঁজে বের করা
    const tableBody = document.getElementById('portfolio-table-body');
    
    // চেক করা টেবিল আছে কিনা
    if (!tableBody) {
        alert("টেবিল ডাটা পাওয়া যায়নি!");
        return;
    }
    
    // টেবিলের সব সারি (row) সংগ্রহ করা
    const rows = tableBody.querySelectorAll('tr');
    
    // চেক করা ডাটা আছে কিনা
    if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('No trade history'))) {
        alert("ডাউনলোড করার মতো ডাটা নেই!");
        return;
    }
    
    // ২য় ধাপ: CSV ফাইলের হেডার (কলামের নাম) তৈরি করা
    const headers = [
        "Share Name",           // শেয়ারের নাম
        "Total Buy Qty",        // মোট কেনা পরিমাণ
        "Avg Buy (৳)",          // গড় ক্রয়মূল্য
        "Remaining Qty",        // অবশিষ্ট পরিমাণ
        "Current Live (৳)",     // বর্তমান বাজার মূল্য
        "Unrealized (৳)",       // অবাস্তায়িত লাভ/ক্ষতি
        "Sell Qty",             // বিক্রিত পরিমাণ
        "Sell Price (৳)",       // বিক্রয় মূল্য
        "Realized (৳)"          // বাস্তায়িত লাভ/ক্ষতি
    ];
    
    // ৩য় ধাপ: CSV ডাটা সংরক্ষণের জন্য একটি array তৈরি করা
    const csvData = [];
    
    // হেডার যোগ করা (প্রথম লাইন)
    csvData.push(headers.join(','));  // join(',') মানে কমা দিয়ে যুক্ত করা
    
    // ৪র্থ ধাপ: টেবিলের প্রতিটি সারি থেকে ডাটা নেওয়া
    for (let row of rows) {
        // সারির সব cell খুঁজে বের করা
        const cells = row.querySelectorAll('td');
        
        // যদি cell না থাকে তাহলে跳过
        if (cells.length === 0) continue;
        
        // ফুটারের সারি চিহ্নিত করা (যাতে ফুটার আলাদাভাবে যোগ করা যায়)
        const rowText = row.innerText;
        if (rowText.includes('Grand Totals')) continue;
        
        // প্রতিটি cell থেকে টেক্সট নেওয়া এবং ক্লিন করা
        const rowData = [];
        
        for (let cell of cells) {
            // cell এর ভিতরের টেক্সট নেওয়া
            let text = cell.innerText || cell.textContent || '';
            
            // ৳ চিহ্ন এবং কমা রিমুভ করা (CSV ফাইলের জন্য ক্লিন ডাটা)
            text = text.replace(/[৳,]/g, '').trim();
            
            // যদি খালি হয় বা '-' হয় তাহলে ফাঁকা রাখা
            if (text === '' || text === '-') {
                text = '';
            }
            
            // CSV ফরম্যাটের জন্য সুরক্ষা (যদি টেক্সটে কমা বা উদ্ধৃতি চিহ্ন থাকে)
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                text = `"${text.replace(/"/g, '""')}"`;
            }
            
            rowData.push(text);
        }
        
        // ডাটা থাকলে CSV তে যোগ করা
        if (rowData.length > 0 && rowData.some(cell => cell !== '')) {
            csvData.push(rowData.join(','));
        }
    }
    
    // ৫ম ধাপ: ফুটার থেকে আনরিয়েলাইজড এবং রিয়েলাইজড ডাটা নেওয়া
    const unrealizedElem = document.getElementById('foot-total-unrealized');
    const realizedElem = document.getElementById('foot-total-realized');
    
    if (unrealizedElem && realizedElem) {
        // ৳ চিহ্ন এবং কমা রিমুভ করা
        let unrealized = unrealizedElem.innerText.replace(/[৳,]/g, '').trim();
        let realized = realizedElem.innerText.replace(/[৳,]/g, '').trim();
        
        // খালি থাকলে 0 বসানো
        if (unrealized === '' || unrealized === '-') unrealized = '0';
        if (realized === '' || realized === '-') realized = '0';
        
        // একটি ফাঁকা লাইন এবং তারপর ফুটারের তথ্য যোগ করা
        csvData.push('');  // ফাঁকা লাইন
        csvData.push(`"Total Unrealized P/L","${unrealized}",,,,,"Total Realized P/L","${realized}",`);
    }
    
    // ৬ষ্ঠ ধাপ: CSV ফাইল তৈরি করা এবং ডাউনলোড শুরু করা
    const csvContent = csvData.join('\n');  // প্রতিটি লাইনের পরে নতুন লাইন
    
    // BOM (\uFEFF) যোগ করা হচ্ছে বাংলা অক্ষর সঠিকভাবে দেখানোর জন্য
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // ডাউনলোড লিংক তৈরি করা
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // ফাইলের নাম তৈরি করা (বর্তমান তারিখ ও সময় সহ)
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    link.download = `stock_table_${timestamp}.csv`;
    
    link.href = url;
    document.body.appendChild(link);
    link.click();  // ডাউনলোড শুরু
    
    // ক্লিনআপ: লিংক এবং URL মেমোরি থেকে মুছে ফেলা
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
    
    // সফল বার্তা
    alert("✅ CSV ফাইল ডাউনলোড শুরু হয়েছে!");
}

// পেজ লোড হওয়ার পর বাটনটি প্রস্তুত করা
document.addEventListener('DOMContentLoaded', function() {
    const downloadBtn = document.getElementById('btn-download-csv');
    if (downloadBtn) {
        console.log("✅ CSV ডাউনলোড বাটন প্রস্তুত");
    }
});
// ==========================================
// 🌙 ডার্ক মোড টগল ফাংশন
// ==========================================

function toggleDarkMode() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // থিম পরিবর্তন
    html.setAttribute('data-theme', newTheme);
    
    // localStorage এ সেভ করুন
    localStorage.setItem('theme', newTheme);
    
    // বাটনের আইকন পরিবর্তন
    const button = document.getElementById('theme-toggle');
    if (button) {
        button.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        button.setAttribute('title', newTheme === 'dark' ? 'Light Mode' : 'Dark Mode');
    }
    
    // চার্ট পুনরায় রেন্ডার (যদি চার্টের কালার পরিবর্তন করতে চান)
    if (dashboardChartInstance) {
        updateChartColors();
    }
    
    // কনসোলে লগ
    console.log(`Theme changed to: ${newTheme}`);
}

// চার্টের কালার আপডেট করার ফাংশন (ঐচ্ছিক)
// app.js এ updateChartColors ফাংশনটি সম্পূর্ণ করুন
function updateChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    
    if (dashboardChartInstance) {
        dashboardChartInstance.options.plugins.legend.labels.color = textColor;
        dashboardChartInstance.options.scales.x.ticks.color = textColor;
        dashboardChartInstance.options.scales.y.ticks.color = textColor;
        dashboardChartInstance.options.scales.x.grid.color = gridColor;
        dashboardChartInstance.options.scales.y.grid.color = gridColor;
        dashboardChartInstance.update();
    }
    
    if (advChartInstance) {
        advChartInstance.options.plugins.legend.labels.color = textColor;
        advChartInstance.options.scales.x.ticks.color = textColor;
        advChartInstance.options.scales.y.ticks.color = textColor;
        advChartInstance.options.scales.x.grid.color = gridColor;
        advChartInstance.options.scales.y.grid.color = gridColor;
        advChartInstance.update();
    }
}

// পেজ লোড হওয়ার সময় সেভ করা থিম লোড করুন
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // সেভ করা থিম বা সিস্টেম প্রেফারেন্স ব্যবহার করুন
    let theme = savedTheme;
    if (!theme) {
        theme = prefersDark ? 'dark' : 'light';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
    
    // বাটনের আইকন সেট করুন
    const button = document.getElementById('theme-toggle');
    if (button) {
        button.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    console.log(`Theme loaded: ${theme}`);
}

// সিস্টেম থিম পরিবর্তন মনিটর করুন
function watchSystemTheme() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // শুধুমাত্র যদি ইউজার manually থিম সেট না করে থাকে
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            const button = document.getElementById('theme-toggle');
            if (button) {
                button.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            }
        }
    });
}

// পেজ লোড হলে থিম লোড করুন
document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    watchSystemTheme();
});
// ==========================================
// 💰 DIVIDEND ANALYSIS - ফাইনাল ফিক্স
// ==========================================

let currentEditingDividendId = null;

async function loadDividendData() {
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        const tableBody = document.getElementById('dividend-table-body');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px;">Please login to view dividend data</td></tr>`;
        }
        return;
    }
    
    const tableBody = document.getElementById('dividend-table-body');
    if (!tableBody) return;
    
    try {
        const snapshot = await db.collection('dividend_records')
            .where('userId', '==', user.uid)
            .get();
        
        console.log('📊 Dividend records found:', snapshot.size);
        
        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                💡 No dividend records found.<br>
                <span style="font-size: 12px;">Search a share above and click Save to add dividend data.</span>
            </td></tr>`;
            return;
        }
        
        // পোর্টফোলিও ডাটা আনা
        const portfolioSnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .get();
        
        // বাকি শেয়ার ক্যালকুলেশন
        const remainingQtyMap = new Map();
        const avgPriceMap = new Map();
        
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            const ticker = data.shareName;
            const currentQty = remainingQtyMap.get(ticker) || 0;
            const currentCost = avgPriceMap.get(ticker)?.totalCost || 0;
            const currentTotalQty = avgPriceMap.get(ticker)?.totalQty || 0;
            
            remainingQtyMap.set(ticker, currentQty + data.quantity);
            avgPriceMap.set(ticker, {
                totalCost: currentCost + (data.quantity * data.buyPrice),
                totalQty: currentTotalQty + data.quantity
            });
        });
        
        let html = '';
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const ticker = data.shareName;
            const stockPercent = data.stockPercent || 0;
            const cashAmount = data.cashAmount || 0;
            const docId = doc.id;
            
            const remainingQty = remainingQtyMap.get(ticker) || 0;
            const avgData = avgPriceMap.get(ticker);
            const avgBuyPrice = avgData && avgData.totalQty > 0 ? avgData.totalCost / avgData.totalQty : 0;
            
            let totalDividendGain = 0;
            let unrealizedGain = 0;
            let showDividendAsGreen = false;
            
            if (remainingQty > 0 && avgBuyPrice > 0) {
                // ✅ সঠিক সূত্র: Dividend Gain = (Remaining Qty × Stock% × Avg Buy Price) + (Remaining Qty × Cash ÷ 10)
                const stockGain = remainingQty * (stockPercent / 100) * avgBuyPrice;
                const cashGain = remainingQty * (cashAmount / 10);
                totalDividendGain = stockGain + cashGain;
                
                // আনরিয়েলাইজ্ড গেইন
                let currentPrice = currentPriceData.get(ticker) || avgBuyPrice;
                unrealizedGain = (currentPrice - avgBuyPrice) * remainingQty;
                showDividendAsGreen = totalDividendGain >= unrealizedGain;
            }
            
            html += `
                <tr onclick="openDividendEditModal('${docId}', '${ticker}', ${stockPercent}, ${cashAmount})" style="cursor: pointer;" onmouseover="this.style.backgroundColor='var(--hover-bg)'" onmouseout="this.style.backgroundColor='transparent'">
                    <td style="padding: 12px;"><b>${ticker}</b></td>
                    <td style="padding: 12px; text-align: center;">${stockPercent}%</b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></td>
                    <td style="padding: 12px; text-align: center;">৳${cashAmount.toFixed(2)}</b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></td>
                    <td style="padding: 12px; ${showDividendAsGreen ? 'color: #10b981; font-weight: bold;' : ''}">${remainingQty > 0 ? `৳${totalDividendGain.toFixed(2)}` : '-'}</b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></td>
                    <td style="padding: 12px; ${!showDividendAsGreen && remainingQty > 0 ? 'color: #10b981; font-weight: bold;' : ''}">${remainingQty > 0 ? `৳${unrealizedGain.toFixed(2)}` : '-'}</b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></td>
                    <td style="padding: 12px; text-align: center;">
                        <button onclick="deleteDividendRecord('${docId}', event)" style="background: #ef4444; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer;">🗑️ Delete</button>
                    </b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = html;
        console.log('✅ Dividend table loaded with', snapshot.size, 'records');
        
    } catch (error) {
        console.error('Error:', error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#ef4444;">Error: ${error.message}</td></tr>`;
    }
}

// ট্যাব সুইচ করার সময় কল করা নিশ্চিত করা
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'dividend') {
        setTimeout(() => loadDividendData(), 100);
    }
};
// ডিভিডেন্ড ডাটা সেভ করা
async function saveDividendData(ticker, stockPercent, cashAmount, editId = null) {
    const user = auth.currentUser;
    if (!user) {
        alert('Please login first');
        return false;
    }
    
    if (!ticker) {
        alert('Please select a share name');
        return false;
    }
    
    try {
        if (editId) {
            await db.collection('dividend_records').doc(editId).update({
                stockPercent: Number(stockPercent),
                cashAmount: Number(cashAmount),
                updatedAt: new Date()
            });
            console.log('✅ Dividend record updated');
        } else {
            // চেক করা আগে থেকে আছে কিনা
            const existing = await db.collection('dividend_records')
                .where('userId', '==', user.uid)
                .where('shareName', '==', ticker)
                .get();
            
            if (!existing.empty) {
                alert(`${ticker} already exists! You can edit it by clicking on the row.`);
                return false;
            }
            
            await db.collection('dividend_records').add({
                userId: user.uid,
                shareName: ticker,
                stockPercent: Number(stockPercent),
                cashAmount: Number(cashAmount),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('✅ Dividend record saved');
        }
        
        await loadDividendData();
        return true;
        
    } catch (error) {
        console.error('Error saving dividend:', error);
        alert('Error saving data');
        return false;
    }
}

// ডিভিডেন্ড ডিলিট করা
window.deleteDividendRecord = async function(docId, event) {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this dividend record?')) return;
    
    try {
        await db.collection('dividend_records').doc(docId).delete();
        console.log('✅ Dividend record deleted');
        await loadDividendData();
    } catch (error) {
        console.error('Error deleting:', error);
        alert('Error deleting record');
    }
};

// এডিট মডাল খোলা
window.openDividendEditModal = function(docId, ticker, stockPercent, cashAmount) {
    currentEditingDividendId = docId;
    
    document.getElementById('div-search-ticker').value = ticker;
    document.getElementById('div-stock-percent').value = stockPercent;
    document.getElementById('div-cash-amount').value = cashAmount;
    
    // বাটন টেক্সট পরিবর্তন
    const saveBtn = document.getElementById('btn-save-dividend');
    saveBtn.innerHTML = '✏️ Update';
    saveBtn.style.background = '#f59e0b';
    
    // সাজেশন বক্স লুকান
    const suggestionBox = document.getElementById('div-suggestion-box');
    if (suggestionBox) suggestionBox.classList.add('hidden');
    
    // স্ক্রিনের উপরে স্ক্রল করে আনুন
    document.querySelector('#sec-dividend .dividend-input-section').scrollIntoView({ behavior: 'smooth' });
    
    // হাইলাইট ইফেক্ট
    const inputSection = document.querySelector('.dividend-input-section');
    inputSection.style.transition = 'box-shadow 0.3s';
    inputSection.style.boxShadow = '0 0 0 2px #f59e0b';
    setTimeout(() => {
        inputSection.style.boxShadow = '';
    }, 1500);
};

// ডিভিডেন্ড সার্চ সাজেশন
const divSearchInput = document.getElementById('div-search-ticker');
const divSuggestionBox = document.getElementById('div-suggestion-box');

if (divSearchInput) {
    divSearchInput.addEventListener('input', () => {
        const query = divSearchInput.value.trim().toUpperCase();
        divSuggestionBox.innerHTML = '';
        
        if (!query) {
            divSuggestionBox.classList.add('hidden');
            return;
        }
        
        const filtered = dseStocks.filter(stock => stock.startsWith(query));
        if (filtered.length > 0) {
            divSuggestionBox.classList.remove('hidden');
            filtered.forEach(stock => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.innerText = stock;
                div.addEventListener('click', () => {
                    divSearchInput.value = stock;
                    divSuggestionBox.classList.add('hidden');
                });
                divSuggestionBox.appendChild(div);
            });
        } else {
            divSuggestionBox.classList.add('hidden');
        }
    });
    
    // বাইরে ক্লিক করলে সাজেশন বক্স লুকান
    document.addEventListener('click', function(e) {
        if (divSearchInput && !divSearchInput.contains(e.target) && divSuggestionBox && !divSuggestionBox.contains(e.target)) {
            divSuggestionBox.classList.add('hidden');
        }
    });
}

// সেইভ বাটন ইভেন্ট
const saveDividendBtn = document.getElementById('btn-save-dividend');
if (saveDividendBtn) {
    saveDividendBtn.addEventListener('click', async () => {
        const ticker = document.getElementById('div-search-ticker').value.trim().toUpperCase();
        const stockPercent = document.getElementById('div-stock-percent').value;
        const cashAmount = document.getElementById('div-cash-amount').value;
        
        if (!ticker) {
            alert('Please select a share name');
            return;
        }
        
        const success = await saveDividendData(ticker, stockPercent, cashAmount, currentEditingDividendId);
        
        if (success) {
            // রিসেট ফর্ম
            document.getElementById('div-search-ticker').value = '';
            document.getElementById('div-stock-percent').value = '0';
            document.getElementById('div-cash-amount').value = '0';
            
            const saveBtn = document.getElementById('btn-save-dividend');
            saveBtn.innerHTML = '💾 Save';
            saveBtn.style.background = '#10b981';
            currentEditingDividendId = null;
        }
    });
}
// ==========================================
// 📈 পারফরম্যান্স সারাংশ - শুধু Firebase ডাটা ভিত্তিক
// ==========================================

// ==========================================
// 📈 পারফরম্যান্স সারাংশ - ড্যাশবোর্ড এবং পোর্টফোলিও অ্যানালাইসিসের জন্য
// ==========================================

// ==========================================
// 📈 পারফরম্যান্স সারাংশ (হাইব্রিড - Live API + Firebase)
// ==========================================

async function updatePerformanceSummary() {
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    
    try {
        // পোর্টফোলিও ডাটা আনা
        const portfolioSnapshot = await db.collection('portfolios')
            .where('userId', '==', user.uid)
            .get();
        
        const salesSnapshot = await db.collection('sales_history')
            .where('userId', '==', user.uid)
            .get();
        
        // বিক্রি পরিমাণ ম্যাপ
        const soldMap = new Map();
        salesSnapshot.forEach(doc => {
            const data = doc.data();
            soldMap.set(data.shareName, (soldMap.get(data.shareName) || 0) + data.quantitySold);
        });
        
        // কেনা লট তৈরি
        const buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            buyLots.push({
                ticker: data.shareName,
                qty: data.quantity,
                buyPrice: data.buyPrice,
                date: data.date ? new Date(data.date) : new Date()
            });
        });
        
        buyLots.sort((a, b) => a.date - b.date);
        
        // বাকি শেয়ার ক্যালকুলেশন
        const tempSold = new Map(soldMap);
        const remainingQtyMap = new Map();
        const costMap = new Map();
        
        for (const lot of buyLots) {
            let remaining = lot.qty;
            let sold = tempSold.get(lot.ticker) || 0;
            
            if (sold > 0 && remaining > 0) {
                const taken = Math.min(remaining, sold);
                remaining -= taken;
                sold -= taken;
                tempSold.set(lot.ticker, sold);
            }
            
            if (remaining > 0) {
                remainingQtyMap.set(lot.ticker, (remainingQtyMap.get(lot.ticker) || 0) + remaining);
                costMap.set(lot.ticker, (costMap.get(lot.ticker) || 0) + (remaining * lot.buyPrice));
            }
        }
        
        // বর্তমান ভ্যালু ক্যালকুলেশন
        let totalCost = 0;
        let totalCurrentValue = 0;
        
        for (const [ticker, qty] of remainingQtyMap) {
            const avgPrice = costMap.get(ticker) / qty;
            totalCost += costMap.get(ticker);
            
            // 🔥 বর্তমান প্রাইস: Live API মোডে currentPriceData থেকে, না হলে Firebase থেকে
            let currentPrice = currentPriceData.get(ticker);
            
            // Live API মোডে না থাকলে (Firebase মোডে) Firebase থেকে আনা
            if (!currentPrice || currentPrice === 0) {
                currentPrice = avgPrice;
            }
            
            totalCurrentValue += qty * currentPrice;
        }
        
        const currentReturn = totalCost > 0 ? ((totalCurrentValue - totalCost) / totalCost) * 100 : 0;
        
        // 🔥 বিভিন্ন সময়ের রিটার্ন ক্যালকুলেশন
        const periods = [
            { name: 'today', days: 0, isToday: true },
            { name: '5d', days: 5 },
            { name: '15d', days: 15 },
            { name: '30d', days: 30 },
            { name: '3m', days: 90 },
            { name: '6m', days: 180 },
            { name: '1y', days: 365 }
        ];
        
        const portfolioReturns = {};
        
        for (const period of periods) {
            if (period.days === 0) {
                // Today: বর্তমান রিটার্ন (Live API থেকে)
                portfolioReturns[period.name] = currentReturn;
                continue;
            }
            
            // নির্দিষ্ট দিন আগের তারিখ
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - period.days);
            const targetDateStr = targetDate.toISOString().split('T')[0];
            
            let pastValue = 0;
            let hasData = false;
            
            // প্রতিটি শেয়ারের ঐ তারিখের প্রাইস (Firebase থেকে)
            for (const [ticker, qty] of remainingQtyMap) {
                const pastPrice = await firebaseDataManager.getPriceByDate(ticker, targetDateStr);
                if (pastPrice && pastPrice > 0) {
                    pastValue += qty * pastPrice;
                    hasData = true;
                } else {
                    // ডাটা না থাকলে বর্তমান প্রাইস ব্যবহার
                    const avgPrice = costMap.get(ticker) / qty;
                    pastValue += qty * avgPrice;
                }
            }
            
            if (hasData && pastValue > 0) {
    const periodReturn = ((totalCurrentValue - pastValue) / pastValue) * 100;
    portfolioReturns[period.name] = periodReturn;
} else {
    // ডাটা না থাকলে null বা '-' দেখান
    portfolioReturns[period.name] = null;
}
        }
        
        // বেঞ্চমার্ক রিটার্ন (DSEX - Firebase থেকে)
        const benchmarkReturns = {};
        for (const period of periods) {
            if (period.days === 0) {
                benchmarkReturns[period.name] = 0;
                continue;
            }
            
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - period.days);
            const targetDateStr = targetDate.toISOString().split('T')[0];
            
            const currentDSEX = await firebaseDataManager.getPriceByDate('DSEX', new Date().toISOString().split('T')[0]);
            const pastDSEX = await firebaseDataManager.getPriceByDate('DSEX', targetDateStr);
            
            if (currentDSEX && pastDSEX && pastDSEX > 0) {
                benchmarkReturns[period.name] = ((currentDSEX - pastDSEX) / pastDSEX) * 100;
            } else {
                benchmarkReturns[period.name] = 0;
            }
        }
        
        // UI আপডেট ফাংশন
        const updateCell = (id, value) => {
            const elem = document.getElementById(id);
            if (elem) {
                const isPositive = value >= 0;
                elem.innerHTML = `${isPositive ? '+' : ''}${value.toFixed(2)}%`;
                elem.style.color = isPositive ? '#10b981' : '#ef4444';
                elem.style.fontWeight = 'bold';
            }
        };
        
        const updateDiffCell = (id, portfolio, benchmark) => {
            const elem = document.getElementById(id);
            if (elem) {
                const diff = portfolio - benchmark;
                const isPositive = diff >= 0;
                elem.innerHTML = `${isPositive ? '+' : ''}${diff.toFixed(2)}%`;
                elem.style.color = isPositive ? '#10b981' : '#ef4444';
                elem.style.fontWeight = 'bold';
            }
        };
        
        // পোর্টফোলিও অ্যানালাইসিস টেবিল আপডেট
        updateCell('perf-today', portfolioReturns.today);
        updateCell('perf-5d', portfolioReturns['5d']);
        updateCell('perf-15d', portfolioReturns['15d']);
        updateCell('perf-30d', portfolioReturns['30d']);
        updateCell('perf-3m', portfolioReturns['3m']);
        updateCell('perf-6m', portfolioReturns['6m']);
        updateCell('perf-1y', portfolioReturns['1y']);
        
        updateCell('bench-today', benchmarkReturns.today);
        updateCell('bench-5d', benchmarkReturns['5d']);
        updateCell('bench-15d', benchmarkReturns['15d']);
        updateCell('bench-30d', benchmarkReturns['30d']);
        updateCell('bench-3m', benchmarkReturns['3m']);
        updateCell('bench-6m', benchmarkReturns['6m']);
        updateCell('bench-1y', benchmarkReturns['1y']);
        
        updateDiffCell('diff-today', portfolioReturns.today, benchmarkReturns.today);
        updateDiffCell('diff-5d', portfolioReturns['5d'], benchmarkReturns['5d']);
        updateDiffCell('diff-15d', portfolioReturns['15d'], benchmarkReturns['15d']);
        updateDiffCell('diff-30d', portfolioReturns['30d'], benchmarkReturns['30d']);
        updateDiffCell('diff-3m', portfolioReturns['3m'], benchmarkReturns['3m']);
        updateDiffCell('diff-6m', portfolioReturns['6m'], benchmarkReturns['6m']);
        updateDiffCell('diff-1y', portfolioReturns['1y'], benchmarkReturns['1y']);
        
        // ড্যাশবোর্ড পারফরম্যান্স টেবিল আপডেট
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
        
        // টাইমস্ট্যাম্প আপডেট
        const timeElem = document.getElementById('perf-update-time');
        if (timeElem) {
            const mode = currentDataMode === 'firebase' ? 'Firebase Cache' : 'Live API';
            timeElem.innerText = `${new Date().toLocaleString()} (${mode})`;
        }
        
        const dashTimeElem = document.getElementById('dash-perf-update-time');
        if (dashTimeElem) {
            const mode = currentDataMode === 'firebase' ? 'Firebase Cache' : 'Live API';
            dashTimeElem.innerText = `${new Date().toLocaleString()} (${mode})`;
        }
        
        console.log(`✅ Performance summary updated (Mode: ${currentDataMode})`);
        
    } catch (error) {
        console.error('Performance summary error:', error);
    }
}
// ==========================================
// 📅 ফোর্স লাস্ট আপডেট টাইম ফিক্স
// ==========================================

async function forceLastUpdateTime() {
    // 📆 Firebase stock_history থেকে সর্বশেষ তারিখ নাও
    try {
        const snapshot = await db.collection('stock_history')
            .orderBy('date', 'desc')
            .limit(1)
            .get();
        
        let fixedTime;
        if (!snapshot.empty) {
            const latestDoc = snapshot.docs[0];
            const latestDate = latestDoc.data().date;
            fixedTime = new Date(latestDate);
            fixedTime.setHours(15, 0, 0, 0); // বিকাল ৩টায় সেট করুন
        } else {
            // fallback: আজকের তারিখ
            fixedTime = new Date();
            fixedTime.setHours(15, 0, 0, 0);
        }
        
        const formatted = fixedTime.toLocaleString('bn-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        console.log('Setting time to:', formatted);
        
        // এলিমেন্ট আপডেট
        const dataDateValue = document.getElementById('data-date-value');
        if (dataDateValue) {
            dataDateValue.textContent = `📅 Data from: ${formatted} (328 records)`;
        }
        
        const timestampElem = document.getElementById('update-timestamp');
        if (timestampElem) {
            timestampElem.innerHTML = `🔄 Data source: Firebase Cache | Last scraped: ${formatted}`;
        }
        
        const dashTimeElem = document.getElementById('dash-perf-update-time');
        if (dashTimeElem) {
            dashTimeElem.innerText = formatted;
        }
        
    } catch (error) {
        console.error('Error getting last update time:', error);
        // fallback: আজকের তারিখ দেখান
        const fixedTime = new Date();
        fixedTime.setHours(15, 0, 0, 0);
        const formatted = fixedTime.toLocaleString('bn-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const dataDateValue = document.getElementById('data-date-value');
        if (dataDateValue) {
            dataDateValue.textContent = `📅 Data from: ${formatted}`;
        }
    }
}


// পেজ লোড হলে এবং 1 সেকেন্ড পর কল করুন
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(forceLastUpdateTime, 1000);
});
// পেজ হাইড/শো হলে অটো-রিফ্রেশ রিস্টার্ট
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            console.log('⏸️ Auto-refresh paused (page hidden)');
        }
    } else {
        startAutoRefresh();
        if (auth.currentUser) {
            console.log('▶️ Auto-refresh resumed (page visible)');
            loadDashboardData();
        }
    }
});
// ম্যানুয়ালি সিঙ্ক করার ফাংশন
// ম্যানুয়ালি সিঙ্ক করার ফাংশন
window.syncPortfolioAnalysis = function() {
    if (!auth.currentUser) {
        showToast('Please login first', 'error');
        return;
    }
    
    console.log('🔄 Manually syncing Portfolio Analysis...');
    showToast('Syncing portfolio data...', 'info');
    
    // currentPriceData রিফ্রেশ করুন
    if (currentDataMode === 'firebase') {
        firebaseDataManager.loadLatestPrices().then(prices => {
            if (prices) {
                currentPriceData = prices;
                setTimeout(() => {
                    loadPortfolioAnalysisTable(auth.currentUser.uid);
                    showToast('Synced with Firebase data', 'success');
                }, 100);
            }
        });
    } else {
        loadFromAPI(auth.currentUser).then(prices => {
            if (prices) {
                currentPriceData = prices;
                setTimeout(() => {
                    loadPortfolioAnalysisTable(auth.currentUser.uid);
                    showToast('Synced with Live API', 'success');
                }, 100);
            }
        });
    }
};
// Dashboard এর Current Value আপডেট করার ফাংশন
function updateDashboardCurrentValue() {
    const valueElem = document.getElementById('current-value');
    if (valueElem && currentPortfolioTotalValue > 0) {
        valueElem.innerText = `৳${currentPortfolioTotalValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        console.log(`📊 Dashboard updated from Portfolio Analysis: ৳${currentPortfolioTotalValue.toFixed(2)}`);
    }
}


// ব্যাকগ্রাউন্ডে Portfolio Analysis লোড করার ফাংশন (UI আপডেট ছাড়া)
async function loadPortfolioAnalysisInBackground(userId) {
    try {
        // পোর্টফোলিও ডাটা আনা
        const portfolioSnapshot = await db.collection("portfolios").where("userId", "==", userId).get();
        const salesSnapshot = await db.collection("sales_history").where("userId", "==", userId).get();
        
        // totalSoldQtyMap তৈরি
        let totalSoldQtyMap = new Map();
        salesSnapshot.forEach(doc => {
            const data = doc.data();
            totalSoldQtyMap.set(data.shareName, (totalSoldQtyMap.get(data.shareName) || 0) + data.quantitySold);
        });
        
        let totalCurrentValue = 0;
        
        // প্রতিটি টিকারের জন্য ভ্যালু ক্যালকুলেশন
        for (const doc of portfolioSnapshot.docs) {
            const data = doc.data();
            const ticker = data.shareName;
            const totalSold = totalSoldQtyMap.get(ticker) || 0;
            
            // বর্তমান প্রাইস
            let currentPrice = currentPriceData.get(ticker) || 0;
            
            // প্রাইস না থাকলে avg ব্যবহার
            if (currentPrice === 0) {
                currentPrice = data.buyPrice;
            }
            
            // FIFO বাকি শেয়ার ক্যালকুলেশন (সিম্পল)
            let remainingQty = data.quantity - totalSold;
            if (remainingQty < 0) remainingQty = 0;
            
            totalCurrentValue += remainingQty * currentPrice;
        }
        
        // গ্লোবাল ভেরিয়েবল আপডেট
        currentPortfolioTotalValue = totalCurrentValue;
        
        // Dashboard আপডেট
        updateDashboardCurrentValue();
        
        console.log(`📊 Background calculation complete: ৳${totalCurrentValue.toFixed(2)}`);
        
    } catch (error) {
        console.error('Background calculation error:', error);
    }
}
// ==========================================
// 💰 কমিশন ম্যানেজার (শুধু পারসেন্টেজ)
// ==========================================

class CommissionManager {
    constructor() {
        this.loadSettings();
    }
    
    loadSettings() {
        const saved = localStorage.getItem('commissionPercent');
        this.percent = saved ? parseFloat(saved) : 0;
    }
    
    saveSettings() {
        localStorage.setItem('commissionPercent', this.percent);
    }
    
    // কমিশন ক্যালকুলেট (Buy বা Sell এর জন্য)
    calculateCommission(amount) {
        return amount * (this.percent / 100);
    }
    
    // Buy করার সময় মোট খরচ (মূল্য + কমিশন)
    getBuyTotalWithCommission(amount) {
        const commission = this.calculateCommission(amount);
        return amount + commission;
    }
    
    // Sell করার সময় নেট পাওয়া (মূল্য - কমিশন)
    getSellNetWithCommission(amount) {
        const commission = this.calculateCommission(amount);
        return amount - commission;
    }
    
    getPercent() {
        return this.percent;
    }
    
    updatePercent(percent) {
        this.percent = parseFloat(percent) || 0;
        this.saveSettings();
    }
}

// গ্লোবাল ইন্সট্যান্স
const commissionManager = new CommissionManager();

// ==========================================
// UI কন্ট্রোল ফাংশন
// ==========================================

function toggleCommissionSettings() {
    const panel = document.getElementById('commission-panel');
    if (panel) {
        const isVisible = panel.style.display === 'block';
        panel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            document.getElementById('commission-percent').value = commissionManager.getPercent();
        }
    }
}

function saveCommissionSettings() {
    const percent = parseFloat(document.getElementById('commission-percent').value) || 0;
    commissionManager.updatePercent(percent);
    showToast(`Commission set to ${percent}% for both Buy & Sell`, 'success');
    
    // সব ডাটা রিলোড করে নতুন কমিশন প্রয়োগ করুন
    if (auth.currentUser) {
        loadDashboardData();
        loadUnifiedStockTable(auth.currentUser.uid);
        loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
    
    // প্যানেল লুকান
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = 'none';
}

function resetCommissionSettings() {
    commissionManager.updatePercent(0);
    document.getElementById('commission-percent').value = 0;
    showToast('Commission reset to 0%', 'info');
    
    if (auth.currentUser) {
        loadDashboardData();
        loadUnifiedStockTable(auth.currentUser.uid);
        loadPortfolioAnalysisTable(auth.currentUser.uid);
    }
    
    const panel = document.getElementById('commission-panel');
    if (panel) panel.style.display = 'none';
}

// কমিশন ইনফো ডিসপ্লে আপডেট
function updateCommissionDisplay() {
    const percent = commissionManager.getPercent();
    let infoDiv = document.getElementById('commission-info-display');
    
    if (!infoDiv) {
        // কমিশন ইনফো দেখানোর জন্য ডিভি তৈরি করুন
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
        if (percent > 0) {
            infoDiv.innerHTML = `
                <span>💸 Commission Active</span>
                <span class="commission-badge">${percent}% on Buy & Sell</span>
            `;
            infoDiv.style.display = 'flex';
        } else {
            infoDiv.innerHTML = `
                <span>💸 No Commission</span>
                <span class="commission-badge">0%</span>
            `;
            infoDiv.style.display = 'flex';
        }
    }
}

// ==========================================
// 🔄 Buy ফাংশন আপডেট (কমিশন সহ)
// ==========================================

// বিদ্যমান btnBuy ইভেন্ট লিসেনার আপডেট করুন
const originalBuyHandler = btnBuy ? btnBuy.onclick : null;
if (btnBuy) {
    // পুরনো লিসেনার রিমুভ করে নতুন যোগ করুন
    const newBtnBuy = btnBuy.cloneNode(true);
    btnBuy.parentNode.replaceChild(newBtnBuy, btnBuy);
    
    newBtnBuy.addEventListener('click', async () => {
        const shareName = tickerInput.value.trim().toUpperCase();
        const quantity = document.getElementById('trade-qty').value;
        const price = priceInput.value;
        const user = auth.currentUser;

        if (!user) return alert("দয়া করে আগে লগইন করুন!");
        if (!shareName || !quantity || !price) return alert("সবগুলো ঘর সঠিকভাবে পূরণ করুন!");
        
        let selectedDate = tradeDateInput ? tradeDateInput.value : getTodayDate();
        if (!selectedDate) selectedDate = getTodayDate();
        const transactionDate = new Date(selectedDate);
        
        if (isNaN(transactionDate.getTime())) {
            alert("Invalid date! Please select a valid date.");
            return;
        }
        
        const totalAmount = Number(quantity) * Number(price);
        const commissionPercent = commissionManager.getPercent();
        const commissionAmount = commissionManager.calculateCommission(totalAmount);
        const totalWithCommission = totalAmount + commissionAmount;
        
        // কমিশন সহ কনফার্মেশন
        let confirmMsg = `Buy Order Summary:\n`;
        confirmMsg += `📊 Share: ${shareName}\n`;
        confirmMsg += `📦 Quantity: ${quantity}\n`;
        confirmMsg += `💰 Price: ৳${Number(price).toFixed(2)}\n`;
        confirmMsg += `📈 Total Amount: ৳${totalAmount.toFixed(2)}\n`;
        if (commissionPercent > 0) {
            confirmMsg += `💸 Commission (${commissionPercent}%): ৳${commissionAmount.toFixed(2)}\n`;
            confirmMsg += `───────────────────────────────\n`;
            confirmMsg += `💵 Net Payable: ৳${totalWithCommission.toFixed(2)}\n`;
        } else {
            confirmMsg += `💵 Net Payable: ৳${totalAmount.toFixed(2)}\n`;
        }
        
        if (!confirm(confirmMsg)) return;
        
        try {
            await db.collection("portfolios").add({
                userId: user.uid,
                shareName: shareName,
                quantity: Number(quantity),
                buyPrice: Number(price),
                type: "BUY",
                date: transactionDate,
                createdAt: new Date(),
                commission: commissionAmount,      // কমিশন টাকার পরিমাণ
                commissionPercent: commissionPercent  // কমিশন হার
            });

            alert(`✅ ${shareName} purchased successfully!`);
            
            tickerInput.value = "";
            document.getElementById('trade-qty').value = "";
            priceInput.value = "";
            if (tradeDateInput) tradeDateInput.value = getTodayDate();

            setTimeout(() => {
                location.reload();
            }, 500);

        } catch (error) {
            console.error("Error saving data:", error);
            alert("Failed to save purchase!");
        }
    });
}

// ==========================================
// 📊 calculateAndUpdatePortfolioValues আপডেট (কমিশন সহ Unrealized Value)
// ==========================================

async function calculateAndUpdatePortfolioValues(priceMap) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const portfolioSnapshot = await db.collection('portfolios').where('userId', '==', user.uid).get();
        const salesSnapshot = await db.collection('sales_history').where('userId', '==', user.uid).get();
        
        const totalSoldMap = new Map();
        salesSnapshot.forEach(doc => {
            const data = doc.data();
            const ticker = data.shareName;
            totalSoldMap.set(ticker, (totalSoldMap.get(ticker) || 0) + data.quantitySold);
        });
        
        const buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            // কমিশন সহ মোট খরচ
            const totalCostWithCommission = (data.quantity * data.buyPrice) + (data.commission || 0);
            
            buyLots.push({
                ticker: data.shareName,
                qty: data.quantity,
                buyPrice: data.buyPrice,
                totalCostWithCommission: totalCostWithCommission,
                commission: data.commission || 0,
                commissionPercent: data.commissionPercent || 0,
                date: data.date ? new Date(data.date) : new Date()
            });
        });
        
        buyLots.sort((a, b) => a.date - b.date);
        
        const remainingTracker = new Map();
        const sellRemaining = new Map();
        for (const [ticker, sold] of totalSoldMap) {
            sellRemaining.set(ticker, sold);
        }
        
        for (const lot of buyLots) {
            const ticker = lot.ticker;
            let remainingQty = lot.qty;
            const perUnitCost = lot.totalCostWithCommission / lot.qty; // কমিশন সহ প্রতি ইউনিট খরচ
            let toSell = sellRemaining.get(ticker) || 0;
            
            if (toSell > 0 && remainingQty > 0) {
                const sellFromThisLot = Math.min(remainingQty, toSell);
                remainingQty -= sellFromThisLot;
                toSell -= sellFromThisLot;
                sellRemaining.set(ticker, toSell);
            }
            
            if (remainingQty > 0) {
                if (!remainingTracker.has(ticker)) {
                    remainingTracker.set(ticker, { totalQty: 0, totalCost: 0 });
                }
                const current = remainingTracker.get(ticker);
                current.totalQty += remainingQty;
                current.totalCost += remainingQty * perUnitCost;
                remainingTracker.set(ticker, current);
            }
        }
        
        let totalInvestment = 0;
        let totalCurrentValue = 0;
        
        for (const [ticker, data] of remainingTracker) {
            const avgPriceWithCommission = data.totalCost / data.totalQty;
            let currentPrice = priceMap.get(ticker);
            if (!currentPrice || currentPrice === 0) {
                currentPrice = avgPriceWithCommission;
            }
            totalInvestment += data.totalCost;
            totalCurrentValue += data.totalQty * currentPrice;
        }
        
        const totalProfitLoss = totalCurrentValue - totalInvestment;
        
        const investElem = document.getElementById('total-invest');
        const valueElem = document.getElementById('current-value');
        const plElem = document.getElementById('profit-loss');
        
        if (investElem) {
            investElem.innerText = `৳${totalInvestment.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        }
        if (valueElem) {
            valueElem.innerText = `৳${totalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        }
        if (plElem) {
            plElem.innerText = `৳${totalProfitLoss.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
            plElem.style.color = totalProfitLoss >= 0 ? '#10b981' : '#ef4444';
        }
        
        currentPortfolioTotalValue = totalCurrentValue;
        updateTimestamp();
        updateCommissionDisplay();
        
        console.log(`✅ FINAL (with ${commissionManager.getPercent()}% commission): Investment=${totalInvestment.toFixed(2)}, Current=${totalCurrentValue.toFixed(2)}, P/L=${totalProfitLoss.toFixed(2)}`);
        
    } catch (error) {
        console.error('Dashboard calculation error:', error);
    }
}

// ==========================================
// 🔄 Sell ফাংশন আপডেট (কমিশন সহ)
// ==========================================

// বিদ্যমান btnExecuteSell আপডেট করুন
if (btnExecuteSell) {
    const originalSellHandler = btnExecuteSell.onclick;
    
    btnExecuteSell.addEventListener('click', async () => {
        const user = auth.currentUser;
        const ticker = sellTickerInput.value.trim().toUpperCase();

        if (!user) return alert("দয়া করে প্রথমে লগইন করুন!");
        if (!ticker || currentActiveLots.length === 0) return alert("দয়া করে একটি বৈধ শেয়ার সিলেক্ট করুন।");
        
        const sellDateInput = document.getElementById('sell-trade-date');
        let selectedDate = sellDateInput ? sellDateInput.value : getTodayDate();
        if (!selectedDate) selectedDate = getTodayDate();
        const transactionDate = new Date(selectedDate);
        
        if (isNaN(transactionDate.getTime())) {
            alert("Invalid date! Please select a valid date.");
            return;
        }

        let totalSoldSuccessfully = 0;
        let totalSellValue = 0;
        let totalCommissionAmount = 0;
        const batch = db.batch();

        // প্রথম ধাপ: ইনপুট ভ্যালিডেশন চেক
        for (let lot of currentActiveLots) {
            const qtyField = document.getElementById(`input-sell-qty-${lot.docId}`);
            const priceField = document.getElementById(`input-sell-price-${lot.docId}`);
            
            if (qtyField && priceField) {
                const sellQty = Number(qtyField.value) || 0;
                const sellPrice = Number(priceField.value) || 0;

                if (sellQty > 0) {
                    if (sellQty > lot.availableQty) {
                        alert(`দুঃখিত! এই লটে সর্বোচ্চ ${lot.availableQty} টি শেয়ার অবশিষ্ট আছে।`);
                        return;
                    }
                    if (sellPrice <= 0) {
                        alert("দয়া করে সঠিক বিক্রয় মূল্য দিন।");
                        return;
                    }
                }
            }
        }

        // দ্বিতীয় ধাপ: বিক্রয় রেকর্ড প্রস্তুত (কমিশন সহ)
        for (let lot of currentActiveLots) {
            const qtyField = document.getElementById(`input-sell-qty-${lot.docId}`);
            const priceField = document.getElementById(`input-sell-price-${lot.docId}`);
            
            if (qtyField && priceField) {
                const sellQty = Number(qtyField.value) || 0;
                const sellPrice = Number(priceField.value) || 0;

                if (sellQty > 0) {
                    const saleValue = sellQty * sellPrice;
                    const commission = commissionManager.calculateCommission(saleValue);
                    const netValue = saleValue - commission;
                    
                    totalSellValue += saleValue;
                    totalCommissionAmount += commission;
                    
                    const saleRecordRef = db.collection("sales_history").doc();
                    
                    batch.set(saleRecordRef, {
                        userId: user.uid,
                        shareName: ticker,
                        quantitySold: sellQty,
                        buyPrice: lot.buyPrice,
                        sellPrice: sellPrice,
                        profitOrLoss: (sellPrice - lot.buyPrice) * sellQty,
                        date: transactionDate,
                        createdAt: new Date(),
                        commission: commission,           // কমিশন টাকার পরিমাণ
                        commissionPercent: commissionManager.getPercent(),
                        netReceived: netValue             // কমিশন কাটা后的 net amount
                    });

                    totalSoldSuccessfully += sellQty;
                }
            }
        }

        if (totalSoldSuccessfully === 0) {
            return alert("দয়া করে অন্তত যেকোনো একটি লটে বিক্রয়ের পরিমাণ লিখুন।");
        }

        // কনফার্মেশন মেসেজ (কমিশন সহ)
        const commissionPercent = commissionManager.getPercent();
        let confirmMsg = `Sell Order Summary:\n`;
        confirmMsg += `📊 Share: ${ticker}\n`;
        confirmMsg += `📦 Total Sell Qty: ${totalSoldSuccessfully}\n`;
        confirmMsg += `💰 Total Sell Value: ৳${totalSellValue.toFixed(2)}\n`;
        if (commissionPercent > 0) {
            confirmMsg += `💸 Commission (${commissionPercent}%): ৳${totalCommissionAmount.toFixed(2)}\n`;
            confirmMsg += `───────────────────────────────\n`;
            confirmMsg += `💵 Net Receivable: ৳${(totalSellValue - totalCommissionAmount).toFixed(2)}\n`;
        }
        
        if (!confirm(confirmMsg)) return;

        try {
            await batch.commit();
            alert(`অভিনন্দন! সফলভাবে ${totalSoldSuccessfully} টি ${ticker} শেয়ার বিক্রয় রেকর্ড করা হয়েছে।`);

            sellTickerInput.value = "";
            sellHoldingsContainer.classList.add('hidden');
            if (sellDateInput) sellDateInput.value = getTodayDate();

            setTimeout(() => {
                location.reload();
            }, 500);
            
            if (auth.currentUser) {
                loadUnifiedStockTable(auth.currentUser.uid);
            }
        } catch (error) {
            console.error("সেল এক্সিকিউট করতে সমস্যা:", error);
            alert("দুঃখিত, কারিগরি ত্রুটির কারণে বিক্রি সম্পন্ন করা যায়নি।");
        }
    });
}

// ==========================================
// 📈 Stock Table এ কমিশন সহ Realized/Unrealized দেখানো
// ==========================================

// loadUnifiedStockTable ফাংশনের ভিতরে প্রফিট/লস ক্যালকুলেশন অংশটি আপডেট করুন
// (বিদ্যমান ফাংশনে পরিবর্তন করার জন্য গাইড)

// যখন stock table এ unrealized return দেখানো হবে, সেটা ইতিমধ্যে কমিশন সহ calculated
// কারণ calculateAndUpdatePortfolioValues ফাংশনে totalInvestment এ কমিশন যোগ করা হয়েছে
// ==========================================
// 📊 পোর্টফোলিও ভ্যালু হিস্টোরি (প্রতিদিনের ডাটা) - সম্পূর্ণ নতুন ভার্সন
// ==========================================

let historyChartInstance = null;
let currentHistoryMode = 'firebase';
let currentHistoryData = [];

async function loadPortfolioHistory() {
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) {
        console.log('History table body not found');
        return;
    }
    
    tableBody.innerHTML = `<table><td colspan="6" style="text-align: center; padding: 40px;">Loading history data...<\/td><\/tr>`;
    
    try {
        console.log('📊 Loading portfolio history...');
        
        const portfolioSnapshot = await db.collection('portfolios').where('userId', '==', user.uid).get();
        const salesSnapshot = await db.collection('sales_history').where('userId', '==', user.uid).get();
        
        if (portfolioSnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px;">No transactions found. Start buying shares!<\/td><\/tr>`;
            return;
        }
        
        const buyLots = [];
        portfolioSnapshot.forEach(doc => {
            const data = doc.data();
            const totalCostWithCommission = (data.quantity * data.buyPrice) + (data.commission || 0);
            
            let perUnitCost = totalCostWithCommission / data.quantity;
            if (isNaN(perUnitCost) || !isFinite(perUnitCost)) {
                perUnitCost = data.buyPrice;
            }
            
            // ✅ সঠিকভাবে তারিখ পার্সিং
            let buyDate = null;
            if (data.date) {
                if (typeof data.date.toDate === 'function') {
                    buyDate = data.date.toDate();
                } else if (data.date instanceof Date) {
                    buyDate = data.date;
                } else if (typeof data.date === 'string') {
                    buyDate = new Date(data.date);
                } else if (data.date.seconds) {
                    buyDate = new Date(data.date.seconds * 1000);
                }
            }
            
            if (!buyDate || isNaN(buyDate.getTime())) {
                buyDate = new Date();
            }
            
            // 🔥 ডিবাগ: প্রতিটি লটের তারিখ দেখান
            console.log(`Lot: ${data.shareName}, Date: ${buyDate.toISOString().split('T')[0]}`);
            
            buyLots.push({
                ticker: data.shareName,
                qty: data.quantity,
                buyPrice: data.buyPrice,
                totalCostWithCommission: totalCostWithCommission,
                perUnitCost: perUnitCost,
                date: buyDate,
                buyDateStr: buyDate.toISOString().split('T')[0]
            });
        });
        
        console.log('Buy lots count:', buyLots.length);
        
        // ✅ সবচেয়ে পুরনো কেনার তারিখ বের করুন
        let firstBuyDate = new Date(buyLots[0].date);
        for (const lot of buyLots) {
            if (lot.date < firstBuyDate) {
                firstBuyDate = lot.date;
            }
        }
        
        console.log('First buy date (earliest):', firstBuyDate);
        
        const totalSoldMap = new Map();
        salesSnapshot.forEach(doc => {
            const data = doc.data();
            totalSoldMap.set(data.shareName, (totalSoldMap.get(data.shareName) || 0) + data.quantitySold);
        });
        
        buyLots.sort((a, b) => a.date - b.date);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // ✅ সঠিক ডে পার্থক্য ক্যালকুলেশন
        let daysDiff = Math.ceil((today - firstBuyDate) / (1000 * 60 * 60 * 24));
        
        // 🔥 ফিক্স: যদি একই দিন হয়, অন্তত 1 দিন দেখান
        if (daysDiff < 1) {
            daysDiff = 1;
        }
        
        const maxDays = 365;
        const finalDays = Math.min(daysDiff, maxDays);
        
        console.log(`First buy: ${firstBuyDate.toISOString().split('T')[0]}, Today: ${today.toISOString().split('T')[0]}, Days: ${finalDays}`);
        
        const allDates = [];
        for (let i = 0; i <= finalDays; i++) {
            const date = new Date(firstBuyDate);
            date.setDate(firstBuyDate.getDate() + i);
            allDates.push(date);
        }
        
        console.log(`Total dates to process: ${allDates.length}`);
        
        const dailyPortfolio = [];
        let cumulativeLots = [];
        
        for (let idx = 0; idx < allDates.length; idx++) {
            const currentDate = allDates[idx];
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // এই তারিখ পর্যন্ত কেনা লট যোগ করা
            for (const lot of buyLots) {
                const lotDate = new Date(lot.date);
                lotDate.setHours(0, 0, 0, 0);
                if (lotDate <= currentDate && !lot.added) {
                    cumulativeLots.push({
                        ...lot,
                        remainingQty: lot.qty,
                        added: true
                    });
                    lot.added = true;
                }
            }
            
            const tempSoldMap = new Map();
            for (const [ticker, sold] of totalSoldMap) {
                tempSoldMap.set(ticker, sold);
            }
            
            let tempLots = cumulativeLots.map(lot => ({
                ...lot,
                remainingQty: lot.remainingQty
            }));
            
            for (const lot of tempLots) {
                let toSell = tempSoldMap.get(lot.ticker) || 0;
                if (toSell > 0 && lot.remainingQty > 0) {
                    const sellFromThisLot = Math.min(lot.remainingQty, toSell);
                    lot.remainingQty -= sellFromThisLot;
                    toSell -= sellFromThisLot;
                    tempSoldMap.set(lot.ticker, toSell);
                }
            }
            
            let totalInvestment = 0;
            let remainingStocks = [];
            
            for (const lot of tempLots) {
                if (lot.remainingQty > 0 && lot.perUnitCost > 0 && isFinite(lot.perUnitCost)) {
                    const lotCost = lot.remainingQty * lot.perUnitCost;
                    totalInvestment += lotCost;
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
                        const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${stock.ticker}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data && data.ltp) {
                                currentPrice = data.ltp;
                            }
                        }
                    } catch (err) {}
                }
                
                if (currentPrice === 0) {
                    try {
                        const historicalPrice = await firebaseDataManager.getPriceByDate(stock.ticker, dateStr);
                        if (historicalPrice && historicalPrice > 0) {
                            currentPrice = historicalPrice;
                        } else {
                            currentPrice = stock.avgCost;
                        }
                    } catch (err) {
                        currentPrice = stock.avgCost;
                    }
                }
                
                if (isNaN(currentPrice) || !isFinite(currentPrice)) {
                    currentPrice = stock.avgCost;
                }
                
                totalCurrentValue += stock.qty * currentPrice;
            }
            
            const dailyPL = totalCurrentValue - totalInvestment;
            const dailyPLPercent = totalInvestment > 0 ? (dailyPL / totalInvestment) * 100 : 0;
            
            if (totalInvestment > 0 && isFinite(totalInvestment)) {
                dailyPortfolio.push({
                    date: dateStr,
                    totalInvestment: totalInvestment,
                    totalCurrentValue: totalCurrentValue,
                    dailyPL: dailyPL,
                    dailyPLPercent: dailyPLPercent
                });
            }
        }
        
        console.log(`✅ Calculated ${dailyPortfolio.length} days with data`);
        
        const startDateInput = document.getElementById('history-start-date');
        const endDateInput = document.getElementById('history-end-date');
        
        let filteredData = [...dailyPortfolio];
        
        if (startDateInput && startDateInput.value) {
            filteredData = filteredData.filter(item => item.date >= startDateInput.value);
        }
        if (endDateInput && endDateInput.value) {
            filteredData = filteredData.filter(item => item.date <= endDateInput.value);
        }
        
        currentHistoryData = filteredData;
        renderHistoryTable(filteredData);
        renderHistoryChart(filteredData);
        
        console.log(`✅ Portfolio history loaded: ${filteredData.length} days displayed`);
        
    } catch (error) {
        console.error('Error loading portfolio history:', error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">Error loading data: ${error.message}<\/td><\/tr>`;
    }
}

function renderHistoryTable(data) {
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;
    
    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px;">No data available for selected date range.<\/td><\/tr>`;
        // ফুটার রিসেট
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
    
    let html = '';
    let totalInvestment = 0;
    let totalCurrentValue = 0;
    
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const plClass = item.dailyPL >= 0 ? 'positive-pl' : 'negative-pl';
        const plPctClass = item.dailyPLPercent >= 0 ? 'positive-pl' : 'negative-pl';
        
        totalInvestment += item.totalInvestment;
        totalCurrentValue += item.totalCurrentValue;
        
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px; font-weight: 500;">${formatDate(item.date)}</td>
                <td style="padding: 12px; text-align: right;">৳${item.totalInvestment.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}</td>
                <td style="padding: 12px; text-align: right;">৳${item.totalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}</td>
                <td style="padding: 12px; text-align: right;" class="${plClass}">${item.dailyPL >= 0 ? '+' : ''}৳${item.dailyPL.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}</td>
                <td style="padding: 12px; text-align: right;" class="${plPctClass}">${item.dailyPLPercent >= 0 ? '+' : ''}${item.dailyPLPercent.toFixed(2)}%</td>
                <td style="padding: 12px; text-align: center;">${item.dailyPL >= 0 ? '✅' : '📉'}</td>
            </tr>
        `;
    }
    
    tableBody.innerHTML = html;
    
    // ফুটার আপডেট
    const finalPL = totalCurrentValue - totalInvestment;
    const finalPLPct = totalInvestment > 0 ? (finalPL / totalInvestment) * 100 : 0;
    
    const footerInvest = document.getElementById('history-footer-invest');
    const footerValue = document.getElementById('history-footer-value');
    const footerPL = document.getElementById('history-footer-pl');
    const footerPLPct = document.getElementById('history-footer-plpct');
    
    if (footerInvest) footerInvest.innerHTML = `৳${totalInvestment.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    if (footerValue) footerValue.innerHTML = `৳${totalCurrentValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    if (footerPL) {
        footerPL.innerHTML = `${finalPL >= 0 ? '+' : ''}৳${finalPL.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        footerPL.style.color = finalPL >= 0 ? '#10b981' : '#ef4444';
    }
    if (footerPLPct) {
        footerPLPct.innerHTML = `${finalPLPct >= 0 ? '+' : ''}${finalPLPct.toFixed(2)}%`;
        footerPLPct.style.color = finalPLPct >= 0 ? '#10b981' : '#ef4444';
    }
}

function renderHistoryChart(data) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;
    
    if (historyChartInstance) {
        historyChartInstance.destroy();
        historyChartInstance = null;
    }
    
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
            labels: labels,
            datasets: [
                {
                    label: 'Total Investment',
                    data: investData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    tension: 0.2,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'Current Value',
                    data: valueData,
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    tension: 0.2,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { 
                        color: textColor,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ৳${context.raw.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { 
                        color: textColor, 
                        maxRotation: 45,
                        font: { size: 10 }
                    },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { 
                        color: textColor,
                        callback: function(value) {
                            return '৳' + value.toLocaleString();
                        }
                    },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

function filterHistoryByDate() {
    console.log('📅 Filtering by date...');
    loadPortfolioHistory();
}

function resetHistoryFilter() {
    console.log('🔄 Resetting date filter...');
    const startInput = document.getElementById('history-start-date');
    const endInput = document.getElementById('history-end-date');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    loadPortfolioHistory();
}

function setHistoryMode(mode) {
    console.log(`🔘 Switching history mode to: ${mode}`);
    currentHistoryMode = mode;
    const firebaseBtn = document.getElementById('history-firebase-mode');
    const liveBtn = document.getElementById('history-live-mode');
    
    if (firebaseBtn && liveBtn) {
        if (mode === 'firebase') {
            firebaseBtn.classList.add('active');
            firebaseBtn.style.background = '#10b981';
            liveBtn.classList.remove('active');
            liveBtn.style.background = '#64748b';
        } else {
            liveBtn.classList.add('active');
            liveBtn.style.background = '#10b981';
            firebaseBtn.classList.remove('active');
            firebaseBtn.style.background = '#64748b';
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
// 🆕 ড্যাশবোর্ডের কার্ড আপডেট (Portfolio Analysis এর ভ্যালু দিয়ে)
// ==========================================

function updateDashboardCardsFromAnalysis(totalCost, totalValue, dailyGL, totalGL) {
    // Card 1: Total Value
    const valueElem = document.getElementById('dash-total-value');
    if (valueElem) {
        valueElem.innerHTML = `৳${totalValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    }
    
    // Card 2: Total Investment
    const costElem = document.getElementById('dash-total-cost');
    if (costElem) {
        costElem.innerHTML = `৳${totalCost.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
    }
    
    // Card 3: Daily P/L (টাকা + %)
    const dailyElem = document.getElementById('dash-total-daily');
    const dailyPctElem = document.getElementById('dash-total-daily-pct');
    
    if (dailyElem) {
        const dailyFormatted = dailyGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 });
        dailyElem.innerHTML = `${dailyGL >= 0 ? '+' : ''}৳${dailyFormatted}`;
        dailyElem.style.color = dailyGL >= 0 ? '#90ffb0' : '#ffaaaa';
    }
    
    if (dailyPctElem && totalCost > 0) {
        const dailyPercent = (dailyGL / totalCost) * 100;
        dailyPctElem.innerHTML = `${dailyPercent >= 0 ? '+' : ''}${dailyPercent.toFixed(2)}%`;
        dailyPctElem.style.color = dailyPercent >= 0 ? '#90ffb0' : '#ffaaaa';
    } else if (dailyPctElem) {
        dailyPctElem.innerHTML = '(0.00%)';
    }
    
    // Card 4: Total P/L (টাকা + %)
    const totalElem = document.getElementById('dash-total-gl');
    const totalPctElem = document.getElementById('dash-total-gl-pct');
    
    if (totalElem) {
        const totalFormatted = totalGL.toLocaleString('bn-BD', { minimumFractionDigits: 2 });
        totalElem.innerHTML = `${totalGL >= 0 ? '+' : ''}৳${totalFormatted}`;
        totalElem.style.color = totalGL >= 0 ? '#90ffb0' : '#ffaaaa';
    }
    
    if (totalPctElem && totalCost > 0) {
        const totalPercent = (totalGL / totalCost) * 100;
        totalPctElem.innerHTML = `${totalPercent >= 0 ? '+' : ''}${totalPercent.toFixed(2)}%`;
        totalPctElem.style.color = totalPercent >= 0 ? '#90ffb0' : '#ffaaaa';
    } else if (totalPctElem) {
        totalPctElem.innerHTML = '(0.00%)';
    }
    
    console.log(`📊 Dashboard updated from Portfolio Analysis: Value=${totalValue.toFixed(2)}, Cost=${totalCost.toFixed(2)}, Daily=${dailyGL.toFixed(2)}, Total=${totalGL.toFixed(2)}`);
}
// ==========================================
// 🚀 ফ্লোটিং লোডিং ইন্ডিকেটর - শতকরা (%) সহ
// ==========================================

// ==========================================
// 🚀 ফ্লোটিং লোডিং ইন্ডিকেটর - শতকরা (%) সহ
// ==========================================

class LoadingIndicator {
    constructor() {
        this.loaderDiv = document.getElementById('floating-loader');
        this.overlay = document.getElementById('loader-overlay');
        this.percentElem = document.getElementById('loader-percent');
        this.statusTextElem = document.getElementById('loader-status-text');
        this.subTextElem = document.getElementById('loader-sub-text');
        this.progressCircle = document.getElementById('loader-progress-circle');
        this.currentPercent = 0;
        this.currentStep = '';
    }
    
    show() {
        if (this.loaderDiv) {
            this.loaderDiv.style.display = 'flex';
            this.overlay.style.display = 'block';
            this.currentPercent = 0;
            this.updatePercent(0);
        }
    }
    
    hide() {
        if (this.loaderDiv) {
            this.loaderDiv.style.display = 'none';
            this.overlay.style.display = 'none';
        }
    }
    
    updatePercent(percent, statusText, subText) {
        if (!this.loaderDiv || this.loaderDiv.style.display !== 'flex') return;
        
        this.currentPercent = Math.min(Math.max(percent, 0), 100);
        
        if (this.percentElem) {
            this.percentElem.innerText = `${Math.floor(this.currentPercent)}%`;
        }
        
        const circumference = 219.9;
        const offset = circumference - (this.currentPercent / 100) * circumference;
        if (this.progressCircle) {
            this.progressCircle.style.strokeDashoffset = offset;
            if (this.currentPercent < 50) {
                this.progressCircle.style.stroke = '#ef4444';
            } else if (this.currentPercent < 80) {
                this.progressCircle.style.stroke = '#f59e0b';
            } else {
                this.progressCircle.style.stroke = '#10b981';
            }
        }
        
        if (statusText && this.statusTextElem) {
            this.statusTextElem.innerHTML = statusText;
        }
        
        if (subText && this.subTextElem) {
            this.subTextElem.innerHTML = subText;
        }
    }
    
    updateStep(step, percent) {
        this.currentStep = step;
        const steps = {
            'firebase': { status: '📦 Loading from Firebase...', sub: 'Fetching cached stock prices', percent: 20 },
            'api': { status: '📡 Fetching from Live API...', sub: 'Getting real-time market data', percent: 40 },
            'portfolio': { status: '📊 Processing portfolio...', sub: 'Calculating buy/sell lots', percent: 60 },
            'analysis': { status: '📈 Generating analysis...', sub: 'Preparing portfolio insights', percent: 80 },
            'complete': { status: '✅ Done!', sub: 'Portfolio loaded successfully', percent: 100 }
        };
        
        const stepData = steps[step] || steps.firebase;
        this.updatePercent(stepData.percent, stepData.status, stepData.sub);
    }
}

// গ্লোবাল ইন্সট্যান্স
const loadingIndicator = new LoadingIndicator();

// ==========================================
// 🔄 loadDashboardData ফাংশন (শুধু একবার ডিক্লেয়ার)
// ==========================================

async function loadDashboardData() {
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        return false;
    }
    
    loadingIndicator.show();
    loadingIndicator.updateStep('firebase', 20);
    
    try {
        let priceMap;
        
        if (currentDataMode === 'firebase') {
            console.log('📦 Loading from Firebase...');
            loadingIndicator.updatePercent(30, '📦 Loading from Firebase...', 'Fetching cached stock prices');
            
            priceMap = await firebaseDataManager.loadLatestPrices();
            
            if (priceMap && priceMap.size > 0) {
                currentPriceData = priceMap;
                await updateDataStatusIndicator('firebase', firebaseDataManager.getDataStatus());
                console.log(`✅ Dashboard loaded from Firebase: ${priceMap.size} stocks`);
            } else {
                console.log('⚠️ No Firebase data, falling back to API...');
                loadingIndicator.updatePercent(40, '📡 Switching to Live API...', 'No cached data found');
                currentDataMode = 'live';
                priceMap = await loadFromAPI(user);
                updateDataStatusIndicator('live', { source: 'api', lastUpdate: new Date().toISOString() });
            }
        } else {
            console.log('📡 Loading from Live API...');
            loadingIndicator.updatePercent(40, '📡 Loading from Live API...', 'Getting real-time market data');
            priceMap = await loadFromAPI(user);
            updateDataStatusIndicator('live', { source: 'api', lastUpdate: new Date().toISOString() });
        }
        
        if (priceMap && priceMap.size > 0) {
            loadingIndicator.updatePercent(60, '📊 Calculating portfolio...', 'Processing buy/sell lots');
            await calculateAndUpdatePortfolioValues(priceMap);
            
            loadingIndicator.updatePercent(80, '📈 Generating analysis...', 'Preparing portfolio insights');
            
            const analysisSection = document.getElementById('sec-portfolio-analysis');
            if (analysisSection && !analysisSection.classList.contains('hidden') && auth.currentUser) {
                console.log('🔄 Syncing Portfolio Analysis with Dashboard data...');
                setTimeout(() => {
                    loadPortfolioAnalysisTable(auth.currentUser.uid);
                }, 100);
            }
            
            loadingIndicator.updatePercent(100, '✅ Done!', 'Portfolio loaded successfully');
            
            setTimeout(() => {
                loadingIndicator.hide();
            }, 500);
            
            lastDataLoadTime = new Date();
            return true;
        }
        
        loadingIndicator.hide();
        return false;
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        loadingIndicator.updatePercent(100, '❌ Error!', 'Failed to load portfolio data');
        setTimeout(() => {
            loadingIndicator.hide();
        }, 1000);
        return false;
    }
}

console.log('✅ loadDashboardData initialized successfully');