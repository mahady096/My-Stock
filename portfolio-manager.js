// ==========================================
// 📂 portfolio-manager.js - সম্পূর্ণ ইরর-ফ্রি ভার্সন v2.0
//    Create, Edit, Delete, Access, List View
//    সব পোর্টফোলিও সিলেক্টর অটো-আপডেট
// ==========================================

let currentPortfolioMeta = null;
let portfolioSummaries = {};
let currentSelectedPortfolio = 'main';

// ==========================================
// 🚀 পোর্টফোলিও ম্যানেজার ওপেন
// ==========================================
window.openPortfolioManager = async function() {
    const modal = document.getElementById('portfolio-manager-modal');
    if (!modal) {
        console.warn('⚠️ portfolio-manager-modal not found');
        return;
    }
    
    const user = auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    
    modal.style.display = 'flex';
    await loadPortfolioManagerData();
};

window.closePortfolioManager = function() {
    const modal = document.getElementById('portfolio-manager-modal');
    if (modal) modal.style.display = 'none';
};

// ==========================================
// 📊 ডেটা লোড ও কার্ড রেন্ডার
// ==========================================
window.loadPortfolioManagerData = async function() {
    const user = auth.currentUser;
    if (!user) return;
    
    const grid = document.getElementById('portfolio-cards-grid');
    if (!grid) return;
    
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">⏳ Loading portfolios...</div>';
    
    try {
        // ১. মেটাডেটা লোড
        const meta = await getPortfolioMeta(user.uid);
        currentPortfolioMeta = meta;
        
        // ২. প্রতিটি পোর্টফোলিওর সামারি ক্যালকুলেট
        const summaries = {};
        for (const p of meta.portfolios) {
            const data = await unifiedEngine.calculate(user.uid, p.id, true);
            if (data) {
                // ডিপোজিট
                const deposit = await getUserDeposit(user.uid) || 0;
                const cash = deposit - (data.totalInvestment || 0);
                
                let dailyGL = 0, dailyPct = 0;
                let totalGL = 0, totalPct = 0;
                let totalCurrentValue = 0;
                
                const tickers = data.stockDetails.map(s => s.ticker);
                if (tickers.length > 0) {
                    const priceMap = await getLatestAndPreviousPrices(tickers);
                    for (const stock of data.stockDetails) {
                        const priceData = priceMap.get(stock.ticker);
                        const currentPrice = priceData?.currentPrice || 0;
                        const prevPrice = priceData?.previousPrice || 0;
                        const qty = stock.totalQty || 0;
                        const cost = stock.totalCost || 0;
                        const currentValue = qty * currentPrice;
                        totalCurrentValue += currentValue;
                        const gl = currentValue - cost;
                        totalGL += gl;
                        if (prevPrice > 0 && qty > 0) {
                            const daily = qty * (currentPrice - prevPrice);
                            dailyGL += daily;
                        }
                    }
                    totalPct = data.totalInvestment > 0 ? (totalGL / data.totalInvestment) * 100 : 0;
                    dailyPct = data.totalInvestment > 0 ? (dailyGL / data.totalInvestment) * 100 : 0;
                } else {
                    totalCurrentValue = data.totalInvestment || 0;
                }
                
                summaries[p.id] = {
                    name: p.name,
                    type: p.type,
                    isDefault: p.isDefault || false,
                    totalInvestment: data.totalInvestment || 0,
                    totalCurrentValue: totalCurrentValue,
                    totalQty: data.totalRemainingQty || 0,
                    cash: cash,
                    dailyGL: dailyGL,
                    dailyPct: dailyPct,
                    totalGL: totalGL,
                    totalPct: totalPct,
                };
            }
        }
        portfolioSummaries = summaries;
        
        // ৩. গ্র্যান্ড টোটাল
        const grandData = await unifiedEngine.calculate(user.uid, null, true);
        if (grandData) {
            const deposit = await getUserDeposit(user.uid) || 0;
            const cash = deposit - (grandData.totalInvestment || 0);
            let grandDailyGL = 0, grandTotalGL = 0, grandTotalCurrentValue = 0;
            const tickers = grandData.stockDetails.map(s => s.ticker);
            if (tickers.length > 0) {
                const priceMap = await getLatestAndPreviousPrices(tickers);
                for (const stock of grandData.stockDetails) {
                    const priceData = priceMap.get(stock.ticker);
                    const currentPrice = priceData?.currentPrice || 0;
                    const prevPrice = priceData?.previousPrice || 0;
                    const qty = stock.totalQty || 0;
                    const cost = stock.totalCost || 0;
                    const currentValue = qty * currentPrice;
                    grandTotalCurrentValue += currentValue;
                    const gl = currentValue - cost;
                    grandTotalGL += gl;
                    if (prevPrice > 0 && qty > 0) {
                        grandDailyGL += qty * (currentPrice - prevPrice);
                    }
                }
            } else {
                grandTotalCurrentValue = grandData.totalInvestment || 0;
            }
            summaries['grand'] = {
                name: '📊 Grand Portfolio',
                type: 'main',
                isDefault: true,
                totalInvestment: grandData.totalInvestment || 0,
                totalCurrentValue: grandTotalCurrentValue,
                totalQty: grandData.totalRemainingQty || 0,
                cash: cash,
                dailyGL: grandDailyGL,
                dailyPct: grandData.totalInvestment > 0 ? (grandDailyGL / grandData.totalInvestment) * 100 : 0,
                totalGL: grandTotalGL,
                totalPct: grandData.totalInvestment > 0 ? (grandTotalGL / grandData.totalInvestment) * 100 : 0,
            };
        }
        
        renderPortfolioCards();
        updateAllPortfolioSelectors();
        updateSidebarPortfolioList();
        updateBuyPortfolioSelect();
        
    } catch (error) {
        console.error('Error loading portfolio manager:', error);
        grid.innerHTML = `<div style="text-align: center; padding: 40px; color: red;">❌ Error loading portfolios: ${error.message}</div>`;
    }
};

