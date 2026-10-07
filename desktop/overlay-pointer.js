'use strict';

// Electron's forwarded mousemove events are not a reliable way to leave
// WS_EX_TRANSPARENT on Windows. Read the native DIP cursor independently.
// Regions use viewport fractions, so DPI, window moves and resizes agree.
function attachOverlayPointer(window, screen, setIgnored, held, timers = globalThis) {
  let regions = [{ x: 0, y: 0, width: 1, height: 1 }], timer = null, disposed = false;
  const supported = typeof screen.getCursorScreenPoint === 'function';
  function poll() {
    if (!supported || disposed || window.isDestroyed() || !window.isVisible()) return;
    if (held()) { setIgnored(false); return; }
    const cursor = screen.getCursorScreenPoint(), bounds = window.getBounds();
    // Restore slightly before crossing the visible edge, including shadows.
    const pad = 6;
    const inside = regions.some(r => cursor.x >= bounds.x + r.x * bounds.width - pad
      && cursor.x <= bounds.x + (r.x + r.width) * bounds.width + pad
      && cursor.y >= bounds.y + r.y * bounds.height - pad
      && cursor.y <= bounds.y + (r.y + r.height) * bounds.height + pad);
    setIgnored(!inside);
  }
  function start() { if (!supported || disposed) return; poll(); if (timer === null) { timer = timers.setInterval(poll, 16); timer.unref?.(); } }
  function stop() { if (timer !== null) { timers.clearInterval(timer); timer = null; } }
  function update(value) {
    if (!Array.isArray(value) || !value.length || value.length > 8 || value.some(r => !r
      || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(r[key]))
      || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1.001 || r.y + r.height > 1.001)) return;
    regions = value.map(({ x, y, width, height }) => ({ x, y, width, height })); poll();
  }
  function reset() { regions = [{ x: 0, y: 0, width: 1, height: 1 }]; setIgnored(false); }
  function destroy() { disposed = true; stop(); window.removeListener('show', start); window.removeListener('hide', stop); window.removeListener('closed', destroy); }
  window.on('show', start); window.on('hide', stop); window.on('closed', destroy);
  if (window.isVisible()) start();
  return { update, poll, reset, request(value) { if (supported) poll(); else setIgnored(value); }, destroy };
}

module.exports = { attachOverlayPointer };
