'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../desktop/local-vfx-model');

test('the local-only release gate requires explicit unpackaged and local values', () => {
  assert.equal(M.allowed({ isPackaged: false }, { channel: 'local' }), true);
  for (const app of [undefined, null, {}, { isPackaged: true }, { isPackaged: 0 }, { isPackaged: 'false' }]) {
    assert.equal(M.allowed(app, { channel: 'local' }), false);
  }
  for (const profile of [undefined, null, {}, { channel: 'commercial' }, { channel: 'LOCAL' }, { channel: 'local ' }]) {
    assert.equal(M.allowed({ isPackaged: false }, profile), false);
  }
});

test('fresh settings disable playback and immutable effect metadata has finite durations', () => {
  assert.equal(M.defaults.enabled, false);
  assert.equal(M.defaults.effect, 'haunt');
  assert.equal(Object.isFrozen(M.defaults), true);
  assert.equal(Object.isFrozen(M.effects), true);
  assert.deepEqual(M.effects.map(({ id, duration }) => ({ id, duration })), [{ id: 'haunt', duration: 7000 }, { id: 'leer', duration: 3300 }]);
  for (const effect of M.effects) {
    assert.equal(Object.isFrozen(effect), true);
    assert.equal(typeof effect.name, 'string');
    assert(effect.name.length > 0);
  }
  assert.deepEqual(M.normalize(), M.defaults);
});

test('partial updates preserve current preferences without mutating either input', () => {
  const previous = M.normalize({ enabled: true, effect: 'leer', strength: 0.5, atmosphere: false, size: 140, motion: 'reduced' });
  const patch = Object.freeze({ size: 80 });
  const updated = M.normalize(patch, previous);
  assert.deepEqual(updated, { ...previous, size: 80 });
  assert.equal(previous.size, 140);
  assert.equal(patch.size, 80);
  assert.notEqual(updated, previous);
  assert.equal(Object.isFrozen(updated), true);
  assert.throws(() => { updated.enabled = false; }, TypeError);
});

test('settings accept exact numeric bounds and all explicit motion modes', () => {
  for (const strength of [0, 0.35, 0.6]) assert.equal(M.normalize({ strength }).strength, strength);
  for (const size of [40, 100, 200]) assert.equal(M.normalize({ size }).size, size);
  for (const motion of ['system', 'normal', 'reduced']) assert.equal(M.normalize({ motion }).motion, motion);
  for (const effect of ['haunt', 'leer']) assert.equal(M.normalize({ effect }).effect, effect);
  for (const enabled of [true, false]) assert.equal(M.normalize({ enabled }).enabled, enabled);
  for (const atmosphere of [true, false]) assert.equal(M.normalize({ atmosphere }).atmosphere, atmosphere);
});

test('settings reject coercion, non-finite numbers and values beyond their bounds', () => {
  const cases = {
    enabled: [undefined, null, 0, 1, 'true', {}, []],
    atmosphere: [undefined, null, 0, 1, 'false', {}, []],
    effect: [undefined, null, 'HAUNT', 'other', 1, {}, []],
    motion: [undefined, null, 'SYSTEM', 'none', 1, {}, []],
    strength: [undefined, null, -0.00001, 0.60001, '0.35', true, NaN, Infinity, -Infinity, {}, []],
    size: [undefined, null, 39.999, 200.001, '100', true, NaN, Infinity, -Infinity, {}, []]
  };
  for (const [field, values] of Object.entries(cases)) {
    for (const value of values) assert.throws(() => M.normalize({ [field]: value }), /local-vfx-invalid-settings/, field);
  }
});

test('unknown properties and invalid settings containers are rejected', () => {
  for (const value of [null, false, true, 0, 1, '', 'settings', [], ['haunt']]) {
    assert.throws(() => M.normalize(value), /local-vfx-invalid-settings/);
  }
  for (const value of [{ typo: true }, { enabled: true, duration: 999999 }, { effect: 'haunt', start: { x: 1, y: 2 } }, JSON.parse('{"__proto__":{"enabled":true}}'), { constructor: 'invalid' }]) {
    assert.throws(() => M.normalize(value), /local-vfx-invalid-settings/);
  }
  assert.equal({}.enabled, undefined);
});
