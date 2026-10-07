'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'skins/tracer'),out=fs.mkdtempSync(path.join(root,'.cache/fishing-shop-appearance-'));
const gifts=require('../public/fishing-model').catalog.gifts,frames=JSON.parse(fs.readFileSync(path.join(assets,'frame-catalog.json'),'utf8')),walls=JSON.parse(fs.readFileSync(path.join(assets,'wallpaper-catalog.json'),'utf8'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1400,height:1050},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({gifts,frames,walls})=>{
  window.calls=[];window.notices=[];window.fixtureGifts=gifts;window.fixtureFrames=frames;window.fixtureWalls=walls;
  const catalog=[...walls.map(x=>({...x,asset:x.asset?'/wallpapers/'+x.asset.split('/').pop():undefined})),...frames];
  const appearance={backgroundItemId:catalog.find(x=>x.type==='static').id,avatarFrameItemId:frames.find(x=>x.type==='avatarFrame').id,taskFrameItemId:null,materialItemId:null};
  const items=catalog.slice(0,-1).map(x=>({itemId:x.id}));window.collection={catalog,appearance,items,balance:5000,ledger:{purchases:items,appearance}};
  window.giftState={giftUnlocks:gifts,giftAppearance:{}};
  window.fixtureEquip=slot=>{giftState.giftAppearance[slot+'Id']=gifts.find(g=>g.slot===slot).id;TracerFishingRewards.apply(giftState);};
  window.TracerLocale={language:()=> 'zh'};
  window.TracerAccount={scope:'fixture-user',context:{user:{id:'fixture-user'},generation:0,restoreId:''},locked:false,switching:false,async api(action,input){
   calls.push({kind:'api',action,input});if(window.failAPI&&action!=='collection')throw new Error('network-test');
   if(action==='wallpaper-equip'){collection.appearance[input.slot+'ItemId']=input.itemId;}
   if(action==='wallpaper-purchase'&&!collection.items.some(i=>i.itemId===input.itemId))collection.items.push({itemId:input.itemId});
   collection.ledger={purchases:collection.items,appearance:collection.appearance};
   const response=structuredClone(action==='collection'?collection:{collection});
   if(window.switchDuringAPI&&action!=='collection'){TracerAccount.context.generation++;window.switchDuringAPI=false;}
   return response;
  }};
  window.Tracer={ready:Promise.resolve({}),store:{data:{taskGarden:{market:{}}},base:{taskGarden:{market:{}}}},garden:{refresh(){}},fishing:{snapshot:()=>({language:'zh'}),async action(action,slot){calls.push({kind:'gift',action,slot});if(window.failGift)return{ok:false};giftState.giftAppearance[slot+'Id']=null;TracerFishingRewards.apply(giftState);return{ok:true};}}};
  const inert=()=>({update(){},destroy(){}});
  window.TracerGardenCollectionArt={markup:()=>'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#abc"/></svg>'};
  window.TracerGardenCollectionShop=host=>{host.innerHTML='<div class="garden-collection-shop"><div class="garden-collect-status"></div><div class="garden-collect-goal"></div></div>';return inert();};
  window.TracerStickerShop=inert;window.TracerPostcards={shop:inert};window.TracerGardenMarketView={create:inert};window.TracerFishingView={create:inert};window.TracerFishingArt={rodMarkup:()=>'<svg></svg>'};
 },{gifts,frames,walls});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://appearance.test')return route.abort();if(u.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="zh" data-phase="night"><meta charset="utf-8">'+['account','skin','garden-store','fishing-rewards','wallpaper-shop','wallpaper-materials','material-contrast','frames'].map(f=>'<link rel="stylesheet" href="/'+f+'.css">').join('')+'<style>body{overflow:auto}.fixture{position:relative;z-index:2;background:#18231ded;color:#ebecd8;padding:30px;margin:15px;min-height:600px}.account-trigger{width:28px;height:28px}#garden{display:none}</style><header class="top"><button class="account-trigger">☾</button><span>真实商店外观控制 / isolated fixture</span></header><main id="account" class="fixture"></main><main id="garden" class="fixture"></main>'+['fishing-model','fishing-rewards','frames','wallpaper-motion','wallpaper-optics','wallpaper-shop','garden-store-view'].map(f=>'<script src="/'+f+'.js"></script>').join('')+'</html>'});const file=path.resolve(assets,'.'+u.pathname);if(!file.startsWith(assets+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({path:file});});
 await page.goto('http://appearance.test');
 await page.evaluate(async()=>{fixtureEquip('avatarFrame');fixtureEquip('background');await TracerWallpapers.mount(document.getElementById('account'),{flush:async()=>{},run:async fn=>{try{await fn();}catch(e){notices.push({message:e.message,error:true});}},notice:(message,type)=>notices.push({message,type})});});
 const clearCount=()=>page.evaluate(()=>calls.filter(c=>c.kind==='gift').length);
 const activate=async slot=>{await page.evaluate(slot=>fixtureEquip(slot),slot);await page.waitForFunction(slot=>TracerWallpapers.giftOverrides(slot),slot);};
 const useTab=async type=>{await page.locator('[data-wallpaper-filter="'+type+'"]').click();};
 assert.equal(await clearCount(),0,'mount/collection hydration never clears a gift');
 assert.equal(await page.locator('.wallpaper-opacity-preview').evaluate(n=>n.hidden),true,'owned mystery gift is not previewed in the shop');
 await page.locator('[data-wallpaper-opacity]').fill('31');assert.equal(await page.locator('#fishing-gift-background').evaluate(n=>n.style.opacity),'0.31');
 await page.evaluate(()=>TracerFishingRewards.apply(giftState));assert.equal(await page.locator('#fishing-gift-background').evaluate(n=>n.style.opacity),'0.31','hydration inherits the same opacity');
 await useTab('avatarFrame');assert.equal(await page.locator('#wallpaper-action').isEnabled(),true);assert.match(await page.locator('#wallpaper-action').textContent(),/应用/,'underlying owned frame can be reapplied while gift is active');
 await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>!document.documentElement.dataset.fishingAvatar);assert.equal(await clearCount(),1);
 assert.match(await page.locator('#wallpaper-action').textContent(),/正在使用/);
 await activate('avatarFrame');await page.evaluate(()=>{window.failAPI=true;});await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>notices.at(-1)?.message==='network-test');assert.equal(await clearCount(),1,'failed collection save cannot remove gift');await page.evaluate(()=>{window.failAPI=false;window.failGift=true;});
 await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>notices.at(-1)?.message.includes('礼包外观暂未能收起'));assert.equal(await page.locator('#wallpaper-action').isEnabled(),true);assert.equal(await page.locator('html').getAttribute('data-fishing-avatar'),'tide_crown');
 await page.evaluate(()=>{window.failGift=false;});await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>!document.documentElement.dataset.fishingAvatar);
 await activate('avatarFrame');const beforeSwitch=await clearCount();await page.evaluate(()=>{window.switchDuringAPI=true;});await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>notices.at(-1)?.message==='account-changed');assert.equal(await clearCount(),beforeSwitch,'generation change during save cannot clear the new scope');
 await useTab('material');const beforeMaterial=await clearCount();await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>document.documentElement.dataset.wallpaperMaterial);assert.equal(await clearCount(),beforeMaterial);assert.equal(await page.locator('html').getAttribute('data-fishing-background'),'sunken_library');
 await useTab('taskFrame');const missing=frames.at(-1);await page.locator('[data-wallpaper-id="'+missing.id+'"]').click();const beforePurchase=await clearCount();await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>document.querySelector('#wallpaper-action').textContent.includes('应用'));assert.equal(await clearCount(),beforePurchase,'purchase alone never changes either gift');await page.locator('#wallpaper-action').click();assert.equal(await clearCount(),beforePurchase,'task frame does not remove avatar gift');
 await page.evaluate(()=>TracerWallpapers.synchronize(collection));assert.equal(await clearCount(),beforePurchase,'ordinary synchronization is read only for gifts');
 await useTab('static');await page.locator('#wallpaper-action').click();await page.waitForFunction(()=>!document.documentElement.dataset.fishingBackground);assert.equal(await page.locator('#account-wallpaper').evaluate(n=>getComputedStyle(n).visibility),'visible');
 await activate('background');await page.getByRole('button',{name:'恢复默认背景',exact:true}).click();await page.waitForFunction(()=>!document.documentElement.dataset.fishingBackground);assert.equal(await page.evaluate(()=>collection.appearance.backgroundItemId),null);
 await activate('background');await page.evaluate(()=>{window.opticsSources=[];const original=TracerMaterialOptics.mount;TracerMaterialOptics.mount=(host,options)=>{opticsSources.push(options.imageURL);return original(host,options);};const glass=collection.catalog.find(i=>i.material==='glass');collection.appearance.materialItemId=glass.id;TracerWallpapers.synchronize(collection);});assert.match(await page.evaluate(()=>opticsSources.at(-1)),/gift-sunken_library/,'glass reflects the actual gift background');
 await page.screenshot({path:path.join(out,'account-shop-gift-coexistence.png'),fullPage:true});
 // The large garden store uses the same durable transition, through its real buttons.
 await page.evaluate(()=>{document.getElementById('account').remove();document.getElementById('garden').style.display='block';window.gardenView=TracerGardenStoreView(document.getElementById('garden'),()=>{});window.gardenState={language:'zh',economy:{balance:5000},wallpapers:collection.ledger,collectibles:{items:[]},stickers:{total:0},fishing:{}};gardenView.update(gardenState);gardenView.department('avatarFrames');});
 const firstFrame=frames.find(f=>f.type==='avatarFrame');await page.locator('.store-wall-card[data-wallpaper-id="'+firstFrame.id+'"]').waitFor();
 await activate('avatarFrame');assert.match(await page.locator('.store-wall-card[data-wallpaper-id="'+firstFrame.id+'"] .store-wall-price').textContent(),/已收藏/);await page.locator('.store-wall-card[data-wallpaper-id="'+firstFrame.id+'"]').click();assert.match(await page.locator('[data-store-action=wall-buy]').textContent(),/佩戴/);
 await page.evaluate(()=>{window.failGift=true;});await page.locator('[data-store-action=wall-buy]').click();await page.waitForFunction(()=>document.querySelector('.store-message')?.textContent.includes('礼包外观暂未能收起'));assert.equal(await page.locator('[data-store-action=wall-buy]').isEnabled(),true);assert.equal(await page.locator('html').getAttribute('data-fishing-avatar'),'tide_crown');
 await page.evaluate(()=>{window.failGift=false;});await page.locator('[data-store-action=wall-buy]').click();await page.waitForFunction(()=>!document.documentElement.dataset.fishingAvatar);assert.equal(await page.evaluate(()=>collection.appearance.avatarFrameItemId),firstFrame.id,'click restores the actual old frame, not null');
 await page.locator('[data-store-action=close]').click();await activate('avatarFrame');await page.locator('[data-store-action=default-avatarFrame]').click();await page.waitForFunction(()=>!document.documentElement.dataset.fishingAvatar);
 await page.screenshot({path:path.join(out,'garden-store-after-same-slot-change.png'),fullPage:true});await page.evaluate(()=>gardenView.destroy());
 assert.deepEqual(errors,[]);const report=await page.evaluate(()=>({calls,notices,giftAppearance:giftState.giftAppearance,appearance:collection.appearance}));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,...report,errors},null,2));console.log(JSON.stringify({out,passed:true,checks:'both real shops, no hydration clears, success/failure/retry, generation guard, normal purchase/task/material, opacity, current optics, no mystery previews',errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
