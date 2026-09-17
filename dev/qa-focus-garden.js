async (page) => {
  const results = [], errors = [];
  const check = (v, label) => { if (!v) throw new Error(label); results.push(label); };
  const tasks = [
    { id: 'one', seq: 'TRC-1', title: 'Design review', status: 'review', notes: '', order: 1 },
    { id: 'two', seq: 'TRC-2', title: 'Prepare product launch', status: 'doing', notes: 'Align the final release checklist with the design and engineering teams.', assignee: 'Andy', priority: 'high', labels: ['Release', 'Design'], estimate: 8, spent: 3, checklist: [{ id: 'a', text: 'Review', done: true }, { id: 'b', text: 'Publish', done: false }], order: 1 },
    { id: 'three', seq: 'TRC-3', title: 'Explore onboarding improvements', status: 'todo', type: 'research', labels: ['Experience'], order: 1 },
    { id: 'four', seq: 'TRC-4', title: 'Update component library', status: 'done', order: 1 }
  ];
  await page.route('**/api/**', r => r.fulfill({ json: r.request().url().endsWith('/workspace') ? { tasks, projects: [], notes: [], inbox: [], meta: { seqCounter: 4, rev: 0 } } : {} }));
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1680, height: 1000 });
    await page.goto('http://127.0.0.1:8081/?sec=board');
    await page.locator('.card').first().waitFor();
    await page.screenshot({ path: '.cache/crystal-board.png', animations: 'disabled' });
    await page.locator('[data-sec="planner"]').click(); await page.locator('.pl-card').first().waitFor();
    await page.screenshot({ path: '.cache/crystal-planner.png', animations: 'disabled' });
    check(await page.locator('.pl-card').first().evaluate(e => getComputedStyle(e).backdropFilter.includes('blur')), 'planner cards use the shared crystal surface');
    await page.locator('#focus-open').click();
    await page.locator('.focus-settings summary').click(); await page.locator('#focus-setting-focus').fill('1'); await page.locator('#focus-setting-focus').press('Tab');
    await page.waitForFunction(() => document.querySelector('#focus-large-clock').textContent === '01:00');
    await page.locator('#focus-start').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    await page.keyboard.press('a'); await page.keyboard.press('a');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).activity.keys.a === 2);
    check(true, 'real keystrokes are accumulated during focus');
    await page.locator('#focus-start').click();
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    await page.keyboard.press('a'); await page.keyboard.press('a');
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).activity.keys.a === 2), 'paused timer does not count new keys');
    await page.locator('#focus-start').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tracer.focus.v1')); s.endAt = Date.now() - 1; localStorage.setItem('tracer.focus.v1', JSON.stringify(s)); dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1' })); });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('dbconsole.farm.v3'))?.pomo.done === 1);
    check(await page.evaluate(() => { const farm = JSON.parse(localStorage.getItem('dbconsole.farm.v3')); return farm.stats.earned === 60 && farm.focusLink.credited.length === 1; }), 'completed focus automatically awards exactly 60 coins');
    await page.locator('#focus-close').click(); await page.locator('[data-sec="garden"]').click();
    await page.locator('[data-home-action="open-leisure"]').click();
    await page.locator('[data-tab="stats"]').click();
    await page.waitForFunction(() => document.querySelector('[data-focus-stat="minutes"]')?.textContent === '1');
    check(true, 'garden shows minutes from the shared timer');
    await page.locator('[data-act="pomo"]').click(); await page.locator('#focus-large-clock').waitFor();
    check(await page.locator('#focus-large-clock').innerText() === '00:00', 'garden button opens the same completed timer');
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.focus);
    check(await page.evaluate(() => { const f = JSON.parse(localStorage.getItem('dbconsole.farm.v3')); return f.stats.earned === 60 && f.pomo.done === 1; }), 'reload does not duplicate the reward or completed count');
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).activity.keys.a === 2), 'focus heatmap persists after reload');
    check(errors.length === 0, 'no browser errors');
    return { results };
  } catch (e) { await page.screenshot({ path: '.cache/focus-garden-failure.png' }); return { results, error: e.message, errors }; }
}
