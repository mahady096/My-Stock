// ==========================================
// portfolio.js - সম্পূর্ণ ইরর-ফ্রি ভার্সন
//    Buy, Sell, Analysis, Dividend, Stock Table, Suggestion
//    Supabase優先 + Firebase ফ্যালব্যাক + ডুয়াল রাইট
//    পোর্টফোলিও আইডি সাপোর্ট সহ (Grand, Main, Sub)
// ==========================================

// ==========================================
// ১. Buy ফর্মের সাজেশন ও Buy এক্সিকিউশন
// ==========================================
(function() {
    // DOM এলিমেন্টগুলো নিরাপদে রেফারেন্স
    const tickerInput = document.getElementById('trade-ticker');
    const priceInput = document.getElementById('trade-price');
    const suggestionBox = document.getElementById('suggestion-box');
    const tradeDateInput = document.getElementById('trade-date');
    const qtyInput = document.getElementById('trade-qty');
    const btnBuy = document.querySelector('.btn-buy');
    const buyPortfolioSelect = document.getElementById('buy-portfolio-select');

    if (tradeDateInput) tradeDateInput.value = getBangladeshDateString();

    // Buy সাজেশন – ডিবাউন্স সহ
    if (tickerInput && suggestionBox) {
        const debouncedSearch = debounce(function(query) {
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
            } else {
                suggestionBox.classList.add('hidden');
            }
        }, 250);

        tickerInput.addEventListener('input', function() {
            const query = this.value.trim().toUpperCase();
            debouncedSearch(query);
        });

        // বাইরে ক্লিক করলে সাজেশন বন্ধ
        document.addEventListener('click', function(e) {
            if (!tickerInput.contains(e.target) && !suggestionBox.contains(e.target)) {
                suggestionBox.classList.add('hidden');
            }
        });
    }

    async function fetchLivePriceForBuy(ticker) {
        if (!priceInput) return;
        const cached = await getCachedPrice(ticker);
        if (cached) { priceInput.value = cached; return; }
        try {
            const response = await fetch(`${SCRAPER_BASE_URL}?symbol=${ticker}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.ltp) { priceInput.value = data.ltp; return; }
            }
        } catch (e) { /* ignore */ }
        priceInput.value = getHardcodedPrice(ticker);
    }

    async function getCachedPrice(ticker) {
        try {
            if (typeof db === 'undefined') return null;
            const doc = await db.collection('current_prices').doc(ticker).get();
            if (doc.exists) return doc.data().price;
        } catch(e) { /* ignore */ }
        return null;
    }

    // Buy বাটন – ডুয়াল রাইট
    if (btnBuy) {
        const newBtnBuy = btnBuy.cloneNode(true);
        btnBuy.parentNode.replaceChild(newBtnBuy, btnBuy);
        newBtnBuy.addEventListener('click', async () => {
            const shareName = tickerInput ? tickerInput.value.trim().toUpperCase() : '';
            const quantity = qtyInput ? qtyInput.value : '';
            const price = priceInput ? priceInput.value : '';
            const portfolioId = buyPortfolioSelect ? buyPortfolioSelect.value : 'main';
            const user = auth.currentUser;
            if (!user) { showToast("Please login first", "error"); return; }
            if (!shareName || !quantity || !price) { showToast("Please fill all fields correctly", "warning"); return; }

            let selectedDate = tradeDateInput ? tradeDateInput.value : getBangladeshDateString();
            if (!selectedDate) selectedDate = getBangladeshDateString();
            const transactionDate = getUTCFromLocalDate(selectedDate);
            if (isNaN(transactionDate.getTime())) { showToast("Invalid date!", "error"); return; }

            const totalAmount = Number(quantity) * Number(price);
            const commissionPercent = commissionManager.getPercent();
            const commissionAmount = commissionManager.calculateCommission(totalAmount);
            const totalWithCommission = totalAmount + commissionAmount;

            let confirmMsg = `Buy Order Summary:\n📊 Share: ${shareName}\n📦 Quantity: ${quantity}\n💰 Price: ৳${Number(price).toFixed(2)}\n📈 Total Amount: ৳${totalAmount.toFixed(2)}`;
            if (commissionPercent > 0) {
                confirmMsg += `\n💸 Commission (${commissionPercent}%): ৳${commissionAmount.toFixed(2)}\n───────────────────────────────\n💵 Net Payable: ৳${totalWithCommission.toFixed(2)}`;
            } else {
                confirmMsg += `\n💵 Net Payable: ৳${totalAmount.toFixed(2)}`;
            }
            if (!confirm(confirmMsg)) return;

            try {
                const result = await savePortfolioToBoth(user.uid, {
                    shareName: shareName,
                    quantity: Number(quantity),
                    buyPrice: Number(price),
                    commission: commissionAmount,
                    commissionPercent: commissionPercent,
                    date: transactionDate.toISOString().split('T')[0],
                    portfolioId: portfolioId
                });

                if (result.supabaseSuccess || result.firebaseSuccess) {
                    resetUnifiedCache();
                    resetUnifiedPriceCache();
                    CacheManager.remove(`price_${shareName}`);
                    CacheManager.remove(`price_detail_${shareName}`);
                    CacheManager.remove(`chart_${shareName}_*`);
                    if (typeof loadDashboardData === 'function') {
                        loadDashboardData(portfolioId, true);
                    }
                    if (typeof loadPortfolioAnalysisTable === 'function') {
                        loadPortfolioAnalysisTable(user.uid, portfolioId, true);
                    }
                    if (typeof loadUnifiedStockTable === 'function') {
                        loadUnifiedStockTable(user.uid);
                    }
                    showToast(`✅ ${shareName} purchased successfully!`, 'success');
                    if (tickerInput) tickerInput.value = "";
                    if (qtyInput) qtyInput.value = "";
                    if (priceInput) priceInput.value = "";
                    if (tradeDateInput) tradeDateInput.value = getTodayDate();
                } else {
                    showToast("Failed to save purchase in both databases!", "error");
                }
            } catch (error) {
                console.error(error);
                showToast("Failed to save purchase!", "error");
            }
        });
    }
})();

// ==========================================
// ২. Sell ফাংশনালিটি (ডুয়াল রাইট)
// ==========================================
(function() {
    const sellTickerInput = document.getElementById('sell-ticker');
    const sellSuggestionBox = document.getElementById('sell-suggestion-box');
    const sellHoldingsContainer = document.getElementById('sell-holdings-container');
    const selectedSellTickerText = document.getElementById('selected-sell-ticker');
    const sellPortfolioTableBody = document.getElementById('sell-portfolio-table-body');
    const btnExecuteSell = document.getElementById('btn-execute-sell');
    const sellDateInput = document.getElementById('sell-trade-date');

    if (sellDateInput) sellDateInput.value = getBangladeshDateString();

    let currentActiveLots = [];
    let currentSellPortfolioId = 'main';

    // Sell সাজেশন
    if (sellTickerInput && sellSuggestionBox) {
        const debouncedSellSearch = debounce(function(query) {
            sellSuggestionBox.innerHTML = "";
            if (!query) { sellSuggestionBox.classList.add('hidden'); return; }
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
                        const select = document.getElementById('sell-portfolio-select');
                        currentSellPortfolioId = select ? select.value : 'main';
                        fetchHoldingsForSell(stock, currentSellPortfolioId);
                    });
                    sellSuggestionBox.appendChild(div);
                });
            } else {
                sellSuggestionBox.classList.add('hidden');
            }
        }, 250);

        sellTickerInput.addEventListener('input', function() {
            const query = this.value.trim().toUpperCase();
            debouncedSellSearch(query);
        });

        document.addEventListener('click', function(e) {
            if (!sellTickerInput.contains(e.target) && !sellSuggestionBox.contains(e.target)) {
                sellSuggestionBox.classList.add('hidden');
            }
        });
    }

    // Sell পোর্টফোলিও সিলেক্টর
    const sellPortfolioSelect = document.getElementById('sell-portfolio-select');
    if (sellPortfolioSelect) {
        sellPortfolioSelect.addEventListener('change', function() {
            currentSellPortfolioId = this.value;
            const ticker = sellTickerInput ? sellTickerInput.value.trim().toUpperCase() : '';
            if (ticker) {
                fetchHoldingsForSell(ticker, currentSellPortfolioId);
            }
        });
    }

    async function fetchHoldingsForSell(ticker, portfolioId = null) {
        const user = auth.currentUser;
        if (!user) return;
        if (selectedSellTickerText) selectedSellTickerText.innerText = ticker;
        if (sellPortfolioTableBody) sellPortfolioTableBody.innerHTML = `<tr><td colspan='4'>Loading lots...</td></tr>`;
        if (sellHoldingsContainer) sellHoldingsContainer.classList.remove('hidden');

        try {
            let buyLots = [];
            let totalSoldBefore = 0;

            // Supabase
            if (typeof supabase !== 'undefined' && supabase) {
                try {
                    let pQuery = supabase.from('portfolios')
                        .select('*')
                        .eq('user_id', user.uid)
                        .eq('share_name', ticker);
                    if (portfolioId) pQuery = pQuery.eq('portfolio_id', portfolioId);
                    const { data: pData } = await pQuery;
                    if (pData && pData.length > 0) {
                        buyLots = pData.map(doc => ({ docId: doc.id, ...doc }));
                    }

                    let sQuery = supabase.from('sales_history')
                        .select('*')
                        .eq('user_id', user.uid)
                        .eq('share_name', ticker);
                    if (portfolioId) sQuery = sQuery.eq('portfolio_id', portfolioId);
                    const { data: sData } = await sQuery;
                    if (sData) {
                        totalSoldBefore = sData.reduce((sum, item) => sum + (item.quantity_sold || 0), 0);
                    }
                } catch (e) {
                    console.warn('Supabase fetch failed, trying Firebase...', e);
                }
            }

            // Firebase ফ্যালব্যাক
            if (buyLots.length === 0 && typeof db !== 'undefined') {
                try {
                    let pQuery = db.collection('portfolios')
                        .where('userId', '==', user.uid)
                        .where('shareName', '==', ticker);
                    if (portfolioId) pQuery = pQuery.where('portfolioId', '==', portfolioId);
                    const buySnapshot = await pQuery.get();
                    buySnapshot.forEach(doc => {
                        const data = doc.data();
                        buyLots.push({
                            docId: doc.id,
                            id: doc.id,
                            quantity: data.quantity,
                            buyPrice: data.buyPrice,
                            buy_price: data.buyPrice,
                            date: data.date,
                            commission: data.commission || 0,
                            commission_percent: data.commissionPercent || 0
                        });
                    });

                    let sQuery = db.collection('sales_history')
                        .where('userId', '==', user.uid)
                        .where('shareName', '==', ticker);
                    if (portfolioId) sQuery = sQuery.where('portfolioId', '==', portfolioId);
                    const sellSnapshot = await sQuery.get();
                    sellSnapshot.forEach(doc => {
                        totalSoldBefore += (doc.data().quantitySold || 0);
                    });
                } catch (e) {
                    console.warn('Firebase fetch failed', e);
                }
            }

            buyLots.sort((a, b) => {
                const timeA = a.date ? safeParseDate(a.date) : 0;
                const timeB = b.date ? safeParseDate(b.date) : 0;
                return (timeA ? timeA.getTime() : 0) - (timeB ? timeB.getTime() : 0);
            });

            currentActiveLots = [];
            if (sellPortfolioTableBody) sellPortfolioTableBody.innerHTML = "";

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
                if (availableQty > 0) {
                    const buyPrice = lot.buyPrice || lot.buy_price || 0;
                    const docId = lot.docId || lot.id;
                    currentActiveLots.push({ docId: docId, buyPrice: buyPrice, availableQty: availableQty });
                    if (sellPortfolioTableBody) {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>৳${buyPrice.toFixed(2)}</td>
                            <td style="color:#10b981; font-weight:bold;">${availableQty}</td>
                            <td>${lot.date ? safeParseDate(lot.date)?.toLocaleDateString() || 'N/A' : 'N/A'}</td>
                            <td>
                                <div class="sell-input-group">
                                    <input type="number" id="input-sell-qty-${docId}" placeholder="Qty" min="1" max="${availableQty}">
                                    <input type="number" id="input-sell-price-${docId}" placeholder="Price">
                                </div>
                                <button onclick="addToSellBatch('${docId}', '${ticker}', ${buyPrice}, ${availableQty})" 
                                        style="margin-top: 5px; background: #6366f1; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; width: 100%;">
                                    ➕ Add to Batch
                                </button>
                            </td>
                        `;
                        sellPortfolioTableBody.appendChild(tr);
                    }
                }
            });

            if (currentActiveLots.length === 0 && sellPortfolioTableBody) {
                sellPortfolioTableBody.innerHTML = `<tr><td colspan='4'>No sellable shares available.</td></tr>`;
            }
        } catch (error) {
            console.error(error);
            if (sellPortfolioTableBody) sellPortfolioTableBody.innerHTML = `<tr><td colspan='4'>Error loading data!</td></tr>`;
        }
    }

    // Sell Execute - ডুয়াল রাইট
    if (btnExecuteSell) {
        const newSellBtn = btnExecuteSell.cloneNode(true);
        btnExecuteSell.parentNode.replaceChild(newSellBtn, btnExecuteSell);
        newSellBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (newSellBtn.hasAttribute('data-processing')) {
                showToast('Previous transaction still processing...', 'warning');
                return;
            }
            const user = auth.currentUser;
            const ticker = sellTickerInput ? sellTickerInput.value.trim().toUpperCase() : '';
            const portfolioId = sellPortfolioSelect ? sellPortfolioSelect.value : 'main';
            if (!user) { showToast("Please login first", "error"); return; }
            if (!ticker) { showToast("Please select a share", "warning"); return; }
            if (currentActiveLots.length === 0) { showToast("No sellable lots available!", "warning"); return; }

            let selectedDate = sellDateInput ? sellDateInput.value : getBangladeshDateString();
            if (!selectedDate) selectedDate = getBangladeshDateString();
            const transactionDate = getUTCFromLocalDate(selectedDate);
            if (isNaN(transactionDate.getTime())) { showToast("Invalid date!", "error"); return; }

            newSellBtn.setAttribute('data-processing', 'true');
            newSellBtn.disabled = true;
            newSellBtn.style.opacity = '0.6';

            try {
                let totalSoldSuccessfully = 0, totalSellValue = 0, totalCommissionAmount = 0;

                for (let lot of currentActiveLots) {
                    const qtyField = document.getElementById(`input-sell-qty-${lot.docId}`);
                    const priceField = document.getElementById(`input-sell-price-${lot.docId}`);
                    if (qtyField && priceField) {
                        const sellQty = Number(qtyField.value) || 0;
                        const sellPrice = Number(priceField.value) || 0;
                        if (sellQty > 0) {
                            if (sellQty > lot.availableQty) {
                                showToast(`Maximum ${lot.availableQty} shares available for this lot.`, "warning");
                                return;
                            }
                            if (sellPrice <= 0) {
                                showToast("Please enter valid price.", "warning");
                                return;
                            }
                            const saleValue = sellQty * sellPrice;
                            const commission = commissionManager.calculateCommission(saleValue);
                            totalSellValue += saleValue;
                            totalCommissionAmount += commission;

                            await saveSalesToBoth(user.uid, {
                                shareName: ticker,
                                quantitySold: sellQty,
                                buyPrice: lot.buyPrice,
                                sellPrice: sellPrice,
                                profitOrLoss: (sellPrice - lot.buyPrice) * sellQty,
                                commission: commission,
                                commissionPercent: commissionManager.getPercent(),
                                netReceived: saleValue - commission,
                                date: transactionDate.toISOString().split('T')[0],
                                portfolioId: portfolioId
                            });

                            totalSoldSuccessfully += sellQty;
                        }
                    }
                }

                if (totalSoldSuccessfully === 0) {
                    showToast("Please enter quantity to sell.", "warning");
                    return;
                }

                const commissionPercent = commissionManager.getPercent();
                let confirmMsg = `Sell Order Summary:\n📊 Share: ${ticker}\n📦 Total Sell Qty: ${totalSoldSuccessfully}\n💰 Total Sell Value: ৳${totalSellValue.toFixed(2)}`;
                if (commissionPercent > 0) {
                    confirmMsg += `\n💸 Commission (${commissionPercent}%): ৳${totalCommissionAmount.toFixed(2)}\n───────────────────────────────\n💵 Net Receivable: ৳${(totalSellValue - totalCommissionAmount).toFixed(2)}`;
                }
                if (!confirm(confirmMsg)) return;

                resetUnifiedCache();
                resetUnifiedPriceCache();
                CacheManager.remove(`price_${ticker}`);
                CacheManager.remove(`price_detail_${ticker}`);
                CacheManager.remove(`chart_${ticker}_*`);
                
                showToast(`✅ ${totalSoldSuccessfully} shares of ${ticker} sold successfully!`, "success");
                if (sellTickerInput) sellTickerInput.value = "";
                if (sellHoldingsContainer) sellHoldingsContainer.classList.add('hidden');
                if (sellDateInput) sellDateInput.value = getTodayDate();
                currentActiveLots = [];
                if (sellSuggestionBox) sellSuggestionBox.classList.add('hidden');

                if (auth.currentUser) {
                    if (typeof loadDashboardData === 'function') {
                        loadDashboardData(portfolioId, true);
                    }
                    if (typeof loadPortfolioAnalysisTable === 'function') {
                        loadPortfolioAnalysisTable(user.uid, portfolioId, true);
                    }
                    if (typeof loadUnifiedStockTable === 'function') {
                        loadUnifiedStockTable(user.uid);
                    }
                }
            } catch (error) {
                console.error(error);
                showToast("Sell failed!", "error");
            } finally {
                newSellBtn.removeAttribute('data-processing');
                newSellBtn.disabled = false;
                newSellBtn.style.opacity = '1';
            }
        });
    }

    // গ্লোবালি এক্সপোজ sell ফাংশন
    window.addToSellBatch = function(lotId, ticker, buyPrice, availableQty) {
        const qtyInput = document.getElementById(`input-sell-qty-${lotId}`);
        const priceInput = document.getElementById(`input-sell-price-${lotId}`);
        if (!qtyInput || !priceInput) return;

        const sellQty = Number(qtyInput.value) || 0;
        const sellPrice = Number(priceInput.value) || 0;

        if (sellQty <= 0 || sellPrice <= 0) {
            showToast('Please enter valid quantity and price.', 'warning');
            return;
        }
        if (sellQty > availableQty) {
            showToast(`Maximum ${availableQty} shares available.`, 'warning');
            return;
        }

        const entry = {
            lotId: lotId,
            ticker: ticker,
            buyPrice: buyPrice,
            sellQty: sellQty,
            sellPrice: sellPrice,
            totalValue: sellQty * sellPrice
        };
        sellBatch.push(entry);
        renderBatchTable();

        qtyInput.value = '';
        priceInput.value = '';
        showToast(`✅ ${ticker} added to batch (${sellQty} shares)`, 'success');
    };

    window.removeFromBatch = function(index) {
        sellBatch.splice(index, 1);
        renderBatchTable();
        showToast('🗑️ Removed from batch', 'info');
    };

    // ব্যাচ সেল ভেরিয়েবল
    let sellBatch = [];

    function renderBatchTable() {
        const tbody = document.getElementById('batch-sell-body');
        if (!tbody) return;

        if (sellBatch.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">No items added yet. Add from holdings below.</td></tr>`;
            return;
        }

        let html = '';
        let grandTotal = 0;
        sellBatch.forEach((item, index) => {
            grandTotal += item.totalValue;
            html += `<tr>
                <td style="padding: 8px; font-weight: bold;">${item.ticker}</td>
                <td style="padding: 8px;">৳${item.buyPrice.toFixed(2)}</td>
                <td style="padding: 8px;">${item.sellQty}</td>
                <td style="padding: 8px;">৳${item.sellPrice.toFixed(2)}</td>
                <td style="padding: 8px;">৳${item.totalValue.toFixed(2)}</td>
                <td style="padding: 8px;">
                    <button onclick="removeFromBatch(${index})" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;">✖</button>
                </td>
            </tr>`;
        });

        html += `<tr style="font-weight: bold; background: var(--bg-tertiary);">
            <td colspan="4" style="padding: 8px; text-align: right;">Total Sell Value</td>
            <td style="padding: 8px;">৳${grandTotal.toFixed(2)}</td>
            <td style="padding: 8px;"></td>
        </tr>`;
        tbody.innerHTML = html;
    }

    // ব্যাচ সেল এক্সিকিউট
    window.executeBatchSell = async function() {
        if (sellBatch.length === 0) {
            showToast('No items in batch. Add some first.', 'warning');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            showToast('Please login first.', 'error');
            return;
        }

        const portfolioId = sellPortfolioSelect ? sellPortfolioSelect.value : 'main';

        let totalQty = sellBatch.reduce((sum, item) => sum + item.sellQty, 0);
        let totalValue = sellBatch.reduce((sum, item) => sum + item.totalValue, 0);
        const commissionPercent = commissionManager.getPercent();
        const commissionAmount = commissionManager.calculateCommission(totalValue);
        const netReceivable = totalValue - commissionAmount;

        let confirmMsg = `📊 Batch Sell Summary:\n━━━━━━━━━━━━━━━━━━━━\n📦 Total Shares: ${totalQty}\n💰 Total Sell Value: ৳${totalValue.toFixed(2)}`;
        if (commissionPercent > 0) {
            confirmMsg += `\n💸 Commission (${commissionPercent}%): ৳${commissionAmount.toFixed(2)}`;
            confirmMsg += `\n💵 Net Receivable: ৳${netReceivable.toFixed(2)}`;
        }
        confirmMsg += `\n━━━━━━━━━━━━━━━━━━━━\n🔄 ${sellBatch.length} entry(s) will be processed.`;
        if (!confirm(confirmMsg)) return;

        const btn = document.getElementById('btn-execute-batch-sell');
        if (btn) {
            btn.disabled = true;
            btn.innerText = '⏳ Processing...';
            btn.style.opacity = '0.7';
        }

        try {
            let selectedDate = document.getElementById('sell-trade-date')?.value || getBangladeshDateString();
            if (!selectedDate) selectedDate = getBangladeshDateString();
            const transactionDate = getUTCFromLocalDate(selectedDate);
            if (isNaN(transactionDate.getTime())) {
                showToast('Invalid date!', 'error');
                return;
            }

            let processedCount = 0;
            for (const item of sellBatch) {
                const saleValue = item.sellQty * item.sellPrice;
                const commission = commissionManager.calculateCommission(saleValue);

                await saveSalesToBoth(user.uid, {
                    shareName: item.ticker,
                    quantitySold: item.sellQty,
                    buyPrice: item.buyPrice,
                    sellPrice: item.sellPrice,
                    profitOrLoss: (item.sellPrice - item.buyPrice) * item.sellQty,
                    commission: commission,
                    commissionPercent: commissionManager.getPercent(),
                    netReceived: saleValue - commission,
                    date: transactionDate.toISOString().split('T')[0],
                    portfolioId: portfolioId
                });
                processedCount++;
            }

            showToast(`✅ ${processedCount} sale(s) processed successfully!`, 'success');

            sellBatch = [];
            renderBatchTable();

            resetUnifiedCache();
            resetUnifiedPriceCache();
            const tickers = sellBatch.map(item => item.ticker);
            tickers.forEach(t => {
                CacheManager.remove(`price_${t}`);
                CacheManager.remove(`price_detail_${t}`);
            });
            
            if (typeof loadDashboardData === 'function') {
                loadDashboardData(portfolioId, true);
            }
            if (typeof loadPortfolioAnalysisTable === 'function') {
                loadPortfolioAnalysisTable(user.uid, portfolioId, true);
            }
            if (typeof loadUnifiedStockTable === 'function') {
                loadUnifiedStockTable(user.uid);
            }

            const sellTicker = document.getElementById('sell-ticker');
            if (sellTicker) sellTicker.value = '';
            const sellContainer = document.getElementById('sell-holdings-container');
            if (sellContainer) sellContainer.classList.add('hidden');
            if (document.getElementById('sell-trade-date')) {
                document.getElementById('sell-trade-date').value = getTodayDate();
            }
        } catch (error) {
            console.error('Batch sell error:', error);
            showToast('❌ Failed to execute batch sales.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = '✅ Execute All Sales';
                btn.style.opacity = '1';
            }
        }
    };

    window.clearBatch = function() {
        if (sellBatch.length === 0) return;
        if (!confirm('Clear all items from batch?')) return;
        sellBatch = [];
        renderBatchTable();
        showToast('Batch cleared', 'info');
    };

    // Sell ট্যাব ইভেন্ট
    function initSellTabs() {
        const tabs = document.querySelectorAll('.sell-tab-btn');
        const panels = {
            sell: document.getElementById('sell-tab-content'),
            history: document.getElementById('sell-history-tab-content')
        };
        if (!tabs.length || !panels.sell || !panels.history) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const target = this.getAttribute('data-tab');
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.background = 'transparent';
                    t.style.color = 'var(--text-primary)';
                    t.style.border = '1px solid var(--border-color)';
                    t.style.borderBottom = 'none';
                });
                this.classList.add('active');
                this.style.background = 'var(--primary-color)';
                this.style.color = 'white';
                this.style.border = 'none';

                Object.values(panels).forEach(p => {
                    if (p) p.style.display = 'none';
                });

                if (target === 'sell') {
                    if (panels.sell) panels.sell.style.display = 'block';
                } else if (target === 'history') {
                    if (panels.history) {
                        panels.history.style.display = 'block';
                        const searchInput = document.getElementById('sell-history-search');
                        if (searchInput) {
                            searchInput.value = '';
                            loadSellHistory('');
                        }
                    }
                }
            });
        });
    }

    // Sell History
    async function loadSellHistory(ticker, portfolioId = null) {
        const user = auth.currentUser;
        if (!user) {
            showToast('Please login first', 'error');
            return;
        }

        const tbody = document.getElementById('sell-history-body');
        const footer = document.getElementById('sell-history-footer');
        if (!tbody) return;

        const avgEl = document.getElementById('sell-history-avg-price');
        const highEl = document.getElementById('sell-history-high-price');
        const lowEl = document.getElementById('sell-history-low-price');

        if (!ticker || ticker.trim() === '') {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">Search a share to see sell history.</td></tr>`;
            if (footer) footer.style.display = 'none';
            if (avgEl) avgEl.innerHTML = '📊 Avg: -';
            if (highEl) highEl.innerHTML = '📈 High: -';
            if (lowEl) lowEl.innerHTML = '📉 Low: -';
            return;
        }

        ticker = ticker.trim().toUpperCase();
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading...</td></tr>`;
        if (footer) footer.style.display = 'table-footer-group';

        try {
            let sellData = [];
            if (typeof supabase !== 'undefined' && supabase) {
                try {
                    let sQuery = supabase.from('sales_history')
                        .select('*')
                        .eq('user_id', user.uid)
                        .eq('share_name', ticker)
                        .order('date', { ascending: false });
                    if (portfolioId) sQuery = sQuery.eq('portfolio_id', portfolioId);
                    const { data } = await sQuery;
                    if (data) sellData = data;
                } catch (e) {
                    console.warn('Supabase sell history fetch failed, trying Firebase...', e);
                }
            }

            if (sellData.length === 0 && typeof db !== 'undefined') {
                try {
                    let sQuery = db.collection('sales_history')
                        .where('userId', '==', user.uid)
                        .where('shareName', '==', ticker)
                        .orderBy('date', 'desc');
                    if (portfolioId) sQuery = sQuery.where('portfolioId', '==', portfolioId);
                    const sellSnapshot = await sQuery.get();
                    sellSnapshot.forEach(doc => {
                        const data = doc.data();
                        const parsedDate = safeParseDate(data.date);
                        const parsedCreatedAt = safeParseDate(data.createdAt);
                        sellData.push({
                            id: doc.id,
                            share_name: data.shareName,
                            quantity_sold: data.quantitySold || 0,
                            sell_price: data.sellPrice || 0,
                            buy_price: data.buyPrice || 0,
                            profit_or_loss: data.profitOrLoss || 0,
                            date: parsedDate ? parsedDate.toISOString() : null,
                            created_at: parsedCreatedAt ? parsedCreatedAt.toISOString() : null
                        });
                    });
                } catch (e) {
                    console.warn('Firebase sell history fetch failed', e);
                }
            }

            if (sellData.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No sell history found for ${ticker}.</td></tr>`;
                if (footer) footer.style.display = 'none';
                if (avgEl) avgEl.innerHTML = '📊 Avg: -';
                if (highEl) highEl.innerHTML = '📈 High: -';
                if (lowEl) lowEl.innerHTML = '📉 Low: -';
                return;
            }

            let html = '';
            let totalSellValue = 0;
            let totalSellQty = 0;
            let maxPrice = 0;
            let minPrice = Infinity;

            sellData.forEach(item => {
                const date = safeParseDate(item.date) || new Date();
                const dateStr = date.toLocaleDateString('bn-BD');
                const sellQty = item.quantity_sold || 0;
                const sellPrice = item.sell_price || 0;
                const buyPrice = item.buy_price || 0;
                const totalValue = sellQty * sellPrice;
                const profit = item.profit_or_loss || (sellPrice - buyPrice) * sellQty;
                const profitClass = profit >= 0 ? 'up' : 'error';

                if (sellPrice > 0) {
                    if (sellPrice > maxPrice) maxPrice = sellPrice;
                    if (sellPrice < minPrice) minPrice = sellPrice;
                }

                totalSellValue += totalValue;
                totalSellQty += sellQty;

                html += `<tr>
                    <td style="padding: 8px;">${dateStr}</td>
                    <td style="padding: 8px; font-weight: bold;">${item.share_name}</td>
                    <td style="padding: 8px;">${sellQty}</td>
                    <td style="padding: 8px;">৳${sellPrice.toFixed(2)}</td>
                    <td style="padding: 8px;">৳${buyPrice.toFixed(2)}</td>
                    <td style="padding: 8px;">৳${totalValue.toFixed(2)}</td>
                    <td style="padding: 8px;" class="${profitClass}">${profit >= 0 ? '+' : ''}৳${profit.toFixed(2)}</td>
                </tr>`;
            });

            tbody.innerHTML = html;

            const avgPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0;
            if (avgEl) avgEl.innerHTML = `📊 Avg: ৳${avgPrice.toFixed(2)} (Qty: ${totalSellQty})`;
            if (highEl) highEl.innerHTML = `📈 High: ৳${maxPrice > 0 ? maxPrice.toFixed(2) : '-'}`;
            if (lowEl) lowEl.innerHTML = `📉 Low: ৳${minPrice !== Infinity ? minPrice.toFixed(2) : '-'}`;

            if (footer) footer.style.display = 'table-footer-group';
        } catch (error) {
            console.error('Sell history error:', error);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">Error loading data. ${error.message}</td></tr>`;
            if (footer) footer.style.display = 'none';
        }
    }

    function initSellHistorySearch() {
        const searchInput = document.getElementById('sell-history-search');
        const suggestionBox = document.getElementById('sell-history-suggestion-box');
        if (!searchInput || !suggestionBox) return;

        const debouncedSellHist = debounce(function(query) {
            suggestionBox.innerHTML = '';
            suggestionBox.classList.add('hidden');
            if (!query) {
                loadSellHistory('');
                return;
            }
            const filtered = dseStocks.filter(stock => stock.startsWith(query));
            if (filtered.length > 0) {
                suggestionBox.classList.remove('hidden');
                const limited = filtered.slice(0, 15);
                limited.forEach(stock => {
                    const div = document.createElement('div');
                    div.classList.add('suggestion-item');
                    div.innerText = stock;
                    div.addEventListener('click', function() {
                        searchInput.value = stock;
                        suggestionBox.classList.add('hidden');
                        const portfolioId = document.getElementById('sell-portfolio-select')?.value || 'main';
                        loadSellHistory(stock, portfolioId);
                    });
                    suggestionBox.appendChild(div);
                });
            } else {
                suggestionBox.classList.add('hidden');
                loadSellHistory('');
            }
        }, 300);

        searchInput.addEventListener('input', function() {
            const query = this.value.trim().toUpperCase();
            debouncedSellHist(query);
        });

        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const ticker = this.value.trim().toUpperCase();
                suggestionBox.classList.add('hidden');
                if (ticker && dseStocks.includes(ticker)) {
                    const portfolioId = document.getElementById('sell-portfolio-select')?.value || 'main';
                    loadSellHistory(ticker, portfolioId);
                } else {
                    loadSellHistory('');
                }
            }
        });
    }

    window.loadSellHistory = loadSellHistory;
    window.initSellHistorySearch = initSellHistorySearch;
    window.initSellTabs = initSellTabs;
})();

