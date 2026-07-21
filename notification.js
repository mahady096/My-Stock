// ==========================================
// 🔔 notification.js - সম্পূর্ণ ইরর-ফ্রি ভার্সন
//    প্রাইস অ্যালার্ট, ডেইলি সামারি, ব্রাউজার নোটিফিকেশন
// ==========================================

// ==========================================
// 📌 কনফিগ
// ==========================================
const NOTIFICATION_CONFIG = {
    STORAGE_KEY: 'price_alerts',
    DEFAULT_ICON: '/icons/icon-192x192.png',
    MAX_ALERTS: 50
};

// ==========================================
// 🔔 নোটিফিকেশন ম্যানেজার ক্লাস
// ==========================================
class NotificationManager {
    constructor() {
        this.permission = false;
        this.alerts = {};
        this.initialized = false;
        this.init();
    }

    // ==========================================
    // 🚀 ইনিশিয়ালাইজ
    // ==========================================
    async init() {
        try {
            // ব্রাউজার নোটিফিকেশন সাপোর্ট চেক
            if (!('Notification' in window)) {
                console.log('🔔 Notifications not supported in this browser');
                this.initialized = true;
                return;
            }

            // পারমিশন চেক
            if (Notification.permission === 'granted') {
                this.permission = true;
            } else if (Notification.permission === 'default') {
                // ইউজারকে জিজ্ঞেস করি (শুধু UI ইন্টারঅ্যাকশনে করাই ভালো)
                // কিন্তু এখানে আমরা শুধু চেক করছি
                const result = await Notification.requestPermission();
                this.permission = result === 'granted';
            }

            // সংরক্ষিত অ্যালার্ট লোড
            this.loadAlerts();

            console.log(`🔔 Notifications: ${this.permission ? '✅ Enabled' : '❌ Disabled'}`);
            this.initialized = true;
        } catch (error) {
            console.error('Notification init error:', error);
            this.initialized = true;
        }
    }

    // ==========================================
    // 💾 অ্যালার্ট লোড/সেভ
    // ==========================================
    loadAlerts() {
        try {
            const stored = localStorage.getItem(NOTIFICATION_CONFIG.STORAGE_KEY);
            if (stored) {
                this.alerts = JSON.parse(stored);
                // পুরনো ট্রিগার রিসেট করুন (যদি নতুন সেশন হয়)
                for (const key in this.alerts) {
                    if (this.alerts[key].triggered) {
                        // ২৪ ঘন্টা পর রিসেট
                        const triggerTime = this.alerts[key].triggeredAt || 0;
                        if (Date.now() - triggerTime > 86400000) {
                            this.alerts[key].triggered = false;
                            this.alerts[key].triggeredAt = null;
                        }
                    }
                }
                this.saveAlerts();
            }
        } catch (e) {
            console.warn('Failed to load alerts:', e);
            this.alerts = {};
        }
    }

