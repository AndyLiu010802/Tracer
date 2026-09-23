(function () {
  'use strict';
  const root=document.getElementById('pet-root');
  if(!window.PetDesktop) { root.textContent='Open the desktop companion from Tracer → Companions.'; return; }
  const accountScope=window.TracerAccount?.scope||'guest';
  const view=TracerPetView(root,(type,value)=>{if(window.TracerAccount?.locked)return;return type==='create-work'?PetDesktop.createWork({...value,accountScope}):PetDesktop.send({type,value,accountScope});},true);
  PetDesktop.onState(snapshot=>{if((snapshot.accountScope||'guest')!==accountScope)return;document.documentElement.lang=snapshot.language==='zh'?'zh-CN':'en';view.update(snapshot);});
  PetDesktop.send({type:'ready',accountScope});
})();
