'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const body = require('../desktop/local-vfx-haunt-v2.js');
const schema = require('../desktop/local-vfx-haunt-layers.js');
const source = fs.readFileSync(path.join(__dirname, '../desktop/local-vfx-haunt-texture.js'), 'utf8');
// Public renderer tests use numeric geometry, without requiring local reference artwork.
const actualDescriptor = require('../desktop/local-vfx-player.js').descriptor;
const packet = Object.freeze({ width: 1280, height: 720, size: 150, target: Object.freeze({ x: 430, y: 600 }), strength: 0.55, seed: 73 });

function isolated() {
  const sandbox = { module: { exports: {} }, require(file) {
    if (file === './local-vfx-haunt-layers.js') return schema;
    if (file === './local-vfx-haunt-v2.js') return { sample: body.sample };
    throw new Error('unexpected require');
  } };
  for (const name of ['document', 'OffscreenCanvas', 'Image', 'fetch', 'XMLHttpRequest', 'WebSocket', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'addEventListener']) {
    Object.defineProperty(sandbox, name, { get() { throw new Error('ambient capability: ' + name); } });
  }
  vm.runInNewContext(source, sandbox, { filename: 'local-vfx-haunt-texture.js' });
  return sandbox.module.exports;
}
const texture = isolated();
function descriptor(bundleId = 'fade-v1') {
  const copy = structuredClone(actualDescriptor); copy.bundleId = bundleId;
  for (const layer of copy.layers) layer.src = 'skins/tracer/local-vfx/haunt-art/' + bundleId + '/' + path.posix.basename(layer.src);
  return copy;
}
function bitmap(src, width = 1254, height = 1254) {
  return { src, width, height, closes: 0, close() { this.closes++; assert.equal(this.closes, 1); } };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function context() {
  const calls = [], stack = [];
  const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', matrix: [1, 0, 0, 1, 0, 0],
    save() { stack.push({ alpha: this.globalAlpha, composite: this.globalCompositeOperation, filter: this.filter, matrix: [...this.matrix] }); },
    restore() { const state = stack.pop(); assert(state); this.globalAlpha = state.alpha; this.globalCompositeOperation = state.composite; this.filter = state.filter; this.matrix = state.matrix; },
    setTransform(...args) { assert(args.every(Number.isFinite)); this.matrix = args; },
    transform(a, b, c, d, e, f) { assert([a, b, c, d, e, f].every(Number.isFinite)); const [aa, bb, cc, dd, ee, ff] = this.matrix; this.matrix = [aa * a + cc * b, bb * a + dd * b, aa * c + cc * d, bb * c + dd * d, aa * e + cc * f + ee, bb * e + dd * f + ff]; },
    createLinearGradient(...args) { assert(args.every(Number.isFinite)); const stops=[]; return { stops, addColorStop(offset,color) { assert(offset>=0 && offset<=1); stops.push({offset,color}); } }; },
    beginPath() { this.path=[]; }, moveTo(...args) { assert(args.every(Number.isFinite)); this.path.push(args); },
    bezierCurveTo(...args) { assert(args.every(Number.isFinite)); this.path.push(args); }, closePath() {},
    fill() { calls.push({ method:'fill', composite:this.globalCompositeOperation, alpha:this.globalAlpha, path:this.path, style:this.fillStyle }); },
    clearRect(...args) { assert(args.every(Number.isFinite)); calls.push({ method: 'clearRect', args }); },
    drawImage(image, ...args) { assert(image); assert(args.every(Number.isFinite)); calls.push({ method: 'drawImage', image, args, alpha: this.globalAlpha, filter: this.filter, matrix: [...this.matrix] }); } };
  return { ctx, calls, stack };
}
function factory(extra = {}) {
  const images = [], requests = [], canvases = [];
  const player = texture.create({ loadImage: async (src, details) => {
    requests.push({ src, details }); const image = bitmap(src); images.push(image); return image;
  }, createCanvas() { const canvas = { width: 0, height: 0 }, output = context(); canvas.getContext = kind => { assert.equal(kind, '2d'); return output.ctx; }; output.ctx.canvas = canvas; canvases.push({ canvas, ...output }); return canvas; }, ...extra });
  return { player, images, requests, canvases };
}
const draws = output => output.calls.filter(call => call.method === 'drawImage');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('renderer contains only texture logic, makes no ambient calls and requires explicit capabilities', () => {
  assert(Object.isFrozen(texture)); assert.equal(texture.metadata.usesGeometryHead, false);
  assert.equal(texture.metadata.intrinsicEyes, true); assert.equal(texture.metadata.ownsRAF, false);
  assert.equal(texture.durationMs, 7000); assert.throws(() => texture.create({}), /capability-required/);
});

