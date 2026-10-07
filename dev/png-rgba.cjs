'use strict';
// Small read-only decoder for the local RGBA8 artwork audits.
const zlib=require('node:zlib');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
function decode(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<45||!bytes.subarray(0,8).equals(signature)||bytes.toString('ascii',12,16)!=='IHDR')throw Error('invalid-png');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width*height>64000000||bytes[24]!==8||bytes[25]!==6||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)throw Error('expected-rgba8-png');
  const chunks=[];let offset=8;
  while(offset<bytes.length){if(offset+12>bytes.length)throw Error('truncated-png');const size=bytes.readUInt32BE(offset);if(size>bytes.length-offset-12)throw Error('truncated-png');const type=bytes.toString('ascii',offset+4,offset+8);if(type==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+size));offset+=size+12;if(type==='IEND')break;}
  const stride=width*4,expected=(stride+1)*height,raw=zlib.inflateSync(Buffer.concat(chunks),{maxOutputLength:expected});if(raw.length!==expected)throw Error('invalid-png-data');
  const data=Buffer.alloc(stride*height),paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)throw Error('invalid-png-filter');for(let x=0;x<stride;x++){const a=x>=4?data[y*stride+x-4]:0,b=y?data[(y-1)*stride+x]:0,c=y&&x>=4?data[(y-1)*stride+x-4]:0;data[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
  return{width,height,data};
}
module.exports={decode};
