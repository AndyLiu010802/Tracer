'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), zlib = require('node:zlib');
const Edit = require('../skins/tracer/pet-edit-draft');
const Model = require('../skins/tracer/pet-model');
const Packages = require('../lib/pet-package');
const asset = number => '/api/pet-art/' + number.toString(16).padStart(32, '0') + '.png';
const profile = version => ({ id: 'custom_' + 'a'.repeat(32), name: ' Moss ', kind: 'creature', personality: ' Quiet ', image: asset(1),
  ...(version ? { animation: { version, pages: Array.from({ length: version >= 2 ? 16 : 4 }, (_, i) => asset(i + 1)) } } : {}) });
const clone = value => structuredClone(value);
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc(bytes) { let n = 0xffffffff; for (const byte of bytes) n = crcTable[(n ^ byte) & 255] ^ (n >>> 8); return (n ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12); bytes.writeUInt32BE(data.length); bytes.write(type, 4); data.copy(bytes, 8);
  bytes.writeUInt32BE(crc(bytes.subarray(4, -4)), bytes.length - 4); return bytes;
}
function png(width, height, pixels) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(rows, y * (1 + width * 4) + 1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
function decode(data) {
  const bytes = typeof data === 'string' ? Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64') : Buffer.from(data);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), blocks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') blocks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const rows = zlib.inflateSync(Buffer.concat(blocks));
  return { width, height, at(x, y) { const start = y * (width * 4 + 1) + 1 + x * 4; return [...rows.subarray(start, start + 4)]; } };
}
// A tiny nearest-neighbor canvas implementation lets these tests inspect actual
// converted PNG pixels without a browser, paid image generation, or user files.
class Canvas {
  constructor(width, height) { this.width = width; this.height = height; this.commands = []; this.context = { drawImage: (...args) => this.commands.push(args) }; }
  getContext() { return this.context; }
  toDataURL() {
    const pixels = new Uint8ClampedArray(this.width * this.height * 4);
    for (const [image, sx, sy, sw, sh, dx, dy, dw, dh] of this.commands) {
      for (let y = Math.max(0, Math.ceil(dy)); y < Math.min(this.height, Math.floor(dy + dh)); y++) {
        for (let x = Math.max(0, Math.ceil(dx)); x < Math.min(this.width, Math.floor(dx + dw)); x++) {
          const color = image.at(Math.floor(sx + (x + .5 - dx) * sw / dw), Math.floor(sy + (y + .5 - dy) * sh / dh));
          pixels.set(color, (y * this.width + x) * 4);
        }
      }
    }
    return 'data:image/png;base64,' + png(this.width, this.height, pixels).toString('base64');
  }
}
function environment(version = 1) {
  const loaded = [], closed = [], packs = [], validations = [], canvases = [];
  const options = {
    async loadImage(url, { signal } = {}) {
      assert.match(url, /^\/api\/pet-art\/[a-f0-9]{32}\.png$/); assert.ok(!signal?.aborted); loaded.push(url);
      const page = parseInt(url.slice('/api/pet-art/'.length), 16) - 1;
      return { width: version === 3 ? 1536 : version ? 768 : 320, height: version ? 768 : 160,
        at(x, y) {
          if (!version) return [x < 160 ? 30 : 210, 80, 160, 255];
          const column = Math.floor(x / 192), row = Math.floor(y / 192), localX = x % 192, localY = y % 192;
          return localX >= 48 && localX < 144 && localY >= 48 && localY < 144 ? [(page * 4 + row) * 10 + column, 80, 160, 255] : [0,0,0,0];
        }, close() { closed.push(url); }
      };
    },
    createCanvas(width, height) { const value = new Canvas(width, height); canvases.push(value); return value; },
    frameInsetsForImage() { return Array.from({ length: version===3?32:16 }, () => [0,0,0,0]); },
    async validateSheet(blob, settings) {
      assert.equal(blob.type, 'image/png');
      const image = decode(await blob.arrayBuffer());
      const cell = image.width / 4;
      assert.equal(image.width, image.height); assert.ok(image.width >= 768 && image.width <= 4096);
      for (let frame = 0; frame < 16; frame++) {
        const x = frame % 4 * cell, y = Math.floor(frame / 4) * cell;
        assert.equal(image.at(x + 1, y + Math.floor(cell / 2))[3], 0, 'converted art keeps a transparent boundary');
      }
      validations.push({ settings, image });
    },
    async storePackage(pack, settings) {
      assert.ok(!settings.signal?.aborted); packs.push(clone(pack));
      const inspected = Packages.inspect(pack);
      return { ...inspected.profile, image: asset(100), animation: { version: 2, pages: Array.from({ length: 16 }, (_, i) => asset(i + 100)), retainedFrames: inspected.retainedFrames } };
    }
  };
  return { options, loaded, closed, packs, validations, canvases };
}

