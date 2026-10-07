'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const A = require('../skins/tracer/insights-model');
const H = require('../skins/tracer/task-history');
const time = (date, hour = 12) => new Date(date + 'T' + String(hour).padStart(2, '0') + ':00:00').getTime();
const one = time('2026-09-01'), two = time('2026-09-02'), three = time('2026-09-03');
function workspace(tasks = []) { return { tasks, projects: [{ id: 'p', name: 'Project P', status: 'active' }, { id: 'q', name: 'Project Q', status: 'completed' }], notes: [], inbox: [], completionHistory: [] }; }
function task(id, projectId = 'p', extra = {}) { return { id, title: 'Task ' + id, projectId, status: 'todo', ...extra }; }
function session(id, taskId, projectId, minutes = 25, endedAt = one) { return { id, minutes, endedAt, task: taskId ? { id: taskId, title: 'Task ' + taskId, ...(projectId === undefined ? {} : { projectId }) } : null }; }
function completion(ws, id, projectId, completedAt = one) { H.record(ws, task(id, projectId, { status: 'done', doneAt: completedAt })); return ws.completionHistory.find(row => row.taskId === id && row.completedAt === completedAt); }
function deepFreeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }

test('analyze applies project and inclusive local dates to focus while history search stays independent', () => {
  const ws = workspace([task('a'), task('b', 'q')]); completion(ws, 'a', 'p');
  const focus = { history: [session('one', 'a', 'p', 10, one), session('two', 'b', 'q', 20, one), session('three', 'a', 'p', 30, two)] };
  const result = A.analyze(ws, { project: 'p', from: '2026-09-01', to: '2026-09-01', today: '2026-09-03', query: 'no matches' }, focus);
  assert.equal(result.rows.length, 0); assert.equal(result.focusCount, 1); assert.equal(result.focusMinutes, 10); assert.equal(result.focusDirectCount, 1);
  assert.equal(A.analyze(ws, { project: 'q', today: '2026-09-03' }, focus).focusMinutes, 20);
  assert.equal(A.analyze(ws, { today: '2026-09-03' }, focus).focusMinutes, 60);
});

test('explicit session ownership, including null and empty project, outranks a migrated current task', () => {
  const ws = workspace([task('moved', 'q', { estimate: 1 })]);
  const focus = { history: [session('old', 'moved', 'p', 10), session('none', 'moved', null, 20), session('empty', 'moved', '', 30), session('current', 'moved', 'q', 40)] };
  const p = A.projectReview(ws, 'p', focus), q = A.projectReview(ws, 'q', focus);
  assert.equal(p.focus.minutes, 10); assert.equal(p.focus.directCount, 1); assert.equal(p.current.total, 0); assert.equal(p.comparison, null);
  assert.equal(q.focus.minutes, 40); assert.equal(q.focus.inferredCount, 0); assert.equal(q.focus.unassignedCount, 2);
  assert.equal(q.comparison.focusMinutes, 40); assert.equal(q.comparison.estimateMinutes, 60);
});

test('legacy sessions infer current project or the sole retained completion project for a cleared task', () => {
  const ws = workspace([task('current', 'q')]);
  completion(ws, 'current', 'p'); completion(ws, 'cleared', 'p'); completion(ws, 'cleared', 'p', two);
  const focus = { history: [session('current-old', 'current', undefined, 11), session('cleared-old', 'cleared', undefined, 13)] };
  const p = A.projectReview(ws, 'p', focus), q = A.projectReview(ws, 'q', focus);
  assert.equal(p.focus.minutes, 13); assert.equal(p.focus.inferredCount, 1); assert.equal(p.focus.directCount, 0);
  assert.equal(q.focus.minutes, 11); assert.equal(q.focus.inferredCount, 1);
  assert.ok(p.warnings.includes('focus-project-inferred')); assert.equal(p.completions.clearedCount, 1);
});

test('ambiguous cleared-task history and malformed explicit project metadata never guess a project', () => {
  const ws = workspace([task('current')]);
  completion(ws, 'ambiguous', 'p'); completion(ws, 'ambiguous', 'q', two);
  const focus = { history: [session('ambiguous', 'ambiguous', undefined), session('unknown', 'missing', undefined), session('invalid-explicit', 'current', 123), session('unbound', null, undefined)] };
  const p = A.projectReview(ws, 'p', focus), q = A.projectReview(ws, 'q', focus);
  assert.equal(p.focus.sessionCount, 0); assert.equal(q.focus.sessionCount, 0); assert.equal(p.focus.unassignedCount, 4);
  assert.equal(A.analyze(ws, { today: '2026-09-03' }, focus).focusCount, 4);
});

