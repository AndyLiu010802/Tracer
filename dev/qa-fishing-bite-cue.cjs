'use strict';

// Production renderers and styles, deterministic snapshots, no account or save data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const F = require('../public/fishing-model');
const assets = path.resolve(__dirname, '../skins/tracer');
const output = fs.mkdtempSync(path.resolve(__dirname, '../.cache/fishing-bite-cue-'));
const assetURL = '/fishing-art/bite-hooked-gold-v1.png';
const origin = 'http://bite-cue.test';
const panelHTML = '<!doctype html><meta charset="utf-8"><title>Bite cue review</title>' +
  '<link rel="stylesheet" href="/fishing-scene.css"><style>body{margin:0;padding:20px;background:#21342e}#game{width:760px}</style><main id="game"></main>' +
  ['fishing-model', 'fishing-lighting', 'fishing-art', 'fishing-rod-effects', 'fishing-motion', 'fishing-rod-renderer', 'fishing-game'].map(name => '<script src="/' + name + '.js"></script>').join('');
const rod = F.catalog.rods.find(item => item.id === 'bamboo');
const snapshot = phase => ({
  language: 'zh', rod, bait: F.catalog.baits[0], catalog: F.catalog,
  session: { id: 'bite-cue-review', phase, castPower: .65, castDistance: .65, biteWindow: 1700, biteRemaining: 1300, stamina: .8, barSize: .25, barPosition: .5, fishPosition: .6, progress: .35, tension: .2, fishBehavior: 'cruise' }
});

async function configure(page, errors, failed) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push([response.status(), response.url()]); });
  await page.addInitScript(() => {
    let now = 100, id = 0;
    const frames = new Map();
    Object.defineProperty(performance, 'now', { value: () => now });
    window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
    window.cancelAnimationFrame = value => frames.delete(value);
    window.advanceBiteReview = milliseconds => {
      now += milliseconds;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(now));
    };
    window.FishingDesktop = {
      send() {},
      onSnapshot(callback) { window.receiveBiteReview = callback; return () => {}; },
      onMenuAction() { return () => {}; }
    };
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/panel') return route.fulfill({ contentType: 'text/html', body: panelHTML });
    const file = path.resolve(assets, '.' + url.pathname);
    if (!file.startsWith(assets + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
    return route.fulfill({ path: file });
  });
}

async function phase(page, mode, value) {
  await page.evaluate(({ mode, value }) => {
    if (mode === 'desktop') receiveBiteReview(value);
    else reviewGame.update(value);
    advanceBiteReview(600);
    advanceBiteReview(16);
  }, { mode, value: snapshot(value) });
}

async function inspectImage(page, selector) {
  await page.waitForFunction(selector => {
    const image = document.querySelector(selector);
    return image?.complete && image.naturalWidth > 0;
  }, selector);
  const pixels = await page.locator(selector).evaluate(image => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0, visible = 0, opaqueWhite = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) transparent++;
      if (data[i + 3] > 64) visible++;
      if (data[i] > 248 && data[i + 1] > 248 && data[i + 2] > 248 && data[i + 3] > 248) opaqueWhite++;
    }
    const corners = [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]].map(([x, y]) => data[(y * canvas.width + x) * 4 + 3]);
    const count = canvas.width * canvas.height;
    return { source: new URL(image.currentSrc).pathname, width: canvas.width, height: canvas.height, transparentFraction: transparent / count, visibleFraction: visible / count, opaqueWhiteFraction: opaqueWhite / count, corners };
  });
  assert.equal(pixels.source, assetURL);
  assert(pixels.transparentFraction > .15, 'the lettering has a transparent surround, not an opaque background');
  assert(pixels.visibleFraction > .05, 'the transparent artwork contains visible lettering');
  assert(pixels.corners.every(alpha => alpha < 8), 'all artwork corners are transparent');
  assert(pixels.opaqueWhiteFraction < .05, 'no large white background is baked into the artwork');
  return pixels;
}

