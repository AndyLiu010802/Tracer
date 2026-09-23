(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./garden-plant-atlas'):root.TracerGardenPlantAtlas);if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenPlantArt=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Atlas){
  'use strict';
  const kinds=['wildflower','sunflower','lavender','apple','peach','cherry','neon_orchid','volt_berry','crystal_tree'];
  const path=(fill,d,extra='')=>`<path fill="${fill}" d="${d}" ${extra}/>`;
  const group=(part,body,origin)=>`<g data-plant-part="${part}" style="transform-origin:${origin};">${body}</g>`;
  const leaf=(flip=false)=>`<g transform="${flip?'translate(160 0) scale(-1 1)':''}">`+
    path('#476c38','M77 124H62v-4H50v-6H42v-8H36V91h14v4h12v6h9v10h6Z')+
    path('#82b957','M72 119H60v-4H48v-7h-6V97h11v5h11v8h8Z')+
    path('#b5d87a','M42 98h10v5h-6v6h-4ZM54 104h7v6h-7Z')+
    path('#638e43','M49 105h5v5h6v4h8v5h-5v-4h-8v-5h-6Z')+'</g>';
  function blossom(kind,stage){
    const palettes={wildflower:['#b8667b','#ef9eb1','#ffd5d4'],sunflower:['#b88738','#edbe4c','#ffe68a'],lavender:['#7463a0','#a58bc8','#d5c3ee']};
    const [dark,mid,light]=palettes[kind];let out='';
    if(stage===3)return path('#477b45','M70 80H62V65h5V53h7v-8h13v8h7v13h5v14H88v7H73Z')+path(dark,'M72 72V57h5V47h8v10h6v16l-9 9Z')+path(mid,'M76 69V56h4V48h4v18h-4v8Z')+path(light,'M77 57h3v10h-3Z');
    if(kind==='lavender'){
      out=path('#679b4b','M77 90V34h6v56Z');
      for(let i=0;i<6;i++){const y=30+i*9,w=i<2?8:12;out+=`<g transform="translate(80 ${y})">`+path(dark,`M-${w} 0h${w*2}v12H-${w}Z`)+path(mid,`M-${w} 0h${w*2-3}v8H-${w}Z`)+path(light,`M-${w-2} 0h5v4h-5Z`)+path('#c7b0e5',`M3 4h${w-2}v4H3Z`)+'</g>';}
      return out;
    }
    const count=kind==='sunflower'?12:8;
    for(let i=0;i<count;i++)out+=`<g transform="translate(80 67) rotate(${i*360/count})">`+path(dark,'M-7-11h14v-6h4v-14H7v-5H-7v5h-4v14h4Z')+path(mid,'M-5-14H6v-6h3v-9H5v-5H-5v5h-3v9h3Z')+path(light,'M-4-29h5v-5h-5ZM-7-27h4v10h-4Z')+'</g>';
    out+=path(kind==='sunflower'?'#78563b':'#b18a45','M68 53h24v5h5v20h-5v5H68v-5h-5V58h5Z')+
      path(kind==='sunflower'?'#b98548':'#eed27a','M69 56h22v5h3v13h-5v6H70v-5h-4V61h3Z')+
      path(kind==='sunflower'?'#ddb56d':'#fff1a8','M71 57h14v4H71v8h-4v-8h4Z');
    if(kind==='sunflower')out+=path('#855d3c','M76 65h3v3h-3ZM86 69h3v3h-3ZM73 73h3v3h-3ZM86 60h3v3h-3Z');
    return out;
  }
  function fruit(kind,x,y){
    const colors={apple:['#9d4942','#e9755e','#ffd29a'],peach:['#c1765a','#f4b392','#ffdcc0'],cherry:['#883c52','#d95776','#ffb3b9']};
    const [dark,mid,light]=colors[kind];
    return `<g transform="translate(${x} ${y})">`+path('#58743b','M-1-10h3v8h-3Z')+path('#9aba62','M2-9h7v3H2Z')+path(dark,'M-6-5H6v3h3V8H5v3H-5V8h-4V-2h3Z')+path(mid,'M-6-3H6v3h1v7H3v2H-4V6h-3V0h1Z')+path(light,'M-5-1h3v5h-3Z')+'</g>';
  }
  function treeCrown(kind,stage){
    let out=path('#3f7144','M45 94H30V83H23V62h8V44h14V30h22V23h27v7h20v12h13v19h10v23h-8v12h-18v8H54v-6h-9Z')+
      path('#70a950','M43 88H31V65h8V47h13V34h23v-6h17v9h20v10h11v18h8v16h-12v12h-16v6H58V91H43Z')+
      path('#97c365','M36 58h7V44h15V35h20v-5h13v11H78v5H60v9H49v13H36Z')+
      path('#bad982','M48 44h11v-7h17v7H61v7H48ZM37 62h7v10h-7Z')+
      path('#568d44','M110 49h12v17h8v16h-13v9H98v7H65v-7H91v-6h18V72h9V59h-8Z')+
      path('#83b558','M63 59h14v-8h19v7h11v14H94v9H73V70H61Z')+
      path('#a2c872','M68 53h11v6H68ZM89 59h10v6H89ZM48 76h9v6h-9Z');
    // Small leaf clusters keep the crown botanical and textured at sprite scale.
    for(const [i,[x,y]]of [[46,49],[58,37],[70,33],[88,35],[101,44],[115,56],[125,70],[113,86],[97,92],[80,95],[60,90],[44,82],[32,69],[49,60],[62,52],[77,58],[94,49],[108,66],[93,77],[77,83],[59,75],[41,72],[68,64],[88,66]].entries()){
      out+=`<g transform="translate(${x} ${y})">`+path(i%3===0?'#c0d888':i%3===1?'#9fc967':'#659f49','M0 0h5v2h3v4H2V4H0Z')+path(i%2?'#507e42':'#85b958','M2 5h6v2H2Z')+'</g>';
    }
    if(stage>=3)for(const [x,y]of [[47,65],[81,45],[113,72],[71,83]])out+=stage===4?fruit(kind,x,y):`<g transform="translate(${x} ${y})">`+path('#efb3bf','M-3-8h6v5h5v6H3v5H-3V3h-5v-6h5Z')+path('#fff1d3','M-2-2h4v4h-4Z')+'</g>';
    return out;
  }
  function pixelMarkup(value,level=0,rare=false){
    const kind=kinds.includes(value)?value:'wildflower',stage=Number.isFinite(level)?Math.max(0,Math.min(4,Math.floor(level))):0,tree=kinds.indexOf(kind)>=3;
    if(stage===0)return `<svg class="garden-home-plant-art garden-pixel-plant garden-seed-art" data-kind="${kind}" data-rare="false" viewBox="0 0 160 176" fill="none" aria-hidden="true"><ellipse cx="80" cy="151" rx="25" ry="5" fill="#493e2b" opacity=".2"/><g data-plant-part="body" style="transform-origin:80px 151px"><path d="M61 140c-8-15 5-32 32-40 1 15 14 26 7 40-7 15-31 15-39 0Z" fill="#805034" stroke="#583f2c" stroke-width="2" stroke-linejoin="round"/><path d="M64 136c-4-13 8-25 26-32-4 14 0 30-17 40-4-1-7-4-9-8Z" fill="#bf8953"/><path d="M68 126c3-8 10-13 18-17-6 8-8 17-14 24-4 2-6-3-4-7Z" fill="#e8bc7f"/><path d="M91 105c-9 21-4 31-18 41" stroke="#f3ce94" stroke-width="2.3" stroke-linecap="round"/><path d="M95 116c7 13 4 23-8 28" stroke="#a96d42" stroke-width="3" stroke-linecap="round"/><path d="m66 140 3 3m26-12 1 3" stroke="#e0ac70" stroke-width="1.5" stroke-linecap="round"/></g></svg>`;
    const shadow='<ellipse cx="80" cy="151" rx="39" ry="8" fill="#375c35" opacity=".15"/>';
    let body='',head='',left='',right='',headOrigin='80px 93px',eyesY=67;
    {
      body=tree&&stage>=2?path('#745537','M74 83h13v61h9v8H64v-6h10Z')+path('#aa7e47','M76 87h6v57h6v4H73v-8h3Z')+path('#d0a062','M76 92h3v29h-3Z'):
        path('#49773b','M77 80h7v64h7v7H67v-6h10Z')+path('#8db854','M79 82h3v62h-3Z');
      if(stage===1){body=path('#507c3d','M78 116h5v33h-5Z');left=leaf();right=leaf(true);head='';}
      else if(tree){head=treeCrown(kind,stage);headOrigin='80px 102px';eyesY=77;}
      else {left=leaf();right=leaf(true);head=stage===2?path('#457740','M76 63h9v6h8v21h-9v8h-9v-9h-9V72h10Z')+path('#93bf64','M77 67h6v7h6v13h-8v6h-5V81h-6v-7h7Z')+path('#c9dd8f','M76 73h4v11h-4Z'):blossom(kind,stage);}
    }
    const face=rare&&stage>0?group('face',path('#3b4d37',`M71 ${eyesY}h4v6h-4ZM85 ${eyesY}h4v6h-4Z`)+path('#fff7cf',`M71 ${eyesY}h2v2h-2ZM85 ${eyesY}h2v2h-2Z`)+path('#c76f7f',`M65 ${eyesY+7}h7v3h-7ZM89 ${eyesY+7}h7v3h-7Z`)+path('#6c5940',`M77 ${eyesY+9}h6v2h-6Z`),'80px '+(eyesY+3)+'px'):'';
    if(rare&&stage===4){head+=face;body+=path('#537c40','M64 143h11v9H60v-5h4ZM86 143h11v4h4v5H86Z');}
    const spark=rare?'<g class="garden-rare-sparkles" fill="#f4d575"><path d="M124 38h3v-5h3v5h4v3h-4v5h-3v-5h-3ZM28 85h3v-4h3v4h4v3h-4v4h-3v-4h-3Z"/></g>':'';
    return `<svg class="garden-home-plant-art garden-pixel-plant" data-kind="${kind}" data-rare="${!!rare}" viewBox="0 0 160 176" fill="none" shape-rendering="crispEdges" aria-hidden="true">${shadow}${group('body',body,'80px 149px')}${group('leaf-left',left,'77px 124px')}${group('leaf-right',right,'83px 124px')}${group('head',head,headOrigin)}${spark}</svg>`;
  }
  function markup(value,level=0,rare=false,shiny=false){
    const kind=kinds.includes(value)?value:'wildflower',stage=Number.isFinite(level)?Math.max(0,Math.min(4,Math.floor(level))):0;
    if(!Atlas?.[kind]||stage===0)return pixelMarkup(stage===0?kind:'wildflower',stage,false);
    const data=Atlas[kind],variant=stage===4&&rare?(shiny?5:4):stage===4?3:stage===1?0:stage===2?1:2,cell=data.cells[variant];
    const height=stage===1?65:stage===2?99:133;
    const scale=Math.min(height/(cell.rootY-cell.y),126/cell.w);
    const x=80+(cell.x-cell.rootX)*scale,y=151+(cell.y-cell.rootY)*scale;
    const face=rare&&stage===4?' data-plant-part="face"':'';
    return `<svg class="garden-home-plant-art garden-pixel-plant garden-illustrated-plant" data-kind="${kind}" data-rare="${!!rare}" data-variant="${variant}" data-art="illustrated-v2" viewBox="0 0 160 176" fill="none" aria-hidden="true"><ellipse cx="80" cy="151" rx="33" ry="6" fill="#27402a" opacity=".18"/><g data-plant-part="illustration" style="transform-origin:80px 151px"><svg x="${x}" y="${y}" width="${cell.w*scale}" height="${cell.h*scale}" viewBox="${cell.x} ${cell.y} ${cell.w} ${cell.h}" overflow="hidden"><image${face} href="/garden-art/${kind}-v2.png" width="${data.width}" height="${data.height}" preserveAspectRatio="none"/></svg></g></svg>`;
  }
  return {kinds,markup,pixelMarkup};
});
