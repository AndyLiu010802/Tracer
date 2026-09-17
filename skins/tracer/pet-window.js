(function () {
  'use strict';
  const root=document.getElementById('pet-root');
  if(!window.PetDesktop) { root.textContent='Open the desktop companion from Tracer → Companions.'; return; }
  const view=TracerPetView(root,(type,value)=>PetDesktop.send({type,value}),true);
  PetDesktop.onState(snapshot=>{document.documentElement.lang=snapshot.language==='zh'?'zh-CN':'en';view.update(snapshot);});
  PetDesktop.send({type:'ready'});
})();
