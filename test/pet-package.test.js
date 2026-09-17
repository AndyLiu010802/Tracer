'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const Packages = require('../lib/pet-package'), Images = require('../lib/pet-image');
function crc(bytes) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for(let i=0;i<8;i++) value=value&1?0xedb88320^(value>>>1):value>>>1; } return (value^0xffffffff)>>>0; }
function chunk(type, value) { const result=Buffer.alloc(value.length+12); result.writeUInt32BE(value.length);result.write(type,4);value.copy(result,8);result.writeUInt32BE(crc(result.subarray(4,-4)),result.length-4);return result; }
function png(edge=1, metadata='', color=120) {
  const header=Buffer.alloc(13);header.writeUInt32BE(edge);header.writeUInt32BE(edge,4);header[8]=8;header[9]=6;
  const pixels=Buffer.alloc(edge*(1+edge*4));
  for(let y=0;y<edge;y++) for(let x=0;x<edge;x++) pixels.set([color,160,140,255],y*(edge*4+1)+1+x*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),...(metadata?[chunk('tEXt',Buffer.from('Comment\0'+metadata))]:[]),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
function room(t) { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-package-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir; }
function image(bytes) { return { sha256:crypto.createHash('sha256').update(bytes).digest('hex'),data:bytes.toString('base64') }; }
function packet(count=1, version=1) { const common=image(png(count===1?1:768));return { format:'tracer-companion',version,companion:{name:'Robin',kind:'humanoid',personality:'Patient and curious.'},artwork:{layout:count===1?'portrait':'atlas-4x4',...(version===2?{animationVersion:2}:{}),images:Array.from({length:count},(_,index)=>version===2?image(png(768,'',120+index)):clone(common))} }; }
const clone = value => JSON.parse(JSON.stringify(value));

test('a portable export contains all artwork and explicit public fields without source metadata or private state',async t=>{
  const dir=room(t), bytes=png(1,'PRIVATE_PHOTO_PATH'), url=await Images.storeGenerated(dir,bytes);
  const result=await Packages.exportPackage(dir,{id:'custom_'+'a'.repeat(32),name:'Robin',kind:'humanoid',personality:'Quiet.',image:url,photo:'PRIVATE_PHOTO',chat:['PRIVATE_CHAT'],apiKey:'PRIVATE_KEY',needs:{bond:100}});
  assert.deepEqual(Object.keys(result),['format','version','companion','artwork']);
  assert.deepEqual(result.companion,{name:'Robin',kind:'humanoid',personality:'Quiet.'});
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('/api/pet-art'));
  const clean=Buffer.from(result.artwork.images[0].data,'base64');assert.ok(!clean.includes(Buffer.from('PRIVATE_PHOTO_PATH')));
  assert.equal(Packages.inspect(result).images.length,1);
  const friend=room(t), imported=await Packages.importPackage(friend,result);
  assert.equal(imported.name,'Robin');assert.equal(imported.animation,undefined);
  assert.deepEqual(await Images.readAsset(friend,imported.image),clean);
  assert.equal(Packages.inspect(await Packages.exportPackage(friend,imported)).profile.id,imported.id,'re-export preserves duplicate identity');
});

test('legacy and expanded animated packages preserve order and stable identity across machines',async t=>{
  for(const count of [3,4]) {
    const raw=packet(count), inspected=Packages.inspect(raw);assert.equal(inspected.behaviors,count*4);assert.equal(inspected.animationVersion,1);
    const firstDir=room(t), first=await Packages.importPackage(firstDir,raw), second=await Packages.importPackage(room(t),clone(raw));
    assert.equal(first.id,second.id);assert.notDeepEqual(first.animation.pages,second.animation.pages);
    assert.equal(first.animation.pages.length,count);assert.equal(first.animation.version,1);assert.equal(first.image,first.animation.pages[0]);
    assert.deepEqual(await Packages.exportPackage(firstDir,first),raw,'legacy exports retain their exact version 1 schema');
    const legacyIdentity=crypto.createHash('sha256').update(JSON.stringify({profile:raw.companion,layout:raw.artwork.layout,images:raw.artwork.images.map(item=>item.sha256)})).digest('hex').slice(0,32);
    assert.equal(first.id,'custom_'+legacyIdentity,'existing collection duplicate identities stay stable');
  }
});

