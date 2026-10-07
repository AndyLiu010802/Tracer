'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const F=require('../public/fishing-model'),M=require('../skins/tracer/model'),G=require('../public/task-garden'),S=require('../public/workspace-sync'),Backup=require('../lib/workspace-backup'),Portable=require('../lib/portable-backup'),Store=require('../lib/store'),{createLocalAccounts}=require('../lib/accounts');
async function room(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tracer-fishing-backup-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});});return dir;}
const legacyFixture=require('./fixtures/fishing-legacy-cabin.json');
function fixture(){const ws=structuredClone(legacyFixture.workspace);F.ensure(ws);F.buyBait(ws,'grain',1,100);F.equipBait(ws,'grain',101);F.buyBox(ws,{now:102,random:()=>0});for(let i=0;i<6;i++){const now=1000+i*10000,s=F.beginCast(ws,{seed:120,now}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);F.commitCast(ws,s,now+1);while(!['caught','escaped'].includes(s.phase))F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);const caught=F.recordCatch(ws,s,now+9000);assert.equal(caught.ok,true);if(i<5)F.placeFry(ws,caught.fry.id,'pond_starter',now+9001);else F.releaseFish(ws,caught.fry.id,now+9001);}F.selectPondStyle(ws,'pond_starter','moon',61000);F.archivePond(ws,'pond_starter',61001);F.selectPondStyle(ws,F.read(ws).activePondId,'cloud',61002);F.feedPond(ws,'pond_starter',61003);F.sellFish(ws,F.read(ws).catches[0].id,61004);return ws;}
function addLegend(ws){F.buyBait(ws,'stardust',1,70000);F.equipBait(ws,'stardust',70001);let seed=0;while(F.createSession(F.empty(),{seed,baitId:'stardust',now:1}).fishId!=='gulpuffer')seed++;const s=F.beginCast(ws,{seed,now:70002}).session;F.stepSession(s,{},900);F.stepSession(s,{release:true},0);F.commitCast(ws,s,70003);while(!['caught','escaped'].includes(s.phase))F.stepSession(s,{hook:s.phase==='bite',holding:s.fishPosition>s.barPosition},16);assert.equal(F.recordCatch(ws,s,79000).ok,true);}

test('signed backups include all fishing records and preview current fishing collection counts',()=>{const ws=fixture(),backup=Backup.sign('guest',ws,{},'a'.repeat(64),100000),preview=Backup.inspect(backup,'guest','a'.repeat(64));assert.deepEqual(backup.payload.workspace.fishing,ws.fishing);assert.deepEqual(backup.payload.workspace.taskGarden.market.fishingTransactions,ws.fishing.transactions);assert.equal(preview.counts.rods,2);assert.equal(preview.counts.fish,6);assert.equal(preview.counts.fry,5);assert.equal(preview.counts.ponds,2);const invalid=structuredClone(ws);invalid.taskGarden.market.fishingTransactions=[];assert.throws(()=>Backup.sign('guest',invalid,{},'a'.repeat(64)),{code:'backup-invalid-workspace'});});

test('a backup signed before cabin API removal still verifies with its original checksum and signature',()=>{
  const backup=structuredClone(legacyFixture.signedBackup),before=JSON.stringify(backup),ws=backup.payload.workspace;
  assert.doesNotThrow(()=>Backup.inspect(backup,'guest','a'.repeat(64)));
  assert.equal(Backup.hash(F.validate(ws.fishing)),Backup.hash(legacyFixture.workspace.fishing));
  assert.equal(F.read(ws).equippedCabinId,'cottage');assert.deepEqual(F.showcase(ws).selection,{fishIds:[]});F.ensure(ws);
  assert.equal(JSON.stringify(backup),before);
  const resigned=Backup.sign('guest',ws,{},'a'.repeat(64),100000);assert.equal(resigned.checksum,backup.checksum);assert.equal(resigned.signature,backup.signature);
});

test('pre-decoration signed backups keep their canonical hash and gain read-only scenery defaults',()=>{const ws=fixture();for(const pond of ws.fishing.ponds){delete pond.decorations;delete pond.decorationLayoutAt;}const before=JSON.stringify(ws),backup=Backup.sign('guest',ws,{},'a'.repeat(64),100000);assert.doesNotThrow(()=>Backup.inspect(backup,'guest','a'.repeat(64)));assert.equal(backup.payload.workspace.fishing.ponds[0].decorations,undefined);assert.ok(F.read(ws).ponds[0].decorations.length>0);assert.equal(JSON.stringify(ws),before);});

