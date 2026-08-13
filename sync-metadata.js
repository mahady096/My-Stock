// ==========================================
// 📁 sync-metadata.js - v5.1 (ফাইনাল ভার্সন)
//    ALL-TIME ATH/ATL + RSI/PSAR + Metadata
//    ✅ প্রগ্রেস UI সহ (syncAllMetadataWithProgress)
//    ✅ ইরর হ্যান্ডলিং ও লগ
//    ✅ ব্যাচ সাইজ ৩ (রেট লিমিট এড়াতে)
//    ✅ গ্লোবাল এক্সপোজ সম্পূর্ণ
// ==========================================

/**
 * মূল সিঙ্ক ফাংশন – কলব্যাক সাপোর্ট সহ
 * @param {Function} onProgress - (current, total) => void
 * @param {Function} onComplete - (success, fail) => void
 */
async function syncAllMetadata(onProgress, onComplete) {
    console.log('🔄 syncAllMetadata called');
    
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn('⚠️ No user logged in');
            if (typeof showToast === 'function') showToast('Please login first', 'error');
            if (onComplete) onComplete(0, 0);
            return;
        }
        console.log('👤 User:', user.uid);

        let tickers = [];
        if (typeof dseStocks !== 'undefined') tickers = dseStocks;
        else if (window.dseStocks) tickers = window.dseStocks;
        else {
            console.error('❌ No stock list found!');
            if (typeof showToast === 'function') showToast('No stock list found!', 'error');
            if (onComplete) onComplete(0, 0);
            return;
        }

        if (tickers.length === 0) {
            console.warn('⚠️ Stock list is empty!');
            if (typeof showToast === 'function') showToast('Stock list is empty!', 'error');
            if (onComplete) onComplete(0, 0);
            return;
        }

        console.log(`📊 Found ${tickers.length} stocks to sync`);

        const total = tickers.length;
        let success = 0, fail = 0;
        if (onProgress) onProgress(0, total);

        // ব্যাচ সাইজ ৩ – রেট লিমিট (Supabase 30/সেকেন্ড) নিরাপদ রাখে
        const BATCH_SIZE = 3;
        const DELAY_BETWEEN_BATCHES = 700; // ms

        const sb = window.supabase;

        for (let batchIdx = 0; batchIdx < tickers.length; batchIdx += BATCH_SIZE) {
            const batchTickers = tickers.slice(batchIdx, batchIdx + BATCH_SIZE);
            const promises = batchTickers.map(async (ticker) => {
                try {
                    console.log(`🔄 Processing ${ticker}...`);
                    
                    // ==========================================
                    // ১. history_dse থেকে ATH/ATL (সমস্ত ডেটা)
                    // ==========================================
                    let ath = 0, atl = Infinity, athDate = null, atlDate = null;
                    let rsi = 0, psar = 0;
                    let allPriceData = [];

                    if (typeof supabase !== 'undefined' && supabase) {
                        try {
                            const { data: allData, error: allError } = await supabase
                                .from('history_dse')
                                .select('date, ltp, high, low')
                                .eq('ticker', ticker)
                                .order('date', { ascending: true })
                                .limit(1000);

                            if (allError) {
                                console.warn(`⚠️ history_dse error for ${ticker}:`, allError.message);
                            } else if (allData && allData.length > 0) {
                                allData.forEach(item => {
                                    const ltp = parseFloat(item.ltp);
                                    const high = parseFloat(item.high) || ltp;
                                    const low = parseFloat(item.low) || ltp;
                                    if (ltp > ath) { ath = ltp; athDate = item.date; }
                                    if (ltp > 0 && ltp < atl) { atl = ltp; atlDate = item.date; }
                                    if (high > ath) { ath = high; athDate = item.date; }
                                    if (low > 0 && low < atl) { atl = low; atlDate = item.date; }
                                });
                                if (atl === Infinity) atl = 0;
                                allPriceData = allData.map(d => ({
                                    date: d.date,
                                    ltp: parseFloat(d.ltp),
                                    high: parseFloat(d.high) || parseFloat(d.ltp),
                                    low: parseFloat(d.low) || parseFloat(d.ltp)
                                }));
                            }
                        } catch (e) {
                            console.warn(`⚠️ history_dse exception for ${ticker}:`, e.message);
                        }
                    }

                    // ২. RSI/PSAR (গত ৩০ দিন) – indicators.js ফাংশন ব্যবহার
                    if (typeof supabase !== 'undefined' && supabase) {
                        try {
                            const startDate = new Date();
                            startDate.setDate(startDate.getDate() - 30);
                            const startDateStr = startDate.toISOString().split('T')[0];

                            const { data: recentData, error: recentError } = await supabase
                                .from('history_dse')
                                .select('date, ltp, high, low')
                                .eq('ticker', ticker)
                                .gte('date', startDateStr)
                                .order('date', { ascending: true })
                                .limit(100);

                            if (!recentError && recentData && recentData.length >= 15) {
                                const priceData = recentData.map(d => ({
                                    date: d.date,
                                    ltp: parseFloat(d.ltp),
                                    high: parseFloat(d.high) || parseFloat(d.ltp),
                                    low: parseFloat(d.low) || parseFloat(d.ltp)
                                }));
                                // RSI (indicators.js থেকে)
                                if (typeof calculateRSI === 'function') {
                                    const rsiArr = calculateRSI(priceData.map(p => p.ltp), 14);
                                    const lastRSI = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : null;
                                    rsi = lastRSI !== null ? lastRSI : 0;
                                }
                                // PSAR (indicators.js থেকে)
                                if (typeof calculateParabolicSAR === 'function') {
                                    const sarData = calculateParabolicSAR(priceData);
                                    const lastSAR = sarData.length > 0 ? sarData[sarData.length - 1].sar : 0;
                                    psar = lastSAR;
                                }
                            }
                        } catch (e) {
                            console.warn(`⚠️ RSI/PSAR error for ${ticker}:`, e.message);
                        }
                    }

                    // ==========================================
                    // ৩. cse_market_data থেকে মেটাডেটা
                    // ==========================================
                    let category = 'N/A', recordDate = null, dividend = '-', peRatio = null, eps = null;

                    if (sb) {
                        try {
                            const { data: metaData, error: metaError } = await sb
                                .from('cse_market_data')
                                .select('category, record_date, dividend, pe_ratio, eps')
                                .eq('code', ticker)
                                .order('date', { ascending: false })
                                .limit(1);

                            if (metaError) {
                                console.warn(`⚠️ cse_market_data error for ${ticker}:`, metaError.message);
                            } else if (metaData && metaData.length > 0) {
                                category = metaData[0].category || 'N/A';
                                recordDate = metaData[0].record_date || null;
                                dividend = metaData[0].dividend || '-';
                                peRatio = metaData[0].pe_ratio !== undefined && metaData[0].pe_ratio !== null ? parseFloat(metaData[0].pe_ratio) : null;
                                eps = metaData[0].eps !== undefined && metaData[0].eps !== null ? parseFloat(metaData[0].eps) : null;
                            }
                        } catch (e) {
                            console.warn(`⚠️ cse_market_data exception for ${ticker}:`, e.message);
                        }
                    }

                    // ৪. Firebase ফ্যালব্যাক (যদি Supabase-এ না থাকে)
                    if (typeof db !== 'undefined' && (category === 'N/A' || eps === null || !recordDate)) {
                        try {
                            const latestDoc = await db.collection('cse_detailed_data')
                                .where('code', '==', ticker)
                                .orderBy('date', 'desc')
                                .limit(1)
                                .get();

                            if (!latestDoc.empty) {
                                const latest = latestDoc.docs[0].data();
                                if (category === 'N/A') category = latest.category || 'N/A';
                                if (!recordDate) recordDate = latest.record_date || null;
                                if (dividend === '-') dividend = latest.dividend || '-';
                                if (peRatio === null) peRatio = latest.pe !== undefined && latest.pe !== null ? parseFloat(latest.pe) : null;
                                if (eps === null) eps = latest.eps !== undefined && latest.eps !== null ? parseFloat(latest.eps) : null;
                            }
                        } catch (e) {
                            console.warn(`⚠️ Firebase fallback error for ${ticker}:`, e.message);
                        }
                    }

                    // ৫. Firebase stock_metadata-এ সেভ
                    if (typeof db !== 'undefined') {
                        await db.collection('stock_metadata').doc(ticker).set({
                            ticker,
                            ath,
                            ath_date: athDate,
                            atl,
                            atl_date: atlDate,
                            rsi,
                            psar,
                            category,
                            record_date: recordDate,
                            dividend,
                            pe: peRatio,
                            eps,
                            last_updated: new Date().toISOString()
                        }, { merge: true });
                    }

                    // ৬. Supabase stock_metadata-এ upsert
                    if (sb) {
                        const supabaseData = {
                            ticker,
                            ath: ath > 0 ? ath : null,
                            ath_date: athDate || null,
                            atl: atl > 0 ? atl : null,
                            atl_date: atlDate || null,
                            rsi: rsi > 0 ? rsi : null,
                            psar: psar > 0 ? psar : null,
                            category: category || null,
                            record_date: recordDate || null,
                            dividend: dividend || null,
                            pe: peRatio !== null && peRatio !== undefined ? peRatio : null,
                            eps: eps !== null && eps !== undefined ? eps : null,
                            last_updated: new Date().toISOString()
                        };

                        const { error: upsertError } = await sb
                            .from('stock_metadata')
                            .upsert(supabaseData, { onConflict: 'ticker' });

                        if (upsertError) {
                            console.warn(`⚠️ Supabase upsert error for ${ticker}:`, upsertError.message);
                            fail++;
                        } else {
                            success++;
                            console.log(`✅ ${ticker} synced successfully`);
                        }
                    } else {
                        success++;
                    }
                } catch (err) {
                    console.error(`❌ Error syncing ${ticker}:`, err.message);
                    fail++;
                }
            });

            await Promise.all(promises);
            const done = Math.min(batchIdx + BATCH_SIZE, total);
            if (onProgress) onProgress(done, total);

            // ব্যাচের মধ্যে ব্যবধান – রেট লিমিট এড়াতে
            if (batchIdx + BATCH_SIZE < tickers.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

        if (onComplete) onComplete(success, fail);
        if (typeof showToast === 'function') {
            showToast(`✅ Metadata sync done! Success: ${success}, Failed: ${fail}`, success > 0 ? 'success' : 'error');
        }
        console.log(`✅ syncAllMetadata completed: ${success} success, ${fail} failed`);
    } catch (error) {
        console.error('❌ syncAllMetadata fatal error:', error);
        if (typeof showToast === 'function') {
            showToast('❌ Sync failed: ' + error.message, 'error');
        }
        if (onComplete) onComplete(0, 0);
    }
}

