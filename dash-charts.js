// ==========================================
// 📊 dash-charts.js - চার্ট রেন্ডারিং
//    dashboard.js থেকে ভাগ করা (ফাইল ৩)
//    পোর্টফোলিও গ্রোথ ও ডেইলি P&L চার্ট
// ==========================================

// ==========================================
// ১. ড্যাশবোর্ড চার্ট রেন্ডার (পোর্টফোলিও গ্রোথ)
// ==========================================

async function renderDashboardHistoryChart(startDate = null, endDate = null) {
    const canvas = document.getElementById('dashboardHistoryChart');
    if (!canvas) return;

    const parent = canvas.parentElement;
    let loadingDiv = document.getElementById('chart-loading-placeholder');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'chart-loading-placeholder';
        loadingDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; justify-content: center; align-items: center;
            color: var(--text-muted); font-size: 14px; z-index: 10;
            background: var(--bg-secondary); border-radius: 12px;
        `;
        loadingDiv.innerHTML = '⏳ Loading portfolio history...';
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(loadingDiv);
        }
    } else {
        loadingDiv.style.display = 'flex';
        loadingDiv.innerHTML = '⏳ Loading portfolio history...';
    }

    try {
        const historyData = await fetchPortfolioTimelineData(startDate, endDate, window.currentDashboardPortfolioId);
        if (!historyData || historyData.length === 0) {
            if (loadingDiv) loadingDiv.innerHTML = '📭 No history data available';
            return;
        }

        let displayData = historyData;
        if (historyData.length > 100) {
            const step = Math.ceil(historyData.length / 100);
            displayData = historyData.filter((_, index) => index % step === 0);
        }

        const labels = displayData.map(item => item.date);
        const investData = displayData.map(item => item.totalInvestment);
        const valueData = displayData.map(item => item.totalCurrentValue);

        if (loadingDiv) loadingDiv.remove();

        if (window.dashboardChartInstance) {
            window.dashboardChartInstance.destroy();
            window.dashboardChartInstance = null;
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const ctx = canvas.getContext('2d');
        window.dashboardChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { 
                        label: 'Total Investment', 
                        data: investData, 
                        borderColor: '#3b82f6', 
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderWidth: 2.5, 
                        tension: 0.2, 
                        fill: true,
                        pointRadius: 2,
                        pointBackgroundColor: '#3b82f6'
                    },
                    { 
                        label: 'Current Value', 
                        data: valueData, 
                        borderColor: '#10b981', 
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        borderWidth: 2.5, 
                        tension: 0.2, 
                        fill: true,
                        pointRadius: 2,
                        pointBackgroundColor: '#10b981'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { 
                        position: 'top', 
                        labels: { color: textColor, boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                if (val === null || val === undefined) return null;
                                return `${ctx.dataset.label}: ৳${val.toLocaleString('bn-BD', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: textColor, maxRotation: 45, font: { size: 9 } }, 
                        grid: { color: gridColor } 
                    },
                    y: { 
                        ticks: { color: textColor, callback: (v) => '৳' + v.toLocaleString() }, 
                        grid: { color: gridColor } 
                    }
                }
            }
        });

    } catch (error) {
        console.error('Chart render error:', error);
        if (loadingDiv) loadingDiv.innerHTML = '❌ Failed to load chart';
    }
}

// ==========================================
// ২. ড্যাশবোর্ড চার্ট রেন্ডার (ডেইলি P&L)
// ==========================================