test('actual numeric manifest passes the schema; four canonical local paths decode before commit', async () => {
  const f = factory(); const ready = await f.player.load(descriptor()); assert.equal(ready.status, 'ready');
  assert.equal(f.requests.length, 4); assert(f.requests.every(r => r.src.startsWith('skins/tracer/local-vfx/haunt-art/fade-v1/') && Object.isFrozen(r.details)));
  assert.equal(f.player.getDiagnostics().ownedImages, 1); assert.equal(f.player.getDiagnostics().decodedImageBytes, 6290064);
  assert.equal(f.images.filter(image => image.closes === 1).length, 3); assert.equal(f.canvases.length, 3);
  assert.equal(f.player.getDiagnostics().smokePreparations, 3); f.player.destroy(); assert(f.images.every(image => image.closes === 1));
});

test('three typed smoke filters are prepared once with padding; original sources are not changed', async () => {
  const f = factory(); await f.player.load(descriptor());
  assert.equal(draws(f.canvases[0])[0].filter, 'grayscale(0.38) brightness(0.72) blur(4px)');
  assert.equal(draws(f.canvases[1])[0].filter, 'grayscale(0.18) brightness(0.92) blur(1.5px)');
  assert.equal(draws(f.canvases[2])[0].filter, 'grayscale(0.58) brightness(0.49) blur(2.5px)');
  assert.deepEqual(f.canvases.map(item => [item.canvas.width, item.canvas.height]), [[1278, 1278], [1264, 1264], [1270, 1270]]);
  for (const time of [300, 1200, 2400, 4400, 6250]) f.player.render(context().ctx, packet, time);
  assert.equal(f.player.getDiagnostics().smokePreparations, 3); assert(f.images.every(image => image.width === 1254 && image.height === 1254));
  assert(f.canvases.slice(0, 3).every(item => item.stack.length === 0 && item.ctx.filter === 'none')); f.player.destroy();
});

test('one continuous core is composed once with a single final alpha; no duplicate eyes or face', async () => {
  const f = factory(); await f.player.load(descriptor()); const out = context();
  const frame = f.player.render(out.ctx, { ...packet, localSmoke: false }, 6250); assert(frame.alpha > 0 && frame.alpha < 1);
  assert.equal(draws(out).length, 1); assert.equal(draws(out)[0].alpha, frame.alpha);
  const actor = f.canvases[3]; assert.equal(draws(out)[0].image, actor.canvas); assert.equal(actor.canvas.width, 1304); assert.equal(actor.canvas.height, 1288);
  const all = draws(actor); assert.equal(all.length, 38);
  assert(all.every(call => call.image.src.endsWith('/fade-haunt-core-v1.png') && call.alpha === 1));
  assert.equal(f.player.getDiagnostics().headMode, 'continuous-texture'); f.player.destroy();
});

test('whole-source core rows are covered exactly once; no region cropping or neck overlap darkening', async () => {
  const f = factory(); await f.player.load(descriptor()); f.player.render(context().ctx, packet, 4400);
  const actor = f.canvases[3], calls = draws(actor); let row = 0;
  for (const call of calls) { assert(Math.abs(call.args[1] - row) < 1e-9); assert.equal(call.args[0], 0); assert.equal(call.args[2], 1254); row += call.args[3]; }
  assert.equal(row, 1254); assert(!calls.some(call => call.args[3] > 1254)); f.player.destroy();
});

