'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib'), http = require('node:http'), vm = require('node:vm');
const Images = require('../lib/pet-image');
function crc(bytes) { let n = 0xffffffff; for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; } return (n ^ 0xffffffff) >>> 0; }
function chunk(name, data) { const bytes = Buffer.alloc(data.length + 12); bytes.writeUInt32BE(data.length); bytes.write(name, 4); data.copy(bytes, 8); bytes.writeUInt32BE(crc(bytes.subarray(4, -4)), bytes.length - 4); return bytes; }
function png(width = 1, height = 1) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 120, 200, 100, 255]))), chunk('IEND', Buffer.alloc(0))]);
}
function sheet(width=1024,height=width) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.alloc((width*4+1)*height))),chunk('IEND',Buffer.alloc(0))]);
}
const portrait = png(), dataURL = bytes => 'data:image/png;base64,' + bytes.toString('base64');
const profile = { name: 'Moss', kind: 'creature', personality: 'Quiet, curious and loves gardening.', distinctiveFeatures: 'White left ear and a crescent-shaped chest patch.', photo: dataURL(portrait) };
function temp(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-pet-art-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }

test('retained artwork storage returns an opaque URL and reads only validated local PNG assets',async t=>{
  const dir=temp(t),image=await Images.storeGenerated(dir,portrait);assert.match(image,Images.ASSET_RE);
  assert.deepEqual(await Images.readAsset(dir,image),portrait);assert.equal(image.includes(dir),false);
  for(const value of ['/api/pet-art/../.ai/personal.json','https://example.test/image.png','/api/pet-art/personal.json','C:/private.png'])assert.equal(await Images.readAsset(dir,value),null);
  for(const invalid of [Buffer.from('<svg/>'),Buffer.from('broken'),png(5000,1),portrait.subarray(0,-4),Buffer.alloc(Images.IMAGE_LIMIT+1)])await assert.rejects(Images.storeGenerated(dir,invalid),/invalid-image-response/);
  assert.equal(fs.readdirSync(path.join(dir,'.pet-art')).length,1);
});

test('legacy profile and photo validators still reject malformed backup reference metadata',()=>{
  for(const change of [{name:''},{name:'x'.repeat(41)},{kind:'anything'},{personality:'x'.repeat(601)},{distinctiveFeatures:'x'.repeat(401)},{distinctiveFeatures:{}},{distinctiveFeatures:'bad\0trait'}])assert.throws(()=>Images.input({...profile,...change}),/invalid-pet-profile/);
  for(const photo of ['https://example.test/photo.png',profile.photo.replace('image/png','image/jpeg'),'data:image/svg+xml;base64,PHN2Zz4=',profile.photo+'!',dataURL(Buffer.from('not an image')),dataURL(png(20000,2)),dataURL(png(5000,5000)),dataURL(portrait.subarray(0,-4))])assert.throws(()=>Images.input({...profile,photo}),/invalid-pet-photo/);
  assert.throws(()=>Images.input({...profile,photo:dataURL(Buffer.alloc(Images.PHOTO_LIMIT+1))}),/pet-photo-too-large/);
});

