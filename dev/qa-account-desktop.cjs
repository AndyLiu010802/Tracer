'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {_electron}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/account-desktop-'));
(async()=>{
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const env={...process.env,TRACER_USER_DATA_DIR:profile,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_PORT:String(port),DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'state.json')};delete env.ELECTRON_RUN_AS_NODE;
  const executable=process.argv[2],app=await _electron.launch({executablePath:executable?path.resolve(executable):require('electron'),args:[...(executable?[]:[root]),'--disable-gpu','--in-process-gpu'],env,timeout:60000});
  await app.evaluate(({ipcMain})=>{globalThis.accountQA=[];ipcMain.on('tracer-pet-command',(_event,message)=>{if(['snapshot','account-lock','account-unlock'].includes(message.type)){globalThis.accountQA.push({type:message.type,scope:message.value?.accountScope,bytes:JSON.stringify(message.value||{}).length});globalThis.accountQA=globalThis.accountQA.slice(-12);}});});
  try{
    let page;for(let i=0;i<100;i++){page=app.context().pages().find(p=>p.url()===`http://127.0.0.1:${port}/`);if(page)break;await new Promise(r=>setTimeout(r,100));}assert.ok(page);
    await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.evaluate(()=>{localStorage.setItem('tracer.qa.desktop','guest');TracerPet.send({type:'show'});});
    let pet;for(let i=0;i<100;i++){pet=app.context().pages().find(p=>p.url().endsWith('/pet.html'));if(pet)break;await new Promise(r=>setTimeout(r,100));}assert.ok(pet);await pet.waitForFunction(()=>window.TracerAccount?.scope==='guest');
    await page.locator('#account-open').click();await page.locator('#account-auth-register').click();
    await page.locator('#account-email').fill('desktop@example.com');await page.locator('#account-nickname').fill('Desktop account');await page.locator('#account-password').fill('Desktop test password 123');await page.locator('#account-password-confirm').fill('Desktop test password 123');await page.locator('#account-auth-submit').click();await page.locator('#account-recovery-code').waitFor();
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet.html')).isVisible()),false);
    await page.locator('#account-recovery-saved').check();await Promise.all([page.waitForEvent('load'),page.locator('#account-recovery-continue').click()]);
    await page.waitForFunction(()=>window.Tracer?.store?.data&&TracerAccount.scope!=='guest');const id=await page.evaluate(()=>TracerAccount.scope);
    await pet.waitForFunction(id=>window.TracerAccount?.scope===id,id);assert.equal(await page.evaluate(()=>localStorage.getItem('tracer.qa.desktop')),null);assert.equal(await pet.evaluate(()=>localStorage.getItem('tracer.qa.desktop')),null);
    await page.evaluate(()=>localStorage.setItem('tracer.qa.desktop','account'));assert.equal(await pet.evaluate(()=>localStorage.getItem('tracer.qa.desktop')),'account');
    await page.locator('#account-open').click();await Promise.all([page.waitForEvent('load'),page.locator('#account-logout').click()]);await page.waitForFunction(()=>window.Tracer?.store?.data&&TracerAccount.scope==='guest');await pet.waitForFunction(()=>window.TracerAccount?.scope==='guest');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tracer.qa.desktop')),'guest');assert.equal(await pet.evaluate(()=>localStorage.getItem('tracer.qa.desktop')),'guest');assert.deepEqual(errors,[]);
    console.log('PASS Electron registration, recovery screen companion pause, account/guest storage isolation and native companion scope reload');
  }catch(error){console.log('Native account diagnostics:',await app.evaluate(()=>globalThis.accountQA));for(const page of app.context().pages())if(page.url().startsWith('http://127.0.0.1:'))console.log(await page.evaluate(()=>({path:location.pathname,scope:window.TracerAccount?.scope,locked:window.TracerAccount?.locked,focus:!!window.Tracer?.focus,pet:!!window.Tracer?.pet,store:!!window.Tracer?.store?.data})));throw error;}finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
