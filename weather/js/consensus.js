/*
 * ამინდის წყაროების გაერთიანება: პირობების ნორმალიზაცია და საერთო („საშუალო“) პროგნოზი.
 * UI-სგან დამოუკიდებელია — მუშაობს ბრაუზერში (window.WeatherConsensus) და Node-ში (module.exports).
 */
(function (root) {
  'use strict';

  var HOUR = 3600 * 1000;

  // ერთიანი ამინდის კატეგორიები. index — „სიმძიმე“, ფრის შემთხვევაში გამოიყენება.
  var CONDITIONS = {
    clear:     { index: 0, name: 'მზიანი',            icon: '☀️', night: '🌙' },
    partly:    { index: 1, name: 'ცვალებადი ღრუბელი', icon: '🌤️', night: '🌙' },
    cloudy:    { index: 2, name: 'მოღრუბლული',        icon: '☁️' },
    fog:       { index: 3, name: 'ნისლი',             icon: '🌫️' },
    lightrain: { index: 4, name: 'მსუბუქი წვიმა',     icon: '🌦️' },
    rain:      { index: 5, name: 'წვიმა',             icon: '🌧️' },
    heavyrain: { index: 6, name: 'ძლიერი წვიმა',      icon: '🌧️' },
    sleet:     { index: 7, name: 'თოვჭყაპი',          icon: '🌨️' },
    snow:      { index: 8, name: 'თოვლი',             icon: '❄️' },
    thunder:   { index: 9, name: 'ჭექა-ქუხილი',       icon: '⛈️' }
  };
  var COND_BY_INDEX = Object.keys(CONDITIONS).sort(function (a, b) {
    return CONDITIONS[a].index - CONDITIONS[b].index;
  });
  var WET = { lightrain: 1, rain: 1, heavyrain: 1, sleet: 1, snow: 1, thunder: 1 };

  /* ---------- წყაროების კოდების გადაყვანა ერთიან კატეგორიებში ---------- */

  // yr.no / MET Norway: symbol_code, მაგ. "lightrainshowers_day"
  function fromYr(code) {
    if (!code) return null;
    var c = String(code).replace(/_(day|night|polartwilight)$/, '');
    if (c.indexOf('thunder') !== -1) return 'thunder';
    if (c.indexOf('sleet') !== -1) return 'sleet';
    if (c.indexOf('snow') !== -1) return 'snow';
    if (c.indexOf('rain') !== -1) {
      if (c.indexOf('light') === 0) return 'lightrain';
      if (c.indexOf('heavy') === 0) return 'heavyrain';
      return 'rain';
    }
    if (c === 'clearsky') return 'clear';
    if (c === 'fair' || c === 'partlycloudy') return 'partly';
    if (c === 'cloudy') return 'cloudy';
    if (c === 'fog') return 'fog';
    return null;
  }

  // Open-Meteo: WMO weather code
  function fromWmo(code) {
    if (code == null) return null;
    var n = Number(code);
    if (n === 0) return 'clear';
    if (n === 1 || n === 2) return 'partly';
    if (n === 3) return 'cloudy';
    if (n === 45 || n === 48) return 'fog';
    if (n === 56 || n === 57 || n === 66 || n === 67) return 'sleet';
    if ((n >= 51 && n <= 55) || n === 61 || n === 80) return 'lightrain';
    if (n === 63 || n === 81) return 'rain';
    if (n === 65 || n === 82) return 'heavyrain';
    if ((n >= 71 && n <= 77) || n === 85 || n === 86) return 'snow';
    if (n >= 95 && n <= 99) return 'thunder';
    return null;
  }

  // OpenWeatherMap: weather[].id
  function fromOwm(id) {
    if (id == null) return null;
    var n = Number(id);
    if (n >= 200 && n < 300) return 'thunder';
    if (n >= 300 && n < 400) return 'lightrain';
    if (n === 500 || n === 520) return 'lightrain';
    if (n === 501 || n === 521) return 'rain';
    if ((n >= 502 && n <= 504) || n === 522 || n === 531) return 'heavyrain';
    if (n === 511) return 'sleet';
    if (n >= 611 && n <= 616) return 'sleet';
    if (n >= 600 && n < 700) return 'snow';
    if (n >= 700 && n < 800) return 'fog';
    if (n === 800) return 'clear';
    if (n === 801 || n === 802) return 'partly';
    if (n === 803 || n === 804) return 'cloudy';
    return null;
  }

  // AccuWeather: WeatherIcon 1–44
  var ACCU = {
    1: 'clear', 2: 'clear', 3: 'partly', 4: 'partly', 5: 'partly', 6: 'cloudy', 7: 'cloudy', 8: 'cloudy',
    11: 'fog', 12: 'rain', 13: 'lightrain', 14: 'lightrain', 15: 'thunder', 16: 'thunder', 17: 'thunder',
    18: 'rain', 19: 'snow', 20: 'snow', 21: 'snow', 22: 'snow', 23: 'snow', 24: 'sleet', 25: 'sleet',
    26: 'sleet', 29: 'sleet', 30: 'clear', 31: 'clear', 32: 'partly', 33: 'clear', 34: 'clear',
    35: 'partly', 36: 'partly', 37: 'partly', 38: 'cloudy', 39: 'lightrain', 40: 'rain', 41: 'thunder',
    42: 'thunder', 43: 'snow', 44: 'snow'
  };
  function fromAccu(icon) { return icon == null ? null : (ACCU[Number(icon)] || null); }

  // weather.com (The Weather Company): iconCode 0–47
  var TWC = {
    0: 'thunder', 1: 'thunder', 2: 'thunder', 3: 'thunder', 4: 'thunder', 5: 'sleet', 6: 'sleet',
    7: 'sleet', 8: 'sleet', 9: 'lightrain', 10: 'sleet', 11: 'rain', 12: 'rain', 13: 'snow', 14: 'snow',
    15: 'snow', 16: 'snow', 17: 'sleet', 18: 'sleet', 19: 'fog', 20: 'fog', 21: 'fog', 22: 'fog',
    23: 'partly', 24: 'partly', 25: 'clear', 26: 'cloudy', 27: 'cloudy', 28: 'cloudy', 29: 'partly',
    30: 'partly', 31: 'clear', 32: 'clear', 33: 'clear', 34: 'clear', 35: 'rain', 36: 'clear',
    37: 'thunder', 38: 'thunder', 39: 'lightrain', 40: 'heavyrain', 41: 'snow', 42: 'snow', 43: 'snow',
    45: 'lightrain', 46: 'snow', 47: 'thunder'
  };
  function fromTwc(icon) { return icon == null ? null : (TWC[Number(icon)] || null); }

  /* ---------- დრო და თარიღები კონკრეტული ქალაქის დროის სარტყელში ---------- */

  var fmtCache = {};
  function partsFmt(tz) {
    if (!fmtCache[tz]) {
      fmtCache[tz] = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
      });
    }
    return fmtCache[tz];
  }
  function localParts(ms, tz) {
    var out = {};
    partsFmt(tz).formatToParts(new Date(ms)).forEach(function (p) { out[p.type] = p.value; });
    return { date: out.year + '-' + out.month + '-' + out.day, hour: Number(out.hour) % 24 };
  }
  function dateKey(ms, tz) { return localParts(ms, tz).date; }
  function localHour(ms, tz) { return localParts(ms, tz).hour; }

  /* ---------- სტატისტიკა ---------- */

  function nums(values) {
    return values.filter(function (v) { return typeof v === 'number' && isFinite(v); });
  }
  function median(values) {
    var v = nums(values).sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    var m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  function mean(values) {
    var v = nums(values);
    if (!v.length) return null;
    return v.reduce(function (s, x) { return s + x; }, 0) / v.length;
  }
  function spread(values) {
    var v = nums(values);
    if (v.length < 2) return 0;
    return Math.max.apply(null, v) - Math.min.apply(null, v);
  }

  /**
   * ხმათა უმრავლესობა. ფრის შემთხვევაში იმარჯვებს ის კატეგორია, რომელიც
   * ყველა ხმის „სიმძიმის“ მედიანასთან ყველაზე ახლოსაა.
   * აბრუნებს { cond, share } — share: რა წილმა მისცა ხმა გამარჯვებულს.
   */
  function vote(conds) {
    var list = conds.filter(function (c) { return c && CONDITIONS[c]; });
    if (!list.length) return { cond: null, share: 0 };
    var counts = {};
    list.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    var best = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }));
    var tied = Object.keys(counts).filter(function (k) { return counts[k] === best; });
    var mid = median(list.map(function (c) { return CONDITIONS[c].index; }));
    tied.sort(function (a, b) {
      var da = Math.abs(CONDITIONS[a].index - mid), db = Math.abs(CONDITIONS[b].index - mid);
      return da - db || CONDITIONS[b].index - CONDITIONS[a].index;
    });
    return { cond: tied[0], share: best / list.length };
  }

  /**
   * დღის ზოგადი პირობა საათობრივი პირობებიდან (დღისით 07–20 სთ, თუ ასეთი არ არის — ყველა).
   * თუ ნალექიანი საათები ≥25%-ია, ვირჩევთ ყველაზე ხშირ ნალექის ტიპს.
   */
  function dailyCond(points, tz) {
    var day = points.filter(function (p) { var h = localHour(p.t, tz); return h >= 7 && h <= 20; });
    var use = (day.length ? day : points).map(function (p) { return p.cond; }).filter(Boolean);
    if (!use.length) return null;
    var wet = use.filter(function (c) { return WET[c]; });
    if (wet.length && wet.length / use.length >= 0.25) return vote(wet).cond;
    return vote(use).cond;
  }

  /**
   * საათობრივი/სამსაათიანი წერტილებიდან დღიური შეჯამება.
   * წერტილი: { t, temp, cond, precip (მმ ამ ინტერვალში), precipProb, wind }
   */
  function aggregateDaily(points, tz) {
    var byDay = {};
    var order = [];
    points.forEach(function (p) {
      var k = dateKey(p.t, tz);
      if (!byDay[k]) { byDay[k] = []; order.push(k); }
      byDay[k].push(p);
    });
    return order.map(function (k) {
      var ps = byDay[k];
      var temps = nums(ps.map(function (p) { return p.temp; }));
      var precips = nums(ps.map(function (p) { return p.precip; }));
      var probs = nums(ps.map(function (p) { return p.precipProb; }));
      var winds = nums(ps.map(function (p) { return p.wind; }));
      return {
        date: k,
        tmin: temps.length ? Math.min.apply(null, temps) : null,
        tmax: temps.length ? Math.max.apply(null, temps) : null,
        cond: dailyCond(ps, tz),
        precip: precips.length ? precips.reduce(function (s, x) { return s + x; }, 0) : null,
        precipProb: probs.length ? Math.max.apply(null, probs) : null,
        wind: winds.length ? Math.max.apply(null, winds) : null,
        samples: ps.length
      };
    });
  }

  /** სერიიდან ყველაზე ახლო წერტილი t მომენტისთვის (maxGap ფარგლებში). */
  function pointAt(series, t, maxGapMs) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < series.length; i++) {
      var d = Math.abs(series[i].t - t);
      if (d < bestD) { bestD = d; best = series[i]; }
    }
    return bestD <= (maxGapMs == null ? 1.5 * HOUR : maxGapMs) ? best : null;
  }

  /* ---------- შეთანხმების დონე ---------- */

  // 2 = მაღალი, 1 = საშუალო, 0 = დაბალი
  function levelFor(value, high, mid) {
    if (value <= high) return 2;
    if (value <= mid) return 1;
    return 0;
  }
  // დღიური მინ/მაქს წყაროებს შორის ბუნებრივად უფრო მეტად განსხვავდება, ვიდრე მიმდინარე ტემპერატურა
  var DAILY_TEMP_LIMITS = [3, 6];
  var AGREEMENT = [
    { key: 'low', name: 'დაბალი' },
    { key: 'mid', name: 'საშუალო' },
    { key: 'high', name: 'მაღალი' }
  ];

  /**
   * შეთანხმება: ტემპერატურის გაბნევა (°C; ზღვრები tempLimits, ნაგულისხმევად 2°/4°),
   * პირობის ხმათა წილი და ნალექის ალბათობის გაბნევა.
   * საბოლოო დონე — ყველაზე სუსტი მათ შორის.
   */
  function agreement(tempSpread, condShare, probSpread, sources, tempLimits) {
    if (sources < 2) return { level: null, key: 'single', name: 'ერთი წყარო' };
    var tl = tempLimits || [2, 4];
    var lv = Math.min(
      levelFor(tempSpread, tl[0], tl[1]),
      condShare >= 0.75 ? 2 : condShare >= 0.5 ? 1 : 0,
      probSpread == null ? 2 : levelFor(probSpread, 25, 50)
    );
    return { level: lv, key: AGREEMENT[lv].key, name: AGREEMENT[lv].name };
  }

  /* ---------- საერთო პროგნოზი ---------- */

  function combineCurrent(items) {
    var list = items.filter(Boolean);
    if (!list.length) return null;
    var temps = list.map(function (x) { return x.temp; });
    var probs = list.map(function (x) { return x.precipProb; });
    var v = vote(list.map(function (x) { return x.cond; }));
    return {
      temp: median(temps),
      cond: v.cond,
      humidity: median(list.map(function (x) { return x.humidity; })),
      wind: median(list.map(function (x) { return x.wind; })),
      pressure: median(list.map(function (x) { return x.pressure; })),
      precipProb: mean(probs),
      tempMin: nums(temps).length ? Math.min.apply(null, nums(temps)) : null,
      tempMax: nums(temps).length ? Math.max.apply(null, nums(temps)) : null,
      sources: nums(temps).length,
      agreement: agreement(spread(temps), v.share, nums(probs).length > 1 ? spread(probs) : null, nums(temps).length)
    };
  }

  /**
   * საათობრივი საერთო პროგნოზი: hours — დროის მომენტები (ms),
   * seriesById — { id: [hourlyPoint...] }.
   */
  function combineHourly(hours, seriesById) {
    var ids = Object.keys(seriesById);
    return hours.map(function (t) {
      var by = {};
      ids.forEach(function (id) {
        var s = seriesById[id];
        if (!s || !s.length) return;
        // სამსაათიან სერიებს (OpenWeatherMap) უფრო დიდი ფანჯარა სჭირდება
        var step = s.length > 1 ? s[1].t - s[0].t : HOUR;
        var p = pointAt(s, t, Math.max(HOUR, step) / 2 + 1);
        if (p) by[id] = p;
      });
      var ps = Object.keys(by).map(function (id) { return by[id]; });
      var temps = ps.map(function (p) { return p.temp; });
      var probs = ps.map(function (p) { return p.precipProb; });
      var v = vote(ps.map(function (p) { return p.cond; }));
      return {
        t: t,
        temp: median(temps),
        cond: v.cond,
        precipProb: mean(probs),
        wind: median(ps.map(function (p) { return p.wind; })),
        bySource: by,
        sources: nums(temps).length,
        agreement: agreement(spread(temps), v.share, nums(probs).length > 1 ? spread(probs) : null, nums(temps).length)
      };
    });
  }

  /** დღიური საერთო პროგნოზი: dailyById — { id: [dailyPoint...] } */
  function combineDaily(dates, dailyById) {
    var ids = Object.keys(dailyById);
    return dates.map(function (date) {
      var by = {};
      ids.forEach(function (id) {
        var d = (dailyById[id] || []).filter(function (x) { return x.date === date; })[0];
        if (d) by[id] = d;
      });
      var ds = Object.keys(by).map(function (id) { return by[id]; });
      var tmaxs = ds.map(function (d) { return d.tmax; });
      var tmins = ds.map(function (d) { return d.tmin; });
      var probs = ds.map(function (d) { return d.precipProb; });
      var v = vote(ds.map(function (d) { return d.cond; }));
      var n = Math.max(nums(tmaxs).length, nums(tmins).length);
      return {
        date: date,
        tmax: median(tmaxs),
        tmin: median(tmins),
        cond: v.cond,
        precipProb: mean(probs),
        precip: median(ds.map(function (d) { return d.precip; })),
        wind: median(ds.map(function (d) { return d.wind; })),
        bySource: by,
        sources: n,
        agreement: agreement(Math.max(spread(tmaxs), spread(tmins)), v.share,
          nums(probs).length > 1 ? spread(probs) : null, n, DAILY_TEMP_LIMITS)
      };
    });
  }

  var api = {
    HOUR: HOUR,
    CONDITIONS: CONDITIONS,
    COND_BY_INDEX: COND_BY_INDEX,
    fromYr: fromYr, fromWmo: fromWmo, fromOwm: fromOwm, fromAccu: fromAccu, fromTwc: fromTwc,
    dateKey: dateKey, localHour: localHour,
    median: median, mean: mean, spread: spread, vote: vote,
    dailyCond: dailyCond, aggregateDaily: aggregateDaily, pointAt: pointAt,
    agreement: agreement,
    combineCurrent: combineCurrent, combineHourly: combineHourly, combineDaily: combineDaily
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherConsensus = api;
})(typeof window !== 'undefined' ? window : this);
