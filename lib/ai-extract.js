'use strict';
const {Worker}=require('node:worker_threads'),path=require('node:path');
let active=0;
function extract(input){
 const name=String(input.name||''),ext=name.split('.').pop().toLowerCase();
 if(name.length>200||!['pdf','docx','txt','md','csv','json'].includes(ext))throw new Error('unsupported-document');
 if(typeof input.data!=='string'||input.data.length>14000000||!/^[a-zA-Z0-9+/]*={0,2}$/.test(input.data))throw new Error('documents-too-large');
 const data=Buffer.from(input.data,'base64');if(data.length>10*1024*1024)throw new Error('documents-too-large');if(active>=2)throw new Error('service-busy');active++;
 return new Promise((resolve,reject)=>{let worker,timer,settled=false;function finish(err,value){if(settled)return;settled=true;active--;clearTimeout(timer);if(worker)worker.terminate();err?reject(new Error(err)):resolve({name,text:value});}
  try{worker=new Worker(path.join(__dirname,'ai-extract-worker.js'),{workerData:{data,ext},resourceLimits:{maxOldGenerationSizeMb:256}});timer=setTimeout(()=>finish('document-timeout'),20000);worker.once('message',r=>{finish(r.error,r.text);});worker.once('error',e=>{finish('document-unreadable');});worker.once('exit',()=>finish('document-unreadable'));}catch{finish('document-unreadable');}
 });
}
module.exports={extract};
