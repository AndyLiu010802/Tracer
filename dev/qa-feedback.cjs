'use strict';
// Real server and renderer with synthetic data in an isolated source runtime.
// Never loads the developer's configuration, workspace, credentials, or services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');
const F = require('../skins/tracer/focus-model');

async function main() {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache', 'feedback-'));
  const runtime = path.join(artifacts, 'source'), data = path.join(artifacts, 'data'), music = path.join(artifacts, 'music');
  for (const dir of [runtime, data, music]) fs.mkdirSync(dir);
  for (const name of ['server.js', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(runtime, name));
  fs.cpSync(path.join(root, 'lib'), path.join(runtime, 'lib'), { recursive: true });
  for (const name of ['skins', 'public', 'ai-service']) fs.symlinkSync(path.join(root, name), path.join(runtime, name), 'junction');
  fs.writeFileSync(path.join(runtime, 'local.config.json'), JSON.stringify({ skin: 'tracer', host: '127.0.0.1', autoHide: 'off' }));
  Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(artifacts, 'state.json'), DOCS_PORTAL_MUSIC_DIR: music });

  const ws = M.emptyWorkspace();
  const project = M.addProject(ws, { name: 'PRIVATE_PROJECT_qa' });
  const task = M.addTask(ws, { title: 'PRIVATE_TASK_qa', notes: 'PRIVATE_TASK_NOTES_qa', projectId: project.id, assignee: 'private-person@example.invalid', status: 'doing' });
  M.addTask(ws, { title: 'PRIVATE_OTHER_TASK_qa', status: 'todo' });
  M.addNote(ws, { title: 'PRIVATE_NOTE_qa', body: 'PRIVATE_NOTE_BODY_qa' });
  const workspaceFile = path.join(data, 'workspace.json');
  fs.writeFileSync(workspaceFile, JSON.stringify(ws));
  const originalWorkspace = fs.readFileSync(workspaceFile, 'utf8');
  const focus = F.fresh();
  focus.task = { id: task.id, title: task.title, projectId: project.id };
  focus.history = [{ id: 'PRIVATE_SESSION_ID_qa', endedAt: Date.now() - 1000, minutes: 25, task: focus.task }];
  focus.roundsDone = 1; focus.totalMinutes = 25;
  const privateValues = [project.name, project.id, task.id, task.title, task.notes, task.assignee, 'PRIVATE_OTHER_TASK_qa', 'PRIVATE_NOTE_qa', 'PRIVATE_NOTE_BODY_qa', 'PRIVATE_SESSION_ID_qa', 'PRIVATE_API_KEY_qa', 'PRIVATE_RAW_ERROR_qa', 'private-person@example.invalid'];
  const { server } = require(path.join(runtime, 'server.js'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const results = [], findings = [], errors = [], external = [], writes = [], requests = [];
  let browser, context, page;
  const check = (condition, label) => { assert.ok(condition, label); results.push(label); };
  const preview = () => page.locator('#feedback-preview').inputValue();
  const report = async () => JSON.parse(await preview());
  async function capture(name) { await page.screenshot({ path: path.join(artifacts, name + '.png'), animations: 'disabled' }); }
  async function open() { await page.locator('#feedback-open').click(); await page.locator('#feedback-dialog').waitFor(); }
  async function reachable(selector, label) {
    const node = page.locator(selector); await node.scrollIntoViewIfNeeded();
    const state = await node.evaluate(element => {
      const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { reachable: r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 && (hit === element || element.contains(hit)), bounds: { x: r.x, y: r.y, width: r.width, height: r.height }, hit: hit?.id || hit?.className };
    });
    if (!state.reachable) findings.push({ label, selector, ...state }); else results.push(label);
  }
  async function english(label) {
    const unexpected = await page.locator('#feedback-dialog').evaluate(root => {
      const found = [], visible = element => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[hidden],script,style,option');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, value = node.textContent.trim();
        if (/[\u3400-\u9fff]/.test(value) && visible(node.parentElement)) found.push(value.slice(0, 250));
      }
      root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(element => {
        if (!visible(element)) return;
        for (const attribute of ['title', 'aria-label', 'placeholder']) if (/[\u3400-\u9fff]/.test(element.getAttribute(attribute) || '')) found.push(element.getAttribute(attribute));
      });
      return found;
    });
    if (unexpected.length) findings.push({ label, unexpected }); else results.push(label);
  }
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, locale: 'en-US', serviceWorkers: 'block', acceptDownloads: true });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) { external.push(url.origin + url.pathname); return route.abort(); }
      requests.push({ path: url.pathname, method: request.method(), body: request.postData() });
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false, imageGeneration: false } });
      if (request.method() !== 'GET' && request.method() !== 'HEAD') writes.push({ path: url.pathname, method: request.method() });
      return route.continue();
    });
    await context.addInitScript(value => {
      if (!localStorage.getItem('qa-feedback-seeded')) {
        localStorage.setItem('tracer.language', 'en');
        localStorage.setItem('tracer.focus.v1', JSON.stringify(value));
        localStorage.setItem('tracer.qa-private-api-key', 'PRIVATE_API_KEY_qa');
        localStorage.setItem('qa-feedback-seeded', '1');
      }
      window.__qaCopied = []; window.__qaClipboardReject = false;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => {
          if (window.__qaClipboardReject) throw new DOMException('Synthetic clipboard rejection', 'NotAllowedError');
          window.__qaCopied.push(text);
        }
      } });
      const exec = document.execCommand.bind(document);
      document.execCommand = function(command, ...args) { return window.__qaClipboardReject && command === 'copy' ? false : exec(command, ...args); };
    }, focus);
    page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/?sec=board&phase=day', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Tracer?.store.data && !Tracer.store.lost && !Tracer.store.dirty && !Tracer.store.inflight);
    const timerBefore = await page.evaluate(() => localStorage.getItem('tracer.focus.v1'));
    const workspaceBefore = await page.evaluate(() => JSON.stringify(Tracer.store.data));
    await reachable('#feedback-open', 'the feedback entry is accessible without account sign-in');
    await open();
    check(await page.locator('#feedback-dialog').evaluate(dialog => dialog.open && dialog.matches(':modal')), 'feedback opens a native modal dialog');
    check(await page.locator('#feedback-preview').evaluate(element => element.readOnly), 'the complete report preview is read-only');
    check(!await page.locator('#feedback-diagnostics').isChecked(), 'diagnostics are off on first open');
    check(await preview() === '', 'the preview is empty until the user describes feedback');
    await english('all visible feedback copy and accessible labels are English');
    check(await page.locator('#feedback-copy').isDisabled(), 'copy is disabled until a description is provided');
    check(await page.evaluate(() => window.__qaCopied.length === 0), 'empty descriptions cannot be copied as a report');
    check(await page.locator('#feedback-description').evaluate(element => !element.validity.valid), 'description is a required input');
    check(await page.locator('#feedback-download').isDisabled(), 'empty descriptions cannot be downloaded');
    const description = '<script>window.__qaFeedbackExecuted = true</script>\nFeedback sample <b>must stay text</b> & "quotes".';
    await page.locator('#feedback-description').fill(description);
    await page.locator('#feedback-details > summary').click();
    await page.locator('#feedback-steps').fill('1. Open a project\n2. Select the action');
    await page.locator('#feedback-expected').fill('The action should finish without losing the current input.');
    await page.locator('#feedback-type').selectOption('idea');
    const withoutDiagnostics = await report();
    check(!Object.prototype.hasOwnProperty.call(withoutDiagnostics, 'diagnostics'), 'describing feedback does not silently opt into diagnostics');
    check(withoutDiagnostics.format === 'tracer-feedback' && withoutDiagnostics.type === 'idea' && withoutDiagnostics.description === description && !!withoutDiagnostics.id && Number.isFinite(Date.parse(withoutDiagnostics.createdAt)), 'the report records the chosen type and unchanged feedback with a valid identifier and time');
    check((await preview()).includes('must stay text') && !await page.evaluate(() => window.__qaFeedbackExecuted), 'HTML and script syntax remains literal text and does not execute');
    const firstPreview = await preview();
    await page.locator('#feedback-copy').click();
    check(await page.evaluate(() => window.__qaCopied.at(-1)) === firstPreview, 'clipboard receives exactly the currently visible report');
    check((await page.locator('#feedback-status').innerText()).length > 5, 'copy gives an accessible status message');
    await page.locator('#feedback-diagnostics').check();
    const withDiagnostics = await report();
    check(withDiagnostics.diagnostics && typeof withDiagnostics.diagnostics === 'object', 'diagnostics are included only after explicit opt-in');
    const diagnosticText = JSON.stringify(withDiagnostics.diagnostics);
    check(withDiagnostics.diagnostics.workspace.taskCount === 2 && withDiagnostics.diagnostics.workspace.projectCount === 1 && withDiagnostics.diagnostics.workspace.noteCount === 1, 'workspace diagnostics contain aggregate counts rather than record content');
    check(withDiagnostics.diagnostics.focus.historyCount === 1 && withDiagnostics.diagnostics.focus.running === false && withDiagnostics.diagnostics.focus.available === true, 'focus diagnostics describe the available paused timer without session content');
    check(Object.keys(withDiagnostics.diagnostics).sort().join(',') === 'account,app,focus,workspace', 'diagnostics contain only the four approved metadata groups');
    check(privateValues.every(value => !diagnosticText.includes(value)), 'diagnostics omit private titles, notes, emails, record IDs, and unrelated storage secrets');
    check(!/userAgent|stack|rawError|apiKey|accessToken|refreshToken|password|[a-z]:\\/i.test(diagnosticText), 'diagnostics omit raw browser details, paths, stack traces, and credential fields');
    const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    check(diagnosticText.includes(version), 'optional diagnostics contain the actual application version');
    const identityBefore = { ...withoutDiagnostics }, identityAfter = { ...withDiagnostics };
    delete identityAfter.diagnostics;
    check(JSON.stringify(identityBefore) === JSON.stringify(identityAfter), 'opting into diagnostics preserves report content, identifier, and timestamp');
    const downloadPreview = await preview();
    const downloaded = page.waitForEvent('download'); await page.locator('#feedback-download').click();
    const download = await downloaded;
    const reportFile = path.join(artifacts, 'feedback-report.json'); await download.saveAs(reportFile);
    check(fs.readFileSync(reportFile, 'utf8') === downloadPreview, 'downloaded UTF-8 report exactly matches the full preview');
    check(/\.json$/i.test(download.suggestedFilename()), 'report download has a JSON filename');
    await page.evaluate(() => { window.__qaClipboardReject = true; });
    await page.locator('#feedback-copy').click();
    check(await page.locator('#feedback-preview').evaluate(element => document.activeElement === element && element.selectionStart === 0 && element.selectionEnd === element.value.length), 'clipboard denial selects the entire report for manual copying');
    check(await preview() === downloadPreview && (await page.locator('#feedback-status').innerText()).length > 5, 'clipboard denial preserves the draft and explains manual copying');
    await page.evaluate(() => { window.__qaClipboardReject = false; });
    const copiedBeforeSwitch = await page.evaluate(() => window.__qaCopied.length);
    await page.evaluate(() => {
      window.__qaSwitchingDescriptor = Object.getOwnPropertyDescriptor(TracerAccount, 'switching');
      Object.defineProperty(TracerAccount, 'switching', { configurable: true, value: true });
      document.querySelector('#feedback-copy').click();
    });
    await page.waitForFunction(() => document.querySelector('#feedback-diagnostics').disabled && !document.querySelector('#feedback-diagnostics').checked && !JSON.parse(document.querySelector('#feedback-preview').value).diagnostics);
    check((await page.evaluate(index => window.__qaCopied.slice(index), copiedBeforeSwitch)).every(value => !JSON.parse(value).diagnostics), 'copy immediately after an account switch cannot export a stale diagnostic snapshot');
    check(!(await report()).diagnostics && await page.locator('#feedback-description').inputValue() === description, 'account switching removes diagnostics while retaining the manually entered feedback');
    await page.evaluate(() => {
      Object.defineProperty(TracerAccount, 'switching', window.__qaSwitchingDescriptor);
      delete window.__qaSwitchingDescriptor;
    });
    await page.locator('#feedback-close').click(); await open();
    check(await page.locator('#feedback-description').inputValue() === '' && await page.locator('#feedback-steps').inputValue() === '' && await page.locator('#feedback-expected').inputValue() === '', 'closing and reopening clears all feedback text');
    check(!await page.locator('#feedback-diagnostics').isChecked() && await preview() === '', 'closing and reopening resets diagnostics consent and preview');
    check(await page.evaluate(value => !Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i))).some(item => item && item.includes(value)), 'must stay text'), 'feedback drafts are not written into local storage');
    await page.locator('#feedback-close').click();

    for (const language of ['en', 'zh']) {
      await page.selectOption('#language-select', language);
      for (const width of [1200, 390, 320]) {
        const label = language + '-' + width; await page.setViewportSize({ width, height: 1000 });
        await reachable('#feedback-open', label + ' feedback entry fits the top bar');
        await open();
        await page.locator('#feedback-description').fill(language === 'en' ? 'The task editor becomes hard to find after switching projects.' : '切换项目以后，任务编辑入口难以找到。');
        await page.locator('#feedback-diagnostics').check();
        check(await page.locator('#feedback-dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1), label + ' feedback dialog has no horizontal overflow');
        for (const selector of ['#feedback-description', '#feedback-diagnostics', '#feedback-preview', '#feedback-copy', '#feedback-download', '#feedback-close']) await reachable(selector, label + ' ' + selector + ' is reachable');
        await page.locator('#feedback-description').scrollIntoViewIfNeeded(); await capture('feedback-' + label);
        if (language === 'en') await english(label + ' feedback remains English');
        await page.locator('#feedback-close').click();
      }
    }
    await page.setViewportSize({ width: 1200, height: 1000 });
    await page.selectOption('#language-select', 'en');
    await page.evaluate(() => {
      window.__qaLockedDescriptor = Object.getOwnPropertyDescriptor(TracerAccount, 'locked');
      Object.defineProperty(TracerAccount, 'locked', { configurable: true, value: true });
    });
    await open();
    check(await page.locator('#feedback-diagnostics').isDisabled(), 'a stale or locked account cannot add diagnostics from its old workspace');
    await page.locator('#feedback-description').fill('The account changed while this window was open.');
    await page.locator('#feedback-copy').click();
    const lockedReport = JSON.parse(await page.evaluate(() => window.__qaCopied.at(-1)));
    check(!Object.prototype.hasOwnProperty.call(lockedReport, 'diagnostics'), 'manual feedback remains usable without exposing locked workspace diagnostics');
    await page.locator('#feedback-close').click();
    await page.evaluate(() => { Object.defineProperty(TracerAccount, 'locked', window.__qaLockedDescriptor); delete window.__qaLockedDescriptor; });
    check(await page.evaluate(() => localStorage.getItem('tracer.focus.v1')) === timerBefore, 'feedback interactions preserve focus state byte for byte');
    check(await page.evaluate(() => JSON.stringify(Tracer.store.data)) === workspaceBefore && fs.readFileSync(workspaceFile, 'utf8') === originalWorkspace, 'feedback interactions preserve both in-memory and stored workspace');
    check(writes.length === 0 && !requests.some(request => /feedback|diagnostic/i.test(request.path) && request.path.startsWith('/api/')), 'feedback uses no submission or diagnostic endpoint and sends no write requests');
    check(!requests.some(request => request.body?.includes('must stay text')), 'the report text is never transmitted in a request');
    check(errors.length === 0 && external.length === 0, 'feedback flow has no renderer errors or external requests');
    const summary = { results, findings, errors, external, writes, artifacts };
    fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
    assert.equal(findings.length, 0, 'all layout and translation findings must be resolved');
  } catch (error) {
    if (page && !page.isClosed()) await capture('failure').catch(() => {});
    const summary = { results, findings, errors, external, writes, artifacts, error: error.message };
    fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2)); console.error(JSON.stringify(summary, null, 2)); throw error;
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
