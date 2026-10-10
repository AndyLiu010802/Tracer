(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingExpansionEffects=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const Crafted=typeof module==='object'&&module.exports?require('./fishing-crafted-rods'):globalThis.TracerFishingCraftedRods;
  const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const catalog=Object.fromEntries(Object.entries(Crafted?.catalog||{}).filter(([,r])=>!r.animeAction)),designs={},scenes={},spells={},kinds={};
  let kind=30;
  for(const [id,r]of Object.entries(catalog)){
    spells[id]=[r.spell,r.color,r.accent,'#fff0cd'];
    if(r.rarity!=='common')designs[id]={theme:id,frequency:1.5+r.craft.variant%7*.37,speed:.48+r.craft.variant%5*.12,spread:.65+r.craft.variant%4*.17,colors:spells[id].slice(1)};
    if(r.apparition){scenes[id]={duration:r.rarity==='legendary'?3400:3000,kind:'crafted-'+id,art:'summon-expansion-'+id+'-v1.png'};kinds[id]=kind++;}
  }
  const has=id=>Object.hasOwn(catalog,id);
  function rig(id){const r=catalog[id];if(!r)return[0,0,0,0];const humanoid=/waist-up/.test(r.apparition||''),k=r.craft.kind;return[humanoid?0:['feather','phoenix','scarab'].includes(k)?1:['bull','qilin','tiger','lion'].includes(k)?2:['clock','astrolabe','mechanism'].includes(k)?3:['silk','moon','web','bone','tree'].includes(k)?4:5,.68+r.craft.variant%5*.08,.77+r.craft.variant%7*.11,r.craft.variant%2?-1:1];}
  function pose(id,state={}){
    const r=catalog[id],p=state.reduced?.46:clamp(state.progress||0),windup=ease(p/.30),strike=ease((p-.30)/.20),follow=ease((p-.50)/.27),settle=ease((p-.79)/.21),pulse=Math.sin(p*Math.PI),seed=r?.craft.variant||0;
    const q={p,x:0,y:0,rotation:0,scale:1,wing:0,opening:windup,draw:strike,orbit:p*TAU*(.45+seed%3*.15),fold:settle,travel:strike,jaw:0,impact:Math.sin(Math.PI*ease((p-.34)/.36)),reach:strike*(1-settle),windup,strike,follow,settle};
    switch(r?.spell){
      case 'spear':case 'halberd':case 'cleave':case 'dragon':q.wing=-.35*windup+.88*strike-.34*settle;q.x=-.045*windup+.10*strike-.05*settle;q.rotation=-.075*windup+.09*strike;break;
      case 'redcliffs':case 'fire':q.wing=.5*windup-.3*strike;q.y=-.045*pulse;q.rotation=.055*Math.sin(p*TAU);break;
      case 'eastwind':case 'feather':case 'phoenix':q.wing=Math.sin(p*TAU*1.3)*.60;q.opening=.3+.7*windup;q.y=-.075*pulse;break;
      case 'music':case 'petals':case 'moon':q.wing=Math.sin(p*TAU)*.4;q.x=.035*Math.sin(p*TAU);q.rotation=.025*Math.sin(p*TAU);break;
      case 'tiger':case 'bull':case 'cavalry':case 'qilin':q.wing=.4*Math.sin(p*TAU);q.jaw=.3*pulse;q.x=-.07*windup+.12*strike;q.y=-.05*pulse;break;
      case 'seal':case 'cauldron':q.y=-.10*windup+.15*strike-.04*settle;q.rotation=.03*Math.sin(p*TAU);q.opening=strike;break;
      case 'clock':case 'mechanism':q.wing=p*1.8;q.orbit=-p*TAU*.9;q.rotation=.045*Math.sin(p*TAU);break;
      case 'sting':q.wing=-.4*windup+.95*strike;q.rotation=-.09*windup+.11*strike;break;
      case 'web':case 'bone':q.wing=.45*Math.sin(p*TAU);q.opening=windup*(1-settle*.5);break;
      default:q.wing=.26*Math.sin(p*TAU*(.8+seed%3*.12));q.rotation=.04*Math.sin(p*TAU);q.y=-.04*pulse;
    }
    const personality=.91+seed*.0031;q.wing*=personality;q.rotation*=personality;q.x*=personality;q.y*=personality;q.orbit*=.94+seed*.0009;
    if(state.reduced){q.wing=0;q.rotation=0;q.x=q.y=0;q.orbit=0;}
    return q;
  }
  function geometry(id,state={}){
    const r=Object.hasOwn(catalog,id)?catalog[id]:null;if(!r)return[];const p=pose(id,state),v=r.craft.variant,paths=[],seed=v*.093,family=r.spell;
    const path=(fn,width=.013,color=1,alpha=.68)=>paths.push({points:Array.from({length:73},(_,i)=>{const u=i/72,q=fn(u);return{x:q[0],y:q[1],w:width*Math.sin(u*Math.PI)};}),width,color,alpha});
    if(['eastwind','feather','phoenix','wind','web'].includes(family)){
      const count=family==='phoenix'?9:7;for(let j=0;j<count;j++)path(u=>{const a=(j-(count-1)/2)*.22+seed*.035,r=Math.sin(u*Math.PI)*(.61+j*.018);return[Math.sin(a)*r+Math.sin(u*TAU)*.06,.43-Math.cos(a)*r+Math.sin(p.p*5+u*3+j)*u*.022];},.016,j%3,.78-j*.035);
    }else if(['clock','mechanism','stars','prism','mirror','seal'].includes(family)){
      for(let j=0;j<4;j++)path(u=>{const a=u*TAU+p.orbit*.13+j*.22,r=.25+j*.14;return[Math.cos(a)*r,Math.sin(a)*r*(.53+j*.05)+Math.sin(seed)*.055];},j===3?.009:.015,j%3);
      for(let j=0;j<3;j++)path(u=>[-.60+u*1.20,.18*Math.sin(u*Math.PI*(2+j)+p.p*2+seed)],.009,2,.56);
    }else if(['tide','sails','redcliffs','dew','music'].includes(family)){
      for(let j=0;j<6;j++)path(u=>[-.91+u*1.82,-.25+j*.10+Math.sin(u*7-p.p*3+seed+j*.30)*(.14+j*.015)],.013,j%3,.80-j*.07);
    }else if(['petals','moon','silk','roots','leaf'].includes(family)){
      for(let j=0;j<7;j++)path(u=>{const a=j/7*TAU+seed*.06,r=Math.sin(u*Math.PI)*(.45+.23*p.opening);return[Math.cos(a)*r+Math.sin(u*TAU)*.06,Math.sin(a)*r+.14];},.016,j%3,.67);
    }else{
      for(let j=0;j<5;j++)path(u=>{const a=-2.8+u*3.3+j*.10+seed*.018,r=.54+j*.064;return[Math.cos(a)*r+Math.sin(p.p*4+seed)*.04,Math.sin(a)*r*.67+.16];},j===0?.036:.010,j%3,.86-j*.10);
      path(u=>[-.65+u*1.15,.57-u*.97+Math.sin(u*Math.PI)*Math.sin(seed)*.21],.012,2,.70);
    }
    return paths;
  }
  const glyphs={
    meteor:'M9 19L5 14L11 7L19 10L22 17L16 24ZM16 9L22 3M19 12L26 7M11 6L15 1',
    auroraprism:'M14 3L22 9V20L14 26L6 20V9ZM14 3V26M6 9L22 20M22 9L6 20',
    tidetrident:'M14 27V3M5 6L7 16H21L23 6M3 9L5 4L8 8M11 7L14 2L17 7M20 8L23 4L26 9',
    qilin:'M7 23L8 14L18 9L23 14L18 21ZM9 14L5 7L8 4M17 10L16 3L21 5M6 23L3 26M17 21L20 26',
    scarabsun:'M14 12A5 5 0 1 0 14 2A5 5 0 1 0 14 12M14 13L5 9L3 18L10 24H18L25 18L23 9ZM14 13V25',
    peacock:'M14 25Q-2 17 5 5L11 15L14 2L17 15L24 5Q30 17 14 25ZM14 25L6 10M14 25L22 10M14 25V6',
    worldtree:'M14 26V9M14 14L6 9L3 11M14 17L23 11L25 7M14 9L10 4M14 9L19 3M14 23L7 27M14 23L21 27',
    chronoclock:'M11 4V1H17V4M14 5A10 10 0 1 0 14 25A10 10 0 1 0 14 5M14 9V15L8 18M9 8L7 10M21 18L19 20',
    ninephoenix:'M14 13L8 4L3 7L9 17L5 24L14 19L23 24L19 17L25 7L20 4ZM14 18V27M11 18L8 27M17 18L20 27',
    scorpion:'M9 23Q1 12 9 7Q18 4 20 11L17 13M19 10L25 8L23 16M9 23L18 24L23 20M8 20L3 25M10 15L3 16',
    spiderweb:'M14 3L24 8L24 20L14 26L4 20L4 8ZM14 3V26M4 8L24 20M24 8L4 20M14 8L20 11V17L14 21L8 17V11Z',
    whitebone:'M4 12Q4 3 10 5L14 9L18 5Q24 3 24 12L21 20L17 20V26H11V20H7ZM8 12L11 14M20 12L17 14',
    dragonpalace:'M3 10L14 3L25 10H3M6 19L14 13L22 19H6M7 11V18M21 11V18M10 20V27M18 20V27M5 27H23',
    bullking:'M7 13Q0 9 4 3Q4 10 11 9H17Q24 10 24 3Q28 9 21 13L20 23L14 27L8 23ZM10 16L12 17M18 16L16 17',
    guanyuyunchang:'M10 27V5Q27 2 23 14L16 21L18 9H10M10 18L5 15M10 22L5 20',
    zhangfei:'M14 27V17Q5 13 16 10Q25 7 13 3M9 22H19M12 14L18 14',
    zhaoyun:'M14 2L20 11L14 17L8 11ZM14 17V28M11 16L4 22M17 16L24 22',
    machao:'M14 2L22 6L25 16L19 24H9L3 16L6 6ZM9 11L12 14M19 11L16 14M11 20L14 17L17 20',
    zhouyu:'M3 21L7 26H22L26 21ZM14 21V3L23 16H14M5 17L7 9L10 16L9 20M19 20L24 16',
    simayi:'M14 4A10 10 0 1 0 24 14Q15 21 14 4M5 6L9 8M4 16L8 16M12 23L12 27M22 21L25 24',
    pangtong:'M7 18A5 5 0 1 0 7 8A5 5 0 1 0 7 18M14 23A5 5 0 1 0 14 13A5 5 0 1 0 14 23M21 18A5 5 0 1 0 21 8A5 5 0 1 0 21 18M9 7L14 2L19 7',
    huangyueying:'M4 12H21V20H4ZM6 20V26M18 20V26M21 13L25 8L21 4M7 7L10 3L14 7M8 12V20M16 12V20',
    daqiao:'M14 25Q4 22 5 11L11 15L14 3L17 15L23 11Q24 22 14 25ZM3 27Q14 21 25 27',
    xiaoqiao:'M4 9L24 5V22L4 26ZM8 9V23M12 8V23M16 7V22M20 6V22M6 4L10 1L14 4',
    diaochan:'M9 3A10 10 0 1 0 24 18Q8 21 9 3M5 13Q12 7 22 11M5 19Q14 25 24 9',
    dongzhuo:'M6 8H22L21 22H7ZM6 12Q0 6 2 18L7 19M22 12Q28 6 26 18L21 19M9 22L7 28M19 22L21 28M10 14L14 17L18 14',
    zhugeliang:'M14 26L2 12L5 4L11 14L14 2L17 14L23 4L26 12ZM14 24L7 7M14 24V5M14 24L21 7',
    lubu:'M14 27V2M14 7Q2 2 5 16L10 18M14 7Q26 2 23 16L18 18M9 22H19M5 4L2 1M23 4L26 1',
    jiangdongtiger:'M5 6L9 9L14 6L19 9L23 6L24 19L19 25H9L4 19ZM8 13L12 16M20 13L16 16M10 21L14 18L18 21M14 6V12',
    yuanshao:'M6 2V28M6 4L24 6L20 12L6 11M6 14L23 16L20 23L6 21M10 5V10M10 15V21',
    zuoci:'M5 5Q14 9 23 5V25Q14 21 5 25ZM5 5L2 3V23L5 25M23 5L26 3V23L23 25M10 11L18 11M11 15L17 15M14 9V20',
    emperorjade:'M4 16H24V27H4ZM7 16Q4 5 13 7Q17 1 22 6L19 10L15 9Q10 8 12 16M8 20H20M8 23H20'
  };
  function draw(ctx,id,q,info){
    const r=catalog[id];if(!r)return false;
    const {c,p,a,x,y,radius:R,travel,channel,finish,helpers}=info,{ribbon,samples,ring,gem,light,path,wheel,staff}=helpers;
    const type=r.spell,action=ease((p-.1)/.58),variant=r.craft.variant;
    const strip=(fn,w=.03,alpha=.8,n=50)=>ribbon(ctx,samples(fn,n),R*w,c,a*alpha);
    const line=(pts,color=c[1],alpha=.65,w=.8,closed=false)=>{path(ctx,pts,closed);ctx.strokeStyle=color;ctx.globalAlpha=a*alpha;ctx.lineWidth=w;ctx.stroke();};
    const polygon=(pts,alpha=.7,color=c[0])=>{path(ctx,pts,true);ctx.globalAlpha=a*alpha;ctx.fillStyle=color;ctx.fill();line(pts,c[1],alpha,.6,true);};
    const at=(u,v)=>({x:x+u*R,y:y+v*R});
    const blade=(cx,cy,len,turn,width=.04)=>{const dx=Math.cos(turn),dy=Math.sin(turn),n={x:-dy,y:dx};polygon([{x:cx-dx*len*.42+n.x*R*width,y:cy-dy*len*.42+n.y*R*width},{x:cx+dx*len*.5,y:cy+dy*len*.5},{x:cx-dx*len*.42-n.x*R*width,y:cy-dy*len*.42-n.y*R*width}],.84,c[1]);line([{x:cx-dx*len*.4,y:cy-dy*len*.4},{x:cx+dx*len*.5,y:cy+dy*len*.5}],c[2],.94,.7);};
    function pennant(cx,cy,size,offset=0){line([{x:cx,y:cy+size*.28},{x:cx,y:cy-size*.9}],c[2],.8,1);const pts=samples(u=>({x:cx+u*size*.72,y:cy-size*.80+Math.sin(u*4-p*5+offset)*u*size*.10}),20),bottom=samples(u=>({x:cx+(1-u)*size*.72,y:cy-size*.25+Math.sin((1-u)*4-p*5+offset)*(1-u)*size*.10}),20);polygon(pts.concat(bottom),.7);for(let j=0;j<3;j++)line([{x:cx+size*(.14+j*.16),y:cy-size*.72},{x:cx+size*(.14+j*.16),y:cy-size*.31}],c[1],.45,.5);}
    function ship(cx,cy,size,burning=false){polygon([{x:cx-size*.54,y:cy-size*.09},{x:cx-size*.35,y:cy+size*.11},{x:cx+size*.37,y:cy+size*.11},{x:cx+size*.58,y:cy-size*.09}],.70);for(let j=-1;j<=1;j++){const xx=cx+j*size*.24;line([{x:xx,y:cy},{x:xx,y:cy-size*(j===0?.80:.56)}],c[1],.84,.7);polygon([{x:xx,y:cy-size*.62},{x:xx+size*.20,y:cy-size*.23},{x:xx,y:cy-size*.23}],.50,c[1]);}if(burning)for(let j=0;j<7;j++){const xx=cx+(j-3)*size*.12;strip(u=>({x:xx+Math.sin(u*5-p*4+j)*u*size*.08,y:cy-u*size*(.34+j%3*.12)}),.035,.84,24);}}
    function feather(cx,cy,len,turn,index){const dx=Math.cos(turn),dy=Math.sin(turn);strip(u=>({x:cx+dx*u*len,y:cy+dy*u*len}),.047,.85,24);line([{x:cx,y:cy},{x:cx+dx*len,y:cy+dy*len}],c[2],.80,.6);for(let j=1;j<7;j++){const u=j/8,span=Math.sin(u*Math.PI)*len*.11;line([{x:cx+dx*u*len-dy*span-dx*len*.08,y:cy+dy*u*len+dx*span-dy*len*.08},{x:cx+dx*u*len,y:cy+dy*u*len},{x:cx+dx*u*len+dy*span-dx*len*.08,y:cy+dy*u*len-dx*span-dy*len*.08}],c[1],.65,.5);}if(id==='peacock'){ctx.beginPath();ctx.ellipse(cx+dx*len*.76,cy+dy*len*.76,len*.095,len*.065,turn,0,TAU);ctx.fillStyle=c[0];ctx.globalAlpha=a*.8;ctx.fill();gem(ctx,cx+dx*len*.76,cy+dy*len*.76,2.3,c[2],a*.8,index);}}
    // Weapon signatures use one coherent stroke with a lit edge, follow-through
    // and a water response. They share the event clock with the illustrated rig.
    if(['guanyuyunchang','lubu','zhaoyun'].includes(id)){
      const envelope=Math.sin(Math.PI*clamp(p)),strike=ease((p-.15)/.44),fade=1-ease((p-.72)/.28);
      const cut=(cx,cy,rx,ry,from,to,width)=>{const points=samples(u=>{const theta=from+(to-from)*u;return{x:cx+Math.cos(theta)*rx,y:cy+Math.sin(theta)*ry};},80);ribbon(ctx,points,u=>R*width*Math.pow(Math.sin(u*Math.PI),.72),[c[0],c[1],c[2]],a*.90*fade);ribbon(ctx,points.map(v=>({x:v.x-1,y:v.y-1})),u=>R*.012*Math.sin(u*Math.PI),[c[1],c[2],c[2]],a*.96*fade);return points;};
      light(ctx,x,y-R*.2,R*.66,c[1],a*.11*envelope);
      if(id==='guanyuyunchang'){
        const arc=cut(x,y-R*.33,R*.87,R*.57,-2.8,-2.8+strike*4.8,.135),tip=arc.at(-1);light(ctx,tip.x,tip.y,R*.10,c[1],a*.45*fade);
        const coil=samples(u=>{let th=-2.6+u*4.5+strike*.6;return{x:x+Math.cos(th)*R*(.30+u*.35),y:y-R*.45+Math.sin(th)*R*.35-u*R*.25};},72);ribbon(ctx,coil,u=>R*.043*Math.sin(u*Math.PI),[c[0],c[1],c[2]],a*.7*fade);for(let j=10;j<65;j+=4){let pt=coil[j];line([{x:pt.x-2,y:pt.y-2},{x:pt.x+1,y:pt.y+1},{x:pt.x+4,y:pt.y-2}],c[2],.64,.7);}const head=coil.at(-2);polygon([{x:head.x-7,y:head.y+2},{x:head.x-4,y:head.y-6},{x:head.x+8,y:head.y-3},{x:head.x+11,y:head.y+2},{x:head.x+3,y:head.y+5}],.75,c[0]);for(const side of[-1,1])line([{x:head.x-3,y:head.y+side*3},{x:head.x-8,y:head.y+side*10},{x:head.x-13,y:head.y+side*8}],c[1],.9,1);gem(ctx,head.x+5,head.y-2,1.2,c[2],a*.9,0);
      }else if(id==='lubu'){
        for(const side of[-1,1])cut(x+side*R*.13,y-R*.45,R*.71,R*.58,side<0?-3.4:-1.8,(side<0?-3.4:-1.8)+strike*3.8,.105);
        const yy=y-R*(1.15-strike*.88);blade(x,yy,R*.95,Math.PI*.61,.052);strip(u=>({x:x+u*R*.26,y:yy-u*R*.64}),.045,.55);
        for(const side of[-1,1])strip(u=>({x:x+side*(.10+u*.52)*R,y:y-R*.50-Math.sin(u*Math.PI)*R*.44+u*R*.15}),.018,.65);
      }else{
        for(let j=0;j<5;j++){const lag=clamp(strike-j*.075),xx=x+(j-2)*R*.20,yy=y-R*(1.25-lag*1.10);blade(xx,yy,R*.88,Math.PI*.61,j===2?.037:.023);const pts=samples(u=>({x:xx+u*R*.25,y:yy-u*R*.65}),32);ribbon(ctx,pts,u=>R*.034*Math.sin(u*Math.PI),[c[0],c[1],c[2]],a*(j===2?.68:.37)*fade);light(ctx,xx-R*.10,yy+R*.23,R*.12,c[1],a*.25*fade);}
      }
      if(strike>.55){for(let j=0;j<2;j++)ring(ctx,x,y,R*(.19+(strike-.55)*1.55+j*.16),.20,c[j+1],a*.58*fade);for(let j=0;j<8;j++){const theta=j/8*TAU,rr=R*(strike-.5)*1.2,hh=Math.sin(clamp((strike-.55)*2.2)*Math.PI)*R*(.14+j%3*.06);line([{x:x+Math.cos(theta)*rr,y:y+Math.sin(theta)*rr*.20-hh},{x:x+Math.cos(theta)*rr*.94,y:y+Math.sin(theta)*rr*.18-hh+R*.035}],c[2],.63,.9);}}
      return true;
    }
    if(type==='meteor'){
      for(let j=0;j<5;j++){const t=clamp(action-j*.07),xx=x+(j-2)*R*.16+(1-t)*R*.55,yy=y-(1-t)*R*(1.25+j*.07);strip(u=>({x:xx+u*R*.40,y:yy-u*R*.73}),.06,.64);polygon([{x:xx-R*.07,y:yy-R*.08},{x:xx+R*.07,y:yy-R*.06},{x:xx+R*.09,y:yy+R*.025},{x:xx-R*.01,y:yy+R*.09},{x:xx-R*.08,y:yy+R*.01}],.94,c[0]);line([{x:xx-R*.03,y:yy-R*.05},{x:xx+R*.02,y:yy},{x:xx-R*.04,y:yy+R*.06}],c[1],.9,1.1);light(ctx,xx,yy,R*.17,c[1],a*.55);}
    }else if(type==='prism'){
      for(let j=0;j<6;j++){const theta=j/6*TAU+p*.6,cx=x+Math.cos(theta)*R*.36,cy=y-R*.42+Math.sin(theta)*R*.30;polygon([{x:cx,y:cy-R*.22},{x:cx+R*.075,y:cy},{x:cx,y:cy+R*.16},{x:cx-R*.075,y:cy}],.60,j%2?c[1]:c[0]);strip(u=>({x:cx+(x-cx)*u,y:cy+(y-cy)*u}),.012,.64);}
    }else if(type==='redcliffs'||type==='sails'){
      const n=channel?1:3;for(let j=0;j<n;j++){const xx=x+(j-(n-1)/2)*R*.64+(action-.5)*R*.16,yy=y-R*.12-j%2*R*.16;ship(xx,yy,R*(j===1?.60:.48),type==='redcliffs');strip(u=>({x:xx-u*R*.46,y:yy+R*.06+Math.sin(u*5-p*3)*R*.06}),.035,.56);}
    }else if(type==='eastwind'){
      for(let j=0;j<7;j++){const theta=-2.6+j*.34,cx=x+Math.cos(theta)*R*.51,cy=y-R*.25+Math.sin(theta)*R*.63;feather(x,y-R*.18,R*.71,theta,j);gem(ctx,cx,cy,3,c[2],a*.9,j);}
      for(let j=0;j<3;j++)strip(u=>({x:x+Math.sin(u*5-p*3+j)*R*(.18+u*.45),y:y-R*u*1.2}),.047,.57);
    }else if(type==='feather'||type==='phoenix'){
      const n=type==='phoenix'?9:id==='peacock'?7:3;for(let j=0;j<n;j++){const theta=-Math.PI*.9+j/(n-1||1)*Math.PI*.8+(action-.5)*.3;feather(x+(j-(n-1)/2)*R*.018,y-R*.10,R*(.64+Math.sin(j/(n-1||1)*Math.PI)*.32),theta,j);}
      if(type==='phoenix')for(const side of[-1,1])strip(u=>({x:x+side*u*R*.7,y:y-R*.75-Math.sin(u*Math.PI)*R*.23}),.053,.76);
    }else if(type==='roots'){
      for(let j=0;j<7;j++){const theta=j/7*TAU;strip(u=>({x:x+Math.cos(theta)*u*R*.75,y:y+Math.sin(theta)*u*R*.22-Math.sin(u*Math.PI)*R*.37*action}),.037,.73);for(let k=1;k<4;k++){const u=k/4,xx=x+Math.cos(theta)*u*R*.75,yy=y+Math.sin(theta)*u*R*.22-Math.sin(u*Math.PI)*R*.37*action;gem(ctx,xx,yy-4,4,c[1],a*.75,theta+.7);}}
    }else if(type==='clock'||type==='mechanism'){
      const n=type==='clock'?2:3;for(let j=0;j<n;j++){const cx=x+(j-(n-1)/2)*R*.47,cy=y-R*(.30+j%2*.25),size=R*(j===0?.34:.25);wheel(ctx,cx,cy,size,(j%2?1:-1)*p*TAU,c,a*.80);line([{x:cx,y:cy},{x:cx+Math.cos(-p*TAU)*size*.74,y:cy+Math.sin(-p*TAU)*size*.74}],c[2],.93,1.0);}if(type==='mechanism'){for(const side of[-1,1]){line([at(side*.16,-.39),at(side*.55,-.14),at(side*.68,-.05)],c[1],.85,2);}}
    }else if(type==='web'){
      const center=at(0,-.23),outer=[];for(let j=0;j<7;j++){const q=j/7*TAU+p*.16,pt={x:center.x+Math.cos(q)*R*.65*action,y:center.y+Math.sin(q)*R*.48*action};outer.push(pt);line([center,pt],c[2],.75,.7);}for(let k=1;k<=5;k++){const points=outer.map(pt=>({x:center.x+(pt.x-center.x)*k/5,y:center.y+(pt.y-center.y)*k/5}));line(points,c[1],.60,.6,true);}outer.forEach((pt,j)=>gem(ctx,pt.x,pt.y,2.4,c[2],a*.8,j));
    }else if(type==='sting'){
      const points=samples(u=>{const theta=-1.5+u*3.5+(action-.5)*1.7;return{x:x+Math.cos(theta)*R*(.18+u*.4),y:y-R*.33+Math.sin(theta)*R*(.18+u*.4)};},48);ribbon(ctx,points,R*.055,c,a*.85);for(let j=4;j<points.length;j+=5)gem(ctx,points[j].x,points[j].y,3,c[1],a*.8,j);const end=points.at(-1);blade(end.x,end.y,R*.20,.8+action, .04);
    }else if(type==='bone'){
      for(let j=0;j<3;j++){const theta=j/3*TAU+p*.65,cx=x+Math.cos(theta)*R*.41,cy=y-R*.39+Math.sin(theta)*R*.24;polygon([{x:cx-R*.12,y:cy-R*.15},{x:cx+R*.12,y:cy-R*.15},{x:cx+R*.09,y:cy+R*.11},{x:cx,y:cy+R*.18},{x:cx-R*.09,y:cy+R*.11}],.72,c[1]);for(const side of[-1,1])line([{x:cx+side*R*.035,y:cy},{x:cx+side*R*.08,y:cy-R*.02}],c[0],.92,1.3);strip(u=>({x:cx+Math.sin(u*6+j)*R*.08,y:cy+R*.12+u*R*.45}),.035,.36);}
    }else if(['bull','tiger','qilin','cavalry','roar'].includes(type)){
      const yy=y-R*.44,charge=action*R*.15;for(const side of[-1,1]){strip(u=>({x:x+side*(.08+u*.37)*R+charge,y:yy+Math.sin(u*Math.PI)*R*.30-(type==='bull'?u*R*.57:u*R*.20)}),type==='bull'?.062:.039,.86);for(let j=0;j<3;j++){const offset=(j-1)*R*.18;strip(u=>({x:x+side*u*R*.55+charge,y:yy+offset+u*R*.24}),.025,.67);}}
      if(type==='roar')for(let j=0;j<4;j++)ring(ctx,x,yy,R*(.20+((p+j*.18)%1)*.6),.65,c[j%3],a*(1-(p+j*.18)%1)*.7);
      else for(let j=0;j<4;j++){const cx=x+(j-1.5)*R*.22,cy=y-R*.03-(j%2)*R*.14;line([{x:cx-R*.04,y:cy-R*.06},{x:cx-R*.05,y:cy+R*.035},{x:cx+R*.05,y:cy+R*.035},{x:cx+R*.04,y:cy-R*.06}],c[2],.73,1.2);}
    }else if(type==='seal'||type==='cauldron'){
      const cy=y-R*(.65-action*.40),size=R*(type==='seal'?.27:.32);polygon([{x:x-size,y:cy-size*.35},{x:x+size,y:cy-size*.35},{x:x+size*.87,y:cy+size*.50},{x:x-size*.87,y:cy+size*.50}],.82,c[0]);for(let j=-1;j<=1;j++)line([{x:x-size*.60,y:cy+j*size*.18},{x:x+size*.60,y:cy+j*size*.18}],c[1],.9,.9);if(type==='seal'){for(let j=0;j<5;j++)strip(u=>({x:x-size*.8+j*size*.4+Math.sin(u*5+j)*size*.15,y:cy-size*.3-u*size*.8}),.018,.85,20);}else for(const side of[-1,1]){ring(ctx,x+side*size,cy,size*.29,.8,c[1],a*.85);line([{x:x+side*size*.56,y:cy+size*.5},{x:x+side*size*.77,y:cy+size*.86}],c[1],.9,1.5);}
      if(action>.75){const rr=R*(.25+(action-.75)*2);line([at(-rr/R,-.05),at(0,-rr/R*.22),at(rr/R,-.05),at(0,rr/R*.22)],c[1],.8,1.1,true);}
    }else if(type==='chains'){
      for(let j=0;j<12;j++){const xx=x+(j-5.5)*R*.105,yy=y-R*.37+Math.sin(j*.58+p*3)*R*.20;ring(ctx,xx,yy,R*.073,j%2?.4:1,c[j%3],a*.83,j*.25);if(j%3===0)gem(ctx,xx,yy,1.7,c[2],a*.8,j);}
    }else if(type==='music'){
      for(let j=0;j<7;j++){const yy=y-R*(.1+j*.1);strip(u=>({x:x+(u-.5)*R*1.36,y:yy+Math.sin(u*TAU*2-p*6+j*.3)*R*.035*Math.sin(u*Math.PI)}),.011,.70);}
      for(let j=0;j<4;j++){const xx=x+Math.sin(j*4+p)*R*.48,yy=y-R*(.25+j*.20);gem(ctx,xx,yy,2.7,c[2],a*.8,j);}
    }else if(type==='petals'||type==='moon'){
      if(type==='moon'){strip(u=>{const q=-1.7+u*4.1;return{x:x+Math.cos(q)*R*.46,y:y-R*.43+Math.sin(q)*R*.46};},.076,.84);}
      for(let j=0;j<(type==='moon'?4:9);j++){const q=j/9*TAU+p*.9,rr=R*(.19+action*.50);feather(x+Math.cos(q)*rr,y-R*.25+Math.sin(q)*rr*.32,R*.24,q+1,j);}
    }else if(type==='banners'||type==='banner'){
      const n=type==='banners'?4:2;for(let j=0;j<n;j++)pennant(x+(j-(n-1)/2)*R*.37,y-R*.06-j%2*R*.10,R*(.65+j%2*.12),j);
    }else if(type==='talismans'||type==='ink'){
      const n=type==='talismans'?8:4;for(let j=0;j<n;j++){const theta=j/n*TAU+p*.58,cx=x+Math.cos(theta)*R*.48,cy=y-R*.40+Math.sin(theta)*R*.32,w=R*.07,hh=R*.14;polygon([{x:cx-w,y:cy-hh},{x:cx+w,y:cy-hh},{x:cx+w,y:cy+hh},{x:cx-w,y:cy+hh}],.65,c[1]);line([{x:cx-w*.4,y:cy-hh*.6},{x:cx+w*.4,y:cy-hh*.2},{x:cx-w*.3,y:cy+hh*.3},{x:cx+w*.3,y:cy+hh*.6}],c[0],.85,.65);}
    }else if(type==='sun'||type==='eclipse'){
      const cy=y-R*.40,rad=R*.36;ctx.beginPath();ctx.arc(x,cy,rad,0,TAU);ctx.fillStyle=type==='eclipse'?c[0]:c[1];ctx.globalAlpha=a*.54;ctx.fill();ring(ctx,x,cy,rad,1,c[2],a*.92);for(let j=0;j<12;j++){const q=j/12*TAU+p*.35;strip(u=>({x:x+Math.cos(q)*R*(.40+u*.20),y:cy+Math.sin(q)*R*(.40+u*.20)}),.015,.75);}if(type==='eclipse'){ctx.beginPath();ctx.arc(x+rad*.34,cy-rad*.19,rad*.79,0,TAU);ctx.fillStyle=c[0];ctx.globalAlpha=a*.9;ctx.fill();}
    }else if(type==='arrows'||type==='spear'){
      const n=type==='arrows'?3:id==='zhaoyun'?5:2;for(let j=0;j<n;j++){const xx=x+(j-(n-1)/2)*R*.17,yy=y-R*.58+(action-.5)*R*.7;blade(xx,yy,R*.66,Math.PI*.65,.035);strip(u=>({x:xx+u*R*.25,y:yy-u*R*.62}),.020,.48);}
    }else if(['cleave','crescent','halberd','twins','axe','hammer','shield'].includes(type)){
      const n=type==='twins'?2:type==='halberd'?3:1;for(let j=0;j<n;j++){const turn=-2.6+action*3.4+j*.24;strip(u=>{const q=-2.6+u*(turn+2.6);return{x:x+Math.cos(q)*R*(.54+j*.08),y:y-R*.30+Math.sin(q)*R*(.50+j*.08)};},type==='axe'?.10:.055,.86);blade(x+Math.cos(turn)*R*.35,y-R*.3+Math.sin(turn)*R*.35,R*.64,turn+.8,.04);}
      if(type==='shield'){polygon([at(-.30,-.72),at(.30,-.72),at(.23,-.14),at(0,.04),at(-.23,-.14)],.70);line([at(0,-.68),at(0,-.06)],c[2],.85,1);}
      if(type==='hammer')polygon([at(-.22,-.74+action*.4),at(.22,-.74+action*.4),at(.22,-.40+action*.4),at(-.22,-.40+action*.4)],.90,c[1]);
    }else if(type==='tide'){
      for(let j=0;j<4;j++)strip(u=>({x:x+(u-.5)*R*1.45,y:y-R*(.08+j*.14)-Math.pow(Math.max(0,Math.sin(u*Math.PI*1.7-p*2+j*.2)),3)*R*.30}),.055,.77-j*.1);
      if(id==='dragonpalace'){for(let j=0;j<3;j++)line([at(-.32+j*.055,-.50-j*.18),at(0,-.63-j*.18),at(.32-j*.055,-.50-j*.18)],c[2],.77,1.0);}
    }else return false; // Existing wind, fire, dragon, dew and silk renderers.
    return true;
  }
  return Object.freeze({designs:Object.freeze(designs),scenes:Object.freeze(scenes),spells:Object.freeze(spells),kinds:Object.freeze(kinds),glyphs:Object.freeze(glyphs),has,pose,rig,geometry,draw});
});