test('edit signatures hash the canonical saved profile, including artwork and retained-frame metadata', async () => {
  const raw = { ...profile(2), photo: 'PRIVATE ORIGINAL', needs: { bond: 100 }, arbitrary: 'ignored' };
  const expected = crypto.createHash('sha256').update(JSON.stringify(Model.customProfile(raw))).digest('hex');
  assert.equal(await Edit.signature(raw), expected); assert.match(expected, /^[a-f0-9]{64}$/);
  assert.equal(await Edit.signature({ ...raw, name: 'Moss', personality: 'Quiet', needs: { bond: 0 } }), expected);
  assert.equal(await Edit.signature({ ...raw, animation: { ...raw.animation, retainedFrames: Array(16).fill(16) } }), expected);
  for (const change of [value => { value.name = 'New name'; }, value => { value.personality = 'Playful'; }, value => { value.kind = 'humanoid'; },
    value => { value.animation.pages[3] = asset(99); }, value => { value.animation.retainedFrames = Array(16).fill(4); }]) {
    const value = clone(raw); change(value); assert.notEqual(await Edit.signature(value), expected);
  }
  await assert.rejects(Edit.signature({ ...raw, image: 'https://example.test/private.png' }), /invalid-custom/);
});

test('32-frame editing crops exactly one square reference cell and preserves all action sheets', async () => {
  const env=environment(3),raw=profile(3),result=await Edit.prepare(raw,env.options);
  assert.equal(result.animationVersion,3);
  assert.deepEqual(result.pages,raw.animation.pages);
  assert.deepEqual(result.retainedFrames,Array(16).fill(32));
  const photo=decode(result.photo);assert.equal(photo.width,192);assert.equal(photo.height,192);
  assert.deepEqual(env.loaded,[raw.image]);assert.equal(env.packs.length,0);
});

test('v2 editing reuses every URL and retained flag, taking only an idle-frame reference screenshot', async () => {
  const env = environment(2), raw = profile(2); raw.animation.retainedFrames = [4, ...Array(15).fill(16)]; raw.photo = 'PRIVATE ORIGINAL';
  const original = clone(raw), result = await Edit.prepare(raw, env.options);
  assert.deepEqual(raw, original); assert.deepEqual(result.pages, raw.animation.pages); assert.notEqual(result.pages, raw.animation.pages);
  assert.deepEqual(result.retainedFrames, raw.animation.retainedFrames); assert.notEqual(result.retainedFrames, raw.animation.retainedFrames);
  assert.equal(result.animationVersion, 2); assert.equal(result.generationIdentity, raw.image);
  const photo = decode(result.photo); assert.equal(photo.width, 192); assert.equal(photo.height, 192); assert.deepEqual(photo.at(96, 96), [0,80,160,255]);
  assert.deepEqual(env.loaded, [raw.image]); assert.deepEqual(env.closed, [raw.image]); assert.equal(env.packs.length, 0); assert.equal(env.validations.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE ORIGINAL|custom_/);
});

