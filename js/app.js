(function () {
  'use strict';

  var C = window.TireCalc;
  var STORAGE_KEY = 'offroad-pressure-v1';

  var METRIC_WIDTHS = range(175, 335, 10);
  var METRIC_ASPECTS = range(40, 85, 5);
  var RIMS = range(13, 22, 1);
  var INCH_DIAMETERS = [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
  var INCH_WIDTHS = [8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5];

  var TIRE_PRESETS = [
    { label: '215/65 R16', size: { mode: 'metric', width: 215, aspect: 65, rim: 16 } },
    { label: '235/75 R15', size: { mode: 'metric', width: 235, aspect: 75, rim: 15 } },
    { label: '245/70 R16', size: { mode: 'metric', width: 245, aspect: 70, rim: 16 } },
    { label: '265/70 R16', size: { mode: 'metric', width: 265, aspect: 70, rim: 16 } },
    { label: '265/65 R17', size: { mode: 'metric', width: 265, aspect: 65, rim: 17 } },
    { label: '285/75 R16', size: { mode: 'metric', width: 285, aspect: 75, rim: 16 } },
    { label: '31x10.5 R15', size: { mode: 'inch', diameter: 31, width: 10.5, rim: 15 } },
    { label: '33x12.5 R15', size: { mode: 'inch', diameter: 33, width: 12.5, rim: 15 } },
    { label: '35x12.5 R17', size: { mode: 'inch', diameter: 35, width: 12.5, rim: 17 } },
    { label: '37x12.5 R17', size: { mode: 'inch', diameter: 37, width: 12.5, rim: 17 } }
  ];

  var VEHICLE_PRESETS = [
    { label: 'მცირე (Niva, Jimny)', kg: 1200 },
    { label: 'კროსოვერი (RAV4, Duster)', kg: 1550 },
    { label: 'პიკაპი (Hilux, L200)', kg: 2050 },
    { label: 'SUV (Pajero, Prado)', kg: 2200 },
    { label: 'დიდი (Land Cruiser, Patrol)', kg: 2700 }
  ];

  var defaults = {
    size: { mode: 'metric', width: 265, aspect: 70, rim: 16, diameter: 33, inchWidth: 12.5, inchRim: 15 },
    vehicleKg: 2200,
    cargoKg: 150,
    tireType: 'p',
    beadlock: false,
    surface: 'mud',
    placardFront: '',
    placardRear: ''
  };

  var state = load();

  function range(from, to, step) {
    var out = [];
    for (var v = from; v <= to; v += step) out.push(v);
    return out;
  }

  function $(id) { return document.getElementById(id); }

  function load() {
    var s = JSON.parse(JSON.stringify(defaults));
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.keys(defaults).forEach(function (k) { if (k in saved) s[k] = saved[k]; });
        s.size = Object.assign({}, defaults.size, saved.size || {});
      }
    } catch (e) { /* localStorage მიუწვდომელია — ვიყენებთ ნაგულისხმევს */ }
    return s;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function fillSelect(el, values, fmt) {
    el.innerHTML = values.map(function (v) {
      return '<option value="' + v + '">' + (fmt ? fmt(v) : v) + '</option>';
    }).join('');
  }

  function fmt1(v) { return v.toFixed(1); }
  function fmt0(v) { return String(Math.round(v)); }

  // ---------- ინიციალიზაცია ----------

  function init() {
    fillSelect($('m-width'), METRIC_WIDTHS);
    fillSelect($('m-aspect'), METRIC_ASPECTS);
    fillSelect($('m-rim'), RIMS, function (v) { return 'R' + v; });
    fillSelect($('i-diameter'), INCH_DIAMETERS, function (v) { return v + '″'; });
    fillSelect($('i-width'), INCH_WIDTHS, function (v) { return v + '″'; });
    fillSelect($('i-rim'), RIMS, function (v) { return 'R' + v; });

    $('tire-presets').innerHTML = TIRE_PRESETS.map(function (p, i) {
      return '<button type="button" class="chip" data-tire="' + i + '">' + p.label + '</button>';
    }).join('');

    $('vehicle-presets').innerHTML = VEHICLE_PRESETS.map(function (p, i) {
      return '<button type="button" class="chip" data-vehicle="' + i + '">' + p.label + '</button>';
    }).join('');

    $('surfaces').innerHTML = C.SURFACE_ORDER.map(function (key) {
      var s = C.SURFACES[key];
      return '<button type="button" class="surface" role="radio" data-surface="' + key + '">' +
        '<span class="s-icon">' + s.icon + '</span>' +
        '<span class="s-name">' + s.name + '</span></button>';
    }).join('');

    bind();
    syncInputs();
    render();
  }

  function bind() {
    document.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.size.mode = btn.dataset.mode;
        update();
      });
    });

    [['m-width', 'width'], ['m-aspect', 'aspect'], ['m-rim', 'rim'],
     ['i-diameter', 'diameter'], ['i-width', 'inchWidth'], ['i-rim', 'inchRim']].forEach(function (pair) {
      $(pair[0]).addEventListener('change', function (e) {
        state.size[pair[1]] = parseFloat(e.target.value);
        update();
      });
    });

    $('tire-presets').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tire]');
      if (!btn) return;
      var p = TIRE_PRESETS[+btn.dataset.tire].size;
      state.size.mode = p.mode;
      if (p.mode === 'metric') {
        state.size.width = p.width; state.size.aspect = p.aspect; state.size.rim = p.rim;
      } else {
        state.size.diameter = p.diameter; state.size.inchWidth = p.width; state.size.inchRim = p.rim;
      }
      update();
    });

    $('vehicle-presets').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-vehicle]');
      if (!btn) return;
      state.vehicleKg = VEHICLE_PRESETS[+btn.dataset.vehicle].kg;
      update();
    });

    $('vehicle-kg').addEventListener('input', function (e) {
      var v = parseFloat(e.target.value);
      if (v >= 500 && v <= 6000) { state.vehicleKg = v; update(true); }
    });
    $('cargo-kg').addEventListener('input', function (e) {
      state.cargoKg = parseFloat(e.target.value) || 0;
      update(true);
    });
    $('tire-type').addEventListener('change', function (e) { state.tireType = e.target.value; update(); });
    $('beadlock').addEventListener('change', function (e) { state.beadlock = e.target.checked; update(); });
    $('placard-front').addEventListener('input', function (e) { state.placardFront = e.target.value; update(true); });
    $('placard-rear').addEventListener('input', function (e) { state.placardRear = e.target.value; update(true); });

    $('surfaces').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-surface]');
      if (!btn) return;
      state.surface = btn.dataset.surface;
      update();
    });

    // კონვერტერი
    var convBar = $('conv-bar'), convPsi = $('conv-psi');
    convPsi.value = fmt1(C.barToPsi(parseFloat(convBar.value)));
    convBar.addEventListener('input', function () {
      var v = parseFloat(convBar.value);
      convPsi.value = isFinite(v) ? fmt1(C.barToPsi(v)) : '';
    });
    convPsi.addEventListener('input', function () {
      var v = parseFloat(convPsi.value);
      convBar.value = isFinite(v) ? C.psiToBar(v).toFixed(2) : '';
    });
  }

  // typing=true — არ ვწერთ ველში, რომ მომხმარებელს კურსორი არ აერიოს
  function update(typing) {
    save();
    if (!typing) syncInputs();
    render();
  }

  function syncInputs() {
    var s = state.size;
    document.querySelectorAll('.seg-btn').forEach(function (b) {
      var on = b.dataset.mode === s.mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    $('metric-fields').classList.toggle('hidden', s.mode !== 'metric');
    $('inch-fields').classList.toggle('hidden', s.mode !== 'inch');
    $('m-width').value = s.width;
    $('m-aspect').value = s.aspect;
    $('m-rim').value = s.rim;
    $('i-diameter').value = s.diameter;
    $('i-width').value = s.inchWidth;
    $('i-rim').value = s.inchRim;

    $('vehicle-kg').value = state.vehicleKg;
    $('cargo-kg').value = state.cargoKg;
    $('tire-type').value = state.tireType;
    $('beadlock').checked = !!state.beadlock;
    $('placard-front').value = state.placardFront;
    $('placard-rear').value = state.placardRear;
    if (state.placardFront || state.placardRear) $('h-car').parentNode.querySelector('details').open = true;
  }

  function currentSize() {
    var s = state.size;
    return s.mode === 'inch'
      ? { mode: 'inch', diameter: s.diameter, width: s.inchWidth, rim: s.inchRim }
      : { mode: 'metric', width: s.width, aspect: s.aspect, rim: s.rim };
  }

  function sizeLabel() {
    var s = state.size;
    return s.mode === 'inch'
      ? s.diameter + 'x' + s.inchWidth + ' R' + s.inchRim
      : s.width + '/' + s.aspect + ' R' + s.rim;
  }

  function placardPsi(v) {
    var bar = parseFloat(v);
    return bar >= 1 && bar <= 6 ? C.barToPsi(bar) : 0;
  }

  // ---------- რენდერი ----------

  function render() {
    $('cargo-out').textContent = state.cargoKg + ' კგ';

    document.querySelectorAll('[data-surface]').forEach(function (b) {
      var on = b.dataset.surface === state.surface;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });

    var label = sizeLabel();
    document.querySelectorAll('[data-tire]').forEach(function (b) {
      b.classList.toggle('active', TIRE_PRESETS[+b.dataset.tire].label === label);
    });
    document.querySelectorAll('[data-vehicle]').forEach(function (b) {
      b.classList.toggle('active', VEHICLE_PRESETS[+b.dataset.vehicle].kg === state.vehicleKg);
    });

    var r = C.calculate({
      size: currentSize(),
      vehicleKg: state.vehicleKg,
      cargoKg: state.cargoKg,
      tireType: state.tireType,
      beadlock: state.beadlock,
      surface: state.surface,
      placardFrontPsi: placardPsi(state.placardFront),
      placardRearPsi: placardPsi(state.placardRear)
    });
    if (!r) return;

    var g = r.geom;
    $('geom').innerHTML =
      geomItem('ზომა', label) +
      geomItem('დიამეტრი', Math.round(g.diameterMm) + ' მმ · ' + g.diameterIn.toFixed(1) + '″') +
      geomItem('გვერდითი კედელი', Math.round(g.sidewallMm) + ' მმ') +
      geomItem('სიგანე', Math.round(g.widthMm) + ' მმ') +
      geomItem('ბრუნი / კმ', Math.round(g.revsPerKm)) +
      geomItem('ჰაერის მოცულობა', '≈ ' + Math.round(g.volumeL) + ' ლ');

    $('res-surface').textContent = r.surface.icon + ' ' + r.surface.name;
    $('front-bar').textContent = r.front.bar.toFixed(1);
    $('front-psi').textContent = fmt0(r.front.psi);
    $('rear-bar').textContent = r.rear.bar.toFixed(1);
    $('rear-psi').textContent = fmt0(r.rear.psi);
    $('front-range').textContent = rangeText(r.front);
    $('rear-range').textContent = rangeText(r.rear);

    $('speed-pill').textContent = r.surface.maxSpeed
      ? '🚙 მაქს. სიჩქარე: ' + r.surface.maxSpeed + ' კმ/სთ'
      : '🚙 ჩვეულებრივი სიჩქარე';
    var drop = Math.round((1 - r.front.psi / r.road.frontPsi) * 100);
    $('drop-pill').textContent = drop > 0
      ? '⬇️ გზის წნევიდან −' + drop + '%'
      : '✅ გზის წნევა: ' + C.psiToBar(r.road.frontPsi).toFixed(1) + ' / ' + C.psiToBar(r.road.rearPsi).toFixed(1) + ' bar';

    $('surface-tip').textContent = '💡 ' + r.surface.tip;
    $('warnings').innerHTML = r.warnings.map(function (w) { return '<li>' + w + '</li>'; }).join('');

    $('table-body').innerHTML = r.table.map(function (row) {
      return '<tr class="' + (row.key === r.surfaceKey ? 'current' : '') + '" data-surface="' + row.key + '">' +
        '<td>' + row.surface.icon + ' ' + row.surface.name + '</td>' +
        '<td><b>' + row.front.bar.toFixed(1) + '</b></td>' +
        '<td>' + fmt0(row.front.psi) + '</td>' +
        '<td><b>' + row.rear.bar.toFixed(1) + '</b></td>' +
        '<td>' + fmt0(row.rear.psi) + '</td>' +
        '<td>' + (row.surface.maxSpeed ? row.surface.maxSpeed + ' კმ/სთ' : '—') + '</td></tr>';
    }).join('');
  }

  function geomItem(k, v) {
    return '<div class="geom-item"><span>' + k + '</span><b>' + v + '</b></div>';
  }

  function rangeText(p) {
    return 'დიაპაზონი: ' + p.barLo.toFixed(1) + '–' + p.barHi.toFixed(1) + ' bar (' +
      fmt0(p.psiLo) + '–' + fmt0(p.psiHi) + ' psi)';
  }

  // ცხრილის მწკრივზე დაჭერით საფარის არჩევა
  document.addEventListener('click', function (e) {
    var row = e.target.closest('#table-body tr[data-surface]');
    if (!row) return;
    state.surface = row.dataset.surface;
    update();
    $('h-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  init();
})();
