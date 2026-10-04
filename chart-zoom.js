/* StockPulse global Chart.js zoom/pan support — Acode/Android WebView safe. */
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

    const merge = (a, b) => {
        const out = { ...(a || {}) };
        Object.keys(b || {}).forEach(k => {
            const v = b[k];
            out[k] = (v && typeof v === 'object' && !Array.isArray(v))
                ? merge(out[k] && typeof out[k] === 'object' ? out[k] : {}, v)
                : v;
        });
        return out;
    };

    function applyCanvasTouchSupport(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('canvas').forEach(canvas => {
            canvas.style.setProperty('touch-action', 'none', 'important');
            canvas.style.setProperty('user-select', 'none', 'important');
            canvas.style.setProperty('-webkit-user-select', 'none', 'important');
            canvas.style.setProperty('-webkit-touch-callout', 'none', 'important');
            canvas.style.setProperty('overscroll-behavior', 'contain', 'important');
            canvas.setAttribute('data-stockpulse-chart-touch', '1');
        });
    }

    function install() {
        const OriginalChart = window.Chart;
        if (!OriginalChart || typeof window.ChartZoom === 'undefined') return false;
        if (window.__StockPulseChartZoomInstalled) {
            applyCanvasTouchSupport(document);
            return true;
        }

        try { OriginalChart.register(window.ChartZoom); } catch (_) {}

        // Keep plugin defaults complete. Never assume nested objects already exist.
        try {
            OriginalChart.defaults.plugins = OriginalChart.defaults.plugins || {};
            OriginalChart.defaults.plugins.zoom = merge(
                OriginalChart.defaults.plugins.zoom || {},
                zoomDefaults
            );
        } catch (_) {}

        // Every new chart receives a complete zoom configuration before creation.
        try {
            class StockPulseChart extends OriginalChart {
                constructor(item, config) {
                    config = config || {};
                    config.options = config.options || {};
                    config.options.plugins = config.options.plugins || {};
                    config.options.plugins.zoom = merge(
                        zoomDefaults,
                        config.options.plugins.zoom || {}
                    );
                    super(item, config);
                    try { applyCanvasTouchSupport(document); } catch (_) {}
                }
            }
            Object.setPrototypeOf(StockPulseChart, OriginalChart);
            window.Chart = StockPulseChart;
        } catch (e) {
            console.warn('StockPulse chart zoom wrapper could not install:', e);
            return false;
        }

        window.StockPulseChartZoom = {
            defaults: zoomDefaults,
            reset(chart) {
                if (chart && typeof chart.resetZoom === 'function') chart.resetZoom();
            },
            resetAll() {
                const instances = window.Chart?.instances;
                if (!instances) return;
                Object.values(instances).forEach(c => {
                    if (c && typeof c.resetZoom === 'function') c.resetZoom();
                });
            }
        };

        applyCanvasTouchSupport(document);
        if (window.MutationObserver) {
            const observer = new MutationObserver(mutations => {
                for (const m of mutations) {
                    if (m.addedNodes && m.addedNodes.length) {
                        applyCanvasTouchSupport(document);
                        break;
                    }
                }
            });
            observer.observe(document.documentElement || document, { childList: true, subtree: true });
        }

        window.__StockPulseChartZoomInstalled = true;
        return true;
    }

    if (!install()) {
        let attempts = 0;
        const timer = setInterval(() => {
            if (install() || ++attempts >= 80) clearInterval(timer);
        }, 100);
    }
})();
