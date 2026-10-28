(function () {
  'use strict';

  var W = window.WeatherConsensus;
  var P = window.WeatherProviders;
  var HOUR = W.HOUR;

  var LOC_KEY = 'wx-location-v1';
  var FAV_KEY = 'wx-favorites-v1';
  var CACHE_PREFIX = 'wx-cache-v2:';

  // წყაროს ფერი = მისი იდენტობა, ფიქსირებული რიგით
  var COLORS = { yr: '#2a78d6', ecmwf: '#eb6834', gfs: '#1baf7a', icon: '#eda100', ukmo: '#e87ba4' };
  var CONSENSUS_COLOR = '#1d2125';

  var DEFAULT_LOC = { name: 'თბილისი', country: 'საქართველო', lat: 41.6941, lon: 44.8337, tz: 'Asia/Tbilisi' };

  /* ---------- localStorage (შეიძლება მიუწვდომელი იყოს) ---------- */

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* სავსე ან დაბლოკილი */ }
  }
  var state = {
    loc: load(LOC_KEY, DEFAULT_LOC),
    favorites: load(FAV_KEY, []),
    chart: 'hourly',
    results: {},   // id -> { status: 'loading'|'ok'|'error', data, error, at }
    loadToken: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- ფორმატირება ---------- */

  var WEEKDAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
  var WD_SHORT = ['კვ', 'ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა'];
  var MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function deg(v) { return v == null ? '—' : Math.round(v) + '°'; }
  function pct(v) { return v == null ? '—' : Math.round(v) + '%'; }
  function ms(v) { return v == null ? '—' : (Math.round(v * 10) / 10) + ' მ/წ'; }
  function mm(v) { return v == null ? '—' : (Math.round(v * 10) / 10) + ' მმ'; }

  function condIcon(cond, night) {
    var c = W.CONDITIONS[cond];
    if (!c) return '·';
    return night && c.night ? c.night : c.icon;
  }
  function condName(cond) { return W.CONDITIONS[cond] ? W.CONDITIONS[cond].name : '—'; }
  function isNight(t) { var h = W.localHour(t, state.loc.tz); return h < 6 || h >= 20; }

  function dateInfo(dateStr) {
    var p = dateStr.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return { wd: d.getUTCDay(), day: p[2], month: MONTHS[p[1] - 1] };
  }
  function dayLabel(dateStr, i) {
    if (i === 0) return 'დღეს';
    if (i === 1) return 'ხვალ';
    return WEEKDAYS[dateInfo(dateStr).wd];
  }
  function hourLabel(t) { return String(W.localHour(t, state.loc.tz)).padStart(2, '0') + ':00'; }

  function agreeBadge(a) {
    if (!a) return '';
    if (a.level == null) return '<span class="agree single">ერთი წყარო</span>';
    return '<span class="agree ' + a.key + '">შეთანხმება: ' + a.name + '</span>';
  }
  function agreeDot(a) {
    if (!a || a.level == null) return '<i class="dot single" title="ერთი წყარო"></i>';
    return '<i class="dot ' + a.key + '" title="შეთანხმება: ' + a.name + '"></i>';
  }

  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 3500);
  }

  /* ---------- ქსელი ---------- */

  function get(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        var err = new Error(res.status === 429 || res.status === 503 ? 'სერვისი გადატვირთულია, სცადე მოგვიანებით'
          : 'შეცდომა ' + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }, function (e) {
      clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? 'პასუხი დიდხანს არ მოვიდა' : 'ქსელის შეცდომა');
    });
  }

  function cacheId(src) { return CACHE_PREFIX + src.id + ':' + state.loc.lat.toFixed(3) + ',' + state.loc.lon.toFixed(3); }

  function loadAll(force) {
    var token = ++state.loadToken;
    var loc = state.loc;
    P.SOURCES.forEach(function (src) {
      var cached = load(cacheId(src), null);
      var ageMin = cached ? (Date.now() - cached.at) / 60000 : Infinity;
      if (cached && ageMin < src.ttlMin && !force) {
        state.results[src.id] = { status: 'ok', data: cached.data, at: cached.at };
        return;
      }
      state.results[src.id] = { status: 'loading', data: cached && cached.data, at: cached && cached.at };
      src.fetch(loc, get).then(function (data) {
        if (token !== state.loadToken) return;
        var at = Date.now();
        save(cacheId(src), { at: at, data: data });
        state.results[src.id] = { status: 'ok', data: data, at: at };
        render();
      }, function (err) {
        if (token !== state.loadToken) return;
        // ძველი მონაცემი ჯობია არაფერს — ვაჩვენებთ, მაგრამ ვნიშნავთ შეცდომას
        state.results[src.id] = { status: 'error', error: err.message, data: cached && cached.data, at: cached && cached.at };
        render();
      });
    });
    render();
  }

  /* ---------- საერთო პროგნოზის გამოთვლა ---------- */

  function okData() {
    var out = {};
    P.SOURCES.forEach(function (s) {
      var r = state.results[s.id];
      if (r && r.data) out[s.id] = r.data;
    });
    return out;
  }

  function compute() {
    var data = okData();
    var ids = Object.keys(data);
    var now = Date.now();
    var start = Math.ceil(now / HOUR) * HOUR;
    var hours = [];
    for (var i = 0; i < 24; i++) hours.push(start + i * HOUR);

    var hourlyBy = {}, dailyBy = {};
    ids.forEach(function (id) {
      hourlyBy[id] = data[id].hourly || [];
      dailyBy[id] = data[id].daily || [];
    });

    var dates = [];
    var today = W.dateKey(now, state.loc.tz);
    var p = today.split('-').map(Number);
    for (var d = 0; d < 7; d++) {
      dates.push(new Date(Date.UTC(p[0], p[1] - 1, p[2] + d)).toISOString().slice(0, 10));
    }

    return {
      ids: ids,
      current: W.combineCurrent(ids.map(function (id) { return data[id].current; })),
      hourly: W.combineHourly(hours, hourlyBy),
      daily: W.combineDaily(dates, dailyBy).filter(function (x) { return x.sources > 0; })
    };
  }

  /* ---------- რენდერი ---------- */

  function render() {
    var c = compute();
    renderPlace();
    renderHero(c);
    renderSources(c);
    renderHourly(c);
    renderChart(c);
    renderDaily(c);
  }

  function renderPlace() {
    $('place-name').textContent = state.loc.name;
    $('place-meta').textContent = [state.loc.admin, state.loc.country].filter(Boolean).join(', ');
    var fav = isFavorite(state.loc);
    $('fav-toggle').textContent = fav ? '★' : '☆';
    $('fav-toggle').setAttribute('aria-pressed', fav ? 'true' : 'false');
    $('fav-toggle').title = fav ? 'ფავორიტებიდან წაშლა' : 'ფავორიტებში დამატება';
    renderFavorites();
  }

  function renderHero(c) {
    var el = $('hero');
    var cur = c.current;
    var loading = P.SOURCES.some(function (s) { return state.results[s.id] && state.results[s.id].status === 'loading'; });
    if (!cur || cur.temp == null) {
      el.innerHTML = '<p class="hint">' + (loading ? 'პროგნოზები იტვირთება…' : 'მონაცემები ვერ მივიღეთ. სცადე განახლება.') + '</p>';
      return;
    }
    var today = c.daily[0];
    el.innerHTML =
      '<div class="now">' +
        '<div class="now-icon" aria-hidden="true">' + condIcon(cur.cond, isNight(Date.now())) + '</div>' +
        '<div>' +
          '<div class="now-temp">' + deg(cur.temp) + '</div>' +
          '<div class="now-cond">' + condName(cur.cond) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="now-side">' +
        agreeBadge(cur.agreement) +
        '<p class="hint">' + cur.sources + ' წყარო' +
          (cur.sources > 1 ? ' · დიაპაზონი ' + deg(cur.tempMin) + '…' + deg(cur.tempMax) : '') + '</p>' +
        (today ? '<p class="hint">დღეს: ' + deg(today.tmin) + ' / ' + deg(today.tmax) + '</p>' : '') +
      '</div>' +
      '<div class="meta">' +
        '<span class="pill">☔ ' + pct(cur.precipProb) + '</span>' +
        '<span class="pill">💨 ' + ms(cur.wind) + '</span>' +
        '<span class="pill">💧 ' + pct(cur.humidity) + '</span>' +
        (cur.pressure != null ? '<span class="pill">⏲ ' + Math.round(cur.pressure) + ' hPa</span>' : '') +
      '</div>';
  }

  function ago(at) {
    if (!at) return '';
    var m = Math.round((Date.now() - at) / 60000);
    return m < 1 ? 'ახლახან' : m < 60 ? m + ' წთ წინ' : Math.round(m / 60) + ' სთ წინ';
  }

  function renderSources(c) {
    var cur = c.current;
    $('sources').innerHTML = P.SOURCES.map(function (src) {
      var r = state.results[src.id] || { status: 'loading' };
      var head = '<div class="src-head"><i class="swatch" style="background:' + COLORS[src.id] + '"></i>' +
        '<a href="' + src.site + '" target="_blank" rel="noopener">' + esc(src.name) + '</a></div>' +
        '<div class="src-by">' + esc(src.by) + '</div>';
      var d = r.data && r.data.current;
      if (!d) {
        return '<div class="src' + (r.status === 'error' ? ' err' : ' muted') + '">' + head +
          '<p class="src-msg">' + (r.status === 'error' ? esc(r.error) : 'იტვირთება…') + '</p></div>';
      }
      var diff = cur && cur.temp != null && d.temp != null ? d.temp - cur.temp : null;
      var diffTxt = diff == null || c.ids.length < 2 ? '' :
        '<span class="diff">' + (Math.abs(diff) < 0.5 ? '≈ საერთო' : (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + '°') + '</span>';
      return '<div class="src' + (r.status === 'error' ? ' stale' : '') + '">' + head +
        '<div class="src-main"><span class="src-icon">' + condIcon(d.cond, isNight(Date.now())) + '</span>' +
        '<span class="src-temp">' + deg(d.temp) + '</span>' + diffTxt + '</div>' +
        '<div class="src-cond">' + condName(d.cond) + '</div>' +
        '<div class="src-meta">☔ ' + pct(d.precipProb) + ' · 💨 ' + ms(d.wind) + '</div>' +
        '<div class="src-time">' + (r.status === 'error' ? '⚠ ' + esc(r.error) + ' · ' : '') +
          (r.status === 'loading' ? 'ახლდება… · ' : '') + ago(r.at) + '</div>' +
        '</div>';
    }).join('');
  }

  function renderHourly(c) {
    var rows = c.hourly.filter(function (h) { return h.sources > 0; });
    if (!rows.length) { $('hourly').innerHTML = '<p class="hint">იტვირთება…</p>'; return; }
    $('hourly').innerHTML = rows.map(function (h) {
      return '<div class="hour">' +
        '<div class="hour-t">' + hourLabel(h.t) + '</div>' +
        '<div class="hour-i" title="' + condName(h.cond) + '">' + condIcon(h.cond, isNight(h.t)) + '</div>' +
        '<div class="hour-v">' + deg(h.temp) + '</div>' +
        '<div class="hour-p">' + (h.precipProb != null && h.precipProb >= 5 ? '☔ ' + pct(h.precipProb) : '&nbsp;') + '</div>' +
        '<div class="hour-a">' + agreeDot(h.agreement) + '<span>' + h.sources + '</span></div>' +
        '</div>';
    }).join('');
  }

  function renderChart(c) {
    var series, labels, tipLabels;
    var sources = P.SOURCES.filter(function (s) { return c.ids.indexOf(s.id) !== -1; });
    if (state.chart === 'hourly') {
      labels = c.hourly.map(function (h) { return hourLabel(h.t).slice(0, 2); });
      tipLabels = c.hourly.map(function (h) { return hourLabel(h.t); });
      series = sources.map(function (s) {
        return { name: s.name, color: COLORS[s.id], values: c.hourly.map(function (h) {
          return h.bySource[s.id] ? h.bySource[s.id].temp : null;
        }) };
      });
      series.push({ name: 'საერთო', color: CONSENSUS_COLOR, bold: true, values: c.hourly.map(function (h) { return h.temp; }) });
    } else {
      labels = c.daily.map(function (d, i) { return i === 0 ? 'დღეს' : WD_SHORT[dateInfo(d.date).wd]; });
      tipLabels = c.daily.map(function (d, i) { var di = dateInfo(d.date); return dayLabel(d.date, i) + ', ' + di.day + ' ' + di.month; });
      series = sources.map(function (s) {
        return { name: s.name, color: COLORS[s.id], values: c.daily.map(function (d) {
          return d.bySource[s.id] ? d.bySource[s.id].tmax : null;
        }) };
      });
      series.push({ name: 'საერთო', color: CONSENSUS_COLOR, bold: true, values: c.daily.map(function (d) { return d.tmax; }) });
    }
    window.LineChart.render($('chart'), { labels: labels, tipLabels: tipLabels, series: series,
      title: state.chart === 'hourly' ? 'ტემპერატურა 24 საათში, წყაროების მიხედვით' : 'მაქსიმალური ტემპერატურა 7 დღეში' });
    $('legend').innerHTML = series.slice().reverse().map(function (s) {
      return '<span class="lg' + (s.bold ? ' bold' : '') + '"><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
    }).join('');
  }

  var openDays = {};
  function renderDaily(c) {
    if (!c.daily.length) { $('daily').innerHTML = '<p class="hint">იტვირთება…</p>'; return; }
    var lo = Math.min.apply(null, c.daily.map(function (d) { return d.tmin == null ? Infinity : d.tmin; }));
    var hi = Math.max.apply(null, c.daily.map(function (d) { return d.tmax == null ? -Infinity : d.tmax; }));
    var span = Math.max(1, hi - lo);
    $('daily').innerHTML = c.daily.map(function (d, i) {
      var di = dateInfo(d.date);
      var left = d.tmin == null ? 0 : ((d.tmin - lo) / span) * 100;
      var right = d.tmax == null ? 100 : ((d.tmax - lo) / span) * 100;
      var details = P.SOURCES.filter(function (s) { return d.bySource[s.id]; }).map(function (s) {
        var x = d.bySource[s.id];
        return '<tr><td><i class="swatch" style="background:' + COLORS[s.id] + '"></i>' + esc(s.name) + '</td>' +
          '<td>' + condIcon(x.cond) + ' <span class="hide-sm">' + condName(x.cond) + '</span></td>' +
          '<td>' + deg(x.tmin) + ' / ' + deg(x.tmax) + '</td><td>' + pct(x.precipProb) + '</td>' +
          '<td>' + mm(x.precip) + '</td><td>' + ms(x.wind) + '</td></tr>';
      }).join('');
      return '<details class="day"' + (openDays[d.date] ? ' open' : '') + ' data-date="' + d.date + '">' +
        '<summary>' +
          '<span class="day-name"><b>' + dayLabel(d.date, i) + '</b><small>' + di.day + ' ' + di.month + '</small></span>' +
          '<span class="day-icon" title="' + condName(d.cond) + '">' + condIcon(d.cond) + '</span>' +
          '<span class="day-p">' + (d.precipProb != null && d.precipProb >= 5 ? '☔ ' + pct(d.precipProb) : '') + '</span>' +
          '<span class="day-range"><span class="t-lo">' + deg(d.tmin) + '</span>' +
            '<span class="bar"><span style="left:' + left + '%;right:' + (100 - right) + '%"></span></span>' +
            '<span class="t-hi">' + deg(d.tmax) + '</span></span>' +
          '<span class="day-a">' + agreeDot(d.agreement) + '</span>' +
        '</summary>' +
        '<div class="day-body">' +
          '<p class="hint">' + condName(d.cond) + ' · ' + agreeBadge(d.agreement) + ' · ' + d.sources + ' წყარო · ნალექი ' + mm(d.precip) + ' · ქარი ' + ms(d.wind) + '</p>' +
          '<div class="table-wrap"><table><thead><tr><th>წყარო</th><th>ამინდი</th><th>მინ/მაქს</th><th>☔</th><th>ნალექი</th><th>ქარი</th></tr></thead>' +
          '<tbody>' + details + '</tbody></table></div>' +
        '</div></details>';
    }).join('');
  }

  /* ---------- ძებნა, GPS, ფავორიტები ---------- */

  function setLocation(loc) {
    state.loc = loc;
    save(LOC_KEY, loc);
    state.results = {};
    hideResults();
    loadAll(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideResults() {
    $('search-results').classList.add('hidden');
    $('search-msg').classList.add('hidden');
  }

  function search(q) {
    var msg = $('search-msg');
    msg.textContent = 'ვეძებ…';
    msg.classList.remove('hidden');
    var url = 'https://geocoding-api.open-meteo.com/v1/search?count=8&format=json&language=ka&name=' + encodeURIComponent(q);
    get(url).then(function (json) {
      var list = (json.results || []);
      if (!list.length) { msg.textContent = 'ვერაფერი მოიძებნა. სცადე ლათინურად (მაგ. Batumi).'; return; }
      msg.classList.add('hidden');
      var ul = $('search-results');
      ul.innerHTML = list.map(function (r, i) {
        return '<li><button type="button" data-i="' + i + '"><b>' + esc(r.name) + '</b> <small>' +
          esc([r.admin1, r.country].filter(Boolean).join(', ')) + '</small></button></li>';
      }).join('');
      ul.classList.remove('hidden');
      ul.onclick = function (e) {
        var b = e.target.closest('button[data-i]');
        if (!b) return;
        var r = list[Number(b.getAttribute('data-i'))];
        setLocation({ name: r.name, admin: r.admin1 || '', country: r.country || '', lat: r.latitude, lon: r.longitude,
          tz: r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone });
        $('search-input').value = '';
      };
    }, function (e) { msg.textContent = 'ძებნა ვერ მოხერხდა: ' + e.message; });
  }

  function useGps() {
    if (!navigator.geolocation) { toast('მდებარეობის განსაზღვრა მიუწვდომელია'); return; }
    toast('ვადგენ მდებარეობას…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var loc = { name: 'ჩემი მდებარეობა', admin: '', country: '', lat: lat, lon: lon,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone, gps: true };
      setLocation(loc);
      // ქალაქის სახელი (უფასო, გასაღების გარეშე)
      get('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=ka&latitude=' + lat + '&longitude=' + lon)
        .then(function (r) {
          if (state.loc !== loc) return;
          loc.name = r.city || r.locality || loc.name;
          loc.country = r.countryName || '';
          save(LOC_KEY, loc);
          renderPlace();
        }, function () { /* სახელი არასავალდებულოა */ });
    }, function (err) {
      toast(err.code === 1 ? 'მდებარეობაზე წვდომა უარყოფილია' : 'მდებარეობა ვერ განისაზღვრა');
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60000 });
  }

  function sameLoc(a, b) { return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01; }
  function isFavorite(loc) { return state.favorites.some(function (f) { return sameLoc(f, loc); }); }

  function toggleFavorite() {
    if (isFavorite(state.loc)) {
      state.favorites = state.favorites.filter(function (f) { return !sameLoc(f, state.loc); });
    } else {
      var f = {};
      ['name', 'admin', 'country', 'lat', 'lon', 'tz'].forEach(function (k) { f[k] = state.loc[k]; });
      state.favorites.push(f);
    }
    save(FAV_KEY, state.favorites);
    renderPlace();
  }

  function renderFavorites() {
    var el = $('favorites');
    if (!state.favorites.length) {
      el.innerHTML = '<span class="hint">დააჭირე ☆-ს ქალაქის ფავორიტებში დასამატებლად.</span>';
      return;
    }
    el.innerHTML = state.favorites.map(function (f, i) {
      return '<button type="button" class="chip' + (sameLoc(f, state.loc) ? ' active' : '') + '" data-fav="' + i + '">' +
        esc(f.name) + '</button>';
    }).join('');
  }

  /* ---------- მოვლენები ---------- */

  $('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('search-input').value.trim();
    if (q.length >= 2) search(q);
  });
  $('search-input').addEventListener('input', function () { if (!this.value.trim()) hideResults(); });
  $('gps').addEventListener('click', useGps);
  $('fav-toggle').addEventListener('click', toggleFavorite);
  $('favorites').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fav]');
    if (b) setLocation(state.favorites[Number(b.getAttribute('data-fav'))]);
  });
  $('refresh').addEventListener('click', function () { loadAll(true); toast('ვაახლებ პროგნოზებს…'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-chart]'), function (b) {
    b.addEventListener('click', function () {
      state.chart = b.getAttribute('data-chart');
      document.querySelectorAll('[data-chart]').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderChart(compute());
    });
  });
  $('daily').addEventListener('toggle', function (e) {
    var d = e.target.closest && e.target.closest('details[data-date]');
    if (d) openDays[d.getAttribute('data-date')] = d.open;
  }, true);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderChart(compute()); }, 150);
  });
  // აპში დაბრუნებისას ვაახლებთ, თუ ქეში მოძველდა
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadAll(false); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* PWA არასავალდებულოა */ });
  }

  loadAll(false);
})();
