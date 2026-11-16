/* StockPulse Ads & Notice Center — compact, swipeable, admin-managed */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let ads = [], current = 0, timer = null, pointerX = null, loaded = false;

  function safeUrl(value) {
    try {
      const u = new URL(value, location.href);
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
    } catch (_) { return ''; }
  }
  function client() {
    return window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null;
  }
  function activeNow(row, now) {
    const start = row.starts_at ? new Date(row.starts_at).getTime() : 0;
    const end = row.ends_at ? new Date(row.ends_at).getTime() : Infinity;
    return row.is_active === true && start <= now && end >= now;
  }
  function renderAd() {
    const slot = $('sp-ad-slot');
    if (!slot || !ads.length) return;
    const ad = ads[current];
    $('sp-ad-title').textContent = ad.title || 'Sponsored';
    $('sp-ad-description').textContent = ad.description || '';
    const url = safeUrl(ad.target_url);
    const image = safeUrl(ad.image_url);
    const link = $('sp-ad-link'), imageLink = $('sp-ad-image-link'), img = $('sp-ad-image');
    link.hidden = !url;
    imageLink.hidden = !(url && image);
    if (url) { link.href = url; imageLink.href = url; }
    if (image) { img.src = image; img.alt = ad.title || 'Sponsored advertisement'; }
    else { img.removeAttribute('src'); }
    $('sp-ad-dots').innerHTML = ads.map((_, i) => `<span class="${i === current ? 'active' : ''}">●</span>`).join('');
    slot.hidden = false;
  }
  function move(step) {
    if (ads.length < 2) return;
    current = (current + step + ads.length) % ads.length;
    renderAd();
    resetTimer();
  }
  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = ads.length > 1 ? setInterval(() => move(1), 7000) : null;
  }
  function renderNotices(notices) {
    const bar = $('sp-notice-bar'), track = $('sp-notice-track');
    if (!bar || !track) return;
    if (!notices.length) { bar.hidden = true; return; }
    const items = notices.map(n => {
      const text = String(n.message || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const url = safeUrl(n.target_url);
      return `<a class="sp-notice-item ${n.priority === 'urgent' ? 'sp-urgent' : ''}" ${url ? `href="${url}" target="_blank" rel="noopener noreferrer"` : 'href="#" onclick="return false"'}>${text}</a>`;
    }).join('');
    track.innerHTML = items + items;
    bar.hidden = false;
    track.style.animationDuration = Math.max(14, Math.min(38, notices.reduce((n,x)=>n+(String(x.message||'').length),0)/5)) + 's';
  }
  async function load() {
    const db = client();
    const center = $('sp-promo-center');
    if (!db || !center) return;
    try {
      const now = new Date().toISOString();
      const [adRes, noticeRes] = await Promise.all([
        db.from('app_ads').select('id,title,description,image_url,target_url,display_order,is_active,starts_at,ends_at').eq('is_active', true).lte('starts_at', now).or(`ends_at.is.null,ends_at.gte.${now}`).order('display_order', {ascending:true}),
        db.from('app_notices').select('id,message,target_url,priority,display_order,is_active,starts_at,ends_at').eq('is_active', true).lte('starts_at', now).or(`ends_at.is.null,ends_at.gte.${now}`).order('display_order', {ascending:true})
      ]);
      if (adRes.error) throw adRes.error;
      if (noticeRes.error) throw noticeRes.error;
      ads = (adRes.data || []).filter(x => activeNow(x, Date.now()));
      current = Math.min(current, Math.max(0, ads.length - 1));
      if (ads.length) { renderAd(); resetTimer(); }
      else { $('sp-ad-slot').hidden = true; if (timer) clearInterval(timer); timer = null; }
      renderNotices((noticeRes.data || []).filter(x => activeNow(x, Date.now())));
      center.hidden = !ads.length && !(noticeRes.data || []).some(x => activeNow(x, Date.now()));
    } catch (e) {
      console.warn('[StockPulse Ads] Could not load ads/notices. Check Supabase migration and RLS:', e.message || e);
      center.hidden = true;
    }
  }
  function bind() {
    $('sp-ad-prev')?.addEventListener('click', () => move(-1));
    $('sp-ad-next')?.addEventListener('click', () => move(1));
    const slot = $('sp-ad-slot');
    if (slot) {
      slot.addEventListener('pointerdown', e => { pointerX = e.clientX; });
      slot.addEventListener('pointerup', e => {
        if (pointerX === null) return;
        const dx = e.clientX - pointerX; pointerX = null;
        if (Math.abs(dx) > 35) move(dx < 0 ? 1 : -1);
      });
      slot.addEventListener('pointercancel', () => { pointerX = null; });
      slot.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
      slot.addEventListener('mouseleave', resetTimer);
    }
  }
  function start() {
    if (loaded) return;
    loaded = true; bind(); load();
    window.addEventListener('stockpulse:auth-ready', load);
    window.addEventListener('online', load);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
