(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ConcealPolicy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 自动隐藏的判定策略。
  //
  // 单独拎出来是因为原本的实现有两个误判，都让小窗在用户明明还在看的时候消失：
  //
  //   1. 点进小窗 → 焦点移入 iframe → 父页面 window.blur 触发 → 误判为「切走了」。
  //      父页面失焦不等于浏览器失焦。焦点在自家 iframe 里时，
  //      document.hasFocus() 仍为 true，用它来区分这两种情况。
  //
  //   2. 鼠标从小窗移到页面别处 → iframe 文档 mouseleave 触发 → 误判为「离开了」。
  //      鼠标位置和「人在不在」没有关系：移到标签栏、地址栏、第二块屏幕，
  //      甚至只是移开去看正文，都会触发。这条默认不启用。
  //
  // 真正想捕捉的信号只有一个：浏览器窗口/标签页不再是用户正在看的东西。

  var MODES = ['off', 'blur', 'aggressive'];

  function normalizeMode(mode) {
    return MODES.indexOf(mode) >= 0 ? mode : 'blur';
  }

  /**
   * @param {string} reason  'blur' | 'hidden' | 'mouseleave' | 'idle'
   * @param {object} ctx     { mode, hasFocus, visible, pointerInside }
   *   hasFocus       document.hasFocus()：焦点是否还在本文档树内（含自家 iframe）
   *   visible        document.visibilityState !== 'hidden'
   *   pointerInside  指针当前是否在小窗范围内（含内部 iframe）
   * @returns {boolean} 是否应当收起小窗
   */
  function shouldConceal(reason, ctx) {
    var c = ctx || {};
    var mode = normalizeMode(c.mode);
    if (mode === 'off') return false;

    // 指针还在小窗里，说明人正在用它，任何焦点类信号都不算「走了」。
    // 两个例外：hidden——标签页真被切走时指针位置是过期信息；
    // idle——挂机时指针就停在最后的位置上，恰恰不能作为「人还在」的证据。
    if (c.pointerInside === true && reason !== 'hidden' && reason !== 'idle') return false;

    switch (reason) {
      case 'hidden':
        // 标签页真的被切走或窗口最小化。最可靠的信号。
        return c.visible === false;

      case 'blur':
        // 只有整个文档树都失去焦点才算。焦点落在自家 iframe 里时不算。
        return c.hasFocus === false;

      case 'mouseleave':
        // 误报率太高，只在显式要求时启用。
        return mode === 'aggressive';

      case 'idle':
        // 太久没有任何输入。失焦/切页签都建立在「用户切走了」上，
        // 人直接离开工位时那些信号一个都不会触发；时间是唯一的判据。
        // 阈值判定在调用方，走到这里就表示已经超时。
        return true;

      default:
        return false;
    }
  }

  /**
   * 右键是否应当切换小窗显隐。
   *
   * 规则只有一条：指针在小窗内时右键不生效。
   * 这个前提本身就挡掉了绝大多数误触——你要收起小窗，总是先把鼠标移开的。
   * 有了它单击就够用，不必再让用户去凑双击的节奏。
   *
   * 小窗处于隐藏状态时指针不可能在其范围内，因此右键自然能把它唤回来。
   *
   * @param {object} ctx { pointerInside }
   */
  function shouldToggleOnRightClick(ctx) {
    return (ctx || {}).pointerInside !== true;
  }

  return {
    shouldConceal: shouldConceal,
    shouldToggleOnRightClick: shouldToggleOnRightClick,
    normalizeMode: normalizeMode,
    MODES: MODES,
  };
});
