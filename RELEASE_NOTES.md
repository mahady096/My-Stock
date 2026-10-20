# StockPulse v30 — Premium final

## EPS ও P/E
- EPS, P/E ও তাদের হিস্ট্রি চার্ট এখন শুধু Supabase `daily_closing_prices` টেবিল থেকে আসে (`fundamentals.js`)।
- কলামের নাম অটো-শনাক্ত হয়: টিকার (`code`/`ticker`/`symbol`), তারিখ (`date`/`trade_date`), EPS (`eps`), P/E (`pe_ratio`/`pe`)। কলাম না পেলে চার্ট মডালে কোন কলাম পাওয়া গেছে তা দেখায়।
- EPS বা P/E কার্ডে ক্লিক করলে হিস্ট্রি চার্ট: EPS/P/E ট্যাব, 1M/3M/6M/1Y/All, Latest/Change/High/Low।
- ঋণাত্মক মান লাল রঙে দেখায়। ডিপ-অ্যানালাইসিসের EPS-ও এই টেবিল থেকে।

## সংখ্যার ফরম্যাট
- ড্যাশবোর্ড কার্ড, পারফরম্যান্স সামারি, টেবিল ও চার্ট টুলটিপের টাকার অঙ্ক এখন ইংরেজি ডিজিটে (লাখ-কোটি গ্রুপিং: ৳15,77,972.50)।
- `daily_closing_prices` স্কিমা (id, ticker, date, ltp, eps, pe_ratio) অনুযায়ী যাচাই; `N/A` ও `0` EPS-এ P/E ফাঁকা দেখায়।

## EPS/P/E কার্ডে "-" সমস্যা
- `daily_closing_prices`-এর সাম্প্রতিক সারিতে eps/pe_ratio ফাঁকা থাকলে কার্ড আর "-" দেখায় না; সর্বশেষ মানসহ সারির তারিখ দেখায় ("as of 2026-09-17 · newer rows empty")।
- EPS 0 হলে P/E "undefined" হিসেবে থাকে, পুরনো P/E বসানো হয় না।

## DSEX হিস্ট্রি চার্ট
- ড্যাশবোর্ডে DSEX ক্লিক করলে এখন ল্যান্ডিং পেজের মতোই `market_summary` (dsex, market_date) থেকে ডেটা নেয়; আগে `dsex_index` থেকে নিত, যেখানে ভুল মান (যেমন ~5530) ছিল।
- প্রতিদিন একটাই মান (সর্বশেষ স্ক্র্যাপ), ১০০০–১০০০০ বাইরের মান বাদ, আর পাশের দিনগুলোর মধ্যমা থেকে ১০%-এর বেশি দূরের একক স্পাইক বাদ।
- 7D/30D/90D/1Y রেঞ্জ, Latest/Change/High/Low, গ্রেডিয়েন্ট চার্ট, ছোট তারিখ লেবেল।

## Service worker ও পরিচ্ছন্নতা
- precache তালিকায় ৪টি অনুপস্থিত ফাইল ছিল (favicon.ico, icon-128/152/384)। `cache.addAll` একটা ফাইল না পেলে পুরোটাই বাতিল হয়, ফলে অফলাইন ক্যাশ কাজ করত না। তালিকা ঠিক করা হয়েছে এবং ফাইল-ভিত্তিক ক্যাশিং করা হয়েছে।
- কোথাও লোড না হওয়া পুরনো `portfolio.js`, `dashboard.js`, `adv-charts.js` `docs/legacy/`-এ সরানো হয়েছে।

## চার্ট ও UI
- `premium-charts.js`: সব Chart.js চার্টে একই ফন্ট, টুলটিপ, গ্রিড, মসৃণ লাইন; থিম বদলালে রং আপডেট হয়।
- Chart.js `@4.4.4`-এ পিন করা হয়েছে (আগে ভার্সনহীন লিংক ছিল)।
- স্টক মডালের কার্ড, টেবিল, বাটন, মডাল, সাইডবার ও স্ক্রলবারে প্রিমিয়াম ফিনিশ।
- ড্যাশবোর্ড কাঠামো: বাক্সের ভেতর বাক্স সরানো, সমান ফাঁকে সাজানো কার্ড (DSEX, সার্চ, আপডেট টাইম, মোড বাটন)।
- মোবাইলে থিম বাটন ছোট গোল আইকন, কনটেন্টের ওপর আর বড় হয়ে বসে না।

# ড্যাশবোর্ড কার্ড

