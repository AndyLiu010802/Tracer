'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../public/fishing-model'),A=require('../skins/tracer/fishing-anime-effects'),E=require('../skins/tracer/fishing-rod-effects');

test('all Naruto techniques stop at the short phase deadline, including the shared live effect gate',()=>{
  const rods=F.catalog.rods.filter(r=>r.collection==='naruto');assert.equal(rods.length,45);
  const context=new Proxy({},{get(){throw Error('A quiet or expired phase attempted to draw');}});
  for(const r of rods){
    for(const [phase,end]of Object.entries({cast:620,bite:280,caught:760})){
      assert.equal(E.effectVisible(phase,end-1,r.id),true,r.id);
      for(const age of [end,end+1,1940,5000,-1,NaN,Infinity]){
        assert.equal(E.effectVisible(phase,age,r.id),false,r.id+'/'+phase+'/'+age);
        assert.equal(A.draw(context,r.id,phase,age),null);
      }
    }
    for(const phase of ['idle','charging','waiting','reeling','escaped'])for(const age of [0,130,620,2000]){
      assert.equal(E.effectVisible(phase,age,r.id),false);
      assert.equal(A.draw(context,r.id,phase,age),null);
    }
    assert.equal(E.summonState(r,700),null,r.id+' entrance must also finish quickly');
    assert.equal(E.summonState(r,260,true),null,r.id+' reduced-motion entrance');
  }
});

test('all advanced anime floats have self-contained gradients across repeated cards and preserve tier eligibility',()=>{
  const ids=new Set();let count=0;
  for(const r of F.catalog.rods.filter(r=>['naruto','onepiece'].includes(r.collection))){
    const eligible=['epic','legendary'].includes(r.rarity),art=E.bobberMarkup(r);
    if(!eligible){assert.equal(art,'');continue;}count++;
    for(const svg of [art,E.bobberMarkup(r)]){
      assert(svg.includes('fishing-themed-float--anime'));assert(svg.includes('data-float-theme="'+r.id+'"'));
      if(r.rarity==='legendary'){assert(svg.includes('data-float-art="painted"'));assert(svg.includes('/fishing-art/float-prestige-'+r.id+'-v1.png'));assert(!/NaN|undefined|<animate\b/.test(svg));continue;}
      const local=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
      for(const id of local){assert(!ids.has(id),'two copies must not share a gradient');ids.add(id);}
      const refs=[...svg.matchAll(/url\(#([^)]+)\)/g)].map(m=>m[1]);assert(refs.length>0);for(const ref of refs)assert(local.includes(ref),'gradient must be local to its SVG');
      assert(!/NaN|undefined|<animate\b|<image\b/.test(svg),'floats stay finite, bundled and still');
    }
  }
  assert.equal(count,45);
  assert(E.bobberMarkup(F.catalog.rods.find(r=>r.id==='ruyi')).includes('fishing-themed-float--cloud'));
  assert.equal(A.detailedBobber('__proto__'),'');
});