test('continuous deformation preserves all strip joins and fixed original neck/ground mapping', async () => {
  const f = factory(); await f.player.load(descriptor());
  for (const time of [300, 1200, 2300, 4400, 6250]) {
    const before = f.canvases[3]?.calls.length || 0, frame = f.player.render(context().ctx, { ...packet, localSmoke: false }, time);
    const calls = f.canvases[3].calls.slice(before).filter(call => call.method === 'drawImage');
    const xAt = (call, y) => call.matrix[0] * call.args[4] + call.matrix[2] * y + call.matrix[4];
    for (let i = 1; i < calls.length; i++) {
      const previous = calls[i - 1], current = calls[i], y = previous.args[5] + previous.args[7];
      assert(Math.abs(y - current.args[5]) < 1e-8); assert(Math.abs(xAt(previous, y) - xAt(current, y)) < 1e-8);
    }
    const last = calls.at(-1); assert.equal(last.args[1], 1195); assert.equal(last.args[5], 1212);
    assert(Math.abs(last.matrix[0] * 666 + last.matrix[2] * 1212 + last.matrix[4] - (666 + 25)) < 1e-9);
    assert.equal(frame.foot.x, 430); assert.equal(frame.foot.y, 600);
  }
  f.player.destroy();
});

test('screen placement preserves clicked ground and original horizontal source offset across sizes', async () => {
  const f = factory(); await f.player.load(descriptor());
  for (const size of [60, 150, 240]) for (const target of [{ x: 0, y: 0 }, { x: 1000, y: 720 }, { x: 430, y: 600 }]) {
    const out = context(); const frame = f.player.render(out.ctx, { ...packet, size, target, localSmoke: false }, 4400);
    const call = draws(out)[0], scale = size / 600;
    assert(Math.abs(call.args[0] + (666 + 25) * scale - frame.foot.x) < 1e-9);
    assert(Math.abs(call.args[1] + (1195 + 17) * scale - frame.foot.y) < 1e-9);
    assert.equal(frame.foot.x, target.x); assert.equal(frame.foot.y, target.y);
  }
  f.player.destroy();
});

test('all smoke breaths remain pinned at original source pivots, preserving independent layers', async () => {
  const f = factory(); const art = descriptor(); await f.player.load(art);
  for (const time of [300, 1200, 2400, 4400, 6500, 6800]) {
    const out = context(); f.player.render(out.ctx, packet, time);
    for (let i = 0; i < 3; i++) {
      const canvas = f.canvases[i], layer = art.layers.find(item => item.id === ['smoke-back', 'smoke-mid', 'smoke-front'][i]);
      const pad = Math.ceil(layer.style.blurPx * 3), pivotX = layer.sourceAnchor.x + pad, pivotY = layer.sourceAnchor.y + pad;
      const calls = draws(out).filter(item => item.image === canvas.canvas);
      const call = calls.find(item => item.args[0] <= pivotX && item.args[0] + item.args[2] >= pivotX); assert(call);
      const sx = call.args[6] / call.args[2], sy = call.args[7] / call.args[3];
      const x = call.args[4] + (pivotX - call.args[0]) * sx, y = call.args[5] + (pivotY - call.args[1]) * sy;
      assert(Math.abs(call.matrix[0] * x + call.matrix[2] * y + call.matrix[4] - packet.target.x) < 1e-9);
      assert(Math.abs(call.matrix[1] * x + call.matrix[3] * y + call.matrix[5] - packet.target.y) < 1e-9);
      assert(calls.every(item => item.alpha > 0 && item.alpha <= layer.opacity && item.filter === 'none'));
    }
  }
  f.player.destroy();
});

test('reduced held pose and exact repeated pose reuse their actor cache without new buffers', async () => {
  const f = factory(); await f.player.load(descriptor());
  f.player.render(context().ctx, { ...packet, motion: 'reduced' }, 3000); const writes = f.player.getDiagnostics().coreWrites;
  for (const time of [3100, 3200, 4400, 5990]) f.player.render(context().ctx, { ...packet, motion: 'reduced' }, time);
  assert.equal(f.player.getDiagnostics().coreWrites, writes); assert.equal(f.canvases.length, 4);
  f.player.render(context().ctx, packet, 4400); const normalWrites = f.player.getDiagnostics().coreWrites;
  f.player.render(context().ctx, packet, 4400); assert.equal(f.player.getDiagnostics().coreWrites, normalWrites); f.player.destroy();
});

