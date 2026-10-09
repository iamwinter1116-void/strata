'use strict';
/* STRATA e2e v2 — real Chrome, real taps on the game UI.
   Covers: boot, hold-to-dig, FX, panels, modal, save, idle, summon, offline.
   Run: node tests/e2e.js  (needs :8765 server + Chrome) */

const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:8765/index.html';

let pass = 0, fail = 0;
function T(name, cond) {
  console.log((cond ? '  ok - ' : '  FAIL - ') + name);
  cond ? pass++ : fail++;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--window-size=390,844'],
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1500));

  console.log('== Boot ==');
  T('page title', (await page.title()).includes('STRATA'));
  T('FX loaded', await page.evaluate(() => typeof window.FX === 'object'));
  T('SITE loaded', await page.evaluate(() => typeof window.SITE === 'object'));
  T('canvas present', await page.$eval('#stage', el => el.width > 0 && el.height > 0));
  const civName = await page.evaluate(() => window.STRATA_DEBUG.S.civs[0].name);
  console.log('  first civ: ' + civName);
  T('first civilization alive', await page.evaluate(() => window.STRATA_DEBUG.S.civs.filter(c => c.alive).length === 1));
  const pill = await page.$eval('#civ-pill-text', el => el.textContent);
  T('civ pill shows living civ', pill.includes(civName));

  console.log('== Console health ==');
  T('zero console errors at boot', consoleErrors.length === 0);
  if (consoleErrors.length) console.log('  errors:', consoleErrors.slice(0, 5));

  console.log('== Hold-to-dig (real press-hold) ==');
  await page.evaluate(() => { window.STRATA_DEBUG.S.energy = 20; });
  const digBtn = await page.$('#dig-btn');

  await digBtn.click();
  await new Promise(r => setTimeout(r, 400));
  let digs = await page.evaluate(() => window.STRATA_DEBUG.S.stats.digs);
  T('tap registers a dig', digs === 1);

  await page.evaluate(() => { window.STRATA_DEBUG.S.energy = 60; });
  await digBtn.click({ delay: 1200 });
  await new Promise(r => setTimeout(r, 300));
  digs = await page.evaluate(() => window.STRATA_DEBUG.S.stats.digs);
  console.log('  digs after hold: ' + digs);
  T('hold produces multiple digs', digs >= 3);

  const energyNow = await page.evaluate(() => window.STRATA_DEBUG.S.energy);
  console.log('  energy after hold: ' + energyNow.toFixed(1));
  T('energy drains with holds', energyNow <= 61 - digs + 2);

  console.log('== FX exercise ==');
  const fxState = await page.evaluate(() => {
    const S = window.STRATA_DEBUG.S;
    S.energy = 500;
    let got = { artifact: false, stratum: false };
    for (let i = 0; i < 200 && !(got.artifact && got.stratum); i++) {
      window.STRATA_DEBUG.dig();
      got.artifact = got.artifact || S.museum.length > 0;
      got.stratum = got.stratum || S.stats.strata > 1;
    }
    return got;
  });
  console.log('  juice paths hit:', JSON.stringify(fxState));
  T('artifact path fires', fxState.artifact === true);
  T('stratum path fires', fxState.stratum === true);
  // close any artifact modal left open by the juice exercise
  await page.evaluate(() => document.getElementById('modal').classList.add('hidden'));
  const museumNow = await page.evaluate(() => window.STRATA_DEBUG.S.museum.length);
  console.log('  museum after juice exercise: ' + museumNow);
  T('museum populated by digs', museumNow >= 1);

  const sfxOk = await page.evaluate(() => {
    try { FX.ensureAudio(); return !!FX.SFX; } catch (e) { return false; }
  });
  T('SFX reachable', sfxOk === true);

  console.log('== Panels ==');
  await page.click('.nav-btn[data-view="civs"]');
  await new Promise(r => setTimeout(r, 400));
  T('people panel opens', await page.$eval('#panel', el => !el.classList.contains('hidden')));
  const civCards = await page.$$eval('#panel-body .civ-card', els => els.length);
  console.log('  civ cards: ' + civCards);
  T('civ card rendered', civCards >= 1);

  // in-game flow: use the panel's own back button, then open museum from nav
  await page.click('#panel-back');
  await new Promise(r => setTimeout(r, 300));
  T('panel closes via back button', await page.$eval('#panel', el => el.classList.contains('hidden')));

  await page.click('.nav-btn[data-view="museum"]');
  await new Promise(r => setTimeout(r, 400));
  const artCards = await page.$$eval('#panel-body .art-card', els => els.length);
  console.log('  museum cards: ' + artCards);
  T('museum panel renders finds', artCards >= 1);

  if (artCards > 0) {
    await page.click('#panel-body .art-card');
    await new Promise(r => setTimeout(r, 300));
    T('artifact modal opens from museum', await page.$eval('#modal', el => !el.classList.contains('hidden')));
    const story = await page.$eval('#modal-story', el => el.textContent);
    T('modal carries story', story.length > 10);
    await page.click('#modal-close');
  }

  await page.click('#panel-back');
  await new Promise(r => setTimeout(r, 300));
  T('panel closes', await page.$eval('#panel', el => el.classList.contains('hidden')));

  console.log('== Save persistence ==');
  await page.evaluate(() => window.STRATA_DEBUG.save());
  const digsBefore = await page.evaluate(() => window.STRATA_DEBUG.S.stats.digs);
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  const digsAfter = await page.evaluate(() => window.STRATA_DEBUG.S.stats.digs);
  T('save survives reload', digsAfter === digsBefore);
  T('civs survive reload', (await page.evaluate(() => window.STRATA_DEBUG.S.civs.length)) >= 1);

  console.log('== Idle catch-up (2h) ==');
  await page.evaluate(() => { window.STRATA_DEBUG.S.lastTick = Date.now() - 2 * 3600 * 1000; });
  await new Promise(r => setTimeout(r, 2500));
  const epitaphs = await page.evaluate(() => window.STRATA_DEBUG.S.epitaphs.length);
  const living = await page.evaluate(() => window.STRATA_DEBUG.S.civs.filter(c => c.alive).length);
  console.log('  after 2h: living=' + living + ', epitaphs=' + epitaphs);
  T('history accumulated over idle', epitaphs >= 1);
  T('living civ remains', living >= 1);

  console.log('== Codex shows the dead ==');
  await page.click('.nav-btn[data-view="codex"]');
  await new Promise(r => setTimeout(r, 400));
  const epitaphEls = await page.$$eval('#panel-body .epitaph', els => els.length);
  console.log('  codex entries: ' + epitaphEls);
  T('codex renders epitaphs', epitaphEls >= 1);
  await page.evaluate(() => document.getElementById('panel').classList.add('hidden'));

  console.log('== Summon ==');
  await page.evaluate(() => { window.STRATA_DEBUG.S.shards = 100; });
  await new Promise(r => setTimeout(r, 1100));
  const summonInfo = await page.evaluate(() => {
    const btn = document.getElementById('summon-btn');
    const r = btn.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { disabled: btn.disabled, topElement: top ? (top.id || top.tagName) : null };
  });
  console.log('  summon clickable:', JSON.stringify(summonInfo));
  await page.click('#summon-btn');
  await new Promise(r => setTimeout(r, 400));
  const living2 = await page.evaluate(() => window.STRATA_DEBUG.S.civs.filter(c => c.alive).length);
  console.log('  living after summon: ' + living2);
  T('summon adds a civilization', living2 === 2);

  console.log('== PWA ==');
  const manifestOk = await page.evaluate(async () => (await fetch('manifest.webmanifest')).ok);
  T('manifest fetchable', manifestOk);
  const swReg = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length > 0);
  T('service worker registered', swReg);

  console.log('== Screenshots ==');
  await page.screenshot({ path: 'qa/v2-site.png' });
  await page.click('.nav-btn[data-view="museum"]');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'qa/v2-museum.png' });
  await page.evaluate(() => document.getElementById('panel').classList.add('hidden'));
  T('screenshots captured', true);

  console.log('== Final health ==');
  console.log('  console errors: ' + consoleErrors.length);
  T('zero console errors at end', consoleErrors.length === 0);
  if (consoleErrors.length) console.log('  ', consoleErrors.slice(0, 5));

  await browser.close();
  console.log('\n=========================================');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  console.log('=========================================');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('E2E CRASH:', e); process.exit(2); });
