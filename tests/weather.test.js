// გაშვება: node tests/weather.test.js
const assert = require('assert');
const W = require('../weather/js/consensus.js');
const P = require('../weather/js/providers.js');
const E = require('../weather/js/extras.js');
const X = require('../weather/js/insights.js');
const A = require('../weather/js/astro.js');
const I = require('../weather/js/i18n.js');

const H = W.HOUR;
const TZ = 'Asia/Tbilisi';
const T0 = Date.parse('2026-10-28T08:00:00Z'); // 12:00 თბილისში

function run(name, fn) {
  try { fn(); console.log('✓', name); }
  catch (e) { console.error('✗', name, '\n ', e.message); process.exitCode = 1; }
}

run('მედიანა და საშუალო null-ების გარეშე', () => {
  assert.strictEqual(W.median([3, null, 1, 2]), 2);
  assert.strictEqual(W.median([1, 2, 3, 10]), 2.5);
  assert.strictEqual(W.mean([10, null, 20]), 15);
  assert.strictEqual(W.median([]), null);
});

run('მედიანა: ერთი გადახრილი წყარო შედეგს ვერ აფუჭებს', () => {
  assert.strictEqual(W.median([14, 15, 15, 16, 30]), 15);
});

run('ხმათა უმრავლესობა', () => {
  const v = W.vote(['rain', 'rain', 'cloudy', 'rain', 'lightrain']);
  assert.strictEqual(v.cond, 'rain');
  assert.strictEqual(v.share, 0.6);
});

run('ფრე წყდება ხმების „შუაში“ მყოფით', () => {
  // clear(0), clear(0), rain(5), rain(5), cloudy(2) → მედიანა 2 → clear უფრო ახლოსაა
  assert.strictEqual(W.vote(['clear', 'clear', 'rain', 'rain', 'cloudy']).cond, 'clear');
  // cloudy(2) cloudy rain(5) rain thunder(9) → მედიანა 5 → rain
  assert.strictEqual(W.vote(['cloudy', 'cloudy', 'rain', 'rain', 'thunder']).cond, 'rain');
});

run('კოდების გადაყვანა ერთიან კატეგორიებში', () => {
  assert.strictEqual(W.fromYr('lightrainshowers_day'), 'lightrain');
  assert.strictEqual(W.fromYr('heavyrainandthunder'), 'thunder');
  assert.strictEqual(W.fromYr('partlycloudy_night'), 'partly');
  assert.strictEqual(W.fromYr('heavysleet'), 'sleet');
  assert.strictEqual(W.fromWmo(0), 'clear');
  assert.strictEqual(W.fromWmo(65), 'heavyrain');
  assert.strictEqual(W.fromWmo(75), 'snow');
  assert.strictEqual(W.fromOwm(804), 'cloudy');
  assert.strictEqual(W.fromOwm(211), 'thunder');
  assert.strictEqual(W.fromAccu(18), 'rain');
  assert.strictEqual(W.fromAccu(33), 'clear');
  assert.strictEqual(W.fromTwc(32), 'clear');
  assert.strictEqual(W.fromTwc(16), 'snow');
});

run('ადგილობრივი თარიღი დროის სარტყლის მიხედვით', () => {
  // 21:30 UTC = 01:30 თბილისში (UTC+4) → უკვე შემდეგი დღე
  assert.strictEqual(W.dateKey(Date.parse('2026-10-28T21:30:00Z'), TZ), '2026-10-29');
  assert.strictEqual(W.localHour(T0, TZ), 12);
});

run('შეთანხმების დონე', () => {
  assert.strictEqual(W.agreement(1, 1, 10, 5).key, 'high');
  assert.strictEqual(W.agreement(3, 1, 10, 5).key, 'mid');
  assert.strictEqual(W.agreement(1, 0.4, 10, 5).key, 'low');
  assert.strictEqual(W.agreement(1, 1, 60, 5).key, 'low');
  assert.strictEqual(W.agreement(0, 1, null, 1).level, null);
});

run('დღიური შეჯამება სამსაათიანი წერტილებიდან', () => {
  const pts = [0, 3, 6, 9, 12].map((h, i) => ({
    t: Date.parse('2026-10-28T00:00:00Z') + h * H, // 04:00–16:00 თბილისში
    temp: 10 + i, cond: i >= 3 ? 'rain' : 'cloudy', precip: 1, precipProb: i * 10, wind: i
  }));
  const [d] = W.aggregateDaily(pts, TZ);
  assert.strictEqual(d.date, '2026-10-28');
  assert.strictEqual(d.tmin, 10);
  assert.strictEqual(d.tmax, 14);
  assert.strictEqual(d.precip, 5);
  assert.strictEqual(d.precipProb, 40);
  assert.strictEqual(d.cond, 'rain'); // ნალექიანი საათები ≥25%
});

