'use strict';
// Render every original pose for human anatomy review; geometry checks cannot
// infer how many drawn limbs a character has.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const kind=process.argv[2]||'ember';
if(!/^[a-z_]+$/.test(kind))throw Error('Invalid character');
const root=path.resolve(__dirname,'../skins/tracer');
const output=path.resolve(__dirname,'../.cache/companion-anatomy',kind);
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/javascript');fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1200}}),origin='http://127.0.0.1:'+server.address().port;
    await page.goto(origin+'/pet-art.js');
    await page.setContent('<style>body{margin:0;background:#26332f;color:#fff;font:16px system-ui}section{width:1568px;padding:16px}.frames{display:grid;grid-template-columns:repeat(8,192px);gap:4px}.frame svg{display:block;width:192px;height:212px}.frame p{margin:8px}h2{margin:4px 8px 12px}</style><body></body>');
    for(const name of ['companion-inbetweens','garden-companion-atlas','pet-illustrated-atlas','garden-companion-motion'])await page.addScriptTag({url:origin+'/'+name+'.js'});
    const report=await page.evaluate(async kind=>{
      const atlas=TracerPetIllustratedAtlas.kinds[kind]?TracerPetIllustratedAtlas:TracerGardenCompanionAtlas;
      if(!atlas.kinds[kind])throw Error('Unknown character');
      const report=[];
      for(const [variant,sheets]of Object.entries(atlas.kinds[kind]))for(const [action,sheet]of Object.entries(sheets)){
        let frame=0;
        const element=document.createElement('span');
        const layer=TracerGardenCompanionMotion.create(element,{kind,shiny:variant==='shiny',stage:4,rare:true,atlas,actions:Object.keys(sheets),sample:()=>({clip:action,frame,frames:sheet.frames})});
        layer.render(action);const started=performance.now();
        while(layer.waiting(action)){if(performance.now()-started>15000)throw Error('Image load timeout');await new Promise(r=>setTimeout(r,10));}
        const board=document.createElement('section');board.id=variant+'-'+action;
        board.innerHTML='<h2>'+kind+' / '+variant+' / '+action+'</h2><div class="frames"></div>';
        document.body.appendChild(board);
        for(frame=0;frame<sheet.frames;frame++){
          layer.render(action);
          if(element.dataset.motion!=='ready')throw Error('Frame not ready');
          const tile=document.createElement('div');tile.className='frame';tile.innerHTML='<p>'+(frame+1)+'</p>'+element.innerHTML;board.lastChild.appendChild(tile);
        }
        report.push({kind,variant,action,frames:sheet.frames,pages:(sheet.pages||[sheet]).map(p=>({src:p.src,sha256:p.sha256})),board:board.id});layer.destroy();
      }
      return report;
    },kind);
    for(const item of report)await page.locator('#'+item.board).screenshot({path:path.join(output,item.board+'.png')});
    fs.writeFileSync(path.join(output,'sources.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({kind,actions:report.length,frames:report.reduce((n,x)=>n+x.frames,0),output}));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
