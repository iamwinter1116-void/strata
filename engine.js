/* ============================================================
   STRATA — The Civilization Beneath
   Core engine: pure, deterministic, zero dependencies.
   A civilization that lives in real time while you sleep.
   ============================================================ */

'use strict';

/* ---------- Seeded RNG (mulberry32 — fast, deterministic) ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Hash any string to a 32-bit seed. Deterministic across platforms. */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------- Names & language ---------- */
const SYLLABLES_A = ['ka', 'ra', 'zu', 'tho', 'mi', 'no', 'sa', 'vel', 'ash', 'ur', 'ta', 'go', 're', 'xi', 'om', 'ha', 'ne', 'lu', 'bre', 'kr'];
const SYLLABLES_B = ['ron', 'dor', 'thal', 'mir', 'gorn', 'seth', 'lia', 'ven', 'tek', 'ara', 'ion', 'us', 'ek', 'ora', 'nth', 'ish', 'eld', 'uth', 'mar', 'quel'];
const GOVERNORS = ['Sun-Emperor', 'River-Queen', 'Ashen Council', 'Twin Prophets', 'Iron Chancellor', 'Lantern Order', 'Salt Consortium', 'Bronze Tribunal', 'Wolf Senate', 'Coral Throne'];
const THEMES = [
  'forgotten river valley', 'sunken coastline', 'high desert plateau', 'obsidian mountain pass',
  'endless cedar forest', 'frozen salt marsh', 'canyon of wind-carved stone', 'island of dead volcanoes',
];

function civName(rng) {
  const a = SYLLABLES_A[Math.floor(rng() * SYLLABLES_A.length)];
  const b = SYLLABLES_B[Math.floor(rng() * SYLLABLES_B.length)];
  const c = SYLLABLES_B[Math.floor(rng() * SYLLABLES_B.length)];
  let name = (a + b).replace(/^./, ch => ch.toUpperCase());
  if (rng() < 0.3) name += '-' + c.replace(/^./, ch => ch.toUpperCase());
  // rare disambiguator so the codex never shows identical names
  if (rng() < 0.18) name += ' ' + ['II', 'III', 'IV', 'V', 'the Younger', 'the Elder'][Math.floor(rng() * 6)];
  return name;
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

/* Deep-merge saved data over defaults so old saves keep working */
function mergeDeep(base, extra) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(extra)) {
    const b = base ? base[k] : undefined;
    const e = extra[k];
    if (e && typeof e === 'object' && !Array.isArray(e) && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = mergeDeep(b, e);
    } else {
      out[k] = clone(e);
    }
  }
  return out;
}

/* ---------- World seed: everyone digs the same theme today ---------- */
function dailySeed(date) {
  const iso = date.toISOString().slice(0, 10);
  return hashStr('strata-world-' + iso);
}

function dailyTheme(seed) {
  return THEMES[seed % THEMES.length];
}

/* ---------- Creating a civilization ---------- */
/* Endings are written as complete fates — the codex prints them verbatim. */
const ENDINGS = [
  'a great plague', 'conquest by strangers from the sea', 'the long drought',
  'a war of annihilation', 'an earthquake that broke their aqueducts',
  'they simply chose to leave', 'they were forgotten',
  'a poisoned well in the capital',
];

/* Grammar frames per fate family — no template collisions. */
const ENDING_FRAMES = {
  'a great plague': 'fell to a great plague',
  'conquest by strangers from the sea': 'was conquered by strangers from the sea',
  'the long drought': 'withered in the long drought',
  'a war of annihilation': 'burned in a war of annihilation',
  'an earthquake that broke their aqueducts': 'was broken by an earthquake that severed their aqueducts',
  'they simply chose to leave': 'did not die — they simply chose to leave',
  'they were forgotten': 'was not destroyed — it was forgotten',
  'a poisoned well in the capital': 'was poisoned from within — one well, one capital',
};