// ==========================================
// ৩. অ্যানালাইসিস স্টেটমেন্ট (Analysis Stat)
// ==========================================
(function() {
    const analysisTickerInput = document.getElementById('analysis-ticker');
    const analysisSuggestionBox = document.getElementById('analysis-suggestion-box');
    const analysisResultContainer = document.getElementById('analysis-result-container');
    const selectedAnalysisTickerText = document.getElementById('selected-analysis-ticker');
    const analysisTableBody = document.getElementById('analysis-table-body');
    const footAnalysisRemQty = document.getElementById('foot-analysis-rem-qty');
    const footAnalysisTotalCost = document.getElementById('foot-analysis-total-cost');
    const footAnalysisAvgPrice = document.getElementById('foot-analysis-avg-price');

    if (analysisTickerInput && analysisSuggestionBox) {
        const debouncedAnalysis = debounce(function(query) {
            analysisSuggestionBox.innerHTML = "";
            if (!query) {
                analysisSuggestionBox.classList.add('hidden');
                if (analysisResultContainer) analysisResultContainer.classList.add('hidden');
                return;
            }
            const filtered = dseStocks.filter(stock => stock.startsWith(query));
            if (filtered.length > 0) {
                analysisSuggestionBox.classList.remove('hidden');
                filtered.forEach(stock => {
                    const div = document.createElement('div');
                    div.classList.add('suggestion-item');
                    div.innerText = stock;
                    div.addEventListener('click', () => {
                        analysisTickerInput.value = stock;
                        analysisSuggestionBox.classList.add('hidden');
                        const portfolioId = document.getElementById('analysis-portfolio-select')?.value || null;
                        generateAnalysisStatement(stock, portfolioId);
                    });
                    analysisSuggestionBox.appendChild(div);
                });
            } else {
                analysisSuggestionBox.classList.add('hidden');
            }
        }, 300);

        analysisTickerInput.addEventListener('input', function() {
            const query = this.value.trim().toUpperCase();
            debouncedAnalysis(query);
        });

        document.addEventListener('click', function(e) {
            if (!analysisTickerInput.contains(e.target) && !analysisSuggestionBox.contains(e.target)) {
                analysisSuggestionBox.classList.add('hidden');
            }
        });
    }

    async function generateAnalysisStatement(ticker, portfolioId = null) {
        const user = auth.currentUser;
        if (!user) return;

        if (selectedAnalysisTickerText) selectedAnalysisTickerText.innerText = ticker;
        if (analysisTableBody) analysisTableBody.innerHTML = `<tr><td colspan='9'>⏳ Loading analysis...</td></tr>`;
        if (analysisResultContainer) analysisResultContainer.classList.remove('hidden');

        try {
            const unifiedData = await unifiedEngine.calculate(user.uid, portfolioId, true);
            const stockData = unifiedData.stockDetails.find(s => s.ticker === ticker);

            if (!stockData || stockData.lots.length === 0) {
                if (analysisTableBody) analysisTableBody.innerHTML = `<tr><td colspan="9">No active holdings for ${ticker}</td></tr>`;
                return;
            }

            let currentPrice = await getUnifiedPrice(ticker);
            if (currentPrice === 0) currentPrice = Number(getHardcodedPrice(ticker));

            let rowsHtml = '';
            let grandRemainingQty = 0;
            let grandTotalBuyCost = 0;

            for (const lot of stockData.lots) {
                const lotDate = safeParseDate(lot.date);
                const formattedDate = lotDate ? lotDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                const remainingQty = lot.qty;
                const buyPrice = lot.buyPrice;
                const totalCost = lot.totalCost;
                const currentValue = remainingQty * currentPrice;
                const unrealizedGain = currentValue - totalCost;

                grandRemainingQty += remainingQty;
                grandTotalBuyCost += totalCost;

                rowsHtml += `<tr onclick="openLedgerModal('${ticker}')">
                    <td>${formattedDate}</td>
                    <td>${lot.qty}</td>
                    <td>৳${buyPrice.toFixed(2)}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>${remainingQty}</td>
                    <td>৳${currentPrice.toFixed(2)}</td>
                    <td>${remainingQty > 0 ? `৳${unrealizedGain.toFixed(2)}` : '-'}</td>
                </tr>`;
            }

            if (analysisTableBody) analysisTableBody.innerHTML = rowsHtml || `<tr><td colspan="9">No lots found</td></tr>`;

            const grandAvgBuyPrice = grandRemainingQty > 0 ? grandTotalBuyCost / grandRemainingQty : 0;
            if (footAnalysisRemQty) footAnalysisRemQty.innerText = grandRemainingQty > 0 ? grandRemainingQty : "0 (Sold Out)";
            if (footAnalysisTotalCost) footAnalysisTotalCost.innerText = `৳${grandTotalBuyCost.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
            if (footAnalysisAvgPrice) footAnalysisAvgPrice.innerText = `৳${grandAvgBuyPrice.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        } catch (error) {
            console.error('Analysis error:', error);
            if (analysisTableBody) analysisTableBody.innerHTML = `<tr><td colspan="9">Error loading data</td></tr>`;
        }
    }

    window.generateAnalysisStatement = generateAnalysisStatement;
})();

// ==========================================
// ৪. লেজার মডাল (এডিট/ডিলিট)
// ==========================================
window.openLedgerModal = async function(ticker) {
    const user = auth.currentUser;
    if (!user) return;
    const modal = document.getElementById('ledger-modal');
    const modalTitle = document.getElementById('modal-ticker-title');
    const listContainer = document.getElementById('modal-transaction-list');
    const editForm = document.getElementById('modal-edit-form');
    if (modalTitle) modalTitle.innerText = ticker;
    if (editForm) editForm.style.display = 'none';
    if (listContainer) listContainer.innerHTML = "<p>Loading history...</p>";
    if (modal) modal.style.display = 'flex';

    try {
        let buyData = [], sellData = [];

        if (typeof supabase !== 'undefined' && supabase) {
            try {
                const { data: pData } = await supabase
                    .from('portfolios')
                    .select('*')
                    .eq('user_id', user.uid)
                    .eq('share_name', ticker);
                if (pData) buyData = pData;

                const { data: sData } = await supabase
                    .from('sales_history')
                    .select('*')
                    .eq('user_id', user.uid)
                    .eq('share_name', ticker);
                if (sData) sellData = sData;
            } catch (e) {
                console.warn('Supabase fetch failed, trying Firebase...', e);
            }
        }

        if (buyData.length === 0 && typeof db !== 'undefined') {
            try {
                const buySnapshot = await db.collection("portfolios")
                    .where("userId", "==", user.uid)
                    .where("shareName", "==", ticker)
                    .get();
                buySnapshot.forEach(doc => {
                    buyData.push({ id: doc.id, ...doc.data() });
                });
            } catch (e) { /* ignore */ }
        }
        if (sellData.length === 0 && typeof db !== 'undefined') {
            try {
                const sellSnapshot = await db.collection("sales_history")
                    .where("userId", "==", user.uid)
                    .where("shareName", "==", ticker)
                    .get();
                sellSnapshot.forEach(doc => {
                    sellData.push({ id: doc.id, ...doc.data() });
                });
            } catch (e) { /* ignore */ }
        }

        let html = `<table><thead><tr><th>Type</th><th>Qty</th><th>Price</th><th>Actions</th></tr></thead><tbody>`;
        let hasData = false;
        buyData.forEach(item => {
            hasData = true;
            const qty = item.quantity || 0;
            const price = item.buyPrice || item.buy_price || 0;
            html += `<tr><td>BUY</td><td>${qty}</td><td>৳${price.toFixed(2)}</td><td><button onclick="showEditForm('${item.id}','BUY',${qty},${price})">Edit</button> <button onclick="deleteRecord('${item.id}','BUY','${ticker}')">Delete</button></td></tr>`;
        });
        sellData.forEach(item => {
            hasData = true;
            const qty = item.quantitySold || item.quantity_sold || 0;
            const price = item.sellPrice || item.sell_price || 0;
            html += `<tr><td>SELL</td><td>${qty}</td><td>৳${price.toFixed(2)}</td><td><button onclick="showEditForm('${item.id}','SELL',${qty},${price})">Edit</button> <button onclick="deleteRecord('${item.id}','SELL','${ticker}')">Delete</button></td></tr>`;
        });
        html += `</tbody></table>`;
        if (listContainer) listContainer.innerHTML = hasData ? html : "<p>No records found.</p>";
    } catch (error) {
        console.error(error);
    }
};

window.showEditForm = function(id, type, qty, price) {
    const editForm = document.getElementById('modal-edit-form');
    if (editForm) editForm.style.display = 'block';
    const title = document.getElementById('edit-form-title');
    if (title) title.innerText = `Editing ${type} Entry`;
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
    const ticker = document.getElementById('modal-ticker-title')?.innerText || '';
    if (!qty || qty <= 0 || !price || price <= 0) {
        showToast("Please enter valid quantity and price.", "warning");
        return;
    }

    try {
        if (type === 'BUY') {
            if (typeof supabase !== 'undefined' && supabase) {
                await supabase
                    .from('portfolios')
                    .update({ quantity: qty, buy_price: price })
                    .eq('id', id);
            }
            if (typeof db !== 'undefined') {
                await db.collection("portfolios").doc(id).update({ quantity: qty, buyPrice: price });
            }
            resetUnifiedCache();
            resetUnifiedPriceCache();
            showToast("✅ Record updated!", "success");
        } else {
            if (typeof supabase !== 'undefined' && supabase) {
                const { data } = await supabase
                    .from('sales_history')
                    .select('buy_price')
                    .eq('id', id)
                    .single();
                const originalBuyPrice = data?.buy_price || 0;
                await supabase
                    .from('sales_history')
                    .update({
                        quantity_sold: qty,
                        sell_price: price,
                        profit_or_loss: (price - originalBuyPrice) * qty
                    })
                    .eq('id', id);
            }
            if (typeof db !== 'undefined') {
                const docSnap = await db.collection("sales_history").doc(id).get();
                const originalBuyPrice = docSnap.data()?.buyPrice || 0;
                await db.collection("sales_history").doc(id).update({
                    quantitySold: qty,
                    sellPrice: price,
                    profitOrLoss: (price - originalBuyPrice) * qty
                });
            }
            showToast("✅ Record updated!", "success");
        }
        closeLedgerModal();
        if (auth.currentUser) {
            if (typeof loadUnifiedStockTable === 'function') loadUnifiedStockTable(auth.currentUser.uid);
            if (typeof generateAnalysisStatement === 'function') generateAnalysisStatement(ticker);
            if (typeof loadPortfolioAnalysisTable === 'function') {
                loadPortfolioAnalysisTable(auth.currentUser.uid, null, true);
            }
        }
    } catch (error) {
        console.error(error);
        showToast("Failed to update record.", "error");
    }
};

window.deleteRecord = async function(id, type, ticker) {
    if (!confirm(`Are you sure you want to delete this ${type} record?`)) return;
    try {
        if (type === 'BUY') {
            if (typeof supabase !== 'undefined' && supabase) {
                await supabase.from('portfolios').delete().eq('id', id);
            }
            if (typeof db !== 'undefined') {
                await db.collection("portfolios").doc(id).delete();
            }
            resetUnifiedCache();
            resetUnifiedPriceCache();
        } else {
            if (typeof supabase !== 'undefined' && supabase) {
                await supabase.from('sales_history').delete().eq('id', id);
            }
            if (typeof db !== 'undefined') {
                await db.collection("sales_history").doc(id).delete();
            }
        }
        showToast("🗑️ Deleted successfully!", "info");
        closeLedgerModal();
        if (auth.currentUser) {
            if (typeof loadUnifiedStockTable === 'function') loadUnifiedStockTable(auth.currentUser.uid);
            if (typeof generateAnalysisStatement === 'function') generateAnalysisStatement(ticker);
            if (typeof loadPortfolioAnalysisTable === 'function') {
                loadPortfolioAnalysisTable(auth.currentUser.uid, null, true);
            }
        }
    } catch (error) {
        console.error(error);
        showToast("Failed to delete.", "error");
    }
};

window.closeLedgerModal = function() {
    const modal = document.getElementById('ledger-modal');
    if (modal) modal.style.display = 'none';
};

// ==========================================
// ৫. ইউনিফাইড স্টক টেবিল
// ==========================================
async function loadUnifiedStockTable(userId, portfolioId = null) {
    if (!userId) return;
    const tableBody = document.getElementById('portfolio-table-body');
    if (!tableBody) return;

    async function loadStockData() {
        try {
            tableBody.innerHTML = `<tr><td colspan="12">Loading...</td></tr>`;

            let portfolioData = [];
            let salesData = [];

            // Supabase
            if (typeof supabase !== 'undefined' && supabase) {
                try {
                    let pQuery = supabase.from('portfolios').select('*').eq('user_id', userId);
                    if (portfolioId) pQuery = pQuery.eq('portfolio_id', portfolioId);
                    const { data: pData } = await pQuery;
                    if (pData) portfolioData = pData;

                    let sQuery = supabase.from('sales_history').select('*').eq('user_id', userId);
                    if (portfolioId) sQuery = sQuery.eq('portfolio_id', portfolioId);
                    const { data: sData } = await sQuery;
                    if (sData) salesData = sData;
                } catch (e) {
                    console.warn('Supabase fetch failed, trying Firebase...', e);
                }
            }

            // Firebase ফ্যালব্যাক
            if (portfolioData.length === 0 && typeof db !== 'undefined') {
                try {
                    let pQuery = db.collection('portfolios').where('userId', '==', userId);
                    if (portfolioId) pQuery = pQuery.where('portfolioId', '==', portfolioId);
                    const snap = await pQuery.get();
                    snap.forEach(doc => {
                        const data = doc.data();
                        portfolioData.push({
                            id: doc.id,
                            user_id: data.userId,
                            share_name: data.shareName,
                            quantity: data.quantity,
                            buy_price: data.buyPrice,
                            commission: data.commission || 0,
                            commission_percent: data.commissionPercent || 0,
                            date: data.date ? new Date(data.date).toISOString().split('T')[0] : null,
                            created_at: data.createdAt?.toDate?.()?.toISOString() || null
                        });
                    });
                } catch (e) {
                    console.warn('Firebase portfolio fetch failed', e);
                }
            }
            if (salesData.length === 0 && typeof db !== 'undefined') {
                try {
                    let sQuery = db.collection('sales_history').where('userId', '==', userId);
                    if (portfolioId) sQuery = sQuery.where('portfolioId', '==', portfolioId);
                    const snap = await sQuery.get();
                    snap.forEach(doc => {
                        const data = doc.data();
                        salesData.push({
                            id: doc.id,
                            user_id: data.userId,
                            share_name: data.shareName,
                            quantity_sold: data.quantitySold || 0,
                            buy_price: data.buyPrice || 0,
                            sell_price: data.sellPrice || 0,
                            profit_or_loss: data.profitOrLoss || 0,
                            commission: data.commission || 0,
                            commission_percent: data.commissionPercent || 0,
                            net_received: data.netReceived || 0,
                            date: data.date ? new Date(data.date).toISOString().split('T')[0] : null,
                            created_at: data.createdAt?.toDate?.()?.toISOString() || null
                        });
                    });
                } catch (e) {
                    console.warn('Firebase sales fetch failed', e);
                }
            }

            if (portfolioData.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="12">No trade history found.</td></tr>`;
                return;
            }

            // মোট বিক্রি হিসাব
            const salesMap = new Map();
            salesData.forEach(item => {
                const ticker = item.share_name;
                if (!salesMap.has(ticker)) {
                    salesMap.set(ticker, { sellQty: 0, totalSellValue: 0, realizedProfit: 0 });
                }
                const cur = salesMap.get(ticker);
                cur.sellQty += item.quantity_sold || 0;
                cur.totalSellValue += (item.quantity_sold || 0) * (item.sell_price || 0);
                cur.realizedProfit += item.profit_or_loss || 0;
                salesMap.set(ticker, cur);
            });

            // টিকার ভিত্তিতে গ্রুপ
            const grouped = {};
            portfolioData.forEach(item => {
                const ticker = item.share_name;
                if (!grouped[ticker]) grouped[ticker] = [];
                grouped[ticker].push(item);
            });

            const tickers = Object.keys(grouped);
            const priceDataMap = await getLatestAndPreviousPrices(tickers);

            let rowsHtml = "";
            let grandTotalBuyQty = 0, grandTotalRemainingQty = 0, grandTotalInvestment = 0;
            let grandTotalCurrentValue = 0, grandTotalUnrealized = 0, grandTotalSellQty = 0, grandTotalRealized = 0;
            let grandTotalDailyGL = 0;

            for (const [ticker, lots] of Object.entries(grouped)) {
                let totalBuyQty = 0, totalBuyCost = 0;
                lots.forEach(lot => {
                    totalBuyQty += lot.quantity || 0;
                    totalBuyCost += (lot.quantity || 0) * (lot.buy_price || 0);
                });
                const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;

                // FIFO রিমেইনিং
                let remainingLots = lots.map(lot => ({
                    qty: lot.quantity || 0,
                    buyPrice: lot.buy_price || 0,
                    commission: lot.commission || 0,
                    commissionPercent: lot.commission_percent || 0
                }));
                let totalSold = salesMap.get(ticker)?.sellQty || 0;
                for (let lot of remainingLots) {
                    if (totalSold > 0 && lot.qty > 0) {
                        const taken = Math.min(lot.qty, totalSold);
                        lot.qty -= taken;
                        totalSold -= taken;
                    }
                }
                const remainingQty = remainingLots.reduce((sum, lot) => sum + lot.qty, 0);
                const remainingCost = remainingLots.reduce((sum, lot) => sum + (lot.qty * lot.buyPrice), 0);
                const remainingCommission = remainingLots.reduce((sum, lot) => sum + (lot.qty * lot.commission / (lot.qty + (lot.qty === 0 ? 1 : 0))), 0);
                const totalCostWithComm = remainingCost + remainingCommission;
                const avgBuyWithComm = remainingQty > 0 ? totalCostWithComm / remainingQty : 0;

                const priceData = priceDataMap.get(ticker);
                const currentPrice = priceData?.currentPrice || 0;
                const previousPrice = priceData?.previousPrice || 0;

                const currentLiveValue = remainingQty * currentPrice;
                const unrealizedReturn = currentLiveValue - totalCostWithComm;
                const unrealizedPercent = totalCostWithComm > 0 ? (unrealizedReturn / totalCostWithComm) * 100 : 0;

                const dailyChange = currentPrice - previousPrice;
                const dailyChangePercent = previousPrice > 0 ? (dailyChange / previousPrice) * 100 : 0;
                const dailyGL = remainingQty * dailyChange;

                const sellData = salesMap.get(ticker) || { sellQty: 0, totalSellValue: 0, realizedProfit: 0 };
                const avgSellPrice = sellData.sellQty > 0 ? sellData.totalSellValue / sellData.sellQty : 0;

                let realizedValue = sellData.realizedProfit || 0;
                let nameClass = '';
                if (realizedValue > 0) nameClass = 'name-positive';
                else if (realizedValue < 0) nameClass = 'name-negative';

                grandTotalBuyQty += totalBuyQty;
                grandTotalRemainingQty += remainingQty;
                grandTotalInvestment += totalCostWithComm;
                grandTotalCurrentValue += currentLiveValue;
                grandTotalUnrealized += unrealizedReturn;
                grandTotalSellQty += sellData.sellQty;
                grandTotalRealized += sellData.realizedProfit;
                grandTotalDailyGL += dailyGL;

                rowsHtml += `<tr onclick="navigateToAnalysis('${ticker}')">`;
                rowsHtml += `<td class="${nameClass}"><b>${ticker}</b></td>`;
                rowsHtml += `<td>${totalBuyQty}</td>`;
                rowsHtml += `<td>৳${avgBuyPrice.toFixed(2)}</td>`;
                rowsHtml += `<td>${remainingQty}</td>`;
                rowsHtml += `<td>${remainingQty > 0 ? `৳${currentPrice.toFixed(2)}` : '-'}</td>`;
                rowsHtml += `<td>${remainingQty > 0 ? `৳${unrealizedReturn.toFixed(2)}` : '-'}</td>`;
                rowsHtml += `<td>${remainingQty > 0 ? `${unrealizedPercent >= 0 ? '+' : ''}${unrealizedPercent.toFixed(2)}%` : '-'}</td>`;
                rowsHtml += `<td>${sellData.sellQty > 0 ? sellData.sellQty : '-'}</td>`;
                rowsHtml += `<td>${sellData.sellQty > 0 ? `৳${avgSellPrice.toFixed(2)}` : '-'}</td>`;
                rowsHtml += `<td>${sellData.realizedProfit !== 0 ? `৳${sellData.realizedProfit.toLocaleString()}` : '-'}</td>`;
                rowsHtml += `<td style="color: ${dailyChangePercent >= 0 ? '#10b981' : '#ef4444'};">${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%</td>`;
                rowsHtml += `<td style="color: ${dailyGL >= 0 ? '#10b981' : '#ef4444'};">${dailyGL >= 0 ? '+' : ''}৳${dailyGL.toFixed(2)}</td>`;
                rowsHtml += `</tr>`;
            }

            // ফুটার
            rowsHtml += `<tr style="font-weight:bold; border-top:2px solid;">`;
            rowsHtml += `<td><b>📊 TOTAL</b></td>`;
            rowsHtml += `<td><b>${grandTotalBuyQty}</b></td>`;
            rowsHtml += `<td>-</td>`;
            rowsHtml += `<td><b>${grandTotalRemainingQty}</b></td>`;
            rowsHtml += `<td><b>৳${grandTotalCurrentValue.toLocaleString()}</b></td>`;
            rowsHtml += `<td><b>${grandTotalUnrealized >= 0 ? '+' : ''}৳${grandTotalUnrealized.toLocaleString()}</b></td>`;
            rowsHtml += `<td><b>${grandTotalInvestment > 0 ? ((grandTotalUnrealized / grandTotalInvestment) * 100).toFixed(2) : '0'}%</b></td>`;
            rowsHtml += `<td><b>${grandTotalSellQty}</b></td>`;
            rowsHtml += `<td>-</td>`;
            rowsHtml += `<td><b>${grandTotalRealized >= 0 ? '+' : ''}৳${grandTotalRealized.toLocaleString()}</b></td>`;
            rowsHtml += `<td><b>${grandTotalInvestment > 0 ? ((grandTotalDailyGL / grandTotalInvestment) * 100).toFixed(2) : '0'}%</b></td>`;
            rowsHtml += `<td><b>${grandTotalDailyGL >= 0 ? '+' : ''}৳${grandTotalDailyGL.toLocaleString()}</b></td>`;
            rowsHtml += `</tr>`;

            tableBody.innerHTML = rowsHtml;

            // ফুটার কার্ড আপডেট
            const footTotalInvest = document.getElementById('foot-total-invest');
            const footTotalCurrentValue = document.getElementById('foot-total-current-value');
            const footUnrealized = document.getElementById('foot-total-unrealized');
            const footRealized = document.getElementById('foot-total-realized');
            const footRemainingQty = document.getElementById('foot-total-remaining-qty');
            if (footTotalInvest) footTotalInvest.innerText = `৳${grandTotalInvestment.toLocaleString()}`;
            if (footTotalCurrentValue) footTotalCurrentValue.innerText = `৳${grandTotalCurrentValue.toLocaleString()}`;
            if (footUnrealized) {
                footUnrealized.innerText = `${grandTotalUnrealized >= 0 ? '+' : ''}৳${grandTotalUnrealized.toLocaleString()}`;
                footUnrealized.style.color = grandTotalUnrealized >= 0 ? '#10b981' : '#ef4444';
            }
            if (footRealized) {
                footRealized.innerText = `${grandTotalRealized >= 0 ? '+' : ''}৳${grandTotalRealized.toLocaleString()}`;
                footRealized.style.color = grandTotalRealized >= 0 ? '#10b981' : '#ef4444';
            }
            if (footRemainingQty) footRemainingQty.innerText = grandTotalRemainingQty.toLocaleString();

            updateTableHeadersWithSort();
            updateCompanyCount();
        } catch (error) {
            console.error('Error loading stock table:', error);
            tableBody.innerHTML = `<tr><td colspan="12">Error loading data.</td></tr>`;
        }
    }

    await loadStockData();
    if (stockTableRefreshInterval) clearInterval(stockTableRefreshInterval);
    stockTableRefreshInterval = setInterval(() => {
        const tableSection = document.getElementById('sec-table');
        if (tableSection && !tableSection.classList.contains('hidden')) loadStockData();
    }, 600000);
}

function updateTableHeadersWithSort() {
    const headers = document.querySelectorAll('#sec-table th');
    headers.forEach((header, index) => {
        if (!header.hasAttribute('data-sortable')) {
            header.setAttribute('data-sortable', 'true');
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => sortTable(index));
        }
    });
}

let currentSortedColumn = null, currentSortDirection = 'asc';
function sortTable(columnIndex) {
    const tableBody = document.getElementById('portfolio-table-body');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const dataRows = rows.filter(row => row.querySelector('td') && !row.innerText.includes('No trade history'));
    if (dataRows.length === 0) return;
    if (currentSortedColumn === columnIndex) currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    else { currentSortedColumn = columnIndex; currentSortDirection = 'asc'; }
    dataRows.sort((a, b) => {
        let aValue = a.cells[columnIndex]?.innerText || '', bValue = b.cells[columnIndex]?.innerText || '';
        if (columnIndex >= 1 && columnIndex <= 8) {
            aValue = parseFloat(aValue.replace(/[৳,]/g, '')) || 0;
            bValue = parseFloat(bValue.replace(/[৳,]/g, '')) || 0;
            return currentSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        aValue = aValue.toLowerCase(); bValue = bValue.toLowerCase();
        return currentSortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
    dataRows.forEach(row => tableBody.appendChild(row));
    updateSortIndicators(columnIndex);
}

function updateSortIndicators(columnIndex) {
    const headers = document.querySelectorAll('#sec-table th');
    headers.forEach((header, index) => {
        const existing = header.querySelector('.sort-indicator');
        if (existing) existing.remove();
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.style.marginLeft = '5px';
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
    const activeCompanies = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const shareName = cells[0]?.innerText || '';
            const remainingQty = cells[3]?.innerText || '0';
            if (remainingQty !== '-' && remainingQty !== '0' && !shareName.includes('Sold Out') && !activeCompanies.includes(shareName)) {
                activeCompanies.push(shareName);
                companyCount++;
            }
        }
    });
    const footer = document.querySelector('#sec-table tfoot');
    if (footer && !document.getElementById('company-count-row')) {
        const newRow = document.createElement('tr');
        newRow.id = 'company-count-row';
        newRow.innerHTML = `<td colspan="10">📊 Total Companies: ${companyCount}</td>`;
        footer.appendChild(newRow);
    } else {
        const countRow = document.getElementById('company-count-row');
        if (countRow) countRow.innerHTML = `<td colspan="10">📊 Total Companies: ${companyCount}</td>`;
    }
}

window.navigateToAnalysis = function(ticker) {
    if (typeof switchTab === 'function') switchTab('analysis');
    const analysisInput = document.getElementById('analysis-ticker');
    if (analysisInput) analysisInput.value = ticker;
    if (typeof generateAnalysisStatement === "function") generateAnalysisStatement(ticker);
};

window.loadUnifiedStockTable = loadUnifiedStockTable;
window.refreshStockTable = function() {
    const user = auth.currentUser;
    if (!user) {
        showToast('Please login first', 'error');
        return;
    }
    showToast('🔄 Refreshing stock table...', 'info');
    loadUnifiedStockTable(user.uid).then(() => {
        showToast('✅ Stock table refreshed!', 'success');
    }).catch(() => {
        showToast('❌ Refresh failed', 'error');
    });
};

// ==========================================
// ৬. ডিভিডেন্ড ম্যানেজমেন্ট (পোর্টফোলিও আইডি সাপোর্ট)
// ==========================================
let currentEditingDividendId = null;

async function loadDividendData(portfolioId = null) {
    const user = auth.currentUser;
    if (!user) {
        const tb = document.getElementById('dividend-table-body');
        if (tb) tb.innerHTML = `<tr><td colspan="6">Please login</td></tr>`;
        return;
    }
    const tableBody = document.getElementById('dividend-table-body');
    if (!tableBody) return;

    try {
        let dividendRecords = [];
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                let query = supabase.from('dividend_records').select('*').eq('user_id', user.uid);
                if (portfolioId) query = query.eq('portfolio_id', portfolioId);
                const { data } = await query;
                if (data) dividendRecords = data;
            } catch (e) {
                console.warn('Supabase dividend fetch failed, trying Firebase...', e);
            }
        }

        if (dividendRecords.length === 0 && typeof db !== 'undefined') {
            try {
                let query = db.collection('dividend_records').where('userId', '==', user.uid);
                if (portfolioId) query = query.where('portfolioId', '==', portfolioId);
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
                        created_at: parsedCreatedAt ? parsedCreatedAt.toISOString() : null,
                        updated_at: parsedUpdatedAt ? parsedUpdatedAt.toISOString() : null
                    });
                });
            } catch (e) {
                console.warn('Firebase dividend fetch failed', e);
            }
        }

        if (dividendRecords.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6">No dividend records found.</td></tr>`;
            return;
        }

        let portfolioData = [];
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                let query = supabase.from('portfolios').select('share_name, quantity, portfolio_id').eq('user_id', user.uid);
                if (portfolioId) query = query.eq('portfolio_id', portfolioId);
                const { data } = await query;
                if (data) portfolioData = data;
            } catch (e) { /* ignore */ }
        }
        if (portfolioData.length === 0 && typeof db !== 'undefined') {
            try {
                let query = db.collection('portfolios').where('userId', '==', user.uid);
                if (portfolioId) query = query.where('portfolioId', '==', portfolioId);
                const snap = await query.get();
                snap.forEach(doc => {
                    const data = doc.data();
                    portfolioData.push({ share_name: data.shareName, quantity: data.quantity, portfolio_id: data.portfolioId || 'main' });
                });
            } catch (e) { /* ignore */ }
        }

        const remainingQtyMap = new Map();
        portfolioData.forEach(item => {
            const ticker = item.share_name;
            const qty = item.quantity || 0;
            remainingQtyMap.set(ticker, (remainingQtyMap.get(ticker) || 0) + qty);
        });

        let html = '';
        for (const rec of dividendRecords) {
            const ticker = rec.share_name;
            const stockPercent = rec.stock_percent || 0;
            const cashAmount = rec.cash_amount || 0;
            const docId = rec.id;
            const remainingQty = remainingQtyMap.get(ticker) || 0;

            let avgBuyPrice = 0;
            const portfolioItems = portfolioData.filter(p => p.share_name === ticker);
            if (portfolioItems.length > 0) {
                let totalCost = 0, totalQty = 0;
                portfolioItems.forEach(p => {
                    totalCost += (p.quantity || 0) * (p.buy_price || 0);
                    totalQty += (p.quantity || 0);
                });
                avgBuyPrice = totalQty > 0 ? totalCost / totalQty : 0;
            }

            let totalDividendGain = 0, unrealizedGain = 0;
            if (remainingQty > 0 && avgBuyPrice > 0) {
                const stockGain = remainingQty * (stockPercent / 100) * avgBuyPrice;
                const cashGain = remainingQty * (cashAmount / 10);
                totalDividendGain = stockGain + cashGain;
                let currentPrice = currentPriceData.get(ticker) || avgBuyPrice;
                unrealizedGain = (currentPrice - avgBuyPrice) * remainingQty;
            }

            html += `<tr onclick="openDividendEditModal('${docId}','${ticker}',${stockPercent},${cashAmount})">
                <td><b>${ticker}</b></td>
                <td>${stockPercent}%</td>
                <td>৳${cashAmount.toFixed(2)}</td>
                <td>${remainingQty > 0 ? `৳${totalDividendGain.toFixed(2)}` : '-'}</td>
                <td>${remainingQty > 0 ? `৳${unrealizedGain.toFixed(2)}` : '-'}</td>
                <td><button onclick="deleteDividendRecord('${docId}', event)">Delete</button></td>
            </tr>`;
        }
        tableBody.innerHTML = html;
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="6">Error loading data</td></tr>`;
    }
}

window.deleteDividendRecord = async function(docId, event) {
    event.stopPropagation();
    if (!confirm('Delete?')) return;
    try {
        if (typeof supabase !== 'undefined' && supabase) {
            await supabase.from('dividend_records').delete().eq('id', docId);
        }
        if (typeof db !== 'undefined') {
            await db.collection('dividend_records').doc(docId).delete();
        }
        loadDividendData();
        showToast('🗑️ Deleted successfully!', 'info');
    } catch (e) {
        console.error(e);
        showToast('Delete failed', 'error');
    }
};

window.openDividendEditModal = function(docId, ticker, stockPercent, cashAmount) {
    currentEditingDividendId = docId;
    const searchInput = document.getElementById('div-search-ticker');
    const stockInput = document.getElementById('div-stock-percent');
    const cashInput = document.getElementById('div-cash-amount');
    if (searchInput) searchInput.value = ticker;
    if (stockInput) stockInput.value = stockPercent;
    if (cashInput) cashInput.value = cashAmount;
    const saveBtn = document.getElementById('btn-save-dividend');
    if (saveBtn) {
        saveBtn.innerHTML = '✏️ Update';
        saveBtn.style.background = '#f59e0b';
    }
    const suggestionBox = document.getElementById('div-suggestion-box');
    if (suggestionBox) suggestionBox.classList.add('hidden');
};

async function saveDividendData(ticker, stockPercent, cashAmount, editId = null, portfolioId = null) {
    const user = auth.currentUser;
    if (!user) { showToast('Please login first', 'error'); return false; }
    if (!ticker) { showToast('Select share', 'warning'); return false; }

    try {
        const data = {
            shareName: ticker,
            stockPercent: Number(stockPercent),
            cashAmount: Number(cashAmount),
            portfolioId: portfolioId || 'main'
        };

        if (editId) {
            if (typeof supabase !== 'undefined' && supabase) {
                await supabase
                    .from('dividend_records')
                    .update({
                        stock_percent: Number(stockPercent),
                        cash_amount: Number(cashAmount),
                        portfolio_id: portfolioId || 'main',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editId);
            }
            if (typeof db !== 'undefined') {
                await db.collection('dividend_records').doc(editId).update({
                    stockPercent: Number(stockPercent),
                    cashAmount: Number(cashAmount),
                    portfolioId: portfolioId || 'main',
                    updatedAt: new Date()
                });
            }
        } else {
            await saveDividendToBoth(user.uid, data);
        }
        await loadDividendData(portfolioId);
        showToast('✅ Dividend saved successfully!', 'success');
        return true;
    } catch (error) {
        console.error(error);
        showToast('Error saving dividend', 'error');
        return false;
    }
}

// ডিভিডেন্ড সাজেশন
(function() {
    const divSearchInput = document.getElementById('div-search-ticker');
    const divSuggestionBox = document.getElementById('div-suggestion-box');
    if (divSearchInput && divSuggestionBox) {
        divSearchInput.addEventListener('input', () => {
            const query = divSearchInput.value.trim().toUpperCase();
            divSuggestionBox.innerHTML = '';
            if (!query) { divSuggestionBox.classList.add('hidden'); return; }
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
            } else divSuggestionBox.classList.add('hidden');
        });
        document.addEventListener('click', function(e) {
            if (divSearchInput && !divSearchInput.contains(e.target) && divSuggestionBox && !divSuggestionBox.contains(e.target)) {
                divSuggestionBox.classList.add('hidden');
            }
        });
    }

    const saveDividendBtn = document.getElementById('btn-save-dividend');
    if (saveDividendBtn) {
        saveDividendBtn.addEventListener('click', async () => {
            const ticker = document.getElementById('div-search-ticker')?.value.trim().toUpperCase() || '';
            const stockPercent = document.getElementById('div-stock-percent')?.value || 0;
            const cashAmount = document.getElementById('div-cash-amount')?.value || 0;
            const portfolioId = document.getElementById('dividend-portfolio-select')?.value || 'main';
            if (!ticker) { showToast('Select share', 'warning'); return; }
            const success = await saveDividendData(ticker, stockPercent, cashAmount, currentEditingDividendId, portfolioId);
            if (success) {
                const searchInput = document.getElementById('div-search-ticker');
                const stockInput = document.getElementById('div-stock-percent');
                const cashInput = document.getElementById('div-cash-amount');
                if (searchInput) searchInput.value = '';
                if (stockInput) stockInput.value = '0';
                if (cashInput) cashInput.value = '0';
                const saveBtn = document.getElementById('btn-save-dividend');
                if (saveBtn) {
                    saveBtn.innerHTML = '💾 Save';
                    saveBtn.style.background = '#10b981';
                }
                currentEditingDividendId = null;
                // রিলোড
                if (typeof loadDividendData === 'function') {
                    loadDividendData(portfolioId);
                }
                if (typeof loadDashboardData === 'function') {
                    loadDashboardData(portfolioId, true);
                }
            }
        });
    }
})();

window.loadDividendData = loadDividendData;
window.saveDividendData = saveDividendData;

// ==========================================
// ৭. স্টেটমেন্ট (Statement)
// ==========================================
async function loadStatementData() {
    const tickerInput = document.getElementById('statement-ticker');
    if (!tickerInput) return;
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) return;

    const user = auth.currentUser;
    if (!user) return;

    const container = document.getElementById('statement-result-container');
    const tickerSpan = document.getElementById('selected-statement-ticker');
    const tbody = document.getElementById('statement-table-body');
    if (!container || !tbody) return;

    container.classList.remove('hidden');
    if (tickerSpan) tickerSpan.innerText = ticker;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">⏳ Loading...</td></tr>`;

    try {
        const portfolioId = document.getElementById('statement-portfolio-select')?.value || null;
        const unifiedData = await unifiedEngine.calculate(user.uid, portfolioId, true);
        const stockData = unifiedData.stockDetails.find(s => s.ticker === ticker);

        if (!stockData || stockData.lots.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">No active holdings for ${ticker}</td></tr>`;
            return;
        }

        let transactions = [];
        let runningQty = 0;

        for (const lot of stockData.lots) {
            const dateObj = safeParseDate(lot.date) || new Date();
            transactions.push({
                date: dateObj,
                type: 'BUY',
                qty: lot.qty,
                price: lot.buyPrice,
                totalAmount: lot.qty * lot.buyPrice,
                realizedProfit: null,
                runningQty: 0
            });
        }

        transactions.sort((a, b) => a.date - b.date);
        for (let tx of transactions) {
            if (tx.type === 'BUY') runningQty += tx.qty;
            else runningQty -= tx.qty;
            tx.runningQty = runningQty;
        }

        let html = '';
        let totalBuyCost = 0;
        let totalQty = 0;

        for (const tx of transactions) {
            const dateStr = tx.date.toLocaleDateString('bn-BD');
            totalBuyCost += tx.totalAmount;
            totalQty += tx.qty;
            html += `<tr>
                <td style="padding:8px;">${dateStr}</td>
                <td style="padding:8px;" class="up">BUY</td>
                <td style="padding:8px;">${tx.qty}</td>
                <td style="padding:8px;">৳${tx.price.toFixed(2)}</td>
                <td style="padding:8px;">৳${tx.totalAmount.toFixed(2)}</td>
                <td style="padding:8px;">-</td>
                <td style="padding:8px;">${tx.runningQty}</td>
            </tr>`;
        }

        tbody.innerHTML = html;

        const remainingQty = runningQty;
        const avgBuy = remainingQty > 0 ? totalBuyCost / remainingQty : 0;
        let currentPrice = await getUnifiedPrice(ticker);
        if (currentPrice === 0) currentPrice = avgBuy;
        const unrealized = remainingQty * (currentPrice - avgBuy);

        const remSpan = document.getElementById('foot-stmt-rem-qty');
        const totalBuySpan = document.getElementById('foot-stmt-total-buy');
        const avgBuySpan = document.getElementById('foot-stmt-avg-buy');
        const ltpSpan = document.getElementById('foot-stmt-ltp');
        const unrealSpan = document.getElementById('foot-stmt-unrealized');
        if (remSpan) remSpan.innerText = remainingQty;
        if (totalBuySpan) totalBuySpan.innerHTML = `৳${totalBuyCost.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        if (avgBuySpan) avgBuySpan.innerHTML = `৳${avgBuy.toFixed(2)}`;
        if (ltpSpan) ltpSpan.innerHTML = `৳${currentPrice.toFixed(2)}`;
        if (unrealSpan) {
            unrealSpan.innerHTML = `${unrealized >= 0 ? '+' : ''}৳${unrealized.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
            unrealSpan.style.color = unrealized >= 0 ? '#10b981' : '#ef4444';
        }
    } catch (err) {
        console.error('Statement error:', err);
        tbody.innerHTML = `<tr><td colspan="7">Error loading data. <br> ${err.message}</td></tr>`;
    }
}

function initStatementSearch() {
    const input = document.getElementById('statement-ticker');
    const suggestionBox = document.getElementById('statement-suggestion-box');
    if (!input || !suggestionBox) return;

    const debouncedStatement = debounce(function(query) {
        suggestionBox.innerHTML = '';
        suggestionBox.classList.add('hidden');
        if (!query) { return; }
        const filtered = dseStocks.filter(stock => stock.startsWith(query));
        if (filtered.length > 0) {
            suggestionBox.classList.remove('hidden');
            const limited = filtered.slice(0, 15);
            limited.forEach(stock => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.innerText = stock;
                div.addEventListener('click', function() {
                    input.value = stock;
                    suggestionBox.classList.add('hidden');
                    loadStatementData();
                });
                suggestionBox.appendChild(div);
            });
        }
    }, 300);

    input.addEventListener('input', function() {
        const query = this.value.trim().toUpperCase();
        debouncedStatement(query);
    });

    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const ticker = this.value.trim().toUpperCase();
            suggestionBox.classList.add('hidden');
            if (ticker && dseStocks.includes(ticker)) {
                loadStatementData();
            } else {
                showToast('Share not found. Please select from suggestions.', 'warning');
            }
        }
    });

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
            suggestionBox.classList.add('hidden');
        }
    });
}

