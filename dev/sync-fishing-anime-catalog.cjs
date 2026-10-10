'use strict';
// Keep the browser, desktop, mesh fallback and effect metadata on one catalog.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const data=require('./fishing-anime-data.cjs');
function change(file,transform){const target=path.join(root,file),s=fs.readFileSync(target,'utf8'),out=transform(s);if(out===s)return;fs.writeFileSync(target,out);}
change('public/fishing-model.js',s=>s.replace(/(\/\/ BEGIN ANIME RODS\s*)[\s\S]*?(\s*\/\/ END ANIME RODS)/,'$1RODS.push.apply(RODS,'+JSON.stringify(data.rods)+');$2').replace(/ROD_POOLS\.push\.apply\(ROD_POOLS,\[\s*\{\s*"id": "naruto"[\s\S]*?\]\);/,'ROD_POOLS.push.apply(ROD_POOLS,'+JSON.stringify(data.pools,null,2)+');'));
fs.copyFileSync(path.join(root,'public/fishing-model.js'),path.join(root,'skins/tracer/fishing-model.js'));
change('skins/tracer/fishing-crafted-rods.js',s=>s.replace(/(\/\/ BEGIN CRAFTED CATALOG\s*const catalog=)([\s\S]*?)(;\s*\/\/ END CRAFTED CATALOG)/,(_,a,json,b)=>{const catalog=JSON.parse(json);for(const rod of data.rods)catalog[rod.id]=rod;return a+JSON.stringify(catalog)+b;}));
change('skins/tracer/fishing-anime-effects.js',s=>s.replace(/(\/\/ BEGIN ANIME EFFECT CATALOG\s*const entries=)[\s\S]*?(;\s*\/\/ END ANIME EFFECT CATALOG)/,'$1'+JSON.stringify(Object.fromEntries(data.rods.map(r=>[r.id,{action:r.animeAction,color:r.color,accent:r.accent,rarity:r.rarity,collection:r.collection}])) )+'$2'));
change('skins/tracer/fishing-art.js',s=>s.replace(/ROD_SPRITES\.push\("anime_iruka"[^;]+;/,'ROD_SPRITES.push('+data.rods.map(r=>JSON.stringify(r.id)).join(',')+');'));
console.log('Synced '+data.rods.length+' anime rods: '+data.pools.map(p=>p.id+' '+(p.rodIds.length+1)).join(', '));
