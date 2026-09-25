(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TaskGarden = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Edition prices are permanent receipt values, shared by the shop and export UI.
  var POSTCARDS = [
    {id:'pc_field',price:0,name:['原野来信','A letter from the meadow'],colors:['#eee9db','#e0e3cf','#304537','#738269']},
    {id:'pc_forest',price:60,name:['森林纪念','Forest keepsake'],colors:['#20291f','#293424','#eee9d4','#b1b68b']},
    {id:'pc_letter',price:80,name:['复古邮笺','Vintage correspondence'],colors:['#efe1c6','#e3d0ae','#584633','#99714d']},
    {id:'pc_night',price:120,name:['星夜邮局','The midnight post'],colors:['#1e263b','#29334d','#eef0ed','#aebde0']}
  ];
  function postcardInfo(id){return POSTCARDS.find(function(i){return i.id===id;});}
  function postcardLedger(market){return market.postcards||{purchases:[]};}
  function postcardRecord(raw){
    if(!raw||!Array.isArray(raw.purchases)||raw.purchases.length>POSTCARDS.length)fail();
    var seen=new Set();return{purchases:raw.purchases.map(function(p){
      if(!p||!postcardInfo(p.itemId)||postcardInfo(p.itemId).price===0||seen.has(p.itemId)||!time(p.purchasedAt))fail();
      seen.add(p.itemId);return{itemId:p.itemId,purchasedAt:p.purchasedAt};
    })};
  }
  function postcards(ws){var saved=postcardLedger(read(ws).market);return{items:POSTCARDS.map(function(i){return Object.assign(clone(i),{owned:i.price===0||saved.purchases.some(function(p){return p.itemId===i.id;})});})};}
  function buyPostcard(ws,itemId,now){
    var item=postcardInfo(itemId);if(!item)return{ok:false,reason:'unknown-postcard'};
    var g=read(ws),saved=postcardLedger(g.market);
    if(item.price===0||saved.purchases.some(function(p){return p.itemId===itemId;}))return{ok:true,alreadyOwned:true,spent:0};
    if(totals(g).balance<item.price)return{ok:false,reason:'insufficient-coins'};
    saved.purchases.push({itemId:itemId,purchasedAt:timestamp(now)});g.market.postcards=saved;ws.taskGarden=validate(g);return{ok:true,spent:item.price};
  }
  // Version-one receipt prices are immutable; new prices require new item IDs.
  var WALLPAPER_PRICES = {s01:80,s02:80,s03:80,s04:80,s05:100,s06:80,s07:60,s08:60,s09:100,s10:80,d01:180,d02:160,d03:160,d04:160,d05:180,d06:220,d07:160,d08:140,d09:180,d10:200,m01:320,m02:280,m03:240,m04:300,m05:320,m06:300,m07:300,m08:260,m09:360,m10:280,af01:120,af02:180,af03:220,af04:160,af05:240,af06:200,tf01:140,tf02:220,tf03:180,tf04:180,tf05:200,tf06:260};
  var STICKERS = [
    {id:'st_bunny',setId:'garden',price:12,name:['草莓园小兔','Strawberry gardener'],description:['揣着一颗草莓，来陪你慢慢完成。','A strawberry and a little company for your day.']},
    {id:'st_daisy',setId:'garden',price:8,name:['一束小雏菊','A little chamomile'],description:['把一小束晴天，贴在今天的角落。','A small bouquet of sunshine for the corner of your page.']},
    {id:'st_cat',setId:'slow',price:24,name:['书页上的猫','The bookish cat'],description:['读累了，就和小猫一起歇一会儿。','A sleepy reader reminding you to take a breath.']},
    {id:'st_coffee',setId:'slow',price:16,name:['开心果拿铁','Pistachio latte'],description:['留一点热气腾腾的时间给自己。','A warm little moment, just for you.']},
    {id:'st_whale',setId:'stars',price:48,name:['抱月小鲸','Moon-hugging whale'],description:['一页纸，也装得下温柔的宇宙。','A gentle universe, small enough for your page.']},
    {id:'st_planet',setId:'stars',price:32,name:['口袋里的星球','Pocket planet'],description:['下一次灵感，也许就在星星那边。','Your next idea may be written in the stars.']},
    {id:'st_cake',setId:'celebrate',price:28,name:['草莓小庆祝','Strawberry celebration'],description:['再小的进步，也值得认真庆祝。','Even a small step deserves a little celebration.']},
    {id:'st_medal',setId:'celebrate',price:40,name:['给自己的星星','A star for yourself'],description:['今天也做得很好，奖励自己一颗星。','A little star for showing up today.']}
  ];
  // Reviewed paper and glitter collection; prompts and provenance live in sticker-art.
  STICKERS = STICKERS.concat([
    {"id":"st_paper_life_breakfast","setId":"life","material":"paper","price":20,"name":["奶油早餐 · 纸质","Butter breakfast · Paper"],"description":["给清晨加一点甜。","A little sweetness for the morning."]},
    {"id":"st_glitter_life_breakfast","setId":"life","material":"glitter","price":32,"name":["奶油早餐 · 亮片","Butter breakfast · Glitter"],"description":["给清晨加一点甜。","A little sweetness for the morning."]},
    {"id":"st_paper_life_journal","setId":"life","material":"paper","price":20,"name":["手账时光 · 纸质","Journaling hour · Paper"],"description":["把日常写成喜欢的模样。","Keep the little moments on paper."]},
    {"id":"st_glitter_life_journal","setId":"life","material":"glitter","price":32,"name":["手账时光 · 亮片","Journaling hour · Glitter"],"description":["把日常写成喜欢的模样。","Keep the little moments on paper."]},
    {"id":"st_paper_life_plant","setId":"life","material":"paper","price":20,"name":["窗边绿意 · 纸质","Windowsill green · Paper"],"description":["陪一片新叶慢慢长大。","A new leaf, one day at a time."]},
    {"id":"st_glitter_life_plant","setId":"life","material":"glitter","price":32,"name":["窗边绿意 · 亮片","Windowsill green · Glitter"],"description":["陪一片新叶慢慢长大。","A new leaf, one day at a time."]},
    {"id":"st_paper_life_tea","setId":"life","material":"paper","price":20,"name":["柠檬茶歇 · 纸质","Lemon tea break · Paper"],"description":["这一刻，慢慢喝。","Take this moment slowly."]},
    {"id":"st_glitter_life_tea","setId":"life","material":"glitter","price":32,"name":["柠檬茶歇 · 亮片","Lemon tea break · Glitter"],"description":["这一刻，慢慢喝。","Take this moment slowly."]},
    {"id":"st_paper_life_sewing","setId":"life","material":"paper","price":20,"name":["针线小篮 · 纸质","Little sewing basket · Paper"],"description":["把小日子一针针缝好。","Small stitches, happy days."]},
    {"id":"st_glitter_life_sewing","setId":"life","material":"glitter","price":32,"name":["针线小篮 · 亮片","Little sewing basket · Glitter"],"description":["把小日子一针针缝好。","Small stitches, happy days."]},
    {"id":"st_paper_life_rainboots","setId":"life","material":"paper","price":20,"name":["雨后散步 · 纸质","After the rain · Paper"],"description":["雨停了，出去走走。","A little walk after the rain."]},
    {"id":"st_glitter_life_rainboots","setId":"life","material":"glitter","price":32,"name":["雨后散步 · 亮片","After the rain · Glitter"],"description":["雨停了，出去走走。","A little walk after the rain."]},
    {"id":"st_paper_life_vinyl","setId":"life","material":"paper","price":20,"name":["唱片午后 · 纸质","Vinyl afternoon · Paper"],"description":["让喜欢的旋律慢慢转。","Let your favourite record spin."]},
    {"id":"st_glitter_life_vinyl","setId":"life","material":"glitter","price":32,"name":["唱片午后 · 亮片","Vinyl afternoon · Glitter"],"description":["让喜欢的旋律慢慢转。","Let your favourite record spin."]},
    {"id":"st_paper_life_bath","setId":"life","material":"paper","price":20,"name":["泡泡浴时刻 · 纸质","Bubble bath moment · Paper"],"description":["洗掉今天的小疲惫。","A soft landing after a long day."]},
    {"id":"st_glitter_life_bath","setId":"life","material":"glitter","price":32,"name":["泡泡浴时刻 · 亮片","Bubble bath moment · Glitter"],"description":["洗掉今天的小疲惫。","A soft landing after a long day."]},
    {"id":"st_paper_life_chair","setId":"life","material":"paper","price":20,"name":["软软阅读角 · 纸质","Cosy reading chair · Paper"],"description":["坐下来，好好歇一会儿。","Sit down and stay a while."]},
    {"id":"st_glitter_life_chair","setId":"life","material":"glitter","price":32,"name":["软软阅读角 · 亮片","Cosy reading chair · Glitter"],"description":["坐下来，好好歇一会儿。","Sit down and stay a while."]},
    {"id":"st_paper_life_market","setId":"life","material":"paper","price":20,"name":["周末菜篮 · 纸质","Weekend market basket · Paper"],"description":["把新鲜和好心情一起带回家。","Bring home something fresh."]},
    {"id":"st_glitter_life_market","setId":"life","material":"glitter","price":32,"name":["周末菜篮 · 亮片","Weekend market basket · Glitter"],"description":["把新鲜和好心情一起带回家。","Bring home something fresh."]},
    {"id":"st_paper_life_laundry","setId":"life","material":"paper","price":20,"name":["晒好的晴天 · 纸质","Fresh laundry day · Paper"],"description":["干净柔软，像一个晴天。","Fresh, soft and full of sunshine."]},
    {"id":"st_glitter_life_laundry","setId":"life","material":"glitter","price":32,"name":["晒好的晴天 · 亮片","Fresh laundry day · Glitter"],"description":["干净柔软，像一个晴天。","Fresh, soft and full of sunshine."]},
    {"id":"st_paper_life_lamp","setId":"life","material":"paper","price":20,"name":["床头小夜灯 · 纸质","Bedside glow · Paper"],"description":["为晚一点的自己留一盏灯。","A little light at the end of the day."]},
    {"id":"st_glitter_life_lamp","setId":"life","material":"glitter","price":32,"name":["床头小夜灯 · 亮片","Bedside glow · Glitter"],"description":["为晚一点的自己留一盏灯。","A little light at the end of the day."]},
    {"id":"st_paper_pets_corgi","setId":"pets","material":"paper","price":20,"name":["球球小柯基 · 纸质","Corgi and ball · Paper"],"description":["把快乐滚到你身边。","Rolling a little joy your way."]},
    {"id":"st_glitter_pets_corgi","setId":"pets","material":"glitter","price":32,"name":["球球小柯基 · 亮片","Corgi and ball · Glitter"],"description":["把快乐滚到你身边。","Rolling a little joy your way."]},
    {"id":"st_paper_pets_cat","setId":"pets","material":"paper","price":20,"name":["毛线奶牛猫 · 纸质","Tuxedo yarn cat · Paper"],"description":["今天也想和你一起玩。","Always ready for a little play."]},
    {"id":"st_glitter_pets_cat","setId":"pets","material":"glitter","price":32,"name":["毛线奶牛猫 · 亮片","Tuxedo yarn cat · Glitter"],"description":["今天也想和你一起玩。","Always ready for a little play."]},
    {"id":"st_paper_pets_rabbit","setId":"pets","material":"paper","price":20,"name":["胡萝卜小兔 · 纸质","Carrot bunny · Paper"],"description":["藏好胡萝卜，也藏好开心。","A carrot and a little happiness."]},
    {"id":"st_glitter_pets_rabbit","setId":"pets","material":"glitter","price":32,"name":["胡萝卜小兔 · 亮片","Carrot bunny · Glitter"],"description":["藏好胡萝卜，也藏好开心。","A carrot and a little happiness."]},
    {"id":"st_paper_pets_hamster","setId":"pets","material":"paper","price":20,"name":["瓜子小仓鼠 · 纸质","Sunflower hamster · Paper"],"description":["小小一口，大大满足。","A tiny snack, a happy little moment."]},
    {"id":"st_glitter_pets_hamster","setId":"pets","material":"glitter","price":32,"name":["瓜子小仓鼠 · 亮片","Sunflower hamster · Glitter"],"description":["小小一口，大大满足。","A tiny snack, a happy little moment."]},
    {"id":"st_paper_pets_guinea","setId":"pets","material":"paper","price":20,"name":["甜椒豚鼠 · 纸质","Pepper guinea pig · Paper"],"description":["和你分享一口脆甜。","Sharing a crisp little treat."]},
    {"id":"st_glitter_pets_guinea","setId":"pets","material":"glitter","price":32,"name":["甜椒豚鼠 · 亮片","Pepper guinea pig · Glitter"],"description":["和你分享一口脆甜。","Sharing a crisp little treat."]},
    {"id":"st_paper_pets_tortoise","setId":"pets","material":"paper","price":20,"name":["生菜小陆龟 · 纸质","Lettuce tortoise · Paper"],"description":["慢一点，也能到达。","Slow steps still get you there."]},
    {"id":"st_glitter_pets_tortoise","setId":"pets","material":"glitter","price":32,"name":["生菜小陆龟 · 亮片","Lettuce tortoise · Glitter"],"description":["慢一点，也能到达。","Slow steps still get you there."]},
    {"id":"st_paper_pets_budgie","setId":"pets","material":"paper","price":20,"name":["铃铛小虎皮 · 纸质","Budgie and bell · Paper"],"description":["听见一点清脆的陪伴。","A bright little sound of company."]},
    {"id":"st_glitter_pets_budgie","setId":"pets","material":"glitter","price":32,"name":["铃铛小虎皮 · 亮片","Budgie and bell · Glitter"],"description":["听见一点清脆的陪伴。","A bright little sound of company."]},
    {"id":"st_paper_pets_goldfish","setId":"pets","material":"paper","price":20,"name":["水中小金鱼 · 纸质","Little goldfish bowl · Paper"],"description":["把安静的水光留在一角。","A quiet shimmer for your page."]},
    {"id":"st_glitter_pets_goldfish","setId":"pets","material":"glitter","price":32,"name":["水中小金鱼 · 亮片","Little goldfish bowl · Glitter"],"description":["把安静的水光留在一角。","A quiet shimmer for your page."]},
    {"id":"st_paper_pets_chinchilla","setId":"pets","material":"paper","price":20,"name":["抱抱龙猫 · 纸质","Chinchilla cuddle · Paper"],"description":["软乎乎地陪着你。","Soft company, close by."]},
    {"id":"st_glitter_pets_chinchilla","setId":"pets","material":"glitter","price":32,"name":["抱抱龙猫 · 亮片","Chinchilla cuddle · Glitter"],"description":["软乎乎地陪着你。","Soft company, close by."]},
    {"id":"st_paper_pets_ferret","setId":"pets","material":"paper","price":20,"name":["毯子小雪貂 · 纸质","Ferret in a blanket · Paper"],"description":["把安心卷进小毯子里。","A cosy little place to curl up."]},
    {"id":"st_glitter_pets_ferret","setId":"pets","material":"glitter","price":32,"name":["毯子小雪貂 · 亮片","Ferret in a blanket · Glitter"],"description":["把安心卷进小毯子里。","A cosy little place to curl up."]},
    {"id":"st_paper_pets_shiba","setId":"pets","material":"paper","price":20,"name":["领巾小柴犬 · 纸质","Bandana shiba · Paper"],"description":["出门前，先摇摇尾巴。","A happy tail before the day begins."]},
    {"id":"st_glitter_pets_shiba","setId":"pets","material":"glitter","price":32,"name":["领巾小柴犬 · 亮片","Bandana shiba · Glitter"],"description":["出门前，先摇摇尾巴。","A happy tail before the day begins."]},
    {"id":"st_paper_pets_calico","setId":"pets","material":"paper","price":20,"name":["纸盒三花猫 · 纸质","Calico in a box · Paper"],"description":["小纸盒也装得下幸福。","Happiness fits in a little box."]},
    {"id":"st_glitter_pets_calico","setId":"pets","material":"glitter","price":32,"name":["纸盒三花猫 · 亮片","Calico in a box · Glitter"],"description":["小纸盒也装得下幸福。","Happiness fits in a little box."]},
    {"id":"st_paper_travel_camper","setId":"travel","material":"paper","price":20,"name":["海风房车 · 纸质","Seaside camper · Paper"],"description":["把下一站交给海风。","Let the sea breeze choose the next stop."]},
    {"id":"st_glitter_travel_camper","setId":"travel","material":"glitter","price":32,"name":["海风房车 · 亮片","Seaside camper · Glitter"],"description":["把下一站交给海风。","Let the sea breeze choose the next stop."]},
    {"id":"st_paper_travel_camping","setId":"travel","material":"paper","price":20,"name":["山野帐篷 · 纸质","Mountain tent · Paper"],"description":["把一晚安静留给山野。","One quiet night outdoors."]},
    {"id":"st_glitter_travel_camping","setId":"travel","material":"glitter","price":32,"name":["山野帐篷 · 亮片","Mountain tent · Glitter"],"description":["把一晚安静留给山野。","One quiet night outdoors."]},
    {"id":"st_paper_travel_beach","setId":"travel","material":"paper","price":20,"name":["贝壳海岸 · 纸质","Shells from the shore · Paper"],"description":["捡一枚海边的小记忆。","A little memory from the shore."]},
    {"id":"st_glitter_travel_beach","setId":"travel","material":"glitter","price":32,"name":["贝壳海岸 · 亮片","Shells from the shore · Glitter"],"description":["捡一枚海边的小记忆。","A little memory from the shore."]},
    {"id":"st_paper_travel_suitcase","setId":"travel","material":"paper","price":20,"name":["出发小行李 · 纸质","Ready-to-go suitcase · Paper"],"description":["带上喜欢的东西出发。","Pack a few favourites and go."]},
    {"id":"st_glitter_travel_suitcase","setId":"travel","material":"glitter","price":32,"name":["出发小行李 · 亮片","Ready-to-go suitcase · Glitter"],"description":["带上喜欢的东西出发。","Pack a few favourites and go."]},
    {"id":"st_paper_travel_camera","setId":"travel","material":"paper","price":20,"name":["旅行胶片机 · 纸质","Travel film camera · Paper"],"description":["把路上的光收进来。","Keep the light you find along the way."]},
    {"id":"st_glitter_travel_camera","setId":"travel","material":"glitter","price":32,"name":["旅行胶片机 · 亮片","Travel film camera · Glitter"],"description":["把路上的光收进来。","Keep the light you find along the way."]},
    {"id":"st_paper_travel_balloon","setId":"travel","material":"paper","price":20,"name":["热气球远行 · 纸质","Balloon daydream · Paper"],"description":["把心情升到云边。","A little closer to the clouds."]},
    {"id":"st_glitter_travel_balloon","setId":"travel","material":"glitter","price":32,"name":["热气球远行 · 亮片","Balloon daydream · Glitter"],"description":["把心情升到云边。","A little closer to the clouds."]},
    {"id":"st_paper_travel_train","setId":"travel","material":"paper","price":20,"name":["慢慢小火车 · 纸质","Slow little train · Paper"],"description":["沿着窗外的风景慢慢走。","Take the scenic way."]},
    {"id":"st_glitter_travel_train","setId":"travel","material":"glitter","price":32,"name":["慢慢小火车 · 亮片","Slow little train · Glitter"],"description":["沿着窗外的风景慢慢走。","Take the scenic way."]},
    {"id":"st_paper_travel_sailboat","setId":"travel","material":"paper","price":20,"name":["帆船晴日 · 纸质","Sailing day · Paper"],"description":["向着晴朗的地方去。","Set sail for a brighter day."]},
    {"id":"st_glitter_travel_sailboat","setId":"travel","material":"glitter","price":32,"name":["帆船晴日 · 亮片","Sailing day · Glitter"],"description":["向着晴朗的地方去。","Set sail for a brighter day."]},
    {"id":"st_paper_travel_hiking","setId":"travel","material":"paper","price":20,"name":["徒步小背包 · 纸质","Little hiking pack · Paper"],"description":["一步一步，走进新风景。","One step into a new view."]},
    {"id":"st_glitter_travel_hiking","setId":"travel","material":"glitter","price":32,"name":["徒步小背包 · 亮片","Little hiking pack · Glitter"],"description":["一步一步，走进新风景。","One step into a new view."]},
    {"id":"st_paper_travel_cabin","setId":"travel","material":"paper","price":20,"name":["雪山小木屋 · 纸质","Snowy mountain cabin · Paper"],"description":["在雪山脚下歇歇脚。","A little rest beneath the snowy peaks."]},
    {"id":"st_glitter_travel_cabin","setId":"travel","material":"glitter","price":32,"name":["雪山小木屋 · 亮片","Snowy mountain cabin · Glitter"],"description":["在雪山脚下歇歇脚。","A little rest beneath the snowy peaks."]},
    {"id":"st_paper_travel_passport","setId":"travel","material":"paper","price":20,"name":["登机小心情 · 纸质","Ready for takeoff · Paper"],"description":["下一段故事，准备登机。","Your next chapter is ready to board."]},
    {"id":"st_glitter_travel_passport","setId":"travel","material":"glitter","price":32,"name":["登机小心情 · 亮片","Ready for takeoff · Glitter"],"description":["下一段故事，准备登机。","Your next chapter is ready to board."]},
    {"id":"st_paper_travel_scooter","setId":"travel","material":"paper","price":20,"name":["小城轻骑 · 纸质","Old-town scooter · Paper"],"description":["拐个弯，遇见喜欢的小城。","Turn a corner and find a little wonder."]},
    {"id":"st_glitter_travel_scooter","setId":"travel","material":"glitter","price":32,"name":["小城轻骑 · 亮片","Old-town scooter · Glitter"],"description":["拐个弯，遇见喜欢的小城。","Turn a corner and find a little wonder."]}
  ]);
  function stickerInfo(id){return STICKERS.find(function(i){return i.id===id;});}
  function stickerLedger(market){return market.stickers||{purchases:[],placements:[]};}
  function stickerTarget(ws,type,id){return (type==='note'?ws.notes||[]:[]).find(function(row){return row.id===id;});}
  function stickerRecord(raw){
    if(!raw||!Array.isArray(raw.purchases)||raw.purchases.length>STICKERS.length||!Array.isArray(raw.placements)||raw.placements.length>10000)fail();
    var owned=new Set(),ids=new Set();
    var purchases=raw.purchases.map(function(p){if(!p||!stickerInfo(p.itemId)||owned.has(p.itemId)||!time(p.purchasedAt))fail();owned.add(p.itemId);return{itemId:p.itemId,purchasedAt:p.purchasedAt};});
    var placements=raw.placements.map(function(p){
      if(!p||!validId(p.id)||ids.has(p.id)||!owned.has(p.itemId)||!['task','note'].includes(p.targetType)||!validId(p.targetId)||!time(p.updatedAt)||typeof p.visible!=='boolean'||!Number.isFinite(p.x)||p.x<0||p.x>100||!Number.isFinite(p.y)||p.y<0||p.y>100||!Number.isFinite(p.size)||p.size<36||p.size>180||!Number.isFinite(p.rotation)||p.rotation< -180||p.rotation>180)fail();
      ids.add(p.id);return{id:p.id,itemId:p.itemId,targetType:p.targetType,targetId:p.targetId,x:p.x,y:p.y,size:p.size,rotation:p.rotation,visible:p.visible,updatedAt:p.updatedAt};
    });return{purchases:purchases,placements:placements};
  }
  function stickers(ws){var g=read(ws),saved=stickerLedger(g.market),owned=new Set(saved.purchases.map(function(p){return p.itemId;}));return{items:STICKERS.map(function(i){return Object.assign(clone(i),{owned:owned.has(i.id)});}),owned:owned.size,total:STICKERS.length,placements:clone(saved.placements.filter(function(p){return p.visible&&stickerTarget(ws,p.targetType,p.targetId);} ))};}
  function buySticker(ws,itemId,now){
    var item=stickerInfo(itemId);if(!item)return{ok:false,reason:'unknown-sticker'};var g=read(ws),saved=stickerLedger(g.market);
    if(saved.purchases.some(function(p){return p.itemId===itemId;}))return{ok:true,alreadyOwned:true};
    if(totals(g).balance<item.price)return{ok:false,reason:'insufficient-coins'};
    saved.purchases.push({itemId:itemId,purchasedAt:timestamp(now)});g.market.stickers=saved;ws.taskGarden=validate(g);return{ok:true,spent:item.price};
  }
  function layoutSticker(ws,value,now){
    if(!value||!validId(value.id))return{ok:false,reason:'invalid-placement'};
    var g=read(ws),saved=stickerLedger(g.market),old=saved.placements.find(function(p){return p.id===value.id;});
    var row=old?clone(old):{id:value.id,itemId:value.itemId,targetType:value.targetType,targetId:value.targetId,x:72,y:24,size:84,rotation:0,visible:true};
    if(old&&['itemId','targetType','targetId'].some(function(k){return value[k]!==undefined&&value[k]!==old[k];}))return{ok:false,reason:'immutable-placement'};
    if(row.targetType!=='note')return{ok:false,reason:'notes-only'};
    var target=stickerTarget(ws,row.targetType,row.targetId);if(!target)return{ok:false,reason:'target-missing'};
    if(row.targetType==='task'&&(ws.projects||[]).some(function(p){return p.id===target.projectId&&p.status==='completed';}))return{ok:false,reason:'project-archived'};
    if(!saved.purchases.some(function(p){return p.itemId===row.itemId;}))return{ok:false,reason:'not-owned'};
    if(!old&&saved.placements.length>=10000)return{ok:false,reason:'placement-limit'};
    ['x','y','size','rotation','visible'].forEach(function(k){if(value[k]!==undefined)row[k]=value[k];});
    if(row.visible&&(!old||!old.visible)&&saved.placements.filter(function(p){return p.visible&&p.targetType===row.targetType&&p.targetId===row.targetId;}).length>=24)return{ok:false,reason:'page-full'};
    row.updatedAt=Math.max(timestamp(now),...saved.placements.map(function(p){return p.updatedAt+1;}));
    if(old)saved.placements=saved.placements.map(function(p){return p.id===row.id?row:p;});else saved.placements.push(row);
    g.market.stickers=saved;try{g=validate(g);}catch{return{ok:false,reason:'invalid-placement'};}ws.taskGarden=g;return{ok:true,id:row.id};
  }
  function wallpaperLedger(market){return market.wallpapers||{purchases:[],appearance:{backgroundItemId:null,materialItemId:null},updatedAt:0};}
  function wallpaperRecord(raw){
    if(!raw||!Array.isArray(raw.purchases)||raw.purchases.length>Object.keys(WALLPAPER_PRICES).length||!raw.appearance||!(raw.updatedAt===0||time(raw.updatedAt)))fail();
    var seen=new Set(),purchases=raw.purchases.map(function(p){if(!p||!Object.prototype.hasOwnProperty.call(WALLPAPER_PRICES,p.itemId)||!time(p.purchasedAt)||seen.has(p.itemId))fail();seen.add(p.itemId);return{itemId:p.itemId,purchasedAt:p.purchasedAt};});
    var appearance={},slots={backgroundItemId:/^[sd][0-9]{2}$/,materialItemId:/^m[0-9]{2}$/,avatarFrameItemId:/^af[0-9]{2}$/,taskFrameItemId:/^tf[0-9]{2}$/};
    Object.keys(slots).forEach(function(key){var id=raw.appearance[key];if(id===undefined&&(key==='avatarFrameItemId'||key==='taskFrameItemId'))return;if(id!==null&&(!seen.has(id)||!slots[key].test(id)))fail();appearance[key]=id;});
    return{purchases:purchases,appearance:appearance,updatedAt:raw.updatedAt};
  }
  var Collectibles = (function(){
  // Prices are receipt values. Add new editions instead of repricing owned items.
  const sets=[
    {id:'woodland',name:['林间小筑','Woodland nook'],title:['林间收藏家','Woodland collector'],color:'#a8c994'},
    {id:'moonlight',name:['月下花园','Moonlit garden'],title:['月光守望者','Moonlight keeper'],color:'#c5b8eb'},
    {id:'starlight',name:['星河珍藏','Starlight cabinet'],title:['星河收藏家','Starlight collector'],color:'#ecd08c'},
    {id:'reading',name:['午后书房','Afternoon reading'],title:['闲读时光','Quiet reader'],color:'#c6ae88'},
    {id:'greenhouse',name:['玻璃花房','Glasshouse garden'],title:['花房主人','Glasshouse keeper'],color:'#9dcabf'}
  ];
  const items=[
    {id:'birdhouse',setId:'woodland',price:18,harvests:1,species:1,name:['木屋鸟舍','Little birdhouse'],description:['给林间的小访客留一扇窗。','A little window for woodland visitors.']},
    {id:'mushroom_lamp',setId:'woodland',price:60,harvests:4,species:1,name:['蘑菇暖灯','Mushroom lantern'],description:['一盏暖灯，照亮完成任务后的傍晚。','A warm light at the end of a working day.']},
    {id:'tea_table',setId:'woodland',price:100,harvests:8,species:2,name:['花间茶席','Garden tea table'],description:['为自己留一处歇脚的地方。','A place to pause among your flowers.']},
    {id:'moon_lamp',setId:'moonlight',price:140,harvests:12,species:3,name:['弯月灯座','Crescent lantern'],description:['把一弯月亮留在自己的花园。','Keep a crescent moon in your garden.']},
    {id:'moon_fountain',setId:'moonlight',price:220,harvests:18,species:4,name:['月泉','Moonwell'],description:['淡蓝泉水，盛下一小片夜空。','A blue pool holding a piece of the night sky.']},
    {id:'moon_gate',setId:'moonlight',price:320,harvests:24,species:5,name:['银藤月门','Silvervine arch'],description:['银叶环绕的门，见证持续的生长。','Silver leaves framing a season of growth.']},
    {id:'star_scope',setId:'starlight',price:360,harvests:30,species:6,name:['寻星望远镜','Stargazer telescope'],description:['让下一段旅程有更远的方向。','A view toward your next horizon.']},
    {id:'orrery',setId:'starlight',price:480,harvests:40,species:7,name:['微型星仪','Pocket orrery'],description:['把日复一日的努力，连成自己的星系。','Every small effort, part of your constellation.']},
    {id:'crystal_deer',setId:'starlight',price:680,harvests:60,species:9,name:['星晶鹿','Crystal stag'],description:['九种植物的记忆，凝成一位安静的守护者。','A quiet guardian of nine botanical discoveries.']},
    {id:'reading_bench',setId:'reading',price:36,harvests:2,species:1,name:['软垫阅读长椅','Cushioned reading bench'],description:['木纹、针织毯和一本翻开的书，把伙伴安置在身旁。','Oak, a knitted throw and an open book. A quiet corner for your companion.']},
    {id:'book_cabinet',setId:'reading',price:120,harvests:8,species:2,name:['林间藏书柜','Woodland book cabinet'],description:['黄铜把手与暖光书格，把小小花园变成露天书房。','Brass handles and warmly lit shelves for your open-air library.']},
    {id:'wisteria_swing',setId:'reading',price:280,harvests:20,species:4,name:['紫藤秋千','Wisteria swing'],description:['层叠紫藤围着柔软坐垫，留一处不必赶路的角落。','Cascading wisteria and soft cushions, a place to linger.']},
    {id:'flower_cart',setId:'greenhouse',price:80,harvests:5,species:2,name:['花市小推车','Florist cart'],description:['奶油色雨篷下，玫瑰、雏菊与陶盆挤满了春天。','Roses, daisies and terracotta beneath a cream canopy.']},
    {id:'glass_terrarium',setId:'greenhouse',price:200,harvests:15,species:3,name:['黄铜微景花房','Brass fern terrarium'],description:['透亮玻璃里藏着蕨叶和苔藓，近看也有小小惊喜。','A miniature fern forest behind jewel-like glass.']},
    {id:'garden_greenhouse',setId:'greenhouse',price:420,harvests:32,species:6,name:['维多利亚温室','Victorian glasshouse'],description:['铸铁花纹、拱门和层层盆栽，让花园拥有自己的地标。','Ornate ironwork, an arched doorway and shelves of blooms: your garden landmark.']}
  ];
  const find=id=>items.find(item=>item.id===id);
  const ledger=market=>market.collectibles||{purchases:[],equipped:{itemId:null,updatedAt:0},wish:{itemId:null,updatedAt:0}};
  function stats(seeds,at=Infinity){const rows=seeds.filter(s=>s.harvestedAt&&s.harvestedAt<=at);return{harvests:rows.length,species:new Set(rows.map(s=>s.plantKind)).size};}
  const eligible=(item,progress)=>progress.harvests>=item.harvests&&progress.species>=item.species;
  function project(garden,balance){
    const saved=ledger(garden.market),progress=stats(garden.seeds),owned=new Set(saved.purchases.map(p=>p.itemId));
    const placements=layoutRows(garden.market).filter(p=>p.farmId===garden.market.equipped.farmId&&p.visible);
    const rows=items.map(item=>({...clone(item),owned:owned.has(item.id),equipped:placements.some(p=>p.itemId===item.id),wished:saved.wish.itemId===item.id,unlocked:eligible(item,progress),affordable:balance>=item.price}));
    const groups=sets.map(set=>({...clone(set),total:3,owned:items.filter(i=>i.setId===set.id&&owned.has(i.id)).length}));
    const target=rows.find(i=>i.wished&&!i.owned)||rows.find(i=>!i.owned)||null;
    return {layouts:clone(layoutRows(garden.market).filter(p=>p.farmId===garden.market.equipped.farmId)),placements:clone(placements),items:rows,sets:groups,progress,owned:owned.size,total:items.length,equippedId:saved.equipped.itemId,wishId:saved.wish.itemId,target};
  }
  return{items,sets,find,ledger,stats,eligible,project};
  })();
  var KINDS = ['wildflower', 'sunflower', 'lavender', 'apple', 'peach', 'cherry', 'neon_orchid', 'volt_berry', 'crystal_tree'];
  // Market version 1 prices are immutable: saved receipts never change value after a reload.
  var CATALOG = KINDS.map(function (kind, i) {
    return { plantKind: kind, farmId: i < 6 ? 'meadow' : 'cyber', unitPrice: [12, 18, 20, 25, 30, 28, 32, 36, 40][i] };
  });
  var FARMS = [
    { id: 'meadow', price: 0, plantKinds: KINDS.slice(0, 6) },
    { id: 'cyber', price: 240, plantKinds: KINDS.slice(6) }
  ];
  var STATES = ['growing', 'mature', 'destroyed', 'harvested'];
  var MAX_TIME = 8640000000000000;
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function emptyMarket() { return { version: 1, sales: [], purchases: [], equipped: { farmId: 'meadow', updatedAt: 0 } }; }
  function empty() { return { version: 1, seeds: [], planets: [], deletedPlanets: [], market: emptyMarket() }; }
  function plantInfo(kind) { return CATALOG.find(function (p) { return p.plantKind === kind; }); }
  function farmInfo(id) { return FARMS.find(function (f) { return f.id === id; }); }
  function owns(market, id) { return id === 'meadow' || market.purchases.some(function (p) { return p.farmId === id; }); }
  function validId(x) { return typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x); }
  function time(x) { return Number.isSafeInteger(x) && x > 0 && x <= MAX_TIME; }
  function timestamp(x) { return time(x) ? x : Date.now(); }
  function variant(ticket) { return ticket === 0 ? 'shiny' : ticket < 100 ? 'rare' : 'normal'; }
  var PITY_LIMITS = { companion: 30, shiny: 150 };
  // Receipts survive task deletion and stale saves. Derive both streaks from
  // first completions instead of persisting counters that can overwrite each other.
  function pityProgress(garden, award) {
    var companion = 0, shiny = 0;
    garden.seeds.filter(function (s) { return s.completedAt && !s.taskId.startsWith('legacy-'); })
      .sort(function (a, b) { return a.completedAt - b.completedAt || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0); })
      .forEach(function (s) {
        companion++; shiny++;
        // Old completed receipts contribute progress but are never rerolled.
        // Only first completions made under this rule can receive an upgrade.
        if (award && s.pityVersion === 1) {
          if (shiny >= PITY_LIMITS.shiny && s.variant !== 'shiny') s.ticket = 0;
          else if (companion >= PITY_LIMITS.companion && s.variant === 'normal') s.ticket = 1;
          s.variant = variant(s.ticket);
        }
        if (s.variant !== 'normal') companion = 0;
        if (s.variant === 'shiny') shiny = 0;
      });
    return { companion: companion, shiny: shiny,
      companionRemaining: Math.max(1, PITY_LIMITS.companion - companion), shinyRemaining: Math.max(1, PITY_LIMITS.shiny - shiny) };
  }
  function pity(ws) { return pityProgress(read(ws), false); }
  function fail() { throw new Error('Invalid task garden'); }
  function seedRecord(row) {
    if (!row || typeof row.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(row.taskId) || typeof row.title !== 'string' || row.title.length > 100000 ||
        !(row.projectId === null || validId(row.projectId)) || KINDS.indexOf(row.plantKind) < 0 ||
        !Number.isInteger(row.ticket) || row.ticket < 0 || row.ticket >= 10000 ||
        row.variant !== variant(row.ticket) || STATES.indexOf(row.state) < 0 ||
        !time(row.plantedAt) || !time(row.updatedAt) || row.updatedAt < row.plantedAt) fail();
    var farmId = plantInfo(row.plantKind).farmId;
    if (row.farmId !== undefined && row.farmId !== farmId) fail();
    var out = { taskId: row.taskId, title: row.title, projectId: row.projectId, plantKind: row.plantKind, farmId: farmId,
      ticket: row.ticket, variant: row.variant, plantedAt: row.plantedAt, updatedAt: row.updatedAt, state: row.state };
    ['completedAt', 'harvestedAt', 'destroyedAt', 'retiredAt', 'forgottenAt', 'clearedAt'].forEach(function (key) {
      var v = row[key] === undefined ? null : row[key];
      if (v !== null && (!time(v) || v < row.plantedAt)) fail();
      out[key] = v;
    });
    if (row.pityVersion !== undefined) {
      if (row.pityVersion !== 1 || !out.completedAt || row.taskId.startsWith('legacy-')) fail();
      out.pityVersion = 1;
    }
    if (out.state === 'harvested' !== !!out.harvestedAt || out.state === 'mature' && !out.completedAt ||
        out.harvestedAt && (!out.completedAt || out.harvestedAt < out.completedAt) ||
        out.state === 'destroyed' && !out.destroyedAt || out.retiredAt && !['destroyed', 'harvested'].includes(out.state) ||
        out.clearedAt && (!out.completedAt || out.clearedAt < out.completedAt || out.state === 'growing')) fail();
    if (out.forgottenAt) { out.title = ''; out.projectId = null; }
    return out;
  }
  function totals(garden) {
    var seeds = new Map(garden.seeds.map(function (s) { return [s.taskId, s]; }));
    var earned = (garden.market.testCredit?.amount||0)+garden.market.sales.reduce(function (n, sale) { return n + plantInfo(seeds.get(sale.taskId).plantKind).unitPrice; }, 0);
    var spent = garden.market.purchases.reduce(function (n, purchase) { return n + farmInfo(purchase.farmId).price; }, 0) +
      Collectibles.ledger(garden.market).purchases.reduce(function(n,p){return n+Collectibles.find(p.itemId).price;},0)+wallpaperLedger(garden.market).purchases.reduce(function(n,p){return n+WALLPAPER_PRICES[p.itemId];},0)+postcardLedger(garden.market).purchases.reduce(function(n,p){return n+postcardInfo(p.itemId).price;},0)+stickerLedger(garden.market).purchases.reduce(function(n,p){return n+stickerInfo(p.itemId).price;},0);
    return { balance: earned - spent, earned: earned, spent: spent, equippedFarmId: garden.market.equipped.farmId,
      ownedFarmIds: FARMS.filter(function (f) { return owns(garden.market, f.id); }).map(function (f) { return f.id; }) };
  }
  function marketRecord(raw, seeds) {
    if (raw === undefined) return emptyMarket();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
        !Array.isArray(raw.sales) || raw.sales.length > 50000 || !Array.isArray(raw.purchases) || raw.purchases.length >= FARMS.length ||
        !raw.equipped || !farmInfo(raw.equipped.farmId) ||
        !(time(raw.equipped.updatedAt) || raw.equipped.farmId === 'meadow' && raw.equipped.updatedAt === 0)) fail();
    var out = emptyMarket(), seen = new Set(), byId = new Map(seeds.map(function (s) { return [s.taskId, s]; }));
    out.sales = raw.sales.map(function (sale) {
      var seed = sale && byId.get(sale.taskId);
      if (!seed || !seed.harvestedAt || !time(sale.soldAt) || sale.soldAt < seed.harvestedAt || seen.has(sale.taskId)) fail();
      seen.add(sale.taskId); return { taskId: sale.taskId, soldAt: sale.soldAt };
    });
    seen = new Set();
    out.purchases = raw.purchases.map(function (purchase) {
      var farm = purchase && farmInfo(purchase.farmId);
      if (!farm || !farm.price || !time(purchase.purchasedAt) || seen.has(farm.id)) fail();
      seen.add(farm.id); return { farmId: farm.id, purchasedAt: purchase.purchasedAt };
    });
    if(raw.testCredit!==undefined){
      var credit=raw.testCredit;if(!credit||!validId(credit.id)||!Number.isSafeInteger(credit.amount)||credit.amount<0||credit.amount>1000000000||!time(credit.updatedAt))fail();
      out.testCredit={id:credit.id,amount:credit.amount,updatedAt:credit.updatedAt};
    }
    if(raw.collectibles!==undefined)out.collectibles=collectibleRecord(raw.collectibles,seeds,out);
    if(raw.companionLayouts!==undefined){
      if(!Array.isArray(raw.companionLayouts)||raw.companionLayouts.length>FARMS.length)fail();
      var companionFarms=new Set();out.companionLayouts=raw.companionLayouts.map(function(row){
        if(!row||!farmInfo(row.farmId)||!owns(out,row.farmId)||companionFarms.has(row.farmId)||!validLayout(row)||!time(row.updatedAt))fail();
        companionFarms.add(row.farmId);return{farmId:row.farmId,x:row.x,y:row.y,scale:row.scale,flip:row.flip,visible:row.visible,updatedAt:row.updatedAt};
      });
    }
    if(raw.wallpapers!==undefined)out.wallpapers=wallpaperRecord(raw.wallpapers);
    if(raw.stickers!==undefined)out.stickers=stickerRecord(raw.stickers);
    if(raw.postcards!==undefined)out.postcards=postcardRecord(raw.postcards);
    if (!owns(out, raw.equipped.farmId) || totals({ seeds: seeds, market: out }).balance < 0) fail();
    out.equipped = { farmId: raw.equipped.farmId, updatedAt: raw.equipped.updatedAt };
    return out;
  }
  function collectibleRecord(raw,seeds,market){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Array.isArray(raw.purchases)||raw.purchases.length>Collectibles.items.length)fail();
    var seen=new Set(),out={purchases:raw.purchases.map(function(p){
      var item=p&&Collectibles.find(p.itemId);
      if(!item||!time(p.purchasedAt)||seen.has(item.id)||!Collectibles.eligible(item,Collectibles.stats(seeds,p.purchasedAt)))fail();
      seen.add(item.id);return{itemId:item.id,purchasedAt:p.purchasedAt};
    })};
    ['equipped','wish'].forEach(function(key){
      var value=raw[key];
      if(!value||!(value.itemId===null||Collectibles.find(value.itemId))||!(time(value.updatedAt)||value.itemId===null&&value.updatedAt===0)||key==='equipped'&&value.itemId!==null&&!seen.has(value.itemId))fail();
      out[key]={itemId:value.itemId,updatedAt:value.updatedAt};
    });
    if(raw.layouts!==undefined){
      if(!Array.isArray(raw.layouts)||raw.layouts.length>Collectibles.items.length*FARMS.length)fail();
      var keys=new Set();out.layouts=raw.layouts.map(function(row){
        if(!row||!seen.has(row.itemId)||!owns(market,row.farmId)||!farmInfo(row.farmId)||!validLayout(row)||!time(row.updatedAt))fail();
        var key=row.farmId+':'+row.itemId;if(keys.has(key))fail();keys.add(key);
        return{itemId:row.itemId,farmId:row.farmId,x:row.x,y:row.y,scale:row.scale,flip:row.flip,orientation:row.orientation||0,visible:row.visible,updatedAt:row.updatedAt};
      });
    }
    return out;
  }
  function validate(raw) {
    if (raw === undefined || raw === null) return empty();
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
        !Array.isArray(raw.seeds) || raw.seeds.length > 50000 || !Array.isArray(raw.planets) || raw.planets.length > 10000 ||
        !Array.isArray(raw.deletedPlanets) || raw.deletedPlanets.length > 10000) fail();
    var out = empty(), ids = new Set();
    out.seeds = raw.seeds.map(function (row) { var seed = seedRecord(row); if (ids.has(seed.taskId)) fail(); ids.add(seed.taskId); return seed; });
    ids = new Set();
    out.planets = raw.planets.map(function (row) {
      if (!row || !validId(row.id) || row.projectId !== row.id || ids.has(row.id) || typeof row.name !== 'string' ||
          row.name.length > 100000 || !/^#[0-9a-fA-F]{6}$/.test(row.color) || !time(row.completedAt) ||
          !Number.isSafeInteger(row.taskCount) || row.taskCount < 0 || row.taskCount > 50000 ||
          !Array.isArray(row.flowers) || row.flowers.length > 50000) fail();
      ids.add(row.id); var flowerIds = new Set();
      var flowers = row.flowers.map(function (f) {
        var s = seedRecord(f);
        if (s.state !== 'harvested' || s.projectId !== row.projectId || flowerIds.has(s.taskId)) fail();
        flowerIds.add(s.taskId); return s;
      });
      if (flowers.length > row.taskCount) fail();
      return { id: row.id, projectId: row.id, name: row.name, color: row.color, completedAt: row.completedAt, taskCount: row.taskCount, flowers: flowers };
    });
    ids = new Set();
    out.deletedPlanets = raw.deletedPlanets.map(function (r) {
      if (!r || !validId(r.projectId) || !time(r.deletedAt) || ids.has(r.projectId)) fail();
      ids.add(r.projectId); return { projectId: r.projectId, deletedAt: r.deletedAt };
    });
    out.planets = out.planets.filter(function (p) { return !ids.has(p.projectId); });
    out.market = marketRecord(raw.market, out.seeds);
    return out;
  }
  function read(ws) { return validate(ws && ws.taskGarden); }
  function ensure(ws) { var garden = read(ws); ws.taskGarden = garden; return garden; }
  // Rejection sampling avoids modulo bias for both species and the 1 / 10,000 shiny draw.
  function draw(limit) {
    var c = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (!c && typeof require === 'function') c = require('node:crypto').webcrypto;
    if (!c || typeof c.getRandomValues !== 'function') throw new Error('Secure random seeds unavailable');
    var values = new Uint32Array(1), ceiling = 4294967296 - (4294967296 % limit);
    do { c.getRandomValues(values); } while (values[0] >= ceiling);
    return values[0] % limit;
  }
  function find(garden, id) { return garden.seeds.find(function (s) { return s.taskId === id; }); }
  function nextTime(seed, now) { return Math.max(timestamp(now), seed ? seed.updatedAt + 1 : 1); }
  function taskChanged(ws, task, now, random) {
    if (!task) return null;
    var existing = ws.taskGarden && find(ws.taskGarden, task.id);
    if (!existing && !['doing', 'review'].includes(task.status)) return null;
    var wanted = task.status === 'todo' ? 'destroyed' : task.status === 'done' ? 'mature' : 'growing';
    if (existing && (existing.harvestedAt || existing.retiredAt || existing.clearedAt || existing.state === wanted && existing.title === (task.title || '') && existing.projectId === (task.projectId || null))) return existing;
    var garden = ensure(ws), seed = find(garden, task.id);
    var eventAt = timestamp(now || task.updatedAt || task.createdAt);
    if (!seed) {
      var farm = farmInfo(garden.market.equipped.farmId), pool = farm.plantKinds;
      var rand = random || draw, kind = rand(pool.length), ticket = rand(10000);
      if (!Number.isInteger(kind) || kind < 0 || kind >= pool.length || !Number.isInteger(ticket) || ticket < 0 || ticket >= 10000) throw new Error('Invalid seed draw');
      seed = { taskId: task.id, title: task.title || '', projectId: task.projectId || null,
        plantKind: pool[kind], farmId: farm.id, ticket: ticket, variant: variant(ticket), plantedAt: eventAt, updatedAt: eventAt,
        state: 'growing', completedAt: null, harvestedAt: null, destroyedAt: null, retiredAt: null, forgottenAt: null, clearedAt: null };
      garden.seeds.push(seed);
    }
    if (seed.harvestedAt || seed.retiredAt || seed.clearedAt || eventAt < seed.updatedAt) return seed;
    var state = task.status === 'todo' ? 'destroyed' : task.status === 'done' ? 'mature' : 'growing';
    var changed = seed.state !== state || seed.title !== (task.title || '') || seed.projectId !== (task.projectId || null);
    if (changed) {
      seed.updatedAt = Math.max(seed.updatedAt, eventAt);
      seed.state = state; seed.title = task.title || ''; seed.projectId = task.projectId || null;
      if (state === 'destroyed') seed.destroyedAt = eventAt;
      if (state === 'mature' && !seed.completedAt) {
        // Preserve actual completion order even for batch operations in the
        // same millisecond; a later task must not upgrade an earlier reward.
        var lastCompletion = garden.seeds.reduce(function (at, s) { return s.taskId.startsWith('legacy-') ? at : Math.max(at, s.completedAt || 0); }, 0);
        seed.completedAt = Math.max(seed.plantedAt, task.doneAt || eventAt, Math.min(MAX_TIME, lastCompletion + 1));
        seed.pityVersion = 1;
        pityProgress(garden, true);
      }
    }
    return seed;
  }
  function reconcile(ws, now, random) {
    var before = JSON.stringify(ws.taskGarden);
    applyDeletions(ws);
    (ws.tasks || []).forEach(function (task) { taskChanged(ws, task, now, random); });
    return before !== JSON.stringify(ws.taskGarden);
  }
  function active(ws) { return read(ws).seeds.filter(function (s) { return s.state === 'growing' || s.state === 'mature'; }); }
  function harvest(ws, taskId, now) {
    var existing = ws.taskGarden && find(ws.taskGarden, taskId);
    if (!existing || existing.state !== 'mature' && existing.state !== 'harvested') return null;
    var seed = find(ensure(ws), taskId);
    if (!seed.harvestedAt) {
      seed.harvestedAt = Math.max(nextTime(seed, now), seed.completedAt);
      seed.updatedAt = seed.harvestedAt; seed.state = 'harvested';
    }
    return seed;
  }
  function willDestroy(ws, taskId, fields) {
    var seed = ws.taskGarden && find(ws.taskGarden, taskId);
    return !!(seed && (seed.state === 'growing' || seed.state === 'mature') && fields && (fields.delete || fields.status === 'todo'));
  }
  function withdrawal(ws, id, status) { return willDestroy(ws, id, { status: status }); }
  // Removing a completed card leaves its mature flower available for manual harvest.
  // The separate marker prevents stale windows from restoring the task or changing its seed.
  function clearCompletedTask(ws, taskId, now) {
    var task = (ws.tasks || []).find(function (t) { return t.id === taskId; });
    var existing = ws.taskGarden && find(ws.taskGarden, taskId);
    if (!task || task.status !== 'done' || !existing || existing.clearedAt || existing.retiredAt) return false;
    if (!['mature', 'harvested'].includes(existing.state)) return retireTask(ws, taskId, now);
    var seed = find(ensure(ws), taskId), at = Math.max(nextTime(seed, now), seed.completedAt);
    seed.clearedAt = at; seed.updatedAt = at;
    return true;
  }
  function retireTask(ws, taskId, now) {
    var existing = ws.taskGarden && find(ws.taskGarden, taskId);
    if (!existing) return false;
    var seed = find(ensure(ws), taskId), at = nextTime(seed, now);
    if (seed.retiredAt) return false;
    seed.retiredAt = at; seed.updatedAt = at;
    if (!seed.harvestedAt) { seed.state = 'destroyed'; seed.destroyedAt = at; }
    return true;
  }
  function collection(ws) {
    var rows = KINDS.map(function (kind) { return { plantKind: kind, total: 0, normal: 0, rare: 0, shiny: 0, unlocked: false }; });
    read(ws).seeds.forEach(function (seed) { if (seed.harvestedAt) { var row = rows[KINDS.indexOf(seed.plantKind)]; row.total++; row[seed.variant]++; row.unlocked = true; } });
    return rows;
  }
  function inventory(ws) {
    var garden = read(ws), sold = new Set(garden.market.sales.map(function (s) { return s.taskId; }));
    var rows = CATALOG.map(function (p) { return { plantKind: p.plantKind, farmId: p.farmId, unitPrice: p.unitPrice,
      available: 0, harvested: 0, sold: 0, normal: 0, rare: 0, shiny: 0 }; });
    garden.seeds.forEach(function (seed) {
      if (!seed.harvestedAt) return;
      var row = rows[KINDS.indexOf(seed.plantKind)]; row.harvested++;
      if (sold.has(seed.taskId)) row.sold++;
      else { row.available++; row[seed.variant]++; }
    });
    return rows;
  }
  function economy(ws) { return totals(read(ws)); }
  function farms(ws) {
    var market = read(ws).market;
    return FARMS.map(function (f) { return { id: f.id, price: f.price, plantKinds: f.plantKinds.slice(),
      owned: owns(market, f.id), equipped: market.equipped.farmId === f.id }; });
  }
  function sell(ws, plantKind, quantity, now) {
    var info = plantInfo(plantKind);
    if (!info) return { ok: false, reason: 'unknown-plant' };
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 50000) return { ok: false, reason: 'invalid-quantity' };
    var garden = read(ws), sold = new Set(garden.market.sales.map(function (s) { return s.taskId; }));
    var rank = { normal: 0, rare: 1, shiny: 2 };
    var stock = garden.seeds.filter(function (s) { return s.plantKind === plantKind && s.harvestedAt && !sold.has(s.taskId); });
    if (stock.length < quantity) return { ok: false, reason: 'insufficient-stock', available: stock.length };
    stock.sort(function (a, b) { return rank[a.variant] - rank[b.variant] || a.harvestedAt - b.harvestedAt || a.taskId.localeCompare(b.taskId); });
    var at = timestamp(now), selected = stock.slice(0, quantity);
    selected.forEach(function (s) { garden.market.sales.push({ taskId: s.taskId, soldAt: Math.max(at, s.harvestedAt) }); });
    ws.taskGarden = garden;
    return { ok: true, changed: true, plantKind: plantKind, quantity: quantity, earned: quantity * info.unitPrice,
      balance: totals(garden).balance, taskIds: selected.map(function (s) { return s.taskId; }) };
  }
  function buyFarm(ws, farmId, now) {
    var farm = farmInfo(farmId);
    if (!farm) return { ok: false, reason: 'unknown-farm' };
    var garden = read(ws), money = totals(garden);
    if (owns(garden.market, farmId)) return { ok: true, changed: false, alreadyOwned: true, farmId: farmId, spent: 0, balance: money.balance };
    if (money.balance < farm.price) return { ok: false, reason: 'insufficient-coins', balance: money.balance, price: farm.price };
    garden.market.purchases.push({ farmId: farmId, purchasedAt: timestamp(now) });
    ws.taskGarden = garden;
    return { ok: true, changed: true, alreadyOwned: false, farmId: farmId, spent: farm.price, balance: money.balance - farm.price };
  }
  function equipFarm(ws, farmId, now) {
    if (!farmInfo(farmId)) return { ok: false, reason: 'unknown-farm' };
    var garden = read(ws);
    if (!owns(garden.market, farmId)) return { ok: false, reason: 'not-owned' };
    if (garden.market.equipped.farmId === farmId) return { ok: true, changed: false, farmId: farmId };
    garden.market.equipped = { farmId: farmId, updatedAt: Math.max(timestamp(now), garden.market.equipped.updatedAt + 1) };
    ws.taskGarden = garden;
    return { ok: true, changed: true, farmId: farmId };
  }
  function collectibles(ws){var garden=read(ws);return Collectibles.project(garden,totals(garden).balance);}
  function buyCollectible(ws,itemId,now){
    var item=Collectibles.find(itemId);if(!item)return{ok:false,reason:'unknown-collectible'};
    var garden=read(ws),saved=Collectibles.ledger(garden.market),money=totals(garden);
    if(saved.purchases.some(function(p){return p.itemId===itemId;}))return{ok:true,changed:false,alreadyOwned:true};
    if(!Collectibles.eligible(item,Collectibles.stats(garden.seeds)))return{ok:false,reason:'collection-locked'};
    if(money.balance<item.price)return{ok:false,reason:'insufficient-coins'};
    var at=garden.seeds.reduce(function(at,s){return Math.max(at,s.harvestedAt||0);},timestamp(now));
    saved.purchases.push({itemId:itemId,purchasedAt:at});garden.market.collectibles=saved;ws.taskGarden=garden;
    return{ok:true,changed:true,spent:item.price,balance:money.balance-item.price};
  }
  function selectCollectible(ws,itemId,key,now){
    if(itemId!==null&&!Collectibles.find(itemId))return{ok:false,reason:'unknown-collectible'};
    var garden=read(ws),saved=Collectibles.ledger(garden.market);
    if(key==='equipped'&&itemId!==null&&!saved.purchases.some(function(p){return p.itemId===itemId;}))return{ok:false,reason:'not-owned'};
    if(saved[key].itemId===itemId)return{ok:true,changed:false};
    saved[key]={itemId:itemId,updatedAt:Math.max(timestamp(now),saved[key].updatedAt+1)};
    garden.market.collectibles=saved;ws.taskGarden=garden;return{ok:true,changed:true};
  }
  function companionPlacement(ws){
    var garden=read(ws),farmId=garden.market.equipped.farmId;
    return clone((garden.market.companionLayouts||[]).find(function(row){return row.farmId===farmId;})||{farmId:farmId,x:farmId==='cyber'?65.89:66.5,y:farmId==='cyber'?40.82:43.5,scale:1,flip:false,visible:true,updatedAt:0});
  }
  function layoutCompanion(ws,value,now){
    if(!value||typeof value!=='object')return{ok:false,reason:'invalid-layout'};
    var garden=read(ws),farmId=value.farmId||garden.market.equipped.farmId;
    if(!farmInfo(farmId)||!owns(garden.market,farmId))return{ok:false,reason:'not-owned'};
    var rows=garden.market.companionLayouts||[],old=rows.find(function(row){return row.farmId===farmId;}),row=Object.assign({farmId:farmId,x:farmId==='cyber'?65.89:66.5,y:farmId==='cyber'?40.82:43.5,scale:1,flip:false,visible:true},old||{});
    ['x','y','scale','flip','visible'].forEach(function(key){if(value[key]!==undefined)row[key]=value[key];});
    if(!validLayout(row))return{ok:false,reason:'invalid-layout'};
    if(old&&['x','y','scale','flip','visible'].every(function(key){return row[key]===old[key];}))return{ok:true,changed:false};
    row.updatedAt=Math.max(timestamp(now),(old?.updatedAt||0)+1);garden.market.companionLayouts=rows.filter(function(r){return r.farmId!==farmId;}).concat(row);ws.taskGarden=garden;return{ok:true,changed:true};
  }
  function validLayout(row){return Number.isFinite(row.x)&&row.x>=5&&row.x<=95&&Number.isFinite(row.y)&&row.y>=20&&row.y<=90&&Number.isFinite(row.scale)&&row.scale>=.6&&row.scale<=1.8&&typeof row.flip==='boolean'&&typeof row.visible==='boolean'&&(row.orientation===undefined||Number.isInteger(row.orientation)&&row.orientation>=0&&row.orientation<6);}
  function layoutRows(market){
    var saved=Collectibles.ledger(market);
    if(saved.layouts)return saved.layouts;
    return saved.equipped.itemId?[{itemId:saved.equipped.itemId,farmId:market.equipped.farmId,x:19,y:70,scale:1,flip:false,orientation:0,visible:true,updatedAt:saved.equipped.updatedAt}]:[];
  }
  function layoutCollectible(ws,value,now){
    if(!value||!Collectibles.find(value.itemId))return{ok:false,reason:'unknown-collectible'};
    var garden=read(ws),saved=Collectibles.ledger(garden.market),farmId=value.farmId||garden.market.equipped.farmId;
    if(!owns(garden.market,farmId)||!saved.purchases.some(function(p){return p.itemId===value.itemId;}))return{ok:false,reason:'not-owned'};
    var rows=clone(layoutRows(garden.market)),old=rows.find(function(p){return p.itemId===value.itemId&&p.farmId===farmId;});
    var index=Collectibles.items.findIndex(function(i){return i.id===value.itemId;});
    var anchors=[[19,65],[25,58],[72,48],[30,72],[62,75],[48,33],[35,35],[68,55],[55,83],[28,65],[32,38],[48,34],[23,58],[60,75],[55,34]],anchor=anchors[index];
    var row=Object.assign({x:anchor[0],y:anchor[1],scale:1,flip:false,orientation:0,visible:true},old||{});
    ['x','y','scale','flip','visible','orientation'].forEach(function(key){if(value[key]!==undefined)row[key]=value[key];});
    if(!validLayout(row))return{ok:false,reason:'invalid-layout'};
    if(old&&['x','y','scale','flip','visible','orientation'].every(function(key){return row[key]===old[key];}))return{ok:true,changed:false};
    row.itemId=value.itemId;row.farmId=farmId;row.updatedAt=Math.max(timestamp(now),(old?.updatedAt||0)+1,saved.equipped.updatedAt+1);
    saved.layouts=rows.filter(function(p){return p.itemId!==row.itemId||p.farmId!==farmId;}).concat(row);
    saved.equipped={itemId:row.visible?row.itemId:saved.equipped.itemId===row.itemId?null:saved.equipped.itemId,updatedAt:row.updatedAt};
    garden.market.collectibles=saved;ws.taskGarden=garden;return{ok:true,changed:true};
  }
  function equipCollectible(ws,id,now){
    if(id===null){var saved=Collectibles.ledger(read(ws).market);if(!saved.equipped.itemId)return{ok:true,changed:false};id=saved.equipped.itemId;return layoutCollectible(ws,{itemId:id,visible:false},now);}
    return layoutCollectible(ws,{itemId:id,visible:true},now);
  }
  function wishCollectible(ws,id,now){return selectCollectible(ws,id,'wish',now);}
  function archiveProject(ws, projectId, now) {
    var project = (ws.projects || []).find(function (p) { return p.id === projectId; });
    if (!project) return { ok: false, reason: 'not-found' };
    var current = (ws.tasks || []).filter(function (t) { return t.projectId === projectId; });
    if (current.some(function (t) { return t.status !== 'done'; })) return { ok: false, reason: 'unfinished' };
    var prior = read(ws), at = timestamp(now), existing = prior.planets.find(function (p) { return p.projectId === projectId; });
    if (project.status === 'completed') return { ok: true, planet: existing || null, count: existing ? existing.flowers.length : 0 };
    // Task completion and collection use the same receipts, including tasks already cleared from the board.
    prior.seeds.filter(function (s) { return s.projectId === projectId && s.state === 'mature'; }).forEach(function (s) { harvest(ws, s.taskId, at); });
    var garden = ensure(ws), flowers = garden.seeds.filter(function (s) { return s.projectId === projectId && s.harvestedAt; }).map(clone);
    var ids = new Set(current.map(function (t) { return t.id; }));
    var voids = new Set((ws.completionHistory || []).filter(function (h) { return h.kind === 'void'; }).map(function (h) { return h.target; }));
    (ws.completionHistory || []).forEach(function (h) { if (h.kind === 'completed' && h.projectId === projectId && !voids.has(h.id)) ids.add(h.taskId); });
    flowers.forEach(function (s) { ids.add(s.taskId); });
    var planet = { id: projectId, projectId: projectId, name: project.name, color: /^#[0-9a-fA-F]{6}$/.test(project.color) ? project.color : '#7c8fe8',
      completedAt: at, taskCount: ids.size, flowers: flowers };
    project.status = 'completed'; project.completedAt = at; project.updatedAt = at;
    if (!garden.deletedPlanets.some(function (p) { return p.projectId === projectId; })) garden.planets.push(planet);
    return { ok: true, planet: planet, count: flowers.length };
  }
  function removePlanet(ws, projectId, now) {
    if (!ws.taskGarden || !ws.taskGarden.planets.some(function (p) { return p.projectId === projectId; })) return false;
    var garden = ensure(ws);
    if (!garden.planets.some(function (p) { return p.projectId === projectId; })) return false;
    garden.deletedPlanets.push({ projectId: projectId, deletedAt: timestamp(now) });
    garden.planets = garden.planets.filter(function (p) { return p.projectId !== projectId; });
    return true;
  }
  function importLegacy(ws, records) {
    if (!Array.isArray(records)) throw new Error('Invalid legacy garden');
    var garden = read(ws), added = 0;
    records.forEach(function (r) {
      if (!r || !validId(r.projectId) || KINDS.indexOf(r.plantKind) < 0 || !time(r.maturedAt) ||
          !Number.isInteger(r.ticket) || r.ticket < 0 || r.ticket >= 10000 ||
          !(r.harvestedAt === null || time(r.harvestedAt) && r.harvestedAt >= r.maturedAt)) throw new Error('Invalid legacy garden');
      var id = 'legacy-plot-' + r.projectId;
      if (find(garden, id)) return;
      var project = (ws.projects || []).find(function (p) { return p.id === r.projectId; });
      garden.seeds.push({ taskId: id, title: project ? project.name : 'Garden keepsake', projectId: r.projectId,
        plantKind: r.plantKind, farmId: plantInfo(r.plantKind).farmId, ticket: r.ticket, variant: variant(r.ticket), plantedAt: r.maturedAt,
        updatedAt: r.harvestedAt || r.maturedAt, state: r.harvestedAt ? 'harvested' : 'mature', completedAt: r.maturedAt,
        harvestedAt: r.harvestedAt, destroyedAt: null, retiredAt: null, forgottenAt: null, clearedAt: null });
      added++;
    });
    if (added) ws.taskGarden = garden;
    return { changed: added > 0, imported: added };
  }
  function applyDeletions(ws) {
    if (!ws.taskGarden) return ws;
    var projects = new Set((ws.projectDeletions || []).map(function (p) { return p.id; }));
    var deletedTasks = new Set();
    (ws.projectDeletions || []).forEach(function (p) { (p.taskIds || []).forEach(function (id) { deletedTasks.add(id); }); });
    var tasks = new Map((ws.tasks || []).map(function (task) { return [task.id, task]; }));
    var ids = ws.taskGarden.seeds.filter(function (s) { return projects.has(s.projectId) || deletedTasks.has(s.taskId); }).map(function (s) { return s.taskId; });
    ids.forEach(function (id) {
      // A harvested keepsake stays with its original project, but the live task may have moved elsewhere.
      var task = tasks.get(id);
      if (!task || projects.has(task.projectId) || deletedTasks.has(id)) retireTask(ws, id);
      var seed = find(ws.taskGarden, id);
      seed.forgottenAt = seed.forgottenAt || nextTime(seed);
      seed.updatedAt = Math.max(seed.updatedAt, seed.forgottenAt);
      seed.title = ''; seed.projectId = null;
    });
    ws.taskGarden.seeds.forEach(function (seed) { if (seed.forgottenAt) { seed.title = ''; seed.projectId = null; } });
    projects.forEach(function (id) { removePlanet(ws, id); });
    var retired = new Set(ws.taskGarden.seeds.filter(function (s) { return s.retiredAt || s.clearedAt; }).map(function (s) { return s.taskId; }));
    if (retired.size && Array.isArray(ws.tasks)) {
      ws.tasks = ws.tasks.filter(function (task) { return !retired.has(task.id); });
      ws.tasks.forEach(function (task) { if (task.dependsOn) task.dependsOn = task.dependsOn.filter(function (id) { return !retired.has(id); }); });
    }
    return ws;
  }
  function mergeSeed(a, b, authority) {
    if (!a) return clone(b); if (!b) return clone(a);
    var identity = authority || (a.plantedAt < b.plantedAt ? a : b.plantedAt < a.plantedAt ? b : JSON.stringify([a.plantKind, a.ticket]) < JSON.stringify([b.plantKind, b.ticket]) ? a : b);
    var rank = { growing: 0, mature: 1, destroyed: 2, harvested: 3 };
    var current = a.updatedAt > b.updatedAt ? a : b.updatedAt > a.updatedAt ? b : rank[a.state] > rank[b.state] ? a : b;
    var out = clone(current);
    ['plantKind', 'farmId', 'ticket', 'variant', 'plantedAt'].forEach(function (k) { out[k] = identity[k]; });
    var receipts = [a, b].filter(function (s) { return s.harvestedAt; }).sort(function (x, y) { return x.harvestedAt - y.harvestedAt; });
    if (receipts.length) {
      var receipt = authority && authority.harvestedAt ? authority : receipts[0];
      ['title', 'projectId', 'completedAt', 'harvestedAt'].forEach(function (k) { out[k] = receipt[k]; });
      out.state = 'harvested';
    }
    var cleared = [a, b].filter(function (s) { return s.clearedAt; }).sort(function (x, y) { return x.clearedAt - y.clearedAt; });
    out.clearedAt = null;
    if (cleared.length) {
      var kept = authority && authority.clearedAt ? authority : cleared[0];
      out.clearedAt = kept.clearedAt;
      if (!receipts.length) {
        ['title', 'projectId', 'completedAt'].forEach(function (k) { out[k] = kept[k]; });
        out.state = 'mature';
      }
    }
    // Reopening a task or merging a stale growing record must not move its
    // first completion, count it twice, or remove its eligibility for a guarantee.
    out.completedAt = authority && authority.completedAt || Math.min(a.completedAt || Infinity, b.completedAt || Infinity);
    if (out.completedAt === Infinity) out.completedAt = null;
    delete out.pityVersion;
    if (out.completedAt && (authority && authority.completedAt ? authority.pityVersion === 1 : a.pityVersion === 1 || b.pityVersion === 1)) out.pityVersion = 1;
    out.retiredAt = a.retiredAt || b.retiredAt || null;
    out.forgottenAt = a.forgottenAt || b.forgottenAt || null;
    out.destroyedAt = Math.max(a.destroyedAt || 0, b.destroyedAt || 0) || null;
    if (out.retiredAt && !out.harvestedAt) { out.state = 'destroyed'; out.destroyedAt = out.destroyedAt || out.retiredAt; }
    out.updatedAt = Math.max(a.updatedAt, b.updatedAt, out.plantedAt);
    ['completedAt', 'harvestedAt', 'destroyedAt', 'retiredAt', 'forgottenAt', 'clearedAt'].forEach(function (key) { if (out[key]) out[key] = Math.max(out[key], out.plantedAt); });
    if (out.harvestedAt) out.harvestedAt = Math.max(out.harvestedAt, out.completedAt);
    if (out.clearedAt) out.clearedAt = Math.max(out.clearedAt, out.completedAt);
    if (out.forgottenAt) { out.title = ''; out.projectId = null; }
    return out;
  }
  function combineMarket(sources, out, authoritative, recoverSpending) {
    // Test funds are provisioned offline for one workspace. Generic saves may
    // retain server-accepted credit, but cannot create or enlarge it.
    var credits=(authoritative?sources.slice(0,1):sources).map(function(g){return g.market.testCredit;}).filter(Boolean);
    credits.sort(function(a,b){return b.updatedAt-a.updatedAt||b.amount-a.amount;});
    if(credits.length)out.market.testCredit=clone(credits[0]);
    var sales = new Map(), purchases = new Map(), equipped = sources[0].market.equipped;
    sources.forEach(function (g) {
      g.market.sales.forEach(function (s) {
        var old = sales.get(s.taskId);
        if (!old || !authoritative && s.soldAt < old.soldAt) sales.set(s.taskId, clone(s));
      });
      g.market.purchases.forEach(function (p) {
        var old = purchases.get(p.farmId);
        if (!old || !authoritative && p.purchasedAt < old.purchasedAt) purchases.set(p.farmId, clone(p));
      });
      var selected = g.market.equipped;
      if (selected.updatedAt > equipped.updatedAt || selected.updatedAt === equipped.updatedAt && selected.farmId > equipped.farmId) equipped = selected;
    });
    var seeds = new Map(out.seeds.map(function (s) { return [s.taskId, s]; }));
    out.market.sales = Array.from(sales.values()).map(function (s) { s.soldAt = Math.max(s.soldAt, seeds.get(s.taskId).harvestedAt); return s; })
      .sort(function (a, b) { return a.soldAt - b.soldAt || a.taskId.localeCompare(b.taskId); });
    // Farms and collectibles share one wallet. Keep all accepted purchases before
    // considering concurrent spending; a stale save cannot revoke owned objects.
    var collectiblePurchases=new Map(),savedSelection={equipped:Collectibles.ledger(sources[0].market).equipped,wish:Collectibles.ledger(sources[0].market).wish};
    sources.forEach(function(g){
      var saved=Collectibles.ledger(g.market);
      saved.purchases.forEach(function(p){var old=collectiblePurchases.get(p.itemId);if(!old||!authoritative&&p.purchasedAt<old.purchasedAt)collectiblePurchases.set(p.itemId,clone(p));});
      ['equipped','wish'].forEach(function(key){var a=savedSelection[key],b=saved[key];if(b.updatedAt>a.updatedAt||b.updatedAt===a.updatedAt&&String(b.itemId)>String(a.itemId))savedSelection[key]=b;});
    });
    var accepted=new Set(sources[0].market.purchases.map(function(p){return 'farm:'+p.farmId;}).concat(Collectibles.ledger(sources[0].market).purchases.map(function(p){return 'item:'+p.itemId;})));
    var ordered=Array.from(purchases.values()).map(function(p){return{key:'farm:'+p.farmId,price:farmInfo(p.farmId).price,receipt:p};}).concat(Array.from(collectiblePurchases.values()).map(function(p){return{key:'item:'+p.itemId,price:Collectibles.find(p.itemId).price,receipt:p};}));
    var wallpapers=new Map(),appearance=wallpaperLedger(sources[0].market);
    sources.forEach(function(g){var saved=wallpaperLedger(g.market);saved.purchases.forEach(function(p){var old=wallpapers.get(p.itemId);if(!old||!authoritative&&p.purchasedAt<old.purchasedAt)wallpapers.set(p.itemId,clone(p));});if(saved.updatedAt>appearance.updatedAt)appearance=saved;});
    wallpaperLedger(sources[0].market).purchases.forEach(function(p){accepted.add('wallpaper:'+p.itemId);});
    wallpapers.forEach(function(p){ordered.push({key:'wallpaper:'+p.itemId,wallpaper:true,price:WALLPAPER_PRICES[p.itemId],receipt:p});});
    if(sources.some(function(g){return g.market.wallpapers;}))out.market.wallpapers=wallpaperLedger(out.market);
    var stickerPurchases=new Map();sources.forEach(function(g){stickerLedger(g.market).purchases.forEach(function(p){var old=stickerPurchases.get(p.itemId);if(!old||!authoritative&&p.purchasedAt<old.purchasedAt)stickerPurchases.set(p.itemId,clone(p));});});
    stickerLedger(sources[0].market).purchases.forEach(function(p){accepted.add('sticker:'+p.itemId);});
    stickerPurchases.forEach(function(p){ordered.push({key:'sticker:'+p.itemId,sticker:true,price:stickerInfo(p.itemId).price,receipt:p});});
    if(sources.some(function(g){return g.market.stickers;}))out.market.stickers=stickerLedger(out.market);
    var postcardPurchases=new Map();sources.forEach(function(g){postcardLedger(g.market).purchases.forEach(function(p){var old=postcardPurchases.get(p.itemId);if(!old||!authoritative&&p.purchasedAt<old.purchasedAt)postcardPurchases.set(p.itemId,clone(p));});});
    postcardLedger(sources[0].market).purchases.forEach(function(p){accepted.add('postcard:'+p.itemId);});
    postcardPurchases.forEach(function(p){ordered.push({key:'postcard:'+p.itemId,postcard:true,price:postcardInfo(p.itemId).price,receipt:p});});
    if(sources.some(function(g){return g.market.postcards;}))out.market.postcards=postcardLedger(out.market);
    ordered.sort(function(a,b){return Number(accepted.has(b.key))-Number(accepted.has(a.key))||a.receipt.purchasedAt-b.receipt.purchasedAt||a.key.localeCompare(b.key);});
    if(sources.some(function(g){return g.market.collectibles;}))out.market.collectibles=Collectibles.ledger(out.market);
    ordered.forEach(function(entry){
      var p=entry.receipt,item=p.itemId&&Collectibles.find(p.itemId),valid=!item||Collectibles.eligible(item,Collectibles.stats(out.seeds,p.purchasedAt));
      if(valid&&totals(out).balance>=entry.price){if(entry.postcard)out.market.postcards.purchases.push(p);else if(entry.sticker)out.market.stickers.purchases.push(p);else if(entry.wallpaper)out.market.wallpapers.purchases.push(p);else if(item)out.market.collectibles.purchases.push(p);else out.market.purchases.push(p);}
      else if(authoritative&&!recoverSpending)throw Object.assign(new Error('workspace-stale'),{code:'workspace-stale'});
    });
    if(out.market.collectibles){
      var saved=out.market.collectibles;
      saved.wish=clone(savedSelection.wish);
      saved.equipped=clone(savedSelection.equipped.itemId===null||saved.purchases.some(function(p){return p.itemId===savedSelection.equipped.itemId;})?savedSelection.equipped:Collectibles.ledger(sources[0].market).equipped);
    }
    out.market.equipped = clone(owns(out.market, equipped.farmId) ? equipped : sources[0].market.equipped);
    if(out.market.wallpapers){var owned=new Set(out.market.wallpapers.purchases.map(function(p){return p.itemId;}));out.market.wallpapers.updatedAt=appearance.updatedAt;['backgroundItemId','materialItemId','avatarFrameItemId','taskFrameItemId'].forEach(function(k){if(k in appearance.appearance)out.market.wallpapers.appearance[k]=owned.has(appearance.appearance[k])?appearance.appearance[k]:null;});}
    if(out.market.stickers){var stickerRows=new Map(),stickerOwned=new Set(out.market.stickers.purchases.map(function(p){return p.itemId;}));sources.forEach(function(g){stickerLedger(g.market).placements.forEach(function(p){var old=stickerRows.get(p.id);if(old&&['itemId','targetType','targetId'].some(function(k){return old[k]!==p[k];}))return;if(!old||p.updatedAt>old.updatedAt||p.updatedAt===old.updatedAt&&JSON.stringify(p)>JSON.stringify(old))stickerRows.set(p.id,clone(p));});});out.market.stickers.placements=Array.from(stickerRows.values()).filter(function(p){return stickerOwned.has(p.itemId);});}
    if(out.market.collectibles&&sources.some(function(g){return Collectibles.ledger(g.market).layouts;})){
      var layouts=new Map();sources.forEach(function(g){layoutRows(g.market).forEach(function(row){
        var key=row.farmId+':'+row.itemId,old=layouts.get(key);
        if(!old||row.updatedAt>old.updatedAt||row.updatedAt===old.updatedAt&&JSON.stringify(row)>JSON.stringify(old))layouts.set(key,row);
      });});
      out.market.collectibles.layouts=Array.from(layouts.values()).filter(function(row){return owns(out.market,row.farmId)&&out.market.collectibles.purchases.some(function(p){return p.itemId===row.itemId;});}).map(clone);
    }

    if(sources.some(function(g){return g.market.companionLayouts;})){
      var companionRows=new Map();sources.forEach(function(g){(g.market.companionLayouts||[]).forEach(function(row){
        var old=companionRows.get(row.farmId);if(!old||row.updatedAt>old.updatedAt||row.updatedAt===old.updatedAt&&JSON.stringify(row)>JSON.stringify(old))companionRows.set(row.farmId,row);
      });});
      out.market.companionLayouts=Array.from(companionRows.values()).filter(function(row){return owns(out.market,row.farmId);}).map(clone);
    }

  }
  function combine(base, local, remote, authoritative, recoverSpending) {
    var sources = [validate(base), validate(local), validate(remote)], out = empty(), seeds = new Map(), fixed = new Map(sources[0].seeds.map(function (s) { return [s.taskId, s]; }));
    sources.forEach(function (g) { g.seeds.forEach(function (s) { seeds.set(s.taskId, mergeSeed(seeds.get(s.taskId), s, fixed.get(s.taskId))); }); });
    out.seeds = Array.from(seeds.values()).sort(function (a, b) { return a.plantedAt - b.plantedAt || a.taskId.localeCompare(b.taskId); });
    // Reconcile simultaneous completions against the merged ledger, while the
    // accepted seed identity above still prevents client-side random rerolls.
    pityProgress(out, true);
    var deleted = new Map(), planets = new Map(), fixedPlanets = new Set(sources[0].planets.map(function (p) { return p.id; }));
    sources.forEach(function (g) {
      g.deletedPlanets.forEach(function (r) { var old = deleted.get(r.projectId); if (!old || old.deletedAt < r.deletedAt) deleted.set(r.projectId, r); });
      g.planets.forEach(function (p) {
        var old = planets.get(p.id);
        if (!old || !authoritative && !fixedPlanets.has(p.id) && (p.completedAt < old.completedAt || p.completedAt === old.completedAt && JSON.stringify(p) < JSON.stringify(old))) planets.set(p.id, clone(p));
      });
    });
    out.deletedPlanets = Array.from(deleted.values());
    out.planets = Array.from(planets.values()).filter(function (p) { return !deleted.has(p.id); });
    out.planets.forEach(function (planet) {
      planet.flowers = planet.flowers.map(function (flower) {
        var accepted = seeds.get(flower.taskId);
        return accepted ? mergeSeed(flower, accepted, accepted) : flower;
      }).filter(function (flower) { return flower.projectId === planet.projectId; });
    });
    combineMarket(sources, out, authoritative, recoverSpending);
    return validate(out);
  }
  function merge(base, local, remote) { return combine(base, local, remote, false); }
  function equal(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    var ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
    return ak.length === bk.length && ak.every(function (key, i) { return key === bk[i] && equal(a[key], b[key]); });
  }
  function protectArchived(previous, next) {
    var removed = new Set((next.projectDeletions || []).map(function (p) { return p.id; }));
    var archived = new Set((previous && previous.projects || []).filter(function (p) { return p.status === 'completed' && !removed.has(p.id); }).map(function (p) { return p.id; }));
    if (!archived.size) return;
    var before = new Map((previous.tasks || []).map(function (task) { return [task.id, task]; }));
    var after = new Map(next.tasks.map(function (task) { return [task.id, task]; }));
    var stale = Array.from(archived).some(function (id) { return !(next.projects || []).some(function (p) { return p.id === id; }); });
    before.forEach(function (task) { if (archived.has(task.projectId) && !equal(task, after.get(task.id))) stale = true; });
    after.forEach(function (task) { if (archived.has(task.projectId) && !equal(task, before.get(task.id))) stale = true; });
    if (stale) throw Object.assign(new Error('workspace-stale'), { code: 'workspace-stale' });
  }
  // Called inside the serialized server write. Accepted seed identities and harvest receipts cannot be overwritten by stale clients.
  function preserve(previous, next, options) {
    if (!next || !Array.isArray(next.tasks)) return next;
    if (!(options && options.merge)) protectArchived(previous, next);
    if (!(previous && previous.taskGarden) && next.taskGarden === undefined) return next;
    next.taskGarden = combine(previous && previous.taskGarden, next.taskGarden, undefined, true, !!(options && options.merge));
    applyDeletions(next);
    var currentTasks = new Set(next.tasks.map(function (task) { return task.id; }));
    (previous && previous.tasks || []).forEach(function (task) {
      var seed = find(next.taskGarden, task.id);
      if (!currentTasks.has(task.id) && !(seed && seed.clearedAt)) retireTask(next, task.id);
    });
    next.tasks.forEach(function (task) { if (find(next.taskGarden, task.id)) taskChanged(next, task); });
    var known = new Map((previous && previous.projects || []).filter(function (p) { return p.status === 'completed'; }).map(function (p) { return [p.id, p]; }));
    (next.projects || []).forEach(function (p) {
      var completed = known.get(p.id) || next.taskGarden.planets.find(function (planet) { return planet.id === p.id; });
      if (completed) { p.status = 'completed'; p.completedAt = completed.completedAt; }
    });
    return next;
  }
  return { KINDS: KINDS.slice(), CATALOG: clone(CATALOG), FARMS: clone(FARMS), empty: empty, validate: validate, read: read, draw: draw, variant: variant,
    postcards:postcards,buyPostcard:buyPostcard,stickers:stickers,buySticker:buySticker,layoutSticker:layoutSticker,
    companionPlacement:companionPlacement,layoutCompanion:layoutCompanion,layoutCollectible:layoutCollectible,collectibles:collectibles,buyCollectible:buyCollectible,equipCollectible:equipCollectible,wishCollectible:wishCollectible,
    inventory: inventory, economy: economy, farms: farms, sell: sell, buyFarm: buyFarm, equipFarm: equipFarm,
    taskChanged: taskChanged, reconcile: reconcile, active: active, harvest: harvest, willDestroy: willDestroy, withdrawal: withdrawal,
    clearCompletedTask: clearCompletedTask, retireTask: retireTask, collection: collection, pity: pity, archiveProject: archiveProject, removePlanet: removePlanet, importLegacy: importLegacy, applyDeletions: applyDeletions, merge: merge, preserve: preserve };
});
