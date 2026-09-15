(function () {
  'use strict';
  var T = window.Tracer;
  var mounted = false;

  // 进 Garden 时把农场挂进来，离开时卸载。农场引擎（DBFarm）由共享的
  // farm.js 提供；main=游戏主区、side=作物商店。farm 自己吃全局按键喂农场，
  // 常驻计数与分区无关，这里只负责「可见时把它渲染出来」。
  function show() {
    if (!window.DBFarm) return;    // 游戏脚本没加载（理论不会）
    var main = document.getElementById('garden-main');
    var side = document.getElementById('garden-shop');
    if (!main || !side) return;
    if (mounted) window.DBFarm.unmount();
    window.DBFarm.mount(main, side);
    mounted = true;
  }

  function maybeUnmount(toSec) {
    if (mounted && toSec !== 'garden') {
      window.DBFarm.unmount();
      mounted = false;
    }
  }

  T.onShow('garden', show);

  // 更稳的卸载：给每个非 garden 分区挂一个卸载钩子（onShow 只在数据就绪后触发，
  // 但 garden 的卸载不依赖数据，直接判 mounted）。分区清单从 T.sections 推导
  // （app.js 的单一事实来源），不在这里手抄一份——抄的那份加分区时最容易漏改。
  // 故意不写 T.sections || [] 兜底：那种兜底会把「缺一个分区」的小问题放大成
  // 「一个卸载钩子都不挂」的大问题——农场的 1000ms 定时器会在隐藏的 Garden 分区
  // 里永远跑下去而不报错，比直接在加载期报错更难排查。T.sections 缺失就让它
  // 在这里就地炸掉。
  T.sections.forEach(function (s) {
    if (s === 'garden') return;
    T.onShow(s, function () { maybeUnmount(s); });
  });
})();
