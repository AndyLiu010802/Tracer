'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const art = require('../desktop/local-vfx-art');

function recordingCanvas(width = 1920, height = 1080, dpr = 1) {
  const calls = [];
  const gradients = [];
  const stack = [];
  const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', transform: [dpr, 0, 0, dpr, 0, 0] };
  for (const method of ['clearRect', 'fillRect', 'translate', 'rotate', 'scale', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'ellipse']) {
    ctx[method] = (...args) => {
      assert.ok(args.every(Number.isFinite), `${method} received a nonfinite coordinate`);
      calls.push({ method, args, alpha: ctx.globalAlpha });
    };
  }
  for (const method of ['beginPath', 'closePath', 'fill', 'stroke']) {
    ctx[method] = () => {
      assert.ok(Number.isFinite(ctx.globalAlpha) && ctx.globalAlpha >= 0 && ctx.globalAlpha <= 1);
      calls.push({ method, alpha: ctx.globalAlpha });
    };
  }
  ctx.save = () => stack.push({ alpha: ctx.globalAlpha, composite: ctx.globalCompositeOperation, transform: ctx.transform.slice() });
  ctx.restore = () => {
    const saved = stack.pop(); assert.ok(saved, 'unbalanced restore');
    ctx.globalAlpha = saved.alpha; ctx.globalCompositeOperation = saved.composite; ctx.transform = saved.transform;
  };
  ctx.setTransform = (...args) => { ctx.transform = args; calls.push({ method: 'setTransform', args }); };
  for (const method of ['createLinearGradient', 'createRadialGradient']) {
    ctx[method] = (...args) => {
      assert.ok(args.every(Number.isFinite));
      const gradient = { method, args, stops: [], addColorStop(position, color) {
        assert.ok(position >= 0 && position <= 1); this.stops.push({ position, color });
      } };
      gradients.push(gradient); return gradient;
    };
  }
  return { canvas: { width: width * dpr, height: height * dpr, clientWidth: width, clientHeight: height,
    getBoundingClientRect: () => ({ width, height }), getContext: kind => kind === '2d' ? ctx : null }, ctx, calls, gradients, stack };
}

test('both effects expose complete finite enter/hold/exit sequences and finish without residual opacity', () => {
  for (const effect of ['haunt', 'leer']) {
    const phases = new Set();
    for (let ms = 0; ms <= art.durations[effect] + 16; ms += 16) {
      const frame = art.sample(ms, { effect }); phases.add(frame.phase);
      assert.ok([frame.center.x, frame.center.y, frame.opacity, frame.eye, frame.atmosphere].every(Number.isFinite));
      assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
      assert.ok(frame.eye >= 0 && frame.eye <= 1);
    }
    assert.deepEqual([...phases], ['gather', 'flight', 'reveal', 'hover', 'dissolve', 'finished']);
    const end = art.sample(art.durations[effect], { effect });
    assert.equal(end.finished, true); assert.equal(end.opacity, 0); assert.equal(end.eye, 0); assert.equal(end.atmosphere, 0);
  }
});

test('flight starts and ends at supplied positions without an instantaneous phase-boundary jump', () => {
  for (const effect of ['haunt', 'leer']) {
    const config = { effect, start: { x: 100, y: 400 }, target: { x: 650, y: 190 }, size: 120 };
    const boundaries = effect === 'haunt' ? [250, 850, 1150, 3600] : [200, 600, 900, 2700];
    assert.deepEqual(art.sample(boundaries[0], config).center, config.start);
    assert.deepEqual(art.sample(boundaries[1], config).center, config.target);
    for (const boundary of boundaries) {
      const before = art.sample(boundary - 0.01, config), after = art.sample(boundary + 0.01, config);
      assert.ok(Math.hypot(before.center.x - after.center.x, before.center.y - after.center.y) < 0.01);
      assert.ok(Math.abs(before.opacity - after.opacity) < 0.01);
      assert.ok(Math.abs(before.eye - after.eye) < 0.01);
    }
    assert.ok(art.sample((boundaries[0] + boundaries[1]) / 2, config).center.y < 295, 'flight should follow an arc');
  }
});

test('reduced motion keeps phase timing and destination but reduces only secondary motion', () => {
  for (const effect of ['haunt', 'leer']) {
    for (const ms of [0, 250, 700, 1500, 2600, 3000, 4400]) {
      const a = art.sample(ms, { effect }), b = art.sample(ms, { effect, motion: 'reduced' });
      assert.equal(a.duration, b.duration); assert.equal(a.phase, b.phase); assert.equal(a.finished, b.finished);
      assert.equal(a.center.x, b.center.x); assert.equal(a.opacity, b.opacity);
    }
    const normal = art.sample(1600, { effect, target: { x: 0, y: 0 } });
    const reduced = art.sample(1600, { effect, target: { x: 0, y: 0 }, motion: 'reduced' });
    assert.ok(Math.abs(reduced.center.y) <= Math.abs(normal.center.y));
  }
});

