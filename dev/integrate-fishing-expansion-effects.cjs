'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),write=(f,s)=>fs.writeFileSync(path.join(root,f),s);
let s=read('skins/tracer/fishing-spell-effects.js');
if(!s.includes('const Expansion='))s=s.replace("  'use strict';","  'use strict';\n  const Expansion=typeof module==='object'&&module.exports?require('./fishing-expansion-effects'):globalThis.TracerFishingExpansionEffects;");
s=s.replace('const spells=Object.freeze({','const spells=Object.freeze(Object.assign({},Expansion?.spells,{').replace("  });\n  const has=id", "  }));\n  const has=id");
if(!s.includes('Expansion?.draw(ctx'))s=s.replace("    if(type==='fire'){",`    if(Expansion?.draw(ctx,id,q,{c,p,a,x,y,radius:r,travel,channel,finish,helpers:{ribbon,samples,ring,gem,light,path,wheel,staff}})){ctx.restore();return q;}
    if(type==='fire'){`);
write('skins/tracer/fishing-spell-effects.js',s);
s=read('skins/tracer/fishing-rod-effects.js');
if(!s.includes('const Expansion='))s=s.replace("  'use strict';","  'use strict';\n  const Expansion=typeof module==='object'&&module.exports?require('./fishing-expansion-effects'):globalThis.TracerFishingExpansionEffects;");
s=s.replace('Object.assign({},Journey?.designs,{','Object.assign({},Expansion?.designs,Journey?.designs,{');
s=s.replace('const SPIRIT_KINDS=Object.freeze({','const SPIRIT_KINDS=Object.freeze(Object.assign({},Expansion?.kinds,{').replace('erlang:28,wukong:29});','erlang:28,wukong:29}));');
if(!s.includes('const advancedArt='))s=s.replace("  const illustrated=id=>", "  const advancedArt=id=>!!Journey?.scenes[id]||!!Expansion?.scenes[id];\n  const illustrated=id=>");
s=s.replace('creature(id)||artifact(id)||!!Journey?.scenes[id]','creature(id)||artifact(id)||advancedArt(id)');
s=s.replace('Object.assign({},Journey?.scenes,{','Object.assign({},Expansion?.scenes,Journey?.scenes,{');
s=s.replaceAll('mythic(id)||Journey?.has(id)','mythic(id)||Journey?.has(id)||Expansion?.has(id)');
s=s.replace('    if(Journey?.has(id))return Journey.pose(id,state);','    if(Expansion?.has(id))return Expansion.pose(id,state);\n    if(Journey?.has(id))return Journey.pose(id,state);');
// Keep advanced portraits away from the line-control area on all viewports.
s=s.replaceAll('Journey?.scenes[id]?.82','advancedArt(id)?.82').replaceAll('Journey?.scenes[id]?250','advancedArt(id)?250').replaceAll('Journey?.scenes[id]?.52','advancedArt(id)?.52').replaceAll('Journey?.scenes[id]?1.18','advancedArt(id)?1.18').replaceAll('if(Journey?.scenes[id])return;','if(advancedArt(id))return;');
s=s.replace("(Journey?.scenes[id]?['cast','caught']", "(advancedArt(id)?['cast','caught']");
s=s.replace('const articulated=Journey?.has(id)||mythic(id)', 'const articulated=Expansion?.has(id)||Journey?.has(id)||mythic(id)');
s=s.replace('!mythic(id)&&!Journey?.has(id)', '!mythic(id)&&!Journey?.has(id)&&!Expansion?.has(id)');
s=s.replace('journey=!!Journey?.scenes[id]','journey=advancedArt(id)');
s=s.replace("const path=FLOAT_GLYPHS[id]||", "const path=Expansion?.glyphs[id]||FLOAT_GLYPHS[id]||");
if(!s.includes('uniform vec4 rig;'))s=s.replace('uniform vec4 choreography;', 'uniform vec4 choreography;uniform vec4 rig;');
if(!s.includes('if(kind>29.5)'))s=s.replace('          if(kind>16.5){',`          if(kind>29.5){
            // Continuous masks preserve faces, armour cores and adjacent seams.
            float side=a.x<.5?-1.:1.,outer=smoothstep(.13,.37,abs(a.x-.5));
            float lower=1.-smoothstep(.42,.70,a.y),shoulder=outer*(1.-smoothstep(.64,.79,a.y));
            if(rig.x<.5){
              local=hinge(local,vec2(side*.16,-.055)*portrait.zw,shoulder*choreography.x*rig.y*.25*side);
              local.x+=lower*sin(a.y*8.-t*rig.z)*portrait.z*.015;
              float plume=smoothstep(.78,.94,a.y)*outer;
              local.x+=plume*sin(a.y*11.-t*rig.z)*portrait.z*.018;
            }else if(rig.x<1.5){
              local=hinge(local,vec2(side*.13,.015)*portrait.zw,outer*sin(t*rig.z)*rig.y*.18*side);
              local.y+=lower*sin(a.x*9.-t)*portrait.w*.009;
            }else if(rig.x<2.5){
              local=hinge(local,vec2(-.12,-.02)*portrait.zw,lower*sin(t*rig.z)*.038);
              local.x+=outer*lower*sin(a.y*8.-t)*portrait.z*.019;
            }else if(rig.x<3.5){
              float rim=1.-smoothstep(.18,.38,distance(a,vec2(.5,.54)));
              local=hinge(local,vec2(0.,-.04)*portrait.zw,rim*sin(t*rig.z)*.058*rig.w);
              local.y+=outer*sin(t*rig.z+a.x*7.)*portrait.w*.005;
            }else if(rig.x<4.5){
              local.x+=outer*sin(a.y*9.-t*rig.z)*portrait.z*.023*rig.y;
              local.y+=outer*lower*sin(a.x*8.+t)*portrait.w*.012;
            }else{
              local=hinge(local,vec2(0.,.24)*portrait.zw,choreography.x*.05*rig.w);
              local.x+=outer*lower*sin(a.y*7.-t*rig.z)*portrait.z*.012;
            }
          }else if(kind>16.5){`);
s=s.replace("'choreography','viewport'","'choreography','rig','viewport'");
if(!s.includes('const rig=Expansion?.rig'))s=s.replace('      const poseMotion=themePose(id,state);gl.uniform1f', '      const rig=Expansion?.rig(id)||[0,0,0,0];gl.uniform4f(uniforms.rig,...rig);\n      const poseMotion=themePose(id,state);gl.uniform1f');
write('skins/tracer/fishing-rod-effects.js',s);
for(const file of ['skins/tracer/index.html','skins/tracer/fishing-desktop.html']){s=read(file);s=s.replace(/<script src="\/fishing-crafted-rods.js"><\/script>\n?/g,'');if(!s.includes('/fishing-expansion-effects.js'))s=s.replace('<script src="/fishing-spell-effects.js"></script>','<script src="/fishing-crafted-rods.js"></script>\n<script src="/fishing-expansion-effects.js"></script>\n<script src="/fishing-spell-effects.js"></script>');write(file,s);}
s=read('dev/desktop-pack-assets.cjs');s=s.replace("['fishing-aquatic-renderer.js'","['fishing-expansion-effects.js','fishing-aquatic-renderer.js'");write('dev/desktop-pack-assets.cjs',s);
console.log('Integrated 32 illustrated apparitions and per-theme spells.');
