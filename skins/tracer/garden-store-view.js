(function(root){
  'use strict';
  root.TracerGardenStoreView=function(host,onAction){
    const doc=host.ownerDocument,T=root.Tracer,A=root.TracerAccount;
    const el=(tag,cls,parent,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;parent?.appendChild(n);return n;};
    const button=(parent,action)=>{const n=el('button','store-button',parent);n.type='button';n.dataset.storeAction=action;return n;};
    let state={},tab='furniture',wallFilter='static',catalog=[],selected=null,pending=false,dead=false,disposePreview=()=>{},wallSignature='';
    const tr=(zh,en)=>state.language==='en'?en:zh;
    const shop=el('div','garden-store',host),top=el('header','store-top',shop),brand=el('div','store-brand',top),eyebrow=el('span','store-eyebrow',brand),title=el('h1','',brand),wallet=el('div','store-wallet',top),walletLabel=el('span','',wallet),balance=el('strong','',wallet),back=button(top,'garden');
    const hero=el('section','store-hero',shop),heroCopy=el('div','store-hero-copy',hero),heroTag=el('span','store-eyebrow',heroCopy),heroTitle=el('h2','',heroCopy),heroText=el('p','',heroCopy),heroAction=button(heroCopy,'new');
    const awning=el('div','store-awning',hero);awning.setAttribute('aria-hidden','true');
    const welcome=el('span','store-open-sign',hero);
    const heroArt=el('div','store-hero-art',hero),windowLabel=el('span','store-window-label',heroArt);
    const features=new Map();
    for(const id of ['book_cabinet','reading_bench','flower_cart']){const figure=el('button','store-hero-object',heroArt);figure.type='button';figure.dataset.storeFeature=id;figure.innerHTML=root.TracerGardenCollectionArt.markup(id);figure.querySelector('svg')?.setAttribute('preserveAspectRatio','xMidYMax meet');features.set(id,figure);}
    const benefits=el('div','store-benefits',shop),navigation=el('nav','store-navigation',shop),navs=new Map(),navLabels=new Map();
    for(const [id,artId]of [['furniture','reading_bench'],['stickers',null],['wallpapers',null],['materials',null],['avatarFrames',null],['taskFrames',null],['warehouse','flower_cart']]){
      const b=button(navigation,id),art=el('span','store-department-art',b);art.setAttribute('aria-hidden','true');
      if(artId)art.innerHTML=root.TracerGardenCollectionArt.markup(artId);
      else if(id==='wallpapers'||id==='stickers'){const picture=el('img','',art);picture.src=id==='stickers'?'/sticker-art/st_bunny-v1.png':'/wallpapers/static-01.png';picture.alt='';if(id==='stickers')picture.className='store-nav-sticker';}
      else if(id==='avatarFrames'||id==='taskFrames')root.TracerFrames.navArt(art,id==='avatarFrames'?'avatarFrame':'taskFrame');
      else for(let i=0;i<3;i++)el('i','store-swatch',art);
      const copy=el('span','store-department-copy',b),name=el('strong','',copy),note=el('span','',copy),arrow=el('span','store-department-arrow',b,'↗');arrow.setAttribute('aria-hidden','true');navs.set(id,b);navLabels.set(id,{name,note});
    }
    const message=el('div','store-message',shop),messageText=el('span','',message),retry=button(message,'retry');message.setAttribute('role','status');message.hidden=true;
    const furniture=el('section','store-furniture',shop),collection=root.TracerGardenCollectionShop(furniture,onAction);
    const collectionBox=furniture.querySelector('.garden-collection-shop');collectionBox.insertBefore(collectionBox.querySelector('.garden-collect-goal'),collectionBox.querySelector('.garden-collect-status'));
    const stickerSection=el('section','store-stickers',shop),stickerShop=root.TracerStickerShop(stickerSection,onAction);
    const wallSection=el('section','store-wallpapers',shop),wallHeading=el('div','store-department-heading',wallSection),wallTitle=el('h2','',wallHeading),wallHint=el('p','',wallHeading),filters=el('div','store-wall-filters',wallSection);
    const filterButtons=new Map();for(const id of ['static','dynamic','owned'])filterButtons.set(id,button(filters,'filter-'+id));
    const defaults=el('div','store-defaults',wallSection),defaultBg=button(defaults,'default-background'),defaultMaterial=button(defaults,'default-material'),defaultAvatar=button(defaults,'default-avatarFrame'),defaultTask=button(defaults,'default-taskFrame');
    const wallSettings=el('div','store-wall-settings',wallSection);let settingsLanguage=null;
    const wallGrid=el('div','store-wall-grid',wallSection),wallEmpty=el('p','store-empty',wallSection);
    const warehouse=el('section','store-warehouse',shop),market=root.TracerGardenMarketView.create(warehouse,{onAction,collections:false});
    const closing=el('footer','store-closing',shop),closingMark=el('span','store-closing-mark',closing,'❧'),closingText=el('p','',closing),closingSign=el('span','store-eyebrow',closing,'TRACER · LITTLE THINGS, LOVINGLY COLLECTED');closingMark.setAttribute('aria-hidden','true');
    const detail=el('dialog','store-wall-detail',shop),close=button(detail,'close'),detailImage=el('div','store-wall-detail-image',detail),detailCopy=el('div','store-wall-detail-copy',detail),detailName=el('h2','',detailCopy),detailText=el('p','',detailCopy),detailPrice=el('p','store-detail-price',detailCopy),buy=button(detailCopy,'wall-buy');
    detailName.id='store-wall-detail-title';detail.setAttribute('aria-labelledby',detailName.id);close.autofocus=true;
    detail.addEventListener('click',event=>{if(event.target===detail)detail.close();});detail.addEventListener('close',()=>{disposePreview();disposePreview=()=>{};selected=null;});
    const abort=new AbortController();
    Promise.all(['/wallpaper-catalog.json','/frame-catalog.json'].map(url=>fetch(url,{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('catalog');return r.json();}))).then(lists=>lists.flat()).then(items=>{if(dead)return;catalog=items.map(i=>({...i,asset:i.asset?(['avatarFrame','taskFrame'].includes(i.type)?i.asset:'/wallpapers/'+i.asset.split('/').pop()):undefined}));renderWalls();}).catch(e=>{if(!dead&&e.name!=='AbortError')wallEmpty.textContent=tr('壁纸暂时无法载入，请重新打开商店。','Wallpapers could not load. Please reopen the shop.');});
    const owned=()=>new Set((state.wallpapers?.purchases||[]).map(i=>i.itemId));
    const appearance=()=>state.wallpapers?.appearance||{};
    function renderWalls(){
      if(dead)return;
      const frameTab=tab==='avatarFrames'||tab==='taskFrames';
      wallTitle.textContent=tab==='avatarFrames'?tr('为自己，挑一枚小小的徽记。','A little signature, just for you.'):tab==='taskFrames'?tr('让每个计划，都有自己的模样。','Give every plan a character of its own.'):tab==='materials'?tr('让每一处细节，都合心意。','A finish that feels like you.'):tr('给日常，换一扇窗。','A new window on your day.');
      wallHint.textContent=tab==='avatarFrames'?tr('用你的头像试戴。一次收藏，可随时佩戴或收起。','Try it on your portrait. Collect once, wear or put away whenever you like.'):tab==='taskFrames'?tr('应用于任务看板和日程卡片。任务框优先于整体边框；收起后恢复整体主题。','Styles your board and planner cards. Task frames take priority over the workspace material; removing one restores that theme.'):tr('先点开欣赏，再决定收藏。壁纸与材质可分别搭配。','Open a preview, then choose your favourite. Mix wallpapers and materials freely.');
      filters.hidden=tab!=='wallpapers';defaultBg.hidden=defaultMaterial.hidden=frameTab;defaultAvatar.hidden=tab!=='avatarFrames';defaultTask.hidden=tab!=='taskFrames';
      wallSettings.hidden=tab!=='wallpapers';if(settingsLanguage!==state.language){settingsLanguage=state.language;wallSettings.replaceChildren();root.TracerWallpapers.opacityControl(wallSettings);}
      defaultAvatar.textContent=tr('收起头像框','Remove avatar frame');defaultTask.textContent=tr('收起任务框，跟随整体主题','Remove task frame & follow theme');defaultAvatar.disabled=pending||!appearance().avatarFrameItemId;defaultTask.disabled=pending||!appearance().taskFrameItemId;
      defaultBg.textContent=tr('恢复默认壁纸','Default wallpaper');defaultMaterial.textContent=tr('恢复默认材质','Default material');
      defaultBg.disabled=pending||!appearance().backgroundItemId;defaultMaterial.disabled=pending||!appearance().materialItemId;
      const labels={static:tr('静态风景','Still scenes'),dynamic:tr('缓缓流动','Gentle motion'),owned:tr('我的收藏','My collection')};
      for(const [id,b]of filterButtons){b.textContent=labels[id];b.setAttribute('aria-pressed',String(id===wallFilter));}
      const saved=owned(),items=catalog.filter(i=>tab==='avatarFrames'?i.type==='avatarFrame':tab==='taskFrames'?i.type==='taskFrame':tab==='materials'?i.type==='material':wallFilter==='owned'?saved.has(i.id)&&['static','dynamic'].includes(i.type):i.type===wallFilter);
      wallEmpty.hidden=items.length>0;wallEmpty.textContent=catalog.length?tr('这里还没有收藏。先去看看喜欢的风景吧。','No treasures here yet. Find a view you love.'):tr('正在布置橱窗…','Preparing the displays…');
      const signature=JSON.stringify([state.language,tab,wallFilter,items.map(i=>i.id),[...saved],appearance()]);if(signature===wallSignature)return;wallSignature=signature;wallGrid.replaceChildren();
      for(const item of items){const card=el('button','store-wall-card',wallGrid);card.type='button';card.dataset.wallpaperId=item.id;if(['avatarFrame','taskFrame'].includes(item.type))card.dataset.frameType=item.type;card.setAttribute('aria-label',tr('欣赏：','Preview: ')+tr(item.name,item.en));
        root.TracerWallpapers.thumbnail(el('div','store-wall-card-image',card),item);const copy=el('div','store-wall-card-copy',card);el('span','store-eyebrow',copy,item.type==='avatarFrame'?tr('头像珍饰','PORTRAIT ATELIER'):item.type==='taskFrame'?tr('日常信笺','THE EVERYDAY EDIT'):item.type==='dynamic'?tr('流光微尘','MOTION STUDY'):item.type==='material'?tr('材质珍藏','MATERIAL STUDY'):tr('静态风景','STILL SCENE'));el('h3','',copy,tr(item.name,item.en));el('span','store-wall-price',copy,appearance()[root.TracerFrames.slot(item)+'ItemId']===item.id?tr('正在使用','In use'):saved.has(item.id)?tr('已收藏 · 点击预览','Collected · Preview'):'◈ '+item.price);}
    }
    function renderDetail(){
      const item=catalog.find(i=>i.id===selected);if(!item)return;const has=owned().has(item.id),slot=root.TracerFrames.slot(item),equipped=appearance()[slot+'ItemId']===item.id;
      close.textContent=tr('关闭','Close');detailName.textContent=tr(item.name,item.en);detailText.textContent=tr(item.description,item.descriptionEn||item.en+' · '+(item.type==='material'?'A complete finish for your workspace.':item.type==='dynamic'?'A quietly moving view.':'A view to make your space your own.'));
      detailPrice.textContent=(has?tr('永久收藏，可随时更换','Yours forever. Change it whenever you like.'):'◈ '+item.price+tr(' 金币',' coins'))+(item.type==='taskFrame'?tr(' · 优先于整体边框样式',' · Takes priority over workspace materials'):'');
      buy.textContent=!A?.context.user?tr('登录后收藏','Sign in to collect'):has?equipped?tr('收起，恢复默认','Put away & use default'):item.type==='avatarFrame'?tr('佩戴头像框','Wear this frame'):item.type==='taskFrame'?tr('应用到任务卡','Apply to task cards'):tr('装扮我的空间','Apply to my space'):tr('收藏 · ','Collect · ')+item.price+tr(' 金币',' coins');
      buy.disabled=pending||!!state.busy||!!state.error||!!A?.context.user&&!has&&(state.economy?.balance||0)<item.price;
    }
    async function flush(){await T.ready;if(T.store.dirty)T.saveNow();const deadline=Date.now()+15000;while(T.store.inflight&&Date.now()<deadline)await new Promise(r=>setTimeout(r,40));if(T.store.dirty||T.store.inflight||T.store.conflict||T.store.lost)throw new Error('save-pending');}
    async function mutate(action,input){
      if(pending)return;pending=true;renderDetail();try{await flush();const result=await A.api(action,input);root.TracerWallpapers.synchronize(result.collection);state={...state,wallpapers:result.collection.ledger,economy:{...state.economy,balance:result.collection.balance}};message.hidden=true;update(state);}
      catch{message.hidden=false;messageText.textContent=tr('暂时未能保存，请稍后重试。','Could not save this change. Please try again.');}
      finally{pending=false;renderDetail();renderWalls();}
    }
    function choose(next){tab=next;render();}
    function render(){
      shop.dataset.department=tab;furniture.hidden=tab!=='furniture';stickerSection.hidden=tab!=='stickers';wallSection.hidden=!['wallpapers','materials','avatarFrames','taskFrames'].includes(tab);warehouse.hidden=tab!=='warehouse';
      navigation.setAttribute('aria-label',tr('店铺分区','Shop departments'));
      for(const [id,b]of navs){const labels=navLabels.get(id);labels.name.textContent=({furniture:tr('家具小铺','Furniture'),stickers:tr('贴纸小铺','Stickers'),wallpapers:tr('风景画廊','Wallpapers'),materials:tr('材质工坊','Materials'),avatarFrames:tr('头像饰品铺','Portrait atelier'),taskFrames:tr('任务框工坊','Task frames'),warehouse:tr('花园柜台','Garden counter')})[id];labels.note.textContent=({furniture:tr('15 件匠心小物','15 crafted treasures'),stickers:tr('8 张纸边小故事','8 paper treasures'),wallpapers:tr('20 扇风景之窗','20 little escapes'),materials:tr('10 种温柔触感','10 lovely finishes'),avatarFrames:tr('6 枚属于你的徽记','6 personal signatures'),taskFrames:tr('6 种日常的模样','6 styles for your plans'),warehouse:tr('出售收获 · 打理花园','Harvests & gardens')})[id];b.setAttribute('aria-pressed',String(tab===id));}
      eyebrow.textContent='TRACER · GARDEN GENERAL STORE';title.textContent=tr('心愿杂货铺','The wish emporium');walletLabel.textContent=tr('我的金币','YOUR COINS');balance.textContent='◈ '+(state.economy?.balance||0).toLocaleString();back.textContent=tr('回花园 ↗','To the garden ↗');
      heroTag.textContent=tr('橱窗故事 / 午后的慢时光','IN THE WINDOW / A SLOW AFTERNOON');heroTitle.textContent=tr('欢迎光临，\n慢慢挑，慢慢喜欢。','Come on in.\nFind a little joy.');heroText.textContent=tr('木头的温度，花开的声音。\n为你的小天地，添一件心爱之物。','Warm wood. A hint of spring.\nSomething lovely for your own little world.');heroAction.textContent=tr('看看本期橱窗 →','Browse the window →');
      welcome.textContent=tr('小店营业中','COME ON IN');windowLabel.textContent=tr('午后书房 · 玻璃花房','READING NOOKS & GLASSHOUSES');
      for(const [id,b]of features){const item=state.collectibles?.items.find(i=>i.id===id);b.setAttribute('aria-label',tr('橱窗商品：','Window display: ')+(item?.name[state.language==='en'?1:0]||id));}
      benefits.textContent=tr('—  把日常的努力，换成喜欢的风景  —','—  SMALL EFFORTS, LOVELY LITTLE REWARDS  —');closingText.textContent=tr('愿你带走的每一件小物，都让日常多一点欢喜。','May every little treasure make your everyday a little lovelier.');retry.textContent=tr('重试保存','Retry save');
      if(state.error){message.hidden=false;messageText.textContent=state.error;}else if(!pending)message.hidden=true;
      collection.update(state);stickerShop.update(state);market.update(state);renderWalls();renderDetail();
    }
    function click(event){const feature=event.target.closest('[data-store-feature]');if(feature){const id=feature.dataset.storeFeature,item=state.collectibles?.items.find(i=>i.id===id);if(!item)return;choose('furniture');furniture.querySelector('[data-set-id="'+item.setId+'"]')?.click();furniture.querySelector('[data-collect-action=inspect][data-item-id="'+id+'"]')?.click();return;}
      const card=event.target.closest('[data-wallpaper-id]');if(card){selected=card.dataset.wallpaperId;disposePreview();disposePreview=root.TracerWallpapers.thumbnail(detailImage,catalog.find(i=>i.id===selected),true);renderDetail();detail.showModal();return;}
      const action=event.target.closest('[data-store-action]')?.dataset.storeAction;if(!action)return;
      if(navs.has(action)){choose(action);return;}if(action.startsWith('filter-')){wallFilter=action.slice(7);renderWalls();return;}
      if(action==='garden'){onAction('open-garden');return;}if(action==='retry'){onAction('retry-save');return;}if(action==='close'){detail.close();return;}
      if(action==='new'){choose('furniture');furniture.querySelector('[data-set-id=reading]')?.click();furniture.scrollIntoView({block:'start'});return;}
      if(['default-background','default-material','default-avatarFrame','default-taskFrame'].includes(action)){void mutate('wallpaper-equip',{slot:action.slice(8),itemId:null});return;}
      if(action==='wall-buy'){
        if(!A?.context.user){detail.close();doc.getElementById('account-open')?.click();return;}
        const item=catalog.find(i=>i.id===selected);if(!item)return;const slot=root.TracerFrames.slot(item);
        void mutate(owned().has(item.id)?'wallpaper-equip':'wallpaper-purchase',owned().has(item.id)?{slot,itemId:appearance()[slot+'ItemId']===item.id?null:item.id}:{itemId:item.id});
      }
    }
    shop.addEventListener('click',click);
    function update(next){if(dead)return;state=next;render();}
    return{update,department:choose,destroy(){dead=true;abort.abort();disposePreview();if(detail.open)detail.close();collection.destroy();stickerShop.destroy();market.destroy();shop.removeEventListener('click',click);shop.remove();}};
  };
})(typeof window!=='undefined'?window:globalThis);
