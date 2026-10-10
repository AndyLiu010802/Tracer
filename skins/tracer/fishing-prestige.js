(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingPrestige=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const Orbit=typeof module==='object'&&module.exports?require('./fishing-orbit-renderer'):globalThis.TracerFishingOrbitRenderer;
  // Hand-directed motif, trajectory and object design for every legendary rod.
  // This renderer only receives presentation data; it never mutates a cast.
  const rows=[
    ['astral','constellation',7,19,.32,1.1,'星轨织梦','A midnight-blue celestial armillary sphere float with three slender gold orbital bands, a pearl star core and tiny engraved constellations'],
    ['dragon','dragon',3,18,.42,1.6,'金龙雷鳞','An imperial jade dragon coiled once around a pearl, sculpted antlers and gold scale plates, ivory lightning indicator'],
    ['lotus','petal',8,21,.23,.6,'太虚莲瓣','An open rose-pink lotus with translucent jade sepals around an ivory pearl float, layered thin petals with delicate golden veins'],
    ['guandao','scale',5,15,.39,1.8,'青龙刃鳞','A tiny crescent guandao blade forming the dorsal fin of a dark jade dragon float, sharp silver bevel, red cord and engraved dragon eye'],
    ['golden','coin',7,20,.30,.8,'金钱化元宝','A solid gold Chinese yuanbao ingot above a carved jade and gold buoyant float, tiny square-hole cash coin crown and red silk knot','treasury'],
    ['sunforge','ember',6,17,.34,1.4,'熔金锻火','A miniature ivory and gold sun-forge float, faceted amber crucible core embraced by six hammered bronze solar fins, hot orange seams'],
    ['leviathan','fin',4,23,.27,1.2,'海皇潮汐','A deep teal leviathan crest float, swept sculpted sea-serpent fins, opal wave ridges and a pale turquoise pearl at its heart'],
    ['eclipse','shard',6,24,-.25,.9,'归墟引力镜','A dark obsidian eclipsed moon float, gold inner corona and two offset broken amethyst orbit rings, tiny iridescent crystal facets','singularity'],
    ['ruyi','cloud',3,18,.24,1.0,'定海浮云','A SMALL auspicious Chinese ruyi cloud fishing float, ivory curled cloud lobes, very thin aged-gold scroll edges, soft celadon underside, no staff or weapon'],
    ['erlang','spear',3,16,.40,1.7,'天眼银锋','An elegant silver three-pointed double-edged spearhead float inspired by Erlang Shen, longer central tip, two short symmetrical side tips, blue enamel third-eye jewel'],
    ['wukong','staff',3,23,.38,.7,'毫毛三影','A miniature red lacquer and aged gold Ruyi Jingu Bang float resting upright in an ivory cloud cradle, intricately carved golden hoop ends, two tiny pheasant plume accents','clones'],
    ['qilin','scale',5,19,.25,1.1,'麒麟玉焰','A turquoise jade qilin head and scale float with one branching antler, broad auspicious muzzle, copper-gold fire mane and cream pearl body'],
    ['ninephoenix','feather',9,24,.28,1.3,'九羽朝凰','A small vermilion and gold phoenix feather-crown float, layered nine tiny swept feathers around a faceted ruby heart, ivory enamel highlight'],
    ['bullking','horn',4,23,.29,1.5,'平天玄罡','A dark iron bull-king float with two powerful curved bronze horns, a lacquer-red central forehead plate and gold nose-ring detail, charcoal stone body'],
    ['zhugeliang','feather',7,23,.25,.8,'七星羽阵','A miniature white crane-feather fan float on carved bamboo and jade, seven gold star inlays, black feather shafts, scholarly Three Kingdoms fantasy artifact'],
    ['lubu','halberd',4,22,.45,1.1,'方天战戟','A sharply proportioned miniature Fangtian halberd crest float, dark iron central spear, two silver crescent wings, red silk and paired curved pheasant plumes'],
    ['jiangdongtiger','claw',3,20,.38,1.9,'江东虎啸','A bronze tiger-head float, finely sculpted striped forehead, amber eyes, three ivory claw details and lacquer-red rope, forceful ancient military craft'],
    ['yuanshao','banner',4,24,.26,.6,'四世金旌','A miniature four-panel gilded battle-banner float, gold embroidered crimson silk flags held around a bronze lion finial, refined military ceremonial craft'],
    ['zuoci','talisman',8,22,-.29,1.3,'遁甲符游','An ivory jade open Taoist scroll float, aged gold spindle ends, subtle cinnabar eight-trigram marks and a tiny green crystal, no readable lettering'],
    ['emperorjade','dragon',5,24,.26,.7,'五龙镇山河','A square translucent green jade imperial seal float with FIVE intertwined miniature gold dragons forming the knob, one repaired gold corner and cinnabar seal base','mandate'],
    ['anime_naruto','spiral',3,20,.50,1.8,'螺旋查克拉','Naruto Uzumaki Rasengan fishing float: a bright blue translucent chakra sphere with three curved white internal spirals, orange and black lacquer mount, tiny Hidden Leaf forehead protector detail'],
    ['anime_sasuke','arrow',4,22,-.42,1.4,'须佐箭羽','Sasuke Uchiha Susanoo arrow fishing float: a violet crystalline arrowhead with swept feather fins, dark indigo base, a small red Sharingan jewel with black tomoe'],
    ['anime_hashirama','leaf',6,21,.27,1.6,'木遁生长','Hashirama Senju Wood Dragon float: intricately carved warm wood dragon curled around a cream buoy, branching antlers, green leaf shoots and red armor lacquer inlay'],
    ['anime_madara','meteor',3,25,.24,.9,'天碍星屑','Madara Uchiha meteor float: cracked dark rocky sphere with a muted violet chakra core, red samurai armor collar, small lavender Rinnegan concentric-eye inset'],
    ['anime_sixpaths','orb',9,24,.32,.65,'求道玉法环','Naruto Six Paths Sage float: luminous golden chakra core with precise black magatama collar, miniature matte black Truth-Seeking Orb crown, tiny black ring-ended staff motif, orange and ivory cel shading','truth_orbs'],
    ['anime_luffy','fist',3,18,.37,1.5,'橡胶拳风','Monkey D. Luffy float: a beautifully woven miniature straw hat with vivid red band resting on a glossy compact red buoy, a little ivory curled rubber fist detail beneath, One Piece anime prop'],
    ['anime_shanks','slash',3,22,.39,1.4,'神避霸气','Red-Haired Shanks float: elegant miniature curved saber guard and ivory enamel buoy, dark red wrap, THREE clean parallel scar marks on a red medallion, narrow black-red Haki accents'],
    ['anime_whitebeard','fracture',4,23,.25,.8,'震震裂空','Whitebeard float: massive ivory crescent mustache motif across a white and gold buoy, miniature bisento crest with a sharp silver crescent edge, subtle pale blue quake cracks'],
    ['anime_mihawk','blade',4,20,-.35,1.6,'黑刀绿芒','Dracule Mihawk black sword Yoru float: miniature black cruciform blade with ornate gold crossguard and ruby cabochons mounted vertically over dark violet pearl body, precise clean sword proportions'],
    ['anime_nika','cloud',4,25,.28,.6,'解放白云鼓点','Gear Five Luffy Nika fishing float: small white cloud-like Gomu fruit-shaped buoy with sculpted curling white swirls, curved golden stem, a miniature straw-hat red-band crown, pearl white with warm cream cel shadows, joyful free flowing silhouette','liberation'],
    ['anime_blackbeard','vortex',5,24,-.36,1.2,'暗水引力','Marshall D. Teach Blackbeard float: dark purple translucent gravity sphere with a black vortex core, gold collar with THREE tiny ivory skulls, small cracked white quake bead inset'],
    ['anime_kaido','lightning',4,25,.44,1.3,'雷鸣龙息','Kaido fishing float: dark iron kanabo club-head buoy with small pyramidal studs, paired ivory dragon horns and a tiny blue dragon-scale collar, restrained violet lightning seam'],
    ['anime_bigmom','flame',3,24,.35,1.1,'霍米兹三重奏','Big Mom Napoleon float: miniature pink bicorne pirate hat with gold trim and tiny stylized smiling skull crest, supported by a ivory cloud buoy, amber Prometheus flame jewel and violet Hera bead'],
    ['anime_pain','ripple',6,22,.28,1.0,'轮回斥力','Pain Nagato Rinnegan float: a translucent lavender eye sphere with SIX fine concentric circles and a black pupil, dark collar with six small metal piercings, orange accent and Akatsuki red cloud enamel'],
    ['anime_tobirama','wave',4,23,-.33,1.5,'水龙回旋','Tobirama Senju Water Dragon float: a translucent icy blue water dragon curled around a small white pearl, silver three-flange forehead protector collar and red cheek-line inlays'],
    ['anime_orochimaru','snake',2,22,.30,1.8,'白蛇草薙','Orochimaru float: an elegant white snake coiled smoothly around a straight miniature silver Kusanagi blade, purple braided cord collar and ivory buoyant body, tiny golden slit-pupil eye'],
    ['valorant_astra','star',5,23,.27,.7,'星界引力','VALORANT Astra float based on her Astral Form star: faceted deep violet cosmic core held in sculpted gold star-shaped armature, tiny orange nebula center'],
    ['valorant_breach','fault',4,19,.40,1.6,'裂地机械脉冲','VALORANT Breach float based on his mechanical arm seismic charge: compact orange and steel piston unit with angular segmented plates and bright amber seismic slit'],
    ['valorant_brimstone','target',3,22,.25,1.0,'轨道定位','VALORANT Brimstone float based on his wrist tactical beacon: compact dark military cylinder, orange illuminated orbital targeting lens, rugged grey armored fins'],
    ['valorant_chamber','card',4,19,.30,1.3,'金色传送信标','VALORANT Chamber Rendezvous anchor float: exquisite gold angular teleport beacon with blue-black enamel panels, geometric card-shaped fins and crisp Art Deco lines'],
    ['valorant_clove','butterfly',4,22,.26,.9,'蝶翼轮回','VALORANT Clove float based on their pink violet butterflies: translucent lavender pearl held by two sculpted pink butterfly wings with dark scalloped tips, subtle iridescence'],
    ['valorant_cypher','wire',4,20,.35,1.2,'赛博侦测','VALORANT Cypher Spycam-inspired float: compact cream and dark steel surveillance camera orb, vivid cyan circular lens, two clean angular articulated fins'],
    ['valorant_deadlock','mesh',4,21,.26,1.5,'纳米丝网','VALORANT Deadlock Barrier Mesh float: compact blue-grey nanowire grenade body with four silver extending prongs, delicate taut cyan filament cross and central teal emitter'],
    ['valorant_fade','eye',3,24,-.31,1.0,'诡眼黯痕','VALORANT Fade Haunt float: a dark nightmare eye with pale cyan iris inside sculpted black smoky claw-shaped fins, subtle muted red rim and dark blue shell'],
    ['valorant_gekko','wing',3,22,.34,.8,'伙伴巡游','VALORANT Gekko Dizzy float: blue-violet pointed head with glowing pupil-less yellow eyes, four small flippers, curled blue tail and black segmented armadillo back shell; faithful miniature based on the game reference'],
    ['valorant_harbor','wave',4,24,.26,1.3,'水纹金环','VALORANT Harbor ancient bracelet float: turquoise translucent water pearl encircled by ornate antique gold Indian bracelet segments, pale aqua water ridges'],
    ['valorant_iso','hex',4,21,.32,1.4,'棱盾偏转','VALORANT Iso Contingency float: small violet translucent energy shield crystal with clipped hexagonal planes, white and dark grey geometric mount and magenta edge light'],
    ['valorant_jett','kunai',5,23,.42,1.2,'五刃逐风','VALORANT Jett Blade Storm float: FIVE small sleek silver throwing knives fan around a pale cyan floating core, crisp cyan blade edges, dark blue hilts'],
    ['valorant_kayo','suppress',4,20,.29,1.6,'压制脉波','VALORANT KAY/O ZERO POINT float: a compact angular suppressor knife with dark navy armored grip, violet luminous central slit, geometric steel blade tip, robotic functional construction'],
    ['valorant_killjoy','bot',3,19,.32,.8,'纳米哨卫','VALORANT Killjoy Alarmbot float: miniature yellow and white rounded robot with a single cyan optical eye, two stubby articulated feet and black hazard seams'],
    ['valorant_miks','sound',4,22,.33,1.0,'声脉共振','VALORANT Miks M-pulse inspired float: a compact futuristic sound emitter puck with lime-green luminous concentric speaker diaphragm, charcoal and warm bronze protective cage'],
    ['valorant_neon','lightning',5,20,.55,1.8,'双线疾电','VALORANT Neon float: faceted cobalt and electric cyan relay-bolt core with two yellow charged fins and sharp angular lightning channels'],
    ['valorant_omen','veil',3,25,-.28,1.2,'暗影折叠','VALORANT Omen float: miniature deep violet hood enclosing exactly THREE vertical cyan face slits, dark smoke-sculpted pearl base, no human face'],
    ['valorant_phoenix','flame',5,21,.40,1.5,'炙热焰环','VALORANT Phoenix Curveball float: a compact bright amber-orange fire orb encased in sculpted red flame tongues, warm white core and charcoal collar'],
    ['valorant_raze','rocket',3,23,.37,1.1,'彩漆爆破','VALORANT Raze Boom Bot float: miniature orange and yellow angular wheeled bot body with white skull-like faceplate and two tiny black tread details, teal spray-paint accents'],
    ['valorant_reyna','eye',3,24,.33,.7,'灵魂汲取','VALORANT Reyna Leer float: translucent magenta-purple eye orb with crisp dark vertical pupil, violet thorn-like orbit crest and pearl pale highlights'],
    ['valorant_sage','crystal',4,22,-.24,1.4,'玉珠冰棱','VALORANT Sage Slow Orb float: pale jade turquoise glass sphere held by dark green stone facets and white silk collar, carved crystalline segments with soft internal mint glow'],
    ['valorant_skye','bird',3,24,.31,.9,'木隼巡风','VALORANT Skye Guiding Light float: intricately carved small wooden hawk with outstretched green glowing leaf-like wings, warm wooden beak and golden eyes'],
    ['valorant_sova','arrow',3,22,.37,1.7,'寻敌电羽','VALORANT Sova Recon Bolt float: compact silver and blue mechanical arrowhead with a bright cyan circular sonar emitter and three narrow feather fins'],
    ['valorant_tejo','missile',3,23,.32,1.1,'导弹巡航','VALORANT Tejo Guided Salvo float: compact orange and military olive guided rocket beacon, paired small missile fins and bright orange targeting lens'],
    ['valorant_veto','tether',4,23,-.31,1.3,'异变缚索','VALORANT Veto Interceptor inspired float: a dark graphite and green mutated interception core with organic segmented claws and vivid lime central emitter, compact sentinel device'],
    ['valorant_viper','droplet',5,21,.30,1.6,'毒雾回流','VALORANT Viper Poison Cloud float: accurate small dark green chemical canister with angular black armored caps, neon green toxin window and silver latch'],
    ['valorant_vyse','thorn',5,23,-.29,1.0,'液金蔷薇','VALORANT Vyse Arc Rose float: an intricate sculpted metallic violet rose with pointed silver petals, a bright magenta central eye and curling liquid-metal thorns'],
    ['valorant_waylay','prism',4,24,.41,.9,'折光棱镜','VALORANT Waylay float: beautifully faceted warm ivory prismatic light crystal, sharp gold and pearly cyan refractive fins, a tiny amber central core'],
    ['valorant_yoru','rift',3,22,-.35,1.5,'裂隙鬼面','VALORANT Yoru dimensional drift mask float: faithful compact blue oni mask with two short silver horns, sharp tusk details, cyan dimensional seam and dark indigo enamel'],
    ['valorant_spike','panel',3,22,.26,.6,'辐能三棱展开','VALORANT Spike miniature device used as a fishing collectible float: black and gunmetal three-sided folded angular capsule, characteristic bright CYAN TRIANGULAR center inset and thin cyan side strips, precisely beveled industrial armor, compact faithful planted-Spike-inspired silhouette','radianite']
  ];
  const themes=Object.freeze(Object.fromEntries(rows.map(([id,motif,count,radius,speed,pitch,label,bobber,signature])=>[id,Object.freeze({id,motif,count,radius,speed,pitch,label,bobber,signature:signature||null,src:'/fishing-art/float-prestige-'+id+'-v1.png'})])));
  const TAU=Math.PI*2,clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0)),smooth=n=>{n=clamp(n);return n*n*(3-2*n);},mix=(a,b,t)=>a+(b-a)*t;
  const get=id=>Object.hasOwn(themes,id)?themes[id]:null;
  // Motifs are real silhouettes with interior construction strokes, not a
  // shared particle recoloured for each collection. Coordinates are local.
  const glyphs={
    constellation:['M-6 2L-2-5L4-2L6 5L-6 2M-2-5L0 4L6 5','M-6 0V4M-8 2H-4M2-2H6M4-4V0'],
    dragon:['M-9 5Q-12-2-4-2Q5 1 1-5L4-7L10-4L7-1L3-2Q10 6 1 8Q-5 9-9 5Z','M3-5L2-10M6-5L9-9M-3 0L-6 4M5-3H7'],
    petal:['M0 8C-12 0-7-8 0-10C7-8 12 0 0 8Z','M0 6Q-2 0 0-7M0 3L-4-1M0 1L4-3'],
    scale:['M-7-4Q0-10 7-4L4 3L0 8L-4 3Z','M-5-3Q0-6 5-3M-3 1L0 4L3 1'],
    coin:['M8 0A8 8 0 1 0-8 0A8 8 0 1 0 8 0ZM-2-2V2H2V-2Z','M6 0A6 6 0 1 0-6 0A6 6 0 1 0 6 0'],
    ember:['M0 8Q-8 4-5-2L-2 0L0-10Q2-5 5-3Q10 3 0 8Z','M0 6Q-3 1 1-3Q6 3 0 6'],
    fin:['M-9 5Q-3 2-2-8Q4-2 9-1Q7 5 0 8Z','M-5 5Q0 0-1-5M0 6L5 1'],
    shard:['M0-10L6-3L4 6L-2 9L-7 1Z','M0-10L-1 0L4 6M-7 1L-1 0L6-3M-1 0L-2 9'],
    cloud:['M-10 3Q-14-4-7-4Q-7-11 0-8Q7-12 9-5Q16-3 11 4Q2 10-10 3Z','M-8 1Q-4-3-1 1Q2 4 5 0M0-5Q5-8 7-3'],
    spear:['M0-11L3-3L8-7L6 3L2 5V10H-2V5L-6 3L-8-7L-3-3Z','M0-7V8M3 1L5-2M-3 1L-5-2'],
    staff:['M-2-12H2V12H-2Z','M-2-8H2M-2 8H2M-2-10H2M-2 10H2'],
    feather:['M-7 9Q-5-10 8-10Q12 3-7 9Z','M-7 9L6-7M-3 4L-3-2M0 1L6 1M3-3L8-3'],
    horn:['M-8-9Q-2-3-5 7L0 10L5 7Q2-3 8-9Q9 4 4 9L0 12L-4 9Q-9 4-8-9Z','M-6-4L-4 6M6-4L4 6'],
    halberd:['M0-12L3-5L2 9H-2L-3-5ZM2-5Q11-9 8 3L3 5ZM-2-5Q-11-9-8 3L-3 5Z','M0-8V7M4-3L7-5M-4-3L-7-5'],
    claw:['M-8-8Q-4-3-7 8L-10 10Q-5-3-8-8ZM0-10Q5-2 1 8L-2 10Q1-3 0-10ZM8-8Q14-2 9 8L6 9Q10-2 8-8Z',''],
    banner:['M-5-10L8-7L5-2L8 4L-5 3Z','M-5-12V12M-2-6L5-5M-2-2L4-1'],
    talisman:['M-5-10L6-8L4 11L-6 9Z','M-2-5L2-5M-3-2L2-2M-2 1L1 1M-3 4L0 4M-3 7H1'],
    spiral:['M9 0A9 9 0 1 0-9 0A9 9 0 1 0 9 0','M-6 1Q-4-7 3-4Q9 1 2 5Q-4 8-3 1Q-1-4 3 0Q5 3 0 3'],
    arrow:['M0-12L7-2L2-3L2 6L6 10L1 8L0 12L-1 8L-6 10L-2 6L-2-3L-7-2Z','M0-8V8'],
    leaf:['M-7 8Q-10-6 8-10Q12 5-7 8Z','M-7 8L6-7M-3 3L-5-2M0 0L5 1'],
    meteor:['M-7-3L-2-9L6-7L10 0L5 8L-4 9L-9 2Z','M-2-9L0-1L6-7M-9 2L0-1L5 8M0-1L10 0'],
    orb:['M7 0A7 7 0 1 0-7 0A7 7 0 1 0 7 0','M-4-2Q-2-5 1-4'],
    fist:['M-6 8L-8 1L-6-5L-3-6L0-7L3-6L6-4L8 1L5 7Z','M-5-3L-4 1M-1-4V1M3-3V1M-6 3L0 4L3 2'],
    slash:['M-12 8Q0-9 12-9Q-1-2-12 8Z','M-7 4Q1-4 7-6'],
    fracture:['M-11-7L-4-2L-6 2L0 1L3 6L12 10','M-4-2L0-8M0 1L7-2M3 6L-3 10'],
    blade:['M0-12L3-7L2 3H8V6H2V12H-2V6H-8V3H-2L-3-7Z','M0-9V10M-6 4H6'],
    vortex:['M10 0Q7-12-3-8Q-12-3-7 5Q0 13 8 5Q12-2 4-4Q-3-6-3 1Q-2 6 3 2Q6-1 2-1',''],
    lightning:['M1-12L-7 1L-1 0L-4 12L8-3L2-2Z','M0-7L-4-1H1'],
    flame:['M0 10Q-12 2-5-5L-2 0Q2-5 0-12Q13-1 7 5Q6 0 3 0Q6 7 0 10Z','M0 7Q-4 2 0-3'],
    ripple:['M10 0A10 10 0 1 0-10 0A10 10 0 1 0 10 0','M6 0A6 6 0 1 0-6 0A6 6 0 1 0 6 0M2 0A2 2 0 1 0-2 0A2 2 0 1 0 2 0'],
    wave:['M-12 4Q-6-5 0 0Q7 6 9-2Q6-7 2-4Q9-13 13-3Q16 9 3 10Q-4 5-12 4Z','M-7 4Q0 1 4 6Q10 8 11 1'],
    snake:['M-8 10Q-14 2-3-2Q8-4 2-8L0-10L8-11L12-7L7-4Q9 3-2 4Q-9 5-5 9Z','M-6 8Q-9 5-3 2Q7 0 6-4M6-8H9'],
    star:['M0-11L3-3L11 0L3 3L0 11L-3 3L-11 0L-3-3Z','M0-6V6M-6 0H6'],
    fault:['M-10-6H-4L-1-2L2-8H8L6-2L10 2L5 8H-2L-5 2H-10Z','M-5-4L0 1L3-5M0 1L4 6'],
    target:['M8 0A8 8 0 1 0-8 0A8 8 0 1 0 8 0','M-12 0H-5M5 0H12M0-12V-5M0 5V12M-2 0H2'],
    card:['M-5-10L7-8L5 10L-7 8Z','M0-5L3 0L0 5L-3 0ZM-3-7H2M-3 7H2'],
    butterfly:['M0-2Q-12-12-10-2Q-8 3-2 3Q-11 4-6 10Q-1 12 0 5Q1 12 6 10Q11 4 2 3Q8 3 10-2Q12-12 0-2Z','M0-4V7M0-3L-3-7M0-3L3-7'],
    wire:['M-10-2H-5L-3-5H3L5-2H10V2H5L3 5H-3L-5 2H-10Z','M-2-2H2V2H-2ZM-8 0H-5M5 0H8'],
    mesh:['M-8-8H8V8H-8Z','M-8-8L8 8M-8 8L8-8M-8 0H8M0-8V8'],
    eye:['M-12 0Q0-12 12 0Q0 12-12 0Z','M5 0A5 5 0 1 0-5 0A5 5 0 1 0 5 0M0-3V3'],
    wing:['M0 5Q-10 4-12-8L-6-3L-5-10L0-2L5-10L6-3L12-8Q10 4 0 5Z','M-7-1L-2 3M7-1L2 3'],
    hex:['M-8-5L0-10L8-5V5L0 10L-8 5Z','M-5-3L0-6L5-3V3L0 6L-5 3Z'],
    kunai:['M0-12L4-2L1 2V7H-1V2L-4-2ZM2 9A2 2 0 1 0-2 9A2 2 0 1 0 2 9','M0-8V0'],
    suppress:['M-2-11H2L5 1L2 5H-2L-5 1Z','M0-7V1M-3 7H3M-2 10H2'],
    bot:['M-6-5L0-8L6-5L8 3L4 7H-4L-8 3Z','M-4 0H4M-4 7L-7 10M4 7L7 10M0-4V-2'],
    sound:['M-2-7H2V7H-2Z','M-5-4Q-8 0-5 4M5-4Q8 0 5 4M-8-7Q-13 0-8 7M8-7Q13 0 8 7'],
    veil:['M-7 10Q-13-6 0-11Q13-6 7 10L2 7L0 11L-2 7Z','M-4-3V3M0-4V4M4-3V3'],
    rocket:['M0-11Q6-8 5 2L9 8L3 6L0 11L-3 6L-9 8L-5 2Q-6-8 0-11Z','M-2-3H2V1H-2ZM-2 5H2'],
    crystal:['M0-12L7-4L4 8L0 12L-5 7L-7-4Z','M0-12V12M-7-4L0 0L7-4M-5 7L0 4L4 8'],
    bird:['M-12-5L-5-2L-2-5L1-7L4-5L8-5L4-2L12-5L8 3L3 4L0 10L-3 4L-8 3Z','M-8-1L-3 2M8-1L3 2M0 1V5'],
    missile:['M0-12L3-7L3 5L7 9L2 8L0 11L-2 8L-7 9L-3 5L-3-7Z','M-2-4H2M-2 3H2'],
    tether:['M-10-7L-5-10L0-4L5-10L10-7L5 0L10 7L5 10L0 4L-5 10L-10 7L-5 0Z','M-4-5L4 5M4-5L-4 5'],
    droplet:['M0-11Q-10 0-7 5Q0 13 7 5Q10 0 0-11Z','M-3-2Q-7 4-1 6'],
    thorn:['M-11 6Q-4 4 0-1L-5-6L2-4L7-10L6-3L11 0L5 2Q0 8-11 6Z','M-6 5Q2 2 6-5'],
    prism:['M0-11L9 6H-9Z','M0-11V3L9 6M0 3L-9 6M0-5L4 3H-4Z'],
    rift:['M-8-10L0-5L-2-1L8 5L4 11L1 5L-8 1L-4-3Z','M-4-7L3-3M0 0L5 5'],
    panel:['M-5-10L5-7L7 4L0 11L-7 4Z','M0-5L4 3H-4ZM-4-7L-5 2M4-5L5 2']
  };
  const getGlyph=motif=>glyphs[motif]||glyphs.star;
  const hiddenMaterials={golden:['#b77d25','#ffe091','#fff7dc'],eclipse:['#32234e','#bd9af6','#f0e8ff'],wukong:['#a66728','#edc477','#fff5cd'],emperorjade:['#427b66','#e6cd85','#f8fff0'],anime_sixpaths:['#161721','#ead49c','#fff6d8'],anime_nika:['#bcb6d6','#f8f5ff','#ffffff'],valorant_spike:['#253d48','#69eddf','#dcfff9']};
  function palette(rod){if(hiddenMaterials[rod.id])return hiddenMaterials[rod.id];const hex=(v,fallback)=>/^#[a-f\d]{6}$/i.test(v||'')?v:fallback;return[hex(rod.color,'#526679'),hex(rod.accent,'#f1dba1'),'#fff9e5'];}
  function strength(phase,age){return phase==='escaped'&&age>=600||phase==='caught'&&age>=2000?0:1;}
  function localPoint(spec,index,time){
    if(spec.id==='anime_sixpaths'){const a=time*spec.speed+index/spec.count*TAU;return{along:.57+Math.sin(a)*.22,side:Math.cos(a)*29,depth:Math.sin(a),drift:0,angle:0};}
    const a=time*spec.speed+index/spec.count*TAU+.37,along=.30+(index+.5)/spec.count*.57+Math.sin(a)*.025;
    return{along,side:Math.cos(a)*spec.radius*(.72+.28*Math.sin(along*Math.PI)),depth:Math.sin(a),drift:Math.sin(a)*spec.pitch*2.4,angle:a*.34+(index%2?-.4:.4)};
  }
  function project(g,q){const center=g.curve(q.along),a=g.curve(clamp(q.along-.008)),b=g.curve(clamp(q.along+.008)),len=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len,scale=clamp(g.width/380,.7,1.65);return{x:center.x+nx*q.side*scale+(b.x-a.x)/len*q.drift,y:center.y+ny*q.side*scale+(b.y-a.y)/len*q.drift,depth:q.depth,angle:Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2+q.angle};}
  function field(rod,time,g,phase='idle',age=0,reduced=false){
    const spec=get(rod?.id);if(!spec||rod.rarity!=='legendary'||!g?.curve)return[];
    const t=reduced?1.25:Math.max(0,time)/1000,alpha=strength(phase,age,reduced),scale=clamp(g.width/380,.7,1.65),out=[];
    if(alpha<=0)return out;
    for(let i=0;i<spec.count;i++){
      const q=localPoint(spec,i,t),p=project(g,q),size=(spec.id==='anime_sixpaths'?5.2:spec.id==='ninephoenix'?7.5:spec.signature?10.6:9.8)*scale*(.90+.10*q.depth),trail=[];
      // Painted bodies need no ten-sample translucent trail reconstruction.
      out.push({...p,size,alpha:1,motif:spec.motif,trail,index:i});
    }if((phase==='reeling'||phase==='bite')&&!spec.signature)return[out.find(p=>p.depth<0),out.find(p=>p.depth>=0)].filter(Boolean);return out;
  }
  function signature(rod,time,g,phase,age,reduced=false){
    const s=get(rod?.id);if(!s?.signature||!g?.curve)return null;
    const t=reduced?1.25:Math.max(0,time)/1000,cycle=t*.38,open=reduced?.5:.5+.5*Math.sin(cycle),center=g.curve(.48),scale=clamp(g.width/380,.7,1.65),power=strength(phase,age,reduced);
    return{kind:s.signature,x:center.x,y:center.y,scale,open,turn:t*.20,alpha:power,phase,age};
  }
  function create(stage){return Orbit?.create(stage,{get,field,signature})||null;}
  function preload(rod,doc){return Orbit?.preload(rod,doc)||Promise.resolve(null);}
  function bobberMarkup(rod){const s=get(rod?.id);if(!s||rod.rarity!=='legendary')return '';return '<svg class="fishing-themed-float fishing-prestige-float'+(rod.id==='ruyi'?' fishing-themed-float--cloud':rod.id.startsWith('anime_')?' fishing-themed-float--anime':'')+'" data-float-theme="'+rod.id+'" data-float-art="painted" viewBox="0 0 48 58" aria-hidden="true"><ellipse cx="24" cy="50" rx="12" ry="2.4" fill="#294c54" opacity=".16"/><image href="'+s.src+'" x="0" y="0" width="48" height="54" preserveAspectRatio="xMidYMid meet"/><path d="M15 52Q24 55 33 52" fill="none" stroke="#fff4d5" stroke-width=".8" opacity=".7"/></svg>';}
  function catalogMarkup(rod,id,curve,theme,liveColor){return Orbit?.catalogMarkup(rod,id,curve,theme,liveColor,{get,field,signature})||'';}
  return Object.freeze({themes,get,getGlyph,field,signature,create,preload,bobberMarkup,catalogMarkup});
});
