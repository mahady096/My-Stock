// ==========================================
// 📦 sw.js - সম্পূর্ণ আপডেটেড ভার্সন (v10.0)
//    উন্নত ক্যাশিং, নতুন ফাইল সমর্থন, API আলাদা
// ==========================================

const CACHE_NAME = 'stock-portfolio-v10.0';
const STATIC_CACHE = 'static-v10.0';
const API_CACHE = 'api-v10.0';

// স্ট্যাটিক ফাইলসমূহ – যেগুলো অফলাইনে কাজ করবে
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/config.js',
  '/data-service.js',
  '/core.js',
  '/portfolio.js',
  '/dashboard.js',
  '/ui.js',
  '/scanner.js',
  '/marketwatch.js',
  '/deep-analysis.js',
  '/smart-signals.js',
  '/record-date.js',
  '/firebase-config.js',
  '/supabase-config.js',
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
// 🔧 ইনস্টল ইভেন্ট – ক্যাশিং
// ==========================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Cache addAll failed:', err))
  );
  self.skipWaiting(); // নতুন SW সাথে সাথে অ্যাক্টিভ হবে
});

// ==========================================
// 🔄 অ্যাক্টিভেট ইভেন্ট – পুরনো ক্যাশ পরিষ্কার
// ==========================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== API_CACHE)
            .map(key => {
              console.log('🗑️ Removing old cache:', key);
              return caches.delete(key);
            })
      );
    })
  );
  self.clients.claim(); // ক্লায়েন্টদের নতুন SW-তে নিয়ে আসে
});

// ==========================================
// 🌐 ফেচ ইভেন্ট – স্মার্ট ক্যাশিং স্ট্র্যাটেজি
// ==========================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;

  // ১. API রিকোয়েস্ট – নেটওয়ার্ক ফার্স্ট, ক্যাশ ফ্যালব্যাক
  if (url.pathname.includes('/api/') || 
      url.hostname.includes('dse-scraper') ||
      url.pathname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // শুধু সফল রেসপন্স ক্যাশ করব
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
          return caches.match(request).then(cached => cached || new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // ২. স্ট্যাটিক রিসোর্স – ক্যাশ ফার্স্ট, তারপর নেটওয়ার্ক
  if (urlsToCache.some(path => url.pathname === path) ||
      url.pathname.match(/\.(css|js|png|jpg|svg|woff2?|json)$/)) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          // ক্যাশে না থাকলে নেটওয়ার্ক থেকে ফেচ করে ক্যাশে যোগ করি
          return fetch(request).then(fetchRes => {
            if (fetchRes && fetchRes.status === 200) {
              const clone = fetchRes.clone();
              caches.open(STATIC_CACHE).then(cache => {
                cache.put(request, clone);
              });
            }
            return fetchRes;
          });
        })
        .catch(() => {
          // সব ব্যর্থ হলে index.html দেখান (SPA এর জন্য)
          return caches.match('/index.html');
        })
    );
    return;
  }

  // ৩. বাকি সব রিকোয়েস্ট – নেটওয়ার্ক (ক্যাশ নয়)
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match('/index.html');
    })
  );
});

// ==========================================
// 📡 ব্যাকগ্রাউন্ড সিঙ্ক (ঐচ্ছিক)
//    অফলাইনে করা ট্রানজেকশন অনলাইনে সিঙ্ক করতে
// ==========================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-portfolio') {
    event.waitUntil(syncPortfolioData());
  }
});

async function syncPortfolioData() {
  try {
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    for (const req of requests) {
      if (req.url.includes('/api/') && req.method === 'POST') {
        const response = await fetch(req);
        if (response.ok) {
          await cache.delete(req);
        }
      }
    }
    console.log('✅ Background sync completed');
  } catch (err) {
    console.error('❌ Background sync failed:', err);
  }
}

// ==========================================
// 📢 পুশ নোটিফিকেশন (ঐচ্ছিক)
// ==========================================
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '📊 StockPulse Update';
  const options = {
    body: data.body || 'Your portfolio has been updated.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: data.url || '/'
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

console.log('✅ Service Worker (v10.0) loaded successfully');