# StockPulse Production v6.1.1

## Advanced Charts hardening
- Standalone Advanced Charts now loads config before Supabase initialization.
- localForage is explicitly loaded on the Advanced Charts page.
- Firebase → Supabase auth sync is started before chart data requests.
- Fullscreen export ordering is fixed.
- Chart forecasting errors are isolated so historical data still renders.
- Cache gracefully falls back to sessionStorage if IndexedDB/localForage is unavailable.

## Publish note
Keep Supabase RLS enabled. Do not put service-role keys in frontend files.


## StockPulse v6.2 hardening
- Removed unsafe `new Function()` execution from persisted price-alert callbacks. Existing alert data remains readable; callbacks are now notification-only.
- Kept the existing Supabase public/publishable key architecture; production authorization must continue to rely on Supabase RLS and the authenticated JWT.

### Pre-deployment checklist
1. Verify Supabase RLS for every user-owned table (SELECT/INSERT/UPDATE/DELETE).
2. Confirm no service-role key or privileged credential exists in frontend assets.
3. Test login, logout, portfolio CRUD, trade history, dividends and notifications on a fresh browser profile.
4. Run the app over HTTPS and test the service worker after each release.
5. Validate DSE/CSE data freshness and show the last-updated timestamp wherever market data is presented.
