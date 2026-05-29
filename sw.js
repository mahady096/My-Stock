// sw.js - সম্পূর্ণ আপডেটেড ভার্সন
const CACHE_NAME = 'stock-portfolio-v2'; // ← VERSSION NUMBER পরিবর্তন করুন

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/firebase-config.js',
  '/manifest.json'
];

// ইন্সটল ইভেন্ট
self.addEventListener('install', event => {
  console.log('🔄 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching files...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // ← নতুন SW immediately active হবে
  );
});

// ফেচ ইভেন্ট - নেটওয়ার্ক ফার্স্ট স্ট্র্যাটেজি
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // সফল response ক্যাশে সংরক্ষণ
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // নেটওয়ার্ক fail হলে ক্যাশ থেকে দেখান
        return caches.match(event.request);
      })
  );
});

// অ্যাক্টিভেট ইভেন্ট - পুরনো ক্যাশ ক্লিয়ার করুন
self.addEventListener('activate', event => {
  console.log('⚡ Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // ← নতুন SW control নেবে
  );
});