window.loadStatementData = loadStatementData;
window.initStatementSearch = initStatementSearch;

// ==========================================
// ৮. Buy History (পোর্টফোলিও আইডি সাপোর্ট)
// ==========================================
async function loadBuyHistory(ticker, portfolioId = null) {
    const user = auth.currentUser;
    if (!user) {
        showToast('Please login first', 'error');
        return;
    }

    const tbody = document.getElementById('buy-history-body');
    const footer = document.getElementById('buy-history-footer');
    if (!tbody) return;

    const avgEl = document.getElementById('buy-history-avg-price');
    const totalQtyEl = document.getElementById('buy-history-total-qty');
    const totalCostEl = document.getElementById('buy-history-total-cost');

    if (!ticker || ticker.trim() === '') {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">Search a share to see buy history.</td></tr>`;
        if (footer) footer.style.display = 'none';
        if (avgEl) avgEl.innerHTML = '📊 Avg Buy: -';
        if (totalQtyEl) totalQtyEl.innerHTML = '📦 Total Qty: -';
        if (totalCostEl) totalCostEl.innerHTML = '💰 Total Cost: -';
        return;
    }

    ticker = ticker.trim().toUpperCase();
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading...</td></tr>`;
    if (footer) footer.style.display = 'table-footer-group';

    try {
        let buyData = [];
        if (typeof supabase !== 'undefined' && supabase) {
            try {
                let query = supabase
                    .from('portfolios')
                    .select('*')
                    .eq('user_id', user.uid)
                    .eq('share_name', ticker)
                    .order('date', { ascending: false });
                if (portfolioId) query = query.eq('portfolio_id', portfolioId);
                const { data } = await query;
                if (data) buyData = data;
            } catch (e) {
                console.warn('Supabase buy history fetch failed, trying Firebase...', e);
            }
        }

        if (buyData.length === 0 && typeof db !== 'undefined') {
            try {
                let query = db.collection('portfolios')
                    .where('userId', '==', user.uid)
                    .where('shareName', '==', ticker)
                    .orderBy('date', 'desc');
                if (portfolioId) query = query.where('portfolioId', '==', portfolioId);
                const buySnapshot = await query.get();
                buySnapshot.forEach(doc => {
                    const data = doc.data();
                    const parsedDate = safeParseDate(data.date);
                    const parsedCreatedAt = safeParseDate(data.createdAt);
                    buyData.push({
                        id: doc.id,
                        share_name: data.shareName,
                        quantity: data.quantity,
                        buy_price: data.buyPrice,
                        date: parsedDate ? parsedDate.toISOString() : null,
                        created_at: parsedCreatedAt ? parsedCreatedAt.toISOString() : null
                    });
                });
            } catch (e) {
                console.warn('Firebase buy history fetch failed', e);
            }
        }

        if (buyData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">No buy history found for ${ticker}.</td></tr>`;
            if (footer) footer.style.display = 'none';
            if (avgEl) avgEl.innerHTML = '📊 Avg Buy: -';
            if (totalQtyEl) totalQtyEl.innerHTML = '📦 Total Qty: -';
            if (totalCostEl) totalCostEl.innerHTML = '💰 Total Cost: -';
            return;
        }

        let html = '';
        let totalQty = 0;
        let totalCost = 0;

        buyData.forEach(item => {
            const date = safeParseDate(item.date) || new Date();
            const dateStr = date.toLocaleDateString('bn-BD');
            const qty = item.quantity || 0;
            const price = item.buy_price || 0;
            const total = qty * price;

            totalQty += qty;
            totalCost += total;

            html += `<tr>
                <td style="padding: 8px;">${dateStr}</td>
                <td style="padding: 8px; font-weight: bold;">${item.share_name}</td>
                <td style="padding: 8px;">${qty}</td>
                <td style="padding: 8px;">৳${price.toFixed(2)}</td>
                <td style="padding: 8px;">৳${total.toFixed(2)}</td>
                <td style="padding: 8px;">
                    <button onclick="editBuyRecord('${item.id}')" style="background:#0284c7; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:4px;">✏️</button>
                    <button onclick="deleteBuyRecord('${item.id}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;

        const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
        if (avgEl) avgEl.innerHTML = `📊 Avg Buy: ৳${avgPrice.toFixed(2)}`;
        if (totalQtyEl) totalQtyEl.innerHTML = `📦 Total Qty: ${totalQty}`;
        if (totalCostEl) totalCostEl.innerHTML = `💰 Total Cost: ৳${totalCost.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;

        if (footer) footer.style.display = 'table-footer-group';
    } catch (error) {
        console.error('Buy history error:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: red;">Error loading data. ${error.message}</td></tr>`;
        if (footer) footer.style.display = 'none';
    }
}

window.editBuyRecord = async function(docId) {
    const newQty = prompt("Enter new quantity:");
    const newPrice = prompt("Enter new price:");
    if (newQty && newPrice) {
        try {
            if (typeof supabase !== 'undefined' && supabase) {
                await supabase
                    .from('portfolios')
                    .update({ quantity: parseInt(newQty), buy_price: parseFloat(newPrice) })
                    .eq('id', docId);
            }
            if (typeof db !== 'undefined') {
                await db.collection('portfolios').doc(docId).update({
                    quantity: parseInt(newQty),
                    buyPrice: parseFloat(newPrice)
                });
            }
            showToast('✅ Updated successfully!', 'success');
            const searchInput = document.getElementById('buy-history-search');
            if (searchInput) loadBuyHistory(searchInput.value);
            resetUnifiedCache();
            resetUnifiedPriceCache();
        } catch (err) {
            showToast('❌ Update failed: ' + err.message, 'error');
        }
    }
};

window.deleteBuyRecord = async function(docId) {
    if (!confirm('Are you sure you want to delete this buy record?')) return;
    try {
        if (typeof supabase !== 'undefined' && supabase) {
            await supabase.from('portfolios').delete().eq('id', docId);
        }
        if (typeof db !== 'undefined') {
            await db.collection('portfolios').doc(docId).delete();
        }
        showToast('✅ Deleted successfully!', 'success');
        const searchInput = document.getElementById('buy-history-search');
        if (searchInput) loadBuyHistory(searchInput.value);
        resetUnifiedCache();
        resetUnifiedPriceCache();
    } catch (err) {
        showToast('❌ Delete failed: ' + err.message, 'error');
    }
};

function initBuyHistorySearch() {
    const searchInput = document.getElementById('buy-history-search');
    const suggestionBox = document.getElementById('buy-history-suggestion-box');
    if (!searchInput || !suggestionBox) return;

    const debouncedBuyHist = debounce(function(query) {
        suggestionBox.innerHTML = '';
        suggestionBox.classList.add('hidden');
        if (!query) {
            loadBuyHistory('');
            return;
        }
        const filtered = dseStocks.filter(stock => stock.startsWith(query));
        if (filtered.length > 0) {
            suggestionBox.classList.remove('hidden');
            const limited = filtered.slice(0, 15);
            limited.forEach(stock => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.innerText = stock;
                div.addEventListener('click', function() {
                    searchInput.value = stock;
                    suggestionBox.classList.add('hidden');
                    const portfolioId = document.getElementById('buy-history-portfolio-select')?.value || null;
                    loadBuyHistory(stock, portfolioId);
                });
                suggestionBox.appendChild(div);
            });
        } else {
            suggestionBox.classList.add('hidden');
            loadBuyHistory('');
        }
    }, 300);

    searchInput.addEventListener('input', function() {
        const query = this.value.trim().toUpperCase();
        debouncedBuyHist(query);
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const ticker = this.value.trim().toUpperCase();
            suggestionBox.classList.add('hidden');
            if (ticker && dseStocks.includes(ticker)) {
                const portfolioId = document.getElementById('buy-history-portfolio-select')?.value || null;
                loadBuyHistory(ticker, portfolioId);
            } else {
                loadBuyHistory('');
            }
        }
    });
}

