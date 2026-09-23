(function(){
  'use strict';
  const root=document.documentElement,taskKeys=['bg','fg','muted','accent','line','danger','warning','radius','shadow'];
  const tr=(zh,en)=>window.TracerLocale?.language()==='en'?en:zh;
  function avatarStyle(node,item){
    node.style.setProperty('--avatar-frame-image',`url("${item.asset}")`);
    const {cx=.5,cy=.5,r=.35}=item.aperture||{};
    node.style.setProperty('--avatar-art-size',(100/(2*r))+'%');node.style.setProperty('--avatar-art-x',(50-cx*100/(2*r))+'%');node.style.setProperty('--avatar-art-y',(50-cy*100/(2*r))+'%');
  }
  function taskStyle(node,item){for(const key of taskKeys)node.style.setProperty('--task-'+key,item.palette[key]);node.style.setProperty('--task-art',`url("${item.asset}")`);node.dataset.taskFrame=item.frame;}
  function apply(collection){
    const catalog=collection?.catalog||[],appearance=collection?.appearance||{},avatar=catalog.find(i=>i.id===appearance.avatarFrameItemId&&i.type==='avatarFrame'),task=catalog.find(i=>i.id===appearance.taskFrameItemId&&i.type==='taskFrame');
    if(avatar){root.dataset.avatarFrame=avatar.frame;avatarStyle(root,avatar);}else{delete root.dataset.avatarFrame;['--avatar-frame-image','--avatar-art-size','--avatar-art-x','--avatar-art-y'].forEach(key=>root.style.removeProperty(key));}
    if(task)taskStyle(root,task);else{delete root.dataset.taskFrame;taskKeys.forEach(key=>root.style.removeProperty('--task-'+key));root.style.removeProperty('--task-art');}
  }
  function preview(host,item){
    const doc=host.ownerDocument,el=(tag,cls,parent,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;parent.append(n);return n;};
    host.replaceChildren();const stage=el('div','frame-preview '+(item.type==='avatarFrame'?'frame-avatar-stage':'frame-task-stage'),host);stage.dataset.frameId=item.id;
    if(item.type==='avatarFrame'){
      stage.style.setProperty('--frame-tone',item.colors[0]);el('span','frame-series',stage,'PORTRAIT ATELIER / '+item.id.slice(2));
      const avatar=el('div','frame-avatar',stage);avatarStyle(avatar,item);
      const trigger=doc.getElementById('account-open');if(trigger){for(const child of trigger.childNodes)avatar.append(child.cloneNode(true));avatar.style.background=trigger.style.background;avatar.style.color=trigger.style.color;}else avatar.textContent='☾';
      avatar.setAttribute('aria-hidden','true');el('span','frame-caption',stage,tr('为你的头像，留一圈光。','A little light around you.'));
    }else{
      taskStyle(stage,item);el('span','frame-series',stage,'THE EVERYDAY EDIT / '+item.id.slice(2));
      const card=el('article','frame-task-sample',stage),meta=el('div','frame-sample-meta',card);el('span','',meta,'◇  TRC–025');el('span','',meta,'···');
      el('h4','frame-sample-title',card,tr('给热爱的事，留一点时间','Make time for what you love'));
      el('p','frame-sample-text',card,tr('一步一步，靠近心里的小愿望。','A small step towards something lovely.'));
      const foot=el('div','frame-sample-footer',card);el('span','',foot,tr('●  进行中','●  In progress'));el('span','',foot,tr('今天','Today'));
    }
    return()=>{};
  }
  function navArt(host,type){
    host.classList.add(type==='avatarFrame'?'frame-nav-avatar':'frame-nav-task');
    if(type==='avatarFrame'){const n=document.createElement('span');n.textContent='☾';host.append(n);}else for(let i=0;i<3;i++){const n=document.createElement('i');host.append(n);}
  }
  window.TracerFrames={apply,preview,navArt,slot:item=>['avatarFrame','taskFrame','material'].includes(item.type)?item.type:'background'};
})();
