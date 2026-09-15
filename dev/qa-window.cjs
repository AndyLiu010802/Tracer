'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.cache', 'window-qa-' + Date.now());
fs.mkdirSync(profile, { recursive: true });
const checks = [];
function check(name, value) { assert.ok(value, name); checks.push(name); console.log('PASS ' + name); }
(async () => {
  const exe = process.argv[2];
  const env = { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_PORT: '18139', DOCS_PORTAL_DATA_DIR: path.join(profile, 'data'), DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json') };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: exe ? path.resolve(exe) : require('electron'), args: exe ? [] : [root], env, timeout: 45000 });
  app.process().stderr.on('data', chunk => fs.appendFileSync(path.join(profile, 'electron.log'), chunk));
  try {
    let page;
    for (let i = 0; i < 100; i++) { page = app.context().pages().find(p => p.url().startsWith('http://127.0.0.1:18139/')); if (page) break; await new Promise(r => setTimeout(r, 100)); }
    assert.ok(page); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.waitForFunction(() => window.TracerWindow && window.Tracer?.store?.data && document.documentElement.dataset.windowFullscreen === 'true');
    const state = await app.evaluate(({ BrowserWindow, screen }) => { const w = BrowserWindow.getAllWindows()[0]; return { full: w.isFullScreen(), bounds: w.getBounds(), content: w.getContentBounds(), display: screen.getDisplayMatching(w.getBounds()).bounds, menu: w.isMenuBarVisible() }; });
    check('starts in true display-sized fullscreen without native title bar', state.full && JSON.stringify(state.bounds) === JSON.stringify(state.display) && JSON.stringify(state.bounds) === JSON.stringify(state.content) && !state.menu);
    check('all window controls visible', await page.locator('#window-controls').isVisible() && await page.locator('#window-close').isVisible());
    await page.screenshot({ path: path.join(root, '.cache', 'tracer-fullscreen-0.3.1.png') });
    await page.click('#window-fullscreen'); await page.waitForFunction(() => document.documentElement.dataset.windowFullscreen === 'false', null, { timeout: 5000 });
    const normal = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { bounds: w.getBounds(), content: w.getContentBounds() }; });
    check('window mode has no native title bar', Math.abs(normal.content.y - normal.bounds.y) <= 8 && Math.abs(normal.content.x - normal.bounds.x) <= 8);
    await page.click('#new-btn'); await app.evaluate(({ BrowserWindow }) => { const wc = BrowserWindow.getAllWindows()[0].webContents; wc.sendInputEvent({ type: 'keyDown', keyCode: 'F11' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'F11' }); }); await page.waitForFunction(() => document.documentElement.dataset.windowFullscreen === 'true', null, { timeout: 5000 });
    check('F11 works with a task dialog open', await page.locator('#modal-root').isVisible());
    await page.keyboard.press('Escape'); check('Escape still closes the dialog', !await page.locator('#modal-root').isVisible());
    check('dialog Escape does not interfere with fullscreen', await page.evaluate(() => document.documentElement.dataset.windowFullscreen === 'true'));
    await page.selectOption('#language-select', 'en'); check('English window labels', (await page.locator('#window-fullscreen').getAttribute('aria-label')).includes('Exit full screen'));
    await page.selectOption('#language-select', 'zh'); check('Chinese window labels', (await page.locator('#window-fullscreen').getAttribute('aria-label')).includes('退出全屏'));
    const remote = app.context().pages().find(p => p !== page); check('remote browser has no native window bridge', remote && await remote.evaluate(() => typeof window.TracerWindow === 'undefined'));
    await app.evaluate(({ webContents, BrowserWindow, ipcMain }) => { const w = BrowserWindow.getAllWindows()[0]; const remote = webContents.getAllWebContents().find(wc => wc.id !== w.webContents.id); ipcMain.emit('tracer-window-action', { sender: remote, senderFrame: remote.mainFrame }, 'toggle-fullscreen'); });
    check('untrusted renderer window commands rejected', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()));
    await app.evaluate(({ webContents, BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; const remote = webContents.getAllWebContents().find(wc => wc.id !== w.webContents.id); remote.sendInputEvent({ type: 'keyDown', keyCode: 'F11' }); remote.sendInputEvent({ type: 'keyUp', keyCode: 'F11' }); });
    await page.waitForFunction(() => document.documentElement.dataset.windowFullscreen === 'false'); check('F11 works while reference browser is focused', true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 650));
    const fits = await page.evaluate(() => { const e = document.getElementById('window-controls').getBoundingClientRect(); return e.left >= 0 && e.right <= innerWidth && e.bottom <= innerHeight; }); check('window controls fit at minimum width', fits);
    await page.click('#window-minimize'); await new Promise(r => setTimeout(r, 250)); check('minimize control works', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()));
    await app.evaluate(({ app }) => app.emit('second-instance')); await page.waitForFunction(() => !document.hidden); check('reopening restores a minimized window', await app.evaluate(({ BrowserWindow }) => !BrowserWindow.getAllWindows()[0].isMinimized()));
    await page.click('#window-close'); check('close control hides to tray', await app.evaluate(({ BrowserWindow }) => !BrowserWindow.getAllWindows()[0].isVisible()));
    await app.evaluate(({ app }) => app.emit('second-instance')); await page.waitForFunction(() => !document.hidden); check('window can reopen from tray', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()));
    check('no renderer exceptions', errors.length === 0);
    fs.writeFileSync(path.join(root, '.cache', 'window-qa-result.json'), JSON.stringify({ packaged: !!exe, checks }, null, 2));
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
