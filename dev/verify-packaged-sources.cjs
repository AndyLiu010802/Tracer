'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const asar = require('@electron/asar');
const { assertCommercialMarker } = require('../desktop/release-profile');
const { omittedRuntime } = require('./desktop-pack-assets.cjs');
const root = path.resolve(__dirname, '..');

// Compare the actual commercial overlay, not the personal source files that it
// intentionally replaces. Electron Builder alone rewrites package metadata.
function verifyArchiveSources(archive, manifest, version) {
  const files = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''));
  const privatePath = /(^|\/)(?:workspace\.json|bookmarks\.json|accounts\.json|connection\.json|local\.config\.json|\.env|\.cache|\.pet-art|\.codex|\.agents|personal\.json|output)(?:\/|$)/;
  assert.deepEqual(files.filter(file => privatePath.test(file)), [], 'No personal workspace, generated artwork or credentials in package');
  assert.deepEqual(files.filter(file => omittedRuntime(file)), [], 'Retired character runtime and artwork are absent');
  assert.deepEqual(files.filter(file => /(?:^|\/)local[-_]?vfx|alchemy-v1|pet-alchemy|edward|alphonse|elric/i.test(file)), [], 'Local-only effects and exclusive character resources are absent');
  assert.deepEqual(files.filter(file => /(^|\/)wechat(\/|$)|^lib\/cloud-sync\.js$|^skins\/tracer\/sync-ui\.js$/.test(file)), [], 'Retired sync integrations are absent');
  assert.deepEqual(files.filter(file => /^ai-service\/(?!provider\.js$)/.test(file)), [], 'Only the public provider adapter is bundled');
  const pkg = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  assert.equal(pkg.version, version, 'Installer version matches the tested source');
  assertCommercialMarker(pkg.tracerRelease);
  const expected = new Map(manifest.files.map(entry => [entry.file, entry.source]));
  assert.equal(expected.size, manifest.files.length, 'No duplicate expected destinations');
  for (const file of files) {
    const entry = asar.statFile(archive, file.split('/').join(path.sep), false);
    if (entry.files) continue;
    if (!file.startsWith('node_modules/')) {
      assert.ok(!entry.link, 'No first-party package symlinks: ' + file);
      assert.ok(expected.has(file), 'Only reviewed first-party package files: ' + file);
    }
  }
  for (const [file, source] of expected) {
    if (file === 'package.json') continue;
    assert.ok(asar.extractFile(archive, file.split('/').join(path.sep)).equals(fs.readFileSync(source)), file + ' matches the reviewed commercial source and assets');
  }
  return { files: [...expected.keys()], retainedExperienceAssets: manifest.retainedExperienceAssets };
}

function verifyPackagedSources(archive, projectRoot = root) {
  const manifest = require('./commercial-release.cjs').manifest(projectRoot);
  const version = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version;
  return verifyArchiveSources(archive, manifest, version);
}
module.exports = { verifyArchiveSources, verifyPackagedSources };
