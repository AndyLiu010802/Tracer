(function(){
  'use strict';
  const T=window.Tracer,M=window.TracerCelebrationsModel,KEY='tracer.celebrations.v1',media=matchMedia('(prefers-reduced-motion: reduce)');
  const materials=['gold-foil','coral-paper','opal-diamond','sage-leaf','pearl-disc','rose-ribbon'];
  const tr=(zh,en)=>window.TracerLocale.language()==='zh'?zh:en;
  let pending=[],seen=new Set(),busy=false,timer=0,stopEffect=null,disposed=false,artPromise=null;
  try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');pending=Array.isArray(value.pending)?value.pending.filter(e=>e&&typeof e.key==='string'&&typeof e.id==='string'&&e.type==='project'):[];seen=new Set(Array.isArray(value.seen)?value.seen.filter(key=>typeof key==='string'):[]);}catch{}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify({pending,seen:[...seen].slice(-512)}));}catch{/* In-memory deduplication still protects this session. */}}
  function element(tag,cls,parent,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;parent?.append(n);return n;}
  function assets(){
    if(!artPromise)artPromise=Promise.all(materials.map(id=>new Promise(resolve=>{const img=new Image(),timeout=setTimeout(()=>resolve(null),5000);img.onload=()=>{clearTimeout(timeout);const tile=document.createElement('canvas');tile.width=tile.height=96;tile.getContext('2d').drawImage(img,0,0,96,96);resolve(tile);};img.onerror=()=>{clearTimeout(timeout);resolve(null);};img.src='/celebration-art/'+id+'-v1.png';})));
    return artPromise;
  }
  function blocked(){return disposed||document.hidden||document.tracerHidden||window.TracerAccount?.locked||window.TracerAccount?.switching||T.store.lost||T.store.inflight||T.store.dragging||document.querySelector('dialog[open]')||!document.getElementById('modal-root').hidden||document.activeElement?.matches('input,textarea,select,[contenteditable=true]');}
  function schedule(){clearTimeout(timer);if(pending.length&&!disposed)timer=setTimeout(pump,450);}
  function finish(){stopEffect=null;busy=false;schedule();}
  function pump(){
    if(busy||disposed)return;if(blocked()){schedule();return;}
    let event;while(pending.length){const next=pending.shift();if(!seen.has(next?.key)&&M.valid(next,T.store.base)){event=next;break;}}persist();if(!event)return;
    busy=true;seen.add(event.key);persist();celebrate(event);
  }
  async function celebrate(event){
    const savingNotice=document.getElementById('task-notice');if(savingNotice?.dataset.projectArchive===event.id)savingNotice.hidden=true;
    const host=element('div','project-celebration',document.body);host.dataset.eventKey=event.key;
    const message=element('div','celebration-message',host);message.setAttribute('role','status');
    element('span','celebration-mark',message,'✦');const copy=element('div','',message);element('strong','',copy,tr('项目完成，值得庆祝！','A project finished. A moment to celebrate!'));element('span','celebration-project-name',copy,event.title);
    const dismiss=element('button','celebration-dismiss',message,'×');dismiss.type='button';dismiss.setAttribute('aria-label',tr('收起庆祝','Dismiss celebration'));
    let raf=0,deadline=0,dead=false,canvas=null;const cleanup=()=>{if(dead)return;dead=true;cancelAnimationFrame(raf);clearTimeout(deadline);window.removeEventListener('resize',cleanup);host.remove();finish();};dismiss.onclick=cleanup;stopEffect=cleanup;
    deadline=setTimeout(cleanup,media.matches?4200:6500);if(media.matches)return;
    const art=await assets();if(dead||disposed)return;if(document.hidden||document.tracerHidden||media.matches){cleanup();return;}
    const width=innerWidth,height=innerHeight,ratio=Math.min(devicePixelRatio||1,1.5),particles=M.burst(width,height);
    canvas=element('canvas','celebration-confetti',host);canvas.setAttribute('aria-hidden','true');canvas.dataset.emitters='bottom left right';canvas.dataset.materials=String(art.filter(Boolean).length);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);const c=canvas.getContext('2d'),started=performance.now();
    window.addEventListener('resize',cleanup,{once:true});clearTimeout(deadline);deadline=setTimeout(cleanup,5700);
    function frame(now){
      if(dead)return;const elapsed=(now-started)/1000;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,width,height);
      for(const p of particles){const t=elapsed-p.delay;if(t<0||!art[p.material])continue;const drag=(1-Math.exp(-t*.5))/.5,x=p.x+p.vx*drag+Math.sin(t*2+p.phase)*t*8,y=p.y+p.vy*t+.5*height*.43*t*t;if(y>height+40&&t>.8)continue;
        c.save();c.translate(x,y);c.rotate(p.rotation+p.spin*t*.55);c.scale(.18+.82*Math.abs(Math.cos(t*4+p.phase)),1);c.globalAlpha=Math.min(1,Math.max(0,(5.4-elapsed)/.9));c.drawImage(art[p.material],-p.size/2,-p.size/2,p.size,p.size);c.restore();
      }raf=requestAnimationFrame(frame);
    }raf=requestAnimationFrame(frame);
  }
  function accepted(before,after){
    const keys=new Set(pending.map(e=>e.key));for(const event of M.changes(before,after))if(event.type==='project'&&!seen.has(event.key)&&!keys.has(event.key)){pending.push(event);keys.add(event.key);}persist();schedule();
  }
  function visibility(){if(document.hidden||document.tracerHidden)stopEffect?.();else schedule();}
  function reduced(){if(media.matches)stopEffect?.();}
  document.addEventListener('visibilitychange',visibility);document.addEventListener('tracer-visibilitychange',visibility);media.addEventListener('change',reduced);
  window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);stopEffect?.();});
  T.celebrations={accepted};T.ready.then(schedule);
})();
