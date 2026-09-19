/* StockPulse — mobile interaction bridge (v3, pointer-based with isTrusted dedup)
 * Fires a synthetic click on pointerup/touchend if the browser doesn't
 * fire one natively, and blocks the native click afterwards to prevent
 * double-fire. Uses event.isTrusted to distinguish real vs synthetic.
 */
(function () {
  'use strict';

  var lastSynthetic = { target: null, time: 0 };
  var downInfo = null;

  function findInteractive(node) {
    if (!node || node.nodeType !== 1) return null;
    return node.closest(
      'button, a, input, select, textarea, label, [onclick], [role="button"], [role="link"]'
    );
  }

  function isDisabled(el) {
    return !!(el && (el.disabled || el.getAttribute('aria-disabled') === 'true'));
  }

  function shouldBypass(el) {
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function fireSyntheticClick(target) {
    lastSynthetic.target = target;
    lastSynthetic.time = Date.now();
    try { target.click(); } catch (e) {}
  }

  // ── Pointer Events (modern Chrome/Android) ──
  function onPointerDown(e) {
    if (e.pointerType && e.pointerType !== 'touch') return;
    downInfo = { x: e.clientX, y: e.clientY, target: e.target, time: Date.now() };
  }

  function onPointerUp(e) {
    if (e.pointerType && e.pointerType !== 'touch') return;
    if (!downInfo) return;
    var dx = e.clientX - downInfo.x;
    var dy = e.clientY - downInfo.y;
    var moved = Math.sqrt(dx * dx + dy * dy);
    var elapsed = Date.now() - downInfo.time;
    var originTarget = downInfo.target;
    downInfo = null;
    if (moved > 12) return;    // swipe, not tap
    if (elapsed > 800) return; // long press, not tap

    var target = findInteractive(originTarget);
    if (!target || isDisabled(target) || shouldBypass(target)) return;
    fireSyntheticClick(target);
  }

  // ── Touch Events fallback (old WebViews) ──
  function onTouchStart(e) {
    if (!e.touches || !e.touches.length) return;
    var t = e.touches[0];
    downInfo = { x: t.clientX, y: t.clientY, target: e.target, time: Date.now() };
  }

  function onTouchEnd(e) {
    if (!downInfo) return;
    if (!e.changedTouches || !e.changedTouches.length) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - downInfo.x;
    var dy = t.clientY - downInfo.y;
    var moved = Math.sqrt(dx * dx + dy * dy);
    var elapsed = Date.now() - downInfo.time;
    var originTarget = downInfo.target;
    downInfo = null;
    if (moved > 12) return;
    if (elapsed > 800) return;

    var target = findInteractive(originTarget);
    if (!target || isDisabled(target) || shouldBypass(target)) return;
    fireSyntheticClick(target);
  }

  // ── Block the browser's own click after we synthesized one ──
  // Only block TRUSTED clicks (real browser events). Our synthetic clicks
  // have isTrusted === false and must pass through to the button handler.
  function blockNativeClick(e) {
    if (!e.isTrusted) return; // let our own synthetic click pass

    if (lastSynthetic.target && Date.now() - lastSynthetic.time < 700) {
      if (e.target === lastSynthetic.target || lastSynthetic.target.contains(e.target)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        lastSynthetic.target = null;
      }
    }
  }

  if (window.PointerEvent) {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
  } else {
    document.addEventListener('touchstart', onTouchStart, true);
    document.addEventListener('touchend', onTouchEnd, true);
  }
  document.addEventListener('click', blockNativeClick, true);

  // ── touch-action: manipulation ──
  function applyTouchAction() {
    document.querySelectorAll(
      'button, a, input, select, textarea, label, [onclick], [role="button"]'
    ).forEach(function (el) {
      el.style.setProperty('touch-action', 'manipulation', 'important');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTouchAction);
  } else {
    applyTouchAction();
  }
  setTimeout(applyTouchAction, 500);
})();