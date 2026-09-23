'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {_electron}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const {fixtures}=require('./qa-pet-animation.cjs');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'.cache/pet-qa-'));
const env={...process.env,TRACER_USER_DATA_DIR:profile,TRACER_DISABLE_INPUT_HOOK:'1',DOCS_PORTAL_PORT:'18159',DOCS_PORTAL_HOST:'127.0.0.1',DOCS_PORTAL_DATA_DIR:path.join(profile,'data'),DOCS_PORTAL_STATE_FILE:path.join(profile,'bookmarks.json')};
delete env.ELECTRON_RUN_AS_NODE;
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;}return(n^0xffffffff)>>>0;}
function pngChunk(name,data){const bytes=Buffer.alloc(data.length+12);bytes.writeUInt32BE(data.length);bytes.write(name,4);data.copy(bytes,8);bytes.writeUInt32BE(crc(bytes.subarray(4,-4)),bytes.length-4);return bytes;}
function portrait(){
 const size=32,pixels=Buffer.alloc((size*4+1)*size),header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 const rect=(x,y,w,h,color)=>{for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)for(let c=0;c<4;c++)pixels[row*(size*4+1)+1+col*4+c]=color[c];};
 rect(11,4,10,12,[233,188,147,255]);rect(10,3,12,5,[101,69,48,255]);rect(10,7,3,4,[101,69,48,255]);rect(13,9,1,2,[36,48,44,255]);rect(18,9,1,2,[36,48,44,255]);rect(14,13,4,1,[169,109,96,255]);rect(9,16,14,10,[107,160,141,255]);rect(7,17,3,8,[233,188,147,255]);rect(22,17,3,8,[233,188,147,255]);rect(11,26,4,4,[57,75,91,255]);rect(17,26,4,4,[57,75,91,255]);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',zlib.deflateSync(pixels)),pngChunk('IEND',Buffer.alloc(0))]);
}
const photoFile=path.join(profile,'reference.png');fs.writeFileSync(photoFile,portrait());let generatedSheets;
let rejectChat=false;const calls=[],imageCalls=[];
const provider=http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
 if(req.url==='/v1/images/edits'){
  imageCalls.push({type:req.headers['content-type'],body:body.toString('utf8')});res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:[{b64_json:generatedSheets[(imageCalls.length-1)%3].toString('base64')}]}));return;
 }
 calls.push(JSON.parse(body.toString('utf8')));res.writeHead(rejectChat?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify(rejectChat?{error:'unavailable'}:{choices:[{message:{content:'One small step at a time. I’m here with you!'},finish_reason:'stop'}]}));
});
function check(value,label){assert.ok(value,label);console.log('PASS '+label);}
async function seedNeeds(page,needs){
 await page.evaluate(needs=>{
  const state=Tracer.pet.read();Object.assign(state.pets[state.selected],needs);state.lastAction='';state.lastActionAt=0;state.updatedAt=Date.now();
  const raw=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',raw);dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw}));Tracer.pet.refresh(true);
 },needs);
}
async function nativeBounds(app){return app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet.html')).getBounds());}
async function quick(pet,action){await pet.locator('.pet-character').hover();await pet.locator('[data-quick-act='+action+']').click();}
async function dragCharacter(app,pet,page){
 await app.evaluate(({BrowserWindow,screen})=>{
  const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet.html')),area=screen.getDisplayMatching(win.getBounds()).workArea,bounds=win.getBounds();
  win.setPosition(area.x+Math.floor((area.width-bounds.width)/2),area.y+Math.floor((area.height-bounds.height)/2));win.show();win.focus();
 });
 const before=await nativeBounds(app),bond=await page.evaluate(()=>Tracer.pet.read().pets[Tracer.pet.read().selected].bond),character=await pet.locator('.pet-character').boundingBox();
 const start={x:character.x+character.width/2,y:character.y+character.height/2};
 await pet.mouse.move(start.x,start.y);await pet.mouse.down();
 await pet.mouse.move(start.x+70,start.y+35);await pet.mouse.up();
 await pet.waitForFunction(before=>Math.abs(screenX-before.x)>=20||Math.abs(screenY-before.y)>=20,before);
 const after=await nativeBounds(app);
 check(Math.abs(after.x-before.x)>=20||Math.abs(after.y-before.y)>=20,'dragging the character with a pointer moves its real native window');
 check((await page.evaluate(()=>Tracer.pet.read().pets[Tracer.pet.read().selected].bond))===bond,'dragging does not trigger a petting interaction');
 const saved=JSON.parse(fs.readFileSync(path.join(profile,'pet-window.json'),'utf8'));
 check(saved.x===after.x&&saved.y===after.y,'dragged native position is persisted');
}
(async()=>{
 await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
 const app=await _electron.launch({executablePath:require('electron'),args:[root,'--disable-gpu','--in-process-gpu'],env,timeout:45000});
 app.process().stderr.on('data',chunk=>fs.appendFileSync(path.join(profile,'electron.log'),chunk));
 try {
  let page;for(let i=0;i<100;i++){page=app.context().pages().find(p=>p.url().startsWith('http://127.0.0.1:18159/'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
  generatedSheets=(await fixtures(page)).sheets;
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/'));w.setFullScreen(false);w.setBounds({x:0,y:0,width:1200,height:900});});
  await page.click('#pet-open');
  check(await page.locator('.pet-name').innerText()==='Sprout','English default and starter companion');
  await page.click('[data-tab=collection]');check(await page.locator('.pet-unlock:disabled').count()===5,'earned companions start locked');
  await page.evaluate(()=>{
    // Restore one synthetic, ordinary project-garden harvest in this isolated
    // profile. A normal ticket earns Miso without adding a rare garden pet.
    const harvestedAt=Date.now(),projectId='qa-companion-garden';
    const mature=TracerGardenHarvest.mature(TracerGardenHarvest.fresh(),[{projectId,plantKind:'wildflower',stage:4,commemoratedAt:harvestedAt}],()=>100);
    localStorage.setItem(TracerGardenHarvest.key,JSON.stringify(TracerGardenHarvest.harvest(mature,projectId,harvestedAt)));
    for(let i=0;i<10;i++){const t=TracerModel.addTask(Tracer.store.data,{title:'Finished '+i,status:'done'});t.doneAt=Date.now()-(i%3)*86400000;TaskHistory.record(Tracer.store.data,t);}
    TracerModel.addTask(Tracer.store.data,{title:'Review the next small step',due:TracerModel.todayISO(),notes:'PRIVATE_NOT_FOR_AI'});
    const f=TracerFocus.fresh();f.totalMinutes=120;localStorage.setItem('tracer.focus.v1',JSON.stringify(f));
    Tracer.refreshWellness();Tracer.touch();
  });
  await page.waitForFunction(()=>Tracer.pet.read().unlocked.length===6);
  await page.locator('[data-act=select][data-value=nova]').click();
  check(await page.locator('.pet-name').innerText()==='Nova','project-garden harvest, focus and task achievements unlock all starter species');
  await page.screenshot({path:path.join(profile,'collection.png')});
  await page.click('[data-tab=care]');await page.click('[data-act=feed]');
  check(await page.evaluate(()=>Tracer.pet.read().pets.nova.food>95),'feeding updates persistent needs');
  await page.click('[data-act=sleep]');check(await page.locator('.pet-home').getAttribute('data-mood')==='sleeping','sleep animation follows care state');
  await page.click('[data-act=sleep]');await page.click('[data-act=play]');
  await page.locator('[data-act=focus-toggle]').click();await page.waitForFunction(()=>Tracer.focus.read().running);
  check(await page.locator('.pet-home').getAttribute('data-mood')==='focusing','shared Pomodoro starts from companion');
  await page.locator('[data-act=focus-toggle]').click();await page.waitForFunction(()=>!Tracer.focus.read().running);
  await page.evaluate(async port=>{localStorage.setItem('tracer.ai.mode','api');const r=await fetch('/api/ai/personal-configure',{method:'POST',headers:{'Content-Type':'application/json','x-tracer-ai':'1'},body:JSON.stringify({url:'http://127.0.0.1:'+port+'/v1',model:'local-fixture',protocol:'chat',apiKey:''})});if(!r.ok)throw new Error('configuration failed');},provider.address().port);
  await page.click('[data-tab=chat]');await page.fill('#pet-message','Hello friend');await page.click('.pet-send');await page.locator('.pet-chat-assistant').waitFor();
  check(calls.length===1&&!JSON.stringify(calls).includes('PRIVATE_NOT_FOR_AI'),'AI chat uses configured service and sends no task data');
  rejectChat=true;await page.fill('#pet-message','Keep this message');await page.click('.pet-send');await page.waitForFunction(()=>document.querySelector('.pet-chat-error').textContent.length>0);
  check(await page.inputValue('#pet-message')==='Keep this message','failed chat preserves input');rejectChat=false;
  await page.click('[data-tab=care]');await page.screenshot({path:path.join(profile,'home-en.png')});
  await page.click('[data-act=close]');await page.selectOption('#language-select','zh');await page.click('#pet-open');
  check(await page.locator('.pet-name').innerText()==='星芽','Chinese companion labels');await page.screenshot({path:path.join(profile,'home-zh.png')});
  const [pet]=await Promise.all([app.waitForEvent('window'),page.click('[data-act=desktop]')]);
  pet.on('pageerror',e=>errors.push(e.message));await pet.waitForURL('**/pet.html');await pet.locator('.pet-character').waitFor();
  check(await pet.locator('.pet-name').innerText()==='星芽','native desktop window receives live companion state');
  check(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet.html')).isAlwaysOnTop()),'companion stays above other windows');
  await pet.waitForFunction(()=>innerWidth===220&&innerHeight===260);
  await seedNeeds(page,{food:40,energy:85,joy:40,sleeping:false});
  await dragCharacter(app,pet,page);
  const initialBond=await page.evaluate(()=>Tracer.pet.read().pets.nova.bond);
  await pet.click('.pet-character');await pet.waitForFunction(()=>document.querySelector('.pet-home').dataset.action==='pet');
  check(await page.evaluate(bond=>Tracer.pet.read().pets.nova.bond>bond,initialBond),'clicking the character pets it and builds bond');
  check(await pet.locator('.pet-heart-one').isVisible(),'desktop petting displays a heart reaction');
  check(!await pet.locator('.pet-panel').isVisible(),'petting leaves the desktop panel collapsed');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/')).hide());
  await seedNeeds(page,{food:40,energy:85,joy:40,sleeping:false});
  await quick(pet,'feed');await pet.waitForFunction(()=>document.querySelector('.pet-home').dataset.action==='feed');
  check(await page.evaluate(()=>Tracer.pet.read().pets.nova.food>60),'compact feeding changes needs with the workspace hidden');
  check(await pet.locator('.pet-food-prop').isVisible(),'desktop feeding displays its food prop');
  await pet.screenshot({path:path.join(profile,'desktop-feeding.png'),omitBackground:true});
  await quick(pet,'play');await pet.waitForFunction(()=>document.querySelector('.pet-home').dataset.feedback==='cooldown');
  check((await pet.locator('.pet-speech').innerText()).trim().length>0,'a rapid repeated interaction explains its cooldown');
  await seedNeeds(page,{food:40,energy:85,joy:40,sleeping:false});
  await quick(pet,'play');await pet.waitForFunction(()=>document.querySelector('.pet-home').dataset.action==='play');
  check(await page.evaluate(()=>Tracer.pet.read().pets.nova.joy>60),'compact playing improves joy with visible action feedback');
  check(await pet.locator('.pet-ball-prop').isVisible(),'desktop playing displays its play prop');
  await seedNeeds(page,{food:100,energy:85,joy:40,sleeping:false});
  await quick(pet,'feed');await pet.waitForFunction(()=>document.querySelector('.pet-home').dataset.feedback==='full');
  check((await pet.locator('.pet-speech').innerText()).trim().length>0,'full companions explain why they do not eat again');
  await seedNeeds(page,{food:40,energy:85,joy:40,sleeping:true});
  await quick(pet,'feed');await pet.waitForFunction(()=>document.querySelector('.pet-home').dataset.feedback==='sleeping');
  check((await pet.locator('.pet-speech').innerText()).trim().length>0,'sleeping companions explain why feeding is unavailable');
  await quick(pet,'sleep');await page.waitForFunction(()=>!Tracer.pet.read().pets.nova.sleeping);
  check(!await pet.locator('.pet-panel').isVisible(),'quick care remains available without opening a panel');
  await pet.screenshot({path:path.join(profile,'desktop-compact.png'),omitBackground:true});
  await quick(pet,'expand');await pet.locator('.pet-panel').waitFor({state:'visible'});
  check(await pet.locator('.pet-home').evaluate(el=>el.scrollWidth<=innerWidth),'expanded companion fits its window');
  await pet.click('[data-act=sleep]');await page.waitForFunction(()=>Tracer.pet.read().pets.nova.sleeping);
  await pet.screenshot({path:path.join(profile,'desktop-expanded.png'),omitBackground:true});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().endsWith('/pet.html')).hide());
  await pet.click('[data-act=sleep]');await pet.click('[data-act=focus-toggle]');await page.waitForFunction(()=>Tracer.focus.read().running);
  check(true,'care and Pomodoro work while workspace is hidden to tray');
  await pet.click('[data-act=focus-toggle]');await page.waitForFunction(()=>!Tracer.focus.read().running);
  await pet.click('[data-act=open-task]');await page.locator('#f-title').waitFor();check((await page.inputValue('#f-title'))==='Review the next small step','reminder opens the correct task');
  await page.click('#f-close');await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);check(await page.evaluate(()=>Tracer.pet.read().selected)==='nova','companion selection and unlocks survive reload');
  await page.selectOption('#language-select','en');await pet.waitForFunction(()=>document.documentElement.lang==='en');
  await pet.click('[data-tab=collection]');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/')).hide());
  await pet.click('[data-act=open-create]');await page.locator('.pet-creator').waitFor();
  await page.selectOption('#pet-image-source','personal');
  check(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/')).isVisible()),'desktop creation opens the main workspace');
  const customName='Alexandria the Starlit Garden Companion',personality='Thoughtful and curious, loves shared meals and quiet gardening.';
  await page.setInputFiles('#pet-photo',photoFile);await page.waitForFunction(()=>document.querySelector('.pet-photo-preview')?.naturalWidth>0);
  await page.fill('#pet-custom-name',customName);await page.selectOption('#pet-custom-kind','humanoid');await page.fill('#pet-custom-personality',personality);
  check((await page.locator('.pet-kind-help').innerText()).includes('Share meals'),'humanoid choice explains friend-like behavior');
  check(imageCalls.length===0,'selecting a photo does not send it to the provider');
  await page.click('.pet-generate');await page.locator('.pet-adopt').waitFor({state:'visible'});
  const imagePath=await page.locator('.pet-result-frame .pet-animation-sheet').getAttribute('src');
  check(/^\/api\/pet-art\/[a-f0-9]{32}\.png$/.test(imagePath)&&await page.locator('.pet-result-frame .pet-animation-sheet').evaluate(img=>img.naturalWidth===1024),'generated atlas is decoded from the real local asset route');
  check(imageCalls.length===4&&imageCalls.every(call=>call.type.startsWith('multipart/form-data')&&call.body.includes(personality)&&!call.body.includes('PRIVATE_NOT_FOR_AI')),'four animation groups send the chosen photo and humanoid preferences without task data');
  await page.click('.pet-adopt');await page.waitForFunction(name=>document.querySelector('.pet-name')?.textContent===name,customName);
  const custom=await page.evaluate(()=>{const s=Tracer.pet.read();return s.customs.find(p=>p.id===s.selected);});
  check(custom.kind==='humanoid'&&custom.personality===personality&&!Object.hasOwn(custom,'photo'),'adoption saves form and personality without the reference photo');
  check(custom.animation?.version===1&&custom.animation.pages.length===4,'adoption stores the complete animation manifest');
  check(custom.animation.pages.every((image,index)=>fs.readFileSync(path.join(profile,'data','.pet-art',path.basename(image))).equals(generatedSheets[index])),'all four generated atlases are persisted as real PNGs');
  await pet.waitForFunction(name=>document.querySelector('.pet-name')?.textContent===name,customName);
  await pet.waitForFunction(()=>document.querySelector('.pet-character img')?.naturalWidth===1024);
  await pet.click('[data-tab=care]');
  check((await pet.locator('[data-act=feed]').innerText()).includes('Share a meal')&&(await pet.locator('[data-act=play]').innerText()).includes('Hang out')&&(await pet.locator('[data-act=sleep]').innerText()).includes('Rest'),'native humanoid care uses meals, shared activities and rest');
  await pet.click('[data-act=sleep]');await page.waitForFunction(id=>Tracer.pet.read().pets[id]?.sleeping,custom.id);
  check(await pet.locator('.pet-home').getAttribute('data-kind')==='humanoid','native custom companion receives type and care state');
  await pet.screenshot({path:path.join(profile,'desktop-custom-expanded.png'),omitBackground:true});
  await pet.click('[data-act=sleep]');await page.waitForFunction(id=>!Tracer.pet.read().pets[id]?.sleeping,custom.id);
  await pet.click('[data-tab=chat]');await pet.fill('#pet-message','What should we do after our shared meal?');await pet.click('.pet-send');await pet.locator('.pet-chat-assistant').waitFor();
  const customChat=JSON.stringify(calls.at(-1));
  check(customChat.includes(customName)&&customChat.includes(personality)&&customChat.includes('form is humanoid')&&!customChat.includes('PRIVATE_NOT_FOR_AI')&&!customChat.includes('data:image/')&&!customChat.includes(imagePath),'native chat includes character personality and form without photo or task content');
  await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
  check(await page.evaluate(id=>Tracer.pet.read().selected===id,custom.id),'custom companion selection survives main-window reload');
  await page.click('#pet-open');await page.waitForFunction(()=>document.querySelector('.pet-character img')?.naturalWidth===1024);
  check(custom.animation.pages.includes(await page.locator('.pet-character img').getAttribute('src')),'custom animation artwork survives main-window reload');
  await pet.reload();await pet.waitForFunction(name=>document.querySelector('.pet-name')?.textContent===name&&document.querySelector('.pet-character img')?.naturalWidth===1024,customName);
  // Use the visible toggle to size a reloaded desktop view, without fake IPC.
  await quick(pet,'expand');await pet.locator('.pet-panel').waitFor({state:'visible'});
  await quick(pet,'expand');await pet.waitForFunction(()=>innerWidth===220&&innerHeight===260);
  const compact=await pet.evaluate(()=>{const sprite=document.querySelector('.pet-character').getBoundingClientRect(),quick=document.querySelector('.pet-quick-actions').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,spriteLeft:sprite.left,spriteRight:sprite.right,spriteTop:sprite.top,spriteBottom:sprite.bottom,quickLeft:quick.left,quickRight:quick.right,quickBottom:quick.bottom};});
  check(compact.scroll<=compact.width&&compact.spriteLeft>=0&&compact.spriteRight<=compact.width&&compact.spriteTop>=0&&compact.spriteBottom<=compact.height&&compact.quickLeft>=0&&compact.quickRight<=compact.width&&compact.quickBottom<=compact.height,'custom sprite and icon controls fit the minimal native window');
  check(!await pet.locator('.pet-identity').isVisible()&&!await pet.locator('.pet-focus').isVisible(),'compact mode hides the long name and full timer');
  await pet.screenshot({path:path.join(profile,'desktop-custom-compact.png'),omitBackground:true});
  check(errors.length===0,'no renderer errors');
  console.log('Artifacts: '+profile);
 } finally {await app.close();await new Promise(r=>provider.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;provider.close();});
