/*
 * რჩევები და გაფრთხილებები საერთო პროგნოზიდან. სუფთა ფუნქციებია: აბრუნებენ გასაღებებს და
 * რიცხვებს, ტექსტს კი UI თარგმნის (i18n). ტესტდება Node-ში.
 */
(function (root) {
  'use strict';

  function num(v) { return typeof v === 'number' && isFinite(v); }
  function maxOf(list, f) { var v = list.map(f).filter(num); return v.length ? Math.max.apply(null, v) : null; }
  function minOf(list, f) { var v = list.map(f).filter(num); return v.length ? Math.min.apply(null, v) : null; }
  function sumOf(list, f) { var v = list.map(f).filter(num); return v.length ? v.reduce(function (s, x) { return s + x; }, 0) : null; }

  /**
   * შეგრძნებითი ტემპერატურა (Steadman / ავსტრალიის მეტეობიურო; იგივე ფორმულა, რასაც Open-Meteo იყენებს).
   * temp °C, humidity %, wind მ/წ.
   */
  function feelsLike(temp, humidity, wind) {
    if (!num(temp)) return null;
    var rh = num(humidity) ? humidity : 60;
    var ws = num(wind) ? wind : 0;
    var e = rh / 100 * 6.105 * Math.exp(17.27 * temp / (237.7 + temp));
    return temp + 0.33 * e - 0.70 * ws - 4.00;
  }

  /** ქარის მიმართულების რუმბი: 0–7 (ჩ, ჩა, ა, სა, ს, სდ, დ, ჩდ) — „საიდან უბერავს“ */
  function compassIndex(deg) {
    if (!num(deg)) return null;
    return Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  }

  /* ---------- რა ჩავიცვა ---------- */

  /**
   * hours — მომდევნო ~12 საათის საერთო პროგნოზი [{temp, humidity, wind, gust, precipProb, precip, cond}], uvMax.
   * აბრუნებს { layer, feelsMin, feelsMax, extras: [...] }.
   */
  function wearAdvice(hours, uvMax) {
    var hs = hours.filter(function (h) { return num(h.temp); });
    if (!hs.length) return null;
    var feels = hs.map(function (h) { return feelsLike(h.temp, h.humidity, h.wind); });
    var fMin = Math.min.apply(null, feels), fMax = Math.max.apply(null, feels);
    // ვირჩევთ ფენას ყველაზე ცივი საათისთვის, მაგრამ დღის სითბოსაც ვითვალისწინებთ
    var ref = fMin * 0.6 + fMax * 0.4;
    var layer = ref >= 24 ? 'hot' : ref >= 18 ? 'warm' : ref >= 12 ? 'mild' : ref >= 5 ? 'cool' : ref >= -5 ? 'cold' : 'freezing';
    var extras = [];
    var prob = maxOf(hs, function (h) { return h.precipProb; });
    var precip = sumOf(hs, function (h) { return h.precip; });
    var wet = hs.some(function (h) { return /rain|thunder|sleet/.test(h.cond || ''); });
    var snow = hs.some(function (h) { return h.cond === 'snow' || h.cond === 'sleet'; });
    if ((prob != null && prob >= 50) || (precip != null && precip >= 1) || (wet && prob == null)) extras.push('umbrella');
    else if (prob != null && prob >= 30) extras.push('maybeUmbrella');
    if (snow) extras.push('boots');
    var gust = maxOf(hs, function (h) { return num(h.gust) ? h.gust : h.wind; });
    if (gust != null && gust >= 12) extras.push('windproof');
    if (num(uvMax) && uvMax >= 6) extras.push('sunscreen');
    else if (num(uvMax) && uvMax >= 3 && layer !== 'cold' && layer !== 'freezing') extras.push('sunglasses');
    if (fMax - fMin >= 10) extras.push('layers');
    return { layer: layer, feelsMin: fMin, feelsMax: fMax, extras: extras };
  }

  /* ---------- გაფრთხილებები ---------- */

  var LEVELS = { yellow: 1, orange: 2, red: 3 };

  /**
   * hourly — საერთო საათობრივი (48 სთ), daily — საერთო დღიური, details — დამატებითი საათობრივი
   * (visibility, snowfall), month — 1–12. აბრუნებს [{type, level, t|date, value}] სიმძიმის მიხედვით.
   */
  function alerts(hourly, daily, details, month) {
    var out = [];
    function add(type, level, when, value) {
      var ex = out.filter(function (a) { return a.type === type; })[0];
      if (ex && LEVELS[ex.level] >= LEVELS[level]) return;
      if (ex) out.splice(out.indexOf(ex), 1);
      out.push({ type: type, level: level, when: when, value: value });
    }
    hourly.forEach(function (h) {
      if (h.cond === 'thunder') add('thunder', 'orange', h.t, null);
      var g = num(h.gust) ? h.gust : null;
      if (g != null && g >= 25) add('wind', 'red', h.t, g);
      else if (g != null && g >= 17) add('wind', 'orange', h.t, g);
      else if (num(h.wind) && h.wind >= 12) add('wind', 'yellow', h.t, h.wind);
      // მოყინულობა: ტემპერატურა ნულთან ახლოს + ნალექი
      if (num(h.temp) && h.temp <= 1 && h.temp >= -3 && ((num(h.precip) && h.precip >= 0.2) || /rain|sleet/.test(h.cond || ''))) {
        add('ice', 'orange', h.t, h.temp);
      }
    });
    daily.slice(0, 3).forEach(function (d) {
      if (num(d.precip) && d.precip >= 40) add('rain', 'red', d.date, d.precip);
      else if (num(d.precip) && d.precip >= 20) add('rain', 'orange', d.date, d.precip);
      if (num(d.tmax) && d.tmax >= 40) add('heat', 'red', d.date, d.tmax);
      else if (num(d.tmax) && d.tmax >= 35) add('heat', 'orange', d.date, d.tmax);
      if (num(d.tmin) && d.tmin <= -15) add('frost', 'red', d.date, d.tmin);
      else if (num(d.tmin) && d.tmin <= -8) add('frost', 'orange', d.date, d.tmin);
      // გაზაფხულის/შემოდგომის ყინვა — საშიშია ბაღისა და ვენახისთვის
      else if (num(d.tmin) && d.tmin <= 0 && month >= 4 && month <= 10) add('frost', 'yellow', d.date, d.tmin);
    });
    if (details && details.hourly) {
      details.hourly.forEach(function (r) {
        if (num(r.visibility) && r.visibility < 200) add('fog', 'orange', r.t, r.visibility);
        else if (num(r.visibility) && r.visibility < 1000) add('fog', 'yellow', r.t, r.visibility);
      });
      (details.daily || []).slice(0, 3).forEach(function (d) {
        if (num(d.snowfall) && d.snowfall >= 25) add('snow', 'red', d.date, d.snowfall);
        else if (num(d.snowfall) && d.snowfall >= 10) add('snow', 'orange', d.date, d.snowfall);
        else if (num(d.snowfall) && d.snowfall >= 3) add('snow', 'yellow', d.date, d.snowfall);
      });
    }
    return out.sort(function (a, b) { return LEVELS[b.level] - LEVELS[a.level]; });
  }

  /* ---------- საუკეთესო დღე ---------- */

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // რამდენად კარგია ტემპერატურა: 1 ოპტიმალურ ზოლში, ნელა ეცემა მის გარეთ
  function tempFit(t, lo, hi) {
    if (!num(t)) return 0.5;
    if (t >= lo && t <= hi) return 1;
    var d = t < lo ? lo - t : t - hi;
    return clamp(1 - d / 10, 0, 1);
  }
  function dryness(d) {
    var p = num(d.precipProb) ? d.precipProb : (/rain|snow|sleet|thunder/.test(d.cond || '') ? 70 : 10);
    var mmv = num(d.precip) ? d.precip : 0;
    return clamp(1 - p / 100, 0, 1) * clamp(1 - mmv / 5, 0, 1);
  }

  var ACTIVITIES = {
    picnic: function (d) { return dryness(d) * tempFit(d.tmax, 20, 28) * clamp(1 - (d.wind || 0) / 14, 0, 1) * (d.cond === 'thunder' ? 0 : 1); },
    hike: function (d) { return dryness(d) * tempFit(d.tmax, 10, 24) * clamp(1 - (d.wind || 0) / 16, 0, 1) * (d.cond === 'thunder' ? 0 : 1); },
    laundry: function (d) {
      var sun = d.cond === 'clear' ? 1 : d.cond === 'partly' ? 0.85 : d.cond === 'cloudy' ? 0.55 : 0.3;
      return dryness(d) * sun * tempFit(d.tmax, 15, 35);
    },
    carwash: function (d, i, days) {
      // მანქანა სუფთა რომ დარჩეს: ეს დღე და მომდევნო 2 დღეც მშრალი
      var next = days.slice(i, i + 3);
      if (next.length < 2) return 0;
      return next.reduce(function (s, x) { return s * dryness(x); }, 1) * tempFit(d.tmax, 5, 35);
    }
  };

  /** აბრუნებს { activity: { date, score } | null } — score 0–100; null თუ კარგი დღე არ არის (<45). */
  function bestDays(daily) {
    var out = {};
    Object.keys(ACTIVITIES).forEach(function (k) {
      var best = null;
      daily.forEach(function (d, i) {
        var s = Math.round(ACTIVITIES[k](d, i, daily) * 100);
        if (!best || s > best.score) best = { date: d.date, index: i, score: s };
      });
      out[k] = best && best.score >= 45 ? best : null;
    });
    return out;
  }

  /* ---------- გუშინდელთან შედარება ---------- */

  /** details.hourly (past_days=1-ით) — ვადარებთ ახლანდელ საათს 24 საათით ადრინდელს. */
  function vsYesterday(rows, now) {
    var HOUR = 3600000;
    function near(t) {
      var best = null;
      rows.forEach(function (r) { if (num(r.temp) && (!best || Math.abs(r.t - t) < Math.abs(best.t - t))) best = r; });
      return best && Math.abs(best.t - t) <= HOUR ? best : null;
    }
    var a = near(now), b = near(now - 24 * HOUR);
    if (!a || !b) return null;
    return Math.round((a.temp - b.temp) * 10) / 10;
  }

  /* ---------- ჰაერი და UV ---------- */

  function aqiLevel(aqi) {
    if (!num(aqi)) return null;
    return aqi <= 20 ? 'good' : aqi <= 40 ? 'fair' : aqi <= 60 ? 'moderate' : aqi <= 80 ? 'poor' : aqi <= 100 ? 'veryPoor' : 'extreme';
  }
  function uvLevel(uv) {
    if (!num(uv)) return null;
    return uv < 3 ? 'low' : uv < 6 ? 'moderate' : uv < 8 ? 'high' : uv < 11 ? 'veryHigh' : 'extreme';
  }

  /* ---------- მძღოლი ---------- */

  /**
   * ადგილობრივი საგზაო რისკები მომდევნო 12 საათში.
   * hours — საერთო საათობრივი; details — ხილვადობა/თოვლი. აბრუნებს { level: 'ok'|'caution'|'danger', risks: [...] }.
   */
  function roadRisk(hours, details) {
    var risks = [];
    var t0 = hours.length ? hours[0].t : 0, t1 = t0 + 12 * 3600000;
    var det = details && details.hourly ? details.hourly.filter(function (r) { return r.t >= t0 && r.t <= t1; }) : [];
    var minT = minOf(hours, function (h) { return h.temp; });
    var wetCold = hours.some(function (h) {
      return num(h.temp) && h.temp <= 1 && ((num(h.precip) && h.precip > 0) || (num(h.humidity) && h.humidity >= 92) || /rain|sleet|snow/.test(h.cond || ''));
    });
    if (wetCold) risks.push({ type: 'ice', level: 'danger', value: minT });
    else if (num(minT) && minT <= 3) risks.push({ type: 'coldRoad', level: 'caution', value: minT });
    var vis = minOf(det, function (r) { return r.visibility; });
    if (num(vis) && vis < 300) risks.push({ type: 'fog', level: 'danger', value: vis });
    else if (num(vis) && vis < 1000) risks.push({ type: 'fog', level: 'caution', value: vis });
    var snow = sumOf(det, function (r) { return r.snowfall; });
    if (num(snow) && snow >= 5) risks.push({ type: 'snow', level: 'danger', value: snow });
    else if (num(snow) && snow >= 0.5) risks.push({ type: 'snow', level: 'caution', value: snow });
    var rain = sumOf(hours, function (h) { return h.precip; });
    if (num(rain) && rain >= 15) risks.push({ type: 'heavyRain', level: 'caution', value: rain });
    var gust = maxOf(hours, function (h) { return num(h.gust) ? h.gust : h.wind; });
    if (num(gust) && gust >= 20) risks.push({ type: 'wind', level: 'danger', value: gust });
    else if (num(gust) && gust >= 14) risks.push({ type: 'wind', level: 'caution', value: gust });
    var level = risks.some(function (r) { return r.level === 'danger'; }) ? 'danger' : risks.length ? 'caution' : 'ok';
    return { level: level, risks: risks };
  }

  /** უღელტეხილის მდგომარეობა მომდევნო 24 საათში (place — extras.parsePlace შედეგი). */
  function passStatus(place, now) {
    var rows = place.hourly.filter(function (r) { return r.t >= now - 3600000 && r.t <= now + 24 * 3600000; });
    if (!rows.length) return null;
    var snow = sumOf(rows, function (r) { return r.snowfall; }) || 0;
    var minT = minOf(rows, function (r) { return r.temp; });
    var vis = minOf(rows, function (r) { return r.visibility; });
    var gust = maxOf(rows, function (r) { return r.gust; });
    var depth = maxOf(rows, function (r) { return r.snowDepth; });
    var icy = rows.some(function (r) { return num(r.temp) && r.temp <= 1 && num(r.precip) && r.precip > 0; });
    var level = 'ok';
    if (snow >= 10 || (num(vis) && vis < 200) || (num(gust) && gust >= 22)) level = 'danger';
    else if (snow >= 1 || icy || (num(vis) && vis < 1000) || (num(gust) && gust >= 15) || (num(minT) && minT <= -5)) level = 'caution';
    return { level: level, snow: snow, minT: minT, visibility: vis, gust: gust, snowDepth: depth, icy: icy, elevation: place.elevation };
  }

  /* ---------- მთა ---------- */

  /** ტემპერატურა სხვა სიმაღლეზე: სტანდარტული ვერტიკალური გრადიენტი 6.5°/კმ. */
  function tempAtAltitude(temp, fromM, toM) {
    if (!num(temp) || !num(fromM) || !num(toM)) return null;
    return temp - (toM - fromM) * 0.0065;
  }

  /** მთის შეჯამება details-იდან: თოვლის საფარი, ახალი თოვლი 24/72 სთ, ნულოვანი იზოთერმა. */
  function mountainSummary(details, now) {
    if (!details || !details.hourly) return null;
    var HOUR = 3600000;
    var rows = details.hourly;
    var cur = rows.filter(function (r) { return r.t <= now; }).slice(-1)[0] || rows[0];
    var next = function (h) { return rows.filter(function (r) { return r.t > now && r.t <= now + h * HOUR; }); };
    var past24 = rows.filter(function (r) { return r.t > now - 24 * HOUR && r.t <= now; });
    var freezing = cur && num(cur.freezing) ? cur.freezing : null;
    var depthCm = cur && num(cur.snowDepth) ? cur.snowDepth * 100 : null;  // API აბრუნებს მეტრებში
    return {
      snowDepth: depthCm,
      newSnow24: sumOf(next(24), function (r) { return r.snowfall; }) || 0,
      newSnow72: sumOf(next(72), function (r) { return r.snowfall; }) || 0,
      fallen24: sumOf(past24, function (r) { return r.snowfall; }) || 0,
      freezing: freezing,
      elevation: details.elevation,
      relevant: (num(details.elevation) && details.elevation >= 900) || (depthCm || 0) > 0 ||
        (sumOf(next(72), function (r) { return r.snowfall; }) || 0) > 0
    };
  }

  var api = {
    feelsLike: feelsLike, compassIndex: compassIndex, wearAdvice: wearAdvice, alerts: alerts, bestDays: bestDays,
    vsYesterday: vsYesterday, aqiLevel: aqiLevel, uvLevel: uvLevel, roadRisk: roadRisk, passStatus: passStatus,
    tempAtAltitude: tempAtAltitude, mountainSummary: mountainSummary, ACTIVITIES: Object.keys(ACTIVITIES)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherInsights = api;
})(typeof window !== 'undefined' ? window : this);
