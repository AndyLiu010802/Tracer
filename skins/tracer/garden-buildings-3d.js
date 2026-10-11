(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenBuildings3D=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255),mat=(i,light=1)=>[-i-1,light,0],TAU=Math.PI*2;
  const wood=mat(0),plaster=mat(1),teal=mat(2),clay=mat(3),stone=mat(4),copper=mat(5),dark=rgb('#536d68'),gold=rgb('#ebc98f'),cream=rgb('#eee0ba'),green=rgb('#6e9365');
  function add(b,farm){
    const x=.87,z=-.76,p=(a,y,c)=>[x+a,y,z+c],box=(a,y,c,w,h,d,color)=>b.box(p(a,y,c),[w,h,d],color),ball=(a,y,c,w,h,d,color)=>b.ellipsoid(p(a,y,c),[w,h,d],color,12,6),bar=(a,d,r,color)=>b.stem(p(...a),p(...d),r,r,color,8);
    const line=(a,d,r=.012,c=wood)=>bar(a,d,r,c);
    function ring(y,r,color,tube=.014){for(let i=0;i<24;i++){const a=i/24*TAU,d=(i+1)/24*TAU;line([Math.cos(a)*r,y,Math.sin(a)*r],[Math.cos(d)*r,y,Math.sin(d)*r],tube,color);}}
    function pot(a,y,c,flowers=true){b.stem(p(a,y,c),p(a,y+.1,c),.048,.065,clay,10);ball(a,y+.103,c,.057,.013,.057,rgb('#635d42'));for(let i=0;i<5;i++){const angle=i*2.399,u=a+Math.cos(angle)*.047,v=c+Math.sin(angle)*.047;line([a,y+.09,c],[u,y+.18,v],.005,green);b.leaf(p(a,y+.12,c),p(u+.025,y+.19,v),.025,green);if(flowers)ball(u,y+.19,v,.026,.018,.027,rgb(farm==='sakura'?'#e9b4c5':'#e3cf89'));}}
    function lantern(a,y,c){line([a,y+.06,c],[a,y+.2,c],.01,dark);ball(a,y,c,.045,.064,.045,gold);box(a,y+.063,c,.049,.008,.049,dark);box(a,y-.057,c,.038,.007,.038,dark);for(const dx of [-.028,.028])line([a+dx,y-.055,c+.03],[a+dx,y+.055,c+.03],.004,dark);}
    function window(a,y,c,w=.075,h=.085){box(a,y,c,w,h,.014,gold);for(const dx of [-w,w])box(a+dx,y,c+.015,.009,h+.012,.018,wood);for(const dy of [-h,h,0])box(a,y+dy,c+.021,w+.01,.007,.018,wood);box(a,y,c+.022,.007,h,.018,wood);box(a,y-h-.024,c+.035,w+.045,.018,.045,stone);for(const side of [-1,1]){box(a+side*(w+.041),y,c+.014,.03,h,.014,teal);for(let j=0;j<4;j++)box(a+side*(w+.041),y-h+.026+j*h*.45,c+.032,.027,.003,.006,wood);}}
    function roof(color,eave=.52,ridge=.84,half=.44,depth=.39){
      const y=a=>eave+(1-Math.abs(a)/half)*(ridge-eave),steps=5,cols=9;
      for(const side of [-1,1])for(let row=0;row<steps;row++)for(let col=0;col<cols;col++){
        const a=side*row/steps*half,d=side*(row+1.12)/steps*half,z0=-depth+col/cols*depth*2,z1=z0+depth*2/cols*.95,lift=.012+(steps-row)*.002,c=[color[0],.92+((col+row*3)%5)*.025,0];
        const v=p(a,y(a)+lift,z0),w=p(d,y(d)+lift,z0),q=p(a,y(a)+lift,z1),r=p(d,y(d)+lift,z1);b.tri(v,w,q,c);b.tri(q,w,r,c);const low=v=>[v[0],v[1]-.018,v[2]];b.tri(w,low(w),r,c);b.tri(r,low(w),low(r),c);b.tri(q,r,low(r),c);b.tri(q,low(r),low(q),c);
      }
      for(const side of [-1,1]){line([side*half,eave,-depth-.015],[side*half,eave,depth+.015],.02,wood);for(const end of [-depth,depth])line([0,ridge,end],[side*half,eave,end],.017,wood);}
      for(let i=0;i<12;i++)b.stem(p(0,ridge+.018,-depth+i*depth/6),p(0,ridge+.018,-depth+(i+1)*depth/6),.025,.025,color,8);
    }
    // Foundation, uneven porch stones and a little garden path are shared scale cues.
    box(0,.058,0,.37,.035,.31,stone);for(let i=0;i<3;i++)box(.12,.028,.35+i*.07,.11+i*.025,.026-i*.005,.045,stone);
    if(farm==='coast'){
      b.stem(p(0,.03,0),p(0,.89,0),.205,.13,plaster,24);b.stem(p(0,.37,0),p(0,.53,0),.174,.162,mat(3,1.1),24);
      ring(.86,.19,stone,.025);ring(1.0,.19,copper);for(let j=0;j<12;j++){const a=j/12*TAU;line([Math.cos(a)*.19,.86,Math.sin(a)*.19],[Math.cos(a)*.19,1,Math.sin(a)*.19],.008,copper);}
      b.stem(p(0,.91,0),p(0,1.12,0),.115,.115,gold,12);for(let j=0;j<8;j++){const a=j/8*TAU;line([Math.cos(a)*.122,.91,Math.sin(a)*.122],[Math.cos(a)*.122,1.12,Math.sin(a)*.122],.01,dark);}b.stem(p(0,1.13,0),p(0,1.31,0),.21,0,copper,24);ring(1.13,.21,copper,.018);line([0,1.29,0],[0,1.41,0],.009,dark);ball(0,1.41,0,.025,.025,.025,gold);
      box(0,.17,.203,.06,.12,.012,wood);box(0,.30,.2,.08,.014,.045,clay);ball(.038,.16,.219,.008,.008,.008,gold);for(const y of [.60,.75]){ball(0,y,.15,.05,.05,.012,copper);ball(0,y,.166,.035,.035,.009,gold);line([0,y-.035,.18],[0,y+.035,.18],.006,dark);}pot(-.26,.055,.16);pot(.27,.055,.12,false);lantern(-.11,.30,.25);
    }else if(farm==='dunes'){
      box(0,.28,0,.32,.22,.27,plaster);ball(0,.51,0,.325,.27,.28,copper);ring(.51,.32,teal,.015);line([0,.76,0],[0,.86,0],.009,gold);ball(0,.87,0,.025,.027,.025,gold);
      box(0,.19,.278,.085,.13,.014,dark);for(let i=0;i<12;i++){const a=i/12*Math.PI,d=(i+1)/12*Math.PI;b.tri(p(0,.32,.294),p(Math.cos(a)*.085,.32+Math.sin(a)*.085,.294),p(Math.cos(d)*.085,.32+Math.sin(d)*.085,.294),dark);line([Math.cos(a)*.1,.32+Math.sin(a)*.1,.304],[Math.cos(d)*.1,.32+Math.sin(d)*.1,.304],.012,stone);}for(const side of [-1,1])box(side*.098,.19,.30,.013,.13,.018,stone);
      for(let i=0;i<11;i++){box(-.29+i*.058,.11,.278,.022,.015,.008,i%2?copper:cream);box(-.29+i*.058,.435,.278,.025,.007,.01,teal);}for(const side of [-1,1]){window(side*.22,.29,.278,.04,.06);pot(side*.38,.06,.17);}lantern(.18,.24,.37);
    }else if(farm==='cyber'){
      box(0,.27,0,.33,.22,.27,mat(5,.85));for(const side of [-1,1]){for(let j=0;j<3;j++)box(-.21+j*.21,.29,side*.276,.085,.16,.012,rgb('#80ada7'));}for(const dx of [-.33,-.11,.11,.33])box(dx,.29,.291,.012,.23,.013,copper);box(0,.31,.292,.32,.009,.016,copper);roof(mat(5,1.05),.54,.78);for(const side of [-1,1])line([side*.35,.2,.02],[side*.35,.48,.02],.017,wood);pot(-.27,.07,.36);pot(.28,.07,.36);lantern(.34,.43,.31);
    }else{
      box(0,.285,0,.33,.225,.275,farm==='alpine'?wood:plaster);for(const dx of [-.32,0,.32])box(dx,.29,.286,.016,.23,.019,wood);for(const y of [.10,.48])box(0,y,.29,.34,.017,.02,wood);
      // The gable has actual depth and exposed rafters beneath individually raised tiles.
      b.tri(p(-.33,.51,.275),p(.33,.51,.275),p(0,.78,.275),farm==='alpine'?wood:plaster);b.tri(p(-.33,.51,-.275),p(0,.78,-.275),p(.33,.51,-.275),wood);roof(farm==='sakura'?mat(2,.9):farm==='alpine'?clay:teal);
      box(.105,.18,.294,.066,.125,.019,wood);box(.105,.32,.319,.086,.014,.038,wood);ball(.15,.17,.32,.008,.008,.01,gold);window(-.18,.32,.297,.071,.083);window(.23,.36,.297,.048,.055);
      box(.22,.74,-.11,.055,.16,.055,stone);box(.22,.91,-.11,.073,.018,.073,stone);box(.22,.935,-.11,.042,.008,.04,dark);
      for(const dx of [-.28,.29]){line([dx,.06,.42],[dx,.43,.42],.017,wood);box(dx,.10,.42,.033,.04,.033,stone);}for(let j=0;j<7;j++)box(-.31+j*.102,.07,.38,.043,.015,.13,wood);
      for(let j=0;j<5;j++)box(-.3+j*.15,.445,.40,.073,.016,.16,farm==='sakura'?teal:wood);box(0,.43,.57,.365,.025,.023,wood);lantern(.30,.31,.45);pot(-.36,.06,.37);pot(.39,.05,.28);pot(-.18,.26,.37);
      if(farm==='alpine'){for(let j=0;j<7;j++){const a=-.32+j*.105;ball(a,.55+(1-Math.abs(a)/.44)*.32,.27,.075,.04,.115,rgb('#e3eadd'));}for(const side of [-1,1])ball(side*.42,.545,0,.055,.035,.38,rgb('#e1e9df'));}
      if(farm==='sakura'){for(const dx of [-.23,.18]){line([dx,.40,.56],[dx,.35,.56],.007,wood);ball(dx,.31,.56,.029,.048,.029,rgb('#edc4b2'));box(dx,.36,.56,.025,.005,.025,wood);}}
      // Climbing ivy follows the wall instead of floating in front of the model.
      for(let i=0;i<12;i++){const y=.1+i*.04,a=-.345+Math.sin(i*.8)*.013;b.leaf(p(a,y,.12),p(a-.055,y+.035,.14),.025,green);b.leaf(p(a,y,.12),p(a-.025,y+.035,.05),.023,green);}
    }
    // A slatted reading bench with arms and a cross brace replaces the block prop.
    for(const dx of [.55,.86])for(const dz of [.75,.98])box(dx,.12,dz,.018,.12,.02,wood);for(let j=0;j<4;j++)box(.705,.24,.75+j*.077,.21,.015,.027,wood);for(let j=0;j<3;j++)box(.705,.31+j*.056,.75,.215,.017,.017,wood);for(const dx of [.5,.91]){box(dx,.3,.88,.013,.095,.014,wood);box(dx,.385,.88,.028,.014,.15,wood);}line([.55,.09,.76],[.86,.18,.96],.009,wood);
  }
  return{add,texture:'/garden-art/architecture-materials-v1.png'};
});
