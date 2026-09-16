'use strict';
const { build, Platform, Arch } = require('electron-builder');

async function main() {
  if (process.platform !== 'darwin') throw new Error('Mac installers must be built on macOS. Use the macOS desktop GitHub Actions workflow or run this command on a Mac.');
  const arch = process.argv[2] || process.arch;
  if (!['arm64', 'x64'].includes(arch)) throw new Error('Choose arm64 (Apple Silicon) or x64 (Intel).');
  const signed = process.env.TRACER_MAC_SIGNED === '1';
  // Signed distribution must fail closed if a Developer ID certificate is missing.
  // Ad-hoc test builds are runnable locally but are not notarized public releases.
  const config = signed
    ? { forceCodeSigning: true, mac: { notarize: true } }
    : { mac: { identity: '-', hardenedRuntime: false, notarize: false } };
  await build({ targets: Platform.MAC.createTarget(['dmg', 'zip'], Arch[arch]), publish: 'never', config });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
