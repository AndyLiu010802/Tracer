'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {_electron}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/fishing-desktop-qa-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function capture(app,fileName='desktop-fishing.png'){
  const captured=await app.evaluate(async({BrowserWindow})=>{
    const window=BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/fishing-desktop.html'));
    if(!window?.isVisible())throw new Error('Desktop window is hidden');
    const image=await window.webContents.capturePage(),size=image.getSize(),bitmap=image.toBitmap(),cornerAlpha=[bitmap[3],bitmap[(size.width-1)*4+3],bitmap[(size.height-1)*size.width*4+3],bitmap[(size.width*size.height-1)*4+3]],edgePixels={left:0,right:0,top:0,bottom:0};
    for(let y=0;y<size.height;y++){if(bitmap[y*size.width*4+3]>2)edgePixels.left++;if(bitmap[(y*size.width+size.width-1)*4+3]>2)edgePixels.right++;}
    for(let x=0;x<size.width;x++){if(bitmap[x*4+3]>2)edgePixels.top++;if(bitmap[((size.height-1)*size.width+x)*4+3]>2)edgePixels.bottom++;}
    return{png:image.toPNG().toString('base64'),size,cornerAlpha,edgePixels,bounds:window.getBounds(),contentBounds:window.getContentBounds(),zoomFactor:window.webContents.getZoomFactor()};
  });
  fs.writeFileSync(path.join(profile,fileName),Buffer.from(captured.png,'base64'));assert.deepEqual(captured.cornerAlpha,[0,0,0,0]);assert.deepEqual(captured.edgePixels,{left:0,right:0,top:0,bottom:0});assert.equal(captured.bounds.width,304);assert.equal(captured.bounds.height,208);assert.equal(captured.contentBounds.width,304);assert.equal(captured.contentBounds.height,208);assert.equal(captured.zoomFactor,1);delete captured.png;return captured;
}
async function moveAway(overlay){const rect=await overlay.locator('#desktop-fishing').boundingBox();await overlay.mouse.move(rect.x+rect.width-1,rect.y+1);}
async function rodGrip(overlay){return overlay.evaluate(()=>{const stage=document.getElementById('desktop-fishing'),rod=document.getElementById('fishing-rod'),rect=stage.getBoundingClientRect(),anchor=TracerFishingMotion.rodGeometry({width:rod.offsetWidth,height:rod.offsetHeight});return{x:rect.left+(rod.offsetLeft+anchor.grip.x)*rect.width/stage.clientWidth,y:rect.top+(rod.offsetTop+anchor.grip.y)*rect.height/stage.clientHeight};});}
function straightLine(pathData){
  const values=pathData.match(/-?\d+(?:\.\d+)?/g).map(Number);assert.equal(values.length,8);const points=Array.from({length:4},(_,i)=>({x:values[i*2],y:values[i*2+1]})),start=points[0],end=points[3],length=Math.hypot(end.x-start.x,end.y-start.y);
  for(const point of points.slice(1,3))assert(Math.abs((point.x-start.x)*(end.y-start.y)-(point.y-start.y)*(end.x-start.x))/length<.03,'reeling curve control points must lie on the rod-to-float line');return true;
}
async function bendMetrics(overlay){
  return overlay.evaluate(()=>{
    const rod=document.getElementById('fishing-rod'),stage=document.getElementById('desktop-fishing'),path=document.querySelector('#fishing-line path');
    const center=node=>{const r=node.getBoundingClientRect();return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};},tip=center(rod.querySelector('.fishing-rod-flex-tip')),grip=center(rod.querySelector('.fishing-rod-flex-grip'));
    const numbers=path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),matrix=path.getScreenCTM(),points=[];for(let i=0;i<numbers.length;i+=2){const p=new DOMPoint(numbers[i],numbers[i+1]).matrixTransform(matrix);points.push({x:p.x,y:p.y});}
    const rect=stage.getBoundingClientRect(),inside=p=>p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom,start=points[0],end=points.at(-1),length=Math.hypot(end.x-start.x,end.y-start.y)||1;
    return{bend:Number(rod.dataset.rodBend),phase:stage.dataset.phase,rodId:stage.dataset.rodId,tip,grip,lineStart:start,tipError:Math.hypot(tip.x-start.x,tip.y-start.y),collinearity:Math.max(...points.slice(1,-1).map(p=>Math.abs((p.x-start.x)*(end.y-start.y)-(p.y-start.y)*(end.x-start.x))/length)),tipInside:inside(tip),gripInside:inside(grip),gripHit:document.elementFromPoint(grip.x,grip.y)?.closest('#fishing-rod')?.id,renderer:rod.dataset.rodFlexRenderer,geometry:rod.dataset.rodGeometry,triangles:Number(rod.dataset.rodTriangles),line:path.getAttribute('d'),particles:[...document.querySelectorAll('.fishing-fx-particle')].filter(n=>Number(n.style.opacity)>.01).length};
  });
}
async function previewBend(main,overlay,app){
  const before=await main.evaluate(()=>JSON.stringify(Tracer.fishing.snapshot().state));
  const update=async(patch={},rodId='bamboo')=>{
    await main.evaluate(({patch,rodId})=>{window.bendPreviewSession={id:'qa-bend-preview',phase:'reeling',castPower:.9,castDistance:.915,progress:.55,tension:.85,holding:true,fishBehavior:'surge',stamina:1,fishPosition:.7,barPosition:.7,barSize:.3,...window.bendPreviewSession,...patch};const value=Tracer.fishing.snapshot(),rod=TracerFishingModel.catalog.rods.find(item=>item.id===rodId),fish=TracerFishingModel.catalog.fish.find(item=>item.id==='dragonkoi');TracerFishing.update({...value,rod,fish,disabled:true,session:window.bendPreviewSession,lastCatch:null});},{patch,rodId});
    await overlay.waitForFunction(rodId=>document.getElementById('fishing-rod').dataset.rodFlex==='ready'&&document.getElementById('desktop-fishing').dataset.rodId===rodId,rodId);
  };
  await moveAway(overlay);await overlay.evaluate(()=>document.activeElement?.blur());await update();await pause(750);
  const high=await bendMetrics(overlay);assert(high.bend>.1);assert(high.tipError<1);assert(high.tipInside&&high.gripInside);assert.equal(high.gripHit,'fishing-rod');assert.equal(high.renderer,'webgl');assert.equal(high.geometry,'mesh3d');assert(high.triangles>10000);straightLine(high.line);
  const shots=[],shot=async(name,metrics)=>{const fileName='desktop-bend-'+name+'.png';shots.push({name,...metrics,...await capture(app,fileName),screenshot:path.join(profile,fileName)});};await shot('high-tension',high);
  await update({tension:.05,holding:false,fishBehavior:'rest',stamina:.2});const releaseFrames=[];for(let i=0;i<20;i++){await pause(16);releaseFrames.push(await bendMetrics(overlay));}await pause(550);
  const released=await bendMetrics(overlay);assert(released.bend<high.bend*.6);assert(released.tipError<1);straightLine(released.line);assert(Math.hypot(released.grip.x-high.grip.x,released.grip.y-high.grip.y)<1);assert(releaseFrames.every(m=>m.tipError<1&&m.tipInside));assert(Math.max(...releaseFrames.map((m,i)=>i?Math.abs(m.bend-releaseFrames[i-1].bend):0))<.045);await shot('released',released);
  await update({tension:.85,holding:true,fishBehavior:'surge',stamina:1},'astral');await pause(650);const advanced=await bendMetrics(overlay);assert(advanced.bend>.08&&advanced.particles>0);assert(advanced.tipError<1);straightLine(advanced.line);await shot('astral',advanced);
  await update({phase:'idle'},'astral');await pause(750);const advancedIdle=await bendMetrics(overlay);assert(advancedIdle.tipInside&&advancedIdle.gripInside);assert.equal(advancedIdle.geometry,'mesh3d');await shot('astral-idle',advancedIdle);
  await update({id:'qa-bend-charge',phase:'charging',castPower:1,castDistance:1,tension:0,holding:false,stamina:1},'bamboo');await pause(700);const charge=await bendMetrics(overlay);assert(charge.tipInside&&charge.gripInside);await shot('max-charge',charge);
  await update({phase:'cast'},'bamboo');const castFrames=[];for(let i=0;i<42;i++){await pause(16);const frame=await bendMetrics(overlay);castFrames.push(frame);if(i===12)await shot('cast',frame);}assert(castFrames.every(m=>m.tipInside&&m.gripInside),'bent rod remains within the smaller transparent native window for the full cast');
  assert.equal(await main.evaluate(()=>JSON.stringify(Tracer.fishing.snapshot().state)),before);await main.evaluate(()=>Tracer.fishing.refresh());return{shots,releaseFrames,castFrames,zeroPersistedGameplayChange:true};
}
async function previewCaught(main,overlay,app,rodId='astral'){
  const before=await main.evaluate(()=>JSON.stringify(Tracer.fishing.snapshot().state));
  await main.evaluate(rodId=>{const value=Tracer.fishing.snapshot(),rod=TracerFishingModel.catalog.rods.find(item=>item.id===rodId),fish=TracerFishingModel.catalog.fish[0];TracerFishing.update({...value,rod,fish,disabled:true,session:{id:'qa-catch-preview',phase:'caught'},lastCatch:null});},rodId);
  await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='caught');await pause(900);
  const landed=await overlay.evaluate(()=>({hidden:document.getElementById('fishing-flight-fish').hidden,opacity:Number(document.getElementById('fishing-flight-fish').style.opacity),rect:document.getElementById('fishing-flight-fish').getBoundingClientRect().toJSON()}));assert.equal(landed.hidden,false);assert(landed.opacity>.9);
  const landedName='desktop-caught-landed.png',landedShot=await capture(app,landedName);
  await pause(1400);const faded=await overlay.evaluate(()=>({hidden:document.getElementById('fishing-flight-fish').hidden,opacity:Number(document.getElementById('fishing-flight-fish').style.opacity)}));assert.equal(faded.hidden,true);assert(faded.opacity<.005);
  const fadedName='desktop-caught-faded.png',fadedShot=await capture(app,fadedName);
  assert.equal(await main.evaluate(()=>JSON.stringify(Tracer.fishing.snapshot().state)),before,'catch animation preview cannot create a saved catch');
  return{landed:{at:900,...landed,...landedShot,screenshot:path.join(profile,landedName)},faded:{at:2300,...faded,...fadedShot,screenshot:path.join(profile,fadedName)},zeroPersistedGameplayChange:true};
}
(async()=>{
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const env={...process.env,TRACER_USER_DATA_DIR:profile,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_PORT:String(port),DOCS_PORTAL_HOST:'127.0.0.1'};delete env.ELECTRON_RUN_AS_NODE;
  console.log('Launching isolated fishing QA');
  const qaGpuArgs=process.argv.includes('--qa-in-process-gpu')?['--in-process-gpu']:[];
  const app=await _electron.launch({executablePath:require('electron'),args:[...qaGpuArgs,root],env,timeout:45000});
  console.log('Electron inspector connected');
  const errors=[],checks=[];
  try{
    let main;for(let i=0;i<100;i++){main=app.context().pages().find(page=>page.url()===`http://127.0.0.1:${port}/`);if(main)break;await pause(100);}assert(main,'main app page opens');main.on('pageerror',error=>errors.push(error.message));
    await main.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.data&&!Tracer.store.inflight&&!Tracer.store.dirty);
    console.log('Main fishing controller ready');
    const mainZoomBefore=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>new URL(window.webContents.getURL()||'about:blank').pathname==='/').webContents.getZoomFactor());assert.equal(mainZoomBefore,1);
    await app.evaluate(({ipcMain,BrowserWindow})=>{globalThis.fishingQA=[];globalThis.fishingQACommands=[];globalThis.nativePointerIgnored=false;globalThis.nativePointerModes=[];const original=BrowserWindow.prototype.setIgnoreMouseEvents;BrowserWindow.prototype.setIgnoreMouseEvents=function(ignore,options){if(this.webContents.getURL().endsWith('/fishing-desktop.html')){globalThis.nativePointerIgnored=ignore;globalThis.nativePointerModes.push(ignore);}return original.call(this,ignore,options);};ipcMain.on('tracer-fishing-action',(event,message)=>globalThis.fishingQA.push({type:message.type,scope:message.accountScope,session:message.sessionId,sequence:message.sequence,url:event.senderFrame?.url}));ipcMain.on('tracer-fishing-command',(_event,message)=>globalThis.fishingQACommands.push({type:message.type,value:message.value}));});
    await main.evaluate(()=>Tracer.fishing.open());
    let overlay;for(let i=0;i<100;i++){overlay=app.context().pages().find(page=>page.url().endsWith('/fishing-desktop.html'));if(overlay)break;await pause(100);}
    assert(overlay,'desktop fishing page opens');overlay.on('pageerror',error=>errors.push(error.message));
    await overlay.waitForSelector('#fishing-rod .fishing-rod-art',{state:'attached'});
    await overlay.evaluate(()=>{window.desktopSnapshots=[];window.desktopMechanics={nibblePeak:0,nibbleVisible:false,behaviors:[],staminaMin:1,staminaMax:0};FishingDesktop.onSnapshot(value=>{window.desktopSnapshots.push(value);if(window.desktopSnapshots.length>30)window.desktopSnapshots.shift();const s=value.session;if(s){const m=window.desktopMechanics;m.nibblePeak=Math.max(m.nibblePeak,s.nibble||0);if(s.phase==='reeling'){if(!m.behaviors.includes(s.fishBehavior))m.behaviors.push(s.fishBehavior);m.staminaMin=Math.min(m.staminaMin,s.stamina);m.staminaMax=Math.max(m.staminaMax,s.stamina);}if(s.phase==='waiting'&&s.nibble>.1)requestAnimationFrame(()=>m.nibbleVisible=m.nibbleVisible||!document.getElementById('fishing-nibble').hidden);}});FishingDesktop.send({type:'ready'});});
    await overlay.waitForFunction(()=>window.desktopSnapshots?.at(-1)?.nativeSessionId);
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(window=>window.webContents.getURL().endsWith('/pet.html'))),false);checks.push('no retired character window');
    const initial=await overlay.evaluate(()=>window.desktopSnapshots.at(-1));assert.equal(initial.accountScope,'guest');
    if(process.argv.includes('--keyboard')){
      const focusWindow=desktop=>app.evaluate(({BrowserWindow},desktop)=>BrowserWindow.getAllWindows().find(window=>desktop?window.webContents.getURL().endsWith('/fishing-desktop.html'):new URL(window.webContents.getURL()||'about:blank').pathname==='/').focus(),desktop);
      const phase=expected=>overlay.waitForFunction(value=>document.getElementById('desktop-fishing').dataset.phase===value,expected,{timeout:20000});
      const current=()=>main.evaluate(()=>Tracer.fishing.snapshot());
      await focusWindow(true);
      await overlay.locator('#fishing-tackle').focus();
      await overlay.keyboard.down('f');await phase('charging');
      await focusWindow(false);await phase('escaped');await overlay.keyboard.up('f');
      assert.equal((await current()).state.casts.length,0,'native focus loss cancels charge without consuming bait');
      checks.push('F works with native toolbar focus; real window blur cancels charge');

      await focusWindow(true);
      const grip=await rodGrip(overlay);await overlay.mouse.move(grip.x,grip.y);await overlay.mouse.down();await phase('charging');await pause(450);await overlay.mouse.up();await phase('waiting');
      assert.equal(await overlay.evaluate(()=>document.activeElement.id),'fishing-rod','mouse fishing restores rod focus');
      await phase('bite');await overlay.keyboard.down('f');await phase('reeling');
      await main.waitForFunction(()=>Tracer.fishing.snapshot().session?.holding===true);
      const beforeHold=(await current()).session.barPosition;await pause(160);const raised=(await current()).session.barPosition;assert(raised>beforeHold);
      await overlay.keyboard.up('f');await pause(160);assert((await current()).session.barPosition<raised);
      checks.push('mouse cast hands off to F hook; same held F raises the bar and release lowers it');

      let holding=false;const deadline=Date.now()+45000;
      while(Date.now()<deadline){const value=(await current()).session;if(value.phase!=='reeling')break;const next=value.fishPosition>value.barPosition;if(next!==holding){holding=next;if(holding)await overlay.keyboard.down('f');else await overlay.keyboard.up('f');}await pause(50);}
      if(holding)await overlay.keyboard.up('f');await phase('caught');
      const caught=await current();assert(caught.recastRemaining>0,'a real catch starts its presentation pause');const catchSession=caught.session.id;
      for(let i=0;i<4;i++){await overlay.keyboard.press('f');await overlay.mouse.click(grip.x,grip.y);}
      assert.equal((await current()).session.id,catchSession);assert.equal((await current()).session.phase,'caught');
      await overlay.keyboard.down('f');
      await overlay.screenshot({path:path.join(profile,'keyboard-catch-pause.png')});
      await overlay.waitForFunction(()=>window.desktopSnapshots.at(-1).recastRemaining===0&&window.desktopSnapshots.at(-1).disabled!==true);
      assert.equal((await current()).session.phase,'caught','holding through pause cannot queue another cast');
      assert.equal((await current()).state.casts.length,1);assert.equal((await current()).state.catches.length,1);
      await overlay.keyboard.up('f');await overlay.keyboard.down('f');await phase('charging');await focusWindow(false);await phase('escaped');await overlay.keyboard.up('f');
      checks.push('one real F-controlled catch saved', 'rapid F and mouse presses ignored during 2s catch display', 'held F after pause requires release and a fresh press');
      assert.deepEqual(errors,[]);const report={ok:true,keyboard:true,checks,recastRemainingAtCatch:caught.recastRemaining,actions:await app.evaluate(()=>globalThis.fishingQA),profile,screenshot:path.join(profile,'keyboard-catch-pause.png')};fs.writeFileSync(path.join(profile,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
    }
    if(process.argv.includes('--bend')){const bend=await previewBend(main,overlay,app);assert.deepEqual(errors,[]);const report={ok:true,rodPhysics:true,bend,profile};fs.writeFileSync(path.join(profile,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;}
    if(process.argv.includes('--caught')){const caught=await previewCaught(main,overlay,app);assert.deepEqual(errors,[]);const report={ok:true,caughtPreview:true,caught,profile};fs.writeFileSync(path.join(profile,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;}
    if(process.argv.includes('--bite')||process.argv.includes('--missed')||process.argv.includes('--tool-missed')){
      let tackleFocus=null;
      if(process.argv.includes('--tool-missed')){
        await overlay.evaluate(()=>{window.inputTrace=[];for(const type of ['pointermove','pointerdown','pointerup','blur','focus','keydown','keyup'])window.addEventListener(type,event=>{inputTrace.push({type:event.type,key:event.code,x:event.clientX,y:event.clientY,target:event.target.id,phase:document.getElementById('desktop-fishing').dataset.phase,focused:document.hasFocus()});if(inputTrace.length>50)inputTrace.shift();},true);});
        await overlay.locator('#fishing-pond').hover();await overlay.locator('#fishing-tackle').click();await main.waitForFunction(()=>{const d=document.querySelector('.fishing-modal[open] [data-rig-drawer]');return d&&!d.hidden;});await main.locator('.fishing-modal[open] [data-close]').click();await overlay.waitForFunction(()=>window.desktopSnapshots.at(-1).disabled!==true);
        const focusedLayout=()=>overlay.evaluate(()=>({focused:document.hasFocus(),root:document.getElementById('desktop-fishing').getBoundingClientRect().toJSON(),scroll:{x:scrollX,y:scrollY}}));tackleFocus={before:await focusedLayout()};await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/fishing-desktop.html')).focus());tackleFocus.after=await focusedLayout();assert.equal(tackleFocus.after.root.top,0);assert.equal(tackleFocus.after.root.left,0);
      }
      const results=[];
      for(const target of process.argv.includes('--missed')||process.argv.includes('--tool-missed')?['missed']:['float','rod','pond','blank','missed']){
        const grip=await rodGrip(overlay);await overlay.mouse.move(grip.x,grip.y);await overlay.mouse.down();await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='charging');await pause(450);await overlay.mouse.up();
        await moveAway(overlay);await pause(80);assert.equal(await app.evaluate(()=>globalThis.nativePointerIgnored),true,'empty desktop space initially passes input through');
        await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='bite',{},{timeout:20000});const at=Date.now(),bite=await overlay.evaluate(()=>window.desktopSnapshots.at(-1));
        await pause(30);assert.equal(await app.evaluate(()=>globalThis.nativePointerIgnored),false,'a bite restores native clicks without mouse movement');
        if(target==='missed'){
          await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='escaped',{},{timeout:3000});await pause(80);assert.equal(await app.evaluate(()=>globalThis.nativePointerIgnored),true,'missed bite restores blank-space passthrough');const session=await main.evaluate(()=>Tracer.fishing.snapshot().session);assert.equal(session.reason,'missed-bite');results.push({target,elapsed:Date.now()-at,reason:session.reason,passthroughRestored:true});continue;
        }
        const box=await overlay.locator(target==='float'?'#fishing-float':target==='rod'?'#fishing-rod':target==='blank'?'#desktop-fishing':'#fishing-pond').boundingBox(),point=target==='rod'?{x:box.x+box.width*.2,y:box.y+box.height*.88}:target==='pond'?{x:box.x+box.width*.5,y:box.y+box.height*.68}:target==='blank'?{x:box.x+box.width-1,y:box.y+1}:{x:box.x+box.width/2,y:box.y+box.height/2};
        const hit=await overlay.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('#fishing-rod,#fishing-float,#fishing-pond')?.id,point);assert.equal(hit,target==='blank'?undefined:'fishing-'+target);await overlay.mouse.click(point.x,point.y);await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='reeling',{},{timeout:1000});results.push({target,hit,elapsed:Date.now()-at,scope:bite.accountScope,nativeSessionId:bite.nativeSessionId,stationaryPointerBiteEnabled:true});await main.evaluate(()=>Tracer.fishing.cancel());await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='escaped');
      }
      assert.equal(await main.evaluate(()=>Tracer.fishing.snapshot().state.catches.length),0);assert.deepEqual(errors,[]);const report={ok:true,biteInput:true,missedOnly:process.argv.includes('--missed'),afterTackle:process.argv.includes('--tool-missed'),tackleFocus,inputTrace:await overlay.evaluate(()=>window.inputTrace),actions:await app.evaluate(()=>globalThis.fishingQA),results,profile};fs.writeFileSync(path.join(profile,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
    }
    if(process.argv.includes('--appearance')){
      const geometry=await overlay.evaluate(()=>{const root=document.getElementById('desktop-fishing'),canvas=document.querySelector('#fishing-pond canvas'),line=document.getElementById('fishing-line');return{viewport:{width:innerWidth,height:innerHeight},logical:{width:root.clientWidth,height:root.clientHeight},rect:root.getBoundingClientRect().toJSON(),cssZoom:getComputedStyle(root).zoom,lineRect:line.getBoundingClientRect().toJSON(),lineViewBox:line.getAttribute('viewBox'),pondRect:document.getElementById('fishing-pond').getBoundingClientRect().toJSON(),canvas:canvas&&{width:canvas.width,height:canvas.height,rect:canvas.getBoundingClientRect().toJSON()}};});
      assert.deepEqual(geometry.viewport,{width:304,height:208});assert.deepEqual(geometry.logical,{width:380,height:260});assert.equal(Number(geometry.cssZoom),.8);assert.equal(geometry.rect.width,304);assert.equal(geometry.rect.height,208);assert.equal(geometry.lineRect.width,304);assert.equal(geometry.lineRect.height,208);assert.equal(geometry.lineViewBox,'0 0 380 260');assert(geometry.canvas,'native pond uses WebGL canvas');assert(Math.abs(geometry.canvas.rect.width-266*.8)<.05);assert(Math.abs(geometry.canvas.rect.height-214*.8)<.05);
      const gripPoint=await rodGrip(overlay);
      const gripHit=await overlay.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('#fishing-rod')?.id,gripPoint);assert.equal(gripHit,'fishing-rod');await overlay.mouse.move(gripPoint.x,gripPoint.y);await overlay.mouse.down();await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='charging');await pause(450);await overlay.mouse.up();await overlay.waitForFunction(()=>['cast','waiting','bite'].includes(document.getElementById('desktop-fishing').dataset.phase));await main.evaluate(()=>Tracer.fishing.cancel());await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='escaped');
      checks.push('scaled rod hit starts charge, release casts, cancel ends the session');
      await overlay.locator('#fishing-pond').hover();const handleBox=await overlay.locator('#fishing-drag').boundingBox(),handlePoint={x:handleBox.x+handleBox.width/2,y:handleBox.y+handleBox.height/2};
      const boundsBefore=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/fishing-desktop.html')).getBounds());await overlay.mouse.move(handlePoint.x,handlePoint.y);await overlay.mouse.down();await overlay.mouse.move(handlePoint.x-12,handlePoint.y-8);await pause(120);
      const boundsMoved=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/fishing-desktop.html')).getBounds());assert.equal(boundsMoved.x,boundsBefore.x-12);assert.equal(boundsMoved.y,boundsBefore.y-8);
      // Keep the global pointer fixed after the native window moves under it.
      await overlay.mouse.move(handlePoint.x,handlePoint.y);await overlay.mouse.up();await pause(100);const boundsAfter=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/fishing-desktop.html')).getBounds());assert.deepEqual(boundsAfter,boundsMoved);checks.push('scaled handle drags the native window in screen coordinates');
      const interaction={gripHit,castCancelled:true,drag:{before:boundsBefore,after:boundsAfter,delta:{x:boundsAfter.x-boundsBefore.x,y:boundsAfter.y-boundsBefore.y}}};
      await moveAway(overlay);await overlay.evaluate(()=>document.activeElement?.blur());await pause(250);
      const effectsFlag=process.argv.find(value=>value.startsWith('--effects=')||value.startsWith('--fx='))||(process.argv.includes('--fx')?'--fx=astral':null);
      let effectPreview=null;
      if(effectsFlag){
        const rodId=effectsFlag.slice(effectsFlag.indexOf('=')+1),before=await main.evaluate(()=>JSON.stringify(Tracer.fishing.snapshot().state));const shots=[];
        for(const phase of ['idle','charging','cast','reeling']){
          await main.evaluate(({rodId,phase})=>{const value=Tracer.fishing.snapshot(),rod=TracerFishingModel.catalog.rods.find(item=>item.id===rodId);if(!rod)throw Error('Unknown preview rod');TracerFishing.update({...value,rod,disabled:true,session:phase==='idle'?null:{id:'qa-visual-preview',phase,castPower:.85,progress:.6,tension:.5,fishPosition:.55,barPosition:.55,barSize:rod.barSize}});},{rodId,phase});
          await overlay.waitForFunction(({rodId,phase})=>document.getElementById('desktop-fishing').dataset.rodId===rodId&&document.getElementById('desktop-fishing').dataset.phase===phase,{rodId,phase});await pause(phase==='cast'?300:phase==='reeling'?140:400);
          const status=await overlay.evaluate(()=>({hidden:document.querySelector('.fishing-motion-fx').hidden,particles:[...document.querySelectorAll('.fishing-fx-particle')].filter(node=>Number(node.style.opacity)>.01).length,rod:document.getElementById('fishing-rod').getBoundingClientRect().toJSON(),line:document.querySelector('#fishing-line path').getAttribute('d')}));assert.equal(status.hidden,false);assert(status.particles>0);if(phase==='reeling')status.straightLine=straightLine(status.line);const fileName='desktop-'+rodId+'-'+phase+'.png';shots.push({phase,...status,...await capture(app,fileName),screenshot:path.join(profile,fileName)});
        }
        assert.equal(await main.evaluate(()=>JSON.stringify(Tracer.fishing.snapshot().state)),before,'visual previews cannot grant or spend gameplay inventory');effectPreview={rodId,shots,zeroPersistedGameplayChange:true};
        effectPreview.caught=await previewCaught(main,overlay,app,rodId);
        await main.evaluate(()=>Tracer.fishing.refresh());await pause(200);
      }
      await moveAway(overlay);await overlay.evaluate(()=>document.activeElement?.blur());await pause(500);
      const layout=await overlay.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,panelCount:document.querySelectorAll('.fishing-game,header,footer,select,.desktop-fishing-shell').length,forcedPixels:[...document.querySelectorAll('#fishing-rod svg,#fishing-pond canvas')].some(node=>getComputedStyle(node).imageRendering==='pixelated')}));
      assert.equal(layout.background,'rgba(0, 0, 0, 0)');assert.equal(layout.panelCount,0);assert.equal(layout.forcedPixels,false);
      const mainZoomAfter=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>new URL(window.webContents.getURL()||'about:blank').pathname==='/').webContents.getZoomFactor());assert.equal(mainZoomAfter,mainZoomBefore);assert.deepEqual(errors,[]);checks.push('CSS-only scaling preserves main-window Electron zoom');
      const captured=await capture(app),report={ok:true,appearanceOnly:true,checks,geometry,interaction,mainZoom:{before:mainZoomBefore,after:mainZoomAfter},effectPreview,layout,...captured,profile,screenshot:path.join(profile,'desktop-fishing.png')};fs.writeFileSync(path.join(profile,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
    }
    const button=await rodGrip(overlay);await overlay.mouse.move(button.x,button.y);await overlay.mouse.down();
    await overlay.waitForFunction(()=>document.querySelector('#desktop-fishing').dataset.phase==='charging');checks.push('desktop input starts authoritative charge');
    await pause(450);await overlay.mouse.up();
    await overlay.waitForFunction(()=>['cast','waiting','bite'].includes(document.querySelector('#desktop-fishing').dataset.phase));checks.push('release consumes bait and casts');
    await overlay.waitForFunction(()=>window.desktopSnapshots.at(-1).session?.committed===true||['waiting','bite'].includes(document.querySelector('#desktop-fishing').dataset.phase));
    const castSnapshot=await overlay.evaluate(()=>window.desktopSnapshots.at(-1));assert(castSnapshot.sessionId);assert.notEqual(castSnapshot.nativeSessionId,initial.nativeSessionId);
    await moveAway(overlay);await overlay.evaluate(()=>document.activeElement?.blur());
    await overlay.waitForFunction(()=>window.desktopSnapshots.at(-1).session?.phase==='waiting'&&window.desktopSnapshots.at(-1).session.nibble>.2,{},{timeout:10000});await pause(35);
    const nibbleShot=await capture(app,'desktop-nibble.png');checks.push('light waiting nibble has a distinct float cue');
    await overlay.waitForFunction(()=>document.querySelector('#desktop-fishing').dataset.phase==='bite',{},{timeout:20000});
    const bobber=await overlay.locator('#fishing-float').boundingBox();await overlay.mouse.click(bobber.x+bobber.width/2,bobber.y+bobber.height/2);
    await overlay.waitForFunction(()=>document.querySelector('#desktop-fishing').dataset.phase==='reeling');checks.push('float hooks the fish');
    const grip=await rodGrip(overlay);await overlay.mouse.move(grip.x,grip.y);
    let holding=false;
    const catchDeadline=Date.now()+45000;
    while(Date.now()<catchDeadline){
      const current=await overlay.evaluate(()=>window.desktopSnapshots.at(-1).session);
      if(current.phase!=='reeling')break;
      const next=current.fishPosition>current.barPosition;
      if(next!==holding){holding=next;if(holding)await overlay.mouse.down();else await overlay.mouse.up();}
      await pause(65);
    }
    if(holding)await overlay.mouse.up();
    await main.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='caught'&&Tracer.fishing.snapshot().lastCatch&&!Tracer.store.inflight&&!Tracer.store.dirty,{},{timeout:20000});
    const caught=await main.evaluate(()=>({count:Tracer.fishing.snapshot().state.catches.length,catch:Tracer.fishing.snapshot().lastCatch}));assert.equal(caught.count,1);assert(caught.catch.id);checks.push('reel controls complete a real saved catch');
    const mechanics=await overlay.evaluate(()=>({...window.desktopMechanics,castDistance:window.desktopSnapshots.at(-1).session.castDistance}));assert(mechanics.nibblePeak>.2&&mechanics.nibbleVisible);for(const behavior of ['cruise','surge','rest'])assert(mechanics.behaviors.includes(behavior),'native renderer receives '+behavior);assert(mechanics.staminaMax>.8&&mechanics.staminaMin<.05);assert(Math.abs(castSnapshot.session.castDistance-(.15+.85*castSnapshot.session.castPower))<.001);checks.push('actual casting distance, surges, recovery and depleted stamina reach the desktop');
    await overlay.waitForFunction(()=>window.desktopSnapshots.at(-1).disabled!==true);
    if(process.argv.includes('--mechanics')){
      await moveAway(overlay);await overlay.evaluate(()=>document.activeElement?.blur());await pause(900);const realCatch=await capture(app,'desktop-real-caught.png');
      await overlay.locator('#fishing-pond').hover();await overlay.locator('#fishing-tackle').click();await main.waitForFunction(()=>{const drawer=document.querySelector('.fishing-modal[open] [data-rig-drawer]');return drawer&&!drawer.hidden;});checks.push('native tackle button opens the game tackle box in the main window');await main.locator('.fishing-modal[open] [data-close]').click();await overlay.waitForFunction(()=>window.desktopSnapshots.at(-1).disabled!==true);
      const freshGrip=await rodGrip(overlay);await overlay.mouse.move(freshGrip.x,freshGrip.y);await overlay.mouse.down();await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='charging');await pause(450);await overlay.mouse.up();await moveAway(overlay);await overlay.evaluate(()=>document.activeElement?.blur());await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='bite',{},{timeout:20000});const biteAt=Date.now();await pause(30);assert.equal(await app.evaluate(()=>globalThis.nativePointerIgnored),false);await overlay.waitForFunction(()=>document.getElementById('desktop-fishing').dataset.phase==='escaped',{},{timeout:3000});await pause(80);assert.equal(await app.evaluate(()=>globalThis.nativePointerIgnored),true);const missed=await main.evaluate(()=>Tracer.fishing.snapshot().session);assert.equal(missed.reason,'missed-bite');assert.equal(await main.evaluate(()=>Tracer.fishing.snapshot().state.catches.length),1);checks.push('missed bite escapes in main and desktop and restores transparent input');
      const captured=await capture(app),report={ok:true,mechanicsOnly:true,checks,mechanics,missed:{elapsed:Date.now()-biteAt,reason:missed.reason},actions:await app.evaluate(()=>globalThis.fishingQA),savedCatch:caught.catch,nibble:{...nibbleShot,screenshot:path.join(profile,'desktop-nibble.png')},realCatch:{...realCatch,screenshot:path.join(profile,'desktop-real-caught.png')},...captured,profile,screenshot:path.join(profile,'desktop-fishing.png')};assert.deepEqual(errors,[]);fs.writeFileSync(path.join(profile,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
    }
    const secondGrip=await rodGrip(overlay);await overlay.mouse.move(secondGrip.x,secondGrip.y);await overlay.mouse.down();
    await overlay.waitForFunction(()=>document.querySelector('#desktop-fishing').dataset.phase==='charging');await pause(450);await overlay.mouse.up();await overlay.waitForFunction(()=>document.querySelector('#desktop-fishing').dataset.phase==='waiting');
    await overlay.locator('#fishing-hide').click();
    await main.waitForFunction(()=>Tracer.fishing.snapshot().session?.phase==='escaped');
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/fishing-desktop.html')).isVisible()),false);checks.push('hide cancels the session');
    await main.evaluate(()=>Tracer.fishing.open());
    await overlay.waitForFunction(()=>document.querySelector('#desktop-fishing').dataset.phase==='escaped');
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(window=>window.webContents.getURL().endsWith('/fishing-desktop.html')).length),1);checks.push('reopen reuses one overlay');
    const beforeReload=await overlay.evaluate(()=>window.desktopSnapshots.at(-1).nativeSessionId);
    await app.evaluate(({webContents,ipcMain})=>{globalThis.reloadQA=[];for(const content of webContents.getAllWebContents())if(new URL(content.getURL()||'about:blank').pathname==='/')content.on('did-start-navigation',(details,...args)=>globalThis.reloadQA.push({event:'navigation',keys:Object.keys(details),main:details.isMainFrame,same:details.isSameDocument,args}));ipcMain.on('tracer-fishing-update',(_event,value)=>globalThis.reloadQA.push({event:'update',session:value.sessionId,scope:value.accountScope}));});
    await main.reload();await main.waitForFunction(()=>window.Tracer?.fishing&&Tracer.store.data&&!Tracer.store.inflight&&!Tracer.store.dirty);
    await overlay.waitForFunction(()=>window.FishingDesktop&&document.querySelector('#fishing-rod .fishing-rod-art'));
    await overlay.evaluate(()=>{window.desktopSnapshots=[];FishingDesktop.onSnapshot(value=>window.desktopSnapshots.push(value));FishingDesktop.send({type:'ready'});});
    await overlay.waitForFunction(old=>window.desktopSnapshots?.at(-1)?.nativeSessionId&&window.desktopSnapshots.at(-1).nativeSessionId!==old,beforeReload,{timeout:15000});
    const reloaded=await overlay.evaluate(()=>window.desktopSnapshots.at(-1));
    assert.equal(reloaded.accountScope,'guest');assert.notEqual(reloaded.nativeSessionId,beforeReload);checks.push('reload hydrates fresh account credentials');
    const layout=await overlay.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,rootBackground:getComputedStyle(document.getElementById('desktop-fishing')).backgroundColor,panelCount:document.querySelectorAll('.fishing-game,header,footer,select,.desktop-fishing-shell').length}));
    assert.equal(layout.background,'rgba(0, 0, 0, 0)');assert.equal(layout.rootBackground,'rgba(0, 0, 0, 0)');assert.equal(layout.panelCount,0);checks.push('only rod and small pond on transparent desktop');
    await main.evaluate(()=>Tracer.fishing.open());
    await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/fishing-desktop.html'));if(!window?.isVisible())throw new Error('Desktop window is hidden');});
    await moveAway(overlay);await overlay.evaluate(()=>document.activeElement?.blur());await pause(250);
    const captured=await capture(app);checks.push('native capture has transparent corners and complete padded banks');assert.deepEqual(errors,[]);
    const report={ok:true,checks,mechanics,nibble:{...nibbleShot,screenshot:path.join(profile,'desktop-nibble.png')},savedCatch:caught.catch,...captured,profile,screenshot:path.join(profile,'desktop-fishing.png')};fs.writeFileSync(path.join(profile,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }catch(error){for(const page of app.context().pages())console.log('QA page',page.url(),await page.evaluate(()=>({phase:document.querySelector('#desktop-fishing')?.dataset.phase,error:window.Tracer?.fishing?.snapshot().error,session:window.Tracer?.fishing?.snapshot().session?.phase,inputTrace:window.inputTrace})));console.log('QA input',JSON.stringify(await app.evaluate(()=>({actions:globalThis.fishingQA?.slice(-15),commands:globalThis.fishingQACommands?.slice(-15),reload:globalThis.reloadQA})),null,2));throw error;}finally{await require('./close-qa-electron.cjs')(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
