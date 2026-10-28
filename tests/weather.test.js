// გაშვება: node tests/weather.test.js
const assert = require('assert');
const W = require('../weather/js/consensus.js');
const P = require('../weather/js/providers.js');

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
  assert.strictEqual(r.daily.length, 2);
  assert.strictEqual(r.daily[0].precip, 0.4);       // 6-საათიანი ნალექი ორჯერ არ ითვლება
  assert.strictEqual(r.daily[1].precip, 2);
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