// ==========================================
// 🖥️ পোর্টফোলিও কার্ড রেন্ডার
// ==========================================
window.renderPortfolioCards = function() {
    const grid = document.getElementById('portfolio-cards-grid');
    if (!grid) return;
    
    if (!currentPortfolioMeta || !currentPortfolioMeta.portfolios) {
        grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No portfolios found.</div>';
        return;
    }
    
    let html = '';
    
    // গ্র্যান্ড পোর্টফোলিও
    const grand = portfolioSummaries['grand'];
    if (grand) {
        html += createPortfolioCardHTML('grand', grand);
    }
    
    // বাকি পোর্টফোলিও
    for (const p of currentPortfolioMeta.portfolios) {
        const summary = portfolioSummaries[p.id];
        if (summary) {
            html += createPortfolioCardHTML(p.id, summary);
        }
    }
    
    grid.innerHTML = html;
};

// ==========================================
// 🏷️ পোর্টফোলিও কার্ড HTML তৈরি
// ==========================================
function createPortfolioCardHTML(portfolioId, summary) {
    const isMain = portfolioId === 'grand' || summary.type === 'main';
    const isActive = summary.totalQty > 0;
    
    const totalInvestment = summary.totalInvestment || 0;
    const totalCurrentValue = summary.totalCurrentValue || 0;
    const dailyGL = summary.dailyGL || 0;
    const dailyPct = summary.dailyPct || 0;
    const totalGL = summary.totalGL || 0;
    const totalPct = summary.totalPct || 0;
    const cash = summary.cash || 0;
    
    const dailyColor = dailyGL >= 0 ? '#10b981' : '#ef4444';
    const totalColor = totalGL >= 0 ? '#10b981' : '#ef4444';
    const cashColor = cash >= 0 ? '#10b981' : '#ef4444';
    
    const name = summary.name || (portfolioId === 'grand' ? '📊 Grand Portfolio' : portfolioId);
    const badgeMain = isMain ? '<span class="card-badge card-badge-main">MAIN</span>' : '';
    const badgeStatus = isActive 
        ? '<span class="card-badge card-badge-active">🟢 Active</span>' 
        : '<span class="card-badge card-badge-empty">⚪ Empty</span>';
    
    const deleteBtn = !isMain ? 
        `<button class="btn-delete" onclick="deletePortfolioHandler('${portfolioId}')" ${isActive ? 'disabled title="Cannot delete: portfolio has shares"' : ''}>
            🗑️ DELETE
        </button>` : '';
    
    const editBtn = !isMain ? 
        `<button class="btn-edit" onclick="editPortfolioHandler('${portfolioId}')">✏️ EDIT</button>` : '';
    
    return `
        <div class="portfolio-card" style="${isMain ? 'border-left: 4px solid var(--primary-color);' : ''}">
            <div class="card-header">
                <div>
                    <span class="card-name">${name}</span>
                    ${badgeMain}
                    <div style="margin-top: 4px;">${badgeStatus}</div>
                </div>
                <span style="font-size: 12px; color: var(--text-muted);">${summary.totalQty || 0} shares</span>
            </div>
            
            <div class="card-stats">
                <div>
                    <div class="stat-label">Port Size</div>
                    <div class="stat-value">৳${totalInvestment.toFixed(2)}</div>
                </div>
                <div>
                    <div class="stat-label">Cash</div>
                    <div class="stat-value" style="color: ${cashColor};">৳${cash.toFixed(2)}</div>
                </div>
            </div>
            
            <div class="card-pl-grid">
                <div>
                    <div class="pl-label">Value/Cost</div>
                    <div class="pl-value">${totalCurrentValue.toFixed(0)}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">/${totalInvestment.toFixed(0)}</div>
                </div>
                <div>
                    <div class="pl-label">Daily G/L</div>
                    <div class="pl-value" style="color: ${dailyColor};">${dailyGL >= 0 ? '+' : ''}${dailyGL.toFixed(2)}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%</div>
                </div>
                <div>
                    <div class="pl-label">Total G/L</div>
                    <div class="pl-value" style="color: ${totalColor};">${totalGL >= 0 ? '+' : ''}${totalGL.toFixed(2)}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%</div>
                </div>
            </div>
            
            <div class="card-actions">
                ${deleteBtn}
                ${editBtn}
                <button class="btn-access" onclick="accessPortfolioHandler('${portfolioId}')">🔍 ACCESS</button>
            </div>
        </div>
    `;
}

