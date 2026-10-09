/* ============================================================
   STRATA — app shell v2: rAF loop, hold-to-dig, juice, panels.
   ============================================================ */
'use strict';

/* ---------- Save system ---------- */
const SAVE_KEY = 'strata-save-v3';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return STRATA.defaultState();
    const state = STRATA.mergeDeep(STRATA.defaultState(), JSON.parse(raw));
    if (!Array.isArray(state.civs)) state.civs = [];
    return state;
  } catch (e) {
    return STRATA.defaultState();
  }
}

function saveState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------- App state ---------- */
let S = loadSave();
const $ = (id) => document.getElementById(id);

/* ---------- Boot ---------- */
function boot() {
  const news = STRATA.tick(S, Date.now());
  news.forEach(showNews);

  if (S.civs.length === 0) {
    const rng = STRATA.mulberry32(STRATA.hashStr('first-fire:' + new Date().toISOString().slice(0, 10)));
    const civ = STRATA.newCiv(rng, S.worldTheme);
    civ.chronicle.push({ age: 0, id: 'founding', txt: 'the first fires are lit' });
    S.civs.push(civ);
    showNews({ type: 'rise', civ: civ.name, theme: S.worldTheme });
  }

  SITE.init($('stage'));
  SITE.rebuild(S.stats.strata, S.worldTheme);

  bindInput();
  renderHud();

  requestAnimationFrame(frame);
  setInterval(gameTick, 1000);          // world simulation tick
  setInterval(() => saveState(S), 5000); // periodic save
  window.addEventListener('pagehide', () => saveState(S));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveState(S);
    else { STRATA.tick(S, Date.now()).forEach(showNews); renderHud(); }
  });
}

/* ---------- Main rAF frame ---------- */
let lastFrame = performance.now();

