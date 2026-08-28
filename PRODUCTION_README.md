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
