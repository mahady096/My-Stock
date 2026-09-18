// ==========================================
// 🔄 portfolio-transfer.js - Lot-by-Lot Share Transfer
//    Move shares between the user's own portfolios.
//    User selects the exact BUY LOT, then transfers all/part of that lot.
//    Preserves original buy price + buy date + proportional commission.
//    Supabase is primary; Firebase mirror is best-effort.
// ==========================================
(function () {
    'use strict';

    let transferBusy = false;
    let sourceLots = [];

    const $ = (id) => document.getElementById(id);

    function normalizePid(pid) {
        return String(pid || 'main').trim() || 'main';
    }

    function safeNum(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function isValidBigintId(v) {
        // Never send null/undefined/"null" to a bigint PostgreSQL column.
        const s = String(v ?? '').trim();
        return /^\d+$/.test(s);
    }

    function formatDate(v) {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
        return d.toISOString().slice(0, 10);
    }

    function getPortfolioName(meta, pid) {
        if (pid === 'grand') return 'Grand Portfolio';
        const p = (meta?.portfolios || []).find(x => String(x.id) === String(pid));
        return p?.name || pid;
    }

    async function fetchPortfolioMetaSafe(userId) {
        if (typeof getPortfolioMeta === 'function') return await getPortfolioMeta(userId);
        return { portfolios: [{ id: 'main', name: '📊 Main Portfolio', type: 'main', isDefault: true }] };
    }

    async function fetchLots(userId, portfolioId) {
        const pid = normalizePid(portfolioId);
        let lots = [];
        let sales = [];

        if (typeof supabase !== 'undefined' && supabase) {
            const { data: pData, error: pError } = await supabase
                .from('portfolios')
                .select('*')
                .eq('user_id', userId)
                .eq('portfolio_id', pid);
            if (pError) throw pError;

            lots = (pData || []).map(x => ({
                id: x.id,
                shareName: String(x.share_name || '').trim().toUpperCase(),
                quantity: safeNum(x.quantity),
                buyPrice: safeNum(x.buy_price),
                commission: safeNum(x.commission),
                commissionPercent: safeNum(x.commission_percent),
                portfolioId: normalizePid(x.portfolio_id),
                date: x.date || x.created_at || '',
                createdAt: x.created_at || ''
            })).filter(x => x.shareName && x.quantity > 0);

            const { data: sData, error: sError } = await supabase
                .from('sales_history')
                .select('share_name, quantity_sold, portfolio_id')
                .eq('user_id', userId)
                .eq('portfolio_id', pid);
            if (sError) throw sError;
            sales = (sData || []).map(x => ({
                shareName: String(x.share_name || '').trim().toUpperCase(),
                quantitySold: safeNum(x.quantity_sold)
            }));
        } else if (typeof db !== 'undefined' && db) {
            const pSnap = await db.collection('portfolios')
                .where('userId', '==', userId)
                .where('portfolioId', '==', pid).get();
            pSnap.forEach(doc => {
                const x = doc.data() || {};
                lots.push({
                    id: doc.id,
                    shareName: String(x.shareName || '').trim().toUpperCase(),
                    quantity: safeNum(x.quantity),
                    buyPrice: safeNum(x.buyPrice),
                    commission: safeNum(x.commission),
                    commissionPercent: safeNum(x.commissionPercent),
                    portfolioId: normalizePid(x.portfolioId),
                    date: x.date?.toDate?.()?.toISOString?.() || x.date || '',
                    createdAt: x.createdAt?.toDate?.()?.toISOString?.() || ''
                });
            });
            const sSnap = await db.collection('sales_history')
                .where('userId', '==', userId)
                .where('portfolioId', '==', pid).get();
            sSnap.forEach(doc => {
                const x = doc.data() || {};
                sales.push({ shareName: String(x.shareName || '').trim().toUpperCase(), quantitySold: safeNum(x.quantitySold) });
            });
        } else {
            throw new Error('Database connection is not available.');
        }

        // Match the app's FIFO calculation so sold quantity is removed from
        // the oldest lots first, but the transfer itself is explicitly lot-based.
        lots.sort((a, b) => {
            const da = Date.parse(a.date || a.createdAt || '') || 0;
            const dbv = Date.parse(b.date || b.createdAt || '') || 0;
            if (da !== dbv) return da - dbv;
            const ca = String(a.createdAt || '');
            const cb = String(b.createdAt || '');
            if (ca !== cb) return ca.localeCompare(cb);
            return String(a.id ?? '').localeCompare(String(b.id ?? ''));
        });

        const soldMap = new Map();
        sales.forEach(s => {
            if (!s.shareName || s.quantitySold <= 0) return;
            soldMap.set(s.shareName, (soldMap.get(s.shareName) || 0) + s.quantitySold);
        });

        const remainingSold = new Map(soldMap);
        const availableLots = [];
        lots.forEach((lot, index) => {
            let availableQty = lot.quantity;
            const sold = remainingSold.get(lot.shareName) || 0;
            if (sold > 0) {
                const consume = Math.min(availableQty, sold);
                availableQty -= consume;
                remainingSold.set(lot.shareName, sold - consume);
            }
            if (availableQty > 0) {
                availableLots.push({
                    ...lot,
                    availableQty,
                    lotIndex: index
                });
            }
        });

        // Stable UI key independent of the database bigint id.
        return availableLots.map((lot, i) => ({
            ...lot,
            transferKey: String(i)
        }));
    }

    function clearSelect(select, placeholder) {
        if (!select) return;
        select.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        select.appendChild(opt);
    }

    function setStatus(message, type) {
        const el = $('share-transfer-status');
        if (!el) return;
        el.textContent = message || '';
        el.style.color = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : 'var(--text-muted)';
    }

    function getSelectedLot() {
        const value = $('transfer-lot')?.value;
        if (value === '' || value == null) return null;
        const index = Number(value);
        if (!Number.isInteger(index) || index < 0 || index >= sourceLots.length) return null;
        return sourceLots[index] || null;
    }

    async function populatePortfolios() {
        const user = auth.currentUser;
        if (!user) return;
        const meta = await fetchPortfolioMetaSafe(user.uid);
        const from = $('transfer-from-portfolio');
        const to = $('transfer-to-portfolio');
        [from, to].forEach(select => clearSelect(select, 'Select portfolio'));

        (meta?.portfolios || []).forEach(p => {
            if (String(p.id) === 'grand') return;
            const opt1 = document.createElement('option');
            opt1.value = p.id;
            opt1.textContent = p.name;
            from?.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = p.id;
            opt2.textContent = p.name;
            to?.appendChild(opt2);
        });

        const current = (typeof window.currentSelectedPortfolio !== 'undefined') ? window.currentSelectedPortfolio : 'main';
        if (from) from.value = (meta.portfolios || []).some(p => String(p.id) === String(current) && String(p.id) !== 'grand')
            ? current
            : (meta.portfolios?.find(p => String(p.id) !== 'grand')?.id || 'main');
        await onFromChanged();
    }

    async function onFromChanged() {
        const from = $('transfer-from-portfolio')?.value;
        const to = $('transfer-to-portfolio');
        const lotSelect = $('transfer-lot');
        const qty = $('transfer-quantity');
        clearSelect(lotSelect, 'Select a lot');
        if (qty) { qty.value = ''; qty.removeAttribute('max'); }
        sourceLots = [];
        setStatus('', 'info');
        const info = $('transfer-source-info');
        if (info) info.textContent = 'Each buy lot is shown separately.';
        if (!from) return;

        if (to && to.value === from) {
            const opts = Array.from(to.options);
            const alternative = opts.find(o => o.value && o.value !== from);
            if (alternative) to.value = alternative.value;
            else to.value = '';
        }

        try {
            const user = auth.currentUser;
            sourceLots = await fetchLots(user.uid, from);

            sourceLots.forEach((lot, index) => {
                const opt = document.createElement('option');
                opt.value = String(index);
                const price = Number(lot.buyPrice || 0).toFixed(2);
                const date = formatDate(lot.date || lot.createdAt);
                opt.textContent = `${lot.shareName} • Buy ৳${price} • Available ${lot.availableQty} • ${date}`;
                lotSelect?.appendChild(opt);
            });

            if (info) info.textContent = sourceLots.length
                ? `${sourceLots.length} available lot(s). Select the exact buy lot to transfer.`
                : 'No transferable lots found in this portfolio.';
        } catch (e) {
            console.error('Transfer holdings load failed:', e);
            setStatus('Failed to load source portfolio holdings.', 'error');
        }
    }

    function onLotChanged() {
        const lot = getSelectedLot();
        const info = $('transfer-available');
        const qty = $('transfer-quantity');
        if (!lot) {
            if (info) info.textContent = 'Available: —';
            if (qty) { qty.value = ''; qty.removeAttribute('max'); }
            return;
        }
        if (info) info.textContent = `Available: ${lot.availableQty}`;
        if (qty) {
            qty.max = String(lot.availableQty);
            qty.value = '';
        }
    }

    async function updateSupabaseLot(userId, lot, oldQty, newQty) {
        let query = supabase
            .from('portfolios')
            .update({ quantity: newQty })
            .eq('user_id', String(userId))
            .eq('share_name', String(lot.shareName || '').trim().toUpperCase())
            .eq('quantity', oldQty)
            .eq('buy_price', lot.buyPrice);

        // Use the real bigint id only when it is actually present and numeric.
        // This is safe for normal rows and prevents the previous id=eq.null bug.
        if (isValidBigintId(lot.id)) {
            query = query.eq('id', String(lot.id));
        } else if (lot.createdAt) {
            query = query.eq('created_at', lot.createdAt);
        } else if (lot.date) {
            query = query.eq('date', lot.date);
        } else {
            throw new Error('This lot has no safe database identifier. Please refresh the page and try again.');
        }

        if (normalizePid(lot.portfolioId) === 'main') {
            query = query.or('portfolio_id.eq.main,portfolio_id.is.null');
        } else {
            query = query.eq('portfolio_id', normalizePid(lot.portfolioId));
        }

        const { data, error } = await query.select('quantity');
        if (error) throw error;
        if (!data || data.length !== 1) {
            throw new Error('Selected lot changed or could not be uniquely identified. Please refresh and try again.');
        }
        return data[0];
    }

    async function insertSupabaseLot(userId, lot, transferQty, proportionalCommission, toId, createdAt) {
        const payload = {
            user_id: String(userId),
            share_name: String(lot.shareName || '').trim().toUpperCase(),
            quantity: Number(transferQty),
            buy_price: Number(lot.buyPrice) || 0,
            commission: Number(proportionalCommission) || 0,
            commission_percent: Number(lot.commissionPercent) || 0,
            portfolio_id: String(toId || '').trim() || 'main',
            date: lot.date || new Date().toISOString().split('T')[0],
            created_at: createdAt || new Date().toISOString()
        };

        if (!payload.user_id || !payload.share_name || !(payload.quantity > 0) || !(payload.buy_price >= 0)) {
            throw new Error('Invalid transfer holding data. Please refresh and try again.');
        }

        if (typeof supabaseFetch === 'function') {
            await supabaseFetch('/portfolios', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify(payload)
            });
            return true;
        }

        const { error } = await supabase.from('portfolios').insert(payload);
        if (error) throw error;
        return true;
    }

    async function transferOnSupabase(userId, lot, toId, quantity) {
        const available = safeNum(lot.availableQty);
        if (quantity <= 0 || quantity > available + 1e-9) {
            throw new Error(`Maximum transferable quantity from this lot is ${available}.`);
        }

        const oldQty = safeNum(lot.quantity);
        const newQty = oldQty - quantity;
        const commissionPart = oldQty > 0 ? safeNum(lot.commission) * (quantity / oldQty) : 0;
        const insertedAt = new Date().toISOString();
        let sourceChanged = false;

        try {
            // 1) Reduce ONLY the selected lot.
            await updateSupabaseLot(userId, lot, oldQty, newQty);
            sourceChanged = true;

            // 2) Create the same lot in the destination portfolio.
            await insertSupabaseLot(userId, lot, quantity, commissionPart, toId, insertedAt);
        } catch (e) {
            // If destination insert fails, restore the exact source lot.
            if (sourceChanged) {
                try {
                    await updateSupabaseLot(userId, { ...lot, quantity: newQty }, newQty, oldQty);
                } catch (rollbackError) {
                    console.error('Source lot rollback failed:', rollbackError);
                }
            }
            throw e;
        }
    }

    async function transferOnFirebase(userId, fromId, toId, lot, quantity) {
        if (typeof db === 'undefined' || !db) return;
        // Best-effort mirror. Locate the exact buy lot rather than doing FIFO
        // by ticker, so Supabase and Firebase represent the same transfer.
        try {
            const pSnap = await db.collection('portfolios')
                .where('userId', '==', userId)
                .where('portfolioId', '==', fromId)
                .where('shareName', '==', lot.shareName).get();

            const candidates = [];
            pSnap.forEach(doc => {
                const x = doc.data() || {};
                const date = x.date?.toDate?.()?.toISOString?.() || x.date || '';
                const createdAt = x.createdAt?.toDate?.()?.toISOString?.() || x.createdAt || '';
                const buyPrice = safeNum(x.buyPrice);
                if (Math.abs(buyPrice - safeNum(lot.buyPrice)) > 1e-9) return;
                candidates.push({ id: doc.id, data: x, date, createdAt });
            });

            candidates.sort((a, b) => {
                const da = Date.parse(a.date || a.createdAt || '') || 0;
                const dbv = Date.parse(b.date || b.createdAt || '') || 0;
                return da - dbv;
            });

            const doc = candidates.find(d => {
                const q = safeNum(d.data.quantity);
                const dDate = formatDate(d.date || d.createdAt);
                const lDate = formatDate(lot.date || lot.createdAt);
                return Math.abs(q - safeNum(lot.quantity)) < 1e-9 && dDate === lDate;
            }) || candidates[0];

            if (!doc) return;

            const batch = db.batch();
            const oldQty = safeNum(doc.data.quantity);
            const newQty = oldQty - quantity;
            batch.update(db.collection('portfolios').doc(doc.id), { quantity: newQty });
            batch.set(db.collection('portfolios').doc(), {
                userId,
                shareName: lot.shareName,
                quantity,
                buyPrice: safeNum(lot.buyPrice),
                commission: oldQty > 0 ? safeNum(doc.data.commission) * (quantity / oldQty) : 0,
                commissionPercent: safeNum(lot.commissionPercent),
                portfolioId: toId,
                date: doc.data.date || new Date(),
                createdAt: new Date()
            });
            await batch.commit();
        } catch (e) {
            console.warn('Firebase transfer mirror sync failed:', e);
        }
    }

    window.openShareTransfer = async function () {
        const user = auth.currentUser;
        if (!user) { if (typeof showToast === 'function') showToast('Please login first', 'error'); return; }
        const modal = $('share-transfer-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        setStatus('', 'info');
        await populatePortfolios();
    };

    window.closeShareTransfer = function () {
        const modal = $('share-transfer-modal');
        if (modal) modal.style.display = 'none';
    };

    window.executeShareTransfer = async function () {
        if (transferBusy) return;
        const user = auth.currentUser;
        if (!user) { showToast('Please login first', 'error'); return; }

        const fromId = normalizePid($('transfer-from-portfolio')?.value);
        const toId = normalizePid($('transfer-to-portfolio')?.value);
        const lot = getSelectedLot();
        const quantity = safeNum($('transfer-quantity')?.value);

        if (fromId === 'grand' || toId === 'grand') { showToast('Grand Portfolio cannot be used for transfers.', 'warning'); return; }
        if (!fromId || !toId || fromId === toId) { showToast('Please select two different portfolios.', 'warning'); return; }
        if (!lot) { showToast('Please select the exact buy lot you want to transfer.', 'warning'); return; }
        if (quantity <= 0) { showToast('Please enter a valid transfer quantity.', 'warning'); return; }
        if (quantity > safeNum(lot.availableQty) + 1e-9) {
            showToast(`Maximum available quantity from this lot is ${lot.availableQty}.`, 'warning');
            return;
        }

        const meta = await fetchPortfolioMetaSafe(user.uid);
        const fromName = getPortfolioName(meta, fromId);
        const toName = getPortfolioName(meta, toId);
        const date = formatDate(lot.date || lot.createdAt);
        const price = Number(lot.buyPrice || 0).toFixed(2);
        if (!confirm(`Lot Transfer Summary\n\nShare: ${lot.shareName}\nBuy price: ৳${price}\nBuy date: ${date}\nTransfer quantity: ${quantity}\nLot available: ${lot.availableQty}\nFrom: ${fromName}\nTo: ${toName}\n\nOnly this selected lot will be transferred. Original cost basis will be preserved.`)) return;

        transferBusy = true;
        const btn = $('execute-share-transfer-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Transferring Lot...'; }
        setStatus('Transferring selected lot...', 'info');

        try {
            if (typeof supabase === 'undefined' || !supabase) throw new Error('Supabase connection is not available.');
            await transferOnSupabase(user.uid, lot, toId, quantity);
            await transferOnFirebase(user.uid, fromId, toId, lot, quantity);

            if (typeof window.invalidateAppDataCache === 'function') window.invalidateAppDataCache('portfolio lot transfer');
            if (typeof resetUnifiedCache === 'function') resetUnifiedCache();
            if (typeof resetUnifiedPriceCache === 'function') resetUnifiedPriceCache();
            if (typeof updateAllPortfolioSelectors === 'function') updateAllPortfolioSelectors();
            if (typeof updateBuyPortfolioSelect === 'function') updateBuyPortfolioSelect();
            if (typeof updateSidebarPortfolioList === 'function') updateSidebarPortfolioList();

            showToast(`✅ ${quantity} ${lot.shareName} share(s) from the selected lot transferred successfully.`, 'success');
            setStatus('Selected lot transferred successfully.', 'success');
            await onFromChanged();
            onLotChanged();
            if (typeof loadPortfolioManagerData === 'function') loadPortfolioManagerData();
        } catch (e) {
            console.error('Share transfer failed:', e);
            setStatus(`Transfer failed: ${e?.message || e}`, 'error');
            showToast(`❌ Transfer failed: ${e?.message || 'Please try again.'}`, 'error');
        } finally {
            transferBusy = false;
            if (btn) { btn.disabled = false; btn.textContent = '🔄 Transfer Selected Lot'; }
        }
    };

    async function initTransferEvents() {
        const from = $('transfer-from-portfolio');
        const lot = $('transfer-lot');
        if (from) from.addEventListener('change', onFromChanged);
        if (lot) lot.addEventListener('change', onLotChanged);
    }

    document.addEventListener('DOMContentLoaded', initTransferEvents);
})();