test('legacy animation metadata and identity assets retain path, dimension and junction guards',async t=>{
  const dir=temp(t);for(const animationPage of [-1,4,1.5,'0',null,NaN,Infinity,{}])assert.throws(()=>Images.input({...profile,animationPage}),/invalid-animation-page/);
  for(const identityImage of [undefined,'https://example.test/photo.png','/api/pet-art/../secret.png','C:/private.png','/api/pet-art/'+'a'.repeat(32)+'.png?secret=1'])assert.throws(()=>Images.input({...profile,animationPage:1,identityImage}),/invalid-identity-image/);
  const small=await Images.storeGenerated(dir,portrait);await assert.rejects(Images.identityBytes(dir,Images.input({...profile,animationPage:1,identityImage:small})),/invalid-identity-image/);
  const missing='/api/pet-art/'+'a'.repeat(32)+'.png';await assert.rejects(Images.identityBytes(dir,Images.input({...profile,animationPage:1,identityImage:missing})),/invalid-identity-image/);
  const file=path.join(dir,'.pet-art','b'.repeat(32)+'.png'),fd=fs.openSync(file,'w');fs.ftruncateSync(fd,Images.IMAGE_LIMIT+1);fs.closeSync(fd);
  await assert.rejects(Images.identityBytes(dir,Images.input({...profile,animationPage:1,identityImage:'/api/pet-art/'+'b'.repeat(32)+'.png'})),/invalid-identity-image/);
  const linked=temp(t),outside=path.join(linked,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'a'.repeat(32)+'.png'),sheet());fs.symlinkSync(outside,path.join(linked,'.pet-art'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(Images.identityBytes(linked,Images.input({...profile,animationPage:1,identityImage:missing})),/invalid-identity-image/);
});

test('legacy animation image validation and 32-frame package round trips use local fixtures',async t=>{
  for(const [width,height,accepted] of [[768,768,true],[1024,1014,true],[1014,1024,true],[767,767,false],[768,760,false],[1024,1013,false],[1013,1024,false],[1024,900,false]]){const bytes=sheet(width,height);if(accepted)assert.deepEqual(Images.generatedBytes(bytes,{animation:true}),bytes);else assert.throws(()=>Images.generatedBytes(bytes,{animation:true}),/invalid-animation-image/);}
  const dir=temp(t),bytes=sheet(2048,1024),image=await Images.storeGenerated(dir,bytes),Packages=require('../lib/pet-package');
  const pack=await Packages.exportPackage(dir,{id:'custom_'+'c'.repeat(32),name:'Legacy artwork',kind:'humanoid',personality:'',image,animation:{version:3,pages:Array(16).fill(image)}});
  assert.equal(pack.version,3);assert.equal(pack.artwork.layout,'atlas-8x4');assert.equal(Packages.inspect(pack).behaviors,16);
  const restored=await Packages.importPackage(temp(t),pack);assert.equal(restored.animation.version,3);assert.equal(restored.animation.pages.length,16);
});

test('JPEG and WebP dimensions are checked without decoding source pixels', () => {
  const jpeg = Buffer.from([0xff,0xd8,0xff,0xc0,0,11,8,0,2,0,3,1,1,0x11,0,0xff,0xd9]);
  assert.equal(Images.input({ ...profile, photo: 'data:image/jpeg;base64,' + jpeg.toString('base64') }).extension, 'jpg');
  jpeg.writeUInt16BE(10000, 7);
  assert.throws(() => Images.input({ ...profile, photo: 'data:image/jpeg;base64,' + jpeg.toString('base64') }), /invalid-pet-photo/);
  const webp = Buffer.alloc(30); webp.write('RIFF'); webp.writeUInt32LE(22, 4); webp.write('WEBPVP8 ', 8); webp.writeUInt32LE(10, 16);
  Buffer.from([0x9d,1,0x2a]).copy(webp,23); webp.writeUInt16LE(2,26); webp.writeUInt16LE(3,28);
  assert.equal(Images.input({ ...profile, photo: 'data:image/webp;base64,' + webp.toString('base64') }).mime, 'image/webp');
  webp.writeUInt16LE(15000,26);
  assert.throws(() => Images.input({ ...profile, photo: 'data:image/webp;base64,' + webp.toString('base64') }), /invalid-pet-photo/);
});

test('native generated files reject escaping junctions and over-limit files before reading image bytes', async t => {
  const dir = temp(t), room = path.join(dir,'job'), outside = path.join(dir,'outside');
  fs.mkdirSync(room); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside,'portrait.png'),portrait);
  fs.symlinkSync(outside,path.join(room,'escape'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(Images.generatedFile(room,path.join(room,'escape','portrait.png')),/invalid-image-response/);
  await assert.rejects(Images.generatedFile(room,'relative.png'),/invalid-image-response/);
  const file = path.join(room,'large.png'), fd = fs.openSync(file,'w'); fs.ftruncateSync(fd,Images.IMAGE_LIMIT+1); fs.closeSync(fd);
  await assert.rejects(Images.generatedFile(room,file),/invalid-image-response/);
});

test('native generated files allow only system temporary aliases and retain redirect and hardlink guards', async () => {
  const windowsTemporary = 'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp';
  function nativeFiles({ platform = 'darwin', redirected = {}, symlinks = [], nlink = 1, temporary = windowsTemporary } = {}) {
    const module = { exports: {} }, opened = [];
    const paths = platform === 'win32' ? path.win32 : path.posix;
    const canonical = value => redirected[value] || (platform === 'win32'
      ? value.replace(/^C:\\Users\\RUNNER~1(?=\\|$)/i, 'C:\\Users\\runneradmin')
      : value.replace(/^\/(var|tmp)(?=\/|$)/, '/private/$1'));
    const native = {
      realpath: async value => canonical(paths.resolve(value)),
      lstat: async value => ({ isSymbolicLink: () => symlinks.includes(value) }),
      open: async value => {
        opened.push(value);
        return { stat: async () => ({ isFile: () => true, nlink, size: portrait.length, birthtimeMs: 1000, mtimeMs: 1000, ctimeMs: 1000 }),
          read: async (buffer, offset, length, position) => ({ bytesRead: portrait.copy(buffer, offset, position, position + length) }), close: async () => {} };
      }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/pet-image.js'), 'utf8'), { module, Buffer, process: { platform },
      require: name => name === 'node:fs/promises' ? native : name === 'node:path' ? paths : name === 'node:os' ? { tmpdir: () => temporary } : name === './image-generation-errors' ? require('../lib/image-generation-errors') : require(name) });
    return { images: module.exports, opened };
  }
  for (const prefix of ['/var/folders/test', '/tmp']) {
    const room = prefix + '/job', file = room + '/native/result.png', native = nativeFiles();
    assert.deepEqual(await native.images.generatedFile(room, file, { createdAfter: 900 }), portrait);
    assert.deepEqual(native.opened, ['/private' + file]);
    assert.deepEqual(await native.images.generatedFile(room, '/private' + file), portrait, 'a native result may already use the canonical spelling');
  }
  const room = '/var/folders/test/job', file = room + '/native/result.png';
  const failures = [
    { platform: 'linux' },
    { redirected: { [room]: '/private/var/folders/test/other', [file]: '/private/var/folders/test/other/native/result.png' } },
    { redirected: { [file]: '/private/var/folders/test/job/different/result.png' } },
    { redirected: { [file]: '/private/var/folders/test/outside/result.png' } },
    { symlinks: ['/private/var/folders/test/job/native'] },
    { nlink: 2 }
  ];
  for (const setup of failures) await assert.rejects(nativeFiles(setup).images.generatedFile(room, file), /invalid-image-response/);
  const arbitrary = nativeFiles({ redirected: { '/elsewhere/job': '/private/var/folders/test/job', '/elsewhere/job/result.png': '/private/var/folders/test/job/result.png' } });
  await assert.rejects(arbitrary.images.generatedFile('/elsewhere/job', '/elsewhere/job/result.png'), /invalid-image-response/);
  assert.deepEqual(arbitrary.opened, [], 'unrecognized aliases fail before any image bytes are read');
  const winRoom = windowsTemporary + '\\job', winFile = winRoom + '\\native\\result.png';
  const winCanonical = 'C:\\Users\\runneradmin\\AppData\\Local\\Temp', win = nativeFiles({ platform: 'win32' });
  assert.deepEqual(await win.images.generatedFile(winRoom, winFile), portrait);
  assert.deepEqual(win.opened, [winCanonical + '\\job\\native\\result.png']);
  assert.deepEqual(await win.images.generatedFile(winRoom, winCanonical + '\\job\\native\\result.png'), portrait);
  for (const setup of [
    { redirected: { [winRoom]: winCanonical + '\\other', [winFile]: winCanonical + '\\other\\native\\result.png' } },
    { redirected: { [winFile]: winCanonical + '\\job\\different\\result.png' } },
    { symlinks: ['C:\\Users\\RUNNER~1'] },
    { symlinks: [windowsTemporary] },
    { symlinks: [winCanonical + '\\job\\native'] },
    { nlink: 2 }
  ]) await assert.rejects(nativeFiles({ platform: 'win32', ...setup }).images.generatedFile(winRoom, winFile), /invalid-image-response/);
  const outsideTemp = 'C:\\Users\\RUNNER~1\\Documents\\job';
  await assert.rejects(nativeFiles({ platform: 'win32' }).images.generatedFile(outsideTemp, outsideTemp + '\\result.png'), /invalid-image-response/);
});

