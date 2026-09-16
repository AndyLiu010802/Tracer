'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const { runtimeTarget, developmentRuntime } = require('../lib/desktop-platform');
const root = path.resolve(__dirname, '..');

function integrityOf(bytes) {
  return 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
}

async function prepare(platform = process.platform, arch = process.arch) {
  const target = runtimeTarget(platform, arch);
  const manifest = require(platform === 'darwin' ? '../build/codex-runtime-mac.json' : '../build/codex-runtime.json');
  const spec = manifest.targets ? manifest.targets[target.id] : manifest;
  const cache = path.join(root, '.cache/codex-download');
  const archive = path.join(cache, `openai-codex-${manifest.version}-${target.id}.tgz`);
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(archive)) {
    const response = await fetch(spec.url, { redirect: 'error', signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw new Error('Unable to download the pinned Codex runtime');
    const { Readable } = require('node:stream'), { pipeline } = require('node:stream/promises');
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archive + '.tmp'));
    if (integrityOf(fs.readFileSync(archive + '.tmp')) !== spec.integrity) throw new Error('Codex package integrity mismatch');
    fs.renameSync(archive + '.tmp', archive);
  }
  if (integrityOf(fs.readFileSync(archive)) !== spec.integrity) throw new Error('Codex package integrity mismatch');
  const unpack = path.join(root, '.cache/codex-runtime', platform === 'darwin' ? target.id : '');
  const vendor = path.join(unpack, 'package/vendor', target.triple);
  fs.mkdirSync(unpack, { recursive: true });
  // Always extract from the verified archive, including when the cache exists.
  cp.execFileSync('tar', ['-xf', archive, '-C', unpack], { windowsHide: true });
  if (spec.files) {
    for (const [name, hash] of Object.entries(spec.files)) {
      if (crypto.createHash('sha256').update(fs.readFileSync(path.join(vendor, name))).digest('hex') !== hash) {
        throw new Error('Extracted Codex runtime file hashes do not match');
      }
    }
  }
  if (platform === 'darwin') {
    const staged = path.resolve(unpack, 'runtime');
    const expectedParent = path.resolve(root, '.cache/codex-runtime', target.id);
    if (path.dirname(staged) !== expectedParent) throw new Error('Invalid runtime staging path');
    // A fixed build-cache directory, never a user-data or caller-supplied path.
    fs.rmSync(staged, { recursive: true, force: true });
    fs.cpSync(vendor, staged, { recursive: true });
    for (const executable of ['bin/codex', 'bin/codex-code-mode-host', 'codex-path/rg', 'codex-resources/zsh/bin/zsh']) {
      const file = path.join(staged, executable);
      if (!fs.existsSync(file)) throw new Error(`Missing Mac runtime executable: ${executable}`);
      if (process.platform !== 'win32') fs.chmodSync(file, 0o755);
    }
  }
  if (platform === process.platform && arch === process.arch) {
    const version = cp.execFileSync(developmentRuntime(root, platform, arch), ['--version'], { encoding: 'utf8', windowsHide: true }).trim();
    if (version !== 'codex-cli ' + manifest.version) throw new Error('Unexpected Codex version');
  }
  console.log(`Verified official Codex ${manifest.version} archive for ${target.id}.`);
}

if (require.main === module) prepare(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepare, integrityOf };
