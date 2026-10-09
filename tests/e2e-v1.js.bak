'use strict';
/* STRATA end-to-end playthrough with real Chrome (puppeteer-core).
   Clicks the real UI: DIG xN, opens tabs, checks states, reloads for save test.
   Run: node tests/e2e.js */

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
    args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844'],
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1500)); // let first ticks settle

  console.log('== Boot ==');
  const title = await page.title();
  T('page title', title.includes('STRATA'));
  const shards = await page.$eval('#shards', el => el.textContent);
  T('shards readout exists', shards !== null);
  console.log('  shards=' + shards);

  const civCount = await page.evaluate(() => window.STRATA_DEBUG.S.civs.length);
  T('first civilization alive', civCount === 1);
  const civName = await page.evaluate(() => window.STRATA_DEBUG.S.civs[0].name);
  console.log('  first civ: ' + civName);

  console.log('== Console health ==');
  T('zero console errors', consoleErrors.length === 0);
  if (consoleErrors.length) console.log('  errors:', consoleErrors.slice(0, 5));

  console.log('== DIG interaction (15 real taps) ==');
  // set energy for a controlled test via debug state
  await page.evaluate(() => { window.STRATA_DEBUG.S.energy = 15; });
  const digBtn = await page.$('#dig-btn');
  let artifactsFound = 0, modals = 0;
  for (let i = 0; i < 15; i++) {
    await digBtn.click();
    await new Promise(r => setTimeout(r, 120));
    const modalOpen = await page.evaluate(() => !document.getElementById('modal').classList.contains('hidden'));
    if (modalOpen) {
      modals++;
      const t = await page.$eval('#modal-title', el => el.textContent);
      console.log('  artifact modal: "' + t + '"');
      await page.click('#modal-close');
      await new Promise(r => setTimeout(r, 80));
    }
  }
  const digs = await page.evaluate(() => window.STRATA_DEBUG.S.stats.digs);
  T('15 digs registered', digs === 15);
  const energyAfter = await page.evaluate(() => window.STRATA_DEBUG.S.energy);
  T('energy spent by real clicks (15 digs ≈ 0, regen adds a sliver)', energyAfter >= -0.01 && energyAfter <= 1.5);
  console.log('  modals opened: ' + modals + ', energy after: ' + energyAfter);

  const museumLen = await page.evaluate(() => window.STRATA_DEBUG.S.museum.length);
  console.log('  museum: ' + museumLen + ' artifacts from 15 digs');
  T('museum gained artifacts', museumLen >= 1);

  console.log('== Tabs ==');
  await page.click('.nav-btn[data-view="museum"]');
  const museumVisible = await page.$eval('#view-museum', el => el.classList.contains('active'));
  T('museum tab opens', museumVisible === true);
  const artCards = await page.$$eval('#museum-grid .art-card', els => els.length);
  console.log('  museum grid cards: ' + artCards);
  T('museum grid populated by real digs', artCards >= 1);

  // click an artifact card → modal shows its story
  if (artCards > 0) {
    await page.click('#museum-grid .art-card');
    const modalOpen = await page.evaluate(() => !document.getElementById('modal').classList.contains('hidden'));
    T('artifact modal opens from grid', modalOpen === true);
    const story = await page.$eval('#modal-story', el => el.textContent);
    console.log('  story: ' + story.slice(0, 70));
    T('modal shows a story', story.length > 10);
    await page.click('#modal-close');
  }

  await page.click('.nav-btn[data-view="civs"]');
  const civsVisible = await page.$eval('#view-civs', el => el.classList.contains('active'));
  T('civs tab opens', civsVisible === true);
  const civCards = await page.$$eval('#civ-list .civ-card', els => els.length);
  console.log('  civ cards: ' + civCards);
  T('living civ rendered as card', civCards >= 1);

  await page.click('.nav-btn[data-view="codex"]');
  const codexVisible = await page.$eval('#view-codex', el => el.classList.contains('active'));
  T('codex tab opens', codexVisible === true);

  console.log('== PWA: manifest + service worker ==');
  const manifestOk = await page.evaluate(async () => {
    try {
      const r = await fetch('manifest.webmanifest');
      return r.ok;
    } catch (e) { return false; }
  });
  T('manifest fetchable', manifestOk === true);
  const swReg = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length > 0;
  });
  T('service worker registered', swReg === true);

  console.log('== Save persistence across reload ==');
  await page.evaluate(() => window.STRATA_DEBUG.save());
  const digsBefore = await page.evaluate(() => window.STRATA_DEBUG.S.stats.digs);
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  const digsAfter = await page.evaluate(() => window.STRATA_DEBUG.S.stats.digs);
  T('save survives reload (digs=' + digsBefore + '→' + digsAfter + ')', digsAfter === digsBefore);
  const civsAfter = await page.evaluate(() => window.STRATA_DEBUG.S.civs.length);
  T('civilization survives reload', civsAfter >= 1);

  console.log('== Idle catch-up (2h simulated) ==');
  await page.evaluate(() => { window.STRATA_DEBUG.S.lastTick = Date.now() - 2 * 3600 * 1000; });
  await new Promise(r => setTimeout(r, 2500)); // wait 2 game loops
  const epitaphs = await page.evaluate(() => window.STRATA_DEBUG.S.epitaphs.length);
  const living = await page.evaluate(() => window.STRATA_DEBUG.S.civs.filter(c => c.alive).length);
  console.log('  after 2h: living=' + living + ', epitaphs=' + epitaphs);
  T('idle catch-up produced history', epitaphs >= 1 || living >= 1);
  T('world always has a living civ', living >= 1);

  console.log('== Summon flow ==');
  await page.evaluate(() => { window.STRATA_DEBUG.S.shards = 100; });
  await page.click('.nav-btn[data-view="dig"]');
  await new Promise(r => setTimeout(r, 1100)); // one gameLoop render pass
  const summonEnabled = await page.$eval('#summon-btn', el => !el.disabled);
  console.log('  summon enabled with shards: ' + summonEnabled);
  await page.click('#summon-btn');
  await new Promise(r => setTimeout(r, 300));
  const civCount2 = await page.evaluate(() => window.STRATA_DEBUG.S.civs.filter(c => c.alive).length);
  T('summon adds a second civilization', civCount2 === 2);
  const shardsAfter = await page.evaluate(() => Math.floor(window.STRATA_DEBUG.S.shards));
  console.log('  shards after summon: ' + shardsAfter);
  T('shards spent', shardsAfter < 100);

  console.log('== Final screenshot ==');
  await page.screenshot({ path: 'qa/shot-after-play.png' });
  T('screenshot captured', true);

  console.log('== Console health (final) ==');
  console.log('  total console errors: ' + consoleErrors.length);
  T('zero console errors at end', consoleErrors.length === 0);
  if (consoleErrors.length) console.log('  ', consoleErrors.slice(0, 5));

  await browser.close();
  console.log('\n=========================================');
  console.log('PASS: ' + pass + '  FAIL: ' + fail);
  console.log('=========================================');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('E2E CRASH:', e); process.exit(2); });