test('first persistence of an old decorated theme keeps its own read-time default scenery',()=>{const ws=fixture();for(const pond of ws.fishing.ponds){delete pond.decorations;delete pond.decorationLayoutAt;}const next=structuredClone(ws);F.preserve(undefined,next);assert.deepEqual(F.read(next).ponds[0].decorations.map(d=>d.kind),F.defaultPondDecorations('moon',0).map(d=>d.kind));});

test('guest import protects a task-empty account whose only progress is free scenery placement',async t=>{const dir=await room(t),service=createLocalAccounts(dir),guest=M.emptyWorkspace();M.addTask(guest,{title:'Guest task'});await Store.writeStore(dir,'workspace',JSON.stringify(guest));const created=await service.register({email:'scenery@example.com',password:'Fishing backup password 123',profile:{nickname:'Gardener'}}),account=M.emptyWorkspace();F.ensure(account);F.setPondDecoration(account,'pond_starter',{kind:'bench'},100);await Store.writeStore(service.directory(created.user.id),'workspace',JSON.stringify(account));assert.equal((await service.guestPreview(created.token)).targetHasData,true);await assert.rejects(service.importGuest(created.token),{code:'account-not-empty'});assert.ok((await Store.readStore(service.directory(created.user.id),'workspace')).fishing.ponds[0].decorations.some(d=>d.kind==='bench'));});

test('portable export and restore preserve aquarium layout, archived ponds, feeding, releases and wallet without duplication',async t=>{const root=await room(t),source=path.join(root,'source'),target=path.join(root,'target'),backup=path.join(root,'backup');await fs.mkdir(source);await fs.mkdir(target);const ws=fixture();addLegend(ws);assert.equal(F.setShowcase(ws,{fishIds:['gulpuffer']},80000).ok,true);await Store.writeStore(source,'workspace',JSON.stringify(ws));await Store.writeStore(target,'workspace',JSON.stringify(M.emptyWorkspace()));await Portable.exportDirectory(source,{},backup);const checked=await Portable.inspectDirectory(backup);assert.deepEqual(checked.workspace.fishing,ws.fishing);await Portable.restoreDirectory(backup,target,{}, {confirm:true});const restored=await Store.readStore(target,'workspace');assert.deepEqual(restored.fishing,ws.fishing);assert.deepEqual(F.showcase(restored),F.showcase(ws));assert.equal(G.economy(restored).balance,G.economy(ws).balance);assert.equal(F.read(restored).fry.filter(f=>f.releasedAt!==null).length,1);assert.equal(F.read(restored).ponds[0].archivedAt,61001);assert.equal(F.feedPond(restored,'pond_starter',121004).ok,true);assert.doesNotThrow(()=>S.validate(restored));});

test('guest import retains fishing progress and cannot overwrite a task-empty account with its own pond',async t=>{const dir=await room(t),service=createLocalAccounts(dir),guest=fixture();await Store.writeStore(dir,'workspace',JSON.stringify(guest));const registration=email=>({email,password:'Fishing backup password 123',profile:{nickname:'Angler'}}),occupied=await service.register(registration('occupied@example.com')),custom=M.emptyWorkspace();F.ensure(custom);F.selectPondStyle(custom,'pond_starter','lily',100);await Store.writeStore(service.directory(occupied.user.id),'workspace',JSON.stringify(custom));const preview=await service.guestPreview(occupied.token);assert.equal(preview.targetHasData,true);assert.equal(preview.available,false);await assert.rejects(service.importGuest(occupied.token),{code:'account-not-empty'});assert.equal((await Store.readStore(service.directory(occupied.user.id),'workspace')).fishing.ponds[0].styleId,'lily');const empty=await service.register(registration('empty@example.com')),starter=M.emptyWorkspace();F.ensure(starter);await Store.writeStore(service.directory(empty.user.id),'workspace',JSON.stringify(starter));assert.equal((await service.guestPreview(empty.token)).available,true);await service.importGuest(empty.token);const imported=await Store.readStore(service.directory(empty.user.id),'workspace');assert.deepEqual(imported.fishing,guest.fishing);assert.equal(G.economy(imported).balance,G.economy(guest).balance);assert.deepEqual((await Store.readStore(dir,'workspace')).fishing,guest.fishing);});

