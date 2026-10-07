(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerFishingModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var BOX_PRICE = 100, MAX_FISH = 5, MAX_SHOWCASE_FISH = 3, STARTER_BAIT = 30;
  var autoShowcaseStates = new WeakSet(), storedShowcaseStates = new WeakMap(), autoGiftStates=new WeakSet(), autoOpeningStates=new WeakSet();
  var RARITIES = ['common', 'rare', 'epic', 'legendary'];
  var RODS = [
    ['bamboo','竹影初心','Bamboo beginner','common','real','#ae9b62','#47744b',.23,.88],
    ['willow','柳木溪流','Willow creek','common','real','#95734f','#7ead75',.24,.91],
    ['carbon','碳纤维远投','Carbon distance','common','real','#353f4e','#dbad56',.24,.95],
    ['copper','黄铜航海','Brass voyager','common','real','#bd8539','#2b747f',.25,.97],
    ['rosewood','红木匠心','Rosewood craft','common','real','#a05343','#e8ce9e',.25,.94],
    ['tide','潮汐珊瑚','Coral tide','rare','fantasy','#ef9a8c','#56c6d0',.28,1.02],
    ['clockwork','蒸汽齿轮','Clockwork','rare','fantasy','#b7854e','#49b3ad',.29,1.03],
    ['frost','霜晶折光','Frost prism','rare','fantasy','#8fdcf4','#e7f5ff',.29,1.06],
    ['jade','青玉听雨','Jade rain','rare','xianxia','#65bda8','#e6e0b7',.30,1.05],
    ['moon','月轮星纱','Moon silk','epic','fantasy','#bca2e8','#e5d9ff',.33,1.10],
    ['phoenix','赤羽凤鸣','Phoenix feather','epic','xianxia','#ed7751','#f6d77a',.33,1.12],
    ['cloud','云海御风','Cloud wanderer','epic','xianxia','#bde9d3','#83bac6',.34,1.11],
    ['astral','银河织梦','Astral dream','legendary','fantasy','#827bed','#e3c98a',.37,1.16],
    ['dragon','九霄龙吟','Sky dragon','legendary','xianxia','#e2c679','#78d5ad',.37,1.18],
    ['lotus','太虚莲华','Celestial lotus','legendary','xianxia','#e3b7da','#c1eef0',.38,1.17],
    ['guandao','青龙偃月刀','Azure dragon glaive','legendary','xianxia','#176b59','#d9edb6',.37,1.18],
    ['katana','武士刀·居合','Iaido katana','epic','fantasy','#354670','#d4e9ff',.33,1.12],
    ['golden','黄金鱼竿·万金之王','Golden sovereign','legendary','fantasy','#eebd42','#fff0ac',.38,1.18],
    ['walnut','栗木行旅','Chestnut wayfarer','common','real','#88603f','#dac7a0',.24,.94],
    ['porcelain','素瓷青岚','Celadon breeze','common','real','#b6d1cb','#365e65',.25,.95],
    ['citrus','橘庭晴风','Citrus orchard','common','real','#e6a345','#739363',.24,.97],
    ['amber','琥珀松脂','Amber heartwood','rare','fantasy','#c18139','#efd59c',.28,1.03],
    ['vinyl','蓝调唱针','Midnight stylus','rare','fantasy','#35566f','#b2c9d0',.29,1.04],
    ['nautilus','螺旋潮汐','Nautilus tide','rare','fantasy','#b59384','#b4e4df',.29,1.06],
    ['alpine','雪线登峰','Alpine ascent','rare','real','#738f9d','#dce6e7',.30,1.05],
    ['candlewyrm','烛龙照夜','Candlewyrm vigil','epic','xianxia','#843f36','#f0bc71',.33,1.11],
    ['thunderdrum','雷鼓天工','Stormdrum artisan','epic','xianxia','#46697c','#d2be72',.34,1.10],
    ['abysswhale','玄鲸潜渊','Abyssal whale','epic','fantasy','#284963','#76d9da',.33,1.12],
    ['foxfire','枫火狩狐','Maple foxfire','epic','xianxia','#ab5039','#edc780',.34,1.11],
    ['lilybell','铃兰祈愿','Lilybell blessing','epic','fantasy','#75977a','#f0eed5',.33,1.10],
    ['sandscript','沙海时轮','Sandscript hourwheel','epic','fantasy','#a8814c','#e1cf97',.34,1.11],
    ['frostwolf','霜狼逐月','Frostwolf moonchase','epic','fantasy','#7993aa','#d4ecf4',.33,1.12],
    ['rosevow','蔷薇圣契','Rosebound oath','epic','fantasy','#984e67','#e3cb9f',.34,1.10],
    ['inkjudge','墨羽判官','Inkfeather arbiter','epic','xianxia','#384349','#b6d2c6',.33,1.11],
    ['butterfly','琉光蝶梦','Prismatic butterfly','epic','fantasy','#8c79b7','#a6e1e4',.34,1.12],
    ['sunforge','曜日天铸','Solar crucible','legendary','xianxia','#c28b44','#ffe1a0',.37,1.18],
    ['leviathan','沧溟海皇','Leviathan sovereign','legendary','fantasy','#286478','#bbe6e3',.38,1.17],
    ['eclipse','万象归墟','Myriad eclipse','legendary','xianxia','#51476c','#d9cbb3',.38,1.18]
  ].map(function(r){return{id:r[0],name:[r[1],r[2]],rarity:r[3],family:r[4],style:r[0],color:r[5],accent:r[6],barSize:r[7],control:r[8]};});
  // Pool identities and reward lists are permanent receipt contracts. Never
  // derive an old pool from the growing catalog or backfill poolId in old saves.
  var ROD_POOLS=[
    {id:'basic',name:['基础奖池','Base collection'],volume:1,description:['溪岸手作、月轮火羽与青龙神兵，最初的十七份水边惊喜。','Seventeen original discoveries, from riverside craft to moonlight, phoenix fire and dragon-forged arms.'],rodIds:['willow','carbon','copper','rosewood','tide','clockwork','frost','jade','moon','phoenix','cloud','astral','dragon','lotus','guandao','katana'],hiddenRodId:'golden',odds:{common:.545,hidden:.005,rare:.30,epic:.12,legendary:.03}},
    {id:'myriad',name:['万象秘藏','Myriad reliquary'],volume:2,description:['栗木与素瓷启程，十件史诗奇珍各藏一段传说；追寻曜日天铸、沧溟海皇与一款尚未揭晓的秘藏。','Begin with chestnut and celadon, discover ten epic wonders, and seek the Solar Crucible, the Leviathan Sovereign and one unrevealed secret.'],rodIds:['walnut','porcelain','citrus','amber','vinyl','nautilus','alpine','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan'],hiddenRodId:'eclipse',odds:{common:.545,hidden:.005,rare:.30,epic:.12,legendary:.03}}
  ];
  RODS.forEach(function(r){if(ROD_POOLS.some(function(pool){return pool.hiddenRodId===r.id;}))r.hidden=true;if(r.id==='golden')r.saleMultiplier=2;});
  var ROD_EFFECT_NOTES={
    golden:['万金加冕 · 镜面纯金与精细刻纹，起鱼升起旋转金币；所钓鱼售价 ×2','Golden coronation · polished gold and fine engraving, a rising spinning coin on catch; caught fish sell for ×2'],
    jade:['青玉流光 · 收鱼玉龙腾空','Jade shimmer · dragon catch flourish'],
    moon:['月相星纱 · 抛竿弦月流转，收鱼银月辉映','Moon silk · crescent cast, silver moon coronation'],
    phoenix:['赤羽焚空 · 抛竿火羽掠水，收鱼凤凰展翼','Phoenix fire · feather cast, rising phoenix wings'],
    cloud:['御风龙卷 · 风眼凝竿，旋流随线卷起收获','Wind vortex · a rod forged in the eye, spiralling currents lift the catch'],
    astral:['星轨天仪 · 抛竿星芒，收鱼银河星阵','Astral orrery · comet cast, orbiting constellations'],
    dragon:['九霄雷龙 · 抛竿雷光，收鱼金龙腾霄','Thunder dragon · lightning cast, ascending golden dragon'],
    lotus:['太虚莲境 · 抛竿飞瓣，收鱼莲华层层绽放','Celestial bloom · petal cast, unfolding lotus mandala'],
    guandao:['青龙偃月 · 挥刀斩波，收鱼龙印伴青龙盘旋','Azure crescent · glaive sweep, dragon seal and jade coils'],
    katana:['修罗居合 · 锋刃切开虚空，拔刀斩痕沿水面掠过，收鱼以交错刃光断浪','Asura iai · the blade cleaves the void; a drawn cut crosses the water and intersecting blade trails break the wave'],
    walnut:['栗木温润 · 顺直木纹嵌入黄铜套节，手缝皮革握柄留住旅途的温度','Chestnut warmth · straight grain meets fitted brass ferrules and a hand-stitched leather grip'],
    porcelain:['素瓷青岚 · 白瓷靛青纹衔接细银包口，细裂釉沿竿身渐隐，像雨后山色','Celadon breeze · indigo underglaze meets fine silver rims, its porcelain crackle fading like mountains after rain'],
    citrus:['橘庭晴风 · 蜜橘漆面搭配藤编握把，奶白绕线与叶脉护圈点亮晴日','Orchard craft · honey-orange lacquer, a woven rattan grip, cream bindings and leaf-veined fittings catch the afternoon light'],
    amber:['松脂凝光 · 半透明琥珀封存松针，金棕光晕沿温润木节缓缓流转','Resin light · suspended pine needles rest in translucent amber as honey-colored light follows the wood'],
    vinyl:['蓝调唱针 · 黑胶螺纹与拉丝金属相扣，唱针拾起水纹，余音化作低回音环','Midnight groove · vinyl channels meet brushed metal; a stylus lifts ripples into lingering sound rings'],
    nautilus:['螺旋潮汐 · 珍珠母贝顺着海螺曲线包边，虹彩水丝沿壳室回旋','Shell spiral · mother-of-pearl follows a nautilus curve, drawing iridescent currents through its chambers'],
    alpine:['雪线登峰 · 冰灰轻金属与防滑编绳，冰镐式导环映出雪线上的冷光','Summit gear · ice-gray metal, a woven climbing grip and pick-shaped guides hold the light of the snowline'],
    candlewyrm:['烛龙照夜 · 黑漆长脊与朱红透晶护住烛芯，龙息点亮夜幕，烛焰引出绕竿收束的龙影','Night vigil · black lacquer and vermilion crystal shelter the wick; candleflame draws a dragon from the dark to coil around the rod'],
    thunderdrum:['雷鼓天工 · 鼓钉镶入青铜轮毂，雷纹应鼓而起，收鱼时鼓槌击出扩散的电光环','Storm cadence · drum studs seat into bronze hubs; each beat drives branching lightning and a spreading electric ring'],
    abysswhale:['玄鲸潜渊 · 深蓝鲸骨拱起微光鳍脊，水流蓄成鲸影，再破开水面托起收获','Abyssal rise · dim fins trace a deep-blue whalebone arch; currents gather into a whale that lifts the catch through the surface'],
    foxfire:['枫火狩狐 · 漆红狐面嵌着象牙耳弧与鎏金枫叶，狐火贴水疾走，尾焰逐条展旋','Maple hunt · a red-lacquer fox mask carries ivory ear arches and gilt leaves; foxfire runs over water as its tails unfurl in turn'],
    lilybell:['铃兰祈愿 · 白瓷铃花悬于银叶枝梗，摇曳的花铃洒下露光，收鱼时花序逐朵绽开','Lilybell prayer · porcelain bells hang from silver stems, scattering dew-light before opening one flower at a time'],
    sandscript:['沙海时轮 · 黄铜环尺环抱流沙晶窗，沙粒绕刻度逆行，起鱼时转轮重合定格','Desert hourwheel · brass scales encircle a sand-filled crystal; grains run against the markings until the wheels align on the catch'],
    frostwolf:['霜狼逐月 · 冰晶鬃脊咬合银白护柄，狼影踏出碎霜，追月一跃留下弧形冰迹','Moonchase · crystalline fur joins a silver grip; a wolf scatters frost and leaps toward the moon, carving an icy arc'],
    rosevow:['蔷薇圣契 · 黑银荆枝环抱红宝石花心，彩窗翼透出碎光，花瓣旋开后荆棘环逐节扣合','Rosebound oath · black-silver thorns cradle a ruby heart beneath stained-glass wings; petals unfurl and the thorn ring closes joint by joint'],
    inkjudge:['墨羽判官 · 墨玉判笔衔接金刻羽轴与卷轴线轮，墨线落水成判词，飞羽收拢时朱砂印落定','Inkfeather verdict · an ink-jade brush joins gilt quills and a scroll reel; strokes settle on water as closing wings bring down a cinnabar seal'],
    butterfly:['琉光蝶梦 · 虹彩翅脉护住紫晶茧核，蝶翼由根部带动轻颤，丝线结茧后散开细碎鳞光','Prismatic dream · iridescent wing-veins shelter an amethyst cocoon; wings ripple from their roots as silk coils and releases luminous scales'],
    sunforge:['曜日天铸 · 日轮锻锤悬于熔金炉环，锤落迸出细长火星，将收获托进升起的日冕','Solar crucible · a sun-wheel hammer hangs within a molten ring; its strike casts fine sparks and lifts the catch into a rising corona'],
    leviathan:['沧溟海皇 · 潮汐王冠嵌入深海枪脊，巨鳍掀开水幕，海皇虚影携涡流升起','Ocean sovereign · a tidal crown joins an abyssal spear; immense fins part the water as the sovereign rises through a turning current'],
    eclipse:['万象归墟 · 暗晶中悬浮一线蚀光，破碎星环向内归流，再于起鱼瞬间翻转成辉耀新生','Myriad eclipse · a sliver of light hangs inside dark crystal; broken star rings fall inward, then turn outward in a brilliant rebirth']
  };
  RODS.forEach(function(rod){if(ROD_EFFECT_NOTES[rod.id])rod.effectDescription=ROD_EFFECT_NOTES[rod.id];});
  var FISH = [
    ['minnow','银鳞小鱼','Silver minnow','common',8,12,'#97b9c7','#e9f7fa','slender','river'],
    ['crucian','金背鲫鱼','Golden crucian','common',12,24,'#cba66c','#efce8f','round','river'],
    ['carp','红尾鲤鱼','Redtail carp','common',16,42,'#d9ad6c','#ce6c61','round','river'],
    ['perch','斑纹河鲈','Striped perch','common',18,28,'#799984','#d3c68a','round','river'],
    ['trout','虹斑鳟鱼','Rainbow trout','common',24,35,'#a3c4bd','#e896ad','slender','river'],
    ['sardine','蓝脊沙丁','Blue sardine','common',10,18,'#5e9dba','#c4e5e7','slender','sea'],
    ['mackerel','青纹鲭鱼','Jade mackerel','common',22,32,'#588f9f','#bfddd4','slender','sea'],
    ['catfish','胡须鲶鱼','Whiskered catfish','common',28,48,'#6d8999','#b7c7c6','catfish','river'],
    ['koi','丹顶锦鲤','Crowned koi','rare',55,36,'#f4e7ce','#e16c66','koi','river'],
    ['goldfish','流金蝶尾','Golden butterfly','rare',48,20,'#efb95b','#f7da97','fancy','river'],
    ['seahorse','珊瑚海马','Coral seahorse','rare',60,16,'#f39785','#fcc6a8','seahorse','sea'],
    ['angelfish','琉璃神仙鱼','Glass angelfish','rare',65,24,'#a6d8e1','#c6b8ea','angel','sea'],
    ['lantern','灯笼深海鱼','Lantern fish','rare',72,28,'#668aa6','#ffe6a1','angler','deep'],
    ['lotusfin','荷灯灵鲤','Lotus lantern carp','rare',80,30,'#e8b6d6','#96d7ba','koi','spirit'],
    ['moonfin','月光鳍鱼','Moonfin','epic',130,38,'#adb9ef','#e5eaff','fancy','moon'],
    ['crystal','水晶雪鲟','Crystal sturgeon','epic',145,58,'#a3dfee','#f0fbff','slender','ice'],
    ['phoenixfish','朱羽凤尾鱼','Phoenix tail','epic',160,40,'#ee9073','#f5cf7d','fancy','spirit'],
    ['dreamray','星梦鳐鱼','Dream ray','epic',175,50,'#998cd2','#e8d6fb','ray','deep'],
    ['dragonkoi','九霄龙鲤','Celestial dragon koi','legendary',300,72,'#edcf88','#7ac8bb','dragon','spirit'],
    ['galaxywhale','星河幼鲸','Galaxy whale','legendary',360,85,'#7e8dc6','#cfcbf3','whale','moon'],
    ['gulpuffer','噗噜吞月鲀','Moon-Gulp Puffer','legendary',320,44,'#9990bc','#f5df95','gulpuffer','moon'],
    ['grumpangler','皱皱招财鮟','Grumpy Fortune Angler','legendary',330,38,'#78987d','#eac46e','grumpangler','spirit'],
    ['flopray','瘪瘪抱抱鳐','Floppy Hug Ray','legendary',340,62,'#c199ae','#c9eee1','flopray','deep'],
    ['snagglefin','歪牙许愿鳗','Snaggletooth Wish Eel','legendary',350,78,'#668c9e','#edd29a','snagglefin','moon']
  ].map(function(f){var rarity=f[3];return{id:f[0],name:[f[1],f[2]],rarity:rarity,price:f[4],baseLength:f[5],color:f[6],accent:f[7],body:f[8],habitat:f[9],difficulty:[.25,.43,.64,.83][RARITIES.indexOf(rarity)],fry:rarity!=='common'};});
  var FEEDING = [
    ['追逐细粒','Chasing crumbs','成群闪转，接住缓缓下沉的食粒。','Darts with its school after sinking crumbs.','dart'],
    ['水面点头','Surface greetings','轻轻探出金色背鳍，在水面点头。','Nods its golden dorsal fin at the surface.','bob'],
    ['摆尾赴宴','Tail wag feast','摆动红尾，围着食物画一个大圆。','Sweeps a red tail in a broad circle around the food.','orbit'],
    ['潜伏冲刺','Hidden sprint','在石边停一下，再突然冲向食物。','Pauses beside the stones, then sprints to its meal.','dart'],
    ['虹纹跃动','Rainbow leap','跃过一道水光，虹纹闪烁后落回水里。','Leaps through a ripple, flashing its rainbow markings.','leap'],
    ['银光鱼群','Silver schooling','沿着同伴的轨迹，飞快啄食小颗粒。','Follows its companions to nibble tiny morsels.','school'],
    ['绕流巡游','Current patrol','沿水流盘旋，将食物卷进青色涟漪。','Circles with the current around jade ripples.','orbit'],
    ['胡须探食','Whisker search','先用胡须碰触池底，再慢慢吸走食物。','Touches the pond bed with its whiskers before eating.','bottom'],
    ['锦鲤拜访','Koi greeting','抬头讨食，红色冠斑泛起柔柔水光。','Greets you at the surface with a softly glowing red crown.','bob'],
    ['蝶尾旋舞','Butterfly dance','展开金色蝶尾，一边旋转一边啄食。','Fans its golden butterfly tail while twirling to eat.','twirl'],
    ['珊瑚摇摆','Coral sway','卷起小尾巴，竖着身子缓缓摇摆。','Curls its tail and sways upright beside its meal.','sway'],
    ['琉璃扇舞','Glass fan dance','舒展透明长鳍，像小扇子轻轻开合。','Opens and closes translucent fins like little fans.','flutter'],
    ['灯笼引路','Lantern beacon','亮起额前灯笼，把食物引进暖光里。','Lights its lantern to guide the food into a warm glow.','glow'],
    ['荷灯绽放','Lotus lantern bloom','绕着池中荷叶游一圈，点亮粉色花灯。','Circles the lilies and lights a pink lotus glow.','orbit'],
    ['月华轻跃','Moonbeam leap','向水面轻跃，留下一串月白色气泡。','Leaps gently, leaving pearly moonlit bubbles.','leap'],
    ['霜晶潜游','Frost glide','缓缓划过水底，雪白鳍尖散出微光。','Glides over the pond floor with softly shimmering fins.','glide'],
    ['凤尾展翅','Phoenix wings','展开朱红尾羽，掠过食物时留下金色光点。','Spreads vermilion tail feathers through golden specks.','flutter'],
    ['星梦回旋','Dream ray loop','舒展双翼转一个圈，像一片漂浮的星云。','Loops with outstretched wings like a drifting nebula.','twirl'],
    ['龙鲤腾波','Dragon ripple','沿池边腾起又落下，青金色波纹层层散开。','Rises by the pond edge through jade and gold ripples.','leap'],
    ['鲸歌泡泡','Whale song bubbles','慢慢浮近，用一串星光泡泡回应投喂。','Floats close and answers with a stream of starry bubbles.','bubble'],
    ['月泡饱嗝','Moon-bubble burps','鼓起小肚子，慢吞吞吐出几颗发光的月牙泡泡。','Puffs its belly and slowly burps a few glowing crescent bubbles.','bubble'],
    ['摇币讨食','Coin-lure wiggle','摇摇头顶的钱币小灯，皱着脸把食物一口吸走。','Wiggles its coin-shaped lure, then slurps up its food with the same grumpy face.','glow'],
    ['软翼抱饭','A finful of dinner','把两侧软鳍拢成小碗，护住食物慢慢吃。','Cups its soft fins around dinner and takes its time eating.','flutter'],
    ['歪牙许愿','Crooked-tooth wish','绕着食物弯出一个问号，尾尖抖落两三粒星光。','Curves around its food like a question mark, shaking a few sparks of starlight from its tail.','twirl']
  ];
  FISH.forEach(function(f,i){var r=FEEDING[i];f.feedingReaction={id:f.id,name:[r[0],r[1]],description:[r[2],r[3]],motion:r[4]};f.feedingHabit=[r[2],r[3]];});
  var ODD_LEGEND_LORE={
    gulpuffer:['胖肚子里藏着一轮小月亮，吃饱就打出一串月牙嗝。','A little moon glows in its round belly. A good meal brings a string of crescent-shaped burps.'],
    grumpangler:['总像刚被叫醒，头顶的钱币小灯却摇得格外卖力。','Always looks freshly woken up, but its little coin-shaped lure never stops trying.'],
    flopray:['软得像一床小被子，见面就把两片大鳍拢过来。','Soft as a little blanket, it greets you by folding its broad fins into a hug.'],
    snagglefin:['歪着两颗小牙，把没说完的愿望卷成一个问号。','With two crooked little teeth, it curls an unfinished wish into a question mark.']
  };
  FISH.forEach(function(f){if(ODD_LEGEND_LORE[f.id])f.description=ODD_LEGEND_LORE[f.id];});
  // Products are catches, never species: they have no fry, journal entry or aquarium slot.
  var PRODUCTS=[
    {id:'junk',kind:'junk',name:['水中杂物','Waterlogged salvage'],rarity:'common',price:1,baseLength:0,difficulty:.12,fry:false,variants:['boots','broken_watch','trash_bag'],color:'#a2b8ab',accent:'#d4b775'},
    {id:'mystery_bundle',kind:'mystery',name:['神秘大礼包','Mystery bundle'],rarity:'rare',price:0,baseLength:0,difficulty:.32,fry:false,openable:true,color:'#705aa8',accent:'#f0ce82'}
  ];
  var GIFTS=[
    ['tide_crown','avatarFrame','海神潮冠','Tide Sovereign Crown','海蓝珐琅浪冠托起月白珍珠，细金涡线在潮汐间相扣。','Sea-blue enamel waves cradle a pearl between interlocking gold currents.','#4eaeba','#ebd7a1'],
    ['moon_jelly','avatarFrame','月汐水母','Moon-tide Jellyfish','半透琉璃水母环抱月光，细长触须结成柔软的星珠垂链。','Translucent glass jellyfish cradle moonlight in delicate star-beaded tendrils.','#afa7df','#eaf8f0'],
    ['dragon_seal','avatarFrame','游龙玉环','Wandering Dragon Jade','盘龙沿冰润玉璧游走，镂空云纹与鎏金龙须一笔相连。','A coiling dragon follows cool jade, its golden whiskers threading carved clouds.','#5aa98e','#e8d29a'],
    ['sunken_library','background','沉海书庭','Sunken Sea Library','拱窗外是层叠蓝海，旧书、黄铜星仪与微光水草守着安静的书庭。','Blue seas beyond an arched window; old books, a brass orrery and softly glowing plants.','#32798c','#d1ad70'],
    ['cloud_koi_garden','background','云上锦庭','Cloud Koi Garden','青瓷水庭悬在云海之上，金尾锦鲤穿过玉栏与轻柔晨雾。','A celadon water garden above the clouds, with gold-tailed koi and jade balustrades.','#9ccabc','#f0d9ab'],
    ['starlit_harbor','background','星鲸夜港','Starlit Whale Harbor','夜港的黄铜灯映着深蓝海水，一尾星鲸缓缓游过银河。','Brass harbor lights shimmer on indigo water as a star-whale crosses the Milky Way.','#434f89','#f1cc88']
  ].map(function(g){var gift={id:g[0],slot:g[1],name:[g[2],g[3]],description:[g[4],g[5]],theme:g[0],color:g[6],accent:g[7],source:'fishing-mystery',asset:'/fishing-art/gift-'+g[0]+'-v1.png'};if(gift.slot==='avatarFrame')gift.aperture={cx:.5,cy:.5,r:.32};return gift;});
  var DIFFICULTY_PROFILES={
    common:{id:'common',name:['悠游','Gentle drift'],description:['缓慢游动，追踪范围宽，适合放松垂钓。','Slow swimming, a wide tracking zone and forgiving recovery.'],barScale:1.14,gain:.14,fatigue:.17,loss:.048,pressure:.32,pattern:[.5,.64,.5,.35,.5],durations:[2,2,2,2],behaviors:['cruise','cruise','rest','rest']},
    rare:{id:'rare',name:['变速游弋','Changing currents'],description:['短促变向后稍作停留，注意节奏变化。','Short changes of direction followed by pauses.'],barScale:1,gain:.102,fatigue:.12,loss:.057,pressure:.39,pattern:[.5,.71,.44,.30,.5],durations:[1.8,2.1,1.4,2.7],behaviors:['cruise','surge','rest','cruise']},
    epic:{id:'epic',name:['冲刺与回气','Sprint and recover'],description:['强力冲刺后会回气，趁停歇稳稳收线。','Powerful sprints open into recovery windows for steady reeling.'],barScale:.91,gain:.077,fatigue:.091,loss:.07,pressure:.46,pattern:[.5,.77,.28,.34,.5],durations:[2.2,2.5,2,2.3],behaviors:['cruise','surge','rest','rest']},
    legendary:{id:'legendary',name:['传奇搏弈','Legendary dance'],description:['各有盘旋、深潜与折返；变向前会减速，回气时追上。','Distinct coils, dives and returns; each turn slows down before a recovery window.'],barScale:.82,gain:.061,fatigue:.073,loss:.082,pressure:.54,pattern:[.5,.80,.25,.66,.58,.5],durations:[2.1,2.8,2.1,2,1.8],behaviors:['cruise','surge','rest','surge','rest']}
  };
  var LEGENDARY_PATTERNS={
    dragonkoi:{id:'dragon-coil',name:['游龙盘旋','Dragon coil'],pattern:[.5,.8,.25,.66,.58,.5]},
    galaxywhale:{id:'whale-dive',name:['鲸落深潜','Whale dive'],pattern:[.5,.22,.76,.40,.32,.5]},
    gulpuffer:{id:'moon-bounce',name:['吞月弹跳','Moon bounce'],pattern:[.5,.77,.34,.75,.59,.5]},
    grumpangler:{id:'lure-feint',name:['灯饵佯动','Lure feint'],pattern:[.5,.26,.72,.31,.39,.5]},
    flopray:{id:'wing-glide',name:['软翼折返','Wing return'],pattern:[.5,.73,.28,.61,.47,.5]},
    snagglefin:{id:'wish-serpentine',name:['问号蛇行','Serpentine wish'],pattern:[.5,.23,.77,.34,.48,.5]}
  };
  FISH.forEach(function(f){var profile=DIFFICULTY_PROFILES[f.rarity],technique=LEGENDARY_PATTERNS[f.id];f.difficultyProfile=profile.id;f.difficultyDescription=profile.description.slice();if(technique)f.technique={id:technique.id,name:technique.name.slice()};});
  var BAITS = [
    {id:'worm',name:['溪流蚯蚓','River worm'],price:10,quantity:10,color:'#bf8a68',description:['溪流常见鱼，偶遇锦鲤。','River fish and an occasional koi.'],fishIds:['minnow','crucian','carp','perch','trout','catfish','koi']},
    {id:'grain',name:['香谷团饵','Sweet grain'],price:20,quantity:10,color:'#d4b778',description:['鲤鱼、金鱼与荷灯灵鲤。','Carp, goldfish and lotus lantern carp.'],fishIds:['crucian','carp','koi','goldfish','lotusfin']},
    {id:'shrimp',name:['珊瑚鲜虾','Coral shrimp'],price:35,quantity:10,color:'#ecac92',description:['海鱼、海马和琉璃神仙鱼。','Sea fish, seahorses and glass angelfish.'],fishIds:['sardine','mackerel','seahorse','angelfish']},
    {id:'glow',name:['深海荧光饵','Deep glow'],price:45,quantity:10,color:'#b9bcf4',description:['深海灯笼鱼、星梦鳐，偶遇瘪瘪抱抱鳐。','Lantern fish, dream rays and an elusive Floppy Hug Ray.'],fishIds:['sardine','mackerel','lantern','dreamray','flopray']},
    {id:'frost',name:['霜晶虫饵','Frost grub'],price:55,quantity:10,color:'#b9e7ee',description:['冷水鳟鱼与水晶雪鲟。','Cold water trout and crystal sturgeon.'],fishIds:['perch','trout','koi','crystal']},
    {id:'spirit',name:['灵莲丹饵','Spirit lotus'],price:75,quantity:10,color:'#afd8bc',description:['灵鲤、凤尾、龙鲤，也能引来皱皱招财鮟。','Spirit carp, phoenix tails, dragon koi and Grumpy Fortune Anglers.'],fishIds:['carp','lotusfin','phoenixfish','dragonkoi','grumpangler']},
    {id:'stardust',name:['星尘梦饵','Stardust dream'],price:100,quantity:10,color:'#b3a6de',description:['月光鳍、星梦鳐与幼鲸；传说中还有吞月鲀和许愿鳗。','Moonfins, dream rays and whales; legends tell of Moon-Gulp Puffers and Wish Eels.'],fishIds:['trout','moonfin','dreamray','galaxywhale','gulpuffer','snagglefin']}
  ];
  var PONDS = [
    {id:'meadow',name:['溪石小塘','Creekstone pond'],price:0,color:'#91c9bd',accent:'#dbd6bb',style:'meadow'},
    {id:'lily',name:['荷叶庭院','Lily courtyard'],price:160,color:'#a8d3c1',accent:'#e9b8cd',style:'lily'},
    {id:'coral',name:['珊瑚礁池','Coral reef'],price:220,color:'#77cdd8',accent:'#efac95',style:'coral'},
    {id:'crystal',name:['霜晶湖镜','Crystal mirror'],price:280,color:'#b4dcf1',accent:'#dfeaf5',style:'crystal'},
    {id:'moon',name:['月夜星池','Moonlit pool'],price:360,color:'#8c9ed2',accent:'#dfd1eb',style:'moon'},
    {id:'cloud',name:['云海仙塘','Cloud sanctuary'],price:480,color:'#b0dacb',accent:'#e5d5a4',style:'cloud'}
  ];
  // Historical IDs and prices only: old receipts and signed saves still validate.
  var CABINS = [{id:'wood',price:0},{id:'cottage',price:180},{id:'harbor',price:260},{id:'observatory',price:420},{id:'pavilion',price:560}];
  var SOUVENIRS = [{id:'first_catch'},{id:'collector'},{id:'pond_keeper'},{id:'legend'}];
  var AQUARIUM_DECORATIONS = [
    ['water_grass','翡翠水草','Emerald watergrass'],['pebble_garden','溪石小景','River pebbles'],
    ['pearl_shell','月白珍珠贝','Moon pearl shell'],['jade_arch','青玉拱门','Jade arch'],
    ['moon_crystal','月光水晶','Moonlight crystals'],['sunken_chest','沉船宝箱','Sunken treasure'],
    ['glass_observatory','星砂玻璃穹','Star-sand Observatory'],['jade_koi_seal','游鲤玉印','Jade Koi Seal'],
    ['sunken_astrolabe','沉海星盘','Sunken Astrolabe'],['coral_conch','珊瑚螺庭','Coral Conch Garden'],
    ['porcelain_pagoda','青瓷小灯塔','Celadon Lighthouse'],['ribbon_jellyfish','琉璃水母铃','Glass Jellyfish Chime']
  ].map(function(d){return{id:d[0],name:[d[1],d[2]],price:0};});
  PONDS.forEach(function(p){p.price=0;});
  var DECORATIONS = [
    ['tree','田园乔木','Meadow tree','#78976c','#aa8564'],
    ['willow','垂柳','Weeping willow','#8ea676','#c5bf80'],
    ['bush','绣球灌木','Hydrangea bush','#829a76','#d4b4c8'],
    ['flowers','野花花丛','Wildflower patch','#a1ad78','#edcba4'],
    ['reeds','岸边芦苇','Waterside reeds','#a2b181','#ddca95'],
    ['rocks','溪石叠景','Creekstone cluster','#9aab9c','#c8cebd'],
    ['dock','木质小码头','Little wooden dock','#b69b76','#d1bd91'],
    ['lantern','暖光提灯','Warm lantern','#bfaa7d','#f2d99e'],
    ['bench','湖畔长椅','Lakeside bench','#ac9475','#d2c19a'],
    ['basket','藤编渔篮','Woven fishing basket','#bb9e74','#dbc693'],
    ['lilies','浮叶睡莲','Floating water lilies','#829c76','#e8bfcb'],
    ['signpost','手绘木牌','Hand painted signpost','#bba682','#e5d6ad']
  ].map(function(d){return{id:d[0],kind:d[0],name:[d[1],d[2]],price:0,color:d[3],accent:d[4]};});
  var DECORATION_DEFAULTS = {
    meadow:[['tree',-2.18,-1.80,0,.95],['bush',-2.24,.70,0,.70],['flowers',-1.85,1.94,0,.80],['rocks',2.18,-1.56,1,.90],['reeds',2.23,.83,0,.75],['dock',.24,2.16,0,.95],['basket',1.10,2.22,1,.70]],
    lily:[['willow',-2.23,-1.73,0,1.05],['flowers',-2.08,1.69,0,.85],['bench',1.89,1.89,1,.85],['lilies',-.86,.38,0,.65],['lantern',-1.08,2.25,0,.75],['rocks',2.20,-1.41,1,.85]],
    coral:[['tree',-2.16,-1.87,0,.90],['rocks',2.22,-1.52,1,1.05],['dock',.43,2.23,0,1.05],['reeds',-2.20,.48,0,.75],['basket',1.26,2.26,1,.70],['signpost',-1.29,2.20,1,.75]],
    crystal:[['tree',-2.19,-1.96,0,.90],['rocks',2.20,-1.60,1,.95],['lantern',2.26,1.42,0,.80],['reeds',-2.26,.65,0,.65],['bench',.28,2.23,0,.85]],
    moon:[['willow',-2.18,-1.83,0,.98],['lantern',-1.42,2.22,0,.80],['lantern',2.23,1.30,0,.72],['flowers',-2.22,.81,0,.75],['rocks',2.19,-1.59,1,.90],['bench',.40,2.24,0,.85],['lilies',-.92,.48,1,.65]],
    cloud:[['willow',-2.17,-1.82,0,1.00],['flowers',-2.20,.96,0,.78],['bench',.28,2.21,0,.85],['lantern',1.49,2.22,0,.80],['rocks',2.18,-1.48,1,.98],['signpost',-1.35,2.22,0,.75]]
  };
  function defaultPondDecorations(styleId,now){var at=timestamp(now);return(DECORATION_DEFAULTS[styleId]||DECORATION_DEFAULTS.meadow).map(function(d,i){return{id:'decoration_default_'+i,kind:d[0],x:d[1],z:d[2],rotation:d[3],scale:d[4],updatedAt:at};});}
  function decorationRecord(raw,createdAt,layoutAt){
    if(!Array.isArray(raw)||raw.length>16)fail();var ids=new Set();
    return raw.map(function(d){if(!d||!validId(d.id)||ids.has(d.id)||!find(DECORATIONS,d.kind)||!Number.isFinite(d.x)||d.x< -2.65||d.x>2.65||!Number.isFinite(d.z)||d.z< -2.65||d.z>2.65||!Number.isInteger(d.rotation)||d.rotation<0||d.rotation>3||!Number.isFinite(d.scale)||d.scale<.6||d.scale>1.5||!time(d.updatedAt)||d.updatedAt<createdAt||d.updatedAt>layoutAt)fail();ids.add(d.id);return{id:d.id,kind:d.kind,x:d.x,z:d.z,rotation:d.rotation,scale:d.scale,updatedAt:d.updatedAt};});
  }
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function find(rows,id){return rows.find(function(r){return r.id===id;});}
  function itemFor(id){return find(FISH,id)||find(PRODUCTS,id);}
  function catchItem(value){var id=typeof value==='string'?value:value&&value.fishId,item=itemFor(id);if(!item)return null;var result=clone(item);if(value&&value.variant!==undefined)result.variant=value.variant;return result;}
  function fishCatches(state){return state.catches.filter(function(c){return!!find(FISH,c.fishId);});}
  function time(n){return Number.isSafeInteger(n)&&n>=0;}
  function validId(id){return typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);}
  function fail(){throw new Error('Invalid fishing state');}
  function timestamp(now){return time(now)?now:Date.now();}
  function draw(limit){var c=typeof globalThis!=='undefined'&&globalThis.crypto;if(!c&&typeof require==='function')c=require('node:crypto').webcrypto;if(!c)throw new Error('Secure fishing randomness unavailable');var a=new Uint32Array(1),edge=4294967296-4294967296%limit;do{c.getRandomValues(a);}while(a[0]>=edge);return a[0]%limit;}
  var counter=0;
  function uid(prefix,now){return prefix+'_'+timestamp(now).toString(36)+'_'+(++counter).toString(36)+'_'+draw(0x1000000).toString(36);}
  function random(options,limit){var value=options&&options.random?options.random(limit):draw(limit);if(!Number.isInteger(value)||value<0||value>=limit)throw new Error('Invalid fishing random draw');return value;}
  function empty(){return{version:1,updatedAt:0,equippedRodId:'bamboo',equippedBaitId:'worm',equippedCabinId:'wood',boxes:[],casts:[],catches:[],fry:[],ponds:[{id:'pond_starter',styleId:'meadow',createdAt:0,updatedAt:0,archivedAt:null,sealedFishIds:[],decorationLayoutAt:0,decorations:defaultPondDecorations('meadow',0)}],transactions:[]};}
  function validateTransactions(raw){
    if(raw===undefined)return[];
    if(!Array.isArray(raw)||raw.length>50000)fail();var seen=new Set();
    return raw.map(function(t){
      if(!t||!validId(t.id)||seen.has(t.id)||!validId(t.itemId)||!time(t.createdAt)||!Number.isSafeInteger(t.quantity)||t.quantity<1||t.quantity>1000)fail();seen.add(t.id);
      var item,unit;
      if(t.kind==='box'&&t.itemId==='rod_box')unit=-BOX_PRICE;
      else if(t.kind==='bait'&&(item=find(BAITS,t.itemId)))unit=-item.price;
      else if(t.kind==='cabin'&&(item=find(CABINS,t.itemId))&&item.price)unit=-item.price;
      else if(t.kind==='feed'&&t.itemId==='pond_feed')unit=-5;
      else if(t.kind==='sale'&&(item=find(FISH,t.itemId)))unit=item.price*(t.multiplier===2?2:1);
      else if(t.kind==='sale'&&t.itemId==='junk'&&t.multiplier===undefined)unit=1;
      else if(t.kind==='duplicate'&&(item=find(RODS,t.itemId)))unit=[20,40,75,150][RARITIES.indexOf(item.rarity)];
      else if(t.kind==='gift_duplicate'&&find(GIFTS,t.itemId))unit=15;
      else fail();
      if(t.multiplier!==undefined&&(t.kind!=='sale'||t.multiplier!==2))fail();
      if(t.kind!=='bait'&&t.quantity!==1||t.amount!==unit*t.quantity||Math.abs(t.amount)>1000000)fail();
      var out={id:t.id,kind:t.kind,itemId:t.itemId,quantity:t.quantity,amount:t.amount,createdAt:t.createdAt};
      if(t.multiplier!==undefined)out.multiplier=t.multiplier;
      if(t.refId!==undefined){if(!validId(t.refId))fail();out.refId=t.refId;}return out;
    });
  }
  function moneySummary(raw){return validateTransactions(raw).reduce(function(a,t){if(t.amount>0)a.earned+=t.amount;else a.spent-=t.amount;return a;},{earned:0,spent:0});}
  function unlockedSouvenirRows(state){
    var catches=fishCatches(state),species=new Set(catches.map(function(c){return c.fishId;}));
    return SOUVENIRS.filter(function(item){return item.id==='first_catch'?catches.length>0:item.id==='collector'?species.size>=5:item.id==='pond_keeper'?state.ponds.some(function(p){return p.archivedAt!==null;}):catches.some(function(c){return find(FISH,c.fishId).rarity==='legendary';});});
  }
  function defaultShowcase(state){
    var caught=new Set(state.catches.map(function(c){return c.fishId;})),fish=FISH.filter(function(f){return f.rarity==='legendary'&&caught.has(f.id);});
    return{fishIds:fish.slice(0,MAX_SHOWCASE_FISH).map(function(f){return f.id;}),updatedAt:0};
  }
  function showcaseProblem(value,state){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(function(key){return!['fishIds','decorationIds','rodId','souvenirId','updatedAt'].includes(key);})||!Array.isArray(value.fishIds)||value.fishIds.length>MAX_SHOWCASE_FISH||new Set(value.fishIds).size!==value.fishIds.length||Array.from(value.fishIds).some(function(id){return!find(FISH,id);})||value.rodId!==undefined&&!find(RODS,value.rodId)||value.souvenirId!==undefined&&value.souvenirId!==null&&!find(SOUVENIRS,value.souvenirId)||!time(value.updatedAt)||value.updatedAt>state.updatedAt)return'invalid-showcase';
    if(value.decorationIds!==undefined&&(!Array.isArray(value.decorationIds)||value.decorationIds.length>3||new Set(value.decorationIds).size!==value.decorationIds.length||Array.from(value.decorationIds).some(function(id){return!find(AQUARIUM_DECORATIONS,id); })))return'invalid-showcase';
    var caught=new Set(state.catches.map(function(c){return c.fishId;}));
    if(value.fishIds.some(function(id){return!caught.has(id);})||value.rodId!==undefined&&value.rodId!=='bamboo'&&!state.boxes.some(function(b){return b.rodId===value.rodId;})||value.souvenirId!==undefined&&value.souvenirId!==null&&!unlockedSouvenirRows(state).some(function(item){return item.id===value.souvenirId;}))return'showcase-not-unlocked';
    return null;
  }
  function showcaseRecord(value,state){if(showcaseProblem(value,state))fail();var result={fishIds:value.fishIds.slice()};if(value.decorationIds!==undefined)result.decorationIds=value.decorationIds.slice();if(value.rodId!==undefined)result.rodId=value.rodId;if(value.souvenirId!==undefined)result.souvenirId=value.souvenirId;result.updatedAt=value.updatedAt;return result;}
  function validate(raw){
    if(raw===undefined||raw===null)return empty();
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||!time(raw.updatedAt))fail();
    var out=empty();out.updatedAt=raw.updatedAt;out.transactions=validateTransactions(raw.transactions);var tx=new Map(out.transactions.map(function(t){return[t.id,t];}));
    function rows(name,max,check){if(!Array.isArray(raw[name])||raw[name].length>max)fail();var seen=new Set();out[name]=raw[name].map(function(row){if(!row||!validId(row.id)||seen.has(row.id))fail();seen.add(row.id);return check(row);});}
    var owned=new Set(['bamboo']),poolPities=new Map();
    rows('boxes',10000,function(b){var rod=find(RODS,b.rodId),receipt=tx.get(b.id);if(!rod||rod.id==='bamboo'||!receipt||receipt.kind!=='box'||!time(b.openedAt)||typeof b.duplicate!=='boolean'||!Number.isInteger(b.ticket)||b.ticket<0||b.ticket>=10000||b.duplicate!==owned.has(rod.id))fail();
      var poolId=b.poolId===undefined?'basic':b.poolId,pool=find(ROD_POOLS,poolId),counts=poolPities.get(poolId)||{epic:0,legendary:0};if(!pool)fail();
      var tier=b.poolId===undefined?boxRarity(b.ticket,counts.epic,counts.legendary):poolTier(poolId,b.ticket,counts.epic,counts.legendary);
      if(tier==='hidden'?rod.id!==pool.hiddenRodId:rod.hidden||rod.rarity!==tier||!pool.rodIds.includes(rod.id))fail();
      var compensation=out.transactions.find(function(t){return t.kind==='duplicate'&&t.refId===b.id;});if(b.duplicate&&(!compensation||compensation.itemId!==rod.id)||!b.duplicate&&compensation)fail();owned.add(rod.id);
      counts.epic=RARITIES.indexOf(rod.rarity)>=2?0:counts.epic+1;counts.legendary=rod.rarity==='legendary'?0:counts.legendary+1;poolPities.set(poolId,counts);
      var result={id:b.id,rodId:b.rodId,openedAt:b.openedAt,duplicate:b.duplicate,ticket:b.ticket};if(b.poolId!==undefined)result.poolId=poolId;return result;});
    rows('casts',20000,function(c){if(!find(BAITS,c.baitId)||!owned.has(c.rodId)||!time(c.castAt))fail();return{id:c.id,baitId:c.baitId,rodId:c.rodId,castAt:c.castAt};});
    var castMap=new Map(out.casts.map(function(c){return[c.id,c];})),sessions=new Set();
    rows('catches',20000,function(c){
      var cast=castMap.get(c.sessionId),fish=itemFor(c.fishId),product=find(PRODUCTS,c.fishId);
      if(!fish||!cast||sessions.has(c.sessionId)||!product&&!find(BAITS,cast.baitId).fishIds.includes(c.fishId)||!time(c.caughtAt)||c.caughtAt<cast.castAt||!Number.isFinite(c.length)||c.length<fish.baseLength*.7||c.length>fish.baseLength*1.5||!['normal','perfect'].includes(c.quality)||!(c.soldAt===null||time(c.soldAt)&&c.soldAt>=c.caughtAt))fail();
      if(product&&product.kind==='junk'&&!product.variants.includes(c.variant)||(!product||product.kind!=='junk')&&c.variant!==undefined)fail();
      if(product&&product.openable?(c.soldAt!==null||!(c.openedAt===null||time(c.openedAt)&&c.openedAt>=c.caughtAt)):c.openedAt!==undefined)fail();
      sessions.add(c.sessionId);var sales=out.transactions.filter(function(t){return t.kind==='sale'&&t.refId===c.id;}),sold=sales[0],multiplier=product?1:find(RODS,cast.rodId).saleMultiplier||1;
      if(sales.length>1||c.soldAt!==null&&(!sold||sold.itemId!==c.fishId||sold.quantity!==1||(sold.multiplier||1)!==multiplier)||c.soldAt===null&&sold)fail();
      var result={id:c.id,sessionId:c.sessionId,fishId:c.fishId,length:c.length,quality:c.quality,caughtAt:c.caughtAt,soldAt:c.soldAt};if(c.variant!==undefined)result.variant=c.variant;if(c.openedAt!==undefined)result.openedAt=c.openedAt;return result;
    });
    rows('ponds',10000,function(p){var style=find(PONDS,p.styleId);if(!style||!time(p.createdAt)||!time(p.updatedAt)||p.updatedAt<p.createdAt||!(p.archivedAt===null||time(p.archivedAt)&&p.archivedAt>=p.createdAt)||!Array.isArray(p.sealedFishIds)||p.sealedFishIds.some(function(id){return!validId(id);})||new Set(p.sealedFishIds).size!==p.sealedFishIds.length||p.sealedFishIds.length!==(p.archivedAt===null?0:5))fail();var result={id:p.id,styleId:p.styleId,createdAt:p.createdAt,updatedAt:p.updatedAt,archivedAt:p.archivedAt,sealedFishIds:p.sealedFishIds.slice()};
      // Missing optional layout fields remain absent in old signed backups.
      // Read-time defaults provide scenery without changing historical hashes.
      if(p.decorations!==undefined||p.decorationLayoutAt!==undefined){if(!time(p.decorationLayoutAt)||p.decorationLayoutAt<p.createdAt||p.decorationLayoutAt>p.updatedAt)fail();result.decorationLayoutAt=p.decorationLayoutAt;result.decorations=decorationRecord(p.decorations,p.createdAt,p.decorationLayoutAt);}return result;});
    if(!out.ponds.some(function(p){return p.id==='pond_starter';}))fail();var ponds=new Set(out.ponds.map(function(p){return p.id;})),catchMap=new Map(out.catches.map(function(c){return[c.id,c];})),fryCatches=new Set(),counts=new Map();
    rows('fry',20000,function(f){var caught=catchMap.get(f.catchId);if(!caught||!itemFor(caught.fishId).fry||caught.fishId!==f.fishId||fryCatches.has(f.catchId)||!(f.pondId===null||ponds.has(f.pondId))||!time(f.createdAt)||!time(f.updatedAt)||!time(f.growth)||f.growth>100||!(f.fedAt===null||time(f.fedAt))||!(f.releasedAt===null||time(f.releasedAt)&&f.releasedAt>=f.createdAt)||f.releasedAt!==null&&f.pondId!==null)fail();fryCatches.add(f.catchId);if(f.pondId&&f.releasedAt===null){counts.set(f.pondId,(counts.get(f.pondId)||0)+1);if(counts.get(f.pondId)>MAX_FISH)fail();}return{id:f.id,catchId:f.catchId,fishId:f.fishId,pondId:f.pondId,createdAt:f.createdAt,updatedAt:f.updatedAt,growth:f.growth,fedAt:f.fedAt,releasedAt:f.releasedAt};});
    if(out.ponds.filter(function(p){return p.archivedAt===null;}).length!==1)fail();
    out.ponds.forEach(function(p){if(p.archivedAt===null)return;var residents=out.fry.filter(function(f){return f.pondId===p.id&&f.releasedAt===null;}).map(function(f){return f.id;});if(residents.length!==5||residents.some(function(id){return!p.sealedFishIds.includes(id);}))fail();});
    out.catches.forEach(function(c){if(itemFor(c.fishId).fry&&!fryCatches.has(c.id))fail();});
    var baitCounts=inventoryBait(out);Object.keys(baitCounts).forEach(function(id){if(baitCounts[id]<0)fail();});
    if(!owned.has(raw.equippedRodId)||!find(BAITS,raw.equippedBaitId)||!find(CABINS,raw.equippedCabinId)||raw.equippedCabinId!=='wood'&&!out.transactions.some(function(t){return t.kind==='cabin'&&t.itemId===raw.equippedCabinId;}))fail();
    out.equippedRodId=raw.equippedRodId;out.equippedBaitId=raw.equippedBaitId;out.equippedCabinId=raw.equippedCabinId;
    out.transactions.forEach(function(t){if(t.kind==='box'&&!out.boxes.some(function(b){return b.id===t.id;}))fail();if(t.kind==='duplicate'&&!out.boxes.some(function(b){return b.id===t.refId&&b.duplicate&&b.rodId===t.itemId;}))fail();if(t.kind==='sale'&&!out.catches.some(function(c){return c.id===t.refId&&c.soldAt!==null;}))fail();if(t.kind==='feed'&&!ponds.has(t.refId)&&t.refId!=='aquarium')fail();});
    // Keep the optional selection absent in old saves so signed backup hashes stay valid.
    if(raw.showcase!==undefined)out.showcase=showcaseRecord(raw.showcase,out);
    if(raw.aquarium!==undefined){
      var tank=raw.aquarium;
      if(!tank||typeof tank!=='object'||Array.isArray(tank)||Object.keys(tank).some(function(k){return!['fryIds','updatedAt'].includes(k);})||!Array.isArray(tank.fryIds)||tank.fryIds.length>MAX_SHOWCASE_FISH||new Set(tank.fryIds).size!==tank.fryIds.length||!time(tank.updatedAt)||tank.updatedAt>out.updatedAt||Array.from(tank.fryIds).some(function(id){var f=find(out.fry,id);return!f||f.releasedAt!==null||f.pondId!==null||find(FISH,f.fishId).rarity!=='legendary';}))fail();
      out.aquarium={fryIds:tank.fryIds.slice(),updatedAt:tank.updatedAt};
    }
    var unlocked=new Set();
    if(raw.mysteryOpenings!==undefined){
      var giftCatches=new Set();
      rows('mysteryOpenings',20000,function(o){
        var caught=catchMap.get(o.catchId),gift=find(GIFTS,o.giftId),compensations=out.transactions.filter(function(t){return t.kind==='gift_duplicate'&&t.refId===o.id;}),comp=compensations[0];
        if(!caught||caught.fishId!=='mystery_bundle'||!gift||o.id!=='gift_'+caught.id||giftCatches.has(o.catchId)||!time(o.openedAt)||o.openedAt!==caught.openedAt||o.openedAt>out.updatedAt||typeof o.duplicate!=='boolean'||o.duplicate!==unlocked.has(o.giftId)||compensations.length>1||o.duplicate&&(!comp||comp.id!==giftCompensation(o).id||comp.itemId!==o.giftId||comp.createdAt!==o.openedAt)||!o.duplicate&&comp)fail();
        giftCatches.add(o.catchId);unlocked.add(o.giftId);return{id:o.id,catchId:o.catchId,giftId:o.giftId,openedAt:o.openedAt,duplicate:o.duplicate};
      });
    }
    out.catches.forEach(function(c){if(c.fishId==='mystery_bundle'&&c.openedAt!==null&&!(out.mysteryOpenings||[]).some(function(o){return o.catchId===c.id;}))fail();});
    out.transactions.forEach(function(t){if(t.kind==='gift_duplicate'&&!(out.mysteryOpenings||[]).some(function(o){return o.id===t.refId&&o.duplicate&&o.giftId===t.itemId;}))fail();});
    if(raw.giftAppearance!==undefined){
      var appearance=raw.giftAppearance;
      if(!appearance||typeof appearance!=='object'||Array.isArray(appearance)||Object.keys(appearance).some(function(k){return!['avatarFrameId','backgroundId','updatedAt'].includes(k);})||!time(appearance.updatedAt)||appearance.updatedAt>out.updatedAt)fail();
      ['avatarFrame','background'].forEach(function(slot){var id=appearance[slot+'Id'],gift=find(GIFTS,id);if(id!==null&&(!gift||gift.slot!==slot||!unlocked.has(id)))fail();});
      out.giftAppearance={avatarFrameId:appearance.avatarFrameId,backgroundId:appearance.backgroundId,updatedAt:appearance.updatedAt};
    }
    return out;
  }
  function inventoryBait(state){var result={};BAITS.forEach(function(b){result[b.id]=b.id==='worm'?STARTER_BAIT:0;});state.transactions.forEach(function(t){if(t.kind==='bait')result[t.itemId]+=t.quantity*find(BAITS,t.itemId).quantity;});state.casts.forEach(function(c){result[c.baitId]--;});return result;}
  function read(ws){var state=validate(ws&&ws.fishing);state.rods=['bamboo'].concat(state.boxes.map(function(b){return b.rodId;})).filter(function(id,i,a){return a.indexOf(id)===i;});state.baits=inventoryBait(state);state.ponds.forEach(function(p){p.fishIds=state.fry.filter(function(f){return f.pondId===p.id&&f.releasedAt===null;}).map(function(f){return f.id;});if(p.decorations===undefined){p.decorationLayoutAt=p.createdAt;p.decorations=defaultPondDecorations(p.styleId,p.createdAt);}});state.activePondId=state.ponds.find(function(p){return p.archivedAt===null;}).id;state.pity=pity(state);if(state.showcase===undefined){state.showcase=defaultShowcase(state);autoShowcaseStates.add(state);}else{storedShowcaseStates.set(state,state.showcase);state.showcase={fishIds:state.showcase.fishIds.filter(function(id){return find(FISH,id).rarity==='legendary';}),updatedAt:state.showcase.updatedAt};var stored=storedShowcaseStates.get(state);if(stored.decorationIds!==undefined)state.showcase.decorationIds=stored.decorationIds.slice();}if(state.mysteryOpenings===undefined){state.mysteryOpenings=[];autoOpeningStates.add(state);}state.giftUnlocks=GIFTS.filter(function(g){return state.mysteryOpenings.some(function(o){return o.giftId===g.id;});}).map(clone);if(state.giftAppearance===undefined){state.giftAppearance={avatarFrameId:null,backgroundId:null,updatedAt:0};autoGiftStates.add(state);}return state;}
  function showcase(ws){
    var state=read(ws),selection=state.showcase;
    var result={fish:selection.fishIds.map(function(id){return clone(find(FISH,id));}),stats:{catches:fishCatches(state).length,species:new Set(fishCatches(state).map(function(c){return c.fishId;})).size,ponds:state.ponds.filter(function(p){return p.archivedAt!==null;}).length},selection:{fishIds:selection.fishIds.slice()}};if(selection.decorationIds!==undefined)result.selection.decorationIds=selection.decorationIds.slice();return result;
  }
  function setShowcase(ws,patch,now){
    if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(function(key){return!['fishIds','decorationIds'].includes(key);}))return{ok:false,reason:'invalid-showcase'};
    var state=read(ws),at=Math.max(timestamp(now),state.updatedAt+1,state.showcase.updatedAt+1),next=Object.assign({},state.showcase,patch,{updatedAt:at});state.updatedAt=at;
    var problem=showcaseProblem(next,state);if(problem)return{ok:false,reason:problem};
    if(next.fishIds.some(function(id){return find(FISH,id).rarity!=='legendary';}))return{ok:false,reason:'showcase-not-legendary'};
    var stored=storedShowcaseStates.get(state),same=stored&&JSON.stringify(next.fishIds)===JSON.stringify(stored.fishIds)&&JSON.stringify(next.decorationIds)===JSON.stringify(stored.decorationIds)&&stored.rodId===undefined&&stored.souvenirId===undefined;
    if(!Object.keys(patch).length||same&&!autoShowcaseStates.has(state))return{ok:true,changed:false,spent:0,showcase:showcase(ws)};
    state.showcase=showcaseRecord(next,state);autoShowcaseStates.delete(state);storedShowcaseStates.delete(state);save(ws,state,at);return{ok:true,changed:true,spent:0,showcase:showcase(ws)};
  }
  function aquarium(ws){
    var state=read(ws),value=showcase(ws),ids=state.aquarium?state.aquarium.fryIds:[];
    value.fish=ids.map(function(id){var f=find(state.fry,id);return Object.assign({},clone(find(FISH,f.fishId)),clone(f),{speciesId:f.fishId});});
    value.selection.fishIds=value.fish.map(function(f){return f.fishId;});value.selection.fryIds=ids.slice();return value;
  }
  function placeAquariumFish(ws,fryId,present,now){
    var state=read(ws),fry=find(state.fry,fryId),ids=state.aquarium?state.aquarium.fryIds.slice():[];
    if(!fry)return{ok:false,reason:'unknown-fry'};if(fry.releasedAt!==null)return{ok:false,reason:'fish-released'};
    if(find(FISH,fry.fishId).rarity!=='legendary')return{ok:false,reason:'showcase-not-legendary'};
    if(typeof present!=='boolean')return{ok:false,reason:'invalid-showcase'};
    if(ids.includes(fryId)===present)return{ok:true,changed:false};
    if(present&&ids.length>=MAX_SHOWCASE_FISH)return{ok:false,reason:'aquarium-full'};
    var pond=find(state.ponds,fry.pondId);if(present&&pond&&pond.archivedAt!==null)return{ok:false,reason:'pond-archived'};
    var at=Math.max(timestamp(now),state.updatedAt+1,fry.updatedAt+1,state.aquarium?state.aquarium.updatedAt+1:0);
    if(present){ids.push(fryId);fry.pondId=null;fry.updatedAt=at;}else ids=ids.filter(function(id){return id!==fryId;});
    state.aquarium={fryIds:ids,updatedAt:at};save(ws,state,at);return{ok:true,changed:true,spent:0,fryId:fryId};
  }
  function feedAquarium(ws,now){
    var state=read(ws),ids=state.aquarium?state.aquarium.fryIds:[],at=Math.max(timestamp(now),state.updatedAt+1),fish=state.fry.filter(function(f){return ids.includes(f.id)&&(f.fedAt===null||at-f.fedAt>=60000);});
    if(!fish.length)return{ok:false,reason:'no-hungry-fish'};if(economy(ws).balance<5)return{ok:false,reason:'insufficient-coins'};
    receipt(state,'feed','pond_feed',1,at,'aquarium');fish.forEach(function(f){f.growth=Math.min(100,f.growth+20);f.fedAt=at;f.updatedAt=at;});save(ws,state,at);
    return{ok:true,spent:5,fed:fish.length,fishIds:fish.map(function(f){return f.id;}),reactions:fish.map(function(f){return{id:f.id,fishId:f.fishId,reaction:clone(find(FISH,f.fishId).feedingReaction)};})};
  }
  function gardenApi(){return typeof require==='function'?require('./task-garden'):typeof globalThis!=='undefined'&&globalThis.TaskGarden;}
  function economy(ws){var garden=gardenApi();if(garden)return garden.economy(ws);var sums=moneySummary(read(ws).transactions);return{earned:sums.earned,spent:sums.spent,balance:sums.earned-sums.spent};}
  function ensure(ws){ws.fishing=validate(ws.fishing);syncMoney(ws);return read(ws);}
  function syncMoney(ws){var garden=gardenApi();if(!garden)return;var g=garden.read(ws);g.market.fishingTransactions=clone(ws.fishing.transactions);ws.taskGarden=garden.validate(g);}
  function save(ws,state,now){if(autoOpeningStates.has(state))delete state.mysteryOpenings;if(autoGiftStates.has(state))delete state.giftAppearance;if(autoShowcaseStates.has(state))delete state.showcase;else if(storedShowcaseStates.has(state))state.showcase=storedShowcaseStates.get(state);state.updatedAt=Math.max(timestamp(now),state.showcase?state.showcase.updatedAt:0,state.aquarium?state.aquarium.updatedAt:0,state.giftAppearance?state.giftAppearance.updatedAt:0,state.updatedAt);ws.fishing=validate(state);syncMoney(ws);return read(ws);}
  function receipt(state,kind,itemId,quantity,now,refId,id){var units={box:BOX_PRICE,feed:5};var item=kind==='bait'?find(BAITS,itemId):kind==='sale'?itemFor(itemId):kind==='duplicate'?find(RODS,itemId):null;var amount=kind==='duplicate'?[20,40,75,150][RARITIES.indexOf(item.rarity)]:kind==='sale'?item.price:-(units[kind]||item.price||90);var t={id:id||uid('ftx',now),kind:kind,itemId:itemId,quantity:quantity,amount:amount*quantity,createdAt:timestamp(now)};if(refId)t.refId=refId;if(kind==='sale'){var caught=state.catches.find(function(c){return c.id===refId;}),value=catchValue(state,caught);t.amount=value;if(value!==item.price)t.multiplier=value/item.price;}state.transactions.push(t);return t;}
  function pity(state,poolId){poolId=poolId||'basic';var epic=0,legendary=0;state.boxes.filter(function(b){return(b.poolId||'basic')===poolId;}).forEach(function(b){var rarity=find(RODS,b.rodId).rarity;epic=RARITIES.indexOf(rarity)>=2?0:epic+1;legendary=rarity==='legendary'?0:legendary+1;});return{epic:epic,legendary:legendary,epicRemaining:10-epic,legendaryRemaining:40-legendary};}
  function boxRarity(ticket,epic,legendary){if(legendary>=39)return'legendary';var rarity=ticket<5500?'common':ticket<8500?'rare':ticket<9700?'epic':'legendary';return epic>=9&&RARITIES.indexOf(rarity)<2?'epic':rarity;}
  function poolTier(poolId,ticket,epic,legendary){
    var pool=find(ROD_POOLS,poolId);if(!pool||!Number.isInteger(ticket)||ticket<0||ticket>=10000)return null;
    var edge=0,tier;Object.keys(pool.odds).some(function(key){edge+=Math.round(pool.odds[key]*10000);if(ticket<edge){tier=key;return true;}return false;});
    // Secrets are a fixed 50 / 10000 tickets, including on guarantee draws.
    if(tier==='hidden')return tier;if(legendary>=39)return'legendary';return epic>=9&&RARITIES.indexOf(tier)<2?'epic':tier;
  }
  function buyBox(ws,options){
    if(typeof options==='number')options={now:options};options=options||{};
    var pool=find(ROD_POOLS,options.poolId===undefined?'basic':options.poolId);if(!pool)return{ok:false,reason:'unknown-pool'};
    if(economy(ws).balance<BOX_PRICE)return{ok:false,reason:'insufficient-coins'};
    var state=read(ws),counts=pity(state,pool.id),ticket=random(options,10000),tier=poolTier(pool.id,ticket,counts.epic,counts.legendary),rewards=RODS.filter(function(r){return pool.rodIds.includes(r.id)&&r.rarity===tier;}),unowned=rewards.filter(function(r){return!state.rods.includes(r.id);}),choices=unowned.length?unowned:rewards,rod=tier==='hidden'?find(RODS,pool.hiddenRodId):choices[random(options,choices.length)],duplicate=state.rods.includes(rod.id),id=uid('box',options.now);
    receipt(state,'box','rod_box',1,options.now,null,id);state.boxes.push({id:id,rodId:rod.id,openedAt:timestamp(options.now),duplicate:duplicate,ticket:ticket,poolId:pool.id});
    var compensation=duplicate?receipt(state,'duplicate',rod.id,1,options.now,id).amount:0;save(ws,state,options.now);
    return{ok:true,rod:clone(rod),poolId:pool.id,hidden:tier==='hidden',duplicate:duplicate,compensation:compensation,spent:BOX_PRICE,pity:pity(state,pool.id)};
  }
  // Value belongs to the committed cast, never to the currently equipped rod.
  function catchValue(state,caught){if(!caught)return 0;if(caught.fishId==='junk')return 1;var fish=find(FISH,caught.fishId),cast=state.casts.find(function(c){return c.id===caught.sessionId;}),rod=cast&&find(RODS,cast.rodId);return fish?fish.price*(rod&&rod.saleMultiplier||1):0;}
  function buyBait(ws,baitId,quantity,now){quantity=quantity===undefined?1:quantity;var bait=find(BAITS,baitId);if(!bait)return{ok:false,reason:'unknown-bait'};if(!Number.isInteger(quantity)||quantity<1||quantity>100)return{ok:false,reason:'invalid-quantity'};if(economy(ws).balance<bait.price*quantity)return{ok:false,reason:'insufficient-coins'};var state=read(ws);receipt(state,'bait',baitId,quantity,now);save(ws,state,now);return{ok:true,quantity:bait.quantity*quantity,spent:bait.price*quantity};}
  function equip(ws,kind,itemId,now){var state=read(ws),key=kind==='rod'?'equippedRodId':'equippedBaitId';var owns=kind==='rod'?state.rods.includes(itemId):!!find(BAITS,itemId)&&state.baits[itemId]>0;if(!owns)return{ok:false,reason:'not-owned'};state[key]=itemId;save(ws,state,now);return{ok:true,itemId:itemId};}
  function selectPondStyle(ws,pondId,styleId,now){var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;});if(!pond)return{ok:false,reason:'unknown-pond'};if(pond.archivedAt!==null)return{ok:false,reason:'pond-archived'};if(!find(PONDS,styleId))return{ok:false,reason:'unknown-style'};var at=Math.max(timestamp(now),pond.updatedAt+1),defaults=defaultPondDecorations(pond.styleId,0),unchanged=pond.decorations.length===defaults.length&&pond.decorations.every(function(d,i){return['id','kind','x','z','rotation','scale'].every(function(key){return d[key]===defaults[i][key];});});pond.styleId=styleId;pond.updatedAt=at;if(unchanged){pond.decorations=defaultPondDecorations(styleId,at);pond.decorationLayoutAt=at;}save(ws,state,at);return{ok:true,spent:0,pondId:pondId};}
  function decorationTime(pond,now){return Math.max(timestamp(now),pond.updatedAt+1,pond.decorationLayoutAt+1,pond.createdAt);}
  function setPondDecoration(ws,pondId,patch,now){
    var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;});if(!pond)return{ok:false,reason:'unknown-pond'};
    if(!patch||typeof patch!=='object'||Array.isArray(patch)||patch.id!==undefined&&!validId(patch.id)||patch.remove!==undefined&&typeof patch.remove!=='boolean')return{ok:false,reason:'invalid-decoration'};
    var index=patch.id===undefined?-1:pond.decorations.findIndex(function(d){return d.id===patch.id;}),old=index<0?null:pond.decorations[index];
    if(patch.remove&&index<0)return{ok:true,changed:false,spent:0};
    if(!patch.remove&&!old&&pond.decorations.length>=16)return{ok:false,reason:'decoration-limit'};
    var at=decorationTime(pond,now),decoration;
    if(patch.remove)pond.decorations.splice(index,1);
    else{
      decoration=Object.assign({id:patch.id||uid('decoration',at),kind:patch.kind,x:2.20,z:1.80,rotation:0,scale:1},old||{});
      ['kind','x','z','rotation','scale'].forEach(function(key){if(patch[key]!==undefined)decoration[key]=patch[key];});decoration.updatedAt=at;
      try{decoration=decorationRecord([decoration],pond.createdAt,at)[0];}catch(error){return{ok:false,reason:'invalid-decoration'};}
      if(index<0)pond.decorations.push(decoration);else pond.decorations[index]=decoration;
    }
    pond.decorationLayoutAt=at;pond.updatedAt=at;save(ws,state,at);return{ok:true,changed:true,spent:0,decoration:decoration&&clone(decoration)};
  }
  function resetPondDecorations(ws,pondId,now){var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;});if(!pond)return{ok:false,reason:'unknown-pond'};var at=decorationTime(pond,now);pond.decorations=defaultPondDecorations(pond.styleId,at);pond.decorationLayoutAt=at;pond.updatedAt=at;save(ws,state,at);return{ok:true,spent:0};}
  function releaseFish(ws,fryId,now){var state=read(ws),fry=state.fry.find(function(f){return f.id===fryId;});if(!fry)return{ok:false,reason:'unknown-fry'};if(fry.releasedAt!==null)return{ok:true,alreadyReleased:true};var pond=state.ponds.find(function(p){return p.id===fry.pondId;});if(pond&&pond.archivedAt!==null)return{ok:false,reason:'pond-archived'};if(state.aquarium&&state.aquarium.fryIds.includes(fryId)){state.aquarium.fryIds=state.aquarium.fryIds.filter(function(id){return id!==fryId;});state.aquarium.updatedAt=Math.max(timestamp(now),state.updatedAt+1);}fry.releasedAt=Math.max(timestamp(now),fry.createdAt);fry.pondId=null;fry.updatedAt=fry.releasedAt;save(ws,state,Math.max(timestamp(now),state.aquarium?state.aquarium.updatedAt:0));return{ok:true,fishId:fry.fishId,fryId:fry.id};}
  function nextPondId(id){var hash=2166136261;for(var i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);return'pond_after_'+(hash>>>0).toString(36);}
  function archivePond(ws,pondId,now){var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;});if(!pond)return{ok:false,reason:'unknown-pond'};if(pond.archivedAt!==null)return{ok:true,alreadyArchived:true,pondId:pondId,activePondId:state.activePondId};if(pond.fishIds.length!==5)return{ok:false,reason:'requires-five-fish'};if(state.ponds.length>=10000)return{ok:false,reason:'pond-limit'};var at=Math.max(timestamp(now),pond.updatedAt,pond.createdAt),id=nextPondId(pond.id);if(state.ponds.some(function(p){return p.id===id;}))return{ok:false,reason:'pond-id-conflict'};pond.archivedAt=at;pond.updatedAt=at;pond.sealedFishIds=pond.fishIds.slice();state.ponds.push({id:id,styleId:'meadow',createdAt:at,updatedAt:at,archivedAt:null,sealedFishIds:[],decorationLayoutAt:at,decorations:defaultPondDecorations('meadow',at)});save(ws,state,at);return{ok:true,pondId:pondId,activePondId:id,spent:0};}
  function placeFry(ws,fryId,pondId,now){var state=read(ws),fry=state.fry.find(function(f){return f.id===fryId;}),pond=state.ponds.find(function(p){return p.id===pondId;});if(!fry)return{ok:false,reason:'unknown-fry'};if(fry.releasedAt!==null)return{ok:false,reason:'fish-released'};if(pondId!==null&&!pond)return{ok:false,reason:'unknown-pond'};if(state.aquarium&&state.aquarium.fryIds.includes(fryId))return{ok:false,reason:'fish-in-aquarium'};var oldPond=state.ponds.find(function(p){return p.id===fry.pondId;});if(pond&&pond.archivedAt!==null||oldPond&&oldPond.archivedAt!==null)return{ok:false,reason:'pond-archived'};if(fry.pondId===pondId)return{ok:true,changed:false};if(pond&&pond.fishIds.length>=MAX_FISH)return{ok:false,reason:'pond-full'};fry.pondId=pondId;fry.updatedAt=timestamp(now);save(ws,state,now);return{ok:true,changed:true};}
  function feedPond(ws,pondId,now){var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;}),at=timestamp(now);if(!pond)return{ok:false,reason:'unknown-pond'};var fish=state.fry.filter(function(f){return f.pondId===pondId&&f.releasedAt===null&&(f.fedAt===null||at-f.fedAt>=60000);});if(!fish.length)return{ok:false,reason:'no-hungry-fish'};if(economy(ws).balance<5)return{ok:false,reason:'insufficient-coins'};receipt(state,'feed','pond_feed',1,at,pondId);fish.forEach(function(f){f.growth=Math.min(100,f.growth+20);f.fedAt=at;f.updatedAt=at;});save(ws,state,at);return{ok:true,spent:5,fed:fish.length,fishIds:fish.map(function(f){return f.id;}),reactions:fish.map(function(f){return{id:f.id,fishId:f.fishId,reaction:clone(find(FISH,f.fishId).feedingReaction)};})};}
  function sellFish(ws,catchId,now){var state=read(ws),caught=state.catches.find(function(c){return c.id===catchId;});if(!caught)return{ok:false,reason:'unknown-catch'};if(caught.fishId==='mystery_bundle')return{ok:false,reason:'bundle-not-sellable'};if(caught.soldAt!==null)return{ok:true,alreadySold:true,earned:0};caught.soldAt=Math.max(timestamp(now),caught.caughtAt);var tx=receipt(state,'sale',caught.fishId,1,caught.soldAt,caught.id);save(ws,state,now);return{ok:true,earned:tx.amount};}
  function sellFishBatch(ws,catchIds,now){
    if(!Array.isArray(catchIds)||catchIds.length>20000||Array.from(catchIds).some(function(id){return!validId(id);})||new Set(catchIds).size!==catchIds.length)return{ok:false,reason:'invalid-catches'};
    var state=read(ws),ids=new Set(catchIds),selected=state.catches.filter(function(c){return ids.has(c.id);});
    if(selected.length!==ids.size)return{ok:false,reason:'unknown-catch'};
    if(selected.some(function(c){return c.fishId==='mystery_bundle';}))return{ok:false,reason:'bundle-not-sellable'};
    var unsold=selected.filter(function(c){return c.soldAt===null;}),earned=0,at=timestamp(now);
    if(!unsold.length)return{ok:true,sold:0,earned:0,alreadySold:true};
    unsold.forEach(function(c){c.soldAt=Math.max(at,c.caughtAt);earned+=receipt(state,'sale',c.fishId,1,c.soldAt,c.id).amount;});
    save(ws,state,at);return{ok:true,sold:unsold.length,earned:earned};
  }
  function giftCompensation(opening){return{id:'gift_comp_'+opening.catchId+'_'+opening.giftId+'_'+opening.openedAt.toString(36),kind:'gift_duplicate',itemId:opening.giftId,quantity:1,amount:15,createdAt:opening.openedAt,refId:opening.id};}
  function openMysteryBundle(ws,catchId,options){
    if(typeof options==='number')options={now:options};options=options||{};
    var state=read(ws),caught=find(state.catches,catchId);
    if(!caught)return{ok:false,reason:'unknown-catch'};
    if(caught.fishId!=='mystery_bundle')return{ok:false,reason:'not-a-bundle'};
    var previous=state.mysteryOpenings.find(function(o){return o.catchId===catchId;});
    if(previous)return{ok:true,alreadyOpened:true,gift:clone(find(GIFTS,previous.giftId)),duplicate:previous.duplicate,earned:0,opening:clone(previous)};
    var unseen=GIFTS.filter(function(g){return!state.giftUnlocks.some(function(owned){return owned.id===g.id;});}),pool=unseen.length?unseen:GIFTS,gift=pool[random(options,pool.length)],at=Math.max(timestamp(options.now),state.updatedAt+1,caught.caughtAt),opening={id:'gift_'+caught.id,catchId:caught.id,giftId:gift.id,openedAt:at,duplicate:!unseen.length};
    caught.openedAt=at;state.mysteryOpenings.push(opening);autoOpeningStates.delete(state);
    if(opening.duplicate)state.transactions.push(giftCompensation(opening));save(ws,state,at);
    return{ok:true,gift:clone(gift),duplicate:opening.duplicate,earned:opening.duplicate?15:0,opening:clone(opening)};
  }
  function equipGift(ws,id,slot,now){
    if(!['avatarFrame','background'].includes(slot))return{ok:false,reason:'invalid-gift-slot'};
    var state=read(ws),gift=find(GIFTS,id);if(id!==null&&(!gift||gift.slot!==slot||!state.giftUnlocks.some(function(g){return g.id===id;})))return{ok:false,reason:'gift-not-owned'};
    if(state.giftAppearance[slot+'Id']===id)return{ok:true,changed:false,appearance:clone(state.giftAppearance)};
    state.giftAppearance[slot+'Id']=id;state.giftAppearance.updatedAt=Math.max(timestamp(now),state.updatedAt+1,state.giftAppearance.updatedAt+1);autoGiftStates.delete(state);save(ws,state,state.giftAppearance.updatedAt);
    return{ok:true,changed:true,appearance:clone(state.giftAppearance)};
  }
  // Sessions are capabilities: their authoritative simulation lives privately.
  // A copied object or manually assigned caught phase cannot grant a reward.
  var sessions=new WeakMap();
  function chooseCatch(baitId,seed){var ticket=seed%1000000;if(ticket>=970000)return PRODUCTS[1];if(ticket>=890000)return PRODUCTS[0];return chooseFish(baitId,seed);}
  // Analytical position paths have continuous velocity at every turn. They
  // depend on elapsed time, never on frame count or a fresh per-frame random draw.
  function swimProfile(fish,seconds,seed,stamina){
    var profile=DIFFICULTY_PROFILES[fish.rarity]||DIFFICULTY_PROFILES.common,technique=LEGENDARY_PATTERNS[fish.id],points=technique?technique.pattern:profile.pattern,total=profile.durations.reduce(function(a,b){return a+b;},0),phase=seconds%total,index=0;
    while(index<profile.durations.length-1&&phase>=profile.durations[index])phase-=profile.durations[index++];
    var eased=(1-Math.cos(Math.PI*phase/profile.durations[index]))/2,position=points[index]+(points[index+1]-points[index])*eased;
    if(seed%2)position=1-position;
    return{position:.5+(position-.5)*(.74+.26*stamina),behavior:profile.behaviors[index],technique:technique?technique.id:profile.id,profile:profile};
  }
  function chooseFish(baitId,seed){var bait=find(BAITS,baitId)||BAITS[0],pool=bait.fishIds.map(function(id){var fish=find(FISH,id);return{fish:fish,weight:[60,20,7,2][RARITIES.indexOf(fish.rarity)]};}),total=pool.reduce(function(n,r){return n+r.weight;},0),ticket=seed%total;for(var i=0;i<pool.length;i++){ticket-=pool[i].weight;if(ticket<0)return pool[i].fish;}return pool[0].fish;}
  function createSession(state,options){options=options||{};state=state||empty();var rod=find(RODS,options.rodId||state.equippedRodId)||RODS[0],baitId=options.baitId||state.equippedBaitId||'worm',seed=options.seed===undefined?random(options,1000000):options.seed;if(!Number.isInteger(seed)||seed<0)throw new Error('Invalid fishing seed');var fish=chooseCatch(baitId,seed),profile=DIFFICULTY_PROFILES[fish.rarity];var session={id:uid('cast',options.now),phase:'charging',elapsed:0,phaseTime:0,castPower:0,castDistance:0,waitDuration:0,nibble:0,biteWindow:1700,biteRemaining:0,fishBehavior:'cruise',stamina:1,swimTime:0,fishPosition:.5,barPosition:.5,barSize:Math.min(.46,rod.barSize*profile.barScale),progress:.22,tension:0,fishId:fish.id,rodId:rod.id,baitId:baitId,seed:seed,holding:false,castCommitted:false,perfect:true};if(fish.id==='junk')session.variant=fish.variants[seed%fish.variants.length];sessions.set(session,{state:clone(session),startedAt:timestamp(options.now),committed:false,claimed:false,workspace:null});return session;}
  function beginCast(ws,options){var state=read(ws);if(state.baits[state.equippedBaitId]<=0)return{ok:false,reason:'no-bait'};var session=createSession(state,options);sessions.get(session).workspace=ws;return{ok:true,session:session};}
  function commitCast(ws,session,now){var internal=sessions.get(session);if(!internal||internal.workspace!==ws||internal.state.phase==='charging'||internal.state.phase==='escaped')return{ok:false,reason:'invalid-cast'};if(internal.committed)return{ok:true,changed:false};var state=read(ws);if(!state.rods.includes(internal.state.rodId)||state.baits[internal.state.baitId]<=0){internal.state.phase='escaped';Object.assign(session,internal.state);return{ok:false,reason:'no-bait'};}state.casts.push({id:session.id,baitId:internal.state.baitId,rodId:internal.state.rodId,castAt:timestamp(now)});save(ws,state,now);internal.committed=true;internal.state.castCommitted=true;Object.assign(session,internal.state);return{ok:true,changed:true};}
  function advance(s,input,dt){var fish=itemFor(s.fishId),rod=find(RODS,s.rodId);s.elapsed+=dt;s.phaseTime+=dt;
    if(input.cancel){s.phase='escaped';s.reason='cancelled';s.nibble=0;s.biteRemaining=0;return;}
    if(s.phase==='charging'){s.castPower=Math.min(1,s.phaseTime/1100);s.castDistance=.15+.85*s.castPower;if(input.release||input.cast){if(s.castPower<.12){s.phase='escaped';s.reason='short-cast';}else{s.waitDuration=Math.round(2650+s.seed%2400-s.castDistance*1100);s.phase='cast';s.phaseTime=0;}}else if(s.phaseTime>8000){s.phase='escaped';s.reason='cast-timeout';}return;}
    if(s.phase==='cast'){if(s.phaseTime>=650){s.phase='waiting';s.phaseTime=0;}return;}
    if(s.phase==='waiting'){
      var peck=Math.max(0,1-Math.abs(s.phaseTime-s.waitDuration*.34)/120);
      if(s.seed%2)peck=Math.max(peck,Math.max(0,1-Math.abs(s.phaseTime-s.waitDuration*.68)/120));
      s.nibble=peck;
      if(input.hook){s.phase='escaped';s.reason='early-hook';s.nibble=0;}
      else if(s.phaseTime>=s.waitDuration){s.phase='bite';s.phaseTime=0;s.nibble=0;s.biteRemaining=s.biteWindow;}
      return;
    }
    if(s.phase==='bite'){s.biteRemaining=Math.max(0,s.biteWindow-s.phaseTime);if(s.phaseTime>=s.biteWindow){s.phase='escaped';s.reason='missed-bite';}else if(input.hook){s.phase='reeling';s.phaseTime=0;s.holding=false;s.biteRemaining=0;}return;}
    if(s.phase==='reeling'){
      var seconds=s.phaseTime/1000,path=swimProfile(fish,seconds,s.seed,s.stamina),profile=path.profile;
      s.fishBehavior=path.behavior;s.fishTechnique=path.technique;s.swimTime=seconds;s.fishPosition=path.position;
      s.holding=!!input.holding;s.barPosition=Math.max(s.barSize/2,Math.min(1-s.barSize/2,s.barPosition+(s.holding?1:-1)*dt/1000*.42*rod.control));
      var inside=Math.abs(s.fishPosition-s.barPosition)<=s.barSize/2,rest=s.fishBehavior==='rest',surge=s.fishBehavior==='surge';
      var gaining=profile.gain*(rest?1.35:surge?.75:1),tiring=profile.fatigue*(rest?1.3:surge?.85:1);
      s.progress=Math.max(0,Math.min(1,s.progress+(inside?gaining:s.holding?-profile.loss:-profile.loss*.6)*dt/1000));
      s.stamina=Math.max(0,Math.min(1,s.stamina+(inside?-tiring:.012)*dt/1000));
      var pressure=inside?(s.holding?(surge?.045:-.13):-.35):(s.holding?profile.pressure+(surge?.16:0):-.24);
      s.tension=Math.max(0,Math.min(1,s.tension+pressure*dt/1000));if(!inside)s.perfect=false;
      if(s.progress>=1&&s.stamina===0){s.phase='caught';s.phaseTime=0;s.fishBehavior='rest';}
      else if(s.progress<=0||s.tension>=1||s.phaseTime>45000){s.phase='escaped';s.reason=s.tension>=1?'line-break':'fish-escaped';}
    }
  }
  function stepSession(session,input,dt){var internal=sessions.get(session);if(!internal)throw new Error('Unknown fishing session');input=input||{};dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,60000)):16;var state=internal.state;if(state.phase==='caught'||state.phase==='escaped')return Object.assign(session,state);if(input.cancel){advance(state,input,0);return Object.assign(session,state);}var remaining=dt,timedInput={holding:!!input.holding};while(remaining>0){var chunk=Math.min(remaining,16);advance(state,timedInput,chunk);remaining-=chunk;if(state.phase==='caught'||state.phase==='escaped')break;}if(state.phase!=='caught'&&state.phase!=='escaped'&&(dt===0||input.hook||input.release||input.cast))advance(state,input,0);Object.assign(session,state);return session;}
  function recordCatch(ws,session,now){var internal=sessions.get(session);if(!internal||internal.workspace!==ws||internal.state.phase!=='caught'||!internal.committed)return{ok:false,reason:'unverified-catch'};if(internal.claimed)return{ok:true,alreadyRecorded:true,catch:clone(internal.catch)};var state=read(ws),s=internal.state;if(state.catches.some(function(c){return c.sessionId===s.id;}))return{ok:false,reason:'already-recorded'};var fish=itemFor(s.fishId),cast=state.casts.find(function(c){return c.id===s.id;});if(!cast)return{ok:false,reason:'missing-cast'};var at=Math.max(timestamp(now),cast.castAt),caught={id:uid('fish',at),sessionId:s.id,fishId:fish.id,length:Math.round(fish.baseLength*(.8+(s.seed%601)/1000)*10)/10,quality:s.perfect?'perfect':'normal',caughtAt:at,soldAt:null};if(s.variant!==undefined)caught.variant=s.variant;if(fish.openable)caught.openedAt=null;state.catches.push(caught);var fry=null;if(fish.fry){fry={id:uid('fry',at),catchId:caught.id,fishId:fish.id,pondId:null,createdAt:at,updatedAt:at,growth:0,fedAt:null,releasedAt:null};state.fry.push(fry);}save(ws,state,at);internal.claimed=true;internal.catch=caught;return{ok:true,catch:clone(caught),fish:catchItem(caught),fry:fry&&clone(fry)};}
  function merge(base,local,remote){
    var supplied=[base!==undefined&&base!==null,remote!==undefined&&remote!==null,local!==undefined&&local!==null];
    base=validate(base);local=validate(local);remote=validate(remote);var out=clone(remote),sources=[base,remote,local].filter(function(state,i){return supplied[i];});if(!sources.length)sources=[remote];
    function union(name,mutable){
      var rows=new Map();
      sources.forEach(function(state){state[name].forEach(function(row){
        var old=rows.get(row.id);if(!old){rows.set(row.id,clone(row));return;}if(!mutable)return;
        var next=clone((row.updatedAt||row.soldAt||0)>(old.updatedAt||old.soldAt||0)?row:old);
        var identity=name==='catches'?['id','sessionId','fishId','length','quality','caughtAt','variant']:name==='fry'?['id','catchId','fishId','createdAt']:['id','createdAt'];
        identity.forEach(function(key){next[key]=old[key];});
        if(name==='fry'){
          if(old.releasedAt!==null||row.releasedAt!==null){next.releasedAt=Math.max(old.releasedAt||0,row.releasedAt||0);next.pondId=null;}
          next.growth=Math.max(old.growth,row.growth);next.fedAt=old.fedAt===null&&row.fedAt===null?null:Math.max(old.fedAt||0,row.fedAt||0);
        }
        if(name==='ponds'&&(old.archivedAt!==null||row.archivedAt!==null)){
          var sealed=old.archivedAt!==null?old:row;next.archivedAt=sealed.archivedAt;next.sealedFishIds=sealed.sealedFishIds.slice();next.styleId=sealed.styleId;
        }
        if(name==='ponds'){
          var oldLayoutAt=old.decorationLayoutAt===undefined?old.createdAt:old.decorationLayoutAt,rowLayoutAt=row.decorationLayoutAt===undefined?row.createdAt:row.decorationLayoutAt;
          var layout=rowLayoutAt>oldLayoutAt||rowLayoutAt===oldLayoutAt&&JSON.stringify(row.decorations||[])>JSON.stringify(old.decorations||[])?row:old;
          if(layout.decorations!==undefined){next.decorations=clone(layout.decorations);next.decorationLayoutAt=layout.decorationLayoutAt;next.updatedAt=Math.max(next.updatedAt,next.decorationLayoutAt);}
          else{delete next.decorations;delete next.decorationLayoutAt;}
        }
        rows.set(row.id,next);
      });});
      out[name]=Array.from(rows.values());
    }
    ['transactions','boxes','casts'].forEach(function(name){union(name,false);});['catches','fry','ponds'].forEach(function(name){union(name,true);});
    var newest=local.updatedAt>remote.updatedAt?local:remote;['equippedRodId','equippedBaitId','equippedCabinId','updatedAt'].forEach(function(key){out[key]=newest[key];});
    // A dedicated clock keeps an older client or unrelated inventory edit from replacing the display.
    var layouts=sources.map(function(state){return state.showcase;}).filter(Boolean).sort(function(a,b){return b.updatedAt-a.updatedAt||(JSON.stringify(a)<JSON.stringify(b)?1:JSON.stringify(a)>JSON.stringify(b)?-1:0);});
    if(layouts.length){out.showcase=clone(layouts[0]);out.updatedAt=Math.max(out.updatedAt,out.showcase.updatedAt);}else delete out.showcase;
    var tanks=sources.map(function(state){return state.aquarium;}).filter(Boolean).sort(function(a,b){return b.updatedAt-a.updatedAt||(JSON.stringify(a)<JSON.stringify(b)?1:JSON.stringify(a)>JSON.stringify(b)?-1:0);});
    if(tanks.length){out.aquarium=clone(tanks[0]);out.aquarium.fryIds=out.aquarium.fryIds.filter(function(id){return find(out.fry,id).releasedAt===null;});out.updatedAt=Math.max(out.updatedAt,out.aquarium.updatedAt);}else delete out.aquarium;
    // Opening a physical bundle consumes that catch, including when two offline
    // clients open it independently. Earliest opening wins; compensation is then
    // reconstructed once from the merged collection, not summed from branches.
    var openings=new Map();sources.forEach(function(state){(state.mysteryOpenings||[]).forEach(function(o){var previous=openings.get(o.catchId);if(!previous||o.openedAt<previous.openedAt||o.openedAt===previous.openedAt&&o.giftId<previous.giftId)openings.set(o.catchId,clone(o));});});
    var unlocked=new Set();
    if(sources.some(function(state){return state.mysteryOpenings!==undefined;})){
      out.mysteryOpenings=Array.from(openings.values()).sort(function(a,b){return a.openedAt-b.openedAt||(a.id<b.id?-1:a.id>b.id?1:0);});
      out.transactions=out.transactions.filter(function(t){return t.kind!=='gift_duplicate';});
      out.mysteryOpenings.forEach(function(o){o.duplicate=unlocked.has(o.giftId);unlocked.add(o.giftId);find(out.catches,o.catchId).openedAt=o.openedAt;if(o.duplicate)out.transactions.push(giftCompensation(o));out.updatedAt=Math.max(out.updatedAt,o.openedAt);});
    }else delete out.mysteryOpenings;
    var appearances=sources.map(function(state){return state.giftAppearance;}).filter(Boolean).sort(function(a,b){return b.updatedAt-a.updatedAt||(JSON.stringify(a)<JSON.stringify(b)?1:JSON.stringify(a)>JSON.stringify(b)?-1:0);});
    if(appearances.length){out.giftAppearance=clone(appearances[0]);['avatarFrameId','backgroundId'].forEach(function(key){if(out.giftAppearance[key]!==null&&!unlocked.has(out.giftAppearance[key]))out.giftAppearance[key]=null;});out.updatedAt=Math.max(out.updatedAt,out.giftAppearance.updatedAt);}else delete out.giftAppearance;
    return validate(out);
  }
  function preserve(previous,next){if(!next||!(previous&&previous.fishing)&&next.fishing===undefined)return next;try{next.fishing=merge(previous&&previous.fishing,next.fishing,previous&&previous.fishing);syncMoney(next);}catch(error){throw Object.assign(new Error('workspace-stale'),{code:'workspace-stale',cause:error});}return next;}
  function validateWorkspace(ws){if(ws.fishing===undefined)return ws;ws.fishing=validate(ws.fishing);var ledger=validateTransactions(ws.taskGarden&&ws.taskGarden.market&&ws.taskGarden.market.fishingTransactions);if(JSON.stringify(ledger)!==JSON.stringify(ws.fishing.transactions))fail();return ws;}
  return{catalog:{rodPools:clone(ROD_POOLS),rods:clone(RODS),baits:clone(BAITS),fish:clone(FISH),products:clone(PRODUCTS),gifts:clone(GIFTS),difficultyProfiles:clone(DIFFICULTY_PROFILES),pondStyles:clone(PONDS),decorations:clone(DECORATIONS),aquariumDecorations:clone(AQUARIUM_DECORATIONS)},BOX_PRICE:BOX_PRICE,MAX_FISH:MAX_FISH,MAX_SHOWCASE_FISH:MAX_SHOWCASE_FISH,BOX_ODDS:clone(ROD_POOLS[0].odds),empty:empty,validate:validate,validateWorkspace:validateWorkspace,validateTransactions:validateTransactions,moneySummary:moneySummary,read:read,ensure:ensure,economy:economy,pity:pity,showcase:showcase,setShowcase:setShowcase,aquarium:aquarium,placeAquariumFish:placeAquariumFish,feedAquarium:feedAquarium,poolTier:poolTier,catchItem:catchItem,catchValue:catchValue,openMysteryBundle:openMysteryBundle,equipGift:equipGift,boxRarity:boxRarity,buyBox:buyBox,buyBait:buyBait,equipRod:function(ws,id,now){return equip(ws,'rod',id,now);},equipBait:function(ws,id,now){return equip(ws,'bait',id,now);},selectPondStyle:selectPondStyle,setPondDecoration:setPondDecoration,resetPondDecorations:resetPondDecorations,defaultPondDecorations:defaultPondDecorations,releaseFish:releaseFish,archivePond:archivePond,placeFry:placeFry,hatch:placeFry,moveFish:placeFry,feedPond:feedPond,sellFish:sellFish,sellFishBatch:sellFishBatch,createSession:createSession,beginCast:beginCast,commitCast:commitCast,stepSession:stepSession,recordCatch:recordCatch,merge:merge,preserve:preserve};
});
