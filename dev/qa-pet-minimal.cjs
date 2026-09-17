'use strict';
// Actual Electron windows, an isolated profile, and no AI/provider requests.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, '.cache/pet-minimal-'));
const check = (value,label) => { assert.ok(value,label); console.log('PASS ' + label); };

async function freePort() {
  const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port;
}

async function start(port) {
  const env = { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_PORT: String(port), DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_DATA_DIR: path.join(profile, 'data'), DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: require('electron'), args: [root,'--disable-gpu','--in-process-gpu'], env, timeout: 45000 });
  app.process().stderr.on('data', chunk => fs.appendFileSync(path.join(profile, 'electron.log'), chunk));
  return app;
}

async function mainPage(app,port) {
  let page;
  for (let i = 0; i < 100; i++) {
    page = app.context().pages().find(page => page.url() === 'http://127.0.0.1:' + port + '/');
    if (page) break;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.ok(page, 'main workspace exists');
  await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
  return page;
}

async function petPage(app) {
  let page;
  for (let i = 0; i < 100; i++) {
    page = app.context().pages().find(page => page.url().endsWith('/pet.html'));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.ok(page, 'desktop companion exists');
  await page.locator('.pet-character').waitFor(); return page;
}

async function reveal(pet) {
  await pet.locator('.pet-character').hover();
  await pet.waitForFunction(() => Number(getComputedStyle(document.querySelector('.pet-quick-actions')).opacity) >= .99);
  await pet.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function checkBounds(pet, width, height) {
  await pet.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, { width,height });
  const geometry = await pet.locator('.pet-character').evaluate(el => { const rect = el.getBoundingClientRect(); return { left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom, width:rect.width, height:rect.height, overflow:document.documentElement.scrollWidth > innerWidth }; });
  check(!geometry.overflow && geometry.left >= 0 && geometry.top >= 0 && geometry.right <= width && geometry.bottom <= height, 'sprite fits its actual ' + width + '×' + height + ' native window');
  return geometry;
}

(async () => {
  const port = await freePort(); let app = await start(port);
  try {
    let main = await mainPage(app,port); const errors = [];
    main.on('pageerror', error => errors.push(error.message));
    await main.click('#pet-open');
    const petOpened = app.waitForEvent('window'); await main.click('[data-act="desktop"]');
    const pet = await petOpened; await pet.waitForURL('**/pet.html'); await pet.locator('.pet-character').waitFor();
    pet.on('pageerror', error => errors.push(error.message));
    await pet.mouse.move(-20,-20);
    const initial = await checkBounds(pet,220,284);
    for (const selector of ['.pet-top','.pet-identity','.pet-focus','.pet-stage-footer','.pet-panel','.pet-speech']) {
      check(!await pet.locator(selector).isVisible(), 'compact view has no persistent ' + selector);
    }
    const resting = await pet.locator('.pet-quick-actions').evaluate(el => { const style = getComputedStyle(el); return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0; });
    check(resting, 'quick controls stay hidden without hover or keyboard focus');
    await pet.screenshot({ path:path.join(profile,'minimal-default.png'), omitBackground:true });
    await reveal(pet);
    check(await pet.locator('.pet-quick-actions button').count() === 6, 'hover reveals six icon controls');
    const labels = await pet.locator('.pet-quick-actions button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label') || button.title));
    check(labels.every(Boolean), 'icon controls retain accessible names');
    await pet.screenshot({ path:path.join(profile,'minimal-hover.png'), omitBackground:true });
    await pet.mouse.move(-20,-20); await pet.locator('.pet-character').focus(); await pet.keyboard.press('Tab');
    await pet.waitForFunction(() => Number(getComputedStyle(document.querySelector('.pet-quick-actions')).opacity) > .95);
    check(await pet.evaluate(() => document.activeElement?.dataset.quickAct === 'feed'), 'keyboard Tab reveals and focuses the first icon control');
    await pet.locator('[data-quick-act="size"]').click(); await pet.locator('#pet-size-slider').waitFor({state:'visible'});
    await pet.locator('#pet-size-slider').press('Home');
    await pet.waitForFunction(() => Math.abs(document.querySelector('.pet-character').getBoundingClientRect().width - 126) < 1);
    const small = await checkBounds(pet,220,240);
    check(small.width < initial.width, 'slider keyboard input reduces the actual sprite size');
    const popupFits = await pet.locator('.pet-size-popover').evaluate(popup => {
      const bounds = popup.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight &&
        [...popup.querySelectorAll('label,input,button')].every(el => { const rect = el.getBoundingClientRect(); return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom; });
    });
    check(popupFits, 'size label, slider and reset remain within the smallest native window');
    await pet.screenshot({path:path.join(profile,'minimal-size-70.png'),omitBackground:true});
    await pet.locator('#pet-size-slider').press('End');
    await pet.waitForFunction(() => Math.abs(document.querySelector('.pet-character').getBoundingClientRect().width - 324) < 1);
    const large = await checkBounds(pet,364,428);
    check(large.width > initial.width, 'slider keyboard input enlarges the actual sprite size');
    const preference = JSON.parse(fs.readFileSync(path.join(profile,'pet-window.json'),'utf8'));
    check(preference.size === 180, 'selected size is persisted in the desktop profile');
    await reveal(pet); await pet.locator('[data-quick-act="size"]').click();
    await pet.locator('.pet-character').click();
    await pet.waitForFunction(() => document.querySelector('.pet-home').classList.contains('has-message'));
    check(await pet.locator('.pet-speech').isVisible(), 'a real interaction briefly shows its reaction bubble');
    check(await pet.evaluate(() => document.querySelector('.pet-speech').getBoundingClientRect().bottom < document.querySelector('.pet-character').getBoundingClientRect().top), 'reaction text has its own space above the character');
    await pet.screenshot({path:path.join(profile,'minimal-reaction.png'),omitBackground:true});
    await pet.waitForFunction(() => !document.querySelector('.pet-home').classList.contains('has-message'),null,{timeout:12000});
    check(!await pet.locator('.pet-speech').isVisible(), 'reaction bubble disappears after feedback expires');
    await reveal(pet); await pet.locator('[data-quick-act="expand"]').click();
    await pet.waitForFunction(() => innerWidth === 380 && innerHeight === 700);
    check(await pet.locator('.pet-panel').isVisible(), 'the optional panel still opens at its usable size');
    await pet.locator('.pet-panel-toggle').click(); await checkBounds(pet,364,428);
    check(errors.length === 0, 'no renderer errors before restarting the isolated app');
    await app.close(); app = await start(port); main = await mainPage(app,port);
    const restored = await petPage(app); await checkBounds(restored,364,428);
    check(JSON.parse(fs.readFileSync(path.join(profile,'pet-window.json'),'utf8')).size === 180, 'size survives a real application restart');
    await restored.mouse.move(-20,-20); await restored.screenshot({path:path.join(profile,'minimal-restored-large.png'),omitBackground:true});
    console.log('Artifacts: ' + profile);
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