test('aquarium decorations survive signed backup without changing old showcase payloads',()=>{
  const ws=fixture();assert.equal(F.setShowcase(ws,{decorationIds:['pearl_shell','jade_arch']},80000).ok,true);
  addLegend(ws);const resident=F.read(ws).fry.find(f=>f.fishId==='gulpuffer');assert.equal(F.placeAquariumFish(ws,resident.id,true,90000).ok,true);
  const backup=Backup.sign('guest',ws,{},'a'.repeat(64));
  assert.deepEqual(backup.payload.workspace.fishing.showcase,ws.fishing.showcase);
  assert.deepEqual(F.showcase(S.validate(structuredClone(backup.payload.workspace))).selection.decorationIds,['pearl_shell','jade_arch']);
  assert.deepEqual(F.aquarium(backup.payload.workspace),F.aquarium(ws));
});

test('pre-showcase signed payloads keep their hash while highlights are supplied only when read',()=>{
  const ws=fixture(),fishingHash=Backup.hash(ws.fishing),backup=Backup.sign('guest',ws,{},'a'.repeat(64),100000),before=JSON.stringify(backup);
  assert.equal(ws.fishing.showcase,undefined);assert.equal(backup.payload.workspace.fishing.showcase,undefined);
  assert.equal(Backup.hash(F.validate(ws.fishing)),fishingHash);
  assert.deepEqual(F.showcase(backup.payload.workspace).selection,{fishIds:[]});
  F.ensure(backup.payload.workspace);assert.equal(JSON.stringify(backup),before);
  assert.doesNotThrow(()=>Backup.inspect(backup,'guest','a'.repeat(64)));
});

test('signed backups round-trip the chosen display and reject unearned display items',()=>{
  const ws=fixture();addLegend(ws);assert.equal(F.setShowcase(ws,{fishIds:['gulpuffer']},80000).ok,true);
  const backup=Backup.sign('guest',ws,{},'a'.repeat(64),100000);assert.doesNotThrow(()=>Backup.inspect(backup,'guest','a'.repeat(64)));
  assert.deepEqual(backup.payload.workspace.fishing.showcase,ws.fishing.showcase);
  assert.deepEqual(F.showcase(S.validate(structuredClone(backup.payload.workspace))),F.showcase(ws));
  const invalid=structuredClone(ws);invalid.fishing.showcase.fishIds=['dragonkoi'];assert.throws(()=>Backup.sign('guest',invalid,{},'a'.repeat(64)),{code:'backup-invalid-workspace'});
});

test('signed experimental cabin layouts retain their canonical payload while aquarium projects only legends',()=>{
  const ws=fixture();ws.fishing.showcase={fishIds:['koi'],rodId:'willow',souvenirId:'pond_keeper',updatedAt:61004};
  const backup=Backup.sign('guest',ws,{},'a'.repeat(64),100000),before=JSON.stringify(backup),hash=Backup.hash(ws.fishing);
  assert.deepEqual(F.showcase(backup.payload.workspace).selection,{fishIds:[]});assert.equal(Backup.hash(F.validate(ws.fishing)),hash);
  F.ensure(backup.payload.workspace);assert.equal(JSON.stringify(backup),before);assert.doesNotThrow(()=>Backup.inspect(backup,'guest','a'.repeat(64)));
  F.equipBait(ws,'worm',62000);assert.deepEqual(ws.fishing.showcase,backup.payload.workspace.fishing.showcase);
});

test('guest import respects an otherwise empty account with an explicit collection display',async t=>{
  const dir=await room(t),service=createLocalAccounts(dir),guest=M.emptyWorkspace();M.addTask(guest,{title:'Guest task'});await Store.writeStore(dir,'workspace',JSON.stringify(guest));
  const created=await service.register({email:'showcase@example.com',password:'Fishing backup password 123',profile:{nickname:'Collector'}}),account=M.emptyWorkspace();F.ensure(account);assert.equal(F.setShowcase(account,{fishIds:[]},100).changed,true);
  await Store.writeStore(service.directory(created.user.id),'workspace',JSON.stringify(account));assert.equal((await service.guestPreview(created.token)).targetHasData,true);await assert.rejects(service.importGuest(created.token),{code:'account-not-empty'});
  assert.deepEqual((await Store.readStore(service.directory(created.user.id),'workspace')).fishing.showcase,account.fishing.showcase);
});
