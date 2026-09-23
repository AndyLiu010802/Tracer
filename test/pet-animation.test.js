'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Animation = require('../skins/tracer/pet-animation');
const source = fs.readFileSync(path.join(__dirname, '../skins/tracer/pet-animation.js'), 'utf8');
const asset = number => '/api/pet-art/' + number.toString(16).padStart(32, '0') + '.png';
const animation = () => ({ version: 1, pages: [asset(1), asset(2), asset(3), asset(4)] });
const denseAnimation = () => ({ version: 2, pages: Array.from({ length: 16 }, (_, i) => asset(i + 1)) });
const clone = value => JSON.parse(JSON.stringify(value));

function browser({ pixels, width = 1024, height = 1024, broken = false, decodeBroken = false, pixelsBroken = false, hanging = false, reduced = false, hidden = false, autoLoad = true } = {}) {
  const timers = new Map(), delays = [], documentListeners = new Map(), motionListeners = new Set(), preloads = [], revoked = []; let id = 0;
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.style = { setProperty(name, value, priority) { this[name] = value; this[name + 'Priority'] = priority; } }; }
    appendChild(child) { this.children.push(child); }
    setAttribute(key, value) { this.attributes[key] = value; if (autoLoad && this.tagName === 'img' && key === 'src') this.onload?.(); }
    getAttribute(key) { return this.attributes[key]; }
    getContext() { return { drawImage() {}, getImageData: () => { if (pixelsBroken) throw new Error('canvas-unavailable'); return { data: pixels }; } }; }
  }
  const document = {
    visibilityState: hidden ? 'hidden' : 'visible',
    createElement: tag => new Element(tag),
    addEventListener(name, fn) { if (!documentListeners.has(name)) documentListeners.set(name, new Set()); documentListeners.get(name).add(fn); },
    removeEventListener(name, fn) { documentListeners.get(name)?.delete(fn); }
  };
  const motion = { matches: reduced, addEventListener: (_name, fn) => motionListeners.add(fn), removeEventListener: (_name, fn) => motionListeners.delete(fn) };
  class Image {
    constructor() { this.naturalWidth = width; this.naturalHeight = height; preloads.push(this); }
    set src(value) { if (value && !hanging) Promise.resolve().then(() => broken ? this.onerror?.() : this.onload?.()); }
    async decode() { if (broken || decodeBroken) throw new Error('decode-failed'); }
  }
  const context = { document, Image, Blob, URL: { createObjectURL: () => 'blob:test-sheet', revokeObjectURL: value => revoked.push(value) },
    matchMedia: () => motion, setTimeout: (callback, delay) => { delays.push(delay); timers.set(++id, callback); return id; }, clearTimeout: timer => timers.delete(timer) };
  vm.runInNewContext(source, context);
  return {
    api: context.TracerPetAnimation, timers, delays, documentListeners, motionListeners, preloads, revoked,
    tick() { const next = timers.entries().next().value; if (next) { timers.delete(next[0]); next[1](); } },
    visibility(hidden) { document.visibilityState = hidden ? 'hidden' : 'visible'; for (const fn of documentListeners.get('visibilitychange') || []) fn(); },
    motion(reduced) { motion.matches = reduced; for (const fn of motionListeners) fn(); }
  };
}

function sheet(mode = 'poses') {
  const edge = 768, size = edge / 4, data = new Uint8ClampedArray(edge * edge * 4);
  function rect(x, y, width, height, color) {
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) data.set(color, (py * edge + px) * 4);
  }
  if (mode === 'opaque') { for (let i = 3; i < data.length; i += 4) data[i] = 255; return data; }
  if (mode === 'empty') return data;
  for (let row = 0; row < 4; row++) for (let frame = 0; frame < 4; frame++) {
    const x = frame * size + 55 + (mode === 'translated' ? frame * 5 : 0), y = row * size + 45;
    rect(x, y, 60, 80, [120, 90, 180, 255]);
    rect(x + 8, y + 8, 8, 8, [20, 20, 20, 255]);
    rect(x + 60, y + 30, mode === 'dense' ? 8 + (row * 4 + frame) * 2 : mode === 'dense-holds' ? 8 + Math.min(11, row * 4 + frame) * 2 : mode === 'poses' ? 10 + frame * 9 : mode === 'holds' && frame === 3 ? 37 : 10, 15, [230, 180, 100, 255]);
  }
  return data;
}

