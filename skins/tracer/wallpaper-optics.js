/* Live material borders. Procedural bevel normals, environment reflection and
   wallpaper refraction; no DOM screenshots, external assets or per-card loops. */
(function () {
  'use strict';
  const scriptURL = document.currentScript?.src || location.href;
  const previewURL = new URL('wallpapers/dynamic-01-v2.png', scriptURL).href;
  const styles = {
    glass: [0, .67, .85, .94], titanium: [1, .55, .60, .65], walnut: [2, .32, .14, .065],
    obsidian: [3, .10, .115, .13], porcelain: [4, .72, .85, .78], linen: [5, .64, .55, .40],
    velvet: [6, .28, .065, .14], paper: [7, .78, .77, .65], cyber: [8, .19, .20, .39], celadon: [9, .44, .56, .29]
  };
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision highp float;
    uniform vec2 resolution, light, imageSize;
    uniform vec4 rects[4];
    uniform vec4 widths, radii;
    uniform float kind;
    uniform vec3 tint;
    uniform sampler2D scene;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
    float sdf(vec2 p,vec4 r,float corner){vec2 q=abs(p-r.xy-r.zw*.5)-r.zw*.5+corner;return min(max(q.x,q.y),0.)+length(max(q,0.))-corner;}
    vec3 background(vec2 uv){vec2 scale=vec2(1.);float a=resolution.x/resolution.y,b=imageSize.x/imageSize.y;if(a>b)scale.y=b/a;else scale.x=a/b;return texture2D(scene,clamp((uv-.5)*scale+.5,.001,.999)).rgb;}
    vec3 environment(vec3 ray){
      float window=exp(-pow((ray.x+.38)/.25,2.)-pow((ray.y+.1)/.8,6.));
      float strip=exp(-pow((ray.y-.62)/.065,2.));
      return mix(vec3(.055,.075,.105),vec3(.35,.48,.65),smoothstep(-.5,.9,ray.y))+vec3(1.1,1.05,.93)*window+vec3(.60,.74,.9)*strip;
    }
    void main(){
      vec2 p=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
      float distance=1000.,width=1.;vec4 box=rects[0];float radius=radii.x;
      for(int i=0;i<4;i++){
        float w=widths[i];float d=sdf(p,rects[i],radii[i]);
        if(w>0.&&d<.6&&d>-w-.6){distance=d;width=w;box=rects[i];radius=radii[i];break;}
      }
      if(distance>1.)discard;
      float u=clamp(-distance/width,0.,1.);
      float alpha=(1.-smoothstep(-.6,.6,distance))*smoothstep(-width-.6,-width+.6,distance);
      vec2 grad=normalize(vec2(sdf(p+vec2(.4,0),box,radius)-sdf(p-vec2(.4,0),box,radius),sdf(p+vec2(0,.4),box,radius)-sdf(p-vec2(0,.4),box,radius))+vec2(.0001));
      float slope=cos(u*3.14159)*1.65;
      if(kind<.5)slope=u<.22?1.55:(u<.40?.55:(u<.67?-.16:(u<.85?-.8:-1.9)));
      else if(kind<1.5)slope=u<.18?1.4:(u<.75?.08:-1.5);
      else if(kind<2.5||kind>8.5)slope=cos(u*3.14159)*1.3+sin(u*18.85)*.33;
      bool vertical=abs(grad.x)>abs(grad.y);
      vec2 grain=vertical?vec2(p.x,p.y):vec2(p.y,p.x);
      float curl=sin(grain.y*.008+noise(grain*.006)*4.)*2.8+noise(vec2(grain.y*.015,grain.x*.035))*3.;
      float rings=sin(grain.x*1.15+curl),fibres=noise(vec2(grain.x*2.,grain.y*.026));
      float pores=pow(noise(vec2(grain.x*3.,grain.y*.13)),8.);
      float brush=noise(vec2(grain.x*2.,grain.y*.008));
      vec3 normal=normalize(vec3(grad*slope,1.));
      if(kind>1.5&&kind<2.5||kind>8.5)normal=normalize(normal+vec3(grad*(rings*.12+fibres*.13),0));
      if(kind>.5&&kind<1.5)normal=normalize(normal+vec3(grad*(brush-.5)*.10,0));
      vec2 uv=p/resolution;
      vec3 L=normalize(vec3((light-uv)*vec2(resolution.x/resolution.y,1.)*1.6,.8));
      vec3 H=normalize(L+vec3(0,0,1));
      vec3 reflected=reflect(vec3(0,0,-1),normal);
      vec3 env=environment(reflected+vec3((light-.5)*.5,0));
      env=mix(env,background(uv+normal.xy*.14),.24);
      float diffuse=max(dot(normal,L),0.),spec=pow(max(dot(normal,H),0.),70.);
      float fresnel=.045+.955*pow(1.-normal.z,5.);
      float edge=exp(-pow(u/.055,2.))+exp(-pow((u-.99)/.045,2.));
      vec3 color;
      if(kind<.5){
        // Snell refraction through a bevel, with a small RGB IOR separation.
        vec3 rr=refract(vec3(0,0,-1),normal,1./1.50);
        vec3 rg=refract(vec3(0,0,-1),normal,1./1.52);
        vec3 rb=refract(vec3(0,0,-1),normal,1./1.55);
        float depth=.035+.09*sin(u*3.14159);
        vec3 transmitted=vec3(background(uv+rr.xy*depth).r,background(uv+rg.xy*depth).g,background(uv+rb.xy*depth).b);
        color=mix(transmitted*vec3(.81,.95,1.),env,clamp(.16+fresnel*.75+abs(slope)*.09,0.,.85));
        color+=spec*vec3(.85,.95,1.)+edge*.42;
        float facet=exp(-pow((u-.22)/.012,2.))+exp(-pow((u-.67)/.012,2.));
        color+=facet*vec3(.18,.25,.29)*(diffuse+.3);
        color+=vec3(.02,.10,.14)*sin(u*38.+p.x*.012)*fresnel;
      }else if(kind<1.5){
        vec3 tangent=vertical?vec3(0,1,0):vec3(1,0,0);
        vec3 bitangent=normalize(cross(normal,tangent));
        float nh=max(dot(normal,H),.04);
        float anisotropic=exp(-(pow(dot(H,tangent)/.36,2.)+pow(dot(H,bitangent)/.075,2.))/(nh*nh));
        color=tint*(.23+.35*diffuse)+(env*.70+anisotropic*.70)*( .82+brush*.24);
        color*=.93+.075*sin(grain.x*5.)+.05*brush;
        color+=edge*.36;
        color*=1.-.55*exp(-pow((u-.78)/.025,2.));
      }else if(kind<2.5||kind>8.5){
        float growth=.53+.11*rings+.17*fibres+.08*noise(grain*.06);
        color=tint*(growth*1.7)*(.56+.6*diffuse);
        color*=1.-pores*.8;
        float lacquer=pow(max(dot(normal,H),0.),95.);
        color+=env*(.055+fresnel*.30)+lacquer*vec3(.60,.43,.26);
        color*=1.-.42*exp(-pow((u-.79)/.032,2.));
        color+=vec3(.22,.12,.045)*exp(-pow((u-.84)/.018,2.))*(diffuse+.15);
        color+=edge*vec3(.11,.055,.018);
      }else if(kind<3.5){
        float vein=pow(1.-abs(sin(p.x*.019+noise(p*.007)*5.+p.y*.023)),18.);
        color=tint*(.7+diffuse*.3)+env*.23+spec*.35+vein*vec3(.10,.075,.035);
        float inlay=exp(-pow((u-.75)/.04,2.));color=mix(color,vec3(.61,.44,.19)*(env+diffuse*.5+.3),inlay);
      }else if(kind<4.5){color=tint*(.58+.35*diffuse)+env*.15+spec*.55+edge*.23;
      }else if(kind<5.5){float weave=sin(grain.x*2.6)*sin(grain.y*2.6);color=tint*(.72+.20*diffuse+weave*.09+noise(p)*.08);
      }else if(kind<6.5){color=tint*(.5+.55*diffuse+noise(p)*.22)+vec3(.2,.065,.10)*pow(1.-normal.z,2.);
      }else if(kind<7.5){color=tint*(.82+.14*diffuse+noise(p)*.06)-pores*.08;
      }else{color=tint*(.5+diffuse*.3)+env*.22;float line=exp(-pow((u-.72)/.032,2.));color+=line*vec3(.25,.85,.78)+edge*.2;}
      gl_FragColor=vec4(clamp(color,0.,1.),alpha);
    }`;
  const images = new Map();
  function loadImage(url) {
    if (!images.has(url)) images.set(url, new Promise(resolve => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = url; }));
    return images.get(url);
  }
  function studio() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 512, 320);
    g.addColorStop(0, '#91aeb9'); g.addColorStop(.36, '#293e50'); g.addColorStop(.68, '#101a28'); g.addColorStop(1, '#aaa18c');
    x.fillStyle = g; x.fillRect(0, 0, 512, 320); x.fillStyle = '#bcd8da'; x.fillRect(75, 0, 36, 320); return c;
  }
  function mount(host, options = {}) {
    const material = options.material || 'glass', style = styles[material] || styles.glass;
    const canvas = document.createElement('canvas'); canvas.className = 'wallpaper-optics'; canvas.setAttribute('aria-hidden', 'true'); host.append(canvas);
    let gl, program, buffer, texture, destroyed = false, lost = false, frame = 0, last = 0, paused = false, visible = true, dirty = true, uploads = 0, draws = 0;
    let source = options.image || studio(), pendingUpload = true, width = 0, height = 0;
    let target = [.28, .18], light = target.slice();
    const lightSurface = options.workspace ? document.documentElement : host;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'), locations = {}, shaders = [];
    function stop() { cancelAnimationFrame(frame); frame = 0; }
    function destroy() {
      if (destroyed) return; destroyed = true; stop(); resize.disconnect(); intersection.disconnect();
      pointerSurface.removeEventListener('pointermove', move); pointerSurface.removeEventListener('pointerleave', leave);
      ['visibilitychange','tracer-visibilitychange'].forEach(event=>document.removeEventListener(event,wake)); reduced.removeEventListener('change', wake);
      canvas.removeEventListener('webglcontextlost', contextLost);
      if (gl) { if (texture) gl.deleteTexture(texture); if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); shaders.forEach(s => gl.deleteShader(s)); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
      canvas.remove(); lightSurface.style.removeProperty('--material-light-x'); lightSurface.style.removeProperty('--material-light-y');
    }
    function contextLost(e) { e.preventDefault(); lost = true; canvas.dataset.materialRenderer = 'fallback'; stop(); }
    function active() { return !destroyed && !lost && visible && !(document.hidden || document.tracerHidden); }
    function schedule() { if (active() && !frame) frame = requestAnimationFrame(tick); }
    function wake() { dirty = true; stop(); schedule(); }
    function move(e) {
      if (reduced.matches || paused) return;
      const b = host.getBoundingClientRect(); target = [Math.max(0, Math.min(1, (e.clientX-b.left)/b.width)), Math.max(0, Math.min(1, (e.clientY-b.top)/b.height))]; dirty = true; schedule();
    }
    function leave() { if (!reduced.matches && !paused) { target = [.28, .18]; dirty = true; schedule(); } }
    function compile(type, code) { const s = gl.createShader(type); shaders.push(s); gl.shaderSource(s, code); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function upload(s) { gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,s); gl.uniform2f(locations.imageSize,s.naturalWidth||s.width,s.naturalHeight||s.height); uploads++; }
    function draw() {
      if (!gl || lost || destroyed) return;
      const bounds = host.getBoundingClientRect(), w = bounds.width, h = bounds.height;
      if (w < 1 || h < 1) return;
      const ratio = Math.min(devicePixelRatio || 1, 1.5, 2200 / w);
      if (width !== w || height !== h) { width=w; height=h; canvas.width=Math.round(w*ratio); canvas.height=Math.round(h*ratio); gl.viewport(0,0,canvas.width,canvas.height); }
      gl.useProgram(program); gl.uniform2f(locations.resolution,canvas.width,canvas.height); gl.uniform2fv(locations.light,light);
      const preview = options.preview, edge = options.edge || (preview ? Math.max(17,Math.min(36,w*.065)) : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-edge')) || 14);
      const rects = [{x:0,y:0,w,h,width:edge,radius:material==='glass'?edge*1.25:material==='walnut'?8:5}, ...(options.rects?.() || [])].slice(0,4);
      const boxes = new Float32Array(16), widths = new Float32Array(4), radii = new Float32Array(4);
      rects.forEach((r,i) => { boxes.set([r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio],i*4); widths[i]=r.width*ratio; radii[i]=(r.radius||0)*ratio; });
      gl.uniform4fv(locations.rects,boxes); gl.uniform4fv(locations.widths,widths); gl.uniform4fv(locations.radii,radii);
      const live = options.source?.();
      try { if (live?.width && live?.height && (!paused && !reduced.matches || pendingUpload)) { upload(live); pendingUpload=false; } else if (pendingUpload) { upload(source); pendingUpload=false; } } catch { pendingUpload=false; }
      gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES,0,6); draws++;
      lightSurface.style.setProperty('--material-light-x', (light[0]*100).toFixed(1)+'%'); lightSurface.style.setProperty('--material-light-y', (light[1]*100).toFixed(1)+'%');
      canvas.dataset.materialRenderer='webgl';
    }
    function tick(time) {
      frame=0; if (!active()) return;
      if (time-last < 1000/24) { schedule(); return; } last=time;
      if (reduced.matches) light=[.28,.18];
      else if (!paused) light=light.map((n,i)=>n+(target[i]-n)*.28);
      const moving=Math.abs(light[0]-target[0])+Math.abs(light[1]-target[1])>.001;
      if (dirty || moving || options.source && !paused && !reduced.matches) { draw(); dirty=false; }
      if (moving && !paused && !reduced.matches || options.source && !paused && !reduced.matches) schedule();
    }
    const pointerSurface=options.workspace?document:host;
    const resize=new ResizeObserver(()=>{dirty=true;schedule();});resize.observe(host);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;wake();});intersection.observe(host);
    pointerSurface.addEventListener('pointermove',move,{passive:true});pointerSurface.addEventListener('pointerleave',leave,{passive:true});
    ['visibilitychange','tracer-visibilitychange'].forEach(event=>document.addEventListener(event,wake));reduced.addEventListener('change',wake);canvas.addEventListener('webglcontextlost',contextLost);
    try {
      gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:!!options.still,powerPreference:'low-power'});
      if(!gl)throw new Error('WebGL unavailable');
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
      for(const name of ['resolution','light','imageSize','rects','widths','radii','kind','tint','scene'])locations[name]=gl.getUniformLocation(program,name==='rects'?'rects[0]':name);
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.uniform1i(locations.scene,0);gl.uniform1f(locations.kind,style[0]);gl.uniform3fv(locations.tint,style.slice(1));
      draw();
    } catch (error) { lost=true;canvas.dataset.materialRenderer='fallback';canvas.dataset.materialError=error.message; }
    const ready=options.imageURL?loadImage(options.imageURL).then(im=>{if(!destroyed&&im){source=im;pendingUpload=true;dirty=true;draw();}return !!im;}):Promise.resolve(true);
    if(!options.still)schedule();
    return {canvas,ready,destroy,refresh:wake,pause(value){paused=!!value;wake();},stats:()=>({draws,uploads,destroyed,lost}),snapshot(){return canvas.toDataURL();}};
  }
  function preview(host, material, live = false, imageURL = previewURL) {
    host.dataset.wallpaperMaterial=material;
    const sample=document.createElement('div');sample.className='wallpaper-material-sample material-preview-stage';sample.setAttribute('aria-hidden','true');
    const en=window.TracerLocale?.language()==='en';
    sample.innerHTML='<div class="material-preview-window"><div class="material-preview-top"><span class="material-preview-mark">✦</span><strong>Tracer</strong><span class="material-preview-dots"><i></i><i></i><i></i></span></div><div class="material-preview-body"><div class="material-preview-rail"><span>⌂</span><span class="is-current">▤</span><span>◷</span></div><div class="material-preview-main"><div class="material-preview-heading"><small>'+(en?'A LITTLE EVERY DAY':'让每一天，轻盈一点')+'</small><strong>'+(en?'Today’s plans':'今天的计划')+'</strong></div><div class="material-preview-task"><i class="is-done">✓</i><span>'+(en?'Make room for a new idea':'为新灵感留一点空间')+'</span></div><div class="material-preview-task"><i></i><span>'+(en?'Finish one lovely thing':'完成一件喜欢的小事')+'</span><b></b></div><div class="material-preview-progress"><span></span></div></div></div></div><div class="material-preview-palette"><i></i><i></i><i></i><i></i></div>';
    host.append(sample);
    const rects=()=>{const h=host.getBoundingClientRect(),b=sample.querySelector('.material-preview-window').getBoundingClientRect();return [{x:b.x-h.x,y:b.y-h.y,w:b.width,h:b.height,width:1.5,radius:8}];};
    if(live){const renderer=mount(host,{material,preview:true,edge:1,imageURL,rects});return Object.assign(()=>renderer.destroy(),{pause:v=>renderer.pause(v)});}
    let cancelled=false;
    loadImage(imageURL).then(image=>{if(cancelled||!host.isConnected)return;const renderer=mount(host,{material,preview:true,edge:1,still:true,image,rects});if(!renderer.stats().lost){const im=new Image();im.className='wallpaper-optics material-poster';im.alt='';im.src=renderer.snapshot();host.append(im);}renderer.destroy();});
    return()=>{cancelled=true;};
  }
  window.TracerMaterialOptics={mount,preview,loadImage,version:2};
})();
