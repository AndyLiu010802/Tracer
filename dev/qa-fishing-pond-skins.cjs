'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),F=require('../public/fishing-model'),out=path.join(root,'output/fishing-pond-skins');fs.mkdirSync(out,{recursive:true});
const save=(name,data)=>fs.writeFileSync(path.join(out,name),Buffer.from(data.split(',')[1],'base64'));
async function route(page){await page.route('http://pond-skins.test/**',async r=>{const url=new URL(r.request().url()),file=path.join(root,'skins/tracer',decodeURIComponent(url.pathname));if(!file.startsWith(path.join(root,'skins/tracer')+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:'missing'});await r.fulfill({path:file});});await page.goto('http://pond-skins.test/fishing-bait-desktop.html');}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:920,height:720},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.stack));await route(page);
 await page.setContent('<html><body style="margin:0;background:#d6dfd6"><div id="pond" style="width:920px;height:720px;position:relative"></div></body></html>');
 for(const name of ['fishing-model','fishing-lighting','fishing-aquatic-renderer','fishing-pond-skins','fishing-art'])await page.addScriptTag({url:'http://pond-skins.test/'+name+'.js'});
 await page.evaluate(catalog=>{
   window.requestAnimationFrame=()=>0;window.IntersectionObserver=undefined;
   window.gpu={buffers:new Set(),textures:new Set()};const p=WebGLRenderingContext.prototype;
   for(const [kind,set]of[['Buffer',gpu.buffers],['Texture',gpu.textures]]){const make=p['create'+kind],remove=p['delete'+kind];p['create'+kind]=function(){const v=make.call(this);set.add(v);return v;};p['delete'+kind]=function(v){set.delete(v);return remove.call(this,v);};}
   window.host=document.querySelector('#pond');window.pond=TracerFishingArt.createPond(host,{pond:{styleId:'meadow',decorations:[]},fish:[],catalog,interactive:true});
   if(pond.kind!=='webgl')throw Error('Expected actual WebGL');
 },F.catalog);
 const records=[];
 for(const skin of F.catalog.pondSkins){
   await page.evaluate(id=>pond.update({pond:{styleId:'meadow',skinId:id,decorations:[]}}),skin.id);
   await page.waitForFunction(()=>host.dataset.skinArt==='ready'&&host.dataset.skinModel==='blender');
   const record=await page.evaluate(()=>{pond.update({});const canvas=host.querySelector('canvas'),gl=canvas.getContext('webgl'),error=gl.getError();if(error)throw Error('GL '+error);return{png:canvas.toDataURL(),buffers:gpu.buffers.size,textures:gpu.textures.size};});
   save(skin.id+'.png',record.png);
   // Runtime shop thumbnails are renders of the same actual 3D scene, not the
   // flat source material. No additional WebGL context is created for cards.
   fs.writeFileSync(path.join(root,'skins/tracer/fishing-art/pond-skin-'+skin.id+'-preview-v1.png'),Buffer.from(record.png.split(',')[1],'base64'));delete record.png;
   record.id=skin.id;records.push(record);
 }
 // Verify all nine ground shapes, live fish, water anchors, and no geometry
 // allocation while receiving repeated desktop snapshots.
 const combos=await page.evaluate(async catalog=>{
   const result=[];const fish=['koi','trout','rivercrab'].map((id,i)=>({...catalog.fish.find(f=>f.id===id),instanceId:'qa_'+i,growth:90}));
   for(const spot of catalog.pondStyles){
     const base={styleId:spot.id,decorations:[]};pond.update({pond:base,fish});const points=[[-.6,-.7],[.5,.9],[0,0]].map(([x,z])=>pond.getWaterPosition({x,z}));
     for(const skin of catalog.pondSkins){pond.update({pond:{...base,skinId:skin.id}});const next=[[-.6,-.7],[.5,.9],[0,0]].map(([x,z])=>pond.getWaterPosition({x,z}));if(JSON.stringify(next)!==JSON.stringify(points))throw Error('Water moved '+spot.id+'/'+skin.id);const n=gpu.buffers.size;pond.update({});pond.update({});if(gpu.buffers.size!==n)throw Error('Buffer leak on refresh');if(host.querySelector('canvas').getContext('webgl').getError())throw Error('GL error '+skin.id);result.push(spot.id+'/'+skin.id);}
   }
   return result;
 },F.catalog);assert.equal(combos.length,90);
 await page.evaluate(()=>pond.update({pond:{styleId:'coral',skinId:'sunny',decorations:[]}}));await page.waitForFunction(()=>host.dataset.skinArt==='ready'&&host.dataset.skinModel==='blender');
 save('live-fish.png',await page.evaluate(()=>{pond.waterEvent({id:'skin-splash',x:0,z:0,strength:1});pond.update({});return host.querySelector('canvas').toDataURL();}));
 await page.mouse.move(460,440);await page.mouse.down();await page.mouse.move(670,440,{steps:5});await page.mouse.up();save('rotated.png',await page.evaluate(()=>{pond.update({});return host.querySelector('canvas').toDataURL();}));
 const overview=await page.evaluate(async ids=>{const c=document.createElement('canvas');c.width=1840;c.height=3300;const g=c.getContext('2d');g.fillStyle='#d6dfd6';g.fillRect(0,0,c.width,c.height);for(const [i,s]of ids.entries()){const img=new Image();img.src='/fishing-art/pond-skin-'+s.id+'-preview-v1.png';await img.decode();const x=(i%2)*920,y=Math.floor(i/2)*660,scale=Math.min(880/img.width,600/img.height);g.drawImage(img,x+(920-img.width*scale)/2,y+4,img.width*scale,img.height*scale);g.fillStyle='#2a453a';g.font='24px sans-serif';g.textAlign='center';g.fillText(s.name[0],x+460,y+626);}return c.toDataURL();},F.catalog.pondSkins);save('ten-3d-ponds.png',overview);
 await page.evaluate(()=>pond.destroy());const remaining=await page.evaluate(()=>({buffers:gpu.buffers.size,textures:gpu.textures.size}));assert.deepEqual(remaining,{buffers:0,textures:0});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'render-report.json'),JSON.stringify({records,groundCombinations:combos.length,remaining,errors},null,2));console.log(JSON.stringify({records,groundCombinations:combos.length,remaining}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
