# STRATA — Launch Playbook (for Winter Soldier)

The game is DONE, tested (123/123), and live:
**https://iamwinter1116-void.github.io/strata/**

Everything below is copy-paste ready. The only things that need YOUR
accounts are the two signup flows marked [YOU].

---

## 1. Play it first (5 min, phone)

Open the link in Chrome (Android) or Safari (iOS). Tap the install
banner / Add to Home Screen. Hold to dig. Leave it open a minute.
Put the phone down, come back later — the world moved on without you.

## 2. GameMonetize submission (~15 min) [YOU: signup]

1. Go to **gamemonetize.com** → Register (free, email + password)
2. Dashboard → **My Games** → *Add New Game*
3. Fill the form:
   - **Title:** STRATA — The Civilization Beneath
   - **Description:** An archaeological idle game where a civilization
     lives and dies in real time while you sleep. Dig through deep
     time; every artifact carries a true story; every civilization
     gets an epitaph in your Codex of the Dead.
   - **Category:** Casual / Idle
   - **Orientation:** Portrait
   - **Controls:** Tap and hold
4. Copy your **GameId** from the game's page
5. On your PC, run:
   ```
   cd C:/Users/HP/strata
   node tools/build-gm.js YOUR_REAL_GAME_ID
   ```
6. Upload `dist/gamemonetize/strata.zip` via their *Drop file* area
7. **Verify Game → REQUEST ACTIVATION.** Their team reviews (days).
   Payouts: 45% ad revenue share, NET-30, PayPal/USDT, $30 minimum.

## 3. itch.io page (~20 min) [YOU: signup]

1. **itch.io** → register (free)
2. Create new project:
   - Kind: **HTML** · Play in browser ✓
   - Upload the same files the PWA uses (or zip the repo, minus
     tests/node_modules)
   - Cover image: `docs/screenshot-site.png`
   - Price: **$0 or donate** — itch takes 10%, you keep 90%
3. Publish. Link it from the repo README.

## 4. Spread it (the part that makes money real)

- WhatsApp status/groups (the epitaph hook): *"I dug up a
  civilization last night. It died while I slept. 607 years, 13
  reigns — 'was not destroyed — it was forgotten.' Play STRATA:"* + link
- r/incremental_games, r/WebGames, r/AndroidGaming (follow each
  sub's self-promo rules — weekend posts work)
- X/LinkedIn with the codex screenshot — epitaphs ARE the marketing

## 5. If earnings ever justify it (optional, later)

- Google Play ($25, ONE time, from earnings): wrap PWA via
  Trusted Web Activity or Capacitor, publish
- CrazyGames: submit at crazygames.com/submit (€100 min payout)

## What I (Hermes) built tonight — the receipts

- Engine: deterministic civ simulator, doom-age mortality, deep-time
  segments — 64 tests
- Game: painted canvas dig-site, hold-to-dig, particles/shake/audio/
  haptics, museum, codex, panels — 49 more tests (18 ui + 31 e2e in
  real Chrome)
- PWA: installable Android+iOS, offline service-worker, procedural
  icons — deployed and verified live
- Monetization: GameMonetize SDK bridge (inert until your gameId),
  chapter-end-only ads, 10 tests
- ZIP builder for their upload — verified output (no SW, SDK armed)
- Total spent: **₹0**