test('repeated completion events count one retained task; cleared count is distinct from moved cards', () => {
  const ws = workspace([task('current', 'p', { status: 'done', doneAt: three }), task('moved', 'q')]);
  completion(ws, 'current', 'p', one); completion(ws, 'current', 'p', two);
  completion(ws, 'cleared', 'p', one); completion(ws, 'cleared', 'p', two); completion(ws, 'moved', 'p', one);
  const cancelled = completion(ws, 'cancelled', 'p', one); H.undo(ws, cancelled.taskId, cancelled.completedAt);
  const review = A.projectReview(ws, 'p', { history: [] });
  assert.deepEqual(review.current, { total: 1, done: 1, remaining: 0 });
  assert.deepEqual(review.completions, { uniqueCount: 3, clearedCount: 1, eventCount: 6 });
  assert.ok(review.warnings.includes('cleared-task-hours-unavailable')); assert.equal(review.estimate.filledCount, 0);
});

test('estimate and spent totals are separate, numeric zero is valid and null/empty/bad numbers are missing', () => {
  const ws = workspace([
    task('zero', 'p', { estimate: 0, spent: 0 }), task('normal', 'p', { estimate: 1.5, spent: 2, status: 'done' }),
    task('null', 'p', { estimate: null, spent: null }), task('string', 'p', { estimate: '', spent: '3' }),
    task('invalid', 'p', { estimate: -1, spent: Infinity }), task('nan', 'p', { estimate: NaN, spent: -2 }),
    task('foreign', 'q', { estimate: 100, spent: 200 })
  ]);
  const review = A.projectReview(ws, 'p', { history: [session('timer', 'normal', 'p', 30)] });
  assert.deepEqual(review.estimate, { hours: 1.5, filledCount: 2 }); assert.deepEqual(review.spent, { hours: 2, filledCount: 2 });
  assert.equal(review.focus.minutes, 30); assert.equal(review.spent.hours, 2);
  assert.deepEqual(review.current, { total: 6, done: 1, remaining: 5 });
});

test('comparison uses only matching existing estimated tasks and their recorded project sessions', () => {
  const ws = workspace([
    task('matched', 'p', { estimate: 1, spent: 9 }), task('zero', 'p', { estimate: 0 }), task('no-focus', 'p', { estimate: 7 }),
    task('no-estimate', 'p', { estimate: null }), task('moved', 'q', { estimate: 9 })
  ]);
  completion(ws, 'cleared', 'p');
  const focus = { history: [session('match1', 'matched', 'p', 20), session('match2', 'matched', 'p', 30), session('zero', 'zero', 'p', 10),
    session('unestimated', 'no-estimate', 'p', 50), session('cleared', 'cleared', 'p', 40), session('old-move', 'moved', 'p', 25), session('other-project', 'matched', 'q', 80)] };
  const review = A.projectReview(ws, 'p', focus);
  assert.deepEqual(review.comparison, { matchedTaskCount: 2, estimateMinutes: 60, focusMinutes: 60, deltaMinutes: 0 });
  assert.equal(review.focus.minutes, 175); assert.equal(review.estimate.hours, 8); assert.equal(review.spent.hours, 9);
  assert.equal(A.projectReview(workspace([task('unmatched', 'p', { estimate: 0 })]), 'p', focus).comparison, null);
});

test('project review uses all retained history regardless of an insights search, period or archived status', () => {
  const ws = workspace([task('archived', 'q', { estimate: 2, status: 'done', doneAt: one })]);
  const focus = { history: [session('early', 'archived', 'q', 25, one), session('late', 'archived', 'q', 35, three)] };
  const review = A.projectReview(ws, 'q', focus);
  A.analyze(ws, { project: 'p', from: '2026-09-02', to: '2026-09-02', query: 'nothing', today: '2026-09-03' }, focus);
  assert.deepEqual(A.projectReview(ws, 'q', focus), review);
  assert.equal(review.focus.minutes, 60); assert.equal(review.focus.firstEndedAt, one); assert.equal(review.focus.lastEndedAt, three);
  assert.equal(review.comparison.deltaMinutes, -60); assert.equal(ws.projects[1].status, 'completed');
});

