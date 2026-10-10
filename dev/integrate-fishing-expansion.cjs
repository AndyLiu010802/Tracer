'use strict';
const fs=require('node:fs'),path=require('node:path'),{fish,rods}=require('./fishing-expansion-data.cjs');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),write=(f,s)=>fs.writeFileSync(path.join(root,f),s);
function section(s,name,body){const a=s.indexOf('  // BEGIN '+name),b=s.indexOf('  // END '+name);if(a<0||b<0)throw Error(name);return s.slice(0,a)+'  // BEGIN '+name+'\n'+body+'\n'+s.slice(b);}
let s=read('skins/tracer/fishing-aquatic-renderer.js');s=section(s,'AQUATIC STYLES','  const styles='+JSON.stringify(Object.fromEntries(fish.map(f=>[f.id,{body:f.body,anatomy:f.anatomy,marking:f.marking,artVariant:f.artVariant,motion:f.feedingReaction.motion}])))+';');write('skins/tracer/fishing-aquatic-renderer.js',s);
s=read('skins/tracer/fishing-crafted-rods.js');s=section(s,'CRAFTED CATALOG','  const catalog='+JSON.stringify(Object.fromEntries(rods.map(r=>[r.id,{color:r.color,accent:r.accent,rarity:r.rarity,collection:r.collection,craft:r.craft,spell:r.spell,apparition:r.apparition}])))+';');write('skins/tracer/fishing-crafted-rods.js',s);
s=read('skins/tracer/fishing-rod-renderer.js');
if(!s.includes('const Crafted='))s=s.replace("  'use strict';","  'use strict';\n  const Crafted=typeof module==='object'&&module.exports?require('./fishing-crafted-rods'):globalThis.TracerFishingCraftedRods;");
if(!s.includes('const craft=Crafted?.catalog[id]'))s=s.replace("p=PALETTES[id]||PALETTES.bamboo;return", "p=PALETTES[id]||PALETTES.bamboo;const craft=Crafted?.catalog[id];if(craft)return{id,shaft:rgb(craft.color),grip:rgb(craft.craft.grip),wrap:rgb(craft.accent),metal:rgb(craft.craft.metal),trim:rgb(craft.accent),pattern:craft.craft.pattern,advanced:craft.rarity!=='common',craft:craft.craft,rarity:craft.rarity};return");
s=s.replace('common=collectionIndex<3,rare=collectionIndex<7;',"common=p.craft?p.rarity==='common':collectionIndex<3,rare=p.craft?p.rarity==='rare':collectionIndex<7;");
s=s.replace('??(collectionIndex%7)','??(p.craft?p.craft.variant%7:collectionIndex%7)');
if(!s.includes('const crafted=Crafted'))s=s.replace('    if(journeyIndex>=0){',`    if(p.craft){
      const crafted=Crafted.build(p,{g,L,fine,metal,trim,body,ivory,silver,dark,leaf,veins,curve,spine,sleeve,sectionBody,torus,ellipsoid,gem,blade,facet,bolt});
      return finishModel(g,p,crafted);
    }
    if(journeyIndex>=0){`);
