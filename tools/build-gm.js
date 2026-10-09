#!/usr/bin/env node
'use strict';
/* Build the GameMonetize submission ZIP.
   Usage: node tools/build-gm.js <gameId>
   Stages in OS temp (dist/ can be AV-locked on Windows), drops ZIP in dist/gamemonetize/.
   Produces strata.zip with the SDK-activated index.html. */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const gameId = process.argv[2];
if (!gameId || gameId === 'your_game_id_here') {
  console.error('Usage: node tools/build-gm.js <your_game_id>');
  console.error('Get the GameId from GameMonetize Dashboard > My Games > your game.');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'gamemonetize');
const STAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-gm-'));
const FILES = ['index.html', 'style.css', 'app.js', 'engine.js', 'fx.js', 'site.js', 'monetization.js',
  'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

try {
  // stage the build in temp — never touches dist until the final ZIP
  fs.mkdirSync(path.join(STAGE, 'icons'), { recursive: true });
  for (const f of FILES) {
    fs.copyFileSync(path.join(ROOT, f), path.join(STAGE, f));
  }

  // patch index.html: activate the SDK with the real game id
  const htmlPath = path.join(STAGE, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const activate = `<script>window.MONETIZATION.install('${gameId}');</script>`;
  if (!html.includes(activate)) {
    html = html.replace('<script src="monetization.js"></script>',
      '<script src="monetization.js"></script>\n' + activate);
  }
  // GameMonetize hosts the game on their own domain inside an iframe:
  // our service worker + manifest are PWA-only and useless there — strip them.
  html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '');
  html = html.replace('<link rel="apple-touch-icon" href="icons/icon-192.png">', '');
  html = html.replace(/<script>\s*\n?\s*if \('serviceWorker' in navigator\) \{[\s\S]*?<\/script>/, '');
  fs.writeFileSync(htmlPath, html);
  // drop the PWA files from the package
  for (const f of ['sw.js', 'manifest.webmanifest']) {
    fs.unlinkSync(path.join(STAGE, f));
  }
  if (fs.readFileSync(htmlPath, 'utf8').includes('serviceWorker')) {
    console.error('WARNING: service worker reference still present in GM build');
  }

  // zip inside temp, then move the single file into dist
  const tmpZip = path.join(STAGE, 'strata.zip');
  const stageWin = STAGE.replaceAll('\\', '\\\\');
  const zipWin = tmpZip.replaceAll('\\', '\\\\');
  execSync(`powershell -Command "Compress-Archive -Path '${stageWin}\\*' -DestinationPath '${zipWin}' -Force"`, { stdio: 'inherit' });

  fs.mkdirSync(DIST, { recursive: true });
  const finalZip = path.join(DIST, 'strata.zip');
  fs.copyFileSync(tmpZip, finalZip);

  const size = fs.statSync(finalZip).size;
  console.log(`Built dist/gamemonetize/strata.zip (${(size / 1024).toFixed(1)} KB) with gameId ${gameId}`);
  console.log('Upload: GameMonetize Dashboard > My Games > your game > Drop file');
  console.log('Then: Verify Game → REQUEST ACTIVATION');
} finally {
  try { fs.rmSync(STAGE, { recursive: true, force: true }); } catch (_) {}
}
