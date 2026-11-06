/*
 * ნალექის რადარი და თანამგზავრი რუკაზე (Leaflet + RainViewer).
 * Leaflet იტვირთება მხოლოდ მაშინ, როცა რუკის ჩანართს პირველად გახსნი.
 */
(function (root) {
  'use strict';

  var RADAR_MAX_ZOOM = 7;   // RainViewer-ის უფასო ფილები 7-ე ზუმამდეა
  var map = null, base = null, frames = [], layers = [], idx = 0, timer = null, kind = 'radar', meta = null, ui = null, dark = false;
  var loading = null;

  function loadLeaflet() {
    if (root.L) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'vendor/leaflet/leaflet.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'vendor/leaflet/leaflet.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { loading = null; reject(new Error('leaflet')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function baseUrl() {
    return 'https://{s}.basemaps.cartocdn.com/' + (dark ? 'dark_all' : 'light_all') + '/{z}/{x}/{y}{r}.png';
  }

  function setBase() {
    if (!map) return;
    if (base) map.removeLayer(base);
    base = root.L.tileLayer(baseUrl(), {
      maxZoom: 12, subdomains: 'abcd',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
    }).addTo(map);
    base.bringToBack();
  }

  function tileUrl(f) {
    if (kind === 'satellite') return meta.host + f.path + '/256/{z}/{x}/{y}/0/0_0.png';
    return meta.host + f.path + '/256/{z}/{x}/{y}/2/1_1.png';
  }

  function clearFrames() {
    layers.forEach(function (l) { if (l) map.removeLayer(l); });
    layers = [];
  }

  function buildFrames() {
    clearFrames();
    frames = (kind === 'satellite' ? meta.satellite : meta.frames) || [];
    layers = frames.map(function () { return null; });
    var range = ui.range();
    range.max = Math.max(0, frames.length - 1);
    showFrame(frames.length - 1);
  }

  function layerFor(i) {
    if (!layers[i]) {
      layers[i] = root.L.tileLayer(tileUrl(frames[i]), {
        opacity: 0, maxNativeZoom: RADAR_MAX_ZOOM, maxZoom: 12, zIndex: 10,
        attribution: '<a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>'
      }).addTo(map);
    }
    return layers[i];
  }

  function showFrame(i) {
    if (!frames.length) { ui.label().textContent = '—'; return; }
    idx = (i + frames.length) % frames.length;
    layers.forEach(function (l, j) { if (l && j !== idx) l.setOpacity(0); });
    layerFor(idx).setOpacity(kind === 'satellite' ? 0.6 : 0.75);
    layerFor((idx + 1) % frames.length);   // შემდეგი კადრი წინასწარ
    ui.range().value = idx;
    ui.label().textContent = ui.time(frames[idx].time);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    ui.play().textContent = ui.t('play');
  }
  function play() {
    if (timer) { stop(); return; }
    ui.play().textContent = ui.t('pause');
    timer = setInterval(function () { showFrame(idx + 1); }, 700);
  }

  function show(el, loc, get, uiApi) {
    ui = uiApi;
    loadLeaflet().then(function () {
      if (!map) {
        map = root.L.map(el, { zoomControl: true, attributionControl: true }).setView([loc.lat, loc.lon], 7);
        root.L.circleMarker([loc.lat, loc.lon], { radius: 6, weight: 2, color: '#2563eb', fillOpacity: 0.9 }).addTo(map);
        setBase();
        ui.play().addEventListener('click', play);
        ui.range().addEventListener('input', function () { stop(); showFrame(Number(this.value)); });
      } else {
        map.invalidateSize();
      }
      return get('https://api.rainviewer.com/public/weather-maps.json');
    }).then(function (j) {
      meta = {
        host: j.host,
        frames: ((j.radar && j.radar.past) || []).map(function (f) { return { time: f.time * 1000, path: f.path }; }),
        satellite: ((j.satellite && j.satellite.infrared) || []).map(function (f) { return { time: f.time * 1000, path: f.path }; })
      };
      buildFrames();
    }).catch(function () { if (ui && ui.fail) ui.fail(); });
  }

  function center(loc) {
    if (map) map.setView([loc.lat, loc.lon], Math.max(map.getZoom(), 6));
  }

  function setLayer(k) {
    kind = k;
    if (map && meta) { stop(); buildFrames(); }
  }

  function setTheme(isDark) {
    if (dark === isDark) return;
    dark = isDark;
    setBase();
  }

  root.WeatherMap = { show: show, center: center, setLayer: setLayer, setTheme: setTheme };
})(window);
