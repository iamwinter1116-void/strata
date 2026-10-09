/* STRATA — app shell: save system, render, input */
'use strict';

/* ---------- Save system (localStorage + merge migration) ---------- */
const SAVE_KEY = 'strata-save-v3';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return STRATA.defaultState();
    const parsed = JSON.parse(raw);
    const state = STRATA.mergeDeep(STRATA.defaultState(), parsed);
    if (!Array.isArray(state.civs)) state.civs = [];
    return state;
  } catch (e) {
    console.warn('save corrupted, fresh start', e);
    return STRATA.defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('save failed', e);
  }
}

/* ---------- App state ---------- */
let S = loadSave();
let lastSaveTime = 0;
const $ = (id) => document.getElementById(id);

/* ---------- Boot ---------- */
function boot() {
  // first tick: catch up idle time + apply daily seed
  const news = STRATA.tick(S, Date.now());
  news.forEach(showNews);

  // if brand new player, light the first fire
  if (S.civs.length === 0) {
    const rng = STRATA.mulberry32(STRATA.hashStr('first-fire:' + new Date().toISOString().slice(0, 10)));
    const civ = STRATA.newCiv(rng, S.worldTheme);
    civ.chronicle.push({ age: 0, id: 'founding', txt: 'the first fires are lit' });
    S.civs.push(civ);
    showNews({ type: 'rise', civ: civ.name, theme: S.worldTheme });
  }

  renderAll();
  setInterval(gameLoop, 1000);
  setInterval(persistSave, 5000);
  window.addEventListener('pagehide', persistSave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persistSave();
  });

  bindInput();
  updateStrataViz();
}

/* ---------- Main loop ---------- */
function gameLoop() {
  const news = STRATA.tick(S, Date.now());
  news.forEach(showNews);
  renderAll();
}

function persistSave() {
  saveState(S);
}

/* ---------- Rendering ---------- */
function renderAll() {
  $('shards').textContent = Math.floor(S.shards);
  $('energy').textContent = Math.floor(S.energy) + '/' + S.energyMax;
  $('day-badge').textContent = 'Day ' + (S.dayIndex + 1);
  $('world-theme').textContent = S.worldTheme;
  $('world-clock').textContent = deepTimeLabel();
  renderCivs();
  renderMuseum();
  renderCodex();
  renderDig();
  updateStrataViz();
}

function deepTimeLabel() {
  const living = S.civs.filter(c => c && c.alive);
  if (!living.length) return 'the silence between peoples';
  const totalAge = living.reduce((s, c) => s + c.age, 0);
  return 'Year ' + Math.floor(totalAge / living.length) + ' of the living';
}

/* living civs cards */
function renderCivs() {
  const el = $('civ-list');
  if (!S.civs.length) { el.innerHTML = ''; return; }
  let html = '';
  for (const civ of S.civs) {
    if (!civ || !civ.alive) continue;
    const traits = (civ.traits || []).map(t => `<span class="trait">${t}</span>`).join('');
    const chron = (civ.chronicle || []).slice(-5).reverse().map(ev => `
      <div class="chron-row"><span class="age">${Math.floor(ev.age)}y</span><b>${escapeHtml(ev.txt)}</b></div>`).join('');
    html += `
      <div class="civ-card living">
        <div class="civ-name">${escapeHtml(civ.name)}</div>
        <div class="civ-status">● LIVING — ${Math.floor(civ.age)} years old</div>
        <div class="civ-stats">
          <span>Population ${Math.floor(civ.population)}</span>
          <span>Wealth ${Math.floor(civ.wealth)}</span>
          <span>Faith ${Math.floor(civ.faith)}</span>
          <span>Stability ${Math.floor(civ.stability)}%</span>
        </div>
        <div class="civ-gov">Ruled by the ${escapeHtml(civ.governor)} — reign ${civ.reigns}</div>
        <div class="civ-traits">${traits}</div>
        <div class="civ-chron">${chron}</div>
      </div>`;
  }
  el.innerHTML = html;
}

