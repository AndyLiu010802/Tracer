'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'../desktop/pet.js'),'utf8');
function fixture(t,area={x:0,y:0,width:1200,height:900},saved){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-pet-desktop-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 if(saved!==undefined)fs.writeFileSync(path.join(dir,'pet-window.json'),JSON.stringify(saved));
 const ipcMain=new EventEmitter(),windows=[],origin='http://127.0.0.1:18000';let cursor={x:100,y:100},shown=0;
 const handlers=new Map();ipcMain.handle=(name,handler)=>handlers.set(name,handler);ipcMain.removeHandler=name=>handlers.delete(name);
 class Window extends EventEmitter{
  constructor(options){super();this.bounds={x:options.x,y:options.y,width:options.width,height:options.height};this.visible=options.show!==false;this.dead=false;this.sent=[];this.webContents=new EventEmitter();this.webContents.mainFrame={url:origin+'/'};this.webContents.setWindowOpenHandler=()=>{};this.webContents.send=(...args)=>this.sent.push(args);windows.push(this);}
  getBounds(){return {...this.bounds};}isDestroyed(){return this.dead;}isVisible(){return this.visible;}
  setBounds(bounds){Object.assign(this.bounds,bounds);this.emit('moved');}setPosition(x,y){this.setBounds({x,y});}
  loadURL(url){this.webContents.mainFrame.url=url;}show(){this.visible=true;}showInactive(){this.show();}hide(){this.visible=false;}
  destroy(){this.dead=true;this.emit('closed');}
 }
 const screen={getPrimaryDisplay:()=>({workArea:area}),getDisplayMatching:()=>({workArea:area}),getDisplayNearestPoint:()=>({workArea:area}),getCursorScreenPoint:()=>cursor};
 const electron={BrowserWindow:Window,ipcMain,screen};
 const mod={exports:{}};vm.runInNewContext(source,{module:mod,URL,setTimeout,clearTimeout,__dirname:path.join(__dirname,'../desktop'),require:name=>name==='electron'?electron:name==='./garden-trail'?{attachGardenTrail:main=>require('../desktop/garden-trail').attachGardenTrail(main,electron)}:require(name)});
 const main=new Window({x:0,y:0,width:1000,height:800}),controller=mod.exports.attachPet(main,origin,dir,()=>shown++);controller.show();const pet=windows[1];pet.emit('ready-to-show');
 function event(win=pet){return{sender:win.webContents,senderFrame:win.webContents.mainFrame};}
 function send(type,value,from=event()){ipcMain.emit('tracer-pet-command',from,{type,value});}
 return{dir,main,pet,send,event,controller,screen,ipcMain,handlers,setCursor:value=>{cursor=value;},shown:()=>shown};
}

const workRequest={requestId:'f623b4d1-79de-4cad-ae76-d5523a54dacf',proposal:{type:'tasks',project:null,tasks:[{title:'Write report',notes:'',due:null,scheduled:null,priority:'medium',estimate:null,checklist:[]}]}};
test('native task creation validates the sender and proposal before forwarding to the main workspace',async t=>{
 const f=fixture(t),invoke=f.handlers.get('tracer-pet-create-work');
 for(const event of [f.event(f.main),{sender:f.pet.webContents,senderFrame:{url:'http://127.0.0.1:18000/pet.html'}}]) assert.equal((await invoke(event,workRequest)).ok,false);
 assert.equal((await invoke(f.event(),{...workRequest,proposal:{type:'shell',command:'delete'}})).ok,false);
 assert.equal(f.main.sent.length,0);
 const result=invoke(f.event(),workRequest),message=f.main.sent.at(-1);
 assert.equal(message[0],'tracer-pet-work-request');assert.equal(message[1].value.requestId,workRequest.requestId);
 let settled=false;result.then(()=>{settled=true;});
 const response={token:message[1].token,ok:true,result:{projectId:null,taskIds:['created'],noteId:null}};
 f.ipcMain.emit('tracer-pet-work-result',f.event(),response);await Promise.resolve();assert.equal(settled,false,'pet cannot forge its own creation success');
 f.ipcMain.emit('tracer-pet-work-result',f.event(f.main),response);
 assert.equal((await result).result.taskIds[0],'created');
});
test('native creation failures are returned and closing the main window settles pending requests',async t=>{
 const f=fixture(t),invoke=f.handlers.get('tracer-pet-create-work');
 let pending=invoke(f.event(),workRequest),message=f.main.sent.at(-1)[1];
 f.ipcMain.emit('tracer-pet-work-result',f.event(f.main),{token:message.token,ok:false,error:'companion-save-pending'});
 assert.equal((await pending).error,'companion-save-pending');
 pending=invoke(f.event(),workRequest);f.main.destroy();assert.equal((await pending).ok,false);
 assert.equal(f.handlers.has('tracer-pet-create-work'),false);assert.equal(f.ipcMain.listenerCount('tracer-pet-work-result'),0);
});

