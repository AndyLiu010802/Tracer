(function(root){
  'use strict';
  const styles=[
    ['field','#304537','#a05e44','#304537','植物标本 · 棉纸压花','Pressed botanicals · Cotton paper'],
    ['forest','#294334','#827037','#eee1af','新艺术鎏金 · 翡翠藤蔓','Gilded Art Nouveau · Emerald ivy'],
    ['letter','#49403c','#9a4b46','#49403c','巴黎旧信 · 玫瑰拼贴','Parisian letters · Rose collage'],
    ['night','#f0e7cd','#d5bd85','#f0e7cd','古典星图 · 午夜金箔','Celestial engraving · Midnight gold'],
    ['coast','#244c68','#c1644d','#244c68','地中海版画 · 钴蓝海浪','Mediterranean print · Cobalt waves'],
    ['sakura','#52424b','#a75f6a','#52424b','浮世绘 · 樱花和纸','Ukiyo-e · Sakura washi'],
    ['alpine','#2b4750','#a75b3e','#2b4750','瑞士旅行海报 · 雪峰剪纸','Swiss travel lithograph · Alpine peaks'],
    ['dunes','#63493c','#9a673c','#e9d7b1','摩洛哥花砖 · 沙漠金饰','Moroccan mosaics · Desert gold'],
    ['rain','#445160','#777091','#445160','雨中水彩 · 法式绣球','Rainy watercolors · French hydrangeas'],
    ['sunset','#6e3f45','#a64d3c','#6e3f45','复古丝网印刷 · 里维埃拉','Retro screen print · Riviera sunset'],
    ['aurora','#e9f2eb','#a9d6cd','#e9f2eb','北欧水粉 · 极光银箔','Nordic gouache · Aurora silver'],
    ['orbit','#494865','#797090','#494865','未来珠光 · 镭射轨道','Opalescent futurism · Holographic orbits']
  ];
  const catalog=Object.fromEntries(styles.map(([id,ink,accent,titleInk,zh,en])=>['pc_'+id,{src:'/postcard-art/'+id+'-v2.png',ink,accent,titleInk,subtitle:[zh,en]}]));
  // Optical centres of the illustration frames in the generated artwork.
  const centres={field:[29.5,49],forest:[27.5,50],letter:[27.5,50],night:[27.5,48.5],coast:[27.5,50],sakura:[27.5,50],alpine:[25.5,50],dunes:[25,50],rain:[27,50],sunset:[27.5,50],aurora:[26,50],orbit:[28,49]};
  for(const [id,[x,y]]of Object.entries(centres))catalog['pc_'+id].centre={x,y};
  // Each open view owns a small decoded-image cache; thumbnails are painted once.
  function loader(doc,limit=3){
    const entries=new Map();let dead=false;
    const get=id=>entries.get(id);
    function load(id,retry=false){
      if(dead||!catalog[id])return Promise.resolve(null);
      if(retry&&entries.get(id)?.status==='error')entries.delete(id);
      const found=entries.get(id);if(found){entries.delete(id);entries.set(id,found);return found.promise;}
      const image=new doc.defaultView.Image(),entry={image,status:'loading',promise:null};
      entry.promise=new Promise(resolve=>{entry.finish=resolve;image.onload=()=>{if(dead)return;entry.status='ready';image.onload=image.onerror=null;resolve(image);let settled=[...entries.values()].filter(row=>row.status!=='loading').length;for(const [key,row]of entries){if(settled<=limit)break;if(key!==id&&row.status!=='loading'){entries.delete(key);settled--;}}};image.onerror=()=>{entry.status='error';image.onload=image.onerror=null;resolve(null);};});
      entries.set(id,entry);image.decoding='async';image.src=catalog[id].src;return entry.promise;
    }
    return{get,load,destroy(){dead=true;for(const row of entries.values()){row.image.onload=row.image.onerror=null;row.finish(null);}entries.clear();}};
  }
  const api={catalog,loader};if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerPostcardArt=api;
})(typeof window!=='undefined'?window:globalThis);
