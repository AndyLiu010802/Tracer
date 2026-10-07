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
    katana:{theme:'asura',frequency:1.1,speed:2.5,spread:.28,colors:['#511843','#ff4966','#fff0dd']},
    candlewyrm:{theme:'candlewyrm',frequency:2.8,speed:.55,spread:1.1,colors:['#74384a','#efaa62','#fff4b9']},
    thunderdrum:{theme:'thunderdrum',frequency:5.2,speed:1.3,spread:.8,colors:['#426387','#79def4','#fff9c7']},
    abysswhale:{theme:'abysswhale',frequency:1.6,speed:.36,spread:1.5,colors:['#164b72','#51aeca','#c8ffff']},
    foxfire:{theme:'foxfire',frequency:4.1,speed:1.2,spread:1.15,colors:['#a4323b','#ff8c4b','#ffedb8']},
    lilybell:{theme:'lilybell',frequency:1.9,speed:.4,spread:1.3,colors:['#638f75','#c9eeb7','#ffffe1']},
    sandscript:{theme:'sandscript',frequency:3.4,speed:.65,spread:.9,colors:['#97734a','#e5c083','#fff5c4']},
    frostwolf:{theme:'frostwolf',frequency:2.6,speed:.8,spread:1.1,colors:['#527dab','#b0e5fa','#f7ffff']},
    rosevow:{theme:'rosevow',frequency:2.2,speed:.44,spread:1.2,colors:['#804666','#e68da9','#ffe7cb']},
    inkjudge:{theme:'inkjudge',frequency:3.1,speed:.74,spread:1.0,colors:['#283349','#a6c1ce','#e8ffff']},
    butterfly:{theme:'butterfly',frequency:2.7,speed:.85,spread:1.35,colors:['#7660ba','#c6a9f5','#faf1ff']},
    sunforge:{theme:'sunforge',frequency:4.3,speed:.85,spread:.7,colors:['#af602d','#ffd36a','#fffbd8']},
    leviathan:{theme:'leviathan',frequency:2.4,speed:.8,spread:1.5,colors:['#22526e','#54c4cf','#e0fff0']},
    eclipse:{theme:'eclipse',frequency:3.5,speed:.48,spread:1.55,colors:['#51427c','#b2a2ec','#fff2cd']}
  });
  const design=id=>Object.prototype.hasOwnProperty.call(designs,id)?designs[id]:null;
  function sample(fn,width=.02,alpha=1,color=0,count=72){
    return {alpha,color,points:Array.from({length:count+1},(_,i)=>{const u=i/count,p=fn(u);return{...p,x:p.x,y:p.y,w:typeof width==='function'?width(u):width*Math.sin(Math.PI*u)**.8};})};
  }
  const MYTHIC_IDS=Object.freeze(['katana','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan','eclipse']);
  const SPIRIT_KINDS=Object.freeze({golden:0,phoenix:1,guandao:2,dragon:3,katana:4,candlewyrm:5,abysswhale:6,foxfire:7,frostwolf:8,inkjudge:9,leviathan:10,thunderdrum:11,lilybell:12,sandscript:13,rosevow:14,butterfly:15,sunforge:16});
  const creature=id=>['candlewyrm','abysswhale','foxfire','frostwolf','inkjudge','leviathan'].includes(id);
  const artifact=id=>['thunderdrum','lilybell','sandscript','rosevow','butterfly','sunforge'].includes(id);
  const illustrated=id=>creature(id)||artifact(id);
  const mythic=id=>MYTHIC_IDS.includes(id);
  // Animation is evaluated from one reversible phase clock. No detached image
  // pieces, setTimeout choreography, or independent opacity-only entrances.
  function mythicPose(id,state={}){
    const p=state.reduced?.48:clamp(state.progress),phase=state.phase||'summon',bite=phase==='bite',reel=phase==='reeling',caught=phase==='caught';
    const windup=ease(p/.29),strike=ease((p-.29)/.15),follow=ease((p-.44)/.26),settle=ease((p-.72)/.28),swell=Math.sin(p*Math.PI);
    const q={p,windup,strike,follow,settle,x:0,y:0,rotation:0,scale:1,orbit:0,wing:0,opening:0,draw:0,fold:settle,travel:strike,jaw:0,impact:0,reach:0};
    if(id==='katana'){q.draw=strike;q.opening=windup*(1-settle);q.rotation=-.12*windup+.23*strike-.11*settle;q.x=-.08*windup+.25*strike-.12*settle;q.y=.035*windup-.07*strike;q.impact=ease((p-.40)/.06)*(1-ease((p-.56)/.22));q.reach=strike*(1-settle*.92);}
    else if(id==='candlewyrm'){q.orbit=p*TAU*.71;q.opening=ease((p-.10)/.27);q.jaw=Math.sin(Math.PI*ease((p-.25)/.5))*.45;q.rotation=-.14+.28*strike;q.y=-swell*.12;q.reach=caught?.78:reel?.36:.55;}
    else if(id==='thunderdrum'){q.strike=ease((p-.26)/.12);q.impact=Math.sin(Math.PI*ease((p-.36)/.5));q.rotation=-.14+.28*windup;q.wing=.48*windup-.93*q.strike+.36*settle;q.orbit=p*.72;}
    else if(id==='abysswhale'){q.wing=Math.sin(p*TAU*1.1)*.5;q.rotation=-.24+.44*strike-.18*settle;q.x=-.22+.44*ease(p);q.y=-.18*swell;q.opening=.35+.65*windup;q.orbit=p*TAU*.3;}
    else if(id==='foxfire'){q.wing=Math.sin(p*TAU*1.25)*.22;q.x=-.23*windup+.45*strike-.15*settle;q.y=-.22*Math.sin(strike*Math.PI);q.opening=.32+.68*windup-.25*settle;q.rotation=-.12*windup+.25*strike-.18*settle;q.orbit=p*1.6;}
    else if(id==='lilybell'){q.opening=ease((p-.05)/.53);q.wing=Math.sin(p*TAU*1.4)*.21;q.y=.18*(1-windup);q.orbit=p*.33;}
    else if(id==='sandscript'){q.orbit=ease((p-.18)/.46)*Math.PI;q.rotation=.22*Math.sin(p*Math.PI);q.opening=windup*(1-settle*.3);q.reach=follow;}
    else if(id==='frostwolf'){q.rotation=.08-.32*strike+.1*settle;q.x=-.1+.2*strike;q.y=-.09*swell;q.wing=Math.sin(p*TAU)*.32;q.jaw=ease((p-.24)/.22)*(1-settle);q.opening=.2+.8*follow;}
    else if(id==='rosevow'){q.opening=ease((p-.08)/.47)*(1-settle*.28);q.orbit=p*.7;q.wing=follow;q.y=-.10*windup;}
    else if(id==='inkjudge'){q.wing=Math.sin((p*1.35-.18)*TAU)*.48;q.opening=windup*(1-settle*.5);q.rotation=-.2+.35*strike;q.x=.12*strike;q.draw=ease((p-.32)/.24);q.y=-.1*swell;}
    else if(id==='butterfly'){q.wing=Math.sin((p*2.15+.05)*TAU)*.74;q.opening=.45+.55*windup;q.y=-.14*ease(p);q.rotation=.12*Math.sin(p*TAU);q.orbit=p*.8;}
    else if(id==='sunforge'){q.wing=-.65*windup+1.2*strike-.28*settle;q.impact=ease((p-.42)/.06)*(1-ease((p-.63)/.35));q.opening=follow;q.rotation=.045*Math.sin(p*TAU);}
    else if(id==='leviathan'){q.jaw=Math.sin(Math.PI*ease((p-.16)/.66))*.72;q.wing=.28*Math.sin(p*TAU);q.opening=.28+.72*windup;q.orbit=p*TAU*.46;q.rotation=-.08+.16*strike;}
    else if(id==='eclipse'){q.orbit=p*TAU*.85;q.opening=(.3+.7*windup)*(1-ease((p-.64)/.34)*.72);q.draw=follow;q.rotation=.16*Math.sin(p*Math.PI);q.y=-.06*swell;}
    if(bite){q.scale=.7;q.y*=.3;}if(reel){q.scale=.8;q.x*=.4;}if(caught){q.scale=1.07;q.y-=.06;}
    return q;
  }
  function mythicGeometry(id,state={}){
    if(!mythic(id))return[];
    if(illustrated(id))return spiritWake(id,state);
    const q=mythicPose(id,state),p=q.p,forms=[],v=(x,y,z=0)=>({x,y,z}),curve=(fn,count=48)=>Array.from({length:count+1},(_,i)=>fn(i/count));
    const path=(points,color=1,alpha=.6,width=0,closed=true,light=.8)=>forms.push({points,color,alpha,width,closed,light,z:points.reduce((sum,a)=>sum+(a.z||0),0)/points.length});
    const ribbon=(fn,width=.025,color=1,alpha=.7,count=56)=>{
      const points=curve(fn,count),a=[],b=[];for(let i=0;i<points.length;i++){const pt=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(count,i+1)],d=Math.hypot(after.x-before.x,after.y-before.y)||1,w=(typeof width==='function'?width(i/count):width*Math.sin(i/count*Math.PI));a.push(v(pt.x-(after.y-before.y)/d*w,pt.y+(after.x-before.x)/d*w,pt.z));b.push(v(pt.x+(after.y-before.y)/d*w,pt.y-(after.x-before.x)/d*w,pt.z));}path(a.concat(b.reverse()),color,alpha);
    };
    const loft=(fn,rows=20,columns=8,color=1,alpha=.42)=>{
      const grid=Array.from({length:rows+1},(_,i)=>Array.from({length:columns+1},(_,j)=>fn(i/rows,j/columns)));
      for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
        const a=grid[i][j],b=grid[i+1][j],c=grid[i+1][j+1],d=grid[i][j+1],ux=b.x-a.x,uy=b.y-a.y,uz=(b.z||0)-(a.z||0),vx=d.x-a.x,vy=d.y-a.y,vz=(d.z||0)-(a.z||0),nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,norm=Math.hypot(nx,ny,nz)||1,light=.47+.5*Math.abs((-.38*nx-.52*ny+.77*nz)/norm);
        path([a,b,c,d],color,alpha,0,true,light);
      }
    };
    const ring=(rx,ry,turn=0,z=0,color=1,alpha=.6,width=.012,cx=0,cy=0)=>ribbon(u=>{const a=u*TAU,xx=Math.cos(a)*rx,yy=Math.sin(a)*ry;return v(cx+xx*Math.cos(turn)-yy*Math.sin(turn),cy+xx*Math.sin(turn)+yy*Math.cos(turn),z+Math.sin(a)*rx*.3);},()=>width,color,alpha,72);
    if(id==='katana'){
      const cut=q.strike,returning=q.settle,angle=mix(-2.68,.13,cut)+returning*1.06,grip=v(-.28+q.x,.33+q.y,.15),length=(.055+.865*cut)*(1-returning*.86),dx=Math.cos(angle),dy=Math.sin(angle),normal=v(-dy,dx);
      // The sharpened face ends in one geometric kissaki. The wide swept plane
      // is attached to the actual tip trajectory, with a leading cutting edge.
      const blade=[v(grip.x,grip.y,.12),v(grip.x+dx*(length-.13)+normal.x*.023,grip.y+dy*(length-.13)+normal.y*.023,.18),v(grip.x+dx*length,grip.y+dy*length,.21),v(grip.x+dx*(length-.1)-normal.x*.047,grip.y+dy*(length-.1)-normal.y*.047,.15),v(grip.x-normal.x*.032,grip.y-normal.y*.032,.1)];
      if(cut>0){
        const back=Math.max(0,cut-.45),fade=1-ease((p-.49)/.19),sweep=u=>{const a=mix(-2.68+back*2.81,angle,u);return v(grip.x+Math.cos(a)*1.05,grip.y+Math.sin(a)*.88,.21);};
        ribbon(sweep,u=>.066*Math.sin(u*Math.PI)**.65,1,.45*fade);
        ribbon(sweep,u=>.008*Math.sin(u*Math.PI)**.65,2,.98*fade);
      }
      if(cut>0){path(blade,2,.81,0,true,.95);path([blade[0],blade[2],blade[3],blade[4]],1,.34);}path([v(grip.x-dx*.18,grip.y-dy*.18,.12),grip],0,.96,.034,false);
      path([v(grip.x+normal.x*.095,grip.y+normal.y*.095,.16),v(grip.x-normal.x*.095,grip.y-normal.y*.095,.16)],2,.75,.018,false);
      const scar=q.impact*(1-returning),shift=.021*q.follow,scarEdge=side=>curve(u=>v(-.89+u*1.82,(-.17+u*.39)+side*Math.sin(u*Math.PI)*(.006+scar*.066)+side*shift,.23));
      const upper=scarEdge(-1),lower=scarEdge(1);path(upper.concat([...lower].reverse()),0,.9*scar,0,true,.16);
      for(const side of [-1,1])path(side<0?upper:lower,side>0?1:2,.90*scar,side>0?.009:.005,false);
      for(let k=0;k<5;k++)ribbon(u=>v(-.57+k*.26+u*.07,.02+k*.015+u*(k%2?.16:-.17)*q.impact,.02),.009,1,.4*q.impact,32);
    }else if(id==='eclipse'){
      const radius=.24+.13*q.opening;
      loft((u,w)=>{const a=u*Math.PI,b=w*TAU;return v(Math.sin(a)*Math.cos(b)*radius,Math.cos(a)*radius,Math.sin(a)*Math.sin(b)*radius);},18,24,0,.55);
      for(let k=0;k<4;k++){const a=q.orbit*(k%2?-.4:.25)+k*.7;ring((.48+k*.095)*q.opening,(.11+k*.026)*q.opening,a,0,k%3,.60-k*.08,.018-k*.003);}
      for(let k=0;k<6;k++)ribbon(u=>{const a=k/6*TAU+u*TAU*.64+q.orbit,r=(.24+u*.65)*(1-q.draw*.6);return v(Math.cos(a)*r,Math.sin(a)*r*.72,Math.sin(a)*.2);},u=>.022*Math.sin(u*Math.PI),k%2,.44,72);
      ring(radius+.024,radius+.024,0,.12,2,.86,.008);
    }
    // Project every surface with depth before sorting. The same mesh feeds the
    // Canvas animation and the catalogue, so none of the new themes is a decal.
    // Loft cells share source vertices. Project into fresh points so adjoining
    // cells never rotate an already-projected neighbour a second time.
    for(const form of forms)form.points=form.points.map(point=>{const z=point.z||0,perspective=1/(1-z*.22),xx=point.x*q.scale,yy=point.y*q.scale;return{...point,x:(xx*Math.cos(q.rotation)-yy*Math.sin(q.rotation)+q.x)*perspective,y:(xx*Math.sin(q.rotation)+yy*Math.cos(q.rotation)+q.y)*perspective};});
    return forms.sort((a,b)=>a.z-b.z);
  }
  function paintMythic(ctx,id,state,position,colors,geometry){
    if(id==='eclipse'){paintEclipse(ctx,state,position,colors,geometry);return;}
    const forms=mythicGeometry(id,state),gather=state.phase==='summon'&&!state.reduced?ease((state.progress-.69)/.27):0,size=position.size*.82;
    const place=p=>{let x=position.x+p.x*size,y=position.y+p.y*size;if(gather&&geometry?.curve){const along=clamp(.48-p.y*.38),target=geometry.curve(along);x=mix(x,target.x+p.x*2,gather);y=mix(y,target.y,gather);}return{x,y};};
    const shades=new Map(),lit=(color,light)=>{const level=Math.round(light*20),key=color+':'+level;if(shades.has(key))return shades.get(key);const n=parseInt(colors[color].slice(1),16),l=level/20,shine=Math.max(0,l-.72)*.85;const value='rgb('+[(n>>16)&255,(n>>8)&255,n&255].map(channel=>Math.round(Math.min(255,channel*(.50+l*.5)+shine*140))).join(',')+')';shades.set(key,value);return value;};
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const form of forms){if(form.alpha<.002)continue;const points=form.points.map(place);ctx.globalAlpha=state.alpha*form.alpha;ctx.fillStyle=lit(form.color,form.light);ctx.strokeStyle=colors[form.color];trace(ctx,points,form.closed);
      if(form.width){ctx.lineWidth=Math.max(.3,form.width*size*(1-gather*.7));ctx.stroke();}
      else{ctx.fill();if(form.points.length===4){ctx.globalAlpha*=.24;ctx.strokeStyle=colors[2];ctx.lineWidth=.32;ctx.stroke();}if(form.light>.85){ctx.globalAlpha=state.alpha*form.alpha*(form.light-.8)*.55;ctx.fillStyle=colors[2];ctx.fill();}}
    }ctx.restore();
  }
  function paintEclipse(ctx,state,position,colors,g){
    const q=mythicPose('eclipse',state),gather=state.phase==='summon'&&!state.reduced?ease((state.progress-.69)/.27):0,size=position.size*.82*(1-gather*.94),target=g?.curve?.(.57)||position;
    ctx.save();ctx.translate(mix(position.x,target.x,gather),mix(position.y,target.y,gather));ctx.scale(size,size);ctx.rotate(-.24+q.rotation);ctx.globalAlpha=state.alpha;
    const radius=.27+.10*q.opening,glow=ctx.createRadialGradient(0,0,radius*.66,0,0,.97);
    glow.addColorStop(0,rgba(colors[2],.12));glow.addColorStop(.30,rgba(colors[1],.10));glow.addColorStop(.61,rgba(colors[0],.035));glow.addColorStop(1,rgba(colors[0],0));ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);
    const disk=front=>{for(let layer=0;layer<15;layer++){
      const r=radius+.075+layer*.023,thickness=.013,points=[];
      for(const side of[-1,1])for(let i=0;i<=80;i++){
        const u=side<0?i/80:1-i/80,a=(front?0:Math.PI)+u*Math.PI,rr=r+side*thickness,depth=Math.sin(a),lensing=front?0:-Math.exp(-Math.pow(Math.cos(a)*r/.32,2.))*radius*.65;
        points.push({x:Math.cos(a)*rr,y:depth*rr*.24+lensing+Math.sin(a*3+q.orbit+layer*.2)*.008});
      }
      const pulse=.75+.25*Math.sin(layer*.8+q.orbit),alpha=(.11+.11*Math.sin(layer/14*Math.PI))*pulse;
      ctx.fillStyle=rgba(layer<4?colors[2]:colors[layer%3===0?0:1],alpha);trace(ctx,points,true);ctx.fill();
    }};
    disk(false);
    // One shaded volume occludes the far accretion disk. A narrow photon rim
    // and the lensed rear arc establish depth without a wireframe sphere.
    const core=ctx.createRadialGradient(-radius*.26,-radius*.28,radius*.10,0,0,radius);core.addColorStop(0,'rgba(20,16,40,.77)');core.addColorStop(.74,'rgba(5,7,19,.91)');core.addColorStop(.96,'rgba(9,9,24,.94)');core.addColorStop(1,rgba(colors[1],.70));ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.fill();
    ctx.lineWidth=.010;ctx.strokeStyle=rgba(colors[2],.82);ctx.stroke();disk(true);
    for(let k=0;k<3;k++){const points=[];for(let i=0;i<=80;i++){const u=i/80,a=q.orbit+k*TAU/3+u*1.5,r=(.94-u*.49)*(.67+.33*q.opening);points.push({x:Math.cos(a)*r,y:Math.sin(a)*r*.63});}ctx.lineWidth=.006;ctx.strokeStyle=rgba(colors[k],.29);trace(ctx,points);ctx.stroke();}
    ctx.restore();
  }
  function spiritWake(id,state){
    const q=mythicPose(id,state),p=q.p,out=[];
    const path=(fn,color=1,alpha=.5,width=.008)=>{const points=Array.from({length:65},(_,i)=>fn(i/64));out.push({points,color,alpha,width,closed:false,light:.9,z:0});};
    if(id==='abysswhale')for(let k=0;k<3;k++)path(u=>{const a=u*TAU;return{x:Math.cos(a)*(.63+q.follow*.16+k*.09),y:.43+Math.sin(a)*(.12+k*.035),z:Math.sin(a)*.22};},k===0?2:1,.38-k*.09,.008);
    else if(id==='leviathan')for(const side of[-1,1])for(let k=0;k<2;k++)path(u=>({x:side*(.82-u*.81),y:.50-Math.sin(u*Math.PI)*(.13+k*.07)+Math.sin(u*10-p*5)*.017,z:Math.sin(u*Math.PI)*side*.2}),k?2:1,.48-k*.13,.012-k*.006);
    else if(id==='foxfire')for(let k=0;k<5;k++)path(u=>({x:-.75+u*.56+k*.10,y:.42-Math.sin(u*Math.PI)*(.26+k*.04)-q.strike*.18+Math.sin(u*6+p*4+k)*.035,z:k*.01}),k%3,.30,.009);
    else if(id==='inkjudge')for(let k=0;k<3;k++)path(u=>({x:-.73+u*1.36,y:.43+k*.055-Math.sin(u*Math.PI)*.17+Math.sin(u*13+k)*.009,z:.08}),k?1:0,.55*q.draw,k?.006:.025);
    else if(id==='frostwolf')for(let k=0;k<2;k++)path(u=>{const a=u*TAU;return{x:.10+Math.cos(a)*(.58+k*.04),y:-.20+Math.sin(a)*(.58+k*.04),z:-.2};},2,.30,.008);
    else if(id==='candlewyrm')for(let k=0;k<3;k++)path(u=>({x:Math.sin(u*6+p*3+k*.7)*(.19+k*.04),y:.61-u*1.2,z:Math.cos(u*6+p*3+k*.7)*.13}),k%3,.32,.008);
    else if(id==='thunderdrum'){
      for(let k=0;k<3;k++)path(u=>{const a=u*TAU,r=.30+q.impact*.58+k*.07;return{x:Math.cos(a)*r,y:-.08+Math.sin(a)*r*.29,z:Math.sin(a)*.20};},k%2?1:2,(.46-k*.10)*q.impact,.012-k*.003);
      for(const side of[-1,1])path(u=>({x:side*(.43-u*.23)+Math.sin(u*26+p*7)*.02,y:-.51+u*.44,z:.15}),2,.45*q.impact,.007);
    }else if(id==='lilybell'){
      for(let k=0;k<5;k++)path(u=>{const a=u*TAU,r=.035+q.follow*.16;return{x:-.30+k*.16+Math.cos(a)*r,y:-.54+k*.17+Math.sin(a)*r*.30,z:Math.sin(a)*.06};},2,.20*q.opening,.005);
      for(let k=0;k<3;k++)path(u=>({x:-.23+k*.20+Math.sin(u*5+p*4+k)*.05,y:.65-u*.65-q.follow*.10,z:Math.cos(u*5)*.12}),1,.18,.004);
    }else if(id==='sandscript'){
      for(let k=0;k<9;k++)path(u=>{const h=(p*.61+k/9)%1;return{x:Math.sin(k*2.1)*.013+Math.cos(u*TAU)*.004,y:-.22+h*.54+Math.sin(u*TAU)*.006,z:.05};},2,.63,.003);
      for(const side of[-1,1])path(u=>{const a=u*Math.PI+q.orbit;return{x:Math.cos(a)*.49,y:Math.sin(a)*.19+side*.03,z:Math.sin(a)*.3};},1,.32,.005);
    }else if(id==='rosevow'){
      for(let k=0;k<4;k++)path(u=>{const a=k/4*TAU+u*1.7+q.orbit,r=.25+u*.46*q.opening;return{x:Math.cos(a)*r,y:-.20+Math.sin(a)*r*.7,z:Math.sin(a)*.14};},k%2?0:1,.25,.006);
      path(u=>({x:Math.sin(u*8-q.orbit)*.08,y:.72-u*.64,z:.12}),2,.38*q.follow,.004);
    }else if(id==='butterfly'){
      for(const side of[-1,1])for(let k=0;k<2;k++)path(u=>({x:side*(.16+u*.40),y:.35+u*.23+Math.sin(u*7+p*5+k)*.043,z:side*Math.sin(u*4)*.18}),k?2:1,.33-k*.08,.005);
    }else if(id==='sunforge'){
      for(let k=0;k<8;k++)path(u=>{const a=-Math.PI*.95+k/7*Math.PI*.91,r=u*(.19+q.impact*.55);return{x:.08+Math.cos(a)*r,y:.16+Math.sin(a)*r+u*u*.23,z:.15};},k%3,.62*q.impact,.005);
      path(u=>({x:-.32+u*.70,y:.17-Math.sin(u*Math.PI)*.014,z:.2}),2,.86*q.opening,.018);
    }
    return out;
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
    if(mythic(id)){
      const paths=mythicGeometry(id,{progress:p}).filter(form=>form.width&&form.points.length>12).slice(0,6);
      if(!paths.length)paths.push({points:mythicGeometry(id,{progress:p}).find(form=>form.points.length>12)?.points||[{x:-.5,y:0},{x:.5,y:0}],alpha:.4,color:1});
      return paths.map((form,k)=>sample(u=>{const at=u*(form.points.length-1),a=form.points[Math.floor(at)],b=form.points[Math.min(form.points.length-1,Math.floor(at)+1)],v=at-Math.floor(at);return{x:mix(a.x,b.x,v)+Math.sin(u*TAU+t*.6+k)*.007*Math.sin(u*Math.PI),y:mix(a.y,b.y,v)+Math.sin(u*3+t*.55+k)*.007*Math.sin(u*Math.PI)};},.009,form.alpha,form.color,72));
    }
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

    }
    return strands;
  }
  function eventState(id,phase,age,reduced=false){
    if(!design(id)||!['cast','reeling','caught',...(mythic(id)?['bite']:[])].includes(phase))return null;
    const caught=phase==='caught',start=caught?680:phase==='cast'?30:0,duration=caught?1260:phase==='bite'?560:phase==='cast'?640:760,p=(Math.max(0,Number(age)||0)-start)/duration;
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
    if(mythic(id))return mythicPose(id,state);
    const p=state.reduced?.42:clamp(state.progress),lift=ease((p-.08)/.38),finish=ease((p-.58)/.42),breath=Math.sin(p*Math.PI),turn=p*TAU;
    const pose={x:0,y:0,rotation:0,scale:1,orbit:0,wing:0,opening:0,draw:0,fold:finish,travel:lift};
    if(id==='moon'){pose.orbit=turn*.56;pose.rotation=-.2+.38*lift;pose.opening=.16+.77*lift;pose.y=-.12*breath;}
    else if(id==='phoenix'){pose.wing=Math.sin((p*2.4-.2)*TAU)*(.68-.2*finish);pose.rotation=-.16+.33*lift-.22*finish;pose.y=-.12*breath;pose.opening=.48+.52*lift;}
    else if(id==='cloud'){const vortex=tornadoPose(state);pose.orbit=vortex.spin;pose.opening=vortex.rise;pose.y=-.11*breath;pose.rotation=Math.sin(turn*.65)*.055;pose.draw=finish;}
    else if(id==='astral'){pose.orbit=turn*.74;pose.rotation=-.32+.5*lift;pose.opening=.45+.55*lift;pose.y=-.07*breath;}
    else if(id==='dragon'||id==='guandao'){pose.orbit=turn*(id==='guandao'?.8:1.15);pose.rotation=Math.sin(p*TAU)*.17;pose.x=Math.sin(p*TAU)*.09;pose.y=-.1*breath;pose.draw=ease((p-.22)/.38);pose.opening=.55+.45*lift;}
    else if(id==='lotus'){pose.opening=ease((p-.04)/.53)*(1-finish*.5);pose.rotation=.07*Math.sin(turn*.6);pose.y=-.1*lift;pose.orbit=turn*.12;}
    else if(id==='golden'){pose.opening=lift*(1-finish*.3);pose.rotation=.025*Math.sin(turn);pose.y=-.13*lift;pose.orbit=turn*.25;}
    return pose;
  }
  function orbitalPoint(angle,tilt,rotation,radius=1){
    const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius*Math.cos(tilt),z=Math.sin(angle)*radius*Math.sin(tilt),c=Math.cos(rotation),s=Math.sin(rotation),perspective=1/(1+z*.16);
    return{x:(x*c-y*s)*perspective,y:(x*s+y*c)*perspective,z};
  }
  function paintThemeAction(ctx,id,state,position,colors){
    if(mythic(id)){paintMythic(ctx,id,state,position,colors);return;}
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
    }else if(id==='guandao'){
      const cut=q.draw;ctx.rotate(-.17);
      if(cut>0){for(let k=0;k<3;k++){const start=3.08+k*.06,end=mix(start,-.17,cut),points=curve(u=>{const a=mix(start,end,u),r=.82+k*.045;return{x:Math.cos(a)*r,y:-Math.sin(a)*(.29+k*.026)};});stroke(points,.028-k*.007,colors[k%3],(1-k*.2)*(1-ease((p-.78)/.22)));}const a=mix(3.08,-.17,cut),head={x:Math.cos(a)*.87,y:-Math.sin(a)*.31};stroke([{x:head.x-.07,y:head.y-.06},{x:head.x+.035,y:head.y+.015}],.016,colors[2],1-ease((p-.72)/.28));}
      for(const side of [-1,1])stroke(curve(u=>({x:(u-.5)*1.7,y:.31+side*Math.sin(u*Math.PI)*.12*(.3+cut)+Math.sin(u*9-p*8)*.025})),.01,colors[1],.5*(1-p));
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
  const SUMMON_SCENES=Object.freeze({moon:{duration:2400,kind:'lunar-eclipse'},phoenix:{duration:3200,kind:'phoenix-wings',art:'summon-phoenix-v1.png'},cloud:{duration:2600,kind:'wind-vortex'},astral:{duration:2800,kind:'stellar-forge'},dragon:{duration:3200,kind:'thunder-dragon',art:'summon-azure-dragon-v1.png'},lotus:{duration:2700,kind:'lotus-bloom'},guandao:{duration:3400,kind:'azure-transformation',art:'summon-azure-dragon-v1.png'},katana:{duration:2800,kind:'asura-iaido',art:'summon-ashura-v2.png'},golden:{duration:3200,kind:'caishen',art:'golden-caishen-v1.png'},
    candlewyrm:{duration:3100,kind:'candlewyrm-nightwatch',art:'summon-candlewyrm-v1.png'},thunderdrum:{duration:2700,kind:'thunderdrum-strike',art:'summon-thunderdrum-v1.png'},abysswhale:{duration:3000,kind:'abysswhale-breach',art:'summon-abysswhale-v1.png'},foxfire:{duration:2700,kind:'foxfire-hunt',art:'summon-foxfire-v1.png'},lilybell:{duration:2600,kind:'lilybell-prayer',art:'summon-lilybell-v1.png'},sandscript:{duration:2800,kind:'sandscript-reversal',art:'summon-sandscript-v1.png'},frostwolf:{duration:2900,kind:'frostwolf-howl',art:'summon-frostwolf-v1.png'},rosevow:{duration:2900,kind:'rosevow-bloom',art:'summon-rosevow-v1.png'},inkjudge:{duration:2800,kind:'inkjudge-verdict',art:'summon-inkjudge-v1.png'},butterfly:{duration:2700,kind:'butterfly-emergence',art:'summon-butterfly-v1.png'},sunforge:{duration:3000,kind:'sunforge-smelting',art:'summon-sunforge-v1.png'},leviathan:{duration:3300,kind:'leviathan-command',art:'summon-leviathan-v1.png'},eclipse:{duration:3400,kind:'eclipse-collapse'}});
  const summonScene=id=>Object.prototype.hasOwnProperty.call(SUMMON_SCENES,id)?SUMMON_SCENES[id]:null;
  const spiritImageCaches=new WeakMap();
  function imageLease(doc){
    let cache=spiritImageCaches.get(doc);if(!cache){cache=new Map();spiritImageCaches.set(doc,cache);}let held=null;
    const trim=()=>{const spare=[...cache.entries()].filter(([,entry])=>!entry.refs);while(spare.length>2)cache.delete(spare.shift()[0]);};
    const release=()=>{if(held){held.refs--;held=null;trim();}};
    return{get(id){const art=summonScene(id)?.art;if(!art){release();return null;}if(held?.art===art)return held.image;release();
      let entry=cache.get(art);if(!entry){const Image=doc.defaultView?.Image;if(!Image)return null;const image=new Image();image.decoding='async';image.src='/fishing-art/'+art;entry={art,image,refs:0};cache.set(art,entry);}cache.delete(art);cache.set(art,entry);held=entry;entry.refs++;trim();return entry.image;},destroy:release};
  }
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
    const p=state.reduced?.38:state.progress,baseHeight=Math.min(g.height*(id==='golden'?.61:.72),202,g.width*(illustrated(id)?.45:.38)/aspect),breathe=state.reduced?1:1+.025*Math.sin(ease((p-.12)/.38)*Math.PI),height=baseHeight*breathe,width=height*aspect;
    const pad=illustrated(id)||id==='katana'?20:0,placement=summonPlacement(id,g,width+pad,height+pad),x=placement.x,y=Math.max(placement.top+(height+pad)/2,Math.min(placement.bottom-(height+pad)/2,placement.y-(state.reduced?0:6*(1-ease(p/.22)))));
    return{width,height,x,y,alpha:state.alpha*(state.reduced?.55:.86)*(1-ease((p-.79)/.18))};
  }

  function paintSummonScene(ctx,id,state,g,colors){
    if(mythic(id)){const size=Math.min(id==='katana'?64:98,g.width*(id==='katana'?.17:.26),g.height*(id==='katana'?.25:.37)),origin=summonPlacement(id,g,size*1.95,size*1.95);paintMythic(ctx,id,{...state,phase:'summon'},{...origin,size},colors,g);return;}
    if(id==='cloud'){const size=Math.min(62,g.width*.155,g.height*.22),origin=summonPlacement(id,g,size*2.2,size*2.2);paintTornado(ctx,{...state,phase:'summon'},{...origin,size},colors,g,state.reduced?0:state.progress*2.6);return;}
    const p=state.reduced?.4:state.progress,closing=state.reduced?0:state.gather,fullSize=Math.min(id==='lotus'?48:55,g.width*.145,g.height*.21),size=fullSize*(1-closing*.84),origin=summonPlacement(id,g,fullSize*2.2,fullSize*2.2);
    if(!state.reduced&&g.curve){const target=g.curve(.22+closing*.68);origin.x=mix(origin.x,target.x,closing);origin.y=mix(origin.y,target.y,closing);}
    if(['moon','astral','lotus'].includes(id))paintThemeAction(ctx,id,state,{...origin,size},colors);
    if(id==='dragon')for(let k=0;k<3;k++)paint(ctx,sample(u=>{const a=u*TAU*.8+k*2.1+p*2,r=size*(.45+u*.55)*(1-closing*.6),j=Math.sin(u*39+k-p*5)*Math.sin(u*Math.PI)*2;return{x:origin.x+Math.cos(a)*r+j,y:origin.y+Math.sin(a)*r*.8};},u=>Math.sin(u*Math.PI)*.65,.6,2),colors,state.alpha*.55);
  }
  // One continuous texture is deformed in a shader: the wings and dragon body
  // move without visible joints, cropped sprite strips or separable body parts.
  function createSpiritSurface(doc){
    const canvas=doc.createElement('canvas');const gl=canvas.getContext?.('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});if(!gl)return null;
    const shaders=[],program=gl.createProgram(),buffer=gl.createBuffer(),texture=gl.createTexture(),textureCanvas=doc.createElement('canvas'),textureContext=textureCanvas.getContext('2d');
    function shader(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))return false;gl.attachShader(program,s);return true;}
    const ok=shader(gl.VERTEX_SHADER,`
      precision mediump float;attribute vec2 a;varying vec2 uv;
      uniform float p,kind,quiet,action;uniform vec4 choreography;uniform vec2 viewport;uniform vec4 portrait;uniform vec2 shaft[9];
      vec2 rod(float u){float t=clamp(u,0.,.99999)*8.;vec2 point=shaft[0];for(int i=0;i<8;i++){if(t>=float(i)&&t<float(i+1))point=mix(shaft[i],shaft[i+1],t-float(i));}return point;}
      vec2 hinge(vec2 point,vec2 pivot,float angle){vec2 d=point-pivot;return pivot+mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*d;}
      void main(){
        uv=a;float pi=3.14159265,t=p*pi*2.,m=quiet>.5||action>.5?0.:smoothstep((kind>3.5?.68:.48)+.035*(1.-a.y),kind>3.5?.96:.86,p);
        vec2 local=(a-.5)*portrait.zw*vec2(1.,-1.);
        if(quiet<.5){
          if(kind>10.5){
            if(kind<11.5){
              // Both mallets rotate from their outboard grips. The drum shell
              // remains rigid; only its membrane and suspended tassels respond.
              float side=a.x<.5?-1.:1.;
              float rim=mix(.80,.66,smoothstep(.0,.40,abs(a.x-.5)));
              float mallet=smoothstep(rim,rim+.026,a.y)*smoothstep(.08,.18,abs(a.x-.5));
              local=hinge(local,vec2(side*.445,-.215)*portrait.zw,side*mallet*choreography.x*.80);
              float head=exp(-pow((a.x-.50)/.27,2.))*exp(-pow((a.y-.62)/.07,2.));
              local.y+=head*sin(t*9.)*sin(p*pi)*portrait.w*.004;
            }else if(kind<12.5){
              // Five bell stems have distinct pedicels, all connected to the
              // curved main stem rooted near image (.55,.91).
              float stem=smoothstep(.10,.90,a.y);
              local=hinge(local,vec2(.05,.41)*portrait.zw,sin(t*.70)*.027*stem);
              for(int i=0;i<5;i++){
                float k=float(i),bx=.30+k*.079,by=.88-k*.092-k*k*.002;
                float bell=exp(-pow((a.x-bx)/.060,2.))*exp(-pow((a.y-(by-.060))/.061,2.));
                local=hinge(local,vec2(bx-.5,.5-by)*portrait.zw,bell*sin(t*1.4-k*.32)*.14);
              }
              float leaf=(1.-smoothstep(.24,.57,a.y))*smoothstep(.04,.23,abs(a.x-.55));
              local=hinge(local,vec2(.05,.41)*portrait.zw,leaf*sin(t*.75)*.026);
            }else if(kind<13.5){
              // A rigid hourglass reverses about the narrow waist. Perspective
              // compression during the turn keeps its complete frame visible.
              float flip=choreography.z,depth=sin(flip);
              local=hinge(local,vec2(.01,-.01)*portrait.zw,flip);
              local*=1.-.16*abs(depth);local.x*=1.-.06*abs(depth);
            }else if(kind<14.5){
              vec2 bloom=vec2(.055,-.205)*portrait.zw;
              float flower=smoothstep(.43,.61,a.y)*(1.-smoothstep(.68,.85,a.x));
              float r=length((local-bloom)/portrait.zw);
              float opening=(choreography.y-.60)*flower*smoothstep(.05,.23,r);
              local=bloom+(local-bloom)*(1.+opening*.13);
              float leaf=(1.-smoothstep(.20,.45,a.y))*smoothstep(.05,.26,abs(a.x-.5));
              local=hinge(local,vec2(.005,.18)*portrait.zw,sign(a.x-.5)*leaf*sin(t*.65)*.06);
            }else if(kind<15.5){
              // Four distinct wing roots: forewings lead, hindwings lag. Their
              // foreshortening is a rotation in depth, never scaling the thorax.
              float side=a.x<.5?-1.:1.,wing=smoothstep(.030,.16,abs(a.x-.5));
              float upper=smoothstep(.43,.51,a.y),flap=choreography.x*mix(.83,1.,upper);
              vec2 pivot=vec2(side*.025,mix(.025,-.015,upper))*portrait.zw;
              vec2 d=local-pivot;d.x*=1.-wing*(1.-cos(flap));d.y+=wing*abs(d.x)*sin(flap)*.20;
              local=pivot+d;
            }else{
              // The forge/anvil is stationary. The separate right-hand hammer
              // hinges at its actual handle end and strikes the upper work face.
              float handle=.56-.11*smoothstep(.66,.95,a.x);
              float hammer=smoothstep(.57,.70,a.x)*smoothstep(handle,handle+.025,a.y);
              local=hinge(local,vec2(.435,.015)*portrait.zw,-hammer*choreography.x*.81);
              vec2 sun=vec2(-.12,-.185)*portrait.zw;
              float crown=(1.-smoothstep(.55,.69,a.x))*smoothstep(.52,.68,a.y);
              local=hinge(local,sun,crown*sin(t*.45)*.022);
            }
          }else if(kind>4.5){
            if(kind<5.5){
              float spine=sin(a.y*pi),wave=sin(a.y*7.-choreography.z);
              float head=smoothstep(.48,.75,a.x)*smoothstep(.59,.83,a.y);
              local.x+=wave*spine*(1.-head)*portrait.z*.037;
              local.y+=cos(a.y*6.-choreography.z)*spine*portrait.w*.014;
              local=hinge(local,vec2(.12,-.12)*portrait.zw,head*(choreography.w*.09-.035));
              float claw=exp(-pow((a.x-.47)/.15,2.))*exp(-pow((a.y-.46)/.12,2.));
              local=hinge(local,vec2(-.07,.02)*portrait.zw,claw*sin(t*.7)*.11);
            }else if(kind<6.5){
              // Humpback: the caudal peduncle drives the left flukes vertically;
              // lower pectorals sweep behind, while the right cranium stays firm.
              float tail=1.-smoothstep(.12,.46,a.x),flipper=(1.-smoothstep(.18,.42,a.y))*exp(-pow((a.x-.54)/.28,2.));
              local=hinge(local,vec2(-.24,-.05)*portrait.zw,tail*sin(t*1.05)*.18);
              local=hinge(local,vec2(.11,.05)*portrait.zw,flipper*choreography.x*.42);
            }else if(kind<7.5){
              // Seven fox tails fan from the haunch at image (.51,.40), rather
              // than flexing the pointed face or scaling the entire picture.
              vec2 pivot=vec2(-.02,.06)*portrait.zw;
              float tails=(1.-smoothstep(.42,.77,a.x))*smoothstep(.25,.64,a.y);
              float angle=tails*(sin(t*.9+(a.x+a.y)*2.)*.065+choreography.y*.07);
              vec2 d=local-pivot;local=pivot+mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*d;
              float foreleg=(1.-smoothstep(.12,.35,a.y))*smoothstep(.57,.77,a.x);
              float hindleg=(1.-smoothstep(.15,.32,a.y))*exp(-pow((a.x-.42)/.13,2.));
              local=hinge(local,vec2(.21,.17)*portrait.zw,foreleg*choreography.x*.48);
              local=hinge(local,vec2(-.04,.18)*portrait.zw,-hindleg*choreography.x*.38);
            }else if(kind<8.5){
              float head=smoothstep(.52,.78,a.x)*smoothstep(.43,.70,a.y),leg=(1.-smoothstep(.14,.37,a.y))*smoothstep(.61,.84,a.x);
              local=hinge(local,vec2(.19,-.03)*portrait.zw,-head*choreography.y*.10);
              local=hinge(local,vec2(.21,.13)*portrait.zw,leg*choreography.x*.30);
              float tail=(1.-smoothstep(.14,.38,a.x))*smoothstep(.38,.70,a.y);
              local=hinge(local,vec2(-.18,-.01)*portrait.zw,tail*sin(t*.65)*.07);
            }else if(kind<9.5){
              float wing=smoothstep(.06,.40,abs(a.x-.5))*smoothstep(.30,.72,a.y);
              float side=a.x<.5?-1.:1.;
              local=hinge(local,vec2(side*.12,-.015)*portrait.zw,side*wing*choreography.x*.38);
              local.x*=1.+wing*choreography.x*.08;
              local.x+=(1.-smoothstep(.15,.45,a.y))*sin(t*.8)*portrait.z*.025;
            }else{
              float jaw=exp(-pow((a.y-.65)/.075,2.))*smoothstep(.61,.84,a.x);
              local=hinge(local,vec2(.16,-.18)*portrait.zw,-jaw*choreography.y*.15);
              float side=a.x<.50?-1.:1.,fins=smoothstep(.16,.40,abs(a.x-.48))*exp(-pow((a.y-.55)/.22,2.));
              local=hinge(local,vec2(side<0.?-.10:.01,-.045)*portrait.zw,side*fins*choreography.x*.40);
              float tail=(1.-smoothstep(.18,.37,a.y))*smoothstep(.54,.86,a.x);
              local=hinge(local,vec2(.20,.29)*portrait.zw,-tail*sin(t*.8)*.13);
            }
          }else if(kind>3.5){
            // Continuous shoulder/elbow/wrist weights articulate the one-piece
            // guardian. The root and mask remain steady: this is not a dragon
            // sine warp or separately rotated strips of the illustration.
            float draw=smoothstep(.29,.44,p),recover=smoothstep(.72,1.,p),load=smoothstep(0.,.29,p);
            float side=a.x<.5?-1.:1.;
            vec2 shoulder=vec2(side*.235,-.115)*portrait.zw;
            float upper=exp(-pow((a.y-.51)/.17,2.))*smoothstep(.06,.28,abs(a.x-.5));
            float forearm=exp(-pow((a.y-.43)/.105,2.))*exp(-pow((abs(a.x-.5)-.14)/.16,2.));
            float angle=side*(load*.07-draw*.22+recover*.16)*upper;
            vec2 delta=local-shoulder;
            local=shoulder+mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*delta;
            local.x+=forearm*(draw-recover*.88)*portrait.z*(side<0.?-.11:.045);
            local.y+=forearm*(load*.024-draw*.065+recover*.045)*portrait.w;
            float rear=smoothstep(.26,.46,abs(a.x-.5))*(1.-smoothstep(.30,.53,a.y));
            local.x+=side*rear*sin(draw*pi)*portrait.z*.035;
            float cloak=(1.-smoothstep(.05,.32,a.y));
            local.x+=cloak*sin(a.y*12.+a.x*5.-t*.6)*portrait.z*.012;
          }else if(kind>.5&&kind<1.5){
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
        float turn=quiet>.5||kind>3.5?0.:sin(p*pi*2.)*(kind>1.5?.12:kind<.5?.035:.06);
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
        vec4 c=texture2D(art,q,-.55);if(c.a<.002){gl_FragColor=vec4(0.);return;}
        float e=.004,dx=relief(q+vec2(e,0.))-relief(q-vec2(e,0.)),dy=relief(q+vec2(0.,e))-relief(q-vec2(0.,e));
        // Rounded volume plus painted relief keeps the face, scales and folds
        // under one moving light. The transparent desktop itself is not sampled.
        float reliefStrength=kind>3.5?.72:2.4;
        vec3 n=normalize(vec3((q.x-.5)*1.25-dx*reliefStrength,(q.y-.5)*.6-dy*reliefStrength,.78));
        vec3 light=normalize(vec3(-.52,.68,1.)),halfLight=normalize(light+vec3(0.,0.,1.));
        float diffuse=dot(n,light),spec=pow(max(0.,dot(n,halfLight)),34.);
        float edge=clamp(length(vec2(dx,dy))*3.4+pow(1.-n.z,2.)*.7,0.,1.);
        if(kind>3.5){float ax=texture2D(art,q+vec2(e,0.)).a-texture2D(art,q-vec2(e,0.)).a,ay=texture2D(art,q+vec2(0.,e)).a-texture2D(art,q-vec2(0.,e)).a;edge=clamp(length(vec2(ax,ay))*2.2+pow(1.-n.z,2.)*.3,0.,1.);}
        vec3 tint=kind>15.5?vec3(1.,.87,.52):kind>14.5?vec3(.80,.72,1.):kind>13.5?vec3(1.,.35,.52):kind>12.5?vec3(1.,.84,.57):kind>11.5?vec3(.82,1.,.72):kind>10.5?vec3(.55,.86,1.):kind>9.5?vec3(.38,.92,.91):kind>8.5?vec3(.70,.83,.94):kind>7.5?vec3(.67,.88,1.):kind>6.5?vec3(1.,.65,.32):kind>5.5?vec3(.39,.75,1.):kind>4.5?vec3(1.,.65,.31):kind>3.5?vec3(1.,.29,.41):kind<.5||kind>2.5?vec3(1.,.85,.49):kind<1.5?vec3(1.,.65,.3):vec3(.57,1.,.9);
        if(kind>2.5&&kind<3.5){float l=dot(c.rgb,vec3(.299,.587,.114));c.rgb=mix(c.rgb,vec3(l*1.25,l*.91,l*.42),.74);}
        float band=exp(-pow((q.x*.8+q.y*.35-.12-(quiet>.5?.45:p)*.76)/.065,2.));
        vec3 transmission=mix(c.rgb,tint,kind>3.5?.035:.42)*(.85+.25*diffuse);
        vec3 crystal=transmission+vec3(1.,.98,.92)*(kind>3.5?spec*.07+edge*.065+band*.045:spec*.3+edge*.28+band*.16);
        // Light is carried mostly by the relief and rim. Hollow interiors and
        // a thinning lower body reveal the desktop through the apparition.
        float density=clamp(.43+edge*.55+spec*.17+band*.13,.35,.88);
        if(kind>3.5&&kind<4.5){
          float interior=exp(-pow((q.x-.5)/.29,2.))*exp(-pow((q.y-.52)/.27,2.));
          float fissure=pow(max(0.,sin(q.x*38.+q.y*21.+t*.22)),18.);
          density=clamp(.74-interior*.08+edge*.22+spec*.08+band*.06+fissure*.025,.58,.96);
          crystal+=vec3(.30,.11,.20)*(edge*.5+fissure*.12);
        }
        if(kind>4.5)density=clamp(.71+edge*.19+spec*.09+band*.05,.64,.96);
        float veil=.88+.12*sin(q.y*13.+q.x*8.-t*.5);
        float spiritAlpha=c.a*density*(.55+.45*smoothstep(.02,.3,q.y))*veil;
        float forging=quiet>.5||action>.5?0.:smoothstep(.52,.85,p);
        crystal=mix(crystal,tint*1.15+vec3(.16),forging*.72);
        gl_FragColor=vec4(clamp(crystal,0.,1.)*spiritAlpha,spiritAlpha);
      }`);
    gl.linkProgram(program);let disposed=false,lastImage=null;
    const destroy=()=>{if(disposed)return;disposed=true;for(const s of shaders)gl.deleteShader(s);gl.deleteProgram(program);gl.deleteBuffer(buffer);gl.deleteTexture(texture);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.width=canvas.height=textureCanvas.width=textureCanvas.height=1;};
    if(!ok||!gl.getProgramParameter(program,gl.LINK_STATUS)){destroy();return null;}
    const vertices=[];for(let y=0;y<48;y++)for(let x=0;x<40;x++){const l=x/40,r=(x+1)/40,b=y/48,t=(y+1)/48;vertices.push(l,b,r,b,l,t,l,t,r,b,r,t);}
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.bindTexture(gl.TEXTURE_2D,texture);for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    const uniforms=Object.fromEntries(['p','kind','quiet','action','choreography','viewport','portrait','shaft[0]'].map(k=>[k,gl.getUniformLocation(program,k)]));
    return{draw(image,id,state,pose,g){if(disposed||gl.isContextLost())return null;
      const ratio=Math.min(2,doc.defaultView?.devicePixelRatio||1),w=Math.ceil(g.width*ratio),h=Math.ceil(g.height*ratio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      if(lastImage!==image){
        // All source art is larger than its desktop manifestation. A single
        // bilinear tap aliases fine scales/engraving into glittering wire. Use
        // a prefiltered POT surface so WebGL1 can sample proper mip levels.
        if(textureContext){textureCanvas.width=Math.min(1024,2**Math.ceil(Math.log2(image.naturalWidth)));textureCanvas.height=Math.min(2048,2**Math.ceil(Math.log2(image.naturalHeight)));textureContext.imageSmoothingEnabled=true;textureContext.imageSmoothingQuality='high';textureContext.clearRect(0,0,textureCanvas.width,textureCanvas.height);textureContext.drawImage(image,0,0,textureCanvas.width,textureCanvas.height);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textureCanvas);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
        else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        lastImage=image;
      }
      gl.uniform1f(uniforms.p,state.progress);gl.uniform1f(uniforms.kind,SPIRIT_KINDS[id]??2);gl.uniform1f(uniforms.quiet,state.reduced?1:0);
      const poseMotion=themePose(id,state);gl.uniform1f(uniforms.action,state.action?1:0);gl.uniform4f(uniforms.choreography,poseMotion.wing,id==='leviathan'?poseMotion.jaw:poseMotion.opening,poseMotion.orbit,poseMotion.draw);
      gl.uniform2f(uniforms.viewport,g.width,g.height);gl.uniform4f(uniforms.portrait,pose.x,pose.y,pose.width,pose.height);
      const points=[];for(let i=0;i<=8;i++){const point=g.curve?g.curve(i/8):{x:mix(g.grip.x,g.tip.x,i/8),y:mix(g.grip.y,g.tip.y,i/8)};points.push(point.x,point.y);}gl.uniform2fv(uniforms['shaft[0]'],new Float32Array(points));
      gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);return canvas;},destroy};
  }
  function createSummon(host){
    const doc=host.ownerDocument,win=doc.defaultView||globalThis,canvas=doc.createElement('canvas'),ctx=canvas.getContext?.('2d',{alpha:true});if(!ctx)return null;
    canvas.className='fishing-summon-canvas';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);let disposed=false,spiritSurface=null,spiritAttempted=false;const images=imageLease(doc);
    function draw(rod,state,g){
      if(disposed)return;images.get(rod?.id);canvas.hidden=!state;if(!state){canvas.dataset.tier='';canvas.dataset.apparition='';return;}
      const ratio=Math.min(2,win.devicePixelRatio||1),width=Math.max(1,Math.ceil(g.width*ratio)),height=Math.max(1,Math.ceil(g.height*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,g.width,g.height);canvas.dataset.tier=state.tier;canvas.dataset.progress=String(state.progress);
      const valid=c=>/^#[0-9a-f]{6}$/i.test(c||''),colors=design(rod?.id)?.colors||[valid(rod?.color)?rod.color:'#8da392',valid(rod?.accent)?rod.accent:'#c5dfcf','#fff5dc'];
      ctx.save();canvas.dataset.apparition='';canvas.dataset.scene=state.kind;canvas.dataset.stage=state.departing?'depart':state.stage;canvas.dataset.gather=String(state.gather);
      const scene=summonScene(rod?.id);if(rod?.id!=='katana')paintSummonScene(ctx,rod?.id,state,g,colors);
      if(scene?.art){
        const image=images.get(rod.id);
        if(image?.complete&&image.naturalWidth){
          const pose=caishenPose(state,g,image.naturalWidth/image.naturalHeight,rod.id);canvas.dataset.apparition=scene.kind;canvas.dataset.spiritAlpha=String(pose.alpha);
          if(!spiritAttempted){spiritAttempted=true;spiritSurface=createSpiritSurface(doc);}
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
      if(rod?.id==='katana')paintSummonScene(ctx,rod.id,state,g,colors);
      for(const strand of summonField(rod,state,g))paint(ctx,strand,colors,state.alpha*(scene?.art?.08+.82*state.gather:1));ctx.restore();
    }
    return{draw,preload:rod=>disposed?null:images.get(rod?.id),destroy(){if(disposed)return;disposed=true;images.destroy();spiritSurface?.destroy();spiritSurface=null;canvas.width=canvas.height=1;canvas.remove();}};
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
    let width=0,height=0,ratio=0,disposed=false,lastVariant='',history=[],spiritSurface=null,spiritAttempted=false;const images=imageLease(doc);
    function draw(profile,phase,age,values,g,tip,point,control1,control2,reduced=false){
      if(disposed)return;
      const info=design(profile?.variant);canvas.hidden=!info;if(!info){history=[];return;}
      const dpr=Math.min(2,win.devicePixelRatio||1);
      if(g.width!==width||g.height!==height||ratio!==dpr){width=g.width;height=g.height;ratio=dpr;canvas.width=Math.max(1,Math.ceil(width*dpr));canvas.height=Math.max(1,Math.ceil(height*dpr));}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(0,0,Math.max(0,width-40),height);ctx.clip();
      const id=profile.variant;
      images.get(id);const t=reduced?0:age/1000,power=phase==='charging'?clamp(values.castPower):phase==='reeling'?clamp(values.tension):.15,energy=(reduced?.16:.44+power*.3)*profile.energy;
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
        const position=layout(id,state,g,tip,point),p=reduced?.45:state.progress,shape=mythic(id)?[]:flow(id,t,p),size=position.size*(.76+.24*ease(p/.3));
        const articulated=mythic(id)||['moon','cloud','astral','lotus','guandao','phoenix'].includes(id),spirit=!!summonScene(id)?.art&&(illustrated(id)||phase==='caught'&&['phoenix','dragon','guandao','katana'].includes(id)),poseMotion=themePose(id,state);
        canvas.dataset.action=articulated||spirit?(id==='cloud'?'tornado':id)+'-'+phase:'';
        if(articulated&&!(id==='phoenix'&&spirit)&&!(id==='katana'&&spirit))paintThemeAction(ctx,id,{...state,alpha:state.alpha*profile.energy},{...position,size},info.colors);
        if(id!=='cloud'&&!mythic(id))for(const strand of shape)paint(ctx,transform(strand,position.x,position.y,size),info.colors,state.alpha*profile.energy*(articulated?.2:spirit?.28:1));
        if(spirit){
          const art=images.get(id);
          if(art?.complete&&art.naturalWidth){
            if(!spiritAttempted){spiritAttempted=true;spiritSurface=createSpiritSurface(doc);}
            const aspect=art.naturalWidth/art.naturalHeight,h=size*1.43,w=h*aspect,portrait={x:position.x+poseMotion.x*size,y:position.y+poseMotion.y*size,width:w,height:h},surface=spiritSurface?.draw(art,id,{...state,action:true},portrait,{...g,tip});
            ctx.globalAlpha=state.alpha*(reduced?.25:.72)*profile.energy;if(surface)ctx.drawImage(surface,0,0,width,height);else ctx.drawImage(art,portrait.x-w/2,portrait.y-h/2,w,h);
            canvas.dataset.spiritRenderer=surface?'webgl':'canvas';
          }
        }
        if(id==='katana'&&spirit)paintThemeAction(ctx,id,{...state,alpha:state.alpha*profile.energy},{...position,size},info.colors);
        if(id==='golden'&&phase==='caught')paintCoin(ctx,position.x,position.y,size,state);
        if(!reduced){
          const count=id==='golden'||id==='cloud'||mythic(id)?0:18;
          for(let i=0;i<count;i++){
            const source=shape[i%shape.length].points,u=(i*.618+t*(id==='phoenix'?.31:.12))%1,j=Math.floor(u*(source.length-5))+2,pt=source[j],prior=source[j-2],drift=(.5+.5*Math.sin(i*7.3+t))*state.progress,px=position.x+pt.x*size,py=position.y+pt.y*size-drift*size*.12,life=Math.sin(u*Math.PI)*state.alpha*(.28+i%3*.11);
            ctx.globalAlpha=life;ctx.strokeStyle=info.colors[i%5===0?2:1];ctx.lineWidth=i%4===0?1.1:.6;ctx.beginPath();ctx.moveTo(px+(prior.x-pt.x)*size*1.4,py+(prior.y-pt.y)*size*1.4);ctx.lineTo(px,py);ctx.stroke();
          }
        }
      }
      ctx.restore();ctx.globalAlpha=1;
    }
    return{draw,destroy(){if(disposed)return;disposed=true;history=[];images.destroy();spiritSurface?.destroy();spiritSurface=null;canvas.width=canvas.height=1;canvas.remove();}};
  }
  function catalogMarkup(rod,id,curve){
    const info=design(rod.id);if(!info)return'';
    if(mythic(rod.id))return catalogMythicMarkup(rod,id,curve,info);
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
  function catalogMythicMarkup(rod,id,curve,info){
    const center=curve(.52),size=rod.id==='katana'?51:48,glow=id+'-mythic-halo',colors=info.colors,forms=mythicGeometry(rod.id,{progress:.48,reduced:true}),groups=new Map(),lines=[];
    const d=points=>points.map((point,i)=>(i?'L':'M')+f(center.x+point.x*size)+' '+f(center.y+point.y*size)).join('');
    // Merge adjoining faces with the same material for compact catalogue DOM.
    // Live motion still renders and depth-sorts every continuous surface.
    for(const form of forms){
      if(form.alpha<.01)continue;
      if(form.width){lines.push('<path d="'+d(form.points)+'" fill="none" stroke="'+colors[form.color]+'" stroke-opacity="'+f(form.alpha*.75)+'" stroke-width="'+f(Math.max(.4,form.width*size))+'" stroke-linecap="round"/>');continue;}
      const alpha=Math.round(form.alpha*8)/8,key=form.color+':'+alpha;
      if(!groups.has(key))groups.set(key,{color:colors[form.color],alpha,paths:[]});groups.get(key).paths.push(d(form.points)+'Z');
    }
    const surfaces=[...groups.values()].map(group=>'<path data-crystal-surface="true" d="'+group.paths.join('')+'" fill="'+group.color+'" fill-opacity="'+f(group.alpha*.68)+'"/>').join('');
    const art=illustrated(rod.id)&&summonScene(rod.id)?.art,portrait=art?'<image href="/fishing-art/'+art+'" x="'+f(center.x-66)+'" y="'+f(center.y-68)+'" width="132" height="132" opacity=".55" preserveAspectRatio="xMidYMid meet"/>':'';
    return'<g class="fishing-catalog-fx fishing-catalog-fluid" data-fx-theme="'+info.theme+'" data-fx-variant="'+rod.id+'" data-fx-surface="articulated-crystal" style="--rod-glow:'+colors[1]+';--rod-accent:'+colors[0]+';--fx-energy:'+(rod.rarity==='legendary'?1:.85)+'" aria-hidden="true"><defs><radialGradient id="'+glow+'"><stop stop-color="'+colors[1]+'" stop-opacity=".11"/><stop offset="1" stop-color="'+colors[0]+'" stop-opacity="0"/></radialGradient></defs><ellipse class="fishing-catalog-halo" cx="'+f(center.x)+'" cy="'+f(center.y)+'" rx="55" ry="63" fill="url(#'+glow+')"/><g class="fishing-catalog-flow">'+surfaces+lines.join('')+portrait+'</g></g>';
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
  return Object.freeze({design,flow,themePose,mythicPose,mythicGeometry,tornadoPose,tornadoPoint,tornadoField,orbitalPoint,coinPose,paintCoin,envelope,eventState,layout,summonScene,summonState,summonField,summonPlacement,caishenPose,createSummon,create,catalogMarkup});
});
