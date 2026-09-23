'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createLocalAccounts}=require('../lib/accounts'),W=require('../lib/account-wallpapers'),G=require('../public/task-garden'),M=require('../skins/tracer/model'),store=require('../lib/store'),catalog=require('../public/wallpaper-catalog.json');
const clone=x=>JSON.parse(JSON.stringify(x));
test('task frame text palettes keep readable contrast on their own surfaces',()=>{
  const luminance=hex=>{const rgb=hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  for(const item of require('../public/frame-catalog.json').filter(i=>i.type==='taskFrame'))for(const key of ['fg','muted','accent','danger','warning']){const a=luminance(item.palette.bg),b=luminance(item.palette[key]),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(contrast>=4.5,item.id+' '+key+' contrast '+contrast);}
});
function funded(n=40){const ws=M.emptyWorkspace();for(let i=0;i<n;i++){const t={id:'fund'+i,title:'Garden harvest',status:'doing',projectId:null,createdAt:100,updatedAt:100};ws.tasks.push(t);G.taskChanged(ws,t,100,k=>k===10000?1000:4);t.status='done';t.doneAt=t.updatedAt=101;G.taskChanged(ws,t,101);G.harvest(ws,t.id,102);}G.sell(ws,'peach',n,200);return ws;}
async function fixture(t,n=40){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tracer-wallpaper-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const a=createLocalAccounts(dir),one=await a.register({email:'wallpaper@example.com',password:'Test password 123',profile:{nickname:'Test'}}),data=a.directory(one.user.id);await store.writeStore(data,'workspace',JSON.stringify(funded(n)));return{a,one,data,dir};}
test('catalog has ten items per type and immutable prices match every persisted garden receipt',()=>{
  assert.equal(new Set(catalog.map(i=>i.id)).size,30);for(const type of ['static','dynamic','material'])assert.equal(catalog.filter(i=>i.type===type).length,10);
  for(const item of catalog){const ws=funded();ws.taskGarden.market.wallpapers={purchases:[{itemId:item.id,purchasedAt:300}],appearance:{backgroundItemId:null,materialItemId:null},updatedAt:300};assert.equal(G.economy(ws).balance,1200-item.price);assert.deepEqual(G.validate(ws.taskGarden).market.wallpapers,ws.taskGarden.market.wallpapers);}
});
test('purchase deducts once, survives restart, exports receipts and stays with one account',async t=>{
  const{a,one,data,dir}=await fixture(t);const results=await Promise.all([a.purchaseWallpaper(one.token,{itemId:'s01',price:0}),a.purchaseWallpaper(one.token,{itemId:'s01'})]);assert.equal(results.filter(r=>r.alreadyOwned).length,1);assert.equal(results[1].collection.balance,1120);assert.equal((await store.readStore(data,'workspace')).taskGarden.market.wallpapers.purchases.length,1);
  const restarted=createLocalAccounts(dir);assert.equal((await restarted.collection(one.token)).items[0].itemId,'s01');assert.equal((await restarted.exportData(one.token)).collection.balance,1120);
  const other=await a.register({email:'other@example.com',password:'Test password 123',profile:{nickname:'Other'}});assert.deepEqual((await a.collection(other.token)).items,[]);await assert.rejects(a.equipWallpaper(other.token,{slot:'background',itemId:'s01'}),{code:'wallpaper-not-owned'});
});
test('background and material slots are independent, resettable and reject unowned or mismatched items',async t=>{
  const{a,one}=await fixture(t);await a.purchaseWallpaper(one.token,{itemId:'s01'});await a.purchaseWallpaper(one.token,{itemId:'d01'});await a.purchaseWallpaper(one.token,{itemId:'m01'});
  await a.equipWallpaper(one.token,{slot:'background',itemId:'s01'});await a.equipWallpaper(one.token,{slot:'material',itemId:'m01'});const r=await a.equipWallpaper(one.token,{slot:'background',itemId:'d01'});assert.deepEqual(r.collection.appearance,{backgroundItemId:'d01',materialItemId:'m01'});
  await assert.rejects(a.equipWallpaper(one.token,{slot:'material',itemId:'s01'}),{code:'invalid-wallpaper'});await assert.rejects(a.equipWallpaper(one.token,{slot:'background',itemId:'s02'}),{code:'wallpaper-not-owned'});await assert.rejects(a.purchaseWallpaper(one.token,{itemId:'bogus'}),{code:'invalid-wallpaper'});
  const reset=await a.equipWallpaper(one.token,{slot:'background',itemId:null});assert.equal(reset.collection.appearance.backgroundItemId,null);assert.equal(reset.collection.appearance.materialItemId,'m01');assert.equal(reset.collection.items.length,3);
});
test('concurrent purchases cannot overspend and insufficient funds do not write receipts',async t=>{
  const{a,one,data}=await fixture(t,4);const r=await Promise.allSettled([a.purchaseWallpaper(one.token,{itemId:'s01'}),a.purchaseWallpaper(one.token,{itemId:'s02'})]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.code,'insufficient-coins');assert.equal((await a.collection(one.token)).balance,40);assert.equal((await store.readStore(data,'workspace')).taskGarden.market.wallpapers.purchases.length,1);
});
test('stale saves retain purchases and appearance; concurrent farm spending retries instead of overspending',async t=>{
  const{a,one,data}=await fixture(t,8),stale=await store.readStore(data,'workspace');await a.purchaseWallpaper(one.token,{itemId:'s01'});await a.equipWallpaper(one.token,{slot:'background',itemId:'s01'});
  await store.writeStore(data,'workspace',JSON.stringify(stale),(previous,next)=>{W.preserve(previous,next);G.preserve(previous,next);return next;});assert.equal((await a.collection(one.token)).balance,160);assert.equal((await a.collection(one.token)).appearance.backgroundItemId,'s01');
  const farm=clone(stale);assert.equal(G.buyFarm(farm,'cyber',400).ok,true);await assert.rejects(store.writeStore(data,'workspace',JSON.stringify(farm),(previous,next)=>{W.preserve(previous,next);G.preserve(previous,next);return next;}),{code:'workspace-stale'});assert.equal((await a.collection(one.token)).balance,160);
});
test('generic saves cannot mint wallpaper ownership and validated merges share garden spending',async t=>{
  const{a,one,data}=await fixture(t,8),ws=await store.readStore(data,'workspace');ws.taskGarden.market.wallpapers={purchases:[{itemId:'s01',purchasedAt:300}],appearance:{backgroundItemId:'s01',materialItemId:null},updatedAt:300};
  await store.writeStore(data,'workspace',JSON.stringify(ws),(previous,next)=>{W.preserve(previous,next);G.preserve(previous,next);return next;});assert.equal((await a.collection(one.token)).items.length,0);
  const base=funded(8),local=clone(base),remote=clone(base);local.taskGarden.market.wallpapers=clone(ws.taskGarden.market.wallpapers);G.buyFarm(remote,'cyber',400);const merged=G.merge(base.taskGarden,local.taskGarden,remote.taskGarden);assert.ok(G.economy({taskGarden:merged}).balance>=0);assert.equal(merged.market.wallpapers.purchases.length,1);assert.equal(merged.market.purchases.length,0);
});

test('frames use fixed receipt prices, preserve legacy ledgers and reject cross-slot ownership',async t=>{
  const frames=require('../public/frame-catalog.json');assert.equal(frames.length,12);assert.equal(new Set(frames.map(i=>i.id)).size,12);
  for(const item of frames){const ws=funded();const appearance={backgroundItemId:null,materialItemId:null,[item.type+'ItemId']:item.id};ws.taskGarden.market.wallpapers={purchases:[{itemId:item.id,purchasedAt:300}],appearance,updatedAt:300};assert.equal(G.economy(ws).balance,1200-item.price);assert.deepEqual(G.validate(ws.taskGarden).market.wallpapers.appearance,appearance);const wrong=clone(ws.taskGarden);wrong.market.wallpapers.appearance.backgroundItemId=item.id;assert.throws(()=>G.validate(wrong));}
  const {a,one,data,dir}=await fixture(t);const stale=await store.readStore(data,'workspace');
  await a.purchaseWallpaper(one.token,{itemId:'af01'});await a.purchaseWallpaper(one.token,{itemId:'tf02'});await a.purchaseWallpaper(one.token,{itemId:'m02'});
  for(const [slot,itemId]of [['avatarFrame','af01'],['taskFrame','tf02'],['material','m02']])await a.equipWallpaper(one.token,{slot,itemId});
  const r=await a.collection(one.token);assert.equal(r.balance,580);assert.equal(r.catalog.length,42);assert.deepEqual(r.appearance,{backgroundItemId:null,materialItemId:'m02',avatarFrameItemId:'af01',taskFrameItemId:'tf02'});
  for(const [slot,itemId]of [['background','af01'],['material','tf02'],['avatarFrame','tf02'],['taskFrame','af01'],['__proto__','af01']])await assert.rejects(a.equipWallpaper(one.token,{slot,itemId}),{code:'invalid-wallpaper'});
  await assert.rejects(a.equipWallpaper(one.token,{slot:'avatarFrame',itemId:'af02'}),{code:'wallpaper-not-owned'});
  await store.writeStore(data,'workspace',JSON.stringify(stale),(previous,next)=>{W.preserve(previous,next);G.preserve(previous,next);return next;});assert.deepEqual((await a.collection(one.token)).appearance,r.appearance);
  const restarted=createLocalAccounts(dir);assert.deepEqual((await restarted.exportData(one.token)).collection.appearance,r.appearance);
  const reset=await a.equipWallpaper(one.token,{slot:'taskFrame',itemId:null});assert.equal(reset.collection.appearance.materialItemId,'m02');assert.equal(reset.collection.appearance.avatarFrameItemId,'af01');assert.equal(reset.collection.appearance.taskFrameItemId,null);assert.equal(reset.collection.balance,580);
  const other=await a.register({email:'frames-other@example.com',password:'Test password 123',profile:{nickname:'Other'}});assert.deepEqual((await a.collection(other.token)).items,[]);
});

test('concurrent frame purchases cannot overspend or charge twice',async t=>{
  const{a,one}=await fixture(t,8);const r=await Promise.allSettled([a.purchaseWallpaper(one.token,{itemId:'af03'}),a.purchaseWallpaper(one.token,{itemId:'tf02'})]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.code,'insufficient-coins');const owned=(await a.collection(one.token)).items[0].itemId;await a.purchaseWallpaper(one.token,{itemId:owned,price:0});assert.equal((await a.collection(one.token)).balance,20);
});

test('all 42 decorations survive normalization and a legacy workspace merge',()=>{
  const ws=funded(400),all=catalog.concat(require('../public/frame-catalog.json'));ws.taskGarden.market.wallpapers={purchases:all.map(i=>({itemId:i.id,purchasedAt:300})),appearance:{backgroundItemId:'d01',materialItemId:'m01',avatarFrameItemId:'af06',taskFrameItemId:'tf06'},updatedAt:301};const garden=G.validate(ws.taskGarden);assert.equal(garden.market.wallpapers.purchases.length,42);const legacy=clone(garden);delete legacy.market.wallpapers.appearance.avatarFrameItemId;delete legacy.market.wallpapers.appearance.taskFrameItemId;legacy.market.wallpapers.updatedAt=300;const merged=G.merge(legacy,legacy,garden);assert.equal(merged.market.wallpapers.appearance.taskFrameItemId,'tf06');assert.equal(merged.market.wallpapers.appearance.avatarFrameItemId,'af06');assert.equal(merged.market.wallpapers.purchases.length,42);
});