test('render preserves caller state and never clears output; explicit clear restores transform', async () => {
  const f = factory(); await f.player.load(descriptor()); const out = context();
  out.ctx.globalAlpha = 0.37; out.ctx.filter = 'blur(1px)'; out.ctx.matrix = [2, 0, 0, 2, 3, 4];
  f.player.render(out.ctx, packet, 4400); assert.equal(out.ctx.globalAlpha, 0.37); assert.equal(out.ctx.filter, 'blur(1px)');
  assert.deepEqual(out.ctx.matrix, [2, 0, 0, 2, 3, 4]); assert.equal(out.stack.length, 0); assert(!out.calls.some(call => call.method === 'clearRect'));
  out.ctx.canvas = { width: 2560, height: 1440 }; texture.clear(out.ctx);
  assert.deepEqual(out.calls.at(-1).args, [0, 0, 2560, 1440]); assert.deepEqual(out.ctx.matrix, [2, 0, 0, 2, 3, 4]); f.player.destroy();
});

test('residue retains only smoke until complete; complete and destroyed frames draw nothing', async () => {
  const f = factory(); await f.player.load(descriptor()); const residue = context();
  const frame = f.player.render(residue.ctx, packet, 6800); assert.equal(frame.alpha, 0);
  assert.equal(new Set(draws(residue).map(call => call.image)).size, 3);
  const end = context(); assert.equal(f.player.render(end.ctx, packet, 7000).drawn, false); assert.equal(end.calls.length, 0);
  f.player.render(context().ctx, packet, 4400); f.player.destroy(); f.player.destroy();
  assert(f.images.every(image => image.closes === 1)); assert(f.canvases.every(item => item.canvas.width === 1 && item.canvas.height === 1));
  assert.equal(f.player.getDiagnostics().canvasBytes, 0); assert.equal(f.player.getDiagnostics().decodedImageBytes, 0);
  const after = context(); assert.equal(f.player.render(after.ctx, packet, 4400).assetStatus, 'destroyed'); assert.equal(after.calls.length, 0);
  assert.equal((await f.player.load(descriptor())).status, 'disposed');
});

test('invalid manifest and exact image dimension failures do not load or revive arbitrary assets', async () => {
  const f = factory(); const bad = descriptor(); bad.layers[0].src = 'https://host/arbitrary.png';
  await assert.rejects(f.player.load(bad), /manifest-invalid/); assert.equal(f.requests.length, 0); f.player.destroy();
  const wrong = factory({ loadImage: async src => bitmap(src, 1024, 1254) });
  assert.equal((await wrong.player.load(descriptor())).status, 'failed'); assert.equal(wrong.player.getDiagnostics().ownedImages, 0); wrong.player.destroy();
});

test('dimensions throwing after ownership transfer still release each arrived bitmap', async () => {
  const images = [], f = factory({ loadImage: async src => { const image = bitmap(src); images.push(image); if (src.includes('/fade-haunt-core')) Object.defineProperty(image, 'width', { get() { throw new Error('bad dimension getter'); } }); return image; } });
  assert.equal((await f.player.load(descriptor())).status, 'failed'); f.player.destroy(); assert(images.every(image => image.closes === 1));
});

test('latest completed bundle wins, and an older late bundle is closed without canvas allocation', async () => {
  const waiting = [], f = factory({ loadImage(src) { const d = deferred(); waiting.push({ src, d }); return d.promise; } });
  const old = f.player.load(descriptor('old')), newer = f.player.load(descriptor('new')); assert.equal(f.player.getDiagnostics().pendingLoads, 1);
  const newImages = waiting.slice(4).map(({ src, d }) => { const image = bitmap(src); d.resolve(image); return image; });
  assert.equal((await newer).status, 'ready'); assert.equal(f.player.getDiagnostics().pendingLoads, 0);
  const oldImages = waiting.slice(0, 4).map(({ src, d }) => { const image = bitmap(src); d.resolve(image); return image; });
  assert.equal((await old).status, 'superseded'); assert(oldImages.every(image => image.closes === 1)); assert.equal(f.canvases.length, 3);
  assert.equal(f.player.getDiagnostics().activeBundle, 'new'); f.player.destroy(); assert(newImages.every(image => image.closes === 1));
});

