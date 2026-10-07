(function(root){
  'use strict';
  const WIDTH=2400,HEIGHT=1600;
  const text=(ctx,value,x,y,width,size,lines=1,color='#304537',family='sans-serif')=>{
    ctx.fillStyle=color;ctx.font=size+'px '+family;ctx.textAlign='left';ctx.textBaseline='top';
    const chars=Array.from(String(value||'').replace(/\s+/gu,' ').trim());let line='',row=0;
    for(let i=0;i<chars.length;i++){
      if(ctx.measureText(line+chars[i]).width>width&&line){
        if(row===lines-1){while(line&&ctx.measureText(line+'…').width>width)line=Array.from(line).slice(0,-1).join('');ctx.fillText(line+'…',x,y+row*size*1.45);return;}
        const boundary=line.lastIndexOf(' '),wordBreak=boundary>line.length*.35;
        ctx.fillText(wordBreak?line.slice(0,boundary):line,x,y+row*size*1.45);row++;line=wordBreak?line.slice(boundary+1):'';
      }line+=chars[i];
    }ctx.fillText(line,x,y+row*size*1.45);
  };
  const SERIF='Georgia, "Songti SC", SimSun, serif',MONO='"Courier New", monospace';
  const EDITIONS={
    pc_field:{tag:'01 / FIELD NOTES',subtitle:['奶油纸 · 编辑排版 · 陶土红点缀','Cream paper · Editorial type · Terracotta accents']},
    pc_forest:{tag:'02 / THE HERBARIUM',subtitle:['植物馆藏 · 拱形画框 · 枝叶线描','Botanical archive · Arched frame · Leaf studies']},
    pc_letter:{tag:'03 / SLOW AIRMAIL',subtitle:['复古航空邮笺 · 拼贴相纸 · 旧邮戳','Vintage airmail · Photo collage · Postal marks']},
    pc_night:{tag:'04 / CELESTIAL ATLAS',subtitle:['午夜星图 · 轨道细线 · 香槟金墨','Midnight atlas · Orbital lines · Champagne ink']}
  };
  const grainCache=new WeakMap();
  function paperGrain(c){
    const doc=c.canvas.ownerDocument;let tile=grainCache.get(doc);
    if(!tile){tile=doc.createElement('canvas');tile.width=tile.height=180;const tc=tile.getContext('2d'),pixels=tc.createImageData(180,180);let seed=6721;
      for(let i=0;i<pixels.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const light=(seed>>>10)&1?255:45;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=light;pixels.data[i+3]=(seed>>>24)%12;}
      tc.putImageData(pixels,0,0);grainCache.set(doc,tile);
    }c.save();c.fillStyle=c.createPattern(tile,'repeat');c.fillRect(0,0,WIDTH,HEIGHT);c.restore();
  }
  function line(c,x,y,x2,y2,color,alpha=1,width=2){c.save();c.strokeStyle=color;c.globalAlpha=alpha;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();c.restore();}
  function star(c,x,y,r,color){c.save();c.fillStyle=color;c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x+2,y-2,x+r,y);c.quadraticCurveTo(x+2,y+2,x,y+r);c.quadraticCurveTo(x-2,y+2,x-r,y);c.quadraticCurveTo(x-2,y-2,x,y-r);c.fill();c.restore();}
  function branch(c,x,y,scale,angle,color){c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.7;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-24,-70,12,-150,0,-240);c.stroke();for(let i=0;i<7;i++){const sy=-25-i*28,side=i%2?1:-1;c.beginPath();c.moveTo(-5,sy);c.bezierCurveTo(side*48,sy+5,side*62,sy-32,side*54,sy-38);c.bezierCurveTo(side*18,sy-43,side*9,sy-18,-5,sy);c.globalAlpha=.14;c.fill();c.globalAlpha=.75;c.stroke();}c.restore();}
  function postage(c,x,y,{paper,ink,field,globe,night=false}){
    c.save();c.fillStyle=paper;c.fillRect(x,y,152,198);c.fillStyle=field;c.fillRect(x+12,y+12,128,174);
    // Perforations are drawn into the stamp, like a die-cut paper edge.
    c.strokeStyle=ink;c.globalAlpha=.5;c.setLineDash([2,9]);c.lineWidth=3;c.strokeRect(x+4,y+4,144,190);c.setLineDash([]);c.globalAlpha=1;
    if(globe)c.drawImage(globe,x-2,y+7,156,156);else star(c,x+76,y+87,30,ink);
    text(c,night?'ASTRA':'FLORA',x+29,y+153,108,17,1,ink,MONO);text(c,'01',x+107,y+25,37,23,1,ink,SERIF);c.restore();
  }
  function postmark(c,x,y,color,date){c.save();c.translate(x,y);c.rotate(-.16);c.strokeStyle=color;c.fillStyle=color;c.globalAlpha=.65;c.lineWidth=2.5;for(const r of [85,72]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}c.font='18px '+MONO;c.textAlign='center';c.textBaseline='middle';c.fillText('TRACER POST',0,-37);c.fillText(date,0,1);c.fillText('WITH LOVE',0,38);for(let i=0;i<4;i++){c.beginPath();for(let j=0;j<=180;j+=3){const py=-42+i*27+Math.sin(j/29)*8;if(j===0)c.moveTo(72+j,py);else c.lineTo(72+j,py);}c.stroke();}c.restore();}
  function draw(canvas,{item,planet,globe,language='zh',recipient='',message='',sender='',locked=false},scale=1){
    canvas.width=Math.round(WIDTH*scale);canvas.height=Math.round(HEIGHT*scale);const c=canvas.getContext('2d');c.scale(scale,scale);
    const en=language==='en',t=(zh,english)=>en?english:zh,forest=item.id==='pc_forest',vintage=item.id==='pc_letter',night=item.id==='pc_night';
    const paper=night?'#182735':vintage?'#eee3cb':forest?'#f1ecdd':'#f7f2e9',ink=night?'#ece5d0':vintage?'#343e43':'#2d4438',accent=night?'#c5ae79':vintage?'#a5533b':forest?'#6d7956':'#b25e45',field=night?'#1e3541':forest?'#243d32':vintage?'#dce0ca':'#e3e7d7';
    const stampDate=new Date(planet.completedAt),validDate=Number.isFinite(stampDate.getTime()),date=validDate?stampDate.toLocaleDateString(en?'en-US':'zh-CN',{year:'numeric',month:'long',day:'numeric'}):t('纪念日未记录','Date not recorded'),shortDate=validDate?[stampDate.getFullYear(),String(stampDate.getMonth()+1).padStart(2,'0'),String(stampDate.getDate()).padStart(2,'0')].join('.'):'UNDATED';
    c.fillStyle=paper;c.fillRect(0,0,WIDTH,HEIGHT);
    if(vintage){
      c.save();c.beginPath();c.rect(28,28,2344,1544);c.rect(52,52,2296,1496);c.clip('evenodd');
      for(let x=-1700;x<4100;x+=94){c.fillStyle=Math.floor(x/94)%2?'#9b4e3d':'#486875';c.beginPath();c.moveTo(x,0);c.lineTo(x+40,0);c.lineTo(x+1640,1600);c.lineTo(x+1600,1600);c.fill();}c.restore();
      c.save();c.translate(635,790);c.rotate(-.035);c.shadowColor='#66513930';c.shadowBlur=24;c.shadowOffsetY=14;c.fillStyle='#faf5e9';c.fillRect(-534,-638,1080,1302);c.shadowColor='transparent';c.fillStyle=field;c.fillRect(-504,-609,1020,1090);if(globe)c.drawImage(globe,-530,-635,1070,1070);text(c,t('来自，我的小小世界','Greetings from my little world'),-462,522,950,43,1,ink,SERIF);text(c,'A MOMENT WORTH KEEPING  /  '+shortDate,-460,606,960,20,1,accent,MONO);c.restore();
      c.save();c.translate(632,160);c.rotate(-.08);c.fillStyle='#c3b58880';c.fillRect(-178,-36,356,74);for(let i=-170;i<178;i+=16)line(c,i,-32,i+40,34,'#f8eed5',.23);c.restore();
      text(c,'PAR AVION',1370,124,520,37,1,'#486875',MONO);text(c,'CORRESPONDENCE / 03',1370,182,600,20,1,accent,MONO);
      line(c,1275,275,1275,1410,ink,.18);
    }else if(forest){
      c.fillStyle=field;c.beginPath();c.roundRect(74,72,1178,1456,[580,580,22,22]);c.fill();c.strokeStyle='#b8bd8e';c.lineWidth=2;c.beginPath();c.roundRect(99,97,1128,1406,[555,555,8,8]);c.stroke();
      branch(c,231,397,.85,-.56,'#c5c99d');branch(c,1090,397,.85,.56,'#c5c99d');
      text(c,'HERBARIUM',335,209,850,67,1,'#eee9cd',SERIF);text(c,'OF DAYS WELL SPENT',438,302,740,21,1,'#c5c99d',MONO);
      if(globe)c.drawImage(globe,14,185,1260,1260);text(c,t('把时光，养成一座花园。','Time, tended into a garden.'),243,1356,990,37,1,'#ede9d4',SERIF);line(c,338,1430,984,1430,'#a5b186',.5);text(c,'BOTANICAL ARCHIVE  /  TRACER',402,1460,800,18,1,'#b7c098',MONO);
      text(c,'CARTE POSTALE',1380,136,650,44,1,ink,SERIF);text(c,'THE BOTANICAL COLLECTION',1380,209,660,19,1,accent,MONO);
      branch(c,2270,1395,.58,.35,accent);
    }else if(night){
      c.strokeStyle=accent;c.lineWidth=1.5;c.strokeRect(54,54,2292,1492);c.strokeRect(68,68,2264,1464);
      c.save();c.strokeStyle=accent;c.globalAlpha=.32;c.lineWidth=1.5;for(const r of [458,496]){c.beginPath();c.arc(655,832,r,0,Math.PI*2);c.stroke();}c.beginPath();c.ellipse(655,832,570,238,-.53,0,Math.PI*2);c.stroke();for(let i=0;i<72;i++){const a=i*Math.PI/36;c.beginPath();c.moveTo(655+Math.cos(a)*500,832+Math.sin(a)*500);c.lineTo(655+Math.cos(a)*(i%6?507:520),832+Math.sin(a)*(i%6?507:520));c.stroke();}c.restore();
      for(let i=0;i<36;i++){const x=125+(i*317)%1090,y=275+(i*191)%1080;if(i%5===0)star(c,x,y,9,accent);else{c.fillStyle='#c5d1c4';c.globalAlpha=.4;c.beginPath();c.arc(x,y,1.6,0,Math.PI*2);c.fill();}}c.globalAlpha=1;
      text(c,'The celestial atlas',167,149,1100,73,1,'#ece6d3',SERIF);text(c,'SMALL WORLDS / INFINITE POSSIBILITIES',254,251,1040,21,1,accent,MONO);
      if(globe)c.drawImage(globe,25,172,1260,1260);star(c,652,1415,18,accent);text(c,'A WORLD WRITTEN IN THE STARS',333,1470,900,21,1,accent,MONO);
      line(c,1280,172,1280,1430,accent,.32);text(c,'CELESTIAL MAIL',1375,136,650,32,1,accent,MONO);text(c,'FROM MY ORBIT TO YOURS',1375,199,650,20,1,accent,MONO);
    }else{
      c.fillStyle=field;c.fillRect(66,66,1190,1468);c.fillStyle='#cfd9bc';c.beginPath();c.arc(671,733,471,0,Math.PI*2);c.fill();
      text(c,'FIELD NOTES / 01',127,118,850,23,1,ink,MONO);text(c,'Little world,',123,207,1100,103,1,ink,SERIF);text(c,'well kept.',125,325,1100,94,1,ink,SERIF);
      if(globe)c.drawImage(globe,17,270,1270,1270);text(c,t('每一点努力，都有回响。','Every little effort leaves a trace.'),132,1428,1080,32,1,ink,SERIF);
      c.fillStyle=accent;c.beginPath();c.arc(1175,130,19,0,Math.PI*2);c.fill();text(c,'A NOTE TO KEEP',1375,133,660,31,1,accent,MONO);text(c,'THE SLOW LIVING SERIES',1375,194,700,20,1,accent,MONO);
      line(c,1375,271,1850,271,accent,.6,3);
    }
    postage(c,2140,116,{paper,ink:accent,field:night?'#304650':vintage?'#d7dbc3':'#dbe0cd',globe,night});
    if(vintage||forest)postmark(c,2020,258,accent,shortDate);else if(night)star(c,2015,273,27,accent);
    const x=1375,w=865,headingY=vintage?431:439;
    text(c,t('一段完成的时光','A CHAPTER, BEAUTIFULLY FINISHED'),x,365,w,23,1,accent,MONO);
    text(c,planet.name||t('未命名项目','Untitled project'),x,headingY,w,54,3,ink,SERIF);
    text(c,date,x,699,w,25,1,accent,MONO);line(c,x,767,2270,767,accent,.35);
    text(c,(en?'DEAR  ':'致  ')+(recipient||t('未来的自己','My future self')),x,814,w,32,2,ink,SERIF);
    const note=message||t('你完成的事，开成了花。愿这颗小小的星球，记得每一段认真生活的时光。','What you finished has blossomed. May this little world remember the time and care you gave.');
    if(vintage){for(let i=0;i<7;i++)line(c,x,940+i*45.5,2265,940+i*45.5,accent,.15,1);}
    text(c,note,x,906,w,30,7,ink,SERIF);text(c,(en?'WITH LOVE,  ':'来自  ')+(sender||t('此刻的我','Me, today')),x,1261,w,28,2,ink,SERIF);
    line(c,x,1386,2265,1386,accent,.36);const flowers=planet.flowers||[];
    text(c,(planet.taskCount??flowers.length)+t(' 项完成',' TASKS FINISHED')+'  /  '+flowers.length+t(' 朵纪念花',' FLOWERS KEPT'),x,1420,w,22,1,accent,MONO);
    text(c,'TRACER POST  ·  '+EDITIONS[item.id].tag,x,1481,w,17,1,accent,MONO);
    paperGrain(c);
    if(locked){c.save();c.fillStyle=paper;c.globalAlpha=.94;c.fillRect(730,690,940,180);c.globalAlpha=1;line(c,750,710,1650,710,accent,.5);text(c,t('样式预览 · 购买后可导出','STYLE PREVIEW · UNLOCK TO EXPORT'),792,761,830,30,1,ink);c.restore();}
  }
  function filename(name){return (String(name||'planet').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,80)||'planet')+'-postcard.png';}
  let active=null;
  function open({planet,snapshot,collection,language='zh',onShop}){
    active?.();const doc=root.document,en=language==='en',t=(zh,enText)=>en?enText:zh,el=(tag,cls,parent,copy)=>{const n=doc.createElement(tag);n.className=cls||'';if(copy!==undefined)n.textContent=copy;parent?.append(n);return n;};
    const previous=doc.activeElement,dialog=el('dialog','postcard-dialog',doc.body),head=el('header','postcard-heading',dialog);
    el('div','postcard-eyebrow',head,'TRACER · THE LITTLE POST OFFICE');const title=el('h2','',head,t('寄出一颗小星球','Send a little world'));title.id='postcard-title';dialog.setAttribute('aria-labelledby',title.id);
    const close=el('button','postcard-close',head,t('关闭','Close'));close.type='button';close.onclick=()=>dialog.close();
    const layout=el('div','postcard-layout',dialog),preview=el('div','postcard-preview',layout),canvas=el('canvas','',preview);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('明信片预览：左侧为星球，右侧为寄语','Postcard preview: world on the left, message on the right'));
    const form=el('div','postcard-form',layout);el('h3','',form,t('挑一张喜欢的信纸','Choose your stationery'));
    const styles=el('div','postcard-styles',form);styles.setAttribute('role','group');styles.setAttribute('aria-label',t('明信片样式','Postcard styles'));
    const items=collection.items;let item=items.find(i=>i.owned)||items[0],globe=null,dead=false,exporting=false;const buttons=new Map();
    for(const row of items){const b=el('button','postcard-style',styles,row.name[en?1:0]+(row.owned?'':t(' · 未购买',' · Locked')));b.type='button';b.dataset.postcardStyle=row.id;b.style.setProperty('--postcard-swatch',row.colors[0]);b.onclick=()=>{item=row;render();};buttons.set(row.id,b);}
    function field(label,multiline,max,value){const l=el('label','postcard-field',form,label),input=el(multiline?'textarea':'input','',l);input.maxLength=max;input.value=value;input.addEventListener('input',render);return input;}
    const recipient=field(t('寄给','To'),false,40,t('未来的自己','My future self'));
    const message=field(t('写一句寄语','Your message'),true,180,t('你完成的事，开成了花。愿这颗小小的星球，记得每一段认真生活的时光。','What you finished has blossomed. May this little world remember the time and care you gave.'));
    const sender=field(t('署名','From'),false,40,t('此刻的我','Me, today'));
    const help=el('p','postcard-help',form,t('保留打开时的星球角度 · PNG 2400 × 1600 · 寄语最多 180 字','Keeps this view of your world · PNG 2400 × 1600 · Up to 180 characters'));
    const status=el('p','postcard-status',form);status.setAttribute('role','status');
    const actions=el('div','postcard-actions',form),save=el('button','store-button',actions,t('导出明信片 PNG','Export postcard PNG')),shop=el('button','store-button',actions,t('去商店挑选样式','Browse styles in the shop'));save.type=shop.type='button';
    shop.onclick=()=>{dialog.close();onShop?.();};
    function render(){if(dead)return;draw(canvas,{item,planet,globe,language,recipient:recipient.value,message:message.value,sender:sender.value,locked:!item.owned});for(const [id,b]of buttons)b.setAttribute('aria-pressed',String(id===item.id));save.disabled=!globe||!item.owned||exporting;help.textContent=!item.owned?t('这款信纸需 '+item.price+' 金币，购买后可永久使用。','This stationery costs '+item.price+' coins and is yours forever.'):t('保留打开时的星球角度 · PNG 2400 × 1600 · 寄语最多 180 字','Keeps this view of your world · PNG 2400 × 1600 · Up to 180 characters');}
    save.onclick=async()=>{if(save.disabled)return;exporting=true;render();status.textContent=t('正在生成图片…','Preparing your image…');
      try{const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('png-export')),'image/png'));if(dead)return;const url=root.URL.createObjectURL(blob),a=el('a','',doc.body);a.href=url;a.download=filename(planet.name);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);status.textContent=t('图片已生成，请在下载位置查看。','Image ready. Check your downloads.');}
      catch{if(!dead)status.textContent=t('导出失败，请重试。','Export failed. Please try again.');}finally{exporting=false;render();}
    };
    const cleanup=()=>{if(dead)return;dead=true;dialog.remove();if(active===cleanup)active=null;previous?.focus({preventScroll:true});};active=cleanup;dialog.addEventListener('close',cleanup);dialog.showModal();close.focus();render();status.textContent=t('正在绘制你的星球…','Rendering your world…');
    snapshot().then(result=>{if(dead)return;globe=result;status.textContent='';render();}).catch(()=>{if(!dead){status.textContent=t('星球图片未能载入，请关闭后重试。','The world could not load. Close and try again.');}});
    return cleanup;
  }
  function shop(host,onAction){
    const doc=host.ownerDocument,previews=new Map();let state={},signature='',pending=false,dead=false,globe=null,loading=false;
    const example={id:'postcard-sample',name:'A world to keep',completedAt:Date.UTC(2026,8,24),taskCount:24,flowers:Array.from({length:24},(_,i)=>({taskId:'sample-'+i,plantKind:['wildflower','sunflower','lavender','apple','peach','cherry'][i%6]}))};
    const render=()=>{if(dead)return;const en=state.language==='en',t=(zh,enText)=>en?enText:zh,items=state.postcards?.items||[],next=JSON.stringify([items,state.language,state.economy?.balance,state.busy,state.error,pending]);if(signature===next)return;signature=next;host.replaceChildren();
      const el=(tag,cls,parent,copy)=>{const n=doc.createElement(tag);n.className=cls;if(copy!==undefined)n.textContent=copy;parent.append(n);return n;};
      el('h2','',host,t('把一颗星球，收藏在信纸上。','A little world, kept on paper.'));el('p','postcard-help',host,t('基础信纸免费。其他样式用金币购买，一次收藏，可为所有星球反复导出。下方为样式示意，制作时会换成你的星球。','The first style is free. Collect more with coins and export as often as you like. Sample worlds below become your own when you create a postcard.'));
      const grid=el('div','postcard-shop-grid',host);
      for(const item of items){const card=el('article','postcard-shop-card',grid),art=el('div','postcard-shop-art',card),key=item.id+':'+en+':'+!!globe;let thumbnail=previews.get(key);
        if(!thumbnail){thumbnail=doc.createElement('canvas');draw(thumbnail,{item,planet:{...example,name:t('每一份努力，都开成了花。','Every little effort, in bloom.')},globe,language:state.language},.3);previews.set(key,thumbnail);}art.append(thumbnail);thumbnail.setAttribute('role','img');thumbnail.setAttribute('aria-label',item.name[en?1:0]);
        el('span','postcard-edition',card,EDITIONS[item.id].tag);el('h3','',card,item.name[en?1:0]);el('p','postcard-help',card,EDITIONS[item.id].subtitle[en?1:0]);el('p','postcard-shop-price',card,item.price===0?t('免费信纸 · 已拥有','Free stationery · Yours'):item.owned?t('已收藏 · 永久使用','Collected · Yours forever'):item.price+t(' 金币 · 永久使用',' coins · Yours forever'));
        const b=el('button','store-button',card,item.owned?t('去制作明信片 ↗','Create a postcard ↗'):t('购买样式 · ','Collect · ')+item.price);b.type='button';b.dataset.postcardBuy=item.id;b.disabled=pending||!!state.busy||!!state.error||!item.owned&&(state.economy?.balance||0)<item.price;
        if(!item.owned&&(state.economy?.balance||0)<item.price)el('p','postcard-help',card,t('还差 ','Earn ')+(item.price-(state.economy?.balance||0))+t(' 金币',' more coins'));
        b.onclick=async()=>{if(item.owned){onAction('open-planets');return;}if(pending)return;pending=true;render();try{await onAction('buy-postcard',{itemId:item.id});}catch{signature='';}finally{pending=false;render();}};
      }
    };
    return{update(next){state=next;if(!host.hidden&&!loading&&!globe){loading=true;root.TracerGardenPlanetsView.snapshot(doc,example,650).then(result=>{if(dead)return;globe=result;previews.clear();signature='';render();}).catch(()=>{loading=false;});}render();},destroy(){dead=true;globe=null;previews.clear();host.replaceChildren();}};
  }
  root.TracerPostcards={open,shop,draw,filename,close:()=>active?.()};
})(typeof window!=='undefined'?window:globalThis);
