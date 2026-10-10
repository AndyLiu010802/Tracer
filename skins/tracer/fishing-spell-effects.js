(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingSpells=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const Anime=typeof module==='object'&&module.exports?require('./fishing-anime-effects'):globalThis.TracerFishingAnime;
  const Expansion=typeof module==='object'&&module.exports?require('./fishing-expansion-effects'):globalThis.TracerFishingExpansionEffects;
  const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,Number(x)||0)),mix=(a,b,t)=>a+(b-a)*t,ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const spells=Object.freeze(Object.assign({},Anime?.spells,Expansion?.spells,{
    whitedragon:['dragon','#477a90','#bce5e2','#fbfff0'],kasaya:['silk','#882c2c','#e9ac54','#fff0c6'],
    windfan:['wind','#416b5e','#acd6ad','#eff8cf'],redboy:['fire','#9b2730','#ff9b32','#fff2ba'],
    jadebottle:['dew','#438f90','#b7e3d1','#f3ffeb'],demonmirror:['mirror','#526d98','#c4e3ef','#fff6cb'],
    goldenbell:['resonance','#745098','#e8c472','#fff3cf'],sevenstars:['stars','#41699c','#b1dbef','#fff3c4'],
    gourd:['vortex','#714372','#dba5b5','#ffe8ab'],lotuswheel:['wheels','#ac342d','#ffc26b','#fff4ca'],
    ruyi:['spinning-staff','#8e2922','#edc26e','#fff3b7'],erlang:['cleave','#487f9c','#cee9ee','#fffdf1'],
    wukong:['clones','#a7442b','#f2c365','#fff2b1'],thunderdrum:['thunder','#426380','#89dfff','#f6ffff'],
    monkeytwig:['leaf','#516d42','#b9d388','#f5efba'],goldenhoop:['resonance','#86662b','#e9c774','#fff1c1'],
    moonspade:['crescent','#547b92','#bddde4','#f0fff4'],ninerake:['rake','#446479','#b6d0de','#eef6ea']
  }));
  const has=id=>Object.prototype.hasOwnProperty.call(spells,id);
  // All phases use the host's reversible animation clock, never timers or
  // random frame noise. One landing flash; quiet mode removes moving fields.
  function timeline(phase,age,values={},quiet=false){
    if(!Number.isFinite(age)||age<0)return null;
    let p=0,strength=1,stage='';
    if(phase==='charging'){p=clamp(values.castPower);stage='gather';strength=.18+p*.35;}
    else if(phase==='cast'){if(age>680)return null;p=clamp(age/650);stage='travel';}
    else if(phase==='bite'){if(age>560)return null;p=age/560;stage='impact';strength=.88;}
    else if(phase==='caught'){if(age<560||age>1900)return null;p=(age-560)/1340;stage='finish';strength=1;}
    else return null;
    const envelope=stage==='gather'?1:stage==='channel'?.65+.35*Math.sin(p*Math.PI):ease(p/.10)*(1-ease((p-.62)/.38));
    return{phase,stage,progress:quiet?.48:p,alpha:envelope*strength*(quiet?.18:1),quiet,clones:Math.max(1,Math.min(3,values.catchCount||1))};
  }
  function rgba(hex,a){const v=parseInt(hex.slice(1),16);return 'rgba('+[(v>>16)&255,(v>>8)&255,v&255,a].join(',')+')';}
  function path(ctx,points,close=false){ctx.beginPath();for(let i=0;i<points.length;i++){const p=points[i];i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}if(close)ctx.closePath();}
  const samples=(fn,n=48)=>Array.from({length:n+1},(_,i)=>fn(i/n));
  function ribbon(ctx,points,width,colors,alpha){
    if(points.length<2||alpha<.002)return;
    const left=[],right=[];
    for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],q=points[i],len=Math.hypot(b.x-a.x,b.y-a.y)||1,w=(typeof width==='function'?width(i/(points.length-1)):width)*Math.sin(i/(points.length-1)*Math.PI)**.7;left.push({x:q.x-(b.y-a.y)/len*w,y:q.y+(b.x-a.x)/len*w});right.push({x:q.x+(b.y-a.y)/len*w,y:q.y-(b.x-a.x)/len*w});}
    const a=points[0],b=points.at(-1),grad=ctx.createLinearGradient(a.x,a.y,b.x+.01,b.y+.01);grad.addColorStop(0,rgba(colors[0],0));grad.addColorStop(.28,rgba(colors[0],.75));grad.addColorStop(.66,colors[1]);grad.addColorStop(.9,colors[2]);grad.addColorStop(1,rgba(colors[1],0));
    path(ctx,left.concat(right.reverse()),true);ctx.globalAlpha=alpha;ctx.fillStyle=grad;ctx.fill();
    path(ctx,points);ctx.globalAlpha=alpha*.6;ctx.strokeStyle=colors[2];ctx.lineWidth=.55;ctx.stroke();
  }
  function light(ctx,x,y,r,color,alpha){if(r<.1||alpha<.002)return;const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,rgba(color,.42));grad.addColorStop(.25,rgba(color,.16));grad.addColorStop(1,rgba(color,0));ctx.globalAlpha=alpha;ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);}
  function ring(ctx,x,y,r,squash,color,alpha,turn=0){if(r<0)return;ctx.save();ctx.translate(x,y);ctx.rotate(turn);ctx.beginPath();ctx.ellipse(0,0,r,r*squash,0,0,TAU);ctx.strokeStyle=color;ctx.lineWidth=.65;ctx.globalAlpha=alpha;ctx.stroke();ctx.restore();}
  function gem(ctx,x,y,r,color,alpha,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.2,-r*.15,r*.55,0);ctx.quadraticCurveTo(r*.17,r*.15,0,r);ctx.quadraticCurveTo(-r*.17,r*.15,-r*.55,0);ctx.quadraticCurveTo(-r*.2,-r*.15,0,-r);ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fill();ctx.restore();}
  function wheel(ctx,x,y,r,turn,c,alpha){
    ctx.save();ctx.translate(x,y);ctx.rotate(turn);ring(ctx,0,0,r,1,c[1],alpha);ring(ctx,0,0,r*.73,1,c[0],alpha);ring(ctx,0,0,r*.16,1,c[2],alpha);
    for(let j=0;j<10;j++){const a=j/10*TAU,ca=Math.cos(a),sa=Math.sin(a);ribbon(ctx,[{x:ca*r*.15,y:sa*r*.15},{x:ca*r*.55-sa*r*.12,y:sa*r*.55+ca*r*.12},{x:ca*r*.9,y:sa*r*.9}],r*.035,c,alpha);const points=samples(u=>{const aa=a-u*.34,rr=r*(.93+Math.sin(u*Math.PI)*.28);return{x:Math.cos(aa)*rr,y:Math.sin(aa)*rr};},16);ribbon(ctx,points,r*.045,c,alpha*.74);}
    ctx.restore();
  }
  function staff(ctx,x,y,length,turn,c,alpha){ctx.save();ctx.translate(x,y);ctx.rotate(turn);const w=Math.max(1.6,length*.036),grad=ctx.createLinearGradient(-w,0,w,0);grad.addColorStop(0,c[0]);grad.addColorStop(.45,c[2]);grad.addColorStop(1,c[1]);ctx.globalAlpha=alpha;ctx.fillStyle=grad;ctx.fillRect(-w,-length/2,w*2,length);for(const s of[-1,1]){ctx.fillStyle=c[1];ctx.fillRect(-w*1.7,s*length/2-(s>0?length*.14:0),w*3.4,length*.14);ctx.strokeStyle=c[2];ctx.lineWidth=.5;for(let j=0;j<3;j++){ctx.beginPath();const y=s*length/2-s*(j+.3)*length*.04;ctx.moveTo(-w*1.7,y);ctx.lineTo(w*1.7,y);ctx.stroke();}}ctx.restore();}
  function impact(ctx,x,y,r,p,c,alpha,kind){
    for(let j=0;j<3;j++){const t=clamp(p*1.16-j*.12);ring(ctx,x,y,r*(.12+t*.9),.22,c[j%3],alpha*(1-t)*(.62-j*.10));}
    if(kind==='wind'||kind==='vortex'||kind==='resonance'||kind==='mirror')return;
    for(let j=0;j<10;j++){const a=j/10*TAU+Math.sin(j*9)*.2,v=.45+(j%3)*.22,travel=p*r*v;const x1=x+Math.cos(a)*travel,y1=y+Math.sin(a)*travel*.24-Math.sin(p*Math.PI)*r*(.12+j%3*.06);gem(ctx,x1,y1,(1-p)*2.1,c[j%3],alpha*(1-p)*.6,a);}
  }
  function draw(ctx,id,phase,age,values,g,tip,point,quiet=false,energy=1){
    if(Anime?.has(id))return Anime.draw(ctx,id,phase,age,values,g,tip,point,quiet,energy);
    if(id==='ruyi'&&['cast','bite','caught'].includes(phase)){
      // Resolve at draw time: the browser loads Journey after the spell module.
      const journey=typeof module==='object'&&module.exports?require('./fishing-journey-effects'):globalThis.TracerFishingJourney;
      if(journey){
        const state=journey.staffState(phase,age,quiet);if(!state)return null;
        const caught=phase==='caught',p=quiet?.46:state.progress,size=Math.max(18,Math.min(g.width*(caught?.23:.16),g.height*(caught?.3:.23),caught?113:79)),u=ease(p);
        let x=caught?point.x:mix(tip.x,point.x,u),y=caught?point.y-size*.82:mix(tip.y,point.y,u)-Math.sin(u*Math.PI)*size*.3;
        x=Math.max(size,Math.min(g.width-size-42,x));y=Math.max(size,Math.min(g.height-size,y));
        journey.paint(ctx,id,{...state,alpha:state.alpha*energy},{x,y,size});
        return {...state,quiet,stage:journey.staffPose(state).stage};
      }
    }
    const spec=spells[id],q=timeline(phase,age,values,quiet);if(!spec||!q||q.alpha<.003)return null;
    const c=spec.slice(1),type=spec[0],p=q.progress,a=q.alpha*energy,water=g.water||point,r=Math.max(16,Math.min(76,g.width*.18,g.height*.26));
    const travel=q.stage==='travel',gather=q.stage==='gather',channel=q.stage==='channel',finish=q.stage==='finish';
    const origin=gather?tip:travel?point:water,x=origin.x,y=origin.y,action=ease((p-.12)/.52);
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    if(quiet){ring(ctx,x,y,r*.32,.24,c[1],a);gem(ctx,x,y-5,4,c[2],a);ctx.restore();return q;}
    if(gather){
      const size=r*(.17+p*.16);for(let j=0;j<5;j++){const aa=j/5*TAU-age*.001,rr=size*(1.2-p*.6);gem(ctx,x+Math.cos(aa)*rr,y+Math.sin(aa)*rr*.55,1.5+j%2,c[j%3],a*.8,aa);}light(ctx,x,y,size,c[1],a*.7);ctx.restore();return q;
    }
    if(!travel&&!channel)impact(ctx,x,y,r,p,c,a,type);
    if(Expansion?.draw(ctx,id,q,{c,p,a,x,y,radius:r,travel,channel,finish,helpers:{ribbon,samples,ring,gem,light,path,wheel,staff}})){ctx.restore();return q;}
    if(type==='fire'){
      for(let j=0;j<3;j++){
        const base=x+(j-1)*r*.17,len=r*(travel?.68:.60+action*.60)*(j===1?1.07:.86),w=r*(.115+(j===1?.025:0)),lean=(j-1)*r*.18+Math.sin(p*4+j)*r*.065;
        ctx.save();ctx.translate(base,y+2);const flame=ctx.createLinearGradient(0,0,lean,-len);flame.addColorStop(0,'#bd3028');flame.addColorStop(.26,'#ea5827');flame.addColorStop(.59,'#ffaf3c');flame.addColorStop(.88,'#ffdf89');flame.addColorStop(1,'#fff6cf');
        ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-w*1.25,-len*.10,-w*1.4,-len*.34,-w*.48,-len*.51);ctx.bezierCurveTo(-w*.83,-len*.27,lean-w*.7,-len*.47,lean,-len);ctx.bezierCurveTo(lean+w*.74,-len*.73,lean+w*.93,-len*.57,lean+w*.25,-len*.43);ctx.bezierCurveTo(w*1.8,-len*.64,w*1.5,-len*.18,0,0);ctx.closePath();ctx.globalAlpha=a*.88;ctx.fillStyle=flame;ctx.fill();
        ctx.strokeStyle=c[1];ctx.globalAlpha=a*.45;ctx.lineWidth=.7;ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,-1);ctx.bezierCurveTo(-w*.65,-len*.15,-w*.30,-len*.35,lean*.48,-len*.62);ctx.bezierCurveTo(lean*.77,-len*.34,w*.64,-len*.18,0,-1);ctx.fillStyle='#fff2a8';ctx.globalAlpha=a*.73;ctx.fill();ctx.restore();
        ribbon(ctx,samples(u=>({x:base+lean+Math.sin(u*8-p*5+j)*r*.09*u,y:y-len-u*r*.25})),u=>r*.027*(1-u),c,a*.44);
      }
      light(ctx,x,y-r*.22,r*.5,c[1],a*.6);for(let j=0;j<12;j++){const v=(p+j*.087)%1;gem(ctx,x+Math.sin(j*13)*r*v*.46,y-r*v*(.3+j%3*.3),1+(j%2),c[j%3],a*(1-v)*.7,j+p);}
    }else if(type==='wind'||type==='vortex'){
      const inward=type==='vortex';for(let j=0;j<5;j++){
        const curl=samples(u=>{const h=u*(.85+action*.15),aa=h*TAU*1.2+(inward?1:-1)*p*4+j*TAU/5,rr=r*(inward?1-h*.90:.10+h*.56);return{x:x+Math.cos(aa)*rr,y:y-r*h*(inward?.9:.8)+Math.sin(aa)*rr*.29};},64);
        ribbon(ctx,curl,u=>r*.065*Math.sin(u*Math.PI),c,a*(.50-j*.055));}
      for(let j=0;j<8;j++){const u=(p+j*.119)%1,aa=u*TAU*1.5+j,rr=r*(inward?1-u:.25+u*.5);gem(ctx,x+Math.cos(aa)*rr,y-r*u*.75+Math.sin(aa)*rr*.3,(inward?1.2:3)*(1-u*.4),c[j%3],a*.55,aa);}
    }else if(type==='silk'){
      for(const side of[-1,1]){const points=samples(u=>{const t=u*TAU*1.05,reach=r*(.20+action*.75);return{x:x+side*Math.sin(t)*reach*(1-u*.3),y:y-r*.26-Math.cos(t)*r*.45+(1-u)*r*.06};},64);ribbon(ctx,points,u=>r*(.035+.068*Math.sin(u*Math.PI)),c,a*.82);ribbon(ctx,points.map((q,i)=>({x:q.x+side*2,y:q.y-2*Math.sin(i/64*Math.PI)})),.7,[c[1],c[2],c[1]],a*.82);}
    }else if(type==='dew'){
      for(let j=0;j<9;j++){const v=(p+j*.10)%1,dx=(j-4)*r*.115;gem(ctx,x+dx,y-r*(1-v)*(.55+j%3*.17),3.2-v*1.5,c[j%3],a*Math.sin(v*Math.PI),0);}
      for(let j=0;j<6;j++){const aa=j/6*TAU,pts=samples(u=>{const rr=Math.sin(u*Math.PI)*r*.42;return{x:x+Math.cos(aa)*rr,y:y-5+Math.sin(aa)*rr*.28-Math.sin(u*TAU)*r*.10};});ribbon(ctx,pts,r*.04,c,a*.5);}
      light(ctx,x,y,r*.5,c[1],a*.34);
    }else if(type==='mirror'){
      const top={x:x-r*.12,y:Math.max(8,y-r*1.5)},spread=r*(.12+action*.48),grad=ctx.createLinearGradient(top.x,top.y,x,y);grad.addColorStop(0,rgba(c[2],.02));grad.addColorStop(.5,rgba(c[1],.25));grad.addColorStop(1,rgba(c[1],0));path(ctx,[top,{x:x-spread,y},{x:x+spread,y}],true);ctx.fillStyle=grad;ctx.globalAlpha=a;ctx.fill();
      ribbon(ctx,[{x:top.x,y:top.y},{x:x-r*.03,y:y-r*.3},{x,y}],r*.035,c,a*.92);for(let j=0;j<7;j++){const aa=j/7*TAU+p*.3,rr=r*(.30+p*.42);gem(ctx,x+Math.cos(aa)*rr,y+Math.sin(aa)*rr*.3-r*.1,4+j%3,c[j%3],a*(1-p*.65),aa);}
    }else if(type==='resonance'){
      for(let j=0;j<5;j++){const t=(p+j*.17)%1,rr=r*(.1+t*.95);ring(ctx,x,y-r*.16,rr,.30,c[j%3],a*(1-t)*.68,Math.sin(j)*.10);ring(ctx,x,y-r*.16,rr*.98,.29,c[2],a*(1-t)*.15);}
      for(let j=0;j<6;j++){const aa=j/6*TAU,rr=r*(.25+action*.35);gem(ctx,x+Math.cos(aa)*rr,y-r*.16+Math.sin(aa)*rr*.31,2.2,c[1],a*.5,aa);}
    }else if(type==='stars'){
      const stars=Array.from({length:7},(_,j)=>({x:x+Math.sin(j*1.7)*r*(.3+j*.065),y:y-r*(.15+j*.13)}));
      path(ctx,stars);ctx.strokeStyle=c[1];ctx.globalAlpha=a*.32;ctx.lineWidth=.6;ctx.stroke();
      for(let j=0;j<7;j++){const s=stars[j],pulse=Math.sin(clamp((p-j*.035)*1.4)*Math.PI);light(ctx,s.x,s.y,9,c[1],a*pulse*.7);gem(ctx,s.x,s.y,4.3,c[2],a*pulse,j*.1);if(!channel)ribbon(ctx,[{x:s.x-r*.15,y:s.y-r*.18},{x:s.x,y:s.y},{x:x+(j-3)*r*.035,y:y+2}],u=>r*.018*Math.sin(u*Math.PI),c,a*pulse*.55);}
    }else if(type==='wheels'){
      for(const side of[-1,1]){const turn=p*TAU*1.35*side,xx=x+side*r*(.20+Math.sin(p*Math.PI)*.22),yy=y-r*(travel?.28:.20);wheel(ctx,xx,yy,r*.25,turn,c,a*.92);ribbon(ctx,samples(u=>({x:xx-side*u*r*.42,y:yy+u*r*.16+Math.sin(u*5-p*4)*u*r*.11})),u=>r*.045*(1-u),c,a*.60);}
    }else if(type==='pillar'||type==='clones'){
      const count=type==='pillar'?1:finish?q.clones:3;
      for(let j=0;j<count;j++){const offset=(j-(count-1)/2)*r*.39,angle=type==='pillar'?.20:(action-.45)*2.3+(j-(count-1)/2)*.22,yy=y-r*.55+Math.sin(p*Math.PI)*r*.15;
        staff(ctx,x+offset,yy,r*(type==='pillar'?1.34:1.07),angle,c,a*(1-j*.15));
        if(type==='clones')ribbon(ctx,samples(u=>{const aa=-2.8+u*action*3.3,rr=r*(.59+j*.055);return{x:x+offset+Math.cos(aa)*rr,y:yy+Math.sin(aa)*rr*.75};}),r*.041,c,a*.66);
      }
      if(type==='pillar'&&!travel){for(let j=0;j<4;j++)ribbon(ctx,samples(u=>{const aa=j*TAU/4+u*.8;return{x:x+Math.cos(aa)*u*r*.9,y:y+Math.sin(aa)*u*r*.22-Math.sin(u*Math.PI)*r*.16};}),r*.037,c,a*.45);}
    }else if(type==='cleave'||type==='crescent'||type==='rake'){
      const count=type==='cleave'?3:type==='rake'?9:1;
      for(let j=0;j<count;j++){const offset=(j-(count-1)/2)*r*(type==='rake'?.068:.17),turn=-2.55+action*2.9;
        ribbon(ctx,samples(u=>{const aa=mix(-2.55,turn,u),rr=r*(.65+j*.025);return{x:x+Math.cos(aa)*rr+offset,y:y-r*.29+Math.sin(aa)*rr*.75};}),u=>r*(type==='crescent'?.065:.027)*(1-u*.25),c,a*(1-j*.04));}
      if(type==='cleave'){gem(ctx,x,y-r*.88,5,c[2],a);ribbon(ctx,[{x,y:y-r*.83},{x,y:y-r*.3},{x,y}],r*.013,c,a*.6);}
    }else if(type==='dragon'){
      const body=samples(u=>{const aa=u*TAU*1.05-p*2.3,rr=r*(.2+u*.36);return{x:x+Math.cos(aa)*rr,y:y-r*u*.97+Math.sin(aa)*rr*.28};},72);
      ribbon(ctx,body,u=>r*.075*(.35+Math.sin(u*Math.PI)*.65),c,a*.72);ribbon(ctx,body.map(q=>({x:q.x-1,y:q.y-1})),r*.012,[c[1],c[2],c[2]],a*.85);
      for(let j=8;j<65;j+=4){const s=body[j];gem(ctx,s.x,s.y,1.4,c[1],a*.7,j*.4);}
      const head=body.at(-1);light(ctx,head.x,head.y,9,c[1],a*.6);for(const side of[-1,1])ribbon(ctx,samples(u=>({x:head.x+side*u*r*.21,y:head.y-r*.10-Math.sin(u*Math.PI)*r*.10})),r*.013,c,a*.8);
    }else if(type==='thunder'){
      // One coherent branching discharge. Geometry is stable throughout the
      // strike, with a single rise/decay rather than frame-random flashing.
      const top=Math.max(8,y-r*1.75),grow=ease(p/.19),bolt=Array.from({length:14},(_,j)=>({x:x+(j===13?0:Math.sin(j*17.13)*r*.13*(1-j/20)),y:mix(top,y,j/13*grow)}));
      if(!travel||p>.3){light(ctx,x,y,r*.46,c[1],a*.75);for(const [w,alpha] of [[r*.12,.34],[r*.051,.86],[r*.018,.98]]){path(ctx,bolt);ctx.strokeStyle=w>r*.08?c[0]:w<r*.025?c[2]:c[1];ctx.lineWidth=w;ctx.globalAlpha=a*alpha;ctx.stroke();}
        for(const j of[3,6,9]){const s=bolt[j],side=j%2?1:-1;ribbon(ctx,[s,{x:s.x+side*r*.15,y:s.y+r*.10},{x:s.x+side*r*.11,y:s.y+r*.18},{x:s.x+side*r*.30,y:s.y+r*.30}],r*.027,c,a*.78);}}
      for(let j=0;j<4;j++){const xx=x+(j-1.5)*r*.22,yy=top+Math.sin(j*2)*r*.045;ctx.beginPath();ctx.ellipse(xx,yy,r*.22,r*.09,0,0,TAU);ctx.fillStyle=c[0];ctx.globalAlpha=a*.24;ctx.fill();light(ctx,xx,yy,r*.34,c[1],a*.36);}
      if(p>.2){ring(ctx,x,y,r*(.12+action*.55),.22,c[1],a*.95);ring(ctx,x,y,r*(.10+action*.51),.20,c[2],a*.75);}
    }else if(type==='leaf'){
      for(let j=0;j<6;j++){const aa=j/6*TAU+p*2,rr=r*(.25+p*.5);gem(ctx,x+Math.cos(aa)*rr,y-r*.25+Math.sin(aa)*rr*.35,4,c[j%3],a*(1-p*.5),aa);}
    }
    ctx.restore();return q;
  }
  return Object.freeze({has,spells,timeline,ribbon,draw});
});
