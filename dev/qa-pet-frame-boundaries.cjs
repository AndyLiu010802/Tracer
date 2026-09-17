'use strict';
// Browser regression QA for generated frame boundaries. All default artwork is synthetic.
// Optional TRACER_QA_SPRITE_ATLAS is read once, never edited or copied into QA artifacts.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const artPath = number => '/api/pet-art/' + number.toString(16).padStart(32, '0') + '.png';

async function fixtures(page) {
  const encoded = await page.evaluate(() => {
    const edge = 768, cell = edge / 4;
    const modes = ['clean', 'top', 'contained', 'unmatched', 'connected', 'bottom', 'left', 'right'];
    return Object.fromEntries(modes.map(mode => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = edge;
      const context = canvas.getContext('2d');
      const box = (color, x, y, width, height) => { context.fillStyle = color; context.fillRect(x, y, width, height); };
      for (let row = 0; row < 4; row++) for (let frame = 0; frame < 4; frame++) {
        const x = frame * cell, y = row * cell;
        box('#b87830', x + 58, y + 52, 76, 106);
        box('#f1d5a0', x + 68, y + 72, 6 + frame * 4, 6);
        // A separate legitimate book/prop remains inside each cell's safe margin.
        box('#83b84f', x + 28, y + 142, 16, 12);
      }
      const x = cell, y = cell; // Test the second frame of the second action.
      if (mode === 'top' || mode === 'connected') box('#2288dd', x + 62, y - 8, 64, 14);
      if (mode === 'contained') box('#2288dd', x + 62, y + 4, 64, 6);
      if (mode === 'unmatched') box('#2288dd', x + 62, y, 64, 6);
      if (mode === 'connected') box('#b87830', x + 90, y + 6, 6, 46);
      if (mode === 'bottom') box('#2288dd', x + 62, y + cell - 6, 64, 14);
      if (mode === 'left') box('#2288dd', x - 8, y + 70, 14, 54);
      if (mode === 'right') box('#2288dd', x + cell - 6, y + 70, 14, 54);
      return [mode, canvas.toDataURL('image/png').split(',')[1]];
    }));
  });
  return Object.fromEntries(Object.entries(encoded).map(([key, value]) => [key, Buffer.from(value, 'base64')]));
}

async function mount(page, image, { size = 192, animated = true, full = false } = {}) {
  await page.evaluate(({ image, size, animated, full }) => {
    window.__player?.destroy(); document.body.replaceChildren();
    const options = { image, animated, ...(full ? { animation: { version: 1, pages: [image, window.__slowImage, window.__thirdImage] } } : {}) };
    window.__player = full ? TracerPetAnimation.create(options) : TracerPetAnimation.createPage(image, 0, options);
    Object.assign(__player.element.style, { width: size + 'px', height: size + 'px' });
    document.body.appendChild(__player.element);
  }, { image, size, animated, full });
  await page.waitForFunction(() => {
    const image = __player.element.querySelector('img');
    return image.complete && image.naturalWidth > 0 && image.checkVisibility({ checkVisibilityCSS: true });
  });
}

async function secondFrame(page) {
  await page.evaluate(() => { __player.setAction('pet'); __tick(); });
  assert.equal(await page.locator('.pet-animated-sprite').getAttribute('data-frame'), '1');
}

