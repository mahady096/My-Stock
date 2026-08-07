// ==========================================
// 📁 firebase-config.js - সম্পূর্ণ ইরর-ফ্রি ভার্সন
//    Firebase initialization, auth, firestore with persistence
//    🔥 Compat SDK (v9 compat) সঠিকভাবে ব্যবহার করা হয়েছে
// ==========================================

// Firebase কনফিগারেশন
const firebaseConfig = {
  apiKey: "AIzaSyDdPlBysAhWdbJ8KLhwoQaf2Z5EkiYdOUg",
  authDomain: "my-share-market-495aa.firebaseapp.com",
  projectId: "my-share-market-495aa",
  storageBucket: "my-share-market-495aa.firebasestorage.app",
  messagingSenderId: "1022913056078",
  appId: "1:1022913056078:web:bcc317b13a880382d2221f",
  measurementId: "G-Z3J503NM5E"
};

// ==========================================
// 🔥 Firebase ইতিমধ্যে initialized কিনা চেক করুন
// ==========================================
if (typeof firebase === 'undefined') {
  console.error("❌ Firebase library not loaded! Please check network connection.");
} else {
  // Firebase ইতিমধ্যে initialized কিনা চেক করুন
  if (!firebase.apps || firebase.apps.length === 0) {
    try {
      firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase initialized successfully");
    } catch (error) {
      console.error("❌ Firebase initialization failed:", error);
    }
  } else {
    console.log("✅ Firebase already initialized");
  }
}

// ==========================================
// 📦 গ্লোবাল ভেরিয়েবল (auth, db)
// ==========================================
let auth = null;
let db = null;

try {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    // 🔥 compat SDK ব্যবহার করে auth ও firestore ইনিট
    auth = firebase.auth();
    db = firebase.firestore();
    console.log("✅ Firebase Auth & Firestore initialized");
  } else {
    console.warn("⚠️ Firebase not initialized. Auth & Firestore unavailable.");
  }
} catch (error) {
  console.error("❌ Error initializing Firebase services:", error);
}

// ==========================================
// 💾 Offline Persistence (IndexedDB)
// ==========================================
if (db && typeof db.enablePersistence === 'function') {
  // IndexedDB সাপোর্ট চেক করুন
  if ('indexedDB' in window) {
    db.enablePersistence({ synchronizeTabs: true })
      .then(() => {
        console.log('✅ Offline persistence enabled (sync tabs)');
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ Multiple tabs open, persistence enabled in first tab only.');
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Browser doesn\'t support persistence.');
        } else {
          console.warn('⚠️ Persistence error:', err.message);
        }
      });
  } else {
    console.warn('⚠️ IndexedDB not supported, persistence disabled.');
  }
} else {
  console.warn('⚠️ Firestore not available, persistence skipped.');
}

// ==========================================
// 🔐 Auth State Change Listener (গ্লোবাল)
// ==========================================
if (auth && typeof auth.onAuthStateChanged === 'function') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log(`✅ User logged in: ${user.email || user.uid}`);
    } else {
      console.log('👤 User logged out');
    }
  });
} else {
  console.warn('⚠️ Auth not available, state listener skipped.');
}

// ==========================================
// 🌐 গ্লোবালি এক্সপোজ (window)
// ==========================================
if (typeof window !== 'undefined') {
  window.auth = auth;
  window.db = db;
  window.firebaseConfig = firebaseConfig;
}

// ==========================================
// 📤 এক্সপোর্ট (যদি module system ব্যবহার করা হয়)
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { auth, db, firebaseConfig };
}

console.log('✅ firebase-config.js loaded successfully');