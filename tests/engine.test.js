'use strict';
/* STRATA engine test battery — run: node tests/engine.test.js */

const E = require('../engine.js');
let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.log('  FAIL - ' + name); }
}

console.log('== RNG determinism ==');
{
  const a = E.mulberry32(1234), b = E.mulberry32(1234);
  let same = true;
  for (let i = 0; i < 1000; i++) if (a() !== b()) { same = false; break; }
  T('mulberry32 deterministic for 1000 draws', same);
  const c = E.mulberry32(1234);
  T('mulberry32 in [0,1)', Array.from({length:100}, c).every(v => v >= 0 && v < 1));
  T('hashStr stable', E.hashStr('hello') === E.hashStr('hello'));
  T('hashStr different for different strings', E.hashStr('hello') !== E.hashStr('hellp'));
  T('dailySeed same for same UTC day', E.dailySeed(new Date('2026-10-09T10:00:00Z')) === E.dailySeed(new Date('2026-10-09T23:00:00Z')));
  T('dailySeed differs across days', E.dailySeed(new Date('2026-10-09T10:00:00Z')) !== E.dailySeed(new Date('2026-10-10T00:00:00Z')));
}

console.log('== Civilization lifecycle ==');
{
  const rng = E.mulberry32(42);
  const civ = E.newCiv(rng, 'forgotten river valley');
  T('new civ alive', civ.alive === true);
  T('new civ has name', typeof civ.name === 'string' && civ.name.length > 2);
  T('new civ population in range', civ.population >= 30 && civ.population <= 99);
  T('new civ has 0-4 traits', civ.traits.length >= 0 && civ.traits.length <= 4);
  T('new civ starts age 0', civ.age === 0);

  const c2 = E.newCiv(E.mulberry32(42), 'forgotten river valley');
  const c3 = E.newCiv(E.mulberry32(42), 'forgotten river valley');
  E.advanceCiv(c2, 100, E.mulberry32(999));
  E.advanceCiv(c3, 100, E.mulberry32(999));
  T('advanceCiv deterministic (same seed → same state)', JSON.stringify(c2) === JSON.stringify(c3));

  T('civ ages by ~100y', c2.age >= 90 && c2.age <= 110);

  const c4 = E.newCiv(E.mulberry32(7), 'theme');
  E.advanceCiv(c4, 500, E.mulberry32(5));
  T('long sim produces chronicle entries', c4.chronicle.length > 3);

  const c5 = E.newCiv(E.mulberry32(1), 't');
  E.advanceCiv(c5, 10000, E.mulberry32(3));
  T('civ eventually dies in 10000 years', c5.alive === false);
  T('dead civ has cause', typeof c5.deathCause === 'string');
  T('dead civ gets strata depth', c5.strataDepth >= 1);

  const c6 = E.newCiv(E.mulberry32(1), 't');
  E.advanceCiv(c6, 300, E.mulberry32(2));
  T('population stays >= 5 and finite', Number.isFinite(c6.population) && c6.population >= 5);
}

console.log('== Survival statistics (1000 civs, 400y) ==');
{
  let alive = 0, maxAge = 0, minAge = Infinity;
  for (let i = 0; i < 1000; i++) {
    const civ = E.newCiv(E.mulberry32(i * 7919 + 13), 't');
    E.advanceCiv(civ, 400, E.mulberry32(i * 104729 + 7));
    if (civ.alive) alive++;
    maxAge = Math.max(maxAge, civ.age); minAge = Math.min(minAge, civ.age);
  }
  const rate = alive / 1000;
  console.log('    survival@400y = ' + (rate * 100).toFixed(1) + '%, ages ' + minAge + '-' + maxAge);
  T('survival neither 0% nor 100% (game is balanced)', rate > 0.05 && rate < 0.95);

  // lifespans distribution across a longer horizon
  let sum = 0, n = 0;
  for (let i = 0; i < 1000; i++) {
    const civ = E.newCiv(E.mulberry32(i * 7919 + 13), 't');
    E.advanceCiv(civ, 2000, E.mulberry32(i * 104729 + 7));
    if (!civ.alive) { sum += civ.age; n++; }
  }
  const mean = n ? sum / n : 0;
  console.log('    mean lifespan of the dead @2000y horizon: ' + mean.toFixed(0) + 'y (n=' + n + ')');
  T('mean lifespan in a fun range (120-700y)', mean > 120 && mean < 700);
}

console.log('== Event scaling (realtime vs offline equivalence) ==');
{
  // 1 year in one call vs 100 tiny calls of 0.01y must feel similar
  const c1 = E.newCiv(E.mulberry32(42), 't');
  const r1 = E.mulberry32(777);
  for (let i = 0; i < 100; i++) E.advanceCiv(c1, 0.01, r1);
  const c2 = E.newCiv(E.mulberry32(42), 't');
  E.advanceCiv(c2, 1, E.mulberry32(777));
  T('micro-ticks age correctly (c1≈1y, c2=1y)', c1.age > 0.95 && c2.age >= 1);
}

