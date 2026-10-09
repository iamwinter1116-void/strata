'use strict';
/* Monetization bridge tests — run: node tests/monetization.test.js */

const M = require('../monetization.js');
let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.log('  FAIL - ' + name); }
}

console.log('== Placeholder mode (PWA/itch builds — the default) ==');
T('not live with placeholder id', M.isLive() === false);
T('atStratumLevel is a no-op without SDK', M.atStratumLevel() === false);

console.log('== Installed with fake sdk ==');
{
  // simulate the GameMonetize environment
  const calls = [];
  global.sdk = { showBanner: () => { calls.push(Date.now()); } };
  const fresh = require('../monetization.js');
  fresh.install('fake-game-id'); // REQUIRED — activates live mode
  fresh.markPlayStart();
  // right after play start: no ad (min play window)
  T('no ad in first 4 minutes', fresh.atStratumLevel() === false);

  // simulate 5 minutes of play
  fresh.markPlayStart(Date.now() - 5 * 60 * 1000 - 1);
  T('ad fires after min-play window at stratum level', fresh.atStratumLevel() === true);
  T('second level-up within 3min gap is silent', fresh.atStratumLevel() === false);
  T('sdk.showBanner called exactly once', calls.length === 1);
  T('paused starts false', fresh.isPaused() === false);
}

console.log('== SDK pause/resume events ==');
{
  // re-require with cache cleared to re-init
  delete require.cache[require.resolve('../monetization.js')];
  global.sdk = { showBanner: () => {} };
  const fresh = require('../monetization.js');
  fresh.install('test-game-id');
  // fire the pause event through SDK_OPTIONS
  global.SDK_OPTIONS.onEvent({ name: 'SDK_GAME_PAUSE' });
  T('pause event sets paused', fresh.isPaused() === true);
  global.SDK_OPTIONS.onEvent({ name: 'SDK_GAME_START' });
  T('start event clears paused', fresh.isPaused() === false);
  global.SDK_OPTIONS.onEvent({ name: 'SDK_READY' });
  T('SDK_READY marks ready', fresh.ready === true);
}

console.log('\n=========================================');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
console.log('=========================================');
process.exit(fail > 0 ? 1 : 0);
