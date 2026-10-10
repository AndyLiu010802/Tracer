'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const net = require('node:net'), { once } = require('node:events'), asar = require('@electron/asar');
const vm = require('node:vm');
const { verifyPackagedSources } = require('./verify-packaged-sources.cjs');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function runtimeFiles(folder) {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
    const file = folder + '/' + entry.name;
    // Mirror the first-party exclusions in package.json; dependencies are verified separately.
    if (/^desktop\/(test|node_modules)(\/|$)/.test(file) || ['desktop/package-lock.json', 'desktop/README.md'].includes(file) || /\.(bak|log)$/.test(file)) continue;
    if (entry.isDirectory()) result.push(...runtimeFiles(file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

function verifyDataModules(archive, extract=(source,file)=>asar.extractFile(source,file.split('/').join(path.sep))) {
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    assert.ok(file.startsWith('skins/tracer/') && file.endsWith('.js'), 'Only packaged data modules are evaluated');
    const module = { exports: {} }; loaded.set(file, module);
    vm.runInNewContext(extract(archive,file).toString('utf8'), {
      module,
      require: name => {
        assert.ok(name.startsWith('./'), 'Data model dependencies are local');
        return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), name + '.js')));
      },
    }, { filename: file, timeout: 5000 });
    return module.exports;
  }
  // These validators are still required to restore historical account backups.
  // Character renderers and their artwork are intentionally no longer shipped.
  const animation = load('skins/tracer/pet-animation.js'), model = load('skins/tracer/pet-model.js');
  const actions = Array.from(animation.actions);
  assert.equal(actions.length, 16);
  const pages = actions.map((_, index) => '/api/pet-art/' + (index + 1).toString(16).padStart(32, '0') + '.png');
  const dense = { version: 2, pages };
  assert.equal(JSON.stringify(animation.normalize(dense)), JSON.stringify(dense), 'Packaged renderer accepts sixteen-action manifests');
  for (const count of [3, 4]) assert.equal(animation.normalize({ version: 1, pages: pages.slice(0, count) }).pages.length, count, 'Legacy companion manifests remain usable');
  assert.equal(animation.normalize({ version: 1, pages }), null);
  assert.equal(animation.normalize({ version: 2, pages: pages.slice(0, 4) }), null);
  for (const [index, action] of actions.entries()) {
    const clip = animation.denseClips[action];
    assert.equal(clip.page, index); assert.equal(clip.frames, 16); assert.equal(clip.frameMs.length, 16);
    assert.ok(Array.from(clip.frameMs).every(time => Number.isFinite(time) && time > 0));
    assert.equal(animation.clips[action].page, Math.floor(index / 4)); assert.equal(animation.clips[action].row, index % 4);
  }
  const state = model.fresh(), profile = { id: 'custom_' + 'a'.repeat(32), name: 'Package smoke companion', kind: 'creature', personality: '', image: pages[0], animation: dense };
  model.addCustom(state, profile);
  assert.equal(JSON.stringify(model.read(JSON.parse(JSON.stringify(state))).customs[0].animation), JSON.stringify(dense), 'Packaged model preserves dense animation on reload');
  const fishing=load('skins/tracer/fishing-model.js');
  assert.ok(fishing.catalog.fish.length>0&&fishing.catalog.rods.length>0,'Packaged fishing catalogs are available');
  assert.equal(fishing.validate(fishing.empty()).equippedRodId,'bamboo','Packaged fishing state validates');
}

