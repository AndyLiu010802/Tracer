'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');
const sourcePath=path.join(root,'skins/tracer/garden-trails.js');
const baselineCandidate=process.env.TRACER_TRAIL_PERF_BEFORE||path.join(root,'.cache/trail-perf-baseline/garden-trails.js');
if(process.env.TRACER_TRAIL_PERF_BEFORE)assert.ok(fs.existsSync(baselineCandidate),'Explicit baseline source does not exist: '+baselineCandidate);
const baselineOrigin=fs.existsSync(baselineCandidate)?{type:'file',path:baselineCandidate}:{type:'git',ref:'HEAD:skins/tracer/garden-trails.js'};
const beforeSource=baselineOrigin.type==='file'?fs.readFileSync(baselineCandidate,'utf8'):execFileSync('git',['show',baselineOrigin.ref],{cwd:root,encoding:'utf8'});
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'.cache/garden-trail-performance-'));
const baselinePath=path.join(output,'before-source.js');
fs.writeFileSync(baselinePath,beforeSource);
fs.copyFileSync(sourcePath,path.join(output,'after-source.js'));

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.setContent('<!doctype html><meta charset="utf-8"><title>Garden trail performance QA</title>');
    await page.addScriptTag({path:baselinePath});
    await page.evaluate(()=>{window.BeforeTrails=window.TracerGardenTrails;});
    await page.addScriptTag({path:sourcePath});
    const report=await page.evaluate(()=>{
      const desktop={maxDpr:1.5,maxPixels:3840*2160};
      const report={
        browser:navigator.userAgent,
        methodology:'Real browser Canvas 2D, fixed coordinates and 60 fps timestamps; two warm-up rounds and seven interleaved measured rounds. CPU measurements use native contexts without operation instrumentation. A readback outside each measured round flushes pending drawing. Timings include JavaScript and Canvas command submission, not GPU/compositor time or GPU utilization. Deterministic requestAnimationFrame checks scheduling independently of host refresh rate.',
        benchmark:[],operations:[],refresh:[],idle:[],pixels:[],themes:[]
      };
      function harness(api,{kind='neon_orchid',animate=false,width=600,height=260,dpr=1,options={},instrument=false}={}){
        const canvas=document.createElement('canvas'),native=canvas.getContext('2d');
        const counts={main:{},glyph:{},glyphCanvases:0},pending=new Map(),paintTimes=new Set();
        let clock=0,serial=0,countFrames=false;
        function wrapped(target,bucket){
          return new Proxy(target,{
            get(object,key){const value=Reflect.get(object,key,object);if(typeof value!=='function')return value;
              return(...args)=>{bucket[key]=(bucket[key]||0)+1;if(countFrames&&bucket===counts.main&&['clearRect','stroke','drawImage'].includes(key))paintTimes.add(clock);return value.apply(object,args);};},
            set(object,key,value){object[key]=value;return true;}
          });
        }
        const ctx=instrument?wrapped(native,counts.main):native;
        const win={performance:{now:()=>clock},Path2D:window.Path2D,
          requestAnimationFrame(fn){const id=++serial;pending.set(id,fn);return id;},cancelAnimationFrame(id){pending.delete(id);}};
        const doc={defaultView:win,createElement(tag){
          const element=document.createElement(tag);if(instrument&&tag==='canvas'){
            counts.glyphCanvases++;const getContext=element.getContext.bind(element);let proxy;
            element.getContext=(type,...args)=>type==='2d'?(proxy||(proxy=wrapped(getContext(type,...args),counts.glyph))):getContext(type,...args);
          }return element;
        }};
        const surface={dataset:{},ownerDocument:doc,getContext:()=>ctx};
        for(const key of ['width','height'])Object.defineProperty(surface,key,{get:()=>canvas[key],set:value=>{canvas[key]=value;}});
        const player=api.create(surface,{kind,animate,...options});player.resize(width,height,dpr);
        return{player,canvas,native,counts,pending,paintTimes,
          point(value,at){clock=at;player.point(value,at);},
          draw(at){clock=at;player.draw(at);},
          frame(at){clock=at;countFrames=true;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(at));countFrames=false;},
          clear(){player.clear();},
          flush(){native.getImageData(0,0,1,1);},
          lit(){const pixels=native.getImageData(0,0,canvas.width,canvas.height).data;let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])n++;return n;},
          dispose(){player.destroy();canvas.width=canvas.height=1;}
        };
      }
      function position(frame,width=1920,height=1080){
        const t=frame/60;
        return{x:width*.5+Math.cos(t*4.3)*width*.32,y:height*.5+Math.sin(t*6.1)*height*.27};
      }
      function percentile(rows,fraction){const sorted=rows.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*fraction))]||0;}
      function summarize(rows){return{medianMs:percentile(rows,.5),p95Ms:percentile(rows,.95)};}
      function runRound(h,frames,timed){
        h.clear();const samples=[];let sum=0;
        for(let frame=0;frame<frames;frame++){
          const at=frame*1000/60,point=position(frame);
          const start=timed?performance.now():0;
          h.point(point,at);h.draw(at);
          if(timed){const duration=performance.now()-start;samples.push(duration);sum+=duration;}
        }
        h.flush();return{samples,meanMs:sum/frames};
      }
      for(const dpr of [1,1.5,2]){
        // Baseline/default and optimized/desktop use exactly the same trace.
        // Optimized/default separates engine work from the desktop pixel budget.
        const configs=[['before',BeforeTrails,{}],['afterDefault',TracerGardenTrails,{}],['afterDesktop',TracerGardenTrails,desktop]];
        const rows=configs.map(([name,api,options])=>({name,h:harness(api,{width:1920,height:1080,dpr,options}),samples:[],means:[]}));
        for(let warmup=0;warmup<2;warmup++)for(const row of rows)runRound(row.h,120,false);
        for(let round=0;round<7;round++)for(let offset=0;offset<rows.length;offset++){
          const row=rows[(round+offset)%rows.length],result=runRound(row.h,180,true);row.samples.push(...result.samples);row.means.push(result.meanMs);
        }
        for(const row of rows){report.benchmark.push({version:row.name,dpr,cssWidth:1920,cssHeight:1080,pixelWidth:row.h.canvas.width,pixelHeight:row.h.canvas.height,pixels:row.h.canvas.width*row.h.canvas.height,frames:row.samples.length,frameSubmission:summarize(row.samples),roundMeanSubmission:summarize(row.means)});row.h.dispose();}
      }
      for(const [version,api]of [['before',BeforeTrails],['after',TracerGardenTrails]]){
        const measured=harness(api,{width:1920,height:1080,instrument:true,options:desktop});
        const setup=JSON.parse(JSON.stringify(measured.counts));
        for(let frame=0;frame<180;frame++){const at=frame*1000/60;measured.point(position(frame),at);measured.draw(at);}
        const motion={};for(const [key,value]of Object.entries(measured.counts.main))motion[key]=value-(setup.main[key]||0);
        const glyphDuringMotion={};for(const [key,value]of Object.entries(measured.counts.glyph))glyphDuringMotion[key]=value-(setup.glyph[key]||0);
        const beforeFade=JSON.parse(JSON.stringify(measured.counts));
        for(let frame=180;frame<200;frame++)measured.draw(frame*1000/60);
        const fade={};for(const [key,value]of Object.entries(measured.counts.main))fade[key]=value-(beforeFade.main[key]||0);
        measured.clear();measured.point({x:120,y:200},0);measured.point({x:180,y:180},16);measured.point({x:230,y:190},32);measured.draw(32);
        const beforeCoasting=JSON.parse(JSON.stringify(measured.counts));
        for(let frame=3;frame<13;frame++)measured.draw(frame*16);
        const coasting={};for(const [key,value]of Object.entries(measured.counts.main))coasting[key]=value-(beforeCoasting.main[key]||0);
        report.operations.push({version,setup,motion,glyphDuringMotion,glyphCanvasesDuringMotion:measured.counts.glyphCanvases-setup.glyphCanvases,fadeWithoutNewSamples:fade,tenFramesWithUnchangedGeometry:coasting});measured.dispose();
      }
      for(const hz of [60,120,144])for(const [version,api]of [['before',BeforeTrails],['after',TracerGardenTrails]]){
        const h=harness(api,{animate:true,instrument:true});let lastSample=-1,peakParticles=0,peakKnots=0;
        for(let frame=0;frame<=hz*2;frame++){
          const at=frame*1000/hz,sample=Math.floor(at/(1000/60));
          if(sample!==lastSample){lastSample=sample;h.point(position(sample,600,260),at);}
          h.frame(at);const state=h.player.stats();peakParticles=Math.max(peakParticles,state.particles);peakKnots=Math.max(peakKnots,state.knots);
        }
        report.refresh.push({version,hz,elapsedMs:2000,paintFrames:h.paintTimes.size,peakParticles,peakKnots});h.dispose();
      }
      for(const [version,api]of [['before',BeforeTrails],['after',TracerGardenTrails]]){
        const h=harness(api,{animate:true,instrument:true});h.point({x:50,y:100},0);h.point({x:160,y:110},16);
        for(let frame=1;frame<=180;frame++)h.frame(frame*1000/60);
        const drained={...h.player.stats(),pending:h.pending.size,lit:h.lit()};const paintBefore=h.paintTimes.size;
        for(let frame=0;frame<180;frame++){const at=4000+frame*1000/60;h.point({x:160,y:110},at);h.frame(at);}
        report.idle.push({version,drained,stationaryPaintFrames:h.paintTimes.size-paintBefore,stationary:{...h.player.stats(),pending:h.pending.size}});h.dispose();
      }
      for(const [width,height]of [[1920,1080],[3840,2160]])for(const dpr of [1,1.5,2])for(const [version,api,options]of [['before',BeforeTrails,{}],['afterDefault',TracerGardenTrails,{}],['afterDesktop',TracerGardenTrails,desktop]]){
        const h=harness(api,{width,height,dpr,options});
        report.pixels.push({version,cssWidth:width,cssHeight:height,dpr,pixelWidth:h.canvas.width,pixelHeight:h.canvas.height,pixels:h.canvas.width*h.canvas.height,rgbaMiB:h.canvas.width*h.canvas.height*4/1024/1024});h.dispose();
      }
      for(const {id:kind}of TracerGardenTrails.catalog){
        const h=harness(TracerGardenTrails,{kind,animate:true,instrument:true,options:desktop});let peakParticles=0,peakKnots=0;
        for(let frame=0;frame<90;frame++){const at=frame*1000/60;h.point({x:frame%2?550:50,y:80+frame%6*20},at);h.frame(at);const state=h.player.stats();peakParticles=Math.max(peakParticles,state.particles);peakKnots=Math.max(peakKnots,state.knots);}
        const activeLit=h.lit();for(let frame=90;frame<240;frame++)h.frame(frame*1000/60);
        report.themes.push({kind,peakParticles,peakKnots,activeLit,expired:{...h.player.stats(),pending:h.pending.size,lit:h.lit()}});h.dispose();
      }
      return report;
    });
    report.baseline=baselineOrigin;
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    assert.deepEqual(errors,[]);
    for(const row of report.refresh.filter(row=>row.version==='after')){
      assert.ok(row.paintFrames>=116&&row.paintFrames<=122,`${row.hz} Hz should draw about 120 frames in two seconds, got ${row.paintFrames}`);
      assert.ok(row.peakParticles<=120&&row.peakKnots<=32,'bounded active geometry at '+row.hz+' Hz');
    }
    const idle=report.idle.find(row=>row.version==='after');
    assert.equal(idle.stationaryPaintFrames,0,'repeated stationary samples must not wake drawing');
    for(const state of [idle.drained,idle.stationary]){assert.equal(state.particles,0);assert.equal(state.knots,0);assert.equal(state.pending,0);assert.equal(state.running,false);}
    assert.equal(idle.drained.lit,0,'idle canvas must be completely transparent');
    const operations=report.operations.find(row=>row.version==='after');
    assert.equal(operations.setup.glyphCanvases,4,'create four cached sprite canvases');
    assert.equal(operations.glyphCanvasesDuringMotion,0,'do not recreate sprites per frame');
    assert.ok(Object.values(operations.glyphDuringMotion).every(value=>value===0),'do not redraw cached glyphs during motion');
    assert.equal(operations.tenFramesWithUnchangedGeometry.createLinearGradient||0,0,'reuse gradients until ribbon geometry changes');
    for(const row of report.pixels.filter(row=>row.version==='afterDesktop')){
      assert.ok(row.pixels<=3840*2160+row.pixelWidth+row.pixelHeight,'desktop canvas must respect the 4K pixel budget (rounding allowance)');
      assert.ok(row.pixelWidth<=Math.round(row.cssWidth*1.5),'desktop DPR must not exceed 1.5');
    }
    for(const row of report.themes){assert.ok(row.peakParticles<=120&&row.peakKnots<=32&&row.activeLit>0,row.kind+' active bounds');assert.equal(row.expired.particles,0);assert.equal(row.expired.knots,0);assert.equal(row.expired.pending,0);assert.equal(row.expired.running,false);assert.equal(row.expired.lit,0,row.kind+' clear every pixel');}
    const visualContext=await browser.newContext({viewport:{width:1240,height:480},deviceScaleFactor:2});
    try{
      const visual=await visualContext.newPage();
      await visual.setContent('<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#101413;color:#edf2ef;font:16px "Segoe UI","Microsoft YaHei",sans-serif}h1{font-size:22px;font-weight:500;margin:0 0 12px}p{font-size:13px;color:#a8b9af;margin:0 0 18px}main{display:flex;gap:16px}article{width:588px;background:#131a18;border:1px solid #d7ede51d;border-radius:16px;overflow:hidden}h2{font-weight:500;font-size:15px;margin:18px 20px 0;color:#d5b4dd}canvas{display:block;width:586px;height:300px}</style><h1>霓虹蝶兰 · 高分屏清晰度与显示负担</h1><p>相同轨迹和粒子；以 DPR 2 截图。左：原始 2 倍画布，右：桌面 1.5 倍画布。</p><main><article><h2>原始 · DPR 2</h2><canvas id="before"></canvas></article><article><h2>优化 · 最大 DPR 1.5</h2><canvas id="after"></canvas></article></main>');
      await visual.addScriptTag({path:baselinePath});await visual.evaluate(()=>{window.BeforeTrails=window.TracerGardenTrails;});await visual.addScriptTag({path:sourcePath});
      await visual.evaluate(()=>{
        for(const [id,api,options]of [['before',BeforeTrails,{}],['after',TracerGardenTrails,{maxDpr:1.5,maxPixels:3840*2160}]]){
          const player=api.create(document.getElementById(id),{kind:'neon_orchid',animate:false,...options});player.resize(586,300,2);
          for(let i=0;i<=30;i++){const angle=i/30*Math.PI*2;player.point({x:293-Math.cos(angle)*230,y:150-Math.sin(angle)*76},i*14);}
          player.draw(442);
        }
      });
      await visual.screenshot({path:path.join(output,'neon-orchid-dpr2-comparison.png')});
    }finally{await visualContext.close();}
    console.log(JSON.stringify({status:'PASS',output,benchmark:report.benchmark,refresh:report.refresh,idle:report.idle,operations:report.operations.map(row=>({version:row.version,motion:row.motion,fadeWithoutNewSamples:row.fadeWithoutNewSamples,tenFramesWithUnchangedGeometry:row.tenFramesWithUnchangedGeometry}))},null,2));
  }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);console.error('QA artifacts: '+output);process.exitCode=1;});
