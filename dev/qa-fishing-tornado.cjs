'use strict';
// Real desktop/panel fishing renderers, deterministic visual time, isolated bridge.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const F = require('../public/fishing-model'), FX = require('../skins/tracer/fishing-rod-effects');
const root = path.resolve(__dirname, '..'), assets = path.join(root, 'skins/tracer');
const out = fs.mkdtempSync(path.join(root, '.cache/fishing-tornado-'));
const rod = F.catalog.rods.find(value => value.id === 'cloud'), duration = FX.summonScene('cloud').duration;
const fish = F.catalog.fish.find(value => value.rarity === 'rare');
const catalogueOnly = process.argv.includes('--catalogue-only');
const report = { out, scope: catalogueOnly ? 'catalogue-only' : 'runtime-and-catalogue', frames: [], geometryChanges: [], sources: {}, errors: [] };
for (const file of ['fishing-rod-effects.js', 'fishing-motion.js', 'fishing-art.js']) report.sources[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(assets, file))).digest('hex');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 760, height: 690 }, deviceScaleFactor: 2 });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://tornado.test') return route.abort();
      if (url.pathname === '/qa-panel.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fishing-scene.css"><link rel="stylesheet" href="/fishing-rewards.css"><style>body{margin:0;padding:30px;background:#223a36}#panel{max-width:700px}</style><div id="panel"></div>' + ['fishing-model', 'fishing-lighting', 'fishing-art', 'fishing-rewards', 'fishing-rod-effects', 'fishing-motion', 'fishing-rod-renderer', 'fishing-game'].map(name => '<script src="/' + name + '.js"></script>').join('') });
      const file = path.resolve(assets, '.' + url.pathname);
      return file.startsWith(assets + path.sep) && fs.existsSync(file) ? route.fulfill({ path: file }) : route.abort();
    });
    await context.addInitScript(() => {
      let clock = 100, serial = 0;
      const callbacks = new Map();
      Object.defineProperty(performance, 'now', { value: () => clock });
      window.requestAnimationFrame = fn => { callbacks.set(++serial, fn); return serial; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      window.advance = ms => { clock += ms; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(clock)); };
      window.qa = { messages: [], resources: {}, callbacks, captures: new Map(), motions: [] };
      window.FishingDesktop = { send: message => qa.messages.push(message), onSnapshot(fn) { window.receive = fn; return () => {}; }, onMenuAction(fn) { window.menu = fn; return () => {}; }, onVisibility() { return () => {}; } };
      let motion;
      Object.defineProperty(window, 'TracerFishingMotion', { configurable: true, get: () => motion, set: value => { motion = { ...value, create(nodes) { const renderer = value.create(nodes); qa.motions.push({ nodes, renderer }); return renderer; } }; } });
      const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect;
      proto.clearRect = function(...args) { this.canvas.__trace = { hash: 2166136261, commands: 0, images: 0 }; return clear.apply(this, args); };
      for (const method of ['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse']) {
        const original = proto[method];
        proto[method] = function(...args) { const trace = this.canvas.__trace; if (trace) { trace.commands++; for (const n of args) if (typeof n === 'number') trace.hash = Math.imul(trace.hash ^ Math.round(n * 10000), 16777619) >>> 0; } return original.apply(this, args); };
      }
      const drawImage = proto.drawImage;
      proto.drawImage = function(...args) { if (this.canvas.__trace) this.canvas.__trace.images++; return drawImage.apply(this, args); };
      const glProto = WebGLRenderingContext.prototype;
      for (const kind of ['Buffer', 'Texture', 'Program', 'Framebuffer', 'Renderbuffer']) {
        const create = glProto['create' + kind], remove = glProto['delete' + kind], live = new Set(); qa.resources[kind] = live;
        glProto['create' + kind] = function(...args) { const value = create.apply(this, args); if (value) live.add(value); return value; };
        glProto['delete' + kind] = function(value) { live.delete(value); return remove.call(this, value); };
      }
      window.sampleEffect = (selector, key) => {
        const canvas = document.querySelector(selector), ctx = canvas.getContext('2d'), pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data, rect = canvas.getBoundingClientRect();
        let visible = 0, maxAlpha = 0, edgeAlpha = 0, sum = 0, xsum = 0, ysum = 0, hash = 2166136261, minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
        const bars = [...document.querySelectorAll('#fishing-reel,.fishing-game-reel,#fishing-power')].filter(node => !node.hidden).map(node => node.getBoundingClientRect()); let controlPixels = 0, controlMaxAlpha = 0;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4, alpha = pixels[i + 3]; maxAlpha = Math.max(maxAlpha, alpha);
          if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) edgeAlpha = Math.max(edgeAlpha, alpha);
          if (alpha > 8) { visible++; sum += alpha; xsum += x * alpha; ysum += y * alpha; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
          if (alpha > 0) { const cx = rect.left + x / canvas.width * rect.width, cy = rect.top + y / canvas.height * rect.height; if (bars.some(b => cx > b.left && cx < b.right && cy > b.top && cy < b.bottom)) { controlMaxAlpha = Math.max(controlMaxAlpha, alpha); if (alpha > 18) controlPixels++; } }
          for (let j = 0; j < 4; j++) hash = Math.imul(hash ^ pixels[i + j], 16777619) >>> 0;
        }
        if (key) qa.captures.set(key, { pixels: new Uint8Array(pixels), maxAlpha });
        return { hidden: canvas.hidden, width: canvas.width, height: canvas.height, visible, maxAlpha, edgeAlpha, centroid: [xsum / sum, ysum / sum], bounds: [minX, minY, maxX, maxY], hash, trace: canvas.__trace, controlPixels, controlMaxAlpha, dataset: { ...canvas.dataset }, rodOpacity: (document.querySelector('#fishing-rod') || document.querySelector('.fishing-game-rod')).style.opacity };
      };
      window.normalizedPixelDifference = (a, b) => {
        const first = qa.captures.get(a), last = qa.captures.get(b); let changed = 0, supportUnion = 0, supportDifference = 0;
        for (let i = 3; i < first.pixels.length; i += 4) { const x = first.pixels[i] / Math.max(1, first.maxAlpha), y = last.pixels[i] / Math.max(1, last.maxAlpha); if (Math.abs(x - y) > .08) changed++; if (x > .15 || y > .15) supportUnion++; if ((x > .15) !== (y > .15)) supportDifference++; }
        return { changed, supportDifference, supportUnion, shapeChange: supportDifference / Math.max(1, supportUnion) };
      };
    });
    const desktop = await context.newPage(), panel = await context.newPage();
    for (const page of [desktop, panel]) { page.on('pageerror', error => report.errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); }); }
    await desktop.setViewportSize({ width: 304, height: 208 }); await desktop.goto('http://tornado.test/fishing-desktop.html');
    await desktop.addStyleTag({ content: 'body{background:linear-gradient(115deg,#273b48,#516657)!important}' });
    await panel.goto('http://tornado.test/qa-panel.html');
    await panel.evaluate(() => { window.game = TracerFishingGame.create(document.getElementById('panel')); window.receive = snapshot => game.update(snapshot); });
    const snapshot = phase => ({ language: 'zh', rod, fish, catalog: F.catalog, recastRemaining: phase === 'caught' ? 3000 : 0, desktopPond: { pond: { style: 'stone', decorations: [] }, fish: [] }, session: { id: 'tornado-session', phase, castPower: .6, castDistance: .5, barPosition: .5, fishPosition: .56, barSize: .26, progress: .54, tension: .58, stamina: .55, fishBehavior: 'surge' }, lastCatch: { id: 'tornado-session', fishId: fish.id, fish } });
    for (const page of [desktop, panel]) await page.evaluate(value => { receive(value); advance(16); }, snapshot('idle'));
    await Promise.all([desktop.waitForLoadState('networkidle'), panel.waitForLoadState('networkidle')]);
    const capture = async (page, surface, phase, age, selector) => {
      const key = surface + '-' + phase + '-' + age, stats = await page.evaluate(({ selector, key }) => sampleEffect(selector, key), { selector, key });
      assert(!stats.hidden, key + ': expected visible effect'); assert(stats.visible > 20, key + ': readable geometry');
      assert.equal(stats.trace.images, 0, key + ': tornado is rendered from continuous geometry, without image patches');
      assert(stats.trace.commands > 100, key + ': detailed procedural paths');
      assert(stats.edgeAlpha <= 16, key + ': effects stay inside the drawing surface');
      assert.equal(stats.controlPixels, 0, key + ': the tornado does not cover the fishing control bar');
      const file = key + '.png';
      if (surface === 'panel') await page.locator('.fishing-game-stage').screenshot({ path: path.join(out, file) });
      else await page.screenshot({ path: path.join(out, file) });
      report.frames.push({ surface, phase, age, key, file, ...stats }); return stats;
    };
    if (!catalogueOnly) {
    // The desktop menu is the actual summon-only workflow; F is locked until
    // formation is complete, and this visual sequence must not show a meter.
    await desktop.keyboard.press('f'); assert(!(await desktop.evaluate(() => qa.messages)).some(message => message.type === 'cast-start'));
    await desktop.evaluate(() => menu({ type: 'summon-rod' }));
    let elapsed = 0;
    for (const progress of [.12, .28, .46, .63, .78, .93]) {
      const age = Math.round(duration * progress); await desktop.evaluate(ms => advance(ms), age - elapsed); elapsed = age;
      const stats = await capture(desktop, 'desktop', 'summon', age, '.fishing-summon-canvas'); assert.equal(stats.dataset.scene, 'wind-vortex');
      assert.equal(await desktop.locator('#fishing-power').isVisible(), false); assert.equal(await desktop.locator('#fishing-reel').isVisible(), false);
    }
    await desktop.keyboard.press('f'); assert(!(await desktop.evaluate(() => qa.messages)).some(message => message.type === 'cast-start'), 'F cannot cast while the tornado forms the rod');
    await desktop.evaluate(ms => advance(ms), duration + 1 - elapsed); await desktop.keyboard.press('f');
    assert((await desktop.evaluate(() => qa.messages)).some(message => message.type === 'cast-start' && message.entranceReady), 'formed rod can cast without replaying the tornado entrance');
    await desktop.evaluate(value => { receive(value); advance(16); }, snapshot('charging'));
    assert.equal(await desktop.locator('.fishing-summon-canvas').isVisible(), false);
    for (const [page, surface] of [[desktop, 'desktop'], [panel, 'panel']]) {
      for (const [phase, ages] of [['cast', [130, 320, 540]], ['reeling', [130, 360, 590]], ['caught', [900, 1250, 1600]]]) {
        await page.evaluate(value => receive(value), snapshot(phase)); let time = 0;
        for (const age of ages) { await page.evaluate(ms => advance(ms), age - time); time = age; const stats = await capture(page, surface, phase, age, '.fishing-motion-fx canvas'); assert.equal(stats.dataset.action, 'tornado-' + phase); }
        const frames = report.frames.filter(frame => frame.surface === surface && frame.phase === phase), difference = await page.evaluate(keys => normalizedPixelDifference(keys[0], keys[1]), [frames[0].key, frames.at(-1).key]);
        assert.notEqual(frames[0].trace.hash, frames.at(-1).trace.hash, phase + ': path geometry changes, not merely opacity');
        assert(difference.changed > 100 && difference.shapeChange > .05, phase + ': normalized alpha support changes with the physical vortex');
        report.geometryChanges.push({ surface, phase, ...difference });
        if (surface === 'panel' && phase === 'reeling') await page.screenshot({ path: path.join(out, 'panel-controls.png') });
      }
    }
    // Reverse exit runs through the same preview lifecycle and reconstruction.
    await desktop.evaluate(value => { receive(value); advance(16); menu({ type: 'dismiss-rod' }); advance(1300); menu({ type: 'summon-rod' }); }, snapshot('idle'));
    await desktop.evaluate(ms => advance(ms), duration + 1);
    await desktop.evaluate(() => menu({ type: 'dismiss-rod' })); elapsed = 0;
    for (const age of [130, 390, 660, 930]) { await desktop.evaluate(ms => advance(ms), age - elapsed); elapsed = age; const stats = await capture(desktop, 'desktop', 'depart', age, '.fishing-summon-canvas'); assert.equal(stats.dataset.stage, 'depart'); assert.equal(stats.dataset.scene, 'wind-vortex'); }
    await desktop.evaluate(() => advance(400)); assert.equal(await desktop.locator('#desktop-fishing').getAttribute('data-rod-visible'), 'false');
    const summonFrames = report.frames.filter(frame => frame.phase === 'summon'), summonDifference = await desktop.evaluate(keys => normalizedPixelDifference(keys[0], keys[1]), [summonFrames[1].key, summonFrames[3].key]);
    assert(summonDifference.shapeChange > .1); report.geometryChanges.push({ surface: 'desktop', phase: 'summon', ...summonDifference });
    // Reduced motion keeps the waiting field still after the finite spring
    // transition settles; it must not continue spinning at a reduced speed.
    const reduced = [];
    for (const [page, surface] of [[desktop, 'desktop'], [panel, 'panel']]) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(value => { receive(value); for (let i = 0; i < 120; i++) advance(32); }, snapshot('waiting'));
      const first = await page.evaluate(() => sampleEffect('.fishing-motion-fx canvas', 'reduced-a'));
      await page.evaluate(() => advance(2000)); const last = await page.evaluate(() => sampleEffect('.fishing-motion-fx canvas', 'reduced-b'));
      assert.equal(first.trace.hash, last.trace.hash, surface + ': reduced motion stops vortex rotation');
      assert.equal(first.hash, last.hash, surface + ': reduced ambient field is visually stable');
      await page.screenshot({ path: path.join(out, surface + '-reduced-motion.png') }); reduced.push({ surface, first, last });
    }
    report.reduced = reduced;
    }
    // Art.rodMarkup takes the current fluid branch before Motion's fallback.
    // Rendering this public API catches preview work accidentally implemented
    // only in that unreachable fallback instead of the actual catalogue path.
    const catalogue = await context.newPage();
    await catalogue.setViewportSize({ width: 820, height: 620 });
    catalogue.on('pageerror', error => report.errors.push(error.message));
    await catalogue.goto('http://tornado.test/qa-panel.html');
    await catalogue.addStyleTag({ url: 'http://tornado.test/fishing.css' });
    await catalogue.evaluate(rod => {
      document.body.style.padding = '0'; document.body.style.background = '#162d28';
      document.body.innerHTML = '<main class="fishing-page"><section class="fishing-rod-feature"><div class="fishing-feature-art">' + TracerFishingArt.rodMarkup(rod) + '</div><div><span class="fishing-eyebrow">EQUIPPED / READY TO CAST</span><h2>' + rod.name[0] + '</h2><p>' + rod.effectDescription[0] + '</p></div></section><div class="fishing-rod-grid"><article class="fishing-rod-card" data-rarity="epic" data-owned="true"><span class="fishing-rarity">史诗</span><div class="fishing-rod-art">' + TracerFishingArt.rodMarkup(rod) + '</div><h3>' + rod.name[0] + '</h3><p>龙卷风 · 图鉴实际预览</p></article></div></main>';
    }, rod);
    await catalogue.waitForLoadState('networkidle');
    const preview = await catalogue.evaluate(() => [...document.querySelectorAll('.fishing-catalog-fluid[data-fx-theme="tornado"]')].map(node => ({ variant: node.dataset.fxVariant, surface: node.dataset.fxSurface, volume: !!node.querySelector('[data-wind-volume="true"]'), front: !!node.querySelector('[data-wind-depth="front"]'), back: !!node.querySelector('[data-wind-depth="back"]'), paths: node.querySelectorAll('path').length, bounds: { x: node.getBBox().x, y: node.getBBox().y, width: node.getBBox().width, height: node.getBBox().height }, hasImagePatch: !!node.querySelector('image') })));
    assert.equal(preview.length, 2, 'both the feature and card use the current tornado fluid branch');
    assert(preview.every(value => value.paths >= 8 && !value.hasImagePatch && value.surface === 'tapered-vortex' && value.volume && value.front && value.back), 'the current branch contains the dedicated procedural funnel and depth strands');
    for (const value of preview) assert(value.bounds.x >= 0 && value.bounds.y >= 0 && value.bounds.x + value.bounds.width <= 250.8 && value.bounds.y + value.bounds.height <= 418, 'catalogue vortex geometry stays inside the actual SVG viewBox');
    await catalogue.screenshot({ path: path.join(out, 'catalogue-live.png'), fullPage: true });
    await catalogue.emulateMedia({ reducedMotion: 'reduce' });
    await catalogue.waitForTimeout(50);
    await catalogue.screenshot({ path: path.join(out, 'catalogue-reduced.png'), fullPage: true });
    const reducedPreview = await catalogue.evaluate(() => [...document.querySelectorAll('.fishing-catalog-fluid')].every(node => node.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')));
    assert(reducedPreview, 'reduced-motion catalogue has no running vortex animation');
    report.catalogue = { preview, reducedStable: reducedPreview };
    await catalogue.close();
    const cleanup = [];
    for (const [page, surface] of [[desktop, 'desktop'], [panel, 'panel']]) {
      const state = await page.evaluate(surface => { if (surface === 'panel') game.destroy(); else dispatchEvent(new Event('beforeunload')); return { resources: Object.fromEntries(Object.entries(qa.resources).map(([key, set]) => [key, set.size])), canvases: document.querySelectorAll('canvas').length, callbacks: qa.callbacks.size }; }, surface);
      assert(Object.values(state.resources).every(value => value === 0)); assert.equal(state.canvases, 0); assert.equal(state.callbacks, 0); cleanup.push({ surface, ...state });
    }
    report.cleanup = cleanup; assert.deepEqual(report.errors, []);
    if (report.frames.length) {
    const sheet = await context.newPage(); await sheet.setViewportSize({ width: 1824, height: Math.ceil(report.frames.length / 6) * 230 });
    await sheet.setContent('<style>body{margin:0;background:#21353c;color:#eadbb9;font:13px system-ui;display:grid;grid-template-columns:repeat(6,304px)}figure{margin:0;height:230px;display:flex;flex-direction:column}img{width:304px;height:208px;object-fit:contain}figcaption{padding:3px 8px}</style>' + report.frames.map(frame => '<figure><img src="data:image/png;base64,' + fs.readFileSync(path.join(out, frame.file)).toString('base64') + '"><figcaption>' + frame.surface + ' / ' + frame.phase + ' / ' + frame.age + ' ms</figcaption></figure>').join(''));
    await sheet.screenshot({ path: path.join(out, 'tornado-contact-sheet.png') });
    }
    report.passed = true;
  } finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
  console.log(JSON.stringify({ out, passed: report.passed, frames: report.frames.length, geometryChanges: report.geometryChanges.length, errors: report.errors }));
})().catch(error => { console.error(out); console.error(error); process.exitCode = 1; });