test('sixteen-frame action packages preserve version, every ordered sheet and identity through export and import',async t=>{
  const raw=packet(16,2), inspected=Packages.inspect(raw), dir=room(t);
  assert.equal(inspected.animationVersion,2);assert.equal(inspected.behaviors,16);assert.equal(inspected.images.length,16);
  const profile=await Packages.importPackage(dir,raw);
  assert.equal(profile.animation.version,2);assert.equal(profile.animation.pages.length,16);assert.equal(profile.image,profile.animation.pages[0]);
  assert.equal(new Set(profile.animation.pages).size,16);
  for(const [index,url]of profile.animation.pages.entries()) assert.deepEqual(await Images.readAsset(dir,url),Buffer.from(raw.artwork.images[index].data,'base64'));
  const exported=await Packages.exportPackage(dir,profile);assert.deepEqual(exported,raw);
  assert.equal(Packages.inspect(exported).profile.id,profile.id);
  const copied=await Packages.importPackage(room(t),exported);assert.equal(copied.id,profile.id);assert.equal(copied.animation.version,2);
  assert.ok(Packages.LIMIT > 16 * Math.ceil(Images.IMAGE_LIMIT/3)*4 + 16384,'request bound accommodates sixteen maximum-size images and bounded metadata');
  assert.ok(Packages.LIMIT <= 257*1024*1024,'the larger package limit remains bounded');
});

test('mixed retained legacy frames and newly drawn actions survive sharing without changing pure dense package identities',async t=>{
  const raw=packet(16,2), denseId=Packages.inspect(raw).profile.id;
  const explicitDense=clone(raw);explicitDense.artwork.retainedFrames=Array(16).fill(16);
  assert.equal(Packages.inspect(explicitDense).profile.id,denseId,'explicit default metadata retains the existing dense duplicate identity');
  assert.equal(Packages.inspect(explicitDense).retainedFrames,undefined);
  raw.artwork.retainedFrames=[1,4,16,...Array(13).fill(4)];
  const inspected=Packages.inspect(raw), dir=room(t), original=clone(raw);
  assert.notEqual(inspected.profile.id,denseId,'a retained-frame declaration is part of the portable artwork identity');
  assert.deepEqual(inspected.retainedFrames,raw.artwork.retainedFrames);
  inspected.retainedFrames[0]=16;assert.equal(raw.artwork.retainedFrames[0],1,'inspection metadata is a defensive copy');
  const imported=await Packages.importPackage(dir,raw);
  assert.deepEqual(imported.animation.retainedFrames,original.artwork.retainedFrames);
  assert.deepEqual(await Packages.exportPackage(dir,imported),original);
  const copied=await Packages.importPackage(room(t),await Packages.exportPackage(dir,imported));
  assert.equal(copied.id,imported.id);assert.deepEqual(copied.animation.retainedFrames,original.artwork.retainedFrames);
  for(const [index,url]of imported.animation.pages.entries()) assert.deepEqual(await Images.readAsset(dir,url),Buffer.from(original.artwork.images[index].data,'base64'));
  const denseProfile=await Packages.importPackage(room(t),explicitDense);
  assert.equal(denseProfile.animation.retainedFrames,undefined,'all-sixteen defaults are omitted from normalized manifests');
});

test('retained metadata rejects malformed and legacy-version declarations before writing assets',async t=>{
  const raw=packet(16,2);let writes=0;
  for(const retainedFrames of [undefined,null,[],Array(15).fill(4),Array(17).fill(4),Array(16),Array(16).fill(0),Array(16).fill(2),Array(16).fill('4'),Array(16).fill({count:4})])
    await assert.rejects(Packages.importPackage(room(t),{...raw,artwork:{...raw.artwork,retainedFrames}},async()=>{writes++;}),/invalid-pet-package/);
  for(const count of [1,3,4]) {
    const legacy=packet(count);legacy.artwork.retainedFrames=Array(16).fill(count===1?1:4);
    await assert.rejects(Packages.importPackage(room(t),legacy,async()=>{writes++;}),/invalid-pet-package/);
  }
  assert.equal(writes,0);
});

