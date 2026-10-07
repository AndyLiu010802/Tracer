'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { audit } = require('./audit-project-space.cjs');
test('audit measures categories without reading contents or following external junctions', async () => {
 const root = await fs.mkdtemp(path.join(__dirname, 'tracer-space-audit-'));
 const outside = await fs.mkdtemp(path.join(__dirname, 'tracer-space-external-'));
 try {
  await fs.mkdir(path.join(root, 'dist')); await fs.mkdir(path.join(root, 'skins'));
  await fs.writeFile(path.join(root, 'dist', 'build.bin'), Buffer.alloc(11));
  await fs.writeFile(path.join(root, 'skins', 'pet.png'), Buffer.alloc(7));
  await fs.writeFile(path.join(outside, 'private.bin'), Buffer.alloc(100));
  await fs.symlink(outside, path.join(root, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await audit(root);
  assert.equal(result.totalBytes, 18); assert.equal(result.complete, true);
  assert.deepEqual(result.skippedLinksOrSpecialFiles, ['external']);
  assert.equal(result.directories[0].category, 'build-output');
  assert.equal(result.largestFiles[0].bytes, 11); assert.equal(result.deletionPerformed, false);
  assert.equal((await fs.stat(path.join(root, 'skins', 'pet.png'))).size, 7);
 } finally { await fs.rm(root, { recursive: true, force: true }); await fs.rm(outside, { recursive: true, force: true }); }
});

