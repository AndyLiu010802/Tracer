'use strict';
const path = require('node:path');

function runtimeTarget(platform = process.platform, arch = process.arch) {
  const targets = {
    'win32-x64': ['x86_64-pc-windows-msvc', 'codex.exe'],
    'darwin-arm64': ['aarch64-apple-darwin', 'codex'],
    'darwin-x64': ['x86_64-apple-darwin', 'codex'],
  };
  const id = `${platform}-${arch}`, target = targets[id];
  if (!target) throw new Error(`Unsupported desktop target: ${id}`);
  return { id, platform, arch, triple: target[0], executable: target[1] };
}

function developmentRuntime(root, platform = process.platform, arch = process.arch) {
  const target = runtimeTarget(platform, arch);
  return target.platform === 'win32'
    ? path.join(root, '.cache/codex-runtime/package/vendor', target.triple, 'bin', target.executable)
    : path.join(root, '.cache/codex-runtime', target.id, 'runtime/bin', target.executable);
}

module.exports = { runtimeTarget, developmentRuntime };