function frame(t) {
  const dt = Math.min((t - lastFrame) / (1000 / 60), 3); // normalized to 60fps units
  lastFrame = t;

  const canvas = $('stage');
  const ctx = canvas.getContext('2d');

  // shake offset
  const sh = FX.shake;
  const ox = sh > 0.2 ? (Math.random() - 0.5) * sh : 0;
  const oy = sh > 0.2 ? (Math.random() - 0.5) * sh : 0;

  ctx.save();
  ctx.translate(ox, oy);

  SITE.render(S, t);
  FX.step(ctx, dt);

  // flash overlay
  if (FX.flashAlpha > 0.01) {
    ctx.globalAlpha = FX.flashAlpha;
    ctx.fillStyle = '#f2c66d';
    ctx.fillRect(-10, -10, SITE.W + 20, SITE.H + 20);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  requestAnimationFrame(frame);
}

/* ---------- World simulation (1s cadence) ---------- */
function gameTick() {
  const news = STRATA.tick(S, Date.now());
  for (const n of news) {
    showNews(n);
    if (n.type === 'death') {
      FX.SFX.death();
      FX.kick(7);
      FX.buzz([40, 60, 40]);
    } else if (n.type === 'rise') {
      FX.SFX.rise();
      FX.buzz(20);
    }
  }
  renderHud();
}

/* ---------- HUD render ---------- */
function renderHud() {
  $('shards').textContent = Math.floor(S.shards);
  $('energy').textContent = Math.floor(S.energy);
  $('world-theme').textContent = S.worldTheme;

  const tired = S.energy < 1;
  const digBtn = $('dig-btn');
  digBtn.classList.toggle('tired', tired);
  $('dig-label').textContent = tired ? 'TOO TIRED — REST' : 'HOLD TO DIG';

  $('energy-fill').style.width = ((S.energy / S.energyMax) * 100) + '%';

  const living = S.civs.filter(c => c && c.alive);
  if (living.length) {
    const c = living[0];
    $('civ-pill-text').textContent = c.name + ' · yr ' + Math.floor(c.age);
  } else {
    $('civ-pill-text').textContent = 'the silence between peoples';
  }
  $('depth-readout').textContent = 'stratum ' + S.stats.strata;

  const cost = 20 + living.length * 15;
  $('summon-cost').textContent = cost;
  $('summon-btn').disabled = S.shards < cost;
}

/* ---------- News ---------- */
const NEWS_HISTORY = [];
function showNews(n) {
  let msg = '';
  switch (n.type) {
    case 'death': msg = `⚰ ${n.civ} fell to ${n.cause} after ${n.age} years.`; break;
    case 'rise': msg = `✦ A new people: ${n.civ}, in the ${n.theme}.`; break;
    case 'newday': msg = `☀ A new day across the world: the ${n.theme}.`; break;
    case 'stratum': msg = `⇩ Stratum ${n.level} — the dig deepens.`; break;
    case 'gift': msg = n.text; break;
  }
  if (!msg) return;
  NEWS_HISTORY.unshift(msg);
  if (NEWS_HISTORY.length > 3) NEWS_HISTORY.pop();
  const t = $('ticker');
  t.innerHTML = NEWS_HISTORY.map((m, i) => `<span class="${i > 0 ? 'old' : ''}">${escapeHtml(m)}</span>`).join(' ');
}

/* ---------- Dig: hold-to-dig with cooldown ---------- */
let holding = false;
let nextDigAllowed = 0;
const DIG_COOLDOWN_MS = 280;

function tryDig(opts) {
  const bypassCooldown = opts && opts.force;
  if (S.energy < 1) return false;
  const now = performance.now();
  if (!bypassCooldown && now < nextDigAllowed) return false;
  if (!bypassCooldown) nextDigAllowed = now + DIG_COOLDOWN_MS;

  const r = STRATA.dig(S, Date.now());
  if (!r.ok) return false;

  // juice: pick strikes at the depth line
  const W = SITE.W, H = SITE.H;
  const pickX = W * (0.3 + Math.random() * 0.4);
  const pickY = H * (0.35 + Math.random() * 0.5);

  FX.kick(2.6);
  FX.buzz(12);
  FX.SFX.dig();
  SITE.addHole(pickX / W, pickY / H);

  // dust puff
  for (let i = 0; i < 4; i++) FX.spawnDust(pickX + (Math.random() - 0.5) * 20, pickY + Math.random() * 8);

  for (const res of r.results) {
    if (res.type === 'progress') {
      FX.spawnBurst(pickX, pickY, {
        count: 10, speed: 2.2, size: [1, 3],
        colors: ['#5a4426', '#3a2c1a', '#9a8a70'],
        gravity: 0.2, life: [20, 45],
      });
    } else if (res.type === 'shards') {
      FX.SFX.shards();
      FX.spawnFloat(pickX, pickY - 14, '+' + res.amount + ' ◆', '#f2c66d');
      FX.spawnBurst(pickX, pickY, {
        count: 14, speed: 2.8, colors: ['#f2c66d', '#d9a441'],
        gravity: 0.16, life: [30, 60], glow: true,
      });
      FX.buzz([10, 30, 10]);
    } else if (res.type === 'artifact') {
      FX.SFX.artifact();
      FX.hitStop(90);
      FX.kick(5);
      FX.flash(0.18);
      FX.buzz([15, 40, 15, 40, 25]);
      FX.spawnBurst(pickX, pickY, {
        count: 30, speed: 3.6, colors: ['#fff3d6', '#f2c66d', '#d9a441'],
        gravity: 0.1, life: [50, 100], glow: true, size: [1.5, 4],
      });
      SITE.addGlint(S.stats.strata, res.art.rarity);
      FX.spawnFloat(pickX, pickY - 20, '◈ ' + res.art.form, '#fff3d6');
      openArtifact(res.art);
    } else if (res.type === 'stratum') {
      FX.SFX.stratum();
      FX.kick(9);
      FX.hitStop(140);
      FX.flash(0.3);
      FX.buzz([30, 50, 30, 50, 60]);
      FX.spawnBurst(W / 2, pickY, {
        count: 40, speed: 4.5, colors: ['#9a8a70', '#5a4426', '#d9a441'],
        gravity: 0.3, life: [40, 90],
      });
      SITE.rebuild(res.level, S.worldTheme);
      showNews({ type: 'stratum', level: res.level });
      if (window.MONETIZATION) window.MONETIZATION.atStratumLevel();
    }
  }
  renderHud();
  return true;
}

/* ---------- Input ---------- */
function bindInput() {
  const digBtn = $('dig-btn');

  // hold-to-dig with pointer events
  digBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    FX.ensureAudio(); FX.resumeAudio();
    digBtn.classList.add('pressing');
    holding = true;
    tryDig();
  });
  const stopHold = () => { holding = false; digBtn.classList.remove('pressing'); };
  digBtn.addEventListener('pointerup', stopHold);
  digBtn.addEventListener('pointercancel', stopHold);
  digBtn.addEventListener('pointerleave', stopHold);
  document.addEventListener('pointerup', stopHold);

  // tap the stage itself to dig too
  $('stage').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    FX.ensureAudio(); FX.resumeAudio();
    tryDig();
  });

  $('summon-btn').addEventListener('click', doSummon);
  $('modal-close').addEventListener('click', () => $('modal').classList.add('hidden'));
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });
  $('btn-sound').addEventListener('click', toggleSound);

  $('panel-back').addEventListener('click', closePanel);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      FX.SFX.ui();
      const v = btn.dataset.view;
      if (v === 'dig') closePanel();
      else openPanel(v);
    });
  });
}

