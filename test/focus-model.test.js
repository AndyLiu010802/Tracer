'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../skins/tracer/focus-model');
const D = require('../skins/tracer/daily-content');

test('focus activity survives reading saved data and lifetime minutes count only completed focus', () => {
  const s = F.fresh(); s.activity = { keys: { a: 3, LMB: 2, injected: 999, b: -1 }, clicks: 2, unknown: 4 };
  const restored = F.read(s); assert.deepEqual(restored.activity, { keys: { a: 3, LMB: 2 }, clicks: 2, unknown: 4 });
  F.start(restored, 1000, 'earned'); F.settle(restored, restored.endAt); assert.equal(restored.totalMinutes, 25);
  F.settle(restored, 999999999); assert.equal(restored.totalMinutes, 25);
  F.reset(restored, 'short'); F.start(restored, 2000000, 'break'); F.settle(restored, restored.endAt); assert.equal(restored.totalMinutes, 25);
  assert.equal(F.read({ ...restored, totalMinutes: undefined }).totalMinutes, 25);
});

test('focus clock persists wall-clock deadline through reload and pauses without drift', () => {
  let s = F.fresh(); const start = new Date(2026, 8, 15, 9).getTime();
  F.start(s, start, 'session-one'); assert.equal(F.remaining(s, start + 123000), 1377000);
  s = F.read(JSON.parse(JSON.stringify(s))); assert.equal(F.remaining(s, start + 123000), 1377000);
  F.pause(s, start + 123000); assert.equal(F.remaining(s, start + 999999), 1377000);
  F.start(s, start + 999999, 'unused-id'); assert.equal(s.runId, 'session-one');
  assert.equal(F.settle(s, s.endAt + 30000), true); assert.equal(s.history.length, 1);
  assert.equal(F.settle(s, start + 9999999), false); assert.equal(s.history.length, 1);
});

test('project ownership survives reading, pausing and reloading a focus session without inventing legacy ownership', () => {
  const start = new Date(2026, 8, 18, 9).getTime();
  for (const projectId of ['original-project', null, undefined]) {
    const saved = F.fresh();
    saved.task = { id: 'current-task', title: 'Keep the original association', ...(projectId !== undefined ? { projectId } : {}) };
    saved.history = [{ id: 'legacy-session', endedAt: start - 1000, minutes: 15, task: { id: 'legacy-task', title: 'Old saved work' } }];
    saved.totalMinutes = 15; saved.roundsDone = 1;
    let state = F.read(saved);
    saved.task.projectId = 'changed-in-another-record';
    assert.equal(Object.hasOwn(state.task, 'projectId'), projectId !== undefined);
    assert.equal(state.task.projectId, projectId, 'reading captures a separate task snapshot');
    F.start(state, start, 'one-persistent-session');
    F.pause(state, start + 5 * 60000);
    state = F.read(JSON.parse(JSON.stringify(state)));
    assert.equal(state.running, false); assert.equal(state.remaining, 20 * 60000);
    assert.equal(Object.hasOwn(state.task, 'projectId'), projectId !== undefined);
    assert.equal(state.task.projectId, projectId);
    F.start(state, start + 10 * 60000, 'must-not-replace-the-session');
    assert.equal(state.runId, 'one-persistent-session');
    assert.equal(F.settle(state, state.endAt), true);
    state = F.read(JSON.parse(JSON.stringify(state)));
    assert.equal(state.history.length, 2); assert.equal(state.totalMinutes, 40);
    assert.equal(state.history[1].task.id, 'current-task');
    assert.equal(Object.hasOwn(state.history[1].task, 'projectId'), projectId !== undefined);
    assert.equal(state.history[1].task.projectId, projectId);
    assert.equal(Object.hasOwn(state.history[0].task, 'projectId'), false, 'legacy history never borrows the current task project');
    assert.equal(F.settle(state, start + 24 * 3600000), false); assert.equal(state.history.length, 2);
  }
});

test('sleep completes only the running session and does not fabricate unattended rounds', () => {
  const s = F.fresh(), now = Date.now(); F.start(s, now, 'sleep'); F.settle(s, now + 12 * 3600000);
  assert.equal(s.running, false); assert.equal(s.completed, true); assert.equal(s.history.length, 1); assert.equal(s.roundsDone, 1);
  assert.equal(s.history[0].endedAt, now + 25 * 60000); assert.equal(F.nextMode(s), 'short');
  assert.equal(F.start(s, now + 12 * 3600000, 'duplicate'), false);
});

test('long break follows configured focus rounds; breaks never inflate work statistics', () => {
  const s = F.fresh(); let now = new Date(2026, 8, 15, 9).getTime();
  for (let i = 0; i < 4; i++) {
    F.reset(s, 'focus'); F.start(s, now, 'work-' + i); now = s.endAt; F.settle(s, now);
    assert.equal(F.nextMode(s), i === 3 ? 'long' : 'short');
    F.reset(s, F.nextMode(s)); F.start(s, now, 'break-' + i); now = s.endAt; F.settle(s, now);
    assert.equal(F.nextMode(s), 'focus');
  }
  assert.deepEqual(F.today(s, now), { count: 4, minutes: 100 });
});

test('reset discards unfinished work but preserves completed history and task association', () => {
  const s = F.fresh(); s.task = { id: 'task1', title: 'Review' }; F.start(s, 1000000, 'one'); F.settle(s, s.endAt);
  F.reset(s, 'focus'); F.start(s, 10000000, 'two'); F.pause(s, 10006000); F.reset(s, 'short');
  assert.equal(s.history.length, 1); assert.equal(s.history[0].task.id, 'task1'); assert.equal(s.runId, ''); assert.equal(s.remaining, 300000);
});

test('local calendar day controls statistics and daily quote independent of timezone offset', () => {
  const s = F.fresh(), yesterday = new Date(2026, 8, 14, 23, 40).getTime(); F.start(s, yesterday, 'midnight'); F.settle(s, s.endAt);
  assert.equal(F.today(s, yesterday).count, 0); assert.equal(F.today(s, new Date(2026, 8, 15, 9).getTime()).count, 1);
  assert.equal(D.quote(new Date(2026, 8, 15, 0)), D.quote(new Date(2026, 8, 15, 23)));
  assert.notEqual(D.quote(new Date(2026, 8, 15)), D.quote(new Date(2026, 8, 16)));
});

test('malformed settings recover safely; fresh timer uses chosen valid duration', () => {
  assert.deepEqual(F.read(null), F.fresh());
  const s = F.read({ v: 1, settings: { focus: -2, short: 0, long: 90, rounds: 'bad' }, running: true, endAt: 'bad' });
  assert.equal(s.running, false); assert.equal(s.settings.focus, 25); assert.equal(s.settings.rounds, 4);
  s.settings.focus = 45; F.reset(s, 'focus'); assert.equal(F.format(s.remaining), '45:00');
  assert.equal(F.format(1), '00:01'); assert.equal(F.format(0), '00:00');
});

test('scene shuffle never immediately repeats and every quote has bilingual text and a source', () => {
  for (const scene of D.scenes) for (const random of [0, .2, .8, .999]) assert.notEqual(D.nextScene(scene, random), scene);
  for (const q of D.quotes) { assert.ok(q.zh && q.en && q.authorZh && q.authorEn); assert.match(q.source, /^https:\/\//); }
});