function newCiv(rng, theme) {
  // every civilization carries its doom: rolled at birth, revealed only in death
  const doomAge = Math.floor(120 + Math.pow(rng(), 1.3) * 520);
  return {
    name: civName(rng),
    governor: GOVERNORS[Math.floor(rng() * GOVERNORS.length)],
    age: 0,
    doomAge,
    ending: ENDINGS[Math.floor(rng() * ENDINGS.length)],
    population: Math.floor(30 + rng() * 70),
    wealth: 10 + Math.floor(rng() * 15),
    faith: 10 + Math.floor(rng() * 15),
    stability: 55 + Math.floor(rng() * 25),
    traits: [
      'parched', 'riverine', 'mountain', 'coastal', 'forest', 'tundra',
      'warlike', 'pious', 'mercantile', 'scholarly', 'nomadic', 'hierarchical',
    ].filter(() => rng() < 0.30).slice(0, 4),
    theme: theme || THEMES[0],
    alive: true,
    deathCause: null,
    chronicle: [],
    reignStartAge: 0,
    reigns: 1,
    strataDepth: 0,
  };
}

/* ---------- The event deck ---------- */
const EVENTS = [
  { id: 'plague',    txt: 'plague rises from the marshes',        eff: 'pop',       amt: -0.30 },
  { id: 'war',       txt: 'war with a rival confederation',       eff: 'pop',       amt: -0.22 },
  { id: 'famine',    txt: 'famine when the rivers fail',          eff: 'pop',       amt: -0.25 },
  { id: 'miracle',   txt: 'a shining miracle is witnessed',        eff: 'faith',     amt: +0.15 },
  { id: 'goldenage', txt: 'a golden age of art and grain',        eff: 'wealth',    amt: +0.20 },
  { id: 'reform',    txt: 'a great reform of laws',               eff: 'stability', amt: +0.10 },
  { id: 'rebellion', txt: 'provinces rise in rebellion',          eff: 'stability', amt: -0.15 },
  { id: 'comet',     txt: 'a comet splits the night sky',         eff: 'faith',     amt: +0.10 },
  { id: 'treasury',  txt: 'a vein of silver is discovered',        eff: 'wealth',    amt: +0.25 },
  { id: 'flood',     txt: 'the great river floods the capital',    eff: 'wealth',    amt: -0.18 },
];

