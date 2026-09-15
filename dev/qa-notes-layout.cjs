'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(root, '.cache/notes-layout-'));
Object.assign(process.env, { DOCS_PORTAL_PORT: '18142', DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: path.join(temporary, 'data'), DOCS_PORTAL_STATE_FILE: path.join(temporary, 'bookmarks.json') });
const { server } = require('../server');
const checks = [];
function check(value, label) { assert.ok(value, label); checks.push(label); console.log('PASS ' + label); }
(async () => {
  await new Promise(r => server.listen(18142, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { if (!localStorage.getItem('tracer.language')) localStorage.setItem('tracer.language', 'en'); localStorage.setItem('tracer.railWidth', '760'); });
    await page.goto('http://127.0.0.1:18142/?sec=notes');
    await page.locator('#note-new').click();
    await page.locator('#note-title').fill('User story');
    const content = '- Add more image\n- Remove more images\n\nA long note remains readable when the reference browser is open.';
    await page.locator('#note-body').fill(content);
    const originalWidth = (await page.locator('.note-list').boundingBox()).width;
    const grip = page.locator('.notes-grip');
    await grip.scrollIntoViewIfNeeded();
    const box = await grip.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 50); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + 50, { steps: 8 }); await page.mouse.up();
    check((await page.locator('.note-list').boundingBox()).width >= originalWidth + 50, 'dragging changes list width');
    await grip.focus(); await page.keyboard.press('Home');
    check((await page.locator('.note-list').boundingBox()).width === 168, 'keyboard Home narrows the list');
    await page.keyboard.press('ArrowRight');
    check((await page.locator('.note-list').boundingBox()).width === 184, 'arrow keys adjust width');
    await page.locator('#note-list-toggle').click();
    check(await page.locator('.note-list').isHidden(), 'list can be collapsed');
    check(await page.locator('#note-body').inputValue() === content, 'collapse retains draft text');
    await page.reload(); await page.locator('#note-body').waitFor();
    check(await page.locator('.note-list').isHidden(), 'collapse preference survives reload');
    check(await page.locator('#note-body').inputValue() === content, 'edited note survives reload');
    await page.locator('#note-list-toggle').click();
    check((await page.locator('.note-list').boundingBox()).width === 184, 'preferred width survives reload');
    for (const language of ['en', 'zh']) {
      await page.selectOption('#language-select', language);
      for (const width of [900, 1100, 1440, 1600, 1688, 1692, 1920]) {
        await page.setViewportSize({ width, height: 1200 });
        await page.waitForTimeout(80);
        const metrics = await page.evaluate(() => {
          const wrap = document.querySelector('.notes-wrap'), editor = document.querySelector('.note-editor');
          const r = editor.getBoundingClientRect(), w = wrap.getBoundingClientRect();
          return { width: r.width, available: w.width, hidden: document.querySelector('.note-list').hidden, compact: wrap.dataset.compact === 'true', fits: [...editor.querySelectorAll('input,textarea,button')].every(e => { const b = e.getBoundingClientRect(); return b.left >= w.left - 1 && b.right <= w.right + 1; }) };
        });
        check(metrics.fits && metrics.width >= Math.min(metrics.available, 320) - 1, language + '/' + width + ': editor and toolbar fit');
        if (metrics.compact) check(metrics.hidden && metrics.width >= metrics.available - 1, language + '/' + width + ': compact layout prioritizes the editor');
        await page.locator('#note-preview').click();
        check((await page.locator('.note-rendered').innerText()).includes('Add more image'), 'preview remains readable at ' + width);
        await page.locator('#note-edit').click();
        if (width === 1600) await page.locator('#sec-notes').screenshot({ path: path.join(root, '.cache/notes-narrow-' + language + '.png') });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1200 }); await page.waitForTimeout(80);
    await page.locator('#note-list-toggle').click(); check(await page.locator('.note-list').isVisible(), 'compact list can be opened');
    const list = await page.locator('.note-list').boundingBox(), editor = await page.locator('.note-editor').boundingBox();
    check(editor.y >= list.y + list.height, 'compact list stacks above editor');
    await page.locator('.note-item').first().click(); check(await page.locator('.note-list').isHidden(), 'selecting a page restores full-width editing');
    check(await page.locator('#note-body').inputValue() === content, 'selection preserves saved content');
    check(errors.length === 0, 'no renderer errors');
    await context.close();
    fs.writeFileSync(path.join(root, '.cache/notes-layout-result.json'), JSON.stringify({ checks }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(() => server.close());