function retainedSheet(count, mode = 'poses') {
  const source = sheet(mode), edge = 768, cell = 192, result = new Uint8ClampedArray(source.length);
  for (let target = 0; target < 16; target++) {
    const frame = count === 1 ? 0 : Math.floor(target / 4);
    for (let y = 0; y < cell; y++) {
      const from = (y * edge + frame * cell) * 4;
      const to = ((Math.floor(target / 4) * cell + y) * edge + target % 4 * cell) * 4;
      result.set(source.subarray(from, from + cell * 4), to);
    }
  }
  return result;
}

test('animation manifests accept legacy and expanded packs with bounded local assets and defensive copies', () => {
  const raw = animation(), clean = Animation.normalize(raw); assert.deepEqual(clean, raw);
  raw.pages[0] = asset(4); assert.equal(clean.pages[0], asset(1));
  for (const bad of [undefined, null, [], {}, { ...animation(), version: 2 }, { ...animation(), arbitrary: true },
    { version: 1, pages: [asset(1)] }, { version: 1, pages: Array(3) }, { version: 1, pages: [...animation().pages, asset(4)] },
    ...['https://example.com/image.png', 'data:image/png;base64,AA==', '/api/pet-art/../private.png', asset(1) + '?token=x', '/api/pet-art/' + 'A'.repeat(32) + '.png'].map(url => ({ version: 1, pages: [url, asset(2), asset(3)] }))]) {
    assert.equal(Animation.normalize(bad), null);
  }
  const legacy = { version: 1, pages: animation().pages.slice(0, 3) };
  assert.deepEqual(Animation.normalize(legacy), legacy);
  assert.equal(Animation.normalize({ version: 1, pages: [...legacy.pages, 'https://example.com/extra.png'] }), null);
  const sparse = [...legacy.pages]; sparse.length = 4;
  assert.equal(Animation.normalize({ version: 1, pages: sparse }), null);
  assert.deepEqual(Animation.actions, ['idle', 'pet', 'feed', 'play', 'sleep', 'wake', 'focus', 'drag', 'fishing', 'exercise', 'farming', 'mining', 'reading', 'writing', 'crafting', 'tea']);
  assert.deepEqual([0, 1, 2, 3].map(page => Animation.actions.filter(name => Animation.clips[name].page === page).length), [4, 4, 4, 4]);
});

test('the renderer crops four true frames of each selected behavior and cleans up its timers', () => {
  const b = browser(), player = b.api.create({ image: asset(1), animation: animation(), label: 'Maple' });
  const element = player.element, image = element.children[0];
  assert.equal(element.attributes['aria-label'], 'Maple'); assert.equal(image.attributes['aria-hidden'], 'true');
  assert.equal(image.style.width, '400%'); assert.equal(image.style.maxWidth, 'none');
  assert.equal(b.timers.size, 1);
  for (const name of Animation.actions) {
    player.setAction(name); const clip = Animation.clips[name];
    if(name==='sleep'){assert.equal(element.dataset.frame,'2');assert.equal(b.timers.size,0);continue;}
    assert.deepEqual(clone(element.dataset), { action: name, page: String(clip.page), row: String(clip.row), frame: '0', playback: 'playing' });
    assert.equal(image.getAttribute('src'), asset(clip.page + 1));
    for (let frame = 1; frame <= 4; frame++) {
      b.tick(); assert.equal(element.dataset.frame, String(frame % 4));
      assert.equal(image.style.transform, 'translate(' + (-25 * (frame % 4)) + '%, ' + (-25 * clip.row) + '%)');
    }
  }
  player.setAction('__proto__'); assert.equal(element.dataset.action, 'idle');
  player.destroy(); player.destroy(); assert.equal(b.timers.size, 0); assert.equal(b.motionListeners.size, 0); assert.equal(b.documentListeners.get('visibilitychange').size, 0);
  player.setAction('play'); assert.equal(element.dataset.action, 'idle');
});