test('mixed package versions, layouts and animation counts are rejected before writing any artwork',async t=>{
  const raw=packet(16,2), invalids=[];
  for(const mutate of [
    p=>p.version=1, p=>delete p.artwork.animationVersion, p=>p.artwork.animationVersion=1, p=>p.artwork.animationVersion='2',
    p=>p.artwork.layout='portrait', p=>p.artwork.images=p.artwork.images.slice(0,4), p=>p.artwork.images.pop(), p=>p.artwork.images.push(p.artwork.images[0]),
    p=>p.artwork.rows=4
  ]) { const value=clone(raw);mutate(value);invalids.push(value); }
  const legacyWithFlag=packet(4);legacyWithFlag.artwork.animationVersion=2;invalids.push(legacyWithFlag);
  const legacyWithDenseCount=clone(raw);legacyWithDenseCount.version=1;delete legacyWithDenseCount.artwork.animationVersion;invalids.push(legacyWithDenseCount);
  const oversizedImage=clone(raw);oversizedImage.artwork.images[0].data='A'.repeat(Math.ceil(Images.IMAGE_LIMIT/3)*4+4);invalids.push(oversizedImage);
  let writes=0;
  for(const value of invalids) await assert.rejects(Packages.importPackage(room(t),value,async()=>{writes++;}),/invalid-pet-package/);
  assert.equal(writes,0);
  assert.throws(()=>Packages.inspect({...raw,version:3}),/unsupported-pet-package/);
});

test('invalid formats, damaged images, oversized fields and unsupported versions never reach storage',async t=>{
  const valid=packet(), invalids=[null,[],{...valid,version:3},{...valid,format:'other'},{...valid,photo:'private'}];
  for(const mutate of [p=>p.companion.name='',p=>p.companion.name='x'.repeat(41),p=>p.companion.personality='x'.repeat(601),p=>p.companion.kind='other',p=>p.artwork.layout='svg',p=>p.artwork.images=[],p=>p.artwork.images.push(image(png())),p=>p.artwork.images[0].sha256='0'.repeat(64),p=>p.artwork.images[0].data='https://evil.test/image.png',p=>p.artwork.images[0].data+=' ',p=>p.artwork.images[0].path='../private',p=>p.artwork.images[0]=image(Buffer.from('<svg onload=alert(1)>'))]) { const p=clone(valid);mutate(p);invalids.push(p); }
  let writes=0;
  for(const raw of invalids) await assert.rejects(Packages.importPackage(room(t),raw,async()=>{writes++;}),/pet-package/);
  assert.equal(writes,0);
  const badAtlas=packet(3);badAtlas.artwork.images[2]=image(png());
  await assert.rejects(Packages.importPackage(room(t),badAtlas),/invalid-pet-package/);
});

test('a failed asset write rolls back only this import and a missing export never yields a partial pack',async t=>{
  const dir=room(t), existing=await Images.storeGenerated(dir,png()), original=await Images.readAsset(dir,existing);let calls=0;
  await assert.rejects(Packages.importPackage(dir,packet(3),async(...args)=>{if(++calls===2)throw new Error('disk-full');return Images.storeGenerated(...args);}),/pet-package-save-failed/);
  assert.equal(fs.readdirSync(path.join(dir,'.pet-art')).length,1);assert.deepEqual(await Images.readAsset(dir,existing),original);
  calls=0;
  await assert.rejects(Packages.importPackage(dir,packet(16,2),async(...args)=>{if(++calls===16)throw new Error('disk-full');return Images.storeGenerated(...args);}),/pet-package-save-failed/);
  assert.equal(fs.readdirSync(path.join(dir,'.pet-art')).length,1);assert.deepEqual(await Images.readAsset(dir,existing),original);
  await assert.rejects(Packages.exportPackage(dir,{id:'custom_'+'a'.repeat(32),name:'Robin',kind:'humanoid',image:'/api/pet-art/'+'b'.repeat(32)+'.png'}),/pet-art-missing/);
});

