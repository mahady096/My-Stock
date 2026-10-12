// ==========================================================
// fundamentals.js — EPS & P/E Ratio
// Source: Supabase table `daily_closing_prices` ONLY.
// Column names are auto-detected (ticker: code/ticker/symbol, date: date/trade_date, EPS: eps, P/E: pe_ratio/pe).
// Click on the EPS or P/E card in the stock modal to open a history chart.
// ==========================================================
(function () {
    'use strict';

    const TABLE = 'daily_closing_prices';
    const CAND = {
        ticker: ['ticker', 'code', 'symbol', 'scrip', 'share_name', 'company'],
        date:   ['date', 'trade_date', 'trading_date', 'day'],
        eps:    ['eps', 'EPS', 'eps_value'],
        pe:     ['pe_ratio', 'pe', 'p_e', 'p_e_ratio', 'pe_value']
    };
    let schema = null;               // detected once: { ticker, date, eps, pe, keys }
    let lastError = '';
    const METRICS = {
        eps: { col: 'eps', label: 'EPS', unit: '৳', color: '#34d399', color2: '#2dd4bf', hint: 'Earnings per share' },
        pe:  { col: 'pe_ratio', label: 'P/E Ratio', unit: '', color: '#fb923c', color2: '#fbbf24', hint: 'Price to earnings' }
    };
    const RANGES = [
        { key: '1M', days: 30 }, { key: '3M', days: 90 }, { key: '6M', days: 180 },
        { key: '1Y', days: 365 }, { key: 'All', days: 0 }
    ];

    const cache = new Map();        // ticker -> rows[] (ascending by date)
    let chart = null;
    let state = { ticker: '', metric: 'eps', range: '6M', rows: [] };

    const num = v => {
        if (v === null || v === undefined || v === '') return null;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
    };
    const fmt = (v, metric) => {
        if (v === null || v === undefined) return '-';
        const s = v.toFixed(2);
        return metric === 'eps' ? `৳${s}` : s;
    };
    const esc = s => (typeof spEscapeHtml === 'function' ? spEscapeHtml(String(s)) :
        String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

    // ---------- data ----------
    async function detectSchema() {
        if (schema) return schema;
        if (typeof supabase === 'undefined' || !supabase) { lastError = 'Supabase is not ready.'; return null; }
        const { data, error } = await supabase.from(TABLE).select('*').limit(1);
        if (error) { lastError = error.message || 'Cannot read daily_closing_prices (check RLS policy).'; return null; }
        if (!data || !data.length) { lastError = 'daily_closing_prices has no rows.'; return null; }
        const keys = Object.keys(data[0]);
        const pick = list => list.find(k => keys.includes(k)) || null;
        schema = { ticker: pick(CAND.ticker), date: pick(CAND.date), eps: pick(CAND.eps), pe: pick(CAND.pe), keys };
        return schema;
    }

    async function fetchRows(ticker) {
        const key = String(ticker || '').trim();
        lastError = '';
        if (!key) return [];
        if (cache.has(key)) return cache.get(key);
        try {
            const sc = await detectSchema();
            if (!sc) return [];
            if (!sc.ticker || !sc.date) { lastError = 'daily_closing_prices needs a ticker/code column and a date column. Found: ' + sc.keys.join(', '); return []; }
            if (!sc.eps && !sc.pe) { lastError = 'No eps / pe_ratio column in daily_closing_prices. Found: ' + sc.keys.join(', '); return []; }
            const cols = [sc.date, sc.eps, sc.pe].filter(Boolean).join(', ');
            const { data, error } = await supabase
                .from(TABLE)
                .select(cols)
                .eq(sc.ticker, key)
                .order(sc.date, { ascending: false })
                .limit(800);
            if (error || !Array.isArray(data)) { lastError = (error && error.message) || 'Query failed.'; return []; }
            const seen = new Set();
            const rows = [];
            data.forEach(r => {
                const d = r[sc.date] ? String(r[sc.date]).slice(0, 10) : '';
                if (!d || seen.has(d)) return;
                seen.add(d);
                rows.push({ date: d, eps: sc.eps ? num(r[sc.eps]) : null, pe: sc.pe ? num(r[sc.pe]) : null });
            });
            rows.reverse();                       // oldest -> newest
            cache.set(key, rows);
            return rows;
        } catch (e) {
            lastError = String(e && e.message || e);
            console.warn('fundamentals fetch failed:', e);
            return [];
        }
    }

    // Latest *populated* row: the newest rows are often empty (scraper has not filled eps / pe_ratio yet),
    // so use the most recent row that has a value and report its own date.
    async function getLatest(ticker) {
        const rows = await fetchRows(ticker);
        const newest = rows.length ? rows[rows.length - 1] : null;
        let hit = null;
        for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i].eps !== null || rows[i].pe !== null) { hit = rows[i]; break; }
        }
        return {
            eps: hit ? hit.eps : null,
            pe: hit ? hit.pe : null,
            date: hit ? hit.date : null,
            newestDate: newest ? newest.date : null,
            count: rows.length
        };
    }

    // ---------- stock modal cards ----------
    function paint(el, value, metric) {
        if (!el) return;
        el.innerText = fmt(value, metric);
        el.classList.toggle('fund-neg', value !== null && value < 0);
    }

    window.loadFundamentalsIntoModal = async function (ticker) {
        const epsEl = document.getElementById('adv-eps');
        const peEl = document.getElementById('adv-pe');
        const epsDate = document.getElementById('adv-eps-date');
        const peDate = document.getElementById('adv-pe-date');
        const f = await getLatest(ticker);
        paint(epsEl, f.eps, 'eps');
        paint(peEl, f.pe, 'pe');
        let when = f.date ? `as of ${f.date}` : (lastError ? 'Data unavailable' : 'No EPS / P/E data');
        if (f.date && f.newestDate && f.newestDate > f.date) when += ' · newer rows empty';
        if (lastError && !f.date) { if (epsDate) epsDate.title = lastError; if (peDate) peDate.title = lastError; }
        if (epsDate) epsDate.innerText = f.eps === null ? (f.date ? 'EPS not available' : when) : when;
        if (peDate) {
            peDate.innerText = f.pe !== null ? when
                : (f.eps === 0 ? 'EPS is 0, so P/E is undefined' : (f.date ? 'P/E not available' : when));
        }
        return f;
    };
    window.getFundamentalsLatest = getLatest;
    // kept for older callers
    window.getPERatio = async ticker => (await getLatest(ticker)).pe;
    window.getEPS = async ticker => (await getLatest(ticker)).eps;

    // ---------- history modal ----------
    function ensureModal() {
        let m = document.getElementById('fund-history-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'fund-history-modal';
        m.className = 'modal fund-modal';
        m.style.display = 'none';
        m.innerHTML = `
          <div class="fund-sheet" role="dialog" aria-modal="true" aria-labelledby="fund-title">
            <div class="fund-head">
              <div>
                <div class="fund-sub" id="fund-sub"></div>
                <h3 id="fund-title"></h3>
              </div>
              <button type="button" class="fund-close" id="fund-close" aria-label="Close">&times;</button>
            </div>
            <div class="fund-tabs" role="tablist">
              <button type="button" data-m="eps" role="tab">EPS</button>
              <button type="button" data-m="pe" role="tab">P/E Ratio</button>
            </div>
            <div class="fund-stats" id="fund-stats"></div>
            <div class="fund-ranges" id="fund-ranges"></div>
            <div class="fund-chart"><canvas id="fund-canvas"></canvas><div class="fund-empty" id="fund-empty" hidden></div></div>
            <div class="fund-note">Source: daily_closing_prices. Negative values mean the company reported a loss.</div>
          </div>`;
        document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m) closeModal(); });
        m.querySelector('#fund-close').addEventListener('click', closeModal);
        m.querySelectorAll('.fund-tabs button').forEach(b => b.addEventListener('click', () => { state.metric = b.dataset.m; render(); }));
        const rg = m.querySelector('#fund-ranges');
        RANGES.forEach(r => {
            const b = document.createElement('button');
            b.type = 'button'; b.dataset.r = r.key; b.textContent = r.key;
            b.addEventListener('click', () => { state.range = r.key; render(); });
            rg.appendChild(b);
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
        return m;
    }

    function closeModal() {
        const m = document.getElementById('fund-history-modal');
        if (m) m.style.display = 'none';
        if (chart) { chart.destroy(); chart = null; }
    }

    function sliceRows() {
        const def = RANGES.find(r => r.key === state.range) || RANGES[2];
        let rows = state.rows;
        if (def.days > 0 && rows.length) {
            const last = new Date(rows[rows.length - 1].date);
            const from = new Date(last.getTime() - def.days * 864e5).toISOString().slice(0, 10);
            rows = rows.filter(r => r.date >= from);
        }
        return rows;
    }

    function render() {
        const m = ensureModal();
        const M = METRICS[state.metric];
        const rows = sliceRows().filter(r => r[state.metric] !== null);
        m.querySelector('#fund-title').textContent = `${state.ticker} · ${M.label} history`;
        m.querySelector('#fund-sub').textContent = M.hint;
        m.querySelectorAll('.fund-tabs button').forEach(b => b.classList.toggle('on', b.dataset.m === state.metric));
        m.querySelectorAll('#fund-ranges button').forEach(b => b.classList.toggle('on', b.dataset.r === state.range));
        const sheet = m.querySelector('.fund-sheet');
        sheet.style.setProperty('--fa', M.color); sheet.style.setProperty('--fb', M.color2);

        const vals = rows.map(r => r[state.metric]);
        const stats = m.querySelector('#fund-stats');
        const empty = m.querySelector('#fund-empty');
        const canvas = m.querySelector('#fund-canvas');
        if (chart) { chart.destroy(); chart = null; }

        if (!vals.length) {
            stats.innerHTML = '';
            canvas.style.visibility = 'hidden';
            empty.hidden = false;
            empty.textContent = state.rows.length ? `No ${M.label} values in this range.` : (lastError || 'No history found for this company in daily_closing_prices.');
            return;
        }
        empty.hidden = true; canvas.style.visibility = 'visible';

        const first = vals[0], last = vals[vals.length - 1];
        const hi = Math.max(...vals), lo = Math.min(...vals);
        const diff = last - first;
        const diffCls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
        stats.innerHTML = `
          <div><span>Latest</span><b class="${last < 0 ? 'down' : ''}">${fmt(last, state.metric)}</b></div>
          <div><span>Change</span><b class="${diffCls}">${diff > 0 ? '+' : ''}${diff.toFixed(2)}</b></div>
          <div><span>High</span><b>${fmt(hi, state.metric)}</b></div>
          <div><span>Low</span><b>${fmt(lo, state.metric)}</b></div>`;

        if (typeof Chart === 'undefined') { empty.hidden = false; empty.textContent = 'Chart library not loaded.'; canvas.style.visibility = 'hidden'; return; }
        const ctx = canvas.getContext('2d');
        const h = canvas.parentElement.clientHeight || 260;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, M.color + '66'); grad.addColorStop(1, M.color + '00');
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const tick = dark ? '#94a3b8' : '#64748b';
        const grid = dark ? 'rgba(148,163,184,.12)' : 'rgba(100,116,139,.14)';
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: rows.map(r => r.date),
                datasets: [{
                    label: M.label, data: vals, borderColor: M.color, backgroundColor: grad, fill: true,
                    borderWidth: 2.5, tension: .3, stepped: false,
                    pointRadius: vals.length > 45 ? 0 : 3, pointHoverRadius: 6,
                    pointBackgroundColor: M.color, pointBorderColor: dark ? '#0f172a' : '#fff', pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    zoom: { pan: { enabled: false }, zoom: { wheel: { enabled: false }, pinch: { enabled: false } } },
                    tooltip: {
                        backgroundColor: dark ? 'rgba(2,6,23,.94)' : 'rgba(15,23,42,.94)', padding: 10, cornerRadius: 10, displayColors: false,
                        titleColor: '#cbd5e1', bodyColor: '#fff', bodyFont: { weight: '700', size: 13 },
                        callbacks: { label: c => `${M.label}: ${fmt(c.parsed.y, state.metric)}` }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: tick, maxTicksLimit: 5, maxRotation: 0 } },
                    y: { grid: { color: ctx2 => (ctx2.tick && ctx2.tick.value === 0 ? (dark ? 'rgba(248,250,252,.35)' : 'rgba(15,23,42,.35)') : grid) },
                         ticks: { color: tick, maxTicksLimit: 6 }, grace: '8%' }
                }
            }
        });
    }

    window.openFundamentalHistory = async function (metric, ticker) {
        const t = String(ticker || (document.getElementById('adv-modal-ticker') || {}).innerText || '').trim();
        if (!t) return;
        const m = ensureModal();
        state = { ticker: t, metric: metric === 'pe' ? 'pe' : 'eps', range: state.range || '6M', rows: [] };
        m.style.display = 'flex';
        m.querySelector('#fund-title').textContent = `${t} · loading…`;
        m.querySelector('#fund-stats').innerHTML = '';
        state.rows = await fetchRows(t);
        render();
    };
    window.closeFundamentalHistory = closeModal;
})();
