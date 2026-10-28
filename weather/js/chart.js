/*
 * მარტივი SVG ხაზოვანი გრაფიკი ჯვარედინი კურსორით და tooltip-ით.
 * window.LineChart.render(el, { labels, series: [{name, color, values, bold}], unit })
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PAD = { top: 14, right: 12, bottom: 26, left: 34 };
  var HEIGHT = 230;

  function svg(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }

  function niceTicks(min, max) {
    var step = (max - min) <= 8 ? 2 : (max - min) <= 20 ? 5 : 10;
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    if (lo === hi) { lo -= step; hi += step; }
    var out = [];
    for (var v = lo; v <= hi + 1e-9; v += step) out.push(v);
    return out;
  }

  function render(el, cfg) {
    el.innerHTML = '';
    var width = Math.max(280, el.clientWidth || 600);
    var n = cfg.labels.length;
    var all = [];
    cfg.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    if (!n || !all.length) {
      el.innerHTML = '<p class="hint">მონაცემები ჯერ არ არის.</p>';
      return;
    }
    var ticks = niceTicks(Math.min.apply(null, all), Math.max.apply(null, all));
    var yMin = ticks[0], yMax = ticks[ticks.length - 1];
    var iw = width - PAD.left - PAD.right, ih = HEIGHT - PAD.top - PAD.bottom;
    function x(i) { return PAD.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); }
    function y(v) { return PAD.top + (1 - (v - yMin) / (yMax - yMin)) * ih; }

    var root = svg('svg', { viewBox: '0 0 ' + width + ' ' + HEIGHT, width: width, height: HEIGHT,
      role: 'img', 'aria-label': cfg.title || 'ტემპერატურის გრაფიკი' }, el);

    // ბადე და ღერძები
    var grid = svg('g', { class: 'c-grid' }, root);
    ticks.forEach(function (t) {
      svg('line', { x1: PAD.left, x2: width - PAD.right, y1: y(t), y2: y(t) }, grid);
      var lbl = svg('text', { x: PAD.left - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'c-axis' }, root);
      lbl.textContent = t + '°';
    });
    var every = Math.ceil(n / Math.max(2, Math.floor(iw / 56)));
    cfg.labels.forEach(function (l, i) {
      if (i % every) return;
      var t = svg('text', { x: x(i), y: HEIGHT - 8, 'text-anchor': 'middle', class: 'c-axis' }, root);
      t.textContent = l;
    });

    // ხაზები (საერთო — ბოლოს, ზემოდან)
    var ordered = cfg.series.filter(function (s) { return !s.bold; }).concat(cfg.series.filter(function (s) { return s.bold; }));
    ordered.forEach(function (s) {
      var d = '', pen = false;
      s.values.forEach(function (v, i) {
        if (v == null) { pen = false; return; }
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
        pen = true;
      });
      if (!d) return;
      svg('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.bold ? 3 : 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: s.bold ? 'c-line bold' : 'c-line' }, root);
    });

    // კურსორი + tooltip
    var cross = svg('line', { y1: PAD.top, y2: PAD.top + ih, class: 'c-cross', visibility: 'hidden' }, root);
    var dots = svg('g', { visibility: 'hidden' }, root);
    var tip = document.createElement('div');
    tip.className = 'c-tip hidden';
    el.appendChild(tip);

    function show(i) {
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      dots.innerHTML = '';
      var rows = [];
      ordered.slice().reverse().forEach(function (s) {
        var v = s.values[i];
        if (v == null) return;
        svg('circle', { cx: x(i), cy: y(v), r: 4.5, fill: s.color, class: 'c-dot' }, dots);
        rows.push('<div class="c-row"><i style="background:' + s.color + '"></i><span>' + s.name +
          '</span><b>' + v.toFixed(1) + '°</b></div>');
      });
      dots.setAttribute('visibility', 'visible');
      tip.innerHTML = '<div class="c-tip-h">' + (cfg.tipLabels || cfg.labels)[i] + '</div>' + rows.join('');
      tip.classList.remove('hidden');
      var left = x(i) + 12;
      if (left + tip.offsetWidth > width) left = x(i) - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, left) + 'px';
    }
    function hide() {
      cross.setAttribute('visibility', 'hidden');
      dots.setAttribute('visibility', 'hidden');
      tip.classList.add('hidden');
    }
    function idxFrom(ev) {
      var r = root.getBoundingClientRect();
      var px = (ev.clientX - r.left) * (width / r.width);
      var i = n === 1 ? 0 : Math.round(((px - PAD.left) / iw) * (n - 1));
      return Math.max(0, Math.min(n - 1, i));
    }
    root.addEventListener('pointermove', function (ev) { show(idxFrom(ev)); });
    root.addEventListener('pointerdown', function (ev) { show(idxFrom(ev)); });
    root.addEventListener('pointerleave', hide);
  }

  root.LineChart = { render: render };
})(window);