    saveAlerts() {
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.STORAGE_KEY, JSON.stringify(this.alerts));
        } catch (e) {
            console.warn('Failed to save alerts:', e);
        }
    }

    // ==========================================
    // 📊 অ্যালার্ট সেট করুন
    // ==========================================
    setAlert(ticker, targetPrice, direction = 'any', callback = null) {
        if (!ticker || !targetPrice || targetPrice <= 0) {
            console.warn('Invalid alert parameters');
            return false;
        }

        // সীমা চেক
        const keys = Object.keys(this.alerts);
        if (keys.length >= NOTIFICATION_CONFIG.MAX_ALERTS) {
            console.warn('Max alerts reached');
            return false;
        }

        this.alerts[ticker] = {
            target: targetPrice,
            direction: direction, // 'up', 'down', 'any'
            triggered: false,
            triggeredAt: null,
            createdAt: Date.now(),
            callback: callback ? callback.toString() : null
        };

        this.saveAlerts();
        this.showNotification(
            `📊 Alert set for ${ticker}`,
            `Target: ৳${targetPrice.toFixed(2)} (${direction === 'any' ? 'any' : direction === 'up' ? '↑ up' : '↓ down'})`
        );
        return true;
    }

    // ==========================================
    // ❌ অ্যালার্ট রিমুভ
    // ==========================================
    removeAlert(ticker) {
        if (this.alerts[ticker]) {
            delete this.alerts[ticker];
            this.saveAlerts();
            this.showNotification(`🗑️ Alert removed for ${ticker}`, '');
            return true;
        }
        return false;
    }

    // ==========================================
    // 📋 সব অ্যালার্ট দেখান
    // ==========================================
    getAlerts() {
        return { ...this.alerts };
    }

    // ==========================================
    // 🔍 প্রাইস চেক করুন (ড্যাশবোর্ড রিফ্রেশে কল করুন)
    // ==========================================
    checkPriceAlerts(ticker, currentPrice) {
        if (!this.initialized || !this.permission) return;
        if (!ticker || currentPrice <= 0) return;

        const alert = this.alerts[ticker];
        if (!alert || alert.triggered) return;

        let shouldTrigger = false;
        let triggerMessage = '';

        if (alert.direction === 'up' && currentPrice >= alert.target) {
            shouldTrigger = true;
            triggerMessage = `📈 ${ticker} reached ৳${currentPrice.toFixed(2)} (Target: ৳${alert.target.toFixed(2)})`;
        } else if (alert.direction === 'down' && currentPrice <= alert.target) {
            shouldTrigger = true;
            triggerMessage = `📉 ${ticker} dropped to ৳${currentPrice.toFixed(2)} (Target: ৳${alert.target.toFixed(2)})`;
        } else if (alert.direction === 'any') {
            // ১% এর বেশি পরিবর্তন হলে ট্রিগার
            const changePercent = Math.abs((currentPrice - alert.target) / alert.target) * 100;
            if (changePercent >= 1) {
                shouldTrigger = true;
                const direction = currentPrice > alert.target ? '↑ up' : '↓ down';
                triggerMessage = `${ticker} moved ${direction} to ৳${currentPrice.toFixed(2)} (Target: ৳${alert.target.toFixed(2)})`;
            }
        }

        if (shouldTrigger) {
            alert.triggered = true;
            alert.triggeredAt = Date.now();
            this.saveAlerts();

            // কাস্টম কলব্যাক
            if (alert.callback) {
                try {
                    const fn = new Function('return ' + alert.callback)();
                    if (typeof fn === 'function') fn(ticker, currentPrice, alert.target);
                } catch (e) {
                    console.warn('Callback error:', e);
                }
            }

            this.showNotification('🔔 Price Alert!', triggerMessage);
        }
    }

    // ==========================================
    // 📈 ডেইলি সামারি নোটিফিকেশন
    // ==========================================
    showDailySummary(pl, percentage, totalValue) {
        if (!this.initialized || !this.permission) return;
        const emoji = pl >= 0 ? '📈' : '📉';
        const body = `P&L: ${pl >= 0 ? '+' : ''}৳${pl.toFixed(2)} (${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%) | Total: ৳${totalValue.toFixed(2)}`;
        this.showNotification(`${emoji} Daily Portfolio Update`, body);
    }

    // ==========================================
    // 💬 জেনেরিক নোটিফিকেশন
    // ==========================================
    showNotification(title, body, icon = NOTIFICATION_CONFIG.DEFAULT_ICON) {
        if (!this.initialized) {
            console.log('🔔 Notification not initialized yet');
            return;
        }
        if (!this.permission) {
            console.log('🔔 Notification permission not granted');
            return;
        }

        try {
            const options = {
                body: body || '',
                icon: icon,
                badge: '/icons/icon-96x96.png',
                vibrate: [200, 100, 200],
                requireInteraction: false,
                silent: false,
                tag: Date.now().toString()
            };
            new Notification(title, options);
        } catch (error) {
            console.warn('Notification show error:', error);
        }
    }

    // ==========================================
    // 🔄 সব অ্যালার্ট রিসেট
    // ==========================================
    resetAllAlerts() {
        this.alerts = {};
        this.saveAlerts();
        this.showNotification('🔄 All alerts reset', '');
    }

    // ==========================================
    // 📊 অ্যালার্টের অবস্থা (UI-এর জন্য)
    // ==========================================
    getAlertStatus(ticker) {
        return this.alerts[ticker] || null;
    }

    getActiveAlerts() {
        const active = {};
        for (const [key, value] of Object.entries(this.alerts)) {
            if (!value.triggered) {
                active[key] = value;
            }
        }
        return active;
    }

    getTriggeredAlerts() {
        const triggered = {};
        for (const [key, value] of Object.entries(this.alerts)) {
            if (value.triggered) {
                triggered[key] = value;
            }
        }
        return triggered;
    }
}

// ==========================================
// 🌐 গ্লোবালি এক্সপোজ
// ==========================================
let notificationManager = null;

try {
    notificationManager = new NotificationManager();
    if (typeof window !== 'undefined') {
        window.notificationManager = notificationManager;
    }
    console.log('✅ NotificationManager initialized');
} catch (error) {
    console.error('❌ Failed to initialize NotificationManager:', error);
    notificationManager = new Proxy({}, {
        get: () => () => console.warn('NotificationManager unavailable')
    });
}

// ==========================================
// 📤 এক্সপোর্ট (যদি module system ব্যবহার হয়)
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { notificationManager, NotificationManager };
}

console.log('✅ notification.js loaded successfully');