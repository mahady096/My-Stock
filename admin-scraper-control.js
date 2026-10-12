/* StockPulse: restrict the dashboard scraper control to the configured admin account. */
(function () {
  'use strict';
  // Matches the admin contact already used by the app's Pro/admin UI.
  const ADMIN_EMAILS = ['admin.stockpulse@gmail.com', 'mahady096@gmail.com'];
  function isAdmin(user) {
    const email = user && typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    return !!email && ADMIN_EMAILS.includes(email);
  }
  function apply(user) {
    const button = document.getElementById('btn-trigger-scraper');
    if (!button) return;
    const allowed = isAdmin(user);
    button.hidden = !allowed;
    button.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    button.title = allowed ? 'Run market data scraper' : 'Admin only';
  }
  window.StockPulseAdmin = { isAdmin };
  function start() {
    // Hide by default before checking auth; only the configured admin is shown it.
    apply(null);
    if (typeof auth !== 'undefined' && auth && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(apply);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
