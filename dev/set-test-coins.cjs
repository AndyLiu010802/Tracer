'use strict';
// Run with Tracer closed: node dev/set-test-coins.cjs <workspace.json> [balance]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const G=require('../public/task-garden'),S=require('../public/workspace-sync');
function setTestCoins(file,balance=100000){
 if(!Number.isSafeInteger(balance)||balance<0||balance>1000000000)throw Error('Invalid test balance');
 file=path.resolve(file);const source=fs.readFileSync(file,'utf8'),workspace=S.validate(JSON.parse(source)),before=G.economy(workspace).balance;
 if(before===balance)return{file,before,balance,changed:false};
 const garden=G.read(workspace),previous=garden.market.testCredit,amount=(previous?.amount||0)+balance-before;
 if(amount<0||amount>1000000000)throw Error('Cannot set this balance using test credit');
 garden.market.testCredit={id:previous?.id||'test_'+crypto.randomUUID().replace(/-/g,''),amount,updatedAt:Math.max(Date.now(),(previous?.updatedAt||0)+1)};
 workspace.taskGarden=G.validate(garden);S.validate(workspace);
 const backup=file+'.before-test-coins-'+Date.now()+'.bak',temporary=file+'.test-coins-'+crypto.randomUUID()+'.tmp';
 fs.writeFileSync(backup,source,{flag:'wx'});fs.writeFileSync(temporary,JSON.stringify(workspace,null,2)+'\n',{flag:'wx'});
 if(fs.readFileSync(file,'utf8')!==source){fs.unlinkSync(temporary);throw Error('Workspace changed; close Tracer and retry');}
 fs.renameSync(temporary,file);return{file,backup,before,balance:G.economy(workspace).balance,changed:true};
}
module.exports={setTestCoins};
if(require.main===module){try{if(!process.argv[2])throw Error('Usage: node dev/set-test-coins.cjs <workspace.json> [balance]; close Tracer first');console.log(JSON.stringify(setTestCoins(process.argv[2],process.argv[3]===undefined?100000:Number(process.argv[3]))));}catch(e){console.error(e.message);process.exitCode=1;}}
