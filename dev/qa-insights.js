// Uses isolated browser storage and mock task APIs. No user task writes.
async (page) => {
  const results = [], errors = []; let saved;
  const check = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  await page.route('**/api/**', async route => {
    if (route.request().url().endsWith('/workspace')) {
      if (route.request().method() === 'PUT') { saved = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ json: saved || { tasks: [], projects: [], notes: [], inbox: [], meta: { seqCounter: 0, rev: 0 } } });
    }
    return route.fulfill({ json: {} });
  });
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1680, height: 1100 });
    await page.goto('http://127.0.0.1:8081/?sec=insights');
    await page.locator('.ins-empty').waitFor(); check(true, 'empty history gives an actionable empty state');
    saved = await page.evaluate(() => {
      const M = TracerModel, ws = M.emptyWorkspace();
      const p = M.addProject(ws, { name: 'Product studio' });
      for (let i = 0; i < 24; i++) {
        const title = ['Design system review', 'Release checklist', 'Research synthesis', 'Sprint retrospective'][i % 4];
        const t = M.addTask(ws, { title, projectId: p.id, assignee: i % 2 ? 'Alex' : 'Andy' });
        t.status = 'done'; const time = new Date(); time.setDate(time.getDate() - (i % 20)); time.setHours(10 + i % 5, 0, 0, 0); t.doneAt = time.getTime(); TaskHistory.record(ws, t);
        if (i < 3) M.deleteTask(ws, t.id); else if (i < 6) M.moveTask(ws, t.id, 'doing');
      }
      const legacy = M.addTask(ws, { title: 'Legacy completion' }); legacy.status = 'done'; legacy.doneAt = Date.now() - 86400000;
      const unknown = M.addTask(ws, { title: 'Undated legacy task' }); unknown.status = 'done';
      M.addTask(ws, { title: 'New history test' });
      return ws;
    });
    await page.reload(); await page.locator('.ins-history-task').first().waitFor();
    check(await page.locator('.ins-num').first().innerText() === '25', 'legacy and retained completions appear in the totals');
    check(await page.locator('.ins-warning').count() === 1, 'undated legacy task is explicitly excluded');
    check(await page.locator('.ins-history-task').count() === 15, 'history paginates without dropping records');
    await page.locator('#ins-next').click(); check(await page.locator('.ins-history-task').count() === 10, 'older completion records are reachable');
    await page.locator('#ins-prev').click();
    await page.locator('.ins-history-task').first().click(); check(await page.locator('.ins-snapshot').isVisible(), 'completion snapshot can be inspected'); await page.locator('#ins-close').click();
    await page.locator('#ins-search').fill('Legacy completion'); check(await page.locator('.ins-history-task').count() === 1, 'history search matches the saved title');
    await page.locator('#ins-search').fill('');
    const downloadPromise = page.waitForEvent('download'); await page.locator('#ins-export').click(); const download = await downloadPromise;
    check(download.suggestedFilename().endsWith('.csv'), 'filtered history exports as CSV');
    const today = await page.evaluate(() => TracerModel.todayISO());
    await page.locator('.ins-heat[data-date="' + today + '"]').click();
    check(await page.locator('#ins-from').inputValue() === today && await page.locator('#ins-to').inputValue() === today, 'completion calendar filters to the selected day');
    await page.locator('[data-period="30"]').click();
    await page.locator('#daily-card-hide').click(); await page.locator('#main').evaluate(e => e.scrollTop = 0);
    await page.screenshot({ path: '.cache/insights-overview.png', animations: 'disabled' });
    await page.locator('.ins-history').scrollIntoViewIfNeeded(); await page.screenshot({ path: '.cache/insights-history.png', animations: 'disabled' });
    await page.locator('[data-sec="board"]').click();
    const id = saved.tasks.find(t => t.title === 'New history test').id;
    await page.locator('.card[data-id="' + id + '"] .card-move').selectOption('done');
    await page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight);
    check(saved.completionHistory.some(h => h.title === 'New history test'), 'real status control persists an independent completion event');
    await page.locator('.card[data-id="' + id + '"] .card-move').selectOption('todo');
    await page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight);
    await page.reload(); await page.locator('[data-sec="insights"]').click();
    await page.locator('#ins-search').fill('New history test');
    check(await page.locator('.ins-history-task').count() === 1 && await page.locator('.ins-state.insReopened').count() === 1, 'reopened task retains its completed history after reload');
    await page.locator('#language-select').selectOption('en');
    check(await page.locator('.ins-header h1').innerText() === 'Insights', 'insights supports English');
    await page.locator('#ins-search').fill(''); await page.setViewportSize({ width: 1000, height: 850 });
    check(await page.locator('#sec-insights').evaluate(e => e.scrollWidth <= e.clientWidth + 2), 'narrow statistics layout does not overflow');
    check(errors.length === 0, 'no runtime errors');
    return { results };
  } catch (e) { await page.screenshot({ path: '.cache/insights-failure.png' }); return { results, error: e.message, errors }; }
}
