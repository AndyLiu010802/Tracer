'use strict';
// Playwright's inspector quit handshake can retain a successfully tested app
// on CI. Cleanup is bounded and targets only the ChildProcess we launched.
const assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
module.exports=async function closeQaElectron(app){
  const child=app.process(),running=()=>child.exitCode===null&&child.signalCode===null;
  const exited=running()?new Promise(resolve=>child.once('exit',resolve)):Promise.resolve();
  const closing=app.close().catch(error=>{if(running())console.warn('QA inspector close:',error.message);});
  const finished=await Promise.race([exited.then(()=>true),delay(5000).then(()=>false)]);
  if(!finished&&running()){
    console.log('Closing the QA-owned Electron process after its inspector quit handshake stalled.');
    child.kill('SIGTERM');
    if(!await Promise.race([exited.then(()=>true),delay(5000).then(()=>false)])&&running())child.kill('SIGKILL');
  }
  await Promise.race([exited,delay(2000)]);assert.equal(running(),false,'QA-owned Electron process exits');
  await Promise.race([closing,delay(1000)]);
  child.stdout?.destroy();child.stderr?.destroy();
};
