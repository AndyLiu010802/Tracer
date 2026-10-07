'use strict';

// Aquarium-only review in the real app with an isolated, valid local collection.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const F = require('../public/fishing-model'), G = require('../public/task-garden'), M = require('../skins/tracer/model');
const output = fs.mkdtempSync(path.join(__dirname, '../.cache/fishing-aquarium-ui-'));
const data = path.join(output, 'data'); fs.mkdirSync(data);
const workspace = M.emptyWorkspace(); workspace.taskGarden = G.empty();
workspace.taskGarden.market.testCredit = { id: 'aquarium_review_credit', amount: 5000, updatedAt: Date.now() - 100000 };
F.ensure(workspace); const box = F.buyBox(workspace, { random: limit => limit === 10000 ? 9999 : 0 });
assert(box.ok); assert(F.equipRod(workspace, box.rod.id).ok);
for (const [baitId, fishId] of [['worm', 'minnow'], ['stardust', 'gulpuffer'], ['spirit', 'grumpangler'], ['glow', 'flopray'], ['stardust', 'snagglefin']]) {
  assert(F.buyBait(workspace, baitId, 1).ok); assert(F.equipBait(workspace, baitId).ok);
  let seed = 0;
  while (F.createSession(F.read(workspace), { seed }).fishId !== fishId) {
    if (++seed > 10000) throw new Error('No fixture seed for ' + fishId);
  }
  const { session } = F.beginCast(workspace, { seed });
  F.stepSession(session, {}, 800); F.stepSession(session, { release: true }, 0); assert(F.commitCast(workspace, session).ok);
  while (session.phase !== 'bite') F.stepSession(session, {}, 100);
  F.stepSession(session, { hook: true }, 0);
  for (let i = 0; i < 4000 && session.phase === 'reeling'; i++) F.stepSession(session, { holding: session.fishPosition > session.barPosition }, 16);
  assert.equal(session.phase, 'caught'); const caught = F.recordCatch(workspace, session); assert(caught.ok);
}
assert(F.setShowcase(workspace, { decorationIds: ['water_grass', 'moon_crystal', 'pearl_shell'] }).ok);
fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify(workspace));
Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(output, 'state.json') });
const { server } = require('../server');
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const errors = [], failed = [], external = [], report = { layouts: [], checks: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.href); return route.abort(); }
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false } });
      return route.continue();
    });
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext; window.aquariumContexts = [];
      HTMLCanvasElement.prototype.getContext = function(type, options) {
        const gl = getContext.call(this, type, options);
        if (gl && /webgl/.test(type) && !aquariumContexts.includes(gl)) aquariumContexts.push(gl);
        return gl;
      };
    });
    page = await context.newPage();
    page.on('pageerror', value => errors.push(value.message));
    page.on('response', value => { if (value.status() >= 400 && !value.url().includes('/api/ai/')) failed.push([value.status(), value.url()]); });
    const saved = () => page.waitForFunction(() => window.Tracer?.fishing && Tracer.store.base?.fishing && !Tracer.store.dirty && !Tracer.store.inflight && !Tracer.fishing.snapshot().busy);
    const scene = () => page.locator('#sec-cabin [data-aquarium-display] .fishing-aquarium-scene');
    const state = () => page.evaluate(() => TracerFishingModel.read(Tracer.store.data));
    const balance = () => page.evaluate(() => TracerFishingModel.economy(Tracer.store.data).balance);
    const decorationIds = () => scene().evaluate(node => JSON.parse(node.dataset.decorations));
    const clickAction = async (action, id) => { await page.locator('[data-fishing-action="' + action + '"]' + (id ? '[data-value="' + id + '"]' : '')).click(); await saved(); };
    const openEditor = async () => { await page.locator('[data-fishing-action="edit-aquarium-decor"]').click(); const editor = page.locator('[data-showcase-editor]'); await editor.waitFor({ state: 'visible' }); return editor; };
    const changeDecorations = async ids => {
      const editor = await openEditor();
      for (const id of await decorationIds()) await editor.locator('[data-value="' + id + '"]').click();
      for (const id of ids) await editor.locator('[data-value="' + id + '"]').click();
      return editor;
    };
    await page.goto(origin); await saved();
    if (await page.locator('#daily-card-hide').isVisible()) await page.locator('#daily-card-hide').click();
    await page.locator('#aside-slot .fx-panel').waitFor({ state: 'attached' });
    if (await page.locator('.shell').getAttribute('data-rail') !== 'collapsed') await page.locator('.rail-grip').dblclick();
    await page.waitForFunction(() => document.querySelector('.shell')?.dataset.rail === 'collapsed');
    await page.click('#nav-ponds'); assert.equal(await page.locator('[data-fishing-action="place-fry"]').count(), 0, 'Placement belongs to the aquarium');
    await page.click('#nav-cabin'); await scene().waitFor();
    assert.equal(await scene().getAttribute('data-count'), '0', 'Journal discoveries do not create duplicate residents');
    assert.equal(await page.locator('[data-fishing-action="place-aquarium-fish"]').count(), 4, 'Only real legendary fry appear in the nursery');
    const originalFry = (await state()).fry, legendaryFry = originalFry.filter(fry => F.catalog.fish.find(fish => fish.id === fry.fishId).rarity === 'legendary');
    for (const fry of legendaryFry.slice(0, 3)) await clickAction('place-aquarium-fish', fry.id);
    assert.equal(await scene().getAttribute('data-count'), '3');
    assert.equal(await page.locator('[data-fishing-action="place-aquarium-fish"][data-value="' + legendaryFry[3].id + '"]').isDisabled(), true, 'Fourth resident is blocked at the three-fish limit');
    const firstResidents = (await state()).aquarium.fryIds;
    await page.reload(); await saved(); await page.click('#nav-cabin'); await scene().waitFor();
    assert.deepEqual((await state()).aquarium.fryIds, firstResidents, 'Resident IDs survive save and reload');
    const beforeFeed = await balance(); await clickAction('feed-aquarium');
    assert.equal(await balance(), beforeFeed - 5);
    assert((await state()).fry.filter(fry => firstResidents.includes(fry.id)).every(fry => fry.growth === 20 && fry.fedAt !== null));
    assert.equal(await page.locator('[data-fishing-action="feed-aquarium"]').isDisabled(), true, 'Feeding cannot charge twice');
    assert.equal(await scene().locator('.fishing-aquarium-volume[data-feeding="true"]').count(), 1, 'One shared renderer handles all feeding reactions');
    await scene().screenshot({ path: path.join(output, 'feeding.png') });
    const returnedFish = (await state()).fry.find(fry => fry.id === firstResidents[0]);
    await clickAction('take-aquarium-fish', firstResidents[0]);
    assert.deepEqual((await state()).fry.find(fry => fry.id === returnedFish.id), returnedFish, 'Taking a fish out preserves growth and feeding history');
    await clickAction('place-aquarium-fish', legendaryFry[3].id);
    assert.equal((await state()).fry.length, originalFry.length);
    const priorDecorations = await decorationIds(), beforeDecorState = await state(), beforeDecorBalance = await balance();
    let editor = await changeDecorations(['pebble_garden', 'jade_arch', 'sunken_chest']);
    assert.equal(await editor.locator('[data-fishing-action="showcase-decoration"]').count(), 6, 'All six decorations stay available');
    assert.deepEqual(await decorationIds(), ['pebble_garden', 'jade_arch', 'sunken_chest'], 'Changes preview immediately');
    await editor.locator('[data-fishing-action="cancel-showcase"]').click();
    assert.deepEqual(await decorationIds(), priorDecorations, 'Cancel restores the saved scenery');
    editor = await changeDecorations(['water_grass', 'pearl_shell', 'jade_arch']);
    await editor.locator('[data-fishing-action="save-showcase"]').click(); await saved();
    const afterDecorState = await state();
    assert.equal(await balance(), beforeDecorBalance, 'Decorating is free');
    for (const key of ['fry', 'catches', 'transactions', 'boxes', 'casts']) assert.deepEqual(afterDecorState[key], beforeDecorState[key], 'Decorating preserves ' + key);
    const retainedResidents = afterDecorState.aquarium.fryIds, parentCatch = afterDecorState.fry.find(fry => fry.id === retainedResidents[0]).catchId;
    await page.locator('[data-fishing-action="sell-fish"][data-value="' + parentCatch + '"]').click();
    await page.locator('[data-task-action="confirm"]').waitFor();
    assert.equal((await state()).catches.find(caught => caught.id === parentCatch).soldAt, null, 'A legendary sale waits for its reminder confirmation');
    await page.locator('[data-task-action="confirm"]').click(); await saved();
    assert((await state()).catches.find(caught => caught.id === parentCatch).soldAt !== null);
    assert.deepEqual((await state()).aquarium.fryIds, retainedResidents, 'Selling the parent catch preserves aquarium residents');
    await page.reload(); await saved(); await page.click('#nav-cabin'); await scene().waitFor();
    assert.deepEqual((await state()).aquarium.fryIds, retainedResidents);
    assert.deepEqual(await decorationIds(), ['water_grass', 'pearl_shell', 'jade_arch'], 'Decorations survive save and reload');
    for (const count of [3, 1, 0]) {
      for (const id of (await state()).aquarium.fryIds.slice(count)) await clickAction('take-aquarium-fish', id);
      assert.equal(await scene().getAttribute('data-count'), String(count));
      for (const language of ['zh', 'en']) for (const width of [1500, 390]) {
      await page.setViewportSize({ width, height: 1050 }); await page.selectOption('#language-select', language);
      await scene().scrollIntoViewIfNeeded(); await page.waitForTimeout(260);
      const layout = await page.locator('#sec-cabin .fishing-page').evaluate(element => {
        const scene = element.querySelector('.fishing-aquarium-scene'), tank = scene.querySelector('.fishing-aquarium-tank');
        const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        return { width: element.clientWidth, scrollWidth: element.scrollWidth, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, scene: box(scene), tank: box(tank), fish: Number(scene.dataset.count), renderer: scene.dataset.renderer, decorations: JSON.parse(scene.dataset.decorations) };
      });
      assert(layout.scrollWidth <= layout.width + 1 && layout.pageWidth <= layout.viewport + 1, 'Aquarium page has no horizontal overflow');
      assert.equal(layout.fish, count); assert.equal(layout.decorations.length, 3);
      assert.equal(layout.renderer, 'webgl'); assert.equal(await scene().locator('canvas').count(), 1);
      assert(layout.tank.width > 180 && layout.tank.height > 80, 'Tank remains visible at narrow width');
      report.layouts.push({ count, language, width, ...layout });
      const suffix = count + '-' + language + '-' + width + '.png';
      await page.locator('#sec-cabin .fishing-aquarium-feature').screenshot({ path: path.join(output, 'aquarium-' + suffix) });
      editor = await openEditor();
      const editorBounds = await editor.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
      assert(editorBounds.scroll <= editorBounds.client + 1, 'Decoration editor has no horizontal overflow');
      await editor.screenshot({ path: path.join(output, 'decorations-' + suffix) });
      await editor.locator('[data-fishing-action="cancel-showcase"]').click();
      await page.locator('[data-fishing-action="pin-aquarium"]').click();
      const preview = page.locator('.fishing-aquarium-preview'); await preview.waitFor();
      const bounds = await preview.evaluate(node => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, x: node.getBoundingClientRect().x, right: node.getBoundingClientRect().right, viewport: innerWidth }));
      assert(bounds.scrollWidth <= bounds.clientWidth + 1 && bounds.x >= 0 && bounds.right <= bounds.viewport + 1, 'Preview stays within viewport');
      assert.equal(await preview.locator('.fishing-aquarium-scene').getAttribute('data-count'), String(count));
      assert.equal(await preview.locator('.fishing-aquarium-volume').getAttribute('data-aquarium-fish-count'), String(count));
      assert.deepEqual(await preview.locator('.fishing-aquarium-scene').evaluate(node => JSON.parse(node.dataset.decorations)), await decorationIds(), 'Desktop preview matches the saved aquarium');
      await preview.locator('canvas').evaluate(node => { window.previewAquariumContext = node.getContext('webgl'); });
      await preview.screenshot({ path: path.join(output, 'preview-' + suffix) });
      await preview.locator('[data-close]').click(); await preview.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => previewAquariumContext.isContextLost()), true, 'Closing a preview releases its WebGL context');
      }
    }
    editor = await changeDecorations([]);
    await editor.locator('[data-fishing-action="save-showcase"]').click(); await saved();
    await page.reload(); await saved(); await page.click('#nav-cabin'); await scene().waitFor();
    assert.deepEqual(await decorationIds(), [], 'An explicitly empty layout stays empty after reload');
    for (const fry of legendaryFry.slice(0, 3)) await clickAction('place-aquarium-fish', fry.id);
    editor = await changeDecorations(['water_grass', 'moon_crystal', 'pearl_shell']);
    await editor.locator('[data-fishing-action="save-showcase"]').click(); await saved();
    await scene().scrollIntoViewIfNeeded(); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#sec-cabin .fishing-aquarium-volume')?.dataset.aquariumMotion === 'reduced');
    assert.equal(await scene().evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0, 'Reduced motion stops CSS ambient animation');
    await scene().screenshot({ path: path.join(output, 'reduced-motion-en-390.png') });
    report.reducedMotion = await scene().evaluate(node => { const host = node.querySelector('.fishing-aquarium-volume'), canvas = host.querySelector('canvas'), rect = host.getBoundingClientRect(); return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches, hidden: document.hidden, marker: host.dataset.aquariumMotion, contextLost: canvas.getContext('webgl').isContextLost(), y: rect.y, bottom: rect.bottom, viewportHeight: innerHeight }; });
    assert.equal(await scene().locator('.fishing-aquarium-volume').getAttribute('data-aquarium-motion'), 'reduced');
    await page.click('#nav-rods');
    assert.equal(await page.evaluate(() => aquariumContexts.filter(gl => !gl.isContextLost()).length), 0, 'Leaving the aquarium releases its contexts');
    assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(external, []);
    report.checks = ['Real legendary fry only; journal discoveries do not create copies; pond placement is absent', 'Three-fish limit and saved resident IDs survive reload', 'Feeding costs five coins, grows all residents and cannot double-charge', 'Taking out preserves growth and feeding; another legendary fish can move in', 'Selling a legendary parent requires confirmation and retains its resident fry', 'Six free decorations support preview, cancel, save and empty clear across reload without changing possessions', 'Real application hero, editor and desktop preview with 0/1/3 residents at 1500/390 pixels in Chinese and English', 'One shared WebGL renderer and selected decoration projection', 'Reduced motion pauses ambient animation; closing previews and leaving the aquarium releases contexts', 'No script errors, failed asset requests or external requests'];
    report.ok = true; report.passed = true;
  } catch (error) {
    report.failure = error.stack || error.message;
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    Object.assign(report, { errors, failed, external }); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser?.close(); await new Promise(resolve => server.close(resolve)); console.log(output);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