test('local asset route persists across API instances and rejects cross-origin, bad hosts and unsafe paths', async t => {
  const dir = temp(t), previous = process.env.DOCS_PORTAL_DATA_DIR;
  process.env.DOCS_PORTAL_DATA_DIR = dir;
  delete require.cache[require.resolve('../server')];
  const { server } = require('../server');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); if (previous === undefined) delete process.env.DOCS_PORTAL_DATA_DIR; else process.env.DOCS_PORTAL_DATA_DIR = previous; delete require.cache[require.resolve('../server')]; });
  const result = {image:await Images.storeGenerated(dir,portrait)}, origin = 'http://127.0.0.1:' + server.address().port;
  let response = await fetch(origin + result.image); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin'); assert.deepEqual(Buffer.from(await response.arrayBuffer()), portrait);
  response = await fetch(origin + result.image, { method: 'HEAD' }); assert.equal(response.status,200); assert.equal((await response.text()).length,0);
  for (const headers of [{ origin: 'https://evil.test' }, { host: 'evil.test' }, { 'sec-fetch-site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => { http.get(origin + result.image, { headers }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject); });
    assert.equal(status,403,JSON.stringify(headers));
  }
  assert.equal((await fetch(origin + result.image, { method: 'POST' })).status,405);
  assert.equal((await fetch(origin + '/api/pet-art/' + 'a'.repeat(32) + '.png')).status,404);
  assert.equal((await fetch(origin + '/api/pet-art/personal.json')).status,404);
  assert.equal((await fetch(origin + '/api/ai/personal-pet-image', { method: 'POST', headers: { 'content-type':'application/json' }, body:JSON.stringify(profile) })).status,403);
});

