(function(root,factory){const common=typeof module==='object'&&module.exports,api=factory(common?require('./fishing-rod-effects'):root.TracerFishingRodEffects);if(common)module.exports=api;else root.TracerFishingMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(RodEffects){
  'use strict';
  const clamp=(value,low=0,high=1)=>Math.max(low,Math.min(high,Number(value)||0));
  const mix=(a,b,t)=>a+(b-a)*t,ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  function castWorld(distance){const d=clamp(distance);return{x:mix(-1.25,1.05,d),z:mix(.9,-.6,d)};}
  function castLanding(distance,geometry){const d=clamp(distance)-.5;return{x:geometry.water.x+geometry.width*d*.1,y:geometry.water.y-geometry.height*d*.12};}
  const ROD_STIFFNESS={bamboo:.68,willow:.76,carbon:1.32,copper:1.2,rosewood:1.12,tide:.94,clockwork:1.48,frost:1.18,jade:1.1,moon:.96,phoenix:1.04,cloud:.82,astral:1.08,dragon:1.4,lotus:.86};
  function rodStiffness(rod){const value=ROD_STIFFNESS[rod?.id];return(typeof value==='number'?value:1)*Math.sqrt(clamp(rod?.control||1,.65,1.6));}
  // Cantilever tip-load shape above the rigid grip. The axial correction keeps
  // the bent centreline almost inextensible even at the visual deflection cap.
  function rodCurvePoint(along,bend,anchor){
    const a=anchor||rodGeometry({width:250.8,height:418}),s=clamp(along),ratio=clamp(bend,-.24,.24),dx=a.tip.x-a.grip.x,dy=a.tip.y-a.grip.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,q=clamp((s-.3)/.7),flexLength=length*.7,deflection=ratio*length;
    const lateral=deflection*q*q*(3-q)/2,shortening=deflection*deflection/(2*flexLength)*(3*q**3-2.25*q**4+.45*q**5),axial=s*length-shortening,slope=deflection/flexLength*(3*q-1.5*q*q),angle=Math.atan2(slope,1-.5*slope*slope)*180/Math.PI;
    return{x:a.grip.x+ux*axial-uy*lateral,y:a.grip.y+uy*axial+ux*lateral,angle:angle||0};
  }
  function rotatedRodPoint(box,anchor,point,angle){const radians=angle*Math.PI/180,dx=point.x-anchor.grip.x,dy=point.y-anchor.grip.y;return{x:box.x+anchor.grip.x+dx*Math.cos(radians)-dy*Math.sin(radians),y:box.y+anchor.grip.y+dx*Math.sin(radians)+dy*Math.cos(radians)};}
  function rodLoad(phase,age,values,geometry,point,angle,rod,acceleration=0){
    const v=values||{},g=geometry,tip=rotatedTip(g.box,g.anchor,angle),axis={x:tip.x-g.grip.x,y:tip.y-g.grip.y},axisLength=Math.hypot(axis.x,axis.y)||1,line={x:point.x-tip.x,y:point.y-tip.y},lineLength=Math.hypot(line.x,line.y)||1,transverse=(-axis.y*line.x+axis.x*line.y)/(axisLength*lineLength),stiffness=rodStiffness(rod),inertia=clamp(-acceleration*.00016,-.035,.035);
    let load=0;
    if(phase==='reeling'){const stamina=clamp(v.stamina===undefined?1:v.stamina),surge=clamp(v.surgeAmount===undefined?(v.fishBehavior==='surge'?1:0):v.surgeAmount)*stamina,rest=clamp(v.restAmount===undefined?(v.fishBehavior==='rest'?1:0):v.restAmount),fishLoad=clamp(v.fishLoad===undefined?1:v.fishLoad,.45,1.6)*(.35+.65*stamina),hook=.035*ease(Math.max(0,age)/55)*(1-ease((Math.max(0,age)-55)/260));load=transverse*(.035+.018*fishLoad+(.14*clamp(v.tension)+.055*clamp(v.holding)+.032*surge-.018*rest)*fishLoad+hook);}
    else if(phase==='waiting')load=transverse*.015*clamp(v.nibble);
    else if(phase==='bite')load=transverse*.055;
    else if(phase==='charging')load=-.022*clamp(v.castPower)+inertia;
    else if(phase==='cast')load=-.065*clamp(v.castPower)*Math.sin(Math.max(0,age)/90)*Math.exp(-Math.max(0,age)/360)+inertia;
    else if(phase==='caught')load=transverse*.025*(1-ease(Math.max(0,age)/600));
    return clamp(load/stiffness,-.22,.22);
  }
  function stepRodSpring(state,target,dt,stiffness=1,reduced=false){
    let remaining=clamp(dt,0,80)/1000;const frequency=16*Math.sqrt(clamp(stiffness,.5,2)),damping=reduced?1:.72,goal=clamp(target,-.22,.22);
    while(remaining>0){const step=Math.min(remaining,.008),force=frequency*frequency*(goal-state.bend)-2*damping*frequency*state.velocity;state.velocity+=force*step;state.bend=clamp(state.bend+state.velocity*step,-.24,.24);remaining-=step;}return state;
  }
  // Visual time never feeds back into the authoritative fishing session.
  function pose(phase,age,values,geometry,reduced){
    const g=geometry,v=values||{},t=Math.max(0,Number(age)||0),time=t/1000,base=g.baseAngle||0,power=clamp(v.castPower),tension=clamp(v.tension),water=g.water,quiet=reduced?0:1;
    let angle=base,point={x:water.x,y:water.y},lineAlpha=1,sag=g.height*.075,floatAlpha=1,fishAlpha=0,fishAngle=0,fishScale=.6,fishSquash=1;
    if(phase==='idle'||phase==='charging'){
      angle=base+(phase==='charging'?-(reduced?8:11)-power*(reduced?8:22):Math.sin(time*.9)*.45*quiet);lineAlpha=0;floatAlpha=0;
    }else if(phase==='cast'){
      const progress=clamp(t/(reduced?450:650)),swing=clamp(t/205),rebound=Math.exp(-Math.max(0,t-190)/190)*Math.sin(Math.max(0,t-190)/85);
      angle=base+23*Math.sin(swing*Math.PI/2)-18*ease((t-190)/460)-5*rebound*quiet;
      const launch=g.launch||water,flight=ease(progress);point={x:mix(launch.x,water.x,flight),y:mix(launch.y,water.y,flight)-Math.sin(progress*Math.PI)*g.height*.25*quiet};sag=g.height*(.03+.07*progress);floatAlpha=ease(t/65);
    }else if(phase==='waiting'){
      const nibble=clamp(v.nibble);angle=base+5+Math.sin(time*1.15)*.6*quiet+nibble*.45;point.y+=Math.sin(time*2.3)*1.4*quiet+nibble*2.4;point.x+=Math.sin(time*18)*nibble*.8*quiet;
    }else if(phase==='bite'){
      angle=base+5+Math.sin(time*20)*.4*quiet;point.x+=Math.sin(time*23)*1.5*quiet;point.y+=4*ease(t/180)+(Math.sin(time*19)*2.1)*quiet;sag=g.height*.045;
    }else if(phase==='reeling'){
      const stamina=clamp(v.stamina===undefined?1:v.stamina),surge=(v.surgeAmount===undefined?(v.fishBehavior==='surge'?1:0):clamp(v.surgeAmount))*stamina,rest=v.restAmount===undefined?(v.fishBehavior==='rest'?1:0):clamp(v.restAmount);
      angle=base-6-12*Math.sin(Math.min(t/125,Math.PI))*Math.exp(-t/380)*quiet-tension*2-surge*2+rest+(Math.sin(time*(10+surge*6))*(.35+tension*.4+surge*.4)*(1-rest*.55))*quiet;
      point.x+=(clamp(v.fishPosition)-.5)*g.width*(.065+surge*.025);point.y+=Math.sin(time*(4.6+surge*3))*(2+surge*1.8)*(1-rest*.5)*quiet;sag=0;
    }else if(phase==='caught'){
      const product=v.catchKind==='junk'||v.catchKind==='mystery',flightDuration=reduced?450:760,progress=ease(t/flightDuration),end=g.ground||{x:g.width*.43,y:g.height*.88},landAge=Math.max(0,t-flightDuration),decay=Math.exp(-landAge/650),flop=Math.sin(landAge*.021)*decay*quiet,bounce=product?Math.abs(Math.sin(Math.min(landAge/160,Math.PI)))*g.height*.009*decay*quiet:Math.abs(Math.sin(landAge*.016))*g.height*.035*decay*quiet;
      angle=base-17*Math.sin(Math.min(1,t/800)*Math.PI)*quiet;
      point={x:mix(water.x,end.x,progress)+Math.sin(landAge*.012)*g.width*.007*decay*quiet,y:mix(water.y,end.y,progress)-Math.sin(progress*Math.PI)*g.height*.3*quiet-bounce};
      fishAlpha=ease(t/85)*(1-ease((t-flightDuration-1150)/320));fishAngle=product?(-9*(1-progress)+Math.sin(landAge*.008)*4*Math.exp(-landAge/330))*quiet:-18*(1-progress)+flop*24;fishScale=mix(.45,.72,progress);fishSquash=product?1:1-Math.abs(flop)*.18;
      floatAlpha=1-ease(t/190);lineAlpha=1-ease((t-flightDuration*.65)/(flightDuration*.35));sag=0;
    }else{
      angle=base+5*(1-ease(t/550));point.y+=ease(t/350)*6;floatAlpha=1-ease(t/420);lineAlpha=1-ease(t/620);sag=g.height*(.08+ease(t/620)*.1);
    }
    return {angle,x:point.x,y:point.y,lineAlpha,floatAlpha,sag,fishAlpha,fishAngle,fishScale,fishSquash};
  }
  function rodGeometry(box){
    const scale=Math.min(box.width/250.8,box.height/418),w=250.8*scale,h=418*scale,padX=(box.width-w)/2,padY=(box.height-h)/2;
    return {grip:{x:padX+w*.11,y:padY+h*.94},tip:{x:padX+w*.9,y:padY+h*.04}};
  }
  function rotatedTip(box,anchor,angle){return rotatedRodPoint(box,anchor,anchor.tip,angle);}
  const FX_THEMES={tide:'water',clockwork:'clockwork',frost:'ice',jade:'vine',moon:'stars',phoenix:'fire',cloud:'tornado',astral:'stars',dragon:'cloud',lotus:'vine',guandao:'dragon',katana:'blade',golden:'sovereign'};
  const FX_SHAPES={
    water:'M0-4C1-2 3 0 3 2A3 3 0 0 1-3 2C-3 0-1-2 0-4ZM-.8 0Q-2 1-.8 2.2',
    vine:'M-4 2Q-4-4 4-3Q4 3-4 2ZM-3 1L2-2',
    stars:'M0-4L1-1L4 0L1 1L0 4L-1 1L-4 0L-1-1Z',
    cloud:'M-5 2C-7 0-4-3-2-2C-2-5 3-5 3-2C7-3 7 2 3 2ZM-3 0Q0 2 3 0',
    tornado:'M-5-3C2-5 8-2 3-1C-3 0-5 2 0 2C3 2 2 4 0 5C1 3-2 3-3 2C-7-1 3 0 4-2C4-3 0-4-5-3Z',
    fire:'M0-5C1-2 5 0 3 3C1 6-4 4-3 0C-2 2-1-2 0-5ZM0 0C-2 3 0 4 1 2Z',
    ice:'M0-5L1-2L4-3L2 0L4 3L1 2L0 5L-1 2L-4 3L-2 0L-4-3L-1-2Z',
    clockwork:'M-1-5H1L1.5-3L3-3L4-4L5-2L3.5-.8V.8L5 2L4 4L2.5 3L1 3.5V5H-1V3.5L-2.5 3L-4 4L-5 2L-3.5.8V-.8L-5-2L-4-4L-3-3H-1.5ZM0-1.7A1.7 1.7 0 1 0 0 1.7A1.7 1.7 0 1 0 0-1.7Z',
    blade:'M-1 5L0-5L2-7L1 4ZM-3 3H3V4H-3Z',
    dragon:'M-4 3Q-5-2 0-2Q4-2 2-5L5-3L4 0Q2 3-1 1Q-4 0-4 3Z'
  };
  function effectShape(profile){return RodEffects?.design(profile?.variant)?.mote||FX_SHAPES[typeof profile==='string'?profile:profile?.theme]||FX_SHAPES.stars;}
  function fxProfile(rod){
    if(!rod||!Object.prototype.hasOwnProperty.call(FX_THEMES,rod.id)||rod.rarity==='common')return null;
    const color=value=>/^#[0-9a-f]{3,8}$/i.test(String(value))?value:'#c7e8d4';
    const material=RodEffects?.design(rod.id);
    return{theme:material?.theme||FX_THEMES[rod.id],variant:rod.id,action:['katana','guandao','jade','dragon'].includes(rod.id)?rod.id:'',color:material?.colors[1]||(rod.id==='cloud'?'#b7e4ee':color(rod.accent)),accent:material?.colors[0]||(rod.id==='cloud'?'#f1ffff':color(rod.color)),energy:rod.rarity==='legendary'?1:rod.rarity==='epic'?.85:.68};
  }
  // A continuous tapered funnel also serves the SVG fallback when the richer
  // procedural renderer is unavailable. Each wind band has a projected depth,
  // a narrow rooted tip and a broad mouth; no cloud or crane icons are stacked.
  function tornadoGeometry(age=0,power=0,reduced=false){
    const seconds=reduced?0:Math.max(0,Number.isFinite(age)?age:0)/1000,charge=reduced?0:clamp(power),turn=seconds*(2.75+charge*.65);
    return Array.from({length:3},(_,strand)=>Array.from({length:97},(_,i)=>{
      const u=i/96,angle=u*Math.PI*6.4-turn+strand*Math.PI*2/3,radius=.014+(.68+charge*.07)*Math.pow(u,1.22),depth=Math.sin(angle),sway=Math.sin(u*3.2+seconds*.5)*u*.04;
      return{x:sway+Math.cos(angle)*radius,y:1-u*2+depth*radius*.24,width:(.008+u*.035)*Math.pow(Math.sin(u*Math.PI),.45)*(.76+depth*.24),depth};
    }));
  }
  function tornadoRibbon(points,project){
    const mapped=points.map(project),outer=[],inner=[],f=n=>n.toFixed(2),path=rows=>rows.map((p,i)=>(i?'L':'M')+f(p.x)+' '+f(p.y)).join(' ');
    for(let i=0;i<mapped.length;i++){const p=mapped[i],a=mapped[Math.max(0,i-1)],b=mapped[Math.min(mapped.length-1,i+1)],length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;outer.push({x:p.x+nx*p.width,y:p.y+ny*p.width});inner.push({x:p.x-nx*p.width,y:p.y-ny*p.width});}
    return path(outer)+' '+path(inner.reverse()).replace(/^M/,'L')+'Z';
  }
  let catalogEffectSerial=0;
  function catalogEffectsMarkup(rod){
    const profile=fxProfile(rod);if(!profile)return '';
    if(RodEffects?.design(rod.id))return RodEffects.catalogMarkup(rod,'fishing-catalog-glow-'+(++catalogEffectSerial),along=>rodCurvePoint(along,0));
    if(profile.theme==='tornado'){
      const id='fishing-catalog-glow-'+(++catalogEffectSerial),center=rodCurvePoint(.51,0),project=p=>({x:center.x+p.x*58,y:center.y-12+p.y*60,width:p.width*49}),ribbons=tornadoGeometry(0).map((points,i)=>'<path class="fishing-catalog-vortex-band" d="'+tornadoRibbon(points,project)+'" style="--vortex-delay:'+(-i*.8)+'s;fill:'+(i===1?profile.accent:profile.color)+';fill-opacity:'+[.27,.2,.4][i]+'"/>').join('');
      return '<g class="fishing-catalog-fx" data-fx-theme="tornado" data-fx-variant="cloud" style="--rod-glow:'+profile.color+';--rod-accent:'+profile.accent+';--fx-energy:'+profile.energy+'" aria-hidden="true"><defs><radialGradient id="'+id+'"><stop stop-color="'+profile.color+'" stop-opacity=".25"/><stop offset="1" stop-color="'+profile.color+'" stop-opacity="0"/></radialGradient></defs><ellipse class="fishing-catalog-halo" cx="'+center.x.toFixed(2)+'" cy="'+(center.y-12).toFixed(2)+'" rx="55" ry="74" fill="url(#'+id+')"/><g class="fishing-catalog-vortex">'+ribbons+'</g></g>';
    }
    const id='fishing-catalog-glow-'+(++catalogEffectSerial),point=(along,offset=0)=>{const p=rodCurvePoint(along,0);return{x:p.x+.884*offset,y:p.y+.467*offset};},number=n=>n.toFixed(2),path=phase=>Array.from({length:57},(_,i)=>{const s=.18+i/56*.79,p=point(s,Math.sin(s*Math.PI*7+phase)*(10+profile.energy*4)*Math.sin(s*Math.PI));return(i?'L':'M')+number(p.x)+' '+number(p.y);}).join(' '),spine=path(0),other=path(Math.PI),gem=point(.32),tip=point(.97),count=rod.rarity==='legendary'?14:rod.rarity==='epic'?11:8;
    const particles=Array.from({length:count},(_,i)=>{const s=.24+i/count*.68,side=i%2?-1:1,p=point(s,side*(12+i%3*6)),size=.7+(i%4)*.18,delay=-(i*.59);return'<g transform="translate('+number(p.x)+' '+number(p.y)+') rotate('+(i*47)+') scale('+size+')"><path class="fishing-catalog-mote" d="'+effectShape(profile)+'" fill-rule="evenodd" style="--fx-delay:'+delay+'s;--fx-travel:'+(side*5)+'px"/></g>';}).join('');
    let signature='';
    if(rod.id==='katana')signature='<g class="fishing-catalog-emblem"><path d="M-20 22L15-20L23-25L19-16L-16 25ZM-16 14L-7 23M-22 24L-17 28"/><path d="M-30 3Q-4-29 29-12" stroke-dasharray="32 5 9"/></g>';
    else if(rod.id==='moon')signature='<path class="fishing-catalog-emblem" d="M12-22A25 25 0 1 0 12 22A23 23 0 0 1 12-22Z"/>';
    else if(rod.id==='astral')signature='<g class="fishing-catalog-orbit"><ellipse rx="31" ry="11"/><ellipse rx="31" ry="11" transform="rotate(60)"/><ellipse rx="31" ry="11" transform="rotate(120)"/><circle cx="31" cy="0" r="2.5"/></g>';
    else if(rod.id==='lotus')signature='<g class="fishing-catalog-emblem">'+[-52,-26,0,26,52].map(a=>'<path d="M0 15Q-17 0 0-22Q17 0 0 15Z" transform="rotate('+a+' 0 15)"/>').join('')+'</g>';
    else if(profile.theme==='clockwork')signature='<g class="fishing-catalog-orbit"><circle r="26"/>'+Array.from({length:12},(_,i)=>'<path d="M0-22V-28" transform="rotate('+(i*30)+')"/>').join('')+'<circle r="17" stroke-dasharray="2 5"/><path d="M0-12V0L9 6"/></g>';
    else if(profile.theme==='ice')signature='<g class="fishing-catalog-emblem">'+Array.from({length:6},(_,i)=>'<path d="M0 0V-24M0-16L-5-20M0-16L5-20" transform="rotate('+(i*60)+')"/>').join('')+'</g>';
    else if(profile.theme==='fire')signature='<path class="fishing-catalog-emblem" d="M-26 12Q-10 7-20-10Q-9-3-9-18Q0-9 0-27Q5-13 9-7Q15-14 13-19Q28-3 13 14M-15 11Q0 0 15 11"/>';
    else if(['dragon','guandao','jade'].includes(rod.id))signature='<path class="fishing-catalog-emblem" d="M-24 16Q-36 0-14-3Q8 1 1-14Q-4-23 10-23L20-18L28-20L22-11L13-9M11-22L13-31M19-19L25-28M-7-3L-10 7M-1-14L-12-16"/>';
    else if(profile.theme==='water')signature='<g class="fishing-catalog-orbit"><ellipse rx="30" ry="12"/><ellipse rx="22" ry="7" transform="rotate(-24)"/></g>';
    else if(profile.theme==='cloud')signature='<path class="fishing-catalog-emblem" d="M-28 8Q-38-2-22-5Q-24-21-7-17Q2-31 13-18Q28-23 26-8Q42 0 28 8M-23 10Q-1 20 22 10M-15 2Q-4-7 9 2Q17 8 20 2"/>';
    else signature='<path class="fishing-catalog-emblem" d="M-26 18Q-7 12 12-20M-15 10Q-27-10-10-8Q0-7-5 1M1-6Q0-25 15-20Q23-15 8-11M-7 17Q12 23 18 8Q5 2-7 17"/>';
    return'<g class="fishing-catalog-fx" data-fx-theme="'+profile.theme+'" data-fx-variant="'+rod.id+'" style="--rod-glow:'+profile.color+';--rod-accent:'+profile.accent+';--fx-energy:'+profile.energy+'" aria-hidden="true"><defs><radialGradient id="'+id+'"><stop offset="0" stop-color="'+profile.color+'" stop-opacity=".48"/><stop offset=".35" stop-color="'+profile.accent+'" stop-opacity=".22"/><stop offset="1" stop-color="'+profile.color+'" stop-opacity="0"/></radialGradient></defs><ellipse class="fishing-catalog-halo" cx="'+number(gem.x)+'" cy="'+number(gem.y)+'" rx="57" ry="59" fill="url(#'+id+')"/><path class="fishing-catalog-aura" d="'+spine+'"/><path class="fishing-catalog-wisp secondary" d="'+other+'"/><path class="fishing-catalog-wisp" d="'+spine+'"/><g transform="translate('+number(gem.x)+' '+number(gem.y)+')">'+signature+'</g>'+particles+'<g transform="translate('+number(tip.x)+' '+number(tip.y)+')"><path class="fishing-catalog-tip" d="'+FX_SHAPES.stars+'"/></g></g>';
  }
  function effectState(phase,age,values,reduced){
    const t=Math.max(0,Number(age)||0),power=clamp(values?.castPower),tension=clamp(values?.tension),scale=reduced?.32:1;
    const hook=phase==='reeling'?1-ease(t/480):0,cast=phase==='cast'?1-ease(t/800):0,surge=values?.fishBehavior==='surge'?.15*clamp(values?.stamina===undefined?1:values.stamina):0;
    return{strength:scale*(phase==='charging'?.4+.56*power:phase==='reeling'?.42+.4*tension+surge:phase==='cast'?.95:phase==='caught'?.65*(1-ease(t/900)):phase==='escaped'?.22*(1-ease(t/600)):.3),wrap:scale*(phase==='charging'?.45+.5*power:phase==='reeling'?.48:.32),trail:cast*scale,burst:hook*scale,pulse:phase==='reeling'?.6*scale:0,particles:reduced?4:['charging','cast','reeling'].includes(phase)?14:8};
  }
  // These short visual envelopes never modify phase timings or session state.
  function actionEffectState(profile,phase,age,reduced=false){
    const action=profile?.action;if(!action||!['cast','reeling','caught'].includes(phase))return null;
    if((action==='jade'||action==='dragon')&&phase!=='caught')return null;
    const dragon=phase==='caught'&&action!=='katana',start=phase==='caught'?(reduced?430:dragon?680:740):phase==='cast'?35:0,duration=dragon?1280:phase==='caught'?920:action==='guandao'?820:680,elapsed=Math.max(0,Number(age)||0)-start;
    if(elapsed<0||elapsed>=duration)return null;
    const progress=elapsed/duration,alpha=ease(progress/.09)*(1-ease((progress-.36)/.64))*(reduced?.22:1);
    return{kind:dragon?'dragon':'slash',variant:action,progress,alpha,sweep:reduced?.72:ease(progress/(dragon?1:.48)),reduced,phase};
  }
  function actionEffectGeometry(state,g,tip,point){
    const caught=state.phase==='caught',wide=state.variant==='guandao',size=clamp(Math.min(g.width*(caught?.255:.23),g.height*.39),44,145),center=caught?{x:point.x,y:point.y-size*(state.kind==='dragon'?.23:.1)}:state.phase==='cast'?{x:mix(tip.x,point.x,.35),y:mix(tip.y,point.y,.35)+size*.22}:{x:point.x,y:point.y+size*.12},f=value=>value.toFixed(2),xy=p=>f(p.x)+' '+f(p.y),stroke=points=>points.map((p,i)=>(i?'L':'M')+xy(p)).join(' ');
    if(state.kind==='slash'){
      const from=3.22,to=mix(2.93,-.32,state.sweep),outer=[],inner=[],edge=[],broad=(wide?.105:.036)*size;
      for(let i=0;i<=40;i++){const q=i/40,a=mix(from,to,q),width=Math.pow(Math.sin(q*Math.PI),.8)*broad,rx=size,ry=size*(wide?.45:.29);outer.push({x:Math.cos(a)*(rx+width),y:-Math.sin(a)*(ry+width)});inner.push({x:Math.cos(a)*(rx-width),y:-Math.sin(a)*(ry-width)});edge.push({x:Math.cos(a)*(rx+width*.2),y:-Math.sin(a)*(ry+width*.2)});}
      const path=stroke(outer)+' '+stroke(inner.reverse()).replace(/^M/,'L')+'Z',angle=wide?-19:state.phase==='caught'?-12:-31;
      return{kind:'slash',transform:'translate('+xy(center)+') rotate('+angle+')',body:path,line:stroke(edge),echo:stroke(edge.map(p=>({x:p.x*.86,y:p.y*.78+size*.11}))),burst:'M'+f(-size*.85)+' 0L'+f(size*1.03)+' '+f(-size*.085),size,center};
    }
    const headAngle=state.reduced?-1.1:mix(3.8,-1.55,state.sweep),centers=[],outer=[],inner=[],spikes=[];
    for(let i=0;i<=54;i++){const q=i/54,a=headAngle+(1-q)*Math.PI*1.7,r=size*(.77+q*.23);centers.push({x:Math.cos(a)*r,y:Math.sin(a)*r*.37-size*.12});}
    for(let i=0;i<centers.length;i++){const p=centers[i],a=centers[Math.max(0,i-1)],b=centers[Math.min(54,i+1)],length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length,width=size*(.006+.046*Math.sin(i/54*Math.PI*.7));outer.push({x:p.x+nx*width,y:p.y+ny*width});inner.push({x:p.x-nx*width,y:p.y-ny*width});if(i>10&&i<51&&i%3===0)spikes.push('M'+xy({x:p.x-nx*width*.8,y:p.y-ny*width*.8})+'L'+xy({x:p.x-nx*width*2.3-(b.x-a.x)*.6,y:p.y-ny*width*2.3-(b.y-a.y)*.6})+'L'+xy({x:b.x-nx*width*.7,y:b.y-ny*width*.7})+'Z');}
    const head=centers[54],prior=centers[53],angle=Math.atan2(head.y-prior.y,head.x-prior.x)*180/Math.PI;
    return{kind:'dragon',transform:'translate('+xy(center)+')',body:stroke(outer)+' '+stroke(inner.reverse()).replace(/^M/,'L')+'Z',line:stroke(centers),spikes:spikes.join(' '),headTransform:'translate('+xy(head)+') rotate('+f(angle)+') scale('+f(size/76)+')',size,center};
  }
  function createEffects(stage){
    const doc=stage.ownerDocument;if(!doc.createElement||!stage.appendChild)return null;
    const actionMarkup='<g class="fishing-action-fx" style="display:none"><g class="fishing-action-slash"><path class="fishing-action-slash-halo"/><path class="fishing-action-slash-body"/><path class="fishing-action-slash-edge"/><path class="fishing-action-slash-echo"/><path class="fishing-action-flash"/></g><g class="fishing-action-dragon"><path class="fishing-action-dragon-halo"/><path class="fishing-action-dragon-body"/><path class="fishing-action-dragon-scales"/><path class="fishing-action-dragon-spines"/><g class="fishing-action-dragon-head"><path class="fishing-action-dragon-face" d="M-12-5Q-5-12 3-8L9-5L17-4L21 0L15 4L8 3L3 8L-7 8L-13 2Z"/><path class="fishing-action-dragon-detail" d="M-4-7L-7-17L-2-14L1-8M4-6L8-15L9-9M11 3Q21 15 28 9M15 0Q29-9 34 0M-7 7L-15 14L-8 12M6 3L14 1"/><circle class="fishing-action-dragon-eye" cx="6" cy="-2.5" r="1.35"/></g></g></g>';
    const layer=doc.createElement('div');layer.className='fishing-motion-fx';layer.setAttribute('aria-hidden','true');layer.innerHTML='<svg><path class="fishing-fx-aura"/><path class="fishing-fx-wrap secondary"/><path class="fishing-fx-wrap primary"/><path class="fishing-fx-trail"/><circle class="fishing-fx-burst"/><circle class="fishing-fx-tip"/>'+Array.from({length:16},()=>'<path class="fishing-fx-particle" fill-rule="evenodd"/>').join('')+actionMarkup+'</svg>';stage.appendChild(layer);
    const svg=layer.querySelector('svg'),aura=layer.querySelector('.fishing-fx-aura'),secondary=layer.querySelector('.fishing-fx-wrap.secondary'),wrap=layer.querySelector('.fishing-fx-wrap.primary'),trail=layer.querySelector('.fishing-fx-trail'),burst=layer.querySelector('.fishing-fx-burst'),tipGlow=layer.querySelector('.fishing-fx-tip'),particles=[...layer.querySelectorAll('.fishing-fx-particle')];
    const actionLayer=layer.querySelector('.fishing-action-fx'),slash=layer.querySelector('.fishing-action-slash'),dragon=layer.querySelector('.fishing-action-dragon'),parts=Object.fromEntries(['slash-halo','slash-body','slash-edge','slash-echo','flash','dragon-halo','dragon-body','dragon-scales','dragon-spines','dragon-head'].map(key=>[key,layer.querySelector('.fishing-action-'+key)]));
    const fluid=RodEffects?.create(layer);
    let lastTheme='',tipHistory=[];
    function drawAction(profile,phase,age,g,tip,point,reduced){
      const state=profile.variant==='dragon'?null:actionEffectState(profile,phase,age,reduced);actionLayer.style.display=state?'':'none';if(!state)return;
      const shape=actionEffectGeometry(state,g,tip,point);actionLayer.dataset.variant=state.variant;actionLayer.dataset.phase=phase;actionLayer.dataset.kind=state.kind;actionLayer.setAttribute('transform',shape.transform);actionLayer.style.opacity=String(state.alpha*profile.energy);slash.style.display=state.kind==='slash'?'':'none';dragon.style.display=state.kind==='dragon'?'':'none';
      if(state.kind==='slash'){parts['slash-halo'].setAttribute('d',shape.body);parts['slash-body'].setAttribute('d',shape.body);parts['slash-edge'].setAttribute('d',shape.line);parts['slash-echo'].setAttribute('d',shape.echo);parts.flash.setAttribute('d',shape.burst);parts.flash.style.opacity=String(reduced?0:Math.max(0,1-state.progress/.36)*.8);}
      else{parts['dragon-halo'].setAttribute('d',shape.line);parts['dragon-body'].setAttribute('d',shape.body);parts['dragon-scales'].setAttribute('d',shape.line);parts['dragon-spines'].setAttribute('d',shape.spikes);parts['dragon-head'].setAttribute('transform',shape.headTransform);}
    }
    function draw(profile,phase,age,values,g,tip,point,control1,control2,reduced){
      if(!profile){layer.hidden=true;tipHistory=[];return;}layer.hidden=false;layer.dataset.theme=profile.theme;layer.dataset.variant=profile.variant;svg.setAttribute('viewBox','0 0 '+g.width+' '+g.height);layer.style.setProperty('--rod-glow',profile.color);layer.style.setProperty('--rod-accent',profile.accent);
      const organic=fluid&&RodEffects?.design(profile.variant);svg.style.display=organic?'none':'';fluid?.draw(profile,phase,age,values,g,tip,point,control1,control2,reduced);if(organic){tipHistory=[];return;}
      if(profile.variant!==lastTheme){for(const particle of particles)particle.setAttribute('d',effectShape(profile));lastTheme=profile.variant;tipHistory=[];}
      const state=effectState(phase,age,values,reduced),seconds=reduced?0:age/1000,grip=g.grip,dx=tip.x-grip.x,dy=tip.y-grip.y,amplitude=(reduced?2:5)+(phase==='charging'?values.castPower*4:0),points=[],counterpoints=[];
      const spine=along=>g.curve?g.curve(along):{x:grip.x+dx*along,y:grip.y+dy*along},around=along=>{const p=spine(along),a=spine(clamp(along-.01)),b=spine(clamp(along+.01)),length=Math.hypot(b.x-a.x,b.y-a.y)||1;return{...p,nx:-(b.y-a.y)/length,ny:(b.x-a.x)/length};};
      if(profile.theme==='tornado'){
        const base=spine(.23),height=Math.max(24,Math.min(g.height*.43,Math.hypot(dx,dy)*.64)),width=height*.45,project=p=>({x:base.x+p.x*width,y:base.y-(1-p.y)*height*.5,width:p.width*width}),bands=tornadoGeometry(age,phase==='charging'?values.castPower:0,reduced),alpha=(['caught','escaped'].includes(phase)?state.strength:state.wrap)*profile.energy;
        [wrap,secondary,trail].forEach((node,i)=>{node.setAttribute('d',tornadoRibbon(bands[i],project));node.style.opacity=String(alpha*[1,.7,.82][i]);});
        aura.setAttribute('d',tornadoRibbon(bands[0],project));aura.style.opacity=String(alpha*.28);tipGlow.style.opacity='0';burst.style.opacity='0';actionLayer.style.display='none';for(const particle of particles)particle.style.opacity='0';tipHistory=[];return;
      }
      const design=RodEffects?.design(profile.variant);
      for(let i=0;i<=36;i++){const along=.17+i/36*.8,wave=Math.sin(along*Math.PI*(design?.frequency||6)-seconds*(phase==='charging'?5:1.8)*(design?.speed||1))*amplitude*(design?.spread||1)*Math.sin(along*Math.PI),p=around(along);points.push([p.x+p.nx*wave,p.y+p.ny*wave]);counterpoints.push([p.x-p.nx*wave,p.y-p.ny*wave]);}
      const strand=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');wrap.setAttribute('d',strand);aura.setAttribute('d',strand);aura.style.opacity=String(state.wrap*profile.energy*.36);wrap.style.opacity=String(state.wrap*profile.energy);wrap.style.strokeDashoffset=String(-seconds*14);
      secondary.setAttribute('d',counterpoints.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' '));secondary.style.opacity=String(state.wrap*profile.energy*.56);secondary.style.strokeDashoffset=String(seconds*9);
      tipGlow.setAttribute('cx',tip.x);tipGlow.setAttribute('cy',tip.y);tipGlow.setAttribute('r',String(1.2+state.strength*1.4));tipGlow.style.opacity=String((.28+state.strength*.48)*profile.energy);
      if(phase==='cast'){tipHistory.push({x:tip.x,y:tip.y});if(tipHistory.length>13)tipHistory.shift();}else if(age>450)tipHistory=[];
      trail.setAttribute('d',tipHistory.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' '));trail.style.opacity=String(state.trail*profile.energy);
      burst.setAttribute('cx',point.x);burst.setAttribute('cy',point.y);burst.setAttribute('r',String(3+ease(age/450)*17));burst.style.opacity=String(state.burst*profile.energy);
      drawAction(profile,phase,age,g,tip,point,reduced);
      for(let i=0;i<particles.length;i++){
        const particle=particles[i];if(i>=state.particles){particle.style.opacity='0';continue;}
        let x,y,alpha,size,angle=i*37+seconds*24;
        if(phase==='reeling'&&age<450){const radial=i/state.particles*Math.PI*2,radius=3+ease(age/450)*18;x=point.x+Math.cos(radial)*radius;y=point.y+Math.sin(radial)*radius;alpha=state.burst;size=.7;}
        else if(phase==='reeling'||phase==='cast'){
          const along=(seconds*(phase==='cast'?.8:.5)+i/state.particles)%1,inverse=1-along;
          x=inverse**3*tip.x+3*inverse**2*along*control1.x+3*inverse*along**2*control2.x+along**3*point.x;
          y=inverse**3*tip.y+3*inverse**2*along*control1.y+3*inverse*along**2*control2.y+along**3*point.y;
          alpha=state.strength*Math.sin(along*Math.PI);size=.52+(i%3)*.18;
        }else{
          const along=(seconds*(phase==='charging'?.42:.12)+i/state.particles)%1,orbit=seconds*2+i*1.8,spread=amplitude*(phase==='charging'?1-values.castPower*.55:1);
          const p=around(along);x=p.x+p.nx*Math.sin(orbit)*spread;y=p.y+p.ny*Math.sin(orbit)*spread;
          alpha=state.strength*Math.sin(along*Math.PI);size=.6+(i%3)*.18;
        }
        particle.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${size})`);particle.style.opacity=String(alpha*profile.energy);
      }
    }
    return{draw,destroy(){fluid?.destroy();layer.remove();tipHistory=[];}};
  }
  function create(nodes){
    const stage=nodes.stage,doc=stage.ownerDocument,win=doc.defaultView||globalThis,clock=()=>win.performance.now(),media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let snapshot={},session={},phase='idle',sessionId='',phaseAt=clock(),lastFrame=phaseAt,frame=null,disposed=false,visible=true,previous=null,current=null,launch=null,landingSent=false,from=null,transitionAt=phaseAt,lastBehavior='cruise',rodFlex=null,flexNode=null,angularVelocity=0;
    const spring={bend:0,velocity:0},values={castPower:0,castDistance:.5,nibble:0,stamina:1,holding:0,surgeAmount:0,restAmount:0,barPosition:.5,fishPosition:.5,barSize:.25,progress:0,tension:0},target={...values},waterPoint=nodes.waterPoint||{x:.7,y:.6},effects=createEffects(stage);
    stage.classList.add('has-fishing-motion');
    const summon=nodes.summonOnReveal?RodEffects?.createSummon(stage):null;let summonAt=-Infinity,previewState=null,skipNextEntrance=false;
    function endPreview(){if(!previewState)return;previewState=null;nodes.onPreviewEnd?.();}
    function previewEntrance(now){
      if(!previewState)return null;
      const state=previewState,age=now-state.started;
      if(now<state.holdUntil)return age<state.duration?RodEffects.summonState(state.rod,age,media?.matches):null;
      const progress=(now-state.holdUntil)/(media?.matches?260:1200);
      if(progress>=1){endPreview();return null;}
      const reverse=RodEffects.summonState(state.rod,Math.max(0,state.duration*(state.exitFrom??1)*(1-ease(progress))-.01),media?.matches);
      return reverse&&{...reverse,departing:true};
    }
    function geometry(){
      const box={x:nodes.rod.offsetLeft,y:nodes.rod.offsetTop,width:nodes.rod.offsetWidth,height:nodes.rod.offsetHeight},anchor=rodGeometry(box),g={width:stage.clientWidth,height:stage.clientHeight,box,anchor,grip:{x:box.x+anchor.grip.x,y:box.y+anchor.grip.y},water:{x:stage.clientWidth*waterPoint.x,y:stage.clientHeight*waterPoint.y},baseAngle:nodes.baseAngle||0,launch};
      const distance=phase==='charging'?.15+.85*values.castPower:values.castDistance,world=castWorld(distance),projected=nodes.pond?.getWaterPosition?.(world),rect=stage.getBoundingClientRect?.();
      g.world=world;g.water=projected&&rect?.width&&Number.isFinite(projected.x)&&Number.isFinite(projected.y)?{x:(projected.x-rect.left)*g.width/rect.width,y:(projected.y-rect.top)*g.height/rect.height}:castLanding(distance,g);return g;
    }
    function waterEvent(type,strength=1){const world=castWorld(values.castDistance);nodes.pond?.waterEvent?.({type,...world,strength,at:Date.now()});}
    function set(node,name,value){if(node)node.style[name]=value;}
    function ensureRodFlex(){if(!nodes.createRodFlex)return;const svg=nodes.rod.querySelector?.('.fishing-rod-art');if(svg!==flexNode){rodFlex?.destroy();rodFlex=svg?nodes.createRodFlex(nodes.rod):null;flexNode=svg;}}
    function render(now){
      if(disposed)return;const dt=Math.min(64,Math.max(0,now-lastFrame));lastFrame=now;
      for(const key of Object.keys(values))values[key]=mix(values[key],target[key],1-Math.exp(-dt/65));
      ensureRodFlex();const behavior=['cruise','surge','rest'].includes(session.fishBehavior)?session.fishBehavior:'cruise',visualValues={...values,fishBehavior:behavior,catchKind:snapshot.fish?.kind||nodes.flightFish?.dataset?.catchKind||'fish',fishLoad:clamp((snapshot.fish?.baseLength||32)/55,.45,1.6)*(.85+.35*clamp(snapshot.fish?.difficulty))},g=geometry(),age=Math.max(0,now-phaseAt),next=pose(phase,age,visualValues,g,media?.matches);current={...next};
      if(from){const blend=ease((now-transitionAt)/(phase==='cast'?95:phase==='reeling'?95:190));for(const key of ['angle','x','y','lineAlpha','floatAlpha','sag'])current[key]=mix(from[key],current[key],blend);if(blend>=1)from=null;}
      const speed=previous&&dt>0?(current.angle-previous.angle)*Math.PI/180/(dt/1000):0,acceleration=dt>0?(speed-angularVelocity)/(dt/1000):0;angularVelocity=speed;
      const bendTarget=rodLoad(phase,age,visualValues,g,{x:current.x,y:current.y},current.angle,snapshot.rod,acceleration);stepRodSpring(spring,bendTarget,dt,rodStiffness(snapshot.rod),media?.matches);const bend=rodFlex?spring.bend:0;
      rodFlex?.update({bend});g.curve=along=>rotatedRodPoint(g.box,g.anchor,rodCurvePoint(along,bend,g.anchor),current.angle);const tip=g.curve(1);current.bend=bend;current.bendTarget=bendTarget;previous={...current,tip};
      if(nodes.rod.dataset){nodes.rod.dataset.rodBend=bend.toFixed(5);nodes.rod.dataset.rodTipX=tip.x.toFixed(3);nodes.rod.dataset.rodTipY=tip.y.toFixed(3);}
      set(nodes.rod,'transformOrigin',g.anchor.grip.x+'px '+g.anchor.grip.y+'px');set(nodes.rod,'transform','rotate('+current.angle.toFixed(3)+'deg)');
      const entrance=previewState?previewEntrance(now):summon?RodEffects.summonState(snapshot.rod,now-summonAt,media?.matches):null;
      if(summon){set(nodes.rod,'opacity',String(entrance?Math.pow(entrance.reveal,.55):1));set(nodes.rod,'clipPath',entrance&&!entrance.reduced?(entrance.kind==='void-cleave'?'inset(0 '+((1-entrance.reveal)*49).toFixed(2)+'%)':'inset('+((1-entrance.reveal)*100).toFixed(2)+'% 0 0 0)'):'');summon.draw(snapshot.rod,entrance,{...g,tip});}
      set(nodes.bobber,'left',current.x+'px');set(nodes.bobber,'top',current.y+'px');set(nodes.bobber,'transform','translate(-50%,-50%)');set(nodes.bobber,'opacity',String(current.floatAlpha));
      set(nodes.bite,'left',current.x+'px');set(nodes.bite,'top',(current.y-42)+'px');
      const deltaX=current.x-tip.x,deltaY=current.y-tip.y,tightness=phase==='reeling'?ease(age/120):0,control1={x:tip.x+deltaX*.3,y:mix(tip.y+current.sag,tip.y+deltaY*.3,tightness)},control2={x:current.x-deltaX*.25,y:mix(current.y+current.sag*.4,tip.y+deltaY*.75,tightness)};
      const productCatch=phase==='caught'&&['junk','mystery'].includes(visualValues.catchKind),suppressGoldenBonus=snapshot.rod?.id==='golden'&&productCatch;
      effects?.draw(entrance||suppressGoldenBonus?null:fxProfile(snapshot.rod),phase,age,visualValues,g,tip,{x:current.x,y:current.y},control1,control2,media?.matches);
      nodes.line?.setAttribute('viewBox','0 0 '+g.width+' '+g.height);nodes.path?.setAttribute('d',`M${tip.x.toFixed(2)} ${tip.y.toFixed(2)} C${control1.x.toFixed(2)} ${control1.y.toFixed(2)},${control2.x.toFixed(2)} ${control2.y.toFixed(2)},${current.x.toFixed(2)} ${current.y.toFixed(2)}`);set(nodes.line,'opacity',String(current.lineAlpha));
      if(nodes.flightFish){nodes.flightFish.hidden=current.fishAlpha<.005;set(nodes.flightFish,'left',current.x+'px');set(nodes.flightFish,'top',current.y+'px');set(nodes.flightFish,'opacity',String(current.fishAlpha));set(nodes.flightFish,'transform',`translate(-50%,-50%) rotate(${current.fishAngle}deg) scale(${current.fishScale},${current.fishScale*current.fishSquash})`);}
      if(nodes.catchShadow){const landed=ease((age-(media?.matches?260:470))/260),alpha=phase==='caught'?landed*(1-ease((age-(media?.matches?1600:1910))/320)):0;set(nodes.catchShadow,'left',g.width*.43+'px');set(nodes.catchShadow,'top',g.height*.897+'px');set(nodes.catchShadow,'opacity',String(alpha));set(nodes.catchShadow,'transform','translate(-50%,-50%) scale('+(1.55-.55*landed)+')');}
      if(nodes.result)set(nodes.result,'opacity',phase==='caught'?String(ease((age-2050)/250)):'0');
      if(nodes.power)set(nodes.power,'width',values.castPower*100+'%');if(nodes.progress)set(nodes.progress,'height',values.progress*100+'%');
      if(nodes.stamina)set(nodes.stamina,'width',values.stamina*100+'%');if(nodes.castTarget){nodes.castTarget.hidden=phase!=='charging';set(nodes.castTarget,'left',g.water.x+'px');set(nodes.castTarget,'top',g.water.y+'px');}
      if(nodes.nibbleCue){nodes.nibbleCue.hidden=phase!=='waiting'||values.nibble<.08;set(nodes.nibbleCue,'left',g.water.x+'px');set(nodes.nibbleCue,'top',(g.water.y+21)+'px');}
      nodes.bite?.style.setProperty?.('--bite-time',String(clamp(session.biteRemaining/(session.biteWindow||1700))));
      if(stage.dataset){stage.dataset.fishBehavior=behavior;stage.dataset.nibbling=phase==='waiting'&&values.nibble>.08?'true':'false';}
      const size=clamp(values.barSize,.06,.8),position=clamp(values.barPosition,size/2,1-size/2);set(nodes.target,'height',size*100+'%');set(nodes.target,'bottom',(position-size/2)*100+'%');set(nodes.fish,'bottom',clamp(values.fishPosition)*100+'%');
      if(!landingSent&&phase==='cast'&&age>=600){landingSent=true;waterEvent('cast',.7+values.castPower*.3);}
      nodes.onFrame?.({phase,age,pose:current,tip,values:visualValues});
      if(visible&&!doc.hidden)frame=win.requestAnimationFrame(render);else frame=null;
    }
    function resume(){if(disposed)return;if(doc.hidden)endPreview();if(!visible||doc.hidden){if(frame!==null)win.cancelAnimationFrame(frame);frame=null;return;}if(frame===null){lastFrame=clock();frame=win.requestAnimationFrame(render);}}
    function update(next){
      if(disposed)return;const oldNibble=target.nibble,oldBehavior=lastBehavior;snapshot=next||{};session=snapshot.session||{};lastBehavior=session.fishBehavior||'cruise';const nextPhase=session.phase||'idle',nextId=session.id||snapshot.sessionId||'',now=clock();
      if(previewState&&(snapshot.rod?.id!==previewState.rod.id||!['idle','caught','escaped'].includes(nextPhase)))endPreview();
      for(const key of Object.keys(target))if(session[key]!==undefined)target[key]=clamp(session[key]);
      target.surgeAmount=session.fishBehavior==='surge'?1:0;target.restAmount=session.fishBehavior==='rest'?1:0;
      if(nextId!==sessionId){target.nibble=clamp(session.nibble);target.stamina=session.stamina===undefined?1:clamp(session.stamina);}
      if(session.castDistance!==undefined&&nextPhase!=='charging')values.castDistance=target.castDistance;
      if(stage.dataset){stage.dataset.rodId=snapshot.rod?.id||'bamboo';stage.dataset.rodTier=snapshot.rod?.rarity||'common';}
      if(nextPhase!==phase||nextId!==sessionId){
        if(summon&&nextPhase==='charging'&&['idle','caught','escaped'].includes(phase)){summonAt=skipNextEntrance?-Infinity:now;skipNextEntrance=false;}
        else if(['idle','caught','escaped'].includes(nextPhase))summonAt=-Infinity;
        const oldPhase=phase;from=previous&&{...previous};transitionAt=now;phaseAt=now;phase=nextPhase;sessionId=nextId;
        if(phase==='cast'){const g=geometry();launch=previous?.tip||rotatedTip(g.box,g.anchor,g.baseAngle);landingSent=false;}
        else if(phase==='waiting'&&oldPhase==='cast'&&!landingSent){landingSent=true;waterEvent('cast',.8);}
        else if(phase==='bite')waterEvent('bite',.45);else if(phase==='reeling')waterEvent('hook',.7);else if(phase==='caught')waterEvent('catch',1);else if(phase==='escaped')waterEvent('escape',.35);
      }
      if(nextPhase==='waiting'&&target.nibble>.15&&oldNibble<=.15)waterEvent('nibble',.16);
      if(nextPhase==='reeling'&&session.fishBehavior==='surge'&&oldBehavior!=='surge')waterEvent('surge',.32);
      resume();
    }
    const observer=typeof win.IntersectionObserver==='function'?new win.IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;resume();}):null;observer?.observe(stage);doc.addEventListener('visibilitychange',resume);media?.addEventListener?.('change',resume);resume();
    return{update,engagePreview(){if(!previewState||clock()<previewState.started+previewState.duration||clock()>=previewState.holdUntil)return false;previewState=null;skipNextEntrance=true;return true;},preview(skipEntrance=false){if(!summon||!snapshot.rod||!['idle','caught','escaped'].includes(phase))return false;const now=clock(),state=RodEffects.summonState(snapshot.rod,0,media?.matches),scene=RodEffects.summonScene(snapshot.rod.id),duration=media?.matches?260:scene?.duration||({common:440,rare:680,epic:940,legendary:1200}[state.tier]);previewState={rod:snapshot.rod,started:skipEntrance?now-duration:now,duration,holdUntil:now+(skipEntrance?0:duration)+5000};summonAt=-Infinity;resume();return true;},touchPreview(){if(previewState&&clock()<previewState.holdUntil)previewState.holdUntil=Math.max(previewState.started+previewState.duration,clock())+5000;},dismissPreview(){if(previewState&&clock()<previewState.holdUntil){previewState.exitFrom=Math.min(1,(clock()-previewState.started)/previewState.duration);previewState.holdUntil=clock();}},destroy(){if(disposed)return;disposed=true;previewState=null;if(frame!==null)win.cancelAnimationFrame(frame);rodFlex?.destroy();rodFlex=null;effects?.destroy();summon?.destroy();if(summon){set(nodes.rod,'opacity','');set(nodes.rod,'clipPath','');}observer?.disconnect();doc.removeEventListener('visibilitychange',resume);media?.removeEventListener?.('change',resume);stage.classList.remove('has-fishing-motion');}};
  }
  return Object.freeze({create,pose,castWorld,castLanding,rodGeometry,rodCurvePoint,rodStiffness,rodLoad,stepRodSpring,rotatedRodPoint,rotatedTip,fxProfile,effectShape,effectState,actionEffectState,actionEffectGeometry,catalogEffectsMarkup,tornadoGeometry});
});