test('dense packs route every action to sixteen consecutive cells without changing legacy interpretation', () => {
  const raw = denseAnimation(), normalized = Animation.normalize(raw);
  assert.deepEqual(normalized, raw); raw.pages[0] = asset(99); assert.equal(normalized.pages[0], asset(1));
  for (const bad of [{ ...denseAnimation(), version: 1 }, { ...animation(), version: 2 },
    { version: 2, pages: denseAnimation().pages.slice(1) }, { version: 2, pages: Array(16) },
    { version: 2, pages: [...denseAnimation().pages, asset(17)] }]) assert.equal(Animation.normalize(bad), null);
  const b = browser(), player = b.api.create({ image: asset(1), animation: denseAnimation() });
  assert.equal(b.preloads.length, 1, 'opening a pack does not decode all sixteen sheets');
  const image = player.element.children[0];
  for (const [index, action] of Animation.actions.entries()) {
    player.setAction(action);
    if(action==='sleep'){assert.equal(player.element.dataset.frame,'12');assert.equal(b.timers.size,0);continue;}
    for (let frame = 0; frame < 16; frame++) {
      assert.equal(player.element.dataset.action, action);
      assert.equal(player.element.dataset.page, String(index));
      assert.equal(player.element.dataset.row, String(Math.floor(frame / 4)));
      assert.equal(player.element.dataset.frame, String(frame));
      assert.equal(image.getAttribute('src'), asset(index + 1));
      assert.equal(image.style.transform, 'translate(' + (-25 * (frame % 4)) + '%, ' + (-25 * Math.floor(frame / 4)) + '%)');
      assert.equal(b.delays.at(-1), Animation.denseClips[action].frameMs[frame]);
      b.tick();
    }
    assert.equal(player.element.dataset.frame, '0');
    const steps = Animation.denseClips[action].frameMs.slice(1, 15);
    assert.ok(steps.every(ms => ms >= 80 && ms <= 180), 'in-between poses play close together');
  }
  b.motion(true); assert.equal(b.timers.size, 0); assert.equal(player.element.dataset.frame, '0');
  b.motion(false); b.tick(); b.visibility(true); assert.equal(b.timers.size, 0);
  b.visibility(false); player.destroy(); assert.equal(b.timers.size, 0);
  const preview = b.api.createPage(asset(16), 15, { version: 2, animated: false });
  assert.equal(preview.element.dataset.action, 'tea'); preview.setAction('reading');
  assert.equal(preview.element.dataset.action, 'tea', 'single-action previews never request absent artwork');
  preview.destroy();
  assert.throws(() => b.api.createPage(asset(1), 16, { version: 2 }), /invalid-animation-sheet/);
});

test('dense validation requires real in-between poses, retaining seams and allowing a few deliberate holds', async () => {
  await browser({ pixels: sheet('dense') }).api.validatePage(asset(1), { version: 2 });
  await browser({ pixels: sheet('dense-holds') }).api.validatePage(asset(1), { version: 2 });
  for (const mode of ['poses', 'holds', 'repeated', 'translated']) {
    await assert.rejects(browser({ pixels: sheet(mode) }).api.validatePage(asset(1), { version: 2 }), /invalid-animation-sheet/, 'four pictures repeated across rows cannot pass as sixteen: ' + mode);
  }
  const crossing = sheet('dense'); paint(crossing, 60, 191, 50, 5);
  await assert.rejects(browser({ pixels: crossing }).api.validatePage(asset(1), { version: 2 }), /invalid-animation-sheet/);
  await assert.rejects(browser({ pixels: sheet('dense') }).api.validatePage(asset(1), { version: 3 }), /invalid-animation-sheet/);
});

test('retained frame metadata is bounded, copied and canonical without changing existing dense manifests', () => {
  const retainedFrames = Array(16).fill(16); retainedFrames[0] = 1; retainedFrames[4] = 4;
  const raw = { ...denseAnimation(), retainedFrames }, normalized = Animation.normalize(raw);
  assert.deepEqual(normalized, raw); retainedFrames[0] = 16; assert.equal(normalized.retainedFrames[0], 1);
  assert.deepEqual(Animation.normalize({ ...denseAnimation(), retainedFrames: Array(16).fill(16) }), denseAnimation());
  for (const value of [undefined, null, [], Array(15).fill(4), Array(17).fill(4), Array(16), Array(16).fill(0), Array(16).fill(2), Array(16).fill('4')])
    assert.equal(Animation.normalize({ ...denseAnimation(), retainedFrames: value }), null);
  assert.equal(Animation.normalize({ ...animation(), retainedFrames: Array(16).fill(4) }), null);
});

