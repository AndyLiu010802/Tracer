'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),sourcePath=path.join(root,'skins/tracer/garden-trails.js');
const baselinePath=process.env.TRACER_TRAIL_BEFORE||path.join(root,'.cache/garden-trail-smooth-baseline/garden-trails.js');
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'.cache/garden-trail-smooth-'));
const beforeSource=fs.existsSync(baselinePath)?fs.readFileSync(baselinePath,'utf8'):execFileSync('git',['show','HEAD:skins/tracer/garden-trails.js'],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(output,'before-source.js'),beforeSource);
fs.copyFileSync(sourcePath,path.join(output,'after-source.js'));

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1240,height:1040},deviceScaleFactor:1,recordVideo:{dir:output,size:{width:1240,height:1040}}});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.setContent('<!doctype html><meta charset="utf-8"><title>霓虹蝶兰拖尾验证</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#101413;color:#edf2ef;font:14px "Segoe UI","Microsoft YaHei",sans-serif}h1{font-size:25px;font-weight:500;margin:0 0 10px}header p{color:#9eb0a8;font-size:12px;margin:0 0 24px}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}article{min-width:0;border:1px solid #d7ede51d;border-radius:16px;background:#131a18;overflow:hidden}h2{font-weight:500;font-size:14px;margin:18px 20px 0;color:#b1c5be}h2 span{color:#e5b7ec}canvas{display:block;width:100%;height:auto;aspect-ratio:568/230}.motion-note{margin:18px 0;color:#a9bab3;font-size:12px}</style><header><h1>霓虹蝶兰 · 拖尾对比</h1><p>同一组鼠标坐标，直接调用修改前与修改后的正式 Canvas 引擎。</p></header><main></main>');
    await page.addScriptTag({content:beforeSource});
    await page.evaluate(()=>{window.BeforeTrails=window.TracerGardenTrails;});
    await page.addScriptTag({path:sourcePath});
    const report=await page.evaluate(()=>{
      // A real browser canvas receives every production draw call. Only the
      // per-player clock is deterministic; glyph canvases use the real document.
      function harness(api,kind='neon_orchid',animate=false){
        const canvas=document.createElement('canvas'),native=canvas.getContext('2d');
        const strokes=[],images=[],paintFrames=new Set(),pending=new Map();let clock=0,serial=0,current=[];
        const context=new Proxy(native,{get(target,key){
          const value=target[key];if(typeof value!=='function')return value;
          return (...args)=>{
            if(key==='beginPath')current=[];
            if(['moveTo','lineTo','quadraticCurveTo','bezierCurveTo'].includes(key))current.push([key,...args]);
            if(key==='stroke')strokes.push(current.map(command=>command.slice()));
            if(key==='drawImage'){paintFrames.add(clock);const transform=target.getTransform();images.push({x:transform.e,y:transform.f});}
            return value.apply(target,args);
          };
        },set(target,key,value){target[key]=value;return true;}});
        const win={performance:{now:()=>clock},requestAnimationFrame(fn){const id=++serial;pending.set(id,fn);return id;},cancelAnimationFrame(id){pending.delete(id);}};
        const surface={dataset:{},ownerDocument:{defaultView:win,createElement:tag=>document.createElement(tag)},getContext:()=>context};
        for(const key of ['width','height'])Object.defineProperty(surface,key,{get:()=>canvas[key],set:value=>{canvas[key]=value;}});
        const player=api.create(surface,{kind,animate});player.resize(600,260,1);
        return {player,canvas,strokes,images,paintFrames,pending,
          draw(at){clock=at;strokes.length=0;images.length=0;player.draw(at);},
          frame(at){clock=at;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(at));},
          lit(){const pixels=native.getImageData(0,0,600,260).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;return count;}};
      }
      const results={ribbons:[],pruning:{},capacity:{},resume:{},animation:{}};
      const curveCommands=stroke=>stroke.filter(command=>command[0]==='quadraticCurveTo'||command[0]==='bezierCurveTo');
      for(const kind of ['neon_orchid','lavender','peach','crystal_tree']){
        const h=harness(TracerGardenTrails,kind);
        [[60,190],[60,60],[230,60],[430,60],[500,190],[270,190]].forEach(([x,y],i)=>h.player.point({x,y},i*55));h.draw(300);
        results.ribbons.push({kind,strokes:h.strokes.length,curves:h.strokes.reduce((n,row)=>n+curveCommands(row).length,0),lines:h.strokes.reduce((n,row)=>n+row.filter(command=>command[0]==='lineTo').length,0),static:!h.player.stats().running&&h.pending.size===0,lit:h.lit()});
        h.player.destroy();
      }
      // Expiring a single old sample may remove the tail, but must not relocate
      // existing interior curve commands (the previous index-based wave did).
      const p=harness(TracerGardenTrails);
      for(let i=0;i<10;i++)p.player.point({x:45+i*48,y:130+Math.sin(i*.6)*55},i*40);
      p.draw(510);const before=curveCommands(p.strokes[0]||[]).map(row=>JSON.stringify(row));
      p.draw(521);const after=curveCommands(p.strokes[0]||[]).map(row=>JSON.stringify(row));
      results.pruning={before:before.length,after:after.length,unchanged:after.filter(row=>before.includes(row)).length,knots:p.player.stats().knots};p.player.destroy();
      const bounded=harness(TracerGardenTrails);
      for(let i=0;i<160;i++)bounded.player.point({x:i%2?545:45,y:70+i%5*24},i*3);
      bounded.draw(500);results.capacity={...bounded.player.stats(),lit:bounded.lit()};bounded.draw(3000);results.capacity.expired={...bounded.player.stats(),lit:bounded.lit()};bounded.player.destroy();
      const resumed=harness(TracerGardenTrails);resumed.player.point({x:50,y:100},0);resumed.player.point({x:100,y:100},40);resumed.draw(70);resumed.draw(2400);
      resumed.player.point({x:470,y:110},2500);results.resume.first=resumed.player.stats();resumed.player.point({x:510,y:110},2516);resumed.draw(2548);
      results.resume.minParticleX=Math.min(...resumed.images.map(image=>image.x));results.resume.lit=resumed.lit();resumed.player.destroy();
      for(const [name,api]of [['before',BeforeTrails],['after',TracerGardenTrails]]){
        const h=harness(api,'neon_orchid',true);h.player.point({x:60,y:120},0);h.player.point({x:260,y:120},1);h.paintFrames.clear();
        for(let frame=1;frame<=30;frame++)h.frame(frame*1000/60);
        const rendered=h.paintFrames.size;
        for(let frame=31;frame<=140&&h.pending.size;frame++)h.frame(frame*1000/60);
        results.animation[name]={rendered,stats:h.player.stats(),pending:h.pending.size,lit:h.lit()};h.player.destroy();
      }
      return results;
    });
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    await page.evaluate(()=>{
      window.comparisonPlayers=[];
      const paths=[
        {id:'loop',label:'连续回环',points:Array.from({length:29},(_,i)=>{const a=i/28*Math.PI*2;return {x:284-Math.cos(a)*220,y:117-Math.sin(a)*60,at:i*15};})},
        {id:'corners',label:'稀疏采样 · 急转弯',points:[[60,175,0],[60,58,55],[270,58,125],[490,58,180],[500,176,245],[285,176,335],[70,176,420]].map(([x,y,at])=>({x,y,at}))},
        {id:'irregular',label:'快速移动 · 不均匀采样',points:[[35,135,0],[90,70,16],[235,55,49],[430,70,82],[515,125,139],[470,185,178],[285,150,242],[85,195,293],[60,130,354],[230,105,420]].map(([x,y,at])=>({x,y,at}))}
      ];
      window.comparisonPaths=paths;
      for(const path of paths)for(const [label,api]of [['修改前',BeforeTrails],['修改后',TracerGardenTrails]]){
        const card=document.createElement('article');card.dataset.path=path.id;card.dataset.version=label==='修改后'?'after':'before';card.innerHTML='<h2><span>'+label+'</span> / '+path.label+'</h2><canvas></canvas>';document.querySelector('main').append(card);
        const canvas=card.querySelector('canvas'),player=api.create(canvas,{kind:'neon_orchid',animate:false});player.resize(568,230,1);
        path.points.forEach(point=>player.point(point,point.at));player.draw(435);comparisonPlayers.push(player);
      }
    });
    await page.screenshot({path:path.join(output,'neon-orchid-before-after.png'),fullPage:true});
    await page.locator('article[data-path="loop"][data-version="after"]').screenshot({path:path.join(output,'neon-orchid-after.png')});
    // Use each engine's own requestAnimationFrame loop for the motion capture.
    await page.evaluate(()=>{
      comparisonPlayers.forEach(player=>player.destroy());document.querySelector('main').innerHTML='';
      const players=[];
      for(const [label,api]of [['修改前',BeforeTrails],['修改后',TracerGardenTrails]]){
        const card=document.createElement('article');card.innerHTML='<h2><span>'+label+'</span> / 连续回环与转弯</h2><canvas></canvas>';document.querySelector('main').append(card);
        const player=api.create(card.querySelector('canvas'),{kind:'neon_orchid'});player.resize(568,230,1);players.push(player);
      }
      document.body.insertAdjacentHTML('beforeend','<p class="motion-note">实时绘制；停止移动后，粒子消散并停止动画调度。</p>');
      window.motionPlayers=players;
      const start=performance.now();let last=-Infinity;
      window.motionFinished=new Promise(resolve=>{
        function feed(now){const elapsed=now-start;if(elapsed>3400){resolve();return;}if(now-last>=15){last=now;const t=elapsed/1050*Math.PI*2;for(const player of players)player.point({x:284-Math.cos(t)*220,y:117-Math.sin(t)*63});}requestAnimationFrame(feed);}
        requestAnimationFrame(feed);
      });
    });
    await page.evaluate(()=>motionFinished);await page.waitForTimeout(1700);
    await page.evaluate(()=>motionPlayers.forEach(player=>player.destroy()));
    await page.close();const video=await page.video().path();fs.copyFileSync(video,path.join(output,'neon-orchid-motion.webm'));
    assert.deepEqual(errors,[]);
    for(const row of report.ribbons){assert.ok(row.curves>=2,row.kind+' must render curved ribbons');assert.equal(row.lines,0,row.kind+' ribbon must not have straight corner joins');assert.ok(row.static);assert.ok(row.lit>300);}
    assert.ok(report.pruning.before>=6&&report.pruning.unchanged>=report.pruning.after-2,'pruning an old knot must preserve surviving interior ribbon geometry');
    assert.ok(report.capacity.particles<=120&&report.capacity.knots<=32&&report.capacity.lit>0);
    assert.deepEqual({...report.capacity.expired,kind:undefined},{kind:undefined,particles:0,knots:0,running:false,lit:0},'expired motion must clear every pixel');
    assert.equal(report.resume.first.particles,0,'resuming after idle must not emit a bridge from an expired location');assert.equal(report.resume.first.knots,1);assert.ok(report.resume.minParticleX>=460);
    assert.ok(report.animation.after.rendered>=28,'the renderer should draw on nearly every 60 Hz frame');
    assert.ok(report.animation.after.pending===0&&!report.animation.after.stats.running&&report.animation.after.lit===0,'idle renderer must stop and clear');
    console.log('PASS smooth ribbon geometry, stable tail pruning, sparse/irregular path previews, 60 Hz render cadence, bounded particles, idle resume and pixel cleanup. '+output);
  }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);console.error('QA artifacts: '+output);process.exitCode=1;});
