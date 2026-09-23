'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('native hidden state pauses visuals independently of the document visibility API',()=>{
  const events=new Map(),sent=[],attrs=new Map();let receive,changes=0;
  const document={hidden:false,documentElement:{toggleAttribute:(k,v)=>attrs.set(k,v)},addEventListener:(n,f)=>events.set(n,f),dispatchEvent:e=>{assert.equal(e.type,'tracer-visibilitychange');changes++;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/render-activity.js'),'utf8'),{document,Event:class{constructor(type){this.type=type;}},window:{TracerWindow:{onState:fn=>receive=fn,send:action=>sent.push(action)}}});
  assert.deepEqual(sent,['state']);assert.equal(document.tracerHidden,false);
  receive({visible:false});assert.equal(document.hidden,false);assert.equal(document.tracerHidden,true);assert.equal(attrs.get('data-render-paused'),true);
  const count=changes;receive({visible:false});assert.equal(changes,count,'unchanged reports do not refresh the app');
  receive({visible:true});assert.equal(document.tracerHidden,false);
  document.hidden=true;events.get('visibilitychange')();assert.equal(document.tracerHidden,true);
  receive({visible:true});assert.equal(document.tracerHidden,true,'native show cannot override a hidden browser document');
  document.hidden=false;events.get('visibilitychange')();assert.equal(document.tracerHidden,false);
});
test('browser mode works without an Electron bridge',()=>{
  const document={hidden:true,documentElement:{toggleAttribute(){}},addEventListener(){},dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/render-activity.js'),'utf8'),{document,window:{},Event:class{}});
  assert.equal(document.tracerHidden,true);
});
