'use strict';
/* STRATA app-level integration test (no DOM — boot-critical paths).
   The full UI is e2e-tested in tests/e2e.js against real Chrome.
   Here: save/load/migration + boot sequence + first-fire + module parse checks.
   Run: node tests/ui.test.js */

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function T(name, cond) {
  console.log((cond ? '  ok - ' : '  FAIL - ') + name);
  cond ? pass++ : fail++;
}

/* ---------- Engine (the boot dependency) ---------- */
const STRATA = require('../engine.js');
if (!STRATA.defaultState) throw new Error('engine failed to load');

/* ---------- Module parse checks (boot-critical files) ---------- */
console.log('== Module syntax ==');
for (const f of ['fx.js', 'site.js', 'app.js', 'monetization.js', 'sw.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  let ok = true;
  try { new Function(src); } catch (e) { ok = false; console.log('   syntax error in ' + f + ': ' + e.message); }
  T(f + ' parses clean', ok);
}

/* ---------- localStorage mock + save system (mirrors app.js logic) ---------- */
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const SAVE_KEY = 'strata-save-v3';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return STRATA.defaultState();
    const state = STRATA.mergeDeep(STRATA.defaultState(), JSON.parse(raw));
    if (!Array.isArray(state.civs)) state.civs = [];
    return state;
  } catch (e) { return STRATA.defaultState(); }
}

console.log('== Save system (app.js mirror) ==');
{
  const fresh = loadSave();
  T('fresh save is default state', fresh.energy === 60 && fresh.civs.length === 0);

  const s = STRATA.defaultState();
  s.shards = 42;
  s.energy = 17.5;
  s.civs.push(STRATA.newCiv(STRATA.mulberry32(1), 'test theme'));
  s.museum.push({ id: 'a1', form: 'urn', value: 9 });
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  const loaded = loadSave();
  T('save round-trip: shards', loaded.shards === 42);
  T('save round-trip: civs', loaded.civs.length === 1 && loaded.civs[0].theme === 'test theme');
  T('save round-trip: museum', loaded.museum.length === 1 && loaded.museum[0].value === 9);

  localStorage.setItem(SAVE_KEY, '{corrupt');
  const fromCorrupt = loadSave();
  T('corrupt save → fresh default', fromCorrupt.energy === 60 && fromCorrupt.civs.length === 0);

  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, energy: 5, civs: [{ name: 'Old', alive: true, age: 10, population: 50, chronicle: [] }] }));
  const migrated = loadSave();
  T('old save migrates fields', migrated.energy === 5 && migrated.civs[0].name === 'Old');
  T('old save gains new defaults', typeof migrated.worldTheme === 'string' && Array.isArray(migrated.epitaphs));
}

console.log('== Boot sequence (tick → first-fire) ==');
{
  // clean slate for this section
  delete store[SAVE_KEY];
  const S = loadSave();
  const news = STRATA.tick(S, Date.now());
  if (S.civs.length === 0) {
    const rng = STRATA.mulberry32(STRATA.hashStr('first-fire:today'));
    const civ = STRATA.newCiv(rng, S.worldTheme);
    civ.chronicle.push({ age: 0, id: 'founding', txt: 'the first fires are lit' });
    S.civs.push(civ);
  }
  T('boot ends with one living civ', S.civs.length === 1 && S.civs[0].alive);
  T('boot civ carries founding event', S.civs[0].chronicle.length === 1);

  const S2 = loadSave();
  S2.civs.push(STRATA.newCiv(STRATA.mulberry32(2), 't'));
  STRATA.tick(S2, Date.now());
  T('existing save does not double-fire first civ', S2.civs.length === 1);
}

console.log('== Dig flow through app state ==');
{
  delete store[SAVE_KEY];
  const S = loadSave();
  const rng = STRATA.mulberry32(STRATA.hashStr('first-fire:today'));
  S.civs.push(STRATA.newCiv(rng, 't'));
  S.energy = 500;
  let artifacts = 0, strata = 0, shards = 0;
  for (let i = 0; i < 120; i++) {
    const r = STRATA.dig(S, Date.now() + i);
    if (r.ok) for (const res of r.results) {
      if (res.type === 'artifact') artifacts++;
      if (res.type === 'stratum') strata++;
      if (res.type === 'shards') shards += res.amount;
    }
  }
  console.log('  120 digs → ' + artifacts + ' artifacts, ' + strata + ' strata, ' + shards + ' shards');
  T('digs produce artifacts', artifacts > 0);
  T('shards accumulate', shards > 0);
  T('museum and dig stats consistent', S.museum.length === artifacts && S.stats.digs === 120);
}

console.log('\n=========================================');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
console.log('=========================================');
process.exit(fail > 0 ? 1 : 0);
