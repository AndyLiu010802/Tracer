'use strict';
// Render every authored pose using the browser's SVG rasterizer. No user profile,
// generated photos, local AI connection, or paid image generation is accessed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');
async function main(){
  const browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER_CHANNEL||'msedge',headless:true});
  const folder=fs.mkdtempSync(path.join(root,'.cache/pet-builtin-frames-'));
  try{
    const page=await browser.newPage({viewport:{width:1120,height:1100},deviceScaleFactor:1});
    await page.setContent('<html><head></head><body></body></html>');
    await page.addScriptTag({path:path.join(root,'skins/tracer/pet-art.js')});
    await page.addScriptTag({path:path.join(root,'skins/tracer/pet-builtin-animation.js')});
    const checks=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=200;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const rows=[];
      for(const id of Object.keys(TracerPetArt.rigs))for(const action of TracerPetBuiltinAnimation.actions){
        const hashes=[],bounds=[];
        for(let frame=0;frame<32;frame++){
          const content=TracerPetBuiltinAnimation.snapshot(id,action,frame).replace('<svg ','<svg x="0" y="0" width="160" height="160" ').replace('overflow:hidden','overflow:visible');
          const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 200 200" width="200" height="200">'+content+'</svg>';
          const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));image.src=url;await image.decode();
          ctx.clearRect(0,0,200,200);ctx.drawImage(image,0,0);URL.revokeObjectURL(url);
          const pixels=ctx.getImageData(0,0,200,200).data;let minX=200,minY=200,maxX=0,maxY=0;
          for(let y=0;y<200;y++)for(let x=0;x<200;x++)if(pixels[(y*200+x)*4+3]>16){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
          // Equality checks use the actual raster, never merely different SVG attributes.
          hashes.push(canvas.toDataURL());bounds.push([minX-20,minY-20,maxX-20,maxY-20]);
        }
        rows.push({id,action,unique:new Set(hashes).size,bounds});
      }
      return rows;
    });
    fs.writeFileSync(path.join(folder,'pose-checks.json'),JSON.stringify(checks,null,2));
    const clipped=checks.flatMap(row=>row.bounds.map((box,frame)=>({id:row.id,action:row.action,frame,box}))).filter(row=>row.box[0]<0||row.box[1]<0||row.box[2]>=160||row.box[3]>=160);
    assert.deepEqual(clipped,[],'every joint, face and prop stays inside its own 160×160 frame');
    // Tiny eased changes can quantize to the same pixel at desktop size. Allow
    // a few genuine resting holds, but never duplicate half the source poses.
    for(const check of checks)assert.ok(check.unique>=28,check.id+':'+check.action+' must retain at least 28 distinct raster poses across its 32-frame cycle');
    for(const id of ['sprout','miso','brook','ember','luna','nova']){
      await page.evaluate(id=>{
        document.body.style='margin:0;padding:16px;background:#202823;color:#dfebdb;font:12px system-ui;display:grid;grid-template-columns:repeat(8,136px);gap:2px;';
        document.body.innerHTML=TracerPetBuiltinAnimation.actions.map(action=>[0,8,16,24].map(frame=>'<section style="background:#17201b;text-align:center"><div>'+id+' · '+action+' · '+frame+'</div>'+TracerPetBuiltinAnimation.snapshot(id,action,frame).replace('<svg ','<svg width="136" height="136" ')+'</section>').join('')).join('');
      },id);
      await page.screenshot({path:path.join(folder,id+'-poses.png'),fullPage:true});
    }
    // Test real document players with the existing CSS cascade, not only rasterized exports.
    await page.evaluate(()=>document.body.replaceChildren());
    for(const name of ['pet.css','pet-interactions.css','pet-desktop.css','pet-animation.css','pet-character-motion.css'])await page.addStyleTag({path:path.join(root,'skins/tracer',name)});
    await page.evaluate(()=>{const host=document.createElement('div');host.className='pet-home has-builtin-animation';host.dataset.pet='nova';host.dataset.behavior='mining';host.innerHTML='<button class="pet-character"></button>';document.body.appendChild(host);window.player=TracerPetBuiltinAnimation.create({pet:'nova'});host.firstElementChild.appendChild(player.element);player.setAction('mining');});
    assert.equal(await page.locator('.pet-builtin-sprite').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('.rig-arm-right').evaluate(el=>getComputedStyle(el).animationName),'none');
    const start=await page.locator('.pet-builtin-sprite').getAttribute('data-frame');await page.waitForTimeout(2400);assert.notEqual(await page.locator('.pet-builtin-sprite').getAttribute('data-frame'),start);
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(30);assert.equal(await page.locator('.pet-builtin-sprite').getAttribute('data-playback'),'reduced-motion');assert.equal(await page.locator('.pet-builtin-sprite').getAttribute('data-frame'),'0');
    await page.evaluate(()=>player.destroy());
    console.log('PASS 3,072 rendered poses, at least 28 distinct rasters per cycle, all 96 loops, frame bounds, real CSS playback and reduced motion. Artifacts: '+folder);
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
