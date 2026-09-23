'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../skins/tracer/garden-planets-view').geometry;
function close(a,b){assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);}
test('planet rotation and terrain ray lookup are inverse transforms and preserve a sphere',()=>{
  for(const yaw of [-8,-Math.PI,0,.38,2.9,20])for(const pitch of [-1.4,-.2,0,.9,1.4]){
    const p={x:.3,y:.4,z:Math.sqrt(.75)},r=G.rotate(p,yaw,pitch),restored=G.unrotate(r,yaw,pitch);
    close(Math.hypot(r.x,r.y,r.z),1);for(const axis of ['x','y','z'])close(restored[axis],p[axis]);
  }
});
test('planet perspective culls its far hemisphere and foreshortens distant flowers',()=>{
  assert.equal(G.project({x:0,y:0,z:1},100).visible,true);
  assert.equal(G.project({x:0,y:0,z:-1},100).visible,false);
  assert.equal(G.project({x:1,y:0,z:0},100).visible,false);
  assert.ok(G.project({x:.3,y:.4,z:.866},100).scale>G.project({x:.3,y:.4,z:-.866},100).scale);
  const y=G.rotate({x:0,y:0,z:1},.2,0);assert.ok(G.project(y,100).x>0,'positive horizontal drag moves the front planting right');
});
test('world flower positions are stable and all receipts survive dense-project display sampling',()=>{
  const flowers=Array.from({length:2000},(_,i)=>({taskId:'task-'+i,plantKind:'wildflower'}));
  const all=G.positions(flowers,.4);assert.equal(all.length,2000);assert.deepEqual(G.positions(flowers,.4),all);
  for(const p of all)close(Math.hypot(p.point.x,p.point.y,p.point.z),1);
  const sample=G.samplePositions(all,1998);assert.ok(sample.length<=G.MAX_SPRITES);assert.ok(sample.some(p=>p.flower.taskId==='task-1998'));
  assert.equal(new Set(sample.map(p=>p.index)).size,sample.length);assert.equal(all.length,2000);assert.deepEqual(all.map(p=>p.flower),flowers);
});
test('the actual selection view brings each flower to the front instead of leaving it behind taller plants',()=>{
  const all=G.positions(Array.from({length:200},(_,i)=>({taskId:String(i)})),2.3);
  for(const {point:p}of all){const {yaw,pitch}=G.flowerView(p),r=G.rotate(p,yaw,pitch);assert.ok(pitch>=.42&&pitch<=1.24);close(r.x,0);close(r.y,0);close(r.z,1);assert.equal(G.project(r,100).visible,true);}
});
test('keepsakes preserve normal, rare and shiny artwork and accept persisted draw tickets',()=>{
  assert.equal(G.rarity({ticket:0}),'shiny');assert.equal(G.rarity({ticket:1}),'rare');assert.equal(G.rarity({ticket:99}),'rare');assert.equal(G.rarity({ticket:100}),'normal');assert.equal(G.rarity({ticket:9999}),'normal');assert.equal(G.rarity({}),'normal');assert.equal(G.rarity({rarity:'shiny'}),'shiny');
});
test('dense flower beds give every receipt a distinct root instead of stacking rejected placements at the bed center',()=>{
  for(const count of [6,24,100,2000])for(const seed of [0,.4,1.3,2.5,4.9,6.28]){
    const flowers=Array.from({length:count},(_,i)=>({taskId:'dense-'+i})),all=G.positions(flowers,seed);
    const roots=new Set(all.map(item=>[item.point.x,item.point.y,item.point.z].map(value=>value.toFixed(8)).join(',')));
    assert.equal(roots.size,count,`${count} receipts at seed ${seed} must not share an indistinguishable root`);
    assert.deepEqual(all.map(item=>item.flower),flowers,'placement cannot drop or merge receipt metadata');
  }
});
test('all sparse and dense plant roots avoid the pond, shore, footpath and soil cliff',()=>{
  for(const count of [1,6,24,100,2000])for(const seed of [0,.4,1.3,2.5,4.9,6.28]){
    const all=G.positions(Array.from({length:count},(_,i)=>({taskId:'land-'+i})),seed);
    for(const item of all){const site=G.terrain(item.point,seed),label=`${count} flowers, seed ${seed}, receipt ${item.index}`;assert.ok(site.water>=.025,label+' lands in or next to the pond');assert.ok(site.path>=.068,label+' lands on the walkway');assert.ok(item.point.y>site.edge+.02,label+' lands on the soil cliff');close(Math.hypot(item.point.x,item.point.y,item.point.z),1);}
  }
});
test('cyber harvests create persistent terrain regions and every species is planted within its own habitat',()=>{
  for(const count of [1,6,24,100,2000])for(const neon of [1,Math.ceil(count*.25),Math.ceil(count*.6),count]){
    const flowers=Array.from({length:count},(_,i)=>({taskId:'mixed-'+i,plantKind:i<neon?['neon_orchid','volt_berry','crystal_tree'][i%3]:'wildflower'})),layout=G.biomes(flowers);
    assert.equal(layout.cyber,neon);assert.equal(layout.meadow,count-neon);
    const all=G.positions(flowers,2.3),roots=new Set();
    for(const item of all){const t=G.terrain(item.point,2.3),mix=G.biomeMix(item.point,layout);assert.ok(t.water>=.025&&t.path>=.068&&item.point.y>t.edge+.02,'plant roots must remain on garden land');assert.ok(G.isCyber(item.flower)?mix>=.9:mix<=.1,'every root must belong to its botanical region');roots.add(item.point.x.toFixed(8)+':'+item.point.z.toFixed(8));}
    assert.equal(roots.size,count);assert.deepEqual(all.map(item=>item.flower),flowers);
    assert.deepEqual(G.positions(JSON.parse(JSON.stringify(flowers)),2.3),all,'saved project geography survives a reload');
  }
  assert.equal(G.biomeMix({x:.3,z:.2},G.biomes([])),0);
});
