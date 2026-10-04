/* StockPulse Chart.js zoom/pan support — Android/Acode safe. */
(function () {
  'use strict';
  const zoomDefaults = {
    pan: { enabled: true, mode: 'x', threshold: 4 },
    zoom: {
      wheel: { enabled: true, speed: 0.08 },
      pinch: { enabled: true },
      mode: 'x'
    }
  };
  function applyCanvasTouchSupport(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('canvas').forEach(canvas => {
      canvas.style.setProperty('touch-action', 'none', 'important');
      canvas.style.setProperty('user-select', 'none', 'important');
      canvas.style.setProperty('-webkit-user-select', 'none', 'important');
      canvas.style.setProperty('-webkit-touch-callout', 'none', 'important');
      canvas.style.setProperty('overscroll-behavior', 'contain', 'important');
    });
  }
  function install() {
    const ChartCtor = window.Chart;
    const ZoomPlugin = window.ChartZoom;
    if (!ChartCtor || !ZoomPlugin) return false;
    try { ChartCtor.register(ZoomPlugin); } catch (_) {}
    window.StockPulseChartZoom = {
      defaults: zoomDefaults,
      applyCanvasTouchSupport,
      reset(chart) { if (chart && typeof chart.resetZoom === 'function') chart.resetZoom(); },
      resetAll() {
        const instances = ChartCtor.instances;
        if (!instances) return;
        Object.values(instances).forEach(c => { if (c && typeof c.resetZoom === 'function') c.resetZoom(); });
      }
    };
    applyCanvasTouchSupport(document);
    if (window.MutationObserver && !window.__StockPulseZoomObserver) {
      const observer = new MutationObserver(() => applyCanvasTouchSupport(document));
      observer.observe(document.documentElement || document, { childList: true, subtree: true });
      window.__StockPulseZoomObserver = observer;
    }
    window.__StockPulseChartZoomInstalled = true;
    return true;
  }
  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => { if (install() || ++attempts >= 100) clearInterval(timer); }, 100);
  }
})();
