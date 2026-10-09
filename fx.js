/* ============================================================
   STRATA — FX engine: particles, shake, procedural audio, haptics.
   The juice layer. Zero assets, zero dependencies, Web Audio only.
   Loads after engine.js, before app.js.
   ============================================================ */
'use strict';

const FX = (() => {
  /* ---------- Device budget ---------- */
  const isSmall = () => Math.min(window.innerWidth, window.innerHeight) < 768;
  const BUDGET = () => ({
    maxParticles: isSmall() ? 140 : 320,
    burst: isSmall() ? 26 : 60,
    dust: isSmall() ? 18 : 36,
  });

  /* ---------- Particles ---------- */
  let particles = [];
  let floats = []; // floating text numbers

  function spawnBurst(x, y, opts = {}) {
    const cfg = Object.assign({
      count: BUDGET().burst, colors: ['#d9a441', '#f2c66d', '#fff3d6'],
      speed: 3.2, spread: Math.PI * 2, dir: -Math.PI / 2, size: [2, 5],
      gravity: 0.14, life: [40, 90], glow: false,
    }, opts);
    const capped = Math.min(cfg.count, BUDGET().maxParticles - particles.length);
    for (let i = 0; i < capped; i++) {
      const ang = cfg.dir + (Math.random() - 0.5) * cfg.spread;
      const spd = cfg.speed * (0.4 + Math.random() * 0.9);
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        g: cfg.gravity,
        size: cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]),
        life: cfg.life[0] + Math.random() * (cfg.life[1] - cfg.life[0]),
        age: 0,
        color: cfg.colors[(Math.random() * cfg.colors.length) | 0],
        glow: cfg.glow,
      });
    }
  }

  function spawnDust(x, y) {
    const cfg = BUDGET();
    if (particles.length > cfg.maxParticles - 8) return;
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.15 - Math.random() * 0.3,
      g: 0,
      size: 1 + Math.random() * 1.6,
      life: 150 + Math.random() * 150,
      age: 0,
      color: 'rgba(154,138,112,0.5)',
      glow: false,
    });
  }

  function spawnFloat(x, y, text, color) {
    floats.push({ x, y, text, color: color || '#f2c66d', age: 0, life: 70, vy: -0.9 });
    if (floats.length > 12) floats.shift();
  }

  /* ---------- Screen shake ---------- */
  let shake = 0; // decaying magnitude in px
  function kick(mag) { shake = Math.max(shake, mag); }

  /* ---------- Hit-stop ---------- */
  let freezeUntil = 0;
  function hitStop(ms) { freezeUntil = performance.now() + ms; }
  const frozen = () => performance.now() < freezeUntil;

  /* ---------- Flash ---------- */
  let flashAlpha = 0;
  function flash(a) { flashAlpha = Math.max(flashAlpha, a); }

  /* ---------- Procedural audio (Web Audio, no assets) ---------- */
  let AC = null;
  let master = null;
  let muted = false;

  function ensureAudio() {
    if (AC || muted) return AC;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.32;
      master.connect(AC.destination);
    } catch (e) { AC = null; }
    return AC;
  }

  function resumeAudio() {
    if (AC && AC.state === 'suspended') AC.resume();
  }

  function env(node, t0, a, peak, dur) {
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    g.connect(master);
    return g;
  }

  function tone(freq, opts = {}) {
    if (!ensureAudio() || muted) return;
    resumeAudio();
    const t0 = AC.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.15;
    const osc = AC.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    env(osc, t0, opts.attack || 0.005, opts.vol || 0.5, dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(opts = {}) {
    if (!ensureAudio() || muted) return;
    resumeAudio();
    const t0 = AC.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.12;
    const len = Math.max(1, Math.floor(AC.sampleRate * dur));
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource();
    src.buffer = buf;
    const filter = AC.createBiquadFilter();
    filter.type = opts.filter || 'lowpass';
    filter.frequency.setValueAtTime(opts.cut || 800, t0);
    if (opts.cutTo) filter.frequency.exponentialRampToValueAtTime(opts.cutTo, t0 + dur);
    src.connect(filter);
    env(filter, t0, 0.002, opts.vol || 0.4, dur);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const SFX = {
    dig() {
      noise({ cut: 500, cutTo: 120, dur: 0.1, vol: 0.35 });
      tone(110, { slideTo: 55, type: 'triangle', dur: 0.09, vol: 0.4 });
    },
    shards() {
      tone(880, { type: 'triangle', dur: 0.06, vol: 0.3 });
      tone(1318, { type: 'triangle', dur: 0.09, vol: 0.25, delay: 0.05 });
    },
    artifact() {
      tone(523, { type: 'sine', dur: 0.14, vol: 0.35 });
      tone(784, { type: 'sine', dur: 0.14, vol: 0.35, delay: 0.09 });
      tone(1047, { type: 'sine', dur: 0.3, vol: 0.4, delay: 0.18 });
    },
    stratum() {
      noise({ cut: 300, cutTo: 60, dur: 0.5, vol: 0.5 });
      tone(70, { slideTo: 40, type: 'sine', dur: 0.45, vol: 0.55 });
    },
    death() {
      tone(220, { slideTo: 110, type: 'sine', dur: 0.5, vol: 0.3 });
      tone(165, { slideTo: 82, type: 'sine', dur: 0.6, vol: 0.25, delay: 0.12 });
    },
    rise() {
      tone(330, { type: 'sine', dur: 0.2, vol: 0.25 });
      tone(415, { type: 'sine', dur: 0.25, vol: 0.22, delay: 0.08 });
      tone(494, { type: 'sine', dur: 0.35, vol: 0.2, delay: 0.16 });
    },
    tick() { tone(1800, { type: 'square', dur: 0.02, vol: 0.08 }); },
    ui() { noise({ filter: 'highpass', cut: 2000, dur: 0.03, vol: 0.15 }); },
  };

  /* ---------- Haptics ---------- */
  function buzz(pattern) {
    try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch (e) {}
  }

  /* ---------- Render loop hook (called from app rAF) ---------- */
  function step(ctx, dt) {
    if (frozen()) dt *= 0.12; // hit-stop: world crawls

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      const fade = 1 - p.age / p.life;
      ctx.globalAlpha = fade;
      if (p.glow) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
      ctx.fill();
      if (p.glow) { ctx.shadowBlur = 0; }
    }
    ctx.globalAlpha = 1;

    // floats
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.age += dt;
      if (f.age >= f.life) { floats.splice(i, 1); continue; }
      f.y += f.vy * dt;
      const a = 1 - f.age / f.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 15px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // decay shake
    shake *= Math.pow(0.86, dt);
    if (shake < 0.2) shake = 0;

    // decay flash
    flashAlpha *= Math.pow(0.85, dt);
    if (flashAlpha < 0.01) flashAlpha = 0;
  }

  return {
    spawnBurst, spawnDust, spawnFloat,
    kick, hitStop, frozen, flash,
    get shake() { return shake; },
    get flashAlpha() { return flashAlpha; },
    SFX, buzz, ensureAudio, resumeAudio,
    set muted(v) { muted = v; }, get muted() { return muted; },
    step, BUDGET,
  };
})();

window.FX = FX;
