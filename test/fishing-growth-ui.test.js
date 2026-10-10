'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const viewSource=fs.readFileSync(require.resolve('../skins/tracer/fishing-view.js'),'utf8'),controllerSource=fs.readFileSync(require.resolve('../skins/tracer/fishing.js'),'utf8');

function viewFixture(section){
  const ws=M.emptyWorkspace();F.ensure(ws);let html='';const pondUpdates=[],aquariumUpdates=[],feeds=[],artCalls=[];
  const page={className:'',querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},remove(){},contains:()=>true};
  Object.defineProperty(page,'innerHTML',{get:()=>html,set:value=>{html=value;}});
  page.querySelector=selector=>selector==='#fishing-pond-canvas'&&html.includes('id="fishing-pond-canvas"')?{className:'',replaceWith(){}}:selector==='[data-aquarium-display]'&&html.includes('data-aquarium-display')?{replaceWith(){}}:null;
  const doc={activeElement:null,createElement:()=>page},host={ownerDocument:doc,append(){}};
  const player=updates=>({update:value=>updates.push(value),feed:value=>feeds.push(value),destroy(){}});
  const root={TracerFishingModel:F,TracerFishingArt:{escape:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),fishMarkup:(fish,options)=>{artCalls.push({fish,options});return '<svg data-species="'+fish.id+'"></svg>'},createPond:()=>player(pondUpdates)},TracerFishingRewards:{markup:()=>''},TracerFishingAquariumArt:{create:()=>player(aquariumUpdates)}};
  vm.runInNewContext(viewSource,{window:root,Date,CSS:{escape:String}});const view=root.TracerFishingView.create(host,{section});
  const state=F.read(ws),snapshot={state,economy:F.economy(ws),showcase:F.aquarium(ws),language:'en',busy:false};
  return{state,view,feeds,artCalls,update:extra=>view.update({...snapshot,...extra}),get html(){return html;}};
}
const resident=(id,fishId,growth,pondId=null)=>({id,fishId,growth,pondId,releasedAt:null,fedAt:null});

test('pond residents and nursery show real growth stages, different sizes and mature form details',()=>{
  const f=viewFixture('ponds'),pondId=f.state.activePondId;
  f.state.fry.push(resident('young-koi','koi',5,pondId),resident('grown-ray','dreamray',100,pondId),resident('nursery-koi','koi',100));
  f.update();
  assert.match(f.html,/<article[^>]*data-fry-id="young-koi"[^>]*data-growth-stage="fry"[^>]*--fish-growth-scale:0.667/);
  assert.match(f.html,/<article[^>]*data-fry-id="grown-ray"[^>]*data-growth-stage="adult"[^>]*--fish-growth-scale:1.18/);
  assert(f.artCalls.some(call=>call.fish.id==='dreamray'&&call.fish.growth===100&&call.options.scaleGrowth===false));assert(f.artCalls.some(call=>call.fish.id==='koi'&&call.fish.growth===5&&call.options.scaleGrowth===false));
  assert.match(f.html,/aria-valuenow="100"/);assert.match(f.html,/At 100%: larger size/);
  const ray=F.growthAppearance(F.catalog.fish.find(fish=>fish.id==='dreamray'),100);assert(f.html.includes(ray.formName[1]));assert(f.html.includes(ray.actionName[1]));assert(f.html.includes(ray.description[1]));
  assert.match(f.html,/<article[^>]*data-fry-id="nursery-koi"[^>]*data-growth-stage="adult"/);
  assert.match(f.html,/data-fishing-action="harvest-fish" data-value="grown-ray"/);
  assert.match(f.html,/data-fishing-action="harvest-fish" data-value="nursery-koi"/);
  assert.doesNotMatch(f.html,/data-fishing-action="harvest-fish" data-value="young-koi"|archive-request|已珍藏|POND COLLECTION/);
  f.update({language:'zh'});assert(f.html.includes('成长 100%'));assert(f.html.includes('已成年'));assert(f.html.includes(ray.formName[0]));
});

test('legendary residents and returned nursery fish retain their adult form and unlocked move',()=>{
  const f=viewFixture('cabin'),dragon=resident('dragon-resident','dragonkoi',100),moon=resident('moon-nursery','galaxywhale',55);
  f.state.fry.push(dragon,moon);f.state.aquarium={fryIds:[dragon.id],updatedAt:0};f.update();
  const look=F.growthAppearance(F.catalog.fish.find(fish=>fish.id==='dragonkoi'),100);
  assert.match(f.html,/<article[^>]*data-fry-id="dragon-resident"[^>]*data-growth-stage="adult"/);assert(f.html.includes(look.formName[1]));assert(f.html.includes(look.actionName[1]));
  assert.match(f.html,/<article[^>]*data-fry-id="moon-nursery"[^>]*data-growth-stage="juvenile"/);
  assert.match(f.html,/data-fishing-action="harvest-fish" data-value="dragon-resident"/);
  assert.doesNotMatch(f.html,/data-fishing-action="harvest-fish" data-value="moon-nursery"/);
  f.state.aquarium.fryIds=[];f.update({notice:'Returned'});assert.match(f.html,/<article[^>]*data-fry-id="dragon-resident"[^>]*data-growth-stage="adult"/);assert(f.html.includes(look.formName[1]));
});