window.loadBuyHistory = loadBuyHistory;
window.initBuyHistorySearch = initBuyHistorySearch;
window.initBuyTabs = initBuyTabs;

// ==========================================
// ৯. Buy/Sell Suggestion (পোর্টফোলিও ফিল্টার সহ)
// ==========================================
async function loadSuggestionData(threshold = null, portfolioId = null) {
    const user = auth.currentUser;
    if (!user) {
        showToast('Please login first', 'error');
        return;
    }

    if (threshold === null) {
        const input = document.getElementById('suggestion-threshold');
        threshold = input ? parseFloat(input.value) || 50 : 50;
    }

    threshold = Math.min(100, Math.max(1, threshold));

    const buyTbody = document.getElementById('suggestion-buy-body');
    const sellTbody = document.getElementById('suggestion-sell-body');
    if (!buyTbody || !sellTbody) return;

    buyTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">⏳ Loading buy suggestions...</td></tr>`;
    sellTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">⏳ Loading sell suggestions...</td></tr>`;

    try {
        // 🔥 portfolioId পাস করুন (null = গ্র্যান্ড পোর্টফোলিও)
        const unifiedData = await unifiedEngine.calculate(user.uid, portfolioId || null, true);
        if (!unifiedData || unifiedData.stockDetails.length === 0) {
            buyTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No stocks in portfolio.</td></tr>`;
            sellTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No stocks in portfolio.</td></tr>`;
            return;
        }

        const tickers = unifiedData.stockDetails.map(s => s.ticker);
        const pricePromises = tickers.map(t => getUnifiedPrice(t));
        const currentPrices = await Promise.all(pricePromises);

        const stockAnalysis = [];
        for (let i = 0; i < unifiedData.stockDetails.length; i++) {
            const stock = unifiedData.stockDetails[i];
            const currentPrice = currentPrices[i] || 0;
            const totalCost = stock.totalCost || 0;
            const remainingQty = stock.totalQty || 0;
            const avgBuy = stock.avgBuyPriceWithCommission || 0;

            const currentValue = remainingQty * currentPrice;
            const unrealizedGL = currentValue - totalCost;
            const unrealizedPercent = totalCost > 0 ? (unrealizedGL / totalCost) * 100 : 0;

            stockAnalysis.push({
                ticker: stock.ticker,
                avgBuy: avgBuy,
                qty: remainingQty,
                totalCost: totalCost,
                currentValue: currentValue,
                unrealizedGL: unrealizedGL,
                unrealizedPercent: unrealizedPercent
            });
        }

        const buySuggestions = stockAnalysis
            .filter(item => item.unrealizedPercent >= threshold)
            .sort((a, b) => b.unrealizedPercent - a.unrealizedPercent);

        const sellSuggestions = stockAnalysis
            .filter(item => item.unrealizedPercent <= -threshold)
            .sort((a, b) => a.unrealizedPercent - b.unrealizedPercent);

        renderSuggestionTable(buyTbody, buySuggestions, 'buy');
        renderSuggestionTable(sellTbody, sellSuggestions, 'sell');
    } catch (error) {
        console.error('Suggestion error:', error);
        buyTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error loading data.</td></tr>`;
        sellTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Error loading data.</td></tr>`;
    }
}

