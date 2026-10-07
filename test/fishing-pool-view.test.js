'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const source=fs.readFileSync(require.resolve('../skins/tracer/fishing-view.js'),'utf8');
function fixture(section='tackle'){
  const ws=M.emptyWorkspace();F.ensure(ws);ws.taskGarden.market.testCredit={id:'pool_view_test',amount:10000,updatedAt:1};
  const listeners=new Map(),actions=[],previews=[];
  const page={innerHTML:'',className:'',append(){},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>true,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),remove(){}};
  const doc={activeElement:null,createElement:()=>page},host={ownerDocument:doc,append(){}};
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root={TracerFishingModel:F,TracerFishingArt:{escape,rodMarkup:rod=>{previews.push(rod.id);return '<svg class="fishing-rod-art" data-preview-id="'+rod.id+'"></svg>';}}};
  vm.runInNewContext(source,{window:root,Date,CSS:{escape},console});
  const view=root.TracerFishingView.create(host,{section,onAction:(...args)=>actions.push(args)});
  const snapshot=()=>({state:F.read(ws),economy:F.economy(ws),language:'en',busy:false});
  function update(extra={}){previews.length=0;view.update({...snapshot(),...extra});}
  function click(action,value){
    const buttons=[...page.innerHTML.matchAll(/<button\b([^>]*)>/g)].map(([,attrs])=>({action:attrs.match(/data-fishing-action="([^"]*)"/)?.[1],value:attrs.match(/data-value="([^"]*)"/)?.[1],disabled:/\bdisabled\b/.test(attrs)}));
    const match=buttons.find(button=>button.action===action&&(value===undefined||button.value===value));assert(match,'Visible button '+action+' / '+value);
    const node={disabled:match.disabled,dataset:{fishingAction:match.action,value:match.value},closest:()=>node};listeners.get('click')({target:node});
  }
  return{ws,page,view,actions,previews,update,click};
}

test('selecting a collection changes its preview, purchase target and independent guarantee counters',()=>{
  const f=fixture();for(let i=0;i<9;i++)F.buyBox(f.ws,{poolId:'basic',now:100+i,random:()=>0});f.update();
  assert.match(f.page.innerHTML,/data-rod-pool="basic"/);assert.match(f.page.innerHTML,/Epic or better within 1 boxes/);
  f.click('select-pool','myriad');assert.match(f.page.innerHTML,/data-rod-pool="myriad"/);assert.match(f.page.innerHTML,/VOL\. 02/);assert.match(f.page.innerHTML,/20 rods/);assert.match(f.page.innerHTML,/Epic or better within 10 boxes/);
  assert(f.previews.every(id=>['willow','moon','astral','walnut','candlewyrm','sunforge'].includes(id)));
  f.click('buy-box');assert.deepEqual(JSON.parse(JSON.stringify(f.actions.at(-1).slice(0,2))),['buy-box','myriad']);
  f.update({language:'zh'});assert.match(f.page.innerHTML,/万象秘藏/);assert.match(f.page.innerHTML,/最多再开 10 盒/);assert.match(f.page.innerHTML,/data-rod-pool="myriad"/);
  f.click('select-pool','basic');assert.match(f.page.innerHTML,/最多再开 1 盒/);
});

test('unrevealed secrets never reach the art renderer, title or description in either collection',()=>{
  for(const section of ['tackle','rods']){
    const f=fixture(section);f.update();if(section==='tackle')f.view.selectPool('myriad');
    assert(!f.previews.includes('golden'));assert(!f.previews.includes('eclipse'));
    for(const rod of F.catalog.rods.filter(r=>r.hidden)){assert(!f.page.innerHTML.includes(rod.name[0]));assert(!f.page.innerHTML.includes(rod.name[1]));assert(!f.page.innerHTML.includes(rod.effectDescription[1]));}
    if(section==='rods'){
      assert.equal((f.page.innerHTML.match(/data-hidden-reward/g)||[]).length,2);
      f.click('select-rod-pool','myriad');const grid=f.page.innerHTML.split('<div class="fishing-rod-grid">')[1];
      assert.equal((grid.match(/<article\b/g)||[]).length,20);assert.equal((grid.match(/data-hidden-reward/g)||[]).length,1);assert(!grid.includes('data-preview-id="golden"'));
      f.click('open-pool','myriad');assert.equal(f.actions.at(-1)[1],'myriad');
      f.click('select-rod-pool','basic');const original=f.page.innerHTML.split('<div class="fishing-rod-grid">')[1];assert.equal((original.match(/<article\b/g)||[]).length,17);assert(!original.includes('data-preview-id="walnut"'));
    }
  }
});

test('a discovered new secret can be inspected and equipped while the other secret stays concealed',()=>{
  const f=fixture('rods');F.buyBox(f.ws,{poolId:'myriad',now:100,random:()=>5450});f.update();
  assert(f.previews.includes('eclipse'));assert(!f.previews.includes('golden'));assert.match(f.page.innerHTML,/Myriad eclipse/);assert.equal((f.page.innerHTML.match(/data-hidden-reward/g)||[]).length,1);
  f.click('equip-rod','eclipse');assert.equal(f.actions.at(-1)[1],'eclipse');
  f.click('filter','owned');const grid=f.page.innerHTML.split('<div class="fishing-rod-grid">')[1];assert.equal((grid.match(/<article\b/g)||[]).length,2);assert(!grid.includes('data-hidden-reward'));
});

test('deep linking selects only a known collection and saving or an empty wallet prevents purchases',()=>{
  const f=fixture();assert.equal(f.view.selectPool('myriad'),true);f.update();assert.match(f.page.innerHTML,/data-rod-pool="myriad"/);
  const before=f.page.innerHTML;assert.equal(f.view.selectPool('missing'),false);assert.equal(f.page.innerHTML,before);
  f.update({busy:true});f.click('buy-box');assert.equal(f.actions.length,0);
  f.update({economy:{balance:99}});f.click('buy-box');assert.equal(f.actions.length,0);
  f.update();f.click('buy-box');assert.equal(f.actions.at(-1)[1],'myriad');
});
