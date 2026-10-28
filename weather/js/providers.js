/*
 * ამინდის 5 წყარო: მოთხოვნები და პასუხების ერთიან ფორმატში გადაყვანა.
 *
 * ერთიანი ფორმატი (ყველა წყაროსთვის):
 *   { current: {temp, cond, humidity, wind, pressure, precipProb} | null,
 *     hourly:  [{t, temp, cond, precipProb, precip, wind}],   // t — ms, wind — მ/წმ
 *     daily:   [{date: 'YYYY-MM-DD', tmin, tmax, cond, precipProb, precip, wind}] }
 *
 * parse* ფუნქციები სუფთაა (ქსელის გარეშე) და ტესტდება Node-ში.
 */
(function (root) {
  'use strict';

  var W = root.WeatherConsensus || (typeof require !== 'undefined' ? require('./consensus.js') : null);
  var HOUR = W.HOUR;

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function round4(x) { return Math.round(x * 1e4) / 1e4; }
  function kmh(v) { return num(v) == null ? null : v / 3.6; }
  function maxOf(a, b) {
    a = num(a); b = num(b);
    if (a == null) return b;
    if (b == null) return a;
    return Math.max(a, b);
  }
  function sumOf(a, b) {
    a = num(a); b = num(b);
    if (a == null && b == null) return null;
    return (a || 0) + (b || 0);
  }

  /* ---------------- yr.no (MET Norway) ---------------- */

  function parseYr(json, tz, now) {
    var ts = (json && json.properties && json.properties.timeseries) || [];
    var all = [];          // ყველა წერტილი ნალექით თავის ინტერვალში (დღიური შეჯამებისთვის)
    var hourly = [];       // მხოლოდ საათობრივი ნაწილი
    var coveredUntil = -Infinity;
    ts.forEach(function (e) {
      var t = Date.parse(e.time);
      var d = e.data || {};
      var inst = (d.instant && d.instant.details) || {};
      var n1 = d.next_1_hours, n6 = d.next_6_hours;
      var next = n1 || n6 || d.next_12_hours || {};
      var precip = null;
      if (t >= coveredUntil) {
        if (n1 && n1.details) { precip = num(n1.details.precipitation_amount); coveredUntil = t + HOUR; }
        else if (n6 && n6.details) { precip = num(n6.details.precipitation_amount); coveredUntil = t + 6 * HOUR; }
      }
      var p = {
        t: t,
        temp: num(inst.air_temperature),
        cond: W.fromYr(next.summary && next.summary.symbol_code),
        precipProb: next.details ? num(next.details.probability_of_precipitation) : null,
        precip: precip,
        wind: num(inst.wind_speed),
        humidity: num(inst.relative_humidity),
        pressure: num(inst.air_pressure_at_sea_level)
      };
      all.push(p);
      if (n1) hourly.push(p);
    });
    var cur = W.pointAt(all, now, 1.5 * HOUR);
    return {
      current: cur ? {
        temp: cur.temp, cond: cur.cond, humidity: cur.humidity, wind: cur.wind,
        pressure: cur.pressure, precipProb: cur.precipProb
      } : null,
      hourly: hourly,
      daily: W.aggregateDaily(all, tz)
    };
  }

  function fetchYr(loc, keys, get) {
    var url = 'https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=' +
      round4(loc.lat) + '&lon=' + round4(loc.lon);
    return get(url).then(function (json) { return parseYr(json, loc.tz, Date.now()); });
  }

  /* ---------------- Open-Meteo ---------------- */

  var OM_HOURLY = 'temperature_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m';
  var OM_DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,' +
    'precipitation_probability_max,wind_speed_10m_max';
  var OM_CURRENT = 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,pressure_msl';

  function parseOpenMeteo(json, now) {
    var h = json.hourly || {}, d = json.daily || {}, c = json.current;
    var hourly = (h.time || []).map(function (sec, i) {
      return {
        t: sec * 1000,
        temp: num(h.temperature_2m[i]),
        cond: W.fromWmo(h.weather_code[i]),
        precipProb: num(h.precipitation_probability[i]),
        precip: num(h.precipitation[i]),
        wind: num(h.wind_speed_10m[i])
      };
    });
    // timezone=auto: დღიური დრო = ადგილობრივი შუაღამე. utc_offset-ით ვიღებთ თარიღს.
    var off = (json.utc_offset_seconds || 0) * 1000;
    var daily = (d.time || []).map(function (sec, i) {
      return {
        date: new Date(sec * 1000 + off).toISOString().slice(0, 10),
        tmin: num(d.temperature_2m_min[i]),
        tmax: num(d.temperature_2m_max[i]),
        cond: W.fromWmo(d.weather_code[i]),
        precipProb: num(d.precipitation_probability_max[i]),
        precip: num(d.precipitation_sum[i]),
        wind: num(d.wind_speed_10m_max[i])
      };
    });
    var near = W.pointAt(hourly, now, HOUR);
    return {
      current: c ? {
        temp: num(c.temperature_2m), cond: W.fromWmo(c.weather_code), humidity: num(c.relative_humidity_2m),
        wind: num(c.wind_speed_10m), pressure: num(c.pressure_msl), precipProb: near ? near.precipProb : null
      } : null,
      hourly: hourly,
      daily: daily
    };
  }

  function fetchOpenMeteo(loc, keys, get) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + round4(loc.lat) +
      '&longitude=' + round4(loc.lon) + '&current=' + OM_CURRENT + '&hourly=' + OM_HOURLY +
      '&daily=' + OM_DAILY + '&wind_speed_unit=ms&timezone=auto&timeformat=unixtime&forecast_days=7';
    return get(url).then(function (json) { return parseOpenMeteo(json, Date.now()); });
  }

  /* ---------------- OpenWeatherMap ---------------- */

  function parseOwm(forecast, current, tz, now) {
    var hourly = ((forecast && forecast.list) || []).map(function (e) {
      var w = (e.weather && e.weather[0]) || {};
      return {
        t: e.dt * 1000,
        temp: num(e.main && e.main.temp),
        cond: W.fromOwm(w.id),
        precipProb: num(e.pop) == null ? null : Math.round(e.pop * 100),
        precip: sumOf(e.rain && e.rain['3h'], e.snow && e.snow['3h']) || 0,
        wind: num(e.wind && e.wind.speed)
      };
    });
    var cur = null;
    if (current && current.main) {
      var near = W.pointAt(hourly, now, 3 * HOUR);
      cur = {
        temp: num(current.main.temp),
        cond: W.fromOwm(current.weather && current.weather[0] && current.weather[0].id),
        humidity: num(current.main.humidity),
        wind: num(current.wind && current.wind.speed),
        pressure: num(current.main.pressure),
        precipProb: near ? near.precipProb : null
      };
    }
    return { current: cur, hourly: hourly, daily: W.aggregateDaily(hourly, tz) };
  }

  function fetchOwm(loc, keys, get) {
    var q = '?lat=' + round4(loc.lat) + '&lon=' + round4(loc.lon) + '&units=metric&appid=' +
      encodeURIComponent(keys.owm);
    var base = 'https://api.openweathermap.org/data/2.5/';
    return Promise.all([
      get(base + 'forecast' + q),
      get(base + 'weather' + q).catch(function () { return null; })
    ]).then(function (r) { return parseOwm(r[0], r[1], loc.tz, Date.now()); });
  }

  /* ---------------- AccuWeather ---------------- */

  function parseAccu(current, hourly12, daily5) {
    var c = current && current[0];
    var hourly = (hourly12 || []).map(function (e) {
      return {
        t: e.EpochDateTime * 1000,
        temp: num(e.Temperature && e.Temperature.Value),
        cond: W.fromAccu(e.WeatherIcon),
        precipProb: num(e.PrecipitationProbability),
        precip: num(e.TotalLiquid && e.TotalLiquid.Value),
        wind: kmh(e.Wind && e.Wind.Speed && e.Wind.Speed.Value)
      };
    });
    var daily = ((daily5 && daily5.DailyForecasts) || []).map(function (e) {
      var day = e.Day || {}, night = e.Night || {};
      function wind(part) { return part.Wind && part.Wind.Speed ? part.Wind.Speed.Value : null; }
      function liquid(part) { return part.TotalLiquid ? part.TotalLiquid.Value : null; }
      return {
        // AccuWeather აბრუნებს ადგილობრივ დროს ოფსეტით — თარიღი პირველი 10 სიმბოლოა
        date: String(e.Date).slice(0, 10),
        tmin: num(e.Temperature && e.Temperature.Minimum && e.Temperature.Minimum.Value),
        tmax: num(e.Temperature && e.Temperature.Maximum && e.Temperature.Maximum.Value),
        cond: W.fromAccu(day.Icon != null ? day.Icon : night.Icon),
        precipProb: maxOf(day.PrecipitationProbability, night.PrecipitationProbability),
        precip: sumOf(liquid(day), liquid(night)),
        wind: kmh(maxOf(wind(day), wind(night)))
      };
    });
    return {
      current: c ? {
        temp: num(c.Temperature && c.Temperature.Metric && c.Temperature.Metric.Value),
        cond: W.fromAccu(c.WeatherIcon),
        humidity: num(c.RelativeHumidity),
        wind: kmh(c.Wind && c.Wind.Speed && c.Wind.Speed.Metric && c.Wind.Speed.Metric.Value),
        pressure: num(c.Pressure && c.Pressure.Metric && c.Pressure.Metric.Value),
        precipProb: hourly.length ? hourly[0].precipProb : null
      } : null,
      hourly: hourly,
      daily: daily
    };
  }

  // ლოკაციის გასაღები იშვიათად იცვლება — ვინახავთ, რომ დღიური ლიმიტი (50) არ დავხარჯოთ
  function accuLocationKey(loc, keys, get, store) {
    var id = 'accu:' + loc.lat.toFixed(3) + ',' + loc.lon.toFixed(3);
    var saved = store && store.get(id);
    if (saved) return Promise.resolve(saved);
    var url = 'https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=' +
      encodeURIComponent(keys.accu) + '&q=' + round4(loc.lat) + ',' + round4(loc.lon);
    return get(url).then(function (json) {
      if (!json || !json.Key) throw new Error('AccuWeather: ლოკაცია ვერ მოიძებნა');
      if (store) store.set(id, json.Key);
      return json.Key;
    });
  }

  function fetchAccu(loc, keys, get, store) {
    return accuLocationKey(loc, keys, get, store).then(function (key) {
      var base = 'https://dataservice.accuweather.com/';
      var q = '?apikey=' + encodeURIComponent(keys.accu) + '&metric=true&details=true&language=en-us';
      return Promise.all([
        get(base + 'currentconditions/v1/' + key + q).catch(function () { return null; }),
        get(base + 'forecasts/v1/hourly/12hour/' + key + q).catch(function () { return null; }),
        get(base + 'forecasts/v1/daily/5day/' + key + q)
      ]).then(function (r) { return parseAccu(r[0], r[1], r[2]); });
    });
  }

  /* ---------------- weather.com (The Weather Company) ---------------- */

  function parseTwc(current, hourly2, daily5) {
    var h = hourly2 || {};
    var hourly = (h.validTimeUtc || []).map(function (sec, i) {
      return {
        t: sec * 1000,
        temp: num(h.temperature[i]),
        cond: W.fromTwc(h.iconCode[i]),
        precipProb: num(h.precipChance[i]),
        precip: num(h.qpf && h.qpf[i]),
        wind: kmh(h.windSpeed && h.windSpeed[i])
      };
    });
    var d = daily5 || {};
    var dp = (d.daypart && d.daypart[0]) || {};
    function part(name, i) { return dp[name] ? dp[name][i] : null; }
    var daily = (d.validTimeLocal || []).map(function (local, i) {
      var di = 2 * i, ni = 2 * i + 1;  // daypart: [დღე, ღამე, დღე, ღამე, ...]
      var icon = part('iconCode', di) != null ? part('iconCode', di) : part('iconCode', ni);
      return {
        date: String(local).slice(0, 10),
        tmin: num(d.temperatureMin && d.temperatureMin[i]),
        tmax: num(d.temperatureMax && d.temperatureMax[i]),   // დღის მეორე ნახევარში დღევანდელი max = null
        cond: W.fromTwc(icon),
        precipProb: maxOf(part('precipChance', di), part('precipChance', ni)),
        precip: num(d.qpf && d.qpf[i]),
        wind: kmh(maxOf(part('windSpeed', di), part('windSpeed', ni)))
      };
    });
    var cur = null;
    if (current && current.temperature != null) {
      cur = {
        temp: num(current.temperature),
        cond: W.fromTwc(current.iconCode),
        humidity: num(current.relativeHumidity),
        wind: kmh(current.windSpeed),
        pressure: num(current.pressureMeanSeaLevel),
        precipProb: hourly.length ? hourly[0].precipProb : null
      };
    } else if (hourly.length) {
      var f = hourly[0];
      cur = { temp: f.temp, cond: f.cond, humidity: num(h.relativeHumidity && h.relativeHumidity[0]),
        wind: f.wind, pressure: null, precipProb: f.precipProb };
    }
    return { current: cur, hourly: hourly, daily: daily };
  }

  function fetchTwc(loc, keys, get) {
    var base = 'https://api.weather.com/v3/';
    var q = '?geocode=' + round4(loc.lat) + ',' + round4(loc.lon) +
      '&units=m&language=en-US&format=json&apiKey=' + encodeURIComponent(keys.twc);
    // ზოგიერთ გასაღებს (მაგ. Weather Underground PWS) მხოლოდ დღიური პროგნოზი აქვს — დანარჩენი არასავალდებულოა
    return Promise.all([
      get(base + 'wx/observations/current' + q).catch(function () { return null; }),
      get(base + 'wx/forecast/hourly/2day' + q).catch(function () { return null; }),
      get(base + 'wx/forecast/daily/5day' + q)
    ]).then(function (r) { return parseTwc(r[0], r[1], r[2]); });
  }

  /* ---------------- წყაროების სია ---------------- */

  var SOURCES = [
    { id: 'yr', name: 'yr.no', by: 'MET Norway', site: 'https://www.yr.no', key: null, fetch: fetchYr, ttlMin: 15 },
    { id: 'weathercom', name: 'weather.com', by: 'The Weather Company', site: 'https://weather.com',
      key: 'twc', keyUrl: 'https://www.wunderground.com/member/api-keys', fetch: fetchTwc, ttlMin: 20 },
    { id: 'accu', name: 'AccuWeather', by: 'AccuWeather', site: 'https://www.accuweather.com',
      key: 'accu', keyUrl: 'https://developer.accuweather.com', fetch: fetchAccu, ttlMin: 45 },
    { id: 'owm', name: 'OpenWeatherMap', by: 'OpenWeather', site: 'https://openweathermap.org',
      key: 'owm', keyUrl: 'https://home.openweathermap.org/api_keys', fetch: fetchOwm, ttlMin: 15 },
    { id: 'openmeteo', name: 'Open-Meteo', by: 'Open-Meteo.com', site: 'https://open-meteo.com',
      key: null, fetch: fetchOpenMeteo, ttlMin: 15 }
  ];

  var api = {
    SOURCES: SOURCES,
    parseYr: parseYr, parseOpenMeteo: parseOpenMeteo, parseOwm: parseOwm, parseAccu: parseAccu, parseTwc: parseTwc
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherProviders = api;
})(typeof window !== 'undefined' ? window : this);
