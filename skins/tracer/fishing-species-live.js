(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingSpeciesLive=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Original paintings wrap both sides of a rounded, deformable volume.
  // Silhouette distance preserves fine fins while giving the torso real depth.
  // Only resident species get a GPU texture; a whole atlas is never uploaded.
  const documents=new WeakMap();
  function portrait(f,assets){const id=f?.speciesId||f?.fishId||f?.id;return id&&Object.hasOwn(assets||{},id)?{id,...assets[id]}:null;}
  function profile(f,body=''){
    const id=[f?.speciesId,f?.fishId,f?.id,body,f?.shape,f?.body].join(' ');
    return /jelly|medusa/i.test(id)?2:/octopus|kraken|squid|cuttle/i.test(id)?3:/crab|shrimp|prawn|lobster|turtle|clam|snail|starfish|urchin|hermit|copepod|isopod/i.test(id)?4:/ray|skate/i.test(id)?1:/eel|loach|ribbon|gulper|seadragon|seahorse/i.test(id)?5:0;
  }
  function page(doc,src){
    let cache=documents.get(doc);if(!cache){cache=new Map();documents.set(doc,cache);}
    if(cache.has(src)){const entry=cache.get(src);cache.delete(src);cache.set(src,entry);return entry;}
    const win=doc.defaultView||globalThis;
    const promise=new Promise((resolve,reject)=>{const image=new win.Image();image.decoding='async';image.onload=()=>{image.onload=image.onerror=null;resolve(image);};image.onerror=()=>{cache.delete(src);reject(new Error('Fish painting unavailable: '+src));};image.src=src;});
    cache.set(src,promise);while(cache.size>2)cache.delete(cache.keys().next().value);return promise;
  }
  const vertex=`
    attribute vec3 aGrid,aSurfaceNormal;
    uniform mat4 uView;
    uniform vec3 uCenter,uRight,uUp,uNormal;
    uniform vec2 uSize;
    uniform float uPhase,uMotion,uKind,uRoll;
    varying vec2 vUv;
    varying vec3 vNormal;
    void main(){
      vUv=aGrid.xy;float tail=smoothstep(.32,1.,aGrid.x),lower=smoothstep(.30,1.,aGrid.y);
      vec2 p=(aGrid.xy-vec2(.5))*vec2(1.,-1.);float bend=sin(uPhase-aGrid.x*6.)*tail*tail;
      float depth=bend*.065;
      if(uKind<.5){p.y+=bend*.024*uMotion;}
      else if(uKind<1.5){float wing=pow(abs(p.y)*2.,1.6);p.y*=1.+sin(uPhase)*.08*uMotion;depth=sin(uPhase+abs(p.y)*4.)*wing*.10;}
      else if(uKind<2.5){p.x*=1.+sin(uPhase)*.045*uMotion;p.x+=sin(uPhase-aGrid.y*7.)*lower*lower*.027*uMotion;depth=0.;}
      else if(uKind<3.5){p.x+=sin(uPhase-aGrid.y*9.)*lower*lower*.038*uMotion;p.y+=cos(uPhase+aGrid.x*9.)*lower*.013*uMotion;}
      else if(uKind<4.5){p.y+=sin(uPhase*1.3+aGrid.x*17.)*lower*lower*.009*uMotion;depth=0.;}
      else{p.y+=bend*.052*uMotion;depth*=1.4;}
      p*=uSize;float c=cos(uRoll),s=sin(uRoll);p=mat2(c,s,-s,c)*p;
      vec3 world=uCenter+uRight*p.x+uUp*p.y+uNormal*((aGrid.z+depth*uMotion)*uSize.x);
      vec2 n=mat2(c,s,-s,c)*aSurfaceNormal.xy;
      vNormal=normalize(uRight*n.x+uUp*n.y+uNormal*aSurfaceNormal.z);
      gl_Position=uView*vec4(world,1.);
    }`;
  const fragment=`
    precision mediump float;
    uniform sampler2D uPortrait;uniform float uShadow;
    varying vec2 vUv;
    varying vec3 vNormal;
    void main(){
      vec4 c=texture2D(uPortrait,vUv);if(c.a<.08)discard;
      if(uShadow>.5){if(c.a<.45)discard;vec2 p=fract(min(gl_FragCoord.z,.99998)*vec2(1.,255.));p.x-=p.y/255.;gl_FragColor=vec4(p,0.,1.);}
      else {float light=max(0.,dot(normalize(vNormal),normalize(vec3(-.35,.8,.5))));gl_FragColor=vec4(c.rgb*(.72+.33*light),c.a);}
    }`;
  function volumeMesh(pixels,w,h,kind=0){
    const nx=64,ny=44,stride=nx+1,d=new Float32Array(stride*(ny+1)),z=new Float32Array(d.length),aspect=w/h;
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
      const px=Math.min(w-1,Math.round(x/nx*(w-1))),py=Math.min(h-1,Math.round(y/ny*(h-1)));
      d[y*stride+x]=x&&y&&x<nx&&y<ny&&pixels[(py*w+px)*4+3]>80?999:0;
    }
    for(let y=1;y<ny;y++)for(let x=1;x<nx;x++){const i=y*stride+x;d[i]=Math.min(d[i],d[i-1]+1,d[i-stride]+1,d[i-stride-1]+1.414,d[i-stride+1]+1.414);}
    for(let y=ny-1;y>0;y--)for(let x=nx-1;x>0;x--){const i=y*stride+x;d[i]=Math.min(d[i],d[i+1]+1,d[i+stride]+1,d[i+stride+1]+1.414,d[i+stride-1]+1.414);}
    const thickness=[.12,.05,.15,.11,.13,.065][kind]||.12;
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
      const i=y*stride+x,u=x/nx,v=y/ny;
      // Broad torso, narrow caudal peduncle, thin flexible fins and whiskers.
      const torso=Math.sqrt(Math.max(0,1-Math.pow((u-.40)/.43,2)-Math.pow((v-.50)/.42,2)));
      z[i]=Math.min(Math.sqrt(d[i]/nx)*.44,thickness*(.13+.87*torso))*Math.min(1,d[i]/1.5);
    }
    const vertices=[];
    function vertex(x,y,side){const i=y*stride+x,dx=(z[y*stride+Math.min(nx,x+1)]-z[y*stride+Math.max(0,x-1)])*nx/2,dy=(z[Math.min(ny,y+1)*stride+x]-z[Math.max(0,y-1)*stride+x])*ny*aspect/2;vertices.push(x/nx,y/ny,z[i]*side,-dx,dy,side);}
    for(const side of [1,-1])for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      if(!d[y*stride+x]&&!d[y*stride+x+1]&&!d[(y+1)*stride+x]&&!d[(y+1)*stride+x+1])continue;
      for(const [dx,dy] of (side===1?[[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]:[[0,0],[1,0],[0,1],[1,0],[1,1],[0,1]]))vertex(x+dx,y+dy,side);
    }
    return new Float32Array(vertices);
  }
  function swimBasis(angle){return{right:[-Math.cos(angle),0,Math.sin(angle)],up:[0,1,0],normal:[-Math.sin(angle),0,-Math.cos(angle)]};}
  function create(gl,doc,assets,onReady=()=>{}){
    const win=doc.defaultView||globalThis,entries=new Map();let destroyed=false;
    const shaders=[];let program;
    try{
      program=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);}
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    }catch(error){if(program)gl.deleteProgram(program);throw error;}finally{for(const shader of shaders)gl.deleteShader(shader);}
    const attribute=gl.getAttribLocation(program,'aGrid'),surfaceNormal=gl.getAttribLocation(program,'aSurfaceNormal'),u={};for(const key of ['View','Center','Right','Up','Normal','Size','Phase','Motion','Kind','Roll','Portrait','Shadow'])u[key]=gl.getUniformLocation(program,'u'+key);
    function drop(entry){entry.cancelled=true;entry.source?.close?.();entry.source=null;if(entry.texture)gl.deleteTexture(entry.texture);if(entry.buffer)gl.deleteBuffer(entry.buffer);entry.vertices=null;}
    function sync(fish){
      const wanted=new Map(fish.map(f=>portrait(f,assets)).filter(Boolean).map(p=>[p.id,p]));
      for(const [id,entry] of entries)if(!wanted.has(id)){drop(entry);entries.delete(id);}
      for(const [id,p] of wanted){if(entries.has(id))continue;const entry={p,cancelled:false,source:null,texture:null};entries.set(id,entry);
        page(doc,p.src).then(async image=>{
          if(destroyed||entry.cancelled)return;const [x,y,right,bottom]=p.bounds,w=right-x,h=bottom-y;
          let source;if(win.createImageBitmap)source=await win.createImageBitmap(image,x,y,w,h,{premultiplyAlpha:'none'});
          else{source=doc.createElement('canvas');source.width=w;source.height=h;source.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);}
          if(destroyed||entry.cancelled){source.close?.();return;}
          const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
          entry.vertices=volumeMesh(ctx.getImageData(0,0,w,h).data,w,h,profile({id}));entry.count=entry.vertices.length/6;entry.source=source;onReady();
        }).catch(()=>{entry.failed=true;onReady();});
      }
    }
    function draw(f,pose,settings){
      const p=portrait(f,assets),entry=p&&entries.get(p.id);if(!entry||entry.failed)return false;
      if(!entry.texture&&!entry.source)return true;
      gl.activeTexture(gl.TEXTURE3);
      if(!entry.texture){entry.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,entry.texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,entry.source);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);entry.source.close?.();entry.source=null;}
      else gl.bindTexture(gl.TEXTURE_2D,entry.texture);
      gl.useProgram(program);
      if(!entry.buffer){entry.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,entry.buffer);gl.bufferData(gl.ARRAY_BUFFER,entry.vertices,gl.STATIC_DRAW);entry.vertices=null;}else gl.bindBuffer(gl.ARRAY_BUFFER,entry.buffer);
      gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(surfaceNormal);gl.vertexAttribPointer(surfaceNormal,3,gl.FLOAT,false,24,12);
      const {right,up,normal}=swimBasis(pose.angle);
      const width=settings.scale*3.2,aspect=(p.bounds[2]-p.bounds[0])/(p.bounds[3]-p.bounds[1]);
      gl.uniformMatrix4fv(u.View,false,settings.view);gl.uniform3f(u.Center,pose.x,pose.y,pose.z);gl.uniform3fv(u.Right,right);gl.uniform3fv(u.Up,up);gl.uniform3fv(u.Normal,normal);
      gl.uniform2f(u.Size,width,width/aspect);gl.uniform1f(u.Roll,(pose.roll||0)*.35+(pose.pitch||0)*.5);
      gl.uniform1f(u.Phase,settings.time*(settings.kind===4?3.8:4.6)+(pose.seed%97));gl.uniform1f(u.Motion,settings.quiet?0:1+(pose.e||0)*.55);
      gl.uniform1f(u.Kind,settings.kind);gl.uniform1f(u.Shadow,settings.shadow?1:0);gl.uniform1i(u.Portrait,3);gl.drawArrays(gl.TRIANGLES,0,entry.count);
      gl.activeTexture(gl.TEXTURE0);return true;
    }
    return {sync,draw,stats:()=>({residents:entries.size,ready:[...entries.values()].filter(e=>e.texture||e.source).length,textures:[...entries.values()].filter(e=>e.texture).length,bytes:[...entries.values()].filter(e=>e.texture).reduce((n,e)=>n+(e.p.bounds[2]-e.p.bounds[0])*(e.p.bounds[3]-e.p.bounds[1])*4,0)}),destroy(){if(destroyed)return;destroyed=true;for(const entry of entries.values())drop(entry);entries.clear();gl.deleteProgram(program);}};
  }
  return Object.freeze({portrait,profile,volumeMesh,swimBasis,create});
});