function doSummon() {
  const living = S.civs.filter(c => c && c.alive);
  const cost = 20 + living.length * 15;
  if (S.shards < cost) return;
  const r = STRATA.summonCiv(S, Date.now());
  if (!r.ok) return;
  FX.SFX.rise();
  FX.kick(4);
  FX.buzz([20, 40, 20]);
  FX.spawnBurst(SITE.W / 2, SITE.H * 0.2, {
    count: 24, speed: 3, colors: ['#7fb069', '#f2c66d'],
    gravity: 0.08, life: [50, 100], glow: true,
  });
  showNews({ type: 'rise', civ: r.civ.name, theme: S.worldTheme });
  renderHud();
}

/* ---------- Panels ---------- */
function openPanel(view) {
  const panel = $('panel');
  const body = $('panel-body');
  const title = $('panel-title');
  panel.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'civs') {
    title.textContent = 'THE LIVING';
    body.innerHTML = renderCivsHtml() || '<div class="empty-note">No one lives yet.</div>';
  } else if (view === 'museum') {
    title.textContent = 'THE MUSEUM';
    const total = STRATA.museumValue(S);
    body.innerHTML =
      `<div class="museum-summary">${S.museum.length} artifact${S.museum.length === 1 ? '' : 's'} — worth ${total} ◆</div>` +
      renderMuseumHtml();
    bindArtifactCards(body);
  } else if (view === 'codex') {
    title.textContent = 'THE CODEX OF THE DEAD';
    const eps = S.epitaphs.slice().reverse();
    const frame = (cause) => {
      if (!cause) return 'passed beyond memory';
      // normalize legacy saves that stored 'the <ending>'
      const key = cause.replace(/^the\s+/, '');
      return STRATA.ENDING_FRAMES[key] || STRATA.ENDING_FRAMES[cause] || cause;
    };
    body.innerHTML = eps.length
      ? `<div class="codex-intro">Every civilization dies. These are the ones you have outlived.</div>` +
        `<div class="codex-count">${eps.length} of ${S.stats.deadCivs || eps.length} — newest first</div>` +
        eps.map((e, i) => `
        <div class="epitaph ${i === 0 ? 'first' : ''}">
          <div class="name">${escapeHtml(e.name)}</div>
          <div class="cause">${escapeHtml(frame(e.cause))}</div>
          <div class="meta">${e.age} years · ${e.reigns} reigns · the ${escapeHtml(e.theme)}</div>
        </div>`).join('') +
        `<div class="codex-kicker">The earth does not mourn. It only remembers.</div>`
      : '<div class="empty-note">No one has died yet.<br>They will.</div>';
  }
}

