(function(root){
  'use strict';
  root.TracerGardenCollectionShop=function(host,onAction){
    const doc=host.ownerDocument,el=(tag,cls,parent)=>{const n=doc.createElement(tag);n.className=cls;parent?.appendChild(n);return n;};
    const box=el('section','garden-collection-shop',host),header=el('div','garden-collect-heading',box),copy=el('div','',header),eyebrow=el('p','garden-collect-eyebrow',copy),title=el('h3','',copy),help=el('p','garden-collect-help',copy),count=el('span','garden-collect-count',header);
    const goal=el('section','garden-collect-goal',box),goalArt=el('div','garden-collect-goal-art',goal),goalCopy=el('div','garden-collect-goal-copy',goal),goalTitle=el('h4','',goalCopy),goalText=el('p','',goalCopy),goalBar=el('progress','',goalCopy),goalHint=el('p','garden-collect-goal-hint',goalCopy);
    const tabs=el('div','garden-collect-tabs',box);tabs.setAttribute('role','group');
    const setInfo=el('p','garden-collect-set-info',box),grid=el('div','garden-collect-grid',box),status=el('p','garden-collect-status',box);status.setAttribute('role','status');
    const cards=new Map(),groups=new Map();let state={},language='zh',active='woodland',pending=false,dead=false,localError='';
    const tr=(zh,en)=>language==='en'?en:zh,local=a=>a?.[language==='en'?1:0]||'',set=(n,t)=>{if(n.textContent!==String(t))n.textContent=String(t);};
    const button=(parent,action)=>{const n=el('button','garden-market-button',parent);n.type='button';n.dataset.collectAction=action;return n;};
    const goalOpen=button(goal,'target');
    const detail=el('dialog','garden-collect-detail',box),detailClose=button(detail,'close-detail'),detailArt=el('div','garden-collect-detail-art',detail),detailTitle=el('h3','',detail),detailText=el('p','',detail),detailNeed=el('p','garden-collect-detail-need',detail),detailBuy=button(detail,'buy');
    detailTitle.id='garden-collect-detail-title';detail.setAttribute('aria-labelledby',detailTitle.id);detailClose.autofocus=true;
    const angles=el('div','garden-collect-angles',detail),prevAngle=button(angles,'angle-prev'),angleLabel=el('span','',angles),nextAngle=button(angles,'angle-next');detail.insertBefore(angles,detailTitle);
    let detailId=null,detailAngle=0;
    function renderDetail(){
      const item=state.collectibles?.items.find(i=>i.id===detailId);if(!item)return;
      const frame=item.id+':'+detailAngle;if(detailArt.dataset.itemId!==frame){detailArt.dataset.itemId=frame;detailArt.innerHTML=root.TracerGardenCollectionArt.markup(item.id,detailAngle);}
      set(prevAngle,tr('↶ 转一面','↶ Turn'));set(nextAngle,tr('转一面 ↷','Turn ↷'));set(angleLabel,(detailAngle+1)+' / 6');
      set(detailClose,tr('关闭','Close'));set(detailTitle,local(item.name));set(detailText,local(item.description));
      set(detailNeed,item.owned?tr('永久收藏 · 六面转向、自由摆放、缩放与镜像','Yours forever · Six views, free placement, resizing & mirroring'):item.price+tr(' 金币 · 收获 ',' coins · Harvests ')+Math.min(state.collectibles.progress.harvests,item.harvests)+'/'+item.harvests+tr(' · 种类 ',' · Species ')+Math.min(state.collectibles.progress.species,item.species)+'/'+item.species);
      detailBuy.dataset.itemId=item.id;detailBuy.dataset.collectAction=item.owned?'equip':'buy';set(detailBuy,item.owned?tr(item.equipped?'收回摆设':'摆进花园',item.equipped?'Put away':'Display in garden'):tr('收藏 · ','Collect · ')+item.price+tr(' 金币',' coins'));detailBuy.disabled=pending||state.busy||!!state.error||!item.owned&&(!item.unlocked||!item.affordable);
    }
    detail.addEventListener('click',event=>{if(event.target===detail)detail.close();});
    function render(){
      if(dead)return;const c=state.collectibles;box.hidden=!c;if(!c)return;
      const money=state.economy?.balance||0,locked=pending||state.busy||!!state.error||!!localError;
      set(eyebrow,tr('把努力，收藏成自己的风景','YOUR EFFORT, YOUR LITTLE WORLD'));set(title,tr('花园珍藏馆','Garden curiosities'));set(help,c.total+tr(' 件永久藏品 · 点击图片细看 · 集齐套装解锁收藏铭牌',' permanent treasures · Click artwork for details · Complete sets for collector plaques'));set(count,c.owned+' / '+c.total);
      const target=c.target;goal.hidden=!target;
      set(goalOpen,tr('查看目标','View wish'));
      if(target){goalArt.innerHTML=root.TracerGardenCollectionArt.markup(target.id);set(goalTitle,tr(target.wished?'心愿目标 · ':'下一件收藏 · ',target.wished?'Your wish · ':'Next treasure · ')+local(target.name));set(goalText,tr('金币 ','Coins ')+Math.min(money,target.price)+' / '+target.price+' · '+tr('累计收获 ','Harvests ')+Math.min(c.progress.harvests,target.harvests)+' / '+target.harvests+' · '+tr('植物种类 ','Species ')+Math.min(c.progress.species,target.species)+' / '+target.species);goalBar.max=target.price;goalBar.value=Math.min(money,target.price);goalBar.setAttribute('aria-label',tr('收藏金币进度','Coins saved for this treasure'));
        const value=(state.inventory||[]).reduce((sum,row)=>sum+row.available*row.unitPrice,0);
        set(goalHint,target.unlocked&&money>=target.price?tr('已经可以收藏，在下方找到它。','Ready to collect. Find it below.'):tr('完成任务 → 收获植物 → 出售攒金币。仓库现有收获可换 ','Finish tasks → harvest plants → sell for coins. Stored harvests are worth ')+value+tr(' 金币；出售仍保留图鉴进度。',' coins; selling keeps your collection progress.'));
      }
      for(const group of c.sets){let tab=groups.get(group.id);if(!tab){tab=button(tabs,'tab');tab.dataset.setId=group.id;groups.set(group.id,tab);}set(tab,local(group.name)+' '+group.owned+'/'+group.total);tab.setAttribute('aria-pressed',String(active===group.id));}
      const group=c.sets.find(s=>s.id===active);set(setInfo,group.owned===group.total?tr('已解锁铭牌：','Plaque unlocked: ')+local(group.title):tr('集齐本套 3 件，永久解锁「','Collect all 3 to unlock “')+local(group.title)+tr('」花园铭牌。','” in your garden.'));
      for(const item of c.items){let card=cards.get(item.id);if(!card){const node=el('article','garden-collect-card',grid),tier=el('span','garden-collect-tier',node),art=el('button','garden-collect-art',node),name=el('h4','',node),description=el('p','garden-collect-description',node),requirement=el('p','garden-collect-requirement',node),actions=el('div','garden-collect-actions',node),buy=button(actions,'buy'),wish=button(actions,'wish');art.type='button';art.dataset.collectAction='inspect';art.dataset.itemId=item.id;node.dataset.itemId=item.id;buy.dataset.itemId=wish.dataset.itemId=item.id;card={node,tier,art,name,description,requirement,buy,wish};cards.set(item.id,card);}
        card.node.hidden=item.setId!==active;if(!card.node.hidden&&!card.art.firstChild)card.art.innerHTML=root.TracerGardenCollectionArt.markup(item.id);card.node.dataset.owned=String(item.owned);card.node.dataset.equipped=String(item.equipped);card.node.dataset.set=item.setId;
        card.art.setAttribute('aria-label',tr('放大查看：','View details: ')+local(item.name));set(card.tier,item.owned?tr(item.equipped?'花园中':'已收藏',item.equipped?'ON DISPLAY':'COLLECTED'):tr(item.setId==='woodland'?'精巧藏品':item.setId==='moonlight'?'稀有藏品':item.setId==='starlight'?'珍稀藏品':'匠作家具',item.setId==='woodland'?'CRAFTED':item.setId==='moonlight'?'RARE':item.setId==='starlight'?'PRESTIGE':'FURNITURE'));
        set(card.name,local(item.name));set(card.description,local(item.description));set(card.requirement,item.owned?tr('永久拥有 · 可随时更换摆设','Yours forever · Switch displays freely'):item.unlocked?tr('收藏条件已达成','Collection requirements met'):tr('收获 ','Harvests ')+Math.min(c.progress.harvests,item.harvests)+'/'+item.harvests+' · '+tr('种类 ','Species ')+Math.min(c.progress.species,item.species)+'/'+item.species);
        card.buy.dataset.collectAction=item.owned?'equip':'buy';set(card.buy,item.owned?tr(item.equipped?'收回摆设':'摆进花园',item.equipped?'Put away':'Display in garden'):tr('收藏 · ','Collect · ')+item.price+tr(' 金币',' coins'));card.buy.disabled=locked||!item.owned&&(!item.unlocked||money<item.price);
        card.wish.hidden=item.owned;card.wish.disabled=locked;card.wish.setAttribute('aria-pressed',String(item.wished));set(card.wish,item.wished?tr('已设为目标','Your wish'):tr('设为目标','Set as wish'));
      }
      renderDetail();
      set(status,state.error||localError||(pending?tr('正在保存收藏…','Saving your collection…'):c.owned===c.total?tr('全套已收藏。你的花园，记得每一份努力。','Collection complete. Your garden remembers every effort.') :''));
    }
    async function click(event){const node=event.target.closest('[data-collect-action]');if(!node||node.disabled||dead)return;const action=node.dataset.collectAction;
      if(action==='close-detail'){detail.close();return;}
      if(action==='inspect'){detailId=node.dataset.itemId;detailAngle=0;renderDetail();detail.showModal();return;}
      if(action==='angle-prev'||action==='angle-next'){detailAngle=(detailAngle+(action==='angle-prev'?5:1))%6;renderDetail();return;}
      if(action==='tab'){active=node.dataset.setId;render();return;}
      if(action==='target'){active=state.collectibles.target.setId;render();grid.scrollIntoView({block:'nearest'});return;}
      if(pending||state.busy||state.error)return;const item=state.collectibles?.items.find(i=>i.id===node.dataset.itemId);if(!item)return;
      pending=true;localError='';render();
      try{await onAction(action==='buy'?'buy-collectible':action==='equip'?'layout-collectible':'wish-collectible',{itemId:action==='wish'&&item.wished?null:item.id,...(action==='equip'?{visible:!item.equipped}:{})});}
      catch{localError=tr('暂时无法保存，请稍后重试。','Could not save. Please try again.');}
      finally{pending=false;render();}
    }
    box.addEventListener('click',click);
    return{update(next){state=next;language=state.language==='en'?'en':'zh';if(!state.busy&&!state.error)localError='';render();},destroy(){dead=true;if(detail.open)detail.close();box.removeEventListener('click',click);box.remove();}};
  };
})(typeof window!=='undefined'?window:globalThis);
