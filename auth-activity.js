/* StockPulse: Forgot Password + Firestore Activity. Load after ui-helpers.js. */
(function () {
  'use strict';
  function getAuth() {
    try { if (typeof auth !== 'undefined' && auth) return auth; } catch (_) {}
    return window.auth || null;
  }
  function getDb() {
    try { if (typeof db !== 'undefined' && db) return db; } catch (_) {}
    return window.db || null;
  }
  function message(s, bad) {
    var el = document.getElementById('auth-error');
    if (el) { el.textContent = s; el.style.color = bad ? '#dc2626' : '#059669'; }
  }
  function addForgotPassword() {
    var form = document.getElementById('auth-form');
    var emailInput = document.getElementById('login-email');
    if (!form || !emailInput || document.getElementById('btn-forgot-password')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'btn-forgot-password'; b.textContent = 'Forgot Password?';
    b.style.cssText = 'display:block;margin:10px auto 0;background:transparent;border:0;color:#2563eb;text-decoration:underline;cursor:pointer;font-size:14px;padding:6px;';
    form.insertAdjacentElement('afterend', b);
    b.addEventListener('click', async function () {
      var email = (emailInput.value || '').trim(), a = getAuth();
      if (!email) { message('পাসওয়ার্ড রিসেট করতে প্রথমে আপনার ইমেইল লিখুন।', true); emailInput.focus(); return; }
      if (!a || typeof a.sendPasswordResetEmail !== 'function') { message('Firebase Authentication পাওয়া যাচ্ছে না।', true); return; }
      b.disabled = true; b.textContent = 'Sending...';
      try {
        await a.sendPasswordResetEmail(email);
        message('পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে। Inbox/Spam চেক করুন।', false);
      } catch (e) {
        var m = 'রিসেট ইমেইল পাঠানো যায়নি।';
        if (e.code === 'auth/user-not-found') m = 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।';
        else if (e.code === 'auth/invalid-email') m = 'সঠিক ইমেইল ঠিকানা লিখুন।';
        else if (e.code === 'auth/too-many-requests') m = 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
        else if (e.message) m += ' ' + e.message;
        message(m, true);
      } finally { b.disabled = false; b.textContent = 'Forgot Password?'; }
    });
  }

  var timer = null, activeUid = null, busy = false;
  async function heartbeat(user) {
    if (!user || busy) return;
    var firestore = getDb(), f = window.firebase;
    if (!firestore || !f || !f.firestore || !f.firestore.FieldValue) return;
    busy = true;
    try {
      await firestore.collection('user_activity').doc(user.uid).set({
        uid: user.uid,
        email: user.email || '',
        last_seen: f.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('[StockPulse Activity] Heartbeat failed:', e);
    } finally { busy = false; }
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null; activeUid = null;
  }
  function start(user) {
    if (!user || activeUid === user.uid) return;
    stop(); activeUid = user.uid;
    heartbeat(user);
    timer = setInterval(function () {
      if (document.visibilityState === 'visible') heartbeat(user);
    }, 60000);
  }
  function init() {
    addForgotPassword();
    var a = getAuth();
    if (!a || typeof a.onAuthStateChanged !== 'function') { setTimeout(init, 1200); return; }
    a.onAuthStateChanged(function (u) { if (u) start(u); else stop(); });
    document.addEventListener('visibilitychange', function () {
      var current = getAuth(), u = current && current.currentUser;
      if (document.visibilityState === 'visible' && u) heartbeat(u);
    });
    window.addEventListener('beforeunload', stop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
