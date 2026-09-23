'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/wallpaper-materials-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(folder,'data'),DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1200}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const html=fs.readFileSync(path.join(root,'design/materials-v2/index.html'),'utf8').replaceAll('../../skins/tracer/','/');await context.route(origin+'/material-review',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto(origin+'/material-review');
    await page.waitForFunction(()=>document.querySelectorAll('.material-poster').length===10,{},{timeout:20000}).catch(async e=>{console.log(await page.locator('.wallpaper-optics').evaluateAll(cs=>cs.map(c=>({...c.dataset}))));throw e;});
    const stats=[];
    for(const id of ['glass','titanium','walnut','obsidian','porcelain','linen','velvet','paper','cyber','celadon']){
      await page.locator('[data-material='+id+']').click();await page.locator('#hero canvas[data-material-renderer=webgl]').waitFor();const b=await page.locator('#hero').boundingBox();await page.mouse.move(b.x+30,b.y+30);await page.waitForTimeout(600);const first=await page.locator('#hero').screenshot({path:path.join(folder,id+'-left.png')});await page.mouse.move(b.x+b.width-30,b.y+b.height-30);await page.waitForTimeout(600);const second=await page.locator('#hero').screenshot({path:path.join(folder,id+'.png')});assert.notDeepEqual(first,second,id+' responds to light');stats.push({id,lightResponds:true});
    }
    await page.locator('[data-material=glass]').click();await page.waitForTimeout(200);await page.locator('#grid').screenshot({path:path.join(folder,'all-materials.png')});await page.screenshot({path:path.join(folder,'gallery.png'),fullPage:true});
    const result=await page.evaluate(async()=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));const host=document.createElement('div');host.style.cssText='position:fixed;inset:50px auto auto 20px;width:800px;height:500px;z-index:999';document.body.append(host);
      const source=document.createElement('canvas');source.width=800;source.height=500;const x=source.getContext('2d');x.fillStyle='#183bbb';x.fillRect(0,0,800,500);
      const p=TracerMaterialOptics.mount(host,{material:'glass',source:()=>source,still:true,edge:40});await wait(150);
      function pixels(){p.refresh();return p.canvas.toDataURL();}
      // Read back using a 2D copy immediately after a refresh frame (preserved buffer).
      const a=pixels();x.fillStyle='#ffcc33';x.fillRect(0,0,800,500);await wait(150);const refraction=a!==pixels();
      const out=document.createElement('canvas');out.width=p.canvas.width;out.height=p.canvas.height;const o=out.getContext('2d');o.drawImage(p.canvas,0,0);const center=o.getImageData(out.width/2,out.height/2,1,1).data[3]===0,edge=o.getImageData(15,250,1,1).data[3]>0;
      p.pause(true);await wait(100);let count=p.stats().draws;host.dispatchEvent(new PointerEvent('pointermove',{clientX:600,clientY:400}));await wait(180);const paused=p.stats().draws===count;
      p.pause(false);host.style.left='-3000px';await wait(100);count=p.stats().draws;await wait(180);const offscreen=p.stats().draws===count;
      host.style.left='20px';host.style.width='420px';await wait(150);const resized=p.canvas.width===420;
      p.destroy();count=p.stats().draws;await wait(150);const destroyed=p.stats().destroyed&&p.stats().draws===count&&!host.querySelector('canvas');host.remove();return{refraction,center,edge,paused,offscreen,resized,destroyed};
    });assert.deepEqual(result,{refraction:true,center:true,edge:true,paused:true,offscreen:true,resized:true,destroyed:true});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(180);const before=await page.locator('#hero').screenshot();const b=await page.locator('#hero').boundingBox();await page.mouse.move(b.x+10,b.y+10);await page.waitForTimeout(200);assert.deepEqual(await page.locator('#hero').screenshot(),before,'reduced motion freezes light');await page.emulateMedia({reducedMotion:'no-preference'});
    // WebGL-disabled environments retain the sculpted CSS frame and usable content.
    const fallback=await context.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});await fallback.goto(origin+'/material-review');await fallback.locator('#hero canvas[data-material-renderer=fallback]').waitFor();assert.ok(await fallback.locator('#hero .wallpaper-material-sample').isVisible());await fallback.screenshot({path:path.join(folder,'fallback.png')});await fallback.close();
    for(const width of [390,2560]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);assert.ok(await page.locator('#hero canvas').evaluate(c=>c.width<=2200));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({materials:stats,...result},null,2));console.log('PASS ten optical materials, pointer lighting, live wallpaper refraction, transparent center, pause, reduced motion, offscreen, resize, cleanup and CSS fallback');console.log('Screenshots: '+folder);
  }catch(error){await page.screenshot({path:path.join(folder,'failure.png')});throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
