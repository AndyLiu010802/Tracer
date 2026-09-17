'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const M = require('../skins/tracer/model');
const D = require('../public/project-deletion');
const H = require('../public/task-history');
const S = require('../public/workspace-sync');
const F = require('../skins/tracer/focus-model');
const store = require('../lib/store');

function fixture() {
  const ws = M.emptyWorkspace();
  const project = M.addProject(ws, { name: 'Remove me' });
  const other = M.addProject(ws, { name: 'Remove me' });
  const task = M.addTask(ws, { title: 'Owned task', projectId: project.id, scheduled: '2026-09-20', status: 'done', checklist: [{ text: 'Owned checklist' }], links: ['https://example.com'] });
  const old = M.addTask(ws, { title: 'Previously deleted', projectId: project.id, status: 'done' });
  M.deleteTask(ws, old.id);
  const keep = M.addTask(ws, { title: 'Keep me', projectId: other.id, dependsOn: [task.id] });
  M.addNote(ws, { title: 'Owned note', projectId: project.id });
  M.addNote(ws, { title: 'Keep note', projectId: other.id });
  M.addInbox(ws, 'Unassigned inbox');
  return { ws, project, task, old, keep, other };
}

test('project deletion cascades to tasks, notes and history, and clears external dependencies', () => {
  const { ws, project, task, old, keep, other } = fixture();
  assert.equal(M.deleteProject(ws, project.id), true);
  assert.deepEqual(ws.projects.map(p => p.id), [other.id]);
  assert.deepEqual(ws.tasks.map(t => t.id), [keep.id]);
  assert.deepEqual(keep.dependsOn, []);
  assert.deepEqual(ws.notes.map(n => n.title), ['Keep note']);
  assert.equal(ws.inbox.length, 1);
  assert.deepEqual(H.completed(ws), []);
  assert.deepEqual(new Set(ws.projectDeletions[0].taskIds), new Set([task.id, old.id]));
  const saved = JSON.stringify(ws);
  assert.equal(M.deleteProject(ws, project.id), false);
  assert.equal(M.deleteProject(ws, ''), false);
  assert.equal(JSON.stringify(ws), saved);
});

test('a task moved to another project survives, while its old project snapshots are deleted', () => {
  const { ws, project, other, task } = fixture();
  M.updateTask(ws, task.id, { projectId: other.id });
  M.deleteProject(ws, project.id);
  assert.ok(M.findTask(ws, task.id));
  assert.equal(H.completed(ws).some(h => h.projectId === project.id), false);
});

test('stale merges, concurrent additions and edits cannot restore a deleted project', () => {
  const { ws, project } = fixture();
  const local = S.clone(ws), remote = S.clone(ws);
  M.deleteProject(local, project.id);
  M.addTask(remote, { title: 'Concurrent task', projectId: project.id, status: 'done' });
  M.addNote(remote, { title: 'Concurrent note', projectId: project.id });
  remote.projects[0].name = 'Concurrent rename';
  for (const [a, b] of [[local,remote],[remote,local]]) {
    const result = S.merge(ws, a, b);
    assert.deepEqual(result.conflicts, []);
    const next = S.validate(result.workspace);
    assert.equal(next.projects.length, 1);
    assert.equal(next.tasks.length, 1);
    assert.equal(next.notes.length, 1);
    assert.deepEqual(next.completionHistory, undefined);
    assert.equal(next.projectDeletions[0].taskIds.length, 3);
  }
});

test('disk preservation persists deletion and rejects resurrection by an older client', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracer-project-delete-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const { ws, project } = fixture();
  const stale = S.clone(ws);
  await store.writeStore(dir, 'workspace', JSON.stringify(ws), H.preserve);
  M.deleteProject(ws, project.id);
  await store.writeStore(dir, 'workspace', JSON.stringify(ws), H.preserve);
  await store.writeStore(dir, 'workspace', JSON.stringify(stale), H.preserve);
  const saved = await store.readStore(dir, 'workspace');
  assert.equal(saved.projects.length, 1);
  assert.equal(saved.tasks.length, 1);
  assert.equal(saved.notes.length, 1);
  assert.deepEqual(saved.completionHistory, []);
  assert.equal(saved.projectDeletions[0].id, project.id);
});

test('deletion markers validate IDs and contain no project or task content', () => {
  assert.throws(() => D.validate([{ id: '../project', taskIds: [] }]), /Invalid/);
  assert.throws(() => D.validate([{ id: 'p', taskIds: [null] }]), /Invalid/);
  assert.deepEqual(D.validate([{ id: 'p', taskIds: ['t','t'], name: 'Private name' }]), [{ id: 'p', taskIds: ['t'] }]);
});

test('deleting project tasks clears only their focus history and running timer', () => {
  const state = F.fresh();
  state.task = { id: 'removed', title: 'Remove me' };
  state.history = [{ id: 'one', minutes: 25, task: { id: 'removed' } }, { id: 'two', minutes: 15, task: { id: 'keep' } }];
  state.totalMinutes = 40; state.roundsDone = 2;
  F.start(state, 1000, 'current');
  F.removeTasks(state, new Set(['removed']));
  assert.equal(state.running, false); assert.equal(state.task, null);
  assert.equal(state.totalMinutes, 15); assert.equal(state.roundsDone, 1);
  assert.deepEqual(state.history.map(h => h.id), ['two']);
  F.removeTasks(state, new Set(['removed']));
  assert.equal(state.totalMinutes, 15);
});