async function measure(page, mode, expectedHeight) {
  const selectors = mode === 'desktop'
    ? { cue: '#fishing-bite', bobber: '#fishing-float' }
    : { cue: '.fishing-game-bite', bobber: '.fishing-game-bobber' };
  const result = await page.evaluate(({ cue, bobber }) => {
    const marker = document.querySelector(cue), image = marker.querySelector('.fishing-bite-art');
    const a = image.getBoundingClientRect(), b = document.querySelector(bobber).getBoundingClientRect(), c = marker.getBoundingClientRect();
    return {
      imageHeight: a.height, imageWidth: a.width, markerWidth: c.width,
      centerError: a.x + a.width / 2 - (b.x + b.width / 2),
      gapAboveBobber: b.top - a.bottom,
      left: a.left, right: a.right, top: a.top, bottom: a.bottom,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      animations: marker.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length
    };
  }, selectors);
  assert(Math.abs(result.imageHeight - expectedHeight) < .6, mode + ' preserves the previous exclamation height: ' + JSON.stringify(result));
  assert(Math.abs(result.centerError) <= 1, mode + ' gold lettering is centered directly over the bobber: ' + JSON.stringify(result));
  assert(result.gapAboveBobber >= -1, mode + ' lettering stays above the float');
  assert(result.left >= -1 && result.right <= result.viewportWidth + 1 && result.top >= -1, mode + ' lettering is not clipped by the viewport');
  return result;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], failed = [], checks = [];
  let artwork;
  try {
    const desktop = await browser.newPage({ viewport: { width: 304, height: 208 }, deviceScaleFactor: 2 });
    await configure(desktop, errors, failed);
    await desktop.goto(origin + '/fishing-desktop.html');
    for (const scale of [1, .5, 2.5]) {
      await desktop.setViewportSize({ width: Math.round(304 * scale), height: Math.round(208 * scale) });
      await phase(desktop, 'desktop', 'waiting');
      assert.equal(await desktop.locator('#fishing-bite .fishing-bite-art').isVisible(), false, 'waiting does not display the bite text');
      await phase(desktop, 'desktop', 'bite');
      assert.equal(await desktop.locator('#fishing-bite .fishing-bite-art').isVisible(), true);
      artwork = await inspectImage(desktop, '#fishing-bite .fishing-bite-art');
      const measures = [];
      for (const milliseconds of [16, 100, 240]) {
        await desktop.evaluate(milliseconds => advanceBiteReview(milliseconds), milliseconds);
        measures.push(await measure(desktop, 'desktop', 25 * .8 * scale));
      }
      await desktop.screenshot({ path: path.join(output, 'desktop-bite-' + scale + '.png'), omitBackground: true });
      await phase(desktop, 'desktop', 'reeling');
      assert.equal(await desktop.locator('#fishing-bite .fishing-bite-art').isVisible(), false, 'the cue clears when reeling begins');
      checks.push({ mode: 'desktop', scale, measures });
    }
    await desktop.emulateMedia({ reducedMotion: 'reduce' });
    await phase(desktop, 'desktop', 'bite');
    const quietDesktop = await measure(desktop, 'desktop', 50);
    assert.equal(quietDesktop.animations, 0, 'desktop reduced motion stops the cue bounce');
    await desktop.screenshot({ path: path.join(output, 'desktop-bite-reduced.png'), omitBackground: true });
    checks.push({ mode: 'desktop', reducedMotion: true, measure: quietDesktop });
    await desktop.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
    await desktop.close();

    const panel = await browser.newPage({ viewport: { width: 800, height: 720 }, deviceScaleFactor: 2 });
    await configure(panel, errors, failed);
    await panel.goto(origin + '/panel');
    await panel.evaluate(() => { window.reviewGame = TracerFishingGame.create(document.getElementById('game')); });
    for (const width of [760, 380]) {
      await panel.setViewportSize({ width: width + 40, height: 720 });
      await panel.locator('#game').evaluate((node, width) => { node.style.width = width + 'px'; }, width);
      await phase(panel, 'panel', 'waiting');
      assert.equal(await panel.locator('.fishing-game-bite .fishing-bite-art').isVisible(), false);
      await phase(panel, 'panel', 'bite');
      assert.equal(await panel.locator('.fishing-game-bite .fishing-bite-art').isVisible(), true);
      await inspectImage(panel, '.fishing-game-bite .fishing-bite-art');
      const measures = [];
      for (const milliseconds of [16, 100, 240]) {
        await panel.evaluate(milliseconds => advanceBiteReview(milliseconds), milliseconds);
        measures.push(await measure(panel, 'panel', 27));
      }
      await panel.locator('#game').screenshot({ path: path.join(output, 'panel-bite-' + width + '.png') });
      await phase(panel, 'panel', 'reeling');
      assert.equal(await panel.locator('.fishing-game-bite .fishing-bite-art').isVisible(), false);
      checks.push({ mode: 'panel', width, measures });
    }
    await panel.emulateMedia({ reducedMotion: 'reduce' });
    await phase(panel, 'panel', 'bite');
    const quietPanel = await measure(panel, 'panel', 27);
    assert.equal(quietPanel.animations, 0, 'panel reduced motion stops the cue bounce');
    await panel.locator('#game').screenshot({ path: path.join(output, 'panel-bite-reduced.png') });
    checks.push({ mode: 'panel', reducedMotion: true, measure: quietPanel });
    await panel.evaluate(() => reviewGame.destroy());
    assert.equal(await panel.locator('#game canvas').count(), 0, 'the panel releases its renderers');
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    const report = { passed: true, artwork, checks, errors, failed, output };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); console.error('Artifacts: ' + output); process.exitCode = 1; });