test('atmosphere is optional, safely bounded, and effect-specific rather than a generic blackout', () => {
  assert.equal(art.sample(2000, { atmosphere: false, strength: 0.6 }).atmosphere, 0);
  assert.equal(art.sample(2000, { strength: 0 }).atmosphere, 0);
  const haunt = art.sample(2000, { strength: 9 }), leer = art.sample(2000, { effect: 'leer', strength: 9 });
  assert.equal(haunt.atmosphere, 0.6); assert.ok(leer.atmosphere < haunt.atmosphere / 2);
  assert.equal(art.normalizeConfig({ strength: -1 }).strength, 0);
});

test('canvas drawing uses CSS coordinates while clearing the entire DPR backing buffer', () => {
  const a = recordingCanvas(960, 540, 2), player = art.create(a.canvas);
  const frame = player.render(1800);
  assert.equal(frame.center.x, 960 * 0.57);
  assert.deepEqual(a.calls.find(c => c.method === 'clearRect').args, [0, 0, 1920, 1080]);
  assert.deepEqual(a.ctx.transform, [2, 0, 0, 2, 0, 0]);
  assert.equal(a.stack.length, 0);
});

test('atmosphere paints only four edge bands and does not fill a screen-wide hit/background rectangle', () => {
  const a = recordingCanvas(960, 540); art.create(a.canvas, { strength: 0.6 }).render(1900);
  const bands = a.calls.filter(c => c.method === 'fillRect').map(c => c.args);
  assert.equal(bands.length, 4);
  for (const [x, y, w, h] of bands) {
    assert.ok(w <= 960 * 0.16 || h <= 540 * 0.16);
    assert.ok(x + w <= 960 && y + h <= 540);
  }
});

test('all phases of both effects draw finite paths and maintain balanced context state', () => {
  for (const effect of ['haunt', 'leer']) for (const motion of ['normal', 'reduced']) {
    const a = recordingCanvas(1366, 768, 1.25), player = art.create(a.canvas, { effect, motion, seed: 0 });
    for (let ms = 0; ms <= player.duration; ms += 37) {
      player.render(ms); assert.equal(a.stack.length, 0);
    }
    player.dispose(); assert.equal(a.stack.length, 0);
    assert.equal(a.ctx.globalAlpha, 1); assert.equal(a.ctx.globalCompositeOperation, 'source-over');
  }
});

test('dissolve finishes and dispose clears without drawing stale objects on a late callback', () => {
  const a = recordingCanvas(), player = art.create(a.canvas);
  player.render(1400); assert.ok(a.calls.some(c => c.method === 'fill'));
  a.calls.length = 0; const end = player.render(4400);
  assert.equal(end.finished, true); assert.deepEqual(a.calls.map(c => c.method), ['setTransform', 'clearRect']);
  player.dispose(); a.calls.length = 0;
  assert.equal(player.render(1400).phase, 'disposed');
  assert.deepEqual(a.calls.map(c => c.method), ['setTransform', 'clearRect']);
});

test('renderer produces repeatable path geometry for a fixed seed and elapsed time', () => {
  const a = recordingCanvas(), b = recordingCanvas();
  art.create(a.canvas, { seed: 231 }).render(3700); art.create(b.canvas, { seed: 231 }).render(3700);
  assert.deepEqual(a.calls, b.calls);
  const c = recordingCanvas(); art.create(c.canvas, { seed: 232 }).render(3700);
  assert.notDeepEqual(a.calls, c.calls);
});

test('a running player snapshots configuration so a new selection cannot alter its effect or start point', () => {
  const a = recordingCanvas();
  const config = { effect: 'haunt', start: { x: 125, y: 450 }, strength: 0.3 };
  const player = art.create(a.canvas, config);
  config.effect = 'leer'; config.start.x = 600; config.strength = 0.6;
  const frame = player.render(250);
  assert.equal(frame.effect, 'haunt'); assert.equal(frame.duration, 4400);
  assert.equal(frame.center.x, 125);
  assert.equal(player.duration, 4400);
});

test('runtime validation rejects unavailable canvases and normalizes invalid ordinary parameters', () => {
  assert.throws(() => art.create(null), /canvas-required/);
  assert.throws(() => art.create({ getContext: () => null }), /canvas-unavailable/);
  const config = art.normalizeConfig({ size: Infinity, strength: NaN, seed: 1.2, effect: 'not-an-effect', start: { x: NaN, y: undefined } });
  assert.equal(config.effect, 'haunt'); assert.equal(config.size, 112); assert.equal(config.strength, 0.35);
  assert.deepEqual(config.start, { x: 268.8, y: 388.8 });
  assert.equal(art.sample(-500).elapsed, 0); assert.equal(art.sample(NaN).elapsed, 0);
});
