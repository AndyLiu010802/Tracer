'use strict';
const { build, Platform, Arch } = require('electron-builder');

async function main() {
  if (process.platform !== 'darwin') throw new Error('Mac installers must be built on macOS. Use the macOS desktop GitHub Actions workflow or run this command on a Mac.');
  const arch = process.argv[2] || process.arch;
  if (!['arm64', 'x64'].includes(arch)) throw new Error('Choose arm64 (Apple Silicon) or x64 (Intel).');
  const signed = process.env.TRACER_MAC_SIGNED === '1';
  // Actions represents absent secrets as empty strings. Builder treats an empty
  // CSC_LINK as the project directory, so unset absent credentials explicitly.
  for (const name of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
    if (process.env[name] === '') delete process.env[name];
  }
  // Signed distribution must fail closed if a Developer ID certificate is missing.
  // Ad-hoc test builds are runnable locally but are not notarized public releases.
  const config = signed
    ? { forceCodeSigning: true, mac: { notarize: true } }
    : { mac: { identity: '-', hardenedRuntime: false, notarize: false } };
  const release=process.env.TRACER_LOCAL_BUILD==='1'?{}:require('./commercial-release.cjs').config();
  // A configuration file replaces package.build instead of merging resource arrays twice.
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const staging=fs.mkdtempSync(path.join(os.tmpdir(),'tracer-mac-config-'));
  const configPath=path.join(staging,'release.cjs');
  const base=process.env.TRACER_LOCAL_BUILD==='1'?require('../package.json').build:release;
  fs.writeFileSync(configPath,'module.exports='+JSON.stringify({...base,...config,mac:{...base.mac,...config.mac}}));
  try { await build({ targets: Platform.MAC.createTarget(['dmg', 'zip'], Arch[arch]), publish: 'never', config:configPath }); }
  finally { fs.unlinkSync(configPath);fs.rmdirSync(staging); }
}
main().catch(error => { console.error(error.message); process.exit(1); });
