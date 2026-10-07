(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerLocalVfxHauntAtmosphere = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Original desktop atmosphere. This is not Haunt's in-game vision mechanic.
  // No timers, event listeners, textures, network, or renderer-owned animation loop.
  const DURATION = 7000, GRID_W = 96, GRID_H = 54, TILE = 64;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  function ease(value) { const v = clamp(value, 0, 1); return v * v * (3 - 2 * v); }
  function normalize(packet) {
    packet = packet && typeof packet === 'object' ? packet : {};
    return {
      width: clamp(finite(packet.width, 1280), 1, 32768),
      height: clamp(finite(packet.height, 720), 1, 32768),
      strength: clamp(finite(packet.strength, 0.35), 0, 0.6),
      seed: (finite(packet.seed, 128) >>> 0),
      enabled: packet.atmosphere !== false,
      reduced: packet.motion === 'reduced' || packet.reducedMotion === true
    };
  }
  function sample(packet, elapsedMs) {
    const p = normalize(packet);
    const time = clamp(finite(elapsedMs, 0), 0, DURATION);
    const envelope = ease((time - 550) / 2000) * (1 - ease((time - 5850) / 1100));
    return Object.assign(p, { time, finished: time >= DURATION, envelope,
      maxOpacity: p.enabled && p.strength > 0 ? (0.17 + p.strength * 0.78) * envelope : 0,
      drift: p.reduced ? 0 : time / 1000 });
  }
  function noiseTile(seed) {
    let state = (seed ^ 0x8b748281) >>> 0;
    const tile = new Float32Array(TILE * TILE);
    for (let i = 0; i < tile.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      tile[i] = state / 4294967296;
    }
    return tile;
  }
  function noise(tile, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = ease(x - ix), fy = ease(y - iy);
    const x0 = ix & 63, x1 = (ix + 1) & 63, y0 = (iy & 63) * TILE, y1 = ((iy + 1) & 63) * TILE;
    const a = tile[y0 + x0] + (tile[y0 + x1] - tile[y0 + x0]) * fx;
    const b = tile[y1 + x0] + (tile[y1 + x1] - tile[y1 + x0]) * fx;
    return a + (b - a) * fy;
  }
  function create(options) {
    options = options || {};
    const makeCanvas = options.createCanvas || (() => {
      if (typeof document !== 'undefined') return document.createElement('canvas');
      if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(GRID_W, GRID_H);
      throw new Error('Haunt atmosphere requires a local canvas factory.');
    });
    // Separate depth layers retain different noise scales, drift and softness.
    // Their weights sum to one, preserving the public maximum opacity budget.
    const specs = [
      { weight: 0.50, scale: 4.7, dx: 0.075, dy: -0.043, softness: 0.010, kind: 'distant-mist' },
      { weight: 0.35, scale: 9.3, dx: -0.16, dy: 0.072, softness: 0.005, kind: 'rolling-ink' },
      { weight: 0.15, scale: 17.8, dx: 0.24, dy: -0.125, softness: 0.0025, kind: 'thin-wisps' }
    ];
    let layers = [];
    try {
      for (const spec of specs) {
        const canvas = makeCanvas();
        if (!canvas || typeof canvas.getContext !== 'function') throw new Error('canvas-unavailable');
        const layer = { spec, canvas, grid: null, pixels: null };
        layers.push(layer);
        canvas.width = GRID_W; canvas.height = GRID_H;
        layer.grid = canvas.getContext('2d');
        if (!layer.grid) throw new Error('context-unavailable');
        layer.pixels = layer.grid.createImageData(GRID_W, GRID_H);
        if (!layer.pixels || !ArrayBuffer.isView(layer.pixels.data) ||
            layer.pixels.data.BYTES_PER_ELEMENT !== 1 || layer.pixels.data.length !== GRID_W * GRID_H * 4) {
          throw new Error('pixel-buffer-unavailable');
        }
      }
    } catch (_) {
      // A failed construction releases only canvases created by this factory.
      for (const layer of layers) { try { layer.canvas.width = 1; layer.canvas.height = 1; } catch (_) {} }
      layers = [];
      throw new Error('haunt-atmosphere-canvas-unavailable');
    }
    let tile, activeSeed, disposed = false;
    function draw(ctx, packet, elapsedMs) {
      if (disposed) return false;
      const f = sample(packet, elapsedMs);
      if (!f.enabled || f.envelope <= 0 || f.finished || f.strength === 0) return false;
      if (!tile || activeSeed !== f.seed) { tile = noiseTile(f.seed); activeSeed = f.seed; }
      for (const layer of layers) {
      const data = layer.pixels.data, spec = layer.spec;
      for (let y = 0; y < GRID_H; y++) {
        const ny = (y + 0.5) / GRID_H;
        for (let x = 0; x < GRID_W; x++) {
          const nx = (x + 0.5) / GRID_W;
          const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
          const wx = nx * spec.scale, wy = ny * spec.scale * 0.72;
          const drift = f.drift;
          const warp = noise(tile, wx * 0.67 + drift * 0.075, wy * 0.8 - drift * 0.065);
          const coarse = noise(tile, wx + warp * 1.6 + drift * spec.dx, wy + drift * spec.dy);
          const detail = noise(tile, wx * 2.1 - drift * spec.dx * 0.45, wy * 2.1 + warp * 1.9);
          // Irregular ink plumes taper to zero before the central 60% of the view.
          const reach = spec.kind === 'distant-mist' ? 0.105 + ease(coarse) * 0.083 : 0.052 + ease(coarse) * 0.132;
          const falloff = ease((reach - edge) / reach);
          const smoke = spec.kind === 'thin-wisps' ? ease((detail - 0.28) / 0.55) * (0.4 + coarse * 0.6) : 0.14 + ease((coarse - 0.12) / 0.8) * 0.64 + detail * 0.22;
          const density = falloff * smoke;
          const index = (y * GRID_W + x) * 4;
          const lightMist = spec.kind === 'thin-wisps' ? 12 : 0;
          data[index] = Math.round(3 + detail * 5 + lightMist * 0.5);
          data[index + 1] = Math.round(7 + coarse * 10 + lightMist);
          data[index + 2] = Math.round(16 + coarse * 21 + detail * 8 + lightMist);
          data[index + 3] = Math.round(255 * f.maxOpacity * spec.weight * density);
        }
      }
      layer.grid.putImageData(layer.pixels, 0, 0);
      ctx.save();
      try {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = true;
        ctx.filter = 'blur(' + Math.max(1, Math.min(f.width, f.height) * spec.softness).toFixed(2) + 'px)';
        ctx.drawImage(layer.canvas, 0, 0, f.width, f.height);
      } finally { ctx.restore(); }
      }
      return true;
    }
    function destroy() {
      if (disposed) return;
      disposed = true;
      layers.forEach(layer => { layer.canvas.width = 1; layer.canvas.height = 1; layer.pixels = null; layer.grid = null; });
      layers = []; tile = null;
    }
    function getDiagnostics() { return { disposed, layers: layers.length,
      textureBytes: disposed ? 0 : GRID_W * GRID_H * 4 * specs.length,
      layerKinds: specs.map(spec => spec.kind), ownsAnimationLoop: false }; }
    return { draw, destroy, getDiagnostics };
  }
  return { normalize, sample, create, metadata: Object.freeze({
    version: 'haunt-atmosphere-v3-layered', durationMs: DURATION, originalArt: true,
    desktopAdaptation: true, maxStrength: 0.6, centralClearFraction: 0.6,
    grid: [GRID_W, GRID_H], layers: 3, ownsAnimationLoop: false
  }) };
});