function closePanel() {
  $('panel').classList.add('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'dig'));
}

function renderCivsHtml() {
  let html = '';
  for (const civ of S.civs) {
    if (!civ || !civ.alive) continue;
    const traits = (civ.traits || []).map(t => `<span class="trait">${escapeHtml(t)}</span>`).join('');
    const chron = (civ.chronicle || []).slice(-6).reverse().map(ev =>
      `<div class="chron-row"><span class="age">${Math.floor(ev.age)}y</span>${escapeHtml(ev.txt)}</div>`).join('');
    html += `
      <div class="civ-card">
        <div class="civ-name">${escapeHtml(civ.name)}</div>
        <div class="civ-gov">ruled by the ${escapeHtml(civ.governor)} — reign ${civ.reigns}</div>
        <div class="civ-stats">
          <span class="stat">pop <b>${Math.floor(civ.population)}</b></span>
          <span class="stat">wealth <b>${Math.floor(civ.wealth)}</b></span>
          <span class="stat">faith <b>${Math.floor(civ.faith)}</b></span>
          <span class="stat">stability <b>${Math.floor(civ.stability)}%</b></span>
          <span class="stat">age <b>${Math.floor(civ.age)}y</b></span>
        </div>
        <div class="civ-traits">${traits}</div>
        <div class="civ-chron">${chron}</div>
      </div>`;
  }
  return html;
}

function renderMuseumHtml() {
  const arts = S.museum.slice(-80).reverse();
  if (!arts.length) return '<div class="empty-note">Nothing unearthed yet. Dig.</div>';
  return '<div id="museum-grid">' + arts.map(a => `
    <div class="art-card r${a.rarity}" data-id="${a.id}">
      <div class="art-icon">${a.icon}</div>
      <div class="art-name">${escapeHtml(a.form)}</div>
      <div class="art-val">${a.value} ◆</div>
    </div>`).join('') + '</div>';
}

function bindArtifactCards(body) {
  body.querySelectorAll('.art-card').forEach(card => {
    card.addEventListener('click', () => {
      const art = S.museum.find(a => a.id === card.dataset.id);
      if (art) { FX.SFX.ui(); openArtifact(art); }
    });
  });
}

/* ---------- Artifact modal ---------- */
function openArtifact(art) {
  if (!art) return;
  $('modal-icon').textContent = art.icon;
  $('modal-title').textContent = art.mat + ' ' + art.form;
  $('modal-sub').textContent = art.eraLabel + ' — the ' + art.theme;
  $('modal-story').textContent = `"${art.boundEvent}" — the story buried with it.`;
  $('modal-meta').innerHTML =
    `from <b>${escapeHtml(art.civ)}</b>, aged ${art.civAge}y at burial<br>` +
    `quality ${art.quality}/100 · worth <b>${art.value} ◆</b>`;
  $('modal').classList.remove('hidden');
}

/* ---------- Sound toggle ---------- */
function toggleSound() {
  FX.muted = !FX.muted;
  $('btn-sound').classList.toggle('off', FX.muted);
  try { localStorage.setItem('strata-muted', FX.muted ? '1' : '0'); } catch (e) {}
}
(function restoreSound() {
  try { if (localStorage.getItem('strata-muted') === '1') { FX.muted = true; $('btn-sound').classList.add('off'); } } catch (e) {}
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* hold-to-dig repeat loop — rAF-driven so slow frames never skip digs */
function holdLoop() {
  if (holding) tryDig();
  requestAnimationFrame(holdLoop);
}
requestAnimationFrame(holdLoop);

/* debug + boot */
window.STRATA_DEBUG = {
  S, tick: () => STRATA.tick(S, Date.now()), save: () => saveState(S),
  dig: () => tryDig({ force: true }), state: S, fx: FX, site: SITE,
};
document.addEventListener('DOMContentLoaded', boot);
