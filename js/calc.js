/*
 * საბურავის წნევის გამოთვლის ლოგიკა (UI-სგან დამოუკიდებელი).
 * მუშაობს როგორც ბრაუზერში (window.TireCalc), ისე Node-ში (module.exports).
 */
(function (root) {
  'use strict';

  var PSI_TO_BAR = 0.0689476;
  var MM_PER_INCH = 25.4;

  // საორიენტაციო საბურავი: 265/70 R16, 550 კგ თითო საბურავზე ≈ 33 psi გზაზე.
  var REF_PSI = 33;
  var REF_LOAD_KG = 550;
  var REF_VOLUME_L = 91.4;
  var REF_SIDEWALL_MM = 185;

  // factor — გზის წნევის რა ნაწილი რჩება; maxSpeed — რეკომენდებული მაქს. სიჩქარე (კმ/სთ).
  var SURFACES = {
    asphalt:  { name: 'ასფალტი',        icon: '🛣️', factor: 1.00, maxSpeed: null,
      tip: 'ჩვეულებრივი გზის წნევა. დაბალი წნევით ასფალტზე სიარული აზიანებს საბურავს და ზრდის საწვავის ხარჯს.' },
    ice:      { name: 'ყინული',          icon: '🧊', factor: 0.95, maxSpeed: 50,
      tip: 'ყინულზე წნევის დაწევა თითქმის არაფერს გაძლევს — მთავარია ზამთრის საბურავი ან ჯაჭვები.' },
    gravel:   { name: 'ხრეში',           icon: '🪨', factor: 0.85, maxSpeed: 60,
      tip: 'მცირედ დაწეული წნევა ამცირებს ვიბრაციას და ქვით გაჭრის რისკს.' },
    dirt:     { name: 'მიწის / ტყის გზა', icon: '🌲', factor: 0.75, maxSpeed: 50,
      tip: 'უკეთესი მოჭიდება და კომფორტი ორმოიან გზაზე.' },
    mud:      { name: 'ტალახი',          icon: '🟫', factor: 0.58, maxSpeed: 30,
      tip: 'ტალახში ძალიან დაბალი წნევა ყოველთვის არ შველის — საბურავს ჭამის გასუფთავებისთვის ბრუნვა სჭირდება. ერიდე მკვეთრ შემობრუნებას.' },
    snow:     { name: 'თოვლი',           icon: '❄️', factor: 0.62, maxSpeed: 40,
      tip: 'დატკეპნილ თოვლზე ზომიერი დაწევა საკმარისია. სიცივეში წნევა თავისით ეცემა (~0.1 bar ყოველ 10°C-ზე).' },
    deepsnow: { name: 'ღრმა თოვლი',      icon: '🏔️', factor: 0.42, maxSpeed: 25,
      tip: 'მაქსიმალური საკონტაქტო ფართი, რომ ავტომობილი თოვლზე „იცუროს“ და არ ჩაეფლოს.' },
    sand:     { name: 'ქვიშა',           icon: '🏜️', factor: 0.45, maxSpeed: 30,
      tip: 'ქვიშაზე წნევის დაწევა ყველაზე დიდ ეფექტს იძლევა. მოძრაობდი თანაბრად, ნუ დაამუხრუჭებ მკვეთრად.' },
    rocks:    { name: 'ქვები / კლდე',     icon: '⛰️', factor: 0.52, maxSpeed: 15,
      tip: 'დაბალი წნევა საბურავს აძლევს ქვაზე „შემოხვევის“ საშუალებას. იარე ძალიან ნელა, აკონტროლე გვერდითი კედლები.' }
  };

  var SURFACE_ORDER = ['asphalt', 'ice', 'gravel', 'dirt', 'mud', 'snow', 'deepsnow', 'sand', 'rocks'];

  var TIRE_TYPES = {
    p:  { name: 'SUV / A/T (P-metric)', loadMul: 1.00, minPsi: 15, maxRoad: 44 },
    lt: { name: 'LT (A/T, M/T, მძიმე)',  loadMul: 1.10, minPsi: 12, maxRoad: 60 }
  };
  var BEADLOCK_MIN_PSI = 6;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * საბურავის გეომეტრია.
   * metric: { mode:'metric', width:265, aspect:70, rim:16 }
   * inch:   { mode:'inch', diameter:33, width:12.5, rim:15 }
   */
  function tireGeometry(size) {
    var widthMm, sidewallMm, rimMm;
    if (size.mode === 'inch') {
      widthMm = size.width * MM_PER_INCH;
      rimMm = size.rim * MM_PER_INCH;
      sidewallMm = (size.diameter * MM_PER_INCH - rimMm) / 2;
    } else {
      widthMm = size.width;
      rimMm = size.rim * MM_PER_INCH;
      sidewallMm = size.width * size.aspect / 100;
    }
    if (!(widthMm > 0) || !(rimMm > 0) || !(sidewallMm > 0)) return null;

    var diameterMm = rimMm + 2 * sidewallMm;
    var outerR = diameterMm / 2;
    var rimR = rimMm / 2;
    // ჰაერის მოცულობის მიახლოებითი შეფასება (ცილინდრული რგოლი), ლიტრებში.
    var volumeL = Math.PI * (outerR * outerR - rimR * rimR) * widthMm / 1e6;

    return {
      widthMm: widthMm,
      sidewallMm: sidewallMm,
      diameterMm: diameterMm,
      diameterIn: diameterMm / MM_PER_INCH,
      circumferenceM: Math.PI * diameterMm / 1000,
      revsPerKm: 1e6 / (Math.PI * diameterMm),
      volumeL: volumeL
    };
  }

  /** გზის (ასფალტის) წნევა psi-ში ერთ საბურავზე მოსული დატვირთვისთვის. */
  function roadPsiFor(loadKg, geom, tireType) {
    var t = TIRE_TYPES[tireType] || TIRE_TYPES.p;
    var psi = REF_PSI *
      Math.pow(loadKg / REF_LOAD_KG, 0.85) *
      Math.pow(REF_VOLUME_L / geom.volumeL, 0.5) *
      t.loadMul;
    return clamp(psi, 26, t.maxRoad);
  }

  /** ღერძებზე წონის განაწილება: თვითონ მანქანა 55/45, ტვირთი 25/75. */
  function axleLoads(vehicleKg, cargoKg) {
    var front = vehicleKg * 0.55 + cargoKg * 0.25;
    var rear = vehicleKg * 0.45 + cargoKg * 0.75;
    return { frontTire: front / 2, rearTire: rear / 2 };
  }

  /**
   * დაბალი გვერდითი კედლის საბურავს ნაკლებად შეიძლება წნევის დაწევა
   * (დისკის დაზიანების და საბურავის ჩამოხტომის რისკი).
   */
  function surfaceFactor(surfaceKey, geom) {
    var base = SURFACES[surfaceKey].factor;
    var k = clamp(geom.sidewallMm / REF_SIDEWALL_MM, 0.6, 1.15);
    return 1 - (1 - base) * k;
  }

  function psiToBar(psi) { return psi * PSI_TO_BAR; }
  function barToPsi(bar) { return bar / PSI_TO_BAR; }

  function pressureFor(roadPsi, surfaceKey, geom, opts) {
    var t = TIRE_TYPES[opts.tireType] || TIRE_TYPES.p;
    var minPsi = opts.beadlock ? BEADLOCK_MIN_PSI : t.minPsi;
    var f = surfaceFactor(surfaceKey, geom);
    var psi = surfaceKey === 'asphalt' ? roadPsi : Math.max(roadPsi * f, minPsi);
    var spread = surfaceKey === 'asphalt' ? 0.04 : 0.1;
    var lo = Math.max(psi * (1 - spread), minPsi);
    var hi = Math.min(psi * (1 + spread), roadPsi);
    return {
      psi: psi, bar: psiToBar(psi),
      psiLo: lo, psiHi: Math.max(hi, psi),
      barLo: psiToBar(lo), barHi: psiToBar(Math.max(hi, psi)),
      atMinimum: psi <= minPsi + 0.01 && surfaceKey !== 'asphalt'
    };
  }

  /**
   * მთავარი გამოთვლა.
   * input = {
   *   size, vehicleKg, cargoKg, tireType:'p'|'lt', beadlock:boolean,
   *   surface, placardFrontPsi?, placardRearPsi?
   * }
   */
  function calculate(input) {
    var geom = tireGeometry(input.size);
    if (!geom) return null;
    var surface = SURFACES[input.surface] ? input.surface : 'asphalt';

    var loads = axleLoads(input.vehicleKg, input.cargoKg || 0);
    var roadFront = input.placardFrontPsi > 0 ? input.placardFrontPsi
      : roadPsiFor(loads.frontTire, geom, input.tireType);
    var roadRear = input.placardRearPsi > 0 ? input.placardRearPsi
      : roadPsiFor(loads.rearTire, geom, input.tireType);

    var opts = { tireType: input.tireType, beadlock: !!input.beadlock };
    var front = pressureFor(roadFront, surface, geom, opts);
    var rear = pressureFor(roadRear, surface, geom, opts);

    var table = SURFACE_ORDER.map(function (key) {
      return {
        key: key,
        surface: SURFACES[key],
        front: pressureFor(roadFront, key, geom, opts),
        rear: pressureFor(roadRear, key, geom, opts)
      };
    });

    var warnings = [];
    var minPsi = Math.min(front.psi, rear.psi);
    if (geom.sidewallMm < 140 && surface !== 'asphalt') {
      warnings.push('საბურავს დაბალი გვერდითი კედელი აქვს (' + Math.round(geom.sidewallMm) +
        ' მმ) — წნევის ძლიერი დაწევისას დისკი დაზიანების რისკის ქვეშაა. რეკომენდაცია უკვე შერბილებულია.');
    }
    if (minPsi < 18 && !input.beadlock) {
      warnings.push('დაბალ წნევაზე ნუ მოუხვევ მკვეთრად და ნუ აიღებ სიჩქარეს — საბურავი შეიძლება დისკიდან ჩამოხტეს.');
    }
    if (front.atMinimum || rear.atMinimum) {
      warnings.push('მიღწეულია უსაფრთხო მინიმუმი ' + (input.beadlock ? 'ბიდლოკით' : 'ბიდლოკის გარეშე') + '. უფრო დაბლა არ ჩამოხვიდე.');
    }
    if (surface !== 'asphalt') {
      warnings.push('ასფალტზე დაბრუნებამდე აუცილებლად აავსე საბურავები გზის წნევამდე (' +
        psiToBar(roadFront).toFixed(1) + ' / ' + psiToBar(roadRear).toFixed(1) + ' bar).');
    }

    return {
      geom: geom,
      surfaceKey: surface,
      surface: SURFACES[surface],
      road: { frontPsi: roadFront, rearPsi: roadRear },
      front: front,
      rear: rear,
      table: table,
      warnings: warnings
    };
  }

  var api = {
    SURFACES: SURFACES,
    SURFACE_ORDER: SURFACE_ORDER,
    TIRE_TYPES: TIRE_TYPES,
    BEADLOCK_MIN_PSI: BEADLOCK_MIN_PSI,
    tireGeometry: tireGeometry,
    roadPsiFor: roadPsiFor,
    axleLoads: axleLoads,
    psiToBar: psiToBar,
    barToPsi: barToPsi,
    calculate: calculate
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TireCalc = api;
})(typeof window !== 'undefined' ? window : this);
