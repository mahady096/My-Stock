// ==========================================
// 🔎 history-search-helpers.js
// Shared helpers for Buy/Sell History search.
//  - suggestions come from the user's OWN shares first, then the market list
//  - portfolio filter understands "main" (incl. legacy empty portfolio_id) and "grand" (all)
//  - ticker matching is case-insensitive
// ==========================================
(function () {
    'use strict';
    const TTL_MS = 2 * 60 * 1000;
    const cache = new Map();

    function escapeLike(value) {
        return String(value ?? '').replace(/[\\%_]/g, m => '\\' + m);
    }

    function portfolioMatches(rowPortfolioId, wanted) {
        const w = String(wanted ?? '').trim().toLowerCase();
        if (!w || w === 'grand') return true;
        const p = String(rowPortfolioId ?? '').trim().toLowerCase();
        return w === 'main' ? (p === '' || p === 'main' || p === 'null') : p === w;
    }

    function currentUid() {
        try { return (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null; }
        catch (_) { return null; }
    }

    async function userTickers(table) {
        const uid = currentUid();
        const client = window.supabase;
        if (!uid || !client || typeof client.from !== 'function') return [];
        const key = `${table}|${uid}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.t < TTL_MS) return hit.list;
        const found = new Set();
        try {
            for (let from = 0; from < 10000; from += 1000) {
                const { data, error } = await client.from(table).select('share_name')
                    .eq('user_id', uid).range(from, from + 999);
                if (error) throw error;
                (data || []).forEach(r => {
                    const t = String(r.share_name ?? '').trim().toUpperCase();
                    if (t) found.add(t);
                });
                if (!data || data.length < 1000) break;
            }
        } catch (e) {
            console.warn('History search: could not load your share list', e);
            return hit ? hit.list : [];
        }
        const list = [...found].sort();
        cache.set(key, { t: Date.now(), list });
        return list;
    }

    function matchTickers(query, ownList, marketList, limit) {
        const q = String(query ?? '').trim().toUpperCase();
        if (!q) return [];
        const own = ownList || [];
        const ownSet = new Set(own);
        const market = (marketList || []).filter(t => !ownSet.has(t));
        const out = [];
        const seen = new Set();
        const push = (t, owned) => { if (!seen.has(t)) { seen.add(t); out.push({ ticker: t, owned }); } };
        own.filter(t => t.startsWith(q)).forEach(t => push(t, true));
        market.filter(t => t.startsWith(q)).forEach(t => push(t, false));
        own.filter(t => t.includes(q)).forEach(t => push(t, true));
        market.filter(t => t.includes(q)).forEach(t => push(t, false));
        return out.slice(0, limit || 15);
    }

    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

    async function portfolioNames() {
        const names = { main: 'Main Portfolio' };
        try {
            if (typeof getPortfolioMeta === 'function' && currentUid()) {
                const meta = await getPortfolioMeta(currentUid());
                (meta?.portfolios || []).forEach(p => { names[String(p.id)] = p.name || String(p.id); });
            }
        } catch (_) {}
        return names;
    }

    // Explains WHY a search came back empty: same code in another portfolio, or similar codes you own.
    async function emptyHint(ticker, table, allRowsForCode) {
        try {
            if (allRowsForCode && allRowsForCode.length) {
                const names = await portfolioNames();
                const counts = {};
                allRowsForCode.forEach(r => {
                    const k = String(r.portfolio_id ?? '').trim() || 'main';
                    counts[k] = (counts[k] || 0) + 1;
                });
                const list = Object.entries(counts).map(([k, c]) => `${esc(names[k] || k)} (${c})`).join(', ');
                return `<br><span style="font-size:12px;">💡 ${allRowsForCode.length} record(s) of ${esc(ticker)} exist in: <strong>${list}</strong>. Change the portfolio selector above, or choose Grand Portfolio.</span>`;
            }
            const own = await userTickers(table);
            const similar = matchTickers(ticker, own, [], 5).map(m => m.ticker).filter(t => t !== ticker);
            if (similar.length) {
                return `<br><span style="font-size:12px;">💡 You have records under similar code(s): <strong>${similar.map(esc).join(', ')}</strong>. Search that exact code.</span>`;
            }
        } catch (_) {}
        return '';
    }

    // Wire one history search box. loader(ticker, portfolioId) is called on pick/Enter.
    function bindSearch(cfg) {
        const input = document.getElementById(cfg.inputId);
        const box = document.getElementById(cfg.boxId);
        if (!input || !box) return;
        if (input.dataset.spHistoryBound === '1') return;   // never bind twice
        input.dataset.spHistoryBound = '1';

        const portfolioValue = () => document.getElementById(cfg.portfolioSelectId)?.value || 'grand';
        const hide = () => { box.innerHTML = ''; box.classList.add('hidden'); };
        let seq = 0;

        const run = async (query) => {
            const mine = ++seq;
            hide();
            if (!query) { cfg.loader(''); return; }
            const own = await userTickers(cfg.table);
            if (mine !== seq) return;                       // a newer keystroke took over
            const market = Array.isArray(window.dseStocks) ? window.dseStocks : [];
            const matches = matchTickers(query, own, market, 15);
            if (!matches.length) return;
            matches.forEach(m => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.textContent = m.owned ? `📦 ${m.ticker}` : m.ticker;
                div.addEventListener('click', () => {
                    input.value = m.ticker;
                    hide();
                    cfg.loader(m.ticker, portfolioValue());
                });
                box.appendChild(div);
            });
            box.classList.remove('hidden');
        };

        const debounced = (typeof debounce === 'function') ? debounce(run, 250) : run;
        input.addEventListener('input', function () { debounced(this.value.trim().toUpperCase()); });
        input.addEventListener('keypress', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            seq++;                                           // cancel any pending suggestion render
            hide();
            const ticker = this.value.trim().toUpperCase();
            // Search ANY typed code; the loader shows "No history found" if there is none.
            cfg.loader(ticker, ticker ? portfolioValue() : null);
        });
        document.addEventListener('click', (e) => { if (!box.contains(e.target) && e.target !== input) hide(); });

        const select = document.getElementById(cfg.portfolioSelectId);
        if (select && select.dataset.spHistoryBound !== '1') {
            select.dataset.spHistoryBound = '1';
            select.addEventListener('change', function () {
                const ticker = input.value.trim().toUpperCase();
                if (ticker) cfg.loader(ticker, this.value);
            });
        }
    }

    window.addEventListener('stockpulse:data-changed', () => cache.clear());
    window.StockPulseHistorySearch = { escapeLike, portfolioMatches, userTickers, matchTickers, bindSearch, emptyHint, portfolioNames, clearCache: () => cache.clear() };
})();
