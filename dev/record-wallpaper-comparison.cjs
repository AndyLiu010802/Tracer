'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(root,'.cache/wallpaper-comparison-'));
Object.assign(process.env,{DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:path.join(folder,'data'),DOCS_PORTAL_STATE_FILE:path.join(folder,'state.json')});
const {server}=require('../server'),items=require('../public/wallpaper-catalog.json').filter(i=>i.type==='dynamic');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
  try{
    await page.route(origin+'/previous-motion.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'.cache/wallpaper-motion-before-natural.js'),'utf8')}));
    await page.route(origin+'/compare',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"><canvas id="out" width="1280" height="440"></canvas><script src="/previous-motion.js"></script><script>window.PreviousMotion=TracerWallpaperMotion</script><script src="/wallpaper-flow.js"></script><script src="/wallpaper-motion.js"></script></body>'}));
    await page.goto(origin+'/compare');
    const result=await page.evaluate(async items=>{
      await Promise.all(items.flatMap(i=>[PreviousMotion.load(i),TracerWallpaperMotion.load(i)]));
      const out=document.querySelector('#out'),ctx=out.getContext('2d'),a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=640;a.height=b.height=400;
      const stream=out.captureStream(20),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000}),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);const finished=new Promise(r=>recorder.onstop=r);recorder.start();
      const metrics=[];
      for(const item of items){
        const measure=M=>{const x=a.getContext('2d');M.draw(a,item,0);const first=x.getImageData(0,0,640,400).data;M.draw(a,item,1);const second=x.getImageData(0,0,640,400).data;let count=0;for(let j=0;j<first.length;j+=4)if(Math.max(Math.abs(first[j]-second[j]),Math.abs(first[j+1]-second[j+1]),Math.abs(first[j+2]-second[j+2]))>=18)count++;return count/(640*400);};metrics.push({id:item.id,before:measure(PreviousMotion),after:measure(TracerWallpaperMotion)});
        const start=performance.now();for(let frame=0;frame<60;frame++){
          const t=frame/20;PreviousMotion.draw(a,item,t);TracerWallpaperMotion.draw(b,item,t);ctx.fillStyle='#111a21';ctx.fillRect(0,0,1280,440);ctx.drawImage(a,0,40);ctx.drawImage(b,640,40);ctx.fillStyle='#dcebf0';ctx.font='16px Microsoft YaHei, sans-serif';ctx.fillText(item.name+'  ·  原动效',18,27);ctx.fillText(item.name+'  ·  新版标准速度',658,27);ctx.fillStyle='#ffffff50';ctx.fillRect(639,40,2,400);await new Promise(r=>setTimeout(r,Math.max(0,start+(frame+1)*50-performance.now())));
        }
      }
      recorder.stop();await finished;stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return{base64:btoa(binary),metrics};
    },items);
    const destination=path.join(root,'design/dynamic-wallpapers-v2');fs.writeFileSync(path.join(destination,'natural-motion-comparison.webm'),Buffer.from(result.base64,'base64'));fs.writeFileSync(path.join(destination,'natural-motion-comparison.json'),JSON.stringify(result.metrics,null,2));console.log(JSON.stringify(result.metrics));console.log('Video: '+path.join(destination,'natural-motion-comparison.webm'));
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