function pickEvent(rng) {
  return EVENTS[Math.floor(rng() * EVENTS.length)];
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function applyEvent(civ, ev) {
  if (!ev) return;
  switch (ev.eff) {
    case 'pop':
      civ.population = Math.max(5, Math.floor(civ.population * (1 + ev.amt)));
      break;
    case 'faith':
      civ.faith = clamp(Math.floor(civ.faith + ev.amt * 100), 0, 999999);
      break;
    case 'wealth':
      civ.wealth = clamp(Math.floor(civ.wealth + ev.amt * 100), 0, 999999);
      break;
    case 'stability':
      civ.stability = clamp(civ.stability + ev.amt * 100, 0, 100);
      break;
  }
}

/* ---------- Advancing a civilization by N years ----------
   step-chunked; all probabilities scale with the chunk length so
   realtime ticks (fractional years) and offline catch-up (big years)
   produce the same event rates per simulated year. */
function advanceCiv(civ, years, rng) {
  if (!civ.alive) return;
  let remaining = years;
  while (remaining > 0 && civ.alive) {
    const step = Math.min(remaining, 7);
    remaining -= step;
    const stepScale = step / 7; // probability scale relative to a 7-year chunk

    civ.age += step;

    // logistic population growth: slows as pop approaches the land's carrying capacity
    const growthCap = Math.max(0.05, 1 - civ.population / 4000);
    const growthRate = 0.014 * growthCap * (1 + civ.stability / 100) * (1 + civ.wealth / 400);
    civ.population = Math.max(5, Math.floor(civ.population * Math.pow(1 + growthRate, step)));
    civ.wealth = clamp(civ.wealth + Math.floor(step * (0.5 + rng() * 1.5)), 0, 999999);
    civ.faith = clamp(civ.faith + Math.floor(step * (0.3 + rng() * 1.2)), 0, 999999);

    // events scale with time so tiny realtime ticks don't flood the chronicle
    if (rng() < 0.28 * stepScale) {
      const ev = pickEvent(rng);
      applyEvent(civ, ev);
      civ.chronicle.push({ age: Math.floor(civ.age), id: ev.id, txt: ev.txt });
    }

    // governor change roughly every 35-55 years
    if (civ.age - civ.reignStartAge > 35 + rng() * 20) {
      civ.governor = GOVERNORS[Math.floor(rng() * GOVERNORS.length)];
      civ.reignStartAge = civ.age;
      civ.reigns++;
      civ.chronicle.push({ age: Math.floor(civ.age), id: 'reign', txt: civ.governor + ' takes power' });
    }

    // stability mean-reverts toward a target that DECAYS with age:
    // old empires get brittle — institutional decay is the engine of mortality
    const target = 55 * Math.max(0.30, 1 - civ.age / 1100);
    civ.stability = clamp(
      civ.stability + (target - civ.stability) * 0.06 * stepScale + (rng() - 0.5) * step * 0.55,
      0, 100
    );

    // death checks — environmental early deaths, then the doom-age always comes
    if (civ.population <= 12 && rng() < 0.30 * stepScale) die(civ, 'population collapse');
    else if (civ.stability <= 2) die(civ, 'total collapse of order');
    else if (civ.age >= civ.doomAge) die(civ, 'the ' + civ.ending);
  }
  if (civ.chronicle.length > 60) civ.chronicle = civ.chronicle.slice(-60);
}

function die(civ, cause) {
  civ.alive = false;
  civ.deathCause = cause;
  civ.strataDepth = Math.max(1, Math.floor(civ.age / 40));
}

/* ---------- Artifacts: procedural items with real histories ---------- */
const MATERIALS = [
  { id: 'clay',     label: 'fired clay',   rarity: 1 },
  { id: 'bronze',   label: 'bronze',       rarity: 2 },
  { id: 'iron',     label: 'iron',         rarity: 3 },
  { id: 'silver',   label: 'silver',       rarity: 4 },
  { id: 'obsidian', label: 'obsidian',     rarity: 4 },
  { id: 'gold',     label: 'gold',         rarity: 5 },
  { id: 'jade',     label: 'jade',         rarity: 5 },
];
const FORMS = [
  { id: 'coin',   label: 'ceremonial coin' },
  { id: 'tablet', label: 'law tablet' },
  { id: 'amulet', label: 'amulet' },
  { id: 'urn',    label: 'funerary urn' },
  { id: 'seal',   label: 'governor seal' },
  { id: 'blade',  label: 'votive blade' },
  { id: 'mask',   label: 'procession mask' },
  { id: 'ring',   label: 'signet ring' },
];
const ARTIFACT_ICONS = {
  coin: '\u25C9', tablet: '\u25AD', amulet: '\u2726', urn: '\u2316',
  seal: '\u25C8', blade: '\u2724', mask: '\u25B8', ring: '\u25CE',
};

function makeArtifact(civ, rng, digLevel) {
  // hardened: legacy saves may lack wealth/chronicle fields
  const wealth = Number.isFinite(civ.wealth) ? civ.wealth : 50;
  const reigns = Number.isFinite(civ.reigns) ? civ.reigns : 1;
  const wealthTier = Math.min(5, 1 + Math.floor(wealth / 150));
  let matPool = MATERIALS.filter(m => m.rarity <= wealthTier + 1);
  if (!matPool.length) matPool = MATERIALS;
  const mat = matPool[Math.floor(rng() * matPool.length)];
  const form = FORMS[Math.floor(rng() * FORMS.length)];
  const chronicle = Array.isArray(civ.chronicle) ? civ.chronicle : [];
  const evo = chronicle.length
    ? chronicle[Math.floor(rng() * chronicle.length)]
    : null;
  const era = 1 + Math.floor(rng() * Math.max(1, Math.floor((Number.isFinite(civ.age) ? civ.age : 0) / 50) || 1));
  const quality = Math.floor(rng() * 100);
  const levelBoost = 1 + (digLevel || 1) * 0.1;
  const value = Math.max(1, Math.round(
    (mat.rarity * 6 + quality / 5) * (evo ? 1.5 : 1) * (1 + reigns / 20) * levelBoost
  ));
  return {
    id: 'a' + Math.floor(rng() * 1e9).toString(36) + '-' + Date.now().toString(36),
    mat: mat.label, matId: mat.id, rarity: mat.rarity,
    form: form.label, formId: form.id,
    icon: ARTIFACT_ICONS[form.id],
    civ: civ.name, civAge: Math.floor(Number.isFinite(civ.age) ? civ.age : 0), theme: civ.theme || 'unknown land',
    eraLabel: 'Era ' + era,
    boundEvent: evo ? evo.txt : 'crafted in quiet years',
    boundEventAge: evo ? evo.age : null,
    quality,
    value,
  };
}

/* ---------- The game state ---------- */
function defaultState() {
  return {
    version: 3,
    lastTick: null,
    dayIndex: 0,
    shards: 0,
    energy: 60, energyMax: 60,
    civs: [],
    museum: [],
    epitaphs: [],
    worldTheme: THEMES[0],
    stats: { digs: 0, artifacts: 0, deadCivs: 0, yearsSeen: 0, strata: 1 },
    settings: { sound: true },
    lastSeedDay: null,
  };
}

/* How many years pass in the deep time layer per real second */
const YEARS_PER_SEC = 0.5;
const MUSEUM_CAP = 1000;
const CIVS_CAP = 8;

/* Main tick: advance world by real elapsed ms. Returns list of news items. */
function tick(state, now) {
  const news = [];
  if (!Array.isArray(state.civs)) state.civs = [];
  const elapsed = Math.max(0, now - (state.lastTick || now));
  // clamp idle catch-up to 24h so a year-old save doesn't nuke the sim
  const capped = Math.min(elapsed, 24 * 3600 * 1000);
  // cold start: first tick on a fresh save sets the clock without aging the world
  const coldStart = state.lastTick === null || state.lastTick === undefined;
  state.lastTick = now;

  if (!coldStart && state.energy < state.energyMax) {
    state.energy = Math.min(state.energyMax, state.energy + capped / 12000);
  }

  const years = coldStart ? 0 : (capped / 1000) * YEARS_PER_SEC;

  // Deep time flows in generational segments: when a civilization dies mid-tick,
  // its successors inherit the remaining years. One night = many civilizations.
  const SEGMENT = 200; // years per segment
  let remainingYears = years;
  let guard = 0;
  while (remainingYears > 0 && guard++ < 10000) {
    const seg = Math.min(remainingYears, SEGMENT);
    remainingYears -= seg;

    for (const civ of state.civs) {
      if (!civ || typeof civ !== 'object' || !civ.alive) continue;
      const beforeAge = civ.age;
      advanceCiv(civ, seg, mulberry32(hashStr(civ.name + ':' + civ.age.toFixed(2) + ':' + state.dayIndex + ':' + guard)));
      if (civ.alive) {
        state.stats.yearsSeen += Math.floor(civ.age - beforeAge);
      } else {
        news.push({ type: 'death', civ: civ.name, cause: civ.deathCause, age: Math.floor(civ.age) });
        state.stats.deadCivs++;
        state.epitaphs.push({
          name: civ.name, age: Math.floor(civ.age), cause: civ.deathCause,
          theme: civ.theme, reigns: civ.reigns, day: state.dayIndex,
        });
        if (state.epitaphs.length > 40) state.epitaphs.shift();
      }
    }

    // bury the dead: civs holds the living; epitaphs holds their memory
    state.civs = state.civs.filter(c => c && c.alive);

    // auto-respawn: the deep layer is never empty — a new people always arrives
    if (!state.civs.length) {
      const rng = mulberry32(hashStr('rise:' + state.dayIndex + ':' + state.epitaphs.length + ':' + guard));
      const civ = newCiv(rng, state.worldTheme);
      civ.chronicle.push({ age: 0, id: 'founding', txt: 'the first fires are lit' });
      state.civs.push(civ);
      news.push({ type: 'rise', civ: civ.name, theme: state.worldTheme });
    }
  }

  // daily world theme rotation (UTC day)
  const today = new Date(now).toISOString().slice(0, 10);
  if (state.lastSeedDay !== today) {
    const isNewDay = state.lastSeedDay !== null;
    const daysSkipped = isNewDay
      ? Math.max(1, Math.round((new Date(today + 'T00:00:00Z').getTime() - new Date(state.lastSeedDay + 'T00:00:00Z').getTime()) / 86400000))
      : 1;
    state.lastSeedDay = today;
    state.dayIndex += daysSkipped;
    const s = dailySeed(new Date(now));
    state.worldTheme = dailyTheme(s);
    if (isNewDay) {
      news.push({ type: 'newday', theme: state.worldTheme });
      state.energy = state.energyMax;
      news.push({ type: 'gift', text: 'The daily survey refills your energy.' });
    } else {
      news.push({ type: 'newday', theme: state.worldTheme });
    }
  }

  return news;
}

/* Dig action: spend energy, excavate the active stratum */
function dig(state, now) {
  if (state.energy < 1) return { ok: false, why: 'tired' };
  const live = state.civs.filter(c => c && c.alive);
  if (!state.civs.length) return { ok: false, why: 'nociv' };

  state.energy -= 1;
  state.stats.digs++;

  const rng = mulberry32(hashStr('dig:' + state.stats.digs + ':' + state.dayIndex + ':' + state.shards + ':' + Math.floor(now / 1000)));
  const progress = Math.floor((12 + rng() * 8) * (1 + state.stats.strata * 0.08));
  state.digProgress = (state.digProgress || 0) + progress;
  const results = [{ type: 'progress', amount: progress }];

  // artifact chance scales with stratum depth, capped
  const findChance = Math.min(0.45, 0.15 + state.stats.strata * 0.03);
  if (rng() < findChance) {
    const civ = live[0] || state.civs[state.civs.length - 1];
    const art = makeArtifact(civ, rng, state.stats.strata);
    state.museum.push(art);
    if (state.museum.length > MUSEUM_CAP) state.museum.shift();
    state.stats.artifacts++;
    results.push({ type: 'artifact', art });
  } else if (rng() < 0.5) {
    const amount = 1 + Math.floor(rng() * (2 + state.stats.strata));
    state.shards += amount;
    results.push({ type: 'shards', amount });
  }

  // stratum complete? exponential idle pacing
  const need = Math.floor(120 * Math.pow(1.35, state.stats.strata - 1));
  if (state.digProgress >= need) {
    state.digProgress = 0;
    state.stats.strata++;
    results.push({ type: 'stratum', level: state.stats.strata });
  }

  return { ok: true, results };
}

/* Summon an EXTRA civilization into the deep layer (costs shards) */
function summonCiv(state, now) {
  const livingCount = state.civs.filter(c => c && c.alive).length;
  const cost = 20 + livingCount * 15;
  if (state.shards < cost) return { ok: false, why: 'cost', cost };
  if (state.civs.length >= CIVS_CAP) return { ok: false, why: 'full' };
  state.shards -= cost;
  const rng = mulberry32(hashStr('civ:' + state.stats.digs + ':' + state.civs.length + ':' + state.dayIndex + ':' + Math.floor(now / 1000)));
  const civ = newCiv(rng, state.worldTheme);
  civ.chronicle.push({ age: 0, id: 'founding', txt: 'summoned by the Surveyor' });
  state.civs.push(civ);
  return { ok: true, civ, cost };
}

/* Museum value */
function museumValue(state) {
  return state.museum.reduce((s, a) => s + (a && a.value || 0), 0);
}

/* Export for Node (tests) and browser */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mulberry32, hashStr, civName, clone, mergeDeep,
    dailySeed, dailyTheme, newCiv, advanceCiv, die, makeArtifact,
    defaultState, tick, dig, summonCiv, museumValue,
    THEMES, GOVERNORS, EVENTS, ENDINGS, ENDING_FRAMES, YEARS_PER_SEC, MUSEUM_CAP, CIVS_CAP,
  };
} else {
  window.STRATA = {
    mulberry32, hashStr, civName, clone, mergeDeep,
    dailySeed, dailyTheme, newCiv, advanceCiv, die, makeArtifact,
    defaultState, tick, dig, summonCiv, museumValue,
    THEMES, GOVERNORS, EVENTS, ENDINGS, ENDING_FRAMES, YEARS_PER_SEC, MUSEUM_CAP, CIVS_CAP,
  };
}
