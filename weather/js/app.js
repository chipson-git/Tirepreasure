(function () {
  'use strict';

  var W = window.WeatherConsensus;
  var P = window.WeatherProviders;
  var E = window.WeatherExtras;
  var X = window.WeatherInsights;
  var A = window.Astro;
  var I = window.I18N;
  var t = I.t;
  var HOUR = W.HOUR;

  var LOC_KEY = 'wx-location-v1';
  var FAV_KEY = 'wx-favorites-v1';
  var PREFS_KEY = 'wx-prefs-v1';
  var THEME_KEY = 'wx-theme-v1';
  var YRLOG_KEY = 'wx-yrlog-v1';
  var CACHE_PREFIX = 'wx-cache-v3:';

  // წყაროს ფერი = მისი იდენტობა, ფიქსირებული რიგით. CSS ცვლადებია — ღია და მუქ თემაში თავისი მნიშვნელობა აქვს.
  var COLORS = { yr: 'var(--s-yr)', ecmwf: 'var(--s-ecmwf)', gfs: 'var(--s-gfs)', icon: 'var(--s-icon)', ukmo: 'var(--s-ukmo)' };
  var CONSENSUS_COLOR = 'var(--s-consensus)';

  var DEFAULT_LOC = { name: 'თბილისი', country: 'საქართველო', lat: 41.6941, lon: 44.8337, tz: 'Asia/Tbilisi', isDefault: true };
  var DEFAULT_PREFS = { lang: 'ka', temp: 'c', wind: 'ms', time: '24', off: [], weighting: true, notify: false };

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

  var prefs = Object.assign({}, DEFAULT_PREFS, load(PREFS_KEY, {}));
  I.setPrefs(prefs);

  var state = {
    loc: load(LOC_KEY, DEFAULT_LOC),
    favorites: load(FAV_KEY, []),
    chart: 'hourly',
    tab: 'home',
    results: {},   // id -> { status: 'loading'|'ok'|'error', data, error, at }
    extra: {},     // details, air, places, history, accuracy -> { status, data }
    loadToken: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  function activeSources() {
    return P.SOURCES.filter(function (s) { return prefs.off.indexOf(s.id) === -1; });
  }

  /* ---------- ფორმატირება ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { return typeof v === 'number' && isFinite(v); }

  function condIcon(cond, night) {
    var c = W.CONDITIONS[cond];
    if (!c) return '·';
    return night && c.night ? c.night : c.icon;
  }
  function condName(cond) { return (t('cond') || {})[cond] || '—'; }
  function isNight(ms) {
    var s = A.sunTimes(W.dateKey(ms, state.loc.tz), state.loc.lat, state.loc.lon);
    if (s.polar) return s.polar === 'night';
    return ms < s.sunrise || ms > s.sunset;
  }

  function dateInfo(dateStr) {
    var p = dateStr.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return { wd: d.getUTCDay(), day: p[2], month: t('months')[p[1] - 1] };
  }
  function dayLabel(dateStr, i) {
    if (i === 0) return t('today');
    if (i === 1) return t('tomorrow');
    return t('weekdays')[dateInfo(dateStr).wd];
  }
  function dayIndex(dateStr) {
    var today = W.dateKey(Date.now(), state.loc.tz);
    return Math.round((Date.parse(dateStr) - Date.parse(today)) / 86400000);
  }
  function whenLabel(w) {
    if (typeof w === 'string') { var di = dateInfo(w); return dayLabel(w, dayIndex(w)) + ', ' + di.day + ' ' + di.month; }
    var d = W.dateKey(w, state.loc.tz);
    return dayLabel(d, dayIndex(d)) + ' ' + I.time(w, state.loc.tz);
  }
  function hourLabel(ms) { return I.hour(W.localHour(ms, state.loc.tz)); }

  function agreeName(a) { return a.key === 'high' ? t('agreeHigh') : a.key === 'mid' ? t('agreeMid') : t('agreeLow'); }
  function agreeBadge(a) {
    if (!a) return '';
    if (a.level == null) return '<span class="agree single">' + t('singleSource') + '</span>';
    return '<span class="agree ' + a.key + '">' + t('agreement', { x: agreeName(a) }) + '</span>';
  }
  function agreeDot(a) {
    if (!a || a.level == null) return '<i class="dot single" title="' + t('singleSource') + '"></i>';
    return '<i class="dot ' + a.key + '" title="' + t('agreement', { x: agreeName(a) }) + '"></i>';
  }
  function windArrow(deg) {
    if (!num(deg)) return '';
    // ისარი აჩვენებს, საით უბერავს (საიდანაც მოდის + 180°)
    return '<span class="arrow" style="transform:rotate(' + Math.round(deg + 180) + 'deg)" aria-hidden="true">↑</span>';
  }

  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 3500);
  }

  /* ---------- ქსელი და ქეში ---------- */

  function get(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        var err = new Error(res.status === 429 || res.status === 503 ? t('errBusy') : t('errCode', { n: res.status }));
        err.status = res.status;
        throw err;
      }
      return res.json();
    }, function (e) {
      clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? t('errSlow') : t('errNet'));
    });
  }

  function locKey(digits) { return state.loc.lat.toFixed(digits || 3) + ',' + state.loc.lon.toFixed(digits || 3); }

  /**
   * ქეშირებული ჩატვირთვა: თუ შენახული ახალია — ვიყენებთ, თუ არა — ვითხოვთ. შეცდომისას ძველი მონაცემი რჩება.
   * slot — სად ჩავწეროთ ({status, data, at, error}).
   */
  function cachedLoad(key, ttlMin, fetcher, force, onDone) {
    var token = state.loadToken;
    var cached = load(key, null);
    var age = cached ? (Date.now() - cached.at) / 60000 : Infinity;
    if (cached && age < ttlMin && !force) { onDone({ status: 'ok', data: cached.data, at: cached.at }, false); return; }
    onDone({ status: 'loading', data: cached && cached.data, at: cached && cached.at }, false);
    fetcher().then(function (data) {
      if (token !== state.loadToken) return;
      var at = Date.now();
      save(key, { at: at, data: data });
      onDone({ status: 'ok', data: data, at: at }, true);
    }, function (err) {
      if (token !== state.loadToken) return;
      onDone({ status: 'error', error: err.message, data: cached && cached.data, at: cached && cached.at }, true);
    });
  }

  var renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () { renderQueued = false; render(); });
  }

  function loadAll(force) {
    ++state.loadToken;
    var loc = state.loc;
    activeSources().forEach(function (src) {
      cachedLoad(CACHE_PREFIX + src.id + ':' + locKey(), src.ttlMin, function () { return src.fetch(loc, get); }, force, function (r, async) {
        state.results[src.id] = r;
        if (r.status === 'ok' && src.id === 'yr' && async) recordYr(r.data);
        if (async) scheduleRender();
      });
    });
    loadExtra('details', 30, function () { return E.fetchDetails(loc, get); }, force);
    loadExtra('air', 60, function () { return E.fetchAir(loc, get); }, force);
    loadExtra('accuracy', 12 * 60, function () { return E.fetchAccuracy(loc, get); }, false);
    loadTabData(force);
    render();
  }

  function loadExtra(name, ttl, fetcher, force, keyOverride) {
    cachedLoad(CACHE_PREFIX + name + ':' + (keyOverride || locKey()), ttl, fetcher, force, function (r, async) {
      state.extra[name] = r;
      if (async) scheduleRender();
    });
  }

  function loadTabData(force) {
    var loc = state.loc;
    if (state.tab === 'road') loadExtra('places', 30, function () { return E.fetchPlaces(get); }, force, 'ge');
    if (state.tab === 'accuracy') {
      var today = W.dateKey(Date.now(), loc.tz);
      loadExtra('history', 30 * 24 * 60, function () { return E.fetchHistory(loc, get, today); }, false, locKey(1));
    }
  }

  /* ---------- yr.no-ს სიზუსტე: პროგნოზებს ვინახავთ და მერე ვადარებთ ---------- */

  function recordYr(data) {
    var log = load(YRLOG_KEY, {});
    var k = locKey(2);
    var rows = log[k] || [];
    var now = Date.now();
    var have = {};
    rows.forEach(function (r) { have[r.t] = true; });
    // „ხვალინდელი“ პროგნოზი: 20–28 საათით წინ გაკეთებული
    (data.hourly || []).forEach(function (p) {
      var lead = p.t - now;
      if (lead >= 20 * HOUR && lead <= 28 * HOUR && num(p.temp) && !have[p.t]) rows.push({ t: p.t, forecast: p.temp });
    });
    log[k] = rows.filter(function (r) { return r.t > now - 10 * 24 * HOUR; }).slice(-400);
    save(YRLOG_KEY, log);
  }

  /* ---------- საერთო პროგნოზის გამოთვლა ---------- */

  function accuracyScores() {
    var acc = state.extra.accuracy;
    if (!acc || !acc.data) return null;
    var yr = (load(YRLOG_KEY, {})[locKey(2)] || []).filter(function (r) { return r.t <= Date.now(); });
    return E.scoreAccuracy(acc.data, yr.length ? { yr: yr } : {});
  }

  function compute() {
    var data = {};
    activeSources().forEach(function (s) {
      var r = state.results[s.id];
      if (r && r.data) data[s.id] = r.data;
    });
    var ids = Object.keys(data);
    var now = Date.now();
    var scores = accuracyScores();
    var weights = prefs.weighting && scores ? E.weightsFrom(scores, ids) : null;

    var start = Math.ceil(now / HOUR) * HOUR;
    var hours = [];
    for (var i = 0; i < 48; i++) hours.push(start + i * HOUR);
    var hourlyBy = {}, dailyBy = {}, currentBy = {};
    ids.forEach(function (id) {
      hourlyBy[id] = data[id].hourly || [];
      dailyBy[id] = data[id].daily || [];
      currentBy[id] = data[id].current;
    });
    var dates = [];
    var p = W.dateKey(now, state.loc.tz).split('-').map(Number);
    for (var d = 0; d < 7; d++) dates.push(new Date(Date.UTC(p[0], p[1] - 1, p[2] + d)).toISOString().slice(0, 10));

    var hourly48 = W.combineHourly(hours, hourlyBy, weights).filter(function (h) { return h.sources > 0; });
    return {
      ids: ids,
      weights: weights,
      scores: scores,
      current: W.combineCurrent(currentBy, weights),
      hourly48: hourly48,
      hourly: hourly48.slice(0, 24),
      daily: W.combineDaily(dates, dailyBy, weights).filter(function (x) { return x.sources > 0; })
    };
  }

  /* ---------- რენდერი ---------- */

  function render() {
    var c = compute();
    state.lastCompute = c;
    renderPlace();
    if (state.tab === 'home') {
      renderAlerts(c);
      renderHero(c);
      renderWear(c);
      renderToday(c);
      renderSources(c);
      renderHourly(c);
      renderChart(c);
      renderDaily(c);
      renderBest(c);
      renderSupport();
    } else if (state.tab === 'road') {
      renderRoad(c);
      renderPlaces();
      renderMountain(c);
    } else if (state.tab === 'accuracy') {
      renderAccuracy(c);
      renderHistory(c);
    }
    if (window.WeatherNotify) window.WeatherNotify.check(notifyContext(c));
  }

  function renderPlace() {
    $('place-name').textContent = placeName(state.loc);
    $('place-meta').textContent = state.loc.isDefault ? t('defaultCountry') : [state.loc.admin, state.loc.country].filter(Boolean).join(', ');
    var fav = isFavorite(state.loc);
    $('fav-toggle').textContent = fav ? '★' : '☆';
    $('fav-toggle').setAttribute('aria-pressed', fav ? 'true' : 'false');
    $('fav-toggle').title = fav ? t('favRemove') : t('favAdd');
    renderFavorites();
  }

  function alertText(a) {
    var v = a.value;
    var x = a.type === 'wind' ? I.wind(v) : a.type === 'rain' ? I.mm(v) : a.type === 'snow' ? I.cm(v)
      : a.type === 'fog' ? I.distance(v) : (a.type === 'heat' || a.type === 'frost') ? I.temp(v) : '';
    return t('al_' + a.type, { x: x });
  }

  function currentAlerts(c) {
    var month = Number(W.dateKey(Date.now(), state.loc.tz).slice(5, 7));
    var det = state.extra.details && state.extra.details.data;
    var now = Date.now();
    var detNext = det ? { hourly: det.hourly.filter(function (r) { return r.t >= now - HOUR && r.t <= now + 48 * HOUR; }), daily: det.daily.filter(function (d) { return dayIndex(d.date) >= 0; }) } : null;
    return X.alerts(c.hourly48, c.daily, detNext, month);
  }

  function renderAlerts(c) {
    var list = currentAlerts(c);
    $('alerts').innerHTML = list.map(function (a) {
      return '<div class="alert ' + a.level + '" role="alert"><b>⚠ ' + t('lvl_' + a.level) + ':</b> ' + esc(alertText(a)) +
        ' <span class="alert-when">· ' + esc(whenLabel(a.when)) + '</span></div>';
    }).join('');
  }

  function historyToday() {
    var h = state.extra.history && state.extra.history.data;
    if (!h) h = (load(CACHE_PREFIX + 'history:' + locKey(1), null) || {}).data;
    if (!h) return null;
    return h.days[W.dateKey(Date.now(), state.loc.tz).slice(5)] || null;
  }

  function renderHero(c) {
    var el = $('hero');
    var cur = c.current;
    var loading = activeSources().some(function (s) { return state.results[s.id] && state.results[s.id].status === 'loading'; });
    if (!cur || cur.temp == null) {
      el.innerHTML = '<p class="hint">' + (loading ? t('loadingForecasts') : t('noData')) + '</p>';
      return;
    }
    var today = c.daily[0];
    var feels = X.feelsLike(cur.temp, cur.humidity, cur.wind);
    var det = state.extra.details && state.extra.details.data;
    var dy = det ? X.vsYesterday(det.hourly, Date.now()) : null;
    var dyTxt = dy == null ? '' : Math.abs(dy) < 1 ? t('sameAsYesterday') :
      dy > 0 ? t('warmerThanYesterday', { d: I.tempDelta(dy) }) : t('colderThanYesterday', { d: I.tempDelta(dy) });
    var norm = historyToday();
    el.innerHTML =
      '<div class="now">' +
        '<div class="now-icon" aria-hidden="true">' + condIcon(cur.cond, isNight(Date.now())) + '</div>' +
        '<div>' +
          '<div class="now-temp">' + I.temp(cur.temp) + '</div>' +
          '<div class="now-cond">' + condName(cur.cond) + '</div>' +
          (feels != null ? '<div class="now-feels">' + t('feels', { t: I.temp(feels) }) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="now-side">' +
        agreeBadge(cur.agreement) +
        '<p class="hint">' + t('sources', { n: cur.sources }) +
          (cur.sources > 1 ? ' · ' + t('range', { a: I.temp(cur.tempMin), b: I.temp(cur.tempMax) }) : '') + '</p>' +
        (today ? '<p class="hint">' + t('todayRange', { a: I.temp(today.tmin), b: I.temp(today.tmax) }) + '</p>' : '') +
        (norm && norm.normHi != null ? '<p class="hint">' + t('normalToday', { a: I.temp(norm.normLo), b: I.temp(norm.normHi) }) + '</p>' : '') +
        (dyTxt ? '<p class="yesterday">' + dyTxt + '</p>' : '') +
      '</div>' +
      '<div class="meta">' +
        '<span class="pill">☔ ' + I.pct(cur.precipProb) + '</span>' +
        '<span class="pill">' + windArrow(cur.windDir) + ' ' + I.wind(cur.wind) + '</span>' +
        '<span class="pill">💧 ' + I.pct(cur.humidity) + '</span>' +
        (cur.pressure != null ? '<span class="pill">⏲ ' + Math.round(cur.pressure) + ' hPa</span>' : '') +
      '</div>';
  }

  function uvToday() {
    var air = state.extra.air && state.extra.air.data;
    if (!air) return null;
    var today = W.dateKey(Date.now(), state.loc.tz);
    var v = air.hourly.filter(function (r) { return W.dateKey(r.t, state.loc.tz) === today; }).map(function (r) { return r.uv; }).filter(num);
    return v.length ? Math.max.apply(null, v) : null;
  }

  function renderWear(c) {
    var adv = X.wearAdvice(c.hourly48.slice(0, 12), uvToday());
    if (!adv) { $('wear').innerHTML = '<p class="hint">' + t('loading') + '</p>'; return; }
    $('wear').innerHTML = '<p class="wear-main">' + t('wear_' + adv.layer) + '</p>' +
      (adv.extras.length ? '<ul class="wear-extras">' + adv.extras.map(function (x) { return '<li>' + t('wx_' + x) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="hint">' + t('wearFeels', { a: I.temp(adv.feelsMin), b: I.temp(adv.feelsMax) }) + '</p>';
  }

  function tile(title, main, sub, cls) {
    return '<div class="tile' + (cls ? ' ' + cls : '') + '"><div class="tile-h">' + title + '</div><div class="tile-v">' + main + '</div>' +
      (sub ? '<div class="tile-s">' + sub + '</div>' : '') + '</div>';
  }

  function renderToday(c) {
    var cur = c.current || {};
    var tz = state.loc.tz;
    var html = '';
    var ci = X.compassIndex(cur.windDir);
    html += tile(t('thWind'), windArrow(cur.windDir) + ' ' + I.wind(cur.wind),
      (ci != null ? t('windFrom', { d: t('compass')[ci] }) : '') + (num(cur.gust) ? (ci != null ? ' · ' : '') + t('gusts', { x: I.wind(cur.gust) }) : ''));
    html += tile(t('humidity'), I.pct(cur.humidity), cur.pressure != null ? t('pressure') + ' ' + Math.round(cur.pressure) + ' hPa' : '');
    var air = state.extra.air && state.extra.air.data;
    var aqiL = air ? X.aqiLevel(air.aqi) : null;
    html += tile(t('air'), aqiL ? '<span class="lvl aqi-' + aqiL + '">' + t('aqi_' + aqiL) + '</span>' : '—',
      air && air.aqi != null ? 'EAQI ' + Math.round(air.aqi) + (air.pm25 != null ? ' · PM2.5 ' + Math.round(air.pm25) : '') : '');
    var uvMax = uvToday();
    var uvL = X.uvLevel(uvMax);
    html += tile(t('uv'), uvL ? '<span class="lvl uv-' + uvL + '">' + Math.round(uvMax) + ' · ' + t('uv_' + uvL) + '</span>' : '—',
      air && air.uv != null ? t('uvMax', { x: Math.round(uvMax) }) : '');
    var s = A.sunTimes(W.dateKey(Date.now(), tz), state.loc.lat, state.loc.lon);
    var sunMain = s.polar ? t(s.polar === 'day' ? 'polarDay' : 'polarNight') :
      '<span class="sun-row">↑ ' + I.time(s.sunrise, tz) + '</span><span class="sun-row">↓ ' + I.time(s.sunset, tz) + '</span>';
    var hrs = Math.floor(s.dayLength / HOUR), mins = Math.round((s.dayLength % HOUR) / 60000);
    html += tile(t('sun'), sunMain, s.polar ? '' : t('dayLength', { h: hrs, m: mins }));
    var m = A.moonPhase(Date.now());
    var toFull = Math.round((m.nextFull - Date.now()) / 86400000);
    html += tile(t('moon'), m.icon + ' ' + t('phase_' + m.key),
      t('illum', { x: Math.round(m.illumination * 100) + '%' }) + ' · ' + (m.key === 'full' ? t('fullToday') : t('fullIn', { n: toFull })));
    $('today').innerHTML = html;
  }

  function ago(at) {
    if (!at) return '';
    var m = Math.round((Date.now() - at) / 60000);
    return m < 1 ? t('justNow') : m < 60 ? t('minAgo', { n: m }) : t('hAgo', { n: Math.round(m / 60) });
  }

  function renderSources(c) {
    var cur = c.current;
    $('sources').innerHTML = activeSources().map(function (src) {
      var r = state.results[src.id] || { status: 'loading' };
      var w = c.weights && c.weights[src.id];
      var head = '<div class="src-head"><i class="swatch" style="background:' + COLORS[src.id] + '"></i>' +
        '<a href="' + src.site + '" target="_blank" rel="noopener">' + esc(src.name) + '</a></div>' +
        '<div class="src-by">' + esc(t('srcBy')[src.id]) + (w ? ' · ' + t('weightLbl', { x: w.toFixed(1) }) : '') + '</div>';
      var d = r.data && r.data.current;
      if (!d) {
        return '<div class="src' + (r.status === 'error' ? ' err' : ' muted') + '">' + head +
          '<p class="src-msg">' + (r.status === 'error' ? esc(r.error) : t('loading')) + '</p></div>';
      }
      var diff = cur && cur.temp != null && d.temp != null ? d.temp - cur.temp : null;
      var diffTxt = diff == null || c.ids.length < 2 ? '' :
        '<span class="diff">' + (Math.abs(diff) < 0.5 ? t('approxConsensus') : (diff > 0 ? '+' : '−') + I.tempDelta(diff)) + '</span>';
      return '<div class="src' + (r.status === 'error' ? ' stale' : '') + '">' + head +
        '<div class="src-main"><span class="src-icon">' + condIcon(d.cond, isNight(Date.now())) + '</span>' +
        '<span class="src-temp">' + I.temp(d.temp) + '</span>' + diffTxt + '</div>' +
        '<div class="src-cond">' + condName(d.cond) + '</div>' +
        '<div class="src-meta">☔ ' + I.pct(d.precipProb) + ' · 💨 ' + I.wind(d.wind) + '</div>' +
        '<div class="src-time">' + (r.status === 'error' ? '⚠ ' + esc(r.error) + ' · ' : '') +
          (r.status === 'loading' ? t('updating') + ' · ' : '') + ago(r.at) + '</div>' +
        '</div>';
    }).join('');
  }

  function renderHourly(c) {
    if (!c.hourly.length) { $('hourly').innerHTML = '<p class="hint">' + t('loading') + '</p>'; return; }
    $('hourly').innerHTML = c.hourly.map(function (h) {
      return '<div class="hour">' +
        '<div class="hour-t">' + hourLabel(h.t) + '</div>' +
        '<div class="hour-i" title="' + condName(h.cond) + '">' + condIcon(h.cond, isNight(h.t)) + '</div>' +
        '<div class="hour-v">' + I.temp(h.temp) + '</div>' +
        '<div class="hour-p">' + (h.precipProb != null && h.precipProb >= 5 ? '☔ ' + I.pct(h.precipProb) : '&nbsp;') + '</div>' +
        '<div class="hour-w">' + windArrow(h.windDir) + ' ' + (num(h.wind) ? I.wind(h.wind).split(' ')[0] : '') + '</div>' +
        '<div class="hour-a">' + agreeDot(h.agreement) + '<span>' + h.sources + '</span></div>' +
        '</div>';
    }).join('');
  }

  function toUnit(c) { return c == null ? null : (I.prefs.temp === 'f' ? c * 9 / 5 + 32 : c); }

  function renderChart(c) {
    var series, labels, tipLabels;
    var sources = activeSources().filter(function (s) { return c.ids.indexOf(s.id) !== -1; });
    if (state.chart === 'hourly') {
      labels = c.hourly.map(function (h) { return I.hourShort(W.localHour(h.t, state.loc.tz)); });
      tipLabels = c.hourly.map(function (h) { return hourLabel(h.t); });
      series = sources.map(function (s) {
        return { name: s.name, color: COLORS[s.id], values: c.hourly.map(function (h) { return h.bySource[s.id] ? toUnit(h.bySource[s.id].temp) : null; }) };
      });
      series.push({ name: t('consensus'), color: CONSENSUS_COLOR, bold: true, values: c.hourly.map(function (h) { return toUnit(h.temp); }) });
    } else {
      labels = c.daily.map(function (d, i) { return i === 0 ? t('today') : t('wdShort')[dateInfo(d.date).wd]; });
      tipLabels = c.daily.map(function (d, i) { var di = dateInfo(d.date); return dayLabel(d.date, i) + ', ' + di.day + ' ' + di.month; });
      series = sources.map(function (s) {
        return { name: s.name, color: COLORS[s.id], values: c.daily.map(function (d) { return d.bySource[s.id] ? toUnit(d.bySource[s.id].tmax) : null; }) };
      });
      series.push({ name: t('consensus'), color: CONSENSUS_COLOR, bold: true, values: c.daily.map(function (d) { return toUnit(d.tmax); }) });
    }
    window.LineChart.render($('chart'), { labels: labels, tipLabels: tipLabels, series: series,
      title: state.chart === 'hourly' ? t('chartTitle24') : t('chartTitle7'), empty: t('noChartData') });
    $('legend').innerHTML = series.slice().reverse().map(function (s) {
      return '<span class="lg' + (s.bold ? ' bold' : '') + '"><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
    }).join('');
  }

  var openDays = {};
  function renderDaily(c) {
    if (!c.daily.length) { $('daily').innerHTML = '<p class="hint">' + t('loading') + '</p>'; return; }
    var lo = Math.min.apply(null, c.daily.map(function (d) { return d.tmin == null ? Infinity : d.tmin; }));
    var hi = Math.max.apply(null, c.daily.map(function (d) { return d.tmax == null ? -Infinity : d.tmax; }));
    var span = Math.max(1, hi - lo);
    $('daily').innerHTML = c.daily.map(function (d, i) {
      var di = dateInfo(d.date);
      var left = d.tmin == null ? 0 : ((d.tmin - lo) / span) * 100;
      var right = d.tmax == null ? 100 : ((d.tmax - lo) / span) * 100;
      var details = activeSources().filter(function (s) { return d.bySource[s.id]; }).map(function (s) {
        var x = d.bySource[s.id];
        return '<tr><td><i class="swatch" style="background:' + COLORS[s.id] + '"></i>' + esc(s.name) + '</td>' +
          '<td>' + condIcon(x.cond) + ' <span class="hide-sm">' + condName(x.cond) + '</span></td>' +
          '<td>' + I.temp(x.tmin) + ' / ' + I.temp(x.tmax) + '</td><td>' + I.pct(x.precipProb) + '</td>' +
          '<td>' + I.mm(x.precip) + '</td><td>' + I.wind(x.wind) + '</td></tr>';
      }).join('');
      return '<details class="day"' + (openDays[d.date] ? ' open' : '') + ' data-date="' + d.date + '">' +
        '<summary>' +
          '<span class="day-name"><b>' + dayLabel(d.date, i) + '</b><small>' + di.day + ' ' + di.month + '</small></span>' +
          '<span class="day-icon" title="' + condName(d.cond) + '">' + condIcon(d.cond) + '</span>' +
          '<span class="day-p">' + (d.precipProb != null && d.precipProb >= 5 ? '☔ ' + I.pct(d.precipProb) : '') + '</span>' +
          '<span class="day-range"><span class="t-lo">' + I.temp(d.tmin) + '</span>' +
            '<span class="bar"><span style="left:' + left + '%;right:' + (100 - right) + '%"></span></span>' +
            '<span class="t-hi">' + I.temp(d.tmax) + '</span></span>' +
          '<span class="day-a">' + agreeDot(d.agreement) + '</span>' +
        '</summary>' +
        '<div class="day-body">' +
          '<p class="hint">' + condName(d.cond) + ' · ' + agreeBadge(d.agreement) + ' · ' + t('sources', { n: d.sources }) + ' · ' +
            t('precipLbl', { x: I.mm(d.precip) }) + ' · ' + t('windLbl', { x: I.wind(d.wind) }) + '</p>' +
          '<div class="table-wrap"><table><thead><tr><th>' + t('thSource') + '</th><th>' + t('thWeather') + '</th><th>' + t('thMinMax') +
            '</th><th>☔</th><th>' + t('thPrecip') + '</th><th>' + t('thWind') + '</th></tr></thead>' +
          '<tbody>' + details + '</tbody></table></div>' +
        '</div></details>';
    }).join('');
  }

  function renderBest(c) {
    if (!c.daily.length) { $('best').innerHTML = '<p class="hint">' + t('loading') + '</p>'; return; }
    var best = X.bestDays(c.daily);
    $('best').innerHTML = X.ACTIVITIES.map(function (k) {
      var b = best[k];
      var d = b ? c.daily[b.index] : null;
      return '<div class="best-row"><span class="best-act">' + t('act_' + k) + '</span>' +
        (b ? '<span class="best-day"><b>' + dayLabel(b.date, b.index) + '</b> ' + condIcon(d.cond) + ' ' + I.temp(d.tmax) + '</span>' +
          '<span class="meter" title="' + t('score', { n: b.score }) + '"><span style="width:' + b.score + '%"></span></span>'
          : '<span class="best-day muted-text">' + t('noGoodDay') + '</span><span></span>') +
        '</div>';
    }).join('');
  }

  /* ---------- მხარდაჭერა და სპონსორობა ---------- */

  function renderSupport() {
    var cfg = window.APP_CONFIG || {};
    var links = (cfg.donate || []).filter(function (d) { return d && /^https:\/\//.test(d.url); });
    var email = cfg.contactEmail || '';
    $('support-card').classList.toggle('hidden', !links.length && !email);
    var html = '';
    if (links.length) {
      html += '<p>' + t('supportText') + '</p><div class="support-links">' + links.map(function (d) {
        return '<a class="btn" href="' + esc(d.url) + '" target="_blank" rel="noopener">☕ ' + esc(d.label || t('supportBtn')) + '</a>';
      }).join('') + '</div>';
    }
    if (email) {
      html += '<div class="sponsor"><b>' + t('sponsorTitle') + '</b><p class="hint">' + t('sponsorText') + '</p>' +
        '<div class="email-row"><a href="mailto:' + esc(email) + '" class="email" id="contact-email">' + esc(email) + '</a>' +
        '<button type="button" class="btn ghost" id="copy-email">' + t('copyEmail') + '</button></div></div>';
    }
    $('support').innerHTML = html;
  }

  function copyEmail() {
    var email = (window.APP_CONFIG || {}).contactEmail || '';
    function fallback() {
      var range = document.createRange();
      range.selectNodeContents($('contact-email'));
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).then(function () { toast(t('copied')); }, fallback);
    } else fallback();
  }

  /* ---------- გზა და მთა ---------- */

  function riskValue(r) {
    if (r.type === 'fog') return I.distance(r.value);
    if (r.type === 'snow') return I.cm(r.value);
    if (r.type === 'heavyRain') return I.mm(r.value);
    if (r.type === 'wind') return I.wind(r.value);
    return I.temp(r.value);
  }

  function renderRoad(c) {
    if (!c.hourly48.length) { $('road').innerHTML = '<p class="hint">' + t('loading') + '</p>'; return; }
    var det = state.extra.details && state.extra.details.data;
    var r = X.roadRisk(c.hourly48.slice(0, 12), det);
    $('road').innerHTML = '<p class="status ' + r.level + '">' + t('road_' + r.level) + '</p>' +
      (r.risks.length ? '<ul class="risk-list">' + r.risks.map(function (x) {
        return '<li class="' + x.level + '">' + esc(t('rk_' + x.type, { x: riskValue(x) })) + '</li>';
      }).join('') + '</ul>' : '');
  }

  function renderPlaces() {
    var pl = state.extra.places;
    if (!pl || !pl.data) {
      var msg = pl && pl.status === 'error' ? esc(pl.error) : t('loading');
      $('passes').innerHTML = $('resorts').innerHTML = '<p class="hint">' + msg + '</p>';
      return;
    }
    var now = Date.now();
    $('passes').innerHTML = E.PASSES.map(function (p) {
      var place = pl.data[p.id];
      var s = place ? X.passStatus(place, now) : null;
      if (!s) return '';
      var bits = [t('passMin', { x: I.temp(s.minT) })];
      if (s.snow >= 0.5) bits.push(t('passSnow', { x: I.cm(s.snow) }));
      if (num(s.visibility) && s.visibility < 2000) bits.push(t('passVis', { x: I.distance(s.visibility) }));
      if (num(s.gust) && s.gust >= 12) bits.push(t('gusts', { x: I.wind(s.gust) }));
      if (s.icy) bits.push(t('passIcy'));
      return '<div class="place"><div class="place-h"><b>' + t('p_' + p.id) + '</b><span class="badge ' + s.level + '">' + t('pass_' + s.level) + '</span></div>' +
        '<div class="place-s">' + esc(p.road) + (num(s.elevation) ? ' · ' + t('elev', { x: Math.round(s.elevation) }) : '') + '</div>' +
        '<div class="place-d">' + bits.join(' · ') + '</div></div>';
    }).join('');
    $('resorts').innerHTML = E.RESORTS.map(function (r) {
      var place = pl.data[r.id];
      if (!place) return '';
      var cur = place.hourly.filter(function (x) { return x.t <= now; }).slice(-1)[0] || place.hourly[0] || {};
      var depth = num(cur.snowDepth) ? cur.snowDepth * 100 : null;
      var fresh = place.daily.reduce(function (s, d) { return s + (num(d.snowfall) ? d.snowfall : 0); }, 0);
      var d0 = place.daily[0] || {};
      return '<div class="place"><div class="place-h"><b>' + t('r_' + r.id) + '</b><span>' + I.temp(d0.tmin) + ' / ' + I.temp(d0.tmax) + '</span></div>' +
        '<div class="place-s">' + (num(place.elevation) ? t('elev', { x: Math.round(place.elevation) }) : '') + '</div>' +
        '<div class="place-d">❄ ' + t('resortLine', { d: I.cm(depth), n: I.cm(fresh) }) + '</div></div>';
    }).join('');
  }

  function renderMountain(c) {
    var det = state.extra.details && state.extra.details.data;
    if (!det) { $('mountain').innerHTML = '<p class="hint">' + t('loading') + '</p>'; return; }
    var m = X.mountainSummary(det, Date.now());
    if (!m || !m.relevant) { $('mountain').innerHTML = '<p class="hint">' + t('mountainLow') + '</p>'; return; }
    var html = '<div class="tiles">' +
      tile(t('elevationLbl'), num(m.elevation) ? t('elev', { x: Math.round(m.elevation) }) : '—') +
      tile(t('snowDepth'), I.cm(m.snowDepth)) +
      tile(t('newSnow24'), I.cm(m.newSnow24)) +
      tile(t('newSnow72'), I.cm(m.newSnow72)) +
      tile(t('fallen24'), I.cm(m.fallen24)) +
      tile(t('freezing'), m.freezing != null ? t('elev', { x: Math.round(m.freezing / 50) * 50 }) : '—') +
      '</div>';
    var cur = c.current;
    if (cur && num(cur.temp) && num(m.elevation)) {
      var levels = [1000, 1500, 2000, 2500, 3000, 3500].filter(function (h) { return h > m.elevation + 200; }).slice(0, 4);
      if (levels.length) {
        html += '<h3 class="sub-h">' + t('altTemps') + '</h3><div class="alt">' +
          '<span><b>' + I.temp(cur.temp) + '</b><small>' + t('elev', { x: Math.round(m.elevation) }) + '</small></span>' +
          levels.map(function (h) {
            return '<span><b>' + I.temp(X.tempAtAltitude(cur.temp, m.elevation, h)) + '</b><small>' + t('elev', { x: h }) + '</small></span>';
          }).join('') + '</div>';
      }
    }
    $('mountain').innerHTML = html;
  }

  /* ---------- სიზუსტე და ისტორია ---------- */

  function renderAccuracy(c) {
    var acc = state.extra.accuracy;
    var scores = c.scores;
    if (!scores) {
      $('accuracy').innerHTML = '<p class="hint">' + (acc && acc.status === 'error' ? t('accFail') : t('loading')) + '</p>';
      return;
    }
    var rows = P.SOURCES.map(function (s) { return { s: s, sc: scores[s.id] }; });
    var known = rows.filter(function (r) { return r.sc; }).sort(function (a, b) { return a.sc.mae - b.sc.mae; });
    var maxMae = known.length ? Math.max.apply(null, known.map(function (r) { return r.sc.mae; })) : 1;
    var list = known.concat(rows.filter(function (r) { return !r.sc; }));
    $('accuracy').innerHTML = '<div class="acc">' + list.map(function (r, i) {
      var w = c.weights && c.weights[r.s.id];
      return '<div class="acc-row"><span class="acc-name"><i class="swatch" style="background:' + COLORS[r.s.id] + '"></i>' + esc(r.s.name) +
        (i === 0 && r.sc ? ' <span class="tag">' + t('accBest') + '</span>' : '') + '</span>' +
        (r.sc ? '<span class="acc-bar"><span style="width:' + Math.max(8, (r.sc.mae / maxMae) * 100) + '%;background:' + COLORS[r.s.id] + '"></span></span>' +
          '<span class="acc-v">' + t('accError', { x: I.tempDelta(r.sc.mae) }) + (w ? ' · ' + t('weightLbl', { x: w.toFixed(1) }) : '') + '</span>'
          : '<span class="acc-v muted-text">' + t('accNone') + '</span>') +
        '</div>';
    }).join('') + '</div>' +
      (!scores.yr ? '<p class="hint">' + t('accYrNote') + '</p>' : '') +
      '<p class="hint">' + (c.weights ? t('accWeighting') : t('accEqual')) + '</p>';
  }

  function renderHistory(c) {
    var h = state.extra.history;
    var d = historyToday();
    if (!d) { $('history').innerHTML = '<p class="hint">' + (h && h.status === 'error' ? t('histFail') : t('loading')) + '</p>'; return; }
    var today = c.daily[0];
    var cmp = '';
    if (today && num(today.tmax) && num(d.normHi)) {
      var diff = today.tmax - d.normHi;
      cmp = Math.abs(diff) < 1.5 ? t('histAtNormal') : t('histToday', { d: I.tempDelta(diff), w: diff > 0 ? t('warmer') : t('colder') });
    }
    var years = h && h.data && h.data.years;
    $('history').innerHTML = '<div class="tiles">' +
      tile(t('histNormal'), I.temp(d.normLo) + ' / ' + I.temp(d.normHi)) +
      tile(t('histRecHi'), d.recHi ? I.temp(d.recHi.v) : '—', d.recHi ? t('histYear', { y: d.recHi.y }) : '', 'warm') +
      tile(t('histRecLo'), d.recLo ? I.temp(d.recLo.v) : '—', d.recLo ? t('histYear', { y: d.recLo.y }) : '', 'cold') +
      '</div>' + (cmp ? '<p class="hist-cmp">' + cmp + '</p>' : '') +
      (years ? '<p class="hint">' + t('histSource', { a: years[0], b: years[1] }) + '</p>' : '');
  }

  /* ---------- შეტყობინებები და გაზიარება ---------- */

  function notifyContext(c) {
    return {
      enabled: prefs.notify, loc: state.loc, hourly: c.hourly48, alerts: c.hourly48.length ? currentAlerts(c) : [],
      placeName: $('place-name').textContent, text: function (a) { return alertText(a); }, t: t,
      time: function (ms) { return I.time(ms, state.loc.tz); }
    };
  }

  function doShare() {
    var c = state.lastCompute || compute();
    if (!c.current) return;
    var adv = X.wearAdvice(c.hourly48.slice(0, 12), uvToday());
    window.WeatherShare.share({
      place: $('place-name').textContent,
      date: whenLabel(W.dateKey(Date.now(), state.loc.tz)),
      icon: condIcon(c.current.cond, isNight(Date.now())),
      temp: I.temp(c.current.temp),
      cond: condName(c.current.cond),
      feels: t('feels', { t: I.temp(X.feelsLike(c.current.temp, c.current.humidity, c.current.wind)) }),
      range: c.daily[0] ? I.temp(c.daily[0].tmin) + ' / ' + I.temp(c.daily[0].tmax) : '',
      wear: adv ? t('wear_' + adv.layer) : '',
      days: c.daily.slice(1, 4).map(function (d, i) {
        return { label: dayLabel(d.date, i + 1), icon: condIcon(d.cond), range: I.temp(d.tmin) + ' / ' + I.temp(d.tmax) };
      }),
      sources: t('sources', { n: c.current.sources }),
      app: t('appName'),
      text: t('shareText', { place: $('place-name').textContent, t: I.temp(c.current.temp), c: condName(c.current.cond) })
    }).then(function (res) { if (res === 'saved') toast(t('shareSaved')); }, function () { toast(t('shareFail')); });
  }

  /* ---------- ძებნა, GPS, ფავორიტები ---------- */

  var DEFAULT_GPS_NAME = '__gps__';

  function setLocation(loc) {
    state.loc = loc;
    save(LOC_KEY, loc);
    state.results = {};
    state.extra = {};
    hideResults();
    loadAll(false);
    if (state.tab === 'map' && window.WeatherMap) window.WeatherMap.center(loc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideResults() {
    $('search-results').classList.add('hidden');
    $('search-msg').classList.add('hidden');
  }

  function search(q) {
    var msg = $('search-msg');
    msg.textContent = t('searching');
    msg.classList.remove('hidden');
    var url = 'https://geocoding-api.open-meteo.com/v1/search?count=8&format=json&language=' + I.prefs.lang + '&name=' + encodeURIComponent(q);
    get(url).then(function (json) {
      var list = (json.results || []);
      if (!list.length) { msg.textContent = t('notFound'); return; }
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
    }, function (e) { msg.textContent = t('searchFailed', { e: e.message }); });
  }

  function useGps() {
    if (!navigator.geolocation) { toast(t('gpsNA')); return; }
    toast(t('gpsWait'));
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var loc = { name: DEFAULT_GPS_NAME, admin: '', country: '', lat: lat, lon: lon,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone, gps: true };
      setLocation(loc);
      // ქალაქის სახელი (უფასო, გასაღების გარეშე)
      get('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=' + I.prefs.lang + '&latitude=' + lat + '&longitude=' + lon)
        .then(function (r) {
          if (state.loc !== loc) return;
          loc.name = r.city || r.locality || loc.name;
          loc.country = r.countryName || '';
          save(LOC_KEY, loc);
          renderPlace();
        }, function () { /* სახელი არასავალდებულოა */ });
    }, function (err) {
      toast(err.code === 1 ? t('gpsDenied') : t('gpsFail'));
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60000 });
  }

  function sameLoc(a, b) { return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01; }
  function isFavorite(loc) { return state.favorites.some(function (f) { return sameLoc(f, loc); }); }

  function toggleFavorite() {
    if (isFavorite(state.loc)) {
      state.favorites = state.favorites.filter(function (f) { return !sameLoc(f, state.loc); });
    } else {
      var f = {};
      ['name', 'admin', 'country', 'lat', 'lon', 'tz', 'gps', 'isDefault'].forEach(function (k) { f[k] = state.loc[k]; });
      state.favorites.push(f);
    }
    save(FAV_KEY, state.favorites);
    renderPlace();
  }

  // ნაგულისხმევი ქალაქი და „ჩემი მდებარეობა“ არჩეულ ენაზე
  function placeName(loc) {
    if (loc.isDefault) return t('defaultCity');
    if (loc.name === DEFAULT_GPS_NAME) return t('myLocation');
    return loc.name;
  }

  function renderFavorites() {
    var el = $('favorites');
    if (!state.favorites.length) {
      el.innerHTML = '<span class="hint">' + t('favHint') + '</span>';
      return;
    }
    el.innerHTML = state.favorites.map(function (f, i) {
      return '<button type="button" class="chip' + (sameLoc(f, state.loc) ? ' active' : '') + '" data-fav="' + i + '">' +
        esc(placeName(f)) + '</button>';
    }).join('');
  }

  /* ---------- ჩანართები ---------- */

  function switchTab(name) {
    state.tab = name;
    ['home', 'map', 'road', 'accuracy'].forEach(function (n) { $('view-' + n).classList.toggle('hidden', n !== name); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
      b.setAttribute('aria-current', b.getAttribute('data-tab') === name ? 'page' : 'false');
    });
    try { sessionStorage.setItem('wx-tab', name); } catch (e) { /* */ }
    if (name === 'map' && window.WeatherMap) window.WeatherMap.show($('map'), state.loc, get, mapUi);
    loadTabData(false);
    render();
    window.scrollTo({ top: 0 });
  }

  var mapUi = {
    play: function () { return $('map-play'); }, range: function () { return $('map-frame'); }, label: function () { return $('map-time'); },
    t: t, time: function (ms) { return I.time(ms, state.loc.tz); }, fail: function () { toast(t('mapFail')); }
  };

  /* ---------- პარამეტრები ---------- */

  function savePrefs() {
    save(PREFS_KEY, prefs);
    I.setPrefs(prefs);
  }

  function openSettings() {
    var form = $('settings-form');
    ['lang', 'temp', 'wind', 'time'].forEach(function (k) {
      Array.prototype.forEach.call(form.querySelectorAll('input[name="' + k + '"]'), function (r) { r.checked = r.value === prefs[k]; });
    });
    $('set-sources').innerHTML = P.SOURCES.map(function (s) {
      return '<label class="check"><input type="checkbox" data-src="' + s.id + '"' + (prefs.off.indexOf(s.id) === -1 ? ' checked' : '') + '>' +
        '<i class="swatch" style="background:' + COLORS[s.id] + '"></i>' + esc(s.name) + ' <small>' + esc(t('srcBy')[s.id]) + '</small></label>';
    }).join('');
    $('set-weighting').checked = !!prefs.weighting;
    $('set-notify').checked = !!prefs.notify;
    $('notify-status').textContent = window.WeatherNotify ? window.WeatherNotify.statusText(t) : '';
    var dlg = $('settings');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function onSettingsChange(e) {
    var el = e.target;
    if (el.type === 'radio') {
      prefs[el.name] = el.value;
      savePrefs();
      I.apply();
      renderThemeButton();
      render();
      if (el.name === 'lang') openSettingsLabels();
    } else if (el.hasAttribute('data-src')) {
      var id = el.getAttribute('data-src');
      var off = prefs.off.filter(function (x) { return x !== id; });
      if (!el.checked) off.push(id);
      if (off.length >= P.SOURCES.length) { el.checked = true; toast(t('atLeastOne')); return; }
      prefs.off = off;
      savePrefs();
      loadAll(false);
    } else if (el.id === 'set-weighting') {
      prefs.weighting = el.checked;
      savePrefs();
      render();
    } else if (el.id === 'set-notify') {
      if (el.checked && window.WeatherNotify) {
        window.WeatherNotify.enable(state.loc).then(function (ok) {
          prefs.notify = ok;
          el.checked = ok;
          savePrefs();
          $('notify-status').textContent = window.WeatherNotify.statusText(t);
          if (ok) toast(t('notifyOn'));
        });
      } else {
        prefs.notify = false;
        savePrefs();
        if (window.WeatherNotify) window.WeatherNotify.disable();
        $('notify-status').textContent = '';
      }
    }
  }

  // ენის შეცვლისას დიალოგის წყაროების სიაც ახალ ენაზე
  function openSettingsLabels() {
    Array.prototype.forEach.call($('set-sources').querySelectorAll('small'), function (s, i) { s.textContent = t('srcBy')[P.SOURCES[i].id]; });
    $('notify-status').textContent = window.WeatherNotify && prefs.notify ? window.WeatherNotify.statusText(t) : '';
  }

  /* ---------- თემა: ღია / მუქი ---------- */

  function currentTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function renderThemeButton() {
    var dark = currentTheme() === 'dark';
    var btn = $('theme-toggle');
    btn.textContent = dark ? '☀' : '☾';
    btn.title = dark ? t('themeLight') : t('themeDark');
    btn.setAttribute('aria-label', btn.title);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#ffffff');
    if (window.WeatherMap) window.WeatherMap.setTheme(dark);
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* */ }
    renderThemeButton();
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
  $('share').addEventListener('click', doShare);
  $('support').addEventListener('click', function (e) { if (e.target.id === 'copy-email') copyEmail(); });
  $('favorites').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fav]');
    if (b) setLocation(state.favorites[Number(b.getAttribute('data-fav'))]);
  });
  $('theme-toggle').addEventListener('click', toggleTheme);
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', renderThemeButton);
  }
  $('refresh').addEventListener('click', function () { loadAll(true); toast(t('refreshing')); });
  $('open-settings').addEventListener('click', openSettings);
  $('settings-form').addEventListener('change', onSettingsChange);
  Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) {
    b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-chart]'), function (b) {
    b.addEventListener('click', function () {
      state.chart = b.getAttribute('data-chart');
      document.querySelectorAll('[data-chart]').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderChart(state.lastCompute || compute());
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-layer]'), function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-layer]').forEach(function (x) { x.classList.toggle('active', x === b); });
      if (window.WeatherMap) window.WeatherMap.setLayer(b.getAttribute('data-layer'));
    });
  });
  $('daily').addEventListener('toggle', function (e) {
    var d = e.target.closest && e.target.closest('details[data-date]');
    if (d) openDays[d.getAttribute('data-date')] = d.open;
  }, true);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.tab === 'home') renderChart(state.lastCompute || compute()); }, 150);
  });
  // აპში დაბრუნებისას ვაახლებთ, თუ ქეში მოძველდა
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadAll(false); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* PWA არასავალდებულოა */ });
  }

  I.apply();
  renderThemeButton();
  var savedTab = null;
  try { savedTab = sessionStorage.getItem('wx-tab'); } catch (e) { /* */ }
  if (savedTab && savedTab !== 'home' && $('view-' + savedTab)) switchTab(savedTab);
  loadAll(false);
})();
