'use strict';
// One native launch, clean copied runtime/profile, no existing user files or
// preference migration. Covers the real preload + embedded-reader language path.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), net = require('node:net');
const { _electron } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const M = require('../skins/tracer/model');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function close(app) {
  const child = app.process(), running = () => child.exitCode === null && child.signalCode === null;
  const exited = running() ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve();
  const closing = app.close().catch(() => {});
  if (!await Promise.race([exited.then(() => true), delay(4000).then(() => false)]) && running()) {
    if (process.platform === 'win32') await new Promise((resolve, reject) => require('node:child_process').execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }, error => error && running() ? reject(error) : resolve()));
    else child.kill('SIGTERM');
  }
  await Promise.race([exited, delay(3000)]); assert.equal(running(), false, 'the QA-owned Electron process exits');
  await Promise.race([closing, delay(1000)]); child.stdout?.destroy(); child.stderr?.destroy();
}
async function main() {
  const root = path.resolve(__dirname, '..'); fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const artifacts = fs.mkdtempSync(path.join(root, '.cache', 'native-language-')), runtime = path.join(artifacts, 'source'), profile = path.join(artifacts, 'profile'), data = path.join(profile, 'data'), music = path.join(profile, 'music');
  for (const dir of [runtime, data, music]) fs.mkdirSync(dir, { recursive: true });
  for (const name of ['server.js', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(runtime, name));
  for (const name of ['lib', 'desktop']) fs.cpSync(path.join(root, name), path.join(runtime, name), { recursive: true, filter: source => !/(?:^|[\\/])(?:node_modules|test)(?:[\\/]|$)/.test(source) });
  for (const name of ['skins', 'public', 'ai-service']) fs.symlinkSync(path.join(root, name), path.join(runtime, name), 'junction');
  fs.writeFileSync(path.join(runtime, 'local.config.json'), JSON.stringify({ skin: 'tracer', host: '127.0.0.1', autoHide: 'off', idleMinutes: 0 }));
  fs.writeFileSync(path.join(data, 'workspace.json'), JSON.stringify(M.emptyWorkspace()));
  const listener = net.createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve)); const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const origin = 'http://127.0.0.1:' + port, mainFile = path.join(runtime, 'desktop', 'main.js');
  let source = fs.readFileSync(mainFile, 'utf8').replace('fullscreen: true,', 'fullscreen: false, show: false,').replace('  win.loadURL(', "  win.once('ready-to-show', function () { win.showInactive(); });\n  win.loadURL(");
  // Install the network gate before the app creates browser sessions. Local
  // static files and about:blank are allowed; no remote site is opened by QA.
  source = source.replace("const path = require('node:path');", "const path = require('node:path');\nrequire('electron').app.on('session-created', function (session) { session.webRequest.onBeforeRequest(function (details, callback) { var allowed = /^(about:|file:|data:|devtools:)/.test(details.url) || details.url.startsWith(" + JSON.stringify(origin + '/') + "); callback({ cancel: !allowed }); }); });");
  fs.writeFileSync(mainFile, source);
  const env = { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_PORT: String(port), DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(profile, 'state.json'), DOCS_PORTAL_MUSIC_DIR: music }; delete env.ELECTRON_RUN_AS_NODE;
  const results = [], errors = [], states = [];
  let app, page;
  const check = (condition, label) => { assert.ok(condition, label); results.push(label); };
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [runtime], env, timeout: 60000 });
    for (let attempt = 0; attempt < 150; attempt++) { page = app.context().pages().find(candidate => candidate.url() === origin + '/'); if (page) break; await delay(100); }
    assert.ok(page, 'isolated native main page appears at the exact root URL'); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => window.Tracer?.store?.data && window.TracerBrowser && document.querySelector('.fx-native .fx-title'), null, { polling: 100 });
    const snapshot = () => page.evaluate(() => ({ language: document.documentElement.lang, storedLanguage: localStorage.getItem('tracer.language'), title: document.querySelector('.fx-title').textContent, address: document.querySelector('.fx-src').placeholder, go: document.querySelector('[data-act="go"]').textContent, external: document.querySelector('[data-act="external"]').title, source: document.querySelector('.fx-src').value, url: location.href }));
    const urls = () => app.evaluate(({ webContents }) => webContents.getAllWebContents().map(contents => ({ id: contents.id, url: contents.getURL() })).sort((a, b) => a.id - b.id));
    const before = await urls(), first = await snapshot(); states.push(first);
    check(first.storedLanguage === null && first.language === 'en' && first.title === 'Browser' && first.address === 'Enter a website address' && first.go === 'Go', 'fresh native profile opens with English browser labels before any language preference is saved');
    await page.screenshot({ path: path.join(artifacts, 'reader-first-en.png'), animations: 'disabled' });
    await page.selectOption('#language-select', 'zh'); const chinese = await snapshot(); states.push(chinese);
    check(chinese.title === '内置浏览器' && chinese.address === '输入网址' && chinese.go === '打开' && chinese.external === '用系统浏览器打开' && JSON.stringify(await urls()) === JSON.stringify(before), 'Chinese selection updates real native-reader labels without navigating any WebContents');
    await page.screenshot({ path: path.join(artifacts, 'reader-zh.png'), animations: 'disabled' });
    await page.selectOption('#language-select', 'en'); const english = await snapshot(); states.push(english);
    check(english.title === 'Browser' && english.address === 'Enter a website address' && english.go === 'Go' && english.external === 'Open in system browser' && JSON.stringify(await urls()) === JSON.stringify(before), 'English selection restores native-reader labels without navigating any WebContents');
    await page.screenshot({ path: path.join(artifacts, 'reader-return-en.png'), animations: 'disabled' });
    assert.equal(errors.length, 0, 'no native renderer exceptions');
    const summary = { results, states, errors, artifacts }; fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify({ results, states, errors, artifacts, error: error.message }, null, 2)); throw error;
  } finally { if (app) await close(app); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
