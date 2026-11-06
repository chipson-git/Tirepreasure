/*
 * Service worker:
 *  - აპის ფაილები მუშაობს ინტერნეტის გარეშეც (პროგნოზები ინახება localStorage-ში, app.js)
 *  - ფონური შემოწმება (Periodic Background Sync): თუ მომდევნო 2 საათში წვიმაა — შეტყობინება
 */
var CACHE = 'five-weather-v5';
var CONFIG_CACHE = 'five-weather-config';
var SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/i18n.js',
  'js/consensus.js',
  'js/providers.js',
  'js/extras.js',
  'js/insights.js',
  'js/astro.js',
  'js/chart.js',
  'js/map.js',
  'js/share.js',
  'js/notify.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== CONFIG_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// საკუთარი ფაილები: ჯერ ქსელი (რომ განახლება მაშინვე ჩანდეს), ქსელის გარეშე — ქეში
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});

/* ---------- შეტყობინებები ---------- */

var TEXT = {
  ka: { title: 'წვიმა იწყება', body: '{place}: ნალექი მოსალოდნელია {time}-დან', here: 'შენს ადგილას' },
  en: { title: 'Rain is starting', body: '{place}: precipitation expected from {time}', here: 'Your location' },
  ru: { title: 'Начинается дождь', body: '{place}: осадки ожидаются с {time}', here: 'Ваше место' }
};

function readConfig() {
  return caches.open(CONFIG_CACHE).then(function (c) { return c.match('config'); })
    .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
}
function writeConfig(cfg) {
  return caches.open(CONFIG_CACHE).then(function (c) {
    return c.put('config', new Response(JSON.stringify(cfg), { headers: { 'Content-Type': 'application/json' } }));
  });
}

self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type !== 'notify-config') return;
  e.waitUntil(readConfig().then(function (old) {
    var cfg = old || {};
    cfg.enabled = !!d.enabled;
    if (d.loc) cfg.loc = d.loc;
    if (d.lang) cfg.lang = d.lang;
    return writeConfig(cfg);
  }));
});

function checkRain() {
  return readConfig().then(function (cfg) {
    if (!cfg || !cfg.enabled || !cfg.loc) return;
    var loc = cfg.loc;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4) +
      '&minutely_15=precipitation&hourly=precipitation_probability&forecast_hours=3&timeformat=unixtime&timezone=auto';
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var now = Date.now();
      var m = j.minutely_15 || {};
      var first = null;
      (m.time || []).forEach(function (sec, i) {
        var tms = sec * 1000;
        if (first == null && tms > now && tms <= now + 2 * 3600000 && m.precipitation[i] >= 0.2) first = tms;
      });
      // თუ ახლა უკვე წვიმს, შეტყობინება აღარ გვჭირდება
      var raining = (m.time || []).some(function (sec, i) { return Math.abs(sec * 1000 - now) <= 15 * 60000 && m.precipitation[i] >= 0.2; });
      if (first == null || raining) return;
      var key = loc.lat.toFixed(2) + ',' + loc.lon.toFixed(2) + ':' + Math.floor(first / (3 * 3600000));
      if (cfg.lastKey === key) return;
      cfg.lastKey = key;
      var tx = TEXT[cfg.lang] || TEXT.ka;
      var time = new Intl.DateTimeFormat('en-GB', { timeZone: loc.tz, hour: '2-digit', minute: '2-digit' }).format(new Date(first));
      var place = loc.name && loc.name !== '__gps__' ? loc.name : tx.here;
      return writeConfig(cfg).then(function () {
        return self.registration.showNotification(tx.title, {
          body: tx.body.replace('{place}', place).replace('{time}', time), tag: 'rain', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png'
        });
      });
    });
  }).catch(function () { /* ქსელი არ არის — შემდეგ ჯერზე */ });
}

self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'wx-check') e.waitUntil(checkRain());
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