function stock(ws,id,bait){
  assert.equal(F.buyBait(ws,bait,1,1000).ok,true);assert.equal(F.equipBait(ws,bait,1001).ok,true);let seed=0;
  while(F.createSession(F.empty(),{baitId:bait,seed,now:1002}).fishId!==id){if(++seed>10000)throw Error('Unreachable fish '+id);}
  const {session}=F.beginCast(ws,{seed,now:1002});F.stepSession(session,{},900);F.stepSession(session,{release:true},0);assert.equal(F.commitCast(ws,session,1003).ok,true);
  for(let i=0;i<4000&&!['caught','escaped'].includes(session.phase);i++)F.stepSession(session,{hook:session.phase==='bite',holding:session.fishPosition>session.barPosition},16);
  assert.equal(session.phase,'caught');return F.recordCatch(ws,session,20000).fry;
}
async function controllerFixture(section='ponds',language='en'){
  const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'growth_ui_credit',amount:10000,updatedAt:1};
  let now=1000000;const feeds=[],timers=[],views=[];
  const store={data:ws,dirty:false,inflight:false,lost:false,timer:0},node={textContent:'',addEventListener(){}};
  const viewStub={create(){const view={update(){},feed:value=>feeds.push(value),destroy(){}};views.push(view);return view;}};
  const window={TracerFishingModel:{...F,feedPond:(workspace,id)=>F.feedPond(workspace,id,now),feedAquarium:workspace=>F.feedAquarium(workspace,now)},TracerAccount:{scope:'growth',context:{generation:1,restoreId:''},locked:false,switching:false},Tracer:{store,ready:Promise.resolve(ws),sections:[],currentSec:()=>section,onShow(){},touch(){store.dirty=true;},saveNow(){store.dirty=false;},garden:{refresh(){}}},addEventListener(){}};
  vm.runInNewContext(controllerSource,{window,document:{hidden:false,getElementById:()=>node,addEventListener(){}},TracerFishingView:viewStub,TracerLocale:{language:()=>language},performance:{now:()=>now},Date:class extends Date{static now(){return now;}},setInterval:()=>1,clearInterval(){},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}});
  for(let i=0;i<12;i++)await Promise.resolve();
  return{ws,store,window,feeds,snapshot:()=>window.Tracer.fishing.snapshot(),action:(...args)=>window.Tracer.fishing.action(...args),advance:ms=>{now+=ms;},runTimeouts(){while(timers.length)timers.shift()();}};
}

test('saved feeding announces the fish, larger adult form and new move once, and forwards maturation IDs',async()=>{
  const f=await controllerFixture(),fry=stock(f.ws,'koi','grain'),pondId=F.read(f.ws).activePondId;
  F.placeFry(f.ws,fry.id,pondId,21000);f.ws.fishing.fry.find(fish=>fish.id===fry.id).growth=90;
  const result=await f.action('feed-pond',pondId);assert.equal(result.ok,true);assert.deepEqual(result.grownFishIds,[fry.id]);
  const look=F.growthAppearance(F.catalog.fish.find(fish=>fish.id==='koi'),100),notice=f.snapshot().notice;
  assert(notice.includes(F.catalog.fish.find(fish=>fish.id==='koi').name[1]));assert(notice.includes('100%'));assert(notice.includes('Larger adult forms'));assert(notice.includes(look.formName[1]));assert(notice.includes(look.actionName[1]));
  assert.deepEqual(Array.from(f.feeds[0].grownFishIds),[fry.id]);assert.equal(f.feeds[0].maturation[0].id,fry.id);assert.equal(f.feeds[0].reactions[0].id,fry.id);
  f.runTimeouts();f.advance(60001);await f.action('feed-pond',pondId);assert.equal(f.snapshot().notice,'Fed! Watch how each fish responds.');assert.deepEqual(Array.from(f.feeds.at(-1).grownFishIds),[]);
});

test('aquarium maturity feedback waits for a successful save retry and stale delayed effects stop at account change',async()=>{
  const f=await controllerFixture('cabin','zh'),fry=stock(f.ws,'dragonkoi','spirit');F.placeAquariumFish(f.ws,fry.id,true,21000);f.ws.fishing.fry.find(fish=>fish.id===fry.id).growth=90;
  const save=f.window.Tracer.saveNow;f.window.Tracer.saveNow=()=>{};
  assert.equal(await f.action('feed-aquarium'),null);assert.equal(f.feeds.length,0);assert(f.snapshot().error);assert.equal(f.snapshot().notice,'');
  f.window.Tracer.saveNow=save;await f.action('retry-save');assert.equal(f.feeds.length,1);assert(f.snapshot().notice.includes(F.catalog.fish.find(fish=>fish.id==='dragonkoi').name[0]));assert(f.snapshot().notice.includes('体型变大'));assert(f.snapshot().notice.includes('新动作'));
  assert.deepEqual(Array.from(f.feeds[0].grownFishIds),[fry.id]);f.window.TracerAccount.context.generation++;f.runTimeouts();assert.equal(f.feeds.length,1,'old growth effects do not feed a view after its account changed');
});