/* ---------- წყაროების პარსერები ---------- */

const yrJson = { properties: { timeseries: [
  { time: '2026-10-28T08:00:00Z', data: {
    instant: { details: { air_temperature: 15.2, relative_humidity: 60, wind_speed: 3.1, air_pressure_at_sea_level: 1015 } },
    next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0, probability_of_precipitation: 5 } },
    next_6_hours: { summary: { symbol_code: 'lightrain_day' }, details: { precipitation_amount: 1.2 } } } },
  { time: '2026-10-28T09:00:00Z', data: {
    instant: { details: { air_temperature: 16.0, wind_speed: 3.5 } },
    next_1_hours: { summary: { symbol_code: 'lightrain_day' }, details: { precipitation_amount: 0.4, probability_of_precipitation: 40 } } } },
  { time: '2026-10-29T06:00:00Z', data: {
    instant: { details: { air_temperature: 9, wind_speed: 2 } },
    next_6_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 2, probability_of_precipitation: 30 } } } }
] } };

run('yr.no პარსერი', () => {
  const r = P.parseYr(yrJson, TZ, T0);
  assert.strictEqual(r.current.temp, 15.2);
  assert.strictEqual(r.current.cond, 'partly');
  assert.strictEqual(r.hourly.length, 2);           // მხოლოდ next_1_hours წერტილები
  assert.strictEqual(r.daily[0].precip, 0.4);       // 6-საათიანი ნალექი ორჯერ არ ითვლება
  assert.strictEqual(r.daily.length, 1);            // არასრული ბოლო დღე (1 წერტილი) იშლება
  assert.strictEqual(r.current.windDir, null);
});

run('Open-Meteo პარსერი', () => {
  const sec = T0 / 1000;
  const r = P.parseOpenMeteo({
    utc_offset_seconds: 14400,
    current: { temperature_2m: 14, relative_humidity_2m: 55, weather_code: 2, wind_speed_10m: 4, pressure_msl: 1016 },
    hourly: { time: [sec, sec + 3600], temperature_2m: [14, 15], weather_code: [2, 61],
      precipitation_probability: [10, 50], precipitation: [0, 0.5], wind_speed_10m: [4, 5] },
    daily: { time: [Date.parse('2026-10-27T20:00:00Z') / 1000], weather_code: [61], temperature_2m_max: [17],
      temperature_2m_min: [8], precipitation_sum: [3], precipitation_probability_max: [70], wind_speed_10m_max: [7] }
  }, T0);
  assert.strictEqual(r.current.cond, 'partly');
  assert.strictEqual(r.current.precipProb, 10);
  assert.strictEqual(r.daily[0].date, '2026-10-28');
  assert.strictEqual(r.hourly[1].cond, 'lightrain');
});

run('მოდელს „ახლანდელი“ თუ არ აქვს — ვიღებთ უახლოეს საათს', () => {
  const sec = T0 / 1000;
  const r = P.parseOpenMeteo({
    utc_offset_seconds: 14400,
    current: { temperature_2m: null, weather_code: null },
    hourly: { time: [sec, sec + 3600, sec + 7200], temperature_2m: [12, 13, null], weather_code: [3, 3, null],
      precipitation_probability: [null, null, null], precipitation: [0, 0, null], wind_speed_10m: [2, 2, null] },
    daily: { time: [Date.parse('2026-10-27T20:00:00Z') / 1000, Date.parse('2026-10-28T20:00:00Z') / 1000],
      weather_code: [3, null], temperature_2m_max: [15, null], temperature_2m_min: [7, null],
      precipitation_sum: [0, null], precipitation_probability_max: [null, null], wind_speed_10m_max: [4, null] }
  }, T0);
  assert.strictEqual(r.current.temp, 12);
  assert.strictEqual(r.current.cond, 'cloudy');
  assert.strictEqual(r.hourly.length, 2);  // მოდელის ჰორიზონტს მიღმა ცარიელი საათები იშლება
  assert.strictEqual(r.daily.length, 1);
});

run('5 წყარო, ყველა გასაღების გარეშე', () => {
  assert.deepStrictEqual(P.SOURCES.map(s => s.id), ['yr', 'ecmwf', 'gfs', 'icon', 'ukmo']);
  P.SOURCES.forEach(s => assert.strictEqual(s.key, undefined));
});

/* ---------- საერთო პროგნოზი ---------- */

