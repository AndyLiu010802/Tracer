'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {midpoint}=require('../skins/tracer/companion-inbetweens');
function pose(dx=0){const pixels=new Uint8ClampedArray(32*32*4);for(let y=8;y<25;y++)for(let x=8+dx;x<20+dx;x++)pixels.set([80,130,60,255],(y*32+x)*4);return pixels;}
test('local interpolation preserves endpoint pixels, palette and transparency without crossfading',()=>{
  const a=pose(),b=pose(4),half=midpoint(a,b,32,32);
  assert.deepEqual(midpoint(a,b,32,32,0),a);assert.deepEqual(midpoint(a,b,32,32,1),b);
  assert.deepEqual(midpoint(a,a,32,32),a);
  assert.notDeepEqual(half,a);assert.notDeepEqual(half,b);
  for(let i=0;i<half.length;i+=4){assert.ok(half[i+3]===0||half[i+3]===255);if(half[i+3])assert.deepEqual(Array.from(half.slice(i,i+3)),[80,130,60]);}
});
