'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const W = require('../public/companion-work');
const M = require('../skins/tracer/model');
const Deletion = require('../public/project-deletion');

const requestId = 'f623b4d1-79de-4cad-ae76-d5523a54dacf';
const uuid = n => n.toString(16).padStart(8, '0') + '-79de-4cad-ae76-d5523a54dacf';
const clone = value => JSON.parse(JSON.stringify(value));
const task = overrides => ({ title: 'Write the summary', notes: '', due: null, scheduled: null, priority: 'medium', estimate: null, checklist: [], ...overrides });
const tasks = entries => ({ type: 'tasks', project: null, tasks: entries || [task()] });
const project = entries => ({ type: 'project', project: { name: 'Release planning', notes: 'Keep the scope small.', start: null, end: null }, tasks: entries || [] });
const error = code => value => value instanceof Error && value.code === code && value.message === code;
const receipt = (id, proposal = tasks()) => ({ requestId: id, signature: W.signature(proposal), projectId: proposal.type === 'project' ? 'cw_p_' + id : null,
  taskIds: proposal.tasks.map((_, index) => 'cw_t_' + id + '_' + index), noteId: proposal.type === 'project' ? 'cw_n_' + id : null });

test('normalization allows an unscheduled standalone task or a project without tasks and makes defensive copies', () => {
  const raw = tasks([task({ title: '  整理需求  ', notes: '  First line\n\tNext line  ', checklist: [' First ', 'Second'] })]);
  const normalized = W.normalize(raw);
  assert.equal(normalized.tasks[0].title, '整理需求');
  assert.equal(normalized.tasks[0].notes, 'First line\n\tNext line');
  assert.equal(normalized.tasks[0].estimate, null);
  assert.equal(normalized.tasks[0].scheduled, null);
  assert.equal(normalized.tasks[0].due, null);
  normalized.tasks[0].checklist.push('Third');
  assert.deepEqual(raw.tasks[0].checklist, [' First ', 'Second']);
  assert.deepEqual(W.normalize(project()), project());
  assert.equal(W.normalize(tasks([task({ estimate: 0 })])).tasks[0].estimate, 0);
  assert.equal(W.normalize(tasks([task({ estimate: 0.25 })])).tasks[0].estimate, 0.25);
});

test('proposal validation rejects malformed fields, unknown keys, sparse arrays and excessive content', () => {
  const malformed = [null, {}, [], { ...tasks(), reply: 'Untrusted' }, { ...tasks(), type: 'note' }, { ...tasks(), project: project().project },
    { ...project(), project: null }, tasks([]), tasks(new Array(1)), tasks(Array.from({ length: 21 }, () => task())),
    tasks([task({ owner: 'AI' })]), tasks([task({ title: ' ' })]), tasks([task({ title: 'x'.repeat(201) })]),
    tasks([task({ title: 'a\nb' })]), tasks([task({ notes: 'bad\u0000note' })]), tasks([task({ notes: 'x'.repeat(4001) })]),
    tasks([task({ priority: 'critical' })]), tasks([task({ checklist: new Array(1) })]), tasks([task({ checklist: [''] })]),
    tasks([task({ checklist: Array(21).fill('entry') })]), tasks([task({ checklist: ['x'.repeat(201)] })]),
    { ...project(), project: { ...project().project, name: 'x'.repeat(121) } },
    { ...project(), project: { ...project().project, notes: 'x'.repeat(8001) } }];
  for (const estimate of [-1, 1000.01, Infinity, NaN, '2', undefined]) malformed.push(tasks([task({ estimate })]));
  for (const key of Object.keys(task())) { const row = task(); delete row[key]; malformed.push(tasks([row])); }
  for (const value of malformed) assert.throws(() => W.normalize(value), error('invalid-companion-work'));
});