test('retained legacy motion keeps the original loop duration and static actions do not schedule duplicate frames', () => {
  const b = browser(), retainedFrames = Array(16).fill(16); retainedFrames[0] = 4; retainedFrames[1] = 1;
  const player = b.api.create({ image: asset(1), animation: { ...denseAnimation(), retainedFrames } });
  let elapsed = 0;
  for (let frame = 0; frame < 16; frame++) { elapsed += b.delays.at(-1); b.tick(); }
  assert.equal(elapsed, Animation.clips.idle.frameMs.reduce((total, value) => total + value, 0));
  assert.equal(player.element.dataset.frame, '0');
  player.setAction('pet'); assert.equal(b.timers.size, 0); assert.equal(player.element.dataset.playback, 'static');
  player.setAction('feed'); assert.equal(b.timers.size, 1); assert.equal(b.delays.at(-1), Animation.denseClips.feed.frameMs[0]);
  player.destroy();
  const preview = b.api.createPage(asset(5), 4, { version: 2, retainedFrames: 4 });
  assert.equal(preview.element.dataset.frame,'8');assert.equal(b.timers.size,0);
  preview.destroy();
});

test('converted legacy sheets require the declared exact repeat layout and never pass strict new-pose validation', async () => {
  for (const mode of ['poses', 'repeated', 'translated']) {
    const pixels = retainedSheet(4, mode);
    await browser({ pixels }).api.validatePage(asset(1), { version: 2, retainedFrames: 4 });
    await assert.rejects(browser({ pixels }).api.validatePage(asset(1), { version: 2 }), /invalid-animation-sheet/);
  }
  const portrait = retainedSheet(1);
  await browser({ pixels: portrait }).api.validatePage(asset(1), { version: 2, retainedFrames: 1 });
  await assert.rejects(browser({ pixels: portrait }).api.validatePage(asset(1), { version: 2 }), /invalid-animation-sheet/);
  await assert.rejects(browser({ pixels: retainedSheet(4) }).api.validatePage(asset(1), { version: 2, retainedFrames: 1 }), /invalid-animation-sheet/);
  await assert.rejects(browser({ pixels: sheet('poses') }).api.validatePage(asset(1), { version: 2, retainedFrames: 4 }), /invalid-animation-sheet/, 'interleaving old poses is not the declared consecutive-repeat encoding');
  await assert.rejects(browser({ pixels: sheet('dense') }).api.validatePage(asset(1), { version: 2, retainedFrames: 4 }), /invalid-animation-sheet/, 'metadata cannot waive mismatched frame content');
});

test('converted legacy validation preserves transparency, visible content and frame boundary checks', async () => {
  const crossing = retainedSheet(4); paint(crossing, 60, 191, 50, 5);
  const changedCopy = retainedSheet(1); paint(changedCopy, 250, 120, 1, 1);
  for (const pixels of [crossing, sheet('empty'), sheet('opaque'), changedCopy])
    await assert.rejects(browser({ pixels }).api.validatePage(asset(1), { version: 2, retainedFrames: 1 }), /invalid-animation-sheet/);
  for (const retainedFrames of [0, 2, 12, 17, '4', null, [], {}])
    await assert.rejects(browser({ pixels: retainedSheet(4) }).api.validatePage(asset(1), { version: 2, retainedFrames }), /invalid-animation-sheet/);
  await assert.rejects(browser({ pixels: sheet() }).api.validatePage(asset(1), { version: 1, retainedFrames: 4 }), /invalid-animation-sheet/);
});

test('blob import validation uses explicit retained counts and revokes object URLs on success and failure', async () => {
  const b = browser({ pixels: retainedSheet(4) }), blob = new Blob(['synthetic decoded fixture'], { type: 'image/png' });
  await b.api.validateBlob(blob, { version: 2, retainedFrames: 4 });
  await assert.rejects(b.api.validateBlob(blob, { version: 2 }), /invalid-animation-sheet/);
  assert.deepEqual(b.revoked, ['blob:test-sheet', 'blob:test-sheet']);
});

