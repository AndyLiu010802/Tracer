'use strict';

// Usage: node dev/qa-packaged-fishing.cjs <packaged executable>
// --source is an explicit, non-release precheck. Never reads an existing profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { createSuiteEnvironment } = require('./test-isolated.cjs');
const root = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  const F = require('../public/fishing-model');
  const M = require('../skins/tracer/model');
  const G = require('../public/task-garden');
  const workspace = M.emptyWorkspace();
  workspace.taskGarden = G.empty(); F.ensure(workspace);
  workspace.taskGarden.market.testCredit = { id: 'packaged_smoke_credit', amount: 10000, updatedAt: 1 };
  let seed;
  for (let n = 0; n < 10000; n++) if (F.createSession(null, { seed: n, baitId: 'spirit' }).fishId === 'dragonkoi') { seed = n; break; }
  assert.notEqual(seed, undefined);
  assert(F.buyBait(workspace, 'spirit', 1, 1000).ok);
  assert(F.equipBait(workspace, 'spirit', 1001).ok);
  const session = F.beginCast(workspace, { seed, now: 1002 }).session;
  F.stepSession(session, {}, 900); F.stepSession(session, { release: true }, 0);
  assert(F.commitCast(workspace, session, 1003).ok);
  for (let i = 0; i < 6000 && !['caught', 'escaped'].includes(session.phase); i++) {
    F.stepSession(session, { hook: session.phase === 'bite', holding: session.fishPosition > session.barPosition }, 16);
  }
  assert.equal(session.phase, 'caught');
  const caught = F.recordCatch(workspace, session, 20000);
  assert(caught.ok && caught.fry);
  assert(F.placeAquariumFish(workspace, caught.fry.id, true, 20001).ok);
  assert(F.equipBait(workspace, 'worm', 20002).ok);
  return { workspace, fryId: caught.fry.id, catchId: caught.catch.id };
}

