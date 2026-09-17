'use strict';
// Local-only integration QA. Every workspace, companion image and browser store
// is synthetic; outbound requests and AI operations are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');
const S = require('../public/workspace-sync');
const F = require('../skins/tracer/focus-model');
const { fixtures } = require('./qa-pet-dense-animation.cjs');

const pause = () => new Promise(resolve => setTimeout(resolve, 25));
async function until(fn, label, timeout = 20000) {
  const started = Date.now();
  while (!await fn()) { if (Date.now() - started > timeout) throw new Error('Timed out: ' + label); await pause(); }
}
function legacyFarm(now, historyId) {
  const plots = {};
  '1234567890qwertyuiopasdfghjklzxcvbnm'.split('').concat(['SPC', 'LMB']).forEach(key => { plots[key] = { c: null, t: 0 }; });
  return {
    v: 3, coins: 54321, xp: 840, real: true, tab: 'farm', sel: 'lavender', autoReplant: false,
    plots, bag: { carrot: 17, lavender: 9 }, lock: { lavender: true }, fish: {}, dex: {}, keys: {}, clicks: 45,
    pond: false, coop: false, spot: 'wal_buffer', spotsOwned: {}, autoReclaim: false, lastReclaim: now, fishProgress: 0, lastCatch: null,
    mats: {}, battle: null, mobDex: {}, equipped: { weapon: null, armor: null, accessory: null, shoes: null, special: null }, owned: [],
    ores: {}, bars: {}, mine: { vein: null, last: now, hp: 0, until: 0 }, smelt: { bar: null, last: now },
    runes: {}, books: {}, spell: null, craft: { rune: null, src: 'ore', last: now }, orders: [], ordersAt: now,
    animals: { sheep: { aff: 23, fed: 2, day: new Date(now).getFullYear() + '-' + (new Date(now).getMonth() + 1) + '-' + new Date(now).getDate() } }, mail: [],
    stats: { taps: 1234, harvested: 82, earned: 920, orders: 6, fish: 4, ext: 0, mined: 3, casts: 1 },
    lastRain: now, lastGrow: now, day: new Date(now).getFullYear() + '-' + (new Date(now).getMonth() + 1) + '-' + new Date(now).getDate(),
    pomo: { mode: 'idle', until: 0, done: 5 }, focusLink: { legacyDone: 4, credited: [historyId], allKeys: false }
  };
}
function assertFarmKept(actual, original) {
  assert.equal(actual.v, 3); assert.ok(actual.coins >= original.coins, 'legacy coins are retained (normal focus rewards may add coins)');
  assert.ok(actual.xp >= original.xp); assert.deepEqual(actual.bag, original.bag); assert.deepEqual(actual.lock, original.lock);
  assert.deepEqual(actual.animals, original.animals); assert.deepEqual(actual.owned, original.owned);
  for (const field of ['harvested', 'orders', 'fish', 'mined', 'casts']) assert.equal(actual.stats[field], original.stats[field], 'legacy statistic ' + field);
  assert.ok(actual.pomo.done >= original.pomo.done); assert.ok(actual.focusLink.credited.includes(original.focusLink.credited[0]));
}
async function saved(page) { await page.waitForFunction(() => Tracer.store.data && !Tracer.store.dirty && !Tracer.store.inflight); }
async function refresh(page) { await page.evaluate(() => Tracer.garden.refresh(true)); }
async function plot(page, projectId) { return page.evaluate(id => Tracer.garden.read().plots.find(row => row.projectId === id), projectId); }
const card = (page, id) => page.locator('.garden-home-plot[data-project-id="' + id + '"]');
async function addPlot(page, projectId, plant) {
  await page.locator('[data-home-action="add-plot"]:visible').first().click();
  await page.selectOption('#garden-project-select', projectId); await page.selectOption('#garden-plant-select', plant);
  await page.click('#garden-plant-save'); await card(page, projectId).waitFor(); await refresh(page);
}
async function editStatus(page, projectId, taskId, status) {
  await card(page, projectId).locator('[data-home-action="open-project"]').click();
  await page.locator('.card[data-id="' + taskId + '"]').click();
  await page.selectOption('#f-status', status); await page.click('#f-save');
}

