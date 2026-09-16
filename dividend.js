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

function normalizeDividendPortfolioId(value) {
    const id = String(value ?? '').trim().toLowerCase();
    return id || 'main';
}

function isGrandDividendPortfolio(value) {
    const id = normalizeDividendPortfolioId(value);
    return id === 'grand' || id === 'all' || id === 'all_portfolios';
}

function dividendPortfolioMatches(rowPortfolioId, selectedPortfolioId) {
    const selected = normalizeDividendPortfolioId(selectedPortfolioId);
    const row = String(rowPortfolioId ?? '').trim().toLowerCase();

    // Grand Portfolio is a virtual aggregate. It must include all holdings.
    if (isGrandDividendPortfolio(selected)) return true;

    // Backward compatibility: the current dividend_records schema may not
    // have portfolio_id at all. In that schema, dividend records are user-
    // scoped rather than portfolio-scoped, so a record without the field
    // must remain visible instead of disappearing from the list.
    if (row === '') return true;

    if (selected === 'main') return row === 'main';
    return row === selected;
}

function getDividendSelectedPortfolioId(portfolioId = null) {
    if (portfolioId !== null && portfolioId !== undefined && String(portfolioId).trim() !== '') {
        return normalizeDividendPortfolioId(portfolioId);
    }

    const selector = document.getElementById('dividend-portfolio-select');
    return normalizeDividendPortfolioId(selector?.value || 'grand');
}

function getDividendStockDetailMap(stockDetails) {
    const map = new Map();

    (Array.isArray(stockDetails) ? stockDetails : []).forEach(item => {
        const ticker = normalizeDividendTicker(item?.ticker ?? item?.share_name);
        const qty = toDividendNumber(item?.totalQty ?? item?.quantity);
        const avgBuyPrice = toDividendNumber(
            item?.avgBuyPrice ?? item?.averageBuyPrice ?? item?.buyPrice
        );

        if (!ticker || qty <= 0) return;

        map.set(ticker, {
            quantity: qty,
            avgBuyPrice: avgBuyPrice > 0 ? avgBuyPrice : 0
        });
    });

    return map;
}

async function fetchDividendPortfolioFallback(userId, selectedPortfolioId) {
    let rows = [];

    // Fetch ALL user holdings first. Filtering in JavaScript is intentional:
    // Grand Portfolio is virtual and has no physical "grand" portfolio_id.
    if (typeof supabase !== 'undefined' && supabase) {
        try {
            const { data, error } = await supabase
                .from('portfolios')
                .select('share_name, quantity, buy_price, portfolio_id')
                .eq('user_id', userId);

            if (!error && Array.isArray(data)) rows = data;
        } catch (e) {
            console.warn('Supabase dividend portfolio fetch failed', e);
        }
    }

    if (rows.length === 0 && typeof db !== 'undefined' && db) {
        try {
            const snap = await db
                .collection('portfolios')
                .where('userId', '==', userId)
                .get();

            snap.forEach(doc => {
                const data = doc.data() || {};
                rows.push({
                    share_name: data.shareName,
                    quantity: data.quantity,
                    buy_price: data.buyPrice,
                    portfolio_id: data.portfolioId
                });
            });
        } catch (e) {
            console.warn('Firebase dividend portfolio fetch failed', e);
        }
    }

    return rows.filter(row =>
        dividendPortfolioMatches(row?.portfolio_id, selectedPortfolioId)
    );
}