// ==========================================
// Buy ট্যাব ইনিশিয়ালাইজেশন
// ==========================================
function initBuyTabs() {
    const tabsContainer = document.querySelector('.buy-tabs');
    const buyPanel = document.getElementById('buy-tab-content');
    const historyPanel = document.getElementById('buy-history-tab-content');

    if (!tabsContainer || !buyPanel || !historyPanel) {
        console.warn('Buy tabs elements not found');
        return;
    }

    tabsContainer.addEventListener('click', function(e) {
        const tabBtn = e.target.closest('.buy-tab-btn');
        if (!tabBtn) return;
        const target = tabBtn.getAttribute('data-tab');
        if (!target) return;

        const allTabs = tabsContainer.querySelectorAll('.buy-tab-btn');
        allTabs.forEach(t => {
            t.classList.remove('active');
            t.style.background = 'transparent';
            t.style.color = 'var(--text-primary)';
            t.style.border = '1px solid var(--border-color)';
            t.style.borderBottom = 'none';
        });

        tabBtn.classList.add('active');
        tabBtn.style.background = 'var(--primary-color)';
        tabBtn.style.color = 'white';
        tabBtn.style.border = 'none';

        buyPanel.style.display = 'none';
        historyPanel.style.display = 'none';

        if (target === 'buy') {
            buyPanel.style.display = 'block';
        } else if (target === 'history') {
            historyPanel.style.display = 'block';
            const searchInput = document.getElementById('buy-history-search');
            if (searchInput) {
                searchInput.value = '';
                if (typeof loadBuyHistory === 'function') {
                    loadBuyHistory('');
                }
            }
        }
    });

    console.log('✅ Buy tabs initialized');
}

