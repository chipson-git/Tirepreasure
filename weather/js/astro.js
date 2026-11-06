/*
 * მზე და მთვარე: ამოსვლა/ჩასვლა, დღის ხანგრძლივობა, მთვარის ფაზა.
 * ითვლება ადგილზე (ქსელის გარეშე), NOAA-ს გამარტივებული ფორმულებით — სიზუსტე ~1–2 წთ.
 */
(function (root) {
  'use strict';

  var RAD = Math.PI / 180;
  var DAY = 86400000;

  function julian(ms) { return ms / DAY + 2440587.5; }

  /**
   * მზის ამოსვლა და ჩასვლა მოცემული ადგილობრივი თარიღისთვის.
   * dateStr — 'YYYY-MM-DD' (დღე, რომლის შუადღესაც ვითვლით UTC-ით), lat/lon — გრადუსებში.
   * აბრუნებს { sunrise, sunset (ms, UTC), dayLength (ms), polar: null|'day'|'night' }.
   */
  function sunTimes(dateStr, lat, lon) {
    var p = dateStr.split('-').map(Number);
    var noon = Date.UTC(p[0], p[1] - 1, p[2], 12) - lon / 360 * DAY;  // ადგილობრივი მზის შუადღე
    var n = Math.round(julian(noon) - 2451545.0);
    var jStar = n - lon / 360;
    var M = (357.5291 + 0.98560028 * jStar) % 360;
    var C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
    var L = (M + C + 180 + 102.9372) % 360;
    var jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
    var decl = Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD));
    var cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
    var transitMs = (jTransit - 2440587.5) * DAY;
    if (cosH > 1) return { sunrise: null, sunset: null, dayLength: 0, polar: 'night', noon: transitMs };
    if (cosH < -1) return { sunrise: null, sunset: null, dayLength: DAY, polar: 'day', noon: transitMs };
    var H = Math.acos(cosH) / RAD;
    var half = H / 360 * DAY;
    return { sunrise: transitMs - half, sunset: transitMs + half, dayLength: 2 * half, polar: null, noon: transitMs };
  }

  // ცნობილი ახალმთვარეობა: 2000-01-06 18:14 UTC
  var NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  var SYNODIC = 29.530588853;
  var PHASES = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];
  var PHASE_ICONS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

  /** მთვარის ფაზა: { age (დღე), fraction 0–1, illumination 0–1, key, icon, nextFull, nextNew } */
  function moonPhase(ms) {
    var age = ((ms - NEW_MOON) / DAY) % SYNODIC;
    if (age < 0) age += SYNODIC;
    var fraction = age / SYNODIC;
    var idx = Math.floor(fraction * 8 + 0.5) % 8;
    var illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
    var toFull = ((0.5 - fraction + 1) % 1) * SYNODIC;
    var toNew = ((1 - fraction) % 1) * SYNODIC;
    return {
      age: age, fraction: fraction, illumination: illumination,
      key: PHASES[idx], icon: PHASE_ICONS[idx],
      nextFull: ms + toFull * DAY, nextNew: ms + (toNew || SYNODIC) * DAY
    };
  }

  var api = { sunTimes: sunTimes, moonPhase: moonPhase, PHASES: PHASES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Astro = api;
})(typeof window !== 'undefined' ? window : this);