// ==========================================
// 📊 প্রগ্রেস সহ Sync Metadata (UI আপডেট সহ)
//    index.html-এর বাটন onclick="syncAllMetadataWithProgress()" থেকে কল হবে
// ==========================================
window.syncAllMetadataWithProgress = function() {
    const btn = document.getElementById('btn-sync-metadata');
    const statusSpan = document.getElementById('sync-status');
    
    if (!btn || !statusSpan) {
        console.error('❌ Button or status span not found');
        if (typeof showToast === 'function') {
            showToast('UI elements not found! Please refresh.', 'error');
        }
        return;
    }

    // বাটন ডিজেবল ও টেক্সট পরিবর্তন
    btn.disabled = true;
    btn.innerHTML = '⏳ Syncing...';
    statusSpan.innerText = '⏳ Starting...';
    statusSpan.style.color = '#f59e0b';

    // প্রগ্রেস কলব্যাক
    const onProgress = (current, total) => {
        const pct = Math.round((current / total) * 100);
        statusSpan.innerText = `⏳ ${current}/${total} (${pct}%)`;
        btn.innerHTML = `⏳ ${pct}%`;
    };

    // কমপ্লিট কলব্যাক
    const onComplete = (success, fail) => {
        btn.disabled = false;
        btn.innerHTML = '🔄 Sync Stock Metadata';
        
        if (success > 0 || fail > 0) {
            statusSpan.innerText = `✅ Done! ${success} success, ${fail} failed`;
            statusSpan.style.color = success > 0 ? '#10b981' : '#ef4444';
            
            if (typeof showToast === 'function') {
                showToast(`✅ Sync complete: ${success} success, ${fail} failed`, success > 0 ? 'success' : 'error');
            }
        } else {
            statusSpan.innerText = '❌ No data synced';
            statusSpan.style.color = '#ef4444';
            if (typeof showToast === 'function') {
                showToast('❌ Sync failed. Check console for errors.', 'error');
            }
        }
    };

    // মেইন ফাংশন কল
    syncAllMetadata(onProgress, onComplete);
};

// ==========================================
// 🌐 গ্লোবাল এক্সপোজ (সব ফাংশন উইন্ডোতে)
// ==========================================
if (typeof window !== 'undefined') {
    window.syncAllMetadata = syncAllMetadata;
    window.syncAllMetadataWithProgress = syncAllMetadataWithProgress;
}

console.log('✅ sync-metadata.js (v5.1 - final) loaded successfully');