s=s.replace('(EXPANSION_IDS.includes(requestedProfile.id)||JOURNEY_IDS.includes(requestedProfile.id))','(requestedProfile.craft||EXPANSION_IDS.includes(requestedProfile.id)||JOURNEY_IDS.includes(requestedProfile.id))');
write('skins/tracer/fishing-rod-renderer.js',s);
s=read('skins/tracer/fishing-art.js');
if(!s.includes('const Aquatic='))s=s.replace("  'use strict';","  'use strict';\n  const Aquatic=typeof module==='object'&&module.exports?require('./fishing-aquatic-renderer'):globalThis.TracerFishingAquatic;");
if(!s.includes('ROD_SPRITES.push'))s=s.replace('  let artSerial=0;', '  ROD_SPRITES.push('+rods.map(r=>JSON.stringify(r.id)).join(',')+');\n  let artSerial=0;');
if(!s.includes('FISH_SPRITES.push'))s=s.replace('  // Catalogue portraits', '  FISH_SPRITES.push('+fish.map(f=>JSON.stringify(f.id)).join(',')+');\n  // Catalogue portraits');
s=s.replace('modelBounds(index,300,500),1500,Math.ceil(ROD_SPRITES.length/5)*500','modelBounds(index,300,500,10),3000,Math.ceil(ROD_SPRITES.length/10)*500');
s=s.replace('function modelBounds(index,width,height){const x=index%5*width,y=Math.floor(index/5)*height;', 'function modelBounds(index,width,height,columns=5){const x=index%columns*width,y=Math.floor(index/columns)*height;');
s=s.replace("function fishProfileKind(id){if(EXPANDED_KINDS[id])", "function fishProfileKind(id){if(Aquatic?.styles[id])return Aquatic.profile(id);if(EXPANDED_KINDS[id])");
if(!s.includes('FISH_DIMENSIONS[id]=Aquatic.dimensions'))s=s.replace('  const EXPANDED_KINDS=', '  if(Aquatic)for(const id of Object.keys(Aquatic.styles))FISH_DIMENSIONS[id]=Aquatic.dimensions(id);\n  const EXPANDED_KINDS=');
if(!s.includes('FEED_PROFILES[id]=({'))s=s.replace("  const DECOR_KINDS=", "  if(Aquatic)for(const [id,s]of Object.entries(Aquatic.styles))FEED_PROFILES[id]=({bottom:'nibble',pulse:'pearlpulse',flutter:'fan',sway:'waltz',leap:'jump',twirl:'spiral'})[s.motion]||s.motion;\n  const DECOR_KINDS=");
if(!s.includes('Aquatic?.drawFish(species'))s=s.replace("      if(['glassoctopus','abysskraken'].includes(species)){", `      if(Aquatic?.drawFish(species,{draw,part,stroke,cached,silk,surface:fishSurface,fin:fishFinMesh,eye,body,tail,median,paired,pelvic,gills,lips,standardEyes,color:c,accent,time,quiet:options.figureOnly||options.reducedMotion||reducedAquarium,mature,feed:e})){
        // Articulated aquatic anatomy is rendered in local fish coordinates.
      }else if(['glassoctopus','abysskraken'].includes(species)){`);
if(!s.includes('Aquatic?.isBenthic(species))return'))s=s.replace("      return{seed,species,profile,e,u,x:Math.cos(a)*r+dx,y,z:Math.sin(a)*r*.86+dz,angle:", "      if(Aquatic?.isBenthic(species))return{seed,species,profile,e,u,x:Math.cos(a*.46)*r+dx,y:-.48+Math.sin(time*.6+i)*.005,z:Math.sin(a*.46)*r*.86+dz,angle:Math.atan2(-Math.cos(a*.46)*.86,-Math.sin(a*.46))+(Aquatic.styles[species].body==='crab'?Math.PI/2:0),roll:0,pitch:0,extraMotion,adultPlay};\n      return{seed,species,profile,e,u,x:Math.cos(a)*r+dx,y,z:Math.sin(a)*r*.86+dz,angle:");
// Look down enough to see carapaces, valves and starfish in the catalogue.
s=s.replace("pitch:0};\n      if(aquarium)","pitch:Aquatic?.isBenthic(species)?.40:0};\n      if(aquarium)");
write('skins/tracer/fishing-art.js',s);
s=read('skins/tracer/fishing-aquarium-motion.js');
if(!s.includes('const Aquatic='))s=s.replace("  'use strict';","  'use strict';\n  const Aquatic=typeof module==='object'&&module.exports?require('./fishing-aquatic-renderer'):globalThis.TracerFishingAquatic;");
if(!s.includes('profiles[id]={'))s=s.replace('  const matureActions=',`  if(Aquatic)for(const [id,s]of Object.entries(Aquatic.styles)){const bottom=Aquatic.isBenthic(id);profiles[id]={body:bottom?1.8:2.8,fin:s.body==='jelly'?2:3.9,tail:bottom?.025:.16,paddle:bottom?.04:.12,wave:bottom?0:.035,wing:0,pitch:0,roll:bottom?.014:.07,travel:bottom?.33:.72,bob:bottom?.004:.042,extent:Aquatic.bounds(id),play:s.motion};}
  const matureActions=`);
