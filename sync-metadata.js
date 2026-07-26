// ==========================================
// 📁 sync-metadata.js - v2.0
//    Firebase + Supabase stock_metadata sync
//    ✅ pe column supported, better error handling
// ==========================================

async function syncAllMetadata(onProgress, onComplete) {
  const user = auth.currentUser;
  if (!user) {
    if (typeof showToast === 'function') showToast('Please login first', 'error');
    return;
  }

  let tickers = [];
  if (typeof dseStocks !== 'undefined' && Array.isArray(dseStocks)) {
    tickers = dseStocks;
  } else if (window.dseStocks && Array.isArray(window.dseStocks)) {
    tickers = window.dseStocks;
  } else {
    if (typeof showToast === 'function') showToast('No stock list found!', 'error');
    return;
  }

  if (tickers.length === 0) {
    if (typeof showToast === 'function') showToast('Stock list is empty!', 'error');
    return;
  }

  const total = tickers.length;
  let success = 0, fail = 0;
  if (onProgress) onProgress(0, total);

  const BATCH_SIZE = 5;
  const batches = [];
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    batches.push(tickers.slice(i, i + BATCH_SIZE));
  }

  const sb = window.supabase;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batchTickers = batches[batchIdx];
    const promises = batchTickers.map(async (ticker) => {
      try {
        // ---------- ১. Firebase থেকে প্রাইস ডেটা ----------
        const priceData = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
        const startDateStr = startDate.toISOString().split('T')[0];

        if (typeof db !== 'undefined') {
          const snap = await db.collection('cse_detailed_data')
            .where('code', '==', ticker)
            .where('date', '>=', startDateStr)
            .orderBy('date', 'asc')
            .limit(200)
            .get();

          if (!snap.empty) {
            snap.forEach(doc => {
              const d = doc.data();
              const ltp = parseFloat(d.ltp);
              if (ltp > 0) {
                priceData.push({
                  date: d.date,
                  ltp: ltp,
                  high: parseFloat(d.high) || ltp,
                  low: parseFloat(d.low) || ltp
                });
              }
            });
          }
        }

        if (priceData.length < 15) {
          fail++;
          return;
        }

        // ---------- ২. ATH / ATL ----------
        let ath = 0, atl = Infinity, athDate = null, atlDate = null;
        priceData.forEach(item => {
          const ltp = item.ltp;
          if (ltp > ath) { ath = ltp; athDate = item.date; }
          if (ltp > 0 && ltp < atl) { atl = ltp; atlDate = item.date; }
          if (item.high > ath) { ath = item.high; athDate = item.date; }
          if (item.low > 0 && item.low < atl) { atl = item.low; atlDate = item.date; }
        });
        if (atl === Infinity) atl = 0;

        // ---------- ৩. RSI ----------
        const rsiArr = calculateRSI(priceData.map(p => p.ltp), 14);
        const lastRSI = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : null;

        // ---------- ৪. PSAR ----------
        const sarData = calculateParabolicSAR(priceData);
        const lastSAR = sarData.length > 0 ? sarData[sarData.length - 1].sar : 0;

        // ---------- ৫. Supabase থেকে মেটাডেটা ----------
        let category = 'N/A', recordDate = null, dividend = '-', pe = null;
        if (sb) {
          try {
            const { data, error } = await sb
              .from('cse_market_data')
              .select('category, record_date, dividend, pe')
              .eq('code', ticker)
              .order('date', { ascending: false })
              .limit(1);

            if (!error && data && data.length > 0) {
              category = data[0].category || 'N/A';
              recordDate = data[0].record_date || null;
              dividend = data[0].dividend || '-';
              pe = data[0].pe !== undefined && data[0].pe !== null ? parseFloat(data[0].pe) : null;
            }
          } catch (e) {
            try {
              if (typeof db !== 'undefined') {
                const snap2 = await db.collection('cse_detailed_data')
                  .where('code', '==', ticker)
                  .orderBy('date', 'desc')
                  .limit(1)
                  .get();
                if (!snap2.empty) {
                  const d = snap2.docs[0].data();
                  category = d.category || 'N/A';
                  recordDate = d.record_date || null;
                  dividend = d.dividend || '-';
                  pe = d.pe !== undefined && d.pe !== null ? parseFloat(d.pe) : null;
                }
              }
            } catch (e2) { /* ignore */ }
          }
        }

        // ---------- ৬. মেটাডেটা ----------
        const metadata = {
          ticker: ticker,
          ath: ath,
          ath_date: athDate,
          atl: atl,
          atl_date: atlDate,
          rsi: lastRSI !== null ? lastRSI : 0,
          psar: lastSAR,
          category: category,
          record_date: recordDate,
          dividend: dividend,
          pe: pe,
          last_updated: new Date().toISOString()
        };

        // ---------- ৭. Firebase ----------
        if (typeof db !== 'undefined') {
          await db.collection('stock_metadata').doc(ticker).set(metadata, { merge: true });
        }

        // ---------- ৮. Supabase (upsert) ----------
        if (sb) {
          const supabaseData = { ...metadata };
          if (supabaseData.pe === undefined) supabaseData.pe = null;

          const { data, error } = await sb
            .from('stock_metadata')
            .upsert(supabaseData, { onConflict: 'ticker' })
            .select(); // select() যোগ করলে রিটার্ন ডেটা আসবে

          if (error) {
            console.warn(`Supabase upsert error for ${ticker}:`, error);
            // সাপাবেস ব্যর্থ হলেও আমরা ফায়ারবেসে সেভ করেছি, তাই fail কাউন্ট করি
            fail++;
          } else {
            // সফল, "no row returned" এখানে দেখাবে না কারণ select() ব্যবহার করেছি
            success++;
          }
        } else {
          success++; // Supabase না থাকলেও ফায়ারবেস সফল
        }

      } catch (err) {
        console.error(`Error syncing ${ticker}:`, err);
        fail++;
      }
    });

    await Promise.all(promises);
    const done = Math.min((batchIdx + 1) * BATCH_SIZE, total);
    if (onProgress) onProgress(done, total);
  }

  if (onComplete) onComplete(success, fail);
  if (typeof showToast === 'function') {
    showToast(`✅ Metadata sync done! Success: ${success}, Failed: ${fail}`, 'info');
  }
  console.log(`✅ syncAllMetadata completed: ${success} success, ${fail} failed`);
}

// গ্লোবাল এক্সপোজ
if (typeof window !== 'undefined') {
  window.syncAllMetadata = syncAllMetadata;
}

console.log('✅ sync-metadata.js (v2.0) loaded');