test('retired generation stays unavailable in read-only mode while saved portraits remain readable', async t => {
  const dir = temp(t), previousData = process.env.DOCS_PORTAL_DATA_DIR, previousReadOnly = process.env.DOCS_PORTAL_READONLY_STORE;
  const result = {image:await Images.storeGenerated(dir,portrait)};
  process.env.DOCS_PORTAL_DATA_DIR = dir; process.env.DOCS_PORTAL_READONLY_STORE = '1'; delete require.cache[require.resolve('../server')];
  const { server } = require('../server'); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve));
    if (previousData === undefined) delete process.env.DOCS_PORTAL_DATA_DIR; else process.env.DOCS_PORTAL_DATA_DIR = previousData;
    if (previousReadOnly === undefined) delete process.env.DOCS_PORTAL_READONLY_STORE; else process.env.DOCS_PORTAL_READONLY_STORE = previousReadOnly;
    delete require.cache[require.resolve('../server')]; });
  const origin = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(origin + result.image)).status,200);
  for (const action of ['personal-pet-image','codex-pet-image']) {
    const response = await fetch(origin + '/api/ai/' + action, { method:'POST', headers:{ 'content-type':'application/json','x-tracer-ai':'1' }, body:JSON.stringify(profile) });
    assert.equal(response.status,410); assert.deepEqual(await response.json(), { error:'pet-generation-retired' });
  }
});

test('retired HTTP image endpoints never send uploaded photos to a configured provider', async t => {
  const dir = temp(t), previousData = process.env.DOCS_PORTAL_DATA_DIR, previousReadOnly = process.env.DOCS_PORTAL_READONLY_STORE;
  let providerCalls = 0, receivedBytes = 0, route = '';
  const provider = http.createServer((req, res) => {
    providerCalls++; route = req.url;
    req.on('data', bytes => { receivedBytes += bytes.length; });
    req.on('end', () => { res.writeHead(200, { 'content-type':'application/json' }); res.end(JSON.stringify({data:[{b64_json:portrait.toString('base64')}]})); });
  });
  await new Promise(resolve => provider.listen(0,'127.0.0.1',resolve));
  process.env.DOCS_PORTAL_DATA_DIR = dir; delete process.env.DOCS_PORTAL_READONLY_STORE; delete require.cache[require.resolve('../server')];
  const { server } = require('../server'); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await new Promise(resolve => provider.close(resolve));
    if (previousData === undefined) delete process.env.DOCS_PORTAL_DATA_DIR; else process.env.DOCS_PORTAL_DATA_DIR = previousData;
    if (previousReadOnly === undefined) delete process.env.DOCS_PORTAL_READONLY_STORE; else process.env.DOCS_PORTAL_READONLY_STORE = previousReadOnly;
    delete require.cache[require.resolve('../server')]; });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const post = (action, data) => fetch(origin + '/api/ai/' + action, {method:'POST', headers:{'content-type':'application/json','x-tracer-ai':'1'},body:JSON.stringify(data)});
  assert.equal((await post('personal-configure', {url:'http://127.0.0.1:' + provider.address().port + '/v1',protocol:'chat',model:'chat-model'})).status,200);
  const largePhoto = Buffer.concat([portrait.subarray(0,-12),chunk('tEXt',Buffer.from('Comment\0' + 'x'.repeat(1000000))),portrait.subarray(-12)]);
  for (const action of ['personal-pet-image','codex-pet-image']) {
    const response = await post(action,{...profile,photo:dataURL(largePhoto)});
    assert.equal(response.status,410);
    assert.deepEqual(await response.json(),{error:'pet-generation-retired'});
  }
  assert.equal(providerCalls,0); assert.equal(route,''); assert.equal(receivedBytes,0);
  assert.equal(fs.existsSync(path.join(dir,'.pet-art')),false);
});