async function main(args = process.argv.slice(2)) {
  if (args.length !== 1) throw new Error('Usage: node dev/qa-packaged-fishing.cjs <executable> | --source');
  const source = args[0] === '--source';
  const executable = source ? require('electron') : path.resolve(args[0]);
  assert(fs.statSync(executable).isFile(), 'executable exists');
  let playwright;
  if (process.env.TRACER_QA_PLAYWRIGHT) playwright = require(process.env.TRACER_QA_PLAYWRIGHT);
  else { try { playwright = require('playwright'); } catch { playwright = require('../.cache/desktop-qa-tools/node_modules/playwright'); } }
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const output = fs.mkdtempSync(path.join(root, '.cache/packaged-fishing-'));
  const isolated = createSuiteEnvironment(output, 'desktop');
  // Chromium's Windows initialization needs the actual OS special folders.
  // App/profile/config/music/Codex paths stay explicitly inside this fixture,
  // and inherited credentials remain removed by createSuiteEnvironment.
  for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR']) {
    if (process.env[key] === undefined) delete isolated.env[key];
    else isolated.env[key] = process.env[key];
  }
  const seeded = fixture();
  fs.writeFileSync(path.join(isolated.dirs.data, 'workspace.json'), JSON.stringify(seeded.workspace));
  fs.writeFileSync(isolated.configFile, JSON.stringify({ skin: 'tracer', host: '127.0.0.1', port: 0, autoHide: 'off', idleMinutes: 0 }));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  isolated.env.DOCS_PORTAL_PORT = String(port);
  delete isolated.env.ELECTRON_RUN_AS_NODE;
  const origin = 'http://127.0.0.1:' + port;
  const report = { ok: false, mode: source ? 'source-precheck' : 'commercial-package', output, checks: [], screenshots: [], errors: [], failedAssets: [], blockedExternalRequests: [], executableSHA256: crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex') };
  const stage = message => { console.log('[packaged fishing QA] ' + message); report.checks.push(message); };
  let app;
  try {
    stage('launch isolated app');
    app = await playwright._electron.launch({ executablePath: executable, args: source ? [root] : [], env: isolated.env, timeout: 60000 });
    app.context().setDefaultTimeout(20000);
    stage('Electron inspector and browser connected');
    app.process().stderr.on('data', bytes => fs.appendFileSync(path.join(output, 'electron.log'), bytes));
    const attach = page => {
      page.on('pageerror', error => report.errors.push({ page: new URL(page.url()).pathname, message: error.message }));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === origin && response.status() >= 400 && !url.pathname.startsWith('/api/')) report.failedAssets.push({ path: url.pathname, status: response.status() });
      });
    };
    app.context().pages().forEach(attach); app.context().on('page', attach);
    await app.context().route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      report.blockedExternalRequests.push(url.origin); return route.abort();
    });
    async function pageAt(suffix) {
      for (let i = 0; i < 150; i++) {
        const page = app.context().pages().find(value => value.url() === origin + suffix);
        if (page) return page;
        await pause(100);
      }
      throw new Error('Missing packaged page: ' + suffix);
    }
    const mainPage = await pageAt('/');
    await mainPage.waitForFunction(() => window.Tracer?.fishing && Tracer.store.base?.fishing && !Tracer.store.dirty && !Tracer.store.inflight);
    await mainPage.waitForFunction(() => document.tracerHidden === false);
    report.app = await app.evaluate(({ app, BrowserWindow, ipcMain }) => ({
      packaged: app.isPackaged, version: app.getVersion(), userData: app.getPath('userData'), appPath: app.getAppPath(),
      inputHookDisabled: process.env.TRACER_DISABLE_INPUT_HOOK === '1',
      config: process.env.DOCS_PORTAL_CONFIG_FILE, data: process.env.DOCS_PORTAL_DATA_DIR,
      experimentalIPC: ipcMain.eventNames().filter(name => /local-vfx/.test(String(name))),
      mainPreferences: (() => { const w = BrowserWindow.getAllWindows().find(w => new URL(w.webContents.getURL() || 'about:blank').pathname === '/'); const p = w.webContents.getLastWebPreferences(); return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration }; })(),
    }));
    assert.equal(report.app.packaged, !source);
    assert.equal(path.resolve(report.app.userData), path.resolve(isolated.dirs['desktop-profile']));
    assert.equal(path.resolve(report.app.config), path.resolve(isolated.configFile));
    assert.equal(path.resolve(report.app.data), path.resolve(isolated.dirs.data));
    assert(report.app.inputHookDisabled);
    assert.deepEqual(report.app.mainPreferences, { sandbox: true, contextIsolation: true, nodeIntegration: false });
    const caps = await mainPage.evaluate(() => ({ require: typeof window.require, process: typeof window.process, localVfx: typeof window.TracerLocalVfx, localScripts: [...document.scripts].filter(n => /local-vfx/.test(n.src)).length, localEntries: document.querySelectorAll('[data-local-vfx],#local-vfx-entry,#local-vfx-launcher').length }));
    assert.equal(caps.require, 'undefined'); assert.equal(caps.process, 'undefined');
    if (!source) { assert.equal(caps.localVfx, 'undefined'); assert.equal(caps.localScripts, 0); assert.equal(caps.localEntries, 0); assert.deepEqual(report.app.experimentalIPC, []); }
    report.capabilities = caps;
    stage('commercial startup, isolated data paths and sandbox permissions verified');
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => new URL(w.webContents.getURL() || 'about:blank').pathname === '/'); w.setFullScreen(false); w.setBounds({ width: 1280, height: 900 }); });
    await mainPage.locator('#language-select').selectOption('en');
    await mainPage.waitForFunction(() => Tracer.fishing.snapshot().language === 'en');
    await mainPage.evaluate(() => Tracer.show('cabin'));
    await mainPage.waitForSelector('.fishing-aquarium-scene[data-count="1"]');
    const shot = async (page, name) => { await page.screenshot({ path: path.join(output, name), omitBackground: true }); report.screenshots.push(name); };
    await shot(mainPage, '01-main-aquarium.png');
    assert.equal(await mainPage.evaluate(id => Tracer.fishing.snapshot().showcase.fish.some(f => f.id === id), seeded.fryId), true);
    await mainPage.evaluate(() => { Tracer.fishing.open(); Tracer.fishing.action('pin-aquarium'); });
    const pond = await pageAt('/fishing-desktop.html'), aquarium = await pageAt('/fishing-aquarium-desktop.html');
    await pond.waitForSelector('#fishing-rod .fishing-rod-art', { state: 'attached' });
    await aquarium.waitForSelector('.fishing-aquarium-scene[data-renderer="webgl"][data-count="1"]');
    await pond.evaluate(() => { window.qaSnapshots = []; FishingDesktop.onSnapshot(v => qaSnapshots.push(v)); FishingDesktop.send({ type: 'ready' }); });
    await aquarium.evaluate(() => { window.qaSnapshots = []; FishingAquariumDesktop.onSnapshot(v => qaSnapshots.push(v)); FishingAquariumDesktop.send({ type: 'ready' }); });
    for (const page of [pond, aquarium]) await page.waitForFunction(() => window.qaSnapshots.at(-1)?.nativeSessionId);
    for (const page of [pond, aquarium]) assert.deepEqual(await page.evaluate(() => ({ require: typeof window.require, process: typeof window.process, mainBridge: typeof window.TracerFishing, backup: typeof window.TracerBackupFiles, localVfx: typeof window.TracerLocalVfx })), { require: 'undefined', process: 'undefined', mainBridge: 'undefined', backup: 'undefined', localVfx: 'undefined' });
    await shot(pond, '02-desktop-pond.png'); await shot(aquarium, '03-desktop-aquarium.png');
    stage('packaged pond, 3D aquarium and scoped overlay bridges render');

    // The real renderer opens the real native menu; intercept only its OS popup.
    await app.evaluate(({ Menu }) => { globalThis.qaMenus = []; globalThis.qaOriginalMenu = Menu.buildFromTemplate; Menu.buildFromTemplate = function(template) { return { popup(options) { qaMenus.push({ template, url: options.window.webContents.getURL() }); options.callback?.(); } }; }; });
    async function nativeMenu(page, label) {
      const selector = page === pond ? '#fishing-pond' : '.fishing-aquarium-tank';
      await page.locator(selector).dispatchEvent('contextmenu', { bubbles: true, button: 2 });
      for (let i = 0; i < 30; i++) {
        const ready = await app.evaluate(({}, expected) => globalThis.qaMenus.at(-1)?.template.some(item => item.label === expected), label);
        if (ready) break;
        await pause(50);
      }
      return app.evaluate(({}, expected) => { const menu = qaMenus.pop(), item = menu?.template.find(item => item.label === expected); if (!item || item.enabled === false) throw new Error('Missing enabled native menu: ' + expected); item.click(); return menu.template.map(x => x.label || x.type); }, label);
    }
    report.pondMenu = await nativeMenu(pond, 'Summon fishing rod');
    await pond.waitForFunction(() => document.querySelector('#desktop-fishing').dataset.rodVisible === 'true');
    await pond.locator('#fishing-rod').focus();
    await pond.keyboard.press('f');
    assert.equal(await mainPage.evaluate(() => Tracer.fishing.snapshot().session?.phase || 'idle'), 'idle', 'summon rejects early fishing input');
    assert.equal(await pond.locator('#fishing-power').isVisible(), false, 'summon has no progress bar');
    await pause(700);
    await pond.keyboard.down('f');
    await mainPage.waitForFunction(() => Tracer.fishing.snapshot().session?.phase === 'charging');
    await pause(250); await pond.keyboard.up('f');
    await mainPage.waitForFunction(() => ['cast', 'waiting', 'bite'].includes(Tracer.fishing.snapshot().session?.phase));
    await shot(pond, '04-packaged-cast.png');
    await mainPage.evaluate(() => Tracer.fishing.cancel('packaged-smoke'));
    stage('native pond menu summons, blocks early F and accepts a real F cast');
    report.aquariumMenu = await nativeMenu(aquarium, 'Rotate right');
    await aquarium.waitForFunction(() => Number(document.querySelector('.fishing-aquarium-volume').dataset.aquariumYaw) === 15);
    await aquarium.evaluate(() => FishingAquariumDesktop.send({ type: 'resize', value: 1.25 }));
    await aquarium.waitForFunction(() => qaSnapshots.at(-1).desktopScale === 1.25);
    await shot(aquarium, '05-aquarium-rotated-resized.png');
    const settingsFile = path.join(isolated.dirs['desktop-profile'], 'fishing-aquarium-window.json');
    for (let i = 0; i < 30 && !fs.existsSync(settingsFile); i++) await pause(50);
    const settingsBefore = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    assert.equal(settingsBefore.scale, 1.25); assert.equal(settingsBefore.yaw, 15);
    const auth = await aquarium.evaluate(() => { const s = qaSnapshots.at(-1); return { accountScope: s.accountScope, accountGeneration: s.accountGeneration, accountRestoreId: s.accountRestoreId, nativeSessionId: s.nativeSessionId }; });
    report.rejectedPermissions = await app.evaluate(({ ipcMain, BrowserWindow }, auth) => {
      const tank = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/fishing-aquarium-desktop.html'));
      const main = BrowserWindow.getAllWindows().find(w => new URL(w.webContents.getURL() || 'about:blank').pathname === '/');
      const before = tank.getBounds();
      const event = w => ({ sender: w.webContents, senderFrame: w.webContents.mainFrame });
      ipcMain.emit('tracer-fishing-aquarium-command', event(tank), { ...auth, nativeSessionId: 'stale-smoke-session', type: 'resize', value: 2 });
      ipcMain.emit('tracer-fishing-aquarium-command', event(tank), { ...auth, accountScope: 'other-smoke-account', type: 'resize', value: 2 });
      ipcMain.emit('tracer-fishing-aquarium-command', event(main), { ...auth, type: 'resize', value: 2 });
      return { before, after: tank.getBounds(), staleNativeSession: true, otherAccount: true, wrongWindow: true };
    }, auth);
    assert.deepEqual(report.rejectedPermissions.after, report.rejectedPermissions.before);
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile, 'utf8')), settingsBefore);
    stage('native rotation and resize persist; stale, cross-account and wrong-window IPC cannot alter settings');
    await mainPage.reload();
    await mainPage.waitForFunction(() => window.Tracer?.fishing && Tracer.store.base?.fishing && !Tracer.store.dirty && !Tracer.store.inflight);
    assert.equal(await mainPage.locator('#language-select').inputValue(), 'en');
    assert(await mainPage.evaluate(id => Tracer.fishing.snapshot().showcase.fish.some(f => f.id === id), seeded.fryId));
    await mainPage.evaluate(() => { Tracer.fishing.open(); Tracer.fishing.action('pin-aquarium'); });
    await aquarium.waitForFunction(() => window.FishingAquariumDesktop);
    await aquarium.evaluate(() => { window.qaSnapshots = []; FishingAquariumDesktop.onSnapshot(v => qaSnapshots.push(v)); FishingAquariumDesktop.send({ type: 'ready' }); });
    await aquarium.waitForFunction(() => window.qaSnapshots?.at(-1)?.nativeSessionId && Number(document.querySelector('.fishing-aquarium-volume')?.dataset.aquariumYaw) === 15);
    assert.equal(await aquarium.evaluate(() => qaSnapshots.at(-1).desktopScale), 1.25);
    const sessionAfter = await aquarium.evaluate(() => qaSnapshots.at(-1).nativeSessionId);
    assert.notEqual(sessionAfter, auth.nativeSessionId, 'reload renews native account/session credentials');
    await mainPage.evaluate(() => Tracer.fishing.action('hide-aquarium'));
    await aquarium.waitForFunction(() => document.body.dataset.paused === 'true' && document.querySelectorAll('#aquarium-content canvas').length === 0);
    await mainPage.evaluate(() => Tracer.fishing.action('pin-aquarium'));
    await aquarium.waitForSelector('.fishing-aquarium-volume[data-aquarium-fish-count="1"]');
    stage('language, collection and aquarium settings survive reload; hide releases aquarium and show recreates it');
    assert.deepEqual(report.errors, []); assert.deepEqual(report.failedAssets, []);
    report.ok = true;
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    if (app) for (const [index, page] of app.context().pages().entries()) {
      try { await page.screenshot({ path: path.join(output, 'failure-' + index + '.png') }); } catch {}
    }
    throw error;
  } finally {
    if (app) await require('./close-qa-electron.cjs')(app);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ok: report.ok, mode: report.mode, report: path.join(output, 'report.json'), screenshots: report.screenshots }));
  }
  return report;
}

module.exports = { fixture, main };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