test('failed replacement retains the old valid artwork and closes both arrived and late images', async () => {
  let hold = false; const waiting = [], images = [];
  const f = factory({ loadImage(src) { if (!hold) { const image = bitmap(src); images.push(image); return Promise.resolve(image); } const d = deferred(); waiting.push({ src, d }); return d.promise; } });
  await f.player.load(descriptor('old')); hold = true; const replacement = f.player.load(descriptor('bad'));
  const arrived = bitmap(waiting[0].src); waiting[0].d.resolve(arrived); await tick(); waiting[1].d.reject(new Error('private loader detail'));
  const result = await replacement; assert.equal(result.status, 'failed'); assert.equal(result.error, 'haunt-texture-load-failed'); assert.equal(arrived.closes, 1);
  assert.equal(f.player.render(context().ctx, packet, 4400).bundleId, 'old');
  const late = waiting.slice(2).map(({ src, d }) => { const image = bitmap(src); d.resolve(image); return image; }); await tick(); assert(late.every(image => image.closes === 1));
  f.player.destroy(); assert(images.every(image => image.closes === 1));
});

test('destruction detaches pending requests and closes later decoded results without resurrection', async () => {
  const waiting = [], f = factory({ loadImage(src) { const d = deferred(); waiting.push({ src, d }); return d.promise; } });
  const loading = f.player.load(descriptor()); const arrived = bitmap(waiting[0].src); waiting[0].d.resolve(arrived); await tick(); f.player.destroy();
  assert.equal(arrived.closes, 1); assert.equal(f.player.getDiagnostics().pendingLoads, 0);
  const late = waiting.slice(1).map(({ src, d }) => { const image = bitmap(src); d.resolve(image); return image; });
  assert.equal((await loading).status, 'disposed'); assert(late.every(image => image.closes === 1)); assert.equal(f.canvases.length, 0);
});

test('partial preprocessing failure rolls back all owned canvases and sources', async () => {
  const images = [], surfaces = []; let count = 0;
  const f = factory({ loadImage: async src => { const image = bitmap(src); images.push(image); return image; }, createCanvas() {
    const canvas = { width: 0, height: 0 }; const out = context(); canvas.getContext = () => ++count === 2 ? null : out.ctx; surfaces.push(canvas); return canvas;
  } });
  assert.equal((await f.player.load(descriptor())).status, 'failed'); assert(images.every(image => image.closes === 1));
  assert(surfaces.every(canvas => canvas.width === 1 && canvas.height === 1)); assert.equal(f.player.getDiagnostics().canvasBytes, 0); f.player.destroy();
});

test('unsupported filter preparation fails explicitly instead of silently showing unfiltered smoke', async () => {
  const images = [], canvases = [];
  const f = factory({ loadImage: async src => { const image = bitmap(src); images.push(image); return image; }, createCanvas() {
    const canvas = { width: 0, height: 0 }, out = context(); delete out.ctx.filter; canvas.getContext = () => out.ctx; canvases.push(canvas); return canvas;
  } });
  assert.equal((await f.player.load(descriptor())).status, 'failed'); assert(images.every(image => image.closes === 1));
  assert(canvases.every(canvas => canvas.width === 1 && canvas.height === 1)); f.player.destroy();
});

test('invalid injected frame fails before painting or allocating actor buffers', async () => {
  const f = factory({ sample: () => ({ ...body.sample(packet, 4400), rise: NaN }) }); await f.player.load(descriptor());
  const out = context(); assert.throws(() => f.player.render(out.ctx, packet, 4400), /frame-invalid/); assert.equal(out.calls.length, 0); assert.equal(f.canvases.length, 3); f.player.destroy();
});

