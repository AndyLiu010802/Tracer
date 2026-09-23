(function () {
  'use strict';
  // Electron keeps document.hidden=false when backgroundThrottling is disabled
  // for focus alarms. Keep visual activity separate from those background jobs.
  let nativeVisible = true;
  function update() {
    const hidden = document.hidden || !nativeVisible;
    if (document.tracerHidden === hidden) return;
    document.tracerHidden = hidden;
    document.documentElement.toggleAttribute('data-render-paused', hidden);
    document.dispatchEvent(new Event('tracer-visibilitychange'));
  }
  document.addEventListener('visibilitychange', update);
  window.TracerWindow?.onState(state => {
    if (typeof state.visible === 'boolean') { nativeVisible = state.visible; update(); }
  });
  window.TracerWindow?.send('state');
  update();
})();
