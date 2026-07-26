// ==========================================
// 📦 cache-helper.js - সেন্ট্রাল ক্যাশ ম্যানেজার
//    sessionStorage-ভিত্তিক, TTL সাপোর্ট, অটো ক্লিনআপ
// ==========================================

const CacheManager = {
    // 🔑 sessionStorage-এর প্রিফিক্স (অন্য অ্যাপের সাথে সংঘর্ষ এড়াতে)
    PREFIX: 'stockpulse_',
    
    // ⏱️ ডিফল্ট TTL (মিলিসেকেন্ড) – বিভিন্ন ক্যাশ ক্যাটাগরির জন্য
    DEFAULTS: {
        PRICE: 300000,      // ৫ মিনিট
        ANALYSIS: 600000,   // ১০ মিনিট
        CHART: 600000,      // ১০ মিনিট
        SCANNER: 3600000,   // ১ ঘন্টা
    },

    // ==========================================
    // 📥 ক্যাশ থেকে ডেটা পড়া
    // @param {string} key - ক্যাশের ইউনিক কী
    // @param {number|null} ttl - মিলিসেকেন্ডে মেয়াদ (ঐচ্ছিক)
    // @returns {any|null} - ক্যাশকৃত ডেটা, নাই বা মেয়াদ শেষ হলে null
    // ==========================================
    get(key, ttl = null) {
        try {
            const fullKey = this.PREFIX + key;
            const item = sessionStorage.getItem(fullKey);
            if (!item) return null;
            
            const data = JSON.parse(item);
            const now = Date.now();
            
            // TTL চেক (যদি TTL পাস করা হয় অথবা সেভকৃত TTL থাকে)
            const effectiveTtl = ttl || data.ttl || null;
            if (effectiveTtl && (now - data.timestamp) > effectiveTtl) {
                sessionStorage.removeItem(fullKey);
                return null;
            }
            
            return data.value;
        } catch (e) {
            console.warn('Cache read error:', e);
            return null;
        }
    },

    // ==========================================
    // 📤 ক্যাশে ডেটা সেভ করা
    // @param {string} key - ক্যাশের ইউনিক কী
    // @param {any} value - সংরক্ষণ করার ডেটা (যেকোনো JSON-যোগ্য)
    // @param {number|null} ttl - মিলিসেকেন্ডে মেয়াদ (ঐচ্ছিক)
    // @returns {boolean} - সফল হলে true, ব্যর্থ হলে false
    // ==========================================
    set(key, value, ttl = null) {
        try {
            const fullKey = this.PREFIX + key;
            const item = {
                value: value,
                timestamp: Date.now()
            };
            // TTL থাকলে সেটাও সেভ করে রাখি
            if (ttl) item.ttl = ttl;
            sessionStorage.setItem(fullKey, JSON.stringify(item));
            return true;
        } catch (e) {
            // sessionStorage ফুল হয়ে গেলে (৫MB লিমিট)
            if (e.name === 'QuotaExceededError') {
                console.warn('⚠️ Cache quota exceeded. Clearing old cache...');
                this.clearOldest();
                try {
                    // আবার চেষ্টা
                    const fullKey = this.PREFIX + key;
                    const item = {
                        value: value,
                        timestamp: Date.now()
                    };
                    if (ttl) item.ttl = ttl;
                    sessionStorage.setItem(fullKey, JSON.stringify(item));
                    return true;
                } catch (e2) {
                    console.error('Cache save failed even after cleanup:', e2);
                    return false;
                }
            }
            console.warn('Cache set error:', e);
            return false;
        }
    },

    // ==========================================
    // 🗑️ নির্দিষ্ট ক্যাশ ডিলিট
    // @param {string} key - ক্যাশ কী
    // @returns {boolean} - সফল হলে true
    // ==========================================
    remove(key) {
        try {
            sessionStorage.removeItem(this.PREFIX + key);
            return true;
        } catch (e) {
            return false;
        }
    },

    // ==========================================
    // 🧹 পুরনো ক্যাশ ক্লিয়ার (কোটা ফুলে গেলে স্বয়ংক্রিয়ভাবে কল হয়)
    //    সবচেয়ে পুরনো ১০টি এন্ট্রি মুছে ফেলে
    // ==========================================
    clearOldest() {
        try {
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key.startsWith(this.PREFIX)) {
                    try {
                        const item = JSON.parse(sessionStorage.getItem(key));
                        keys.push({ key, timestamp: item.timestamp || 0 });
                    } catch (e) {}
                }
            }
            // টাইমস্ট্যাম্প অনুযায়ী সাজিয়ে পুরনোগুলো ডিলিট
            keys.sort((a, b) => a.timestamp - b.timestamp);
            // ১০টি পুরনো ডিলিট (বা সব, যদি ১০-এর কম হয়)
            const toDelete = keys.slice(0, Math.min(10, keys.length));
            toDelete.forEach(item => sessionStorage.removeItem(item.key));
            console.log(`🗑️ Cleared ${toDelete.length} old cache entries`);
        } catch (e) {
            console.warn('clearOldest error:', e);
        }
    },

    // ==========================================
    // 🚀 সব ক্যাশ ক্লিয়ার (লগআউটে বা ম্যানুয়াল রিফ্রেশে ব্যবহার করুন)
    // ==========================================
    clearAll() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key.startsWith(this.PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
            console.log(`🗑️ Cleared all ${keysToRemove.length} cache entries`);
        } catch (e) {
            console.warn('clearAll error:', e);
        }
    },

    // ==========================================
    // 📊 ক্যাশ সাইজ চেক (ডিবাগিংয়ের জন্য)
    // @returns {string} - KB-তে মোট সাইজ
    // ==========================================
    getSize() {
        try {
            let total = 0;
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key.startsWith(this.PREFIX)) {
                    total += sessionStorage.getItem(key).length || 0;
                }
            }
            return (total / 1024).toFixed(2) + ' KB';
        } catch (e) {
            return '0 KB';
        }
    },

    // ==========================================
    // 🔍 কোনো নির্দিষ্ট ক্যাশ কী আছে কিনা চেক করুন
    // @param {string} key - ক্যাশ কী
    // @returns {boolean} - থাকলে true
    // ==========================================
    has(key) {
        try {
            return sessionStorage.getItem(this.PREFIX + key) !== null;
        } catch (e) {
            return false;
        }
    }
};

// ==========================================
// 🌐 গ্লোবালি এক্সপোজ (window)
// ==========================================
if (typeof window !== 'undefined') {
    window.CacheManager = CacheManager;
}

// ==========================================
// 📤 মডিউল এক্সপোর্ট (যদি Node.js/CommonJS পরিবেশে ব্যবহার করা হয়)
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}

console.log('✅ CacheManager loaded successfully');