async function loadDividendData(portfolioId = null) {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    const selectedPortfolioId = getDividendSelectedPortfolioId(portfolioId);

    if (!user) {
        const tb = document.getElementById('dividend-table-body');
        if (tb) tb.innerHTML = `<tr><td colspan="6">Please login</td></tr>`;
        return;
    }

    const tableBody = document.getElementById('dividend-table-body');
    if (!tableBody) return;

    try {
        // ==========================================
        // 1. Load dividend records for this user.
        //    Grand = all records; legacy DB without portfolio_id = user-scoped
        //    records remain visible. Portfolio-specific filtering is applied
        //    only when the database record actually has portfolio_id.
        // ==========================================
        let dividendRecords = [];

        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data, error } = await supabase
                    .from('dividend_records')
                    .select('*')
                    .eq('user_id', user.uid);

                if (!error && Array.isArray(data)) {
                    dividendRecords = data.filter(rec =>
                        dividendPortfolioMatches(rec?.portfolio_id, selectedPortfolioId)
                    );
                }
            } catch (e) {
                console.warn(
                    'Supabase dividend fetch failed, trying Firebase...',
                    e
                );
            }
        }

        if (dividendRecords.length === 0 && typeof db !== 'undefined' && db) {
            try {
                const snapshot = await db
                    .collection('dividend_records')
                    .where('userId', '==', user.uid)
                    .get();

                snapshot.forEach(doc => {
                    const data = doc.data() || {};
                    const record = {
                        id: doc.id,
                        user_id: data.userId,
                        share_name: data.shareName,
                        stock_percent: data.stockPercent ?? 0,
                        cash_amount: data.cashAmount ?? 0,
                        portfolio_id: data.portfolioId ?? 'main',
                        created_at: safeParseDate(data.createdAt)?.toISOString?.() || null,
                        updated_at: safeParseDate(data.updatedAt)?.toISOString?.() || null
                    };

                    if (dividendPortfolioMatches(record.portfolio_id, selectedPortfolioId)) {
                        dividendRecords.push(record);
                    }
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
        // 2. PRIMARY source of truth = UnifiedCalculationEngine.
        //    This is the SAME calculation used by Holdings, so:
        //    - Grand Portfolio includes all portfolios for this logged-in user
        //    - Sales/FIFO are respected
        //    - avgBuyPrice matches the Grand Portfolio Holdings view
        // ==========================================
        let detailMap = new Map();

        try {
            if (
                typeof unifiedEngine !== 'undefined' &&
                unifiedEngine &&
                typeof unifiedEngine.calculate === 'function'
            ) {
                // Dividend calculations always use the LOGGED-IN USER'S
                // Grand Portfolio. This is the same aggregate holding view
                // used by the Portfolio/Grand Portfolio calculations.
                // The dividend page selector must not change the quantity or
                // average buy price used for Dividend Gain / Unrealized P/L.
                const calculation = await unifiedEngine.calculate(
                    user.uid,
                    'grand',
                    true
                );

                detailMap = getDividendStockDetailMap(
                    calculation?.stockDetails
                );
            }
        } catch (e) {
            console.warn('Unified dividend calculation failed; using fallback', e);
        }

        // ==========================================
        // 3. Defensive holdings fallback / merge
        // ==========================================
        // Do NOT rely only on UnifiedCalculationEngine. If its result is
        // unavailable, stale, or missing a ticker, load the same logged-in
        // user's portfolio rows directly and aggregate them as Grand Portfolio.
        const dividendTickersNeeded = new Set(
            dividendRecords.map(rec => normalizeDividendTicker(rec?.share_name))
                .filter(Boolean)
        );

        const missingDividendTickers = [...dividendTickersNeeded]
            .filter(ticker => {
                const d = detailMap.get(ticker);
                return !d || toDividendNumber(d.quantity) <= 0 || toDividendNumber(d.avgBuyPrice) <= 0;
            });

        if (missingDividendTickers.length > 0) {
            const portfolioData = await fetchDividendPortfolioFallback(
                user.uid,
                'grand'
            );

            const fallbackMap = new Map();

            portfolioData.forEach(item => {
                const ticker = normalizeDividendTicker(item?.share_name);
                const qty = toDividendNumber(item?.quantity);
                const buyPrice = toDividendNumber(item?.buy_price);

                if (!ticker || qty <= 0) return;

                const current = fallbackMap.get(ticker) || {
                    quantity: 0,
                    totalCost: 0
                };

                current.quantity += qty;
                if (buyPrice > 0) {
                    current.totalCost += qty * buyPrice;
                }

                fallbackMap.set(ticker, current);
            });

            fallbackMap.forEach((value, ticker) => {
                if (!missingDividendTickers.includes(ticker)) return;
                const avgBuyPrice =
                    value.quantity > 0 && value.totalCost > 0
                        ? value.totalCost / value.quantity
                        : 0;

                if (value.quantity > 0 && avgBuyPrice > 0) {
                    detailMap.set(ticker, {
                        quantity: value.quantity,
                        avgBuyPrice
                    });
                }
            });
        }

        // Diagnostic: if a dividend ticker still has no holding details,
        // the UI should show '-' rather than inventing a gain.
        dividendTickersNeeded.forEach(ticker => {
            if (!detailMap.has(ticker)) {
                console.warn('Dividend holding not found for ticker:', ticker);
            }
        });

        // ==========================================
        // 4. Current market prices.
        // ==========================================
        const dividendTickers = [...detailMap.keys()];

        if (
            dividendTickers.length > 0 &&
            typeof getLatestAndPreviousPrices === 'function'
        ) {
            try {
                const latestPrices =
                    await getLatestAndPreviousPrices(dividendTickers, true);

                if (latestPrices && typeof latestPrices.forEach === 'function') {
                    latestPrices.forEach((priceInfo, ticker) => {
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
                            currentPriceData.set(normalizedTicker, currentPrice);
                        }
                    });
                }
            } catch (e) {
                console.warn(
                    'Dividend current-price refresh failed',
                    e
                );
            }
        }

        let html = '';

        for (const rec of dividendRecords) {
            const ticker = normalizeDividendTicker(rec?.share_name);
            const stockPercent = toDividendNumber(rec?.stock_percent);
            const cashAmount = toDividendNumber(rec?.cash_amount);
            const docId = rec?.id;

            const detail = detailMap.get(ticker) || {
                quantity: 0,
                avgBuyPrice: 0
            };

            const remainingQty = toDividendNumber(detail.quantity);
            const avgBuyPrice = toDividendNumber(detail.avgBuyPrice);

            // ==========================================
            // Dividend Gain — independent of current price
            // ==========================================
            let stockDividendGain = 0;
            let cashDividendGain = 0;

            if (remainingQty > 0) {
                if (stockPercent > 0 && avgBuyPrice > 0) {
                    stockDividendGain =
                        remainingQty *
                        (stockPercent / 100) *
                        avgBuyPrice;
                }

                // Existing StockPulse convention:
                // cashAmount is based on Tk.10 face value.
                if (cashAmount > 0) {
                    cashDividendGain =
                        remainingQty * (cashAmount / 10);
                }
            }

            const totalDividendGain =
                stockDividendGain + cashDividendGain;

            // ==========================================
            // Unrealized P/L
            // ==========================================
            let currentPrice = 0;

            if (
                typeof currentPriceData !== 'undefined' &&
                currentPriceData
            ) {
                currentPrice = toDividendNumber(
                    currentPriceData.get(ticker)
                );
            }

            // Extra fallback: ask the unified price loader directly.
            if (
                currentPrice <= 0 &&
                typeof getUnifiedPrice === 'function'
            ) {
                try {
                    currentPrice = toDividendNumber(
                        await getUnifiedPrice(ticker, true)
                    );
                } catch (_) {}
            }

            let unrealizedGain = 0;

            if (
                remainingQty > 0 &&
                avgBuyPrice > 0 &&
                currentPrice > 0
            ) {
                unrealizedGain =
                    (currentPrice - avgBuyPrice) * remainingQty;
            }

            const safeDocId = escapeHtmlDiv(docId);
            const safeTicker = escapeHtmlDiv(ticker);
            const safeStockPercent = stockPercent.toFixed(2);
            const safeCashAmount = cashAmount.toFixed(2);

            html += `
                <tr onclick="openDividendEditModal(
                    '${safeDocId}',
                    '${safeTicker}',
                    ${stockPercent},
                    ${cashAmount}
                )">
                    <td><b>${safeTicker}</b></td>
                    <td>${safeStockPercent}%</td>
                    <td>৳${safeCashAmount}</td>
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
                        >Delete</button>
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
            // ==========================================================
            // NEW RECORD SAVE — Supabase is the primary source of truth.
            // Do NOT use supabaseFetch() here because older versions of
            // that helper may not throw on HTTP errors, which can make the
            // UI think the record was saved even when it was not.
            // Firebase is used only as a fallback/secondary copy.
            // ==========================================================
            const normalizedPortfolioId =
                normalizeDividendPortfolioId(portfolioId || 'main');

            const record = {
                user_id: user.uid,
                share_name: normalizeDividendTicker(ticker),
                stock_percent: toDividendNumber(stockPercent),
                cash_amount: toDividendNumber(cashAmount),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            let savedInSupabase = false;
            let savedInFirebase = false;
            let supabaseErrorMessage = '';

            // ---------- Supabase primary ----------
            if (typeof supabase !== 'undefined' && supabase) {
                try {
                    const { error } = await supabase
                        .from('dividend_records')
                        .insert(record);

                    if (error) {
                        supabaseErrorMessage = error.message || String(error);
                        console.warn('Supabase dividend insert failed:', error);
                    } else {
                        savedInSupabase = true;
                    }
                } catch (e) {
                    supabaseErrorMessage = e?.message || String(e);
                    console.warn('Supabase dividend insert exception:', e);
                }
            }

            // ---------- Firebase fallback / secondary copy ----------
            // If Supabase succeeded, keep the existing dual-store design by
            // writing Firebase too. If Supabase is unavailable, Firebase can
            // still make the record visible through the loader's fallback.
            if (typeof db !== 'undefined' && db) {
                try {
                    await db.collection('dividend_records').add({
                        userId: user.uid,
                        shareName: normalizeDividendTicker(ticker),
                        stockPercent: toDividendNumber(stockPercent),
                        cashAmount: toDividendNumber(cashAmount),
                        portfolioId: normalizedPortfolioId,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    savedInFirebase = true;
                } catch (e) {
                    console.warn('Firebase dividend insert failed:', e);
                }
            }

            if (!savedInSupabase && !savedInFirebase) {
                throw new Error(
                    supabaseErrorMessage ||
                    'Dividend record could not be saved'
                );
            }

            if (typeof window.invalidateAppDataCache === 'function') {
                window.invalidateAppDataCache('dividend saved');
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
// 🔄 Portfolio selector — always reload calculations for the selected scope
// ==========================================
(function attachDividendPortfolioListener() {
    const selector = document.getElementById('dividend-portfolio-select');
    if (!selector || selector.dataset.dividendFixAttached === '1') return;

    selector.dataset.dividendFixAttached = '1';
    selector.addEventListener('change', () => {
        loadDividendData(selector.value || 'grand');
    });
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
