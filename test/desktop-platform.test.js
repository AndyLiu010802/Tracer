'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { runtimeTarget, developmentRuntime } = require('../lib/desktop-platform');
const { childEnvironment } = require('../lib/ai-codex');
const { integrityOf } = require('../dev/prepare-codex-runtime.cjs');
const { getFileMatchers } = require('app-builder-lib/out/fileMatcher');

test('Windows and both Mac architectures resolve independent native AI runtimes', () => {
  assert.equal(runtimeTarget('darwin', 'arm64').triple, 'aarch64-apple-darwin');
  assert.equal(runtimeTarget('darwin', 'x64').triple, 'x86_64-apple-darwin');
  assert.equal(runtimeTarget('win32', 'x64').executable, 'codex.exe');
  const root = path.resolve('build-test');
  assert.equal(developmentRuntime(root, 'darwin', 'arm64'), path.join(root, '.cache/codex-runtime/darwin-arm64/runtime/bin/codex'));
  assert.equal(developmentRuntime(root, 'darwin', 'x64'), path.join(root, '.cache/codex-runtime/darwin-x64/runtime/bin/codex'));
  assert.throws(() => runtimeTarget('darwin', 'universal'), /Unsupported/);
});

test('builder copies exactly the requested runtime plus common license and music resources', () => {
  const config = require('../package.json').build, root = path.resolve(__dirname, '..');
  for (const [platform, arch] of [['mac', 'arm64'], ['mac', 'x64'], ['win', 'x64']]) {
    const matchers = getFileMatchers(config, 'extraResources', path.join(root, 'dist/resources'), {
      defaultSrc: root, globalOutDir: path.join(root, 'dist'), customBuildOptions: config[platform],
      macroExpander: value => value.replaceAll('${arch}', arch),
    });
    const sources = matchers.map(item => item.from.replaceAll('\\', '/'));
    assert.ok(sources.some(source => source.endsWith('/music')));
    assert.ok(sources.some(source => source.endsWith('/build/codex-LICENSE.txt')));
    const runtimes = sources.filter(source => source.includes('/.cache/codex-runtime/'));
    assert.equal(runtimes.length, 1);
    assert.ok(runtimes[0].endsWith(platform === 'mac' ? `/darwin-${arch}/runtime` : '/package/vendor/x86_64-pc-windows-msvc'));
  }
});

test('Mac child environment preserves OS home and temp paths without inheriting API keys', t => {
  const names = { HOME: '/Users/mac-test', TMPDIR: '/tmp/tracer-test', OPENAI_API_KEY: 'must-not-inherit' };
  const original = Object.fromEntries(Object.keys(names).map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, names);
  const env = childEnvironment('/isolated/codex');
  assert.equal(env.HOME, names.HOME); assert.equal(env.TMPDIR, names.TMPDIR);
  assert.equal(env.CODEX_HOME, '/isolated/codex'); assert.equal(env.OPENAI_API_KEY, undefined);
});

test('runtime archive integrity detects corruption and pins the same version on every platform', () => {
  assert.notEqual(integrityOf(Buffer.from('original')), integrityOf(Buffer.from('changed')));
  const mac = require('../build/codex-runtime-mac.json'), win = require('../build/codex-runtime.json');
  assert.equal(mac.version, win.version);
  for (const [id, spec] of Object.entries(mac.targets)) {
    assert.equal(spec.url, `https://registry.npmjs.org/@openai/codex/-/codex-${mac.version}-${id}.tgz`);
    assert.match(spec.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  }
});