## ড্যাশবোর্ড কার্ড
- পাঁচটি কার্ড নতুন করে ডিজাইন: গাঢ় গ্লাস সারফেস, প্রতিটি মেট্রিকের নিজস্ব অ্যাকসেন্ট রং, আইকন চিপ, নিচে রঙিন বার।
- Total Value কার্ড পুরো প্রস্থে (হিরো), বাকি চারটি 2×2 গ্রিডে — আগের একা পড়ে থাকা পঞ্চম কার্ড ঠিক হয়েছে।
- Daily P/L, Total P/L, Total Income-এ সবুজ/লাল লেখা আগে উজ্জ্বল ব্যাকগ্রাউন্ডে পড়া যেত না; এখন সব কার্ডে স্পষ্ট।
- লেবেল সব-ক্যাপস থেকে সাধারণ কেসে; শতাংশ এখন পিল ব্যাজে।
- "No Commission 0%" বারের ফাঁক ঠিক করা হয়েছে; Stored/Live বাটন ছোট স্ক্রিনে র‍্যাপ করে।
- Service worker cache `v6.3.0`।

## GitHub প্রস্তুতি
- `README.md` ও `.gitignore` যোগ করা হয়েছে।


## আগের দিনের দাম (Previous Close)
- Previous Close এখন DSE history (`history_dse`) থেকে আসে; ছুটির দিনে (শুক্র/শনি) লাইভ ডেটা থাকলেও সঠিক YCP দেখায়।
- DSE-ই মূল দাম; CSE শুধু তুলনা/ফলব্যাক। ডেমো দাম বন্ধ (`ALLOW_DEMO_PRICE_FALLBACK: false`)।

## Stock modal কার্ড — পড়ার সুবিধা
- সব গ্রেডিয়েন্ট কার্ডে উজ্জ্বল ব্যাকগ্রাউন্ডে সাদা লেখার সমস্যা ঠিক করা হয়েছে (গাঢ় রং, বেশি কনট্রাস্ট)।
- Total Gain/Loss কার্ড গাঢ় ব্যাকগ্রাউন্ডে; সবুজ/লাল সংখ্যা এখন স্পষ্ট।
- ছোট লেখা (10–11px) বড় করা হয়েছে; ফ্যাকাশে (opacity) লেখা গাঢ় করা হয়েছে; Dividend/Record Date লিংকের রং থিম অনুযায়ী।

## নিরাপত্তা
- `spEscapeHtml` যোগ; `innerHTML`-এ বসানো সব `error.message` escape করা হয়েছে (১৯টি জায়গা)।
- Buy/Sell-এ টিকার ফরম্যাট ভ্যালিডেশন (`A-Z 0-9 . _ & -`)।
- `.trashed-*` পুরনো ফাইল মুছে ফেলা হয়েছে; পুরনো রিলিজ নোট `docs/history/`-এ সরানো হয়েছে।

## অন্যান্য
- `core.js`-এর পুরনো/ভুল মন্তব্য ঠিক করা হয়েছে।
- Service worker cache `v6.2.6`।

## পরীক্ষা
- সব `.js` ফাইলে সিন্ট্যাক্স চেক করা হয়েছে। লাইভ Supabase/Firebase ও ফোনে পূর্ণ পরীক্ষা আপনার পরিবেশে করতে হবে।


## v31 final consistency fixes (2026-10-10)
- Standardized DSEX data reads in the public landing chart, DSEX history modal, latest DSEX fallback/helper, and dashboard benchmark return calculations to `public.market_summary` (`dsex`, `market_date`, `scraped_at`).
- Filtered invalid/out-of-range DSEX points (including zero values) and de-duplicated multiple rows by trading date in the affected data paths.
- Corrected the scraper-admin allowlist email typo so both configured admins are `admin.stockpulse@gmail.com` and `mahady0069@gmail.com`.
- Static checks only; live Supabase, Firebase/RLS, and browser/Acode workflows still require deployment-side verification.


## Maintenance patch — 2026-10-20

- Renamed page-specific sort-indicator helpers to avoid global function-name collisions across classic scripts.
- Deep Analysis now fetches historical high/low as single-row ordered queries and limits RSI/PSAR input to the latest 30 trading records, reducing returned history payload.
- Bumped service-worker cache identifiers to v6.3.5 so clients can receive the updated scripts.
- Validation: JavaScript syntax checks and scraper offline parser tests passed. Live Supabase and live DSE source validation still require deployment credentials/network runtime.
