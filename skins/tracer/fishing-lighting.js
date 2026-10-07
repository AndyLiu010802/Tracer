(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingLighting=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  function lightView({center=[0,0,0],direction=[-.62,1,-.68],extent=4.5,distance=12,near=.1,far=25}={}){
    const z=unit(direction),x=unit(cross(Math.abs(z[1])>.97?[0,0,1]:[0,1,0],z)),y=cross(z,x),eye=center.map((v,i)=>v+z[i]*distance),size=Array.isArray(extent)?extent:[extent,extent],matrix=new Float32Array(16);
    for(let i=0;i<3;i++){matrix[i*4]=x[i]/size[0];matrix[i*4+1]=y[i]/size[1];matrix[i*4+2]=-2*z[i]/(far-near);}
    matrix[12]=-dot(x,eye)/size[0];matrix[13]=-dot(y,eye)/size[1];matrix[14]=(2*dot(z,eye)-far-near)/(far-near);matrix[15]=1;return matrix;
  }
  // RG stores 16-bit depth without requiring WEBGL_depth_texture. B is unused;
  // white is the unoccluded far plane. Comparison filtering happens in GLSL.
  const fragment=`
    uniform sampler2D uShadowMap;
    uniform mat4 uLightView;
    uniform float uShadowPass,uShadowEnabled,uShadowTexel,uShadowBias;
    vec4 fishingDepth(float depth){vec2 p=fract(min(depth,.99998)*vec2(1.,255.));p.x-=p.y/255.;return vec4(p,0.,1.);}
    float fishingVisibility(vec3 world,vec3 normal,vec3 light){
      if(uShadowEnabled<.5)return 1.;
      vec3 p=(uLightView*vec4(world,1.)).xyz*.5+.5;
      if(p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z<=0.||p.z>=1.)return 1.;
      float bias=uShadowBias*(.4+1.6*(1.-max(0.,dot(normalize(normal),normalize(light))))),lit=0.;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
        vec2 depthRG=texture2D(uShadowMap,p.xy+vec2(float(x),float(y))*uShadowTexel).rg;
        float depth=dot(depthRG,vec2(1.,1./255.));lit+=step(p.z-bias,depth);
      }
      return lit/9.;
    }
  `;
  const disabledFragment='uniform float uShadowPass;vec4 fishingDepth(float d){return vec4(1.);}float fishingVisibility(vec3 p,vec3 n,vec3 l){return 1.;}';
  function createShadowMap(gl,program,{size=1024,matrix=lightView(),bias=.0012}={}){
    if(typeof gl.createFramebuffer!=='function')return null;
    size=Math.min(size,gl.getParameter(gl.MAX_TEXTURE_SIZE));
    let framebuffer=null,texture=null,depth=null,blank=null,disposed=false;
    const uniform={};for(const key of['ShadowMap','LightView','ShadowPass','ShadowEnabled','ShadowTexel','ShadowBias'])uniform[key]=gl.getUniformLocation(program,'u'+key);
    function release(){if(texture)gl.deleteTexture(texture);if(blank)gl.deleteTexture(blank);if(depth)gl.deleteRenderbuffer(depth);if(framebuffer)gl.deleteFramebuffer(framebuffer);texture=blank=depth=framebuffer=null;}
    try{
      framebuffer=gl.createFramebuffer();texture=gl.createTexture();depth=gl.createRenderbuffer();
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(const [key,value]of[[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
      gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete shadow target');
      blank=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,blank);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    }catch(_){release();return null;}finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.activeTexture(gl.TEXTURE0);}
    function configure(enabled){gl.uniform1i(uniform.ShadowMap,1);gl.uniform1f(uniform.ShadowEnabled,enabled?1:0);gl.uniform1f(uniform.ShadowTexel,1/size);gl.uniform1f(uniform.ShadowBias,bias);gl.uniformMatrix4fv(uniform.LightView,false,matrix);}
    return{size,matrix,begin(){if(disposed)return;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,blank);gl.activeTexture(gl.TEXTURE0);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,size,size);gl.disable(gl.BLEND);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.5,2);gl.depthMask(true);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);configure(false);gl.uniform1f(uniform.ShadowPass,1);},end(width,height,enabled=true){if(disposed)return;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.POLYGON_OFFSET_FILL);gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);gl.activeTexture(gl.TEXTURE0);configure(enabled);gl.uniform1f(uniform.ShadowPass,0);},destroy(){if(disposed)return;disposed=true;release();}};
  }
  return Object.freeze({fragment,disabledFragment,lightView,createShadowMap});
});
