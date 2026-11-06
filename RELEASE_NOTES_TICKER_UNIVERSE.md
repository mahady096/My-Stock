# Ticker universe consistency update

- `core.js` now normalizes the central `dseStocks` array to uppercase, trims whitespace, and removes duplicate codes once before exposing it globally.
- `window.getStockPulseTickerUniverse()` returns a copy of the canonical app list for future modules.
- Existing search/scanner/Market Watch code continues to use `dseStocks` / `window.dseStocks`, so the central list remains the shared source for those features.
- The scraper dividend-history job now builds its candidate universe from the union of `dse_live_data`, `history_dse`, and `stock_metadata`, with pagination and per-source warnings. This avoids relying only on currently live rows.
- Added `npm run audit:tickers` to compare app core tickers against live, historical, closing-price, metadata, CSE, and dividend tables. It is read-only and writes CSV + JSON reports to `ticker-audit-output/`.

## Run coverage audit

Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `APP_CORE_JS` (path to the app `core.js`), then run:

```bash
npm run audit:tickers
```

The audit does not mutate Supabase or automatically add every database ticker to the app. Review `DATABASE_ONLY_NOT_IN_APP` before changing the UI universe because historical/delisted instruments may not belong in current search.

## Automatic ticker discovery update (2026-10-22)

- The app now refreshes the shared ticker list from `dse_live_data.ticker` and `cse_market_data.code` on startup and every six hours while the app remains open.
- Newly discovered symbols are merged into the existing in-memory list; existing symbols are not removed, and duplicates are prevented.
- If Supabase read access is unavailable, the app keeps the bundled ticker list and logs a warning rather than breaking startup.
- Scrapers already parse current official exchange price tables and upsert all valid parsed rows, so newly appearing symbols become discoverable once a successful scraper run writes them to these tables.
- This is a best-effort discovery path, not a guarantee that every newly listed instrument is eligible: database RLS must permit market-data reads, the exchange page must expose the symbol, and symbol/category filtering should be audited for bonds and non-equity instruments.
- Historical price and indicator availability depends on the relevant history/precompute workflows completing; ticker discovery alone does not guarantee historical or dividend records.

## Review fixes (2026-10-23)

- Ticker discovery is now lightweight: for `dse_live_data` and `cse_market_data` the app reads only the rows of each table's latest `date` instead of paging through all history rows on every refresh.
- Government securities (treasury bonds/bills, e.g. codes like `TB5Y1130`, `T10Y0128`, `BGTB...`) are no longer added by discovery. This is a code-pattern heuristic; mutual funds, debentures and other instruments are kept. Review `window.getStockPulseTickerUniverse()` after the first live run.
- Market Watch drops its cached full-view snapshot when new tickers are discovered, so the next load/refresh includes them without resetting the open tab.
- Service worker cache version bumped to `v6.3.6` so installed apps pick up the new `core.js` and `marketwatch.js`.
