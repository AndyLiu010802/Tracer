'use strict';

// Real desktop document and shared aquarium, isolated from account storage.
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(root, '.cache/fishing-aquarium-desktop-'));
const files = ['fishing-aquarium-desktop.html', 'fishing-aquarium-desktop.css', 'fishing-aquarium-desktop.js', 'fishing-model.js', 'fishing-aquarium-motion.js', 'fishing-lighting.js', 'fishing-art.js', 'fishing-scene.css', 'fishing-aquarium.js', 'fishing-aquarium.css', 'fishing-art/fish-model-v1.png'];
const sources = new Map(files.map(file => [file, fs.readFileSync(path.join(root, 'skins/tracer', file))]));
const sourceHashes = Object.fromEntries([...sources].map(([file, bytes]) => [file, crypto.createHash('sha256').update(bytes).digest('hex')]));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], warnings = [], blockedRequests = [];
  const report = { sourceHashes, viewport: { width: 210, height: 170 }, layouts: [], checks: [] };
  let page;
  try {
    const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const routeAsset = route => {
      const url = new URL(route.request().url()), file = url.pathname.slice(1);
      if (url.origin !== 'http://aquarium-desktop-review.test' || !sources.has(file)) { blockedRequests.push(url.href); return route.abort(); }
      const contentType = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.png') ? 'image/png' : 'application/javascript; charset=utf-8';
      return route.fulfill({ contentType, body: sources.get(file) });
    };
    await context.route('**/*', routeAsset);
    await context.addInitScript(() => {
      const snapshots = new Set(), visibility = new Set();
      window.aquariumAudit = { messages: [], contexts: [], resources: [], drawCalls: 0, poses: {}, uniforms: {} };
      window.FishingAquariumDesktop = {
        send(value) { aquariumAudit.messages.push(value); },
        onSnapshot(fn) { snapshots.add(fn); return () => snapshots.delete(fn); },
        onMenuAction(fn) { window.aquariumMenuAction=fn; return()=>{}; },
        onVisibility(fn) { visibility.add(fn); return () => visibility.delete(fn); },
      };
      window.aquariumReview = {
        snapshot(value) { for (const fn of snapshots) fn(value); },
        visible(visible, clear = false) { for (const fn of visibility) fn({ visible, clear }); },
      };
      const prototype = WebGLRenderingContext.prototype, getContext = HTMLCanvasElement.prototype.getContext;
      const uniformNames = new WeakMap(), getUniformLocation = prototype.getUniformLocation, uniform1f = prototype.uniform1f;
      prototype.getUniformLocation = function(program, name) { const location = getUniformLocation.call(this, program, name); if (location) uniformNames.set(location, name); return location; };
      prototype.uniform1f = function(location, value) { const name = location && uniformNames.get(location); if (name) aquariumAudit.uniforms[name] = value; return uniform1f.call(this, location, value); };
      HTMLCanvasElement.prototype.getContext = function(type, options) {
        const gl = getContext.call(this, type, options);
        if (gl && /webgl/.test(type) && !aquariumAudit.contexts.includes(gl)) aquariumAudit.contexts.push(gl);
        return gl;
      };
      for (const kind of ['Buffer', 'Texture', 'Program']) {
        const create = prototype['create' + kind], remove = prototype['delete' + kind], live = new Set();
        aquariumAudit.resources.push({ kind, live });
        prototype['create' + kind] = function(...args) { const value = create.apply(this, args); if (value) live.add(value); return value; };
        prototype['delete' + kind] = function(value) { live.delete(value); return remove.call(this, value); };
      }
      for (const name of ['drawArrays', 'drawElements']) {
        const draw = prototype[name]; prototype[name] = function(...args) {
          aquariumAudit.drawCalls++;
          if (aquariumAudit.uniforms.uMotionEnabled === 1 && [13, 16].includes(aquariumAudit.uniforms.uMaterial)) aquariumAudit.fishUniforms = { ...aquariumAudit.uniforms };
          return draw.apply(this, args);
        };
      }
    });
    page = await context.newPage();
    page.on('pageerror', value => errors.push(value.message));
    page.on('console', value => { if (['warning', 'error'].includes(value.type())) warnings.push(value.text()); });
    await page.goto('http://aquarium-desktop-review.test/fishing-aquarium-desktop.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      const c = TracerFishingModel.catalog;
      const motion = window.TracerAquariumMotion;
      if (!motion?.sample) throw new Error('The production aquarium motion module is missing');
      aquariumReview.motionSource = motion; aquariumReview.motionTime = null;
      window.TracerAquariumMotion = { ...motion, sample(fish, options) {
        const input = aquariumReview.motionTime === null ? options : { ...options, time: aquariumReview.motionTime };
        const pose = motion.sample(fish, input);
        aquariumAudit.poses[fish.speciesId || fish.fishId || fish.id] = { ...pose, sampleTime: input.time };
        return pose;
      } };
      window.aquariumFixture = (count = 3, language = 'zh') => {
        const fish = ['gulpuffer', 'grumpangler', 'flopray'].slice(0, count).map(id => ({...c.fish.find(x => x.id === id),id:'resident_'+id,fishId:id,speciesId:id,growth:20,fedAt:null}));
        if (fish.some(x => !x || x.rarity !== 'legendary')) throw new Error('QA fixture requires unlocked legendary catalogue species');
        return { accountScope: 'isolated-aquarium-review', accountGeneration: 3, accountRestoreId: 'review-restore', nativeSessionId: 'review-session', desktopVisible: true, language, showcase: { fish, stats: { catches: 30, species: 20, ponds: 1 }, selection: { fishIds: fish.map(x => x.fishId),decorationIds:['water_grass','moon_crystal','pearl_shell'] } } };
      };
    });
    for (const count of [0, 1, 3]) for (const language of ['zh', 'en']) {
      await page.evaluate(({ count, language }) => aquariumReview.snapshot(aquariumFixture(count, language)), { count, language });
      await page.waitForSelector('.fishing-aquarium-tank'); await page.waitForTimeout(230);
      const layout = await page.evaluate(() => {
        const box = selector => { const e = document.querySelector(selector), r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }; };
        return { frame: box('#aquarium-frame'), content: box('#aquarium-content'), scene: box('.fishing-aquarium-scene'), tank: box('.fishing-aquarium-tank'), background: getComputedStyle(document.querySelector('#aquarium-frame')).backgroundColor, text: document.body.innerText, fishCanvases: [...document.querySelectorAll('#aquarium-content canvas')].map(e => ({ width: e.width, height: e.height })) };
      });
      assert.equal(await page.locator('#aquarium-toolbar').count(),0,'actions live in the native context menu');
      assert(layout.scene.x >= layout.content.x && layout.scene.right <= layout.content.right + 1 && layout.scene.bottom <= layout.content.bottom + 1, 'Scene overflow');
      assert.deepEqual(await page.locator('.fishing-aquarium-scene').evaluate(node => JSON.parse(node.dataset.decorations)), ['water_grass','moon_crystal','pearl_shell']);
      assert.equal(await page.locator('.fishing-aquarium-scene').getAttribute('data-renderer'), 'webgl');
      assert.equal(await page.locator('.fishing-aquarium-scene').getAttribute('data-count'), String(count));
      assert.equal(await page.locator('.fishing-aquarium-volume').getAttribute('data-aquarium-fish-count'), String(count));
      assert.equal(await page.locator('.fishing-aquarium-volume').getAttribute('data-aquarium-decorations'), 'water_grass,moon_crystal,pearl_shell');
      assert(Math.abs(layout.frame.width-210)<1&&Math.abs(layout.frame.height-170)<1,'exactly half-sized desktop frame');
      assert.equal(layout.background, 'rgba(0, 0, 0, 0)');
      assert(layout.fishCanvases.every(x => x.width > 1 && x.height > 1));
      assert.equal(layout.fishCanvases.length, 1, 'Tank, fish and decorations share one canvas');
      const liveContexts = await page.evaluate(() => aquariumAudit.contexts.filter(gl => !gl.isContextLost()).length);
      assert.equal(liveContexts, 1, 'Only one aquarium WebGL context stays live');
      report.layouts.push({ count, language, ...layout });
      await page.screenshot({ path: path.join(output, `${count}-fish-${language}.png`), omitBackground: true });
    }
    const legendarySpecies = await page.evaluate(() => TracerFishingModel.catalog.fish.filter(fish => fish.rarity === 'legendary').map(fish => fish.id));
    report.motion = [];
    for (const id of legendarySpecies) {
      await page.evaluate(id => {
        const value = aquariumFixture(0), species = TracerFishingModel.catalog.fish.find(fish => fish.id === id);
        value.showcase.fish = [{ ...species, id: 'resident_' + id, fishId: id, speciesId: id, growth: 20, fedAt: null }];
        value.showcase.selection.fishIds = [id]; aquariumReview.snapshot(value);
      }, id);
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.fishing-aquarium-volume').getAttribute('data-aquarium-fish-count'), '1');
      assert.equal(await page.evaluate(() => aquariumAudit.contexts.filter(gl => !gl.isContextLost()).length), 1);
      await page.screenshot({ path: path.join(output, 'single-' + id + '.png'), omitBackground: true });
      const phases = await page.evaluate(id => {
        const species = TracerFishingModel.catalog.fish.find(fish => fish.id === id), fish = { ...species, id: 'resident_' + id, fishId: id, speciesId: id, growth: 20, fedAt: null }, best = {};
        for (let time = 0; time <= 180; time += .25) {
          const pose = aquariumReview.motionSource.sample(fish, { time, index: 0, count: 1, scale: .6, reducedMotion: false, feed: { strength: 0, progress: 1 } });
          const score = Number(pose.weights?.[pose.mode] ?? 1);
          if (!best[pose.mode] || score > best[pose.mode].score) best[pose.mode] = { mode: pose.mode, time, score };
        }
        return best;
      }, id);
      for (const mode of ['swim', 'idle', 'play']) {
        assert(phases[mode], id + ' has a ' + mode + ' phase');
        await page.evaluate(time => { aquariumReview.motionTime = time; aquariumAudit.poses = {}; aquariumAudit.fishUniforms = null; }, phases[mode].time);
        await page.waitForFunction(({ id, mode }) => aquariumAudit.poses[id]?.mode === mode && aquariumAudit.fishUniforms, { id, mode });
        await page.waitForTimeout(90);
        const result = await page.evaluate(id => ({ pose: aquariumAudit.poses[id], uniforms: Object.fromEntries(['uMotionEnabled','uBodyPhase','uBodyAmplitude','uFinPhase','uFinAmplitude','uWingPhase','uWingAmplitude','uWingFold','uBodyPuff'].map(name => [name, aquariumAudit.fishUniforms[name]])) }), id);
        const finite = value => typeof value === 'number' ? Number.isFinite(value) : value && typeof value === 'object' ? Object.values(value).every(finite) : true;
        assert(finite(result.pose), id + ' ' + mode + ' pose contains finite values');
        assert(Object.values(result.uniforms).every(value => Number.isFinite(value)), 'Real fish shader receives all articulation uniforms');
        assert.equal(result.uniforms.uMotionEnabled, 1, 'Aquarium fish use the behavior articulation path');
        report.motion.push({ id, mode, ...result });
        await page.screenshot({ path: path.join(output, 'single-' + id + '-' + mode + '.png'), omitBackground: true });
      }
      const amplitudes = report.motion.filter(item => item.id === id).map(item => JSON.stringify([item.uniforms.uBodyAmplitude,item.uniforms.uFinAmplitude,item.uniforms.uWingAmplitude,item.uniforms.uWingFold,item.uniforms.uBodyPuff]));
      assert(new Set(amplitudes).size >= 2, id + ' changes body or fin articulation across behavior phases, beyond translating its position');
      await page.evaluate(() => { aquariumReview.motionTime = null; });
    }
    report.singleResidents = legendarySpecies;
    await page.evaluate(() => aquariumReview.snapshot(aquariumFixture()));
    for (const [label, color] of [['dark', '#202c29'], ['light', '#e8e9e2']]) {
      await page.evaluate(color => { document.body.style.background = color; }, color);
      await page.screenshot({ path: path.join(output, 'desktop-composite-' + label + '.png') });
    }
    await page.evaluate(() => { document.body.style.background = ''; });
    const transparentCapture = await page.screenshot({ omitBackground: true });
    report.transparentCorners = await page.evaluate(async base64 => {
      const source = new Image(); source.src = 'data:image/png;base64,' + base64; await source.decode();
      const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0);
      return [[0,0],[source.width-1,0],[0,source.height-1],[source.width-1,source.height-1]].map(([x,y]) => ({x,y,alpha:ctx.getImageData(x,y,1,1).data[3]}));
    }, transparentCapture.toString('base64'));
    assert(report.transparentCorners.every(point => point.alpha <= 16), 'Desktop ornament retains transparent exterior corners');
    const drawsBefore = await page.evaluate(() => aquariumAudit.drawCalls); await page.waitForTimeout(220);
    assert((await page.evaluate(() => aquariumAudit.drawCalls)) > drawsBefore, 'The live aquarium animates');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.fishing-aquarium-volume')?.dataset.aquariumMotion === 'reduced');
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.fishing-aquarium-volume').getAttribute('data-aquarium-motion'), 'reduced');
    const reducedDraws = await page.evaluate(() => aquariumAudit.drawCalls); await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => aquariumAudit.drawCalls), reducedDraws, 'Reduced motion pauses WebGL animation');
    assert.equal(await page.locator('.fishing-aquarium-scene').evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0, 'Reduced motion stops CSS animations');
    await page.evaluate(() => { const value = aquariumFixture(); for (const fish of value.showcase.fish) fish.fedAt = Date.now(); aquariumReview.snapshot(value); });
    assert.equal(await page.locator('#aquarium-content [data-feeding="true"]').count(), 0, 'Reduced-motion feeding never leaves suspended food or a stuck animation marker');
    await page.waitForTimeout(100); const reducedFedDraws = await page.evaluate(() => aquariumAudit.drawCalls); await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => aquariumAudit.drawCalls), reducedFedDraws, 'Feeding in reduced motion does not restart the animation loop');
    await page.screenshot({ path: path.join(output, 'reduced-motion.png'), omitBackground: true });
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(220);
    assert.equal(await page.locator('.fishing-aquarium-volume').getAttribute('data-aquarium-motion'), 'live');
    assert((await page.evaluate(() => aquariumAudit.drawCalls)) > reducedFedDraws, 'Animation resumes when reduced motion is disabled');
    const hitPoints = await page.evaluate(() => {
      const tank = document.querySelector('.fishing-aquarium-tank').getBoundingClientRect(), base = document.querySelector('.fishing-aquarium-base').getBoundingClientRect();
      return [{ label: 'transparent exterior', x: 2, y: 100, pass: true }, { label: 'tank body', x: tank.x + tank.width / 2, y: tank.y + tank.height / 2, pass: false }, { label: 'base', x: base.x + base.width / 2, y: base.y + base.height / 2, pass: false }, { label: 'transparent bottom corner', x: 3, y: 167, pass: true }];
    });
    for (const point of hitPoints) {
      await page.mouse.move(point.x, point.y);
      const actual = await page.evaluate(() => aquariumAudit.messages.filter(x => x.type === 'pointer-pass-through').at(-1).value);
      assert.equal(actual, point.pass, point.label); report.pointerContours ||= []; report.pointerContours.push({ ...point, actual });
    }
    await page.mouse.click(hitPoints[1].x,hitPoints[1].y,{button:'right'});assert((await page.evaluate(()=>aquariumAudit.messages)).some(x=>x.type==='context-menu'));
    await page.evaluate(()=>aquariumMenuAction({type:'move'}));
    // The glass itself is now a drag surface, with no toolbar-only requirement.
    const dragCount = await page.evaluate(() => aquariumAudit.messages.filter(x => x.type === 'drag-start').length);
    await page.mouse.move(hitPoints[1].x, hitPoints[1].y); await page.mouse.down(); await page.mouse.move(hitPoints[1].x + 14, hitPoints[1].y + 9); await page.mouse.up();
    assert.equal(await page.evaluate(() => aquariumAudit.messages.filter(x => x.type === 'drag-start').length), dragCount + 1);
    assert.equal(await page.locator('#aquarium-frame').getAttribute('data-dragging'), 'false');
    const contextsBeforeResize = await page.evaluate(() => aquariumAudit.contexts.length);
    for (const scale of [.75, 1.5, 2.5, 1]) {
      const width = Math.round(210 * scale), height = Math.round(170 * scale); await page.setViewportSize({ width, height });
      await page.evaluate(scale => aquariumReview.snapshot({ ...aquariumFixture(), desktopScale: scale }), scale);
      await page.waitForFunction(({ width, height }) => { const b = document.getElementById('aquarium-frame').getBoundingClientRect(); return Math.abs(b.width - width) < 1 && Math.abs(b.height - height) < 1; }, { width, height });
      await page.screenshot({ path: path.join(output, 'scale-' + Math.round(scale * 100) + '.png'), omitBackground: true });
    }
    assert.equal(await page.evaluate(() => aquariumAudit.contexts.length), contextsBeforeResize, 'resizing reuses the aquarium renderer');
    report.resize = { scales: [.75, 1.5, 2.5, 1], bodyDrag: true, contextMenu: true, reusedRenderer: true };
    // Native focusable:false does not retain the browser's accessible button focus.
    await page.evaluate(() => document.activeElement?.blur());
    const beforeKeys = await page.evaluate(() => aquariumAudit.messages.length);
    await page.keyboard.press('f'); await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => aquariumAudit.messages.length), beforeKeys, 'Aquarium must not consume fishing keys');
    await page.evaluate(() => aquariumReview.visible(false));
    assert.equal(await page.locator('#aquarium-content canvas').count(), 0);
    await page.evaluate(() => aquariumReview.visible(false));
    const pausedDraws = await page.evaluate(() => aquariumAudit.drawCalls); await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => aquariumAudit.drawCalls), pausedDraws, 'Hidden renderer still draws');
    report.hiddenCleanup = await page.evaluate(() => ({ contexts: aquariumAudit.contexts.length, lost: aquariumAudit.contexts.filter(x => x.isContextLost()).length, resources: aquariumAudit.resources.map(x => ({ kind: x.kind, live: x.live.size })) }));
    assert.equal(report.hiddenCleanup.contexts, report.hiddenCleanup.lost); assert(report.hiddenCleanup.resources.every(x => x.live === 0));
    await page.screenshot({ path: path.join(output, 'hidden.png'), omitBackground: true });
    await page.evaluate(() => aquariumReview.visible(true));
    await page.waitForFunction(() => document.querySelectorAll('#aquarium-content canvas').length > 0);
    await page.evaluate(() => aquariumReview.visible(false, true));
    assert.equal(await page.locator('#aquarium-content canvas').count(), 0);
    await page.evaluate(() => aquariumReview.visible(true));
    assert.equal(await page.locator('#aquarium-content canvas').count(), 0, 'Account lock must forget previous collection');
    await page.evaluate(() => aquariumReview.snapshot(aquariumFixture(3, 'en')));
    await page.waitForFunction(() => document.querySelectorAll('#aquarium-content canvas').length > 0);
    await page.screenshot({ path: path.join(output, 'restored-en.png'), omitBackground: true });
    await page.evaluate(() => aquariumReview.visible(false, true));
    report.finalCleanup = await page.evaluate(() => ({ contexts: aquariumAudit.contexts.length, lost: aquariumAudit.contexts.filter(x => x.isContextLost()).length, resources: aquariumAudit.resources.map(x => ({ kind: x.kind, live: x.live.size })), commands: aquariumAudit.messages.map(x => x.type) }));
    assert.equal(report.finalCleanup.contexts, report.finalCleanup.lost); assert(report.finalCleanup.resources.every(x => x.live === 0));
    const fallbackContext = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await fallbackContext.route('**/*', routeAsset);
    await fallbackContext.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, options) { return /webgl/.test(type) ? null : getContext.call(this, type, options); };
      window.FishingAquariumDesktop = { send() {}, onSnapshot(fn) { window.fallbackSnapshot = fn; return () => {}; }, onVisibility() { return () => {}; } };
    });
    const fallbackPage = await fallbackContext.newPage(); fallbackPage.on('pageerror', error => errors.push(error.message));
    await fallbackPage.goto('http://aquarium-desktop-review.test/fishing-aquarium-desktop.html', { waitUntil: 'load' });
    await fallbackPage.evaluate(() => {
      const fish = TracerFishingModel.catalog.fish.filter(item => ['gulpuffer', 'grumpangler', 'flopray'].includes(item.id));
      fallbackSnapshot({ desktopVisible: true, language: 'zh', showcase: { fish, selection: { decorationIds: ['water_grass', 'moon_crystal', 'pearl_shell'] } } });
    });
    assert.equal(await fallbackPage.locator('.fishing-aquarium-scene').getAttribute('data-renderer'), 'fallback');
    assert.equal(await fallbackPage.locator('.fishing-aquarium-scene').getAttribute('data-count'), '3');
    assert.equal(await fallbackPage.locator('.fishing-aquarium-scene [data-aquarium-decoration]').count(), 3, 'Fallback retains selected decorations');
    assert.equal(await fallbackPage.locator('.fishing-aquarium-scene svg[data-species]').count(), 3, 'Fallback retains legendary fish');
    await fallbackPage.waitForFunction(() => [...document.images].every(image => image.complete));
    await fallbackPage.screenshot({ path: path.join(output, 'fallback-no-webgl.png'), omitBackground: true });
    await fallbackContext.close();
    report.checks = ['Real transparent 210 × 170 desktop document with zero, one and three legendary fish in Chinese and English', 'One shared WebGL canvas and context for the tank, fish and selected decorations', 'Six legendary species each show swim, idle and play through actual body/fin shader articulation, not just translation', 'Dark and light desktop backgrounds are composited by the real browser; exterior PNG corners remain transparent', 'Reduced motion pauses WebGL and CSS animation; feeding stays static and preference changes resume motion', 'Tank and base capture pointers; exterior passes clicks; hover tools fade', 'Pointer drag and open-aquarium action; F and Space do not trigger aquarium commands', 'Hide disposes renderers and stops WebGL draw calls', 'Account lock clears projection; only a fresh snapshot restores content', 'WebGL failure retains a visible CSS aquarium with the selected fish and decorations'];
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []); assert.deepEqual(blockedRequests, []); report.ok = true;
  } catch (error) {
    report.failure = error.stack || error.message;
    await page?.screenshot({ path: path.join(output, 'failure.png'), omitBackground: true }).catch(() => {});
    throw error;
  } finally {
    Object.assign(report, { errors, warnings, blockedRequests });
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close(); console.log(output);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