test('calendar dates must be real, chronological and inside declared project bounds', () => {
  for (const due of ['2025-02-29', '2026-04-31', '0000-01-01', '2026-1-01', '2026-09-17T00:00:00Z', '', 0]) {
    assert.throws(() => W.normalize(tasks([task({ due })])), error('invalid-companion-work'));
  }
  assert.equal(W.normalize(tasks([task({ scheduled: '2024-02-29', due: '2024-02-29' })])).tasks[0].due, '2024-02-29');
  assert.throws(() => W.normalize(tasks([task({ scheduled: '2026-09-20', due: '2026-09-19' })])), error('invalid-companion-work'));
  const bounded = project([task({ scheduled: '2026-09-17', due: '2026-09-20' })]);
  bounded.project.start = '2026-09-17'; bounded.project.end = '2026-09-20';
  assert.deepEqual(W.normalize(bounded), bounded);
  for (const [field, value] of [['scheduled', '2026-09-16'], ['due', '2026-09-21']]) {
    const invalid = clone(bounded); invalid.tasks[0][field] = value;
    assert.throws(() => W.normalize(invalid), error('invalid-companion-work'));
  }
  const reversed = project(); reversed.project.start = '2026-09-20'; reversed.project.end = '2026-09-17';
  assert.throws(() => W.normalize(reversed), error('invalid-companion-work'));
});

test('schema uses explicit required fields and no additional object properties, with browser/CommonJS parity', () => {
  let objects = 0;
  function check(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') { objects++; assert.equal(node.additionalProperties, false); assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort()); }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(check); else check(value);
  }
  check(W.schema); assert.equal(objects, 3);
  const context = vm.createContext({ TextEncoder });
  vm.runInContext(fs.readFileSync(require.resolve('../public/companion-work'), 'utf8'), context);
  assert.equal(context.TracerCompanionWork.signature(tasks()), W.signature(tasks()));
  assert.deepEqual(clone(context.TracerCompanionWork.normalize(project())), project());
  assert.deepEqual(clone(context.TracerCompanionWork.schema), W.schema);
});

test('SHA-256 matches standard vectors and UTF-8, while proposal signatures use canonical fields', () => {
  const vectors = new Map([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1']
  ]);
  for (const [input, digest] of vectors) assert.equal(W.sha256(input), digest);
  for (const input of ['伙伴🐱工作计划', 'a'.repeat(1000), '\ud800']) assert.equal(W.sha256(input), createHash('sha256').update(input).digest('hex'));
  const a = tasks(), b = { tasks: [Object.fromEntries(Object.entries(task()).reverse())], project: null, type: 'tasks' };
  b.tasks[0].title = '  ' + b.tasks[0].title + '  ';
  assert.equal(W.signature(a), W.signature(b));
  b.tasks[0].notes = 'A meaningful change';
  assert.notEqual(W.signature(a), W.signature(b));
});

test('apply creates ordinary todo tasks with deterministic IDs without mutating existing work or history', () => {
  const base = M.emptyWorkspace();
  const original = M.addTask(base, { title: 'Already completed', status: 'done', due: '2026-09-17' });
  base.inbox.push({ id: 'inbox-old', title: 'Keep me' });
  base.projectDeletions = [{ id: 'removed-project', taskIds: ['removed-task'] }];
  base.meta.custom = { unchanged: true };
  const before = clone(base);
  const proposal = tasks([task({ checklist: ['Review facts'], priority: 'high' }), task({ title: 'Draft next step', estimate: 2.5 })]);
  const result = W.apply(base, proposal, requestId, M);
  assert.deepEqual(base, before);
  assert.equal(result.duplicate, false); assert.equal(result.projectId, null); assert.equal(result.noteId, null);
  assert.deepEqual(result.taskIds, ['cw_t_' + requestId + '_0', 'cw_t_' + requestId + '_1']);
  assert.equal(result.workspace.tasks[1].seq, 'TRC-2'); assert.equal(result.workspace.meta.seqCounter, 3);
  assert.equal(result.workspace.tasks[1].status, 'todo'); assert.equal(result.workspace.tasks[1].projectId, null);
  assert.equal(result.workspace.tasks[1].due, null); assert.equal(result.workspace.tasks[1].estimate, null);
  assert.deepEqual(result.workspace.tasks[1].checklist, [{ id: 'cw_c_' + requestId + '_0_0', text: 'Review facts', done: false }]);
  assert.deepEqual(result.workspace.tasks[0], original);
  for (const key of ['inbox', 'completionHistory', 'projectDeletions']) assert.deepEqual(result.workspace[key], before[key]);
  assert.deepEqual(result.workspace.meta.custom, before.meta.custom);
  assert.deepEqual(result.workspace.meta.companionReceipts, [receipt(requestId, proposal)]);
  result.workspace.meta.custom.unchanged = false;
  assert.equal(base.meta.custom.unchanged, true);
});

