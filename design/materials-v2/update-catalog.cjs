'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'public/wallpaper-catalog.json'),catalog=JSON.parse(fs.readFileSync(file,'utf8'));
const updates={
  m04:{description:'起伏木纹与细小木孔沿框边延伸，拼角与凹槽形成真实的深浅层次。移动鼠标，观察胡桃木漆面的暖色反光。',style:'木纹凹凸 · 拼角凹槽 · 漆面反光'},
  m05:{name:'冰晶切面',description:'多层晶体切面折射当前壁纸，棱边带细微色散与环境反光。光线跟随鼠标移动，透明边框显出厚度。',style:'壁纸折射 · 棱边色散 · 晶体切面'},
  m06:{description:'细密钛金属拉丝与机械倒角接住环境光，明暗沿表面方向展开。移动鼠标，感受冷银边框的金属反射。',style:'方向性反光 · 金属拉丝 · 机械倒角'}
};
for(const item of catalog)if(item.type==='material')Object.assign(item,updates[item.id]||{},{materialVersion:2});
const json=JSON.stringify(catalog,null,2)+'\n';
for(const target of ['public/wallpaper-catalog.json','skins/tracer/wallpaper-catalog.json','design/wallpaper-studio-v1/catalog.json'])fs.writeFileSync(path.join(root,target),json);
const prior=path.join(root,'design/wallpaper-studio-v1/catalog.js');
if(fs.existsSync(prior)){const content=fs.readFileSync(prior,'utf8'),prefix=content.slice(0,content.indexOf('['));fs.writeFileSync(prior,prefix+JSON.stringify(catalog,null,2)+';\n');}
