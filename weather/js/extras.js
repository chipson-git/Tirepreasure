/*
 * დამატებითი მონაცემები (ყველა უფასო, გასაღების გარეშე):
 *  - details:  Open-Meteo-ს „საუკეთესო“ მოდელი — ხილვადობა, თოვლი, ნულოვანი იზოთერმა, გუშინდელი ტემპერატურა
 *  - air:      ჰაერის ხარისხი და UV (Open-Meteo Air Quality)
 *  - places:   მთის უღელტეხილები და კურორტები ერთი მოთხოვნით (რამდენიმე კოორდინატი)
 *  - history:  1991 წლიდან დღევანდელი თარიღის ნორმა და რეკორდები (ERA5 არქივი)
 *  - accuracy: რამდენად ზუსტი იყო თითოეული მოდელის გუშინდელი პროგნოზი (Previous Runs API)
 *  - radar:    RainViewer-ის რადარის კადრები
 * parse* ფუნქციები სუფთაა და ტესტდება Node-ში.
 */
(function (root) {
  'use strict';

  var W = root.WeatherConsensus || (typeof require !== 'undefined' ? require('./consensus.js') : null);
  var HOUR = W.HOUR;

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function at(arr, i) { return arr ? num(arr[i]) : null; }
  function r4(x) { return Math.round(x * 1e4) / 1e4; }
  function hourlyRows(h, fields) {
    return (h && h.time || []).map(function (sec, i) {
      var row = { t: sec * 1000 };
      Object.keys(fields).forEach(function (k) { row[k] = at(h[fields[k]], i); });
      return row;
    });
  }

  /* ---------- details ---------- */

  var DETAIL_FIELDS = {
    temp: 'temperature_2m', humidity: 'relative_humidity_2m', visibility: 'visibility', snowDepth: 'snow_depth',
    snowfall: 'snowfall', freezing: 'freezing_level_height', gust: 'wind_gusts_10m', precip: 'precipitation',
    code: 'weather_code'
  };

  function parseDetails(json) {
    var off = (json.utc_offset_seconds || 0) * 1000;
    var d = json.daily || {};
    return {
      elevation: num(json.elevation),
      hourly: hourlyRows(json.hourly, DETAIL_FIELDS),
      daily: (d.time || []).map(function (sec, i) {
        return { date: new Date(sec * 1000 + off).toISOString().slice(0, 10), snowfall: at(d.snowfall_sum, i) };
      })
    };
  }

  function fetchDetails(loc, get) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + r4(loc.lat) + '&longitude=' + r4(loc.lon) +
      '&hourly=' + Object.keys(DETAIL_FIELDS).map(function (k) { return DETAIL_FIELDS[k]; }).join(',') +
      '&daily=snowfall_sum&past_days=1&forecast_days=7&wind_speed_unit=ms&timezone=auto&timeformat=unixtime';
    return get(url).then(parseDetails);
  }

  /* ---------- air ---------- */

  function parseAir(json) {
    var c = json.current || {};
    return {
      aqi: num(c.european_aqi), pm25: num(c.pm2_5), pm10: num(c.pm10), uv: num(c.uv_index),
      hourly: hourlyRows(json.hourly, { uv: 'uv_index', aqi: 'european_aqi' })
    };
  }

  function fetchAir(loc, get) {
    var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + r4(loc.lat) + '&longitude=' + r4(loc.lon) +
      '&current=european_aqi,pm2_5,pm10,uv_index&hourly=uv_index,european_aqi&forecast_days=2&timezone=auto&timeformat=unixtime';
    return get(url).then(parseAir);
  }

  /* ---------- places: უღელტეხილები და კურორტები ---------- */

  var PASSES = [
    { id: 'jvari', lat: 42.5147, lon: 44.4548, road: 'ს3 (საქართველოს სამხედრო გზა)' },
    { id: 'rikoti', lat: 42.0033, lon: 43.4520, road: 'ს1 (თბილისი–სენაკი)' },
    { id: 'goderdzi', lat: 41.6363, lon: 42.5218, road: 'ს20 (ახალციხე–ბათუმი)' },
    { id: 'abano', lat: 42.3947, lon: 45.3389, road: 'ფშაველი–ომალო (თუშეთი)' }
  ];
  var RESORTS = [
    { id: 'gudauri', lat: 42.4776, lon: 44.4790 },
    { id: 'bakuriani', lat: 41.7497, lon: 43.5328 },
    { id: 'tetnuldi', lat: 43.0389, lon: 42.8269 },
    { id: 'goderdziResort', lat: 41.6440, lon: 42.5130 }
  ];

  function parsePlace(json) {
    var d = json.daily || {};
    return {
      elevation: num(json.elevation),
      hourly: hourlyRows(json.hourly, { temp: 'temperature_2m', snowfall: 'snowfall', precip: 'precipitation',
        visibility: 'visibility', gust: 'wind_gusts_10m', code: 'weather_code', snowDepth: 'snow_depth' }),
      daily: (d.time || []).map(function (sec, i) {
        return { t: sec * 1000, tmin: at(d.temperature_2m_min, i), tmax: at(d.temperature_2m_max, i), snowfall: at(d.snowfall_sum, i) };
      })
    };
  }

  function fetchPlaces(get) {
    var all = PASSES.concat(RESORTS);
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + all.map(function (p) { return p.lat; }).join(',') +
      '&longitude=' + all.map(function (p) { return p.lon; }).join(',') +
      '&hourly=temperature_2m,snowfall,precipitation,visibility,wind_gusts_10m,weather_code,snow_depth' +
      '&daily=temperature_2m_min,temperature_2m_max,snowfall_sum&forecast_days=3&wind_speed_unit=ms&timeformat=unixtime';
    return get(url).then(function (json) {
      var list = Array.isArray(json) ? json : [json];   // რამდენიმე კოორდინატზე პასუხი მასივია
      var out = {};
      all.forEach(function (p, i) { if (list[i]) out[p.id] = parsePlace(list[i]); });
      return out;
    });
  }

  /* ---------- history: ნორმა და რეკორდები ---------- */

  /**
   * ERA5 დღიური მონაცემებიდან ყოველი კალენდარული დღის (MM-DD) სტატისტიკა, ±3 დღის ფანჯრით:
   * normal — 1991–2020 საშუალო, record — მთელი პერიოდის რეკორდი წლით.
   */
  function buildHistory(json) {
    var d = json.daily || {};
    var byDay = {};
    (d.time || []).forEach(function (date, i) {
      var md = date.slice(5);
      if (md === '02-29') return;
      (byDay[md] = byDay[md] || []).push({ y: Number(date.slice(0, 4)), hi: at(d.temperature_2m_max, i), lo: at(d.temperature_2m_min, i) });
    });
    var keys = Object.keys(byDay).sort();
    var out = {};
    keys.forEach(function (md, k) {
      var rows = [];
      for (var o = -3; o <= 3; o++) rows = rows.concat(byDay[keys[(k + o + keys.length) % keys.length]] || []);
      var norm = rows.filter(function (r) { return r.y >= 1991 && r.y <= 2020; });
      var hiN = norm.map(function (r) { return r.hi; }).filter(function (v) { return v != null; });
      var loN = norm.map(function (r) { return r.lo; }).filter(function (v) { return v != null; });
      // რეკორდი — მხოლოდ ზუსტად ამ დღისთვის
      var exact = byDay[md];
      var rh = null, rl = null;
      exact.forEach(function (r) {
        if (r.hi != null && (!rh || r.hi > rh.v)) rh = { v: r.hi, y: r.y };
        if (r.lo != null && (!rl || r.lo < rl.v)) rl = { v: r.lo, y: r.y };
      });
      out[md] = {
        normHi: hiN.length ? Math.round(W.mean(hiN) * 10) / 10 : null,
        normLo: loN.length ? Math.round(W.mean(loN) * 10) / 10 : null,
        recHi: rh, recLo: rl
      };
    });
    var years = (d.time || []).length ? [Number(d.time[0].slice(0, 4)), Number(d.time[d.time.length - 1].slice(0, 4))] : null;
    return { days: out, years: years };
  }

  function fetchHistory(loc, get, todayStr) {
    // არქივი რამდენიმე დღის დაგვიანებით ახლდება — ვიღებთ 7 დღით ადრე
    var p = todayStr.split('-').map(Number);
    var end = new Date(Date.UTC(p[0], p[1] - 1, p[2] - 7)).toISOString().slice(0, 10);
    var url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + r4(loc.lat) + '&longitude=' + r4(loc.lon) +
      '&start_date=1991-01-01&end_date=' + end + '&daily=temperature_2m_max,temperature_2m_min&timezone=auto';
    return get(url).then(buildHistory);
  }

  /* ---------- accuracy: გუშინდელი პროგნოზის ცდომილება ---------- */

  var ACCURACY_MODELS = { ecmwf: 'ecmwf_ifs025', gfs: 'gfs_seamless', icon: 'icon_seamless', ukmo: 'ukmo_seamless' };

  /** Previous Runs პასუხიდან: [{t, actual, forecast}] — forecast = 1 დღით ადრე გაკეთებული პროგნოზი */
  function parsePrevious(json, now) {
    var h = json.hourly || {};
    return (h.time || []).map(function (sec, i) {
      return { t: sec * 1000, actual: at(h.temperature_2m, i), forecast: at(h.temperature_2m_previous_day1, i) };
    }).filter(function (r) { return r.t <= now && r.actual != null; });
  }

  /**
   * სიზუსტე: ყოველი მოდელის გუშინდელი პროგნოზი ვადარეთ „ფაქტს“. ფაქტად ვიღებთ ყველა მოდელის
   * ანალიზის მედიანას იმავე საათზე — ასე არც ერთი მოდელი საკუთარ თავს არ ამოწმებს.
   * extra: { id: [{t, forecast}] } — დამატებითი წყაროები (მაგ. yr, რომელსაც მოწყობილობაზე ვინახავთ).
   * აბრუნებს { id: { mae, n } }.
   */
  function scoreAccuracy(prevById, extra) {
    var truth = {};
    Object.keys(prevById).forEach(function (id) {
      prevById[id].forEach(function (r) { (truth[r.t] = truth[r.t] || []).push(r.actual); });
    });
    var truthAt = {};
    Object.keys(truth).forEach(function (t) { if (truth[t].length >= 2) truthAt[t] = W.median(truth[t]); });
    function score(rows) {
      var errs = rows.filter(function (r) { return r.forecast != null && truthAt[r.t] != null; })
        .map(function (r) { return Math.abs(r.forecast - truthAt[r.t]); });
      return errs.length >= 12 ? { mae: Math.round(W.mean(errs) * 100) / 100, n: errs.length } : null;
    }
    var out = {};
    Object.keys(prevById).forEach(function (id) { var s = score(prevById[id]); if (s) out[id] = s; });
    Object.keys(extra || {}).forEach(function (id) { var s = score(extra[id]); if (s) out[id] = s; });
    return out;
  }

  /** წონები სიზუსტით: w = 1 / MAE², ნორმალიზებული ისე, რომ საშუალო 1 იყოს. ქულის გარეშე წყარო — 1. */
  function weightsFrom(scores, ids) {
    var raw = {};
    ids.forEach(function (id) { raw[id] = scores[id] ? 1 / Math.pow(Math.max(scores[id].mae, 0.3), 2) : null; });
    var known = ids.filter(function (id) { return raw[id] != null; });
    if (known.length < 2) return null;
    var avg = known.reduce(function (s, id) { return s + raw[id]; }, 0) / known.length;
    var w = {};
    ids.forEach(function (id) { w[id] = raw[id] != null ? raw[id] / avg : 1; });
    return w;
  }

  function fetchAccuracy(loc, get) {
    var ids = Object.keys(ACCURACY_MODELS);
    var now = Date.now();
    return Promise.all(ids.map(function (id) {
      var url = 'https://previous-runs-api.open-meteo.com/v1/forecast?latitude=' + r4(loc.lat) + '&longitude=' + r4(loc.lon) +
        '&hourly=temperature_2m,temperature_2m_previous_day1&models=' + ACCURACY_MODELS[id] +
        '&past_days=7&forecast_days=1&timeformat=unixtime';
      return get(url).then(function (j) { return parsePrevious(j, now); }, function () { return null; });
    })).then(function (rows) {
      var out = {};
      ids.forEach(function (id, i) { if (rows[i] && rows[i].length) out[id] = rows[i]; });
      if (Object.keys(out).length < 2) throw new Error('accuracy');
      return out;
    });
  }

  /* ---------- radar ---------- */

  function fetchRadar(get) {
    return get('https://api.rainviewer.com/public/weather-maps.json').then(function (j) {
      return {
        host: j.host,
        frames: ((j.radar && j.radar.past) || []).map(function (f) { return { time: f.time * 1000, path: f.path }; }),
        satellite: ((j.satellite && j.satellite.infrared) || []).map(function (f) { return { time: f.time * 1000, path: f.path }; })
      };
    });
  }

  var api = {
    PASSES: PASSES, RESORTS: RESORTS, ACCURACY_MODELS: ACCURACY_MODELS,
    parseDetails: parseDetails, parseAir: parseAir, parsePlace: parsePlace, buildHistory: buildHistory,
    parsePrevious: parsePrevious, scoreAccuracy: scoreAccuracy, weightsFrom: weightsFrom,
    fetchDetails: fetchDetails, fetchAir: fetchAir, fetchPlaces: fetchPlaces, fetchHistory: fetchHistory,
    fetchAccuracy: fetchAccuracy, fetchRadar: fetchRadar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherExtras = api;
})(typeof window !== 'undefined' ? window : this);
