// supabase-config.js
// এটি সাধারণ JavaScript ফাইল, module নয়
//
// ✅ ফিক্স v2:
// - Supabase URL/Key এখন config.js-এর APP_CONFIG থেকে পড়া হচ্ছে
//   (আগে এখানে আলাদাভাবে হার্ডকোড করা ছিল — একই ভ্যালু দুই জায়গায়,
//   key rotate করলে দুই ফাইলেই আপডেট করা লাগত, একটা মিস করলে
//   সাইলেন্ট bug হতো)
// - যদি কোনো কারণে APP_CONFIG এখনো লোড না হয়ে থাকে (script order
//   সমস্যা), একটা fallback হার্ডকোড ভ্যালু ব্যবহার হবে এবং কনসোলে
//   সতর্কতা দেখানো হবে — যাতে অ্যাপ ভেঙে না পড়ে
//
// ⚠️ গুরুত্বপূর্ণ: এই ফিক্স কাজ করার জন্য index.html-এ config.js
// অবশ্যই supabase-config.js-এর আগে লোড হতে হবে। বর্তমানে
// index.html-এ script অর্ডার এরকম আছে:
//     firebase-config.js → supabase-config.js → config.js
// এটা উল্টো — config.js-কে সবার আগে (বা অন্তত supabase-config.js-এর
// আগে) আনতে হবে, নাহলে নিচের fallback ভ্যালুই সবসময় ব্যবহার হবে।

(function() {
    // ✅ ফিক্স: প্রথমে APP_CONFIG থেকে পড়ার চেষ্টা, না পেলে fallback
    const FALLBACK_URL = 'https://dpdicusxlrdydajkcgev.supabase.co';
    const FALLBACK_KEY = 'sb_publishable_vIexTeuEoBjiFoA0F2w2Ag_3GUn_SMX';

    let supabaseUrl = FALLBACK_URL;
    let supabaseAnonKey = FALLBACK_KEY;

    if (typeof window.APP_CONFIG !== 'undefined' &&
        window.APP_CONFIG.API &&
        window.APP_CONFIG.API.SUPABASE_URL &&
        window.APP_CONFIG.API.SUPABASE_ANON_KEY) {
        supabaseUrl = window.APP_CONFIG.API.SUPABASE_URL;
        supabaseAnonKey = window.APP_CONFIG.API.SUPABASE_ANON_KEY;
    } else {
        // config.js এখনো লোড হয়নি বা APP_CONFIG পাওয়া যায়নি —
        // fallback ভ্যালু দিয়ে চালিয়ে যাচ্ছি, কিন্তু সতর্ক করছি
        console.warn(
            '⚠️ supabase-config.js: window.APP_CONFIG পাওয়া যায়নি। ' +
            'config.js কি supabase-config.js-এর আগে লোড হচ্ছে? ' +
            'ফলব্যাক (হার্ডকোডেড) Supabase কী ব্যবহার করা হচ্ছে। ' +
            'index.html-এ script অর্ডার ঠিক করুন: config.js আগে, তারপর supabase-config.js।'
        );
    }

    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded!');
        return;
    }

    window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true },
        realtime: { autoConnect: false }
    });

    console.log('✅ Supabase client initialized (global)');
})();