console.log('== Artifacts ==');
{
  const civ = E.newCiv(E.mulberry32(42), 'sunken coastline');
  E.advanceCiv(civ, 300, E.mulberry32(9));
  const a1 = E.makeArtifact(civ, E.mulberry32(1));
  const a2 = E.makeArtifact(civ, E.mulberry32(1));
  T('artifact deterministic', JSON.stringify(a1) === JSON.stringify(a2));
  T('artifact has material', typeof a1.mat === 'string' && a1.mat.length > 0);
  T('artifact has form', typeof a1.form === 'string' && a1.form.length > 0);
  T('artifact value positive', a1.value >= 1);
  T('artifact icon present', typeof a1.icon === 'string' && a1.icon.length === 1);
  T('artifact bound to civ name', a1.civ === civ.name);
  T('artifact has story text', typeof a1.boundEvent === 'string' && a1.boundEvent.length > 0);
  T('artifact ids differ across rng', new Set([E.makeArtifact(civ, E.mulberry32(5)).id, E.makeArtifact(civ, E.mulberry32(6)).id, E.makeArtifact(civ, E.mulberry32(7)).id]).size === 3);
}

console.log('== Game state: tick ==');
{
  const s = E.defaultState();
  s.civs.push(E.newCiv(E.mulberry32(42), 't'));
  E.tick(s, Date.now());                    // cold start: sets the clock
  const news = E.tick(s, Date.now() + 10000); // +10s realtime
  T('tick advances civ age (~5y for 10s)', s.civs[0].age >= 4 && s.civs[0].age <= 8);
  T('tick updates lastTick', s.lastTick >= Date.now() - 5);

  const s2 = E.defaultState();
  s2.energy = 0;
  s2.lastSeedDay = new Date().toISOString().slice(0, 10); // prevent gift refill
  E.tick(s2, Date.now());                    // cold start
  E.tick(s2, Date.now() + 24000);
  T('energy regens ~2 per 24s', s2.energy >= 1.9 && s2.energy <= 2.2);

  const s3 = E.defaultState();
  s3.lastSeedDay = '2000-01-01';
  s3.lastTick = Date.now();
  const news3 = E.tick(s3, Date.now());
  T('day rollover detected', s3.dayIndex >= 1);
  T('day rollover news present', news3.some(n => n.type === 'newday'));
  T('daily gift refills energy', s3.energy === s3.energyMax);
  T('world theme set from UTC day seed', typeof s3.worldTheme === 'string' && s3.worldTheme.length > 0);

  // idle catch-up: 8 hours away → life goes on in the deep layer
  const s4 = E.defaultState();
  s4.lastSeedDay = new Date().toISOString().slice(0, 10); // prevent day-jump gift
  s4.civs.push(E.newCiv(E.mulberry32(3), 't'));
  E.tick(s4, Date.now());                    // cold start
  const before = s4.civs[0].age;
  E.tick(s4, Date.now() + 8 * 3600 * 1000);
  const gained = s4.civs[0].age - before;
  const died = !s4.civs[0].alive;
  const rose = s4.civs.length > 1 || s4.civs.some(c => c.alive);
  // total deep time = every civ that ever lived, including the dead
  const totalYears = s4.civs.reduce((sum, c) => sum + c.age, 0) + s4.epitaphs.reduce((sum, e) => sum + e.age, 0);
  const civsThatLived = s4.civs.length + s4.epitaphs.length;
  console.log('    8h idle → total deep time ' + totalYears.toFixed(0) + 'y across ' + civsThatLived + ' civilizations');
  // 8h = 14400y max; the unrecorded gap between civilizations absorbs the rest
  T('8h idle: most deep time is recorded (>=75%)', totalYears >= 10500 && totalYears <= 15500);
  T('multiple civilizations rise and fall in one idle night', civsThatLived >= 5);
  T('after 8h idle a civilization lives on (respawn works)', s4.civs.some(c => c && c.alive));
  T('death produces epitaph', died ? s4.epitaphs.length >= 1 : true);

  // 3 days idle (weekend away)
  const s5 = E.defaultState();
  s5.civs.push(E.newCiv(E.mulberry32(3), 't'));
  E.tick(s5, Date.now());                    // cold start
  E.tick(s5, Date.now() + 72 * 3600 * 1000);
  T('3-day idle: world still alive + epitaphs accumulate', s5.civs.some(c => c && c.alive) && s5.dayIndex >= 3);
}

