'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(root, '.cache/project-delete-'));
Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: path.join(temporary, 'data'), DOCS_PORTAL_STATE_FILE: path.join(temporary, 'bookmarks.json') });
const { server } = require('../server');

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.Tracer?.store?.data);
    for (const language of ['zh', 'en']) {
      await page.selectOption('#language-select', language);
      const ids = await page.evaluate(() => {
        const M = TracerModel, ws = Tracer.store.data;
        const project = M.addProject(ws, { name: '测试删除 <project> ' + 'LongProjectName'.repeat(10) });
        const keep = M.addProject(ws, { name: 'Keep this project' });
        const task = M.addTask(ws, { title: 'Owned task', projectId: project.id, status: 'done', scheduled: M.todayISO() });
        M.addTask(ws, { title: 'Owned pending task', projectId: project.id });
        const keptTask = M.addTask(ws, { title: 'Keep this task', projectId: keep.id, dependsOn: [task.id] });
        M.addNote(ws, { title: 'Owned project note', projectId: project.id });
        const focus = TracerFocus.fresh(); focus.task = { id: task.id, title: task.title };
        focus.history = [{ id: 'qa', task: focus.task, endedAt: Date.now(), minutes: 25 }];
        focus.totalMinutes = 25; focus.roundsDone = 1;
        localStorage.setItem('tracer.focus.v1', JSON.stringify(focus));
        Tracer.touch(); Tracer.redraw();
        return { project: project.id, keep: keep.id, task: keptTask.id };
      });
      await page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight);
      await page.locator('.proj-item[data-id="' + ids.project + '"]').click();
      const button = page.locator('[data-delete-project="' + ids.project + '"]');
      await button.click();
      assert.equal(await page.locator('#project-delete-cancel').evaluate(el => el === document.activeElement), true);
      assert.ok((await page.locator('.project-delete-dialog').innerText()).includes('2'));
      for (const width of [360,760,1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.locator('.project-delete-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      }
      await page.screenshot({ path: path.join(temporary, 'confirm-' + language + '.png') });
      await page.locator('#project-delete-cancel').click();
      assert.equal(await button.count(), 1);
      await button.click(); await page.keyboard.press('Escape');
      assert.equal(await button.count(), 1);
      await button.click(); await page.locator('#project-delete-confirm').click();
      await page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight);
      assert.equal(await button.count(), 0);
      assert.equal(await page.evaluate(() => Tracer.projectFilter()), null);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).history.length === 0);
      await page.reload(); await page.waitForFunction(() => window.Tracer?.store?.data);
      const result = await page.evaluate(ids => {
        const ws = Tracer.store.data;
        return {
          absent: !ws.projects.some(p => p.id === ids.project) && !ws.tasks.some(t => t.projectId === ids.project) && !ws.notes.some(n => n.projectId === ids.project) && !TaskHistory.completed(ws).some(h => h.projectId === ids.project),
          kept: ws.projects.some(p => p.id === ids.keep) && TracerModel.findTask(ws, ids.task).dependsOn.length === 0,
          focus: Tracer.focus.read().history.length
        };
      }, ids);
      assert.deepEqual(result, { absent: true, kept: true, focus: 0 });
      for (const section of ['board','planner','timeline','map','notes','insights']) await page.evaluate(section => Tracer.show(section), section);
      await page.selectOption('#ins-project', ids.keep);
      await page.locator('[data-delete-project="' + ids.keep + '"]').click();
      await page.locator('#project-delete-confirm').click();
      assert.equal(await page.locator('#ins-project').inputValue(), '');
      await page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight);
      console.log('PASS ' + language + ': cancel, Escape, confirm, active filter, cascade, focus cleanup, reload and all related views');
    }
    assert.deepEqual(errors, []);
    console.log('Screenshots: ' + temporary);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
