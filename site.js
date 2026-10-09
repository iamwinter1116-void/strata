/* ============================================================
   STRATA — dig site renderer: canvas cross-section of deep time.
   DPR-capped buffer, deterministic sediment, living-civ signal,
   dig holes, artifact glints. Rendered inside the app rAF loop.
   ============================================================ */
'use strict';

const SITE = (() => {
  let canvas, ctx, W, H, dpr;
  // per-stratum sediment band data, deterministic per level
  let bands = [];
  let surfaceY = 0;

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
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* deterministic pseudo-random per (stratum, band, x-cell) */
  function cellRand(stratum, i, k) {
    let h = (stratum * 374761393 + i * 668265263 + k * 2246822519) >>> 0;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    h = ((h ^ (h >>> 16)) >>> 0);
    return h / 4294967296;
  }

  /* palette darkens with depth */
  function bandColor(stratum, t) {
    const stops = [
      ['#2b2113', '#241a0e'], // 1
      ['#241a0e', '#1e150a'], // 2
      ['#1e150a', '#181006'], // 3
      ['#181006', '#120c04'], // 4
      ['#120c04', '#0d0903'], // 5+
    ];
    const pair = stops[Math.min(stratum - 1, stops.length - 1)];
    const mix = (a, b, m) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const r = (pa >> 16) + (((pb >> 16) - (pa >> 16)) * m) | 0;
      const g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * m) | 0;
      const bl = (pa & 255) + (((pb & 255) - (pa & 255)) * m) | 0;
      return `rgb(${r},${g},${bl})`;
    };
    return mix(pair[0], pair[1], t);
  }

  /* rebuild band cache on stratum change */
  function rebuild(stratum) {
    bands = [];
    const n = Math.max(6, Math.min(stratum + 2, 12));
    for (let i = 0; i < n; i++) {
      const depth = i / n;
      bands.push({
        y: depth,
        hueShift: cellRand(stratum, i, 1),
        grain: 0.5 + cellRand(stratum, i, 2) * 0.8,
        specks: Math.floor(4 + cellRand(stratum, i, 3) * 14),
      });
    }
    surfaceY = 0.16; // sky/edge zone at top
  }

  /* dig holes: {x, y, r} in relative coords */
  let holes = [];
  function addHole(xRel, yRel) {
    holes.push({ x: xRel, y: yRel, r: 0.02 + Math.random() * 0.015, born: performance.now() });
    if (holes.length > 26) holes.shift();
  }

  /* artifact glints: persistent markers for museum finds at their depth */
  let glints = [];
  function addGlint(stratum, rarity) {
    glints.push({
      x: 0.12 + Math.random() * 0.76,
      y: 0.22 + Math.random() * 0.72,
      r: Math.max(2.5, rarity),
      tw: Math.random() * Math.PI * 2,
      born: performance.now(),
    });
    if (glints.length > 30) glints.shift();
  }

  function render(state, now) {
    if (!ctx) return;
    const stratum = state.stats.strata;

    ctx.clearRect(0, 0, W, H);

    // --- sky / surface zone ---
    const sky = ctx.createLinearGradient(0, 0, 0, H * surfaceY);
    sky.addColorStop(0, '#0d0a05');
    sky.addColorStop(1, '#171008');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * surfaceY);

    // faint sun disc
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#d9a441';
    ctx.beginPath();
    ctx.arc(W * 0.78, H * surfaceY * 0.42, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- sediment bands ---
    const soilTop = H * surfaceY;
    const soilH = H - soilTop;
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const y0 = soilTop + b.y * soilH;
      const y1 = soilTop + (i === bands.length - 1 ? 1 : bands[i + 1].y) * soilH;
      ctx.fillStyle = bandColor(stratum, b.hueShift);
      ctx.fillRect(0, y0, W, y1 - y0 + 1);

      // sediment grain: sparse darker dashes, deterministic
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let s = 0; s < b.specks; s++) {
        const sx = cellRand(stratum, i, 10 + s) * W;
        const sy = y0 + cellRand(stratum, i, 40 + s) * (y1 - y0);
        const sl = 3 + cellRand(stratum, i, 70 + s) * 9 * b.grain;
        ctx.fillRect(sx, sy, sl, 1.4);
      }
      // occasional mineral fleck
      ctx.fillStyle = 'rgba(217,164,65,0.16)';
      for (let s = 0; s < 3; s++) {
        if (cellRand(stratum, i, 100 + s) > 0.5) continue;
        const sx = cellRand(stratum, i, 130 + s) * W;
        const sy = y0 + cellRand(stratum, i, 160 + s) * (y1 - y0);
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    // stratum boundary lines with labels
    ctx.strokeStyle = 'rgba(217,164,65,0.22)';
    ctx.lineWidth = 1;
    ctx.font = '9px Georgia, serif';
    ctx.fillStyle = 'rgba(154,138,112,0.7)';
    for (let i = 1; i <= Math.min(stratum, 10); i++) {
      const y = soilTop + (i / (Math.min(stratum, 10) + 1)) * soilH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText('— stratum ' + i, 8, y - 4);
    }

    // --- dig holes ---
    for (const h of holes) {
      const age = (now - h.born) / 1000;
      const settle = Math.max(0.05, Math.min(1, age / 0.4));
      const r = Math.max(0.5, h.r * W * settle);
      ctx.fillStyle = 'rgba(5,3,1,0.55)';
      ctx.beginPath();
      ctx.ellipse(h.x * W, h.y * H, r, Math.max(0.3, r * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- artifact glints (twinkle) ---
    for (const g of glints) {
      const tw = 0.5 + 0.5 * Math.sin(now / 300 + g.tw);
      ctx.globalAlpha = 0.35 + 0.45 * tw;
      ctx.fillStyle = g.r >= 5 ? '#fff3d6' : (g.r >= 4 ? '#f2c66d' : '#d9a441');
      ctx.shadowBlur = 6 + tw * 6;
      ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(g.x * W, g.y * H, 1.6 + g.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // --- living civilization signal at the surface ---
    const living = state.civs.filter(c => c && c.alive);
    if (living.length) {
      const civ = living[0];
      // fire glow at surface, intensity = stability
      const intensity = 0.25 + (civ.stability / 100) * 0.5;
      const pulse = 0.75 + 0.25 * Math.sin(now / 900);
      const grd = ctx.createRadialGradient(
        W * 0.5, soilTop + 4, 2,
        W * 0.5, soilTop + 4, 60 * pulse
      );
      grd.addColorStop(0, `rgba(242,198,109,${intensity * pulse})`);
      grd.addColorStop(1, 'rgba(242,198,109,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, soilTop + 70);

      // tiny silhouette: huts rising with population (log scale)
      const huts = Math.min(9, Math.max(1, Math.round(Math.log2(Math.max(2, civ.population)))));
      for (let i = 0; i < huts; i++) {
        const hx = W * (0.3 + (i / Math.max(1, huts - 1)) * 0.4);
        const hh = 5 + (civ.wealth / 999) * 9;
        ctx.fillStyle = 'rgba(232,220,197,0.75)';
        ctx.fillRect(hx - 3, soilTop - hh, 6, hh);
        ctx.fillStyle = 'rgba(217,164,65,0.9)';
        ctx.beginPath();
        ctx.moveTo(hx - 4, soilTop - hh);
        ctx.lineTo(hx, soilTop - hh - 4);
        ctx.lineTo(hx + 4, soilTop - hh);
        ctx.fill();
      }

      // name label
      ctx.font = 'italic 10px Georgia, serif';
      ctx.fillStyle = 'rgba(232,220,197,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(civ.name + ' — year ' + Math.floor(civ.age), W / 2, soilTop + 16);
      ctx.textAlign = 'left';
    }

    // --- current dig depth indicator: pickaxe line ---
    const progress = (state.digProgress || 0) / Math.max(1, (120 * Math.pow(1.35, stratum - 1)));
    const py = soilTop + Math.min(0.95, progress) * soilH * 0.9;
    ctx.strokeStyle = 'rgba(242,198,109,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(W * 0.12, py);
    ctx.lineTo(W * 0.88, py);
    ctx.stroke();
    ctx.setLineDash([]);
    // pick head marker
    ctx.fillStyle = '#f2c66d';
    ctx.save();
    ctx.translate(W * 0.88, py);
    ctx.rotate(-0.6 + Math.sin(now / 500) * 0.12);
    ctx.fillRect(-1, -9, 2, 9);
    ctx.beginPath();
    ctx.arc(0, -9, 3.2, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.restore();
  }

  return {
    init, rebuild, render, addHole, addGlint, resize,
    get W() { return W; }, get H() { return H; },
    get surfaceY() { return surfaceY; },
  };
})();

window.SITE = SITE;
