'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
// Keep the vendor runtime byte-for-byte identical to its verified archive.
// Do not replace its publisher identity with the application publisher.
function preserveRuntime(file,read=fs.readFileSync,files=require('../build/codex-runtime.json').files){
  const match=file.replaceAll('\\','/').match(/(?:^|\/)resources\/codex\/(.+)$/i);
  if(!match)return false;
  assert(Object.hasOwn(files,match[1]),'Unknown executable inside the pinned runtime');
  assert.equal(crypto.createHash('sha256').update(read(file)).digest('hex'),files[match[1]],'Pinned runtime was modified before signing');
  return true;
}
async function sign(task,packager){
  if(preserveRuntime(task.path))return;
  assert(task.cscInfo,'A signing certificate is required');
  const manager=await packager.signingManager.value;
  assert.equal(typeof manager.doSign,'function','Unsupported electron-builder signing API');
  await manager.doSign(task,packager);
}
module.exports=sign;module.exports.preserveRuntime=preserveRuntime;
