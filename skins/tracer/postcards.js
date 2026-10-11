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
  EDITIONS.pc_coast={"tag": "05 / COASTAL AIRMAIL", "subtitle": ["海岸等高线 · 灯塔邮票", "Tidal contours · Lighthouse mail"], "scene": "coast"};
  EDITIONS.pc_sakura={"tag": "06 / PETAL LETTERS", "subtitle": ["樱花纸笺 · 花瓣边饰", "Blush paper · Petal borders"], "scene": "sakura"};
  EDITIONS.pc_alpine={"tag": "07 / ALPINE JOURNAL", "subtitle": ["雪峰剪影 · 冰蓝信纸", "Mountain silhouettes · Icy blue paper"], "scene": "alpine"};
  EDITIONS.pc_dunes={"tag": "08 / OASIS LETTERS", "subtitle": ["流沙曲线 · 赤陶墨色", "Dune contours · Terracotta ink"], "scene": "dunes"};
  EDITIONS.pc_rain={"tag": "09 / RAINY AFTERNOON", "subtitle": ["雨丝线条 · 鼠尾草绿", "Rain studies · Sage green"], "scene": "rain"};
  EDITIONS.pc_sunset={"tag": "10 / SUNSET PASSAGE", "subtitle": ["落日圆章 · 暖杏天空", "Sunset seal · Apricot sky"], "scene": "sunset"};
  EDITIONS.pc_aurora={"tag": "11 / AURORA VOYAGE", "subtitle": ["极光织带 · 深海夜色", "Aurora ribbons · Deep ocean night"], "scene": "aurora"};
  EDITIONS.pc_orbit={"tag": "12 / ORBITAL POST", "subtitle": ["行星轨迹 · 紫墨金线", "Orbital paths · Violet and gold"], "scene": "orbit"};
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
  function draw(canvas,{item,planet,globe,language='zh',recipient='',message='',sender='',locked=false,stickers=[],stickerImages=new Map()},scale=1){
    canvas.width=Math.round(WIDTH*scale);canvas.height=Math.round(HEIGHT*scale);const c=canvas.getContext('2d');c.scale(scale,scale);
    const en=language==='en',t=(zh,english)=>en?english:zh,forest=item.id==='pc_forest',vintage=item.id==='pc_letter',night=item.id==='pc_night';
    const edition=EDITIONS[item.id],scene=edition.scene;
    let paper=night?'#182735':vintage?'#eee3cb':forest?'#f1ecdd':'#f7f2e9',ink=night?'#ece5d0':vintage?'#343e43':'#2d4438',accent=night?'#c5ae79':vintage?'#a5533b':forest?'#6d7956':'#b25e45',field=night?'#1e3541':forest?'#243d32':vintage?'#dce0ca':'#e3e7d7';
    if(scene)[paper,field,ink,accent]=item.colors;
    const stampDate=new Date(planet.completedAt),validDate=Number.isFinite(stampDate.getTime()),date=validDate?stampDate.toLocaleDateString(en?'en-US':'zh-CN',{year:'numeric',month:'long',day:'numeric'}):t('纪念日未记录','Date not recorded'),shortDate=validDate?[stampDate.getFullYear(),String(stampDate.getMonth()+1).padStart(2,'0'),String(stampDate.getDate()).padStart(2,'0')].join('.'):'UNDATED';
    c.fillStyle=paper;c.fillRect(0,0,WIDTH,HEIGHT);
    if(scene){
      c.fillStyle=field;c.fillRect(66,66,1190,1468);c.save();c.beginPath();c.rect(66,66,1190,1468);c.clip();
      if(scene==='coast'||scene==='dunes'||scene==='aurora'){
        for(let i=0;i<12;i++){c.beginPath();for(let x=66;x<=1256;x+=12){const y=490+i*87+Math.sin(x/(scene==='aurora'?245:180)+i*.45)*90;if(x===66)c.moveTo(x,y);else c.lineTo(x,y);}c.strokeStyle=i%3?accent:paper;c.globalAlpha=scene==='aurora'?.35:.3;c.lineWidth=scene==='aurora'?28:3;c.stroke();}c.globalAlpha=1;
      }else if(scene==='sakura'){
        branch(c,180,1450,2,-.3,accent);branch(c,1150,670,1.5,.4,accent);
        for(let i=0;i<48;i++){c.fillStyle=i%2?paper:accent;c.globalAlpha=.45;c.beginPath();c.ellipse(108+(i*173)%1110,240+(i*211)%1220,7,18,i*.6,0,Math.PI*2);c.fill();}c.globalAlpha=1;
      }else if(scene==='alpine'){
        for(let i=0;i<4;i++){const x=80+i*310,y=610+i%2*150;c.fillStyle=i%2?accent:paper;c.globalAlpha=.5;c.beginPath();c.moveTo(x-190,1230);c.lineTo(x+120,y);c.lineTo(x+450,1230);c.fill();}c.globalAlpha=1;
      }else if(scene==='rain'){
        for(let i=0;i<70;i++){const x=80+i*137%1160,y=300+i*179%1170;line(c,x,y,x-20,y+66,paper,.5,3);}
      }else if(scene==='sunset'){
        c.fillStyle=accent;c.globalAlpha=.42;c.beginPath();c.arc(660,714,376,0,Math.PI*2);c.fill();c.globalAlpha=1;for(let i=0;i<9;i++)line(c,66,905+i*63,1256,905+i*63,paper,.6,4);
      }else{
        for(let i=0;i<5;i++){c.strokeStyle=accent;c.globalAlpha=.5;c.lineWidth=2;c.beginPath();c.ellipse(660,840,430+i*50,180+i*38,-.5,0,Math.PI*2);c.stroke();}c.globalAlpha=1;for(let i=0;i<20;i++)star(c,100+(i*233)%1100,320+(i*179)%1100,5+i%3*2,accent);
      }
      text(c,edition.tag,125,127,1070,25,1,ink,MONO);text(c,item.name[en?1:0],125,204,1060,en?62:76,2,ink,SERIF);
      if(globe)c.drawImage(globe,16,218,1280,1280);text(c,t('从一段日常，寄往远方。','A little everyday life, sent afar.'),125,1454,1090,28,1,ink,SERIF);c.restore();
      text(c,'A LETTER FROM MY WORLD',1375,139,650,27,1,accent,MONO);text(c,edition.tag,1375,200,650,20,1,accent,MONO);line(c,1375,271,1850,271,accent,.6,3);
    }else if(vintage){
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
    for(const placement of stickers){const image=stickerImages.get(placement.itemId);if(!image||!image.complete||!image.naturalWidth)continue;c.save();c.translate(placement.x/100*WIDTH,placement.y/100*HEIGHT);c.rotate(placement.rotation*Math.PI/180);const size=placement.size*4;c.drawImage(image,-size/2,-size/2,size,size);c.restore();}
    if(locked){c.save();c.fillStyle=paper;c.globalAlpha=.94;c.fillRect(730,690,940,180);c.globalAlpha=1;line(c,750,710,1650,710,accent,.5);text(c,t('样式预览 · 购买后可导出','STYLE PREVIEW · UNLOCK TO EXPORT'),792,761,830,30,1,ink);c.restore();}
  }
  function filename(name){return (String(name||'planet').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,80)||'planet')+'-postcard.png';}
  let active=null;
  function open({planet,snapshot,collection,stickerCollection={items:[],placements:[]},language='zh',onShop,onStickerShop,onStickerChange,isCurrent=()=>true}){
    active?.();const doc=root.document,en=language==='en',t=(zh,enText)=>en?enText:zh,el=(tag,cls,parent,copy)=>{const n=doc.createElement(tag);n.className=cls||'';if(copy!==undefined)n.textContent=copy;parent?.append(n);return n;};
    const previous=doc.activeElement,dialog=el('dialog','postcard-dialog',doc.body),head=el('header','postcard-heading',dialog);
    el('div','postcard-eyebrow',head,'TRACER · THE LITTLE POST OFFICE');const title=el('h2','',head,t('寄出一颗小星球','Send a little world'));title.id='postcard-title';dialog.setAttribute('aria-labelledby',title.id);
    const close=el('button','postcard-close',head,t('关闭','Close'));close.type='button';close.onclick=()=>dialog.close();
    const layout=el('div','postcard-layout',dialog),preview=el('div','postcard-preview',layout),sheet=el('div','postcard-sheet',preview),canvas=el('canvas','',sheet),layer=el('div','postcard-sticker-layer',sheet);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('明信片预览：左侧为星球，右侧为寄语','Postcard preview: world on the left, message on the right'));
    const form=el('div','postcard-form',layout);el('h3','',form,t('挑一张喜欢的信纸','Choose your stationery'));
    const styles=el('div','postcard-styles',form);styles.setAttribute('role','group');styles.setAttribute('aria-label',t('明信片样式','Postcard styles'));
    const items=collection.items,owned=stickerCollection.items.filter(i=>i.owned),images=new Map(),nodes=new Map(),buttons=new Map();
    let item=items.find(i=>i.owned)||items[0],globe=null,dead=false,exporting=false,pending=false,failed=null,selected=null,drag=null,raf=0;
    let placements=stickerCollection.placements.filter(p=>p.targetType==='postcard'&&p.targetId===planet.id&&p.visible&&owned.some(i=>i.id===p.itemId)).map(p=>({...p}));
    for(const row of items){const b=el('button','postcard-style',styles,row.name[en?1:0]+(row.owned?'':t(' · 未购买',' · Locked')));b.type='button';b.dataset.postcardStyle=row.id;b.style.setProperty('--postcard-swatch',row.colors[0]);b.onclick=()=>{item=row;render();};buttons.set(row.id,b);}
    function schedule(){if(!raf&&!dead)raf=root.requestAnimationFrame(()=>{raf=0;render();});}
    function field(label,multiline,max,value){const l=el('label','postcard-field',form,label),input=el(multiline?'textarea':'input','',l);input.maxLength=max;input.value=value;input.addEventListener('input',schedule);return input;}
    const recipient=field(t('寄给','To'),false,40,t('未来的自己','My future self'));
    const message=field(t('写一句寄语','Your message'),true,180,t('你完成的事，开成了花。愿这颗小小的星球，记得每一段认真生活的时光。','What you finished has blossomed. May this little world remember the time and care you gave.'));
    const sender=field(t('署名','From'),false,40,t('此刻的我','Me, today'));
    const stickerBox=el('details','postcard-stickers',form);el('summary','',stickerBox,t('贴上收藏的贴纸','Add your collected stickers'));stickerBox.open=placements.length>0;
    el('p','postcard-help',stickerBox,t('点击添加，拖动摆放；选中后可调整大小、旋转或移除。每张最多 24 枚，自动保存到这颗星球。','Click to add, drag to place. Resize, rotate or remove the selection. Up to 24 stickers, saved to this world.'));
    const palette=el('div','postcard-sticker-palette',stickerBox),paletteButtons=[];
    function loadSticker(id){if(images.has(id))return;const image=new doc.defaultView.Image();images.set(id,image);image.onload=()=>{if(!dead)render();};image.onerror=()=>{if(!dead){status.textContent=t('有贴纸未能载入，请重新打开后导出。','A sticker failed to load. Reopen before exporting.');render();}};image.src='/sticker-art/'+id+'-v1.png';}
    for(const row of owned){const b=el('button','',palette),img=el('img','',b);b.type='button';b.dataset.postcardSticker=row.id;b.title=row.name[en?1:0];b.setAttribute('aria-label',b.title);img.src='/sticker-art/'+row.id+'-v1.png';img.alt='';img.loading='lazy';b.onclick=()=>{if(pending||failed||placements.length>=24)return;const p={id:'ps_'+root.crypto.randomUUID().replace(/-/g,''),itemId:row.id,targetType:'postcard',targetId:planet.id,x:30,y:76,size:84,rotation:-12,visible:true};placements.push(p);selected=p.id;loadSticker(p.itemId);void commit(p);};paletteButtons.push(b);}
    if(!owned.length)el('p','postcard-help',stickerBox,t('还没有贴纸收藏，可去商店挑选。','No collected stickers yet. Find some in the shop.'));
    const tools=el('div','postcard-sticker-tools',stickerBox),toolButtons=[];
    for(const [action,label]of [['smaller',t('缩小','Smaller')],['larger',t('放大','Larger')],['rotate',t('旋转','Rotate')],['remove',t('移除','Remove')]]){const b=el('button','',tools,label);b.type='button';b.dataset.stickerAction=action;b.onclick=()=>{const p=placements.find(p=>p.id===selected);if(!p||pending||failed)return;if(action==='remove'){p.visible=false;placements=placements.filter(i=>i!==p);selected=null;}else if(action==='rotate')p.rotation=(p.rotation+195)%360-180;else p.size=Math.max(36,Math.min(180,p.size+(action==='larger'?12:-12)));void commit(p);};toolButtons.push(b);}
    const stickerShop=el('button','store-button',stickerBox,t('去商店选贴纸','Browse stickers'));stickerShop.type='button';stickerShop.onclick=()=>{dialog.close();onStickerShop?.();};
    const help=el('p','postcard-help',form),status=el('p','postcard-status',form);status.setAttribute('role','status');
    const retry=el('button','store-button',form,t('重试保存贴纸','Retry saving stickers'));retry.type='button';retry.hidden=true;retry.onclick=()=>{if(failed&&!pending)void commit(failed);};
    const actions=el('div','postcard-actions',form),save=el('button','store-button',actions,t('导出明信片 PNG','Export postcard PNG')),shop=el('button','store-button',actions,t('去商店挑选样式','Browse styles in the shop'));save.type=shop.type='button';shop.onclick=()=>{dialog.close();onShop?.();};
    function renderStickers(){const live=new Set(placements.map(p=>p.id));for(const [id,node]of nodes)if(!live.has(id)){node.remove();nodes.delete(id);}for(const p of placements){let node=nodes.get(p.id);if(!node){node=el('button','postcard-placed-sticker',layer);node.type='button';node.dataset.placement=p.id;const img=el('img','',node);img.src='/sticker-art/'+p.itemId+'-v1.png';img.alt='';img.draggable=false;node.setAttribute('aria-label',owned.find(i=>i.id===p.itemId)?.name[en?1:0]||t('贴纸','Sticker'));node.onclick=()=>{selected=p.id;renderStickers();};nodes.set(p.id,node);}node.style.left=p.x+'%';node.style.top=p.y+'%';node.style.width=p.size*4/WIDTH*100+'%';node.style.transform='translate(-50%,-50%) rotate('+p.rotation+'deg)';node.setAttribute('aria-pressed',String(p.id===selected));node.disabled=pending||!!failed;}
      for(const b of toolButtons)b.disabled=!selected||pending||!!failed;for(const b of paletteButtons)b.disabled=pending||!!failed||placements.length>=24;}
    function state(stickers=[]){return{item,planet,globe,language,recipient:recipient.value,message:message.value,sender:sender.value,locked:!item.owned,stickers,stickerImages:images};}
    function render(){if(dead)return;draw(canvas,state(),.5);renderStickers();for(const [id,b]of buttons)b.setAttribute('aria-pressed',String(id===item.id));save.disabled=!globe||!item.owned||exporting||pending||!!failed||placements.some(p=>!images.get(p.itemId)?.naturalWidth);retry.hidden=!failed;help.textContent=!item.owned?t('这款信纸需 '+item.price+' 金币，购买后可永久使用。','This stationery costs '+item.price+' coins and is yours forever.'):t('PNG 2400 × 1600 · 含已摆放贴纸 · 寄语最多 180 字','PNG 2400 × 1600 · Includes your stickers · Up to 180 characters');}
    async function commit(p){if(!isCurrent()){dialog.close();return;}pending=true;failed=null;render();status.textContent=t('正在保存贴纸…','Saving stickers…');try{if(!onStickerChange)throw Error('save-unavailable');await onStickerChange({...p});if(dead)return;status.textContent=t('贴纸已保存','Stickers saved');}catch{if(dead)return;failed={...p};status.textContent=t('贴纸尚未保存，请重试后导出。','Stickers have not saved. Retry before exporting.');}finally{pending=false;render();}}
    layer.addEventListener('pointerdown',e=>{const node=e.target.closest('[data-placement]');if(!node||pending||failed||e.button!==0)return;const p=placements.find(p=>p.id===node.dataset.placement);selected=p.id;drag={id:e.pointerId,p,x:e.clientX,y:e.clientY,px:p.x,py:p.y};node.setPointerCapture(e.pointerId);e.preventDefault();renderStickers();});
    layer.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const r=layer.getBoundingClientRect();drag.p.x=Math.max(0,Math.min(100,drag.px+(e.clientX-drag.x)/r.width*100));drag.p.y=Math.max(0,Math.min(100,drag.py+(e.clientY-drag.y)/r.height*100));renderStickers();});
    const finish=e=>{if(!drag||drag.id!==e.pointerId)return;const p=drag.p,moved=p.x!==drag.px||p.y!==drag.py;drag=null;if(moved)void commit(p);};layer.addEventListener('pointerup',finish);layer.addEventListener('pointercancel',finish);
    layer.addEventListener('keydown',e=>{const p=placements.find(p=>p.id===e.target.dataset.placement);if(!p||pending||failed||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();p.x=Math.max(0,Math.min(100,p.x+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)));p.y=Math.max(0,Math.min(100,p.y+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)));void commit(p);});
    save.onclick=async()=>{if(!isCurrent()){dialog.close();return;}if(save.disabled)return;exporting=true;render();status.textContent=t('正在生成图片…','Preparing your image…');try{const output=doc.createElement('canvas');draw(output,state(placements));const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('png-export')),'image/png'));if(dead)return;const url=root.URL.createObjectURL(blob),a=el('a','',doc.body);a.href=url;a.download=filename(planet.name);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);status.textContent=t('图片已生成，请在下载位置查看。','Image ready. Check your downloads.');}catch{if(!dead)status.textContent=t('导出失败，请重试。','Export failed. Please try again.');}finally{exporting=false;render();}};
    const cleanup=()=>{if(dead)return;dead=true;root.clearInterval(scopeTimer);if(raf)root.cancelAnimationFrame(raf);for(const image of images.values()){image.onload=null;image.onerror=null;}images.clear();nodes.clear();dialog.remove();if(active===cleanup)active=null;previous?.focus({preventScroll:true});};const scopeTimer=root.setInterval(()=>{if(!isCurrent())cleanup();},500);active=cleanup;dialog.addEventListener('close',cleanup);dialog.showModal();close.focus();for(const p of placements)loadSticker(p.itemId);render();status.textContent=t('正在绘制你的星球…','Rendering your world…');
    Promise.resolve().then(snapshot).then(result=>{if(dead)return;globe=result;if(!pending&&!failed)status.textContent='';render();}).catch(()=>{if(!dead)status.textContent=t('星球图片未能载入，请关闭后重试。','The world could not load. Close and try again.');});return cleanup;
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
