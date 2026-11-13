(function () {
  'use strict';
  let token = null, users = [], activityByUid = {};
  const fn = () => `${window.APP_CONFIG.API.SUPABASE_URL}/functions/v1/admin-subscriptions`;

  async function exchange() {
    const u = window.auth && window.auth.currentUser;
    if (!u) throw new Error('Login required');
    const id = await u.getIdToken(true);
    const r = await fetch(window.APP_CONFIG.API.SUPABASE_AUTH_HOOK_URL, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({firebase_token:id})
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.token) throw new Error(d.error || 'Token exchange failed');
    token = d.token;
  }
  async function call(method='GET', body) {
    const r = await fetch(fn(), {method, headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined});
    const raw = await r.text(); let d = {};
    try { d = raw ? JSON.parse(raw) : {}; } catch (_) { d = {error:raw || `HTTP ${r.status}`}; }
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }
  function firestore() {
    try { if (typeof db !== 'undefined' && db) return db; } catch (_) {}
    return window.db || null;
  }
  async function loadActivity() {
    const store = firestore();
    if (!store) { activityByUid = {}; return false; }
    try {
      const snap = await store.collection('user_activity').get(), next = {};
      snap.forEach(doc => { const x = doc.data() || {}; next[x.uid || doc.id] = x; });
      activityByUid = next; return true;
    } catch (e) { console.warn('Activity read failed:', e); activityByUid = {}; return false; }
  }
  function asDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d;
  }
  function activity(uid) {
    const d = activityByUid[uid] && asDate(activityByUid[uid].last_seen);
    if (!d) return {status:'Never active', cls:'activity-never', last:'—'};
    const now = new Date(), age = Date.now() - d.getTime();
    const today = d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
    const online = age >= 0 && age <= 120000;
    return {
      status: online ? 'Online' : today ? 'Active Today' : 'Offline',
      cls: online ? 'activity-online' : today ? 'activity-today' : 'activity-offline',
      last: d.toLocaleString('en-GB', {dateStyle:'medium',timeStyle:'short'})
    };
  }
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function render() {
    const q=(document.getElementById('search').value||'').toLowerCase(), f=document.getElementById('filter').value;
    const now=Date.now(), week=now+7*864e5;
    const rows=users.filter(x=>(!q||`${x.email||''} ${x.uid||''}`.toLowerCase().includes(q))&&(f==='all'||x.plan===f||(f==='expired'&&x.expired)));
    document.getElementById('m-total').textContent=users.length;
    document.getElementById('m-pro').textContent=users.filter(x=>x.plan==='pro'&&!x.expired).length;
    document.getElementById('m-free').textContent=users.filter(x=>x.plan!=='pro'||x.expired).length;
    document.getElementById('m-exp').textContent=users.filter(x=>x.plan==='pro'&&x.expiresAt&&new Date(x.expiresAt).getTime()<=week&&new Date(x.expiresAt).getTime()>now).length;
    document.getElementById('users-body').innerHTML=rows.map(x=>{
      const a=activity(x.uid), pro=x.plan==='pro'&&!x.expired;
      const action=pro
        ? `<button class="btn btn-pro" onclick="grant('${esc(x.uid)}',30)">+30 days</button> <button class="btn btn-danger" onclick="revoke('${esc(x.uid)}')">Revoke</button>`
        : `<button class="btn btn-pro" onclick="grant('${esc(x.uid)}',30)">Grant 30 days</button>`;
      return `<tr><td>${esc(x.email||'—')}</td><td title="${esc(x.uid)}">${esc((x.uid||'').slice(0,14))}…</td><td class="${pro?'plan-pro':'plan-free'}">${pro?'👑 PRO':'🆓 FREE'}</td><td>${x.expiresAt?esc(new Date(x.expiresAt).toLocaleDateString('en-GB')):'—'}</td><td><span class="${a.cls}">${a.status}</span></td><td>${esc(a.last)}</td><td>${action}</td></tr>`;
    }).join('') || '<tr><td colspan="7">No users found.</td></tr>';
  }
  window.loadUsers=async function(){
    const label=document.getElementById('activity-refresh-status'); if(label) label.textContent='Refreshing…';
    try {
      const d=await call('GET'); users=d.users||[];
      const ok=await loadActivity(); render();
      if(label) label.textContent=ok?'Activity updated: '+new Date().toLocaleTimeString():'User list loaded; Activity read failed. Check Firestore Rules.';
    } catch(e) { if(label) label.textContent='Refresh failed'; alert(e.message); }
  };
  window.grant=async(uid,days)=>{if(!confirm(`Grant/extend Pro for ${days} days?`))return;try{await call('POST',{action:'grant',uid,days});await loadUsers();}catch(e){alert(e.message);}};
  window.revoke=async(uid)=>{if(!confirm('Revoke Pro access?'))return;try{await call('POST',{action:'revoke',uid});await loadUsers();}catch(e){alert(e.message);}};
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('search').addEventListener('input',render);
    document.getElementById('filter').addEventListener('change',render);
    if(window.auth) window.auth.onAuthStateChanged(async u=>{
      try {
        if(!u){document.getElementById('login-msg').textContent='Please login to continue.';return;}
        await exchange(); const d=await call('GET'); users=d.users||[]; await loadActivity();
        document.getElementById('login').classList.add('hidden');
        document.getElementById('admin').classList.remove('hidden');
        document.getElementById('admin-email').textContent=u.email||u.uid;
        render();
        const label=document.getElementById('activity-refresh-status'); if(label) label.textContent='Activity loaded';
      } catch(e) { document.getElementById('login-msg').textContent='⛔ '+e.message; }
    });
  });
})();
