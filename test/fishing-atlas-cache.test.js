'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fishing-atlas-cache-'));
Object.assign(process.env,{DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:dir,DOCS_PORTAL_STATE_FILE:path.join(dir,'state.json')});
const {server}=require('../server');let origin;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});});
function get(url,headers={}){return new Promise((resolve,reject)=>http.get(origin+url,{headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));}).on('error',reject));}
test('model atlas refreshes after art changes and revalidates unchanged bytes',async()=>{
  for(const file of ['fish-model-v1.png','rods-model-v1.png']){
    const url='/fishing-art/'+file+'?layout=current',fresh=await get(url);
    assert.equal(fresh.status,200);assert.equal(fresh.headers['cache-control'],'no-cache');assert.match(fresh.headers.etag,/^"[a-f0-9]{64}"$/);
    const cached=await get(url,{'if-none-match':fresh.headers.etag});assert.equal(cached.status,304);assert.equal(cached.body.length,0);
    const changed=await get(url,{'if-none-match':'"old-model-art"'});assert.equal(changed.status,200);assert.deepEqual(changed.body,fresh.body);
  }
  const bait=await get('/fishing-art/baits-v1.png');assert.equal(bait.headers['cache-control'],'public, max-age=86400');
});
