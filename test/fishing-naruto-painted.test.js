'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const F=require('../public/fishing-model'),P=require('../skins/tracer/fishing-naruto-painted'),V=require('../skins/tracer/fishing-naruto-vfx'),R=require('../skins/tracer/fishing-rod-renderer'),A=require('../skins/tracer/fishing-anime-effects'),X=require('../dev/fishing-naruto-expansion.cjs');
const rods=F.catalog.rods.filter(r=>r.collection==='naruto');
test('original Naruto receipts, duplicates, guarantees and ownership survive expansion unchanged',()=>{
 const vm=require('node:vm'),M=require('../skins/tracer/model'),newIds=new Set(X.rods.map(r=>r.id));
 const source=fs.readFileSync(require.resolve('../public/fishing-model'),'utf8').replace(/RODS\.push\.apply\(RODS,(\[[^\n]+\])\);(\s*\/\/ END ANIME RODS)/,(_,json,end)=>'RODS.push.apply(RODS,'+JSON.stringify(JSON.parse(json).filter(r=>!newIds.has(r.id)))+');'+end);
 const context={module:{exports:{}},require:require('node:module').createRequire(require.resolve('../public/fishing-model'))};vm.runInNewContext(source,context);const Old=context.module.exports;assert.equal(Old.catalog.rods.filter(r=>r.collection==='naruto').length,30);
 const ws=M.emptyWorkspace();Old.ensure(ws);ws.taskGarden.market.testCredit={id:'naruto_art_test',amount:100000,updatedAt:1};
 for(let i=0;i<80;i++)assert(Old.buyBox(ws,{poolId:'naruto',now:100+i,random:limit=>limit===10000?[0,6000,9000,9800,5480][i%5]:0}).ok);
 const saved=JSON.parse(JSON.stringify(ws.fishing)),pity=JSON.parse(JSON.stringify(Old.pity(saved,'naruto'))),balance=Old.economy(ws).balance;
 assert.deepEqual(F.validate(saved),saved);assert.deepEqual(F.pity(F.read(ws),'naruto'),pity);assert.equal(F.economy(ws).balance,balance);
 ws.fishing=structuredClone(saved); // A persisted save re-enters through ordinary JSON objects.
 const drawn=new Set();for(const [tier,ticket]of [['common',0],['rare',6000],['epic',9000],['legendary',9800]]){const count=rods.filter(r=>!r.hidden&&r.rarity===tier).length;for(let i=0;i<count+8;i++){const r=F.buyBox(ws,{poolId:'naruto',now:1000+drawn.size+i,random:limit=>limit===10000?ticket:0});assert(r.ok);drawn.add(r.rod.id);}}
 for(const r of X.rods)assert(drawn.has(r.id),r.id+' reachable through its actual pool tier');assert.doesNotThrow(()=>F.validate(ws.fishing));assert.deepEqual(ws.fishing.boxes.slice(0,saved.boxes.length),saved.boxes);
});
test('45 Naruto rods have explicit balanced tiers, distinct original art and distinct animated atlases',()=>{
 assert.equal(rods.length,45);assert.deepEqual(['common','rare','epic','legendary','hidden'].map(t=>rods.filter(r=>t==='hidden'?r.hidden:!r.hidden&&r.rarity===t).length),[12,13,12,7,1]);
 assert.equal(X.rods.length,15);assert.deepEqual(['common','rare','epic','legendary'].map(t=>X.rods.filter(r=>r.rarity===t).length),[4,4,4,3]);
 assert.deepEqual(Object.keys(P.assets).sort(),rods.map(r=>r.id).sort());assert.deepEqual(Object.keys(V.specs).sort(),rods.map(r=>r.id).sort());
 const hashes=new Set();for(const rod of rods)for(const [kind,entry]of [['rod',P.assets[rod.id]],['fx',V.specs[rod.id]]]){const b=fs.readFileSync(path.join(__dirname,'../skins/tracer',entry.src));assert.equal(b.toString('ascii',12,16),'IHDR');assert.equal(b[25],6,rod.id+' alpha channel');assert(b.readUInt32BE(16)>=1500,rod.id+' original detail');const hash=crypto.createHash('sha256').update(b).digest('hex');assert(!hashes.has(hash),rod.id+' independent '+kind);hashes.add(hash);}
 assert.equal(hashes.size,90);assert.equal(F.catalog.rodPools.find(p=>p.id==='naruto').odds.hidden,.005);
 const hidden=rods.find(r=>r.hidden);assert.equal(hidden.id,'anime_sixpaths');assert.equal(hidden.progressRescue,.35);assert.equal(hidden.tensionMultiplier,.8);
});
test('painted ninja weapons stay rigid and flexible tools retain exact continuous physical anchors',()=>{
 const start=R.deformed([0,0,0],0),end=R.deformed([1,0,0],0),length=Math.hypot(end.x-start.x,end.y-start.y);
 for(const r of rods){const e={id:r.id,width:2172,height:724,bounds:[45,190,2130,630],base:[50,325],tip:[2120,325]},n=P.assets[r.id].rig==='weapon'?1:64;
  for(const bend of [-.24,0,.24]){const data=P.vertices(e,bend,R.deformed,length,n);assert(data.every(Number.isFinite));assert.equal(data.length,n*24);const base=R.deformed([0,0,0],bend),tip=R.deformed([1,0,0],bend),dx=tip.x-base.x,dy=tip.y-base.y,l=Math.hypot(dx,dy);for(let i=0;i<data.length;i+=4){const t=(data[i+2]*e.width-50)/2070,normal=(data[i+3]*e.height-325)*length/2070,p=n===1?{x:base.x+dx*t-dy/l*normal,y:base.y+dy*t+dx/l*normal}:R.deformed([t,normal,0],bend);assert(Math.hypot(p.x-data[i],p.y-data[i+1])<.0001,r.id);}}
 }
 for(const key of ['sasuke','suigetsu','zabuza','kisame','hidan','orochimaru'])assert.equal(P.assets['anime_'+key].rig,'weapon');
});
test('every ninjutsu has a continuous bounded trajectory, clean deadlines and quiet reduced motion',()=>{
 const g={width:400,height:280,water:{x:278,y:185}},tip={x:95,y:36},untouchable=new Proxy({},{get(){throw Error('Quiet animation touched canvas');}});
 for(const rod of rods){assert(A.presentation[rod.animeAction]);let previous=null;
  for(let age=0;age<620;age+=4){const q=V.pose(rod.id,'cast',age,g,tip,g.water);assert(q);assert([q.x,q.y,q.rotation,q.scale,q.alpha,q.blend].every(Number.isFinite));assert(q.a>=0&&q.b<=5);assert.deepEqual(q.impactPoint,g.water);if(previous)assert(Math.hypot(q.x-previous.x,q.y-previous.y)<3,rod.id+' continuous displacement');previous=q;}
  for(const phase of ['cast','bite','caught']){const duration=V.durations[phase];for(const age of [-1,NaN,Infinity,duration,duration+1])assert.equal(V.draw(untouchable,rod.id,phase,age),null);const a=V.pose(rod.id,phase,100,g,tip,g.water,true),b=V.pose(rod.id,phase,200,g,tip,g.water,true);assert.deepEqual([a.x,a.y,a.rotation,a.scale,a.a,a.blend],[b.x,b.y,b.rotation,b.scale,b.a,b.blend]);}
  for(const phase of ['idle','charging','waiting','reeling','escaped'])assert.equal(V.draw(untouchable,rod.id,phase,200),null);
 }
});
test('ninjutsu reuses decoded images, bounds its cache and only samples two neighboring drawings',async()=>{
 let loads=0;class ImageStub{set src(value){this.naturalWidth=1536;this.naturalHeight=1024;loads++;queueMicrotask(()=>this.onload());}}
 const doc={defaultView:{Image:ImageStub}},id='anime_naruto';await V.load(doc,id);await V.load(doc,id);assert.equal(loads,1);
 const calls=[],ctx={canvas:{ownerDocument:doc},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...args){calls.push(args)}};
 const g={width:400,height:280,water:{x:278,y:185}},tip={x:95,y:36};
 for(let age=80;age<600;age+=4){const before=calls.length,q=V.draw(ctx,id,'cast',age,{},g,tip,g.water);assert(q);assert(calls.length-before<=2);}
 assert.equal(loads,1);for(const c of calls){assert.equal(c.length,9);assert(c.slice(1).every(Number.isFinite));assert(c[1]>=0&&c[1]+c[3]<=1536);assert(c[2]>=0&&c[2]+c[4]<=1024);}
 for(const rod of rods.slice(0,10))await V.load(doc,rod.id);assert.equal(V.get(doc,id),null,'old image is evicted');
});
