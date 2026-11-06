/*
 * შეტყობინებები: წვიმა მომდევნო 2 საათში და საშიში ამინდის გაფრთხილებები.
 *  - აპის გახსნისას (ყველგან, iPhone-ზეც, თუ აპი მთავარ ეკრანზეა დაყენებული)
 *  - ფონურად, აპის დახურვის შემდეგაც — სადაც ბრაუზერი Periodic Background Sync-ს უჭერს მხარს
 *    (Chrome/Edge Android-ზე და კომპიუტერზე, დაყენებული აპისთვის). ამას sw.js აკეთებს.
 * ერთი და იგივე შეტყობინება ორჯერ არ მოდის.
 */
(function (root) {
  'use strict';

  var SENT_KEY = 'wx-notified-v1';
  var HOUR = 3600000;

  function supported() { return 'Notification' in root && 'serviceWorker' in navigator; }

  function load() { try { return JSON.parse(localStorage.getItem(SENT_KEY)) || {}; } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem(SENT_KEY, JSON.stringify(v)); } catch (e) { /* */ } }

  // ლოკაციას ვუგზავნით service worker-ს, რომ ფონურ შემოწმებას ჰქონდეს
  function tellWorker(loc, enabled, lang) {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(function (reg) {
      if (reg.active) reg.active.postMessage({ type: 'notify-config', loc: loc, enabled: enabled, lang: lang });
    }).catch(function () { /* */ });
  }

  function registerPeriodic() {
    return navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.periodicSync) return false;
      return navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (st) {
        if (st.state !== 'granted') return false;
        return reg.periodicSync.register('wx-check', { minInterval: HOUR }).then(function () { return true; });
      });
    }).catch(function () { return false; });
  }

  function enable(loc) {
    if (!supported()) return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') return false;
      tellWorker(loc, true, root.I18N ? root.I18N.prefs.lang : 'ka');
      registerPeriodic();
      return true;
    });
  }

  function disable() {
    tellWorker(null, false);
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(function (reg) {
        if (reg.periodicSync) reg.periodicSync.unregister('wx-check');
      }).catch(function () { /* */ });
    }
  }

  function statusText(t) {
    if (!supported()) return t('notifyNA');
    if (Notification.permission === 'denied') return t('notifyDenied');
    return Notification.permission === 'granted' ? t('notifyOn') : '';
  }

  function show(title, body, tag) {
    navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification(title, { body: body, tag: tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    }).catch(function () { /* */ });
  }

  var lastLoc = null;
  /** ყოველი რენდერის შემდეგ: ვამოწმებთ, ხომ არ გვჭირდება შეტყობინება. */
  function check(ctx) {
    if (!ctx.enabled || !supported() || Notification.permission !== 'granted') return;
    var locId = ctx.loc.lat.toFixed(2) + ',' + ctx.loc.lon.toFixed(2);
    if (locId !== lastLoc) { lastLoc = locId; tellWorker(ctx.loc, true, root.I18N ? root.I18N.prefs.lang : 'ka'); }
    var sent = load();
    var now = Date.now();
    Object.keys(sent).forEach(function (k) { if (sent[k] < now - 24 * HOUR) delete sent[k]; });

    // წვიმა მომდევნო 2 საათში, თუ ახლა არ წვიმს
    var soon = ctx.hourly.filter(function (h) { return h.t > now && h.t <= now + 2 * HOUR; });
    var wetNow = ctx.hourly[0] && /rain|snow|sleet|thunder/.test(ctx.hourly[0].cond || '') && ctx.hourly[0].t <= now + HOUR;
    var rain = soon.filter(function (h) { return (h.precipProb != null && h.precipProb >= 60) || (h.precip != null && h.precip >= 0.3); })[0];
    if (rain && !wetNow) {
      var key = 'rain:' + locId + ':' + Math.floor(rain.t / (3 * HOUR));
      if (!sent[key]) {
        sent[key] = now;
        show(ctx.t('notifyRainTitle'), ctx.t('notifyRainBody', { place: ctx.placeName, time: ctx.time(rain.t), p: rain.precipProb != null ? Math.round(rain.precipProb) + '%' : '' }), 'rain');
      }
    }
    ctx.alerts.filter(function (a) { return a.level !== 'yellow'; }).forEach(function (a) {
      var k = 'alert:' + locId + ':' + a.type + ':' + a.level + ':' + String(a.when).slice(0, 10);
      if (sent[k]) return;
      sent[k] = now;
      show(ctx.t('notifyAlertTitle', { place: ctx.placeName, x: ctx.t('lvl_' + a.level) }), ctx.text(a), 'alert-' + a.type);
    });
    save(sent);
  }

  root.WeatherNotify = { enable: enable, disable: disable, check: check, statusText: statusText };
})(window);
