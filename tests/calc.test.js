// გაშვება: node tests/calc.test.js
const assert = require('assert');
const C = require('../js/calc.js');

const base = {
  size: { mode: 'metric', width: 265, aspect: 70, rim: 16 },
  vehicleKg: 2200, cargoKg: 0, tireType: 'p', beadlock: false, surface: 'asphalt'
};

function run(name, fn) {
  try { fn(); console.log('✓', name); }
  catch (e) { console.error('✗', name, '\n ', e.message); process.exitCode = 1; }
}

run('bar/psi კონვერტაცია', () => {
  assert.ok(Math.abs(C.barToPsi(1) - 14.5038) < 0.01);
  assert.ok(Math.abs(C.psiToBar(C.barToPsi(2.3)) - 2.3) < 1e-9);
});

run('მეტრული ზომის გეომეტრია', () => {
  const g = C.tireGeometry(base.size);
  assert.ok(Math.abs(g.sidewallMm - 185.5) < 0.01);
  assert.ok(Math.abs(g.diameterMm - 777.4) < 0.1);
});

run('ინჩური ზომის გეომეტრია', () => {
  const g = C.tireGeometry({ mode: 'inch', diameter: 33, width: 12.5, rim: 15 });
  assert.ok(Math.abs(g.diameterIn - 33) < 1e-9);
  assert.ok(Math.abs(g.widthMm - 317.5) < 1e-9);
});

run('გზის წნევა რეალისტურ დიაპაზონშია (1.8–3.5 bar)', () => {
  const r = C.calculate(base);
  [r.front.bar, r.rear.bar].forEach(b => assert.ok(b > 1.8 && b < 3.5, b));
});

run('საფარის მიხედვით წნევა იკლებს', () => {
  const p = s => C.calculate({ ...base, surface: s }).front.psi;
  assert.ok(p('asphalt') > p('gravel'));
  assert.ok(p('gravel') > p('dirt'));
  assert.ok(p('dirt') > p('mud'));
  assert.ok(p('mud') > p('sand'));
});

run('მინიმუმი ბიდლოკის გარეშე დაცულია', () => {
  const r = C.calculate({ ...base, vehicleKg: 900, surface: 'deepsnow' });
  assert.ok(r.front.psi >= C.TIRE_TYPES.p.minPsi);
  const bl = C.calculate({ ...base, vehicleKg: 900, surface: 'deepsnow', beadlock: true });
  assert.ok(bl.front.psi >= C.BEADLOCK_MIN_PSI);
  assert.ok(bl.front.psi <= r.front.psi);
});

run('ტვირთი ზრდის უკანა წნევას', () => {
  const empty = C.calculate(base);
  const loaded = C.calculate({ ...base, cargoKg: 600 });
  assert.ok(loaded.rear.psi > empty.rear.psi);
});

run('მწარმოებლის წნევა გამოიყენება როგორც საბაზისო', () => {
  const r = C.calculate({ ...base, placardFrontPsi: 30, placardRearPsi: 35 });
  assert.strictEqual(r.front.psi, 30);
  assert.strictEqual(r.rear.psi, 35);
});

run('დაბალი პროფილი ნაკლებად იწევს', () => {
  const tall = C.calculate({ ...base, surface: 'sand' });
  const low = C.calculate({ ...base, size: { mode: 'metric', width: 265, aspect: 45, rim: 20 }, surface: 'sand' });
  const ratio = r => r.front.psi / r.road.frontPsi;
  assert.ok(ratio(low) > ratio(tall));
});
