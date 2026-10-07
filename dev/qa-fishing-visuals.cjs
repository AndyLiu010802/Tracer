'use strict';

// Isolated visual review: uses production art and motion, without account data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(root, '.cache/fishing-visuals-'));
const files = new Set(['fishing-model.js', 'fishing-lighting.js', 'fishing-art.js', 'fishing-rod-effects.js', 'fishing-motion.js', 'fishing-rod-renderer.js', 'fishing-game.js', 'fishing-scene.css', 'fishing-art/rods-model-v1.png', 'fishing-art/fish-model-v1.png']);
const documentSource = `<!doctype html><meta charset="utf-8"><title>Fishing visual review</title>
<link rel="stylesheet" href="/fishing-scene.css"><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#101b20;color:#efe4c7;font:14px system-ui}
h1{font:32px Georgia,serif;margin:0 0 8px}p{color:#aebdb6;margin:0 0 26px}.sheet{padding:26px;background:#18282a;border:1px solid #506364;border-radius:18px;margin-bottom:30px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}.card{background:radial-gradient(ellipse at 48% 38%,#36545a,#182d33 73%);border:1px solid #547070;border-radius:12px;padding:18px;min-width:0;overflow:hidden}
.card>svg{display:block;width:100%;height:330px;margin:0}.card strong{display:block;text-align:center;margin-top:12px;font-size:15px}.card small{display:block;text-align:center;color:#b1c7bd;margin-top:5px}.fish .card>svg{height:140px}
#live-review{display:grid;grid-template-columns:300px 1fr;gap:28px}#live-portrait>svg{height:480px;width:100%}#game{width:760px;align-self:center}.sr-only{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden}
</style><section class="sheet" id="rod-sheet"><h1>鱼竿 · 造型与主题光效</h1><p>共用动作骨架 / 17 款独立材质与主题饰件</p><div class="grid" id="rods"></div></section>
<section class="sheet fish" id="fish-sheet"><h1>水生图鉴</h1><p>图鉴与钓起的鱼使用同一套模型</p><div class="grid" id="fish"></div></section>
<section class="sheet" id="live-sheet"><h1>收藏预览与钓鱼现场</h1><p id="live-name"></p><div id="live-review"><div class="card" id="live-portrait"></div><div id="game"></div></div></section>
${['fishing-model', 'fishing-lighting', 'fishing-art', 'fishing-rod-effects', 'fishing-motion', 'fishing-rod-renderer', 'fishing-game'].map(name => '<script src="/' + name + '.js"></script>').join('')}`;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], warnings = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.5, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url()), file = url.pathname.slice(1);
      if (url.origin !== 'http://fishing-visuals.test') return route.abort();
      if (!file) return route.fulfill({ contentType: 'text/html', body: documentSource });
      if (!files.has(file)) return route.fulfill({ status: 404 });
      return route.fulfill({ path: path.join(root, 'skins/tracer', file) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text()); });
    await page.goto('http://fishing-visuals.test/');
    await page.evaluate(() => {
      const { catalog } = TracerFishingModel;
      document.querySelector('#fish-sheet h1').textContent = '水生图鉴 · ' + catalog.fish.length + ' 种鱼';
      document.getElementById('rods').innerHTML = catalog.rods.map(rod => '<article class="card" data-item="' + rod.id + '">' + TracerFishingArt.rodMarkup(rod) + '<strong>' + rod.name[0] + '</strong><small>' + rod.name[1] + '</small></article>').join('');
      document.getElementById('fish').innerHTML = catalog.fish.map(fish => '<article class="card" data-item="' + fish.id + '">' + TracerFishingArt.fishMarkup(fish) + '<strong>' + fish.name[0] + '</strong><small>' + fish.name[1] + '</small></article>').join('');
      window.reviewGame = TracerFishingGame.create(document.getElementById('game'));
      window.reviewRod = (id, phase = 'idle') => {
        const rod = catalog.rods.find(item => item.id === id);
        document.getElementById('live-name').textContent = rod.name[0] + ' / ' + phase;
        document.getElementById('live-portrait').innerHTML = TracerFishingArt.rodMarkup(rod);
        reviewGame.update({ rod, catalog, fish: catalog.fish.find(fish => fish.id === 'dragonkoi'), bait: catalog.baits[0], session: { id: 'visual-' + id, phase, tension: .72, holding: true, castPower: .8, progress: .4, fishBehavior: 'surge', stamina: .6, barPosition: .5, fishPosition: .55 } });
      };
      reviewRod('astral');
    });
    await page.waitForFunction(() => document.querySelector('.fishing-game-rod')?.dataset.rodFlex === 'ready');
    await page.evaluate(async () => {
      await Promise.all([...new Set([...document.querySelectorAll('svg image')].map(image => image.getAttribute('href')))].map(src => new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = src; })));
    });
    assert.equal(await page.locator('#rods .card').count(), 17);
    assert.equal(await page.locator('#fish .card').count(), await page.evaluate(() => TracerFishingModel.catalog.fish.length));
    const effects = await page.evaluate(() => TracerFishingModel.catalog.rods.map(rod => {
      const card = document.querySelector('#rods [data-item="' + rod.id + '"]');
      return { id: rod.id, expected: !!TracerFishingMotion.fxProfile(rod), present: !!card.querySelector('.fishing-catalog-fx'), animations: card.getAnimations({ subtree: true }).length };
    }));
    for (const item of effects) {
      assert.equal(item.present, item.expected, item.id + ' has the matching theme effect');
      if (item.expected) assert(item.animations > 0, item.id + ' effect animates');
    }
    await page.locator('#rod-sheet').screenshot({ path: path.join(output, 'rods.png') });
    await page.locator('#fish-sheet').screenshot({ path: path.join(output, 'fish.png') });
    for (const id of ['frost', 'moon', 'phoenix', 'cloud', 'astral', 'dragon', 'lotus', 'guandao', 'katana']) {
      await page.evaluate(id => reviewRod(id, 'reeling'), id);
      await page.locator('#live-sheet').scrollIntoViewIfNeeded();
      await page.waitForTimeout(650);
      assert.equal(await page.locator('.fishing-motion-fx').isVisible(), true, id + ' live effect is visible');
      await page.locator('#live-sheet').screenshot({ path: path.join(output, id + '-live.png') });
    }
    for (const [id, phase, delay, kind] of [['katana', 'cast', 180, 'slash'], ['guandao', 'reeling', 200, 'slash'], ['katana', 'caught', 1000, 'slash'], ['guandao', 'caught', 1080, 'dragon'], ['jade', 'caught', 1080, 'dragon']]) {
      await page.evaluate(id => reviewRod(id), id);
      await page.evaluate(({ id, phase }) => reviewRod(id, phase), { id, phase });
      await page.waitForTimeout(delay);
      const action = page.locator(id==='jade'?'.fishing-action-fx':'.fishing-flow-canvas');
      assert.equal(await action.isVisible(), true, id + ' ' + phase + ' action appears');
      assert.equal(await action.getAttribute(id==='jade'?'data-kind':'data-event'),id==='jade'?kind:phase);
      await page.locator('#live-sheet').screenshot({ path: path.join(output, id + '-' + phase + '.png') });
    }
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.fishing-action-fx').isVisible(), false, 'catch flourish finishes automatically');
    const signatureIds=await page.evaluate(()=>TracerFishingModel.catalog.rods.filter(r=>['epic','legendary'].includes(r.rarity)).map(r=>r.id));
    for(const width of [760,380]){
      await page.locator('#game').evaluate((node,width)=>node.style.width=width+'px',width);
      for(const id of signatureIds){
        await page.evaluate(id=>reviewRod(id,'waiting'),id);await page.waitForTimeout(90);
        assert.equal(await page.locator('.fishing-flow-canvas').getAttribute('data-variant'),id);
        assert.equal(await page.locator('.fishing-motion-fx .rod-spirit,.fishing-signature-event').count(),0,'no detached emblem overlays');
        for(const phase of ['cast','caught']){
          await page.evaluate(({id,phase})=>reviewRod(id,phase),{id,phase});await page.waitForTimeout(phase==='caught'?1050:190);
          const effect=page.locator('.fishing-flow-canvas');assert.equal(await effect.isVisible(),true,id+' '+phase+' '+width);
          assert.equal(await effect.getAttribute('data-variant'),id);assert.equal(await effect.getAttribute('data-phase'),phase);
          assert.equal(await effect.getAttribute('data-event'),phase);assert(Number(await effect.getAttribute('data-event-alpha'))>.3,'continuous surface has an active envelope');
          if(phase==='caught')await page.locator('#live-sheet').screenshot({path:path.join(output,id+'-signature-'+width+'.png')});
        }
      }
    }
    await page.waitForTimeout(1150);assert.equal(await page.locator('.fishing-flow-canvas').getAttribute('data-event'),'','every finish ends before result controls');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(80);
    const moving = await page.locator('#rods').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length);
    assert.equal(moving, 0, 'reduced motion freezes catalogue effects');
    for(const id of signatureIds){await page.evaluate(id=>reviewRod(id,'cast'),id);await page.waitForTimeout(180);assert(Number(await page.locator('.fishing-flow-canvas').getAttribute('data-event-alpha'))<=.18,'quiet surface stays faint');}
    await page.locator('#rod-sheet').screenshot({ path: path.join(output, 'rods-reduced-motion.png') });
    await page.evaluate(() => reviewGame.destroy());
    assert.equal(await page.locator('#game canvas').count(), 0, 'closing releases model surfaces');
    const fallback = await page.evaluate(() => {
      const host = document.getElementById('live-portrait'), original = HTMLCanvasElement.prototype.getContext;
      host.innerHTML = ''; host.style.height = '480px'; host.style.position = 'relative';
      HTMLCanvasElement.prototype.getContext = function (kind, options) { return /webgl/.test(kind) ? null : original.call(this, kind, options); };
      try {
        window.reviewFallback = TracerFishingRodRenderer.create(host, { rod: TracerFishingModel.catalog.rods.find(rod => rod.id === 'guandao'), bend: .12 });
        return { kind: reviewFallback.kind, ready: host.dataset.rodFlex, triangles: reviewFallback.getGeometry().triangles };
      } finally { HTMLCanvasElement.prototype.getContext = original; }
    });
    assert.equal(fallback.kind, 'canvas2d'); assert.equal(fallback.ready, 'ready');
    await page.locator('#live-portrait').screenshot({ path: path.join(output, 'guandao-canvas-fallback.png') });
    await page.evaluate(() => reviewFallback.destroy());
    assert.deepEqual(errors, []);
    assert(!warnings.some(warning => /too many active|INVALID_|shader.*error/i.test(warning)), 'no WebGL context exhaustion or render errors');
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, effects, signatureIds, fallback, errors, warnings }, null, 2));
    console.log('PASS all eight exclusive signatures, cast/catch in full and compact scenes, catalogue consistency, reduced motion, Canvas fallback and cleanup. Artifacts: ' + output);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); console.error('Artifacts: ' + output); process.exitCode = 1; });
