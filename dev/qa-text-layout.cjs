'use strict';
// Optional browser QA; use TRACER_QA_PLAYWRIGHT to point at an existing install.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(root, '.cache/text-layout-'));
Object.assign(process.env, {
  DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer',
  DOCS_PORTAL_DATA_DIR: path.join(temporary, 'data'),
  DOCS_PORTAL_STATE_FILE: path.join(temporary, 'bookmarks.json')
});
const { server } = require('../server');

// Use rendered text bounds, not just scrollWidth: an outline can cover a
// caption even when the dialog has no horizontal overflow.
async function inspect(page, caption) {
  const issues = await page.locator('.modal').evaluate(modal => {
    const issues = [];
    const visible = el => el.checkVisibility();
    const bounds = modal.getBoundingClientRect();
    if (modal.scrollWidth > modal.clientWidth + 1) issues.push('dialog overflows horizontally');
    if (bounds.left < -1 || bounds.right > innerWidth + 1) issues.push('dialog outside viewport');
    for (const label of modal.querySelectorAll('label')) {
      if (!visible(label)) continue;
      const control = label.control;
      if (!control || !visible(control) || ['checkbox', 'radio'].includes(control.type)) continue;
      const range = document.createRange();
      if (label.contains(control)) {
        range.setStart(label, 0); range.setEndBefore(control);
      } else range.selectNodeContents(label);
      const text = range.getBoundingClientRect(), input = control.getBoundingClientRect();
      const gap = input.top - text.bottom;
      const sharesColumn = Math.min(text.right,input.right) - Math.max(text.left,input.left) > 1;
      if ((label.classList.contains('ai-field') || sharesColumn) && gap < (label.classList.contains('ai-field') ? 6 : 0)) issues.push(control.id + ': caption gap ' + gap);
    }
    for (const el of modal.querySelectorAll('input,textarea,select,button,.ai-schedule-row > span,.ai-week > span')) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left < bounds.left || rect.right > bounds.right) issues.push((el.id || el.className || el.tagName) + ': outside dialog');
    }
    for (const row of modal.querySelectorAll('.ai-schedule-row,.ai-week,.modal-actions,.focus-settings-grid')) {
      if (!visible(row)) continue;
      const items = [...row.children].filter(visible);
      for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
        const x = items[a].getBoundingClientRect(), y = items[b].getBoundingClientRect();
        if (Math.min(x.right,y.right)-Math.max(x.left,y.left)>1 && Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1) issues.push('overlapping children: ' + row.className);
      }
    }
    return issues;
  });
  assert.deepEqual(issues, [], caption + ': ' + issues.join(', '));
  console.log('PASS ' + caption);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Local fixtures only: do not contact an AI provider or touch user data.
    await page.route('**/api/ai/**', route => route.fulfill({ json: { configured: false } }));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.Tracer?.store?.data);
    await page.evaluate(() => {
      const start = new Date().toISOString().slice(0,10);
      const title = 'LongUnbrokenTaskTitle'.repeat(10).slice(0, 200);
      localStorage.setItem('tracer.ai.draft.v1', JSON.stringify({
        id: 'layout-fixture', goal: '测试目标 / Layout review', feedback: '', context: false,
        documents: [{ name: 'LongDocumentName'.repeat(12) + '.txt', text: title }],
        constraints: { start, deadline: TracerAIPlanner.add(start,28), weekly: 10, daily: 3, session: 1, buffer: 15, days: [1,2,3,4,5] },
        plan: { title: 'Layout review', summary: title, questions: [title], assumptions: [], risks: [],
          tasks: [{ key: 't1', title, notes: title, acceptance: title, hours: 2, priority: 'medium', dependsOn: [], checklist: [title] }] }
      }));
    });
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.store?.data);
    for (const language of ['zh', 'en']) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.selectOption('#language-select', language);
      await page.click('#ai-open');
      for (const width of [360,420,700,720,760,1024,1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const step of [0,2,3]) {
          await page.click('[data-ai-step="' + step + '"]');
          if (step === 2) assert.ok(await page.locator('.ai-schedule-row').count(), 'schedule fixture renders: ' + await page.locator('#ai-error').textContent());
          await page.locator('.ai-dialog details').evaluateAll(els => els.forEach(el => el.open = true));
          await inspect(page, language + '/' + width + '/AI step ' + step);
          if (step === 3) {
            await page.click('#ai-mode-api');
            await page.locator('#ai-url').waitFor();
            await inspect(page, language + '/' + width + '/API settings');
            await page.click('#ai-mode-codex');
          }
        }
      }
      await page.click('[data-ai-step="0"]');
      await page.locator('#ai-goal').focus();
      await page.locator('.ai-dialog').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: path.join(temporary, 'ai-brief-' + language + '.png') });
      await page.setViewportSize({ width: 360, height: 800 });
      await page.click('[data-ai-step="2"]');
      await page.locator('.ai-dialog').evaluate(el => el.scrollTop = el.scrollHeight);
      await page.screenshot({ path: path.join(temporary, 'ai-review-narrow-' + language + '.png') });
      await page.click('#ai-close');
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.click('#new-btn');
      for (const width of [360,420,700,760,1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await inspect(page, language + '/' + width + '/task editor');
      }
      await page.click('#f-close');
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.click('#focus-open');
      await page.locator('.focus-modal details').evaluateAll(els => els.forEach(el => el.open = true));
      for (const width of [360,420,700,760,1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await inspect(page, language + '/' + width + '/focus settings');
      }
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, [], 'no renderer errors');
    console.log('Screenshots: ' + temporary);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