test('desktop drag keeps the grab offset, clamps to the display and persists its final position',t=>{
 const f=fixture(t);assert.equal(f.pet.bounds.width,220);assert.equal(f.pet.bounds.height,284);
 f.pet.setBounds({x:250,y:200});
 f.send('drag-start',{screenX:300,screenY:280});f.send('drag-move',{screenX:380,screenY:330});
 assert.deepEqual(f.pet.getBounds(),{x:330,y:250,width:220,height:284});
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'pet-window.json'),'utf8')).x,250,'moving does not write every pointer event');
 f.send('drag-move',{screenX:3000,screenY:3000});assert.equal(f.pet.bounds.x,980);assert.equal(f.pet.bounds.y,616);
 f.send('drag-end',{screenX:400,screenY:400});assert.equal(f.pet.bounds.x,350);assert.equal(f.pet.bounds.y,320);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,'pet-window.json'),'utf8')),{x:350,y:320,enabled:true,size:100});
 f.send('drag-move',{screenX:500,screenY:500});assert.equal(f.pet.bounds.x,350,'pointer move after release is ignored');
});

test('native movement rejects untrusted senders, invalid coordinates and starts outside its window',t=>{
 const f=fixture(t);f.pet.setBounds({x:200,y:200});const before=f.pet.getBounds();
 for(const start of [{screenX:-500,screenY:-500},{screenX:NaN,screenY:210},{screenX:210,screenY:Infinity},{screenX:'210',screenY:210},[],{screenX:1e10,screenY:210}]){
  f.send('drag-start',start);f.send('drag-move',{screenX:500,screenY:500});assert.deepEqual(f.pet.getBounds(),before);
 }
 for(const from of [f.event(f.main),{sender:f.pet.webContents,senderFrame:{url:'http://127.0.0.1:18000/pet.html'}},{sender:{},senderFrame:f.pet.webContents.mainFrame}]){
  f.send('drag-start',{screenX:210,screenY:210},from);f.send('drag-move',{screenX:500,screenY:500});assert.deepEqual(f.pet.getBounds(),before);
 }
 f.send('drag-start',{screenX:210,screenY:210});f.send('drag-move',{screenX:NaN,screenY:500});assert.deepEqual(f.pet.getBounds(),before);
 f.send('hide');f.send('drag-move',{screenX:500,screenY:500});assert.deepEqual(f.pet.getBounds(),before);assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'pet-window.json'),'utf8')).enabled,false);
 f.send('drag-start',{screenX:210,screenY:210});f.send('drag-move',{screenX:500,screenY:500});assert.deepEqual(f.pet.getBounds(),before,'hidden pet cannot begin dragging');
});

test('native cursor fallback, care forwarding and compact size remain available',t=>{
 const f=fixture(t);f.pet.setBounds({x:200,y:200});f.setCursor({x:250,y:250});f.send('drag-start');f.setCursor({x:350,y:300});f.send('drag-end');assert.equal(f.pet.bounds.x,300);assert.equal(f.pet.bounds.y,250);
 f.send('pet');assert.equal(f.main.sent.at(-1)[0],'tracer-pet-action');assert.equal(f.main.sent.at(-1)[1].type,'pet');
 f.send('expand',true);assert.equal(f.pet.bounds.width,380);assert.equal(f.pet.bounds.height,700);
 f.send('expand',false);assert.equal(f.pet.bounds.width,220);assert.equal(f.pet.bounds.height,284);
 f.send('open-home');assert.equal(f.shown(),1);
 for(const type of ['open-import','open-export']){f.send(type);assert.equal(f.main.sent.at(-1)[1].type,type);}
 assert.equal(f.shown(),3,'sharing commands reveal the main window');
 f.main.emit('closed');assert.equal(f.pet.dead,true);
});

test('desktop sizes clamp to small displays and support negative monitor coordinates',t=>{
 const f=fixture(t,{x:-250,y:-150,width:250,height:300});assert.deepEqual(f.pet.getBounds(),{x:-250,y:-150,width:220,height:284});
 f.send('drag-start',{screenX:-200,screenY:-100});f.send('drag-end',{screenX:-900,screenY:-900});assert.deepEqual(f.pet.getBounds(),{x:-250,y:-150,width:220,height:284});
 f.send('set-size',180);assert.deepEqual(f.pet.getBounds(),{x:-250,y:-150,width:250,height:300});
 f.send('expand',true);assert.equal(f.pet.bounds.width,250);assert.equal(f.pet.bounds.height,300);
});

