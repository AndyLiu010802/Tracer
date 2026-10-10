'use strict';
// Isolated renderer QA: no workspace, save data, location or server is accessed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),F=require('../public/fishing-model'),out=path.join(root,'output/fishing-pond-environments');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1000,height:760},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent('<html><body style="margin:0;background:#e8e8db"><div id="pond" style="width:1000px;height:720px"></div></body></html>');
 for(const name of ['fishing-model','fishing-lighting','fishing-aquatic-renderer','fishing-art'])await page.addScriptTag({content:fs.readFileSync(path.join(root,'skins/tracer/'+name+'.js'),'utf8')});
 const result=await page.evaluate(({catalog})=>{
   window.requestAnimationFrame=()=>0;
   const alive=new Set(),proto=WebGLRenderingContext.prototype,create=proto.createBuffer,remove=proto.deleteBuffer;proto.createBuffer=function(){const b=create.call(this);alive.add(b);return b;};proto.deleteBuffer=function(b){alive.delete(b);return remove.call(this,b);};
   const host=document.querySelector('#pond'),all=document.createElement('canvas');all.width=2400;all.height=1950;const c=all.getContext('2d');c.fillStyle='#e8e8db';c.fillRect(0,0,all.width,all.height);
   const fish=['koi','trout','rivercrab','goldfish','minnow'].map((id,i)=>({...catalog.fish.find(f=>f.id===id),instanceId:'qa_'+i,growth:70}));const renderer=TracerFishingArt.createPond(host,{pond:{styleId:'meadow'},catalog,fish});if(renderer.kind!=='webgl')throw Error('Expected WebGL, got '+renderer.kind);
   const records=[];for(const [i,style]of catalog.pondStyles.entries()){
     const pond={styleId:style.id,decorations:TracerFishingModel.defaultPondDecorations(style.id,0)},before=performance.now();renderer.update({pond});const elapsed=performance.now()-before,canvas=host.querySelector('canvas'),gl=canvas.getContext('webgl'),err=gl.getError();if(err)throw Error(style.id+' GL '+err);
     const image=canvas.toDataURL(),x=i%3*800,y=Math.floor(i/3)*650;c.drawImage(canvas,x,y,800,576);c.fillStyle='#324a42';c.font='24px sans-serif';c.textAlign='center';c.fillText(style.name[0],x+400,y+600);const count=alive.size,tick=performance.now();for(let j=0;j<3;j++)renderer.update({pond,fish});if(alive.size!==count)throw Error(style.id+' repeated refresh allocated geometry');records.push({id:style.id,image,elapsed,refreshMs:(performance.now()-tick)/3,buffers:count});
   }
   const compact=document.createElement('canvas');compact.width=1200;compact.height=990;const cc=compact.getContext('2d');cc.fillStyle='#e8e8db';cc.fillRect(0,0,1200,990);host.style.width='400px';host.style.height='300px';
   for(const [i,style]of catalog.pondStyles.entries()){renderer.update({pond:{styleId:style.id,decorations:TracerFishingModel.defaultPondDecorations(style.id,0)}});cc.drawImage(host.querySelector('canvas'),i%3*400,Math.floor(i/3)*330,400,288);}
   renderer.destroy();if(alive.size)throw Error('Leaked GPU buffers: '+alive.size);host.innerHTML='';return{overview:all.toDataURL(),compact:compact.toDataURL(),records};},{catalog:F.catalog});
 fs.writeFileSync(path.join(out,'desktop-nine-ponds.png'),Buffer.from(result.compact.split(',')[1],'base64'));fs.writeFileSync(path.join(out,'nine-ponds.png'),Buffer.from(result.overview.split(',')[1],'base64'));for(const row of result.records){fs.writeFileSync(path.join(out,row.id+'.png'),Buffer.from(row.image.split(',')[1],'base64'));delete row.image;}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'render-report.json'),JSON.stringify({records:result.records,errors},null,2));console.log(JSON.stringify(result.records));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
