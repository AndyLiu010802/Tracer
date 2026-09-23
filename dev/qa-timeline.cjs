'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');
const root = path.resolve(__dirname, '..'), temporary = fs.mkdtempSync(path.join(root, '.cache/timeline-'));
const dataDir = path.join(temporary, 'data');
fs.mkdirSync(dataDir);
const ws = M.emptyWorkspace(), project = M.addProject(ws, { name: 'Weekend Apartment Reset' });
M.updateProject(ws, project.id, { start: '2026-09-25', end: '2026-09-26' });
const titles = ['Make a weekend reset plan', 'Buy groceries & cleaning supplies', 'Deep clean the kitchen', 'Meal prep for next week', 'Final apartment reset'];
const tasks = titles.map((title, i) => M.addTask(ws, { title, projectId: project.id, scheduled: M.addDays('2026-09-22', i), due: M.addDays('2026-09-22', i), status: i === 0 ? 'done' : i === 2 ? 'doing' : 'todo' }));
const undated = M.addTask(ws, { title: 'A very long unscheduled task title / \u5468\u672b\u516c\u5bd3\u6e05\u6d01\u6574\u7406'.repeat(2), projectId: project.id });
const loose = M.addTask(ws, { title: 'Unassigned deadline', due: '2026-09-27' });
M.addProject(ws, { name: 'Next project' });
const archived = M.addProject(ws, { name: 'Archived project' });
const archivedTask = M.addTask(ws, { title: 'Archived task', projectId: archived.id, scheduled: '2026-01-01', status: 'done' });
M.completeProject(ws, archived.id);
fs.writeFileSync(path.join(dataDir, 'workspace.json'), JSON.stringify(ws));
Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: dataDir, DOCS_PORTAL_STATE_FILE: path.join(temporary, 'bookmarks.json') });
const { server } = require('../server');
function check(value, label) { assert.ok(value, label); console.log('PASS ' + label); }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1100 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { if (!localStorage.getItem('tracer.language')) localStorage.setItem('tracer.language', 'en'); });
    const url = 'http://127.0.0.1:' + server.address().port;
    await page.goto(url + '/?sec=timeline');
    const projectBar = () => page.locator('.tl-bar[data-project="' + project.id + '"]');
    const taskRow = id => page.locator('.tl-task[data-id="' + id + '"]');
    async function saved() { await page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight); }
    async function projectDates(start, end) { check(await projectBar().getAttribute('data-start') === start && await projectBar().getAttribute('data-end') === end, 'project range: ' + start + ' / ' + end); }
    await projectBar().waitFor();
    await page.locator('#daily-card-hide').click();
    await projectDates('2026-09-22', '2026-09-26');
    check(await page.locator('.tl-task').count() === 7, 'dated, undated and unassigned tasks are listed');
    check(await taskRow(archivedTask.id).count() === 0, 'archived project tasks are excluded');
    check(await taskRow(undated.id).locator('.tl-set').count() === 1, 'undated tasks can be scheduled');
    check((await taskRow(loose.id).locator('.tl-bar').boundingBox()).width >= 6, 'single-date task has a visible bar');
    check(await page.locator('.tl-axis').evaluate(el => el.getBoundingClientRect().left === document.querySelector('.tl-track').getBoundingClientRect().left), 'month axis aligns with every track');
    await page.locator('#sec-timeline').screenshot({ path: path.join(temporary, 'timeline-en.png') });

    await projectBar().click();
    check(await page.locator('#d-auto').isChecked() && await page.locator('#d-start').isDisabled(), 'automatic dates are shown in the editor');
    await page.locator('#d-auto').uncheck();
    await page.locator('#d-start').fill('2026-09-25'); await page.locator('#d-end').fill('2026-09-23');
    await page.locator('#d-save').click();
    check(await page.locator('#d-error').isVisible(), 'reversed manual range is rejected');
    await page.locator('#d-start').fill('2026-09-23'); await page.locator('#d-end').fill('2026-09-24');
    await page.locator('#d-save').click(); await saved();
    await projectDates('2026-09-23', '2026-09-24');
    await taskRow(tasks[4].id).locator('.tl-name').click();
    await page.locator('#f-due').fill('2026-09-28'); await page.locator('#f-save').click(); await saved();
    await projectDates('2026-09-23', '2026-09-24');
    check(await taskRow(tasks[4].id).locator('.tl-bar').getAttribute('data-end') === '2026-09-28', 'manual project range does not clip its later tasks');
    await page.reload(); await projectBar().waitFor();
    await projectDates('2026-09-23', '2026-09-24');
    const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'workspace.json'), 'utf8'));
    check(stored.projects.find(p => p.id === project.id).timelineMode === 'manual', 'manual mode survives real disk persistence and reload');

    await projectBar().click(); await page.locator('#d-auto').check(); await page.locator('#d-save').click(); await saved();
    await projectDates('2026-09-22', '2026-09-28');
    await taskRow(undated.id).locator('.tl-set').click();
    await page.locator('#f-scheduled').fill('2026-09-21'); await page.locator('#f-due').fill('2026-09-21');
    await page.locator('#f-save').click(); await saved();
    await projectDates('2026-09-21', '2026-09-28');
    check(await page.evaluate(id => TracerModel.tasksOnDay(Tracer.store.data, '2026-09-21').some(t => t.id === id), undated.id), 'task edit also updates Planner data');
    await page.reload(); await projectBar().waitFor();
    await projectDates('2026-09-21', '2026-09-28');
    await projectBar().click(); await page.locator('#d-auto').uncheck(); await page.locator('#d-start').fill('2026-09-01'); await page.locator('#d-cancel').click();
    await projectDates('2026-09-21', '2026-09-28');
    const toggle = page.locator('[data-toggle="' + project.id + '"]');
    await toggle.focus(); await page.keyboard.press('Enter');
    check(await page.locator('.tl-task').count() === 1, 'keyboard collapse hides only this project tasks');
    await toggle.click(); check(await page.locator('.tl-task').count() === 7, 'project expands again');

    for (const language of ['zh', 'en']) {
      await page.selectOption('#language-select', language);
      for (const width of [1920, 1440, 1000]) {
        await page.setViewportSize({ width, height: 1100 });
        const layout = await page.locator('#sec-timeline').evaluate(sec => {
          const scroll = sec.querySelector('.tl-scroll');
          const names = [...sec.querySelectorAll('.tl-name')];
          return { fits: scroll.getBoundingClientRect().right <= sec.getBoundingClientRect().right + 1, labels: names.every(el => el.getBoundingClientRect().right <= el.closest('.tl-label').getBoundingClientRect().right), scrollable: scroll.scrollWidth > scroll.clientWidth };
        });
        check(layout.fits && layout.labels, language + '/' + width + ': timeline stays inside the pane and titles do not overlap');
        if (width === 1000) {
          check(layout.scrollable, 'narrow pane has horizontal scrolling');
          await page.locator('.tl-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth; });
          check(await page.locator('.tl-label').first().evaluate(el => Math.abs(el.getBoundingClientRect().left - document.querySelector('.tl-scroll').getBoundingClientRect().left) < 1), 'task names stay pinned while scrolling');
          check(await page.locator('.tl-corner').evaluate(el => Math.abs(el.getBoundingClientRect().right - document.querySelector('.tl-label').getBoundingClientRect().right) < 1), 'axis keeps the pinned title column clear');
        }
        await page.locator('#sec-timeline').screenshot({ path: path.join(temporary, 'timeline-' + language + '-' + width + '.png') });
      }
    }
    check(errors.length === 0, 'no renderer errors');
    console.log('Screenshots: ' + temporary);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => server.close());
