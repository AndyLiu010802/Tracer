'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model');
const source=fs.readFileSync(require.resolve('../skins/tracer/fishing-view.js'),'utf8');

function fixture(section='cabin'){
  const workspace=M.emptyWorkspace();F.ensure(workspace);
  const players=[],pondPlayers=[],listeners=new Map();let html='',mount=null,pondMount=null;
  const page={className:'',append(){},contains:()=>true,querySelector:selector=>selector==='[data-aquarium-display]'?mount:selector==='#fishing-pond-canvas'?pondMount:null,querySelectorAll:()=>[],
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),remove(){mount=null;}};
  Object.defineProperty(page,'innerHTML',{get:()=>html,set(value){html=value;mount=value.includes('data-aquarium-display')?{replaceWith(retained){mount=retained;}}:null;pondMount=value.includes('id="fishing-pond-canvas"')?{replaceWith(retained){pondMount=retained;}}:null;}});
  const doc={activeElement:null,createElement:()=>page},host={ownerDocument:doc,append(){}};
  const root={TracerFishingModel:F,TracerFishingArt:{escape:String,fishMarkup:()=>'<svg></svg>'},TracerFishingRewards:{markup:()=>''},
    TracerFishingAquariumArt:{create(host){const player={host,updates:[],destroyed:0,update(value,language){this.updates.push({value:structuredClone(value),language});},destroy(){this.destroyed++;}};players.push(player);return player;}}};
  root.TracerFishingArt.createPond=(host,settings)=>{const player={host,settings,updates:[],destroyed:0,update(value){this.settings=value;this.updates.push(value);},destroy(){this.destroyed++;}};pondPlayers.push(player);return player;};
  vm.runInNewContext(source,{window:root,Date,CSS:{escape:String}});
  const view=root.TracerFishingView.create(host,{section});
  const snapshot=()=>({state:F.read(workspace),economy:F.economy(workspace),showcase:F.aquarium(workspace),language:'en',busy:false});
  const update=extra=>view.update({...snapshot(),...extra});
  const disabled=action=>{const match=html.match(new RegExp('<button[^>]*data-fishing-action="'+action+'"[^>]*>'));assert(match);return /\bdisabled\b/.test(match[0]);};
  return{view,players,pondPlayers,page,update,disabled,snapshot,get mount(){return mount;},get pondMount(){return pondMount;}};
}

test('cast and save controls update without rebuilding the live aquarium GPU context',()=>{
  const f=fixture();f.update();const canvasHost=f.mount,player=f.players[0];
  assert.equal(f.disabled('manage-aquarium'),false);
  for(const status of [{busy:true},{busy:false,loadoutLocked:true},{busy:false,loadoutLocked:false},{busy:true,error:'Save pending'},{busy:false,notice:'Saved'}]){
    f.update(status);assert.equal(f.mount,canvasHost);assert.equal(f.players.length,1);assert.equal(player.destroyed,0);
    assert.equal(f.disabled('manage-aquarium'),!!(status.busy||status.loadoutLocked));
    assert.equal(f.disabled('edit-aquarium-decor'),!!(status.busy||status.loadoutLocked));
  }
  f.view.destroy();assert.equal(player.destroyed,1,'leaving the view releases its GPU context');
});

test('retained aquarium receives changed residents, decorations and language and clears old residents',()=>{
  const f=fixture();f.update();const player=f.players[0],canvasHost=f.mount;
  const showcase={fish:[{id:'resident-a',speciesId:'dragonkoi',rarity:'legendary'}],selection:{decorationIds:['moon_crystal']}};
  f.update({showcase,notice:'Resident moved in',language:'zh'});
  assert.deepEqual(player.updates.at(-1),{value:showcase,language:'zh'});assert.equal(f.mount,canvasHost);
  f.update({showcase:{fish:[],selection:{decorationIds:[]}},notice:'Resident returned',language:'en'});
  assert.deepEqual(player.updates.at(-1),{value:{fish:[],selection:{decorationIds:[]}},language:'en'});
  assert.equal(f.players.length,1);f.view.destroy();assert.equal(player.destroyed,1);
});

test('busy pond controls preserve the live pond and only changed visual state reaches its renderer',()=>{
  const f=fixture('ponds');f.update();const player=f.pondPlayers[0],canvasHost=f.pondMount;
  for(const busy of [true,false,true,false]){f.update({busy});assert.equal(f.pondMount,canvasHost);assert.equal(f.pondPlayers.length,1);assert.equal(player.destroyed,0);assert.equal(f.disabled('edit-decorations'),busy);}
  assert.equal(player.updates.length,0,'button-only updates do not synchronously redraw the pond');
  const state=f.snapshot().state,pond=state.ponds[0];pond.styleId=F.catalog.pondStyles[1].id;
  state.fry.push({id:'nursery-ray',fishId:'dreamray',pondId:pond.id,releasedAt:null,growth:30,fedAt:null});
  f.update({state});assert.equal(f.pondMount,canvasHost);assert.equal(player.updates.length,1);
  assert.equal(player.settings.pond.style,F.catalog.pondStyles[1].style);assert.equal(player.settings.fish[0].id,'nursery-ray');
  assert.equal(player.settings.fish[0].speciesId,'dreamray');
  f.update({state,notice:'Pond saved'});assert.equal(player.updates.length,1);
  f.view.destroy();assert.equal(player.destroyed,1);
});

test('changing pond identity rebuilds once and does not reuse the previous fish or canvas',()=>{
  const f=fixture('ponds'),state=f.snapshot().state;state.ponds.push({...state.ponds[0],id:'second-pond'});
  f.update({state});const first=f.pondPlayers[0],firstHost=f.pondMount;
  f.view.selectPond('second-pond');assert.equal(first.destroyed,1);assert.equal(f.pondPlayers.length,2);
  const second=f.pondPlayers[1];assert.notEqual(f.pondMount,firstHost);assert.equal(second.settings.pond.id,'second-pond');
  f.update({state,busy:true});assert.equal(f.pondPlayers.length,2);assert.equal(second.destroyed,0);
  f.view.destroy();assert.equal(first.destroyed,1);assert.equal(second.destroyed,1);
});
