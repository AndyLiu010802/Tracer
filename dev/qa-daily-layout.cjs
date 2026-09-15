'use strict';
// Optional browser QA: real workspace columns, isolated data, all bilingual quotes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(root, '.cache/daily-layout-'));
Object.assign(process.env, { DOCS_PORTAL_PORT: '18141', DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: path.join(temporary, 'data'), DOCS_PORTAL_STATE_FILE: path.join(temporary, 'bookmarks.json') });
const { server } = require('../server');
const results = [];
(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18141, '127.0.0.1', resolve); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [900, 1100, 1440, 1600, 1788, 1792, 1920, 2560]) {
      for (const language of ['en', 'zh']) {
        const context = await browser.newContext({ viewport: { width, height: 1100 } });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(language => { localStorage.setItem('tracer.language', language); localStorage.setItem('tracer.railWidth', '760'); }, language);
        await page.goto('http://127.0.0.1:18141/?sec=inbox', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.TracerDaily && document.getElementById('daily-text').textContent.length);
        for (let quote = 0; quote < 7; quote++) {
          const measure = await page.evaluate(({ quote, language }) => {
            const content = TracerDaily.quotes[quote];
            document.getElementById('daily-text').textContent = content[language];
            document.getElementById('daily-source').textContent = '\u2014 ' + content[language === 'en' ? 'authorEn' : 'authorZh'] + ' \u2197';
            const quickPause = document.getElementById('music-quick-pause');
            quickPause.hidden = quote % 2 === 0;
            quickPause.textContent = language === 'en' ? 'Pause audio' : '\u6682\u505c\u97f3\u9891';
            const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
            const card = rect('.daily-bar'), text = rect('#daily-text'), actions = rect('.daily-actions');
            const elements = [...document.querySelectorAll('.daily-bar button, #daily-source, #daily-text, .daily-eyebrow')].filter(e => e.getClientRects().length);
            return { card, text, actions, lines: text.height / parseFloat(getComputedStyle(document.getElementById('daily-text')).lineHeight), overflow: elements.some(e => { const r = e.getBoundingClientRect(); return r.x < card.x || r.right > card.right + 1 || r.bottom > card.bottom + 1; }), cardOverflow: document.querySelector('.daily-bar').scrollWidth > document.querySelector('.daily-bar').clientWidth + 1, innerWidth };
          }, { quote, language });
          const label = width + 'px/' + language + '/quote-' + quote;
          assert.ok(!measure.overflow && !measure.cardOverflow, label + ': content remains inside the card');
          assert.ok(measure.card.right <= width + 1, label + ': card fits the workspace');
          assert.ok(measure.lines <= 4.1, label + ': readable lines instead of a column of individual words');
          const overlaps = measure.text.x < measure.actions.right && measure.text.right > measure.actions.x && measure.text.y < measure.actions.bottom && measure.text.bottom > measure.actions.y;
          assert.ok(!overlaps, label + ': controls do not overlap the quote');
          if (measure.card.width < 620) assert.ok(measure.text.width > measure.card.width * 0.72 && measure.actions.y >= measure.text.bottom, label + ': narrow cards give the quote a full row');
          if (quote === 5) {
            results.push({ width, language, cardWidth: measure.card.width, cardHeight: measure.card.height, quoteLines: measure.lines });
            if ([900, 1600, 2560].includes(width)) await page.locator('.daily-bar').screenshot({ path: path.join(root, '.cache', 'daily-' + width + '-' + language + '.png') });
          }
        }
        await page.locator('#focus-open').click(); assert.ok(await page.locator('#focus-large-clock').isVisible(), 'Focus control remains usable');
        await page.locator('#focus-close').click();
        await page.locator('#daily-card-hide').click(); assert.ok(await page.locator('.daily-bar').isHidden(), 'Hide control remains usable');
        await page.locator('#daily-card-toggle').click(); assert.ok(await page.locator('.daily-bar').isVisible(), 'Card can be restored');
        assert.equal(errors.length, 0, errors.join('\n'));
        await context.close();
      }
    }
    fs.writeFileSync(path.join(root, '.cache/daily-layout-result.json'), JSON.stringify({ scenarios: 112, results }, null, 2));
    console.log('PASS 112 quote layouts across 8 desktop widths and both languages, audio action, focus controls and hide/restore');
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => server.close());
