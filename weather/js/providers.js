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

  function fetchYr(loc, get) {
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
    }).filter(function (p) { return p.temp != null; });
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
    }).filter(function (d) { return d.tmax != null || d.tmin != null; });
    var near = W.pointAt(hourly.filter(function (p) { return p.temp != null; }), now, 3 * HOUR);
    var cur = null;
    if (c && num(c.temperature_2m) != null) {
      cur = {
        temp: num(c.temperature_2m), cond: W.fromWmo(c.weather_code), humidity: num(c.relative_humidity_2m),
        wind: num(c.wind_speed_10m), pressure: num(c.pressure_msl), precipProb: near ? near.precipProb : null
      };
    } else if (near) {
      // ზოგ მოდელს „ახლანდელი“ მნიშვნელობა არ აქვს — ვიღებთ უახლოეს საათს
      cur = { temp: near.temp, cond: near.cond, humidity: null, wind: near.wind, pressure: null, precipProb: near.precipProb };
    }
    return {
      current: cur,
      hourly: hourly,
      daily: daily
    };
  }

  function fetchOpenMeteo(loc, get, modelName) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + round4(loc.lat) +
      '&longitude=' + round4(loc.lon) + '&current=' + OM_CURRENT + '&hourly=' + OM_HOURLY +
      '&daily=' + OM_DAILY + '&models=' + modelName +
      '&wind_speed_unit=ms&timezone=auto&timeformat=unixtime&forecast_days=7';
    return get(url).then(function (json) { return parseOpenMeteo(json, Date.now()); });
  }

  /* ---------------- წყაროების სია ---------------- */

  // yr.no — MET Norway-ის საკუთარი პროგნოზი. დანარჩენი ოთხი — მსოფლიოს წამყვანი ამინდის მოდელები,
  // რომლებსაც Open-Meteo უფასოდ და გასაღების გარეშე აწვდის.
  function model(name) {
    return function (loc, get) { return fetchOpenMeteo(loc, get, name); };
  }

  var SOURCES = [
    { id: 'yr', name: 'yr.no', by: 'MET Norway, ნორვეგია', site: 'https://www.yr.no', fetch: fetchYr, ttlMin: 15 },
    { id: 'ecmwf', name: 'ECMWF', by: 'ევროპის ცენტრი', site: 'https://www.ecmwf.int',
      fetch: model('ecmwf_ifs025'), ttlMin: 30 },
    { id: 'gfs', name: 'GFS', by: 'NOAA, აშშ', site: 'https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast',
      fetch: model('gfs_seamless'), ttlMin: 30 },
    { id: 'icon', name: 'ICON', by: 'DWD, გერმანია', site: 'https://www.dwd.de',
      fetch: model('icon_seamless'), ttlMin: 30 },
    { id: 'ukmo', name: 'UK Met Office', by: 'დიდი ბრიტანეთი', site: 'https://www.metoffice.gov.uk',
      fetch: model('ukmo_seamless'), ttlMin: 30 }
  ];

  var api = {
    SOURCES: SOURCES,
    parseYr: parseYr, parseOpenMeteo: parseOpenMeteo
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherProviders = api;
})(typeof window !== 'undefined' ? window : this);
