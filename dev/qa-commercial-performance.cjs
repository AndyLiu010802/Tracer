'use strict';
// Source-runtime benchmark, intentionally isolated from local.config.json and user data.
// Example: TRACER_QA_PLAYWRIGHT=<installed playwright> node dev/qa-commercial-performance.cjs baseline
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { _electron } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model'), F = require('../skins/tracer/focus-model'), G = require('../public/task-garden');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function closeElectron(app) {
  const child = app.process(), running = () => child.exitCode === null && child.signalCode === null;
  const exited = running() ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve();
  const closing = app.close().catch(() => {});
  if (!await Promise.race([exited.then(() => true), delay(4000).then(() => false)]) && running()) {
    if (process.platform === 'win32') await new Promise((resolve, reject) => require('node:child_process').execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, error => error && running() ? reject(error) : resolve()));
    else child.kill('SIGTERM');
  }
  await Promise.race([exited, delay(3000)]); assert.equal(running(), false, 'QA-owned Electron process exits');
  await Promise.race([closing, delay(1000)]); child.stdout?.destroy(); child.stderr?.destroy();
}
const round = value => Math.round(value * 100) / 100;
function summary(values) {
  const sorted = values.slice().sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { count: sorted.length, median: round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2), min: round(sorted[0]), max: round(sorted[sorted.length - 1]), samples: values.map(round) };
}
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
function fixture() {
  const ws = M.emptyWorkspace(), projects = Array.from({ length: 10 }, (_, i) => M.addProject(ws, { name: 'Benchmark project ' + i }));
  for (let i = 0; i < 500; i++) {
    M.addTask(ws, { title: 'Benchmark task ' + String(i).padStart(3, '0') + (i % 5 === 0 ? ' matching' : ''), notes: 'Synthetic task details for a repeatable 500-card workspace.', projectId: projects[i % 10].id, status: ['todo', 'doing', 'review', 'done'][i % 4], priority: ['urgent', 'high', 'medium', 'low'][i % 4], estimate: 1, spent: i % 4 === 3 ? 0.5 : 0, labels: ['Benchmark'], checklist: [{ id: 'check-' + i, text: 'Synthetic checklist', done: i % 2 === 0 }] });
  }
  M.addNote(ws, { title: 'Benchmark note', body: 'Synthetic note for section-switch measurement.' }); G.reconcile(ws);
  const focus = F.fresh();
  focus.history = ws.tasks.map((task, i) => ({ id: 'benchmark-focus-' + i, endedAt: Date.now() - i * 60000, minutes: 25, task: { id: task.id, title: task.title, projectId: task.projectId } }));
  focus.totalMinutes = 12500; focus.roundsDone = 500;
  return { ws, focus, projectId: projects[0].id };
}
async function main() {
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache', 'b09-performance-')), runtime = path.join(artifacts, 'source'); fs.mkdirSync(runtime);
  for (const name of ['server.js', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(runtime, name));
  for (const name of ['lib', 'desktop']) fs.cpSync(path.join(root, name), path.join(runtime, name), { recursive: true, filter: source => !/(?:^|[\\/])(?:node_modules|test)(?:[\\/]|$)/.test(source) });
  const mainFile = path.join(runtime, 'desktop', 'main.js');
  fs.writeFileSync(mainFile, fs.readFileSync(mainFile, 'utf8').replace('width: 1200,', 'width: 1000,').replace('height: 800,', 'height: 720,').replace('fullscreen: true,', 'fullscreen: false, show: false,').replace("  win.loadURL(", "  win.once('ready-to-show', function () { win.showInactive(); });\n  win.loadURL("));
  for (const name of ['skins', 'public', 'ai-service']) fs.symlinkSync(path.join(root, name), path.join(runtime, name), 'junction');
  fs.writeFileSync(path.join(runtime, 'local.config.json'), JSON.stringify({ skin: 'tracer', host: '127.0.0.1', autoHide: 'off', idleMinutes: 0 }));
  const data = fixture(), startup = [], actions = {}, idle = [], errors = [], validations = [];
  const report = { label: process.argv[2] || 'baseline', date: new Date().toISOString(), artifacts,
    hardware: { platform: process.platform, release: os.release(), architecture: process.arch, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryGB: round(os.totalmem() / 1073741824) },
    runtime: { driverNode: process.version, playwright: require(path.join(path.dirname(require.resolve(process.env.TRACER_QA_PLAYWRIGHT || 'playwright')), 'package.json')).version },
    fixture: { tasks: 500, projects: 10, completionReceipts: data.ws.completionHistory.length, focusSessions: 500, focusMinutes: 12500, notes: 1 },
    method: { startupRepeats: 3, actionRepeats: 5, idleRepeats: 3, idleWindowMs: 3000, actionClock: 'Renderer performance.now, synchronous event time reported separately from event-to-two-animation-frames; excludes Playwright transport and human input delay', startupClock: 'Fresh isolated profile per launch; renderer navigation and FCP plus launch-to-ready including automation overhead', idleClock: 'CDP Performance.TaskDuration / ScriptDuration / LayoutDuration deltas; renderer main thread only', network: 'Only isolated loopback origin allowed; no login, AI calls, or external data', source: 'Copied server/lib/desktop; read-only linked static source assets', window: '1000x720 non-fullscreen; startup showInactive, then foreground main window for action and visible idle samples; exact URL selects main window; every sample records native and renderer visibility' },
    limitations: ['Source runtime on one machine, not packaged installer or cold disk start.', 'OS file cache and other system activity are uncontrolled. No universal pass threshold is inferred.', 'CDP main-thread task percentage is not total application CPU, GPU load, battery usage, or power consumption.', 'The test launches a native window; actual minimization and hide are observed, not simulated visibility flags.', 'Runtime copy changes only window launch presentation to 1000x720, non-fullscreen, showInactive after ready-to-show to avoid stealing focus. Baseline and final use the same geometry.', 'Default appearance and fishing state; animated custom themes, cloud sync, AI, and global input hook are outside this sample.'],
    sourceHashes: {}, startup, actions, idle, errors, validations };
  const sourceFiles = ['skins/tracer/board.js', 'skins/tracer/board.css', 'skins/tracer/index.html', 'skins/tracer/projects.js', 'skins/tracer/task-editor.js', 'skins/tracer/i18n.js', 'skins/tracer/insights.js', 'skins/tracer/insights-model.js', 'skins/tracer/wellness.js', 'skins/tracer/fishing.js', 'desktop/main.js', 'public/reader.js'];
  for (const file of sourceFiles) report.sourceHashes[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const write = () => fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  write();
  let activeApp;
  try {
    for (let run = 0; run < 3; run++) {
      const profile = path.join(artifacts, 'profile-' + run), store = path.join(profile, 'data'), music = path.join(profile, 'music');
      fs.mkdirSync(store, { recursive: true }); fs.mkdirSync(music); fs.writeFileSync(path.join(store, 'workspace.json'), JSON.stringify(data.ws));
      const port = await freePort(), origin = 'http://127.0.0.1:' + port;
      const env = { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_PORT: String(port), DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: store, DOCS_PORTAL_STATE_FILE: path.join(profile, 'state.json'), DOCS_PORTAL_MUSIC_DIR: music }; delete env.ELECTRON_RUN_AS_NODE;
      const launched = performance.now(); console.log('[performance] Fresh-profile launch ' + (run + 1));
      const app = activeApp = await _electron.launch({ executablePath: require('electron'), args: [runtime], env, timeout: 60000 });
      app.process().stderr.on('data', bytes => fs.appendFileSync(path.join(profile, 'electron.log'), bytes));
      await app.context().route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) { errors.push({ kind: 'external-request-blocked', url: url.origin + url.pathname }); return route.abort(); }
        if (url.pathname.startsWith('/api/ai/')) return route.fulfill({ json: { configured: false, imageGeneration: false } });
        return route.continue();
      });
      let page;
      for (let attempt = 0; attempt < 150; attempt++) { page = app.context().pages().find(candidate => candidate.url() === origin + '/'); if (page) break; await delay(100); }
      assert.ok(page, 'isolated main page appears'); page.on('pageerror', error => errors.push({ kind: 'pageerror', message: error.message })); page.setDefaultTimeout(20000);
      try { await page.waitForFunction(() => window.Tracer?.store?.base?.tasks.length === 500 && Tracer.focus && Tracer.fishing && Tracer.garden, null, { polling: 100 }); }
      catch (error) { report.readyFailure = await page.evaluate(() => ({ url: location.href, visible: document.visibilityState, tracer: !!window.Tracer, tasks: window.Tracer?.store?.base?.tasks.length, focus: !!window.Tracer?.focus, fishing: !!window.Tracer?.fishing, garden: !!window.Tracer?.garden, body: document.body.innerText.slice(0, 2500) })); throw error; }
      const readyMs = performance.now() - launched;
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      startup.push({ launchToReadyMs: round(readyMs), ...await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0], paint = performance.getEntriesByName('first-contentful-paint')[0]; return { domContentLoadedMs: nav?.domContentLoadedEventEnd, loadMs: nav?.loadEventEnd, firstContentfulPaintMs: paint?.startTime ?? null }; }) });
      report.runtime.electron = await app.evaluate(() => process.versions.electron); report.runtime.chromium = await app.evaluate(() => process.versions.chrome);
      if (run !== 2) { await closeElectron(app); activeApp = null; write(); continue; }
      // A fixed viewport and explicit English locale make repeated action samples comparable.
      await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows().find(window => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(window.webContents.getURL())); win.setBounds({ x: 80, y: 80, width: 1000, height: 720 }); win.show(); win.focus(); });
      await page.evaluate(focus => { localStorage.setItem('tracer.language', 'en'); localStorage.setItem('tracer.focus.v1', JSON.stringify(focus)); }, data.focus);
      await page.reload(); await page.waitForFunction(() => window.Tracer?.store?.base?.tasks.length === 500 && Tracer.focus && Tracer.fishing);
      await page.evaluate(() => Tracer.show('board')); await page.waitForFunction(() => document.querySelectorAll('#sec-board .card').length === 500); await delay(1000);
      const cdp = await app.context().newCDPSession(page); await cdp.send('Performance.enable');
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
      const nativeState = () => app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows().find(window => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(window.webContents.getURL())); return { visible: win.isVisible(), focused: win.isFocused(), minimized: win.isMinimized() }; });
      await page.evaluate(() => {
        window.benchmarkLongTasks = [];
        try { window.benchmarkObserver = new PerformanceObserver(list => list.getEntries().forEach(row => benchmarkLongTasks.push({ at: row.startTime, duration: row.duration }))); benchmarkObserver.observe({ type: 'longtask', buffered: false }); } catch {}
        window.benchmarkBoardRebuilds = 0;
        window.benchmarkBoardObserver = new MutationObserver(rows => rows.forEach(row => { if (row.target.id === 'sec-board' && row.addedNodes.length && row.removedNodes.length) benchmarkBoardRebuilds++; }));
        benchmarkBoardObserver.observe(document.querySelector('#sec-board'), { childList: true });
      });
      async function measure(name, prepare, operate, verify) {
        const samples = [], syncSamples = [], rebuilds = [], states = [], cpu = [];
        for (let sample = 0; sample < 5; sample++) {
          await prepare(); await delay(150);
          await page.evaluate(() => { benchmarkBoardRebuilds = 0; });
          const native = await nativeState(), before = await metrics();
          const result = await page.evaluate(async ({ source, projectId }) => {
            // Source is this script's literal benchmark function, never workspace or user input.
            const action = (0, eval)('(' + source + ')'), start = performance.now(), pending = action(projectId), syncMs = performance.now() - start;
            return { syncMs, totalMs: await pending, documentHidden: document.hidden, tracerHidden: document.tracerHidden };
          }, { source: operate.toString(), projectId: data.projectId });
          const after = await metrics(); samples.push(result.totalMs); syncSamples.push(result.syncMs); states.push({ native, documentHidden: result.documentHidden, tracerHidden: result.tracerHidden });
          cpu.push({ scriptMs: round((after.ScriptDuration - before.ScriptDuration) * 1000), layoutMs: round((after.LayoutDuration - before.LayoutDuration) * 1000), taskMs: round((after.TaskDuration - before.TaskDuration) * 1000) });
          assert.ok(native.visible && !native.minimized && !result.tracerHidden, name + ' samples target the visible main window');
          rebuilds.push(await page.evaluate(() => benchmarkBoardRebuilds));
          await verify();
        }
        actions[name] = { milliseconds: summary(samples), synchronousMilliseconds: summary(syncSamples), fullBoardReplacements: summary(rebuilds), states, cpu }; console.log('[performance] ' + name + ' median ' + actions[name].milliseconds.median + ' ms, sync ' + actions[name].synchronousMilliseconds.median + ' ms, board replacements ' + actions[name].fullBoardReplacements.median); write();
      }
      const board = async () => { await page.evaluate(() => { Tracer.openProject(null); document.querySelector('#board-clear').click(); }); await page.waitForFunction(() => document.querySelectorAll('#sec-board .card').length === 500); };
      await measure('projectFilter500To50', board, async projectId => { const start = performance.now(); document.querySelector('.proj-item[data-id="' + projectId + '"]').click(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }, () => page.waitForFunction(() => document.querySelectorAll('#sec-board .card').length === 50));
      await measure('projectFilter50To500', async () => { await page.evaluate(projectId => Tracer.openProject(projectId), data.projectId); }, async () => { const start = performance.now(); document.querySelector('.proj-all').click(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }, () => page.waitForFunction(() => document.querySelectorAll('#sec-board .card').length === 500));
      await measure('boardFilter500To100', board, async () => { const start = performance.now(), input = document.querySelector('#board-search'); input.value = 'matching'; input.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }, () => page.waitForFunction(() => document.querySelectorAll('#sec-board .card').length === 100));
      await measure('boardClear100To500', async () => { await board(); await page.evaluate(() => { const input = document.querySelector('#board-search'); input.value = 'matching'; input.dispatchEvent(new Event('input', { bubbles: true })); }); }, async () => { const start = performance.now(); document.querySelector('#board-clear').click(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }, () => page.waitForFunction(() => document.querySelectorAll('#sec-board .card').length === 500));
      await measure('openTaskEditor500', board, async () => { const start = performance.now(); document.querySelector('#sec-board .card-title').click(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }, async () => { await page.locator('#f-title').waitFor(); await page.locator('#f-cancel').click(); });
      await measure('openProjectReview500', board, async projectId => { const start = performance.now(); Tracer.openProjectReview(projectId); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }, () => page.locator('#project-review').waitFor());
      await measure('switchNotesToBoard500', async () => { await page.evaluate(() => Tracer.show('notes')); }, async () => { const start = performance.now(); Tracer.show('board'); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return performance.now() - start; }, () => page.waitForFunction(() => document.querySelectorAll('#sec-board .card').length === 500));
      validations.push('All seven action families retained their expected task counts or opened the intended editor/review.');
      async function idleState(state, transition) {
        await transition(); await delay(800); const samples = [];
        for (let sample = 0; sample < 3; sample++) {
          await page.evaluate(() => { window.benchmarkMutations = 0; window.benchmarkMutationObserver = new MutationObserver(rows => benchmarkMutations += rows.length); benchmarkMutationObserver.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
          const before = await metrics(), at = performance.now(); await delay(3000); const elapsedMs = performance.now() - at, after = await metrics();
          const visibility = await page.evaluate(() => { benchmarkMutationObserver.disconnect(); return { documentHidden: document.hidden, tracerHidden: document.tracerHidden, mutations: benchmarkMutations }; });
          const native = await nativeState(), expectedHidden = /minimized|hidden-to-tray/.test(state);
          assert.equal(visibility.tracerHidden, expectedHidden, state + ' keeps the expected app visibility');
          assert.equal(native.visible && !native.minimized, !expectedHidden, state + ' keeps the expected native visibility');
          samples.push({ elapsedMs: round(elapsedMs), taskMs: round((after.TaskDuration - before.TaskDuration) * 1000), scriptMs: round((after.ScriptDuration - before.ScriptDuration) * 1000), layoutMs: round((after.LayoutDuration - before.LayoutDuration) * 1000), taskPercentOfOneMainThread: round((after.TaskDuration - before.TaskDuration) * 100000 / elapsedMs), heapMB: round(after.JSHeapUsedSize / 1048576), native, ...visibility });
        }
        const row = { state, samples, taskMs: summary(samples.map(sample => sample.taskMs)), taskPercentOfOneMainThread: summary(samples.map(sample => sample.taskPercentOfOneMainThread)), mutations: summary(samples.map(sample => sample.mutations)) }; idle.push(row); console.log('[performance] ' + state + ' median main-thread task ' + row.taskMs.median + ' ms / 3 s'); write();
      }
      await idleState('board-visible', board);
      await idleState('board-minimized', async () => { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(window.webContents.getURL())).minimize()); await page.waitForFunction(() => document.tracerHidden === true, null, { polling: 100 }); });
      await idleState('board-hidden-to-tray', async () => { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(window.webContents.getURL())).hide()); await page.waitForFunction(() => document.tracerHidden === true, null, { polling: 100 }); });
      await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows().find(window => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(window.webContents.getURL())); win.restore(); win.show(); win.focus(); }); await page.waitForFunction(() => document.tracerHidden === false, null, { polling: 100 });
      await idleState('insights-visible', async () => { await page.evaluate(projectId => Tracer.openProjectReview(projectId), data.projectId); });
      report.longTasks = await page.evaluate(() => { benchmarkObserver?.disconnect(); return benchmarkLongTasks; });
      validations.push('Native minimize and hide both published tracerHidden=true; native restore returned tracerHidden=false.');
      report.finalState = await page.evaluate(() => ({ tasks: Tracer.store.base.tasks.length, focusSessions: Tracer.focus.read().history.length, dirty: Tracer.store.dirty, inflight: !!Tracer.store.inflight }));
      assert.equal(report.finalState.tasks, 500); assert.equal(report.finalState.focusSessions, 500); assert.equal(report.finalState.dirty, false); assert.equal(report.finalState.inflight, false);
      validations.push('500 tasks and 500 synthetic focus sessions remain; no unsaved workspace writes.');
      await page.screenshot({ path: path.join(artifacts, 'final-project-review.png'), animations: 'disabled' });
      // Functional lifecycle check occurs after all CPU samples and does not affect idle numbers.
      await page.evaluate(() => { const f = TracerFocus.fresh(); f.settings.sound = false; f.duration = f.remaining = 1500; TracerFocus.start(f, Date.now(), 'benchmark-background-timer'); localStorage.setItem('tracer.focus.v1', JSON.stringify(f)); dispatchEvent(new StorageEvent('storage', { key: 'tracer.focus.v1' })); });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(window.webContents.getURL())).hide());
      await page.waitForFunction(() => document.tracerHidden === true && JSON.parse(localStorage.getItem('tracer.focus.v1')).completed === true, null, { polling: 100 });
      await delay(1200);
      report.backgroundTimer = await page.evaluate(() => { const f = JSON.parse(localStorage.getItem('tracer.focus.v1')); return { completed: f.completed, matchingReceipts: f.history.filter(row => row.id === 'benchmark-background-timer').length, roundsDone: f.roundsDone }; });
      assert.equal(report.backgroundTimer.matchingReceipts, 1); assert.equal(report.backgroundTimer.roundsDone, 1);
      validations.push('After sampling, a synthetic 1.5-second focus round completed while natively hidden and was recorded exactly once.');
      await closeElectron(app); activeApp = null;
    }
    report.startupSummary = Object.fromEntries(['launchToReadyMs', 'domContentLoadedMs', 'loadMs', 'firstContentfulPaintMs'].map(key => [key, summary(startup.map(sample => sample[key]).filter(Number.isFinite))]));
    report.sourceHashesAtEnd = Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
    report.sourceChangesDuringRun = sourceFiles.filter(file => report.sourceHashes[file] !== report.sourceHashesAtEnd[file]);
    assert.equal(errors.length, 0, 'benchmark has no page errors or external requests'); report.completed = true; write(); console.log(JSON.stringify({ artifacts, startupSummary: report.startupSummary, actions, idle: idle.map(row => ({ state: row.state, taskMs: row.taskMs, mutations: row.mutations })) }, null, 2));
  } catch (error) { errors.push({ kind: 'benchmark-failure', message: error.message, stack: error.stack }); write(); throw error; }
  finally { if (activeApp) await closeElectron(activeApp); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
