'use strict';
// Real server + renderer with synthetic data only. A clean runtime copy avoids
// loading local.config.json or any existing data, accounts, AI keys or bookmarks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');
const F = require('../skins/tracer/focus-model');
const G = require('../public/task-garden');
const clone = value => JSON.parse(JSON.stringify(value));

function findWorkspace(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value.tasks) && Array.isArray(value.projects) && value.meta) return value;
  for (const child of Object.values(value)) { const result = findWorkspace(child); if (result) return result; }
  return null;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache', 'workspace-backup-'));
  const runtime = path.join(artifacts, 'source'), data = path.join(artifacts, 'data'), music = path.join(artifacts, 'music');
  for (const dir of [runtime, data, music]) fs.mkdirSync(dir);
  fs.copyFileSync(path.join(root, 'server.js'), path.join(runtime, 'server.js'));
  fs.copyFileSync(path.join(root, 'package.json'), path.join(runtime, 'package.json'));
  fs.cpSync(path.join(root, 'lib'), path.join(runtime, 'lib'), { recursive: true });
  for (const name of ['skins', 'public', 'ai-service']) fs.symlinkSync(path.join(root, name), path.join(runtime, name), 'junction');
  fs.writeFileSync(path.join(runtime, 'local.config.json'), JSON.stringify({ skin: 'tracer', host: '127.0.0.1', autoHide: 'off' }));
  Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(artifacts, 'state.json'), DOCS_PORTAL_MUSIC_DIR: music });

  const initial = M.emptyWorkspace(), project = M.addProject(initial, { name: 'Synthetic backup project' });
  const primary = M.addTask(initial, { title: 'Original task before backup', status: 'doing', projectId: project.id });
  const finished = M.addTask(initial, { title: 'Previously completed work', status: 'doing', projectId: project.id });
  M.updateTask(initial, finished.id, { status: 'done' }); G.harvest(initial, finished.id);
  M.addNote(initial, { title: 'Backup note', body: 'This note should return intact.', projectId: project.id });
  M.addInbox(initial, 'A saved idea');
  fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify(initial));
  fs.mkdirSync(path.join(data, '.ai'), { recursive: true });
  const secret = 'qa-private-credential-marker';
  fs.writeFileSync(path.join(data, '.ai', 'personal.json'), JSON.stringify({ apiKey: secret, provider: 'synthetic' }));
  fs.writeFileSync(path.join(data, 'license-cache.json'), JSON.stringify({ token: secret + '-license' }));

  const firstFocus = F.fresh(); firstFocus.settings.focus = 17;
  firstFocus.duration = 17 * 60000; firstFocus.remaining = 10 * 60000;
  firstFocus.task = { id: primary.id, title: primary.title, projectId: project.id };
  firstFocus.history = [{ id: 'qa-focus-history', endedAt: Date.now() - 3600000, minutes: 25, task: { id: finished.id, title: finished.title, projectId: project.id } }];
  firstFocus.totalMinutes = 25; firstFocus.roundsDone = 1; F.start(firstFocus, Date.now(), 'qa-running-export');

  const { server } = require(path.join(runtime, 'server.js'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const results = [], errors = [], external = [], apiFailures = [];
  let browser, context, page, oldTab, failRestore = false, restoreRequests = 0;
  const check = (condition, label) => { assert.ok(condition, label); results.push(label); };
  const ready = target => (target || page).waitForFunction(() => window.Tracer?.store.data && !Tracer.store.lost);
  const saved = target => (target || page).waitForFunction(() => !Tracer.store.dirty && !Tracer.store.inflight && !Tracer.store.conflict);
  async function openBackup() {
    if (await page.locator('#backup-dialog').isVisible()) return;
    if (!await page.locator('#account-dialog').isVisible()) await page.locator('#account-open').click();
    if (!await page.locator('#account-backup').isVisible() && await page.locator('#account-tab-data').isVisible()) await page.locator('#account-tab-data').click();
    await page.locator('#account-backup').click(); await page.locator('#backup-dialog').waitFor();
  }
  async function download(button, filename) {
    const pending = page.waitForEvent('download'); await page.locator(button).click();
    const transfer = await pending, file = path.join(artifacts, filename); await transfer.saveAs(file);
    return { file, backup: JSON.parse(await fsp.readFile(file, 'utf8')) };
  }
  async function importPreview(backup) {
    await openBackup();
    const inspected = page.waitForResponse(response => new URL(response.url()).pathname === '/api/account/backup-inspect');
    await page.locator('#backup-file').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await inspected;
    await page.locator('#backup-preview').waitFor({ state: 'visible' });
  }
  async function restore(backup) {
    await importPreview(backup); await page.locator('#backup-confirm').check();
    await Promise.all([page.waitForEvent('load'), page.locator('#backup-restore').click()]);
    await ready(); await saved();
  }
  async function diskWorkspace() { return JSON.parse(await fsp.readFile(path.join(data, 'workspace.json'), 'utf8')); }
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.origin + url.pathname); return route.abort(); }
      if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false, imageGeneration: false } });
      if (url.pathname === '/api/account/backup-restore') {
        restoreRequests++;
        if (failRestore) return route.fulfill({ status: 503, json: { error: 'backup-storage-unavailable' } });
      }
      return route.continue();
    });
    await context.addInitScript(({ focus, secret }) => {
      if (localStorage.getItem('qa-backup-seeded')) return;
      localStorage.setItem('tracer.language', 'en');
      localStorage.setItem('tracer.focus.v1', JSON.stringify(focus));
      localStorage.setItem('tracer.ai.secret', secret);
      localStorage.setItem('tracer.license.v1', JSON.stringify({ token: secret + '-license' }));
      localStorage.setItem('qa-backup-seeded', '1');
    }, { focus: firstFocus, secret });
    page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    page.on('response', async response => {
      const pathname = new URL(response.url()).pathname;
      if (pathname.startsWith('/api/account/backup-') && response.status() >= 400) {
        try { apiFailures.push({ path: pathname, status: response.status(), error: (await response.json()).error }); } catch (_) {}
      }
    });
    await page.goto(origin + '/?sec=board&phase=day', { waitUntil: 'domcontentloaded' }); await ready(); await saved();
    check(await page.evaluate(() => typeof window.TracerBackupPreferences?.clean === 'function'), 'the real server serves the shared backup preference module');
    check(await page.evaluate(() => TracerAccount.scope) === 'guest', 'backup is available to a guest workspace');
    await openBackup();
    const original = await download('#backup-export', 'original-backup.json');
    const originalWorkspace = findWorkspace(original.backup);
    check(!!originalWorkspace && originalWorkspace.tasks.length === 2 && originalWorkspace.notes.length === 1, 'signed export contains tasks, project and notes');
    check(JSON.stringify(original.backup).includes('qa-focus-history'), 'export includes focus history');
    check(!JSON.stringify(original.backup).includes(secret), 'AI credentials and license caches are excluded from backup');
    check(originalWorkspace.taskGarden.seeds.length === 2 && !!originalWorkspace.taskGarden.seeds.find(seed => seed.taskId === finished.id).harvestedAt, 'garden and existing harvests are included as one snapshot');
    await page.locator('#backup-close').click();

    await page.evaluate(id => {
      TracerModel.updateTask(Tracer.store.data, id, { title: 'Changed after backup' });
      const extra = TracerModel.addTask(Tracer.store.data, { title: 'New work after backup', status: 'doing' });
      TracerModel.updateTask(Tracer.store.data, extra.id, { status: 'done' }); TaskGarden.harvest(Tracer.store.data, extra.id);
      Tracer.touch(); clearTimeout(Tracer.store.timer); Tracer.saveNow();
      const focus = Tracer.focus.read(); focus.settings.focus = 9;
      focus.history.push({ id: 'qa-later-focus-history', endedAt: Date.now() - 60000, minutes: 5, task: { id, title: 'Changed after backup', projectId: null } });
      focus.totalMinutes = 30; focus.roundsDone = 2;
      localStorage.setItem('tracer.focus.v1', JSON.stringify(focus));
      dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1' }));
    }, primary.id); await saved();
    const changedWorkspace = clone(await diskWorkspace());
    const changedFocus = await page.evaluate(() => Tracer.focus.read());
    await importPreview(original.backup);
    check(await page.locator('#backup-restore').isDisabled(), 'restore stays disabled until explicit confirmation');
    check((await page.locator('#backup-preview').innerText()).length > 30, 'preview explains counts and restore boundaries');
    for (const language of ['en', 'zh']) {
      if (language === 'zh') {
        await page.locator('#backup-close').click(); await page.selectOption('#language-select', 'zh'); await importPreview(original.backup);
      }
      for (const width of [1200, 390, 320]) {
        await page.setViewportSize({ width, height: 950 });
        check(await page.locator('#backup-dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1), language + ' backup dialog fits ' + width + 'px');
        await page.locator('#backup-confirm').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(artifacts, 'preview-' + language + '-' + width + '.png'), animations: 'disabled' });
      }
    }
    await page.locator('#backup-close').click();
    check((await diskWorkspace()).tasks.find(task => task.id === primary.id).title === 'Changed after backup' && await page.evaluate(() => Tracer.focus.read().settings.focus) === 9, 'closing preview preserves the current workspace and focus settings');
    await page.setViewportSize({ width: 1200, height: 1000 }); await page.selectOption('#language-select', 'en');

    await importPreview(original.backup); await page.locator('#backup-confirm').check(); failRestore = true;
    const failedRestore = page.waitForResponse(response => new URL(response.url()).pathname === '/api/account/backup-restore');
    await page.locator('#backup-restore').click(); await failedRestore; await page.locator('#backup-notice').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !TracerAccount.switching);
    check((await diskWorkspace()).tasks.length === changedWorkspace.tasks.length && (await diskWorkspace()).tasks.find(task => task.id === primary.id).title === 'Changed after backup', 'failed restore request keeps the existing workspace intact');
    failRestore = false; await page.locator('#backup-close').click();

    oldTab = await context.newPage(); oldTab.setDefaultTimeout(15000); oldTab.on('pageerror', error => errors.push(error.message));
    await oldTab.goto(origin + '/?sec=board'); await ready(oldTab); await saved(oldTab);
    const priorRestoreId = await page.evaluate(() => TracerAccount.context.restoreId || '');
    await page.evaluate(() => {
      const before = structuredClone(Tracer.store.data), draft = structuredClone(before);
      draft.tasks[0].title = 'Poisoned pre-restore workspace draft';
      localStorage.setItem('tracer.workspaceDraft', JSON.stringify({ base: before, data: draft }));
      localStorage.setItem('tracer.cloudDraft', JSON.stringify({ base: before, data: draft }));
    });
    await restore(original.backup);
    const restored = await diskWorkspace();
    check(restored.tasks.length === 2 && restored.tasks.find(task => task.id === primary.id).title === 'Original task before backup', 'confirmed restore replaces the workspace and reloads the original task');
    assert.deepEqual(restored.taskGarden, originalWorkspace.taskGarden, 'the restored garden must match the signed snapshot');
    check(restored.taskGarden.seeds.length === 2, 'restoration rolls the garden back exactly instead of adding old rewards');
    const restoredFocus = await page.evaluate(() => Tracer.focus.read());
    check(!restoredFocus.running && restoredFocus.endAt === null && restoredFocus.task?.id === primary.id && restoredFocus.settings.focus === 17 && restoredFocus.history.length === 1 && restoredFocus.totalMinutes === 25, 'restored focus is paused with its task, settings and history preserved');
    check(await page.evaluate(() => !localStorage.getItem('tracer.workspaceDraft') && !localStorage.getItem('tracer.cloudDraft') && !Tracer.store.conflict), 'pre-restore workspace drafts cannot flow back into the restored data');
    check(await page.evaluate(id => TracerAccount.context.restoreId && TracerAccount.context.restoreId !== id, priorRestoreId), 'successful restore changes the account restore identity');
    check(JSON.parse(await fsp.readFile(path.join(data, '.ai', 'personal.json'), 'utf8')).apiKey === secret, 'restoring workspace data leaves existing AI configuration intact');
    await oldTab.locator('#account-session-lock').waitFor();
    const staleResult = await oldTab.evaluate(async () => {
      localStorage.setItem('tracer.language', 'zh');
      const response = await fetch('/api/store/workspace', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Tracer.store.data) });
      return response.status;
    });
    check(staleResult === 409 && (await diskWorkspace()).tasks.find(task => task.id === primary.id).title === 'Original task before backup', 'an old tab is locked and cannot overwrite restored data');
    await oldTab.close(); oldTab = null;
    const invalidWrites = await page.evaluate(async () => {
      const statuses = [];
      for (const value of [null, []]) {
        const response = await fetch('/api/store/workspace', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
        statuses.push(response.status);
      }
      return statuses;
    });
    check(invalidWrites.every(status => status === 400) && (await diskWorkspace()).meta.backupRestore.id === restored.meta.backupRestore.id, 'null and array workspace writes are rejected without erasing the restore identity');

    await openBackup(); await page.locator('#backup-snapshots').click();
    const snapshotButton = page.locator('button[id^="backup-snapshot-"]').first(); await snapshotButton.waitFor();
    const snapshotId = await snapshotButton.getAttribute('id');
    const beforeRestore = await download('#' + snapshotId, 'before-restore-backup.json');
    check(findWorkspace(beforeRestore.backup).tasks.some(task => task.title === 'Changed after backup'), 'automatic before-restore snapshot is available to download');
    await page.locator('#backup-close').click(); await restore(beforeRestore.backup);
    check((await diskWorkspace()).tasks.length === changedWorkspace.tasks.length && (await diskWorkspace()).tasks.some(task => task.title === 'Changed after backup'), 'the automatic snapshot can undo the restore');
    check(await page.evaluate(() => !Tracer.focus.read().running && Tracer.focus.read().settings.focus === 9 && Tracer.focus.read().history.length === 2), 'automatic snapshot restores the intervening focus history and settings without starting a timer');

    const tampered = clone(original.backup); findWorkspace(tampered).tasks[0].title = 'Tampered task';
    const beforeTamper = JSON.stringify(await diskWorkspace()), callsBeforeTamper = restoreRequests;
    await openBackup();
    const tamperInspection = page.waitForResponse(response => new URL(response.url()).pathname === '/api/account/backup-inspect');
    await page.locator('#backup-file').setInputFiles({ name: 'tampered-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tampered)) });
    await tamperInspection;
    await page.locator('#backup-notice').waitFor({ state: 'visible' });
    check(!await page.locator('#backup-restore').isVisible() || await page.locator('#backup-restore').isDisabled(), 'a modified signed backup cannot enable restore');
    check(JSON.stringify(await diskWorkspace()) === beforeTamper && restoreRequests === callsBeforeTamper, 'rejected modified file does not write or send a restore request');
    await page.locator('#backup-close').click();

    const registration = await page.evaluate(async () => TracerAccount.api('register', { email: 'backup-isolation@example.com', password: 'Synthetic backup password 123', profile: { nickname: 'Backup QA account' } }));
    assert.equal(typeof registration.recoveryCode, 'string', 'the synthetic account must have a real recovery code to check exclusion');
    await page.reload(); await ready(); await saved();
    check(await page.evaluate(() => TracerAccount.scope) !== 'guest', 'cross-account check uses a distinct local account');
    await openBackup();
    const scopeInspection = page.waitForResponse(response => new URL(response.url()).pathname === '/api/account/backup-inspect');
    await page.locator('#backup-file').setInputFiles({ name: 'guest-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original.backup)) });
    await scopeInspection;
    await page.locator('#backup-notice').waitFor({ state: 'visible' });
    check(!await page.locator('#backup-restore').isVisible() || await page.locator('#backup-restore').isDisabled(), 'a guest backup cannot be restored into another account');
    check(await page.evaluate(() => Tracer.store.data.tasks.length) === 0, 'cross-account rejection preserves the target workspace');
    const accountBackup = await download('#backup-export', 'account-backup.json');
    check(!JSON.stringify(accountBackup.backup).includes(registration.recoveryCode) && !JSON.stringify(accountBackup.backup).includes('Synthetic backup password 123'), 'account backup excludes the password and recovery code');
    check(!JSON.stringify(accountBackup.backup).includes(secret), 'account backup does not include guest credentials');
    check(errors.length === 0, 'backup flows finish without browser runtime errors');
    check(external.length === 0, 'all QA requests stay on the isolated local server');
    const summary = { results, artifacts, restoreRequests };
    fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    console.error(JSON.stringify({ completed: results, browserErrors: errors, apiFailures, artifacts }, null, 2)); throw error;
  } finally {
    await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
