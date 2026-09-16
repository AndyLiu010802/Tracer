'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const net = require('node:net'), { once } = require('node:events'), asar = require('@electron/asar');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const arch = process.argv[2] || process.arch;
  assert.equal(process.platform, 'darwin', 'Run package verification on a Mac');
  assert.equal(arch, process.arch, 'Smoke test each build on its native architecture');
  const dist = path.join(root, 'dist');
  const app = path.join(dist, arch === 'arm64' ? 'mac-arm64' : 'mac', 'Tracer.app');
  const resources = path.join(app, 'Contents/Resources'), archive = path.join(resources, 'app.asar');
  const files = asar.listPackage(archive).map(file => file.replaceAll('\\', '/'));
  assert.deepEqual(files.filter(file => /(^|\/)(workspace\.json|bookmarks\.json|accounts\.json|connection\.json|local\.config\.json|\.env|\.cache|personal\.json|output)(\/|$)/.test(file)), [], 'No personal workspace or credentials in package');
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, version);
  for (const file of ['desktop/main.js', 'desktop/platform-integration.js', 'lib/desktop-platform.js', 'lib/ai-codex.js', 'skins/tracer/notes.js']) {
    assert.ok(asar.extractFile(archive, file).equals(fs.readFileSync(path.join(root, file))), `${file} matches source`);
  }
  const cpu = arch === 'arm64' ? 'arm64' : 'x86_64';
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
    env: { ...process.env, TRACER_USER_DATA_DIR: profile, TRACER_DISABLE_INPUT_HOOK: '1', DOCS_PORTAL_PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.resume();
  let spawnError;
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
    await delay(3000);
    assert.equal(child.exitCode, null, 'Packaged app stays alive after initialization');
  } finally {
    if (child.exitCode === null && !spawnError) {
      const ended = once(child, 'exit'); child.kill('SIGTERM');
      await Promise.race([ended, delay(5000)]);
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await ended; }
    }
    fs.rmSync(profile, { recursive: true, force: true });
  }
  const sums = ['dmg', 'zip'].map(ext => {
    const name = `Tracer-${version}-mac-${arch}.${ext}`;
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, name))).digest('hex') + '  ' + name;
  });
  fs.writeFileSync(path.join(dist, `SHA256SUMS-${version}-mac-${arch}.txt`), sums.join('\n') + '\n');
  console.log('PASS Mac architecture, package privacy, signing, native AI runtime and application service startup.');
  console.log('Manual UI, input permission and real-account AI checks are still required before publication.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