test('identical duplicate sessions are counted once and conflicting duplicate identities are discarded', () => {
  const ws = workspace([task('a')]), row = session('duplicate', 'a', 'p', 20);
  const focus = { history: [row, { ...row }, session('conflict', 'a', 'p', 15), session('conflict', 'a', 'q', 15)] };
  const review = A.projectReview(ws, 'p', focus);
  assert.equal(review.focus.sessionCount, 1); assert.equal(review.focus.minutes, 20); assert.ok(review.warnings.includes('focus-invalid-records'));
  assert.equal(A.analyze(ws, { today: '2026-09-03' }, focus).focusCount, 1);
});

test('500-session cap and lifetime total larger than retained sum disclose limits without allocating missing time', () => {
  const ws = workspace([task('a'), task('b', 'q')]);
  const history = Array.from({ length: 500 }, (_, i) => session('s' + i, i % 2 ? 'b' : 'a', i % 2 ? 'q' : 'p', 1, one + i));
  const focus = { history, totalMinutes: 800 }, review = A.projectReview(ws, 'p', focus);
  assert.equal(review.focus.sessionCount, 250); assert.equal(review.focus.minutes, 250); assert.equal(review.focus.limited, true);
  assert.deepEqual(review.focus.limitReasons, ['history-cap', 'total-exceeds-retained']);
  const onlyGlobal = A.projectReview(ws, 'p', { history: [session('p', 'a', 'p', 10), session('q', 'b', 'q', 30)], totalMinutes: 40 });
  assert.equal(onlyGlobal.focus.limited, false);
  const missing = A.projectReview(ws, 'p', { history: [], totalMinutes: 25 });
  assert.equal(missing.focus.minutes, 0); assert.equal(missing.focus.firstEndedAt, null); assert.equal(missing.focus.limited, true);
});

test('malformed retained records are ignored and an unfinished timer never adds a session', () => {
  const ws = workspace([task('a', 'p', { estimate: 1 })]);
  ws.completionHistory = [null, {}, { id: 'bad', kind: 'completed', completedAt: NaN }, completion(workspace(), 'valid-cleared', 'p')];
  ws.tasks.push(null, { id: 'bad-task', status: 'wrong' }, task('unknown-date', 'p', { status: 'done', doneAt: Infinity }));
  const focus = { running: true, runId: 'in-flight', endAt: 1, duration: 60000, history: [null, {}, session('', 'a', 'p'), session('negative', 'a', 'p', -1),
    session('zero', 'a', 'p', 0), session('infinite', 'a', 'p', Infinity), session('oversized', 'a', 'p', 100000), session('text', 'a', 'p', '25'),
    session('bad-time', 'a', 'p', 25, NaN), session('outside-date', 'a', 'p', 25, 8640000000000001), session('valid', 'a', 'p', 5)] };
  const review = A.projectReview(ws, 'p', focus);
  assert.equal(review.focus.sessionCount, 1); assert.equal(review.focus.minutes, 5); assert.equal(review.completions.uniqueCount, 1);
  assert.equal(review.current.total, 2); assert.ok(review.warnings.includes('focus-invalid-records')); assert.equal(focus.running, true);
  assert.equal(A.analyze(ws, { project: 'p', today: '2026-09-03' }, focus).unknown, 1);
  assert.equal(A.projectReview(ws, 'p', { history: [session('maximum-valid', 'a', 'p', 180)] }).focus.minutes, 180);
});

test('empty inputs have absent coverage endpoints and comparison, and all APIs leave frozen inputs unchanged', () => {
  const empty = A.projectReview(null, 'p', null);
  assert.deepEqual(empty.current, { total: 0, done: 0, remaining: 0 }); assert.equal(empty.comparison, null);
  assert.equal(empty.focus.firstEndedAt, null); assert.equal(empty.focus.lastEndedAt, null); assert.equal(empty.estimate.filledCount, 0);
  const ws = workspace([task('a', 'p', { estimate: 0, spent: 0, status: 'done', doneAt: one })]); completion(ws, 'cleared', 'p');
  const focus = { history: [session('legacy', 'a', undefined, 10)], totalMinutes: 10 };
  const before = JSON.stringify({ ws, focus }); deepFreeze(ws); deepFreeze(focus);
  A.projectReview(ws, 'p', focus); A.analyze(ws, { today: '2026-09-03' }, focus);
  assert.equal(JSON.stringify({ ws, focus }), before); assert.equal(Object.hasOwn(focus.history[0].task, 'projectId'), false);
  assert.equal(A.projectReview(ws, null, focus).current.total, 0); assert.equal(A.projectReview(ws, null, focus).focus.sessionCount, 0);
});
