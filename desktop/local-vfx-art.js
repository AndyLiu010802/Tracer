(function (scope, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.TracerLocalVfxArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Original, local-only vector artwork. No game assets, network, audio, input
  // hooks, windows, timers or animation loops are created by this renderer.
  const DURATIONS = Object.freeze({ haunt: 4400, leer: 3300 });
  const TAU = Math.PI * 2;
  const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => { const n = clamp(t, 0, 1); return n * n * (3 - 2 * n); };
  const range = (t, a, b) => smooth((t - a) / (b - a));
  const point = (v, fallback) => ({ x: finite(v && v.x, fallback.x), y: finite(v && v.y, fallback.y) });

  function normalizeConfig(config = {}, viewport = { width: 960, height: 540 }) {
    config = config && typeof config === 'object' ? config : {};
    const width = clamp(finite(viewport.width, 960), 1, 32768);
    const height = clamp(finite(viewport.height, 540), 1, 32768);
    return {
      effect: config.effect === 'leer' ? 'leer' : 'haunt',
      start: point(config.start, { x: width * 0.28, y: height * 0.72 }),
      target: point(config.target, { x: width * 0.57, y: height * 0.37 }),
      strength: clamp(finite(config.strength, 0.35), 0, 0.6),
      atmosphere: config.atmosphere !== false,
      motion: config.motion === 'reduced' ? 'reduced' : 'normal',
      size: clamp(finite(config.size, 112), 40, 200),
      seed: Number.isSafeInteger(config.seed) ? config.seed >>> 0 : 73129,
      width, height
    };
  }

  function sampleNormalized(elapsedMs, config) {
    const duration = DURATIONS[config.effect];
    const elapsed = clamp(finite(elapsedMs, 0), 0, duration);
    const haunt = config.effect === 'haunt';
    const boundaries = haunt ? [250, 850, 1150, 3600] : [200, 600, 900, 2700];
    const [gatherEnd, flightEnd, revealEnd, fadeStart] = boundaries;
    const finished = elapsed >= duration;
    const phase = finished ? 'finished' : elapsed < gatherEnd ? 'gather' : elapsed < flightEnd ? 'flight' : elapsed < revealEnd ? 'reveal' : elapsed < fadeStart ? 'hover' : 'dissolve';
    const flight = range(elapsed, gatherEnd, flightEnd);
    const reveal = range(elapsed, flightEnd, revealEnd);
    const dissolve = range(elapsed, fadeStart, duration);
    const motion = config.motion === 'reduced' ? 0.18 : 1;
    const hoverTime = Math.max(0, elapsed - flightEnd) / 1000;
    const bob = Math.sin(hoverTime * 2.1) * config.size * 0.035 * motion * reveal * (1 - dissolve);
    const center = {
      x: mix(config.start.x, config.target.x, flight),
      y: mix(config.start.y, config.target.y, flight) - Math.sin(Math.PI * flight) * config.size * 0.9 + bob
    };
    const opacity = range(elapsed, 0, gatherEnd * 0.7) * (1 - dissolve);
    const objectScale = mix(0.32, 1, reveal) * mix(0.85, 1, range(elapsed, 0, gatherEnd));
    const atmosphere = config.atmosphere ? config.strength * range(elapsed, gatherEnd, revealEnd + 250) * (1 - dissolve) * (haunt ? 1 : 0.32) : 0;
    const eye = reveal * (1 - range(elapsed, fadeStart, fadeStart + (duration - fadeStart) * 0.45));
    const width = config.size * (haunt ? 1.64 : 1.85);
    const height = config.size * (haunt ? 2.3 : 1.48);
    return {
      effect: config.effect, elapsed, duration, phase, finished, center,
      flight, reveal, dissolve, opacity, objectScale, eye, atmosphere,
      motion, size: config.size,
      // Approximate visual extent for diagnostics; not an input/hit rectangle.
      bounds: { x: center.x - width / 2, y: center.y - config.size * 0.73, width, height }
    };
  }

  function sample(elapsedMs, config, viewport) {
    return sampleNormalized(elapsedMs, normalizeConfig(config, viewport));
  }

  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let n = Math.imul(state ^ state >>> 15, state | 1);
      n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeParticles(seed, count) {
    const next = random(seed);
    return Array.from({ length: count }, () => ({
      angle: next() * TAU, radius: 0.14 + next() * 0.8,
      speed: 0.4 + next() * 1.25, offset: next() * TAU,
      size: 0.018 + next() * 0.055, stretch: 0.4 + next() * 1.4
    }));
  }

  function viewportOf(canvas) {
    const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
    return {
      width: finite(rect && rect.width, 0) || finite(canvas.clientWidth, 0) || finite(canvas.width, 960),
      height: finite(rect && rect.height, 0) || finite(canvas.clientHeight, 0) || finite(canvas.height, 540)
    };
  }

  function clear(canvas, ctx) {
    ctx.save();
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), 0, 0, TAU);
    ctx.fillStyle = fill; ctx.fill();
  }

  function atmosphere(ctx, frame, config, particles) {
    if (frame.atmosphere <= 0) return;
    const w = config.width, h = config.height;
    const bandX = w * 0.16, bandY = h * 0.16;
    const color = frame.effect === 'haunt' ? [3, 9, 19] : [29, 4, 35];
    const opacity = frame.atmosphere * 0.78;
    const stops = gradient => {
      gradient.addColorStop(0, `rgba(${color.join(',')},${opacity})`);
      gradient.addColorStop(0.28, `rgba(${color.join(',')},${opacity * 0.78})`);
      gradient.addColorStop(0.65, `rgba(${color.join(',')},${opacity * 0.33})`);
      gradient.addColorStop(1, `rgba(${color.join(',')},0)`);
      return gradient;
    };
    ctx.save();
    ctx.fillStyle = stops(ctx.createLinearGradient(0, 0, 0, bandY)); ctx.fillRect(0, 0, w, bandY);
    ctx.fillStyle = stops(ctx.createLinearGradient(0, h, 0, h - bandY)); ctx.fillRect(0, h - bandY, w, bandY);
    ctx.fillStyle = stops(ctx.createLinearGradient(0, 0, bandX, 0)); ctx.fillRect(0, 0, bandX, h);
    ctx.fillStyle = stops(ctx.createLinearGradient(w, 0, w - bandX, 0)); ctx.fillRect(w - bandX, 0, bandX, h);
    const count = config.motion === 'reduced' ? 6 : 15;
    const time = frame.elapsed / 1000;
    for (let side = 0; side < 4; side++) {
      ctx.save();
      // The rotated edge coordinate system keeps every wisp inside its 16% band.
      if (side === 1) { ctx.translate(w, h); ctx.rotate(Math.PI); }
      if (side === 2) { ctx.translate(0, h); ctx.rotate(-Math.PI / 2); }
      if (side === 3) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); }
      const length = side < 2 ? w : h;
      const depth = side < 2 ? bandY : bandX;
      for (let i = 0; i < count; i++) {
        const p = particles[(i + side * 17) % particles.length];
        const drift = Math.sin(time * 0.28 * frame.motion + p.offset) * length * 0.015;
        const x = (i + 0.1 + p.offset / TAU * 0.8) / count * length + drift;
        const breath = 0.5 + 0.5 * Math.sin(time * 0.64 * frame.motion + p.offset);
        const y = depth * (0.18 + 0.44 * p.radius + breath * 0.11);
        // Soft overlapping elliptical plumes avoid a repeating scalloped frame.
        ctx.save(); ctx.translate(x, y * 0.22);
        ctx.scale(length * (0.035 + p.radius * 0.06), depth * (0.33 + p.radius * 0.35));
        const plume = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        const plumeColor = frame.effect === 'haunt' ? '4,11,24' : '41,8,49';
        const plumeAlpha = frame.atmosphere * (0.13 + 0.14 * breath);
        plume.addColorStop(0, `rgba(${plumeColor},${plumeAlpha})`);
        plume.addColorStop(0.5, `rgba(${plumeColor},${plumeAlpha * 0.54})`);
        plume.addColorStop(1, `rgba(${plumeColor},0)`);
        ellipse(ctx, 0, 0, 1, 1, plume); ctx.restore();
        ctx.beginPath(); ctx.moveTo(x - length * 0.04, depth * 0.03);
        ctx.bezierCurveTo(x - length * 0.09, y * 0.6, x + length * 0.055, y * 0.95, x + length * 0.07, y * 0.35);
        ctx.strokeStyle = frame.effect === 'haunt' ? `rgba(9,24,41,${frame.atmosphere * 0.14})` : `rgba(49,9,57,${frame.atmosphere * 0.10})`;
        ctx.lineWidth = depth * (0.025 + p.size * 0.38); ctx.stroke();
        if (frame.effect === 'haunt') {
          ctx.beginPath(); ctx.moveTo(x - length * 0.04, depth * 0.02);
          ctx.bezierCurveTo(x - length * 0.07, y * 0.5, x + length * 0.015, y * 0.65, x + length * 0.025, y * 0.42);
          ctx.strokeStyle = `rgba(36,83,108,${frame.atmosphere * 0.14})`;
          ctx.lineWidth = 1.3; ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function gatherAndTrail(ctx, frame, config, particles) {
    const t = frame.elapsed / 1000;
    ctx.save(); ctx.translate(frame.center.x, frame.center.y); ctx.scale(config.size, config.size);
    const fade = 1 - frame.reveal;
    const count = config.motion === 'reduced' ? 12 : 32;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const angle = p.angle + t * (0.45 + p.speed) * frame.motion;
      const pull = frame.phase === 'gather' ? 1 - range(frame.elapsed, 0, 250) : 0.14;
      const r = p.radius * (0.15 + pull * 0.65);
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x * 0.48 - 0.1, y * 0.3 + 0.1, 0, 0);
      ctx.strokeStyle = frame.effect === 'haunt' ? `rgba(17,27,49,${frame.opacity * fade * 0.62})` : `rgba(94,15,90,${frame.opacity * fade * 0.64})`;
      ctx.lineWidth = 0.017 + p.size * 0.32; ctx.stroke();
    }
    ctx.restore();
    if (frame.phase !== 'flight') return;
    // The flight tail is a moving cubic ribbon, rather than a translated bitmap.
    const progress = frame.flight;
    const dx = frame.center.x - config.start.x, dy = frame.center.y - config.start.y;
    for (let i = 0; i < 5; i++) {
      const weight = 1 - i / 6;
      ctx.beginPath(); ctx.moveTo(frame.center.x, frame.center.y);
      ctx.bezierCurveTo(frame.center.x - dx * 0.15, frame.center.y - dy * 0.12 + Math.sin(t * 7 + i) * config.size * 0.04,
        config.start.x + dx * (0.35 + i * 0.04), config.start.y + dy * 0.25 - config.size * progress * 0.3,
        config.start.x + dx * 0.1, config.start.y);
      ctx.strokeStyle = frame.effect === 'haunt' ? `rgba(9,18,33,${0.17 * weight * frame.opacity})` : `rgba(100,14,95,${0.15 * weight * frame.opacity})`;
      ctx.lineWidth = config.size * 0.06 * weight; ctx.stroke();
    }
  }

  function haunt(ctx, frame, config, particles) {
    const time = frame.elapsed / 1000;
    const melt = frame.dissolve;
    ctx.save(); ctx.translate(frame.center.x, frame.center.y); ctx.scale(config.size, config.size);
    ctx.globalAlpha = frame.opacity;
    const glow = ctx.createRadialGradient(0, -0.015, 0.01, 0, -0.015, 0.79);
    glow.addColorStop(0, `rgba(100,22,91,${0.28 * frame.eye})`);
    glow.addColorStop(0.44, `rgba(20,28,55,${0.2 * frame.reveal})`);
    glow.addColorStop(1, 'rgba(8,13,29,0)');
    ellipse(ctx, 0, 0, 0.89, 0.82, glow);

    const extension = frame.reveal * (1 - melt * 0.45);
    // Substantial curled tendrils attach underneath the silhouette, never posing
    // as a blind/near-sight game mechanic. Their waves are independently phased.
    for (let i = 0; i < 7; i++) {
      const p = particles[i + 24];
      const x = (i - 3) * 0.12;
      const wave = Math.sin(time * (0.8 + p.speed * 0.25) * frame.motion + p.offset) * 0.18;
      const length = (0.7 + p.radius * 0.7) * extension;
      ctx.beginPath(); ctx.moveTo(x - 0.08, 0.1);
      ctx.bezierCurveTo(x - 0.2 + wave, 0.38 * extension, x + wave * 1.4, length * 0.73, x + wave * 1.4 - 0.1, length + 0.17);
      ctx.bezierCurveTo(x + wave + 0.07, length * 0.62, x + 0.15, length * 0.4, x + 0.08, 0.12);
      ctx.closePath(); ctx.fillStyle = i % 2 ? '#091220' : '#111a2a'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, 0.18);
      ctx.bezierCurveTo(x - 0.02, 0.5 * extension, x + wave, length * 0.75, x + wave * 1.1 - 0.08, length + 0.03);
      ctx.strokeStyle = 'rgba(48,60,85,0.34)'; ctx.lineWidth = 0.017; ctx.stroke();
    }

    const spread = frame.reveal;
    ctx.save(); ctx.scale(frame.objectScale, frame.objectScale);
    const body = ctx.createLinearGradient(-0.5, -0.55, 0.45, 0.42);
    body.addColorStop(0, '#233247'); body.addColorStop(0.38, '#101a2c'); body.addColorStop(1, '#030812');
    ctx.beginPath();
    ctx.moveTo(-0.48, -0.03);
    ctx.lineTo(-0.62 - spread * 0.13, -0.31 - spread * 0.3);
    ctx.lineTo(-0.37, -0.43); ctx.lineTo(-0.24, -0.28);
    ctx.quadraticCurveTo(0, -0.4, 0.23, -0.29);
    ctx.lineTo(0.43, -0.49); ctx.lineTo(0.66 + spread * 0.12, -0.52 - spread * 0.14);
    ctx.lineTo(0.52, -0.02); ctx.quadraticCurveTo(0.41, 0.28, 0.1, 0.38);
    ctx.lineTo(-0.14, 0.31); ctx.quadraticCurveTo(-0.44, 0.26, -0.48, -0.03);
    ctx.closePath(); ctx.fillStyle = body; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.57, -0.42); ctx.lineTo(-0.39, -0.36); ctx.lineTo(-0.25, -0.2);
    ctx.moveTo(0.28, -0.19); ctx.lineTo(0.46, -0.34); ctx.lineTo(0.67, -0.48);
    ctx.strokeStyle = '#354355'; ctx.lineWidth = 0.025; ctx.stroke();

    const eyeOpen = 0.015 + frame.eye * 0.14;
    ctx.beginPath(); ctx.moveTo(-0.39, -0.026);
    ctx.quadraticCurveTo(-0.03, -0.026 - eyeOpen * 1.45, 0.38, -0.016);
    ctx.quadraticCurveTo(0.03, -0.014 + eyeOpen * 1.45, -0.39, -0.026);
    ctx.closePath(); ctx.fillStyle = '#04020b'; ctx.fill();
    ctx.strokeStyle = `rgba(183,44,159,${0.24 + frame.eye * 0.56})`; ctx.lineWidth = 0.032; ctx.stroke();
    if (frame.eye > 0.005) {
      const look = Math.sin(time * 0.76) * 0.045 * frame.motion;
      const iris = ctx.createRadialGradient(look, -0.02, 0.015, look, -0.02, 0.14);
      iris.addColorStop(0, '#ffe0f5'); iris.addColorStop(0.2, '#ed70cd'); iris.addColorStop(0.56, '#b133bd'); iris.addColorStop(1, '#4a0b64');
      ellipse(ctx, look, -0.02, 0.105, eyeOpen * 0.88, iris);
      ellipse(ctx, look, -0.02, 0.025, eyeOpen * 0.84, '#120518');
      ellipse(ctx, look - 0.033, -0.049, 0.012, Math.min(0.012, eyeOpen * 0.3), '#f4b5dd');
    }
    ctx.beginPath(); ctx.moveTo(-0.28, 0.19); ctx.quadraticCurveTo(-0.03, 0.3, 0.29, 0.15);
    ctx.strokeStyle = 'rgba(64,74,92,0.3)'; ctx.lineWidth = 0.023; ctx.stroke();
    ctx.restore(); ctx.restore();
    if (frame.phase === 'dissolve') dissolve(ctx, frame, config, particles);
  }

  function leer(ctx, frame, config, particles) {
    const time = frame.elapsed / 1000;
    ctx.save(); ctx.translate(frame.center.x, frame.center.y); ctx.scale(config.size, config.size);
    ctx.globalAlpha = frame.opacity;
    const glow = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 0.83);
    glow.addColorStop(0, `rgba(228,37,174,${0.28 * frame.eye})`); glow.addColorStop(0.46, 'rgba(129,18,138,0.16)'); glow.addColorStop(1, 'rgba(58,7,76,0)');
    ellipse(ctx, 0, 0, 0.84, 0.7, glow);
    for (let i = 0; i < 5; i++) {
      const p = particles[i + 9];
      const angle = p.angle + time * 0.27 * frame.motion;
      const endX = Math.cos(angle) * (0.67 + p.radius * 0.15);
      const endY = Math.sin(angle) * (0.25 + frame.reveal * 0.42);
      ctx.beginPath(); ctx.moveTo(-0.1, 0.12);
      ctx.bezierCurveTo(endX * 0.4 - 0.2, endY + 0.28, endX * 1.12, endY * 1.3, endX, endY);
      ctx.bezierCurveTo(endX * 0.63, endY * 0.22, 0.21, 0.2, 0.1, -0.13);
      ctx.closePath(); ctx.fillStyle = i % 2 ? '#23112f' : '#100918'; ctx.fill();
      ctx.strokeStyle = 'rgba(121,45,118,0.38)'; ctx.lineWidth = 0.014; ctx.stroke();
    }
    ctx.save(); ctx.scale(frame.objectScale, frame.objectScale);
    const orb = ctx.createRadialGradient(-0.12, -0.16, 0.025, 0, 0, 0.42);
    orb.addColorStop(0, '#dc61bf'); orb.addColorStop(0.3, '#732276'); orb.addColorStop(0.7, '#371044'); orb.addColorStop(1, '#150d27');
    ellipse(ctx, 0, 0, 0.42, 0.33, orb);
    const opening = 0.015 + frame.eye * 0.21;
    ctx.beginPath(); ctx.moveTo(-0.46, 0);
    ctx.quadraticCurveTo(0, -opening * 1.65, 0.46, 0);
    ctx.quadraticCurveTo(0, opening * 1.48, -0.46, 0);
    ctx.closePath(); ctx.fillStyle = '#20042d'; ctx.fill();
    ctx.strokeStyle = '#a747a3'; ctx.lineWidth = 0.044; ctx.stroke();
    if (frame.eye > 0.005) {
      const iris = ctx.createRadialGradient(0, -0.015, 0.007, 0, 0, 0.19);
      iris.addColorStop(0, '#ffe0f7'); iris.addColorStop(0.25, '#ef7ad9'); iris.addColorStop(0.65, '#bd28be'); iris.addColorStop(1, '#53105b');
      ellipse(ctx, 0, 0, 0.17, opening * 0.91, iris);
      ellipse(ctx, 0, 0, 0.032, opening * 0.81, '#100718');
      ellipse(ctx, -0.047, -0.077, 0.022, Math.min(0.022, opening * 0.28), '#ffd8f5');
    }
    ctx.restore(); ctx.restore();
    if (frame.phase === 'dissolve') dissolve(ctx, frame, config, particles);
  }

  function dissolve(ctx, frame, config, particles) {
    const count = config.motion === 'reduced' ? 16 : 64;
    const spread = frame.dissolve;
    ctx.save(); ctx.translate(frame.center.x, frame.center.y); ctx.scale(config.size, config.size);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const distance = p.radius * (0.24 + spread * 1.15);
      const x = Math.cos(p.angle) * distance + Math.sin(spread * 3 + p.offset) * 0.06 * frame.motion;
      const y = Math.sin(p.angle) * distance * 0.68 - spread * p.speed * 0.32;
      const alpha = Math.sin(Math.PI * spread) * (1 - spread) * (frame.effect === 'haunt' ? 0.74 : 0.54);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = frame.effect === 'haunt' ? i % 7 ? '#0b1422' : '#302438' : i % 3 ? '#6f236f' : '#d343b1';
      ctx.beginPath(); ctx.moveTo(x - p.size, y); ctx.lineTo(x, y - p.size * p.stretch);
      ctx.lineTo(x + p.size * 0.8, y + p.size * 0.42); ctx.lineTo(x - p.size * 0.3, y + p.size * p.stretch); ctx.closePath(); ctx.fill();
      if (i % 3 === 0) {
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - 0.15, y - 0.12, x + 0.12 * Math.sin(p.offset), y - spread * 0.36);
        ctx.lineWidth = p.size * 0.9; ctx.strokeStyle = frame.effect === 'haunt' ? '#101a2c' : '#36123e'; ctx.stroke();
      }
    }
    ctx.restore();
  }

  function create(canvas, config = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('local-vfx-canvas-required');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('local-vfx-canvas-unavailable');
    const initial = normalizeConfig(config, viewportOf(canvas));
    // A running animation owns its settings. Mutating a UI selection or its
    // nested points cannot change this player's duration/effect mid-flight.
    const sourceConfig = {
      effect: initial.effect, strength: initial.strength, atmosphere: initial.atmosphere,
      motion: initial.motion, size: initial.size, seed: initial.seed
    };
    if (config && config.start) sourceConfig.start = { ...initial.start };
    if (config && config.target) sourceConfig.target = { ...initial.target };
    const particles = makeParticles(initial.seed, 88);
    let disposed = false;
    return Object.freeze({
      duration: DURATIONS[initial.effect],
      render(elapsedMs) {
        clear(canvas, ctx);
        const normalized = normalizeConfig(sourceConfig, viewportOf(canvas));
        const frame = sampleNormalized(elapsedMs, normalized);
        if (disposed) return { ...frame, phase: 'disposed', finished: true };
        if (frame.finished) return frame;
        ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        atmosphere(ctx, frame, normalized, particles);
        gatherAndTrail(ctx, frame, normalized, particles);
        if (frame.effect === 'haunt') haunt(ctx, frame, normalized, particles);
        else leer(ctx, frame, normalized, particles);
        ctx.restore();
        return frame;
      },
      dispose() { disposed = true; clear(canvas, ctx); }
    });
  }

  return Object.freeze({ create, sample, normalizeConfig, durations: DURATIONS });
});
