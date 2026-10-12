// ==========================================
// 💡 trade-suggestion.js - Buy/Sell Suggestion
//    portfolio.js থেকে ভাগ করা (ফাইল ৩)
//    থ্রেশহোল্ড ভিত্তিক সাজেশন
// ==========================================

async function loadSuggestionData(threshold = null, portfolioId = null) {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
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

    buyTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">⏳ Loading buy suggestions...</td></tr>`;
    sellTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">⏳ Loading sell suggestions...</td></tr>`;

    try {
        const unifiedData = await unifiedEngine.calculate(user.uid, portfolioId || null, true);
        if (!unifiedData || !unifiedData.stockDetails || unifiedData.stockDetails.length === 0) {
            const empty = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No stocks in portfolio.</td></tr>`;
            buyTbody.innerHTML = empty;
            sellTbody.innerHTML = empty;
            return;
        }

        const tickers = unifiedData.stockDetails.map(s => s.ticker);
        const currentPrices = await Promise.all(tickers.map(t => getUnifiedPrice(t)));

        // IMPORTANT: Threshold is evaluated independently for every remaining FIFO lot.
        // BUY  = current price is threshold% or more BELOW that lot's buy price.
        // SELL = current price is threshold% or more ABOVE that lot's buy price.
        const buyLots = [];
        const sellLots = [];
        const sellBoundary = 1 + (threshold / 100);
        const buyBoundary = 1 - (threshold / 100);

        for (let i = 0; i < unifiedData.stockDetails.length; i++) {
            const stock = unifiedData.stockDetails[i];
            const currentPrice = Number(currentPrices[i]) || 0;
            if (currentPrice <= 0 || !Array.isArray(stock.lots)) continue;

            stock.lots.forEach((lot, lotIndex) => {
                const qty = Number(lot.qty) || 0;
                const buyPrice = Number(lot.buyPrice) || 0;
                if (qty <= 0 || buyPrice <= 0) return;

                const unrealizedGL = (currentPrice - buyPrice) * qty;
                const unrealizedPercent = ((currentPrice - buyPrice) / buyPrice) * 100;
                const lotData = {
                    ticker: stock.ticker,
                    lotNumber: lotIndex + 1,
                    lotDate: lot.date,
                    buyPrice,
                    qty,
                    currentPrice,
                    unrealizedGL,
                    unrealizedPercent
                };

                if (currentPrice >= buyPrice * sellBoundary) {
                    sellLots.push(lotData);
                } else if (currentPrice <= buyPrice * buyBoundary) {
                    buyLots.push(lotData);
                }
            });
        }

        buyLots.sort((a, b) => a.unrealizedPercent - b.unrealizedPercent);
        sellLots.sort((a, b) => b.unrealizedPercent - a.unrealizedPercent);

        renderSuggestionTable(buyTbody, buyLots, 'buy', threshold);
        renderSuggestionTable(sellTbody, sellLots, 'sell', threshold);

        // Keep the section headings synchronized with the selected threshold.
        const buyHeading = document.querySelector('#suggestion-buy-table')?.closest('div[style*="border-left: 4px solid #10b981"]')?.querySelector('h4');
        const sellHeading = document.querySelector('#suggestion-sell-table')?.closest('div[style*="border-left: 4px solid #ef4444"]')?.querySelector('h4');
        if (buyHeading) buyHeading.textContent = `📈 Buy Suggestion (Loss ≥ ${threshold}%)`;
        if (sellHeading) sellHeading.textContent = `📉 Sell Suggestion (Gain ≥ ${threshold}%)`;
    } catch (error) {
        console.error('Suggestion error:', error);
        buyTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">Error loading data.</td></tr>`;
        sellTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">Error loading data.</td></tr>`;
    }
}

function formatSuggestionLotDate(value) {
    if (!value) return '-';
    try {
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
        return '-';
    }
}

function renderSuggestionTable(tbody, data, type, threshold = null) {
    const selectedThreshold = threshold ?? (parseFloat(document.getElementById('suggestion-threshold')?.value || '50') || 50);
    if (!data || data.length === 0) {
        const msg = type === 'buy'
            ? `🎉 No lots with ${selectedThreshold}%+ loss.`
            : `😊 No lots with ${selectedThreshold}%+ gain.`;
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">${msg}</td></tr>`;
        return;
    }

    const isBuy = type === 'buy';
    const color = isBuy ? '#10b981' : '#ef4444';
    let html = '';
    data.forEach(item => {
        const percent = item.unrealizedPercent;
        const glValue = item.unrealizedGL;
        const date = formatSuggestionLotDate(item.lotDate);
        const signedGL = `${glValue >= 0 ? '+' : '-'}৳${Math.abs(glValue).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
        const signedPct = `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
        html += `<tr>
            <td style="padding: 10px; font-weight: bold; cursor: pointer; color: var(--primary-color); text-decoration: underline; white-space: nowrap;"
                onclick="openStockDetailModal('${String(item.ticker).replace(/'/g, "\\'")}')">${item.ticker}</td>
            <td style="padding: 10px; text-align: center; white-space: nowrap;">Lot ${item.lotNumber}<br><small style="color: var(--text-muted);">${date}</small></td>
            <td style="padding: 10px; text-align: right; white-space: nowrap;">৳${item.buyPrice.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; white-space: nowrap;">${item.qty}</td>
            <td style="padding: 10px; text-align: right; white-space: nowrap;">৳${item.currentPrice.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; color: ${color}; font-weight: 600; white-space: nowrap;">${signedGL}</td>
            <td style="padding: 10px; text-align: right; color: ${color}; font-weight: 600; white-space: nowrap;">${signedPct}</td>
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

// গ্লোবাল এক্সপোজ
window.loadSuggestionData = loadSuggestionData;
window.initSuggestionEvents = initSuggestionEvents;

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('suggestion-threshold')) {
        initSuggestionEvents();
    }
});

console.log('✅ trade-suggestion.js loaded successfully');