test('project creation links tasks and a description note and permits zero tasks', () => {
  const proposal = project([task({ scheduled: '2026-09-18', due: '2026-09-19' })]);
  proposal.project.start = '2026-09-17'; proposal.project.end = '2026-09-20';
  const result = W.apply(M.emptyWorkspace(), proposal, requestId, M);
  assert.equal(result.workspace.projects[0].id, result.projectId);
  assert.equal(result.workspace.projects[0].start, '2026-09-17');
  assert.equal(result.workspace.projects[0].end, '2026-09-20');
  assert.equal(result.workspace.projects[0].status, 'active');
  assert.equal(result.workspace.tasks[0].projectId, result.projectId);
  assert.equal(result.workspace.notes[0].id, result.noteId);
  assert.equal(result.workspace.notes[0].projectId, result.projectId);
  assert.equal(result.workspace.notes[0].body, proposal.project.notes);
  const empty = W.apply(M.emptyWorkspace(), project(), uuid(2), M);
  assert.equal(empty.workspace.tasks.length, 0); assert.equal(empty.workspace.notes.length, 1);
  assert.deepEqual(W.validateReceipts(empty.workspace.meta.companionReceipts), [receipt(uuid(2), project())]);
});

test('persisted receipts make reload retries idempotent even after users edit or delete created records', () => {
  const proposal = tasks();
  const first = W.apply(M.emptyWorkspace(), proposal, requestId, M);
  const reloaded = clone(first.workspace);
  reloaded.tasks[0].title = 'User corrected this';
  const edited = W.apply(reloaded, proposal, requestId, M);
  assert.equal(edited.duplicate, true); assert.deepEqual(edited.workspace, reloaded);
  M.deleteTask(reloaded, first.taskIds[0]);
  const deleted = W.apply(reloaded, proposal, requestId, M);
  assert.equal(deleted.duplicate, true); assert.equal(deleted.workspace.tasks.length, 0);
  assert.equal(deleted.workspace.meta.seqCounter, 1);
  const madeProject = W.apply(M.emptyWorkspace(), project([task()]), uuid(2), M);
  const withoutProject = clone(madeProject.workspace); Deletion.remove(withoutProject, madeProject.projectId);
  const retried = W.apply(withoutProject, project([task()]), uuid(2), M);
  assert.equal(retried.duplicate, true); assert.equal(retried.workspace.projects.length, 0);
  assert.equal(retried.workspace.tasks.length, 0); assert.equal(retried.workspace.notes.length, 0);
  assert.deepEqual(retried.workspace.projectDeletions, withoutProject.projectDeletions);
});

test('reusing an operation for another proposal or finding uncommitted records/tombstones is a conflict', () => {
  const completed = W.apply(M.emptyWorkspace(), tasks(), requestId, M).workspace;
  assert.throws(() => W.apply(completed, tasks([task({ title: 'Different' })]), requestId, M), error('companion-work-conflict'));
  const examples = [
    ws => ws.tasks.push({ id: 'cw_t_' + requestId + '_0' }),
    ws => ws.tasks.push({ id: 'cw_t_' + requestId + '_19' }),
    ws => ws.projects.push({ id: 'cw_p_' + requestId }),
    ws => ws.notes.push({ id: 'cw_n_' + requestId }),
    ws => { ws.completionHistory = [{ taskId: 'cw_t_' + requestId + '_0' }]; },
    ws => { ws.completionHistory = [{ taskId: 'other', projectId: 'cw_p_' + requestId }]; },
    ws => { ws.projectDeletions = [{ id: 'cw_p_' + requestId, taskIds: [] }]; },
    ws => { ws.projectDeletions = [{ id: 'old-project', taskIds: ['cw_t_' + requestId + '_19'] }]; }
  ];
  for (const setup of examples) {
    const workspace = M.emptyWorkspace(); setup(workspace); const before = clone(workspace);
    assert.throws(() => W.apply(workspace, tasks(), requestId, M), error('companion-work-conflict'));
    assert.deepEqual(workspace, before);
  }
});

