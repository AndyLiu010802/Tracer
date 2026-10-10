'use strict';
// Each row is authored: habitat, diet, silhouette and rig are independent of rarity.
const fishRows=[
// id | Chinese | English | habitat | body | anatomy | marking | colour | accent | cm | diet | motion
['rudd','赤鳍红眼鱼','Rudd','river','round','rounded','scales','#b6ad7f','#c56245',23,'dough','dart'],
['chub','银颊圆腹雅罗','Chub','river','slender','stream','scales','#87968b','#ddd8b6',32,'dough','dart'],
['bream','铜盘欧鳊','Bronze bream','river','discus','disk','scales','#a89b70','#e3cfa1',34,'dough','bob'],
['grasscarp','青背草鱼','Grass carp','river','slender','stream','scales','#728a70','#c7cfaa',48,'dough','sway'],
['zebradanio','斑马鱼','Zebra danio','river','slender','stream','stripe','#6795a0','#ecdfab',6,'prawn','dart'],
['guppy','孔雀花尾鱼','Guppy','river','slender','guppy','spots','#7a92a6','#eeac67',7,'prawn','flutter'],
['platy','日落月光鱼','Sunset platy','river','round','rounded','none','#e19655','#f8db98',8,'dough','bob'],
['rainbowfish','虹带彩虹鱼','Rainbowfish','river','discus','rainbow','stripe','#63a19a','#e3b465',12,'prawn','dart'],
['mosquitofish','溪口食蚊鱼','Mosquitofish','river','slender','stream','spots','#b8b8a0','#dcdac5',6,'prawn','dart'],
['corydoras','花甲鼠鱼','Peppered corydoras','river','round','barbel','saddles','#8b9690','#d6cbb0',9,'prawn','bottom'],
['sprat','碎银西鲱','Sprat','sea','slender','stream','scales','#8ca9ab','#e2e5cd',13,'prawn','dart'],
['sandeel','沙穴玉筋鱼','Sand lance','sea','slender','needle','stripe','#a3b8ae','#e8dfb2',20,'prawn','dart'],
['sergeantmajor','五线雀鲷','Sergeant major','sea','discus','reef','stripe','#a9b685','#e7ca72',17,'prawn','flutter'],
['damselfish','钴蓝雀鲷','Blue damselfish','sea','round','reef','none','#3e89ba','#84d2d9',9,'prawn','dart'],
['blenny','岩穴鳚鱼','Rock blenny','sea','slender','goby','saddles','#ad9270','#d5c9a1',16,'prawn','bottom'],
['capelin','冰海毛鳞鱼','Capelin','ice','slender','salmon','scales','#98b6b7','#d6e4db',19,'prawn','dart'],
['saffroncod','浅金黄线鳕','Saffron cod','ice','slender','cod','freckles','#b2a57d','#e1d8b2',27,'cutbait','sway'],
['copepod','琥珀桡足虾','Amber copepod','deep','shrimp','shrimp','segments','#c9a389','#f2d6b5',4,'prawn','dart'],
['reedmedaka','苇光青鳉','Reedlight medaka','spirit','slender','stream','stripe','#a5c7b2','#eddeb0',6,'lotusmeal','flutter'],
['moongoby','银沙月虾虎','Moon-sand goby','moon','round','goby','spots','#aab8cf','#dfdce9',10,'lotusmeal','bottom'],
['peacockbass','金斑孔雀鲈','Peacock bass','river','predator','perch','saddles','#92a967','#eac36a',46,'cutbait','leap'],
['arapaima','赤鳞巨骨舌鱼','Arapaima','river','predator','arapaima','scales','#718d7d','#d4755d',110,'cutbait','sway'],
['knifefish','银背七星刀','Clown knifefish','river','slender','knife','spots','#8eaaa9','#dce6dc',48,'cutbait','sway'],
['electriccatfish','金纹电鲶','Electric catfish','river','round','barbel','freckles','#a9996c','#ebd793',38,'cutbait','bottom'],
['garfish','翠吻颌针鱼','Needlefish','sea','slender','needle','stripe','#6caaa4','#d2ded1',55,'cutbait','dart'],
['goatfish','红须羊鱼','Red mullet','sea','slender','barbel','stripe','#c97e78','#edc194',25,'prawn','bottom'],
['parrotfish','青玉鹦嘴鱼','Parrotfish','sea','predator','parrot','scales','#53aba1','#dbad96',36,'dough','orbit'],
['moorishidol','镰旗镰鱼','Moorish idol','sea','discus','banner','stripe','#ded4a2','#313e51',24,'prawn','flutter'],
['ribbonwrasse','蓝带清洁鱼','Cleaner wrasse','sea','slender','stream','stripe','#699bc3','#e4e5dc',14,'prawn','dart'],
['dragonetred','赤锦红龙鱼','Ruby dragonet','sea','round','dragonet','maze','#b95345','#9dced1',12,'prawn','flutter'],
['lumpfish','冰蓝圆鳍鱼','Lumpfish','ice','round','lump','scutes','#7398ab','#c3d5d1',32,'prawn','bob'],
['wolffish','灰纹狼鳚','Atlantic wolffish','ice','predator','wolf','saddles','#8899a7','#ccced0',66,'cutbait','sway'],
['hatchetfish','银刃斧头鱼','Silver hatchetfish','deep','discus','hatchet','stars','#8cacc0','#d5eeee',14,'cutbait','flutter'],
['fangtooth','玄齿深渊鱼','Fangtooth','deep','predator','fang','scutes','#675d65','#bcbaad',20,'cutbait','sway'],
['lotusloach','青莲花泥鳅','Lotus loach','spirit','slender','barbel','flowers','#759e86','#e4bfd0',24,'lotusmeal','bottom'],
['stargourami','星点丝足鱼','Star gourami','moon','discus','gourami','stars','#758ead','#d7cde4',24,'lotusmeal','flutter'],
['paddlefish','青铲鲟','Paddlefish','river','predator','paddle','scutes','#7b959e','#cfdad3',95,'prawn','sway'],
['bichir','古甲多鳍鱼','Armored bichir','river','slender','bichir','scutes','#929d72','#d8ca98',54,'cutbait','bottom'],
['weedyseadragon','赤枝草海龙','Weedy seadragon','sea','slender','seadragon','saddles','#ae8958','#deaa75',42,'prawn','sway'],
['batfish','绯唇蝙蝠鱼','Red-lipped batfish','sea','flatfish','batfish','freckles','#a2937a','#c54d4e',30,'prawn','bottom'],
['sunfish','银盘翻车鱼','Ocean sunfish','sea','discus','sunfish','scutes','#8fa4ac','#cbd8d6',115,'prawn','sway'],
['ribbonice','冰绡长鳍鱼','Ice-silk ribbonfish','ice','slender','knife','crystals','#a2cbdb','#ecf7ec',68,'cutbait','sway'],
['dragonfish','赤须黑龙鱼','Black dragonfish','deep','slender','dragonfish','stars','#424e62','#d38686',62,'cutbait','sway'],
['barreleye','琉璃管眼鱼','Barreleye','deep','round','barreleye','none','#749a9b','#c0e9a8',20,'prawn','bob'],
['pearlgourami','莲露珍珠丝足','Lotus pearl gourami','spirit','discus','gourami','beads','#d1bbd2','#e5dac0',35,'lotusmeal','flutter'],
['eclipserayfish','月蚀燕鱼','Eclipse batfish','moon','discus','banner','rings','#766b94','#e6d0ac',58,'lotusmeal','orbit'],
['celestialsturgeon','天枢七星鲟','Celestial sturgeon','moon','predator','sturgeon','stars','#647e9e','#e7cb82',136,'lotusmeal','sway'],
['vermillionarowana','朱砂赤鳞龙','Vermilion arowana','spirit','predator','arapaima','scales','#bb655a','#f1cc8e',128,'lotusmeal','leap'],
['glaciercoelacanth','万年冰腔棘鱼','Glacier coelacanth','ice','predator','coelacanth','crystals','#7295b1','#dcf1e8',148,'cutbait','sway'],
['abyssgulper','幽渊囊颚鳗','Abyss gulper eel','deep','slender','gulper','stars','#52547b','#c6a6d3',155,'cutbait','sway']
];
const fish=fishRows.map((r,i)=>{const [id,zh,en,habitat,body,anatomy,marking,color,accent,baseLength,diet,motion]=r,rarity=i<20?'common':i<36?'rare':i<46?'epic':'legendary';return{id,name:[zh,en],rarity,price:({common:18,rare:72,epic:200,legendary:460})[rarity]+i%7*5,baseLength,color,accent,body,habitat,difficulty:({common:.2,rare:.4,epic:.66,legendary:.85})[rarity],fry:rarity!=='common',expansion:3,anatomy,marking,artVariant:i+50,diet,depth:['bottom','deep'].includes(motion)||habitat==='deep'?'deep':baseLength>55?'deep':baseLength<16?'near':'mid',feedingReaction:{id,name:[zh+'觅食',en+' feeding'],description:[motion==='bottom'?'贴近底床缓行，用胸鳍调整姿态后啄食。':motion==='flutter'?'胸鳍轻振悬停，转身张鳍靠近食物。':'沿身体传递摆尾波，靠近食物时减速转向。',motion==='bottom'?'Settles near the bed and steadies with paired fins before feeding.':'Fin strokes steer a continuous body wave toward the food.'],motion}};});
// 8 common / 9 rare / 8 epic / 4 legendary / 1 secret per collection.
const naruto=[
['iruka','伊鲁卡·忍具','Iruka · Academy','kunai','#536c60','#bac3c1'],
['tenten','天天·双升龙','Tenten · Twin scrolls','scroll','#a04a45','#e7cfaa'],
['shikamaru','鹿丸·影缚','Shikamaru · Shadow bind','shadow','#454b53','#aab7a2'],
['kiba','牙·牙通牙','Kiba · Fang over fang','fang','#786b60','#e6d7be'],
['shino','志乃·寄坏虫','Shino · Insect swarm','swarm','#54606b','#b3ac83'],
['sakura','小樱·樱花冲','Sakura · Cherry impact','impact','#bf718b','#f4cad3'],
['hinata','雏田·双狮拳','Hinata · Twin lions','lion','#8a86b4','#d7e9f3'],
['neji','宁次·回天','Neji · Rotation','rotation','#c7c1b5','#b5e5e6'],
['lee','小李·表莲华','Lee · Front lotus','lotuskick','#437557','#e4b172'],
['temari','手鞠·镰鼬','Temari · Sickle wind','fan','#ddd2b7','#a678af'],
['kankuro','勘九郎·傀儡','Kankuro · Puppet','puppet','#694c62','#c4a277'],
['gaara','我爱罗·砂之手','Gaara · Sand hand','sand','#a67b49','#ead3a1'],
['kakashi','卡卡西·雷切','Kakashi · Lightning blade','lightning','#5b7386','#cfedf3'],
['itachi','鼬·鸦分身','Itachi · Crow clone','raven','#522f39','#df7168'],
['jiraiya','自来也·蛤蟆油炎','Jiraiya · Toad flame','toad','#944c45','#e9ce9b'],
['minato','水门·飞雷神','Minato · Flying thunder','teleport','#c4a149','#fbebb1'],
['naruto','鸣人·螺旋丸','Naruto · Rasengan','rasengan','#e9953f','#91ddeb'],
['sasuke','佐助·须佐之矢','Sasuke · Susanoo','susanoo','#625080','#c3a1ed'],
['hashirama','柱间·木龙','Hashirama · Wood dragon','wooddragon','#697957','#ccb989'],
['sixpaths','鸣人·六道仙人','Naruto · Six Paths','sixpaths','#e4b752','#fff0b8']
];
const onepiece=[
['usopp','乌索普·黑兜','Usopp · Black kabuto','slingshot','#64764c','#d7bb77'],
['chopper','乔巴·刻蹄','Chopper · Hoof print','hoof','#af805f','#e9cdb3'],
['brook','布鲁克·灵魂剑','Brook · Soul solid','soul','#8aacc1','#d7edee'],
['franky','弗兰奇·风来炮','Franky · Coup de vent','cannon','#509eae','#df5551'],
['buggy','巴基·四分五裂','Buggy · Chop chop','split','#ba615c','#e5c78c'],
['nami','娜美·天候棒','Nami · Clima-tact','weather','#d99e4f','#a6dce4'],
['sanji','山治·恶魔风脚','Sanji · Diable jambe','firekick','#393c4a','#f0b46b'],
['robin','罗宾·百花缭乱','Robin · Cien fleur','bloom','#9479a8','#e6b5c8'],
['jinbe','甚平·海流过肩摔','Jinbe · Ocean current','current','#4b98b6','#d0e7d6'],
['smoker','斯摩格·白蔓','Smoker · White snake','smoke','#91a3a3','#e4e9df'],
['vivi','薇薇·孔雀锁链','Vivi · Peacock slasher','peacock','#83c7d4','#e8c17f'],
['zoro','索隆·三刀流','Zoro · Three swords','threesword','#476c52','#d5dfb4'],
['ace','艾斯·炎戒','Ace · Flame command','flame','#c65f31','#ffd08b'],
['sabo','萨博·龙爪拳','Sabo · Dragon claw','dragonclaw','#425d88','#e1ba79'],
['law','罗·ROOM','Law · ROOM','room','#63899f','#d2ebea'],
['hancock','汉库克·芳香脚','Hancock · Perfume femur','stone','#a44460','#efb9c4'],
['luffy','路飞·橡胶手','Luffy · Rubber hand','rubber','#b94e3b','#ecc18c'],
['shanks','香克斯·神避','Shanks · Divine departure','haki','#753e48','#e8c390'],
['whitebeard','白胡子·震震','Whitebeard · Tremor','quake','#a4b6b9','#e3d2a1'],
['nika','路飞·太阳神尼卡','Luffy · Sun god Nika','nika','#e5e2d7','#eab47e']
];
naruto.splice(5,0,
['asuma','阿斯玛·飞燕','Asuma · Flying swallow','chakrablade','#667653','#c0de9c'],
['sai','佐井·超兽伪画','Sai · Ink beasts','inkbird','#3e4850','#d7d3c7'],
['ino','井野·心转身','Ino · Mind transfer','mindthread','#aa7ab0','#eed8ec']);
naruto.splice(14,0,
['choji','丁次·倍化之手','Choji · Expansion','giantpalm','#b76755','#f0c9a6'],
['yamato','大和·木牢','Yamato · Wood prison','woodcage','#707e55','#d9c28d'],
['suigetsu','水月·水化','Suigetsu · Hydrification','waterbody','#91bcc2','#dbf1e9']);
naruto.splice(22,0,
['deidara','迪达拉·黏土飞鸟','Deidara · Clay bird','claybird','#c9bd9e','#fff0c3'],
['konan','小南·式纸之舞','Konan · Paper dance','paper','#8289ad','#e5e6f1'],
['obito','带土·神威','Obito · Kamui','kamui','#b47349','#edd0a3']);
naruto.splice(28,0,['madara','斑·天碍震星','Madara · Shattered heaven','meteor','#7a4856','#adcde7']);
onepiece.splice(5,0,
['perona','佩罗娜·幽灵','Perona · Hollow','ghost','#c980b0','#eee6f1'],
['crocodile','克洛克达尔·沙漠金钩','Crocodile · Desert hook','sandhook','#a69568','#e1c28b'],
['kuma','熊·肉球冲击','Kuma · Paw shock','paw','#5c6672','#e9c0cf']);
onepiece.splice(14,0,
['aokiji','库赞·冰块暴雉嘴','Kuzan · Ice pheasant','icebird','#628bb0','#d5f1f3'],
['kizaru','黄猿·八尺琼勾玉','Kizaru · Light jewels','lightbeads','#bea550','#fff4b5'],
['doflamingo','多弗朗明哥·五色线','Doflamingo · Five strings','strings','#d482a8','#f2d8c0']);
onepiece.splice(22,0,
['enel','艾尼路·雷龙','Enel · Lightning dragon','thunderdragon','#a3bfc9','#fff0bb'],
['katakuri','卡塔库栗·糯团拳','Katakuri · Mochi fist','mochi','#884f61','#e4d2c7'],
['marco','马尔科·不死鸟','Marco · Phoenix','phoenixbird','#499fc2','#f0d877']);
onepiece.splice(28,0,['mihawk','米霍克·黑刀夜','Mihawk · Black blade','blackblade','#433d51','#dcc48c']);
const rods=[...naruto.map(r=>[r,'naruto']),...onepiece.map(r=>[r,'onepiece'])].map(([r,collection],index)=>{const i=index%30,[key,zh,en,action,color,accent]=r,rarity=i<8?'common':i<17?'rare':i<25?'epic':'legendary',hidden=i===29;return{id:'anime_'+key,name:[zh,en],rarity,collection,family:'fantasy',color,accent,barSize:({common:.26,rare:.30,epic:.34,legendary:.38})[rarity],control:({common:1,rare:1.06,epic:1.12,legendary:1.18})[rarity],hidden,animeAction:action,craft:{kind:'anime',detail:action,variant:index,metal:accent,grip:color,pattern:i%6},spell:[action,collection==='naruto'?'忍术':'航海技能'],apparition:{kind:action,duration:1900},effectDescription:[({rubber:'橡胶手臂伸展，五指张开抓住鱼，再回弹收鱼。',nika:'解放之鼓 · 每次咬钩有 20% 概率橡胶手直接收鱼；正常遛鱼时首次断线会回弹救回一次。',sixpaths:'六道协力 · 每竿首次进度耗尽时分身接力，恢复至 35%；正向张力增长减少 20%。'})[action]||zh+' · 蓄势、释放、命中与收势连续衔接。',({rubber:'An extending rubber arm opens its fingers, grips the catch and rebounds.',nika:'Drums of liberation · 20% instant catch; one elastic rescue from line break per cast.',sixpaths:'Six Paths support · one recovery to 35% progress per cast; tension gain reduced by 20%.'})[action]||en+' · anticipation, release, contact and follow-through.'],...(key==='sixpaths'?{progressRescue:.35,tensionMultiplier:.8}:key==='nika'?{instantCatchChance:.20,tensionRescue:.35}:{} )};});
const pools=['naruto','onepiece'].map((id,i)=>({id,name:i?['海贼王鱼竿礼包','ONE PIECE Rod Collection']:['火影忍者鱼竿礼包','NARUTO Rod Collection'],volume:5+i,description:i?['航海角色招式与机关鱼竿，含隐藏款太阳神尼卡。','Character techniques and crafted rods, with a secret Nika rod.']:['忍具、血继与忍术鱼竿，含隐藏款六道仙人。','Ninja tools and techniques, with a secret Six Paths rod.'],price:100,rodIds:rods.filter(r=>r.collection===id&&!r.hidden).map(r=>r.id),hiddenRodId:rods.find(r=>r.collection===id&&r.hidden).id,odds:{common:.545,hidden:.005,rare:.30,epic:.12,legendary:.03}}));
const feedingNotes=["先用赤色胸鳍刹住，向水面的碎屑轻啄。","沿浅流成群穿梭，银颊侧转时闪光。","扁高身体慢慢侧转，用小口吸入团饵。","短促摆尾接近嫩叶，胸鳍展开后悬停取食。","保持小群队形，条纹随快速转向掠过。","扇形花尾缓慢张开，以胸鳍细调进食方向。","圆腹轻轻升沉，短尾维持小幅度巡游。","双背鳍同步竖起，虹色侧线随转身变亮。","贴着水面短距离突进，迅速啄取微小食物。","腹部贴近底床，以短须探查沙粒间的食物。","细密银鳞成群闪动，尾鳍以短行程推进。","从沙面上方掠过，细长身体随尾部形成小波。","五条深纹随扁身侧转，胸鳍连续扇动。","在礁穴附近短距离游弋，遇食后迅速折回。","停驻岩沿，用胸鳍支撑身体再探头取食。","冰水中保持细长的群游队列，脂鳍随水流轻摆。","三段背鳍稳定姿态，下颏须先触及食物。","分节腹部蜷曲一次后弹开，细肢继续划水。","穿过芦根的光斑，尾鳍轻扫后停在水中。","伏在银沙边缘，用扇形胸鳍缓缓调整朝向。","背鳍硬棘先立起，骤然摆尾扑向目标。","厚鳞躯干保持平稳，后置背鳍和臀鳍共同推进。","长臀鳍从前向后传递波浪，身体几乎不摆动。","圆钝头部贴底搜寻，触须随转头扫过沙面。","上下长颌对准猎物，以纤长身体快速突进。","两根下颏须探入沙层，胸鳍托住身体。","厚唇与喙状齿靠近礁面，缓慢刮取食物。","长背鳍飘带落后于转身，胸鳍维持悬停。","沿礁边来回穿行，中央深色条带随身形起伏。","宽大胸鳍像小扇一样撑开，再小步挪向食物。","宽圆腹部靠近岩壁，细小胸鳍连续扇动。","粗壮头部保持稳定，身体后半段轻柔摆动。","银色腹刃缓缓倾斜，扁薄胸鳍控制深水悬停。","小型厚头先朝向食物，显露细长牙齿后闭口。","绕着莲根缓行，短须先触碰下沉的饵粒。","丝状腹鳍缓缓探路，扁高身体保持平稳。","扁平长吻水平伸出，胸鳍微调滑行角度。","一列独立背鳍逐个竖起，厚实胸鳍交替推进。","管状吻对准微小食物，叶状附肢随水流后摆。","用胸鳍末端支在沙上行走，红唇轻啄底部食物。","高背鳍与臀鳍同步摆动，短尾缘轻轻调整方向。","长臀鳍形成连续水波，半透明鳍缘在冰水里舒展。","颏下灯须先摆向食物，细长身体缓慢盘转。","透明头罩中的管状眼朝上，胸鳍维持深水悬停。","珍珠斑点随转身渐亮，两条丝足缓慢垂下探食。","镰状背鳍向后弯出长弧，环纹身体轻柔侧转。","五列骨板沿身体排列，长吻下方的短须探向水底。","后置双鳍推动赤鳞身躯，抬头接住水面的食物。","肉质胸鳍和腹鳍成对交替摆动，三叶尾保持慢速巡游。","囊状下颚缓慢张开，细长尾段连续摆动维持位置。"];
fish.forEach((f,i)=>{f.feedingReaction.description=[feedingNotes[i],f.name[1]+': '+f.feedingReaction.description[1]];f.feedingHabit=f.feedingReaction.description;});
const skillNotes={
  "kunai": [
    "苦无沿抛竿方向翻转，刃尖掠过落点后收势。",
    "A ring-handled kunai turns along the cast and settles at the landing point."
  ],
  "scroll": [
    "双卷轴展开，忍具分批从卷面飞向落点。",
    "Twin scrolls unfurl and launch a staggered volley of ninja tools."
  ],
  "shadow": [
    "影子贴着水面分出支路，在落点合拢后退去。",
    "Branching shadows stretch over the water, converge and withdraw."
  ],
  "fang": [
    "两股旋转突进交错掠过，尖端收束成牙状风轨。",
    "Two rotating rushes cross, tapering into fang-shaped wakes."
  ],
  "swarm": [
    "寄坏虫沿弯曲轨迹聚拢，振翅围住落点后散开。",
    "Winged insects gather along curved paths and disperse after contact."
  ],
  "chakrablade": [
    "双刃交叉回旋，查克拉沿刃口留下短促斩痕。",
    "Twin chakra blades cross with narrow luminous cutting trails."
  ],
  "inkbird": [
    "墨鸟展开分节双翼，振翅飞出后在落点散墨。",
    "An ink bird opens articulated wings and sheds ink at contact."
  ],
  "mindthread": [
    "双手结印，精神光束穿过落点的定位环。",
    "A joined-hand seal sends a mind-transfer beam through a target reticle."
  ],
  "impact": [
    "握拳后加速前送，拳锋触水时绽开短促冲击波。",
    "A closing fist accelerates into a brief water-surface impact."
  ],
  "lion": [
    "双手聚出狮形查克拉，鬃毛随出拳向后拉伸。",
    "Twin chakra lion fists advance with swept-back glowing manes."
  ],
  "rotation": [
    "蓝白查克拉高速回旋，穹形气流随转速舒展。",
    "Blue-white chakra spins into a widening curved guard."
  ],
  "lotuskick": [
    "屈膝起脚，绷带螺旋缠绕后随回身松开。",
    "A rising kick leads into spiraling bandages and a controlled release."
  ],
  "fan": [
    "折扇逐骨展开，挥动时送出分层风刃。",
    "A ribbed fan unfolds and sweeps out layered wind blades."
  ],
  "puppet": [
    "查克拉丝牵动傀儡肘腕，双臂伸出再收回。",
    "Chakra strings articulate a puppet’s elbows and wrists."
  ],
  "giantpalm": [
    "手掌逐渐倍化，五指弯曲后向落点合拢。",
    "An enlarging palm curls its articulated fingers around the target."
  ],
  "woodcage": [
    "木柱错时升起，横梁闭合后随收势沉回水面。",
    "Wooden posts rise in sequence and brace before receding."
  ],
  "waterbody": [
    "半透明水团沿竿尖流出，身体般的水流聚拢再散开。",
    "Translucent fluid lobes merge along the cast, then dissolve."
  ],
  "sand": [
    "砂流从水面抬起，凝成五指砂手并逐指握合。",
    "Rising grains form a five-fingered sand hand that closes progressively."
  ],
  "lightning": [
    "雷光先聚于掌心，随后电刃落下并向水面分叉。",
    "Lightning gathers in a palm before the strike branches across the water."
  ],
  "raven": [
    "鸦群扇动双翼，交错穿过落点后四散收势。",
    "A flock of crows beats its wings, converges and disperses."
  ],
  "toad": [
    "蛤蟆虚影鼓起身躯，张口吐出蜿蜒油炎。",
    "A toad silhouette gathers and releases a wavering flame stream."
  ],
  "teleport": [
    "三叉苦无先行，两处飞雷神印记接续闪现。",
    "A three-pronged kunai leads between two successive teleport marks."
  ],
  "claybird": [
    "黏土鸟舒展双翼，掠向落点后释放一圈冲击。",
    "A clay bird unfolds its wings and releases an impact ring at contact."
  ],
  "paper": [
    "纸片依次折转，汇成向前飞出的式纸轨迹。",
    "Individual sheets fold and turn into a flowing paper formation."
  ],
  "kamui": [
    "暗色空间漩涡向内卷起，外缘逐渐收紧消散。",
    "A dark spatial vortex curls inward and tightens as it fades."
  ],
  "rasengan": [
    "双掌托住旋转查克拉球，交织流线随推进加速。",
    "Two palms cradle a rotating chakra sphere with interwoven currents."
  ],
  "susanoo": [
    "紫色肋骨与巨弓展开，弓弦蓄力回弹并射出光矢。",
    "Violet ribs frame a giant bow whose drawn string releases an arrow."
  ],
  "wooddragon": [
    "木质龙躯逐节前伸，鳞脊、龙角随游龙摆动。",
    "A segmented wooden dragon extends with moving scales and horns."
  ],
  "meteor": [
    "陨石从上方加速坠落，岩面裂纹与尾迹随之显现。",
    "A cracked meteor accelerates downward with a fading tail."
  ],
  "slingshot": [
    "弹弓叉臂撑开，皮筋拉满后回弹发射。",
    "Slingshot arms spread as the drawn elastic releases its projectile."
  ],
  "hoof": [
    "蹄掌前送，分趾蹄印在触水的一刻展开。",
    "A split hoof thrusts forward and leaves a brief impact imprint."
  ],
  "soul": [
    "细剑回旋斩出冷光，冰蓝剑气沿水面散开。",
    "A slender cane sword sweeps a pale chilling wake across the water."
  ],
  "cannon": [
    "炮口先后坐，压缩气流分层推出后逐圈消散。",
    "A recoiling cannon emits expanding rings of compressed air."
  ],
  "split": [
    "分离的手掌旋转飞出，五指握合后退回。",
    "A detached hand turns forward, closes its fingers and retreats."
  ],
  "ghost": [
    "幽灵沿起伏弧线漂浮，尾部拖出柔和透明轮廓。",
    "Floating hollows drift on curved paths with soft trailing tails."
  ],
  "sandhook": [
    "砂流先卷成弧线，金钩随旋转向落点扣下。",
    "A sand current curls ahead of a rotating golden hook."
  ],
  "paw": [
    "肉球掌印前压，掌垫触点推出柔和扩散波。",
    "A paw pad pushes forward and releases an expanding pressure wave."
  ],
  "weather": [
    "云团在落点上方聚集，一道电光劈向水面。",
    "A cloud gathers above the target and discharges a lightning strike."
  ],
  "firekick": [
    "膝踝连续转动，靴尖划出弧形火焰轨迹。",
    "A turning leg and ankle trace an arcing flame kick."
  ],
  "bloom": [
    "六只手在落点周围依次展开，指节同步屈伸。",
    "Six hands bloom around the target and flex their articulated fingers."
  ],
  "current": [
    "厚实水流沿抛投弧线翻卷，浪头在落点打开。",
    "A heavy current rolls through the cast and opens at the landing point."
  ],
  "smoke": [
    "烟团沿轨迹不断聚合，边缘层叠扩散后消隐。",
    "Layered smoke lobes merge along the path and soften into the air."
  ],
  "peacock": [
    "双刃沿锁链弧线转动，交错掠过落点。",
    "Paired peacock blades swing on crossing curved paths."
  ],
  "icebird": [
    "冰雉振翼前冲，透明冷光沿羽缘与尾迹展开。",
    "An ice pheasant beats its wings with frosted feather edges and wake."
  ],
  "lightbeads": [
    "金色光弹错时发射，沿交错弧线抵达落点。",
    "Staggered golden light projectiles converge along alternating arcs."
  ],
  "strings": [
    "五条细线分开牵引，随后并拢划过水面。",
    "Five distinct strands draw together across the water."
  ],
  "threesword": [
    "三道刀锋保持各自角度，交叉完成连续斩击。",
    "Three blades maintain separate angles through a crossing slash."
  ],
  "flame": [
    "火焰先沿轨迹推进，再向外卷出环形炎流。",
    "A flame stream advances and curls outward into a ring."
  ],
  "dragonclaw": [
    "三指龙爪张开，指节前探后向内扣合。",
    "A claw opens, reaches through its articulated joints and closes."
  ],
  "room": [
    "半透明球形领域展开，经纬弧线随收势缩回。",
    "A translucent spherical field opens with meridian arcs, then recedes."
  ],
  "stone": [
    "芳香脚转身踢出，触点散出少量石化碎屑。",
    "A turning perfume kick scatters a small burst of stone fragments."
  ],
  "thunderdragon": [
    "雷龙分节游走，龙角与鳞脊后接分叉电流。",
    "A segmented lightning dragon advances with branching discharges."
  ],
  "mochi": [
    "糯团手臂拖出弹性弧线，厚实拳掌旋转合拢。",
    "A mochi arm stretches into a turning, closing fist."
  ],
  "phoenixbird": [
    "不死鸟拍动双翼，青色火尾随飞行连贯摆动。",
    "A phoenix beats its wings as blue flame follows its flight."
  ],
  "haki": [
    "长刀加速横斩，红黑霸气向外分叉后迅速收束。",
    "A sword sweep releases branching red-black pressure trails."
  ],
  "quake": [
    "薙刀划过触点，震裂纹向四周放射扩展。",
    "A polearm sweep releases radiating quake fractures."
  ],
  "blackblade": [
    "黑刀夜展开十字护手轮廓，锐亮刃线沿长弧斩落。",
    "The black cross-hilt blade sweeps down on a long, sharp arc."
  ]
};
rods.forEach(r=>{if(skillNotes[r.animeAction])r.effectDescription=skillNotes[r.animeAction];});
// Canonical costume colours for the dedicated cel-shaded One Piece models.
const onePiecePalettes={"usopp":["#618b38","#ffd25b"],"chopper":["#f366a7","#63cdf2"],"brook":["#e9f4ff","#62d6f5"],"franky":["#ec4748","#6edafa"],"buggy":["#ee534f","#82d5fa"],"perona":["#ed63aa","#fceaf7"],"crocodile":["#d1a32c","#fff1ac"],"kuma":["#233655","#f6c2da"],"nami":["#35c4e8","#ffc850"],"sanji":["#242944","#ffba46"],"robin":["#8c55b8","#ffbedc"],"jinbe":["#178fd1","#ffa24e"],"smoker":["#dcefe8","#569c9f"],"vivi":["#48d4e8","#fee765"],"aokiji":["#79cdf5","#eefeff"],"kizaru":["#ffcb3d","#fff8b4"],"doflamingo":["#fa6bba","#f9e4e9"],"zoro":["#3d9b58","#e9e4cf"],"ace":["#ff682b","#ffdb55"],"sabo":["#265da8","#ffbe5a"],"law":["#e8c344","#a3eff4"],"hancock":["#de2c69","#fff0c2"],"enel":["#f7c445","#a9e9ff"],"katakuri":["#8d284f","#fff0df"],"marco":["#1ebeea","#ffe367"],"luffy":["#ef3b35","#ffd45b"],"shanks":["#98213e","#f6db8c"],"whitebeard":["#f5eee2","#ffbf56"],"mihawk":["#24243a","#f1cb56"],"nika":["#fdf4e7","#ffca57"]};
for(const r of rods)if(r.collection==='onepiece'){[r.color,r.accent]=onePiecePalettes[r.id.replace('anime_','')];r.craft.grip=r.color;r.craft.metal=r.accent;r.craft.pattern=30;}
const cleanSkillNotes={"usopp":["种子弹带短尾迹飞向落点，命中散出少量碎光。","A seed shot leaves a short trail and a small hit burst."],"chopper":["短促蹄影前冲，命中时出现小范围冲击环。","A compact hoof-like punch ends in a small impact ring."],"brook":["一道冰白斩击掠过落点，剑气迅速散去。","An icy pale slash crosses the target and fades quickly."],"franky":["短光束直击落点，炮击亮芯迅速收束。","A short cannon beam strikes the target and contracts."],"buggy":["白色拳影快速前冲，两道残影随即淡出。","A white punch advances with two brief afterimages."],"perona":["两道淡白气流掠过落点后散去。","Two pale wisps sweep over the target and dissolve."],"crocodile":["短砂流卷过落点，命中散出少量砂点。","A short sand arc ends in a few grains at impact."],"kuma":["带肉球纹的拳影前冲，收成紧凑冲击环。","A paw-marked punch contracts into a compact shock ring."],"nami":["一记短雷击落在咬钩处，电光迅速消退。","A brief lightning strike hits the bite point."],"sanji":["火焰轨迹配合一记弧形踢击，命中后收势。","A flame trail follows a single curved kick."],"robin":["三道小拳影错时连击，命中后迅速淡出。","Three compact punches arrive in staggered succession."],"jinbe":["两道短水弧汇向落点，留下轻薄水环。","Two short water arcs meet in a thin ripple."],"smoker":["短白色气流掠过落点，随后自然散去。","A short white current dissipates at the target."],"vivi":["两道交错斩击短暂展开，随后收束。","Two crossing slashes open briefly and recede."],"aokiji":["三道细窄冰锋前冲，命中散出冷白碎光。","Three narrow ice streaks scatter pale light on impact."],"kizaru":["金色短光束直击落点，亮芯迅速淡出。","A brief golden beam strikes and quickly fades."],"doflamingo":["一道细窄线斩划过落点，留下短促刃光。","A narrow thread slash leaves a brief cutting edge."],"zoro":["三道窄斩击错时交叉，刃光随后收束。","Three narrow slashes cross in quick succession."],"ace":["橙金火焰带短尾迹前冲，命中散出少量火光。","An orange-gold flame streak ends in a compact flare."],"sabo":["三道短爪击交错划过落点，随后淡出。","Three brief claw strikes cross the target."],"law":["小范围 ROOM 光环在落点展开后迅速缩回。","A compact ROOM ring opens at the target and recedes."],"hancock":["粉白斩击短促命中，收成轻薄冲击环。","A pale pink strike ends in a thin impact ring."],"enel":["集中的青白雷击直落水面，电光快速消散。","A concentrated blue-white bolt strikes the water."],"katakuri":["厚实糯团拳影前冲，残影与冲击环随即散去。","A mochi punch leaves brief afterimages and an impact ring."],"marco":["青蓝火焰轨迹前冲，命中留下短促火光。","A blue flame streak ends in a brief flare."],"luffy":["橡胶拳影前冲，命中时收成短促冲击环。","A rubber punch afterimage ends in a compact impact ring."],"shanks":["红黑斩击配合短促霸气裂光，命中后收势。","A red-black slash ends with a brief Haki fracture."],"whitebeard":["一道沉重斩击命中，短裂纹随冲击消退。","A heavy slash creates brief quake cracks at impact."],"mihawk":["一记青白色斩击掠过落点，刃光收束消散。","A single green-white slash contracts and disappears."],"nika":["解放之鼓 · 20% 概率直接上鱼；正常遛鱼首次断线回弹救回。白色拳影短促连击。","Drums of liberation · 20% instant catch; one line-break rescue per cast. Brief white punch afterimages."]};
for(const r of rods)if(r.collection==='onepiece')r.effectDescription=cleanSkillNotes[r.id.replace('anime_','')];
const narutoSkillNotes={
  iruka:['苦无带两道短残影掠向落点，钢刃命中后迅速收势。','A steel kunai crosses the target with two short afterimages.'],
  tenten:['三枚小型忍具错时齐射，刃光在落点汇合后消退。','Three compact ninja tools arrive in a staggered volley.'],
  shikamaru:['细长黑影贴着水面前伸，短暂缚住落点后收回。','A narrow shadow stretches across the water and briefly binds the target.'],
  kiba:['两道灰白螺旋错位突进，牙通牙的风轨在命中后散开。','Two offset white spirals rush forward in a brief Fang Over Fang strike.'],
  shino:['少量寄坏虫沿弧线聚拢，命中后立即散去。','A small controlled insect swarm converges and quickly disperses.'],
  asuma:['两记青蓝查克拉刃交错划过，刀口保留锐亮的短斩痕。','Two blue chakra blade trails cross with sharp, brief cutting edges.'],
  sai:['两道墨鸟剪影前冲，墨翼翻折后化成少量墨点。','Two brush-ink bird silhouettes sweep forward and scatter into a few ink flecks.'],
  ino:['淡紫精神束直达落点，定位光环短暂收束。','A pale violet mind-transfer beam converges on a small target ring.'],
  sakura:['一记有力的拳影前冲，命中时绽开短促冲击环。','One strong punch afterimage ends in a compact impact ring.'],
  hinata:['两道蓝色狮形查克拉拳错位前冲，鬃形边缘随拳势收束。','Twin blue chakra lion fists advance with short, swept-back mane silhouettes.'],
  neji:['三层蓝白查克拉弧高速回旋，半球形气流迅速收回。','Three blue-white chakra arcs rotate into a compact hemispherical guard.'],
  lee:['绷带脚踢出一道短弧，绿衣残影与气流随收势散去。','A bandaged kick follows a short arc with a green-clad afterimage.'],
  temari:['三道薄而锐利的风刃错时横扫，命中后立即消散。','Three thin wind blades sweep across the target in quick succession.'],
  kankuro:['三根查克拉丝牵引一次短斩击，收线后刃光消失。','Three chakra threads pull a brief cutting strike and retract.'],
  choji:['倍化拳影完成一次沉重直击，冲击环迅速消退。','An enlarged fist delivers one heavy blow and a short shock ring.'],
  yamato:['三道有木纹的短木刺前冲，命中后迅速收势。','Three short grained wooden spikes converge and quickly recede.'],
  suigetsu:['一道银蓝斩击拖出液态尾迹，少量水珠随刃光散开。','A silver-blue slash leaves a fluid wake and a few water droplets.'],
  gaara:['砂流贴近落点卷合，颗粒与短冲击环随收势散去。','A compact sand stream curls around the target and sheds a few grains.'],
  kakashi:['集中的青白电刃向前突刺，分叉电流在命中后消退。','A concentrated blue-white Lightning Blade thrust ends in brief branching sparks.'],
  itachi:['三道暗色鸦影错位掠过，羽影与红色眼光一闪即逝。','Three dark crow afterimages pass with fleeting red eyes and feather traces.'],
  jiraiya:['橙金油炎沿短距离喷出，亮芯在命中后收束。','A short orange-gold oil-flame jet contracts to a bright core at impact.'],
  minato:['三叉苦无先行，金色瞬身闪光在落点短暂交汇。','A three-pronged kunai leads a brief golden teleport flash at the target.'],
  deidara:['小型白色黏土鸟俯冲，命中后化成紧凑爆光。','A small ivory clay bird dives into a compact explosion flash.'],
  konan:['五枚带折面的纸刃错位滑行，锐利纸边向落点收拢。','Five folded paper blades glide in staggered paths and converge on the target.'],
  obito:['灰紫空间纹向中心旋缩，暗色涡心短暂显现后消失。','Grey-violet distortion bands spiral into a small dark Kamui vortex.'],
  naruto:['蓝色螺旋丸以三层旋转查克拉前冲，球面高光随转动变化。','A blue Rasengan advances with three rotating chakra bands and spherical highlights.'],
  sasuke:['紫色须佐之矢沿直线射出，箭锋命中后留下短促紫白冲击。','A straight purple Susanoo arrow ends in a brief violet-white impact.'],
  hashirama:['带木纹的短木龙沿弧线前冲，龙首与木质尾迹随收势消退。','A compact wood dragon follows a short arc with a carved head and grained wake.'],
  madara:['一枚棱面陨石短距离斜落，命中时释放集中的沉重冲击。','A single faceted meteor falls a short distance into a focused heavy impact.'],
  sixpaths:['六道协力 · 每竿首次进度耗尽恢复至 35%，张力增长减少 20%；金色螺旋丸配合短暂求道玉残影。','Six Paths support · one recovery to 35% progress per cast; 20% less tension gain. A golden Rasengan with brief dark orb afterimages.']
};
for(const r of rods)if(r.collection==='naruto'){r.effectDescription=narutoSkillNotes[r.id.replace('anime_','')];r.apparition.duration=700;}
const onePieceExpansion=require('./fishing-onepiece-expansion.cjs');
const onePiecePromotedNotes={"buggy":["两道分离飞刀斩先后切入，白色锋线命中后短促消退。","Two separated knife slashes arrive in sequence, with brief white cutting edges."],"crocodile":["弧形沙刃掠过落点，细沙沿斩击尾迹散落。","A sand crescent crosses the catch with a granular wake."],"kuma":["半透明肉球压力波前推，接触时展开压缩空气冲击。","A translucent paw pressure wave expands into a compressed-air impact."],"jinbe":["鱼人空手道水拳前冲，三层水环和水滴随命中散开。","Fish-Man Karate sends a water punch with three pressure rings and scattering droplets."],"doflamingo":["五条锋利细线错时收拢，沿落点切出清晰线斩。","Five fine cutting threads converge in a staggered strike."]};
for(const r of rods)if(r.collection==='onepiece'){
  if(onePieceExpansion.upgrades[r.id.replace('anime_','')]){r.rarity='epic';r.barSize=.34;r.control=1.12;}
  if(onePiecePromotedNotes[r.id.replace('anime_','')])r.effectDescription=onePiecePromotedNotes[r.id.replace('anime_','')];
  r.apparition.duration=700;
}
rods.push(...onePieceExpansion.rods);
const onePiecePool=pools.find(p=>p.id==='onepiece');
onePiecePool.rodIds=rods.filter(r=>r.collection==='onepiece'&&!r.hidden).map(r=>r.id);
onePiecePool.description=['45 款角色鱼竿，历任七武海均为史诗或以上，含隐藏款太阳神尼卡。','45 character rods, with every former Warlord at epic or above and a secret Nika rod.'];
const narutoExpansion=require('./fishing-naruto-expansion.cjs');
rods.push(...narutoExpansion.rods);
const narutoPool=pools.find(p=>p.id==='naruto');
narutoPool.rodIds=rods.filter(r=>r.collection==='naruto'&&!r.hidden).map(r=>r.id);
narutoPool.description=['45 款忍具与忍术鱼竿，含隐藏款六道仙人。','45 ninja tools and techniques, including the secret Six Paths rod.'];
const valorant=require('./fishing-valorant-data.cjs');
rods.push(...valorant.rods);pools.push(valorant.pool);
module.exports={fish,rods,pools};