test('four-page v1 conversion retains each action and repeats its four original frames consecutively', async () => {
  const env = environment(), raw = profile(1), original = clone(raw), result = await Edit.prepare(raw, env.options);
  assert.deepEqual(raw, original); assert.deepEqual(result.retainedFrames, Array(16).fill(4)); assert.equal(result.pages.length, 16);
  assert.equal(result.generationIdentity, result.pages[0]); assert.equal(env.packs.length, 1); assert.equal(env.validations.length, 16);
  assert.deepEqual(env.loaded, raw.animation.pages); assert.deepEqual(env.closed, env.loaded);
  assert.deepEqual(env.packs[0].companion, { name: 'Moss', kind: 'creature', personality: 'Quiet' });
  for (let action = 0; action < 16; action++) {
    const image = decode(env.packs[0].artwork.images[action].data), cell = image.width / 4;
    for (let frame = 0; frame < 16; frame++) {
      assert.deepEqual(image.at(frame % 4 * cell + cell / 2, Math.floor(frame / 4) * cell + cell / 2), [action * 10 + Math.floor(frame / 4),80,160,255]);
    }
    assert.equal(env.validations[action].settings.version, 2); assert.equal(env.validations[action].settings.retainedFrames, 4);
  }
  assert.deepEqual(Object.keys(result), ['photo','animationVersion','pages','generationIdentity','retainedFrames']);
});

test('three-page legacy packs keep the existing idle fallback for their four missing actions', async () => {
  const env = environment(), raw = profile(1); raw.animation.pages.pop();
  await Edit.prepare(raw, env.options);
  assert.deepEqual(env.loaded, [asset(1),asset(2),asset(3),asset(1)]);
  const first = env.packs[0].artwork.images[0];
  for (let action = 12; action < 16; action++) assert.deepEqual(env.packs[0].artwork.images[action], first);
});

test('legacy conversion preserves existing border masks without stretching or moving the remaining artwork', async () => {
  const env = environment(), load = env.options.loadImage;
  env.options.loadImage = async (...args) => {
    const image = await load(...args), at = image.at;
    image.at = (x, y) => x % 192 < 8 ? [255,0,0,255] : x % 192 === 104 && y % 192 >= 48 && y % 192 < 144 ? [255,255,255,255] : at(x, y);
    return image;
  };
  env.options.frameInsetsForImage = () => Array.from({ length: 16 }, () => [0,0,0,.05]);
  const result = await Edit.prepare(profile(1), env.options), photo = decode(result.photo);
  assert.equal(photo.at(2, 96)[3], 0, 'reference screenshot also honors the old residue mask');
  assert.deepEqual(photo.at(104, 96), [255,255,255,255], 'reference preserves full-cell coordinates');
  const sheet = decode(env.packs[0].artwork.images[0].data), cell = sheet.width / 4;
  for (let frame = 0; frame < 16; frame++) {
    const x = frame % 4 * cell, y = Math.floor(frame / 4) * cell;
    assert.equal(sheet.at(x + 6, y + 100)[3], 0, 'old cross-frame strip stays hidden inside the new margin');
    assert.deepEqual(sheet.at(x + 108, y + 100), [255,255,255,255], 'clipping does not stretch the remaining source');
  }
  const unreadable = environment(); unreadable.options.frameInsetsForImage = () => { throw new Error('animation-load-failed'); };
  await assert.rejects(Edit.prepare(profile(1), unreadable.options), /animation-load-failed/);
  assert.equal(unreadable.packs.length, 0); assert.deepEqual(unreadable.closed, unreadable.loaded);
  const dense = environment(2), denseLoad = dense.options.loadImage;
  dense.options.loadImage = async (...args) => {
    const image = await denseLoad(...args), at = image.at;
    image.at = (x, y) => x % 192 >= 184 ? [255,0,0,255] : at(x, y);
    return image;
  };
  dense.options.frameInsetsForImage = () => Array.from({ length: 16 }, () => [0,.05,0,0]);
  const kept = await Edit.prepare(profile(2), dense.options), densePhoto = decode(kept.photo);
  assert.equal(densePhoto.at(190, 96)[3], 0, 'existing v2 references use the same visible-frame mask');
  assert.deepEqual(kept.pages, profile(2).animation.pages); assert.equal(dense.packs.length, 0);
});

