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
// Background overlays intentionally pause renderer timers/RAF. Schedule state
// polling in Node, and read the same main world used by the subsequent actions.
async function waitFor(page, predicate, arg, options = {}) {
  const deadline = Date.now() + (options.timeout || 20000);
  do {
    if (await page.evaluate(predicate, arg)) return;
    await pause(100);
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for renderer state: ' + predicate.toString());
}

function recordSnapshots() {
  const subscribe = () => {
    const bridge = window.FishingDesktop || window.FishingAquariumDesktop;
    if (!bridge || Array.isArray(window.qaSnapshots)) return;
    window.qaSnapshots = []; window.qaPhases = []; window.qaSnapshotDocument = performance.timeOrigin;
    bridge.onSnapshot(value => {
      qaSnapshots.push(value); if (qaSnapshots.length > 40) qaSnapshots.shift();
      const session = value.session;
      if (session && (qaPhases.at(-1)?.phase !== session.phase || qaPhases.at(-1)?.id !== session.id)) {
        qaPhases.push({ id: session.id, phase: session.phase, reason: session.reason });
        if (qaPhases.length > 40) qaPhases.shift();
      }
    });
  };
  subscribe();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', subscribe, { once: true });
}

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
    // Keep the fixture local without Playwright Fetch interception: enabling
    // route() during an Electron target's first load can stall its requests.
    report.networkGuard = await app.evaluate(async ({ app, session, webContents }, allowedOrigin) => {
      const seen = new WeakSet(); globalThis.qaBlockedOrigins = [];
      const protect = current => {
        if (seen.has(current)) return; seen.add(current);
        current.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, done) => {
          let origin = ''; try { origin = new URL(details.url).origin; } catch {}
          const cancel = origin !== allowedOrigin;
          if (cancel) qaBlockedOrigins.push(origin);
          done({ cancel });
        });
      };
      protect(session.defaultSession);
      for (const contents of webContents.getAllWebContents()) protect(contents.session);
      app.on('web-contents-created', (_event, contents) => protect(contents.session));
      const probe = 'https://blocked.packaged-smoke.invalid';
      let denied = false;
      try { await session.defaultSession.fetch(probe + '/network-guard-check'); } catch { denied = true; }
      return { denied: denied && qaBlockedOrigins.includes(probe), probe, allowedOrigin };
    }, origin);
    assert(report.networkGuard.denied, 'native guard blocks the external probe before network access');
    async function pageAt(suffix) {
      for (let i = 0; i < 150; i++) {
        const page = app.context().pages().find(value => value.url() === origin + suffix);
        if (page) return page;
        await pause(100);
      }
      throw new Error('Missing packaged page: ' + suffix);
    }
    async function overlayReady(page, bridgeName, automaticSelector) {
      // A URL alone does not mean the synchronous WebGL startup and native
      // did-finish-load handshake have completed on a cold software GPU.
      await page.waitForLoadState('load', { timeout: 60000 });
      await waitFor(page, name => typeof window[name] === 'object', bridgeName);
      // These nodes are produced only by the production snapshot handler.
      // Verify them passively before installing a QA listener or requesting
      // replay: a replay must never hide failed automatic initialization.
      await page.waitForSelector(automaticSelector, { state: 'attached', timeout: 60000 });
      const automatic = await page.evaluate(() => ({
        readyState: document.readyState, rodAttached: !!document.querySelector('#fishing-rod .fishing-rod-art'),
        phase: document.getElementById('desktop-fishing')?.dataset.phase,
        rodVisible: document.getElementById('desktop-fishing')?.dataset.rodVisible,
        aquariumFish: document.querySelector('.fishing-aquarium-scene')?.dataset.count,
      }));
      await page.evaluate(recordSnapshots);
      await page.evaluate(name => window[name].send({ type: 'ready' }), bridgeName);
      await waitFor(page, () => !!window.qaSnapshots?.at(-1)?.nativeSessionId);
      return automatic;
    }
    const mainPage = await pageAt('/');
    await mainPage.waitForLoadState('load', { timeout: 60000 });
    await waitFor(mainPage, () => window.Tracer?.fishing && Tracer.store.base?.fishing && !Tracer.store.dirty && !Tracer.store.inflight);
    await waitFor(mainPage, () => document.tracerHidden === false);
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
    await waitFor(mainPage, () => Tracer.fishing.snapshot().language === 'en');
    await mainPage.evaluate(() => Tracer.show('cabin'));
    await mainPage.waitForSelector('.fishing-aquarium-scene[data-count="1"]');
    await mainPage.evaluate(() => {
      window.qaSimulationTrace = [];
      const step = TracerFishingModel.stepSession;
      TracerFishingModel.stepSession = function(session, input, delta) {
        const before = session.phase, at = performance.now();
        const result = step.apply(this, arguments);
        if (input?.cancel || input?.release || before !== session.phase) {
          qaSimulationTrace.push({ at, before, phase: session.phase, reason: session.reason, delta,
            input: { cancel: !!input?.cancel, release: !!input?.release }, stack: new Error().stack });
          if (qaSimulationTrace.length > 40) qaSimulationTrace.shift();
        }
        return result;
      };
    });
    // Capturing a software-GPU frame can outlast a normal interaction timeout.
    // This only budgets artifact capture; all behavioral waits keep their limits.
    const shot = async (page, name) => { await page.screenshot({ path: path.join(output, name), omitBackground: true, timeout: 60000 }); report.screenshots.push(name); };
    await shot(mainPage, '01-main-aquarium.png');
    assert.equal(await mainPage.evaluate(id => Tracer.fishing.snapshot().showcase.fish.some(f => f.id === id), seeded.fryId), true);
    await app.evaluate(({ app, ipcMain, BrowserWindow }) => {
      const started = Date.now(); globalThis.qaOverlayTrace = [];
      const record = (event, details = {}) => { if (qaOverlayTrace.length < 120) qaOverlayTrace.push({ ms: Date.now() - started, event, ...details }); };
      for (const channel of ['tracer-fishing-update', 'tracer-fishing-aquarium-update', 'tracer-fishing-command', 'tracer-fishing-aquarium-command', 'tracer-fishing-action']) {
        ipcMain.prependListener(channel, (_event, value) => { if (channel.endsWith('-update') || channel.endsWith('-action') || value?.type === 'ready') record(channel, { type: value?.type || 'snapshot', hasRod: !!value?.rod, fish: value?.showcase?.fish?.length, phase: value?.session?.phase, sessionId: value?.sessionId, sequence: value?.sequence }); });
      }
      for (const window of BrowserWindow.getAllWindows()) {
        const contents = window.webContents, send = contents.send.bind(contents);
        contents.send = (channel, ...values) => {
          if (channel === 'tracer-fishing-action') record('forward-fishing-action', { type: values[0]?.type, sessionId: values[0]?.sessionId, sequence: values[0]?.sequence });
          return send(channel, ...values);
        };
      }
      app.on('web-contents-created', (_event, contents) => {
        for (const name of ['dom-ready', 'did-finish-load']) contents.on(name, () => record(name, { url: contents.getURL() }));
        const send = contents.send.bind(contents);
        contents.send = (channel, ...values) => {
          if (channel === 'tracer-fishing-snapshot' || channel === 'tracer-fishing-aquarium-snapshot') record(channel, { url: contents.getURL(), hasRod: !!values[0]?.rod, fish: values[0]?.showcase?.fish?.length });
          return send(channel, ...values);
        };
      });
    });
    await mainPage.evaluate(() => Tracer.fishing.open());
    const pond = await pageAt('/fishing-desktop.html');
    const automaticPond = await overlayReady(pond, 'FishingDesktop', '#fishing-rod .fishing-rod-art');
    await mainPage.evaluate(() => Tracer.fishing.action('pin-aquarium'));
    const aquarium = await pageAt('/fishing-aquarium-desktop.html');
    const automaticAquarium = await overlayReady(aquarium, 'FishingAquariumDesktop', '.fishing-aquarium-scene[data-renderer="webgl"][data-count="1"]');
    report.initialOverlays = {
      beforeQaReady: { pond: automaticPond, aquarium: automaticAquarium },
      pond: await pond.evaluate(() => ({ document: qaSnapshotDocument, snapshots: qaSnapshots.length, rodId: qaSnapshots.at(-1).rod?.id, disabled: qaSnapshots.at(-1).disabled, rodAttached: !!document.querySelector('#fishing-rod .fishing-rod-art') })),
      aquarium: await aquarium.evaluate(() => ({ document: qaSnapshotDocument, snapshots: qaSnapshots.length, fish: qaSnapshots.at(-1).showcase?.fish.length })),
    };
    assert.equal(report.initialOverlays.pond.rodId, 'bamboo');
    assert.equal(report.initialOverlays.pond.disabled, false);
    assert.equal(report.initialOverlays.aquarium.fish, 1);
    report.initialOverlays.automaticHydration = true;
    report.initialOverlays.readyReplay = true;
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
    // Bamboo's entrance is only 440 ms. Cross-process Playwright round trips
    // can outlast it on CI, so exercise early F in the native menu notification
    // turn, immediately after the production listener has started the summon.
    // The later charge/cast still uses Playwright's actual keyboard input.
    await pond.evaluate(() => {
      window.qaEarlySummon = null; window.qaSummonCount = 0; window.qaKeys = []; window.qaFocusEvents = [];
      for (const type of ['keydown', 'keyup']) window.addEventListener(type, event => {
        if (event.code === 'KeyF') qaKeys.push({ at: performance.now(), type, trusted: event.isTrusted, handled: event.defaultPrevented, focused: document.hasFocus(), phase: document.getElementById('desktop-fishing').dataset.phase });
      });
      for (const type of ['blur', 'focus', 'focusout', 'visibilitychange']) window.addEventListener(type, event => {
        qaFocusEvents.push({ at: performance.now(), type, target: event.target?.id || event.target?.nodeName || 'window', related: event.relatedTarget?.id || event.relatedTarget?.nodeName, focused: document.hasFocus(), hidden: document.hidden });
        if (qaFocusEvents.length > 40) qaFocusEvents.shift();
      }, true);
      FishingDesktop.onMenuAction(value => {
        if (value.type !== 'summon-rod') return;
        window.qaSummonCount++;
        window.qaSummonStartedAt = performance.now();
        const started = performance.now(), rod = document.getElementById('fishing-rod');
        rod.focus({ preventScroll: true });
        if (window.qaEarlySummon) return;
        const down = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true, cancelable: true });
        const up = new KeyboardEvent('keyup', { key: 'f', code: 'KeyF', bubbles: true, cancelable: true });
        rod.dispatchEvent(down); rod.dispatchEvent(up);
        window.qaEarlySummon = { elapsedMs: performance.now() - started, handled: down.defaultPrevented,
          rodVisible: document.getElementById('desktop-fishing').dataset.rodVisible,
          powerHidden: document.getElementById('fishing-power').hidden,
          reelHidden: document.getElementById('fishing-reel').hidden };
      });
    });
    report.pondMenu = await nativeMenu(pond, 'Summon fishing rod');
    await waitFor(pond, () => !!window.qaEarlySummon);
    report.earlySummon = await pond.evaluate(() => window.qaEarlySummon);
    assert.equal(report.earlySummon.handled, true, 'early F reaches the production key handler');
    assert.equal(report.earlySummon.rodVisible, 'true');
    assert.equal(report.earlySummon.powerHidden, true);
    assert.equal(report.earlySummon.reelHidden, true);
    assert.equal(await mainPage.evaluate(() => Tracer.fishing.snapshot().session?.phase || 'idle'), 'idle', 'summon rejects early fishing input');
    assert.equal(await pond.locator('#fishing-power').isVisible(), false, 'summon has no progress bar');
    // The preceding cross-process assertions can use up the five-second idle
    // window. Start a separate real summon for the successful-input scenario,
    // then wait for its rendered completion instead of assuming 700 ms passed.
    // The intercepted OS menu does not focus its owner as a real popup would.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/fishing-desktop.html')).focus());
    await nativeMenu(pond, 'Summon fishing rod');
    await waitFor(pond, () => qaSummonCount === 2
      && TracerFishingRodEffects.summonState(qaSnapshots.at(-1).rod, performance.now() - qaSummonStartedAt, matchMedia('(prefers-reduced-motion: reduce)').matches) === null
      && document.getElementById('desktop-fishing').dataset.rodVisible === 'true'
      && document.getElementById('fishing-rod').style.opacity === '1'
      && document.querySelector('.fishing-summon-canvas')?.hidden);
    // Keep the real key gesture contiguous. Reading another process while F
    // is held can exceed the game's eight-second charge timeout on a slow CI
    // inspector. The read-only snapshot history records both real transitions.
    await pond.keyboard.down('f');
    await pause(350); await pond.keyboard.up('f');
    await waitFor(pond, () => qaPhases.some(value => value.phase === 'cast' && qaPhases.some(earlier => earlier.id === value.id && earlier.phase === 'charging')));
    report.castPhases = await pond.evaluate(() => qaPhases);
    const castId = report.castPhases.find(value => value.phase === 'cast').id;
    await waitFor(mainPage, id => Tracer.fishing.snapshot().state.casts.some(value => value.id === id), castId);
    report.keyboardInput = await pond.evaluate(() => qaKeys);
    assert(report.keyboardInput.some(event => event.type === 'keydown' && event.trusted && event.handled), 'successful cast uses actual trusted keyboard input');
    await shot(pond, '04-packaged-cast.png');
    await mainPage.evaluate(() => Tracer.fishing.cancel('packaged-smoke'));
    stage('native pond menu summons, blocks early F and accepts a real F cast');
    await mainPage.evaluate(() => {
      Tracer.show('ponds');
      window.qaMainPondCanvas = document.querySelector('.fishing-page-ponds #fishing-pond-canvas canvas');
    });
    assert.equal(await mainPage.evaluate(() => !!window.qaMainPondCanvas), true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/fishing-desktop.html')).focus());
    await nativeMenu(pond, 'Summon fishing rod');
    await waitFor(pond, () => qaSummonCount === 3
      && TracerFishingRodEffects.summonState(qaSnapshots.at(-1).rod, performance.now() - qaSummonStartedAt, matchMedia('(prefers-reduced-motion: reduce)').matches) === null
      && document.getElementById('desktop-fishing').dataset.rodVisible === 'true'
      && document.getElementById('fishing-rod').style.opacity === '1'
      && document.querySelector('.fishing-summon-canvas')?.hidden);
    await pond.keyboard.down('f'); await pause(350); await pond.keyboard.up('f');
    await waitFor(pond, previous => qaPhases.some(value => value.phase === 'cast' && value.id !== previous && qaPhases.some(earlier => earlier.id === value.id && earlier.phase === 'charging')), castId);
    const pondCastId = await pond.evaluate(previous => qaPhases.find(value => value.phase === 'cast' && value.id !== previous).id, castId);
    await waitFor(mainPage, id => Tracer.fishing.snapshot().state.casts.some(value => value.id === id), pondCastId);
    assert.equal(await mainPage.evaluate(() => qaMainPondCanvas === document.querySelector('.fishing-page-ponds #fishing-pond-canvas canvas')), true, 'active pond canvas survives charging and save updates');
    await mainPage.evaluate(() => Tracer.fishing.cancel('packaged-pond-smoke'));
    stage('real F casts also work while My Ponds retains its live GPU context');
    report.aquariumMenu = await nativeMenu(aquarium, 'Rotate right');
    await waitFor(aquarium, () => Number(document.querySelector('.fishing-aquarium-volume').dataset.aquariumYaw) === 15);
    await aquarium.evaluate(() => FishingAquariumDesktop.send({ type: 'resize', value: 1.25 }));
    await waitFor(aquarium, () => qaSnapshots.at(-1).desktopScale === 1.25);
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
    const aquariumReload = aquarium.waitForEvent('domcontentloaded', { timeout: 60000 });
    aquariumReload.catch(() => {}); // Keep an earlier main-page failure observable.
    await mainPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitFor(mainPage, () => window.Tracer?.fishing && Tracer.store.base?.fishing && !Tracer.store.dirty && !Tracer.store.inflight);
    assert.equal(await mainPage.locator('#language-select').inputValue(), 'en');
    assert(await mainPage.evaluate(id => Tracer.fishing.snapshot().showcase.fish.some(f => f.id === id), seeded.fryId));
    await mainPage.evaluate(() => { Tracer.fishing.open(); Tracer.fishing.action('pin-aquarium'); });
    await aquariumReload;
    report.reloadedOverlay = await overlayReady(aquarium, 'FishingAquariumDesktop', '.fishing-aquarium-scene[data-renderer="webgl"][data-count="1"]');
    await waitFor(aquarium, previous => window.qaSnapshots?.at(-1)?.nativeSessionId && qaSnapshots.at(-1).nativeSessionId !== previous && Number(document.querySelector('.fishing-aquarium-volume')?.dataset.aquariumYaw) === 15, auth.nativeSessionId, { timeout: 60000 });
    assert.equal(await aquarium.evaluate(() => qaSnapshots.at(-1).desktopScale), 1.25);
    const sessionAfter = await aquarium.evaluate(() => qaSnapshots.at(-1).nativeSessionId);
    assert.notEqual(sessionAfter, auth.nativeSessionId, 'reload renews native account/session credentials');
    await mainPage.evaluate(() => Tracer.fishing.action('hide-aquarium'));
    await waitFor(aquarium, () => document.body.dataset.paused === 'true' && document.querySelectorAll('#aquarium-content canvas').length === 0);
    await mainPage.evaluate(() => Tracer.fishing.action('pin-aquarium'));
    await aquarium.waitForSelector('.fishing-aquarium-volume[data-aquarium-fish-count="1"]');
    stage('language, collection and aquarium settings survive reload; hide releases aquarium and show recreates it');
    report.blockedExternalRequests = await app.evaluate(({}, probe) => (globalThis.qaBlockedOrigins || []).filter(origin => origin !== probe), report.networkGuard.probe);
    assert.deepEqual(report.blockedExternalRequests, []);
    assert.deepEqual(report.errors, []); assert.deepEqual(report.failedAssets, []);
    report.ok = true;
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    report.rendererDiagnostics = [];
    if (app) for (const [index, page] of app.context().pages().entries()) {
      try {
        report.rendererDiagnostics.push({ pageUrl: page.url(), ...await page.evaluate(() => ({
          url: location.href, readyState: document.readyState, title: document.title,
          bridge: typeof window.FishingDesktop, aquariumBridge: typeof window.FishingAquariumDesktop,
          pond: !!document.getElementById('fishing-pond'), rod: document.querySelectorAll('#fishing-rod .fishing-rod-art').length,
          aquariumFish: document.querySelector('.fishing-aquarium-scene')?.dataset.count,
          snapshots: window.qaSnapshots?.length, phase: document.getElementById('desktop-fishing')?.dataset.phase,
          keys: window.qaKeys, phases: window.qaPhases, summonCount: window.qaSummonCount,
          focusEvents: window.qaFocusEvents, simulation: window.qaSimulationTrace,
        })) });
      } catch (diagnosticError) { report.rendererDiagnostics.push({ pageUrl: page.url(), unavailable: diagnosticError.message }); }
      try { await page.screenshot({ path: path.join(output, 'failure-' + index + '.png') }); } catch {}
    }
    throw error;
  } finally {
    if (app) {
      try {
        const page = app.context().pages().find(page => page.url() === origin + '/');
        if (page) report.simulationTrace = await page.evaluate(() => window.qaSimulationTrace || []);
      } catch (error) { report.simulationTraceUnavailable = error.message; }
      try {
        report.nativeDiagnostics = await app.evaluate(({ BrowserWindow }) => ({
          events: globalThis.qaOverlayTrace || [],
          windows: BrowserWindow.getAllWindows().map(window => ({ url: window.webContents.getURL(), visible: window.isVisible(), loading: window.webContents.isLoading() })),
        }));
      } catch (error) { report.nativeDiagnostics = { unavailable: error.message }; }
    }
    if (app) await require('./close-qa-electron.cjs')(app);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ok: report.ok, mode: report.mode, report: path.join(output, 'report.json'), screenshots: report.screenshots }));
  }
  return report;
}

module.exports = { fixture, main };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