window.initBuyTabs = initBuyTabs;

function renderSuggestionTable(tbody, data, type) {
    if (!data || data.length === 0) {
        const threshold = document.getElementById('suggestion-threshold')?.value || 50;
        const msg = type === 'buy'
            ? `🎉 No stocks with ${threshold}%+ gain.`
            : `😊 No stocks with ${threshold}%+ loss.`;
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">${msg}</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(item => {
        const isProfit = type === 'buy';
        const sign = isProfit ? '+' : '';
        const glValue = item.unrealizedGL;
        const percent = item.unrealizedPercent;
        const color = isProfit ? '#10b981' : '#ef4444';

        html += `<tr>
            <td style="padding: 10px; font-weight: bold; cursor: pointer; color: var(--primary-color); text-decoration: underline;"
                onclick="openStockDetailModal('${item.ticker}')">${item.ticker}</td>
            <td style="padding: 10px; text-align: right;">৳${item.avgBuy.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right;">${item.qty}</td>
            <td style="padding: 10px; text-align: right; color: ${color}; font-weight: 600;">
                ${sign}৳${glValue.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}
            </td>
            <td style="padding: 10px; text-align: right; color: ${color}; font-weight: 600;">
                ${sign}${percent.toFixed(2)}%
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function initSuggestionEvents() {
    const input = document.getElementById('suggestion-threshold');
    const applyBtn = document.getElementById('suggestion-apply-btn');
    if (!input || !applyBtn) return;

    applyBtn.addEventListener('click', function() {
        const val = parseFloat(input.value) || 50;
        const portfolioId = document.getElementById('suggestion-portfolio-select')?.value || null;
        loadSuggestionData(val, portfolioId);
    });

    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = parseFloat(this.value) || 50;
            const portfolioId = document.getElementById('suggestion-portfolio-select')?.value || null;
            loadSuggestionData(val, portfolioId);
        }
    });

    input.addEventListener('change', function() {
        const val = parseFloat(this.value) || 50;
        const portfolioId = document.getElementById('suggestion-portfolio-select')?.value || null;
        loadSuggestionData(val, portfolioId);
    });
}

window.loadSuggestionData = loadSuggestionData;
window.initSuggestionEvents = initSuggestionEvents;

// ==========================================
// ১০. DOMContentLoaded – সব ইভেন্ট ইনিশিয়ালাইজ
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('statement-ticker')) {
        initStatementSearch();
    }
    if (typeof initSellTabs === 'function') initSellTabs();
    if (typeof initSellHistorySearch === 'function') initSellHistorySearch();
    if (typeof initBuyTabs === 'function') initBuyTabs();
    if (typeof initBuyHistorySearch === 'function') initBuyHistorySearch();
    if (document.getElementById('suggestion-threshold')) {
        initSuggestionEvents();
    }

    const executeBtn = document.getElementById('btn-execute-batch-sell');
    if (executeBtn) {
        executeBtn.addEventListener('click', window.executeBatchSell);
    }
    const clearBtn = document.getElementById('btn-clear-batch');
    if (clearBtn) {
        clearBtn.addEventListener('click', window.clearBatch);
    }

    // পোর্টফোলিও সিলেক্টর ইভেন্ট – Buy, Sell, Analysis, History, Suggestion, Dividend
    const portfolioSelectors = document.querySelectorAll('[id$="-portfolio-select"]');
    portfolioSelectors.forEach(select => {
        select.addEventListener('change', function() {
            const id = this.id;
            const portfolioId = this.value;
            if (id === 'buy-portfolio-select') {
                // Buy-তে কিছু করার নেই
            } else if (id === 'sell-portfolio-select') {
                const ticker = document.getElementById('sell-ticker')?.value.trim().toUpperCase();
                if (ticker) {
                    fetchHoldingsForSell(ticker, portfolioId);
                }
            } else if (id === 'analysis-portfolio-select') {
                const ticker = document.getElementById('analysis-ticker')?.value.trim().toUpperCase();
                if (ticker) {
                    generateAnalysisStatement(ticker, portfolioId);
                }
            } else if (id === 'buy-history-portfolio-select') {
                const ticker = document.getElementById('buy-history-search')?.value.trim().toUpperCase();
                if (ticker) {
                    loadBuyHistory(ticker, portfolioId);
                }
            } else if (id === 'sell-history-portfolio-select') {
                const ticker = document.getElementById('sell-history-search')?.value.trim().toUpperCase();
                if (ticker) {
                    loadSellHistory(ticker, portfolioId);
                }
            } else if (id === 'statement-portfolio-select') {
                loadStatementData();
            } else if (id === 'suggestion-portfolio-select') {
                const threshold = document.getElementById('suggestion-threshold')?.value || 50;
                loadSuggestionData(parseFloat(threshold), portfolioId);
            } else if (id === 'dividend-portfolio-select') {
                loadDividendData(portfolioId);
            }
        });
    });
});
// ==========================================
// 📥 CSV ডাউনলোড – শুধু দৃশ্যমান ডেটা
// ==========================================
window.downloadTableAsCSV = function() {
    const table = document.querySelector('#sec-table table');
    if (!table) {
        showToast('📋 Table not found!', 'error');
        return;
    }

    // শুধু দৃশ্যমান সারি (filter/sort/pagination applied)
    const rows = table.querySelectorAll('tr:not([style*="display: none"]):not([style*="display:none"])');
    if (rows.length === 0) {
        showToast('No visible data to download.', 'warning');
        return;
    }

    let csvContent = '';
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel

    // ১. হেডার রো (প্রথম দৃশ্যমান সারি)
    const headerCells = rows[0].querySelectorAll('th, td');
    const headerRow = Array.from(headerCells).map(cell => {
        let text = cell.innerText.trim();
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            text = `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }).join(',');
    csvContent += headerRow + '\n';

    // ২. ডেটা রো (বাকি দৃশ্যমান সারি)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // যদি সারি লুকানো থাকে, স্কিপ
        if (row.style.display === 'none') continue;

        const cells = row.querySelectorAll('th, td');
        if (cells.length === 0) continue;

        const rowData = Array.from(cells).map(cell => {
            let text = cell.innerText.trim();
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                text = `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        }).join(',');
        csvContent += rowData + '\n';
    }

    // ৩. ব্লব তৈরি ও ডাউনলোড
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `stock_portfolio_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('✅ CSV downloaded successfully!', 'success');
};

console.log('✅ portfolio.js loaded successfully (Supabase + Firebase ফ্যালব্যাক + ডুয়াল রাইট + পোর্টফোলিও আইডি সাপোর্ট)');