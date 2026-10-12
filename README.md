# StockPulse Bangladesh

Portfolio tracker and market analysis app for the Dhaka (DSE) and Chittagong (CSE) stock exchanges.
Static front end (HTML, CSS, vanilla JS) with Firebase Auth and Supabase for data. Installable as a PWA.

## Features
- Portfolio dashboard: total value, investment, daily P/L, total P/L, total income
- Buy / sell tracking with commission, trade history, dividends and record dates
- Market watch, scanner, signals, deep analysis and advanced charts
- Stored-data and live modes with a visible last-update time
- Light and dark themes, offline support through a service worker

## Run locally
Serve the folder with any static server (the service worker needs http://localhost or HTTPS):

    python3 -m http.server 8080

Then open http://localhost:8080.

## Deploy to GitHub Pages
1. Push this folder to a repository, branch `main`.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. `.github/workflows/static.yml` publishes the site on every push to `main`.

## Before going public
- Keep Row Level Security enabled on every Supabase table. See `PRODUCTION_README.md`.
- Never put a service-role key in front-end files. The Firebase web key and the Supabase public key in `config.js` and `firebase-config.js` are meant to be public, but only RLS and Firebase rules protect the data.
- Update the canonical URL in `index.html` and `sitemap.xml` if you use a different domain.

## Docs
Release history is in `RELEASE_NOTES.md` and `docs/history/`.

Market data may be delayed. This app is not investment advice.