test('receipt validation rejects unknown data, conflicting identities, gaps and duplicate request IDs', () => {
  assert.deepEqual(W.validateReceipts(undefined), []);
  const row = receipt(requestId), output = W.validateReceipts([row]); output[0].taskIds.push('modified');
  assert.deepEqual(row.taskIds, ['cw_t_' + requestId + '_0']);
  const malformed = [null, {}, new Array(1), [row, row], [{ ...row, extra: true }], [{ ...row, signature: 'a'.repeat(63) }],
    [{ ...row, requestId: requestId.toUpperCase() }], [{ ...row, taskIds: [] }], [{ ...row, taskIds: new Array(1) }],
    [{ ...row, taskIds: ['cw_t_' + requestId + '_1'] }], [{ ...row, projectId: 'another' }], [{ ...row, noteId: 'cw_n_' + requestId }]];
  for (const value of malformed) assert.throws(() => W.validateReceipts(value), error('invalid-companion-receipts'));
});

test('receipt merge is an ordered union, rejects contradictions, and never evicts old receipts', () => {
  const a = receipt(uuid(1)), b = receipt(uuid(2), project());
  assert.deepEqual(W.mergeReceipts([b], [a, b]), [a, b]);
  assert.deepEqual(W.mergeReceipts([a, b], [b]), W.mergeReceipts([b], [a, b]));
  assert.throws(() => W.mergeReceipts([a], [{ ...a, signature: '0'.repeat(64) }]), error('companion-work-conflict'));
  assert.throws(() => W.mergeReceipts([a], [receipt(uuid(1), project())]), error('companion-work-conflict'));
  const full = Array.from({ length: 2000 }, (_, index) => receipt(uuid(index)));
  assert.equal(W.mergeReceipts(full, [full[0]]).length, 2000);
  assert.throws(() => W.mergeReceipts(full, [receipt(uuid(2000))]), error('companion-work-limit'));
  assert.throws(() => W.validateReceipts(full.concat(receipt(uuid(2000)))), error('invalid-companion-receipts'));
});

test('full receipt storage allows existing retries but rejects new work without mutating the workspace', () => {
  const workspace = M.emptyWorkspace(); workspace.meta.companionReceipts = Array.from({ length: 2000 }, (_, index) => receipt(uuid(index)));
  const before = clone(workspace);
  assert.equal(W.apply(workspace, tasks(), uuid(0), M).duplicate, true);
  assert.throws(() => W.apply(workspace, tasks(), uuid(2000), M), error('companion-work-limit'));
  assert.deepEqual(workspace, before);
  const fullTasks = M.emptyWorkspace(); fullTasks.tasks = Array.from({ length: 2000 }, (_, index) => ({ id: 'old-' + index }));
  assert.throws(() => W.apply(fullTasks, tasks(), requestId, M), error('companion-work-limit'));
  const overflow = M.emptyWorkspace(); overflow.meta.seqCounter = Number.MAX_SAFE_INTEGER;
  assert.throws(() => W.apply(overflow, tasks(), requestId, M), error('companion-work-limit'));
});

test('invalid request IDs and model failures never mutate the source workspace', () => {
  for (const value of [null, '', requestId.toUpperCase(), requestId.replace('-4cad-', '-1cad-'), requestId.replace('-ae76-', '-7e76-'), '../' + requestId]) {
    assert.equal(W.validRequestId(value), false);
    assert.throws(() => W.apply(M.emptyWorkspace(), tasks(), value, M), error('invalid-companion-request-id'));
  }
  assert.equal(W.validRequestId(requestId), true);
  const workspace = M.emptyWorkspace(), before = clone(workspace), broken = { ...M, addNote() { throw new Error('Storage-independent model failure'); } };
  assert.throws(() => W.apply(workspace, project([task()]), requestId, broken), /model failure/);
  assert.deepEqual(workspace, before);
  for (const field of ['completionHistory', 'projectDeletions']) {
    const malformed = M.emptyWorkspace(); malformed[field] = {};
    assert.throws(() => W.apply(malformed, tasks(), requestId, M), error('invalid-companion-work'));
  }
});
