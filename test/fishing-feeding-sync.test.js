'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function fixture({fallback=false}={}){
  const updates=[],feeds=[],nodes=[],figures=[];let now=100000;
  const doc={createElement(){const node={ownerDocument:doc,dataset:{},style:{},children:[],setAttribute(){},appendChild(child){this.children.push(child);return child;},querySelector(){return fallback?doc.createElement():null;},after(){},remove(){}};nodes.push(node);return node;}};
  const host=doc.createElement(),renderer={update(value){const {onBoundsChange,...snapshot}=value;updates.push(structuredClone(snapshot));},feed(value){feeds.push(structuredClone(value));},destroy(){}};
  const root={TracerFishingArt:{escape:String,createAquarium:()=>fallback?null:renderer,createFishFigure(_host,{fish}){const figure={fish,updates:[],destroyed:0,update(value){this.updates.push(structuredClone(value));},destroy(){this.destroyed++;}};figures.push(figure);return figure;}},TracerFishingModel:{catalog:{aquariumDecorations:[]}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/fishing-aquarium.js'),'utf8'),{window:root,Date:{now:()=>now}});
  const player=root.TracerFishingAquariumArt.create(host),fish=(growth,fedAt,updatedAt=fedAt)=>({id:'resident',speciesId:'crownray',rarity:'legendary',growth,fedAt,updatedAt});
  const update=(growth,fedAt,view={},extra={})=>player.update({fish:[fish(growth,fedAt)],selection:{decorationIds:[]},...extra},'en',view);
  return{updates,feeds,figures,player,update,fish,root,setNow:value=>now=value};
}

test('aquarium infers a mature celebration from a fresh feeding and never replays it after turning',()=>{
  const f=fixture();f.update(99,30000);assert.equal(f.updates.at(-1).feeding,undefined);
  f.update(100,100000);assert.deepEqual(f.updates.at(-1).feeding,{at:100000,fishIds:['resident'],grownFishIds:['resident']});
  const count=f.updates.length;f.update(100,100000);assert.equal(f.updates.length,count);
  f.update(100,100000,{yaw:15});assert.equal(f.updates.at(-1).feeding,undefined);assert.equal(f.updates.at(-1).aquariumYaw,15);
  f.player.destroy();
});

test('aquarium forwards an initial recent feed without celebrating an already grown fish',()=>{
  const f=fixture();f.update(100,100000);assert.deepEqual(f.updates.at(-1).feeding.grownFishIds,[]);
  f.update(99,30000);assert.equal(f.updates.at(-1).fish[0].growth,99);assert.equal(f.updates.at(-1).feeding,undefined);
  f.update(100,100000);assert.equal(f.updates.at(-1).feeding,undefined,'a stale snapshot never rewinds growth or receipt history');f.player.destroy();
});

test('aquarium resets feeding history across account, generation and restore contexts',()=>{
  for(const changed of [{accountScope:'other'},{accountGeneration:2},{accountRestoreId:'restore-b'}]){
    const f=fixture(),account={accountScope:'active',accountGeneration:1,accountRestoreId:'restore-a'};
    f.update(99,30000,account);f.update(100,100000,{...account,...changed});
    assert.deepEqual(f.updates.at(-1).feeding.grownFishIds,[],'a different account starts with a resident baseline');f.player.destroy();
  }
  const f=fixture();f.root.TracerAccount={scope:'active',context:{generation:1,restoreId:'a'}};f.update(99,30000);
  f.root.TracerAccount.context.restoreId='b';f.update(100,100000);assert.deepEqual(f.updates.at(-1).feeding.grownFishIds,[]);f.player.destroy();
});

test('explicit aquarium feeds mark the same per-resident receipt before snapshots arrive',()=>{
  const f=fixture();f.update(99,30000);f.player.feed({at:100000,fishIds:['resident'],grownFishIds:['resident']});
  f.player.feed({at:100000,fishIds:['resident'],grownFishIds:['resident']});f.update(100,100000);assert.equal(f.feeds.length,1,'the same explicit feeding receipt plays once');assert.equal(f.updates.at(-1).feeding,undefined);
  f.update(100,100001);assert.deepEqual(f.updates.at(-1).feeding.grownFishIds,[],'later adult feeds retain ordinary reactions');f.player.destroy();
});

test('old feeds and newly placed adult residents do not produce maturity effects',()=>{
  const f=fixture();f.update(99,30000);f.update(100,94000);assert.equal(f.updates.at(-1).feeding,undefined);
  f.player.update({fish:[],selection:{decorationIds:[]}},'en');f.update(100,100000);assert.deepEqual(f.updates.at(-1).feeding.grownFishIds,[]);f.player.destroy();
});


test('fallback aquarium resumes an explicit maturity celebration after the committed growth snapshot rebuilds its figures',()=>{
  const f=fixture({fallback:true});f.update(80,30000);const first=f.figures[0],event={at:100000,fishIds:['resident'],grownFishIds:['resident']};
  f.player.feed(event);assert.deepEqual(first.updates.at(-1).feeding,event);
  f.setNow(100400);f.update(100,99999);const grown=f.figures.at(-1);
  assert.equal(first.destroyed,1);assert.equal(grown.fish.growth,100);assert.deepEqual(grown.updates.at(-1).feeding,event,'the same event keeps its original at and grown resident');
  f.player.feed(event);assert.equal(grown.updates.length,1,'the controller retry does not restart the same event');
  f.setNow(105000);f.update(100,99999,{yaw:15});assert.equal(f.figures.at(-1).updates.length,0,'expired events do not follow later figure rebuilds');f.player.destroy();
});

test('fallback aquarium clears an active maturity event when its account context changes',()=>{
  const f=fixture({fallback:true}),account={accountScope:'active',accountGeneration:1,accountRestoreId:'a'};
  f.update(80,30000,account);f.player.feed({at:100000,fishIds:['resident'],grownFishIds:['resident']});f.setNow(100400);
  f.update(100,99999,{...account,accountRestoreId:'b'});const changed=f.figures.at(-1);
  assert.deepEqual(changed.updates.at(-1).feeding.grownFishIds,[],'the new context only resumes its own ordinary recent feeding');assert.equal(changed.updates.at(-1).feeding.at,99999);f.player.destroy();
});
