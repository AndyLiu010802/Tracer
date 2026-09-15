'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { _electron: electron } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.cache', 'desktop-qa-' + Date.now());
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(path.join(profile, 'browser-preferences.pending.json'), JSON.stringify({'tracer.language':'en'}));
const checks = [];
function check(name, value) { assert.ok(value, name); checks.push(name); console.log('PASS ' + name); }
const fixture = http.createServer((req, res) => {
  if (req.url === '/download') { res.writeHead(200, { 'content-type': 'text/plain', 'content-disposition': 'attachment; filename=browser-check.txt' }); res.end('download works'); return; }
  if (req.url === '/api') { res.setHeader('content-type', 'application/json'); res.end('{"works":true}'); return; }
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('content-security-policy', "frame-ancestors 'none'");
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><title>Native Browser ' + req.url + '</title><h1>Direct page ' + req.url + '</h1><a href="/two">Next</a><a target="_blank" href="/popup">Popup</a><input id="entry"><script>document.cookie="nativeBrowser=yes; SameSite=Lax"</script>');
});
(async () => {
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const site = 'http://127.0.0.1:' + fixture.address().port;
  const env = { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_DATA_DIR: path.join(profile, 'data'), DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json'), DOCS_PORTAL_PORT: '18137', DOCS_PORTAL_SKIN: 'tracer' };
  delete env.ELECTRON_RUN_AS_NODE;
  const packaged = process.argv[2];
  const app = await electron.launch({executablePath:packaged ? path.resolve(packaged) : require('electron'),args:packaged ? []:[root],env,timeout:30000});
  try {
    const context=app.context();
    console.log('Electron browser automation connected');
    let page;
    for (let i = 0; i < 100; i++) {
      page = context.pages().find(p => p.url().startsWith('http://127.0.0.1:18137/'));
      if (page) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!page) throw new Error('Main task window not found');
    page.setDefaultTimeout(15000);
    console.log('Main task window found');
    await page.waitForURL('http://127.0.0.1:18137/**');
    await page.waitForFunction(() => window.Tracer?.store?.data && window.TracerBrowser);
    // Native child views use real window bounds; do not emulate a larger viewport.
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    check('clean profile starts with no personal tasks', await page.evaluate(() => Tracer.store.data.tasks.length === 0));
    check('browser preferences import before the app loads', await page.evaluate(()=>localStorage.getItem('tracer.language')==='en'));
    check('successful preferences import is archived once', !fs.existsSync(path.join(profile,'browser-preferences.pending.json')) && fs.readdirSync(profile).some(f=>f.startsWith('browser-preferences.imported-')));
    check('main renderer has no Node access', await page.evaluate(()=>typeof require==='undefined'));
    check('native background input module loads', await app.evaluate(({app})=>typeof process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json')('uiohook-napi').uIOhook.start==='function'));
    await page.evaluate(() => { if (document.querySelector('.fx-panel').style.display === 'none') window.postMessage({ __aside: 1, type: 'bosskey' }, '*'); });
    const nativePage = context.pages().find(p=>p!==page);
    if(!nativePage)throw new Error('Native browser view not created');
    const native = fn => nativePage.evaluate(fn);
    const visible = () => page.evaluate(()=>document.querySelector('.fx-panel').dataset.browserVisible === 'true');
    async function waitURL(url) {
      for (let i = 0; i < 100; i++) {
        if (nativePage.url()===url && await native('document.readyState === "complete"').catch(()=>false)) return;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error('Navigation did not finish: ' + url);
    }
    await page.locator('.fx-src').fill(site + '/one');
    await page.locator('[data-act="go"]').click();
    await waitURL(site + '/one');
    check('loads frame-blocking website as a direct top-level document', await native('window.top === window && document.querySelector("h1").textContent === "Direct page /one"'));
    check('remote website cannot access Node or the application bridge', await native('typeof require === "undefined" && typeof TracerBrowser === "undefined"'));
    check('native browser has visible bounds in the reference panel', await visible());
    check('website scripts and same-origin API work', await native('fetch("/api").then(r=>r.json()).then(d=>d.works)'));
    check('website cookies work', await native('document.cookie.includes("nativeBrowser=yes")'));
    await native('document.querySelector("a").click()');
    await waitURL(site + '/two');
    await page.waitForFunction(url => document.querySelector('.fx-src').value === url, site + '/two');
    check('links update the application address bar', true);
    await page.locator('[data-act="back"]').click(); await waitURL(site + '/one'); check('native back navigation', true);
    await page.locator('[data-act="fwd"]').click(); await waitURL(site + '/two'); check('native forward navigation', true);
    await page.evaluate(() => Tracer.ui.modal((box, close) => { box.textContent = 'Browser overlay check'; const b = document.createElement('button'); b.id = 'qa-modal-close'; b.textContent = 'Close'; b.onclick = close; box.appendChild(b); }));
    await new Promise(r => setTimeout(r, 300)); check('native content hides behind task dialogs', !(await visible()));
    await page.locator('#qa-modal-close').click(); await new Promise(r => setTimeout(r, 300)); check('native content returns after closing dialog', await visible());
    await page.locator('[data-act="hide"]').click(); await new Promise(r => setTimeout(r, 300)); check('collapse also hides native view', !(await visible()));
    await page.evaluate(() => window.postMessage({ __aside:1, type:'bosskey' }, '*'));
    await native('document.querySelector("a[target]").click()');
    for(let i=0;i<40 && context.pages().length<3;i++) await new Promise(r=>setTimeout(r,100));
    check('target blank opens a separate browser window', context.pages().length >= 3);
    const popup = context.pages().find(p => p !== page && p!==nativePage);
    await popup.waitForLoadState('domcontentloaded');
    check('popup keeps sandbox and has no app bridge', await popup.evaluate(() => typeof require === 'undefined' && typeof TracerBrowser === 'undefined'));
    await popup.close();
    const downloadPath = path.join(profile, 'browser-check.txt');
    await app.evaluate(({webContents},{url,dest,site})=>{const wc=webContents.getAllWebContents().find(w=>w.getURL().startsWith(site+'/'));if(!wc)throw new Error('Download source not found');wc.session.once('will-download',(_event,item)=>item.setSavePath(dest));wc.downloadURL(url);},{url:site+'/download',dest:downloadPath,site});
    for(let i=0;i<80&&!fs.existsSync(downloadPath);i++) await new Promise(r=>setTimeout(r,100));
    check('website file download succeeds', fs.readFileSync(downloadPath,'utf8') === 'download works');
    await page.locator('.fx-src').fill('http://127.0.0.1:1/unreachable'); await page.locator('[data-act="go"]').click();
    await page.locator('.fx-browser-message:not([hidden]) button:not([hidden])').waitFor({state:'visible'});
    check('failed navigation shows retry and system-browser fallback', await page.locator('[data-act="external"]').isVisible());
    await page.locator('.fx-src').fill(site + '/one'); await page.locator('[data-act="go"]').click(); await waitURL(site + '/one');
    check('recovers from failed navigation', await visible());
    const music = await page.evaluate(() => fetch('/api/music').then(r=>r.json()));
    check('all 35 relaxation tracks included', music.tracks.length === 35);
    check('packaged audio streams partial requests', await page.evaluate(async url => {const r=await fetch(url,{headers:{Range:'bytes=0-127'}});return r.status===206&&(await r.arrayBuffer()).byteLength===128;}, music.tracks[0].url));
    await page.evaluate(() => {const t=TracerModel.addTask(Tracer.store.data,{title:'Desktop persistence check'}); TracerModel.moveTask(Tracer.store.data,t.id,'done'); Tracer.touch(); });
    await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
    await page.reload(); await page.waitForFunction(()=>Tracer.store.data?.tasks?.some(t=>t.title==='Desktop persistence check'));
    check('tasks and completion history survive reload', await page.evaluate(()=>TaskHistory.completed(Tracer.store.data).length===1));
    check('main app has no runtime errors', errors.length===0);
    await page.screenshot({path:path.join(root,'.cache','desktop-app-0.2.0.png')});
    if(process.env.TRACER_QA_EXTERNAL==='1') {
      const external = 'https://southdevelopments.com.au/projects/napa';
      await page.locator('.fx-src').fill(external); await page.locator('[data-act="go"]').click();
      for(let i=0;i<300;i++) { const ok=await native('!!document.querySelector("h1") && /Napa/i.test(document.body.innerText)').catch(()=>false); if(ok){check('user Napa website renders directly', true);break;} await new Promise(r=>setTimeout(r,100)); }
      check('Napa content verified', checks.includes('user Napa website renders directly'));
      await nativePage.waitForTimeout(4000); // Allow the site's opening animation to finish for its screenshot.
      await nativePage.screenshot({path:path.join(root,'.cache','desktop-napa-0.2.0.png')});
    }
    console.log(JSON.stringify({checks:checks.length,profile,packaged:!!packaged}));
  } finally { await app.close(); fixture.close(); }
})().catch(e=>{console.error(e.stack);fixture.close();process.exitCode=1;});