async function main() {
  const arch = process.argv[2] || process.arch;
  assert.equal(process.platform, 'darwin', 'Run package verification on a Mac');
  assert.ok(['arm64', 'x64'].includes(arch), 'Verify a supported Mac architecture');
  assert.equal(arch, process.arch, 'Smoke test each build on its native architecture');
  const dist = path.join(root, 'dist');
  const app = path.join(dist, arch === 'arm64' ? 'mac-arm64' : 'mac', 'Tracer.app');
  const resources = path.join(app, 'Contents/Resources'), archive = path.join(resources, 'app.asar');
  const { files: sources } = verifyPackagedSources(archive, root);
  verifyDataModules(archive);
  const cpu = arch === 'arm64' ? 'arm64' : 'x86_64';
  const nativeHook = path.join(resources, 'app.asar.unpacked/node_modules/uiohook-napi/prebuilds', 'darwin-' + arch, 'uiohook-napi.node');
  for (const binary of [path.join(app, 'Contents/MacOS/Tracer'), nativeHook]) {
    assert.ok(cp.execFileSync('lipo', ['-archs', binary], { encoding: 'utf8' }).trim().split(/\s+/).includes(cpu), `${path.basename(binary)} architecture`);
  }
  const nativeFiles = ['codex/bin/codex', 'codex/bin/codex-code-mode-host', 'codex/codex-path/rg', 'codex/codex-resources/zsh/bin/zsh'];
  for (const file of nativeFiles) {
    const binary = path.join(resources, file);
    fs.accessSync(binary, fs.constants.X_OK);
    assert.ok(cp.execFileSync('lipo', ['-archs', binary], { encoding: 'utf8' }).trim().split(/\s+/).includes(cpu), `${file} architecture`);
  }
  assert.equal(cp.execFileSync(path.join(resources, 'codex/bin/codex'), ['--version'], { encoding: 'utf8' }).trim(), 'codex-cli ' + require('../build/codex-runtime-mac.json').version);
  for (const name of ['codex-LICENSE.txt', 'codex-NOTICE.txt']) {
    assert.ok(fs.readFileSync(path.join(resources, 'codex', name)).equals(fs.readFileSync(path.join(root, 'build', name))));
  }
  cp.execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  if (process.env.TRACER_MAC_SIGNED === '1') {
    cp.execFileSync('xcrun', ['stapler', 'validate', app], { stdio: 'inherit' });
    cp.execFileSync('spctl', ['--assess', '--type', 'execute', '--verbose', app], { stdio: 'inherit' });
  }
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-mac-smoke-'));
  const child = cp.spawn(path.join(app, 'Contents/MacOS/Tracer'), [], {
    env: { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_PORT: String(port),
      DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: path.join(profile, 'data'), DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json') },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.resume();
  let spawnError;
  let verificationError;
  child.on('error', error => { spawnError = error; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (spawnError) throw spawnError;
      assert.equal(child.exitCode, null, 'Packaged app remains running');
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
        ready = response.ok && /Tracer/i.test(await response.text());
      } catch {}
      if (ready) break;
      await delay(500);
    }
    assert.ok(ready, 'Packaged app starts its local task service');
    const origin = `http://127.0.0.1:${port}`;
    for (const file of sources.filter(file => /^skins\/tracer\/(?:fishing[^/]*|pet-(?:model|animation))\.(js|css|html)$/.test(file))) {
      const response = await fetch(origin + '/' + path.posix.basename(file), { signal: AbortSignal.timeout(5000) });
      assert.ok(response.ok, `${file} is available from the packaged service`);
      assert.ok(Buffer.from(await response.arrayBuffer()).equals(asar.extractFile(archive, file)), `${file} serves the packaged bytes`);
    }
    for (const url of ['/', '/fishing-desktop.html', '/fishing-aquarium-desktop.html']) {
      const response = await fetch(origin + url, { signal: AbortSignal.timeout(5000) }), html = await response.text();
      assert.ok(response.ok);
      let previous = -1;
      const scripts = url==='/' ? ['fishing-model.js', 'fishing-art.js', 'fishing-rod-effects.js', 'fishing-motion.js', 'fishing-view.js', 'fishing.js'] : url==='/fishing-desktop.html' ? ['fishing-art.js', 'fishing-rod-effects.js', 'fishing-motion.js', 'fishing-desktop.js'] : ['fishing-aquarium-motion.js', 'fishing-art.js', 'fishing-aquarium.js', 'fishing-aquarium-desktop.js'];
      for (const name of scripts) {
        const position = html.indexOf('src="/' + name + '"');
        assert.ok(position > previous, `${url} loads ${name} in dependency order`); previous = position;
      }
    }
    await delay(3000);
    assert.equal(child.exitCode, null, 'Packaged app stays alive after initialization');
  } catch (error) {
    verificationError = error;
    throw error;
  } finally {
    if (child.exitCode === null && !spawnError) {
      const ended = once(child, 'exit'); child.kill('SIGTERM');
      await Promise.race([ended, delay(5000)]);
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await ended; }
    }
    // Electron helpers can finish writing their temporary profile after the
    // main process exits. Retry only cleanup races; keep all startup assertions.
    assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(profile).startsWith('tracer-mac-smoke-'));
    try { await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch (error) { if (verificationError) console.error('Temporary profile cleanup also failed:', error.message); else throw error; }
  }
  const sums = ['dmg', 'zip'].map(ext => {
    const name = `Tracer-${version}-mac-${arch}.${ext}`;
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, name))).digest('hex') + '  ' + name;
  });
  fs.writeFileSync(path.join(dist, `SHA256SUMS-${version}-mac-${arch}.txt`), sums.join('\n') + '\n');
  console.log(`PASS Mac ${arch} ${version}: ${sources.length} source files, legacy backup validators, active fishing model and served assets, architecture, privacy, signing, native AI runtime and service startup.`);
  console.log('Manual Mac UI, background input permission and real-account AI behavior are not exercised by this smoke test.');
}
module.exports = { runtimeFiles, verifyDataModules };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
