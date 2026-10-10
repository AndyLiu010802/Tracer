'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../public/fishing-model');
const source=fs.readFileSync(require.resolve('../skins/tracer/fishing-art'),'utf8');
function fixture(){
  let now=1000,nextTimer=1,timerStarts=0;const timers=new Map();
  const win={setTimeout(fn,delay){const id=nextTimer++;timerStarts++;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
  let doc;
  function element(tag='div'){
    const e={tag,className:'',dataset:{},children:[],ownerDocument:doc,style:{setProperty(key,value){this[key]=value;}},offsetWidth:1,
      setAttribute(){},getContext:()=>null,addEventListener(){},removeEventListener(){},appendChild(child){child.parent=this;this.children.push(child);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);},querySelectorAll(selector){return selector==='[data-fish-id]'?this.swimmers||[]:selector==='.is-grown'?(this.swimmers||[]).filter(row=>row.classList.contains('is-grown')):[];}};
    e.classList={contains:name=>e.className.split(/\s+/).includes(name),add(...names){e.className=[...new Set([...e.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove(...names){e.className=e.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');},toggle(name,force){const value=force===undefined?!this.contains(name):force;if(value)this.add(name);else this.remove(name);return value;}};
    Object.defineProperty(e,'innerHTML',{get:()=>e.html||'',set(value){e.html=value;e.firstElementChild=value.startsWith('<svg')?{style:{}}:null;e.swimmers=Array.from(value.matchAll(/<span class="fishing-fallback-swimmer"([^>]*)>/g),match=>{const row=element('span');row.className='fishing-fallback-swimmer';for(const name of ['fish-id','mature','growth-motion']){const part=match[1].match(new RegExp('data-'+name+'="([^\"]*)"'));if(part)row.dataset[name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=part[1];}return row;});}});
    return e;
  }
  doc={defaultView:win,baseURI:'https://example.test/',scripts:[],hidden:false,createElement:element,addEventListener(){},removeEventListener(){}};
  const context={TracerFishingModel:F,Date:{now:()=>now},URL};vm.runInNewContext(source,context);const host=()=>element();
  function advance(value){now=value;for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}
  return{Art:context.TracerFishingArt,host,advance,timers,get timerStarts(){return timerStarts;}};
}
const resident=(growth,id='resident')=>({...F.catalog.fish.find(f=>f.id==='gulpuffer'),id,fishId:'gulpuffer',growth});
const event={at:1000,fishIds:['resident'],grownFishIds:['resident']};
test('figure fallback restores a saved maturation after repaint without restarting its event',()=>{
  const f=fixture(),host=f.host(),player=f.Art.createFishFigure(host,{fish:resident(80),catalog:F.catalog});assert.equal(player.kind,'css3d');
  player.update({feeding:event});const view=host.children[0];assert(view.classList.contains('is-grown'));assert.equal(f.timerStarts,1);
  f.advance(2200);player.update({fish:resident(100)});assert.equal(view.dataset.mature,'true');assert.equal(view.dataset.growthMotion,'bubble');assert(view.classList.contains('is-grown'));assert.equal(view.style['--grown-delay'],'-1.2s');
  player.update({feeding:event});assert.equal(f.timerStarts,1,'same event does not rearm the timer');
  f.advance(5500);assert(!view.classList.contains('is-grown'));assert(!view.classList.contains('is-feeding'));
  player.update({feeding:event});assert.equal(f.timerStarts,1,'completed event cannot replay');player.destroy();assert.equal(f.timers.size,0);
});
test('figure fallback matches real residents and preserves the remaining event time after recreation',()=>{
  const f=fixture(),host=f.host(),player=f.Art.createFishFigure(host,{fish:resident(100,'other'),catalog:F.catalog});player.update({feeding:event});assert(!host.children[0].classList.contains('is-grown'));assert(!host.children[0].classList.contains('is-feeding'));player.destroy();
  f.advance(3000);const nextHost=f.host(),next=f.Art.createFishFigure(nextHost,{fish:resident(100),catalog:F.catalog,feeding:event});assert(nextHost.children[0].classList.contains('is-grown'));assert.equal([...f.timers.values()][0].at,5500,'recreated figure uses original event deadline');next.destroy();assert.equal(f.timers.size,0);
  f.advance(7000);const expired=f.Art.createFishFigure(f.host(),{fish:resident(100),catalog:F.catalog,feeding:event});assert.equal(f.timers.size,0,'older than the visible duration is quiet');expired.destroy();
});
test('pond fallback reapplies active classes to new swimmer DOM and ignores stale events',()=>{
  const f=fixture(),host=f.host(),player=f.Art.createPond(host,{fish:[resident(80)],catalog:F.catalog,pond:{decorations:[]}}),view=host.children[0];
  player.feed(event);const first=view.querySelectorAll('[data-fish-id]')[0];assert(first.classList.contains('is-grown'));assert.equal(f.timerStarts,1);
  f.advance(2000);player.update({fish:[resident(100)],feeding:event});const updated=view.querySelectorAll('[data-fish-id]')[0];assert.notEqual(updated,first);assert(updated.classList.contains('is-grown'));assert.equal(f.timerStarts,1);
  f.advance(5500);assert(!updated.classList.contains('is-grown'));f.advance(20000);player.update({fish:[resident(100)],feeding:event});assert(!view.classList.contains('is-feeding'));assert.equal(f.timerStarts,1);player.destroy();assert.equal(f.timers.size,0);
});