console.log('== Game state: dig ==');
{
  const s = E.defaultState();
  s.civs.push(E.newCiv(E.mulberry32(42), 't'));
  s.energy = 60;
  const r1 = E.dig(s, Date.now());
  T('dig succeeds with energy', r1.ok === true);
  T('dig costs energy', s.energy === 59);

  s.energy = 0.5;
  const r2 = E.dig(s, Date.now());
  T('dig blocked when tired', r2.ok === false && r2.why === 'tired');

  const s2 = E.defaultState();
  const r3 = E.dig(s2, Date.now());
  T('dig blocked with no civs', r3.ok === false && r3.why === 'nociv');

  const s3 = E.defaultState();
  s3.civs.push(E.newCiv(E.mulberry32(2), 't'));
  s3.energy = 100000;
  let found = 0, leveled = 0, shardGain = 0;
  for (let i = 0; i < 500; i++) {
    const r = E.dig(s3, Date.now() + i);
    if (r.ok) {
      for (const res of r.results) {
        if (res.type === 'artifact') found++;
        if (res.type === 'stratum') leveled++;
        if (res.type === 'shards') shardGain += res.amount;
      }
    }
  }
  console.log('    500 digs → ' + found + ' artifacts, ' + leveled + ' stratum level-ups, ' + shardGain + ' shards');
  T('500 digs find artifacts', found > 10);
  T('500 digs level strata', leveled >= 3);
  T('museum grows', s3.museum.length === found);
  T('stats track digs', s3.stats.digs === 500);
  T('shards earned from digs', shardGain > 20);

  // determinism of dig outcomes given fixed time
  const sA = E.defaultState();
  sA.civs.push(E.newCiv(E.mulberry32(2), 't'));
  sA.energy = 50;
  const sB = E.defaultState();
  sB.civs.push(E.newCiv(E.mulberry32(2), 't'));
  sB.energy = 50;
  const rA = E.dig(sA, 123456);
  const rB = E.dig(sB, 123456);
  T('dig deterministic at same timestamp', JSON.stringify(rA.results) === JSON.stringify(rB.results));
}

console.log('== Game state: summon ==');
{
  const s = E.defaultState();
  const r1 = E.summonCiv(s, 1000000);
  T('first summon costs 20 shards', r1.ok === false && r1.cost === 20);
  s.shards = 100;
  const r2 = E.summonCiv(s, 1000000);
  T('summon works with shards', r2.ok === true);
  T('summon deducts cost', s.shards === 80);
  const r3 = E.summonCiv(s, 1000001);
  T('second summon costs more', r3.cost === 35);
  s.shards = 0;
  T('summon blocked without shards', E.summonCiv(s, 1000002).ok === false);

  // cap
  const s2 = E.defaultState();
  s2.shards = 100000;
  let summons = 0;
  for (let i = 0; i < 20; i++) {
    if (E.summonCiv(s2, 1000000 + i).ok) summons++;
  }
  console.log('    capped summons: ' + summons);
  T('civ slots capped at ' + E.CIVS_CAP, summons <= E.CIVS_CAP && s2.civs.length <= E.CIVS_CAP);
}

console.log('== Save/load robustness ==');
{
  const s = E.defaultState();
  s.shards = 77;
  s.civs.push(E.newCiv(E.mulberry32(42), 't'));
  const json = JSON.stringify(s);
  const loaded = JSON.parse(json);
  const merged = E.mergeDeep(E.defaultState(), loaded);
  T('roundtrip preserves shards', merged.shards === 77);
  T('roundtrip preserves civ count', merged.civs.length === 1);

  const oldSave = { gold: 5, civs: [{ name: 'X', alive: true, age: 10, population: 50, wealth: 10, cl: 0, chronicle: [], traits: [], theme: 't', reignStartAge: 0, reigns: 1, strataDepth: 0 }] };
  const m2 = E.mergeDeep(E.defaultState(), oldSave);
  T('old save merges without crash', m2.gold === 5 && m2.civs[0].name === 'X');
  T('old save gets new default fields', typeof m2.energy === 'number');

  const m3 = E.mergeDeep(E.defaultState(), null);
  T('null save → defaults', m3.shards === 0);
  const m4 = E.mergeDeep(E.defaultState(), { civs: 'garbage' });
  T('garbage field does not crash merge', m4 !== undefined);
}

console.log('== Merge edge: garbage civs array does not crash game loop ==');
{
  const s = E.defaultState();
  s.civs = 'garbage';
  let crashed = false;
  try { E.tick(s, Date.now() + 5000); } catch (e) { crashed = true; }
  T('tick survives garbage civs', crashed === false);
}

console.log('\n=========================================');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
console.log('=========================================');
process.exit(fail > 0 ? 1 : 0);