run('საერთო საათობრივი: OpenWeatherMap-ის სამსაათიანი სერია ავსებს შუა საათებს', () => {
  const hours = [T0, T0 + H, T0 + 2 * H];
  const hourly = (temps) => temps.map((t, i) => ({ t: T0 + i * H, temp: t, cond: 'clear', precipProb: 0 }));
  const owm = [{ t: T0, temp: 20, cond: 'clear', precipProb: 0 }, { t: T0 + 3 * H, temp: 20, cond: 'clear', precipProb: 0 }];
  const r = W.combineHourly(hours, { a: hourly([10, 11, 12]), b: hourly([12, 13, 14]), owm });
  assert.deepStrictEqual(r.map(x => x.sources), [3, 3, 3]);
  assert.strictEqual(r[0].temp, 12);
  assert.strictEqual(r[0].agreement.key, 'low'); // 10…20 → გაბნევა 10°
});

run('საერთო დღიური: წყაროების რაოდენობა დღის მიხედვით', () => {
  const r = W.combineDaily(['2026-10-28', '2026-11-03'], {
    a: [{ date: '2026-10-28', tmin: 8, tmax: 16, cond: 'rain', precipProb: 60 }, { date: '2026-11-03', tmin: 5, tmax: 12, cond: 'clear', precipProb: 0 }],
    b: [{ date: '2026-10-28', tmin: 9, tmax: 17, cond: 'rain', precipProb: 70 }],
    c: [{ date: '2026-10-28', tmin: 7, tmax: 15, cond: 'lightrain', precipProb: 80 }]
  });
  assert.strictEqual(r[0].sources, 3);
  assert.strictEqual(r[0].tmax, 16);
  assert.strictEqual(r[0].cond, 'rain');
  assert.strictEqual(r[0].precipProb, 70);
  assert.strictEqual(r[0].agreement.key, 'mid'); // 2/3 ხმა rain-ზე
  assert.strictEqual(r[1].sources, 1);
  assert.strictEqual(r[1].agreement.level, null);
});

run('მიმდინარე საერთო', () => {
  const c = W.combineCurrent([
    { temp: 14, cond: 'partly', humidity: 60, wind: 3, precipProb: 10 },
    { temp: 15, cond: 'partly', humidity: 62, wind: 4, precipProb: 20 },
    null,
    { temp: 15.5, cond: 'cloudy', humidity: 58, wind: 3.5, precipProb: 30 }
  ]);
  assert.strictEqual(c.temp, 15);
  assert.strictEqual(c.cond, 'partly');
  assert.strictEqual(c.precipProb, 20);
  assert.strictEqual(c.sources, 3);
  assert.deepStrictEqual([c.tempMin, c.tempMax], [14, 15.5]);
});

/* ---------- შეწონვა და ქარი ---------- */

run('შეწონილი მედიანა: თანაბარ წონაზე ჩვეულებრივი მედიანაა', () => {
  assert.strictEqual(W.weightedMedian([{ v: 1, w: 1 }, { v: 2, w: 1 }, { v: 10, w: 1 }]), 2);
  assert.strictEqual(W.weightedMedian([{ v: 1, w: 1 }, { v: 3, w: 1 }]), 2);
  // ზუსტ წყაროს (დიდი წონა) მეტი გავლენა აქვს
  assert.strictEqual(W.weightedMedian([{ v: 10, w: 3 }, { v: 12, w: 1 }, { v: 14, w: 1 }]), 10);
});

run('ქარის მიმართულების წრიული საშუალო', () => {
  assert.ok(Math.abs(W.circularMean([350, 10]) % 360) < 1e-6 || Math.abs(W.circularMean([350, 10]) - 360) < 1e-6);
  assert.ok(Math.abs(W.circularMean([80, 100]) - 90) < 1e-6);
  assert.strictEqual(W.circularMean([]), null);
});

run('საერთო პროგნოზი წონებით', () => {
  const c = W.combineCurrent({ a: { temp: 10 }, b: { temp: 14 }, c: { temp: 15 } }, { a: 5, b: 1, c: 1 });
  assert.strictEqual(c.temp, 10);
  assert.strictEqual(W.combineCurrent({ a: { temp: 10 }, b: { temp: 14 }, c: { temp: 15 } }).temp, 14);
});

/* ---------- მზე და მთვარე ---------- */

