'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require(process.env.TRACER_QA_PLAYWRIGHT||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();try{
 await page.setContent('<canvas id="film" width="1500" height="440"></canvas>');await page.addScriptTag({path:path.join(root,'skins/tracer/wallpaper-motion.js')});
 const bytes=await page.evaluate(async items=>{
  const canvas=document.getElementById('film'),q=canvas.getContext('2d'),tiles=items.map(()=>{const c=document.createElement('canvas');c.width=640;c.height=400;return c;}),stream=canvas.captureStream(24),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4500000});recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(r=>recorder.onstop=r);let start=performance.now(),raf;
  function frame(now){const t=(now-start)/1000;q.fillStyle='#101713';q.fillRect(0,0,1500,440);items.forEach((item,i)=>{TracerWallpaperMotion.draw(tiles[i],item,t);const x=(i%5)*300,y=Math.floor(i/5)*220;q.drawImage(tiles[i],x+4,y+4,292,182.5);q.fillStyle='#e6e8d8';q.font='14px "Microsoft YaHei",sans-serif';q.fillText(item.name,x+15,y+211);});raf=requestAnimationFrame(frame);}
  frame(start);recorder.start();await new Promise(r=>setTimeout(r,14000));cancelAnimationFrame(raf);recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
 },require('../public/wallpaper-catalog.json').filter(i=>i.type==='dynamic'));
 fs.writeFileSync(path.join(root,'docs/procedural-wallpapers.webm'),Buffer.from(bytes));console.log('Saved 14-second motion study at normal speed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
