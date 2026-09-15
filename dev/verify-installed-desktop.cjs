'use strict';
// Run with the installed app closed and a current migration snapshot available.
// Set TRACER_MIGRATION_SNAPSHOT (or TRACER_MIGRATION_DIR) for the snapshot.
// Optional: TRACER_DESKTOP_EXE, TRACER_EXPECTED_VERSION and
// TRACER_EXPECTED_TRACK_COUNT.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root=path.resolve(__dirname,'..');
const folder=path.resolve(process.env.TRACER_MIGRATION_DIR || path.join(root,'.cache','desktop-migration'));
const snapshot=path.resolve(process.env.TRACER_MIGRATION_SNAPSHOT || path.join(folder,'browser-workspace.json'));
const backup=JSON.parse(fs.readFileSync(snapshot,'utf8'));
const expectedVersion=process.env.TRACER_EXPECTED_VERSION || require('../package.json').version;
const expectedTracks=Number(process.env.TRACER_EXPECTED_TRACK_COUNT || 35);
const env={...process.env};
for(const key of ['ELECTRON_RUN_AS_NODE','TRACER_USER_DATA_DIR','TRACER_DISABLE_INPUT_HOOK','DOCS_PORTAL_DATA_DIR','DOCS_PORTAL_STATE_FILE','DOCS_PORTAL_PORT','DOCS_PORTAL_MUSIC_DIR'])delete env[key];
(async()=>{
  if(!process.env.TRACER_DESKTOP_EXE && !process.env.LOCALAPPDATA)throw new Error('Set TRACER_DESKTOP_EXE or LOCALAPPDATA');
  const exe=path.resolve(process.env.TRACER_DESKTOP_EXE || path.join(process.env.LOCALAPPDATA,'Programs','Tracer','Tracer.exe'));
  const app=await _electron.launch({executablePath:exe,args:[],env,timeout:30000});
  try {
    let page;
    for(let i=0;i<100;i++){page=app.context().pages().find(p=>p.url().startsWith('http://127.0.0.1:8137/'));if(page)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(page,'Installed task window opens');
    await page.waitForFunction(()=>window.Tracer?.store?.data,{timeout:15000});
    const result=await page.evaluate(async()=>({
      workspace:Tracer.store.data,language:localStorage.getItem('tracer.language'),
      music:localStorage.getItem('tracer.music.v1'),focus:TracerFocus.read(JSON.parse(localStorage.getItem('tracer.focus.v1')||'null')),
      tracks:(await fetch('/api/music').then(r=>r.json())).tracks.length,
      native:!!window.TracerBrowser,
    }));
    assert.deepEqual(result.workspace.tasks,backup.workspace.tasks,'Every task matches the selected browser workspace');
    assert.deepEqual(result.workspace.completionHistory,backup.workspace.completionHistory,'Completion history retained');
    assert.equal(result.language,backup.prefs['tracer.language'],'Language retained');
    assert.equal(result.music,backup.prefs['tracer.music.v1'],'Music settings retained');
    const priorFocus=require('../skins/tracer/focus-model').read(JSON.parse(backup.prefs['tracer.focus.v1']||'null'));
    if(priorFocus){assert.ok(result.focus.totalMinutes>=priorFocus.totalMinutes,'Focus minutes retained');assert.ok(result.focus.roundsDone>=priorFocus.roundsDone,'Focus rounds retained');}
    assert.equal(result.tracks,expectedTracks);assert.equal(result.native,true);
    const identity=await app.evaluate(({app})=>({name:app.getName(),version:app.getVersion(),userData:app.getPath('userData')}));
    assert.equal(identity.version,expectedVersion);
    await page.screenshot({path:path.join(root,'.cache','desktop-installed.png')});
    console.log(JSON.stringify({...identity,tasks:result.workspace.tasks.length,completionHistory:result.workspace.completionHistory.length,tracks:result.tracks,preferencesVerified:true,installedVerified:true},null,2));
  }finally{await app.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
