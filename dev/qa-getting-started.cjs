'use strict';
// Real browser/UI with a tiny in-memory HTTP workspace. This harness never loads
// server.js, local.config.json, user accounts, or any existing workspace files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');

const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
let workspace = M.emptyWorkspace(), failSave = false, attemptedWrites = [], acceptedWrites = [], accountScope = 'guest', scenario = 0;
const contextValue = () => ({ scope: accountScope, generation: 0, user: null, capabilities: { mode: 'local' } });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1'), name = decodeURIComponent(url.pathname);
    function send(value, status = 200) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
    if (name === '/account-context.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end('window.__TRACER_ACCOUNT__=' + JSON.stringify(contextValue()) + ';'); return; }
    if (name === '/api/account/session') return send(contextValue());
    if (name === '/api/store/workspace') {
      if (req.headers['x-tracer-qa-scenario'] !== String(scenario)) return send({ error: 'expired-qa-scenario' }, 410);
      if (req.method === 'GET') return send(workspace);
      if (!['PUT', 'POST'].includes(req.method)) return send({ error: 'method-not-allowed' }, 405);
      let body = ''; for await (const chunk of req) body += chunk;
      const incoming = JSON.parse(body); attemptedWrites.push(clone(incoming));
      if (failSave) return send({ error: 'synthetic-save-failure' }, 503);
      workspace = clone(incoming); acceptedWrites.push(clone(workspace)); return send({ ok: true, workspace });
    }
    if (name.startsWith('/api/store/')) return send(null);
    if (name === '/api/music') return send({ tracks: [] });
    if (name.startsWith('/api/ai/')) return send({ configured: false, imageGeneration: false });
    if (name.startsWith('/api/')) return send({});
    const relative = name === '/' ? 'index.html' : name.slice(1);
    for (const base of [path.join(root, 'skins', 'tracer'), path.join(root, 'public')]) {
      const file = path.resolve(base, relative);
      if (!file.startsWith(base + path.sep)) continue;
      try {
        const data = await fsp.readFile(file);
        res.writeHead(200, { 'content-type': (mime[path.extname(file)] || 'application/octet-stream') + (/\.(?:html|js|css|json|svg)$/.test(file) ? '; charset=utf-8' : ''), 'cache-control': 'no-store' }); res.end(data); return;
      } catch (error) { if (!['ENOENT', 'EISDIR'].includes(error.code)) throw error; }
    }
    res.writeHead(404); res.end('Not found');
  } catch (error) { res.writeHead(500); res.end(error.message); }
});

