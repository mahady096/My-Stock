// ==========================================
// 💰 dividend.js - Dividend Analysis
//    portfolio.js থেকে ভাগ করা (ফাইল ৪)
//    ডিভিডেন্ড অ্যাড/এডিট/ডিলিট
//
//    ✅ ফিক্স v3:
//    - Dividend Gain / Unrealized P/L calculation hardened
//    - ticker matching normalized (trim + uppercase)
//    - quantity / buy_price always converted to Number
//    - weighted average buy price calculated safely
//    - current-price loading made more defensive
//    - Dividend Gain and Unrealized P/L calculated independently
//    - existing Supabase/Firebase ownership protections preserved
// ==========================================
let currentEditingDividendId = null;

// ==========================================
// 🛡️ HTML attribute-এ নিরাপদে বসানোর জন্য escape হেল্পার
// ==========================================
function escapeHtmlDiv(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// 🔤 Ticker normalization
// ==========================================
function normalizeDividendTicker(value) {
    return String(value || '').trim().toUpperCase();
}

function toDividendNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

async function loadDividendData(portfolioId = null) {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) {
        const tb = document.getElementById('dividend-table-body');
        if (tb) tb.innerHTML = `<tr><td colspan="6">Please login</td></tr>`;
        return;
    }

    const tableBody = document.getElementById('dividend-table-body');
    if (!tableBody) return;

    try {
        let dividendRecords = [];

        // ---------- Supabase dividend records ----------
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                let query = supabase
                    .from('dividend_records')
                    .select('*')
                    .eq('user_id', user.uid);

                if (portfolioId) {
                    query = query.eq('portfolio_id', portfolioId);
                }

                const { data, error } = await query;

                if (!error && data) {
                    dividendRecords = data;
                }
            } catch (e) {
                console.warn(
                    'Supabase dividend fetch failed, trying Firebase...',
                    e
                );
            }
        }

        // ---------- Firebase dividend fallback ----------
        if (dividendRecords.length === 0 && typeof db !== 'undefined') {
            try {
                let query = db
                    .collection('dividend_records')
                    .where('userId', '==', user.uid);

                if (portfolioId) {
                    query = query.where('portfolioId', '==', portfolioId);
                }

                const snapshot = await query.get();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const parsedCreatedAt = safeParseDate(data.createdAt);
                    const parsedUpdatedAt = safeParseDate(data.updatedAt);

                    dividendRecords.push({
                        id: doc.id,
                        user_id: data.userId,
                        share_name: data.shareName,
                        stock_percent: data.stockPercent || 0,
                        cash_amount: data.cashAmount || 0,
                        portfolio_id: data.portfolioId || 'main',
                        created_at: parsedCreatedAt
                            ? parsedCreatedAt.toISOString()
                            : null,
                        updated_at: parsedUpdatedAt
                            ? parsedUpdatedAt.toISOString()
                            : null
                    });
                });
            } catch (e) {
                console.warn('Firebase dividend fetch failed', e);
            }
        }

        if (dividendRecords.length === 0) {
            tableBody.innerHTML =
                `<tr><td colspan="6">No dividend records found.</td></tr>`;
            return;
        }

        // ==========================================
        // 📦 Load portfolio holdings
        // ==========================================
        let portfolioData = [];

        if (typeof supabase !== 'undefined' && supabase) {
            try {
                let query = supabase
                    .from('portfolios')
                    .select('share_name, quantity, buy_price, portfolio_id')
                    .eq('user_id', user.uid);

                if (portfolioId) {
                    query = query.eq('portfolio_id', portfolioId);
                }

                const { data, error } = await query;

                if (!error && data) {
                    portfolioData = data;
                }
            } catch (e) {
                console.warn('Supabase portfolio fetch failed', e);
            }
        }

        // ---------- Firebase portfolio fallback ----------
        if (portfolioData.length === 0 && typeof db !== 'undefined') {
            try {
                let query = db
                    .collection('portfolios')
                    .where('userId', '==', user.uid);

                if (portfolioId) {
                    query = query.where('portfolioId', '==', portfolioId);
                }

                const snap = await query.get();

                snap.forEach(doc => {
                    const data = doc.data();

                    portfolioData.push({
                        share_name: data.shareName,
                        quantity: data.quantity,
                        buy_price: data.buyPrice || 0,
                        portfolio_id: data.portfolioId || 'main'
                    });
                });
            } catch (e) {
                console.warn('Firebase portfolio fallback failed', e);
            }
        }

        // ==========================================
        // 📊 Build normalized holdings map
        // ==========================================
        const remainingQtyMap = new Map();

        portfolioData.forEach(item => {
            const ticker = normalizeDividendTicker(item.share_name);
            const qty = toDividendNumber(item.quantity);

            if (!ticker || qty <= 0) return;

            remainingQtyMap.set(
                ticker,
                (remainingQtyMap.get(ticker) || 0) + qty
            );
        });

        // ==========================================
        // 📈 Refresh current market prices
        // ==========================================
        const dividendTickers = [...remainingQtyMap.keys()];

        if (
            dividendTickers.length > 0 &&
            typeof getLatestAndPreviousPrices === 'function'
        ) {
            try {
                const latestPrices =
                    await getLatestAndPreviousPrices(dividendTickers);

                // The existing app normally returns a Map.
                // Support Map, plain object and array defensively.
                if (
                    latestPrices &&
                    typeof latestPrices.forEach === 'function'
                ) {
                    latestPrices.forEach((priceInfo, ticker) => {
                        const normalizedTicker =
                            normalizeDividendTicker(ticker);

                        const currentPrice = toDividendNumber(
                            priceInfo?.currentPrice ??
                            priceInfo?.ltp ??
                            priceInfo?.price
                        );

                        if (
                            normalizedTicker &&
                            currentPrice > 0 &&
                            typeof currentPriceData !== 'undefined'
                        ) {
                            currentPriceData.set(
                                normalizedTicker,
                                currentPrice
                            );

                            // Keep original key too for compatibility
                            currentPriceData.set(
                                ticker,
                                currentPrice
                            );
                        }
                    });
                } else if (
                    latestPrices &&
                    typeof latestPrices === 'object'
                ) {
                    Object.entries(latestPrices).forEach(
                        ([ticker, priceInfo]) => {
                            const normalizedTicker =
                                normalizeDividendTicker(ticker);

                            const currentPrice = toDividendNumber(
                                priceInfo?.currentPrice ??
                                priceInfo?.ltp ??
                                priceInfo?.price ??
                                priceInfo
                            );

                            if (
                                normalizedTicker &&
                                currentPrice > 0 &&
                                typeof currentPriceData !== 'undefined'
                            ) {
                                currentPriceData.set(
                                    normalizedTicker,
                                    currentPrice
                                );
                            }
                        }
                    );
                }
            } catch (e) {
                console.warn(
                    'Dividend current-price refresh failed',
                    e
                );
            }
        }

        // ==========================================
        // 🧮 Render dividend calculations
        // ==========================================
        let html = '';

        for (const rec of dividendRecords) {
            const ticker =
                normalizeDividendTicker(rec.share_name);

            const stockPercent =
                toDividendNumber(rec.stock_percent);

            const cashAmount =
                toDividendNumber(rec.cash_amount);

            const docId = rec.id;

            // Current holding quantity
            const remainingQty =
                toDividendNumber(
                    remainingQtyMap.get(ticker)
                );

            // ==========================================
            // 💵 Weighted average buy price
            // ==========================================
            let totalCost = 0;
            let totalQty = 0;

            const portfolioItems = portfolioData.filter(
                p =>
                    normalizeDividendTicker(p.share_name) ===
                    ticker
            );

            portfolioItems.forEach(p => {
                const qty =
                    toDividendNumber(p.quantity);

                const buyPrice =
                    toDividendNumber(p.buy_price);

                if (qty > 0 && buyPrice > 0) {
                    totalQty += qty;
                    totalCost += qty * buyPrice;
                }
            });

            const avgBuyPrice =
                totalQty > 0
                    ? totalCost / totalQty
                    : 0;

            // ==========================================
            // 💰 Dividend Gain
            // ==========================================
            let stockDividendGain = 0;
            let cashDividendGain = 0;
            let totalDividendGain = 0;

            // Dividend Gain must NOT depend on current price.
            // It only needs quantity + dividend inputs.
            if (remainingQty > 0) {
                if (
                    stockPercent > 0 &&
                    avgBuyPrice > 0
                ) {
                    stockDividendGain =
                        remainingQty *
                        (stockPercent / 100) *
                        avgBuyPrice;
                }

                // Existing StockPulse convention:
                // cashAmount is a percentage based on Tk.10 face value.
                if (cashAmount > 0) {
                    cashDividendGain =
                        remainingQty *
                        (cashAmount / 10);
                }

                totalDividendGain =
                    stockDividendGain +
                    cashDividendGain;
            }

            // ==========================================
            // 📈 Unrealized P/L
            // ==========================================
            let currentPrice = 0;

            if (
                typeof currentPriceData !== 'undefined' &&
                currentPriceData
            ) {
                currentPrice =
                    toDividendNumber(
                        currentPriceData.get(ticker)
                    );

                // Compatibility fallback if the map still
                // contains the original ticker casing.
                if (currentPrice <= 0) {
                    currentPrice =
                        toDividendNumber(
                            currentPriceData.get(
                                rec.share_name
                            )
                        );
                }
            }

            let unrealizedGain = 0;

            if (
                remainingQty > 0 &&
                avgBuyPrice > 0 &&
                currentPrice > 0
            ) {
                unrealizedGain =
                    (currentPrice - avgBuyPrice) *
                    remainingQty;
            }

            // ==========================================
            // 🛡️ Safe HTML values
            // ==========================================
            const safeDocId =
                escapeHtmlDiv(docId);

            const safeTicker =
                escapeHtmlDiv(ticker);

            const safeStockPercent =
                stockPercent.toFixed(2);

            const safeCashAmount =
                cashAmount.toFixed(2);

            // ==========================================
            // 🖥️ Table row
            // ==========================================
            html += `
                <tr onclick="openDividendEditModal(
                    '${safeDocId}',
                    '${safeTicker}',
                    ${stockPercent},
                    ${cashAmount}
                )">
                    <td>
                        <b>${safeTicker}</b>
                    </td>

                    <td>
                        ${safeStockPercent}%
                    </td>

                    <td>
                        ৳${safeCashAmount}
                    </td>

                    <td>
                        ${
                            remainingQty > 0
                                ? `৳${totalDividendGain.toFixed(2)}`
                                : '-'
                        }
                    </td>

                    <td>
                        ${
                            remainingQty > 0 &&
                            avgBuyPrice > 0 &&
                            currentPrice > 0
                                ? `৳${unrealizedGain.toFixed(2)}`
                                : '-'
                        }
                    </td>

                    <td>
                        <button
                            onclick="deleteDividendRecord(
                                '${safeDocId}',
                                event
                            )"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }

        tableBody.innerHTML = html;

    } catch (error) {
        console.error('Dividend calculation error:', error);

        tableBody.innerHTML =
            `<tr><td colspan="6">Error loading data</td></tr>`;
    }
}

// ==========================================
// 🗑️ Delete
//    ✅ user_id ownership চেক
// ==========================================
window.deleteDividendRecord = async function(docId, event) {
    event.stopPropagation();

    if (!confirm('Delete?')) return;

    const user =
        auth && auth.currentUser
            ? auth.currentUser
            : null;

    if (!user) {
        if (typeof showToast === 'function') {
            showToast(
                'Please login first',
                'error'
            );
        }
        return;
    }

    try {
        let deleted = false;

        // ---------- Supabase ----------
        if (
            typeof supabase !== 'undefined' &&
            supabase
        ) {
            const { error, data } =
                await supabase
                    .from('dividend_records')
                    .delete()
                    .eq('id', docId)
                    .eq('user_id', user.uid)
                    .select();

            if (
                !error &&
                data &&
                data.length > 0
            ) {
                deleted = true;
            }
        }

        // ---------- Firebase ----------
        if (typeof db !== 'undefined') {
            try {
                const docRef =
                    db.collection('dividend_records')
                        .doc(docId);

                const docSnap =
                    await docRef.get();

                if (
                    docSnap.exists &&
                    docSnap.data().userId === user.uid
                ) {
                    await docRef.delete();
                    deleted = true;
                } else if (docSnap.exists) {
                    console.warn(
                        '⚠️ Ownership mismatch — delete blocked client-side'
                    );
                }
            } catch (e) {
                console.warn(
                    'Firebase delete check failed',
                    e
                );
            }
        }

        if (deleted) {
            loadDividendData();

            if (typeof showToast === 'function') {
                showToast(
                    '🗑️ Deleted successfully!',
                    'info'
                );
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(
                    '❌ Delete failed or record not found',
                    'error'
                );
            }
        }
    } catch (e) {
        console.error(e);

        if (typeof showToast === 'function') {
            showToast(
                'Delete failed',
                'error'
            );
        }
    }
};

// ==========================================
// ✏️ Open edit modal
// ==========================================
window.openDividendEditModal =
    function(
        docId,
        ticker,
        stockPercent,
        cashAmount
    ) {
        currentEditingDividendId = docId;

        const searchInput =
            document.getElementById(
                'div-search-ticker'
            );

        const stockInput =
            document.getElementById(
                'div-stock-percent'
            );

        const cashInput =
            document.getElementById(
                'div-cash-amount'
            );

        if (searchInput) {
            searchInput.value = ticker;
        }

        if (stockInput) {
            stockInput.value = stockPercent;
        }

        if (cashInput) {
            cashInput.value = cashAmount;
        }

        const saveBtn =
            document.getElementById(
                'btn-save-dividend'
            );

        if (saveBtn) {
            saveBtn.innerHTML =
                '✏️ Update';

            saveBtn.style.background =
                '#f59e0b';
        }

        const suggestionBox =
            document.getElementById(
                'div-suggestion-box'
            );

        if (suggestionBox) {
            suggestionBox.classList.add(
                'hidden'
            );
        }
    };

// ==========================================
// 💾 Save / Update
//    ✅ edit path-এ ownership check
// ==========================================
async function saveDividendData(
    ticker,
    stockPercent,
    cashAmount,
    editId = null,
    portfolioId = null
) {
    const user =
        auth && auth.currentUser
            ? auth.currentUser
            : null;

    if (!user) {
        if (typeof showToast === 'function') {
            showToast(
                'Please login first',
                'error'
            );
        }
        return false;
    }

    ticker =
        normalizeDividendTicker(ticker);

    if (!ticker) {
        if (typeof showToast === 'function') {
            showToast(
                'Select share',
                'warning'
            );
        }
        return false;
    }

    try {
        const data = {
            shareName: ticker,
            stockPercent:
                toDividendNumber(stockPercent),
            cashAmount:
                toDividendNumber(cashAmount),
            portfolioId:
                portfolioId || 'main'
        };

        if (editId) {
            let updated = false;

            // ---------- Supabase ----------
            if (
                typeof supabase !== 'undefined' &&
                supabase
            ) {
                const {
                    error,
                    data: updData
                } = await supabase
                    .from('dividend_records')
                    .update({
                        stock_percent:
                            toDividendNumber(
                                stockPercent
                            ),
                        cash_amount:
                            toDividendNumber(
                                cashAmount
                            ),
                        portfolio_id:
                            portfolioId || 'main',
                        updated_at:
                            new Date().toISOString()
                    })
                    .eq('id', editId)
                    .eq('user_id', user.uid)
                    .select();

                if (
                    !error &&
                    updData &&
                    updData.length > 0
                ) {
                    updated = true;
                }
            }

            // ---------- Firebase ----------
            if (typeof db !== 'undefined') {
                try {
                    const docRef =
                        db.collection(
                            'dividend_records'
                        ).doc(editId);

                    const docSnap =
                        await docRef.get();

                    if (
                        docSnap.exists &&
                        docSnap.data().userId ===
                            user.uid
                    ) {
                        await docRef.update({
                            stockPercent:
                                toDividendNumber(
                                    stockPercent
                                ),
                            cashAmount:
                                toDividendNumber(
                                    cashAmount
                                ),
                            portfolioId:
                                portfolioId || 'main',
                            updatedAt:
                                new Date()
                        });

                        updated = true;
                    } else if (docSnap.exists) {
                        console.warn(
                            '⚠️ Ownership mismatch — update blocked client-side'
                        );
                    }
                } catch (e) {
                    console.warn(
                        'Firebase update check failed',
                        e
                    );
                }
            }

            if (!updated) {
                if (
                    typeof showToast === 'function'
                ) {
                    showToast(
                        '❌ Update failed or record not found',
                        'error'
                    );
                }

                return false;
            }

        } else {
            await saveDividendToBoth(
                user.uid,
                data
            );

            if (
                typeof window.invalidateAppDataCache ===
                'function'
            ) {
                window.invalidateAppDataCache(
                    'dividend saved'
                );
            }
        }

        await loadDividendData(
            portfolioId
        );

        if (typeof showToast === 'function') {
            showToast(
                '✅ Dividend saved successfully!',
                'success'
            );
        }

        return true;

    } catch (error) {
        console.error(error);

        if (typeof showToast === 'function') {
            showToast(
                'Error saving dividend',
                'error'
            );
        }

        return false;
    }
}

// ==========================================
// 💡 Dividend suggestion
// ==========================================
(function() {
    const divSearchInput =
        document.getElementById(
            'div-search-ticker'
        );

    const divSuggestionBox =
        document.getElementById(
            'div-suggestion-box'
        );

    if (
        divSearchInput &&
        divSuggestionBox
    ) {
        divSearchInput.addEventListener(
            'input',
            () => {
                const query =
                    divSearchInput.value
                        .trim()
                        .toUpperCase();

                divSuggestionBox.innerHTML = '';

                if (!query) {
                    divSuggestionBox.classList.add(
                        'hidden'
                    );
                    return;
                }

                const filtered =
                    dseStocks.filter(
                        stock =>
                            stock.startsWith(query)
                    );

                if (filtered.length > 0) {
                    divSuggestionBox.classList.remove(
                        'hidden'
                    );

                    filtered.forEach(stock => {
                        const div =
                            document.createElement(
                                'div'
                            );

                        div.classList.add(
                            'suggestion-item'
                        );

                        div.innerText = stock;

                        div.addEventListener(
                            'click',
                            () => {
                                divSearchInput.value =
                                    stock;

                                divSuggestionBox.classList.add(
                                    'hidden'
                                );
                            }
                        );

                        divSuggestionBox.appendChild(
                            div
                        );
                    });
                } else {
                    divSuggestionBox.classList.add(
                        'hidden'
                    );
                }
            }
        );

        document.addEventListener(
            'click',
            function(e) {
                if (
                    divSearchInput &&
                    !divSearchInput.contains(
                        e.target
                    ) &&
                    divSuggestionBox &&
                    !divSuggestionBox.contains(
                        e.target
                    )
                ) {
                    divSuggestionBox.classList.add(
                        'hidden'
                    );
                }
            }
        );
    }

    const saveDividendBtn =
        document.getElementById(
            'btn-save-dividend'
        );

    if (saveDividendBtn) {
        saveDividendBtn.addEventListener(
            'click',
            async () => {
                const ticker =
                    document
                        .getElementById(
                            'div-search-ticker'
                        )
                        ?.value
                        .trim()
                        .toUpperCase() || '';

                const stockPercent =
                    document
                        .getElementById(
                            'div-stock-percent'
                        )
                        ?.value || 0;

                const cashAmount =
                    document
                        .getElementById(
                            'div-cash-amount'
                        )
                        ?.value || 0;

                const portfolioId =
                    document
                        .getElementById(
                            'dividend-portfolio-select'
                        )
                        ?.value || 'main';

                if (!ticker) {
                    if (
                        typeof showToast ===
                        'function'
                    ) {
                        showToast(
                            'Select share',
                            'warning'
                        );
                    }

                    return;
                }

                const success =
                    await saveDividendData(
                        ticker,
                        stockPercent,
                        cashAmount,
                        currentEditingDividendId,
                        portfolioId
                    );

                if (success) {
                    const searchInput =
                        document.getElementById(
                            'div-search-ticker'
                        );

                    const stockInput =
                        document.getElementById(
                            'div-stock-percent'
                        );

                    const cashInput =
                        document.getElementById(
                            'div-cash-amount'
                        );

                    if (searchInput) {
                        searchInput.value = '';
                    }

                    if (stockInput) {
                        stockInput.value = '0';
                    }

                    if (cashInput) {
                        cashInput.value = '0';
                    }

                    const saveBtn =
                        document.getElementById(
                            'btn-save-dividend'
                        );

                    if (saveBtn) {
                        saveBtn.innerHTML =
                            '💾 Save';

                        saveBtn.style.background =
                            '#10b981';
                    }

                    currentEditingDividendId =
                        null;

                    if (
                        typeof loadDividendData ===
                        'function'
                    ) {
                        loadDividendData(
                            portfolioId
                        );
                    }

                    if (
                        typeof loadDashboardData ===
                        'function'
                    ) {
                        loadDashboardData(
                            portfolioId,
                            true
                        );
                    }
                }
            }
        );
    }
})();

// ==========================================
// 🌐 Global expose
// ==========================================
window.loadDividendData =
    loadDividendData;

window.saveDividendData =
    saveDividendData;

console.log(
    '✅ dividend.js v3 loaded — dividend gain / unrealized P&L calculation fixed'
);
