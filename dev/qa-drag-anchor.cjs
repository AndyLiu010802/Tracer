'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {chromium,_electron}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const frames=require('../public/frame-catalog.json');
const materials=require('../public/wallpaper-catalog.json').filter(item=>item.type==='material');
const native=process.argv.includes('--electron');
const output=fs.mkdtempSync(path.join(__dirname,'../.cache/drag-anchor-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(output,'data'),DOCS_PORTAL_STATE_FILE:path.join(output,'state.json')});
(async()=>{
  // Both modes use a private profile and mocked workspace, never the user's tasks.
  const server=native?net.createServer():require('../server').server;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port,origin='http://127.0.0.1:'+port;
  let browser,app,page,nativeWindow;
  try{
    if(native){
      await new Promise(resolve=>server.close(resolve));
      const env={...process.env,TRACER_USER_DATA_DIR:output,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_PORT:String(port)};
      delete env.ELECTRON_RUN_AS_NODE;
      app=await _electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..')],env,timeout:60000});
      app.process().stderr.on('data',data=>fs.appendFileSync(path.join(output,'electron.log'),data));
      // The app also creates a companion and an embedded browser; firstWindow
      // can observe either while startup is still assembling the main window.
      for(let i=0;i<200;i++){
        page=app.context().pages().find(candidate=>candidate.url()===origin+'/');
        if(page)break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      assert.ok(page,'main desktop page starts');
      nativeWindow=await app.browserWindow(page);
      await nativeWindow.evaluate(async win=>{
        if(win.isFullScreen())await new Promise(resolve=>{win.once('leave-full-screen',resolve);win.setFullScreen(false);});
        if(win.isMaximized())win.unmaximize();
      });
    }else{
      browser=await chromium.launch({channel: process.env.TRACER_QA_BROWSER || 'msedge',headless:true});
      page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1.5});
    }
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let ws={tasks:Array.from({length:10},(_,i)=>({id:'drag-'+i,seq:'TRC-'+i,title:'Drag anchor check '+i,status:'todo',order:(i+1)*1000,createdAt:1789440000000})),projects:[],notes:[],inbox:[],meta:{seqCounter:10,rev:0}};
    await page.route('**/api/store/**',async route=>{
      if(!new URL(route.request().url()).pathname.endsWith('/workspace'))return route.fulfill({json:null});
      if(route.request().method()==='PUT'){ws=route.request().postDataJSON();return route.fulfill({json:{ok:true}});}
      return route.fulfill({json:ws});
    });
    async function resize(width,height){
      if(native){
        await nativeWindow.evaluate((win,size)=>win.setContentSize(size.width,size.height),{width,height});
        // Frameless Windows borders can round the content area by one CSS pixel.
        try{await page.waitForFunction(size=>Math.abs(innerWidth-size.width)<=1&&Math.abs(innerHeight-size.height)<=1,{width,height},{timeout:3000});}
        catch(error){
          console.error('Native dimensions:',await nativeWindow.evaluate(win=>({bounds:win.getBounds(),content:win.getContentBounds(),fullscreen:win.isFullScreen(),maximized:win.isMaximized(),zoom:win.webContents.getZoomFactor()})),await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})));throw error;
        }
      }else await page.setViewportSize({width,height});
    }
    async function appearance(frame,material){
      await page.evaluate(({catalog,frame,material})=>{
        if(material)document.documentElement.dataset.wallpaperMaterial=material;
        else delete document.documentElement.dataset.wallpaperMaterial;
        TracerFrames.apply({catalog,appearance:{taskFrameItemId:frame?.id}});
      },{catalog:frames,frame,material});
    }
    async function clean(){
      assert.equal(await page.locator('.drag-ghost,.drag-placeholder,.drag-source,.drop-target,.is-dragging').count(),0);
      assert.equal(await page.evaluate(()=>document.body.classList.contains('task-dragging')||Tracer.store.dragging),false);
    }
    async function escape(){await page.keyboard.press('Escape');await page.mouse.up();await clean();}
    await page.goto(origin+'/?sec=board');
    await page.locator('.card').first().waitFor();
    await resize(1440,1000);
    await appearance(frames.find(item=>item.id==='tf05'),'cyber');
    async function drag(selector,points){
      await page.waitForFunction(()=>!Tracer.store.dirty&&!Tracer.store.inflight);
      const card=page.locator(selector);await card.scrollIntoViewIfNeeded();
      const grip=card.locator('.drag-handle');await grip.hover();await page.waitForTimeout(180);
      const handle=await grip.boundingBox();
      const paint=await card.evaluate(el=>{const s=getComputedStyle(el);return[s.backgroundColor,s.color,getComputedStyle(el,'::after').borderImageSource];});
      const start={x:handle.x+handle.width/2,y:handle.y+handle.height/2};
      await page.mouse.move(start.x,start.y);
      // Capture the actual grab instant: hover lift can still settle between
      // automation calls, especially in a visible native window.
      await page.evaluate(selector=>{
        window.dragAnchorSample=null;
        document.addEventListener('pointerdown',event=>{
          const card=event.target.closest(selector),rect=card.getBoundingClientRect();
          window.dragAnchorSample={offset:{x:event.clientX-rect.x,y:event.clientY-rect.y},width:rect.width};
        },{capture:true,once:true});
      },selector);
      await page.mouse.down();
      const {offset,width}=await page.evaluate(()=>window.dragAnchorSample);
      for(const point of points){
        await page.mouse.move(point.x,point.y,{steps:6});
        const ghost=page.locator('.drag-ghost'),rect=await ghost.boundingBox();
        const position=await ghost.evaluate(el=>getComputedStyle(el).position);
        if(position!=='fixed'){
          await page.screenshot({path:path.join(output,'position-failure.png')});
          console.log('Drag position failure:',JSON.stringify({position,rect,offset,point,output}));
        }
        assert.equal(position,'fixed');
        assert.ok(Math.abs(rect.x+offset.x-point.x)<1.5,'horizontal grab offset: '+JSON.stringify({rect,offset,point}));
        assert.ok(Math.abs(rect.y+offset.y-point.y)<1.5,'vertical grab offset: '+JSON.stringify({rect,offset,point}));
        assert.ok(Math.abs(rect.width-width)<1.5,'preview retains card width');
        assert.deepEqual(await ghost.evaluate(el=>{const s=getComputedStyle(el);return[s.backgroundColor,s.color,getComputedStyle(el,'::after').borderImageSource];}),paint,'preview retains material and frame artwork');
      }
    }
    await drag('.card[data-id="drag-0"]',[{x:800,y:440},{x:6,y:8},{x:1430,y:985}]);
    await escape();
    assert.equal(await page.evaluate(()=>TracerModel.findTask(Tracer.store.data,'drag-0').status),'todo');
    await drag('.card[data-id="drag-8"]',[{x:790,y:330}]);
    await escape();
    await resize(1100,720);
    await drag('.card[data-id="drag-0"]',[{x:650,y:430}]);
    const dest=await page.locator('.col-body[data-col="doing"]').boundingBox();
    await page.mouse.move(dest.x+dest.width/2,Math.max(200,dest.y+30),{steps:5});await page.mouse.up();
    await page.waitForFunction(()=>TracerModel.findTask(Tracer.store.data,'drag-0').status==='doing');
    await clean();
    await page.locator('[data-sec="planner"]').click();
    await drag('.pl-card[data-id="drag-0"]',[{x:670,y:360},{x:1090,y:710}]);
    await escape();
    await resize(1440,1000);
    let combinations=0;
    for(const [section,selector]of [['board','.card[data-id="drag-0"]'],['planner','.pl-card[data-id="drag-0"]']]){
      await page.locator('[data-sec="'+section+'"]').click();
      const original=await page.evaluate(()=>JSON.stringify(Tracer.store.data.tasks));
      // A CSS-only frame preview must also retain fixed positioning. This catches
      // theme regressions independently of the runtime's inline positioning guard.
      for(const frame of frames.filter(item=>item.type==='taskFrame'))for(const material of materials){
        await appearance(frame,material.material);
        const fixed=await page.locator(selector).evaluate(card=>{
          const sample=card.cloneNode(true);sample.classList.add('drag-ghost');document.body.append(sample);
          const position=getComputedStyle(sample).position;sample.remove();return position;
        });
        assert.equal(fixed,'fixed',section+' '+frame.id+' '+material.id+' CSS positioning');
        await drag(selector,[{x:800,y:450}]);
        if(section==='board'&&frame.id==='tf05'&&material.material==='cyber')await page.screenshot({path:path.join(output,'framed-drag.png')});
        await escape();combinations++;
        assert.equal(await page.evaluate(()=>JSON.stringify(Tracer.store.data.tasks)),original,'cancel preserves tasks');
      }
      // Keep ordinary, unframed cards working too.
      await appearance(null,null);await drag(selector,[{x:800,y:450}]);await escape();
    }
    await page.locator('[data-sec="board"]').click();
    await appearance(frames.find(item=>item.id==='tf05'),'cyber');
    for(const cancel of ['outside','pointercancel','blur']){
      await drag('.card[data-id="drag-0"]',[{x:6,y:8}]);
      if(cancel==='pointercancel')await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1})));
      if(cancel==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      await page.mouse.up();await clean();
      assert.equal(await page.evaluate(()=>TracerModel.findTask(Tracer.store.data,'drag-0').status),'doing');
    }
    if(native){
      const baseDpr=await page.evaluate(()=>devicePixelRatio);
      for(const zoom of [.75,1,1.25,1.5,2]){
        await nativeWindow.evaluate((win,zoom)=>win.webContents.setZoomFactor(zoom),zoom);
        await page.waitForFunction(expected=>Math.abs(devicePixelRatio-expected)<.02,baseDpr*zoom);
        for(const [section,selector]of [['board','.card[data-id="drag-0"]'],['planner','.pl-card[data-id="drag-0"]']]){
          await page.locator('[data-sec="'+section+'"]').click();
          const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
          await drag(selector,[{x:size.width*.7,y:size.height*.5},{x:size.width-5,y:size.height-5}]);await escape();
        }
      }
      await nativeWindow.evaluate(win=>win.webContents.setZoomFactor(1));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS '+(native?'Electron':'Edge')+': board/planner grab anchor, '+combinations+' frame/material combinations, viewport edges, scrolled cards, narrow viewport, drop, Escape/outside/pointercancel/blur cleanup'+(native?', native zoom 75/100/125/150/200%':'')+'. '+output);
  }catch(error){
    if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
    console.error('Diagnostics: '+output);throw error;
  }finally{
    if(app)await app.close();if(browser)await browser.close();
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