test('tiny source breathing moves a connected neck and head while leaving the ground fixed', async () => {
  const f = factory(); await f.player.load(descriptor());
  const poses = [];
  for (const time of [2400, 3000, 4400, 5990, 6250]) {
    const frame = f.player.render(context().ctx, { ...packet, localSmoke: false }, time); poses.push(frame.texturePose);
    assert(frame.texturePose.breath >= 0.99 && frame.texturePose.breath <= 1.01);
    assert(frame.texturePose.verticalDriftSourcePx >= 0 && frame.texturePose.verticalDriftSourcePx <= 4);
    assert.equal(frame.texturePose.ground.x, packet.target.x); assert.equal(frame.texturePose.ground.y, packet.target.y);
    const expectedGap = (527 - 288.5) * frame.texturePose.breath * packet.size / 600;
    assert(Math.abs(frame.texturePose.neck.y - frame.texturePose.headCenter.y - expectedGap) < 1e-9);
  }
  assert(new Set(poses.map(pose => pose.headCenter.y)).size > 1);
  const fixed = f.player.render(context().ctx, { ...packet, motion: 'reduced' }, 4400).texturePose;
  assert.equal(fixed.breath, 1); assert.equal(fixed.verticalDriftSourcePx, 0); f.player.destroy();
});

test('smoke column deformation has continuous joins and phase-dependent local shape, not only whole-image motion', async () => {
  const f = factory(); await f.player.load(descriptor()); const waves = [];
  for (const time of [2400, 3400, 4400]) {
    const out = context(); f.player.render(out.ctx, packet, time);
    for (let id = 0; id < 3; id++) {
      const calls = draws(out).filter(call => call.image === f.canvases[id].canvas);
      assert.equal(calls.length, id === 1 ? 27 : 9); assert(calls.some(call => Math.abs(call.matrix[1]) > 0.0001));
      for (let i = 1; i < calls.length; i++) {
        if (i % 9 === 0) continue; // Separate filled mid-depth lobe, never a strip join.
        const prev = calls[i - 1], next = calls[i], x = prev.args[4] + prev.args[6];
        assert(Math.abs(x - next.args[4]) < 1e-8);
        const prevTop = prev.matrix[1] * x + prev.matrix[3] * prev.args[5] + prev.matrix[5];
        const nextTop = next.matrix[1] * x + next.matrix[3] * next.args[5] + next.matrix[5];
        assert(Math.abs(prevTop - nextTop) < 1e-8);
      }
      waves.push(calls.map(call => call.matrix[1]).join(','));
    }
  }
  assert.equal(new Set(waves).size, waves.length); f.player.destroy();
});

test('owned RGBA accounting includes replacement resources and reports zero active bytes after destruction', async () => {
  let hold = false; const waiting = [];
  const f = factory({ loadImage(src) { if (!hold) return Promise.resolve(bitmap(src)); const d = deferred(); waiting.push({ src, d }); return d.promise; } });
  await f.player.load(descriptor('old')); f.player.render(context().ctx, packet, 4400);
  const old = f.player.getDiagnostics(); assert(old.trackedOwnedBytes > 30 * 1024 * 1024 && old.trackedOwnedBytes < 33 * 1024 * 1024);
  hold = true; const loading = f.player.load(descriptor('new'));
  waiting[0].d.resolve(bitmap(waiting[0].src)); await tick();
  const partial = f.player.getDiagnostics(); assert.equal(partial.pendingImageBytes, 6290064); assert.equal(partial.pendingCanvasBytes, 0);
  assert.equal(partial.trackedOwnedBytes, old.trackedOwnedBytes + 6290064);
  for (const { src, d } of waiting.slice(1)) d.resolve(bitmap(src)); assert.equal((await loading).status, 'ready');
  const ready = f.player.getDiagnostics(); assert.equal(ready.pendingImageBytes, 0); assert.equal(ready.pendingCanvasBytes, 0);
  assert(ready.trackedBytesPeak > 55 * 1024 * 1024 && ready.trackedBytesPeak < 65 * 1024 * 1024);
  f.player.destroy(); assert.equal(f.player.getDiagnostics().trackedOwnedBytes, 0); assert.equal(f.player.getDiagnostics().pendingLoads, 0);
});

