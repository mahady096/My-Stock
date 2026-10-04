# StockPulse Release Notes

## Current architecture
- Firebase Authentication remains the authentication system.
- Supabase is the primary source for market data and user/business data.
- Firebase Firestore is used as a recovery backup for user/business data.
- Scheduled Firebase backup excludes stock prices and stock-price history.
- Portfolio, sales, and dividend writes go to Supabase first; Firebase is used only as an emergency write fallback when the primary write fails.
- Portfolio/sales recovery reads use the scheduled `backup_*` Firestore collections when Supabase is unavailable.
- Subscription recovery uses `backup_subscriptions` when Supabase is unavailable.
- FCM operational tokens remain in Firebase and are not written to the non-existent Supabase `users` table.
- Advanced Charts has a direct-route Pro access guard that verifies Firebase Auth and a fresh Supabase subscription before rendering.

## Validation
- All JavaScript files pass `node --check`.
## Scanner / LTP Fixes — 2026-10-02
- Buy flow no longer shows the obsolete “Firebase mirror failed” warning after a successful Supabase save.
- Central current-LTP flow is now **Supabase `dse_live_data` → Supabase `cse_market_data`** only. Firebase stock-price collections are not used for live LTP.
- Combined Scanner / RSI historical mapping fixed to use `history_dse.ticker` (previous code grouped rows under `undefined` because it referenced `code`).
- Scanner live-price lookup now follows DSE-first, CSE-fallback order.
- Portfolio PSAR screener historical query now uses `history_dse.ticker`.
