'use strict';
// Prompt inventory and resumable asset audit. Image requests are made with the
// built-in image_gen tool; this file never calls a paid API or uses credentials.
const fs=require('node:fs'),path=require('node:path');
const {inspectSheet,inspectPages}=require('./build-garden-companion-atlas.cjs');
const pets=require('../skins/tracer/pet-illustrated-atlas'),garden=require('../skins/tracer/garden-companion-atlas');
const root=path.resolve(__dirname,'..'),art=path.join(root,'skins/tracer');
const {profiles,direction}=require('./companion-action-direction.cjs');
const gestures={
  idle:'ONE soft breath while resting with planted feet. Chest gently expands and relaxes; do not add blinking, head turns or tail flourishes.',
  pet:'ONE gentle cheek nuzzle toward an imagined pat. Incline the cheek slightly, make soft contact, return to rest. No human hand, separate tail wag or extra character.',
  feed:'ONE small nibble of a tiny species-appropriate snack held near the mouth. Slowly bring it close, nibble once and lower the paw to rest. No separate chewing performance.',
  play:'ONE slow nudge of a small rose-pink yarn ball with one front paw. Begin resting beside it, reach slowly, roll it a very short distance and settle that paw. No jump, toss, hug or second game.',
  sleep:'ONE slow sleeping breath. Begin already asleep in a comfortable species-specific resting pose, closed eyes throughout. Chest rises slightly then falls. No lying down or waking up.',
  wake:'ONE slow front-paw stretch while already awake. Extend the paws gently and relax them. Keep hind feet and body center planted. No yawn or standing-up sequence.',
  focus:'ONE tiny attentive head inclination toward a small open book already in place. Gently incline, pause and return to steady attention. No writing or page turn.',
  drag:'ONE small settling of relaxed front paws in a suspended pose. Keep torso center, hind limbs and camera fixed. No kicking, swinging or whole-body motion.',
  fishing:'ONE gentle fishing lift with a tiny rod already cast. Slowly raise the rod tip until one tiny catch clears the water and hold it there. End at rest with catch visible; never release it, cast again or celebrate.',
  exercise:'ONE slow controlled curl of one tiny dumbbell or species-appropriate front-paw stretch. Choose the anatomically appropriate single gesture, raise slowly and lower to rest; no jumps or additional exercise.',
  farming:'ONE gentle pour from a small watering can onto one tiny plant. Tip the can slowly, pour briefly, return it upright. No digging, planting or tool changes.',
  mining:'ONE gentle tap at a small stone with a tiny pick or front paw, whichever fits the anatomy. Approach, tap once, recover and rest. No gem reveal, brushing or celebration.',
  reading:'ONE slow page turn in a small open book. Lift one page with one paw, guide it across, release and rest that paw. The page stays turned. No head tilt or second page.',
  writing:'ONE short continuous mark in a small notebook with a pencil held appropriately. Draw the mark slowly and rest the active paw. No thinking performance or second mark.',
  crafting:'ONE careful placement of a tiny wooden piece into a simple model already present. Align, gently press into position, release and rest. No tools, polishing or inspection sequence.',
  tea:'ONE small sip from a tiny cup. Slowly bring the cup to the mouth using paws appropriate to this species, sip once and lower to rest. No looking around or separate sigh.',
  greet:'ONE gentle wave with one leaf hand. Raise slowly, trace one small arc, lower and rest. No second wave, head turn or dance.',
  walk:'ONE quiet in-place step cycle with small alternating root-foot placements. Torso center and ground stay fixed; no translation, hop or greeting.',
  hop:'ONE soft knee compression and recovery with root feet planted. Compress joints very slightly and straighten gently. No full-body jump or movement of the ground anchor.',
  water:'ONE gentle pour from a tiny watering can toward one small seedling. Tip slowly, pour once and return upright. No digging, sowing or celebrations.',
  music:'ONE quiet leaf-hand conducting arc. Slowly sweep one hand through a small arc and settle. No dance, steps, head shake or notes floating around.',
  celebrate:'ONE gentle raising and lowering of both leaf hands in delight. Feet planted throughout, no jump, confetti or extra pose.',
  rest:'ONE sleeping breath, already seated and asleep. Eyes closed, roots and hands fixed, gentle chest rise and fall. No settling-down or waking-up sequence.',
  breeze:'ONE soft flex and release of the outer petals in a passing breeze. Face, torso and root feet fixed. No extra leaf dance or airborne particles.',
  stretch:'ONE slow upward leaf-hand stretch and release. Keep body volume and feet fixed. No yawn, side bend or hop.',
  look:'ONE small curious glance to the right and return. Eyes lead a minimal head inclination. No left-right scanning or hand gesture.',
  shy:'ONE slow raising of leaf hands toward cheeks and lowering to rest. Keep head, petals and root feet fixed. No peeking sequence or extra bow.',
  eat:'ONE small nibble of a tiny berry biscuit. Bring the biscuit close, nibble once and lower it to rest. No separate chewing or ear motion.',
  thanks:'ONE restrained grateful bow from the head only, gently incline then rise to rest. Hands remain calmly together and root feet stay planted.'
};
function inventory(){
  const items=[];
  for(const [family,atlas]of [['pet',pets],['garden',garden]])for(const [id,variants]of Object.entries(atlas.kinds))for(const [variant,sheets]of Object.entries(variants))for(const action of new Set([...Object.keys(sheets),...(family==='garden'?['play','crafting']:[])])){
    const stem=family==='pet'?`${id}-${action}-v2`:`${id}-${variant}-${action}-v3`;
    const folder=family==='pet'?'pet-art':'garden-art',reference=family==='pet'&&id==='sprout'?'/pet-art/sprout-pet-v1.png':sheets.idle.src;
    items.push({key:`${family}/${id}/${variant}/${action}`,family,id,variant,action,reference:path.join(art,reference.slice(1)),pages:[1,2].map(p=>path.join(art,folder,`${stem}-p${p}.png`))});
  }
  return items.sort((a,b)=>(a.family==='pet'?0:1)-(b.family==='pet'?0:1)||(a.action==='play'?0:1)-(b.action==='play'?0:1));
}
function prompt(item,part){
  return 'Use case: identity-preserve. Production desktop companion animation, TWO pages totaling 32 ORIGINAL DRAWN FRAMES. '+
    `Create page ${part} ONLY, exactly 16 distinct consecutive drawings in a precise 4-column x 4-row equal-square-cell grid, chronological left-to-right then top-to-bottom. TRUE TRANSPARENT RGBA square PNG, no grid lines or text. `+
    'CRITICAL COMPOSITION: draw SMALL complete figures, each including ALL props only in the CENTRAL 55% width and height of its cell. At least 18% clear transparent margin on all four sides of EVERY cell, including outer canvas edges. Completely empty horizontal and vertical gutters. Never fill the canvas with large characters. Feet baseline 80% local cell height, body center 50% local cell width. '+
    `Reference 1 is the exact ${item.variant} ${item.id} identity, anatomy, colors and art style. `+
    (part===2?'Reference 2 is page 1 of this action; continue its LAST cell smoothly with identical body and head size, same props and placement. ':'Use the reference only for identity and art style, not its poses or oversized cell layout. ')+
    (item.family==='pet'?'Preserve detailed intentional cozy pixel-art clusters and crisp edges. ANATOMY: each active paw is the same forelimb that moves from its resting position, never an additional hand. Remove its previous planted pose when it lifts. Keep exactly the reference species limb count, with visible shoulder-to-paw connections; props may not conceal duplicate forelegs. ':'Preserve exquisite soft botanical illustration, petal veins, foliage, fur and face detail. ')+
    (['play','crafting'].includes(item.action)?'CHARACTER INTERESTS (mood only, no extra activities): '+profiles[item.id].interests+' ':'No hobby props or accessories beyond the exact core gesture below. ')+
    'ONE CORE GESTURE: '+(direction(item.id,item.action)||gestures[item.action])+' '+
    (part===1?'This page is global frames 1-16: frames 1-4 quiet starting pose; 5-12 gradual preparation and approach; 13-16 begin the main gesture. END MID-GESTURE, do not complete or reset the action on this page. ':'This page is global frames 17-32: frames 17-24 continue and complete the SAME main gesture; 25-29 recover only the active limb; 30-32 settle. Preserve completed results (turned page, placed object, fish out of water). Never restart page 1 or add another activity. ')+
    'All 32 frames refine the same continuous action with subtle authentic joint changes. One character in one instantaneous anatomical pose per cell. Same head width, torso volume, facial spacing, species and pixel scale in every frame and across both pages. Feet and body center stay fixed. No zoom, resizing to fit props, body shrinking, camera change, pasted sheet fragments, nested grids, overlapping poses, extra limbs, motion blur, ground, shadows, particles or detached decorations. Keep unrelated body parts still. Do not substitute repeats, copies or synthetic warps for new drawings.';
}
function audit(item){return item.pages.map(file=>{if(!fs.existsSync(file))return{file,status:'missing'};try{const sheet=inspectSheet(file);return{file,status:'ready',sha256:sheet.sha256,frames:sheet.frames};}catch(error){return{file,status:'rejected',error:error.message};}});}
function progress(){
  const items=inventory().map(item=>{
    const pages=audit(item);let status=pages.every(page=>page.status==='ready')?'ready':pages.some(page=>page.status==='rejected')?'rejected':'incomplete',error;
    if(status==='ready')try{inspectPages(item.pages,item.pages);}catch(e){status='rejected';error=e.message;}
    return{key:item.key,status,...(error?{error}:{}),pages};
  });
  return{expectedActions:items.length,expectedPages:items.length*2,readyActions:items.filter(i=>i.status==='ready').length,readyPages:items.flatMap(i=>i.pages).filter(p=>p.status==='ready').length,items};
}
if(require.main===module){
  if(process.argv.includes('--summary')||process.argv.includes('--complete')){
    const report=progress(),{items,...counts}=report;console.log(JSON.stringify({...counts,rejected:items.filter(i=>i.status==='rejected')},null,2));
    if(process.argv.includes('--complete')&&report.readyActions!==report.expectedActions)process.exitCode=1;
  }else{const items=inventory();console.log(JSON.stringify(process.argv.includes('--audit')?items.map(item=>({key:item.key,pages:audit(item)})):items.map(item=>({...item,prompts:[prompt(item,1),prompt(item,2)]})),null,2));}
}
module.exports={inventory,prompt,audit,progress};
