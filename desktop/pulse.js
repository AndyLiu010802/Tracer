'use strict';

// 全局输入钩子的原始事件 → 内容无关的「种地脉冲」。
//
// 这是整个桌面版唯一把原始输入变成游戏信号的地方，特意做成纯函数，
// 就是为了能单独测「它只吐 kind，绝不携带内容」。
// 只认两种事实：按下了一个键 / 按下了鼠标；返回 { kind } 别无其它。
// 键位、字符、鼠标坐标从不进入这里——调用方（main.js）连事件对象都不传进来，
// 所以内容无关是结构性的保证，不是靠事后擦除。
function pulseFor(eventName) {
  if (eventName === 'keydown') return { kind: 'key' };
  if (eventName === 'mousedown' || eventName === 'click') return { kind: 'click' };
  return null; // keyup / mouseup / mousemove / wheel / scroll 等一律不计入种地
}

module.exports = { pulseFor };
