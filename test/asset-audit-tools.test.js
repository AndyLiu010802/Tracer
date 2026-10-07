'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {decode}=require('../dev/png-rgba.cjs');
function fixture(filter=4){
  const chunk=(type,data)=>{const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);return out;};
  const header=Buffer.alloc(13);header.writeUInt32BE(2);header.writeUInt32BE(5,4);header[8]=8;header[9]=6;
  const rows=Buffer.from([0,10,20,30,100,40,50,60,200,1,20,30,40,110,40,40,40,100,2,1,2,3,4,5,6,7,8,3,10,10,10,10,10,10,10,10,filter,1,1,1,1,1,1,1,1]);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
test('standalone artwork decoder reads all five PNG row filters',()=>{
  const image=decode(fixture());assert.equal(image.width,2);assert.equal(image.height,5);
  assert.deepEqual([...image.data],[10,20,30,100,40,50,60,200,20,30,40,110,60,70,80,210,21,32,43,114,65,76,87,218,20,26,31,67,52,61,69,152,21,27,32,68,53,62,70,153]);
  assert.throws(()=>decode(fixture(5)),/invalid-png-filter/);assert.throws(()=>decode(fixture().subarray(0,48)),/truncated-png/);assert.throws(()=>decode(Buffer.from('not PNG')),/invalid-png/);
});
test('Mac release data checks use active fishing and historical backup validators only',()=>{
  const {verifyDataModules}=require('../dev/verify-macos-release.cjs'),read=[];
  verifyDataModules(null,(_,file)=>{read.push(file);return fs.readFileSync(path.join(__dirname,'..',file));});
  assert(read.includes('skins/tracer/fishing-model.js'));assert(read.includes('skins/tracer/pet-model.js'));assert(read.includes('skins/tracer/pet-animation.js'));
  assert(!read.some(file=>/pet-(?:art|builtin-animation)\.js$/.test(file)));
});
