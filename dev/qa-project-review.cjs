'use strict';
// Read-only renderer QA against a real server and an isolated synthetic workspace.
// The runtime copy cannot read the developer's local.config.json or user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');
const F = require('../skins/tracer/focus-model');
const G = require('../public/task-garden');

async function main() {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache', 'project-review-'));
  const runtime = path.join(artifacts, 'source'), data = path.join(artifacts, 'data'), music = path.join(artifacts, 'music');
  for (const dir of [runtime, data, music]) fs.mkdirSync(dir);
  for (const name of ['server.js', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(runtime, name));
  fs.cpSync(path.join(root, 'lib'), path.join(runtime, 'lib'), { recursive: true });
  for (const name of ['skins', 'public', 'ai-service']) fs.symlinkSync(path.join(root, name), path.join(runtime, name), 'junction');
  fs.writeFileSync(path.join(runtime, 'local.config.json'), JSON.stringify({ skin: 'tracer', host: '127.0.0.1', autoHide: 'off' }));
  Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(artifacts, 'state.json'), DOCS_PORTAL_MUSIC_DIR: music });

  const ws = M.emptyWorkspace(), projectA = M.addProject(ws, { name: 'Project A · Design launch' }), projectB = M.addProject(ws, { name: 'Project B · Archived writing' });
  const a1 = M.addTask(ws, { title: 'Design a useful launch page', projectId: projectA.id, status: 'doing', estimate: 2, spent: 1.5 });
  M.updateTask(ws, a1.id, { status: 'done' });
  const a2 = M.addTask(ws, { title: 'Zero estimate is still a value', projectId: projectA.id, estimate: 0, spent: 0 });
  M.addTask(ws, { title: 'Hours not entered', projectId: projectA.id, status: 'doing' });
  const cleared = M.addTask(ws, { title: 'A cleared completed task', projectId: projectA.id, status: 'done', estimate: 8, spent: 6 });
  ws.tasks = ws.tasks.filter(task => task.id !== cleared.id);
  const b1 = M.addTask(ws, { title: 'An archived project task', projectId: projectB.id, status: 'doing' });
  M.updateTask(ws, b1.id, { status: 'done' }); G.archiveProject(ws, projectB.id);
  G.reconcile(ws);
  const workspaceFile = path.join(data, 'workspace.json'); fs.writeFileSync(workspaceFile, JSON.stringify(ws));
  const originalWorkspaceBytes = fs.readFileSync(workspaceFile, 'utf8');
  const today = new Date(); today.setHours(10, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const focus = F.fresh();
  focus.history = [
    { id: 'review-a-25', endedAt: today.getTime(), minutes: 25, task: { id: a1.id, title: a1.title, projectId: projectA.id } },
    { id: 'review-b-50', endedAt: today.getTime(), minutes: 50, task: { id: b1.id, title: b1.title, projectId: projectB.id } },
    { id: 'review-old-a-15', endedAt: yesterday.getTime(), minutes: 15, task: { id: a2.id, title: a2.title } },
    { id: 'review-unassigned-7', endedAt: today.getTime(), minutes: 7, task: { id: 'unassigned-task', title: 'Unassigned focus', projectId: null } }
  ];
  focus.totalMinutes = 97; focus.roundsDone = 4;
  const { server } = require(path.join(runtime, 'server.js'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const results = [], errors = [], external = [], writes = [];
  let browser, context, page;
  const check = (condition, label) => { assert.ok(condition, label); results.push(label); };
  const ready = () => page.waitForFunction(() => window.Tracer?.store.data && !Tracer.store.lost);
  const focusTile = () => page.locator('.ins-tile').nth(2).locator('.ins-num');
  const metric = key => page.locator('[data-review-metric="' + key + '"]');
  async function number(key) { const match = (await metric(key).innerText()).match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : null; }
  async function updateFocus(action, argument) {
    await page.evaluate(({ action, argument }) => {
      const value = JSON.parse(localStorage.getItem('tracer.focus.v1'));
      if (action === 'append') { value.history.push(argument); value.totalMinutes += argument.minutes; }
      if (action === 'limit') {
        while (value.history.length < 500) value.history.push({ id: 'retained-b-' + value.history.length, endedAt: argument.at, minutes: 1, task: { id: argument.taskId, title: 'Other retained focus', projectId: argument.projectId } });
        value.totalMinutes = value.history.reduce((sum, row) => sum + row.minutes, 0) + 50;
      }
      localStorage.setItem('tracer.focus.v1', JSON.stringify(value));
      dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1' }));
    }, { action, argument });
  }
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { external.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false, imageGeneration: false } });
      if (request.method() !== 'GET' && request.method() !== 'HEAD') writes.push({ path: url.pathname, method: request.method() });
      return route.continue();
    });
    await context.addInitScript(value => {
      if (localStorage.getItem('qa-review-seeded')) return;
      localStorage.setItem('tracer.language', 'en'); localStorage.setItem('tracer.focus.v1', JSON.stringify(value));
      localStorage.setItem('qa-review-seeded', '1');
    }, focus);
    page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/?sec=insights&phase=day', { waitUntil: 'domcontentloaded' }); await ready();
    await page.locator('#project-review-empty').waitFor();
    check(await page.locator('#project-review-empty').isVisible(), 'all-project view explains that a project must be selected');
    await page.locator('[data-period="all"]').click();
    check(await focusTile().innerText() === '97', 'all-project focus includes every retained session');
    const timerBeforeReading = await page.evaluate(() => localStorage.getItem('tracer.focus.v1'));

    await page.locator('[data-sec="board"]').click();
    await page.locator('.proj-item[data-id="' + projectA.id + '"]').click();
    await page.locator('#board-project-review').click(); await page.locator('#project-review').waitFor();
    check(await page.locator('#ins-project').inputValue() === projectA.id && (await page.locator('#project-review-heading').innerText()).includes(projectA.name), 'board project review opens Insights with that project selected');
    check(await number('completed') === 2, 'cleared completion receipts still count as unique completed tasks');
    check(await number('estimate') === 2 && await number('spent') === 1.5, 'review uses retained manual hours without reconstructing cleared task hours');
    check(/2\s*\/\s*3/.test(await metric('estimate').evaluate(node => node.parentElement.textContent)) && /2\s*\/\s*3/.test(await metric('spent').evaluate(node => node.parentElement.textContent)), 'recorded zero counts as a filled value while missing hours do not');
    check(await number('focus') === 40 && await focusTile().innerText() === '40', 'Project A includes its explicit and inferred focus without Project B or unassigned sessions');
    const comparison = await page.locator('#project-review-comparison').innerText();
    check(comparison.includes('120') && comparison.includes('40'), 'estimate comparison uses minutes for matching estimated tasks');
    check(await page.evaluate(() => localStorage.getItem('tracer.focus.v1')) === timerBeforeReading, 'opening and selecting project review does not mutate timer state');

    const savedWorkspaceFixture = await page.evaluate(() => JSON.parse(JSON.stringify(Tracer.store.data)));
    const readFilters = () => page.evaluate(() => ({
      project: document.querySelector('#ins-project').value,
      from: document.querySelector('#ins-from').value,
      to: document.querySelector('#ins-to').value,
      search: document.querySelector('#ins-search').value,
      focused: document.activeElement && document.activeElement.id
    }));
    await page.locator('#ins-project').focus();
    const filtersBeforeSave = await readFilters();
    try {
      await page.evaluate(({ estimatedTaskId, inferredTaskId, otherProjectId }) => {
        const estimatedTask = Tracer.store.data.tasks.find(task => task.id === estimatedTaskId);
        estimatedTask.estimate = 3; estimatedTask.spent = 2.25;
        Tracer.store.data.tasks.find(task => task.id === inferredTaskId).projectId = otherProjectId;
        dispatchEvent(new Event('tracer-workspace-saved'));
      }, { estimatedTaskId: a1.id, inferredTaskId: a2.id, otherProjectId: projectB.id });
      check(await number('estimate') === 3 && await number('spent') === 2.25, 'a workspace save refreshes project estimates and manual time without a focus change');
      check(await number('focus') === 25 && await focusTile().innerText() === '25', 'a workspace save recomputes legacy focus attribution after the task moves projects');
      check(JSON.stringify(await readFilters()) === JSON.stringify(filtersBeforeSave), 'workspace-driven review refresh preserves every filter value and the focused project control');
    } finally {
      await page.evaluate(fixture => {
        Tracer.store.data = fixture;
        dispatchEvent(new Event('tracer-workspace-saved'));
      }, savedWorkspaceFixture);
    }
    check(await number('estimate') === 2 && await number('spent') === 1.5 && await number('focus') === 40 && await focusTile().innerText() === '40', 'restoring the workspace fixture refreshes the original project metrics');
    check(await page.evaluate(() => localStorage.getItem('tracer.focus.v1')) === timerBeforeReading, 'workspace-driven review refresh leaves focus history and timer state unchanged');

    await updateFocus('append', { id: 'review-live-b-10', endedAt: today.getTime(), minutes: 10, task: { id: b1.id, title: b1.title, projectId: projectB.id } });
    check(await number('focus') === 40 && await focusTile().innerText() === '40', 'a live Project B session does not increase selected Project A metrics');
    await updateFocus('append', { id: 'review-live-a-5', endedAt: today.getTime(), minutes: 5, task: { id: a1.id, title: a1.title, projectId: projectA.id } });
    await page.waitForFunction(() => document.querySelector('[data-review-metric="focus"]')?.textContent.includes('45') && document.querySelectorAll('.ins-tile .ins-num')[2]?.textContent === '45');
    check(await number('focus') === 45 && await focusTile().innerText() === '45', 'a live Project A session updates both project review and the existing focus tile');
    const unfilteredReview = await page.locator('#project-review').innerText();
    const todayISO = await page.evaluate(() => TracerModel.todayISO());
    await page.locator('#ins-from').fill(todayISO); await page.locator('#ins-from').press('Tab');
    await page.locator('#ins-to').fill(todayISO); await page.locator('#ins-to').press('Tab');
    check(await number('focus') === 45 && await focusTile().innerText() === '30', 'date filters change the lower focus tile while full retained project review stays unchanged');
    await page.locator('#ins-search').fill('No matching historical title');
    check(await page.locator('#project-review').innerText() === unfilteredReview, 'history search and date controls do not silently filter the project review card');
    await page.locator('#ins-search').fill('');

    await page.locator('#ins-project').selectOption(projectB.id);
    check((await page.locator('#project-review-heading').innerText()).includes(projectB.name), 'archived projects remain available for review');
    check(await number('estimate') === null && await number('spent') === null, 'missing hours are displayed as missing rather than zero');
    check(await number('focus') === 60 && await focusTile().innerText() === '60', 'archived Project B shows only its own retained focus');
    await page.locator('#ins-project').selectOption(projectA.id);

    await updateFocus('limit', { at: today.getTime(), taskId: b1.id, projectId: projectB.id });
    await page.waitForFunction(() => document.querySelector('#project-review-notes')?.textContent.includes('retention limit'));
    check(await number('focus') === 45, 'the retained-history limit never imports another project\'s minutes');
    check(/500/.test(await page.locator('#project-review').innerText()) && /cannot be assigned|unassign|unattribut|without a project|无法归属|未归属/i.test(await page.locator('#project-review-notes').innerText()), 'review explains retained-history and unattributed-session limits');
    const timerAfterFixture = await page.evaluate(() => localStorage.getItem('tracer.focus.v1'));

    for (const language of ['en', 'zh']) {
      await page.selectOption('#language-select', language);
      for (const width of [1200, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('#project-review').scrollIntoViewIfNeeded();
        check(await page.locator('#project-review').evaluate(node => node.scrollWidth <= node.clientWidth + 1), language + ' project review fits ' + width + 'px');
        await page.screenshot({ path: path.join(artifacts, 'review-' + language + '-' + width + '.png'), animations: 'disabled' });
      }
      await page.locator('[data-sec="board"]').click();
      await page.locator('.card[data-id="' + a2.id + '"] .card-title').click();
      check((await page.locator('label[for="f-spent"]').innerText()).includes(language === 'zh' ? '手填工时' : 'Manual time'), language + ' task editor identifies manually entered time');
      check(await page.locator('#f-estimate').inputValue() === '0' && await page.locator('#f-spent').inputValue() === '0', 'explicit zero hours remain present in the task editor');
      await page.locator('#f-cancel').click();
      await page.locator('#board-project-review').click();
    }
    await page.locator('#ins-project').selectOption('');
    check(await page.locator('#project-review-empty').isVisible(), 'clearing the project selection restores the review prompt');
    check(await page.evaluate(() => localStorage.getItem('tracer.focus.v1')) === timerAfterFixture, 'all review interactions preserve the supplied timer state byte for byte');
    check(await fsp.readFile(workspaceFile, 'utf8') === originalWorkspaceBytes, 'project review leaves the stored workspace byte for byte unchanged');
    check(writes.length === 0, 'read-only review sends no POST or PUT requests');
    check(errors.length === 0 && external.length === 0, 'review has no browser runtime errors or external requests');
    const summary = { results, artifacts }; fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    console.error(JSON.stringify({ completed: results, browserErrors: errors, writes, artifacts }, null, 2)); throw error;
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