test('compact size changes keep the bottom center, persist and update native snapshots immediately',t=>{
 const f=fixture(t);f.pet.setBounds({x:300,y:350});
 f.send('snapshot',{pet:{id:'sprout'},desktopSize:999},f.event(f.main));
 assert.equal(f.pet.sent.at(-1)[1].desktopSize,100,'renderer snapshot cannot override native size');
 f.send('set-size',149.6);assert.deepEqual(f.pet.getBounds(),{x:255,y:260,width:310,height:374});
 assert.equal(f.pet.sent.at(-1)[1].desktopSize,150);assert.equal(f.pet.sent.at(-1)[1].pet.id,'sprout');
 const saved=JSON.parse(fs.readFileSync(path.join(f.dir,'pet-window.json'),'utf8'));
 assert.deepEqual(saved,{x:255,y:260,size:150,enabled:true});
 const restarted=fixture(t,undefined,saved);assert.deepEqual(restarted.pet.getBounds(),f.pet.getBounds());
 restarted.send('snapshot',{pet:{id:'sprout'}},restarted.event(restarted.main));
 assert.equal(restarted.pet.sent.at(-1)[1].desktopSize,150);
 f.send('set-size',999);assert.deepEqual(f.pet.getBounds(),{x:228,y:206,width:364,height:428});assert.equal(f.pet.sent.at(-1)[1].desktopSize,180);
 f.send('set-size',-999);assert.deepEqual(f.pet.getBounds(),{x:300,y:394,width:220,height:240});assert.equal(f.pet.sent.at(-1)[1].desktopSize,70);
 f.pet.webContents.emit('did-finish-load');assert.equal(f.pet.sent.at(-1)[1].desktopSize,70);
 f.send('ready');assert.equal(f.pet.sent.at(-1)[1].desktopSize,70);
});

test('expanded windows retain their dimensions and restore the selected compact size',t=>{
 const f=fixture(t);f.send('expand',true);const before=f.pet.getBounds();
 f.send('set-size',175);assert.deepEqual(f.pet.getBounds(),before);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'pet-window.json'),'utf8')).size,175);
 f.send('expand',false);assert.equal(f.pet.bounds.width,355);assert.equal(f.pet.bounds.height,419);
 assert.equal(f.pet.bounds.x+f.pet.bounds.width/2,before.x+before.width/2+.5,'odd width rounds the anchor to a native pixel');
 assert.equal(f.pet.bounds.y+f.pet.bounds.height,before.y+before.height);
});

test('size commands reject nonnumbers and untrusted frames and cancel active drags',t=>{
 const f=fixture(t);f.pet.setBounds({x:300,y:300});const before=f.pet.getBounds();
 for(const value of [undefined,null,'140',NaN,Infinity,{},[],true]){f.send('set-size',value);assert.deepEqual(f.pet.getBounds(),before);}
 for(const from of [f.event(f.main),{sender:f.pet.webContents,senderFrame:{url:'http://127.0.0.1:18000/pet.html'}},{sender:{},senderFrame:f.pet.webContents.mainFrame}]){
  f.send('set-size',180,from);assert.deepEqual(f.pet.getBounds(),before);
 }
 f.send('drag-start',{screenX:320,screenY:340});f.send('set-size',140);const resized=f.pet.getBounds();
 f.send('drag-move',{screenX:800,screenY:800});f.send('drag-end',{screenX:900,screenY:900});assert.deepEqual(f.pet.getBounds(),resized,'resize ends the old grab offset');
 f.send('hide');f.send('set-size',130);assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'pet-window.json'),'utf8')).enabled,false,'resizing does not re-enable a hidden pet');
});

test('native size settings default safely and clamp restored values',t=>{
 for(const saved of [null,[],{size:'180'},{size:null},{size:false}]){
  const f=fixture(t,undefined,saved);assert.equal(f.pet.bounds.width,220);assert.equal(f.pet.bounds.height,284);
 }
 const large=fixture(t,undefined,{size:1000});assert.equal(large.pet.bounds.width,364);assert.equal(large.pet.bounds.height,428);
 const small=fixture(t,undefined,{size:10});assert.equal(small.pet.bounds.width,220);assert.equal(small.pet.bounds.height,240);
});

test('pet preload exposes bounded action messages and only expected drag coordinates',()=>{
 let bridge;const sent=[];
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop/pet-preload.js'),'utf8'),{process:{isMainFrame:true},require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer:{send:(...args)=>sent.push(args),on:()=>{}}})});
 bridge.send({type:'drag-start',value:{screenX:10,screenY:20,extra:'ignored'}});assert.equal(sent.length,1);assert.deepEqual(JSON.parse(JSON.stringify(sent[0][1])),{type:'drag-start',value:{screenX:10,screenY:20}});
 bridge.send({type:'drag-move',value:{screenX:NaN,screenY:20}});bridge.send({type:'unknown'});assert.equal(sent.length,1);
 bridge.send({type:'pet'});assert.equal(sent.at(-1)[1].type,'pet');
 for(const type of ['open-import','open-export']){bridge.send({type});assert.equal(sent.at(-1)[1].type,type);}
 const count=sent.length;
 for(const value of [undefined,null,'140',NaN,Infinity,{},[],true])bridge.send({type:'set-size',value});
 assert.equal(sent.length,count);
 bridge.send({type:'set-size',value:123.7});assert.equal(sent.at(-1)[1].value,124);
 bridge.send({type:'set-size',value:1});assert.equal(sent.at(-1)[1].value,70);
 bridge.send({type:'set-size',value:1000});assert.equal(sent.at(-1)[1].value,180);
});
