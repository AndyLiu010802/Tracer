'use strict';
// Isolated art inspection: the live renderer only, without an app or account.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),catalog=require('../public/fishing-model').catalog;
const ids=process.argv.slice(2).filter(value=>!value.startsWith('--'));
const all=['walnut','porcelain','citrus','amber','vinyl','nautilus','alpine','candlewyrm','thunderdrum','abysswhale','foxfire','lilybell','sandscript','frostwolf','rosevow','inkjudge','butterfly','sunforge','leviathan','eclipse'];
const selected=(ids.length?ids:all).map(id=>{const rod=catalog.rods.find(item=>item.id===id);assert(rod,'Known rod '+id);return rod;});
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});const output=fs.mkdtempSync(path.join(root,'.cache/rod-expansion-'));
const scripts=['fishing-lighting.js','fishing-rod-renderer.js'];
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname;if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>Rod art review</title>'+scripts.map(file=>'<script src="/'+file+'"></script>').join(''));}else if(scripts.includes(pathname.slice(1))){res.setHeader('Content-Type','application/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(root,'skins/tracer',pathname.slice(1))));}else{res.statusCode=404;res.end();}});
(async()=>{
  let browser;const errors=[];
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({channel:process.env.TRACER_QA_BROWSER||'chromium',headless:true});
    const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(window.__rodQaNoGl&&/webgl/.test(type))return null;return native.call(this,type,...args);};
      const resources=window.__rodQaResources={};for(const [create,remove]of [['createBuffer','deleteBuffer'],['createTexture','deleteTexture'],['createFramebuffer','deleteFramebuffer'],['createRenderbuffer','deleteRenderbuffer'],['createProgram','deleteProgram'],['createShader','deleteShader']]){
        const live=new Set();resources[create]=live;for(const proto of [WebGLRenderingContext.prototype]){const make=proto[create],destroy=proto[remove];proto[create]=function(...args){const result=make.apply(this,args);if(result)live.add(result);return result;};proto[remove]=function(value){live.delete(value);return destroy.call(this,value);};}
      }
    });
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
    const report=await page.evaluate(rods=>{
      const R=TracerFishingRodRenderer,records=[],images={};
      function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return {canvas:c,ctx:c.getContext('2d',{willReadFrequently:true})};}
      function box(c){const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=-1,b=-1,count=0,edge=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(data[(y*c.width+x)*4+3]<3)continue;l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);count++;if(x<2||y<2||x>=c.width-2||y>=c.height-2)edge++;}if(count<100||edge)throw Error('Incomplete or clipped rod');return {left:l,top:t,width:r-l+1,height:b-t+1,count,edge};}
      function snapshot(host){const source=host.querySelector('canvas'),copy=canvas(source.width,source.height);copy.ctx.drawImage(source,0,0);return copy.canvas;}
      function fit(source,w,h,background){const result=canvas(w,h),bounds=box(source);if(background){result.ctx.fillStyle=background;result.ctx.fillRect(0,0,w,h);}const ratio=Math.min((w-28)/bounds.width,(h-28)/bounds.height);result.ctx.drawImage(source,bounds.left,bounds.top,bounds.width,bounds.height,(w-bounds.width*ratio)/2,(h-bounds.height*ratio)/2,bounds.width*ratio,bounds.height*ratio);return result.canvas;}
      const host=document.createElement('div');host.style.cssText='position:absolute;left:0;top:0;width:501.6px;height:836px';document.body.appendChild(host);
      const renderer=R.create(host,{rod:rods[0]});if(renderer.kind!=='webgl')throw Error('The model preview must use its real WebGL renderer');
      const columns=Math.min(4,rods.length),cellW=300,cellH=570,sheet=canvas(columns*cellW,Math.ceil(rods.length/columns)*cellH);
      sheet.ctx.fillStyle='#101c22';sheet.ctx.fillRect(0,0,sheet.canvas.width,sheet.canvas.height);
      const publicRods=rods.filter(rod=>!rod.hidden),publicColumns=Math.min(4,publicRods.length)||1,publicSheet=canvas(publicColumns*cellW,Math.max(1,Math.ceil(publicRods.length/publicColumns))*cellH);publicSheet.ctx.fillStyle='#101c22';publicSheet.ctx.fillRect(0,0,publicSheet.canvas.width,publicSheet.canvas.height);
      for(const [index,rod]of rods.entries()){
        renderer.update({rod,bend:0});const source=snapshot(host),bounds=box(source),full=fit(source,700,1100,'#17272d');images[rod.id+'-full.png']=full.toDataURL('image/png').split(',')[1];
        const x=index%columns*cellW,y=Math.floor(index/columns)*cellH;
        const card=fit(source,cellW-12,cellH-85,'#17272d');sheet.ctx.drawImage(card,x+6,y+6);
        sheet.ctx.fillStyle='#e8e3d2';sheet.ctx.font='600 20px "Microsoft YaHei",sans-serif';sheet.ctx.fillText(rod.name[0],x+20,y+cellH-58);sheet.ctx.fillStyle='#9bacb0';sheet.ctx.font='13px sans-serif';sheet.ctx.fillText(rod.id+' · '+rod.rarity,x+20,y+cellH-34);
        if(!rod.hidden){const publicIndex=publicRods.findIndex(item=>item.id===rod.id),px=publicIndex%publicColumns*cellW,py=Math.floor(publicIndex/publicColumns)*cellH;publicSheet.ctx.drawImage(sheet.canvas,x,y,cellW,cellH,px,py,cellW,cellH);}
        const detail=canvas(850,800),dpr=source.width/((250.8+256)*2),scale=2*dpr,vertices=R.buildMesh(rod).vertices;let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
        for(let i=0;i<vertices.length;i+=14){if(vertices[i]>.55)continue;const p=R.deformed([vertices[i],vertices[i+1],vertices[i+2]],0);l=Math.min(l,(p.x+128)*scale);r=Math.max(r,(p.x+128)*scale);t=Math.min(t,(p.y+128)*scale);b=Math.max(b,(p.y+128)*scale);}
        detail.ctx.fillStyle='#d8d5c8';detail.ctx.fillRect(0,0,850,800);const dw=r-l+16,dh=b-t+16,k=Math.min(820/dw,770/dh);detail.ctx.drawImage(source,l-8,t-8,dw,dh,(850-dw*k)/2,(800-dh*k)/2,dw*k,dh*k);images[rod.id+'-detail.png']=detail.canvas.toDataURL('image/png').split(',')[1];
        renderer.update({bend:.21});const bent=snapshot(host),bentBounds=box(bent);images[rod.id+'-bend.png']=fit(bent,700,1100,'#17272d').toDataURL('image/png').split(',')[1];
        const mesh=R.buildMesh(rod),fallback=R.buildMesh(rod,true);records.push({id:rod.id,triangles:mesh.triangles,fallbackTriangles:fallback.triangles,transparentVertices:mesh.vertices.length/14-(mesh.opaqueVertices??mesh.vertices.length/14),bounds,bentBounds,design:mesh.design});
      }
      const resources=()=>Object.fromEntries(Object.entries(window.__rodQaResources).map(([key,value])=>[key,value.size]));
      const beforeDestroy=resources();renderer.destroy();if(host.children.length)throw Error('Renderer nodes leaked after destroy');const afterDestroy=resources();if(Object.values(afterDestroy).some(Boolean))throw Error('WebGL resources leaked after destroy');
      // Exercise an actual software render, not only its geometry builder.
      window.__rodQaNoGl=true;const fallback=R.create(host,{rod:rods[0]});if(fallback.kind!=='canvas2d')throw Error('Expected the no-WebGL renderer');
      const fallbackSheet=canvas(columns*cellW,Math.ceil(rods.length/columns)*cellH);fallbackSheet.ctx.fillStyle='#101c22';fallbackSheet.ctx.fillRect(0,0,fallbackSheet.canvas.width,fallbackSheet.canvas.height);
      for(const [index,rod]of rods.entries()){
        fallback.update({rod,bend:0});const source=snapshot(host),bounds=box(source);images[rod.id+'-fallback.png']=fit(source,700,1100,'#17272d').toDataURL('image/png').split(',')[1];
        const x=index%columns*cellW,y=Math.floor(index/columns)*cellH;fallbackSheet.ctx.drawImage(fit(source,cellW-12,cellH-85,'#17272d'),x+6,y+6);fallbackSheet.ctx.fillStyle='#e8e3d2';fallbackSheet.ctx.font='600 20px "Microsoft YaHei",sans-serif';fallbackSheet.ctx.fillText(rod.name[0],x+20,y+cellH-58);
        fallback.update({bend:-.24});const bentBounds=box(snapshot(host));records[index].fallback={bounds,bentBounds,tip:fallback.getTip()};
      }
      fallback.destroy();if(host.children.length)throw Error('Software renderer nodes leaked');window.__rodQaNoGl=false;
      // Recovery from a driver loss must also dispose the shadow framebuffer.
      const recovery=R.create(host,{rod:rods[rods.length-1]}),lost=new Event('webglcontextlost',{cancelable:true});host.querySelector('canvas').dispatchEvent(lost);if(!lost.defaultPrevented||recovery.kind!=='canvas2d')throw Error('Context loss did not recover');recovery.update({bend:.17});box(snapshot(host));recovery.destroy();if(host.children.length||Object.values(resources()).some(Boolean))throw Error('Context recovery resources leaked');
      host.remove();images['contact-sheet.png']=sheet.canvas.toDataURL('image/png').split(',')[1];images['contact-sheet-public.png']=publicSheet.canvas.toDataURL('image/png').split(',')[1];images['fallback-contact-sheet.png']=fallbackSheet.canvas.toDataURL('image/png').split(',')[1];
      return {records,images,publicPreviewIds:publicRods.map(rod=>rod.id),renderer:'webgl',cleanup:true,resources:{beforeDestroy,afterDestroy,afterContextRecovery:resources()},fallback:'canvas2d',contextRecovery:true};
    },selected);
    for(const [file,data]of Object.entries(report.images))fs.writeFileSync(path.join(output,file),Buffer.from(data,'base64'));delete report.images;assert.deepEqual(errors,[]);assert.deepEqual(report.publicPreviewIds,selected.filter(rod=>!rod.hidden).map(rod=>rod.id));report.errors=errors;report.output=output;
    report.sources=Object.fromEntries(['skins/tracer/fishing-rod-renderer.js','skins/tracer/fishing-lighting.js','public/fishing-model.js'].map(file=>[file,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,rods:report.records.length,publicPreviewIds:report.publicPreviewIds,renderer:report.renderer,fallback:report.fallback,contextRecovery:report.contextRecovery,resources:report.resources,errors},null,2));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