async function main() {
  const root = path.resolve(__dirname, '..'); fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache/garden-home-')), data = path.join(artifacts, 'data'); fs.mkdirSync(data);
  const initial = S.empty(), projects = Array.from({ length: 7 }, (_, i) => M.addProject(initial, { name: ['Thoughtful release', 'Reading notes', 'Quiet research', 'Design review', 'Learning plan', 'Next season', 'Extra project'][i] }));
  const tasks = projects.map((project, i) => M.addTask(initial, { title: 'Project ' + (i + 1) + ' next task', projectId: project.id }));
  const historical = M.addTask(initial, { title: 'Previously completed release task', projectId: projects[0].id }); M.moveTask(initial, historical.id, 'done');
  const finalTask = M.addTask(initial, { title: 'Final release review', projectId: projects[0].id });
  const now = Date.now(), focus = F.fresh(); focus.settings.sound = false;
  focus.history = [{ id: 'qa-historical-focus', endedAt: now - 60000, minutes: 25, task: { id: historical.id, title: historical.title, projectId: projects[0].id } }];
  focus.roundsDone = 1; focus.totalMinutes = 25;
  const farm = legacyFarm(now, focus.history[0].id);
  fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify(initial));
  Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(artifacts, 'state.json') });
  const { server } = require('../server'); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const audit = { external: [], ai: [], errors: [], failPut: false, failGet: false, images: new Map() };
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { audit.external.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname.startsWith('/api/ai/')) {
        if (request.method() !== 'GET') audit.ai.push(url.pathname);
        return route.fulfill({ json: { configured: false, imageGeneration: false } });
      }
      if (audit.images.has(url.pathname)) return route.fulfill({ contentType: 'image/png', body: audit.images.get(url.pathname) });
      if (url.pathname === '/api/store/workspace' && request.method() === 'GET' && audit.failGet) return route.fulfill({ status: 503, json: { error: 'synthetic-read-failure' } });
      if (url.pathname === '/api/store/workspace' && request.method() === 'PUT' && audit.failPut) { audit.failPut = false; return route.fulfill({ status: 503, json: { error: 'synthetic-save-failure' } }); }
      return route.continue();
    });
    await context.addInitScript(({ farm, focus }) => {
      if (localStorage.getItem('qa-garden-seeded')) return;
      localStorage.setItem('dbconsole.farm.v3', JSON.stringify(farm)); localStorage.setItem('tracer.focus.v1', JSON.stringify(focus));
      localStorage.setItem('tracer.language', 'en'); localStorage.setItem('qa-garden-seeded', '1');
    }, { farm, focus });
    const page = await context.newPage(); page.on('pageerror', error => audit.errors.push(error.message));
    await page.goto(origin); await page.waitForFunction(() => window.Tracer?.garden && Tracer.store.data);
    await page.locator('#nav-garden').focus(); await page.keyboard.press('Enter'); await page.locator('.garden-home').waitFor();
    assert.equal(await page.locator('#garden-leisure-wrapper').isVisible(), false);
    const builtin = page.locator('.garden-home-companion-art .pet-builtin-sprite'); await builtin.waitFor();
    assert.equal(await builtin.getAttribute('data-frames'), '16'); const originalFrame = await builtin.getAttribute('data-frame');
    await until(async () => await builtin.getAttribute('data-frame') !== originalFrame, 'builtin companion animation advances');
    await page.locator('.garden-home-empty').waitFor();
    await addPlot(page, projects[0].id, 'wildflower');
    const first = await plot(page, projects[0].id); assert.equal(first.stage, 1); assert.deepEqual(first.taskIds, [historical.id]); assert.equal(first.focusMinutes, 25);
    assert.equal(await page.locator('.garden-home-event').count(), 0, 'planting absorbs earlier history without new activity notifications');
    await addPlot(page, projects[1].id, 'sunflower'); await addPlot(page, projects[2].id, 'lavender');
    await page.screenshot({ path: path.join(artifacts, 'home-initial-en.png'), animations: 'disabled' });
    assertFarmKept(await page.evaluate(() => JSON.parse(localStorage.getItem('dbconsole.farm.v3'))), farm);
    console.log('PASS keyboard entry, three seed types, initial history absorption and legacy farm preservation');

    // The editor updates live task counters, but failed disk writes must not earn growth.
    audit.failPut = true; await editStatus(page, projects[0].id, tasks[0].id, 'done');
    await page.waitForFunction(() => Tracer.store.dirty && !Tracer.store.inflight && document.querySelector('#save-dot').classList.contains('err'));
    await page.click('#nav-garden'); await refresh(page); assert.equal((await plot(page, projects[0].id)).taskIds.length, 1);
    await page.click('#save-dot'); await saved(page); await refresh(page);
    assert.equal((await plot(page, projects[0].id)).taskIds.length, 2); assert.equal((await plot(page, projects[0].id)).stage, 2);
    await card(page, projects[0].id).locator('[data-home-action="open-project"]').click();
    assert.equal(await page.evaluate(() => Tracer.projectFilter()), projects[0].id);
    assert.equal(await page.locator('.card').count(), 3); await page.click('#nav-garden');

    await card(page, projects[0].id).locator('[data-home-action="focus-project"]').click(); await page.locator('#focus-task').waitFor();
    assert.equal(await page.inputValue('#focus-task'), finalTask.id); await page.click('#focus-start');
    await page.waitForFunction(() => Tracer.focus.read().running); const running = await page.evaluate(() => Tracer.focus.read());
    assert.equal(running.task.projectId, projects[0].id); await page.click('#focus-close');
    await refresh(page); assert.equal(await page.locator('.garden-home').getAttribute('data-pet-action'), 'focus');
    assert.equal(await card(page, projects[0].id).getAttribute('data-active-focus'), 'true');
    await card(page, projects[1].id).locator('[data-home-action="focus-project"]').click();
    assert.equal(await page.inputValue('#focus-task'), finalTask.id); assert.equal((await page.evaluate(() => Tracer.focus.read())).runId, running.runId);
    await page.click('#focus-start'); await page.waitForFunction(() => !Tracer.focus.read().running); await page.click('#focus-close');
    await card(page, projects[1].id).locator('[data-home-action="focus-project"]').click();
    assert.equal(await page.inputValue('#focus-task'), finalTask.id, 'paused unfinished work is not reassigned');
    assert.equal(await page.locator('#focus-task').isDisabled(), true, 'paused sessions cannot be reassigned through the task picker');
    await page.evaluate(id => { const select = document.querySelector('#focus-task'); select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })); }, tasks[1].id);
    await until(async () => await page.inputValue('#focus-task') === finalTask.id, 'the paused task picker restores its original assignment');
    assert.equal((await page.evaluate(() => Tracer.focus.read())).task.id, finalTask.id);
    await page.click('#focus-start'); await page.waitForFunction(() => Tracer.focus.read().running); await page.click('#focus-close');
    // Finish the actual started session by moving only its persisted deadline;
    // the production focus settle path writes the history receipt and project.
    await page.evaluate(() => { const s = Tracer.focus.read(); s.endAt = Date.now() - 1; const value = JSON.stringify(s); localStorage.setItem('tracer.focus.v1', value); window.dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1', newValue: value })); Tracer.refreshWellness(); });
    await page.waitForFunction(id => Tracer.focus.read().history.some(row => row.id === id), running.runId); await refresh(page);
    assert.equal((await plot(page, projects[0].id)).focusMinutes, 50); assert.equal((await plot(page, projects[1].id)).focusMinutes, 0);
    const accrued = await plot(page, projects[0].id); await refresh(page); await refresh(page); assert.deepEqual(await plot(page, projects[0].id), accrued);
    await editStatus(page, projects[0].id, finalTask.id, 'done'); await saved(page); await page.click('#nav-garden'); await refresh(page);
    let bloom = await plot(page, projects[0].id); assert.equal(bloom.stage, 4); assert.ok(bloom.commemoratedAt); await card(page, projects[0].id).locator('.garden-home-bloom').waitFor();
    await page.screenshot({ path: path.join(artifacts, 'home-bloom-en.png'), animations: 'disabled' });
    await page.reload(); await page.waitForFunction(() => window.Tracer?.garden && Tracer.store.data); await page.locator('.garden-home').waitFor(); await refresh(page);
    assert.deepEqual(await plot(page, projects[0].id), bloom); assert.equal(await page.locator('.garden-home-event').count(), 0, 'reload never replays earned events');
    await editStatus(page, projects[0].id, finalTask.id, 'todo'); await saved(page); await page.click('#nav-garden'); await refresh(page);
    assert.equal((await plot(page, projects[0].id)).stage, 4, 'the earned bloom remains after reopening work');
    await editStatus(page, projects[0].id, finalTask.id, 'done'); await saved(page); await page.click('#nav-garden'); await refresh(page);
    assert.deepEqual(await plot(page, projects[0].id), bloom, 'completing the same task again adds no receipt or growth');
    console.log('PASS saved-task growth, failed-save protection, project navigation, real focus completion, active/paused focus protection, bloom and receipt deduplication across reload');

    // Use a synthetic dense custom companion through the same selected-pet store.
    const artwork = await fixtures(page), pages = artwork.sheets.map((bytes, index) => { const url = '/api/pet-art/' + (index + 1).toString(16).padStart(32, '0') + '.png'; audit.images.set(url, bytes); return url; });
    const custom = { id: 'custom_' + 'a'.repeat(32), name: 'QA Garden Friend', personality: '', kind: 'humanoid', image: pages[0], animation: { version: 2, pages } };
    await page.evaluate(custom => { const state = Tracer.pet.read(); TracerPetModel.addCustom(state, custom); const value = JSON.stringify(state); localStorage.setItem('tracer.pet.v1', value); window.dispatchEvent(new StorageEvent('storage', { key: 'tracer.pet.v1', newValue: value })); }, custom);
    await refresh(page); await page.locator('.garden-home-companion-art .pet-animated-sprite').waitFor();
    await page.locator('[data-home-action="open-companion"]').click(); await page.locator('.pet-home').waitFor();
    assert.equal(await page.evaluate(() => Tracer.pet.read().selected), custom.id); await page.locator('.pet-top [data-act="close"]').click();

    // An older window must not interpret an unknown project as a deletion when
    // another window has just saved that project and planted its first plot.
    const second = await context.newPage(); second.on('pageerror', error => audit.errors.push(error.message));
    await second.goto(origin); await second.waitForFunction(() => window.Tracer?.garden && Tracer.store.data);
    await second.click('#proj-add'); await second.fill('#p-name', 'Created in another window'); await second.click('#p-save'); await saved(second);
    const extra = await second.evaluate(() => Tracer.store.data.projects.find(project => project.name === 'Created in another window'));
    assert.equal(await page.evaluate(id => Tracer.store.base.projects.some(project => project.id === id), extra.id), false, 'window A has the older workspace');
    await page.evaluate(() => { Tracer.store.base.meta.rev = 100000; });
    await second.click('#nav-garden');
    const beforeQuota = await second.evaluate(() => localStorage.getItem('tracer.garden.v1'));
    await second.evaluate(() => { window.__qaOriginalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'tracer.garden.v1') throw new DOMException('synthetic-quota', 'QuotaExceededError'); return window.__qaOriginalSetItem.call(this, key, value); }; });
    await second.locator('[data-home-action="add-plot"]:visible').first().click(); await second.selectOption('#garden-project-select', extra.id); await second.selectOption('#garden-plant-select', 'lavender'); await second.click('#garden-plant-save');
    await second.waitForFunction(() => document.querySelector('.garden-dialog-error').textContent.length > 0);
    assert.equal(await second.evaluate(() => localStorage.getItem('tracer.garden.v1')), beforeQuota, 'quota failure preserves the saved garden bytes');
    assert.ok(await plot(second, extra.id), 'the new plot survives in memory for an explicit retry');
    await second.evaluate(() => { Storage.prototype.setItem = window.__qaOriginalSetItem; }); await second.click('#garden-plant-cancel');
    await second.locator('[data-home-action="retry-save"]').click(); await second.locator('.garden-home-error').waitFor({ state: 'hidden' });
    assert.equal(await second.evaluate(id => JSON.parse(localStorage.getItem('tracer.garden.v1')).plots.some(plot => plot.projectId === id), extra.id), true);
    await until(async () => !!await plot(page, extra.id), 'window A receives the new plot through the storage event');
    await refresh(page); await refresh(second);
    assert.ok(await plot(page, extra.id)); assert.ok(await plot(second, extra.id));
    assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem('tracer.garden.v1')).plots.some(plot => plot.projectId === id), extra.id), true);
    const beforeReadFailure = await second.evaluate(() => localStorage.getItem('tracer.garden.v1')), beforeReadState = await second.evaluate(() => Tracer.garden.read());
    audit.failGet = true; await refresh(second); await second.locator('.garden-home-error').waitFor();
    assert.equal(await second.evaluate(() => localStorage.getItem('tracer.garden.v1')), beforeReadFailure); assert.deepEqual(await second.evaluate(() => Tracer.garden.read()), beforeReadState, 'unavailable workspace reads retain every garden receipt');
    audit.failGet = false; await second.locator('[data-home-action="retry-save"]').click(); await second.locator('.garden-home-error').waitFor({ state: 'hidden' });
    assert.equal(await second.evaluate(() => localStorage.getItem('tracer.garden.v1')), beforeReadFailure); assert.deepEqual(await second.evaluate(() => Tracer.garden.read()), beforeReadState);
    await card(second, extra.id).locator('[data-home-action="remove-plot"]').click();
    await second.getByRole('button', { name: 'Keep', exact: true }).click(); assert.ok(await plot(second, extra.id), 'cancelling removal retains the plot');
    await card(second, extra.id).locator('[data-home-action="remove-plot"]').click(); await second.click('[data-garden-remove="' + extra.id + '"]');
    await until(async () => !await plot(second, extra.id), 'confirmed plot removal');
    assert.equal(await second.evaluate(id => Tracer.store.data.projects.some(project => project.id === id), extra.id), true, 'removing a plot preserves its project');
    await second.close(); await page.bringToFront(); await page.reload(); await page.waitForFunction(() => window.Tracer?.garden && Tracer.store.data); await refresh(page);
    assert.equal(await plot(page, extra.id), undefined);
    console.log('PASS quota failure recovery, unavailable workspace read retry, stale-window storage reconciliation, deliberate plot removal and preservation of its project');
    for (let i = 3; i < 6; i++) await addPlot(page, projects[i].id, ['wildflower', 'sunflower', 'lavender'][i % 3]);
    assert.equal(await page.locator('.garden-home-plot').count(), 6); assert.equal(await page.locator('.garden-home-add').isDisabled(), true);
    assert.equal((await page.evaluate(() => Tracer.garden.read())).plots.length, 6);
    await page.locator('[data-home-action="open-leisure"]').click(); await page.locator('#garden-leisure-wrapper').waitFor();
    await page.screenshot({ path: path.join(artifacts, 'legacy-leisure-preserved.png'), animations: 'disabled' });
    await page.click('#garden-back-home'); await page.locator('.garden-home').waitFor();
    assertFarmKept(await page.evaluate(() => JSON.parse(localStorage.getItem('dbconsole.farm.v3'))), farm);
    await card(page, projects[2].id).locator('[data-home-action="open-project"]').click(); await page.click('[data-delete-project="' + projects[2].id + '"]');
    await page.click('#project-delete-confirm'); await saved(page); await page.click('#nav-garden'); await refresh(page);
    assert.equal(await card(page, projects[2].id).count(), 0); assert.equal((await page.evaluate(() => Tracer.garden.read())).plots.length, 5);
    await page.reload(); await page.waitForFunction(() => window.Tracer?.garden && Tracer.store.data); await refresh(page);
    assert.equal(await card(page, projects[2].id).count(), 0); assert.equal(await page.evaluate(id => Tracer.store.data.projects.some(project => project.id === id), projects[2].id), false);
    await page.click('#focus-alarm-dismiss');
    await page.selectOption('#language-select', 'zh'); await page.setViewportSize({ width: 900, height: 1000 }); await refresh(page);
    assert.equal(await page.locator('.garden-home-title').textContent(), '伙伴家园');
    await page.screenshot({ path: path.join(artifacts, 'home-zh-900.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 380, height: 880 }); await refresh(page);
    const widths = await page.locator('.garden-home').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth })); assert.ok(widths.scroll <= widths.client + 1, JSON.stringify(widths));
    const pageWidths = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })); assert.ok(pageWidths.scroll <= pageWidths.width + 1, JSON.stringify(pageWidths));
    await page.screenshot({ path: path.join(artifacts, 'home-zh-380.png'), animations: 'disabled' });
    assert.deepEqual(audit.external, []); assert.deepEqual(audit.ai, []); assert.deepEqual(audit.errors, []);
    console.log('PASS selected custom companion, bilingual narrow layout, six-plot limit, legacy leisure round-trip and deleted-project removal without resurrection');
    console.log('Artifacts: ' + artifacts);
  } catch (error) {
    console.error('Artifacts: ' + artifacts); if (browser) { const page = browser.contexts()[0]?.pages()[0]; if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {}); }
    throw error;
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
