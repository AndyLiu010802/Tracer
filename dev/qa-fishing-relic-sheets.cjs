'use strict';
// Contact sheets and transparency checks of the delivered imagegen originals.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../.cache/desktop-qa-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-relic-upgrade');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
const F=require('../public/fishing-model');
const records=manifest.records.map(r=>({...r,name:F.catalog.rods.find(x=>x.id===(r.kind==='onepiece-fx'?'anime_':'')+r.key)?.name[0]||r.key}));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
  const page=await browser.newPage({viewport:{width:1240,height:1450}}),report=[];
  await page.route('http://sheets.test/**',route=>{const pathname=new URL(route.request().url()).pathname;if(pathname==='/')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><style>body{background:#283b38;color:#eee4c8;font:14px system-ui;margin:16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{background:#354c48;padding:10px;border-radius:6px}img{display:block;width:100%;height:244px;object-fit:contain}p{margin:6px 0 0}small{opacity:.65}</style><div class="grid"></div>'});const file=path.resolve(root,'.'+pathname);return file.startsWith(root+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.abort();});
  await page.goto('http://sheets.test/');
  for(const kind of ['rod','fx','onepiece-fx']){
    const group=records.filter(r=>r.kind===kind);
    for(let i=0;i<group.length;i+=12){
      const batch=group.slice(i,i+12);
      const data=await page.evaluate(async rows=>{const host=document.querySelector('.grid');host.replaceChildren();const report=[];for(const r of rows){const card=document.createElement('div');card.className='card';const img=document.createElement('img');img.src='/'+r.destination;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0,occupied=0;for(let j=3;j<d.length;j+=4){if(d[j]===0)transparent++;if(d[j]>24)occupied++;}report.push({key:r.key,kind:r.kind,width:c.width,height:c.height,transparent:transparent/(d.length/4),occupied:occupied/(d.length/4)});const p=document.createElement('p');p.textContent=r.name+' · '+r.key;const small=document.createElement('small');small.textContent=r.kind;card.append(img,p,small);host.append(card);}return report;},batch);
      for(const r of data){assert(r.transparent>.05,r.key+' has no transparent margin');assert(r.occupied>.004,r.key+' is empty');}report.push(...data);
      await page.locator('.grid').screenshot({path:path.join(out,'sheet-'+kind+'-'+(i/12+1)+'.png')});
    }
  }
  fs.writeFileSync(path.join(out,'sheets-qa.json'),JSON.stringify({passed:true,count:report.length,report},null,2));console.log(JSON.stringify({passed:true,count:report.length}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
