'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../skins/tracer'),output=path.resolve(__dirname,'../.cache/companion-originals-qa');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/javascript');fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1080,height:1000}}),origin='http://127.0.0.1:'+server.address().port,errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/pet-art.js');
    await page.setContent('<style>body{background:#24332c;color:#e5ebd8;font:12px system-ui}.board{display:grid;grid-template-columns:repeat(6,165px);gap:10px;padding:8px}.board>div>svg{width:160px;height:176px;display:block}.board p{height:32px}</style><body></body>');
    for(const name of ['companion-inbetweens','garden-companion-atlas','pet-illustrated-atlas','garden-companion-motion'])await page.addScriptTag({url:origin+'/'+name+'.js'});
    const results=await page.evaluate(async()=>{
      const results=[];let board;
      for(const atlas of [TracerPetIllustratedAtlas,TracerGardenCompanionAtlas])for(const [kind,variants]of Object.entries(atlas.kinds))for(const [variant,sheets]of Object.entries(variants))for(const [action,sheet]of Object.entries(sheets)){
        if(sheet.frames!==32)continue;
        let pose=0,clip='idle';const element=document.createElement('span');
        const layer=TracerGardenCompanionMotion.create(element,{kind,shiny:variant==='shiny',stage:4,rare:true,atlas,actions:Object.keys(sheets),sample:()=>({clip,frame:pose,frames:32})});
        const wait=async action=>{const started=performance.now();while(layer.waiting(action)){if(performance.now()-started>15000)throw Error('load timeout');await new Promise(r=>setTimeout(r,10));}};
        if(results.length%12===0){board=document.createElement('section');board.className='board';document.body.appendChild(board);}
        const tile=label=>{const tile=document.createElement('div');tile.innerHTML='<p>'+kind+'/'+variant+' '+label+'</p>'+element.innerHTML;board.appendChild(tile);};
        await wait('idle');layer.render('idle');tile('idle before');
        const crop=()=>element.querySelector('image').parentNode,bodySize=cell=>Number(crop().getAttribute('height'))/cell.h;
        const allPages=Object.values(sheets).flatMap(s=>s.pages||[s]),metric=allPages.every(p=>p.identitySize>0)?'identitySize':'bodySize';
        const idleScale=bodySize(sheets.idle.cells[0])*(sheets.idle.pages?.[0]||sheets.idle)[metric];
        clip=action;layer.render(action);await wait(action);
        const seen=new Set();for(pose=0;pose<32;pose++){
          layer.render(action);if(element.dataset.motion!=='ready'||element.dataset.sourceFrames!=='32')throw Error('not original frames');
          const cell=sheet.cells[pose],source=sheet.pages[cell.page],href=element.querySelector('image').getAttribute('href');
          if(href!==source.src||href.startsWith('data:'))throw Error('wrong source page');
          seen.add(href+crop().getAttribute('viewBox'));
          if(Math.abs(bodySize(cell)*source[metric]-idleScale)>1e-6)throw Error('body resized between actions or pages');
          const scale=bodySize(cell);
          if(Math.abs(Number(crop().getAttribute('x'))+(cell.rootX-cell.x)*scale-80)>1e-6||Math.abs(Number(crop().getAttribute('y'))+(cell.rootY-cell.y)*scale-151)>1e-6)throw Error('body drift');
          if([0,15,16,31].includes(pose))tile(action+' '+(pose+1));
        }
        clip='idle';pose=0;layer.render('idle');tile('idle after');
        if(seen.size!==32)throw Error('missing original poses');results.push({kind,variant,action,originalFrames:seen.size});layer.destroy();
      }
      await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return results;
    });
    const boards=page.locator('.board');
    for(let i=0;i<await boards.count();i++)await boards.nth(i).screenshot({path:path.join(output,`transitions-${String(i+1).padStart(2,'0')}.png`)});
    assert.ok(results.length>0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({actions:results.length,originalFrames:results.length*32,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
