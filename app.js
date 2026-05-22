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
auth.onAuthStateChanged((user) => {
    if (user) {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        loadUnifiedStockTable(user.uid); 
        loadPortfolioAnalysisTable(user.uid); 
    } else {
        loginContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
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

        try {
            await db.collection("portfolios").add({
                userId: user.uid,        
                shareName: shareName,    
                quantity: Number(quantity),
                buyPrice: Number(price),
                type: "BUY",
                date: new Date()
            });

            alert(`${shareName} শেয়ারটি সফলভাবে পোর্টফোলিওতে যোগ হয়েছে!`);
            tickerInput.value = "";
            document.getElementById('trade-qty').value = "";
            priceInput.value = "";

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
                    position: 'top'
                }
            },
            scales: { 
                x: { ticks: { font: { size: 9 } } }, 
                y: { ticks: { font: { size: 9 } } } 
            } 
        }
    });
}

function loadUnifiedStockTable(userId) { 
  // ✅ এরর হ্যান্ডলিং যোগ করুন
    if (!userId) {
        console.error("User ID is required");
        return;
    }
    
    const tableBody = document.getElementById('portfolio-table-body');
    if(!tableBody) {
        console.error("Portfolio table body not found");
        return;
    }
    db.collection("portfolios").where("userId", "==", userId)
    .onSnapshot((portfolioSnapshot) => {
        db.collection("sales_history").where("userId", "==", userId)
        .onSnapshot(async (salesSnapshot) => {
            
            const tableBody = document.getElementById('portfolio-table-body');
            if(!tableBody) return;
            tableBody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>Loading combined statement data...</td></tr>";

            let mergedPortfolio = {};
            let chartLots = [];

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
            const pricePromises = tickers.map(async (ticker) => {
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

            const priceResults = await Promise.all(pricePromises);
            const priceMap = {};
            priceResults.forEach(res => { priceMap[res.ticker] = res.price; });

            let totalInvestment = 0;
            let totalCurrentValue = 0;
            let totalUnrealized = 0;
            let totalRealized = 0;
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

                const displayBuyQty = item.buyQty > 0 ? item.buyQty : "-";
                const displayRemQty = remainingQty > 0 ? remainingQty : "-";
                const displayLivePrice = remainingQty > 0 ? `৳${currentPrice.toFixed(2)}` : "-";
                const displayUnrealized = remainingQty > 0 ? `৳${unrealizedReturn.toFixed(2)}` : "-";
                const displaySellQty = item.sellQty > 0 ? item.sellQty : "-";
                const displaySellPrice = item.sellQty > 0 ? `৳${avgSellPrice.toFixed(2)}` : "-";
                const displayRealized = item.sellQty > 0 ? `৳${item.realizedProfit.toFixed(2)}` : "-";

                rowsHtml += `
                    <tr style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'" onclick="navigateToAnalysis('${item.shareName}')" title="Click to view Analysis Stat">
                        <td class="${nameClass}"><b>${item.shareName}</b>${nameSuffix}</td>
                        <td>${displayBuyQty}</td>
                        <td>৳${avgBuyPrice.toFixed(2)}</td>
                        <td style="color:#007bff; font-weight:bold;">${displayRemQty}</td>
                        <td>${displayLivePrice}</td>
                        <td class="${remainingQty > 0 ? unresClass : ''}">${displayUnrealized}</td>
                        <td>${displaySellQty}</td>
                        <td>${displaySellPrice}</td>
                        <td class="${item.sellQty > 0 ? resClass : ''}">${displayRealized}</td>
                    </tr>
                `;
                
                chartLots.forEach(lot => {
                    if(ticker === lot.ticker) {
                        let lotOriginalQty = lot.totalCost / avgBuyPrice;
                        lot.currentValue = lotOriginalQty * currentPrice;
                    }
                });
            }

            tableBody.innerHTML = rowsHtml || "<tr><td colspan='9' style='text-align:center;'>No trade history found.</td></tr>";

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
            if(footUnrealized) {
                footUnrealized.innerText = `৳${totalUnrealized.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
                footUnrealized.style.color = totalUnrealized >= 0 ? '#10b981' : '#ef4444';
            }
            if(footRealized) {
                footRealized.innerText = `৳${totalRealized.toLocaleString('bn-BD', {minimumFractionDigits: 2})}`;
                footRealized.style.color = totalRealized >= 0 ? '#10b981' : '#ef4444';
            }

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
        });
    });
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

async function fetchLivePriceForBuy(ticker) {
    try {
        const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.ltp) { priceInput.value = data.ltp; return; }
        }
    } catch (e) { console.error(e); }
    priceInput.value = getHardcodedPrice(ticker);
}

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
                        date: new Date()
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
            alert(`অভিনন্দন! সফলভাবে ${totalSoldSuccessfully} টি ${ticker} শেয়ার বিক্রয় রেকর্ড করা হয়েছে।`);
            
            // রিসেট এবং রিফ্রেশ লজিক
            sellTickerInput.value = "";
            sellHoldingsContainer.classList.add('hidden');
            
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
// ১১. DSE Stock List
// ==========================================
const dseStocks = [
"1JANATAMF", "1STPRIMFMF", "AAMRANET", "AAMRATECH", "ABB1STMF", "ABBANK", "ACFL", "ACI", "ACIFORMULA", "ACMELAB",
"ACTIVEFINE", "ADNTEL", "ADVENT", "AFCAGRO", "AFTABAUTO", "AGNISYSL", "AGRANINS", "AIBL1STIMF", "AIL", "AL-HAJTEX",
"ALARABANK", "ALIF", "ALLTEX", "AMANFEED", "AMBEEPHA", "ANLIMAYARN", "ANWARGALV", "APEXFOODS", "APEXFOOT", "APEXSPINN",
"APOLOISPAT", "ARAMIT", "ARAMITCEM", "ARGONDENIM", "ASIAPACINS", "ATCSLGF", "ATLASBANG", "AZIZPIPES", "BANGAS", "BANKASIA",
"BATASHOE", "BATBC", "BAYLEASING", "BBS", "BCC", "BDCOM", "BDFINANCE", "BDLAMPS", "BDTHAI", "BDTHAIFOOD",
"BDWELDING", "BEACHHATCH", "BEACONPHAR", "BENGALWTL", "BERGERPBL", "BEXGSUKUK", "BEXIMCO", "BGIC", "BIFC", "BNICL",
"BPML", "BPPL", "BRACBANK", "BSC", "BSCCL", "BSRMLTD", "BSRMSTEEL", "BXPHARMA", "CAPMBDBLMF", "CAPMIBBLMF",
"CENTRALINS", "CENTRALPHL", "CITYBANK", "CNATEX", "CONFIDCEM", "CONTININS", "COPPERTECH", "CROWNCEMNT", "CVOPRL", "DACCADYE",
"DAFODILCOM", "DBH", "DBH1STMF", "DELTALIFE", "DELTASPINN", "DESCO", "DESHBANDHU", "DHAKABANK", "DOMINAGE", "DOREENPWR",
"DSSL", "Dulamiacot", "DUTCHBANGL", "EASTLAND", "EASTRNLUB", "EBL", "EBL1STMF", "EBLNRBMF", "ECABLES", "EGEN",
"EMERALDOIL", "ENVOYTEX", "EPGL", "ESQUIRENIT", "ETL", "EXIM1STMF", "EXIMBANK", "FAMILYTEX", "FARCHEM", "FAREASTLIF", "FAREASTFIN",
"FASFIN", "FBFIF", "FEDERALINS", "FEKDIL", "FINEFOODS", "FIRSTFIN", "FIRSTSBANK", "FORTUNE", "FUWANGCER",
"FUWANGFOOD", "GBBPOWER", "GEMINISEA", "GENEXIL", "GENNEXT", "GHAIL", "GHCL", "GIB", "GLAXOSMITH", "GLOBALINS",
"GOLDENSON", "GP", "GPHISPAT", "GQBALLPEN", "GRAMEENS2", "GREENDELT", "HAKKANIPUL", "HEIDELBCEM", "HFL", "HRTEX",
"HWAWELLTEX", "IBNSINA", "IBP", "ICB", "ICB3RDNRB", "ICBAGRANI1", "ICBAMCL2ND", "ICBEPMF1S1", "IDLC", "IFADAUTOS",
"IFIC", "IFIC1STMF", "IFILISLMF1", "ILFSL", "INDEXAGRO", "INTECH", "INTRACO", "IPDC", "ISLAMIBANK", "ISLAMICFIN",
"ISNLTD", "ITC", " ICICL", "JAMUNABANK", "JAMUNAOIL", "JANATAINS", "JHRML", "JMISMDL", "JUTESPINN", "KARNAPHULI", "KAY&QUE",
"KBPPWBIL", "KDSALTD", "KEYACOSMET", "KPCL", "KPPL", "LANKABAFIN", "LEGACYFOOT", "LHBL", "LIBRAINFU", "LINDEBD",
"LOVELLO", "LRBDL", "MARICO", "MATINSPINN", "MBL1STMF", "MEGCONMILK", "MEGHNACEM", "MEGHNALIFE", "MEGHNAPET", "MERCANBANK",
"MERCINS", "METROSPIN", "MHSML", "MIDASFIN", "MIRACLEIND", "MIRAKHTER", "MONNOAGML", "MONNOCERA", "MONNOFABR", "MONOSPOOL",
"MPETROLEUM", "MTB", "NAHEEACP", "NATLIFEINS", "NAVANACNG", "NAVANAPHAR", "NBL", "NCCBANK", "NCCBLMF1", "NEWLINE",
"NITOLINS", "NORTHERN", "NORTHRNINS", "NPOLYMER", "NRBBANK", "NTLTUBES", "OAL", "OIMEX", "OLYMPIC", "ONEBANK",
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
    return prices[ticker] || 10.00; 
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
// 🚀 ১৬. Portfolio Analysis (Lot-Wise Expandable) লজিক
// ==========================================
function loadPortfolioAnalysisTable(userId) {
    if (!db) return;

    db.collection("portfolios").where("userId", "==", userId)
    .onSnapshot((portfolioSnapshot) => {
        db.collection("sales_history").where("userId", "==", userId)
        .onSnapshot(async (salesSnapshot) => {
            
            const listContainer = document.getElementById('bull-analysis-list');
            if (!listContainer) return;

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

            let finalHtml = "";
            let grandTotalCost = 0;
            let grandTotalCurrentValue = 0;
            let grandTotalDailyGL = 0;

            for (let ticker in rawPortfolio) {
                let lots = rawPortfolio[ticker].sort((a, b) => a.date - b.date);
                let totalSold = totalSoldQtyMap[ticker] || 0;

                let currentPrice = 0;
                let dailyChange = 0;
                let dailyChangePcnt = 0;

                try {
                    const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
                    if (response.ok) {
                        const stockData = await response.json();
                        if (stockData) {
                            if (stockData.ltp) currentPrice = Number(stockData.ltp);
                            if (stockData.change) dailyChange = Number(stockData.change);
                            if (stockData.changePcnt) dailyChangePcnt = Number(stockData.changePcnt);
                        }
                    }
                } catch (err) { console.error(err); }
                
                if (currentPrice === 0 && typeof getHardcodedPrice === "function") {
                    currentPrice = Number(getHardcodedPrice(ticker));
                }

                let activeLotsForDisplay = [];
                let totalRemainingQty = 0;
                let totalCost = 0;

                lots.forEach(lot => {
                    let remQtyInLot = lot.originalQty;
                    if (totalSold > 0) {
                        let taken = Math.min(remQtyInLot, totalSold);
                        remQtyInLot -= taken;
                        totalSold -= taken;
                    }

                    if (remQtyInLot > 0) {
                        totalRemainingQty += remQtyInLot;
                        totalCost += (remQtyInLot * lot.buyPrice);
                        
                        let lotCurrentValue = remQtyInLot * currentPrice;
                        let lotTotalGL = lotCurrentValue - (remQtyInLot * lot.buyPrice);
                        let lotDailyGL = remQtyInLot * dailyChange;

                        activeLotsForDisplay.push({
                            qty: remQtyInLot,
                            buyPrice: lot.buyPrice,
                            cost: remQtyInLot * lot.buyPrice,
                            currentValue: lotCurrentValue,
                            dailyGL: lotDailyGL,
                            totalGL: lotTotalGL,
                            totalGLPcnt: ((currentPrice - lot.buyPrice) / lot.buyPrice) * 100
                        });
                    }
                });

                if (totalRemainingQty === 0) continue;

                let avgBuyPrice = totalCost / totalRemainingQty;
                let currentLiveValue = totalRemainingQty * currentPrice;
                let totalGL = currentLiveValue - totalCost;
                let totalGLPcnt = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;
                let totalStockDailyGL = totalRemainingQty * dailyChange;
                let totalStockDailyPcnt = currentPrice > 0 ? (dailyChange / (currentPrice - dailyChange)) * 100 : 0;

                grandTotalCost += totalCost;
                grandTotalCurrentValue += currentLiveValue;
                grandTotalDailyGL += totalStockDailyGL;

                const livePriceClass = dailyChange >= 0 ? "bull-profit" : "bull-loss";
                const dailyGlClass = totalStockDailyGL >= 0 ? "bull-profit" : "bull-loss";
                const totalGlClass = totalGL >= 0 ? "bull-profit" : "bull-loss";

                const blockId = `block-${ticker.replace(/[^a-zA-Z0-9]/g, '')}`;

                finalHtml += `
                    <div class="stock-block" id="parent-${blockId}">
                        <div class="stock-main-row" onclick="toggleBullLot('${blockId}'); openStockDetailModal('${ticker}');">
                            <div class="bull-col-code">
                                <div class="ticker-title" style="color: #2563eb; text-decoration: underline; cursor: pointer;">${ticker}</div>
                                <div class="${livePriceClass}" style="font-weight:600; margin-top:2px;">
                                    ${currentPrice.toFixed(2)} <span style="font-size:11px;">(${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)})</span>
                                </div>
                                <div style="color: #64748b; font-size:12px; margin-top:3px;">
                                    ${avgBuyPrice.toFixed(2)} x ${totalRemainingQty} shares
                                </div>
                                <span class="toggle-text" id="btn-${blockId}">+ Show All</span>
                            </div>

                            <div class="bull-col-value" style="font-size:12px; font-weight:600; line-height: 1.4;">
                                <div style="color:#000;">${currentLiveValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                <div style="color:#64748b; font-weight:normal; margin-top:14px;">${totalCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            </div>

                            <div class="bull-col-daily ${dailyGlClass}" style="font-size:12px; font-weight:500; line-height: 1.4;">
                                <div>${totalStockDailyGL >= 0 ? '+' : ''}${totalStockDailyGL.toFixed(2)}</div>
                                <div style="font-size:11px; margin-top:14px;">${totalStockDailyPcnt >= 0 ? '+' : ''}${totalStockDailyPcnt.toFixed(2)}%</div>
                            </div>

                            <div class="bull-col-total ${totalGlClass}" style="font-size:12px; font-weight:600; line-height: 1.4;">
                                <div>${totalGL >= 0 ? '+' : ''}${totalGL.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                <div style="font-size:11px; margin-top:14px;">${totalGLPcnt >= 0 ? '+' : ''}${totalGLPcnt.toFixed(2)}%</div>
                            </div>
                        </div>

                        <div class="lot-rows-container" id="container-${blockId}" style="display:none;">
                `;

                activeLotsForDisplay.forEach((lot) => {
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
                                <div style="font-size:11px;">${dailyChangePcnt >= 0 ? '+' : ''}${dailyChangePcnt.toFixed(2)}%</div>
                            </div>
                            <div class="bull-col-total ${lotTotalClass}">
                                <div>${lot.totalGL >= 0 ? '+' : ''}${lot.totalGL.toFixed(2)}</div>
                                <div style="font-size:11px;">${lot.totalGLPcnt >= 0 ? '+' : ''}${lot.totalGLPcnt.toFixed(2)}%</div>
                            </div>
                        </div>
                    `;
                });

                finalHtml += `
                        </div>
                    </div>
                `;
            }

            listContainer.innerHTML = finalHtml || `<div style="text-align:center; padding: 20px; color: #94a3b8;">কোনো সক্রিয় শেয়ার পাওয়া যায়নি।</div>`;

            let grandTotalGL = grandTotalCurrentValue - grandTotalCost;
            let grandTotalGLPcnt = grandTotalCost > 0 ? (grandTotalGL / grandTotalCost) * 100 : 0;

            if(document.getElementById('bull-total-value')) document.getElementById('bull-total-value').innerText = grandTotalCurrentValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            if(document.getElementById('bull-total-cost')) document.getElementById('bull-total-cost').innerText = grandTotalCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            
            const dglElem = document.getElementById('bull-total-daily');
            if (dglElem) {
                dglElem.innerText = (grandTotalDailyGL >= 0 ? "+" : "") + grandTotalDailyGL.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                dglElem.className = "bull-col-daily " + (grandTotalDailyGL >= 0 ? "bull-profit" : "bull-loss");
            }

            const tglElem = document.getElementById('bull-total-gl');
            if (tglElem) {
                tglElem.innerText = (grandTotalGL >= 0 ? "+" : "") + grandTotalGL.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                tglElem.className = "bull-col-total " + (grandTotalGL >= 0 ? "bull-profit" : "bull-loss");
            }

            const tglPcntElem = document.getElementById('bull-total-gl-percentage');
            if (tglPcntElem) {
                tglPcntElem.innerText = (grandTotalGLPcnt >= 0 ? "+" : "") + grandTotalGLPcnt.toFixed(2) + "%";
                tglPcntElem.className = grandTotalGLPcnt >= 0 ? "bull-profit" : "bull-loss";
            }
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
window.openStockDetailModal = function(ticker) {
    viewStockDetail(ticker);
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
