async (page) => {
  const results = [], errors = [];
  const check = (v, label) => { if (!v) throw new Error(label); results.push(label); };
  const origin = process.env.TRACER_QA_ORIGIN || 'http://127.0.0.1:8081';
  const legacy = JSON.stringify({ v: 3, stats: { earned: 71, harvested: 12, fish: 3 }, pomo: { done: 4 }, marker: 'untouched-legacy-save' });
  const tasks = [
    { id: 'one', seq: 'TRC-1', title: 'Design review', status: 'review', notes: '', order: 1 },
    { id: 'two', seq: 'TRC-2', title: 'Prepare product launch', status: 'doing', notes: 'Align the final release checklist with the design and engineering teams.', assignee: 'Andy', priority: 'high', labels: ['Release', 'Design'], estimate: 8, spent: 3, checklist: [{ id: 'a', text: 'Review', done: true }, { id: 'b', text: 'Publish', done: false }], order: 1 },
    { id: 'three', seq: 'TRC-3', title: 'Explore onboarding improvements', status: 'todo', type: 'research', labels: ['Experience'], order: 1 },
    { id: 'four', seq: 'TRC-4', title: 'Update component library', status: 'done', order: 1 }
  ];
  await page.addInitScript(value => {
    if (localStorage.getItem('dbconsole.farm.v3') === null) localStorage.setItem('dbconsole.farm.v3', value);
  }, legacy);
  await page.route('**/api/**', r => r.fulfill({ json: r.request().url().endsWith('/workspace') ? { tasks, projects: [], notes: [], inbox: [], meta: { seqCounter: 4, rev: 0 } } : {} }));
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1680, height: 1000 });
    await page.goto(origin + '/?sec=board');
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
    const beforePulses = await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).activity);
    await page.evaluate(() => {
      const data = { __aside: 1, type: 'farm', kind: 'key' };
      const dispatch = (value, origin = location.origin, source = window) => window.dispatchEvent(new MessageEvent('message', { data: value, origin, source }));
      dispatch(data, 'https://untrusted.invalid');
      dispatch(data, location.origin, null);
      [null, {}, { ...data, __aside: 0 }, { ...data, __aside: '1' }, { ...data, type: 'other' },
        { __aside: 1, type: 'farm' }, { ...data, kind: 'move' }, { ...data, kind: null }].forEach(value => dispatch(value));
      window.postMessage({ __aside: 1, type: 'farm', kind: 'key' }, location.origin);
      window.postMessage({ __aside: 1, type: 'farm', kind: 'click' }, location.origin);
    });
    await page.waitForFunction(before => {
      const activity = JSON.parse(localStorage.getItem('tracer.focus.v1')).activity;
      return activity.unknown >= before.unknown + 1 && activity.clicks >= before.clicks + 1;
    }, beforePulses);
    check(await page.evaluate(before => {
      const activity = JSON.parse(localStorage.getItem('tracer.focus.v1')).activity;
      return activity.unknown === before.unknown + 1 && activity.clicks === before.clicks + 1 &&
        activity.keys.LMB === (before.keys.LMB || 0) + 1 && activity.keys.a === before.keys.a &&
        Object.keys(activity.keys).length === new Set([...Object.keys(before.keys), 'LMB']).size;
    }, beforePulses), 'anonymous key and click pulses count once; untrusted sources and malformed messages are ignored');
    await page.locator('#focus-start').click();
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    const pausedActivity = await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).activity);
    await page.keyboard.press('a'); await page.keyboard.press('a');
    await page.evaluate(() => {
      window.postMessage({ __aside: 1, type: 'farm', kind: 'key' }, location.origin);
      window.postMessage({ __aside: 1, type: 'farm', kind: 'click' }, location.origin);
    });
    await page.waitForTimeout(650);
    check(await page.evaluate(before => JSON.stringify(JSON.parse(localStorage.getItem('tracer.focus.v1')).activity) === JSON.stringify(before), pausedActivity), 'paused timer excludes real keys and anonymous input pulses');
    await page.locator('#focus-start').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tracer.focus.v1')); s.endAt = Date.now() - 1; localStorage.setItem('tracer.focus.v1', JSON.stringify(s)); dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1' })); });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).completed);
    check(await page.evaluate(() => {
      const focus = JSON.parse(localStorage.getItem('tracer.focus.v1'));
      return focus.totalMinutes === 1 && focus.roundsDone === 1 && focus.history.length === 1 && focus.history[0].minutes === 1;
    }), 'completed focus saves one minute, one round and one history receipt');
    const completed = await page.evaluate(() => {
      const focus = JSON.parse(localStorage.getItem('tracer.focus.v1'));
      return { history: focus.history, activity: focus.activity };
    });
    await page.locator('#focus-close').click(); await page.locator('[data-sec="garden"]').click();
    await page.locator('#garden-home-root .garden-home').waitFor();
    check(await page.evaluate(() => typeof window.DBFarm === 'undefined' &&
      !document.querySelector('#garden-leisure-wrapper, #garden-main, #garden-shop, [data-home-action="open-leisure"]') &&
      !Array.from(document.scripts).some(script => /\/(?:farm|fishing|combat|equip|mining|magic)\.js(?:[?#]|$)/.test(script.src))), 'project garden remains available without legacy leisure entries or game engines');
    check(await page.evaluate(value => localStorage.getItem('dbconsole.farm.v3') === value, legacy), 'focus completion leaves the legacy farm save byte-for-byte unchanged');
    await page.locator('#focus-open').click(); await page.locator('#focus-large-clock').waitFor();
    check(await page.locator('#focus-large-clock').innerText() === '00:00', 'the shared timer remains accessible from the garden');
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.focus);
    check(await page.evaluate(before => {
      const focus = JSON.parse(localStorage.getItem('tracer.focus.v1'));
      return focus.completed && focus.totalMinutes === 1 && focus.roundsDone === 1 && JSON.stringify(focus.history) === JSON.stringify(before.history);
    }, completed), 'reload preserves exactly one completed focus receipt without adding minutes or rounds');
    check(await page.evaluate(before => JSON.stringify(JSON.parse(localStorage.getItem('tracer.focus.v1')).activity) === JSON.stringify(before.activity), completed), 'focus input counts persist after reload');
    check(await page.evaluate(value => localStorage.getItem('dbconsole.farm.v3') === value && typeof window.DBFarm === 'undefined', legacy), 'reload keeps legacy storage untouched and does not boot its engine');
    check(errors.length === 0, 'no browser errors');
    return { results };
  } catch (e) { await page.screenshot({ path: '.cache/focus-garden-failure.png' }); return { results, error: e.message, errors }; }
}
