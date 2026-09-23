'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..'), output = fs.mkdtempSync(path.join(root, '.cache/garden-props-'));
Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: path.join(output, 'data'), DOCS_PORTAL_STATE_FILE: path.join(output, 'bookmarks.json') });
const { server } = require('../server');
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/?sec=garden');
    await page.waitForFunction(() => window.TracerGardenWorldView);
    await page.evaluate(() => {
      const host = document.createElement('section'); host.id = 'qa-props'; host.className = 'garden-home';
      host.style.cssText = 'position:fixed;inset:0;overflow:auto;z-index:99999;border-radius:0;padding:0';
      document.body.appendChild(host);
      window.propsView = TracerGardenWorldView(host, null, () => {});
      window.propsSnapshot = { language: 'en', plots: [], journey: { level: 3, xp: 80, next: 150, progress: .5, milestones: [] } };
      propsView.update(propsSnapshot);
    });
    await page.waitForFunction(() => document.querySelector('#qa-props .garden-world').dataset.art === 'ready');
    const pixels = await page.evaluate(async () => {
      const urls = [...new Set([...document.querySelectorAll('#qa-props .garden-world-prop')].map(el => el.getAttribute('href')))];
      urls.push('/garden-art/garden-perch-meadow-v2.png', '/garden-art/garden-perch-cyber-v2.png');
      return Promise.all(urls.map(async url => {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let opaque = 0, clear = 0;
        for (let i = 3; i < data.length; i += 4) { if (data[i] > 240) opaque++; if (data[i] === 0) clear++; }
        return { url, opaque, clear, corner: data[3] };
      }));
    });
    assert.equal(pixels.length, 4);
    for (const asset of pixels) { assert.equal(asset.corner, 0); assert.ok(asset.clear > 1000 && asset.opaque > 1000, JSON.stringify(asset)); }
    console.log('PASS decoration and platform sprites decode, contain visible pixels and preserve genuine transparency');
    const world = page.locator('#qa-props .garden-world');
    for (const [level, bench, lamps] of [[1, 'hidden', 'hidden'], [2, 'visible', 'hidden'], [3, 'visible', 'visible']]) {
      await page.evaluate(level => { propsSnapshot.journey.level = level; propsView.update(propsSnapshot); }, level);
      assert.equal(await world.locator('.garden-world-bench').evaluate(el => getComputedStyle(el).visibility), bench);
      assert.equal(await world.locator('.garden-world-lanterns').evaluate(el => getComputedStyle(el).visibility), lamps);
    }
    console.log('PASS original decoration unlock levels are retained');
    await world.locator('.garden-world-toast').evaluate(el => { el.textContent = ''; });
    for (const width of [1600, 1000, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.locator('#qa-props .garden-world-surface').screenshot({ path: path.join(output, 'props-' + width + '.png'), animations: 'disabled' });
      const bounds = await world.locator('.garden-world-prop').evaluateAll(images => images.map(el => {
        const b = el.getBoundingClientRect(), s = el.closest('.garden-world-surface').getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.left >= s.left && b.right <= s.right && b.top >= s.top && b.bottom <= s.bottom && getComputedStyle(el).imageRendering === 'pixelated';
      }));
      assert.ok(bounds.every(Boolean));
    }
    console.log('PASS props stay sharp and inside the garden at desktop and mobile sizes');
    await page.evaluate(() => {
      propsView.destroy();
      const host = document.getElementById('qa-props'); host.className = '';
      window.propsView = TracerGardenHomeView(host, () => {});
      propsSnapshot.pet = TracerPetModel.pets[0];
      propsView.update(propsSnapshot);
    });
    for (const farm of ['meadow', 'cyber', 'meadow']) {
      await page.evaluate(farm => { propsSnapshot.economy = { equippedFarmId: farm }; propsView.update(propsSnapshot); }, farm);
      await page.waitForFunction(() => {
        const world = document.querySelector('#qa-props .garden-world'), art = world.querySelector('.garden-world-perch-art');
        return world.dataset.art === 'ready' && art.complete && art.naturalWidth > 0 && !art.parentElement.hidden;
      });
      assert.ok((await world.locator('.garden-world-perch-art').getAttribute('src')).endsWith('garden-perch-' + farm + '-v2.png'));
      for (const width of [1600, 390]) {
        await page.setViewportSize({ width, height: 1100 });
        const aligned = await world.locator('.garden-world-companion-perch').evaluate(el => {
          const platform = el.getBoundingClientRect(), companion = el.parentElement.querySelector('.garden-home-companion').getBoundingClientRect();
          return Math.abs(platform.x + platform.width / 2 - companion.x - companion.width / 2) < 1
            && Math.abs(platform.y + platform.height / 2 - companion.y - companion.height * .87) < 1
            && getComputedStyle(el).filter === 'none' && getComputedStyle(el.querySelector('img')).imageRendering === 'pixelated';
        });
        assert.ok(aligned, farm + '/' + width + ': platform shares the companion ground anchor without recoloring');
        await page.locator('#qa-props .garden-world-surface').screenshot({ path: path.join(output, 'perch-' + farm + '-' + width + '.png'), animations: 'disabled' });
      }
    }
    console.log('PASS farm switches select matching platform art and preserve companion alignment at desktop/mobile widths');
    assert.deepEqual(errors, []);
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => server.close());