test('hidden and reduced-motion views pause without losing their current action; static page previews do not animate', () => {
  const b = browser(), player = b.api.create({ image: asset(1), animation: animation() });
  player.setAction('mining'); b.tick(); assert.equal(player.element.dataset.frame, '1');
  b.visibility(true); assert.equal(b.timers.size, 0); assert.equal(player.element.dataset.playback, 'hidden');
  b.visibility(false); assert.equal(b.timers.size, 1); b.tick(); assert.equal(player.element.dataset.frame, '2');
  b.motion(true); assert.equal(b.timers.size, 0); assert.equal(player.element.dataset.frame, '0'); assert.equal(player.element.dataset.action, 'mining');
  player.setAction('sleep'); assert.equal(player.element.dataset.row, '0'); assert.equal(player.element.dataset.page, '1'); assert.equal(player.element.dataset.playback, 'reduced-motion');
  b.motion(false); assert.equal(b.timers.size, 0); assert.equal(player.element.dataset.frame,'2'); player.destroy();
  const preview = b.api.createPage(asset(3), 2, { animated: false });
  assert.equal(b.documentListeners.get('visibilitychange').size, 0); assert.equal(b.motionListeners.size, 0);
  assert.equal(preview.element.style.width, undefined); assert.equal(preview.element.style.height, undefined, 'CSS controls main, collection and preview sizing');
  assert.equal(preview.element.dataset.action, 'fishing'); preview.setAction('farming');
  assert.equal(preview.element.dataset.action, 'farming'); assert.equal(preview.element.dataset.row, '2'); assert.equal(b.timers.size, 0);
  preview.setAction('feed'); assert.equal(preview.element.dataset.action, 'fishing'); preview.destroy();
  assert.throws(() => b.api.create({ image: asset(9), animation: animation() }), /invalid-animation-sheet/);
  assert.throws(() => b.api.createPage(asset(1), 4), /invalid-animation-sheet/);
});

test('work loops have deliberate holds and legacy packs never request missing work artwork', () => {
  const b = browser(), player = b.api.create({ image: asset(1), animation: animation() });
  for (const action of Animation.actions.slice(8)) {
    player.setAction(action);
    const delays = [];
    for (let frame = 0; frame < 4; frame++) { delays.push(b.delays.at(-1)); b.tick(); }
    assert.deepEqual(delays, Animation.clips[action].frameMs);
    assert.ok(delays.reduce((a, v) => a + v, 0) >= 5500, action + ' has a quiet work cycle');
    assert.ok(delays[0] > delays[1], action + ' pauses before acting');
    assert.equal(player.element.dataset.frame, '0');
  }
  player.destroy();
  const legacy = b.api.create({ image: asset(1), animation: { version: 1, pages: animation().pages.slice(0, 3) } });
  legacy.setAction('reading'); assert.equal(legacy.element.dataset.action, 'idle');
  legacy.setAction('farming'); assert.equal(legacy.element.dataset.action, 'farming');
  legacy.destroy();
});

test('missing displayed pages fall back once, show an accessible star if necessary, and only retry on action changes', () => {
  const b = browser({ autoLoad: false }), errors = [];
  const player = b.api.create({ image: asset(1), animation: animation(), label: 'Maple', onError: error => errors.push(clone(error)) });
  const element = player.element, [image, placeholder] = element.children;
  for (const preload of b.preloads) preload.onerror?.();
  assert.deepEqual(errors, [], 'preload errors never report a displayed action failure');
  player.setAction('sleep'); const failedRequestLoad = image.onload;
  image.onerror();
  assert.deepEqual(errors, [{ page: 1, action: 'sleep' }]);
  assert.equal(image.getAttribute('src'), asset(1)); assert.equal(element.dataset.action, 'idle'); assert.equal(element.dataset.frame, '0');
  assert.equal(element.dataset.error, 'image-unavailable'); assert.equal(b.timers.size, 0);
  const fallbackLoad = image.onload;
  player.setAction('sleep'); assert.equal(image.onload, fallbackLoad, 'repeated failed-action snapshots cannot restart requests');
  failedRequestLoad(); assert.equal(element.dataset.error, 'image-unavailable', 'stale events cannot clear a newer failure');
  image.onerror();
  assert.deepEqual(errors.at(-1), { page: 0, action: 'idle' });
  assert.equal(placeholder.textContent, '✦'); assert.equal(placeholder.style.display, 'flex'); assert.equal(image.style.display, 'none');
  assert.match(element.getAttribute('aria-label'), /Maple.*artwork unavailable/); assert.equal(element.dataset.playback, 'image-unavailable');
  b.motion(true); b.motion(false); b.visibility(true); b.visibility(false); assert.equal(b.timers.size, 0);
  player.setAction('pet'); assert.equal(image.getAttribute('src'), asset(1)); assert.notEqual(image.onload, fallbackLoad, 'a changed action can explicitly retry the same page');
  image.onload(); assert.equal(element.dataset.error, undefined); assert.equal(element.getAttribute('aria-label'), 'Maple');
  assert.equal(placeholder.style.display, 'none'); assert.equal(image.style.display, 'block'); assert.equal(b.timers.size, 1);
  player.setAction('sleep'); image.onload(); assert.equal(b.timers.size,0); assert.equal(element.dataset.action, 'sleep'); assert.equal(element.dataset.frame, '2');
  const lateError = image.onerror; player.destroy(); lateError();
  assert.equal(image.onload, null); assert.equal(image.onerror, null); assert.equal(b.timers.size, 0); assert.equal(errors.length, 2);
});

