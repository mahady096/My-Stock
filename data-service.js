// 📁 data-service.js
// ==========================================
// ডেটা ফেচিং এর সেন্ট্রাল লেয়ার – Supabase + Firebase
// ==========================================

class DataService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 300000; // 5 মিনিট
        this.pendingRequests = new Map();
    }

    // 🔥 পোর্টফোলিও ডেটা ফেচ (Supabase優先, তারপর Firebase)
    async getPortfolio(userId) {
        if (!userId) return null;
        const cacheKey = `portfolio_${userId}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        // যদি রিকোয়েস্ট ইতিমধ্যে চলছে, তাহলে সেটা রিটার্ন করুন
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const promise = this._fetchPortfolio(userId);
        this.pendingRequests.set(cacheKey, promise);

        try {
            const data = await promise;
            this.setCache(cacheKey, data);
            return data;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    async _fetchPortfolio(userId) {
        let portfolioData = [];

        // ১. Supabase
        if (typeof supabase !== 'undefined') {
            try {
                const { data, error } = await supabase
                    .from('portfolios')
                    .select('*')
                    .eq('user_id', userId);
                if (!error && data) {
                    portfolioData = data.map(item => ({
                        id: item.id,
                        userId: item.user_id,
                        shareName: item.share_name,
                        quantity: item.quantity,
                        buyPrice: item.buy_price,
                        commission: item.commission || 0,
                        commissionPercent: item.commission_percent || 0,
                        date: item.date,
                        createdAt: item.created_at
                    }));
                    return portfolioData;
                }
            } catch (e) {
                console.warn('Supabase portfolio fetch failed', e);
            }
        }

        // ২. Firebase (ফ্যালব্যাক)
        try {
            const snap = await db.collection('portfolios')
                .where('userId', '==', userId)
                .get();
            snap.forEach(doc => {
                const data = doc.data();
                portfolioData.push({
                    id: doc.id,
                    userId: data.userId,
                    shareName: data.shareName,
                    quantity: data.quantity,
                    buyPrice: data.buyPrice,
                    commission: data.commission || 0,
                    commissionPercent: data.commissionPercent || 0,
                    date: data.date ? data.date.toDate?.()?.toISOString?.()?.split('T')[0] : null,
                    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null
                });
            });
        } catch (e) {
            console.error('Firebase portfolio fetch failed', e);
        }

        return portfolioData;
    }

    // 📈 Sales History
    async getSalesHistory(userId) {
        const cacheKey = `sales_${userId}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const promise = this._fetchSalesHistory(userId);
        this.pendingRequests.set(cacheKey, promise);

        try {
            const data = await promise;
            this.setCache(cacheKey, data);
            return data;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    async _fetchSalesHistory(userId) {
        let salesData = [];

        if (typeof supabase !== 'undefined') {
            try {
                const { data, error } = await supabase
                    .from('sales_history')
                    .select('*')
                    .eq('user_id', userId);
                if (!error && data) {
                    salesData = data.map(item => ({
                        id: item.id,
                        userId: item.user_id,
                        shareName: item.share_name,
                        quantitySold: item.quantity_sold,
                        buyPrice: item.buy_price,
                        sellPrice: item.sell_price,
                        profitOrLoss: item.profit_or_loss,
                        commission: item.commission || 0,
                        commissionPercent: item.commission_percent || 0,
                        netReceived: item.net_received || 0,
                        date: item.date,
                        createdAt: item.created_at
                    }));
                    return salesData;
                }
            } catch (e) {}
        }

        try {
            const snap = await db.collection('sales_history')
                .where('userId', '==', userId)
                .get();
            snap.forEach(doc => {
                const data = doc.data();
                salesData.push({
                    id: doc.id,
                    userId: data.userId,
                    shareName: data.shareName,
                    quantitySold: data.quantitySold || 0,
                    buyPrice: data.buyPrice || 0,
                    sellPrice: data.sellPrice || 0,
                    profitOrLoss: data.profitOrLoss || 0,
                    commission: data.commission || 0,
                    commissionPercent: data.commissionPercent || 0,
                    netReceived: data.netReceived || 0,
                    date: data.date?.toDate?.()?.toISOString?.()?.split('T')[0] || null,
                    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null
                });
            });
        } catch (e) {}

        return salesData;
    }

    // 🗄️ ক্যাশ ম্যানেজমেন্ট
    getFromCache(key) {
        if (this.cache.has(key)) {
            const entry = this.cache.get(key);
            if (Date.now() - entry.timestamp < this.cacheTTL) {
                return entry.data;
            }
            this.cache.delete(key);
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
        this.pendingRequests.clear();
        console.log('🗑️ DataService cache cleared');
    }

    // 📅 ইউনিক টিকার লিস্ট (ডুপ্লিকেট বাদ)
    getUniqueTickers(portfolioData) {
        const tickers = new Set();
        portfolioData.forEach(item => {
            if (item.shareName) tickers.add(item.shareName);
        });
        return Array.from(tickers);
    }
}

// গ্লোবালি এক্সপোজ
if (typeof window !== 'undefined') {
    window.dataService = new DataService();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataService;
}