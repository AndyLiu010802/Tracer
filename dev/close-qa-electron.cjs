'use strict';
// Playwright's inspector quit handshake can retain a successfully tested app
// on CI. Cleanup is bounded and targets only the ChildProcess we launched.
const assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
module.exports=async function closeQaElectron(app){
  const guard=setTimeout(()=>{console.error('QA Electron cleanup retained a protocol transport beyond 20s.');process.exit(1);},20000);guard.unref();
  const child=app.process(),running=()=>child.exitCode===null&&child.signalCode===null;
  const exited=running()?new Promise(resolve=>child.once('exit',resolve)):Promise.resolve();
  const closing=app.close().catch(error=>{if(running())console.warn('QA inspector close:',error.message);});
  const finished=await Promise.race([exited.then(()=>true),delay(5000).then(()=>false)]);
  if(!finished&&running()){
    console.log('Closing the QA-owned Electron process after its inspector quit handshake stalled.');
    if(process.platform==='win32'){
      // Chromium helpers can retain the inspector transport after the parent
      // exits. Terminate only this test's process tree while its PID is live.
      await new Promise((resolve,reject)=>require('node:child_process').execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:5000},error=>error&&running()?reject(error):resolve()));
    }else child.kill('SIGTERM');
    if(!await Promise.race([exited.then(()=>true),delay(5000).then(()=>false)])&&running())child.kill('SIGKILL');
  }
  await Promise.race([exited,delay(2000)]);assert.equal(running(),false,'QA-owned Electron process exits');
  await Promise.race([closing,delay(1000)]);
  child.stdout?.destroy();child.stderr?.destroy();
  console.log('QA-owned Electron process and pipes closed.');
};
