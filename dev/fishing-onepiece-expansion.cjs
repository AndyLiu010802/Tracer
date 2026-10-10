'use strict';
// Explicit tiers avoid positional rarity changes when a collection grows.
const upgrades={buggy:'epic',crocodile:'epic',kuma:'epic',jinbe:'epic',doflamingo:'epic'};
const warlords=['mihawk','crocodile','doflamingo','kuma','hancock','jinbe','moria','blackbeard','law','buggy','weevil'];
// key, Chinese, English, tier, action, colour, accent, rigid prop, official reference.
const rows=[
 ['alvida','亚尔丽塔·铁棒','Alvida · Iron mace','common','ironmace','#a64065','#f2c990',true,'Alvida'],
 ['kuro','克洛·猫爪','Kuro · Cat claws','common','catclaw','#303d46','#c6e4e5',true,'Kuro'],
 ['jango','赞高·催眠环','Jango · Hypnotic ring','common','hypnotic','#4b967b','#ebc978',false,'Django'],
 ['wapol','瓦波尔·吞吞','Wapol · Munch munch','common','munch','#71658d','#d7d7bd',false,'Wapol'],
 ['koby','克比·剃','Koby · Shave','rare','shave','#df97ac','#e5f3ef',false,'Coby'],
 ['tashigi','达斯琪·时雨','Tashigi · Shigure','rare','shigure','#396898','#d2edf1',true,'tashigi'],
 ['bartolomeo','巴托洛米奥·屏障','Bartolomeo · Barrier','rare','barrier','#52b99b','#bdf2b3',false,'bartolomeo'],
 ['bellamy','贝拉米·弹簧狙击','Bellamy · Spring snipe','rare','spring','#a46c4d','#e6d295',false,'bellamy'],
 ['moria','莫利亚·影切','Moria · Shadow cut','epic','shadowcut','#544666','#d09dc5',true,'Gecko_Moria'],
 ['weevil','威布尔·薙刀重斩','Weevil · Heavy glaive','epic','heavyglaive','#657793','#efdfa0',true,'Edward_Weevil'],
 ['yamatooni','大和·冰诸斩','Yamato · Ice strike','epic','iceclub','#53959a','#d5f7ee',true,'YAMATO'],
 ['bonney','波妮·扭曲未来','Bonney · Distorted future','epic','futurepunch','#d878a6','#f9d2a3',false,'Jewelry_Bonney'],
 ['blackbeard','黑胡子·暗水','Blackbeard · Black vortex','legendary','darkquake','#3d304e','#c8a0d4',false,'Marshall_D_Teech'],
 ['kaido','凯多·雷鸣八卦','Kaido · Thunder bagua','legendary','thunderbagua','#44415d','#d695d2',true,'Kaido'],
 ['bigmom','玲玲·皇帝剑','Big Mom · Emperor sword','legendary','emperorsword','#b64069','#ffd18e',true,'CharlotteLinlin']
];
const notes={
 alvida:['铁棒重击带出一道短风压，命中时迸出紧凑冲击。','A heavy iron-mace strike ends in a compact shock burst.'],
 kuro:['五道细长爪痕错时交叉，银色刃尖迅速收势。','Five slim claw slashes cross in a quick silver-edged strike.'],
 jango:['催眠环沿短弧旋出，两圈淡金波纹在落点收拢。','A spinning hypnotic ring sends two brief golden ripples.'],
 wapol:['两道钢齿轮廓短暂咬合，金属碎光随冲击散去。','Two steel-jaw contours close briefly with a few metallic sparks.'],
 koby:['剃步残影先行，拳锋沿直线突进后迅速收势。','Shave afterimages lead a quick straight punch.'],
 tashigi:['时雨划出一道冷白斩击，细窄刃光与蓝色尾迹交叠。','Shigure draws a pale slash with a narrow blue trailing edge.'],
 bartolomeo:['半透明绿屏障短暂前推，边缘受击后向内收束。','A translucent green barrier pushes forward and contracts after impact.'],
 bellamy:['弹簧先压缩再回弹，拳影随短促螺旋尾迹射出。','A compressed spring releases a punch with a short coiled wake.'],
 moria:['紫黑影刃交叉剪过落点，蝠形影屑随收势散去。','Purple-black shadow blades cross and shed a few bat-shaped fragments.'],
 weevil:['沉重薙刀斩出宽窄分明的刃弧，命中爆开短风压。','A heavy glaive draws a weighted arc and a short pressure burst.'],
 yamatooni:['冷白冰锋随棒击前冲，少量冰晶沿冲击方向散开。','An icy club strike scatters a few sharp white-blue crystals.'],
 bonney:['粉白拳影由小变大，命中后迅速回收，保留未来变形的节奏。','A pink-white fist grows into a brief impact and quickly contracts.'],
 blackbeard:['暗水涡流短暂吸向落点，随后迸出少量震震裂光。','A dark inward vortex closes at the target, followed by short quake fractures.'],
 kaido:['沉重棒击与紫黑雷痕同时前冲，雷鸣冲击快速收束。','A heavy club impact carries concentrated purple-black lightning.'],
 bigmom:['皇帝剑斩出橙金火刃，刀口亮芯与短火舌一同消退。','An orange-gold Emperor Sword slash leaves a bright edge and short flames.']
};
const rods=rows.map(([key,zh,en,rarity,action,color,accent,weapon,reference],i)=>({id:'anime_'+key,name:[zh,en],rarity,collection:'onepiece',family:'fantasy',color,accent,barSize:({common:.26,rare:.30,epic:.34,legendary:.38})[rarity],control:({common:1,rare:1.06,epic:1.12,legendary:1.18})[rarity],hidden:false,animeAction:action,craft:{kind:'anime',detail:action,variant:60+i,metal:accent,grip:color,pattern:30},spell:[action,'航海技能'],apparition:{kind:action,duration:700},effectDescription:notes[key],collectionRevision:2}));
module.exports={upgrades,warlords,rows,rods,notes};