// ==========================================
// 🎯 পোর্টফোলিও অ্যাকশন হ্যান্ডলার
// ==========================================

// 🗑️ DELETE
window.deletePortfolioHandler = async function(portfolioId) {
    if (portfolioId === 'main' || portfolioId === 'grand') {
        if (typeof showToast === 'function') showToast('Cannot delete main portfolio', 'warning');
        return;
    }
    const name = getPortfolioNameFromMeta(portfolioId);
    if (!confirm(`Are you sure you want to delete portfolio "${name}"? This action cannot be undone.`)) {
        return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const success = await deletePortfolio(user.uid, portfolioId);
    if (success) {
        if (typeof showToast === 'function') showToast('✅ Portfolio deleted successfully', 'success');
        await loadPortfolioManagerData();
        updateAllPortfolioSelectors();
        updateSidebarPortfolioList();
        updateBuyPortfolioSelect();
    } else {
        if (typeof showToast === 'function') showToast('❌ Cannot delete: portfolio may have shares', 'error');
    }
};

// ✏️ EDIT
window.editPortfolioHandler = function(portfolioId) {
    const currentName = getPortfolioNameFromMeta(portfolioId);
    const newName = prompt('Enter new portfolio name:', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
        renamePortfolioHandler(portfolioId, newName.trim());
    }
};

async function renamePortfolioHandler(portfolioId, newName) {
    const user = auth.currentUser;
    if (!user) return;
    const success = await renamePortfolio(user.uid, portfolioId, newName);
    if (success) {
        if (typeof showToast === 'function') showToast('✅ Portfolio renamed successfully', 'success');
        await loadPortfolioManagerData();
        updateAllPortfolioSelectors();
        updateSidebarPortfolioList();
        updateBuyPortfolioSelect();
    } else {
        if (typeof showToast === 'function') showToast('❌ Failed to rename portfolio', 'error');
    }
}

// 🔍 ACCESS
window.accessPortfolioHandler = function(portfolioId) {
    closePortfolioManager();
    // পোর্টফোলিও অ্যানালাইসিস ট্যাবে যান
    if (typeof switchTab === 'function') switchTab('portfolio-analysis');
    // পোর্টফোলিও আইডি সেট করুন
    currentSelectedPortfolio = portfolioId;
    // টেবিল রিলোড করুন
    const user = auth.currentUser;
    if (user && typeof loadPortfolioAnalysisTable === 'function') {
        loadPortfolioAnalysisTable(user.uid, portfolioId === 'grand' ? null : portfolioId, true);
        const name = portfolioId === 'grand' ? 'Grand Portfolio' : getPortfolioNameFromMeta(portfolioId);
        const header = document.querySelector('#sec-portfolio-analysis h3');
        if (header) header.innerHTML = `📊 ${name} - Analysis`;
    }
};

// ==========================================
// 📋 হেলপার ফাংশন
// ==========================================
function getPortfolioNameFromMeta(portfolioId) {
    if (!currentPortfolioMeta) return portfolioId === 'grand' ? '📊 Grand Portfolio' : portfolioId;
    const found = currentPortfolioMeta.portfolios.find(p => p.id === portfolioId);
    return found ? found.name : (portfolioId === 'grand' ? '📊 Grand Portfolio' : portfolioId);
}

// ==========================================
// 🔄 সব পোর্টফোলিও সিলেক্টর আপডেট (সব ট্যাবের জন্য)
// ==========================================
window.updateAllPortfolioSelectors = function() {
    const selectors = document.querySelectorAll('[id$="-portfolio-select"]');
    selectors.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '';
        
        // গ্র্যান্ড পোর্টফোলিও
        const grandOption = document.createElement('option');
        grandOption.value = 'grand';
        grandOption.textContent = '📊 Grand Portfolio';
        select.appendChild(grandOption);
        
        // মেইন পোর্টফোলিও
        const mainOption = document.createElement('option');
        mainOption.value = 'main';
        mainOption.textContent = '📊 Main Portfolio';
        select.appendChild(mainOption);
        
        // ইউজারের তৈরি পোর্টফোলিও
        if (currentPortfolioMeta && currentPortfolioMeta.portfolios) {
            currentPortfolioMeta.portfolios.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });
        }
        
        // আগের সিলেক্টেড ভ্যালু রিস্টোর
        if (currentValue) select.value = currentValue;
    });
};

