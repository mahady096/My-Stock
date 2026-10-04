# StockPulse Optimized V3 — Test & Architecture Notes

## Verified in this build
- All JavaScript files pass `node --check`.
- ZIP integrity passes `unzip -t`.
- Current market-data reads used by legacy UI modules are routed through a Supabase compatibility layer.
- `daily_prices` legacy reads -> Supabase `history_dse`.
- `cse_detailed_data` legacy reads -> Supabase `cse_market_data`.
- `dse_market_data` legacy reads -> Supabase `dsex_index` (DSEX filter applied).
- `stock_metadata` legacy reads -> Supabase `stock_metadata`.
- Buy/live-price loading uses Supabase DSE -> Supabase CSE; legacy external live-price endpoint was removed from buy flow.
- Historical data helper uses Supabase `history_dse` only.
- Advanced chart database mode no longer falls back to the old external historical API.
- Record-date market data is Supabase-only.
- Core latest-stock and ticker lookup functions use Supabase `dse_live_data` -> `cse_market_data`.

## Firebase role
- Firebase Auth remains the authentication system.
- Firebase Messaging/FCM remains operational.
- Firebase is not used as the primary market-price/history source.
- Supabase -> Firebase backup remains the scheduled backup mechanism for user/business tables.

## Important limitation
This environment cannot perform a real browser login against the production app or execute GitHub Actions with the user's secrets. Therefore this build is statically/syntax/integrity tested, but it is not a claim of end-to-end production verification.

## Remaining architecture item to review
`portfolios_meta` is still implemented as a Firebase operational store because no corresponding Supabase table was established in the inspected schema. It should be migrated to a Supabase table if the requirement is literally that every user/business data object has Supabase as primary.