s=s.replace("(matureActions[species]||'orbit')","(matureActions[species]||Aquatic?.styles[species]?.motion||'orbit')");
s=s.replace('const desired={x:lane.x+Math.sin(a)*lane.rx,y:lane.y+lift+feed*.075,z:lane.z+Math.cos(a)*lane.rz};','const desired={x:lane.x+Math.sin(a)*lane.rx,y:Aquatic?.isBenthic(species)?tank.bottom+extent[1]+.055:lane.y+lift+feed*.075,z:lane.z+Math.cos(a)*lane.rz};');
write('skins/tracer/fishing-aquarium-motion.js',s);
for(const file of ['skins/tracer/index.html','skins/tracer/fishing-desktop.html','skins/tracer/fishing-aquarium-desktop.html']){s=read(file);if(!s.includes('/fishing-aquatic-renderer.js'))s=s.replace('<script src="/fishing-art.js"></script>','<script src="/fishing-aquatic-renderer.js"></script>\n<script src="/fishing-art.js"></script>');if(file.includes('aquarium')){if(!s.includes('/fishing-aquatic-renderer.js'))s=s.replace('<script src="/fishing-aquarium-motion.js"></script>','<script src="/fishing-aquatic-renderer.js"></script>\n<script src="/fishing-aquarium-motion.js"></script>');}else if(!s.includes('/fishing-crafted-rods.js'))s=s.replace('<script src="/fishing-rod-renderer.js"></script>','<script src="/fishing-crafted-rods.js"></script>\n<script src="/fishing-rod-renderer.js"></script>');write(file,s);}
s=read('dev/build-fishing-catalog-art.cjs');s=s.replace("columns: 5, rows: Math.ceil(catalog.rods.length / 5)","columns: 10, rows: Math.ceil(catalog.rods.length / 10)");
if(!s.includes("  'skins/tracer/fishing-aquatic-renderer.js',"))s=s.replace("  'skins/tracer/fishing-lighting.js',","  'skins/tracer/fishing-lighting.js',\n  'skins/tracer/fishing-aquatic-renderer.js',\n  'skins/tracer/fishing-crafted-rods.js',");
s=s.replace("<script src=\"/fishing-lighting.js\"></script><script src=\"/fishing-art.js\">","<script src=\"/fishing-lighting.js\"></script><script src=\"/fishing-aquatic-renderer.js\"></script><script src=\"/fishing-crafted-rods.js\"></script><script src=\"/fishing-art.js\">");
if(!s.includes("  ['/fishing-aquatic-renderer.js',"))s=s.replace("const routes = new Map([","const routes = new Map([\n  ['/fishing-aquatic-renderer.js', sourceContents.get('skins/tracer/fishing-aquatic-renderer.js')],\n  ['/fishing-crafted-rods.js', sourceContents.get('skins/tracer/fishing-crafted-rods.js')],");
write('dev/build-fishing-catalog-art.cjs',s);
s=read('dev/desktop-pack-assets.cjs');s=s.replace("['fishing-model.js','fishing-lighting.js'","['fishing-aquatic-renderer.js','fishing-crafted-rods.js','fishing-model.js','fishing-lighting.js'");
if(!s.includes('summon-expansion-'))s=s.replace("  assert.ok(sources.size>9", "  for(const r of require('../public/fishing-model').catalog.rods.filter(r=>r.expansion===2&&r.apparition))sources.add('skins/tracer/fishing-art/summon-expansion-'+r.id+'-v1.png');\n  assert.ok(sources.size>9");
write('dev/desktop-pack-assets.cjs',s);
console.log('Integrated aquatic anatomy, crafted rods, motion and atlas layout.');
