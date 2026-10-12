'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {signedConfig,thumbprint}=require('../dev/windows-signing.cjs'),hook=require('../dev/windows-sign-hook.cjs');
const env={TRACER_WINDOWS_CERT_SHA1:'ab'.repeat(20)};
test('signed release refuses missing or malformed certificate selection',()=>{
  for(const value of ['', 'certificate.pfx', 'a'.repeat(39), 'x'.repeat(40)])assert.throws(()=>thumbprint({TRACER_WINDOWS_CERT_SHA1:value}));
  assert.equal(thumbprint(env),'AB'.repeat(20));
  assert.throws(()=>signedConfig({win:{signExecutable:false}},env));
  assert.throws(()=>signedConfig({win:{azureSignOptions:{}}},env));
});
test('signed configuration validates against the installed builder schema and retains commercial exclusions',async()=>{
  const base=require('../dev/commercial-release.cjs').config(),config=signedConfig(base,env);
  assert.equal(config.forceCodeSigning,true);assert.equal(config.win.verifyUpdateCodeSignature,true);assert.deepEqual(config.win.signtoolOptions.signingHashAlgorithms,['sha256']);
  assert.equal(base.forceCodeSigning,undefined);require('../dev/release-mode.cjs').assertCommercial(config,require('node:path').resolve(__dirname,'..'));
  require('app-builder-lib/out/util/config/schemaValidator').validateSchema(require('app-builder-lib/scheme.json'),config,{name:'electron-builder'});
});
test('vendor runtime remains pinned and cannot bypass verification through unknown names or changed bytes',()=>{
  const bytes=Buffer.from('verified vendor'),files={'bin/codex.exe':crypto.createHash('sha256').update(bytes).digest('hex')};
  assert(hook.preserveRuntime('C:\\build\\resources\\codex\\bin\\codex.exe',()=>bytes,files));
  assert.throws(()=>hook.preserveRuntime('C:/build/resources/codex/bin/codex.exe',()=>Buffer.from('modified'),files));
  assert.throws(()=>hook.preserveRuntime('C:/build/resources/codex/unknown.exe',()=>bytes,files));
  assert.equal(hook.preserveRuntime('C:/build/Tracer.exe',()=>{throw Error('must not read')}),false);
});
test('application, installer and uninstaller use the real signer and propagate signing failures',async()=>{
  const calls=[],packager={signingManager:{value:Promise.resolve({doSign:async task=>calls.push(task.path)})}};
  for(const name of ['Tracer.exe','Tracer-Setup-0.4.6-x64.exe','Tracer-Setup-0.4.6-x64.__uninstaller.exe'])await hook({path:name,cscInfo:{}},packager);
  assert.equal(calls.length,3);await assert.rejects(()=>hook({path:'Tracer.exe',cscInfo:null},packager));
  await assert.rejects(()=>hook({path:'Tracer.exe',cscInfo:{}},{signingManager:{value:Promise.resolve({doSign:async()=>{throw Error('signing failed')}})}}),/signing failed/);
});
