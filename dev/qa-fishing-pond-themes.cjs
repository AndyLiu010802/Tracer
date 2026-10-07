'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=fs.mkdtempSync(path.join(root,'.cache/pond-themes-'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};window.FishingDesktop={onSnapshot(fn){window.pushPond=fn;return()=>{};},send(v){(window.commands||=[]).push(v);}};});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://pond.test')return route.abort();if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fishing-scene.css"><style>body{margin:0;background:#253b37;color:#f1e4c7;font:16px system-ui;display:grid;grid-template-columns:repeat(3,400px)}section{height:420px;position:relative}h2{position:absolute;bottom:0;left:24px;font-size:18px}section div{height:390px}</style>'+['meadow','lily','coral','crystal','moon','cloud'].map(s=>'<section><div id="'+s+'"></div><h2>'+s+'</h2></section>').join('')+['fishing-model','fishing-lighting','fishing-art'].map(f=>'<script src="/'+f+'.js"></script>').join('')});const file=path.resolve(assets,'.'+u.pathname);if(!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({path:file});});
 await page.goto('http://pond.test');
 const themes=await page.evaluate(()=>{
  const F=TracerFishingModel;
  return F.catalog.pondStyles.map(style=>{const ws={},host=document.getElementById(style.id);F.read(ws);const model=F.read(ws),pond=model.ponds[0];F.selectPondStyle(ws,pond.id,style.id);const stored=F.read(ws).ponds[0];const player=TracerFishingArt.createPond(host,{pond:stored,fish:[F.catalog.fish[8],F.catalog.fish[9]],zoom:1.20});return{id:style.id,kind:player.kind,fish:host.dataset.fishCount,shadows:host.dataset.shadows};});
 });
 assert(themes.every(t=>t.kind==='webgl'&&t.fish==='2'&&t.shadows==='pcf'));await page.screenshot({path:path.join(out,'six-themes.png')});
 await page.setViewportSize({width:608,height:416});await page.goto('http://pond.test/fishing-desktop.html');
 await page.addScriptTag({url:'http://pond.test/fishing-model.js'});
 await page.evaluate(()=>{const fish=TracerFishingModel.catalog.fish[8];window.state={language:'zh',session:{phase:'idle'},rod:{id:'bamboo'},desktopScale:2,desktopPond:{pond:{id:'test',style:'coral'},fish:[{...fish,id:'fry-test',speciesId:fish.id,growth:40}]}};pushPond(state);});
 assert.equal(await page.locator('#fishing-pond').getAttribute('data-fish-count'),'1');
 await page.screenshot({path:path.join(out,'desktop-coral-200.png')});
 await page.evaluate(()=>{pushPond({...state,desktopPond:{pond:{id:'next',style:'moon'},fish:[]}});});assert.equal(await page.locator('#fishing-pond').getAttribute('data-fish-count'),'0');
 await page.locator('#fishing-pond').click({button:'right'});assert((await page.evaluate(()=>commands)).some(v=>v.type==='context-menu'));
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,themes,errors},null,2));console.log(JSON.stringify({out,themes}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
