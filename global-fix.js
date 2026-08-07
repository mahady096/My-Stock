// ==========================================
// 🌍 global-fix.js – সম্পূর্ণ ইরর ফিক্স (v2)
//    index.html-এর সবশেষে লোড করুন
// ==========================================

// ==========================================
// ১. গ্লোবাল ভেরিয়েবল (চেক করে ডিফাইন)
// ==========================================

// currentDataMode
if (typeof window.currentDataMode === 'undefined') {
    window.currentDataMode = localStorage.getItem('dataMode') || 'firebase';
}

// autoRefreshInterval
if (typeof window.autoRefreshInterval === 'undefined') {
    window.autoRefreshInterval = null;
}

// autoRefreshEnabled
if (typeof window.autoRefreshEnabled === 'undefined') {
    window.autoRefreshEnabled = true;
}

// portfolioAnalysisInterval
if (typeof window.portfolioAnalysisInterval === 'undefined') {
    window.portfolioAnalysisInterval = null;
}

// stockTableRefreshInterval
if (typeof window.stockTableRefreshInterval === 'undefined') {
    window.stockTableRefreshInterval = null;
}

// ==========================================
// ২. advChartInstance – সব ফাইলের জন্য একক ভেরিয়েবল
// ==========================================
// আগে থাকলে ডিলিট করে নতুন করে সেট করি
if (typeof window.advChartInstance !== 'undefined') {
    try { delete window.advChartInstance; } catch(e) {}
}
window.advChartInstance = null;

// ==========================================
// ৩. ডেট টাইম ফাংশন (core.js-তে না থাকলে)
// ==========================================

// toBangladeshTime
if (typeof window.toBangladeshTime === 'undefined') {
    window.toBangladeshTime = function(date) {
        if (!date) return null;
        var jsDate = new Date(date);
        var bangladeshOffset = 6 * 60 * 60 * 1000;
        return new Date(jsDate.getTime() + bangladeshOffset);
    };
}

// getBangladeshDateString
if (typeof window.getBangladeshDateString === 'undefined') {
    window.getBangladeshDateString = function(date) {
        if (!date) date = new Date();
        var bdDate = window.toBangladeshTime(date);
        if (!bdDate) return new Date().toISOString().split('T')[0];
        var year = bdDate.getUTCFullYear();
        var month = String(bdDate.getUTCMonth() + 1).padStart(2, '0');
        var day = String(bdDate.getUTCDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    };
}

// formatBangladeshTime
if (typeof window.formatBangladeshTime === 'undefined') {
    window.formatBangladeshTime = function(date, showTime) {
        var bdDate = window.toBangladeshTime(date);
        if (!bdDate) return 'N/A';
        var year = bdDate.getUTCFullYear();
        var month = String(bdDate.getUTCMonth() + 1).padStart(2, '0');
        var day = String(bdDate.getUTCDate()).padStart(2, '0');
        if (showTime === false) return year + '-' + month + '-' + day;
        var hours = String(bdDate.getUTCHours()).padStart(2, '0');
        var minutes = String(bdDate.getUTCMinutes()).padStart(2, '0');
        return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
    };
}

// getTodayDate
if (typeof window.getTodayDate === 'undefined') {
    window.getTodayDate = function() {
        return window.getBangladeshDateString(new Date());
    };
}

// formatDisplayTime
if (typeof window.formatDisplayTime === 'undefined') {
    window.formatDisplayTime = function(date) {
        var bdDate = window.toBangladeshTime(date);
        if (!bdDate) return 'N/A';
        return bdDate.toLocaleString('bn-BD', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    };
}

// getUTCFromLocalDate
if (typeof window.getUTCFromLocalDate === 'undefined') {
    window.getUTCFromLocalDate = function(dateString) {
        if (!dateString) return new Date();
        var parts = dateString.split('-');
        return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0));
    };
}

// ==========================================
// ৪. ইউটিলিটি ফাংশন (debounce সহ)
// ==========================================

