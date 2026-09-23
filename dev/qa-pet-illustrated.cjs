'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/pet-illustrated-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(folder,'data'),DOCS_PORTAL_STATE_FILE:path.join(folder,'bookmarks.json')});
async function main(){
  const selected=process.argv.find(value=>value.startsWith('--pet='))?.slice(6).split(','),expected=(selected?.length||6)*16;
  const {server}=require('../server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER_CHANNEL||'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.PetDesktop={send(){},onState(){}};});
    await page.goto('http://127.0.0.1:'+server.address().port+'/pet.html');await page.waitForFunction(()=>window.TracerPetIllustratedAnimation&&window.TracerPetIllustratedAtlas);
    const report=await page.evaluate(async selected=>{
      const actions=TracerPetBuiltinAnimation.actions,atlas=TracerPetIllustratedAtlas,result={sheets:0,frames:0,kinds:[]};
      const ready=async(el,action)=>{const started=performance.now();while(el.dataset.motionClip!==action){if(performance.now()-started>10000)throw new Error(action+' did not load');await new Promise(r=>setTimeout(r,10));}};
      for(const [id,data]of Object.entries(atlas.kinds)){
        if(selected&&!selected.includes(id))continue;
        const holder=document.createElement('div');document.body.appendChild(holder);let frame=0;
        const layer=TracerGardenCompanionMotion.create(holder,{kind:id,stage:4,rare:true,atlas,actions,sample:action=>({clip:action,frame}),onReady:()=>layer.render(holder.dataset.motionRequested||'idle')});
        if(!layer){holder.remove();continue;}
        for(const action of actions){const sheet=data.normal[action];if(!sheet)continue;
          frame=0;layer.render(action);await ready(holder,action);const crops=new Set();
          for(frame=0;frame<16;frame++){
            layer.render(action);const image=holder.querySelector('image'),crop=image.parentElement;
            if(holder.dataset.frame!==String(frame)||holder.dataset.motionClip!==action||image.getAttribute('href')!==sheet.src)throw new Error(id+'/'+action+'/'+frame+' wrong frame');
            const cell=sheet.cells[frame];if(crop.getAttribute('viewBox')!==[cell.x,cell.y,cell.w,cell.h].join(' '))throw new Error('Incorrect source rectangle');
            crops.add(crop.getAttribute('viewBox'));result.frames++;
          }
          if(crops.size!==16)throw new Error('Repeated crops');result.sheets++;
        }
        result.kinds.push(id);layer.destroy();holder.remove();
      }
      return result;
    },selected);
    assert.equal(report.sheets,expected);assert.equal(report.frames,expected*16);
    for(const id of report.kinds){
      await page.evaluate(async id=>{
        document.body.replaceChildren();document.body.style='margin:0;padding:16px;background:#202823;color:#eceddf;font:12px system-ui;display:grid;grid-template-columns:repeat(4,250px);gap:8px';
        for(const action of TracerPetBuiltinAnimation.actions){
          const tile=document.createElement('section');tile.style='background:#34433a;text-align:center;padding:8px';
          const title=document.createElement('div');title.textContent=id+' · '+action;tile.appendChild(title);
          const player=TracerPetBuiltinAnimation.create({pet:id,animated:false});player.element.style='width:180px;height:180px;margin:auto';tile.appendChild(player.element);document.body.appendChild(tile);player.setAction(action);
          const start=performance.now();while(player.element.dataset.motionClip!==action){if(performance.now()-start>10000)throw new Error('Static preview failed');await new Promise(r=>setTimeout(r,10));}
          player.destroy();
        }
      },id);
      await page.screenshot({path:path.join(folder,id+'-all-actions.png'),fullPage:true});
    }
    await page.evaluate(id=>{document.body.replaceChildren();window.__player=TracerPetBuiltinAnimation.create({pet:id});document.body.appendChild(__player.element);__player.setAction('fishing');},report.kinds[0]);
    await page.waitForFunction(()=>__player.element.dataset.motionClip==='fishing'&&+__player.element.dataset.frame>0);
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>__player.element.dataset.playback==='reduced-motion');
    assert.equal(await page.evaluate(()=>__player.element.dataset.frame),'0');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>+__player.element.dataset.frame>0);
    await page.evaluate(()=>__player.destroy());assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log('PASS '+report.sheets+' illustrated actions / '+report.frames+' source frames, static collection views, live fishing and reduced motion. Artifacts: '+folder);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