run('მზის ამოსვლა/ჩასვლა თბილისში (±5 წთ)', () => {
  const tz = { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  const s = A.sunTimes('2026-06-21', 41.6941, 44.8337);
  const rise = new Date(s.sunrise).toLocaleTimeString('en-GB', tz), set = new Date(s.sunset).toLocaleTimeString('en-GB', tz);
  // timeanddate.com: 05:28 / 20:39
  const mins = x => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  assert.ok(Math.abs(mins(rise) - (5 * 60 + 28)) <= 5, rise);
  assert.ok(Math.abs(mins(set) - (20 * 60 + 39)) <= 5, set);
  assert.strictEqual(A.sunTimes('2026-12-21', 78, 15).polar, 'night');
});

run('მთვარის ფაზა', () => {
  // 2026-01-03 — სავსე მთვარე, 2026-01-18 — ახალი მთვარე
  assert.strictEqual(A.moonPhase(Date.UTC(2026, 0, 3, 10)).key, 'full');
  assert.strictEqual(A.moonPhase(Date.UTC(2026, 0, 18, 19)).key, 'new');
});

/* ---------- რჩევები ---------- */

run('შეგრძნებითი ტემპერატურა: ქარი აცივებს', () => {
  assert.ok(X.feelsLike(5, 70, 8) < X.feelsLike(5, 70, 0));
  assert.ok(X.feelsLike(30, 80, 1) > 30);
});

run('რა ჩავიცვა', () => {
  const hours = [0, 1, 2].map(i => ({ temp: 2 + i, humidity: 80, wind: 2, precipProb: 70, cond: 'rain' }));
  const a = X.wearAdvice(hours, 1);
  assert.strictEqual(a.layer, 'cold');
  assert.ok(a.extras.includes('umbrella'));
  const hot = X.wearAdvice([{ temp: 31, humidity: 40, wind: 1, precipProb: 0, cond: 'clear' }], 8);
  assert.strictEqual(hot.layer, 'hot');
  assert.ok(hot.extras.includes('sunscreen'));
});

run('გაფრთხილებები: ქარი, ყინვა, თოვლი, ნისლი', () => {
  const hourly = [{ t: T0, temp: 0, gust: 26, precip: 0.5, cond: 'rain' }];
  const daily = [{ date: '2026-10-28', tmin: -9, tmax: 2, precip: 3 }];
  const det = { hourly: [{ t: T0, visibility: 150 }], daily: [{ date: '2026-10-28', snowfall: 12 }] };
  const types = X.alerts(hourly, daily, det, 10).map(a => a.type + ':' + a.level);
  ['wind:red', 'ice:orange', 'frost:orange', 'snow:orange', 'fog:orange'].forEach(x => assert.ok(types.includes(x), x + ' in ' + types));
  assert.strictEqual(X.alerts(hourly, daily, det, 10)[0].level, 'red');
});

run('საუკეთესო დღე', () => {
  const days = [
    { date: 'd0', tmax: 14, precipProb: 90, precip: 8, cond: 'rain', wind: 3 },
    { date: 'd1', tmax: 24, precipProb: 0, precip: 0, cond: 'clear', wind: 2 },
    { date: 'd2', tmax: 22, precipProb: 5, precip: 0, cond: 'partly', wind: 3 },
    { date: 'd3', tmax: 20, precipProb: 10, precip: 0, cond: 'partly', wind: 3 }
  ];
  const b = X.bestDays(days);
  assert.strictEqual(b.picnic.date, 'd1');
  assert.strictEqual(b.carwash.date, 'd1');
  assert.strictEqual(X.bestDays([days[0]]).picnic, null);
});

run('გუშინდელთან შედარება', () => {
  assert.strictEqual(X.vsYesterday([{ t: T0 - 24 * H, temp: 10 }, { t: T0, temp: 6 }], T0), -4);
  assert.strictEqual(X.vsYesterday([{ t: T0, temp: 6 }], T0), null);
});

run('ჰაერი და UV დონეები', () => {
  assert.strictEqual(X.aqiLevel(15), 'good');
  assert.strictEqual(X.aqiLevel(65), 'poor');
  assert.strictEqual(X.uvLevel(7), 'high');
  assert.strictEqual(X.uvLevel(null), null);
});

run('გზა და უღელტეხილი', () => {
  const hours = [{ t: T0, temp: -1, humidity: 95, precip: 0 }];
  assert.strictEqual(X.roadRisk(hours, null).level, 'danger');
  assert.strictEqual(X.roadRisk([{ t: T0, temp: 12, wind: 3 }], null).level, 'ok');
  const place = { elevation: 2379, hourly: [{ t: T0, temp: -6, snowfall: 6, precip: 1, visibility: 3000, gust: 10 }, { t: T0 + H, temp: -7, snowfall: 6, precip: 1, visibility: 3000, gust: 10 }] };
  assert.strictEqual(X.passStatus(place, T0).level, 'danger');
});

run('მთა: ტემპერატურა სიმაღლეზე და თოვლის შეჯამება', () => {
  assert.strictEqual(X.tempAtAltitude(10, 500, 2500), -3);
  const det = { elevation: 2200, hourly: [
    { t: T0 - H, snowDepth: 0.4, snowfall: 2, freezing: 1800 },
    { t: T0 + H, snowDepth: 0.4, snowfall: 5, freezing: 1700 }] };
  const m = X.mountainSummary(det, T0);
  assert.ok(Math.abs(m.snowDepth - 40) < 1e-9);
  assert.strictEqual(m.newSnow24, 5);
  assert.strictEqual(m.fallen24, 2);
  assert.strictEqual(m.relevant, true);
});

/* ---------- დამატებითი მონაცემები ---------- */

run('ისტორია: ნორმა და რეკორდი', () => {
  const time = [], hi = [], lo = [];
  for (let y = 1991; y <= 2024; y++) for (const md of ['11-05', '11-06', '11-07']) { time.push(y + '-' + md); hi.push(y === 2010 ? 25 : 14); lo.push(y === 1993 ? -8 : 4); }
  const h = E.buildHistory({ daily: { time, temperature_2m_max: hi, temperature_2m_min: lo } });
  assert.deepStrictEqual(h.days['11-06'].recHi, { v: 25, y: 2010 });
  assert.deepStrictEqual(h.days['11-06'].recLo, { v: -8, y: 1993 });
  assert.ok(h.days['11-06'].normHi > 14 && h.days['11-06'].normHi < 15);
  assert.deepStrictEqual(h.years, [1991, 2024]);
});

run('სიზუსტე: ცდომილება და წონები', () => {
  const rows = (err) => [...Array(24)].map((_, i) => ({ t: T0 + i * H, actual: 10, forecast: 10 + err * (i % 2 ? 1 : -1) }));
  const sc = E.scoreAccuracy({ a: rows(1), b: rows(2), c: rows(0.5) }, { yr: rows(1).map(r => ({ t: r.t, forecast: r.forecast })) });
  assert.strictEqual(sc.c.mae, 0.5);
  assert.strictEqual(sc.b.mae, 2);
  assert.strictEqual(sc.yr.mae, 1);
  const w = E.weightsFrom(sc, ['a', 'b', 'c', 'yr', 'zz']);
  assert.ok(w.c > w.a && w.a > w.b);
  assert.strictEqual(w.zz, 1);
  assert.strictEqual(E.weightsFrom({}, ['a', 'b']), null);
});

run('რამდენიმე ადგილის პასუხი და ჰაერის ხარისხი', () => {
  const p = E.parsePlace({ elevation: 2340, hourly: { time: [1, 2], temperature_2m: [-3, -4], snowfall: [0, 1] }, daily: {} });
  assert.strictEqual(p.elevation, 2340);
  assert.strictEqual(p.hourly[1].snowfall, 1);
  assert.strictEqual(p.hourly[1].visibility, null);
  const air = E.parseAir({ current: { european_aqi: 25, pm2_5: 3.1, uv_index: 0.4 }, hourly: { time: [1], uv_index: [2] } });
  assert.deepStrictEqual([air.aqi, air.pm25, air.uv, air.hourly[0].uv], [25, 3.1, 0.4, 2]);
});

/* ---------- ენები და ერთეულები ---------- */

run('სამივე ენას ერთნაირი გასაღებები აქვს', () => {
  const ka = Object.keys(I.D.ka).sort();
  ['en', 'ru'].forEach(l => assert.deepStrictEqual(Object.keys(I.D[l]).sort(), ka, l));
  ['en', 'ru'].forEach(l => assert.deepStrictEqual(Object.keys(I.D[l].cond).sort(), Object.keys(I.D.ka.cond).sort()));
});

run('ერთეულები: °F, კმ/სთ, 12-საათიანი დრო', () => {
  I.setPrefs({ lang: 'en', temp: 'f', wind: 'kmh', time: '12' });
  assert.strictEqual(I.temp(20), '68°');
  assert.strictEqual(I.tempDelta(5), '9°');
  assert.strictEqual(I.wind(5), '18 km/h');
  assert.strictEqual(I.time(Date.UTC(2026, 0, 1, 14), 'Asia/Tbilisi'), '6:00 PM');
  I.setPrefs({ lang: 'ka', temp: 'c', wind: 'ms', time: '24' });
  assert.strictEqual(I.temp(20.4), '20°');
  assert.strictEqual(I.wind(5), '5 მ/წ');
  assert.strictEqual(I.t('feels', { t: '5°' }), 'შეიგრძნობა როგორც 5°');
});