async function main() {
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache', 'getting-started-'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const results = [], errors = [], external = [];
  let browser, context, page;
  const check = (condition, label) => { assert.ok(condition, label); results.push(label); };
  const ready = () => page.waitForFunction(() => window.Tracer?.gettingStarted && Tracer.store.data && !Tracer.store.lost);
  const saved = () => page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight && !Tracer.store.conflict);
  async function start(ws = M.emptyWorkspace(), preferences = {}) {
    if (context) await context.close();
    const currentScenario = ++scenario;
    workspace = clone(ws); failSave = false; attemptedWrites = []; acceptedWrites = []; accountScope = 'guest';
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.origin + url.pathname); return route.abort(); }
      return route.continue({ headers: { ...route.request().headers(), 'x-tracer-qa-scenario': String(currentScenario) } });
    });
    await context.addInitScript(values => {
      if (sessionStorage.getItem('getting-started-qa-seeded')) return;
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      sessionStorage.setItem('getting-started-qa-seeded', '1');
    }, preferences);
    page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/?sec=board&phase=day', { waitUntil: 'domcontentloaded' }); await ready(); await saved();
  }
  async function create(title, keyboard = false) {
    const previousIds = await page.evaluate(() => Tracer.store.data.tasks.map(task => task.id));
    await page.locator('#getting-started-title').fill(title);
    if (keyboard) await page.locator('#getting-started-title').press('Enter');
    else await page.locator('#getting-started-create').click();
    await page.waitForFunction(ids => Tracer.store.data.tasks.some(task => !ids.includes(task.id)), previousIds); await saved();
    return page.evaluate(ids => Tracer.store.data.tasks.find(task => !ids.includes(task.id)).id, previousIds);
  }
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    await start();
    await page.locator('#getting-started').waitFor({ state: 'visible' });
    check(await page.locator('html').getAttribute('lang') === 'en', 'fresh workspace starts in English with the guide visible');
    check(await page.locator('#getting-started-title').getAttribute('maxlength') === '200', 'title-only form constrains title length');
    await page.locator('#getting-started-title').fill('Draft a useful project brief');
    await page.selectOption('#language-select', 'zh');
    check(await page.locator('#getting-started-title').inputValue() === 'Draft a useful project brief', 'language switch preserves the unsubmitted title');
    check(await page.locator('html').getAttribute('lang') === 'zh-CN', 'the guide follows the Chinese language setting');
    await page.reload(); await ready();
    check(await page.locator('#getting-started-title').inputValue() === 'Draft a useful project brief', 'unsubmitted title survives reload');
    await page.selectOption('#language-select', 'en');
    await page.screenshot({ path: path.join(artifacts, 'guide-english.png'), animations: 'disabled' });
    const taskId = await create('Draft a useful project brief', true);
    check(workspace.tasks.length === 1 && workspace.tasks[0].status === 'doing', 'keyboard submission persists exactly one real in-progress task');
    check(workspace.taskGarden?.seeds?.some(seed => seed.taskId === taskId && seed.state === 'growing'), 'starting the task plants its real garden seed');
    await page.reload(); await ready(); await saved();
    check(workspace.tasks.length === 1 && workspace.tasks[0].id === taskId, 'reload resumes the same task without creating a duplicate');
    const retainedFocus = await page.evaluate(() => {
      const focus = TracerFocus.fresh();
      focus.settings.focus = 17; focus.duration = focus.remaining = 17 * 60000;
      focus.history = [{ id: 'qa-earlier-focus', endedAt: Date.now() - 3600000, minutes: 10, task: { id: 'qa-earlier-task', title: 'Earlier useful work', projectId: null } }];
      focus.totalMinutes = 10; focus.roundsDone = 1;
      localStorage.setItem('tracer.focus.v1', JSON.stringify(focus));
      dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1' }));
      return { settings: focus.settings, history: focus.history, totalMinutes: focus.totalMinutes, roundsDone: focus.roundsDone };
    });
    await page.locator('#getting-started-focus').click();
    await page.locator('#focus-start').waitFor();
    check(await page.locator('#focus-task').inputValue() === taskId, 'guide opens the existing focus timer with its task selected');
    await page.locator('#focus-start').click();
    await page.waitForFunction(id => Tracer.focus.read().running && Tracer.focus.read().task?.id === id, taskId);
    await page.locator('#focus-start').click(); await page.locator('#focus-close').click();
    await page.locator('#getting-started-complete').click(); await saved();
    await page.waitForFunction(() => !Tracer.focus.read().task && !Tracer.focus.read().runId && !Tracer.focus.read().running);
    const resetFocus = await page.evaluate(() => {
      const focus = Tracer.focus.read();
      return { settings: focus.settings, history: focus.history, totalMinutes: focus.totalMinutes, roundsDone: focus.roundsDone, remaining: focus.remaining, duration: focus.duration, alarm: focus.alarm };
    });
    check(resetFocus.remaining === 17 * 60000 && resetFocus.duration === 17 * 60000 && !resetFocus.alarm, 'saving a completed task resets its paused timer to the configured duration');
    check(JSON.stringify({ settings: resetFocus.settings, history: resetFocus.history, totalMinutes: resetFocus.totalMinutes, roundsDone: resetFocus.roundsDone }) === JSON.stringify(retainedFocus), 'reset preserves earlier focus history, totals, rounds and custom settings');
    check(workspace.tasks[0].status === 'done', 'explicit completion persists the task as done');
    check(workspace.taskGarden.seeds.some(seed => seed.taskId === taskId && seed.state === 'mature'), 'explicit completion matures the same plant');
    await page.locator('#getting-started-garden').click();
    await page.locator('#garden-home-root .garden-home').waitFor();
    check(await page.evaluate(() => Tracer.currentSec()) === 'garden', 'saved completion leads to the real garden');
    await page.screenshot({ path: path.join(artifacts, 'first-task-garden.png'), animations: 'disabled' });
    failSave = true;
    await page.locator('.garden-task-plant-card[data-task-id="' + taskId + '"] [data-plant-action="harvest"]').click();
    await page.locator('.garden-home-error').waitFor();
    await page.waitForFunction(() => Tracer.store.dirty && !Tracer.store.inflight);
    check(await page.evaluate(() => Tracer.currentSec()) === 'garden' && !workspace.taskGarden.seeds.find(seed => seed.taskId === taskId).harvestedAt, 'failed guide harvest stays in the garden without granting a saved harvest');
    failSave = false;
    await page.locator('[data-home-action="retry-save"]').click(); await saved();
    await page.waitForFunction(() => Tracer.currentSec() === 'board' && document.activeElement?.id === 'getting-started-title');
    check(await page.locator('#getting-started-title').inputValue() === '', 'successful harvest retry returns to an empty focused next-task input');
    const nextTaskId = await create('Take the next useful step');
    check(nextTaskId !== taskId && workspace.tasks.length === 2 && workspace.taskGarden.seeds.length === 2, 'the next guided task gets a new identity and seed');
    check(workspace.tasks.find(task => task.id === taskId).status === 'done' && !!workspace.taskGarden.seeds.find(seed => seed.taskId === taskId).harvestedAt && workspace.completionHistory.some(row => row.taskId === taskId), 'starting the next task preserves the previous completed task, harvest and completion history');
    check(await page.evaluate(() => Tracer.focus.read().history.some(row => row.id === 'qa-earlier-focus')), 'the next task also preserves existing focus history');
    await page.screenshot({ path: path.join(artifacts, 'next-guided-task.png'), animations: 'disabled' });
    const unrelatedTaskId = await page.evaluate(() => {
      const task = TracerModel.addTask(Tracer.store.data, { title: 'An unrelated garden task', status: 'doing' });
      TracerModel.updateTask(Tracer.store.data, task.id, { status: 'done' });
      Tracer.touch(); clearTimeout(Tracer.store.timer); Tracer.saveNow(); return task.id;
    }); await saved();
    await page.locator('[data-sec="garden"]').click();
    await page.locator('.garden-task-plant-card[data-task-id="' + unrelatedTaskId + '"] [data-plant-action="harvest"]').click(); await saved();
    check(await page.evaluate(() => Tracer.currentSec()) === 'garden' && await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.gettingStarted.v1')).taskId) === nextTaskId, 'harvesting a different plant does not redirect or reset the active guide');
    await page.locator('[data-sec="board"]').click();
    await page.locator('#getting-started-dismiss').click();
    await page.locator('.card[data-id="' + nextTaskId + '"] .card-move').selectOption('done'); await saved();
    await page.locator('[data-sec="garden"]').click();
    await page.locator('.garden-task-plant-card[data-task-id="' + nextTaskId + '"] [data-plant-action="harvest"]').click(); await saved();
    check(await page.evaluate(() => Tracer.currentSec()) === 'garden' && await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.gettingStarted.v1')).mode) === 'dismissed', 'harvesting while the guide is dismissed does not force navigation or reopen it');

    await start();
    const runningTaskId = await create('Finish while the timer is running');
    await page.locator('#getting-started-focus').click(); await page.locator('#focus-start').click();
    await page.waitForFunction(() => Tracer.focus.read().running);
    const runningSession = await page.evaluate(() => Tracer.focus.read().runId);
    await page.locator('#focus-close').click(); failSave = true;
    await page.locator('#getting-started-complete').click();
    await page.waitForFunction(() => Tracer.store.dirty && !Tracer.store.inflight);
    check(await page.evaluate(id => Tracer.focus.read().running && Tracer.focus.read().task?.id === id && !!Tracer.focus.read().runId, runningTaskId) && workspace.tasks[0].status === 'doing', 'failed Done persistence leaves the matching running timer active');
    check(await page.evaluate(() => Tracer.focus.read().runId) === runningSession, 'failed completion keeps the original focus session identity');
    failSave = false; await page.locator('#getting-started-retry').click(); await saved();
    await page.waitForFunction(() => !Tracer.focus.read().task && !Tracer.focus.read().running && !Tracer.focus.read().runId);
    check(await page.evaluate(() => Tracer.focus.read().remaining === Tracer.focus.read().duration), 'successful Done retry clears and resets the previously running timer');

    const otherWorkspace = M.emptyWorkspace(), otherTask = M.addTask(otherWorkspace, { title: 'Keep this ongoing focus', status: 'doing' });
    await start(otherWorkspace); await page.locator('#getting-started-open').click();
    const separatelyDoneId = await create('Complete a different task');
    await page.locator('#getting-started-focus').click(); await page.locator('#focus-task').selectOption(otherTask.id); await page.locator('#focus-start').click();
    await page.waitForFunction(id => Tracer.focus.read().running && Tracer.focus.read().task?.id === id, otherTask.id);
    const independentFocus = await page.evaluate(() => ({ id: Tracer.focus.read().task.id, runId: Tracer.focus.read().runId, endAt: Tracer.focus.read().endAt }));
    await page.locator('#focus-close').click(); await page.locator('#getting-started-complete').click(); await saved();
    check(workspace.tasks.find(task => task.id === separatelyDoneId).status === 'done' && await page.evaluate(before => {
      const focus = Tracer.focus.read(); return focus.running && focus.task?.id === before.id && focus.runId === before.runId && focus.endAt === before.endAt;
    }, independentFocus), 'completing a different task preserves the ongoing timer and its end time');

    await start();
    await page.locator('#getting-started-dismiss').click(); await page.reload(); await ready();
    check(!await page.locator('#getting-started').isVisible(), 'skipping the guide remains skipped after reload');
    await page.locator('#getting-started-open').click(); await page.locator('#getting-started-title').waitFor();
    check(await page.locator('#getting-started').isVisible(), 'Getting started button reopens a skipped guide');
    for (const language of ['en', 'zh']) {
      await page.selectOption('#language-select', language);
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        check(await page.locator('#getting-started').evaluate(node => node.scrollWidth <= node.clientWidth + 1), language + ' guide content fits ' + width + 'px');
        check(await page.locator('#getting-started-title').evaluate(node => { const a = node.getBoundingClientRect(), b = node.closest('#getting-started').getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; }), language + ' title field fits its narrow panel');
        await page.locator('#getting-started').screenshot({ path: path.join(artifacts, 'guide-' + language + '-' + width + '.png'), animations: 'disabled' });
        await page.locator('#getting-started-title').fill('A reachable next step');
        await page.locator('#getting-started-create').scrollIntoViewIfNeeded();
        check(await page.locator('#getting-started-create').evaluate(node => {
          const button = node.getBoundingClientRect(), main = node.closest('.main').getBoundingClientRect();
          const visible = document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2);
          return button.top >= main.top - 1 && button.bottom <= main.bottom + 1 && (visible === node || node.contains(visible));
        }), language + ' create action is reachable within the scrolling workspace at ' + width + 'px');
        await page.screenshot({ path: path.join(artifacts, 'guide-form-' + language + '-' + width + '.png'), animations: 'disabled' });
      }
    }

    const old = M.emptyWorkspace(); M.addTask(old, { title: 'An existing task' });
    await start(old);
    check(!await page.locator('#getting-started').isVisible(), 'an existing workspace is not interrupted by automatic onboarding');
    await page.locator('#getting-started-open').click();
    check(await page.locator('#getting-started').isVisible(), 'existing users can deliberately open the guide');
    const historical = M.emptyWorkspace(); historical.meta.seqCounter = 7;
    await start(historical);
    check(!await page.locator('#getting-started').isVisible(), 'an emptied workspace with task history is not treated as a new installation');

    await start(); failSave = true;
    await page.locator('#getting-started-title').fill('Save once, retry safely');
    await page.locator('#getting-started-create').click();
    await page.waitForFunction(() => Tracer.store.dirty && !Tracer.store.inflight && Tracer.store.data.tasks.length === 1);
    await page.locator('#getting-started-retry').waitFor();
    const pendingId = await page.evaluate(() => Tracer.store.data.tasks[0].id);
    check(workspace.tasks.length === 0, 'failed save does not claim persisted task success');
    check(!await page.locator('#getting-started-focus').isVisible() || await page.locator('#getting-started-focus').isDisabled(), 'focus is unavailable while the first task is unsaved');
    failSave = false; await page.locator('#getting-started-retry').click(); await saved();
    check(workspace.tasks.length === 1 && workspace.tasks[0].id === pendingId, 'retry saves the original task exactly once');
    await page.reload(); await ready(); await saved();
    check(workspace.tasks.length === 1 && workspace.tasks[0].id === pendingId, 'retried task remains a single task after reload');

    const currentTaskId = pendingId;
    await page.evaluate(() => {
      const other = TracerModel.addTask(Tracer.store.data, { title: 'Another ongoing task', status: 'doing' });
      Tracer.touch(); clearTimeout(Tracer.store.timer); Tracer.saveNow();
      const state = TracerFocus.fresh(); state.task = { id: other.id, title: other.title, projectId: null };
      TracerFocus.start(state, Date.now(), 'qa-existing-session');
      localStorage.setItem('tracer.focus.v1', JSON.stringify(state));
      dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1' }));
    }); await saved();
    const previousFocus = await page.evaluate(() => ({ runId: Tracer.focus.read().runId, task: Tracer.focus.read().task, endAt: Tracer.focus.read().endAt }));
    await page.locator('#getting-started-focus').click(); await page.locator('#focus-start').waitFor();
    const keptFocus = await page.evaluate(() => ({ runId: Tracer.focus.read().runId, task: Tracer.focus.read().task, endAt: Tracer.focus.read().endAt }));
    check(JSON.stringify(previousFocus) === JSON.stringify(keptFocus) && keptFocus.task.id !== currentTaskId, 'opening guidance preserves a different running focus session');
    check(await page.locator('#focus-error').isVisible(), 'preserved focus session is explained to the user');

    await start();
    await page.locator('#getting-started-dismiss').click();
    const guestGuide = await page.evaluate(() => localStorage.getItem('tracer.gettingStarted.v1'));
    accountScope = '11111111-1111-4111-8111-111111111111'; workspace = M.emptyWorkspace();
    await page.reload(); await ready(); await saved();
    check(await page.locator('#getting-started').isVisible(), 'a different local account does not inherit the guest dismissal');
    await page.locator('#getting-started-title').fill('Private account draft');
    await page.reload(); await ready();
    check(await page.locator('#getting-started-title').inputValue() === 'Private account draft', 'the named account retains its own guide draft');
    accountScope = 'guest'; workspace = M.emptyWorkspace();
    await page.reload(); await ready(); await saved();
    check(!await page.locator('#getting-started').isVisible() && await page.evaluate(() => localStorage.getItem('tracer.gettingStarted.v1')) === guestGuide, 'returning to guest restores its unchanged guide preference');
    await page.locator('#getting-started-open').click();
    check(await page.locator('#getting-started-title').inputValue() !== 'Private account draft', 'account draft text does not leak into the guest guide');

    await start();
    const otherTab = await context.newPage(); otherTab.setDefaultTimeout(10000);
    otherTab.on('pageerror', error => errors.push(error.message));
    await otherTab.goto(origin + '/?sec=board&phase=day', { waitUntil: 'domcontentloaded' });
    await otherTab.waitForFunction(() => window.Tracer?.gettingStarted && Tracer.store.data && !Tracer.store.dirty && !Tracer.store.inflight);
    const sharedTaskId = await create('One shared first task');
    await otherTab.waitForFunction(id => JSON.parse(localStorage.getItem('tracer.gettingStarted.v1'))?.taskId === id, sharedTaskId);
    check(await otherTab.evaluate(() => Tracer.store.data.tasks.length) === 0, 'second window still has a stale empty workspace before reload');
    check(!await otherTab.locator('#getting-started-create').isVisible() || await otherTab.locator('#getting-started-create').isDisabled(), 'second window cannot create over another window\'s first task');
    const writesBeforeStaleSubmit = attemptedWrites.length;
    await otherTab.evaluate(async () => {
      document.querySelector('#getting-started-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await otherTab.waitForFunction(async () => { const locks = await navigator.locks.query(); return !locks.held.length && !locks.pending.length; });
    check(attemptedWrites.length === writesBeforeStaleSubmit, 'a queued stale-window submit does not send another workspace write');
    await Promise.all([otherTab.waitForEvent('load'), otherTab.locator('#getting-started-reload').click()]);
    await otherTab.waitForFunction(id => window.Tracer?.store.data?.tasks.some(task => task.id === id) && !Tracer.store.dirty && !Tracer.store.inflight, sharedTaskId);
    check(await otherTab.evaluate(() => Tracer.store.data.tasks.length) === 1 && await otherTab.locator('#getting-started-focus').isVisible(), 'reloading the second window resumes the same first task');
    await page.locator('#getting-started-focus').click(); await page.locator('#focus-start').click();
    await otherTab.waitForFunction(id => Tracer.focus.read().running && Tracer.focus.read().task?.id === id && document.querySelectorAll('.getting-started-step')[1]?.classList.contains('is-done'), sharedTaskId);
    check(true, 'focus started in one window updates the second window\'s guide progress');
    await page.locator('#focus-start').click(); await page.locator('#focus-close').click();
    await page.locator('.card[data-id="' + sharedTaskId + '"] .card-move').selectOption('todo');
    await page.locator('[data-task-action="confirm"]').click(); await saved();
    check(workspace.tasks[0].status === 'todo', 'a task can be deliberately withdrawn through the existing board confirmation');
    await page.locator('#getting-started-focus').click(); await page.locator('#focus-task').waitFor(); await saved();
    check(workspace.tasks[0].status === 'doing' && await page.locator('#focus-task').inputValue() === sharedTaskId, 'one guide action restarts a withdrawn task and opens its focus timer after saving');

    for (let attempt = 0; attempt < Number(process.env.TRACER_QA_CONCURRENT_RUNS || 1); attempt++) {
    await start();
    const competingTab = await context.newPage(); competingTab.setDefaultTimeout(10000);
    competingTab.on('pageerror', error => errors.push(error.message));
    await competingTab.goto(origin + '/?sec=board&phase=day', { waitUntil: 'domcontentloaded' });
    await competingTab.waitForFunction(() => window.Tracer?.gettingStarted && Tracer.store.data && !Tracer.store.dirty && !Tracer.store.inflight);
    await page.locator('#getting-started-title').fill('First window intention');
    await competingTab.locator('#getting-started-title').fill('Second window intention');
    await Promise.all([page, competingTab].map(tab => tab.evaluate(() => document.querySelector('#getting-started-form').requestSubmit())));
    await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('tracer.gettingStarted.v1'))?.taskId);
    const electedTaskId = await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.gettingStarted.v1')).taskId);
    // A window can briefly look idle before its queued creation callback starts.
    // Observe persisted data before checking idle windows; never infer success
    // merely because both windows happened to be idle at different instants.
    await page.waitForFunction(async id => {
      const response = await fetch('/api/store/workspace');
      return response.ok && (await response.json()).tasks.some(task => task.id === id);
    }, electedTaskId);
    await Promise.all([page, competingTab].map(tab => tab.waitForFunction(async () => {
      const locks = await navigator.locks.query();
      return !locks.held.length && !locks.pending.length && !Tracer.store.dirty && !Tracer.store.inflight;
    })));
    const createdIds = new Set(attemptedWrites.flatMap(ws => ws.tasks.map(task => task.id)));
    if (workspace.tasks.length !== 1 || createdIds.size !== 1) {
      console.error('Concurrent submission state:', JSON.stringify({
        diskTasks: workspace.tasks.map(task => ({ id: task.id, title: task.title })),
        writes: attemptedWrites.map(ws => ws.tasks.map(task => ({ id: task.id, title: task.title }))),
        windows: await Promise.all([page, competingTab].map(tab => tab.evaluate(() => ({ tasks: Tracer.store.data.tasks.map(task => ({ id: task.id, title: task.title })), state: JSON.parse(localStorage.getItem('tracer.gettingStarted.v1')), dirty: Tracer.store.dirty, inflight: Tracer.store.inflight, locks: !!navigator.locks }))))
      }, null, 2));
    }
    check(workspace.tasks.length === 1 && createdIds.size === 1, 'simultaneous window submissions create and persist only one task identity');
    check(workspace.taskGarden?.seeds?.length === 1 && workspace.taskGarden.seeds[0].taskId === workspace.tasks[0].id, 'simultaneous submissions produce only one matching garden seed');
    const winningTaskId = workspace.tasks[0].id;
    await Promise.all([page, competingTab].map(tab => tab.reload()));
    await Promise.all([page, competingTab].map(tab => tab.waitForFunction(id => window.Tracer?.store.data?.tasks.length === 1 && Tracer.store.data.tasks[0].id === id && !Tracer.store.dirty && !Tracer.store.inflight, winningTaskId)));
    check(await page.locator('#getting-started-focus').isVisible() && await competingTab.locator('#getting-started-focus').isVisible(), 'both competing windows resume the same saved task after reload');
    }

    await start();
    await page.locator('#getting-started-title').fill('Must not be created after account lock');
    const beforeLockWrites = attemptedWrites.length;
    await page.evaluate(() => {
      TracerAccount.lock();
      document.querySelector('#getting-started-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    check(await page.evaluate(() => Tracer.store.data.tasks.length) === 0 && attemptedWrites.length === beforeLockWrites, 'stale account lock rejects guide writes even if a queued submit arrives');
    check(errors.length === 0, 'all guide scenarios finish without browser runtime errors');
    check(external.length === 0, 'all QA requests stay on the isolated local HTTP server');
    const summary = { results, artifacts };
    fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    console.error(JSON.stringify({ completed: results, browserErrors: errors, artifacts }, null, 2));
    throw error;
  } finally {
    await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
