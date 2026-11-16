/* StockPulse Ads & Notice Admin — uses Firebase-to-Supabase custom JWT */
(function () {
  'use strict';
  const ADMIN_EMAILS = ['admin.stockpulse@gmail.com','mahady0069@gmail.com','mahady096@gmail.com'];
  const $ = id => document.getElementById(id);
  let ads = [], notices = [], ready = false;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db = () => window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null;
  function status(message, error=false) {
    const el=$('ads-admin-status'); if(el){el.textContent=message;el.style.color=error?'#dc2626':'var(--text-muted)';}
  }
  function localInput(iso) {
    if(!iso) return '';
    const d=new Date(iso); if(Number.isNaN(d.getTime()))return '';
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function isoValue(id, fallbackNow=false) {
    const v=$(id).value;
    if(!v) return fallbackNow ? new Date().toISOString() : null;
    const d=new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  async function ensureAuth() {
    const user=window.auth && window.auth.currentUser;
    if(!user) throw new Error('Please sign in with an administrator account.');
    if(!ADMIN_EMAILS.includes(String(user.email||'').toLowerCase())) throw new Error('This account is not approved to manage ads and notices.');
    const id=await user.getIdToken(true);
    const cfg=window.APP_CONFIG;
    const res=await fetch(cfg.API.SUPABASE_AUTH_HOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({firebase_token:id})});
    const payload=await res.json().catch(()=>({}));
    if(!res.ok||!payload.token) throw new Error(payload.error||'Could not authorize Supabase access.');
    if(typeof window.setSupabaseAuthToken!=='function') throw new Error('Supabase client is not ready.');
    window.setSupabaseAuthToken(payload.token);
    if(!db()) throw new Error('Supabase client is not initialized.');
  }
  async function loadLists() {
    const client=db(); if(!client) throw new Error('Supabase client unavailable.');
    const [a,n]=await Promise.all([
      client.from('app_ads').select('*').order('display_order',{ascending:true}).order('created_at',{ascending:false}),
      client.from('app_notices').select('*').order('display_order',{ascending:true}).order('created_at',{ascending:false})
    ]);
    if(a.error) throw a.error; if(n.error) throw n.error;
    ads=a.data||[]; notices=n.data||[]; renderLists();
  }
  function renderLists() {
    $('ads-admin-list').innerHTML=ads.map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.starts_at?new Date(x.starts_at).toLocaleDateString():'—')} – ${esc(x.ends_at?new Date(x.ends_at).toLocaleDateString():'No end')}</td><td>${x.is_active?'Active':'Inactive'}</td><td><div class="ads-admin-actions"><button class="btn btn-muted" data-kind="ad" data-action="edit" data-id="${esc(x.id)}">Edit</button><button class="btn btn-muted" data-kind="ad" data-action="toggle" data-id="${esc(x.id)}">${x.is_active?'Pause':'Activate'}</button><button class="btn btn-danger" data-kind="ad" data-action="delete" data-id="${esc(x.id)}">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="4">No advertisements yet.</td></tr>';
    $('notices-admin-list').innerHTML=notices.map(x=>`<tr><td>${esc(x.message)}</td><td>${esc(x.priority)}</td><td>${x.is_active?'Active':'Inactive'}</td><td><div class="ads-admin-actions"><button class="btn btn-muted" data-kind="notice" data-action="edit" data-id="${esc(x.id)}">Edit</button><button class="btn btn-muted" data-kind="notice" data-action="toggle" data-id="${esc(x.id)}">${x.is_active?'Pause':'Activate'}</button><button class="btn btn-danger" data-kind="notice" data-action="delete" data-id="${esc(x.id)}">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="4">No notices yet.</td></tr>';
  }
  function resetAd() {
    $('ad-form').reset(); $('ad-id').value=''; $('ad-order').value=100; $('ad-active').checked=true; $('ad-form-heading').textContent='Add Advertisement';
  }
  function resetNotice() {
    $('notice-form').reset(); $('notice-id').value=''; $('notice-order').value=100; $('notice-active').checked=true; $('notice-priority').value='normal'; $('notice-form-heading').textContent='Add Scrolling Notice';
  }
  function edit(kind,id) {
    if(kind==='ad'){
      const x=ads.find(a=>a.id===id); if(!x)return;
      $('ad-id').value=x.id;$('ad-title').value=x.title||'';$('ad-description').value=x.description||'';$('ad-url').value=x.target_url||'';
      $('ad-order').value=x.display_order??100;$('ad-start').value=localInput(x.starts_at);$('ad-end').value=localInput(x.ends_at);$('ad-active').checked=!!x.is_active;$('ad-form-heading').textContent='Edit Advertisement';
      $('ad-form').scrollIntoView({behavior:'smooth',block:'center'});
    } else {
      const x=notices.find(a=>a.id===id); if(!x)return;
      $('notice-id').value=x.id;$('notice-message').value=x.message||'';$('notice-url').value=x.target_url||'';$('notice-priority').value=x.priority||'normal';
      $('notice-order').value=x.display_order??100;$('notice-start').value=localInput(x.starts_at);$('notice-end').value=localInput(x.ends_at);$('notice-active').checked=!!x.is_active;$('notice-form-heading').textContent='Edit Scrolling Notice';
      $('notice-form').scrollIntoView({behavior:'smooth',block:'center'});
    }
  }
  async function uploadImage(file) {
    if(!file) return null;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use a PNG, JPG or WebP image.');
    if(file.size>3*1024*1024) throw new Error('Image must be 3 MB or smaller.');
    const ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1];
    const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {data,error}=await db().storage.from('stockpulse-ads').upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw error;
    return db().storage.from('stockpulse-ads').getPublicUrl(data.path).data.publicUrl;
  }
  async function saveAd(e) {
    e.preventDefault(); status('Saving advertisement…');
    try{
      const id=$('ad-id').value, file=$('ad-image').files[0];
      let image_url=null;
      if(file) image_url=await uploadImage(file);
      else if(id) image_url=ads.find(x=>x.id===id)?.image_url||null;
      const payload={title:$('ad-title').value.trim(),description:$('ad-description').value.trim(),target_url:$('ad-url').value.trim()||null,image_url,
        display_order:Number($('ad-order').value)||100,is_active:$('ad-active').checked,starts_at:isoValue('ad-start',true),ends_at:isoValue('ad-end'),updated_at:new Date().toISOString(),created_by:window.auth.currentUser.email};
      if(payload.ends_at && new Date(payload.ends_at)<=new Date(payload.starts_at)) throw new Error('End date must be after start date.');
      const q=id?db().from('app_ads').update(payload).eq('id',id):db().from('app_ads').insert(payload);
      const {error}=await q; if(error)throw error;
      resetAd(); await loadLists(); status('Advertisement saved successfully.');
    }catch(err){status(err.message||'Could not save advertisement.',true);}
  }
  async function saveNotice(e) {
    e.preventDefault(); status('Saving notice…');
    try{
      const id=$('notice-id').value;
      const payload={message:$('notice-message').value.trim(),target_url:$('notice-url').value.trim()||null,priority:$('notice-priority').value,
        display_order:Number($('notice-order').value)||100,is_active:$('notice-active').checked,starts_at:isoValue('notice-start',true),ends_at:isoValue('notice-end'),updated_at:new Date().toISOString(),created_by:window.auth.currentUser.email};
      if(payload.ends_at && new Date(payload.ends_at)<=new Date(payload.starts_at)) throw new Error('End date must be after start date.');
      const q=id?db().from('app_notices').update(payload).eq('id',id):db().from('app_notices').insert(payload);
      const {error}=await q; if(error)throw error;
      resetNotice(); await loadLists(); status('Notice saved successfully.');
    }catch(err){status(err.message||'Could not save notice.',true);}
  }
  async function listAction(e) {
    const b=e.target.closest('button[data-action]'); if(!b)return;
    const {kind,action,id}=b.dataset, table=kind==='ad'?'app_ads':'app_notices', rows=kind==='ad'?ads:notices, row=rows.find(x=>x.id===id);
    if(!row)return;
    if(action==='edit'){edit(kind,id);return;}
    if(action==='delete'&&!confirm('Permanently delete this item?'))return;
    status(action==='delete'?'Deleting…':'Updating…');
    try{
      let result;
      if(action==='delete') result=await db().from(table).delete().eq('id',id);
      else result=await db().from(table).update({is_active:!row.is_active,updated_at:new Date().toISOString()}).eq('id',id);
      if(result.error)throw result.error;
      await loadLists();status('Changes saved.');
    }catch(err){status(err.message||'Action failed.',true);}
  }
  function init() {
    if(ready)return; ready=true;
    $('ad-form').addEventListener('submit',saveAd);$('notice-form').addEventListener('submit',saveNotice);
    $('ad-reset').addEventListener('click',resetAd);$('notice-reset').addEventListener('click',resetNotice);
    $('ads-admin-list').addEventListener('click',listAction);$('notices-admin-list').addEventListener('click',listAction);
    if(window.auth && typeof window.auth.onAuthStateChanged==='function'){
      window.auth.onAuthStateChanged(async user=>{
        if(!user)return;
        try{await ensureAuth();await loadLists();status('Ads & Notice Management ready.');}
        catch(e){status(e.message||'Admin access unavailable.',true);}
      });
    } else status('Firebase Authentication unavailable.',true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
