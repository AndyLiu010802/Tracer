'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-relic-upgrade');fs.mkdirSync(out,{recursive:true});
const rods=require('../public/fishing-model').catalog.rods.filter(r=>Object.hasOwn(require('../skins/tracer/fishing-relic-painted').assets,r.id)&&(!process.argv.includes('--pilot')||['thunderdrum','ruyi','guanyuyunchang'].includes(r.id)));
const files=['fishing-lighting','fishing-onepiece-painted','fishing-naruto-painted','fishing-valorant-painted','fishing-basic-painted','fishing-relic-painted','fishing-onepiece-rods','fishing-anime-rods','fishing-crafted-rods','fishing-rod-renderer'];
const html='<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f2ecdc}#host{position:absolute;left:128px;top:128px;width:250.8px;height:418px}</style><div id="host"></div>'+files.map(f=>'<script>'+fs.readFileSync(path.join(root,'skins/tracer',f+'.js'),'utf8')+'</script>').join('');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
  const errors=[],report=[];
  for(const mode of ['webgl','canvas2d']){
    const page=await browser.newPage({viewport:{width:800,height:800},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(e.message));
    if(mode==='canvas2d')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl/.test(kind)?null:original.call(this,kind,...args);};});
    await page.route('http://cel-qa.test/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/')return route.fulfill({contentType:'text/html',body:html});const file=path.resolve(root,'skins/tracer','.'+p);if(file.startsWith(path.join(root,'skins/tracer')+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});return route.abort();});await page.goto('http://cel-qa.test/');
    await page.evaluate(ids=>TracerFishingRelicPainted.preload(document,ids),rods.map(r=>r.id));
    const results=await page.evaluate(rods=>{const R=TracerFishingRodRenderer,host=document.querySelector('#host'),renderer=R.create(host,{rod:rods[0],shadows:false}),results=[];
      for(const rod of rods){for(const bend of [0,-.24,.24]){renderer.update({rod,bend});const source=host.querySelector('canvas'),copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;const cc=copy.getContext('2d');cc.drawImage(source,0,0);const pixels=cc.getImageData(0,0,copy.width,copy.height).data;let minX=copy.width,minY=copy.height,maxX=0,maxY=0,occupied=0;
        for(let y=0;y<copy.height;y++)for(let x=0;x<copy.width;x++)if(pixels[(y*copy.width+x)*4+3]>24){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);occupied++;}
        const tile=document.createElement('canvas');tile.width=320;tile.height=500;const c=tile.getContext('2d'),w=maxX-minX+1,h=maxY-minY+1,scale=Math.min(278/w,440/h);c.fillStyle='#f5efde';c.fillRect(0,0,320,500);c.drawImage(copy,minX,minY,w,h,(320-w*scale)/2,16+(440-h*scale)/2,w*scale,h*scale);c.textAlign='center';c.fillStyle='#302e38';c.font='bold 17px system-ui';c.fillText(rod.name[0],160,479);results.push({id:rod.id,bend,kind:renderer.kind,triangles:renderer.getGeometry().triangles,occupied,bounds:[minX,minY,maxX,maxY],size:[copy.width,copy.height],png:tile.toDataURL('image/png').split(',')[1]});}
      }renderer.destroy();return results;
    },rods);
    for(const row of results){assert.equal(row.kind,mode);assert(row.occupied>2000,row.id+' empty');assert(row.bounds[0]>2&&row.bounds[1]>2&&row.bounds[2]<row.size[0]-3&&row.bounds[3]<row.size[1]-3,row.id+' clipped');const png=Buffer.from(row.png,'base64');fs.writeFileSync(path.join(out,`${mode}-${row.id}-${row.bend}.png`),png);delete row.png;report.push(row);}
    await page.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({renders:report.length,errors,report},null,2));
  const review='<!doctype html><html lang=zh><meta charset=utf-8><title>鱼竿美术检查</title><style>body{margin:24px;background:#203b37;color:#e8dfc8;font:15px system-ui}.grid{display:grid;grid-template-columns:repeat(5,320px);gap:12px}img{width:320px;height:500px;border-radius:8px}</style><h1>万象 · 西游 · 三国</h1><p>以下为游戏渲染器实际输出。点击查看透明原画。</p><div class=grid>'+rods.map(r=>'<a href=../../skins/tracer/fishing-art/rod-relic-'+r.id+'-v3.png><img alt='+r.id+' src=webgl-'+r.id+'-0.png></a>').join('')+'</div><h1>Canvas 回退渲染</h1><div class=grid>'+rods.map(r=>'<img alt='+r.id+' src=canvas2d-'+r.id+'-0.png>').join('')+'</div></html>';
  fs.writeFileSync(path.join(out,'review.html'),review);const page=await browser.newPage({viewport:{width:1710,height:1200}});await page.goto('file:///'+path.join(out,'review.html').replaceAll('\\','/'));await page.locator('.grid').first().screenshot({path:path.join(out,'all-models.png')});await page.close();console.log(JSON.stringify({renders:report.length,errors,preview:path.join(out,'review.html')}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
