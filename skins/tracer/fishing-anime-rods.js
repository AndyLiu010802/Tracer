(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingAnimeRods=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const OnePiece=typeof module==='object'&&module.exports?require('./fishing-onepiece-rods'):globalThis.TracerFishingOnePieceRods;
  // Every ornament is in rod model space. Reel, guide rings and the flexible
  // continuous blank are supplied by the normal rod renderer without changes.
  function build(p,h,spec){
    if(spec.collection==='onepiece'&&OnePiece)return OnePiece.build(p,h,spec);
    const {g,L,fine,curve:raw,sectionBody,spine,leaf,veins,sleeve,torus,ellipsoid,facet,gem}=h,action=spec.animeAction;
    const mat=(hex,rough=.24,metal=.6)=>({color:[0,2,4].map(i=>parseInt(hex.slice(1+i,3+i),16)/255),rough,metal,pattern:6});
    const enamel=mat(spec.color,.27,.2),trim=mat(spec.accent,.2,.72),steel=mat('#d7e3e6',.16,.9),dark=mat('#26313c',.3,.5),cloth=mat(spec.color,.65,.02),paper=mat('#eee3c9',.65,.01),skin=mat('#e6b98d',.48,.02),gold=mat('#d4b273',.21,.82);
    const curve=(pts,r=.5,m=trim)=>raw(pts,r,m,fine?22:9),ball=(x,y,z,rx,ry,rz,m=enamel)=>ellipsoid(g,[x,y,z],[rx,ry,rz],m,fine?14:7,fine?20:10),ring=(x,y,z,r,m=trim,th=.8)=>torus(g,[x,y,z],[1,0,0],[0,1,0],r,th,m,fine?36:16,6);
    const line=(pts,m=trim,r=.4)=>curve(pts.map(q=>q.length===2?[...q,9]:q),r,m);
    function plate(points,z=7,depth=2,m=enamel){const center=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ai=[center[0]+(a[0]-center[0])*.83,center[1]+(a[1]-center[1])*.83,z+depth],bi=[center[0]+(b[0]-center[0])*.83,center[1]+(b[1]-center[1])*.83,z+depth];facet(g,[...center,z+depth],ai,bi,m);facet(g,[...a,z],[...b,z],bi,steel);facet(g,[...a,z],bi,ai,trim);facet(g,[...a,z-depth],[...b,z-depth],[...b,z],dark);facet(g,[...a,z-depth],[...b,z],[...a,z],dark);}}
    const blade=(x,y,len=84,w=8,side=1,m=steel)=>{plate([[x,y-w],[x+len*.76,y-w*.62],[x+len,y-side*w*.32],[x+len*.79,y+w*.45],[x,y+w]],8,2.2,m);line([[x+4,y],[x+len*.7,y],[x+len-2,y-side*w*.3]],dark,.36);sleeve(x-5,x+2,6,6,gold);};
    const spiral=(x,y,z,r,turns=2,m=trim)=>curve(Array.from({length:65},(_,i)=>{const t=i/64,a=t*Math.PI*2*turns;return[x+Math.cos(a)*r*t,y+Math.sin(a)*r*t,z+.5*t];}),.6,m);
    const band=(x,r=7)=>{sleeve(x-3,x+3,r,r,trim);for(let j=0;j<8;j++){const a=j*Math.PI/4;ball(x,Math.cos(a)*r,Math.sin(a)*r,1,.8,.8,steel);}};
    const feather=(x,y,sign=1,m=enamel,size=1)=>{const a=spine([[x,y,2],[x+32*size,y+sign*24*size,4],[x+70*size,y+sign*22*size,5],[x+88*size,y+sign*8*size,2]],7*size,m,trim,1.8);veins(a,7,steel);};
    function hand(x,y,z,size=1,m=skin,claw=false){ball(x,y,z,13*size,10*size,5*size,m);for(let i=0;i<4;i++){const yy=y+(i-1.5)*5*size,end=x+(27-Math.abs(i-1.5)*3)*size;curve([[x+7*size,yy,z],[x+18*size,yy+(i-1.5)*2*size,z+size],[end,yy+(i-1.5)*3*size,z-2*size]],[2.8*size,2.5*size,.9*size],m);if(claw)spine([[end-3*size,yy,z],[end+4*size,yy-2*size,z-1],[end+6*size,yy-4*size,z-3]],1.7*size,steel,null,1);}curve([[x-4*size,y+7*size,z],[x+5*size,y+19*size,z+1],[x+14*size,y+16*size,z]],[3*size,2.6*size,1*size],m);}
    function bird(x,y,m=enamel,size=1){ball(x,y,9,12*size,5*size,5*size,m);feather(x-10,y,-1,m,size*.75);feather(x-10,y,1,m,size*.75);ball(x+14*size,y,10,5*size,5*size,4*size,m);plate([[x+17*size,y-2],[x+26*size,y],[x+17*size,y+2]],11,1,gold);}
    const knot=(x,y=0)=>{for(const s of[-1,1])curve([[x,y,9],[x-9,y+s*6,12],[x-11,y+s*10,9],[x-3,y+s*9,8],[x,y,9]],1,cloth);for(const s of[-1,1])curve([[x,y,9],[x-22,y+s*9,7],[x-39,y+s*13,5]],[1.3,1,.1],cloth);};
    // Narrow, layered hilt plates, thread wraps and fasteners remain readable
    // at desktop size; large emblems occupy the rigid lower third only.
    for(let i=0;i<11;i++){const x=7+i*3.7;curve([[x,-4.8,5],[x+4,0,7],[x,4.8,5]],.68,cloth);}
    band(.24*L,7.2);band(.41*L,5.8);band(.76*L,3.2);
    const x=.37*L;
    if(['kunai','teleport','chakrablade'].includes(action)){
      ring(x-35,0,8,10,dark,2);blade(x-17,0,92,action==='chakrablade'?12:8);
      if(action==='teleport')for(const s of[-1,1]){plate([[x+12,s*5],[x+44,s*19],[x+68,s*14],[x+37,s*8]],9,2,steel);line([[x+15,s*7],[x+40,s*13],[x+57,s*13]],dark);}
      if(action==='chakrablade')for(let j=0;j<4;j++)ring(x-17+j*8,-12,6,3.4,dark,1.2);
      for(let j=0;j<6;j++)line([[x-7+j*7,-3],[x-4+j*7,2],[x-1+j*7,-1]],gold,.35);
    }else if(['scroll','mindthread'].includes(action)){
      for(const s of[-1,1]){sectionBody([[x-15,s*17,7,4,4],[x+55,s*17,7,4,4]],paper,{rows:16,sides:16});ring(x-17,s*17,8,5,gold);}
      plate([[x-12,-14],[x+51,-14],[x+58,14],[x-8,14]],7,1,paper);for(let i=0;i<7;i++)line([[x+i*7,-8],[x+i*7,8],[x+4+i*7,5]],dark,.42);spiral(x+25,0,10,7,2,enamel);knot(x-19);
    }else if(['shadow','swarm','strings'].includes(action)){
      for(let i=0;i<(action==='strings'?5:3);i++){const sign=i%2?-1:1;curve([[x-25,0,4],[x+18,sign*(15+i*3),6],[x+100,sign*(14+i*3),5],[x+169,0,1]],[1.2,1,.5,.08],action==='shadow'?dark:trim);}
      if(action==='swarm')for(let i=0;i<5;i++){const xx=x+6+i*24,y=(i%2?1:-1)*11;ball(xx,y,8,6,4,2.5,dark);line([[xx-4,y],[xx,y],[xx+5,y]],gold);for(const s of[-1,1])for(let j=0;j<3;j++)line([[xx-3+j*3,y],[xx-5+j*3,y+s*6]],dark);}
      else hand(x+12,0,10,.72,action==='shadow'?dark:skin);
    }else if(['fang','hoof','paw'].includes(action)){
      ball(x+23,0,7,22,17,8,action==='paw'?skin:enamel);
      if(action==='fang')for(const s of[-1,1])spine([[x+12,s*13,9],[x+45,s*16,10],[x+61,s*5,9]],6,paper,trim,3);
      else if(action==='paw'){ball(x+20,0,15,9,8,1.5,cloth);for(let j=0;j<4;j++)ball(x+37,(-1.5+j)*7,14,5,3,1.5,cloth);}
      else{plate([[x+12,-12],[x+37,-12],[x+48,-2],[x+17,-2]],15,2,dark);plate([[x+12,12],[x+37,12],[x+48,2],[x+17,2]],15,2,dark);}
    }else if(['impact','giantpalm','sand','rubber','nika','dragonclaw','mochi','bloom','split'].includes(action)){
      const handMat=action==='sand'?trim:action==='nika'||action==='mochi'?paper:action==='dragonclaw'?dark:skin;
      curve([[x-17,0,5],[x+12,-9,6],[x+47,-4,7],[x+67,0,8]],[7,6,5,5],handMat);hand(x+79,0,8,action==='giantpalm'?1.05:.78,handMat,action==='dragonclaw');
      if(['rubber','nika'].includes(action)){ball(x-16,0,9,15,13,6,gold);ring(x-16,0,14,19,gold,2.6);ring(x-16,0,16,12,enamel,2);for(let i=0;i<11;i++)line([[x-28+i*2,-9,17],[x-30+i*2,8,17]],trim,.25);}
      if(action==='bloom')for(const s of[-1,1])hand(x+23,s*18,9,.44,skin);
      if(action==='split')for(const xx of[x+16,x+35])ring(xx,-4,12,6,trim,.5);
      if(action==='mochi')for(let j=0;j<5;j++)plate([[x+65+j*6,-5],[x+67+j*6,-12],[x+70+j*6,-4]],11,1,steel);
    }else if(['lion','rasengan','rotation','sixpaths','kamui','room','lightbeads'].includes(action)){
      ring(x+42,0,8,22,trim,1.5);ring(x+42,0,8,17,dark,.75);ball(x+42,0,10,13,13,7,enamel);spiral(x+42,0,18,11,action==='kamui'?3:2,steel);
      if(action==='lion')for(const s of[-1,1]){plate([[x+9,s*14],[x+20,s*27],[x+42,s*25],[x+55,s*13],[x+28,s*8]],9,3,enamel);for(let j=0;j<5;j++)spine([[x+17+j*5,s*15,11],[x+12+j*5,s*25,10],[x+8+j*5,s*29,8]],2.4,trim,null,1);}
      if(action==='sixpaths')for(let j=0;j<9;j++){const a=j/9*Math.PI*2;ball(x+42+Math.cos(a)*28,Math.sin(a)*28,6,3.5,3.5,3.5,dark);}
      if(action==='room')for(const s of[-1,1])line([[x+16,s*12,18],[x+68,s*12,18]],steel,.4);
      if(action==='lightbeads')for(let j=0;j<6;j++)gem(g,[x+83+j*15,0,6],6,3,trim,4);
    }else if(['lotuskick','firekick','stone'].includes(action)){
      sectionBody([[x-10,-8,8,7,6],[x+15,-16,8,6,5],[x+48,-3,8,5,4]],action==='stone'?paper:dark,{rows:24,sides:14});plate([[x+40,-7],[x+58,-6],[x+70,7],[x+54,12],[x+43,5]],8,4,dark);for(let j=0;j<6;j++)line([[x+2+j*5,-19],[x+4+j*5,-7]],action==='lotuskick'?paper:gold,.8);
      for(const s of[-1,1])feather(x+10,s*3,s,action==='firekick'?trim:enamel,.53);
    }else if(['fan','peacock'].includes(action)){
      const center=[x-12,0,6];for(let i=0;i<9;i++){const a=-1+i/8*2,end=[x+64,Math.sin(a)*43,7];leaf(center,[x+28,Math.sin(a)*29,7],end,5,action==='fan'?paper:enamel,trim);curve([center,end],.55,trim);}
      for(let j=0;j<3;j++)ball(x+33,j*19-19,9,5,5,1,action==='fan'?enamel:gold);knot(x-14);
      if(action==='peacock')for(const s of[-1,1])for(let i=0;i<9;i++)ring(x-29-i*3,s*(10+i*.5),7,2,steel,.5);
    }else if(['puppet','woodcage','wooddragon','thunderdragon'].includes(action)){
      if(action==='puppet'){ball(x+38,0,10,10,9,6,enamel);for(const s of[-1,1]){const joints=[[x+30,s*8,8],[x+6,s*23,8],[x-12,s*15,9]];curve(joints,3.2,trim);for(const p of joints)ball(...p,4,4,4,dark);curve([[x-17,s*4,4],...joints],.25,steel);}plate([[x+35,-4],[x+47,-4],[x+42,3]],17,1,dark);}
      else if(action==='woodcage'){for(let j=0;j<5;j++)curve([[x-10,-18+j*9,4],[x+80,-18+j*9,7]],2.5,enamel);for(const xx of[x+5,x+65])curve([[xx,-23,6],[xx,23,6]],3,trim);}
      else{for(let i=0;i<16;i++){const xx=x-12+i*10,y=Math.sin(i*.35)*15;ball(xx,y,6,7,5,4,enamel);for(const s of[-1,1])line([[xx-4,y+s*3],[xx,y+s*6],[xx+4,y+s*3]],trim);}
        plate([[x+139,-10],[x+153,-17],[x+171,-10],[x+184,0],[x+172,10],[x+151,15],[x+140,7]],7,3,enamel);for(const s of[-1,1]){gem(g,[x+166,s*6,12],4,1.2,trim,4);spine([[x+150,s*8,9],[x+138,s*25,8],[x+152,s*19,8]],3,steel,null,1.5);}}
    }else if(['raven','inkbird','claybird','paper','icebird','phoenixbird'].includes(action)){
      bird(x+16,0,action==='claybird'?paper:enamel,1);
      if(action==='paper')for(let i=0;i<7;i++)plate([[x+86+i*7,-6],[x+100+i*7,-9],[x+103+i*7,5],[x+89+i*7,8]],6+(i%2)*2,1,paper);
      if(action==='phoenixbird')for(const s of[-1,1])feather(x+66,0,s,trim,.9);
    }else if(['lightning','weather','cannon','quake','meteor'].includes(action)){
      if(action==='cannon'){sectionBody([[x,0,8,11,11],[x+48,0,8,12,12],[x+59,0,8,8,8]],dark,{rows:24,sides:18});ring(x+54,0,18,11,steel,2);for(const s of[-1,1])plate([[x+2,s*7],[x+24,s*18],[x+38,s*13],[x+34,s*6]],7,3,enamel);}
      else if(action==='weather'){for(let j=0;j<3;j++){ball(x+j*29,0,8,9,9,7,enamel);ring(x+j*29,0,14,8,trim,.7);}curve([[x-20,0,7],[x+80,0,7]],3,steel);}
      else if(action==='quake'){blade(x+20,0,112,10);spine([[x+91,-4,10],[x+85,-25,10],[x+125,-35,10],[x+154,-17,10]],7,steel,trim,2);}
      else if(action==='meteor'){ball(x+25,0,9,20,16,12,enamel);for(let j=0;j<6;j++){const yy=-11+j*4;line([[x+9,yy,21],[x+19,yy+3,22],[x+25,yy-2,21],[x+39,yy+4,20]],dark,.7);}}
      else{plate([[x-10,-6],[x+34,-17],[x+23,-4],[x+76,-14],[x+49,2],[x+108,-3],[x+31,16],[x+45,5],[x-8,9]],8,2,steel);}
    }else if(['slingshot','susanoo'].includes(action)){
      const xx=x+34;for(const s of[-1,1]){curve([[x-17,0,6],[xx,s*19,8],[xx+19,s*35,9]],[4,3,2],enamel);curve([[xx+19,s*35,10],[x+1,0,12]],1.1,action==='susanoo'?trim:dark);}ball(x,0,12,6,5,2,dark);
      if(action==='susanoo'){for(let j=0;j<5;j++)for(const s of[-1,1])curve([[x-20+j*9,0,6],[x-16+j*9,s*18,6],[x-4+j*9,s*23,5]],1.7,trim);blade(x+38,0,75,3,1,trim);}
    }else if(['threesword','soul','blackblade','haki'].includes(action)){
      if(action==='threesword')for(const s of[-1,0,1]){blade(x+6+s*10,s*17,144,5,1,s===0?steel:enamel);ring(x+s*10,s*17,8,7,gold,1);}
      else{blade(x,0,action==='blackblade'?198:166,action==='blackblade'?12:5,1,action==='soul'?steel:dark);curve([[x,-(action==='blackblade'?31:10),8],[x,action==='blackblade'?31:10,8]],3,gold);if(action==='blackblade')for(const s of[-1,1])gem(g,[x,s*25,12],6,2,trim,6);}
    }else if(['toad','flame','smoke','current','waterbody','sandhook','ghost'].includes(action)){
      if(action==='toad'){ball(x+32,0,8,20,17,9,enamel);for(const s of[-1,1]){ball(x+39,s*12,16,6,6,5,gold);ball(x+42,s*12,20,3,1,1,dark);curve([[x+26,s*12,8],[x+2,s*25,6],[x-9,s*13,6]],4,enamel);}line([[x+45,-10,17],[x+49,0,18],[x+45,10,17]],dark,.9);}
      else if(action==='sandhook'){curve([[x-12,0,7],[x+37,0,8],[x+69,17,8],[x+84,0,8],[x+71,-19,8],[x+53,-13,8]],[5,5,4,3,2,.1],gold);}
      else if(action==='ghost'){ball(x+27,0,9,18,15,8,paper);for(const s of[-1,1])ball(x+32,s*7,17,4,3,1,dark);curve([[x+12,0,8],[x-20,-7,9],[x-32,0,8]],[8,4,.1],paper);}
      else for(let j=0;j<3;j++){const s=j%2?1:-1;spine([[x-18,0,3],[x+29,s*(22+j*5),7],[x+90,s*18,8],[x+148+j*10,s*2,3]],8-j*1.5,action==='smoke'?paper:enamel,trim,2.2);}
    }
    // An individual reel crest ties each skin to its shaft, not a floating icon.
    ring(83,26,19,7,trim,1);spiral(83,26,21,5,1.2,enamel);
    return{collection:spec.collection,silhouette:'anime-'+action,rarity:spec.rarity,continuousBody:true,reel:spec.craft.variant%7,materials:'layered-enamel-forged-edge',construction:action,individualRelief:spec.craft.variant};
  }
  return{build};
});