test('a single-page preview shows a placeholder when unavailable without retrying absent page zero', () => {
  const b = browser(), errors = [], player = b.api.createPage(asset(3), 2, { animated: false, onError: error => errors.push(clone(error)) });
  const [image, placeholder] = player.element.children;
  image.onerror();
  assert.deepEqual(errors, [{ page: 2, action: 'fishing' }]); assert.equal(image.getAttribute('src'), asset(3));
  assert.equal(placeholder.style.display, 'flex'); assert.equal(b.timers.size, 0); assert.equal(b.documentListeners.size, 0);
  player.destroy();
});

test('slow page changes hide the previous bitmap and only start playback for the latest loaded page', () => {
  const b = browser({ autoLoad: false }), player = b.api.create({ image: asset(1), animation: animation() });
  const element = player.element, image = element.children[0];
  assert.equal(element.dataset.playback, 'loading'); assert.equal(b.timers.size, 0);
  image.onload(); b.tick(); assert.equal(element.dataset.frame, '1');
  player.setAction('sleep'); const oldLoad = image.onload;
  assert.equal(image.style.visibility, 'hidden'); assert.equal(element.dataset.playback, 'loading'); assert.equal(b.timers.size, 0);
  player.setAction('exercise'); oldLoad();
  assert.equal(image.style.visibility, 'hidden', 'stale completion must not expose the old bitmap');
  player.setAction('mining');
  assert.equal(element.dataset.frame, '0'); assert.equal(b.timers.size, 0, 'same-page action changes wait for decoding');
  image.onload(); assert.equal(image.style.visibility, 'visible'); assert.equal(element.dataset.action, 'mining');
  assert.equal(image.style.transform, 'translate(0%, -75%)'); assert.equal(b.timers.size, 1);
  const lateLoad = image.onload; player.destroy(); lateLoad(); assert.equal(b.timers.size, 0);
});

function paint(data, x, y, width, height, alpha = 255) {
  for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) data.set([20, 130, 240, alpha], (py * 768 + px) * 4);
}

test('legacy rendering masks only small separated strips continuing from an adjacent cell', () => {
  const cases = [
    { side: 0, rect: [250, 188, 50, 10] },
    { side: 1, rect: [378, 250, 10, 30] },
    { side: 2, rect: [250, 378, 50, 10] },
    { side: 3, rect: [188, 250, 10, 30] }
  ];
  for (const { side, rect } of cases) {
    const pixels = sheet(); paint(pixels, ...rect); const original = pixels.slice();
    const b = browser({ pixels }), player = b.api.create({ image: asset(1), animation: animation() });
    player.setAction('pet'); b.tick();
    const insets = player.element.style.clipPath.match(/[\d.]+/g).map(Number);
    const conversionInsets = clone(b.api.frameInsetsForImage(player.element.children[0]));
    assert.equal(conversionInsets.length, 16);
    assert.deepEqual(conversionInsets[5], insets.map(value => value / 100), 'conversion uses precisely the player mask in full-cell coordinates');
    assert.ok(insets[side] > 0 && insets[side] <= 8, 'masks the contaminated edge ' + side);
    assert.ok(insets.every((value, index) => index === side || value === 0));
    assert.deepEqual(pixels, original, 'saved artwork is never edited');
    assert.equal(player.element.children[0].style.transform, 'translate(-25%, -25%)', 'pose baseline and scale stay fixed');
    b.tick(); b.tick(); assert.equal(player.element.style.clipPath, 'inset(0% 0% 0% 0%)', 'an unaffected frame keeps its full boundary');
    player.destroy();
  }
  for (const rects of [
    [[250, 194, 20, 6]], // A contained floating prop.
    [[250, 192, 20, 6]], // A prop touching an edge, with no neighboring continuation.
    [[250, 188, 20, 70]], // An ear or tail connected to the body.
    [[220, 188, 140, 20]], // Too much artwork to safely remove.
    [[250, 188, 50, 10], [220, 198, 8, 20]] // Another prop occupies the apparent gap.
  ]) {
    const pixels = sheet(); for (const rect of rects) paint(pixels, ...rect);
    const b = browser({ pixels }), player = b.api.create({ image: asset(1), animation: animation() });
    player.setAction('pet'); b.tick();
    assert.equal(player.element.style.clipPath, 'inset(0% 0% 0% 0%)', 'ambiguous or connected artwork is preserved');
    assert.deepEqual(clone(b.api.frameInsetsForImage(player.element.children[0]))[5], [0, 0, 0, 0], 'conversion also preserves ambiguous or connected artwork');
    player.destroy();
  }
});

