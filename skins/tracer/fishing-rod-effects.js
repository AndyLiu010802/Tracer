(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingRodEffects=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,Number(n)||0)),mix=(a,b,t)=>a+(b-a)*t,ease=n=>{n=clamp(n);return n*n*(3-2*n);},f=n=>Number(n).toFixed(3);
  const designs=Object.freeze({
    golden:{theme:'sovereign',frequency:.65,speed:.3,spread:.16,colors:['#be7918','#ffd45e','#fff4c5']},
    moon:{theme:'lunar',frequency:2.4,speed:.48,spread:1.2,colors:['#8c73d4','#cfbeff','#fff5e8']},
    phoenix:{theme:'phoenix',frequency:4.5,speed:1.6,spread:1,colors:['#d94324','#ffae43','#fff2b8']},
    cloud:{theme:'tornado',frequency:2.7,speed:1.05,spread:1.5,colors:['#5c94a9','#b7e4ee','#f1ffff']},
    astral:{theme:'astral',frequency:3.2,speed:.9,spread:1.25,colors:['#6661cd','#b2a0ef','#ffe8b4']},
    dragon:{theme:'thunder',frequency:6.7,speed:1.8,spread:1.1,colors:['#b9782f','#efbd63','#ffffd3']},
    lotus:{theme:'lotus',frequency:2.1,speed:.45,spread:1.4,colors:['#a85e91','#e49bbc','#fff2d7']},
    guandao:{theme:'dragon',frequency:2.8,speed:.8,spread:1.5,colors:['#248875','#6bd7af','#efffc9']},
    katana:{theme:'blade',frequency:1.1,speed:2.5,spread:.28,colors:['#7a9fcd','#d5e7ff','#fffafc']}
  });
  const design=id=>Object.prototype.hasOwnProperty.call(designs,id)?designs[id]:null;
  function sample(fn,width=.02,alpha=1,color=0,count=72){
    return {alpha,color,points:Array.from({length:count+1},(_,i)=>{const u=i/count,p=fn(u);return{...p,x:p.x,y:p.y,w:typeof width==='function'?width(u):width*Math.sin(Math.PI*u)**.8};})};
  }
  function tornadoPose(state={},seconds=0){
    const p=state.reduced?.42:clamp(state.progress),phase=state.phase||'summon',time=state.reduced?0:Number(seconds)||0;
    const rise=phase==='summon'?ease(p/.34):phase==='reeling'?Math.sin(p*Math.PI):ease(p/.32);
    return{rise,spin:time*1.55+p*TAU*1.08,radius:phase==='reeling'?.86:phase==='cast'?.64:.82,
      height:phase==='reeling'?.32+rise*.48:phase==='cast'?1.12:phase==='caught'?1.16+rise*.48:.18+rise*1.56,
      root:phase==='reeling'?.22:phase==='caught'?.73-ease(p)*.18:.77,
      bend:Math.sin(time*.47+p*3.1)*.095,turns:phase==='reeling'?2.2:2.75,
      gather:phase==='summon'&&!state.reduced?clamp(state.gather):0};
  }
  function tornadoPoint(height,angle,pose){
    const h=clamp(height),radius=(.037+pose.radius*Math.pow(h,.78))*(.84+.16*pose.rise),z=Math.sin(angle)*radius,perspective=1/(1-z*.16);
    return{x:(Math.cos(angle)*radius+Math.sin(h*Math.PI*.9)*pose.bend)*perspective,y:pose.root-h*pose.height+z*.24,z,h};
  }
  function tornadoField(seconds=0,progress=.4,state={}){
    const pose=tornadoPose({...state,progress},seconds),strands=[];
    // Each sheet climbs continuously from the same narrow root to a broad
    // mouth. There are no stacked rings or separate cloud sprites.
    for(let k=0;k<7;k++)strands.push(sample(u=>tornadoPoint(u,u*TAU*pose.turns-pose.spin+k*2.399,pose),u=>Math.sin(u*Math.PI)**.72*(k<4?.019+.035*u:.005+.008*u),k<4?.74-k*.08:.32,k<4?k%2:2,96));
    return strands;
  }
  function paintTornado(ctx,state,position,colors,geometry=null,seconds=0){
    const p=state.reduced?.42:clamp(state.progress),q=tornadoPose(state,seconds),size=position.size,turn=Number(position.rotation)||0,ct=Math.cos(turn),st=Math.sin(turn),alpha=state.alpha;
    const place=point=>{
      const x=position.x+(point.x*ct-point.y*st)*size,y=position.y+(point.x*st+point.y*ct)*size;
      if(!geometry?.curve||!q.gather)return{...point,x,y,w:point.w*size};
      const along=.055+point.h*.91,target=geometry.curve(along),before=geometry.curve(Math.max(0,along-.012)),after=geometry.curve(Math.min(1,along+.012)),length=Math.hypot(after.x-before.x,after.y-before.y)||1;
      return{...point,x:mix(x,target.x-(after.y-before.y)/length*point.x*2.1,q.gather),y:mix(y,target.y+(after.x-before.x)/length*point.x*2.1,q.gather),w:point.w*size*(1-q.gather*.95)};
    };
    const sheets=tornadoField(state.reduced?0:seconds,p,state),parts={back:[],front:[]};
    for(const sheet of sheets){let previous=null,run=[],front=false;for(const point of sheet.points){const near=point.z>=0;if(previous&&near!==front){const fraction=Math.abs(previous.z)/(Math.abs(previous.z)+Math.abs(point.z)),cross={...point,x:mix(previous.x,point.x,fraction),y:mix(previous.y,point.y,fraction),z:0,h:mix(previous.h,point.h,fraction),w:mix(previous.w,point.w,fraction)};run.push(place(cross));if(run.length>1)parts[front?'front':'back'].push({...sheet,points:run});run=[place(cross)];}run.push(place(point));front=near;previous=point;}if(run.length>1)parts[front?'front':'back'].push({...sheet,points:run});}
    ctx.save();
    for(const strand of parts.back)paint(ctx,strand,colors,alpha*.36);
    // A continuous, softly lit air volume joins the wisps. Its reflected silver
    // flank and translucent centre give the rotating ribbons an actual depth.
    for(let layer=3;layer>=0;layer--){
      const boundary=[],spread=1+layer*.065;
      for(const side of[-1,1])for(let i=0;i<=64;i++){const h=side<0?i/64:1-i/64,pt=tornadoPoint(h,side<0?Math.PI:0,q),pulse=1+.028*Math.sin(h*19-q.spin);boundary.push(place({...pt,x:pt.x*spread*pulse,w:0}));}
      const xs=boundary.map(point=>point.x),ys=boundary.map(point=>point.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),density=ctx.createLinearGradient(left,top,right+.01,bottom*.14+top*.86);
      density.addColorStop(0,rgba(colors[0],0));density.addColorStop(.16,rgba(colors[1],.045));density.addColorStop(.33,rgba(colors[2],.15));density.addColorStop(.62,rgba(colors[1],.055));density.addColorStop(.87,rgba(colors[2],.08));density.addColorStop(1,rgba(colors[0],0));ctx.fillStyle=density;ctx.globalAlpha=alpha*(1-layer*.15);trace(ctx,boundary,true);ctx.fill();
    }
    for(const strand of parts.front)paint(ctx,strand,colors,alpha*.93);
    // Fast, tapering highlights climb with the air. Their depth selects the
    // front light or back shade rather than scattering unrelated glitter.
    if(!state.reduced)for(let k=0;k<12;k++){
      const h=.10+((k*.071+seconds*.11+p*.35)%.80),a=h*TAU*q.turns-q.spin+k*.74,head=tornadoPoint(h,a,q),tail=tornadoPoint(Math.max(0,h-.028),a-.16,q),first=place(head),last=place(tail);
      ctx.globalAlpha=alpha*(head.z>=0?.32:.10)*Math.sin(h*Math.PI);ctx.strokeStyle=colors[2];ctx.lineWidth=Math.max(.35,size*.006*(1-q.gather*.85));trace(ctx,[last,first]);ctx.stroke();
    }
    ctx.restore();
  }
  // Continuous fields, not articulated icons. Every ribbon uses the local normal
  // of one moving centreline, with feathered widths and no separate body pieces.
  function flow(id,seconds=0,progress=.4){
    if(!design(id))return[];
    const t=Number(seconds)||0,p=clamp(progress),strands=[];
    if(id==='golden'){
      strands.push(sample(u=>{const a=u*4.6+t*.16,r=.48+u*.25;return{x:Math.cos(a)*r,y:Math.sin(a)*r*.2+.3};},.012,.32,1));
    }else if(id==='moon'){
      for(let k=0;k<4;k++)strands.push(sample(u=>{const a=2.3+u*4.9+t*.13,r=.68+k*.075+Math.sin(u*TAU-t)*.017;return{x:Math.cos(a)*r,y:Math.sin(a)*r*.78};},.052-k*.009,1-k*.17,k%2));
      strands.push(sample(u=>({x:mix(-1.04,1.02,u),y:.24+Math.sin(u*4.1-t*.3)*.2}),.021,.6,1));
    }else if(id==='phoenix'){
      for(const side of [-1,1])for(let k=0;k<5;k++)strands.push(sample(u=>{const right=side>0,reach=(right?1.02:.82)-k*.105,branch=ease((u-.17)/.83),root=.08-Math.sin(u*3.7+t*.8)*.13,flame=Math.sin(u*9-t*2.7+k*.45)*u*u*.08;return{x:root+side*(reach*branch+flame),y:.62-u*((right?1.46:1.04)-k*.047)-Math.sin(u*Math.PI)*.19+Math.sin(t*1.8+u*5+k*.4)*u*u*.056};},u=>.072*Math.sin(Math.PI*u)**1.18*(1-k*.1),1-k*.11,k%2));
      for(let k=0;k<3;k++)strands.push(sample(u=>({x:.08+Math.sin(u*5.4-t*1.5+k*.48)*u*.18,y:.53+u*.51}),.022,.6,1));
    }else if(id==='cloud'){
      strands.push(...tornadoField(t,p));
    }else if(id==='astral'){
      for(let k=0;k<4;k++)strands.push(sample(u=>{const a=u*5.8+k*1.62-t*.33,r=.1+u*.94;return{x:Math.cos(a)*r,y:Math.sin(a)*r*.61};},.036,1-k*.08,k%2));
      strands.push(sample(u=>{const a=u*5.3+t*.16;return{x:Math.cos(a)*.86,y:Math.sin(a)*.32};},.014,.75,2));
    }else if(id==='dragon'){
      for(let k=0;k<3;k++)strands.push(sample(u=>{const a=3.6+u*5.3-t*.42,r=.58+u*.28+k*.06;return{x:Math.cos(a)*r,y:Math.sin(a)*r*.63};},.048-k*.012,.9,k%2));
      for(let k=0;k<5;k++)strands.push(sample(u=>{const a=k*1.23+t*.11,r=.23+u*.76,jag=(Math.sin(u*33+k*4)+Math.sin(u*71+t*7)*.3)*.032*Math.sin(u*Math.PI);return{x:Math.cos(a)*r-Math.sin(a)*jag,y:Math.sin(a)*r*.73+Math.cos(a)*jag};},.009,.78,2,88));
    }else if(id==='lotus'){
      const opening=.62+.38*ease(p/.6);
      for(let k=0;k<7;k++)strands.push(sample(u=>{const a=(k-3)*.39,petal=Math.sin(u*Math.PI),r=petal*(.65+Math.cos(a)*.2)*opening;return{x:Math.sin(a)*r+Math.sin(u*TAU)*.13*Math.cos(a),y:.43-Math.cos(a)*r+Math.sin(t*.55+k*.5)*.018*petal};},.034,k===3?1:.65,k%2));
      for(let k=0;k<2;k++)strands.push(sample(u=>{const a=u*TAU-.5;return{x:Math.cos(a)*(.76+k*.17),y:.48+Math.sin(a)*(.15+k*.035)};},.018,.5,1));
    }else if(id==='guandao'){
      const segments=[[[-.95,.61],[-.17,.7],[.85,.36],[.28,.1]],[[.28,.1],[-.44,-.12],[-.68,-.15],[-.26,-.4]],[[-.26,-.4],[.12,-.65],[.13,-.68],[.52,-.62]]];
      const spine=u=>{const j=Math.min(2,Math.floor(u*3)),v=u*3-j,a=1-v,s=segments[j];return{x:a**3*s[0][0]+3*a*a*v*s[1][0]+3*a*v*v*s[2][0]+v**3*s[3][0]+Math.sin(u*8-t*1.4)*.035*Math.sin(u*Math.PI),y:a**3*s[0][1]+3*a*a*v*s[1][1]+3*a*v*v*s[2][1]+v**3*s[3][1]+Math.sin(u*6-t*1.1)*.035*Math.sin(u*Math.PI)};};
      strands.push(sample(spine,u=>Math.sin(Math.PI*u)**.45*(.003+.075*ease(u/.64)+.038*Math.exp(-(((u-.92)/.065)**2))),1,1,108));
      for(let k=0;k<2;k++)strands.push(sample(u=>{const s=spine(u);return{x:s.x+Math.sin(u*13-t*2+k)*.035*Math.sin(Math.PI*u),y:s.y+(k?1:-1)*.046+Math.sin(u*7+t+k)*.016};},.019,.4,0));
      const head=spine(.94),prior=spine(.92),a=Math.atan2(head.y-prior.y,head.x-prior.x),tx=Math.cos(a),ty=Math.sin(a);
      for(const side of [-1,1])for(let k=0;k<2;k++)strands.push(sample(u=>{const x=-u*(.2+k*.15),y=side*Math.sin(u*2.8)*(.15+k*.12);return{x:head.x+tx*x-ty*y,y:head.y+ty*x+tx*y};},u=>.019*(1-u)**1.5,.7,k?0:2,40));
      for(let k=0;k<2;k++){const root=spine(.83+k*.055);strands.push(sample(u=>({x:root.x-u*.06-Math.sin(u*2)*.045,y:root.y-u*(.22-k*.05)}),u=>.024*(1-u),.8,1,32));}
    }else if(id==='katana'){
      const cut=ease(p/.2);
      strands.push(sample(u=>{const a=2.94-u*3.0*cut;return{x:Math.cos(a)*1.05,y:-Math.sin(a)*.28-.27*Math.cos(a)};},u=>.027*Math.sin(u*Math.PI)**1.8,1,2));
      strands.push(sample(u=>{const a=2.85-u*2.9*cut;return{x:Math.cos(a)*.98,y:-Math.sin(a)*.33-.25*Math.cos(a)+.026};},.013,.65,1));
      for(let k=0;k<3;k++)strands.push(sample(u=>({x:mix(-.7,.65,u),y:.28+Math.sin(u*4.5+k+t*.7)*.09+k*.07}),.009,.25,0));
    }
    return strands;
  }
  function eventState(id,phase,age,reduced=false){
    if(!design(id)||!['cast','reeling','caught'].includes(phase))return null;
    const caught=phase==='caught',start=caught?680:phase==='cast'?30:0,duration=caught?1260:phase==='cast'?640:760,p=(Math.max(0,Number(age)||0)-start)/duration;
    if(p<0||p>=1)return null;
    return{progress:p,alpha:ease(p/.12)*(1-ease((p-.5)/.5))*(reduced?.18:1),reduced,phase};
  }
  function layout(id,state,g,tip,point){
    const p=state.reduced?.45:state.progress,caught=state.phase==='caught',size=Math.max(18,Math.min(g.width*(caught?.23:.16),g.height*(caught?.3:.23),caught?113:79));
    let x=point.x,y=point.y-size*.82;
    if(!caught){const u=ease(p);x=mix(tip.x,point.x,u);y=mix(tip.y,point.y,u)-Math.sin(u*Math.PI)*size*.3;}
    if(id==='cloud'&&state.phase==='reeling'){x=point.x;y=point.y-size*.22;}
    x=Math.max(size,Math.min(g.width-size-42,x));y=Math.max(size,Math.min(g.height-size*.8,y));
    return{x,y,size,rotation:id==='cloud'&&state.phase==='cast'?Math.atan2(point.y-tip.y,point.x-tip.x)+Math.PI/2:0,transform:'translate('+f(x)+' '+f(y)+') scale('+f(size/100)+')'};
  }
  // Articulation and travel have their own timelines. Opacity only trims the
  // ends; the readable part is a physical action, with anticipation and follow-through.
  function themePose(id,state){
    const p=state.reduced?.42:clamp(state.progress),lift=ease((p-.08)/.38),finish=ease((p-.58)/.42),breath=Math.sin(p*Math.PI),turn=p*TAU;
    const pose={x:0,y:0,rotation:0,scale:1,orbit:0,wing:0,opening:0,draw:0,fold:finish,travel:lift};
    if(id==='moon'){pose.orbit=turn*.56;pose.rotation=-.2+.38*lift;pose.opening=.16+.77*lift;pose.y=-.12*breath;}
    else if(id==='phoenix'){pose.wing=Math.sin((p*2.4-.2)*TAU)*(.68-.2*finish);pose.rotation=-.16+.33*lift-.22*finish;pose.y=-.12*breath;pose.opening=.48+.52*lift;}
    else if(id==='cloud'){const vortex=tornadoPose(state);pose.orbit=vortex.spin;pose.opening=vortex.rise;pose.y=-.11*breath;pose.rotation=Math.sin(turn*.65)*.055;pose.draw=finish;}
    else if(id==='astral'){pose.orbit=turn*.74;pose.rotation=-.32+.5*lift;pose.opening=.45+.55*lift;pose.y=-.07*breath;}
    else if(id==='dragon'||id==='guandao'){pose.orbit=turn*(id==='guandao'?.8:1.15);pose.rotation=Math.sin(p*TAU)*.17;pose.x=Math.sin(p*TAU)*.09;pose.y=-.1*breath;pose.draw=ease((p-.22)/.38);pose.opening=.55+.45*lift;}
    else if(id==='lotus'){pose.opening=ease((p-.04)/.53)*(1-finish*.5);pose.rotation=.07*Math.sin(turn*.6);pose.y=-.1*lift;pose.orbit=turn*.12;}
    else if(id==='katana'){pose.opening=Math.sin(Math.PI*ease(p));pose.draw=ease((p-.25)/.27);pose.rotation=-.2;pose.x=.16*(pose.draw-finish);}
    else if(id==='golden'){pose.opening=lift*(1-finish*.3);pose.rotation=.025*Math.sin(turn);pose.y=-.13*lift;pose.orbit=turn*.25;}
    return pose;
  }
  function orbitalPoint(angle,tilt,rotation,radius=1){
    const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius*Math.cos(tilt),z=Math.sin(angle)*radius*Math.sin(tilt),c=Math.cos(rotation),s=Math.sin(rotation),perspective=1/(1+z*.16);
    return{x:(x*c-y*s)*perspective,y:(x*s+y*c)*perspective,z};
  }
  function paintThemeAction(ctx,id,state,position,colors){
    if(id==='cloud'){paintTornado(ctx,state,position,colors,null,state.reduced?0:state.progress*1.2);return;}
    const q=themePose(id,state),p=state.reduced?.42:clamp(state.progress),size=position.size;
    ctx.save();ctx.translate(position.x+q.x*size,position.y+q.y*size);ctx.rotate(q.rotation);ctx.scale(size,size);ctx.globalAlpha=state.alpha;
    const stroke=(points,width=.012,color=colors[1],alpha=1)=>{ctx.globalAlpha=state.alpha*alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';trace(ctx,points);ctx.stroke();};
    const curve=(fn,count=72)=>Array.from({length:count+1},(_,i)=>fn(i/count));
    const ring=(radius,tilt,turn,phase=0)=>{
      const points=curve(u=>orbitalPoint(u*TAU+phase,tilt,turn,radius));
      for(const front of [false,true]){let part=[];for(const pt of points){if((pt.z<=0)===front)part.push(pt);else if(part.length){stroke(part,front?.012:.008,colors[front?2:0],front?.8:.32);part=[];}}if(part.length)stroke(part,front?.012:.008,colors[front?2:0],front?.8:.32);}
      const satellite=orbitalPoint(q.orbit+phase,tilt,turn,radius);ctx.globalAlpha=state.alpha*.9;ctx.fillStyle=colors[2];ctx.beginPath();ctx.arc(satellite.x,satellite.y,.027*(1-satellite.z*.14),0,TAU);ctx.fill();
    };
    if(id==='moon'){
      const r=.44,moon=ctx.createRadialGradient(-.15,-.14,.01,0,0,r);moon.addColorStop(0,'#fff7ee');moon.addColorStop(.52,'#d4c7ed');moon.addColorStop(1,'#776896');ctx.fillStyle=moon;ctx.globalAlpha=state.alpha*.72;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
      ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.clip();
      // A curved moving terminator makes a waxing moon, rather than a flat icon.
      const terminator=.72-q.opening*1.32;ctx.fillStyle='#302b4f';ctx.globalAlpha=state.alpha*.82;ctx.beginPath();ctx.moveTo(0,-r);ctx.bezierCurveTo(r*terminator,-r*.8,r*terminator,r*.8,0,r);ctx.arc(0,0,r,Math.PI/2,-Math.PI/2,true);ctx.fill();
      for(let i=0;i<25;i++){const a=i*2.399,rr=Math.sqrt((i+.5)/25)*r;ctx.globalAlpha=state.alpha*.1;ctx.strokeStyle=colors[0];ctx.lineWidth=.008;ctx.beginPath();ctx.ellipse(Math.cos(a)*rr,Math.sin(a)*rr,.012+(i%3)*.014,.014+(i%3)*.012,-.35,0,TAU);ctx.stroke();}ctx.restore();
      ring(.59,.97,q.orbit*.4-.35);ring(.75,1.13,-q.orbit*.24+.35,1.4);
      for(let k=0;k<2;k++)stroke(curve(u=>({x:-.85+u*1.7,y:.33+Math.sin(u*TAU-q.orbit+k*.7)*.13+k*.055})),.014,colors[k],.48);
    }else if(id==='phoenix'){
      for(let k=0;k<3;k++){
        const travel=state.reduced?.4:ease(clamp((p-k*.075)/.68)),bend=Math.sin(travel*Math.PI)*.16;ctx.save();ctx.translate(-.28+k*.24+travel*.2,.28-travel*.61+k*.08);ctx.rotate(-.5+travel*.9+(k-1)*.3);
        const feather=ctx.createLinearGradient(-.1,.2,.07,-.43);feather.addColorStop(0,'#aa341100');feather.addColorStop(.34,colors[0]);feather.addColorStop(.78,colors[1]);feather.addColorStop(1,colors[2]);ctx.fillStyle=feather;ctx.globalAlpha=state.alpha*(.62-k*.1);ctx.beginPath();ctx.moveTo(0,.25);ctx.bezierCurveTo(-.13,.03,-.1+bend,-.32,bend,-.46);ctx.bezierCurveTo(.14+bend,-.27,.16,.08,0,.25);ctx.fill();stroke(curve(u=>({x:bend*u*u,y:.25-u*.7}),32),.009,colors[2],.85);for(const side of [-1,1])for(let i=1;i<8;i++)stroke(curve(u=>({x:bend*(i/9)**2+side*Math.sin(u*Math.PI*.6)*.075*(1-i/10),y:.22-i*.069-u*.049}),12),.004,colors[2],.32);ctx.restore();
      }
    }else if(id==='astral'){
      const core=ctx.createRadialGradient(0,0,0,0,0,.23);core.addColorStop(0,'#fff1c8');core.addColorStop(.18,'#ddc3efb0');core.addColorStop(.6,'#9385d333');core.addColorStop(1,'#9385d300');ctx.fillStyle=core;ctx.globalAlpha=state.alpha;ctx.fillRect(-.24,-.24,.48,.48);
      for(let k=0;k<3;k++)ring((.45+k*.12)*q.opening,.75+k*.25,Math.PI*k/3+q.orbit*(k%2?-.27:.23),k*2.1);
      for(let i=0;i<12;i++){const v=orbitalPoint(i/12*TAU,1.07,-.28+q.orbit*.23,.81*q.opening),n=orbitalPoint(i/12*TAU,1.07,-.28+q.orbit*.23,.86*q.opening);stroke([v,n],.009,colors[2],.6);}
      const a=q.orbit;stroke([{x:-Math.cos(a)*.15,y:-Math.sin(a)*.15},{x:Math.cos(a)*.24,y:Math.sin(a)*.24}],.012,colors[2],.8);
    }else if(id==='lotus'){
      // Back petals open first; inner petals lag and retain a cupped volume.
      for(let row=0;row<3;row++)for(let i=0;i<7;i++){
        const opening=state.reduced?.64:ease((p-.04-row*.055)/.39)*(1-ease((p-.71)/.29)*.5),a=(i-3)*(.39-row*.07)*opening,h=.68-row*.12,w=(.18-row*.028)*(.22+.78*opening);ctx.save();ctx.translate(0,.34-row*.035);ctx.rotate(a);ctx.scale(1,1+.08*Math.sin(a));
        const petal=ctx.createLinearGradient(-w,.03,w,-h);petal.addColorStop(0,colors[0]);petal.addColorStop(.27,'#ad779eb0');petal.addColorStop(.72,'#f5cedce0');petal.addColorStop(1,'#fff7e4');ctx.globalAlpha=state.alpha*(.44+row*.15);ctx.fillStyle=petal;ctx.beginPath();ctx.moveTo(0,.035);ctx.bezierCurveTo(-w,-h*.17,-w*.93,-h*.73,0,-h);ctx.bezierCurveTo(w*.93,-h*.7,w,-h*.13,0,.035);ctx.fill();
        stroke(curve(u=>({x:Math.sin(u*Math.PI)*w*.09,y:-u*h}),24),.006,colors[2],.48);for(const side of [-1,1])for(let vein=1;vein<4;vein++)stroke(curve(u=>({x:side*Math.sin(u*Math.PI)*w*(vein/5),y:-h*(u*.68+vein*.035)}),24),.003,colors[2],.2);ctx.restore();
      }
      for(let k=0;k<3;k++)stroke(curve(u=>({x:Math.cos(u*TAU)*(.44+p*.18+k*.13),y:.4+Math.sin(u*TAU)*(.07+k*.018)})),.007,colors[1],.35-k*.08);
    }else if(id==='katana'||id==='guandao'){
      const cut=q.draw,blade=id==='katana',rotation=blade?-.34:-.17;ctx.rotate(rotation);
      if(blade&&p<.72){const aperture=q.opening*.055*(1-ease((p-.48)/.24));ctx.globalAlpha=state.alpha*.9;ctx.fillStyle='#090b20';ctx.beginPath();ctx.moveTo(-.85,-.06);ctx.bezierCurveTo(-.3,-aperture-.07,.28,-aperture+.06,.87,.04);ctx.bezierCurveTo(.24,aperture+.08,-.3,aperture-.03,-.85,-.06);ctx.fill();for(const side of [-1,1])stroke(curve(u=>({x:-.85+u*1.72,y:(u-.5)*.1+side*Math.sin(u*Math.PI)*aperture})),.01,colors[side===1?2:0],.85);}
      if(cut>0){for(let k=0;k<(blade?2:3);k++){const start=3.08+k*.06,end=mix(start,-.17,cut),points=curve(u=>{const a=mix(start,end,u),r=.82+k*.045;return{x:Math.cos(a)*r,y:-Math.sin(a)*(.29+k*.026)};});stroke(points,blade?(k?.012:.025):.028-k*.007,colors[k%3],(1-k*.2)*(1-ease((p-.78)/.22)));}const a=mix(3.08,-.17,cut),head={x:Math.cos(a)*.87,y:-Math.sin(a)*.31};stroke([{x:head.x-.07,y:head.y-.06},{x:head.x+.035,y:head.y+.015}],.016,colors[2],1-ease((p-.72)/.28));}
      if(!blade)for(const side of [-1,1])stroke(curve(u=>({x:(u-.5)*1.7,y:.31+side*Math.sin(u*Math.PI)*.12*(.3+cut)+Math.sin(u*9-p*8)*.025})),.01,colors[1],.5*(1-p));
    }
    ctx.restore();
  }
  function envelope(points,scale=1){
    const left=[],right=[];
    for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;left.push({x:p.x+nx*p.w*scale,y:p.y+ny*p.w*scale});right.push({x:p.x-nx*p.w*scale,y:p.y-ny*p.w*scale});}
    return left.concat(right.reverse());
  }
  function trace(ctx,points,close=false){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(close)ctx.closePath();}
  function rgba(hex,alpha){const v=parseInt(hex.slice(1),16);return 'rgba('+[(v>>16)&255,(v>>8)&255,v&255,alpha].join(',')+')';}
  function paint(ctx,strand,colors,opacity=1){
    const points=strand.points;if(points.length<2)return;
    let start=points[0],end=points[points.length-1];const a=opacity*strand.alpha,c=colors[strand.color%3];
    if(a<.004)return;
    // Closed petals and rings share their end point. A degenerate longitudinal
    // gradient would make their entire surface transparent, leaving only wire.
    if(Math.hypot(end.x-start.x,end.y-start.y)<2){start={x:Math.min(...points.map(p=>p.x)),y:Math.max(...points.map(p=>p.y))};end={x:Math.max(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y))};}
    const gradient=ctx.createLinearGradient(start.x,start.y,end.x+.01,end.y+.01);gradient.addColorStop(0,rgba(c,0));gradient.addColorStop(.23,rgba(c,.68));gradient.addColorStop(.65,rgba(c,.9));gradient.addColorStop(1,rgba(colors[2],0));
    // Integrate a Gaussian density across the surface. Small alpha increments
    // remove concentric hard bands; calculate the curve normals only once.
    const edges=envelope(points),base=points.concat([...points].reverse());ctx.fillStyle=gradient;
    for(let layer=16;layer>=1;layer--){const width=layer/5,outer=.82*Math.exp(-Math.pow((width+.2)/1.1,2)),inner=.82*Math.exp(-Math.pow(width/1.1,2));ctx.globalAlpha=a*(inner-outer)/(1-outer);ctx.beginPath();for(let i=0;i<edges.length;i++){const x=base[i].x+(edges[i].x-base[i].x)*width,y=base[i].y+(edges[i].y-base[i].y)*width;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();}
    ctx.globalAlpha=a*.18;ctx.strokeStyle=colors[2];ctx.lineWidth=.35;ctx.lineCap='round';ctx.lineJoin='round';trace(ctx,points.slice(4,-5));ctx.stroke();
  }
  function transform(strand,x,y,size){return{...strand,points:strand.points.map(p=>({x:x+p.x*size,y:y+p.y*size,w:p.w*size}))};}
  const SUMMON_TIERS=Object.freeze({common:{duration:440,reveal:160,strength:.3},rare:{duration:680,reveal:210,strength:.55},epic:{duration:940,reveal:260,strength:.8},legendary:{duration:1200,reveal:310,strength:1}});
  const SUMMON_SCENES=Object.freeze({moon:{duration:2400,kind:'lunar-eclipse'},phoenix:{duration:3200,kind:'phoenix-wings',art:'summon-phoenix-v1.png'},cloud:{duration:2600,kind:'wind-vortex'},astral:{duration:2800,kind:'stellar-forge'},dragon:{duration:3200,kind:'thunder-dragon',art:'summon-azure-dragon-v1.png'},lotus:{duration:2700,kind:'lotus-bloom'},guandao:{duration:3400,kind:'azure-transformation',art:'summon-azure-dragon-v1.png'},katana:{duration:2400,kind:'void-cleave'},golden:{duration:3200,kind:'caishen',art:'golden-caishen-v1.png'}});
  const summonScene=id=>Object.prototype.hasOwnProperty.call(SUMMON_SCENES,id)?SUMMON_SCENES[id]:null;
  function summonState(rod,age,reduced=false){
    if(!Number.isFinite(age)||age<0)return null;
    const tier=Object.prototype.hasOwnProperty.call(SUMMON_TIERS,rod?.rarity)?rod.rarity:'common',config=SUMMON_TIERS[tier],scene=summonScene(rod?.id),duration=reduced?260:scene?.duration||config.duration;
    if(age>=duration)return null;
    const progress=age/duration;
    const gather=reduced?1:ease((progress-.48)/.38),reveal=reduced?ease(age/140):scene?ease((progress-.66)/.27):ease(age/config.reveal);
    return{tier,kind:scene?.kind||tier,progress,reduced,reveal,gather,stage:progress<.18?'manifest':progress<.48?'awaken':progress<.86?'transform':'settle',alpha:ease(progress/.14)*(1-ease((progress-.87)/.13))*config.strength*(reduced?.18:1)};
  }

  function summonField(rod,state,g){
    const p=state.reduced?.42:state.progress,spine=g.curve||((u)=>({x:mix(g.grip.x,g.tip.x,u),y:mix(g.grip.y,g.tip.y,u)})),tier=state.tier;
    // A soft highlight travels along the actual bent shaft, with a continuous
    // helical wake for rarer rods. No image tiles or detached geometric pieces.
    const around=(u,offset)=>{const a=spine(Math.max(0,u-.01)),b=spine(Math.min(1,u+.01)),v=spine(u),length=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:v.x-(b.y-a.y)/length*offset,y:v.y+(b.x-a.x)/length*offset};};
    const quiet=rod?.id==='golden',count=state.reduced||tier==='common'||quiet?1:tier==='rare'?2:3,strands=[];
    for(let k=0;k<count;k++)strands.push(sample(u=>{const along=.07+u*.91,travel=state.reduced?1:ease(p/.55),spread=tier==='common'?.8:quiet?3:tier==='rare'?6:10;
      return around(along,Math.sin(u*TAU*(quiet?.65:1.7)-p*4.8+k*Math.PI)*spread*Math.sin(u*Math.PI)*(1-ease((p-.55)/.45))*travel);
    },u=>Math.sin(u*Math.PI)*(tier==='common'?.65:quiet?1.15:1.5),1-k*.18,k%2,56));
    if(!summonScene(rod?.id)&&!state.reduced&&['epic','legendary'].includes(tier)){
      const center=spine(.6),size=Math.min(g.width*.13,g.height*.19,64)*(tier==='legendary'?1:.8)*(.72+.28*ease(p/.35));
      // Use the same signature as this rod's cast/catch, localized to its shaft.
      for(const strand of flow(rod.id,p*.8,p))strands.push(transform(strand,center.x,center.y,size));
    }
    return strands;
  }
  function summonPlacement(id,g,width=0,height=width){
    const along=({moon:.72,lotus:.22,astral:.6,cloud:.48,katana:.55,phoenix:.66,guandao:.52,dragon:.56,golden:.4})[id]||.55;
    const curve=g.curve||((u)=>({x:mix(g.grip.x,g.tip?.x||g.grip.x,u),y:mix(g.grip.y,g.tip?.y||g.grip.y,u)})),anchor=curve(along),a=curve(.15),b=curve(.85),length=Math.hypot(b.x-a.x,b.y-a.y)||1;
    let nx=(b.y-a.y)/length,ny=-(b.x-a.x)/length;if(nx>0){nx=-nx;ny=-ny;}
    const offset=({golden:23,phoenix:15,guandao:9,dragon:13,moon:0,astral:0,lotus:0,cloud:0})[id]||0;
    // Keep summons on the rod side of the water, outside the float/reel lane.
    const right=Math.min(g.width-48,Math.max(g.width*.49,(g.water?.x||g.width*.7)-48)),left=6,top=8,bottom=g.height-13;
    const x=Math.max(left+width/2,Math.min(right-width/2,anchor.x+nx*offset));
    const desiredY=id==='golden'?(g.grip||curve(0)).y-height*.43:anchor.y+ny*offset;
    const y=Math.max(top+height/2,Math.min(bottom-height/2,desiredY));
    return{x,y,right,left,top,bottom,anchor,nx,ny};
  }
  function caishenPose(state,g,aspect=1,id='golden'){
    const p=state.reduced?.38:state.progress,baseHeight=Math.min(g.height*(id==='golden'?.61:.69),202,g.width*.38/aspect),breathe=state.reduced?1:1+.025*Math.sin(ease((p-.12)/.38)*Math.PI),height=baseHeight*breathe,width=height*aspect;
    const placement=summonPlacement(id,g,width,height),x=placement.x,y=Math.max(placement.top+height/2,Math.min(placement.bottom-height/2,placement.y-(state.reduced?0:6*(1-ease(p/.22)))));
    return{width,height,x,y,alpha:state.alpha*(state.reduced?.55:.86)*(1-ease((p-.79)/.18))};
  }

  function paintSummonScene(ctx,id,state,g,colors){
    if(id==='cloud'){const size=Math.min(62,g.width*.155,g.height*.22),origin=summonPlacement(id,g,size*2.2,size*2.2);paintTornado(ctx,{...state,phase:'summon'},{...origin,size},colors,g,state.reduced?0:state.progress*2.6);return;}
    const p=state.reduced?.4:state.progress,closing=state.reduced?0:state.gather,fullSize=Math.min(id==='lotus'?48:55,g.width*.145,g.height*.21),size=fullSize*(1-closing*.84),origin=summonPlacement(id,g,fullSize*2.2,fullSize*2.2);
    if(!state.reduced&&id!=='katana'&&g.curve){const target=g.curve(.22+closing*.68);origin.x=mix(origin.x,target.x,closing);origin.y=mix(origin.y,target.y,closing);}
    if(['moon','astral','lotus'].includes(id))paintThemeAction(ctx,id,state,{...origin,size},colors);
    if(id==='katana'){
      // The doorway follows the real blade; the hand-off therefore emerges
      // from the slit instead of materialising beside a decorative slash.
      const top=g.curve(.99),bottom=g.curve(.09),dx=top.x-bottom.x,dy=top.y-bottom.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,open=Math.sin(Math.PI*ease(p))*(state.reduced?2:12);
      const edge=(u,side)=>({x:mix(bottom.x,top.x,ease(u))+nx*Math.sin(u*Math.PI)*open*side,y:mix(bottom.y,top.y,ease(u))+ny*Math.sin(u*Math.PI)*open*side});
      ctx.save();ctx.globalAlpha=state.alpha*.92;const abyss=ctx.createLinearGradient(bottom.x,bottom.y,top.x,top.y);abyss.addColorStop(0,'#18192d');abyss.addColorStop(.45,'#060612');abyss.addColorStop(1,'#24263f');ctx.fillStyle=abyss;trace(ctx,[...sample(u=>edge(u,-1),1).points,...sample(u=>edge(1-u,1),1).points],true);ctx.fill();
      for(const side of [-1,1])paint(ctx,sample(u=>edge(u,side),u=>Math.sin(u*Math.PI)*.85,1,side===1?2:0),colors,state.alpha);
      if(!state.reduced&&p<.48){const cut=ease((p-.08)/.25);paint(ctx,sample(u=>{const along=clamp(cut-u*.32),pt=g.curve(.08+along*.9);return{x:pt.x+nx*Math.sin(u*Math.PI)*2,y:pt.y+ny*Math.sin(u*Math.PI)*2};},u=>Math.sin(u*Math.PI)*1.4,1,2),colors,state.alpha*(1-ease((p-.35)/.13)));}ctx.restore();
    }
    if(id==='dragon')for(let k=0;k<3;k++)paint(ctx,sample(u=>{const a=u*TAU*.8+k*2.1+p*2,r=size*(.45+u*.55)*(1-closing*.6),j=Math.sin(u*39+k-p*5)*Math.sin(u*Math.PI)*2;return{x:origin.x+Math.cos(a)*r+j,y:origin.y+Math.sin(a)*r*.8};},u=>Math.sin(u*Math.PI)*.65,.6,2),colors,state.alpha*.55);
  }
  // One continuous texture is deformed in a shader: the wings and dragon body
  // move without visible joints, cropped sprite strips or separable body parts.
  function createSpiritSurface(doc){
    const canvas=doc.createElement('canvas');const gl=canvas.getContext?.('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});if(!gl)return null;
    const shaders=[],program=gl.createProgram(),buffer=gl.createBuffer(),texture=gl.createTexture();
    function shader(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))return false;gl.attachShader(program,s);return true;}
    const ok=shader(gl.VERTEX_SHADER,`
      precision mediump float;attribute vec2 a;varying vec2 uv;
      uniform float p,kind,quiet,action;uniform vec4 choreography;uniform vec2 viewport;uniform vec4 portrait;uniform vec2 shaft[9];
      vec2 rod(float u){float t=clamp(u,0.,.99999)*8.;vec2 point=shaft[0];for(int i=0;i<8;i++){if(t>=float(i)&&t<float(i+1))point=mix(shaft[i],shaft[i+1],t-float(i));}return point;}
      void main(){
        uv=a;float pi=3.14159265,t=p*pi*2.,m=quiet>.5||action>.5?0.:smoothstep(.48+.055*(1.-a.y),.86,p);
        vec2 local=(a-.5)*portrait.zw*vec2(1.,-1.);
        if(quiet<.5){
          if(kind>.5&&kind<1.5){
            float wing=smoothstep(.035,.4,abs(a.x-.5))*smoothstep(.21,.68,a.y),tail=(1.-smoothstep(.05,.45,a.y));
            local.x*=1.+wing*choreography.x*.24;
            local.y-=wing*choreography.x*portrait.w*.15;
            local.x+=tail*sin(a.y*9.-t*1.5)*portrait.z*.055;
            local.y+=tail*cos(a.x*8.+t*1.3)*portrait.w*.015;
          }else if(kind>1.5){
            float spine=sin(a.y*pi),coil=sin(a.y*8.-choreography.z*1.2);
            local.x+=coil*spine*portrait.z*.095;local.y+=cos(a.y*7.-choreography.z)*spine*portrait.w*.036;
            local.x*=1.-.11*sin(choreography.z)*sin(choreography.z);
          }else{
            float offering=exp(-pow((a.y-.47)/.16,2.))*exp(-pow((a.x-.5)/.34,2.));
            float sleeve=smoothstep(.2,.45,abs(a.x-.5))*(1.-smoothstep(.35,.65,a.y));
            local.y-=offering*choreography.y*portrait.w*.038;
            local.x+=sleeve*sin(a.y*12.-t*1.2)*portrait.z*.035;
            local.y+=sin(t)*portrait.w*.012;
          }
        }
        float turn=quiet>.5?0.:sin(p*pi*2.)*(kind>1.5?.12:kind<.5?.035:.06);
        vec2 initial=portrait.xy+mat2(cos(turn),sin(turn),-sin(turn),cos(turn))*local;
        float along=.02+a.y*.97;vec2 center=rod(along),tangent=normalize(rod(min(.999,along+.01))-rod(max(0.,along-.01))),normal=vec2(-tangent.y,tangent.x);
        float coil=quiet>.5?0.:sin(a.y*pi*4.6-p*pi*4.)*sin(a.y*pi)*sin(m*pi)*portrait.z*.13;
        vec2 target=center+normal*((a.x-.5)*2.8+coil);
        vec2 point=mix(initial,target,m);
        gl_Position=vec4(point.x/viewport.x*2.-1.,1.-point.y/viewport.y*2.,0.,1.);
      }`)&&shader(gl.FRAGMENT_SHADER,`
      precision mediump float;varying vec2 uv;uniform sampler2D art;uniform float p,kind,quiet,action;
      float relief(vec2 q){vec4 c=texture2D(art,clamp(q,0.,1.));return dot(c.rgb,vec3(.299,.587,.114))*.55+c.a*.45;}
      void main(){vec2 q=uv;float t=(quiet>.5?0.:p)*6.28318;
        if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){gl_FragColor=vec4(0.);return;}
        vec4 c=texture2D(art,q);if(c.a<.002){gl_FragColor=vec4(0.);return;}
        float e=.004,dx=relief(q+vec2(e,0.))-relief(q-vec2(e,0.)),dy=relief(q+vec2(0.,e))-relief(q-vec2(0.,e));
        // Rounded volume plus painted relief keeps the face, scales and folds
        // under one moving light. The transparent desktop itself is not sampled.
        vec3 n=normalize(vec3((q.x-.5)*1.25-dx*2.4,(q.y-.5)*.6-dy*2.4,.78));
        vec3 light=normalize(vec3(-.52,.68,1.)),halfLight=normalize(light+vec3(0.,0.,1.));
        float diffuse=dot(n,light),spec=pow(max(0.,dot(n,halfLight)),34.);
        float edge=clamp(length(vec2(dx,dy))*3.4+pow(1.-n.z,2.)*.7,0.,1.);
        vec3 tint=kind<.5||kind>2.5?vec3(1.,.85,.49):kind<1.5?vec3(1.,.65,.3):vec3(.57,1.,.9);
        if(kind>2.5){float l=dot(c.rgb,vec3(.299,.587,.114));c.rgb=mix(c.rgb,vec3(l*1.25,l*.91,l*.42),.74);}
        float band=exp(-pow((q.x*.8+q.y*.35-.12-(quiet>.5?.45:p)*.76)/.065,2.));
        vec3 transmission=mix(c.rgb,tint,.42)*(.85+.25*diffuse);
        vec3 crystal=transmission+vec3(1.,.98,.92)*(spec*.3+edge*.28+band*.16);
        // Light is carried mostly by the relief and rim. Hollow interiors and
        // a thinning lower body reveal the desktop through the apparition.
        float density=clamp(.43+edge*.55+spec*.17+band*.13,.35,.88);
        float veil=.88+.12*sin(q.y*13.+q.x*8.-t*.5);
        float spiritAlpha=c.a*density*(.55+.45*smoothstep(.02,.3,q.y))*veil;
        float forging=quiet>.5||action>.5?0.:smoothstep(.52,.85,p);
        crystal=mix(crystal,tint*1.15+vec3(.16),forging*.72);
        gl_FragColor=vec4(clamp(crystal,0.,1.)*spiritAlpha,spiritAlpha);
      }`);
    gl.linkProgram(program);let disposed=false,lastImage=null;
    const destroy=()=>{if(disposed)return;disposed=true;for(const s of shaders)gl.deleteShader(s);gl.deleteProgram(program);gl.deleteBuffer(buffer);gl.deleteTexture(texture);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.width=canvas.height=1;};
    if(!ok||!gl.getProgramParameter(program,gl.LINK_STATUS)){destroy();return null;}
    const vertices=[];for(let y=0;y<48;y++)for(let x=0;x<40;x++){const l=x/40,r=(x+1)/40,b=y/48,t=(y+1)/48;vertices.push(l,b,r,b,l,t,l,t,r,b,r,t);}
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.bindTexture(gl.TEXTURE_2D,texture);for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    const uniforms=Object.fromEntries(['p','kind','quiet','action','choreography','viewport','portrait','shaft[0]'].map(k=>[k,gl.getUniformLocation(program,k)]));
    return{draw(image,id,state,pose,g){if(disposed||gl.isContextLost())return null;
      const ratio=Math.min(2,doc.defaultView?.devicePixelRatio||1),w=Math.ceil(g.width*ratio),h=Math.ceil(g.height*ratio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      if(lastImage!==image){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);lastImage=image;}
      gl.uniform1f(uniforms.p,state.progress);gl.uniform1f(uniforms.kind,id==='golden'?0:id==='phoenix'?1:id==='dragon'?3:2);gl.uniform1f(uniforms.quiet,state.reduced?1:0);
      const poseMotion=themePose(id,state);gl.uniform1f(uniforms.action,state.action?1:0);gl.uniform4f(uniforms.choreography,poseMotion.wing,poseMotion.opening,poseMotion.orbit,poseMotion.draw);
      gl.uniform2f(uniforms.viewport,g.width,g.height);gl.uniform4f(uniforms.portrait,pose.x,pose.y,pose.width,pose.height);
      const points=[];for(let i=0;i<=8;i++){const point=g.curve?g.curve(i/8):{x:mix(g.grip.x,g.tip.x,i/8),y:mix(g.grip.y,g.tip.y,i/8)};points.push(point.x,point.y);}gl.uniform2fv(uniforms['shaft[0]'],new Float32Array(points));
      gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);return canvas;},destroy};
  }
  function createSummon(host){
    const doc=host.ownerDocument,win=doc.defaultView||globalThis,canvas=doc.createElement('canvas'),ctx=canvas.getContext?.('2d',{alpha:true});if(!ctx)return null;
    canvas.className='fishing-summon-canvas';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);let disposed=false,spiritSurface=null;const images=new Map();
    // Load before the first cast, so manifestation never pops in mid-animation.
    if(win.Image)for(const scene of Object.values(SUMMON_SCENES))if(scene.art&&!images.has(scene.art)){const image=new win.Image();image.src='/fishing-art/'+scene.art;images.set(scene.art,image);}
    function draw(rod,state,g){
      if(disposed)return;canvas.hidden=!state;if(!state){canvas.dataset.tier='';canvas.dataset.apparition='';return;}
      const ratio=Math.min(2,win.devicePixelRatio||1),width=Math.max(1,Math.ceil(g.width*ratio)),height=Math.max(1,Math.ceil(g.height*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,g.width,g.height);canvas.dataset.tier=state.tier;canvas.dataset.progress=String(state.progress);
      const valid=c=>/^#[0-9a-f]{6}$/i.test(c||''),colors=design(rod?.id)?.colors||[valid(rod?.color)?rod.color:'#8da392',valid(rod?.accent)?rod.accent:'#c5dfcf','#fff5dc'];
      ctx.save();canvas.dataset.apparition='';canvas.dataset.scene=state.kind;canvas.dataset.stage=state.departing?'depart':state.stage;canvas.dataset.gather=String(state.gather);
      const scene=summonScene(rod?.id);paintSummonScene(ctx,rod?.id,state,g,colors);
      if(scene?.art){
        if(!images.has(scene.art)&&win.Image){const image=new win.Image();image.src='/fishing-art/'+scene.art;images.set(scene.art,image);}
        const image=images.get(scene.art);
        if(image?.complete&&image.naturalWidth){
          const pose=caishenPose(state,g,image.naturalWidth/image.naturalHeight,rod.id);canvas.dataset.apparition=scene.kind;canvas.dataset.spiritAlpha=String(pose.alpha);
          if(!spiritSurface)spiritSurface=createSpiritSurface(doc);
          const source=spiritSurface?.draw(image,rod.id,state,pose,g);canvas.dataset.spiritRenderer=source?'webgl':'canvas';canvas.dataset.spiritMaterial='translucent-crystal';
          ctx.globalAlpha=pose.alpha;
          if(source)ctx.drawImage(source,0,0,g.width,g.height);
          else{const m=state.reduced?0:state.gather,anchor=g.curve?g.curve(.5):g.grip;ctx.save();ctx.translate(mix(pose.x,anchor.x,m),mix(pose.y,anchor.y,m));ctx.rotate(m*Math.atan2(g.tip?.x-g.grip.x,g.grip.y-g.tip?.y));ctx.drawImage(image,-pose.width*(1-m*.97)/2,-pose.height/2,pose.width*(1-m*.97),pose.height);ctx.restore();}
          ctx.globalAlpha=1;
          if(!state.reduced){
            const gather=state.gather;
            for(const side of [-1,1])paint(ctx,sample(u=>{const t=ease(u),along=Math.min(1,u*.84+gather*.16),anchor=g.curve?g.curve(along):g.grip,spread=Math.sin(u*Math.PI)*pose.width*.15*(1-gather);return{x:mix(pose.x+side*pose.width*.3,anchor.x,t)+side*spread,y:mix(pose.y+pose.height*.3,anchor.y,t)-Math.sin(u*Math.PI)*18};},u=>Math.sin(u*Math.PI)*1.4,.7,1,80),colors,state.alpha*Math.sin(gather*Math.PI));
          }
        }
      }
      for(const strand of summonField(rod,state,g))paint(ctx,strand,colors,state.alpha*(scene?.art?.08+.82*state.gather:1));ctx.restore();
    }
    return{draw,destroy(){if(disposed)return;disposed=true;images.clear();spiritSurface?.destroy();spiritSurface=null;canvas.width=canvas.height=1;canvas.remove();}};
  }
  function coinPose(progress,reduced=false){const p=clamp(progress);return{rise:reduced?.35:ease(p)*.95,angle:reduced?.35:.35+p*TAU*1.65,radius:.34,alpha:ease(p/.12)*(1-ease((p-.72)/.28))};}
  function paintCoin(ctx,x,y,size,state){
    const pose=coinPose(state.progress,state.reduced),r=size*pose.radius,angle=pose.angle,face=Math.cos(angle),width=Math.max(.035,Math.abs(face)),thickness=r*.17*Math.sin(angle);
    ctx.save();ctx.translate(x,y+size*.3-size*pose.rise);ctx.globalAlpha=pose.alpha*(state.reduced?.3:1);
    // One extruded coin: rim first, then a perspective-compressed engraved face.
    const rim=ctx.createLinearGradient(-r,0,r,0);rim.addColorStop(0,'#8c4c0a');rim.addColorStop(.35,'#fff2b0');rim.addColorStop(.65,'#d79922');rim.addColorStop(1,'#6f3d08');
    ctx.fillStyle=rim;ctx.beginPath();ctx.ellipse(thickness*.5,0,r*width+Math.abs(thickness)*.5,r,0,0,TAU);ctx.fill();
    ctx.strokeStyle='#f9d477';ctx.lineWidth=.55;for(let i=0;i<23;i++){const a=-Math.PI/2+i/22*Math.PI,yy=Math.sin(a)*r,xx=Math.cos(a)*r*width*(thickness<0?-1:1);ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+thickness,yy);ctx.stroke();}
    ctx.translate(thickness>0?0:thickness,0);ctx.scale(width,1);
    const gold=ctx.createLinearGradient(-r,-r,r,r);gold.addColorStop(0,'#fff4bc');gold.addColorStop(.22,'#efb936');gold.addColorStop(.46,'#fff2a5');gold.addColorStop(.56,'#cf8b15');gold.addColorStop(.82,'#f6cb57');gold.addColorStop(1,'#9e5b0e');ctx.fillStyle=gold;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
    ctx.strokeStyle='#8d540e';ctx.lineWidth=r*.035;ctx.beginPath();ctx.arc(0,0,r*.83,0,TAU);ctx.stroke();ctx.strokeStyle='#fff0a1';ctx.beginPath();ctx.arc(-r*.018,-r*.018,r*.87,0,TAU);ctx.stroke();
    for(let i=0;i<32;i++){const a=i/32*TAU;ctx.fillStyle=i%2?'#9f6515':'#ffe998';ctx.beginPath();ctx.arc(Math.cos(a)*r*.93,Math.sin(a)*r*.93,r*.025,0,TAU);ctx.fill();}
    // Raised crown stamp and laurel engraving; all marks rotate with the face.
    ctx.fillStyle='#ab6b13';ctx.strokeStyle='#fff0ad';ctx.lineWidth=r*.03;ctx.beginPath();ctx.moveTo(-r*.42,r*.22);ctx.lineTo(-r*.48,-r*.26);ctx.lineTo(-r*.2,-r*.1);ctx.lineTo(0,-r*.43);ctx.lineTo(r*.2,-r*.1);ctx.lineTo(r*.48,-r*.26);ctx.lineTo(r*.42,r*.22);ctx.closePath();ctx.fill();ctx.stroke();
    for(const side of [-1,1])for(let i=0;i<5;i++){const a=.3+i*.22,xx=side*Math.sin(a)*r*.64,yy=Math.cos(a)*r*.62;ctx.beginPath();ctx.ellipse(xx,yy,r*.12,r*.035,side*(.2+i*.2),0,TAU);ctx.fill();ctx.stroke();}
    ctx.restore();
  }
  function create(host){
    const doc=host.ownerDocument,win=doc.defaultView||globalThis,canvas=doc.createElement('canvas'),ctx=canvas.getContext?.('2d',{alpha:true});if(!ctx)return null;
    canvas.className='fishing-flow-canvas';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);
    let width=0,height=0,ratio=0,disposed=false,lastVariant='',history=[],spiritSurface=null;const images=new Map();
    if(win.Image)for(const id of ['phoenix','dragon','guandao']){const art=summonScene(id).art;if(!images.has(art)){const image=new win.Image();image.src='/fishing-art/'+art;images.set(art,image);}}
    function draw(profile,phase,age,values,g,tip,point,control1,control2,reduced=false){
      if(disposed)return;
      const info=design(profile?.variant);canvas.hidden=!info;if(!info){history=[];return;}
      const dpr=Math.min(2,win.devicePixelRatio||1);
      if(g.width!==width||g.height!==height||ratio!==dpr){width=g.width;height=g.height;ratio=dpr;canvas.width=Math.max(1,Math.ceil(width*dpr));canvas.height=Math.max(1,Math.ceil(height*dpr));}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(0,0,Math.max(0,width-40),height);ctx.clip();
      const id=profile.variant,t=reduced?0:age/1000,power=phase==='charging'?clamp(values.castPower):phase==='reeling'?clamp(values.tension):.15,energy=(reduced?.16:.44+power*.3)*profile.energy;
      canvas.dataset.variant=id;canvas.dataset.phase=phase;
      if(lastVariant!==id){history=[];lastVariant=id;}
      const spine=u=>g.curve?g.curve(u):{x:mix(g.grip.x,tip.x,u),y:mix(g.grip.y,tip.y,u)};
      for(let k=0;k<(id==='golden'?1:3);k++){
        const strand=sample(u=>{const along=.24+u*.76,p=spine(along),a=spine(Math.max(0,along-.01)),b=spine(Math.min(1,along+.01)),len=Math.hypot(b.x-a.x,b.y-a.y)||1,s=Math.sin(along*TAU*info.frequency-t*info.speed*2+k*2.1),spread=(2.2+power*2.8)*info.spread*Math.sin(u*Math.PI);return{x:p.x-(b.y-a.y)/len*s*spread,y:p.y+(b.x-a.x)/len*s*spread};},u=>(.5+power*.45)*Math.sin(u*Math.PI),.8-k*.13,k%2,56);
        paint(ctx,strand,info.colors,energy);
      }
      if(['cast','reeling'].includes(phase)&&!reduced){
        const line=u=>{const a=1-u;return{x:a**3*tip.x+3*a*a*u*control1.x+3*a*u*u*control2.x+u**3*point.x,y:a**3*tip.y+3*a*a*u*control1.y+3*a*u*u*control2.y+u**3*point.y};};
        for(let k=0;k<3;k++){const head=(t*(id==='katana'?1.8:.7)+k*.34)%1;paint(ctx,sample(u=>line(clamp(head-u*.23)),u=>.85*Math.sin(u*Math.PI),.7,k%2,28),info.colors,.7*profile.energy);}
      }
      if(phase==='cast'&&!reduced){history.push({...tip});if(history.length>15)history.shift();if(history.length>2)paint(ctx,{alpha:.65,color:1,points:history.map((p,i)=>({...p,w:Math.sin(i/(history.length-1)*Math.PI)*1.3}))},info.colors,1);}else history=[];
      const state=eventState(id,phase,age,reduced);canvas.dataset.event=state?phase:'';canvas.dataset.eventAlpha=String(state?.alpha||0);canvas.dataset.action='';canvas.dataset.spiritRenderer='';
      if(state){
        const position=layout(id,state,g,tip,point),p=reduced?.45:state.progress,shape=flow(id,t,p),size=position.size*(.76+.24*ease(p/.3));
        const articulated=['moon','cloud','astral','lotus','katana','guandao','phoenix'].includes(id),spirit=phase==='caught'&&['phoenix','dragon','guandao'].includes(id),poseMotion=themePose(id,state);
        canvas.dataset.action=articulated||spirit?(id==='cloud'?'tornado':id)+'-'+phase:'';
        if(articulated&&!(id==='phoenix'&&spirit))paintThemeAction(ctx,id,{...state,alpha:state.alpha*profile.energy},{...position,size},info.colors);
        if(id!=='cloud')for(const strand of shape)paint(ctx,transform(strand,position.x,position.y,size),info.colors,state.alpha*profile.energy*(articulated?.2:spirit?.28:1));
        if(spirit){
          const art=images.get(summonScene(id).art);
          if(art?.complete&&art.naturalWidth){
            if(!spiritSurface)spiritSurface=createSpiritSurface(doc);
            const aspect=art.naturalWidth/art.naturalHeight,h=size*1.43,w=h*aspect,portrait={x:position.x+poseMotion.x*size,y:position.y+poseMotion.y*size,width:w,height:h},surface=spiritSurface?.draw(art,id,{...state,action:true},portrait,{...g,tip});
            ctx.globalAlpha=state.alpha*(reduced?.25:.72)*profile.energy;if(surface)ctx.drawImage(surface,0,0,width,height);else ctx.drawImage(art,portrait.x-w/2,portrait.y-h/2,w,h);
            canvas.dataset.spiritRenderer=surface?'webgl':'canvas';
          }
        }
        if(id==='golden'&&phase==='caught')paintCoin(ctx,position.x,position.y,size,state);
        if(!reduced){
          const count=id==='golden'||id==='cloud'?0:18;
          for(let i=0;i<count;i++){
            const source=shape[i%shape.length].points,u=(i*.618+t*(id==='phoenix'?.31:.12))%1,j=Math.floor(u*(source.length-5))+2,pt=source[j],prior=source[j-2],drift=(.5+.5*Math.sin(i*7.3+t))*state.progress,px=position.x+pt.x*size,py=position.y+pt.y*size-drift*size*.12,life=Math.sin(u*Math.PI)*state.alpha*(.28+i%3*.11);
            ctx.globalAlpha=life;ctx.strokeStyle=info.colors[i%5===0?2:1];ctx.lineWidth=i%4===0?1.1:.6;ctx.beginPath();ctx.moveTo(px+(prior.x-pt.x)*size*1.4,py+(prior.y-pt.y)*size*1.4);ctx.lineTo(px,py);ctx.stroke();
          }
        }
      }
      ctx.restore();ctx.globalAlpha=1;
    }
    return{draw,destroy(){if(disposed)return;disposed=true;history=[];images.clear();spiritSurface?.destroy();spiritSurface=null;canvas.width=canvas.height=1;canvas.remove();}};
  }
  function catalogMarkup(rod,id,curve){
    const info=design(rod.id);if(!info)return'';
    if(rod.id==='cloud')return catalogTornadoMarkup(rod,id,curve,info);
    const colors=info.colors,gradient=id+'-flow',glow=id+'-mist',strands=[],quiet=rod.id==='golden';
    for(let k=0;k<(quiet?1:3);k++){
      const points=sample(u=>{const s=.23+u*.74,p=curve(s),a=curve(Math.max(0,s-.01)),b=curve(Math.min(1,s+.01)),len=Math.hypot(b.x-a.x,b.y-a.y)||1,offset=Math.sin(s*TAU*info.frequency+k*2.1)*(quiet?1.2:9+info.spread*3)*Math.sin(u*Math.PI);return{x:p.x-(b.y-a.y)/len*offset,y:p.y+(b.x-a.x)/len*offset};},u=>Math.sin(u*Math.PI)*(quiet?.32:k?1.2:2.1),1,k%2,80).points;
      const d=envelope(points).map((p,i)=>(i?'L':'M')+f(p.x)+' '+f(p.y)).join('')+'Z';
      strands.push('<path class="fishing-catalog-flow" d="'+d+'" fill="url(#'+gradient+')" style="--flow-delay:'+(-k*1.4)+'s"/>');
    }
    const tip=curve(.97),gem=curve(.43);
    return'<g class="fishing-catalog-fx fishing-catalog-fluid" data-fx-theme="'+info.theme+'" data-fx-variant="'+rod.id+'" style="--rod-glow:'+colors[1]+';--rod-accent:'+colors[0]+';--fx-energy:'+(rod.rarity==='legendary'?1:.85)+'" aria-hidden="true"><defs><linearGradient id="'+gradient+'" x1="0" y1="1" x2=".8" y2="0"><stop stop-color="'+colors[0]+'" stop-opacity="0"/><stop offset=".28" stop-color="'+colors[0]+'" stop-opacity=".6"/><stop offset=".6" stop-color="'+colors[1]+'"/><stop offset=".82" stop-color="'+colors[2]+'"/><stop offset="1" stop-color="'+colors[1]+'" stop-opacity="0"/></linearGradient><radialGradient id="'+glow+'"><stop stop-color="'+colors[1]+'" stop-opacity=".18"/><stop offset="1" stop-color="'+colors[0]+'" stop-opacity="0"/></radialGradient></defs><ellipse class="fishing-catalog-halo" cx="'+f(gem.x)+'" cy="'+f(gem.y)+'" rx="38" ry="77" fill="url(#'+glow+')"/>'+strands.join('')+'<circle class="fishing-catalog-flow-tip" cx="'+f(tip.x)+'" cy="'+f(tip.y)+'" r="1.5" fill="'+colors[2]+'"/></g>';
  }
  function catalogTornadoMarkup(rod,id,curve,info){
    const density=id+'-vortex-density',light=id+'-vortex-light',glow=id+'-vortex-glow',colors=info.colors,pose=tornadoPose({progress:.42,reduced:true}),field=tornadoField(0,.42,{reduced:true});
    const project=point=>{const along=.23+point.h*.63,center=curve(along),a=curve(Math.max(0,along-.01)),b=curve(Math.min(1,along+.01)),length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;return{x:center.x+nx*point.x*45+ny*point.z*10,y:center.y+ny*point.x*45-nx*point.z*10,w:point.w*45};};
    const path=points=>points.map((point,i)=>(i?'L':'M')+f(point.x)+' '+f(point.y)).join('')+'Z',silhouette=[];
    for(const side of[-1,1])for(let i=0;i<=64;i++){const h=side<0?i/64:1-i/64;silhouette.push(project(tornadoPoint(h,side<0?Math.PI:0,pose)));}
    const parts={back:[],front:[]};
    for(const sheet of field){let run=[],front=false,previous=null;for(const point of sheet.points){const near=point.z>=0;if(previous&&near!==front){const t=Math.abs(previous.z)/(Math.abs(previous.z)+Math.abs(point.z)),cross={x:mix(previous.x,point.x,t),y:mix(previous.y,point.y,t),z:0,h:mix(previous.h,point.h,t),w:mix(previous.w,point.w,t)};run.push(project(cross));if(run.length>1)parts[front?'front':'back'].push({alpha:sheet.alpha,points:run});run=[project(cross)];}run.push(project(point));front=near;previous=point;}if(run.length>1)parts[front?'front':'back'].push({alpha:sheet.alpha,points:run});}
    const ribbon=(strand,front,index)=>'<path class="fishing-catalog-flow" data-wind-depth="'+(front?'front':'back')+'" d="'+path(envelope(strand.points,front?1:1.2))+'" fill="url(#'+light+')" fill-opacity="'+f(strand.alpha*(front?.83:.27))+'" style="--flow-delay:'+(-index*.17)+'s"/>',center=curve(.58);
    return'<g class="fishing-catalog-fx fishing-catalog-fluid" data-fx-theme="tornado" data-fx-variant="cloud" data-fx-surface="tapered-vortex" style="--rod-glow:'+colors[1]+';--rod-accent:'+colors[0]+';--fx-energy:.85" aria-hidden="true"><defs><linearGradient id="'+density+'" x1="0" y1=".5" x2="1" y2=".5"><stop stop-color="'+colors[0]+'" stop-opacity="0"/><stop offset=".28" stop-color="'+colors[2]+'" stop-opacity=".26"/><stop offset=".55" stop-color="'+colors[1]+'" stop-opacity=".07"/><stop offset=".83" stop-color="'+colors[2]+'" stop-opacity=".16"/><stop offset="1" stop-color="'+colors[0]+'" stop-opacity="0"/></linearGradient><linearGradient id="'+light+'" x1="0" y1="1" x2=".8" y2="0"><stop stop-color="'+colors[0]+'" stop-opacity="0"/><stop offset=".21" stop-color="'+colors[1]+'" stop-opacity=".72"/><stop offset=".65" stop-color="'+colors[2]+'" stop-opacity=".86"/><stop offset="1" stop-color="'+colors[1]+'" stop-opacity=".07"/></linearGradient><radialGradient id="'+glow+'"><stop stop-color="'+colors[1]+'" stop-opacity=".11"/><stop offset="1" stop-color="'+colors[0]+'" stop-opacity="0"/></radialGradient></defs><ellipse class="fishing-catalog-halo" cx="'+f(center.x)+'" cy="'+f(center.y)+'" rx="43" ry="93" fill="url(#'+glow+')"/>'+parts.back.map((strand,i)=>ribbon(strand,false,i)).join('')+'<path data-wind-volume="true" d="'+path(silhouette)+'" fill="url(#'+density+')"/>'+parts.front.map((strand,i)=>ribbon(strand,true,i)).join('')+'</g>';
  }
  return Object.freeze({design,flow,themePose,tornadoPose,tornadoPoint,tornadoField,orbitalPoint,coinPose,paintCoin,envelope,eventState,layout,summonScene,summonState,summonField,summonPlacement,caishenPose,createSummon,create,catalogMarkup});
});
