'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const M=require('../skins/tracer/model'),G=require('../public/task-garden'),S=require('../public/workspace-sync'),{setTestCoins}=require('../dev/set-test-coins.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
test('offline test funding backs up one workspace, survives saves, spends normally and can be replenished',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-test-coins-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'workspace.json'),original=M.emptyWorkspace();fs.writeFileSync(file,JSON.stringify(original));
 const granted=setTestCoins(file);assert.equal(granted.balance,100000);assert.deepEqual(JSON.parse(fs.readFileSync(granted.backup)),original);assert.equal(setTestCoins(file).changed,false);
 const funded=S.validate(JSON.parse(fs.readFileSync(file))),next=clone(funded);G.buySticker(next,'st_bunny');G.buyFarm(next,'cyber');G.preserve(funded,next);assert.equal(G.economy(next).balance,99748);assert.deepEqual(next.tasks,original.tasks);assert.deepEqual(next.notes,original.notes);assert.equal(G.read(next).seeds.length,0);
 fs.writeFileSync(file,JSON.stringify(next));assert.equal(setTestCoins(file).balance,100000);const topped=JSON.parse(fs.readFileSync(file));G.preserve(topped,next);assert.equal(G.economy(next).balance,100000);assert.equal(G.economy(M.emptyWorkspace()).balance,0);
});
test('ordinary saves cannot forge test funds, enlarge them or erase accepted credit',()=>{
 const base=M.emptyWorkspace(),forged=clone(base);forged.taskGarden=G.read(forged);forged.taskGarden.market.testCredit={id:'test_fixture',amount:100000,updatedAt:10};G.preserve(base,forged);assert.equal(G.economy(forged).balance,0);
 const accepted=clone(base);accepted.taskGarden=G.read(accepted);accepted.taskGarden.market.testCredit={id:'test_fixture',amount:100000,updatedAt:10};const edited=clone(accepted);edited.taskGarden.market.testCredit.amount=200000;edited.taskGarden.market.testCredit.updatedAt=20;G.preserve(accepted,edited);assert.equal(G.economy(edited).balance,100000);const old=clone(base);G.preserve(accepted,old);assert.equal(G.economy(old).balance,100000);
 const merged=S.merge(base,base,accepted).workspace;assert.equal(G.economy(merged).balance,100000);
});
