'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Preferences = require('../public/backup-preferences');
const Focus = require('../skins/tracer/focus-model');
const clone = value => JSON.parse(JSON.stringify(value));

function activeFocus() {
  const state = Focus.fresh();
  state.settings = { focus: 17, short: 3, long: 11, rounds: 3, sound: false, notifications: true };
  state.duration = 17 * 60000; state.remaining = 9 * 60000;
  state.task = { id: 'current-task', title: 'Continue the real project', projectId: 'project-one' };
  state.history = [{ id: 'earlier-run', endedAt: 2000, minutes: 17, task: { id: 'earlier-task', title: 'Earlier work', projectId: 'project-one' } }];
  state.totalMinutes = 42; state.roundsDone = 2;
  state.running = true; state.endAt = 1000; state.runId = 'expired-unsettled-run';
  state.alarm = { id: 'stale-alarm', mode: 'focus', endedAt: 500 };
  state.lastNotifiedId = 'stale-alarm';
  return state;
}

test('backup preferences use an explicit allowlist and never include private or executable state', () => {
  const blocked = ['tracer.petGenerationDraft', 'tracer.gettingStartedDraft', 'tracer.workspaceDraft', 'tracer.cloudDraft', 'tracer.ai.connection', 'tracer.ai.apiKey', 'tracer.pet.chat', 'tracer.license', 'tracer.account.signal', 'credentials'];
  const input = Object.fromEntries(blocked.map(key => [key, 'private-value']));
  input['tracer.language'] = 'zh';
  input['tracer.railWidth'] = '320';
  assert.deepEqual(Preferences.clean(input), { 'tracer.language': 'zh', 'tracer.railWidth': '320' });
  assert.equal(new Set(Preferences.KEYS).size, Preferences.KEYS.length);
  for (const key of blocked) assert.ok(!Preferences.KEYS.includes(key), key);
});

test('restore pauses an expired timer without manufacturing completed work or alerts', () => {
  const focus = activeFocus(), input = { 'tracer.focus.v1': JSON.stringify(focus), 'tracer.language': 'en' };
  const before = clone(input), restored = JSON.parse(Preferences.forRestore(input)['tracer.focus.v1']);
  assert.equal(restored.running, false);
  assert.equal(restored.endAt, null);
  assert.equal(restored.alarm, null);
  assert.equal(restored.lastNotifiedId, '');
  assert.equal(restored.completed, false, 'an expired running snapshot is not settled during restore');
  assert.equal(restored.remaining, focus.remaining);
  assert.equal(restored.duration, focus.duration);
  assert.equal(restored.runId, focus.runId, 'resume keeps the unfinished session identity');
  assert.deepEqual(restored.task, focus.task);
  assert.deepEqual(restored.settings, focus.settings);
  assert.deepEqual(restored.history, focus.history);
  assert.equal(restored.totalMinutes, focus.totalMinutes);
  assert.equal(restored.roundsDone, focus.roundsDone);
  assert.deepEqual(input, before, 'preflight must not mutate the exported snapshot');
  assert.equal(Focus.settle(restored, Date.now()), false);
  assert.equal(restored.history.length, 1);
});

test('snapshot cleaning preserves running state while only restore makes it inactive', () => {
  const focus = activeFocus(), input = { 'tracer.focus.v1': JSON.stringify(focus) };
  const cleaned = JSON.parse(Preferences.clean(input)['tracer.focus.v1']);
  assert.equal(cleaned.running, true);
  assert.equal(cleaned.endAt, focus.endAt);
  assert.equal(cleaned.alarm.id, focus.alarm.id);
  const restored = Preferences.forRestore(input);
  assert.deepEqual(Preferences.forRestore(restored), restored, 'replaying restore normalization does not alter saved work');
});

test('focus and guide records cannot smuggle unrelated properties into restored storage', () => {
  const focus = activeFocus();
  focus.apiKey = 'sensitive';
  focus.task.credential = 'sensitive';
  focus.history[0].photo = 'sensitive';
  focus.history[0].task.chat = 'sensitive';
  const input = {
    'tracer.focus.v1': JSON.stringify(focus),
    'tracer.gettingStarted.v1': JSON.stringify({ version: 1, mode: 'active', taskId: 'current-task', focused: true, draft: 'sensitive', token: 'sensitive' }),
    'tracer.ambient.v1': JSON.stringify({ scene: 'forest', enabled: true, collapsed: false, day: '2026-10-01', privateURL: 'sensitive' })
  };
  const clean = Preferences.clean(input);
  assert.ok(!JSON.stringify(clean).includes('sensitive'));
  assert.deepEqual(JSON.parse(clean['tracer.gettingStarted.v1']), { version: 1, mode: 'active', taskId: 'current-task', focused: true });
  assert.equal(JSON.parse(clean['tracer.focus.v1']).history[0].task.title, 'Earlier work');
});

test('invalid known preferences fail before any restore can apply a partial set', () => {
  const invalid = [
    null, [], 'preferences',
    { 'tracer.language': 'fr' }, { 'tracer.language': 1 },
    { 'tracer.focus.v1': '{broken' }, { 'tracer.focus.v1': '{"v":2}' },
    { 'tracer.gettingStarted.v1': '{"version":1,"mode":"unknown"}' },
    { 'tracer.ambient.v1': '[]' },
    { 'tracer.wallpaperSpeed': '2' }, { 'tracer.wallpaperOpacity': '101' },
    { 'tracer.railWidth': '-1' }, { 'tracer.railWidth': 'Infinity' },
    { 'tracer.wallpaperPaused': 'true' }
  ];
  for (const value of invalid) {
    assert.throws(() => Preferences.clean(value), /backup-invalid-preferences/, JSON.stringify(value));
    assert.throws(() => Preferences.forRestore(value), /backup-invalid-preferences/, JSON.stringify(value));
  }
});

test('oversized input is rejected and supported numeric settings are normalized', () => {
  assert.throws(() => Preferences.clean({ unexpected: 'x'.repeat(1024 * 1024) }), /backup-invalid-preferences/);
  assert.deepEqual(Preferences.clean({ 'tracer.railWidth': '0320', 'tracer.wallpaperSpeed': '0.5', 'tracer.wallpaperOpacity': '44', 'tracer.gardenHidden': '0', 'tracer.wallpaperPaused': '1' }),
    { 'tracer.gardenHidden': '0', 'tracer.railWidth': '320', 'tracer.wallpaperOpacity': '44', 'tracer.wallpaperPaused': '1', 'tracer.wallpaperSpeed': '0.5' });
});
