# StockPulse Final — Pre-calculated Indicators

- Supabase `history_dse` remains the historical/raw market source.
- Supabase `stock_metadata` is the fast latest-indicator snapshot.
- Added support for `stock_metadata.indicators` JSONB.
- Scanner reads pre-calculated RSI/PSAR first and only calculates from history as fallback.
- Firebase remains user/business backup only; market/indicator data is not mirrored to Firebase.
- The scraper repository includes `precompute_indicators.js`, executed after the daily DSE history update.
- Run `stock_metadata_migration.sql` once in Supabase SQL Editor before enabling the new indicator cache.

## v12 — Global Chart Zoom & Pan
- Enabled Chart.js zoom/pan globally across the main app charts.
- Mobile pinch-to-zoom and touch pan enabled.
- Desktop mouse-wheel zoom and pan enabled.
- Advanced Charts already using chartjs-plugin-zoom now also receive the global interaction defaults for charts without local zoom settings.
- Added `chart-zoom.js` as the single shared chart interaction layer.


## v18 QA fixes — 2026-10-04
- Fixed asynchronous CacheManager reads in both Advanced Charts implementations and current/previous price lookup.
- Removed a missing `firebase-app-placeholder.js` reference from the admin page.
- Removed duplicate dashboard income element IDs and synchronized the Portfolio Analysis income card.
- Added Advanced Charts mobile interaction scripts to the service-worker static cache and bumped cache namespace to v6.2.2.
- Reworded Portfolio Analysis data-source text to reflect Supabase primary market data.
- Full JavaScript syntax audit: 44/44 JS files pass `node --check`.
