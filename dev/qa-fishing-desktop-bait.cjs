'use strict';
// An isolated workspace and a browser bridge fixture; never touches user saves.
// Native menu authorization/lifecycle are covered in desktop/test/fishing.test.js.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-desktop-bait');fs.mkdirSync(out,{recursive:true});
const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'qa_credit',amount:1000,updatedAt:1};F.buyBait(ws,'dough',2);F.buyBait(ws,'prawn',1);
const host=`
const ws=${JSON.stringify(ws)};let receiver=null,action=null,latest=null;
window.qa={language:'zh',commands:[],visits:[],failSave:false};
window.TracerLocale={language:()=>qa.language};
window.Tracer={store:{data:ws,dirty:false,inflight:false,lost:false,timer:0},sections:[],ready:Promise.resolve(ws),currentSec:()=>'',onShow(){},touch(){this.store.dirty=true},saveNow(){if(qa.failSave)throw Error('offline');this.store.dirty=false;},garden:{refresh(){}},show(section){qa.visits.push(section)}};
window.TracerFishing={onAction(fn){action=fn;return()=>{}},update(value){latest={...value,nativeSessionId:'qa-native-'+value.sessionId};receiver?.(latest)}};
window.FishingBaitDesktop={onSnapshot(fn){receiver=fn;return()=>{}},send(message){qa.commands.push(message);if(message.type==='ready')receiver?.(latest);if(message.type==='context-menu')qa.menuBait=message.baitId;if(message.type==='retry-save')qa.choose('retry-save');}};
qa.choose=async(type,id=qa.menuBait)=>action({...latest,type,value:id});
qa.locale=language=>{qa.language=language;Tracer.fishing.refresh()};
`;
const html=fs.readFileSync(path.join(root,'skins/tracer/fishing-bait-desktop.html'),'utf8').replace('<body>','<body><button id="fishing-open" hidden></button>').replace('<script src="/fishing-bait-desktop.js">','<script src="/task-garden.js"></script><script src="/fishing-model.js"></script><script src="/qa-host.js"></script><script src="/fishing.js"></script><script src="/fishing-bait-desktop.js">');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  if(url.pathname==='/qa-host.js'){res.setHeader('Content-Type','text/javascript');res.end(host);return;}
  const target=path.resolve(root,'skins/tracer','.'+url.pathname);
  if(!target.startsWith(path.join(root,'skins/tracer')+path.sep)||!fs.existsSync(target)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.png')?'image/png':target.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(fs.readFileSync(target));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:320,height:208},deviceScaleFactor:2}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>document.querySelectorAll('.bait-name')[4]?.textContent==='灵藻香饵'&&[...document.images].every(i=>i.complete&&i.naturalWidth>1000));
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.bait-slot').count(),5);
    assert.equal(await page.locator('#bait-box').evaluate(el=>el.getBoundingClientRect().width),320);
    await page.screenshot({path:path.join(out,'bait-box.png'),omitBackground:true});
    const before=await page.evaluate(()=>Tracer.fishing.snapshot().tackle);
    await page.locator('[data-bait="prawn"]').click({button:'right'});assert.equal(await page.evaluate(()=>qa.menuBait),'prawn');
    assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().tackle.coins),before.coins,'right click only opens choices');
    await page.evaluate(()=>qa.choose('buy-bait'));
    assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().tackle.coins),before.coins-30);
    assert.equal(await page.locator('[data-bait="prawn"] .bait-count').textContent(),'× 20');
    await page.evaluate(()=>qa.choose('equip-bait'));assert.equal(await page.locator('[data-bait="prawn"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-bait="cutbait"]').click({button:'right'});await page.evaluate(()=>qa.choose('buy-equip-bait'));
    assert.equal(await page.locator('[data-bait="cutbait"] .bait-count').textContent(),'× 10');assert.equal(await page.locator('[data-bait="cutbait"]').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#box-message').textContent(),/已补充 10 份鱼饵并装备/);
    await page.screenshot({path:path.join(out,'bait-equipped.png'),omitBackground:true});
    await page.evaluate(()=>{qa.failSave=true;});await page.locator('[data-bait="lotusmeal"]').click({button:'right'});await page.evaluate(()=>qa.choose('buy-equip-bait'));
    await page.locator('#box-retry').waitFor();const saved=await page.evaluate(()=>Tracer.fishing.snapshot().tackle.coins);
    await page.screenshot({path:path.join(out,'bait-save-retry.png'),omitBackground:true});
    await page.evaluate(()=>{qa.failSave=false;});await page.locator('#box-retry').click();await page.waitForFunction(()=>!Tracer.fishing.snapshot().tackle.pendingSave);
    assert.equal(await page.evaluate(()=>Tracer.fishing.snapshot().tackle.coins),saved);assert.equal(await page.locator('[data-bait="lotusmeal"] .bait-count').textContent(),'× 10');
    await page.locator('[data-bait="earthworm"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.bait-slot:focus').getAttribute('data-bait'),'dough');
    await page.keyboard.press('Shift+F10');assert.equal(await page.evaluate(()=>qa.menuBait),'dough');
    await page.waitForTimeout(3150);
    for(const [language,size,name] of [['en',{width:320,height:208},'bait-box-en'],['zh',{width:272,height:177},'bait-box-small']]){
      await page.evaluate(lang=>qa.locale(lang),language);await page.setViewportSize(size);
      const overflow=await page.locator('.bait-slot').evaluateAll(cards=>cards.filter(card=>[...card.querySelectorAll('.bait-name,.bait-price')].some(el=>el.scrollWidth>el.clientWidth+1||el.getBoundingClientRect().right>card.getBoundingClientRect().right+1)).length);assert.equal(overflow,0);
      await page.screenshot({path:path.join(out,name+'.png'),omitBackground:true});
    }
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>qa.commands.at(-1).type),'close');assert.deepEqual(await page.evaluate(()=>qa.visits),[]);
    const pond=await browser.newPage({viewport:{width:304,height:208},deviceScaleFactor:2});pond.on('pageerror',e=>errors.push(e.message));
    const snapshot={language:'zh',accountScope:'guest',accountGeneration:0,accountRestoreId:'',nativeSessionId:'pond',desktopScale:1,sessionId:'',session:null,rod:F.catalog.rods[0],bait:F.catalog.baits[0],desktopPond:{pond:{id:'pond_starter',style:'meadow'},fish:[]}};
    await pond.addInitScript(s=>{window.qaCommands=[];window.FishingDesktop={send:message=>qaCommands.push(message),onSnapshot:fn=>{setTimeout(()=>fn(s),100);return()=>{}},onMenuAction:()=>()=>{}};},snapshot);
    await pond.goto('http://127.0.0.1:'+server.address().port+'/fishing-desktop.html');await pond.waitForFunction(()=>qaCommands.some(x=>x.type==='input-regions'));
    const model=await pond.locator('#fishing-tools').boundingBox(),water=await pond.locator('#fishing-pond').boundingBox();
    assert(model.x>water.x+water.width/2&&model.y>water.y+water.height/2,'bait model sits at the lower-right bank');
    assert(model.x+model.width<=304&&model.y+model.height<=208,'model stays inside native pointer surface');
    await pond.locator('#fishing-tools').click();assert.equal(await pond.evaluate(()=>qaCommands.at(-1).type),'open-bait-box');
    await pond.locator('#fishing-tools').click({button:'right'});assert.equal(await pond.evaluate(()=>qaCommands.at(-1).type),'open-bait-box');
    await pond.screenshot({path:path.join(out,'desktop-entrance.png'),omitBackground:true});
    for(const scale of [.5,1,2.5]){
      await pond.setViewportSize({width:Math.round(304*scale),height:Math.round(208*scale)});
      const edge=await pond.locator('#fishing-tools').boundingBox();assert(edge.x>=0&&edge.y>=0&&edge.x+edge.width<=Math.round(304*scale)+1&&edge.y+edge.height<=Math.round(208*scale)+1);
      await pond.locator('#fishing-tools').click({button:'right'});assert.equal(await pond.evaluate(()=>qaCommands.at(-1).type),'open-bait-box');
    }
    await pond.setViewportSize({width:304,height:208});
    await pond.evaluate(()=>{document.getElementById('fishing-status').hidden=false;document.getElementById('fishing-reel').hidden=false;});
    const status=await pond.locator('#fishing-status').boundingBox(),chest=await pond.locator('#fishing-tools').boundingBox();
    assert(status.x+status.width<chest.x,'bait box does not cover the reeling status');
    const layout=await browser.newPage({viewport:{width:664,height:234},deviceScaleFactor:2});
    await layout.addInitScript(s=>{window.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.colorScheme='normal';});window.FishingDesktop={send(){},onSnapshot:fn=>{setTimeout(()=>fn(s),150);return()=>{}},onMenuAction:()=>()=>{}};},snapshot);
    await layout.setContent('<html><body style="margin:0;background:radial-gradient(ellipse at 15% 10%,#d1d0bf,#b7baa9);overflow:hidden"><iframe title="紧凑饵料盒" src="http://127.0.0.1:'+server.address().port+'/" style="position:absolute;left:12px;top:10px;width:320px;height:208px;border:0"></iframe><iframe title="鱼塘右下角饵料盒" src="http://127.0.0.1:'+server.address().port+'/fishing-desktop.html" style="position:absolute;left:338px;top:10px;width:304px;height:208px;border:0"></iframe></body></html>');
    await layout.frameLocator('iframe').first().locator('.bait-name').last().waitFor();
    await layout.frameLocator('iframe').last().locator('#fishing-pond canvas').waitFor();await layout.waitForTimeout(500);
    await layout.screenshot({path:path.join(out,'compact-layout.png')});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({errors,checks:['five sprites','right click','buy','equip','buy and equip','save retry without duplicate charge','keyboard menu','English','small window','no main-app navigation','pond model button','320x208 native-size layout','lower-right placement','50%-250% pond scaling','no reeling status overlap'],coinsAfter:saved},null,2));
    console.log('Desktop bait box: visual, purchase, equipment, save retry, keyboard, localization and pond launcher checks passed.');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
