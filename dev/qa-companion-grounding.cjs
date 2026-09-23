'use strict';
// Render the real source frames with their production anchors and CSS.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/companion-grounding-'));
Object.assign(process.env,{DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(folder,'data'),DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
(async()=>{
  const {server}=require('../server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:1400}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.PetDesktop={send(){},onState(){}};});
    await page.goto('http://127.0.0.1:'+server.address().port+'/pet.html');
    const result=await page.evaluate(async()=>{
      document.body.replaceChildren();document.body.style.cssText='margin:0;background:#142019;color:#d8e1cf;overflow:auto';
      const style=document.createElement('style');style.textContent='.qa-row{display:grid;grid-template-columns:180px repeat(4,180px);gap:12px;align-items:center;padding:10px}.qa-row .pet-home{position:relative;width:180px;height:190px;padding:0;border:0;background:none}.qa-row .pet-character{position:relative;display:block;width:160px;height:176px;margin:0;padding:0;border:0;background:none}.qa-row .pet-character::after{content:"";position:absolute;top:151px;left:0;width:160px;border-top:1px dashed #99b07870}.qa-row .pet-sprite{width:160px!important;height:176px!important}';document.head.appendChild(style);
      const cases=[...Object.keys(TracerPetIllustratedAtlas.kinds).map(id=>({id,action:'fishing',atlas:TracerPetIllustratedAtlas})),...['wildflower','apple','neon_orchid'].map(id=>({id,action:'greet',atlas:TracerGardenCompanionAtlas}))];
      const ends={sprout:11,miso:9,brook:10,ember:10,luna:8,nova:10};let checked=0;
      for(const {id,action,atlas}of cases){
        const row=document.createElement('section');row.className='qa-row';const title=document.createElement('strong');title.textContent=id+' / '+action;row.appendChild(title);document.body.appendChild(row);
        for(const frame of [0,4,8,ends[id]??15]){
          const home=document.createElement('div');home.className='pet-home has-builtin-animation';Object.assign(home.dataset,{pet:id,kind:'creature',idle:'fishing',behavior:'fishing',mood:'happy',action:''});row.appendChild(home);
          const button=document.createElement('button');button.className='pet-character';home.appendChild(button);
          const element=document.createElement('span');element.className='pet-sprite pet-builtin-sprite';button.appendChild(element);
          const layer=TracerGardenCompanionMotion.create(element,{kind:id,stage:4,rare:true,atlas,actions:Object.keys(atlas.kinds[id].normal),sample:()=>({clip:action,frame}),onReady:()=>layer.render(action)});layer.render(action);
          const start=performance.now();while(element.dataset.motionClip!==action){if(performance.now()-start>10000)throw Error('load '+id);await new Promise(resolve=>setTimeout(resolve,20));}
          const computed=getComputedStyle(element);if(computed.transform!=='none'||computed.animationName!=='none')throw Error('whole-character motion '+id);
          const crop=element.querySelector('svg svg'),cell=atlas.kinds[id].normal[action].cells[frame],scale=Number(crop.getAttribute('height'))/cell.h;
          if(Math.abs(Number(crop.getAttribute('x'))+(cell.rootX-cell.x)*scale-80)>1e-6||Math.abs(Number(crop.getAttribute('y'))+(cell.rootY-cell.y)*scale-151)>1e-6)throw Error('drifting anchor '+id+'/'+frame);
          checked++;
        }
      }
      return{checked};
    });
    await page.screenshot({path:path.join(folder,'grounded-actions.png'),fullPage:true});assert.deepEqual(errors,[]);
    console.log('PASS '+result.checked+' grounded poses, fixed character CSS and forward catch endpoints. Artifacts: '+folder);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
