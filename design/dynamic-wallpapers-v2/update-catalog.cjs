'use strict';
// Update the procedural edition in place: ownership IDs and prices never change.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..');
const studies=[
 ['流光丝幕','Silken Aurora','青绿与紫罗兰细线舒展成柔软光幕，微粒沿弧线缓缓游走。','丝线舒展 · 冷翡翠 · 静谧','Jade and violet filaments unfold slowly, carrying fine light along their curves.'],
 ['蓝调光雨','Blue Cadence','疏密有致的蓝色光线错落流下，偶尔一线暖金，像安静的爵士节拍。','垂直光线 · 深蓝 · 节奏','Fine blue streaks descend at different speeds, punctuated by a quiet note of amber.'],
 ['翠影微尘','Jade Drift','翡翠色微光在深绿空间中轻柔回旋，近远光点形成通透的呼吸感。','微尘回旋 · 深翠 · 呼吸','Layers of jade particles turn gently through a deep green field.'],
 ['玫瑰绡光','Rose Veil','细腻的玫瑰雾与斜向丝线缓慢交错，柔和而不甜腻。','轻纱细线 · 玫瑰灰 · 柔软','Diagonal threads move through a muted rose haze, soft and restrained.'],
 ['深海等高线','Tidal Contours','青蓝色细线起伏相叠，微光循着波形流动，保留大片安静的深色留白。','层叠曲线 · 深海蓝 · 秩序','Cyan contours ripple through deep blue space with generous room to breathe.'],
 ['紫雾星尘','Violet Dust','紫色与烟粉色细尘绕着偏心光晕缓缓旋转，营造抽象的深邃感。','螺旋细尘 · 烟紫 · 深邃','Violet and rose dust spiral slowly around an off-centre glow.'],
 ['银白浮光','Silver Air','银白细点与少量失焦光斑悠缓漂移，像磨砂玻璃背后的清冷光线。','细点漂移 · 银灰蓝 · 轻盈','Silver specks and soft bokeh drift across a cool, frosted field.'],
 ['琥珀余辉','Amber Afterglow','温暖的琥珀微粒向上舒展，细短光迹融入深棕色雾光。','浮升微粒 · 琥珀金 · 温暖','Amber particles rise in gentle eddies, leaving delicate trails in warm shadow.'],
 ['雾粉漫游','Pastel Reverie','薰衣草色与杏粉色光雾缓缓交融，少量细尘穿过朦胧的色域。','弥散光雾 · 杏粉紫 · 松弛','Lavender and apricot fields blend slowly as fine dust passes through the haze.'],
 ['香槟轨迹','Champagne Orbits','纤细的香槟金椭圆轨迹交叠，光点沿不同弧度从容游走。','椭圆轨迹 · 香槟金 · 克制','Fine champagne ellipses overlap as light moves calmly along each orbit.']
];
const file=path.join(root,'public/wallpaper-catalog.json'),catalog=JSON.parse(fs.readFileSync(file,'utf8'));
catalog.filter(i=>i.type==='dynamic').forEach((item,i)=>{[item.name,item.en,item.description,item.style,item.descriptionEn]=studies[i];delete item.sceneAsset;delete item.artVersion;delete item.nameEn;item.motionVersion=5;item.renderer='particles';});
for(const file of ['public/wallpaper-catalog.json','skins/tracer/wallpaper-catalog.json','design/wallpaper-studio-v1/catalog.json'])fs.writeFileSync(path.join(root,file),JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync(path.join(root,'design/wallpaper-studio-v1/catalog.js'),"'use strict';\nwindow.WALLPAPERS = "+JSON.stringify(catalog,null,2)+';\n');
fs.writeFileSync(path.join(__dirname,'catalog.js'),'window.DYNAMIC_SCENES = '+JSON.stringify(catalog.filter(i=>i.type==='dynamic'),null,2)+';\n');