async function renderDashboardDailyPLChart(startDate = null, endDate = null) {
    const canvas = document.getElementById('dashboardDailyPLChart');
    if (!canvas) return;

    const parent = canvas.parentElement;
    let loadingDiv = document.getElementById('daily-pl-chart-loading');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'daily-pl-chart-loading';
        loadingDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; justify-content: center; align-items: center;
            color: var(--text-muted); font-size: 14px; z-index: 10;
            background: var(--bg-secondary); border-radius: 12px;
        `;
        loadingDiv.innerHTML = '⏳ Loading daily P&L...';
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(loadingDiv);
        }
    } else {
        loadingDiv.style.display = 'flex';
        loadingDiv.innerHTML = '⏳ Loading daily P&L...';
    }

    try {
        const historyData = await fetchPortfolioTimelineData(startDate, endDate, window.currentDashboardPortfolioId);
        if (!historyData || historyData.length === 0) {
            if (loadingDiv) loadingDiv.innerHTML = '📭 No history data available';
            return;
        }

        const labels = historyData.map(item => item.date);
        const dailyPLData = historyData.map(item => item.dailyPL);

        let displayLabels = labels;
        let displayPL = dailyPLData;
        if (labels.length > 100) {
            const step = Math.ceil(labels.length / 100);
            displayLabels = labels.filter((_, index) => index % step === 0);
            displayPL = dailyPLData.filter((_, index) => index % step === 0);
        }

        if (loadingDiv) loadingDiv.remove();

        if (window.dailyPLChartInstance) {
            window.dailyPLChartInstance.destroy();
            window.dailyPLChartInstance = null;
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const ctx = canvas.getContext('2d');
        window.dailyPLChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: displayLabels,
                datasets: [{
                    label: 'Daily P&L (৳)',
                    data: displayPL,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.2,
                    fill: true,
                    pointRadius: 2,
                    pointBackgroundColor: '#8b5cf6',
                    segment: {
                        borderColor: (ctx) => {
                            const value = ctx.p0.parsed.y;
                            return value >= 0 ? '#10b981' : '#ef4444';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top', 
                        labels: { color: textColor, boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                if (val === null || val === undefined) return null;
                                return `Daily P&L: ${val >= 0 ? '+' : ''}৳${val.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: textColor, maxRotation: 45, font: { size: 9 } }, 
                        grid: { color: gridColor } 
                    },
                    y: { 
                        ticks: { color: textColor, callback: (v) => '৳' + v.toFixed(0) }, 
                        grid: { color: gridColor } 
                    }
                }
            }
        });

    } catch (error) {
        console.error('Daily PL chart error:', error);
        if (loadingDiv) loadingDiv.innerHTML = '❌ Failed to load chart';
    }
}

// ==========================================
// ৩. ড্যাশবোর্ড ডেট ফিল্টার
// ==========================================

window.applyDashboardDateFilter = function() {
    const start = document.getElementById('dash-chart-start')?.value;
    const end = document.getElementById('dash-chart-end')?.value;
    if (start && end) {
        renderDashboardChartsWithRange(start, end);
    } else {
        if (typeof showToast === 'function') showToast('Please select both dates.', 'warning');
    }
};

window.resetDashboardDateFilter = function() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const start = thirtyDaysAgo.toISOString().split('T')[0];
    const end = today.toISOString().split('T')[0];
    const startInput = document.getElementById('dash-chart-start');
    const endInput = document.getElementById('dash-chart-end');
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    renderDashboardChartsWithRange(start, end);
};

// ==========================================
// ৪. রেঞ্জ সহ চার্ট রেন্ডার (হেলপার)
// ==========================================

async function renderDashboardChartsWithRange(start, end) {
    const historyData = await fetchPortfolioTimelineData(start, end);
    if (!historyData || historyData.length === 0) {
        if (typeof showToast === 'function') showToast('No data in selected range.', 'warning');
        return;
    }
    await renderDashboardHistoryChart(start, end);
    await renderDashboardDailyPLChart(start, end);
}

// ==========================================
// Clickable dashboard cards → last 30 days chart
// ==========================================
const DASHBOARD_CARD_METRICS = {
    value: { title: 'Grand Portfolio Value — Last 30 Days', label: 'Portfolio Value (৳)', color: '#10b981', value: row => Number(row.totalCurrentValue) || 0 },
    investment: { title: 'Total Investment — Last 30 Days', label: 'Total Investment (৳)', color: '#3b82f6', value: row => Number(row.totalInvestment) || 0 },
    dailyPL: { title: 'Daily P&L — Last 30 Days', label: 'Daily P&L (৳)', color: '#8b5cf6', value: row => Number(row.dailyPL) || 0 },
    totalPL: { title: 'Total P&L — Last 30 Days', label: 'Total P&L (৳)', color: '#f59e0b', value: row => (Number(row.totalCurrentValue) || 0) - (Number(row.totalInvestment) || 0) }
};

function dashboardLocalDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function ensureDashboardCardHistoryModal() {
    let modal = document.getElementById('dashboard-card-history-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'dashboard-card-history-modal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:10050; padding:18px; background:rgba(2,6,23,.78); align-items:center; justify-content:center;';
    modal.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="dashboard-card-history-title" style="width:min(900px,100%); max-height:90vh; overflow:auto; background:var(--bg-secondary,#1e293b); color:var(--text-primary,#f8fafc); border:1px solid var(--border-color,#334155); border-radius:16px; padding:16px; box-shadow:0 24px 80px rgba(0,0,0,.4);">
        <div style="display:flex; gap:12px; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <h3 id="dashboard-card-history-title" style="font-size:18px; margin:0;">Last 30 Days</h3>
          <button type="button" id="dashboard-card-history-close" aria-label="Close chart" style="border:0; border-radius:8px; padding:8px 12px; background:var(--bg-tertiary,#334155); color:var(--text-primary,#f8fafc); font-size:18px;">✕</button>
        </div>
        <div id="dashboard-card-history-status" style="padding:8px 0; color:var(--text-muted,#94a3b8);">Loading chart…</div>
        <div style="position:relative; height:min(52vh,420px); min-height:260px;"><canvas id="dashboard-card-history-canvas"></canvas></div>
        <p style="font-size:12px; color:var(--text-muted,#94a3b8); margin:12px 0 0;">Trading days only. Values are calculated from the app's Supabase portfolio and historical-price data.</p>
      </div>`;
    modal.addEventListener('click', event => { if (event.target === modal) closeDashboardCardHistory(); });
    document.body.appendChild(modal);
    const close = modal.querySelector('#dashboard-card-history-close');
    if (close) close.addEventListener('click', closeDashboardCardHistory);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDashboardCardHistory(); });
    return modal;
}

function closeDashboardCardHistory() {
    const modal = document.getElementById('dashboard-card-history-modal');
    if (modal) modal.style.display = 'none';
    if (window.dashboardCardHistoryChart) {
        window.dashboardCardHistoryChart.destroy();
        window.dashboardCardHistoryChart = null;
    }
}

async function openDashboardCardHistory(metricKey) {
    const metric = DASHBOARD_CARD_METRICS[metricKey];
    if (!metric) return;
    const modal = ensureDashboardCardHistoryModal();
    modal.style.display = 'flex';
    const title = modal.querySelector('#dashboard-card-history-title');
    const status = modal.querySelector('#dashboard-card-history-status');
    if (title) title.textContent = metric.title;
    if (status) status.textContent = 'Loading last 30 days…';
    if (window.dashboardCardHistoryChart) {
        window.dashboardCardHistoryChart.destroy();
        window.dashboardCardHistoryChart = null;
    }
    try {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 29);
        if (typeof fetchPortfolioTimelineData !== 'function') throw new Error('Portfolio history service is not available.');
        const rows = await fetchPortfolioTimelineData(
            dashboardLocalDateString(startDate),
            dashboardLocalDateString(endDate),
            window.currentDashboardPortfolioId || null
        );
        if (!rows || rows.length === 0) {
            if (status) status.textContent = 'No historical data is available for this period.';
            return;
        }
        const canvas = modal.querySelector('#dashboard-card-history-canvas');
        if (!canvas || typeof Chart === 'undefined') throw new Error('Chart library is unavailable. Please reload the app.');
        const labels = rows.map(row => row.date);
        const values = rows.map(metric.value);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f1f5f9' : '#1e293b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';
        window.dashboardCardHistoryChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: [{
                label: metric.label,
                data: values,
                borderColor: metric.color,
                backgroundColor: `${metric.color}22`,
                borderWidth: 2.5,
                pointRadius: 2.5,
                pointHoverRadius: 5,
                tension: .22,
                fill: true
            }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: textColor } },
                    tooltip: { callbacks: { label: ctx => `${metric.label}: ৳${Number(ctx.raw || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` } }
                },
                scales: {
                    x: { ticks: { color: textColor, maxRotation: 45, minRotation: 0, autoSkip: true }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, callback: value => '৳' + Number(value).toLocaleString('en-BD') }, grid: { color: gridColor } }
                }
            }
        });
        if (status) status.textContent = `Showing ${rows.length} available daily points (${rows[0].date} to ${rows[rows.length - 1].date}).`;
    } catch (error) {
        console.error('Dashboard card history error:', error);
        if (status) status.textContent = `Could not load chart: ${error.message || 'Unknown error'}`;
    }
}

window.openDashboardCardHistory = openDashboardCardHistory;
window.closeDashboardCardHistory = closeDashboardCardHistory;

// ==========================================
// 📌 গ্লোবাল এক্সপোজ
// ==========================================

window.renderDashboardHistoryChart = renderDashboardHistoryChart;
window.renderDashboardDailyPLChart = renderDashboardDailyPLChart;
window.applyDashboardDateFilter = window.applyDashboardDateFilter;
window.resetDashboardDateFilter = window.resetDashboardDateFilter;

console.log('✅ dash-charts.js loaded successfully');