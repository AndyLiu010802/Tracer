/* Local material flow: travelling water normals, advected cloud density and
   rising emission. One shared GPU surface; never translates the camera. */
(function(){
  'use strict';
  const vertex='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fragment=`precision highp float;
    uniform sampler2D image;uniform vec4 crop;uniform float time,mode,start,power;uniform vec2 size;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
    float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.07)*.15;}
    vec3 photo(vec2 p){return texture2D(image,crop.xy+clamp(p,.001,.999)*crop.zw).rgb;}
    float waves(vec2 p){return sin(dot(p,vec2(.18,1.))*4.1+time*2.8)*.48+sin(dot(p,vec2(-.37,.92))*7.3+time*3.9)*.24+sin(dot(p,vec2(.61,.8))*12.1+time*5.1)*.12;}
    vec3 advect(vec2 uv,vec2 velocity,float period){
      // Each packet moves in one direction, fading out before its lifetime resets.
      float phase=fract(time/period),other=fract(phase+.5),weight=abs(phase*2.-1.);
      return mix(photo(uv-velocity*(phase-.5)),photo(uv-velocity*(other-.5)),weight);
    }
    float emission(vec3 color){return smoothstep(.30,.63,color.g)*smoothstep(.52,.88,color.r)*smoothstep(.12,.32,color.r-color.b);}
    void main(){
      vec2 uv=vec2(gl_FragCoord.x/size.x,1.-gl_FragCoord.y/size.y);vec3 base=photo(uv),color=base;float alpha=1.;
      if(mode<.5){
        float depth=clamp((uv.y-start)/(1.-start),0.,1.);vec2 p=vec2((uv.x-.5)*8.,4.)/(.18+depth);
        float h=waves(p),nx=(waves(p+vec2(.018,0))-h)/.018,nz=(waves(p+vec2(0,.018))-h)/.018;
        vec2 distortion=vec2(nx*.00065,nz*.0024)*depth*power;
        color=photo(uv+distortion);
        float crest=pow(max(h+.03,0.),5.);float breakup=smoothstep(.25,.75,noise(p*15.+vec2(0,time*.6)));
        color+=vec3(.30,.39,.42)*crest*breakup*depth*power*.45;
        float sheen=pow(max(0.,nz*.22+.4),5.);color+=vec3(.13,.19,.22)*min(sheen,.8)*(.12+depth)*power;
        alpha=smoothstep(0.,.10,depth);
      }else if(mode<1.5){
        float depth=smoothstep(.13,1.,uv.y);vec2 velocity=vec2(.028+depth*.11,-.003-depth*.014);
        velocity*=.8+noise(uv*4.)*.35;vec3 moving=advect(uv,velocity,12.);
        float sun=1.-exp(-dot((uv-vec2(.91,.18))*vec2(10,14),(uv-vec2(.91,.18))*vec2(10,14)));
        alpha=smoothstep(.1,.36,uv.y)*sun;color=moving;
      }else if(mode<2.5){
        vec2 velocity=vec2(.04,-.018)*(.4+noise(uv*5.));vec3 moving=advect(uv,velocity,16.);
        float stars=1.-smoothstep(.52,.86,max(base.r,max(base.g,base.b)));
        alpha=stars*.8;color=moving;
      }else{
        vec2 q=(uv-vec2(.50,.54))/vec2(.19,.22);float region=(1.-smoothstep(.65,1.,length(q)))*(1.-smoothstep(.63,.76,uv.y));
        float a=fract(time*.65),b=fract(a+.5),blend=abs(a*2.-1.);
        float curl=(fbm(vec2(uv.x*30.,uv.y*14.+time*1.3))-.5)*.012;
        vec3 f1=photo(uv+vec2(curl,a*.16)),f2=photo(uv+vec2(curl,b*.16));
        vec3 fire=mix(f1*emission(f1)*(1.-a*.7),f2*emission(f2)*(1.-b*.7),blend);
        color=base*(1.-emission(base)*.12)+fire*.65;
        alpha=region; // Hearth, masonry and logs outside the flame stay fixed.
      }
      gl_FragColor=vec4(clamp(color,0.,1.),alpha);
    }`;
  let state=null,failed=false;const unavailable=new WeakSet();
  function initialize(){
    if(state||failed)return state;
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:'low-power'});if(!gl){failed=true;return null;}
    try{
      const program=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);gl.deleteShader(s);}gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
      const u={};for(const name of ['image','crop','time','mode','start','power','size'])u[name]=gl.getUniformLocation(program,name);gl.uniform1i(u.image,0);gl.uniform2f(u.size,1600,1000);gl.viewport(0,0,1600,1000);
      state={canvas,gl,program,buffer,u,textures:new Map()};canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;state=null;});return state;
    }catch{gl.getExtension('WEBGL_lose_context')?.loseContext();failed=true;return null;}
  }
  function draw(c,s,t,mode,start=0,power=1){
    if(unavailable.has(s))return false;const r=initialize();if(!r)return false;const {gl,u,textures}=r;let created=null;
    try{
      let texture=textures.get(s.url);if(!texture){texture=created=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,s.image);textures.set(s.url,texture);if(textures.size>4){const first=textures.keys().next().value;gl.deleteTexture(textures.get(first));textures.delete(first);}}else{textures.delete(s.url);textures.set(s.url,texture);gl.bindTexture(gl.TEXTURE_2D,texture);}
      gl.uniform4f(u.crop,s.sx/s.image.naturalWidth,s.sy/s.image.naturalHeight,s.sw/s.image.naturalWidth,s.sh/s.image.naturalHeight);gl.uniform1f(u.time,t);gl.uniform1f(u.mode,mode);gl.uniform1f(u.start,start/1000);gl.uniform1f(u.power,power);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);c.drawImage(r.canvas,0,0,1600,1000);return true;
    }catch{if(created)gl.deleteTexture(created);textures.delete(s.url);unavailable.add(s);return false;}
  }
  window.TracerWallpaperFlow={draw,get available(){return !!initialize();}};
})();