// debounce
if (typeof window.debounce === 'undefined') {
    window.debounce = function(func, wait) {
        wait = wait || 300;
        var timeout;
        return function executedFunction() {
            var context = this;
            var args = arguments;
            var later = function() {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
}

// chunkArray
if (typeof window.chunkArray === 'undefined') {
    window.chunkArray = function(array, chunkSize) {
        chunkSize = chunkSize || 10;
        var chunks = [];
        for (var i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    };
}

// safeParseDate
if (typeof window.safeParseDate === 'undefined') {
    window.safeParseDate = function(value) {
        if (!value) return null;
        if (value instanceof Date && !isNaN(value)) return value;
        if (typeof value === 'string' || typeof value === 'number') {
            var d = new Date(value);
            if (!isNaN(d)) return d;
        }
        if (typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
            try { var d2 = value.toDate(); if (d2 instanceof Date && !isNaN(d2)) return d2; } catch(e) {}
        }
        if (value.seconds !== undefined) {
            var d3 = new Date(value.seconds * 1000);
            if (!isNaN(d3)) return d3;
        }
        return null;
    };
}

// calculatePercentage
if (typeof window.calculatePercentage === 'undefined') {
    window.calculatePercentage = function(value, base) {
        if (!base || base === 0 || isNaN(base) || isNaN(value)) return 0;
        return (value / base) * 100;
    };
}

// safeDivision
if (typeof window.safeDivision === 'undefined') {
    window.safeDivision = function(dividend, divisor, defaultValue) {
        defaultValue = defaultValue || 0;
        if (!divisor || divisor === 0 || isNaN(divisor) || isNaN(dividend)) return defaultValue;
        return dividend / divisor;
    };
}

// getSafePrice
if (typeof window.getSafePrice === 'undefined') {
    window.getSafePrice = function(price, fallbackPrice) {
        fallbackPrice = fallbackPrice || 0;
        if (price === null || price === undefined || isNaN(price) || price === 0) return fallbackPrice;
        var numPrice = Number(price);
        if (isNaN(numPrice) || numPrice <= 0) return fallbackPrice;
        return numPrice;
    };
}

// ==========================================
// ৫. DSEX ফাংশন (dashboard.js-এর জন্য)
// ==========================================
if (typeof window.getLatestDSEXFromSupabase === 'undefined') {
    window.getLatestDSEXFromSupabase = async function() {
        try {
            if (typeof supabase === 'undefined' || !supabase) return null;
            
            var { data, error } = await supabase
                .from('dsex_index')
                .select('value, updated_at, date')
                .eq('index_name', 'DSEX')
                .order('updated_at', { ascending: false })
                .limit(2);
            
            if (error || !data || data.length === 0) return null;
            
            var latest = data[0];
            var todayValue = parseFloat(latest.value) || 0;
            var todayDate = new Date(latest.updated_at);
            var todayDateStr = latest.date;
            
            var prevValue = null;
            var prevDate = null;
            if (data.length > 1) {
                prevValue = parseFloat(data[1].value) || 0;
                prevDate = new Date(data[1].updated_at);
            }
            
            var change = 0;
            var changePercent = 0;
            if (prevValue !== null && prevValue > 0) {
                change = todayValue - prevValue;
                changePercent = (change / prevValue) * 100;
            }
            
            return {
                value: todayValue,
                date: todayDate,
                rawDate: todayDateStr,
                change: change,
                changePercent: changePercent,
                previousValue: prevValue,
                previousDate: prevDate
            };
        } catch (e) {
            console.warn('Error fetching DSEX from Supabase:', e);
            return null;
        }
    };
}

// ==========================================
// ৬. অন্যান্য ফাংশন (প্রয়োজন হলে)
// ==========================================

// resetUnifiedPriceCache
if (typeof window.resetUnifiedPriceCache === 'undefined') {
    window.resetUnifiedPriceCache = function() {
        if (typeof unifiedPriceCache !== 'undefined') {
            try { unifiedPriceCache.clear(); } catch(e) {}
        }
        console.log('🔄 Unified price cache reset');
    };
}

// resetUnifiedCache
if (typeof window.resetUnifiedCache === 'undefined') {
    window.resetUnifiedCache = function() {
        if (typeof unifiedEngine !== 'undefined' && unifiedEngine.resetCache) {
            unifiedEngine.resetCache();
        } else {
            console.warn('unifiedEngine not found');
        }
    };
}

// clearAllScannerCache
if (typeof window.clearAllScannerCache === 'undefined') {
    window.clearAllScannerCache = function() {
        try { sessionStorage.removeItem('all_scanner_data'); } catch(e) {}
        console.log('🔄 All scanner cache cleared');
    };
}

// ==========================================
// ৭. db চেক (firebase-config থেকে আসবে)
// ==========================================
if (typeof window.db === 'undefined') {
    // db ডিফাইন না থাকলে অপেক্ষা করি
    console.log('⏳ Waiting for Firebase db to initialize...');
    var checkDb = setInterval(function() {
        if (typeof window.db !== 'undefined') {
            console.log('✅ Firebase db now available');
            clearInterval(checkDb);
        }
    }, 500);
    // ১০ সেকেন্ড পর চেক বন্ধ
    setTimeout(function() { clearInterval(checkDb); }, 10000);
}

console.log('✅ global-fix.js (v2) loaded successfully - All globals defined');