test('a reused canvas factory cannot overwrite or release a currently valid smoke texture', async () => {
  const all = [], out = context(); let reused;
  const f = factory({ createCanvas() {
    if (reused) return reused;
    const canvas = { width: 0, height: 0, getContext: () => out.ctx }; all.push(canvas); return canvas;
  } });
  await f.player.load(descriptor('old')); reused = all[0];
  assert.equal((await f.player.load(descriptor('bad'))).status, 'failed');
  assert.equal(reused.width, 1278); assert.equal(reused.height, 1278); assert.equal(f.player.getDiagnostics().activeBundle, 'old');
  f.player.destroy(); assert.equal(reused.width, 1);
});

test('a failed warm pose overwrite cannot turn the old pose into a cache hit over partial pixels', async () => {
  const f = factory(); await f.player.load(descriptor()); const out = context();
  f.player.render(out.ctx, { ...packet, localSmoke: false }, 4400);
  const actor = f.canvases[3], original = actor.ctx.drawImage; let attempts = 0;
  actor.ctx.drawImage = function (...args) { if (++attempts === 2) throw new Error('injected second strip failure'); return original.apply(this, args); };
  const failing = context(); assert.throws(() => f.player.render(failing.ctx, { ...packet, localSmoke: false }, 3400), /second strip failure/);
  assert.equal(failing.calls.length, 0); assert.equal(actor.stack.length, 0);
  actor.ctx.drawImage = original; const writes = f.player.getDiagnostics().coreWrites, before = actor.calls.length;
  f.player.render(context().ctx, { ...packet, localSmoke: false }, 4400);
  assert.equal(f.player.getDiagnostics().coreWrites, writes + 1);
  assert.equal(actor.calls.slice(before).filter(call => call.method === 'drawImage').length, 38); f.player.destroy();
});

test('upper projection compression preserves every source row and the neck without slicing off tips', async () => {
  const f = factory(); await f.player.load(descriptor());
  f.player.render(context().ctx, { ...packet, motion: 'reduced', localSmoke: false }, 4400);
  const calls = draws(f.canvases[3]), head = calls.filter(call => call.args[1] < 527);
  const padY = 17, hinge = 42 + 493 * .378;
  assert(head.length > 2); assert.equal(head[0].args[1], 0);
  assert(head[0].args[5] - padY > 100); // Whole retained source top is compressed, not cropped.
  assert.equal(head.at(-1).args[1] + head.at(-1).args[3], 527);
  assert.equal(head.at(-1).args[5] + head.at(-1).args[7], 527 + padY);
  assert(Math.abs(head[0].args[5] - padY - hinge * .74) <= .5);
  f.player.destroy();
});

test('smoke density comes from distinct height/color layers rather than extra draw surfaces or eye overlays', async () => {
  const f = factory(); await f.player.load(descriptor()); const art = descriptor();
  const back = art.layers.find(layer => layer.id === 'smoke-back'), mid = art.layers.find(layer => layer.id === 'smoke-mid'), front = art.layers.find(layer => layer.id === 'smoke-front');
  assert(mid.scale.y > back.scale.y && back.scale.y > front.scale.y);
  assert(mid.style.brightness > front.style.brightness && mid.style.grayscale < front.style.grayscale);
  assert(front.opacity > mid.opacity && mid.opacity > back.opacity);
  for (const time of [1200, 2400, 3400, 4400, 5990, 6336]) f.player.render(context().ctx, packet, time);
  assert.equal(f.canvases.length, 4); assert.equal(f.player.getDiagnostics().smokePreparations, 3);
  assert.equal(f.player.getDiagnostics().ownedImages, 1); f.player.destroy();
  assert.equal(f.player.getDiagnostics().trackedOwnedBytes, 0);
});

test('ground cloud remains behind the gathering face and reaches front depth only after the head rises', async () => {
  const f = factory(); await f.player.load(descriptor());
  for (const time of [650, 850]) {
    const out = context(); f.player.render(out.ctx, packet, time);
    const calls = draws(out), actorIndex = calls.findIndex(call => call.image === f.canvases[3].canvas);
    const fronts = calls.map((call,index)=>({call,index})).filter(row=>row.call.image===f.canvases[2].canvas);
    assert(fronts.length>0); assert(fronts.every(row=>row.index<actorIndex));
  }
  const out=context(); f.player.render(out.ctx,packet,2450);
  const calls=draws(out), actorIndex=calls.findIndex(call=>call.image===f.canvases[3].canvas);
  assert(calls.map((call,index)=>({call,index})).filter(row=>row.call.image===f.canvases[2].canvas).every(row=>row.index>actorIndex));
  assert.equal(f.canvases.length,4);f.player.destroy();
});