test('local sharing endpoints require no AI setup and enforce origin, body and read-only guards',async t=>{
  const dir=room(t), previous={data:process.env.DOCS_PORTAL_DATA_DIR,readonly:process.env.DOCS_PORTAL_READONLY_STORE};
  process.env.DOCS_PORTAL_DATA_DIR=dir;delete process.env.DOCS_PORTAL_READONLY_STORE;delete require.cache[require.resolve('../server')];
  const {server}=require('../server');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const post=(action,body,extra={})=>fetch(origin+'/api/pet-package/'+action,{method:'POST',headers:{'content-type':'application/json','x-tracer-pet':'1',...extra},body:JSON.stringify(body)});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));for(const [key,value]of [['DOCS_PORTAL_DATA_DIR',previous.data],['DOCS_PORTAL_READONLY_STORE',previous.readonly]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}delete require.cache[require.resolve('../server')];});
  const raw=packet(), preview=await post('inspect',raw);assert.equal(preview.status,200);assert.equal(fs.existsSync(path.join(dir,'.pet-art')),false);
  assert.equal((await post('import',raw,{'x-tracer-pet':'0'})).status,403);
  assert.equal((await post('import',raw,{origin:'https://evil.test'})).status,403);
  assert.equal((await post('import',raw,{'sec-fetch-site':'cross-site'})).status,403);
  const badHost = await new Promise((resolve,reject)=>{const request=require('node:http').request(origin+'/api/pet-package/import',{method:'POST',headers:{host:'evil.test','content-type':'application/json','x-tracer-pet':'1'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end(JSON.stringify(raw));});
  assert.equal(badHost,403);
  assert.equal((await post('export',{junk:'x'.repeat(9000)})).status,413);
  const response=await post('import',raw);assert.equal(response.status,200);const profile=await response.json();
  assert.equal((await fetch(origin+profile.image)).status,200);
  const exported=await post('export',profile);assert.equal(exported.status,200);assert.deepEqual(await exported.json(),raw);
  const dense=packet(16,2), densePreview=await post('inspect',dense);assert.equal(densePreview.status,200);
  const denseSummary=await densePreview.json();assert.equal(denseSummary.animationVersion,2);assert.equal(denseSummary.behaviors,16);
  const denseImported=await post('import',dense);assert.equal(denseImported.status,200);
  const denseProfile=await denseImported.json();assert.equal(denseProfile.animation.version,2);assert.equal(denseProfile.animation.pages.length,16);
  const denseExported=await post('export',denseProfile);assert.equal(denseExported.status,200);assert.deepEqual(await denseExported.json(),dense);
  const retained=clone(dense);retained.artwork.retainedFrames=[1,4,16,...Array(13).fill(4)];
  const retainedPreview=await post('inspect',retained);assert.equal(retainedPreview.status,200);
  assert.equal((await retainedPreview.json()).animationVersion,2);
  const retainedImported=await post('import',retained);assert.equal(retainedImported.status,200);
  const retainedProfile=await retainedImported.json();assert.deepEqual(retainedProfile.animation.retainedFrames,retained.artwork.retainedFrames);
  const retainedExported=await post('export',retainedProfile);assert.equal(retainedExported.status,200);assert.deepEqual(await retainedExported.json(),retained);
  process.env.DOCS_PORTAL_READONLY_STORE='1';delete require.cache[require.resolve('../server')];const readonly=require('../server').server;
  await new Promise(resolve=>readonly.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+readonly.address().port+'/api/pet-package/';
    for(const [action,expected] of [['import',403],['inspect',200]]) assert.equal((await fetch(base+action,{method:'POST',headers:{'content-type':'application/json','x-tracer-pet':'1'},body:JSON.stringify(raw)})).status,expected);
  } finally {await new Promise(resolve=>readonly.close(resolve));}
});
