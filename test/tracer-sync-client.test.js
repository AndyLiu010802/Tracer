'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
function client(initial, put, options = {}) {
  const elements = new Map(), storage = options.storage || new Map(), timers = new Map(), listeners = {}, requests = [], beacons = [], intervals = []; let seq = 0;
  const el = id => { if (!elements.has(id)) elements.set(id, { hidden: true, classList: { toggle() {} }, addEventListener() {}, setAttribute() {}, innerHTML: '', querySelector() { return null; } }); return elements.get(id); };
  const translations = require('../public/task-i18n');
  const window = { WorkspaceSync: S, TracerModel: M, TracerCompanionWork: require('../public/companion-work'), TaskHistory: require('../public/task-history'), TracerLocale: { t: key => translations.t('en', key), message: text => translations.message('en', text) }, addEventListener(name, fn) { listeners[name] = fn; } };
  const context = { window, console, document: { hidden: false, activeElement: {}, documentElement: el('html'), getElementById: el, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    location: { search: '?sec=board' }, navigator: { sendBeacon(url, body) { beacons.push({ url, data: JSON.parse(body) }); return true; } },
    setInterval(fn, delay) { intervals.push(delay); }, setTimeout(fn, delay) { if(options.creationWaits && delay===50) return setTimeout(fn,0); timers.set(++seq, fn); return seq; }, clearTimeout(id) { timers.delete(id); },
    fetch: async (url, input) => { requests.push({ url, input }); return input ? put(JSON.parse(input.body)) : options.loadFailure ? { ok: false, status: 500 } : { ok: true, json: async () => S.clone(initial) }; },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../skins/tracer/app.js'), 'utf8'), context);
  return { T: window.Tracer, storage, timers, listeners, requests, beacons, intervals, elements };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const creationRequest = {requestId:'f623b4d1-79de-4cad-ae76-d5523a54dacf',proposal:{type:'project',project:{name:'Launch',notes:'Launch notes',start:null,end:null},tasks:[{title:'Write report',notes:'Use the agreed outline',due:null,scheduled:null,priority:'high',estimate:2,checklist:['Draft','Review']}]}};
test('a stale save merges newly created companion work before retrying local edits',async()=>{
  const initial=S.empty();M.addTask(initial,{title:'Existing'});
  const remote=require('../public/companion-work').apply(initial,creationRequest.proposal,creationRequest.requestId,M).workspace;
  let calls=0,written;
  const c=client(initial,async sent=>{
    if(++calls===1){Object.assign(initial,S.clone(remote));return {ok:false,status:409,json:async()=>({error:'workspace-stale'})};}
    written=S.clone(sent);return {ok:true,json:async()=>({ok:true})};
  });await c.T.ready;
  const localTask=M.addTask(c.T.store.data,{title:'Created in the older tab'}),savedTask=remote.tasks[1];
  assert.equal(localTask.seq,savedTask.seq,'both tabs initially allocate the same next sequence');
  c.T.store.data.tasks[0].notes='Keep my independent edit';c.T.touch();c.T.saveNow();await settle();
  assert.equal(calls,1,'failed save never spins in an automatic retry loop');
  assert.equal(c.T.store.data.tasks.length,3);assert.equal(c.T.store.data.tasks[0].notes,'Keep my independent edit');
  assert.equal(c.T.store.data.tasks.find(task=>task.id===savedTask.id).seq,savedTask.seq);
  assert.equal(c.T.store.data.tasks.find(task=>task.id===localTask.id).seq,'TRC-3');
  assert.match(c.elements.get('save-dot').title,/merged/);assert.equal(c.T.store.conflict,null);
  c.T.saveNow();await settle();assert.equal(written.tasks.length,3);assert.equal(written.meta.companionReceipts.length,1);
  assert.equal(new Set(written.tasks.map(task=>task.seq)).size,3);assert.equal(written.meta.seqCounter,3);
  assert.equal(c.storage.has('tracer.workspaceDraft'),false);
});
test('a stale save with same-field edits enters local conflict recovery without overwriting either version',async()=>{
  const initial=S.empty();M.addTask(initial,{title:'Before'});
  const remote=require('../public/companion-work').apply(initial,creationRequest.proposal,creationRequest.requestId,M).workspace;
  remote.tasks[0].title='Saved elsewhere';let calls=0,written;
  const c=client(initial,async sent=>{
    if(++calls===1){Object.assign(initial,S.clone(remote));return {ok:false,status:409,json:async()=>({error:'workspace-stale'})};}
    written=S.clone(sent);return {ok:true,json:async()=>({ok:true})};
  });await c.T.ready;
  const localTask=M.addTask(c.T.store.data,{title:'Keep the concurrent new task'}),savedTask=remote.tasks[1];
  assert.equal(localTask.seq,savedTask.seq);
  c.T.store.data.tasks[0].title='My unsaved title';c.T.touch();c.T.saveNow();await settle();
  assert.ok(c.T.store.conflict);assert.match(c.elements.get('save-dot').title,/Draft conflicts/);
  c.T.saveNow();c.listeners.beforeunload();assert.equal(calls,1);assert.equal(c.beacons.length,0);
  const conflicts=S.merge(c.T.store.base,c.T.store.data,c.T.store.conflict).conflicts;
  assert.equal(conflicts.length,1);assert.equal(c.T.resolveDraft({[conflicts[0].key]:'local'}),true);await settle();
  assert.equal(written.tasks[0].title,'My unsaved title');assert.equal(written.tasks.length,3);
  assert.equal(written.tasks.find(task=>task.id===savedTask.id).seq,savedTask.seq);
  assert.equal(written.tasks.find(task=>task.id===localTask.id).seq,'TRC-3');
  assert.equal(new Set(written.tasks.map(task=>task.seq)).size,3);
  assert.equal(written.meta.companionReceipts.length,1);assert.equal(c.T.store.conflict,null);
});

test('restored concurrent creation drafts preserve saved sequence numbers through automatic merge and explicit conflict resolution',async()=>{
  const Work=require('../public/companion-work');
  for(const conflicting of [false,true]){
    const base=S.empty();M.addTask(base,{title:'Shared existing task'});
    const saved=Work.apply(base,creationRequest.proposal,creationRequest.requestId,M).workspace;
    const draft=Work.apply(base,{type:'tasks',project:null,tasks:[{...creationRequest.proposal.tasks[0],title:'Unsaved concurrent task'}]},'5a069d1e-ff01-4e92-b97b-1452528191c2',M).workspace;
    const savedTask=saved.tasks[1],pendingTask=draft.tasks[1];
    assert.equal(savedTask.seq,pendingTask.seq);
    if(conflicting){saved.tasks[0].title='Saved title';draft.tasks[0].title='Draft title';}
    let written;
    const storage=new Map([['tracer.workspaceDraft',JSON.stringify({base,data:draft})]]);
    const c=client(saved,async sent=>{written=S.clone(sent);return {ok:true,json:async()=>({ok:true})};},{storage});await c.T.ready;
    assert.equal(c.T.store.data.tasks.length,3);
    assert.equal(c.T.store.data.tasks.find(task=>task.id===savedTask.id).seq,'TRC-2');
    assert.equal(c.T.store.data.tasks.find(task=>task.id===pendingTask.id).seq,'TRC-3');
    if(conflicting){
      const conflicts=S.merge(c.T.store.base,c.T.store.data,c.T.store.conflict).conflicts;
      assert.equal(conflicts.length,1);assert.equal(c.T.resolveDraft({[conflicts[0].key]:'local'}),true);
    }else{assert.equal(c.T.store.conflict,null);c.T.saveNow();}
    await settle();
    assert.equal(written.tasks.length,3);assert.equal(written.meta.companionReceipts.length,2);
    assert.equal(written.tasks.find(task=>task.id===savedTask.id).seq,'TRC-2');
    assert.equal(written.tasks.find(task=>task.id===pendingTask.id).seq,'TRC-3');
    assert.equal(written.meta.seqCounter,3);
    assert.equal(storage.has('tracer.workspaceDraft'),false);
  }
});
test('companion creation commits one project and tasks only after a successful local save',async()=>{
  const initial=S.empty();M.addTask(initial,{title:'Existing'});let written;
  const c=client(initial,async sent=>{written=S.clone(sent);return {ok:true,json:async()=>({ok:true})};},{creationWaits:true});await c.T.ready;
  const first=c.T.applyCompanionWork(creationRequest),second=c.T.applyCompanionWork(creationRequest);assert.equal(first,second);
  const result=await first;assert.equal(written.projects.length,1);assert.equal(written.tasks.length,2);assert.equal(result.taskIds.length,1);
  assert.equal(written.notes[0].body,'Launch notes');assert.equal(c.T.store.dirty,false);
  await c.T.applyCompanionWork(creationRequest);assert.equal(c.requests.filter(x=>x.input).length,1,'retry after acknowledgement does not write again');
});
test('failed companion saves retry the same records across reloads without replacing existing edits',async()=>{
  const initial=S.empty();M.addTask(initial,{title:'Keep existing'});let fail=true,written;
  const c=client(initial,async sent=>{if(fail)return {ok:false,status:500,json:async()=>({error:'disk-full'})};written=S.clone(sent);return {ok:true,json:async()=>({ok:true})};},{creationWaits:true});await c.T.ready;
  await assert.rejects(c.T.applyCompanionWork(creationRequest),/companion-save-pending/);
  assert.equal(c.T.store.data.tasks.length,2);assert.ok(c.storage.has('tracer.workspaceDraft'));
  const retry=client(initial,async sent=>{written=S.clone(sent);return {ok:true,json:async()=>({ok:true})};},{storage:c.storage,creationWaits:true});await retry.T.ready;
  retry.T.store.data.tasks[0].notes='Edit preserved while creation waits';retry.T.touch();
  const result=await retry.T.applyCompanionWork(creationRequest);assert.equal(result.duplicate,true);
  assert.equal(written.projects.length,1);assert.equal(written.tasks.length,2);assert.equal(written.tasks[0].notes,'Edit preserved while creation waits');
  assert.equal(written.meta.companionReceipts.length,1);
});
test('companion creation blocks a lost or conflicted workspace and rejects changing a used request',async()=>{
  const c=client(S.empty(),async()=>({ok:true,json:async()=>({ok:true})}),{creationWaits:true});await c.T.ready;
  c.T.store.conflict=S.empty();await assert.rejects(c.T.applyCompanionWork(creationRequest),/workspace-busy/);assert.equal(c.requests.filter(x=>x.input).length,0);
  c.T.store.conflict=null;await c.T.applyCompanionWork(creationRequest);
  const changed=structuredClone(creationRequest);changed.proposal.project.name='Different';
  await assert.rejects(c.T.applyCompanionWork(changed),/companion-work-conflict/);
  M.deleteTask(c.T.store.data,c.T.store.data.tasks[0].id);c.T.touch();
  await c.T.applyCompanionWork(creationRequest);assert.equal(c.T.store.data.tasks.length,0,'a used request never resurrects deleted tasks');
});
test('desktop saves preserve references retained by existing editors', async () => {
  const initial = S.empty(); M.addTask(initial, { title: 'first' });
  const { T } = client(initial, async () => ({ ok: true, json: async () => ({ ok: true }) })); await T.ready;
  const ws = T.store.data, task = ws.tasks[0];
  task.title = 'edit one'; T.touch(); T.saveNow(); await settle();
  assert.equal(T.store.data, ws); assert.equal(T.store.data.tasks[0], task);
  M.updateTask(ws, task.id, { title: 'edit two' }); T.touch(); T.saveNow(); await settle();
  assert.equal(T.store.data.tasks[0].title, 'edit two'); assert.equal(T.store.dirty, false);
});
test('in-flight local changes retain a recoverable draft until the final local save succeeds', async () => {
  const initial = S.empty(); M.addTask(initial, { title: 'first' });
  let finish;
  const { T, storage } = client(initial, () => new Promise(resolve => { finish = () => resolve({ ok: true, json: async () => ({ ok: true }) }); }));
  await T.ready; T.store.data.tasks[0].title = 'saved'; T.touch(); T.saveNow();
  T.store.data.tasks[0].notes = 'typed during save'; T.touch(); finish(); await settle();
  assert.equal(T.store.data.tasks[0].notes, 'typed during save'); assert.equal(T.store.dirty, true);
  assert.equal(JSON.parse(storage.get('tracer.workspaceDraft')).data.tasks[0].notes, 'typed during save');
  T.saveNow(); finish(); await settle();
  assert.equal(T.store.dirty, false); assert.equal(storage.has('tracer.workspaceDraft'), false);
});
function legacyFixture() {
  const base = S.empty(); base.meta.syncAccount = 'former-account'; M.addTask(base, { title: 'original title' });
  const data = S.clone(base), disk = S.clone(base); data.tasks[0].title = 'unsent title'; disk.tasks[0].notes = 'saved local notes';
  const raw = JSON.stringify({ base, data });
  return { base, data, disk, raw, storage: new Map([['tracer.cloudDraft', raw]]) };
}
const success = async () => ({ ok: true, json: async () => ({ ok: true }) });

test('old unsent draft merges independent local edits, survives failed PUT and reload, and clears only after local save', async () => {
  const f = legacyFixture();
  const first = client(f.disk, async () => ({ ok: false, status: 500, json: async () => ({ error: 'disk-full' }) }), { storage: f.storage });
  await first.T.ready;
  assert.equal(first.T.store.data.tasks[0].title, 'unsent title'); assert.equal(first.T.store.data.tasks[0].notes, 'saved local notes');
  assert.equal(f.storage.get('tracer.cloudDraft'), f.raw, 'recovering data does not prematurely delete its source');
  first.T.saveNow(); await settle();
  assert.equal(first.T.store.dirty, true); assert.equal(f.storage.get('tracer.cloudDraft'), f.raw);
  assert.equal(first.requests.filter(request => request.input).length, 1, 'a failed save does not enter a retry loop');
  const second = client(f.disk, success, { storage: f.storage }); await second.T.ready;
  assert.equal(second.T.store.data.tasks[0].title, 'unsent title'); assert.equal(second.T.store.data.tasks[0].notes, 'saved local notes');
  second.T.saveNow(); await settle();
  assert.equal(second.T.store.dirty, false); assert.equal(f.storage.has('tracer.cloudDraft'), false); assert.equal(f.storage.has('tracer.workspaceDraft'), false);
});

test('legacy same-field conflicts wait for an explicit local recovery choice and cannot escape through beacon', async () => {
  const f = legacyFixture(); f.disk.tasks[0].title = 'saved disk title';
  const c = client(f.disk, success, { storage: f.storage }); await c.T.ready;
  assert.ok(c.T.store.conflict); assert.match(c.elements.get('save-dot').title, /Draft conflicts/);
  c.T.saveNow(); c.listeners.beforeunload(); await settle();
  assert.equal(c.requests.filter(request => request.input).length, 0); assert.equal(c.beacons.length, 0);
  assert.equal(c.storage.get('tracer.cloudDraft'), f.raw);
  assert.equal(c.T.resolveDraft({}), false);
  const conflict = S.merge(c.T.store.base, c.T.store.data, c.T.store.conflict).conflicts[0];
  assert.equal(c.T.resolveDraft({ [conflict.key]: 'remote' }), true); await settle();
  assert.equal(c.T.store.data.tasks[0].title, 'saved disk title'); assert.equal(c.T.store.data.tasks[0].notes, 'saved local notes');
  assert.equal(c.T.store.conflict, null); assert.equal(c.storage.has('tracer.cloudDraft'), false);
});

test('unmatched or corrupt legacy drafts stay byte-for-byte intact without contaminating local work', async () => {
  for (const corrupt of [false, true]) {
    const f = legacyFixture(); if (!corrupt) f.disk.meta.syncAccount = 'different-account';
    const original = corrupt ? '{not valid JSON' : f.raw; f.storage.set('tracer.cloudDraft', original);
    const c = client(f.disk, success, { storage: f.storage }); await c.T.ready;
    assert.equal(c.T.store.data.tasks[0].title, 'original title'); assert.equal(c.T.store.dirty, false);
    assert.match(c.elements.get('save-dot').title, /original contents are kept/);
    c.T.store.data.tasks[0].title = 'new local edit'; c.T.touch(); c.T.saveNow(); await settle();
    assert.equal(c.storage.get('tracer.cloudDraft'), original);
  }
});

test('successful recovery never deletes a legacy source changed by another window', async () => {
  const f = legacyFixture(), c = client(f.disk, success, { storage: f.storage }); await c.T.ready;
  const changed = JSON.stringify({ base: f.base, data: { ...f.data, notes: [{ id: 'other-note', title: 'Another window', body: 'Keep me' }] } });
  c.storage.set('tracer.cloudDraft', changed); c.T.saveNow(); await settle();
  assert.equal(c.storage.get('tracer.cloudDraft'), changed); assert.equal(c.storage.has('tracer.workspaceDraft'), false);
});

test('an older in-flight save neither overwrites nor removes another window’s newer local draft', async () => {
  const initial = S.empty(); M.addTask(initial, { title: 'before' });
  let finish;
  const c = client(initial, () => new Promise(resolve => { finish = () => resolve({ ok: true, json: async () => ({ ok: true }) }); })); await c.T.ready;
  c.T.store.data.tasks[0].title = 'this window'; c.T.touch(); c.T.saveNow();
  const other = S.clone(initial); other.tasks[0].title = 'other window unsaved';
  const newer = JSON.stringify({ base: initial, data: other }); c.storage.set('tracer.workspaceDraft', newer);
  finish(); await settle();
  assert.equal(c.T.store.dirty, false); assert.equal(c.storage.get('tracer.workspaceDraft'), newer);
  assert.match(c.elements.get('save-dot').title, /Another window/);
  c.T.store.data.tasks[0].notes = 'a later local edit'; c.T.touch();
  assert.equal(c.storage.get('tracer.workspaceDraft'), newer, 'later touches still preserve the foreign pending draft');
});

test('ordinary local drafts recover independent edits without any retired account metadata', async () => {
  const base = S.empty(); M.addTask(base, { title: 'before' });
  const pending = S.clone(base), disk = S.clone(base); pending.tasks[0].title = 'pending'; disk.tasks[0].notes = 'new saved notes';
  const storage = new Map([['tracer.workspaceDraft', JSON.stringify({ base, data: pending })]]);
  const c = client(disk, success, { storage }); await c.T.ready;
  assert.equal(c.T.store.data.tasks[0].title, 'pending'); assert.equal(c.T.store.data.tasks[0].notes, 'new saved notes');
  c.T.saveNow(); await settle(); assert.equal(c.storage.has('tracer.workspaceDraft'), false);
});

test('failed and readonly local saves retain drafts, while old account metadata no longer disables unload protection', async () => {
  for (const status of [403, 500]) {
    const initial = S.empty(); initial.meta.syncAccount = 'retired-account'; M.addTask(initial, { title: 'before' });
    const c = client(initial, async () => ({ ok: false, status, json: async () => ({ error: status === 403 ? 'readonly' : 'disk-full' }) })); await c.T.ready;
    c.T.store.data.tasks[0].title = 'unsaved local edit'; c.T.touch(); c.T.saveNow(); await settle();
    assert.equal(c.T.store.dirty, true); assert.equal(JSON.parse(c.storage.get('tracer.workspaceDraft')).data.tasks[0].title, 'unsaved local edit');
    c.listeners.beforeunload(); assert.equal(c.beacons.length, 1); assert.equal(c.beacons[0].url, '/api/store/workspace');
    assert.equal(c.beacons[0].data.tasks[0].title, 'unsaved local edit');
    assert.equal(c.T.refreshCloud, undefined); assert.equal(c.T.importCloud, undefined); assert.equal(c.T.resolveCloud, undefined);
    assert.ok(c.requests.every(request => request.url === '/api/store/workspace'));
    assert.ok(c.requests.filter(request => request.input).every(request => !('x-tracer-sync' in request.input.headers)));
    assert.equal(c.intervals.includes(15000), false, 'no background cloud polling remains');
  }
});

test('an unreadable local draft is retained even when new edits fail to save', async () => {
  const initial = S.empty(); M.addTask(initial, { title: 'local title' });
  const storage = new Map([['tracer.workspaceDraft', 'broken original draft']]);
  const c = client(initial, async () => ({ ok: false, status: 500, json: async () => ({ error: 'disk-full' }) }), { storage }); await c.T.ready;
  c.T.store.data.tasks[0].title = 'new edit'; c.T.touch(); c.T.saveNow(); await settle();
  assert.equal(storage.get('tracer.workspaceDraft'), 'broken original draft');
});

test('failed initial local load locks all saves and keeps recovery storage intact', async () => {
  const f = legacyFixture(), c = client(f.disk, success, { storage: f.storage, loadFailure: true }); await c.T.ready;
  c.T.touch(); c.T.saveNow(); c.listeners.beforeunload(); await settle();
  assert.equal(c.T.store.lost, true); assert.equal(c.T.store.data, null);
  assert.equal(c.requests.filter(request => request.input).length, 0); assert.equal(c.beacons.length, 0); assert.equal(c.storage.get('tracer.cloudDraft'), f.raw);
});
