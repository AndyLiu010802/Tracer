'use strict';

// Exercise production controller, model and rendering with real keyboard input.
// In particular, do not focus .fishing-game before an F interaction: doing so
// used to conceal lost focus after mouse casts and sibling-control clicks.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const F = require('../public/fishing-model');
const G = require('../public/task-garden');
const M = require('../skins/tracer/model');

const folder = fs.mkdtempSync(path.join(__dirname, '../.cache/fishing-keyboard-'));
const data = path.join(folder, 'data');
fs.mkdirSync(data);
const workspace = M.emptyWorkspace();
workspace.taskGarden = G.empty();
F.ensure(workspace);
fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify(workspace));
Object.assign(process.env, {
  DOCS_PORTAL_HOST: '127.0.0.1',
  DOCS_PORTAL_SKIN: 'tracer',
  DOCS_PORTAL_DATA_DIR: data,
  DOCS_PORTAL_STATE_FILE: path.join(folder, 'state.json')
});
const { server } = require('../server');

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser, page;
  const errors = [], failed = [], external = [], checks = [], observations = {};
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.href); return route.abort(); }
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false } });
      return route.continue();
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().includes('/api/ai/')) failed.push([response.status(), response.url()]);
    });
    const saved = () => page.waitForFunction(() => window.Tracer?.fishing && Tracer.store.base?.fishing && !Tracer.store.dirty && !Tracer.store.inflight && !Tracer.fishing.snapshot().busy);
    const phase = (expected, timeout = 15000) => page.waitForFunction(value => Tracer.fishing.snapshot().session?.phase === value, expected, { timeout });
    const state = () => page.evaluate(() => {
      const snapshot = Tracer.fishing.snapshot(), session = snapshot.session;
      return {
        phase: session?.phase || 'idle', sessionId: session?.id || '',
        holding: session?.holding || false, bar: session?.barPosition,
        fish: session?.fishPosition, stamina: session?.stamina, reason: session?.reason,
        recastRemaining: snapshot.recastRemaining,
        casts: TracerFishingModel.read(Tracer.store.data).casts.length,
        catches: TracerFishingModel.read(Tracer.store.data).catches.length,
        bait: TracerFishingModel.read(Tracer.store.data).baits.worm,
        focus: { tag: document.activeElement.tagName, id: document.activeElement.id, className: document.activeElement.className }
      };
    });
    const screenshot = name => page.screenshot({ path: path.join(folder, name), fullPage: false });
    await page.goto(origin);
    await saved();
    await page.evaluate(() => Tracer.fishing.openGame());
    await page.locator('.fishing-modal[open] .fishing-game').waitFor();
    const button = page.locator('.fishing-modal[open] .fishing-game-action');
    const cancel = page.locator('.fishing-modal[open] [data-cancel]');
    const initial = await state();

    // A mouse cast disables its previously focused button during flight. The
    // subsequent key must work without a compensating click/focus in the game.
    await button.hover();
    await page.mouse.down();
    await phase('charging');
    await page.waitForTimeout(480);
    await page.mouse.up();
    await page.waitForFunction(() => ['cast', 'waiting'].includes(Tracer.fishing.snapshot().session?.phase));
    observations.afterMouseCast = await state();
    await phase('bite');
    await page.keyboard.down('f');
    await phase('reeling', 1500);
    const beforeHold = await state();
    await page.waitForTimeout(180);
    const held = await state();
    assert.equal(held.phase, 'reeling');
    assert.equal(held.holding, true, 'holding the hooking F continues directly into reeling');
    assert(held.bar > beforeHold.bar, 'the same held F raises the bar');
    await page.keyboard.up('f');
    await page.waitForTimeout(180);
    const released = await state();
    assert.equal(released.holding, false, 'F release ends the reel hold');
    assert(released.bar < held.bar, 'the released bar falls');
    observations.hookHandoff = { beforeHold, held, released };
    checks.push('mouse cast followed by F hook without refocusing', 'held hook F continues reeling; release lets the bar fall');
    await screenshot('mouse-to-keyboard-reeling.png');

    await page.keyboard.down('f');
    await page.waitForFunction(() => Tracer.fishing.snapshot().session?.holding === true);
    // Dispatch the actual browser lifecycle event. Switching tabs also hides
    // this application, which intentionally cancels its whole fishing session.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => Tracer.fishing.snapshot().session?.holding === false);
    await page.keyboard.up('f');
    checks.push('window blur releases a held F without leaving stuck reeling input');

    // Finish this real session solely by pressing/releasing F. Inspecting the
    // fish's current position guides input but never mutates controller/model
    // state, elapsed time, probability, or rewards.
    let guidingHold = false, guidingDowns = 0, guidingUps = 0;
    const guidingStarted = Date.now();
    try {
      while (Date.now() - guidingStarted < 45000) {
        const current = await state();
        if (current.phase === 'caught') break;
        assert.equal(current.phase, 'reeling', 'F-guided catch stays active: ' + current.reason);
        const nextHold = current.fish > current.bar;
        if (nextHold !== guidingHold) {
          if (nextHold) { await page.keyboard.down('f'); guidingDowns++; }
          else { await page.keyboard.up('f'); guidingUps++; }
          guidingHold = nextHold;
        }
        await page.waitForTimeout(25);
      }
    } finally { await page.keyboard.up('f'); }
    await phase('caught', 1000);
    const caught = await state();
    assert.equal(caught.stamina, 0, 'the production model awarded a fully exhausted catch');
    assert(caught.recastRemaining > 0 && caught.recastRemaining <= 2000, 'the caught result starts a two-second pause');
    assert(guidingDowns > 1 && guidingUps > 1, 'actual repeated key holds and releases landed the fish');
    assert.equal(await button.isDisabled(), true, 'the caught display temporarily disables mouse casting');
    for (let i = 0; i < 4; i++) await page.keyboard.press('f');
    const actionBox = await button.boundingBox();
    assert(actionBox);
    // Raw mouse events exercise the disabled button immediately instead of
    // Playwright click's auto-wait for the control to become enabled.
    await page.mouse.move(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    const afterRapidInputs = await state();
    assert.equal(afterRapidInputs.phase, 'caught');
    assert.equal(afterRapidInputs.sessionId, caught.sessionId);
    assert.equal(afterRapidInputs.casts, initial.casts + 1);
    assert.equal(afterRapidInputs.bait, initial.bait - 1, 'rapid F and mouse input during display never spends another bait');
    assert(afterRapidInputs.recastRemaining > 0, 'rapid input assertions ran within the pause');
    await screenshot('catch-pause.png');
    assert((await state()).recastRemaining > 0, 'the held-key test begins during the pause');
    await page.keyboard.down('f');
    await page.waitForFunction(() => Tracer.fishing.snapshot().recastRemaining === 0, null, { timeout: 3000 });
    await page.keyboard.down('f'); // Real autorepeat: the key is still down.
    await page.waitForTimeout(150);
    const afterPause = await state();
    assert.equal(afterPause.phase, 'caught', 'a key held through the pause does not automatically start the next cast');
    assert.equal(afterPause.sessionId, caught.sessionId);
    assert.equal(afterPause.casts, initial.casts + 1);
    await page.keyboard.up('f');
    await saved();
    assert.equal((await state()).catches, initial.catches + 1, 'the displayed fish was saved exactly once');
    await page.keyboard.down('f');
    await phase('charging', 1500);
    assert.notEqual((await state()).sessionId, caught.sessionId, 'a fresh F press after the pause starts the next cast');
    observations.catchPause = { caught, afterRapidInputs, afterPause, guidingDowns, guidingUps };
    checks.push('actual F-guided catch is displayed for two seconds', 'rapid F and mouse input cannot skip the caught result or spend bait', 'holding F through the pause never queues a cast; a fresh press works');
    await cancel.click();
    await phase('escaped');
    await page.keyboard.up('f');

    await cancel.click();
    await phase('escaped');
    const previousId = (await state()).sessionId;
    await page.keyboard.down('f');
    await phase('charging', 1500);
    assert.notEqual((await state()).sessionId, previousId, 'F starts a new cast while Cancel Cast owns focus');
    await page.waitForTimeout(320);
    await page.keyboard.up('f');
    await phase('waiting');
    await saved();
    await cancel.click();
    await phase('escaped');
    checks.push('F starts again after clicking sibling Cancel Cast');

    await page.locator('.fishing-modal[open] [data-rig="bait"]').click();
    await page.locator('.fishing-modal[open] [data-close-rig]').click();
    observations.afterClosingTackle = await state();
    await page.keyboard.down('f');
    await phase('charging', 1500);
    await page.waitForTimeout(320);
    await page.keyboard.up('f');
    await phase('waiting');
    await saved();
    await cancel.click();
    await phase('escaped');
    checks.push('F starts after closing tackle with focus on the bait control');
    assert.equal((await state()).casts, initial.casts + 3, 'three deliberate releases commit exactly three casts');
    assert.equal((await state()).bait, initial.bait - 3, 'each cast consumes one bait');

    const guarded = await state();
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'fishing-keyboard-qa-editor';
      input.setAttribute('aria-label', 'Keyboard regression typing field');
      document.querySelector('.fishing-modal[open]').append(input);
      input.focus();
    });
    await page.keyboard.press('f');
    assert.equal(await page.locator('#fishing-keyboard-qa-editor').inputValue(), 'f');
    assert.equal((await state()).sessionId, guarded.sessionId, 'typing F does not cast');
    assert.equal((await state()).phase, 'escaped');
    await page.locator('#fishing-keyboard-qa-editor').evaluate(node => node.remove());
    await cancel.click();
    // Browser shortcuts are represented as DOM events so this test does not
    // open browser chrome (Find, menus, OS shortcuts) outside Playwright's page.
    const shortcutResults = await page.evaluate(() => ['ctrlKey', 'altKey', 'metaKey', 'isComposing'].map(flag => {
      const event = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true, cancelable: true, [flag]: true });
      document.activeElement.dispatchEvent(event);
      return { flag, prevented: event.defaultPrevented, phase: Tracer.fishing.snapshot().session.phase };
    }));
    assert(shortcutResults.every(result => !result.prevented && result.phase === 'escaped'));
    observations.shortcutGuards = shortcutResults;
    checks.push('typing, IME and modifier shortcuts do not cast');

    await page.evaluate(() => {
      const modal = document.createElement('dialog');
      modal.id = 'fishing-keyboard-qa-other-dialog';
      modal.innerHTML = '<button type="button">Other dialog</button>';
      document.body.append(modal);
      modal.showModal();
    });
    await page.keyboard.press('f');
    assert.equal((await state()).sessionId, guarded.sessionId);
    assert.equal((await state()).phase, 'escaped', 'a second modal isolates fishing controls');
    await page.evaluate(() => { const modal = document.getElementById('fishing-keyboard-qa-other-dialog'); modal.close(); modal.remove(); });
    checks.push('another open modal blocks fishing hotkeys');

    // Chromium headless keeps every tab focused, so explicitly deliver the
    // window blur lifecycle event rather than relying on bringToFront().
    // A charge must cancel before the eventual keyup can commit another bait.
    await cancel.click();
    await page.keyboard.down('f');
    await phase('charging', 1500);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await phase('escaped', 1500);
    await page.keyboard.up('f');
    await page.waitForTimeout(120);
    assert.equal((await state()).casts, initial.casts + 3, 'focus loss cancels charging without committing another bait');
    checks.push('window blur during charging cancels and does not consume bait');
    await screenshot('keyboard-focus-regressions.png');

    await page.locator('.fishing-modal[open] [data-close]').click();
    await page.keyboard.press('f');
    assert.equal((await state()).casts, initial.casts + 3);
    assert.equal((await state()).phase, 'escaped', 'closing fishing removes its keyboard handler');
    checks.push('closed fishing dialog no longer handles F');
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    assert.deepEqual(external, []);
    fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ passed: true, checks, observations, javascriptErrors: errors, failedRequests: failed, externalRequests: external }, null, 2));
    console.log('PASS ' + checks.join('; ') + '.');
    console.log('Artifacts: ' + folder);
  } catch (error) {
    if (page && !page.isClosed()) {
      observations.failure = await page.evaluate(() => ({
        phase: window.Tracer?.fishing?.snapshot()?.session?.phase,
        reason: window.Tracer?.fishing?.snapshot()?.session?.reason,
        holding: window.Tracer?.fishing?.snapshot()?.session?.holding,
        focus: { tag: document.activeElement.tagName, id: document.activeElement.id, className: document.activeElement.className }
      })).catch(() => null);
      await page.screenshot({ path: path.join(folder, 'failure.png'), fullPage: false }).catch(() => {});
      await fs.promises.writeFile(path.join(folder, 'failure.html'), await page.content().catch(() => '')).catch(() => {});
    }
    fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ passed: false, error: error.stack || String(error), checks, observations, javascriptErrors: errors, failedRequests: failed, externalRequests: external }, null, 2));
    throw error;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); console.error('Artifacts: ' + folder); process.exitCode = 1; });
