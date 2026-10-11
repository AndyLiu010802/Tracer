'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fishing-atlas-cache-'));
Object.assign(process.env,{DOCS_PORTAL_SKIN:'tracer',DOCS_PORTAL_DATA_DIR:dir,DOCS_PORTAL_STATE_FILE:path.join(dir,'state.json')});
const {server}=require('../server');let origin;
const fsp=require('node:fs/promises'),originalRead=fsp.readFile;let atlasReads=0;
fsp.readFile=async function(file,...args){if(/(?:fish|rods)-model-v\d+\.png$/.test(String(file)))atlasReads++;return originalRead.call(this,file,...args);};
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{fsp.readFile=originalRead;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});});
function get(url,headers={}){return new Promise((resolve,reject)=>http.get(origin+url,{headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));}).on('error',reject));}
test('model atlas refreshes after art changes and revalidates unchanged bytes',async()=>{
  for(const file of ['fish-model-v1.png','rods-model-v1.png']){
    const url='/fishing-art/'+file+'?layout=current',fresh=await get(url);
    assert.equal(fresh.status,200);assert.equal(fresh.headers['cache-control'],'no-cache');assert.match(fresh.headers.etag,/^"[a-f0-9]{64}"$/);
    const readsBefore=atlasReads;
    const cached=await get(url,{'if-none-match':fresh.headers.etag});assert.equal(cached.status,304);assert.equal(cached.body.length,0);
    assert.equal(atlasReads,readsBefore,'unchanged PNG is not read again for browser revalidation');
    const changed=await get(url,{'if-none-match':'"old-model-art"'});assert.equal(changed.status,200);assert.deepEqual(changed.body,fresh.body);
  }
  const bait=await get('/fishing-art/baits-v1.png');assert.equal(bait.headers['cache-control'],'public, max-age=86400');
});
test('a replaced atlas invalidates its metadata cache and returns a new content hash',async()=>{
  const url='/fishing-art/fish-model-v1.png',fresh=await get(url),savedStat=fsp.stat,savedRead=fsp.readFile;
  const matches=file=>String(file).endsWith('fish-model-v1.png');
  // Simulate an on-disk replacement at the file-system boundary; never edit
  // production artwork merely to exercise the HTTP cache.
  fsp.stat=async function(file,...args){const stat=await savedStat.call(this,file,...args);return matches(file)?Object.assign(Object.create(Object.getPrototypeOf(stat)),stat,{mtimeMs:stat.mtimeMs+1000,size:stat.size+1}):stat;};
  fsp.readFile=async function(file,...args){const bytes=await savedRead.call(this,file,...args);return matches(file)?Buffer.concat([bytes,Buffer.from([0])]):bytes;};
  try{const changed=await get(url,{'if-none-match':fresh.headers.etag});assert.equal(changed.status,200);assert.notEqual(changed.headers.etag,fresh.headers.etag);assert.equal(changed.body.length,fresh.body.length+1);const before=atlasReads;assert.equal((await get(url,{'if-none-match':changed.headers.etag})).status,304);assert.equal(atlasReads,before);}
  finally{fsp.stat=savedStat;fsp.readFile=savedRead;}
  const restored=await get(url,{'if-none-match':'"obsolete"'});assert.equal(restored.headers.etag,fresh.headers.etag);assert.deepEqual(restored.body,fresh.body);
});
