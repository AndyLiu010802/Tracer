(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingJourney=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,Number(n)||0)),ease=n=>{n=clamp(n);return n*n*(3-2*n);};
  const entries=[['monkeytwig','#815a43','#d9a879'],['goldenhoop','#bc8734','#e5d293'],['moonspade','#547989','#d8e1d8'],['ninerake','#677785','#c1d2db'],['whitedragon','#9dbfc1','#f0e2b8'],['kasaya','#a44332','#edc96b'],['windfan','#52754f','#d9bf73'],['redboy','#af382b','#ffd480'],['jadebottle','#70ab9e','#e9e2ba'],['demonmirror','#506676','#edc476'],['goldenbell','#746386','#e6c477'],['sevenstars','#385e75','#b9d6e2'],['gourd','#954848','#d7b673'],['lotuswheel','#be6557','#edcf83'],['ruyi','#8e2922','#ffe0a0'],['erlang','#57748b','#dbeaf2'],['wukong','#a44d32','#f6d17c']];
  const designs=Object.freeze(Object.fromEntries(entries.map(([id,color,accent],i)=>[id,{theme:'journey-'+id,frequency:1.7+i%5*.36,speed:.4+i%4*.17,spread:.55+i%3*.15,colors:[color,accent,'#fff4d0'],mote:['M0-4L2 0L0 4L-2 0Z','M-4 1Q0-5 4 1Q0 5-4 1','M-4 0H4M0-4V4'][i%3]}])));
  const scenes=Object.freeze(Object.fromEntries(entries.slice(4).map(([id],i)=>[id,{duration:2600+i%5*160,kind:'journey-'+id,art:'summon-journey-'+id+(id==='ruyi'?'-v2.png':'-v1.png')}])));
  const has=id=>Object.prototype.hasOwnProperty.call(designs,id);
  function staffState(phase,age,reduced=false){
    if(!Number.isFinite(age)||age<0||!['cast','bite','caught'].includes(phase))return null;
    const start=phase==='caught'?680:phase==='cast'?30:0,duration=phase==='caught'?1260:phase==='cast'?640:phase==='bite'?560:1280,p=(age-start)/duration;
    if(p<0||p>=1)return null;
    return {phase,progress:p,reduced,alpha:ease(p/.12)*(1-ease((p-.83)/.17))*(reduced?.18:1)};
  }
  // A rigid staff turns about the wrist. Trail samples use this same trajectory,
  // never independent particles; the physical rod and line are not transformed.
  function staffPose(state={}){
    const p=state.reduced?.46:clamp(state.progress),phase=state.phase||'summon';
    const turn={summon:[-.42,-.72,TAU+.25,TAU+.32],cast:[-.32,-.8,TAU*2+.38,TAU*2+.62],bite:[.3,-.18,.76,.48],reeling:[.6,1.05,-TAU+.2,-TAU+.45],caught:[1.18,1.52,-TAU*2-.18,-TAU*2]}[phase]||[0,0,0,0];
    const anticipation=ease(p/.16),spin=ease((p-.16)/.64),settle=ease((p-.8)/.2);
    const angle=state.reduced?.36:turn[0]+(turn[1]-turn[0])*anticipation+(turn[2]-turn[1])*spin+(turn[3]-turn[2])*settle;
    const x=state.reduced?0:Math.sin(p*Math.PI)*.055,y=state.reduced?0:-Math.sin(p*Math.PI)*.07;
    return {x,y,angle,stage:p<.16?'anticipation':p<.8?'spin':'settle',tip:{x:x+Math.sin(angle)*.78,y:y-Math.cos(angle)*.78},butt:{x:x-Math.sin(angle)*.78,y:y+Math.cos(angle)*.78}};
  }
  function staffGeometry(state){
    const out=[],p=state.reduced?.46:clamp(state.progress),at=(q,x,y)=>[q.x+x*Math.cos(q.angle)-y*Math.sin(q.angle),q.y+x*Math.sin(q.angle)+y*Math.cos(q.angle)];
    const path=(points,color,width,alpha,extra={})=>out.push({points:points.map(([x,y])=>({x,y,w:width})),color,width,alpha,...extra});
    if(!state.reduced){
      // The two gold ends draw opposing ribbons, tapered toward their history.
      for(const side of [-1,1]){
        const outer=[],inner=[],rim=[];
        for(let j=0;j<=40;j++){
          const t=j/40,q=staffPose({...state,progress:Math.max(0,p-(1-t)*.10)}),w=Math.sin(t*Math.PI)*.041;
          outer.push(at(q,0,side*(.78+w)));inner.unshift(at(q,0,side*(.78-w)));rim.push(at(q,0,side*.78));
        }
        path([...outer,...inner],1,.002,.13,{fill:true});path(rim,1,.006,.65);
      }
    }
    const staff=(time,alpha,detail)=>{
      const q=staffPose({...state,progress:time}),shade=[at(q,-.05,0),at(q,.05,0)];
      const face=(pts,material)=>path(pts.map(([x,y])=>at(q,x,y)),1,.002,alpha,{fill:true,material,shade});
      face([[-.035,-.77],[.035,-.77],[.035,.77],[-.035,.77]],'iron');
      for(const side of [-1,1]){
        face([[-.035,side*.49],[-.05,side*.515],[-.05,side*.754],[-.038,side*.78],[.038,side*.78],[.05,side*.754],[.05,side*.515],[.035,side*.49]],'gold');
        if(detail){
          for(const y of [.518,.538,.737,.76])path([at(q,-.049,side*y),at(q,.049,side*y)],1,.003,alpha*.75,{ink:'#fff0bf'});
          for(let row=0;row<3;row++){
            const pts=Array.from({length:15},(_,i)=>{const a=i/14*TAU*1.25,r=.024*(1-i/20);return at(q,Math.cos(a)*r,side*(.58+row*.051)+Math.sin(a)*r);});
            path(pts,0,.003,alpha*.82,{ink:'#704119'});
          }
        }
      }
      if(detail)path([at(q,-.012,-.49),at(q,-.012,.49)],2,.002,alpha*.48,{ink:'#f7966b'});
    };
    if(!state.reduced)for(const [lag,alpha] of [[.057,.055],[.037,.09],[.019,.14]])if(p>lag)staff(p-lag,alpha,false);
    staff(p,1,true);return out;
  }
  // Separate anticipation, strike and recovery are evaluated from the same
  // simulation clock. Decorative paths never modify line or rod geometry.
  function pose(id,state={}){
    const i=entries.findIndex(e=>e[0]===id),p=state.reduced?.46:clamp(state.progress),phase=state.phase||'summon';
    const wind=ease(p/.30),strike=ease((p-.30)/.23),recovery=ease((p-.72)/.28),pulse=Math.sin(p*Math.PI);
    const q={x:0,y:0,rotation:0,scale:1,wing:0,opening:wind,draw:strike,orbit:p*(.3+i*.04),lift:0,strike,fold:recovery,travel:strike};
    if(id==='whitedragon'){q.wing=Math.sin(p*TAU)*.28;q.rotation=-.10+.20*strike;q.y=-pulse*.09;q.orbit=p*TAU*.45;}
    else if(id==='kasaya'){q.wing=(wind-strike*.55)*.38;q.opening=.22+wind*.78-recovery*.2;q.y=-pulse*.04;}
    else if(id==='windfan'){q.wing=-wind*.28+strike*.70-recovery*.24;q.draw=strike;q.x=(strike-recovery*.4)*.05;q.orbit=p*1.7;}
    else if(id==='redboy'){q.wing=-wind*.18+strike*.35;q.opening=.3+wind*.7;q.y=-pulse*.08;q.orbit=p*3.2;}
    else if(id==='jadebottle'){q.wing=Math.sin(p*Math.PI)*.18;q.opening=.35+.65*strike;q.y=-pulse*.055;q.orbit=p*.43;}
    else if(id==='demonmirror'){q.wing=0;q.rotation=-.12+.24*strike;q.opening=strike;q.orbit=p*.57;}
    else if(id==='goldenbell'){q.wing=Math.sin(p*TAU*1.5)*.22;q.opening=wind;q.orbit=p*2.1;}
    else if(id==='sevenstars'){q.wing=-wind*.16+strike*.42-recovery*.20;q.rotation=q.wing*.3;q.draw=strike;q.orbit=p*.83;}
    else if(id==='gourd'){q.wing=-wind*.16+strike*.28;q.rotation=q.wing;q.opening=.3+strike*.7;q.orbit=p*2.7;}
    else if(id==='lotuswheel'){q.wing=Math.sin(p*TAU)*.13;q.y=-pulse*.11;q.draw=strike;q.orbit=p*TAU*.83;}
    else if(id==='ruyi'){const staff=staffPose(state);q.wing=staff.angle;q.rotation=staff.angle;q.x=staff.x;q.y=staff.y;q.orbit=staff.angle;}
    else if(id==='erlang'){q.wing=-wind*.20+strike*.46-recovery*.18;q.x=(strike-recovery*.6)*.045;q.opening=strike;q.orbit=p*.91;}
    else if(id==='wukong'){q.wing=-wind*.24+strike*.57-recovery*.24;q.x=(strike-recovery*.6)*.07;q.y=-pulse*.04;q.orbit=p*1.73;}
    else{q.wing=Math.sin(p*Math.PI)*(.06+i*.004);q.rotation=q.wing;q.opening=ease(p/(.31+i*.004));q.y=-pulse*(.03+i*.003);}
    if(phase==='bite'){q.x*=.35;q.y*=.35;q.wing*=.6;}
    if(phase==='reeling'){q.x*=.25;q.y*=.3;q.wing*=.45;}
    q.lift=q.y;return q;
  }
  function geometry(id,state={}){
    if(!has(id))return [];
    if(id==='ruyi')return staffGeometry(state);
    const p=state.reduced?.46:clamp(state.progress??.46),phase=state.phase||'summon',out=[];
    const line=(points,color=1,width=.013,alpha=.85)=>out.push({points:points.map(q=>({x:q[0],y:q[1],w:width})),color,width,alpha});
    const surface=(points,color=0,alpha=.42)=>{line(points,color,.008,alpha);out[out.length-1].fill=true;};
    const curve=(fn,color=1,width=.013,alpha=.85)=>line(Array.from({length:65},(_,i)=>fn(i/64)),color,width,alpha);
    const ring=(x,y,rx,ry=rx,color=1,turn=0)=>curve(u=>{const a=u*TAU,xx=Math.cos(a)*rx,yy=Math.sin(a)*ry;return[x+xx*Math.cos(turn)-yy*Math.sin(turn),y+xx*Math.sin(turn)+yy*Math.cos(turn)];},color,.012,.65);
    const petal=(x,y,a,length,width,color=1)=>curve(u=>{const f=Math.sin(u*Math.PI),along=(1-Math.cos(u*TAU))*.5*length,across=Math.sin(u*TAU)*width*f;return[x+Math.cos(a)*along-Math.sin(a)*across,y+Math.sin(a)*along+Math.cos(a)*across];},color,.012,.8);
    const cloud=(x,y,r)=>curve(u=>{const a=u*TAU*1.7,rr=r*(1-u*.88);return[x+Math.cos(a)*rr,y+Math.sin(a)*rr*.6];},1,.017,.75);
    const blade=(x,y,length,width)=>{line([[x,y+length/2],[x-width,y-length*.26],[x,y-length/2],[x+width,y-length*.26],[x,y+length/2]],2,.014);line([[x,y-length/2],[x,y+length/2]],1,.008);};
    const glyph=(x,y,r)=>{ring(x,y,r,r,1);for(let j=0;j<8;j++){const a=j/8*TAU;line([[x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82],[x+Math.cos(a)*r*.94,y+Math.sin(a)*r*.94]],2,.009);}};
    const strike=ease((p-.18)/.36),fade=1-ease((p-.76)/.24);
    if(phase!=='summon'){
      if(['redboy','lotuswheel'].includes(id)){
        for(let j=0;j<7;j++)curve(u=>{const a=(j-3)*.24;return[Math.sin(a)*u*(.4+strike*.7)+Math.sin(u*8-p*5+j)*u*.08,.43-u*(.55+strike*.8)];},j%2,.019,.78*fade);
        if(id==='lotuswheel')for(const side of[-1,1])ring(side*.36,.12,.23,.23,1,p*4*side);
      }else if(id==='windfan'){
        for(let j=0;j<5;j++)curve(u=>{const a=u*TAU*.85-p*2+j*.2,r=.18+u*.65;return[Math.cos(a)*r,Math.sin(a)*r*.3+j*.06];},j%2,.017,.75);
      }else if(id==='jadebottle'){
        for(let j=0;j<7;j++){const travel=(p+j*.13)%1;ring((j-3)*.13,.6-travel*1.4,.019,.055,2);}for(let j=0;j<3;j++)ring(0,.40,.2+strike*.6+j*.09,.04+j*.018,1);
      }else if(id==='demonmirror'){
        line([[-.10,-.82],[.10,-.82],[.42,.4],[-.42,.4],[-.10,-.82]],2,.009,.35*fade);ring(0,.38,.15+strike*.5,.08,1);glyph(0,-.42,.22);
      }else if(id==='goldenbell'||id==='goldenhoop'){
        for(let j=0;j<4;j++)ring(0,0,.12+((p+j*.22)%1)*.75,.06+((p+j*.22)%1)*.35,j%2);
      }else if(id==='gourd'){
        for(let j=0;j<4;j++)curve(u=>{const a=u*TAU*1.3+j*TAU/4-p*3,r=(.9-u*.84)*(1-p*.15);return[Math.cos(a)*r,Math.sin(a)*r*.5-u*.2];},j%2,.016,.8);
      }else if(['sevenstars','erlang','moonspade','ninerake'].includes(id)){
        const cuts=id==='ninerake'?9:id==='erlang'?3:1;
        for(let j=0;j<cuts;j++)curve(u=>{const a=-2.7+u*(.2+strike*2.8),r=.65+j*.026;return[Math.cos(a)*r,Math.sin(a)*r*.65+(j-(cuts-1)/2)*.045];},j%2,.011,.8*fade);
        if(id==='sevenstars')for(let j=0;j<7;j++)glyph(-.68+j*.22,Math.sin(j*1.2)*.17,.025);
      }else if(id==='kasaya'){
        for(const side of[-1,1])curve(u=>[side*(.15+u*.73),Math.sin(u*TAU-p*3)*.14+u*.23],side<0?0:1,.032,.68);
      }else if(id==='whitedragon'){
        for(let j=0;j<3;j++)curve(u=>{const a=u*TAU*1.1-p*2+j*.18,r=.62-u*.32;return[Math.cos(a)*r,Math.sin(a)*r*.72-u*.24];},j%2,.025-j*.006,.8);
      }else if(id==='wukong'){
        const count=3;
        for(let j=0;j<count;j++){const x=(j-(count-1)/2)*.43,angle=(strike-.5)*2.8+j*.12;line([[x-Math.sin(angle)*.73,Math.cos(angle)*.73],[x+Math.sin(angle)*.73,-Math.cos(angle)*.73]],1,.033,.8-j*.13);ring(x,.46,.18+strike*.22,.055,2);}
        for(const side of[-1,1])cloud(side*.54,.27,.25);
      }else for(let j=0;j<3;j++)cloud((j-1)*.35,.2-j*.07,.25);
    }else{
      // Faceted sacred objects stay translucent, with their own anatomy and
      // engraving. Their centers and motion still use the canonical rod curve.
      if(['wukong','monkeytwig'].includes(id)){
        surface([[-.38,-.39],[-.20,-.58],[0,-.51],[.20,-.58],[.38,-.39],[.34,.04],[.16,.24],[0,.29],[-.16,.24],[-.34,.04]],0,.55);
        for(const side of[-1,1]){
          surface([[side*.03,-.30],[side*.15,-.37],[side*.30,-.25],[side*.25,-.13],[side*.08,-.13]],1,.36);
          surface([[side*.10,.25],[side*.35,.20],[side*.51,.40],[side*.44,.66],[side*.08,.60]],0,.42);
          line([[side*.08,.29],[side*.31,.29],[side*.40,.44],[side*.13,.47]],1,.012);
          for(let k=0;k<4;k++)line([[side*(.14+k*.065),.46],[side*(.13+k*.067),.61]],1,.005);
          ring(side*.42,-.17,.085,.12,1);
          for(let k=0;k<4;k++)line([[side*(.25+k*.08),-.69-k*.025],[side*(.29+k*.09),-.61-k*.025]],2,.005);
        }
        surface([[-.28,-.53],[-.20,-.79],[-.09,-.60],[0,-.86],[.09,-.60],[.20,-.79],[.28,-.53]],1,.52);
        surface([[0,-.77],[-.046,-.66],[0,-.59],[.046,-.66]],0,.8);
        line([[0,-.09],[-.045,-.015],[0,.017],[.045,-.015],[0,-.09]],2,.008);
        line([[-.42,-.11],[-.38,-.44],[-.19,-.64],[0,-.54],[.19,-.64],[.38,-.44],[.42,-.11],[.24,.17],[0,.29],[-.24,.17],[-.42,-.11]],1,.020);
        for(const side of[-1,1]){line([[side*.03,-.27],[side*.15,-.36],[side*.30,-.25],[side*.23,-.12],[side*.07,-.12]],2,.015);curve(u=>[side*(.18+u*.51),-.53-Math.sin(u*Math.PI)*.46+u*.22],1,.012);cloud(side*.48,.39,.21);}
        ring(0,-.45,.30,.085,1);line([[-.1,.08],[0,.12],[.1,.08]],2,.011);line([[-.61,.55],[.63,-.78]],1,.034);
        if(id==='wukong')for(const side of[-1,1]){ring(side*.65,-.1,.17,.23,1);line([[side*.65,-.27],[side*.74,-.53]],2,.014);}
      }else if(['sevenstars','erlang','moonspade','ninerake'].includes(id)){
        surface([[0,-.83],[-(id==='erlang'?.12:.065),-.43],[0,.82],[(id==='erlang'?.12:.065),-.43]],0,.55);
        if(id==='erlang'){
          for(const side of[-1,1]){
            surface([[side*.18,-.65],[side*.34,-.78],[side*.54,-.52],[side*.43,-.17],[side*.17,-.05]],0,.35);
            line([[side*.2,-.49],[side*.30,-.55],[side*.39,-.45],[side*.29,-.43]],2,.009);
            curve(u=>[side*(.39+u*.31),-.55+u*.41+Math.sin(u*3)*.08],1,.012);
          }
          surface([[0,-.79],[-.055,-.68],[0,-.58],[.055,-.68]],1,.65);
          ring(0,-.69,.025,.048,2);
        }
        blade(0,0,1.65,id==='erlang'?.12:.065);line([[-.34,.42],[.34,.42]],1,.024);
        if(id==='ninerake')for(let j=0;j<9;j++)line([[(j-4)*.12,-.25],[(j-4)*.12,-.68],[(j-4)*.10,-.81]],2,.024);
        if(id==='erlang'){for(const side of[-1,1])line([[side*.05,.1],[side*.31,-.38],[side*.29,-.67],[side*.43,-.82]],1,.025);petal(0,.55,0,.14,.055,2);}
        if(id==='moonspade')curve(u=>{const a=.22+u*(Math.PI-.44);return[Math.cos(a)*.46,-.51+Math.sin(a)*.36];},2,.06);
        if(id==='sevenstars')for(let j=0;j<7;j++)glyph(Math.sin(j*1.9)*.13,-.58+j*.14,.035);
      }else if(id==='windfan'){
        const edge=Array.from({length:29},(_,k)=>{const a=-2.6+k/28*2.05;return[Math.cos(a)*.9,.5+Math.sin(a)*1.15];});
        surface([[0,.5],...edge,[0,.5]],0,.42);
        for(let j=0;j<13;j++){const a=-2.6+j/12*2.05;curve(u=>[Math.cos(a)*u*.9,.50+Math.sin(a)*u*1.15],j%2,.014);petal(0,.5,a,.9,.045,j%2);}
        line([[0,.5],[.16,.76]],1,.035);cloud(-.5,.45,.24);
      }else if(id==='jadebottle'||id==='gourd'){
        const outline=id==='gourd'?[[0,-.83],[-.12,-.81],[-.10,-.65],[-.26,-.5],[-.28,-.27],[-.12,-.13],[-.4,.07],[-.42,.39],[-.21,.64],[0,.7]]:[[0,-.8],[-.12,-.8],[-.07,-.67],[-.07,-.38],[-.31,-.23],[-.43,.14],[-.29,.53],[0,.62]];
        surface([...outline,...outline.slice(0,-1).reverse().map(q=>[-q[0],q[1]])],0,.58);
        for(let k=0;k<3;k++)curve(u=>[Math.sin(u*Math.PI)*(.22-k*.064),-.48+u*1.02],2,.008,.24);
        for(const y of(id==='gourd'?[-.4,.3]:[-.09,.32])){ring(0,y,id==='gourd'?.23:.28,.075,1);for(let k=0;k<5;k++){const x=(k-2)*.073;line([[x,y-.038],[x+.027,y],[x,y+.038],[x-.027,y],[x,y-.038]],1,.005,.8);}}
        for(const side of[-1,1])line(outline.map(q=>[q[0]*side,q[1]]),1,.014);ring(0,id==='gourd'?-.12:-.65,.14,.035,2);
        if(id==='jadebottle'){curve(u=>[.04+Math.sin(u*2.8)*.34,-.65-u*.4],1,.012);for(let j=0;j<5;j++)petal(.15+j*.03,-.71-j*.06,-.35,.17,.034,2);}else{cloud(.42,-.11,.15);line([[.16,-.1],[.51,.05],[.44,.52]],0,.026);}
      }else if(id==='goldenbell'){
        for(let j=-1;j<=1;j++){const x=j*.45,y=Math.abs(j)*.2;
          surface([[x-.08,y-.57],[x-.17,y-.31],[x-.18,y-.05],[x-.28,y+.19],[x+.28,y+.19],[x+.18,y-.05],[x+.17,y-.31],[x+.08,y-.57]],0,.52);
          for(let k=0;k<3;k++){const yy=y-.30+k*.13;line([[x-.12,yy],[x,yy+.045],[x+.12,yy]],1,.007);}
          line([[x-.08,y-.57],[x-.17,y-.31],[x-.17,y-.05],[x-.28,y+.19],[x+.28,y+.19],[x+.17,y-.05],[x+.17,y-.31],[x+.08,y-.57]],1,.024);ring(x,y-.61,.07,.07,2);ring(x,y+.13,.23,.05,2);line([[x,y+.17],[x,y+.34]],2,.02);}
      }else if(id==='demonmirror'||id==='goldenhoop'){
        surface(Array.from({length:65},(_,j)=>[Math.cos(j/64*TAU)*.47,Math.sin(j/64*TAU)*.47]),0,.48);
        for(let j=0;j<8;j++){const a=j/8*TAU;surface([[Math.cos(a)*.55,Math.sin(a)*.55],[Math.cos(a+.055)*.49,Math.sin(a+.055)*.49],[Math.cos(a)*.43,Math.sin(a)*.43],[Math.cos(a-.055)*.49,Math.sin(a-.055)*.49]],1,.5);}
        glyph(0,0,.56);ring(0,0,.47,.47,2);if(id==='demonmirror'){for(const side of[-1,1])line([[side*.05,0],[side*.20,-.12],[side*.36,0],[side*.20,.12],[side*.05,0]],2,.018);line([[0,.56],[0,.85]],1,.07);}else{cloud(-.3,0,.19);cloud(.3,0,.19);}
      }else if(id==='whitedragon'){
        const body=u=>[Math.sin(u*TAU*1.4)*(.3+u*.2),.75-u*1.45];
        const sides=[-1,1].flatMap(side=>Array.from({length:49},(_,j)=>{const u=side<0?j/48:1-j/48,q=body(u),r=.065*Math.sin(u*Math.PI)**.5;return[q[0]+side*r,q[1]];}));surface(sides,0,.64);
        curve(body,1,.048,.55);
        for(let j=0;j<18;j++){const u=.10+j*.040,q=body(u);curve(v=>[q[0]+(v-.5)*.11,q[1]+Math.sin(v*Math.PI)*.03],2,.004,.65);}
        surface([[-.19,-.65],[-.13,-.8],[.07,-.82],[.24,-.69],[.17,-.53],[-.03,-.49],[-.18,-.57]],0,.62);
        for(const side of[-1,1]){
          line([[side*.06,-.66],[side*.13,-.69],[side*.15,-.65]],2,.009);ring(side*.105,-.655,.013,.013,2);
          const q=body(side<0?.57:.35);line([[q[0],q[1]],[q[0]+side*.15,q[1]+.03],[q[0]+side*.21,q[1]],[q[0]+side*.24,q[1]-.08]],1,.017);
          for(let j=0;j<3;j++)line([[q[0]+side*.21,q[1]],[q[0]+side*(.20+j*.045),q[1]-.09]],2,.007);
        }for(const side of[-1,1]){line([[side*.13,-.61],[side*.30,-.84],[side*.34,-.64]],2,.018);curve(u=>[side*(.12+u*.49),-.58+Math.sin(u*4)*.14],2,.012);}ring(0,-.61,.17,.12,1);
      }else if(id==='redboy'||id==='lotuswheel'){
        for(let j=0;j<5;j++){const x=(j-2)*.115,h=.65-Math.abs(j-2)*.10,w=.07;surface([[x,.35],[x-w,.12],[x-w*.75,-.08],[x+Math.sin(p*4+j)*.05,-h],[x+w*.75,-.11],[x+w,.15]],j%2,.46);}
        for(let j=0;j<7;j++)petal(0,.48,-Math.PI+j*Math.PI/6,.6,.11,j%2);
        for(let j=0;j<5;j++)curve(u=>[(j-2)*.14+Math.sin(u*6+p*4+j)*u*.07,.3-u*(1-Math.abs(j-2)*.12)],j%2,.035);
        if(id==='lotuswheel')for(const side of[-1,1]){ring(side*.46,.34,.28,.28,2);for(let j=0;j<8;j++)petal(side*.46,.34,j/8*TAU+p*2,.35,.035,1);}
      }else if(id==='kasaya'){
        for(const side of[-1,1]){
          surface([[0,-.74],[side*.43,-.56],[side*.72,.52],[side*.3,.71],[0,.53]],0,.46);
          for(let row=0;row<5;row++)for(let col=0;col<3;col++){const x=side*(.09+col*.12+row*.017),y=-.38+row*.175;line([[x,y-.034],[x+side*.035,y],[x,y+.034],[x-side*.035,y],[x,y-.034]],1,.005,.6);}
          line([[0,-.74],[side*.43,-.56],[side*.72,.52],[side*.3,.71],[0,.53]],1,.025);for(let j=0;j<6;j++)line([[side*.06,-.51+j*.17],[side*(.37+j*.04),-.44+j*.17]],2,.008);}glyph(0,-.7,.13);
      }else for(let j=0;j<12;j++)ring(Math.cos(j/12*TAU)*.46,Math.sin(j/12*TAU)*.46,.06,.06,j%2);
    }
    const rotation=state.reduced?0:phase==='summon'?Math.sin(p*Math.PI)*.09:phase==='cast'?(strike-.5)*.28:phase==='caught'?-Math.sin(p*Math.PI)*.13:.05;
    for(const form of out)form.points=form.points.map(q=>({...q,x:q.x*Math.cos(rotation)-q.y*Math.sin(rotation),y:q.x*Math.sin(rotation)+q.y*Math.cos(rotation)}));
    return out;
  }
  function paint(ctx,id,state,position,g){
    const colors=designs[id]?.colors;if(!colors)return;
    const gather=state.phase==='summon'&&!state.reduced?ease((state.progress-.63)/.32):0,anchor=g?.curve?.(.56)||position;
    const size=position.size*(1-gather*.93),x=position.x+(anchor.x-position.x)*gather,y=position.y+(anchor.y-position.y)*gather;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineCap='round';ctx.lineJoin='round';
    const material=ctx.createLinearGradient(x-size*.68,y-size*.85,x+size*.63,y+size*.72);
    material.addColorStop(0,colors[0]);material.addColorStop(.33,colors[1]);material.addColorStop(.49,colors[2]);material.addColorStop(.54,colors[0]);material.addColorStop(.82,colors[1]);material.addColorStop(1,colors[0]);
    for(const form of geometry(id,state)){
      ctx.beginPath();form.points.forEach((q,i)=>i?ctx.lineTo(x+q.x*size,y+q.y*size):ctx.moveTo(x+q.x*size,y+q.y*size));
      if(form.material){
        const [a,b]=form.shade,gradient=ctx.createLinearGradient(x+a[0]*size,y+a[1]*size,x+b[0]*size,y+b[1]*size);
        const stops=form.material==='iron'?['#3d1516','#9e2925','#eb855d','#8b231c','#39191b']:['#795021','#d29b3e','#fff1ba','#d3a04e','#785027'];
        stops.forEach((color,i)=>gradient.addColorStop(i/4,color));ctx.closePath();ctx.fillStyle=gradient;ctx.globalAlpha=(state.alpha??1)*form.alpha;ctx.fill();
        ctx.strokeStyle=form.material==='gold'?'#f5cf7b':'#ce6244';ctx.lineWidth=.4;ctx.globalAlpha=(state.alpha??1)*form.alpha*.75;ctx.stroke();continue;
      }
      if(form.ink){ctx.strokeStyle=form.ink;ctx.globalAlpha=(state.alpha??1)*form.alpha;ctx.lineWidth=Math.max(.3,form.width*size);ctx.stroke();continue;}
      if(form.fill){ctx.closePath();ctx.fillStyle=form.color===0?material:colors[form.color];ctx.globalAlpha=(state.alpha??1)*form.alpha*.82;ctx.fill();}
      const alpha=(state.alpha??1)*form.alpha;
      ctx.strokeStyle=colors[form.color];ctx.globalAlpha=alpha*.17;ctx.lineWidth=Math.max(.6,form.width*size*4.1);ctx.stroke();
      ctx.strokeStyle=form.fill?colors[1]:colors[form.color];ctx.globalAlpha=alpha*.86;ctx.lineWidth=Math.max(.45,form.width*size*1.45);ctx.stroke();
      ctx.strokeStyle=colors[2];ctx.lineWidth=Math.max(.3,form.width*size*.42);ctx.globalAlpha=alpha*.72;ctx.stroke();
    }ctx.restore();
  }
  return Object.freeze({designs,scenes,has,pose,geometry,paint,staffPose,staffState});
});
