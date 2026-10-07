(function(){'use strict';const bridge=window.TracerLocalVfxPlacement,instruction=document.getElementById('instruction');if(!bridge)return;
 let session=null,armed=false,consumed=false,dead=false;const clean=[];
 function dispose(){if(dead)return;dead=true;armed=false;session=null;for(const fn of clean.splice(0))fn();}
 function cancel(){if(dead||consumed||!session)return;consumed=true;armed=false;instruction.textContent='已取消选点';bridge.cancel({session});}
 function pointer(event){if(!event.isTrusted||event.button!==0||dead)return;event.preventDefault();event.stopImmediatePropagation();
  if(event.target.closest?.('[data-cancel]')){cancel();return;}
  if(!armed||consumed||!session)return;const w=innerWidth,h=innerHeight;if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
  const u=event.clientX/w,v=event.clientY/h;if(![u,v].every(n=>Number.isFinite(n)&&n>=0&&n<1))return;
  consumed=true;armed=false;instruction.textContent='已选定位置，原地升起…';bridge.pick({session,u,v});
 }
 function key(event){if(event.isTrusted&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}}
 function context(event){event.preventDefault();}
 clean.push(bridge.onInit(value=>{if(dead||session)return;session=value.session;instruction.textContent='准备选点，请稍候…';}),bridge.onArmed(value=>{if(dead||consumed||value.session!==session)return;armed=true;instruction.textContent='左键点击哪里，就从哪里升起 · Esc 取消';}));
 document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',key,true);document.addEventListener('contextmenu',context,true);
 const button=document.querySelector('[data-cancel]');function buttonClick(event){if(event.isTrusted){event.preventDefault();cancel();}}button.addEventListener('click',buttonClick);
 clean.push(()=>document.removeEventListener('pointerdown',pointer,true),()=>document.removeEventListener('keydown',key,true),()=>document.removeEventListener('contextmenu',context,true),()=>button.removeEventListener('click',buttonClick));
 addEventListener('pagehide',dispose,{once:true});bridge.ready();
})();
