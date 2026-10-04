# StockPulse — Final Dashboard Fixes v8

## Included changes

- Replaced the Combined Scanner placeholder panels with real Strong Buy, Strong Sell, and Analysis tables and ticker search controls.
- Added a new scanner cache version so older cached scanner results are not reused.
- Changed Daily P&L to measure price movement on shares held at the previous close, rather than treating purchases or sales as daily profit/loss.
- Made the Daily P&L dashboard card read the same timeline metric as the Daily P&L chart.
- Made the first four dashboard cards clickable; each opens a chart for the last 30 calendar days of available trading data.
- Added a versioned timeline cache and local-date handling to reduce stale or off-by-one date behavior.

## Data behavior

- Market and historical price data remain Supabase-first.
- Portfolio holdings and sales history are read from Supabase for the timeline.
- The Daily P&L series is a mark-to-market estimate based on the previous close holdings and daily price changes. It does not include dividends or separately calculate intraday realized profit from trades.

## Validation performed

- All top-level JavaScript files passed `node --check`.
- `index.html` passed an HTML parser check.
- Required Combined Scanner and dashboard card element IDs were checked.
- ZIP integrity is checked after packaging.

A live authenticated Supabase/browser test is still required before public release; static checks cannot verify live row permissions, data freshness, or account-specific portfolio results.
