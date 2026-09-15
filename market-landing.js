/* StockPulse Public Market Landing Page */
(function () {
  'use strict';

  const fmt = (value, digits = 2) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  const fmtInt = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return Math.round(n).toLocaleString('en-US');
  };

  const signed = (value, digits = 2) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return `${n >= 0 ? '+' : ''}${fmt(n, digits)}`;
  };

  const getDateDhaka = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  function commentary(change, percent, condition) {
    const c = String(condition || '').toUpperCase();
    if (c === 'BULLISH' || Number(percent) > 0.5) {
      return `The market closed on a positive note. DSEX gained ${fmt(Math.abs(change), 2)} points (${fmt(Math.abs(percent), 2)}%), indicating broad positive momentum today.`;
    }
    if (c === 'BEARISH' || Number(percent) < -0.5) {
      return `The market closed lower today. DSEX fell ${fmt(Math.abs(change), 2)} points (${fmt(Math.abs(percent), 2)}%), reflecting negative market momentum.`;
    }
    return `The market was relatively stable today, with DSEX changing ${signed(change)} points (${signed(percent)}%).`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function loadMarketSummary() {
    const supabaseClient = window.supabase;
    if (!supabaseClient || typeof supabaseClient.from !== 'function') {
      setText('landing-data-status', 'Market data service is loading...');
      setTimeout(loadMarketSummary, 700);
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from('market_summary')
        .select('*')
        .order('market_date', { ascending: false })
        .limit(1);

      if (error) throw error;
      const row = data && data[0];
      if (!row) throw new Error('No market summary found');

      const change = Number(row.change);
      const pct = Number(row.change_percent);
      const positive = change >= 0;
      const condition = String(row.market_status || (positive ? 'BULLISH' : 'BEARISH')).toUpperCase();

      setText('landing-dsex', fmt(row.dsex, 2));
      setText('landing-change', `${signed(change, 2)} pts`);
      setText('landing-percent', `${signed(pct, 2)}%`);
      setText('landing-prev-close', fmt(row.previous_close, 2));
      setText('landing-trades', fmtInt(row.total_trades));
      setText('landing-volume', fmtInt(row.total_volume));
      setText('landing-value', fmt(row.total_value, 2));
      setText('landing-advanced', fmtInt(row.advanced));
      setText('landing-declined', fmtInt(row.declined));
      setText('landing-unchanged', fmtInt(row.unchanged));
      setText('landing-market-date', row.market_date || getDateDhaka());
      setText('landing-updated', row.scraped_at ? new Date(row.scraped_at).toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' }) : 'Recently');
      const updatedLabel = row.scraped_at ? new Date(row.scraped_at).toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' }) : 'Recently';
      setText('landing-updated-head', updatedLabel);
      const marketPill = document.getElementById('landing-market-status-pill');
      if (marketPill) {
        const statusText = String(row.market_status || 'CLOSED').toUpperCase();
        const isOpen = statusText.includes('OPEN');
        marketPill.textContent = `${isOpen ? '● MARKET OPEN' : '● MARKET CLOSED'}`;
        marketPill.classList.toggle('is-open', isOpen);
      }
      setText('landing-condition', condition);
      setText('landing-condition-2', condition);
      setText('landing-commentary', commentary(change, pct, condition));
      const interpretation = document.getElementById('landing-chart-interpretation');
      if (interpretation) {
        interpretation.textContent = Number(pct) > 0.5
          ? `📈 DSEX is currently above its previous close, indicating positive short-term market momentum (+${fmt(Math.abs(pct), 2)}%).`
          : Number(pct) < -0.5
            ? `📉 DSEX is currently below its previous close, reflecting negative short-term market momentum (${signed(pct, 5)}%).`
            : `↔️ DSEX is moving relatively close to its previous close, indicating a more stable short-term market.`;
      }

      const badge = document.getElementById('landing-condition-badge');
      if (badge) {
        badge.classList.remove('is-positive', 'is-negative', 'is-flat');
        badge.classList.add(change > 0 ? 'is-positive' : change < 0 ? 'is-negative' : 'is-flat');
      }

      const conditionCard = document.querySelector('.public-condition-card');
      if (conditionCard) {
        conditionCard.classList.remove('condition-bullish', 'condition-bearish', 'condition-flat');
        conditionCard.classList.add(
          condition === 'BULLISH' ? 'condition-bullish' :
          condition === 'BEARISH' ? 'condition-bearish' : 'condition-flat'
        );
      }

      const changeBox = document.getElementById('landing-dsex-change');
      if (changeBox) {
        changeBox.classList.remove('is-positive', 'is-negative');
        changeBox.classList.add(positive ? 'is-positive' : 'is-negative');
      }

      setText('landing-data-status', 'Live market data from StockPulse database');
    } catch (err) {
      console.warn('Public market summary load failed:', err);
      setText('landing-data-status', 'Market data is temporarily unavailable. Please refresh shortly.');
    }
  }

  async function loadDsexChart() {
    const canvas = document.getElementById('landing-dsex-chart');
    const client = window.supabase;
    if (!canvas || !client) return;

    try {
      const { data, error } = await client
        .from('dsex_index')
        .select('value, date, updated_at')
        .eq('index_name', 'DSEX')
        .order('date', { ascending: false })
        .limit(30);

      if (error) throw error;
      const rows = (data || []).reverse();
      if (!rows.length || typeof Chart === 'undefined') return;

      const labels = rows.map(r => {
        const raw = r.date || r.updated_at;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? String(raw || '') : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      const values = rows.map(r => Number(r.value)).filter(Number.isFinite);
      if (!values.length) return;

      if (window.__stockpulseLandingChart) window.__stockpulseLandingChart.destroy();
      window.__stockpulseLandingChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'DSEX',
            data: rows.map(r => Number(r.value)),
            borderWidth: 2.5,
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: 'rgba(99,102,241,0.10)',
            borderColor: '#6366f1',
            pointBackgroundColor: '#6366f1'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` DSEX: ${fmt(ctx.parsed.y, 2)}` } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
            y: { grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { callback: value => Number(value).toLocaleString() } }
          }
        }
      });
    } catch (err) {
      console.warn('Public DSEX chart load failed:', err);
    }
  }

  function showLogin() {
    // If an authenticated user clicks Login/Enter App from the landing page,
    // take them straight back into the app instead of showing the login form.
    if (typeof auth !== 'undefined' && auth && auth.currentUser) {
      showApp();
      return;
    }

    // Public login view: landing is hidden, app remains hidden until auth succeeds.
    document.body.classList.remove('public-landing-active');
    document.body.classList.add('public-login-active');
    const landing = document.getElementById('public-market-landing');
    const app = document.getElementById('app-container');
    const login = document.getElementById('login-container');
    if (landing) landing.style.display = 'none';
    if (app) app.classList.add('hidden');
    if (login) {
      login.classList.remove('hidden');
      login.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const email = document.getElementById('login-email');
    if (email) setTimeout(() => email.focus(), 350);
  }

  function showLanding() {
    // Public view. The landing page is the ONLY visible screen.
    document.body.classList.add('public-landing-active');
    document.body.classList.remove('public-login-active');
    const landing = document.getElementById('public-market-landing');
    const app = document.getElementById('app-container');
    const login = document.getElementById('login-container');
    if (landing) landing.style.display = 'block';
    if (app) app.classList.add('hidden');
    if (login) login.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showApp() {
    // Authenticated view: ONLY the main app is visible.
    document.body.classList.remove('public-landing-active', 'public-login-active');
    const landing = document.getElementById('public-market-landing');
    const login = document.getElementById('login-container');
    const app = document.getElementById('app-container');
    if (landing) { landing.style.display = 'none'; landing.setAttribute('aria-hidden', 'true'); }
    if (login) login.classList.add('hidden');
    if (app) { app.classList.remove('hidden'); app.setAttribute('aria-hidden', 'false'); }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function bindAuthView() {
    if (typeof auth === 'undefined' || !auth || typeof auth.onAuthStateChanged !== 'function') return;

    auth.onAuthStateChanged((user) => {
      if (user) {
        showApp();
      } else {
        showLanding();
      }
    });
  }

  function init() {
    bindAuthView();

    // If Firebase already knows the user, skip the public screens immediately.
    if (typeof auth !== 'undefined' && auth && auth.currentUser) {
      showApp();
    } else if (new URLSearchParams(window.location.search).get('login') === '1') {
      showLogin();
    } else {
      showLanding();
    }

    document.querySelectorAll('[data-open-login]').forEach(btn => btn.addEventListener('click', showLogin));
    document.querySelectorAll('[data-back-market]').forEach(btn => btn.addEventListener('click', showLanding));
    loadMarketSummary();
    loadDsexChart();
    setInterval(loadMarketSummary, 120000);
    setInterval(loadDsexChart, 300000);
  }

  window.StockPulseLanding = { showLogin, showLanding, refresh: loadMarketSummary };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
