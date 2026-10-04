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
