'use strict';
const fs=require('node:fs'),path=require('node:path');
const {fish,rods}=require('./fishing-expansion-data.cjs');
const root=path.resolve(__dirname,'..'),modelFile=path.join(root,'public/fishing-model.js');
let src=fs.readFileSync(modelFile,'utf8').replace(/\r\n/g,'\n');
function block(name,body,anchor){const begin='  // BEGIN '+name,end='  // END '+name;const a=src.indexOf(begin),b=src.indexOf(end);if(a>=0){src=src.slice(0,a)+begin+'\n'+body+'\n'+end+src.slice(b+end.length);}else{if(!src.includes(anchor))throw Error('Missing anchor '+anchor);src=src.replace(anchor,begin+'\n'+body+'\n'+end+'\n'+anchor);}}
block('EXPANSION RODS','  RODS.push.apply(RODS,'+JSON.stringify(rods,null,2).split('\n').join('\n  ')+');','  // Pool identities');
const byPool=id=>rods.filter(r=>r.collection===id&&!r.hidden).map(r=>r.id);
block('EXPANSION POOLS',"  "+['basic','myriad','journey'].map(id=>'ROD_POOLS.find(function(p){return p.id===\''+id+'\';}).rodIds.push.apply(ROD_POOLS.find(function(p){return p.id===\''+id+'\';}).rodIds,'+JSON.stringify(byPool(id))+');').join('\n  ')+'\n  ROD_POOLS.push('+JSON.stringify({id:'threekingdoms',name:['三国风云','Three Kingdoms'],volume:4,description:['魏、蜀、吴与群雄的 45 款历史奇幻钓竿；其中包含一款隐藏鱼竿。','45 historical fantasy rods of Wei, Shu, Wu and the rival lords; including one concealed secret design.'],rodIds:byPool('threekingdoms'),hiddenRodId:'emperorjade',odds:{common:.545,hidden:.005,rare:.30,epic:.12,legendary:.03}})+');\n  ROD_POOLS[0].description=["木作、瓷器与灵兽兵器，共 27 款可抽取鱼竿。","27 collectible rods of timber, porcelain and mythical arms."];\n  ROD_POOLS[1].description=["机关、灵兽与自然奇珍，共 30 款鱼竿。","30 rods of mechanisms, creatures and natural wonders."];\n  ROD_POOLS[2].description=["西游行者、妖王与仙家法宝，共 30 款鱼竿。","30 rods of pilgrims, demon kings and celestial artifacts."];','  RODS.forEach(function(r){if(ROD_POOLS.some');
block('EXPANSION FISH','  FISH.push.apply(FISH,'+JSON.stringify(fish,null,2).split('\n').join('\n  ')+');','  var ODD_LEGEND_LORE=');
// Keep original preference ordering. Versioned expedition receipts explicitly
// recompute rules:2 against the original 56 species.
block('EXPANSION BAIT PREFERENCES',`  FISH.filter(function(f){return f.expansion===2;}).forEach(function(f){
    var id=({crab:'crab',hermit:'crab',lobster:'crab',mantis:'crab',shell:'grain',snail:'reedseed',urchin:'squid',starfish:'squid',squid:'squid',shrimp:'shrimp',turtle:'reedseed',axolotl:'insect'})[f.body]||({river:'worm',sea:'shrimp',ice:'frost',deep:'glow',spirit:'spirit',moon:'stardust'})[f.habitat];
    var bait=find(BAITS,id);if(!bait.fishIds.includes(f.id))bait.fishIds.push(f.id);
  });`,'  FISH.slice(28).forEach(function(f){if(!BAITS.some');
// Receipt version 2 stays frozen at its original species and preference set.
src=src.replace('pool=spotFish(env.spotId),weights=',"pool=spotFish(env.spotId).filter(function(f){return env.rules!==2||f.expansion!==2;}),weights=");
src=src.replace("function preferredDepth(f){return f.body===", "function preferredDepth(f){if(f.depth)return f.depth;return f.body===");
src=src.replace('if(c.rules!==2||','if(![2,3].includes(c.rules)||').replace('Object.assign(result,{rules:2,','Object.assign(result,{rules:c.rules,');
src=src.replaceAll('cast.rules===2','cast.rules>=2');
src=src.replace('function castContext(s){return{rules:2,','function castContext(s){return{rules:s.rules,').replace('Object.assign(session,{rules:2,','Object.assign(session,{rules:3,');
src=src.replace('s.tension+pressure*dt/1000','s.tension+pressure*(pressure>0?(rod.tensionMultiplier||1):1)*dt/1000');
// A live legacy cast in a newly loaded client keeps its signed historical seed.
src=src.replace('// Pool identities and reward lists are permanent receipt contracts. Never\n  // derive an old pool from the growing catalog or backfill poolId in old saves.','// Pool identities and existing rewards are permanent receipt contracts.\n  // Additions are explicit; never derive membership or backfill old poolId fields.');
fs.writeFileSync(modelFile,src);fs.writeFileSync(path.join(root,'skins/tracer/fishing-model.js'),src);
fs.writeFileSync(path.join(root,'docs/fishing-expansion-catalog.json'),JSON.stringify({version:2,fish,rods},null,2)+'\n');
console.log('Embedded '+fish.length+' aquatic species and '+rods.length+' rods.');