test('a static portrait becomes sixteen equivalent padded actions without cropping its original proportions', async () => {
  const env = environment(0), raw = profile(), original = clone(raw), result = await Edit.prepare(raw, env.options);
  assert.deepEqual(raw, original); assert.deepEqual(result.retainedFrames, Array(16).fill(1));
  assert.deepEqual(env.loaded, [raw.image]); assert.deepEqual(env.closed, env.loaded); assert.equal(env.validations.length, 1);
  const photo = decode(result.photo); assert.equal(photo.width, 320); assert.equal(photo.height, 160);
  const images = env.packs[0].artwork.images; assert.equal(images.length, 16);
  for (const item of images) assert.deepEqual(item, images[0]);
  const sheet = decode(images[0].data), cell = sheet.width / 4;
  for (let frame = 0; frame < 16; frame++) {
    const x = frame % 4 * cell, y = Math.floor(frame / 4) * cell;
    assert.deepEqual(sheet.at(x + Math.floor(cell * .25), y + Math.floor(cell * .5)), [30,80,160,255]);
    assert.deepEqual(sheet.at(x + Math.floor(cell * .75), y + Math.floor(cell * .5)), [210,80,160,255]);
    assert.equal(sheet.at(x + Math.floor(cell * .5), y + Math.floor(cell * .2))[3], 0, 'wide portraits retain their letterbox');
  }
});

test('preparation cancellation closes a late decoded source and never writes a package', async () => {
  const gate = deferred(), started = deferred(), controller = new AbortController(), env = environment();
  let closes = 0;
  env.options.loadImage = async () => { started.resolve(); return gate.promise; };
  const pending = Edit.prepare(profile(1), { ...env.options, signal: controller.signal });
  await started.promise; controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  gate.resolve({ width: 768, height: 768, close() { closes++; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closes, 1); assert.equal(env.canvases.length, 0); assert.equal(env.packs.length, 0);
  await assert.rejects(Edit.prepare(profile(1), { ...env.options, signal: controller.signal }), { name: 'AbortError' });
});

test('validation or storage failure leaves the saved companion untouched, and cancellation stops conversion', async () => {
  const raw = profile(1), original = clone(raw), env = environment(), controller = new AbortController();
  env.options.validateSheet = async () => { controller.abort(); };
  await assert.rejects(Edit.prepare(raw, { ...env.options, signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(raw, original); assert.equal(env.packs.length, 0); assert.deepEqual(env.closed, env.loaded);
  const bad = environment(0); bad.options.validateSheet = async () => { throw new Error('invalid-animation-sheet'); };
  await assert.rejects(Edit.prepare(profile(), bad.options), /invalid-animation-sheet/); assert.equal(bad.packs.length, 0);
  const saving = environment(0); saving.options.storePackage = async () => { throw new Error('pet-package-save-failed'); };
  await assert.rejects(Edit.prepare(profile(), saving.options), /pet-package-save-failed/); assert.deepEqual(saving.closed, saving.loaded);
});

test('conversion uses only the local package importer and rejects responses that drop retained-frame metadata', async t => {
  const env = environment(0), requests = [];
  delete env.options.storePackage;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    const pack = JSON.parse(options.body); Packages.inspect(pack);
    return { ok: true, json: async () => ({ image: asset(100), animation: { version: 2, pages: Array.from({ length: 16 }, (_, i) => asset(i + 100)), retainedFrames: pack.artwork.retainedFrames } }) };
  });
  const signal = new AbortController().signal;
  await Edit.prepare(profile(), { ...env.options, signal });
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/api/pet-package/import');
  assert.equal(requests[0].options.method, 'POST'); assert.equal(requests[0].options.headers['x-tracer-pet'], '1'); assert.equal(requests[0].options.signal, signal);
  const bad = environment(0); bad.options.storePackage = async () => ({ image: asset(100), animation: { version: 2, pages: Array.from({ length: 16 }, (_, i) => asset(i + 100)) } });
  await assert.rejects(Edit.prepare(profile(), bad.options), /invalid-animation-response/);
});

test('invalid profiles and unsafe source dimensions fail before conversion or storage', async () => {
  for (const raw of [null, {}, { ...profile(), id: 'sprout' }, { ...profile(2), image: asset(99) }, { ...profile(), image: 'data:image/png;base64,AA==' }]) {
    const env = environment(); await assert.rejects(Edit.prepare(raw, env.options), /invalid-custom/); assert.equal(env.loaded.length, 0); assert.equal(env.packs.length, 0);
  }
  const env = environment(); let closed = false;
  env.options.loadImage = async () => ({ width: 5000, height: 5000, close() { closed = true; } });
  await assert.rejects(Edit.prepare(profile(1), env.options), /invalid-animation-image/);
  assert.equal(closed, true); assert.equal(env.canvases.length, 0); assert.equal(env.packs.length, 0);
});
