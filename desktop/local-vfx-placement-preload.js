'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const C={ready:'tracer-local-vfx-placement-ready',init:'tracer-local-vfx-placement-init',armed:'tracer-local-vfx-placement-armed',point:'tracer-local-vfx-placement-point',cancel:'tracer-local-vfx-placement-cancel'};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function exact(v,keys){try{return !!v&&typeof v==='object'&&!Array.isArray(v)&&[null,Object.prototype].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));}catch{return false;}}
function subscription(channel,validate,callback){if(typeof callback!=='function')return()=>{};const listener=(_e,value)=>{if(validate(value))callback(Object.freeze({...value}));};ipcRenderer.on(channel,listener);let live=true;return()=>{if(live){live=false;ipcRenderer.removeListener(channel,listener);}};}
contextBridge.exposeInMainWorld('TracerLocalVfxPlacement',Object.freeze({
 ready(){ipcRenderer.send(C.ready,{});},
 onInit(callback){return subscription(C.init,v=>exact(v,['session','armDelayMs'])&&uuid(v.session)&&v.armDelayMs===300,callback);},
 onArmed(callback){return subscription(C.armed,v=>exact(v,['session'])&&uuid(v.session),callback);},
 pick(v){if(!exact(v,['session','u','v'])||!uuid(v.session)||![v.u,v.v].every(n=>Number.isFinite(n)&&n>=0&&n<1))return false;ipcRenderer.send(C.point,{session:v.session,u:v.u,v:v.v});return true;},
 cancel(v){if(!exact(v,['session'])||!uuid(v.session))return false;ipcRenderer.send(C.cancel,{session:v.session});return true;}
}));