test('new atlases reject opaque boundary strips but allow transparent padding and faint edge noise', async () => {
  const contaminated = sheet(); paint(contaminated, 55, 192, 92, 6);
  await assert.rejects(browser({ pixels: contaminated }).api.validatePage(asset(1)), /invalid-animation-sheet/);
  const cutTail = sheet(); paint(cutTail, 55, 191, 8, 56);
  await assert.rejects(browser({ pixels: cutTail }).api.validatePage(asset(1)), /invalid-animation-sheet/);
  const faint = sheet(); paint(faint, 55, 192, 92, 1, 15);
  await browser({ pixels: faint }).api.validatePage(asset(1));
});

test('transparent atlases need visible distinct poses in every row, not repeated or translated portraits', async () => {
  const valid = browser({ pixels: sheet() });
  assert.deepEqual(clone(await valid.api.validatePage(asset(1))), { width: 1024, height: 1024, columns: 4, rows: 4, frames: 16 });
  assert.equal(valid.timers.size, 0);
  await browser({ pixels: sheet('holds') }).api.validatePage(asset(1));
  for (const mode of ['empty', 'opaque', 'repeated', 'translated']) {
    await assert.rejects(browser({ pixels: sheet(mode) }).api.validatePage(asset(1)), /invalid-animation-sheet/, mode);
  }
  const transparentNoise = sheet('repeated');
  for (let i = 0; i < transparentNoise.length; i += 4) if (!transparentNoise[i + 3]) transparentNoise[i] = (i / 4) % 255;
  await assert.rejects(browser({ pixels: transparentNoise }).api.validatePage(asset(1)), /invalid-animation-sheet/);
});

test('animation page validation rejects invalid assets and undersized or nonsquare sheets', async () => {
  for (const dimensions of [{ width: 767 }, { height: 600 }, { width: 1600, height: 1024 }, { width: 4097, height: 4097 }]) {
    await assert.rejects(browser({ pixels: sheet(), ...dimensions }).api.validatePage(asset(1)), /invalid-animation-sheet/);
  }
  await assert.rejects(browser().api.validatePage('https://example.com/photo.png'), /invalid-animation-sheet/);
  await assert.rejects(Animation.validatePage(asset(1)), /invalid-animation-sheet/, 'Node callers cannot bypass browser decoding');
});

test('image loading, decoding and pixel-read failures remain retryable without declaring the cached artwork invalid', async () => {
  for (const failure of [{ broken: true }, { decodeBroken: true }, { pixelsBroken: true }]) {
    const b = browser({ pixels: sheet('dense'), ...failure });
    await assert.rejects(b.api.validatePage(asset(1), { version: 2 }), /animation-load-failed/);
    assert.equal(b.timers.size, 0);
    const blob = new Blob(['synthetic fixture'], { type: 'image/png' });
    await assert.rejects(b.api.validateBlob(blob, { version: 2 }), /animation-load-failed/);
    assert.deepEqual(b.revoked, ['blob:test-sheet']);
  }
  const delayed = browser({ hanging: true }), pending = delayed.api.validatePage(asset(1), { version: 2 });
  delayed.tick(); await assert.rejects(pending, /animation-load-failed/); assert.equal(delayed.timers.size, 0);
});