// ==========================================
// 📂 সাইডবার পোর্টফোলিও লিস্ট আপডেট
// ==========================================
window.updateSidebarPortfolioList = function() {
    const subList = document.getElementById('portfolio-sub-list');
    if (!subList) return;
    if (!currentPortfolioMeta || !currentPortfolioMeta.portfolios) {
        subList.innerHTML = '';
        return;
    }
    let html = '';
    for (const p of currentPortfolioMeta.portfolios) {
        const isActive = currentSelectedPortfolio === p.id;
        html += `
            <li onclick="switchToPortfolio('${p.id}')" style="padding: 6px 16px; border-radius: 4px; transition: background 0.2s; cursor: pointer; ${isActive ? 'background: var(--sidebar-active); color: white;' : ''}"
                onmouseover="this.style.background='var(--sidebar-hover)'" onmouseout="this.style.background='${isActive ? 'var(--sidebar-active)' : 'transparent'}'">
                ${p.name}
            </li>
        `;
    }
    subList.innerHTML = html;
};

// ==========================================
// 🛒 Buy ফর্মের পোর্টফোলিও সিলেক্টর আপডেট
// ==========================================
window.updateBuyPortfolioSelect = function() {
    const select = document.getElementById('buy-portfolio-select');
    if (!select) return;
    if (!currentPortfolioMeta || !currentPortfolioMeta.portfolios) {
        select.innerHTML = '<option value="main">📊 Main Portfolio</option>';
        return;
    }
    let html = '';
    // Buy-তে গ্র্যান্ড সিলেক্ট করা যায় না, তাই শুধু সাব পোর্টফোলিও
    for (const p of currentPortfolioMeta.portfolios) {
        const selected = (currentSelectedPortfolio === p.id) ? 'selected' : '';
        html += `<option value="${p.id}" ${selected}>${p.name}</option>`;
    }
    select.innerHTML = html;
};

