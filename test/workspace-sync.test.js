'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/workspace-sync');
const M = require('../skins/tracer/model');
const Work = require('../public/companion-work');

test('creation receipts survive workspace normalization, merge and deletion without accepting contradictory operations',()=>{
  const request='f623b4d1-79de-4cad-ae76-d5523a54dacf';
  const proposal={type:'tasks',project:null,tasks:[{title:'Keep one',notes:'',due:null,scheduled:null,priority:'medium',estimate:null,checklist:[]}]};
  const base=M.emptyWorkspace(),local=Work.apply(base,proposal,request,M).workspace;
  const normalized=S.validate(local);assert.deepEqual(normalized.meta.companionReceipts,local.meta.companionReceipts);
  const merged=S.merge(base,local,base).workspace;assert.deepEqual(merged.meta.companionReceipts,local.meta.companionReceipts);
  const deleted=S.clone(merged);M.deleteTask(deleted,deleted.tasks[0].id);
  assert.equal(Work.apply(S.merge(merged,deleted,merged).workspace,proposal,request,M).workspace.tasks.length,0);
  const contradictory=Work.apply(base,{...proposal,tasks:[{...proposal.tasks[0],title:'Different'}]},request,M).workspace;
  assert.throws(()=>S.merge(base,local,contradictory),/companion-work-conflict/);
});

test('independent workspace edits merge including additions and deletes', () => {
  const base = M.emptyWorkspace(); const t = M.addTask(base, { title: 'original' });
  const a = S.clone(base), b = S.clone(base);
  M.updateTask(a, t.id, { title: 'from desktop' }); M.updateTask(b, t.id, { due: '2026-10-01' });
  M.addTask(a, { title: 'first editor new' }); M.addTask(b, { title: 'second editor new' });
  const result = S.merge(base, a, b);
  assert.equal(result.conflicts.length, 0); assert.equal(result.workspace.tasks.length, 3);
  assert.equal(result.workspace.tasks[0].title, 'from desktop'); assert.equal(result.workspace.tasks[0].due, '2026-10-01');
  const deleted = S.clone(base); M.deleteTask(deleted, t.id);
  assert.equal(S.merge(base, deleted, base).workspace.tasks.length, 0);
});
test('same-field and edit/delete conflicts require explicit choices', () => {
  const base = M.emptyWorkspace(), t = M.addTask(base, { title: 'original' });
  const a = S.clone(base), b = S.clone(base);
  a.tasks[0].title = 'local'; b.tasks[0].title = 'remote';
  let result = S.merge(base, a, b); assert.equal(result.conflicts.length, 1);
  result = S.merge(base, a, b, { [result.conflicts[0].key]: 'remote' });
  assert.equal(result.conflicts.length, 0); assert.equal(result.workspace.tasks[0].title, 'remote');
  M.deleteTask(b, t.id); result = S.merge(base, a, b);
  assert.equal(result.conflicts.length, 1);
  assert.equal(S.merge(base, a, b, { [result.conflicts[0].key]: 'remote' }).workspace.tasks.length, 0);
});
test('status and completion timestamp merge atomically; concurrent new sequence IDs are unique', () => {
  const base = M.emptyWorkspace(); M.addTask(base, { title: 'existing' });
  const a = S.clone(base), b = S.clone(base);
  M.moveTask(a, a.tasks[0].id, 'done', null); b.tasks[0].notes = 'note';
  const added = M.addTask(a, { title: 'a' }); M.addTask(b, { title: 'b' });
  const result = S.assignSequences(S.merge(base, a, b).workspace, b);
  assert.equal(result.tasks[0].status, 'done'); assert.ok(result.tasks[0].doneAt); assert.equal(result.tasks[0].notes, 'note');
  assert.equal(new Set(result.tasks.map(t => t.seq)).size, 3);
  assert.notEqual(result.tasks.find(t => t.id === added.id).seq, b.tasks[1].seq);
});
test('workspace validation rejects invalid status, duplicate IDs and impossible dates', () => {
  const ws = S.empty(); M.addTask(ws, { title: 'valid' });
  assert.doesNotThrow(() => S.validate(ws));
  const bad = S.clone(ws); bad.tasks[0].due = '2026-02-30'; assert.throws(() => S.validate(bad));
  bad.tasks[0].due = null; bad.tasks[0].status = 'oops'; assert.throws(() => S.validate(bad));
  bad.tasks[0].status = 'todo'; bad.tasks.push(S.clone(bad.tasks[0])); assert.throws(() => S.validate(bad));
  const injection = S.clone(ws); injection.projects = [{ id: 'p', name: 'x', color: 'red\" onclick=bad' }];
  assert.equal(S.validate(injection).projects[0].color, '#7c8fe8');
});
