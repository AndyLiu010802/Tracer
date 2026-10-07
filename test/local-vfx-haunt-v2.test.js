'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const { finiteContext, assertFiniteTree } = require('./fixtures/local-vfx-finite-canvas.cjs');
const bodyPath = path.join(__dirname, '..', 'desktop', 'local-vfx-haunt-v2.js');
const fogPath = path.join(__dirname, '..', 'desktop', 'local-vfx-haunt-atmosphere.js');

function loadIsolated(file) {
  const sandbox = { module: { exports: {} } };
  for (const name of ['document', 'OffscreenCanvas', 'Image', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Audio', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'addEventListener']) {
    Object.defineProperty(sandbox, name, { get() { throw new Error('renderer attempted ambient capability: ' + name); } });
  }
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.module.exports;
}

const body = loadIsolated(bodyPath);
const fog = loadIsolated(fogPath);
const packet = Object.freeze({ width: 1280, height: 720, size: 150, start: Object.freeze({ x: 280, y: 430 }), target: Object.freeze({ x: 800, y: 570 }), strength: 0.55, motion: 'normal', seed: 12345 });

function bodyFactory() {
  const tiles = [], dimensionChanges = [], draws = [];
  const player = body.create({ createCanvas: () => {
    const texture = {}, recorded = finiteContext();
    let width = 0, height = 0;
    Object.defineProperties(texture, {
      width: { get: () => width, set(value) { assert(Number.isInteger(value) && value >= 1); width = value; dimensionChanges.push(['width', value]); } },
      height: { get: () => height, set(value) { assert(Number.isInteger(value) && value >= 1); height = value; dimensionChanges.push(['height', value]); } }
    });
    texture.getContext = kind => { assert.equal(kind, '2d'); return recorded.ctx; };
    recorded.ctx.canvas = texture;
    tiles.push({ texture, ...recorded }); return texture;
  } });
  const render = (ctx, config, time) => {
    if (!ctx) return player.render(ctx, config, time);
    const originalDraw = ctx.drawImage;
    ctx.drawImage = function (texture, ...args) { draws.push({ texture, args, alpha: ctx.globalAlpha, elapsed: time }); return originalDraw(texture, ...args); };
    try { return player.render(ctx, config, time); } finally { ctx.drawImage = originalDraw; }
  };
  return { player, tiles, dimensionChanges, draws, render };
}

function renderBody(ctx, config, time) {
  const factory = bodyFactory();
  try { return factory.render(ctx, config, time); } finally { factory.player.destroy(); }
}

function fogFactory() {
  const textures = [], writes = [];
  const player = fog.create({ createCanvas: () => {
    const layer = textures.length;
    const grid = { createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: data => writes.push({ layer, width: data.width, height: data.height, data: new Uint8ClampedArray(data.data) }) };
    const texture = { width: 0, height: 0, getContext: kind => { assert.equal(kind, '2d'); return grid; } };
    textures.push(texture);
    return texture;
  } });
  return { player, writes, textures };
}

test('body duration and ordered designed phases are explicit; no ambient capabilities needed', () => {
  assert.equal(body.durationMs, 7000); assert.equal(body.duration, 7000);
  assert.equal(Object.isFrozen(body), true);
  const times = [0, 800, 2300, 6000, 6700, 7000];
  assert.deepEqual(times.map(time => body.sample(packet, time).phase), ['gather', 'unfold', 'scan', 'breakup', 'residue', 'finished']);
  assert.equal(body.sample(packet, 7000).opacity, 0); assert.equal(body.sample(packet, 7000).eye, 0);
});

test('body samples have finite geometry, bounded scalar envelopes and a stable ground anchor', () => {
  for (const motion of ['normal', 'reduced']) for (let ms = 0; ms <= 7100; ms += 13) {
    const frame = body.sample({ ...packet, motion }, ms); assertFiniteTree(frame);
    for (const field of ['opacity', 'eye', 'flight', 'rise', 'exit', 'intensity']) assert(frame[field] >= 0 && frame[field] <= 1, field);
    assert.equal(frame.anchor.x, packet.target.x); assert.equal(frame.anchor.y, packet.target.y);
  }
  for (const boundary of [800, 2300, 6000, 6700]) {
    const before = body.sample(packet, boundary - 0.001), after = body.sample(packet, boundary + 0.001);
    assert(Math.hypot(before.center.x - after.center.x, before.center.y - after.center.y) < 0.01, 'center continuity at ' + boundary);
    assert(Math.abs(before.opacity - after.opacity) < 0.01, 'opacity continuity at ' + boundary);
    assert(Math.abs(before.eye - after.eye) < 0.01, 'eye continuity at ' + boundary);
  }
});

test('body orientation has no phase boundary snap in normal or reduced motion', () => {
  for (const motion of ['normal', 'reduced']) for (const boundary of [800, 2300, 6000, 6700]) {
    const before = body.sample({ ...packet, motion }, boundary - 0.001), after = body.sample({ ...packet, motion }, boundary + 0.001);
    assert(Math.abs(before.yaw - after.yaw) < 0.001, `${motion} yaw continuity at ${boundary}: ${before.yaw} -> ${after.yaw}`);
    assert(Math.abs(before.pitch - after.pitch) < 0.001, `${motion} pitch continuity at ${boundary}: ${before.pitch} -> ${after.pitch}`);
  }
});

test('invalid body packet and elapsed values remain finite without mutation', () => {
  for (const value of [null, undefined, 'not a packet', [], { width: NaN, height: Infinity, size: -1, strength: NaN, start: { x: Infinity, y: NaN }, target: { x: -Infinity, y: undefined } }]) {
    for (const time of [-999, NaN, Infinity, -Infinity, 0, 7000]) assertFiniteTree(body.sample(value, time));
  }
  const frame = body.sample(packet, 3200);
  assert.equal(packet.start.x, 280); assert.equal(packet.target.y, 570);
  frame.center.x = -55; assert.equal(packet.start.x, 280);
  assert.equal(body.sample(packet, -1).elapsed, 0); assert.equal(body.sample(packet, NaN).elapsed, 0);
});

test('reduced motion preserves essential timing and anchor while reducing secondary bob', () => {
  for (let ms = 0; ms <= 7000; ms += 71) {
    const normal = body.sample(packet, ms), reduced = body.sample({ ...packet, motion: 'reduced' }, ms);
    assert.equal(normal.phase, reduced.phase); assert.equal(normal.durationMs, reduced.durationMs);
    assert.equal(normal.opacity, reduced.opacity); assert.equal(normal.eye, reduced.eye);
    assert.equal(normal.center.x, reduced.center.x); assert.equal(normal.anchor.y, reduced.anchor.y);
  }
  for (const time of [3800, 4500, 5200]) {
    const normal = body.sample(packet, time), reduced = body.sample({ ...packet, motion: 'reduced' }, time);
    const resting = packet.target.y - packet.size * 1.95;
    assert(Math.abs(reduced.center.y - resting) <= Math.abs(normal.center.y - resting) + 1e-9);
  }
});

test('body render draws finite geometry, balances context, and never clears the compositor', () => {
  for (const size of [60, 150, 240]) for (const motion of ['normal', 'reduced']) {
    const canvas = finiteContext(); canvas.ctx.globalCompositeOperation = 'destination-over'; canvas.ctx.globalAlpha = 0.37;
    for (const time of [0, 600, 1100, 1700, 2380, 2900, 3900, 5800, 6300, 6800, 7000]) {
      const frame = renderBody(canvas.ctx, { ...packet, size, motion }, time); assertFiniteTree(frame);
      assert.equal(canvas.stack.length, 0); assert.equal(canvas.ctx.globalAlpha, 0.37); assert.equal(canvas.ctx.globalCompositeOperation, 'destination-over');
    }
    assert(!canvas.calls.some(call => call.method === 'clearRect'), 'body must not erase atmosphere or sibling layers');
  }
});

test('body completion draws nothing; explicit clear covers backing pixels and preserves transform', () => {
  const canvas = finiteContext(2560, 1440); canvas.ctx.transformValue = [2, 0, 0, 2, 0, 0];
  assert.equal(renderBody(canvas.ctx, packet, 7000).finished, true); assert.equal(canvas.calls.length, 0);
  body.clear(canvas.ctx);
  assert.deepEqual(canvas.calls.find(call => call.method === 'clearRect').args, [0, 0, 2560, 1440]);
  assert.deepEqual(canvas.ctx.transformValue, [2, 0, 0, 2, 0, 0]); assert.equal(canvas.stack.length, 0);
  assert.throws(() => renderBody(null, packet, 0), /context-required/);
});

test('body finite geometry is repeatable for the same packet and elapsed time', () => {
  const first = finiteContext(), second = finiteContext();
  renderBody(first.ctx, packet, 6250); renderBody(second.ctx, packet, 6250);
  assert.deepEqual(first.calls, second.calls);
});

test('head fade composites one completed opaque shell instead of fading intersecting faces', () => {
  const factory = bodyFactory(), canvas = finiteContext();
  for (const time of [300, 6250]) {
    const startDraws = factory.draws.length;
    const frame = factory.render(canvas.ctx, packet, time);
    assert(frame.opacity > 0 && frame.opacity < 1, 'test must exercise partial opacity');
    const headDraws = factory.draws.slice(startDraws);
    assert.equal(headDraws.length, 1, 'only one whole-head layer is composited');
    assert.equal(headDraws[0].alpha, frame.opacity, 'fade belongs to the completed head layer');
    const tile = factory.tiles[0]; assert(tile);
    const solidFaceFills = tile.calls.filter(call => ['fill', 'stroke'].includes(call.method) && /^rgb\(/.test(call.method === 'fill' ? call.fillStyle : call.strokeStyle));
    assert(solidFaceFills.length > 0, 'test observed solid shell shading');
    for (const call of solidFaceFills) assert.equal(call.alpha, 1, 'intersecting solid faces must remain opaque inside the head tile');
  }
  assert.equal(factory.tiles.length, 1); factory.player.destroy();
});

test('head canvas has a finite fixed budget reused across frames, scales and viewports', () => {
  const factory = bodyFactory(), canvas = finiteContext();
  const configs = [{ ...packet, size: 60 }, { ...packet, width: 32768, height: 32768, size: 240 }, { ...packet, width: 1, height: 1, size: 150 }];
  for (const config of configs) for (const time of [900, 1800, 3500, 6300]) {
    const frame = factory.render(canvas.ctx, config, time); assertFiniteTree(frame);
    assert.equal(factory.tiles.length, 1, 'the renderer must reuse a single bounded head surface');
    const tile = factory.tiles[0];
    assert(tile.texture.width <= 1024 && tile.texture.height <= 1024, 'head surface must not grow with desktop area');
    assert(tile.texture.width * tile.texture.height * 4 <= 4 * 1024 * 1024, 'head backing bytes exceed local budget');
    assert.equal(tile.stack.length, 0);
  }
  assert.equal(factory.dimensionChanges.length, 2, 'no repeated backing-surface resize during playback');
  assert(factory.draws.every(draw => draw.texture === factory.tiles[0].texture));
  factory.player.destroy();
});

test('head player disposal releases backing pixels and forbids resurrection', () => {
  const factory = bodyFactory(), canvas = finiteContext();
  assert.equal(factory.tiles.length, 0);
  assert.equal(factory.render(canvas.ctx, packet, 7000).finished, true);
  assert.equal(factory.tiles.length, 0, 'completed frame must not allocate resources');
  factory.render(canvas.ctx, packet, 3800); assert.equal(factory.tiles.length, 1);
  const tile = factory.tiles[0].texture; factory.player.destroy(); factory.player.destroy();
  assert.equal(tile.width, 1); assert.equal(tile.height, 1);
  const calls = canvas.calls.length, allocations = factory.tiles.length;
  const late = factory.render(canvas.ctx, packet, 800);
  assert.equal(late.phase, 'destroyed'); assert.equal(late.finished, true); assert.equal(late.opacity, 0);
  assert.equal(canvas.calls.length, calls); assert.equal(factory.tiles.length, allocations);
});

test('independent head players do not share backing state and never request ambient canvas resources', () => {
  const first = bodyFactory(), second = bodyFactory();
  first.render(finiteContext().ctx, packet, 1200); second.render(finiteContext().ctx, packet, 4500);
  assert.notEqual(first.tiles[0].texture, second.tiles[0].texture);
  first.player.destroy();
  const secondCanvas = finiteContext(); assert.equal(second.render(secondCanvas.ctx, packet, 4800).finished, false);
  assert.equal(second.tiles[0].texture.width > 1, true);
  second.player.destroy();
});

test('failed head-context allocation releases its backing and permits a later healthy retry', () => {
  const canvas = finiteContext();
  let attempts = 0;
  const retryTextures = [];
  const retryPlayer = body.create({ createCanvas: () => {
    const texture = { width: 0, height: 0 }, recorded = finiteContext(); recorded.ctx.canvas = texture;
    const healthy = ++attempts > 1;
    texture.getContext = () => healthy ? recorded.ctx : null;
    retryTextures.push(texture); return texture;
  } });
  try {
    assert.throws(() => retryPlayer.render(canvas.ctx, packet, 3200), /head-context-unavailable/);
    assert.equal(retryTextures.length, 1); assert.equal(retryTextures[0].width, 1); assert.equal(retryTextures[0].height, 1);
    assert.equal(retryPlayer.getDiagnostics().headTileCount, 0);
    assert.equal(retryPlayer.render(canvas.ctx, packet, 3400).finished, false);
    assert.equal(retryTextures.length, 2); assert.equal(retryPlayer.getDiagnostics().headTileCount, 1);
  } finally { retryPlayer.destroy(); }
});

test('origin stays at each selected point for the whole duration without start-driven travel', () => {
  const locations = [{ x: 0, y: 0 }, { x: 90, y: 550 }, { x: 800, y: 570 }, { x: 1279, y: 719 }];
  for (const target of locations) for (const motion of ['normal', 'reduced']) for (let time = 0; time <= 7000; time += 17) {
    const config = { ...packet, target, motion, start: { x: 15, y: 22 } };
    const frame = body.sample(config, time), otherStart = body.sample({ ...config, start: { x: 1200, y: 700 } }, time);
    assert.equal(frame.center.x, target.x); assert.equal(frame.anchor.x, target.x); assert.equal(frame.anchor.y, target.y);
    assert.equal(frame.center.x, otherStart.center.x); assert.equal(frame.center.y, otherStart.center.y);
    assert.equal(frame.phase, otherStart.phase); assertFiniteTree(frame);
  }
  for (const target of [{ x: -100, y: -100 }, { x: 3000, y: 3000 }]) {
    const frame = body.sample({ ...packet, target }, 3500);
    assert.equal(frame.center.x, Math.max(0, Math.min(packet.width, target.x)));
    assert.equal(frame.anchor.x, frame.center.x);
    assert.equal(frame.anchor.y, Math.max(0, Math.min(packet.height, target.y)));
  }
});

test('atmosphere normalized bounds and zero/off/end envelopes are explicit', () => {
  assert.equal(fog.metadata.durationMs, body.durationMs); assert.equal(fog.metadata.ownsAnimationLoop, false);
  assert.equal(fog.metadata.desktopAdaptation, true); assert.equal(Object.isFrozen(fog.metadata), true);
  for (const value of [null, [], 'invalid', { width: Infinity, height: NaN, strength: NaN, seed: Infinity }, { width: -1, height: 1e9, strength: -999 }]) {
    const normalized = fog.normalize(value); assertFiniteTree(normalized);
    assert(normalized.width >= 1 && normalized.width <= 32768); assert(normalized.height >= 1 && normalized.height <= 32768);
    assert(normalized.strength >= 0 && normalized.strength <= 0.6);
  }
  assert.equal(fog.sample({ strength: 0 }, 3300).maxOpacity, 0);
  assert.equal(fog.sample({ atmosphere: false }, 3300).maxOpacity, 0);
  for (const time of [-1, NaN, Infinity, 0, 7000, 9000]) {
    const frame = fog.sample(packet, time); assertFiniteTree(frame); assert.equal(frame.maxOpacity, 0);
  }
});

test('atmosphere central texture alpha stays zero and opacity stays bounded', () => {
  const factory = fogFactory(), canvas = finiteContext();
  assert.equal(factory.player.draw(canvas.ctx, packet, 3300), true);
  assert.equal(factory.writes.length, factory.textures.length);
  let edgeVisible = false;
  const maxAlpha = Math.ceil(255 * fog.sample(packet, 3300).maxOpacity);
  for (const texture of factory.writes) for (let y = 0; y < texture.height; y++) for (let x = 0; x < texture.width; x++) {
    const alpha = texture.data[(y * texture.width + x) * 4 + 3];
    assert(alpha <= maxAlpha); if (alpha > 0) edgeVisible = true;
    if ((x + 0.5) / texture.width >= 0.2 && (x + 0.5) / texture.width <= 0.8 && (y + 0.5) / texture.height >= 0.2 && (y + 0.5) / texture.height <= 0.8) assert.equal(alpha, 0);
  }
  const size = factory.writes[0].width * factory.writes[0].height;
  for (let index = 0; index < size; index++) {
    const transparency = factory.writes.reduce((product, texture) => product * (1 - texture.data[index * 4 + 3] / 255), 1);
    assert(1 - transparency <= fog.sample(packet, 3300).maxOpacity + 1 / 255, 'layer overlap must respect the public opacity budget');
  }
  assert(edgeVisible); assert.equal(canvas.stack.length, 0);
  assert(!canvas.calls.some(call => call.method === 'clearRect'));
  factory.player.destroy();
});

test('fog is repeatable by seed and time, changes by seed and normal-time drift', () => {
  const first = fogFactory(), second = fogFactory(), third = fogFactory();
  first.player.draw(finiteContext().ctx, packet, 3300); second.player.draw(finiteContext().ctx, packet, 3300);
  const snapshot = first.writes.slice();
  assert.deepEqual(snapshot.map(write => write.data), second.writes.map(write => write.data));
  third.player.draw(finiteContext().ctx, { ...packet, seed: packet.seed + 1 }, 3300);
  assert.notDeepEqual(snapshot.map(write => write.data), third.writes.map(write => write.data));
  first.player.draw(finiteContext().ctx, packet, 4500);
  assert.notDeepEqual(snapshot.map(write => write.data), first.writes.slice(snapshot.length).map(write => write.data));
  first.player.destroy(); second.player.destroy(); third.player.destroy();
});

test('reduced fog has no drift during the hold envelope and preserves phase duration', () => {
  const factory = fogFactory();
  for (const time of [3000, 4500]) {
    const config = { ...packet, motion: 'reduced' };
    assert.equal(fog.sample(config, time).drift, 0); factory.player.draw(finiteContext().ctx, config, time);
  }
  const layers = factory.textures.length;
  assert.deepEqual(factory.writes.slice(0, layers).map(write => write.data), factory.writes.slice(layers).map(write => write.data));
  factory.player.destroy();
});

test('off, zero, initial, end and disposed fog draw nothing and never create a late texture', () => {
  const factory = fogFactory(), canvas = finiteContext();
  for (const [config, time] of [[packet, 0], [packet, 7000], [{ ...packet, strength: 0 }, 3300], [{ ...packet, atmosphere: false }, 3300]]) assert.equal(factory.player.draw(canvas.ctx, config, time), false);
  assert.equal(factory.writes.length, 0); assert.equal(canvas.calls.length, 0);
  factory.player.destroy(); factory.player.destroy();
  assert(factory.textures.every(texture => texture.width === 1 && texture.height === 1));
  assert.equal(factory.player.getDiagnostics().textureBytes, 0);
  assert.equal(factory.player.draw(canvas.ctx, packet, 3300), false); assert.equal(canvas.calls.length, 0); assert.equal(factory.writes.length, 0);
});

test('fog draws finite viewport coordinates and restores compositor state', () => {
  const factory = fogFactory();
  for (const config of [{ width: 1, height: 1, strength: 0.6 }, { width: 32768, height: 32768, strength: 0.6 }, { width: NaN, height: Infinity, strength: 99 }]) {
    const canvas = finiteContext(); canvas.ctx.globalAlpha = 0.19; canvas.ctx.globalCompositeOperation = 'multiply'; canvas.ctx.filter = 'none'; canvas.ctx.imageSmoothingEnabled = false;
    assert.equal(factory.player.draw(canvas.ctx, config, 3300), true);
    assert.equal(canvas.stack.length, 0); assert.equal(canvas.ctx.globalAlpha, 0.19); assert.equal(canvas.ctx.globalCompositeOperation, 'multiply'); assert.equal(canvas.ctx.filter, 'none'); assert.equal(canvas.ctx.imageSmoothingEnabled, false);
  }
  factory.player.destroy();
});

test('layered fog uses bounded independent reusable backing surfaces and releases every layer', () => {
  const factory = fogFactory(), canvas = finiteContext();
  const count = factory.textures.length;
  assert(count > 1 && count <= 3, 'layered atmosphere has a finite surface budget');
  assert.equal(new Set(factory.textures).size, count, 'depth layers must have independent surfaces');
  assert.equal(factory.player.getDiagnostics().layers, count);
  assert(factory.player.getDiagnostics().textureBytes <= 256 * 1024);
  const dimensions = factory.textures.map(texture => [texture.width, texture.height]);
  for (const time of [1200, 3100, 5100, 6450]) factory.player.draw(canvas.ctx, packet, time);
  assert.equal(factory.textures.length, count, 'time drift does not reallocate surfaces');
  assert.deepEqual(factory.textures.map(texture => [texture.width, texture.height]), dimensions);
  factory.player.destroy();
  assert(factory.textures.every(texture => texture.width === 1 && texture.height === 1));
  assert.equal(factory.player.getDiagnostics().layers, 0); assert.equal(factory.player.getDiagnostics().textureBytes, 0);
});

test('partial fog construction failures release only owned surfaces without damaging another player', () => {
  const independent = fogFactory();
  independent.player.draw(finiteContext().ctx, packet, 3300);
  for (const failure of ['factory-throws', 'null-canvas', 'null-context', 'image-data-throws', 'null-image-data']) {
    const owned = []; let calls = 0;
    assert.throws(() => fog.create({ createCanvas: () => {
      const number = ++calls;
      if (number === 2 && failure === 'factory-throws') throw new Error('synthetic factory failure');
      if (number === 2 && failure === 'null-canvas') return null;
      const texture = { width: 0, height: 0 };
      texture.getContext = () => {
        if (number === 2 && failure === 'null-context') return null;
        return { createImageData(width, height) {
          if (number === 2 && failure === 'image-data-throws') throw new Error('synthetic image buffer failure');
          if (number === 2 && failure === 'null-image-data') return null;
          return { width, height, data: new Uint8ClampedArray(width * height * 4) };
        }, putImageData() {} };
      };
      owned.push(texture); return texture;
    } }), /haunt-atmosphere-canvas-unavailable/, failure);
    assert(owned.length > 0); assert(owned.every(texture => texture.width === 1 && texture.height === 1), failure + ': leaked partial surface');
    assert.equal(independent.player.draw(finiteContext().ctx, packet, 4500), true);
    assert(independent.textures.every(texture => texture.width > 1 && texture.height > 1));
  }
  independent.player.destroy();
});

test('actual commercial matcher excludes all five new local-only Haunt files', t => {
  const root = path.resolve(__dirname, '..');
  const release = require(path.join(root, 'dev', 'commercial-release.cjs'));
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-haunt-commercial-'));
  t.after(() => {
    const resolved = path.resolve(destination);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith('tracer-haunt-commercial-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const names = ['desktop/local-vfx-haunt-v2.js', 'desktop/local-vfx-haunt-atmosphere.js', 'desktop/local-vfx-haunt-preview.html', 'desktop/local-vfx-haunt-preview.css', 'desktop/local-vfx-haunt-preview.js'];
  for (const name of names) assert(fs.statSync(path.join(root, name)).isFile(), 'candidate really exists in project: ' + name);
  const report = release.manifest(root, destination);
  for (const name of names) {
    assert(report.excludedLocalVfxFiles.includes(name), 'actual matcher reports exclusion: ' + name);
    assert(!report.files.some(entry => entry.file === name), 'candidate must not be distributed: ' + name);
  }
  assert(report.retainedExperienceAssets >= 18);
});