async function snapshot(page) {
  const element = page.locator('.pet-animated-sprite');
  const dom = await element.evaluate(element => {
    const rect = element.getBoundingClientRect(), image = element.querySelector('img');
    const values = (element.style.clipPath.match(/-?\d+(?:\.\d+)?/g) || ['0']).map(Number);
    const clip = values.length === 1 ? Array(4).fill(values[0]) : values.length === 2 ? [...values, ...values] : values.length === 3 ? [...values, values[1]] : values;
    return { width: rect.width, height: rect.height, clip, clipPath: element.style.clipPath,
      transform: image.style.transform, dataset: { ...element.dataset } };
  });
  const png = await element.screenshot({ omitBackground: true });
  const pixels = await page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const groups = { body: [184, 120, 48], spill: [34, 136, 221], prop: [131, 184, 79], blue: null };
    const result = {};
    for (const [key, color] of Object.entries(groups)) {
      let count = 0, minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const at = (y * canvas.width + x) * 4;
        const matches = color ? color.every((value, channel) => Math.abs(value - data[at + channel]) <= 2) :
          data[at + 2] > 80 && data[at + 2] > data[at] * 1.4 && data[at + 2] > data[at + 1] * 1.1;
        if (data[at + 3] > 200 && matches) {
          count++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
      result[key] = { count, minX, minY, maxX, maxY };
    }
    // Compare unchanged real character pixels below the narrow suspect edge band.
    const below = document.createElement('canvas'), start = Math.ceil(canvas.height * .1);
    below.width = canvas.width; below.height = canvas.height - start;
    below.getContext('2d').drawImage(image, 0, start, canvas.width, below.height, 0, 0, below.width, below.height);
    result.belowTrimPixels = below.toDataURL('image/png');
    return result;
  }, png.toString('base64'));
  return { ...dom, pixels };
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [], resources = new Map();
  page.on('pageerror', error => errors.push(error.message));
  let releaseSlow, slowRequested = false;
  const slowReady = new Promise(resolve => { releaseSlow = resolve; });
  const slowImage = artPath(99), thirdImage = artPath(100);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://tracer-frame-qa.test') return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>html,body{margin:0;background:transparent}</style>' });
    if (url.pathname === slowImage) { slowRequested = true; await slowReady; }
    const body = resources.get(url.pathname);
    return body ? route.fulfill({ contentType: 'image/png', body }) : route.fulfill({ status: 404, body: 'Not found' });
  });
  try {
    await page.goto('http://tracer-frame-qa.test/');
    const art = await fixtures(page), paths = {};
    Object.entries(art).forEach(([mode, bytes], index) => { paths[mode] = artPath(index + 1); resources.set(paths[mode], bytes); });
    resources.set(slowImage, art.clean); resources.set(thirdImage, art.clean);
    await page.evaluate(({ slowImage, thirdImage }) => {
      window.__slowImage = slowImage; window.__thirdImage = thirdImage;
      window.__timers = new Map(); let id = 0;
      window.setTimeout = (callback, delay) => { __timers.set(++id, { callback, delay }); return id; };
      window.clearTimeout = id => __timers.delete(id);
      window.__tick = () => {
        const entry = __timers.entries().next().value;
        if (!entry) throw new Error('Expected a scheduled animation frame');
        __timers.delete(entry[0]); entry[1].callback();
      };
    }, { slowImage, thirdImage });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'skins/tracer/pet-animation.js'), 'utf8') });

    const validation = await page.evaluate(async paths => {
      const result = {};
      for (const mode of ['clean', 'top', 'bottom', 'left', 'right']) {
        try { await TracerPetAnimation.validatePage(paths[mode]); result[mode] = 'valid'; }
        catch (error) { result[mode] = error.message; }
      }
      return result;
    }, paths);
    assert.equal(validation.clean, 'valid', 'ordinary separated props are accepted');
    for (const mode of ['top', 'bottom', 'left', 'right']) assert.equal(validation[mode], 'invalid-animation-sheet', mode + ' cross-cell content cannot enter new packs');

    for (const size of [134.4, 192, 345.6]) {
      await mount(page, paths.clean, { size }); await secondFrame(page);
      const baseline = await snapshot(page);
      for (const mode of ['top', 'bottom', 'left', 'right']) {
        await mount(page, paths[mode], { size }); await secondFrame(page);
        const clipped = await snapshot(page), side = { top: 0, right: 1, bottom: 2, left: 3 }[mode];
        assert.ok(clipped.clip[side] > 0 && clipped.clip[side] <= 8, mode + ' uses a bounded adaptive edge clip');
        assert.equal(clipped.pixels.spill.count, 0, mode + ' blue neighbor strip disappears at size ' + size);
        assert.deepEqual(clipped.pixels.body, baseline.pixels.body, mode + ' preserves body pixels, scale and baseline at size ' + size);
        assert.deepEqual(clipped.pixels.prop, baseline.pixels.prop, mode + ' preserves separate normal prop');
        assert.equal(clipped.transform, baseline.transform, mode + ' keeps original atlas frame positioning');
        assert.equal(clipped.width, baseline.width); assert.equal(clipped.height, baseline.height);
        await page.evaluate(() => { __tick(); __tick(); });
        const nextClip = await page.locator('.pet-animated-sprite').evaluate(element => element.style.clipPath);
        assert.ok(!nextClip || !(nextClip.match(/-?\d+(?:\.\d+)?/g) || []).some(value => Number(value) !== 0), 'clean frame three resets clipping');
      }
    }
    for (const mode of ['contained', 'unmatched', 'connected']) {
      await mount(page, paths[mode]); await secondFrame(page);
      const preserved = await snapshot(page);
      assert.ok(preserved.clip.every(value => value === 0), mode + ' is preserved without automatic clipping');
      assert.ok(preserved.pixels.spill.count > 0, mode + ' artwork remains visible');
    }
    console.log('PASS new-sheet rejection; four-edge spill removal; original body/prop pixels and baseline at 70/100/180%; contained/unmatched/connected artwork preservation');

    await mount(page, paths.clean, { full: true });
    await page.evaluate(() => __player.setAction('sleep'));
    await page.waitForFunction(() => __player.element.dataset.action === 'sleep');
    assert.equal(await page.locator('.pet-animation-sheet').evaluate(image => image.checkVisibility({ checkVisibilityCSS: true })), false, 'old bitmap is hidden while a new page loads');
    assert.equal(await page.evaluate(() => __timers.size), 0, 'frames wait for the selected page to load');
    // Change the requested row before the delayed page arrives. The latest action wins.
    await page.evaluate(() => __player.setAction('focus'));
    assert.equal(await page.locator('.pet-animation-sheet').evaluate(image => image.checkVisibility({ checkVisibilityCSS: true })), false);
    releaseSlow();
    await page.waitForFunction(() => {
      const image = __player.element.querySelector('img');
      return image.complete && image.naturalWidth > 0 && image.checkVisibility({ checkVisibilityCSS: true });
    });
    assert.ok(slowRequested, 'delayed page path was requested');
    assert.equal(await page.locator('.pet-animated-sprite').getAttribute('data-action'), 'focus');
    assert.equal(await page.locator('.pet-animated-sprite').getAttribute('data-row'), '2');
    assert.equal(await page.evaluate(() => __timers.size), 1, 'one animation timer resumes after load');
    await page.evaluate(() => { __tick(); __player.destroy(); });
    assert.equal(await page.evaluate(() => __timers.size), 0, 'destroy cleans up playback');
    console.log('PASS delayed page loads hide stale artwork, honor the latest selected action, and resume one timer');

    if (process.env.TRACER_QA_SPRITE_ATLAS) {
      const realImage = artPath(101), sourceFile = path.resolve(process.env.TRACER_QA_SPRITE_ATLAS);
      resources.set(realImage, fs.readFileSync(sourceFile));
      await mount(page, realImage);
      await page.evaluate(() => __player.setAction('pet'));
      const clips = [];
      for (let frame = 0; frame < 4; frame++) {
        const value = await page.locator('.pet-animated-sprite').evaluate(element => ({ frame: element.dataset.frame, clip: element.style.clipPath }));
        await page.locator('.pet-animated-sprite').evaluate(element => { element.style.clipPath = 'none'; });
        const before = await snapshot(page);
        await page.locator('.pet-animated-sprite').evaluate((element, clip) => { element.style.clipPath = clip; }, value.clip);
        const after = await snapshot(page);
        assert.ok(before.pixels.blue.count > 0, 'screenshot frame ' + frame + ' reproduces the blue strip');
        assert.equal(after.pixels.blue.count, 0, 'screenshot frame ' + frame + ' removes the blue strip');
        assert.equal(after.pixels.belowTrimPixels, before.pixels.belowTrimPixels, 'screenshot frame ' + frame + ' keeps every character pixel below the edge band');
        assert.equal(after.transform, before.transform, 'screenshot frame ' + frame + ' does not move the character');
        clips.push({ ...value, bluePixelsBefore: before.pixels.blue.count, bluePixelsAfter: after.pixels.blue.count });
        await page.evaluate(() => __tick());
      }
      assert.ok(clips.some(value => (value.clip.match(/-?\d+(?:\.\d+)?/g) || []).some(part => Number(part) > 0)), 'supplied screenshot atlas has an isolated boundary fragment removed');
      console.log('PASS optional read-only screenshot atlas: ' + JSON.stringify(clips));
    }
    assert.deepEqual(errors, [], 'no renderer errors');
  } finally {
    releaseSlow(); await context.close(); await browser.close();
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
