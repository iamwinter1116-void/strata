#!/usr/bin/env node
'use strict';
/* Build the GameMonetize submission ZIP.
   Usage: node tools/build-gm.js <gameId>
   Produces dist/gamemonetize/strata.zip with the SDK-activated index.html. */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gameId = process.argv[2];
if (!gameId || gameId === 'your_game_id_here') {
  console.error('Usage: node tools/build-gm.js <your_game_id>');
  console.error('Get the GameId from GameMonetize Dashboard > My Games > your game.');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'gamemonetize');
const FILES = ['index.html', 'style.css', 'app.js', 'engine.js', 'fx.js', 'site.js', 'monetization.js',
  'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

// fresh dist
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'icons'), { recursive: true });

// copy assets
for (const f of FILES) {
  const src = path.join(ROOT, f);
  const dst = path.join(DIST, f);
  fs.copyFileSync(src, dst);
}

// patch index.html: activate the SDK with the real game id
const htmlPath = path.join(DIST, 'index.html');
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
// and drop the PWA files from the package
for (const f of ['sw.js', 'manifest.webmanifest']) {
  const p = path.join(DIST, f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
// remove the sw registration remnants check
if (fs.readFileSync(htmlPath, 'utf8').includes('serviceWorker')) {
  console.error('WARNING: service worker reference still present in GM build');
}

// zip it (PowerShell Compress-Archive, always available on Windows)
const zipPath = path.join(DIST, 'strata.zip');
execSync(`powershell -Command "Compress-Archive -Path '${DIST.replaceAll('\\\\', '\\')}\\*' -DestinationPath '${zipPath.replaceAll('\\\\', '\\')}' -Force"`, { stdio: 'inherit' });

const size = fs.statSync(zipPath).size;
console.log(`Built dist/gamemonetize/strata.zip (${(size / 1024).toFixed(1)} KB) with gameId ${gameId}`);
console.log('Upload: GameMonetize Dashboard > My Games > your game > Drop file');
console.log('Then: Verify Game → REQUEST ACTIVATION');