// ==========================================
// 🔄 পোর্টফোলিও সুইচ (সাইডবার থেকে)
// ==========================================
window.switchToPortfolio = function(portfolioId) {
    currentSelectedPortfolio = portfolioId;
    updateSidebarPortfolioList();
    updateBuyPortfolioSelect();
    updateAllPortfolioSelectors();
    
    const user = auth.currentUser;
    if (user) {
        // ড্যাশবোর্ড রিলোড
        const dashboardSection = document.getElementById('sec-dashboard');
        if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
            loadDashboardDataForPortfolio(portfolioId);
        }
        // পোর্টফোলিও অ্যানালাইসিস রিলোড
        const paSection = document.getElementById('sec-portfolio-analysis');
        if (paSection && !paSection.classList.contains('hidden') && typeof loadPortfolioAnalysisTable === 'function') {
            loadPortfolioAnalysisTable(user.uid, portfolioId === 'grand' ? null : portfolioId, true);
        }
    }
    const name = portfolioId === 'grand' ? 'Grand Portfolio' : getPortfolioNameFromMeta(portfolioId);
    if (typeof showToast === 'function') showToast(`Switched to ${name}`, 'info');
};

async function loadDashboardDataForPortfolio(portfolioId) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const data = await unifiedEngine.calculate(user.uid, portfolioId === 'grand' ? null : portfolioId, true);
        if (typeof updateDashboardCards === 'function') {
            updateDashboardCards(data);
        }
    } catch (e) {
        console.warn('Dashboard update error:', e);
    }
}

// ==========================================
// ➕ নতুন পোর্টফোলিও তৈরি
// ==========================================
window.createNewPortfolioFromSidebar = function() {
    openPortfolioManager();
    const input = document.getElementById('new-portfolio-name-input');
    if (input) input.focus();
};

window.createNewPortfolio = async function() {
    const input = document.getElementById('new-portfolio-name-input');
    const status = document.getElementById('new-portfolio-status');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
        if (status) status.innerText = '⚠️ Please enter a name';
        return;
    }
    const user = auth.currentUser;
    if (!user) {
        if (typeof showToast === 'function') showToast('Please login first', 'error');
        return;
    }
    const id = await createPortfolio(user.uid, name);
    if (id) {
        if (status) status.innerText = '✅ Portfolio created!';
        input.value = '';
        if (typeof showToast === 'function') showToast(`✅ Portfolio "${name}" created successfully`, 'success');
        await loadPortfolioManagerData();
        updateAllPortfolioSelectors();
        updateSidebarPortfolioList();
        updateBuyPortfolioSelect();
        setTimeout(() => { if (status) status.innerText = ''; }, 3000);
    } else {
        if (status) status.innerText = '❌ Failed to create portfolio';
        if (typeof showToast === 'function') showToast('❌ Failed to create portfolio', 'error');
    }
};

// ==========================================
// 🎚️ ড্রপডাউন টগল (সাইডবার)
// ==========================================
window.togglePortfolioDropdown = function() {
    const dropdown = document.getElementById('portfolio-dropdown');
    const arrow = document.getElementById('portfolio-arrow');
    if (!dropdown) return;
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
        if (arrow) arrow.textContent = '▼';
        if (auth.currentUser) {
            loadPortfolioManagerData();
        }
    } else {
        dropdown.style.display = 'none';
        if (arrow) arrow.textContent = '▶';
    }
};

// ==========================================
// 🌐 গ্লোবাল এক্সপোজ (সব ফাংশন উইন্ডোতে)
// ==========================================
window.openPortfolioManager = openPortfolioManager;
window.closePortfolioManager = closePortfolioManager;
window.loadPortfolioManagerData = loadPortfolioManagerData;
window.renderPortfolioCards = renderPortfolioCards;
window.deletePortfolioHandler = deletePortfolioHandler;
window.editPortfolioHandler = editPortfolioHandler;
window.accessPortfolioHandler = accessPortfolioHandler;
window.switchToPortfolio = switchToPortfolio;
window.createNewPortfolio = createNewPortfolio;
window.createNewPortfolioFromSidebar = createNewPortfolioFromSidebar;
window.togglePortfolioDropdown = togglePortfolioDropdown;
window.updateSidebarPortfolioList = updateSidebarPortfolioList;
window.updateBuyPortfolioSelect = updateBuyPortfolioSelect;
window.updateAllPortfolioSelectors = updateAllPortfolioSelectors;
window.getPortfolioNameFromMeta = getPortfolioNameFromMeta;

console.log('✅ portfolio-manager.js v2.0 loaded successfully');