function renderMuseum() {
  const sum = $('museum-summary');
  sum.textContent = `${S.museum.length} artifact${S.museum.length === 1 ? '' : 's'} — total value ${STRATA.museumValue(S)} ◆`;
  const grid = $('museum-grid');
  const arts = S.museum.slice(-60).reverse();
  if (!arts.length) {
    grid.innerHTML = '<div style="color:var(--dim);font-size:12px;font-style:italic">Nothing unearthed yet. Dig.</div>';
    return;
  }
  let html = '';
  for (const a of arts) {
    html += `
      <div class="art-card r${a.rarity}" data-id="${a.id}">
        <div class="art-icon">${a.icon}</div>
        <div class="art-name">${escapeHtml(a.form)}</div>
        <div class="art-val">${a.value} ◆</div>
      </div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.art-card').forEach(card => {
    card.addEventListener('click', () => openArtifact(a2(card.dataset.id)));
  });
}

function a2(id) { return S.museum.find(a => a.id === id); }

function renderCodex() {
  const el = $('epitaph-list');
  const eps = S.epitaphs.slice().reverse();
  if (!eps.length) {
    el.innerHTML = '<div style="color:var(--dim);font-size:12px;font-style:italic">No one has died yet. They will.</div>';
    return;
  }
  let html = '';
  for (const e of eps) {
    html += `
      <div class="epitaph">
        <div class="name">${escapeHtml(e.name)}</div>
        <div class="cause">died of ${escapeHtml(e.cause)}</div>
        <div class="age">${e.age} years — ${e.reigns} reigns — the ${escapeHtml(e.theme)}</div>
      </div>`;
  }
  el.innerHTML = html;
}

function renderDig() {
  const need = digNeed();
  const pct = Math.min(100, ((S.digProgress || 0) / need) * 100);
  $('dig-progress-fill').style.width = pct + '%';
  $('dig-progress-label').textContent = `Stratum ${S.stats.strata} — ${Math.floor(S.digProgress || 0)}/${need}`;
  const tired = S.energy < 1;
  $('dig-btn').disabled = tired;
  $('dig-btn-main').textContent = tired ? 'TOO TIRED' : 'DIG';
  const livingCount = S.civs.filter(c => c && c.alive).length;
  const cost = 20 + livingCount * 15;
  $('summon-cost').textContent = cost;
  $('summon-btn').disabled = S.shards < cost;
}

function digNeed() { return Math.floor(120 * Math.pow(1.35, S.stats.strata - 1)); }

/* ---------- Strata visualization (canvas-free, DOM dots) ---------- */
function updateStrataViz() {
  const viz = $('strata-viz');
  viz.innerHTML = '';
  const depth = S.stats.strata;
  for (let i = 1; i <= depth && i <= 20; i++) {
    const line = document.createElement('div');
    line.className = 'stratum-line';
    line.style.top = (100 - (i / 21) * 100) + '%';
    viz.appendChild(line);
    const label = document.createElement('div');
    label.className = 'stratum-label';
    label.style.top = 'calc(' + (100 - (i / 21) * 100) + '% + 3px)';
    label.textContent = 'stratum ' + i;
    viz.appendChild(label);
  }
  // artifact dots at recent dig depth — visual candy
  const recent = S.museum.slice(-12);
  for (let i = 0; i < recent.length; i++) {
    const a = recent[i];
    const dot = document.createElement('div');
    dot.className = 'artifact-dot r' + Math.min(3, a.rarity);
    dot.style.left = (8 + (i * 7 + a.quality % 13) % 84) + '%';
    dot.style.top = (18 + (i * 13 + a.quality % 29) % 70) + '%';
    dot.title = a.form;
    viz.appendChild(dot);
    dot.addEventListener('click', () => openArtifact(a));
  }
}

/* ---------- News ---------- */
const NEWS_HISTORY = [];
function showNews(n) {
  const t = $('ticker');
  let msg = '';
  switch (n.type) {
    case 'death': msg = `⚰ ${n.civ} fell to ${n.cause} after ${n.age} years.`; break;
    case 'rise': msg = `✦ A new people: ${n.civ}, in the ${n.theme}.`; break;
    case 'newday': msg = `☀ A new day. The world theme is now: ${n.theme}.`; break;
    case 'stratum': msg = `⇩ Stratum ${n.level} reached — the dig deepens.`; break;
    case 'gift': msg = n.text; break;
    default: msg = '';
  }
  if (!msg) return;
  NEWS_HISTORY.unshift(msg);
  if (NEWS_HISTORY.length > 3) NEWS_HISTORY.pop();
  t.innerHTML = NEWS_HISTORY.map((m, i) => `<div class="${i > 0 ? 'old' : ''}">${escapeHtml(m)}</div>`).join('<br>');
}

/* ---------- Artifact modal ---------- */
function openArtifact(art) {
  if (!art) return;
  $('modal-icon').textContent = art.icon;
  $('modal-title').textContent = art.mat + ' ' + art.form;
  $('modal-sub').textContent = art.eraLabel + ' — ' + art.theme;
  $('modal-story').textContent = `"${art.boundEvent}" — the story buried with it.`;
  $('modal-meta').innerHTML =
    `From ${escapeHtml(art.civ)}, aged ${art.civAge}y at the time of burial<br>` +
    `Quality ${art.quality}/100 — Value ${art.value} ◆`;
  $('modal').classList.remove('hidden');
}

/* ---------- Input ---------- */
function bindInput() {
  $('dig-btn').addEventListener('click', doDig);
  $('summon-btn').addEventListener('click', doSummon);
  $('modal-close').addEventListener('click', () => $('modal').classList.add('hidden'));
  // tap anywhere on the dim background also dismisses
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      $('view-' + btn.dataset.view).classList.add('active');
      $('main').scrollTop = 0;
    });
  });
}

function doDig() {
  if (S.energy < 1) { flash('Too tired — energy returns with time.'); return; }
  const r = STRATA.dig(S, Date.now());
  if (!r.ok) { flash(r.why === 'tired' ? 'You are too tired.' : 'Nothing to dig.'); return; }

  for (const res of r.results) {
    if (res.type === 'artifact') {
      openArtifact(res.art);
      flash('◈ ' + res.art.mat + ' ' + res.art.form);
    } else if (res.type === 'shards') {
      flash('+' + res.amount + ' ◆ shards');
    } else if (res.type === 'stratum') {
      showNews({ type: 'stratum', level: res.level });
      flash('⇩ Stratum ' + res.level);
      if (window.MONETIZATION) window.MONETIZATION.atStratumLevel();
    }
  }
  renderAll();
}

function doSummon() {
  const livingCount = S.civs.filter(c => c && c.alive).length;
  const cost = 20 + livingCount * 15;
  if (S.shards < cost) {
    flash(`Need ${cost} ◆ to summon.`);
    return;
  }
  const r = STRATA.summonCiv(S, Date.now());
  if (!r.ok) {
    flash('The deep layer is full.');
    return;
  }
  showNews({ type: 'rise', civ: r.civ.name, theme: S.worldTheme });
  flash('✦ ' + r.civ.name + ' rises');
  renderAll();
}

/* floating feedback text */
function flash(text) {
  const el = document.createElement('div');
  el.className = 'float-msg';
  el.textContent = text;
  el.style.left = (30 + Math.random() * 40) + '%';
  el.style.top = '48%';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* expose for debugging & test harness */
window.STRATA_DEBUG = { S, tick: () => STRATA.tick(S, Date.now()), save: persistSave };

document.addEventListener('DOMContentLoaded', boot);
