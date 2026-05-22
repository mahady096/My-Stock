// =================================================================
// আপনার ফায়ারবেস কনসোল থেকে পাওয়া আসল কনফিগারেশন
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDdPlBysAhWdbJ8KLhwoQaf2Z5EkiYdOUg",
  authDomain: "my-share-market-495aa.firebaseapp.com",
  projectId: "my-share-market-495aa",
  storageBucket: "my-share-market-495aa.firebasestorage.app",
  messagingSenderId: "1022913056078",
  appId: "1:1022913056078:web:bcc317b13a880382d2221f",
  measurementId: "G-Z3J503NM5E"
};

// ফায়ারবেস ইনিশিয়ালাইজেশন
firebase.initializeApp(firebaseConfig);

// গ্লোবাল ভেরিয়েবল তৈরি (যা app.js সরাসরি ব্যবহার করবে)
const auth = firebase.auth();
const db = firebase.firestore();

// 🔥 এই লাইনটি যোগ করুন - ওয়ার্নিং ফিক্স করার জন্য
// settings এ merge: true ব্যবহার করুন যাতে আগের সেটিংস ওভাররাইড না হয়
const settings = { 
  host: 'firestore.googleapis.com',  // ডিফল্ট হোস্ট
  ssl: true 
};
db.settings(settings); // merge ছাড়া সরাসরি সেট করলে ওয়ার্নিং যায়
