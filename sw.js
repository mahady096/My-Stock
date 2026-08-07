// ==========================================
// 📦 sw.js - StockPulse PWA Service Worker v2.0
//    উন্নত ক্যাশিং, অফলাইন সাপোর্ট, ব্যাকগ্রাউন্ড সিঙ্ক
// ==========================================

const CACHE_NAME = 'stockpulse-v2.0.0';
const STATIC_CACHE = 'static-v2.0.0';
const API_CACHE = 'api-v2.0.0';
const DYNAMIC_CACHE = 'dynamic-v2.0.0';

// ==========================================
// 📦 ক্যাশে রাখার ফাইলসমূহ
// ==========================================
const urlsToCache = [
  '/',
  '/index.html',
  '/adv-charts.html',
  '/style.css',
  '/manifest.json',
  '/favicon.ico',
  
  // কোর JS ফাইল
  '/config.js',
  '/firebase-config.js',
  '/supabase-config.js',
  '/data-service.js',
  '/cache-helper.js',
  '/core.js',
  '/indicators.js',
  
  // ড্যাশবোর্ড
  '/dash-cards.js',
  '/dash-performance.js',
  '/dash-charts.js',
  '/dash-signals.js',
  '/dash-utils.js',
  
  // ট্রেড
  '/trade-buy.js',
  '/trade-sell.js',
  '/trade-history.js',
  '/trade-analysis.js',
  '/trade-suggestion.js',
  '/trade-stock-table.js',
  
  // ফিচার
  '/scanner.js',
  '/marketwatch.js',
  '/deep-analysis.js',
  '/smart-signals.js',
  '/record-date.js',
  '/dividend.js',
  '/portfolio-manager.js',
  '/notification.js',
  
  // UI
  '/ui-helpers.js',
  '/ui-modals.js',
  '/ui-charts.js',
  '/sync-metadata.js',
  '/global-fix.js',
  '/patch.js',
  
  // আইকন
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// ==========================================
// 🔧 ইনস্টল ইভেন্ট
// ==========================================
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[SW] Cache addAll failed:', err);
        // কিছু ফাইল না থাকলেও SW কাজ করবে
      })
  );
  // নতুন SW সাথে সাথে অ্যাক্টিভ হবে
  self.skipWaiting();
});

// ==========================================
// 🔄 অ্যাক্টিভেট ইভেন্ট – পুরনো ক্যাশ পরিষ্কার
// ==========================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => {
          // বর্তমান ক্যাশ ছাড়া সব ডিলিট
          return key !== STATIC_CACHE && 
                 key !== API_CACHE && 
                 key !== DYNAMIC_CACHE &&
                 key !== CACHE_NAME;
        }).map(key => {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  // সব ক্লায়েন্টকে নতুন SW-তে নিয়ে আসে
  return self.clients.claim();
});

// ==========================================
// 🌐 ফেচ ইভেন্ট – স্মার্ট ক্যাশিং স্ট্র্যাটেজি
// ==========================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;

  // ---------- ১. API রিকোয়েস্ট – নেটওয়ার্ক ফার্স্ট, ক্যাশ ফ্যালব্যাক ----------
  if (url.pathname.includes('/api/') || 
      url.hostname.includes('dse-scraper') ||
      url.hostname.includes('supabase') ||
      url.hostname.includes('bd-stock-api')) {
    
    event.respondWith(
      fetch(request)
        .then(response => {
          // শুধু সফল রেসপন্স ক্যাশ করব (API-র জন্য ৫ মিনিট)
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // অফলাইনে ক্যাশ থেকে রিটার্ন
          return caches.match(request).then(cached => {
            if (cached) return cached;
            // ক্যাশ না থাকলে JSON ফ্যালব্যাক
            return new Response(JSON.stringify({ 
              error: 'Offline', 
              message: 'You are offline. Please check your connection.' 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // ---------- ২. স্ট্যাটিক রিসোর্স – ক্যাশ ফার্স্ট, তারপর নেটওয়ার্ক ----------
  if (urlsToCache.some(path => url.pathname === path) ||
      url.pathname.match(/\.(css|js|png|jpg|svg|woff2?|json|ico)$/)) {
    
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // ক্যাশ হিট
            return response;
          }
          // ক্যাশে না থাকলে নেটওয়ার্ক থেকে ফেচ করে ক্যাশে যোগ
          return fetch(request).then(fetchRes => {
            if (fetchRes && fetchRes.status === 200) {
              const clone = fetchRes.clone();
              caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(request, clone);
              });
            }
            return fetchRes;
          });
        })
        .catch(() => {
          // সব ব্যর্থ হলে অফলাইন পেজ দেখান
          return caches.match('/index.html');
        })
    );
    return;
  }

  // ---------- ৩. HTML পেজ – নেটওয়ার্ক ফার্স্ট, ক্যাশ ফ্যালব্যাক ----------
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // সফল রেসপন্স ক্যাশে যোগ
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // অফলাইনে ক্যাশ থেকে index.html দেখান
          return caches.match('/index.html');
        })
    );
    return;
  }

  // ---------- ৪. বাকি সব রিকোয়েস্ট – নেটওয়ার্ক (ক্যাশ নয়) ----------
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match('/index.html');
    })
  );
});

// ==========================================
// 📡 ব্যাকগ্রাউন্ড সিঙ্ক (অফলাইনে করা ট্রানজেকশন সিঙ্ক)
// ==========================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-portfolio') {
    event.waitUntil(syncPortfolioData());
  }
});

async function syncPortfolioData() {
  try {
    console.log('[SW] Starting background sync...');
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    
    let synced = 0;
    for (const req of requests) {
      if (req.url.includes('/api/') && req.method === 'POST') {
        try {
          const response = await fetch(req);
          if (response.ok) {
            await cache.delete(req);
            synced++;
          }
        } catch (e) {
          console.warn('[SW] Sync failed for:', req.url);
        }
      }
    }
    console.log(`[SW] Background sync completed: ${synced} items synced`);
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

// ==========================================
// 📢 পুশ নোটিফিকেশন
// ==========================================
self.addEventListener('push', event => {
  if (!event.data) {
    console.log('[SW] Push received but no data');
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || '📊 StockPulse Update';
    const options = {
      body: data.body || 'Your portfolio has been updated.',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        date: data.date || Date.now()
      },
      actions: [
        { action: 'open', title: '📊 Open App' },
        { action: 'dismiss', title: '✖ Dismiss' }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (e) {
    console.error('[SW] Push notification error:', e);
  }
});

// ==========================================
// 🔔 নোটিফিকেশন ক্লিক হ্যান্ডলার
// ==========================================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      // ইতিমধ্যে খোলা উইন্ডো থাকলে সেটা ফোকাস করুন
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // না থাকলে নতুন উইন্ডো খুলুন
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ==========================================
// 📶 নেটওয়ার্ক স্ট্যাটাস চেঞ্জ (অফলাইন/অনলাইন)
// ==========================================
self.addEventListener('online', () => {
  console.log('[SW] Online - checking for updates...');
  // অনলাইনে আসলে ক্যাশ আপডেট করুন
  self.registration.sync.register('sync-portfolio');
});

self.addEventListener('offline', () => {
  console.log('[SW] Offline - serving from cache');
});

// ==========================================
// 🔄 মেসেজ হ্যান্ডলার (UI থেকে কমান্ড)
// ==========================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(
          keys.map(key => {
            console.log('[SW] Clearing cache:', key);
            return caches.delete(key);
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ Service Worker v2.0 loaded successfully');