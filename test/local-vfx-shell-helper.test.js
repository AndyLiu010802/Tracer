'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const M = require('../desktop/local-vfx-shell-model');
const executable = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const helper = path.resolve(__dirname, '../desktop/local-vfx-shell-registry.ps1');
const launch = M.fixedSourceLaunch();

// Every request is rejected by the protocol/launch gate before Read-Node,
// Invoke-Parent or Begin-OwnedMutation. No registry key is read or written.
for (const [name, changes] of [
  ['unapproved executable', { launch: { ...launch, executable: 'C:\\Foreign\\arbitrary.exe' } }],
  ['unapproved project path', { launch: { ...launch, appPath: 'C:\\Foreign Project' } }],
  ['extra launch arguments', { launch: { ...launch, arguments: ['--eval=bad'] } }],
  ['command injection field', { command: 'cmd.exe /c anything' }],
  ['out-of-scope registry key', { key: 'HKLM\\Software\\OtherApplication' }],
  ['invalid parent token', { action: 'parent-remove', key: 'HKCU\\Software\\Classes\\DesktopBackground', token: 'bad' }],
  ['arbitrary operation', { action: 'execute' }],
]) {
  test('native helper rejects ' + name + ' before registry access', { skip: process.platform !== 'win32' || !fs.existsSync(executable) }, () => {
    const input = JSON.stringify({ version: 1, action: 'read', key: M.ROOT + '\\Tracer.LocalEffects.Release', launch, ...changes });
    const result = spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', helper], {
      shell: false, windowsHide: true, encoding: 'utf8', input, timeout: 5000, maxBuffer: 1048576,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout.replace(/^\uFEFF/, '')), { ok: false, error: 'registry-protocol-invalid' });
  });
}
