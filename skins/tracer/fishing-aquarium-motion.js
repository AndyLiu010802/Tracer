(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerAquariumMotion=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const TAU=Math.PI*2;
  const tank=Object.freeze({x:2.24,z:1.25,bottom:-.90,top:1.14});
  // Conservative local bounds include fins, jewellery, and peak feeding poses.
  // Rates are radians/second; deformation amplitudes are local model units.
  const profiles={
    dragonkoi:{body:3.05,fin:3.30,tail:.22,paddle:.14,wave:.073,wing:0,pitch:.015,roll:.085,travel:1.02,bob:.055,extent:[1.72,.94,.64],play:'ribbon-dance'},
    galaxywhale:{body:2.05,fin:1.85,tail:.18,paddle:.11,wave:.050,wing:0,pitch:.025,roll:.055,travel:.78,bob:.055,extent:[2.06,.79,1.02],play:'bubble-rise'},
    gulpuffer:{body:3.45,fin:8.15,tail:.11,paddle:.23,wave:.018,wing:0,pitch:0,roll:.075,travel:.66,bob:.072,extent:[1.16,.90,.79],play:'moon-bob'},
    grumpangler:{body:2.40,fin:4.50,tail:.095,paddle:.14,wave:.024,wing:0,pitch:-.015,roll:.050,travel:.61,bob:.030,extent:[1.18,1.09,.78],play:'lure-nod'},
    flopray:{body:2.25,fin:2.10,tail:.065,paddle:.075,wave:.030,wing:.15,pitch:.16,roll:.115,travel:.82,bob:.055,extent:[1.88,.58,1.64],play:'soft-hug'},
    snagglefin:{body:3.35,fin:4.15,tail:.19,paddle:.17,wave:.10,wing:0,pitch:.005,roll:.11,travel:.93,bob:.04,extent:[1.39,1.17,.72],play:'wish-sway'}
  };
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  function hash(value){let result=2166136261;for(const character of String(value))result=Math.imul(result^character.charCodeAt(0),16777619);return result>>>0;}
  function smooth(value){const x=clamp(value,0,1);return x*x*x*(10+x*(-15+6*x));}
  function primitive(x){return x*x*x*x*(2.5+x*(-3+x));}
  function pulse(x,start,end,ramp){return smooth((x-start)/ramp)*smooth((end-x)/ramp);}
  function pulseIntegral(x,start,end,ramp){
    if(x<=start)return 0;
    if(x<start+ramp)return ramp*primitive((x-start)/ramp);
    if(x<=end-ramp)return ramp*.5+x-start-ramp;
    if(x<end){const u=(x-end+ramp)/ramp;return end-start-1.5*ramp+ramp*(u-primitive(u));}
    return end-start-ramp;
  }
  function behavior(time,seed){
    const duration=17.6+(seed%16)*.12,offset=((seed>>>5)%1000)/1000*duration,absolute=(time+offset)/duration,cycle=Math.floor(absolute),progress=absolute-cycle;
    const idle=pulse(progress,.37,.65,.065),play=pulse(progress,.70,.97,.06),swim=1-idle-play;
    // Integrating speed, rather than multiplying time by a current state weight,
    // prevents phase jumps when a fish eases into hovering or resumes swimming.
    const integrate=(base,idleDelta,playDelta)=>duration*(cycle*(base+idleDelta*(.28-.065)+playDelta*(.27-.06))+base*progress+idleDelta*pulseIntegral(progress,.37,.65,.065)+playDelta*pulseIntegral(progress,.70,.97,.06));
    return{duration,progress,weights:{swim,idle,play},mode:idle>.5?'idle':play>.5?'play':'swim',travelTime:integrate(1,-.90,.18),motorTime:integrate(1,-.54,.24)};
  }
  function laneFor(index,count){
    if(count===1)return{x:0,y:.07,z:0,rx:.68,ry:.11,rz:.31};
    if(count===2)return index===0?{x:-1.03,y:.19,z:-.03,rx:.19,ry:.065,rz:.21}:{x:1.03,y:-.07,z:.04,rx:.19,ry:.065,rz:.21};
    return[{x:-1.04,y:.32,z:-.30,rx:.14,ry:.042,rz:.13},{x:1.04,y:.27,z:-.28,rx:.14,ry:.042,rz:.13},{x:0,y:-.37,z:.43,rx:.16,ry:.040,rz:.11}][index];
  }
  // This matches the renderer's yaw * tilt(pitch, roll) transform. Bounding the
  // complete rotating fish, rather than its centre, keeps tails out of the glass.
  function transformedExtent(extent,scale,yaw,pitch,roll){
    const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch),d=Math.cos(roll),e=Math.sin(roll);
    const rows=[[c*d+s*b*e,-c*e+s*b*d,s*a],[a*e,a*d,-b],[-s*d+c*b*e,s*e+c*b*d,c*a]];
    return rows.map(row=>scale*row.reduce((sum,value,i)=>sum+Math.abs(value)*extent[i],0));
  }
  function safetyEnvelope(profile){
    const [x,y,z]=profile.extent,maxRoll=.23,maxPitch=.31;
    const horizontal=Math.hypot(x+y*Math.sin(maxRoll),z+y*Math.sin(maxPitch));
    const vertical=y+x*Math.sin(maxRoll)+z*Math.sin(maxPitch);
    return{horizontal,vertical};
  }
  function safeScale(requested,envelope){
    return Math.min(requested,(tank.z-.035)/envelope.horizontal,((tank.top-tank.bottom)*.5-.035)/envelope.vertical);
  }
  function inside(value,low,high){const middle=(low+high)*.5,half=Math.max(.001,(high-low)*.5);return middle+half*Math.tanh((value-middle)/half);}
  /**
   * Pure, deterministic aquarium animation. time is seconds; index/count select
   * one of 1–3 separate lanes. scale is the renderer's requested model scale.
   * Feed strength/progress are the existing 0..1 envelope, not wall-clock dates.
   * Use the returned scale in the model matrix (it is constant for this fish).
   * body/fin/wing Phase already include time: shaders add ONLY spatial phase.
   * bodyAmplitude/finAmplitude/wingAmplitude/wingFold are local model units.
   * tailBeat/tailLift/paddle/lureSwing are radians; breath is a local gill offset;
   * gaze is an eye-radius fraction. bodyPuff is an extra scale increment. Existing
   * feeding puff (.11*strength) and ray hug (.72*strength) remain independent.
   */
  function sample(fish,options={}){
    fish=fish||{};options=options||{};const species=String(fish.speciesId||fish.fishId||fish.id||'dragonkoi'),profile=Object.hasOwn(profiles,species)?profiles[species]:profiles.dragonkoi;
    const seed=hash(String(fish.instanceId||fish.id||species)+'|'+species),count=clamp(Math.floor(finite(options.count,1)),1,3),index=clamp(Math.floor(finite(options.index,0)),0,count-1),reduced=options.reducedMotion===true,time=reduced?0:Math.max(0,finite(options.time));
    const state=behavior(time,seed),weights=reduced?{swim:0,idle:1,play:0}:state.weights,{swim,idle,play}=weights,feed=reduced?0:clamp(finite(options.feed?.strength),0,1),feedProgress=clamp(finite(options.feed?.progress),0,1);
    const lane=laneFor(index,count),phase=(seed%997)/997*TAU,motor=(reduced?0:state.motorTime),bodyPhase=motor*profile.body+phase,finPhase=motor*profile.fin+phase*1.37,wingPhase=motor*profile.fin+phase;
    const a=(reduced?phase:state.travelTime*.19*profile.travel+phase),heading=Math.atan2(Math.sin(a)*lane.rz,Math.cos(a)*lane.rx),baseHeading=Math.atan2(Math.sin(a),Math.cos(a));
    const playWave=Math.sin(bodyPhase*.45),idleWave=Math.sin(time*.63+phase),feedWave=Math.sin(feedProgress*TAU);
    let roll=Math.sin(a+.4)*profile.roll*(.45*swim+.15*idle+.65*play),pitch=profile.pitch+Math.sin(a*.73+phase)*.035+feed*.045;
    let lift=Math.sin(a*.85+phase)*lane.ry+idleWave*profile.bob*(.22+.45*idle),sway=0;
    if(species==='dragonkoi'){roll+=play*playWave*.065;pitch+=play*Math.sin(bodyPhase*.35)*.075;sway=play*Math.sin(bodyPhase*.30)*.055;}
    else if(species==='galaxywhale'){lift+=play*(.10+.055*playWave);pitch+=play*playWave*.085;roll+=play*Math.sin(bodyPhase*.25)*.035;}
    else if(species==='gulpuffer'){lift+=play*playWave*.10;pitch+=play*Math.sin(finPhase*.25)*.050;}
    else if(species==='grumpangler'){pitch+=play*Math.sin(bodyPhase*.7)*.060;lift+=play*Math.sin(bodyPhase*.7)*.022;}
    else if(species==='flopray'){
      lift+=play*(.065+.035*playWave);
      // A small bank toward the fixed tank camera reveals the broad upper disc.
      // Resolve that bank in the fish's changing heading, so reversing direction
      // does not turn the same positive pitch into an edge-on or belly-up view.
      const viewX=.305*Math.cos(a)-.952*Math.sin(a),viewZ=.305*Math.sin(a)+.952*Math.cos(a);
      pitch=(.25+.015*idle+.015*play+feed*.025)*viewZ+Math.sin(a*.73+phase)*.012;
      roll=-(.16+.02*idle+.015*play)*viewX+Math.sin(wingPhase*.32)*.020*(.3*idle+.6*swim+play);
    }
    else if(species==='snagglefin'){roll+=play*playWave*.080;pitch+=play*Math.sin(bodyPhase*.3)*.055;sway=play*Math.sin(bodyPhase*.38)*.055;}
    roll+=feed*feedWave*.025;pitch=clamp(pitch,-.27,.30);roll=clamp(roll,-.22,.22);
    const angle=a+heading-baseHeading+sway,envelope=safetyEnvelope(profile),scale=safeScale(clamp(finite(options.scale,count===1?.60:.42),.05,1),envelope),extent=transformedExtent(profile.extent,scale,angle,pitch,roll),radial=envelope.horizontal*scale;
    const desired={x:lane.x+Math.sin(a)*lane.rx,y:lane.y+lift+feed*.075,z:lane.z+Math.cos(a)*lane.rz};
    // Keep the swimming corridor fixed while the fish turns. An angle-dependent
    // centre clamp pushes a wide ray backwards whenever its silhouette expands.
    const x=inside(desired.x,-tank.x+radial+.015,tank.x-radial-.015),y=inside(desired.y,tank.bottom+extent[1]+.015,tank.top-extent[1]-.015),z=inside(desired.z,-tank.z+radial+.015,tank.z-radial-.015);
    const activity=.26*idle+swim+1.25*play,flutter=.62*idle+swim+1.20*play;
    const articulation={
      bodyPhase,bodyAmplitude:profile.wave*activity*(1+feed*.18),
      finPhase,finAmplitude:.052*flutter,wingPhase,wingAmplitude:profile.wing*(.42*idle+swim+1.35*play),
      tailBeat:Math.sin(bodyPhase)*profile.tail*activity,tailLift:species==='galaxywhale'?Math.sin(bodyPhase)*profile.tail*activity:0,
      paddle:Math.sin(finPhase)*profile.paddle*flutter,breath:Math.sin(time*(species==='galaxywhale'?1.35:2.05)+phase)*.0055,
      wingFold:species==='flopray'?play*(.085+.040*Math.sin(wingPhase*.5)):0,
      bodyPuff:species==='gulpuffer'?.010+.006*Math.sin(time*1.55+phase)+play*(.021+.009*playWave):0,
      lureSwing:species==='grumpangler'?Math.sin(finPhase*.30)*(.065+.11*play+feed*.07):0,
      gaze:Math.sin(time*.68+phase)*(.055+.025*idle)
    };
    return{x,y,z,angle,pitch,roll,scale,species,seed,mode:reduced?'idle':state.mode,play:profile.play,weights,cycle:{duration:state.duration,progress:reduced?0:state.progress},lane:{index,count,...lane},extent:{x:extent[0],y:extent[1],z:extent[2]},articulation};
  }
  return Object.freeze({sample,tank});
});
