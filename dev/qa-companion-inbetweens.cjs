'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../skins/tracer'),output=path.resolve(__dirname,'../.cache/companion-32-qa');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/javascript');fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}}),origin='http://127.0.0.1:'+server.address().port,errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/pet-art.js');
    await page.setContent('<body style="background:#24332c;color:#e5ebd8;font:12px system-ui;display:grid;grid-template-columns:repeat(8,150px);gap:6px"></body>');
    for(const name of ['companion-inbetweens','garden-companion-atlas','pet-illustrated-atlas','garden-companion-motion'])await page.addScriptTag({url:origin+'/'+name+'.js'});
    const results=await page.evaluate(async()=>{
      const results=[];
      for(const [kind,action,atlas]of [['miso','tea',TracerPetIllustratedAtlas],['sprout','reading',TracerPetIllustratedAtlas],['wildflower','greet',TracerGardenCompanionAtlas],['lavender','water',TracerGardenCompanionAtlas]]){
        let pose=0;const element=document.createElement('span'),sheet=atlas.kinds[kind].normal[action];
        const layer=TracerGardenCompanionMotion.create(element,{kind,stage:4,rare:true,atlas,actions:[action,'idle'],sample:()=>({clip:action,frame:pose,frames:32})});
        layer.render(action);await new Promise(resolve=>{const check=()=>layer.waiting(action)?setTimeout(check,10):resolve();check();});
        const seen=new Set(),start=performance.now();
        for(pose=0;pose<32;pose++){
          layer.render(action);const image=element.querySelector('image'),crop=image.parentNode;
          seen.add(image.getAttribute('href')+crop.getAttribute('viewBox'));
          if(pose<8){const tile=document.createElement('div');tile.innerHTML='<p>'+kind+' / '+action+' / '+pose+'</p>'+element.innerHTML;document.body.appendChild(tile);}
          if(element.dataset.frames!=='32'||element.dataset.sourceFrames!=='16')throw new Error('incorrect frame metadata');
          if(pose%2&& !image.getAttribute('href').startsWith('data:image/png'))throw new Error('missing in-between');
        }
        results.push({kind,action,unique:seen.size,ms:Math.round(performance.now()-start),originalFrames:sheet.frames});layer.destroy();
      }
      return results;
    });
    await page.screenshot({path:path.join(output,'frames.png'),fullPage:true});
    for(const row of results)assert.equal(row.unique,32,row.kind+':'+row.action);
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
