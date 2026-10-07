'use strict';
// Desktop renderer integration, actual WebGL pixels and native bridge messages.
// All fish, snapshots and browser storage are isolated from saved accounts.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'skins/tracer');
const out = fs.mkdtempSync(path.join(root, '.cache/fishing-aquarium-rotation-'));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = { out, angles: [], transitions: [], checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 210, height: 170 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url()), file = path.resolve(assets, '.' + url.pathname);
      if (url.origin !== 'http://aquarium-rotation.test' || !file.startsWith(assets + path.sep) || !fs.existsSync(file)) return route.abort();
      return route.fulfill({ path: file });
    });
    await context.addInitScript(() => {
      let clock = 0, rafId = 0;
      const callbacks = new Map(), snapshots = new Set(), menus = new Set(), visibility = new Set();
      Object.defineProperty(performance, 'now', { value: () => clock });
      window.requestAnimationFrame = fn => { callbacks.set(++rafId, fn); return rafId; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      window.advanceAquarium = ms => { clock += ms; const pending = [...callbacks]; callbacks.clear(); for (const [, fn] of pending) fn(clock); };
      window.rotationAudit = { messages: [], resources: {}, contexts: [], uniforms: {}, shadowDraws: 0, frames: new Map(), callbacks, snapshots, menus, visibility };
      const subscribe = set => fn => (set.add(fn), () => set.delete(fn));
      window.FishingAquariumDesktop = {
        send: value => { if (value.type === 'input-regions') rotationAudit.lastRegions = value.value; rotationAudit.messages.push({ ...value, at: clock, yaw: Number(document.querySelector('.fishing-aquarium-volume')?.dataset.aquariumYaw) }); },
        onSnapshot: subscribe(snapshots), onMenuAction: subscribe(menus), onVisibility: subscribe(visibility)
      };
      window.sendAquariumSnapshot = value => { for (const fn of snapshots) fn(value); };
      window.setAquariumVisibility = value => { for (const fn of visibility) fn(value); };
      const proto = WebGLRenderingContext.prototype, locations = new WeakMap();
      const getLocation = proto.getUniformLocation, uniform1f = proto.uniform1f, draw = proto.drawArrays, getContext = HTMLCanvasElement.prototype.getContext;
      proto.getUniformLocation = function(program, name) { const value = getLocation.call(this, program, name); if (value) locations.set(value, name); return value; };
      proto.uniform1f = function(location, value) { const name = location && locations.get(location); if (name) rotationAudit.uniforms[name] = value; return uniform1f.call(this, location, value); };
      proto.drawArrays = function(...args) { if (rotationAudit.uniforms.uShadowPass === 1) rotationAudit.shadowDraws++; return draw.apply(this, args); };
      HTMLCanvasElement.prototype.getContext = function(...args) { const gl = getContext.apply(this, args); if (gl && /webgl/.test(args[0]) && !rotationAudit.contexts.includes(gl)) rotationAudit.contexts.push(gl); return gl; };
      for (const kind of ['Buffer', 'Texture', 'Program', 'Framebuffer', 'Renderbuffer']) {
        const create = proto['create' + kind], remove = proto['delete' + kind], live = new Set();
        rotationAudit.resources[kind] = live;
        proto['create' + kind] = function(...args) { const value = create.apply(this, args); if (value) live.add(value); return value; };
        proto['delete' + kind] = function(value) { live.delete(value); return remove.call(this, value); };
      }
      window.captureAquariumFrame = key => {
        const shadowBefore = rotationAudit.shadowDraws;
        // A fresh synchronous draw is necessary: the compositor is allowed to
        // clear this alpha drawing buffer between animation frames.
        window.dispatchEvent(new Event('resize'));
        const canvas = document.querySelector('canvas'), gl = rotationAudit.contexts.at(-1);
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let edgeAlpha = 0, visible = 0, upperOpaque = 0, upperBlack = 0, hash = 2166136261;
        let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4, alpha = pixels[i + 3];
          if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) edgeAlpha = Math.max(edgeAlpha, alpha);
          if (alpha > 8) { visible++; minX = Math.min(x, minX); maxX = Math.max(x, maxX); minY = Math.min(y, minY); maxY = Math.max(y, maxY); }
          // The upper tank must not turn into an opaque black glass pane.
          // readPixels is bottom-up; omit the dark wood base and contact shadow.
          if (y > canvas.height * .43 && alpha > 220) { upperOpaque++; if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 18) upperBlack++; }
          for (let j = 0; j < 4; j++) hash = Math.imul(hash ^ pixels[i + j], 16777619) >>> 0;
        }
        if (key) rotationAudit.frames.set(key, pixels);
        const hits = [...document.querySelectorAll('.fishing-aquarium-tank,.fishing-aquarium-base')].map(node => { const b = node.getBoundingClientRect(); return { x: b.x / innerWidth, y: b.y / innerHeight, width: b.width / innerWidth, height: b.height / innerHeight }; });
        return { yaw: Number(document.querySelector('.fishing-aquarium-volume').dataset.aquariumYaw), hash, edgeAlpha, visible, upperOpaque, upperBlack, blackRatio: upperBlack / Math.max(1, upperOpaque), pixelBounds: [minX, minY, maxX, maxY], canvas: [canvas.width, canvas.height], hits, regions: rotationAudit.lastRegions, shadowDraws: rotationAudit.shadowDraws - shadowBefore, shadows: document.querySelector('.fishing-aquarium-volume').dataset.shadows, contexts: rotationAudit.contexts.length, glError: gl.getError() };
      };
      window.compareAquariumFrames = (a, b) => {
        const first = rotationAudit.frames.get(a), next = rotationAudit.frames.get(b);
        let changed = 0, strong = 0, total = 0;
        for (let i = 0; i < first.length; i += 4) { let d = 0; for (let j = 0; j < 4; j++) d += Math.abs(first[i + j] - next[i + j]); if (d) changed++; if (d > 24) strong++; total += d; }
        return { changed, strong, total, pixels: first.length / 4 };
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://aquarium-rotation.test/fishing-aquarium-desktop.html');
    await page.evaluate(() => {
      const fish = ['gulpuffer', 'grumpangler', 'flopray'].map(id => ({ ...TracerFishingModel.catalog.fish.find(f => f.id === id), id: 'rotation-' + id, speciesId: id, fishId: id, growth: 100 }));
      window.aquariumFixture = { accountScope: 'isolated-rotation-review', accountGeneration: 1, accountRestoreId: 'rotation-review', nativeSessionId: 'rotation-review', desktopVisible: true, desktopYaw: 0, language: 'zh', showcase: { fish, selection: { decorationIds: ['sunken_astrolabe', 'jade_arch', 'coral_conch'] } } };
      window.originalShowcaseSignature = JSON.stringify(aquariumFixture.showcase);
      sendAquariumSnapshot(aquariumFixture);
      document.body.style.background = '#e8e1d5';
    });
    await page.waitForSelector('.fishing-aquarium-volume[data-aquarium-yaw]');
    await page.waitForLoadState('networkidle');
    const resources = await page.evaluate(() => Object.fromEntries(Object.entries(rotationAudit.resources).map(([key, value]) => [key, value.size])));
    const assertFrame = (frame, label) => {
      assert.equal(frame.glError, 0, label + ': WebGL error');
      assert.equal(frame.contexts, 1, label + ': changing angle reuses the same context');
      assert.equal(frame.shadows, 'pcf');
      assert(frame.shadowDraws > 50, label + ': actual geometry participates in the shadow pass');
      assert(frame.edgeAlpha <= 1, label + ': no shadow or geometry clipping at native window edges: ' + frame.edgeAlpha);
      assert(frame.visible > 3000, label + ': a visible aquarium is rendered');
      assert(frame.blackRatio < .025, label + ': glass is not an opaque black pane: ' + frame.blackRatio);
      assert.equal(frame.hits.length, 2); assert.equal(frame.regions.length, 2);
      for (let i = 0; i < 2; i++) for (const field of ['x', 'y', 'width', 'height']) assert(Math.abs(frame.hits[i][field] - frame.regions[i][field]) < .0001, label + ': native input regions match projected DOM bounds: ' + field);
    };
    for (const [name, width, height] of [['half', 210, 170], ['enlarged', 525, 425]]) {
      await page.setViewportSize({ width, height });
      for (const yaw of [0, 15, -15, 45, -45, 90, 180, 270, 0]) {
        const index = report.angles.length, key = name + '-' + index;
        const frame = await page.evaluate(({ yaw, key }) => { aquariumFixture.desktopYaw = yaw; sendAquariumSnapshot(aquariumFixture); return captureAquariumFrame(key); }, { yaw, key });
        assert.equal(frame.yaw, ((yaw % 360 + 540) % 360) - 180, 'reduced motion immediately reaches the requested view');
        assertFrame(frame, name + ' ' + yaw);
        assert(frame.canvas[0] >= width * 1.6, 'the desktop zoom renders at an appropriate resolution');
        const file = name + '-yaw-' + yaw + (index % 9 === 8 ? '-returned' : '') + '.png';
        await page.screenshot({ path: path.join(out, file), omitBackground: true });
        report.angles.push({ name, requestedYaw: yaw, key, file, ...frame });
      }
      const frames = report.angles.filter(frame => frame.name === name);
      const pixels = await page.evaluate(keys => ({ left: compareAquariumFrames(keys[0], keys[2]), right: compareAquariumFrames(keys[0], keys[1]), returned: compareAquariumFrames(keys[0], keys[8]), opposite: compareAquariumFrames(keys[3], keys[4]) }), frames.map(frame => frame.key));
      assert(pixels.left.strong > 500 && pixels.right.strong > 500, 'both directions must produce actual perspective changes');
      assert.equal(pixels.returned.changed, 0, 'returning to zero in reduced motion reproduces the same pixels');
      assert(pixels.opposite.strong > 500, 'left and right perspectives must look different');
      report.checks.push({ name, pixels });
    }
    // Dark desktops exercise the same alpha glass composition at all faces.
    for (const yaw of [0, 90, 180, 270]) {
      await page.evaluate(yaw => { document.body.style.background = '#182728'; aquariumFixture.desktopYaw = yaw; sendAquariumSnapshot(aquariumFixture); captureAquariumFrame(); }, yaw);
      await page.screenshot({ path: path.join(out, 'enlarged-dark-yaw-' + yaw + '.png'), omitBackground: true });
    }
    await page.evaluate(() => { document.body.style.background = '#e8e1d5'; aquariumFixture.desktopYaw = 0; sendAquariumSnapshot(aquariumFixture); });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.querySelector('.fishing-aquarium-volume').dataset.aquariumMotion === 'live', null, { polling: 50 });
    for (const [from, target] of [[0, 15], [170, -170], [-170, 170]]) {
      // Set a known starting view without advancing the fish simulation.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.querySelector('.fishing-aquarium-volume').dataset.aquariumMotion === 'reduced', null, { polling: 50 });
      await page.evaluate(from => { aquariumFixture.desktopYaw = from; sendAquariumSnapshot(aquariumFixture); }, from);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => document.querySelector('.fishing-aquarium-volume').dataset.aquariumMotion === 'live', null, { polling: 50 });
      const result = await page.evaluate(target => {
        rotationAudit.messages.length = 0;
        aquariumFixture.desktopYaw = target; sendAquariumSnapshot(aquariumFixture);
        const frames = [captureAquariumFrame()];
        for (let i = 0; i < 8; i++) { advanceAquarium(35); sendAquariumSnapshot(aquariumFixture); frames.push(captureAquariumFrame()); }
        return { frames, regions: rotationAudit.messages.filter(m => m.type === 'input-regions') };
      }, target);
      assert.equal(result.frames[0].yaw, from, 'rotation starts at the currently displayed view');
      assert.equal(result.frames.at(-1).yaw, target, 'rotation reaches the final view in 280 ms');
      const delta = ((target - from + 540) % 360) - 180;
      let previous = 0;
      for (const frame of result.frames) {
        assertFrame(frame, 'transition ' + from + ' to ' + target);
        const traveled = ((frame.yaw - from + 540) % 360) - 180;
        assert(Math.abs(traveled) <= Math.abs(delta) + .001, 'the transition follows the short arc');
        assert(traveled * Math.sign(delta) >= previous - .001, 'the transition moves continuously toward the target');
        previous = traveled * Math.sign(delta);
      }
      assert(result.frames[1].yaw !== from && result.frames[1].yaw !== target, 'there is a genuine intermediate pose');
      assert(result.regions.length >= 5, 'intermediate camera frames publish updated native hit regions');
      assert.notDeepEqual(result.frames[1].regions, result.frames.at(-1).regions, 'intermediate and final hit regions differ');
      report.transitions.push({ from, target, ...result });
    }
    // Pointer handling remains moving the window, not rotating the fish or tank.
    const center = await page.locator('.fishing-aquarium-tank').boundingBox();
    await page.evaluate(() => { rotationAudit.messages.length = 0; });
    await page.mouse.move(center.x + center.width * .5, center.y + center.height * .5);
    await page.mouse.down(); await page.mouse.move(center.x + center.width * .5 + 22, center.y + center.height * .5 + 10, { steps: 4 }); await page.mouse.up();
    await page.mouse.click(center.x + center.width * .5, center.y + center.height * .5, { button: 'right' });
    const pointer = await page.evaluate(() => ({ types: rotationAudit.messages.map(message => message.type), yaw: Number(document.querySelector('.fishing-aquarium-volume').dataset.aquariumYaw), dragging: document.querySelector('#aquarium-frame').dataset.dragging }));
    assert(pointer.types.includes('drag-start') && pointer.types.includes('drag-move') && pointer.types.includes('drag-end'));
    assert(pointer.types.includes('context-menu')); assert.equal(pointer.yaw, 170); assert.equal(pointer.dragging, 'false');
    report.checks.push({ pointer });
    // A preference change mid-turn must settle the view immediately and stop RAF.
    await page.evaluate(() => { aquariumFixture.desktopYaw = -45; sendAquariumSnapshot(aquariumFixture); advanceAquarium(70); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.fishing-aquarium-volume').dataset.aquariumMotion === 'reduced', null, { polling: 50 });
    const reduced = await page.evaluate(() => { const before = captureAquariumFrame('reduced-before'); advanceAquarium(3000); const after = captureAquariumFrame('reduced-after'); return { before, after, difference: compareAquariumFrames('reduced-before', 'reduced-after'), raf: rotationAudit.callbacks.size, sameShowcase: originalShowcaseSignature === JSON.stringify(aquariumFixture.showcase), resources: Object.fromEntries(Object.entries(rotationAudit.resources).map(([key, value]) => [key, value.size])) }; });
    assert.equal(reduced.before.yaw, -45); assert.equal(reduced.after.yaw, -45); assert.equal(reduced.difference.changed, 0); assert.equal(reduced.raf, 0); assert.equal(reduced.sameShowcase, true); assert.deepEqual(reduced.resources, resources);
    report.checks.push({ reduced });
    const hidden = await page.evaluate(() => { setAquariumVisibility({ visible: false }); return { canvas: document.querySelectorAll('canvas').length, resources: Object.fromEntries(Object.entries(rotationAudit.resources).map(([key, value]) => [key, value.size])), raf: rotationAudit.callbacks.size, lost: rotationAudit.contexts.every(gl => gl.isContextLost()) }; });
    assert.equal(hidden.canvas, 0); assert.equal(hidden.raf, 0); assert.equal(hidden.lost, true); assert(Object.values(hidden.resources).every(value => value === 0));
    const restored = await page.evaluate(() => { aquariumFixture.desktopYaw = 90; sendAquariumSnapshot(aquariumFixture); return captureAquariumFrame(); });
    assert.equal(restored.yaw, 90, 'a restored desktop starts at its saved angle on its first paint');
    const cleanup = await page.evaluate(() => { window.dispatchEvent(new Event('beforeunload')); return { resources: Object.fromEntries(Object.entries(rotationAudit.resources).map(([key, value]) => [key, value.size])), raf: rotationAudit.callbacks.size, subscribers: rotationAudit.snapshots.size + rotationAudit.menus.size + rotationAudit.visibility.size, lost: rotationAudit.contexts.every(gl => gl.isContextLost()) }; });
    assert(Object.values(cleanup.resources).every(value => value === 0)); assert.equal(cleanup.raf, 0); assert.equal(cleanup.subscribers, 0); assert.equal(cleanup.lost, true); assert.deepEqual(errors, []);
    report.checks.push({ hidden, restored, cleanup, errors });
    report.passed = true;
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ out, passed: report.passed, angleFrames: report.angles.length, smoothTransitions: report.transitions.length, checks: report.checks.length }));
})().catch(error => { console.error(out); console.error(error); process.exitCode = 1; });
