(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingOnePiecePainted=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Original painted sprites are skinned to the same continuous rod centreline
  // as the mechanical model. Reel/handle stay rigid; the upper blank flexes.
  const keys=["usopp","chopper","brook","franky","buggy","perona","crocodile","kuma","nami","sanji","robin","jinbe","smoker","vivi","aokiji","kizaru","doflamingo","zoro","ace","sabo","law","hancock","enel","katakuri","marco","luffy","shanks","whitebeard","mihawk","nika","alvida","kuro","jango","wapol","koby","tashigi","bartolomeo","bellamy","moria","weevil","yamatooni","bonney","blackbeard","kaido","bigmom"];
  const assets=Object.fromEntries(keys.map(key=>['anime_'+key,{src:'/fishing-art/rod-onepiece-'+key+'-v2.png'}]));
  for(const key of ["zoro","mihawk","brook","law","shanks","whitebeard","alvida","kuro","tashigi","moria","weevil","yamatooni","kaido","bigmom"])assets['anime_'+key].rig='weapon';
  const revisions={"anime_usopp":"c1f0a575dc57","anime_chopper":"dd2dcdacb69a","anime_brook":"6654dfc69d36","anime_franky":"f9a845ce0db6","anime_buggy":"f41a53293def","anime_perona":"a98be20fc429","anime_crocodile":"93cfb66e7b80","anime_kuma":"19e03660bcb7","anime_nami":"f1c3c2da7d66","anime_sanji":"cad8413c3fb8","anime_robin":"9f5251d962af","anime_jinbe":"b5536ebd448f","anime_smoker":"e3cd61722a96","anime_vivi":"cd940c98311e","anime_aokiji":"05e6bc1d5151","anime_kizaru":"8e81a897b79d","anime_doflamingo":"9746158a3e00","anime_zoro":"99026f0e4e86","anime_ace":"7ff4e7041016","anime_sabo":"a7fe106670c3","anime_law":"d431d7d716dd","anime_hancock":"70a57c7467a6","anime_enel":"eeac85735b5a","anime_katakuri":"1708443b72e2","anime_marco":"f7eb6c4c91f8","anime_luffy":"a654f7d0cc52","anime_shanks":"7d089d7342d1","anime_whitebeard":"4aacd14ccf80","anime_mihawk":"bbb4f36c029c","anime_nika":"20935c222c7e","anime_alvida":"45bf07525aeb","anime_kuro":"3027f4650d3a","anime_jango":"63f18697d5bc","anime_wapol":"63405f3c6f9a","anime_koby":"5bf5edaa9e7c","anime_tashigi":"0ba17a6f2c21","anime_bartolomeo":"f1f1e1b1a485","anime_bellamy":"dc8dd4ee2d60","anime_moria":"42d93013c984","anime_weevil":"9ad181dd4c26","anime_yamatooni":"1bd64444f0bb","anime_bonney":"98a7bfa0ff59","anime_blackbeard":"baf377ae5cf5","anime_kaido":"e4af5711c563","anime_bigmom":"50d1b99a7f5a"};
  function createCollection(assets,revisions){
  const documents=new WeakMap();
  function cache(doc){let value=documents.get(doc);if(!value){value=new Map();documents.set(doc,value);}return value;}
  function inspect(doc,image,id){
    const canvas=doc.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const w=canvas.width,h=canvas.height,data=ctx.getImageData(0,0,w,h).data;
    let left=w,right=0,top=h,bottom=0,solid=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);solid++;}
    if(solid<1000||right-left<100)throw Error('Empty painted rod sprite');
    const samples=[];for(let j=0;j<31;j++){const x=Math.round(left+(right-left)*(.64+j*.011)),ys=[];for(let y=top;y<=bottom;y++)if(data[(y*w+x)*4+3]>128)ys.push(y);if(ys.length)samples.push([x,ys[Math.floor(ys.length/2)]]);}
    const fit=points=>{const n=points.length,sx=points.reduce((a,p)=>a+p[0],0),sy=points.reduce((a,p)=>a+p[1],0),sxx=points.reduce((a,p)=>a+p[0]*p[0],0),sxy=points.reduce((a,p)=>a+p[0]*p[1],0),slope=(n*sxy-sx*sy)/(n*sxx-sx*sx||1);return{slope,offset:(sy-slope*sx)/Math.max(1,n)};};
    let axis=fit(samples);const clean=samples.filter(p=>Math.abs(p[1]-(axis.offset+p[0]*axis.slope))<(right-left)*.009);if(clean.length>8)axis=fit(clean);
    let base=[left,axis.offset+left*axis.slope],tip=[right,axis.offset+right*axis.slope];
    if(assets[id]?.rig==='weapon'){const runs=x=>{const result=[];let start=null;for(let y=top;y<=bottom+1;y++){const filled=y<=bottom&&data[(y*w+x)*4+3]>128;if(filled&&start===null)start=y;if(!filled&&start!==null){if(y-start>1)result.push([start,y-1]);start=null;}}return result;},rootRuns=runs(Math.round(left+(right-left)*.017)),middle=(top+bottom)/2;rootRuns.sort((a,b)=>Math.abs((a[0]+a[1])/2-middle)-Math.abs((b[0]+b[1])/2-middle));const tipRuns=runs(Math.max(left,right-2));if(rootRuns.length)base=[left,(rootRuns[0][0]+rootRuns[0][1])/2];if(tipRuns.length){const last=tipRuns.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];tip=[right,(last[0]+last[1])/2];}}
    return{image,width:w,height:h,bounds:[Math.max(0,left-2),Math.max(0,top-2),Math.min(w,right+3),Math.min(h,bottom+3)],base,tip,solid};
  }
  function get(doc,id){return cache(doc).get(id)?.entry||null;}
  function load(doc,id){
    if(!assets[id])return Promise.resolve(null);const values=cache(doc),existing=values.get(id);if(existing)return existing.promise;
    const record={entry:null,promise:null},ImageClass=doc.defaultView?.Image||Image;
    record.promise=new Promise((resolve,reject)=>{const image=new ImageClass();image.onload=()=>{try{record.entry={...inspect(doc,image,id),id,src:assets[id].src};resolve(record.entry);}catch(error){reject(error);}};image.onerror=()=>reject(Error('Could not load '+assets[id].src));image.src=assets[id].src+'?v='+revisions[id];});values.set(id,record);return record.promise;
  }
  function preload(doc,ids=Object.keys(assets)){return Promise.all(ids.map(id=>load(doc,id)));}
  const skins=new WeakMap(),batches=new WeakMap(),cornerColumns=[0,1,1,0,1,0],cornerRows=[0,0,1,0,1,1];
  function skin(entry,length,segments){
    let variants=skins.get(entry);if(!variants){variants=new Map();skins.set(entry,variants);}const key=length+':'+segments;if(variants.has(key))return variants.get(key);
    const [left,top,right,bottom]=entry.bounds,[baseX,baseY]=entry.base,[tipX,tipY]=entry.tip,span=Math.hypot(tipX-baseX,tipY-baseY),ux=(tipX-baseX)/span,uy=(tipY-baseY)/span;
    const local=new Float64Array((segments+1)*4),points=new Float64Array(local.length),result=new Float32Array(segments*24);
    for(let i=0;i<=segments;i++)for(let j=0;j<2;j++){const x=left+(right-left)*i/segments,y=j?bottom:top,k=i*4+j*2;local[k]=((x-baseX)*ux+(y-baseY)*uy)/span;local[k+1]=(-(x-baseX)*uy+(y-baseY)*ux)*length/span;}
    for(let i=0;i<segments;i++)for(let j=0;j<6;j++){const col=i+cornerColumns[j],row=cornerRows[j],k=i*24+j*4;result[k+2]=(left+(right-left)*col/segments)/entry.width;result[k+3]=(row?bottom:top)/entry.height;}
    let fixed=0;const rigidUntil=assets[entry.id]?.rigidUntil||.3;for(let i=0;i<segments;i++){if(Math.max(local[i*4],local[i*4+2],local[(i+1)*4],local[(i+1)*4+2])>rigidUntil)break;fixed++;}
    batches.set(result,{fixed,segments});const value={local,points,result};variants.set(key,value);return value;
  }
  function vertices(entry,bend,deformed,length,segments=64){
    if(assets[entry.id]?.rig==='device'){
      const {result}=skin(entry,length,1),[left,top,right,bottom]=entry.bounds,center=deformed([.36,0,0],0),size=length*.54,scale=size/Math.max(right-left,bottom-top),width=(right-left)*scale,height=(bottom-top)*scale;
      for(let j=0;j<6;j++){result[j*4]=center.x+(cornerColumns[j]-.5)*width;result[j*4+1]=center.y+(cornerRows[j]-.5)*height;}return result;
    }
    // Stable UVs and output storage: no per-frame vertex arrays or spread copies.
    const {local,points,result}=skin(entry,length,segments),rigid=assets[entry.id]?.rig==='weapon',root=deformed([0,0,0],bend),end=deformed([1,0,0],bend),dx=end.x-root.x,dy=end.y-root.y,axisLength=Math.hypot(dx,dy)||1;
    for(let k=0;k<local.length;k+=2){const t=local[k],normal=local[k+1];if(rigid){points[k]=root.x+dx*t-dy/axisLength*normal;points[k+1]=root.y+dy*t+dx/axisLength*normal;}else{const until=assets[entry.id]?.rigidUntil||.3,z=Math.max(0,Math.min(1,(t-until)/(1-until))),weight=until>.3?z*z*z*(10+z*(-15+6*z)):1,p=deformed([t,normal,0],bend*weight);points[k]=p.x;points[k+1]=p.y;}}
    for(let i=0;i<segments;i++)for(let j=0;j<6;j++){const col=i+cornerColumns[j],row=cornerRows[j],k=i*24+j*4,at=col*4+row*2;result[k]=points[at];result[k+1]=points[at+1];}return result;
  }
  function createGL(gl){
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const vs=shader(gl.VERTEX_SHADER,'attribute vec2 aPoint,aUV;uniform vec2 uArea;uniform float uPad;varying vec2 vUV;void main(){vec2 p=aPoint+uPad;gl_Position=vec4(p.x/uArea.x*2.-1.,1.-p.y/uArea.y*2.,0.,1.);vUV=aUV;}'),fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D uArt;varying vec2 vUV;void main(){vec4 c=texture2D(uArt,vUV);if(c.a<.003)discard;gl_FragColor=c;}'),program=gl.createProgram();
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    const buffer=gl.createBuffer(),textures=new Map(),point=gl.getAttribLocation(program,'aPoint'),uv=gl.getAttribLocation(program,'aUV'),artUniform=gl.getUniformLocation(program,'uArt'),areaUniform=gl.getUniformLocation(program,'uArea'),padUniform=gl.getUniformLocation(program,'uPad');let bufferBytes=0;
    return{draw(entry,data,area,pad){
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(bufferBytes!==data.byteLength){gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);bufferBytes=data.byteLength;}else gl.bufferSubData(gl.ARRAY_BUFFER,0,data);gl.enableVertexAttribArray(point);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(point,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
      gl.activeTexture(gl.TEXTURE0);let texture=textures.get(entry.id);if(!texture){texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,entry.image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);textures.set(entry.id,texture);if(textures.size>3){const oldest=textures.keys().next().value;gl.deleteTexture(textures.get(oldest));textures.delete(oldest);}}
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(artUniform,0);gl.uniform2fv(areaUniform,area);gl.uniform1f(padUniform,pad);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,data.length/4);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);
    },destroy(){for(const t of textures.values())gl.deleteTexture(t);textures.clear();gl.deleteBuffer(buffer);gl.deleteProgram(program);}};
  }
  function draw2D(ctx,entry,data){
    const rigid=['weapon','device'].includes(assets[entry.id]?.rig),fixed=batches.get(data)?.fixed||0,top=entry.bounds[1],height=entry.bounds[3]-top;
    function draw(i,clip,left,right){
      const x0=data[i],y0=data[i+1],u0=data[i+2]*entry.width,v0=data[i+3]*entry.height,x1=data[i+4],y1=data[i+5],u1=data[i+6]*entry.width,v1=data[i+7]*entry.height,x2=data[i+8],y2=data[i+9],u2=data[i+10]*entry.width,v2=data[i+11]*entry.height,det=(u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);if(Math.abs(det)<1e-5)return;
      const ax=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/det,ay=((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/det,bx=((x2-x0)*(u1-u0)-(x1-x0)*(u2-u0))/det,by=((y2-y0)*(u1-u0)-(y1-y0)*(u2-u0))/det;
      ctx.save();if(clip){ctx.beginPath();const mx=(x0+x1+x2)/3,my=(y0+y1+y2)/3;for(let j=0;j<12;j+=4){const dx=data[i+j]-mx,dy=data[i+j+1]-my,d=Math.hypot(dx,dy)||1,x=data[i+j]+dx/d*.17,y=data[i+j+1]+dy/d*.17;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.clip();left=Math.max(0,Math.floor(Math.min(u0,u1,u2))-2);right=Math.min(entry.width,Math.ceil(Math.max(u0,u1,u2))+2);}
      ctx.transform(ax,ay,bx,by,x0-ax*u0-bx*v0,y0-ay*u0-by*v0);ctx.drawImage(entry.image,left,top,right-left,height,left,top,right-left,height);ctx.restore();
    }
    // Identical affine sections can be batched without reducing bend resolution.
    // Crop before rasterisation instead of repeatedly sampling an entire 2K PNG.
    if(rigid){draw(0,false,entry.bounds[0],entry.bounds[2]);return;}
    if(fixed)draw(0,false,entry.bounds[0],Math.min(entry.bounds[2],data[(fixed-1)*24+6]*entry.width+2));
    for(let i=fixed*24;i<data.length;i+=12)draw(i,true);
  }
  return{assets,get,load,preload,vertices,createGL,draw2D};
  }
  return Object.assign(createCollection(assets,revisions),{createCollection});
});
