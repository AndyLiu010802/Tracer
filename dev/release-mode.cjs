'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
function assertCommercial(config,projectRoot){
 require('../desktop/release-profile').assertCommercialMarker(config.extraMetadata?.tracerRelease);
 const entries=Array.isArray(config.files)?config.files:[];
 const patterns=entries.flatMap(entry=>typeof entry==='string'?[entry]:Array.isArray(entry?.filter)?entry.filter:[]);
 const {commercialExclusions,overlayFiles,desktopOverlayFiles,overlayMappings}=require('./commercial-release.cjs');
 for(const pattern of [...commercialExclusions,...overlayFiles.map(name=>'!skins/tracer/'+name),...desktopOverlayFiles.map(name=>'!desktop/'+name)])assert(patterns.includes(pattern),'Commercial build must exclude local-only content: '+pattern);
 // FileMatcher is ordered: later positive patterns can re-include excluded files.
 // Builder's normalized form uses exactly one default-root filter object.
 const reference=require('./commercial-release.cjs').config(projectRoot);
 const expectedPatterns=reference.files.filter(entry=>typeof entry==='string');
 const strings=entries.filter(entry=>typeof entry==='string');
 const carriers=entries.filter(entry=>entry&&typeof entry==='object'&&entry.from==null&&entry.to==null);
 if(strings.length){
  assert.equal(carriers.length,0,'Commercial build must not add unreviewed root file mappings');
  assert.deepEqual(strings,expectedPatterns,'Commercial build must retain reviewed root pattern order');
 }else{
  assert.equal(carriers.length,1,'Commercial build must have one reviewed root file mapping');
  assert.deepEqual(Object.keys(carriers[0]),['filter'],'Commercial root mapping has unreviewed options');
  assert.deepEqual(carriers[0].filter,expectedPatterns,'Commercial build must retain reviewed root pattern order');
 }
 const mappings=entries.filter(entry=>entry&&typeof entry==='object'&&(entry.from!=null||entry.to!=null));
 const reviewed=overlayMappings(path.resolve(projectRoot,'.cache/commercial-overlay'));
 assert.equal(mappings.length,reviewed.length,'Commercial build must use only reviewed replacement mappings');
 for(const expected of reviewed){
  const matches=mappings.filter(entry=>path.resolve(entry.from||'')===path.resolve(expected.from)&&entry.to===expected.to);
  assert.equal(matches.length,1,'Commercial build must use reviewed replacement files: '+expected.to);
  const actual=matches[0].filter;
  assert(Array.isArray(actual),'Commercial replacement mapping requires an explicit file allowlist: '+expected.to);
  assert.equal(actual.length,expected.filter.length,'Commercial replacement mapping changed: '+expected.to);
  assert.deepEqual(new Set(actual),new Set(expected.filter),'Commercial replacement mapping changed: '+expected.to);
 }
 // Resource copying has independent matchers and bypasses `files` exclusions.
 for(const key of ['extraResources','extraFiles','extraDistFiles']){
  assert.deepEqual(config[key]||[],reference[key]||[],'Commercial resource mapping changed: '+key);
  for(const platform of ['win','mac','linux']){
   assert.deepEqual(config[platform]?.[key]||[],reference[platform]?.[key]||[],'Commercial resource mapping changed: '+platform+'.'+key);
  }
 }
 for(const platform of ['win','mac','linux'])assert.deepEqual(config[platform]?.files||[],reference[platform]?.files||[],'Commercial platform file mapping changed: '+platform);
}
function assertBuildMode(config,projectRoot,env=process.env){
 if(env.TRACER_LOCAL_BUILD==='1'){
  assert(!Object.hasOwn(config.extraMetadata||{},'tracerRelease'),'Local build must not contain commercial metadata');
  return 'local-only';
 }
 assertCommercial(config,projectRoot);return 'commercial';
}
module.exports={assertCommercial,assertBuildMode};
