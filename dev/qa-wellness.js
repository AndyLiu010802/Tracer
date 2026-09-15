// Optional Playwright scenario. API responses and browser storage are isolated from user data.
async (page) => {
  const p = await page.context().newPage(), results = [], errors = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  const workspace = { tasks: [{ id: 'focus-task', title: 'Prepare delivery', seq: 'TRC-1', status: 'todo', notes: '', order: 1000 }], projects: [], notes: [], inbox: [], meta: { seqCounter: 1, rev: 0 } };
  await p.route('**/api/**', r => r.fulfill({ json: r.request().url().endsWith('/workspace') ? workspace : {} }));
  await p.addInitScript(() => {
    window.qaNotificationRequests = 0; window.qaNotifications = [];
    window.qaChimes = 0;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) { const original = Audio.prototype.createOscillator; Audio.prototype.createOscillator = function () { window.qaChimes++; return original.call(this); }; }
    window.Notification = class {
      static permission = 'default';
      static async requestPermission() { window.qaNotificationRequests++; this.permission = 'granted'; return 'granted'; }
      constructor(title) { window.qaNotifications.push(title); }
      close() {}
    };
  });
  p.on('pageerror', e => errors.push(e.message));
  let other;
  try {
    await p.setViewportSize({ width: 1440, height: 960 });
    await p.goto('http://127.0.0.1:8081/?sec=board', { waitUntil: 'domcontentloaded' });
    await p.locator('#daily-text').waitFor();
    check((await p.locator('#daily-text').innerText()).length > 0, 'daily quote is present');
    check((await p.locator('#daily-source').getAttribute('href')).startsWith('https://ctext.org/'), 'quote links to primary text');
    const chinese = await p.locator('#daily-text').innerText();
    const scene = await p.locator('#ambient-name').innerText(); await p.locator('#ambient-shuffle').click();
    check(scene !== await p.locator('#ambient-name').innerText(), 'shuffle changes scenery');
    await p.locator('#ambient-toggle').click(); check(await p.locator('#ambient-background').isHidden(), 'background can be disabled');
    await p.reload({ waitUntil: 'domcontentloaded' });
    check(await p.locator('#ambient-background').isHidden(), 'background preference survives reload');
    check(chinese === await p.locator('#daily-text').innerText(), 'daily quote remains stable after reload');
    await p.locator('#ambient-toggle').click();
    await p.selectOption('#language-select', 'en'); check(chinese !== await p.locator('#daily-text').innerText(), 'quote switches to English');
    await p.selectOption('#language-select', 'zh');
    await p.screenshot({ path: '.cache/wellness-board.png' });
    await p.locator('#focus-open').click();
    await p.waitForFunction(() => document.querySelector('#focus-large-clock').textContent === '25:00');
    check(await p.evaluate(() => window.qaNotificationRequests === 0), 'notifications are never requested automatically');
    await p.locator('#focus-task').selectOption('focus-task');
    await p.locator('.focus-settings summary').click();
    await p.locator('#focus-setting-focus').fill('1'); await p.locator('#focus-setting-focus').press('Tab');
    await p.waitForFunction(() => document.querySelector('#focus-large-clock').textContent === '01:00');
    await p.locator('#focus-notifications').click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).settings.notifications);
    check(await p.evaluate(() => window.qaNotificationRequests === 1), 'notification request follows explicit click');
    await p.screenshot({ path: '.cache/wellness-clock.png' });
    await p.locator('#focus-start').click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    await p.locator('#focus-start').click();
    await p.waitForFunction(() => !JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    const paused = await p.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).remaining);
    check(paused > 0 && paused <= 60000, 'pause retains remaining duration');
    await p.reload({ waitUntil: 'domcontentloaded' });
    check(await p.evaluate(() => !JSON.parse(localStorage.getItem('tracer.focus.v1')).running), 'paused timer survives reload');
    await p.locator('#focus-open').click(); await p.locator('#focus-start').click();
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).running);
    other = await p.context().newPage();
    await other.route('**/api/**', r => r.fulfill({ json: r.request().url().endsWith('/workspace') ? workspace : {} }));
    await other.goto('http://127.0.0.1:8081/?sec=board', { waitUntil: 'domcontentloaded' });
    check(await other.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).running), 'second tab sees same active session');
    // Simulate resuming after the deadline, using actual cross-tab storage propagation.
    await other.evaluate(() => { const key = 'tracer.focus.v1', s = JSON.parse(localStorage.getItem(key)); s.endAt = Date.now() - 1; localStorage.setItem(key, JSON.stringify(s)); });
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).completed);
    const completed = await p.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')));
    check(completed.history.length === 1 && completed.history[0].task.id === 'focus-task', 'completed session is counted once with its task');
    check(completed.history[0].minutes === 1, 'today statistics use configured focus length');
    check(await p.locator('#focus-alarm').isVisible(), 'completion displays in-app alarm');
    await p.waitForFunction(() => window.qaChimes === 3);
    check(await p.evaluate(() => JSON.parse(localStorage.getItem('tracer.focus.v1')).lastNotifiedId === JSON.parse(localStorage.getItem('tracer.focus.v1')).alarm.id), 'completion plays chime and claims the alert once');
    await other.evaluate(() => { const key = 'tracer.focus.v1', s = JSON.parse(localStorage.getItem(key)); localStorage.setItem(key, JSON.stringify(s)); });
    check(await p.evaluate(() => window.qaChimes === 3), 'second tab does not duplicate the completion chime');
    await p.locator('#focus-close').click();
    await p.locator('#focus-alarm-next').click();
    await p.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('tracer.focus.v1')); return s.running && s.mode === 'short'; });
    check(await p.locator('#focus-alarm').isHidden(), 'next starts break and dismisses completed alarm');
    await p.setViewportSize({ width: 430, height: 850 });
    check(await p.locator('#focus-open').isVisible() && await p.locator('#daily-text').isVisible(), 'quote and timer remain visible on narrow window');
    check(await p.evaluate(() => document.querySelector('.daily-bar').getBoundingClientRect().right <= innerWidth + 1), 'daily toolbar stays inside viewport');
    check(errors.length === 0, 'no browser runtime errors');
    return { results };
  } catch (e) { return { results, error: e.message, browserErrors: errors }; }
  finally { if (other) await other.close(); await p.close(); }
}
