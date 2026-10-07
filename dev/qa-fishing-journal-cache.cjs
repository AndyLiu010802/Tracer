'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=fs.mkdtempSync(path.join(root,'.cache/fishing-journal-cache-')),data=path.join(output,'data');fs.mkdirSync(data);
Object.assign(process.env,{DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_DATA_DIR:data,DOCS_PORTAL_STATE_FILE:path.join(output,'state.json')});
const {handleRequest,server:appServer}=require('../server'),Art=require('../skins/tracer/fishing-art'),F=require('../public/fishing-model');
let oldAtlas=null,bareRequests=0;const requests=[];
const server=http.createServer((req,res)=>{
  requests.push(req.url);
  if(req.url==='/cache-warmup'){res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});return res.end('<!doctype html><body style="background:#19342e;color:#f1ead6"></body>');}
  if(req.url==='/fishing-art/fish-model-v1.png'&&oldAtlas){bareRequests++;res.writeHead(200,{'content-type':'image/png','cache-control':'public, max-age=86400'});return res.end(oldAtlas);}
  return handleRequest(req,res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1500,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/cache-warmup');
    const oldPng=await page.evaluate(async()=>{const image=new Image();image.src='/fishing-art/fish-model-v1.png?source=current';await image.decode();const canvas=document.createElement('canvas');canvas.width=1640;canvas.height=864;canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL().split(',')[1];});oldAtlas=Buffer.from(oldPng,'base64');
    assert.deepEqual(await page.evaluate(async()=>{const image=new Image();image.src='/fishing-art/fish-model-v1.png';await image.decode();return[image.naturalWidth,image.naturalHeight];}),[1640,864]);
    const cards=F.catalog.fish.map(f=>'<article style="padding:15px;background:#304532"><div style="height:100px">'+Art.fishMarkup(f).replace(/\?layout=[^"]+/,'')+'</div><strong>'+f.name[0]+'</strong></article>').join('');
    await page.evaluate(html=>{document.body.innerHTML='<style>svg{width:100%;height:100%}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}</style><h1>Stale four-row atlas with five-row markup</h1><div class="grid">'+html+'</div>';},cards);await page.screenshot({path:path.join(output,'before-stale-cache.png'),fullPage:true});
    assert.equal(bareRequests,1,'reproduction used the cached old image');oldAtlas=null;
    await page.goto(origin);await page.waitForFunction(()=>window.Tracer?.fishing&&!Tracer.store.inflight);if(await page.locator('#daily-card-hide').isVisible())await page.locator('#daily-card-hide').click();await page.locator('#aside-slot .fx-panel').waitFor({state:'attached'});if(await page.locator('.shell').getAttribute('data-rail')!=='collapsed')await page.locator('.rail-grip').dblclick();await page.selectOption('#language-select','zh');await page.click('#nav-cabin');
    assert.equal(await page.locator('.fishing-journal-card').count(),24);
    const urls=await page.locator('.fishing-journal-card image').evaluateAll(els=>[...new Set(els.map(e=>e.getAttribute('href')))]);assert.deepEqual(urls,['/fishing-art/fish-model-v1.png?layout=1640x1080']);
    assert.deepEqual(await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();return[image.naturalWidth,image.naturalHeight];},urls[0]),[1640,1080]);
    assert(requests.includes(urls[0]),'new atlas URL reaches server despite the old 24-hour cache');
    for(const width of [1500,390]){await page.setViewportSize({width,height:width===1500?2200:950});await page.locator('.fishing-journal-grid').scrollIntoViewIfNeeded();await page.locator('.fishing-journal-grid').screenshot({path:path.join(output,'journal-'+width+'.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    const response=await context.request.get(origin+urls[0]);assert.equal(response.headers()['cache-control'],'no-cache');assert(response.headers().etag);const unchanged=await context.request.get(origin+urls[0],{headers:{'if-none-match':response.headers().etag}});assert.equal(unchanged.status(),304);
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,bareRequests,urls,checks:['old four-row PNG really cached for 24 hours','old error reproduced','new layout URL loads five-row PNG','24 journal species on desktop and mobile','ETag validation keeps future model updates fresh'],errors},null,2));console.log('PASS journal cache upgrade');console.log(output);
  }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));appServer.emit('close');}
})().catch(error=>{console.error(error);console.error(output);process.exitCode=1;});
