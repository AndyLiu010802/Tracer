'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { pulseFor } = require('../pulse');

test('keydown → 内容无关的 key 脉冲', function () {
  assert.deepStrictEqual(pulseFor('keydown'), { kind: 'key' });
});

test('mousedown / click → click 脉冲', function () {
  assert.deepStrictEqual(pulseFor('mousedown'), { kind: 'click' });
  assert.deepStrictEqual(pulseFor('click'), { kind: 'click' });
});

test('其它事件一律不计入种地', function () {
  ['keyup', 'mouseup', 'mousemove', 'wheel', 'scroll', 'input', '', 'KEYDOWN']
    .forEach(function (name) {
      assert.strictEqual(pulseFor(name), null, name + ' 不应产生脉冲');
    });
});

test('脉冲只含 kind 一个字段，绝不携带键位/坐标/内容', function () {
  assert.deepStrictEqual(Object.keys(pulseFor('keydown')), ['kind']);
  assert.deepStrictEqual(Object.keys(pulseFor('mousedown')), ['kind']);
});
