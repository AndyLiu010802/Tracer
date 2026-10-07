'use strict';const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const desktop=path.join(__dirname,'../desktop');
test('picker preload exposes only strict ready, session point/cancel, and validated init/armed subscriptions',()=>{
 const ipc=new EventEmitter(),sent=[];ipc.send=(...a)=>sent.push(a);let bridge;
 vm.runInNewContext(fs.readFileSync(path.join(desktop,'local-vfx-placement-preload.js'),'utf8'),{require:n=>{assert.equal(n,'electron');return {ipcRenderer:ipc,contextBridge:{exposeInMainWorld(n,b){assert.equal(n,'TracerLocalVfxPlacement');bridge=b;}}};}});
 assert.deepEqual(Object.keys(bridge).sort(),['cancel','onArmed','onInit','pick','ready']);
 const session='01234567-89ab-4cde-8fab-0123456789ab';bridge.ready();assert.equal(sent[0][0],'tracer-local-vfx-placement-ready');
 const valid=vm.runInNewContext('({session:"'+session+'",u:.25,v:.75})');
 // IPC serialization produces plain records in the preload realm. Use JSON
 // inside that realm to exercise accessors/prototypes without cross-realm bias.
 const exposed={bridge,sent,ipc};vm.createContext(exposed);
 assert.equal(bridge.pick(valid),false,'foreign prototype rejected before serialization');
 const realm={require:n=>({ipcRenderer:ipc,contextBridge:{exposeInMainWorld(n,b){realm.bridge=b;}}})};vm.createContext(realm);vm.runInContext(fs.readFileSync(path.join(desktop,'local-vfx-placement-preload.js'),'utf8'),realm);
 assert.equal(vm.runInContext('bridge.pick({session:"'+session+'",u:.25,v:.75})',realm),true);
 for(const value of ['{session:"'+session+'",u:1,v:.5}','{session:"'+session+'",u:.5,v:.5,script:"bad"}','{session:"bad",u:.5,v:.5}','{get session(){throw Error("getter");},u:.5,v:.5}'])assert.equal(vm.runInContext('bridge.pick('+value+')',realm),false);
 let called=0;const off=realm.bridge.onArmed(()=>called++);vm.runInContext('ipc=undefined',realm);
 const packet=vm.runInContext('({session:"'+session+'"})',realm);ipc.emit('tracer-local-vfx-placement-armed',{},packet);assert.equal(called,1);off();off();assert.equal(ipc.listenerCount('tracer-local-vfx-placement-armed'),0);
});
test('picker renderer waits for main armed, consumes one trusted left click and closes subscriptions',()=>{
 const listeners=new Map(),instruction={textContent:''},button={addEventListener(){},removeEventListener(){}},selected=[],cancelled=[];let init,armed,hide,removed=0;
 const bridge={ready(){},onInit(fn){init=fn;return()=>removed++;},onArmed(fn){armed=fn;return()=>removed++;},pick:v=>selected.push(v),cancel:v=>cancelled.push(v)};
 const context={window:{TracerLocalVfxPlacement:bridge},innerWidth:800,innerHeight:600,document:{getElementById:()=>instruction,querySelector:()=>button,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{assert.equal(listeners.get(n),f);listeners.delete(n);}},addEventListener:(n,f)=>{assert.equal(n,'pagehide');hide=f;}};
 vm.runInNewContext(fs.readFileSync(path.join(desktop,'local-vfx-placement-renderer.js'),'utf8'),context);const session='01234567-89ab-4cde-8fab-0123456789ab';init({session,armDelayMs:300});
 const evt=(changes={})=>({isTrusted:true,button:0,clientX:240,clientY:360,target:{closest:()=>null},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...changes});
 let event=evt();listeners.get('pointerdown')(event);assert(event.prevented&&event.stopped);assert.equal(selected.length,0);
 armed({session:'old'});listeners.get('pointerdown')(evt());assert.equal(selected.length,0);armed({session});assert.match(instruction.textContent,/Esc/);
 listeners.get('pointerdown')(evt({isTrusted:false}));listeners.get('pointerdown')(evt({button:2}));assert.equal(selected.length,0);
 listeners.get('pointerdown')(evt());listeners.get('pointerdown')(evt());assert.equal(selected.length,1);assert.equal(selected[0].u,.3);assert.equal(selected[0].v,.6);assert.equal(selected[0].session,session);
 hide();hide();assert.equal(removed,2);assert.equal(listeners.size,0);assert.equal(cancelled.length,0);
});
