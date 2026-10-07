'use strict';
// Real renderer/server on a clean runtime and synthetic workspace. No developer
// configuration, user data, credentials, or network services are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');

async function main() {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache', 'commercial-english-'));
  const runtime = path.join(artifacts, 'source'), data = path.join(artifacts, 'data'), music = path.join(artifacts, 'music');
  for (const dir of [runtime, data, music]) fs.mkdirSync(dir);
  for (const name of ['server.js', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(runtime, name));
  fs.cpSync(path.join(root, 'lib'), path.join(runtime, 'lib'), { recursive: true });
  for (const name of ['skins', 'public', 'ai-service']) fs.symlinkSync(path.join(root, name), path.join(runtime, name), 'junction');
  fs.writeFileSync(path.join(runtime, 'local.config.json'), JSON.stringify({ skin: 'tracer', host: '127.0.0.1', autoHide: 'off' }));
  Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(artifacts, 'state.json'), DOCS_PORTAL_MUSIC_DIR: music });
  fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify(M.emptyWorkspace()));
  const { server } = require(path.join(runtime, 'server.js'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const results = [], findings = [], errors = [], external = [];
  let browser, context, page;
  const check = (condition, label) => { assert.ok(condition, label); results.push(label); };
  const ready = () => page.waitForFunction(() => window.Tracer?.gettingStarted && Tracer.store.data && !Tracer.store.lost);
  const saved = () => page.waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight && !Tracer.store.conflict);
  async function capture(name) { await page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'disabled' }); }
  async function english(label, selector = 'body') {
    const unexpected = await page.locator(selector).evaluate(root => {
      const found = [], visible = element => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[hidden],script,style,option,#language-select');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, value = node.textContent.trim();
        if (/[\u3400-\u9fff]/.test(value) && visible(node.parentElement)) found.push({ selector: node.parentElement.id || node.parentElement.className || node.parentElement.tagName, value: value.slice(0, 300) });
      }
      root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(element => {
        if (!visible(element)) return;
        for (const attribute of ['title', 'aria-label', 'placeholder']) { const value = element.getAttribute(attribute); if (/[\u3400-\u9fff]/.test(value || '')) found.push({ selector: element.id || element.className, attribute, value }); }
      });
      return found;
    });
    if (unexpected.length) { findings.push({ label, unexpected }); await capture('english-' + label.replace(/[^a-z0-9]+/gi, '-')); }
    else results.push(label + ': visible copy and accessible labels are English');
  }
  async function reachable(selector, label) {
    const node = page.locator(selector); await node.scrollIntoViewIfNeeded();
    const state = await node.evaluate(element => {
      const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { reachable: r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 && (hit === element || element.contains(hit)), bounds: { x: r.x, y: r.y, width: r.width, height: r.height }, hit: hit?.id || hit?.className };
    });
    if (!state.reachable) findings.push({ label, selector, ...state }); else results.push(label);
  }
  async function readablePrimary(selector, label) {
    await page.locator(selector).hover();
    const contrast = await page.locator(selector).evaluate(element => {
      const style = getComputedStyle(element);
      const luminance = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
      const foreground = luminance(style.color), background = luminance(style.backgroundColor);
      return { foreground: style.color, background: style.backgroundColor, ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
    });
    if (contrast.ratio < 4.5) { findings.push({ label, selector, contrast }); await capture('primary-hover-contrast'); } else results.push(label);
  }
  async function openBackup() {
    await page.locator('#account-open').click();
    if (!await page.locator('#account-backup').isVisible() && await page.locator('#account-tab-data').isVisible()) await page.locator('#account-tab-data').click();
    await page.locator('#account-backup').click(); await page.locator('#backup-dialog').waitFor();
  }
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, locale: 'en-US', serviceWorkers: 'block', acceptDownloads: true });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false, imageGeneration: false } });
      return route.continue();
    });
    page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/?sec=board&phase=day', { waitUntil: 'domcontentloaded' }); await ready(); await saved();
    check(await page.locator('html').getAttribute('lang') === 'en', 'a new installation defaults to English');
    await english('fresh-board'); await capture('fresh-board');
    await page.locator('#getting-started-title').fill('Draft an overseas launch brief');
    for (const phase of ['dawn', 'day', 'dusk', 'night']) {
      await page.evaluate(value => document.documentElement.setAttribute('data-phase', value), phase);
      await readablePrimary('#getting-started-create', phase + ' primary action text stays readable while hovered');
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-phase', 'day'));
    await capture('primary-hover-day');
    await page.locator('#getting-started-title').press('Enter'); await saved();
    await page.locator('#getting-started-focus').waitFor();
    const firstTaskId = await page.evaluate(() => Tracer.store.data.tasks[0].id);
    check(await page.evaluate(() => Tracer.store.data.tasks.length === 1), 'Enter creates one real first task');
    await page.locator('#getting-started-focus').click(); await english('first-focus');
    await reachable('#focus-start', 'focus start is reachable');
    await page.locator('#focus-start').focus(); await page.locator('#focus-start').press('Enter');
    await page.waitForFunction(() => Tracer.focus.read().running); await page.locator('#focus-close').click();
    await page.locator('#getting-started-complete').click(); await saved();
    await page.waitForFunction(() => !Tracer.focus.read().running && !Tracer.focus.read().task);
    check(await page.evaluate(() => Tracer.focus.read().remaining === Tracer.focus.read().duration), 'accepted task completion clears and resets the running timer');
    await page.locator('#getting-started-garden').click(); await page.locator('#garden-home-root .garden-home').waitFor();
    await english('first-harvest'); await capture('first-harvest');
    await page.locator('.garden-task-plant-card[data-task-id="' + firstTaskId + '"] [data-plant-action="harvest"]').click(); await saved();
    await page.waitForFunction(() => Tracer.currentSec() === 'board' && document.activeElement?.id === 'getting-started-title');
    check(await page.locator('#getting-started-title').inputValue() === '', 'first harvest opens an empty focused next-task field');
    await page.locator('#getting-started-title').fill('Prepare the next customer conversation'); await page.locator('#getting-started-title').press('Enter'); await page.waitForFunction(() => Tracer.store.data.tasks.length === 2); await saved();
    check(await page.evaluate(() => Tracer.store.data.tasks.length === 2), 'a second task can start immediately after harvest');
    await page.locator('#getting-started-dismiss').click();

    await page.locator('#proj-add').click(); await english('new-project');
    await page.locator('#p-name').fill('Overseas launch'); await page.locator('#p-name').press('Enter'); await saved();
    const projectId = await page.evaluate(() => Tracer.store.data.projects[0].id);
    check(await page.evaluate(() => Tracer.store.data.projects.length === 1), 'Enter creates one project');
    await page.locator('.proj-item[data-id="' + projectId + '"]').click();
    await page.locator('.col-add[data-col="todo"]').click(); await english('new-task');
    await page.locator('#f-save').click();
    check(await page.locator('#f-title').evaluate(element => !element.validity.valid && /title/i.test(element.validationMessage)), 'empty task title has an English validation message');
    await page.locator('#f-title').fill('Write the launch page');
    await page.locator('#f-scheduled').fill('2026-10-02'); await page.locator('#f-due').fill('2026-10-01'); await page.locator('#f-save').click();
    await page.locator('#task-error').waitFor(); await english('task-date-error', '.task-editor');
    check(/date|due|scheduled/i.test(await page.locator('#task-error').innerText()), 'invalid dates show an understandable English error');
    await page.locator('#f-due').fill('2026-10-05'); await page.locator('#f-estimate').fill('2'); await page.locator('#f-spent').fill('0');
    await page.locator('#check-new').fill('Read the brief'); await page.locator('#check-new').press('Enter');
    check(await page.locator('[data-check-text]').count() === 1 && await page.locator('#f-save').isVisible(), 'Enter adds a checklist step without submitting the task');
    await page.locator('#f-title').press('Control+Enter'); await page.locator('#f-title').waitFor({ state: 'hidden' }); await saved();
    const editedTaskId = await page.evaluate(id => Tracer.store.data.tasks.find(task => task.projectId === id).id, projectId);
    await page.locator('.card[data-id="' + editedTaskId + '"]').focus(); await page.locator('.card[data-id="' + editedTaskId + '"]').press('Enter');
    await page.locator('#f-title').fill('Write and review the launch page'); await page.locator('#f-title').press('Control+Enter'); await saved();
    check(await page.evaluate(id => Tracer.store.data.tasks.find(task => task.id === id).title === 'Write and review the launch page', editedTaskId), 'keyboard opens, edits and saves an existing task');
    await page.locator('#board-project-review').click(); await page.locator('#project-review').waitFor(); await english('project-review');
    check(await page.locator('#ins-project').inputValue() === projectId, 'project review entry selects the current project');
    await openBackup(); await english('backup');
    const downloadEvent = page.waitForEvent('download'); await page.locator('#backup-export').click();
    const exported = await downloadEvent; const backupFile = path.join(artifacts, 'english-workspace-backup.json'); await exported.saveAs(backupFile);
    const exportedBackup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    check(exportedBackup.payload?.format === 'tracer-workspace-backup' && !!exportedBackup.signature, 'backup entry exports a real signed workspace file');
    await page.locator('#backup-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"invalid":true}') });
    await page.locator('#backup-notice').waitFor(); await english('backup-invalid-file', '#backup-dialog');
    check((await page.locator('#backup-notice').innerText()).length > 15, 'invalid backup explains the failure');
    await page.locator('#backup-close').click();

    for (const language of ['en', 'zh']) {
      await page.selectOption('#language-select', language);
      for (const width of [1200, 390, 320]) {
        const label = language + '-' + width; await page.setViewportSize({ width, height: 1000 });
        await page.locator('[data-sec="board"]').click(); await page.locator('.proj-item[data-id="' + projectId + '"]').click();
        await reachable('#board-project-review', label + ' project review action is reachable');
        await page.locator('#getting-started-open').click();
        // This guide remains in step two for the already created second task.
        await reachable('#getting-started-focus', label + ' guide focus action is reachable'); await capture('board-' + label);
        await page.locator('#getting-started-focus').click();
        await reachable('#focus-start', label + ' focus start fits the dialog');
        await reachable('#focus-close', label + ' focus close fits the dialog'); await capture('focus-' + label); await page.locator('#focus-close').click();
        await page.locator('#getting-started-dismiss').click();
        await page.locator('.card[data-id="' + editedTaskId + '"] .card-title').click();
        await reachable('#f-title', label + ' task title is reachable'); await reachable('#f-save', label + ' task save is reachable'); await capture('task-' + label);
        await page.locator('#f-cancel').click();
        await page.locator('#proj-add').click(); await reachable('#p-name', label + ' project name is reachable'); await reachable('#p-save', label + ' project create is reachable'); await capture('project-' + label); await page.locator('#p-cancel').click();
        await page.locator('#board-project-review').click(); await reachable('#ins-project', label + ' project review filter is reachable'); await page.locator('#project-review').scrollIntoViewIfNeeded(); await capture('review-' + label);
        await openBackup(); await reachable('#backup-export', label + ' backup export is reachable'); await reachable('#backup-close', label + ' backup close is reachable'); await capture('backup-' + label); await page.locator('#backup-close').click();
      }
    }
    check(errors.length === 0, 'no renderer exceptions during the tested flow');
    check(external.length === 0, 'the full tested flow makes no external requests');
    const summary = { results, findings, errors, external, artifacts }; fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
    assert.equal(findings.length, 0, 'visible English and viewport findings must be resolved');
  } catch (error) {
    if (page && !page.isClosed()) await capture('failure').catch(() => {});
    const summary = { results, findings, errors, external, artifacts, error: error.message }; fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2)); console.error(JSON.stringify(summary, null, 2)); throw error;
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
