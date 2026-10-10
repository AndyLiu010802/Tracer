(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingPondSkins=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const catalog=[{"id":"konoha","name":["木叶庭院","Leaf village"],"price":1800,"base":"#627b47","accent":"#d5ad65","bank":"/fishing-art/pond-skin-konoha-bank-v1.png","preview":"/fishing-art/pond-skin-konoha-preview-v1.png","box":"/fishing-art/pond-skin-konoha-box-v1.png"},{"id":"akatsuki","name":["晓之雨庭","Crimson rain"],"price":2400,"base":"#292a39","accent":"#df5c53","bank":"/fishing-art/pond-skin-akatsuki-bank-v1.png","preview":"/fishing-art/pond-skin-akatsuki-preview-v1.png","box":"/fishing-art/pond-skin-akatsuki-box-v1.png"},{"id":"sunny","name":["千阳甲板","Sunny deck"],"price":2200,"base":"#a5763c","accent":"#ffc862","bank":"/fishing-art/pond-skin-sunny-bank-v1.png","preview":"/fishing-art/pond-skin-sunny-preview-v1.png","box":"/fishing-art/pond-skin-sunny-box-v1.png"},{"id":"wano","name":["和之国庭","Wano garden"],"price":2600,"base":"#6b405e","accent":"#ed9da7","bank":"/fishing-art/pond-skin-wano-bank-v1.png","preview":"/fishing-art/pond-skin-wano-preview-v1.png","box":"/fishing-art/pond-skin-wano-box-v1.png"},{"id":"valorant","name":["源晶基地","Radianite site"],"price":3000,"base":"#394957","accent":"#64e4dd","bank":"/fishing-art/pond-skin-valorant-bank-v1.png","preview":"/fishing-art/pond-skin-valorant-preview-v1.png","box":"/fishing-art/pond-skin-valorant-box-v1.png"},{"id":"dragon","name":["琉璃龙宫","Dragon palace"],"price":2800,"base":"#247d81","accent":"#eedba0","bank":"/fishing-art/pond-skin-dragon-bank-v1.png","preview":"/fishing-art/pond-skin-dragon-preview-v1.png","box":"/fishing-art/pond-skin-dragon-box-v1.png"},{"id":"redcliff","name":["赤壁水寨","Red Cliffs"],"price":2400,"base":"#675849","accent":"#d0aa65","bank":"/fishing-art/pond-skin-redcliff-bank-v1.png","preview":"/fishing-art/pond-skin-redcliff-preview-v1.png","box":"/fishing-art/pond-skin-redcliff-box-v1.png"},{"id":"clockwork","name":["黄铜船坞","Brass dock"],"price":2000,"base":"#675543","accent":"#6dc5ae","bank":"/fishing-art/pond-skin-clockwork-bank-v1.png","preview":"/fishing-art/pond-skin-clockwork-preview-v1.png","box":"/fishing-art/pond-skin-clockwork-box-v1.png"},{"id":"astral","name":["星轨之环","Astral ring"],"price":2800,"base":"#3d426c","accent":"#c3b5fa","bank":"/fishing-art/pond-skin-astral-bank-v1.png","preview":"/fishing-art/pond-skin-astral-preview-v1.png","box":"/fishing-art/pond-skin-astral-box-v1.png"},{"id":"onsen","name":["霜雪汤庭","Snow onsen"],"price":1800,"base":"#889a98","accent":"#e8d6b1","bank":"/fishing-art/pond-skin-onsen-bank-v1.png","preview":"/fishing-art/pond-skin-onsen-preview-v1.png","box":"/fishing-art/pond-skin-onsen-box-v1.png"}];
  const get=id=>catalog.find(s=>s.id===id)||null;
  function applyBox(host,id){if(!host)return;const skin=get(id);if(host.dataset.pondSkin===(skin?.id||''))return;host.dataset.pondSkin=skin?.id||'';for(const [key,value]of Object.entries({'--pond-skin-base':skin?.base,'--pond-skin-accent':skin?.accent,'--pond-skin-bank':skin?'url("'+skin.bank+'")':null,'--pond-skin-box':skin?'url("'+skin.box+'")':null}))if(value)host.style.setProperty(key,value);else host.style.removeProperty(key);}
  // These are volume models, lit by the pond renderer and included in its shadow
  // pass. The generated bank atlas is only the paving, never the architecture.
  function scenery(ctx,skin){
    const {draw,model,tilt,multiply,segment,tube,shore,ground,time=0}=ctx;
    const base=skin.base,trim=skin.accent,id=skin.id;
    const rear=shore(-Math.PI/2)+.22,front=shore(Math.PI/2)+.22;
    const object=(mesh,x,y,z,sx,sy,sz,tone,material=7,angle=0,rx=0,rz=0,alpha=1)=>draw(mesh,multiply(model(x,y,z,sx,sy,sz,angle),tilt(rx,rz)),tone,alpha,0,null,material);
    const bar=(a,b,r,tone=trim,material=10)=>draw('cylinder',segment(a,b,r),tone,1,0,null,material);
    const box=(x,y,z,sx,sy,sz,tone=base,material=7,angle=0)=>object('rounded',x,y,z,sx,sy,sz,tone,material,angle);
    const orb=(x,y,z,s,tone=trim,material=11)=>object('sphere',x,y,z,s,s,s,tone,material);
    const wire=(key,points,r,tone=trim,material=10)=>tube('skin-'+id+'-'+key,points,r,tone,model(0,0,0,1,1,1),material);
    const ring=(key,x,y,z,r,tone,axis='xy',radius=.018,angle=0)=>wire(key,Array.from({length:41},(_,i)=>{const a=i*Math.PI/20,u=Math.cos(a)*r,v=Math.sin(a)*r;return axis==='xz'?[x+u,y,z+v]:axis==='tilt'?[x+u,y+v*.75,z+v*.65]:[x+u*Math.cos(angle),y+v,z+u*Math.sin(angle)];}),radius,tone);
    const plinth=(x,z,w,d)=>{const y=ground(x,z);box(x,y+.055,z,w,.055,d,base);box(x,y+.12,z,w*.96,.022,d*.96,trim,10);return y+.14;};
    const roof=(key,x,y,z,w,d,tone,snow=false)=>{
      // Individual curved ceramic ridges, pronounced upturned eaves and a
      // closed underside make the roof readable from all viewing angles.
      box(x,y-.055,z,w*1.04,.055,d*1.07,tone,7);
      for(let i=0;i<13;i++){
        const px=x-w+i*w/6,points=[];
        for(let j=0;j<9;j++){const v=-1+j/4,py=.17*(1-Math.abs(v))+.038*Math.pow(Math.abs(v),8);points.push([px,y+py,z+v*d]);}
        wire(key+'tile'+i,points,w/13.2,i%3?tone:trim,7);
      }
      bar([x-w*1.13,y+.19,z],[x+w*1.13,y+.19,z],.037,trim,10);
      for(const side of[-1,1]){orb(x+side*w*1.13,y+.23,z,.035,trim,10);if(snow)object('organic',x+side*w*.48,y+.17,z,w*.60,.065,d*.88,'#edf5ee',24);}
    };
    const house=(key,x,z,w,d,h,wall,roofTone,tiers=1,open=false,snow=false)=>{
      const y=plinth(x,z,w+.1,d+.1);
      for(let level=0;level<tiers;level++){
        const scale=1-level*.25,ww=w*scale,dd=d*scale,yy=y+level*h*.84;
        if(!open||level)box(x,yy+h*.35,z,ww*.94,h*.34,dd*.94,wall,7);
        for(const a of[-1,1])for(const b of[-1,1]){bar([x+a*ww,yy,z+b*dd],[x+a*ww,yy+h*.78,z+b*dd],.029,trim,5);box(x+a*ww,yy+.05,z+b*dd,.062,.046,.062,base);}
        // Three recessed glazed windows with actual protruding mullions.
        if(!open||level)for(let k=-1;k<=1;k++){
          const xx=x+k*ww*.53;box(xx,yy+h*.40,z+dd*.957,ww*.19,h*.18,.012,'#233e43',23);
          bar([xx,yy+h*.20,z+dd],[xx,yy+h*.59,z+dd],.010,trim,5);
          bar([xx-ww*.19,yy+h*.40,z+dd],[xx+ww*.19,yy+h*.40,z+dd],.009,trim,5);
        }
        roof(key+level,x,yy+h*.78,z,ww*1.2,dd*1.24,roofTone,snow);
      }
      for(let i=0;i<3;i++)box(x,y-.03-i*.042,z+d+.14+i*.085,w*.40,.026,.10,base);
      return y+h*.78+(tiers-1)*h*.84;
    };
    const lantern=(key,x,z,tone=trim)=>{const y=ground(x,z);box(x,y+.035,z,.075,.035,.075,base);bar([x,y+.05,z],[x,y+.42,z],.022,base,10);box(x,y+.38,z,.075,.085,.072,tone,11);for(const side of[-1,1])bar([x+side*.077,y+.29,z+.072],[x+side*.077,y+.48,z+.072],.010,trim);box(x,y+.50,z,.11,.024,.11,base);orb(x,y+.55,z,.021,trim);};
    const sakura=(key,x,z,tone)=>{const y=ground(x,z);wire(key+'trunk',[[x,y,z],[x-.035,y+.30,z],[x+.04,y+.66,z+.025],[x-.02,y+.85,z]],.055,'#665243',5);for(let k=0;k<5;k++){const a=k*2.4,px=x+Math.cos(a)*.20,pz=z+Math.sin(a)*.18,py=y+.66+(k%3)*.10;bar([x+.015,y+.43,z],[px,py,pz],.018,'#76624b',5);object('foliage',px,py,pz,.25,.15,.24,k%2?tone:trim,6,a);}};
    if(id==='konoha'){
      const y=house('leaf-house',-.34,-rear,.55,.34,.65,'#d8c39c','#9e4636');
      box(-.34,y+.37,-rear,.23,.12,.20,'#cc6143');roof('watch-roof',-.34,y+.49,-rear,.33,.29,'#863f32');
      const z=-rear+.38;box(-.34,y-.12,z,.16,.08,.02,'#747d76',10);ring('leaf-insignia',-.34,y-.12,z+.026,.047,'#d8cb98','xy',.009);
      for(const side of[-1,1]){const x=.89+side*.21,gy=ground(x,-rear+.23);bar([x,gy,-rear+.23],[x,gy+.55,-rear+.23],.04,'#995139',5);}
      bar([.53,y-.1,-rear+.23],[1.25,y-.1,-rear+.23],.035,'#995139',5);
      lantern('leaf-light',-1.48,-rear+.42);sakura('maple',1.35,-rear+.28,'#a8a75b');
    }else if(id==='akatsuki'){
      for(let k=0;k<3;k++){
        const x=-.65+k*.61,z=-rear+(k===1?-.1:.15),h=k===1?1.34:.91,y=plinth(x,z,.24,.25);
        box(x,y+h*.5,z,.19,h*.5,.2,'#333747',10);box(x,y+h,z,.27,.04,.26,'#171f2c',10);
        for(let j=0;j<4;j++)box(x,y+.18+j*h*.19,z+.209,.12,.018,.012,j%2?'#434e60':'#793b49',10);
        wire('tower-pipe'+k,[[x+.23,y,z],[x+.23,y+h*.65,z],[x+.12,y+h*.65,z],[x+.12,y+h+.11,z]],.027,'#738791',10);
        for(const side of[-1,1])bar([x+side*.18,y+h,z],[x+side*.18,y+h+.19,z],.012,'#bcc7ce');
      }
      const x=-.04,z=-rear+.22,y=ground(x,z)+.67;
      // Black hanging banner with a sculpted red cloud medallion.
      box(x,y,z,.13,.20,.016,'#171b26',5);for(const [dx,dy,sz]of[[-.07,0,.038],[0,.036,.051],[.066,.0,.04],[.014,-.025,.054]]){object('sphere',x+dx,y+dy,z+.030,sz,sz*.72,.017,'#ed625e',7);}
      lantern('rain-light',1.36,-rear+.4,'#cb7974');
    }else if(id==='sunny'){
      const z=-rear+.15,y=plinth(0,z,.77,.31);
      object('organic',0,y+.18,z,.89,.27,.41,'#a26732',5);box(0,y+.28,z,.72,.035,.31,'#e7bd7d',5);
      for(let i=-4;i<=4;i++)bar([i*.15,y+.27,z+.30],[i*.15,y+.50,z+.30],.018,'#f0e1c4');
      bar([-.66,y+.5,z+.30],[.66,y+.5,z+.30],.022,'#f1d8a2');
      box(-.37,y+.46,z,.23,.16,.23,'#d7b072',5);roof('ship-cabin',-.37,y+.64,z,.29,.28,'#bf5847');
      bar([.20,y+.30,z],[.20,y+1.47,z],.029,'#8c592e',5);bar([-.18,y+1.29,z],[.64,y+1.29,z],.024,'#8c592e',5);
      object('leaf',.20,y+.87,z,.37,.48,.06,'#fbefd1',5,0,0,Math.PI/2);
      // Lion prow: a full muzzle and radial mane, rather than a decal.
      for(let i=0;i<10;i++){const a=i*Math.PI/5;object('leaf',.77+Math.cos(a)*.17,y+.39+Math.sin(a)*.17,z+.08,.059,.11,.034,'#f0bc4d',10,0,0,a);}
      object('sphere',.77,y+.39,z+.10,.15,.15,.07,'#efd58b',7);orb(.72,y+.43,z+.17,.013,'#26362e');orb(.82,y+.43,z+.17,.013,'#26362e');orb(.77,y+.36,z+.18,.025,'#985431');
      ring('lifebuoy',-.48,y+.40,z+.33,.082,'#f0e8d9','xy',.022);sakura('tangerine',-1.38,-rear+.28,'#70a256');for(let k=0;k<5;k++)orb(-1.38+Math.cos(k*2.4)*.18,ground(-1.38,-rear)+.67+(k%2)*.12,-rear+.38+Math.sin(k*2.4)*.13,.037,'#efaa37',7);
    }else if(id==='wano'){
      house('wano-pagoda',-.40,-rear,.48,.31,.53,'#d6b4aa','#4a354f',2);sakura('sakura',.99,-rear+.22,'#dd8fa7');
      // A curved bridge on the bank with two arched rails and individual steps.
      const z=front,y=ground(0,z);for(let k=0;k<9;k++){const x=-.46+k*.115,py=y+.035+Math.sin(k/8*Math.PI)*.11;box(x,py,z,.058,.027,.17,'#a3484d',5);if(k%2===0)for(const side of[-1,1])bar([x,py,z+side*.17],[x,py+.16,z+side*.17],.018,'#e5ac7d',5);}
      for(const side of[-1,1])wire('bridge'+side,Array.from({length:19},(_,k)=>[-.46+k*.92/18,y+.20+Math.sin(k/18*Math.PI)*.11,z+side*.17]),.020,'#d19a71',5);
    }else if(id==='valorant'){
      const z=-rear,y=plinth(0,z,.74,.37);
      for(const side of[-1,1]){box(side*.56,y+.44,z,.17,.44,.25,'#384754',10);box(side*.56,y+.92,z,.24,.048,.29,'#d7e2df',10);box(side*.56,y+.47,z+.253,.027,.28,.015,'#53d6d2',11);for(let k=0;k<3;k++)box(side*.56,y+.15+k*.10,z+.273,.095,.014,.013,'#182f3b',10);}
      box(0,y+.045,z,.30,.045,.28,'#a7b9ba',10);object('crystal',0,y+.45,z,.21,.43,.21,'#68e6df',23,Math.PI/4);box(0,y+.95,z,.34,.05,.29,'#233642',10);
      for(const side of[-1,1])bar([side*.28,y+.12,z],[side*.18,y+.88,z],.031,'#6d9199');
      for(const side of[-1,1]){const x=side*1.25,zz=-rear+.30,yy=ground(x,zz);box(x,yy+.15,zz,.22,.15,.20,'#344653',10);box(x,yy+.27,zz,.17,.016,.14,'#63dad8',11);for(let j=-1;j<=1;j++)box(x+j*.09,yy+.16,zz+.204,.014,.065,.015,'#d3bd66',10);}
    }else if(id==='dragon'){
      const y=house('dragon-hall',0,-rear,.51,.35,.54,'#b9ddd1','#437e7a',2);
      for(const side of[-1,1]){const x=side*.91,z=-rear+.13,yy=ground(x,z);bar([x,yy,z],[x,yy+.68,z],.065,'#98c8b4',23);wire('dragon-coil'+side,Array.from({length:45},(_,k)=>{const a=k*.25;return[x+Math.cos(a)*.095,yy+.1+k*.012,z+Math.sin(a)*.095];}),.018,'#dfc181');orb(x,yy+.75,z,.09,'#dfeada',23);}
      object('crescent',0,y+.29,-rear,.19,.24,.055,'#e4c477',10);lantern('jade-light',1.48,-rear+.56,'#c7e7ce');
    }else if(id==='redcliff'){
      for(const side of[-1,1]){const x=side*.51,z=-rear,y=plinth(x,z,.25,.28);box(x,y+.30,z,.23,.30,.26,'#6f7770');house('watch'+side,x,z,.26,.26,.56,'#71584a','#364d48');for(let k=-1;k<=1;k++)box(x+k*.17,y+.65,z+.26,.058,.073,.04,'#a4a08a');}
      const z=-rear,y=ground(0,z);bar([-.33,y+.65,z],[.33,y+.65,z],.042,'#9c8052');
      for(const side of[-1,1]){const x=side*.89;bar([x,y,z],[x,y+1.17,z],.019,'#9a7742');object('leaf',x+side*.14,y+.92,z,.24,.23,.013,'#9f3338',5,0,0,-Math.PI/2);orb(x,y+1.20,z,.034,'#d0b070',10);}
      for(let k=0;k<8;k++){const a=.4+k*.21,r=shore(a)+.15,x=Math.cos(a)*r,z=Math.sin(a)*r/1.035,y=ground(x,z);bar([x,y,z],[x,y+.14,z],.025,'#5c645e');if(k<7){const b=a+.21,xx=Math.cos(b)*(shore(b)+.15),zz=Math.sin(b)*(shore(b)+.15)/1.035;bar([x,y+.13,z],[xx,ground(xx,zz)+.13,zz],.014,'#aea380');}}
    }else if(id==='clockwork'){
      const y=house('engine-house',-.40,-rear,.40,.29,.66,'#946f51','#4e716a');
      const x=.44,z=-rear+.1,cy=ground(x,z)+.40;ring('wheel-out',x,cy,z,.36,'#c19b58','xy',.029);ring('wheel-inner',x,cy,z,.23,'#779b8f','xy',.019);
      for(let k=0;k<12;k++){const a=k*Math.PI/6+time*.12,px=x+Math.cos(a)*.34,py=cy+Math.sin(a)*.34;bar([x,cy,z],[px,py,z],.019,'#ba914d');object('rounded',px,py,z,.067,.043,.062,'#c1a268',10,0,0,a);}
      object('sphere',x,cy,z+.06,.073,.073,.038,'#9bd4c7',23);
      wire('copper-pipe',[[-.70,y-.2,-rear],[-.70,y+.49,-rear],[-.55,y+.57,-rear],[-.40,y+.57,-rear]],.058,'#bd8054');box(-.40,y+.6,-rear,.091,.045,.085,'#d8b779',10);
      lantern('dock-light',1.31,-rear+.44,'#dcc786');
    }else if(id==='astral'){
      const z=-rear,y=plinth(0,z,.61,.39);
      object('cylinder',0,y+.20,z,.36,.20,.36,'#62678f',7);object('sphere',0,y+.40,z,.40,.30,.40,'#373e67',10);ring('dome-base',0,y+.38,z,.405,'#c9baa0','xz',.021);
      for(let k=0;k<5;k++){const a=k*Math.PI*2/5;bar([Math.cos(a)*.30,y+.16,z+Math.sin(a)*.30],[Math.cos(a)*.31,y+.37,z+Math.sin(a)*.31],.016,'#b4adbb');}
      bar([0,y+.62,z],[.43,y+1.02,z+.09],.065,'#a6adc2');bar([.41,y+1.00,z+.086],[.51,y+1.09,z+.108],.093,'#d4c39c');orb(.52,y+1.1,z+.11,.057,'#94c5e4',23);
      const x=-.99,zz=-rear+.20,yy=ground(x,zz)+.48;ring('astrolabe-a',x,yy,zz,.31,'#d2c29c','xy',.014);ring('astrolabe-b',x,yy,zz,.31,'#9aa7d7','tilt',.014);orb(x,yy,zz,.089,'#d0bbf1',23);bar([x,yy-.32,zz],[x,ground(x,zz),zz],.028,'#b4a27c');
      lantern('star-light',1.15,-rear+.36,'#c7bcf1');
    }else if(id==='onsen'){
      house('snow-pavilion',-.10,-rear,.57,.36,.74,'#cbbd99','#697879',1,true,true);
      for(let k=-2;k<=2;k++)bar([k*.20,ground(0,-rear)+.15,-rear-.3],[k*.20,ground(0,-rear)+.68,-rear-.3],.02,'#bea77b',5);
      const x=1.15,z=-rear+.3,y=ground(x,z);object('organic',x,y+.09,z,.32,.13,.29,'#6f8182');object('organic',x,y+.19,z,.31,.04,.28,'#edf1e8',24);sakura('winter-plum',-1.28,-rear+.24,'#eee1da');
      lantern('warm-light',.87,front-.3,'#e9cb8b');
      for(let k=0;k<3;k++){const phase=(time*.10+k/3)%1;object('organic',x+Math.sin(k*2.4+phase)*.08,y+.22+phase*.39,z,.08+phase*.10,.025,.06+phase*.06,'#d5e7df',24,0,0,0,(1-phase)*.13);}
    }
  }
  const sceneCache=new Map();
  async function loadScene(id){
    if(!get(id))throw new Error('Unknown pond skin');
    if(sceneCache.has(id)){const entry=sceneCache.get(id);sceneCache.delete(id);sceneCache.set(id,entry);return entry;}
    const request=(async()=>{
      const response=await fetch('/fishing-art/pond-skin-'+id+'-scene-v1.json');if(!response.ok)throw new Error('Pond model unavailable');const manifest=await response.json();
      if(manifest.version!==1||manifest.id!==id||!Array.isArray(manifest.parts)||manifest.parts.length>80)throw new Error('Invalid pond model');
      const binary=await fetch('/fishing-art/pond-skin-'+id+'-scene-v1.bin');if(!binary.ok)throw new Error('Pond mesh unavailable');const data=await binary.arrayBuffer();
      return {id,triangles:manifest.triangles,parts:manifest.parts.map(part=>{if(!['back','left','right','front'].includes(part.anchor)||!Number.isInteger(part.offset)||!Number.isInteger(part.count)||part.count<3||part.count>600000||part.offset<0||part.offset+part.count*24>data.byteLength||!/^#[a-f0-9]{6}$/i.test(part.color))throw new Error('Invalid pond mesh part');return {...part,geometry:{p:new Float32Array(data,part.offset,part.count*3),n:new Float32Array(data,part.offset+part.count*12,part.count*3)}};})};
    })();sceneCache.set(id,request);while(sceneCache.size>2)sceneCache.delete(sceneCache.keys().next().value);
    try{return await request;}catch(error){if(sceneCache.get(id)===request)sceneCache.delete(id);throw error;}
  }
  return{catalog,get,applyBox,scenery,loadScene};
});