test('filled middle and front billows use three independent deformations pinned to the same ground without added resources', async () => {
  const f=factory(); const art=descriptor(); await f.player.load(art);
  for(const time of [850,2450,4400,6336]) {
    const out=context(); const frame=f.player.render(out.ctx,packet,time);
    const mid=draws(out).filter(call=>call.image===f.canvases[1].canvas);
    assert.equal(mid.length,frame.rise<=0.16?18:27);
    const layer=art.layers.find(layer=>layer.id==='smoke-mid'), pad=Math.ceil(layer.style.blurPx*3);
    const pivotX=layer.sourceAnchor.x+pad,pivotY=layer.sourceAnchor.y+pad;
    const widths=[];
    for(const group of [mid.slice(0,9),mid.slice(9,18),...(mid.length>18?[mid.slice(18)]:[])]) {
      const call=group.find(call=>call.args[0]<=pivotX&&call.args[0]+call.args[2]>=pivotX);assert(call);
      const sx=call.args[6]/call.args[2],sy=call.args[7]/call.args[3]; widths.push(sx);
      const x=call.args[4]+(pivotX-call.args[0])*sx,y=call.args[5]+pivotY*sy;
      assert(Math.abs(call.matrix[0]*x+call.matrix[2]*y+call.matrix[4]-packet.target.x)<1e-8);
      assert(Math.abs(call.matrix[1]*x+call.matrix[3]*y+call.matrix[5]-packet.target.y)<1e-8);
    }
    assert.notEqual(widths[0],widths[1]);assert(mid[0].alpha<mid[9].alpha);
  }
  assert.equal(f.canvases.length,4);assert.equal(f.player.getDiagnostics().smokePreparations,3);
  f.player.destroy();assert.equal(f.player.getDiagnostics().trackedOwnedBytes,0);
});


test('filled shell troughs are clipped into the single actor and never overlap a second face', async () => {
  const f=factory(); await f.player.load(descriptor()); const out=context(); f.player.render(out.ctx,{...packet,localSmoke:false},4400);
  const fills=f.canvases[3].calls.filter(c=>c.method==='fill'); assert.equal(fills.length,2);
  assert(fills.every(c=>c.composite==='source-atop' && c.alpha===1 && c.path.length===3 && c.style.stops.length===4));
  assert.equal(draws(out).length,1); assert.equal(f.canvases[3].ctx.globalCompositeOperation,'source-over'); f.player.destroy();
});
test('low front billow has a distinct phase and occludes supports after the only actor composite', async () => {
  const f=factory(); await f.player.load(descriptor()); const out=context(); f.player.render(out.ctx,packet,4400);
  const calls=draws(out),actorIndex=calls.findIndex(c=>c.image===f.canvases[3].canvas);
  assert(actorIndex>0); const front=calls.slice(actorIndex+1).filter(c=>c.image===f.canvases[1].canvas);
  assert(front.length>0); assert(front.every(c=>c.alpha>0 && c.alpha<0.7));
  const maxHeight=Math.max(...front.map(c=>c.args[7])); const body=texture.sample(packet,4400);
  assert(maxHeight<(1195-527)*body.size/600, 'front height '+maxHeight+' must fit below neck');
  assert.equal(f.player.getDiagnostics().allocations,4); f.player.destroy();
});

test('missing crown shading capabilities fail loading and release arrived sources instead of failing mid-effect', async () => {
  const canvases=[]; const f=factory({ createCanvas() { const canvas={width:0,height:0},c=context().ctx; delete c.createLinearGradient;canvas.getContext=()=>c;canvases.push(canvas);return canvas; } });
  const result=await f.player.load(descriptor());assert.equal(result.status,'failed');assert(f.images.every(i=>i.closes===1));assert(canvases.every(c=>c.width===1&&c.height===1));assert.equal(f.player.getDiagnostics().trackedOwnedBytes,0);f.player.destroy();
});
