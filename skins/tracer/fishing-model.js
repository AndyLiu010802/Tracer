(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerFishingModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var BOX_PRICE = 100, MAX_FISH = 5, MAX_SHOWCASE_FISH = 3, STARTER_BAIT = 30;
  var autoShowcaseStates = new WeakSet(), storedShowcaseStates = new WeakMap(), autoGiftStates=new WeakSet(), autoOpeningStates=new WeakSet();
  var POND_SKINS = [{"id":"konoha","name":["木叶庭院","Leaf village"],"price":1800,"base":"#627b47","accent":"#d5ad65","bank":"/fishing-art/pond-skin-konoha-bank-v1.png","preview":"/fishing-art/pond-skin-konoha-preview-v1.png","box":"/fishing-art/pond-skin-konoha-box-v1.png"},{"id":"akatsuki","name":["晓之雨庭","Crimson rain"],"price":2400,"base":"#292a39","accent":"#df5c53","bank":"/fishing-art/pond-skin-akatsuki-bank-v1.png","preview":"/fishing-art/pond-skin-akatsuki-preview-v1.png","box":"/fishing-art/pond-skin-akatsuki-box-v1.png"},{"id":"sunny","name":["千阳甲板","Sunny deck"],"price":2200,"base":"#a5763c","accent":"#ffc862","bank":"/fishing-art/pond-skin-sunny-bank-v1.png","preview":"/fishing-art/pond-skin-sunny-preview-v1.png","box":"/fishing-art/pond-skin-sunny-box-v1.png"},{"id":"wano","name":["和之国庭","Wano garden"],"price":2600,"base":"#6b405e","accent":"#ed9da7","bank":"/fishing-art/pond-skin-wano-bank-v1.png","preview":"/fishing-art/pond-skin-wano-preview-v1.png","box":"/fishing-art/pond-skin-wano-box-v1.png"},{"id":"valorant","name":["源晶基地","Radianite site"],"price":3000,"base":"#394957","accent":"#64e4dd","bank":"/fishing-art/pond-skin-valorant-bank-v1.png","preview":"/fishing-art/pond-skin-valorant-preview-v1.png","box":"/fishing-art/pond-skin-valorant-box-v1.png"},{"id":"dragon","name":["琉璃龙宫","Dragon palace"],"price":2800,"base":"#247d81","accent":"#eedba0","bank":"/fishing-art/pond-skin-dragon-bank-v1.png","preview":"/fishing-art/pond-skin-dragon-preview-v1.png","box":"/fishing-art/pond-skin-dragon-box-v1.png"},{"id":"redcliff","name":["赤壁水寨","Red Cliffs"],"price":2400,"base":"#675849","accent":"#d0aa65","bank":"/fishing-art/pond-skin-redcliff-bank-v1.png","preview":"/fishing-art/pond-skin-redcliff-preview-v1.png","box":"/fishing-art/pond-skin-redcliff-box-v1.png"},{"id":"clockwork","name":["黄铜船坞","Brass dock"],"price":2000,"base":"#675543","accent":"#6dc5ae","bank":"/fishing-art/pond-skin-clockwork-bank-v1.png","preview":"/fishing-art/pond-skin-clockwork-preview-v1.png","box":"/fishing-art/pond-skin-clockwork-box-v1.png"},{"id":"astral","name":["星轨之环","Astral ring"],"price":2800,"base":"#3d426c","accent":"#c3b5fa","bank":"/fishing-art/pond-skin-astral-bank-v1.png","preview":"/fishing-art/pond-skin-astral-preview-v1.png","box":"/fishing-art/pond-skin-astral-box-v1.png"},{"id":"onsen","name":["霜雪汤庭","Snow onsen"],"price":1800,"base":"#889a98","accent":"#e8d6b1","bank":"/fishing-art/pond-skin-onsen-bank-v1.png","preview":"/fishing-art/pond-skin-onsen-preview-v1.png","box":"/fishing-art/pond-skin-onsen-box-v1.png"}];
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
    ['eclipse','万象归墟','Myriad eclipse','legendary','xianxia','#51476c','#d9cbb3',.38,1.18],
    ["pilgrim","行脚竹杖","Pilgrim bamboo","common","xianxia","#ae9569","#e4d2a8",0.24,0.94],
    ["sandalwood","檀香念珠","Sandalwood prayer","common","xianxia","#86533e","#c9a169",0.25,0.95],
    ["reedraft","流沙渡苇","Reed ferry","common","xianxia","#9b8955","#b6c4a3",0.24,0.97],
    ["monkeytwig","花果灵枝","Flower-fruit bough","rare","xianxia","#815a43","#d9a879",0.28,1.03],
    ["goldenhoop","紧箍梵音","Golden circlet","rare","xianxia","#bc8734","#e5d293",0.29,1.04],
    ["moonspade","流沙月牙铲","Sandriver crescent","rare","xianxia","#547989","#d8e1d8",0.29,1.06],
    ["ninerake","天蓬九齿","Marshal nine-tooth rake","rare","xianxia","#677785","#c1d2db",0.3,1.05],
    ["whitedragon","白龙渡海","White dragon crossing","epic","xianxia","#9dbfc1","#f0e2b8",0.33,1.11],
    ["kasaya","锦襕袈裟","Brocade kasaya","epic","xianxia","#a44332","#edc96b",0.34,1.1],
    ["windfan","芭蕉借风","Plantain wind fan","epic","xianxia","#52754f","#d9bf73",0.33,1.12],
    ["redboy","三昧真火","Samadhi fire","epic","xianxia","#af382b","#ffd480",0.34,1.11],
    ["jadebottle","净瓶甘露","Jade vase dew","epic","xianxia","#70ab9e","#e9e2ba",0.33,1.1],
    ["demonmirror","照妖玄鉴","Demon-revealing mirror","epic","xianxia","#506676","#edc476",0.34,1.11],
    ["goldenbell","紫金摄魂铃","Violet-gold soul bell","epic","xianxia","#746386","#e6c477",0.33,1.12],
    ["sevenstars","七星伏魔剑","Seven-star demon blade","epic","xianxia","#385e75","#b9d6e2",0.34,1.1],
    ["gourd","紫金红葫芦","Violet-gold gourd","epic","xianxia","#954848","#d7b673",0.33,1.11],
    ["lotuswheel","哪吒风火轮","Lotus wind-fire wheel","epic","xianxia","#be6557","#edcf83",0.34,1.12],
    ["ruyi","如意定海","Ocean-stilling Ruyi","legendary","xianxia","#8e2922","#ffe0a0",0.37,1.18],
    ["erlang","二郎照雪","Erlang snow-cleaver","legendary","xianxia","#57748b","#dbeaf2",0.38,1.17],
    ["wukong","齐天大圣·身外身","Great Sage · myriad selves","legendary","xianxia","#a44d32","#f6d17c",0.38,1.18]
  ].map(function(r){return{id:r[0],name:[r[1],r[2]],rarity:r[3],family:r[4],style:r[0],color:r[5],accent:r[6],barSize:r[7],control:r[8]};});
  // BEGIN EXPANSION RODS
  RODS.push.apply(RODS,[
    {
  "id": "beech",
  "name": [
    "榉木溪桥",
    "Beech bridge"
  ],
  "rarity": "common",
  "family": "real",
  "style": "beech",
  "color": "#9b7050",
  "accent": "#ddbc83",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "wood",
    "detail": "arch",
    "variant": 0,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 7
  },
  "spell": "leaf",
  "effectDescription": [
    "榉木端纹、榫卯桥形轮座与交叉麻线握把。叶片沿竿身聚起，落水后散成细纹。",
    "Leaves gather along the blank and scatter into ripples on landing."
  ],
  "apparition": null
},
    {
  "id": "rainbamboo",
  "name": [
    "青篾雨竹",
    "Rain bamboo"
  ],
  "rarity": "common",
  "family": "real",
  "style": "rainbamboo",
  "color": "#628669",
  "accent": "#d9c69a",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "bamboo",
    "detail": "woven",
    "variant": 1,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 7
  },
  "spell": "dew",
  "effectDescription": [
    "六道青竹节、细篾编握与叶尖导环。水珠沿导环滑落，在落点溅开。",
    "Dew runs past the guides and breaks into droplets at the landing point."
  ],
  "apparition": null
},
    {
  "id": "harborbell",
  "name": [
    "铜铃泊岸",
    "Harbor bell"
  ],
  "rarity": "common",
  "family": "real",
  "style": "harborbell",
  "color": "#ac7949",
  "accent": "#d9c8a1",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "bell",
    "detail": "rope",
    "variant": 2,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "resonance",
  "effectDescription": [
    "双耳铜铃、船绳护圈和铆钉轮座。声纹由轮座传至落点，逐圈消散。",
    "Resonant rings travel from the reel seat to the water and fade outward."
  ],
  "apparition": null
},
    {
  "id": "kingfisher",
  "name": [
    "翠羽点水",
    "Kingfisher dive"
  ],
  "rarity": "rare",
  "family": "fantasy",
  "style": "kingfisher",
  "color": "#318a94",
  "accent": "#eeaf74",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "feather",
    "detail": "beak",
    "variant": 3,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "feather",
  "effectDescription": [
    "长喙护尖、分层翠羽与橙金缠线。羽翎依次展开，曳出交错的羽光。",
    "Feathers open in sequence and trail intersecting feather wakes."
  ],
  "apparition": null
},
    {
  "id": "reedflute",
  "name": [
    "芦笛晚汀",
    "Reed flute"
  ],
  "rarity": "rare",
  "family": "fantasy",
  "style": "reedflute",
  "color": "#9e9165",
  "accent": "#d7e3b0",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "flute",
    "detail": "holes",
    "variant": 4,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "music",
  "effectDescription": [
    "七孔芦笛、银包笛膜与芦穗穗结。七道弦光依次拨动，水面泛起琴音波纹。",
    "Seven luminous strings are plucked in sequence, sending music ripples across the water."
  ],
  "apparition": null
},
    {
  "id": "azulejo",
  "name": [
    "青花逐浪",
    "Porcelain waves"
  ],
  "rarity": "rare",
  "family": "fantasy",
  "style": "azulejo",
  "color": "#dfded1",
  "accent": "#48799d",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "porcelain",
    "detail": "waves",
    "variant": 5,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "tide",
  "effectDescription": [
    "青花分水纹、白釉开片与花瓣轮面。潮线随甩竿弯转，在落点卷成浪花。",
    "Tidal lines follow the cast and curl into waves at the landing point."
  ],
  "apparition": null
},
    {
  "id": "meteor",
  "name": [
    "落星陨铁",
    "Fallen meteor"
  ],
  "rarity": "epic",
  "family": "fantasy",
  "style": "meteor",
  "color": "#4d526f",
  "accent": "#f3bc7b",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "meteor",
    "detail": "cracks",
    "variant": 6,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "meteor",
  "effectDescription": [
    "陨铁断面、熔金裂脉与悬浮陨核。陨核沿抛物线坠落，击水后碎成流星。",
    "A meteor core follows the cast, breaking into sparks on impact."
  ],
  "apparition": "A jagged iron meteor with a molten amber core, broken mineral facets and three swept fire tails"
},
    {
  "id": "auroraprism",
  "name": [
    "极光棱镜",
    "Aurora prism"
  ],
  "rarity": "epic",
  "family": "fantasy",
  "style": "auroraprism",
  "color": "#77a6ba",
  "accent": "#d5b9e4",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "prism",
    "detail": "facets",
    "variant": 7,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 10
  },
  "spell": "prism",
  "effectDescription": [
    "六棱水晶、极光内含物与银制棱角座。棱面逐层折光，水上散开六瓣晶芒。",
    "Prismatic facets refract in layers and scatter six crystal flares."
  ],
  "apparition": "An elaborate silver-framed hexagonal crystal prism containing folded cyan violet aurora ribbons"
},
    {
  "id": "tidetrident",
  "name": [
    "潮王三叉",
    "Tidal trident"
  ],
  "rarity": "epic",
  "family": "fantasy",
  "style": "tidetrident",
  "color": "#347d8d",
  "accent": "#e3d29b",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "trident",
    "detail": "shell",
    "variant": 8,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "tide",
  "effectDescription": [
    "三叉波刃、螺壳护手与珍珠链坠。潮线随甩竿弯转，在落点卷成浪花。",
    "Tidal lines follow the cast and curl into waves at the landing point."
  ],
  "apparition": "An ornate ocean trident of blue patinated bronze, pearl-inlaid shell guard, sharp swept silver wave blades"
},
    {
  "id": "qilin",
  "name": [
    "麒麟衔瑞",
    "Auspicious qilin"
  ],
  "rarity": "legendary",
  "family": "fantasy",
  "style": "qilin",
  "color": "#678b76",
  "accent": "#efd28c",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "basic",
  "expansion": 2,
  "craft": {
    "kind": "qilin",
    "detail": "scales",
    "variant": 9,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "qilin",
  "effectDescription": [
    "鹿角玉麟、层叠鳞甲与含珠龙口。麟首舒展，足下浮起玉色涟漪。",
    "The qilin raises its head above jade ripples beneath its hooves."
  ],
  "apparition": "A majestic jade-and-gold qilin with antlers, carp scales, leonine mane, split hooves and a pearl in its mouth"
},
    {
  "id": "teaearthen",
  "name": [
    "陶茶闲钓",
    "Earthen tea"
  ],
  "rarity": "common",
  "family": "real",
  "style": "teaearthen",
  "color": "#996d53",
  "accent": "#d7b78b",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "teapot",
    "detail": "clay",
    "variant": 10,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "dew",
  "effectDescription": [
    "紫砂壶腹轮罩、竹提梁与陶刻茶枝。水珠沿导环滑落，在落点溅开。",
    "Dew runs past the guides and breaks into droplets at the landing point."
  ],
  "apparition": null
},
    {
  "id": "maplecraft",
  "name": [
    "枫桥木作",
    "Maple craft"
  ],
  "rarity": "common",
  "family": "real",
  "style": "maplecraft",
  "color": "#965a43",
  "accent": "#d9a36c",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "wood",
    "detail": "maple",
    "variant": 11,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 7
  },
  "spell": "leaf",
  "effectDescription": [
    "枫木拼接、燕尾榫轮座和三裂叶扣。叶片沿竿身聚起，落水后散成细纹。",
    "Leaves gather along the blank and scatter into ripples on landing."
  ],
  "apparition": null
},
    {
  "id": "lanternkite",
  "name": [
    "纸鸢巡风",
    "Lantern kite"
  ],
  "rarity": "rare",
  "family": "fantasy",
  "style": "lanternkite",
  "color": "#a96a68",
  "accent": "#e2c394",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "kite",
    "detail": "ribs",
    "variant": 12,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "wind",
  "effectDescription": [
    "燕形纸鸢、可见竹骨与绢尾结。风带缠绕竿身，随抛投拂过水面。",
    "Wind ribbons wrap the blank and sweep across the water with the cast."
  ],
  "apparition": null
},
    {
  "id": "astrolabe",
  "name": [
    "航海星盘",
    "Mariner astrolabe"
  ],
  "rarity": "rare",
  "family": "fantasy",
  "style": "astrolabe",
  "color": "#527f8b",
  "accent": "#d4b477",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "astrolabe",
    "detail": "ticks",
    "variant": 13,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "stars",
  "effectDescription": [
    "镂空黄铜星盘、旋转标尺与海图刻线。星点连成轨道，围绕落点缓缓回转。",
    "Stars join into orbits revolving around the landing point."
  ],
  "apparition": null
},
    {
  "id": "obsidian",
  "name": [
    "黑曜镜棱",
    "Obsidian edge"
  ],
  "rarity": "rare",
  "family": "fantasy",
  "style": "obsidian",
  "color": "#4e4761",
  "accent": "#beb4d5",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "prism",
    "detail": "obsidian",
    "variant": 14,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 10
  },
  "spell": "mirror",
  "effectDescription": [
    "黑曜贝壳断口、银包棱和紫晶嵌珠。镜面凝出重影，击水后化作细碎光片。",
    "The mirror gathers reflections and releases shards of light on impact."
  ],
  "apparition": null
},
    {
  "id": "scarabsun",
  "name": [
    "金甲日轮",
    "Scarab sun"
  ],
  "rarity": "epic",
  "family": "fantasy",
  "style": "scarabsun",
  "color": "#367f8a",
  "accent": "#edc36d",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "scarab",
    "detail": "wings",
    "variant": 15,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "sun",
  "effectDescription": [
    "金甲虫背翅、青金石太阳与翅脉浮雕。日盘展开光翼，暖金射线照向水面。",
    "A solar disk opens its wings and sends warm rays toward the water."
  ],
  "apparition": "A sacred golden scarab with articulated lapis and turquoise wing covers lifting a carved amber solar disk"
},
    {
  "id": "peacock",
  "name": [
    "孔雀明翎",
    "Peacock radiance"
  ],
  "rarity": "epic",
  "family": "fantasy",
  "style": "peacock",
  "color": "#397f74",
  "accent": "#b1dca4",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "feather",
    "detail": "eyes",
    "variant": 16,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "feather",
  "effectDescription": [
    "七重孔雀眼羽、青玉羽轴和珍珠眼斑。羽翎依次展开，曳出交错的羽光。",
    "Feathers open in sequence and trail intersecting feather wakes."
  ],
  "apparition": "A regal emerald peacock displaying layered long eye-spotted tail feathers with tiny gold filigree ribs"
},
    {
  "id": "worldtree",
  "name": [
    "万枝古树",
    "Ancient world tree"
  ],
  "rarity": "epic",
  "family": "fantasy",
  "style": "worldtree",
  "color": "#6c8051",
  "accent": "#e3c995",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "tree",
    "detail": "roots",
    "variant": 17,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "roots",
  "effectDescription": [
    "盘根握柄、铜绿枝杈与半透树脂树冠。根须逐枝伸展，在水面交织成纹。",
    "Roots extend branch by branch and interlace across the water."
  ],
  "apparition": "An ancient bonsai-like world tree with intertwined roots, deeply carved bark and translucent golden-green leaves"
},
    {
  "id": "chronoclock",
  "name": [
    "逆砂怀表",
    "Reverse-sand watch"
  ],
  "rarity": "epic",
  "family": "fantasy",
  "style": "chronoclock",
  "color": "#847859",
  "accent": "#e7ce92",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "clock",
    "detail": "gears",
    "variant": 18,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "clock",
  "effectDescription": [
    "双层开盖怀表、真实齿轮和逆流沙窗。齿轮错向转动，时针带起刻度光弧。",
    "Counter-rotating gears move the hands through luminous dial arcs."
  ],
  "apparition": "An opened antique brass pocket watch with interlocking exposed gears, a glass sand chamber and engraved astronomical hands"
},
    {
  "id": "ninephoenix",
  "name": [
    "九羽玄凰",
    "Nine-plume phoenix"
  ],
  "rarity": "legendary",
  "family": "fantasy",
  "style": "ninephoenix",
  "color": "#654968",
  "accent": "#edb876",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "myriad",
  "expansion": 2,
  "craft": {
    "kind": "phoenix",
    "detail": "nine",
    "variant": 19,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "phoenix",
  "effectDescription": [
    "九条独立长尾、金丝羽骨与玄紫火核。九道尾羽分层展开，掠过落点留下火翎。",
    "Nine tail plumes open in layers and sweep fiery feathers over the landing point."
  ],
  "apparition": "A magnificent dark violet phoenix with exactly nine distinct long golden-edged tail plumes and a blazing amber breast"
},
    {
  "id": "sutrabundle",
  "name": [
    "经卷行囊",
    "Pilgrim sutras"
  ],
  "rarity": "common",
  "family": "xianxia",
  "style": "sutrabundle",
  "color": "#ad9170",
  "accent": "#dfd3ad",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "scroll",
    "detail": "straps",
    "variant": 20,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "seal",
  "effectDescription": [
    "卷轴竹简、行囊双带和磨亮木轮。印章蓄势下落，水面铺开山河印纹。",
    "The seal rises and stamps down, spreading mountain-and-river relief over the water."
  ],
  "apparition": null
},
    {
  "id": "cloudshoe",
  "name": [
    "踏云草履",
    "Cloud sandals"
  ],
  "rarity": "common",
  "family": "xianxia",
  "style": "cloudshoe",
  "color": "#929575",
  "accent": "#d9d0a4",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "bamboo",
    "detail": "sandal",
    "variant": 21,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 7
  },
  "spell": "wind",
  "effectDescription": [
    "草履编纹握柄、白玉云头和结绳轮架。风带缠绕竿身，随抛投拂过水面。",
    "Wind ribbons wrap the blank and sweep across the water with the cast."
  ],
  "apparition": null
},
    {
  "id": "tigercloak",
  "name": [
    "虎皮行者",
    "Tiger-cloak pilgrim"
  ],
  "rarity": "rare",
  "family": "xianxia",
  "style": "tigercloak",
  "color": "#b28a4c",
  "accent": "#eee0ae",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "banner",
    "detail": "tiger",
    "variant": 22,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "tiger",
  "effectDescription": [
    "虎斑皮裹、铜环束带与兽牙护圈。虎影蓄力前扑，爪痕划开水光。",
    "A tiger apparition gathers and lunges, cutting claw marks through the water light."
  ],
  "apparition": null
},
    {
  "id": "skullbeads",
  "name": [
    "流沙九骷",
    "Nine sandriver beads"
  ],
  "rarity": "rare",
  "family": "xianxia",
  "style": "skullbeads",
  "color": "#8c7e71",
  "accent": "#ded9bf",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "beads",
    "detail": "skulls",
    "variant": 23,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "resonance",
  "effectDescription": [
    "九颗骨珠、铜丝串线与流沙缠纹。声纹由轮座传至落点，逐圈消散。",
    "Resonant rings travel from the reel seat to the water and fade outward."
  ],
  "apparition": null
},
    {
  "id": "lotusseat",
  "name": [
    "莲台渡厄",
    "Lotus crossing"
  ],
  "rarity": "rare",
  "family": "xianxia",
  "style": "lotusseat",
  "color": "#bda0a6",
  "accent": "#d9e3bd",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "lotus",
    "detail": "petals",
    "variant": 24,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "dew",
  "effectDescription": [
    "三层莲瓣轮座、金叶脉和露滴坠饰。水珠沿导环滑落，在落点溅开。",
    "Dew runs past the guides and breaks into droplets at the landing point."
  ],
  "apparition": null
},
    {
  "id": "scorpion",
  "name": [
    "琵琶蝎尾",
    "Pipa scorpion"
  ],
  "rarity": "epic",
  "family": "xianxia",
  "style": "scorpion",
  "color": "#766482",
  "accent": "#e0bd7d",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "scorpion",
    "detail": "pipa",
    "variant": 25,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "sting",
  "effectDescription": [
    "琵琶轮匣、六节蝎尾和弯钩毒晶。蝎尾逐节收紧，弯钩顺势刺向落点。",
    "The scorpion tail coils joint by joint and strikes the landing point."
  ],
  "apparition": "An ornate violet-gold scorpion curling its articulated stinger over a carved pear-shaped Chinese pipa lute"
},
    {
  "id": "spiderweb",
  "name": [
    "盘丝月网",
    "Moon silk web"
  ],
  "rarity": "epic",
  "family": "xianxia",
  "style": "spiderweb",
  "color": "#867495",
  "accent": "#e4c6dd",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "web",
    "detail": "silk",
    "variant": 26,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "web",
  "effectDescription": [
    "银丝七辐蛛网、紫玉丝囊与螺旋绞线。蛛丝由中心逐层织开，形成七重丝网。",
    "Silk spreads outward from the center into layered radial webs."
  ],
  "apparition": "A lavish silver and amethyst spider-spindle with eight jointed legs and an intricate stretched moonlit silk web"
},
    {
  "id": "whitebone",
  "name": [
    "白骨三相",
    "Three bone aspects"
  ],
  "rarity": "epic",
  "family": "xianxia",
  "style": "whitebone",
  "color": "#c0bfb1",
  "accent": "#b3c7d7",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "bone",
    "detail": "three",
    "variant": 27,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "bone",
  "effectDescription": [
    "三相白骨面、骨节护圈与银灰绢带。三相骨面依次显现，回旋后凝回竿身。",
    "Three bone aspects appear in sequence, turn, and gather into the rod."
  ],
  "apparition": "Three elegant ivory masks showing maiden, mature woman and skull aspects around a polished bone scepter with silver-gray silk"
},
    {
  "id": "dragonpalace",
  "name": [
    "龙宫潮令",
    "Dragon palace decree"
  ],
  "rarity": "epic",
  "family": "xianxia",
  "style": "dragonpalace",
  "color": "#528c99",
  "accent": "#eed1a0",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "pagoda",
    "detail": "dragon",
    "variant": 28,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "tide",
  "effectDescription": [
    "三重龙宫檐、珊瑚柱与含珠龙印。潮线随甩竿弯转，在落点卷成浪花。",
    "Tidal lines follow the cast and curl into waves at the landing point."
  ],
  "apparition": "An exquisite jade and gilt miniature underwater dragon palace with three sweeping eaves, coral pillars and a pearl dragon seal"
},
    {
  "id": "bullking",
  "name": [
    "平天大圣",
    "Bull Demon King"
  ],
  "rarity": "legendary",
  "family": "xianxia",
  "style": "bullking",
  "color": "#824b43",
  "accent": "#d7b888",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "journey",
  "expansion": 2,
  "craft": {
    "kind": "bull",
    "detail": "horns",
    "variant": 29,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "bull",
  "effectDescription": [
    "双弯牛角、混铁棍芯与兽面青铜甲。牛首低头蓄力，重蹄踏出四道震纹。",
    "The bull lowers its head and stamps four ripples into the water."
  ],
  "apparition": "The Bull Demon King, powerful bull-headed warrior with two great curved horns, dark bronze lamellar armor and a black iron staff, waist-up"
},
    {
  "id": "peachbough",
  "name": [
    "桃园旧枝",
    "Peach garden bough"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "peachbough",
  "color": "#9e775c",
  "accent": "#d5ab94",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "branch",
    "detail": "peach",
    "variant": 30,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 7
  },
  "spell": "leaf",
  "effectDescription": [
    "三枝桃木交缠，麻绳束节与铜桃花扣。叶片沿竿身聚起，落水后散成细纹。",
    "Leaves gather along the blank and scatter into ripples on landing."
  ],
  "apparition": null
},
    {
  "id": "strawsandals",
  "name": [
    "涿郡草履",
    "Zhuo woven sandals"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "strawsandals",
  "color": "#a19568",
  "accent": "#d9caa5",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "bamboo",
    "detail": "sandal",
    "variant": 31,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 7
  },
  "spell": "wind",
  "effectDescription": [
    "草履细编握把、麻线缝边与素铜包口。风带缠绕竿身，随抛投拂过水面。",
    "Wind ribbons wrap the blank and sweep across the water with the cast."
  ],
  "apparition": null
},
    {
  "id": "armoryiron",
  "name": [
    "洛阳军工",
    "Luoyang ironworks"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "armoryiron",
  "color": "#686d72",
  "accent": "#c0a579",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "spear",
    "detail": "rivets",
    "variant": 32,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "spear",
  "effectDescription": [
    "锻铁接缝、三排铆钉与皮革枪缨座。枪芒先收后放，划出连贯的穿水长线。",
    "The spear draws back and thrusts a continuous line through the water."
  ],
  "apparition": null
},
    {
  "id": "bambooslip",
  "name": [
    "颍川竹简",
    "Yingchuan slips"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "bambooslip",
  "color": "#9b8b60",
  "accent": "#c8d3b0",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "scroll",
    "detail": "slips",
    "variant": 33,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "ink",
  "effectDescription": [
    "六片竹简护柄、编绳与墨绿书卷轮。墨线沿竿锋展开，落水后洇成淡纹。",
    "Ink unfurls from the rod tip and diffuses into pale water patterns."
  ],
  "apparition": null
},
    {
  "id": "riverreed",
  "name": [
    "江夏芦舟",
    "Jiangxia reed boat"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "riverreed",
  "color": "#7b9183",
  "accent": "#ded0a0",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "boat",
    "detail": "reeds",
    "variant": 34,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "tide",
  "effectDescription": [
    "芦舟龙骨轮架、船板接缝与纤绳导座。潮线随甩竿弯转，在落点卷成浪花。",
    "Tidal lines follow the cast and curl into waves at the landing point."
  ],
  "apparition": null
},
    {
  "id": "granaryspear",
  "name": [
    "许田穗影",
    "Xutian harvest"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "granaryspear",
  "color": "#b09958",
  "accent": "#dfc896",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "spear",
    "detail": "grain",
    "variant": 35,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "leaf",
  "effectDescription": [
    "短枪护尖、金穗浮雕和谷绳握纹。叶片沿竿身聚起，落水后散成细纹。",
    "Leaves gather along the blank and scatter into ripples on landing."
  ],
  "apparition": null
},
    {
  "id": "shuembroider",
  "name": [
    "蜀锦云纹",
    "Shu cloud brocade"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "shuembroider",
  "color": "#926459",
  "accent": "#d6bda2",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "silk",
    "detail": "brocade",
    "variant": 36,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "silk",
  "effectDescription": [
    "蜀锦菱格、细密包边与铜云纹卡扣。绢带前后错层翻转，随竿尖柔和收束。",
    "Silk ribbons turn in overlapping layers and settle along the tip."
  ],
  "apparition": null
},
    {
  "id": "wuanchor",
  "name": [
    "建业铜锚",
    "Jianye bronze anchor"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "wuanchor",
  "color": "#4f827e",
  "accent": "#c6b584",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "anchor",
    "detail": "chain",
    "variant": 37,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "tide",
  "effectDescription": [
    "双爪锚轮座、船链纹和铜绿止线环。潮线随甩竿弯转，在落点卷成浪花。",
    "Tidal lines follow the cast and curl into waves at the landing point."
  ],
  "apparition": null
},
    {
  "id": "weislate",
  "name": [
    "邺城青砚",
    "Ye inkstone"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "weislate",
  "color": "#576d79",
  "accent": "#bfcdca",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "inkstone",
    "detail": "slate",
    "variant": 38,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "ink",
  "effectDescription": [
    "青石砚台轮面、磨砂石纹与银线包口。墨线沿竿锋展开，落水后洇成淡纹。",
    "Ink unfurls from the rod tip and diffuses into pale water patterns."
  ],
  "apparition": null
},
    {
  "id": "postbanner",
  "name": [
    "驿路旌节",
    "Courier standard"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "postbanner",
  "color": "#8e5e50",
  "accent": "#d6b687",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "banner",
    "detail": "tassels",
    "variant": 39,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "banner",
  "effectDescription": [
    "窄幅旌旗、缝边铜钉和双层缨穗。旌带迎风展开，金线随着布面起伏。",
    "The standard unfurls with its gold threads following the cloth."
  ],
  "apparition": null
},
    {
  "id": "bronzehalberd",
  "name": [
    "汉阙铜戟",
    "Han bronze halberd"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "bronzehalberd",
  "color": "#748470",
  "accent": "#dbbe86",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "halberd",
    "detail": "bronze",
    "variant": 40,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "cleave",
  "effectDescription": [
    "青铜援刃、饕餮细刻与几何雷纹。刃光顺甩竿轨迹斩落，留下一道清晰弧面。",
    "The blade follows the cast in one broad cutting arc."
  ],
  "apparition": null
},
    {
  "id": "wineladle",
  "name": [
    "煮酒青梅",
    "Plum wine ladle"
  ],
  "rarity": "common",
  "family": "historical",
  "style": "wineladle",
  "color": "#888762",
  "accent": "#d7ba80",
  "barSize": 0.25,
  "control": 0.96,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "vessel",
    "detail": "plum",
    "variant": 41,
    "metal": "#dcc08b",
    "grip": "#55453c",
    "pattern": 6
  },
  "spell": "dew",
  "effectDescription": [
    "三足温酒器轮罩、青梅珠与铜勺导座。水珠沿导环滑落，在落点溅开。",
    "Dew runs past the guides and breaks into droplets at the landing point."
  ],
  "apparition": null
},
    {
  "id": "liubei",
  "name": [
    "双股仁锋",
    "Benevolent twin blades"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "liubei",
  "color": "#67916e",
  "accent": "#e8cd93",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "twinsword",
    "detail": "knot",
    "variant": 42,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "twins",
  "effectDescription": [
    "长短双剑护片、连理结与蜀绿皮缠。双刃交错出击，两道轨迹在落点合拢。",
    "Twin blades cross and merge their trails at the landing point."
  ],
  "apparition": null
},
    {
  "id": "caocao",
  "name": [
    "倚天青釭",
    "Heaven and blue steel"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "caocao",
  "color": "#586a94",
  "accent": "#d7d6c5",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "sword",
    "detail": "double",
    "variant": 43,
    "metal": "#dce8e7",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "cleave",
  "effectDescription": [
    "青釭嵌脊、双重剑格与魏蓝金错纹。刃光顺甩竿轨迹斩落，留下一道清晰弧面。",
    "The blade follows the cast in one broad cutting arc."
  ],
  "apparition": null
},
    {
  "id": "sunquan",
  "name": [
    "碧眼紫髯",
    "Jade-eyed sovereign"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "sunquan",
  "color": "#806681",
  "accent": "#d4bf88",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "seal",
    "detail": "tiger",
    "variant": 44,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "seal",
  "effectDescription": [
    "紫檀虎钮、碧玉双眼和江纹铜章。印章蓄势下落，水面铺开山河印纹。",
    "The seal rises and stamps down, spreading mountain-and-river relief over the water."
  ],
  "apparition": null
},
    {
  "id": "huangzhong",
  "name": [
    "百步穿杨",
    "Hundred-pace bow"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "huangzhong",
  "color": "#956946",
  "accent": "#e9c98c",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "bow",
    "detail": "arrow",
    "variant": 45,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "arrows",
  "effectDescription": [
    "双曲弓臂、三支镂羽箭与老木弦槽。箭影接续飞出，在水面汇成一束。",
    "Arrows launch in sequence and converge over the water."
  ],
  "apparition": null
},
    {
  "id": "weiyan",
  "name": [
    "子午奇锋",
    "Ziwu hidden edge"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "weiyan",
  "color": "#77715a",
  "accent": "#d8bf90",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "saber",
    "detail": "ridge",
    "variant": 46,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "cleave",
  "effectDescription": [
    "奇峰折刃、斜脊铜护手与山道刻线。刃光顺甩竿轨迹斩落，留下一道清晰弧面。",
    "The blade follows the cast in one broad cutting arc."
  ],
  "apparition": null
},
    {
  "id": "jiangwei",
  "name": [
    "麒麟姜胆",
    "Qilin courage"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "jiangwei",
  "color": "#578a7d",
  "accent": "#cddcbd",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "spear",
    "detail": "qilin",
    "variant": 47,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "spear",
  "effectDescription": [
    "麒麟角护座、白银枪尖与青玉鳞节。枪芒先收后放，划出连贯的穿水长线。",
    "The spear draws back and thrusts a continuous line through the water."
  ],
  "apparition": null
},
    {
  "id": "xuhuang",
  "name": [
    "长驱宣斧",
    "Vanguard axe"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "xuhuang",
  "color": "#707e8d",
  "accent": "#dab879",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "axe",
    "detail": "square",
    "variant": 48,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "axe",
  "effectDescription": [
    "宽面宣斧、方孔镂雕与玄铁横梁。斧影短暂蓄势后劈落，扩散沉重冲击纹。",
    "The axe pauses in anticipation, then falls into a heavy impact ripple."
  ],
  "apparition": null
},
    {
  "id": "xuchu",
  "name": [
    "虎痴重锤",
    "Tiger guardian hammer"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "xuchu",
  "color": "#8a6850",
  "accent": "#d6bd88",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "hammer",
    "detail": "tiger",
    "variant": 49,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "hammer",
  "effectDescription": [
    "八面虎头锤、重铆钉与厚革锁扣。锤首垂直击水，厚实震环由内向外展开。",
    "The hammer strikes down and spreads thick concentric shock rings."
  ],
  "apparition": null
},
    {
  "id": "dianwei",
  "name": [
    "古之恶来",
    "Ancient stalwart"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "dianwei",
  "color": "#646672",
  "accent": "#d1bc99",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "dualhalberd",
    "detail": "iron",
    "variant": 50,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "twins",
  "effectDescription": [
    "左右双戟、玄铁兽面和锁链护柄。双刃交错出击，两道轨迹在落点合拢。",
    "Twin blades cross and merge their trails at the landing point."
  ],
  "apparition": null
},
    {
  "id": "zhoutai",
  "name": [
    "江表铁壁",
    "River iron wall"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "zhoutai",
  "color": "#537c78",
  "accent": "#d5b993",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "shield",
    "detail": "scars",
    "variant": 51,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "shield",
  "effectDescription": [
    "弧形盾甲、交错伤痕与双层铆边。盾纹迎面展开，回收时碎成光点。",
    "The shield crest opens outward and returns as fading sparks."
  ],
  "apparition": null
},
    {
  "id": "ganning",
  "name": [
    "锦帆夜袭",
    "Brocade night raid"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "ganning",
  "color": "#478899",
  "accent": "#e7b56e",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "boat",
    "detail": "bells",
    "variant": 52,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "sails",
  "effectDescription": [
    "锦帆龙骨、金铃串和钩形护手。帆影逐张鼓起，舟影沿潮线滑行。",
    "Sails billow in succession as boats glide along tidal lines."
  ],
  "apparition": null
},
    {
  "id": "luxun",
  "name": [
    "白衣渡火",
    "White robe crossing"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "luxun",
  "color": "#b8bba7",
  "accent": "#cb8b63",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "fan",
    "detail": "flames",
    "variant": 53,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "fire",
  "effectDescription": [
    "白绢扇面、赤铜火纹与细羽扇骨。火舌由竿身升起，随抛投拖出焰尾。",
    "Flames rise along the blank and trail behind the cast."
  ],
  "apparition": null
},
    {
  "id": "lusu",
  "name": [
    "鲁缟同盟",
    "Silk alliance"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "lusu",
  "color": "#9fae9e",
  "accent": "#d7c79f",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "scroll",
    "detail": "silk",
    "variant": 54,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "silk",
  "effectDescription": [
    "双卷白缟、交握铜扣与舟形轮架。绢带前后错层翻转，随竿尖柔和收束。",
    "Silk ribbons turn in overlapping layers and settle along the tip."
  ],
  "apparition": null
},
    {
  "id": "zhangliao",
  "name": [
    "逍遥惊涛",
    "Xiaoyao tidal charge"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "zhangliao",
  "color": "#557f94",
  "accent": "#d9d8bb",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "crescent",
    "detail": "waves",
    "variant": 55,
    "metal": "#dce8e7",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "crescent",
  "effectDescription": [
    "双弧长刀、冷银浪纹与马衔轮扣。月牙刃划出银色双弧，随水纹逐渐消隐。",
    "Crescent blades trace twin silver arcs that dissolve into water ripples."
  ],
  "apparition": null
},
    {
  "id": "wenji",
  "name": [
    "胡笳归雁",
    "Reed song returning geese"
  ],
  "rarity": "rare",
  "family": "historical",
  "style": "wenji",
  "color": "#ac9088",
  "accent": "#d8c8a9",
  "barSize": 0.29,
  "control": 1.05,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "flute",
    "detail": "goose",
    "variant": 56,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "music",
  "effectDescription": [
    "胡笳音孔、雁羽护片与绢丝流苏。七道弦光依次拨动，水面泛起琴音波纹。",
    "Seven luminous strings are plucked in sequence, sending music ripples across the water."
  ],
  "apparition": null
},
    {
  "id": "guanyuyunchang",
  "name": [
    "武圣青龙",
    "Martial saint dragon"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "guanyuyunchang",
  "color": "#347862",
  "accent": "#eed39a",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "glaive",
    "detail": "dragon",
    "variant": 57,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "dragon",
  "effectDescription": [
    "偃月镂刃、龙首吞口和赤鬃刀缨。青龙随刀势舒展，龙息沿弧线掠水。",
    "The azure dragon follows the blade, breathing light along its sweep."
  ],
  "apparition": "Guan Yu, dignified long-bearded Chinese martial saint in deep green robe and engraved gilt armor, holding an ornate crescent dragon glaive, waist-up"
},
    {
  "id": "zhangfei",
  "name": [
    "长坂怒啸",
    "Changban roar"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "zhangfei",
  "color": "#554f62",
  "accent": "#d8a36e",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "serpentspear",
    "detail": "serpent",
    "variant": 58,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "roar",
  "effectDescription": [
    "蛇形枪刃、豹面轮座和黑缨盘结。低沉声纹逐层推出，水面扩散虎啸震环。",
    "Layered sound waves expand into powerful roar rings on the water."
  ],
  "apparition": "Zhang Fei, fierce broad-shouldered bearded general in black and bronze armor, holding an elegant undulating serpent spear, waist-up"
},
    {
  "id": "zhaoyun",
  "name": [
    "龙胆照夜",
    "Dragon courage at night"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "zhaoyun",
  "color": "#9bbdc5",
  "accent": "#e3e5da",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "spear",
    "detail": "dragon",
    "variant": 59,
    "metal": "#dce8e7",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "spear",
  "effectDescription": [
    "龙胆银枪、白龙鳞甲与冰蓝长缨。枪芒先收后放，划出连贯的穿水长线。",
    "The spear draws back and thrusts a continuous line through the water."
  ],
  "apparition": "Zhao Yun, noble young Chinese warrior in intricately engraved silver armor, white cloak and pale blue plume, holding a silver dragon spear, waist-up"
},
    {
  "id": "machao",
  "name": [
    "锦骑银狮",
    "Silver lion cavalry"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "machao",
  "color": "#a0aab5",
  "accent": "#e0c496",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "lion",
    "detail": "spear",
    "variant": 60,
    "metal": "#dce8e7",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "cavalry",
  "effectDescription": [
    "银狮吞口、锦骑马饰与长穗枪尾。银狮昂首，踏水蹄印与枪芒同时掠出。",
    "The silver lion rises as hoofprints and spear light race across the water."
  ],
  "apparition": "Ma Chao, handsome western cavalry general wearing a silver lion helmet and embroidered white cape, carrying a cavalry spear, waist-up"
},
    {
  "id": "zhouyu",
  "name": [
    "赤壁长歌",
    "Red Cliffs overture"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "zhouyu",
  "color": "#9b514c",
  "accent": "#edc27e",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "boat",
    "detail": "fire",
    "variant": 61,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "redcliffs",
  "effectDescription": [
    "楼船轮座、琴弦护脊与赤铜火帆。三艘火船先后驶入落点，火帆随东风燃起。",
    "Three fire ships approach the landing point, their sails igniting in the east wind."
  ],
  "apparition": "Zhou Yu, elegant Chinese admiral with refined face, crimson brocade cloak and bronze armor, lifting a command sword beside a small burning warship apparition, waist-up"
},
    {
  "id": "simayi",
  "name": [
    "玄冢星谋",
    "Dark constellation strategist"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "simayi",
  "color": "#595873",
  "accent": "#c1c4db",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "astrolabe",
    "detail": "eclipse",
    "variant": 62,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "eclipse",
  "effectDescription": [
    "玄铁星盘、鹰目玉扣和双圈阴阳尺。暗月遮过星盘，边缘留下一圈银紫光晕。",
    "A dark moon crosses the star dial, leaving a silver-violet corona."
  ],
  "apparition": "Sima Yi, austere older Chinese strategist in layered indigo robes with silver constellations, narrow sharp eyes and a dark feather fan, waist-up"
},
    {
  "id": "pangtong",
  "name": [
    "凤雏连环",
    "Young phoenix chain"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "pangtong",
  "color": "#89694e",
  "accent": "#e0b986",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "chain",
    "detail": "phoenix",
    "variant": 63,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "chains",
  "effectDescription": [
    "凤雏羽冠、九环连锁与赤铜锁舟扣。连环逐节传力，在落点交扣成弧。",
    "Interlocking chains transmit motion link by link and curve around the landing point."
  ],
  "apparition": "Pang Tong, unconventional bearded Chinese strategist in ochre robes and a small phoenix-feather crown, holding bronze interlocking chain rings, waist-up"
},
    {
  "id": "huangyueying",
  "name": [
    "木牛流马",
    "Wooden ox mechanism"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "huangyueying",
  "color": "#96794f",
  "accent": "#c5d4a8",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "mechanism",
    "detail": "ox",
    "variant": 64,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "mechanism",
  "effectDescription": [
    "木牛关节、流马齿轮与弩机轮架。木牛关节抬起，齿轮带动弩机光线。",
    "The wooden ox lifts its articulated limbs as gears drive crossbow light."
  ],
  "apparition": "Huang Yueying, ingenious Chinese woman inventor in olive and ochre scholar clothing, with a beautifully detailed small mechanical wooden ox and articulated brass gears, waist-up"
},
    {
  "id": "daqiao",
  "name": [
    "江东春澜",
    "Jiangdong spring waves"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "daqiao",
  "color": "#ad91a0",
  "accent": "#e5d0b0",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "silk",
    "detail": "flowers",
    "variant": 65,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "petals",
  "effectDescription": [
    "春水绢带、双层玉兰和珍珠花钿。玉兰花瓣依次舒展，落在柔和春水纹上。",
    "Magnolia petals unfold in sequence and drift onto spring-water ripples."
  ],
  "apparition": "Da Qiao, graceful adult Chinese woman in pale rose and celadon Han clothing with magnolia hair ornaments, long sleeves flowing like spring water, waist-up"
},
    {
  "id": "xiaoqiao",
  "name": [
    "铜雀秋弦",
    "Autumn zither"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "xiaoqiao",
  "color": "#77999f",
  "accent": "#e0c791",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "zither",
    "detail": "swallow",
    "variant": 66,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "music",
  "effectDescription": [
    "七弦玉琴、铜雀弦枕和秋叶琴轸。七道弦光依次拨动，水面泛起琴音波纹。",
    "Seven luminous strings are plucked in sequence, sending music ripples across the water."
  ],
  "apparition": "Xiao Qiao, graceful adult Chinese woman in pale blue silk Han clothing, holding a finely carved seven-string zither with bronze swallow ornaments, waist-up"
},
    {
  "id": "diaochan",
  "name": [
    "闭月连环",
    "Moon-veiled dancer"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "diaochan",
  "color": "#9c698f",
  "accent": "#e7c7b1",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "moon",
    "detail": "ribbons",
    "variant": 67,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "moon",
  "effectDescription": [
    "弯月双环、细金步摇与紫绢长袖。双月环错向旋转，绢袖随月弧回旋。",
    "Twin crescent rings turn in opposite directions beneath circling silk sleeves."
  ],
  "apparition": "Diao Chan, elegant adult Chinese dancer in layered violet silk, ornate gold hair pins, long trailing dance sleeves and two crescent rings, waist-up"
},
    {
  "id": "dongzhuo",
  "name": [
    "西凉玄鼎",
    "Western bronze cauldron"
  ],
  "rarity": "epic",
  "family": "historical",
  "style": "dongzhuo",
  "color": "#65584d",
  "accent": "#d5ab70",
  "barSize": 0.34,
  "control": 1.12,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "cauldron",
    "detail": "taotie",
    "variant": 68,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "cauldron",
  "effectDescription": [
    "饕餮三足鼎、兽耳提梁与玄铜火纹。玄鼎抬起后稳稳落下，鼎内火光映向水面。",
    "The bronze cauldron rises and settles, reflecting its inner fire over the water."
  ],
  "apparition": "A massive ancient Chinese bronze ritual tripod cauldron with intricate taotie masks, beast-shaped handles, dark patina and contained amber fire"
},
    {
  "id": "zhugeliang",
  "name": [
    "七星借东风",
    "Seven stars east wind"
  ],
  "rarity": "legendary",
  "family": "historical",
  "style": "zhugeliang",
  "color": "#7d9d9c",
  "accent": "#ead39b",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "fan",
    "detail": "seven",
    "variant": 69,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "eastwind",
  "effectDescription": [
    "七星羽扇、八卦轮面与银云扇骨。七星亮起，羽扇挥出的东风分层推过水面。",
    "Seven stars awaken as the feather fan drives layered east wind over the water."
  ],
  "apparition": "Zhuge Liang, wise Chinese strategist with a calm face, black scholar cap, ivory and celadon robes, holding a large individual-feather fan over seven floating stars, waist-up"
},
    {
  "id": "lubu",
  "name": [
    "辕门方天",
    "Gate halberd"
  ],
  "rarity": "legendary",
  "family": "historical",
  "style": "lubu",
  "color": "#92545b",
  "accent": "#e8c189",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "halberd",
    "detail": "plumes",
    "variant": 70,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "halberd",
  "effectDescription": [
    "方天双月刃、双雉翎与兽面金甲。双月戟先引后斩，双雉翎随余势回摆。",
    "The double-crescent halberd draws and cuts while twin plumes follow through."
  ],
  "apparition": "Lu Bu, imposing Chinese warrior in ornate black crimson and gold armor with two very long curved pheasant plumes, holding a double-crescent halberd, waist-up"
},
    {
  "id": "jiangdongtiger",
  "name": [
    "江东猛虎",
    "Tiger of Jiangdong"
  ],
  "rarity": "legendary",
  "family": "historical",
  "style": "jiangdongtiger",
  "color": "#a47847",
  "accent": "#e6d196",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "tiger",
    "detail": "saber",
    "variant": 71,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "tiger",
  "effectDescription": [
    "古锭铜刀、白额虎首和层叠虎牙护件。虎影蓄力前扑，爪痕划开水光。",
    "A tiger apparition gathers and lunges, cutting claw marks through the water light."
  ],
  "apparition": "Sun Jian, battle-hardened Chinese general in bronze tiger armor with a crimson scarf and curved ancient saber, accompanied by a spectral white-browed tiger head, waist-up"
},
    {
  "id": "yuanshao",
  "name": [
    "四世金旌",
    "Four generations standard"
  ],
  "rarity": "legendary",
  "family": "historical",
  "style": "yuanshao",
  "color": "#947654",
  "accent": "#ecda9e",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "banner",
    "detail": "four",
    "variant": 72,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "banners",
  "effectDescription": [
    "四重金旌、玉柄节钺与金线流苏。四重旌旗逐层展开，绶带随风错落飘动。",
    "Four standards open in layers with ribbons moving at different depths."
  ],
  "apparition": "An elaborate Han imperial military standard with four layered ivory and gold banners, carved jade ceremonial axe and individual gilded silk tassels"
},
    {
  "id": "zuoci",
  "name": [
    "遁甲天书",
    "Celestial hidden arts"
  ],
  "rarity": "legendary",
  "family": "historical",
  "style": "zuoci",
  "color": "#768ba5",
  "accent": "#decfa7",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "scroll",
    "detail": "talismans",
    "variant": 73,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "talismans",
  "effectDescription": [
    "遁甲金简、符纸折翼与鹤羽云钩。八道符纹从卷轴展开，绕落点回旋收束。",
    "Eight abstract seals unfold from the scroll and circle the landing point."
  ],
  "apparition": "Zuo Ci, aged Chinese Taoist sage with flowing white beard and indigo robes, holding an unfurling celestial scroll with golden abstract diagrams and crane feathers, waist-up"
},
    {
  "id": "emperorjade",
  "name": [
    "传国玉玺·山河一统",
    "Imperial jade seal"
  ],
  "rarity": "legendary",
  "family": "historical",
  "style": "emperorjade",
  "color": "#599a82",
  "accent": "#eed796",
  "barSize": 0.38,
  "control": 1.18,
  "collection": "threekingdoms",
  "expansion": 2,
  "craft": {
    "kind": "seal",
    "detail": "dragons",
    "variant": 74,
    "metal": "#dcc08b",
    "grip": "#34313d",
    "pattern": 6
  },
  "spell": "seal",
  "effectDescription": [
    "五龙交钮、方正玉印与四角金补纹；控竿时张力增长降低 25%。印章蓄势下落，水面铺开山河印纹。",
    "The seal rises and stamps down, spreading mountain-and-river relief over the water. Tension builds 25% more slowly while reeling."
  ],
  "apparition": "An extraordinary square pale-jade Chinese imperial seal topped with five intricately intertwined golden dragons, repaired gold corner and mountain-and-river relief sides",
  "hidden": true,
  "tensionMultiplier": 0.75
}
  ]);
  // END EXPANSION RODS
  // BEGIN ANIME RODS
  RODS.push.apply(RODS,[{"id":"anime_iruka","name":["伊鲁卡·忍具","Iruka · Academy"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#536c60","accent":"#bac3c1","barSize":0.26,"control":1,"hidden":false,"animeAction":"kunai","craft":{"kind":"anime","detail":"kunai","variant":0,"metal":"#bac3c1","grip":"#536c60","pattern":0},"spell":["kunai","忍术"],"apparition":{"kind":"kunai","duration":700},"effectDescription":["苦无带两道短残影掠向落点，钢刃命中后迅速收势。","A steel kunai crosses the target with two short afterimages."]},{"id":"anime_tenten","name":["天天·双升龙","Tenten · Twin scrolls"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#a04a45","accent":"#e7cfaa","barSize":0.26,"control":1,"hidden":false,"animeAction":"scroll","craft":{"kind":"anime","detail":"scroll","variant":1,"metal":"#e7cfaa","grip":"#a04a45","pattern":1},"spell":["scroll","忍术"],"apparition":{"kind":"scroll","duration":700},"effectDescription":["三枚小型忍具错时齐射，刃光在落点汇合后消退。","Three compact ninja tools arrive in a staggered volley."]},{"id":"anime_shikamaru","name":["鹿丸·影缚","Shikamaru · Shadow bind"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#454b53","accent":"#aab7a2","barSize":0.26,"control":1,"hidden":false,"animeAction":"shadow","craft":{"kind":"anime","detail":"shadow","variant":2,"metal":"#aab7a2","grip":"#454b53","pattern":2},"spell":["shadow","忍术"],"apparition":{"kind":"shadow","duration":700},"effectDescription":["细长黑影贴着水面前伸，短暂缚住落点后收回。","A narrow shadow stretches across the water and briefly binds the target."]},{"id":"anime_kiba","name":["牙·牙通牙","Kiba · Fang over fang"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#786b60","accent":"#e6d7be","barSize":0.26,"control":1,"hidden":false,"animeAction":"fang","craft":{"kind":"anime","detail":"fang","variant":3,"metal":"#e6d7be","grip":"#786b60","pattern":3},"spell":["fang","忍术"],"apparition":{"kind":"fang","duration":700},"effectDescription":["两道灰白螺旋错位突进，牙通牙的风轨在命中后散开。","Two offset white spirals rush forward in a brief Fang Over Fang strike."]},{"id":"anime_shino","name":["志乃·寄坏虫","Shino · Insect swarm"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#54606b","accent":"#b3ac83","barSize":0.26,"control":1,"hidden":false,"animeAction":"swarm","craft":{"kind":"anime","detail":"swarm","variant":4,"metal":"#b3ac83","grip":"#54606b","pattern":4},"spell":["swarm","忍术"],"apparition":{"kind":"swarm","duration":700},"effectDescription":["少量寄坏虫沿弧线聚拢，命中后立即散去。","A small controlled insect swarm converges and quickly disperses."]},{"id":"anime_asuma","name":["阿斯玛·飞燕","Asuma · Flying swallow"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#667653","accent":"#c0de9c","barSize":0.26,"control":1,"hidden":false,"animeAction":"chakrablade","craft":{"kind":"anime","detail":"chakrablade","variant":5,"metal":"#c0de9c","grip":"#667653","pattern":5},"spell":["chakrablade","忍术"],"apparition":{"kind":"chakrablade","duration":700},"effectDescription":["两记青蓝查克拉刃交错划过，刀口保留锐亮的短斩痕。","Two blue chakra blade trails cross with sharp, brief cutting edges."]},{"id":"anime_sai","name":["佐井·超兽伪画","Sai · Ink beasts"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#3e4850","accent":"#d7d3c7","barSize":0.26,"control":1,"hidden":false,"animeAction":"inkbird","craft":{"kind":"anime","detail":"inkbird","variant":6,"metal":"#d7d3c7","grip":"#3e4850","pattern":0},"spell":["inkbird","忍术"],"apparition":{"kind":"inkbird","duration":700},"effectDescription":["两道墨鸟剪影前冲，墨翼翻折后化成少量墨点。","Two brush-ink bird silhouettes sweep forward and scatter into a few ink flecks."]},{"id":"anime_ino","name":["井野·心转身","Ino · Mind transfer"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#aa7ab0","accent":"#eed8ec","barSize":0.26,"control":1,"hidden":false,"animeAction":"mindthread","craft":{"kind":"anime","detail":"mindthread","variant":7,"metal":"#eed8ec","grip":"#aa7ab0","pattern":1},"spell":["mindthread","忍术"],"apparition":{"kind":"mindthread","duration":700},"effectDescription":["淡紫精神束直达落点，定位光环短暂收束。","A pale violet mind-transfer beam converges on a small target ring."]},{"id":"anime_sakura","name":["小樱·樱花冲","Sakura · Cherry impact"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#bf718b","accent":"#f4cad3","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"impact","craft":{"kind":"anime","detail":"impact","variant":8,"metal":"#f4cad3","grip":"#bf718b","pattern":2},"spell":["impact","忍术"],"apparition":{"kind":"impact","duration":700},"effectDescription":["一记有力的拳影前冲，命中时绽开短促冲击环。","One strong punch afterimage ends in a compact impact ring."]},{"id":"anime_hinata","name":["雏田·双狮拳","Hinata · Twin lions"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#8a86b4","accent":"#d7e9f3","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"lion","craft":{"kind":"anime","detail":"lion","variant":9,"metal":"#d7e9f3","grip":"#8a86b4","pattern":3},"spell":["lion","忍术"],"apparition":{"kind":"lion","duration":700},"effectDescription":["两道蓝色狮形查克拉拳错位前冲，鬃形边缘随拳势收束。","Twin blue chakra lion fists advance with short, swept-back mane silhouettes."]},{"id":"anime_neji","name":["宁次·回天","Neji · Rotation"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#c7c1b5","accent":"#b5e5e6","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"rotation","craft":{"kind":"anime","detail":"rotation","variant":10,"metal":"#b5e5e6","grip":"#c7c1b5","pattern":4},"spell":["rotation","忍术"],"apparition":{"kind":"rotation","duration":700},"effectDescription":["三层蓝白查克拉弧高速回旋，半球形气流迅速收回。","Three blue-white chakra arcs rotate into a compact hemispherical guard."]},{"id":"anime_lee","name":["小李·表莲华","Lee · Front lotus"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#437557","accent":"#e4b172","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"lotuskick","craft":{"kind":"anime","detail":"lotuskick","variant":11,"metal":"#e4b172","grip":"#437557","pattern":5},"spell":["lotuskick","忍术"],"apparition":{"kind":"lotuskick","duration":700},"effectDescription":["绷带脚踢出一道短弧，绿衣残影与气流随收势散去。","A bandaged kick follows a short arc with a green-clad afterimage."]},{"id":"anime_temari","name":["手鞠·镰鼬","Temari · Sickle wind"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#ddd2b7","accent":"#a678af","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"fan","craft":{"kind":"anime","detail":"fan","variant":12,"metal":"#a678af","grip":"#ddd2b7","pattern":0},"spell":["fan","忍术"],"apparition":{"kind":"fan","duration":700},"effectDescription":["三道薄而锐利的风刃错时横扫，命中后立即消散。","Three thin wind blades sweep across the target in quick succession."]},{"id":"anime_kankuro","name":["勘九郎·傀儡","Kankuro · Puppet"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#694c62","accent":"#c4a277","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"puppet","craft":{"kind":"anime","detail":"puppet","variant":13,"metal":"#c4a277","grip":"#694c62","pattern":1},"spell":["puppet","忍术"],"apparition":{"kind":"puppet","duration":700},"effectDescription":["三根查克拉丝牵引一次短斩击，收线后刃光消失。","Three chakra threads pull a brief cutting strike and retract."]},{"id":"anime_choji","name":["丁次·倍化之手","Choji · Expansion"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#b76755","accent":"#f0c9a6","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"giantpalm","craft":{"kind":"anime","detail":"giantpalm","variant":14,"metal":"#f0c9a6","grip":"#b76755","pattern":2},"spell":["giantpalm","忍术"],"apparition":{"kind":"giantpalm","duration":700},"effectDescription":["倍化拳影完成一次沉重直击，冲击环迅速消退。","An enlarged fist delivers one heavy blow and a short shock ring."]},{"id":"anime_yamato","name":["大和·木牢","Yamato · Wood prison"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#707e55","accent":"#d9c28d","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"woodcage","craft":{"kind":"anime","detail":"woodcage","variant":15,"metal":"#d9c28d","grip":"#707e55","pattern":3},"spell":["woodcage","忍术"],"apparition":{"kind":"woodcage","duration":700},"effectDescription":["三道有木纹的短木刺前冲，命中后迅速收势。","Three short grained wooden spikes converge and quickly recede."]},{"id":"anime_suigetsu","name":["水月·水化","Suigetsu · Hydrification"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#91bcc2","accent":"#dbf1e9","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"waterbody","craft":{"kind":"anime","detail":"waterbody","variant":16,"metal":"#dbf1e9","grip":"#91bcc2","pattern":4},"spell":["waterbody","忍术"],"apparition":{"kind":"waterbody","duration":700},"effectDescription":["一道银蓝斩击拖出液态尾迹，少量水珠随刃光散开。","A silver-blue slash leaves a fluid wake and a few water droplets."]},{"id":"anime_gaara","name":["我爱罗·砂之手","Gaara · Sand hand"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#a67b49","accent":"#ead3a1","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"sand","craft":{"kind":"anime","detail":"sand","variant":17,"metal":"#ead3a1","grip":"#a67b49","pattern":5},"spell":["sand","忍术"],"apparition":{"kind":"sand","duration":700},"effectDescription":["砂流贴近落点卷合，颗粒与短冲击环随收势散去。","A compact sand stream curls around the target and sheds a few grains."]},{"id":"anime_kakashi","name":["卡卡西·雷切","Kakashi · Lightning blade"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#5b7386","accent":"#cfedf3","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"lightning","craft":{"kind":"anime","detail":"lightning","variant":18,"metal":"#cfedf3","grip":"#5b7386","pattern":0},"spell":["lightning","忍术"],"apparition":{"kind":"lightning","duration":700},"effectDescription":["集中的青白电刃向前突刺，分叉电流在命中后消退。","A concentrated blue-white Lightning Blade thrust ends in brief branching sparks."]},{"id":"anime_itachi","name":["鼬·鸦分身","Itachi · Crow clone"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#522f39","accent":"#df7168","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"raven","craft":{"kind":"anime","detail":"raven","variant":19,"metal":"#df7168","grip":"#522f39","pattern":1},"spell":["raven","忍术"],"apparition":{"kind":"raven","duration":700},"effectDescription":["三道暗色鸦影错位掠过，羽影与红色眼光一闪即逝。","Three dark crow afterimages pass with fleeting red eyes and feather traces."]},{"id":"anime_jiraiya","name":["自来也·蛤蟆油炎","Jiraiya · Toad flame"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#944c45","accent":"#e9ce9b","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"toad","craft":{"kind":"anime","detail":"toad","variant":20,"metal":"#e9ce9b","grip":"#944c45","pattern":2},"spell":["toad","忍术"],"apparition":{"kind":"toad","duration":700},"effectDescription":["橙金油炎沿短距离喷出，亮芯在命中后收束。","A short orange-gold oil-flame jet contracts to a bright core at impact."]},{"id":"anime_minato","name":["水门·飞雷神","Minato · Flying thunder"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#c4a149","accent":"#fbebb1","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"teleport","craft":{"kind":"anime","detail":"teleport","variant":21,"metal":"#fbebb1","grip":"#c4a149","pattern":3},"spell":["teleport","忍术"],"apparition":{"kind":"teleport","duration":700},"effectDescription":["三叉苦无先行，金色瞬身闪光在落点短暂交汇。","A three-pronged kunai leads a brief golden teleport flash at the target."]},{"id":"anime_deidara","name":["迪达拉·黏土飞鸟","Deidara · Clay bird"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#c9bd9e","accent":"#fff0c3","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"claybird","craft":{"kind":"anime","detail":"claybird","variant":22,"metal":"#fff0c3","grip":"#c9bd9e","pattern":4},"spell":["claybird","忍术"],"apparition":{"kind":"claybird","duration":700},"effectDescription":["小型白色黏土鸟俯冲，命中后化成紧凑爆光。","A small ivory clay bird dives into a compact explosion flash."]},{"id":"anime_konan","name":["小南·式纸之舞","Konan · Paper dance"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#8289ad","accent":"#e5e6f1","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"paper","craft":{"kind":"anime","detail":"paper","variant":23,"metal":"#e5e6f1","grip":"#8289ad","pattern":5},"spell":["paper","忍术"],"apparition":{"kind":"paper","duration":700},"effectDescription":["五枚带折面的纸刃错位滑行，锐利纸边向落点收拢。","Five folded paper blades glide in staggered paths and converge on the target."]},{"id":"anime_obito","name":["带土·神威","Obito · Kamui"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#b47349","accent":"#edd0a3","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"kamui","craft":{"kind":"anime","detail":"kamui","variant":24,"metal":"#edd0a3","grip":"#b47349","pattern":0},"spell":["kamui","忍术"],"apparition":{"kind":"kamui","duration":700},"effectDescription":["灰紫空间纹向中心旋缩，暗色涡心短暂显现后消失。","Grey-violet distortion bands spiral into a small dark Kamui vortex."]},{"id":"anime_naruto","name":["鸣人·螺旋丸","Naruto · Rasengan"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#e9953f","accent":"#91ddeb","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"rasengan","craft":{"kind":"anime","detail":"rasengan","variant":25,"metal":"#91ddeb","grip":"#e9953f","pattern":1},"spell":["rasengan","忍术"],"apparition":{"kind":"rasengan","duration":700},"effectDescription":["蓝色螺旋丸以三层旋转查克拉前冲，球面高光随转动变化。","A blue Rasengan advances with three rotating chakra bands and spherical highlights."]},{"id":"anime_sasuke","name":["佐助·须佐之矢","Sasuke · Susanoo"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#625080","accent":"#c3a1ed","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"susanoo","craft":{"kind":"anime","detail":"susanoo","variant":26,"metal":"#c3a1ed","grip":"#625080","pattern":2},"spell":["susanoo","忍术"],"apparition":{"kind":"susanoo","duration":700},"effectDescription":["紫色须佐之矢沿直线射出，箭锋命中后留下短促紫白冲击。","A straight purple Susanoo arrow ends in a brief violet-white impact."]},{"id":"anime_hashirama","name":["柱间·木龙","Hashirama · Wood dragon"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#697957","accent":"#ccb989","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"wooddragon","craft":{"kind":"anime","detail":"wooddragon","variant":27,"metal":"#ccb989","grip":"#697957","pattern":3},"spell":["wooddragon","忍术"],"apparition":{"kind":"wooddragon","duration":700},"effectDescription":["带木纹的短木龙沿弧线前冲，龙首与木质尾迹随收势消退。","A compact wood dragon follows a short arc with a carved head and grained wake."]},{"id":"anime_madara","name":["斑·天碍震星","Madara · Shattered heaven"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#7a4856","accent":"#adcde7","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"meteor","craft":{"kind":"anime","detail":"meteor","variant":28,"metal":"#adcde7","grip":"#7a4856","pattern":4},"spell":["meteor","忍术"],"apparition":{"kind":"meteor","duration":700},"effectDescription":["一枚棱面陨石短距离斜落，命中时释放集中的沉重冲击。","A single faceted meteor falls a short distance into a focused heavy impact."]},{"id":"anime_sixpaths","name":["鸣人·六道仙人","Naruto · Six Paths"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#e4b752","accent":"#fff0b8","barSize":0.38,"control":1.18,"hidden":true,"animeAction":"sixpaths","craft":{"kind":"anime","detail":"sixpaths","variant":29,"metal":"#fff0b8","grip":"#e4b752","pattern":5},"spell":["sixpaths","忍术"],"apparition":{"kind":"sixpaths","duration":700},"effectDescription":["六道协力 · 每竿首次进度耗尽恢复至 35%，张力增长减少 20%；金色螺旋丸配合短暂求道玉残影。","Six Paths support · one recovery to 35% progress per cast; 20% less tension gain. A golden Rasengan with brief dark orb afterimages."],"progressRescue":0.35,"tensionMultiplier":0.8},{"id":"anime_usopp","name":["乌索普·黑兜","Usopp · Black kabuto"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#618b38","accent":"#ffd25b","barSize":0.26,"control":1,"hidden":false,"animeAction":"slingshot","craft":{"kind":"anime","detail":"slingshot","variant":30,"metal":"#ffd25b","grip":"#618b38","pattern":30},"spell":["slingshot","航海技能"],"apparition":{"kind":"slingshot","duration":700},"effectDescription":["种子弹带短尾迹飞向落点，命中散出少量碎光。","A seed shot leaves a short trail and a small hit burst."]},{"id":"anime_chopper","name":["乔巴·刻蹄","Chopper · Hoof print"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#f366a7","accent":"#63cdf2","barSize":0.26,"control":1,"hidden":false,"animeAction":"hoof","craft":{"kind":"anime","detail":"hoof","variant":31,"metal":"#63cdf2","grip":"#f366a7","pattern":30},"spell":["hoof","航海技能"],"apparition":{"kind":"hoof","duration":700},"effectDescription":["短促蹄影前冲，命中时出现小范围冲击环。","A compact hoof-like punch ends in a small impact ring."]},{"id":"anime_brook","name":["布鲁克·灵魂剑","Brook · Soul solid"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#e9f4ff","accent":"#62d6f5","barSize":0.26,"control":1,"hidden":false,"animeAction":"soul","craft":{"kind":"anime","detail":"soul","variant":32,"metal":"#62d6f5","grip":"#e9f4ff","pattern":30},"spell":["soul","航海技能"],"apparition":{"kind":"soul","duration":700},"effectDescription":["一道冰白斩击掠过落点，剑气迅速散去。","An icy pale slash crosses the target and fades quickly."]},{"id":"anime_franky","name":["弗兰奇·风来炮","Franky · Coup de vent"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#ec4748","accent":"#6edafa","barSize":0.26,"control":1,"hidden":false,"animeAction":"cannon","craft":{"kind":"anime","detail":"cannon","variant":33,"metal":"#6edafa","grip":"#ec4748","pattern":30},"spell":["cannon","航海技能"],"apparition":{"kind":"cannon","duration":700},"effectDescription":["短光束直击落点，炮击亮芯迅速收束。","A short cannon beam strikes the target and contracts."]},{"id":"anime_buggy","name":["巴基·四分五裂","Buggy · Chop chop"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#ee534f","accent":"#82d5fa","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"split","craft":{"kind":"anime","detail":"split","variant":34,"metal":"#82d5fa","grip":"#ee534f","pattern":30},"spell":["split","航海技能"],"apparition":{"kind":"split","duration":700},"effectDescription":["两道分离飞刀斩先后切入，白色锋线命中后短促消退。","Two separated knife slashes arrive in sequence, with brief white cutting edges."]},{"id":"anime_perona","name":["佩罗娜·幽灵","Perona · Hollow"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#ed63aa","accent":"#fceaf7","barSize":0.26,"control":1,"hidden":false,"animeAction":"ghost","craft":{"kind":"anime","detail":"ghost","variant":35,"metal":"#fceaf7","grip":"#ed63aa","pattern":30},"spell":["ghost","航海技能"],"apparition":{"kind":"ghost","duration":700},"effectDescription":["两道淡白气流掠过落点后散去。","Two pale wisps sweep over the target and dissolve."]},{"id":"anime_crocodile","name":["克洛克达尔·沙漠金钩","Crocodile · Desert hook"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#d1a32c","accent":"#fff1ac","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"sandhook","craft":{"kind":"anime","detail":"sandhook","variant":36,"metal":"#fff1ac","grip":"#d1a32c","pattern":30},"spell":["sandhook","航海技能"],"apparition":{"kind":"sandhook","duration":700},"effectDescription":["弧形沙刃掠过落点，细沙沿斩击尾迹散落。","A sand crescent crosses the catch with a granular wake."]},{"id":"anime_kuma","name":["熊·肉球冲击","Kuma · Paw shock"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#233655","accent":"#f6c2da","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"paw","craft":{"kind":"anime","detail":"paw","variant":37,"metal":"#f6c2da","grip":"#233655","pattern":30},"spell":["paw","航海技能"],"apparition":{"kind":"paw","duration":700},"effectDescription":["半透明肉球压力波前推，接触时展开压缩空气冲击。","A translucent paw pressure wave expands into a compressed-air impact."]},{"id":"anime_nami","name":["娜美·天候棒","Nami · Clima-tact"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#35c4e8","accent":"#ffc850","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"weather","craft":{"kind":"anime","detail":"weather","variant":38,"metal":"#ffc850","grip":"#35c4e8","pattern":30},"spell":["weather","航海技能"],"apparition":{"kind":"weather","duration":700},"effectDescription":["一记短雷击落在咬钩处，电光迅速消退。","A brief lightning strike hits the bite point."]},{"id":"anime_sanji","name":["山治·恶魔风脚","Sanji · Diable jambe"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#242944","accent":"#ffba46","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"firekick","craft":{"kind":"anime","detail":"firekick","variant":39,"metal":"#ffba46","grip":"#242944","pattern":30},"spell":["firekick","航海技能"],"apparition":{"kind":"firekick","duration":700},"effectDescription":["火焰轨迹配合一记弧形踢击，命中后收势。","A flame trail follows a single curved kick."]},{"id":"anime_robin","name":["罗宾·百花缭乱","Robin · Cien fleur"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#8c55b8","accent":"#ffbedc","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"bloom","craft":{"kind":"anime","detail":"bloom","variant":40,"metal":"#ffbedc","grip":"#8c55b8","pattern":30},"spell":["bloom","航海技能"],"apparition":{"kind":"bloom","duration":700},"effectDescription":["三道小拳影错时连击，命中后迅速淡出。","Three compact punches arrive in staggered succession."]},{"id":"anime_jinbe","name":["甚平·海流过肩摔","Jinbe · Ocean current"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#178fd1","accent":"#ffa24e","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"current","craft":{"kind":"anime","detail":"current","variant":41,"metal":"#ffa24e","grip":"#178fd1","pattern":30},"spell":["current","航海技能"],"apparition":{"kind":"current","duration":700},"effectDescription":["鱼人空手道水拳前冲，三层水环和水滴随命中散开。","Fish-Man Karate sends a water punch with three pressure rings and scattering droplets."]},{"id":"anime_smoker","name":["斯摩格·白蔓","Smoker · White snake"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#dcefe8","accent":"#569c9f","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"smoke","craft":{"kind":"anime","detail":"smoke","variant":42,"metal":"#569c9f","grip":"#dcefe8","pattern":30},"spell":["smoke","航海技能"],"apparition":{"kind":"smoke","duration":700},"effectDescription":["短白色气流掠过落点，随后自然散去。","A short white current dissipates at the target."]},{"id":"anime_vivi","name":["薇薇·孔雀锁链","Vivi · Peacock slasher"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#48d4e8","accent":"#fee765","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"peacock","craft":{"kind":"anime","detail":"peacock","variant":43,"metal":"#fee765","grip":"#48d4e8","pattern":30},"spell":["peacock","航海技能"],"apparition":{"kind":"peacock","duration":700},"effectDescription":["两道交错斩击短暂展开，随后收束。","Two crossing slashes open briefly and recede."]},{"id":"anime_aokiji","name":["库赞·冰块暴雉嘴","Kuzan · Ice pheasant"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#79cdf5","accent":"#eefeff","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"icebird","craft":{"kind":"anime","detail":"icebird","variant":44,"metal":"#eefeff","grip":"#79cdf5","pattern":30},"spell":["icebird","航海技能"],"apparition":{"kind":"icebird","duration":700},"effectDescription":["三道细窄冰锋前冲，命中散出冷白碎光。","Three narrow ice streaks scatter pale light on impact."]},{"id":"anime_kizaru","name":["黄猿·八尺琼勾玉","Kizaru · Light jewels"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#ffcb3d","accent":"#fff8b4","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"lightbeads","craft":{"kind":"anime","detail":"lightbeads","variant":45,"metal":"#fff8b4","grip":"#ffcb3d","pattern":30},"spell":["lightbeads","航海技能"],"apparition":{"kind":"lightbeads","duration":700},"effectDescription":["金色短光束直击落点，亮芯迅速淡出。","A brief golden beam strikes and quickly fades."]},{"id":"anime_doflamingo","name":["多弗朗明哥·五色线","Doflamingo · Five strings"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#fa6bba","accent":"#f9e4e9","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"strings","craft":{"kind":"anime","detail":"strings","variant":46,"metal":"#f9e4e9","grip":"#fa6bba","pattern":30},"spell":["strings","航海技能"],"apparition":{"kind":"strings","duration":700},"effectDescription":["五条锋利细线错时收拢，沿落点切出清晰线斩。","Five fine cutting threads converge in a staggered strike."]},{"id":"anime_zoro","name":["索隆·三刀流","Zoro · Three swords"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#3d9b58","accent":"#e9e4cf","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"threesword","craft":{"kind":"anime","detail":"threesword","variant":47,"metal":"#e9e4cf","grip":"#3d9b58","pattern":30},"spell":["threesword","航海技能"],"apparition":{"kind":"threesword","duration":700},"effectDescription":["三道窄斩击错时交叉，刃光随后收束。","Three narrow slashes cross in quick succession."]},{"id":"anime_ace","name":["艾斯·炎戒","Ace · Flame command"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#ff682b","accent":"#ffdb55","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"flame","craft":{"kind":"anime","detail":"flame","variant":48,"metal":"#ffdb55","grip":"#ff682b","pattern":30},"spell":["flame","航海技能"],"apparition":{"kind":"flame","duration":700},"effectDescription":["橙金火焰带短尾迹前冲，命中散出少量火光。","An orange-gold flame streak ends in a compact flare."]},{"id":"anime_sabo","name":["萨博·龙爪拳","Sabo · Dragon claw"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#265da8","accent":"#ffbe5a","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"dragonclaw","craft":{"kind":"anime","detail":"dragonclaw","variant":49,"metal":"#ffbe5a","grip":"#265da8","pattern":30},"spell":["dragonclaw","航海技能"],"apparition":{"kind":"dragonclaw","duration":700},"effectDescription":["三道短爪击交错划过落点，随后淡出。","Three brief claw strikes cross the target."]},{"id":"anime_law","name":["罗·ROOM","Law · ROOM"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#e8c344","accent":"#a3eff4","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"room","craft":{"kind":"anime","detail":"room","variant":50,"metal":"#a3eff4","grip":"#e8c344","pattern":30},"spell":["room","航海技能"],"apparition":{"kind":"room","duration":700},"effectDescription":["小范围 ROOM 光环在落点展开后迅速缩回。","A compact ROOM ring opens at the target and recedes."]},{"id":"anime_hancock","name":["汉库克·芳香脚","Hancock · Perfume femur"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#de2c69","accent":"#fff0c2","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"stone","craft":{"kind":"anime","detail":"stone","variant":51,"metal":"#fff0c2","grip":"#de2c69","pattern":30},"spell":["stone","航海技能"],"apparition":{"kind":"stone","duration":700},"effectDescription":["粉白斩击短促命中，收成轻薄冲击环。","A pale pink strike ends in a thin impact ring."]},{"id":"anime_enel","name":["艾尼路·雷龙","Enel · Lightning dragon"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#f7c445","accent":"#a9e9ff","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"thunderdragon","craft":{"kind":"anime","detail":"thunderdragon","variant":52,"metal":"#a9e9ff","grip":"#f7c445","pattern":30},"spell":["thunderdragon","航海技能"],"apparition":{"kind":"thunderdragon","duration":700},"effectDescription":["集中的青白雷击直落水面，电光快速消散。","A concentrated blue-white bolt strikes the water."]},{"id":"anime_katakuri","name":["卡塔库栗·糯团拳","Katakuri · Mochi fist"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#8d284f","accent":"#fff0df","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"mochi","craft":{"kind":"anime","detail":"mochi","variant":53,"metal":"#fff0df","grip":"#8d284f","pattern":30},"spell":["mochi","航海技能"],"apparition":{"kind":"mochi","duration":700},"effectDescription":["厚实糯团拳影前冲，残影与冲击环随即散去。","A mochi punch leaves brief afterimages and an impact ring."]},{"id":"anime_marco","name":["马尔科·不死鸟","Marco · Phoenix"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#1ebeea","accent":"#ffe367","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"phoenixbird","craft":{"kind":"anime","detail":"phoenixbird","variant":54,"metal":"#ffe367","grip":"#1ebeea","pattern":30},"spell":["phoenixbird","航海技能"],"apparition":{"kind":"phoenixbird","duration":700},"effectDescription":["青蓝火焰轨迹前冲，命中留下短促火光。","A blue flame streak ends in a brief flare."]},{"id":"anime_luffy","name":["路飞·橡胶手","Luffy · Rubber hand"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#ef3b35","accent":"#ffd45b","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"rubber","craft":{"kind":"anime","detail":"rubber","variant":55,"metal":"#ffd45b","grip":"#ef3b35","pattern":30},"spell":["rubber","航海技能"],"apparition":{"kind":"rubber","duration":700},"effectDescription":["橡胶拳影前冲，命中时收成短促冲击环。","A rubber punch afterimage ends in a compact impact ring."]},{"id":"anime_shanks","name":["香克斯·神避","Shanks · Divine departure"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#98213e","accent":"#f6db8c","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"haki","craft":{"kind":"anime","detail":"haki","variant":56,"metal":"#f6db8c","grip":"#98213e","pattern":30},"spell":["haki","航海技能"],"apparition":{"kind":"haki","duration":700},"effectDescription":["红黑斩击配合短促霸气裂光，命中后收势。","A red-black slash ends with a brief Haki fracture."]},{"id":"anime_whitebeard","name":["白胡子·震震","Whitebeard · Tremor"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#f5eee2","accent":"#ffbf56","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"quake","craft":{"kind":"anime","detail":"quake","variant":57,"metal":"#ffbf56","grip":"#f5eee2","pattern":30},"spell":["quake","航海技能"],"apparition":{"kind":"quake","duration":700},"effectDescription":["一道沉重斩击命中，短裂纹随冲击消退。","A heavy slash creates brief quake cracks at impact."]},{"id":"anime_mihawk","name":["米霍克·黑刀夜","Mihawk · Black blade"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#24243a","accent":"#f1cb56","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"blackblade","craft":{"kind":"anime","detail":"blackblade","variant":58,"metal":"#f1cb56","grip":"#24243a","pattern":30},"spell":["blackblade","航海技能"],"apparition":{"kind":"blackblade","duration":700},"effectDescription":["一记青白色斩击掠过落点，刃光收束消散。","A single green-white slash contracts and disappears."]},{"id":"anime_nika","name":["路飞·太阳神尼卡","Luffy · Sun god Nika"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#fdf4e7","accent":"#ffca57","barSize":0.38,"control":1.18,"hidden":true,"animeAction":"nika","craft":{"kind":"anime","detail":"nika","variant":59,"metal":"#ffca57","grip":"#fdf4e7","pattern":30},"spell":["nika","航海技能"],"apparition":{"kind":"nika","duration":700},"effectDescription":["解放之鼓 · 20% 概率直接上鱼；正常遛鱼首次断线回弹救回。白色拳影短促连击。","Drums of liberation · 20% instant catch; one line-break rescue per cast. Brief white punch afterimages."],"instantCatchChance":0.2,"tensionRescue":0.35},{"id":"anime_alvida","name":["亚尔丽塔·铁棒","Alvida · Iron mace"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#a64065","accent":"#f2c990","barSize":0.26,"control":1,"hidden":false,"animeAction":"ironmace","craft":{"kind":"anime","detail":"ironmace","variant":60,"metal":"#f2c990","grip":"#a64065","pattern":30},"spell":["ironmace","航海技能"],"apparition":{"kind":"ironmace","duration":700},"effectDescription":["铁棒重击带出一道短风压，命中时迸出紧凑冲击。","A heavy iron-mace strike ends in a compact shock burst."],"collectionRevision":2},{"id":"anime_kuro","name":["克洛·猫爪","Kuro · Cat claws"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#303d46","accent":"#c6e4e5","barSize":0.26,"control":1,"hidden":false,"animeAction":"catclaw","craft":{"kind":"anime","detail":"catclaw","variant":61,"metal":"#c6e4e5","grip":"#303d46","pattern":30},"spell":["catclaw","航海技能"],"apparition":{"kind":"catclaw","duration":700},"effectDescription":["五道细长爪痕错时交叉，银色刃尖迅速收势。","Five slim claw slashes cross in a quick silver-edged strike."],"collectionRevision":2},{"id":"anime_jango","name":["赞高·催眠环","Jango · Hypnotic ring"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#4b967b","accent":"#ebc978","barSize":0.26,"control":1,"hidden":false,"animeAction":"hypnotic","craft":{"kind":"anime","detail":"hypnotic","variant":62,"metal":"#ebc978","grip":"#4b967b","pattern":30},"spell":["hypnotic","航海技能"],"apparition":{"kind":"hypnotic","duration":700},"effectDescription":["催眠环沿短弧旋出，两圈淡金波纹在落点收拢。","A spinning hypnotic ring sends two brief golden ripples."],"collectionRevision":2},{"id":"anime_wapol","name":["瓦波尔·吞吞","Wapol · Munch munch"],"rarity":"common","collection":"onepiece","family":"fantasy","color":"#71658d","accent":"#d7d7bd","barSize":0.26,"control":1,"hidden":false,"animeAction":"munch","craft":{"kind":"anime","detail":"munch","variant":63,"metal":"#d7d7bd","grip":"#71658d","pattern":30},"spell":["munch","航海技能"],"apparition":{"kind":"munch","duration":700},"effectDescription":["两道钢齿轮廓短暂咬合，金属碎光随冲击散去。","Two steel-jaw contours close briefly with a few metallic sparks."],"collectionRevision":2},{"id":"anime_koby","name":["克比·剃","Koby · Shave"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#df97ac","accent":"#e5f3ef","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"shave","craft":{"kind":"anime","detail":"shave","variant":64,"metal":"#e5f3ef","grip":"#df97ac","pattern":30},"spell":["shave","航海技能"],"apparition":{"kind":"shave","duration":700},"effectDescription":["剃步残影先行，拳锋沿直线突进后迅速收势。","Shave afterimages lead a quick straight punch."],"collectionRevision":2},{"id":"anime_tashigi","name":["达斯琪·时雨","Tashigi · Shigure"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#396898","accent":"#d2edf1","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"shigure","craft":{"kind":"anime","detail":"shigure","variant":65,"metal":"#d2edf1","grip":"#396898","pattern":30},"spell":["shigure","航海技能"],"apparition":{"kind":"shigure","duration":700},"effectDescription":["时雨划出一道冷白斩击，细窄刃光与蓝色尾迹交叠。","Shigure draws a pale slash with a narrow blue trailing edge."],"collectionRevision":2},{"id":"anime_bartolomeo","name":["巴托洛米奥·屏障","Bartolomeo · Barrier"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#52b99b","accent":"#bdf2b3","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"barrier","craft":{"kind":"anime","detail":"barrier","variant":66,"metal":"#bdf2b3","grip":"#52b99b","pattern":30},"spell":["barrier","航海技能"],"apparition":{"kind":"barrier","duration":700},"effectDescription":["半透明绿屏障短暂前推，边缘受击后向内收束。","A translucent green barrier pushes forward and contracts after impact."],"collectionRevision":2},{"id":"anime_bellamy","name":["贝拉米·弹簧狙击","Bellamy · Spring snipe"],"rarity":"rare","collection":"onepiece","family":"fantasy","color":"#a46c4d","accent":"#e6d295","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"spring","craft":{"kind":"anime","detail":"spring","variant":67,"metal":"#e6d295","grip":"#a46c4d","pattern":30},"spell":["spring","航海技能"],"apparition":{"kind":"spring","duration":700},"effectDescription":["弹簧先压缩再回弹，拳影随短促螺旋尾迹射出。","A compressed spring releases a punch with a short coiled wake."],"collectionRevision":2},{"id":"anime_moria","name":["莫利亚·影切","Moria · Shadow cut"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#544666","accent":"#d09dc5","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"shadowcut","craft":{"kind":"anime","detail":"shadowcut","variant":68,"metal":"#d09dc5","grip":"#544666","pattern":30},"spell":["shadowcut","航海技能"],"apparition":{"kind":"shadowcut","duration":700},"effectDescription":["紫黑影刃交叉剪过落点，蝠形影屑随收势散去。","Purple-black shadow blades cross and shed a few bat-shaped fragments."],"collectionRevision":2},{"id":"anime_weevil","name":["威布尔·薙刀重斩","Weevil · Heavy glaive"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#657793","accent":"#efdfa0","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"heavyglaive","craft":{"kind":"anime","detail":"heavyglaive","variant":69,"metal":"#efdfa0","grip":"#657793","pattern":30},"spell":["heavyglaive","航海技能"],"apparition":{"kind":"heavyglaive","duration":700},"effectDescription":["沉重薙刀斩出宽窄分明的刃弧，命中爆开短风压。","A heavy glaive draws a weighted arc and a short pressure burst."],"collectionRevision":2},{"id":"anime_yamatooni","name":["大和·冰诸斩","Yamato · Ice strike"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#53959a","accent":"#d5f7ee","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"iceclub","craft":{"kind":"anime","detail":"iceclub","variant":70,"metal":"#d5f7ee","grip":"#53959a","pattern":30},"spell":["iceclub","航海技能"],"apparition":{"kind":"iceclub","duration":700},"effectDescription":["冷白冰锋随棒击前冲，少量冰晶沿冲击方向散开。","An icy club strike scatters a few sharp white-blue crystals."],"collectionRevision":2},{"id":"anime_bonney","name":["波妮·扭曲未来","Bonney · Distorted future"],"rarity":"epic","collection":"onepiece","family":"fantasy","color":"#d878a6","accent":"#f9d2a3","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"futurepunch","craft":{"kind":"anime","detail":"futurepunch","variant":71,"metal":"#f9d2a3","grip":"#d878a6","pattern":30},"spell":["futurepunch","航海技能"],"apparition":{"kind":"futurepunch","duration":700},"effectDescription":["粉白拳影由小变大，命中后迅速回收，保留未来变形的节奏。","A pink-white fist grows into a brief impact and quickly contracts."],"collectionRevision":2},{"id":"anime_blackbeard","name":["黑胡子·暗水","Blackbeard · Black vortex"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#3d304e","accent":"#c8a0d4","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"darkquake","craft":{"kind":"anime","detail":"darkquake","variant":72,"metal":"#c8a0d4","grip":"#3d304e","pattern":30},"spell":["darkquake","航海技能"],"apparition":{"kind":"darkquake","duration":700},"effectDescription":["暗水涡流短暂吸向落点，随后迸出少量震震裂光。","A dark inward vortex closes at the target, followed by short quake fractures."],"collectionRevision":2},{"id":"anime_kaido","name":["凯多·雷鸣八卦","Kaido · Thunder bagua"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#44415d","accent":"#d695d2","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"thunderbagua","craft":{"kind":"anime","detail":"thunderbagua","variant":73,"metal":"#d695d2","grip":"#44415d","pattern":30},"spell":["thunderbagua","航海技能"],"apparition":{"kind":"thunderbagua","duration":700},"effectDescription":["沉重棒击与紫黑雷痕同时前冲，雷鸣冲击快速收束。","A heavy club impact carries concentrated purple-black lightning."],"collectionRevision":2},{"id":"anime_bigmom","name":["玲玲·皇帝剑","Big Mom · Emperor sword"],"rarity":"legendary","collection":"onepiece","family":"fantasy","color":"#b64069","accent":"#ffd18e","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"emperorsword","craft":{"kind":"anime","detail":"emperorsword","variant":74,"metal":"#ffd18e","grip":"#b64069","pattern":30},"spell":["emperorsword","航海技能"],"apparition":{"kind":"emperorsword","duration":700},"effectDescription":["皇帝剑斩出橙金火刃，刀口亮芯与短火舌一同消退。","An orange-gold Emperor Sword slash leaves a bright edge and short flames."],"collectionRevision":2},{"id":"anime_konohamaru","name":["木叶丸·螺旋丸","Konohamaru · Rasengan"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#426998","accent":"#aed8ed","barSize":0.26,"control":1,"hidden":false,"animeAction":"smallrasengan","craft":{"kind":"anime","detail":"smallrasengan","variant":75,"metal":"#aed8ed","grip":"#426998","pattern":30},"spell":["smallrasengan","忍术"],"apparition":{"kind":"smallrasengan","duration":700},"effectDescription":["小型蓝色螺旋丸先聚拢再突进，接触时旋纹散开。","A compact blue Rasengan gathers, advances and releases its spiral."]},{"id":"anime_ebisu","name":["惠比寿·基础忍具","Ebisu · Ninja tools"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#384c66","accent":"#d5ddd4","barSize":0.26,"control":1,"hidden":false,"animeAction":"trainingkunai","craft":{"kind":"anime","detail":"trainingkunai","variant":76,"metal":"#d5ddd4","grip":"#384c66","pattern":30},"spell":["trainingkunai","忍术"],"apparition":{"kind":"trainingkunai","duration":700},"effectDescription":["单枚制式苦无快速掠过，留下短促钢刃残影。","A standard kunai passes with a short steel afterimage."]},{"id":"anime_genma","name":["玄间·千本","Genma · Senbon"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#66764d","accent":"#e1e3cc","barSize":0.26,"control":1,"hidden":false,"animeAction":"senbon","craft":{"kind":"anime","detail":"senbon","variant":77,"metal":"#e1e3cc","grip":"#66764d","pattern":30},"spell":["senbon","忍术"],"apparition":{"kind":"senbon","duration":700},"effectDescription":["三枚千本错时射向落点，银亮针尖迅速收势。","Three staggered senbon converge with fine silver points."]},{"id":"anime_izumo","name":["出云·水饴拿原","Izumo · Syrup field"],"rarity":"common","collection":"naruto","family":"fantasy","color":"#506d6b","accent":"#b5dcd0","barSize":0.26,"control":1,"hidden":false,"animeAction":"syrup","craft":{"kind":"anime","detail":"syrup","variant":78,"metal":"#b5dcd0","grip":"#506d6b","pattern":30},"spell":["syrup","忍术"],"apparition":{"kind":"syrup","duration":700},"effectDescription":["青绿色黏液沿水面铺展，再向落点收拢消散。","A blue-green syrup ribbon spreads along the surface and contracts."]},{"id":"anime_kurenai","name":["红·魔幻树缚","Kurenai · Tree binding"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#953b4a","accent":"#e3cfba","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"illusiontree","craft":{"kind":"anime","detail":"illusiontree","variant":79,"metal":"#e3cfba","grip":"#953b4a","pattern":30},"spell":["illusiontree","忍术"],"apparition":{"kind":"illusiontree","duration":700},"effectDescription":["树影沿落点合拢，枝条与红色幻术波纹一起散去。","Illusory branches close with brief crimson distortion."]},{"id":"anime_anko","name":["红豆·潜影蛇手","Anko · Hidden snakes"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#6b5882","accent":"#d8c9ac","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"snakes","craft":{"kind":"anime","detail":"snakes","variant":80,"metal":"#d8c9ac","grip":"#6b5882","pattern":30},"spell":["snakes","忍术"],"apparition":{"kind":"snakes","duration":700},"effectDescription":["两条蛇影交错前伸，蛇首到达落点后迅速回收。","Two interwoven snakes strike and withdraw."]},{"id":"anime_haku","name":["白·魔镜冰晶","Haku · Ice mirrors"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#6dabb0","accent":"#e4f6ee","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"icemirrors","craft":{"kind":"anime","detail":"icemirrors","variant":81,"metal":"#e4f6ee","grip":"#6dabb0","pattern":30},"spell":["icemirrors","忍术"],"apparition":{"kind":"icemirrors","duration":700},"effectDescription":["冰镜先合围，再射出交错千本与冷白冰屑。","Ice mirrors form before crossed senbon and white ice shards."]},{"id":"anime_zabuza","name":["再不斩·斩首大刀","Zabuza · Executioner blade"],"rarity":"rare","collection":"naruto","family":"fantasy","color":"#74868b","accent":"#d6e0dc","barSize":0.3,"control":1.06,"hidden":false,"animeAction":"executioner","craft":{"kind":"anime","detail":"executioner","variant":82,"metal":"#d6e0dc","grip":"#74868b","pattern":30},"spell":["executioner","忍术"],"apparition":{"kind":"executioner","duration":700},"effectDescription":["斩首大刀挥出宽阔银刃，冷雾沿刀背短暂拖曳。","The Executioner blade sweeps a broad silver edge through short mist."]},{"id":"anime_kisame","name":["鬼鲛·大鲛弹","Kisame · Great shark"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#425c83","accent":"#adc8dc","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"shark","craft":{"kind":"anime","detail":"shark","variant":83,"metal":"#adc8dc","grip":"#425c83","pattern":30},"spell":["shark","忍术"],"apparition":{"kind":"shark","duration":700},"effectDescription":["鲨形水弹扭身前冲，张开的水流在命中后碎成浪花。","A shark-shaped water projectile twists forward and breaks into foam."]},{"id":"anime_hidan","name":["飞段·三月镰","Hidan · Triple scythe"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#a72d39","accent":"#e1c7ba","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"triplescythe","craft":{"kind":"anime","detail":"triplescythe","variant":84,"metal":"#e1c7ba","grip":"#a72d39","pattern":30},"spell":["triplescythe","忍术"],"apparition":{"kind":"triplescythe","duration":700},"effectDescription":["三月镰划出三道错层红刃，牵引绳随收势拉回。","Three staggered crimson scythe arcs recoil with their tether."]},{"id":"anime_sasori","name":["蝎·赤秘技","Sasori · Red secret"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#8d4a3b","accent":"#e0bc88","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"hundredpuppets","craft":{"kind":"anime","detail":"hundredpuppets","variant":85,"metal":"#e0bc88","grip":"#8d4a3b","pattern":30},"spell":["hundredpuppets","忍术"],"apparition":{"kind":"hundredpuppets","duration":700},"effectDescription":["傀儡刀臂随查克拉线依次合击，关节残影快速归位。","Articulated puppet blades converge on blue chakra strings."]},{"id":"anime_tsunade","name":["纲手·怪力","Tsunade · Strength"],"rarity":"epic","collection":"naruto","family":"fantasy","color":"#42785b","accent":"#e9cc91","barSize":0.34,"control":1.12,"hidden":false,"animeAction":"heavenkick","craft":{"kind":"anime","detail":"heavenkick","variant":86,"metal":"#e9cc91","grip":"#42785b","pattern":30},"spell":["heavenkick","忍术"],"apparition":{"kind":"heavenkick","duration":700},"effectDescription":["怪力踢击短促下压，接触时张开集中的石屑冲击。","A forceful heel drop releases a compact cracked-ground impact."]},{"id":"anime_pain","name":["佩恩·神罗天征","Pain · Almighty push"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#46384f","accent":"#c6a9df","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"almightypush","craft":{"kind":"anime","detail":"almightypush","variant":87,"metal":"#c6a9df","grip":"#46384f","pattern":30},"spell":["almightypush","忍术"],"apparition":{"kind":"almightypush","duration":700},"effectDescription":["透明斥力从落点向外推开，灰白压缩环逐层消散。","A transparent repulsive wave expands into fading pressure rings."]},{"id":"anime_tobirama","name":["扉间·水龙弹","Tobirama · Water dragon"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#416c9d","accent":"#d6edf4","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"waterdragon","craft":{"kind":"anime","detail":"waterdragon","variant":88,"metal":"#d6edf4","grip":"#416c9d","pattern":30},"spell":["waterdragon","忍术"],"apparition":{"kind":"waterdragon","duration":700},"effectDescription":["青蓝水龙沿短弧盘旋前冲，龙首命中后化成水花。","A blue water dragon curls forward and dissolves into spray."]},{"id":"anime_orochimaru","name":["大蛇丸·草薙之剑","Orochimaru · Kusanagi"],"rarity":"legendary","collection":"naruto","family":"fantasy","color":"#76638a","accent":"#e5dbc4","barSize":0.38,"control":1.18,"hidden":false,"animeAction":"kusanagi","craft":{"kind":"anime","detail":"kusanagi","variant":89,"metal":"#e5dbc4","grip":"#76638a","pattern":30},"spell":["kusanagi","忍术"],"apparition":{"kind":"kusanagi","duration":700},"effectDescription":["草薙剑随白蛇伸展突刺，寒亮剑锋与蛇身连贯回收。","Kusanagi thrusts with an extending white snake and smoothly retracts."]},{"id":"valorant_astra","name":["星礈·重力之阱","Astra · Gravity Well"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#5f3d92","accent":"#ebbc6c","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["gravity","nova"],"animeAction":"valorant_astra","craft":{"kind":"anime","detail":"astra","variant":100,"metal":"#ebbc6c","grip":"#5f3d92","pattern":40},"spell":["astra","特工技能"],"apparition":{"kind":"valorant_astra","duration":700},"effectDescription":["每次抛投随机使用「重力之阱」或「新星脉冲」的专属动作。","Each cast randomly uses Gravity Well or Nova Pulse with its own motion."]},{"id":"valorant_breach","name":["铁臂·裂地震击","Breach · Fault Line"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#815530","accent":"#efb964","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["faultline","aftershock"],"animeAction":"valorant_breach","craft":{"kind":"anime","detail":"breach","variant":101,"metal":"#efb964","grip":"#815530","pattern":40},"spell":["breach","特工技能"],"apparition":{"kind":"valorant_breach","duration":700},"effectDescription":["每次抛投随机使用「裂地震击」或「余震」的专属动作。","Each cast randomly uses Fault Line or Aftershock with its own motion."]},{"id":"valorant_brimstone","name":["炼狱·天基光束","Brimstone · Orbital Strike"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#5c6470","accent":"#ea873b","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["orbital","incendiary"],"animeAction":"valorant_brimstone","craft":{"kind":"anime","detail":"brimstone","variant":102,"metal":"#ea873b","grip":"#5c6470","pattern":40},"spell":["brimstone","特工技能"],"apparition":{"kind":"valorant_brimstone","duration":700},"effectDescription":["每次抛投随机使用「天基光束」或「燃烧榴弹」的专属动作。","Each cast randomly uses Orbital Strike or Incendiary with its own motion."]},{"id":"valorant_chamber","name":["尚勃勒·金牌狙击","Chamber · Tour de Force"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#26334b","accent":"#d7b163","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["tour","rendezvous"],"animeAction":"valorant_chamber","craft":{"kind":"anime","detail":"chamber","variant":103,"metal":"#d7b163","grip":"#26334b","pattern":40},"spell":["chamber","特工技能"],"apparition":{"kind":"valorant_chamber","duration":700},"effectDescription":["每次抛投随机使用「金牌狙击」或「贵宾限行」的专属动作。","Each cast randomly uses Tour de Force or Rendezvous with its own motion."]},{"id":"valorant_clove","name":["暮蝶·化蝶","Clove · Meddle"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#806398","accent":"#ed9ac3","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["meddle","ruse"],"animeAction":"valorant_clove","craft":{"kind":"anime","detail":"clove","variant":104,"metal":"#ed9ac3","grip":"#806398","pattern":40},"spell":["clove","特工技能"],"apparition":{"kind":"valorant_clove","duration":700},"effectDescription":["每次抛投随机使用「化蝶」或「霞染」的专属动作。","Each cast randomly uses Meddle or Ruse with its own motion."]},{"id":"valorant_cypher","name":["零·赛博囚笼","Cypher · Cyber Cage"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#b9b4a2","accent":"#78cee7","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["cage","tripwire"],"animeAction":"valorant_cypher","craft":{"kind":"anime","detail":"cypher","variant":105,"metal":"#78cee7","grip":"#b9b4a2","pattern":40},"spell":["cypher","特工技能"],"apparition":{"kind":"valorant_cypher","duration":700},"effectDescription":["每次抛投随机使用「赛博囚笼」或「绊线」的专属动作。","Each cast randomly uses Cyber Cage or Trapwire with its own motion."]},{"id":"valorant_deadlock","name":["钢锁·死亡终点","Deadlock · Annihilation"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#6b7787","accent":"#acdce6","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["annihilation","barrier"],"animeAction":"valorant_deadlock","craft":{"kind":"anime","detail":"deadlock","variant":106,"metal":"#acdce6","grip":"#6b7787","pattern":40},"spell":["deadlock","特工技能"],"apparition":{"kind":"valorant_deadlock","duration":700},"effectDescription":["每次抛投随机使用「死亡终点」或「阻域屏障」的专属动作。","Each cast randomly uses Annihilation or Barrier Mesh with its own motion."]},{"id":"valorant_fade","name":["黑梦·黯兽","Fade · Prowler"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#343a49","accent":"#90b5c5","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["prowler","haunt"],"animeAction":"valorant_fade","craft":{"kind":"anime","detail":"fade","variant":107,"metal":"#90b5c5","grip":"#343a49","pattern":40},"spell":["fade","特工技能"],"apparition":{"kind":"valorant_fade","duration":700},"effectDescription":["每次抛投随机使用「黯兽」或「诡眼」的专属动作。","Each cast randomly uses Prowler or Haunt with its own motion."]},{"id":"valorant_gekko","name":["盖可·顽皮搭档","Gekko · Wingman"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#93833e","accent":"#afdf75","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["wingman","dizzy"],"animeAction":"valorant_gekko","craft":{"kind":"anime","detail":"gekko","variant":108,"metal":"#afdf75","grip":"#93833e","pattern":40},"spell":["gekko","特工技能"],"apparition":{"kind":"valorant_gekko","duration":700},"effectDescription":["每次抛投随机使用「顽皮搭档」或「眩晕伙伴」的专属动作。","Each cast randomly uses Wingman or Dizzy with its own motion."]},{"id":"valorant_harbor","name":["海神·狂潮","Harbor · High Tide"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#3c766f","accent":"#d5bc79","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["hightide","cove"],"animeAction":"valorant_harbor","craft":{"kind":"anime","detail":"harbor","variant":109,"metal":"#d5bc79","grip":"#3c766f","pattern":40},"spell":["harbor","特工技能"],"apparition":{"kind":"valorant_harbor","duration":700},"effectDescription":["每次抛投随机使用「狂潮」或「海盾」的专属动作。","Each cast randomly uses High Tide or Cove with its own motion."]},{"id":"valorant_iso","name":["壹决·步步为营","Iso · Contingency"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#62628e","accent":"#b9a5f4","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["contingency","undercut"],"animeAction":"valorant_iso","craft":{"kind":"anime","detail":"iso","variant":110,"metal":"#b9a5f4","grip":"#62628e","pattern":40},"spell":["iso","特工技能"],"apparition":{"kind":"valorant_iso","duration":700},"effectDescription":["每次抛投随机使用「步步为营」或「离析」的专属动作。","Each cast randomly uses Contingency or Undercut with its own motion."]},{"id":"valorant_jett","name":["捷风·飓刃","Jett · Blade Storm"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#639eae","accent":"#d2edf1","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["blades","tailwind"],"animeAction":"valorant_jett","craft":{"kind":"anime","detail":"jett","variant":111,"metal":"#d2edf1","grip":"#639eae","pattern":40},"spell":["jett","特工技能"],"apparition":{"kind":"valorant_jett","duration":700},"effectDescription":["每次抛投随机使用「飓刃」或「逐风」的专属动作。","Each cast randomly uses Blade Storm or Tailwind with its own motion."]},{"id":"valorant_kayo","name":["KAY/O·零点嗅探","KAY/O · ZERO/POINT"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#49566b","accent":"#b596f3","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["zero","null"],"animeAction":"valorant_kayo","craft":{"kind":"anime","detail":"kayo","variant":112,"metal":"#b596f3","grip":"#49566b","pattern":40},"spell":["kayo","特工技能"],"apparition":{"kind":"valorant_kayo","duration":700},"effectDescription":["每次抛投随机使用「零点嗅探」或「无效命令」的专属动作。","Each cast randomly uses ZERO/POINT or NULL/CMD with its own motion."]},{"id":"valorant_killjoy","name":["奇乐·自动哨兵","Killjoy · Turret"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#c5a539","accent":"#63cbb7","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["turret","nanoswarm"],"animeAction":"valorant_killjoy","craft":{"kind":"anime","detail":"killjoy","variant":113,"metal":"#63cbb7","grip":"#c5a539","pattern":40},"spell":["killjoy","特工技能"],"apparition":{"kind":"valorant_killjoy","duration":700},"effectDescription":["每次抛投随机使用「自动哨兵」或「纳米蜂群」的专属动作。","Each cast randomly uses Turret or Nanoswarm with its own motion."]},{"id":"valorant_miks","name":["Miks·声脉装置","Miks · M-pulse"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#9c713e","accent":"#a9e465","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["mpulse","harmonize"],"animeAction":"valorant_miks","craft":{"kind":"anime","detail":"miks","variant":114,"metal":"#a9e465","grip":"#9c713e","pattern":40},"spell":["miks","特工技能"],"apparition":{"kind":"valorant_miks","duration":700},"effectDescription":["每次抛投随机使用「声脉装置」或「协同谐振」的专属动作。","Each cast randomly uses M-pulse or Harmonize with its own motion."]},{"id":"valorant_neon","name":["霓虹·超限暴走","Neon · Overdrive"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#335dac","accent":"#ebde78","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["overdrive","relay"],"animeAction":"valorant_neon","craft":{"kind":"anime","detail":"neon","variant":115,"metal":"#ebde78","grip":"#335dac","pattern":40},"spell":["neon","特工技能"],"apparition":{"kind":"valorant_neon","duration":700},"effectDescription":["每次抛投随机使用「超限暴走」或「闪电弹球」的专属动作。","Each cast randomly uses Overdrive or Relay Bolt with its own motion."]},{"id":"valorant_omen","name":["幽影·梦魇","Omen · Paranoia"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#41375b","accent":"#70d4ed","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["paranoia","darkcover"],"animeAction":"valorant_omen","craft":{"kind":"anime","detail":"omen","variant":116,"metal":"#70d4ed","grip":"#41375b","pattern":40},"spell":["omen","特工技能"],"apparition":{"kind":"valorant_omen","duration":700},"effectDescription":["每次抛投随机使用「梦魇」或「黑魇」的专属动作。","Each cast randomly uses Paranoia or Dark Cover with its own motion."]},{"id":"valorant_phoenix","name":["不死鸟·火眼金睛","Phoenix · Curveball"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#bd6b3f","accent":"#ffce78","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["curveball","hothands"],"animeAction":"valorant_phoenix","craft":{"kind":"anime","detail":"phoenix","variant":117,"metal":"#ffce78","grip":"#bd6b3f","pattern":40},"spell":["phoenix","特工技能"],"apparition":{"kind":"valorant_phoenix","duration":700},"effectDescription":["每次抛投随机使用「火眼金睛」或「炙热闪焰」的专属动作。","Each cast randomly uses Curveball or Hot Hands with its own motion."]},{"id":"valorant_raze","name":["雷兹·晚安焰火","Raze · Showstopper"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#b36732","accent":"#e4ca68","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["showstopper","boombot"],"animeAction":"valorant_raze","craft":{"kind":"anime","detail":"raze","variant":118,"metal":"#e4ca68","grip":"#b36732","pattern":40},"spell":["raze","特工技能"],"apparition":{"kind":"valorant_raze","duration":700},"effectDescription":["每次抛投随机使用「晚安焰火」或「花车巡游」的专属动作。","Each cast randomly uses Showstopper or Boom Bot with its own motion."]},{"id":"valorant_reyna","name":["芮娜·睥睨","Reyna · Leer"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#52305e","accent":"#db86df","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["leer","devour"],"animeAction":"valorant_reyna","craft":{"kind":"anime","detail":"reyna","variant":119,"metal":"#db86df","grip":"#52305e","pattern":40},"spell":["reyna","特工技能"],"apparition":{"kind":"valorant_reyna","duration":700},"effectDescription":["每次抛投随机使用「睥睨」或「噬尽」的专属动作。","Each cast randomly uses Leer or Devour with its own motion."]},{"id":"valorant_sage","name":["贤者·薄冰","Sage · Slow Orb"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#609e95","accent":"#c7f0dd","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["slow","barrier"],"animeAction":"valorant_sage","craft":{"kind":"anime","detail":"sage","variant":120,"metal":"#c7f0dd","grip":"#609e95","pattern":40},"spell":["sage","特工技能"],"apparition":{"kind":"valorant_sage","duration":700},"effectDescription":["每次抛投随机使用「薄冰」或「玉城」的专属动作。","Each cast randomly uses Slow Orb or Barrier Orb with its own motion."]},{"id":"valorant_skye","name":["斯凯·引路之隼","Skye · Guiding Light"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#6c8145","accent":"#c5d593","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["hawk","tiger"],"animeAction":"valorant_skye","craft":{"kind":"anime","detail":"skye","variant":121,"metal":"#c5d593","grip":"#6c8145","pattern":40},"spell":["skye","特工技能"],"apparition":{"kind":"valorant_skye","duration":700},"effectDescription":["每次抛投随机使用「引路之隼」或「辟林之虎」的专属动作。","Each cast randomly uses Guiding Light or Trailblazer with its own motion."]},{"id":"valorant_sova","name":["猎枭·震击箭","Sova · Shock Bolt"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#597e98","accent":"#b7d9e9","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["shock","recon"],"animeAction":"valorant_sova","craft":{"kind":"anime","detail":"sova","variant":122,"metal":"#b7d9e9","grip":"#597e98","pattern":40},"spell":["sova","特工技能"],"apparition":{"kind":"valorant_sova","duration":700},"effectDescription":["每次抛投随机使用「震击箭」或「寻敌箭」的专属动作。","Each cast randomly uses Shock Bolt or Recon Bolt with its own motion."]},{"id":"valorant_tejo","name":["钛狐·精准制导","Tejo · Guided Salvo"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#8b6444","accent":"#e69d4f","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["salvo","armageddon"],"animeAction":"valorant_tejo","craft":{"kind":"anime","detail":"tejo","variant":123,"metal":"#e69d4f","grip":"#8b6444","pattern":40},"spell":["tejo","特工技能"],"apparition":{"kind":"valorant_tejo","duration":700},"effectDescription":["每次抛投随机使用「精准制导」或「末日浩劫」的专属动作。","Each cast randomly uses Guided Salvo or Armageddon with its own motion."]},{"id":"valorant_veto","name":["Veto·异变禁锢","Veto · Chokehold"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#434c4b","accent":"#b2d88e","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["chokehold","interceptor"],"animeAction":"valorant_veto","craft":{"kind":"anime","detail":"veto","variant":124,"metal":"#b2d88e","grip":"#434c4b","pattern":40},"spell":["veto","特工技能"],"apparition":{"kind":"valorant_veto","duration":700},"effectDescription":["每次抛投随机使用「异变禁锢」或「拦截器」的专属动作。","Each cast randomly uses Chokehold or Interceptor with its own motion."]},{"id":"valorant_viper","name":["蝰蛇·瘴云","Viper · Poison Cloud"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#315740","accent":"#9ce667","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["poison","snakebite"],"animeAction":"valorant_viper","craft":{"kind":"anime","detail":"viper","variant":125,"metal":"#9ce667","grip":"#315740","pattern":40},"spell":["viper","特工技能"],"apparition":{"kind":"valorant_viper","duration":700},"effectDescription":["每次抛投随机使用「瘴云」或「蛇吻」的专属动作。","Each cast randomly uses Poison Cloud or Snake Bite with its own motion."]},{"id":"valorant_vyse","name":["维斯·弧光玫瑰","Vyse · Arc Rose"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#564b68","accent":"#d3b1e0","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["arcrose","razorvine"],"animeAction":"valorant_vyse","craft":{"kind":"anime","detail":"vyse","variant":126,"metal":"#d3b1e0","grip":"#564b68","pattern":40},"spell":["vyse","特工技能"],"apparition":{"kind":"valorant_vyse","duration":700},"effectDescription":["每次抛投随机使用「弧光玫瑰」或「剃刀藤蔓」的专属动作。","Each cast randomly uses Arc Rose or Razorvine with its own motion."]},{"id":"valorant_waylay","name":["幻棱·流光溢彩","Waylay · Saturate"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#977655","accent":"#f6e69d","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["saturate","refract"],"animeAction":"valorant_waylay","craft":{"kind":"anime","detail":"waylay","variant":127,"metal":"#f6e69d","grip":"#977655","pattern":40},"spell":["waylay","特工技能"],"apparition":{"kind":"valorant_waylay","duration":700},"effectDescription":["每次抛投随机使用「流光溢彩」或「幻光折返」的专属动作。","Each cast randomly uses Saturate or Refract with its own motion."]},{"id":"valorant_yoru","name":["夜露·攻其不备","Yoru · Blindside"],"rarity":"legendary","collection":"valorant","family":"fantasy","color":"#3d5394","accent":"#a8c9ed","barSize":0.38,"control":1.18,"hidden":false,"valorantSkills":["blindside","gatecrash"],"animeAction":"valorant_yoru","craft":{"kind":"anime","detail":"yoru","variant":128,"metal":"#a8c9ed","grip":"#3d5394","pattern":40},"spell":["yoru","特工技能"],"apparition":{"kind":"valorant_yoru","duration":700},"effectDescription":["每次抛投随机使用「攻其不备」或「不请自来」的专属动作。","Each cast randomly uses Blindside or Gatecrash with its own motion."]},{"id":"valorant_spike","name":["爆能器","Spike"],"rarity":"legendary","hidden":true,"collection":"valorant","family":"fantasy","color":"#343e48","accent":"#97e0e7","barSize":0.38,"control":1.18,"animeAction":"valorant_spike","blastFishing":true,"craft":{"kind":"anime","detail":"spike","variant":129,"metal":"#97e0e7","grip":"#343e48","pattern":40},"spell":["spike","爆能器"],"apparition":{"kind":"valorant_spike","duration":700},"effectDescription":["投入水中后升起并引爆，直接获得 3–5 条鱼；每条售价独立随机为基础价格的 50%–150%，不会获得鱼苗。","Throw, arm and detonate for 3–5 fish. Each is worth a fixed random 50%–150% of its base price; no fingerlings."]}]);
  // END ANIME RODS
  // Pool identities and existing rewards are permanent receipt contracts.
  // Additions are explicit; never derive membership or backfill old poolId fields.
  var ROD_POOLS=[
    {id:'basic',name:['基础奖池','Base collection'],volume:1,description:['溪岸手作、月轮火羽与青龙神兵，最初的十七份水边惊喜。','Seventeen original discoveries, from riverside craft to moonlight, phoenix fire and dragon-forged arms.'],rodIds:['willow','carbon','copper','rosewood','tide','clockwork','frost','jade','moon','phoenix','cloud','astral','dragon','lotus','guandao','katana'],hiddenRodId:'golden',odds:{common:.545,hidden:.005,rare:.30,epic:.12,legendary:.03}},
    {id:'myriad',name:['万象秘藏','Myriad reliquary'],volume:2,description:['栗木与素瓷启程，十件史诗奇珍各藏一段传说；追寻曜日天铸、沧溟海皇与一款尚未揭晓的秘藏。','Begin with chestnut and celadon, discover ten epic wonders, and seek the Solar Crucible, the Leviathan Sovereign and one unrevealed secret.'],rodIds:['walnut','porcelain','citrus','amber','vinyl','nautilus','alpine','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan'],hiddenRodId:'eclipse',odds:{common:.545,hidden:.005,rare:.30,epic:.12,legendary:.03}}
    ,{"id":"journey","name":["西游降魔","Journey · Demon Quelling"],"volume":3,"description":["竹杖西行，九齿破浪；借芭蕉风、三昧火与七星剑意降伏水中精怪，追寻齐天秘藏。","Travel west with pilgrim bamboo, nine-tooth steel, sacred wind and samadhi fire. Seek the Great Sage’s hidden treasure."],"rodIds":["pilgrim","sandalwood","reedraft","monkeytwig","goldenhoop","moonspade","ninerake","whitedragon","kasaya","windfan","redboy","jadebottle","demonmirror","goldenbell","sevenstars","gourd","lotuswheel","ruyi","erlang"],"hiddenRodId":"wukong","odds":{"common":0.545,"hidden":0.005,"rare":0.3,"epic":0.12,"legendary":0.03}}
  ];
  // BEGIN EXPANSION POOLS
  ROD_POOLS.find(function(p){return p.id==='basic';}).rodIds.push.apply(ROD_POOLS.find(function(p){return p.id==='basic';}).rodIds,["beech","rainbamboo","harborbell","kingfisher","reedflute","azulejo","meteor","auroraprism","tidetrident","qilin"]);
  ROD_POOLS.find(function(p){return p.id==='myriad';}).rodIds.push.apply(ROD_POOLS.find(function(p){return p.id==='myriad';}).rodIds,["teaearthen","maplecraft","lanternkite","astrolabe","obsidian","scarabsun","peacock","worldtree","chronoclock","ninephoenix"]);
  ROD_POOLS.find(function(p){return p.id==='journey';}).rodIds.push.apply(ROD_POOLS.find(function(p){return p.id==='journey';}).rodIds,["sutrabundle","cloudshoe","tigercloak","skullbeads","lotusseat","scorpion","spiderweb","whitebone","dragonpalace","bullking"]);
  ROD_POOLS.push({"id":"threekingdoms","name":["三国风云","Three Kingdoms"],"volume":4,"description":["魏、蜀、吴与群雄的 45 款历史奇幻钓竿；其中包含一款隐藏鱼竿。","45 historical fantasy rods of Wei, Shu, Wu and the rival lords; including one concealed secret design."],"rodIds":["peachbough","strawsandals","armoryiron","bambooslip","riverreed","granaryspear","shuembroider","wuanchor","weislate","postbanner","bronzehalberd","wineladle","liubei","caocao","sunquan","huangzhong","weiyan","jiangwei","xuhuang","xuchu","dianwei","zhoutai","ganning","luxun","lusu","zhangliao","wenji","guanyuyunchang","zhangfei","zhaoyun","machao","zhouyu","simayi","pangtong","huangyueying","daqiao","xiaoqiao","diaochan","dongzhuo","zhugeliang","lubu","jiangdongtiger","yuanshao","zuoci"],"hiddenRodId":"emperorjade","odds":{"common":0.545,"hidden":0.005,"rare":0.3,"epic":0.12,"legendary":0.03}});
  ROD_POOLS[0].description=["木作、瓷器与灵兽兵器，共 27 款可抽取鱼竿。","27 collectible rods of timber, porcelain and mythical arms."];
  ROD_POOLS[1].description=["机关、灵兽与自然奇珍，共 30 款鱼竿。","30 rods of mechanisms, creatures and natural wonders."];
  ROD_POOLS[2].description=["西游行者、妖王与仙家法宝，共 30 款鱼竿。","30 rods of pilgrims, demon kings and celestial artifacts."];
  // END EXPANSION POOLS
  ROD_POOLS.push.apply(ROD_POOLS,[
  {
    "id": "naruto",
    "name": [
      "火影忍者鱼竿礼包",
      "NARUTO Rod Collection"
    ],
    "volume": 5,
    "description": [
      "45 款忍具与忍术鱼竿，含隐藏款六道仙人。",
      "45 ninja tools and techniques, including the secret Six Paths rod."
    ],
    "price": 100,
    "rodIds": [
      "anime_iruka",
      "anime_tenten",
      "anime_shikamaru",
      "anime_kiba",
      "anime_shino",
      "anime_asuma",
      "anime_sai",
      "anime_ino",
      "anime_sakura",
      "anime_hinata",
      "anime_neji",
      "anime_lee",
      "anime_temari",
      "anime_kankuro",
      "anime_choji",
      "anime_yamato",
      "anime_suigetsu",
      "anime_gaara",
      "anime_kakashi",
      "anime_itachi",
      "anime_jiraiya",
      "anime_minato",
      "anime_deidara",
      "anime_konan",
      "anime_obito",
      "anime_naruto",
      "anime_sasuke",
      "anime_hashirama",
      "anime_madara",
      "anime_konohamaru",
      "anime_ebisu",
      "anime_genma",
      "anime_izumo",
      "anime_kurenai",
      "anime_anko",
      "anime_haku",
      "anime_zabuza",
      "anime_kisame",
      "anime_hidan",
      "anime_sasori",
      "anime_tsunade",
      "anime_pain",
      "anime_tobirama",
      "anime_orochimaru"
    ],
    "hiddenRodId": "anime_sixpaths",
    "odds": {
      "common": 0.545,
      "hidden": 0.005,
      "rare": 0.3,
      "epic": 0.12,
      "legendary": 0.03
    }
  },
  {
    "id": "onepiece",
    "name": [
      "海贼王鱼竿礼包",
      "ONE PIECE Rod Collection"
    ],
    "volume": 6,
    "description": [
      "45 款角色鱼竿，历任七武海均为史诗或以上，含隐藏款太阳神尼卡。",
      "45 character rods, with every former Warlord at epic or above and a secret Nika rod."
    ],
    "price": 100,
    "rodIds": [
      "anime_usopp",
      "anime_chopper",
      "anime_brook",
      "anime_franky",
      "anime_buggy",
      "anime_perona",
      "anime_crocodile",
      "anime_kuma",
      "anime_nami",
      "anime_sanji",
      "anime_robin",
      "anime_jinbe",
      "anime_smoker",
      "anime_vivi",
      "anime_aokiji",
      "anime_kizaru",
      "anime_doflamingo",
      "anime_zoro",
      "anime_ace",
      "anime_sabo",
      "anime_law",
      "anime_hancock",
      "anime_enel",
      "anime_katakuri",
      "anime_marco",
      "anime_luffy",
      "anime_shanks",
      "anime_whitebeard",
      "anime_mihawk",
      "anime_alvida",
      "anime_kuro",
      "anime_jango",
      "anime_wapol",
      "anime_koby",
      "anime_tashigi",
      "anime_bartolomeo",
      "anime_bellamy",
      "anime_moria",
      "anime_weevil",
      "anime_yamatooni",
      "anime_bonney",
      "anime_blackbeard",
      "anime_kaido",
      "anime_bigmom"
    ],
    "hiddenRodId": "anime_nika",
    "odds": {
      "common": 0.545,
      "hidden": 0.005,
      "rare": 0.3,
      "epic": 0.12,
      "legendary": 0.03
    }
  },
  {
    "id": "valorant",
    "name": [
      "VALORANT 特工装备",
      "VALORANT Agent Gear"
    ],
    "volume": 7,
    "price": 500,
    "description": [
      "29 位特工均为传说品质，每款两套随机技能动作；隐藏款爆能器可直接炸鱼。",
      "29 legendary agents, each with two randomly selected abilities, plus the secret Spike for blast fishing."
    ],
    "rodIds": [
      "valorant_astra",
      "valorant_breach",
      "valorant_brimstone",
      "valorant_chamber",
      "valorant_clove",
      "valorant_cypher",
      "valorant_deadlock",
      "valorant_fade",
      "valorant_gekko",
      "valorant_harbor",
      "valorant_iso",
      "valorant_jett",
      "valorant_kayo",
      "valorant_killjoy",
      "valorant_miks",
      "valorant_neon",
      "valorant_omen",
      "valorant_phoenix",
      "valorant_raze",
      "valorant_reyna",
      "valorant_sage",
      "valorant_skye",
      "valorant_sova",
      "valorant_tejo",
      "valorant_veto",
      "valorant_viper",
      "valorant_vyse",
      "valorant_waylay",
      "valorant_yoru"
    ],
    "hiddenRodId": "valorant_spike",
    "odds": {
      "legendary": 0.995,
      "hidden": 0.005
    }
  }
]);
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
    ['snagglefin','歪牙许愿鳗','Snaggletooth Wish Eel','legendary',350,78,'#668c9e','#edd29a','snagglefin','moon'],
    ['clownfish','珊瑚小丑鱼','Coral clownfish','rare',52,18,'#e99854','#fff0d2','round','sea'],
    ['bluebetta','蓝纱斗鱼','Blue silk betta','rare',68,22,'#467db9','#9bdeed','fancy','river'],
    ['pearljelly','珍珠水母','Pearl jellyfish','epic',155,32,'#ceb5de','#f6e5cb','jelly','deep'],
    ['crownray','星冠鳐','Starcrown ray','legendary',375,66,'#568eaa','#ecd29b','ray','moon'],
    ['bleak','银梭白条','Silver bleak','common',9,16,'#93b7c7','#e5f4ef','slender','river'],
    ['roach','朱眼雅罗','Ruby-eye roach','common',15,25,'#9aada7','#c96556','round','river'],
    ['loach','金沙泥鳅','Golden sand loach','common',14,21,'#a89462','#e2cd85','eel','river'],
    ['bluegill','蓝鳃太阳鱼','Bluegill sunfish','common',19,22,'#6a9b88','#e2bd64','discus','river'],
    ['anchovy','流银鳀鱼','Silver anchovy','common',11,15,'#90b7bd','#e8ede0','slender','sea'],
    ['herring','靛背鲱鱼','Indigo herring','common',17,27,'#587baf','#c9dcdd','slender','sea'],
    ['mullet','浪尖鲻鱼','Wavecrest mullet','common',23,34,'#879c91','#d5d6a8','slender','sea'],
    ['smelt','冰湖银柳','Ice-lake smelt','common',16,20,'#a3d1d2','#e7f4fa','slender','ice'],
    ['pike','苇影狗鱼','Reed-shadow pike','rare',76,65,'#779162','#d7df9c','predator','river'],
    ['bass','青脊大口鲈','Greenback bass','rare',82,46,'#648d6f','#d0db9f','predator','river'],
    ['discus','赤纹七彩神仙','Scarlet discus','rare',74,23,'#d17868','#eec879','discus','river'],
    ['lionfish','赤棘狮子鱼','Vermilion lionfish','rare',88,28,'#b7635c','#f0d1a0','lion','sea'],
    ['tang','蓝金刺尾鱼','Blue-gold tang','rare',70,26,'#487cbd','#efce5b','discus','sea'],
    ['butterflyfish','金面蝶鱼','Golden mask butterflyfish','rare',67,22,'#e3c26b','#535870','discus','sea'],
    ['porcupine','软刺河豚','Soft-spine puffer','rare',84,29,'#ad976d','#f0e2b6','puffer','sea'],
    ['moray','翡翠海鳝','Emerald moray','rare',92,70,'#658e76','#d0d49b','eel','deep'],
    ['flyingfish','银翼飞鱼','Silver-wing flyingfish','rare',79,32,'#739fb8','#c2e7eb','flying','sea'],
    ['icechar','焰腹红点鲑','Ember-belly char','rare',86,42,'#5f9b9d','#eeac80','slender','ice'],
    ['sailfish','碧海旗鱼','Azure sailfish','epic',190,96,'#477f9f','#a3d9df','billfish','sea'],
    ['oarfish','绯冠皇带鱼','Crimson-crown oarfish','epic',185,110,'#acb5c4','#d56673','ribbon','deep'],
    ['leafydragon','翡翠叶海龙','Emerald leafy seadragon','epic',170,38,'#78a773','#d9df9b','seahorse','sea'],
    ['glassoctopus','琉璃八爪','Glass octopus','epic',180,44,'#b2c4d4','#ebd9fa','octopus','deep'],
    ['amberarowana','琥珀金龙鱼','Amber arowana','epic',195,62,'#cf9850','#f5db94','arowana','spirit'],
    ['ribbonmoon','月纱飘带鱼','Moon-silk ribbonfish','epic',200,78,'#b6a3d7','#e8e9fb','ribbon','moon'],
    ['stormmanta','雷潮巨翼鳐','Storm-tide manta','legendary',395,98,'#426a95','#94e1e4','ray','sea'],
    ['emberdrake','焰心赤龙鱼','Emberheart drake','legendary',410,88,'#b9614f','#f5cc77','dragon','spirit'],
    ['abysskraken','深渊星章','Abyssal star kraken','legendary',425,92,'#73598d','#b0e5da','octopus','deep'],
    ['aurorawhale','极光雪鲸','Aurora snow whale','legendary',440,105,'#b0d3dd','#caaae7','whale','ice']
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
    ['歪牙许愿','Crooked-tooth wish','绕着食物弯出一个问号，尾尖抖落两三粒星光。','Curves around its food like a question mark, shaking a few sparks of starlight from its tail.','twirl'],
    ['珊瑚躲猫猫','Reef hide-and-seek','在食粒间左右穿梭，奶白条纹亮起一圈小气泡。','Weaves between morsels, tracing its cream stripes with tiny bubbles.','dart'],
    ['蓝纱开屏','Blue silk fan','把层层蓝纱尾鳍舒展开来，转身轻轻接住食物。','Unfurls its blue silk tail and turns gently to catch its meal.','flutter'],
    ['珍珠脉动','Pearl pulse','收拢透明伞裙，再鼓出一串珍珠般的柔光泡泡。','Contracts its translucent bell, then releases softly glowing pearl bubbles.','bubble'],
    ['星冠环舞','Starcrown dance','展开蓝色双翼盘旋，头顶星冠洒落金色光点。','Circles on blue wings as its star crown scatters golden lights.','twirl']
  ];
  FISH.forEach(function(f,i){var r=FEEDING[i]||({eel:['流绫探食','Ribbon forage','摆动长身，循着水流寻找食物。','Follows the current with a ribbon-like body.','sway'],jelly:['星伞轻舞','Starlit pulse','舒展伞缘与触腕，轻轻拥住食物。','Pulses its bell and gathers food with soft arms.','pulse'],ray:['展翼巡游','Wing patrol','舒展双翼，绕着食物滑翔。','Glides around food on broad wings.','orbit'],whale:['灵鲸换气','Whale rise','浮起换气，再缓缓潜入水中。','Rises to breathe before a gentle dive.','bob'],dragon:['游龙绕珠','Dragon orbit','盘旋游动，追逐一颗水中明珠。','Spirals around a pearl of food.','orbit']}[f.body]||['欢游觅食','Playful forage','轻摆鱼鳍，在水面追逐食物。','Fans its fins and follows food at the surface.','dart']);f.feedingReaction={id:f.id,name:[r[0],r[1]],description:[r[2],r[3]],motion:r[4]};f.feedingHabit=[r[2],r[3]];});
  FISH.slice(28).forEach(function(f,i){var h=[["掠水追粒","Surface chase","贴着水面迅速折返，银背闪亮。","Skims the surface and doubles back with a silver flash.","dart"],["红鳍点食","Redfin nibble","轻摆红鳍，逐颗啄食沉降的谷粒。","Fans its red fins and nibbles each sinking grain.","bob"],["钻沙寻香","Sand forage","胡须轻扫细沙，沿池底寻找食物。","Brushes sand with its barbels while foraging on the bottom.","bottom"],["蓝腮展屏","Bluegill display","张开圆背鳍，蓝色鳃盖一闪再接住食物。","Fans its round dorsal fin and flashes a blue gill cover.","flutter"],["银箭穿梭","Silver dart","细长银身一晃，穿过食物形成的小水圈。","Its slender silver body darts through a ring of food.","dart"],["鲱群回游","Herring school","顺着同伴转向，靛蓝鱼背划出整齐弧线。","Turns with its companions along tidy indigo arcs.","school"],["浪尖探食","Wavecrest forage","在水面轻点几次，再侧身吞下食物。","Touches the surface before turning sideways for a bite.","bob"],["冰晶细跃","Icy flicker","透明鳍尖抖动，像碎冰一样轻轻跃起。","Flicks translucent fins and hops like a shard of ice.","leap"],["苇影伏击","Reed ambush","藏在水草边等待，再迅速伸嘴取食。","Waits beside the reeds before a swift ambush.","dart"],["大口抢食","Bass strike","先向后蓄势，再张开大口吞下食粒。","Draws back, then opens its broad mouth for the meal.","dart"],["赤纹圆舞","Scarlet waltz","圆盘般的鱼身缓缓转动，赤纹随角度变化。","Turns its disk-shaped body to show shifting scarlet bands.","twirl"],["赤棘开屏","Lionfish fan","棘鳍逐根舒展，用胸鳍把食物围在身前。","Unfurls individual spines and surrounds food with its fins.","flutter"],["蓝金摆尾","Blue-gold flick","用金黄尾鳍点水，蓝身绕过珊瑚回头觅食。","Flicks its yellow tail and circles back around the coral.","orbit"],["蝶面侧舞","Butterfly turn","把金色侧面转向你，再轻快地接住食物。","Shows its golden flank before catching a morsel.","twirl"],["软刺鼓气","Soft-spine puff","鼓起圆肚子，软刺舒展后吐出小气泡。","Puffs its round belly, spreads its soft spines and blows bubbles.","bubble"],["翠鳝探洞","Moray peek","从石隙探出头，长身卷成柔软的弯。","Peers from the rocks and curls its long body.","sway"],["银翼滑翔","Silver-wing glide","展开宽胸鳍，在食物上方滑出一条弧线。","Spreads broad fins and glides in an arc above its food.","glide"],["焰腹翻身","Ember-belly roll","轻跃翻身，暖色腹部在冷水中闪过。","Rolls through a small leap, flashing its warm belly.","leap"],["旗帆巡食","Sail patrol","竖起高大的背帆，缓缓绕食物巡游。","Raises its tall dorsal sail and circles the meal.","orbit"],["绯带起舞","Scarlet ribbon dance","带状长身摆出波浪，红冠随水流轻摇。","Its ribbon body ripples beneath a swaying scarlet crest.","sway"],["叶影摇曳","Leafy sway","叶片般的附肢轻摇，竖起身子吸食细粒。","Sways its leafy appendages and sips tiny morsels upright.","sway"],["八腕抱食","Eight-arm embrace","透明腕足逐条伸出，把食物轻轻包住。","Extends translucent arms one by one around its meal.","flutter"],["金鳞迎食","Amber greeting","抬起双须迎向食物，琥珀鳞片泛起暖光。","Raises its twin barbels as amber scales catch the light.","bob"],["月纱回旋","Moon-silk turn","如月纱飘带盘旋，尾尖留下细碎亮点。","Spirals like moonlit silk with a trail of tiny sparks.","twirl"],["雷翼卷潮","Storm-wing sweep","巨翼轻拍，把食物卷进青蓝水纹。","Beats broad wings and gathers food in blue ripples.","flutter"],["焰心腾跃","Emberheart leap","金红鳍脊舒展，跃起时点亮一圈暖光。","Spreads its gold-red ridge and leaps through a warm glow.","leap"],["星腕迎礼","Star-arm greeting","八条星纹腕足依次张开，接住整圈食物。","Opens eight star-marked arms in sequence around the food.","flutter"],["极光鲸歌","Aurora song","浮起吐出柔亮气泡，极光色鳍缓慢摆动。","Rises with luminous bubbles and gently moving aurora fins.","bubble"]][i];f.feedingReaction={id:f.id,name:h.slice(0,2),description:h.slice(2,4),motion:h[4]};f.feedingHabit=h.slice(2,4);});
  // BEGIN EXPANSION FISH
  FISH.push.apply(FISH,[
    {
  "id": "dace",
  "name": [
    "柳叶溪哥",
    "Willow dace"
  ],
  "rarity": "common",
  "price": 12,
  "baseLength": 19,
  "color": "#8eaaa1",
  "accent": "#e0d5ad",
  "body": "slender",
  "habitat": "river",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "stream",
  "marking": "stripe",
  "artVariant": 0,
  "feedingReaction": {
    "id": "dace",
    "name": [
      "柳叶溪哥觅食",
      "Willow dace feeding"
    ],
    "description": [
      "贴着水草折返，侧面的柳叶银纹一闪而过。",
      "Darts through the reeds, flashing a silver stripe along its side."
    ],
    "motion": "dart"
  },
  "feedingHabit": [
    "贴着水草折返，侧面的柳叶银纹一闪而过。",
    "Darts through the reeds, flashing a silver stripe along its side."
  ],
  "depth": "mid"
},
    {
  "id": "barbel",
  "name": [
    "铜须鲃鱼",
    "Copper barbel"
  ],
  "rarity": "common",
  "price": 21,
  "baseLength": 34,
  "color": "#a8946f",
  "accent": "#deb984",
  "body": "slender",
  "habitat": "river",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "barbel",
  "marking": "scales",
  "artVariant": 1,
  "feedingReaction": {
    "id": "barbel",
    "name": [
      "铜须鲃鱼觅食",
      "Copper barbel feeding"
    ],
    "description": [
      "四根短须扫过砂砾，低头吸取沉底食粒。",
      "Four barbels sweep the gravel before the mouth picks up sunken food."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "四根短须扫过砂砾，低头吸取沉底食粒。",
    "Four barbels sweep the gravel before the mouth picks up sunken food."
  ],
  "depth": "mid"
},
    {
  "id": "tench",
  "name": [
    "苔绿丁鱥",
    "Moss tench"
  ],
  "rarity": "common",
  "price": 22,
  "baseLength": 31,
  "color": "#617c55",
  "accent": "#c9ac60",
  "body": "round",
  "habitat": "river",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "rounded",
  "marking": "freckles",
  "artVariant": 2,
  "feedingReaction": {
    "id": "tench",
    "name": [
      "苔绿丁鱥觅食",
      "Moss tench feeding"
    ],
    "description": [
      "圆尾轻摆，停在食物下方慢慢啄食。",
      "Gently fans its rounded tail while taking small bites below the food."
    ],
    "motion": "bob"
  },
  "feedingHabit": [
    "圆尾轻摆，停在食物下方慢慢啄食。",
    "Gently fans its rounded tail while taking small bites below the food."
  ],
  "depth": "mid"
},
    {
  "id": "gudgeon",
  "name": [
    "石斑鮈鱼",
    "Pebble gudgeon"
  ],
  "rarity": "common",
  "price": 13,
  "baseLength": 16,
  "color": "#a4987c",
  "accent": "#ded6b7",
  "body": "slender",
  "habitat": "river",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "barbel",
  "marking": "saddles",
  "artVariant": 3,
  "feedingReaction": {
    "id": "gudgeon",
    "name": [
      "石斑鮈鱼觅食",
      "Pebble gudgeon feeding"
    ],
    "description": [
      "沿石缝贴底前进，短须探到食粒后停下。",
      "Pauses at stone crevices when its short barbels find food."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "沿石缝贴底前进，短须探到食粒后停下。",
    "Pauses at stone crevices when its short barbels find food."
  ],
  "depth": "mid"
},
    {
  "id": "bitterling",
  "name": [
    "胭脂鳑鲏",
    "Rose bitterling"
  ],
  "rarity": "common",
  "price": 14,
  "baseLength": 12,
  "color": "#b88988",
  "accent": "#d8be86",
  "body": "discus",
  "habitat": "river",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "disk",
  "marking": "stripe",
  "artVariant": 4,
  "feedingReaction": {
    "id": "bitterling",
    "name": [
      "胭脂鳑鲏觅食",
      "Rose bitterling feeding"
    ],
    "description": [
      "立起短背鳍，转身时露出胭脂色腹部。",
      "Raises its short dorsal fin and turns to reveal a rose-colored belly."
    ],
    "motion": "flutter"
  },
  "feedingHabit": [
    "立起短背鳍，转身时露出胭脂色腹部。",
    "Raises its short dorsal fin and turns to reveal a rose-colored belly."
  ],
  "depth": "mid"
},
    {
  "id": "rivercrab",
  "name": [
    "青壳河蟹",
    "River crab"
  ],
  "rarity": "common",
  "price": 18,
  "baseLength": 14,
  "color": "#617b67",
  "accent": "#c7b48b",
  "body": "crab",
  "habitat": "river",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "crab",
  "marking": "scutes",
  "artVariant": 5,
  "feedingReaction": {
    "id": "rivercrab",
    "name": [
      "青壳河蟹觅食",
      "River crab feeding"
    ],
    "description": [
      "八条步足交错横移，小螯轮流把食物送到嘴边。",
      "Eight walking legs step sideways while the claws alternate at the mouth."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "八条步足交错横移，小螯轮流把食物送到嘴边。",
    "Eight walking legs step sideways while the claws alternate at the mouth."
  ],
  "depth": "near"
},
    {
  "id": "glassshrimp",
  "name": [
    "透甲河虾",
    "Glass shrimp"
  ],
  "rarity": "common",
  "price": 12,
  "baseLength": 10,
  "color": "#b6cec5",
  "accent": "#e1dbc0",
  "body": "shrimp",
  "habitat": "river",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "shrimp",
  "marking": "segments",
  "artVariant": 6,
  "feedingReaction": {
    "id": "glassshrimp",
    "name": [
      "透甲河虾觅食",
      "Glass shrimp feeding"
    ],
    "description": [
      "触须先探向食物，腹节一收，倒退半步再靠近。",
      "Antennae reach ahead; the abdomen flexes into a short backward tail flick."
    ],
    "motion": "dart"
  },
  "feedingHabit": [
    "触须先探向食物，腹节一收，倒退半步再靠近。",
    "Antennae reach ahead; the abdomen flexes into a short backward tail flick."
  ],
  "depth": "near"
},
    {
  "id": "sandgoby",
  "name": [
    "沙纹虾虎",
    "Sand goby"
  ],
  "rarity": "common",
  "price": 13,
  "baseLength": 13,
  "color": "#b59e7c",
  "accent": "#e6d4ac",
  "body": "round",
  "habitat": "sea",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "goby",
  "marking": "saddles",
  "artVariant": 7,
  "feedingReaction": {
    "id": "sandgoby",
    "name": [
      "沙纹虾虎觅食",
      "Sand goby feeding"
    ],
    "description": [
      "用腹鳍停在沙面，张开扇形胸鳍拾取食物。",
      "Rests on the sand and spreads broad pectoral fins to reach food."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "用腹鳍停在沙面，张开扇形胸鳍拾取食物。",
    "Rests on the sand and spreads broad pectoral fins to reach food."
  ],
  "depth": "mid"
},
    {
  "id": "wrasse",
  "name": [
    "青带隆头鱼",
    "Greenband wrasse"
  ],
  "rarity": "common",
  "price": 23,
  "baseLength": 25,
  "color": "#669d88",
  "accent": "#c7b867",
  "body": "slender",
  "habitat": "sea",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "reef",
  "marking": "stripe",
  "artVariant": 8,
  "feedingReaction": {
    "id": "wrasse",
    "name": [
      "青带隆头鱼觅食",
      "Greenband wrasse feeding"
    ],
    "description": [
      "侧身穿过礁石，青绿长背鳍微微起伏。",
      "Turns between rocks with its continuous dorsal fin gently undulating."
    ],
    "motion": "orbit"
  },
  "feedingHabit": [
    "侧身穿过礁石，青绿长背鳍微微起伏。",
    "Turns between rocks with its continuous dorsal fin gently undulating."
  ],
  "depth": "mid"
},
    {
  "id": "sandflounder",
  "name": [
    "沙地比目鱼",
    "Sand flounder"
  ],
  "rarity": "common",
  "price": 25,
  "baseLength": 28,
  "color": "#b29d79",
  "accent": "#dcd1ab",
  "body": "flatfish",
  "habitat": "sea",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "flatfish",
  "marking": "freckles",
  "artVariant": 9,
  "feedingReaction": {
    "id": "sandflounder",
    "name": [
      "沙地比目鱼觅食",
      "Sand flounder feeding"
    ],
    "description": [
      "扁平身体贴底滑行，两眼一同转向落下的食物。",
      "Glides flat along the bottom while both upward-facing eyes track the food."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "扁平身体贴底滑行，两眼一同转向落下的食物。",
    "Glides flat along the bottom while both upward-facing eyes track the food."
  ],
  "depth": "near"
},
    {
  "id": "rockling",
  "name": [
    "岩须鳕鱼",
    "Rockling"
  ],
  "rarity": "common",
  "price": 24,
  "baseLength": 29,
  "color": "#8a8174",
  "accent": "#d0bc97",
  "body": "slender",
  "habitat": "sea",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "barbel",
  "marking": "freckles",
  "artVariant": 10,
  "feedingReaction": {
    "id": "rockling",
    "name": [
      "岩须鳕鱼觅食",
      "Rockling feeding"
    ],
    "description": [
      "伸出颏须试探岩角，再摆动连续的长背鳍。",
      "Tests the rock with its chin barbels and fans its long dorsal fin."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "伸出颏须试探岩角，再摆动连续的长背鳍。",
    "Tests the rock with its chin barbels and fans its long dorsal fin."
  ],
  "depth": "mid"
},
    {
  "id": "hermitcrab",
  "name": [
    "橘螺寄居蟹",
    "Amber hermit crab"
  ],
  "rarity": "common",
  "price": 20,
  "baseLength": 14,
  "color": "#bb825b",
  "accent": "#e4c090",
  "body": "hermit",
  "habitat": "sea",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "hermit",
  "marking": "spiral",
  "artVariant": 11,
  "feedingReaction": {
    "id": "hermitcrab",
    "name": [
      "橘螺寄居蟹觅食",
      "Amber hermit crab feeding"
    ],
    "description": [
      "先伸出双眼和小螯，拖着旋纹螺壳挪向食物。",
      "Eyes and claws emerge first; walking legs then carry the shell toward food."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "先伸出双眼和小螯，拖着旋纹螺壳挪向食物。",
    "Eyes and claws emerge first; walking legs then carry the shell toward food."
  ],
  "depth": "near"
},
    {
  "id": "cockle",
  "name": [
    "蜜纹鸟蛤",
    "Honey cockle"
  ],
  "rarity": "common",
  "price": 15,
  "baseLength": 10,
  "color": "#c8a16e",
  "accent": "#f1ddae",
  "body": "shell",
  "habitat": "sea",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "cockle",
  "marking": "ribs",
  "artVariant": 12,
  "feedingReaction": {
    "id": "cockle",
    "name": [
      "蜜纹鸟蛤觅食",
      "Honey cockle feeding"
    ],
    "description": [
      "两片放射纹贝壳轻轻张合，滤入漂浮的食粒。",
      "Radial valves open and close gently to filter suspended food."
    ],
    "motion": "pulse"
  },
  "feedingHabit": [
    "两片放射纹贝壳轻轻张合，滤入漂浮的食粒。",
    "Radial valves open and close gently to filter suspended food."
  ],
  "depth": "near"
},
    {
  "id": "mudskipper",
  "name": [
    "跳跳弹涂鱼",
    "Mudskipper"
  ],
  "rarity": "common",
  "price": 19,
  "baseLength": 20,
  "color": "#8b9b8b",
  "accent": "#d3bb88",
  "body": "round",
  "habitat": "sea",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "goby",
  "marking": "spots",
  "artVariant": 13,
  "feedingReaction": {
    "id": "mudskipper",
    "name": [
      "跳跳弹涂鱼觅食",
      "Mudskipper feeding"
    ],
    "description": [
      "凸起的双眼先抬高，胸鳍撑地向前跳一小步。",
      "Pushes from its pectoral fins into a short hop along the bottom."
    ],
    "motion": "leap"
  },
  "feedingHabit": [
    "凸起的双眼先抬高，胸鳍撑地向前跳一小步。",
    "Pushes from its pectoral fins into a short hop along the bottom."
  ],
  "depth": "mid"
},
    {
  "id": "icewhitefish",
  "name": [
    "雪鳞白鲑",
    "Snow whitefish"
  ],
  "rarity": "common",
  "price": 24,
  "baseLength": 33,
  "color": "#aebfbe",
  "accent": "#e1e2d5",
  "body": "slender",
  "habitat": "ice",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "salmon",
  "marking": "scales",
  "artVariant": 14,
  "feedingReaction": {
    "id": "icewhitefish",
    "name": [
      "雪鳞白鲑觅食",
      "Snow whitefish feeding"
    ],
    "description": [
      "银白鱼群齐齐转向，尾柄带起细小水纹。",
      "Cruises in steady turns with synchronized tail strokes."
    ],
    "motion": "school"
  },
  "feedingHabit": [
    "银白鱼群齐齐转向，尾柄带起细小水纹。",
    "Cruises in steady turns with synchronized tail strokes."
  ],
  "depth": "mid"
},
    {
  "id": "arcticcod",
  "name": [
    "霜背极鳕",
    "Arctic cod"
  ],
  "rarity": "common",
  "price": 25,
  "baseLength": 30,
  "color": "#8fadb8",
  "accent": "#d3d7c1",
  "body": "slender",
  "habitat": "ice",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "cod",
  "marking": "spots",
  "artVariant": 15,
  "feedingReaction": {
    "id": "arcticcod",
    "name": [
      "霜背极鳕觅食",
      "Arctic cod feeding"
    ],
    "description": [
      "三段背鳍依次摆动，沿冷水层缓缓取食。",
      "Its chin barbel probes ahead while three dorsal fins steady its course."
    ],
    "motion": "glide"
  },
  "feedingHabit": [
    "三段背鳍依次摆动，沿冷水层缓缓取食。",
    "Its chin barbel probes ahead while three dorsal fins steady its course."
  ],
  "depth": "mid"
},
    {
  "id": "snowcrab",
  "name": [
    "雪足小蟹",
    "Snow crab"
  ],
  "rarity": "common",
  "price": 27,
  "baseLength": 24,
  "color": "#bcada1",
  "accent": "#efe0cd",
  "body": "crab",
  "habitat": "ice",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "longcrab",
  "marking": "scutes",
  "artVariant": 16,
  "feedingReaction": {
    "id": "snowcrab",
    "name": [
      "雪足小蟹觅食",
      "Snow crab feeding"
    ],
    "description": [
      "细长步足撑开，浅色螯尖捡起沉底的碎食。",
      "Long jointed walking legs carry the carapace sideways."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "细长步足撑开，浅色螯尖捡起沉底的碎食。",
    "Long jointed walking legs carry the carapace sideways."
  ],
  "depth": "near"
},
    {
  "id": "redshrimp",
  "name": [
    "深海赤虾",
    "Deep red shrimp"
  ],
  "rarity": "common",
  "price": 25,
  "baseLength": 17,
  "color": "#bd6d64",
  "accent": "#eab797",
  "body": "shrimp",
  "habitat": "deep",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "shrimp",
  "marking": "segments",
  "artVariant": 17,
  "feedingReaction": {
    "id": "redshrimp",
    "name": [
      "深海赤虾觅食",
      "Deep red shrimp feeding"
    ],
    "description": [
      "长触须探过黑暗，红色腹节一弓便跃向食物。",
      "Swimmerets paddle beneath the abdomen before the tail fan folds."
    ],
    "motion": "dart"
  },
  "feedingHabit": [
    "长触须探过黑暗，红色腹节一弓便跃向食物。",
    "Swimmerets paddle beneath the abdomen before the tail fan folds."
  ],
  "depth": "deep"
},
    {
  "id": "seaurchin",
  "name": [
    "紫棘海胆",
    "Violet urchin"
  ],
  "rarity": "common",
  "price": 23,
  "baseLength": 12,
  "color": "#6e597f",
  "accent": "#ba9bb2",
  "body": "urchin",
  "habitat": "deep",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "urchin",
  "marking": "spines",
  "artVariant": 18,
  "feedingReaction": {
    "id": "seaurchin",
    "name": [
      "紫棘海胆觅食",
      "Violet urchin feeding"
    ],
    "description": [
      "管足缓慢挪动，长短相间的紫棘随水轻摇。",
      "Radial spines protect the test while tube feet creep toward food."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "管足缓慢挪动，长短相间的紫棘随水轻摇。",
    "Radial spines protect the test while tube feet creep toward food."
  ],
  "depth": "deep"
},
    {
  "id": "mosscrab",
  "name": [
    "苔衣小蟹",
    "Mosscoat crab"
  ],
  "rarity": "common",
  "price": 26,
  "baseLength": 15,
  "color": "#66885c",
  "accent": "#c9cf8b",
  "body": "crab",
  "habitat": "spirit",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "mosscrab",
  "marking": "scutes",
  "artVariant": 19,
  "feedingReaction": {
    "id": "mosscrab",
    "name": [
      "苔衣小蟹觅食",
      "Mosscoat crab feeding"
    ],
    "description": [
      "背上的小叶随步足摇晃，双螯把食粒拢成一堆。",
      "Walking legs carry the mossy shell slowly across the bottom."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "背上的小叶随步足摇晃，双螯把食粒拢成一堆。",
    "Walking legs carry the mossy shell slowly across the bottom."
  ],
  "depth": "near"
},
    {
  "id": "reedturtle",
  "name": [
    "芦纹小龟",
    "Reed turtle"
  ],
  "rarity": "common",
  "price": 28,
  "baseLength": 18,
  "color": "#78835a",
  "accent": "#cbb979",
  "body": "turtle",
  "habitat": "spirit",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "turtle",
  "marking": "scutes",
  "artVariant": 20,
  "feedingReaction": {
    "id": "reedturtle",
    "name": [
      "芦纹小龟觅食",
      "Reed turtle feeding"
    ],
    "description": [
      "划动四只短足，伸出带芦纹的小脑袋接住食物。",
      "Four webbed feet paddle in alternating strokes beneath the scuted shell."
    ],
    "motion": "glide"
  },
  "feedingHabit": [
    "划动四只短足，伸出带芦纹的小脑袋接住食物。",
    "Four webbed feet paddle in alternating strokes beneath the scuted shell."
  ],
  "depth": "near"
},
    {
  "id": "starshrimp",
  "name": [
    "星点小虾",
    "Star-speck shrimp"
  ],
  "rarity": "common",
  "price": 29,
  "baseLength": 13,
  "color": "#9699bc",
  "accent": "#ead9ad",
  "body": "shrimp",
  "habitat": "moon",
  "difficulty": 0.25,
  "fry": false,
  "expansion": 2,
  "anatomy": "shrimp",
  "marking": "stars",
  "artVariant": 21,
  "feedingReaction": {
    "id": "starshrimp",
    "name": [
      "星点小虾觅食",
      "Star-speck shrimp feeding"
    ],
    "description": [
      "背甲的细点泛光，尾扇一合便倒退着接住食物。",
      "Star-marked abdominal plates curl into a quick tail flick."
    ],
    "motion": "dart"
  },
  "feedingHabit": [
    "背甲的细点泛光，尾扇一合便倒退着接住食物。",
    "Star-marked abdominal plates curl into a quick tail flick."
  ],
  "depth": "near"
},
    {
  "id": "mandarin",
  "name": [
    "桂花鳜鱼",
    "Osmanthus mandarin perch"
  ],
  "rarity": "rare",
  "price": 85,
  "baseLength": 42,
  "color": "#8c965e",
  "accent": "#debf77",
  "body": "predator",
  "habitat": "river",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "perch",
  "marking": "saddles",
  "artVariant": 22,
  "feedingReaction": {
    "id": "mandarin",
    "name": [
      "桂花鳜鱼觅食",
      "Osmanthus mandarin perch feeding"
    ],
    "description": [
      "斑驳身体停在水草间，忽然张嘴吞下食粒。",
      "Spiny dorsal rays rise before a short, deliberate strike at food."
    ],
    "motion": "dart"
  },
  "feedingHabit": [
    "斑驳身体停在水草间，忽然张嘴吞下食粒。",
    "Spiny dorsal rays rise before a short, deliberate strike at food."
  ],
  "depth": "mid"
},
    {
  "id": "softshell",
  "name": [
    "青背小鳖",
    "Softshell turtle"
  ],
  "rarity": "rare",
  "price": 88,
  "baseLength": 28,
  "color": "#7d8f6e",
  "accent": "#d0bc83",
  "body": "turtle",
  "habitat": "river",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "softshell",
  "marking": "freckles",
  "artVariant": 23,
  "feedingReaction": {
    "id": "softshell",
    "name": [
      "青背小鳖觅食",
      "Softshell turtle feeding"
    ],
    "description": [
      "扁平软甲轻轻起伏，长鼻先探出水面再潜回取食。",
      "Its leathery shell stays low as webbed feet sweep and the long snout probes."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "扁平软甲轻轻起伏，长鼻先探出水面再潜回取食。",
    "Its leathery shell stays low as webbed feet sweep and the long snout probes."
  ],
  "depth": "near"
},
    {
  "id": "crayfish",
  "name": [
    "赤钳螯虾",
    "Crimson crayfish"
  ],
  "rarity": "rare",
  "price": 76,
  "baseLength": 19,
  "color": "#a45848",
  "accent": "#e0aa78",
  "body": "lobster",
  "habitat": "river",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "crayfish",
  "marking": "segments",
  "artVariant": 24,
  "feedingReaction": {
    "id": "crayfish",
    "name": [
      "赤钳螯虾觅食",
      "Crimson crayfish feeding"
    ],
    "description": [
      "双钳张合后抬起，尾扇把身体稳稳撑在食粒旁。",
      "Four pairs of walking legs advance while the large claws pick up food."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "双钳张合后抬起，尾扇把身体稳稳撑在食粒旁。",
    "Four pairs of walking legs advance while the large claws pick up food."
  ],
  "depth": "near"
},
    {
  "id": "boxfish",
  "name": [
    "柠黄箱鲀",
    "Lemon boxfish"
  ],
  "rarity": "rare",
  "price": 78,
  "baseLength": 24,
  "color": "#d8bd59",
  "accent": "#645c46",
  "body": "boxfish",
  "habitat": "sea",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "boxfish",
  "marking": "spots",
  "artVariant": 25,
  "feedingReaction": {
    "id": "boxfish",
    "name": [
      "柠黄箱鲀觅食",
      "Lemon boxfish feeding"
    ],
    "description": [
      "方方的骨甲几乎不动，小胸鳍像螺旋桨一样拨水。",
      "Tiny pectoral fins hold the armored body level while its mouth pecks."
    ],
    "motion": "bob"
  },
  "feedingHabit": [
    "方方的骨甲几乎不动，小胸鳍像螺旋桨一样拨水。",
    "Tiny pectoral fins hold the armored body level while its mouth pecks."
  ],
  "depth": "mid"
},
    {
  "id": "triggerfish",
  "name": [
    "彩鞍扳机鲀",
    "Saddle triggerfish"
  ],
  "rarity": "rare",
  "price": 82,
  "baseLength": 31,
  "color": "#708d95",
  "accent": "#e4be63",
  "body": "discus",
  "habitat": "sea",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "trigger",
  "marking": "saddles",
  "artVariant": 26,
  "feedingReaction": {
    "id": "triggerfish",
    "name": [
      "彩鞍扳机鲀觅食",
      "Saddle triggerfish feeding"
    ],
    "description": [
      "收起背棘，靠上下两片鳍稳稳悬在食物旁。",
      "The dorsal trigger rises as the body turns and the tail fans."
    ],
    "motion": "flutter"
  },
  "feedingHabit": [
    "收起背棘，靠上下两片鳍稳稳悬在食物旁。",
    "The dorsal trigger rises as the body turns and the tail fans."
  ],
  "depth": "mid"
},
    {
  "id": "mandarinfish",
  "name": [
    "锦缎麒麟鱼",
    "Brocade dragonet"
  ],
  "rarity": "rare",
  "price": 87,
  "baseLength": 16,
  "color": "#518ca3",
  "accent": "#e99b56",
  "body": "round",
  "habitat": "sea",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "dragonet",
  "marking": "maze",
  "artVariant": 27,
  "feedingReaction": {
    "id": "mandarinfish",
    "name": [
      "锦缎麒麟鱼觅食",
      "Brocade dragonet feeding"
    ],
    "description": [
      "蓝橙纹路沿侧鳍舒展，腹鳍踩着礁面一点点前移。",
      "Broad patterned pectoral fins flutter in short hovering movements."
    ],
    "motion": "flutter"
  },
  "feedingHabit": [
    "蓝橙纹路沿侧鳍舒展，腹鳍踩着礁面一点点前移。",
    "Broad patterned pectoral fins flutter in short hovering movements."
  ],
  "depth": "mid"
},
    {
  "id": "bluelobster",
  "name": [
    "钴蓝龙虾",
    "Cobalt lobster"
  ],
  "rarity": "rare",
  "price": 96,
  "baseLength": 38,
  "color": "#447d9e",
  "accent": "#b8d4cf",
  "body": "lobster",
  "habitat": "sea",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "lobster",
  "marking": "segments",
  "artVariant": 28,
  "feedingReaction": {
    "id": "bluelobster",
    "name": [
      "钴蓝龙虾觅食",
      "Cobalt lobster feeding"
    ],
    "description": [
      "长触须左右巡视，粗壮双螯分开再慢慢收拢。",
      "Heavy claws open independently as swimmerets and walking legs alternate."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "长触须左右巡视，粗壮双螯分开再慢慢收拢。",
    "Heavy claws open independently as swimmerets and walking legs alternate."
  ],
  "depth": "near"
},
    {
  "id": "pearloyster",
  "name": [
    "霞光珠母贝",
    "Dawn pearl oyster"
  ],
  "rarity": "rare",
  "price": 90,
  "baseLength": 25,
  "color": "#b593ad",
  "accent": "#f3e3c3",
  "body": "shell",
  "habitat": "sea",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "oyster",
  "marking": "ribs",
  "artVariant": 29,
  "feedingReaction": {
    "id": "pearloyster",
    "name": [
      "霞光珠母贝觅食",
      "Dawn pearl oyster feeding"
    ],
    "description": [
      "厚壳缓缓张开，内侧珍珠母折射出温暖光泽。",
      "The two nacre-lined valves pivot at the hinge around the soft body."
    ],
    "motion": "pulse"
  },
  "feedingHabit": [
    "厚壳缓缓张开，内侧珍珠母折射出温暖光泽。",
    "The two nacre-lined valves pivot at the hinge around the soft body."
  ],
  "depth": "near"
},
    {
  "id": "icekingcrab",
  "name": [
    "霜钳帝王蟹",
    "Frost king crab"
  ],
  "rarity": "rare",
  "price": 108,
  "baseLength": 46,
  "color": "#aa989d",
  "accent": "#dbe5df",
  "body": "crab",
  "habitat": "ice",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "kingcrab",
  "marking": "spines",
  "artVariant": 30,
  "feedingReaction": {
    "id": "icekingcrab",
    "name": [
      "霜钳帝王蟹觅食",
      "Frost king crab feeding"
    ],
    "description": [
      "棘状背甲下长足依次抬起，粗螯把食物举到身前。",
      "Three visible pairs of walking legs carry the spiny shell beside uneven claws."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "棘状背甲下长足依次抬起，粗螯把食物举到身前。",
    "Three visible pairs of walking legs carry the spiny shell beside uneven claws."
  ],
  "depth": "near"
},
    {
  "id": "icejelly",
  "name": [
    "冰蓝海月",
    "Ice moon jelly"
  ],
  "rarity": "rare",
  "price": 97,
  "baseLength": 30,
  "color": "#a8d2df",
  "accent": "#ebedf1",
  "body": "jelly",
  "habitat": "ice",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "jelly",
  "marking": "rings",
  "artVariant": 31,
  "feedingReaction": {
    "id": "icejelly",
    "name": [
      "冰蓝海月觅食",
      "Ice moon jelly feeding"
    ],
    "description": [
      "透明伞缘轻收轻放，四瓣内脏透出淡蓝光。",
      "The bell contracts and relaxes while trailing tentacles follow the current."
    ],
    "motion": "pulse"
  },
  "feedingHabit": [
    "透明伞缘轻收轻放，四瓣内脏透出淡蓝光。",
    "The bell contracts and relaxes while trailing tentacles follow the current."
  ],
  "depth": "mid"
},
    {
  "id": "chambernautilus",
  "name": [
    "铜纹鹦鹉螺",
    "Copper nautilus"
  ],
  "rarity": "rare",
  "price": 99,
  "baseLength": 27,
  "color": "#c19370",
  "accent": "#efe0b9",
  "body": "nautilus",
  "habitat": "deep",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "nautilus",
  "marking": "spiral",
  "artVariant": 32,
  "feedingReaction": {
    "id": "chambernautilus",
    "name": [
      "铜纹鹦鹉螺觅食",
      "Copper nautilus feeding"
    ],
    "description": [
      "带隔室的螺壳微微转动，细密触腕一齐伸向食物。",
      "Fine sucker-free cirri spread in front of the shell as the siphon pulses."
    ],
    "motion": "pulse"
  },
  "feedingHabit": [
    "带隔室的螺壳微微转动，细密触腕一齐伸向食物。",
    "Fine sucker-free cirri spread in front of the shell as the siphon pulses."
  ],
  "depth": "deep"
},
    {
  "id": "cuttlefish",
  "name": [
    "墨羽乌贼",
    "Inkfin cuttlefish"
  ],
  "rarity": "rare",
  "price": 102,
  "baseLength": 35,
  "color": "#8e828b",
  "accent": "#d4bca8",
  "body": "squid",
  "habitat": "deep",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "cuttlefish",
  "marking": "maze",
  "artVariant": 33,
  "feedingReaction": {
    "id": "cuttlefish",
    "name": [
      "墨羽乌贼觅食",
      "Inkfin cuttlefish feeding"
    ],
    "description": [
      "两侧波浪裙边向前传动，腕足抱住食物后收回。",
      "The lateral fin skirt ripples around a horizontal mantle; two feeding tentacles extend."
    ],
    "motion": "glide"
  },
  "feedingHabit": [
    "两侧波浪裙边向前传动，腕足抱住食物后收回。",
    "The lateral fin skirt ripples around a horizontal mantle; two feeding tentacles extend."
  ],
  "depth": "deep"
},
    {
  "id": "spidercrab",
  "name": [
    "长脚蛛蟹",
    "Longleg spider crab"
  ],
  "rarity": "rare",
  "price": 110,
  "baseLength": 60,
  "color": "#bc846c",
  "accent": "#e9c8a5",
  "body": "crab",
  "habitat": "deep",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "spidercrab",
  "marking": "scutes",
  "artVariant": 34,
  "feedingReaction": {
    "id": "spidercrab",
    "name": [
      "长脚蛛蟹觅食",
      "Longleg spider crab feeding"
    ],
    "description": [
      "细长步足抬成高拱，双螯在身体下方小心取食。",
      "Long walking legs fold at their joints and step over bottom obstacles."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "细长步足抬成高拱，双螯在身体下方小心取食。",
    "Long walking legs fold at their joints and step over bottom obstacles."
  ],
  "depth": "deep"
},
    {
  "id": "axolotl",
  "name": [
    "桃腮六角螈",
    "Peach-gill axolotl"
  ],
  "rarity": "rare",
  "price": 104,
  "baseLength": 25,
  "color": "#dbaeb4",
  "accent": "#b57498",
  "body": "axolotl",
  "habitat": "spirit",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "axolotl",
  "marking": "freckles",
  "artVariant": 35,
  "feedingReaction": {
    "id": "axolotl",
    "name": [
      "桃腮六角螈觅食",
      "Peach-gill axolotl feeding"
    ],
    "description": [
      "六簇外鳃轻轻舒展，四只小脚划动着靠近食物。",
      "Three pairs of feathery external gills spread as the limbs and tail paddle."
    ],
    "motion": "bob"
  },
  "feedingHabit": [
    "六簇外鳃轻轻舒展，四只小脚划动着靠近食物。",
    "Three pairs of feathery external gills spread as the limbs and tail paddle."
  ],
  "depth": "mid"
},
    {
  "id": "jadeturtle",
  "name": [
    "翡翠灵龟",
    "Jade turtle"
  ],
  "rarity": "rare",
  "price": 106,
  "baseLength": 32,
  "color": "#75a48b",
  "accent": "#e2d099",
  "body": "turtle",
  "habitat": "spirit",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "turtle",
  "marking": "scutes",
  "artVariant": 36,
  "feedingReaction": {
    "id": "jadeturtle",
    "name": [
      "翡翠灵龟觅食",
      "Jade turtle feeding"
    ],
    "description": [
      "玉色甲片逐块映光，四足慢划，低头接住食粒。",
      "The jade-colored shell remains steady above alternating webbed-foot strokes."
    ],
    "motion": "glide"
  },
  "feedingHabit": [
    "玉色甲片逐块映光，四足慢划，低头接住食粒。",
    "The jade-colored shell remains steady above alternating webbed-foot strokes."
  ],
  "depth": "near"
},
    {
  "id": "lotussnail",
  "name": [
    "莲纹田螺",
    "Lotus spiral snail"
  ],
  "rarity": "rare",
  "price": 93,
  "baseLength": 18,
  "color": "#b493b8",
  "accent": "#d4ddab",
  "body": "snail",
  "habitat": "spirit",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "snail",
  "marking": "spiral",
  "artVariant": 37,
  "feedingReaction": {
    "id": "lotussnail",
    "name": [
      "莲纹田螺觅食",
      "Lotus spiral snail feeding"
    ],
    "description": [
      "双触角前探，柔软腹足带着莲纹螺壳缓缓滑行。",
      "A muscular foot glides beneath the spiral shell as two pairs of feelers reach ahead."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "双触角前探，柔软腹足带着莲纹螺壳缓缓滑行。",
    "A muscular foot glides beneath the spiral shell as two pairs of feelers reach ahead."
  ],
  "depth": "near"
},
    {
  "id": "moonoctopus",
  "name": [
    "月斑小章",
    "Moonspot octopus"
  ],
  "rarity": "rare",
  "price": 111,
  "baseLength": 29,
  "color": "#8e93bb",
  "accent": "#ecdab5",
  "body": "octopus",
  "habitat": "moon",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "octopus",
  "marking": "rings",
  "artVariant": 38,
  "feedingReaction": {
    "id": "moonoctopus",
    "name": [
      "月斑小章觅食",
      "Moonspot octopus feeding"
    ],
    "description": [
      "八条短腕依次伸出，腕面的月斑随着吸盘张开。",
      "Eight soft arms bend independently with their suckers following each curve."
    ],
    "motion": "flutter"
  },
  "feedingHabit": [
    "八条短腕依次伸出，腕面的月斑随着吸盘张开。",
    "Eight soft arms bend independently with their suckers following each curve."
  ],
  "depth": "mid"
},
    {
  "id": "moonseastar",
  "name": [
    "银月海星",
    "Silvermoon sea star"
  ],
  "rarity": "rare",
  "price": 98,
  "baseLength": 24,
  "color": "#b2a5c8",
  "accent": "#e8dec3",
  "body": "starfish",
  "habitat": "moon",
  "difficulty": 0.43,
  "fry": true,
  "expansion": 2,
  "anatomy": "starfish",
  "marking": "beads",
  "artVariant": 39,
  "feedingReaction": {
    "id": "moonseastar",
    "name": [
      "银月海星觅食",
      "Silvermoon sea star feeding"
    ],
    "description": [
      "五条腕缓缓伸展，细小管足把食物送到身体下方。",
      "Five arm tips lift in turn while small tube feet move underneath."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "五条腕缓缓伸展，细小管足把食物送到身体下方。",
    "Five arm tips lift in turn while small tube feet move underneath."
  ],
  "depth": "near"
},
    {
  "id": "mantisshrimp",
  "name": [
    "虹甲螳螂虾",
    "Prismatic mantis shrimp"
  ],
  "rarity": "epic",
  "price": 205,
  "baseLength": 34,
  "color": "#57a294",
  "accent": "#dfb567",
  "body": "mantis",
  "habitat": "sea",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "mantis",
  "marking": "segments",
  "artVariant": 40,
  "feedingReaction": {
    "id": "mantisshrimp",
    "name": [
      "虹甲螳螂虾觅食",
      "Prismatic mantis shrimp feeding"
    ],
    "description": [
      "复眼左右独立转动，彩色击肢展开后迅速收回。",
      "Stalked eyes watch independently as the folded raptorial limbs spring forward."
    ],
    "motion": "dart"
  },
  "feedingHabit": [
    "复眼左右独立转动，彩色击肢展开后迅速收回。",
    "Stalked eyes watch independently as the folded raptorial limbs spring forward."
  ],
  "depth": "near"
},
    {
  "id": "crystalcrab",
  "name": [
    "晶簇雪蟹",
    "Crystal cluster crab"
  ],
  "rarity": "epic",
  "price": 210,
  "baseLength": 41,
  "color": "#9dcbd5",
  "accent": "#f0ecff",
  "body": "crab",
  "habitat": "ice",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "crystalcrab",
  "marking": "crystals",
  "artVariant": 41,
  "feedingReaction": {
    "id": "crystalcrab",
    "name": [
      "晶簇雪蟹觅食",
      "Crystal cluster crab feeding"
    ],
    "description": [
      "晶簇甲片映出冷光，双螯托起食物时洒下细小冰辉。",
      "Jointed legs carry crystal outcrops across the bottom with alternating steps."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "晶簇甲片映出冷光，双螯托起食物时洒下细小冰辉。",
    "Jointed legs carry crystal outcrops across the bottom with alternating steps."
  ],
  "depth": "near"
},
    {
  "id": "vampyroteuthis",
  "name": [
    "绯幕幽灵蛸",
    "Crimson veil squid"
  ],
  "rarity": "epic",
  "price": 218,
  "baseLength": 46,
  "color": "#8a597c",
  "accent": "#e6b49a",
  "body": "squid",
  "habitat": "deep",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "vampire",
  "marking": "rings",
  "artVariant": 42,
  "feedingReaction": {
    "id": "vampyroteuthis",
    "name": [
      "绯幕幽灵蛸觅食",
      "Crimson veil squid feeding"
    ],
    "description": [
      "八腕间的暗红薄膜展开成伞，再温柔地包住食物。",
      "Eight webbed arms open beneath a pulsing mantle and a pair of small fins."
    ],
    "motion": "flutter"
  },
  "feedingHabit": [
    "八腕间的暗红薄膜展开成伞，再温柔地包住食物。",
    "Eight webbed arms open beneath a pulsing mantle and a pair of small fins."
  ],
  "depth": "deep"
},
    {
  "id": "ribbonseahare",
  "name": [
    "星纱海兔",
    "Starlace sea hare"
  ],
  "rarity": "epic",
  "price": 198,
  "baseLength": 32,
  "color": "#9f87be",
  "accent": "#dfd7f1",
  "body": "slug",
  "habitat": "deep",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "seahare",
  "marking": "stars",
  "artVariant": 43,
  "feedingReaction": {
    "id": "ribbonseahare",
    "name": [
      "星纱海兔觅食",
      "Starlace sea hare feeding"
    ],
    "description": [
      "两片宽大的裙边上下翻动，像柔软星纱一样滑过水底。",
      "Soft side flaps undulate above a slowly gliding muscular foot."
    ],
    "motion": "sway"
  },
  "feedingHabit": [
    "两片宽大的裙边上下翻动，像柔软星纱一样滑过水底。",
    "Soft side flaps undulate above a slowly gliding muscular foot."
  ],
  "depth": "deep"
},
    {
  "id": "dragonsnail",
  "name": [
    "盘龙玉螺",
    "Dragon jade snail"
  ],
  "rarity": "epic",
  "price": 225,
  "baseLength": 38,
  "color": "#619b89",
  "accent": "#e7ca83",
  "body": "snail",
  "habitat": "spirit",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "dragonsnail",
  "marking": "spiral",
  "artVariant": 44,
  "feedingReaction": {
    "id": "dragonsnail",
    "name": [
      "盘龙玉螺觅食",
      "Dragon jade snail feeding"
    ],
    "description": [
      "金纹螺壳缓缓转向，长须沿着食物画出半圆。",
      "A ridged shell follows the gliding foot while long feelers inspect the route."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "金纹螺壳缓缓转向，长须沿着食物画出半圆。",
    "A ridged shell follows the gliding foot while long feelers inspect the route."
  ],
  "depth": "near"
},
    {
  "id": "paperkoi",
  "name": [
    "折纸游鲤",
    "Paperfold koi"
  ],
  "rarity": "epic",
  "price": 215,
  "baseLength": 39,
  "color": "#ded9c6",
  "accent": "#c76c63",
  "body": "koi",
  "habitat": "spirit",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "paper",
  "marking": "folds",
  "artVariant": 45,
  "feedingReaction": {
    "id": "paperkoi",
    "name": [
      "折纸游鲤觅食",
      "Paperfold koi feeding"
    ],
    "description": [
      "纸折般的尾鳍层层张开，转身露出朱砂色折痕。",
      "Fold-like fin seams catch the light as the tail rolls through a gentle turn."
    ],
    "motion": "twirl"
  },
  "feedingHabit": [
    "纸折般的尾鳍层层张开，转身露出朱砂色折痕。",
    "Fold-like fin seams catch the light as the tail rolls through a gentle turn."
  ],
  "depth": "mid"
},
    {
  "id": "celestialturtle",
  "name": [
    "宿星玄龟",
    "Constellation turtle"
  ],
  "rarity": "epic",
  "price": 230,
  "baseLength": 49,
  "color": "#626f9e",
  "accent": "#e9d19c",
  "body": "turtle",
  "habitat": "moon",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "starturtle",
  "marking": "stars",
  "artVariant": 46,
  "feedingReaction": {
    "id": "celestialturtle",
    "name": [
      "宿星玄龟觅食",
      "Constellation turtle feeding"
    ],
    "description": [
      "星图甲片逐一点亮，绕着食物游完一个缓慢的圆。",
      "Star-marked scutes remain level as four webbed feet sweep through the water."
    ],
    "motion": "orbit"
  },
  "feedingHabit": [
    "星图甲片逐一点亮，绕着食物游完一个缓慢的圆。",
    "Star-marked scutes remain level as four webbed feet sweep through the water."
  ],
  "depth": "near"
},
    {
  "id": "cometjelly",
  "name": [
    "彗尾水母",
    "Comet-tail jellyfish"
  ],
  "rarity": "epic",
  "price": 228,
  "baseLength": 44,
  "color": "#b5aedf",
  "accent": "#e4d5a9",
  "body": "jelly",
  "habitat": "moon",
  "difficulty": 0.64,
  "fry": true,
  "expansion": 2,
  "anatomy": "cometjelly",
  "marking": "stars",
  "artVariant": 47,
  "feedingReaction": {
    "id": "cometjelly",
    "name": [
      "彗尾水母觅食",
      "Comet-tail jellyfish feeding"
    ],
    "description": [
      "伞体收缩后，长触腕像彗尾一样顺着水流展开。",
      "The bell pulses and its long trailing filaments ripple behind it."
    ],
    "motion": "pulse"
  },
  "feedingHabit": [
    "伞体收缩后，长触腕像彗尾一样顺着水流展开。",
    "The bell pulses and its long trailing filaments ripple behind it."
  ],
  "depth": "mid"
},
    {
  "id": "jadecrabking",
  "name": [
    "镇潭负岳蟹",
    "Mountain-bearing jade crab"
  ],
  "rarity": "legendary",
  "price": 455,
  "baseLength": 92,
  "color": "#567e70",
  "accent": "#e2c789",
  "body": "crab",
  "habitat": "spirit",
  "difficulty": 0.83,
  "fry": true,
  "expansion": 2,
  "anatomy": "mountaincrab",
  "marking": "mountains",
  "artVariant": 48,
  "feedingReaction": {
    "id": "jadecrabking",
    "name": [
      "镇潭负岳蟹觅食",
      "Mountain-bearing jade crab feeding"
    ],
    "description": [
      "背甲的小山间浮出薄雾，八足站稳，金玉巨螯托起整团食物。",
      "Broad claws rise in turn while jointed legs move the mountain-like shell sideways."
    ],
    "motion": "bottom"
  },
  "feedingHabit": [
    "背甲的小山间浮出薄雾，八足站稳，金玉巨螯托起整团食物。",
    "Broad claws rise in turn while jointed legs move the mountain-like shell sideways."
  ],
  "depth": "near"
},
    {
  "id": "clocknautilus",
  "name": [
    "星轮时计螺",
    "Astral clock nautilus"
  ],
  "rarity": "legendary",
  "price": 465,
  "baseLength": 78,
  "color": "#7673a8",
  "accent": "#ecd19b",
  "body": "nautilus",
  "habitat": "moon",
  "difficulty": 0.83,
  "fry": true,
  "expansion": 2,
  "anatomy": "clocknautilus",
  "marking": "clock",
  "artVariant": 49,
  "feedingReaction": {
    "id": "clocknautilus",
    "name": [
      "星轮时计螺觅食",
      "Astral clock nautilus feeding"
    ],
    "description": [
      "螺壳的金色刻环缓缓转动，触腕张开，星点沿隔室依次亮起。",
      "Fine cirri spread before a siphon pulse; the shell dial moves with the rigid shell."
    ],
    "motion": "pulse"
  },
  "feedingHabit": [
    "螺壳的金色刻环缓缓转动，触腕张开，星点沿隔室依次亮起。",
    "Fine cirri spread before a siphon pulse; the shell dial moves with the rigid shell."
  ],
  "depth": "deep"
}
  ]);
  // END EXPANSION FISH
  // BEGIN WATERS THREE FISH
  FISH.push.apply(FISH,[
  {
    "id": "rudd",
    "name": [
      "赤鳍红眼鱼",
      "Rudd"
    ],
    "rarity": "common",
    "price": 18,
    "baseLength": 23,
    "color": "#b6ad7f",
    "accent": "#c56245",
    "body": "round",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "rounded",
    "marking": "scales",
    "artVariant": 50,
    "diet": "dough",
    "depth": "mid",
    "feedingReaction": {
      "id": "rudd",
      "name": [
        "赤鳍红眼鱼觅食",
        "Rudd feeding"
      ],
      "description": [
        "先用赤色胸鳍刹住，向水面的碎屑轻啄。",
        "Rudd: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "先用赤色胸鳍刹住，向水面的碎屑轻啄。",
      "Rudd: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "chub",
    "name": [
      "银颊圆腹雅罗",
      "Chub"
    ],
    "rarity": "common",
    "price": 23,
    "baseLength": 32,
    "color": "#87968b",
    "accent": "#ddd8b6",
    "body": "slender",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "stream",
    "marking": "scales",
    "artVariant": 51,
    "diet": "dough",
    "depth": "mid",
    "feedingReaction": {
      "id": "chub",
      "name": [
        "银颊圆腹雅罗觅食",
        "Chub feeding"
      ],
      "description": [
        "沿浅流成群穿梭，银颊侧转时闪光。",
        "Chub: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "沿浅流成群穿梭，银颊侧转时闪光。",
      "Chub: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "bream",
    "name": [
      "铜盘欧鳊",
      "Bronze bream"
    ],
    "rarity": "common",
    "price": 28,
    "baseLength": 34,
    "color": "#a89b70",
    "accent": "#e3cfa1",
    "body": "discus",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "disk",
    "marking": "scales",
    "artVariant": 52,
    "diet": "dough",
    "depth": "mid",
    "feedingReaction": {
      "id": "bream",
      "name": [
        "铜盘欧鳊觅食",
        "Bronze bream feeding"
      ],
      "description": [
        "扁高身体慢慢侧转，用小口吸入团饵。",
        "Bronze bream: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "bob"
    },
    "feedingHabit": [
      "扁高身体慢慢侧转，用小口吸入团饵。",
      "Bronze bream: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "grasscarp",
    "name": [
      "青背草鱼",
      "Grass carp"
    ],
    "rarity": "common",
    "price": 33,
    "baseLength": 48,
    "color": "#728a70",
    "accent": "#c7cfaa",
    "body": "slender",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "stream",
    "marking": "scales",
    "artVariant": 53,
    "diet": "dough",
    "depth": "mid",
    "feedingReaction": {
      "id": "grasscarp",
      "name": [
        "青背草鱼觅食",
        "Grass carp feeding"
      ],
      "description": [
        "短促摆尾接近嫩叶，胸鳍展开后悬停取食。",
        "Grass carp: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "短促摆尾接近嫩叶，胸鳍展开后悬停取食。",
      "Grass carp: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "zebradanio",
    "name": [
      "斑马鱼",
      "Zebra danio"
    ],
    "rarity": "common",
    "price": 38,
    "baseLength": 6,
    "color": "#6795a0",
    "accent": "#ecdfab",
    "body": "slender",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "stream",
    "marking": "stripe",
    "artVariant": 54,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "zebradanio",
      "name": [
        "斑马鱼觅食",
        "Zebra danio feeding"
      ],
      "description": [
        "保持小群队形，条纹随快速转向掠过。",
        "Zebra danio: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "保持小群队形，条纹随快速转向掠过。",
      "Zebra danio: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "guppy",
    "name": [
      "孔雀花尾鱼",
      "Guppy"
    ],
    "rarity": "common",
    "price": 43,
    "baseLength": 7,
    "color": "#7a92a6",
    "accent": "#eeac67",
    "body": "slender",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "guppy",
    "marking": "spots",
    "artVariant": 55,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "guppy",
      "name": [
        "孔雀花尾鱼觅食",
        "Guppy feeding"
      ],
      "description": [
        "扇形花尾缓慢张开，以胸鳍细调进食方向。",
        "Guppy: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "扇形花尾缓慢张开，以胸鳍细调进食方向。",
      "Guppy: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "platy",
    "name": [
      "日落月光鱼",
      "Sunset platy"
    ],
    "rarity": "common",
    "price": 48,
    "baseLength": 8,
    "color": "#e19655",
    "accent": "#f8db98",
    "body": "round",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "rounded",
    "marking": "none",
    "artVariant": 56,
    "diet": "dough",
    "depth": "near",
    "feedingReaction": {
      "id": "platy",
      "name": [
        "日落月光鱼觅食",
        "Sunset platy feeding"
      ],
      "description": [
        "圆腹轻轻升沉，短尾维持小幅度巡游。",
        "Sunset platy: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "bob"
    },
    "feedingHabit": [
      "圆腹轻轻升沉，短尾维持小幅度巡游。",
      "Sunset platy: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "rainbowfish",
    "name": [
      "虹带彩虹鱼",
      "Rainbowfish"
    ],
    "rarity": "common",
    "price": 18,
    "baseLength": 12,
    "color": "#63a19a",
    "accent": "#e3b465",
    "body": "discus",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "rainbow",
    "marking": "stripe",
    "artVariant": 57,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "rainbowfish",
      "name": [
        "虹带彩虹鱼觅食",
        "Rainbowfish feeding"
      ],
      "description": [
        "双背鳍同步竖起，虹色侧线随转身变亮。",
        "Rainbowfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "双背鳍同步竖起，虹色侧线随转身变亮。",
      "Rainbowfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "mosquitofish",
    "name": [
      "溪口食蚊鱼",
      "Mosquitofish"
    ],
    "rarity": "common",
    "price": 23,
    "baseLength": 6,
    "color": "#b8b8a0",
    "accent": "#dcdac5",
    "body": "slender",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "stream",
    "marking": "spots",
    "artVariant": 58,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "mosquitofish",
      "name": [
        "溪口食蚊鱼觅食",
        "Mosquitofish feeding"
      ],
      "description": [
        "贴着水面短距离突进，迅速啄取微小食物。",
        "Mosquitofish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "贴着水面短距离突进，迅速啄取微小食物。",
      "Mosquitofish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "corydoras",
    "name": [
      "花甲鼠鱼",
      "Peppered corydoras"
    ],
    "rarity": "common",
    "price": 28,
    "baseLength": 9,
    "color": "#8b9690",
    "accent": "#d6cbb0",
    "body": "round",
    "habitat": "river",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "barbel",
    "marking": "saddles",
    "artVariant": 59,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "corydoras",
      "name": [
        "花甲鼠鱼觅食",
        "Peppered corydoras feeding"
      ],
      "description": [
        "腹部贴近底床，以短须探查沙粒间的食物。",
        "Peppered corydoras: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "腹部贴近底床，以短须探查沙粒间的食物。",
      "Peppered corydoras: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "sprat",
    "name": [
      "碎银西鲱",
      "Sprat"
    ],
    "rarity": "common",
    "price": 33,
    "baseLength": 13,
    "color": "#8ca9ab",
    "accent": "#e2e5cd",
    "body": "slender",
    "habitat": "sea",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "stream",
    "marking": "scales",
    "artVariant": 60,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "sprat",
      "name": [
        "碎银西鲱觅食",
        "Sprat feeding"
      ],
      "description": [
        "细密银鳞成群闪动，尾鳍以短行程推进。",
        "Sprat: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "细密银鳞成群闪动，尾鳍以短行程推进。",
      "Sprat: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "sandeel",
    "name": [
      "沙穴玉筋鱼",
      "Sand lance"
    ],
    "rarity": "common",
    "price": 38,
    "baseLength": 20,
    "color": "#a3b8ae",
    "accent": "#e8dfb2",
    "body": "slender",
    "habitat": "sea",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "needle",
    "marking": "stripe",
    "artVariant": 61,
    "diet": "prawn",
    "depth": "mid",
    "feedingReaction": {
      "id": "sandeel",
      "name": [
        "沙穴玉筋鱼觅食",
        "Sand lance feeding"
      ],
      "description": [
        "从沙面上方掠过，细长身体随尾部形成小波。",
        "Sand lance: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "从沙面上方掠过，细长身体随尾部形成小波。",
      "Sand lance: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "sergeantmajor",
    "name": [
      "五线雀鲷",
      "Sergeant major"
    ],
    "rarity": "common",
    "price": 43,
    "baseLength": 17,
    "color": "#a9b685",
    "accent": "#e7ca72",
    "body": "discus",
    "habitat": "sea",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "reef",
    "marking": "stripe",
    "artVariant": 62,
    "diet": "prawn",
    "depth": "mid",
    "feedingReaction": {
      "id": "sergeantmajor",
      "name": [
        "五线雀鲷觅食",
        "Sergeant major feeding"
      ],
      "description": [
        "五条深纹随扁身侧转，胸鳍连续扇动。",
        "Sergeant major: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "五条深纹随扁身侧转，胸鳍连续扇动。",
      "Sergeant major: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "damselfish",
    "name": [
      "钴蓝雀鲷",
      "Blue damselfish"
    ],
    "rarity": "common",
    "price": 48,
    "baseLength": 9,
    "color": "#3e89ba",
    "accent": "#84d2d9",
    "body": "round",
    "habitat": "sea",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "reef",
    "marking": "none",
    "artVariant": 63,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "damselfish",
      "name": [
        "钴蓝雀鲷觅食",
        "Blue damselfish feeding"
      ],
      "description": [
        "在礁穴附近短距离游弋，遇食后迅速折回。",
        "Blue damselfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "在礁穴附近短距离游弋，遇食后迅速折回。",
      "Blue damselfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "blenny",
    "name": [
      "岩穴鳚鱼",
      "Rock blenny"
    ],
    "rarity": "common",
    "price": 18,
    "baseLength": 16,
    "color": "#ad9270",
    "accent": "#d5c9a1",
    "body": "slender",
    "habitat": "sea",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "goby",
    "marking": "saddles",
    "artVariant": 64,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "blenny",
      "name": [
        "岩穴鳚鱼觅食",
        "Rock blenny feeding"
      ],
      "description": [
        "停驻岩沿，用胸鳍支撑身体再探头取食。",
        "Rock blenny: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "停驻岩沿，用胸鳍支撑身体再探头取食。",
      "Rock blenny: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "capelin",
    "name": [
      "冰海毛鳞鱼",
      "Capelin"
    ],
    "rarity": "common",
    "price": 23,
    "baseLength": 19,
    "color": "#98b6b7",
    "accent": "#d6e4db",
    "body": "slender",
    "habitat": "ice",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "salmon",
    "marking": "scales",
    "artVariant": 65,
    "diet": "prawn",
    "depth": "mid",
    "feedingReaction": {
      "id": "capelin",
      "name": [
        "冰海毛鳞鱼觅食",
        "Capelin feeding"
      ],
      "description": [
        "冰水中保持细长的群游队列，脂鳍随水流轻摆。",
        "Capelin: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "冰水中保持细长的群游队列，脂鳍随水流轻摆。",
      "Capelin: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "saffroncod",
    "name": [
      "浅金黄线鳕",
      "Saffron cod"
    ],
    "rarity": "common",
    "price": 28,
    "baseLength": 27,
    "color": "#b2a57d",
    "accent": "#e1d8b2",
    "body": "slender",
    "habitat": "ice",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "cod",
    "marking": "freckles",
    "artVariant": 66,
    "diet": "cutbait",
    "depth": "mid",
    "feedingReaction": {
      "id": "saffroncod",
      "name": [
        "浅金黄线鳕觅食",
        "Saffron cod feeding"
      ],
      "description": [
        "三段背鳍稳定姿态，下颏须先触及食物。",
        "Saffron cod: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "三段背鳍稳定姿态，下颏须先触及食物。",
      "Saffron cod: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "copepod",
    "name": [
      "琥珀桡足虾",
      "Amber copepod"
    ],
    "rarity": "common",
    "price": 33,
    "baseLength": 4,
    "color": "#c9a389",
    "accent": "#f2d6b5",
    "body": "shrimp",
    "habitat": "deep",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "shrimp",
    "marking": "segments",
    "artVariant": 67,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "copepod",
      "name": [
        "琥珀桡足虾觅食",
        "Amber copepod feeding"
      ],
      "description": [
        "分节腹部蜷曲一次后弹开，细肢继续划水。",
        "Amber copepod: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "分节腹部蜷曲一次后弹开，细肢继续划水。",
      "Amber copepod: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "reedmedaka",
    "name": [
      "苇光青鳉",
      "Reedlight medaka"
    ],
    "rarity": "common",
    "price": 38,
    "baseLength": 6,
    "color": "#a5c7b2",
    "accent": "#eddeb0",
    "body": "slender",
    "habitat": "spirit",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "stream",
    "marking": "stripe",
    "artVariant": 68,
    "diet": "lotusmeal",
    "depth": "near",
    "feedingReaction": {
      "id": "reedmedaka",
      "name": [
        "苇光青鳉觅食",
        "Reedlight medaka feeding"
      ],
      "description": [
        "穿过芦根的光斑，尾鳍轻扫后停在水中。",
        "Reedlight medaka: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "穿过芦根的光斑，尾鳍轻扫后停在水中。",
      "Reedlight medaka: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "moongoby",
    "name": [
      "银沙月虾虎",
      "Moon-sand goby"
    ],
    "rarity": "common",
    "price": 43,
    "baseLength": 10,
    "color": "#aab8cf",
    "accent": "#dfdce9",
    "body": "round",
    "habitat": "moon",
    "difficulty": 0.2,
    "fry": false,
    "expansion": 3,
    "anatomy": "goby",
    "marking": "spots",
    "artVariant": 69,
    "diet": "lotusmeal",
    "depth": "deep",
    "feedingReaction": {
      "id": "moongoby",
      "name": [
        "银沙月虾虎觅食",
        "Moon-sand goby feeding"
      ],
      "description": [
        "伏在银沙边缘，用扇形胸鳍缓缓调整朝向。",
        "Moon-sand goby: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "伏在银沙边缘，用扇形胸鳍缓缓调整朝向。",
      "Moon-sand goby: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "peacockbass",
    "name": [
      "金斑孔雀鲈",
      "Peacock bass"
    ],
    "rarity": "rare",
    "price": 102,
    "baseLength": 46,
    "color": "#92a967",
    "accent": "#eac36a",
    "body": "predator",
    "habitat": "river",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "perch",
    "marking": "saddles",
    "artVariant": 70,
    "diet": "cutbait",
    "depth": "mid",
    "feedingReaction": {
      "id": "peacockbass",
      "name": [
        "金斑孔雀鲈觅食",
        "Peacock bass feeding"
      ],
      "description": [
        "背鳍硬棘先立起，骤然摆尾扑向目标。",
        "Peacock bass: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "leap"
    },
    "feedingHabit": [
      "背鳍硬棘先立起，骤然摆尾扑向目标。",
      "Peacock bass: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "arapaima",
    "name": [
      "赤鳞巨骨舌鱼",
      "Arapaima"
    ],
    "rarity": "rare",
    "price": 72,
    "baseLength": 110,
    "color": "#718d7d",
    "accent": "#d4755d",
    "body": "predator",
    "habitat": "river",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "arapaima",
    "marking": "scales",
    "artVariant": 71,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "arapaima",
      "name": [
        "赤鳞巨骨舌鱼觅食",
        "Arapaima feeding"
      ],
      "description": [
        "厚鳞躯干保持平稳，后置背鳍和臀鳍共同推进。",
        "Arapaima: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "厚鳞躯干保持平稳，后置背鳍和臀鳍共同推进。",
      "Arapaima: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "knifefish",
    "name": [
      "银背七星刀",
      "Clown knifefish"
    ],
    "rarity": "rare",
    "price": 77,
    "baseLength": 48,
    "color": "#8eaaa9",
    "accent": "#dce6dc",
    "body": "slender",
    "habitat": "river",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "knife",
    "marking": "spots",
    "artVariant": 72,
    "diet": "cutbait",
    "depth": "mid",
    "feedingReaction": {
      "id": "knifefish",
      "name": [
        "银背七星刀觅食",
        "Clown knifefish feeding"
      ],
      "description": [
        "长臀鳍从前向后传递波浪，身体几乎不摆动。",
        "Clown knifefish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "长臀鳍从前向后传递波浪，身体几乎不摆动。",
      "Clown knifefish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "electriccatfish",
    "name": [
      "金纹电鲶",
      "Electric catfish"
    ],
    "rarity": "rare",
    "price": 82,
    "baseLength": 38,
    "color": "#a9996c",
    "accent": "#ebd793",
    "body": "round",
    "habitat": "river",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "barbel",
    "marking": "freckles",
    "artVariant": 73,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "electriccatfish",
      "name": [
        "金纹电鲶觅食",
        "Electric catfish feeding"
      ],
      "description": [
        "圆钝头部贴底搜寻，触须随转头扫过沙面。",
        "Electric catfish: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "圆钝头部贴底搜寻，触须随转头扫过沙面。",
      "Electric catfish: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "garfish",
    "name": [
      "翠吻颌针鱼",
      "Needlefish"
    ],
    "rarity": "rare",
    "price": 87,
    "baseLength": 55,
    "color": "#6caaa4",
    "accent": "#d2ded1",
    "body": "slender",
    "habitat": "sea",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "needle",
    "marking": "stripe",
    "artVariant": 74,
    "diet": "cutbait",
    "depth": "mid",
    "feedingReaction": {
      "id": "garfish",
      "name": [
        "翠吻颌针鱼觅食",
        "Needlefish feeding"
      ],
      "description": [
        "上下长颌对准猎物，以纤长身体快速突进。",
        "Needlefish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "上下长颌对准猎物，以纤长身体快速突进。",
      "Needlefish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "goatfish",
    "name": [
      "红须羊鱼",
      "Red mullet"
    ],
    "rarity": "rare",
    "price": 92,
    "baseLength": 25,
    "color": "#c97e78",
    "accent": "#edc194",
    "body": "slender",
    "habitat": "sea",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "barbel",
    "marking": "stripe",
    "artVariant": 75,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "goatfish",
      "name": [
        "红须羊鱼觅食",
        "Red mullet feeding"
      ],
      "description": [
        "两根下颏须探入沙层，胸鳍托住身体。",
        "Red mullet: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "两根下颏须探入沙层，胸鳍托住身体。",
      "Red mullet: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "parrotfish",
    "name": [
      "青玉鹦嘴鱼",
      "Parrotfish"
    ],
    "rarity": "rare",
    "price": 97,
    "baseLength": 36,
    "color": "#53aba1",
    "accent": "#dbad96",
    "body": "predator",
    "habitat": "sea",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "parrot",
    "marking": "scales",
    "artVariant": 76,
    "diet": "dough",
    "depth": "mid",
    "feedingReaction": {
      "id": "parrotfish",
      "name": [
        "青玉鹦嘴鱼觅食",
        "Parrotfish feeding"
      ],
      "description": [
        "厚唇与喙状齿靠近礁面，缓慢刮取食物。",
        "Parrotfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "orbit"
    },
    "feedingHabit": [
      "厚唇与喙状齿靠近礁面，缓慢刮取食物。",
      "Parrotfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "moorishidol",
    "name": [
      "镰旗镰鱼",
      "Moorish idol"
    ],
    "rarity": "rare",
    "price": 102,
    "baseLength": 24,
    "color": "#ded4a2",
    "accent": "#313e51",
    "body": "discus",
    "habitat": "sea",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "banner",
    "marking": "stripe",
    "artVariant": 77,
    "diet": "prawn",
    "depth": "mid",
    "feedingReaction": {
      "id": "moorishidol",
      "name": [
        "镰旗镰鱼觅食",
        "Moorish idol feeding"
      ],
      "description": [
        "长背鳍飘带落后于转身，胸鳍维持悬停。",
        "Moorish idol: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "长背鳍飘带落后于转身，胸鳍维持悬停。",
      "Moorish idol: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "ribbonwrasse",
    "name": [
      "蓝带清洁鱼",
      "Cleaner wrasse"
    ],
    "rarity": "rare",
    "price": 72,
    "baseLength": 14,
    "color": "#699bc3",
    "accent": "#e4e5dc",
    "body": "slender",
    "habitat": "sea",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "stream",
    "marking": "stripe",
    "artVariant": 78,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "ribbonwrasse",
      "name": [
        "蓝带清洁鱼觅食",
        "Cleaner wrasse feeding"
      ],
      "description": [
        "沿礁边来回穿行，中央深色条带随身形起伏。",
        "Cleaner wrasse: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "dart"
    },
    "feedingHabit": [
      "沿礁边来回穿行，中央深色条带随身形起伏。",
      "Cleaner wrasse: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "dragonetred",
    "name": [
      "赤锦红龙鱼",
      "Ruby dragonet"
    ],
    "rarity": "rare",
    "price": 77,
    "baseLength": 12,
    "color": "#b95345",
    "accent": "#9dced1",
    "body": "round",
    "habitat": "sea",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "dragonet",
    "marking": "maze",
    "artVariant": 79,
    "diet": "prawn",
    "depth": "near",
    "feedingReaction": {
      "id": "dragonetred",
      "name": [
        "赤锦红龙鱼觅食",
        "Ruby dragonet feeding"
      ],
      "description": [
        "宽大胸鳍像小扇一样撑开，再小步挪向食物。",
        "Ruby dragonet: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "宽大胸鳍像小扇一样撑开，再小步挪向食物。",
      "Ruby dragonet: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "lumpfish",
    "name": [
      "冰蓝圆鳍鱼",
      "Lumpfish"
    ],
    "rarity": "rare",
    "price": 82,
    "baseLength": 32,
    "color": "#7398ab",
    "accent": "#c3d5d1",
    "body": "round",
    "habitat": "ice",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "lump",
    "marking": "scutes",
    "artVariant": 80,
    "diet": "prawn",
    "depth": "mid",
    "feedingReaction": {
      "id": "lumpfish",
      "name": [
        "冰蓝圆鳍鱼觅食",
        "Lumpfish feeding"
      ],
      "description": [
        "宽圆腹部靠近岩壁，细小胸鳍连续扇动。",
        "Lumpfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "bob"
    },
    "feedingHabit": [
      "宽圆腹部靠近岩壁，细小胸鳍连续扇动。",
      "Lumpfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "wolffish",
    "name": [
      "灰纹狼鳚",
      "Atlantic wolffish"
    ],
    "rarity": "rare",
    "price": 87,
    "baseLength": 66,
    "color": "#8899a7",
    "accent": "#ccced0",
    "body": "predator",
    "habitat": "ice",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "wolf",
    "marking": "saddles",
    "artVariant": 81,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "wolffish",
      "name": [
        "灰纹狼鳚觅食",
        "Atlantic wolffish feeding"
      ],
      "description": [
        "粗壮头部保持稳定，身体后半段轻柔摆动。",
        "Atlantic wolffish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "粗壮头部保持稳定，身体后半段轻柔摆动。",
      "Atlantic wolffish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "hatchetfish",
    "name": [
      "银刃斧头鱼",
      "Silver hatchetfish"
    ],
    "rarity": "rare",
    "price": 92,
    "baseLength": 14,
    "color": "#8cacc0",
    "accent": "#d5eeee",
    "body": "discus",
    "habitat": "deep",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "hatchet",
    "marking": "stars",
    "artVariant": 82,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "hatchetfish",
      "name": [
        "银刃斧头鱼觅食",
        "Silver hatchetfish feeding"
      ],
      "description": [
        "银色腹刃缓缓倾斜，扁薄胸鳍控制深水悬停。",
        "Silver hatchetfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "银色腹刃缓缓倾斜，扁薄胸鳍控制深水悬停。",
      "Silver hatchetfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "fangtooth",
    "name": [
      "玄齿深渊鱼",
      "Fangtooth"
    ],
    "rarity": "rare",
    "price": 97,
    "baseLength": 20,
    "color": "#675d65",
    "accent": "#bcbaad",
    "body": "predator",
    "habitat": "deep",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "fang",
    "marking": "scutes",
    "artVariant": 83,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "fangtooth",
      "name": [
        "玄齿深渊鱼觅食",
        "Fangtooth feeding"
      ],
      "description": [
        "小型厚头先朝向食物，显露细长牙齿后闭口。",
        "Fangtooth: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "小型厚头先朝向食物，显露细长牙齿后闭口。",
      "Fangtooth: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "lotusloach",
    "name": [
      "青莲花泥鳅",
      "Lotus loach"
    ],
    "rarity": "rare",
    "price": 102,
    "baseLength": 24,
    "color": "#759e86",
    "accent": "#e4bfd0",
    "body": "slender",
    "habitat": "spirit",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "barbel",
    "marking": "flowers",
    "artVariant": 84,
    "diet": "lotusmeal",
    "depth": "deep",
    "feedingReaction": {
      "id": "lotusloach",
      "name": [
        "青莲花泥鳅觅食",
        "Lotus loach feeding"
      ],
      "description": [
        "绕着莲根缓行，短须先触碰下沉的饵粒。",
        "Lotus loach: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "绕着莲根缓行，短须先触碰下沉的饵粒。",
      "Lotus loach: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "stargourami",
    "name": [
      "星点丝足鱼",
      "Star gourami"
    ],
    "rarity": "rare",
    "price": 72,
    "baseLength": 24,
    "color": "#758ead",
    "accent": "#d7cde4",
    "body": "discus",
    "habitat": "moon",
    "difficulty": 0.4,
    "fry": true,
    "expansion": 3,
    "anatomy": "gourami",
    "marking": "stars",
    "artVariant": 85,
    "diet": "lotusmeal",
    "depth": "mid",
    "feedingReaction": {
      "id": "stargourami",
      "name": [
        "星点丝足鱼觅食",
        "Star gourami feeding"
      ],
      "description": [
        "丝状腹鳍缓缓探路，扁高身体保持平稳。",
        "Star gourami: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "丝状腹鳍缓缓探路，扁高身体保持平稳。",
      "Star gourami: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "paddlefish",
    "name": [
      "青铲鲟",
      "Paddlefish"
    ],
    "rarity": "epic",
    "price": 205,
    "baseLength": 95,
    "color": "#7b959e",
    "accent": "#cfdad3",
    "body": "predator",
    "habitat": "river",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "paddle",
    "marking": "scutes",
    "artVariant": 86,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "paddlefish",
      "name": [
        "青铲鲟觅食",
        "Paddlefish feeding"
      ],
      "description": [
        "扁平长吻水平伸出，胸鳍微调滑行角度。",
        "Paddlefish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "扁平长吻水平伸出，胸鳍微调滑行角度。",
      "Paddlefish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "bichir",
    "name": [
      "古甲多鳍鱼",
      "Armored bichir"
    ],
    "rarity": "epic",
    "price": 210,
    "baseLength": 54,
    "color": "#929d72",
    "accent": "#d8ca98",
    "body": "slender",
    "habitat": "river",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "bichir",
    "marking": "scutes",
    "artVariant": 87,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "bichir",
      "name": [
        "古甲多鳍鱼觅食",
        "Armored bichir feeding"
      ],
      "description": [
        "一列独立背鳍逐个竖起，厚实胸鳍交替推进。",
        "Armored bichir: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "一列独立背鳍逐个竖起，厚实胸鳍交替推进。",
      "Armored bichir: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "weedyseadragon",
    "name": [
      "赤枝草海龙",
      "Weedy seadragon"
    ],
    "rarity": "epic",
    "price": 215,
    "baseLength": 42,
    "color": "#ae8958",
    "accent": "#deaa75",
    "body": "slender",
    "habitat": "sea",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "seadragon",
    "marking": "saddles",
    "artVariant": 88,
    "diet": "prawn",
    "depth": "mid",
    "feedingReaction": {
      "id": "weedyseadragon",
      "name": [
        "赤枝草海龙觅食",
        "Weedy seadragon feeding"
      ],
      "description": [
        "管状吻对准微小食物，叶状附肢随水流后摆。",
        "Weedy seadragon: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "管状吻对准微小食物，叶状附肢随水流后摆。",
      "Weedy seadragon: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "batfish",
    "name": [
      "绯唇蝙蝠鱼",
      "Red-lipped batfish"
    ],
    "rarity": "epic",
    "price": 220,
    "baseLength": 30,
    "color": "#a2937a",
    "accent": "#c54d4e",
    "body": "flatfish",
    "habitat": "sea",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "batfish",
    "marking": "freckles",
    "artVariant": 89,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "batfish",
      "name": [
        "绯唇蝙蝠鱼觅食",
        "Red-lipped batfish feeding"
      ],
      "description": [
        "用胸鳍末端支在沙上行走，红唇轻啄底部食物。",
        "Red-lipped batfish: Settles near the bed and steadies with paired fins before feeding."
      ],
      "motion": "bottom"
    },
    "feedingHabit": [
      "用胸鳍末端支在沙上行走，红唇轻啄底部食物。",
      "Red-lipped batfish: Settles near the bed and steadies with paired fins before feeding."
    ]
  },
  {
    "id": "sunfish",
    "name": [
      "银盘翻车鱼",
      "Ocean sunfish"
    ],
    "rarity": "epic",
    "price": 225,
    "baseLength": 115,
    "color": "#8fa4ac",
    "accent": "#cbd8d6",
    "body": "discus",
    "habitat": "sea",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "sunfish",
    "marking": "scutes",
    "artVariant": 90,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "sunfish",
      "name": [
        "银盘翻车鱼觅食",
        "Ocean sunfish feeding"
      ],
      "description": [
        "高背鳍与臀鳍同步摆动，短尾缘轻轻调整方向。",
        "Ocean sunfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "高背鳍与臀鳍同步摆动，短尾缘轻轻调整方向。",
      "Ocean sunfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "ribbonice",
    "name": [
      "冰绡长鳍鱼",
      "Ice-silk ribbonfish"
    ],
    "rarity": "epic",
    "price": 230,
    "baseLength": 68,
    "color": "#a2cbdb",
    "accent": "#ecf7ec",
    "body": "slender",
    "habitat": "ice",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "knife",
    "marking": "crystals",
    "artVariant": 91,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "ribbonice",
      "name": [
        "冰绡长鳍鱼觅食",
        "Ice-silk ribbonfish feeding"
      ],
      "description": [
        "长臀鳍形成连续水波，半透明鳍缘在冰水里舒展。",
        "Ice-silk ribbonfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "长臀鳍形成连续水波，半透明鳍缘在冰水里舒展。",
      "Ice-silk ribbonfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "dragonfish",
    "name": [
      "赤须黑龙鱼",
      "Black dragonfish"
    ],
    "rarity": "epic",
    "price": 200,
    "baseLength": 62,
    "color": "#424e62",
    "accent": "#d38686",
    "body": "slender",
    "habitat": "deep",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "dragonfish",
    "marking": "stars",
    "artVariant": 92,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "dragonfish",
      "name": [
        "赤须黑龙鱼觅食",
        "Black dragonfish feeding"
      ],
      "description": [
        "颏下灯须先摆向食物，细长身体缓慢盘转。",
        "Black dragonfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "颏下灯须先摆向食物，细长身体缓慢盘转。",
      "Black dragonfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "barreleye",
    "name": [
      "琉璃管眼鱼",
      "Barreleye"
    ],
    "rarity": "epic",
    "price": 205,
    "baseLength": 20,
    "color": "#749a9b",
    "accent": "#c0e9a8",
    "body": "round",
    "habitat": "deep",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "barreleye",
    "marking": "none",
    "artVariant": 93,
    "diet": "prawn",
    "depth": "deep",
    "feedingReaction": {
      "id": "barreleye",
      "name": [
        "琉璃管眼鱼觅食",
        "Barreleye feeding"
      ],
      "description": [
        "透明头罩中的管状眼朝上，胸鳍维持深水悬停。",
        "Barreleye: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "bob"
    },
    "feedingHabit": [
      "透明头罩中的管状眼朝上，胸鳍维持深水悬停。",
      "Barreleye: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "pearlgourami",
    "name": [
      "莲露珍珠丝足",
      "Lotus pearl gourami"
    ],
    "rarity": "epic",
    "price": 210,
    "baseLength": 35,
    "color": "#d1bbd2",
    "accent": "#e5dac0",
    "body": "discus",
    "habitat": "spirit",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "gourami",
    "marking": "beads",
    "artVariant": 94,
    "diet": "lotusmeal",
    "depth": "mid",
    "feedingReaction": {
      "id": "pearlgourami",
      "name": [
        "莲露珍珠丝足觅食",
        "Lotus pearl gourami feeding"
      ],
      "description": [
        "珍珠斑点随转身渐亮，两条丝足缓慢垂下探食。",
        "Lotus pearl gourami: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "flutter"
    },
    "feedingHabit": [
      "珍珠斑点随转身渐亮，两条丝足缓慢垂下探食。",
      "Lotus pearl gourami: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "eclipserayfish",
    "name": [
      "月蚀燕鱼",
      "Eclipse batfish"
    ],
    "rarity": "epic",
    "price": 215,
    "baseLength": 58,
    "color": "#766b94",
    "accent": "#e6d0ac",
    "body": "discus",
    "habitat": "moon",
    "difficulty": 0.66,
    "fry": true,
    "expansion": 3,
    "anatomy": "banner",
    "marking": "rings",
    "artVariant": 95,
    "diet": "lotusmeal",
    "depth": "deep",
    "feedingReaction": {
      "id": "eclipserayfish",
      "name": [
        "月蚀燕鱼觅食",
        "Eclipse batfish feeding"
      ],
      "description": [
        "镰状背鳍向后弯出长弧，环纹身体轻柔侧转。",
        "Eclipse batfish: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "orbit"
    },
    "feedingHabit": [
      "镰状背鳍向后弯出长弧，环纹身体轻柔侧转。",
      "Eclipse batfish: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "celestialsturgeon",
    "name": [
      "天枢七星鲟",
      "Celestial sturgeon"
    ],
    "rarity": "legendary",
    "price": 480,
    "baseLength": 136,
    "color": "#647e9e",
    "accent": "#e7cb82",
    "body": "predator",
    "habitat": "moon",
    "difficulty": 0.85,
    "fry": true,
    "expansion": 3,
    "anatomy": "sturgeon",
    "marking": "stars",
    "artVariant": 96,
    "diet": "lotusmeal",
    "depth": "deep",
    "feedingReaction": {
      "id": "celestialsturgeon",
      "name": [
        "天枢七星鲟觅食",
        "Celestial sturgeon feeding"
      ],
      "description": [
        "五列骨板沿身体排列，长吻下方的短须探向水底。",
        "Celestial sturgeon: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "五列骨板沿身体排列，长吻下方的短须探向水底。",
      "Celestial sturgeon: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "vermillionarowana",
    "name": [
      "朱砂赤鳞龙",
      "Vermilion arowana"
    ],
    "rarity": "legendary",
    "price": 485,
    "baseLength": 128,
    "color": "#bb655a",
    "accent": "#f1cc8e",
    "body": "predator",
    "habitat": "spirit",
    "difficulty": 0.85,
    "fry": true,
    "expansion": 3,
    "anatomy": "arapaima",
    "marking": "scales",
    "artVariant": 97,
    "diet": "lotusmeal",
    "depth": "deep",
    "feedingReaction": {
      "id": "vermillionarowana",
      "name": [
        "朱砂赤鳞龙觅食",
        "Vermilion arowana feeding"
      ],
      "description": [
        "后置双鳍推动赤鳞身躯，抬头接住水面的食物。",
        "Vermilion arowana: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "leap"
    },
    "feedingHabit": [
      "后置双鳍推动赤鳞身躯，抬头接住水面的食物。",
      "Vermilion arowana: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "glaciercoelacanth",
    "name": [
      "万年冰腔棘鱼",
      "Glacier coelacanth"
    ],
    "rarity": "legendary",
    "price": 490,
    "baseLength": 148,
    "color": "#7295b1",
    "accent": "#dcf1e8",
    "body": "predator",
    "habitat": "ice",
    "difficulty": 0.85,
    "fry": true,
    "expansion": 3,
    "anatomy": "coelacanth",
    "marking": "crystals",
    "artVariant": 98,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "glaciercoelacanth",
      "name": [
        "万年冰腔棘鱼觅食",
        "Glacier coelacanth feeding"
      ],
      "description": [
        "肉质胸鳍和腹鳍成对交替摆动，三叶尾保持慢速巡游。",
        "Glacier coelacanth: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "肉质胸鳍和腹鳍成对交替摆动，三叶尾保持慢速巡游。",
      "Glacier coelacanth: Fin strokes steer a continuous body wave toward the food."
    ]
  },
  {
    "id": "abyssgulper",
    "name": [
      "幽渊囊颚鳗",
      "Abyss gulper eel"
    ],
    "rarity": "legendary",
    "price": 460,
    "baseLength": 155,
    "color": "#52547b",
    "accent": "#c6a6d3",
    "body": "slender",
    "habitat": "deep",
    "difficulty": 0.85,
    "fry": true,
    "expansion": 3,
    "anatomy": "gulper",
    "marking": "stars",
    "artVariant": 99,
    "diet": "cutbait",
    "depth": "deep",
    "feedingReaction": {
      "id": "abyssgulper",
      "name": [
        "幽渊囊颚鳗觅食",
        "Abyss gulper eel feeding"
      ],
      "description": [
        "囊状下颚缓慢张开，细长尾段连续摆动维持位置。",
        "Abyss gulper eel: Fin strokes steer a continuous body wave toward the food."
      ],
      "motion": "sway"
    },
    "feedingHabit": [
      "囊状下颚缓慢张开，细长尾段连续摆动维持位置。",
      "Abyss gulper eel: Fin strokes steer a continuous body wave toward the food."
    ]
  }
]);
  // END WATERS THREE FISH
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
  var AUTO_MOTOR={id:'auto_fishing_motor',slot:'equipment',name:['自动钓鱼马达','Automatic fishing motor'],description:['安装后自动抛竿、提竿和溜鱼，当前饵料用完后自动换饵，直到库存饵料耗尽。','Automatically casts, hooks and reels, switching bait until your inventory is empty.'],source:'fishing-mystery',asset:'/fishing-art/gift-auto_fishing_motor-v1.png',color:'#4d9d89',accent:'#e6c77c',probability:.00001};
  GIFTS.push(AUTO_MOTOR);
  var MOTOR_TICKET_COUNT=100000;
  function motorTicketWins(ticket){return Number.isInteger(ticket)&&ticket===MOTOR_TICKET_COUNT-1;}
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
    snagglefin:{id:'wish-serpentine',name:['问号蛇行','Serpentine wish'],pattern:[.5,.23,.77,.34,.48,.5]},
    crownray:{id:'crown-orbit',name:['星冠回环','Starcrown orbit'],pattern:[.5,.69,.18,.76,.42,.5]},
    stormmanta:{id:'storm-bank',name:['雷潮侧掠','Storm bank'],pattern:[.5,.84,.63,.18,.37,.5]},
    emberdrake:{id:'ember-rise',name:['赤焰攀升','Ember ascent'],pattern:[.5,.32,.14,.81,.61,.5]},
    abysskraken:{id:'kraken-feint',name:['八臂佯攻','Kraken feint'],pattern:[.5,.74,.39,.83,.21,.5]},
    aurorawhale:{id:'aurora-sweep',name:['极光长巡','Aurora sweep'],pattern:[.5,.18,.35,.82,.72,.5]}
  };
  LEGENDARY_PATTERNS.stormmanta={id:'stormmanta',name:["雷云巨鳐巡游","Storm manta patrol"],pattern:[.5,0.63,.18,.83,.34,.5]};
  LEGENDARY_PATTERNS.emberdrake={id:'emberdrake',name:["烬莲赤龙巡游","Ember lotus dragon patrol"],pattern:[.5,.755,.18,.83,.34,.5]};
  LEGENDARY_PATTERNS.abysskraken={id:'abysskraken',name:["深渊星章巡游","Abyss kraken patrol"],pattern:[.5,0.81,.18,.83,.34,.5]};
  LEGENDARY_PATTERNS.aurorawhale={id:'aurorawhale',name:["极光灵鲸巡游","Aurora whale patrol"],pattern:[.5,0.92,.18,.83,.34,.5]};
  LEGENDARY_PATTERNS.jadecrabking={id:'mountain-step',name:['横行镇岳','Mountain sidestep'],pattern:[.5,.24,.29,.77,.68,.5]};
  LEGENDARY_PATTERNS.clocknautilus={id:'clockwise-pulse',name:['时轮喷游','Clockwork jet'],pattern:[.5,.72,.41,.19,.64,.5]};
  LEGENDARY_PATTERNS.celestialsturgeon={id:'seven-star-dive',name:['七星巡底','Seven-star dive'],pattern:[.5,.34,.79,.63,.20,.5]};
  LEGENDARY_PATTERNS.vermillionarowana={id:'vermilion-surface-turn',name:['赤鳞跃返','Vermilion surface turn'],pattern:[.5,.86,.51,.21,.62,.5]};
  LEGENDARY_PATTERNS.glaciercoelacanth={id:'glacier-lobe-pulse',name:['古鳍交替','Ancient fin pulse'],pattern:[.5,.30,.63,.28,.71,.5]};
  LEGENDARY_PATTERNS.abyssgulper={id:'abyss-pouch-feint',name:['囊颚佯回','Gulper feint'],pattern:[.5,.71,.83,.27,.39,.5]};
  FISH.forEach(function(f){var profile=DIFFICULTY_PROFILES[f.rarity],technique=LEGENDARY_PATTERNS[f.id];f.difficultyProfile=profile.id;f.difficultyDescription=profile.description.slice();if(technique)f.technique={id:technique.id,name:technique.name.slice()};});
  var BAITS = [
    {id:'worm',name:['溪流蚯蚓','River worm'],price:10,quantity:10,color:'#bf8a68',description:['溪流常见鱼、蓝纱斗鱼，偶遇锦鲤。','River fish, blue silk bettas and an occasional koi.'],fishIds:['minnow','crucian','carp','perch','trout','catfish','koi','bluebetta']},
    {id:'grain',name:['香谷团饵','Sweet grain'],price:20,quantity:10,color:'#d4b778',description:['鲤鱼、金鱼与荷灯灵鲤。','Carp, goldfish and lotus lantern carp.'],fishIds:['crucian','carp','koi','goldfish','lotusfin']},
    {id:'shrimp',name:['珊瑚鲜虾','Coral shrimp'],price:35,quantity:10,color:'#ecac92',description:['珊瑚小丑鱼、海马、神仙鱼，偶遇珍珠水母。','Clownfish, seahorses, angelfish and an occasional pearl jellyfish.'],fishIds:['sardine','mackerel','seahorse','angelfish','clownfish','pearljelly']},
    {id:'glow',name:['深海荧光饵','Deep glow'],price:45,quantity:10,color:'#b9bcf4',description:['深海灯笼鱼、珍珠水母、星梦鳐，偶遇抱抱鳐与星冠鳐。','Lantern fish, pearl jellyfish and dream rays, with elusive hug and starcrown rays.'],fishIds:['sardine','mackerel','lantern','dreamray','flopray','pearljelly','crownray']},
    {id:'frost',name:['霜晶虫饵','Frost grub'],price:55,quantity:10,color:'#b9e7ee',description:['冷水鳟鱼与水晶雪鲟。','Cold water trout and crystal sturgeon.'],fishIds:['perch','trout','koi','crystal']},
    {id:'spirit',name:['灵莲丹饵','Spirit lotus'],price:75,quantity:10,color:'#afd8bc',description:['灵鲤、凤尾、龙鲤，也能引来皱皱招财鮟。','Spirit carp, phoenix tails, dragon koi and Grumpy Fortune Anglers.'],fishIds:['carp','lotusfin','phoenixfish','dragonkoi','grumpangler']},
    {id:'stardust',name:['星尘梦饵','Stardust dream'],price:100,quantity:10,color:'#b3a6de',description:['月光鳍、星梦鳐与幼鲸；追寻吞月鲀、许愿鳗和星冠鳐。','Moonfins, dream rays and whales; seek Moon-Gulp Puffers, Wish Eels and starcrown rays.'],fishIds:['trout','moonfin','dreamray','galaxywhale','gulpuffer','snagglefin','crownray']},
    {"id":"insect","name":["溪畔羽虫","River insect"],"price":18,"quantity":10,"color":"#a28d59","description":["提高上鱼率，偏向目标鱼类；鱼种由渔场决定。","Improves fish odds and favors target species; the fishing ground determines availability."],"fishIds":["minnow","bleak","trout","icechar","flyingfish"]},
    {"id":"reedseed","name":["芦穗草籽","Reed seed"],"price":28,"quantity":10,"color":"#a79d64","description":["提高上鱼率，偏向目标鱼类；鱼种由渔场决定。","Improves fish odds and favors target species; the fishing ground determines availability."],"fishIds":["crucian","carp","roach","bluegill","mullet","discus"]},
    {"id":"crab","name":["蟹肉鲜饵","Fresh crab"],"price":40,"quantity":10,"color":"#bc8056","description":["提高上鱼率，偏向目标鱼类；鱼种由渔场决定。","Improves fish odds and favors target species; the fishing ground determines availability."],"fishIds":["perch","bass","pike","lionfish","porcupine","stormmanta"]},
    {"id":"squid","name":["柔韧鱿饵","Squid strip"],"price":60,"quantity":10,"color":"#c2a4bf","description":["提高上鱼率，偏向目标鱼类；鱼种由渔场决定。","Improves fish odds and favors target species; the fishing ground determines availability."],"fishIds":["moray","glassoctopus","sailfish","abysskraken","oarfish"]},
    {"id":"spinner","name":["鎏金亮片","Golden spinner"],"price":70,"quantity":10,"color":"#d4ad60","description":["提高上鱼率，偏向目标鱼类；鱼种由渔场决定。","Improves fish odds and favors target species; the fishing ground determines availability."],"fishIds":["pike","bass","mackerel","sailfish","amberarowana"]},
    {"id":"aurora","name":["极光磷虾","Aurora krill"],"price":90,"quantity":10,"color":"#83c6c3","description":["提高上鱼率，偏向目标鱼类；鱼种由渔场决定。","Improves fish odds and favors target species; the fishing ground determines availability."],"fishIds":["smelt","icechar","crystal","aurorawhale","galaxywhale"]},
    {"id":"dragonfruit","name":["赤莲龙实","Scarlet lotus fruit"],"price":115,"quantity":10,"color":"#c16b74","description":["提高上鱼率，偏向目标鱼类；鱼种由渔场决定。","Improves fish odds and favors target species; the fishing ground determines availability."],"fishIds":["lotusfin","phoenixfish","dragonkoi","emberdrake","amberarowana","ribbonmoon"]}
  ];

  // Legacy catalog/receipts stay frozen. The live tackle kit has five roles.
  var BAIT_ALIASES={worm:'earthworm',insect:'earthworm',frost:'earthworm',grain:'dough',reedseed:'dough',shrimp:'prawn',crab:'prawn',aurora:'prawn',squid:'cutbait',spinner:'cutbait',glow:'cutbait',spirit:'lotusmeal',stardust:'lotusmeal',dragonfruit:'lotusmeal'};
  var ACTIVE_BAITS=[
    {id:'earthworm',name:['通用蚯蚓','Earthworm'],role:['通用 · 不挑鱼种','All-round · no species bias'],price:10,quantity:10,color:'#bb7966',fishBonus:.025,preferenceMultiplier:1,fishIds:[],description:['便宜耐用，所有渔场都能使用。不偏向特定鱼种，适合随手垂钓。','An affordable everyday bait for every ground, with no species bias.']},
    {id:'dough',name:['谷物团饵','Grain dough'],role:['谷物 · 鲤科与杂食鱼','Grain · carp and omnivores'],price:30,quantity:10,color:'#d5ac66',fishBonus:.05,preferenceMultiplier:3,fishIds:'crucian carp koi goldfish roach discus mullet tang dace barbel tench gudgeon bitterling icewhitefish'.split(' '),description:['谷物香气更容易引来鲤科与杂食鱼。先选渔场，再看当地有哪些目标鱼。','Grain scent favors carp and omnivores. Choose your ground first, then check its matching fish.']},
    {id:'prawn',name:['鲜虾饵','Fresh prawn'],role:['虾肉 · 礁鱼与底栖生物','Prawn · reef and bottom life'],price:30,quantity:10,color:'#b5c1b2',fishBonus:.05,preferenceMultiplier:3,fishIds:'sardine anchovy herring seahorse angelfish clownfish butterflyfish porcupine leafydragon flyingfish rivercrab glassshrimp sandgoby wrasse sandflounder hermitcrab cockle mudskipper snowcrab redshrimp seaurchin crayfish boxfish triggerfish mandarinfish bluelobster pearloyster icekingcrab icejelly chambernautilus spidercrab mantisshrimp crystalcrab ribbonseahare'.split(' '),description:['鲜虾的气味适合礁区小鱼与底栖生物，河蟹和冷水甲壳类也会靠近。','Prawn scent favors reef fish and bottom life, including river crabs and cold-water crustaceans.']},
    {id:'cutbait',name:['鱼肉切饵','Fish strips'],role:['鱼肉 · 掠食与深水鱼','Fish · predators and deep water'],price:30,quantity:10,color:'#a8b4c9',fishBonus:.05,preferenceMultiplier:3,fishIds:'perch trout catfish mackerel lantern crystal pike bass lionfish moray icechar sailfish oarfish glassoctopus stormmanta abysskraken aurorawhale mandarin softshell rockling arcticcod cuttlefish vampyroteuthis'.split(' '),description:['鲜鱼肉偏向掠食鱼和深水猎手。匹配深水抛点时，更适合寻找大型目标。','Fresh fish strips favor predators and deep-water hunters. A matching cast depth helps target larger fish.']},
    {id:'lotusmeal',name:['灵藻香饵','Lotus algae'],role:['灵性 · 灵莲与云月鱼群','Spirit · lotus and moon life'],price:30,quantity:10,color:'#8aaa72',fishBonus:.05,preferenceMultiplier:3,fishIds:FISH.filter(function(f){return ['spirit','moon'].includes(f.habitat)||['dreamray','flopray','pearljelly'].includes(f.id);}).map(function(f){return f.id;}),description:['水草与莲香混合的饵团，偏向灵性水族。它不会解锁渔场之外的鱼。','Algae and lotus scent favor spirit creatures, without introducing species from other grounds.']}
  ];
  FISH.filter(function(f){return f.expansion===3;}).forEach(function(f){var b=find(ACTIVE_BAITS,f.diet);if(b&&!b.fishIds.includes(f.id))b.fishIds.push(f.id);});
  function activeBaitId(id){return BAIT_ALIASES[id]||id;}
  function baitItem(id){return find(BAITS,id)||find(ACTIVE_BAITS,id);}
  function liveBait(id){return find(ACTIVE_BAITS,activeBaitId(id))||ACTIVE_BAITS[0];}

  var PONDS = [
    {id:'meadow',name:['溪石小塘','Creekstone pond'],price:0,color:'#91c9bd',accent:'#dbd6bb',style:'meadow'},
    {id:'lily',name:['荷叶庭院','Lily courtyard'],price:160,color:'#a8d3c1',accent:'#e9b8cd',style:'lily'},
    {id:'coral',name:['珊瑚礁池','Coral reef'],price:220,color:'#77cdd8',accent:'#efac95',style:'coral'},
    {id:'crystal',name:['霜晶湖镜','Crystal mirror'],price:280,color:'#b4dcf1',accent:'#dfeaf5',style:'crystal'},
    {id:'moon',name:['月夜星池','Moonlit pool'],price:360,color:'#8c9ed2',accent:'#dfd1eb',style:'moon'},
    {id:'cloud',name:['云海仙塘','Cloud sanctuary'],price:480,color:'#b0dacb',accent:'#e5d5a4',style:'cloud'},
    {id:'bamboo',name:['竹林山涧','Bamboo stream'],price:0,color:'#80b69f',accent:'#d1c492',style:'bamboo'},
    {id:'mangrove',name:['红树潮湾','Mangrove inlet'],price:0,color:'#7aaea0',accent:'#bb976e',style:'mangrove'},
    {id:'hotspring',name:['山石温泉','Terraced spring'],price:0,color:'#93c9c5',accent:'#dac6ad',style:'hotspring'}
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
    bamboo:[['tree',-2.18,-1.52,0,.9],['tree',.42,-2.04,0,.82],['rocks',2.29,-.81,1,.86],['reeds',-2.06,1.14,0,.7],['bench',1.21,2.09,0,.70]],
    mangrove:[['tree',-2.18,-1.53,0,.96],['tree',1.95,-1.66,0,.85],['reeds',-2.21,.75,0,.62],['dock',.28,2.22,0,.86],['basket',1.19,2.25,1,.64]],
    hotspring:[['tree',-2.11,-1.64,0,.76],['rocks',2.18,-1.63,0,.94],['lantern',-2.13,.89,0,.65],['bench',.46,2.28,0,.8],['flowers',1.96,1.34,0,.65]],
    cloud:[['willow',-2.17,-1.82,0,1.00],['flowers',-2.20,.96,0,.78],['bench',.28,2.21,0,.85],['lantern',1.49,2.22,0,.80],['rocks',2.18,-1.48,1,.98],['signpost',-1.35,2.22,0,.75]]
  };
  // Upgrade only untouched factory arrangements. User-edited layouts keep every coordinate.
  var LEGACY_DECORATION_DEFAULTS=clone(DECORATION_DEFAULTS);
  Object.assign(DECORATION_DEFAULTS,{
    lily:[['willow',2.18,-1.68,0,.84],['flowers',-2.10,1.62,0,.76],['bench',-2.16,.84,1,.73],['lilies',-.96,.28,0,.60],['lantern',-1.08,2.23,0,.65],['rocks',1.90,1.76,1,.67]],
    coral:[['tree',-2.18,.94,0,.78],['rocks',2.24,-1.53,1,.86],['reeds',.51,-2.15,0,.72],['rocks',1.55,2.05,0,.73],['basket',2.03,1.65,1,.60],['signpost',-1.63,2.06,1,.60]],
    crystal:[['tree',-2.18,-1.87,0,.87],['rocks',2.20,-1.60,1,.82],['lantern',-1.60,2.04,0,.65],['reeds',-2.26,.65,0,.60],['bench',2.17,.92,1,.72]],
    moon:[['willow',2.08,-1.65,0,.92],['lantern',-2.18,.87,0,.72],['lantern',1.85,1.87,0,.63],['flowers',-1.64,2.03,0,.62],['rocks',-1.39,-2.05,1,.73],['bench',.66,2.34,0,.64],['lilies',1.11,.50,1,.60]],
    cloud:[['willow',-2.12,-1.66,0,1.03],['flowers',2.17,.98,0,.63],['rocks',-1.32,2.13,0,.65],['lantern',1.59,2.09,0,.68],['rocks',2.18,-1.48,1,.77],['signpost',-2.15,.84,0,.60]]
  });
  function factoryDecorationLayout(rows,defaults){return Array.isArray(rows)&&rows.length===defaults.length&&rows.every(function(d,i){var r=defaults[i];return d.id==='decoration_default_'+i&&d.kind===r[0]&&d.x===r[1]&&d.z===r[2]&&d.rotation===r[3]&&d.scale===r[4];});}
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

  // Fishing grounds define availability; bait only changes weights inside a ground.
  var SPOTS=[
    {id:'creek',name:['芦苇溪塘','Reed creek'],habitats:['river'],style:'meadow',description:['浅滩白条、苇影狗鱼与锦鲤。','Shallows, bass and koi among the reeds.']},
    {id:'reef',name:['珊瑚海塘','Coral lagoon'],habitats:['sea'],style:'coral',description:['热带鱼群、旗鱼与雷潮巨翼鳐。','Reef schools, sailfish and storm mantas.']},
    {id:'frost',name:['霜镜冰塘','Frost lake'],habitats:['ice'],fishIds:['trout','perch'],style:'crystal',description:['冷水鳟鲑、水晶雪鲟与极光雪鲸。','Cold-water trout, crystal sturgeon and aurora whales.']},
    {id:'deep',name:['幽蓝深潭','Twilight depths'],habitats:['deep'],fishIds:['mackerel'],style:'moon',description:['灯鱼、海鳝与深渊星章。','Lantern fish, morays and abyss krakens.']},
    {id:'lotus',name:['灵莲仙池','Spirit lotus pool'],habitats:['spirit'],fishIds:['carp','koi'],style:'lily',description:['荷灯灵鲤、金龙鱼与焰心赤龙鱼。','Lotus carp, arowanas and ember dragons.']},
    {id:'moon',name:['云月天池','Moonlit sky pool'],habitats:['moon'],fishIds:['trout'],style:'cloud',description:['月纱飘带鱼、星冠鳐与星河幼鲸。','Moon ribbons, star rays and galaxy whales.']}
  ];
  SPOTS.forEach(function(s,i){s.unlockPrice=[0,400,1000,2200,4500,8500][i];s.valueMultiplier=[1,1.2,1.5,1.8,2.2,2.6][i];s.level=i+1;});
  // Legacy visits retain access; new access is backed by one permanent receipt.
  function groundProgress(state,at){
    var legacy=0;state.casts.forEach(function(c){if(c.valueRevision===undefined&&c.castAt<=(at===undefined?Infinity:at))legacy=Math.max(legacy,SPOTS.findIndex(function(s){return s.id===c.spotId;}));});
    return SPOTS.map(function(s,i){var unlocked=i<=legacy||state.transactions.some(function(t){return t.kind==='ground_unlock'&&t.itemId===s.id&&t.createdAt<=(at===undefined?Infinity:at);});return Object.assign(clone(s),{unlocked:unlocked});}).map(function(s,i,all){s.available=!s.unlocked&&i>0&&all[i-1].unlocked;return s;});
  }
  function unlockGround(ws,id,now){var state=read(ws),grounds=groundProgress(state),ground=find(grounds,id);if(!ground)return{ok:false,reason:'invalid-expedition'};if(ground.unlocked)return{ok:true,spent:0,changed:false};if(!ground.available)return{ok:false,reason:'previous-ground-locked'};if(economy(ws).balance<ground.unlockPrice)return{ok:false,reason:'insufficient-coins'};var at=Math.max(timestamp(now),state.updatedAt);state.transactions.push({id:'ground_unlock_'+id,kind:'ground_unlock',economyRevision:2,itemId:id,quantity:1,amount:-ground.unlockPrice,createdAt:at});save(ws,state,at);return{ok:true,spent:ground.unlockPrice,groundId:id};}
  function groundValue(fish,spotId,revision){var spot=find(SPOTS,spotId)||SPOTS[0],multiplier=revision===1?[1,1.6,2.5,4,6.5,10][spot.level-1]:spot.valueMultiplier;return Math.round(fish.price*multiplier);}
  var TIMES=[{id:'dawn',name:['清晨','Dawn']},{id:'day',name:['白昼','Day']},{id:'dusk',name:['黄昏','Dusk']},{id:'night',name:['夜晚','Night']}];
  var WEATHER=[{id:'clear',name:['晴朗','Clear']},{id:'cloudy',name:['多云','Cloudy']},{id:'rain',name:['降雨','Rain']},{id:'snow',name:['降雪','Snow']},{id:'fog',name:['雾','Fog']},{id:'storm',name:['雷雨','Thunderstorm']},{id:'unknown',name:['天气暂不可用','Weather unavailable']}];
  var DEPTHS=[{id:'near',name:['近岸','Shallows']},{id:'mid',name:['中水','Midwater']},{id:'deep',name:['深水','Deep water']}];
  // BEGIN EXPANSION BAIT PREFERENCES
  FISH.filter(function(f){return f.expansion===2;}).forEach(function(f){
    var id=({crab:'crab',hermit:'crab',lobster:'crab',mantis:'crab',shell:'grain',snail:'reedseed',urchin:'squid',starfish:'squid',squid:'squid',shrimp:'shrimp',turtle:'reedseed',axolotl:'insect'})[f.body]||({river:'worm',sea:'shrimp',ice:'frost',deep:'glow',spirit:'spirit',moon:'stardust'})[f.habitat];
    var bait=find(BAITS,id);if(!bait.fishIds.includes(f.id))bait.fishIds.push(f.id);
  });
  // END EXPANSION BAIT PREFERENCES
  FISH.slice(28).forEach(function(f){if(!BAITS.some(function(b){return b.fishIds.includes(f.id);}))find(BAITS,({river:'worm',sea:'shrimp',deep:'glow',ice:'frost',spirit:'spirit',moon:'stardust'})[f.habitat]).fishIds.push(f.id);});
  BAITS.forEach(function(b,i){b.fishBonus=[.02,.03,.04,.055,.055,.07,.08,.035,.04,.05,.065,.06,.08,.09][i];b.preferenceMultiplier=3;
    b.description=['上鱼率 +'+Number((b.fishBonus*100).toFixed(1))+'%；偏好鱼种权重 ×3。鱼种由渔场决定。','Fish odds +'+Number((b.fishBonus*100).toFixed(1))+'%; preferred species weight ×3. Availability follows the fishing ground.'];});
  RODS.forEach(function(r){if(r.id==='eclipse'){r.instantCatchChance=.15;r.effectDescription=['归墟引渡 · 咬钩时有 15% 概率直接收鱼，无需控竿小游戏。','Eclipse passage · 15% chance to land a bite immediately, skipping the reeling game.'];}
    if(r.id==='wukong'){r.multiCatchChance=.22;r.effectDescription=['身外身 · 16% 概率一竿两条、6% 概率一竿三条，只消耗一份鱼饵。','Myriad selves · 16% chance of two fish and 6% of three from one bait.'];}});
  RODS.forEach(function(r){var i=["pilgrim","sandalwood","reedraft","monkeytwig","goldenhoop","moonspade","ninerake","whitedragon","kasaya","windfan","redboy","jadebottle","demonmirror","goldenbell","sevenstars","gourd","lotuswheel","ruyi","erlang","wukong"].indexOf(r.id);if(i>=0){var notes=[["手缠麻绳、竹节包口与叶脉小饰。","Hand-bound hemp, bamboo ferrules and leaf veins."],["檀木珠链与流苏，温润木纹贯穿握柄。","Sandalwood beads and tassels over warm wood grain."],["苇叶贴合竿节，双股编绳收束渡水竹架。","Reed leaves and braided ties follow the ferry frame."],["桃实压枝，细金叶脉随花果灵枝弯曲。","Peach fruit and gilt leaf veins follow a living bough."],["三重紧箍卷云，梵音以同心金环扩散。","Three cloud-curled circlets release concentric chants."],["银月双刃与禅珠，月弧斩开水面。","Twin silver crescents and prayer beads cleave the water."],["九根独立耙齿镶银包边，收鱼留下九道水痕。","Nine silver-edged teeth carve nine wakes."],["白鳞龙首、金角与长须，白龙虚影卷浪归竿。","White dragon, gilt horns and long whiskers; a spectral dragon coils into the rod."],["赤金袈裟与细密环扣，织锦光带铺开后收束。","Crimson brocade and gilt clasps unfurl into ribbons of light."],["十三道扇骨与叶脉，扇影展开，风流沿水面旋进。","Thirteen ribs and leaf veins unfold into a sweeping wind."],["莲座托起琉璃火核，三昧火舌由蓄势到破水升腾。","A lotus supports a glass fire core; samadhi flames rise through the water."],["青釉净瓶、垂柳与露滴，甘露落水化开细涟漪。","A celadon vase, willow leaves and dew create delicate ripples."],["八方宝石围镜，照妖清光落成收鱼法印。","Eight jewels surround a mirror whose beam seals the catch."],["三枚紫金铜铃各有铃舌，摄魂声波逐圈扩散。","Three violet-gold bells with real clappers release widening sound rings."],["七星连线嵌入剑脊，剑气斩波，星位随收鱼亮起。","Seven inlaid stars follow a blade that cuts waves with starlight."],["双腹葫芦、金绳与红穗，旋流吸入瓶口再吐出收获。","A twin-chamber gourd, gilt cord and tassels draw in a spiral current."],["双轮八瓣莲火、混天绫绕身，风火双轮逐相位转动。","Twin lotus-fire wheels and sky ribbons turn through each cast phase."],["赤铁长身、两端鎏金云纹；抛竿旋棍挑浪，收鱼回旋立棍。","Red iron and engraved gold ends; spinning staff flourishes cast out and recover the catch."],["玄钢长柄、三尖两刃与嵌银天眼；中锋贯浪，双侧刃收拢鱼影。","A dark-steel shaft, three forged points and an inlaid celestial eye; twin edges flank the central blade."],["凤翅紫金冠、猴面金甲与双翎；大圣三重棍影响应身外身。","A gilt crown, monkey mask and twin plumes; three staff echoes answer Myriad Selves."]];r.effectDescription=r.effectDescription?notes[i].map(function(n,k){return n+' '+r.effectDescription[k];}):notes[i];}});
  RODS.forEach(function(r){
    if(r.id==='eclipse'){r.instantCatchChance=.195;r.effectDescription=['归墟引渡 · 每次中鱼有 19.5% 概率直接收鱼，无需溜鱼。','Eclipse passage · 19.5% of fish bites land instantly, skipping reeling.'];}
    if(r.id==='wukong'){r.multiCatchChance=.286;r.effectDescription=['身外身 · 20.8% 概率一竿两条、7.8% 概率一竿三条；每条分别跃出水面，只消耗一份鱼饵。','Myriad selves · 20.8% two fish, 7.8% three fish, each leaping separately; one bait.'];}
    if(r.id==='emperorjade'){r.skillChance=.325;r.effectDescription=['天命敕令 · 每次中鱼有 32.5% 概率将目标提升一个品质，最高传说；始终来自当前钓场。','Imperial decree · 32.5% of fish encounters upgrade one rarity, up to legendary, within the selected pond.'];}
    if(r.id==='anime_sixpaths'){r.skillChance=.39;r.effectDescription=['六道生息 · 每次中鱼有 39% 概率锁定当前钓场可育苗鱼，收获时鱼苗直接拥有 50% 成长。','Six Paths vitality · 39% of fish encounters target a nursery species from this pond; its fingerling starts at 50% growth.'];}
    if(r.id==='anime_nika'){r.skillChance=.26;delete r.instantCatchChance;r.effectDescription=['解放之鼓 · 每次中鱼有 26% 概率缩短 55% 等待时间；本竿成功后返还 1 份鱼饵，仍需亲自溜鱼。','Drums of liberation · 26% of fish encounters wait 55% less and return one bait on success; reeling remains manual.'];}
  });
  function spotFish(id){var spot=find(SPOTS,id)||SPOTS[0];return FISH.filter(function(f){return spot.habitats.includes(f.habitat)||(spot.fishIds||[]).includes(f.id);});}
  function expeditionRecord(value,at){if(!value||Object.keys(value).some(function(k){return !['spotId','timeId','weatherId','updatedAt'].includes(k);})||!find(SPOTS,value.spotId)||!find(TIMES,value.timeId)||!find(WEATHER,value.weatherId)||!time(value.updatedAt)||value.updatedAt>at)fail();return{spotId:value.spotId,timeId:value.timeId,weatherId:value.weatherId,updatedAt:value.updatedAt};}
  function settings(state){return state.expedition||{spotId:'creek',timeId:'day',weatherId:'clear',updatedAt:0};}
  function fishOdds(baitId,env){var b=env.rules>=4?liveBait(baitId):find(BAITS,baitId)||BAITS[0];return Math.min(.96,.82+b.fishBonus+((env.weatherId==='rain'||env.weatherId==='storm')?.025:env.weatherId==='cloudy'?.01:0)+(env.timeId==='dawn'||env.timeId==='dusk'?.015:0));}
  function preferredDepth(f){if(f.depth)return f.depth;return f.body==='eel'||f.body==='whale'||f.baseLength>=80?'deep':f.baseLength<=25?'near':'mid';}
  function encounterWeight(f,bait,env,depth){var weight=[60,20,7,2][RARITIES.indexOf(f.rarity)];
    if(bait.fishIds.includes(f.id))weight*=bait.preferenceMultiplier;
    if(preferredDepth(f)===depth)weight*=1.7;
    if((env.timeId==='night'&&(f.habitat==='deep'||f.habitat==='moon'))||(env.timeId==='dawn'&&f.habitat==='river')||(env.timeId==='dusk'&&f.habitat==='sea'))weight*=1.4;
    if((env.weatherId==='rain'||env.weatherId==='storm')&&['rare','epic'].includes(f.rarity))weight*=1.2;
    return weight;
  }
  function roll(seed,salt){var x=(seed^salt)>>>0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;}
  function worldCatch(baitId,seed,env,depth){
    var ticket=roll(seed,93719),odds=fishOdds(baitId,env);if(!isBlast(env)){if(ticket>=.97)return PRODUCTS[1];if(ticket>=odds)return PRODUCTS[0];}
    var bait=env.rules>=4?liveBait(baitId):find(BAITS,baitId)||BAITS[0],pool=spotFish(env.spotId).filter(function(f){return !(env.rules<5&&f.expansion===3)&&!(env.rules===2&&f.expansion===2);}),effect=hiddenOutcome(env.rodId,env.effectSeed===undefined?seed:env.effectSeed,env.rules);
    function pick(rows,salt){var weights=rows.map(function(f){return encounterWeight(f,bait,env,depth);}),total=weights.reduce(function(a,b){return a+b;},0),n=roll(seed,salt)*total;for(var i=0;i<rows.length;i++){n-=weights[i];if(n<0)return rows[i];}return rows[0];}
    var fish=pick(pool,47983);
    if(effect.skill==='imperial-decree'){var rank=RARITIES.indexOf(fish.rarity),promoted=pool.filter(function(f){return RARITIES.indexOf(f.rarity)===Math.min(3,rank+1);});if(promoted.length)fish=pick(promoted,91337);}
    if(effect.skill==='sixpaths-nurture'){var nursery=pool.filter(function(f){return f.fry;});if(nursery.length)fish=pick(nursery,72701);}
    return fish;
  }
  function expedition(ws,conditions){var state=read(ws),env=Object.assign({rules:5},settings(state),conditions&&find(TIMES,conditions.timeId)&&find(WEATHER,conditions.weatherId)?{timeId:conditions.timeId,weatherId:conditions.weatherId}:{}),bait=liveBait(state.equippedBaitId),pool=spotFish(env.spotId);
    return{selection:clone(env),spot:clone(find(SPOTS,env.spotId)),time:clone(find(TIMES,env.timeId)),weather:clone(find(WEATHER,env.weatherId)),fishChance:fishOdds(bait.id,env),grounds:groundProgress(state),fish:pool.map(function(f){return Object.assign(clone(f),{groundPrice:groundValue(f,env.spotId)});}),favoredFishIds:pool.filter(function(f){return bait.fishIds.includes(f.id);}).map(function(f){return f.id;}),depths:clone(DEPTHS)};
  }
  function setExpedition(ws,patch,now){if(!patch||Object.keys(patch).some(function(k){return !['spotId','timeId','weatherId'].includes(k);}))return{ok:false,reason:'invalid-expedition'};
    var state=read(ws),at=Math.max(timestamp(now),state.updatedAt),value=Object.assign({},settings(state),patch,{updatedAt:at});
    if(!find(SPOTS,value.spotId)||!find(TIMES,value.timeId)||!find(WEATHER,value.weatherId))return{ok:false,reason:'invalid-expedition'};
    if(!find(groundProgress(state),value.spotId).unlocked)return{ok:false,reason:'ground-locked'};
    state.expedition=value;save(ws,state,at);return{ok:true,expedition:expedition(ws)};
  }
  function progression(ws){var state=read(ws),catches=fishCatches(state),seen=new Set(),xp=0,records=[];
    catches.forEach(function(c){var f=find(FISH,c.fishId);xp+=[8,14,24,40][RARITIES.indexOf(f.rarity)]+(c.quality==='perfect'?6:0)+(seen.has(c.fishId)?0:12);seen.add(c.fishId);});
    var thresholds=[0,40,110,220,380,600,900,1300,1800,2400],level=1;while(level<10&&xp>=thresholds[level])level++;
    FISH.forEach(function(f){var rows=catches.filter(function(c){return c.fishId===f.id;});if(rows.length)records.push({fishId:f.id,count:rows.length,bestLength:Math.max.apply(null,rows.map(function(c){return c.length;})),perfect:rows.filter(function(c){return c.quality==='perfect';}).length});});
    var goals=[['first','初试鱼讯','First ripples',catches.length,3],['collector','六鳞成册','Six discoveries',seen.size,6],['traveler','六境行者','Six waters',new Set(state.casts.filter(function(c){return c.spotId;}).map(function(c){return c.spotId;})).size,6],['perfect','稳如止水','Steady hands',catches.filter(function(c){return c.quality==='perfect';}).length,5],['keeper','养鱼有成','Fish keeper',state.fry.filter(function(f){return f.growth===100;}).length,3],['legend','传说初见','Legend found',catches.filter(function(c){return find(FISH,c.fishId).rarity==='legendary';}).length,1],['master','百竿之约','A hundred catches',catches.length,100],['journal','水族博物志','Aquatic atlas',seen.size,FISH.length]];
    var fortunate=state.giftUnlocks.some(function(g){return g.id===AUTO_MOTOR.id;});
    goals.push(['fortune_child','气运之子','Child of Fortune',fortunate?1:0,1]);
    return{mastery:{level:level,xp:xp,nextLevelXp:thresholds[level]||null,progress:level===10?1:(xp-thresholds[level-1])/(thresholds[level]-thresholds[level-1])},records:records,catches:catches.length,discovered:seen.size,total:FISH.length,achievements:goals.map(function(g){return{id:g[0],name:[g[1],g[2]],current:Math.min(g[3],g[4]),target:g[4],complete:g[3]>=g[4],description:g[0]==='fortune_child'?['抽到概率0.001%的自动钓鱼马达','Obtain the automatic fishing motor with a 0.001% drop chance']:undefined};})};
  }

  function empty(){return{version:1,updatedAt:0,equippedRodId:'bamboo',equippedBaitId:'worm',equippedCabinId:'wood',boxes:[],casts:[],catches:[],fry:[],ponds:[{id:'pond_starter',styleId:'meadow',createdAt:0,updatedAt:0,archivedAt:null,sealedFishIds:[],decorationLayoutAt:0,decorations:defaultPondDecorations('meadow',0)}],transactions:[]};}
  // Revision 1 rewards retain their original rarity for immutable receipts and pity.
  var LEGACY_ONEPIECE_RARITIES={"anime_usopp":"common","anime_chopper":"common","anime_brook":"common","anime_franky":"common","anime_buggy":"common","anime_perona":"common","anime_crocodile":"common","anime_kuma":"common","anime_nami":"rare","anime_sanji":"rare","anime_robin":"rare","anime_jinbe":"rare","anime_smoker":"rare","anime_vivi":"rare","anime_aokiji":"rare","anime_kizaru":"rare","anime_doflamingo":"rare","anime_zoro":"epic","anime_ace":"epic","anime_sabo":"epic","anime_law":"epic","anime_hancock":"epic","anime_enel":"epic","anime_katakuri":"epic","anime_marco":"epic","anime_luffy":"legendary","anime_shanks":"legendary","anime_whitebeard":"legendary","anime_mihawk":"legendary","anime_nika":"legendary"};
  function receiptRodRarity(rod,revision){return rod.collection==='onepiece'&&revision===undefined?LEGACY_ONEPIECE_RARITIES[rod.id]:rod.rarity;}
  function validateTransactions(raw){
    if(raw===undefined)return[];
    if(!Array.isArray(raw)||raw.length>50000)fail();var seen=new Set();
    return raw.map(function(t){
      if(!t||!validId(t.id)||seen.has(t.id)||!validId(t.itemId)||!time(t.createdAt)||!Number.isSafeInteger(t.quantity)||t.quantity<1||t.quantity>1000)fail();seen.add(t.id);
      var item,unit;
      if(t.kind==='box'&&t.itemId==='rod_box')unit=-boxPrice(t.poolId);
      else if(t.kind==='bait'&&(item=baitItem(t.itemId)))unit=-item.price;
      else if(t.kind==='ground_unlock'&&(item=find(SPOTS,t.itemId))&&item.unlockPrice&&t.id==='ground_unlock_'+item.id)unit=-(t.economyRevision===2?item.unlockPrice:[0,600,1800,5000,12000,30000][item.level-1]);
      else if(t.kind==='pond_skin'&&(item=find(POND_SKINS,t.itemId))&&t.id==='pond_skin_'+item.id)unit=-item.price;
      else if(t.kind==='cabin'&&(item=find(CABINS,t.itemId))&&item.price)unit=-item.price;
      else if(t.kind==='feed'&&t.itemId==='pond_feed')unit=-5;
      else if(t.kind==='sale'&&(item=find(FISH,t.itemId)))unit=t.blastPercent===undefined?item.price*(t.multiplier===2?2:1):Math.max(1,Math.round(item.price*t.blastPercent/100));
      else if(t.kind==='sale'&&t.itemId==='junk'&&t.multiplier===undefined)unit=1;
      else if(t.kind==='harvest'&&(item=find(FISH,t.itemId))&&item.fry)unit=harvestValue(item);
      else if(t.kind==='duplicate'&&(item=find(RODS,t.itemId)))unit=[20,40,75,150][RARITIES.indexOf(receiptRodRarity(item,t.catalogRevision))];
      else if(t.kind==='gift_duplicate'&&find(GIFTS,t.itemId))unit=15;
      else fail();
      if(t.valueSpotId!==undefined){if(!['sale','harvest'].includes(t.kind)||!find(FISH,t.itemId)||!find(SPOTS,t.valueSpotId))fail();var baseValue=groundValue(item,t.valueSpotId,t.economyRevision||1);unit=t.kind==='harvest'?Math.round(baseValue*1.5):t.blastPercent===undefined?baseValue*(t.multiplier===2?2:1):Math.max(1,Math.round(baseValue*t.blastPercent/100));}
      if(t.economyRevision!==undefined&&(t.economyRevision!==2||!(t.kind==='ground_unlock'||['sale','harvest'].includes(t.kind)&&t.valueSpotId!==undefined)))fail();
      if(t.multiplier!==undefined&&(t.kind!=='sale'||t.multiplier!==2))fail();
      if(t.blastPercent!==undefined&&(t.kind!=='sale'||!find(FISH,t.itemId)||!Number.isInteger(t.blastPercent)||t.blastPercent<50||t.blastPercent>150||t.multiplier!==undefined))fail();
      if(t.poolId!==undefined&&(t.kind!=='box'||!find(ROD_POOLS,t.poolId)))fail();
      if(t.catalogRevision!==undefined&&(t.kind!=='duplicate'||item.collection!=='onepiece'||t.catalogRevision!==2))fail();
      if(t.kind!=='bait'&&t.quantity!==1||t.amount!==unit*t.quantity||Math.abs(t.amount)>1000000)fail();
      var out={id:t.id,kind:t.kind,itemId:t.itemId,quantity:t.quantity,amount:t.amount,createdAt:t.createdAt};
      if(t.economyRevision!==undefined)out.economyRevision=t.economyRevision;
      if(t.valueSpotId!==undefined)out.valueSpotId=t.valueSpotId;
      if(t.multiplier!==undefined)out.multiplier=t.multiplier;
      if(t.blastPercent!==undefined)out.blastPercent=t.blastPercent;
      if(t.poolId!==undefined)out.poolId=t.poolId;
      if(t.catalogRevision!==undefined)out.catalogRevision=t.catalogRevision;
      if(t.refId!==undefined){if(!validId(t.refId))fail();out.refId=t.refId;}return out;
    });
  }
  function moneySummary(raw){return validateTransactions(raw).reduce(function(a,t){if(t.amount>0)a.earned+=t.amount;else a.spent-=t.amount;return a;},{earned:0,spent:0});}
  function unlockedSouvenirRows(state){
    var catches=fishCatches(state),species=new Set(catches.map(function(c){return c.fishId;}));
    return SOUVENIRS.filter(function(item){return item.id==='first_catch'?catches.length>0:item.id==='collector'?species.size>=5:item.id==='pond_keeper'?(state.ponds.some(function(p){return p.archivedAt!==null;})||state.fry.filter(function(f){return f.growth===100;}).length>=5):catches.some(function(c){return find(FISH,c.fishId).rarity==='legendary';});});
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
      var poolId=b.poolId===undefined?'basic':b.poolId,pool=find(ROD_POOLS,poolId),counts=poolPities.get(poolId)||{epic:0,legendary:0,hidden:0};if(!pool)fail();
      if(receipt.amount!==-boxPrice(poolId)||receipt.poolId!==undefined&&receipt.poolId!==poolId||boxPrice(poolId)!==BOX_PRICE&&receipt.poolId!==poolId)fail();
      if(b.catalogRevision!==undefined&&(poolId!=='onepiece'||b.catalogRevision!==2))fail();
      if(b.pityRevision!==undefined&&b.pityRevision!==1)fail();var hiddenActive=pool.rodIds.every(function(id){return owned.has(id);});
      var rarity=receiptRodRarity(rod,b.catalogRevision),tier=b.poolId===undefined?boxRarity(b.ticket,counts.epic,counts.legendary):poolTier(poolId,b.ticket,counts.epic,counts.legendary,b.pityRevision===1&&hiddenActive?counts.hidden:undefined);
      if(!rarity||(tier==='hidden'?rod.id!==pool.hiddenRodId:rod.hidden||rarity!==tier||!pool.rodIds.includes(rod.id)))fail();
      var compensation=out.transactions.find(function(t){return t.kind==='duplicate'&&t.refId===b.id;});if(b.duplicate&&(!compensation||compensation.itemId!==rod.id)||!b.duplicate&&compensation)fail();owned.add(rod.id);
      if(compensation&&compensation.catalogRevision!==b.catalogRevision)fail();
      counts.hidden=rod.id===pool.hiddenRodId?0:counts.hidden+(hiddenActive&&b.pityRevision===1?1:0);counts.epic=RARITIES.indexOf(rarity)>=2?0:counts.epic+1;counts.legendary=rarity==='legendary'?0:counts.legendary+1;poolPities.set(poolId,counts);
      var result={id:b.id,rodId:b.rodId,openedAt:b.openedAt,duplicate:b.duplicate,ticket:b.ticket};if(b.pityRevision!==undefined)result.pityRevision=b.pityRevision;if(b.poolId!==undefined)result.poolId=poolId;if(b.catalogRevision!==undefined)result.catalogRevision=b.catalogRevision;return result;});
    rows('casts',20000,function(c){if(!baitItem(c.baitId)||!owned.has(c.rodId)||!time(c.castAt))fail();var result={id:c.id,baitId:c.baitId,rodId:c.rodId,castAt:c.castAt};
      if(c.rules!==undefined){if(![2,3,4,5,6,7,8].includes(c.rules)||!find(SPOTS,c.spotId)||!find(TIMES,c.timeId)||!find(WEATHER,c.weatherId)||!find(DEPTHS,c.depthId)||!Number.isSafeInteger(c.effectSeed)||c.effectSeed<0||c.effectSeed>0xffffffff||!(isBlast(c)?[3,4,5]:[1,2,3]).includes(c.haulCount)||typeof c.instant!=='boolean')fail();
        if(([6,8].includes(c.rules))!==(c.rodId==='valorant_spike'))fail();var expected=hiddenOutcome(c.rodId,c.effectSeed,c.rules),encounter=worldCatch(c.baitId,c.effectSeed,c,c.depthId),product=!!find(PRODUCTS,encounter.id);if(c.haulCount!==(product?1:expected.count)||c.instant!==(!product&&expected.instant))fail();
        Object.assign(result,{rules:c.rules,spotId:c.spotId,timeId:c.timeId,weatherId:c.weatherId,depthId:c.depthId,effectSeed:c.effectSeed,haulCount:c.haulCount,instant:c.instant});}
      if(c.valueRevision!==undefined){if(![1,2].includes(c.valueRevision)||!c.rules||!find(groundProgress({casts:raw.casts,transactions:out.transactions},c.castAt),c.spotId).unlocked)fail();result.valueRevision=c.valueRevision;}
      if(c.rodId==='valorant_spike'&&!isBlast(c))fail();return result;});
    var castMap=new Map(out.casts.map(function(c){return[c.id,c];})),sessions=new Set();
    rows('catches',20000,function(c){
      var cast=castMap.get(c.sessionId),fish=itemFor(c.fishId),product=find(PRODUCTS,c.fishId);
      if(!fish||!cast||(cast.rules>=2?sessions.has(c.sessionId+':'+(c.batchIndex||0)):sessions.has(c.sessionId))||!product&&!(cast.rules>=2?spotFish(cast.spotId).some(function(f){return f.id===c.fishId;}):(baitItem(cast.baitId).fishIds.length?baitItem(cast.baitId).fishIds:BAITS[0].fishIds).includes(c.fishId))||!time(c.caughtAt)||c.caughtAt<cast.castAt||!Number.isFinite(c.length)||c.length<fish.baseLength*.7||c.length>fish.baseLength*1.5||!['normal','perfect'].includes(c.quality)||!(c.soldAt===null||time(c.soldAt)&&c.soldAt>=c.caughtAt))fail();
      if(product&&product.kind==='junk'&&!product.variants.includes(c.variant)||(!product||product.kind!=='junk')&&c.variant!==undefined)fail();
      if(product&&product.openable?(c.soldAt!==null||!(c.openedAt===null||time(c.openedAt)&&c.openedAt>=c.caughtAt)):c.openedAt!==undefined)fail();
      if(cast.rules>=2&&haulFish(cast,c.batchIndex||0).id!==c.fishId)fail();
      if(c.batchIndex!==undefined&&(!cast.rules||cast.haulCount<2||!Number.isInteger(c.batchIndex)||c.batchIndex<0||c.batchIndex>=cast.haulCount)||cast.haulCount>1&&(c.batchIndex===undefined||product)||cast.instant&&c.quality==='perfect')fail();
      if(isBlast(cast)?c.blastPercent!==blastPercent(cast.effectSeed,c.batchIndex||0):c.blastPercent!==undefined)fail();
      sessions.add(cast.rules>=2?c.sessionId+':'+(c.batchIndex||0):c.sessionId);var sales=out.transactions.filter(function(t){return t.kind==='sale'&&t.refId===c.id;}),sold=sales[0],multiplier=product?1:find(RODS,cast.rodId).saleMultiplier||1;
      if(sold&&(sold.valueSpotId!==(cast.valueRevision&&!product?cast.spotId:undefined)||sold.economyRevision!==(cast.valueRevision===2&&!product?2:undefined)))fail();
      if(sales.length>1||c.soldAt!==null&&(!sold||sold.itemId!==c.fishId||sold.quantity!==1||(sold.multiplier||1)!==multiplier||(isBlast(cast)?sold.blastPercent!==c.blastPercent:sold.blastPercent!==undefined))||c.soldAt===null&&sold)fail();
      var result={id:c.id,sessionId:c.sessionId,fishId:c.fishId,length:c.length,quality:c.quality,caughtAt:c.caughtAt,soldAt:c.soldAt};if(c.blastPercent!==undefined)result.blastPercent=c.blastPercent;if(c.batchIndex!==undefined)result.batchIndex=c.batchIndex;if(c.variant!==undefined)result.variant=c.variant;if(c.openedAt!==undefined)result.openedAt=c.openedAt;return result;
    });
    out.casts.forEach(function(c){var haul=out.catches.filter(function(f){return f.sessionId===c.id;});if(haul.length&&haul.length!==(c.haulCount||1))fail();if(haul.length>1&&haul.some(function(f){return !isBlast(c)&&f.fishId!==haul[0].fishId||f.caughtAt!==haul[0].caughtAt;}))fail();});
    rows('ponds',10000,function(p){var style=find(PONDS,p.styleId);if(!style||!time(p.createdAt)||!time(p.updatedAt)||p.updatedAt<p.createdAt||!(p.archivedAt===null||time(p.archivedAt)&&p.archivedAt>=p.createdAt)||!Array.isArray(p.sealedFishIds)||p.sealedFishIds.some(function(id){return!validId(id);})||new Set(p.sealedFishIds).size!==p.sealedFishIds.length||p.sealedFishIds.length!==(p.archivedAt===null?0:5))fail();var result={id:p.id,styleId:p.styleId,createdAt:p.createdAt,updatedAt:p.updatedAt,archivedAt:p.archivedAt,sealedFishIds:p.sealedFishIds.slice()};
      // Missing optional layout fields remain absent in old signed backups.
      // Read-time defaults provide scenery without changing historical hashes.
      if(p.decorations!==undefined||p.decorationLayoutAt!==undefined){if(!time(p.decorationLayoutAt)||p.decorationLayoutAt<p.createdAt||p.decorationLayoutAt>p.updatedAt)fail();result.decorationLayoutAt=p.decorationLayoutAt;result.decorations=decorationRecord(p.decorations,p.createdAt,p.decorationLayoutAt);}return result;});
    if(!out.ponds.some(function(p){return p.id==='pond_starter';}))fail();var ponds=new Set(out.ponds.map(function(p){return p.id;})),catchMap=new Map(out.catches.map(function(c){return[c.id,c];})),fryCatches=new Set(),counts=new Map();
    rows('fry',20000,function(f){var caught=catchMap.get(f.catchId);if(!caught||isBlast(castMap.get(caught.sessionId))||!itemFor(caught.fishId).fry||caught.fishId!==f.fishId||fryCatches.has(f.catchId)||!(f.pondId===null||ponds.has(f.pondId))||!time(f.createdAt)||!time(f.updatedAt)||!time(f.growth)||f.growth>100||!(f.fedAt===null||time(f.fedAt))||!(f.releasedAt===null||time(f.releasedAt)&&f.releasedAt>=f.createdAt)||f.releasedAt!==null&&f.pondId!==null)fail();fryCatches.add(f.catchId);if(f.pondId&&f.releasedAt===null){counts.set(f.pondId,(counts.get(f.pondId)||0)+1);if(counts.get(f.pondId)>MAX_FISH)fail();}var result={id:f.id,catchId:f.catchId,fishId:f.fishId,pondId:f.pondId,createdAt:f.createdAt,updatedAt:f.updatedAt,growth:f.growth,fedAt:f.fedAt,releasedAt:f.releasedAt};var sales=out.transactions.filter(function(t){return t.kind==='harvest'&&t.refId===f.id;});if(f.harvestedAt!==undefined){if(!time(f.harvestedAt)||f.harvestedAt<f.createdAt||f.harvestedAt>out.updatedAt||f.updatedAt<f.harvestedAt||f.releasedAt!==f.harvestedAt||f.growth!==100||sales.length!==1||sales[0].id!=='harvest_'+f.id||sales[0].itemId!==f.fishId||sales[0].createdAt!==f.harvestedAt)fail();if(sales[0].valueSpotId!==residentValueSpot(out,f)||sales[0].economyRevision!==(residentValueRevision(out,f)===2?2:undefined))fail();result.harvestedAt=f.harvestedAt;}else if(sales.length)fail();return result;});
    if(out.ponds.filter(function(p){return p.archivedAt===null;}).length!==1)fail();
    out.ponds.forEach(function(p){if(p.archivedAt===null)return;// Retain historical collection IDs for old backups; residents can now move or be harvested.
      if(p.sealedFishIds.some(function(id){return!find(out.fry,id);}))fail();});
    out.catches.forEach(function(c){if(itemFor(c.fishId).fry&&!isBlast(castMap.get(c.sessionId))&&!fryCatches.has(c.id))fail();});
    out.transactions.filter(function(t){return t.kind==='ground_unlock';}).forEach(function(t){var i=SPOTS.findIndex(function(s){return s.id===t.itemId;});if(i<1||!groundProgress(out,t.createdAt)[i-1].unlocked)fail();});
    var baitCounts=inventoryBait(out);Object.keys(baitCounts).forEach(function(id){if(baitCounts[id]<0)fail();});
    if(!owned.has(raw.equippedRodId)||!baitItem(raw.equippedBaitId)||!find(CABINS,raw.equippedCabinId)||raw.equippedCabinId!=='wood'&&!out.transactions.some(function(t){return t.kind==='cabin'&&t.itemId===raw.equippedCabinId;}))fail();
    if(raw.pondAppearance!==undefined){
      var appearance=raw.pondAppearance;
      if(!appearance||typeof appearance!=='object'||Array.isArray(appearance)||Object.keys(appearance).some(function(k){return !['skinId','updatedAt'].includes(k);})||!time(appearance.updatedAt)||appearance.updatedAt>out.updatedAt||appearance.skinId!==null&&(!find(POND_SKINS,appearance.skinId)||!out.transactions.some(function(t){return t.kind==='pond_skin'&&t.itemId===appearance.skinId;})))fail();
      out.pondAppearance={skinId:appearance.skinId,updatedAt:appearance.updatedAt};
    }
    out.equippedRodId=raw.equippedRodId;out.equippedBaitId=raw.equippedBaitId;out.equippedCabinId=raw.equippedCabinId;
    out.transactions.forEach(function(t){if(t.kind==='box'&&!out.boxes.some(function(b){return b.id===t.id;}))fail();if(t.kind==='duplicate'&&!out.boxes.some(function(b){return b.id===t.refId&&b.duplicate&&b.rodId===t.itemId;}))fail();if(t.kind==='sale'&&!out.catches.some(function(c){return c.id===t.refId&&c.soldAt!==null;}))fail();if(t.kind==='harvest'&&!out.fry.some(function(f){return f.id===t.refId&&f.harvestedAt!==undefined;}))fail();if(t.kind==='feed'&&!ponds.has(t.refId)&&t.refId!=='aquarium')fail();});
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
        if(o.motorTicket!==undefined&&(!Number.isInteger(o.motorTicket)||o.motorTicket<0||o.motorTicket>=MOTOR_TICKET_COUNT||motorTicketWins(o.motorTicket)!==(o.giftId===AUTO_MOTOR.id)))fail();
        if(o.giftId===AUTO_MOTOR.id&&o.motorTicket===undefined)fail();
        giftCatches.add(o.catchId);unlocked.add(o.giftId);var row={id:o.id,catchId:o.catchId,giftId:o.giftId,openedAt:o.openedAt,duplicate:o.duplicate};if(o.motorTicket!==undefined)row.motorTicket=o.motorTicket;return row;
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
    if(raw.motorInstallation!==undefined){
      var motor=raw.motorInstallation;
      if(!motor||typeof motor!=='object'||Array.isArray(motor)||Object.keys(motor).some(function(k){return!['installed','updatedAt'].includes(k);})||typeof motor.installed!=='boolean'||!time(motor.updatedAt)||motor.updatedAt>out.updatedAt||!unlocked.has(AUTO_MOTOR.id))fail();
      out.motorInstallation={installed:motor.installed,updatedAt:motor.updatedAt};
    }
    if(raw.expedition!==undefined)out.expedition=expeditionRecord(raw.expedition,out.updatedAt);
    return out;
  }
  function inventoryBait(state){
    var result={};BAITS.concat(ACTIVE_BAITS).forEach(function(b){result[b.id]=b.id==='worm'?STARTER_BAIT:0;});
    state.transactions.forEach(function(t){if(t.kind==='bait')result[t.itemId]+=t.quantity*baitItem(t.itemId).quantity;});
    var landed=new Set(state.catches.filter(function(c){return !!find(FISH,c.fishId);}).map(function(c){return c.sessionId;}));
    state.casts.forEach(function(c){result[c.baitId]--;if(c.rules>=7&&c.rodId==='anime_nika'&&hiddenOutcome(c.rodId,c.effectSeed,c.rules).skill==='liberation-rhythm'&&landed.has(c.id))result[c.baitId]++;});
    // Project legacy remaining units into one live slot. Repeated reads and
    // merges never mint a migration receipt or duplicate the original stock.
    Object.keys(BAIT_ALIASES).forEach(function(id){result[BAIT_ALIASES[id]]+=result[id];});
    return result;
  }
  function read(ws){var state=validate(ws&&ws.fishing);state.rods=['bamboo'].concat(state.boxes.map(function(b){return b.rodId;})).filter(function(id,i,a){return a.indexOf(id)===i;});state.baits=inventoryBait(state);state.ponds.forEach(function(p){p.fishIds=state.fry.filter(function(f){return f.pondId===p.id&&f.releasedAt===null;}).map(function(f){return f.id;});if(p.decorations!==undefined&&factoryDecorationLayout(p.decorations,LEGACY_DECORATION_DEFAULTS[p.styleId]||[]))p.decorations=defaultPondDecorations(p.styleId,p.decorationLayoutAt);if(p.decorations===undefined){p.decorationLayoutAt=p.createdAt;p.decorations=defaultPondDecorations(p.styleId,p.createdAt);}});state.activePondId=state.ponds.find(function(p){return p.archivedAt===null;}).id;state.pity=pity(state);if(state.showcase===undefined){state.showcase=defaultShowcase(state);autoShowcaseStates.add(state);}else{storedShowcaseStates.set(state,state.showcase);state.showcase={fishIds:state.showcase.fishIds.filter(function(id){return find(FISH,id).rarity==='legendary';}),updatedAt:state.showcase.updatedAt};var stored=storedShowcaseStates.get(state);if(stored.decorationIds!==undefined)state.showcase.decorationIds=stored.decorationIds.slice();}if(state.mysteryOpenings===undefined){state.mysteryOpenings=[];autoOpeningStates.add(state);}state.giftUnlocks=GIFTS.filter(function(g){return state.mysteryOpenings.some(function(o){return o.giftId===g.id;});}).map(clone);if(state.giftAppearance===undefined){state.giftAppearance={avatarFrameId:null,backgroundId:null,updatedAt:0};autoGiftStates.add(state);}return state;}
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
    var pond=find(state.ponds,fry.pondId);
    var at=Math.max(timestamp(now),state.updatedAt+1,fry.updatedAt+1,state.aquarium?state.aquarium.updatedAt+1:0);
    if(present){ids.push(fryId);fry.pondId=null;fry.updatedAt=at;}else ids=ids.filter(function(id){return id!==fryId;});
    state.aquarium={fryIds:ids,updatedAt:at};save(ws,state,at);return{ok:true,changed:true,spent:0,fryId:fryId};
  }
  function feedAquarium(ws,now){
    var state=read(ws),ids=state.aquarium?state.aquarium.fryIds:[],at=Math.max(timestamp(now),state.updatedAt+1),fish=state.fry.filter(function(f){return ids.includes(f.id)&&(f.fedAt===null||at-f.fedAt>=60000);});
    if(!fish.length)return{ok:false,reason:'no-hungry-fish'};if(economy(ws).balance<5)return{ok:false,reason:'insufficient-coins'};
    receipt(state,'feed','pond_feed',1,at,'aquarium');var result=feedResidents(fish,at);save(ws,state,at);return result;
  }
  // Appearance and unlocked actions are derived from growth, so old saves and
  // moves between the nursery, pond and aquarium need no new persisted fields.
  function growthProgress(value){var n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
  function growthStage(value){var n=growthProgress(value&&typeof value==='object'?value.growth:value);return n>=100?'adult':n>=40?'juvenile':'fry';}
  var ADULT_FORMS={
    slender:[['银鳍成鱼','Silverfin adult'],['鳍尖泛起珠光，舒展体型绕流巡游。','Pearlescent fin tips and a fuller body follow the current.'],['绕流巡游','Current patrol'],'orbit'],
    round:[['丰鳍成鱼','Fullfin adult'],['体型变大，展开背鳍绕着水纹游一圈。','A fuller body and open dorsal fin circle the ripples.'],['摆尾巡游','Tail-wag patrol'],'orbit'],
    catfish:[['长须成鱼','Long-whiskered adult'],['体型变大，长须舒展，在水底缓缓绕游。','A larger body and flowing whiskers patrol the pond bed.'],['水底巡游','Bottom patrol'],'orbit'],
    koi:[['华鳍锦鲤','Bloomfin koi'],['体型变大，尾鳍舒展，珠光鳞片随着回旋闪亮。','A larger koi spreads its tail and pearlescent scales as it circles.'],['锦鳞回旋','Koi flourish'],'orbit'],
    fancy:[['盛羽长尾','Full-plume tail'],['体型变大，长尾展开成扇，旋游时泛起柔光。','A larger body unfurls a fan-shaped tail and glows through a twirl.'],['长尾旋舞','Long-tail twirl'],'twirl'],
    seahorse:[['珊瑚冠海马','Coral-crowned seahorse'],['体型变大，珊瑚冠泛起珠光，卷尾轻轻摇摆。','A larger seahorse shimmers around its coral crown and sways with a curled tail.'],['卷尾摇摆','Curled-tail sway'],'sway'],
    angel:[['琉璃长翼','Glass longwing'],['体型变大，透明长鳍舒展，在水中轻盈旋舞。','A larger body spreads translucent long fins into a gentle twirl.'],['琉璃旋舞','Glass-fin twirl'],'twirl'],
    angler:[['明灯成鱼','Bright-lantern adult'],['体型变大，灯笼与鳍尖亮起，摇动灯饵回应投喂。','A larger body lights its lantern and fin tips and wiggles its lure.'],['灯饵闪光','Lantern shimmer'],'glow'],
    ray:[['星翼成鳐','Starwing adult'],['体型变大，双翼舒展，扇动鳍翼轻轻回旋。','A larger ray spreads its wings and flutters through a gentle loop.'],['星翼回旋','Starwing flourish'],'flutter'],
    dragon:[['金冠游龙','Gold-crowned dragon'],['体型变大，金色冠鳍舒展，腾游时留下金光。','A larger dragon koi spreads its golden crown fins and rises through gold light.'],['游龙腾波','Dragon rise'],'leap'],
    whale:[['星辉成鲸','Starlit adult whale'],['体型变大，星斑泛起珠光，吐出一串星光泡泡。','A larger whale lights its star markings and releases a trail of starry bubbles.'],['鲸歌泡泡','Whale-song bubbles'],'bubble'],
    gulpuffer:[['满月吞吞','Full-moon puffer'],['体型变大，肚中月光更亮，鼓起肚子吐出月泡。','A larger puffer lights its belly moon and puffs up to release moon bubbles.'],['满月泡泡','Full-moon bubbles'],'bubble'],
    grumpangler:[['金灯招财鮟','Golden-lure fortune angler'],['体型变大，钱币灯泛起金光，摇灯回应投喂。','A larger angler shines its golden coin lure and wiggles it at mealtimes.'],['摇币闪光','Golden-lure shimmer'],'glow'],
    flopray:[['软翼拥抱鳐','Full-wing hug ray'],['体型变大，软鳍更加宽展，拢起双翼轻轻抱抱。','A larger ray spreads softer, broader fins and folds them into a hug.'],['软翼抱抱','Soft-wing hug'],'flutter'],
    snagglefin:[['星愿长鳗','Starwish adult eel'],['体型变大，长尾泛起星光，弯成问号回旋。','A larger eel lights its long tail and curls into a question-mark twirl.'],['星愿回旋','Starwish twirl'],'twirl'],
    clownfish:[['珊瑚华鳍','Coral bloomfin'],['体型变大，珊瑚色鳍边舒展，绕着食粒巡游。','A larger body spreads coral fin edges and circles its food.'],['珊瑚巡游','Coral patrol'],'orbit'],
    betta:[['蓝纱盛尾','Blue-silk fulltail'],['体型变大，蓝色长尾如丝绸展开，轻轻扇舞。','A larger body spreads its blue silk tail into a flowing fan dance.'],['蓝纱扇舞','Blue-silk fan dance'],'flutter'],
    jelly:[['月珠水母','Moon-pearl jelly'],['伞盖变大，珍珠触须舒展，吐出柔光泡泡。','A larger bell unfurls pearl tendrils and releases softly glowing bubbles.'],['珍珠泡泡','Pearl bubbles'],'bubble'],
    crownray:[['星冠长翼','Star-crowned longwing'],['体型变大，星冠泛起金光，展开双翼回旋。','A larger ray lights its golden star crown and loops with outstretched wings.'],['星冠回旋','Star-crown flourish'],'flutter']
  };
  Object.assign(ADULT_FORMS,{"crab":[["厚甲成蟹","Armored adult"],["甲壳长大，螯足更有力；横移觅食时会轮流抬螯。","A larger carapace and stronger claws; alternating claw movements accompany sideways foraging."],["抬螯觅食","Claw forage"],"bottom"],"hermit":[["成体寄居蟹","Adult hermit crab"],["螺壳与螯足长大，步足拖壳缓行，触角持续探路。","The shell and claws grow; walking legs carry the shell while antennae probe ahead."],["探路缓行","Shell walk"],"bottom"],"shrimp":[["长须成虾","Long-whiskered adult"],["腹甲长大，尾扇展开，摄食时屈腹弹尾。","Larger abdominal plates and a spreading tail fan flex during feeding."],["屈腹弹尾","Tail flick"],"dart"],"lobster":[["重螯成虾","Heavy-clawed adult"],["腹甲与双螯长大，步足依次着底，游泳足轻划。","The abdomen and claws grow; walking legs step in sequence while swimmerets paddle."],["举螯拾食","Claw forage"],"bottom"],"mantis":[["成体螳螂虾","Adult mantis shrimp"],["腹节长大，复眼独立警戒，捕捉足屈伸出击。","The abdomen grows; stalked eyes watch as the raptorial limbs flex."],["捕捉足出击","Raptorial strike"],"dart"],"turtle":[["成体水龟","Adult water turtle"],["背甲长大，甲片轮廓清晰，四肢交替划水。","A larger shell reveals its scute seams while all four limbs paddle in alternating strokes."],["交替划水","Alternating paddle"],"glide"],"shell":[["成体双壳贝","Adult bivalve"],["两片贝壳长大，铰链连接不变，软体在壳内滤食。","Both valves grow around the same hinge; the animal filters food within the shell."],["开合滤食","Filter feeding"],"pulse"],"nautilus":[["成体鹦鹉螺","Adult nautilus"],["螺壳长大，生长纹清晰，细触腕展开，漏斗轻推。","A larger shell shows its growth lines; fine cirri spread as the siphon pulses."],["展腕喷游","Cirri and jet"],"pulse"],"snail":[["成体水螺","Adult water snail"],["螺壳长大，腹足贴底滑行，两对触角探索周围。","The shell grows; the muscular foot glides along the bottom beneath two pairs of feelers."],["伸角滑行","Tentacle glide"],"bottom"],"urchin":[["成体海胆","Adult sea urchin"],["壳体长大，棘刺保持放射排列，管足贴底缓慢挪动。","The test grows beneath radial spines while tube feet move slowly over the bottom."],["管足慢行","Tube-foot crawl"],"bottom"],"starfish":[["成体海星","Adult sea star"],["五条腕足长大，腕端交替抬起，底面管足缓行。","Five arms grow, with gently lifting tips and slow movement on underside tube feet."],["五腕探路","Five-arm crawl"],"bottom"],"slug":[["成体海兔","Adult sea hare"],["腹足长大，侧翼柔软起伏，触角保持伸展。","The foot grows as the soft parapodia undulate beneath extended sensory tentacles."],["侧翼起伏","Parapodia wave"],"sway"],"axolotl":[["成体六角螈","Adult axolotl"],["体形长大，三对外鳃舒展，四肢与尾鳍协调划水。","A larger body carries three pairs of external gills; limbs and tail fin paddle together."],["展鳃划水","Gill and tail paddle"],"glide"],"octopus":[["成体章鱼","Adult octopus"],["外套膜长大，八腕舒展，吸盘跟随腕部弯曲。","The mantle grows; eight arms spread with their suckers following every bend."],["八腕舒展","Eight-arm reach"],"flutter"],"squid":[["成体头足类","Adult cephalopod"],["外套膜长大，鳍与腕柔软起伏，漏斗推动身体前进。","A larger mantle pulses as fins and arms flex and the siphon propels the animal."],["鳍腕舒展","Fin and arm fan"],"glide"]});
  function growthAppearance(value,growth){
    var source=value&&typeof value==='object'?value:{},species=find(FISH,source.speciesId||source.fishId||source.id)||source;
    var amount=growthProgress(growth!==undefined?growth:typeof value==='number'?value:source.growth==null?100:source.growth),stage=growthStage(amount),formKey=species.id==='bluebetta'?'betta':species.id;
    var form=Object.hasOwn(ADULT_FORMS,formKey)?ADULT_FORMS[formKey]:Object.hasOwn(ADULT_FORMS,species.body)?ADULT_FORMS[species.body]:ADULT_FORMS.round;
    return{stage:stage,progress:amount/100,mature:stage==='adult',scale:.64+.54*amount/100,formName:form[0].slice(),description:form[1].slice(),actionName:form[2].slice(),motion:form[3]};
  }
  function feedResidents(fish,at){
    var maturation=[];
    fish.forEach(function(f){var before=f.growth;f.growth=Math.min(100,before+20);f.fedAt=at;f.updatedAt=at;
      if(before<100&&f.growth===100){var species=find(FISH,f.fishId),appearance=growthAppearance(f);maturation.push({id:f.id,fishId:f.fishId,name:species.name.slice(),fromGrowth:before,growth:f.growth,formName:appearance.formName,description:appearance.description,actionName:appearance.actionName,motion:appearance.motion});}
    });
    return{ok:true,spent:5,fed:fish.length,fishIds:fish.map(function(f){return f.id;}),reactions:fish.map(function(f){return{id:f.id,fishId:f.fishId,reaction:clone(find(FISH,f.fishId).feedingReaction)};}),grownFishIds:maturation.map(function(f){return f.id;}),maturation:maturation};
  }
  function gardenApi(){return typeof require==='function'?require('./task-garden'):typeof globalThis!=='undefined'&&globalThis.TaskGarden;}
  function economy(ws){var garden=gardenApi();if(garden)return garden.economy(ws);var sums=moneySummary(read(ws).transactions);return{earned:sums.earned,spent:sums.spent,balance:sums.earned-sums.spent};}
  function ensure(ws){ws.fishing=validate(ws.fishing);syncMoney(ws);return read(ws);}
  function syncMoney(ws){var garden=gardenApi();if(!garden)return;var g=garden.read(ws);g.market.fishingTransactions=clone(ws.fishing.transactions);ws.taskGarden=garden.validate(g);}
  function save(ws,state,now){if(autoOpeningStates.has(state))delete state.mysteryOpenings;if(autoGiftStates.has(state))delete state.giftAppearance;if(autoShowcaseStates.has(state))delete state.showcase;else if(storedShowcaseStates.has(state))state.showcase=storedShowcaseStates.get(state);state.updatedAt=Math.max(timestamp(now),state.showcase?state.showcase.updatedAt:0,state.aquarium?state.aquarium.updatedAt:0,state.giftAppearance?state.giftAppearance.updatedAt:0,state.updatedAt);ws.fishing=validate(state);syncMoney(ws);return read(ws);}
  function receipt(state,kind,itemId,quantity,now,refId,id){var units={box:BOX_PRICE,feed:5};var item=kind==='bait'?baitItem(itemId):kind==='sale'?itemFor(itemId):kind==='duplicate'?find(RODS,itemId):null;var amount=kind==='duplicate'?[20,40,75,150][RARITIES.indexOf(item.rarity)]:kind==='sale'?item.price:-(units[kind]||item.price||90);var t={id:id||uid('ftx',now),kind:kind,itemId:itemId,quantity:quantity,amount:amount*quantity,createdAt:timestamp(now)};if(refId)t.refId=refId;if(kind==='duplicate'&&item.collection==='onepiece')t.catalogRevision=2;if(kind==='sale'){var caught=state.catches.find(function(c){return c.id===refId;}),value=catchValue(state,caught);t.amount=value;var cast=state.casts.find(function(c){return c.id===caught.sessionId;}),rod=cast&&find(RODS,cast.rodId);if(cast&&cast.valueRevision&&find(FISH,caught.fishId)){t.valueSpotId=cast.spotId;if(cast.valueRevision===2)t.economyRevision=2;}if(caught.blastPercent!==undefined)t.blastPercent=caught.blastPercent;else if(rod&&rod.saleMultiplier&&find(FISH,caught.fishId))t.multiplier=rod.saleMultiplier;}state.transactions.push(t);return t;}
  function pity(state,poolId){poolId=poolId||'basic';var pool=find(ROD_POOLS,poolId),owned=new Set(),epic=0,legendary=0,hidden=0;state.boxes.filter(function(b){return(b.poolId||'basic')===poolId;}).forEach(function(b){var active=pool.rodIds.every(function(id){return owned.has(id);}),rarity=receiptRodRarity(find(RODS,b.rodId),b.catalogRevision);hidden=b.rodId===pool.hiddenRodId?0:hidden+(active&&b.pityRevision===1?1:0);owned.add(b.rodId);epic=RARITIES.indexOf(rarity)>=2?0:epic+1;legendary=rarity==='legendary'?0:legendary+1;});var collected=pool.rodIds.filter(function(id){return owned.has(id);}).length,active=collected===pool.rodIds.length;return{epic:epic,legendary:legendary,epicRemaining:Math.max(1,10-epic),legendaryRemaining:Math.max(1,40-legendary),hidden: hidden,hiddenActive:active,hiddenRemaining:active?Math.max(1,100-hidden):null,collected:collected,collectionTotal:pool.rodIds.length};}
  function boxRarity(ticket,epic,legendary){if(legendary>=39)return'legendary';var rarity=ticket<5500?'common':ticket<8500?'rare':ticket<9700?'epic':'legendary';return epic>=9&&RARITIES.indexOf(rarity)<2?'epic':rarity;}
  function poolTier(poolId,ticket,epic,legendary,hidden){
    var pool=find(ROD_POOLS,poolId);if(!pool||!Number.isInteger(ticket)||ticket<0||ticket>=10000)return null;
    if(hidden>=99)return'hidden';
    var edge=0,tier;Object.keys(pool.odds).some(function(key){edge+=Math.round(pool.odds[key]*10000);if(ticket<edge){tier=key;return true;}return false;});
    // Natural secrets remain 0.5%; the collection guarantee takes priority at 100.
    if(tier==='hidden')return tier;if(legendary>=39)return'legendary';return epic>=9&&RARITIES.indexOf(tier)<2?'epic':tier;
  }
  function boxPrice(poolId){var pool=find(ROD_POOLS,poolId===undefined?'basic':poolId);return pool&&pool.price||BOX_PRICE;}
  function buyBox(ws,options){
    if(typeof options==='number')options={now:options};options=options||{};
    var pool=find(ROD_POOLS,options.poolId===undefined?'basic':options.poolId);if(!pool)return{ok:false,reason:'unknown-pool'};
    if(economy(ws).balance<boxPrice(pool.id))return{ok:false,reason:'insufficient-coins'};
    var state=read(ws),counts=pity(state,pool.id),ticket=random(options,10000),tier=poolTier(pool.id,ticket,counts.epic,counts.legendary,counts.hiddenActive?counts.hidden:undefined),rewards=RODS.filter(function(r){return pool.rodIds.includes(r.id)&&r.rarity===tier;}),unowned=rewards.filter(function(r){return!state.rods.includes(r.id);}),choices=unowned.length?unowned:rewards,rod=tier==='hidden'?find(RODS,pool.hiddenRodId):choices[random(options,choices.length)],duplicate=state.rods.includes(rod.id),id=uid('box',options.now);
    var purchase=receipt(state,'box','rod_box',1,options.now,null,id);if(boxPrice(pool.id)!==BOX_PRICE){purchase.poolId=pool.id;purchase.amount=-boxPrice(pool.id);}state.boxes.push({pityRevision:1,id:id,rodId:rod.id,openedAt:timestamp(options.now),duplicate:duplicate,ticket:ticket,poolId:pool.id,...(pool.id==='onepiece'?{catalogRevision:2}:{})});
    var compensation=duplicate?receipt(state,'duplicate',rod.id,1,options.now,id).amount:0;save(ws,state,options.now);
    return{ok:true,rod:clone(rod),poolId:pool.id,hidden:tier==='hidden',duplicate:duplicate,compensation:compensation,spent:boxPrice(pool.id),pity:pity(state,pool.id)};
  }
  function buyBoxes(ws,options){
    if(typeof options==='number')options={now:options};options=options||{};
    var poolId=options.poolId===undefined?'basic':options.poolId,count=10;
    if(!find(ROD_POOLS,poolId))return{ok:false,reason:'unknown-pool'};
    if(economy(ws).balance<boxPrice(poolId)*count)return{ok:false,reason:'insufficient-coins'};
    // Build all ten ordinary receipts off-workspace. A failed draw or validation
    // cannot leave a partially purchased batch in the player's save.
    var draft=clone(ws),results=[],drawOptions=Object.assign({},options,{poolId:poolId,now:timestamp(options.now)});
    for(var i=0;i<count;i++){var result=buyBox(draft,drawOptions);if(!result.ok)return result;results.push(result);}
    ws.fishing=draft.fishing;if(gardenApi())ws.taskGarden=draft.taskGarden;
    return{ok:true,count:count,poolId:poolId,results:results,spent:boxPrice(poolId)*count,compensation:results.reduce(function(sum,r){return sum+r.compensation;},0),pity:results[count-1].pity};
  }
  // Value belongs to the committed cast, never to the currently equipped rod.
  function sortedRods(rows){return (rows||RODS).slice().sort(function(a,b){return (b.hidden?4:RARITIES.indexOf(b.rarity))-(a.hidden?4:RARITIES.indexOf(a.rarity))||RODS.indexOf(a)-RODS.indexOf(b);});}
  function catchValue(state,caught){if(!caught)return 0;if(caught.fishId==='junk')return 1;var fish=find(FISH,caught.fishId),cast=state.casts.find(function(c){return c.id===caught.sessionId;}),rod=cast&&find(RODS,cast.rodId),base=fish&&(cast&&cast.valueRevision?groundValue(fish,cast.spotId,cast.valueRevision):fish.price);return fish?(isBlast(cast)?Math.max(1,Math.round(base*blastPercent(cast.effectSeed,caught.batchIndex||0)/100)):base*(rod&&rod.saleMultiplier||1)):0;}
  function buyPondSkin(ws,id,now){
    var skin=find(POND_SKINS,id);if(!skin)return{ok:false,reason:'unknown-pond-skin'};
    var state=read(ws);if(state.transactions.some(function(t){return t.kind==='pond_skin'&&t.itemId===id;}))return{ok:true,changed:false,spent:0,itemId:id};
    if(economy(ws).balance<skin.price)return{ok:false,reason:'insufficient-coins'};
    var at=Math.max(timestamp(now),state.updatedAt+1);
    state.transactions.push({id:'pond_skin_'+id,kind:'pond_skin',itemId:id,quantity:1,amount:-skin.price,createdAt:at});
    save(ws,state,at);return{ok:true,changed:true,spent:skin.price,itemId:id};
  }
  function equipPondSkin(ws,id,now){
    var state=read(ws);if(id!==null&&(!find(POND_SKINS,id)||!state.transactions.some(function(t){return t.kind==='pond_skin'&&t.itemId===id;})))return{ok:false,reason:'not-owned'};
    if(state.pondAppearance&&state.pondAppearance.skinId===id)return{ok:true,changed:false,spent:0,itemId:id};
    var at=Math.max(timestamp(now),state.updatedAt+1);state.pondAppearance={skinId:id,updatedAt:at};save(ws,state,at);return{ok:true,changed:true,spent:0,itemId:id};
  }
  function buyBait(ws,baitId,quantity,now){quantity=quantity===undefined?1:quantity;var bait=baitItem(baitId);if(!bait)return{ok:false,reason:'unknown-bait'};if(!Number.isInteger(quantity)||quantity<1||quantity>100)return{ok:false,reason:'invalid-quantity'};if(economy(ws).balance<bait.price*quantity)return{ok:false,reason:'insufficient-coins'};var state=read(ws);receipt(state,'bait',baitId,quantity,now);save(ws,state,now);return{ok:true,quantity:bait.quantity*quantity,spent:bait.price*quantity};}
  function equip(ws,kind,itemId,now){var state=read(ws),key=kind==='rod'?'equippedRodId':'equippedBaitId';var owns=kind==='rod'?state.rods.includes(itemId):!!baitItem(itemId)&&state.baits[itemId]>0;if(!owns)return{ok:false,reason:'not-owned'};state[key]=itemId;save(ws,state,now);return{ok:true,itemId:itemId};}
  function selectPondStyle(ws,pondId,styleId,now){var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;});if(!pond)return{ok:false,reason:'unknown-pond'};if(!find(PONDS,styleId))return{ok:false,reason:'unknown-style'};var at=Math.max(timestamp(now),pond.updatedAt+1),defaults=defaultPondDecorations(pond.styleId,0),unchanged=pond.decorations.length===defaults.length&&pond.decorations.every(function(d,i){return['id','kind','x','z','rotation','scale'].every(function(key){return d[key]===defaults[i][key];});});pond.styleId=styleId;pond.updatedAt=at;if(unchanged){pond.decorations=defaultPondDecorations(styleId,at);pond.decorationLayoutAt=at;}save(ws,state,at);return{ok:true,spent:0,pondId:pondId};}
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
  function releaseFish(ws,fryId,now){var state=read(ws),fry=state.fry.find(function(f){return f.id===fryId;});if(!fry)return{ok:false,reason:'unknown-fry'};if(fry.releasedAt!==null)return{ok:true,alreadyReleased:true};var pond=state.ponds.find(function(p){return p.id===fry.pondId;});if(state.aquarium&&state.aquarium.fryIds.includes(fryId)){state.aquarium.fryIds=state.aquarium.fryIds.filter(function(id){return id!==fryId;});state.aquarium.updatedAt=Math.max(timestamp(now),state.updatedAt+1);}fry.releasedAt=Math.max(timestamp(now),fry.createdAt);fry.pondId=null;fry.updatedAt=fry.releasedAt;save(ws,state,Math.max(timestamp(now),state.aquarium?state.aquarium.updatedAt:0));return{ok:true,fishId:fry.fishId,fryId:fry.id};}
  function residentValueSpot(state,fry){var caught=state.catches.find(function(c){return c.id===fry.catchId;}),cast=caught&&state.casts.find(function(c){return c.id===caught.sessionId;});return cast&&cast.valueRevision?cast.spotId:undefined;}
  function residentValueRevision(state,fry){var caught=state.catches.find(function(c){return c.id===fry.catchId;}),cast=caught&&state.casts.find(function(c){return c.id===caught.sessionId;});return cast&&cast.valueRevision;}
  function harvestValue(fish,state){var item=typeof fish==='string'?find(FISH,fish):find(FISH,fish&&fish.fishId)||fish,spot=state&&typeof fish==='object'&&residentValueSpot(state,fish);return item&&item.fry?Math.round((spot?groundValue(item,spot,residentValueRevision(state,fish)):item.price)*1.5):0;}
  function harvestFish(ws,fryId,now){
    var state=read(ws),fry=find(state.fry,fryId);
    if(!fry)return{ok:false,reason:'unknown-fry'};
    if(fry.harvestedAt!==undefined)return{ok:true,alreadyHarvested:true,earned:0};
    if(fry.releasedAt!==null)return{ok:false,reason:'fish-released'};
    if(fry.growth!==100)return{ok:false,reason:'fish-not-mature'};
    var at=Math.max(timestamp(now),state.updatedAt+1,fry.createdAt,fry.updatedAt);
    fry.harvestedAt=at;fry.releasedAt=at;fry.pondId=null;fry.updatedAt=at;
    if(state.aquarium&&state.aquarium.fryIds.includes(fryId)){state.aquarium.fryIds=state.aquarium.fryIds.filter(function(id){return id!==fryId;});state.aquarium.updatedAt=at;}
    var earned=harvestValue(fry,state);
    state.transactions.push({id:'harvest_'+fry.id,kind:'harvest',itemId:fry.fishId,quantity:1,amount:earned,createdAt:at,refId:fry.id,...(residentValueSpot(state,fry)?{valueSpotId:residentValueSpot(state,fry),...(residentValueRevision(state,fry)===2?{economyRevision:2}:{})}:{})});
    save(ws,state,at);return{ok:true,fishId:fry.fishId,fryId:fry.id,earned:earned};
  }
  function nextPondId(id){var hash=2166136261;for(var i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);return'pond_after_'+(hash>>>0).toString(36);}
  function archivePond(ws,pondId,now){var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;});if(!pond)return{ok:false,reason:'unknown-pond'};if(pond.archivedAt!==null)return{ok:true,alreadyArchived:true,pondId:pondId,activePondId:state.activePondId};if(pond.fishIds.length!==5)return{ok:false,reason:'requires-five-fish'};if(state.ponds.length>=10000)return{ok:false,reason:'pond-limit'};var at=Math.max(timestamp(now),pond.updatedAt,pond.createdAt),id=nextPondId(pond.id);if(state.ponds.some(function(p){return p.id===id;}))return{ok:false,reason:'pond-id-conflict'};pond.archivedAt=at;pond.updatedAt=at;pond.sealedFishIds=pond.fishIds.slice();state.ponds.push({id:id,styleId:'meadow',createdAt:at,updatedAt:at,archivedAt:null,sealedFishIds:[],decorationLayoutAt:at,decorations:defaultPondDecorations('meadow',at)});save(ws,state,at);return{ok:true,pondId:pondId,activePondId:id,spent:0};}
  function placeFry(ws,fryId,pondId,now){var state=read(ws),fry=state.fry.find(function(f){return f.id===fryId;}),pond=state.ponds.find(function(p){return p.id===pondId;});if(!fry)return{ok:false,reason:'unknown-fry'};if(fry.releasedAt!==null)return{ok:false,reason:'fish-released'};if(pondId!==null&&!pond)return{ok:false,reason:'unknown-pond'};if(state.aquarium&&state.aquarium.fryIds.includes(fryId))return{ok:false,reason:'fish-in-aquarium'};var oldPond=state.ponds.find(function(p){return p.id===fry.pondId;});if(fry.pondId===pondId)return{ok:true,changed:false};if(pond&&pond.fishIds.length>=MAX_FISH)return{ok:false,reason:'pond-full'};fry.pondId=pondId;fry.updatedAt=timestamp(now);save(ws,state,now);return{ok:true,changed:true};}
  function feedPond(ws,pondId,now){var state=read(ws),pond=state.ponds.find(function(p){return p.id===pondId;}),at=timestamp(now);if(!pond)return{ok:false,reason:'unknown-pond'};var fish=state.fry.filter(function(f){return f.pondId===pondId&&f.releasedAt===null&&(f.fedAt===null||at-f.fedAt>=60000);});if(!fish.length)return{ok:false,reason:'no-hungry-fish'};if(economy(ws).balance<5)return{ok:false,reason:'insufficient-coins'};receipt(state,'feed','pond_feed',1,at,pondId);var result=feedResidents(fish,at);save(ws,state,at);return result;}
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
    // One independent 1-in-100,000 roll per unopened bundle. Cosmetic collection
    // completion never increases the motor odds, and retries use the receipt.
    var motorTicket=random(options,MOTOR_TICKET_COUNT),cosmetics=GIFTS.filter(function(g){return g.slot!=='equipment';}),unseen=cosmetics.filter(function(g){return!state.giftUnlocks.some(function(owned){return owned.id===g.id;});}),pool=unseen.length?unseen:cosmetics,gift=motorTicketWins(motorTicket)?AUTO_MOTOR:pool[random(options,pool.length)],at=Math.max(timestamp(options.now),state.updatedAt+1,caught.caughtAt),opening={id:'gift_'+caught.id,catchId:caught.id,giftId:gift.id,openedAt:at,duplicate:state.giftUnlocks.some(function(g){return g.id===gift.id;}),motorTicket:motorTicket};
    caught.openedAt=at;state.mysteryOpenings.push(opening);autoOpeningStates.delete(state);
    if(opening.duplicate)state.transactions.push(giftCompensation(opening));save(ws,state,at);
    return{ok:true,gift:clone(gift),duplicate:opening.duplicate,earned:opening.duplicate?15:0,opening:clone(opening)};
  }
  function installMotor(ws,installed,now){
    var state=read(ws);if(typeof installed!=='boolean')return{ok:false,reason:'invalid-motor'};
    if(!state.giftUnlocks.some(function(g){return g.id===AUTO_MOTOR.id;}))return{ok:false,reason:'motor-not-owned'};
    if(state.motorInstallation&&state.motorInstallation.installed===installed)return{ok:true,changed:false,installed:installed};
    var at=Math.max(timestamp(now),state.updatedAt+1);state.motorInstallation={installed:installed,updatedAt:at};save(ws,state,at);return{ok:true,changed:true,installed:installed};
  }
  function motorBait(state){var preferred=activeBaitId(state.equippedBaitId);if(state.baits[preferred]>0)return preferred;var next=ACTIVE_BAITS.find(function(b){return state.baits[b.id]>0;});return next?next.id:null;}
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
  function chooseFish(baitId,seed){var bait=baitItem(baitId)||BAITS[0],pool=(bait.fishIds.length?bait.fishIds:BAITS[0].fishIds).map(function(id){var fish=find(FISH,id);return{fish:fish,weight:[60,20,7,2][RARITIES.indexOf(fish.rarity)]};}),total=pool.reduce(function(n,r){return n+r.weight;},0),ticket=seed%total;for(var i=0;i<pool.length;i++){ticket-=pool[i].weight;if(ticket<0)return pool[i].fish;}return pool[0].fish;}

  function isBlast(c){return!!c&&c.rodId==='valorant_spike'&&[6,8].includes(c.rules);}
  function blastPercent(seed,index){return 50+Math.floor(roll(seed,82567+index*7919)*101);}
  function haulFish(c,index){var seed=c.effectSeed===undefined?c.seed:c.effectSeed;if(isBlast(c)&&index)seed=Math.floor(roll(seed,19237+index*131)*4294967296);return worldCatch(c.baitId,seed,c,c.depthId);}
  function hiddenOutcome(rodId,seed,rules){
    var chance=roll(seed,61417),modern=rules>=7;
    if(rodId==='valorant_spike')return{instant:true,count:3+Math.floor(roll(seed,79631)*3),skill:'spike'};
    if(!modern)return{instant:rodId==='eclipse'&&chance<.15||rodId==='anime_nika'&&chance<.20,count:rodId==='wukong'?(chance<.06?3:chance<.22?2:1):1};
    var skill=rodId==='emperorjade'&&chance<.325?'imperial-decree':rodId==='anime_sixpaths'&&chance<.39?'sixpaths-nurture':rodId==='anime_nika'&&chance<.26?'liberation-rhythm':rodId==='eclipse'&&chance<.195?'instant':rodId==='wukong'&&chance<.286?'multiple':'';
    return{instant:skill==='instant',count:rodId==='wukong'?(chance<.078?3:chance<.286?2:1):1,skill:skill};
  }
  function castContext(s){return{rules:s.rules,spotId:s.spotId,timeId:s.timeId,weatherId:s.weatherId,depthId:s.depthId,effectSeed:s.seed,haulCount:s.haulCount,instant:s.instant};}
  function prepareEncounter(s){if(!s.rules)return;var fish=worldCatch(s.baitId,s.seed,s,s.depthId),rod=find(RODS,s.rodId),effect=hiddenOutcome(rod.id,s.seed,s.rules);
    s.fishId=fish.id;s.barSize=Math.min(.46,rod.barSize*DIFFICULTY_PROFILES[fish.rarity].barScale);s.instant=!find(PRODUCTS,fish.id)&&effect.instant;s.haulCount=find(PRODUCTS,fish.id)?1:effect.count;
    s.hiddenSkill=!find(PRODUCTS,fish.id)?effect.skill||'':'';s.haulFishIds=Array.from({length:s.haulCount},function(_,i){return haulFish(s,i).id;});
    delete s.variant;if(fish.id==='junk')s.variant=fish.variants[s.seed%fish.variants.length];
  }

  function createSession(state,options){options=options||{};state=state||empty();var rod=find(RODS,options.rodId||state.equippedRodId)||RODS[0],baitId=options.baitId||state.equippedBaitId||'worm',seed=options.seed===undefined?random(options,1000000):options.seed;if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid fishing seed');var fish=chooseCatch(baitId,seed),profile=DIFFICULTY_PROFILES[fish.rarity];var session={id:uid('cast',options.now),phase:'charging',elapsed:0,phaseTime:0,castPower:0,castDistance:0,waitDuration:0,nibble:0,biteWindow:1700,biteRemaining:0,fishBehavior:'cruise',stamina:1,swimTime:0,fishPosition:.5,barPosition:.5,barSize:Math.min(.46,rod.barSize*profile.barScale),progress:.22,tension:0,fishId:fish.id,rodId:rod.id,baitId:baitId,seed:seed,holding:false,castCommitted:false,perfect:true};if(fish.id==='junk')session.variant=fish.variants[seed%fish.variants.length];if(options.expedition||state.expedition||rod.id==='valorant_spike'){var env=options.expedition||state.expedition||settings(state);Object.assign(session,{rules:rod.id==='valorant_spike'?8:7,baitId:activeBaitId(baitId),spotId:env.spotId,timeId:env.timeId,weatherId:env.weatherId,depthId:'near',haulCount:1,instant:false});prepareEncounter(session);}sessions.set(session,{state:clone(session),startedAt:timestamp(options.now),committed:false,claimed:false,workspace:null});return session;}
  function beginCast(ws,options){var state=read(ws),spotId=options&&options.expedition&&options.expedition.spotId||settings(state).spotId;if(!find(groundProgress(state),spotId)?.unlocked)return{ok:false,reason:'ground-locked'};if(options&&options.autoMotor&&(!state.motorInstallation||!state.motorInstallation.installed||!state.giftUnlocks.some(function(g){return g.id===AUTO_MOTOR.id;})))return{ok:false,reason:'motor-not-installed'};var chosen=options&&options.baitId||state.equippedBaitId;if(options&&options.expedition||state.expedition)chosen=activeBaitId(chosen);if(!baitItem(chosen)||state.baits[chosen]<=0||state.baits[activeBaitId(chosen)]<=0)return{ok:false,reason:'no-bait'};var session=createSession(state,options);sessions.get(session).workspace=ws;if(options&&options.autoMotor){sessions.get(session).autoMotor=true;sessions.get(session).state.automatic=true;session.automatic=true;}return{ok:true,session:session};}
  function commitCast(ws,session,now){var internal=sessions.get(session);if(!internal||internal.workspace!==ws||internal.state.phase==='charging'||internal.state.phase==='escaped')return{ok:false,reason:'invalid-cast'};if(internal.committed)return{ok:true,changed:false};var state=read(ws);if(!state.rods.includes(internal.state.rodId)||state.baits[internal.state.baitId]<=0||state.baits[activeBaitId(internal.state.baitId)]<=0){internal.state.phase='escaped';Object.assign(session,internal.state);return{ok:false,reason:'no-bait'};}var receipt={id:session.id,baitId:internal.state.baitId,rodId:internal.state.rodId,castAt:timestamp(now)};if(internal.state.rules){if(!find(groundProgress(state),internal.state.spotId).unlocked)return{ok:false,reason:'ground-locked'};Object.assign(receipt,castContext(internal.state),{valueRevision:2});}state.casts.push(receipt);save(ws,state,now);internal.committed=true;internal.state.castCommitted=true;Object.assign(session,internal.state);return{ok:true,changed:true};}
  function advance(s,input,dt){var fish=itemFor(s.fishId),rod=find(RODS,s.rodId);s.elapsed+=dt;s.phaseTime+=dt;
    if(input.cancel){s.phase='escaped';s.reason='cancelled';s.nibble=0;s.biteRemaining=0;return;}
    if(s.phase==='charging'){if((input.release||input.cast)&&Number.isFinite(input.heldMs)&&input.heldMs>=0&&input.heldMs<=8000){s.elapsed+=input.heldMs-s.phaseTime;s.phaseTime=input.heldMs;}s.castPower=Math.min(1,s.phaseTime/1100);s.castDistance=.15+.85*s.castPower;if(input.release||input.cast){if(s.castPower<.12){s.phase='escaped';s.reason='short-cast';}else{s.depthId=s.castPower<.38?'near':s.castPower<.76?'mid':'deep';prepareEncounter(s);s.waitDuration=Math.round((2650+s.seed%2400-s.castDistance*1100)*(s.rules?1-(s.rules>=4?liveBait(s.baitId):baitItem(s.baitId)).fishBonus*3:1));if(isBlast(s))s.waitDuration=3800;else if(s.hiddenSkill==='liberation-rhythm')s.waitDuration=Math.round(s.waitDuration*.45);s.phase='cast';s.phaseTime=0;}}else if(s.phaseTime>8000){s.phase='escaped';s.reason='cast-timeout';}return;}
    if(s.phase==='cast'){if(s.phaseTime>=650){s.phase='waiting';s.phaseTime=0;}return;}
    if(s.phase==='detonating'){if(s.phaseTime>=950){s.phase='caught';s.phaseTime=0;s.perfect=false;s.progress=1;s.stamina=0;s.specialEffect='blast';}return;}
    if(s.phase==='waiting'){
      if(isBlast(s)){s.nibble=0;if(s.phaseTime>=s.waitDuration){s.phase='detonating';s.phaseTime=0;}return;}
      var peck=Math.max(0,1-Math.abs(s.phaseTime-s.waitDuration*.34)/120);
      if(s.seed%2)peck=Math.max(peck,Math.max(0,1-Math.abs(s.phaseTime-s.waitDuration*.68)/120));
      s.nibble=peck;
      if(input.hook){s.phase='escaped';s.reason='early-hook';s.nibble=0;}
      else if(s.phaseTime>=s.waitDuration){s.phase=s.instant?'caught':'bite';s.phaseTime=0;s.nibble=0;s.biteRemaining=s.instant?0:s.biteWindow;if(s.instant){s.perfect=false;s.progress=1;s.stamina=0;s.specialEffect='instant';}else if(s.haulCount>1)s.specialEffect='multiple';}
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
      s.tension=Math.max(0,Math.min(1,s.tension+pressure*(pressure>0?(s.rules>=7&&['emperorjade','anime_sixpaths'].includes(rod.id)?1:rod.tensionMultiplier||1):1)*dt/1000));if(!inside)s.perfect=false;
      if(s.progress>=1&&s.stamina===0){s.phase='caught';s.phaseTime=0;s.fishBehavior='rest';}
      else if(s.progress<=0&&!(s.rules>=7)&&rod.progressRescue&&!s.progressRescued&&s.phaseTime<=45000){s.progress=rod.progressRescue;s.progressRescued=true;s.specialEffect='clone-rescue';s.specialEffectAt=s.phaseTime;s.perfect=false;}
      else if(s.tension>=1&&!(s.rules>=7)&&rod.tensionRescue&&!s.tensionRescued&&s.progress>0&&s.phaseTime<=45000){s.tension=rod.tensionRescue;s.tensionRescued=true;s.specialEffect='elastic-rescue';s.specialEffectAt=s.phaseTime;s.perfect=false;}
      else if(s.progress<=0||s.tension>=1||s.phaseTime>45000){s.phase='escaped';s.reason=s.tension>=1?'line-break':'fish-escaped';}
    }
  }
  function stepSession(session,input,dt){var internal=sessions.get(session);if(!internal)throw new Error('Unknown fishing session');input=input||{};dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,60000)):16;var state=internal.state;if(state.phase==='caught'||state.phase==='escaped')return Object.assign(session,state);if(input.cancel){advance(state,input,0);return Object.assign(session,state);}var remaining=dt,timedInput={holding:!!input.holding};while(remaining>0){var chunk=Math.min(remaining,16);advance(state,timedInput,chunk);remaining-=chunk;if(state.phase==='caught'||state.phase==='escaped')break;}if(state.phase!=='caught'&&state.phase!=='escaped'&&(dt===0||input.hook||input.release||input.cast))advance(state,input,0);Object.assign(session,state);return session;}
  function stepAutoSession(session,dt){
    var internal=sessions.get(session);if(!internal||!internal.autoMotor)throw new Error('Motor is not authorized for this cast');
    var s=internal.state,remaining=Number.isFinite(dt)?Math.max(0,Math.min(dt,10000)):16;
    // Use the same physics, bite windows and tension rules as manual fishing.
    // Feedback is recalculated at every simulation step, including delayed ticks.
    while(remaining>0&&!['caught','escaped','charging'].includes(s.phase)){
      var chunk=Math.min(16,remaining),input={hook:s.phase==='bite'&&s.phaseTime>=160,holding:s.fishPosition>s.barPosition&&s.tension<.78};advance(s,input,chunk);remaining-=chunk;
    }
    return Object.assign(session,s);
  }
  function recordCatch(ws,session,now){
    var internal=sessions.get(session);if(!internal||internal.workspace!==ws||internal.state.phase!=='caught'||!internal.committed)return{ok:false,reason:'unverified-catch'};
    if(internal.claimed)return Object.assign(clone(internal.result),{alreadyRecorded:true});
    var state=read(ws),s=internal.state;if(state.catches.some(function(c){return c.sessionId===s.id;}))return{ok:false,reason:'already-recorded'};
    var fish=itemFor(s.fishId),cast=state.casts.find(function(c){return c.id===s.id;});if(!cast)return{ok:false,reason:'missing-cast'};
    var at=Math.max(timestamp(now),cast.castAt),haul=[],fryRows=[],count=s.haulCount||1;
    for(var i=0;i<count;i++){
      if(isBlast(s))fish=haulFish(s,i);
      var lengthFactor=s.rules?.8+roll(s.seed,4409+i)*.53+(s.depthId==='deep'?.07:0):.8+(s.seed%601)/1000;
      var caught={id:'fish_'+s.id+'_'+i,sessionId:s.id,fishId:fish.id,length:Math.round(fish.baseLength*lengthFactor*10)/10,quality:s.perfect?'perfect':'normal',caughtAt:at,soldAt:null};
      if(isBlast(s))caught.blastPercent=blastPercent(s.seed,i);if(count>1)caught.batchIndex=i;if(s.variant!==undefined)caught.variant=s.variant;if(fish.openable)caught.openedAt=null;
      state.catches.push(caught);haul.push(caught);
      if(fish.fry&&!isBlast(s)){var fry={id:'fry_'+s.id+'_'+i,catchId:caught.id,fishId:fish.id,pondId:null,createdAt:at,updatedAt:at,growth:s.hiddenSkill==='sixpaths-nurture'?50:0,fedAt:null,releasedAt:null};state.fry.push(fry);fryRows.push(fry);}
    }
    save(ws,state,at);internal.claimed=true;internal.catch=haul[0];internal.result={ok:true,catch:clone(haul[0]),catches:clone(haul),count:count,instant:!!s.instant,hiddenSkill:s.hiddenSkill||'',baitReturned:s.hiddenSkill==='liberation-rhythm'?1:0,fish:catchItem(haul[0]),fry:fryRows[0]?clone(fryRows[0]):null,fryRows:clone(fryRows)};
    return clone(internal.result);
  }
  function merge(base,local,remote){
    var supplied=[base!==undefined&&base!==null,remote!==undefined&&remote!==null,local!==undefined&&local!==null];
    base=validate(base);local=validate(local);remote=validate(remote);var out=clone(remote),sources=[base,remote,local].filter(function(state,i){return supplied[i];});if(!sources.length)sources=[remote];
    function union(name,mutable){
      var rows=new Map();
      sources.forEach(function(state){state[name].forEach(function(row){
        var old=rows.get(row.id);if(!old){rows.set(row.id,clone(row));return;}if(!mutable)return;
        var next=clone((row.updatedAt||row.soldAt||0)>(old.updatedAt||old.soldAt||0)?row:old);
        var identity=name==='catches'?['id','sessionId','fishId','length','quality','caughtAt','variant','batchIndex','blastPercent']:name==='fry'?['id','catchId','fishId','createdAt']:['id','createdAt'];
        identity.forEach(function(key){next[key]=old[key];});
        if(name==='fry'){
          if(old.releasedAt!==null||row.releasedAt!==null){next.releasedAt=Math.max(old.releasedAt||0,row.releasedAt||0);next.pondId=null;}
          if(old.harvestedAt!==undefined||row.harvestedAt!==undefined){next.harvestedAt=Math.min(old.harvestedAt===undefined?Infinity:old.harvestedAt,row.harvestedAt===undefined?Infinity:row.harvestedAt);next.releasedAt=next.harvestedAt;next.updatedAt=Math.max(next.updatedAt,next.harvestedAt);}
          next.growth=Math.max(old.growth,row.growth);next.fedAt=old.fedAt===null&&row.fedAt===null?null:Math.max(old.fedAt||0,row.fedAt||0);
        }
        if(name==='ponds'&&(old.archivedAt!==null||row.archivedAt!==null)){
          var sealed=old.archivedAt!==null?old:row;next.archivedAt=sealed.archivedAt;next.sealedFishIds=sealed.sealedFishIds.slice();
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
    // One deterministic receipt per resident, even when two offline clients harvest it.
    out.transactions=out.transactions.filter(function(t){return t.kind!=='harvest';});
    out.fry.forEach(function(f){if(f.harvestedAt!==undefined)out.transactions.push({id:'harvest_'+f.id,kind:'harvest',itemId:f.fishId,quantity:1,amount:harvestValue(f,out),createdAt:f.harvestedAt,refId:f.id,...(residentValueSpot(out,f)?{valueSpotId:residentValueSpot(out,f),...(residentValueRevision(out,f)===2?{economyRevision:2}:{})}:{})});});
    var newest=local.updatedAt>remote.updatedAt?local:remote;['equippedRodId','equippedBaitId','equippedCabinId','updatedAt'].forEach(function(key){out[key]=newest[key];});
    var pondLooks=sources.map(function(s){return s.pondAppearance;}).filter(Boolean).sort(function(a,b){return b.updatedAt-a.updatedAt||String(a.skinId).localeCompare(String(b.skinId));});
    if(pondLooks.length){out.pondAppearance=clone(pondLooks[0]);out.updatedAt=Math.max(out.updatedAt,out.pondAppearance.updatedAt);}else delete out.pondAppearance;
    var voyages=sources.map(function(s){return s.expedition;}).filter(Boolean).sort(function(a,b){return b.updatedAt-a.updatedAt||JSON.stringify(b).localeCompare(JSON.stringify(a));});if(voyages.length){out.expedition=clone(voyages[0]);out.updatedAt=Math.max(out.updatedAt,out.expedition.updatedAt);}else delete out.expedition;
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
    var motors=sources.map(function(s){return s.motorInstallation;}).filter(Boolean).sort(function(a,b){return b.updatedAt-a.updatedAt||Number(a.installed)-Number(b.installed);});
    if(motors.length&&unlocked.has(AUTO_MOTOR.id)){out.motorInstallation=clone(motors[0]);out.updatedAt=Math.max(out.updatedAt,out.motorInstallation.updatedAt);}else delete out.motorInstallation;
    var appearances=sources.map(function(state){return state.giftAppearance;}).filter(Boolean).sort(function(a,b){return b.updatedAt-a.updatedAt||(JSON.stringify(a)<JSON.stringify(b)?1:JSON.stringify(a)>JSON.stringify(b)?-1:0);});
    if(appearances.length){out.giftAppearance=clone(appearances[0]);['avatarFrameId','backgroundId'].forEach(function(key){if(out.giftAppearance[key]!==null&&!unlocked.has(out.giftAppearance[key]))out.giftAppearance[key]=null;});out.updatedAt=Math.max(out.updatedAt,out.giftAppearance.updatedAt);}else delete out.giftAppearance;
    return validate(out);
  }
  function preserve(previous,next){if(!next||!(previous&&previous.fishing)&&next.fishing===undefined)return next;try{next.fishing=merge(previous&&previous.fishing,next.fishing,previous&&previous.fishing);syncMoney(next);}catch(error){throw Object.assign(new Error('workspace-stale'),{code:'workspace-stale',cause:error});}return next;}
  function validateWorkspace(ws){if(ws.fishing===undefined)return ws;ws.fishing=validate(ws.fishing);var ledger=validateTransactions(ws.taskGarden&&ws.taskGarden.market&&ws.taskGarden.market.fishingTransactions);if(JSON.stringify(ledger)!==JSON.stringify(ws.fishing.transactions))fail();return ws;}
  return{catalog:{pondSkins:clone(POND_SKINS),spots:clone(SPOTS),times:clone(TIMES),weather:clone(WEATHER),depths:clone(DEPTHS),rodPools:clone(ROD_POOLS),rods:clone(RODS),baits:clone(ACTIVE_BAITS),legacyBaits:clone(BAITS),fish:clone(FISH),products:clone(PRODUCTS),gifts:clone(GIFTS),difficultyProfiles:clone(DIFFICULTY_PROFILES),pondStyles:clone(PONDS),decorations:clone(DECORATIONS),aquariumDecorations:clone(AQUARIUM_DECORATIONS)},sortedRods:sortedRods,activeBaitId:activeBaitId,BOX_PRICE:BOX_PRICE,MAX_FISH:MAX_FISH,MAX_SHOWCASE_FISH:MAX_SHOWCASE_FISH,BOX_ODDS:clone(ROD_POOLS[0].odds),empty:empty,expedition:expedition,setExpedition:setExpedition,groundProgress:groundProgress,groundValue:groundValue,unlockGround:unlockGround,progression:progression,validate:validate,validateWorkspace:validateWorkspace,validateTransactions:validateTransactions,moneySummary:moneySummary,read:read,ensure:ensure,economy:economy,pity:pity,showcase:showcase,setShowcase:setShowcase,aquarium:aquarium,placeAquariumFish:placeAquariumFish,feedAquarium:feedAquarium,growthStage:growthStage,growthAppearance:growthAppearance,poolTier:poolTier,catchItem:catchItem,catchValue:catchValue,openMysteryBundle:openMysteryBundle,installMotor:installMotor,motorBait:motorBait,motorTicketWins:motorTicketWins,stepAutoSession:stepAutoSession,equipGift:equipGift,boxRarity:boxRarity,boxPrice:boxPrice,buyBox:buyBox,buyBoxes:buyBoxes,buyPondSkin:buyPondSkin,equipPondSkin:equipPondSkin,buyBait:buyBait,equipRod:function(ws,id,now){return equip(ws,'rod',id,now);},equipBait:function(ws,id,now){return equip(ws,'bait',id,now);},selectPondStyle:selectPondStyle,setPondDecoration:setPondDecoration,resetPondDecorations:resetPondDecorations,defaultPondDecorations:defaultPondDecorations,releaseFish:releaseFish,harvestFish:harvestFish,harvestValue:harvestValue,archivePond:archivePond,placeFry:placeFry,hatch:placeFry,moveFish:placeFry,feedPond:feedPond,sellFish:sellFish,sellFishBatch:sellFishBatch,createSession:createSession,beginCast:beginCast,commitCast:commitCast,stepSession:stepSession,recordCatch:recordCatch,merge:merge,preserve:preserve};
});
