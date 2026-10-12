// premium-charts.js — one shared look for every Chart.js chart in the app.
// Sets defaults only (font, tooltip, grid, line smoothing); it does not touch chart data or options set per chart.
(function () {
    'use strict';
    if (typeof Chart === 'undefined') return;

    function palette() {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            dark,
            text: dark ? '#94a3b8' : '#64748b',
            grid: dark ? 'rgba(148,163,184,.12)' : 'rgba(100,116,139,.14)',
            tipBg: dark ? 'rgba(2,6,23,.94)' : 'rgba(15,23,42,.94)'
        };
    }

    function apply() {
        const p = palette();
        const d = Chart.defaults;
        d.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Bengali', sans-serif";
        d.font.size = 11;
        d.color = p.text;
        d.borderColor = p.grid;
        d.elements.line.tension = 0.28;
        d.elements.line.borderWidth = 2.25;
        d.elements.line.borderCapStyle = 'round';
        d.elements.line.borderJoinStyle = 'round';
        d.elements.point.hoverRadius = 5;
        d.elements.point.hitRadius = 14;
        d.elements.bar.borderRadius = 6;
        d.elements.bar.borderSkipped = false;
        d.interaction.mode = 'index';
        d.interaction.intersect = false;
        const t = d.plugins.tooltip;
        t.backgroundColor = p.tipBg;
        t.titleColor = '#cbd5e1';
        t.bodyColor = '#ffffff';
        t.padding = 10;
        t.cornerRadius = 10;
        t.boxPadding = 4;
        t.usePointStyle = true;
        t.borderColor = 'rgba(255,255,255,.08)';
        t.borderWidth = 1;
        d.plugins.legend.labels.usePointStyle = true;
        d.plugins.legend.labels.boxWidth = 8;
        d.plugins.legend.labels.boxHeight = 8;
        d.plugins.legend.labels.padding = 14;
    }

    apply();

    // keep axes/grid readable when the theme is toggled
    new MutationObserver(function () {
        apply();
        const p = palette();
        const all = Chart.instances ? Object.values(Chart.instances) : [];
        all.forEach(function (c) {
            try {
                const sc = c.options && c.options.scales;
                if (sc) Object.keys(sc).forEach(function (k) {
                    if (sc[k].ticks && !sc[k].ticks._lock) sc[k].ticks.color = p.text;
                    if (sc[k].grid && sc[k].grid.color && typeof sc[k].grid.color === 'string') sc[k].grid.color = p.grid;
                });
                c.update('none');
            } catch (e) { /* chart may be destroyed */ }
        });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
