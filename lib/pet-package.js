'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const Images = require('./pet-image');
const Model = require('../skins/tracer/pet-model');
// Sixteen independently bounded PNGs, including their base64 expansion and metadata.
const LIMIT = 257 * 1024 * 1024;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const invalid = () => new Error('invalid-pet-package');
function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function companion(raw) {
  if (!keys(raw, ['name', 'kind', 'personality']) || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 40 ||
      /[\x00-\x1f]/.test(raw.name) || !['humanoid', 'creature'].includes(raw.kind) || typeof raw.personality !== 'string' ||
      raw.personality.length > 600 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(raw.personality)) throw invalid();
  return { name: raw.name.trim(), kind: raw.kind, personality: raw.personality.trim() };
}
function retained(raw, version = 2) {
  if (!Array.isArray(raw) || raw.length !== 16 || !Array.from({ length: 16 }, (_, index) => index).every(index => (version===3?[32]:[1,4,16]).includes(raw[index]))) throw invalid();
  return raw.some(count => count !== (version===3?32:16)) ? raw.slice() : undefined;
}
// Keep rendering chunks only: source paths, prompts and other PNG text metadata are not shared.
function artwork(bytes, animated, animationVersion = 1) {
  Images.generatedBytes(bytes, { animation: animated, animationVersion });
  const chunks = [bytes.subarray(0, 8)], keep = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'sRGB', 'iCCP', 'sBIT']);
  for (let offset = 8; offset < bytes.length;) {
    const end = offset + 12 + bytes.readUInt32BE(offset);
    if (keep.has(bytes.toString('ascii', offset + 4, offset + 8))) chunks.push(bytes.subarray(offset, end));
    offset = end;
  }
  return Buffer.concat(chunks);
}
function inspect(raw) {
  if (!keys(raw, ['format', 'version', 'companion', 'artwork']) || raw.format !== 'tracer-companion') throw invalid();
  if (![1, 2, 3].includes(raw.version)) throw new Error('unsupported-pet-package');
  const profile = companion(raw.companion), art = raw.artwork;
  if (raw.version === 1) {
    if (!keys(art, ['layout', 'images']) || !['portrait', 'atlas-4x4'].includes(art.layout) || !Array.isArray(art.images) ||
        !(art.layout === 'portrait' ? art.images.length === 1 : [3, 4].includes(art.images.length))) throw invalid();
  } else if (!keys(art, ['layout', 'animationVersion', 'images', ...(art && Object.hasOwn(art, 'retainedFrames') ? ['retainedFrames'] : [])]) || art.layout !== (raw.version===3?'atlas-8x4':'atlas-4x4') || art.animationVersion !== raw.version ||
      !Array.isArray(art.images) || art.images.length !== 16) throw invalid();
  const animated = ['atlas-4x4','atlas-8x4'].includes(art.layout), images = [];
  const animationVersion = animated ? raw.version : 0;
  const retainedFrames = raw.version >= 2 && Object.hasOwn(art, 'retainedFrames') ? retained(art.retainedFrames, raw.version) : undefined;
  for (const item of art.images) {
    if (!keys(item, ['sha256', 'data']) || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256) ||
        typeof item.data !== 'string' || item.data.length > Math.ceil(Images.IMAGE_LIMIT / 3) * 4 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(item.data)) throw invalid();
    const bytes = Buffer.from(item.data, 'base64');
    if (bytes.toString('base64') !== item.data || hash(bytes) !== item.sha256) throw new Error('damaged-pet-package');
    try { images.push(artwork(bytes, animated, animationVersion)); } catch { throw invalid(); }
  }
  // Retain the exact legacy identity so re-imports still find existing companions.
  const id = 'custom_' + hash(JSON.stringify({ profile, layout: art.layout,
    ...(animationVersion >= 2 ? { animationVersion } : {}), ...(retainedFrames ? { retainedFrames } : {}), images: images.map(hash) })).slice(0, 32);
  return { profile: { id, ...profile }, animated, animationVersion, ...(retainedFrames ? { retainedFrames } : {}),
    behaviors: animated ? (animationVersion >= 2 ? images.length : images.length * 4) : 1, images };
}
async function exportPackage(dir, raw) {
  const profile = Model.customProfile(raw);
  if (!profile) throw new Error('invalid-custom');
  const metadata = companion({ name: profile.name, kind: profile.kind, personality: profile.personality });
  const images = [], animated = !!profile.animation;
  for (const url of animated ? profile.animation.pages : [profile.image]) {
    const bytes = await Images.readAsset(dir, url);
    if (!bytes) throw new Error('pet-art-missing');
    const clean = artwork(bytes, animated, profile.animation?.version);
    images.push({ sha256: hash(clean), data: clean.toString('base64') });
  }
  const animationVersion = profile.animation?.version;
  return { format: 'tracer-companion', version: animationVersion >= 2 ? animationVersion : 1, companion: metadata,
    artwork: { layout: animated ? (animationVersion===3?'atlas-8x4':'atlas-4x4') : 'portrait', ...(animationVersion >= 2 ? { animationVersion } : {}),
      ...(profile.animation?.retainedFrames ? { retainedFrames: profile.animation.retainedFrames.slice() } : {}), images } };
}
async function importPackage(dir, raw, store = Images.storeGenerated) {
  const pack = inspect(raw), saved = [];
  try {
    for (const image of pack.images) saved.push(await store(dir, image));
    return { ...pack.profile, image: saved[0], ...(pack.animated ? { animation: { version: pack.animationVersion, pages: saved,
      ...(pack.retainedFrames ? { retainedFrames: pack.retainedFrames.slice() } : {}) } } : {}) };
  } catch {
    // These paths came from this operation, never from the package or an existing companion.
    await Promise.allSettled(saved.filter(url => Images.ASSET_RE.test(url)).map(url => fs.unlink(path.join(dir, '.pet-art', path.basename(url)))));
    throw new Error('pet-package-save-failed');
  }
}
module.exports = { LIMIT, inspect, exportPackage, importPackage };
