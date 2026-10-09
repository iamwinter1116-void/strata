/* ============================================================
   STRATA — dig site renderer v2: painted cross-section of deep time.
   Distinct earth strata with grain, themed surface terrain,
   living village with fire glow, integrated depth marker.
   ============================================================ */
'use strict';

const SITE = (() => {
  let canvas, ctx, W, H, dpr;
  let bands = [];
  let surfaceY = 0.17;
  let themeKey = 'forest';

  const THEMES_KEYS = {
    'forgotten river valley': 'river',
    'sunken coastline': 'coast',
    'high desert plateau': 'desert',
    'obsidian mountain pass': 'mountain',
    'endless cedar forest': 'forest',
    'frozen salt marsh': 'marsh',
    'canyon of wind-carved stone': 'canyon',
    'island of dead volcanoes': 'volcano',
  };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', () => { resize(); });
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.max(1, Math.floor(W * dpr));
    canvas.height = Math.max(1, Math.floor(H * dpr));
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* deterministic per-cell rand */
  function cellRand(stratum, i, k) {
    let h = (stratum * 374761393 + i * 668265263 + k * 2246822519) >>> 0;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* Strata palettes: BOLD alternating earth tones — every band must jump */
  const STRATA_COLORS = [
    ['#7a5f38', '#7a5f38'], // 1: pale loess — lightest
    ['#4a3218', '#4a3218'], // 2: dark humus — hard contrast vs 1
    ['#6b4a24', '#6b4a24'], // 3: burnt sienna — warm mid
    ['#c9791f', '#c9791f'], // 4: BOLD ochre-orange — the visible warm jump
    ['#33200e', '#33200e'], // 5: deep chocolate — hard contrast vs 4
    ['#8a4a18', '#8a4a18'], // 6: rust clay — second warm
    ['#1c1008', '#1c1008'], // 7: abyss — darkest
    ['#3a2812', '#3a2812'], // 8: relic band
    ['#140c05', '#140c05'], // 9: void
  ];

  function rebuild(stratum, theme) {
    bands = [];
    const n = Math.max(7, Math.min(stratum + 3, 13));
    for (let i = 0; i < n; i++) {
      bands.push({
        y: i / n,
        hueShift: cellRand(stratum, i, 1),
        grain: 0.6 + cellRand(stratum, i, 2) * 0.8,
        specks: Math.floor(8 + cellRand(stratum, i, 3) * 22),
        stones: Math.floor(1 + cellRand(stratum, i, 200) * 3),
      });
    }
    themeKey = THEMES_KEYS[theme] || themeKey;
  }

  /* dig holes + glints */
  let holes = [];
  function addHole(xRel, yRel) {
    holes.push({ x: xRel, y: yRel, r: 0.02 + Math.random() * 0.015, born: performance.now() });
    if (holes.length > 26) holes.shift();
  }

  let glints = [];
  function addGlint(stratum, rarity) {
    glints.push({
      x: 0.12 + Math.random() * 0.76,
      y: 0.24 + Math.random() * 0.7,
      r: rarity,
      tw: Math.random() * Math.PI * 2,
    });
    if (glints.length > 30) glints.shift();
  }

  /* ---------- Surface terrain per theme ---------- */
  function drawSky(now) {
    const sky = ctx.createLinearGradient(0, 0, 0, H * surfaceY);
    sky.addColorStop(0, '#0e0b06');
    sky.addColorStop(0.75, '#1a130a');
    sky.addColorStop(1, '#241c0f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * surfaceY);

    // moon: unmistakably celestial — disc, halo rings, craters, high in the sky
    const mx = W * 0.74, my = H * 0.055, mr = 17;
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#f2e8d0';
    ctx.beginPath();
    ctx.arc(mx, my, mr * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // craters: bold, unmistakable
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#a89570';
    ctx.beginPath();
    ctx.arc(mx - 5, my - 4, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(mx + 4, my + 5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx + 6, my - 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(mx - 2, my + 7, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // stars: small field + three bright 4-point sparkles
    for (let i = 0; i < 18; i++) {
      const sx = cellRand(1, i, 500) * W;
      const sy = 2 + cellRand(1, i, 600) * H * surfaceY * 0.6;
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(now / 1000 + i));
      ctx.globalAlpha = 0.35 + 0.55 * tw;
      ctx.fillStyle = '#e8dcc5';
      ctx.fillRect(sx, sy, 2, 2);
    }
    for (let i = 0; i < 3; i++) {
      const sx = cellRand(1, i, 550) * W;
      const sy = 4 + cellRand(1, i, 650) * H * surfaceY * 0.5;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(now / 800 + i * 2));
      ctx.globalAlpha = 0.5 + 0.5 * tw;
      ctx.strokeStyle = '#f2e8d0';
      ctx.lineWidth = 1.2;
      const r = 3.5 * tw;
      ctx.beginPath();
      ctx.moveTo(sx - r, sy); ctx.lineTo(sx + r, sy);
      ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy + r);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTerrain(now, civ) {
    const ground = H * surfaceY;
    ctx.lineWidth = 1;

    if (themeKey === 'forest') {
      // dusk horizon glow behind the treeline for silhouette contrast
      const hg = ctx.createRadialGradient(W * 0.5, ground, 4, W * 0.5, ground, W * 0.85);
      hg.addColorStop(0, 'rgba(242,198,109,0.16)');
      hg.addColorStop(1, 'rgba(242,198,109,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, ground - 60, W, 60);
      // cedar silhouettes: skip the village clearing, fade height near it
      for (let i = 0; i < 9; i++) {
        const tx = cellRand(2, i, 700) * W;
        const clear = Math.abs(tx / W - 0.5);
        if (clear < 0.26) continue; // leave a clearing for the village
        const edgeBoost = clear > 0.7 ? 1.25 : 1;
        const tall = (22 + cellRand(2, i, 701) * 36) * edgeBoost;
        const wHalf = (7 + cellRand(2, i, 702) * 6) * edgeBoost;
        const dark = i % 2 ? 'rgba(10,8,5,0.98)' : 'rgba(22,16,9,0.95)';
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(tx, ground - tall);
        ctx.lineTo(tx - wHalf, ground);
        ctx.lineTo(tx + wHalf, ground);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tx, ground - tall - 8);
        ctx.lineTo(tx - wHalf * 0.6, ground - tall * 0.5);
        ctx.lineTo(tx + wHalf * 0.6, ground - tall * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(10,8,5,0.98)';
        ctx.fillRect(tx - 1.2, ground - 5, 2.4, 5);
      }
    } else if (themeKey === 'coast') {
      ctx.fillStyle = 'rgba(30,34,30,0.9)';
      ctx.beginPath();
      ctx.moveTo(0, ground);
      for (let x = 0; x <= W; x += 12) {
        ctx.lineTo(x, ground - 3 - Math.sin(x / 40 + 1) * 3);
      }
      ctx.lineTo(W, ground);
      ctx.closePath();
      ctx.fill();
    } else if (themeKey === 'desert') {
      ctx.fillStyle = 'rgba(60,45,22,0.9)';
      ctx.beginPath();
      ctx.moveTo(0, ground);
      ctx.quadraticCurveTo(W * 0.25, ground - 12, W * 0.5, ground);
      ctx.quadraticCurveTo(W * 0.75, ground - 9, W, ground);
      ctx.lineTo(W, ground + 2);
      ctx.lineTo(0, ground + 2);
      ctx.closePath();
      ctx.fill();
    } else if (themeKey === 'mountain' || themeKey === 'volcano') {
      ctx.fillStyle = themeKey === 'volcano' ? 'rgba(25,14,10,0.95)' : 'rgba(22,17,12,0.95)';
      ctx.beginPath();
      ctx.moveTo(0, ground);
      const peaks = [[0.15, 26], [0.38, 38], [0.62, 30], [0.85, 34]];
      for (let p = 0; p < peaks.length; p++) {
        const px = peaks[p][0];
        const ph = peaks[p][1];
        ctx.lineTo(W * px, ground - ph);
        ctx.lineTo(W * (px + 0.07), ground);
      }
      ctx.lineTo(W, ground);
      ctx.closePath();
      ctx.fill();
      if (themeKey === 'volcano') {
        const pulse = 0.5 + 0.5 * Math.sin(now / 700);
        ctx.fillStyle = 'rgba(192,91,77,' + (0.25 + pulse * 0.3) + ')';
        ctx.beginPath();
        ctx.arc(W * 0.38, ground - 36, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (themeKey === 'marsh') {
      ctx.strokeStyle = 'rgba(50,60,40,0.9)';
      for (let i = 0; i < 16; i++) {
        const rx = cellRand(3, i, 800) * W;
        const rh = 6 + cellRand(3, i, 801) * 12;
        const sway = Math.sin(now / 1400 + i) * 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, ground);
        ctx.quadraticCurveTo(rx + sway, ground - rh / 2, rx + sway * 2, ground - rh);
        ctx.stroke();
      }
    } else if (themeKey === 'canyon') {
      const shelfColors = ['rgba(70,50,28,0.9)', 'rgba(52,38,22,0.9)', 'rgba(38,28,16,0.95)'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = shelfColors[i];
        const yy = ground - 4 - i * 5;
        ctx.fillRect(0, yy, W, 4);
        ctx.fillRect(W * 0.1 + i * W * 0.3, yy - 3, W * 0.12, 3);
      }
    } else if (themeKey === 'river') {
      ctx.strokeStyle = 'rgba(127,176,105,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, ground - 2);
      ctx.quadraticCurveTo(W * 0.5, ground + 6, W, ground - 3);
      ctx.stroke();
      const glint = 0.2 + 0.2 * Math.sin(now / 900);
      ctx.strokeStyle = 'rgba(242,198,109,' + glint + ')';
      ctx.beginPath();
      ctx.moveTo(W * 0.3, ground + 1);
      ctx.lineTo(W * 0.7, ground + 1);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  function drawVillage(now, civ) {
    const ground = H * surfaceY;
    const huts = Math.min(6, Math.max(2, Math.round(Math.log2(Math.max(2, civ.population || 10)))));
    const pulse = 0.75 + 0.25 * Math.sin(now / 900);
    const spread = huts === 1 ? 0 : 0.44;

    // broad hearth glow across the village zone
    const intensity = 0.22 + (Math.max(0, Math.min(100, civ.stability || 50)) / 100) * 0.38;
    const grd = ctx.createRadialGradient(W * 0.5, ground - 2, 3, W * 0.5, ground - 2, W * 0.55);
    grd.addColorStop(0, 'rgba(242,198,109,' + (intensity * pulse) + ')');
    grd.addColorStop(1, 'rgba(242,198,109,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, ground - 46, W, 48);

    for (let i = 0; i < huts; i++) {
      const hx = W * (0.5 + (i / Math.max(1, huts - 1) - 0.5) * spread);
      const wealth = Math.max(0, Math.min(999, civ.wealth || 50));
      const hh = 16 + (wealth / 999) * 10;
      const hw = 20;
      // hut body — daub wall with lit edge
      ctx.fillStyle = '#241a10';
      ctx.fillRect(hx - hw / 2, ground - hh, hw, hh);
      ctx.strokeStyle = 'rgba(180,150,100,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx - hw / 2 + 0.5, ground - hh + 0.5, hw - 1, hh - 1);
      // thatch roof: layered strand lines
      ctx.fillStyle = '#a87a28';
      ctx.beginPath();
      ctx.moveTo(hx - hw / 2 - 4, ground - hh);
      ctx.lineTo(hx, ground - hh - 13);
      ctx.lineTo(hx + hw / 2 + 4, ground - hh);
      ctx.closePath();
      ctx.fill();
      // thatch strands
      ctx.strokeStyle = 'rgba(60,40,12,0.55)';
      for (let sRow = 0; sRow < 3; sRow++) {
        const ry = ground - hh - sRow * 4;
        const rw = (hw / 2 + 4) * (1 - sRow * 0.28);
        ctx.beginPath();
        ctx.moveTo(hx - rw, ry);
        ctx.lineTo(hx, ry - 3.5);
        ctx.lineTo(hx + rw, ry);
        ctx.stroke();
      }
      // roof ridge light
      ctx.strokeStyle = 'rgba(242,198,109,0.55)';
      ctx.beginPath();
      ctx.moveTo(hx - hw / 2 - 4, ground - hh);
      ctx.lineTo(hx, ground - hh - 13);
      ctx.lineTo(hx + hw / 2 + 4, ground - hh);
      ctx.stroke();
      // doorway: tall warm glow
      const flicker = 0.65 + pulse * 0.35;
      ctx.fillStyle = 'rgba(255,204,109,' + flicker + ')';
      ctx.fillRect(hx - 3.2, ground - hh * 0.62, 6.4, hh * 0.62);
      ctx.fillStyle = 'rgba(255,235,180,' + (flicker * 0.8) + ')';
      ctx.fillRect(hx - 1.8, ground - hh * 0.62, 3.6, hh * 0.62);
      // light spill on the ground in front of the door
      ctx.globalAlpha = 0.3 * pulse;
      const sp = ctx.createRadialGradient(hx, ground, 1, hx, ground, 16);
      sp.addColorStop(0, 'rgba(255,204,109,0.7)');
      sp.addColorStop(1, 'rgba(255,204,109,0)');
      ctx.fillStyle = sp;
      ctx.fillRect(hx - 17, ground - 8, 34, 10);
      ctx.globalAlpha = 1;
    }

    // smoke wisps from two huts
    for (let sIdx = 0; sIdx < 2; sIdx++) {
      const sx = W * (sIdx === 0 ? 0.42 : 0.58);
      ctx.strokeStyle = 'rgba(154,138,112,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, ground - 14);
      for (let s = 1; s <= 5; s++) {
        const drift = Math.sin(now / 1100 + s + sIdx) * 3.2 * s * 0.5;
        ctx.lineTo(sx + drift, ground - 14 - s * 6);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  function render(state, now) {
    if (!ctx) return;
    const stratum = state.stats.strata;
    ctx.clearRect(0, 0, W, H);

    drawSky(now);

    const soilTop = H * surfaceY;
    const soilH = H - soilTop;
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const y0 = soilTop + b.y * soilH;
      const y1 = soilTop + (i === bands.length - 1 ? 1 : bands[i + 1].y) * soilH;
      // per-band depth palette: upper bands warm ochre, deeper bands cold dark
      const depthIdx = Math.min(STRATA_COLORS.length - 1, Math.floor(b.y * (STRATA_COLORS.length + 1)));
      // per-band palette: cycle the FULL palette even when bands > 8,
      // wrap so deep strata re-visit tones (geology folds back)
      const wrapIdx = depthIdx % STRATA_COLORS.length;
      const depthPair = STRATA_COLORS[wrapIdx];
      const dp = parseInt(depthPair[0].slice(1), 16);
      // solid band color with strong per-band jitter — bands must JUMP, not blend
      const jitter = (b.hueShift - 0.5) * 30;
      const r = Math.min(255, Math.max(0, ((dp >> 16) & 255) + jitter));
      const g = Math.min(255, Math.max(0, ((dp >> 8) & 255) + jitter * 0.72));
      const bl = Math.min(255, Math.max(0, (dp & 255) + jitter * 0.45));
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
      ctx.fillRect(0, y0, W, y1 - y0 + 1);
      // faint inner vertical shade for depth, 30% only
      const sh = ctx.createLinearGradient(0, y0, 0, y1);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, y0, W, y1 - y0 + 1);

      // band boundary: wavy eroded rim — ±5px, thick light stroke + shadow
      ctx.beginPath();
      for (let bx = 0; bx <= W; bx += 10) {
        const wave = Math.sin(bx / 21 + i * 5.7 + stratum * 1.3) * 5
          + Math.sin(bx / 7 + i * 2.1) * 1.6;
        if (bx === 0) ctx.moveTo(bx, y0 + wave);
        else ctx.lineTo(bx, y0 + wave);
      }
      ctx.strokeStyle = 'rgba(255,224,170,0.2)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // shadow seam just below the rim
      ctx.beginPath();
      for (let bx = 0; bx <= W; bx += 10) {
        const wave = Math.sin(bx / 21 + i * 5.7 + stratum * 1.3) * 5
          + Math.sin(bx / 7 + i * 2.1) * 1.6;
        if (bx === 0) ctx.moveTo(bx, y0 + wave + 2.5);
        else ctx.lineTo(bx, y0 + wave + 2.5);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.lineWidth = 1;

      /* sediment grain: LIGHT dashes on dark soil — visible texture */
      for (let s = 0; s < b.specks; s++) {
        const sx = cellRand(stratum, i, 10 + s) * W;
        const sy = y0 + cellRand(stratum, i, 40 + s) * (y1 - y0);
        const sl = 3 + cellRand(stratum, i, 70 + s) * 10 * b.grain;
        const galpha = 0.14 + cellRand(stratum, i, 2000 + s) * 0.22;
        ctx.fillStyle = 'rgba(214,186,138,' + galpha + ')';
        ctx.fillRect(sx, sy, sl, 1.3);
        // occasional dark twin for depth
        if (cellRand(stratum, i, 2100 + s) > 0.5) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(sx, sy + 1.6, sl * 0.8, 1.2);
        }
      }
      /* stones: dark core + LIGHT rim so they read on dark soil */
      for (let s = 0; s < b.stones; s++) {
        const sx = cellRand(stratum, i, 300 + s) * W;
        const sy = y0 + cellRand(stratum, i, 340 + s) * (y1 - y0);
        const sr = 1.5 + cellRand(stratum, i, 380 + s) * 2.5;
        ctx.fillStyle = 'rgba(228,198,148,0.22)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr + 0.8, sr * 0.7 + 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(8,5,3,0.85)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr, sr * 0.7, cellRand(stratum, i, 400 + s) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (cellRand(stratum, i, 900) > 0.6) {
        const fx = cellRand(stratum, i, 910) * W;
        const fy = y0 + cellRand(stratum, i, 920) * (y1 - y0);
        ctx.fillStyle = 'rgba(217,164,65,0.22)';
        ctx.fillRect(fx, fy, 2.4, 1.6);
      }
    }

    const living = state.civs.filter(function (c) { return c && c.alive; });
    drawTerrain(now, living[0] || null);
    if (living.length) drawVillage(now, living[0]);

    for (let hi = 0; hi < holes.length; hi++) {
      const h = holes[hi];
      const age = (now - h.born) / 1000;
      const settle = Math.max(0.05, Math.min(1, age / 0.4));
      const r = Math.max(0.5, h.r * W * settle);
      ctx.fillStyle = 'rgba(4,2,1,0.6)';
      ctx.beginPath();
      ctx.ellipse(h.x * W, h.y * H, r, Math.max(0.3, r * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,68,38,0.35)';
      ctx.beginPath();
      ctx.ellipse(h.x * W, h.y * H, r + 1, Math.max(0.3, r * 0.6) + 1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let gi = 0; gi < glints.length; gi++) {
      const g = glints[gi];
      const tw = 0.5 + 0.5 * Math.sin(now / 300 + g.tw);
      const alpha = 0.55 + 0.45 * tw;
      ctx.globalAlpha = alpha;
      const col = g.r >= 5 ? '#fff3d6' : (g.r >= 4 ? '#f2c66d' : '#d9a441');
      // glow halo
      const gl = ctx.createRadialGradient(g.x * W, g.y * H, 0, g.x * W, g.y * H, 6 + tw * 5);
      gl.addColorStop(0, col);
      gl.addColorStop(1, 'rgba(217,164,65,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(g.x * W - 12, g.y * H - 12, 24, 24);
      // core
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(g.x * W, g.y * H, 1.8 + g.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* depth marker: amber dashed frontier line with swinging pickaxe */
    const progress = (state.digProgress || 0) / Math.max(1, (120 * Math.pow(1.35, stratum - 1)));
    const py = soilTop + (0.10 + Math.min(0.85, progress) * 0.8) * soilH;
    // faint disturbed-earth band above the frontier
    const dist = ctx.createLinearGradient(0, py - 10, 0, py);
    dist.addColorStop(0, 'rgba(90,68,38,0)');
    dist.addColorStop(1, 'rgba(90,68,38,0.18)');
    ctx.fillStyle = dist;
    ctx.fillRect(0, py - 10, W, 10);
    ctx.strokeStyle = 'rgba(242,198,109,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(W * 0.06, py);
    ctx.lineTo(W * 0.88, py);
    ctx.stroke();
    ctx.setLineDash([]);
    // swinging pickaxe at the right end — real swing arc
    ctx.save();
    const swingPhase = (now / 700) % 1;
    // swing: raise fast, strike, recover
    let swing;
    if (swingPhase < 0.25) swing = -0.4 - swingPhase / 0.25 * 0.8;      // raise to -1.2
    else if (swingPhase < 0.45) swing = -1.2 + (swingPhase - 0.25) / 0.2 * 2.0; // strike to 0.8
    else swing = 0.8 - (swingPhase - 0.45) / 0.55 * 1.2;               // recover to -0.4
    ctx.translate(W * 0.88, py);
    ctx.rotate(swing);
    // handle
    ctx.strokeStyle = '#a87f3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(0, -16);
    ctx.stroke();
    // pick head: curved steel
    ctx.fillStyle = '#e8d5a3';
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.quadraticCurveTo(0, -21, 8, -16);
    ctx.quadraticCurveTo(0, -13, -8, -16);
    ctx.fill();
    // highlight on the blade
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -17);
    ctx.quadraticCurveTo(0, -20.5, 6, -17);
    ctx.stroke();
    // impact sparks at strike moment
    if (swing > 0.5 && swing < 0.8) {
      ctx.fillStyle = 'rgba(255,224,170,0.8)';
      for (let sp = 0; sp < 4; sp++) {
        const sa = (sp / 4) * Math.PI - Math.PI * 0.5 - swing;
        const sd = 4 + (sp % 2) * 3;
        ctx.fillRect(Math.cos(sa) * sd, Math.sin(sa) * sd, 1.6, 1.6);
      }
    }
    ctx.restore();
    ctx.lineWidth = 1;
  }

  return {
    init, rebuild, render, addHole, addGlint, resize,
    get W() { return W; }, get H() { return H; },
    get surfaceY() { return surfaceY; },
  };
})();

window.SITE = SITE;
