# STRATA — The Civilization Beneath

**An archaeological idle game where the civilization is real, alive, and mortal.**

You are a Surveyor digging into deep time. Below your dig site, a procedurally
generated civilization lives in real time — 0.5 years pass for every second of
yours. While you sleep, hundreds of years of its history unfold: wars, plagues,
miracles, golden ages, reforms. And every civilization dies. You never know when.

## What makes it different

- **A world that doesn't wait for you.** The simulation runs in real time and
  catches up offline. Leave for 8 hours and return to find your civilization
  dead — buried under its successor. Its chronicle, its artifacts, its epitaph
  remain.
- **Every artifact has a true story.** Items are generated from the civilization's
  ACTUAL event history. A silver seal isn't just a silver seal — it's "a silver
  governor seal, from Velron-dor, buried in the year of the great flood."
- **Procedural mortality.** Every civilization rolls a hidden doom-age at birth.
  You watch the signs — stability decaying, population wobbling — but you never
  see the hour.
- **The Codex.** Every fallen civilization gets an epitaph. "Karonmir — 812 years,
  14 reigns — died of the long drought." Collect the memory of everything you've
  outlived.
- **One shared world.** A daily UTC seed gives every player on Earth the same
  world theme that day. No servers, no accounts — just the same sky.

## Play

- **Web/PWA (installable):** https://iamwinter1116-void.github.io/strata/
  - Android: install from Chrome — it appears in your app drawer like a native app
  - iOS: Safari → Share → Add to Home Screen
  - Works fully offline once installed
- Keyboard-free, one-thumb friendly, no account, no permissions.

## Monetization

Ads only at natural chapter-ends (stratum level-ups), throttled to one per
3 minutes, never in the first 4 minutes of play. No pay-to-win. No energy
paywall — energy regenerates on its own.

## Tech

Pure vanilla JS. Zero dependencies. Deterministic seeded simulation
(mulberry32 + FNV-1a). 114 automated tests (engine, UI integration,
monetization, real-Chrome e2e). Service worker for offline play.

## Develop

```
python -m http.server 8765     # any static server
open http://localhost:8765/

node tests/engine.test.js      # 64 tests
node tests/ui.test.js          # 16 tests
node tests/monetization.test.js # 10 tests
node tests/e2e.js              # 24 tests (needs Chrome; serve on :8765 first)
```

## Build for GameMonetize

```
node tools/build-gm.js <your_game_id>
# → dist/gamemonetize/strata.zip  (SDK-activated build)
```

## License

MIT
