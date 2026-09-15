// Real audio streaming, isolated workspace responses and fresh browser storage.
async (page) => {
  const results = [], errors = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); results.push(message); };
  await page.route('**/api/**', r => /\/api\/music(?:\/|$)/.test(new URL(r.request().url()).pathname) ? r.continue() : r.fulfill({ json: r.request().url().endsWith('/workspace') ? { tasks: [], projects: [], notes: [], inbox: [], meta: { seqCounter: 0, rev: 0 } } : {} }));
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:8098/?sec=inbox');
    await page.waitForFunction(() => window.Tracer && window.Tracer.music);
    check(await page.locator('#main > .daily-bar').count() === 1, 'glass card is contained above the main section');
    check(await page.locator('.daily-bar #ambient-background').count() === 1, 'photograph is confined to the card');
    await page.locator('#daily-card-hide').click();
    check(await page.locator('.daily-bar').isHidden() && await page.locator('#focus-open-compact').isVisible(), 'hiding the entire card retains a compact timer entry');
    await page.reload();
    check(await page.locator('.daily-bar').isHidden(), 'hidden card preference survives reload');
    await page.locator('#focus-open-compact').click(); check(await page.locator('#focus-large-clock').isVisible(), 'timer works while the daily card is hidden');
    await page.locator('#focus-close').click(); await page.locator('#daily-card-toggle').click();
    check(await page.locator('.daily-bar').isVisible(), 'toolbar restores the daily card');
    await page.evaluate(() => { document.querySelector('#ambient-background').style.backgroundImage = 'url(/backgrounds/mountains.jpg)'; });
    await page.waitForFunction(async () => { const src = getComputedStyle(document.querySelector('#ambient-background')).backgroundImage.slice(5, -2); const img = new Image(); img.src = src; try { await img.decode(); return img.naturalWidth > 1000; } catch { return false; } });
    await page.locator('#sec-inbox input').waitFor();
    await page.screenshot({ path: '.cache/music-glass-card.png', animations: 'disabled' });
    await page.locator('#focus-open').click();
    await page.waitForFunction(() => document.querySelectorAll('#music-track option').length === 35);
    check(await page.locator('#focus-audio').evaluate(a => a.paused && !a.getAttribute('src')), 'opening the timer does not autoplay or download audio');
    const initial = await page.locator('#music-track').inputValue();
    await page.locator('#music-random').click(); check(initial !== await page.locator('#music-track').inputValue(), 'random selection avoids the current track');
    await page.locator('#music-play').click();
    await page.waitForFunction(() => document.querySelector('#focus-audio').currentTime > .4);
    check(await page.locator('#focus-audio').evaluate(a => !a.paused && a.loop && a.duration > 0), 'actual MP3 decodes and plays in single repeat mode');
    await page.locator('#music-volume').fill('20'); check(await page.locator('#focus-audio').evaluate(a => a.volume === .2), 'volume affects actual playback');
    await page.locator('#focus-close').click();
    check(await page.locator('#focus-audio').evaluate(a => !a.paused), 'closing the timer leaves audio playing');
    await page.locator('#music-quick-pause').click(); check(await page.locator('#focus-audio').evaluate(a => a.paused), 'card can pause music with the timer closed');
    await page.locator('#focus-open').click(); await page.locator('#music-track option').first().waitFor({ state: 'attached' });
    await page.locator('.music-plan summary').click();
    const ids = await page.locator('#music-track option').evaluateAll(rows => rows.slice(0, 2).map(r => r.value));
    for (const id of ids) { await page.locator('#music-add-track').selectOption(id); await page.locator('#music-add').click(); }
    for (const i of [0, 1]) { await page.locator('[data-music-duration="' + i + '"]').fill('0.1'); await page.locator('[data-music-duration="' + i + '"]').press('Tab'); }
    await page.locator('#music-mode').selectOption('sequence');
    check(await page.locator('#music-mode').inputValue() === 'sequence', 'selecting timed mode survives the pause and redraw');
    await page.locator('#music-play').click();
    await page.waitForFunction(() => document.querySelector('#focus-audio').currentTime > .5);
    await page.locator('#music-play').click();
    const before = await page.locator('#music-status').innerText();
    await new Promise(r => setTimeout(r, 1200));
    check(before === await page.locator('#music-status').innerText(), 'paused playlist does not consume its time allocation');
    await page.locator('#music-play').click();
    await page.waitForFunction(id => document.querySelector('#music-track').value === id && !document.querySelector('#focus-audio').paused, ids[1], { timeout: 15000 });
    check(true, 'playlist switches after six seconds of real media playback');
    await page.waitForFunction(id => document.querySelector('#music-track').value === id && !document.querySelector('#focus-audio').paused, ids[0], { timeout: 15000 });
    check(true, 'timed playlist returns to its first track');
    await page.locator('#music-play').click();
    await page.screenshot({ path: '.cache/music-timer.png' });
    await page.locator('#focus-close').click(); await page.locator('#language-select').selectOption('en');
    await page.locator('#focus-open').click(); check(await page.locator('.music-heading h3').innerText() === '♫ Relaxing audio', 'audio controls are bilingual');
    await page.reload(); await page.locator('#focus-open').click();
    await page.waitForFunction(() => document.querySelectorAll('#music-track option').length === 35);
    check(await page.locator('#focus-audio').evaluate(a => a.paused && a.volume === .2), 'reload restores volume without autoplay');
    await page.locator('.music-plan summary').click();
    check(await page.locator('#music-mode').inputValue() === 'sequence' && await page.locator('.music-plan-row').count() === 2, 'playlist settings persist after reload');
    await page.locator('#focus-close').click(); await page.setViewportSize({ width: 1000, height: 800 });
    const bounds = await page.locator('.daily-bar').boundingBox(), main = await page.locator('#main').boundingBox();
    check(bounds.x > main.x && bounds.x + bounds.width <= main.x + main.width, 'glass card retains an inset at smaller desktop widths');
    check(errors.length === 0, 'no JavaScript runtime errors');
    return { passed: results.length, results };
  } catch (e) { await page.screenshot({ path: '.cache/music-qa-failure.png' }); return { passed: results.length, results, error: e.message, errors }; }
}
