'use strict';
// Explicit tiers: new lower-tier tools balance the seven advanced characters.
const rows=[
 ['konohamaru','木叶丸·螺旋丸','Konohamaru · Rasengan','common','smallrasengan','#426998','#aed8ed'],
 ['ebisu','惠比寿·基础忍具','Ebisu · Ninja tools','common','trainingkunai','#384c66','#d5ddd4'],
 ['genma','玄间·千本','Genma · Senbon','common','senbon','#66764d','#e1e3cc'],
 ['izumo','出云·水饴拿原','Izumo · Syrup field','common','syrup','#506d6b','#b5dcd0'],
 ['kurenai','红·魔幻树缚','Kurenai · Tree binding','rare','illusiontree','#953b4a','#e3cfba'],
 ['anko','红豆·潜影蛇手','Anko · Hidden snakes','rare','snakes','#6b5882','#d8c9ac'],
 ['haku','白·魔镜冰晶','Haku · Ice mirrors','rare','icemirrors','#6dabb0','#e4f6ee'],
 ['zabuza','再不斩·斩首大刀','Zabuza · Executioner blade','rare','executioner','#74868b','#d6e0dc'],
 ['kisame','鬼鲛·大鲛弹','Kisame · Great shark','epic','shark','#425c83','#adc8dc'],
 ['hidan','飞段·三月镰','Hidan · Triple scythe','epic','triplescythe','#a72d39','#e1c7ba'],
 ['sasori','蝎·赤秘技','Sasori · Red secret','epic','hundredpuppets','#8d4a3b','#e0bc88'],
 ['tsunade','纲手·怪力','Tsunade · Strength','epic','heavenkick','#42785b','#e9cc91'],
 ['pain','佩恩·神罗天征','Pain · Almighty push','legendary','almightypush','#46384f','#c6a9df'],
 ['tobirama','扉间·水龙弹','Tobirama · Water dragon','legendary','waterdragon','#416c9d','#d6edf4'],
 ['orochimaru','大蛇丸·草薙之剑','Orochimaru · Kusanagi','legendary','kusanagi','#76638a','#e5dbc4']
];
const notes={
 konohamaru:['小型蓝色螺旋丸先聚拢再突进，接触时旋纹散开。','A compact blue Rasengan gathers, advances and releases its spiral.'],
 ebisu:['单枚制式苦无快速掠过，留下短促钢刃残影。','A standard kunai passes with a short steel afterimage.'],
 genma:['三枚千本错时射向落点，银亮针尖迅速收势。','Three staggered senbon converge with fine silver points.'],
 izumo:['青绿色黏液沿水面铺展，再向落点收拢消散。','A blue-green syrup ribbon spreads along the surface and contracts.'],
 kurenai:['树影沿落点合拢，枝条与红色幻术波纹一起散去。','Illusory branches close with brief crimson distortion.'],
 anko:['两条蛇影交错前伸，蛇首到达落点后迅速回收。','Two interwoven snakes strike and withdraw.'],
 haku:['冰镜先合围，再射出交错千本与冷白冰屑。','Ice mirrors form before crossed senbon and white ice shards.'],
 zabuza:['斩首大刀挥出宽阔银刃，冷雾沿刀背短暂拖曳。','The Executioner blade sweeps a broad silver edge through short mist.'],
 kisame:['鲨形水弹扭身前冲，张开的水流在命中后碎成浪花。','A shark-shaped water projectile twists forward and breaks into foam.'],
 hidan:['三月镰划出三道错层红刃，牵引绳随收势拉回。','Three staggered crimson scythe arcs recoil with their tether.'],
 sasori:['傀儡刀臂随查克拉线依次合击，关节残影快速归位。','Articulated puppet blades converge on blue chakra strings.'],
 tsunade:['怪力踢击短促下压，接触时张开集中的石屑冲击。','A forceful heel drop releases a compact cracked-ground impact.'],
 pain:['透明斥力从落点向外推开，灰白压缩环逐层消散。','A transparent repulsive wave expands into fading pressure rings.'],
 tobirama:['青蓝水龙沿短弧盘旋前冲，龙首命中后化成水花。','A blue water dragon curls forward and dissolves into spray.'],
 orochimaru:['草薙剑随白蛇伸展突刺，寒亮剑锋与蛇身连贯回收。','Kusanagi thrusts with an extending white snake and smoothly retracts.']
};
const rods=rows.map(([key,zh,en,rarity,action,color,accent],i)=>({id:'anime_'+key,name:[zh,en],rarity,collection:'naruto',family:'fantasy',color,accent,barSize:({common:.26,rare:.30,epic:.34,legendary:.38})[rarity],control:({common:1,rare:1.06,epic:1.12,legendary:1.18})[rarity],hidden:false,animeAction:action,craft:{kind:'anime',detail:action,variant:75+i,metal:accent,grip:color,pattern:30},spell:[action,'忍术'],apparition:{kind:action,duration:700},effectDescription:notes[key]}));
module.exports={rows,rods,notes};
