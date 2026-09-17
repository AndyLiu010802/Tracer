(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./pet-art') : root.TracerPetArt);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerPetBuiltinAnimation = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Art) {
  'use strict';
  const actions = Object.freeze(['idle','pet','feed','play','sleep','wake','focus','drag','fishing','exercise','farming','mining','reading','writing','crafting','tea']);
  const frames = 16;
  // Each row is an authored pose: head angle/down, left/right shoulder, left/right
  // ankle, tail, ears, chest compression, gaze, and mouth. Four in-betweens join
  // each pose. Feet stay planted except for an explicitly authored step/stretch.
  const rest = [0,0,0,0,0,0,0,0,0,0,0];
  const keys = {
    idle: [rest,[-3,0,-2,1,0,0,4,-4,.3,-1,0],[2,1,1,-2,0,0,-3,3,0,1,0],[4,1,-3,3,0,0,-2,-4,-.2,-1,0],rest],
    pet: [rest,[-7,1,-8,6,0,0,8,-9,.6,-2,0],[5,-1,-3,10,0,0,-6,6,.2,1,1],[-3,1,-5,3,0,0,4,-3,0,0,0],rest],
    feed: [[2,2,-5,12,0,0,0,0,.5,2,0],[6,4,-9,42,0,0,4,-3,1,2,2],[2,1,-10,75,0,0,-2,1,.3,0,4],[-2,0,-5,35,0,0,2,2,0,-1,2],[2,2,-5,12,0,0,0,0,.5,2,0]],
    play: [rest,[5,3,-6,12,2,-2,8,4,1,2,0],[-5,0,-22,-20,-5,4,-10,-7,-.4,-2,1],[3,2,-8,5,2,-1,6,2,.7,1,0],rest],
    sleep: [[8,9,-16,18,-3,3,-14,10,3,0,0],[8.7,8,-17,19,-3,3,-12,9,2.3,0,.1],[8.2,7.5,-16.4,18.4,-3,3,-13,8,1.7,0,.2],[7.4,8.4,-15.7,17.7,-3,3,-15,9.4,2.4,0,.1],[8,9,-16,18,-3,3,-14,10,3,0,0]],
    wake: [[5,5,-6,8,0,0,2,8,2,0,1],[0,0,22,-28,-5,5,-8,-6,-1,0,4],[-4,-2,34,-40,-8,7,9,3,-2,-1,6],[2,1,10,-12,-2,3,-3,-3,0,1,1],[5,5,-6,8,0,0,2,8,2,0,1]],
    focus: [[2,2,-5,-5,0,0,0,0,.2,1,0],[3.5,3,-6,-9,0,0,2,-2,.6,2,0],[1,2,-5,-6,0,0,-1,1,.1,-1,0],[0,1,-4,-4,0,0,-2,2,0,0,0],[2,2,-5,-5,0,0,0,0,.2,1,0]],
    drag: [[-2,0,13,-13,-6,7,3,-6,0,-1,1],[2,1,17,-16,7,-6,-4,4,.2,1,0],[-3,0,12,-12,3,-2,5,-3,0,-1,1],[1,-1,15,-14,-8,5,-2,3,-.2,0,0],[-2,0,13,-13,-6,7,3,-6,0,-1,1]],
    fishing: [[3,1,-5,-8,0,0,0,1,.3,2,0],[6,3,-8,4,0,0,5,-3,.8,3,0],[2,0,-12,-24,0,0,-4,4,0,1,1],[-2,0,-6,-18,0,0,2,-2,-.2,0,0],[3,1,-5,-8,0,0,0,1,.3,2,0]],
    exercise: [[0,0,-6,6,0,0,0,0,0,0,0],[-3,-1,21,-26,-4,4,7,-4,-1,-1,1],[2,-2,34,-38,4,-5,-6,5,-1.5,1,2],[3,1,12,-15,-2,3,3,-2,.5,0,0],[0,0,-6,6,0,0,0,0,0,0,0]],
    farming: [[3,2,-4,-6,0,0,0,1,.5,2,0],[7,4,-10,-25,0,0,5,-4,1,3,0],[5,3,-6,9,0,0,-3,2,.7,2,1],[1,0,-3,-12,0,0,2,-1,0,0,0],[3,2,-4,-6,0,0,0,1,.5,2,0]],
    mining: [[2,1,-4,-8,0,0,0,0,.3,1,0],[-3,-1,-12,-39,0,0,7,-5,-.5,0,1],[7,4,-5,12,0,0,-5,3,1.1,3,2],[4,2,-6,-7,0,0,2,1,.4,2,0],[2,1,-4,-8,0,0,0,0,.3,1,0]],
    reading: [[4,2,-8,-11,0,0,0,0,.3,-1,0],[6,3,-10,-14,0,0,3,-2,.5,2,0],[2,2,-9,-25,0,0,-2,3,.1,0,0],[0,1,-7,-17,0,0,-1,-1,0,-2,0],[4,2,-8,-11,0,0,0,0,.3,-1,0]],
    writing: [[4,2,-6,-13,0,0,0,0,.3,1,0],[6,3,-7,-20,0,0,3,-2,.6,2,0],[3,2,-5,-9,0,0,-2,2,.2,1,1],[0,0,-6,-25,0,0,1,-1,-.1,-1,0],[4,2,-6,-13,0,0,0,0,.3,1,0]],
    crafting: [[3,2,-9,-11,0,0,0,0,.4,1,0],[6,3,-14,-26,0,0,4,-3,.8,2,0],[1,1,-6,-4,0,0,-3,2,.2,0,1],[-2,0,-10,-19,0,0,2,1,0,-1,0],[3,2,-9,-11,0,0,0,0,.4,1,0]],
    tea: [[1,1,-5,8,0,0,0,0,.2,1,0],[3,0,-7,48,0,0,3,-2,-.2,0,1],[-3,-1,-9,88,0,0,-2,2,-.3,-1,2],[-1,1,-6,35,0,0,1,-1,.1,0,0],[1,1,-5,8,0,0,0,0,.2,1,0]]
  };
  const species = {
    sprout: { hand:[115,109], shoulder:[112,88], eyes:[80,65], gain:.82, color:'#91af6e' },
    miso: { hand:[106,123], shoulder:[100,91], eyes:[80,66], gain:1, color:'#e4b77b' },
    brook: { hand:[122,106], shoulder:[106,70], eyes:[80,51], gain:.86, color:'#82b5c6' },
    ember: { hand:[127,131], shoulder:[120,104], eyes:[109,60], gain:.64, color:'#de9670' },
    luna: { hand:[100,123], shoulder:[99,93], eyes:[81,73], gain:.78, color:'#c6b6df' },
    nova: { hand:[114,114], shoulder:[99,88], eyes:[83,56], gain:.88, color:'#91cbb1' }
  };
  const n = value => Math.round(value * 1000) / 1000;
  const path = (fill,d) => '<path fill="'+fill+'" d="'+d+'"/>';
  const group = (body,transform='') => '<g'+(transform?' transform="'+transform+'"':'')+'>'+body+'</g>';
  function pose(action,frame) {
    const sequence=keys[action], step=(frame%frames)/4, index=Math.floor(step), fraction=step-index;
    // Smoothstep in-betweens soften reversals without adding duplicate hold frames.
    const weight=fraction*fraction*(3-2*fraction);
    return sequence[index].map((value,key)=>value+(sequence[index+1][key]-value)*weight);
  }
  function transform(angle=0,x=0,y=0,sx=1,sy=1) { return 'translate('+n(x)+'px,'+n(y)+'px) rotate('+n(angle)+'deg) scale('+n(sx)+','+n(sy)+')'; }
  function props(id,action,frame,p) {
    const spec=species[id], [x,y]=spec.hand, [cx,cy]=spec.shoulder, progress=frame/16, wave=Math.sin(progress*Math.PI*2), turn=Math.max(0,Math.sin(progress*Math.PI*2-Math.PI/2));
    const held=body=>group(body,'rotate('+n(p[3]*spec.gain)+' '+cx+' '+cy+')');
    const cup=path('#46675f',`M${x-9} ${y-12}h15v3h5v9h-5v4h-15z`)+path('#c1d8bb',`M${x-7} ${y-10}h11v11h-11z`)+path('#7e5f43',`M${x-6} ${y-9}h9v2h-9z`)+path('#719287',`M${x+6} ${y-7}h3v5h-3z`);
    const book=path('#526d75','M66 119h27v-3h25v25H93v3H66z')+path('#e6d9b3','M69 121h21v18H69zM94 119h21v19H94z')+path('#b4a57f','M73 125h13v2H73zM73 130h11v2H73zM98 123h12v2H98zM98 128h10v2H98z');
    if(action==='reading'||action==='focus') return group(book+(action==='reading'?'<path fill="#f6e9c5" d="M93 119L'+n(94+22*turn)+' '+n(115-7*turn)+'V'+n(136-5*turn)+'L93 140Z"/>':''));
    if(action==='tea') return held(group(cup+group(path('#c1d6cf','M-3 0h2v-4h3v-4h-2v-3h2v4H0v5h-3z'),'translate('+x+' '+n(y-17+wave*1.5)+')'),'rotate('+n(-p[3]*spec.gain+turn*8)+' '+x+' '+y+')'));
    if(action==='feed') {
      const snack=id==='luna'?path('#9db773','M-3 -10h3v7h-3zM2 -10h3v6H2z')+path('#e4a05f','M-5 -3H6V2H3V6H0v4h-4z'):
        id==='miso'||id==='brook'?path(spec.color,'M-9 -3h5v-3h9v3h4l4-4V7L9 3H5v3h-9V3h-5z')+path('#354652','M-5 -2h2v2h-2z'):
        id==='nova'?path('#e5cd83','M-2 -9h4v6h6v4H3v7h-6V2h-6v-5h7z'):
        path(spec.color,'M-7 -4h14v4h3v7H5v3H-5V6h-5V0h3z')+path('#e9daa6','M-5 -2h3v5h-3z');
      return held(group(snack,'translate('+x+' '+(y-5)+')'));
    }
    if(action==='play') return group(path(spec.color,'M-7 -9H6v3h4V6H6v4H-7V6h-4V-6h4z')+path('#efe1ad','M-2 -8H1V8h-3zM-9 -2H8V1H-9z'),'translate('+n(118+10*wave)+' '+n(136-7*Math.max(0,Math.sin(progress*Math.PI*2)))+') rotate('+n(22*wave)+')');
    if(action==='fishing') return path('#3b6d7a','M103 138h43v3h7v7h-51v-3h-8v-4h9z')+path('#87b8bb',`M${n(106+wave*2)} 143h13v2h-13zM137 141h9v2h-9z`)+held(path('#b69868',`M${x-1} ${y}h3v-11h4V${y-24}h5V${y-38}h5v-3h-7v14h-5v12h-5z`))+group(path('#d5b37b','M-5 -2h8V0h4v4H3v2h-8V3h-4V0h4z')+path('#283e47','M1 0h2v2H1z'),'translate('+n(124+wave*7)+' 141)');
    if(action==='exercise') return held(path('#4c6672',`M${x-10} ${y-5}h4v-4h5v8h10v-8h5v4h4v13h-4v4h-5V5h-10v7h-5V8h-4z`.replace('V5', 'V'+(y+5)).replace('V8','V'+(y+8)))+path('#b6cbc6',`M${x-1} ${y+1}h10v3h-10z`));
    if(action==='farming') return path('#926e4f','M30 140h114v10H30z')+path('#6d9b67','M48 128h3v14h-3zM41 125h8v4h-8zM51 122h7v4h-7zM130 128h3v14h-3zM122 125h9v4h-9zM133 122h8v4h-8z')+held(path('#7da89a',`M${x-9} ${y-5}h15v18h-15zM${x-15} ${y-2}h6v4h-6zM${x+6} ${y-2}h6v8h-6v-3h3V${y+1}h-3z`))+group(path('#8ebec6','M0 0h2v4H0zM7 6h2v3H7z'),'translate(106 '+n(130+3*wave)+')');
    if(action==='mining') return path('#526c79','M121 127h17v6h8v15h-33v-13h8z')+path('#8bbcc7','M124 130h7v5h-7zM136 139h5v5h-5z')+held(path('#aa8b5d',`M${x-1} ${y-23}h3v29h-3z`)+path('#b2c7c9',`M${x-12} ${y-25}h24v4h-10v3h-4v-3h-10z`));
    if(action==='writing') return path('#d9d8b8','M85 124h47v22H85z')+path('#829a94',`M91 130h${n(14+7*turn)}v2H91zM91 136h${n(9+8*turn)}v2H91z`)+held(path('#c8a564',`M${x-1} ${y-14}h3v21h-3z`)+path('#466067',`M${x-1} ${y+7}h3l-2 4z`));
    if(action==='crafting') return path('#886f50','M92 143h53v5H92z')+group(path('#729693','M-8 -9H5v4h5V7H-9z')+path('#d9cf93','M-2 -6H2V4h-4zM-5 -2H5V1H-5z'),'translate(119 136) rotate('+n(wave*3)+')')+held(path('#b8996f',`M${x-1} ${y-12}h3v22h-3z`)+path('#8b9eac',`M${x-9} ${y-15}h19v8h-19z`));
    if(action==='pet') return group(path('#d6a7a6','M-5 -3h4V0H2v-3H6V3H3v3H0V4h-3V2h-2z'),'translate(137 '+n(57-wave*2)+')');
    if(action==='sleep') return group(path('#a2b5c6','M0 0h8v2H6v2H4v2H2v2H0V6h2V4h2V2H0z'),'translate(135 '+n(43-wave*1.5)+')');
    return '';
  }
  function snapshot(value,behavior='idle',frame=0) {
    const id=Object.prototype.hasOwnProperty.call(species,value)?value:'sprout';
    const action=actions.includes(behavior)?behavior:'idle', spec=species[id];
    const at=Number.isInteger(frame)?((frame%frames)+frames)%frames:0, p=pose(action,at), gain=spec.gain;
    if(action==='feed'||action==='tea') {
      p[1]+=Math.max(0,p[3]-12)/76*(id==='ember'?(action==='feed'?32:22):id==='brook'||id==='nova'?9:2);
      // The fox faces right: its paw reaches forward toward the muzzle, whereas
      // the front-facing companions bring the right hand inward toward the face.
      if(id==='ember')p[3]=-p[3];
    }
    const blink=action==='sleep'?0:at===11?.12:at===10||at===12?.65:1;
    const transforms={
      posture:transform(),head:transform(p[0]*gain,0,p[1]),body:transform(0,0,0,1,1-p[8]*.012),
      'arm-left':transform(p[2]*gain),'arm-right':transform(p[3]*gain),
      'leg-left':transform(p[4]*gain),'leg-right':transform(p[5]*gain),
      // Ember's wide tail already reaches x=5; keep its arc inside that margin.
      tail:transform(p[6]*(id==='ember'?.22:1)),
      'ear-left':transform(p[7]*gain),'ear-right':transform(-p[7]*gain*.7),
      leaf:transform(p[7]*1.2+p[0]*.4),
      'wing-left':transform(-p[2]*.35),'wing-right':transform(-p[3]*.35),
      eyes:transform(0,p[9]*.45,0,1,blink),mouth:transform(0,0,p[10]*.12,1,1+p[10]*.09),
      tongue:transform(0,0,p[10]*.3),map:transform(p[3]*.25)
    };
    if(action==='sleep') {
      // Retain the original species-specific rest silhouettes: cat loaf, tucked
      // fox paws, rabbit ears folded down, and dragon wings folded in.
      const lean={sprout:7,miso:-6,brook:-4,ember:12,luna:-8,nova:8}[id];
      const down={sprout:9,miso:12,brook:9,ember:15,luna:8,nova:9}[id];
      const chest={sprout:.9,miso:.82,brook:.92,ember:.8,luna:.9,nova:.96}[id];
      transforms.head=transform(lean+(p[0]-8),id==='ember'?-10:0,down+p[1]-8);
      transforms.body=transform(0,0,0,1,chest-(p[8]-2.3)*.012);
      if(id==='miso')Object.assign(transforms,{'arm-left':transform(-30+(p[2]+16),9,-3),'arm-right':transform(30+(p[3]-18),-9,-3),'leg-left':transform(0,0,-5),'leg-right':transform(0,0,-5),tail:transform((p[6]+14)*.4)});
      if(id==='ember')Object.assign(transforms,{'arm-left':transform(24+(p[2]+16)),'arm-right':transform(26+(p[3]-18)),'leg-left':transform(-20),'leg-right':transform(-18),tail:transform(-28+(p[6]+14)*.3,18,9)});
      if(id==='luna')Object.assign(transforms,{'ear-left':transform(-48+(p[7]-9)*.3),'ear-right':transform(42-(p[7]-9)*.3)});
      if(id==='nova')Object.assign(transforms,{'wing-left':transform(-32+(p[2]+16)*.3,0,0,.68,1),'wing-right':transform(32+(p[3]-18)*.3,0,0,.68,1),tail:transform(19+(p[6]+14)*.3)});
    }
    let svg=Art(id).replace('pet-sprite pet-rig ','pet-sprite pet-builtin-sprite pet-rig ')
      .replace('viewBox="0 0 160 160"','viewBox="0 0 160 160" style="animation:none!important;transform:none!important;overflow:hidden;filter:none"');
    svg=svg.replace(/<g class="([^"]+)"(?: style="([^"]*)")?>/g, (tag,classes,style='')=>{
      const part=classes.split(' ').find(name=>name.startsWith('rig-')&&name!=='rig-part')?.slice(4);
      if(part==='eyes')style='transform-origin:'+spec.eyes[0]+'px '+spec.eyes[1]+'px';
      let opacity=1;
      if(part==='eyes-closed')opacity=action==='sleep'?1:0;
      if(part==='eyes'&&action==='sleep')opacity=0;
      if(['sneeze','soil-pat','moonstone','pebbles','gadget','tail-curled','tongue'].includes(part))opacity=0;
      if(part==='tail-relaxed'&&id==='miso'&&action==='sleep')opacity=0;
      if(part==='tail-curled'&&id==='miso'&&action==='sleep')opacity=1;
      if(part==='tongue'&&id==='miso'&&action==='feed'&&at>=6&&at<=10)opacity=1;
      return '<g class="'+classes+'" style="'+style+';animation:none!important;transform-box:view-box;transform:'+(transforms[part]||'none')+'!important;opacity:'+opacity+'!important">';
    });
    return svg.replace('</svg>',props(id,action,at,p)+'</svg>');
  }
  function duration(action,frame) {
    if(frame===0)return action==='sleep'?800:action==='idle'?1000:action==='focus'?900:360;
    if(frame===8)return action==='sleep'?360:action==='idle'||action==='focus'?420:220;
    return action==='sleep'?140:action==='idle'||action==='focus'?130:100;
  }
  function create(options={}) {
    const id=typeof options.pet==='string'?options.pet:options.pet?.id;
    const wrapper=document.createElement('span');wrapper.innerHTML=snapshot(id);
    const element=wrapper.firstElementChild, media=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const cache=new Map();let action='idle',frame=0,timer=null,destroyed=false;
    if(options.label){element.setAttribute('aria-hidden','false');element.setAttribute('role','img');element.setAttribute('aria-label',options.label);}
    function stop(){if(timer!==null)clearTimeout(timer);timer=null;}
    function draw(){
      if(!cache.has(action))cache.set(action,Array.from({length:frames},(_,index)=>snapshot(id,action,index).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')));
      element.innerHTML=cache.get(action)[frame];element.dataset.action=action;element.dataset.frame=String(frame);element.dataset.frames=String(frames);
    }
    function schedule(){
      stop();const reason=destroyed?'destroyed':options.animated===false?'static':media?.matches?'reduced-motion':document.hidden?'hidden':'playing';
      element.dataset.playback=reason;if(reason!=='playing')return;
      timer=setTimeout(()=>{timer=null;frame=(frame+1)%frames;draw();schedule();},duration(action,frame));
    }
    function visibility(){if(destroyed)return;if(media?.matches){frame=0;draw();}schedule();}
    if(options.animated!==false){document.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',visibility);}
    draw();schedule();
    return {element,setAction(value){if(destroyed)return;const next=actions.includes(value)?value:'idle';if(action===next)return;action=next;frame=0;draw();schedule();},destroy(){if(destroyed)return;destroyed=true;stop();cache.clear();document.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',visibility);element.dataset.playback='destroyed';}};
  }
  return Object.freeze({actions,frames,snapshot,create,duration});
});
