'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { _electron } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..'), profile = fs.mkdtempSync(path.join(root, '.cache/notes-native-'));
const reference = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><body>Reference page for divider QA</body></html>'); });
(async () => {
  await new Promise(r => reference.listen(0, '127.0.0.1', r));
  const env = { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_PORT: '18143', DOCS_PORTAL_DATA_DIR: path.join(profile, 'data'), DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json') }; delete env.ELECTRON_RUN_AS_NODE;
  const exe = process.argv[2];
  const app = await _electron.launch({ executablePath: exe ? path.resolve(exe) : require('electron'), args: exe ? [] : [root], env, timeout: 45000 });
  try {
    let page;
    for (let i = 0; i < 100; i++) { page = app.context().pages().find(p => p.url().startsWith('http://127.0.0.1:18143/')); if (page) break; await new Promise(r => setTimeout(r, 100)); }
    assert.ok(page); await page.waitForFunction(() => window.Tracer?.store?.data);
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setFullScreen(false); w.setSize(1600, 1000); });
    await page.locator('[data-sec="notes"]').click(); await page.locator('#note-new').click();
    await page.locator('#note-title').fill('Native divider QA'); await page.locator('#note-body').fill('Retain this draft while resizing.');
    await page.evaluate(url => TracerBrowser.send({ action: 'navigate', url }), 'http://127.0.0.1:' + reference.address().port);
    const visible = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.some(v => v.webContents && v.getVisible()));
    for (let i = 0; i < 50 && !await visible(); i++) await page.waitForTimeout(100);
    assert.ok(await visible(), 'reference view starts visible');
    const grip = page.locator('.notes-grip'); await grip.scrollIntoViewIfNeeded();
    const g = await grip.boundingBox(); await page.mouse.move(g.x + g.width / 2, g.y + 80); await page.mouse.down();
    await page.waitForFunction(() => document.body.classList.contains('is-resizing'));
    for (let i = 0; i < 30 && await visible(); i++) await page.waitForTimeout(30);
    assert.ok(!await visible(), 'native view yields pointer input during drag');
    const rail = await page.locator('.rail').boundingBox();
    await page.mouse.move(rail.x + 80, g.y + 80, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => !document.body.classList.contains('is-resizing') && !document.body.classList.contains('notes-resizing'));
    for (let i = 0; i < 30 && !await visible(); i++) await page.waitForTimeout(30);
    assert.ok(await visible(), 'native view returns after pointer-up over reference area');
    assert.equal(await page.locator('#note-body').inputValue(), 'Retain this draft while resizing.');
    console.log('PASS native reference yields during Notes drag, pointer-up restores view, draft retained');
  } finally { await app.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(() => reference.close());
