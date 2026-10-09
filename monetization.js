/* STRATA — monetization bridge.
   Inert everywhere except on GameMonetize-hosted builds:
   - gameId placeholder = no SDK calls at all (PWA/itch builds stay pure)
   - Ads fire ONLY at stratum level-ups (natural chapter end),
     at least 3 minutes apart, never in the first 4 minutes of play.
   - SDK_GAME_PAUSE freezes the world clock; SDK_GAME_START resumes it.
   This file loads before app.js. */
'use strict';

const MONETIZATION = (() => {
  const PLACEHOLDER = 'your_game_id_here';
  const hasWindow = typeof window !== 'undefined';
  const root = hasWindow ? window : globalThis;
  let gameId = PLACEHOLDER;
  let sdkReady = false;
  let paused = false;
  let playStarted = 0;
  let lastAdAt = 0;
  const MIN_PLAY_MS = 4 * 60 * 1000;   // no ads in the first 4 minutes
  const AD_GAP_MS = 3 * 60 * 1000;     // at most one ad per 3 minutes

  function markPlayStart(when) {
    playStarted = typeof when === 'number' ? when : Date.now();
  }

  function isLive() {
    return gameId !== PLACEHOLDER && typeof root.sdk !== 'undefined' && typeof root.sdk.showBanner !== 'undefined';
  }

  /* Called by app.js at stratum level-up. Returns true if an ad was requested. */
  function atStratumLevel() {
    if (!isLive()) return false;
    const now = Date.now();
    if (now - playStarted < MIN_PLAY_MS) return false;
    if (now - lastAdAt < AD_GAP_MS) return false;
    lastAdAt = now;
    try { root.sdk.showBanner(); return true; } catch (e) { return false; }
  }

  function isPaused() { return paused; }

  /* Install SDK with a real gameId — used by the GameMonetize build. */
  function install(id) {
    gameId = id;
    root.SDK_OPTIONS = {
      gameId: id,
      onEvent: (a) => {
        switch (a.name) {
          case 'SDK_GAME_PAUSE': paused = true; break;
          case 'SDK_GAME_START': paused = false; break;
          case 'SDK_READY': sdkReady = true; break;
        }
      },
    };
    if (hasWindow) {
      (function (a, b, c) {
        const d = a.getElementsByTagName(b)[0];
        if (!a.getElementById(c)) {
          const s = a.createElement(b);
          s.id = c; s.src = 'https://api.gamemonetize.com/sdk.js';
          d.parentNode.insertBefore(s, d);
        }
      })(document, 'script', 'gamemonetize-sdk');
    }
  }

  return { install, atStratumLevel, markPlayStart, isPaused, isLive, get ready() { return sdkReady; } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MONETIZATION;
else window.MONETIZATION = MONETIZATION;
