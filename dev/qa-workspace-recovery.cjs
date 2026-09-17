'use strict';
// Local-only migration QA: synthetic tasks, isolated browser storage and an
// isolated server data directory. No account or external service is accessed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');
const S = require('../public/workspace-sync');

async function main() {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache/workspace-recovery-'));
  const data = path.join(artifacts, 'data'); fs.mkdirSync(data);
  Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(artifacts, 'state.json') });
  const base = S.empty(); base.meta.syncAccount = 'synthetic-retired-account';
  M.addTask(base, { title: 'Original task', notes: 'Original notes' });
  const draft = S.clone(base), disk = S.clone(base);
  draft.tasks[0].title = 'Recovered unsaved title'; disk.tasks[0].title = 'Saved disk title'; disk.tasks[0].notes = 'Keep independently saved notes';
  fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify(disk));
  const raw = JSON.stringify({ base, data: draft });
  const { server } = require('../server');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const external = [], retired = [], errors = [], writes = [];
    let failOnce = true;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { external.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname.startsWith('/api/sync/')) { retired.push(url.pathname); return route.fulfill({ status: 410, json: { error: 'removed' } }); }
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false, imageGeneration: false } });
      if (url.pathname === '/api/store/workspace' && request.method() !== 'GET') {
        writes.push(request.postDataJSON());
        if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { error: 'synthetic-disk-failure' } }); }
      }
      return route.continue();
    });
    await context.addInitScript(raw => {
      if (!sessionStorage.getItem('qa-workspace-seeded')) {
        localStorage.setItem('tracer.cloudDraft', raw); localStorage.setItem('tracer.language', 'en'); sessionStorage.setItem('qa-workspace-seeded', '1');
      }
    }, raw);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/?sec=board');
    await page.waitForFunction(() => window.Tracer?.store.conflict);
    assert.equal(writes.length, 0); assert.equal(await page.evaluate(() => localStorage.getItem('tracer.cloudDraft')), raw);
    await page.locator('#save-dot').focus(); await page.keyboard.press('Enter');
    await page.locator('.draft-conflict').waitFor();
    assert.match(await page.locator('.draft-conflict').innerText(), /Recovered unsaved title/);
    assert.match(await page.locator('.draft-conflict').innerText(), /Saved disk title/);
    await page.screenshot({ path: path.join(artifacts, 'local-draft-conflict.png'), animations: 'disabled' });
    await page.click('#draft-resolve'); assert.equal(writes.length, 0, 'every conflict needs a deliberate choice');
    await page.click('#draft-later'); await page.reload();
    await page.waitForFunction(() => window.Tracer?.store.conflict);
    assert.equal(writes.length, 0, 'closing and reloading a conflicted draft never sends an overwrite beacon');
    await page.selectOption('#language-select', 'zh');
    assert.match(await page.locator('#save-dot').getAttribute('aria-label'), /草稿/);
    await page.click('#save-dot'); await page.locator('.draft-conflict').waitFor();
    assert.match(await page.locator('.draft-conflict').innerText(), /未保存草稿/);
    await page.locator('[data-choice]').selectOption('local'); await page.click('#draft-resolve');
    await page.waitForFunction(() => Tracer.store.dirty && !Tracer.store.inflight && document.querySelector('#save-dot').classList.contains('err'));
    assert.equal(writes.length, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('tracer.cloudDraft')), raw, 'failed local save preserves the original recovery source');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tracer.workspaceDraft')).data.tasks[0].title), 'Recovered unsaved title');
    const unchanged = await (await fetch(origin + '/api/store/workspace')).json(); assert.equal(unchanged.tasks[0].title, 'Saved disk title');
    await page.click('#save-dot'); await page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight);
    assert.equal(await page.evaluate(() => localStorage.getItem('tracer.cloudDraft')), null); assert.equal(await page.evaluate(() => localStorage.getItem('tracer.workspaceDraft')), null);
    const saved = await (await fetch(origin + '/api/store/workspace')).json();
    assert.equal(saved.tasks[0].title, 'Recovered unsaved title'); assert.equal(saved.tasks[0].notes, 'Keep independently saved notes');
    await page.reload(); await page.waitForFunction(() => window.Tracer?.store.data);
    assert.equal(await page.evaluate(() => Tracer.store.data.tasks[0].title), 'Recovered unsaved title');
    assert.equal(await page.evaluate(() => Tracer.store.conflict), null);
    assert.deepEqual(external, []); assert.deepEqual(retired, []); assert.deepEqual(errors, []);
    assert.equal(writes.length, 2);
    await page.screenshot({ path: path.join(artifacts, 'local-draft-saved.png'), animations: 'disabled' });
    console.log('PASS local recovery choice, keyboard access, bilingual labels, reload without overwrite, failed-save retention and successful local retry');
    console.log('Artifacts: ' + artifacts);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
