(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else{root.GardenMarketView=api;root.TracerGardenMarketView=api;}})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const names={wildflower:['野花','Wildflower'],sunflower:['向日葵','Sunflower'],lavender:['薰衣草','Lavender'],apple:['苹果树','Apple tree'],peach:['桃树','Peach tree'],cherry:['樱桃树','Cherry tree'],neon_orchid:['霓虹兰','Neon orchid'],volt_berry:['电光莓','Volt berry'],crystal_tree:['晶芯树','Crystal tree']};
  const farms={meadow:{name:['春日田园','Spring meadow'],subtitle:['把日常的努力，种进温柔的春天。','Let everyday effort grow into a little spring.'],image:'/garden-art/spring-garden-v1.png',kinds:['wildflower','sunflower','lavender','apple','peach','cherry']},cyber:{name:['霓虹温室','Neon greenhouse'],subtitle:['暮色中的空中温室，培育会发光的新生命。','A rooftop greenhouse where new life glows after dusk.'],image:'/garden-art/cyber-garden-v1.png',kinds:['neon_orchid','volt_berry','crystal_tree']}};
  const number=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
  const svg=body=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
  const icons={coin:svg('<circle cx="12" cy="12" r="8"/><path d="M15 8.5h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>'),leaf:svg('<path d="M20 4C8 2 3 7 5 14s12 7 15-10Z"/><path d="m4 21 11-12"/>'),box:svg('<path d="m4 7 8-4 8 4v11l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v11M8 5l8 4v5"/>'),check:svg('<path d="m5 12 4 4L19 6"/>'),spark:svg('<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>')};

  function create(host,options={}){
    if(!host?.ownerDocument)throw new TypeError('Garden market requires a host element');
    if(typeof options==='function')options={onAction:options};
    const doc=host.ownerDocument,realm=doc.defaultView||root,onAction=options.onAction;
    let language='zh',snapshot={},destroyed=false,localPending=false,localError='',confirmation=null,restoreFocus=null,requestSerial=0;
    const stock=new Map(),farmCards=new Map();
    const el=(tag,cls,parent,text)=>{const node=doc.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;if(parent)parent.appendChild(node);return node;};
    const set=(node,value)=>{const text=String(value??'');if(node.textContent!==text)node.textContent=text;};
    const tr=(zh,en)=>language==='en'?en:zh;
    const n=value=>number(value).toLocaleString(language==='en'?'en-US':'zh-CN');
    const label=kind=>names[kind]?.[language==='en'?1:0]||kind;
    const icon=(parent,name)=>{const mark=el('span','garden-market-icon',parent);mark.innerHTML=icons[name];return mark;};
    const button=(parent,cls,action,text)=>{const node=el('button','garden-market-button '+cls,parent,text);node.type='button';node.dataset.marketAction=action;return node;};
    const market=el('section','garden-market',host);market.setAttribute('aria-label','Harvest warehouse and farm shop');
    const heading=el('header','garden-market-heading',market),titles=el('div','garden-market-titles',heading),eyebrow=el('p','garden-market-eyebrow',titles),title=el('h2','garden-market-title',titles),intro=el('p','garden-market-intro',titles);
    const wallet=el('div','garden-market-wallet',heading);icon(wallet,'coin');const walletCopy=el('div','garden-market-wallet-copy',wallet),walletLabel=el('span','garden-market-wallet-label',walletCopy),balance=el('strong','garden-market-balance',walletCopy);balance.setAttribute('aria-live','polite');balance.setAttribute('aria-atomic','true');
    const message=el('div','garden-market-message',market);message.hidden=true;message.setAttribute('role','status');const messageText=el('span','garden-market-message-text',message),retry=button(message,'garden-market-secondary','retry-save');
    const decision=el('section','garden-market-decision',market);decision.hidden=true;decision.setAttribute('role','dialog');decision.setAttribute('aria-modal','false');const decisionCopy=el('div','garden-market-decision-copy',decision),decisionTitle=el('h3','garden-market-decision-title',decisionCopy),decisionBody=el('p','garden-market-decision-body',decisionCopy),decisionNote=el('p','garden-market-decision-note',decisionCopy),decisionActions=el('div','garden-market-decision-actions',decision),cancel=button(decisionActions,'garden-market-secondary','cancel'),confirm=button(decisionActions,'garden-market-primary','confirm');
    const collectionShop=options.collections===false?null:realm.TracerGardenCollectionShop?.(market,onAction);
    const summary=el('div','garden-market-summary',market),summaryStored=el('span','garden-market-summary-item',summary),summaryKinds=el('span','garden-market-summary-item',summary),summarySold=el('span','garden-market-summary-item',summary);
    const shelf=el('div','garden-market-shelf',market),empty=el('div','garden-market-empty',market);icon(empty,'box');const emptyTitle=el('h3','garden-market-empty-title',empty),emptyCopy=el('p','garden-market-empty-copy',empty);
    const shop=el('section','garden-market-shop',market),shopHeading=el('div','garden-market-shop-heading',shop),shopTitles=el('div','garden-market-shop-titles',shopHeading),shopTitle=el('h3','garden-market-shop-title',shopTitles),shopHelp=el('p','garden-market-shop-help',shopTitles),shopBadge=el('span','garden-market-shop-badge',shopHeading),shopGrid=el('div','garden-market-farms',shop);
    const footnote=el('p','garden-market-footnote',market);icon(footnote,'leaf');const footnoteText=el('span','',footnote);

    function artwork(kind,parent){
      const node=el('div','garden-market-plant-art',parent);node.setAttribute('aria-hidden','true');
      try{const art=(options.plantArt||realm.TracerGardenPlantArt?.markup)?.(kind,4,false,false);if(typeof art==='string')node.innerHTML=art;else if(art?.nodeType)node.appendChild(art);}catch{}
      if(!node.firstChild)icon(node,'leaf');return node;
    }
    function createStock(kind){
      const card=el('article','garden-market-stock',shelf);card.dataset.plantKind=kind;card.dataset.biome=kind.startsWith('neon_')||kind==='volt_berry'||kind==='crystal_tree'?'cyber':'meadow';
      const top=el('div','garden-market-stock-top',card),serial=el('span','garden-market-stock-serial',top),held=el('span','garden-market-stock-held',top);artwork(kind,card);
      const identity=el('div','garden-market-stock-identity',card),name=el('h3','garden-market-stock-name',identity),price=el('span','garden-market-stock-price',identity);icon(price,'coin');const priceText=el('span','',price),history=el('p','garden-market-stock-history',card);
      const trade=el('div','garden-market-trade',card),stepper=el('div','garden-market-stepper',trade),minus=button(stepper,'garden-market-step','less','−'),quantity=el('input','garden-market-quantity',stepper),plus=button(stepper,'garden-market-step','more','+');
      quantity.type='number';quantity.min='1';quantity.step='1';quantity.inputMode='numeric';quantity.value='1';quantity.dataset.marketQuantity=kind;minus.dataset.plantKind=plus.dataset.plantKind=kind;
      const all=button(trade,'garden-market-all','all');all.dataset.plantKind=kind;const sell=button(card,'garden-market-sell','sell');sell.dataset.plantKind=kind;
      return{card,serial,held,name,priceText,history,minus,quantity,plus,all,sell,row:{plantKind:kind,available:0},value:1};
    }
    function createFarm(id){
      const definition=farms[id],card=el('article','garden-market-farm',shopGrid);card.dataset.farmId=id;
      const preview=el('div','garden-market-farm-preview',card),image=el('img','garden-market-farm-image',preview);image.src=definition.image;image.alt='';image.loading='lazy';image.decoding='async';image.draggable=false;image.addEventListener('error',()=>{preview.dataset.art='missing';});image.addEventListener('load',()=>{preview.dataset.art='ready';});
      const edition=el('span','garden-market-farm-edition',preview),state=el('span','garden-market-farm-state',preview),body=el('div','garden-market-farm-body',card),name=el('h4','garden-market-farm-name',body),description=el('p','garden-market-farm-description',body),plants=el('div','garden-market-farm-plants',body);
      const plantLabels=[];for(const kind of definition.kinds){const item=el('span','garden-market-farm-plant',plants);artwork(kind,item);plantLabels.push({kind,node:el('span','garden-market-farm-plant-name',item)});}
      const footer=el('div','garden-market-farm-footer',body),price=el('span','garden-market-farm-price',footer);icon(price,'coin');const priceText=el('strong','',price),action=button(footer,'garden-market-farm-action','farm');action.dataset.farmId=id;const note=el('p','garden-market-farm-note',body);
      return{card,edition,state,name,description,plantLabels,priceText,action,note,row:{id,owned:id==='meadow',equipped:id==='meadow',price:id==='cyber'?240:0}};
    }
    for(const id of ['meadow','cyber'])farmCards.set(id,createFarm(id));
    function locked(){return !!(snapshot.busy||localPending||snapshot.error||localError);}
    function currentQuantity(entry){const raw=Number(entry.quantity.value);return Number.isSafeInteger(raw)&&raw>=1&&raw<=number(entry.row.available)?raw:0;}
    function updateTrade(entry){
      const available=number(entry.row.available),qty=currentQuantity(entry),disabled=locked()||available===0;
      entry.quantity.max=String(available);entry.quantity.disabled=disabled;entry.minus.disabled=disabled||qty<=1;entry.plus.disabled=disabled||qty>=available;entry.all.disabled=disabled||qty===available;entry.sell.disabled=disabled||qty===0;
      set(entry.sell,available?tr('出售 · ','Sell · ')+n(qty*number(entry.row.unitPrice)):tr('已售完','Sold out'));
      entry.sell.setAttribute('aria-label',available?tr('出售 ','Sell ')+qty+' '+label(entry.row.plantKind)+tr('，获得 ',' for ')+n(qty*number(entry.row.unitPrice))+tr(' 金币',' coins'):label(entry.row.plantKind)+tr('暂无库存',' is out of stock'));
    }
    function updateStock(entry,row,index){
      entry.row=row;const available=number(row.available);entry.card.dataset.empty=String(available===0);set(entry.serial,String(index+1).padStart(2,'0'));set(entry.held,tr('库存 ','In stock ')+n(available));set(entry.name,label(row.plantKind));set(entry.priceText,n(row.unitPrice)+tr(' / 株',' / plant'));set(entry.history,tr('累计收获 ','Harvested ')+n(row.harvested)+tr(' · 已售 ',' · Sold ')+n(row.sold));
      entry.quantity.setAttribute('aria-label',label(row.plantKind)+tr('出售数量',' quantity to sell'));entry.minus.setAttribute('aria-label',tr('减少一株','One fewer'));entry.plus.setAttribute('aria-label',tr('增加一株','One more'));set(entry.all,tr('全部','All'));
      if(doc.activeElement!==entry.quantity){entry.value=Math.max(1,Math.min(number(entry.quantity.value)||entry.value,available||1));entry.quantity.value=available?String(entry.value):'0';}updateTrade(entry);
    }
    function updateFarm(entry,row){
      entry.row=row;const id=row.id,definition=farms[id],owned=!!row.owned,equipped=!!row.equipped,coins=number(snapshot.economy?.balance),price=number(row.price),affordable=coins>=price;
      entry.card.dataset.owned=String(owned);entry.card.dataset.equipped=String(equipped);set(entry.edition,id==='cyber'?tr('暮色新境','AFTER DARK'):tr('田园原点','THE FIRST GARDEN'));set(entry.state,equipped?tr('正在使用','Equipped'):owned?tr('已拥有','Owned'):tr('新风景','New scenery'));
      set(entry.name,definition.name[language==='en'?1:0]);set(entry.description,definition.subtitle[language==='en'?1:0]);for(const item of entry.plantLabels)set(item.node,label(item.kind));
      set(entry.priceText,owned?tr('已收藏','In your collection'):n(price));entry.action.disabled=locked()||equipped||(!owned&&!affordable);set(entry.action,equipped?tr('当前农场','Current farm'):owned?tr('切换农场','Use this farm'):tr('解锁农场','Unlock farm'));
      set(entry.note,!owned&&!affordable?tr('还差 ','Need ')+n(price-coins)+tr(' 金币 · 出售收获即可积攒',' more coins · Sell harvests to save up'):!owned?tr('一次解锁，永久拥有 · 含 3 种专属植物','Own it forever · Includes 3 exclusive plants'):tr('切换后开始的任务，会种下这个农场的随机种子','New tasks started here draw seeds from this farm'));
    }
    function closeConfirmation(focus=true){confirmation=null;decision.hidden=true;if(focus&&restoreFocus?.isConnected)restoreFocus.focus();restoreFocus=null;}
    function renderConfirmation(){
      if(!confirmation){decision.hidden=true;return;}decision.hidden=false;
      const c=confirmation;let valid=true;
      if(c.type==='sell'){
        const row=stock.get(c.plantKind)?.row,price=number(row?.unitPrice);valid=!!row&&number(row.available)>=c.quantity&&price===c.unitPrice;
        set(decisionTitle,tr('出售这份收获？','Sell this harvest?'));set(decisionBody,n(c.quantity)+' '+tr('株 ','')+label(c.plantKind)+' × '+n(c.unitPrice)+tr(' 金币 = ',' coins = ')+n(c.quantity*c.unitPrice)+tr(' 金币',' coins'));
        set(decisionNote,valid?tr('出售后减少仓库库存；植物图鉴、植物伙伴和项目星球都会保留。','Only warehouse stock is sold. Your botanical collection, companions and memory planets stay with you.'):tr('库存已发生变化，请取消后重新选择数量。','Stock has changed. Cancel and choose a quantity again.'));set(confirm,tr('确认出售，获得 ','Sell for ')+n(c.quantity*c.unitPrice)+tr(' 金币',' coins'));
      }else{
        const row=farmCards.get(c.farmId)?.row;valid=!!row&&!row.owned&&number(row.price)===c.price&&number(snapshot.economy?.balance)>=c.price;
        set(decisionTitle,tr('收藏一片新的风景','Bring home a new landscape'));set(decisionBody,farms[c.farmId].name[language==='en'?1:0]+' · '+n(c.price)+tr(' 金币',' coins'));set(decisionNote,valid?tr('解锁后可随时切换。已有植物继续生长，新开始的任务使用新农场的种子。','Once unlocked, switch whenever you like. Existing plants keep growing; new tasks use the equipped farm’s seeds.'):tr('金币余额或农场状态已变化，请取消后重试。','Your balance or farm ownership has changed. Cancel and try again.'));set(confirm,tr('确认解锁','Confirm unlock'));
      }
      decision.setAttribute('aria-label',decisionTitle.textContent);confirm.disabled=!valid||locked();cancel.disabled=!!(snapshot.busy||localPending);set(cancel,tr('暂时保留','Keep for now'));
    }
    function updateMessage(){
      const error=String(snapshot.error||localError||'');message.hidden=!(error||snapshot.busy||localPending);message.dataset.error=String(!!error);message.setAttribute('role',error?'alert':'status');set(messageText,error||tr('正在保存，请稍候…','Saving, just a moment…'));retry.hidden=!error;retry.disabled=!!(snapshot.busy||localPending);set(retry,tr('重试保存','Retry save'));
    }
    function render(){
      if(destroyed)return;market.lang=language==='en'?'en':'zh-CN';market.setAttribute('aria-label',tr('收获仓库与农场商店','Harvest warehouse and farm shop'));market.setAttribute('aria-busy',String(!!(snapshot.busy||localPending)));
      set(eyebrow,tr('让每一份努力，有新的去处','A LITTLE HARVEST, A NEW HORIZON'));set(title,tr('收获仓库','Harvest warehouse'));set(intro,tr('把成熟的植物收好，也把下一片风景慢慢攒起来。','Keep what you have grown, and save toward your next little landscape.'));set(walletLabel,tr('花园金币','Garden coins'));set(balance,n(snapshot.economy?.balance));
      collectionShop?.update({...snapshot,language,busy:!!(snapshot.busy||localPending),error:snapshot.error||localError});
      const rows=(Array.isArray(snapshot.inventory)?snapshot.inventory:[]).filter(row=>row&&names[row.plantKind]&&(number(row.harvested)||number(row.available)||number(row.sold))),seen=new Set();let total=0,sold=0;
      rows.forEach((row,index)=>{if(seen.has(row.plantKind))return;seen.add(row.plantKind);let entry=stock.get(row.plantKind);if(!entry){entry=createStock(row.plantKind);stock.set(row.plantKind,entry);}updateStock(entry,row,index);total+=number(row.available);sold+=number(row.sold);});
      for(const[kind,entry]of stock)if(!seen.has(kind)){entry.card.remove();stock.delete(kind);}
      set(summaryStored,tr('仓库中 ','Stored ')+n(total)+tr(' 株',' plants'));set(summaryKinds,tr('已收获 ','Discovered ')+n(seen.size)+tr(' 种',' species'));set(summarySold,tr('累计出售 ','Sold ')+n(sold)+tr(' 株',' plants'));empty.hidden=seen.size>0;shelf.hidden=seen.size===0;set(emptyTitle,tr('第一份收获，即将住进这里','A home for your first harvest'));set(emptyCopy,tr('完成进行中的任务，在花园收获成熟植物。留下喜欢的，也可以出售，为新农场积攒金币。','Finish a task you have started, then harvest its mature plant. Keep your favorites or sell a few to save for a new farm.'));
      set(shopTitle,tr('下一片风景','Your next landscape'));set(shopHelp,tr('用收获换一座喜欢的农场，让新的种子在这里发芽。','Turn your harvests into a favorite new farm, with new seeds to discover.'));set(shopBadge,tr('农场收藏','FARM COLLECTION'));
      for(const[id,entry]of farmCards){const provided=(snapshot.farms||[]).find(row=>row?.id===id);updateFarm(entry,provided||{id,price:id==='cyber'?240:0,owned:id==='meadow',equipped:id==='meadow'});}
      set(footnoteText,tr('出售植物不会失去图鉴记录、已解锁伙伴或星球纪念。','Selling plants keeps your collection records, unlocked companions and memory planets.'));updateMessage();renderConfirmation();
    }
    async function dispatch(type,payload){
      if(destroyed||localPending||snapshot.busy||typeof onAction!=='function')return;
      const serial=++requestSerial,origin=restoreFocus;localPending=true;localError='';render();
      try{await onAction(type,payload);if(!destroyed&&serial===requestSerial&&!snapshot.error)closeConfirmation(false);}
      catch{if(!destroyed&&serial===requestSerial)localError=tr('更改尚未保存，请重试保存。','Changes have not been saved. Please retry saving.');}
      finally{if(!destroyed&&serial===requestSerial){localPending=false;render();if(!snapshot.error&&!localError&&origin?.isConnected){if(!origin.disabled)origin.focus({preventScroll:true});else{balance.tabIndex=-1;balance.focus({preventScroll:true});}}}}
    }
    function click(event){
      const node=event.target.closest?.('[data-market-action]');if(!node||!market.contains(node)||node.disabled||destroyed)return;const action=node.dataset.marketAction;
      if(action==='retry-save'){localError='';dispatch('retry-save');return;}
      if(action==='cancel'){closeConfirmation();return;}
      if(action==='confirm'){
        if(locked()||!confirmation)return;renderConfirmation();if(confirm.disabled)return;const c=confirmation;
        dispatch(c.type==='sell'?'sell-plants':'buy-farm',c.type==='sell'?{plantKind:c.plantKind,quantity:c.quantity}:{farmId:c.farmId});return;
      }
      if(locked())return;
      const entry=stock.get(node.dataset.plantKind);
      if(entry&&['less','more','all'].includes(action)){const available=number(entry.row.available),qty=currentQuantity(entry)||1;entry.value=action==='all'?available:Math.min(available,Math.max(1,qty+(action==='more'?1:-1)));entry.quantity.value=String(entry.value);updateTrade(entry);return;}
      if(action==='sell'&&entry){const quantity=currentQuantity(entry);if(!quantity)return;confirmation={type:'sell',plantKind:entry.row.plantKind,quantity,unitPrice:number(entry.row.unitPrice)};}
      else if(action==='farm'){
        const row=farmCards.get(node.dataset.farmId)?.row;if(!row||row.equipped)return;if(row.owned){dispatch('equip-farm',{farmId:row.id});return;}
        if(number(snapshot.economy?.balance)<number(row.price))return;confirmation={type:'buy',farmId:row.id,price:number(row.price)};
      }else return;
      restoreFocus=node;renderConfirmation();confirm.focus({preventScroll:true});decision.scrollIntoView?.({block:'nearest',behavior:realm.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'instant':'smooth'});
    }
    function input(event){const entry=stock.get(event.target.dataset.marketQuantity);if(!entry||locked())return;updateTrade(entry);}
    function change(event){const entry=stock.get(event.target.dataset.marketQuantity);if(!entry||locked())return;entry.value=Math.max(1,Math.min(number(entry.quantity.value)||1,number(entry.row.available)||1));entry.quantity.value=String(entry.value);updateTrade(entry);}
    function keydown(event){if(event.key==='Escape'&&confirmation&&!snapshot.busy&&!localPending){event.preventDefault();closeConfirmation();}}
    market.addEventListener('click',click);market.addEventListener('input',input);market.addEventListener('change',change);market.addEventListener('keydown',keydown);
    function update(next={}){if(destroyed)return;snapshot=next;language=next.language==='en'?'en':'zh';if(!snapshot.error&&!snapshot.busy)localError='';render();}
    function destroy(){if(destroyed)return;destroyed=true;requestSerial++;market.removeEventListener('click',click);market.removeEventListener('input',input);market.removeEventListener('change',change);market.removeEventListener('keydown',keydown);stock.clear();farmCards.clear();collectionShop?.destroy();market.remove();}
    update();return{element:market,update,destroy};
  }
  return{create};
});
