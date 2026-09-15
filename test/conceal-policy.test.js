'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  shouldConceal, shouldToggleOnRightClick, normalizeMode, MODES,
} = require('../public/conceal-policy.js');

test('右键：指针在小窗内时不生效', () => {
  assert.strictEqual(
    shouldToggleOnRightClick({ pointerInside: true }),
    false,
    '正在读的时候右键不该把小窗收走'
  );
});

test('右键：指针移出小窗后生效', () => {
  assert.strictEqual(shouldToggleOnRightClick({ pointerInside: false }), true);
});

test('右键：小窗已隐藏时能唤回', () => {
  // 小窗隐藏后指针不可能在其范围内，于是右键自然成为唤回手段。
  assert.strictEqual(shouldToggleOnRightClick({ pointerInside: false }), true);
});

test('右键：上下文缺失时按「不在小窗内」处理', () => {
  // 宁可能收起，也不要出现「怎么点都收不掉」的死局。
  assert.strictEqual(shouldToggleOnRightClick({}), true);
  assert.strictEqual(shouldToggleOnRightClick(undefined), true);
});

test('挂机：超时即收起，指针停在小窗内也不豁免', () => {
  // 人离开工位时指针就停在最后的位置上，「指针在小窗内」恰恰不能证明人还在。
  assert.strictEqual(
    shouldConceal('idle', { mode: 'blur', hasFocus: true, visible: true, pointerInside: true }),
    true
  );
  assert.strictEqual(
    shouldConceal('idle', { mode: 'aggressive', hasFocus: true, visible: true }),
    true
  );
});

test('挂机：off 模式下不收起', () => {
  assert.strictEqual(shouldConceal('idle', { mode: 'off' }), false);
});

// 下面两组是回归测试。这两种情况曾让小窗在用户明明还在看的时候消失。

test('回归：点进小窗不应触发隐藏', () => {
  // 点击 iframe 会让父页面收到 blur，但焦点只是移进了自家框架，
  // 此时 document.hasFocus() 仍为 true。
  assert.strictEqual(
    shouldConceal('blur', { mode: 'blur', hasFocus: true, visible: true }),
    false,
    '焦点还在本文档树内，用户没走'
  );
});

test('回归：鼠标移出小窗不应触发隐藏', () => {
  // 鼠标从小窗移到页面别处、移到标签栏、移到第二块屏幕，人都还在。
  assert.strictEqual(
    shouldConceal('mouseleave', { mode: 'blur', hasFocus: true, visible: true }),
    false,
    '默认模式下鼠标位置不作为判据'
  );
  assert.strictEqual(
    shouldConceal('mouseleave', { mode: 'blur', hasFocus: false, visible: true }),
    false,
    '即使同时失焦，mouseleave 本身也不该成为默认模式的判据'
  );
});

test('回归：指针停在小窗内时，任何焦点信号都不隐藏', () => {
  // 这是用户最直接的诉求：鼠标还在小框里就不该消失。
  for (const reason of ['blur', 'mouseleave']) {
    assert.strictEqual(
      shouldConceal(reason, { mode: 'blur', hasFocus: false, visible: true, pointerInside: true }),
      false,
      reason + '：指针还在小窗里，人正在用它'
    );
    assert.strictEqual(
      shouldConceal(reason, { mode: 'aggressive', hasFocus: false, visible: true, pointerInside: true }),
      false,
      reason + '：aggressive 模式也要让位于指针停留'
    );
  }
});

test('指针停留不能盖过「标签页真被切走」', () => {
  // 切到别的标签页后，指针位置是过期信息，不能拿它当挡箭牌。
  assert.strictEqual(
    shouldConceal('hidden', { mode: 'blur', hasFocus: false, visible: false, pointerInside: true }),
    true
  );
});

test('指针离开小窗后，正常的失焦判定恢复生效', () => {
  assert.strictEqual(
    shouldConceal('blur', { mode: 'blur', hasFocus: false, visible: true, pointerInside: false }),
    true
  );
});

test('真的切到别的程序时隐藏', () => {
  assert.strictEqual(
    shouldConceal('blur', { mode: 'blur', hasFocus: false, visible: true }),
    true,
    '整个文档树都失去焦点，才算用户走了'
  );
});

test('标签页被切走或窗口最小化时隐藏', () => {
  assert.strictEqual(
    shouldConceal('hidden', { mode: 'blur', hasFocus: false, visible: false }),
    true
  );
  assert.strictEqual(
    shouldConceal('hidden', { mode: 'blur', hasFocus: true, visible: true }),
    false,
    '页面仍可见就不该隐藏'
  );
});

test('aggressive 模式下才启用 mouseleave', () => {
  assert.strictEqual(
    shouldConceal('mouseleave', { mode: 'aggressive', hasFocus: true, visible: true }),
    true
  );
});

test('off 模式下任何信号都不隐藏', () => {
  for (const reason of ['blur', 'hidden', 'mouseleave']) {
    assert.strictEqual(
      shouldConceal(reason, { mode: 'off', hasFocus: false, visible: false }),
      false,
      reason + ' 在 off 模式下不应隐藏'
    );
  }
});

test('未知信号不触发隐藏', () => {
  assert.strictEqual(shouldConceal('whatever', { mode: 'aggressive', hasFocus: false }), false);
});

test('缺失上下文时保守处理，不隐藏', () => {
  // 宁可该藏没藏（还有老板键兜底），也不要不该藏却藏了——后者每天要烦你几十次。
  assert.strictEqual(shouldConceal('blur', {}), false);
  assert.strictEqual(shouldConceal('blur', undefined), false);
  assert.strictEqual(shouldConceal('hidden', {}), false);
});

test('normalizeMode 处理非法值', () => {
  assert.strictEqual(normalizeMode('off'), 'off');
  assert.strictEqual(normalizeMode('aggressive'), 'aggressive');
  assert.strictEqual(normalizeMode('nonsense'), 'blur');
  assert.strictEqual(normalizeMode(undefined), 'blur');
  assert.strictEqual(normalizeMode(null), 'blur');
  assert.deepStrictEqual(MODES, ['off', 'blur', 'aggressive']);
});
