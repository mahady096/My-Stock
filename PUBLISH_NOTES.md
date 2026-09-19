StockPulse v6.1.7 — Advanced Charts Touch/Cache Fix

- Bumped the service-worker cache namespace so mobile browsers receive the current chart scripts instead of stale cached code.
- Added Advanced Charts and chart-extra scripts to the service-worker static cache.
- Added mobile tap handling hints to chart controls to avoid gesture delay on touch devices.

StockPulse v6.1.6 — Publishable QA Fixes

- Fixed Advanced Charts startup error caused by core code referencing controls before the extras script loaded.
- Restored working PNG chart export on Advanced Charts.
- Wrapped authentication and password-change inputs in accessible forms with autocomplete metadata.
- Added screen-reader-only labels for password and email fields.

StockPulse v6.1.5 — Smart Suggestion + Theme Polish

- Smart Suggestion no longer fails on short 1-month trading windows; it works with 14+ valid price points and falls back safely when longer indicators are unavailable.
- Smart Suggestion and Deep Analysis colors now follow light/dark theme variables instead of hard-coded white text.
- Suggestion cards use accessible theme-aware backgrounds, borders, and muted text.

# StockPulse Release Notes — UX Polish Build

This build includes a production-oriented UX polish pass:

- Simplified sidebar labels and navigation grouping.
- Clearer stored-data vs live-data controls.
- Market-data freshness / delay notice.
- Financial-information disclaimer around technical signals.
- Custom accessible Buy/Sell confirmation modal with trade totals.
- Removed silent hardcoded demo-price fallback in production; demo prices are now opt-in only.
- Removed the duplicate hardcoded Supabase fallback configuration.
- Bumped the service-worker cache version to force updated frontend assets.
- Updated PWA title/description for StockPulse.

## Before public launch

1. Verify Supabase Row Level Security (RLS) for every user-owned table.
2. Verify Firebase/Firestore security rules for user-owned documents.
3. Confirm market-data source timestamps and delayed-data behavior.
4. Test Buy/Sell, logout/login, refresh, mobile layout, offline mode and service-worker updates.
5. Keep production demo-price fallback disabled (`ALLOW_DEMO_PRICE_FALLBACK: false`).

The frontend ZIP cannot verify or change your Supabase/Firebase backend rules; those must be checked in their respective consoles/migrations before launch.


## v6.1.2 security update
- Metadata sync no longer writes to Firebase or Supabase directly from the browser.
- Deploy `supabase/functions/sync-metadata` with the service-role secret stored only in Edge Function secrets.
- Keep `stock_metadata` RLS read-only for authenticated clients.
- `config.js` now loads before `supabase-config.js` on Advanced Charts.
- Supabase uses one client per page with dynamic Firebase JWT injection.
