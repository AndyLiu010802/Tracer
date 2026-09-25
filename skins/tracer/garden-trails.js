(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenTrails=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const key='tracer.garden.trails.v2';
  const catalog=[
    {id:'wildflower',name:['月露花径','Moonlit meadow'],description:['奶白小花、鼠尾草叶与露珠，沿着鼠标轻轻散落。','Ivory blooms, sage leaves and dewdrops drifting through your path.'],colors:['#fff5d6','#b3d9bd','#d1bafa'],life:1150,spacing:13,fall:24,sway:16},
    {id:'sunflower',name:['日冕金穗','Sunlit corona'],description:['金色花盘舒展开细长花瓣，暖亮花粉向外散开。','Golden flower heads, long sun petals and a spray of warm pollen.'],colors:['#ffe399','#f6b844','#fff7d5'],life:1000,spacing:14,fall:8,sway:12},
    {id:'lavender',name:['薰风星穗','Lavender reverie'],description:['紫色花穗随柔风旋转，细银光线与香雾缓缓上浮。','Violet sprigs turn in a soft breeze with silver threads and rising mist.'],colors:['#d6bbff','#9e8be2','#edf0ff'],life:1350,spacing:16,fall:-30,sway:20,ribbon:'mist'},
    {id:'apple',name:['青苹果汽露','Apple dew'],description:['青苹果切片与嫩叶翻转，透明露泡带着高光向上飘。','Apple slices and fresh leaves tumble among luminous rising dew bubbles.'],colors:['#c4ee9e','#f8ffd4','#75c5a2'],life:1150,spacing:15,fall:-38,sway:14},
    {id:'peach',name:['桃霞流绢','Peach silk'],description:['蜜桃色薄绢顺着手势舒展，心形花瓣与金粉慢慢落下。','Peach silk follows your gesture, shedding heart-shaped petals and gold dust.'],colors:['#ffc6b6','#ee8caf','#ffe8be'],life:1200,spacing:17,fall:30,sway:20,ribbon:'silk'},
    {id:'cherry',name:['樱吹雪','Sakura flurry'],description:['带缺口的樱花瓣翻飞，偶尔绽开一朵完整的樱花。','Notched sakura petals flutter and turn around occasional full blossoms.'],colors:['#ffe5f1','#f3a6cc','#fff9f4'],life:1300,spacing:12,fall:42,sway:26},
    {id:'neon_orchid',name:['霓虹蝶兰','Holographic orchid'],description:['柔光蝶兰与青蓝花瓣轻盈交织，沿弧线留下渐隐的全息光带。','Soft orchids and translucent cyan petals drift along gently fading holographic curves.'],colors:['#f5a6ff','#5be6f3','#c6b4ff'],life:1000,spacing:18,fall:-9,sway:9,ribbon:'neon'},
    {id:'volt_berry',name:['莓电回路','Berry circuit'],description:['电光莓凝成发光节点，细碎电弧与充能光环沿轨迹传播。','Glowing berry nodes connect through fine electric arcs and charging rings.'],colors:['#7df5ee','#81b5ff','#ffec9c'],life:820,spacing:17,fall:4,sway:8,ribbon:'electric'},
    {id:'crystal_tree',name:['极光晶棱','Aurora crystal'],description:['透明晶棱折出薄荷绿与冰蓝光，碎晶和极光丝带缓缓悬浮。','Faceted crystals split mint and ice-blue light above a floating aurora thread.'],colors:['#acf8df','#a9d7ff','#e6c8ff'],life:1250,spacing:17,fall:-24,sway:12,ribbon:'aurora'}
  ];
  const profiles=new Map(catalog.map(item=>[item.id,item]));
  const profile=id=>profiles.get(id)||null;
  function kindForPet(pet){const id=typeof pet==='string'?pet:pet?.id;const match=/^garden_(.+)_shiny$/.exec(id||'');return match&&profiles.has(match[1])?match[1]:null;}
  function preferences(raw,legacy){
    let saved;try{saved=JSON.parse(raw);}catch{}
    const valid=saved?.version===2&&saved.enabled&&typeof saved.enabled==='object';
    const enabled={};for(const item of catalog){const id='garden_'+item.id+'_shiny';enabled[id]=valid?saved.enabled[id]===true:legacy==='true';}
    return {version:2,enabled};
  }
  const rgba=(hex,alpha)=>'rgba('+parseInt(hex.slice(1,3),16)+','+parseInt(hex.slice(3,5),16)+','+parseInt(hex.slice(5,7),16)+','+alpha+')';
  const random=n=>{let v=(n*2654435761)>>>0;v^=v>>>13;v=Math.imul(v,1274126177);return (v>>>0)/4294967296;};
  const TAU=Math.PI*2;
  function star(c,r){c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,s=i%2?r*.19:r;i?c.lineTo(Math.cos(a)*s,Math.sin(a)*s):c.moveTo(0,-s);}c.closePath();c.fill();}
  function petal(c,r,notch=false){
    c.beginPath();c.moveTo(0,r*.72);c.bezierCurveTo(-r,-r*.1,-r*.55,-r*.94,-r*.12,-r*.82);
    if(notch){c.lineTo(0,-r*.56);c.lineTo(r*.14,-r*.83);}
    c.bezierCurveTo(r*.65,-r*.99,r*.98,-r*.06,0,r*.72);c.fill();
  }
  function leaf(c,r){c.beginPath();c.moveTo(-r,r*.3);c.quadraticCurveTo(-r*.3,-r,r,-r*.3);c.quadraticCurveTo(r*.3,r,-r,r*.3);c.fill();c.strokeStyle='#f3ffe4aa';c.lineWidth=.6;c.beginPath();c.moveTo(-r*.75,r*.25);c.lineTo(r*.75,-r*.25);c.stroke();}
  function blossom(c,r,petals,color,center,notch=false){
    c.fillStyle=color;for(let i=0;i<petals;i++){c.save();c.rotate(i*TAU/petals);c.translate(0,-r*.39);petal(c,r*.59,notch);c.restore();}
    c.fillStyle=center;c.beginPath();c.arc(0,0,r*.22,0,TAU);c.fill();
    c.fillStyle='#fffbed';for(let i=0;i<5;i++){const a=i*TAU/5;c.beginPath();c.arc(Math.cos(a)*r*.17,Math.sin(a)*r*.17,.55,0,TAU);c.fill();}
  }
  function glyph(doc,p,type){
    const canvas=doc.createElement('canvas');canvas.width=canvas.height=112;const c=canvas.getContext('2d');
    c.translate(56,56);c.scale(2,2);const colors=p.colors;
    // Cache soft light once per glyph, rather than blurring every desktop frame.
    const halo=c.createRadialGradient(0,0,1,0,0,25);halo.addColorStop(0,rgba(colors[0],.19));halo.addColorStop(.42,rgba(colors[1],.09));halo.addColorStop(1,rgba(colors[1],0));c.fillStyle=halo;c.fillRect(-27,-27,54,54);
    c.lineCap='round';c.lineJoin='round';c.fillStyle=colors[type%3];c.strokeStyle=colors[0];c.lineWidth=1;
    if(type===3){if(p.id==='neon_orchid'){c.fillStyle='#fff2ffcc';c.beginPath();c.arc(0,0,1.8,0,TAU);c.fill();}else star(c,4.5);return canvas;}
    const r=12;
    switch(p.id){
      case 'wildflower':
        if(type===0)blossom(c,r,5,colors[0],'#e6be78');
        else if(type===1){c.fillStyle=colors[1];leaf(c,r*.82);}
        else{c.fillStyle='#defff3';c.beginPath();c.ellipse(0,0,3.5,6,0,0,TAU);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(-1,-2,1.2,0,TAU);c.fill();}break;
      case 'sunflower':
        if(type===0){for(let i=0;i<12;i++){c.save();c.rotate(i*TAU/12);c.fillStyle=i%2?colors[0]:colors[1];c.beginPath();c.ellipse(0,-8,2.4,5.8,0,0,TAU);c.fill();c.restore();}c.fillStyle='#b47a35';c.beginPath();c.arc(0,0,5,0,TAU);c.fill();c.fillStyle='#ffe8ae';for(let i=0;i<9;i++){const a=i*2.4,d=Math.sqrt(i)*1.1;c.beginPath();c.arc(Math.cos(a)*d,Math.sin(a)*d,.7,0,TAU);c.fill();}}
        else if(type===1){c.beginPath();c.ellipse(0,0,3,12,.3,0,TAU);c.fill();}
        else{c.lineWidth=1.3;for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);c.beginPath();c.moveTo(0,-3);c.lineTo(0,-8);c.stroke();c.restore();}}break;
      case 'lavender':
        if(type===0){c.strokeStyle='#c0dbd1';c.lineWidth=1.1;c.beginPath();c.moveTo(0,13);c.quadraticCurveTo(-1,0,2,-13);c.stroke();for(let i=0;i<7;i++){const y=8-i*3.2;c.fillStyle=colors[i%2];c.beginPath();c.ellipse((i%2?1:-1)*3,y,3.4,2.1,i%2?-.6:.6,0,TAU);c.fill();}c.fillStyle=colors[2];c.beginPath();c.ellipse(1.8,-13,2,3,0,0,TAU);c.fill();}
        else if(type===1)blossom(c,7,4,colors[0],colors[2]);else{c.strokeStyle=colors[2];c.beginPath();c.ellipse(0,0,5,10,.6,0,TAU);c.stroke();}break;
      case 'apple':
        if(type===0){c.fillStyle='#8bd492';c.beginPath();c.arc(0,0,12,.1,Math.PI-.1);c.closePath();c.fill();c.fillStyle='#f2ffd5';c.beginPath();c.arc(0,-.6,9.5,.1,Math.PI-.1);c.closePath();c.fill();c.fillStyle='#a88961';c.beginPath();c.ellipse(0,4,1.1,2.3,0,0,TAU);c.fill();}
        else if(type===1){c.fillStyle=colors[0];leaf(c,9);}
        else{const fill=c.createRadialGradient(-4,-4,0,0,0,10);fill.addColorStop(0,'#ecfff84a');fill.addColorStop(.68,'#b7f7cd0c');fill.addColorStop(1,'#adf8dca8');c.fillStyle=fill;c.beginPath();c.arc(0,0,10,0,TAU);c.fill();c.strokeStyle='#e4fff9bb';c.stroke();c.lineWidth=1.8;c.beginPath();c.arc(0,0,7.4,3.7,4.7);c.stroke();}break;
      case 'peach':
        if(type===0){const g=c.createLinearGradient(-8,-10,8,12);g.addColorStop(0,colors[2]);g.addColorStop(.4,colors[0]);g.addColorStop(1,colors[1]);c.fillStyle=g;c.beginPath();c.moveTo(0,12);c.bezierCurveTo(-20,-1,-9,-16,0,-7);c.bezierCurveTo(9,-16,20,-1,0,12);c.fill();c.strokeStyle='#fff1d899';c.beginPath();c.moveTo(0,-5);c.quadraticCurveTo(-3,3,0,9);c.stroke();}
        else if(type===1){petal(c,10);c.strokeStyle='#ffeac8';c.beginPath();c.moveTo(0,5);c.quadraticCurveTo(2,0,0,-6);c.stroke();}
        else blossom(c,8,5,colors[2],colors[1]);break;
      case 'cherry':
        if(type===0)blossom(c,13,5,colors[0],'#eabd80',true);
        else{const g=c.createLinearGradient(0,-12,0,10);g.addColorStop(0,colors[2]);g.addColorStop(.6,colors[0]);g.addColorStop(1,colors[1]);c.fillStyle=g;petal(c,type===1?11:7,true);c.strokeStyle='#d580b655';c.lineWidth=.65;c.beginPath();c.moveTo(0,7);c.lineTo(0,-5);c.stroke();}break;
      case 'neon_orchid':
        if(type===0){for(let i=0;i<5;i++){c.save();c.rotate(i*TAU/5);const color=colors[i%2],g=c.createLinearGradient(0,3,0,-14);g.addColorStop(0,rgba(colors[2],.12));g.addColorStop(.55,rgba(color,.55));g.addColorStop(1,rgba(color,.22));c.fillStyle=g;c.strokeStyle=rgba(color,.6);c.lineWidth=.6;c.beginPath();c.moveTo(0,3);c.bezierCurveTo(-5,0,-10,-8,-5,-12);c.bezierCurveTo(0,-17,8,-11,6,-5);c.bezierCurveTo(5,-1,2,2,0,3);c.closePath();c.fill();c.stroke();c.restore();}c.fillStyle='#fff2ffd9';c.beginPath();c.ellipse(0,0,2.3,3.1,0,0,TAU);c.fill();}
        else if(type===1){const g=c.createLinearGradient(-3,-8,3,8);g.addColorStop(0,rgba(colors[1],.12));g.addColorStop(.5,rgba(colors[1],.6));g.addColorStop(1,rgba(colors[0],.2));c.fillStyle=g;c.strokeStyle=rgba(colors[1],.45);c.lineWidth=.6;c.beginPath();c.ellipse(0,0,3.4,8.2,.4,0,TAU);c.fill();c.stroke();}
        else{c.fillStyle=rgba(colors[0],.32);c.strokeStyle=rgba(colors[2],.6);c.lineWidth=.6;c.beginPath();c.arc(0,0,3.5,0,TAU);c.fill();c.stroke();c.fillStyle='#fff8ffb3';c.beginPath();c.arc(-.8,-1,1,0,TAU);c.fill();}break;
      case 'volt_berry':
        if(type===0){c.strokeStyle=colors[1];c.beginPath();c.moveTo(-6,4);c.lineTo(0,-6);c.lineTo(7,3);c.stroke();for(const [x,y,color]of [[-6,4,colors[0]],[0,-6,colors[1]],[7,3,colors[0]]]){const g=c.createRadialGradient(x-1,y-2,0,x,y,5);g.addColorStop(0,'#fff');g.addColorStop(.3,color);g.addColorStop(1,rgba(color,.15));c.fillStyle=g;c.beginPath();c.arc(x,y,5,0,TAU);c.fill();}}
        else if(type===1){c.fillStyle=colors[2];c.beginPath();c.moveTo(2,-13);c.lineTo(-8,2);c.lineTo(-1,1);c.lineTo(-3,13);c.lineTo(9,-4);c.lineTo(2,-3);c.closePath();c.fill();}
        else{c.lineWidth=1.2;c.strokeStyle=colors[0];c.beginPath();c.arc(0,0,9,.2,Math.PI*1.2);c.stroke();c.strokeStyle=colors[1];c.beginPath();c.arc(0,0,6,Math.PI,TAU+.3);c.stroke();}break;
      case 'crystal_tree':{
        const h=type===0?16:11,w=type===0?8:6;
        c.fillStyle=rgba(colors[1],.5);c.beginPath();c.moveTo(0,-h);c.lineTo(w,-3);c.lineTo(w*.7,h*.6);c.lineTo(0,h);c.lineTo(-w*.75,h*.55);c.lineTo(-w,-3);c.closePath();c.fill();c.strokeStyle='#e9fffac9';c.lineWidth=.85;c.stroke();
        for(const [color,points]of [[colors[0],[[0,-h],[-w,-3],[0,2]]],[colors[2],[[0,-h],[w,-3],[0,2]]],[colors[1],[[0,2],[w,-3],[0,h]]],[colors[0],[[0,2],[-w*.75,h*.55],[0,h]]]]){c.fillStyle=rgba(color,.75);c.beginPath();c.moveTo(...points[0]);c.lineTo(...points[1]);c.lineTo(...points[2]);c.closePath();c.fill();}
        c.strokeStyle='#fff';c.lineWidth=.8;c.beginPath();c.moveTo(0,-h+2);c.lineTo(0,h-2);c.stroke();if(type===0){c.translate(w,-4);c.fillStyle='#f1fff9';star(c,4);}break;}
    }
    return canvas;
  }
  function create(canvas,options={}){
    const c=canvas.getContext('2d'),doc=canvas.ownerDocument,win=doc.defaultView;
    let theme=profile(options.kind)||catalog[0],sprites=[],particles=[],knots=[],ribbons=[],ribbonDirty=true,last=null,carry=0,travel=0,serial=0,raf=null,previous=null,nextPaint=-Infinity,destroyed=false,width=1,height=1,ratio=1;
    const animate=options.animate!==false;
    const maxDpr=Number.isFinite(options.maxDpr)?Math.max(.5,Math.min(2,options.maxDpr)):2;
    const maxPixels=Number.isFinite(options.maxPixels)?Math.max(1,options.maxPixels):Infinity;
    const now=()=>win.performance.now();
    function reset(){if(raf!==null)win.cancelAnimationFrame(raf);raf=null;c.clearRect(0,0,width,height);particles=[];knots=[];ribbons=[];ribbonDirty=true;last=null;carry=0;travel=0;previous=null;nextPaint=-Infinity;}
    function setKind(kind){const next=profile(kind);if(!next||next===theme&&sprites.length)return;reset();theme=next;sprites=Array.from({length:4},(_,type)=>glyph(doc,theme,type));canvas.dataset.trailKind=kind;}
    function resize(w,h,dpr=1){reset();width=Math.max(1,w);height=Math.max(1,h);ratio=Math.min(maxDpr,Math.max(1,dpr),Math.sqrt(maxPixels/(width*height)));canvas.width=Math.max(1,Math.floor(width*ratio));canvas.height=Math.max(1,Math.floor(height*ratio));c.setTransform(ratio,0,0,ratio,0,0);}
    function schedule(){if(animate&&!destroyed&&raf===null)raf=win.requestAnimationFrame(tick);}
    function point(value,at=now()){
      if(destroyed||!Number.isFinite(value?.x)||!Number.isFinite(value?.y)||!Number.isFinite(at))return;
      if(value.kind)setKind(value.kind);if(value.reset)reset();
      const x=value.x,y=value.y;if(x< -40||y< -40||x>width+40||y>height+40)return;
      if(last&&x===last.x&&y===last.y)return;
      // A new gesture must not connect back across a pause. Older particles
      // finish fading independently instead of disappearing when motion resumes.
      if(last&&at-last.at>180){last=null;carry=0;travel=0;}
      let normal=last?{nx:last.nx,ny:last.ny}:{nx:0,ny:1};
      if(last){const dx=x-last.x,dy=y-last.y,distance=Math.hypot(dx,dy);
        if(distance>700){reset();normal={nx:0,ny:1};}else if(distance>0){
          const nx=-dy/distance,ny=dx/distance,spacing=theme.spacing;
          normal={nx,ny};travel+=distance;
          let step=spacing-carry,emitted=0;
          while(step<=distance&&emitted<28){const t=step/distance,n=++serial,r=random(n),side=random(n+190)-.5;
            const type=n%7===1?0:n%4===0?3:1+n%2;
            particles.push({x:last.x+dx*t+nx*side*9,y:last.y+dy*t+ny*side*9,at:at-Math.min(64,Math.max(0,at-last.at))*(1-t),life:theme.life*(.8+random(n+71)*.35),type,
              size:type===0?(theme.id==='neon_orchid'?22+r*6:25+r*8):type===3?8+r*5:14+r*9,angle:Math.atan2(dy,dx)+r*TAU,spin:(random(n+83)-.5)*(theme.id==='neon_orchid'?1.25:3.2),phase:r*TAU,nx,ny,drift:side*30});
            step+=spacing;emitted++;
          }
          carry=(carry+distance)%spacing;
        }
      }
      knots.push({x,y,at,travel,...normal,start:!last});ribbonDirty=true;
      last={x,y,at,...normal};if(particles.length>120)particles.splice(0,particles.length-120);if(knots.length>32)knots.splice(0,knots.length-32);schedule();
    }
    function rebuildRibbons(){
      ribbons=[];ribbonDirty=false;if(!theme.ribbon||knots.length<2)return;
      const groups=[];for(const p of knots){if(p.start||!groups.length)groups.push([]);groups.at(-1).push(p);}
      for(const rows of groups){if(rows.length<2)continue;
      for(let layer=0;layer<2;layer++){
        // Distance-based phase stays fixed when old knots expire. Midpoint
        // curves stay inside the control hull, including at sharp mouse turns.
        const points=rows.map(p=>{const shift=theme.ribbon==='electric'?(Math.floor(p.travel/17)%2?1:-1)*4:Math.sin(p.travel*.025+layer*2.5)*1.5;
          const offset=shift+(layer?1.8:-1.8);return{x:p.x+p.nx*offset,y:p.y+p.ny*offset};});
        // Geometry and gradient only change when samples arrive or expire.
        // During fading, reuse the native path instead of rebuilding it each frame.
        const path=win.Path2D?new win.Path2D():null;
        if(path)traceRibbon(path,points);
        const a=rows[0],b=rows.at(-1),g=c.createLinearGradient(a.x,a.y,b.x+.01,b.y+.01);
        g.addColorStop(0,rgba(theme.colors[layer],0));g.addColorStop(.45,rgba(theme.colors[layer],theme.ribbon==='silk'?.22:.32));g.addColorStop(1,rgba(theme.colors[layer],.66));
        ribbons.push({path,points,gradient:g,at:b.at,width:theme.ribbon==='silk'?(layer?3:7):theme.ribbon==='aurora'?(layer?1:4):theme.ribbon==='electric'?1.2:1.4});
      }
      }
    }
    function traceRibbon(target,points){
      target.moveTo(points[0].x,points[0].y);
      if(theme.ribbon==='electric'){for(let i=1;i<points.length;i++)target.lineTo(points[i].x,points[i].y);}
      else{for(let i=1;i<points.length-1;i++){const p=points[i],next=points[i+1];target.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);}const end=points.at(-1);target.quadraticCurveTo(end.x,end.y,end.x,end.y);}
    }
    function ribbon(at){
      if(ribbonDirty)rebuildRibbons();
      for(const row of ribbons){
        if(!row.path){c.beginPath();traceRibbon(c,row.points);}
        const alpha=Math.max(0,1-(at-row.at)/520);c.strokeStyle=row.gradient;c.lineCap='round';c.lineJoin='round';
        if(theme.ribbon==='neon'){c.globalAlpha=alpha*.12;c.lineWidth=8;row.path?c.stroke(row.path):c.stroke();}
        c.globalAlpha=alpha;c.lineWidth=row.width;row.path?c.stroke(row.path):c.stroke();
      }
      c.globalAlpha=1;
    }
    function prune(rows,at,life){let kept=0;for(let i=0;i<rows.length;i++){const p=rows[i];if(at-p.at<(life||p.life))rows[kept++]=p;}const changed=kept!==rows.length;rows.length=kept;return changed;}
    function draw(at=now()){
      if(destroyed)return;
      if(previous)c.clearRect(previous.x,previous.y,previous.width,previous.height);
      prune(particles,at);if(prune(knots,at,520))ribbonDirty=true;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      function bounds(x,y,rx,ry=rx){minX=Math.min(minX,x-rx);minY=Math.min(minY,y-ry);maxX=Math.max(maxX,x+rx);maxY=Math.max(maxY,y+ry);}
      if(theme.ribbon)for(const p of knots)bounds(p.x,p.y,12);ribbon(at);
      const fluttering=theme.id==='cherry'||theme.id==='peach'||theme.id==='wildflower',electric=theme.id==='volt_berry';
      for(const p of particles){const age=Math.max(0,(at-p.at)/p.life),ease=age*(2-age);
        const flutter=Math.sin(age*5+p.phase)*theme.sway*age;
        const x=p.x+p.nx*flutter+p.drift*ease,y=p.y+p.ny*flutter+theme.fall*age*age;
        const alpha=Math.min(1,(1-age)*2.1)*(theme.id==='neon_orchid'?Math.min(1,Math.max(0,at-p.at)/85):1),size=p.size*(1-age*.24);
        if(alpha<=0)continue;
        const angle=p.angle+p.spin*age,cos=Math.cos(angle),sin=Math.sin(angle),sy=electric&&p.type===2?1+age*.7:1,sx=fluttering&&p.type!==3?.65+.35*Math.abs(Math.cos(age*4+p.phase)):sy;
        const rx=size*(Math.abs(cos)*sx+Math.abs(sin)*sy)+2,ry=size*(Math.abs(sin)*sx+Math.abs(cos)*sy)+2;
        if(x+rx<0||y+ry<0||x-rx>width||y-ry>height)continue;
        c.setTransform(cos*sx*ratio,sin*sx*ratio,-sin*sy*ratio,cos*sy*ratio,x*ratio,y*ratio);c.globalAlpha=alpha*.92;
        c.drawImage(sprites[p.type],-size,-size,size*2,size*2);bounds(x,y,rx,ry);
      }
      c.setTransform(ratio,0,0,ratio,0,0);
      const left=Math.max(0,Math.floor(minX)-2),top=Math.max(0,Math.floor(minY)-2),right=Math.min(width,Math.ceil(maxX)+2),bottom=Math.min(height,Math.ceil(maxY)+2);
      previous=minX===Infinity||right<=left||bottom<=top?null:{x:left,y:top,width:right-left,height:bottom-top};
      c.globalAlpha=1;
    }
    function tick(at){raf=null;if(at+.5>=nextPaint){draw(at);const frame=1000/60;nextPaint=Number.isFinite(nextPaint)?nextPaint+(Math.floor(Math.max(0,at-nextPaint)/frame)+1)*frame:at+frame;}if(particles.length||knots.length)schedule();}
    setKind(theme.id);
    return {point,resize,setKind,draw,clear:reset,stats:()=>({kind:theme.id,particles:particles.length,knots:knots.length,running:raf!==null}),destroy(){reset();destroyed=true;sprites=[];}};
  }
  function preview(canvas,kind){
    const player=create(canvas,{kind,animate:false});player.resize(280,76,canvas.ownerDocument.defaultView.devicePixelRatio);
    for(let i=0;i<=24;i++){const t=i/24;player.point({x:22+t*232,y:41-Math.sin(t*Math.PI*1.6)*16},i*16);}
    player.draw(390);return player;
  }
  return {key,catalog,profile,kindForPet,preferences,create,preview};
});
